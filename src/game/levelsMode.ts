import { CAR_ORDER, type CarId, HIGHWAY_CONFIG } from './config.ts';

export type TrackSegmentType =
  | 'start_grid'
  | 'straight'
  | 'gentle_curve_left'
  | 'gentle_curve_right'
  | 'sweeping_bend_left'
  | 'sweeping_bend_right'
  | 'drift_s_bend'
  | 'tunnel_passage'
  | 'chicane_barriers'
  | 'finish_straight';

export interface TrackSegmentSpec {
  index: number;
  type: TrackSegmentType;
  label: string;
  startDist: number;
  endDist: number;
  length: number;
  curvature: number; // -1 (sharp left) .. 0 (straight) .. +1 (sharp right)
  isTunnel: boolean;
  isDriftZone: boolean;
}

export type LevelHazardType = 'barrier_block' | 'chevron_chicane' | 'energy_pylon';

export interface LevelCourseObstacle {
  id: number;
  distanceMeters: number; // longitudinal position from start line (0 .. totalLengthMeters)
  laneIndex: number;      // 0..3
  x: number;              // lateral road coordinate
  halfWidth: number;
  halfLength: number;
  type: LevelHazardType;
}

export interface LevelCourseCoin {
  id: number;
  distanceMeters: number;
  x: number;
  collected: boolean;
}

export interface GeneratedLevelCourse {
  levelNumber: number;
  seed: number;
  title: string;
  subtitle: string;
  totalLengthMeters: number;
  segments: TrackSegmentSpec[];
  obstacles: LevelCourseObstacle[];
  coins: LevelCourseCoin[];
  recommendedTopSpeedKmh: number;
  baseFirstPlaceReward: number;
}

export interface AiOpponentState {
  id: string;
  driverName: string;
  carId: CarId;
  paintColorHex: number;
  gridSlot: number; // 1..5
  distanceMeters: number;
  x: number;
  targetLaneIndex: number;
  speedMs: number;
  lateralVelocity: number;
  baseTopSpeedMs: number;
  accelMs2: number;
  corneringSkill: number;     // 0.7..1.0
  lookaheadMeters: number;    // 45..85m
  aggression: number;         // 0.3..0.9
  nitroTimer: number;
  nitroCooldown: number;
  isNitroActive: boolean;
  hitCooldown: number;
  finished: boolean;
  finishTimeSec: number | null;
}

export interface RacerStandingEntry {
  id: string; // 'player' or AI id
  name: string;
  carId: CarId;
  isPlayer: boolean;
  position: number; // 1..6
  distanceMeters: number;
  progress01: number;
  finished: boolean;
  finishTimeSec: number | null;
}

export interface LevelRaceRewardsBreakdown {
  levelNumber: number;
  position: number;
  positionPrizeCoins: number;
  pickupCoins: number;
  cleanRaceBonusCoins: number;
  driftBonusCoins: number;
  totalCoinsEarned: number;
  totalScore: number;
  qualifiedForNextLevel: boolean;
}

/**
 * Deterministic 32-bit Mulberry32 PRNG for reproducible procedural courses.
 */
