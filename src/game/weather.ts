export type WeatherConditionId = 'clear' | 'rain' | 'fog' | 'snow';

export interface WeatherProfile {
  id: WeatherConditionId;
  name: string;
  shortLabel: string;
  surfaceConditionLabel: string;
  /** Multiplier applied to lateral steering authority (0.72 - 1.0) */
  gripMultiplier: number;
  /** Exponential damping rate for lateral velocity recovery (lower = more slide/momentum) */
  lateralDampRate: number;
  /** Multiplier applied to braking deceleration (0.66 - 1.0) */
  brakingMultiplier: number;
  /** Multiplier applied to outward centrifugal pull in corners (1.0 - 1.52) */
  centrifugalMultiplier: number;
  /** Multiplier applied to minimum curve threshold required to trigger a drift (0.65 - 1.0) */
  driftThresholdScale: number;
  /** Human-readable visibility percentage for HUD telemetry (38% - 100%) */
  visibilityPct: number;
  /** Three.js FogExp2 color hex */
  fogColorHex: number;
  /** Three.js FogExp2 density */
  fogDensity: number;
  /** Road surface PBR roughness (lower = mirror-wet reflections) */
  roadRoughness: number;
  /** Road surface PBR metalness */
  roadMetalness: number;
  /** Road surface albedo tint hex */
  roadTintHex: number;
  /** Hemisphere sky light color hex */
  hemiSkyHex: number;
  /** Hemisphere ground light color hex */
  hemiGroundHex: number;
  /** Hemisphere light intensity */
  hemiIntensity: number;
  /** Directional sunlight intensity */
  sunIntensity: number;
  /** Renderer tone-mapping exposure */
  exposure: number;
  /** Precipitation particle mode */
  precipitationType: 'none' | 'rain' | 'snow' | 'mist';
  /** Active precipitation particle count in the camera frustum */
  particleCount: number;
  /** Crosswind lateral drift velocity (m/s) */
  windLateralMs: number;
}

export const WEATHER_ORDER: WeatherConditionId[] = ['clear', 'rain', 'fog', 'snow'];

export const WEATHER_PROFILES: Record<WeatherConditionId, WeatherProfile> = {
  clear: {
    id: 'clear',
    name: 'Clear Night',
    shortLabel: 'CLEAR',
    surfaceConditionLabel: 'Dry Tarmac',
    gripMultiplier: 1.0,
    lateralDampRate: 14.0,
    brakingMultiplier: 1.0,
    centrifugalMultiplier: 1.0,
    driftThresholdScale: 1.0,
    visibilityPct: 100,
    fogColorHex: 0x111a2e,
    fogDensity: 0.0042,
    roadRoughness: 0.72,
    roadMetalness: 0.14,
    roadTintHex: 0xffffff,
    hemiSkyHex: 0xdbeafe,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 1.35,
    sunIntensity: 2.5,
    exposure: 1.18,
    precipitationType: 'none',
    particleCount: 0,
    windLateralMs: 0,
  },
  rain: {
    id: 'rain',
    name: 'Heavy Downpour',
    shortLabel: 'RAIN',
    surfaceConditionLabel: 'Wet Asphalt',
    gripMultiplier: 0.82,
    lateralDampRate: 6.8,
    brakingMultiplier: 0.76,
    centrifugalMultiplier: 1.32,
    driftThresholdScale: 0.78,
    visibilityPct: 68,
    fogColorHex: 0x0d1829,
    fogDensity: 0.0088,
    roadRoughness: 0.16,
    roadMetalness: 0.64,
    roadTintHex: 0xcbd5e1,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x0f172a,
    hemiIntensity: 1.05,
    sunIntensity: 1.5,
    exposure: 1.08,
    precipitationType: 'rain',
    particleCount: 400,
    windLateralMs: -1.8,
  },
  fog: {
    id: 'fog',
    name: 'Dense Metro Fog',
    shortLabel: 'FOG',
    surfaceConditionLabel: 'Damp Surface',
    gripMultiplier: 0.9,
    lateralDampRate: 9.5,
    brakingMultiplier: 0.88,
    centrifugalMultiplier: 1.14,
    driftThresholdScale: 0.9,
    visibilityPct: 38,
    fogColorHex: 0x334155,
    fogDensity: 0.0235,
    roadRoughness: 0.42,
    roadMetalness: 0.32,
    roadTintHex: 0xcbd5e1,
    hemiSkyHex: 0xcbd5e1,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.92,
    sunIntensity: 1.05,
    exposure: 1.0,
    precipitationType: 'mist',
    particleCount: 160,
    windLateralMs: 0.65,
  },
  snow: {
    id: 'snow',
    name: 'Blizzard Squall',
    shortLabel: 'SNOW',
    surfaceConditionLabel: 'Icy Pack',
    gripMultiplier: 0.72,
    lateralDampRate: 4.6,
    brakingMultiplier: 0.66,
    centrifugalMultiplier: 1.52,
    driftThresholdScale: 0.65,
    visibilityPct: 52,
    fogColorHex: 0x1e2b3c,
    fogDensity: 0.012,
    roadRoughness: 0.46,
    roadMetalness: 0.28,
    roadTintHex: 0xdbeafe,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x334155,
    hemiIntensity: 1.45,
    sunIntensity: 1.85,
    exposure: 1.22,
    precipitationType: 'snow',
    particleCount: 360,
    windLateralMs: 2.6,
  },
};

