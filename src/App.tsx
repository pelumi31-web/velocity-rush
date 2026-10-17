import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CarId,
  HIGHWAY_CONFIG,
  UpgradeStatKey,
} from './game/config';
import {
  canShowInterstitialAd,
  resolveRewardedAdBonus,
} from './game/rules';
import {
  createDefaultSaveData,
  loadSaveFromStorage,
  recordCompletedRun,
  SaveGameData,
  tryClaimChallengeReward,
  tryPurchaseUpgrade,
  tryUnlockCar,
  writeSaveToStorage,
} from './game/saveSystem';
import { soundController } from './game/audio';
import {
  CompletedRunPayload,
  GameLifecycleState,
  HighwayCanvas,
  LiveRaceSnapshot,
  TouchInputControlsRef,
} from './components/HighwayCanvas';
import { SubModalType, TitleAndMenus } from './components/TitleAndMenus';
import { RaceHudAndModals } from './components/RaceHudAndModals';

export default function App() {
  const [saveData, setSaveData] = useState<SaveGameData>(() => loadSaveFromStorage());

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
      if (s === 'garage' || s === 'challenges' || s === 'settings' || s === 'unity_docs') {
        return s;
      }
    }
    return 'none';
  });
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [simulatedTiltDeg, setSimulatedTiltDeg] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [liveSnapshot, setLiveSnapshot] = useState<LiveRaceSnapshot>({
    integrity: HIGHWAY_CONFIG.maxHullIntegrity,
    maxIntegrity: HIGHWAY_CONFIG.maxHullIntegrity,
    countdownValue: null,
    nearMissCount: 0,
    comboBanner: null,
    reviveUsed: false,
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

  const hudRefs = useRef({
    speedValueRef,
    distanceValueRef,
    scoreValueRef,
    coinsValueRef,
    nitroFillRef,
    nitroPctRef,
    tiltAngleBadgeRef,
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
  });

  const showToastNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
  }, []);

  useEffect(() => {
    if (!statusNotice) return;
    const t = window.setTimeout(() => setStatusNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [statusNotice]);

  // Synchronize document.body.dataset.state immediately on state change
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Persist saveData to localStorage whenever it updates
  useEffect(() => {
    writeSaveToStorage(saveData);
    soundController.setVolumes(
      saveData.settings.musicVolume,
      saveData.settings.sfxVolume
    );
  }, [saveData]);

  const handleStartRace = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    soundController.playButtonClick();
    soundController.startMusicLoop();
    document.body.dataset.state = 'playing';
    setActiveModal('none');
    setRewardedBonusClaimed(false);
    setInterstitialNotice(null);
    setGameState('playing');
  }, []);

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

  // Global keyboard shortcuts: Enter/Space on Title starts race; M mutes; R restarts in race
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
        handleStartRace();
      } else if (e.code === 'KeyM' && !e.repeat) {
        const nextMuted = !soundController.getMuted();
        soundController.setMuted(nextMuted);
        setIsMuted(nextMuted);
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
  }, [gameState, activeModal, handleStartRace, handleRestartRace]);

  const handleRunEnded = useCallback(
    (payload: CompletedRunPayload) => {
      setLastRunPayload(payload);
      setRewardedBonusClaimed(false);
      document.body.dataset.state = 'gameover';
      setGameState('gameover');

      setSaveData((prev) => {
        const res = recordCompletedRun(prev, payload.runId, {
          score: payload.summary.totalScore,
          distanceMeters: payload.summary.distanceMeters,
          coinsEarned: payload.summary.totalCoinsEarned,
          rawCoinsPickedUp: Math.floor(
            payload.summary.coinsFromPickups / HIGHWAY_CONFIG.coinPickupValue
          ),
          nearMisses: payload.nearMissCount,
        });

        // Evaluate AdMob interstitial eligibility at post-race break
        adMetricsRef.current.racesSinceLastInterstitial += 1;
        const nowMs = Date.now();
        const eligibleForInterstitial = canShowInterstitialAd({
          isRacingOrSteering: false,
          completedRacesCount: res.data.completedRacesCount,
          racesSinceLastInterstitial: adMetricsRef.current.racesSinceLastInterstitial,
          lastInterstitialTimestampMs: adMetricsRef.current.lastInterstitialTimestampMs,
          nowTimestampMs: nowMs,
          isAdLoaded: !res.data.settings.simulatedAdsOffline,
          consentAllowsAds: res.data.settings.adsConsentStatus !== 'unknown',
        });

        if (eligibleForInterstitial) {
          adMetricsRef.current.racesSinceLastInterstitial = 0;
          adMetricsRef.current.lastInterstitialTimestampMs = nowMs;
          setInterstitialNotice('AdMob Interstitial Displayed (3-Race Break)');
        } else {
          setInterstitialNotice(null);
        }

        return res.data;
      });
    },
    []
  );

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
    setSaveData((prev) => {
      if (!prev.unlockedCarIds.includes(carId)) return prev;
      return { ...prev, selectedCarId: carId };
    });
  }, []);

  const handleUnlockCar = useCallback((carId: CarId) => {
    soundController.playButtonClick();
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

  const handleResetSaveData = useCallback(() => {
    soundController.playButtonClick();
    const fresh = createDefaultSaveData();
    setSaveData(fresh);
    writeSaveToStorage(fresh);
    showToastNotice('Save data reset to factory defaults.');
  }, [showToastNotice]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#090d18]">
      {/* Isolated 3D Highway Canvas */}
      <HighwayCanvas
        gameState={gameState}
        isGarageOpen={gameState === 'title' && activeModal === 'garage'}
        selectedCarId={saveData.selectedCarId}
        carUpgrades={saveData.carUpgrades[saveData.selectedCarId]}
        steeringMode={saveData.settings.steeringMode}
        sensitivity={saveData.settings.sensitivity}
        invertTilt={saveData.settings.invertTilt}
        neutralTiltOffsetDeg={saveData.settings.neutralTiltOffsetDeg}
        graphicsQuality={saveData.settings.graphicsQuality}
        hudRefs={hudRefs}
        controlsRef={controlsRef}
        onLiveStateChange={setLiveSnapshot}
        onRunEnded={handleRunEnded}
        onRequestPauseToggle={handlePauseToggle}
        onSensorFallbackNotice={showToastNotice}
      />

      {/* Title Screen, Garage, Challenges & Settings Overlays */}
      {gameState === 'title' && (
        <TitleAndMenus
          saveData={saveData}
          activeModal={activeModal}
          setActiveModal={setActiveModal}
          onStartRace={handleStartRace}
          onSelectCar={handleSelectCar}
          onUnlockCar={handleUnlockCar}
          onUpgradeCarStat={handleUpgradeCarStat}
          onClaimChallenge={handleClaimChallenge}
          onUpdateSettings={handleUpdateSettings}
          onCalibrateTilt={handleCalibrateTilt}
          simulatedTiltDeg={simulatedTiltDeg}
          onChangeSimulatedTilt={handleChangeSimulatedTilt}
          onRotateTurntable={(delta) =>
            controlsRef.current.rotateGarageTurntable?.(delta)
          }
          onResetSaveData={handleResetSaveData}
          statusNotice={statusNotice}
          onTriggerFeedbackNotice={showToastNotice}
        />
      )}

      {/* Active Race HUD, Pause Modal & Results Screen */}
      {gameState !== 'title' && (
        <RaceHudAndModals
          gameState={gameState}
          hudRefs={hudRefs}
          controlsRef={controlsRef}
          liveSnapshot={liveSnapshot}
          steeringMode={saveData.settings.steeringMode}
          simulatedTiltDeg={simulatedTiltDeg}
          onChangeSimulatedTilt={handleChangeSimulatedTilt}
          onCalibrateTilt={handleCalibrateTilt}
          isMuted={isMuted}
          onToggleMute={() => {
            const next = !soundController.getMuted();
            soundController.setMuted(next);
            setIsMuted(next);
          }}
          onPauseToggle={handlePauseToggle}
          onRestartRace={handleRestartRace}
          onExitToMenu={handleExitToMenu}
          onOpenGarageFromResults={() => {
            document.body.dataset.state = 'title';
            setGameState('title');
            setActiveModal('garage');
          }}
          onOpenSettingsFromPause={() => {
            document.body.dataset.state = 'title';
            setGameState('title');
            setActiveModal('settings');
          }}
          lastRunPayload={lastRunPayload}
          bestScore={saveData.bestScore}
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
