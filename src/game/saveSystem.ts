import {
  CAR_CONFIGS,
  CHALLENGES_CONFIG,
  UPGRADE_TRACKS,
} from './config.ts';
import type {
  CarId,
  GraphicsQuality,
  SensitivityLevel,
  SteeringMode,
  UpgradeStatKey,
} from './config.ts';
import { getUpgradeCost } from './rules.ts';
import type { CarUpgradesMap } from './rules.ts';

export const SAVE_VERSION = 2;
const PRIMARY_STORAGE_KEY = 'velocity_rush_save_v2';
const BACKUP_STORAGE_KEY = 'velocity_rush_save_backup_v2';

export interface UserSettingsData {
  musicVolume: number;       // 0 to 1
  sfxVolume: number;         // 0 to 1
  vibrationEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  steeringMode: SteeringMode;
  sensitivity: SensitivityLevel;
  invertTilt: boolean;
  neutralTiltOffsetDeg: number;
  adsConsentStatus: 'unknown' | 'personalized' | 'non_personalized';
  simulatedAdsOffline: boolean;
}

export interface ChallengeProgressData {
  cumulativeDistance: number;
  cumulativeCoins: number;
  cumulativeNearMisses: number;
  cumulativeScore: number;
  claimedChallengeIds: string[];
}

export interface SaveGameData {
  version: number;
  coins: number;
  bestScore: number;
  bestDistance: number;
  selectedCarId: CarId;
  unlockedCarIds: CarId[];
  carUpgrades: Record<CarId, CarUpgradesMap>;
  challenges: ChallengeProgressData;
  settings: UserSettingsData;
  completedRacesCount: number;
  processedRunIds: string[];
}

export function createDefaultUpgrades(): CarUpgradesMap {
  return {
    topSpeed: 0,
    acceleration: 0,
    handling: 0,
    nitro: 0,
  };
}

export function createDefaultSaveData(): SaveGameData {
  return {
    version: SAVE_VERSION,
    coins: 350, // Starter balance so players can test an initial upgrade or save for a car
    bestScore: 0,
    bestDistance: 0,
    selectedCarId: 'starter_apex',
    unlockedCarIds: ['starter_apex'],
    carUpgrades: {
      starter_apex: createDefaultUpgrades(),
      vortex_interceptor: createDefaultUpgrades(),
      nebula_hyper: createDefaultUpgrades(),
      titan_enforcer: createDefaultUpgrades(),
    },
    challenges: {
      cumulativeDistance: 0,
      cumulativeCoins: 0,
      cumulativeNearMisses: 0,
      cumulativeScore: 0,
      claimedChallengeIds: [],
    },
    settings: {
      musicVolume: 0.65,
      sfxVolume: 0.85,
      vibrationEnabled: true,
      graphicsQuality: 'high',
      steeringMode: 'buttons',
      sensitivity: 'medium',
      invertTilt: false,
      neutralTiltOffsetDeg: 0,
      adsConsentStatus: 'personalized',
      simulatedAdsOffline: false,
    },
    completedRacesCount: 0,
    processedRunIds: [],
  };
}

