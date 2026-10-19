import {
  BUMPER_OPTIONS,
  CAR_CONFIGS,
  CAR_ORDER,
  CHALLENGES_CONFIG,
  PAINT_FINISHES,
  PAINT_PRESETS,
  PROTECTION_TRACKS,
  ROOF_OPTIONS,
  SKIRT_OPTIONS,
  SPOILER_OPTIONS,
  STRIPE_OPTIONS,
  UNDERGLOW_OPTIONS,
  UPGRADE_TRACKS,
  WHEEL_COLORS,
  WHEEL_CONFIGS,
} from './config.ts';
import type {
  BumperId,
  CarId,
  GraphicsQuality,
  PaintFinishType,
  ProtectionUpgradeKey,
  RoofAccessoryId,
  SensitivityLevel,
  SkirtId,
  SpoilerId,
  SteeringMode,
  StripeStyleId,
  UnderglowId,
  UpgradeStatKey,
  WheelId,
} from './config.ts';
import { getProtectionUpgradeCost, getUpgradeCost } from './rules.ts';
import type { CarProtectionMap, CarUpgradesMap } from './rules.ts';

export const SAVE_VERSION = 3;
const PRIMARY_STORAGE_KEY = 'velocity_rush_save_v2';
const BACKUP_STORAGE_KEY = 'velocity_rush_save_backup_v2';

export interface CarCustomizationState {
  wheelId: WheelId;
  ownedWheelIds: WheelId[];
  paintId: string;
  ownedPaintIds: string[];
  paintFinish: PaintFinishType;
  ownedFinishes: PaintFinishType[];
  wheelColorId: string;
  ownedWheelColorIds: string[];
  stripeId: StripeStyleId;
  ownedStripeIds: StripeStyleId[];
  underglowId: UnderglowId;
  ownedUnderglowIds: UnderglowId[];
  spoilerId: SpoilerId;
  ownedSpoilerIds: SpoilerId[];
  bumperId: BumperId;
  ownedBumperIds: BumperId[];
  skirtId: SkirtId;
  ownedSkirtIds: SkirtId[];
  roofId: RoofAccessoryId;
  ownedRoofIds: RoofAccessoryId[];
}

export interface LevelCompletionRecord {
  bestPosition: number;
  bestTimeSec: number;
  wins: number;
}

export interface LevelsProgressionData {
  highestUnlockedLevel: number;
  selectedLevel: number;
  completedLevels: Record<number, LevelCompletionRecord>;
}

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
  carProtection: Record<CarId, CarProtectionMap>;
  carCustomizations: Record<CarId, CarCustomizationState>;
  levelsProgression: LevelsProgressionData;
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
    braking: 0,
    nitro: 0,
  };
}

export function createDefaultProtection(): CarProtectionMap {
  return {
    shieldCapacity: 0,
    shieldDuration: 0,
  };
}

export function createDefaultCarCustomization(): CarCustomizationState {
  return {
    wheelId: 'std_alloy',
    ownedWheelIds: ['std_alloy'],
    paintId: 'paint_factory',
    ownedPaintIds: ['paint_factory'],
    paintFinish: 'gloss',
    ownedFinishes: ['gloss'],
    wheelColorId: 'rim_silver',
    ownedWheelColorIds: ['rim_silver'],
    stripeId: 'stripe_none',
    ownedStripeIds: ['stripe_none'],
    underglowId: 'glow_none',
    ownedUnderglowIds: ['glow_none'],
    spoilerId: 'spoiler_stock',
    ownedSpoilerIds: ['spoiler_stock'],
    bumperId: 'bumper_stock',
    ownedBumperIds: ['bumper_stock'],
    skirtId: 'skirt_stock',
    ownedSkirtIds: ['skirt_stock'],
    roofId: 'roof_none',
    ownedRoofIds: ['roof_none'],
  };
}

