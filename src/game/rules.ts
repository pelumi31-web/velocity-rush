import {
  AD_CONFIG,
  CAR_CONFIGS,
  HIGHWAY_CONFIG,
  PROTECTION_TRACKS,
  SENSITIVITY_MULTIPLIERS,
  UPGRADE_TRACKS,
  WHEEL_CONFIGS,
} from './config.ts';
import type {
  CarBaseStats,
  CarId,
  ProtectionUpgradeKey,
  SensitivityLevel,
  UpgradeStatKey,
  WheelId,
} from './config.ts';

export type CarUpgradesMap = {
  topSpeed: number;
  acceleration: number;
  handling: number;
  braking?: number;
  nitro: number;
};

export interface CarProtectionMap {
  shieldCapacity: number;
  shieldDuration: number;
}

export interface EffectiveCarStats extends CarBaseStats {
  topSpeedMs: number;
  nitroSpeedKmh: number;
  nitroSpeedMs: number;
  accelMs2: number; // Base longitudinal acceleration in m/s^2
  maxShieldCharges: number;
  shieldInvulnerabilitySec: number;
  collisionSpeedRetention: number;
}

export function getUpgradeCost(statKey: UpgradeStatKey, currentLevel: number): number {
  const track = UPGRADE_TRACKS[statKey];
  if (!track || currentLevel >= track.maxLevel) return 0;
  return Math.round(track.baseCost * Math.pow(track.costMultiplier, currentLevel));
}

export function getProtectionUpgradeCost(
  key: ProtectionUpgradeKey,
  currentLevel: number
): number {
  const track = PROTECTION_TRACKS[key];
  if (!track || currentLevel >= track.maxLevel) return 0;
  return Math.round(track.baseCost * Math.pow(track.costMultiplier, currentLevel));
}

export function getEffectiveCarStats(
  carId: CarId,
  upgrades: CarUpgradesMap,
  equippedWheelId: WheelId = 'std_alloy',
  protection: CarProtectionMap = { shieldCapacity: 0, shieldDuration: 0 }
): EffectiveCarStats {
  const car = CAR_CONFIGS[carId] ?? CAR_CONFIGS.starter_apex;
  const wheel = WHEEL_CONFIGS[equippedWheelId] ?? WHEEL_CONFIGS.std_alloy;

  const speedLvl = Math.max(0, Math.min(5, upgrades.topSpeed ?? 0));
  const accelLvl = Math.max(0, Math.min(5, upgrades.acceleration ?? 0));
  const handLvl = Math.max(0, Math.min(5, upgrades.handling ?? 0));
  const brakeLvl = Math.max(0, Math.min(5, upgrades.braking ?? 0));
  const nitroLvl = Math.max(0, Math.min(5, upgrades.nitro ?? 0));

  const shieldCapLvl = Math.max(0, Math.min(4, protection.shieldCapacity ?? 0));
  const shieldDurLvl = Math.max(0, Math.min(5, protection.shieldDuration ?? 0));

  const topSpeedKmh = Math.round(
    car.baseStats.topSpeedKmh * (1 + speedLvl * UPGRADE_TRACKS.topSpeed.perLevelBonusPct) +
      wheel.topSpeedBonusKmh
  );
  const acceleration = Math.round(
    car.baseStats.acceleration *
      (1 + accelLvl * UPGRADE_TRACKS.acceleration.perLevelBonusPct)
  );
  const handling = Number(
    (
      car.baseStats.handling *
      (1 + handLvl * UPGRADE_TRACKS.handling.perLevelBonusPct + wheel.handlingBonusPct)
    ).toFixed(2)
  );
  const nitroCapacity = Number(
    (
      car.baseStats.nitroCapacity *
      (1 + nitroLvl * UPGRADE_TRACKS.nitro.perLevelBonusPct)
    ).toFixed(2)
  );

  const topSpeedMs = topSpeedKmh / 3.6;
  const nitroSpeedKmh = Math.round(topSpeedKmh * HIGHWAY_CONFIG.nitroSpeedMultiplier);
  const nitroSpeedMs = nitroSpeedKmh / 3.6;

  // Map acceleration rating to progressive acceleration (m/s^2)
  const accelMs2 = Number((1.4 + (acceleration / 100) * 3.8).toFixed(2));
  const brakingDecelMs2 = Number(
    (
      car.baseStats.brakingDecelMs2 *
      (1 +
        brakeLvl * UPGRADE_TRACKS.braking.perLevelBonusPct +
        handLvl * 0.015 +
        wheel.brakingBonusPct)
    ).toFixed(1)
  );

  const maxShieldCharges = HIGHWAY_CONFIG.maxHullIntegrity + shieldCapLvl;
  const shieldInvulnerabilitySec = Number((1.4 + shieldDurLvl * 0.36).toFixed(2));
  const collisionSpeedRetention = Number(
    Math.min(0.92, 0.72 + shieldDurLvl * 0.04).toFixed(2)
  );

  return {
    topSpeedKmh,
    topSpeedMs,
    nitroSpeedKmh,
    nitroSpeedMs,
    acceleration,
    accelMs2,
    handling,
    nitroCapacity,
    brakingDecelMs2,
    maxShieldCharges,
    shieldInvulnerabilitySec,
    collisionSpeedRetention,
  };
}