export function validateAndSanitizeSave(raw: unknown): SaveGameData {
  const defaults = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;
  const coins =
    typeof obj.coins === 'number' && Number.isFinite(obj.coins) && obj.coins >= 0
      ? Math.floor(obj.coins)
      : defaults.coins;

  const bestScore =
    typeof obj.bestScore === 'number' && Number.isFinite(obj.bestScore) && obj.bestScore >= 0
      ? Math.floor(obj.bestScore)
      : defaults.bestScore;

  const bestDistance =
    typeof obj.bestDistance === 'number' && Number.isFinite(obj.bestDistance) && obj.bestDistance >= 0
      ? Math.floor(obj.bestDistance)
      : defaults.bestDistance;

  const unlockedRaw = Array.isArray(obj.unlockedCarIds) ? obj.unlockedCarIds : [];
  const validUnlocked = unlockedRaw.filter(
    (id): id is CarId => typeof id === 'string' && id in CAR_CONFIGS
  );
  if (!validUnlocked.includes('starter_apex')) {
    validUnlocked.unshift('starter_apex');
  }
  const unlockedCarIds = Array.from(new Set(validUnlocked));

  const selectedCarId: CarId =
    typeof obj.selectedCarId === 'string' &&
    obj.selectedCarId in CAR_CONFIGS &&
    unlockedCarIds.includes(obj.selectedCarId as CarId)
      ? (obj.selectedCarId as CarId)
      : 'starter_apex';

  const carUpgrades = { ...defaults.carUpgrades };
  if (obj.carUpgrades && typeof obj.carUpgrades === 'object') {
    const upgObj = obj.carUpgrades as Record<string, unknown>;
    (Object.keys(CAR_CONFIGS) as CarId[]).forEach((cId) => {
      const entry = upgObj[cId];
      if (entry && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        carUpgrades[cId] = {
          topSpeed: clampLevel(e.topSpeed),
          acceleration: clampLevel(e.acceleration),
          handling: clampLevel(e.handling),
          nitro: clampLevel(e.nitro),
        };
      }
    });
  }

  const challenges = { ...defaults.challenges };
  if (obj.challenges && typeof obj.challenges === 'object') {
    const ch = obj.challenges as Record<string, unknown>;
    challenges.cumulativeDistance = safeNonNegativeInt(ch.cumulativeDistance);
    challenges.cumulativeCoins = safeNonNegativeInt(ch.cumulativeCoins);
    challenges.cumulativeNearMisses = safeNonNegativeInt(ch.cumulativeNearMisses);
    challenges.cumulativeScore = safeNonNegativeInt(ch.cumulativeScore);
    if (Array.isArray(ch.claimedChallengeIds)) {
      challenges.claimedChallengeIds = Array.from(
        new Set(ch.claimedChallengeIds.filter((x): x is string => typeof x === 'string'))
      );
    }
  }

  const settings = { ...defaults.settings };
  if (obj.settings && typeof obj.settings === 'object') {
    const st = obj.settings as Record<string, unknown>;
    if (typeof st.musicVolume === 'number' && Number.isFinite(st.musicVolume)) {
      settings.musicVolume = Math.max(0, Math.min(1, st.musicVolume));
    }
    if (typeof st.sfxVolume === 'number' && Number.isFinite(st.sfxVolume)) {
      settings.sfxVolume = Math.max(0, Math.min(1, st.sfxVolume));
    }
    if (typeof st.vibrationEnabled === 'boolean') {
      settings.vibrationEnabled = st.vibrationEnabled;
    }
    if (st.graphicsQuality === 'low' || st.graphicsQuality === 'medium' || st.graphicsQuality === 'high') {
      settings.graphicsQuality = st.graphicsQuality;
    }
    if (st.steeringMode === 'tilt' || st.steeringMode === 'buttons' || st.steeringMode === 'drag') {
      settings.steeringMode = st.steeringMode;
    }
    if (st.sensitivity === 'low' || st.sensitivity === 'medium' || st.sensitivity === 'high') {
      settings.sensitivity = st.sensitivity;
    }
    if (typeof st.invertTilt === 'boolean') {
      settings.invertTilt = st.invertTilt;
    }
    if (typeof st.neutralTiltOffsetDeg === 'number' && Number.isFinite(st.neutralTiltOffsetDeg)) {
      settings.neutralTiltOffsetDeg = Math.max(-45, Math.min(45, st.neutralTiltOffsetDeg));
    }
    if (
      st.adsConsentStatus === 'unknown' ||
      st.adsConsentStatus === 'personalized' ||
      st.adsConsentStatus === 'non_personalized'
    ) {
      settings.adsConsentStatus = st.adsConsentStatus;
    }
    if (typeof st.simulatedAdsOffline === 'boolean') {
      settings.simulatedAdsOffline = st.simulatedAdsOffline;
    }
  }

  const completedRacesCount = safeNonNegativeInt(obj.completedRacesCount);
  const processedRunIds = Array.isArray(obj.processedRunIds)
    ? obj.processedRunIds.filter((x): x is string => typeof x === 'string').slice(-50)
    : [];

  return {
    version: SAVE_VERSION,
    coins,
    bestScore,
    bestDistance,
    selectedCarId,
    unlockedCarIds,
    carUpgrades,
    challenges,
    settings,
    completedRacesCount,
    processedRunIds,
  };
}

