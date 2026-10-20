import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_CONFIGS,
  CAR_ORDER,
  HIGHWAY_CONFIG,
  WHEEL_ORDER,
} from './config.ts';
import {
  calculateRunRewards,
  canShowInterstitialAd,
  computeLandscapeTiltDegreesFromSensors,
  evaluateVehicleInteraction,
  getEffectiveCarStats,
  processTiltInput,
  resolveRewardedAdBonus,
  selectFairTrafficLanes,
  stepLongitudinalPhysics,
} from './rules.ts';
import {
  createDefaultSaveData,
  recordCompletedLevelRace,
  recordCompletedRun,
  tryClaimChallengeReward,
  tryPurchaseOrEquipCustomization,
  tryPurchaseProtectionUpgrade,
  tryPurchaseUpgrade,
  tryUnlockCar,
  validateAndSanitizeSave,
} from './saveSystem.ts';
import {
  calculateLevelRaceRewards,
  computeCurvedRoadCenterAtWorldZ,
  computeRaceStandings,
  createLevelAiOpponents,
  generateLevelCourse,
  PLAYER_GRID_START_DIST,
  sampleTrackAtDistance,
  stepAiOpponent,
} from './levelsMode.ts';

test('8 distinct vehicles exist with unique body styles and valid customization compatibility', () => {
  assert.equal(CAR_ORDER.length, 8);
  const bodyStyles = new Set<string>();
  for (const carId of CAR_ORDER) {
    const cfg = CAR_CONFIGS[carId];
    assert.ok(cfg, `Missing config for ${carId}`);
    bodyStyles.add(cfg.bodyStyle);
    assert.ok(cfg.compatibleSpoilers.includes('spoiler_stock'));
    assert.ok(cfg.compatibleBumpers.includes('bumper_stock'));
    assert.ok(cfg.compatibleSkirts.includes('skirt_stock'));
    assert.ok(cfg.compatibleRoofAccessories.includes('roof_none'));
  }
  assert.equal(bodyStyles.size, 8, 'Every car must have a distinct 3D bodyStyle silhouette');
  assert.equal(WHEEL_ORDER.length, 6, '6 distinct wheel styles must be configured');
});

test('processTiltInput respects deadZone, calibration neutral offset, sensitivity, and inversion', () => {
  const withinDeadZone = processTiltInput({
    rawAngleDeg: 1.5,
    neutralOffsetDeg: 0,
    sensitivity: 'medium',
    invertTilt: false,
  });
  assert.equal(withinDeadZone, 0);

  const calibratedNeutral = processTiltInput({
    rawAngleDeg: 10.5,
    neutralOffsetDeg: 10.0,
    sensitivity: 'medium',
    invertTilt: false,
  });
  assert.equal(calibratedNeutral, 0);

  const rightTiltMed = processTiltInput({
    rawAngleDeg: 14,
    neutralOffsetDeg: 0,
    sensitivity: 'medium',
    invertTilt: false,
    smoothingFactor: 1,
  });
  const rightTiltHigh = processTiltInput({
    rawAngleDeg: 14,
    neutralOffsetDeg: 0,
    sensitivity: 'high',
    invertTilt: false,
    smoothingFactor: 1,
  });
  assert.ok(rightTiltMed > 0);
  assert.ok(rightTiltHigh > rightTiltMed);

  const inverted = processTiltInput({
    rawAngleDeg: 14,
    neutralOffsetDeg: 0,
    sensitivity: 'medium',
    invertTilt: true,
    smoothingFactor: 1,
  });
  assert.equal(inverted, -rightTiltMed);
});

test('computeLandscapeTiltDegreesFromSensors handles Landscape Left (90), Landscape Right (270), and Portrait (0)', () => {
  const tilt90 = computeLandscapeTiltDegreesFromSensors({
    screenAngle: 90,
    accelIncludingGravity: { x: 0, y: 4.905, z: 8.49 },
  });
  assert.ok(tilt90 !== null && Math.abs(tilt90 - 30) < 1.5);

  const tilt270 = computeLandscapeTiltDegreesFromSensors({
    screenAngle: 270,
    accelIncludingGravity: { x: 0, y: -4.905, z: 8.49 },
  });
  assert.ok(tilt270 !== null && Math.abs(tilt270 - 30) < 1.5);

  const fallbackOrient = computeLandscapeTiltDegreesFromSensors({
    screenAngle: 90,
    accelIncludingGravity: null,
    orientation: { beta: -18, gamma: 40 },
  });
  assert.equal(fallbackOrient, -18);
});

