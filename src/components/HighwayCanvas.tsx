import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CAR_CONFIGS,
  CAR_ORDER,
  CarId,
  GamePlayMode,
  GraphicsQuality,
  HIGHWAY_CONFIG,
  SensitivityLevel,
  SteeringMode,
} from '../game/config';
import {
  calculateRunRewards,
  CarProtectionMap,
  CarUpgradesMap,
  computeLandscapeTiltDegreesFromSensors,
  evaluateVehicleInteraction,
  getEffectiveCarStats,
  processTiltInput,
  RunRewardsSummary,
  selectFairTrafficLanes,
  stepLongitudinalPhysics,
} from '../game/rules';
import {
  AiOpponentState,
  calculateLevelRaceRewards,
  computeCurvedRoadCenterAtWorldZ,
  computeRaceStandings,
  createLevelAiOpponents,
  GeneratedLevelCourse,
  generateLevelCourse,
  LevelHazardType,
  LevelRaceRewardsBreakdown,
  PLAYER_GRID_START_DIST,
  PLAYER_GRID_START_X,
  RacerStandingEntry,
  sampleTrackAtDistance,
  stepAiOpponent,
} from '../game/levelsMode';
import { CarCustomizationState, createDefaultCarCustomization } from '../game/saveSystem';
import { soundController } from '../game/audio';
import {
  applyCarCustomizationToRig,
  buildCoinCollectibleMesh,
  buildLevelObstacleMesh,
  buildPlayerCarMesh,
  buildStartFinishGantryMesh,
  buildTrafficVehicleMesh,
  createCityBuildingTexture,
  createRoadTextures,
  createSkyBackdropTexture,
  PlayerCarMeshRig,
  TrafficArchetype,
} from '../game/models3d';

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export type MotionPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export interface HudDomRefs {
  speedValueRef: React.RefObject<HTMLSpanElement | null>;
  distanceValueRef: React.RefObject<HTMLSpanElement | null>;
  scoreValueRef: React.RefObject<HTMLSpanElement | null>;
  coinsValueRef: React.RefObject<HTMLSpanElement | null>;
  nitroFillRef: React.RefObject<HTMLDivElement | null>;
  nitroPctRef: React.RefObject<HTMLSpanElement | null>;
  tiltAngleBadgeRef: React.RefObject<HTMLSpanElement | null>;
  steerIndicatorBarRef: React.RefObject<HTMLDivElement | null>;
  racePositionValueRef?: React.RefObject<HTMLSpanElement | null>;
  remainingDistValueRef?: React.RefObject<HTMLSpanElement | null>;
  levelProgressFillRef?: React.RefObject<HTMLDivElement | null>;
}

export interface LiveRaceSnapshot {
  integrity: number;
  maxIntegrity: number;
  countdownValue: number | null; // 3, 2, 1, 0 ('GO!'), or null
  nearMissCount: number;
  comboBanner: { text: string; subtext: string; id: number; tone: 'cyan' | 'amber' | 'danger' } | null;
  reviveUsed: boolean;
  playMode?: GamePlayMode;
  levelNumber?: number;
  levelTitle?: string;
  segmentLabel?: string;
  playerPosition?: number; // 1..6
  totalRacers?: number;    // 6
  isDrifting?: boolean;
  driftScore?: number;
}

export interface CompletedRunPayload {
  runId: string;
  playMode: GamePlayMode;
  summary: RunRewardsSummary;
  coinsCollected: number;
  nearMissCount: number;
  driftScore: number;
  topSpeedKmh: number;
  reviveAvailable: boolean;
  levelResult?: {
    course: GeneratedLevelCourse;
    standings: RacerStandingEntry[];
    playerPosition: number;
    playerFinishedCourse: boolean;
    finishTimeSec: number;
    rewards: LevelRaceRewardsBreakdown;
    coinsCollected: number;
    driftScore: number;
    collisionsCount: number;
  };
}

export interface TouchInputControlsRef {
  steerLeftHeld: boolean;
  steerRightHeld: boolean;
  steerTapImpulse?: number;
  steerTapRemainingSec?: number;
  steerLongPressActive?: boolean;
  nitroHeld: boolean;
  brakeHeld: boolean;
  dragSteerNormalized: number;
  simulatedTiltDeg: number;
  lastRawDeviceTiltDeg: number;
  hasRealDeviceOrientation: boolean;
  motionPermissionState: MotionPermissionState;
  triggerRevive?: () => void;
  triggerRestart?: () => void;
  rotateGarageTurntable?: (deltaRad: number) => void;
  setGarageRotateHoldDir?: (dir: -1 | 0 | 1) => void;
  resetGarageTurntableView?: () => void;
  toggleGarageAutoRotate?: () => boolean;
  requestMotionPermission?: () => Promise<boolean>;
}

interface HighwayCanvasProps {
  gameState: GameLifecycleState;
  playMode?: GamePlayMode;
  levelNumber?: number;
  isGarageOpen: boolean;
  selectedCarId: CarId;
  carUpgrades: Record<CarId, CarUpgradesMap>;
  carProtection?: Record<CarId, CarProtectionMap>;
  carCustomizations?: Record<CarId, CarCustomizationState>;
  steeringMode: SteeringMode;
  sensitivity: SensitivityLevel;
  invertTilt: boolean;
  neutralTiltOffsetDeg: number;
  graphicsQuality: GraphicsQuality;
  hudRefs: HudDomRefs;
  controlsRef: React.MutableRefObject<TouchInputControlsRef>;
  onLiveStateChange: (snapshot: LiveRaceSnapshot) => void;
  onRunEnded: (payload: CompletedRunPayload) => void;
  onRequestPauseToggle: () => void;
  onSensorFallbackNotice: (msg: string) => void;
}

interface PooledTrafficItem {
  mesh: THREE.Group;
  active: boolean;
  laneIndex: number;
  x: number;
  z: number;
  speedMs: number;
  halfWidth: number;
  halfLength: number;
  nearMissScored: boolean;
}

interface PooledCoinItem {
  mesh: THREE.Group;
  active: boolean;
  x: number;
  z: number;
}

interface ParticleData {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  colorHex: number;
}

interface CarBoundsMetadata {
  radius: number;
  centerY: number;
  length: number;
  width: number;
  height: number;
}

const TRAFFIC_COLORS = [
  0xe2e8f0, 0x38bdf8, 0xf59e0b, 0xef4444, 0x10b981, 0xa855f7, 0x64748b, 0xf97316,
];

const TRAFFIC_SPECS: Record<
  TrafficArchetype,
  { halfWidth: number; halfLength: number; minSpeedMs: number; maxSpeedMs: number }
> = {
  sedan: { halfWidth: 0.92, halfLength: 2.18, minSpeedMs: 22, maxSpeedMs: 32 },
  suv: { halfWidth: 1.0, halfLength: 2.3, minSpeedMs: 20, maxSpeedMs: 29 },
  sport: { halfWidth: 0.94, halfLength: 2.15, minSpeedMs: 28, maxSpeedMs: 39 },
  truck: { halfWidth: 1.15, halfLength: 3.55, minSpeedMs: 17, maxSpeedMs: 24 },
};

const DEFAULT_GARAGE_YAW_RAD = 0.62;

function getScreenOrientationDegrees(): number {
  if (typeof window === 'undefined') return 0;
  if (window.screen?.orientation && typeof window.screen.orientation.angle === 'number') {
    return window.screen.orientation.angle;
  }
  const legacyOrient = (window as unknown as { orientation?: number }).orientation;
  if (typeof legacyOrient === 'number') {
    return legacyOrient;
  }
  return window.innerWidth >= window.innerHeight ? 90 : 0;
}