function clampLevel(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(5, Math.floor(val)));
}

function safeNonNegativeInt(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return 0;
  return Math.floor(val);
}

/**
 * Pure transaction: Unlock a car in the garage.
 * Prevents negative currency and prevents double unlocking.
 */
export function tryUnlockCar(
  save: SaveGameData,
  carId: CarId
): { success: boolean; reason?: string; data: SaveGameData } {
  const config = CAR_CONFIGS[carId];
  if (!config) {
    return { success: false, reason: 'Invalid vehicle configuration.', data: save };
  }
  if (save.unlockedCarIds.includes(carId)) {
    return { success: false, reason: 'Vehicle is already unlocked.', data: save };
  }
  if (save.coins < config.unlockCost) {
    return {
      success: false,
      reason: `Insufficient coins. Need ${config.unlockCost - save.coins} more coins.`,
      data: save,
    };
  }

  const updated: SaveGameData = {
    ...save,
    coins: save.coins - config.unlockCost,
    unlockedCarIds: [...save.unlockedCarIds, carId],
    selectedCarId: carId,
  };
  return { success: true, data: updated };
}

/**
 * Pure transaction: Purchase a single stat upgrade for an unlocked car.
 */
export function tryPurchaseUpgrade(
  save: SaveGameData,
  carId: CarId,
  statKey: UpgradeStatKey
): { success: boolean; reason?: string; cost: number; data: SaveGameData } {
  if (!save.unlockedCarIds.includes(carId)) {
    return {
      success: false,
      reason: 'Unlock this vehicle before installing upgrades.',
      cost: 0,
      data: save,
    };
  }

  const currentUpgrades = save.carUpgrades[carId] ?? createDefaultUpgrades();
  const currentLevel = currentUpgrades[statKey] ?? 0;
  const maxLevel = UPGRADE_TRACKS[statKey].maxLevel;

  if (currentLevel >= maxLevel) {
    return {
      success: false,
      reason: 'Maximum upgrade tier reached.',
      cost: 0,
      data: save,
    };
  }

  const cost = getUpgradeCost(statKey, currentLevel);
  if (save.coins < cost) {
    return {
      success: false,
      reason: `Insufficient coins. Need ${cost - save.coins} more coins.`,
      cost,
      data: save,
    };
  }

  const updated: SaveGameData = {
    ...save,
    coins: save.coins - cost,
    carUpgrades: {
      ...save.carUpgrades,
      [carId]: {
        ...currentUpgrades,
        [statKey]: currentLevel + 1,
      },
    },
  };

  return { success: true, cost, data: updated };
}

/**
 * Pure transaction: Record completed run rewards once per unique runId.
 */