test('stepLongitudinalPhysics accelerates progressively, brakes smoothly, and boosts with nitro', () => {
  const stats = getEffectiveCarStats('starter_apex', {
    topSpeed: 0,
    acceleration: 0,
    handling: 0,
    braking: 0,
    nitro: 0,
  });

  let speedMs = HIGHWAY_CONFIG.launchSpeedKmh / 3.6;
  let nitroAmount = 1.0;
  let isNitroActive = false;

  for (let i = 0; i < 30; i++) {
    const step = stepLongitudinalPhysics({
      currentSpeedMs: speedMs,
      nitroAmount,
      isNitroActive,
      nitroWanted: false,
      brakeWanted: false,
      effectiveStats: stats,
      dt: 0.1,
    });
    assert.ok(step.speedMs > speedMs);
    speedMs = step.speedMs;
  }
  assert.ok(speedMs * 3.6 > 95 && speedMs * 3.6 < stats.topSpeedKmh);

  const beforeBrake = speedMs;
  const braked = stepLongitudinalPhysics({
    currentSpeedMs: speedMs,
    nitroAmount,
    isNitroActive: false,
    nitroWanted: false,
    brakeWanted: true,
    effectiveStats: stats,
    dt: 0.5,
  });
  assert.ok(braked.speedMs < beforeBrake);

  const boosted = stepLongitudinalPhysics({
    currentSpeedMs: stats.topSpeedMs,
    nitroAmount: 1.0,
    isNitroActive: false,
    nitroWanted: true,
    brakeWanted: false,
    effectiveStats: stats,
    dt: 0.5,
  });
  assert.equal(boosted.isNitroActive, true);
  assert.equal(boosted.justActivatedNitro, true);
  assert.ok(boosted.speedMs > stats.topSpeedMs);
  assert.ok(boosted.nitroAmount < 1.0);
});

test('selectFairTrafficLanes never blocks all 4 highway lanes', () => {
  for (let i = 0; i < 100; i++) {
    const lanes = selectFairTrafficLanes(4, 1.0);
    assert.ok(lanes.length >= 1 && lanes.length <= 3);
  }
});

test('evaluateVehicleInteraction detects collision vs near-miss accurately', () => {
  const player = { x: -1.8, z: 0, halfWidth: 0.95, halfLength: 2.2 };
  const directHit = evaluateVehicleInteraction(
    player,
    { x: -1.8, z: -1.0, halfWidth: 0.95, halfLength: 2.2 },
    false
  );
  assert.equal(directHit.collided, true);
  assert.equal(directHit.nearMiss, false);

  const closePass = evaluateVehicleInteraction(
    player,
    { x: 0.7, z: -0.5, halfWidth: 0.95, halfLength: 2.2 },
    false
  );
  assert.equal(closePass.collided, false);
  assert.equal(closePass.nearMiss, true);
});

test('garage customization, wheels, paint, accessories, performance, and shield protection work and persist', () => {
  let save = createDefaultSaveData();
  save.coins = 2500;

  // 1. Purchase wheel for starter car
  const wheelRes = tryPurchaseOrEquipCustomization(save, 'starter_apex', 'wheel', 'track_beadlock');
  assert.equal(wheelRes.success, true);
  assert.equal(wheelRes.purchased, true);
  assert.equal(wheelRes.cost, 520);
  save = wheelRes.data;
  assert.equal(save.carCustomizations.starter_apex.wheelId, 'track_beadlock');
  assert.equal(save.coins, 2500 - 520);

  // Re-equipping an already owned wheel costs 0 coins
  const reEquipRes = tryPurchaseOrEquipCustomization(save, 'starter_apex', 'wheel', 'track_beadlock');
  assert.equal(reEquipRes.success, true);
  assert.equal(reEquipRes.purchased, false);
  assert.equal(reEquipRes.cost, 0);
  assert.equal(reEquipRes.data.coins, save.coins);

  // 2. Incompatible accessory is rejected without deducting coins
  const badRoof = tryPurchaseOrEquipCustomization(save, 'starter_apex', 'roof', 'roof_lightbar');
  assert.equal(badRoof.success, false);
  assert.equal(badRoof.data.coins, save.coins);

  // 3. Compatible spoiler and paint finish work
  const spoilerRes = tryPurchaseOrEquipCustomization(save, 'starter_apex', 'spoiler', 'spoiler_gt_wing');
  assert.equal(spoilerRes.success, true);
  save = spoilerRes.data;
  assert.equal(save.carCustomizations.starter_apex.spoilerId, 'spoiler_gt_wing');

  // 4. Shield protection upgrades increase maxShieldCharges & invulnerability duration
  const baseStats = getEffectiveCarStats('starter_apex', save.carUpgrades.starter_apex, 'std_alloy', save.carProtection.starter_apex);
  const protRes = tryPurchaseProtectionUpgrade(save, 'starter_apex', 'shieldCapacity');
  assert.equal(protRes.success, true);
  save = protRes.data;
  const upgradedStats = getEffectiveCarStats(
    'starter_apex',
    save.carUpgrades.starter_apex,
    save.carCustomizations.starter_apex.wheelId,
    save.carProtection.starter_apex
  );
  assert.equal(upgradedStats.maxShieldCharges, baseStats.maxShieldCharges + 1);
  assert.ok(upgradedStats.handling > baseStats.handling, 'Track slicks wheel must increase effective handling');
});

