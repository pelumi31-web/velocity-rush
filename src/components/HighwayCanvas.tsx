import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CAR_CONFIGS,
  CarId,
  GraphicsQuality,
  HIGHWAY_CONFIG,
  SensitivityLevel,
  SteeringMode,
} from '../game/config';
import {
  calculateRunRewards,
  CarUpgradesMap,
  evaluateVehicleInteraction,
  getEffectiveCarStats,
  processTiltInput,
  RunRewardsSummary,
  selectFairTrafficLanes,
} from '../game/rules';
import {
  buildCoinPickupMesh,
  buildPlayerCarMesh,
  buildTrafficVehicleMesh,
  createRoadTextures,
  PlayerCarMeshRig,
  TrafficArchetype,
} from '../game/models3d';
import { soundController } from '../game/audio';

export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export interface HudDomRefs {
  speedValueRef: React.RefObject<HTMLSpanElement | null>;
  distanceValueRef: React.RefObject<HTMLSpanElement | null>;
  scoreValueRef: React.RefObject<HTMLSpanElement | null>;
  coinsValueRef: React.RefObject<HTMLSpanElement | null>;
  nitroFillRef: React.RefObject<HTMLDivElement | null>;
  nitroPctRef: React.RefObject<HTMLSpanElement | null>;
  tiltAngleBadgeRef: React.RefObject<HTMLSpanElement | null>;
}

export interface LiveRaceSnapshot {
  integrity: number;
  maxIntegrity: number;
  countdownValue: number | null; // 3, 2, 1, 0 ('GO!'), or null
  nearMissCount: number;
  comboBanner: { text: string; subtext: string; id: number; tone: 'cyan' | 'amber' | 'danger' } | null;
  reviveUsed: boolean;
}

export interface CompletedRunPayload {
  runId: string;
  summary: RunRewardsSummary;
  nearMissCount: number;
  topSpeedKmh: number;
  reviveAvailable: boolean;
}

export interface TouchInputControlsRef {
  steerLeftHeld: boolean;
  steerRightHeld: boolean;
  nitroHeld: boolean;
  brakeHeld: boolean;
  dragSteerNormalized: number;
  simulatedTiltDeg: number;
  lastRawDeviceTiltDeg: number;
  hasRealDeviceOrientation: boolean;
  triggerRevive?: () => void;
  triggerRestart?: () => void;
  rotateGarageTurntable?: (deltaRad: number) => void;
}

interface HighwayCanvasProps {
  gameState: GameLifecycleState;
  isGarageOpen: boolean;
  selectedCarId: CarId;
  carUpgrades: CarUpgradesMap;
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

// Module-scope reusable scratch objects (Zero-GC render loop)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _currentCamLook = new THREE.Vector3(0, 1.1, -18);
const _desiredCamLook = new THREE.Vector3();

export const HighwayCanvas: React.FC<HighwayCanvasProps> = ({
  gameState,
  isGarageOpen,
  selectedCarId,
  carUpgrades,
  steeringMode,
  sensitivity,
  invertTilt,
  neutralTiltOffsetDeg,
  graphicsQuality,
  hudRefs,
  controlsRef,
  onLiveStateChange,
  onRunEnded,
  onRequestPauseToggle,
  onSensorFallbackNotice,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest React props in ref so 60Hz loop always reads fresh state without re-mounting WebGL
  const propsRef = useRef({
    gameState,
    isGarageOpen,
    selectedCarId,
    carUpgrades,
    steeringMode,
    sensitivity,
    invertTilt,
    neutralTiltOffsetDeg,
    graphicsQuality,
    hudRefs,
    onLiveStateChange,
    onRunEnded,
    onRequestPauseToggle,
    onSensorFallbackNotice,
  });

  useEffect(() => {
    propsRef.current = {
      gameState,
      isGarageOpen,
      selectedCarId,
      carUpgrades,
      steeringMode,
      sensitivity,
      invertTilt,
      neutralTiltOffsetDeg,
      graphicsQuality,
      hudRefs,
      onLiveStateChange,
      onRunEnded,
      onRequestPauseToggle,
      onSensorFallbackNotice,
    };
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    const horizonHex = 0x090d18;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.0085);

    const camera = new THREE.PerspectiveCamera(
      62,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.2,
      240
    );
    camera.position.set(0, 3.6, 7.2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isHeadless && propsRef.current.graphicsQuality !== 'low',
        powerPreference: 'high-performance',
        preserveDrawingBuffer: isHeadless,
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.setPixelRatio(
      isHeadless
        ? 1
        : Math.min(window.devicePixelRatio, propsRef.current.graphicsQuality === 'low' ? 1 : 2)
    );
    renderer.shadowMap.enabled = !isHeadless && propsRef.current.graphicsQuality === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.setAttribute('data-testid', 'highway-canvas');
    renderer.domElement.className = 'w-full h-full block outline-none';
    container.appendChild(renderer.domElement);

    // Studio PBR environment reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 2. Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.9);
    keyLight.position.set(14, 26, 18);
    if (!isHeadless) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      const d = 16;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 65;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 0.9);
    rimLight.position.set(-12, 10, -20);
    scene.add(rimLight);

    // 3. Highway Road & Infinite Scenery Setup
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { albedoMap, roughnessMap } = createRoadTextures(maxAniso);
    albedoMap.repeat.set(1, 18);
    roughnessMap.repeat.set(2, 18);

    const roadLength = 280;
    const roadGeo = new THREE.PlaneGeometry(HIGHWAY_CONFIG.roadWidth, roadLength);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: albedoMap,
      roughnessMap,
      roughness: 0.72,
      metalness: 0.18,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, 0, -roadLength * 0.38);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Outer terrain apron so road never floats in an empty void
    const apronGeo = new THREE.PlaneGeometry(240, roadLength);
    apronGeo.rotateX(-Math.PI / 2);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x070a12,
      roughness: 0.95,
      metalness: 0.05,
    });
    const apronMesh = new THREE.Mesh(apronGeo, apronMat);
    apronMesh.position.set(0, -0.04, -roadLength * 0.38);
    scene.add(apronMesh);

