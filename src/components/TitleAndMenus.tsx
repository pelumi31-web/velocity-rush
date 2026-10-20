import React, { useState } from 'react';
import {
  AD_CONFIG,
  BUMPER_OPTIONS,
  BumperId,
  CAR_CONFIGS,
  CAR_ORDER,
  CarId,
  CHALLENGES_CONFIG,
  GamePlayMode,
  GraphicsQuality,
  PAINT_FINISHES,
  PAINT_PRESETS,
  PaintFinishType,
  PROTECTION_TRACKS,
  ProtectionUpgradeKey,
  ROOF_OPTIONS,
  RoofAccessoryId,
  SensitivityLevel,
  SKIRT_OPTIONS,
  SkirtId,
  SPOILER_OPTIONS,
  SpoilerId,
  SteeringMode,
  STRIPE_OPTIONS,
  StripeStyleId,
  UNDERGLOW_OPTIONS,
  UnderglowId,
  UPGRADE_TRACKS,
  UpgradeStatKey,
  WHEEL_COLORS,
  WHEEL_CONFIGS,
  WHEEL_ORDER,
} from '../game/config';
import {
  getEffectiveCarStats,
  getProtectionUpgradeCost,
  getUpgradeCost,
} from '../game/rules';
import { generateLevelCourse } from '../game/levelsMode';
import {
  createDefaultCarCustomization,
  createDefaultProtection,
  createDefaultUpgrades,
  CustomizationSlotType,
  SaveGameData,
  UserSettingsData,
} from '../game/saveSystem';
import { MUSIC_TRACKS, MusicTrackId, MusicTrackMeta } from '../game/audio';

export type SubModalType =
  | 'none'
  | 'modes'
  | 'garage'
  | 'challenges'
  | 'settings'
  | 'unity_docs';

export type GarageCategoryTab =
  | 'cars'
  | 'wheels'
  | 'paint'
  | 'body'
  | 'performance'
  | 'protection';

interface TitleAndMenusProps {
  saveData: SaveGameData;
  activeModal: SubModalType;
  setActiveModal: (modal: SubModalType) => void;
  inspectCarId: CarId;
  setInspectCarId: (carId: CarId) => void;
  onStartRace: (mode?: GamePlayMode, levelNumber?: number) => void;
  onSelectCar: (carId: CarId) => void;
  onUnlockCar: (carId: CarId) => { success: boolean; reason?: string };
  onUpgradeCarStat: (
    carId: CarId,
    stat: UpgradeStatKey
  ) => { success: boolean; reason?: string };
  onUpgradeProtection: (
    carId: CarId,
    key: ProtectionUpgradeKey
  ) => { success: boolean; reason?: string };
  onCustomizeCar: (
    carId: CarId,
    slot: CustomizationSlotType,
    itemId: string
  ) => { success: boolean; purchased: boolean; cost: number; reason?: string };
  onSelectLevel: (levelNumber: number) => void;
  onClaimChallenge: (
    challengeId: string
  ) => { success: boolean; reward: number; reason?: string };
  onUpdateSettings: (partial: Partial<UserSettingsData>) => void;
  onCalibrateTiltNeutral: () => void;
  onRequestMotionPermission: () => void;
  onToggleFullscreen: () => void;
  onRotateTurntable: (deltaRad: number) => void;
  onSetGarageRotateHoldDir?: (dir: -1 | 0 | 1) => void;
  onResetGarageTurntableView?: () => void;
  onToggleGarageAutoRotate?: () => boolean;
  musicTrack?: MusicTrackMeta;
  isMuted?: boolean;
  onCycleMusicTrack?: () => void;
  onSelectMusicTrack?: (trackId: MusicTrackId) => void;
  onToggleMute?: () => void;
  feedbackNotice: string | null;
  onTriggerFeedbackNotice: (msg: string) => void;
}

