import React, { useState } from 'react';
import {
  AD_CONFIG,
  CAR_CONFIGS,
  CAR_ORDER,
  CarId,
  CHALLENGES_CONFIG,
  GraphicsQuality,
  SensitivityLevel,
  SteeringMode,
  UPGRADE_TRACKS,
  UpgradeStatKey,
} from '../game/config';
import { getEffectiveCarStats, getUpgradeCost } from '../game/rules';
import { SaveGameData } from '../game/saveSystem';
import { UNITY_CSHARP_SCRIPTS } from '../game/unityReference';

export type SubModalType = 'none' | 'garage' | 'challenges' | 'settings' | 'unity_docs';

interface TitleAndMenusProps {
  saveData: SaveGameData;
  activeModal: SubModalType;
  setActiveModal: (modal: SubModalType) => void;
  onStartRace: () => void;
  onSelectCar: (carId: CarId) => void;
  onUnlockCar: (carId: CarId) => { success: boolean; reason?: string };
  onUpgradeCarStat: (carId: CarId, statKey: UpgradeStatKey) => { success: boolean; reason?: string };
  onClaimChallenge: (challengeId: string) => { success: boolean; reason?: string; reward: number };
  onUpdateSettings: (partial: Partial<SaveGameData['settings']>) => void;
  onCalibrateTilt: () => void;
  simulatedTiltDeg: number;
  onChangeSimulatedTilt: (deg: number) => void;
  onRotateTurntable: (deltaRad: number) => void;
  onResetSaveData: () => void;
  statusNotice: string | null;
  onTriggerFeedbackNotice: (msg: string) => void;
}