export interface InterpolatedWeatherState {
  activeConditionId: WeatherConditionId;
  targetConditionId: WeatherConditionId;
  transitionProgress: number; // 0..1
  gripMultiplier: number;
  lateralDampRate: number;
  brakingMultiplier: number;
  centrifugalMultiplier: number;
  driftThresholdScale: number;
  visibilityPct: number;
  fogDensity: number;
  roadRoughness: number;
  roadMetalness: number;
  hemiIntensity: number;
  sunIntensity: number;
  exposure: number;
  windLateralMs: number;
}

export function createInitialWeatherState(
  initialCondition: WeatherConditionId = 'clear'
): InterpolatedWeatherState {
  const profile = WEATHER_PROFILES[initialCondition] ?? WEATHER_PROFILES.clear;
  return {
    activeConditionId: profile.id,
    targetConditionId: profile.id,
    transitionProgress: 1,
    gripMultiplier: profile.gripMultiplier,
    lateralDampRate: profile.lateralDampRate,
    brakingMultiplier: profile.brakingMultiplier,
    centrifugalMultiplier: profile.centrifugalMultiplier,
    driftThresholdScale: profile.driftThresholdScale,
    visibilityPct: profile.visibilityPct,
    fogDensity: profile.fogDensity,
    roadRoughness: profile.roadRoughness,
    roadMetalness: profile.roadMetalness,
    hemiIntensity: profile.hemiIntensity,
    sunIntensity: profile.sunIntensity,
    exposure: profile.exposure,
    windLateralMs: profile.windLateralMs,
  };
}

/**
 * Picks a new random weather condition that differs from the current one,
 * weighting dynamic weather effects (rain, fog, snow) so races feel atmospheric.
 */
export function selectNextRandomWeather(
  current: WeatherConditionId,
  randomVal: number = Math.random()
): WeatherConditionId {
  const candidates: { id: WeatherConditionId; weight: number }[] = [
    { id: 'clear', weight: 0.22 },
    { id: 'rain', weight: 0.3 },
    { id: 'fog', weight: 0.24 },
    { id: 'snow', weight: 0.24 },
  ].filter((c) => c.id !== current);

  const totalWeight = candidates.reduce((acc, c) => acc + c.weight, 0);
  let cursor = Math.max(0, Math.min(0.9999, randomVal)) * totalWeight;
  for (const c of candidates) {
    cursor -= c.weight;
    if (cursor <= 0) {
      return c.id;
    }
  }
  return candidates[candidates.length - 1].id;
}

/**
 * Steps the interpolated weather parameters smoothly toward the target weather profile.
 */
export function stepWeatherInterpolation(
  state: InterpolatedWeatherState,
  targetId: WeatherConditionId,
  dt: number,
  transitionSpeed: number = 0.65
): InterpolatedWeatherState {
  const target = WEATHER_PROFILES[targetId] ?? WEATHER_PROFILES.clear;
  const k = Math.min(1, dt * transitionSpeed * 2.4);
  const lerp = (a: number, b: number) => a + (b - a) * k;

  const nextProgress =
    state.targetConditionId !== targetId
      ? Math.min(1, dt * transitionSpeed)
      : Math.min(1, state.transitionProgress + dt * transitionSpeed);

  return {
    activeConditionId: nextProgress >= 0.5 ? target.id : state.activeConditionId,
    targetConditionId: target.id,
    transitionProgress: nextProgress,
    gripMultiplier: lerp(state.gripMultiplier, target.gripMultiplier),
    lateralDampRate: lerp(state.lateralDampRate, target.lateralDampRate),
    brakingMultiplier: lerp(state.brakingMultiplier, target.brakingMultiplier),
    centrifugalMultiplier: lerp(state.centrifugalMultiplier, target.centrifugalMultiplier),
    driftThresholdScale: lerp(state.driftThresholdScale, target.driftThresholdScale),
    visibilityPct: Math.round(lerp(state.visibilityPct, target.visibilityPct)),
    fogDensity: lerp(state.fogDensity, target.fogDensity),
    roadRoughness: lerp(state.roadRoughness, target.roadRoughness),
    roadMetalness: lerp(state.roadMetalness, target.roadMetalness),
    hemiIntensity: lerp(state.hemiIntensity, target.hemiIntensity),
    sunIntensity: lerp(state.sunIntensity, target.sunIntensity),
    exposure: lerp(state.exposure, target.exposure),
    windLateralMs: lerp(state.windLateralMs, target.windLateralMs),
  };
}