export function createSeededRandom(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITY_SECTOR_NAMES = [
  'Neo-Harbor Expressway',
  'Midtown Skyway Circuit',
  'Cyber-Bay Tunnel Loop',
  'Apex Financial Viaduct',
  'Solstice Bayfront Sprint',
  'Valkyrie Industrial Ring',
  'Aethelgard Metro GP',
  'Horizon Cross-City Dash',
];

/**
 * Generates a complete, validated point-to-point course for any levelNumber >= 1.
 * Guarantees connected segments, sensible curvature, and fair obstacles that never block all lanes.
 */
export function generateLevelCourse(levelNumber: number): GeneratedLevelCourse {
  const safeLevel = Math.max(1, Math.floor(levelNumber));
  const seed = safeLevel * 2654435761;
  const rng = createSeededRandom(seed);

  const difficulty01 = Math.min(1, (safeLevel - 1) / 14);
  const sectorName = CITY_SECTOR_NAMES[(safeLevel - 1) % CITY_SECTOR_NAMES.length];
  const title = `Level ${safeLevel} · ${sectorName}`;
  const subtitle =
    safeLevel === 1
      ? 'Rookie Grid · Gentle Bends & Wide Lanes'
      : safeLevel <= 3
        ? 'Street Circuit · Sweeping Curves & Tunnel Sector'
        : safeLevel <= 6
          ? 'Pro Championship · Drift S-Bends & Chicane Gates'
          : 'Elite Hyper-Circuit · Technical Bends & High-Speed Hazards';

  const segments: TrackSegmentSpec[] = [];
  let cursorDist = 0;

  // 1. Start Grid Straight (95m)
  segments.push({
    index: 0,
    type: 'start_grid',
    label: 'Starting Grid',
    startDist: 0,
    endDist: 95,
    length: 95,
    curvature: 0,
    isTunnel: false,
    isDriftZone: false,
  });
  cursorDist = 95;

  // Number of middle segments scales with level
  const middleSegmentCount = Math.min(14, 5 + Math.floor(safeLevel * 0.85));

  const candidateTypesLevel1: TrackSegmentType[] = [
    'gentle_curve_left',
    'straight',
    'gentle_curve_right',
    'tunnel_passage',
    'gentle_curve_left',
  ];

  const candidateTypesHigher: TrackSegmentType[] = [
    'gentle_curve_left',
    'gentle_curve_right',
    'sweeping_bend_left',
    'sweeping_bend_right',
    'drift_s_bend',
    'tunnel_passage',
    'chicane_barriers',
    'straight',
  ];

  for (let i = 0; i < middleSegmentCount; i++) {
    let segType: TrackSegmentType;
    if (safeLevel === 1) {
      segType = candidateTypesLevel1[i % candidateTypesLevel1.length];
    } else {
      const pool = candidateTypesHigher;
      segType = pool[Math.floor(rng() * pool.length)];
      // Avoid two consecutive tunnels
      if (segType === 'tunnel_passage' && segments[segments.length - 1]?.isTunnel) {
        segType = 'sweeping_bend_right';
      }
    }

    const segLength =
      segType === 'tunnel_passage'
        ? 180 + Math.floor(rng() * 50)
        : segType === 'drift_s_bend'
          ? 210 + Math.floor(rng() * 50)
          : 150 + Math.floor(rng() * 65);

    const maxCurveMag = safeLevel === 1 ? 0.38 : Math.min(0.92, 0.45 + difficulty01 * 0.45);
    let curvature = 0;
    let label = 'City Straight';
    let isTunnel = false;
    let isDriftZone = false;

    switch (segType) {
      case 'gentle_curve_left':
        curvature = -0.35;
        label = 'Westbound Curve';
        break;
      case 'gentle_curve_right':
        curvature = 0.35;
        label = 'Eastbound Curve';
        break;
      case 'sweeping_bend_left':
        curvature = -maxCurveMag;
        label = 'Apex Left Bend';
        isDriftZone = Math.abs(curvature) >= 0.5;
        break;
      case 'sweeping_bend_right':
        curvature = maxCurveMag;
        label = 'Apex Right Bend';
        isDriftZone = Math.abs(curvature) >= 0.5;
        break;
      case 'drift_s_bend':
        curvature = (i % 2 === 0 ? 1 : -1) * Math.max(0.58, maxCurveMag);
        label = 'Drift Hairpin Sector';
        isDriftZone = true;
        break;
      case 'tunnel_passage':
        curvature = (rng() - 0.5) * 0.25;
        label = 'Sub-Harbor Tunnel';
        isTunnel = true;
        break;
      case 'chicane_barriers':
        curvature = 0;
        label = 'Barrier Chicane Zone';
        break;
      default:
        curvature = 0;
        label = 'Expressway Straight';
        break;
    }

    segments.push({
      index: segments.length,
      type: segType,
      label,
      startDist: cursorDist,
      endDist: cursorDist + segLength,
      length: segLength,
      curvature,
      isTunnel,
      isDriftZone,
    });
    cursorDist += segLength;
  }

  // Final Finish Straight (120m)
  segments.push({
    index: segments.length,
    type: 'finish_straight',
    label: 'Finish Stretch',
    startDist: cursorDist,
    endDist: cursorDist + 120,
    length: 120,
    curvature: 0,
    isTunnel: false,
    isDriftZone: false,
  });
  const totalLengthMeters = cursorDist + 120;

  // 2. Generate Validated Non-Car Course Obstacles & Coins
  // Rule: Always leave at least 2 adjacent lanes completely open so every obstacle row is 100% passable.
  const obstacles: LevelCourseObstacle[] = [];
  const coins: LevelCourseCoin[] = [];
  let obstacleIdCounter = 1;
  let coinIdCounter = 1;

  const obstacleSpacing = Math.max(48, Math.round(92 - difficulty01 * 38));
  for (
    let dist = 165;
    dist < totalLengthMeters - 135;
    dist += obstacleSpacing + Math.floor(rng() * 18)
  ) {
    // Pick a guaranteed open pair of adjacent lanes (0&1, 1&2, or 2&3)
    const openPairStart = Math.floor(rng() * 3); // 0, 1, or 2
    const openLanes = new Set<number>([openPairStart, openPairStart + 1]);

    // Determine how many of the remaining 2 lanes get a hazard barrier (1 in Level 1, 1-2 in higher levels)
    const maxBlocked = safeLevel === 1 ? 1 : rng() < 0.45 + difficulty01 * 0.35 ? 2 : 1;
    let blockedCount = 0;

    for (let laneIdx = 0; laneIdx < HIGHWAY_CONFIG.laneCount; laneIdx++) {
      if (openLanes.has(laneIdx)) continue;
      if (blockedCount >= maxBlocked) continue;
      if (rng() < 0.78) {
        blockedCount++;
        const hazardType: LevelHazardType =
          safeLevel >= 3 && rng() < 0.4
            ? 'chevron_chicane'
            : safeLevel >= 5 && rng() < 0.35
              ? 'energy_pylon'
              : 'barrier_block';

        obstacles.push({
          id: obstacleIdCounter++,
          distanceMeters: dist,
          laneIndex: laneIdx,
          x: HIGHWAY_CONFIG.laneCenters[laneIdx],
          halfWidth: 1.15,
          halfLength: 0.9,
          type: hazardType,
        });
      }
    }

    // Place a line of collectible coins along one of the guaranteed open lanes!
    const coinLane = openPairStart + (rng() < 0.5 ? 0 : 1);
    const coinX = HIGHWAY_CONFIG.laneCenters[coinLane];
    for (let cStep = -12; cStep <= 12; cStep += 8) {
      coins.push({
        id: coinIdCounter++,
        distanceMeters: dist + cStep,
        x: coinX,
        collected: false,
      });
    }
  }

  const recommendedTopSpeedKmh = Math.min(325, 225 + (safeLevel - 1) * 8);
  const baseFirstPlaceReward = 220 + (safeLevel - 1) * 45;

  return {
    levelNumber: safeLevel,
    seed,
    title,
    subtitle,
    totalLengthMeters,
    segments,
    obstacles,
    coins,
    recommendedTopSpeedKmh,
    baseFirstPlaceReward,
  };
}

/**
 * Samples the procedural track at a given longitudinal distance (meters from start).
 */
export function sampleTrackAtDistance(
  course: GeneratedLevelCourse,
  distanceMeters: number
): {
  segment: TrackSegmentSpec;
  curvature: number;
  isTunnel: boolean;
  isDriftZone: boolean;
} {
  const clamped = Math.max(0, Math.min(course.totalLengthMeters, distanceMeters));
  for (let i = 0; i < course.segments.length; i++) {
    const seg = course.segments[i];
    if (clamped >= seg.startDist && clamped <= seg.endDist) {
      // Smooth curvature transition near segment boundaries (first/last 20m)
      const localProgress = clamped - seg.startDist;
      const distToEnd = seg.endDist - clamped;
      let effectiveCurvature = seg.curvature;

      if (seg.type === 'drift_s_bend') {
        // S-bend oscillates smoothly from +curvature to -curvature mid-segment
        const phase = (localProgress / Math.max(1, seg.length)) * Math.PI * 2;
        effectiveCurvature = Math.sin(phase) * seg.curvature;
      } else if (localProgress < 22 && i > 0) {
        const prevCurv = course.segments[i - 1].curvature;
        const t = localProgress / 22;
        effectiveCurvature = prevCurv + (seg.curvature - prevCurv) * t;
      } else if (distToEnd < 22 && i < course.segments.length - 1) {
        const nextCurv = course.segments[i + 1].curvature;
        const t = 1 - distToEnd / 22;
        effectiveCurvature = seg.curvature + (nextCurv - seg.curvature) * t;
      }

      return {
        segment: seg,
        curvature: effectiveCurvature,
        isTunnel: seg.isTunnel,
        isDriftZone: seg.isDriftZone,
      };
    }
  }

  const last = course.segments[course.segments.length - 1];
  return {
    segment: last,
    curvature: 0,
    isTunnel: false,
    isDriftZone: false,
  };
}

const AI_DRIVER_PROFILES = [
  { name: 'Viper-01', paintHex: 0xef4444, aggression: 0.78, cornering: 0.94 },
  { name: 'Apex-02', paintHex: 0xf59e0b, aggression: 0.68, cornering: 0.9 },
  { name: 'Nova-03', paintHex: 0xec4899, aggression: 0.62, cornering: 0.86 },
  { name: 'Pulse-04', paintHex: 0x10b981, aggression: 0.54, cornering: 0.83 },
  { name: 'Krono-05', paintHex: 0x8b5cf6, aggression: 0.48, cornering: 0.8 },
];

/**
 * Creates the 5 distinct AI racing opponents for a Levels Mode race (6 cars total with player).
 */
export function createLevelAiOpponents(
  levelNumber: number,
  playerEffectiveTopSpeedMs: number
): AiOpponentState[] {
  const safeLevel = Math.max(1, Math.floor(levelNumber));
  const rng = createSeededRandom(safeLevel * 987654321);
  const difficultyScale = Math.min(1.12, 0.86 + (safeLevel - 1) * 0.022);

  // Reference speed blends level progression with player's car tier so races stay fair and exciting
  const baseRefSpeedMs = Math.max(
    56,
    Math.min(playerEffectiveTopSpeedMs * 1.01, (218 + (safeLevel - 1) * 6.5) / 3.6)
  );

  return AI_DRIVER_PROFILES.map((profile, idx) => {
    const gridSlot = idx + 1; // 1..5
    const carIdx = (safeLevel + idx) % CAR_ORDER.length;
    const carId = CAR_ORDER[carIdx];

    // Spread the 5 AI opponents from fastest contender (slot 1) to rookie contender (slot 5)
    const slotSpeedFactor = 1.02 - idx * 0.032 + (rng() - 0.5) * 0.015;
    const aiTopSpeedMs = baseRefSpeedMs * difficultyScale * slotSpeedFactor;

    const startLane = idx % HIGHWAY_CONFIG.laneCount;
    const startX = HIGHWAY_CONFIG.laneCenters[startLane] + (idx === 4 ? 0.6 : 0);
    const startDist = 6 + (4 - idx) * 5.5; // Staggered starting grid ahead of player (player at 0m)

    return {
      id: `ai_racer_${gridSlot}`,
      driverName: profile.name,
      carId,
      paintColorHex: profile.paintHex,
      gridSlot,
      distanceMeters: startDist,
      x: startX,
      targetLaneIndex: startLane,
      speedMs: HIGHWAY_CONFIG.launchSpeedKmh / 3.6,
      lateralVelocity: 0,
      baseTopSpeedMs: aiTopSpeedMs,
      accelMs2: 2.8 + (5 - idx) * 0.28 + Math.min(1.2, safeLevel * 0.08),
      corneringSkill: profile.cornering,
      lookaheadMeters: 52 + (5 - idx) * 6,
      aggression: profile.aggression,
      nitroTimer: 0,
      nitroCooldown: 4 + idx * 1.3,
      isNitroActive: false,
      hitCooldown: 0,
      finished: false,
      finishTimeSec: null,
    };
  });
}

/**
 * Steps a single AI opponent for one physics frame:
 * - Scans upcoming course obstacles within lookaheadMeters and steers into open lanes.
 * - Overtakes slower vehicles when current lane is occupied.
 * - Adjusts speed naturally through tight curves according to corneringSkill.
 * - Uses controlled nitro bursts on straights.
 */
export function stepAiOpponent(params: {
  ai: AiOpponentState;
  allOpponents: AiOpponentState[];
  playerX: number;
  playerDist: number;
  course: GeneratedLevelCourse;
  elapsedRaceSec: number;
  dt: number;
}): void {
  const { ai, allOpponents, playerX, playerDist, course, elapsedRaceSec, dt } = params;
  if (ai.finished) {
    // Gently coast after crossing the finish line
    ai.speedMs = Math.max(25, ai.speedMs - 8 * dt);
    ai.distanceMeters += ai.speedMs * dt;
    return;
  }

  if (ai.hitCooldown > 0) {
    ai.hitCooldown = Math.max(0, ai.hitCooldown - dt);
  }

  const trackSample = sampleTrackAtDistance(course, ai.distanceMeters);
  const absCurve = Math.abs(trackSample.curvature);

  // 1. Evaluate lane hazards & traffic ahead to pick safest/fastest lane
  const lanePenalty = [0, 0, 0, 0];

  for (let i = 0; i < course.obstacles.length; i++) {
    const obs = course.obstacles[i];
    const dz = obs.distanceMeters - ai.distanceMeters;
    if (dz > -2 && dz <= ai.lookaheadMeters) {
      // Strong penalty for lanes with an upcoming barrier
      const urgency = 1 + (ai.lookaheadMeters - dz) / ai.lookaheadMeters;
      lanePenalty[obs.laneIndex] += 100 * urgency;
    }
  }

  // Check other AI cars ahead in the same lane for overtaking
  for (const other of allOpponents) {
    if (other.id === ai.id) continue;
    const dz = other.distanceMeters - ai.distanceMeters;
    if (dz > 0 && dz < 26) {
      const otherLane = getClosestLaneIndex(other.x);
      lanePenalty[otherLane] += 25;
    }
  }

  // Avoid ramming directly into the back of the player
  const dzPlayer = playerDist - ai.distanceMeters;
  if (dzPlayer > -1.5 && dzPlayer < 22) {
    const pLane = getClosestLaneIndex(playerX);
    lanePenalty[pLane] += 30;
  }

  // Slight preference for staying near current target lane unless blocked
  lanePenalty[ai.targetLaneIndex] -= 6;

  // Find best lane with minimum penalty
  let bestLane = ai.targetLaneIndex;
  let bestScore = lanePenalty[bestLane];
  for (let l = 0; l < HIGHWAY_CONFIG.laneCount; l++) {
    if (lanePenalty[l] < bestScore) {
      bestScore = lanePenalty[l];
      bestLane = l;
    }
  }
  ai.targetLaneIndex = bestLane;

  // 2. Lateral Steering toward target lane
  const targetX = HIGHWAY_CONFIG.laneCenters[ai.targetLaneIndex];
  const dx = targetX - ai.x;
  const maxLatSpeed = 11.5 + ai.corneringSkill * 4.5;
  const desiredLatVel = Math.max(-maxLatSpeed, Math.min(maxLatSpeed, dx * 5.2));
  ai.lateralVelocity += (desiredLatVel - ai.lateralVelocity) * Math.min(1, dt * 10);
  ai.x = Math.max(
    -HIGHWAY_CONFIG.playerBoundX,
    Math.min(HIGHWAY_CONFIG.playerBoundX, ai.x + ai.lateralVelocity * dt)
  );

  // 3. Nitro Burst Logic on low-curvature sections
  if (ai.isNitroActive) {
    ai.nitroTimer -= dt;
    if (ai.nitroTimer <= 0 || absCurve > 0.65) {
      ai.isNitroActive = false;
      ai.nitroCooldown = 6.5 + (1 - ai.aggression) * 4;
    }
  } else {
    ai.nitroCooldown -= dt;
    if (
      ai.nitroCooldown <= 0 &&
      absCurve < 0.35 &&
      ai.distanceMeters > 120 &&
      ai.distanceMeters < course.totalLengthMeters - 60
    ) {
      ai.isNitroActive = true;
      ai.nitroTimer = 1.6 + ai.aggression * 1.1;
    }
  }

  // 4. Longitudinal Speed & Curve Moderation
  const curveSpeedFactor = 1 - absCurve * (1 - ai.corneringSkill * 0.72) * 0.38;
  const effectiveMaxSpeed =
    ai.baseTopSpeedMs * curveSpeedFactor * (ai.isNitroActive ? 1.14 : 1.0);

  if (ai.speedMs < effectiveMaxSpeed) {
    ai.speedMs = Math.min(
      effectiveMaxSpeed,
      ai.speedMs + ai.accelMs2 * (ai.isNitroActive ? 1.8 : 1.0) * dt
    );
  } else {
    ai.speedMs = Math.max(effectiveMaxSpeed, ai.speedMs - 9.5 * dt);
  }

  // 5. Check obstacle impact if AI couldn't clear a barrier in time
  if (ai.hitCooldown <= 0) {
    for (let i = 0; i < course.obstacles.length; i++) {
      const obs = course.obstacles[i];
      if (
        Math.abs(ai.distanceMeters - obs.distanceMeters) < 2.2 &&
        Math.abs(ai.x - obs.x) < 1.75
      ) {
        ai.speedMs = Math.max(22, ai.speedMs * 0.76);
        ai.hitCooldown = 1.2;
        break;
      }
    }
  }

  ai.distanceMeters += ai.speedMs * dt;
  if (ai.distanceMeters >= course.totalLengthMeters) {
    ai.distanceMeters = course.totalLengthMeters;
    ai.finished = true;
    ai.finishTimeSec = Number(elapsedRaceSec.toFixed(2));
    ai.isNitroActive = false;
  }
}

function getClosestLaneIndex(x: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < HIGHWAY_CONFIG.laneCount; i++) {
    const d = Math.abs(x - HIGHWAY_CONFIG.laneCenters[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Computes real-time 1/6 .. 6/6 race standings for the Player + 5 AI opponents.
 */
export function computeRaceStandings(params: {
  playerCarId: CarId;
  playerDistanceMeters: number;
  playerFinished: boolean;
  playerFinishTimeSec: number | null;
  opponents: AiOpponentState[];
  totalLengthMeters: number;
}): RacerStandingEntry[] {
  const {
    playerCarId,
    playerDistanceMeters,
    playerFinished,
    playerFinishTimeSec,
    opponents,
    totalLengthMeters,
  } = params;

  const entries: Omit<RacerStandingEntry, 'position'>[] = [
    {
      id: 'player',
      name: 'YOU',
      carId: playerCarId,
      isPlayer: true,
      distanceMeters: playerDistanceMeters,
      progress01: Math.max(0, Math.min(1, playerDistanceMeters / Math.max(1, totalLengthMeters))),
      finished: playerFinished,
      finishTimeSec: playerFinishTimeSec,
    },
    ...opponents.map((o) => ({
      id: o.id,
      name: o.driverName,
      carId: o.carId,
      isPlayer: false,
      distanceMeters: o.distanceMeters,
      progress01: Math.max(0, Math.min(1, o.distanceMeters / Math.max(1, totalLengthMeters))),
      finished: o.finished,
      finishTimeSec: o.finishTimeSec,
    })),
  ];

  entries.sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTimeSec ?? 9999) - (b.finishTimeSec ?? 9999);
    }
    if (a.finished !== b.finished) {
      return a.finished ? -1 : 1;
    }
    return b.distanceMeters - a.distanceMeters;
  });

  return entries.map((entry, idx) => ({
    ...entry,
    position: idx + 1,
  }));
}

