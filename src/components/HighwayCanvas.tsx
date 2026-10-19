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
  computeRaceStandings,
  createLevelAiOpponents,
  GeneratedLevelCourse,
  generateLevelCourse,
  LevelHazardType,
  LevelRaceRewardsBreakdown,
  RacerStandingEntry,
  sampleTrackAtDistance,
  stepAiOpponent,
} from '../game/levelsMode';
import { CarCustomizationState, createDefaultCarCustomization } from '../game/saveSystem';
import { soundController } from '../game/audio';
import {
  createInitialWeatherState,
  selectNextRandomWeather,
  stepWeatherInterpolation,
  WEATHER_ORDER,
  WEATHER_PROFILES,
  WeatherConditionId,
} from '../game/weather';
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
  weatherCondition?: WeatherConditionId;
  weatherLabel?: string;
  surfaceConditionLabel?: string;
  trackGripPct?: number;
  visibilityPct?: number;
}

export interface CompletedRunPayload {
  runId: string;
  playMode: GamePlayMode;
  summary: RunRewardsSummary;
  nearMissCount: number;
  topSpeedKmh: number;
  reviveAvailable: boolean;
  levelResult?: {
    course: GeneratedLevelCourse;
    standings: RacerStandingEntry[];
    playerPosition: number;
    playerFinishedCourse: boolean;
    finishTimeSec: number;
    rewards: LevelRaceRewardsBreakdown;
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
  requestMotionPermission?: () => Promise<boolean>;
  cycleWeather?: () => WeatherConditionId;
  setWeatherCondition?: (condition: WeatherConditionId) => void;
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
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
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
    scene.fog = new THREE.FogExp2(0x111a2e, 0.0042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.85;

    const camera = new THREE.PerspectiveCamera(
      58,
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight),
      0.2,
      280
    );
    camera.position.set(0, 3.1, 6.8);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.35);
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

    // Road & Environment
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const { albedoMap, roughnessMap } = createRoadTextures(maxAniso);
    albedoMap.repeat.set(1, 20);
    roughnessMap.repeat.set(1, 20);

