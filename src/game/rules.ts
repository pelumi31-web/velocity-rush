import {
  AD_CONFIG,
  CAR_CONFIGS,
  HIGHWAY_CONFIG,
  SENSITIVITY_MULTIPLIERS,
  UPGRADE_TRACKS,
} from './config.ts';
import type {
  CarBaseStats,
  CarId,
  SensitivityLevel,
  UpgradeStatKey,
} from './config.ts';

export type CarUpgradesMap = Record<UpgradeStatKey, number>;

export interface EffectiveCarStats extends CarBaseStats {
  topSpeedMs: number;
  nitroSpeedKmh: number;
  nitroSpeedMs: number;
}

export function getUpgradeCost(statKey: UpgradeStatKey, currentLevel: number): number {
  const track = UPGRADE_TRACKS[statKey];
  if (currentLevel >= track.maxLevel) return 0;
  return Math.round(track.baseCost * Math.pow(track.costMultiplier, currentLevel));
}

export function getEffectiveCarStats(
  carId: CarId,
  upgrades: CarUpgradesMap
): EffectiveCarStats {
  const car = CAR_CONFIGS[carId] ?? CAR_CONFIGS.starter_apex;
  const speedLvl = Math.max(0, Math.min(5, upgrades.topSpeed ?? 0));
  const accelLvl = Math.max(0, Math.min(5, upgrades.acceleration ?? 0));
  const handLvl = Math.max(0, Math.min(5, upgrades.handling ?? 0));
  const nitroLvl = Math.max(0, Math.min(5, upgrades.nitro ?? 0));

  const topSpeedKmh = Math.round(
    car.baseStats.topSpeedKmh * (1 + speedLvl * UPGRADE_TRACKS.topSpeed.perLevelBonusPct)
  );
  const acceleration = Number(
    (
      car.baseStats.acceleration *
      (1 + accelLvl * UPGRADE_TRACKS.acceleration.perLevelBonusPct)
    ).toFixed(2)
  );
  const handling = Number(
    (
      car.baseStats.handling *
      (1 + handLvl * UPGRADE_TRACKS.handling.perLevelBonusPct)
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

  return {
    topSpeedKmh,
    topSpeedMs,
    nitroSpeedKmh,
    nitroSpeedMs,
    acceleration,
    handling,
    nitroCapacity,
  };
}

/**
 * Processes mobile tilt sensor input (in degrees) with neutral calibration offset,
 * configurable dead zone, low-pass filtering, sensitivity scaling, and tilt inversion.
 */
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
    deadZoneDeg = 2.5,
    maxSteerAngleDeg = 24,
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

/**
 * Evaluates collision and near-miss window between player car and a traffic vehicle.
 */
export function evaluateVehicleInteraction(
  player: BoundingBox2D,
  traffic: BoundingBox2D,
  alreadyScoredNearMiss: boolean
): ProximityCheckResult {
  const dx = Math.abs(player.x - traffic.x);
  const dz = Math.abs(player.z - traffic.z);

  const combinedHalfWidth = player.halfWidth + traffic.halfWidth;
  const combinedHalfLength = player.halfLength + traffic.halfLength;

  if (dx < combinedHalfWidth * 0.88 && dz < combinedHalfLength * 0.88) {
    return { collided: true, nearMiss: false };
  }

  if (
    !alreadyScoredNearMiss &&
    dz < combinedHalfLength + 1.2 &&
    dx >= combinedHalfWidth * 0.88 &&
    dx <= combinedHalfWidth + 1.25
  ) {
    return { collided: false, nearMiss: true };
  }

  return { collided: false, nearMiss: false };
}

/**
 * Generates a fair set of lane indices to spawn traffic in a wave.
 * Never blocks all 4 lanes — always leaves at least 1-2 open lanes so the player
 * always has a readable, navigable path.
 */
export function selectFairTrafficLanes(
  laneCount: number,
  difficulty01: number,
  randomFn: () => number = Math.random
): number[] {
  const clampedDiff = Math.max(0, Math.min(1, difficulty01));
  // Max simultaneous vehicles in a single Z-wave is laneCount - 2 at low difficulty,
  // or laneCount - 1 at higher difficulty, NEVER laneCount.
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
  const coinsFromDistance = Math.floor(dist / 25);
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

/**
 * Enforces strict Google AdMob interstitial frequency rules:
 * - Never during active racing or steering
 * - Never before the first race completes
 * - No more than 1 interstitial per 3 completed races
 * - At least 3 minutes cooldown between interstitials
 */
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

/**
 * Evaluates rewarded ad payout: grants bonus ONLY if SDK confirmed completion
 * and the reward has not already been claimed for this run.
 */
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