export function createDefaultSaveData(): SaveGameData {
  const carUpgrades = {} as Record<CarId, CarUpgradesMap>;
  const carProtection = {} as Record<CarId, CarProtectionMap>;
  const carCustomizations = {} as Record<CarId, CarCustomizationState>;

  for (const cId of CAR_ORDER) {
    carUpgrades[cId] = createDefaultUpgrades();
    carProtection[cId] = createDefaultProtection();
    carCustomizations[cId] = createDefaultCarCustomization();
  }

  return {
    version: SAVE_VERSION,
    coins: 600, // Starter balance allowing immediate vehicle, wheel, paint, or upgrade purchases
    bestScore: 0,
    bestDistance: 0,
    selectedCarId: 'starter_apex',
    unlockedCarIds: ['starter_apex'],
    carUpgrades,
    carProtection,
    carCustomizations,
    levelsProgression: {
      highestUnlockedLevel: 1,
      selectedLevel: 1,
      completedLevels: {},
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
      steeringMode: 'tilt',
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
    CAR_ORDER.forEach((cId) => {
      const entry = upgObj[cId];
      if (entry && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        carUpgrades[cId] = {
          topSpeed: clampLevel(e.topSpeed, 5),
          acceleration: clampLevel(e.acceleration, 5),
          handling: clampLevel(e.handling, 5),
          braking: clampLevel(e.braking, 5),
          nitro: clampLevel(e.nitro, 5),
        };
      }
    });
  }

  const carProtection = { ...defaults.carProtection };
  if (obj.carProtection && typeof obj.carProtection === 'object') {
    const protObj = obj.carProtection as Record<string, unknown>;
    CAR_ORDER.forEach((cId) => {
      const entry = protObj[cId];
      if (entry && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        carProtection[cId] = {
          shieldCapacity: clampLevel(e.shieldCapacity, 4),
          shieldDuration: clampLevel(e.shieldDuration, 5),
        };
      }
    });
  }

  const carCustomizations = { ...defaults.carCustomizations };
  if (obj.carCustomizations && typeof obj.carCustomizations === 'object') {
    const custObj = obj.carCustomizations as Record<string, unknown>;
    CAR_ORDER.forEach((cId) => {
      const entry = custObj[cId];
      const baseCust = createDefaultCarCustomization();
      if (entry && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        if (typeof e.wheelId === 'string' && e.wheelId in WHEEL_CONFIGS) {
          baseCust.wheelId = e.wheelId as WheelId;
        }
        if (Array.isArray(e.ownedWheelIds)) {
          baseCust.ownedWheelIds = Array.from(
            new Set([
              'std_alloy' as WheelId,
              ...e.ownedWheelIds.filter(
                (w): w is WheelId => typeof w === 'string' && w in WHEEL_CONFIGS
              ),
            ])
          );
        }
        if (typeof e.paintId === 'string' && PAINT_PRESETS.some((p) => p.id === e.paintId)) {
          baseCust.paintId = e.paintId;
        }
        if (Array.isArray(e.ownedPaintIds)) {
          baseCust.ownedPaintIds = Array.from(
            new Set([
              'paint_factory',
              ...e.ownedPaintIds.filter((p): p is string => typeof p === 'string'),
            ])
          );
        }
        if (
          e.paintFinish === 'gloss' ||
          e.paintFinish === 'matte' ||
          e.paintFinish === 'metallic'
        ) {
          baseCust.paintFinish = e.paintFinish;
        }
        if (Array.isArray(e.ownedFinishes)) {
          baseCust.ownedFinishes = Array.from(
            new Set([
              'gloss' as PaintFinishType,
              ...e.ownedFinishes.filter(
                (f): f is PaintFinishType =>
                  f === 'gloss' || f === 'matte' || f === 'metallic'
              ),
            ])
          );
        }
        if (
          typeof e.wheelColorId === 'string' &&
          WHEEL_COLORS.some((wc) => wc.id === e.wheelColorId)
        ) {
          baseCust.wheelColorId = e.wheelColorId;
        }
        if (Array.isArray(e.ownedWheelColorIds)) {
          baseCust.ownedWheelColorIds = Array.from(
            new Set([
              'rim_silver',
              ...e.ownedWheelColorIds.filter((w): w is string => typeof w === 'string'),
            ])
          );
        }
        if (
          typeof e.stripeId === 'string' &&
          e.stripeId in STRIPE_OPTIONS
        ) {
          baseCust.stripeId = e.stripeId as StripeStyleId;
        }
        if (Array.isArray(e.ownedStripeIds)) {
          baseCust.ownedStripeIds = Array.from(
            new Set([
              'stripe_none' as StripeStyleId,
              ...e.ownedStripeIds.filter(
                (s): s is StripeStyleId => typeof s === 'string' && s in STRIPE_OPTIONS
              ),
            ])
          );
        }
        if (
          typeof e.underglowId === 'string' &&
          e.underglowId in UNDERGLOW_OPTIONS
        ) {
          baseCust.underglowId = e.underglowId as UnderglowId;
        }
        if (Array.isArray(e.ownedUnderglowIds)) {
          baseCust.ownedUnderglowIds = Array.from(
            new Set([
              'glow_none' as UnderglowId,
              ...e.ownedUnderglowIds.filter(
                (g): g is UnderglowId => typeof g === 'string' && g in UNDERGLOW_OPTIONS
              ),
            ])
          );
        }
        if (typeof e.spoilerId === 'string' && e.spoilerId in SPOILER_OPTIONS) {
          baseCust.spoilerId = e.spoilerId as SpoilerId;
        }
        if (Array.isArray(e.ownedSpoilerIds)) {
          baseCust.ownedSpoilerIds = Array.from(
            new Set([
              'spoiler_stock' as SpoilerId,
              ...e.ownedSpoilerIds.filter(
                (s): s is SpoilerId => typeof s === 'string' && s in SPOILER_OPTIONS
              ),
            ])
          );
        }
        if (typeof e.bumperId === 'string' && e.bumperId in BUMPER_OPTIONS) {
          baseCust.bumperId = e.bumperId as BumperId;
        }
        if (Array.isArray(e.ownedBumperIds)) {
          baseCust.ownedBumperIds = Array.from(
            new Set([
              'bumper_stock' as BumperId,
              ...e.ownedBumperIds.filter(
                (b): b is BumperId => typeof b === 'string' && b in BUMPER_OPTIONS
              ),
            ])
          );
        }
        if (typeof e.skirtId === 'string' && e.skirtId in SKIRT_OPTIONS) {
          baseCust.skirtId = e.skirtId as SkirtId;
        }
        if (Array.isArray(e.ownedSkirtIds)) {
          baseCust.ownedSkirtIds = Array.from(
            new Set([
              'skirt_stock' as SkirtId,
              ...e.ownedSkirtIds.filter(
                (s): s is SkirtId => typeof s === 'string' && s in SKIRT_OPTIONS
              ),
            ])
          );
        }
        if (typeof e.roofId === 'string' && e.roofId in ROOF_OPTIONS) {
          baseCust.roofId = e.roofId as RoofAccessoryId;
        }
        if (Array.isArray(e.ownedRoofIds)) {
          baseCust.ownedRoofIds = Array.from(
            new Set([
              'roof_none' as RoofAccessoryId,
              ...e.ownedRoofIds.filter(
                (r): r is RoofAccessoryId => typeof r === 'string' && r in ROOF_OPTIONS
              ),
            ])
          );
        }
      }
      carCustomizations[cId] = baseCust;
    });
  }

  const levelsProgression: LevelsProgressionData = {
    highestUnlockedLevel: 1,
    selectedLevel: 1,
    completedLevels: {},
  };
  if (obj.levelsProgression && typeof obj.levelsProgression === 'object') {
    const lp = obj.levelsProgression as Record<string, unknown>;
    const highest = Math.max(1, safeNonNegativeInt(lp.highestUnlockedLevel) || 1);
    const sel = Math.max(1, Math.min(highest, safeNonNegativeInt(lp.selectedLevel) || highest));
    levelsProgression.highestUnlockedLevel = highest;
    levelsProgression.selectedLevel = sel;
    if (lp.completedLevels && typeof lp.completedLevels === 'object') {
      const cl = lp.completedLevels as Record<string, unknown>;
      Object.keys(cl).forEach((k) => {
        const lvlNum = Number(k);
        const rec = cl[k] as Record<string, unknown> | undefined;
        if (Number.isInteger(lvlNum) && lvlNum >= 1 && rec && typeof rec === 'object') {
          levelsProgression.completedLevels[lvlNum] = {
            bestPosition: Math.max(1, Math.min(6, safeNonNegativeInt(rec.bestPosition) || 6)),
            bestTimeSec:
              typeof rec.bestTimeSec === 'number' && Number.isFinite(rec.bestTimeSec)
                ? Number(rec.bestTimeSec.toFixed(2))
                : 999,
            wins: safeNonNegativeInt(rec.wins),
          };
        }
      });
    }
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
    carProtection,
    carCustomizations,
    levelsProgression,
    challenges,
    settings,
    completedRacesCount,
    processedRunIds,
  };
}

function clampLevel(val: unknown, max: number = 5): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(max, Math.floor(val)));
}

