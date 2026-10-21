import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CarId,
  GamePlayMode,
  HIGHWAY_CONFIG,
  ProtectionUpgradeKey,
  UpgradeStatKey,
} from './game/config';
import {
  canShowInterstitialAd,
  resolveRewardedAdBonus,
} from './game/rules';
import {
  createDefaultSaveData,
  CustomizationSlotType,
  ensureCurrentDailyChallenges,
  LiveGameplayProgressDelta,
  loadSaveFromStorage,
  recordCompletedLevelRace,
  recordCompletedRun,
  recordLiveGameplayProgress,
  SaveGameData,
  tryClaimChallengeReward,
  tryClaimDailyChallengeReward,
  tryClaimDailyCompletionBonus,
  tryPurchaseOrEquipCustomization,
  tryPurchaseProtectionUpgrade,
  tryPurchaseUpgrade,
  trySelectLevel,
  tryUnlockCar,
  writeSaveToStorage,
} from './game/saveSystem';
import { MusicTrackId, MusicTrackMeta, soundController } from './game/audio';
import {
  CompletedRunPayload,
  GameLifecycleState,
  HighwayCanvas,
  LiveRaceSnapshot,
  TouchInputControlsRef,
} from './components/HighwayCanvas';
import { SubModalType, TitleAndMenus } from './components/TitleAndMenus';
import { RaceHudAndModals } from './components/RaceHudAndModals';

function checkIsPortraitMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth && window.innerWidth < 900;
}

