import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CAR_CONFIGS, GamePlayMode, SteeringMode } from '../game/config';
import {
  CompletedRunPayload,
  GameLifecycleState,
  HudDomRefs,
  LiveRaceSnapshot,
  TouchInputControlsRef,
} from './HighwayCanvas';

const SHORT_TAP_MAX_DURATION_MS = 180;
const SHORT_TAP_IMPULSE_DURATION_SEC = 0.14;
const SHORT_TAP_IMPULSE_STRENGTH = 0.85;

interface RaceHudAndModalsProps {
  gameState: GameLifecycleState;
  playMode?: GamePlayMode;
  hudRefs: HudDomRefs;
  controlsRef: React.MutableRefObject<TouchInputControlsRef>;
  liveSnapshot: LiveRaceSnapshot;
  steeringMode: SteeringMode;
  simulatedTiltDeg: number;
  onChangeSimulatedTilt: (deg: number) => void;
  onCalibrateTilt: () => void;
  onRequestMotionPermission: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  musicEnabled?: boolean;
  onToggleMusicEnabled?: () => void;
  musicTrackTitle?: string;
  onCycleMusicTrack?: () => void;
  onPauseToggle: () => void;
  onRestartRace: () => void;
  onNextLevel?: () => void;
  onReturnToModes?: () => void;
  onExitToMenu: () => void;
  onOpenGarageFromResults: () => void;
  onOpenSettingsFromPause: () => void;
  lastRunPayload: CompletedRunPayload | null;
  bestScore: number;
  totalCoinsBalance?: number;
  rewardedBonusClaimed: boolean;
  adsOffline: boolean;
  onWatchRewardedAdForBonus: (sdkConfirmed: boolean) => void;
  onWatchRewardedAdForRevive: () => void;
  interstitialNotice: string | null;
}