function safeNonNegativeInt(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return 0;
  return Math.floor(val);
}

/**
 * Pure transaction: Unlock a car in the garage.
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
 * Pure transaction: Purchase a single performance stat upgrade for an unlocked car.
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
 * Pure transaction: Purchase a Protection / Shield upgrade for an unlocked car.
 */
export function tryPurchaseProtectionUpgrade(
  save: SaveGameData,
  carId: CarId,
  protKey: ProtectionUpgradeKey
): { success: boolean; reason?: string; cost: number; data: SaveGameData } {
  if (!save.unlockedCarIds.includes(carId)) {
    return {
      success: false,
      reason: 'Unlock this vehicle before installing shield upgrades.',
      cost: 0,
      data: save,
    };
  }

  const currentProt = save.carProtection[carId] ?? createDefaultProtection();
  const currentLevel = currentProt[protKey] ?? 0;
  const maxLevel = PROTECTION_TRACKS[protKey].maxLevel;

  if (currentLevel >= maxLevel) {
    return {
      success: false,
      reason: 'Maximum shield protection tier reached.',
      cost: 0,
      data: save,
    };
  }

  const cost = getProtectionUpgradeCost(protKey, currentLevel);
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
    carProtection: {
      ...save.carProtection,
      [carId]: {
        ...currentProt,
        [protKey]: currentLevel + 1,
      },
    },
  };

  return { success: true, cost, data: updated };
}