export const TitleAndMenus: React.FC<TitleAndMenusProps> = ({
  saveData,
  activeModal,
  setActiveModal,
  onStartRace,
  onSelectCar,
  onUnlockCar,
  onUpgradeCarStat,
  onClaimChallenge,
  onUpdateSettings,
  onCalibrateTilt,
  simulatedTiltDeg,
  onChangeSimulatedTilt,
  onRotateTurntable,
  onResetSaveData,
  statusNotice,
  onTriggerFeedbackNotice,
}) => {
  const [inspectCarId, setInspectCarId] = useState<CarId>(saveData.selectedCarId);
  const [activeScriptIdx, setActiveScriptIdx] = useState(0);

  const inspectedCar = CAR_CONFIGS[inspectCarId] ?? CAR_CONFIGS.starter_apex;
  const inspectedUpgrades = saveData.carUpgrades[inspectCarId];
  const effectiveStats = getEffectiveCarStats(inspectCarId, inspectedUpgrades);
  const isInspectedUnlocked = saveData.unlockedCarIds.includes(inspectCarId);
  const isInspectedSelected = saveData.selectedCarId === inspectCarId;

  const handleOpenGarage = () => {
    setInspectCarId(saveData.selectedCarId);
    setActiveModal('garage');
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none">
      {/* Top Status Strip: Currency, Best Score, and Quick Modal Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        <div className="flex items-center gap-4 bg-[#0b0f19]/90 border border-slate-800 px-4 py-2 rounded-lg shadow-lg">
          {/* Coins Readout */}
          <div className="flex items-center gap-2" aria-label="Coin Balance">
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="12" cy="12" r="6" fill="#fbbf24" />
              <path d="M12 8v8M9.5 10.5h5M9.5 13.5h5" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-none">
                Coins
              </div>
              <div
                data-testid="menu-coin-balance"
                className="text-base sm:text-lg font-bold font-mono tabular-nums text-amber-400 leading-tight"
              >
                {saveData.coins}
              </div>
            </div>
          </div>

          <span className="text-slate-700" aria-hidden="true">
            /
          </span>

          {/* Personal Best Score */}
          <div aria-label="Personal Best Score">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-none">
              Best Score
            </div>
            <div
              data-testid="menu-best-score"
              className="text-base sm:text-lg font-bold font-mono tabular-nums text-cyan-400 leading-tight"
            >
              {saveData.bestScore}
            </div>
          </div>

          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">
            /
          </span>

          {/* Active Car Summary */}
          <div className="hidden sm:block">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-none">
              Active Vehicle
            </div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">
              {CAR_CONFIGS[saveData.selectedCarId].name}
            </div>
          </div>
        </div>

        {/* Top-Right Secondary Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'unity_docs' ? 'none' : 'unity_docs')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'unity_docs'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-[#0b0f19]/90 text-slate-200 border-slate-800 hover:border-slate-600'
            }`}
          >
            Unity 6 C# & APK Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'settings' ? 'none' : 'settings')}
            aria-label="Open Settings"
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModal === 'settings'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-[#0b0f19]/90 text-slate-200 border-slate-800 hover:border-slate-600'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Feedback Toast Notice if present */}
      {statusNotice && (
        <div
          role="status"
          className="self-center bg-[#0b0f19]/95 border border-cyan-500/60 text-cyan-200 px-4 py-2 rounded-lg text-xs font-medium shadow-lg pointer-events-auto"
        >
          {statusNotice}
        </div>
      )}

      {/* MAIN TITLE SCREEN STAGE (Negative-space left third lockup, unobstructed 3D hero car on right) */}
      {activeModal === 'none' && (
        <div className="my-auto max-w-md pointer-events-auto bg-[#0b0f19]/88 border border-slate-800/90 p-6 sm:p-7 rounded-xl shadow-2xl">
          {/* Custom Inline SVG Emblem Lockup for VELOCITY RUSH */}
          <div className="mb-4">
            <svg
              viewBox="0 0 380 86"
              className="w-full max-w-[330px] h-auto block"
              role="img"
              aria-label="Velocity Rush Highway Arcade Racing"
            >
              <defs>
                <linearGradient id="vrCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06B6D4" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
                <linearGradient id="vrAmberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#FBBF24" />
                </linearGradient>
              </defs>
              {/* Speed Wing Accent */}
              <polygon points="4,16 56,16 44,24 0,24" fill="url(#vrCyanGrad)" />
              <polygon points="14,30 46,30 38,36 8,36" fill="url(#vrAmberGrad)" />
              {/* Title Typography */}
              <text
                x="62"
                y="40"
                fill="#F8FAFC"
                fontFamily="'Chakra Petch', sans-serif"
                fontWeight="700"
                fontStyle="italic"
                fontSize="36"
                letterSpacing="1.5"
              >
                VELOCITY
              </text>
              <text
                x="62"
                y="74"
                fill="url(#vrCyanGrad)"
                fontFamily="'Chakra Petch', sans-serif"
                fontWeight="700"
                fontStyle="italic"
                fontSize="34"
                letterSpacing="3"
              >
                RUSH
              </text>
              {/* Tachometer Redline Bar */}
              <rect x="242" y="54" width="118" height="6" rx="3" fill="#1E293B" />
              <rect x="242" y="54" width="84" height="6" rx="3" fill="url(#vrAmberGrad)" />
              <rect x="330" y="54" width="30" height="6" rx="3" fill="#EF4444" />
            </svg>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              High-speed endless highway survival. Thread near-misses through city traffic to charge your nitro core and upgrade your garage fleet.
            </p>
          </div>

          {/* Primary Play Action & Core Menu Actions */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStartRace}
              className="w-full py-3.5 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-300 text-slate-950 font-bold text-base tracking-wide uppercase transition-transform active:scale-[0.99] shadow-lg cursor-pointer whitespace-nowrap"
            >
              Play Race
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleOpenGarage}
                className="py-2.5 px-4 rounded-lg bg-slate-800/95 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Garage ({saveData.unlockedCarIds.length}/{CAR_ORDER.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('challenges')}
                className="py-2.5 px-4 rounded-lg bg-slate-800/95 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Challenges
              </button>
            </div>
          </div>

          {/* Quiet Telemetry Metadata Line */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Steering: {saveData.settings.steeringMode.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>Best Dist: {saveData.bestDistance}m</span>
            <span aria-hidden="true">·</span>
            <span>Runs: {saveData.completedRacesCount}</span>
          </div>
        </div>
      )}

      {/* GARAGE VIEW (Unobstructed 3D Turntable Center + Sleek Bottom Showroom Dock) */}
      {activeModal === 'garage' && (
        <div className="mt-auto w-full max-w-4xl mx-auto pointer-events-auto bg-[#0b0f19]/92 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xl">
          {/* Header Row: Vehicle Selector Tabs & Turntable Rotation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Garage Vehicles">
              {CAR_ORDER.map((cid) => {
                const cfg = CAR_CONFIGS[cid];
                const unlocked = saveData.unlockedCarIds.includes(cid);
                const active = inspectCarId === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setInspectCarId(cid);
                      if (unlocked) {
                        onSelectCar(cid);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {cfg.name} {!unlocked ? `(${cfg.unlockCost} Coins)` : ''}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRotateTurntable(-0.6)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
              >
                Rotate Left
              </button>
              <button
                type="button"
                onClick={() => onRotateTurntable(0.6)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
              >
                Rotate Right
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
              >
                Back to Menu
              </button>
            </div>
          </div>

          {/* Vehicle Details & 4 Upgrade Tracks */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-4 flex flex-col justify-between gap-2">
              <div>
                <div className="text-xs text-cyan-400 font-medium">{inspectedCar.classTag}</div>
                <h2 className="text-xl font-bold text-slate-100">{inspectedCar.name}</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {inspectedCar.description}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                {!isInspectedUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      const res = onUnlockCar(inspectCarId);
                      if (!res.success && res.reason) {
                        onTriggerFeedbackNotice(res.reason);
                      } else {
                        onTriggerFeedbackNotice(`Unlocked and equipped ${inspectedCar.name}!`);
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer whitespace-nowrap"
                  >
                    Unlock Vehicle · {inspectedCar.unlockCost} Coins
                  </button>
                ) : isInspectedSelected ? (
                  <button
                    type="button"
                    data-start="true"
                    onClick={onStartRace}
                    className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer whitespace-nowrap"
                  >
                    Selected · Race Now
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCar(inspectCarId);
                      onTriggerFeedbackNotice(`Equipped ${inspectedCar.name}`);
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer whitespace-nowrap"
                  >
                    Select Vehicle
                  </button>
                )}
              </div>
            </div>

            {/* 4 Upgrade Stat Cards */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(UPGRADE_TRACKS) as UpgradeStatKey[]).map((statKey) => {
                const track = UPGRADE_TRACKS[statKey];
                const currentLvl = inspectedUpgrades[statKey] ?? 0;
                const isMax = currentLvl >= track.maxLevel;
                const cost = getUpgradeCost(statKey, currentLvl);

                const statValueDisplay =
                  statKey === 'topSpeed'
                    ? `${effectiveStats.topSpeedKmh} km/h`
                    : statKey === 'acceleration'
                      ? `${effectiveStats.acceleration} m/s²`
                      : statKey === 'handling'
                        ? `${effectiveStats.handling} Lat`
                        : `${effectiveStats.nitroCapacity}s`;

                return (
                  <div
                    key={statKey}
                    className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{track.label}</span>
                        <span className="text-xs font-mono tabular-nums text-cyan-400">
                          {statValueDisplay}
                        </span>
                      </div>
                      {/* 5 Discrete Level Pips */}
                      <div className="flex items-center gap-1 mt-1.5" aria-label={`Level ${currentLvl} of ${track.maxLevel}`}>
                        {Array.from({ length: track.maxLevel }, (_, idx) => (
                          <span
                            key={idx}
                            className={`h-1.5 w-5 rounded-sm ${
                              idx < currentLvl ? 'bg-cyan-400' : 'bg-slate-800'
                            }`}
                          />
                        ))}
                        <span className="text-[11px] font-mono tabular-nums text-slate-400 ml-1">
                          Lv.{currentLvl}/{track.maxLevel}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!isInspectedUnlocked || isMax}
                      onClick={() => {
                        const res = onUpgradeCarStat(inspectCarId, statKey);
                        if (!res.success && res.reason) {
                          onTriggerFeedbackNotice(res.reason);
                        }
                      }}
                      aria-label={`Upgrade ${track.label}`}
                      className={`px-3 py-2 rounded-lg text-xs font-bold font-mono tabular-nums shrink-0 transition-colors cursor-pointer whitespace-nowrap ${
                        !isInspectedUnlocked
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : isMax
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 cursor-default'
                            : saveData.coins >= cost
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
                      }`}
                    >
                      {isMax ? 'MAX' : `${cost} Coins`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CHALLENGES / MISSIONS MODAL */}
      {activeModal === 'challenges' && (
        <div
          role="dialog"
          aria-label="Highway Challenges"
          className="my-auto w-full max-w-2xl mx-auto pointer-events-auto bg-[#0b0f19]/95 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                Driver Challenges & Milestones
              </h2>
              <p className="text-xs text-slate-400">
                Lifetime career targets with fair coin payouts — no daily streak penalties.
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

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {CHALLENGES_CONFIG.map((ch) => {
              const currentVal =
                ch.metric === 'distance'
                  ? saveData.challenges.cumulativeDistance
                  : ch.metric === 'coins'
                    ? saveData.challenges.cumulativeCoins
                    : ch.metric === 'nearMisses'
                      ? saveData.challenges.cumulativeNearMisses
                      : saveData.challenges.cumulativeScore;
              const claimed = saveData.challenges.claimedChallengeIds.includes(ch.id);
              const pct = Math.min(100, Math.round((currentVal / ch.targetValue) * 100));
              const canClaim = !claimed && currentVal >= ch.targetValue;

              return (
                <div
                  key={ch.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-100">{ch.title}</span>
                      <span className="text-xs font-mono tabular-nums text-cyan-400">
                        {Math.min(currentVal, ch.targetValue)} / {ch.targetValue} ({pct}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ch.description}</p>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-cyan-400 transition-transform origin-left"
                        style={{ transform: `scaleX(${pct / 100})` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canClaim}
                    onClick={() => {
                      const res = onClaimChallenge(ch.id);
                      if (res.success) {
                        onTriggerFeedbackNotice(`Claimed +${res.reward} Coins!`);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tabular-nums shrink-0 cursor-pointer whitespace-nowrap ${
                      claimed
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 cursor-default'
                        : canClaim
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {claimed ? 'Claimed' : `Claim +${ch.rewardCoins} Coins`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SETTINGS & MOTION CALIBRATION MODAL */}
      {activeModal === 'settings' && (
        <div
          role="dialog"
          aria-label="Settings and Controls"
          className="my-auto w-full max-w-2xl mx-auto pointer-events-auto bg-[#0b0f19]/95 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xl max-h-[82vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                Controls, Calibration & Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure mobile motion tilt steering, sensitivity, audio channels, and AdMob privacy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
            >
              Done
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Control Mode Selection */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5">
              <div className="font-semibold text-slate-200 mb-2">Steering Control Mode</div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'tilt', label: 'Tilt Motion' },
                    { id: 'buttons', label: 'On-Screen Buttons' },
                    { id: 'drag', label: 'Touch & Drag' },
                  ] as { id: SteeringMode; label: string }[]
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onUpdateSettings({ steeringMode: mode.id })}
                    className={`py-2 px-3 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      saveData.settings.steeringMode === mode.id
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Steering Sensitivity */}
              <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-300">Steering Sensitivity</span>
                <div className="flex items-center gap-1.5">
                  {(['low', 'medium', 'high'] as SensitivityLevel[]).map((sens) => (
                    <button
                      key={sens}
                      type="button"
                      onClick={() => onUpdateSettings({ sensitivity: sens })}
                      className={`px-3 py-1.5 rounded-md font-semibold uppercase cursor-pointer ${
                        saveData.settings.sensitivity === sens
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sens}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tilt Calibration, Inversion & Desktop Sensor Test Slider */}
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-200">
                      Tilt Sensor Calibration & Inversion
                    </div>
                    <div className="text-slate-400">
                      Neutral Offset: {saveData.settings.neutralTiltOffsetDeg.toFixed(1)}°
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ invertTilt: !saveData.settings.invertTilt })
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold border cursor-pointer ${
                        saveData.settings.invertTilt
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      Invert Tilt: {saveData.settings.invertTilt ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={onCalibrateTilt}
                      className="px-3 py-1.5 rounded-lg font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer"
                    >
                      Calibrate Neutral
                    </button>
                  </div>
                </div>

                {/* Simulated Device Tilt Angle Slider for Editor / Browser Verification */}
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                  <label
                    htmlFor="sim-tilt-slider"
                    className="flex items-center justify-between text-slate-300 font-medium mb-1"
                  >
                    <span>Editor / Browser Tilt Sensor Simulator (Degrees)</span>
                    <span className="font-mono tabular-nums text-cyan-400">
                      {simulatedTiltDeg > 0 ? `+${simulatedTiltDeg}°` : `${simulatedTiltDeg}°`}
                    </span>
                  </label>
                  <input
                    id="sim-tilt-slider"
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={simulatedTiltDeg}
                    onChange={(e) => onChangeSimulatedTilt(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Audio & Graphics Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                <div className="font-semibold text-slate-200">Audio Mixing</div>
                <div>
                  <label
                    htmlFor="music-vol-slider"
                    className="flex justify-between text-slate-400 mb-1"
                  >
                    <span>Music Volume</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {Math.round(saveData.settings.musicVolume * 100)}%
                    </span>
                  </label>
                  <input
                    id="music-vol-slider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={saveData.settings.musicVolume}
                    onChange={(e) =>
                      onUpdateSettings({ musicVolume: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sfx-vol-slider"
                    className="flex justify-between text-slate-400 mb-1"
                  >
                    <span>Sound Effects (SFX) Volume</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {Math.round(saveData.settings.sfxVolume * 100)}%
                    </span>
                  </label>
                  <input
                    id="sfx-vol-slider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={saveData.settings.sfxVolume}
                    onChange={(e) =>
                      onUpdateSettings({ sfxVolume: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="font-semibold text-slate-200 mb-2">
                    Graphics Quality & Haptics
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onUpdateSettings({ graphicsQuality: q })}
                        className={`flex-1 py-1.5 rounded-md font-semibold uppercase cursor-pointer ${
                          saveData.settings.graphicsQuality === q
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-slate-300">Haptic Vibration</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        vibrationEnabled: !saveData.settings.vibrationEnabled,
                      })
                    }
                    className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                      saveData.settings.vibrationEnabled
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {saveData.settings.vibrationEnabled ? 'ENABLED' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Options (AdMob UMP) & Save Data Management */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-200">
                  Privacy & Google AdMob Consent (UMP)
                </div>
                <div className="text-slate-400">
                  Current Mode: {saveData.settings.adsConsentStatus.replace('_', ' ').toUpperCase()} · Test Unit: {AD_CONFIG.testRewardedUnitIdAndroid}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next =
                      saveData.settings.adsConsentStatus === 'personalized'
                        ? 'non_personalized'
                        : 'personalized';
                    onUpdateSettings({ adsConsentStatus: next });
                    onTriggerFeedbackNotice(`Ad privacy updated to ${next}`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 cursor-pointer"
                >
                  Privacy Options
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      simulatedAdsOffline: !saveData.settings.simulatedAdsOffline,
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg font-semibold border cursor-pointer ${
                    saveData.settings.simulatedAdsOffline
                      ? 'bg-amber-950 text-amber-300 border-amber-600'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {saveData.settings.simulatedAdsOffline ? 'Ads: Offline Mode' : 'Ads: Online (Test SDK)'}
                </button>
                <button
                  type="button"
                  onClick={onResetSaveData}
                  className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-800/70 font-semibold cursor-pointer"
                >
                  Reset Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNITY 6 C# SOURCE & ANDROID APK/AAB BUILD GUIDE MODAL */}
      {activeModal === 'unity_docs' && (
        <div
          role="dialog"
          aria-label="Unity 6 C# Architecture and Build Guide"
          className="my-auto w-full max-w-4xl mx-auto pointer-events-auto bg-[#0b0f19]/95 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xl max-h-[82vh] flex flex-col"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Unity 6 LTS (URP) C# Source & Android Release Guide
              </h2>
              <p className="text-xs text-slate-400">
                Complete C# scripts exported under /Assets/Scripts/ and /Documentation/README.md alongside this playable WebGL build.
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

          <div className="flex flex-wrap gap-1.5 mb-3">
            {UNITY_CSHARP_SCRIPTS.map((item, idx) => (
              <button
                key={item.path}
                type="button"
                onClick={() => setActiveScriptIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                  activeScriptIdx === idx
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-300 mb-2">
            <span className="font-mono text-cyan-400">
              {UNITY_CSHARP_SCRIPTS[activeScriptIdx].path}
            </span>{' '}
            — {UNITY_CSHARP_SCRIPTS[activeScriptIdx].summary}
          </div>

          <pre className="flex-1 overflow-auto bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-[11px] font-mono text-slate-200 leading-relaxed">
            <code>{UNITY_CSHARP_SCRIPTS[activeScriptIdx].code}</code>
          </pre>
        </div>
      )}

      {/* Bottom Safe-Area Control Hint Bar (Flat inline text, no pill clutter) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pointer-events-auto bg-[#0b0f19]/80 px-4 py-2 rounded-lg border border-slate-800/60">
        <span>
          A/D or Arrows Steer · Space/W Nitro · S Brake · Tilt/Touch Supported · P/Esc Pause
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          AdMob Test Banner Safe Zone (Menu Only · Hidden in Race)
        </span>
      </div>
    </div>
  );
};
