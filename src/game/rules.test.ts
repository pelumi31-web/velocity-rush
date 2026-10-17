import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRunRewards,
  canShowInterstitialAd,
  evaluateVehicleInteraction,
  getEffectiveCarStats,
  getUpgradeCost,
  processTiltInput,
  resolveRewardedAdBonus,
  selectFairTrafficLanes,
} from './rules.ts';
import {
  createDefaultSaveData,
  recordCompletedRun,
  tryClaimChallengeReward,
  tryPurchaseUpgrade,
  tryUnlockCar,
  validateAndSanitizeSave,
} from './saveSystem.ts';

test('processTiltInput respects deadZone, calibration neutral offset, sensitivity, and inversion', () => {
  // Inside deadzone around neutral offset 5 deg
  const insideDeadZone = processTiltInput({
    rawAngleDeg: 6.2,
    neutralOffsetDeg: 5.0,
    deadZoneDeg: 2.5,
    sensitivity: 'medium',
    invertTilt: false,
    smoothingFactor: 1.0,
  });
  assert.equal(insideDeadZone, 0);

  // Tilted right (+15 deg relative to neutral 5 deg = +10 deg)
  const steerRight = processTiltInput({
    rawAngleDeg: 15,
    neutralOffsetDeg: 5,
    deadZoneDeg: 2.5,
    maxSteerAngleDeg: 22.5,
    sensitivity: 'medium',
    invertTilt: false,
    smoothingFactor: 1.0,
  });
  assert.ok(steerRight > 0.3 && steerRight < 0.45);

  // High sensitivity steers more strongly than low sensitivity for same tilt angle
  const steerLowSens = processTiltInput({
    rawAngleDeg: 15,
    neutralOffsetDeg: 5,
    sensitivity: 'low',
    invertTilt: false,
    smoothingFactor: 1.0,
  });
  const steerHighSens = processTiltInput({
    rawAngleDeg: 15,
    neutralOffsetDeg: 5,
    sensitivity: 'high',
    invertTilt: false,
    smoothingFactor: 1.0,
  });
  assert.ok(steerHighSens > steerLowSens);

  // Inverted tilt flips steering sign
  const steerInverted = processTiltInput({
    rawAngleDeg: 15,
    neutralOffsetDeg: 5,
    deadZoneDeg: 2.5,
    maxSteerAngleDeg: 22.5,
    sensitivity: 'medium',
    invertTilt: true,
    smoothingFactor: 1.0,
  });
  assert.equal(steerInverted, -steerRight);
});

test('selectFairTrafficLanes never blocks all 4 highway lanes', () => {
  for (let i = 0; i < 100; i++) {
    const lanes = selectFairTrafficLanes(4, (i % 10) / 10);
    assert.ok(lanes.length >= 1 && lanes.length <= 3, `Expected 1-3 lanes, got ${lanes.length}`);
  }
});

test('evaluateVehicleInteraction detects collision vs near-miss accurately', () => {
  const player = { x: -1.75, z: 0, halfWidth: 0.95, halfLength: 2.1 };
  const trafficCollision = { x: -1.6, z: 1.0, halfWidth: 0.95, halfLength: 2.1 };
  const resCollision = evaluateVehicleInteraction(player, trafficCollision, false);
  assert.equal(resCollision.collided, true);
  assert.equal(resCollision.nearMiss, false);

  const trafficNearMiss = { x: 0.65, z: 0.5, halfWidth: 0.95, halfLength: 2.1 };
  const resNearMiss = evaluateVehicleInteraction(player, trafficNearMiss, false);
  assert.equal(resNearMiss.collided, false);
  assert.equal(resNearMiss.nearMiss, true);

  // Does not double-score near miss on the same vehicle
  const resRepeat = evaluateVehicleInteraction(player, trafficNearMiss, true);
  assert.equal(resRepeat.nearMiss, false);
});