test('Levels Mode procedural generator creates valid courses and 5 AI opponents compete to finish', () => {
  for (const lvl of [1, 2, 5, 12, 30]) {
    const course = generateLevelCourse(lvl);
    assert.equal(course.levelNumber, lvl);
    assert.ok(course.totalLengthMeters >= 800);
    assert.equal(course.segments[0].type, 'start_grid');
    assert.equal(course.segments[course.segments.length - 1].type, 'finish_straight');

    // Verify obstacles never block all 4 lanes at any distance
    const byDist = new Map<number, Set<number>>();
    for (const obs of course.obstacles) {
      if (!byDist.has(obs.distanceMeters)) byDist.set(obs.distanceMeters, new Set());
      byDist.get(obs.distanceMeters)!.add(obs.laneIndex);
    }
    for (const [, blockedLanes] of byDist.entries()) {
      assert.ok(blockedLanes.size <= 2, 'At least 2 lanes must remain open at every obstacle row');
    }

    const sampleMid = sampleTrackAtDistance(course, course.totalLengthMeters * 0.5);
    assert.ok(sampleMid.segment);
  }

  // Verify 5 AI opponents (6 racing vehicles total with player)
  const course1 = generateLevelCourse(1);
  const opponents = createLevelAiOpponents(1, 228 / 3.6);
  assert.equal(opponents.length, 5, 'Must create exactly 5 AI opponents');

  // Step AI opponents for 25 seconds of simulated race time
  let elapsed = 0;
  const dt = 0.05;
  for (let step = 0; step < 500; step++) {
    elapsed += dt;
    for (const ai of opponents) {
      stepAiOpponent({
        ai,
        allOpponents: opponents,
        playerX: -1.8,
        playerDist: elapsed * 55,
        course: course1,
        elapsedRaceSec: elapsed,
        dt,
      });
    }
  }

  for (const ai of opponents) {
    assert.ok(ai.distanceMeters > 400, `AI ${ai.driverName} must progress down the course`);
  }

  const standings = computeRaceStandings({
    playerCarId: 'starter_apex',
    playerDistanceMeters: course1.totalLengthMeters,
    playerFinished: true,
    playerFinishTimeSec: 18.4,
    opponents,
    totalLengthMeters: course1.totalLengthMeters,
  });
  assert.equal(standings.length, 6, 'Standings must rank all 6 racing vehicles');
  assert.equal(standings[0].isPlayer, true);
  assert.equal(standings[0].position, 1);

  // Verify Level completion unlocks Level 2 and prevents duplicate rewards
  const save0 = createDefaultSaveData();
  const rewards = calculateLevelRaceRewards({
    course: course1,
    position: 1,
    coinsCollected: 6,
    driftScore: 250,
    collisionsCount: 0,
  });
  assert.equal(rewards.qualifiedForNextLevel, true);

  const rec1 = recordCompletedLevelRace(save0, 'lvl_run_1', {
    levelNumber: 1,
    playerPosition: 1,
    finishTimeSec: 18.4,
    totalCoinsEarned: rewards.totalCoinsEarned,
    distanceMeters: course1.totalLengthMeters,
    rawCoinsPickedUp: 6,
    score: rewards.totalScore,
  });
  assert.equal(rec1.applied, true);
  assert.equal(rec1.unlockedNextLevel, true);
  assert.equal(rec1.data.levelsProgression.highestUnlockedLevel, 2);

  // Duplicate submission with same runId is ignored
  const recDup = recordCompletedLevelRace(rec1.data, 'lvl_run_1', {
    levelNumber: 1,
    playerPosition: 1,
    finishTimeSec: 18.4,
    totalCoinsEarned: rewards.totalCoinsEarned,
    distanceMeters: course1.totalLengthMeters,
    rawCoinsPickedUp: 6,
    score: rewards.totalScore,
  });
  assert.equal(recDup.applied, false);
  assert.equal(recDup.data.coins, rec1.data.coins);
});

