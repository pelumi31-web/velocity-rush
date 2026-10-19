export type CarId =
  | 'starter_apex'
  | 'urban_sentinel'
  | 'vortex_interceptor'
  | 'ironclad_magnum'
  | 'dune_raider'
  | 'nebula_hyper'
  | 'titan_enforcer'
  | 'apex_valkyrie';

export type UpgradeStatKey =
  | 'topSpeed'
  | 'acceleration'
  | 'handling'
  | 'braking'
  | 'nitro';

export type ProtectionUpgradeKey = 'shieldCapacity' | 'shieldDuration';

export type SteeringMode = 'tilt' | 'buttons' | 'drag';
export type SensitivityLevel = 'low' | 'medium' | 'high';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type GamePlayMode = 'solo' | 'levels';

export type CarBodyStyle =
  | 'electric_sedan'
  | 'sport_sedan'
  | 'sports_coupe'
  | 'classic_muscle'
  | 'offroad_raider'
  | 'exotic_supercar'
  | 'luxury_suv'
  | 'track_prototype';

export type WheelId =
  | 'std_alloy'
  | 'sport_twin5'
  | 'multi_mesh'
  | 'aero_turbine'
  | 'luxury_forged'
  | 'track_beadlock';

export type PaintFinishType = 'gloss' | 'matte' | 'metallic';

export type SpoilerId =
  | 'spoiler_stock'
  | 'spoiler_street'
  | 'spoiler_gt_wing'
  | 'spoiler_track_high';

export type BumperId = 'bumper_stock' | 'bumper_canard' | 'bumper_gt_pro';

export type SkirtId = 'skirt_stock' | 'skirt_aero' | 'skirt_widebody';

export type RoofAccessoryId =
  | 'roof_none'
  | 'roof_scoop'
  | 'roof_lightbar'
  | 'roof_box';

export type StripeStyleId = 'stripe_none' | 'stripe_dual' | 'stripe_center';

export type UnderglowId =
  | 'glow_none'
  | 'glow_cyan'
  | 'glow_amber'
  | 'glow_magenta'
  | 'glow_emerald';

export interface CarBaseStats {
  topSpeedKmh: number;      // 225 - 335 km/h
  acceleration: number;     // 0-100 rating
  handling: number;         // lateral speed m/s & cornering authority
  nitroCapacity: number;    // seconds of continuous boost
  brakingDecelMs2: number;  // braking deceleration m/s^2
}

export interface CarConfig {
  id: CarId;
  name: string;
  category: string;
  classTag: string;
  description: string;
  unlockCost: number;
  primaryColor: number;
  primaryHex: string;
  secondaryColor: number;
  accentColor: number;
  accentHex: string;
  caliperColor: number;
  bodyStyle: CarBodyStyle;
  baseStats: CarBaseStats;
  compatibleSpoilers: SpoilerId[];
  compatibleBumpers: BumperId[];
  compatibleSkirts: SkirtId[];
  compatibleRoofAccessories: RoofAccessoryId[];
}

export interface WheelConfig {
  id: WheelId;
  name: string;
  categoryLabel: string;
  description: string;
  price: number;
  spokeCount: number;
  spokeStyle: 'five_star' | 'twin_spoke' | 'multi_mesh' | 'aero_ring' | 'forged_luxury' | 'beadlock_slick';
  handlingBonusPct: number;
  brakingBonusPct: number;
  topSpeedBonusKmh: number;
}

export interface PaintPresetConfig {
  id: string;
  name: string;
  hex: string;
  colorInt: number;
  price: number;
}