export const HighwayCanvas: React.FC<HighwayCanvasProps> = (props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef<HighwayCanvasProps>(props);
  propsRef.current = props;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const quality = propsRef.current.graphicsQuality;
    const renderer = new THREE.WebGLRenderer({
      antialias: quality !== 'low',
      powerPreference: 'high-performance',
    });

    const maxDpr = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = createSkyBackdropTexture();
    // Clean, consistent distance depth cue without any weather fog
    scene.fog = new THREE.FogExp2(0x111a2e, 0.0038);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.88;

    const camera = new THREE.PerspectiveCamera(
      58,
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight),
      0.2,
      280
    );
    camera.position.set(0, 3.1, 6.8);

    // Clear, consistent lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.38);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.5);
    sunLight.position.set(22, 42, 26);
    if (quality !== 'low') {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 130;
      const d = 24;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rimLight.position.set(-18, 12, -24);
    scene.add(rimLight);

    // Deformable Segmented Road & Barrier Geometry for True U-Shaped Curves & Hairpins
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const { albedoMap, roughnessMap } = createRoadTextures(maxAniso);
    albedoMap.repeat.set(1, 20);
    roughnessMap.repeat.set(1, 20);

    const roadZSegments = 56;
    const roadLength = 320;
    const roadCenterZ = -110;
    const roadGeo = new THREE.PlaneGeometry(HIGHWAY_CONFIG.roadWidth, roadLength, 1, roadZSegments);
    roadGeo.rotateX(-Math.PI / 2);
    roadGeo.translate(0, 0, roadCenterZ);

    const roadPosAttr = roadGeo.attributes.position as THREE.BufferAttribute;
    const roadBaseX = new Float32Array(roadPosAttr.count);
    const roadBaseZ = new Float32Array(roadPosAttr.count);
    for (let i = 0; i < roadPosAttr.count; i++) {
      roadBaseX[i] = roadPosAttr.getX(i);
      roadBaseZ[i] = roadPosAttr.getZ(i);
    }

    const roadMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      roughnessMap,
      roughness: 0.72,
      metalness: 0.14,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 420),
      new THREE.MeshStandardMaterial({ color: 0x0b101d, roughness: 0.95 })
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.set(0, -0.06, -120);
    scene.add(groundPlane);

    // Segmented Barriers & Neon Strips that follow the curved road geometry
    function createCurvableWallMesh(
      width: number,
      height: number,
      baseXOffset: number,
      baseYOffset: number,
      material: THREE.Material
    ) {
      const geo = new THREE.BoxGeometry(width, height, roadLength, 1, 1, roadZSegments);
      geo.translate(baseXOffset, baseYOffset, roadCenterZ);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const origX = new Float32Array(pos.count);
      const origZ = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        origX[i] = pos.getX(i);
        origZ[i] = pos.getZ(i);
      }
      const mesh = new THREE.Mesh(geo, material);
      scene.add(mesh);
      return { geo, pos, origX, origZ, mesh };
    }

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.52,
      metalness: 0.38,
    });
    const leftBarrier = createCurvableWallMesh(
      0.65,
      0.9,
      -HIGHWAY_CONFIG.roadWidth * 0.5 - 0.32,
      0.45,
      barrierMat
    );
    const rightBarrier = createCurvableWallMesh(
      0.65,
      0.9,
      HIGHWAY_CONFIG.roadWidth * 0.5 + 0.32,
      0.45,
      barrierMat
    );

    const leftStrip = createCurvableWallMesh(
      0.1,
      0.1,
      -HIGHWAY_CONFIG.roadWidth * 0.5 + 0.03,
      0.76,
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.2,
      })
    );
    const rightStrip = createCurvableWallMesh(
      0.1,
      0.1,
      HIGHWAY_CONFIG.roadWidth * 0.5 - 0.03,
      0.76,
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.2,
      })
    );

    const curvableRoadWalls = [leftBarrier, rightBarrier, leftStrip, rightStrip];

    // Showroom Pedestal Ring (visible when Garage is open)
    const turntableGroup = new THREE.Group();
    const platformDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.15, 3.35, 0.12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.82,
        roughness: 0.2,
      })
    );
    platformDisc.position.y = -0.05;
    const platformGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.22, 0.055, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.5,
      })
    );
    platformGlowRing.rotation.x = Math.PI / 2;
    platformGlowRing.position.y = 0.01;
    turntableGroup.add(platformDisc, platformGlowRing);
    turntableGroup.visible = false;
    scene.add(turntableGroup);

    // Streetlight Arches & City Towers
    const archCount = 22;
    const pillarGeo = new THREE.BoxGeometry(0.32, 7.8, 0.32);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.35,
    });
    const archPillarsInst = new THREE.InstancedMesh(pillarGeo, pillarMat, archCount * 2);
    scene.add(archPillarsInst);

    const lampHeadGeo = new THREE.BoxGeometry(2.1, 0.16, 0.38);
    const lampHeadMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.4,
    });
    const lampHeadsInst = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, archCount * 2);
    scene.add(lampHeadsInst);

    // Overhead Tunnel Ceiling Rings for Levels Mode Tunnel Segments
    const tunnelRingCount = 14;
    const tunnelRoofGeo = new THREE.BoxGeometry(HIGHWAY_CONFIG.roadWidth + 1.5, 0.55, 6.5);
    const tunnelRoofMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.4,
    });
    const tunnelRoofInst = new THREE.InstancedMesh(tunnelRoofGeo, tunnelRoofMat, tunnelRingCount);
    scene.add(tunnelRoofInst);

    const buildingTex = createCityBuildingTexture(maxAniso);
    const towerCount = 48;
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    towerGeo.translate(0, 0.5, 0);
    const towerMat = new THREE.MeshStandardMaterial({
      map: buildingTex,
      roughness: 0.38,
      metalness: 0.55,
    });
    const towersInst = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
    scene.add(towersInst);

    const towerMeta = Array.from({ length: towerCount }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      return {
        side,
        xOffset: side * (16 + ((i * 7) % 18)),
        zOffset: -row * 10.5,
        w: 8 + ((i * 5) % 9),
        h: 22 + ((i * 13) % 52),
        d: 8 + ((i * 3) % 9),
      };
    });

    // Build all 8 Player Car Rigs and compute their exact 3D bounding boxes for Garage camera framing
    const playerAnchor = new THREE.Group();
    scene.add(playerAnchor);

    const carRigs = {} as Record<CarId, PlayerCarMeshRig>;
    const carBounds = {} as Record<CarId, CarBoundsMetadata>;
    const _bbox = new THREE.Box3();
    const _bsphere = new THREE.Sphere();
    const _bsize = new THREE.Vector3();

    for (const cId of CAR_ORDER) {
      const rig = buildPlayerCarMesh(CAR_CONFIGS[cId]);
      const initCust =
        propsRef.current.carCustomizations?.[cId] ?? createDefaultCarCustomization();
      applyCarCustomizationToRig(rig, CAR_CONFIGS[cId], initCust);

      // Measure actual 3D bounds of the vehicle (excluding the invisible shield bubble)
      rig.shieldBubble.visible = false;
      rig.group.updateMatrixWorld(true);
      _bbox.setFromObject(rig.bodyGroup);
      for (const w of rig.wheels) {
        _bbox.expandByObject(w);
      }
      _bbox.getSize(_bsize);
      _bbox.getBoundingSphere(_bsphere);
      rig.shieldBubble.visible = true;

      carBounds[cId] = {
        radius: Math.max(2.2, Math.min(3.1, _bsphere.radius)),
        centerY: Math.max(0.52, Math.min(0.95, _bsphere.center.y)),
        length: Math.max(4.0, _bsize.z),
        width: Math.max(1.8, _bsize.x),
        height: Math.max(1.1, _bsize.y),
      };

      rig.group.visible = cId === propsRef.current.selectedCarId;
      playerAnchor.add(rig.group);
      carRigs[cId] = rig;
    }

    // Solo Mode Traffic & Coin Object Pools
    const archetypes: TrafficArchetype[] = ['sedan', 'suv', 'sport', 'truck'];
    const trafficPool: PooledTrafficItem[] = [];
    for (let i = 0; i < 20; i++) {
      const arch = archetypes[i % archetypes.length];
      const color = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
      const mesh = buildTrafficVehicleMesh(arch, color);
      mesh.visible = false;
      scene.add(mesh);
      trafficPool.push({
        mesh,
        active: false,
        laneIndex: 0,
        x: 0,
        z: -200,
        speedMs: 25,
        halfWidth: TRAFFIC_SPECS[arch].halfWidth,
        halfLength: TRAFFIC_SPECS[arch].halfLength,
        nearMissScored: false,
      });
    }

    const coinPool: PooledCoinItem[] = [];
    for (let i = 0; i < 26; i++) {
      const mesh = buildCoinCollectibleMesh();
      mesh.visible = false;
      scene.add(mesh);
      coinPool.push({
        mesh,
        active: false,
        x: 0,
        z: -200,
      });
    }

    // Levels Mode 3D Scene Objects: Start/Finish Gantries, 5 AI Opponent Car Rigs, and Course Obstacles
    const startGantryMesh = buildStartFinishGantryMesh(false);
    startGantryMesh.visible = false;
    scene.add(startGantryMesh);

    const finishGantryMesh = buildStartFinishGantryMesh(true);
    finishGantryMesh.visible = false;
    scene.add(finishGantryMesh);

    const aiOpponentRigs: PlayerCarMeshRig[] = [];
    for (let i = 0; i < 5; i++) {
      const defaultCarId = CAR_ORDER[(i + 1) % CAR_ORDER.length];
      const rig = buildPlayerCarMesh(CAR_CONFIGS[defaultCarId]);
      rig.group.visible = false;
      scene.add(rig.group);
      aiOpponentRigs.push(rig);
    }

    const levelObstaclePool: {
      mesh: THREE.Group;
      type: LevelHazardType;
    }[] = [];
    const hazardTypes: LevelHazardType[] = ['barrier_block', 'chevron_chicane', 'energy_pylon'];
    for (let i = 0; i < 18; i++) {
      const hType = hazardTypes[i % hazardTypes.length];
      const mesh = buildLevelObstacleMesh(hType);
      mesh.visible = false;
      scene.add(mesh);
      levelObstaclePool.push({ mesh, type: hType });
    }

    // Particle Pool (sparks, drift tyre smoke, nitro exhaust, coin pickup bursts)
    const maxParticles = 60;
    const particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.42);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInst = new THREE.InstancedMesh(particleGeo, particleMat, maxParticles);
    particleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(particleInst);

    const particles: ParticleData[] = Array.from({ length: maxParticles }, () => ({
      active: false,
      x: 0,
      y: -10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.5,
      scale: 1,
      colorHex: 0x38bdf8,
    }));

    function spawnParticleBurst(
      originX: number,
      originY: number,
      originZ: number,
      count: number,
      colorHex: number,
      spreadSpeed: number
    ) {
      let spawned = 0;
      for (let i = 0; i < maxParticles && spawned < count; i++) {
        if (!particles[i].active) {
          const p = particles[i];
          p.active = true;
          p.x = originX + (Math.random() - 0.5) * 0.6;
          p.y = originY + Math.random() * 0.4;
          p.z = originZ + (Math.random() - 0.5) * 0.5;
          p.vx = (Math.random() - 0.5) * spreadSpeed;
          p.vy = Math.random() * spreadSpeed * 0.65 + 1.0;
          p.vz = (Math.random() - 0.2) * spreadSpeed + 4.5;
          p.life = 0;
          p.maxLife = 0.26 + Math.random() * 0.28;
          p.scale = 0.7 + Math.random() * 0.8;
          p.colorHex = colorHex;
          spawned++;
        }
      }
    }

    // Pre-allocated temporaries
    const _dummy = new THREE.Object3D();
    const _color = new THREE.Color();
    const _targetCamPos = new THREE.Vector3();
    const _currentCamLook = new THREE.Vector3(0, 1.0, -18);
    const _desiredCamLook = new THREE.Vector3(0, 1.0, -18);

    // Simulation State
    const sim = {
      runId: `run_${Date.now()}`,
      runEndedFired: false,
      speedMs: 0,
      topSpeedReachedKmh: 0,
      distanceMeters: 0,
      coinsCollected: 0,
      nearMissCount: 0,
      bonusScore: 0,
      driftScore: 0,
      isDrifting: false,
      driftAudioCooldown: 0,
      collisionsCount: 0,
      integrity: HIGHWAY_CONFIG.maxHullIntegrity,
      maxIntegrity: HIGHWAY_CONFIG.maxHullIntegrity,
      cleanDriveShieldTimer: 0,
      nitroAmount: 1.0,
      isNitroActive: false,
      playerX: PLAYER_GRID_START_X,
      lateralVelocity: 0,
      filteredTiltSteer: 0,
      invulnerableTimer: 0,
      shieldFlashTimer: 0,
      hitstopTimer: 0,
      cameraTrauma: 0,
      countdownTimer: 2.4,
      lastCountdownInt: 3 as number | null,
      raceReleasedGo: false,
      trafficSpawnTimer: 0.6,
      coinSpawnTimer: 0.9,
      scrollOffsetZ: 0,
      visualCurveFactor: 0,
      reviveUsed: false,
      isDying: false,
      defeatDelayTimer: 0,
      bannerIdCounter: 1,
      titleOrbitTime: 0,
      // Garage 360° Turntable state
      garageYawRad: DEFAULT_GARAGE_YAW_RAD,
      garageTargetYawRad: DEFAULT_GARAGE_YAW_RAD,
      garageHoldDir: 0 as -1 | 0 | 1,
      garageAutoRotate: true,
      garageManualPauseTimer: 0,
      garageSwapScale: 1.0,
      lastInspectedCarId: propsRef.current.selectedCarId,
      // Levels Mode active course & 5 AI opponents
      activeCourse: generateLevelCourse(propsRef.current.levelNumber ?? 1),
      aiOpponents: [] as AiOpponentState[],
      elapsedRaceSec: 0,
      playerPosition: 1,
      lastSegmentLabel: 'Starting Grid',
    };

    function syncLiveHudSnapshot(
      banner?: { text: string; subtext: string; tone: 'cyan' | 'amber' | 'danger' }
    ) {
      const mode = propsRef.current.playMode ?? 'solo';
      propsRef.current.onLiveStateChange({
        integrity: sim.integrity,
        maxIntegrity: sim.maxIntegrity,
        countdownValue: sim.lastCountdownInt,
        nearMissCount: sim.nearMissCount,
        comboBanner: banner
          ? { ...banner, id: sim.bannerIdCounter++ }
          : null,
        reviveUsed: sim.reviveUsed,
        playMode: mode,
        levelNumber: sim.activeCourse.levelNumber,
        levelTitle: sim.activeCourse.title,
        segmentLabel: sim.lastSegmentLabel,
        playerPosition: sim.playerPosition,
        totalRacers: 6,
        isDrifting: sim.isDrifting,
        driftScore: Math.floor(sim.driftScore),
      });
    }

    function rebuildAiOpponentMeshes(opponents: AiOpponentState[]) {
      for (let i = 0; i < 5; i++) {
        const opp = opponents[i];
        const oldRig = aiOpponentRigs[i];
        scene.remove(oldRig.group);
        if (opp) {
          const newRig = buildPlayerCarMesh(CAR_CONFIGS[opp.carId]);
          newRig.paintMaterial.color.setHex(opp.paintColorHex);
          newRig.group.visible = false;
          scene.add(newRig.group);
          aiOpponentRigs[i] = newRig;
        }
      }
    }

    function updateRoadAndBarrierGeometry(
      course: GeneratedLevelCourse | null,
      playerDistanceMeters: number
    ) {
      for (let i = 0; i < roadPosAttr.count; i++) {
        const bz = roadBaseZ[i];
        const bx = roadBaseX[i];
        const { xOffset } = computeCurvedRoadCenterAtWorldZ(course, playerDistanceMeters, bz);
        roadPosAttr.setX(i, bx + xOffset);
      }
      roadPosAttr.needsUpdate = true;

      for (const wall of curvableRoadWalls) {
        for (let i = 0; i < wall.pos.count; i++) {
          const bz = wall.origZ[i];
          const bx = wall.origX[i];
          const { xOffset } = computeCurvedRoadCenterAtWorldZ(course, playerDistanceMeters, bz);
          wall.pos.setX(i, bx + xOffset);
        }
        wall.pos.needsUpdate = true;
      }
    }

    function resetRaceSimulation() {
      const currentCarId = propsRef.current.selectedCarId;
      const currentUpgrades = propsRef.current.carUpgrades[currentCarId] ?? {
        topSpeed: 0,
        acceleration: 0,
        handling: 0,
        braking: 0,
        nitro: 0,
      };
      const currentProt = propsRef.current.carProtection?.[currentCarId] ?? {
        shieldCapacity: 0,
        shieldDuration: 0,
      };
      const currentCust =
        propsRef.current.carCustomizations?.[currentCarId] ??
        createDefaultCarCustomization();
      const effStats = getEffectiveCarStats(
        currentCarId,
        currentUpgrades,
        currentCust.wheelId,
        currentProt
      );

      sim.runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sim.runEndedFired = false;
      // Stationary during 3 -> 2 -> 1 countdown; released on GO!
      sim.speedMs = 0;
      sim.topSpeedReachedKmh = 0;
      sim.distanceMeters = PLAYER_GRID_START_DIST;
      sim.coinsCollected = 0;
      sim.nearMissCount = 0;
      sim.bonusScore = 0;
      sim.driftScore = 0;
      sim.isDrifting = false;
      sim.collisionsCount = 0;
      sim.maxIntegrity = effStats.maxShieldCharges;
      sim.integrity = effStats.maxShieldCharges;
      sim.cleanDriveShieldTimer = 0;
      sim.nitroAmount = 1.0;
      sim.isNitroActive = false;
      sim.playerX = PLAYER_GRID_START_X;
      sim.lateralVelocity = 0;
      sim.filteredTiltSteer = 0;
      sim.invulnerableTimer = 0;
      sim.shieldFlashTimer = 0;
      sim.hitstopTimer = 0;
      sim.cameraTrauma = 0;
      sim.countdownTimer = 2.4;
      sim.lastCountdownInt = 3;
      sim.raceReleasedGo = false;
      sim.trafficSpawnTimer = 0.6;
      sim.coinSpawnTimer = 0.8;
      sim.visualCurveFactor = 0;
      sim.reviveUsed = false;
      sim.isDying = false;
      sim.defeatDelayTimer = 0;
      sim.elapsedRaceSec = 0;
      sim.playerPosition = 1;

      for (const t of trafficPool) {
        t.active = false;
        t.mesh.visible = false;
      }
      for (const c of coinPool) {
        c.active = false;
        c.mesh.visible = false;
      }
      for (const obs of levelObstaclePool) {
        obs.mesh.visible = false;
      }
      for (const p of particles) {
        p.active = false;
      }

      const mode = propsRef.current.playMode ?? 'solo';
      if (mode === 'levels') {
        const lvl = propsRef.current.levelNumber ?? 1;
        sim.activeCourse = generateLevelCourse(lvl);
        sim.aiOpponents = createLevelAiOpponents(lvl, effStats.topSpeedMs);
        sim.lastSegmentLabel = sim.activeCourse.segments[0]?.label ?? 'Starting Grid';
        rebuildAiOpponentMeshes(sim.aiOpponents);
        updateRoadAndBarrierGeometry(sim.activeCourse, 0);
      } else {
        for (const rig of aiOpponentRigs) {
          rig.group.visible = false;
        }
        startGantryMesh.visible = false;
        finishGantryMesh.visible = false;
        updateRoadAndBarrierGeometry(null, 0);
      }

      // Reset DOM HUD elements immediately to clean 0 state
      const refs = propsRef.current.hudRefs;
      if (refs.speedValueRef.current) refs.speedValueRef.current.textContent = '0';
      if (refs.distanceValueRef.current) {
        refs.distanceValueRef.current.textContent =
          mode === 'levels' ? `${sim.activeCourse.totalLengthMeters}m` : '0m';
      }
      if (refs.scoreValueRef.current) refs.scoreValueRef.current.textContent = '0';
      if (refs.coinsValueRef.current) refs.coinsValueRef.current.textContent = '0';
      if (refs.nitroFillRef.current) refs.nitroFillRef.current.style.transform = 'scaleX(1)';
      if (refs.nitroPctRef.current) refs.nitroPctRef.current.textContent = '100%';
      if (refs.racePositionValueRef?.current && mode === 'levels') {
        refs.racePositionValueRef.current.textContent = '1/6';
      }
      if (refs.levelProgressFillRef?.current && mode === 'levels') {
        refs.levelProgressFillRef.current.style.transform = 'scaleX(0)';
      }

      syncLiveHudSnapshot();
    }

    function reviveCurrentRun() {
      if (sim.reviveUsed) return;
      sim.reviveUsed = true;
      sim.runEndedFired = false;
      sim.integrity = Math.min(sim.maxIntegrity, 2);
      sim.invulnerableTimer = 3.0;
      sim.shieldFlashTimer = 0.7;
      sim.isDying = false;
      sim.defeatDelayTimer = 0;
      sim.speedMs = Math.max(sim.speedMs, 26);

      for (const t of trafficPool) {
        if (t.active && t.z > -75 && t.z < 20) {
          t.active = false;
          t.mesh.visible = false;
        }
      }
      syncLiveHudSnapshot({
        text: 'SHIELD RESTORED',
        subtext: '3.0s Invulnerability Active',
        tone: 'cyan',
      });
    }

    propsRef.current.controlsRef.current.triggerRestart = resetRaceSimulation;
    propsRef.current.controlsRef.current.triggerRevive = reviveCurrentRun;
    propsRef.current.controlsRef.current.rotateGarageTurntable = (deltaRad: number) => {
      sim.garageTargetYawRad += deltaRad;
      sim.garageManualPauseTimer = 4.0;
    };
    propsRef.current.controlsRef.current.setGarageRotateHoldDir = (dir: -1 | 0 | 1) => {
      sim.garageHoldDir = dir;
      if (dir !== 0) {
        sim.garageManualPauseTimer = 4.0;
      }
    };
    propsRef.current.controlsRef.current.resetGarageTurntableView = () => {
      sim.garageTargetYawRad = DEFAULT_GARAGE_YAW_RAD;
      sim.garageYawRad = DEFAULT_GARAGE_YAW_RAD;
      sim.garageHoldDir = 0;
      sim.garageManualPauseTimer = 2.0;
    };
    propsRef.current.controlsRef.current.toggleGarageAutoRotate = () => {
      sim.garageAutoRotate = !sim.garageAutoRotate;
      return sim.garageAutoRotate;
    };

    // Keyboard & Turntable Drag Listeners
    const keysPressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (
          propsRef.current.gameState === 'playing' ||
          propsRef.current.gameState === 'paused'
        ) {
          propsRef.current.onRequestPauseToggle();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let isDraggingTurntable = false;
    let lastDragClientX = 0;
    const onPointerDownCanvas = (e: PointerEvent) => {
      if (propsRef.current.gameState === 'title') {
        isDraggingTurntable = true;
        lastDragClientX = e.clientX;
        sim.garageManualPauseTimer = 4.5;
      }
    };
    const onPointerMoveCanvas = (e: PointerEvent) => {
      if (isDraggingTurntable && propsRef.current.gameState === 'title') {
        const dx = e.clientX - lastDragClientX;
        lastDragClientX = e.clientX;
        sim.garageTargetYawRad += dx * 0.014;
        sim.garageYawRad = sim.garageTargetYawRad;
        sim.garageManualPauseTimer = 4.5;
      }
    };
    const onPointerUpCanvas = () => {
      isDraggingTurntable = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDownCanvas);
    window.addEventListener('pointermove', onPointerMoveCanvas);
    window.addEventListener('pointerup', onPointerUpCanvas);

    // Device Motion & Orientation Listeners
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma !== 'number' && typeof e.beta !== 'number') return;
      const tiltDeg = computeLandscapeTiltDegreesFromSensors({
        screenAngle: getScreenOrientationDegrees(),
        accelIncludingGravity: null,
        orientation: { beta: e.beta, gamma: e.gamma },
      });
      if (tiltDeg !== null) {
        propsRef.current.controlsRef.current.hasRealDeviceOrientation = true;
        propsRef.current.controlsRef.current.motionPermissionState = 'granted';
        propsRef.current.controlsRef.current.lastRawDeviceTiltDeg = tiltDeg;
      }
    };

    const handleDeviceMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const tiltDeg = computeLandscapeTiltDegreesFromSensors({
        screenAngle: getScreenOrientationDegrees(),
        accelIncludingGravity: { x: acc.x, y: acc.y, z: acc.z },
        orientation: null,
      });
      if (tiltDeg !== null) {
        propsRef.current.controlsRef.current.hasRealDeviceOrientation = true;
        propsRef.current.controlsRef.current.motionPermissionState = 'granted';
        propsRef.current.controlsRef.current.lastRawDeviceTiltDeg = tiltDeg;
      }
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    window.addEventListener('devicemotion', handleDeviceMotion, true);

    propsRef.current.controlsRef.current.requestMotionPermission = async () => {
      try {
        let granted = true;
        const DevOrient = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<'granted' | 'denied'>;
        };
        const DevMotion = window.DeviceMotionEvent as unknown as {
          requestPermission?: () => Promise<'granted' | 'denied'>;
        };

        if (DevOrient && typeof DevOrient.requestPermission === 'function') {
          const res = await DevOrient.requestPermission();
          if (res !== 'granted') granted = false;
        }
        if (DevMotion && typeof DevMotion.requestPermission === 'function') {
          const res = await DevMotion.requestPermission();
          if (res !== 'granted') granted = false;
        }

        propsRef.current.controlsRef.current.motionPermissionState = granted
          ? 'granted'
          : 'denied';
        return granted;
      } catch {
        propsRef.current.controlsRef.current.motionPermissionState = 'denied';
        return false;
      }
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Initialize if booting straight into playing
    if (propsRef.current.gameState === 'playing') {
      resetRaceSimulation();
    }

    let animationFrameId = 0;
    let lastFrameTime = performance.now();
    let prevGameState: GameLifecycleState = propsRef.current.gameState;
    let hudUpdateAccum = 0;

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const rawDt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const dt = Math.min(Math.max(0, rawDt), 0.05);

      const currentProps = propsRef.current;
      const controlsRef = currentProps.controlsRef;
      const playMode = currentProps.playMode ?? 'solo';

      if (prevGameState !== 'playing' && currentProps.gameState === 'playing') {
        if (prevGameState === 'title') {
          resetRaceSimulation();
        }
      }
      prevGameState = currentProps.gameState;

      // Sync active car model & live customization
      const selectedCarId = currentProps.selectedCarId;
      if (sim.lastInspectedCarId !== selectedCarId) {
        sim.lastInspectedCarId = selectedCarId;
        sim.garageSwapScale = 0.9;
      }
      sim.garageSwapScale = THREE.MathUtils.damp(sim.garageSwapScale, 1.0, 14, dt);

      const currentCust =
        currentProps.carCustomizations?.[selectedCarId] ??
        createDefaultCarCustomization();

      for (const cId of CAR_ORDER) {
        const isCurrent = cId === selectedCarId;
        carRigs[cId].group.visible = isCurrent;
        if (isCurrent) {
          applyCarCustomizationToRig(carRigs[cId], CAR_CONFIGS[cId], currentCust);
          carRigs[cId].group.scale.setScalar(sim.garageSwapScale);
        }
      }
      const activeCarRig = carRigs[selectedCarId];

      const isGaragePreview =
        currentProps.gameState === 'title' && currentProps.isGarageOpen;

      turntableGroup.visible = isGaragePreview;
      turntableGroup.position.set(playerAnchor.position.x, 0, 0);

      const currentUpgrades = currentProps.carUpgrades[selectedCarId] ?? {
        topSpeed: 0,
        acceleration: 0,
        handling: 0,
        braking: 0,
        nitro: 0,
      };
      const currentProt = currentProps.carProtection?.[selectedCarId] ?? {
        shieldCapacity: 0,
        shieldDuration: 0,
      };
      const effectiveStats = getEffectiveCarStats(
        selectedCarId,
        currentUpgrades,
        currentCust.wheelId,
        currentProt
      );

      // --- PAUSED STATE: FREEZE ALL RACE MOVEMENT, TIMERS, AI, AND AUDIO ---
      if (currentProps.gameState === 'paused') {
        soundController.updateEngine(0, false, true);
        renderer.render(scene, camera);
        return;
      }

      // --- A. ACTIVE RACE SIMULATION ---
      if (currentProps.gameState === 'playing') {
        playerAnchor.rotation.set(0, 0, 0);

        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer -= dt;
          renderer.render(scene, camera);
          return;
        }

        if (sim.isDying) {
          sim.defeatDelayTimer -= dt;
          sim.speedMs = Math.max(0, sim.speedMs - 38 * dt);
          sim.scrollOffsetZ += sim.speedMs * dt;

          if (sim.defeatDelayTimer <= 0 && !sim.runEndedFired) {
            sim.isDying = false;
            sim.runEndedFired = true;
            const summary = calculateRunRewards({
              distanceMeters: sim.distanceMeters,
              coinsCollected: sim.coinsCollected,
              nearMissCount: sim.nearMissCount,
              bonusScore: sim.bonusScore + Math.floor(sim.driftScore),
            });

            if (playMode === 'levels') {
              const standings = computeRaceStandings({
                playerCarId: selectedCarId,
                playerDistanceMeters: sim.distanceMeters,
                playerFinished: false,
                playerFinishTimeSec: null,
                opponents: sim.aiOpponents,
                totalLengthMeters: sim.activeCourse.totalLengthMeters,
              });
              const pRank = standings.find((s) => s.isPlayer)?.position ?? 6;
              const rewards = calculateLevelRaceRewards({
                course: sim.activeCourse,
                position: pRank,
                coinsCollected: sim.coinsCollected,
                driftScore: sim.driftScore,
                collisionsCount: sim.collisionsCount,
              });
              currentProps.onRunEnded({
                runId: sim.runId,
                playMode: 'levels',
                summary,
                coinsCollected: sim.coinsCollected,
                nearMissCount: sim.nearMissCount,
                driftScore: Math.floor(sim.driftScore),
                topSpeedKmh: Math.round(sim.topSpeedReachedKmh),
                reviveAvailable: !sim.reviveUsed,
                levelResult: {
                  course: sim.activeCourse,
                  standings,
                  playerPosition: pRank,
                  playerFinishedCourse: false,
                  finishTimeSec: Number(sim.elapsedRaceSec.toFixed(2)),
                  rewards,
                  coinsCollected: sim.coinsCollected,
                  driftScore: Math.floor(sim.driftScore),
                  collisionsCount: sim.collisionsCount,
                },
              });
            } else {
              currentProps.onRunEnded({
                runId: sim.runId,
                playMode: 'solo',
                summary,
                coinsCollected: sim.coinsCollected,
                nearMissCount: sim.nearMissCount,
                driftScore: Math.floor(sim.driftScore),
                topSpeedKmh: Math.round(sim.topSpeedReachedKmh),
                reviveAvailable: !sim.reviveUsed,
              });
            }
          }
          renderer.render(scene, camera);
          return;
        }

        // Synchronized 3 -> 2 -> 1 -> GO! Countdown
        if (sim.countdownTimer > -0.6) {
          sim.countdownTimer -= dt;
          const nextInt =
            sim.countdownTimer > 1.6
              ? 3
              : sim.countdownTimer > 0.8
                ? 2
                : sim.countdownTimer > 0.0
                  ? 1
                  : sim.countdownTimer > -0.55
                    ? 0
                    : null;
          if (nextInt !== sim.lastCountdownInt) {
            sim.lastCountdownInt = nextInt;
            if (nextInt !== null) {
              soundController.playCountdownTick(nextInt === 0);
            }
            syncLiveHudSnapshot();
          }
        }

        // PRIORITY 6: While countdownTimer > 0 (3, 2, 1), keep all 6 cars stationary on the Starting Grid!
        if (sim.countdownTimer > 0) {
          sim.speedMs = 0;
          sim.distanceMeters = PLAYER_GRID_START_DIST;
          sim.elapsedRaceSec = 0;
          playerAnchor.position.x = sim.playerX;
          activeCarRig.bodyGroup.rotation.set(0, 0, 0);
          activeCarRig.taillightMaterial.emissiveIntensity = 3.2;

          if (playMode === 'levels') {
            startGantryMesh.visible = true;
            startGantryMesh.position.set(0, 0, 0);
            finishGantryMesh.visible = false;

            for (let i = 0; i < sim.aiOpponents.length; i++) {
              const ai = sim.aiOpponents[i];
              const aiRig = aiOpponentRigs[i];
              const relZ = -(ai.distanceMeters - sim.distanceMeters);
              aiRig.group.visible = true;
              aiRig.group.position.set(ai.x, 0, relZ);
              aiRig.group.rotation.set(0, 0, 0);
              for (const f of aiRig.nitroFlames) {
                f.visible = false;
              }
            }
          }
          soundController.updateEngine(45, false, false);
        } else {
          // Authoritative simultaneous release on GO!
          if (!sim.raceReleasedGo) {
            sim.raceReleasedGo = true;
            sim.speedMs = HIGHWAY_CONFIG.launchSpeedKmh / 3.6;
            sim.topSpeedReachedKmh = HIGHWAY_CONFIG.launchSpeedKmh;
            for (const ai of sim.aiOpponents) {
              ai.speedMs = HIGHWAY_CONFIG.launchSpeedKmh / 3.6;
            }
          }

          sim.elapsedRaceSec += dt;

          // 1. Evaluate Steering Input
          let kbSteer = 0;
          if (keysPressed.has('ArrowLeft') || keysPressed.has('KeyA')) kbSteer -= 1;
          if (keysPressed.has('ArrowRight') || keysPressed.has('KeyD')) kbSteer += 1;

          let touchButtonSteer = 0;
          const holdMultiplier = controlsRef.current.steerLongPressActive ? 1.08 : 1.0;
          if (controlsRef.current.steerLeftHeld) {
            touchButtonSteer -= holdMultiplier;
            controlsRef.current.steerTapRemainingSec = 0;
          }
          if (controlsRef.current.steerRightHeld) {
            touchButtonSteer += holdMultiplier;
            controlsRef.current.steerTapRemainingSec = 0;
          }
          if (
            touchButtonSteer === 0 &&
            (controlsRef.current.steerTapRemainingSec ?? 0) > 0
          ) {
            controlsRef.current.steerTapRemainingSec = Math.max(
              0,
              (controlsRef.current.steerTapRemainingSec ?? 0) - dt
            );
            touchButtonSteer = controlsRef.current.steerTapImpulse ?? 0;
          }

          const rawTiltSource = controlsRef.current.hasRealDeviceOrientation
            ? controlsRef.current.lastRawDeviceTiltDeg
            : controlsRef.current.simulatedTiltDeg;

          sim.filteredTiltSteer = processTiltInput({
            rawAngleDeg: rawTiltSource,
            neutralOffsetDeg: currentProps.neutralTiltOffsetDeg,
            previousFilteredInput: sim.filteredTiltSteer,
            sensitivity: currentProps.sensitivity,
            invertTilt: currentProps.invertTilt,
            smoothingFactor: Math.min(1, dt * 15),
          });

          let activeSteerInput = kbSteer || touchButtonSteer;
          if (activeSteerInput === 0) {
            if (currentProps.steeringMode === 'tilt') {
              activeSteerInput = sim.filteredTiltSteer;
            } else if (currentProps.steeringMode === 'drag') {
              activeSteerInput = controlsRef.current.dragSteerNormalized;
            }
          }

          // 2. Longitudinal Physics (Automatic Acceleration, Braking, Nitro)
          const nitroWanted =
            keysPressed.has('Space') ||
            keysPressed.has('KeyW') ||
            keysPressed.has('ArrowUp') ||
            controlsRef.current.nitroHeld;
          const brakeWanted =
            keysPressed.has('KeyS') ||
            keysPressed.has('ArrowDown') ||
            controlsRef.current.brakeHeld;

          const longStep = stepLongitudinalPhysics({
            currentSpeedMs: sim.speedMs,
            nitroAmount: sim.nitroAmount,
            isNitroActive: sim.isNitroActive,
            nitroWanted,
            brakeWanted,
            effectiveStats,
            dt,
          });

          if (longStep.justActivatedNitro) {
            soundController.playNitroActivate();
            sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.22);
          }

          sim.speedMs = longStep.speedMs;
          sim.nitroAmount = longStep.nitroAmount;
          sim.isNitroActive = longStep.isNitroActive;

          const currentSpeedKmh = longStep.speedKmh;
          if (currentSpeedKmh > sim.topSpeedReachedKmh) {
            sim.topSpeedReachedKmh = currentSpeedKmh;
          }

          // 3. Track Curvature, Centrifugal Force & Controlled Drift Mechanics (Levels Mode)
          let currentCurvature = 0;
          if (playMode === 'levels') {
            const sample = sampleTrackAtDistance(sim.activeCourse, sim.distanceMeters);
            currentCurvature = sample.curvature;
            sim.visualCurveFactor = THREE.MathUtils.damp(
              sim.visualCurveFactor,
              currentCurvature,
              4.8,
              dt
            );
            if (sample.segment.label !== sim.lastSegmentLabel) {
              sim.lastSegmentLabel = sample.segment.label;
              syncLiveHudSnapshot();
            }
          } else {
            sim.visualCurveFactor = THREE.MathUtils.damp(sim.visualCurveFactor, 0, 6, dt);
          }

          // Outward centrifugal pull in curves requires active steering into the bend
          const centrifugalPull =
            playMode === 'levels'
              ? -currentCurvature * Math.max(0, (sim.speedMs - 18) / 44) * 4.6
              : 0;

          const targetLatVel = activeSteerInput * effectiveStats.handling + centrifugalPull;
          sim.lateralVelocity = THREE.MathUtils.damp(
            sim.lateralVelocity,
            targetLatVel,
            13.5,
            dt
          );
          sim.playerX = THREE.MathUtils.clamp(
            sim.playerX + sim.lateralVelocity * dt,
            -HIGHWAY_CONFIG.playerBoundX,
            HIGHWAY_CONFIG.playerBoundX
          );

          playerAnchor.position.x = sim.playerX;

          // PRIORITY 7C & 7D: Genuine Controlled Drift Detection & Scoring
          // Requires active curved road section, moving speed > 28 m/s, steering into the bend,
          // no active collision/death state, and staying within track boundaries.
          const absCurve = Math.abs(currentCurvature);
          const absSteer = Math.abs(activeSteerInput);
          const steeringIntoCurve =
            Math.sign(activeSteerInput) === Math.sign(currentCurvature) ||
            absCurve >= 0.65;
          const wasDrifting = sim.isDrifting;

          sim.isDrifting =
            playMode === 'levels' &&
            absCurve >= 0.34 &&
            sim.speedMs > 28 &&
            absSteer >= 0.32 &&
            steeringIntoCurve &&
            sim.invulnerableTimer <= 0 &&
            Math.abs(sim.playerX) < HIGHWAY_CONFIG.playerBoundX - 0.15;

          if (sim.isDrifting) {
            const speedScale = Math.min(1.6, sim.speedMs / 55);
            sim.driftScore += dt * 135 * (0.8 + absCurve) * speedScale;
            sim.nitroAmount = Math.min(1, sim.nitroAmount + dt * 0.06);
            sim.driftAudioCooldown -= dt;
            if (sim.driftAudioCooldown <= 0) {
              soundController.playDriftPulse();
              sim.driftAudioCooldown = 0.24;
            }
            if (Math.random() < 0.72) {
              spawnParticleBurst(sim.playerX - 0.7, 0.15, 1.35, 1, 0xf59e0b, 3.2);
              spawnParticleBurst(sim.playerX + 0.7, 0.15, 1.35, 1, 0x38bdf8, 3.2);
            }
          }
          if (wasDrifting !== sim.isDrifting) {
            syncLiveHudSnapshot();
          }

          // Chassis roll, yaw (controlled slip angle when drifting), pitch, brake lights & wheels
          const normSteer = THREE.MathUtils.clamp(
            sim.lateralVelocity / Math.max(1, effectiveStats.handling),
            -1,
            1
          );
          const driftYawBonus = sim.isDrifting
            ? -Math.sign(activeSteerInput || currentCurvature) * 0.15
            : 0;
          activeCarRig.bodyGroup.rotation.z = THREE.MathUtils.damp(
            activeCarRig.bodyGroup.rotation.z,
            -normSteer * 0.14,
            16,
            dt
          );
          activeCarRig.bodyGroup.rotation.y = THREE.MathUtils.damp(
            activeCarRig.bodyGroup.rotation.y,
            -normSteer * 0.13 + driftYawBonus,
            16,
            dt
          );
          activeCarRig.bodyGroup.rotation.x = THREE.MathUtils.damp(
            activeCarRig.bodyGroup.rotation.x,
            sim.isNitroActive ? -0.038 : brakeWanted ? 0.035 : 0,
            14,
            dt
          );

          activeCarRig.taillightMaterial.emissiveIntensity = brakeWanted ? 4.8 : 2.2;

          for (const w of activeCarRig.wheels) {
            w.rotation.x -= sim.speedMs * dt * 1.85;
          }
          for (const flame of activeCarRig.nitroFlames) {
            flame.visible = sim.isNitroActive;
            if (sim.isNitroActive) {
              const flicker = 0.85 + Math.random() * 0.4;
              flame.scale.set(1, flicker, 1);
            }
          }

          if (sim.isNitroActive && Math.random() < 0.65) {
            spawnParticleBurst(sim.playerX, 0.3, 2.35, 1, 0x38bdf8, 4.0);
          }

          if (sim.invulnerableTimer > 0) {
            sim.invulnerableTimer = Math.max(0, sim.invulnerableTimer - dt);
          }
          if (sim.shieldFlashTimer > 0) {
            sim.shieldFlashTimer = Math.max(0, sim.shieldFlashTimer - dt);
            (activeCarRig.shieldBubble.material as THREE.MeshBasicMaterial).opacity =
              sim.shieldFlashTimer * 1.4;
          } else {
            (activeCarRig.shieldBubble.material as THREE.MeshBasicMaterial).opacity =
              sim.invulnerableTimer > 0 ? 0.22 : 0;
          }

          // Deflector Matrix Level 3+ auto-recharges 1 shield charge after 40s of clean driving
          if ((currentProt.shieldDuration ?? 0) >= 3 && sim.integrity < sim.maxIntegrity) {
            sim.cleanDriveShieldTimer += dt;
            if (sim.cleanDriveShieldTimer >= 40) {
              sim.cleanDriveShieldTimer = 0;
              sim.integrity = Math.min(sim.maxIntegrity, sim.integrity + 1);
              sim.shieldFlashTimer = 0.45;
              syncLiveHudSnapshot({
                text: 'SHIELD RECHARGED',
                subtext: '+1 Deflector Matrix Layer Restored',
                tone: 'cyan',
              });
            }
          } else {
            sim.cleanDriveShieldTimer = 0;
          }

          // 4. Advance Distance
          const stepDist = sim.speedMs * dt;
          sim.distanceMeters += stepDist;
          sim.scrollOffsetZ += stepDist;

          const playerBox = {
            x: sim.playerX,
            z: 0,
            halfWidth: 0.94,
            halfLength: 2.18,
          };

          // --- MODE-SPECIFIC WORLD & OPPONENTS ---
          if (playMode === 'solo') {
            updateRoadAndBarrierGeometry(null, sim.distanceMeters);
            const difficulty01 = Math.min(1, sim.distanceMeters / 3500);

            sim.trafficSpawnTimer -= dt;
            if (sim.trafficSpawnTimer <= 0) {
              const chosenLanes = selectFairTrafficLanes(HIGHWAY_CONFIG.laneCount, difficulty01);
              const spawnZ = -HIGHWAY_CONFIG.minSpawnDistanceAhead - Math.random() * 40;

              for (const laneIdx of chosenLanes) {
                const laneCenterX = HIGHWAY_CONFIG.laneCenters[laneIdx];
                const tooClose = trafficPool.some(
                  (t) =>
                    t.active &&
                    t.laneIndex === laneIdx &&
                    Math.abs(t.z - spawnZ) < HIGHWAY_CONFIG.minLongitudinalGap
                );
                if (tooClose) continue;

                const inactiveItem = trafficPool.find((t) => !t.active);
                if (inactiveItem) {
                  inactiveItem.active = true;
                  inactiveItem.laneIndex = laneIdx;
                  inactiveItem.x = laneCenterX;
                  inactiveItem.z = spawnZ - Math.random() * 12;
                  inactiveItem.speedMs = 20 + Math.random() * 14 + difficulty01 * 5;
                  inactiveItem.nearMissScored = false;
                  inactiveItem.mesh.position.set(inactiveItem.x, 0, inactiveItem.z);
                  inactiveItem.mesh.visible = true;
                }
              }

              sim.trafficSpawnTimer = Math.max(
                0.55,
                1.35 - difficulty01 * 0.6 + Math.random() * 0.25
              );
            }

            sim.coinSpawnTimer -= dt;
            if (sim.coinSpawnTimer <= 0) {
              const laneIdx = Math.floor(Math.random() * HIGHWAY_CONFIG.laneCount);
              const laneX = HIGHWAY_CONFIG.laneCenters[laneIdx];
              const baseZ = -95;

              for (let c = 0; c < 4; c++) {
                const coinItem = coinPool.find((item) => !item.active);
                if (coinItem) {
                  coinItem.active = true;
                  coinItem.x = laneX;
                  coinItem.z = baseZ - c * 7.5;
                  coinItem.mesh.position.set(coinItem.x, 0.9, coinItem.z);
                  coinItem.mesh.visible = true;
                }
              }
              sim.coinSpawnTimer = 1.9 + Math.random() * 1.2;
            }

            // Move Traffic & Check Collisions / Near-Misses
            for (const t of trafficPool) {
              if (!t.active) continue;
              const relSpeedMs = sim.speedMs - t.speedMs;
              t.z += relSpeedMs * dt;
              t.mesh.position.set(t.x, 0, t.z);

              if (t.z > Math.abs(HIGHWAY_CONFIG.despawnDistanceBehind)) {
                t.active = false;
                t.mesh.visible = false;
                continue;
              }

              const check = evaluateVehicleInteraction(
                playerBox,
                {
                  x: t.x,
                  z: t.z,
                  halfWidth: t.halfWidth,
                  halfLength: t.halfLength,
                },
                t.nearMissScored
              );

              if (check.collided && sim.invulnerableTimer <= 0) {
                sim.collisionsCount += 1;
                sim.cleanDriveShieldTimer = 0;
                sim.integrity = Math.max(0, sim.integrity - 1);
                sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.78);
                sim.shieldFlashTimer = 0.55;
                spawnParticleBurst(sim.playerX, 0.65, -1.2, 18, 0xf59e0b, 9);

                if (sim.integrity <= 0) {
                  soundController.playCollision(true);
                  sim.hitstopTimer = 0.06;
                  sim.isDying = true;
                  sim.defeatDelayTimer = 0.45;
                  syncLiveHudSnapshot({
                    text: 'CRITICAL IMPACT',
                    subtext: 'Hull Shield Depleted',
                    tone: 'danger',
                  });
                } else {
                  soundController.playCollision(false);
                  sim.hitstopTimer = 0.04;
                  sim.invulnerableTimer = effectiveStats.shieldInvulnerabilitySec;
                  sim.speedMs = Math.max(
                    18,
                    sim.speedMs * effectiveStats.collisionSpeedRetention
                  );
                  t.active = false;
                  t.mesh.visible = false;
                  syncLiveHudSnapshot({
                    text: 'SHIELD IMPACT ABSORBED',
                    subtext: `${sim.integrity}/${sim.maxIntegrity} Shield Charges Remaining`,
                    tone: 'danger',
                  });
                }
              } else if (check.nearMiss) {
                t.nearMissScored = true;
                sim.nearMissCount += 1;
                sim.nitroAmount = Math.min(
                  1,
                  sim.nitroAmount + HIGHWAY_CONFIG.nearMissNitroBonus
                );
                soundController.playNearMiss();
                spawnParticleBurst(sim.playerX, 0.5, 0, 8, 0x06b6d4, 5);
                syncLiveHudSnapshot({
                  text: `NEAR MISS +${HIGHWAY_CONFIG.nearMissScoreBonus}`,
                  subtext: `+${HIGHWAY_CONFIG.nearMissCoinBonus} Bonus Coins · +Nitro Boost`,
                  tone: 'cyan',
                });
              }
            }

            // Move Solo Coins
            for (const c of coinPool) {
              if (!c.active) continue;
              c.z += sim.speedMs * dt;
              c.mesh.position.set(c.x, 0.9, c.z);
              c.mesh.rotation.y += dt * 3.8;

              if (c.z > 16) {
                c.active = false;
                c.mesh.visible = false;
                continue;
              }

              if (Math.abs(c.z) < 2.2 && Math.abs(c.x - sim.playerX) < 1.65) {
                c.active = false;
                c.mesh.visible = false;
                sim.coinsCollected += 1;
                soundController.playCoinPickup();
                spawnParticleBurst(c.x, 0.9, 0, 7, 0xfacc15, 4.5);
              }
            }
          } else {
            // --- LEVELS MODE: CURVED 3D ROAD, 5 AI OPPONENTS, OBSTACLES, START & FINISH GANTRIES ---
            const course = sim.activeCourse;
            updateRoadAndBarrierGeometry(course, sim.distanceMeters);

            // Position Start & Finish Line Gantries aligned with the curved road centerline
            const startRelZ = sim.distanceMeters - 0;
            if (startRelZ < 35) {
              const startCenter = computeCurvedRoadCenterAtWorldZ(
                course,
                sim.distanceMeters,
                startRelZ
              );
              startGantryMesh.visible = true;
              startGantryMesh.position.set(startCenter.xOffset, 0, startRelZ);
              startGantryMesh.rotation.y = -startCenter.headingRad * 0.65;
            } else {
              startGantryMesh.visible = false;
            }

            const finishRelZ = -(course.totalLengthMeters - sim.distanceMeters);
            if (finishRelZ > -230 && finishRelZ < 35) {
              const finishCenter = computeCurvedRoadCenterAtWorldZ(
                course,
                sim.distanceMeters,
                finishRelZ
              );
              finishGantryMesh.visible = true;
              finishGantryMesh.position.set(finishCenter.xOffset, 0, finishRelZ);
              finishGantryMesh.rotation.y = -finishCenter.headingRad * 0.65;
            } else {
              finishGantryMesh.visible = false;
            }

            // Step & Render the 5 AI Opponents (6 racing cars total)
            for (let i = 0; i < sim.aiOpponents.length; i++) {
              const ai = sim.aiOpponents[i];
              stepAiOpponent({
                ai,
                allOpponents: sim.aiOpponents,
                playerX: sim.playerX,
                playerDist: sim.distanceMeters,
                course,
                elapsedRaceSec: sim.elapsedRaceSec,
                dt,
              });

              const aiRig = aiOpponentRigs[i];
              const relZ = -(ai.distanceMeters - sim.distanceMeters);
              if (relZ > -220 && relZ < 32) {
                const roadCenter = computeCurvedRoadCenterAtWorldZ(
                  course,
                  sim.distanceMeters,
                  relZ
                );
                aiRig.group.visible = true;
                aiRig.group.position.set(ai.x + roadCenter.xOffset, 0, relZ);
                aiRig.group.rotation.y =
                  -roadCenter.headingRad * 0.65 -
                  THREE.MathUtils.clamp(ai.lateralVelocity * 0.015, -0.15, 0.15);
                for (const w of aiRig.wheels) {
                  w.rotation.x -= ai.speedMs * dt * 1.8;
                }
                for (const f of aiRig.nitroFlames) {
                  f.visible = ai.isNitroActive;
                }
              } else {
                aiRig.group.visible = false;
              }

              // Player vs AI side-to-side contact check (non-fatal racing rub unless direct rear-end)
              if (Math.abs(relZ) < 3.6 && Math.abs(ai.x - sim.playerX) < 1.72) {
                const pushDir = sim.playerX >= ai.x ? 1 : -1;
                sim.playerX = THREE.MathUtils.clamp(
                  sim.playerX + pushDir * 0.25,
                  -HIGHWAY_CONFIG.playerBoundX,
                  HIGHWAY_CONFIG.playerBoundX
                );
                ai.x = THREE.MathUtils.clamp(
                  ai.x - pushDir * 0.25,
                  -HIGHWAY_CONFIG.playerBoundX,
                  HIGHWAY_CONFIG.playerBoundX
                );
                if (relZ < -1.2 && sim.speedMs > ai.speedMs + 4) {
                  sim.speedMs = Math.max(ai.speedMs, sim.speedMs * 0.9);
                  spawnParticleBurst(sim.playerX, 0.5, -1.5, 6, 0x38bdf8, 5);
                }
              }
            }

            // Render & Check Visible Course Obstacles aligned with the curved road
            let poolIdx = 0;
            for (let i = 0; i < course.obstacles.length; i++) {
              const obs = course.obstacles[i];
              const relZ = -(obs.distanceMeters - sim.distanceMeters);
              if (relZ > -195 && relZ < 18 && poolIdx < levelObstaclePool.length) {
                const item = levelObstaclePool[poolIdx++];
                const roadCenter = computeCurvedRoadCenterAtWorldZ(
                  course,
                  sim.distanceMeters,
                  relZ
                );
                item.mesh.visible = true;
                item.mesh.position.set(obs.x + roadCenter.xOffset, 0, relZ);
                item.mesh.rotation.y = -roadCenter.headingRad * 0.65;

                // Check collision with Player (both obs.x and sim.playerX are in road-local lateral space!)
                if (
                  sim.invulnerableTimer <= 0 &&
                  Math.abs(relZ) < obs.halfLength + 1.85 &&
                  Math.abs(obs.x - sim.playerX) < obs.halfWidth + 0.72
                ) {
                  sim.collisionsCount += 1;
                  sim.cleanDriveShieldTimer = 0;
                  sim.isDrifting = false;
                  sim.integrity = Math.max(0, sim.integrity - 1);
                  sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.75);
                  sim.shieldFlashTimer = 0.55;
                  spawnParticleBurst(sim.playerX, 0.65, -1.2, 16, 0xf59e0b, 8);

                  if (sim.integrity <= 0) {
                    soundController.playCollision(true);
                    sim.hitstopTimer = 0.06;
                    sim.isDying = true;
                    sim.defeatDelayTimer = 0.45;
                    syncLiveHudSnapshot({
                      text: 'CRITICAL BARRIER IMPACT',
                      subtext: 'Hull Shield Depleted',
                      tone: 'danger',
                    });
                  } else {
                    soundController.playCollision(false);
                    sim.hitstopTimer = 0.04;
                    sim.invulnerableTimer = effectiveStats.shieldInvulnerabilitySec;
                    sim.speedMs = Math.max(
                      20,
                      sim.speedMs * effectiveStats.collisionSpeedRetention
                    );
                    syncLiveHudSnapshot({
                      text: 'SHIELD DEFLECTED HAZARD',
                      subtext: `${sim.integrity}/${sim.maxIntegrity} Shield Charges Remaining`,
                      tone: 'amber',
                    });
                  }
                }
              }
            }
            for (let k = poolIdx; k < levelObstaclePool.length; k++) {
              levelObstaclePool[k].mesh.visible = false;
            }

            // Render & Collect Course Coins aligned with the curved road
            let coinIdx = 0;
            for (let i = 0; i < course.coins.length; i++) {
              const c = course.coins[i];
              if (c.collected) continue;
              const relZ = -(c.distanceMeters - sim.distanceMeters);
              if (relZ > -170 && relZ < 14 && coinIdx < coinPool.length) {
                const poolCoin = coinPool[coinIdx++];
                const roadCenter = computeCurvedRoadCenterAtWorldZ(
                  course,
                  sim.distanceMeters,
                  relZ
                );
                poolCoin.mesh.visible = true;
                poolCoin.mesh.position.set(c.x + roadCenter.xOffset, 0.9, relZ);
                poolCoin.mesh.rotation.y += dt * 3.8;

                if (Math.abs(relZ) < 2.2 && Math.abs(c.x - sim.playerX) < 1.65) {
                  c.collected = true;
                  poolCoin.mesh.visible = false;
                  sim.coinsCollected += 1;
                  soundController.playCoinPickup();
                  spawnParticleBurst(sim.playerX, 0.9, 0, 7, 0xfacc15, 4.5);
                }
              }
            }
            for (let k = coinIdx; k < coinPool.length; k++) {
              coinPool[k].mesh.visible = false;
            }

            // Update Live 1/6 Standings & Check Finish Line Crossing
            const standings = computeRaceStandings({
              playerCarId: selectedCarId,
              playerDistanceMeters: sim.distanceMeters,
              playerFinished: sim.distanceMeters >= course.totalLengthMeters,
              playerFinishTimeSec:
                sim.distanceMeters >= course.totalLengthMeters
                  ? Number(sim.elapsedRaceSec.toFixed(2))
                  : null,
              opponents: sim.aiOpponents,
              totalLengthMeters: course.totalLengthMeters,
            });
            const newPos = standings.find((s) => s.isPlayer)?.position ?? 6;
            if (newPos !== sim.playerPosition) {
              sim.playerPosition = newPos;
              syncLiveHudSnapshot();
            }

            if (sim.distanceMeters >= course.totalLengthMeters && !sim.runEndedFired) {
              sim.runEndedFired = true;
              sim.distanceMeters = course.totalLengthMeters;
              const finishTime = Number(sim.elapsedRaceSec.toFixed(2));
              const finalStandings = computeRaceStandings({
                playerCarId: selectedCarId,
                playerDistanceMeters: course.totalLengthMeters,
                playerFinished: true,
                playerFinishTimeSec: finishTime,
                opponents: sim.aiOpponents,
                totalLengthMeters: course.totalLengthMeters,
              });
              const finalRank = finalStandings.find((s) => s.isPlayer)?.position ?? 1;
              const rewards = calculateLevelRaceRewards({
                course,
                position: finalRank,
                coinsCollected: sim.coinsCollected,
                driftScore: sim.driftScore,
                collisionsCount: sim.collisionsCount,
              });
              const summary = calculateRunRewards({
                distanceMeters: course.totalLengthMeters,
                coinsCollected: sim.coinsCollected,
                nearMissCount: sim.nearMissCount,
                bonusScore: rewards.totalScore,
              });

              soundController.playRaceFinish(finalRank <= 3);
              currentProps.onRunEnded({
                runId: sim.runId,
                playMode: 'levels',
                summary: {
                  ...summary,
                  totalScore: rewards.totalScore,
                  totalCoinsEarned: rewards.totalCoinsEarned,
                },
                coinsCollected: sim.coinsCollected,
                nearMissCount: sim.nearMissCount,
                driftScore: Math.floor(sim.driftScore),
                topSpeedKmh: Math.round(sim.topSpeedReachedKmh),
                reviveAvailable: false,
                levelResult: {
                  course,
                  standings: finalStandings,
                  playerPosition: finalRank,
                  playerFinishedCourse: true,
                  finishTimeSec: finishTime,
                  rewards,
                  coinsCollected: sim.coinsCollected,
                  driftScore: Math.floor(sim.driftScore),
                  collisionsCount: sim.collisionsCount,
                },
              });
              return;
            }
          }

          soundController.updateEngine(currentSpeedKmh, sim.isNitroActive, false);
        }
      } else if (currentProps.gameState === 'title') {
        const menuSpeedMs = currentProps.isGarageOpen ? 0 : 24;
        sim.scrollOffsetZ += menuSpeedMs * dt;
        sim.visualCurveFactor = THREE.MathUtils.damp(sim.visualCurveFactor, 0, 6, dt);
        updateRoadAndBarrierGeometry(null, 0);

        for (const t of trafficPool) {
          if (t.active) t.mesh.visible = !currentProps.isGarageOpen;
        }
        for (const c of coinPool) {
          if (c.active) c.mesh.visible = false;
        }
        for (const obs of levelObstaclePool) {
          obs.mesh.visible = false;
        }
        for (const aiRig of aiOpponentRigs) {
          aiRig.group.visible = false;
        }
        startGantryMesh.visible = false;
        finishGantryMesh.visible = false;

        if (currentProps.isGarageOpen) {
          // Center vehicle on showroom pedestal at (0, 0, 0) and rotate around its true vertical center axis
          sim.playerX = 0;
          playerAnchor.position.set(0, 0, 0);

          if (sim.garageHoldDir !== 0) {
            sim.garageTargetYawRad += sim.garageHoldDir * dt * 1.95;
          } else if (sim.garageManualPauseTimer > 0) {
            sim.garageManualPauseTimer = Math.max(0, sim.garageManualPauseTimer - dt);
          } else if (sim.garageAutoRotate && !isDraggingTurntable) {
            sim.garageTargetYawRad += dt * 0.42;
          }

          sim.garageYawRad = THREE.MathUtils.damp(
            sim.garageYawRad,
            sim.garageTargetYawRad,
            12,
            dt
          );
          playerAnchor.rotation.set(0, sim.garageYawRad, 0);
          turntableGroup.rotation.set(0, sim.garageYawRad, 0);
        } else {
          sim.playerX = THREE.MathUtils.damp(sim.playerX, 1.75, 7, dt);
          playerAnchor.position.set(sim.playerX, 0, 0);
          playerAnchor.rotation.set(0, 0, 0);
        }

        activeCarRig.bodyGroup.rotation.set(0, 0, 0);
        activeCarRig.taillightMaterial.emissiveIntensity = 2.2;
        for (const flame of activeCarRig.nitroFlames) {
          flame.visible = false;
        }
        for (const w of activeCarRig.wheels) {
          w.rotation.x -= menuSpeedMs * dt * 1.5;
        }
        soundController.updateEngine(0, false, true);
      } else {
        soundController.updateEngine(0, false, true);
      }

      // --- B. UPDATE SCROLLING ROAD, ARCHES, TUNNELS, SKYLINE & PARTICLES ---
      albedoMap.offset.y = -(sim.scrollOffsetZ * 0.065) % 1;
      roughnessMap.offset.y = -(sim.scrollOffsetZ * 0.065) % 1;

      const activeCourseForVisuals =
        currentProps.gameState === 'playing' && playMode === 'levels'
          ? sim.activeCourse
          : null;

      const archSpacing = 12;
      const archWrapSpan = archCount * archSpacing;
      for (let i = 0; i < archCount; i++) {
        const z =
          ((i * archSpacing + sim.scrollOffsetZ) % archWrapSpan) - archWrapSpan + 24;
        const { xOffset: curveX } = computeCurvedRoadCenterAtWorldZ(
          activeCourseForVisuals,
          sim.distanceMeters,
          z
        );

        _dummy.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5 - 0.6 + curveX, 3.9, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        archPillarsInst.setMatrixAt(i * 2, _dummy.matrix);

        _dummy.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5 + 0.35 + curveX, 7.6, z);
        _dummy.updateMatrix();
        lampHeadsInst.setMatrixAt(i * 2, _dummy.matrix);

        _dummy.position.set(HIGHWAY_CONFIG.roadWidth * 0.5 + 0.6 + curveX, 3.9, z);
        _dummy.updateMatrix();
        archPillarsInst.setMatrixAt(i * 2 + 1, _dummy.matrix);

        _dummy.position.set(HIGHWAY_CONFIG.roadWidth * 0.5 - 0.35 + curveX, 7.6, z);
        _dummy.updateMatrix();
        lampHeadsInst.setMatrixAt(i * 2 + 1, _dummy.matrix);
      }
      archPillarsInst.instanceMatrix.needsUpdate = true;
      lampHeadsInst.instanceMatrix.needsUpdate = true;

      // Update Tunnel Roof Rings if in Levels Mode
      const showTunnels =
        currentProps.gameState === 'playing' &&
        playMode === 'levels' &&
        sampleTrackAtDistance(sim.activeCourse, sim.distanceMeters + 40).isTunnel;
      for (let i = 0; i < tunnelRingCount; i++) {
        if (!showTunnels) {
          _dummy.position.set(0, -50, 0);
          _dummy.scale.set(0.001, 0.001, 0.001);
        } else {
          const z = -i * 12 + (sim.scrollOffsetZ % 12);
          const { xOffset: curveX } = computeCurvedRoadCenterAtWorldZ(
            activeCourseForVisuals,
            sim.distanceMeters,
            z
          );
          _dummy.position.set(curveX, 7.85, z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 1, 1);
        }
        _dummy.updateMatrix();
        tunnelRoofInst.setMatrixAt(i, _dummy.matrix);
      }
      tunnelRoofInst.instanceMatrix.needsUpdate = true;

      const towerSpan = 250;
      for (let i = 0; i < towerCount; i++) {
        const tm = towerMeta[i];
        const z =
          (((tm.zOffset + sim.scrollOffsetZ * 0.45) % towerSpan) + towerSpan) %
            towerSpan -
          205;
        _dummy.position.set(tm.xOffset, -0.04, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(tm.w, tm.h, tm.d);
        _dummy.updateMatrix();
        towersInst.setMatrixAt(i, _dummy.matrix);
      }
      towersInst.instanceMatrix.needsUpdate = true;

      // Update Pooled Particles
      for (let i = 0; i < maxParticles; i++) {
        const p = particles[i];
        if (!p.active) {
          _dummy.position.set(0, -50, 0);
          _dummy.scale.set(0.001, 0.001, 0.001);
          _dummy.updateMatrix();
          particleInst.setMatrixAt(i, _dummy.matrix);
          continue;
        }
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const fade = 1 - p.life / p.maxLife;
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.scale.set(p.scale * fade, p.scale * fade, p.scale * fade);
        _dummy.updateMatrix();
        particleInst.setMatrixAt(i, _dummy.matrix);
        _color.setHex(p.colorHex);
        particleInst.setColorAt(i, _color);
      }
      particleInst.instanceMatrix.needsUpdate = true;
      if (particleInst.instanceColor) particleInst.instanceColor.needsUpdate = true;

      // --- C. SMOOTH LANDSCAPE CAMERA RIG & GARAGE BOUNDING-BOX FRAMING ---
      sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 2.2);
      const shakeMag = sim.cameraTrauma * sim.cameraTrauma * 0.35;
      const shakeX = (Math.random() - 0.5) * shakeMag;
      const shakeY = (Math.random() - 0.5) * shakeMag;

      const viewW = container.clientWidth || window.innerWidth;
      const viewH = Math.max(1, container.clientHeight || window.innerHeight);

      if (isGaragePreview) {
        // PRIORITY 1: Frame the entire vehicle inside the left showroom preview pane
        // using the vehicle's actual 3D bounding sphere and camera view offset.
        const bounds = carBounds[selectedCarId] ?? {
          radius: 2.55,
          centerY: 0.65,
          length: 4.5,
          width: 2.0,
          height: 1.3,
        };
        const targetFovDeg = 40;
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFovDeg, 10, dt);

        const vFovRad = THREE.MathUtils.degToRad(camera.fov);
        // Available showroom pane is the left ~44% of landscape screen between top & bottom cards
        const paneAspect = (viewW >= 640 ? viewW * 0.42 : viewW * 0.9) / (viewH * 0.52);
        const hFovRad = 2 * Math.atan(Math.tan(vFovRad * 0.5) * Math.max(0.75, paneAspect));
        const minHalfAngle = Math.min(vFovRad * 0.5, hFovRad * 0.5);
        const fitDist = Math.max(
          6.5,
          (bounds.radius / Math.sin(Math.max(0.22, minHalfAngle))) * 1.44
        );

        if (viewW >= 640) {
          // Shift the camera optical center into the left showroom pane
          camera.setViewOffset(
            viewW,
            viewH,
            Math.round(viewW * 0.275),
            Math.round(viewH * -0.015),
            viewW,
            viewH
          );
        } else {
          camera.clearViewOffset();
        }

        _targetCamPos.set(0, bounds.centerY + 1.08, fitDist);
        _desiredCamLook.set(0, bounds.centerY * 0.85, 0);
      } else if (currentProps.gameState === 'title') {
        camera.clearViewOffset();
        sim.titleOrbitTime += dt * 0.45;
        _targetCamPos.set(
          -0.6 + Math.sin(sim.titleOrbitTime) * 0.35,
          2.2,
          5.1 + Math.cos(sim.titleOrbitTime) * 0.35
        );
        _desiredCamLook.set(0.45, 0.85, -14);
        camera.fov = THREE.MathUtils.damp(camera.fov, 56, 8, dt);
      } else {
        camera.clearViewOffset();
        const lookAheadCenter = computeCurvedRoadCenterAtWorldZ(
          activeCourseForVisuals,
          sim.distanceMeters,
          -24
        );
        const chaseX = sim.playerX * 0.76 + shakeX;
        const chaseY = (sim.isNitroActive ? 2.58 : 2.82) + shakeY;
        const chaseZ = sim.isNitroActive ? 5.85 : 6.45;
        _targetCamPos.set(chaseX, chaseY, chaseZ);
        _desiredCamLook.set(
          sim.playerX * 0.85 + lookAheadCenter.xOffset * 0.68,
          0.28,
          -24
        );
        const speedAboveLaunch = Math.max(
          0,
          sim.speedMs * 3.6 - HIGHWAY_CONFIG.launchSpeedKmh
        );
        const targetFov = sim.isNitroActive
          ? 74
          : 58 + Math.min(11, speedAboveLaunch * 0.05);
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
      }

      camera.updateProjectionMatrix();
      const camDamp = 1 - Math.exp(-11 * dt);
      camera.position.lerp(_targetCamPos, camDamp);
      _currentCamLook.lerp(_desiredCamLook, camDamp);
      camera.lookAt(_currentCamLook);

      // --- D. HIGH-FREQUENCY AUTHORITATIVE DOM REF HUD UPDATES ---
      hudUpdateAccum += dt;
      if (hudUpdateAccum >= 0.05) {
        hudUpdateAccum = 0;
        const refs = currentProps.hudRefs;
        const speedKmhInt = Math.round(sim.speedMs * 3.6);
        const distInt = Math.max(0, Math.floor(sim.distanceMeters));

        // Authoritative live race score starting at 0 at the start line
        let liveScore = 0;
        if (playMode === 'levels') {
          if (distInt > 0 || sim.coinsCollected > 0 || sim.driftScore > 0) {
            const progressRatio = Math.min(
              1,
              distInt / Math.max(1, sim.activeCourse.totalLengthMeters)
            );
            liveScore =
              Math.round((7 - sim.playerPosition) * 1200 * progressRatio) +
              Math.floor(distInt * 2) +
              sim.coinsCollected * HIGHWAY_CONFIG.coinPickupScore +
              Math.floor(sim.driftScore);
          }
        } else {
          const liveSummary = calculateRunRewards({
            distanceMeters: distInt,
            coinsCollected: sim.coinsCollected,
            nearMissCount: sim.nearMissCount,
            bonusScore: sim.bonusScore + Math.floor(sim.driftScore),
          });
          liveScore = liveSummary.totalScore;
        }

        if (refs.speedValueRef.current) {
          refs.speedValueRef.current.textContent = String(speedKmhInt);
        }
        if (refs.distanceValueRef.current) {
          if (playMode === 'levels') {
            const rem = Math.max(
              0,
              Math.ceil(sim.activeCourse.totalLengthMeters - sim.distanceMeters)
            );
            refs.distanceValueRef.current.textContent = `${rem}m`;
          } else {
            refs.distanceValueRef.current.textContent = `${distInt}m`;
          }
        }
        if (refs.scoreValueRef.current) {
          refs.scoreValueRef.current.textContent = liveScore.toLocaleString();
        }
        // PRIORITY 3B: Display exact coins collected during the current race
        if (refs.coinsValueRef.current) {
          refs.coinsValueRef.current.textContent = String(sim.coinsCollected);
        }
        if (refs.nitroFillRef.current) {
          refs.nitroFillRef.current.style.transform = `scaleX(${sim.nitroAmount.toFixed(3)})`;
        }
        if (refs.nitroPctRef.current) {
          refs.nitroPctRef.current.textContent = `${Math.round(sim.nitroAmount * 100)}%`;
        }
        if (refs.tiltAngleBadgeRef.current) {
          const rawTilt = controlsRef.current.hasRealDeviceOrientation
            ? controlsRef.current.lastRawDeviceTiltDeg
            : controlsRef.current.simulatedTiltDeg;
          const calTilt = Math.round(rawTilt - currentProps.neutralTiltOffsetDeg);
          refs.tiltAngleBadgeRef.current.textContent = `${calTilt > 0 ? '+' : ''}${calTilt}°`;
        }
        if (refs.steerIndicatorBarRef.current) {
          const pct = Math.round(sim.filteredTiltSteer * 50);
          refs.steerIndicatorBarRef.current.style.transform = `translateX(${pct}%)`;
        }
        if (refs.racePositionValueRef?.current && playMode === 'levels') {
          refs.racePositionValueRef.current.textContent = `${sim.playerPosition}/6`;
        }
        if (refs.levelProgressFillRef?.current && playMode === 'levels') {
          const prog = Math.max(
            0,
            Math.min(1, sim.distanceMeters / Math.max(1, sim.activeCourse.totalLengthMeters))
          );
          refs.levelProgressFillRef.current.style.transform = `scaleX(${prog.toFixed(3)})`;
        }
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDownCanvas);
      window.removeEventListener('pointermove', onPointerMoveCanvas);
      window.removeEventListener('pointerup', onPointerUpCanvas);
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
      window.removeEventListener('devicemotion', handleDeviceMotion, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [props.graphicsQuality]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 overflow-hidden bg-[#070b16]"
      aria-label="Velocity Rush 3D Highway Viewport"
    />
  );
};
