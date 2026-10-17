export type CarId = 'starter_apex' | 'vortex_interceptor' | 'nebula_hyper' | 'titan_enforcer';

export type UpgradeStatKey = 'topSpeed' | 'acceleration' | 'handling' | 'nitro';

export type SteeringMode = 'tilt' | 'buttons' | 'drag';
export type SensitivityLevel = 'low' | 'medium' | 'high';
export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface CarBaseStats {
  topSpeedKmh: number;      // e.g. 220 - 310 km/h
  acceleration: number;     // m/s^2 base
  handling: number;         // lateral speed m/s
  nitroCapacity: number;    // seconds of boost
}

export interface CarConfig {
  id: CarId;
  name: string;
  classTag: string;
  description: string;
  unlockCost: number;
  primaryColor: number;
  primaryHex: string;
  accentColor: number;
  accentHex: string;
  bodyStyle: 'coupe' | 'interceptor' | 'hypercar' | 'gt_armored';
  baseStats: CarBaseStats;
}

export interface UpgradeTrackConfig {
  key: UpgradeStatKey;
  label: string;
  unitLabel: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  perLevelBonusPct: number;
}

export interface ChallengeConfig {
  id: string;
  title: string;
  description: string;
  metric: 'distance' | 'coins' | 'nearMisses' | 'score';
  targetValue: number;
  rewardCoins: number;
}

export const HIGHWAY_CONFIG = {
  laneCount: 4,
  laneWidth: 3.5,
  laneCenters: [-5.25, -1.75, 1.75, 5.25] as const,
  roadWidth: 16,
  playerBoundX: 6.2,
  minSpawnDistanceAhead: 85,
  maxSpawnDistanceAhead: 155,
  despawnDistanceBehind: -28,
  minLongitudinalGap: 22,
  nearMissLateralThreshold: 2.35,
  nearMissZWindow: 3.8,
  baseMinSpeedKmh: 75,
  nitroSpeedMultiplier: 1.36,
  nitroRechargeRatePerSec: 0.14,
  nearMissNitroBonus: 0.22,
  nearMissScoreBonus: 150,
  nearMissCoinBonus: 3,
  coinPickupScore: 50,
  coinPickupValue: 5,
  maxHullIntegrity: 3,
};

export const CAR_CONFIGS: Record<CarId, CarConfig> = {
  starter_apex: {
    id: 'starter_apex',
    name: 'Apex GT-R',
    classTag: 'Sport Coupe · Class B',
    description: 'Balanced twin-turbo highway coupe with predictable chassis response and crisp turn-in.',
    unlockCost: 0,
    primaryColor: 0x06b6d4,
    primaryHex: '#06B6D4',
    accentColor: 0xf59e0b,
    accentHex: '#F59E0B',
    bodyStyle: 'coupe',
    baseStats: {
      topSpeedKmh: 230,
      acceleration: 22,
      handling: 14.5,
      nitroCapacity: 4.0,
    },
  },
  vortex_interceptor: {
    id: 'vortex_interceptor',
    name: 'Vortex S7',
    classTag: 'Street Interceptor · Class A',
    description: 'Lightweight aerodynamic wedge engineered for rapid lane weaving and high-reflex near-misses.',
    unlockCost: 500,
    primaryColor: 0xf59e0b,
    primaryHex: '#F59E0B',
    accentColor: 0x06b6d4,
    accentHex: '#06B6D4',
    bodyStyle: 'interceptor',
    baseStats: {
      topSpeedKmh: 258,
      acceleration: 25.5,
      handling: 17.0,
      nitroCapacity: 4.5,
    },
  },
  nebula_hyper: {
    id: 'nebula_hyper',
    name: 'Nebula X-1',
    classTag: 'Prototype Hypercar · Class S',
    description: 'Low-slung carbon monocoque hypercar with active ground-effect venturi tunnels and extended nitro core.',
    unlockCost: 1200,
    primaryColor: 0xef4444,
    primaryHex: '#EF4444',
    accentColor: 0x38bdf8,
    accentHex: '#38BDF8',
    bodyStyle: 'hypercar',
    baseStats: {
      topSpeedKmh: 292,
      acceleration: 29.0,
      handling: 18.2,
      nitroCapacity: 5.4,
    },
  },
  titan_enforcer: {
    id: 'titan_enforcer',
    name: 'Titan V12',
    classTag: 'Grand Tourer · Class S+',
    description: 'Widebody flagship V12 grand tourer combining blistering highway terminal velocity with maximum nitro thrust.',
    unlockCost: 2200,
    primaryColor: 0x10b981,
    primaryHex: '#10B981',
    accentColor: 0xfbbf24,
    accentHex: '#FBBF24',
    bodyStyle: 'gt_armored',
    baseStats: {
      topSpeedKmh: 315,
      acceleration: 31.5,
      handling: 17.5,
      nitroCapacity: 6.2,
    },
  },
};