export interface LongitudinalStepInput {
  currentSpeedMs: number;
  nitroAmount: number;
  isNitroActive: boolean;
  nitroWanted: boolean;
  brakeWanted: boolean;
  effectiveStats: EffectiveCarStats;
  dt: number;
}

export interface LongitudinalStepOutput {
  speedMs: number;
  speedKmh: number;
  nitroAmount: number;
  isNitroActive: boolean;
  justActivatedNitro: boolean;
}

/**
 * Pure longitudinal vehicle dynamics step:
 * - Progressive automatic acceleration with realistic high-speed aerodynamic drag taper
 *   so speed rises continuously toward topSpeedKmh without freezing early.
 * - Braking overrides automatic acceleration and smoothly slows the vehicle down.
 * - Nitro boost requires >= 15% energy to initiate, boosts speed toward nitroSpeedKmh,
 *   drains energy, and smoothly tapers back to normal topSpeed when depleted or released.
 */
export function stepLongitudinalPhysics(
  input: LongitudinalStepInput
): LongitudinalStepOutput {
  const {
    currentSpeedMs,
    nitroAmount,
    isNitroActive,
    nitroWanted,
    brakeWanted,
    effectiveStats,
    dt,
  } = input;

  let nextNitro = nitroAmount;
  let nextNitroActive = isNitroActive;
  let justActivatedNitro = false;

  if (nitroWanted && !brakeWanted) {
    const canStart =
      nextNitroActive || nextNitro >= HIGHWAY_CONFIG.nitroMinActivationThreshold;
    if (canStart && nextNitro > 0.005) {
      if (!nextNitroActive) {
        justActivatedNitro = true;
      }
      nextNitroActive = true;
      nextNitro = Math.max(
        0,
        nextNitro - dt / Math.max(1.5, effectiveStats.nitroCapacity)
      );
      if (nextNitro <= 0.005) {
        nextNitroActive = false;
      }
    } else {
      nextNitroActive = false;
    }
  } else {
    nextNitroActive = false;
  }

  if (!nextNitroActive) {
    nextNitro = Math.min(
      1,
      nextNitro + dt * HIGHWAY_CONFIG.nitroRechargeRatePerSec
    );
  }

  const minCruiseMs = HIGHWAY_CONFIG.minBrakeSpeedKmh / 3.6;
  let nextSpeedMs = currentSpeedMs;

  if (brakeWanted && !nextNitroActive) {
    nextSpeedMs = Math.max(
      minCruiseMs,
      currentSpeedMs - effectiveStats.brakingDecelMs2 * dt
    );
  } else if (nextNitroActive) {
    const nitroAccel = effectiveStats.accelMs2 * 2.85;
    nextSpeedMs = Math.min(
      effectiveStats.nitroSpeedMs,
      currentSpeedMs + nitroAccel * dt
    );
  } else {
    if (currentSpeedMs > effectiveStats.topSpeedMs) {
      const coastDecel = 7.5;
      nextSpeedMs = Math.max(
        effectiveStats.topSpeedMs,
        currentSpeedMs - coastDecel * dt
      );
    } else {
      const speedRatio = Math.max(
        0,
        Math.min(1, currentSpeedMs / Math.max(1, effectiveStats.topSpeedMs))
      );
      const aeroFactor = Math.max(0.28, 1 - Math.pow(speedRatio, 1.7) * 0.72);
      const effectiveAccel = effectiveStats.accelMs2 * aeroFactor;
      nextSpeedMs = Math.min(
        effectiveStats.topSpeedMs,
        currentSpeedMs + effectiveAccel * dt
      );
    }
  }

  return {
    speedMs: nextSpeedMs,
    speedKmh: nextSpeedMs * 3.6,
    nitroAmount: nextNitro,
    isNitroActive: nextNitroActive,
    justActivatedNitro,
  };
}