export interface PaintFinishConfig {
  id: PaintFinishType;
  name: string;
  description: string;
  price: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

export interface WheelColorConfig {
  id: string;
  name: string;
  hex: string;
  colorInt: number;
  price: number;
}

export interface StripeOptionConfig {
  id: StripeStyleId;
  name: string;
  price: number;
}

export interface UnderglowOptionConfig {
  id: UnderglowId;
  name: string;
  hex: string;
  colorInt: number;
  price: number;
}

export interface BodyPartOptionConfig<T extends string> {
  id: T;
  name: string;
  category: 'spoiler' | 'bumper' | 'skirt' | 'roof';
  description: string;
  price: number;
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

export interface ProtectionTrackConfig {
  key: ProtectionUpgradeKey;
  label: string;
  unitLabel: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
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
  laneWidth: 3.6,
  laneCenters: [-5.4, -1.8, 1.8, 5.4] as const,
  roadWidth: 16.4,
  playerBoundX: 6.4,
  minSpawnDistanceAhead: 90,
  maxSpawnDistanceAhead: 165,
  despawnDistanceBehind: -30,
  minLongitudinalGap: 25,
  nearMissLateralThreshold: 2.35,
  nearMissZWindow: 3.8,
  launchSpeedKmh: 62,
  minBrakeSpeedKmh: 45,
  nitroSpeedMultiplier: 1.32,
  nitroMinActivationThreshold: 0.15,
  nitroRechargeRatePerSec: 0.11,
  nearMissNitroBonus: 0.24,
  nearMissScoreBonus: 150,
  nearMissCoinBonus: 3,
  coinPickupScore: 50,
  coinPickupValue: 5,
  maxHullIntegrity: 3,
};

export const CAR_CONFIGS: Record<CarId, CarConfig> = {
  starter_apex: {
    id: 'starter_apex',
    name: 'Volt GT-E',
    category: 'Electric Performance Vehicle',
    classTag: 'Electric Fastback · Class B',
    description:
      'Dual-motor all-wheel-drive electric sport fastback with instant low-end torque, low center of gravity, and balanced highway poise.',
    unlockCost: 0,
    primaryColor: 0x0ea5e9,
    primaryHex: '#0EA5E9',
    secondaryColor: 0x0f172a,
    accentColor: 0x38bdf8,
    accentHex: '#38BDF8',
    caliperColor: 0x06b6d4,
    bodyStyle: 'electric_sedan',
    baseStats: {
      topSpeedKmh: 228,
      acceleration: 64,
      handling: 15.4,
      nitroCapacity: 4.0,
      brakingDecelMs2: 26,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_street', 'spoiler_gt_wing'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard', 'bumper_gt_pro'],
    compatibleSkirts: ['skirt_stock', 'skirt_aero', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_scoop', 'roof_box'],
  },
  urban_sentinel: {
    id: 'urban_sentinel',
    name: 'Strada RS-4',
    category: 'Sport Sedan',
    classTag: 'Twin-Turbo Saloon · Class B+',
    description:
      'Precision-tuned executive sport sedan with flared fenders, aggressive front intercooler intake, and responsive four-wheel steering.',
    unlockCost: 320,
    primaryColor: 0x6366f1,
    primaryHex: '#6366F1',
    secondaryColor: 0x0f172a,
    accentColor: 0x818cf8,
    accentHex: '#818CF8',
    caliperColor: 0x38bdf8,
    bodyStyle: 'sport_sedan',
    baseStats: {
      topSpeedKmh: 244,
      acceleration: 68,
      handling: 16.5,
      nitroCapacity: 4.3,
      brakingDecelMs2: 28,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_street', 'spoiler_gt_wing'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard', 'bumper_gt_pro'],
    compatibleSkirts: ['skirt_stock', 'skirt_aero', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_scoop', 'roof_box'],
  },
  vortex_interceptor: {
    id: 'vortex_interceptor',
    name: 'Corsa V8 GT',
    category: 'High-Performance Coupe',
    classTag: 'Grand Touring Coupe · Class A',
    description:
      'Front-mid V8 widebody sports coupe featuring a sculpted long hood, swan-neck GT rear wing, and razor-sharp lane-change authority.',
    unlockCost: 500,
    primaryColor: 0xf59e0b,
    primaryHex: '#F59E0B',
    secondaryColor: 0x18181b,
    accentColor: 0xfbbf24,
    accentHex: '#FBBF24',
    caliperColor: 0xef4444,
    bodyStyle: 'sports_coupe',
    baseStats: {
      topSpeedKmh: 264,
      acceleration: 74,
      handling: 17.6,
      nitroCapacity: 4.6,
      brakingDecelMs2: 30,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_street', 'spoiler_gt_wing', 'spoiler_track_high'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard', 'bumper_gt_pro'],
    compatibleSkirts: ['skirt_stock', 'skirt_aero', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_scoop'],
  },
  ironclad_magnum: {
    id: 'ironclad_magnum',
    name: 'Valkyrie 426 Hemi',
    category: 'Classic Muscle Car',
    classTag: 'Supercharged V8 Muscle · Class A',
    description:
      'Iconic American iron reborn with a towering chrome supercharger hood blower, deep-dish rear drag radials, and ferocious straight-line punch.',
    unlockCost: 780,
    primaryColor: 0xea580c,
    primaryHex: '#EA580C',
    secondaryColor: 0x111827,
    accentColor: 0xfb923c,
    accentHex: '#FB923C',
    caliperColor: 0xfacc15,
    bodyStyle: 'classic_muscle',
    baseStats: {
      topSpeedKmh: 276,
      acceleration: 84,
      handling: 15.8,
      nitroCapacity: 5.2,
      brakingDecelMs2: 27,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_street', 'spoiler_gt_wing'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard'],
    compatibleSkirts: ['skirt_stock', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_scoop'],
  },
  dune_raider: {
    id: 'dune_raider',
    name: 'Baja Raptor X',
    category: 'Off-Road Performance Vehicle',
    classTag: 'Desert Raid Trophy Truck · Class A+',
    description:
      'Long-travel suspension off-road raid machine equipped with heavy-duty tubular bullbar, high-clearance fenders, and unstoppable stability.',
    unlockCost: 1050,
    primaryColor: 0x84cc16,
    primaryHex: '#84CC16',
    secondaryColor: 0x1e293b,
    accentColor: 0xa3e635,
    accentHex: '#A3E635',
    caliperColor: 0xf97316,
    bodyStyle: 'offroad_raider',
    baseStats: {
      topSpeedKmh: 258,
      acceleration: 79,
      handling: 17.2,
      nitroCapacity: 5.8,
      brakingDecelMs2: 31,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_street'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard'],
    compatibleSkirts: ['skirt_stock', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_lightbar', 'roof_box'],
  },
  nebula_hyper: {
    id: 'nebula_hyper',
    name: 'Aethelgard X-R',
    category: 'Exotic Supercar',
    classTag: 'Carbon Monocoque Supercar · Class S',
    description:
      'Ultra-low cab-forward mid-engine supercar with flying-buttress air channels, active ground-effect venturi tunnels, and blistering velocity.',
    unlockCost: 1400,
    primaryColor: 0xdc2626,
    primaryHex: '#DC2626',
    secondaryColor: 0x090d16,
    accentColor: 0xf97316,
    accentHex: '#F97316',
    caliperColor: 0xfacc15,
    bodyStyle: 'exotic_supercar',
    baseStats: {
      topSpeedKmh: 306,
      acceleration: 89,
      handling: 19.5,
      nitroCapacity: 5.5,
      brakingDecelMs2: 35,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_gt_wing', 'spoiler_track_high'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard', 'bumper_gt_pro'],
    compatibleSkirts: ['skirt_stock', 'skirt_aero', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_scoop'],
  },
  titan_enforcer: {
    id: 'titan_enforcer',
    name: 'Monarch SVR',
    category: 'Luxury SUV',
    classTag: 'Twin-Turbo V12 Super SUV · Class S',
    description:
      'Commanding wide-stance luxury performance SUV combining massive twin-turbo V12 thrust, high-capacity nitro reservoirs, and armored presence.',
    unlockCost: 1900,
    primaryColor: 0x10b981,
    primaryHex: '#10B981',
    secondaryColor: 0x0f172a,
    accentColor: 0x34d399,
    accentHex: '#34D399',
    caliperColor: 0xf59e0b,
    bodyStyle: 'luxury_suv',
    baseStats: {
      topSpeedKmh: 292,
      acceleration: 83,
      handling: 17.0,
      nitroCapacity: 6.5,
      brakingDecelMs2: 33,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_street'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard', 'bumper_gt_pro'],
    compatibleSkirts: ['skirt_stock', 'skirt_aero', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_lightbar', 'roof_box'],
  },
  apex_valkyrie: {
    id: 'apex_valkyrie',
    name: 'Solstice LMP-GT',
    category: 'Track-Focused Racing Car',
    classTag: 'Le Mans Hyper-Prototype · Class S+',
    description:
      'Purpose-built endurance prototype featuring a central dorsal stabilizer fin, carbon dive-plane canards, and extreme aerodynamic downforce.',
    unlockCost: 2600,
    primaryColor: 0xa855f7,
    primaryHex: '#A855F7',
    secondaryColor: 0x090d16,
    accentColor: 0x22d3ee,
    accentHex: '#22D3EE',
    caliperColor: 0x22d3ee,
    bodyStyle: 'track_prototype',
    baseStats: {
      topSpeedKmh: 328,
      acceleration: 95,
      handling: 21.4,
      nitroCapacity: 6.2,
      brakingDecelMs2: 39,
    },
    compatibleSpoilers: ['spoiler_stock', 'spoiler_gt_wing', 'spoiler_track_high'],
    compatibleBumpers: ['bumper_stock', 'bumper_canard', 'bumper_gt_pro'],
    compatibleSkirts: ['skirt_stock', 'skirt_aero', 'skirt_widebody'],
    compatibleRoofAccessories: ['roof_none', 'roof_scoop'],
  },
};

export const CAR_ORDER: CarId[] = [
  'starter_apex',
  'urban_sentinel',
  'vortex_interceptor',
  'ironclad_magnum',
  'dune_raider',
  'nebula_hyper',
  'titan_enforcer',
  'apex_valkyrie',
];

export const WHEEL_CONFIGS: Record<WheelId, WheelConfig> = {
  std_alloy: {
    id: 'std_alloy',
    name: 'Apex 5-Spoke Alloy',
    categoryLabel: 'Standard Alloy · Street Compound',
    description: 'Factory balanced 5-spoke split alloy wheels with all-season performance radials.',
    price: 0,
    spokeCount: 5,
    spokeStyle: 'five_star',
    handlingBonusPct: 0,
    brakingBonusPct: 0,
    topSpeedBonusKmh: 0,
  },
  sport_twin5: {
    id: 'sport_twin5',
    name: 'Veloce Twin-10 Sport',
    categoryLabel: 'Sport Alloy · High-Grip Compound',
    description: 'Lightweight twin-5 spoke forged rims wrapped in stiffer sidewall sport tyres (+2% Handling).',
    price: 150,
    spokeCount: 10,
    spokeStyle: 'twin_spoke',
    handlingBonusPct: 0.02,
    brakingBonusPct: 0.01,
    topSpeedBonusKmh: 0,
  },
  multi_mesh: {
    id: 'multi_mesh',
    name: 'BBS-GT Multi-Spoke',
    categoryLabel: 'Multi-Spoke Racing · Semi-Slick',
    description: 'Motorsport 12-spoke cross-mesh racing wheels with heat-cycled semi-slick tread (+3.5% Handling, +2% Braking).',
    price: 240,
    spokeCount: 12,
    spokeStyle: 'multi_mesh',
    handlingBonusPct: 0.035,
    brakingBonusPct: 0.02,
    topSpeedBonusKmh: 1,
  },
  aero_turbine: {
    id: 'aero_turbine',
    name: 'Chronos Aero Turbine',
    categoryLabel: 'Performance Aero · Low-Drag',
    description: 'Directional carbon aero-fan blades that extract brake heat and reduce wheel-well drag (+3% Handling, +3 km/h Top Speed).',
    price: 320,
    spokeCount: 8,
    spokeStyle: 'aero_ring',
    handlingBonusPct: 0.03,
    brakingBonusPct: 0.03,
    topSpeedBonusKmh: 3,
  },
  luxury_forged: {
    id: 'luxury_forged',
    name: 'Monarch Diamond Cut',
    categoryLabel: 'Premium Luxury · Acoustic Grip',
    description: 'Deep-dish multi-piece luxury forged wheels with ultra-wide contact patch (+4.5% Handling, +4% Braking).',
    price: 400,
    spokeCount: 7,
    spokeStyle: 'forged_luxury',
    handlingBonusPct: 0.045,
    brakingBonusPct: 0.04,
    topSpeedBonusKmh: 2,
  },
  track_beadlock: {
    id: 'track_beadlock',
    name: 'Podium Center-Lock Slicks',
    categoryLabel: 'Custom Track · Soft Racing Slick',
    description: 'Center-lock magnesium racing wheels with colored sidewall ring and soft compound slicks (+7% Handling, +6% Braking).',
    price: 520,
    spokeCount: 6,
    spokeStyle: 'beadlock_slick',
    handlingBonusPct: 0.07,
    brakingBonusPct: 0.06,
    topSpeedBonusKmh: 4,
  },
};

export const WHEEL_ORDER: WheelId[] = [
  'std_alloy',
  'sport_twin5',
  'multi_mesh',
  'aero_turbine',
  'luxury_forged',
  'track_beadlock',
];

export const PAINT_PRESETS: PaintPresetConfig[] = [
  { id: 'paint_factory', name: 'Factory Signature', hex: '#0EA5E9', colorInt: 0x0ea5e9, price: 0 },
  { id: 'paint_crimson', name: 'Corsa Crimson', hex: '#DC2626', colorInt: 0xdc2626, price: 80 },
  { id: 'paint_amber', name: 'Solaris Gold', hex: '#F59E0B', colorInt: 0xf59e0b, price: 80 },
  { id: 'paint_emerald', name: 'Emerald Stealth', hex: '#10B981', colorInt: 0x10b981, price: 100 },
  { id: 'paint_ultraviolet', name: 'Ultraviolet Pulse', hex: '#8B5CF6', colorInt: 0x8b5cf6, price: 120 },
  { id: 'paint_obsidian', name: 'Obsidian Phantom', hex: '#1E293B', colorInt: 0x1e293b, price: 140 },
  { id: 'paint_arctic', name: 'Arctic Pearl White', hex: '#F1F5F9', colorInt: 0xf1f5f9, price: 140 },
  { id: 'paint_magenta', name: 'Hyper Magenta', hex: '#EC4899', colorInt: 0xec4899, price: 160 },
  { id: 'paint_lime', name: 'Krypton Acid Lime', hex: '#84CC16', colorInt: 0x84cc16, price: 160 },
  { id: 'paint_titanium', name: 'Liquid Titanium', hex: '#94A3B8', colorInt: 0x94a3b8, price: 180 },
];

export const PAINT_FINISHES: Record<PaintFinishType, PaintFinishConfig> = {
  gloss: {
    id: 'gloss',
    name: 'Showroom Gloss',
    description: 'Deep wet-look automotive clearcoat reflection.',
    price: 0,
    metalness: 0.65,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  },
  matte: {
    id: 'matte',
    name: 'Stealth Satin Matte',
    description: 'Low-sheen diffused stealth finish that highlights body creases.',
    price: 140,
    metalness: 0.28,
    roughness: 0.62,
    clearcoat: 0.12,
    clearcoatRoughness: 0.48,
  },
  metallic: {
    id: 'metallic',
    name: 'Liquid Metallic Flake',
    description: 'High-metalness specular finish with mirror clearcoat depth.',
    price: 200,
    metalness: 0.92,
    roughness: 0.11,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  },
};

export const WHEEL_COLORS: WheelColorConfig[] = [
  { id: 'rim_silver', name: 'Machined Silver', hex: '#E2E8F0', colorInt: 0xe2e8f0, price: 0 },
  { id: 'rim_carbon', name: 'Satin Gunmetal', hex: '#334155', colorInt: 0x334155, price: 60 },
  { id: 'rim_gold', name: 'Forged Champagne Gold', hex: '#FBBF24', colorInt: 0xfbbf24, price: 90 },
  { id: 'rim_bronze', name: 'Motorsport Bronze', hex: '#D97706', colorInt: 0xd97706, price: 90 },
  { id: 'rim_cyan', name: 'Electric Cyan Anodized', hex: '#22D3EE', colorInt: 0x22d3ee, price: 110 },
  { id: 'rim_crimson', name: 'Track Red Anodized', hex: '#EF4444', colorInt: 0xef4444, price: 110 },
];

export const STRIPE_OPTIONS: Record<StripeStyleId, StripeOptionConfig> = {
  stripe_none: { id: 'stripe_none', name: 'Clean Bodywork', price: 0 },
  stripe_dual: { id: 'stripe_dual', name: 'Dual Le Mans Stripes', price: 120 },
  stripe_center: { id: 'stripe_center', name: 'Center Apex Racing Stripe', price: 140 },
};

export const UNDERGLOW_OPTIONS: Record<UnderglowId, UnderglowOptionConfig> = {
  glow_none: { id: 'glow_none', name: 'No Underglow', hex: '#000000', colorInt: 0x000000, price: 0 },
  glow_cyan: { id: 'glow_cyan', name: 'Electric Cyan Neon', hex: '#06B6D4', colorInt: 0x06b6d4, price: 160 },
  glow_amber: { id: 'glow_amber', name: 'Solar Amber Neon', hex: '#F59E0B', colorInt: 0xf59e0b, price: 160 },
  glow_magenta: { id: 'glow_magenta', name: 'Synthwave Magenta Neon', hex: '#EC4899', colorInt: 0xec4899, price: 180 },
  glow_emerald: { id: 'glow_emerald', name: 'Toxic Emerald Neon', hex: '#10B981', colorInt: 0x10b981, price: 180 },
};

export const SPOILER_OPTIONS: Record<SpoilerId, BodyPartOptionConfig<SpoilerId>> = {
  spoiler_stock: {
    id: 'spoiler_stock',
    name: 'Factory Aero Trim',
    category: 'spoiler',
    description: 'Original manufacturer rear decklid configuration.',
    price: 0,
  },
  spoiler_street: {
    id: 'spoiler_street',
    name: 'Carbon Ducktail Lip',
    category: 'spoiler',
    description: 'Low-profile woven carbon rear decklid lip spoiler.',
    price: 140,
  },
  spoiler_gt_wing: {
    id: 'spoiler_gt_wing',
    name: 'GT Swan-Neck Wing',
    category: 'spoiler',
    description: 'Top-mounted aluminum swan-neck pylons with wide carbon airfoil.',
    price: 240,
  },
  spoiler_track_high: {
    id: 'spoiler_track_high',
    name: 'Time-Attack Dual Wing',
    category: 'spoiler',
    description: 'Towering dual-element carbon track wing with oversized endplates.',
    price: 340,
  },
};

export const BUMPER_OPTIONS: Record<BumperId, BodyPartOptionConfig<BumperId>> = {
  bumper_stock: {
    id: 'bumper_stock',
    name: 'Factory Front Fascia',
    category: 'bumper',
    description: 'Standard aerodynamic front bumper and chin spoiler.',
    price: 0,
  },
  bumper_canard: {
    id: 'bumper_canard',
    name: 'Street Twin-Canard Kit',
    category: 'bumper',
    description: 'Extended front lip with dual carbon dive-plane corner canards.',
    price: 150,
  },
  bumper_gt_pro: {
    id: 'bumper_gt_pro',
    name: 'Pro GT Race Splitter',
    category: 'bumper',
    description: 'Deep motorsport front splitter with anodized support tie-rods.',
    price: 250,
  },
};

export const SKIRT_OPTIONS: Record<SkirtId, BodyPartOptionConfig<SkirtId>> = {
  skirt_stock: {
    id: 'skirt_stock',
    name: 'Factory Rocker Panels',
    category: 'skirt',
    description: 'Clean original side sill profile.',
    price: 0,
  },
  skirt_aero: {
    id: 'skirt_aero',
    name: 'Carbon Aero Side Blades',
    category: 'skirt',
    description: 'Flared lower carbon rocker blades with rear vertical winglets.',
    price: 160,
  },
  skirt_widebody: {
    id: 'skirt_widebody',
    name: 'Widebody Vent Kit',
    category: 'skirt',
    description: 'Aggressive over-fender air louvers and wide step sills.',
    price: 280,
  },
};

export const ROOF_OPTIONS: Record<RoofAccessoryId, BodyPartOptionConfig<RoofAccessoryId>> = {
  roof_none: {
    id: 'roof_none',
    name: 'Clean Roofline',
    category: 'roof',
    description: 'Unobstructed aerodynamic roof panel.',
    price: 0,
  },
  roof_scoop: {
    id: 'roof_scoop',
    name: 'Carbon F1 Roof Airbox',
    category: 'roof',
    description: 'Central high-velocity induction snorkel mounted on the cabin roof.',
    price: 180,
  },
  roof_lightbar: {
    id: 'roof_lightbar',
    name: 'Quad LED Rally Light Pod',
    category: 'roof',
    description: 'High-intensity roof-mounted quad projector beam array.',
    price: 210,
  },
  roof_box: {
    id: 'roof_box',
    name: 'Aero Carbon Touring Pod',
    category: 'roof',
    description: 'Streamlined low-drag carbon fiber GT roof storage pod.',
    price: 230,
  },
};

export const UPGRADE_TRACKS: Record<UpgradeStatKey, UpgradeTrackConfig> = {
  topSpeed: {
    key: 'topSpeed',
    label: 'Top Speed',
    unitLabel: 'km/h',
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.55,
    perLevelBonusPct: 0.04,
  },
  acceleration: {
    key: 'acceleration',
    label: 'Engine & Accel',
    unitLabel: 'Rating',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.5,
    perLevelBonusPct: 0.055,
  },
  handling: {
    key: 'handling',
    label: 'Handling',
    unitLabel: 'Lat G',
    maxLevel: 5,
    baseCost: 110,
    costMultiplier: 1.5,
    perLevelBonusPct: 0.05,
  },
  braking: {
    key: 'braking',
    label: 'Braking',
    unitLabel: 'm/s²',
    maxLevel: 5,
    baseCost: 95,
    costMultiplier: 1.48,
    perLevelBonusPct: 0.06,
  },
  nitro: {
    key: 'nitro',
    label: 'Nitro Core',
    unitLabel: 'sec',
    maxLevel: 5,
    baseCost: 130,
    costMultiplier: 1.6,
    perLevelBonusPct: 0.075,
  },
};

export const PROTECTION_TRACKS: Record<ProtectionUpgradeKey, ProtectionTrackConfig> = {
  shieldCapacity: {
    key: 'shieldCapacity',
    label: 'Shield Charges',
    unitLabel: 'Hits',
    description: 'Increases maximum hull shield impact charges before critical failure.',
    maxLevel: 4,
    baseCost: 180,
    costMultiplier: 1.65,
  },
  shieldDuration: {
    key: 'shieldDuration',
    label: 'Deflector Matrix',
    unitLabel: 'Sec',
    description: 'Extends post-impact shield invulnerability window and reduces impact speed loss.',
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.55,
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
  low: 0.7,
  medium: 1.05,
  high: 1.48,
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