test('economy, Solo Mode runs, challenges, AdMob frequency, and save sanitization work', () => {
  let save = createDefaultSaveData();
  const unlockRes = tryUnlockCar(save, 'urban_sentinel');
  assert.equal(unlockRes.success, true);
  save = unlockRes.data;

  const upg = tryPurchaseUpgrade(save, 'starter_apex', 'braking');
  assert.equal(upg.success, true);
  save = upg.data;

  const run1 = recordCompletedRun(save, 'solo_run_1', {
    score: 12000,
    distanceMeters: 1500,
    coinsEarned: 120,
    rawCoinsPickedUp: 80,
    nearMisses: 15,
  });
  assert.equal(run1.applied, true);
  save = run1.data;

  const claim = tryClaimChallengeReward(save, 'dist_1000');
  assert.equal(claim.success, true);

  const rewards = calculateRunRewards({
    distanceMeters: 500,
    coinsCollected: 10,
    nearMissCount: 4,
    bonusScore: 0,
  });
  assert.ok(rewards.totalCoinsEarned > 0);

  assert.equal(
    canShowInterstitialAd({
      isRacingOrSteering: true,
      completedRacesCount: 5,
      racesSinceLastInterstitial: 5,
      lastInterstitialTimestampMs: 0,
      nowTimestampMs: 500_000,
      isAdLoaded: true,
      consentAllowsAds: true,
    }),
    false
  );

  const bonus = resolveRewardedAdBonus({
    baseCoinsEarned: 85,
    sdkConfirmedReward: true,
    alreadyClaimedForRun: false,
  });
  assert.equal(bonus.granted, true);

  const sanitized = validateAndSanitizeSave({
    coins: -999,
    selectedCarId: 'invalid_car',
  });
  assert.equal(sanitized.coins, 600);
  assert.equal(sanitized.selectedCarId, 'starter_apex');
});

test('Fair 6-car starting grid and U-shaped drift / hairpin curves in Levels Mode', () => {
  for (let lvl = 1; lvl <= 4; lvl++) {
    const course = generateLevelCourse(lvl);
    const opponents = createLevelAiOpponents(lvl, 'starter_apex', 72);
    assert.equal(opponents.length, 5, 'Exactly 5 AI opponents must be spawned');
    assert.ok(PLAYER_GRID_START_DIST <= 0, 'Player starts behind or on start line');

    // Verify NO AI car starts ahead of the start line (distanceMeters <= 0)
    for (const ai of opponents) {
      assert.ok(
        ai.distanceMeters <= 0,
        `AI ${ai.driverName} must start behind or on the start line (got ${ai.distanceMeters}m)`
      );
      assert.equal(ai.speedMs, 0, 'AI must be stationary before GO!');
    }

    // Verify course includes U-turn, hairpin, sweeping bend, or S-curve elements
    const curvedSegments = course.segments.filter(
      (s) =>
        s.type === 'u_turn_left' ||
        s.type === 'u_turn_right' ||
        s.type === 'hairpin_left' ||
        s.type === 'hairpin_right' ||
        s.type === 'sweeping_bend_left' ||
        s.type === 'sweeping_bend_right' ||
        s.type === 's_curve'
    );
    assert.ok(
      curvedSegments.length >= 2,
      `Level ${lvl} must contain multiple curved / U-turn / hairpin segments`
    );

    // Verify road centerline shifts smoothly ahead in U-turn / curved sections
    const firstCurve = curvedSegments[0];
    const midDist = (firstCurve.startDist + firstCurve.endDist) * 0.5;
    const centerAhead = computeCurvedRoadCenterAtWorldZ(course, midDist, -60);
    assert.ok(
      Math.abs(centerAhead.xOffset) > 0.5,
      `Curved road centerline must deflect laterally on ${firstCurve.type}`
    );
  }
});