test('economy and garage prevent negative currency, duplicate unlocks, and double run rewards', () => {
  let save = createDefaultSaveData();
  save.coins = 550;

  // Unlock Vortex S7 (cost 500)
  const unlock1 = tryUnlockCar(save, 'vortex_interceptor');
  assert.equal(unlock1.success, true);
  save = unlock1.data;
  assert.equal(save.coins, 50);
  assert.ok(save.unlockedCarIds.includes('vortex_interceptor'));

  // Attempt duplicate unlock
  const unlockDup = tryUnlockCar(save, 'vortex_interceptor');
  assert.equal(unlockDup.success, false);
  assert.equal(unlockDup.data.coins, 50);

  // Attempt upgrade with insufficient coins (cost 120, balance 50)
  const failedUpg = tryPurchaseUpgrade(save, 'vortex_interceptor', 'topSpeed');
  assert.equal(failedUpg.success, false);
  assert.equal(failedUpg.data.coins, 50);

  // Record a race run and verify idempotency for same runId
  const rewards = calculateRunRewards({
    distanceMeters: 500,
    coinsCollected: 10,
    nearMissCount: 4,
    bonusScore: 0,
  });
  const run1 = recordCompletedRun(save, 'run-001', {
    score: rewards.totalScore,
    distanceMeters: 500,
    coinsEarned: rewards.totalCoinsEarned,
    rawCoinsPickedUp: 10,
    nearMisses: 4,
  });
  assert.equal(run1.applied, true);
  save = run1.data;
  const coinsAfterRun = save.coins;
  assert.ok(coinsAfterRun > 50);

  // Duplicate runId does not grant coins again
  const run1Dup = recordCompletedRun(save, 'run-001', {
    score: rewards.totalScore,
    distanceMeters: 500,
    coinsEarned: rewards.totalCoinsEarned,
    rawCoinsPickedUp: 10,
    nearMisses: 4,
  });
  assert.equal(run1Dup.applied, false);
  assert.equal(run1Dup.data.coins, coinsAfterRun);
});

test('upgrades increase effective car stats and challenge rewards can be claimed once', () => {
  let save = createDefaultSaveData();
  save.coins = 2000;
  const baseStats = getEffectiveCarStats('starter_apex', save.carUpgrades.starter_apex);

  const upg = tryPurchaseUpgrade(save, 'starter_apex', 'topSpeed');
  assert.equal(upg.success, true);
  save = upg.data;

  const upgradedStats = getEffectiveCarStats('starter_apex', save.carUpgrades.starter_apex);
  assert.ok(upgradedStats.topSpeedKmh > baseStats.topSpeedKmh);
  assert.ok(getUpgradeCost('topSpeed', 1) > getUpgradeCost('topSpeed', 0));

  // Complete distance challenge (target 1000m)
  save.challenges.cumulativeDistance = 1250;
  const claim1 = tryClaimChallengeReward(save, 'dist_1000');
  assert.equal(claim1.success, true);
  assert.equal(claim1.reward, 250);
  save = claim1.data;

  // Cannot claim a second time
  const claim2 = tryClaimChallengeReward(save, 'dist_1000');
  assert.equal(claim2.success, false);
});

test('AdMob frequency rules and rewarded ad verification', () => {
  // Cannot show during racing
  assert.equal(
    canShowInterstitialAd({
      isRacingOrSteering: true,
      completedRacesCount: 5,
      racesSinceLastInterstitial: 4,
      lastInterstitialTimestampMs: 0,
      nowTimestampMs: 500_000,
      isAdLoaded: true,
      consentAllowsAds: true,
    }),
    false
  );

  // Cannot show before 3 completed races since last interstitial
  assert.equal(
    canShowInterstitialAd({
      isRacingOrSteering: false,
      completedRacesCount: 2,
      racesSinceLastInterstitial: 2,
      lastInterstitialTimestampMs: 0,
      nowTimestampMs: 500_000,
      isAdLoaded: true,
      consentAllowsAds: true,
    }),
    false
  );

  // Can show on 3rd completed race when cooldown has elapsed
  assert.equal(
    canShowInterstitialAd({
      isRacingOrSteering: false,
      completedRacesCount: 3,
      racesSinceLastInterstitial: 3,
      lastInterstitialTimestampMs: 100_000,
      nowTimestampMs: 300_000, // 200s > 180s cooldown
      isAdLoaded: true,
      consentAllowsAds: true,
    }),
    true
  );

  // Rewarded ad only grants when sdkConfirmedReward is true
  const earlyClose = resolveRewardedAdBonus({
    baseCoinsEarned: 80,
    sdkConfirmedReward: false,
    alreadyClaimedForRun: false,
  });
  assert.equal(earlyClose.granted, false);
  assert.equal(earlyClose.bonusCoins, 0);

  const confirmed = resolveRewardedAdBonus({
    baseCoinsEarned: 80,
    sdkConfirmedReward: true,
    alreadyClaimedForRun: false,
  });
  assert.equal(confirmed.granted, true);
  assert.equal(confirmed.bonusCoins, 80);
});

test('validateAndSanitizeSave recovers from malformed or corrupted fields', () => {
  const sanitized = validateAndSanitizeSave({
    coins: -999,
    selectedCarId: 'non_existent_car',
    unlockedCarIds: ['invalid'],
    settings: { musicVolume: 5, steeringMode: 'invalid_mode' },
  });
  assert.equal(sanitized.coins, 350);
  assert.equal(sanitized.selectedCarId, 'starter_apex');
  assert.ok(sanitized.unlockedCarIds.includes('starter_apex'));
  assert.equal(sanitized.settings.musicVolume, 1);
  assert.equal(sanitized.settings.steeringMode, 'buttons');
});