/**
 * Extracts a unified landscape tilt angle in degrees (-60 to +60, where negative = left tilt, positive = right tilt)
 * from either DeviceMotion accelerationIncludingGravity or DeviceOrientation (beta/gamma).
 */
export function computeLandscapeTiltDegreesFromSensors(params: {
  screenAngle: number;
  accelIncludingGravity?: { x: number | null; y: number | null; z: number | null } | null;
  orientation?: { beta: number | null; gamma: number | null } | null;
}): number | null {
  const { screenAngle, accelIncludingGravity, orientation } = params;
  const normAngle = ((screenAngle % 360) + 360) % 360;

  if (
    accelIncludingGravity &&
    typeof accelIncludingGravity.x === 'number' &&
    typeof accelIncludingGravity.y === 'number' &&
    (Math.abs(accelIncludingGravity.x) > 0.01 || Math.abs(accelIncludingGravity.y) > 0.01)
  ) {
    const gx = accelIncludingGravity.x;
    const gy = accelIncludingGravity.y;
    const gz = typeof accelIncludingGravity.z === 'number' ? accelIncludingGravity.z : 9.81;

    let lateralG = 0;
    let verticalG = Math.hypot(gx, gy, gz);
    if (verticalG < 1) verticalG = 9.81;

    if (normAngle === 90) {
      lateralG = gy;
    } else if (normAngle === 270) {
      lateralG = -gy;
    } else if (normAngle === 180) {
      lateralG = gx;
    } else {
      lateralG = -gx;
    }

    const angleRad = Math.asin(Math.max(-1, Math.min(1, lateralG / 9.81)));
    const deg = (angleRad * 180) / Math.PI;
    if (Number.isFinite(deg)) {
      return Math.max(-60, Math.min(60, deg));
    }
  }

  if (
    orientation &&
    (typeof orientation.beta === 'number' || typeof orientation.gamma === 'number')
  ) {
    const beta = orientation.beta ?? 0;
    const gamma = orientation.gamma ?? 0;
    let rawTilt = 0;

    if (normAngle === 90) {
      rawTilt = beta;
    } else if (normAngle === 270) {
      rawTilt = -beta;
    } else if (normAngle === 180) {
      rawTilt = -gamma;
    } else {
      rawTilt = gamma;
    }

    if (Number.isFinite(rawTilt)) {
      return Math.max(-60, Math.min(60, rawTilt));
    }
  }

  return null;
}

export function processTiltInput(params: {
  rawAngleDeg: number;
  neutralOffsetDeg: number;
  previousFilteredInput?: number;
  deadZoneDeg?: number;
  maxSteerAngleDeg?: number;
  sensitivity: SensitivityLevel;
  invertTilt: boolean;
  smoothingFactor?: number;
}): number {
  const {
    rawAngleDeg,
    neutralOffsetDeg,
    previousFilteredInput = 0,
    deadZoneDeg = 2.2,
    maxSteerAngleDeg = 22,
    sensitivity,
    invertTilt,
    smoothingFactor = 0.35,
  } = params;

  if (!Number.isFinite(rawAngleDeg)) {
    return 0;
  }

  let delta = rawAngleDeg - neutralOffsetDeg;
  if (invertTilt) {
    delta = -delta;
  }

  const absDelta = Math.abs(delta);
  let normalized = 0;
  if (absDelta > deadZoneDeg) {
    const sign = Math.sign(delta);
    const effectiveSpan = Math.max(1, maxSteerAngleDeg - deadZoneDeg);
    const rawMag = (absDelta - deadZoneDeg) / effectiveSpan;
    const sensMult = SENSITIVITY_MULTIPLIERS[sensitivity] ?? 1.0;
    normalized = sign * Math.min(1, rawMag * sensMult);
  }

  const clampedSmoothing = Math.max(0.05, Math.min(1, smoothingFactor));
  const filtered =
    previousFilteredInput + (normalized - previousFilteredInput) * clampedSmoothing;

  if (Math.abs(filtered) < 0.01 && normalized === 0) {
    return 0;
  }
  return Math.max(-1, Math.min(1, filtered));
}

export interface BoundingBox2D {
  x: number;
  z: number;
  halfWidth: number;
  halfLength: number;
}

export interface ProximityCheckResult {
  collided: boolean;
  nearMiss: boolean;
}

