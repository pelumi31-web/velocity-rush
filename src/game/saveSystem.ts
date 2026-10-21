import {
  BUMPER_OPTIONS,
  CAR_CONFIGS,
  CAR_ORDER,
  CHALLENGES_CONFIG,
  DAILY_CHALLENGE_TEMPLATES,
  DAILY_COMPLETION_BONUS_COINS,
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
  ChallengeMetric,
  DailyChallengeCategory,
  DailyChallengeDifficulty,
  DailyChallengeMetric,
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
  musicEnabled: boolean;     // Persistent background music on/off toggle
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
  soloDistance: number;
  cumulativeCoins: number;
  totalRaceRewardCoins: number;
  cumulativeNearMisses: number;
  highSpeedNearMisses: number;
  cleanRaces: number;
  driftEvents: number;
  levelDriftZonesClean: number;
  successfulJumps: number;
  tunnelsCompleted: number;
  levelsWins: number;
  levelsPodiums: number;
  levelsCleanFinishes: number;
  shieldAbsorptions: number;
  nitroActivations: number;
  cumulativeScore: number;
  claimedChallengeIds: string[];
}

export interface DailyChallengeItem {
  id: string;
  templateId: string;
  title: string;
  description: string;
  difficulty: DailyChallengeDifficulty;
  category: DailyChallengeCategory;
  metric: DailyChallengeMetric;
  targetValue: number;
  currentValue: number;
  rewardCoins: number;
  claimed: boolean;
}

export interface DailyChallengeHistoryEntry {
  dateUtc: string; // YYYY-MM-DD
  completedCount: number;
  claimedCount: number;
  bonusClaimed: boolean;
  totalCoinsEarned: number;
  challenges: {
    title: string;
    difficulty: DailyChallengeDifficulty;
    completed: boolean;
    claimed: boolean;
  }[];
}

