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
  | 'bridge_jump'
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
  isBridgeJump?: boolean;
}

export interface TunnelSectionSpec {
  id: number;
  startDist: number;
  endDist: number;
  length: number;
  label: string;
}

export interface BrokenBridgeJumpSpec {
  id: number;
  label: string;
  approachStartDist: number;
  rampStartDist: number;
  rampEndDist: number;
  rampLength: number;
  rampPeakHeight: number;
  rampAngleRad: number;
  gapStartDist: number;
  gapEndDist: number;
  gapLength: number;
  landingStartDist: number;
  landingEndDist: number;
  landingLength: number;
  landingHeightOffset: number;
  minRequiredSpeedMs: number;
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
  y?: number;             // optional vertical elevation (for airborne bridge-jump coin arcs)
  collected: boolean;
}

export interface GeneratedLevelCourse {
  levelNumber: number;
  seed: number;
  title: string;
  subtitle: string;
  totalLengthMeters: number;
  segments: TrackSegmentSpec[];
  tunnels: TunnelSectionSpec[];
  bridgeJumps: BrokenBridgeJumpSpec[];
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
  y: number;        // vertical elevation (meters above road datum)
  vy: number;       // vertical velocity (m/s)
  pitchRad: number; // nose pitch angle (rad)
  isAirborne: boolean;
  activeJumpId: number | null;
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

export type JumpLifecycleState =
  | 'grounded'
  | 'approaching_ramp'
  | 'taking_off'
  | 'airborne'
  | 'landing'
  | 'grounded_after_landing'
  | 'failed_jump';

/**
 * Player starting grid position on the 6-car starting grid (Front Row, Lane 1 at 0.0m).
 */
export const PLAYER_GRID_START_X = HIGHWAY_CONFIG.laneCenters[1]; // -1.8m
export const PLAYER_GRID_START_DIST = 0;

/**
 * Gravity constant for arcade vehicle jumps (m/s^2).
 * Calibrated for crisp, responsive downward pull so jumps are short, controlled, and never floaty.
 */
export const ARCADE_JUMP_GRAVITY = 36.0;

/**
 * Protected no-jump buffer zones around every tunnel entrance and exit so vehicles
 * never launch over a tunnel or descend through a tunnel roof.
 */
export const TUNNEL_PRE_BUFFER_METERS = 85;
export const TUNNEL_POST_BUFFER_METERS = 65;

/**
 * Bonus score and coins awarded once per successfully cleared broken-bridge jump.
 */
export const BRIDGE_JUMP_SCORE_BONUS = 250;
export const BRIDGE_JUMP_COIN_BONUS = 5;

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

/**
 * Checks whether a longitudinal distance falls inside a tunnel or its protected approach/exit buffer.
 */
export function isDistanceInTunnelProtectedZone(
  distanceMeters: number,
  tunnels: TunnelSectionSpec[],
  preBuffer: number = TUNNEL_PRE_BUFFER_METERS,
  postBuffer: number = TUNNEL_POST_BUFFER_METERS
): boolean {
  for (let i = 0; i < tunnels.length; i++) {
    const t = tunnels[i];
    if (distanceMeters >= t.startDist - preBuffer && distanceMeters <= t.endDist + postBuffer) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that a BrokenBridgeJumpSpec's approach, ramp, airborne trajectory, and landing zone
 * do not overlap any tunnel or its protected approach/exit buffer.
 */
export function validateJumpAgainstTunnels(
  jump: BrokenBridgeJumpSpec,
  tunnels: TunnelSectionSpec[],
  maxVehicleSpeedMs: number = 90
): boolean {
  const maxAirborneRange = computeExpectedJumpRangeMeters(jump, maxVehicleSpeedMs);
  const jumpFootprintStart = jump.approachStartDist - 20;
  const jumpFootprintEnd = Math.max(
    jump.landingEndDist + 35,
    jump.rampEndDist + maxAirborneRange + 35
  );

  for (let i = 0; i < tunnels.length; i++) {
    const t = tunnels[i];
    const tunnelProtectedStart = t.startDist - TUNNEL_PRE_BUFFER_METERS;
    const tunnelProtectedEnd = t.endDist + TUNNEL_POST_BUFFER_METERS;
    if (jumpFootprintStart <= tunnelProtectedEnd && jumpFootprintEnd >= tunnelProtectedStart) {
      return false;
    }
  }
  return true;
}

/**
 * Validates and sanitizes a BrokenBridgeJumpSpec so every generated jump is guaranteed
 * to be reachable by the standard starter car (~60.5 m/s top speed) with a controlled,
 * believable jump height and short airtime (~0.38s-0.52s).
 */
export function validateBridgeJumpSpec(
  spec: BrokenBridgeJumpSpec,
  starterTopSpeedMs = 60.5
): BrokenBridgeJumpSpec {
  const approachLen = Math.max(45, spec.rampStartDist - spec.approachStartDist);
  const rampLength = Math.max(16, Math.min(22, spec.rampLength));
  const rampPeakHeight = Math.max(1.4, Math.min(1.9, spec.rampPeakHeight));
  const rampAngleRad = Math.atan2(rampPeakHeight, rampLength);

  // Calibrated gap length (14m..21m) so vehicles cross quickly and land crisply on the receiving deck
  const maxSafeGap = Math.min(21, Math.max(14, spec.gapLength));
  const landingLength = Math.max(42, spec.landingLength);
  const landingHeightOffset = Math.max(0, Math.min(0.45, spec.landingHeightOffset));

  // Minimum speed required to clear the gap (kept between 27 m/s and 34 m/s so normal driving clears it,
  // while heavy braking before the ramp causes a realistic failed jump)
  const safeMinSpeedMs = Math.min(
    starterTopSpeedMs * 0.58,
    Math.max(27, spec.minRequiredSpeedMs)
  );

  const rampStartDist = spec.rampStartDist;
  const rampEndDist = rampStartDist + rampLength;
  const gapStartDist = rampEndDist;
  const gapEndDist = gapStartDist + maxSafeGap;
  const landingStartDist = gapEndDist;
  const landingEndDist = landingStartDist + landingLength;

  return {
    ...spec,
    approachStartDist: rampStartDist - approachLen,
    rampStartDist,
    rampEndDist,
    rampLength,
    rampPeakHeight,
    rampAngleRad,
    gapStartDist,
    gapEndDist,
    gapLength: maxSafeGap,
    landingStartDist,
    landingEndDist,
    landingLength,
    landingHeightOffset,
    minRequiredSpeedMs: Number(safeMinSpeedMs.toFixed(2)),
  };
}

/**
 * Computes the expected horizontal airborne range (meters) for a vehicle launching off
 * a BrokenBridgeJumpSpec at a given forward speed (m/s).
 */
export function computeExpectedJumpRangeMeters(
  jump: BrokenBridgeJumpSpec,
  takeoffSpeedMs: number
): number {
  const vy0 = computeJumpLaunchVerticalVelocity(jump, takeoffSpeedMs);
  const deltaH = Math.max(0.2, jump.rampPeakHeight - jump.landingHeightOffset);
  // Solve y(t) = rampPeakHeight + vy0 * t - 0.5 * g * t^2 = landingHeightOffset
  const discriminant = vy0 * vy0 + 2 * ARCADE_JUMP_GRAVITY * deltaH;
  const flightTimeSec = (vy0 + Math.sqrt(Math.max(0, discriminant))) / ARCADE_JUMP_GRAVITY;
  return takeoffSpeedMs * flightTimeSec;
}

/**
 * Computes the vertical launch velocity (m/s) when leaving the takeoff ramp lip.
 * Capped so vehicles follow a low, believable highway jump arc and never float in the air.
 */
export function computeJumpLaunchVerticalVelocity(
  jump: BrokenBridgeJumpSpec,
  takeoffSpeedMs: number
): number {
  const speedRatio = takeoffSpeedMs / Math.max(1, jump.minRequiredSpeedMs);
  if (speedRatio < 0.92) {
    // Insufficient speed: weak vertical lift so the vehicle drops short into the gap
    return Math.min(2.1, Math.max(0.35, takeoffSpeedMs * Math.tan(jump.rampAngleRad) * 0.35));
  }
  // Sufficient speed: controlled upward trajectory capped at 5.35 m/s so airtime stays ~0.38s-0.52s
  return Math.min(5.35, Math.max(3.6, takeoffSpeedMs * Math.tan(jump.rampAngleRad) * 0.72 + 1.15));
}

export interface RoadSurfaceSample {
  groundY: number;
  slopePitchRad: number;
  isOverOpenGap: boolean;
  isOnTakeoffRamp: boolean;
  isOnLandingDeck: boolean;
  activeJump: BrokenBridgeJumpSpec | null;
  isInsideTunnel: boolean;
  tunnelProximity01: number; // 0 = open sky, 1 = inside illuminated tunnel
  activeTunnel: TunnelSectionSpec | null;
}

/**
 * Evaluates the exact 3D road elevation, ramp incline, open bridge gap, and tunnel illumination
 * state at any longitudinal distance along the road (used by both Levels Mode and Solo Mode).
 */
export function sampleRoadSurfaceAtDistance(
  distanceMeters: number,
  bridgeJumps: BrokenBridgeJumpSpec[],
  tunnels: TunnelSectionSpec[]
): RoadSurfaceSample {
  let groundY = 0;
  let slopePitchRad = 0;
  let isOverOpenGap = false;
  let isOnTakeoffRamp = false;
  let isOnLandingDeck = false;
  let activeJump: BrokenBridgeJumpSpec | null = null;

  let isInsideTunnel = false;
  let tunnelProximity01 = 0;
  let activeTunnel: TunnelSectionSpec | null = null;
  const transitionZone = 32; // Smooth 32m lighting transition before entrance and after exit

  for (let i = 0; i < tunnels.length; i++) {
    const tun = tunnels[i];
    if (distanceMeters >= tun.startDist && distanceMeters <= tun.endDist) {
      isInsideTunnel = true;
      tunnelProximity01 = 1.0;
      activeTunnel = tun;
      break;
    } else if (
      distanceMeters >= tun.startDist - transitionZone &&
      distanceMeters < tun.startDist
    ) {
      const p = 1 - (tun.startDist - distanceMeters) / transitionZone;
      if (p > tunnelProximity01) {
        tunnelProximity01 = p;
        activeTunnel = tun;
      }
    } else if (
      distanceMeters > tun.endDist &&
      distanceMeters <= tun.endDist + transitionZone
    ) {
      const p = 1 - (distanceMeters - tun.endDist) / transitionZone;
      if (p > tunnelProximity01) {
        tunnelProximity01 = p;
        activeTunnel = tun;
      }
    }
  }

  // Tunnel routing priority: inside a tunnel or its immediate portal zone, road is strictly flat & continuous
  const inImmediateTunnelPortalZone = tunnels.some(
    (t) => distanceMeters >= t.startDist - 40 && distanceMeters <= t.endDist + 25
  );

  if (!inImmediateTunnelPortalZone) {
    for (let i = 0; i < bridgeJumps.length; i++) {
      const jump = bridgeJumps[i];
      if (distanceMeters >= jump.approachStartDist && distanceMeters <= jump.landingEndDist + 10) {
        activeJump = jump;
        if (distanceMeters >= jump.rampStartDist && distanceMeters <= jump.rampEndDist) {
          isOnTakeoffRamp = true;
          const t = (distanceMeters - jump.rampStartDist) / Math.max(1, jump.rampLength);
          // Smoothly curved-upward ramp profile
          const shapedT = 0.15 * t * t + 0.85 * t;
          groundY = jump.rampPeakHeight * shapedT;
          slopePitchRad = jump.rampAngleRad;
        } else if (distanceMeters > jump.gapStartDist && distanceMeters < jump.gapEndDist) {
          isOverOpenGap = true;
          groundY = -14.0; // Physically open bridge chasm!
          slopePitchRad = 0;
        } else if (distanceMeters >= jump.landingStartDist && distanceMeters <= jump.landingEndDist) {
          isOnLandingDeck = true;
          const landProgress =
            (distanceMeters - jump.landingStartDist) / Math.max(1, jump.landingLength);
          groundY = jump.landingHeightOffset * Math.max(0, 1 - landProgress);
          slopePitchRad =
            jump.landingHeightOffset > 0.05
              ? -Math.atan2(jump.landingHeightOffset, jump.landingLength)
              : 0;
        }
        break;
      }
    }
  }

  return {
    groundY,
    slopePitchRad,
    isOverOpenGap,
    isOnTakeoffRamp,
    isOnLandingDeck,
    activeJump,
    isInsideTunnel,
    tunnelProximity01,
    activeTunnel,
  };
}

export interface VehicleJumpStepInput {
  prevDistanceMeters: number;
  nextDistanceMeters: number;
  speedMs: number;
  y: number;
  vy: number;
  pitchRad: number;
  isAirborne: boolean;
  activeJumpId: number | null;
  bridgeJumps: BrokenBridgeJumpSpec[];
  tunnels: TunnelSectionSpec[];
  dt: number;
}

export interface VehicleJumpStepOutput {
  y: number;
  vy: number;
  pitchRad: number;
  isAirborne: boolean;
  activeJumpId: number | null;
  jumpState: JumpLifecycleState;
  justTookOff: boolean;
  takeoffJump: BrokenBridgeJumpSpec | null;
  justLanded: boolean;
  landedJump: BrokenBridgeJumpSpec | null;
  justFailedJump: boolean;
  failedJump: BrokenBridgeJumpSpec | null;
  surface: RoadSurfaceSample;
}

/**
 * Authoritative vehicle vertical & bridge-jump physics step shared by the Player and all 5 AI cars.
 * Enforces:
 *  - Tunnel routing priority: vehicles approaching or inside a tunnel are strictly grounded at y=0
 *    and can never jump over a tunnel or enter through a tunnel roof.
 *  - Controlled, short jump arcs across broken-bridge gaps.
 *  - Explicit JumpLifecycleState transitions without duplicate triggers.
 */
export function stepVehicleJumpPhysics(input: VehicleJumpStepInput): VehicleJumpStepOutput {
  const {
    prevDistanceMeters,
    nextDistanceMeters,
    speedMs,
    bridgeJumps,
    tunnels,
    dt,
  } = input;

  let { y, vy, pitchRad, isAirborne, activeJumpId } = input;
  let jumpState: JumpLifecycleState = isAirborne ? 'airborne' : 'grounded';
  let justTookOff = false;
  let takeoffJump: BrokenBridgeJumpSpec | null = null;
  let justLanded = false;
  let landedJump: BrokenBridgeJumpSpec | null = null;
  let justFailedJump = false;
  let failedJump: BrokenBridgeJumpSpec | null = null;

  const surface = sampleRoadSurfaceAtDistance(nextDistanceMeters, bridgeJumps, tunnels);

  // Strict Tunnel Routing Priority Guard:
  // If the vehicle is inside a tunnel or within 35m of a tunnel entrance portal,
  // guarantee it is grounded on the road surface so it enters cleanly through the front entrance.
  const inTunnelOrApproach = tunnels.some(
    (t) => nextDistanceMeters >= t.startDist - 35 && nextDistanceMeters <= t.endDist + 10
  );
  if (inTunnelOrApproach) {
    if (isAirborne) {
      isAirborne = false;
      justLanded = true;
      landedJump = bridgeJumps.find((j) => j.id === activeJumpId) ?? null;
    }
    y = 0;
    vy = 0;
    pitchRad += (0 - pitchRad) * Math.min(1, dt * 18);
    activeJumpId = null;
    jumpState = 'grounded';
    return {
      y,
      vy,
      pitchRad,
      isAirborne,
      activeJumpId,
      jumpState,
      justTookOff,
      takeoffJump,
      justLanded,
      landedJump,
      justFailedJump,
      failedJump,
      surface,
    };
  }

  const inProtectedTunnelBuffer = isDistanceInTunnelProtectedZone(nextDistanceMeters, tunnels);

  if (!isAirborne) {
    // Check if the vehicle just reached or crossed a ramp takeoff lip (only if outside tunnel buffer)
    let triggeredJump: BrokenBridgeJumpSpec | null = null;
    if (!inProtectedTunnelBuffer) {
      for (let i = 0; i < bridgeJumps.length; i++) {
        const jump = bridgeJumps[i];
        if (activeJumpId === jump.id) continue;
        if (!validateJumpAgainstTunnels(jump, tunnels)) continue;

        const crossedLip =
          prevDistanceMeters <= jump.rampEndDist &&
          nextDistanceMeters >= jump.rampEndDist - 0.65;
        const enteredOpenGap =
          nextDistanceMeters > jump.gapStartDist &&
          nextDistanceMeters < jump.gapEndDist;
        if (crossedLip || enteredOpenGap) {
          triggeredJump = jump;
          break;
        }
      }
    }

    if (triggeredJump) {
      isAirborne = true;
      activeJumpId = triggeredJump.id;
      y = triggeredJump.rampPeakHeight;
      vy = computeJumpLaunchVerticalVelocity(triggeredJump, speedMs);
      pitchRad = Math.min(0.18, triggeredJump.rampAngleRad * 1.15);
      justTookOff = true;
      takeoffJump = triggeredJump;
      jumpState = 'taking_off';

      // If the vehicle crossed the lip mid-step, advance airborne y for the post-lip fraction of the step
      const overLipMeters = Math.max(0, nextDistanceMeters - triggeredJump.rampEndDist);
      if (overLipMeters > 0 && speedMs > 1) {
        const subDt = Math.min(dt, overLipMeters / speedMs);
        y += vy * subDt;
        vy -= ARCADE_JUMP_GRAVITY * subDt;
      }
    } else if (surface.isOnTakeoffRamp && surface.activeJump && !inProtectedTunnelBuffer) {
      // Climbing the inclined takeoff ramp
      y = surface.groundY;
      vy = speedMs * Math.sin(surface.slopePitchRad);
      pitchRad += (surface.slopePitchRad - pitchRad) * Math.min(1, dt * 16);
      jumpState = 'approaching_ramp';
    } else {
      // Normal road or receiving landing deck
      y = Math.max(0, surface.groundY);
      vy = 0;
      pitchRad += (surface.slopePitchRad - pitchRad) * Math.min(1, dt * 14);
      if (surface.isOnLandingDeck) {
        jumpState = 'grounded_after_landing';
      } else {
        jumpState = 'grounded';
      }
      // Clear activeJumpId once past the landing deck
      if (activeJumpId !== null) {
        const prevJump = bridgeJumps.find((j) => j.id === activeJumpId);
        if (!prevJump || nextDistanceMeters > prevJump.landingEndDist) {
          activeJumpId = null;
        }
      }
    }
  } else {
    // Vehicle is currently AIRBORNE across the broken bridge gap
    y += vy * dt;
    vy -= ARCADE_JUMP_GRAVITY * dt;
    jumpState = 'airborne';

    const desiredAirPitch = Math.max(
      -0.16,
      Math.min(0.18, (vy / Math.max(25, speedMs)) * 0.85)
    );
    pitchRad += (desiredAirPitch - pitchRad) * Math.min(1, dt * 12);

    const currentJump =
      bridgeJumps.find((j) => j.id === activeJumpId) ?? surface.activeJump;

    if (currentJump) {
      // 1. Did the vehicle reach the receiving bridge platform?
      if (nextDistanceMeters >= currentJump.gapEndDist - 0.45) {
        const landingDeckY = Math.max(0, surface.groundY);
        if (y < landingDeckY - 1.35) {
          // Vehicle fell too low in the chasm and struck the vertical broken abutment wall
          isAirborne = false;
          y = landingDeckY;
          vy = 0;
          pitchRad = 0;
          justFailedJump = true;
          failedJump = currentJump;
          jumpState = 'failed_jump';
        } else if (
          (y <= landingDeckY + 0.28 && vy <= 0) ||
          nextDistanceMeters >= currentJump.landingEndDist - 2
        ) {
          // Clean touchdown on the receiving bridge deck!
          isAirborne = false;
          y = landingDeckY;
          vy = 0;
          pitchRad = -0.035; // brief nose suspension compression on touchdown
          justLanded = true;
          landedJump = currentJump;
          jumpState = 'landing';
        }
      } else if (
        nextDistanceMeters > currentJump.gapStartDist + 1.5 &&
        nextDistanceMeters < currentJump.gapEndDist - 0.45
      ) {
        // 2. Still over the open gap: check if vehicle fell below road level into the chasm
        if (y < -0.65) {
          isAirborne = false;
          y = 0;
          vy = 0;
          pitchRad = 0;
          justFailedJump = true;
          failedJump = currentJump;
          jumpState = 'failed_jump';
        }
      }
    } else if (y <= 0) {
      isAirborne = false;
      y = 0;
      vy = 0;
      pitchRad = 0;
      jumpState = 'grounded';
    }
  }

  return {
    y,
    vy,
    pitchRad,
    isAirborne,
    activeJumpId,
    jumpState,
    justTookOff,
    takeoffJump,
    justLanded,
    landedJump,
    justFailedJump,
    failedJump,
    surface,
  };
}

const CITY_SECTOR_NAMES = [
  'Neo-Harbor Tunnel & Bridge Run',
  'Midtown Viaduct Jump Circuit',
  'Cyber-Bay Sub-Harbor Loop',
  'Apex Canyon Broken-Bridge GP',
  'Solstice Bayfront Overpass',
  'Valkyrie Industrial Ring',
  'Aethelgard Metro Driftway',
  'Horizon Cross-City Dash',
];

/**
 * Generates a complete, validated point-to-point course for any levelNumber >= 1.
 * Includes illuminated highway tunnels, broken-bridge jump ramps with validated open gaps,
 * U-shaped curves, hairpins, and S-bends.
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
      ? 'Illuminated Tunnel · Broken-Bridge Jump · U-Turn Drift'
      : safeLevel <= 3
        ? 'Street Championship · Tunnels, Viaduct Jumps & S-Curves'
        : safeLevel <= 6
          ? 'Pro Drift Series · Extended Bridge Gaps, Tunnels & Hairpins'
          : 'Elite Hyper-Circuit · Long-Span Bridge Jumps, Tunnels & Technical Apexes';

  const segments: TrackSegmentSpec[] = [];
  const tunnels: TunnelSectionSpec[] = [];
  const bridgeJumps: BrokenBridgeJumpSpec[] = [];
  let cursorDist = 0;
  let tunnelIdCounter = 1;
  let jumpIdCounter = 1;

  // 1. Start Grid Straight (90m)
  segments.push({
    index: 0,
    type: 'start_grid',
    label: 'Starting Grid',
    startDist: 0,
    endDist: 90,
    length: 90,
    curvature: 0,
    isTunnel: false,
    isDriftZone: false,
    isBridgeJump: false,
  });
  cursorDist = 90;

  // Curated sequence for Level 1 so players experience an Illuminated Tunnel,
  // a U-Turn Drift Bend separating it from a Broken-Bridge Jump, an S-Curve, and a second Tunnel & Jump
  // with guaranteed grounded road separation between every tunnel and jump:
  const level1Sequence: TrackSegmentType[] = [
    'tunnel_passage',
    'u_turn_right',
    'bridge_jump',
    'drift_s_bend',
    'tunnel_passage',
    'sweeping_bend_left',
    'bridge_jump',
  ];

  const level2PlusPool: TrackSegmentType[] = [
    'tunnel_passage',
    'bridge_jump',
    'u_turn_left',
    'u_turn_right',
    'hairpin_left',
    'hairpin_right',
    'drift_s_bend',
    'sweeping_bend_left',
    'sweeping_bend_right',
    'chicane_barriers',
  ];

  const middleSegmentCount =
    safeLevel === 1 ? level1Sequence.length : Math.min(15, 7 + Math.floor(safeLevel * 0.85));

  for (let i = 0; i < middleSegmentCount; i++) {
    let segType: TrackSegmentType;
    if (safeLevel === 1) {
      segType = level1Sequence[i % level1Sequence.length];
    } else if (i === 0) {
      segType = 'tunnel_passage';
    } else if (i === 1) {
      segType = i % 2 === 0 ? 'u_turn_left' : 'sweeping_bend_right';
    } else if (i === 2) {
      segType = 'bridge_jump';
    } else if (i === 3) {
      segType = 'drift_s_bend';
    } else if (i === 4) {
      segType = 'tunnel_passage';
    } else if (i === 5) {
      segType = 'hairpin_right';
    } else if (i === 6) {
      segType = 'bridge_jump';
    } else {
      segType = level2PlusPool[Math.floor(rng() * level2PlusPool.length)];
    }

    // Strict separation rule: never place a tunnel immediately after/before a bridge jump or another tunnel
    const prevSeg = segments[segments.length - 1];
    if (
      (segType === 'tunnel_passage' || segType === 'bridge_jump') &&
      (prevSeg?.isTunnel || prevSeg?.isBridgeJump)
    ) {
      segType = i % 2 === 0 ? 'sweeping_bend_right' : 'drift_s_bend';
    }

    let segLength = 170 + Math.floor(rng() * 45);
    if (segType === 'u_turn_left' || segType === 'u_turn_right') {
      segLength = 215 + Math.floor(rng() * 40);
    } else if (segType === 'hairpin_left' || segType === 'hairpin_right') {
      segLength = 190 + Math.floor(rng() * 35);
    } else if (segType === 'drift_s_bend') {
      segLength = 220 + Math.floor(rng() * 40);
    } else if (segType === 'tunnel_passage') {
      segLength = 180 + Math.floor(rng() * 35);
    } else if (segType === 'bridge_jump') {
      segLength = 195 + Math.floor(rng() * 30);
    }

    const baseCurveScale =
      safeLevel === 1 ? 0.68 : Math.min(0.95, 0.65 + difficulty01 * 0.3);
    let curvature = 0;
    let label = 'City Straight';
    let isTunnel = false;
    let isDriftZone = false;
    let isBridgeJump = false;

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
      case 'tunnel_passage': {
        // Keep tunnels straight or very gently curved so the bright entrance, interior, and exit are clearly readable
        curvature = safeLevel === 1 ? 0 : (rng() - 0.5) * 0.24;
        label =
          tunnelIdCounter % 2 === 1
            ? 'Harbor Illuminated Tunnel'
            : 'Midtown Express Tunnel';
        isTunnel = true;
        const tunStart = cursorDist + 15;
        const tunEnd = cursorDist + segLength - 15;
        tunnels.push({
          id: tunnelIdCounter++,
          startDist: tunStart,
          endDist: tunEnd,
          length: tunEnd - tunStart,
          label,
        });
        break;
      }
      case 'bridge_jump': {
        // Keep bridge jump alignment straight during approach, takeoff, and landing
        curvature = 0;
        label =
          jumpIdCounter % 2 === 1
            ? 'Broken Bridge Jump'
            : 'Viaduct Span Jump';
        isBridgeJump = true;

        // Progressive jump scaling across levels with controlled height & short gap
        const rawGapLen =
          safeLevel === 1
            ? 15
            : Math.min(20, 15 + Math.floor((safeLevel - 1) * 0.8 + rng() * 2));
        const rawRampLen = safeLevel === 1 ? 18 : 18 + Math.floor(rng() * 3);
        const rawPeakHeight =
          safeLevel === 1
            ? 1.55
            : Math.min(1.85, 1.55 + difficulty01 * 0.28);
        const rawLandingHeight =
          safeLevel <= 2 ? 0.12 : Math.min(0.35, 0.15 + difficulty01 * 0.2);
        const rawMinSpeedMs =
          safeLevel === 1
            ? 28.0 // ~101 km/h
            : Math.min(33.5, 28.5 + difficulty01 * 4.5);

        const rampStartDist = cursorDist + 52;
        const rawSpec: BrokenBridgeJumpSpec = {
          id: jumpIdCounter++,
          label,
          approachStartDist: cursorDist + 6,
          rampStartDist,
          rampEndDist: rampStartDist + rawRampLen,
          rampLength: rawRampLen,
          rampPeakHeight: rawPeakHeight,
          rampAngleRad: Math.atan2(rawPeakHeight, rawRampLen),
          gapStartDist: rampStartDist + rawRampLen,
          gapEndDist: rampStartDist + rawRampLen + rawGapLen,
          gapLength: rawGapLen,
          landingStartDist: rampStartDist + rawRampLen + rawGapLen,
          landingEndDist: rampStartDist + rawRampLen + rawGapLen + 44,
          landingLength: 44,
          landingHeightOffset: rawLandingHeight,
          minRequiredSpeedMs: rawMinSpeedMs,
        };

        const validatedJump = validateBridgeJumpSpec(rawSpec);
        if (validateJumpAgainstTunnels(validatedJump, tunnels)) {
          bridgeJumps.push(validatedJump);
        } else {
          isBridgeJump = false;
          label = 'Expressway Straight';
        }
        break;
      }
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
      isBridgeJump,
    });
    cursorDist += segLength;
  }

  // Final post-validation pass: ensure no earlier jump overlaps a later tunnel's protected buffer
  for (let j = bridgeJumps.length - 1; j >= 0; j--) {
    if (!validateJumpAgainstTunnels(bridgeJumps[j], tunnels)) {
      bridgeJumps.splice(j, 1);
    }
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
    isBridgeJump: false,
  });
  const totalLengthMeters = cursorDist + 120;

  // 2. Generate Validated Non-Car Course Obstacles & Coins
  // Rule:
  //  - Always leave at least 2 adjacent lanes completely open.
  //  - Keep bridge jump approaches, ramps, gaps, and landing platforms 100% clear of obstacles.
  const obstacles: LevelCourseObstacle[] = [];
  const coins: LevelCourseCoin[] = [];
  let obstacleIdCounter = 1;
  let coinIdCounter = 1;

  // Place airborne coin arcs over every Broken-Bridge Jump matching the controlled jump height
  for (const jump of bridgeJumps) {
    const coinLaneX = HIGHWAY_CONFIG.laneCenters[1]; // Center-left racing line (-1.8m)
    const coinLaneX2 = HIGHWAY_CONFIG.laneCenters[2]; // Center-right racing line (+1.8m)
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const frac = s / (steps - 1); // 0..1 across ramp lip to landing zone
      const d = jump.rampEndDist - 2 + frac * (jump.gapLength + 6);
      const arcHeight =
        jump.rampPeakHeight + Math.sin(frac * Math.PI) * 0.95 + 0.55;
      coins.push({
        id: coinIdCounter++,
        distanceMeters: Number(d.toFixed(1)),
        x: s % 2 === 0 ? coinLaneX : coinLaneX2,
        y: Number(arcHeight.toFixed(2)),
        collected: false,
      });
    }
  }

  const obstacleSpacing = Math.max(54, Math.round(94 - difficulty01 * 34));
  for (
    let dist = 145;
    dist < totalLengthMeters - 135;
    dist += obstacleSpacing + Math.floor(rng() * 18)
  ) {
    // Never place obstacles near a broken-bridge takeoff ramp, open gap, or landing zone
    const nearBridgeJump = bridgeJumps.some(
      (j) => dist >= j.rampStartDist - 34 && dist <= j.landingEndDist + 20
    );
    if (nearBridgeJump) continue;

    const segSample = sampleTrackAtDistance(
      {
        levelNumber: safeLevel,
        seed,
        title,
        subtitle,
        totalLengthMeters,
        segments,
        tunnels,
        bridgeJumps,
        obstacles: [],
        coins: [],
        recommendedTopSpeedKmh: 240,
        baseFirstPlaceReward: 220,
      },
      dist
    );

    let openPairStart = Math.floor(rng() * 3);
    if (segSample.curvature < -0.55) {
      openPairStart = 0;
    } else if (segSample.curvature > 0.55) {
      openPairStart = 2;
    }
    const openLanes = new Set<number>([openPairStart, openPairStart + 1]);

    const isTightApex = Math.abs(segSample.curvature) >= 0.72;
    const maxBlocked =
      safeLevel === 1 || isTightApex
        ? 1
        : rng() < 0.42 + difficulty01 * 0.32
          ? 2
          : 1;
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

    const coinLane = openPairStart + (rng() < 0.5 ? 0 : 1);
    const coinX = HIGHWAY_CONFIG.laneCenters[coinLane];
    for (let cStep = -12; cStep <= 12; cStep += 8) {
      coins.push({
        id: coinIdCounter++,
        distanceMeters: dist + cStep,
        x: coinX,
        y: 0.9,
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
    tunnels,
    bridgeJumps,
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
  isBridgeJump: boolean;
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
        const phase = norm01 * Math.PI * 2;
        effectiveCurvature = Math.sin(phase) * seg.curvature;
      } else if (
        seg.type === 'u_turn_left' ||
        seg.type === 'u_turn_right' ||
        seg.type === 'hairpin_left' ||
        seg.type === 'hairpin_right'
      ) {
        const envelope =
          norm01 < 0.18
            ? Math.sin((norm01 / 0.18) * (Math.PI * 0.5))
            : norm01 > 0.82
              ? Math.sin(((1 - norm01) / 0.18) * (Math.PI * 0.5))
              : 1.0;
        effectiveCurvature = seg.curvature * envelope;
      } else if (seg.type === 'bridge_jump') {
        effectiveCurvature = 0;
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
        isBridgeJump: Boolean(seg.isBridgeJump),
      };
    }
  }

  const last = course.segments[course.segments.length - 1];
  return {
    segment: last,
    curvature: 0,
    isTunnel: false,
    isDriftZone: false,
    isBridgeJump: false,
  };
}

/**
 * Integrates the road curvature ahead of (or behind) the player's current longitudinal distance
 * so the 3D road mesh, barriers, tunnels, bridge jump ramps, obstacles, coins, and AI cars all follow
 * the exact same physical curved road centerline.
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

  const steps = 6;
  const stepMeters = distAhead / steps;
  let heading = 0;
  let xOffset = 0;

  for (let s = 0; s < steps; s++) {
    const sampleDist = playerDistanceMeters + (s + 0.5) * stepMeters;
    const { curvature } = sampleTrackAtDistance(course, sampleDist);
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
      y: 0,
      vy: 0,
      pitchRad: 0,
      isAirborne: false,
      activeJumpId: null,
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
 * - Detects upcoming Broken-Bridge Jumps, aligns with the ramp, builds required takeoff speed,
 *   flies across the open gap using the shared jump physics, and lands on the receiving platform.
 * - Leans toward the inside apex lane on U-turns, hairpins, and sweeping bends.
 * - Overtakes slower vehicles when current lane is occupied.
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
    ai.y = 0;
    ai.vy = 0;
    ai.pitchRad = 0;
    ai.isAirborne = false;
    return;
  }

  if (ai.hitCooldown > 0) {
    ai.hitCooldown = Math.max(0, ai.hitCooldown - dt);
  }

  const prevDist = ai.distanceMeters;
  const trackSample = sampleTrackAtDistance(course, ai.distanceMeters);
  const lookaheadSample = sampleTrackAtDistance(course, ai.distanceMeters + 32);
  const absCurve = Math.max(
    Math.abs(trackSample.curvature),
    Math.abs(lookaheadSample.curvature) * 0.85
  );

  // Check if AI is approaching or traversing a Broken-Bridge Jump
  const upcomingJump = course.bridgeJumps.find(
    (j) => ai.distanceMeters >= j.approachStartDist - 40 && ai.distanceMeters <= j.gapEndDist + 10
  );

  // 1. Evaluate lane hazards, bridge-jump alignment, curve apex preference & traffic ahead
  if (!ai.isAirborne) {
    const lanePenalty = [0, 0, 0, 0];

    for (let i = 0; i < course.obstacles.length; i++) {
      const obs = course.obstacles[i];
      const dz = obs.distanceMeters - ai.distanceMeters;
      if (dz > -2 && dz <= ai.lookaheadMeters) {
        const urgency = 1 + (ai.lookaheadMeters - dz) / ai.lookaheadMeters;
        lanePenalty[obs.laneIndex] += 110 * urgency;
      }
    }

    // On bridge jump approach, bias inner lanes (1 & 2) to stay well clear of bridge railings
    if (upcomingJump) {
      lanePenalty[0] += 6;
      lanePenalty[3] += 6;
      lanePenalty[1] -= 5;
      lanePenalty[2] -= 5;
    } else if (trackSample.curvature < -0.35) {
      lanePenalty[0] -= 8 * ai.corneringSkill;
      lanePenalty[1] -= 5 * ai.corneringSkill;
    } else if (trackSample.curvature > 0.35) {
      lanePenalty[3] -= 8 * ai.corneringSkill;
      lanePenalty[2] -= 5 * ai.corneringSkill;
    }

    for (const other of allOpponents) {
      if (other.id === ai.id) continue;
      const dz = other.distanceMeters - ai.distanceMeters;
      if (dz > -2 && dz < 24) {
        const otherLane = getClosestLaneIndex(other.x);
        lanePenalty[otherLane] += 26;
      }
    }

    const dzPlayer = playerDist - ai.distanceMeters;
    if (dzPlayer > -1.5 && dzPlayer < 20) {
      const pLane = getClosestLaneIndex(playerX);
      lanePenalty[pLane] += 32;
    }

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

    // 2. Lateral Steering toward target lane
    const targetX = HIGHWAY_CONFIG.laneCenters[ai.targetLaneIndex];
    const centrifugalDrift = upcomingJump
      ? 0
      : -trackSample.curvature * (1 - ai.corneringSkill * 0.82) * 2.2;
    const dx = targetX - ai.x;
    const maxLatSpeed = 12.0 + ai.corneringSkill * 4.5;
    const desiredLatVel = Math.max(
      -maxLatSpeed,
      Math.min(maxLatSpeed, dx * 5.4 + centrifugalDrift)
    );
    ai.lateralVelocity += (desiredLatVel - ai.lateralVelocity) * Math.min(1, dt * 10);
  } else {
    // While airborne, hold steady trajectory across the bridge gap
    ai.lateralVelocity *= Math.max(0, 1 - dt * 6);
  }

  ai.x = Math.max(
    -HIGHWAY_CONFIG.playerBoundX + 0.25,
    Math.min(HIGHWAY_CONFIG.playerBoundX - 0.25, ai.x + ai.lateralVelocity * dt)
  );

  // 3. Nitro Burst Logic (also engage nitro if approaching a bridge jump below safe takeoff speed)
  const needsJumpBoost =
    upcomingJump !== undefined &&
    ai.distanceMeters < upcomingJump.rampEndDist &&
    ai.speedMs < upcomingJump.minRequiredSpeedMs * 1.18;

  if (needsJumpBoost && !ai.isNitroActive) {
    ai.isNitroActive = true;
    ai.nitroTimer = Math.max(ai.nitroTimer, 1.4);
  }

  if (ai.isNitroActive) {
    ai.nitroTimer -= dt;
    if (ai.nitroTimer <= 0 || (absCurve > 0.62 && !upcomingJump)) {
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

  // 4. Longitudinal Speed & Bridge-Jump Speed Assurance
  const curveSpeedFactor = upcomingJump
    ? 1.0
    : 1 - absCurve * (1 - ai.corneringSkill * 0.7) * 0.42;
  let effectiveMaxSpeed =
    ai.baseTopSpeedMs * curveSpeedFactor * (ai.isNitroActive ? 1.14 : 1.0);

  if (upcomingJump) {
    effectiveMaxSpeed = Math.max(effectiveMaxSpeed, upcomingJump.minRequiredSpeedMs * 1.24);
  }

  if (ai.speedMs < effectiveMaxSpeed) {
    const launchBoost = ai.speedMs < 25 || upcomingJump ? 1.9 : 1.0;
    ai.speedMs = Math.min(
      effectiveMaxSpeed,
      ai.speedMs + ai.accelMs2 * launchBoost * (ai.isNitroActive ? 1.45 : 1.0) * dt
    );
  } else if (!ai.isAirborne) {
    ai.speedMs = Math.max(effectiveMaxSpeed, ai.speedMs - 11.5 * dt);
  }

  // Ensure AI at the takeoff lip has sufficient speed to clear the validated jump
  if (
    upcomingJump &&
    ai.distanceMeters >= upcomingJump.rampStartDist &&
    ai.distanceMeters <= upcomingJump.rampEndDist
  ) {
    ai.speedMs = Math.max(ai.speedMs, upcomingJump.minRequiredSpeedMs * 1.15);
  }

  // 5. Check obstacle impact if AI couldn't clear a barrier in time (only when grounded)
  if (!ai.isAirborne && ai.hitCooldown <= 0) {
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

  const nextDist = ai.distanceMeters + ai.speedMs * dt;
  const jumpStep = stepVehicleJumpPhysics({
    prevDistanceMeters: prevDist,
    nextDistanceMeters: nextDist,
    speedMs: ai.speedMs,
    y: ai.y,
    vy: ai.vy,
    pitchRad: ai.pitchRad,
    isAirborne: ai.isAirborne,
    activeJumpId: ai.activeJumpId,
    bridgeJumps: course.bridgeJumps,
    tunnels: course.tunnels,
    dt,
  });

  ai.distanceMeters = nextDist;
  ai.y = jumpStep.y;
  ai.vy = jumpStep.vy;
  ai.pitchRad = jumpStep.pitchRad;
  ai.isAirborne = jumpStep.isAirborne;
  ai.activeJumpId = jumpStep.activeJumpId;

  // If an AI ever falls short on a jump, recover it onto the receiving deck with a speed penalty
  if (jumpStep.justFailedJump && jumpStep.failedJump) {
    ai.distanceMeters = jumpStep.failedJump.gapEndDist + 3.0;
    ai.y = jumpStep.failedJump.landingHeightOffset;
    ai.vy = 0;
    ai.pitchRad = 0;
    ai.isAirborne = false;
    ai.speedMs = Math.max(22, ai.speedMs * 0.65);
  }

  if (ai.distanceMeters >= course.totalLengthMeters) {
    ai.distanceMeters = course.totalLengthMeters;
    ai.y = 0;
    ai.vy = 0;
    ai.pitchRad = 0;
    ai.isAirborne = false;
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