export function evaluateVehicleInteraction(
  player: BoundingBox2D,
  traffic: BoundingBox2D,
  alreadyScoredNearMiss: boolean
): ProximityCheckResult {
  const dx = Math.abs(player.x - traffic.x);
  const dz = Math.abs(player.z - traffic.z);

  const combinedHalfWidth = player.halfWidth + traffic.halfWidth;
  const combinedHalfLength = player.halfLength + traffic.halfLength;

  if (dx < combinedHalfWidth * 0.86 && dz < combinedHalfLength * 0.86) {
    return { collided: true, nearMiss: false };
  }

  if (
    !alreadyScoredNearMiss &&
    dz < combinedHalfLength + 1.25 &&
    dx >= combinedHalfWidth * 0.86 &&
    dx <= combinedHalfWidth + 1.3
  ) {
    return { collided: false, nearMiss: true };
  }

  return { collided: false, nearMiss: false };
}

export function selectFairTrafficLanes(
  laneCount: number,
  difficulty01: number,
  randomFn: () => number = Math.random
): number[] {
  const clampedDiff = Math.max(0, Math.min(1, difficulty01));
  const maxVehiclesInWave = clampedDiff < 0.45 ? Math.min(2, laneCount - 2) : laneCount - 1;
  const desiredCount =
    clampedDiff < 0.25
      ? 1
      : Math.min(
          maxVehiclesInWave,
          1 + Math.floor(randomFn() * maxVehiclesInWave + clampedDiff * 0.6)
        );

  const available = Array.from({ length: laneCount }, (_, i) => i);
  const chosen: number[] = [];

  while (chosen.length < desiredCount && available.length > 1) {
    const idx = Math.floor(randomFn() * available.length);
    chosen.push(available[idx]);
    available.splice(idx, 1);
  }

  return chosen.sort((a, b) => a - b);
}

export interface RunSummaryInput {
  distanceMeters: number;
  coinsCollected: number;
  nearMissCount: number;
  bonusScore: number;
}

export interface RunRewardsSummary {
  distanceMeters: number;
  distanceScore: number;
  nearMissScore: number;
  coinScore: number;
  totalScore: number;
  coinsFromPickups: number;
  coinsFromDistance: number;
  coinsFromNearMisses: number;
  totalCoinsEarned: number;
}

export function calculateRunRewards(input: RunSummaryInput): RunRewardsSummary {
  const dist = Math.max(0, Math.floor(input.distanceMeters));
  const coins = Math.max(0, Math.floor(input.coinsCollected));
  const nearMisses = Math.max(0, Math.floor(input.nearMissCount));
  const extra = Math.max(0, Math.floor(input.bonusScore));

  const distanceScore = dist * 4;
  const nearMissScore = nearMisses * HIGHWAY_CONFIG.nearMissScoreBonus;
  const coinScore = coins * HIGHWAY_CONFIG.coinPickupScore;
  const totalScore = distanceScore + nearMissScore + coinScore + extra;

  const coinsFromPickups = coins * HIGHWAY_CONFIG.coinPickupValue;
  const coinsFromDistance = Math.floor(dist / 20);
  const coinsFromNearMisses = nearMisses * HIGHWAY_CONFIG.nearMissCoinBonus;
  const totalCoinsEarned = coinsFromPickups + coinsFromDistance + coinsFromNearMisses;

  return {
    distanceMeters: dist,
    distanceScore,
    nearMissScore,
    coinScore,
    totalScore,
    coinsFromPickups,
    coinsFromDistance,
    coinsFromNearMisses,
    totalCoinsEarned,
  };
}

export interface InterstitialEligibilityInput {
  isRacingOrSteering: boolean;
  completedRacesCount: number;
  racesSinceLastInterstitial: number;
  lastInterstitialTimestampMs: number;
  nowTimestampMs: number;
  isAdLoaded: boolean;
  consentAllowsAds: boolean;
}

export function canShowInterstitialAd(input: InterstitialEligibilityInput): boolean {
  if (input.isRacingOrSteering) return false;
  if (!input.isAdLoaded || !input.consentAllowsAds) return false;
  if (input.completedRacesCount < 1) return false;
  if (input.racesSinceLastInterstitial < AD_CONFIG.interstitialMinCompletedRaces) {
    return false;
  }
  if (
    input.lastInterstitialTimestampMs > 0 &&
    input.nowTimestampMs - input.lastInterstitialTimestampMs <
      AD_CONFIG.interstitialCooldownMs
  ) {
    return false;
  }
  return true;
}

export function resolveRewardedAdBonus(params: {
  baseCoinsEarned: number;
  sdkConfirmedReward: boolean;
  alreadyClaimedForRun: boolean;
}): { granted: boolean; bonusCoins: number } {
  if (!params.sdkConfirmedReward || params.alreadyClaimedForRun) {
    return { granted: false, bonusCoins: 0 };
  }
  const bonusCoins = Math.max(10, Math.floor(params.baseCoinsEarned));
  return { granted: true, bonusCoins };
}