export const RaceHudAndModals: React.FC<RaceHudAndModalsProps> = ({
  gameState,
  playMode = 'solo',
  hudRefs,
  controlsRef,
  liveSnapshot,
  steeringMode,
  onCalibrateTilt,
  onRequestMotionPermission,
  isMuted,
  onToggleMute,
  musicEnabled = true,
  onToggleMusicEnabled,
  musicTrackTitle,
  onCycleMusicTrack,
  onPauseToggle,
  onRestartRace,
  onNextLevel,
  onReturnToModes,
  onExitToMenu,
  onOpenGarageFromResults,
  onOpenSettingsFromPause,
  lastRunPayload,
  bestScore,
  totalCoinsBalance = 0,
  rewardedBonusClaimed,
  adsOffline,
  onWatchRewardedAdForBonus,
  onWatchRewardedAdForRevive,
  interstitialNotice,
}) => {
  const [adModalMode, setAdModalMode] = useState<'none' | 'bonus_coins' | 'revive'>('none');
  const [activeSteerUi, setActiveSteerUi] = useState<{
    left: boolean;
    right: boolean;
    isLongPress: boolean;
  }>({ left: false, right: false, isLongPress: false });

  const steerGestureRef = useRef<{
    leftStartMs: number | null;
    rightStartMs: number | null;
    longPressTimerId: number | null;
    activePointerId: number | null;
  }>({
    leftStartMs: null,
    rightStartMs: null,
    longPressTimerId: null,
    activePointerId: null,
  });

  const clearLongPressTimer = useCallback(() => {
    if (steerGestureRef.current.longPressTimerId !== null) {
      window.clearTimeout(steerGestureRef.current.longPressTimerId);
      steerGestureRef.current.longPressTimerId = null;
    }
  }, []);

  const applySteeringHoldState = useCallback(
    (leftHeld: boolean, rightHeld: boolean) => {
      const now = performance.now();
      const prevLeft = controlsRef.current.steerLeftHeld;
      const prevRight = controlsRef.current.steerRightHeld;

      if (prevLeft && !leftHeld && steerGestureRef.current.leftStartMs !== null) {
        const elapsedMs = now - steerGestureRef.current.leftStartMs;
        steerGestureRef.current.leftStartMs = null;
        if (elapsedMs < SHORT_TAP_MAX_DURATION_MS && !rightHeld) {
          controlsRef.current.steerTapImpulse = -SHORT_TAP_IMPULSE_STRENGTH;
          controlsRef.current.steerTapRemainingSec = SHORT_TAP_IMPULSE_DURATION_SEC;
        }
      }

      if (prevRight && !rightHeld && steerGestureRef.current.rightStartMs !== null) {
        const elapsedMs = now - steerGestureRef.current.rightStartMs;
        steerGestureRef.current.rightStartMs = null;
        if (elapsedMs < SHORT_TAP_MAX_DURATION_MS && !leftHeld) {
          controlsRef.current.steerTapImpulse = SHORT_TAP_IMPULSE_STRENGTH;
          controlsRef.current.steerTapRemainingSec = SHORT_TAP_IMPULSE_DURATION_SEC;
        }
      }

      if (!prevLeft && leftHeld) {
        steerGestureRef.current.leftStartMs = now;
        controlsRef.current.steerTapRemainingSec = 0;
      }

      if (!prevRight && rightHeld) {
        steerGestureRef.current.rightStartMs = now;
        controlsRef.current.steerTapRemainingSec = 0;
      }

      controlsRef.current.steerLeftHeld = leftHeld;
      controlsRef.current.steerRightHeld = rightHeld;

      if (!leftHeld && !rightHeld) {
        clearLongPressTimer();
        controlsRef.current.steerLongPressActive = false;
        setActiveSteerUi({ left: false, right: false, isLongPress: false });
      } else if ((!prevLeft && leftHeld) || (!prevRight && rightHeld)) {
        clearLongPressTimer();
        controlsRef.current.steerLongPressActive = false;
        setActiveSteerUi({ left: leftHeld, right: rightHeld, isLongPress: false });
        steerGestureRef.current.longPressTimerId = window.setTimeout(() => {
          if (controlsRef.current.steerLeftHeld || controlsRef.current.steerRightHeld) {
            controlsRef.current.steerLongPressActive = true;
            setActiveSteerUi({
              left: controlsRef.current.steerLeftHeld,
              right: controlsRef.current.steerRightHeld,
              isLongPress: true,
            });
          }
        }, SHORT_TAP_MAX_DURATION_MS);
      } else {
        setActiveSteerUi((prev) => ({
          left: leftHeld,
          right: rightHeld,
          isLongPress: prev.isLongPress,
        }));
      }
    },
    [clearLongPressTimer, controlsRef]
  );

  useEffect(() => {
    if (gameState !== 'playing') {
      clearLongPressTimer();
      steerGestureRef.current.leftStartMs = null;
      steerGestureRef.current.rightStartMs = null;
      steerGestureRef.current.activePointerId = null;
      controlsRef.current.steerLeftHeld = false;
      controlsRef.current.steerRightHeld = false;
      controlsRef.current.steerLongPressActive = false;
      setActiveSteerUi({ left: false, right: false, isLongPress: false });
    }
  }, [gameState, clearLongPressTimer, controlsRef]);

  const resolveSteerDirFromPoint = (clientX: number, clientY: number): 'left' | 'right' | null => {
    if (typeof document === 'undefined') return null;
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const btn = el.closest('[data-steer-dir]') as HTMLElement | null;
    const dir = btn?.getAttribute('data-steer-dir');
    return dir === 'left' || dir === 'right' ? dir : null;
  };

  const evaluateContainerTouches = (touches: React.TouchList) => {
    let wantLeft = false;
    let wantRight = false;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      const dir = resolveSteerDirFromPoint(t.clientX, t.clientY);
      if (dir === 'left') wantLeft = true;
      if (dir === 'right') wantRight = true;
    }
    applySteeringHoldState(wantLeft, wantRight);
  };

  const isLevels = (liveSnapshot.playMode ?? playMode) === 'levels';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none overflow-hidden">
      {/* 1. TOP PERIMETER HUD CLUSTERS */}
      <div className="w-full flex items-start justify-between gap-2">
        {/* Top-Left Cluster: Speedometer, Distance/Remaining & Shield Charges */}
        <div className="bg-[#0b0f19]/88 border border-slate-800/90 rounded-xl px-2.5 py-1.5 shadow-xl flex items-center gap-2.5 pointer-events-auto shrink-0">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              SPEED KM/H
            </div>
            <div className="flex items-baseline gap-1">
              <span
                ref={hudRefs.speedValueRef}
                data-testid="hud-speed"
                className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-cyan-400 leading-none"
              >
                0
              </span>
            </div>
          </div>

          <div className="border-l border-slate-800 pl-2.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {isLevels ? 'TO FINISH' : 'DISTANCE'}
            </div>
            <span
              ref={hudRefs.distanceValueRef}
              data-testid="hud-distance"
              className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-100 leading-none"
            >
              0m
            </span>
          </div>

          {isLevels && (
            <div className="border-l border-slate-800 pl-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                POS
              </div>
              <span
                ref={hudRefs.racePositionValueRef}
                data-testid="hud-position"
                className="text-base sm:text-lg font-black font-mono tabular-nums text-amber-400 leading-none"
              >
                {liveSnapshot.playerPosition ?? 6}/6
              </span>
            </div>
          )}

          {/* Discrete Hull Shield Sockets */}
          <div className="border-l border-slate-800 pl-2.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              SHIELD ({liveSnapshot.integrity}/{liveSnapshot.maxIntegrity})
            </div>
            <div
              className="flex items-center gap-0.5"
              aria-label={`Hull Shield ${liveSnapshot.integrity} of ${liveSnapshot.maxIntegrity}`}
            >
              {Array.from({ length: liveSnapshot.maxIntegrity }, (_, i) => {
                const active = i < liveSnapshot.integrity;
                return (
                  <svg
                    key={i}
                    viewBox="0 0 24 24"
                    className={`w-3.5 h-3.5 transition-colors ${
                      active ? 'text-cyan-400' : 'text-slate-700'
                    }`}
                    fill={active ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z" />
                  </svg>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top-Center Transient Countdown, Course Progress & Drift / Near-Miss Callout */}
        <div className="flex flex-col items-center gap-1 pointer-events-none min-w-0 flex-1 max-w-[230px]">
          {isLevels && (
            <div className="bg-[#0b0f19]/88 border border-slate-800 px-2.5 py-1 rounded-xl flex flex-col items-center gap-1 w-full">
              <div className="flex items-center justify-between w-full text-[9px] font-bold gap-1">
                <span className="text-amber-400 uppercase truncate">
                  {liveSnapshot.levelTitle ?? `Level ${liveSnapshot.levelNumber ?? 1}`}
                </span>
                <span className="text-slate-300 truncate shrink-0">
                  {liveSnapshot.segmentLabel ?? 'City Circuit'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  ref={hudRefs.levelProgressFillRef}
                  className="w-full h-full bg-amber-400 origin-left transition-transform duration-75"
                  style={{ transform: 'scaleX(0)' }}
                />
              </div>
            </div>
          )}

          {!isLevels &&
            liveSnapshot.segmentLabel &&
            liveSnapshot.segmentLabel !== 'City Expressway' &&
            liveSnapshot.segmentLabel !== 'Starting Grid' && (
              <div className="bg-[#0b0f19]/88 border border-slate-800 px-3 py-0.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                {liveSnapshot.segmentLabel}
              </div>
            )}

          {liveSnapshot.countdownValue !== null && (
            <div className="bg-[#0b0f19]/92 border border-cyan-500/50 px-5 py-1.5 rounded-2xl shadow-2xl">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-400 tracking-wider">
                {liveSnapshot.countdownValue === 0
                  ? 'GO!'
                  : liveSnapshot.countdownValue}
              </span>
            </div>
          )}

          {liveSnapshot.isDrifting && !liveSnapshot.isAirborne && (
            <div className="px-3 py-0.5 rounded-xl border bg-amber-950/90 border-amber-400 text-amber-200 text-[11px] font-extrabold uppercase tracking-wider shadow-lg">
              DRIFT · +{liveSnapshot.driftScore ?? 0} PTS
            </div>
          )}

          {liveSnapshot.comboBanner && (
            <div
              key={liveSnapshot.comboBanner.id}
              className={`px-3 py-1 rounded-xl border shadow-xl text-center ${
                liveSnapshot.comboBanner.tone === 'danger'
                  ? 'bg-red-950/90 border-red-500/60 text-red-200'
                  : liveSnapshot.comboBanner.tone === 'amber'
                    ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                    : 'bg-cyan-950/90 border-cyan-500/60 text-cyan-200'
              }`}
            >
              <div className="text-xs font-extrabold uppercase tracking-wider">
                {liveSnapshot.comboBanner.text}
              </div>
              <div className="text-[10px] opacity-85">
                {liveSnapshot.comboBanner.subtext}
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Cluster: Score, Coins & Utility Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
          <div className="bg-[#0b0f19]/88 border border-slate-800/90 rounded-xl px-2.5 py-1.5 shadow-xl flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                SCORE
              </div>
              <span
                ref={hudRefs.scoreValueRef}
                data-testid="hud-score"
                className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-100 leading-none"
              >
                0
              </span>
            </div>

            <div className="border-l border-slate-800 pl-2.5 text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                COINS
              </div>
              <span
                ref={hudRefs.coinsValueRef}
                data-testid="hud-coins"
                className="text-base sm:text-lg font-bold font-mono tabular-nums text-amber-400 leading-none"
              >
                0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onToggleMusicEnabled && (
              <button
                type="button"
                data-testid="hud-music-toggle-btn"
                aria-label={musicEnabled ? 'Turn Music Off' : 'Turn Music On'}
                title={musicEnabled ? 'Music On (Click to turn off)' : 'Music Off (Click to turn on)'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMusicEnabled();
                }}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center cursor-pointer ${
                  musicEnabled && !isMuted
                    ? 'bg-[#0b0f19]/90 hover:bg-slate-800 border-cyan-500/40 text-cyan-300'
                    : 'bg-[#0b0f19]/90 hover:bg-slate-800 border-slate-700 text-slate-500'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </button>
            )}

            <button
              type="button"
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0b0f19]/90 hover:bg-slate-800 border flex items-center justify-center cursor-pointer ${
                isMuted ? 'border-amber-500/50 text-amber-400' : 'border-slate-700 text-slate-200'
              }`}
            >
              {isMuted ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
                  <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" />
                </svg>
              )}
            </button>

            <button
              type="button"
              aria-label="Pause Race"
              data-testid="pause-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onPauseToggle();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0b0f19]/90 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM PERIMETER CONTROLS */}
      {gameState === 'playing' && (
        <div className="flex flex-col gap-1.5 mt-auto">
          {steeringMode === 'drag' && (
            <div className="self-center bg-[#0b0f19]/90 border border-slate-800 px-3 py-1 rounded-xl flex items-center gap-2.5 pointer-events-auto">
              <span className="text-xs font-semibold text-slate-300">
                Drag Steer
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
                className="w-40 sm:w-56 accent-cyan-400 cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-end justify-between gap-2">
            {/* Left Touch Steering Buttons (.steering-container) */}
            <div
              className="steering-container flex items-center gap-1.5 pointer-events-auto select-none touch-none"
              onContextMenu={(e) => e.preventDefault()}
              onTouchStart={(e) => {
                e.preventDefault();
                evaluateContainerTouches(e.touches);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                evaluateContainerTouches(e.touches);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                evaluateContainerTouches(e.touches);
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                applySteeringHoldState(false, false);
              }}
              onPointerMove={(e) => {
                if (e.pointerType === 'touch') return;
                if (steerGestureRef.current.activePointerId !== e.pointerId) return;
                const dir = resolveSteerDirFromPoint(e.clientX, e.clientY);
                if (dir === 'left') {
                  applySteeringHoldState(true, false);
                } else if (dir === 'right') {
                  applySteeringHoldState(false, true);
                }
              }}
              onPointerUp={(e) => {
                if (e.pointerType === 'touch') return;
                if (steerGestureRef.current.activePointerId === e.pointerId) {
                  steerGestureRef.current.activePointerId = null;
                }
                applySteeringHoldState(false, false);
              }}
              onPointerCancel={(e) => {
                if (e.pointerType === 'touch') return;
                steerGestureRef.current.activePointerId = null;
                applySteeringHoldState(false, false);
              }}
            >
              <button
                type="button"
                data-steer-dir="left"
                aria-label="Steer Left"
                aria-pressed={activeSteerUi.left}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  if (e.pointerType === 'touch') return;
                  e.preventDefault();
                  steerGestureRef.current.activePointerId = e.pointerId;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                  applySteeringHoldState(true, false);
                }}
                onPointerUp={(e) => {
                  if (e.pointerType === 'touch') return;
                  steerGestureRef.current.activePointerId = null;
                  applySteeringHoldState(false, false);
                }}
                onPointerCancel={(e) => {
                  if (e.pointerType === 'touch') return;
                  steerGestureRef.current.activePointerId = null;
                  applySteeringHoldState(false, false);
                }}
                className={`w-16 h-12 sm:w-20 sm:h-14 rounded-xl border font-bold flex items-center justify-center shadow-lg cursor-pointer select-none touch-none transition-all ${
                  activeSteerUi.left
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/30 scale-95'
                    : 'bg-[#0b0f19]/90 text-slate-100 border-slate-700 hover:border-slate-600'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-7 h-7 sm:w-8 sm:h-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                  <path d="M9 12h10" />
                </svg>
                <span className="sr-only">Steer Left</span>
              </button>
              <button
                type="button"
                data-steer-dir="right"
                aria-label="Steer Right"
                aria-pressed={activeSteerUi.right}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  if (e.pointerType === 'touch') return;
                  e.preventDefault();
                  steerGestureRef.current.activePointerId = e.pointerId;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                  applySteeringHoldState(false, true);
                }}
                onPointerUp={(e) => {
                  if (e.pointerType === 'touch') return;
                  steerGestureRef.current.activePointerId = null;
                  applySteeringHoldState(false, false);
                }}
                onPointerCancel={(e) => {
                  if (e.pointerType === 'touch') return;
                  steerGestureRef.current.activePointerId = null;
                  applySteeringHoldState(false, false);
                }}
                className={`w-16 h-12 sm:w-20 sm:h-14 rounded-xl border font-bold flex items-center justify-center shadow-lg cursor-pointer select-none touch-none transition-all ${
                  activeSteerUi.right
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/30 scale-95'
                    : 'bg-[#0b0f19]/90 text-slate-100 border-slate-700 hover:border-slate-600'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-7 h-7 sm:w-8 sm:h-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                  <path d="M15 12H5" />
                </svg>
                <span className="sr-only">Steer Right</span>
              </button>
            </div>

            {/* Unified Bottom-Center Low-Profile Nitro Core + Tilt Status Dock */}
            <div className="flex-1 max-w-md mx-auto bg-[#0b0f19]/90 border border-slate-800 rounded-xl px-3 py-1.5 pointer-events-auto flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="text-cyan-400 uppercase tracking-wider">NITRO CORE</span>
                  <span
                    ref={hudRefs.nitroPctRef}
                    className="font-mono tabular-nums text-slate-200"
                  >
                    100%
                  </span>
                </div>

                {steeringMode === 'tilt' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">Tilt:</span>
                    <span
                      ref={hudRefs.tiltAngleBadgeRef}
                      className="font-mono tabular-nums text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded text-[10px]"
                    >
                      0°
                    </span>
                    <button
                      type="button"
                      onClick={onCalibrateTilt}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer whitespace-nowrap"
                    >
                      Calibrate 0°
                    </button>
                    <button
                      type="button"
                      onClick={onRequestMotionPermission}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 rounded cursor-pointer whitespace-nowrap"
                    >
                      Sensor
                    </button>
                  </div>
                )}
              </div>

              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  ref={hudRefs.nitroFillRef}
                  className="w-full h-full bg-cyan-400 origin-left transition-transform duration-75"
                  style={{ transform: 'scaleX(1)' }}
                />
              </div>
            </div>

            {/* Right Touch Brake & Nitro Action Buttons */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                aria-label="Brake"
                onPointerDown={(e) => {
                  e.preventDefault();
                  controlsRef.current.brakeHeld = true;
                }}
                onPointerUp={() => {
                  controlsRef.current.brakeHeld = false;
                }}
                onPointerCancel={() => {
                  controlsRef.current.brakeHeld = false;
                }}
                onPointerLeave={() => {
                  controlsRef.current.brakeHeld = false;
                }}
                className="w-16 h-12 sm:w-20 sm:h-14 rounded-xl bg-[#0b0f19]/90 active:bg-amber-500 active:text-slate-950 border border-slate-700 text-amber-400 font-bold text-xs sm:text-sm flex items-center justify-center shadow-lg cursor-pointer select-none touch-none"
              >
                BRAKE
              </button>
              <button
                type="button"
                aria-label="Activate Nitro Boost"
                onPointerDown={(e) => {
                  e.preventDefault();
                  controlsRef.current.nitroHeld = true;
                }}
                onPointerUp={() => {
                  controlsRef.current.nitroHeld = false;
                }}
                onPointerCancel={() => {
                  controlsRef.current.nitroHeld = false;
                }}
                onPointerLeave={() => {
                  controlsRef.current.nitroHeld = false;
                }}
                className="w-20 h-12 sm:w-24 sm:h-14 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center shadow-lg cursor-pointer select-none touch-none"
              >
                NITRO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PAUSE MODAL */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-label="Race Paused"
          data-testid="pause-modal"
          className="my-auto max-w-md w-full mx-auto bg-[#0b0f19]/95 border border-slate-800 rounded-2xl p-5 shadow-2xl pointer-events-auto text-center"
        >
          <div className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">
            {isLevels ? `Levels Mode · Level ${liveSnapshot.levelNumber ?? 1}` : 'Solo Highway Mode'}
          </div>
          <h2 className="text-2xl font-extrabold uppercase tracking-tight text-slate-100 mb-4">
            Race Paused
          </h2>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-testid="pause-resume-btn"
              onClick={onPauseToggle}
              className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm uppercase tracking-wider cursor-pointer"
            >
              Resume Race
            </button>

            <button
              type="button"
              data-testid="pause-restart-btn"
              onClick={onRestartRace}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm cursor-pointer"
            >
              Restart Race
            </button>

            {/* Quick In-Pause Audio / Music Controls */}
            <div className="grid grid-cols-2 gap-2">
              {onToggleMusicEnabled && (
                <button
                  type="button"
                  data-testid="pause-music-toggle-btn"
                  onClick={onToggleMusicEnabled}
                  className={`py-2 px-3 rounded-xl border font-semibold text-xs cursor-pointer ${
                    musicEnabled && !isMuted
                      ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {musicEnabled ? '♪ Music: ON' : '♪ Music: OFF'}
                </button>
              )}
              <button
                type="button"
                data-testid="pause-mute-toggle-btn"
                onClick={onToggleMute}
                className={`py-2 px-3 rounded-xl border font-semibold text-xs cursor-pointer ${
                  !isMuted
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                }`}
              >
                {isMuted ? '🔇 Audio: Muted' : '🔊 Audio: Active'}
              </button>
            </div>

            {onCycleMusicTrack && (
              <button
                type="button"
                onClick={onCycleMusicTrack}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Soundtrack: {musicTrackTitle ?? 'Velocity Rush Anthem'} (Tap to Switch)
              </button>
            )}

            <button
              type="button"
              onClick={onOpenSettingsFromPause}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs sm:text-sm cursor-pointer"
            >
              Settings & Calibration
            </button>

            {onReturnToModes && (
              <button
                type="button"
                onClick={onReturnToModes}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Return to Mode Selection
              </button>
            )}

            <button
              type="button"
              data-testid="pause-quit-btn"
              onClick={onExitToMenu}
              className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 font-semibold text-xs cursor-pointer"
            >
              Quit to Main Menu
            </button>
          </div>
        </div>
      )}

      {/* 4. POST-RACE RESULTS MODAL (Supports Both Levels Mode 6-Car Standings & Solo Mode Summary) */}
      {gameState === 'gameover' && lastRunPayload && (
        <div
          role="dialog"
          aria-label="Race Results"
          className="my-auto max-w-2xl w-full mx-auto bg-[#0b0f19]/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto max-h-[88vh] overflow-y-auto"
        >
          {lastRunPayload.playMode === 'levels' && lastRunPayload.levelResult ? (
            /* LEVELS MODE RESULTS & 6-CAR STANDINGS */
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                    {lastRunPayload.levelResult.course.title}
                  </div>
                  <h2 className="text-lg sm:text-2xl font-extrabold uppercase tracking-tight text-slate-100">
                    {lastRunPayload.levelResult.playerPosition === 1
                      ? '🏆 1st Place Victory!'
                      : lastRunPayload.levelResult.playerPosition <= 3
                        ? `🥈 ${lastRunPayload.levelResult.playerPosition}${
                            lastRunPayload.levelResult.playerPosition === 2 ? 'nd' : 'rd'
                          } Place Podium Finish!`
                        : `Finished #${lastRunPayload.levelResult.playerPosition} of 6`}
                  </h2>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase ${
                      lastRunPayload.levelResult.rewards.qualifiedForNextLevel
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {lastRunPayload.levelResult.rewards.qualifiedForNextLevel
                      ? `Level ${lastRunPayload.levelResult.course.levelNumber + 1} Unlocked!`
                      : 'Finish Top 3 to Advance'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
                {/* 6-Car Standings Table */}
                <div className="sm:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Official 6-Car Finishing Order
                  </div>
                  <div className="space-y-1">
                    {lastRunPayload.levelResult.standings.map((entry) => {
                      const carName = CAR_CONFIGS[entry.carId]?.name ?? entry.carId;
                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs ${
                            entry.isPlayer
                              ? 'bg-cyan-500/20 border border-cyan-400/60 text-white font-bold'
                              : 'bg-slate-950/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 text-center font-mono font-extrabold ${
                                entry.position === 1
                                  ? 'text-amber-400'
                                  : entry.position <= 3
                                    ? 'text-cyan-400'
                                    : 'text-slate-500'
                              }`}
                            >
                              #{entry.position}
                            </span>
                            <span>{entry.name}</span>
                            <span className="text-[10px] text-slate-400">({carName})</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-300">
                            {entry.finished && entry.finishTimeSec
                              ? `${entry.finishTimeSec.toFixed(1)}s`
                              : `${Math.round(entry.progress01 * 100)}%`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rewards Breakdown */}
                <div className="sm:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Race Rewards Breakdown
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Position #{lastRunPayload.levelResult.playerPosition} Prize</span>
                        <span className="font-mono text-amber-400">
                          +{lastRunPayload.levelResult.rewards.positionPrizeCoins}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Track Coin Pickups</span>
                        <span className="font-mono text-amber-400">
                          +{lastRunPayload.levelResult.rewards.pickupCoins}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Clean Driving Bonus</span>
                        <span className="font-mono text-emerald-400">
                          +{lastRunPayload.levelResult.rewards.cleanRaceBonusCoins}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Drift Skill Bonus</span>
                        <span className="font-mono text-cyan-400">
                          +{lastRunPayload.levelResult.rewards.driftBonusCoins}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-slate-100">
                      Total Earned
                    </span>
                    <span
                      data-testid="results-coins-earned"
                      className="text-base font-black font-mono text-amber-400"
                    >
                      +{lastRunPayload.levelResult.rewards.totalCoinsEarned} Coins
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Next Level, Retry, Garage, Modes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {lastRunPayload.levelResult.rewards.qualifiedForNextLevel && onNextLevel && (
                  <button
                    type="button"
                    data-testid="next-level-btn"
                    onClick={onNextLevel}
                    className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Next Level (Lv.{lastRunPayload.levelResult.course.levelNumber + 1})
                  </button>
                )}
                <button
                  type="button"
                  data-testid="retry-race-btn"
                  onClick={onRestartRace}
                  className="py-2.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Retry Level {lastRunPayload.levelResult.course.levelNumber}
                </button>
                <button
                  type="button"
                  onClick={onOpenGarageFromResults}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Garage
                </button>
                <button
                  type="button"
                  onClick={onReturnToModes ?? onExitToMenu}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Return to Modes
                </button>
              </div>
            </div>
          ) : (
            /* SOLO MODE RESULTS */
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-red-400">
                    Hull Integrity Depleted
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-slate-100">
                    Solo Run Complete
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    BEST SCORE
                  </div>
                  <div className="text-base font-bold font-mono tabular-nums text-cyan-400">
                    {bestScore}
                  </div>
                </div>
              </div>

              {interstitialNotice && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300">
                  {interstitialNotice}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase text-slate-400">FINAL SCORE</div>
                  <div
                    data-testid="results-total-score"
                    className="text-lg font-extrabold font-mono tabular-nums text-slate-100 mt-0.5"
                  >
                    {lastRunPayload.summary.totalScore}
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase text-slate-400">DISTANCE</div>
                  <div className="text-lg font-extrabold font-mono tabular-nums text-cyan-400 mt-0.5">
                    {lastRunPayload.summary.distanceMeters}m
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase text-slate-400">NEAR MISSES</div>
                  <div className="text-lg font-extrabold font-mono tabular-nums text-slate-100 mt-0.5">
                    {lastRunPayload.nearMissCount}
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase text-amber-400">COINS EARNED</div>
                  <div
                    data-testid="results-coins-earned"
                    className="text-lg font-extrabold font-mono tabular-nums text-amber-400 mt-0.5"
                  >
                    +{lastRunPayload.summary.totalCoinsEarned}
                    {rewardedBonusClaimed ? ' (2x!)' : ''}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Pickups: {lastRunPayload.coinsCollected} · Wallet: {totalCoinsBalance}
                  </div>
                </div>
              </div>

              {adModalMode === 'none' && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {!rewardedBonusClaimed && lastRunPayload.summary.totalCoinsEarned > 0 && (
                    <button
                      type="button"
                      disabled={adsOffline}
                      onClick={() => setAdModalMode('bonus_coins')}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${
                        adsOffline
                          ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-amber-400/15 hover:bg-amber-400/25 border-amber-400/50 text-amber-300'
                      }`}
                    >
                      {adsOffline
                        ? 'Rewarded Ad Unavailable'
                        : `Watch Ad · Double Coins (+${Math.max(10, lastRunPayload.summary.totalCoinsEarned)})`}
                    </button>
                  )}

                  {lastRunPayload.reviveAvailable && (
                    <button
                      type="button"
                      disabled={adsOffline}
                      onClick={() => setAdModalMode('revive')}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider border cursor-pointer ${
                        adsOffline
                          ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-cyan-400/15 hover:bg-cyan-400/25 border-cyan-400/50 text-cyan-300'
                      }`}
                    >
                      Watch Ad · Revive Shield (1x)
                    </button>
                  )}
                </div>
              )}

              {adModalMode !== 'none' && (
                <div className="mb-3 p-3 rounded-xl bg-slate-950 border border-cyan-500/50">
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-1">
                    Google AdMob Test Rewarded Video
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (adModalMode === 'bonus_coins') {
                          onWatchRewardedAdForBonus(true);
                        } else {
                          onWatchRewardedAdForRevive();
                        }
                        setAdModalMode('none');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Complete Ad & Grant Reward
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdModalMode('none')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs cursor-pointer"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="retry-race-btn"
                  onClick={onRestartRace}
                  className="py-2.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
                >
                  Retry Solo
                </button>
                <button
                  type="button"
                  onClick={onOpenGarageFromResults}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
                >
                  Garage
                </button>
                <button
                  type="button"
                  onClick={onReturnToModes ?? onExitToMenu}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
                >
                  Return to Modes
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
