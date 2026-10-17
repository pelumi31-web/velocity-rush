import React, { useState } from 'react';
import { SteeringMode } from '../game/config';
import {
  CompletedRunPayload,
  GameLifecycleState,
  HudDomRefs,
  LiveRaceSnapshot,
  TouchInputControlsRef,
} from './HighwayCanvas';

interface RaceHudAndModalsProps {
  gameState: GameLifecycleState;
  hudRefs: HudDomRefs;
  controlsRef: React.MutableRefObject<TouchInputControlsRef>;
  liveSnapshot: LiveRaceSnapshot;
  steeringMode: SteeringMode;
  simulatedTiltDeg: number;
  onChangeSimulatedTilt: (deg: number) => void;
  onCalibrateTilt: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onPauseToggle: () => void;
  onRestartRace: () => void;
  onExitToMenu: () => void;
  onOpenGarageFromResults: () => void;
  onOpenSettingsFromPause: () => void;
  lastRunPayload: CompletedRunPayload | null;
  bestScore: number;
  rewardedBonusClaimed: boolean;
  adsOffline: boolean;
  onWatchRewardedAdForBonus: (sdkConfirmed: boolean) => void;
  onWatchRewardedAdForRevive: () => void;
  interstitialNotice: string | null;
}

export const RaceHudAndModals: React.FC<RaceHudAndModalsProps> = ({
  gameState,
  hudRefs,
  controlsRef,
  liveSnapshot,
  steeringMode,
  simulatedTiltDeg,
  onChangeSimulatedTilt,
  onCalibrateTilt,
  isMuted,
  onToggleMute,
  onPauseToggle,
  onRestartRace,
  onExitToMenu,
  onOpenGarageFromResults,
  onOpenSettingsFromPause,
  lastRunPayload,
  bestScore,
  rewardedBonusClaimed,
  adsOffline,
  onWatchRewardedAdForBonus,
  onWatchRewardedAdForRevive,
  interstitialNotice,
}) => {
  const [adModalMode, setAdModalMode] = useState<'none' | 'bonus_coins' | 'revive'>('none');

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* 1. TOP PERIMETER HUD CLUSTERS (<= 3 compact clusters, >= 85% clear viewport) */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Cluster: Speedometer, Distance & Discrete Hull Integrity Sockets */}
        <div className="bg-[#0b0f19]/88 border border-slate-800/90 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-5 pointer-events-auto">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              SPEED KM/H
            </div>
            <div className="flex items-baseline gap-1">
              <span
                ref={hudRefs.speedValueRef}
                data-testid="hud-speed"
                className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-cyan-400 leading-none"
              >
                85
              </span>
            </div>
          </div>

          <div className="border-l border-slate-800 pl-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              DISTANCE
            </div>
            <span
              ref={hudRefs.distanceValueRef}
              data-testid="hud-distance"
              className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-100 leading-none"
            >
              0m
            </span>
          </div>

          {/* 3 Discrete Hull Integrity Shield Sockets */}
          <div className="border-l border-slate-800 pl-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              HULL SHIELD
            </div>
            <div className="flex items-center gap-1.5" aria-label={`Hull Integrity ${liveSnapshot.integrity} of ${liveSnapshot.maxIntegrity}`}>
              {Array.from({ length: liveSnapshot.maxIntegrity }, (_, idx) => {
                const isFull = idx < liveSnapshot.integrity;
                return (
                  <svg
                    key={idx}
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 2L4 5.5v6c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5v-6L12 2z"
                      fill={isFull ? '#06b6d4' : '#0f172a'}
                      stroke={isFull ? '#67e8f9' : '#334155'}
                      strokeWidth="2"
                    />
                  </svg>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top-Center Dynamic Countdown / Near-Miss Callout */}
        <div className="flex flex-col items-center pointer-events-none">
          {liveSnapshot.countdownValue !== null && (
            <div
              data-testid="hud-countdown"
              className="bg-[#0b0f19]/92 border border-cyan-500/60 px-6 py-2 rounded-xl text-2xl sm:text-3xl font-bold font-mono text-cyan-300 shadow-2xl"
            >
              {liveSnapshot.countdownValue === 0 ? 'GO!' : liveSnapshot.countdownValue}
            </div>
          )}

          {liveSnapshot.comboBanner && (
            <div
              key={liveSnapshot.comboBanner.id}
              className={`mt-1 px-4 py-1.5 rounded-lg border text-center shadow-lg ${
                liveSnapshot.comboBanner.tone === 'danger'
                  ? 'bg-red-950/90 border-red-500 text-red-200'
                  : 'bg-[#0b0f19]/90 border-cyan-400 text-cyan-300'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                {liveSnapshot.comboBanner.text}
              </div>
              <div className="text-[11px] text-slate-300">
                {liveSnapshot.comboBanner.subtext}
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Cluster: Score, Coins & Utility Icon Buttons (Mute [M], Pause [P], Restart [R]) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-[#0b0f19]/88 border border-slate-800/90 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                SCORE
              </div>
              <span
                ref={hudRefs.scoreValueRef}
                data-testid="hud-score"
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-100 leading-none"
              >
                0
              </span>
            </div>

            <div className="border-l border-slate-800 pl-4 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                COINS
              </div>
              <span
                ref={hudRefs.coinsValueRef}
                data-testid="hud-coins"
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-400 leading-none"
              >
                0
              </span>
            </div>
          </div>

          {/* Utility Controls: Mute [M], Pause [P], Restart [R] */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-11 h-11 rounded-xl bg-[#0b0f19]/90 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                {isMuted ? (
                  <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                ) : (
                  <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart Race"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartRace();
              }}
              className="w-11 h-11 rounded-xl bg-[#0b0f19]/90 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Race"
              onClick={(e) => {
                e.currentTarget.blur();
                onPauseToggle();
              }}
              className="w-11 h-11 rounded-xl bg-[#0b0f19]/90 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM PERIMETER CONTROLS (Touch Steering, Nitro Meter & Pedals) */}
      {gameState === 'playing' && (
        <div className="flex flex-col gap-2.5 mt-auto">
          {/* Mode-Specific Tilt or Drag Control Strip */}
          {steeringMode === 'tilt' && (
            <div className="self-center bg-[#0b0f19]/90 border border-slate-800 px-4 py-2 rounded-xl flex flex-wrap items-center gap-3 pointer-events-auto">
              <div className="text-xs font-semibold text-cyan-400">
                Tilt Steering Active (Landscape)
              </div>
              <span
                ref={hudRefs.tiltAngleBadgeRef}
                className="text-xs font-mono tabular-nums text-slate-200 bg-slate-900 px-2 py-0.5 rounded"
              >
                0°
              </span>
              <input
                type="range"
                aria-label="Tilt Steering Angle Control"
                min={-28}
                max={28}
                step={1}
                value={simulatedTiltDeg}
                onChange={(e) => onChangeSimulatedTilt(Number(e.target.value))}
                className="w-32 sm:w-44 accent-cyan-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={onCalibrateTilt}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md cursor-pointer"
              >
                Calibrate 0°
              </button>
            </div>
          )}

          {steeringMode === 'drag' && (
            <div className="self-center bg-[#0b0f19]/90 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 pointer-events-auto">
              <span className="text-xs font-semibold text-slate-300">
                Touch & Drag Steer
              </span>
              <input
                type="range"
                aria-label="Touch Drag Steering Slider"
                min={-100}
                max={100}
                defaultValue={0}
                onChange={(e) => {
                  controlsRef.current.dragSteerNormalized = Number(e.target.value) / 100;
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLInputElement).value = '0';
                  controlsRef.current.dragSteerNormalized = 0;
                }}
                onTouchEnd={(e) => {
                  (e.currentTarget as HTMLInputElement).value = '0';
                  controlsRef.current.dragSteerNormalized = 0;
                }}
                className="w-48 sm:w-64 accent-cyan-400 cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-end justify-between gap-3">
            {/* Left Touch Steering Buttons */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                aria-label="Steer Left"
                onPointerDown={() => {
                  controlsRef.current.steerLeftHeld = true;
                }}
                onPointerUp={() => {
                  controlsRef.current.steerLeftHeld = false;
                }}
                onPointerLeave={() => {
                  controlsRef.current.steerLeftHeld = false;
                }}
                className="w-16 h-14 sm:w-20 sm:h-16 rounded-xl bg-[#0b0f19]/90 active:bg-cyan-500 active:text-slate-950 border border-slate-700 text-slate-100 font-bold text-sm flex items-center justify-center shadow-lg cursor-pointer select-none"
              >
                LEFT
              </button>
              <button
                type="button"
                aria-label="Steer Right"
                onPointerDown={() => {
                  controlsRef.current.steerRightHeld = true;
                }}
                onPointerUp={() => {
                  controlsRef.current.steerRightHeld = false;
                }}
                onPointerLeave={() => {
                  controlsRef.current.steerRightHeld = false;
                }}
                className="w-16 h-14 sm:w-20 sm:h-16 rounded-xl bg-[#0b0f19]/90 active:bg-cyan-500 active:text-slate-950 border border-slate-700 text-slate-100 font-bold text-sm flex items-center justify-center shadow-lg cursor-pointer select-none"
              >
                RIGHT
              </button>
            </div>

            {/* Center Nitro Meter Bar */}
            <div className="flex-1 max-w-xs mx-auto bg-[#0b0f19]/90 border border-slate-800 rounded-xl px-3.5 py-2 pointer-events-auto">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1">
                <span className="text-cyan-400">NITRO CORE</span>
                <span
                  ref={hudRefs.nitroPctRef}
                  className="font-mono tabular-nums text-slate-200"
                >
                  100%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  ref={hudRefs.nitroFillRef}
                  className="w-full h-full bg-cyan-400 origin-left transition-transform duration-75"
                  style={{ transform: 'scaleX(1)' }}
                />
              </div>
            </div>

            {/* Right Touch Brake & Nitro Action Buttons */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                aria-label="Brake"
                onPointerDown={() => {
                  controlsRef.current.brakeHeld = true;
                }}
                onPointerUp={() => {
                  controlsRef.current.brakeHeld = false;
                }}
                onPointerLeave={() => {
                  controlsRef.current.brakeHeld = false;
                }}
                className="w-16 h-14 sm:w-20 sm:h-16 rounded-xl bg-[#0b0f19]/90 active:bg-amber-500 active:text-slate-950 border border-slate-700 text-amber-400 font-bold text-xs sm:text-sm flex items-center justify-center shadow-lg cursor-pointer select-none"
              >
                BRAKE
              </button>
              <button
                type="button"
                aria-label="Activate Nitro Boost"
                onPointerDown={() => {
                  controlsRef.current.nitroHeld = true;
                }}
                onPointerUp={() => {
                  controlsRef.current.nitroHeld = false;
                }}
                onPointerLeave={() => {
                  controlsRef.current.nitroHeld = false;
                }}
                className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center shadow-lg cursor-pointer select-none"
              >
                NITRO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PAUSE MODAL (gameState === 'paused') */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-label="Race Paused"
          className="my-auto w-full max-w-md mx-auto bg-[#0b0f19]/95 border border-slate-800 rounded-xl p-6 shadow-2xl pointer-events-auto"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Simulation Frozen
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mt-0.5 mb-4">
            Race Paused
          </h2>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onPauseToggle}
              className="w-full py-3 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm uppercase tracking-wide cursor-pointer"
            >
              Resume Race
            </button>
            <button
              type="button"
              onClick={onRestartRace}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 cursor-pointer"
            >
              Restart Race
            </button>
            <button
              type="button"
              onClick={onOpenSettingsFromPause}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 cursor-pointer"
            >
              Settings & Calibration
            </button>
            <button
              type="button"
              onClick={onExitToMenu}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-800 cursor-pointer"
            >
              Exit to Main Menu
            </button>
          </div>
        </div>
      )}

      {/* 4. RESULTS / GAME OVER MODAL (gameState === 'gameover') */}
      {gameState === 'gameover' && lastRunPayload && (
        <div
          role="dialog"
          aria-label="Race Results"
          className="my-auto w-full max-w-lg mx-auto bg-[#0b0f19]/95 border border-slate-800 rounded-xl p-6 shadow-2xl pointer-events-auto"
        >
          {adModalMode === 'none' ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Run Complete
                </span>
                {interstitialNotice && (
                  <span className="text-[11px] font-mono text-slate-400">
                    {interstitialNotice}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mt-0.5 mb-4">
                Highway Run Summary
              </h2>

              {/* 3 Primary Stat Tiles (tabular-nums) */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Final Score
                  </div>
                  <div
                    data-testid="results-score"
                    className="text-xl font-bold font-mono tabular-nums text-cyan-400 mt-0.5"
                  >
                    {lastRunPayload.summary.totalScore}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    Best: {Math.max(bestScore, lastRunPayload.summary.totalScore)}
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Distance
                  </div>
                  <div
                    data-testid="results-distance"
                    className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-0.5"
                  >
                    {lastRunPayload.summary.distanceMeters}m
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    Near Misses: {lastRunPayload.nearMissCount}
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Coins Earned
                  </div>
                  <div
                    data-testid="results-coins"
                    className="text-xl font-bold font-mono tabular-nums text-amber-400 mt-0.5"
                  >
                    +{ (rewardedBonusClaimed ? lastRunPayload.summary.totalCoinsEarned * 2 : lastRunPayload.summary.totalCoinsEarned) }
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {rewardedBonusClaimed ? '2x Ad Bonus Applied' : 'Credited to Garage'}
                  </div>
                </div>
              </div>

              {/* Optional Clearly-Labelled Rewarded Video Offers (Never mandatory) */}
              {!adsOffline && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                  {!rewardedBonusClaimed && lastRunPayload.summary.totalCoinsEarned > 0 && (
                    <button
                      type="button"
                      onClick={() => setAdModalMode('bonus_coins')}
                      className="py-2.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 font-semibold text-xs text-left cursor-pointer"
                    >
                      <div className="font-bold">Watch Ad · 2x Coin Bonus</div>
                      <div className="text-[11px] text-amber-200/80">
                        Earn +{Math.max(10, lastRunPayload.summary.totalCoinsEarned)} extra coins
                      </div>
                    </button>
                  )}

                  {lastRunPayload.reviveAvailable && (
                    <button
                      type="button"
                      onClick={() => setAdModalMode('revive')}
                      className="py-2.5 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 font-semibold text-xs text-left cursor-pointer"
                    >
                      <div className="font-bold">Watch Ad · 1x Revive Hull</div>
                      <div className="text-[11px] text-cyan-200/80">
                        Continue this race from {lastRunPayload.summary.distanceMeters}m
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Primary Post-Race Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={onRestartRace}
                  className="flex-1 py-3 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm uppercase tracking-wide cursor-pointer"
                >
                  Retry Race
                </button>
                <button
                  type="button"
                  onClick={onOpenGarageFromResults}
                  className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 cursor-pointer"
                >
                  Garage
                </button>
                <button
                  type="button"
                  onClick={onExitToMenu}
                  className="py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-800 cursor-pointer"
                >
                  Main Menu
                </button>
              </div>
            </>
          ) : (
            /* Simulated Google AdMob Rewarded Video Test SDK Overlay */
            <div className="space-y-4">
              <div className="text-xs font-mono text-amber-400 uppercase">
                Google Mobile Ads SDK · Test Rewarded Ad
              </div>
              <h3 className="text-lg font-bold text-slate-100">
                {adModalMode === 'bonus_coins'
                  ? `Rewarded Video: +${Math.max(10, lastRunPayload.summary.totalCoinsEarned)} Bonus Coins`
                  : 'Rewarded Video: Restore Hull Integrity & Continue'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Test how the game handles SDK callbacks: grants the reward only when OnUserEarnedReward fires, and grants nothing if closed early.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const mode = adModalMode;
                    setAdModalMode('none');
                    if (mode === 'bonus_coins') {
                      onWatchRewardedAdForBonus(true);
                    } else {
                      onWatchRewardedAdForRevive();
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase cursor-pointer"
                >
                  Complete Ad (Grant Reward)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdModalMode('none');
                    onWatchRewardedAdForBonus(false);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 cursor-pointer"
                >
                  Close Ad Early (No Reward)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