export default function App() {
  const [saveData, setSaveData] = useState<SaveGameData>(() => {
    const initial = loadSaveFromStorage();
    if (typeof window !== 'undefined') {
      const lvlParam = Number(new URLSearchParams(window.location.search).get('level'));
      if (Number.isFinite(lvlParam) && lvlParam >= 1) {
        return {
          ...initial,
          levelsProgression: {
            ...initial.levelsProgression,
            highestUnlockedLevel: Math.max(
              initial.levelsProgression.highestUnlockedLevel,
              Math.floor(lvlParam)
            ),
            selectedLevel: Math.floor(lvlParam),
          },
        };
      }
    }
    return initial;
  });

  const [playMode, setPlayMode] = useState<GamePlayMode>(() => {
    if (typeof window !== 'undefined') {
      const m = new URLSearchParams(window.location.search).get('mode');
      if (m === 'levels' || m === 'solo') return m;
    }
    return 'solo';
  });

  // Support ?autostart=1 to boot directly into 'playing'
  const [gameState, setGameState] = useState<GameLifecycleState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [activeModal, setActiveModal] = useState<SubModalType>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('screen');
      if (
        s === 'modes' ||
        s === 'garage' ||
        s === 'challenges' ||
        s === 'settings' ||
        s === 'unity_docs'
      ) {
        return s;
      }
    }
    return 'none';
  });

  const [garageInspectCarId, setGarageInspectCarId] = useState<CarId>(
    () => saveData.selectedCarId
  );
  const [isPortrait, setIsPortrait] = useState<boolean>(() => checkIsPortraitMobile());
  const [portraitOverrideDismissed, setPortraitOverrideDismissed] = useState<boolean>(false);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [simulatedTiltDeg, setSimulatedTiltDeg] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [musicTrack, setMusicTrack] = useState<MusicTrackMeta>(() =>
    soundController.getTrackMeta()
  );

  const [liveSnapshot, setLiveSnapshot] = useState<LiveRaceSnapshot>({
    integrity: HIGHWAY_CONFIG.maxHullIntegrity,
    maxIntegrity: HIGHWAY_CONFIG.maxHullIntegrity,
    countdownValue: null,
    nearMissCount: 0,
    comboBanner: null,
    reviveUsed: false,
    playMode: 'solo',
    levelNumber: 1,
    playerPosition: 6,
    totalRacers: 6,
  });

  const [lastRunPayload, setLastRunPayload] = useState<CompletedRunPayload | null>(null);
  const [rewardedBonusClaimed, setRewardedBonusClaimed] = useState<boolean>(false);
  const [interstitialNotice, setInterstitialNotice] = useState<string | null>(null);

  // AdMob interstitial frequency state
  const adMetricsRef = useRef({
    racesSinceLastInterstitial: 0,
    lastInterstitialTimestampMs: 0,
  });

  // High-frequency DOM refs for 60Hz HUD updates
  const speedValueRef = useRef<HTMLSpanElement | null>(null);
  const distanceValueRef = useRef<HTMLSpanElement | null>(null);
  const scoreValueRef = useRef<HTMLSpanElement | null>(null);
  const coinsValueRef = useRef<HTMLSpanElement | null>(null);
  const nitroFillRef = useRef<HTMLDivElement | null>(null);
  const nitroPctRef = useRef<HTMLSpanElement | null>(null);
  const tiltAngleBadgeRef = useRef<HTMLSpanElement | null>(null);
  const steerIndicatorBarRef = useRef<HTMLDivElement | null>(null);
  const racePositionValueRef = useRef<HTMLSpanElement | null>(null);
  const remainingDistValueRef = useRef<HTMLSpanElement | null>(null);
  const levelProgressFillRef = useRef<HTMLDivElement | null>(null);

  const hudRefs = useRef({
    speedValueRef,
    distanceValueRef,
    scoreValueRef,
    coinsValueRef,
    nitroFillRef,
    nitroPctRef,
    tiltAngleBadgeRef,
    steerIndicatorBarRef,
    racePositionValueRef,
    remainingDistValueRef,
    levelProgressFillRef,
  }).current;

  const controlsRef = useRef<TouchInputControlsRef>({
    steerLeftHeld: false,
    steerRightHeld: false,
    nitroHeld: false,
    brakeHeld: false,
    dragSteerNormalized: 0,
    simulatedTiltDeg: 0,
    lastRawDeviceTiltDeg: 0,
    hasRealDeviceOrientation: false,
    motionPermissionState: 'unknown',
  });

  const showToastNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
  }, []);

  useEffect(() => {
    if (!statusNotice) return;
    const t = window.setTimeout(() => setStatusNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [statusNotice]);

  // Monitor viewport resize & orientation changes to enforce Landscape play
  useEffect(() => {
    const onOrientationOrResize = () => {
      const portraitNow = checkIsPortraitMobile();
      setIsPortrait(portraitNow);
      if (!portraitNow) {
        setPortraitOverrideDismissed(false);
      }
    };
    window.addEventListener('resize', onOrientationOrResize);
    window.addEventListener('orientationchange', onOrientationOrResize);
    return () => {
      window.removeEventListener('resize', onOrientationOrResize);
      window.removeEventListener('orientationchange', onOrientationOrResize);
    };
  }, []);

  // Attempt Fullscreen & Landscape Orientation Lock safely
  const attemptLandscapeAndFullscreen = useCallback(async (showFeedback = false) => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      const scrOrient = window.screen?.orientation as unknown as {
        lock?: (mode: string) => Promise<void>;
      };
      if (scrOrient && typeof scrOrient.lock === 'function') {
        await scrOrient.lock('landscape').catch(() => {});
      }
      if (showFeedback) {
        showToastNotice('Landscape fullscreen requested.');
      }
    } catch {
      // Orientation lock not supported on this browser/device; handled gracefully
    }
  }, [showToastNotice]);

  // Request DeviceMotion / DeviceOrientation Permission on explicit user action
  const handleRequestMotionPermission = useCallback(async () => {
    soundController.playButtonClick();
    const granted = await controlsRef.current.requestMotionPermission?.();
    if (granted) {
      showToastNotice('Phone motion tilt sensors enabled!');
    }
  }, [showToastNotice]);

  // Synchronize document.body.dataset.state and audio pause state immediately on state change
  useEffect(() => {
    document.body.dataset.state = gameState;
    soundController.setGamePaused(gameState === 'paused');
  }, [gameState]);

  // Automatically pause active gameplay when the browser tab/app is backgrounded
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setGameState((prev) => {
          if (prev === 'playing') {
            document.body.dataset.state = 'paused';
            soundController.setGamePaused(true);
            return 'paused';
          }
          return prev;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Persist saveData to localStorage whenever it updates and sync audio settings
  useEffect(() => {
    writeSaveToStorage(saveData);
    soundController.setMusicEnabled(saveData.settings.musicEnabled ?? true);
    soundController.setVolumes(
      saveData.settings.musicVolume,
      saveData.settings.sfxVolume
    );
  }, [saveData]);

  const handleStartRace = useCallback(
    (mode?: GamePlayMode, levelNumber?: number) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      soundController.playButtonClick();
      soundController.startMusicLoop();
      void attemptLandscapeAndFullscreen(false);
      void controlsRef.current.requestMotionPermission?.();

      if (mode) {
        setPlayMode(mode);
      }
      if (typeof levelNumber === 'number' && levelNumber >= 1) {
        setSaveData((prev) => trySelectLevel(prev, levelNumber));
      }

      document.body.dataset.state = 'playing';
      setActiveModal('none');
      setRewardedBonusClaimed(false);
      setInterstitialNotice(null);
      setGameState('playing');
      window.setTimeout(() => {
        controlsRef.current.triggerRestart?.();
      }, 0);
    },
    [attemptLandscapeAndFullscreen]
  );

  const handleRestartRace = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    soundController.playButtonClick();
    setRewardedBonusClaimed(false);
    setInterstitialNotice(null);
    controlsRef.current.triggerRestart?.();
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const handleNextLevel = useCallback(() => {
    soundController.playButtonClick();
    const completedLevel =
      lastRunPayload?.levelResult?.course.levelNumber ??
      saveData.levelsProgression.selectedLevel;
    const nextLvl = completedLevel + 1;
    setSaveData((prev) => trySelectLevel(prev, nextLvl));
    setPlayMode('levels');
    setRewardedBonusClaimed(false);
    setInterstitialNotice(null);
    document.body.dataset.state = 'playing';
    setGameState('playing');
    window.setTimeout(() => {
      controlsRef.current.triggerRestart?.();
    }, 0);
  }, [lastRunPayload, saveData.levelsProgression.selectedLevel]);

  const handleReturnToModes = useCallback(() => {
    soundController.playButtonClick();
    soundController.stopEngine();
    document.body.dataset.state = 'title';
    setGameState('title');
    setActiveModal('modes');
  }, []);

  const handlePauseToggle = useCallback(() => {
    soundController.playButtonClick();
    setGameState((prev) => {
      const next = prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev;
      document.body.dataset.state = next;
      return next;
    });
  }, []);

  const handleExitToMenu = useCallback(() => {
    soundController.playButtonClick();
    soundController.stopEngine();
    document.body.dataset.state = 'title';
    setGameState('title');
  }, []);

  const handleCycleMusicTrack = useCallback(() => {
    soundController.playButtonClick();
    const nextMeta = soundController.cycleTrack();
    setMusicTrack(nextMeta);
    showToastNotice(`Now Playing: ${nextMeta.title} (${nextMeta.genre})`);
  }, [showToastNotice]);

  const handleSelectMusicTrack = useCallback(
    (trackId: MusicTrackId) => {
      soundController.playButtonClick();
      const nextMeta = soundController.setTrackId(trackId);
      setMusicTrack(nextMeta);
      showToastNotice(`Now Playing: ${nextMeta.title} (${nextMeta.genre})`);
    },
    [showToastNotice]
  );

  const handleToggleMute = useCallback(() => {
    const nextMuted = !soundController.getMuted();
    soundController.setMuted(nextMuted);
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundController.startMusicLoop();
    }
  }, []);

  const handleToggleMusicEnabled = useCallback(() => {
    soundController.playButtonClick();
    setSaveData((prev) => {
      const nextEnabled = !(prev.settings.musicEnabled ?? true);
      soundController.setMusicEnabled(nextEnabled);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          musicEnabled: nextEnabled,
        },
      };
    });
  }, []);

  // Automatically start the intense soundtrack on the user's very first pointer/touch/key gesture
  useEffect(() => {
    const unlockAudioOnFirstGesture = () => {
      soundController.startMusicLoop();
      window.removeEventListener('pointerdown', unlockAudioOnFirstGesture);
      window.removeEventListener('touchstart', unlockAudioOnFirstGesture);
      window.removeEventListener('keydown', unlockAudioOnFirstGesture);
    };
    window.addEventListener('pointerdown', unlockAudioOnFirstGesture, { passive: true });
    window.addEventListener('touchstart', unlockAudioOnFirstGesture, { passive: true });
    window.addEventListener('keydown', unlockAudioOnFirstGesture);
    return () => {
      window.removeEventListener('pointerdown', unlockAudioOnFirstGesture);
      window.removeEventListener('touchstart', unlockAudioOnFirstGesture);
      window.removeEventListener('keydown', unlockAudioOnFirstGesture);
    };
  }, []);

  // Global keyboard shortcuts: Enter/Space on Title starts race; M mutes; T switches track; R restarts in race
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (
        gameState === 'title' &&
        activeModal === 'none' &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        handleStartRace('solo');
      } else if (e.code === 'KeyM' && !e.repeat) {
        handleToggleMute();
      } else if (e.code === 'KeyT' && !e.repeat) {
        handleCycleMusicTrack();
      } else if (
        e.code === 'KeyR' &&
        !e.repeat &&
        (gameState === 'playing' || gameState === 'paused' || gameState === 'gameover')
      ) {
        handleRestartRace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    activeModal,
    handleStartRace,
    handleRestartRace,
    handleToggleMute,
    handleCycleMusicTrack,
  ]);

  const handleIncrementalProgress = useCallback((delta: LiveGameplayProgressDelta) => {
    setSaveData((prev) => recordLiveGameplayProgress(prev, delta));
  }, []);

  // Periodic UTC day check so Daily Challenges roll over seamlessly if midnight UTC passes while playing
  useEffect(() => {
    const id = window.setInterval(() => {
      setSaveData((prev) => ensureCurrentDailyChallenges(prev));
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const handleRunEnded = useCallback((payload: CompletedRunPayload) => {
    setLastRunPayload(payload);
    setRewardedBonusClaimed(false);
    document.body.dataset.state = 'gameover';
    setGameState('gameover');

    setSaveData((prev) => {
      let updatedData = prev;

      if (payload.playMode === 'levels' && payload.levelResult) {
        const lr = payload.levelResult;
        const res = recordCompletedLevelRace(prev, payload.runId, {
          levelNumber: lr.course.levelNumber,
          playerPosition: lr.playerPosition,
          finishTimeSec: lr.finishTimeSec,
          totalCoinsEarned: lr.rewards.totalCoinsEarned,
          rawCoinsPickedUp: Math.floor(
            lr.rewards.pickupCoins / HIGHWAY_CONFIG.coinPickupValue
          ),
          distanceMeters: lr.course.totalLengthMeters,
          score: lr.rewards.totalScore,
          nearMisses: payload.nearMissCount,
          highSpeedNearMisses: payload.highSpeedNearMissCount,
          driftEvents: payload.driftEventsCount,
          levelDriftZonesClean: payload.levelDriftZonesCleanCount,
          successfulJumps: payload.successfulJumpsCount,
          tunnelsCompleted: payload.tunnelsCompletedCount,
          shieldAbsorptions: payload.shieldAbsorptionsCount,
          nitroActivations: payload.nitroActivationsCount,
          collisionsCount: payload.collisionsCount,
          alreadyCommitted: payload.alreadyCommitted,
        });
        updatedData = res.data;
      } else {
        const res = recordCompletedRun(prev, payload.runId, {
          score: payload.summary.totalScore,
          distanceMeters: payload.summary.distanceMeters,
          coinsEarned: payload.summary.totalCoinsEarned,
          rawCoinsPickedUp: Math.floor(
            payload.summary.coinsFromPickups / HIGHWAY_CONFIG.coinPickupValue
          ),
          nearMisses: payload.nearMissCount,
          highSpeedNearMisses: payload.highSpeedNearMissCount,
          driftEvents: payload.driftEventsCount,
          successfulJumps: payload.successfulJumpsCount,
          tunnelsCompleted: payload.tunnelsCompletedCount,
          shieldAbsorptions: payload.shieldAbsorptionsCount,
          nitroActivations: payload.nitroActivationsCount,
          alreadyCommitted: payload.alreadyCommitted,
        });
        updatedData = res.data;
      }

      // Evaluate AdMob interstitial eligibility at post-race break
      adMetricsRef.current.racesSinceLastInterstitial += 1;
      const nowMs = Date.now();
      const eligibleForInterstitial = canShowInterstitialAd({
        isRacingOrSteering: false,
        completedRacesCount: updatedData.completedRacesCount,
        racesSinceLastInterstitial: adMetricsRef.current.racesSinceLastInterstitial,
        lastInterstitialTimestampMs: adMetricsRef.current.lastInterstitialTimestampMs,
        nowTimestampMs: nowMs,
        isAdLoaded: !updatedData.settings.simulatedAdsOffline,
        consentAllowsAds: updatedData.settings.adsConsentStatus !== 'unknown',
      });

      if (eligibleForInterstitial) {
        adMetricsRef.current.racesSinceLastInterstitial = 0;
        adMetricsRef.current.lastInterstitialTimestampMs = nowMs;
        setInterstitialNotice('AdMob Interstitial Displayed (3-Race Break)');
      } else {
        setInterstitialNotice(null);
      }

      return updatedData;
    });
  }, []);

  const handleWatchRewardedAdForBonus = useCallback(
    (sdkConfirmed: boolean) => {
      if (!lastRunPayload) return;
      const result = resolveRewardedAdBonus({
        baseCoinsEarned: lastRunPayload.summary.totalCoinsEarned,
        sdkConfirmedReward: sdkConfirmed,
        alreadyClaimedForRun: rewardedBonusClaimed,
      });

      if (result.granted) {
        setRewardedBonusClaimed(true);
        setSaveData((prev) => ({
          ...prev,
          coins: prev.coins + result.bonusCoins,
        }));
        showToastNotice(`Rewarded Ad Verified: +${result.bonusCoins} Bonus Coins!`);
      } else {
        showToastNotice('Ad closed early — reward not granted.');
      }
    },
    [lastRunPayload, rewardedBonusClaimed, showToastNotice]
  );

  const handleWatchRewardedAdForRevive = useCallback(() => {
    controlsRef.current.triggerRevive?.();
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  const handleSelectCar = useCallback((carId: CarId) => {
    soundController.playButtonClick();
    setGarageInspectCarId(carId);
    setSaveData((prev) => {
      if (!prev.unlockedCarIds.includes(carId)) return prev;
      return { ...prev, selectedCarId: carId };
    });
  }, []);

  const handleUnlockCar = useCallback((carId: CarId) => {
    soundController.playButtonClick();
    setGarageInspectCarId(carId);
    let outcome: { success: boolean; reason?: string } = { success: false };
    setSaveData((prev) => {
      const res = tryUnlockCar(prev, carId);
      outcome = { success: res.success, reason: res.reason };
      return res.data;
    });
    return outcome;
  }, []);

  const handleUpgradeCarStat = useCallback((carId: CarId, statKey: UpgradeStatKey) => {
    soundController.playButtonClick();
    let outcome: { success: boolean; reason?: string } = { success: false };
    setSaveData((prev) => {
      const res = tryPurchaseUpgrade(prev, carId, statKey);
      outcome = { success: res.success, reason: res.reason };
      return res.data;
    });
    return outcome;
  }, []);

  const handleUpgradeProtection = useCallback(
    (carId: CarId, key: ProtectionUpgradeKey) => {
      soundController.playButtonClick();
      let outcome: { success: boolean; reason?: string } = { success: false };
      setSaveData((prev) => {
        const res = tryPurchaseProtectionUpgrade(prev, carId, key);
        outcome = { success: res.success, reason: res.reason };
        return res.data;
      });
      return outcome;
    },
    []
  );

  const handleCustomizeCar = useCallback(
    (carId: CarId, slot: CustomizationSlotType, itemId: string) => {
      soundController.playButtonClick();
      let outcome: {
        success: boolean;
        purchased: boolean;
        cost: number;
        reason?: string;
      } = {
        success: false,
        purchased: false,
        cost: 0,
      };
      setSaveData((prev) => {
        const res = tryPurchaseOrEquipCustomization(prev, carId, slot, itemId);
        outcome = {
          success: res.success,
          purchased: res.purchased,
          cost: res.cost,
          reason: res.reason,
        };
        return res.data;
      });
      return outcome;
    },
    []
  );

  const handleSelectLevel = useCallback((levelNumber: number) => {
    soundController.playButtonClick();
    setSaveData((prev) => trySelectLevel(prev, levelNumber));
  }, []);

  const handleClaimChallenge = useCallback((challengeId: string) => {
    soundController.playButtonClick();
    let outcome: { success: boolean; reason?: string; reward: number } = {
      success: false,
      reward: 0,
    };
    setSaveData((prev) => {
      const res = tryClaimChallengeReward(prev, challengeId);
      outcome = { success: res.success, reason: res.reason, reward: res.reward };
      return res.data;
    });
    return outcome;
  }, []);

  const handleClaimDailyChallenge = useCallback((dailyId: string) => {
    soundController.playButtonClick();
    let outcome: { success: boolean; reason?: string; reward: number } = {
      success: false,
      reward: 0,
    };
    setSaveData((prev) => {
      const res = tryClaimDailyChallengeReward(prev, dailyId);
      outcome = { success: res.success, reason: res.reason, reward: res.reward };
      return res.data;
    });
    return outcome;
  }, []);

  const handleClaimDailyBonus = useCallback(() => {
    soundController.playButtonClick();
    let outcome: { success: boolean; reason?: string; reward: number } = {
      success: false,
      reward: 0,
    };
    setSaveData((prev) => {
      const res = tryClaimDailyCompletionBonus(prev);
      outcome = { success: res.success, reason: res.reason, reward: res.reward };
      return res.data;
    });
    return outcome;
  }, []);

  const handleUpdateSettings = useCallback(
    (partial: Partial<SaveGameData['settings']>) => {
      soundController.playButtonClick();
      setSaveData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          ...partial,
        },
      }));
    },
    []
  );

  const handleCalibrateTilt = useCallback(() => {
    soundController.playButtonClick();
    const currentTilt = controlsRef.current.hasRealDeviceOrientation
      ? controlsRef.current.lastRawDeviceTiltDeg
      : controlsRef.current.simulatedTiltDeg;
    setSaveData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        neutralTiltOffsetDeg: currentTilt,
      },
    }));
    showToastNotice(`Neutral tilt calibrated to ${currentTilt.toFixed(1)}°`);
  }, [showToastNotice]);

  const handleChangeSimulatedTilt = useCallback((deg: number) => {
    setSimulatedTiltDeg(deg);
    controlsRef.current.simulatedTiltDeg = deg;
  }, []);

  const isGarageShowing = gameState === 'title' && activeModal === 'garage';
  const activeCanvasCarId = isGarageShowing ? garageInspectCarId : saveData.selectedCarId;
  const showPortraitOverlay = isPortrait && !portraitOverrideDismissed;

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#090d18]">
      {/* Isolated 3D Highway Canvas */}
      <HighwayCanvas
        gameState={gameState}
        playMode={playMode}
        levelNumber={saveData.levelsProgression.selectedLevel}
        isGarageOpen={isGarageShowing}
        selectedCarId={activeCanvasCarId}
        carUpgrades={saveData.carUpgrades}
        carProtection={saveData.carProtection}
        carCustomizations={saveData.carCustomizations}
        steeringMode={saveData.settings.steeringMode}
        sensitivity={saveData.settings.sensitivity}
        invertTilt={saveData.settings.invertTilt}
        neutralTiltOffsetDeg={saveData.settings.neutralTiltOffsetDeg}
        graphicsQuality={saveData.settings.graphicsQuality}
        hudRefs={hudRefs}
        controlsRef={controlsRef}
        onLiveStateChange={setLiveSnapshot}
        onRunEnded={handleRunEnded}
        onIncrementalProgress={handleIncrementalProgress}
        onRequestPauseToggle={handlePauseToggle}
        onSensorFallbackNotice={showToastNotice}
      />

      {/* Full-Screen Portrait Orientation Guard ("Rotate Your Phone to Play") */}
      {showPortraitOverlay && (
        <div
          role="dialog"
          aria-label="Rotate Your Phone to Play"
          data-testid="rotate-phone-overlay"
          className="fixed inset-0 z-50 bg-[#070b14] flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-cyan-500/40 flex items-center justify-center mb-5 shadow-2xl">
            <svg
              viewBox="0 0 64 64"
              className="w-14 h-14 text-cyan-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="10" y="22" width="44" height="24" rx="4" stroke="#06b6d4" fill="#0f172a" />
              <circle cx="48" cy="34" r="1.5" fill="#38bdf8" />
              <path d="M20 14a18 18 0 0 1 26 2" stroke="#f59e0b" />
              <polyline points="42 10 47 16 40 18" stroke="#f59e0b" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-100 tracking-wide uppercase">
            Rotate Your Phone to Play
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mt-2 leading-relaxed">
            Velocity Rush is designed for wide-screen Landscape highway racing and real phone tilt steering. Turn your device sideways to enter the cockpit.
          </p>

          <div className="flex flex-col gap-2.5 w-full max-w-xs mt-6">
            <button
              type="button"
              onClick={() => {
                void attemptLandscapeAndFullscreen(true);
              }}
              className="w-full py-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-lg"
            >
              Lock Landscape & Fullscreen
            </button>
            <button
              type="button"
              onClick={() => setPortraitOverrideDismissed(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 font-semibold text-xs cursor-pointer"
            >
              Continue in Current View
            </button>
          </div>
        </div>
      )}

      {/* Title Screen, Modes Hub, 6-Tab Garage Showroom, Challenges & Settings Overlays */}
      {!showPortraitOverlay && gameState === 'title' && (
        <TitleAndMenus
          saveData={saveData}
          activeModal={activeModal}
          setActiveModal={setActiveModal}
          inspectCarId={garageInspectCarId}
          setInspectCarId={setGarageInspectCarId}
          onStartRace={handleStartRace}
          onSelectCar={handleSelectCar}
          onUnlockCar={handleUnlockCar}
          onUpgradeCarStat={handleUpgradeCarStat}
          onUpgradeProtection={handleUpgradeProtection}
          onCustomizeCar={handleCustomizeCar}
          onSelectLevel={handleSelectLevel}
          onClaimChallenge={handleClaimChallenge}
          onClaimDailyChallenge={handleClaimDailyChallenge}
          onClaimDailyBonus={handleClaimDailyBonus}
          onUpdateSettings={handleUpdateSettings}
          onCalibrateTiltNeutral={handleCalibrateTilt}
          onRequestMotionPermission={handleRequestMotionPermission}
          onToggleFullscreen={() => void attemptLandscapeAndFullscreen(true)}
          onRotateTurntable={(delta) =>
            controlsRef.current.rotateGarageTurntable?.(delta)
          }
          onSetGarageRotateHoldDir={(dir) =>
            controlsRef.current.setGarageRotateHoldDir?.(dir)
          }
          onResetGarageTurntableView={() =>
            controlsRef.current.resetGarageTurntableView?.()
          }
          onToggleGarageAutoRotate={() =>
            controlsRef.current.toggleGarageAutoRotate?.() ?? true
          }
          musicTrack={musicTrack}
          isMuted={isMuted}
          onCycleMusicTrack={handleCycleMusicTrack}
          onSelectMusicTrack={handleSelectMusicTrack}
          onToggleMute={handleToggleMute}
          feedbackNotice={statusNotice}
          onTriggerFeedbackNotice={showToastNotice}
        />
      )}

      {/* Active Race HUD, Pause Modal & Solo/Levels Results Screen */}
      {!showPortraitOverlay && gameState !== 'title' && (
        <RaceHudAndModals
          gameState={gameState}
          playMode={playMode}
          hudRefs={hudRefs}
          controlsRef={controlsRef}
          liveSnapshot={liveSnapshot}
          steeringMode={saveData.settings.steeringMode}
          simulatedTiltDeg={simulatedTiltDeg}
          onChangeSimulatedTilt={handleChangeSimulatedTilt}
          onCalibrateTilt={handleCalibrateTilt}
          onRequestMotionPermission={handleRequestMotionPermission}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          musicEnabled={saveData.settings.musicEnabled ?? true}
          onToggleMusicEnabled={handleToggleMusicEnabled}
          musicTrackTitle={musicTrack.title}
          onCycleMusicTrack={handleCycleMusicTrack}
          onPauseToggle={handlePauseToggle}
          onRestartRace={handleRestartRace}
          onNextLevel={handleNextLevel}
          onReturnToModes={handleReturnToModes}
          onExitToMenu={handleExitToMenu}
          onOpenGarageFromResults={() => {
            document.body.dataset.state = 'title';
            setGameState('title');
            setGarageInspectCarId(saveData.selectedCarId);
            setActiveModal('garage');
          }}
          onOpenSettingsFromPause={() => {
            document.body.dataset.state = 'title';
            setGameState('title');
            setActiveModal('settings');
          }}
          lastRunPayload={lastRunPayload}
          bestScore={saveData.bestScore}
          totalCoinsBalance={saveData.coins}
          rewardedBonusClaimed={rewardedBonusClaimed}
          adsOffline={saveData.settings.simulatedAdsOffline}
          onWatchRewardedAdForBonus={handleWatchRewardedAdForBonus}
          onWatchRewardedAdForRevive={handleWatchRewardedAdForRevive}
          interstitialNotice={interstitialNotice}
        />
      )}
    </main>
  );
}
