import { CAR_ORDER, type CarId, HIGHWAY_CONFIG } from './config.ts';

export type TrackSegmentType =
  | 'start_grid'
  | 'straight'
  | 'gentle_curve_left'
  | 'gentle_curve_right'
  | 'sweeping_bend_left'
  | 'sweeping_bend_right'
  | 'u_turn_left'
  | 'u_turn_right'
  | 'hairpin_left'
  | 'hairpin_right'
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
  x: number;              // lateral road coordinate relative to road centerline
  halfWidth: number;
  halfLength: number;
  type: LevelHazardType;
}

export interface LevelCourseCoin {
  id: number;
  distanceMeters: number;
  x: number;              // lateral road coordinate relative to road centerline
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
  x: number;        // lateral offset from road centerline
  targetLaneIndex: number;
  speedMs: number;
  lateralVelocity: number;
  baseTopSpeedMs: number;
  accelMs2: number;
  corneringSkill: number;     // 0.78..0.96
  lookaheadMeters: number;    // 50..85m
  aggression: number;         // 0.45..0.85
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
 * Player starting grid position on the 6-car starting grid (Front Row, Lane 1 at 0.0m).
 */
export const PLAYER_GRID_START_X = HIGHWAY_CONFIG.laneCenters[1]; // -1.8m
export const PLAYER_GRID_START_DIST = 0;

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
  'Neo-Harbor Drift Loop',
  'Midtown Hairpin Circuit',
  'Cyber-Bay U-Turn Viaduct',
  'Apex Canyon Switchback',
  'Solstice Bayfront GP',
  'Valkyrie Industrial Ring',
  'Aethelgard Metro Driftway',
  'Horizon Cross-City Dash',
];

/**
 * Generates a complete, validated point-to-point course for any levelNumber >= 1.
 * Includes real U-shaped curves, hairpins, sweeping drift corners, S-bends, and tunnels.
 */