    const roadGeo = new THREE.PlaneGeometry(HIGHWAY_CONFIG.roadWidth, 320, 1, 24);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      roughnessMap,
      roughness: 0.72,
      metalness: 0.14,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, 0, -110);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 380),
      new THREE.MeshStandardMaterial({ color: 0x0b101d, roughness: 0.95 })
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.set(0, -0.06, -120);
    scene.add(groundPlane);

    // Barriers
    const barrierGeo = new THREE.BoxGeometry(0.65, 0.9, 320);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.52,
      metalness: 0.38,
    });
    const leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    leftBarrier.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5 - 0.32, 0.45, -110);
    const rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    rightBarrier.position.set(HIGHWAY_CONFIG.roadWidth * 0.5 + 0.32, 0.45, -110);
    scene.add(leftBarrier, rightBarrier);

    const stripGeo = new THREE.BoxGeometry(0.1, 0.1, 320);
    const leftStrip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.2,
      })
    );
    leftStrip.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5 + 0.03, 0.76, -110);

    const rightStrip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.2,
      })
    );
    rightStrip.position.set(HIGHWAY_CONFIG.roadWidth * 0.5 - 0.03, 0.76, -110);
    scene.add(leftStrip, rightStrip);

    // Showroom Pedestal Ring (visible when Garage is open)
    const turntableGroup = new THREE.Group();
    const platformDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.25, 3.45, 0.12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.82,
        roughness: 0.2,
      })
    );
    platformDisc.position.y = 0.02;
    const platformGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.32, 0.055, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.5,
      })
    );
    platformGlowRing.rotation.x = Math.PI / 2;
    platformGlowRing.position.y = 0.07;
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

    // Build all 8 Player Car Rigs so switching vehicles in the Garage or Race is instantaneous!
    const playerAnchor = new THREE.Group();
    scene.add(playerAnchor);

    const carRigs = {} as Record<CarId, PlayerCarMeshRig>;
    for (const cId of CAR_ORDER) {
      const rig = buildPlayerCarMesh(CAR_CONFIGS[cId]);
      rig.group.visible = cId === propsRef.current.selectedCarId;
      const initCust =
        propsRef.current.carCustomizations?.[cId] ?? createDefaultCarCustomization();
      applyCarCustomizationToRig(rig, CAR_CONFIGS[cId], initCust);
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

    // Particle Pool
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

    // Weather Precipitation Pool (Rain streaks, Snowflakes & Mist motes)
    const maxWeatherParticles = 400;
    const weatherDropGeo = new THREE.BoxGeometry(1, 1, 1);
    const weatherDropMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
    });
    const weatherPrecipInst = new THREE.InstancedMesh(
      weatherDropGeo,
      weatherDropMat,
      maxWeatherParticles
    );
    weatherPrecipInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(weatherPrecipInst);

    const weatherParticles = Array.from({ length: maxWeatherParticles }, (_, idx) => ({
      x: (Math.random() - 0.5) * 34,
      y: Math.random() * 14,
      z: -Math.random() * 72 + 8,
      phase: idx * 0.37,
      speedScale: 0.85 + Math.random() * 0.35,
    }));

    // Pre-allocated temporaries
    const _dummy = new THREE.Object3D();
    const _color = new THREE.Color();
    const _targetFogColor = new THREE.Color();
    const _targetSkyColor = new THREE.Color();
    const _targetGroundColor = new THREE.Color();
    const _targetRoadTint = new THREE.Color();
    const _targetCamPos = new THREE.Vector3();
    const _currentCamLook = new THREE.Vector3(0, 1.0, -18);
    const _desiredCamLook = new THREE.Vector3(0, 1.0, -18);

    const resolveUrlWeatherParam = (): WeatherConditionId | null => {
      if (typeof window === 'undefined') return null;
      const w = new URLSearchParams(window.location.search).get('weather');
      if (w === 'clear' || w === 'rain' || w === 'fog' || w === 'snow') {
        return w;
      }
      return null;
    };

    const initialWeatherId: WeatherConditionId =
      resolveUrlWeatherParam() ?? selectNextRandomWeather('clear');

    // Simulation State
    const sim = {
      runId: `run_${Date.now()}`,
      speedMs: HIGHWAY_CONFIG.launchSpeedKmh / 3.6,
      topSpeedReachedKmh: HIGHWAY_CONFIG.launchSpeedKmh,
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
      playerX: -1.8,
      lateralVelocity: 0,
      filteredTiltSteer: 0,
      invulnerableTimer: 0,
      shieldFlashTimer: 0,
      hitstopTimer: 0,
      cameraTrauma: 0,
      countdownTimer: 2.4,
      lastCountdownInt: 3 as number | null,
      trafficSpawnTimer: 0.5,
      coinSpawnTimer: 0.9,
      scrollOffsetZ: 0,
      visualCurveFactor: 0,
      reviveUsed: false,
      isDying: false,
      defeatDelayTimer: 0,
      bannerIdCounter: 1,
      titleOrbitTime: 0,
      garageYawRad: 0.58,
      garageSwapScale: 1.0,
      lastInspectedCarId: propsRef.current.selectedCarId,
      // Levels Mode active course & 5 AI opponents
      activeCourse: generateLevelCourse(propsRef.current.levelNumber ?? 1),
      aiOpponents: [] as AiOpponentState[],
      elapsedRaceSec: 0,
      playerPosition: 6,
      lastSegmentLabel: 'Starting Grid',
      // Dynamic Weather System State
      targetWeatherId: initialWeatherId,
      weatherState: createInitialWeatherState(initialWeatherId),
      weatherChangeTimer: 24 + Math.random() * 10,
      weatherLockedByUser: resolveUrlWeatherParam() !== null,
      lastReportedGripPct: Math.round(WEATHER_PROFILES[initialWeatherId].gripMultiplier * 100),
    };

    function syncLiveHudSnapshot(
      banner?: { text: string; subtext: string; tone: 'cyan' | 'amber' | 'danger' }
    ) {
      const mode = propsRef.current.playMode ?? 'solo';
      const activeProfile = WEATHER_PROFILES[sim.targetWeatherId] ?? WEATHER_PROFILES.clear;
      const gripPct = Math.round(sim.weatherState.gripMultiplier * 100);
      sim.lastReportedGripPct = gripPct;

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
        weatherCondition: sim.targetWeatherId,
        weatherLabel: activeProfile.name,
        surfaceConditionLabel: activeProfile.surfaceConditionLabel,
        trackGripPct: gripPct,
        visibilityPct: sim.weatherState.visibilityPct,
      });
    }

    function applyWeatherTransition(nextWeather: WeatherConditionId, announceBanner: boolean) {
      sim.targetWeatherId = nextWeather;
      sim.weatherChangeTimer = 24 + Math.random() * 12;
      const profile = WEATHER_PROFILES[nextWeather];
      if (announceBanner && propsRef.current.gameState === 'playing') {
        const gripPct = Math.round(profile.gripMultiplier * 100);
        syncLiveHudSnapshot({
          text: `WEATHER: ${profile.name.toUpperCase()}`,
          subtext: `${profile.surfaceConditionLabel} · Track Grip ${gripPct}% · Visibility ${profile.visibilityPct}%`,
          tone: nextWeather === 'snow' || nextWeather === 'rain' ? 'amber' : 'cyan',
        });
      } else {
        syncLiveHudSnapshot();
      }
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
      sim.speedMs = HIGHWAY_CONFIG.launchSpeedKmh / 3.6;
      sim.topSpeedReachedKmh = HIGHWAY_CONFIG.launchSpeedKmh;
      sim.distanceMeters = 0;
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
      sim.playerX = -1.8;
      sim.lateralVelocity = 0;
      sim.filteredTiltSteer = 0;
      sim.invulnerableTimer = 0;
      sim.shieldFlashTimer = 0;
      sim.hitstopTimer = 0;
      sim.cameraTrauma = 0;
      sim.countdownTimer = 2.4;
      sim.lastCountdownInt = 3;
      sim.trafficSpawnTimer = 0.5;
      sim.coinSpawnTimer = 0.8;
      sim.visualCurveFactor = 0;
      sim.reviveUsed = false;
      sim.isDying = false;
      sim.defeatDelayTimer = 0;
      sim.elapsedRaceSec = 0;
      sim.playerPosition = 6;
      sim.weatherChangeTimer = 22 + Math.random() * 10;

      const urlWeather = resolveUrlWeatherParam();
      if (urlWeather) {
        sim.targetWeatherId = urlWeather;
        sim.weatherState = createInitialWeatherState(urlWeather);
      } else if (!sim.weatherLockedByUser) {
        const nextRandWeather = selectNextRandomWeather(sim.targetWeatherId);
        sim.targetWeatherId = nextRandWeather;
        sim.weatherState = createInitialWeatherState(nextRandWeather);
      }

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

      const mode = propsRef.current.playMode ?? 'solo';
      if (mode === 'levels') {
        const lvl = propsRef.current.levelNumber ?? 1;
        sim.activeCourse = generateLevelCourse(lvl);
        sim.aiOpponents = createLevelAiOpponents(lvl, effStats.topSpeedMs);
        sim.lastSegmentLabel = sim.activeCourse.segments[0]?.label ?? 'Starting Grid';
        rebuildAiOpponentMeshes(sim.aiOpponents);
      } else {
        for (const rig of aiOpponentRigs) {
          rig.group.visible = false;
        }
        startGantryMesh.visible = false;
        finishGantryMesh.visible = false;
      }

      syncLiveHudSnapshot();
    }

    function reviveCurrentRun() {
      if (sim.reviveUsed) return;
      sim.reviveUsed = true;
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
      sim.garageYawRad += deltaRad;
    };
    propsRef.current.controlsRef.current.cycleWeather = () => {
      const idx = WEATHER_ORDER.indexOf(sim.targetWeatherId);
      const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
      sim.weatherLockedByUser = true;
      applyWeatherTransition(next, true);
      return next;
    };
    propsRef.current.controlsRef.current.setWeatherCondition = (cond: WeatherConditionId) => {
      sim.weatherLockedByUser = true;
      applyWeatherTransition(cond, true);
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
      }
    };
    const onPointerMoveCanvas = (e: PointerEvent) => {
      if (isDraggingTurntable && propsRef.current.gameState === 'title') {
        const dx = e.clientX - lastDragClientX;
        lastDragClientX = e.clientX;
        sim.garageYawRad += dx * 0.012;
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
      const dt = Math.min(rawDt, 0.05);

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
        sim.garageSwapScale = 0.86;
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

      turntableGroup.visible =
        currentProps.gameState === 'title' && currentProps.isGarageOpen;
      turntableGroup.position.x = playerAnchor.position.x;

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

      // --- A. ACTIVE RACE SIMULATION ---
      if (currentProps.gameState === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer -= dt;
          renderer.render(scene, camera);
          return;
        }

        if (sim.isDying) {
          sim.defeatDelayTimer -= dt;
          sim.speedMs = Math.max(0, sim.speedMs - 38 * dt);
          sim.scrollOffsetZ += sim.speedMs * dt;

          if (sim.defeatDelayTimer <= 0) {
            sim.isDying = false;
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
                nearMissCount: sim.nearMissCount,
                topSpeedKmh: Math.round(sim.topSpeedReachedKmh),
                reviveAvailable: !sim.reviveUsed,
                levelResult: {
                  course: sim.activeCourse,
                  standings,
                  playerPosition: pRank,
                  playerFinishedCourse: false,
                  finishTimeSec: Number(sim.elapsedRaceSec.toFixed(2)),
                  rewards,
                  driftScore: Math.floor(sim.driftScore),
                  collisionsCount: sim.collisionsCount,
                },
              });
            } else {
              currentProps.onRunEnded({
                runId: sim.runId,
                playMode: 'solo',
                summary,
                nearMissCount: sim.nearMissCount,
                topSpeedKmh: Math.round(sim.topSpeedReachedKmh),
                reviveAvailable: !sim.reviveUsed,
              });
            }
          }
          renderer.render(scene, camera);
          return;
        }

        // Countdown overlay (3 -> 2 -> 1 -> GO!)
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

        sim.elapsedRaceSec += dt;

        // Dynamic Random Weather Progression (cycles every ~25-35s unless locked)
        if (!sim.weatherLockedByUser) {
          sim.weatherChangeTimer -= dt;
          if (sim.weatherChangeTimer <= 0) {
            const nextRandom = selectNextRandomWeather(sim.targetWeatherId);
            applyWeatherTransition(nextRandom, true);
          }
        }
        sim.weatherState = stepWeatherInterpolation(
          sim.weatherState,
          sim.targetWeatherId,
          dt,
          0.65
        );
        const currentGripPct = Math.round(sim.weatherState.gripMultiplier * 100);
        if (Math.abs(currentGripPct - sim.lastReportedGripPct) >= 2) {
          syncLiveHudSnapshot();
        }

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

        // 2. Longitudinal Physics (Automatic Acceleration, Weather-Adjusted Braking, Nitro)
        const nitroWanted =
          keysPressed.has('Space') ||
          keysPressed.has('KeyW') ||
          keysPressed.has('ArrowUp') ||
          controlsRef.current.nitroHeld;
        const brakeWanted =
          keysPressed.has('KeyS') ||
          keysPressed.has('ArrowDown') ||
          controlsRef.current.brakeHeld;

        const weatherEffectiveStats = {
          ...effectiveStats,
          brakingDecelMs2:
            effectiveStats.brakingDecelMs2 * sim.weatherState.brakingMultiplier,
          accelRateMs2:
            effectiveStats.accelRateMs2 *
            (0.88 + 0.12 * sim.weatherState.gripMultiplier),
        };

        const longStep = stepLongitudinalPhysics({
          currentSpeedMs: sim.speedMs,
          nitroAmount: sim.nitroAmount,
          isNitroActive: sim.isNitroActive,
          nitroWanted,
          brakeWanted,
          effectiveStats: weatherEffectiveStats,
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

        // 3. Track Curvature, Weather Track Grip, Centrifugal Slip & Drift Detection
        let currentCurvature = 0;
        if (playMode === 'levels') {
          const sample = sampleTrackAtDistance(sim.activeCourse, sim.distanceMeters);
          currentCurvature = sample.curvature;
          sim.visualCurveFactor = THREE.MathUtils.damp(
            sim.visualCurveFactor,
            currentCurvature,
            4.5,
            dt
          );
          if (sample.segment.label !== sim.lastSegmentLabel) {
            sim.lastSegmentLabel = sample.segment.label;
            syncLiveHudSnapshot();
          }
        } else {
          sim.visualCurveFactor = THREE.MathUtils.damp(sim.visualCurveFactor, 0, 6, dt);
        }

        const centrifugalPull =
          playMode === 'levels'
            ? -currentCurvature *
              Math.max(0, (sim.speedMs - 20) / 45) *
              4.2 *
              sim.weatherState.centrifugalMultiplier
            : 0;

        // Crosswind and low-grip surface micro-drift at high speed in Rain or Snow
        const crosswindPush =
          sim.weatherState.windLateralMs *
          0.18 *
          Math.max(0, (sim.speedMs - 22) / 40);

        const targetLatVel =
          activeSteerInput *
            effectiveStats.handling *
            sim.weatherState.gripMultiplier +
          centrifugalPull +
          crosswindPush;

        sim.lateralVelocity = THREE.MathUtils.damp(
          sim.lateralVelocity,
          targetLatVel,
          sim.weatherState.lateralDampRate,
          dt
        );
        sim.playerX = THREE.MathUtils.clamp(
          sim.playerX + sim.lateralVelocity * dt,
          -HIGHWAY_CONFIG.playerBoundX,
          HIGHWAY_CONFIG.playerBoundX
        );

        playerAnchor.position.x = sim.playerX;

        // Genuine Drift Detection (curves in Levels Mode OR low-grip wet/icy powerslides)
        const absCurve = Math.abs(currentCurvature);
        const absSteer = Math.abs(activeSteerInput);
        const wasDrifting = sim.isDrifting;
        const curveDrift =
          playMode === 'levels' &&
          absCurve >= 0.32 * sim.weatherState.driftThresholdScale &&
          sim.speedMs > 28 &&
          absSteer >= 0.32;
        const slickWeatherPowerslide =
          sim.weatherState.gripMultiplier <= 0.85 &&
          sim.speedMs > 34 &&
          absSteer >= 0.72 &&
          Math.abs(sim.lateralVelocity) > 4.2;

        sim.isDrifting =
          (curveDrift || slickWeatherPowerslide) &&
          Math.abs(sim.playerX) < HIGHWAY_CONFIG.playerBoundX - 0.15;

        if (sim.isDrifting) {
          sim.driftScore += dt * 125 * (1 + absCurve + (1 - sim.weatherState.gripMultiplier));
          sim.nitroAmount = Math.min(1, sim.nitroAmount + dt * 0.055);
          sim.driftAudioCooldown -= dt;
          if (sim.driftAudioCooldown <= 0) {
            soundController.playDriftPulse();
            sim.driftAudioCooldown = 0.24;
          }
          if (Math.random() < 0.7) {
            spawnParticleBurst(sim.playerX - 0.7, 0.15, 1.35, 1, 0xf59e0b, 3.2);
            spawnParticleBurst(sim.playerX + 0.7, 0.15, 1.35, 1, 0x38bdf8, 3.2);
          }
        }
        // Wet / snowy rear tire rooster-tail spray at speed
        if (
          sim.speedMs > 24 &&
          (sim.targetWeatherId === 'rain' || sim.targetWeatherId === 'snow') &&
          Math.random() < 0.42
        ) {
          const sprayColor = sim.targetWeatherId === 'snow' ? 0xe0f2fe : 0x7dd3fc;
          spawnParticleBurst(sim.playerX - 0.68, 0.12, 1.85, 1, sprayColor, 2.2);
          spawnParticleBurst(sim.playerX + 0.68, 0.12, 1.85, 1, sprayColor, 2.2);
        }
        if (wasDrifting !== sim.isDrifting) {
          syncLiveHudSnapshot();
        }

        // Chassis roll, yaw (enhanced slip angle when drifting), pitch, brake lights & wheels
        const normSteer = THREE.MathUtils.clamp(
          sim.lateralVelocity / Math.max(1, effectiveStats.handling),
          -1,
          1
        );
        const driftYawBonus = sim.isDrifting ? -Math.sign(activeSteerInput) * 0.12 : 0;
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
                subtext: `+${HIGHWAY_CONFIG.nearMissCoinBonus} Coins · +Nitro Boost`,
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
          // --- LEVELS MODE: 5 AI OPPONENTS, PROCEDURAL OBSTACLES, START & FINISH GANTRIES ---
          const course = sim.activeCourse;

          // Position Start & Finish Line Gantries relative to player distance
          const startRelZ = sim.distanceMeters - 0; // behind player as distance increases
          if (startRelZ < 35) {
            startGantryMesh.visible = true;
            startGantryMesh.position.set(0, 0, startRelZ);
          } else {
            startGantryMesh.visible = false;
          }

          const finishRelZ = -(course.totalLengthMeters - sim.distanceMeters);
          if (finishRelZ > -220 && finishRelZ < 35) {
            const curveShiftFinish =
              sim.visualCurveFactor * Math.pow(Math.max(0, -finishRelZ) / 70, 1.5) * 4.5;
            finishGantryMesh.visible = true;
            finishGantryMesh.position.set(curveShiftFinish, 0, finishRelZ);
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
            if (relZ > -210 && relZ < 32) {
              const curveShift =
                sim.visualCurveFactor * Math.pow(Math.max(0, -relZ) / 70, 1.5) * 4.5;
              aiRig.group.visible = true;
              aiRig.group.position.set(ai.x + curveShift, 0, relZ);
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
                // Player bumped the rear of AI ahead
                sim.speedMs = Math.max(ai.speedMs, sim.speedMs * 0.9);
                spawnParticleBurst(sim.playerX, 0.5, -1.5, 6, 0x38bdf8, 5);
              }
            }
          }

          // Render & Check Visible Course Obstacles (Barriers / Chicanes / Pylons)
          let poolIdx = 0;
          for (let i = 0; i < course.obstacles.length; i++) {
            const obs = course.obstacles[i];
            const relZ = -(obs.distanceMeters - sim.distanceMeters);
            if (relZ > -185 && relZ < 18 && poolIdx < levelObstaclePool.length) {
              const item = levelObstaclePool[poolIdx++];
              const curveShift =
                sim.visualCurveFactor * Math.pow(Math.max(0, -relZ) / 70, 1.5) * 4.5;
              item.mesh.visible = true;
              item.mesh.position.set(obs.x + curveShift, 0, relZ);

              // Check collision with Player
              if (
                sim.invulnerableTimer <= 0 &&
                Math.abs(relZ) < obs.halfLength + 1.85 &&
                Math.abs(obs.x - sim.playerX) < obs.halfWidth + 0.72
              ) {
                sim.collisionsCount += 1;
                sim.cleanDriveShieldTimer = 0;
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

          // Render & Collect Course Coins
          let coinIdx = 0;
          for (let i = 0; i < course.coins.length; i++) {
            const c = course.coins[i];
            if (c.collected) continue;
            const relZ = -(c.distanceMeters - sim.distanceMeters);
            if (relZ > -160 && relZ < 14 && coinIdx < coinPool.length) {
              const poolCoin = coinPool[coinIdx++];
              const curveShift =
                sim.visualCurveFactor * Math.pow(Math.max(0, -relZ) / 70, 1.5) * 4.5;
              poolCoin.mesh.visible = true;
              poolCoin.mesh.position.set(c.x + curveShift, 0.9, relZ);
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

          if (sim.distanceMeters >= course.totalLengthMeters) {
            // Player crossed the Finish Line!
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
              summary,
              nearMissCount: sim.nearMissCount,
              topSpeedKmh: Math.round(sim.topSpeedReachedKmh),
              reviveAvailable: false,
              levelResult: {
                course,
                standings: finalStandings,
                playerPosition: finalRank,
                playerFinishedCourse: true,
                finishTimeSec: finishTime,
                rewards,
                driftScore: Math.floor(sim.driftScore),
                collisionsCount: sim.collisionsCount,
              },
            });
            return;
          }
        }

        soundController.updateEngine(currentSpeedKmh, sim.isNitroActive, false);
      } else if (currentProps.gameState === 'title') {
        const menuSpeedMs = currentProps.isGarageOpen ? 0 : 24;
        sim.scrollOffsetZ += menuSpeedMs * dt;
        sim.visualCurveFactor = THREE.MathUtils.damp(sim.visualCurveFactor, 0, 6, dt);

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

        sim.playerX = THREE.MathUtils.damp(
          sim.playerX,
          currentProps.isGarageOpen ? 0 : 1.75,
          7,
          dt
        );
        playerAnchor.position.x = sim.playerX;
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

      const archSpacing = 12;
      const archWrapSpan = archCount * archSpacing;
      for (let i = 0; i < archCount; i++) {
        const z =
          ((i * archSpacing + sim.scrollOffsetZ) % archWrapSpan) - archWrapSpan + 24;
        const curveX =
          sim.visualCurveFactor * Math.pow(Math.max(0, -z) / 70, 1.5) * 4.5;

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
          const curveX =
            sim.visualCurveFactor * Math.pow(Math.max(0, -z) / 70, 1.5) * 4.5;
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

      // Update Atmosphere, Road Surface Wetness/Ice & 3D Weather Precipitation
      const isGaragePreview =
        currentProps.gameState === 'title' && currentProps.isGarageOpen;
      const effectiveWeatherId: WeatherConditionId = isGaragePreview
        ? 'clear'
        : sim.targetWeatherId;
      const targetWeatherProfile =
        WEATHER_PROFILES[effectiveWeatherId] ?? WEATHER_PROFILES.clear;

      const envLerp = Math.min(1, dt * 2.5);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = isGaragePreview
          ? THREE.MathUtils.damp(scene.fog.density, 0.0038, 5, dt)
          : sim.weatherState.fogDensity;
        _targetFogColor.setHex(targetWeatherProfile.fogColorHex);
        scene.fog.color.lerp(_targetFogColor, envLerp);
      }

      _targetSkyColor.setHex(targetWeatherProfile.hemiSkyHex);
      _targetGroundColor.setHex(targetWeatherProfile.hemiGroundHex);
      hemiLight.color.lerp(_targetSkyColor, envLerp);
      hemiLight.groundColor.lerp(_targetGroundColor, envLerp);
      hemiLight.intensity = isGaragePreview
        ? 1.45
        : sim.weatherState.hemiIntensity;
      sunLight.intensity = isGaragePreview
        ? 2.6
        : sim.weatherState.sunIntensity;
      renderer.toneMappingExposure = isGaragePreview
        ? 1.2
        : sim.weatherState.exposure;

      roadMat.roughness = isGaragePreview ? 0.65 : sim.weatherState.roadRoughness;
      roadMat.metalness = isGaragePreview ? 0.18 : sim.weatherState.roadMetalness;
      _targetRoadTint.setHex(targetWeatherProfile.roadTintHex);
      roadMat.color.lerp(_targetRoadTint, envLerp);

      const activePrecipCount =
        isGaragePreview || showTunnels ? 0 : targetWeatherProfile.particleCount;
      const precipType = targetWeatherProfile.precipitationType;
      weatherDropMat.opacity =
        precipType === 'rain' ? 0.72 : precipType === 'snow' ? 0.86 : 0.22;
      const forwardRushSpeed =
        currentProps.gameState === 'playing' ? sim.speedMs * 0.62 : 14;

      for (let i = 0; i < maxWeatherParticles; i++) {
        if (i >= activePrecipCount || precipType === 'none') {
          _dummy.position.set(0, -60, 0);
          _dummy.scale.set(0.001, 0.001, 0.001);
          _dummy.updateMatrix();
          weatherPrecipInst.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        const wp = weatherParticles[i];
        if (precipType === 'rain') {
          wp.x += sim.weatherState.windLateralMs * dt;
          wp.y -= 28 * wp.speedScale * dt;
          wp.z += forwardRushSpeed * dt;
        } else if (precipType === 'snow') {
          const swirl = Math.sin(now * 0.0028 + wp.phase) * 2.4;
          wp.x += (sim.weatherState.windLateralMs + swirl) * dt;
          wp.y -= 5.6 * wp.speedScale * dt;
          wp.z += forwardRushSpeed * 0.65 * dt;
        } else {
          // Dense metro fog drifting mist motes
          wp.x += Math.cos(now * 0.0014 + wp.phase) * 1.1 * dt;
          wp.y -= 0.6 * dt;
          wp.z += forwardRushSpeed * 0.55 * dt;
        }

        // Wrap particles smoothly inside the active camera volume
        if (wp.y < 0.05) {
          wp.y = 13.5 + (Math.random() * 1.5);
          wp.x = sim.playerX + (Math.random() - 0.5) * 32;
        }
        if (wp.z > 9) {
          wp.z = -64 - Math.random() * 8;
          wp.x = sim.playerX + (Math.random() - 0.5) * 32;
        }
        if (wp.x > sim.playerX + 18) wp.x -= 36;
        if (wp.x < sim.playerX - 18) wp.x += 36;

        _dummy.position.set(wp.x, wp.y, wp.z);
        if (precipType === 'rain') {
          _dummy.rotation.set(0.32, 0, -sim.weatherState.windLateralMs * 0.04);
          _dummy.scale.set(0.032, 0.96, 0.032);
          _color.setHex(0xbae6fd);
        } else if (precipType === 'snow') {
          _dummy.rotation.set(now * 0.002 + wp.phase, wp.phase, 0);
          _dummy.scale.set(0.11, 0.11, 0.11);
          _color.setHex(0xf8fafc);
        } else {
          _dummy.rotation.set(0, wp.phase, 0);
          _dummy.scale.set(0.55, 0.08, 0.55);
          _color.setHex(0x94a3b8);
        }
        _dummy.updateMatrix();
        weatherPrecipInst.setMatrixAt(i, _dummy.matrix);
        weatherPrecipInst.setColorAt(i, _color);
      }
      weatherPrecipInst.instanceMatrix.needsUpdate = true;
      if (weatherPrecipInst.instanceColor) {
        weatherPrecipInst.instanceColor.needsUpdate = true;
      }

      // --- C. SMOOTH LANDSCAPE CAMERA RIG CHOREOGRAPHY ---
      sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 2.2);
      const shakeMag = sim.cameraTrauma * sim.cameraTrauma * 0.35;
      const shakeX = (Math.random() - 0.5) * shakeMag;
      const shakeY = (Math.random() - 0.5) * shakeMag;

      if (currentProps.gameState === 'title' && currentProps.isGarageOpen) {
        if (!isDraggingTurntable) {
          sim.garageYawRad += dt * 0.38;
        }
        const radius = 6.15;
        const sinYaw = Math.sin(sim.garageYawRad);
        const cosYaw = Math.cos(sim.garageYawRad);
        _targetCamPos.set(
          playerAnchor.position.x + sinYaw * radius,
          1.88,
          cosYaw * radius
        );
        // Frame the 3D showroom car on the left half of the landscape screen
        const rightShift = window.innerWidth >= 640 ? 1.45 : 0;
        _desiredCamLook.set(
          playerAnchor.position.x + cosYaw * rightShift,
          0.55,
          -sinYaw * rightShift
        );
        camera.fov = THREE.MathUtils.damp(camera.fov, 44, 8, dt);
      } else if (currentProps.gameState === 'title') {
        sim.titleOrbitTime += dt * 0.45;
        _targetCamPos.set(
          -0.6 + Math.sin(sim.titleOrbitTime) * 0.35,
          2.2,
          5.1 + Math.cos(sim.titleOrbitTime) * 0.35
        );
        _desiredCamLook.set(0.45, 0.85, -14);
        camera.fov = THREE.MathUtils.damp(camera.fov, 56, 8, dt);
      } else {
        const chaseX = sim.playerX * 0.72 + shakeX;
        const chaseY = (sim.isNitroActive ? 2.55 : 2.78) + shakeY;
        const chaseZ = sim.isNitroActive ? 5.85 : 6.45;
        _targetCamPos.set(chaseX, chaseY, chaseZ);
        _desiredCamLook.set(
          sim.playerX * 0.88 + sim.visualCurveFactor * 5.2,
          0.25,
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
      const camDamp = 1 - Math.exp(-10 * dt);
      camera.position.lerp(_targetCamPos, camDamp);
      _currentCamLook.lerp(_desiredCamLook, camDamp);
      camera.lookAt(_currentCamLook);

      // --- D. HIGH-FREQUENCY DOM REF HUD UPDATES (ZERO REACT RE-RENDERS) ---
      hudUpdateAccum += dt;
      if (hudUpdateAccum >= 0.05) {
        hudUpdateAccum = 0;
        const refs = currentProps.hudRefs;
        const speedKmhInt = Math.round(sim.speedMs * 3.6);
        const distInt = Math.floor(sim.distanceMeters);
        const liveScore =
          distInt * 4 +
          sim.nearMissCount * HIGHWAY_CONFIG.nearMissScoreBonus +
          sim.coinsCollected * HIGHWAY_CONFIG.coinPickupScore +
          Math.floor(sim.driftScore);
        const liveCoinsEarned =
          sim.coinsCollected * HIGHWAY_CONFIG.coinPickupValue +
          Math.floor(distInt / 20) +
          sim.nearMissCount * HIGHWAY_CONFIG.nearMissCoinBonus;

        if (refs.speedValueRef.current) {
          refs.speedValueRef.current.textContent = String(speedKmhInt);
        }
        if (refs.distanceValueRef.current) {
          if (playMode === 'levels') {
            const rem = Math.max(0, Math.ceil(sim.activeCourse.totalLengthMeters - sim.distanceMeters));
            refs.distanceValueRef.current.textContent = `${rem}m`;
          } else {
            refs.distanceValueRef.current.textContent = `${distInt}m`;
          }
        }
        if (refs.scoreValueRef.current) {
          refs.scoreValueRef.current.textContent = String(liveScore);
        }
        if (refs.coinsValueRef.current) {
          refs.coinsValueRef.current.textContent = String(liveCoinsEarned);
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