/**
 * Calculates final Levels Mode rewards based on finishing position (1st..6th), level number,
 * coins picked up on track, clean race bonus, and controlled drift bonus.
 */
export function calculateLevelRaceRewards(params: {
  course: GeneratedLevelCourse;
  position: number; // 1..6
  coinsCollected: number;
  driftScore: number;
  collisionsCount: number;
}): LevelRaceRewardsBreakdown {
  const { course, position, coinsCollected, driftScore, collisionsCount } = params;
  const pos = Math.max(1, Math.min(6, Math.floor(position)));

  const positionMultipliers: Record<number, number> = {
    1: 1.0,
    2: 0.72,
    3: 0.52,
    4: 0.32,
    5: 0.22,
    6: 0.15,
  };

  const positionPrizeCoins = Math.round(
    course.baseFirstPlaceReward * (positionMultipliers[pos] ?? 0.15)
  );
  const pickupCoins = Math.max(0, Math.floor(coinsCollected)) * HIGHWAY_CONFIG.coinPickupValue;
  const cleanRaceBonusCoins = collisionsCount === 0 ? 45 + course.levelNumber * 5 : 0;
  const driftBonusCoins = Math.min(150, Math.floor(driftScore / 25));

  const totalCoinsEarned =
    positionPrizeCoins + pickupCoins + cleanRaceBonusCoins + driftBonusCoins;
  const totalScore =
    (7 - pos) * 1200 +
    Math.floor(course.totalLengthMeters * 2) +
    Math.floor(driftScore) +
    (collisionsCount === 0 ? 1000 : 0);

  return {
    levelNumber: course.levelNumber,
    position: pos,
    positionPrizeCoins,
    pickupCoins,
    cleanRaceBonusCoins,
    driftBonusCoins,
    totalCoinsEarned,
    totalScore,
    qualifiedForNextLevel: pos <= 3,
  };
}