export const TitleAndMenus: React.FC<TitleAndMenusProps> = ({
  saveData,
  activeModal,
  setActiveModal,
  inspectCarId,
  setInspectCarId,
  onStartRace,
  onSelectCar,
  onUnlockCar,
  onUpgradeCarStat,
  onUpgradeProtection,
  onCustomizeCar,
  onSelectLevel,
  onClaimChallenge,
  onUpdateSettings,
  onCalibrateTiltNeutral,
  onRequestMotionPermission,
  onToggleFullscreen,
  onRotateTurntable,
  onSetGarageRotateHoldDir,
  onResetGarageTurntableView,
  onToggleGarageAutoRotate,
  musicTrack,
  isMuted = false,
  onCycleMusicTrack,
  onSelectMusicTrack,
  onToggleMute,
  feedbackNotice,
  onTriggerFeedbackNotice,
}) => {
  const [garageTab, setGarageTab] = useState<GarageCategoryTab>('cars');
  const [paintSubTab, setPaintSubTab] = useState<
    'color' | 'finish' | 'rims' | 'stripes' | 'underglow'
  >('color');
  const [bodySubTab, setBodySubTab] = useState<'spoiler' | 'bumper' | 'skirt' | 'roof'>('spoiler');
  const [unityDocTab, setUnityDocTab] = useState<'architecture' | 'csharp' | 'admob' | 'apk'>(
    'architecture'
  );
  const [autoSpinActive, setAutoSpinActive] = useState<boolean>(true);

  const selectedCar = CAR_CONFIGS[saveData.selectedCarId] ?? CAR_CONFIGS.starter_apex;
  const inspectedCar = CAR_CONFIGS[inspectCarId] ?? CAR_CONFIGS.starter_apex;
  const inspectedUpgrades =
    saveData.carUpgrades[inspectCarId] ?? createDefaultUpgrades();
  const inspectedProt =
    saveData.carProtection?.[inspectCarId] ?? createDefaultProtection();
  const inspectedCust =
    saveData.carCustomizations?.[inspectCarId] ?? createDefaultCarCustomization();

  const effectiveStats = getEffectiveCarStats(
    inspectCarId,
    inspectedUpgrades,
    inspectedCust.wheelId,
    inspectedProt
  );
  const isInspectedUnlocked = saveData.unlockedCarIds.includes(inspectCarId);
  const isInspectedSelected = saveData.selectedCarId === inspectCarId;

  const unclaimedChallengesCount = CHALLENGES_CONFIG.filter((ch) => {
    if (saveData.challenges.claimedChallengeIds.includes(ch.id)) return false;
    const val =
      ch.metric === 'distance'
        ? saveData.challenges.cumulativeDistance
        : ch.metric === 'coins'
          ? saveData.challenges.cumulativeCoins
          : ch.metric === 'nearMisses'
            ? saveData.challenges.cumulativeNearMisses
            : saveData.challenges.cumulativeScore;
    return val >= ch.targetValue;
  }).length;

  const cycleInspectedCar = (dir: -1 | 1) => {
    const currentIdx = CAR_ORDER.indexOf(inspectCarId);
    const nextIdx = (currentIdx + dir + CAR_ORDER.length) % CAR_ORDER.length;
    const nextCarId = CAR_ORDER[nextIdx];
    setInspectCarId(nextCarId);
  };

  const currentLevelNum = saveData.levelsProgression?.selectedLevel ?? 1;
  const highestUnlockedLevel = saveData.levelsProgression?.highestUnlockedLevel ?? 1;
  const previewCourse = generateLevelCourse(currentLevelNum);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none overflow-hidden">
      {/* Top Bar: Telemetry & Economy Status */}
      <header className="flex items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-2.5 sm:gap-3 bg-[#0b0f19]/90 border border-slate-800/90 px-3 py-1.5 rounded-xl shadow-lg">
          {activeModal !== 'none' && (
            <button
              type="button"
              onClick={() => {
                setInspectCarId(saveData.selectedCarId);
                setActiveModal('none');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 transition cursor-pointer flex items-center gap-1"
            >
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-amber-400/20 border border-amber-400 flex items-center justify-center text-[10px] font-bold text-amber-300">
              $
            </span>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400">
                TOTAL COINS
              </div>
              <div
                data-testid="menu-coins"
                className="text-xs sm:text-sm font-bold font-mono tabular-nums text-amber-400 leading-none"
              >
                {saveData.coins}
              </div>
            </div>
          </div>

          <span className="text-slate-700" aria-hidden="true">/</span>

          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">
              HIGH SCORE
            </div>
            <div
              data-testid="menu-best-score"
              className="text-xs sm:text-sm font-bold font-mono tabular-nums text-cyan-400 leading-none"
            >
              {saveData.bestScore}
            </div>
          </div>

          <span className="text-slate-700" aria-hidden="true">/</span>

          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">
              LEVELS MODE
            </div>
            <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-400 leading-none">
              Lv.{highestUnlockedLevel}
            </div>
          </div>

          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">/</span>

          <div className="hidden sm:block">
            <div className="text-[9px] uppercase tracking-wider text-slate-400">
              EQUIPPED CAR
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-100 leading-none">
              {selectedCar.name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="menu-music-toggle-btn"
            onClick={() =>
              onUpdateSettings({
                musicEnabled: !(saveData.settings.musicEnabled ?? true),
              })
            }
            title="Toggle Background Music On/Off"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
              (saveData.settings.musicEnabled ?? true) && !isMuted
                ? 'bg-[#0b0f19]/90 hover:bg-slate-800/90 border-cyan-500/40 text-cyan-300'
                : 'bg-[#0b0f19]/90 hover:bg-slate-800/90 border-slate-800 text-slate-400'
            }`}
          >
            <span aria-hidden="true">♪</span>
            <span className="hidden sm:inline">
              {(saveData.settings.musicEnabled ?? true) ? 'Music On' : 'Music Off'}
            </span>
          </button>
          {onToggleMute && (
            <button
              type="button"
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              onClick={onToggleMute}
              className="bg-[#0b0f19]/90 hover:bg-slate-800/90 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isMuted ? 'Muted' : 'SFX On'}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="bg-[#0b0f19]/90 hover:bg-slate-800/90 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Fullscreen
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveModal(activeModal === 'unity_docs' ? 'none' : 'unity_docs')
            }
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer hidden md:inline-flex ${
              activeModal === 'unity_docs'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
                : 'bg-[#0b0f19]/90 hover:bg-slate-800/90 border-slate-800 text-slate-200'
            }`}
          >
            Unity 6 & APK
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveModal(activeModal === 'settings' ? 'none' : 'settings')
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              activeModal === 'settings'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
                : 'bg-[#0b0f19]/90 hover:bg-slate-800/90 border-slate-800 text-slate-200'
            }`}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Feedback Toast Notice */}
      {feedbackNotice && (
        <div
          role="status"
          className="self-center bg-[#0b0f19]/95 border border-cyan-500/60 text-cyan-200 px-3.5 py-1.5 rounded-xl text-xs font-medium shadow-xl pointer-events-auto"
        >
          {feedbackNotice}
        </div>
      )}

      {/* 1. MAIN MENU HERO CARD (Left-Anchored in Landscape so 3D Hero Car shines on Right) */}
      {activeModal === 'none' && (
        <div className="my-auto max-w-md w-full bg-[#0b0f19]/88 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-6 h-5 text-cyan-400 shrink-0" viewBox="0 0 32 24" fill="none">
              <path d="M2 6H22L18 11H2V6Z" fill="#06B6D4" />
              <path d="M6 14H28L24 19H6V14Z" fill="#F59E0B" />
            </svg>
            <h1 className="text-2xl sm:text-4xl font-extrabold italic tracking-tight uppercase text-slate-50 leading-none">
              VELOCITY <span className="text-cyan-400">RUSH</span>
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3.5">
            Customize 8 distinct 3D vehicles in the Showroom Garage. Conquer Endless Solo Highway or battle 5 AI rivals in Championship Levels Mode.
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-testid="open-modes-btn"
              onClick={() => setActiveModal('modes')}
              className="w-full py-2.5 sm:py-3 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-slate-950 font-extrabold text-sm sm:text-base uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>PLAY</span>
              <span className="text-xs font-bold opacity-80">· Solo & Levels Mode</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="open-garage-btn"
                onClick={() => {
                  setInspectCarId(saveData.selectedCarId);
                  setActiveModal('garage');
                }}
                className="py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Garage ({saveData.unlockedCarIds.length}/{CAR_ORDER.length})
              </button>

              <button
                type="button"
                data-testid="open-challenges-btn"
                onClick={() => setActiveModal('challenges')}
                className="relative py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Challenges
                {unclaimedChallengesCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-slate-950 rounded-md">
                    {unclaimedChallengesCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Steering: {saveData.settings.steeringMode.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>Best Solo: {saveData.bestDistance}m</span>
            <span aria-hidden="true">·</span>
            <span>Highest Level: Lv.{highestUnlockedLevel}</span>
          </div>
        </div>
      )}

      {/* 2. MODE SELECTION SCREEN (Two Distinct Cards: SOLO MODE vs LEVELS MODE) */}
      {activeModal === 'modes' && (
        <div
          role="dialog"
          aria-label="Select Game Mode"
          className="my-auto max-w-4xl w-full mx-auto bg-[#0b0f19]/94 border border-slate-800 rounded-2xl p-2.5 sm:p-4 shadow-2xl pointer-events-auto max-h-[calc(100vh-3.5rem)] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
            <div>
              <h2 className="text-sm sm:text-lg font-extrabold uppercase tracking-tight text-slate-100">
                Select Racing Mode
              </h2>
              <p className="text-[11px] text-slate-400">
                Equipped Vehicle:{' '}
                <span className="text-cyan-400 font-bold">{selectedCar.name}</span> (
                {selectedCar.category})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setInspectCarId(saveData.selectedCarId);
                  setActiveModal('garage');
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded-lg cursor-pointer"
              >
                Customize in Garage
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* CARD 1: SOLO MODE */}
            <div className="bg-slate-900/85 border border-cyan-500/40 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between gap-2">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] uppercase tracking-wider">
                    Endless Survival
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Best: <strong className="text-cyan-400">{saveData.bestDistance}m</strong>
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black uppercase text-white tracking-tight">
                  Solo Mode
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                  Endless urban highway drive through dynamic multi-lane city traffic. Execute high-speed near-misses to charge nitro, collect highway bullion, and set new distance records.
                </p>

                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center bg-slate-950/70 border border-slate-800/80 rounded-lg p-1.5">
                  <div>
                    <div className="text-[9px] uppercase text-slate-400">Traffic</div>
                    <div className="text-[11px] font-bold text-slate-200">4-Lane City</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase text-slate-400">Objective</div>
                    <div className="text-[11px] font-bold text-cyan-400">Max Distance</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase text-slate-400">High Score</div>
                    <div className="text-[11px] font-bold font-mono text-amber-400">
                      {saveData.bestScore}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="start-solo-btn"
                data-start="true"
                onClick={() => onStartRace('solo')}
                className="w-full py-2 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                Play Solo Mode
              </button>
            </div>

            {/* CARD 2: LEVELS MODE (5 AI Opponents + Procedural Courses) */}
            <div className="bg-slate-900/85 border border-amber-500/40 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between gap-2">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase tracking-wider">
                    6-Car Championship · 5 AI Rivals
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    Unlocked: Lv.{highestUnlockedLevel}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black uppercase text-white tracking-tight">
                  Levels Mode
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                  Point-to-point city circuit race against <strong>5 AI opponents</strong> from Starting Grid to Finish Line. Master drift bends, tunnels, and barrier chicanes to finish Top 3 and unlock the next level.
                </p>

                {/* Level Picker Strip */}
                <div className="mt-2 bg-slate-950/70 border border-slate-800/80 rounded-lg p-1.5">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-bold text-amber-400 truncate">
                      {previewCourse.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 shrink-0">
                      {previewCourse.totalLengthMeters}m · 1st: {previewCourse.baseFirstPlaceReward} Coins
                    </span>
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 mt-1">
                    {Array.from(
                      { length: Math.max(5, highestUnlockedLevel + 1) },
                      (_, i) => i + 1
                    ).map((lvl) => {
                      const unlocked = lvl <= highestUnlockedLevel;
                      const selected = lvl === currentLevelNum;
                      const rec = saveData.levelsProgression?.completedLevels?.[lvl];
                      return (
                        <button
                          key={lvl}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => onSelectLevel(lvl)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 transition cursor-pointer ${
                            selected
                              ? 'bg-amber-400 text-slate-950'
                              : unlocked
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          Lv.{lvl}
                          {rec ? ` (#${rec.bestPosition})` : !unlocked ? ' [Locked]' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="start-levels-btn"
                data-start="true"
                onClick={() => onStartRace('levels', currentLevelNum)}
                className="w-full py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Race Level {currentLevelNum} (vs 5 AI)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PREMIUM LANDSCAPE GARAGE (Split-Screen: B. 3D Showroom Left + C/D. 6-Category Customizer Right) */}
      {activeModal === 'garage' && (
        <div className="my-auto w-full flex flex-col sm:flex-row items-stretch justify-between gap-2.5 pointer-events-none h-[calc(100vh-4.1rem)]">
          {/* AREA B: LARGE VEHICLE 3D SHOWROOM OVERLAY (Left 44% of Landscape Screen) */}
          <div className="w-full sm:w-5/12 flex flex-col justify-between items-center gap-1 pointer-events-none h-full">
            {/* Compact Top-Left Vehicle Identity & 5-Stat Strip */}
            <div className="pointer-events-auto bg-[#0b0f19]/88 border border-slate-800/90 rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-xl w-full">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <h2
                    data-testid="garage-car-title"
                    className="text-sm sm:text-base font-black text-white tracking-tight truncate"
                  >
                    {inspectedCar.name}
                  </h2>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                      isInspectedSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : isInspectedUnlocked
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {isInspectedSelected
                      ? 'Equipped'
                      : isInspectedUnlocked
                        ? 'Owned'
                        : `${inspectedCar.unlockCost} Coins`}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label="Previous Car"
                    onClick={() => cycleInspectedCar(-1)}
                    className="w-6 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                  >
                    ‹
                  </button>
                  <span className="text-[10px] font-mono text-slate-400 px-0.5">
                    {CAR_ORDER.indexOf(inspectCarId) + 1}/{CAR_ORDER.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Next Car"
                    onClick={() => cycleInspectedCar(1)}
                    className="w-6 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center cursor-pointer"
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Ultra-Compact 5-Stat Telemetry Strip */}
              <div className="grid grid-cols-5 gap-1 mt-1 pt-1 border-t border-slate-800/80 text-center">
                <div>
                  <span className="text-[8px] uppercase text-slate-400 mr-1">SPD</span>
                  <span className="text-[10px] font-mono font-bold text-cyan-400">
                    {effectiveStats.topSpeedKmh}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase text-slate-400 mr-1">ACC</span>
                  <span className="text-[10px] font-mono font-bold text-slate-200">
                    {effectiveStats.acceleration}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase text-slate-400 mr-1">GRP</span>
                  <span className="text-[10px] font-mono font-bold text-slate-200">
                    {effectiveStats.handling}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase text-slate-400 mr-1">BRK</span>
                  <span className="text-[10px] font-mono font-bold text-slate-200">
                    {effectiveStats.brakingDecelMs2}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase text-slate-400 mr-1">SHD</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    {effectiveStats.maxShieldCharges}x
                  </span>
                </div>
              </div>
            </div>

            {/* Centered 360° Turntable Rotation Dock + Primary Car Unlock/Equip Action */}
            <div
              data-testid="garage-rotation-dock"
              className="pointer-events-auto w-full flex items-center justify-between gap-1.5 bg-[#0b0f19]/90 border border-slate-800/90 rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-xl"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="garage-rotate-left-btn"
                  aria-label="Rotate Vehicle Left"
                  onPointerDown={() => onSetGarageRotateHoldDir?.(-1)}
                  onPointerUp={() => onSetGarageRotateHoldDir?.(0)}
                  onPointerLeave={() => onSetGarageRotateHoldDir?.(0)}
                  onPointerCancel={() => onSetGarageRotateHoldDir?.(0)}
                  onClick={() => onRotateTurntable(-0.55)}
                  className="px-2 py-1 text-[10px] font-bold bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-100 border border-slate-700 rounded-lg cursor-pointer select-none flex items-center gap-1"
                >
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <path d="M12 5L7 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Rotate</span>
                </button>

                <button
                  type="button"
                  data-testid="garage-reset-view-btn"
                  aria-label="Reset Showroom Angle"
                  onClick={() => {
                    onResetGarageTurntableView?.();
                    setAutoSpinActive(true);
                  }}
                  className="px-2 py-1 text-[10px] font-semibold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded-lg cursor-pointer select-none"
                >
                  Reset 360°
                </button>

                <button
                  type="button"
                  data-testid="garage-autospin-btn"
                  aria-label="Toggle Auto-Spin"
                  onClick={() => {
                    const next = onToggleGarageAutoRotate?.() ?? !autoSpinActive;
                    setAutoSpinActive(next);
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer select-none ${
                    autoSpinActive
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {autoSpinActive ? 'Spin: ON' : 'Spin: OFF'}
                </button>

                <button
                  type="button"
                  data-testid="garage-rotate-right-btn"
                  aria-label="Rotate Vehicle Right"
                  onPointerDown={() => onSetGarageRotateHoldDir?.(1)}
                  onPointerUp={() => onSetGarageRotateHoldDir?.(0)}
                  onPointerLeave={() => onSetGarageRotateHoldDir?.(0)}
                  onPointerCancel={() => onSetGarageRotateHoldDir?.(0)}
                  onClick={() => onRotateTurntable(0.55)}
                  className="px-2 py-1 text-[10px] font-bold bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-100 border border-slate-700 rounded-lg cursor-pointer select-none flex items-center gap-1"
                >
                  <span>Rotate</span>
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {!isInspectedUnlocked ? (
                <button
                  type="button"
                  data-testid="garage-unlock-btn"
                  onClick={() => {
                    const res = onUnlockCar(inspectCarId);
                    if (!res.success && res.reason) {
                      onTriggerFeedbackNotice(res.reason);
                    } else {
                      onTriggerFeedbackNotice(`Unlocked & Equipped ${inspectedCar.name}!`);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider cursor-pointer shrink-0"
                >
                  Unlock · {inspectedCar.unlockCost}
                </button>
              ) : isInspectedSelected ? (
                <button
                  type="button"
                  data-testid="garage-race-btn"
                  onClick={() => setActiveModal('modes')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider cursor-pointer shrink-0"
                >
                  Race Now
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="garage-equip-btn"
                  onClick={() => {
                    onSelectCar(inspectCarId);
                    onTriggerFeedbackNotice(`Equipped ${inspectedCar.name}`);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider cursor-pointer shrink-0"
                >
                  Equip
                </button>
              )}
            </div>
          </div>

          {/* AREAS C & D: 6-CATEGORY NAVIGATION + SELECTION & UPGRADE PANEL (Right 56% of Landscape Screen) */}
          <div className="w-full sm:w-7/12 max-w-xl pointer-events-auto bg-[#0b0f19]/94 border border-slate-800 rounded-2xl p-2.5 sm:p-3.5 shadow-2xl flex flex-col gap-2 overflow-hidden">
            {/* AREA C: 6 Customization Category Tabs */}
            <div
              className="grid grid-cols-6 gap-1 pb-2 border-b border-slate-800"
              role="tablist"
              aria-label="Garage Customization Categories"
            >
              {(
                [
                  { id: 'cars', label: 'Cars' },
                  { id: 'wheels', label: 'Wheels' },
                  { id: 'paint', label: 'Paint' },
                  { id: 'body', label: 'Body' },
                  { id: 'performance', label: 'Perf' },
                  { id: 'protection', label: 'Shields' },
                ] as { id: GarageCategoryTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-testid={`garage-tab-${tab.id}`}
                  aria-selected={garageTab === tab.id}
                  onClick={() => setGarageTab(tab.id)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center cursor-pointer border ${
                    garageTab === tab.id
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-sm'
                      : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* AREA D: Dynamic Category Content Panel (Scrollable within fixed height) */}
            <div className="overflow-y-auto pr-0.5 max-h-[215px] sm:max-h-[235px]">
              {/* TAB 1: CARS (8 Distinct Vehicles) */}
              {garageTab === 'cars' && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {CAR_ORDER.map((cid) => {
                      const cfg = CAR_CONFIGS[cid];
                      const unlocked = saveData.unlockedCarIds.includes(cid);
                      const equipped = saveData.selectedCarId === cid;
                      const active = inspectCarId === cid;
                      return (
                        <button
                          key={cid}
                          type="button"
                          data-testid={`car-card-${cid}`}
                          onClick={() => setInspectCarId(cid)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            active
                              ? 'bg-cyan-950/60 border-cyan-400 shadow-md shadow-cyan-500/10'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: cfg.primaryHex }}
                              />
                              <span
                                className={`text-[9px] font-bold uppercase ${
                                  equipped
                                    ? 'text-cyan-400'
                                    : unlocked
                                      ? 'text-emerald-400'
                                      : 'text-amber-400'
                                }`}
                              >
                                {equipped ? 'Equipped' : unlocked ? 'Owned' : `${cfg.unlockCost}`}
                              </span>
                            </div>
                            <div className="text-xs font-extrabold text-slate-100 truncate mt-1">
                              {cfg.name}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate">
                              {cfg.category}
                            </div>
                          </div>
                          <div className="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-300">
                            <span>{cfg.baseStats.topSpeedKmh} km/h</span>
                            <span>Acc {cfg.baseStats.acceleration}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug bg-slate-900/50 border border-slate-800/70 rounded-lg px-2.5 py-1.5">
                    <strong className="text-slate-200">{inspectedCar.name}:</strong>{' '}
                    {inspectedCar.description}
                  </p>
                </div>
              )}

              {/* TAB 2: WHEELS & TYRES (6 Distinct 3D Wheel Models + Grip Bonuses) */}
              {garageTab === 'wheels' && (
                <div className="grid grid-cols-2 gap-2">
                  {WHEEL_ORDER.map((wId) => {
                    const wCfg = WHEEL_CONFIGS[wId];
                    const isOwned = inspectedCust.ownedWheelIds.includes(wId);
                    const isEquipped = inspectedCust.wheelId === wId;
                    return (
                      <div
                        key={wId}
                        className={`p-2 rounded-xl border flex flex-col justify-between gap-1.5 ${
                          isEquipped
                            ? 'bg-cyan-950/50 border-cyan-400'
                            : 'bg-slate-900/85 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-100 truncate">
                              {wCfg.name}
                            </span>
                            {wCfg.handlingBonusPct > 0 && (
                              <span className="text-[9px] font-mono font-bold text-emerald-400 shrink-0">
                                +{Math.round(wCfg.handlingBonusPct * 100)}% Grip
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {wCfg.categoryLabel}
                          </div>
                        </div>

                        <button
                          type="button"
                          data-testid={`wheel-btn-${wId}`}
                          disabled={!isInspectedUnlocked}
                          onClick={() => {
                            const res = onCustomizeCar(inspectCarId, 'wheel', wId);
                            if (!res.success && res.reason) {
                              onTriggerFeedbackNotice(res.reason);
                            } else if (res.purchased) {
                              onTriggerFeedbackNotice(`Purchased & Equipped ${wCfg.name}!`);
                            }
                          }}
                          className={`w-full py-1 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            !isInspectedUnlocked
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : isEquipped
                                ? 'bg-cyan-400 text-slate-950'
                                : isOwned
                                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300'
                                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          }`}
                        >
                          {isEquipped
                            ? 'Equipped'
                            : isOwned
                              ? 'Equip Wheel'
                              : `Buy · ${wCfg.price} Coins`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: PAINT, FINISHES, RIM COLOURS, STRIPES & UNDERGLOW */}
              {garageTab === 'paint' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(
                      [
                        { id: 'color', label: 'Paint Colour' },
                        { id: 'finish', label: 'Finish' },
                        { id: 'rims', label: 'Rim Colour' },
                        { id: 'stripes', label: 'Stripes' },
                        { id: 'underglow', label: 'Underglow' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setPaintSubTab(st.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          paintSubTab === st.id
                            ? 'bg-slate-200 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {paintSubTab === 'color' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {PAINT_PRESETS.map((p) => {
                        const isOwned = inspectedCust.ownedPaintIds.includes(p.id);
                        const isEquipped = inspectedCust.paintId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            data-testid={`paint-btn-${p.id}`}
                            disabled={!isInspectedUnlocked}
                            onClick={() => {
                              const res = onCustomizeCar(inspectCarId, 'paint', p.id);
                              if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                            }}
                            className={`p-1.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                              isEquipped
                                ? 'bg-cyan-950/60 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                style={{
                                  backgroundColor:
                                    p.id === 'paint_factory' ? inspectedCar.primaryHex : p.hex,
                                }}
                              />
                              <span className="text-[10px] font-bold text-slate-100 truncate">
                                {p.name}
                              </span>
                            </div>
                            <div className="text-[9px] font-mono text-right text-amber-400">
                              {isEquipped ? 'Active' : isOwned ? 'Owned' : `${p.price} Coins`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {paintSubTab === 'finish' && (
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(PAINT_FINISHES) as PaintFinishType[]).map((fId) => {
                        const fCfg = PAINT_FINISHES[fId];
                        const isOwned = inspectedCust.ownedFinishes.includes(fId);
                        const isEquipped = inspectedCust.paintFinish === fId;
                        return (
                          <div
                            key={fId}
                            className={`p-2 rounded-xl border flex flex-col justify-between gap-2 ${
                              isEquipped
                                ? 'bg-cyan-950/50 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{fCfg.name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {fCfg.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={!isInspectedUnlocked}
                              onClick={() => {
                                const res = onCustomizeCar(inspectCarId, 'finish', fId);
                                if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                              }}
                              className={`py-1 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                isEquipped
                                  ? 'bg-cyan-400 text-slate-950'
                                  : isOwned
                                    ? 'bg-slate-800 text-emerald-300'
                                    : 'bg-amber-400 text-slate-950'
                              }`}
                            >
                              {isEquipped ? 'Equipped' : isOwned ? 'Apply' : `${fCfg.price} Coins`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {paintSubTab === 'rims' && (
                    <div className="grid grid-cols-3 gap-2">
                      {WHEEL_COLORS.map((wc) => {
                        const isOwned = inspectedCust.ownedWheelColorIds.includes(wc.id);
                        const isEquipped = inspectedCust.wheelColorId === wc.id;
                        return (
                          <button
                            key={wc.id}
                            type="button"
                            disabled={!isInspectedUnlocked}
                            onClick={() => {
                              const res = onCustomizeCar(inspectCarId, 'wheelColor', wc.id);
                              if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                            }}
                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer ${
                              isEquipped
                                ? 'bg-cyan-950/60 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                style={{ backgroundColor: wc.hex }}
                              />
                              <span className="text-[11px] font-bold text-slate-100 truncate">
                                {wc.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-amber-400 shrink-0">
                              {isEquipped ? 'Active' : isOwned ? 'Own' : `${wc.price}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {paintSubTab === 'stripes' && (
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(STRIPE_OPTIONS) as StripeStyleId[]).map((sId) => {
                        const sCfg = STRIPE_OPTIONS[sId];
                        const isOwned = inspectedCust.ownedStripeIds.includes(sId);
                        const isEquipped = inspectedCust.stripeId === sId;
                        return (
                          <button
                            key={sId}
                            type="button"
                            disabled={!isInspectedUnlocked}
                            onClick={() => {
                              const res = onCustomizeCar(inspectCarId, 'stripe', sId);
                              if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                            }}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer flex flex-col justify-between gap-2 ${
                              isEquipped
                                ? 'bg-cyan-950/60 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div className="text-xs font-bold text-white">{sCfg.name}</div>
                            <div className="text-[10px] font-mono text-amber-400">
                              {isEquipped ? 'Equipped' : isOwned ? 'Owned' : `${sCfg.price} Coins`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {paintSubTab === 'underglow' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {(Object.keys(UNDERGLOW_OPTIONS) as UnderglowId[]).map((gId) => {
                        const gCfg = UNDERGLOW_OPTIONS[gId];
                        const isOwned = inspectedCust.ownedUnderglowIds.includes(gId);
                        const isEquipped = inspectedCust.underglowId === gId;
                        return (
                          <button
                            key={gId}
                            type="button"
                            disabled={!isInspectedUnlocked}
                            onClick={() => {
                              const res = onCustomizeCar(inspectCarId, 'underglow', gId);
                              if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                            }}
                            className={`p-2 rounded-xl border text-left cursor-pointer flex flex-col justify-between gap-1.5 ${
                              isEquipped
                                ? 'bg-cyan-950/60 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                                style={{ backgroundColor: gCfg.hex }}
                              />
                              <span className="text-[10px] font-bold text-slate-100 truncate">
                                {gCfg.name}
                              </span>
                            </div>
                            <div className="text-[9px] font-mono text-amber-400 text-right">
                              {isEquipped ? 'Active' : isOwned ? 'Owned' : `${gCfg.price} Coins`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: BODY STYLE & ACCESSORIES (Compatible Spoilers, Bumpers, Skirts, Roof) */}
              {garageTab === 'body' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'spoiler', label: 'Rear Spoilers' },
                        { id: 'bumper', label: 'Front Splitters' },
                        { id: 'skirt', label: 'Side Skirts' },
                        { id: 'roof', label: 'Roof Gear' },
                      ] as const
                    ).map((bt) => (
                      <button
                        key={bt.id}
                        type="button"
                        onClick={() => setBodySubTab(bt.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          bodySubTab === bt.id
                            ? 'bg-slate-200 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {bt.label}
                      </button>
                    ))}
                  </div>

                  {bodySubTab === 'spoiler' && (
                    <div className="grid grid-cols-2 gap-2">
                      {inspectedCar.compatibleSpoilers.map((spId: SpoilerId) => {
                        const cfg = SPOILER_OPTIONS[spId];
                        const isOwned = inspectedCust.ownedSpoilerIds.includes(spId);
                        const isEquipped = inspectedCust.spoilerId === spId;
                        return (
                          <div
                            key={spId}
                            className={`p-2 rounded-xl border flex flex-col justify-between gap-1.5 ${
                              isEquipped
                                ? 'bg-cyan-950/50 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{cfg.name}</div>
                              <div className="text-[10px] text-slate-400">{cfg.description}</div>
                            </div>
                            <button
                              type="button"
                              data-testid={`spoiler-btn-${spId}`}
                              disabled={!isInspectedUnlocked}
                              onClick={() => {
                                const res = onCustomizeCar(inspectCarId, 'spoiler', spId);
                                if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                              }}
                              className={`py-1 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                isEquipped
                                  ? 'bg-cyan-400 text-slate-950'
                                  : isOwned
                                    ? 'bg-slate-800 text-emerald-300'
                                    : 'bg-amber-400 text-slate-950'
                              }`}
                            >
                              {isEquipped ? 'Installed' : isOwned ? 'Equip' : `Buy · ${cfg.price} Coins`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {bodySubTab === 'bumper' && (
                    <div className="grid grid-cols-3 gap-2">
                      {inspectedCar.compatibleBumpers.map((bId: BumperId) => {
                        const cfg = BUMPER_OPTIONS[bId];
                        const isOwned = inspectedCust.ownedBumperIds.includes(bId);
                        const isEquipped = inspectedCust.bumperId === bId;
                        return (
                          <div
                            key={bId}
                            className={`p-2 rounded-xl border flex flex-col justify-between gap-1.5 ${
                              isEquipped
                                ? 'bg-cyan-950/50 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{cfg.name}</div>
                              <div className="text-[10px] text-slate-400">{cfg.description}</div>
                            </div>
                            <button
                              type="button"
                              disabled={!isInspectedUnlocked}
                              onClick={() => {
                                const res = onCustomizeCar(inspectCarId, 'bumper', bId);
                                if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                              }}
                              className={`py-1 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                isEquipped
                                  ? 'bg-cyan-400 text-slate-950'
                                  : isOwned
                                    ? 'bg-slate-800 text-emerald-300'
                                    : 'bg-amber-400 text-slate-950'
                              }`}
                            >
                              {isEquipped ? 'Installed' : isOwned ? 'Equip' : `${cfg.price} Coins`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {bodySubTab === 'skirt' && (
                    <div className="grid grid-cols-3 gap-2">
                      {inspectedCar.compatibleSkirts.map((skId: SkirtId) => {
                        const cfg = SKIRT_OPTIONS[skId];
                        const isOwned = inspectedCust.ownedSkirtIds.includes(skId);
                        const isEquipped = inspectedCust.skirtId === skId;
                        return (
                          <div
                            key={skId}
                            className={`p-2 rounded-xl border flex flex-col justify-between gap-1.5 ${
                              isEquipped
                                ? 'bg-cyan-950/50 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{cfg.name}</div>
                              <div className="text-[10px] text-slate-400">{cfg.description}</div>
                            </div>
                            <button
                              type="button"
                              disabled={!isInspectedUnlocked}
                              onClick={() => {
                                const res = onCustomizeCar(inspectCarId, 'skirt', skId);
                                if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                              }}
                              className={`py-1 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                isEquipped
                                  ? 'bg-cyan-400 text-slate-950'
                                  : isOwned
                                    ? 'bg-slate-800 text-emerald-300'
                                    : 'bg-amber-400 text-slate-950'
                              }`}
                            >
                              {isEquipped ? 'Installed' : isOwned ? 'Equip' : `${cfg.price} Coins`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {bodySubTab === 'roof' && (
                    <div className="grid grid-cols-3 gap-2">
                      {inspectedCar.compatibleRoofAccessories.map((rId: RoofAccessoryId) => {
                        const cfg = ROOF_OPTIONS[rId];
                        const isOwned = inspectedCust.ownedRoofIds.includes(rId);
                        const isEquipped = inspectedCust.roofId === rId;
                        return (
                          <div
                            key={rId}
                            className={`p-2 rounded-xl border flex flex-col justify-between gap-1.5 ${
                              isEquipped
                                ? 'bg-cyan-950/50 border-cyan-400'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{cfg.name}</div>
                              <div className="text-[10px] text-slate-400">{cfg.description}</div>
                            </div>
                            <button
                              type="button"
                              disabled={!isInspectedUnlocked}
                              onClick={() => {
                                const res = onCustomizeCar(inspectCarId, 'roof', rId);
                                if (!res.success && res.reason) onTriggerFeedbackNotice(res.reason);
                              }}
                              className={`py-1 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                                isEquipped
                                  ? 'bg-cyan-400 text-slate-950'
                                  : isOwned
                                    ? 'bg-slate-800 text-emerald-300'
                                    : 'bg-amber-400 text-slate-950'
                              }`}
                            >
                              {isEquipped ? 'Installed' : isOwned ? 'Equip' : `${cfg.price} Coins`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PERFORMANCE UPGRADES (5 Tracks with Current + Projected Next-Level Stat) */}
              {garageTab === 'performance' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(UPGRADE_TRACKS) as UpgradeStatKey[]).map((statKey) => {
                    const track = UPGRADE_TRACKS[statKey];
                    const currentLvl = inspectedUpgrades[statKey] ?? 0;
                    const isMax = currentLvl >= track.maxLevel;
                    const cost = getUpgradeCost(statKey, currentLvl);

                    const nextUpgrades = {
                      ...inspectedUpgrades,
                      [statKey]: Math.min(track.maxLevel, currentLvl + 1),
                    };
                    const nextStats = getEffectiveCarStats(
                      inspectCarId,
                      nextUpgrades,
                      inspectedCust.wheelId,
                      inspectedProt
                    );

                    const curVal =
                      statKey === 'topSpeed'
                        ? `${effectiveStats.topSpeedKmh}`
                        : statKey === 'acceleration'
                          ? `${effectiveStats.acceleration}`
                          : statKey === 'handling'
                            ? `${effectiveStats.handling}`
                            : statKey === 'braking'
                              ? `${effectiveStats.brakingDecelMs2}`
                              : `${effectiveStats.nitroCapacity}s`;

                    const nextVal =
                      statKey === 'topSpeed'
                        ? `${nextStats.topSpeedKmh} km/h`
                        : statKey === 'acceleration'
                          ? `${nextStats.acceleration}`
                          : statKey === 'handling'
                            ? `${nextStats.handling}`
                            : statKey === 'braking'
                              ? `${nextStats.brakingDecelMs2} m/s²`
                              : `${nextStats.nitroCapacity}s`;

                    return (
                      <div
                        key={statKey}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-100">
                              {track.label}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-cyan-400">
                              {curVal} {!isMax && <span className="text-emerald-400">→ {nextVal}</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {Array.from({ length: track.maxLevel }, (_, idx) => (
                              <span
                                key={idx}
                                className={`h-1.5 w-3 rounded-sm ${
                                  idx < currentLvl ? 'bg-cyan-400' : 'bg-slate-800'
                                }`}
                              />
                            ))}
                            <span className="text-[10px] font-mono text-slate-400 ml-1">
                              Lv.{currentLvl}/{track.maxLevel}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          data-testid={`upgrade-btn-${statKey}`}
                          disabled={!isInspectedUnlocked || isMax}
                          onClick={() => {
                            const res = onUpgradeCarStat(inspectCarId, statKey);
                            if (!res.success && res.reason) {
                              onTriggerFeedbackNotice(res.reason);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono shrink-0 cursor-pointer ${
                            !isInspectedUnlocked
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : isMax
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                : saveData.coins >= cost
                                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                                  : 'bg-slate-800 text-amber-400 border border-slate-700'
                          }`}
                        >
                          {isMax ? 'MAX' : `${cost} Coins`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 6: PROTECTION & SHIELDS (Capacity & Deflector Matrix Duration) */}
              {garageTab === 'protection' && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(PROTECTION_TRACKS) as ProtectionUpgradeKey[]).map((pKey) => {
                      const track = PROTECTION_TRACKS[pKey];
                      const currentLvl = inspectedProt[pKey] ?? 0;
                      const isMax = currentLvl >= track.maxLevel;
                      const cost = getProtectionUpgradeCost(pKey, currentLvl);

                      const statLabel =
                        pKey === 'shieldCapacity'
                          ? `${effectiveStats.maxShieldCharges} Charges`
                          : `${effectiveStats.shieldInvulnerabilitySec}s Deflect`;

                      return (
                        <div
                          key={pKey}
                          className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{track.label}</span>
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                {statLabel}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                              {track.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: track.maxLevel }, (_, idx) => (
                                <span
                                  key={idx}
                                  className={`h-1.5 w-3.5 rounded-sm ${
                                    idx < currentLvl ? 'bg-emerald-400' : 'bg-slate-800'
                                  }`}
                                />
                              ))}
                              <span className="text-[10px] font-mono text-slate-400 ml-1">
                                Lv.{currentLvl}/{track.maxLevel}
                              </span>
                            </div>

                            <button
                              type="button"
                              data-testid={`protection-btn-${pKey}`}
                              disabled={!isInspectedUnlocked || isMax}
                              onClick={() => {
                                const res = onUpgradeProtection(inspectCarId, pKey);
                                if (!res.success && res.reason) {
                                  onTriggerFeedbackNotice(res.reason);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono cursor-pointer ${
                                !isInspectedUnlocked
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : isMax
                                    ? 'bg-emerald-950/60 text-emerald-400'
                                    : saveData.coins >= cost
                                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                                      : 'bg-slate-800 text-amber-400 border border-slate-700'
                              }`}
                            >
                              {isMax ? 'MAX' : `${cost} Coins`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
                    <strong className="text-emerald-400">Shield Mechanics:</strong> Each shield charge absorbs a direct traffic or barrier impact and triggers {effectiveStats.shieldInvulnerabilitySec}s of energy-dome invulnerability while retaining {Math.round(effectiveStats.collisionSpeedRetention * 100)}% speed. At Deflector Matrix Lv.3+, 1 shield charge automatically recharges every 40s of clean driving.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. CHALLENGES / MISSIONS MODAL */}
      {activeModal === 'challenges' && (
        <div
          role="dialog"
          aria-label="Driver Challenges"
          className="my-auto max-w-2xl w-full mx-auto bg-[#0b0f19]/94 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto max-h-[82vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-extrabold uppercase tracking-tight text-slate-100">
                Highway Milestones & Challenges
              </h2>
              <p className="text-xs text-slate-400">
                Complete cumulative objectives across Solo and Levels Mode to earn bonus coins.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CHALLENGES_CONFIG.map((ch) => {
              const claimed = saveData.challenges.claimedChallengeIds.includes(ch.id);
              const currentVal =
                ch.metric === 'distance'
                  ? saveData.challenges.cumulativeDistance
                  : ch.metric === 'coins'
                    ? saveData.challenges.cumulativeCoins
                    : ch.metric === 'nearMisses'
                      ? saveData.challenges.cumulativeNearMisses
                      : saveData.challenges.cumulativeScore;
              const pct = Math.min(100, Math.round((currentVal / ch.targetValue) * 100));
              const readyToClaim = !claimed && currentVal >= ch.targetValue;

              return (
                <div
                  key={ch.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                        {ch.title}
                      </h3>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        +{ch.rewardCoins} Coins
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{ch.description}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-1">
                      <span>
                        {Math.min(currentVal, ch.targetValue)} / {ch.targetValue}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-2">
                      <div
                        className="h-full bg-cyan-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!readyToClaim}
                      onClick={() => {
                        const res = onClaimChallenge(ch.id);
                        if (res.success) {
                          onTriggerFeedbackNotice(`Claimed +${res.reward} Coins!`);
                        } else if (res.reason) {
                          onTriggerFeedbackNotice(res.reason);
                        }
                      }}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        claimed
                          ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 cursor-default'
                          : readyToClaim
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {claimed
                        ? 'Reward Claimed'
                        : readyToClaim
                          ? `Claim +${ch.rewardCoins} Coins`
                          : 'In Progress'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. SETTINGS MODAL */}
      {activeModal === 'settings' && (
        <div
          role="dialog"
          aria-label="Game Settings"
          className="my-auto max-w-2xl w-full mx-auto bg-[#0b0f19]/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto max-h-[84vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-slate-100">
              Controls, Sensors, Audio & Graphics
            </h2>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="space-y-2.5 bg-slate-900/75 border border-slate-800 rounded-xl p-3">
              <div className="font-bold text-slate-200 uppercase tracking-wider">
                Steering Mode & Tilt Calibration
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Active Steering Input</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['tilt', 'buttons', 'drag'] as SteeringMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateSettings({ steeringMode: mode })}
                      className={`py-1.5 px-2 rounded-lg font-semibold capitalize border cursor-pointer ${
                        saveData.settings.steeringMode === mode
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Steering Sensitivity</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as SensitivityLevel[]).map((sens) => (
                    <button
                      key={sens}
                      type="button"
                      onClick={() => onUpdateSettings({ sensitivity: sens })}
                      className={`py-1.5 px-2 rounded-lg font-semibold capitalize border cursor-pointer ${
                        saveData.settings.sensitivity === sens
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      {sens}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-300">Invert Tilt Axis</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ invertTilt: !saveData.settings.invertTilt })
                  }
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    saveData.settings.invertTilt
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {saveData.settings.invertTilt ? 'Inverted' : 'Standard'}
                </button>
              </div>

              <div className="pt-1 border-t border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">
                    Neutral Offset: {saveData.settings.neutralTiltOffsetDeg.toFixed(1)}°
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onRequestMotionPermission}
                      className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 rounded-lg font-semibold cursor-pointer"
                    >
                      Enable Sensors
                    </button>
                    <button
                      type="button"
                      onClick={onCalibrateTiltNeutral}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg font-semibold cursor-pointer"
                    >
                      Calibrate 0°
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 bg-slate-900/75 border border-slate-800 rounded-xl p-3">
              <div className="font-bold text-slate-200 uppercase tracking-wider">
                Audio, Soundtrack & Graphics
              </div>

              <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-slate-200 font-semibold">Background Music</div>
                  <div className="text-[10px] text-slate-400">
                    Continuous looping race soundtrack
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="settings-music-toggle"
                  onClick={() =>
                    onUpdateSettings({
                      musicEnabled: !(saveData.settings.musicEnabled ?? true),
                    })
                  }
                  className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                    (saveData.settings.musicEnabled ?? true)
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {(saveData.settings.musicEnabled ?? true) ? 'ON' : 'OFF'}
                </button>
              </div>

              {onSelectMusicTrack && (
                <div>
                  <label className="block text-slate-400 mb-1">
                    Soundtrack Channel
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {MUSIC_TRACKS.map((tr) => {
                      const active = (musicTrack?.id ?? 'supplied_soundtrack') === tr.id;
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => onSelectMusicTrack(tr.id)}
                          className={`py-1.5 px-2.5 rounded-lg text-left border transition flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span>♪ {tr.title}</span>
                          <span className="text-[10px] font-mono opacity-80">
                            {tr.genre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Music Volume</span>
                  <span className="font-mono">
                    {Math.round(saveData.settings.musicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Music Volume"
                  min={0}
                  max={100}
                  value={Math.round(saveData.settings.musicVolume * 100)}
                  onChange={(e) =>
                    onUpdateSettings({ musicVolume: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>SFX Volume</span>
                  <span className="font-mono">
                    {Math.round(saveData.settings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="SFX Volume"
                  min={0}
                  max={100}
                  value={Math.round(saveData.settings.sfxVolume * 100)}
                  onChange={(e) =>
                    onUpdateSettings({ sfxVolume: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">3D Render Quality</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onUpdateSettings({ graphicsQuality: q })}
                      className={`py-1.5 px-2 rounded-lg font-semibold capitalize border cursor-pointer ${
                        saveData.settings.graphicsQuality === q
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. UNITY 6 LTS C# ARCHITECTURE & APK GUIDE MODAL */}
      {activeModal === 'unity_docs' && (
        <div
          role="dialog"
          aria-label="Unity 6 LTS C# and Android APK Guide"
          className="my-auto max-w-4xl w-full mx-auto bg-[#0b0f19]/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto max-h-[82vh] flex flex-col"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-slate-100">
                Unity 6 LTS (URP) C# Scripts & Android Release Guide
              </h2>
              <p className="text-xs text-slate-400">
                Production C# source code and AdMob Test IDs ({AD_CONFIG.testAppIdAndroid}).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {(
              [
                ['architecture', '1. Project Structure'],
                ['csharp', '2. C# Vehicle & AI Scripts'],
                ['admob', '3. AdMob Service (C#)'],
                ['apk', '4. Android APK Checklist'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setUnityDocTab(key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  unityDocTab === key
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {unityDocTab === 'architecture' &&
              `Assets/_VelocityRush/
├── Scenes/ (Boot.unity, MainMenu.unity, Garage.unity, SoloHighway.unity, LevelsCircuit.unity)
├── Scripts/Core/ (GameManager.cs, SaveManager.cs, EconomyService.cs)
├── Scripts/Gameplay/ (PlayerCarController.cs, AiRacerController.cs, ProceduralTrackBuilder.cs)
└── ScriptableObjects/ (CarConfigSO.cs, WheelConfigSO.cs, UpgradeTrackSO.cs)`}
            {unityDocTab === 'csharp' &&
              `// PlayerCarController.cs & AiRacerController.cs (Unity 6 LTS + InputSystem)
// Implements automatic longitudinal acceleration, tilt/touch steering, drift slip detection,
// and 5-opponent AI obstacle lookahead & lane selection matching src/game/levelsMode.ts.`}
            {unityDocTab === 'admob' &&
              `// Google Mobile Ads SDK Test IDs:
// App ID: ${AD_CONFIG.testAppIdAndroid}
// Rewarded: ${AD_CONFIG.testRewardedUnitIdAndroid}
// Interstitial: ${AD_CONFIG.testInterstitialUnitIdAndroid}`}
            {unityDocTab === 'apk' &&
              `1. Build Profiles -> Android -> Switch Platform
2. Player Settings -> Default Orientation: Landscape Left
3. Scripting Backend: IL2CPP, Target Architectures: ARM64`}
          </div>
        </div>
      )}

      {/* Bottom Safe-Area Control Hint Bar (Hidden in Garage/Modes and on compact mobile screens) */}
      {activeModal === 'none' && (
        <div className="hidden md:flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pointer-events-auto bg-[#0b0f19]/80 border border-slate-800/80 px-4 py-2 rounded-xl">
          <div>
            <span className="text-slate-200 font-semibold">Controls:</span> Tilt Phone · Touch LEFT/RIGHT · A/D or Arrows · SPACE/W Nitro · S Brake
          </div>
          <div className="text-slate-400">
            8 Distinct 3D Cars · Full Wheel/Paint/Aero Garage · Solo & 6-Car Levels Mode
          </div>
        </div>
      )}
    </div>
  );
};