export function recordCompletedRun(
  save: SaveGameData,
  runId: string,
  stats: {
    score: number;
    distanceMeters: number;
    coinsEarned: number;
    rawCoinsPickedUp: number;
    nearMisses: number;
  }
): { applied: boolean; data: SaveGameData } {
  if (!runId || save.processedRunIds.includes(runId)) {
    return { applied: false, data: save };
  }

  const updated: SaveGameData = {
    ...save,
    coins: save.coins + Math.max(0, Math.floor(stats.coinsEarned)),
    bestScore: Math.max(save.bestScore, Math.floor(stats.score)),
    bestDistance: Math.max(save.bestDistance, Math.floor(stats.distanceMeters)),
    completedRacesCount: save.completedRacesCount + 1,
    processedRunIds: [...save.processedRunIds.slice(-49), runId],
    challenges: {
      ...save.challenges,
      cumulativeDistance:
        save.challenges.cumulativeDistance + Math.max(0, Math.floor(stats.distanceMeters)),
      cumulativeCoins:
        save.challenges.cumulativeCoins + Math.max(0, Math.floor(stats.rawCoinsPickedUp)),
      cumulativeNearMisses:
        save.challenges.cumulativeNearMisses + Math.max(0, Math.floor(stats.nearMisses)),
      cumulativeScore:
        save.challenges.cumulativeScore + Math.max(0, Math.floor(stats.score)),
    },
  };

  return { applied: true, data: updated };
}

/**
 * Pure transaction: Claim a completed challenge reward once.
 */
export function tryClaimChallengeReward(
  save: SaveGameData,
  challengeId: string
): { success: boolean; reason?: string; reward: number; data: SaveGameData } {
  const challenge = CHALLENGES_CONFIG.find((c) => c.id === challengeId);
  if (!challenge) {
    return { success: false, reason: 'Unknown challenge.', reward: 0, data: save };
  }
  if (save.challenges.claimedChallengeIds.includes(challengeId)) {
    return { success: false, reason: 'Challenge reward already claimed.', reward: 0, data: save };
  }

  const currentVal =
    challenge.metric === 'distance'
      ? save.challenges.cumulativeDistance
      : challenge.metric === 'coins'
        ? save.challenges.cumulativeCoins
        : challenge.metric === 'nearMisses'
          ? save.challenges.cumulativeNearMisses
          : save.challenges.cumulativeScore;

  if (currentVal < challenge.targetValue) {
    return {
      success: false,
      reason: `Progress incomplete (${currentVal}/${challenge.targetValue}).`,
      reward: 0,
      data: save,
    };
  }

  const updated: SaveGameData = {
    ...save,
    coins: save.coins + challenge.rewardCoins,
    challenges: {
      ...save.challenges,
      claimedChallengeIds: [...save.challenges.claimedChallengeIds, challengeId],
    },
  };

  return { success: true, reward: challenge.rewardCoins, data: updated };
}

/**
 * Browser LocalStorage persistence with automatic backup & corruption recovery.
 */
export function loadSaveFromStorage(storage?: Storage): SaveGameData {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return createDefaultSaveData();

  try {
    const rawPrimary = store.getItem(PRIMARY_STORAGE_KEY);
    if (rawPrimary) {
      const parsed = JSON.parse(rawPrimary);
      if (parsed && typeof parsed === 'object' && 'coins' in parsed) {
        return validateAndSanitizeSave(parsed);
      }
    }
  } catch {
    // Primary corrupted, attempt backup recovery below
  }

  try {
    const rawBackup = store.getItem(BACKUP_STORAGE_KEY);
    if (rawBackup) {
      const parsedBackup = JSON.parse(rawBackup);
      if (parsedBackup && typeof parsedBackup === 'object' && 'coins' in parsedBackup) {
        const recovered = validateAndSanitizeSave(parsedBackup);
        store.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(recovered));
        return recovered;
      }
    }
  } catch {
    // Both corrupted, return defaults
  }

  const fresh = createDefaultSaveData();
  try {
    store.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Ignore quota errors
  }
  return fresh;
}

export function writeSaveToStorage(save: SaveGameData, storage?: Storage): void {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return;

  const sanitized = validateAndSanitizeSave(save);
  const serialized = JSON.stringify(sanitized);
  try {
    const existingValid = store.getItem(PRIMARY_STORAGE_KEY);
    if (existingValid) {
      store.setItem(BACKUP_STORAGE_KEY, existingValid);
    }
    store.setItem(PRIMARY_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota errors
  }
}