export function generateLevelCourse(levelNumber: number): GeneratedLevelCourse {
  const safeLevel = Math.max(1, Math.floor(levelNumber));
  const seed = safeLevel * 2654435761;
  const rng = createSeededRandom(seed);

  const difficulty01 = Math.min(1, (safeLevel - 1) / 12);
  const sectorName = CITY_SECTOR_NAMES[(safeLevel - 1) % CITY_SECTOR_NAMES.length];
  const title = `Level ${safeLevel} · ${sectorName}`;
  const subtitle =
    safeLevel === 1
      ? 'Rookie Drift Circuit · Sweeping Bends & U-Turn Curve'
      : safeLevel <= 3
        ? 'Street Championship · U-Shaped Bends, S-Curves & Tunnel'
        : safeLevel <= 6
          ? 'Pro Drift Series · Hairpins, Linked S-Bends & Chicanes'
          : 'Elite Hyper-Circuit · Technical Hairpins & High-Speed Drift Zones';

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

  // Guaranteed curated sequence for Level 1 so players immediately experience
  // sweeping bends, a real U-shaped drift bend, S-curve, and tunnel sector:
  const level1Sequence: TrackSegmentType[] = [
    'sweeping_bend_left',
    'u_turn_right',
    'straight',
    'drift_s_bend',
    'tunnel_passage',
    'u_turn_left',
  ];

  const level2PlusPool: TrackSegmentType[] = [
    'u_turn_left',
    'u_turn_right',
    'hairpin_left',
    'hairpin_right',
    'drift_s_bend',
    'sweeping_bend_left',
    'sweeping_bend_right',
    'tunnel_passage',
    'chicane_barriers',
    'gentle_curve_left',
    'gentle_curve_right',
  ];

  const middleSegmentCount = safeLevel === 1 ? level1Sequence.length : Math.min(15, 6 + Math.floor(safeLevel * 0.85));

  for (let i = 0; i < middleSegmentCount; i++) {
    let segType: TrackSegmentType;
    if (safeLevel === 1) {
      segType = level1Sequence[i % level1Sequence.length];
    } else if (i === 1) {
      // Guarantee every level has at least one prominent U-shaped curve or hairpin early on
      segType = i % 2 === 0 ? 'u_turn_left' : 'hairpin_right';
    } else if (i === 3) {
      segType = 'drift_s_bend';
    } else {
      segType = level2PlusPool[Math.floor(rng() * level2PlusPool.length)];
      if (segType === 'tunnel_passage' && segments[segments.length - 1]?.isTunnel) {
        segType = 'u_turn_right';
      }
    }

    let segLength = 165 + Math.floor(rng() * 55);
    if (segType === 'u_turn_left' || segType === 'u_turn_right') {
      segLength = 220 + Math.floor(rng() * 45);
    } else if (segType === 'hairpin_left' || segType === 'hairpin_right') {
      segLength = 195 + Math.floor(rng() * 40);
    } else if (segType === 'drift_s_bend') {
      segLength = 230 + Math.floor(rng() * 50);
    } else if (segType === 'tunnel_passage') {
      segLength = 180 + Math.floor(rng() * 45);
    }

    const baseCurveScale = safeLevel === 1 ? 0.68 : Math.min(0.95, 0.65 + difficulty01 * 0.3);
    let curvature = 0;
    let label = 'City Straight';
    let isTunnel = false;
    let isDriftZone = false;

    switch (segType) {
      case 'gentle_curve_left':
        curvature = -0.36;
        label = 'Westbound Curve';
        break;
      case 'gentle_curve_right':
        curvature = 0.36;
        label = 'Eastbound Curve';
        break;
      case 'sweeping_bend_left':
        curvature = -0.56 * baseCurveScale - 0.12;
        label = 'Sweeping Left Drift';
        isDriftZone = true;
        break;
      case 'sweeping_bend_right':
        curvature = 0.56 * baseCurveScale + 0.12;
        label = 'Sweeping Right Drift';
        isDriftZone = true;
        break;
      case 'u_turn_left':
        curvature = -Math.max(0.74, 0.82 * baseCurveScale);
        label = 'U-Turn Drift Bend (Left)';
        isDriftZone = true;
        break;
      case 'u_turn_right':
        curvature = Math.max(0.74, 0.82 * baseCurveScale);
        label = 'U-Turn Drift Bend (Right)';
        isDriftZone = true;
        break;
      case 'hairpin_left':
        curvature = -Math.max(0.86, 0.94 * baseCurveScale);
        label = 'Hairpin Apex (Left)';
        isDriftZone = true;
        break;
      case 'hairpin_right':
        curvature = Math.max(0.86, 0.94 * baseCurveScale);
        label = 'Hairpin Apex (Right)';
        isDriftZone = true;
        break;
      case 'drift_s_bend':
        curvature = (i % 2 === 0 ? 1 : -1) * Math.max(0.68, 0.8 * baseCurveScale);
        label = 'Linked S-Bend Drift Zone';
        isDriftZone = true;
        break;
      case 'tunnel_passage':
        curvature = (rng() - 0.5) * 0.32;
        label = 'Sub-Harbor Tunnel';
        isTunnel = true;
        break;
      case 'chicane_barriers':
        curvature = (i % 2 === 0 ? -1 : 1) * 0.28;
        label = 'Chicane Technical Sector';
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
  // In tight hairpins/U-turns, reduce obstacle density so the racing line remains fair and drivable.
  const obstacles: LevelCourseObstacle[] = [];
  const coins: LevelCourseCoin[] = [];
  let obstacleIdCounter = 1;
  let coinIdCounter = 1;

  const obstacleSpacing = Math.max(52, Math.round(94 - difficulty01 * 36));
  for (
    let dist = 165;
    dist < totalLengthMeters - 135;
    dist += obstacleSpacing + Math.floor(rng() * 18)
  ) {
    const segSample = sampleTrackAtDistance({
      levelNumber: safeLevel,
      seed,
      title,
      subtitle,
      totalLengthMeters,
      segments,
      obstacles: [],
      coins: [],
      recommendedTopSpeedKmh: 240,
      baseFirstPlaceReward: 220,
    }, dist);

    // Pick a guaranteed open pair of adjacent lanes (0&1, 1&2, or 2&3)
    // On strong curves, bias the open racing line toward the apex so players & AI have a clean drift line
    let openPairStart = Math.floor(rng() * 3);
    if (segSample.curvature < -0.55) {
      openPairStart = 0; // Left apex lanes 0 & 1 open
    } else if (segSample.curvature > 0.55) {
      openPairStart = 2; // Right apex lanes 2 & 3 open
    }
    const openLanes = new Set<number>([openPairStart, openPairStart + 1]);

    const isTightApex = Math.abs(segSample.curvature) >= 0.72;
    const maxBlocked =
      safeLevel === 1 || isTightApex ? 1 : rng() < 0.42 + difficulty01 * 0.32 ? 2 : 1;
    let blockedCount = 0;

    for (let laneIdx = 0; laneIdx < HIGHWAY_CONFIG.laneCount; laneIdx++) {
      if (openLanes.has(laneIdx)) continue;
      if (blockedCount >= maxBlocked) continue;
      if (rng() < 0.75) {
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
          halfWidth: 1.12,
          halfLength: 0.9,
          type: hazardType,
        });
      }
    }

    // Place a line of collectible coins along the optimal drift/apex racing line
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
 * Shapes U-turns and hairpins with smooth entry, sustained apex, and smooth exit transitions.
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
      const localProgress = clamped - seg.startDist;
      const norm01 = localProgress / Math.max(1, seg.length);
      const distToEnd = seg.endDist - clamped;
      let effectiveCurvature = seg.curvature;

      if (seg.type === 'drift_s_bend') {
        // S-bend oscillates smoothly from +curvature to -curvature across the segment
        const phase = norm01 * Math.PI * 2;
        effectiveCurvature = Math.sin(phase) * seg.curvature;
      } else if (
        seg.type === 'u_turn_left' ||
        seg.type === 'u_turn_right' ||
        seg.type === 'hairpin_left' ||
        seg.type === 'hairpin_right'
      ) {
        // U-turn / Hairpin envelope: smooth progressive turn-in (0..0.18), sustained deep apex (0.18..0.82), smooth exit (0.82..1.0)
        const envelope =
          norm01 < 0.18
            ? Math.sin((norm01 / 0.18) * (Math.PI * 0.5))
            : norm01 > 0.82
              ? Math.sin(((1 - norm01) / 0.18) * (Math.PI * 0.5))
              : 1.0;
        effectiveCurvature = seg.curvature * envelope;
      } else if (localProgress < 24 && i > 0) {
        const prevCurv = course.segments[i - 1].curvature;
        const t = localProgress / 24;
        effectiveCurvature = prevCurv + (seg.curvature - prevCurv) * t;
      } else if (distToEnd < 24 && i < course.segments.length - 1) {
        const nextCurv = course.segments[i + 1].curvature;
        const t = 1 - distToEnd / 24;
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

/**
 * Integrates the road curvature ahead of (or behind) the player's current longitudinal distance
 * so the 3D road mesh, barriers, lane markings, obstacles, coins, and AI cars all follow
 * the exact same physical curved road centerline.
 *
 * @param course Active level course
 * @param playerDistanceMeters Current longitudinal distance of the player (m)
 * @param worldZ Scene Z coordinate (negative = ahead of player, positive = behind player)
 */
export function computeCurvedRoadCenterAtWorldZ(
  course: GeneratedLevelCourse | null,
  playerDistanceMeters: number,
  worldZ: number
): { xOffset: number; headingRad: number; curvature: number } {
  if (!course) {
    return { xOffset: 0, headingRad: 0, curvature: 0 };
  }
  const distAhead = -worldZ; // +meters ahead of player
  const sampleAtZ = sampleTrackAtDistance(course, playerDistanceMeters + distAhead);

  if (Math.abs(distAhead) < 0.5) {
    return { xOffset: 0, headingRad: 0, curvature: sampleAtZ.curvature };
  }

  // Integrate curvature in 6 slices from playerDistanceMeters to playerDistanceMeters + distAhead
  const steps = 6;
  const stepMeters = distAhead / steps;
  let heading = 0;
  let xOffset = 0;

  for (let s = 0; s < steps; s++) {
    const sampleDist = playerDistanceMeters + (s + 0.5) * stepMeters;
    const { curvature } = sampleTrackAtDistance(course, sampleDist);
    // Curvature of 1.0 corresponds to a turn rate of ~0.0085 rad/m (broad drivable U-bend / hairpin)
    heading += curvature * stepMeters * 0.0082;
    xOffset += Math.sin(heading) * stepMeters;
  }

  return {
    xOffset,
    headingRad: heading,
    curvature: sampleAtZ.curvature,
  };
}

const AI_DRIVER_PROFILES = [
  { name: 'Viper-01', paintHex: 0xef4444, aggression: 0.78, cornering: 0.94 },
  { name: 'Apex-02', paintHex: 0xf59e0b, aggression: 0.68, cornering: 0.9 },
  { name: 'Nova-03', paintHex: 0xec4899, aggression: 0.62, cornering: 0.87 },
  { name: 'Pulse-04', paintHex: 0x10b981, aggression: 0.54, cornering: 0.84 },
  { name: 'Krono-05', paintHex: 0x8b5cf6, aggression: 0.48, cornering: 0.81 },
];

/**
 * Creates the 5 distinct AI racing opponents for a Levels Mode race (6 cars total with player).
 *
 * PRIORITY 6 GUARANTEE:
 * - All 6 vehicles (Player + 5 AI) are positioned on a fair 2-row starting grid
 *   at or behind the Start Line (`distanceMeters <= 0.0`).
 * - Front Row (`distanceMeters = 0.0m`):
 *     - Lane 0 (`-5.4m`): AI #2 (`Apex-02`)
 *     - Lane 1 (`-1.8m`): PLAYER (`YOU`)
 *     - Lane 2 (`+1.8m`): AI #1 (`Viper-01`)
 *     - Lane 3 (`+5.4m`): AI #3 (`Nova-03`)
 * - Second Row (`distanceMeters = -6.0m`, staggered behind Row 1):
 *     - Left-Center (`-3.6m`): AI #4 (`Pulse-04`)
 *     - Right-Center (`+3.6m`): AI #5 (`Krono-05`)
 * - All vehicles start at `speedMs = 0` and wait for the synchronized `GO!` release.
 */
export function createLevelAiOpponents(
  levelNumber: number,
  playerEffectiveTopSpeedMs: number
): AiOpponentState[] {
  const safeLevel = Math.max(1, Math.floor(levelNumber));
  const rng = createSeededRandom(safeLevel * 987654321);
  const difficultyScale = Math.min(1.08, 0.88 + (safeLevel - 1) * 0.018);

  const baseRefSpeedMs = Math.max(
    55,
    Math.min(playerEffectiveTopSpeedMs * 1.0, (218 + (safeLevel - 1) * 6.5) / 3.6)
  );

  // Non-overlapping 6-car starting grid (Player occupies Front Row Lane 1 at x = -1.8, dist = 0)
  const gridPlacements: { x: number; laneIdx: number; dist: number }[] = [
    { x: HIGHWAY_CONFIG.laneCenters[2], laneIdx: 2, dist: 0.0 },  // AI 1: Front Row Lane 2 (+1.8m)
    { x: HIGHWAY_CONFIG.laneCenters[0], laneIdx: 0, dist: 0.0 },  // AI 2: Front Row Lane 0 (-5.4m)
    { x: HIGHWAY_CONFIG.laneCenters[3], laneIdx: 3, dist: 0.0 },  // AI 3: Front Row Lane 3 (+5.4m)
    { x: -3.6, laneIdx: 0, dist: -6.0 },                          // AI 4: Row 2 Left-Center (-3.6m, -6.0m behind line)
    { x: 3.6, laneIdx: 3, dist: -6.0 },                           // AI 5: Row 2 Right-Center (+3.6m, -6.0m behind line)
  ];

  return AI_DRIVER_PROFILES.map((profile, idx) => {
    const gridSlot = idx + 1; // 1..5
    const carIdx = (safeLevel + idx) % CAR_ORDER.length;
    const carId = CAR_ORDER[carIdx];

    const slotSpeedFactor = 1.01 - idx * 0.028 + (rng() - 0.5) * 0.012;
    const aiTopSpeedMs = baseRefSpeedMs * difficultyScale * slotSpeedFactor;
    const placement = gridPlacements[idx];

    return {
      id: `ai_racer_${gridSlot}`,
      driverName: profile.name,
      carId,
      paintColorHex: profile.paintHex,
      gridSlot,
      distanceMeters: placement.dist,
      x: placement.x,
      targetLaneIndex: placement.laneIdx,
      speedMs: 0, // Stationary during 3-2-1 countdown; launched on GO!
      lateralVelocity: 0,
      baseTopSpeedMs: aiTopSpeedMs,
      accelMs2: 14.5 + (5 - idx) * 0.8 + Math.min(2.5, safeLevel * 0.15),
      corneringSkill: profile.cornering,
      lookaheadMeters: 54 + (5 - idx) * 6,
      aggression: profile.aggression,
      nitroTimer: 0,
      nitroCooldown: 4.5 + idx * 1.2,
      isNitroActive: false,
      hitCooldown: 0,
      finished: false,
      finishTimeSec: null,
    };
  });
}

/**
 * Steps a single AI opponent for one physics frame after the race countdown has reached GO!:
 * - Scans upcoming course obstacles within lookaheadMeters and steers into open lanes.
 * - leans toward the inside apex lane on U-turns, hairpins, and sweeping bends.
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
    ai.speedMs = Math.max(25, ai.speedMs - 8 * dt);
    ai.distanceMeters += ai.speedMs * dt;
    return;
  }

  if (ai.hitCooldown > 0) {
    ai.hitCooldown = Math.max(0, ai.hitCooldown - dt);
  }

  const trackSample = sampleTrackAtDistance(course, ai.distanceMeters);
  const lookaheadSample = sampleTrackAtDistance(course, ai.distanceMeters + 32);
  const absCurve = Math.max(
    Math.abs(trackSample.curvature),
    Math.abs(lookaheadSample.curvature) * 0.85
  );

  // 1. Evaluate lane hazards, curve apex preference & traffic ahead
  const lanePenalty = [0, 0, 0, 0];

  for (let i = 0; i < course.obstacles.length; i++) {
    const obs = course.obstacles[i];
    const dz = obs.distanceMeters - ai.distanceMeters;
    if (dz > -2 && dz <= ai.lookaheadMeters) {
      const urgency = 1 + (ai.lookaheadMeters - dz) / ai.lookaheadMeters;
      lanePenalty[obs.laneIndex] += 110 * urgency;
    }
  }

  // Curve apex racing line preference: hug inside lanes on U-turns and hairpins
  if (trackSample.curvature < -0.35) {
    lanePenalty[0] -= 8 * ai.corneringSkill;
    lanePenalty[1] -= 5 * ai.corneringSkill;
  } else if (trackSample.curvature > 0.35) {
    lanePenalty[3] -= 8 * ai.corneringSkill;
    lanePenalty[2] -= 5 * ai.corneringSkill;
  }

  // Check other AI cars ahead in the same lane for overtaking
  for (const other of allOpponents) {
    if (other.id === ai.id) continue;
    const dz = other.distanceMeters - ai.distanceMeters;
    if (dz > -2 && dz < 24) {
      const otherLane = getClosestLaneIndex(other.x);
      lanePenalty[otherLane] += 26;
    }
  }

  // Avoid ramming directly into the back of the player
  const dzPlayer = playerDist - ai.distanceMeters;
  if (dzPlayer > -1.5 && dzPlayer < 20) {
    const pLane = getClosestLaneIndex(playerX);
    lanePenalty[pLane] += 32;
  }

  // Slight preference for staying near current target lane unless blocked
  lanePenalty[ai.targetLaneIndex] -= 6;

  let bestLane = ai.targetLaneIndex;
  let bestScore = lanePenalty[bestLane];
  for (let l = 0; l < HIGHWAY_CONFIG.laneCount; l++) {
    if (lanePenalty[l] < bestScore) {
      bestScore = lanePenalty[l];
      bestLane = l;
    }
  }
  ai.targetLaneIndex = bestLane;

  // 2. Lateral Steering toward target lane (with subtle centrifugal outward pull on tight hairpins)
  const targetX = HIGHWAY_CONFIG.laneCenters[ai.targetLaneIndex];
  const centrifugalDrift =
    -trackSample.curvature * (1 - ai.corneringSkill * 0.82) * 2.2;
  const dx = targetX - ai.x;
  const maxLatSpeed = 12.0 + ai.corneringSkill * 4.5;
  const desiredLatVel = Math.max(
    -maxLatSpeed,
    Math.min(maxLatSpeed, dx * 5.4 + centrifugalDrift)
  );
  ai.lateralVelocity += (desiredLatVel - ai.lateralVelocity) * Math.min(1, dt * 10);
  ai.x = Math.max(
    -HIGHWAY_CONFIG.playerBoundX + 0.25,
    Math.min(HIGHWAY_CONFIG.playerBoundX - 0.25, ai.x + ai.lateralVelocity * dt)
  );

  // 3. Nitro Burst Logic on low-curvature sections
  if (ai.isNitroActive) {
    ai.nitroTimer -= dt;
    if (ai.nitroTimer <= 0 || absCurve > 0.62) {
      ai.isNitroActive = false;
      ai.nitroCooldown = 6.5 + (1 - ai.aggression) * 4;
    }
  } else {
    ai.nitroCooldown -= dt;
    if (
      ai.nitroCooldown <= 0 &&
      absCurve < 0.35 &&
      ai.distanceMeters > 110 &&
      ai.distanceMeters < course.totalLengthMeters - 60
    ) {
      ai.isNitroActive = true;
      ai.nitroTimer = 1.6 + ai.aggression * 1.1;
    }
  }

  // 4. Longitudinal Speed & Curve Braking Moderation
  const curveSpeedFactor = 1 - absCurve * (1 - ai.corneringSkill * 0.7) * 0.42;
  const effectiveMaxSpeed =
    ai.baseTopSpeedMs * curveSpeedFactor * (ai.isNitroActive ? 1.14 : 1.0);

  if (ai.speedMs < effectiveMaxSpeed) {
    // Smooth launch acceleration from 0 m/s up to cruising/racing speed
    const launchBoost = ai.speedMs < 25 ? 1.85 : 1.0;
    ai.speedMs = Math.min(
      effectiveMaxSpeed,
      ai.speedMs + ai.accelMs2 * launchBoost * (ai.isNitroActive ? 1.45 : 1.0) * dt
    );
  } else {
    ai.speedMs = Math.max(effectiveMaxSpeed, ai.speedMs - 11.5 * dt);
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
    if (Math.abs(b.distanceMeters - a.distanceMeters) > 0.01) {
      return b.distanceMeters - a.distanceMeters;
    }
    // At the starting line (both at 0.0m), put Player #1 among tied front-row starters
    return a.isPlayer ? -1 : b.isPlayer ? 1 : 0;
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
    Math.max(0, Math.floor(coinsCollected)) * HIGHWAY_CONFIG.coinPickupScore +
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