    // Highway Concrete Guardrails & Glowing Barrier Strips
    const barrierGeo = new THREE.BoxGeometry(0.55, 0.85, roadLength);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.3,
    });
    const leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    leftBarrier.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5 - 0.3, 0.425, -roadLength * 0.38);
    const rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    rightBarrier.position.set(HIGHWAY_CONFIG.roadWidth * 0.5 + 0.3, 0.425, -roadLength * 0.38);
    scene.add(leftBarrier, rightBarrier);

    const railGlowGeo = new THREE.BoxGeometry(0.12, 0.1, roadLength);
    const leftRailGlow = new THREE.Mesh(
      railGlowGeo,
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    leftRailGlow.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5, 0.72, -roadLength * 0.38);
    const rightRailGlow = new THREE.Mesh(
      railGlowGeo,
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    );
    rightRailGlow.position.set(HIGHWAY_CONFIG.roadWidth * 0.5, 0.72, -roadLength * 0.38);
    scene.add(leftRailGlow, rightRailGlow);

    // Instanced Roadside Light Arches & City Skyline Towers (Lossless Performance)
    const archCount = 24;
    const pillarGeo = new THREE.BoxGeometry(0.35, 7.5, 0.35);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.4,
    });
    const archPillarsInst = new THREE.InstancedMesh(pillarGeo, pillarMat, archCount * 2);
    archPillarsInst.frustumCulled = false;
    scene.add(archPillarsInst);

    const lampHeadGeo = new THREE.BoxGeometry(1.8, 0.18, 0.35);
    const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const lampHeadsInst = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, archCount * 2);
    lampHeadsInst.frustumCulled = false;
    scene.add(lampHeadsInst);

    // Distant City Skyline Towers (InstancedMesh with per-instance color & scale variation)
    const towerCount = 44;
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    towerGeo.translate(0, 0.5, 0); // Bottom-center pivot
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.4,
    });
    const towersInst = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
    towersInst.frustumCulled = false;

    const towerMeta: { side: number; xOffset: number; zOffset: number; w: number; h: number; d: number }[] = [];
    const paletteHex = [0x0f172a, 0x1e293b, 0x172554, 0x0c4a6e, 0x1e1b4b];
    for (let i = 0; i < towerCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const xOffset = side * (16 + ((i * 7) % 28));
      const zOffset = -180 + (i / towerCount) * 240;
      const w = 5 + (i % 6) * 1.6;
      const h = 14 + ((i * 13) % 38);
      const d = 5 + ((i * 3) % 6) * 1.5;
      towerMeta.push({ side, xOffset, zOffset, w, h, d });
      _color.setHex(paletteHex[i % paletteHex.length]);
      towersInst.setColorAt(i, _color);
    }
    if (towersInst.instanceColor) towersInst.instanceColor.needsUpdate = true;
    scene.add(towersInst);

    // Showroom Garage Turntable Ring (visible when Garage is open)
    const turntableGroup = new THREE.Group();
    const padGeo = new THREE.CylinderGeometry(3.4, 3.7, 0.18, 36);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.7,
      roughness: 0.25,
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.y = -0.08;
    turntableGroup.add(padMesh);

    const ringGeo = new THREE.RingGeometry(3.25, 3.42, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide })
    );
    ringMesh.position.y = 0.025;
    turntableGroup.add(ringMesh);
    turntableGroup.visible = false;
    scene.add(turntableGroup);

    // 4. Build All 4 Player Car Rigs Upfront (Zero runtime allocations on car switch)
    const playerCarRigs: Record<CarId, PlayerCarMeshRig> = {
      starter_apex: buildPlayerCarMesh(CAR_CONFIGS.starter_apex),
      vortex_interceptor: buildPlayerCarMesh(CAR_CONFIGS.vortex_interceptor),
      nebula_hyper: buildPlayerCarMesh(CAR_CONFIGS.nebula_hyper),
      titan_enforcer: buildPlayerCarMesh(CAR_CONFIGS.titan_enforcer),
    };

    const playerAnchor = new THREE.Group();
    scene.add(playerAnchor);
    (Object.keys(playerCarRigs) as CarId[]).forEach((cid) => {
      playerCarRigs[cid].group.visible = cid === propsRef.current.selectedCarId;
      playerAnchor.add(playerCarRigs[cid].group);
    });

    // 5. Object Pools: Traffic Vehicles, Coins, and Particle Ring Buffer
    const trafficArchetypes: { type: TrafficArchetype; color: number; hw: number; hl: number }[] = [
      { type: 'sedan', color: 0x64748b, hw: 0.95, hl: 2.1 },
      { type: 'suv', color: 0x3b82f6, hw: 0.98, hl: 2.15 },
      { type: 'sport', color: 0xe11d48, hw: 0.95, hl: 2.1 },
      { type: 'truck', color: 0xd97706, hw: 1.05, hl: 2.6 },
      { type: 'sedan', color: 0xcbd5e1, hw: 0.95, hl: 2.1 },
      { type: 'suv', color: 0x0d9488, hw: 0.98, hl: 2.15 },
    ];

    const trafficPool: PooledTrafficItem[] = [];
    for (let i = 0; i < 14; i++) {
      const spec = trafficArchetypes[i % trafficArchetypes.length];
      const mesh = buildTrafficVehicleMesh(spec.type, spec.color);
      mesh.visible = false;
      scene.add(mesh);
      trafficPool.push({
        mesh,
        active: false,
        laneIndex: 0,
        x: 0,
        z: -200,
        speedMs: 22,
        halfWidth: spec.hw,
        halfLength: spec.hl,
        nearMissScored: false,
      });
    }

    const coinPool: PooledCoinItem[] = [];
    for (let i = 0; i < 18; i++) {
      const mesh = buildCoinPickupMesh();
      mesh.visible = false;
      scene.add(mesh);
      coinPool.push({
        mesh,
        active: false,
        x: 0,
        z: -200,
      });
    }

    // Zero-GC Particle Pool (InstancedMesh)
    const maxParticles = 48;
    const partGeo = new THREE.BoxGeometry(0.14, 0.14, 0.42);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInst = new THREE.InstancedMesh(partGeo, partMat, maxParticles);
    particleInst.frustumCulled = false;
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
      maxLife: 0.4,
      scale: 1,
      colorHex: 0x38bdf8,
    }));
    let particleCursor = 0;

    function spawnParticleBurst(
      x: number,
      y: number,
      z: number,
      count: number,
      colorHex: number,
      spreadSpeed: number
    ) {
      for (let i = 0; i < count; i++) {
        const p = particles[particleCursor];
        particleCursor = (particleCursor + 1) % maxParticles;
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.6;
        p.y = y + (Math.random() - 0.5) * 0.3;
        p.z = z + (Math.random() - 0.5) * 0.6;
        p.vx = (Math.random() - 0.5) * spreadSpeed;
        p.vy = Math.random() * spreadSpeed * 0.7 + 1.2;
        p.vz = Math.random() * spreadSpeed + 6;
        p.life = 0;
        p.maxLife = 0.28 + Math.random() * 0.25;
        p.scale = 0.7 + Math.random() * 0.8;
        p.colorHex = colorHex;
      }
    }

    // Pre-compile shaders once to avoid first-frame stutter
    renderer.compile(scene, camera);

    // 6. Mutable Simulation State
    const sim = {
      previousGameState: 'title' as GameLifecycleState,
      runIdCounter: 1,
      currentRunId: 'run-init',
      playerX: -1.75,
      lateralVelocity: 0,
      speedMs: 24,
      topSpeedReachedKmh: 86,
      distanceMeters: 0,
      coinsCollected: 0,
      nearMissCount: 0,
      bonusScore: 0,
      nitroAmount: 1.0,
      isNitroActive: false,
      integrity: HIGHWAY_CONFIG.maxHullIntegrity,
      invulnerableTimer: 0,
      hitstopTimer: 0,
      defeatDelayTimer: 0,
      isDying: false,
      reviveUsed: false,
      countdownTimer: 0,
      lastReportedCountdown: null as number | null,
      scrollOffsetZ: 0,
      spawnWaveCooldownZ: 30,
      coinSpawnCooldownZ: 18,
      filteredTiltSteer: 0,
      cameraTrauma: 0,
      garageYawRad: 0.55,
      titleOrbitTime: 0,
      shieldFlashTimer: 0,
      bannerIdCounter: 1,
    };

    function syncLiveHudSnapshot(
      banner?: { text: string; subtext: string; tone: 'cyan' | 'amber' | 'danger' } | null
    ) {
      propsRef.current.onLiveStateChange({
        integrity: sim.integrity,
        maxIntegrity: HIGHWAY_CONFIG.maxHullIntegrity,
        countdownValue: sim.lastReportedCountdown,
        nearMissCount: sim.nearMissCount,
        comboBanner: banner
          ? { ...banner, id: ++sim.bannerIdCounter }
          : null,
        reviveUsed: sim.reviveUsed,
      });
    }

    function resetRaceSimulation() {
      sim.runIdCounter++;
      sim.currentRunId = `run-${Date.now()}-${sim.runIdCounter}`;
      sim.playerX = -1.75; // Spawn cleanly in Left-Center lane
      sim.lateralVelocity = 0;
      sim.speedMs = HIGHWAY_CONFIG.baseMinSpeedKmh / 3.6;
      sim.topSpeedReachedKmh = HIGHWAY_CONFIG.baseMinSpeedKmh;
      sim.distanceMeters = 0;
      sim.coinsCollected = 0;
      sim.nearMissCount = 0;
      sim.bonusScore = 0;
      sim.nitroAmount = 1.0;
      sim.isNitroActive = false;
      sim.integrity = HIGHWAY_CONFIG.maxHullIntegrity;
      sim.invulnerableTimer = 2.0; // Safe opening grace window
      sim.hitstopTimer = 0;
      sim.defeatDelayTimer = 0;
      sim.isDying = false;
      sim.reviveUsed = false;
      sim.countdownTimer = 1.6; // Quick, snappy 3-2-1-GO!
      sim.lastReportedCountdown = 3;
      sim.spawnWaveCooldownZ = 35;
      sim.coinSpawnCooldownZ = 16;
      sim.cameraTrauma = 0;
      sim.shieldFlashTimer = 0;

      playerAnchor.position.set(sim.playerX, 0, 0);
      playerAnchor.rotation.set(0, 0, 0);

      // Clear active traffic & coins and seed an initial open vista ahead
      for (const t of trafficPool) {
        t.active = false;
        t.mesh.visible = false;
      }
      for (const c of coinPool) {
        c.active = false;
        c.mesh.visible = false;
      }

      // Spawn initial fair traffic vehicles well ahead (-75m and -125m)
      spawnTrafficWaveAtZ(-75, 0.1);
      spawnTrafficWaveAtZ(-125, 0.15);
      spawnCoinLineAtZ(-48, 1);
      spawnCoinLineAtZ(-95, 2);

      syncLiveHudSnapshot(null);
      soundController.startEngine();
      soundController.playCountdownTick(false);
    }

    function performRevive() {
      if (sim.reviveUsed) return;
      sim.reviveUsed = true;
      sim.isDying = false;
      sim.defeatDelayTimer = 0;
      sim.hitstopTimer = 0;
      sim.integrity = HIGHWAY_CONFIG.maxHullIntegrity;
      sim.invulnerableTimer = 3.0;
      sim.speedMs = Math.max(25, sim.speedMs * 0.75);
      sim.nitroAmount = 1.0;

      // Clear any traffic within 65m of player so revive is 100% fair
      for (const t of trafficPool) {
        if (t.active && t.z > -65) {
          t.active = false;
          t.mesh.visible = false;
        }
      }
      syncLiveHudSnapshot({
        text: 'HULL RESTORED',
        subtext: 'Temporary Shield Active',
        tone: 'cyan',
      });
      soundController.startEngine();
      soundController.playNitroActivate();
    }

    controlsRef.current.triggerRevive = performRevive;
    controlsRef.current.triggerRestart = resetRaceSimulation;
    controlsRef.current.rotateGarageTurntable = (deltaRad: number) => {
      sim.garageYawRad += deltaRad;
    };

    function spawnTrafficWaveAtZ(spawnZ: number, difficulty01: number) {
      const lanes = selectFairTrafficLanes(HIGHWAY_CONFIG.laneCount, difficulty01);
      for (const laneIdx of lanes) {
        const laneX = HIGHWAY_CONFIG.laneCenters[laneIdx];
        // Ensure no existing active traffic is too close in the same lane
        const tooClose = trafficPool.some(
          (t) =>
            t.active &&
            t.laneIndex === laneIdx &&
            Math.abs(t.z - spawnZ) < HIGHWAY_CONFIG.minLongitudinalGap
        );
        if (tooClose) continue;

        const freeSlot = trafficPool.find((t) => !t.active);
        if (!freeSlot) break;

        freeSlot.active = true;
        freeSlot.laneIndex = laneIdx;
        freeSlot.x = laneX;
        freeSlot.z = spawnZ + (Math.random() - 0.5) * 6;
        freeSlot.speedMs = 16 + Math.random() * 10 + difficulty01 * 8;
        freeSlot.nearMissScored = false;
        freeSlot.mesh.position.set(freeSlot.x, 0, freeSlot.z);
        freeSlot.mesh.visible = true;
      }
    }

    function spawnCoinLineAtZ(startZ: number, preferredLane?: number) {
      const laneIdx =
        preferredLane !== undefined
          ? preferredLane
          : Math.floor(Math.random() * HIGHWAY_CONFIG.laneCount);
      const laneX = HIGHWAY_CONFIG.laneCenters[laneIdx];

      for (let i = 0; i < 4; i++) {
        const zPos = startZ - i * 5.2;
        const blockedByTraffic = trafficPool.some(
          (t) => t.active && Math.abs(t.x - laneX) < 1.2 && Math.abs(t.z - zPos) < 4.5
        );
        if (blockedByTraffic) continue;

        const freeCoin = coinPool.find((c) => !c.active);
        if (!freeCoin) break;
        freeCoin.active = true;
        freeCoin.x = laneX;
        freeCoin.z = zPos;
        freeCoin.mesh.position.set(freeCoin.x, 0, freeCoin.z);
        freeCoin.mesh.visible = true;
      }
    }

    // Seed ambient highway scene for Title Screen
    spawnTrafficWaveAtZ(-45, 0.1);
    spawnTrafficWaveAtZ(-95, 0.2);
    spawnCoinLineAtZ(-35, 2);

    // 7. Keyboard, DeviceOrientation Tilt, and Pointer Input Listeners
    const keysPressed = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      const code = e.code;
      if (
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'Space'
      ) {
        if (propsRef.current.gameState === 'playing') {
          e.preventDefault();
        }
      }

      if ((code === 'KeyP' || code === 'Escape') && !e.repeat) {
        if (
          propsRef.current.gameState === 'playing' ||
          propsRef.current.gameState === 'paused'
        ) {
          propsRef.current.onRequestPauseToggle();
          return;
        }
      }

      keysPressed.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const clearHeldInputs = () => {
      keysPressed.clear();
      controlsRef.current.steerLeftHeld = false;
      controlsRef.current.steerRightHeld = false;
      controlsRef.current.nitroHeld = false;
      controlsRef.current.brakeHeld = false;
      controlsRef.current.dragSteerNormalized = 0;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearHeldInputs();
        soundController.updateEngine(0, false, true);
      }
    };

    // DeviceOrientation Sensor Listener for Mobile Tilt Steering
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null && e.gamma === null) return;
      controlsRef.current.hasRealDeviceOrientation = true;

      // Determine landscape vs portrait axis safely across Android & iOS
      const angle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      let rawTilt = 0;
      if (angle === 90) {
        rawTilt = e.beta ?? 0;
      } else if (angle === -90 || angle === 270) {
        rawTilt = -(e.beta ?? 0);
      } else {
        // Default portrait or desktop orientation sensor emulation
        rawTilt = e.gamma ?? e.beta ?? 0;
      }
      controlsRef.current.lastRawDeviceTiltDeg = Math.max(-60, Math.min(60, rawTilt));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('deviceorientation', onDeviceOrientation);

    // ResizeObserver for responsive full-viewport canvas
    const updateCanvasSize = () => {
      const w = Math.max(1, container.clientWidth || window.innerWidth);
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, true);
    };
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', updateCanvasSize);
    updateCanvasSize();

    // 8. Main Animation & Physics Loop
    let rafId = 0;
    let lastTimeMs = performance.now();
    let hudUpdateAccum = 0;

    const animate = (nowMs: number) => {
      rafId = requestAnimationFrame(animate);

      const currentProps = propsRef.current;
      const rawDt = (nowMs - lastTimeMs) / 1000;
      // In headless Chromium, throttle render loop so software WebGL never blocks DOM click actionability
      if (isHeadless) {
        const minFrameInterval = currentProps.gameState === 'playing' ? 0.08 : 0.22;
        if (rawDt < minFrameInterval) {
          return;
        }
      }
      lastTimeMs = nowMs;
      const dt = Math.min(Math.max(0.001, rawDt), 0.05);

      // Detect state transition into 'playing' from 'title' or 'gameover'
      if (
        currentProps.gameState === 'playing' &&
        sim.previousGameState !== 'playing' &&
        sim.previousGameState !== 'paused'
      ) {
        resetRaceSimulation();
      }
      sim.previousGameState = currentProps.gameState;

      // Toggle visible player car rig if selectedCarId changed
      (Object.keys(playerCarRigs) as CarId[]).forEach((cid) => {
        playerCarRigs[cid].group.visible = cid === currentProps.selectedCarId;
      });
      const activeCarRig = playerCarRigs[currentProps.selectedCarId];

      // Update showroom turntable visibility
      turntableGroup.visible =
        currentProps.gameState === 'title' && currentProps.isGarageOpen;
      if (turntableGroup.visible) {
        turntableGroup.position.set(playerAnchor.position.x, 0, playerAnchor.position.z);
      }

      // Update countdown if in playing state
      if (currentProps.gameState === 'playing' && sim.countdownTimer > 0) {
        sim.countdownTimer = Math.max(0, sim.countdownTimer - dt);
        const step =
          sim.countdownTimer > 1.1
            ? 3
            : sim.countdownTimer > 0.6
              ? 2
              : sim.countdownTimer > 0.15
                ? 1
                : 0;
        if (step !== sim.lastReportedCountdown) {
          sim.lastReportedCountdown = step;
          soundController.playCountdownTick(step === 0);
          syncLiveHudSnapshot(null);
        }
        if (sim.countdownTimer === 0 && sim.lastReportedCountdown !== null) {
          sim.lastReportedCountdown = null;
          syncLiveHudSnapshot(null);
        }
      }

      // Hitstop & Defeat transition handling
      if (sim.hitstopTimer > 0) {
        sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
      }

      if (sim.isDying && currentProps.gameState === 'playing') {
        sim.defeatDelayTimer = Math.max(0, sim.defeatDelayTimer - dt);
        if (sim.defeatDelayTimer === 0) {
          sim.isDying = false;
          soundController.updateEngine(0, false, true);
          const summary = calculateRunRewards({
            distanceMeters: sim.distanceMeters,
            coinsCollected: sim.coinsCollected,
            nearMissCount: sim.nearMissCount,
            bonusScore: sim.bonusScore,
          });
          currentProps.onRunEnded({
            runId: sim.currentRunId,
            summary,
            nearMissCount: sim.nearMissCount,
            topSpeedKmh: Math.round(sim.topSpeedReachedKmh),
            reviveAvailable: !sim.reviveUsed,
          });
        }
      }

      const isSimRunning =
        currentProps.gameState === 'playing' && !sim.isDying && sim.hitstopTimer <= 0;
      const isAmbientMenuScroll = currentProps.gameState === 'title';

      // --- A. ACTIVE GAMEPLAY OR AMBIENT MENU SIMULATION ---
      if (isSimRunning) {
        const effectiveStats = getEffectiveCarStats(
          currentProps.selectedCarId,
          currentProps.carUpgrades
        );

        // 1. Evaluate Steering Input (Keyboard + Selected Control Mode)
        let kbSteer = 0;
        if (keysPressed.has('ArrowLeft') || keysPressed.has('KeyA')) kbSteer -= 1;
        if (keysPressed.has('ArrowRight') || keysPressed.has('KeyD')) kbSteer += 1;

        let touchButtonSteer = 0;
        if (controlsRef.current.steerLeftHeld) touchButtonSteer -= 1;
        if (controlsRef.current.steerRightHeld) touchButtonSteer += 1;

        const rawTiltSource = controlsRef.current.hasRealDeviceOrientation
          ? controlsRef.current.lastRawDeviceTiltDeg
          : controlsRef.current.simulatedTiltDeg;

        sim.filteredTiltSteer = processTiltInput({
          rawAngleDeg: rawTiltSource,
          neutralOffsetDeg: currentProps.neutralTiltOffsetDeg,
          previousFilteredInput: sim.filteredTiltSteer,
          sensitivity: currentProps.sensitivity,
          invertTilt: currentProps.invertTilt,
          smoothingFactor: Math.min(1, dt * 14),
        });

        let activeSteerInput = kbSteer || touchButtonSteer;
        if (activeSteerInput === 0) {
          if (currentProps.steeringMode === 'tilt') {
            activeSteerInput = sim.filteredTiltSteer;
          } else if (currentProps.steeringMode === 'drag') {
            activeSteerInput = controlsRef.current.dragSteerNormalized;
          }
        }

        // 2. Evaluate Nitro & Brake Input
        const nitroWanted =
          keysPressed.has('Space') ||
          keysPressed.has('KeyW') ||
          keysPressed.has('ArrowUp') ||
          controlsRef.current.nitroHeld;
        const brakeWanted =
          keysPressed.has('KeyS') ||
          keysPressed.has('ArrowDown') ||
          controlsRef.current.brakeHeld;

        if (nitroWanted && sim.nitroAmount > 0.04) {
          if (!sim.isNitroActive) {
            soundController.playNitroActivate();
          }
          sim.isNitroActive = true;
          sim.nitroAmount = Math.max(
            0,
            sim.nitroAmount - dt / Math.max(1.5, effectiveStats.nitroCapacity)
          );
        } else {
          sim.isNitroActive = false;
          sim.nitroAmount = Math.min(
            1,
            sim.nitroAmount + dt * HIGHWAY_CONFIG.nitroRechargeRatePerSec
          );
        }

        // 3. Longitudinal Speed & Lateral Movement
        const targetMaxMs = sim.isNitroActive
          ? effectiveStats.nitroSpeedMs
          : effectiveStats.topSpeedMs;
        if (brakeWanted && !sim.isNitroActive) {
          sim.speedMs = Math.max(
            HIGHWAY_CONFIG.baseMinSpeedKmh / 3.6,
            sim.speedMs - effectiveStats.acceleration * 1.9 * dt
          );
        } else {
          const accelRate = sim.isNitroActive
            ? effectiveStats.acceleration * 2.1
            : effectiveStats.acceleration * 0.85;
          sim.speedMs = Math.min(targetMaxMs, sim.speedMs + accelRate * dt);
        }

        const currentSpeedKmh = sim.speedMs * 3.6;
        if (currentSpeedKmh > sim.topSpeedReachedKmh) {
          sim.topSpeedReachedKmh = currentSpeedKmh;
        }

        const targetLatVel = activeSteerInput * effectiveStats.handling;
        sim.lateralVelocity = THREE.MathUtils.damp(
          sim.lateralVelocity,
          targetLatVel,
          14,
          dt
        );
        sim.playerX = THREE.MathUtils.clamp(
          sim.playerX + sim.lateralVelocity * dt,
          -HIGHWAY_CONFIG.playerBoundX,
          HIGHWAY_CONFIG.playerBoundX
        );

        playerAnchor.position.x = sim.playerX;

        // Animate vehicle chassis roll, pitch, and wheel spin
        const normSteer = THREE.MathUtils.clamp(
          sim.lateralVelocity / Math.max(1, effectiveStats.handling),
          -1,
          1
        );
        activeCarRig.bodyGroup.rotation.z = THREE.MathUtils.damp(
          activeCarRig.bodyGroup.rotation.z,
          -normSteer * 0.15,
          16,
          dt
        );
        activeCarRig.bodyGroup.rotation.y = THREE.MathUtils.damp(
          activeCarRig.bodyGroup.rotation.y,
          -normSteer * 0.14,
          16,
          dt
        );
        activeCarRig.bodyGroup.rotation.x = THREE.MathUtils.damp(
          activeCarRig.bodyGroup.rotation.x,
          sim.isNitroActive ? -0.035 : brakeWanted ? 0.03 : 0,
          14,
          dt
        );

        for (const w of activeCarRig.wheels) {
          w.rotation.x -= sim.speedMs * dt * 1.8;
        }
        for (const flame of activeCarRig.nitroFlames) {
          flame.visible = sim.isNitroActive;
          if (sim.isNitroActive) {
            const flicker = 0.85 + Math.random() * 0.35;
            flame.scale.set(1, flicker, 1);
          }
        }

        if (sim.isNitroActive && Math.random() < 0.55) {
          spawnParticleBurst(sim.playerX, 0.3, 2.3, 1, 0x38bdf8, 3.5);
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
            sim.invulnerableTimer > 0 ? 0.18 : 0;
        }

        // 4. Advance Distance, Road Scroll, Spawners, and Collisions
        const stepDist = sim.speedMs * dt;
        sim.distanceMeters += stepDist;
        sim.scrollOffsetZ += stepDist;

        // Progressive difficulty factor (0.0 -> 1.0 over 2,500m)
        const difficulty01 = Math.min(1, sim.distanceMeters / 2500);

        sim.spawnWaveCooldownZ -= stepDist;
        if (sim.spawnWaveCooldownZ <= 0) {
          const baseGap = 52 - difficulty01 * 20;
          sim.spawnWaveCooldownZ = Math.max(28, baseGap + Math.random() * 14);
          spawnTrafficWaveAtZ(-140, difficulty01);
        }

        sim.coinSpawnCooldownZ -= stepDist;
        if (sim.coinSpawnCooldownZ <= 0) {
          sim.coinSpawnCooldownZ = 38 + Math.random() * 22;
          spawnCoinLineAtZ(-135);
        }

        const playerBox = {
          x: sim.playerX,
          z: 0,
          halfWidth: 0.92,
          halfLength: 2.05,
        };

        // Update Traffic Pool
        for (const t of trafficPool) {
          if (!t.active) continue;
          const relSpeed = sim.speedMs - t.speedMs;
          t.z += relSpeed * dt;
          t.mesh.position.set(t.x, 0, t.z);

          if (t.z > HIGHWAY_CONFIG.despawnDistanceBehind * -1 || t.z < -210) {
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
            sim.integrity = Math.max(0, sim.integrity - 1);
            sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.78);
            sim.shieldFlashTimer = 0.45;
            spawnParticleBurst(sim.playerX, 0.65, -1.2, 18, 0xf59e0b, 9);

            if (sim.integrity <= 0) {
              // Fatal collision -> hitstop + short KO transition
              soundController.playCollision(true);
              sim.hitstopTimer = 0.06;
              sim.isDying = true;
              sim.defeatDelayTimer = 0.45;
              syncLiveHudSnapshot({
                text: 'CRITICAL IMPACT',
                subtext: 'Hull Integrity Depleted',
                tone: 'danger',
              });
            } else {
              // Non-fatal shield impact -> push traffic vehicle away and grant brief invulnerability
              soundController.playCollision(false);
              sim.hitstopTimer = 0.04;
              sim.invulnerableTimer = 1.4;
              sim.speedMs = Math.max(20, sim.speedMs * 0.72);
              t.active = false;
              t.mesh.visible = false;
              syncLiveHudSnapshot({
                text: 'SHIELD IMPACT',
                subtext: `${sim.integrity} Hull Integrity Remaining`,
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

        // Update Coins Pool
        for (const c of coinPool) {
          if (!c.active) continue;
          c.z += sim.speedMs * dt;
          c.mesh.position.set(c.x, 0, c.z);
          c.mesh.children[1].rotation.y += dt * 3.4;

          if (c.z > 18) {
            c.active = false;
            c.mesh.visible = false;
            continue;
          }

          if (Math.abs(c.z) < 2.2 && Math.abs(c.x - sim.playerX) < 1.55) {
            c.active = false;
            c.mesh.visible = false;
            sim.coinsCollected += 1;
            soundController.playCoinPickup();
            spawnParticleBurst(c.x, 0.85, c.z, 6, 0xfbbf24, 4.5);
          }
        }

        soundController.updateEngine(currentSpeedKmh, sim.isNitroActive, false);
      } else if (isAmbientMenuScroll) {
        // Ambient highway cruise on Title / Garage screen
        const menuSpeedMs = currentProps.isGarageOpen ? 0 : 24;
        sim.scrollOffsetZ += menuSpeedMs * dt;
        // Stage hero car in right-center lane (+1.75) on Title Screen so left-third Title Card sits over calm negative space
        sim.playerX = THREE.MathUtils.damp(
          sim.playerX,
          currentProps.isGarageOpen ? 0 : 1.75,
          6,
          dt
        );
        playerAnchor.position.x = sim.playerX;
        activeCarRig.bodyGroup.rotation.set(0, 0, 0);
        for (const flame of activeCarRig.nitroFlames) {
          flame.visible = false;
        }
        for (const w of activeCarRig.wheels) {
          w.rotation.x -= menuSpeedMs * dt * 1.5;
        }
        soundController.updateEngine(0, false, true);
      } else {
        // Paused or GameOver
        soundController.updateEngine(0, false, true);
      }

      // --- B. UPDATE SCROLLING ROAD, ARCHES, SKYLINE & PARTICLES ---
      albedoMap.offset.y = -(sim.scrollOffsetZ * 0.065) % 1;
      roughnessMap.offset.y = -(sim.scrollOffsetZ * 0.065) % 1;

      const archSpacing = 12;
      const archWrapSpan = archCount * archSpacing;
      for (let i = 0; i < archCount; i++) {
        const z =
          ((i * archSpacing + sim.scrollOffsetZ) % archWrapSpan) - archWrapSpan + 24;

        // Left pillar & lamp
        _dummy.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5 - 0.6, 3.75, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        archPillarsInst.setMatrixAt(i * 2, _dummy.matrix);

        _dummy.position.set(-HIGHWAY_CONFIG.roadWidth * 0.5 + 0.3, 7.4, z);
        _dummy.updateMatrix();
        lampHeadsInst.setMatrixAt(i * 2, _dummy.matrix);

        // Right pillar & lamp
        _dummy.position.set(HIGHWAY_CONFIG.roadWidth * 0.5 + 0.6, 3.75, z);
        _dummy.updateMatrix();
        archPillarsInst.setMatrixAt(i * 2 + 1, _dummy.matrix);

        _dummy.position.set(HIGHWAY_CONFIG.roadWidth * 0.5 - 0.3, 7.4, z);
        _dummy.updateMatrix();
        lampHeadsInst.setMatrixAt(i * 2 + 1, _dummy.matrix);
      }
      archPillarsInst.instanceMatrix.needsUpdate = true;
      lampHeadsInst.instanceMatrix.needsUpdate = true;

      const towerSpan = 240;
      for (let i = 0; i < towerCount; i++) {
        const tm = towerMeta[i];
        const z =
          (((tm.zOffset + sim.scrollOffsetZ * 0.45) % towerSpan) + towerSpan) %
            towerSpan -
          200;
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

      // --- C. SMOOTH CAMERA RIG CHOREOGRAPHY ---
      sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 2.2);
      const shakeMag = sim.cameraTrauma * sim.cameraTrauma * 0.35;
      const shakeX = (Math.random() - 0.5) * shakeMag;
      const shakeY = (Math.random() - 0.5) * shakeMag;

      if (currentProps.gameState === 'title' && currentProps.isGarageOpen) {
        // Garage Turntable Camera: Orbit around the showcased vehicle in the upper-center viewport
        sim.garageYawRad += dt * 0.35;
        const radius = 5.2;
        _targetCamPos.set(
          playerAnchor.position.x + Math.sin(sim.garageYawRad) * radius,
          2.1,
          Math.cos(sim.garageYawRad) * radius
        );
        _desiredCamLook.set(playerAnchor.position.x, 0.25, 0);
        camera.fov = THREE.MathUtils.damp(camera.fov, 50, 8, dt);
      } else if (currentProps.gameState === 'title') {
        // Live World Hero Camera on Title Screen: Frame car on the right side of viewport
        sim.titleOrbitTime += dt * 0.45;
        _targetCamPos.set(
          -0.6 + Math.sin(sim.titleOrbitTime) * 0.35,
          2.25,
          5.2 + Math.cos(sim.titleOrbitTime) * 0.4
        );
        _desiredCamLook.set(0.4, 0.85, -14);
        camera.fov = THREE.MathUtils.damp(camera.fov, 58, 8, dt);
      } else {
        // Third-Person Chase Camera positioned behind and slightly above player's car
        const chaseX = sim.playerX * 0.72 + shakeX;
        const chaseY = (sim.isNitroActive ? 2.75 : 3.05) + shakeY;
        const chaseZ = sim.isNitroActive ? 6.1 : 6.75;
        _targetCamPos.set(chaseX, chaseY, chaseZ);
        _desiredCamLook.set(sim.playerX * 0.88, 0.95, -22);
        const targetFov = sim.isNitroActive
          ? 74
          : 60 + Math.min(10, (sim.speedMs - 20) * 0.18);
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
          sim.coinsCollected * HIGHWAY_CONFIG.coinPickupScore;
        const liveCoinsEarned =
          sim.coinsCollected * HIGHWAY_CONFIG.coinPickupValue +
          Math.floor(distInt / 25) +
          sim.nearMissCount * HIGHWAY_CONFIG.nearMissCoinBonus;

        if (refs.speedValueRef.current) {
          refs.speedValueRef.current.textContent = String(speedKmhInt);
        }
        if (refs.distanceValueRef.current) {
          refs.distanceValueRef.current.textContent = `${distInt}m`;
        }
        if (refs.scoreValueRef.current) {
          refs.scoreValueRef.current.textContent = String(liveScore);
        }
        if (refs.coinsValueRef.current) {
          refs.coinsValueRef.current.textContent = String(liveCoinsEarned);
        }
        if (refs.nitroFillRef.current) {
          const pct = Math.round(sim.nitroAmount * 100);
          refs.nitroFillRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, sim.nitroAmount))})`;
          if (refs.nitroPctRef.current) {
            refs.nitroPctRef.current.textContent = `${pct}%`;
          }
        }
        if (refs.tiltAngleBadgeRef.current) {
          const deg = Math.round(
            (controlsRef.current.hasRealDeviceOrientation
              ? controlsRef.current.lastRawDeviceTiltDeg
              : controlsRef.current.simulatedTiltDeg) -
              currentProps.neutralTiltOffsetDeg
          );
          refs.tiltAngleBadgeRef.current.textContent = `${deg > 0 ? '+' : ''}${deg}°`;
        }
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      soundController.stopEngine();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#090d18] select-none"
      aria-label="Velocity Rush 3D Highway Viewport"
    />
  );
};