export const CAR_ORDER: CarId[] = [
  'starter_apex',
  'vortex_interceptor',
  'nebula_hyper',
  'titan_enforcer',
];

export const UPGRADE_TRACKS: Record<UpgradeStatKey, UpgradeTrackConfig> = {
  topSpeed: {
    key: 'topSpeed',
    label: 'Top Speed',
    unitLabel: 'km/h',
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.55,
    perLevelBonusPct: 0.045,
  },
  acceleration: {
    key: 'acceleration',
    label: 'Acceleration',
    unitLabel: 'm/s²',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.5,
    perLevelBonusPct: 0.06,
  },
  handling: {
    key: 'handling',
    label: 'Handling',
    unitLabel: 'Lat G',
    maxLevel: 5,
    baseCost: 110,
    costMultiplier: 1.5,
    perLevelBonusPct: 0.055,
  },
  nitro: {
    key: 'nitro',
    label: 'Nitro Core',
    unitLabel: 'sec',
    maxLevel: 5,
    baseCost: 130,
    costMultiplier: 1.6,
    perLevelBonusPct: 0.08,
  },
};

export const CHALLENGES_CONFIG: ChallengeConfig[] = [
  {
    id: 'dist_1000',
    title: 'Highway Cruiser',
    description: 'Drive a cumulative distance of 1,000 meters across races.',
    metric: 'distance',
    targetValue: 1000,
    rewardCoins: 250,
  },
  {
    id: 'coins_75',
    title: 'Bullion Collector',
    description: 'Collect 75 highway coins from active traffic lanes.',
    metric: 'coins',
    targetValue: 75,
    rewardCoins: 300,
  },
  {
    id: 'nearmiss_12',
    title: 'Thread the Needle',
    description: 'Execute 12 high-speed traffic near-misses without crashing.',
    metric: 'nearMisses',
    targetValue: 12,
    rewardCoins: 350,
  },
  {
    id: 'score_10000',
    title: 'Velocity Legend',
    description: 'Reach a cumulative score of 10,000 points across runs.',
    metric: 'score',
    targetValue: 10000,
    rewardCoins: 500,
  },
];

export const SENSITIVITY_MULTIPLIERS: Record<SensitivityLevel, number> = {
  low: 0.68,
  medium: 1.0,
  high: 1.42,
};

export const AD_CONFIG = {
  interstitialMinCompletedRaces: 3,
  interstitialCooldownMs: 3 * 60 * 1000, // 3 minutes
  rewardedPostRaceMultiplier: 2,
  testAppIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
  testRewardedUnitIdAndroid: 'ca-app-pub-3940256099942544/5224354917',
  testInterstitialUnitIdAndroid: 'ca-app-pub-3940256099942544/1033173712',
  testBannerUnitIdAndroid: 'ca-app-pub-3940256099942544/6300978111',
};