export type CustomizationSlotType =
  | 'wheel'
  | 'paint'
  | 'finish'
  | 'wheelColor'
  | 'stripe'
  | 'underglow'
  | 'spoiler'
  | 'bumper'
  | 'skirt'
  | 'roof';

/**
 * Pure transaction: Purchase (if not yet owned for this car) or equip a visual/wheel customization item.
 * Validates vehicle ownership, accessory compatibility, and coin balance.
 */
export function tryPurchaseOrEquipCustomization(
  save: SaveGameData,
  carId: CarId,
  slot: CustomizationSlotType,
  itemId: string
): { success: boolean; purchased: boolean; cost: number; reason?: string; data: SaveGameData } {
  if (!save.unlockedCarIds.includes(carId)) {
    return {
      success: false,
      purchased: false,
      cost: 0,
      reason: 'Unlock this vehicle first before customizing it.',
      data: save,
    };
  }

  const carCfg = CAR_CONFIGS[carId];
  const cust: CarCustomizationState = {
    ...(save.carCustomizations[carId] ?? createDefaultCarCustomization()),
  };

  let isOwned = false;
  let price = 0;

  if (slot === 'wheel') {
    const cfg = WHEEL_CONFIGS[itemId as WheelId];
    if (!cfg) return { success: false, purchased: false, cost: 0, reason: 'Invalid wheel option.', data: save };
    isOwned = cust.ownedWheelIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.wheelId = cfg.id;
    if (!isOwned) cust.ownedWheelIds = [...cust.ownedWheelIds, cfg.id];
  } else if (slot === 'paint') {
    const cfg = PAINT_PRESETS.find((p) => p.id === itemId);
    if (!cfg) return { success: false, purchased: false, cost: 0, reason: 'Invalid paint option.', data: save };
    isOwned = cust.ownedPaintIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.paintId = cfg.id;
    if (!isOwned) cust.ownedPaintIds = [...cust.ownedPaintIds, cfg.id];
  } else if (slot === 'finish') {
    const cfg = PAINT_FINISHES[itemId as PaintFinishType];
    if (!cfg) return { success: false, purchased: false, cost: 0, reason: 'Invalid finish option.', data: save };
    isOwned = cust.ownedFinishes.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.paintFinish = cfg.id;
    if (!isOwned) cust.ownedFinishes = [...cust.ownedFinishes, cfg.id];
  } else if (slot === 'wheelColor') {
    const cfg = WHEEL_COLORS.find((wc) => wc.id === itemId);
    if (!cfg) return { success: false, purchased: false, cost: 0, reason: 'Invalid rim color.', data: save };
    isOwned = cust.ownedWheelColorIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.wheelColorId = cfg.id;
    if (!isOwned) cust.ownedWheelColorIds = [...cust.ownedWheelColorIds, cfg.id];
  } else if (slot === 'stripe') {
    const cfg = STRIPE_OPTIONS[itemId as StripeStyleId];
    if (!cfg) return { success: false, purchased: false, cost: 0, reason: 'Invalid stripe style.', data: save };
    isOwned = cust.ownedStripeIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.stripeId = cfg.id;
    if (!isOwned) cust.ownedStripeIds = [...cust.ownedStripeIds, cfg.id];
  } else if (slot === 'underglow') {
    const cfg = UNDERGLOW_OPTIONS[itemId as UnderglowId];
    if (!cfg) return { success: false, purchased: false, cost: 0, reason: 'Invalid underglow option.', data: save };
    isOwned = cust.ownedUnderglowIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.underglowId = cfg.id;
    if (!isOwned) cust.ownedUnderglowIds = [...cust.ownedUnderglowIds, cfg.id];
  } else if (slot === 'spoiler') {
    const cfg = SPOILER_OPTIONS[itemId as SpoilerId];
    if (!cfg || !carCfg.compatibleSpoilers.includes(cfg.id)) {
      return { success: false, purchased: false, cost: 0, reason: 'Incompatible spoiler for this body style.', data: save };
    }
    isOwned = cust.ownedSpoilerIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.spoilerId = cfg.id;
    if (!isOwned) cust.ownedSpoilerIds = [...cust.ownedSpoilerIds, cfg.id];
  } else if (slot === 'bumper') {
    const cfg = BUMPER_OPTIONS[itemId as BumperId];
    if (!cfg || !carCfg.compatibleBumpers.includes(cfg.id)) {
      return { success: false, purchased: false, cost: 0, reason: 'Incompatible front bumper for this body style.', data: save };
    }
    isOwned = cust.ownedBumperIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.bumperId = cfg.id;
    if (!isOwned) cust.ownedBumperIds = [...cust.ownedBumperIds, cfg.id];
  } else if (slot === 'skirt') {
    const cfg = SKIRT_OPTIONS[itemId as SkirtId];
    if (!cfg || !carCfg.compatibleSkirts.includes(cfg.id)) {
      return { success: false, purchased: false, cost: 0, reason: 'Incompatible side skirts for this body style.', data: save };
    }
    isOwned = cust.ownedSkirtIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.skirtId = cfg.id;
    if (!isOwned) cust.ownedSkirtIds = [...cust.ownedSkirtIds, cfg.id];
  } else if (slot === 'roof') {
    const cfg = ROOF_OPTIONS[itemId as RoofAccessoryId];
    if (!cfg || !carCfg.compatibleRoofAccessories.includes(cfg.id)) {
      return { success: false, purchased: false, cost: 0, reason: 'Incompatible roof accessory for this vehicle.', data: save };
    }
    isOwned = cust.ownedRoofIds.includes(cfg.id);
    price = cfg.price;
    if (!isOwned && save.coins < price) {
      return { success: false, purchased: false, cost: price, reason: `Need ${price - save.coins} more coins.`, data: save };
    }
    cust.roofId = cfg.id;
    if (!isOwned) cust.ownedRoofIds = [...cust.ownedRoofIds, cfg.id];
  }

  const deducted = isOwned ? 0 : price;
  const updated: SaveGameData = {
    ...save,
    coins: save.coins - deducted,
    carCustomizations: {
      ...save.carCustomizations,
      [carId]: cust,
    },
  };

  return {
    success: true,
    purchased: !isOwned && deducted > 0,
    cost: deducted,
    data: updated,
  };
}