export interface DailyChallengesState {
  dateUtc: string; // YYYY-MM-DD
  items: DailyChallengeItem[];
  bonusClaimed: boolean;
  currentStreak: number;
  bestStreak: number;
  lastStreakDateUtc: string | null;
  history: DailyChallengeHistoryEntry[];
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
  dailyChallenges: DailyChallengesState;
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

export function getCurrentUtcDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getPreviousUtcDateString(dateUtc: string): string {
  const parsed = Date.parse(`${dateUtc}T00:00:00Z`);
  if (!Number.isFinite(parsed)) {
    return getCurrentUtcDateString(new Date(Date.now() - 86400000));
  }
  return new Date(parsed - 86400000).toISOString().slice(0, 10);
}

export function getTimeUntilNextUtcReset(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  formatted: string;
} {
  const nextMidnightMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  const diffSec = Math.max(0, Math.floor((nextMidnightMs - now.getTime()) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hours,
    minutes,
    seconds,
    totalSeconds: diffSec,
    formatted: `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
  };
}

function hashStringToUint32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministically generates 3 varied Daily Challenges (1 Easy, 1 Medium, 1 Hard)
 * for a given UTC date string (YYYY-MM-DD), ensuring no duplicate categories or metrics
 * on the same day and scaling targets modestly with player progression tier.
 */
export function generateDailyChallengesForDate(
  dateUtc: string,
  progressionTier: number = 0
): DailyChallengeItem[] {
  const safeTier = Math.max(0, Math.min(6, Math.floor(progressionTier)));
  const seed = hashStringToUint32(`velocity_rush_daily_${dateUtc}`);

  const easyPool = DAILY_CHALLENGE_TEMPLATES.filter((t) => t.difficulty === 'easy');
  const medPool = DAILY_CHALLENGE_TEMPLATES.filter((t) => t.difficulty === 'medium');
  const hardPool = DAILY_CHALLENGE_TEMPLATES.filter((t) => t.difficulty === 'hard');

  const usedCategories = new Set<DailyChallengeCategory>();
  const usedMetrics = new Set<DailyChallengeMetric>();

  const pickTemplate = (pool: typeof DAILY_CHALLENGE_TEMPLATES, offsetSeed: number) => {
    for (let attempt = 0; attempt < pool.length; attempt++) {
      const idx = (offsetSeed + attempt) % pool.length;
      const candidate = pool[idx];
      if (!usedCategories.has(candidate.category) && !usedMetrics.has(candidate.metric)) {
        usedCategories.add(candidate.category);
        usedMetrics.add(candidate.metric);
        return candidate;
      }
    }
    const fallback = pool[offsetSeed % pool.length];
    usedCategories.add(fallback.category);
    usedMetrics.add(fallback.metric);
    return fallback;
  };

  const chosen = [
    pickTemplate(easyPool, seed),
    pickTemplate(medPool, (seed >>> 5) + 3),
    pickTemplate(hardPool, (seed >>> 11) + 7),
  ];

  return chosen.map((tpl) => {
    const rawTarget = tpl.baseTarget + safeTier * tpl.scalePerTier;
    const targetValue = Math.min(tpl.maxTarget, Math.max(tpl.baseTarget, rawTarget));
    return {
      id: `${dateUtc}_${tpl.difficulty}_${tpl.templateId}`,
      templateId: tpl.templateId,
      title: tpl.title,
      description: tpl.descriptionTemplate.replace('{target}', targetValue.toLocaleString()),
      difficulty: tpl.difficulty,
      category: tpl.category,
      metric: tpl.metric,
      targetValue,
      currentValue: 0,
      rewardCoins: tpl.rewardCoins,
      claimed: false,
    };
  });
}

export function createDefaultDailyChallengesState(
  dateUtc: string = getCurrentUtcDateString()
): DailyChallengesState {
  return {
    dateUtc,
    items: generateDailyChallengesForDate(dateUtc, 0),
    bonusClaimed: false,
    currentStreak: 0,
    bestStreak: 0,
    lastStreakDateUtc: null,
    history: [],
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
      soloDistance: 0,
      cumulativeCoins: 0,
      totalRaceRewardCoins: 0,
      cumulativeNearMisses: 0,
      highSpeedNearMisses: 0,
      cleanRaces: 0,
      driftEvents: 0,
      levelDriftZonesClean: 0,
      successfulJumps: 0,
      tunnelsCompleted: 0,
      levelsWins: 0,
      levelsPodiums: 0,
      levelsCleanFinishes: 0,
      shieldAbsorptions: 0,
      nitroActivations: 0,
      cumulativeScore: 0,
      claimedChallengeIds: [],
    },
    dailyChallenges: createDefaultDailyChallengesState(),
    settings: {
      musicEnabled: true,
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
    challenges.soloDistance =
      ch.soloDistance !== undefined
        ? safeNonNegativeInt(ch.soloDistance)
        : challenges.cumulativeDistance;
    challenges.cumulativeCoins = safeNonNegativeInt(ch.cumulativeCoins);
    challenges.totalRaceRewardCoins =
      ch.totalRaceRewardCoins !== undefined
        ? safeNonNegativeInt(ch.totalRaceRewardCoins)
        : challenges.cumulativeCoins * 5;
    challenges.cumulativeNearMisses = safeNonNegativeInt(ch.cumulativeNearMisses);
    challenges.highSpeedNearMisses = safeNonNegativeInt(ch.highSpeedNearMisses);
    challenges.cleanRaces = safeNonNegativeInt(ch.cleanRaces);
    challenges.driftEvents = safeNonNegativeInt(ch.driftEvents);
    challenges.levelDriftZonesClean = safeNonNegativeInt(ch.levelDriftZonesClean);
    challenges.successfulJumps = safeNonNegativeInt(ch.successfulJumps);
    challenges.tunnelsCompleted = safeNonNegativeInt(ch.tunnelsCompleted);
    challenges.levelsWins = safeNonNegativeInt(ch.levelsWins);
    challenges.levelsPodiums = safeNonNegativeInt(ch.levelsPodiums);
    challenges.levelsCleanFinishes = safeNonNegativeInt(ch.levelsCleanFinishes);
    challenges.shieldAbsorptions = safeNonNegativeInt(ch.shieldAbsorptions);
    challenges.nitroActivations = safeNonNegativeInt(ch.nitroActivations);
    challenges.cumulativeScore = safeNonNegativeInt(ch.cumulativeScore);
    if (Array.isArray(ch.claimedChallengeIds)) {
      challenges.claimedChallengeIds = Array.from(
        new Set(ch.claimedChallengeIds.filter((x): x is string => typeof x === 'string'))
      );
    }
  }

  const progTier = Math.min(
    6,
    Math.floor((levelsProgression.highestUnlockedLevel - 1) / 3) +
      Math.floor(unlockedCarIds.length / 3)
  );
  let dailyChallenges = createDefaultDailyChallengesState(getCurrentUtcDateString());
  if (obj.dailyChallenges && typeof obj.dailyChallenges === 'object') {
    const dc = obj.dailyChallenges as Record<string, unknown>;
    const dateUtc =
      typeof dc.dateUtc === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dc.dateUtc)
        ? dc.dateUtc
        : getCurrentUtcDateString();
    const fallbackItems = generateDailyChallengesForDate(dateUtc, progTier);
    let items: DailyChallengeItem[] = fallbackItems;
    if (Array.isArray(dc.items) && dc.items.length === 3) {
      items = dc.items.map((rawItem, idx) => {
        const fb = fallbackItems[idx];
        if (!rawItem || typeof rawItem !== 'object') return fb;
        const ri = rawItem as Record<string, unknown>;
        return {
          id: typeof ri.id === 'string' ? ri.id : fb.id,
          templateId: typeof ri.templateId === 'string' ? ri.templateId : fb.templateId,
          title: typeof ri.title === 'string' ? ri.title : fb.title,
          description: typeof ri.description === 'string' ? ri.description : fb.description,
          difficulty:
            ri.difficulty === 'easy' || ri.difficulty === 'medium' || ri.difficulty === 'hard'
              ? ri.difficulty
              : fb.difficulty,
          category: typeof ri.category === 'string' ? (ri.category as DailyChallengeCategory) : fb.category,
          metric: typeof ri.metric === 'string' ? (ri.metric as DailyChallengeMetric) : fb.metric,
          targetValue: Math.max(1, safeNonNegativeInt(ri.targetValue) || fb.targetValue),
          currentValue: safeNonNegativeInt(ri.currentValue),
          rewardCoins: Math.max(1, safeNonNegativeInt(ri.rewardCoins) || fb.rewardCoins),
          claimed: Boolean(ri.claimed),
        };
      });
    }
    const history: DailyChallengeHistoryEntry[] = Array.isArray(dc.history)
      ? dc.history
          .filter((h): h is DailyChallengeHistoryEntry => Boolean(h && typeof h === 'object'))
          .slice(0, 14)
      : [];
    dailyChallenges = {
      dateUtc,
      items,
      bonusClaimed: Boolean(dc.bonusClaimed),
      currentStreak: safeNonNegativeInt(dc.currentStreak),
      bestStreak: Math.max(
        safeNonNegativeInt(dc.bestStreak),
        safeNonNegativeInt(dc.currentStreak)
      ),
      lastStreakDateUtc:
        typeof dc.lastStreakDateUtc === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dc.lastStreakDateUtc)
          ? dc.lastStreakDateUtc
          : null,
      history,
    };
  }

  const settings = { ...defaults.settings };
  if (obj.settings && typeof obj.settings === 'object') {
    const st = obj.settings as Record<string, unknown>;
    if (typeof st.musicEnabled === 'boolean') {
      settings.musicEnabled = st.musicEnabled;
    }
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

  return ensureCurrentDailyChallenges({
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
    dailyChallenges,
    settings,
    completedRacesCount,
    processedRunIds,
  });
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

export interface LiveGameplayProgressDelta {
  distanceMeters?: number;
  soloDistanceMeters?: number;
  rawCoinsPickedUp?: number;
  nearMisses?: number;
  highSpeedNearMisses?: number;
  driftEvents?: number;
  levelDriftZonesClean?: number;
  successfulJumps?: number;
  tunnelsCompleted?: number;
  shieldAbsorptions?: number;
  nitroActivations?: number;
  score?: number;
}

export function countPurchasedCustomizations(save: SaveGameData): number {
  let count = 0;
  for (const cId of CAR_ORDER) {
    const cust = save.carCustomizations?.[cId];
    if (!cust) continue;
    count += Math.max(0, cust.ownedWheelIds.length - 1);
    count += Math.max(0, cust.ownedPaintIds.length - 1);
    count += Math.max(0, cust.ownedFinishes.length - 1);
    count += Math.max(0, cust.ownedWheelColorIds.length - 1);
    count += Math.max(0, cust.ownedStripeIds.length - 1);
    count += Math.max(0, cust.ownedUnderglowIds.length - 1);
    count += Math.max(0, cust.ownedSpoilerIds.length - 1);
    count += Math.max(0, cust.ownedBumperIds.length - 1);
    count += Math.max(0, cust.ownedSkirtIds.length - 1);
    count += Math.max(0, cust.ownedRoofIds.length - 1);
  }
  return count;
}

export function countPurchasedUpgrades(save: SaveGameData): number {
  let count = 0;
  for (const cId of CAR_ORDER) {
    const upg = save.carUpgrades?.[cId];
    if (upg) {
      count +=
        (upg.topSpeed || 0) +
        (upg.acceleration || 0) +
        (upg.handling || 0) +
        (upg.braking || 0) +
        (upg.nitro || 0);
    }
    const prot = save.carProtection?.[cId];
    if (prot) {
      count += (prot.shieldCapacity || 0) + (prot.shieldDuration || 0);
    }
  }
  return count;
}

/**
 * Evaluates the current player progress value for any of the 32 Lifetime Challenge metrics.
 */
export function getChallengeMetricValue(
  save: SaveGameData,
  metric: ChallengeMetric
): number {
  const ch = save.challenges;
  switch (metric) {
    case 'distance':
      return ch.cumulativeDistance;
    case 'soloDistance':
      return ch.soloDistance;
    case 'totalRacesCompleted':
      return save.completedRacesCount;
    case 'coins':
      return ch.cumulativeCoins;
    case 'totalRaceRewardCoins':
      return ch.totalRaceRewardCoins;
    case 'nearMisses':
      return ch.cumulativeNearMisses;
    case 'highSpeedNearMisses':
      return ch.highSpeedNearMisses;
    case 'cleanRaces':
      return ch.cleanRaces;
    case 'driftEvents':
      return ch.driftEvents;
    case 'levelDriftZonesClean':
      return ch.levelDriftZonesClean;
    case 'successfulJumps':
      return ch.successfulJumps;
    case 'tunnelsCompleted':
      return ch.tunnelsCompleted;
    case 'levelsWins': {
      const recordedWins = Object.values(save.levelsProgression.completedLevels).reduce(
        (sum, rec) => sum + (rec.wins || 0),
        0
      );
      return Math.max(ch.levelsWins, recordedWins);
    }
    case 'levelsPodiums': {
      const distinctPodiums = Object.values(save.levelsProgression.completedLevels).filter(
        (rec) => rec.bestPosition <= 3
      ).length;
      return Math.max(ch.levelsPodiums, distinctPodiums);
    }
    case 'distinctLevelsCompleted':
      return Object.keys(save.levelsProgression.completedLevels).length;
    case 'levelsCleanFinishes':
      return ch.levelsCleanFinishes;
    case 'ownedCars':
      return save.unlockedCarIds.length;
    case 'purchasedCustomizations':
      return countPurchasedCustomizations(save);
    case 'purchasedUpgrades':
      return countPurchasedUpgrades(save);
    case 'shieldAbsorptions':
      return ch.shieldAbsorptions;
    case 'nitroActivations':
      return ch.nitroActivations;
    case 'score':
      return ch.cumulativeScore;
    default:
      return 0;
  }
}

/**
 * Ensures the player's Daily Challenges state matches the current UTC date (YYYY-MM-DD).
 * If a new UTC day has started:
 * - Archives the previous day's set into bounded history (up to 14 days).
 * - Resets currentStreak to 0 if the player missed a full UTC day.
 * - Generates 3 fresh Daily Challenges for the new UTC day.
 */
export function ensureCurrentDailyChallenges(
  save: SaveGameData,
  currentUtcDate: string = getCurrentUtcDateString()
): SaveGameData {
  const dc = save.dailyChallenges;
  if (!dc) {
    return {
      ...save,
      dailyChallenges: createDefaultDailyChallengesState(currentUtcDate),
    };
  }
  if (dc.dateUtc === currentUtcDate) {
    return save;
  }

  // Archive previous day's record into bounded history (up to 14 days)
  const completedCount = dc.items.filter((i) => i.currentValue >= i.targetValue).length;
  const claimedCount = dc.items.filter((i) => i.claimed).length;
  const coinsFromClaims = dc.items.reduce(
    (sum, i) => sum + (i.claimed ? i.rewardCoins : 0),
    0
  );
  const archivedEntry: DailyChallengeHistoryEntry = {
    dateUtc: dc.dateUtc,
    completedCount,
    claimedCount,
    bonusClaimed: dc.bonusClaimed,
    totalCoinsEarned:
      coinsFromClaims + (dc.bonusClaimed ? DAILY_COMPLETION_BONUS_COINS : 0),
    challenges: dc.items.map((i) => ({
      title: i.title,
      difficulty: i.difficulty,
      completed: i.currentValue >= i.targetValue,
      claimed: i.claimed,
    })),
  };

  const nextHistory = [
    archivedEntry,
    ...dc.history.filter((h) => h.dateUtc !== dc.dateUtc),
  ].slice(0, 14);

  const yesterdayUtc = getPreviousUtcDateString(currentUtcDate);
  const streakStillValid =
    dc.lastStreakDateUtc === currentUtcDate || dc.lastStreakDateUtc === yesterdayUtc;
  const nextCurrentStreak = streakStillValid ? dc.currentStreak : 0;

  const progTier = Math.min(
    6,
    Math.floor((save.levelsProgression.highestUnlockedLevel - 1) / 3) +
      Math.floor(save.unlockedCarIds.length / 3)
  );

  return {
    ...save,
    dailyChallenges: {
      dateUtc: currentUtcDate,
      items: generateDailyChallengesForDate(currentUtcDate, progTier),
      bonusClaimed: false,
      currentStreak: nextCurrentStreak,
      bestStreak: Math.max(dc.bestStreak, nextCurrentStreak),
      lastStreakDateUtc: dc.lastStreakDateUtc,
      history: nextHistory,
    },
  };
}

function applyDailyChallengeMetrics(
  dc: DailyChallengesState,
  deltas: Partial<Record<DailyChallengeMetric, number>>
): DailyChallengesState {
  let changed = false;
  const nextItems = dc.items.map((item) => {
    const inc = Math.max(0, Math.floor(deltas[item.metric] ?? 0));
    if (inc <= 0) return item;
    changed = true;
    return {
      ...item,
      currentValue: item.currentValue + inc,
    };
  });
  return changed ? { ...dc, items: nextItems } : dc;
}

/**
 * Pure transaction: Records incremental gameplay actions during an active run or at run boundary
 * so both Lifetime Challenges and Daily Challenges update in real time without duplication.
 */
export function recordLiveGameplayProgress(
  save: SaveGameData,
  delta: LiveGameplayProgressDelta,
  currentUtcDate: string = getCurrentUtcDateString()
): SaveGameData {
  const synced = ensureCurrentDailyChallenges(save, currentUtcDate);
  const dist = Math.max(0, Math.floor(delta.distanceMeters ?? 0));
  const soloDist = Math.max(0, Math.floor(delta.soloDistanceMeters ?? 0));
  const coins = Math.max(0, Math.floor(delta.rawCoinsPickedUp ?? 0));
  const nearMisses = Math.max(0, Math.floor(delta.nearMisses ?? 0));
  const highSpeedNm = Math.max(0, Math.floor(delta.highSpeedNearMisses ?? 0));
  const drifts = Math.max(0, Math.floor(delta.driftEvents ?? 0));
  const cleanDriftZones = Math.max(0, Math.floor(delta.levelDriftZonesClean ?? 0));
  const jumps = Math.max(0, Math.floor(delta.successfulJumps ?? 0));
  const tunnels = Math.max(0, Math.floor(delta.tunnelsCompleted ?? 0));
  const shieldBlocks = Math.max(0, Math.floor(delta.shieldAbsorptions ?? 0));
  const nitroUses = Math.max(0, Math.floor(delta.nitroActivations ?? 0));
  const score = Math.max(0, Math.floor(delta.score ?? 0));

  if (
    dist === 0 &&
    soloDist === 0 &&
    coins === 0 &&
    nearMisses === 0 &&
    highSpeedNm === 0 &&
    drifts === 0 &&
    cleanDriftZones === 0 &&
    jumps === 0 &&
    tunnels === 0 &&
    shieldBlocks === 0 &&
    nitroUses === 0 &&
    score === 0
  ) {
    return synced;
  }

  return {
    ...synced,
    challenges: {
      ...synced.challenges,
      cumulativeDistance: synced.challenges.cumulativeDistance + dist,
      soloDistance: synced.challenges.soloDistance + soloDist,
      cumulativeCoins: synced.challenges.cumulativeCoins + coins,
      cumulativeNearMisses: synced.challenges.cumulativeNearMisses + nearMisses,
      highSpeedNearMisses: synced.challenges.highSpeedNearMisses + highSpeedNm,
      driftEvents: synced.challenges.driftEvents + drifts,
      levelDriftZonesClean: synced.challenges.levelDriftZonesClean + cleanDriftZones,
      successfulJumps: synced.challenges.successfulJumps + jumps,
      tunnelsCompleted: synced.challenges.tunnelsCompleted + tunnels,
      shieldAbsorptions: synced.challenges.shieldAbsorptions + shieldBlocks,
      nitroActivations: synced.challenges.nitroActivations + nitroUses,
      cumulativeScore: synced.challenges.cumulativeScore + score,
    },
    dailyChallenges: applyDailyChallengeMetrics(synced.dailyChallenges, {
      dailyDistance: dist,
      dailySoloDistance: soloDist,
      dailyCoinsPickedUp: coins,
      dailyNearMisses: nearMisses,
      dailyHighSpeedNearMisses: highSpeedNm,
      dailyDriftEvents: drifts,
      dailyJumps: jumps,
      dailyTunnels: tunnels,
      dailyShieldBlocks: shieldBlocks,
      dailyNitroActivations: nitroUses,
      dailyScore: score,
    }),
  };
}

/**
 * Pure transaction: Record completed Solo Mode run rewards once per unique runId.
 * Supports optional `alreadyCommitted` deltas so live mid-run progress is never double-counted.
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
    highSpeedNearMisses?: number;
    driftEvents?: number;
    successfulJumps?: number;
    tunnelsCompleted?: number;
    shieldAbsorptions?: number;
    nitroActivations?: number;
    collisionsCount?: number;
    alreadyCommitted?: LiveGameplayProgressDelta;
  }
): { applied: boolean; data: SaveGameData } {
  if (!runId || save.processedRunIds.includes(runId)) {
    return { applied: false, data: save };
  }

  const synced = ensureCurrentDailyChallenges(save);
  const committed = stats.alreadyCommitted ?? {};

  const remDist = Math.max(
    0,
    Math.floor(stats.distanceMeters) - Math.floor(committed.distanceMeters ?? 0)
  );
  const remSoloDist = Math.max(
    0,
    Math.floor(stats.distanceMeters) - Math.floor(committed.soloDistanceMeters ?? 0)
  );
  const remCoins = Math.max(
    0,
    Math.floor(stats.rawCoinsPickedUp) - Math.floor(committed.rawCoinsPickedUp ?? 0)
  );
  const remNearMisses = Math.max(
    0,
    Math.floor(stats.nearMisses) - Math.floor(committed.nearMisses ?? 0)
  );
  const remHighSpeedNm = Math.max(
    0,
    Math.floor(stats.highSpeedNearMisses ?? 0) -
      Math.floor(committed.highSpeedNearMisses ?? 0)
  );
  const remDrifts = Math.max(
    0,
    Math.floor(stats.driftEvents ?? 0) - Math.floor(committed.driftEvents ?? 0)
  );
  const remJumps = Math.max(
    0,
    Math.floor(stats.successfulJumps ?? 0) - Math.floor(committed.successfulJumps ?? 0)
  );
  const remTunnels = Math.max(
    0,
    Math.floor(stats.tunnelsCompleted ?? 0) - Math.floor(committed.tunnelsCompleted ?? 0)
  );
  const remShields = Math.max(
    0,
    Math.floor(stats.shieldAbsorptions ?? 0) - Math.floor(committed.shieldAbsorptions ?? 0)
  );
  const remNitros = Math.max(
    0,
    Math.floor(stats.nitroActivations ?? 0) - Math.floor(committed.nitroActivations ?? 0)
  );
  const remScore = Math.max(
    0,
    Math.floor(stats.score) - Math.floor(committed.score ?? 0)
  );

  const coinsEarnedInt = Math.max(0, Math.floor(stats.coinsEarned));
  const isCleanRun =
    stats.collisionsCount !== undefined &&
    stats.collisionsCount === 0 &&
    Math.floor(stats.distanceMeters) >= 250;

  const updated: SaveGameData = {
    ...synced,
    coins: synced.coins + coinsEarnedInt,
    bestScore: Math.max(synced.bestScore, Math.floor(stats.score)),
    bestDistance: Math.max(synced.bestDistance, Math.floor(stats.distanceMeters)),
    completedRacesCount: synced.completedRacesCount + 1,
    processedRunIds: [...synced.processedRunIds.slice(-49), runId],
    challenges: {
      ...synced.challenges,
      cumulativeDistance: synced.challenges.cumulativeDistance + remDist,
      soloDistance: synced.challenges.soloDistance + remSoloDist,
      cumulativeCoins: synced.challenges.cumulativeCoins + remCoins,
      totalRaceRewardCoins: synced.challenges.totalRaceRewardCoins + coinsEarnedInt,
      cumulativeNearMisses: synced.challenges.cumulativeNearMisses + remNearMisses,
      highSpeedNearMisses: synced.challenges.highSpeedNearMisses + remHighSpeedNm,
      cleanRaces: synced.challenges.cleanRaces + (isCleanRun ? 1 : 0),
      driftEvents: synced.challenges.driftEvents + remDrifts,
      successfulJumps: synced.challenges.successfulJumps + remJumps,
      tunnelsCompleted: synced.challenges.tunnelsCompleted + remTunnels,
      shieldAbsorptions: synced.challenges.shieldAbsorptions + remShields,
      nitroActivations: synced.challenges.nitroActivations + remNitros,
      cumulativeScore: synced.challenges.cumulativeScore + remScore,
    },
    dailyChallenges: applyDailyChallengeMetrics(synced.dailyChallenges, {
      dailyDistance: remDist,
      dailySoloDistance: remSoloDist,
      dailyCoinsPickedUp: remCoins,
      dailyNearMisses: remNearMisses,
      dailyHighSpeedNearMisses: remHighSpeedNm,
      dailyDriftEvents: remDrifts,
      dailyJumps: remJumps,
      dailyTunnels: remTunnels,
      dailyCleanRaces: isCleanRun ? 1 : 0,
      dailyShieldBlocks: remShields,
      dailyNitroActivations: remNitros,
      dailyScore: remScore,
    }),
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
    playerFinishedCourse?: boolean;
    collisionsCount?: number;
    nearMisses?: number;
    highSpeedNearMisses?: number;
    driftEvents?: number;
    levelDriftZonesClean?: number;
    successfulJumps?: number;
    tunnelsCompleted?: number;
    shieldAbsorptions?: number;
    nitroActivations?: number;
    alreadyCommitted?: LiveGameplayProgressDelta;
  }
): { applied: boolean; unlockedNextLevel: boolean; data: SaveGameData } {
  if (!runId || save.processedRunIds.includes(runId)) {
    return { applied: false, unlockedNextLevel: false, data: save };
  }

  const synced = ensureCurrentDailyChallenges(save);
  const committed = result.alreadyCommitted ?? {};

  const lvl = Math.max(1, Math.floor(result.levelNumber));
  const pos = Math.max(1, Math.min(6, Math.floor(result.playerPosition)));
  const finishedCourse = result.playerFinishedCourse !== false;
  const qualifiedForNextLevel = finishedCourse && pos <= 3;

  const prevRecord = synced.levelsProgression.completedLevels[lvl];
  const updatedRecord: LevelCompletionRecord = {
    bestPosition: prevRecord ? Math.min(prevRecord.bestPosition, pos) : pos,
    bestTimeSec: prevRecord
      ? Math.min(prevRecord.bestTimeSec, Number(result.finishTimeSec.toFixed(2)))
      : Number(result.finishTimeSec.toFixed(2)),
    wins: (prevRecord?.wins ?? 0) + (finishedCourse && pos === 1 ? 1 : 0),
  };

  const nextHighestUnlocked =
    qualifiedForNextLevel && lvl >= synced.levelsProgression.highestUnlockedLevel
      ? lvl + 1
      : synced.levelsProgression.highestUnlockedLevel;

  const unlockedNextLevel =
    nextHighestUnlocked > synced.levelsProgression.highestUnlockedLevel;

  const remDist = Math.max(
    0,
    Math.floor(result.distanceMeters) - Math.floor(committed.distanceMeters ?? 0)
  );
  const remCoins = Math.max(
    0,
    Math.floor(result.rawCoinsPickedUp) - Math.floor(committed.rawCoinsPickedUp ?? 0)
  );
  const remNearMisses = Math.max(
    0,
    Math.floor(result.nearMisses ?? 0) - Math.floor(committed.nearMisses ?? 0)
  );
  const remHighSpeedNm = Math.max(
    0,
    Math.floor(result.highSpeedNearMisses ?? 0) -
      Math.floor(committed.highSpeedNearMisses ?? 0)
  );
  const remDrifts = Math.max(
    0,
    Math.floor(result.driftEvents ?? 0) - Math.floor(committed.driftEvents ?? 0)
  );
  const remDriftZones = Math.max(
    0,
    Math.floor(result.levelDriftZonesClean ?? 0) -
      Math.floor(committed.levelDriftZonesClean ?? 0)
  );
  const remJumps = Math.max(
    0,
    Math.floor(result.successfulJumps ?? 0) - Math.floor(committed.successfulJumps ?? 0)
  );
  const remTunnels = Math.max(
    0,
    Math.floor(result.tunnelsCompleted ?? 0) - Math.floor(committed.tunnelsCompleted ?? 0)
  );
  const remShields = Math.max(
    0,
    Math.floor(result.shieldAbsorptions ?? 0) -
      Math.floor(committed.shieldAbsorptions ?? 0)
  );
  const remNitros = Math.max(
    0,
    Math.floor(result.nitroActivations ?? 0) - Math.floor(committed.nitroActivations ?? 0)
  );
  const remScore = Math.max(
    0,
    Math.floor(result.score) - Math.floor(committed.score ?? 0)
  );

  const coinsEarnedInt = Math.max(0, Math.floor(result.totalCoinsEarned));
  const isWin = finishedCourse && pos === 1;
  const isPodium = finishedCourse && pos <= 3;
  const isCleanFinish =
    finishedCourse &&
    result.collisionsCount !== undefined &&
    result.collisionsCount === 0;

  const updated: SaveGameData = {
    ...synced,
    coins: synced.coins + coinsEarnedInt,
    completedRacesCount: synced.completedRacesCount + 1,
    processedRunIds: [...synced.processedRunIds.slice(-49), runId],
    levelsProgression: {
      highestUnlockedLevel: nextHighestUnlocked,
      selectedLevel: qualifiedForNextLevel ? lvl + 1 : lvl,
      completedLevels: finishedCourse
        ? {
            ...synced.levelsProgression.completedLevels,
            [lvl]: updatedRecord,
          }
        : synced.levelsProgression.completedLevels,
    },
    challenges: {
      ...synced.challenges,
      cumulativeDistance: synced.challenges.cumulativeDistance + remDist,
      cumulativeCoins: synced.challenges.cumulativeCoins + remCoins,
      totalRaceRewardCoins: synced.challenges.totalRaceRewardCoins + coinsEarnedInt,
      cumulativeNearMisses: synced.challenges.cumulativeNearMisses + remNearMisses,
      highSpeedNearMisses: synced.challenges.highSpeedNearMisses + remHighSpeedNm,
      cleanRaces: synced.challenges.cleanRaces + (isCleanFinish ? 1 : 0),
      driftEvents: synced.challenges.driftEvents + remDrifts,
      levelDriftZonesClean: synced.challenges.levelDriftZonesClean + remDriftZones,
      successfulJumps: synced.challenges.successfulJumps + remJumps,
      tunnelsCompleted: synced.challenges.tunnelsCompleted + remTunnels,
      levelsWins: synced.challenges.levelsWins + (isWin ? 1 : 0),
      levelsPodiums: synced.challenges.levelsPodiums + (isPodium ? 1 : 0),
      levelsCleanFinishes:
        synced.challenges.levelsCleanFinishes + (isCleanFinish ? 1 : 0),
      shieldAbsorptions: synced.challenges.shieldAbsorptions + remShields,
      nitroActivations: synced.challenges.nitroActivations + remNitros,
      cumulativeScore: synced.challenges.cumulativeScore + remScore,
    },
    dailyChallenges: applyDailyChallengeMetrics(synced.dailyChallenges, {
      dailyDistance: remDist,
      dailyCoinsPickedUp: remCoins,
      dailyNearMisses: remNearMisses,
      dailyHighSpeedNearMisses: remHighSpeedNm,
      dailyDriftEvents: remDrifts,
      dailyJumps: remJumps,
      dailyTunnels: remTunnels,
      dailyLevelsCompleted: finishedCourse ? 1 : 0,
      dailyLevelsPodiums: isPodium ? 1 : 0,
      dailyLevelsWins: isWin ? 1 : 0,
      dailyCleanRaces: isCleanFinish ? 1 : 0,
      dailyShieldBlocks: remShields,
      dailyNitroActivations: remNitros,
      dailyScore: remScore,
    }),
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
 * Pure transaction: Claim a completed lifetime challenge reward once.
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

  const currentVal = getChallengeMetricValue(save, challenge.metric);

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
 * Pure transaction: Claim a completed Daily Challenge reward once for the active UTC day.
 * Also updates the player's Daily Streak (at most once per UTC day).
 */
export function tryClaimDailyChallengeReward(
  save: SaveGameData,
  dailyChallengeId: string,
  currentUtcDate: string = getCurrentUtcDateString()
): {
  success: boolean;
  reason?: string;
  reward: number;
  streakIncremented: boolean;
  data: SaveGameData;
} {
  const synced = ensureCurrentDailyChallenges(save, currentUtcDate);
  const dc = synced.dailyChallenges;
  const idx = dc.items.findIndex((item) => item.id === dailyChallengeId);
  if (idx === -1) {
    return {
      success: false,
      reason: 'Daily challenge expired or not found.',
      reward: 0,
      streakIncremented: false,
      data: synced,
    };
  }

  const targetItem = dc.items[idx];
  if (targetItem.claimed) {
    return {
      success: false,
      reason: 'Daily challenge reward already claimed.',
      reward: 0,
      streakIncremented: false,
      data: synced,
    };
  }

  if (targetItem.currentValue < targetItem.targetValue) {
    return {
      success: false,
      reason: `Progress incomplete (${targetItem.currentValue}/${targetItem.targetValue}).`,
      reward: 0,
      streakIncremented: false,
      data: synced,
    };
  }

  const nextItems = dc.items.map((item, i) =>
    i === idx ? { ...item, claimed: true } : item
  );

  // Update Daily Streak at most once per UTC day when at least 1 daily challenge is completed & claimed
  let nextStreak = dc.currentStreak;
  let nextBestStreak = dc.bestStreak;
  let nextLastStreakDate = dc.lastStreakDateUtc;
  let streakIncremented = false;

  if (dc.lastStreakDateUtc !== dc.dateUtc) {
    const yesterdayUtc = getPreviousUtcDateString(dc.dateUtc);
    nextStreak = dc.lastStreakDateUtc === yesterdayUtc ? dc.currentStreak + 1 : 1;
    nextBestStreak = Math.max(dc.bestStreak, nextStreak);
    nextLastStreakDate = dc.dateUtc;
    streakIncremented = true;
  }

  const updated: SaveGameData = {
    ...synced,
    coins: synced.coins + targetItem.rewardCoins,
    dailyChallenges: {
      ...dc,
      items: nextItems,
      currentStreak: nextStreak,
      bestStreak: nextBestStreak,
      lastStreakDateUtc: nextLastStreakDate,
    },
  };

  return {
    success: true,
    reward: targetItem.rewardCoins,
    streakIncremented,
    data: updated,
  };
}

/**
 * Pure transaction: Claim the 250-coin Daily Completion Bonus once all 3 daily challenges
 * for the active UTC day are completed.
 */
export function tryClaimDailyCompletionBonus(
  save: SaveGameData,
  currentUtcDate: string = getCurrentUtcDateString()
): { success: boolean; reason?: string; reward: number; data: SaveGameData } {
  const synced = ensureCurrentDailyChallenges(save, currentUtcDate);
  const dc = synced.dailyChallenges;

  if (dc.bonusClaimed) {
    return {
      success: false,
      reason: 'Daily completion bonus already claimed today.',
      reward: 0,
      data: synced,
    };
  }

  const allCompleted =
    dc.items.length === 3 &&
    dc.items.every((item) => item.currentValue >= item.targetValue);

  if (!allCompleted) {
    return {
      success: false,
      reason: 'Complete all 3 daily challenges first to unlock the Daily Bonus.',
      reward: 0,
      data: synced,
    };
  }

  // Also ensure streak is credited if they claim bonus before individual claim
  let nextStreak = dc.currentStreak;
  let nextBestStreak = dc.bestStreak;
  let nextLastStreakDate = dc.lastStreakDateUtc;
  if (dc.lastStreakDateUtc !== dc.dateUtc) {
    const yesterdayUtc = getPreviousUtcDateString(dc.dateUtc);
    nextStreak = dc.lastStreakDateUtc === yesterdayUtc ? dc.currentStreak + 1 : 1;
    nextBestStreak = Math.max(dc.bestStreak, nextStreak);
    nextLastStreakDate = dc.dateUtc;
  }

  const updated: SaveGameData = {
    ...synced,
    coins: synced.coins + DAILY_COMPLETION_BONUS_COINS,
    dailyChallenges: {
      ...dc,
      bonusClaimed: true,
      currentStreak: nextStreak,
      bestStreak: nextBestStreak,
      lastStreakDateUtc: nextLastStreakDate,
    },
  };

  return {
    success: true,
    reward: DAILY_COMPLETION_BONUS_COINS,
    data: updated,
  };
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