/**
 * Pure transaction: Record completed Solo Mode run rewards once per unique runId.
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
 * Pure transaction: Record a completed Levels Mode race once per unique runId.
 * Unlocks the next level if the player finishes in the Top 3 (podium) or completes the level.
 */
export function recordCompletedLevelRace(
  save: SaveGameData,
  runId: string,
  result: {
    levelNumber: number;
    playerPosition: number; // 1..6
    finishTimeSec: number;
    totalCoinsEarned: number;
    distanceMeters: number;
    rawCoinsPickedUp: number;
    score: number;
  }
): { applied: boolean; unlockedNextLevel: boolean; data: SaveGameData } {
  if (!runId || save.processedRunIds.includes(runId)) {
    return { applied: false, unlockedNextLevel: false, data: save };
  }

  const lvl = Math.max(1, Math.floor(result.levelNumber));
  const pos = Math.max(1, Math.min(6, Math.floor(result.playerPosition)));
  const qualifiedForNextLevel = pos <= 3;

  const prevRecord = save.levelsProgression.completedLevels[lvl];
  const updatedRecord: LevelCompletionRecord = {
    bestPosition: prevRecord ? Math.min(prevRecord.bestPosition, pos) : pos,
    bestTimeSec: prevRecord
      ? Math.min(prevRecord.bestTimeSec, Number(result.finishTimeSec.toFixed(2)))
      : Number(result.finishTimeSec.toFixed(2)),
    wins: (prevRecord?.wins ?? 0) + (pos === 1 ? 1 : 0),
  };

  const nextHighestUnlocked =
    qualifiedForNextLevel && lvl >= save.levelsProgression.highestUnlockedLevel
      ? lvl + 1
      : save.levelsProgression.highestUnlockedLevel;

  const unlockedNextLevel = nextHighestUnlocked > save.levelsProgression.highestUnlockedLevel;

  const updated: SaveGameData = {
    ...save,
    coins: save.coins + Math.max(0, Math.floor(result.totalCoinsEarned)),
    completedRacesCount: save.completedRacesCount + 1,
    processedRunIds: [...save.processedRunIds.slice(-49), runId],
    levelsProgression: {
      highestUnlockedLevel: nextHighestUnlocked,
      selectedLevel: qualifiedForNextLevel ? lvl + 1 : lvl,
      completedLevels: {
        ...save.levelsProgression.completedLevels,
        [lvl]: updatedRecord,
      },
    },
    challenges: {
      ...save.challenges,
      cumulativeDistance:
        save.challenges.cumulativeDistance + Math.max(0, Math.floor(result.distanceMeters)),
      cumulativeCoins:
        save.challenges.cumulativeCoins + Math.max(0, Math.floor(result.rawCoinsPickedUp)),
      cumulativeScore:
        save.challenges.cumulativeScore + Math.max(0, Math.floor(result.score)),
    },
  };

  return { applied: true, unlockedNextLevel, data: updated };
}

/**
 * Selects an unlocked level for Levels Mode.
 */
export function trySelectLevel(save: SaveGameData, levelNumber: number): SaveGameData {
  const safeLevel = Math.max(
    1,
    Math.min(save.levelsProgression.highestUnlockedLevel, Math.floor(levelNumber))
  );
  return {
    ...save,
    levelsProgression: {
      ...save.levelsProgression,
      selectedLevel: safeLevel,
    },
  };
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
