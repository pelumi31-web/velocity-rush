import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_CONFIGS,
  CAR_ORDER,
  CHALLENGES_CONFIG,
  DAILY_COMPLETION_BONUS_COINS,
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
  ensureCurrentDailyChallenges,
  generateDailyChallengesForDate,
  getChallengeMetricValue,
  recordCompletedLevelRace,
  recordCompletedRun,
  recordLiveGameplayProgress,
  tryClaimChallengeReward,
  tryClaimDailyChallengeReward,
  tryClaimDailyCompletionBonus,
  tryPurchaseOrEquipCustomization,
  tryPurchaseProtectionUpgrade,
  tryPurchaseUpgrade,
  tryUnlockCar,
  validateAndSanitizeSave,
} from './saveSystem.ts';
import {
  ARCADE_JUMP_GRAVITY,
  calculateLevelRaceRewards,
  computeCurvedRoadCenterAtWorldZ,
  computeExpectedJumpRangeMeters,
  computeRaceStandings,
  createLevelAiOpponents,
  generateLevelCourse,
  isDistanceInTunnelProtectedZone,
  PLAYER_GRID_START_DIST,
  sampleRoadSurfaceAtDistance,
  sampleTrackAtDistance,
  stepAiOpponent,
  stepVehicleJumpPhysics,
  validateBridgeJumpSpec,
  validateJumpAgainstTunnels,
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
    const opponents = createLevelAiOpponents(lvl, 72);
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
        s.type === 'drift_s_bend'
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

test('Feature 1 & 2: Illuminated Tunnels, Controlled Short Broken-Bridge Jumps, and Tunnel-Priority Routing', () => {
  assert.ok(ARCADE_JUMP_GRAVITY >= 34, 'Jump gravity must be brisk so cars do not float in air');

  for (const lvl of [1, 2, 4, 8]) {
    const course = generateLevelCourse(lvl);
    assert.ok(course.tunnels.length >= 2, `Level ${lvl} must include illuminated tunnels`);
    assert.ok(course.bridgeJumps.length >= 2, `Level ${lvl} must include broken-bridge jumps`);

    // 1. Verify Tunnel smooth lighting transition & geometry bounds
    const tun = course.tunnels[0];
    const beforeTun = sampleRoadSurfaceAtDistance(
      tun.startDist - 16,
      course.bridgeJumps,
      course.tunnels
    );
    assert.equal(beforeTun.isInsideTunnel, false);
    assert.ok(
      beforeTun.tunnelProximity01 > 0.2 && beforeTun.tunnelProximity01 < 0.8,
      'Tunnel lighting proximity must transition smoothly before entrance'
    );

    const midTun = sampleRoadSurfaceAtDistance(
      (tun.startDist + tun.endDist) * 0.5,
      course.bridgeJumps,
      course.tunnels
    );
    assert.equal(midTun.isInsideTunnel, true);
    assert.equal(midTun.tunnelProximity01, 1.0);

    // 2. Verify Broken-Bridge Jump has controlled ramp height, compact gap, clear obstacles, and zero tunnel overlap
    for (const jump of course.bridgeJumps) {
      const validated = validateBridgeJumpSpec(jump);
      assert.ok(
        validated.rampPeakHeight >= 1.3 && validated.rampPeakHeight <= 2.0,
        'Ramp must have controlled, realistic upward elevation (1.3m–2.0m)'
      );
      assert.ok(validated.rampAngleRad > 0.05, 'Ramp must have real upward incline angle');
      assert.ok(
        validated.gapLength >= 13 && validated.gapLength <= 22,
        'Bridge gap must be a compact, crossable span (13m–22m)'
      );

      // Verify jump does NOT overlap any tunnel or protected tunnel buffer zone
      const clearanceOk = validateJumpAgainstTunnels(validated, course.tunnels);
      assert.equal(
        clearanceOk,
        true,
        `Bridge jump ${jump.id} in Level ${lvl} must never conflict with a tunnel`
      );
      assert.equal(
        isDistanceInTunnelProtectedZone(jump.rampEndDist, course.tunnels),
        false,
        'Takeoff lip must never be inside a protected tunnel approach/exit zone'
      );

      // Starter car top speed (~60.5 m/s) must easily exceed the gap length
      const starterRange = computeExpectedJumpRangeMeters(validated, 54);
      assert.ok(
        starterRange > validated.gapLength + 2.5,
        `Starter car range (${starterRange.toFixed(1)}m) must clear gap (${validated.gapLength}m)`
      );

      // Verify inclined surface on ramp
      const midRamp = sampleRoadSurfaceAtDistance(
        (jump.rampStartDist + jump.rampEndDist) * 0.5,
        course.bridgeJumps,
        course.tunnels
      );
      assert.equal(midRamp.isOnTakeoffRamp, true);
      assert.ok(midRamp.groundY > 0.45 && midRamp.groundY < jump.rampPeakHeight);
      assert.ok(midRamp.slopePitchRad > 0.05);

      // Verify physically open gap across (gapStartDist, gapEndDist)
      const midGap = sampleRoadSurfaceAtDistance(
        (jump.gapStartDist + jump.gapEndDist) * 0.5,
        course.bridgeJumps,
        course.tunnels
      );
      assert.equal(midGap.isOverOpenGap, true);
      assert.ok(midGap.groundY <= -10, 'Open bridge gap must drop down into chasm');

      // Verify no course obstacles block the takeoff ramp, gap, or landing zone
      const blockingObs = course.obstacles.filter(
        (o) =>
          o.distanceMeters >= jump.rampStartDist - 25 &&
          o.distanceMeters <= jump.landingEndDist + 15
      );
      assert.equal(
        blockingObs.length,
        0,
        'Takeoff ramp, open gap, and landing deck must be clear of obstacles'
      );
    }
  }

  // 3. Test Vehicle Takeoff -> Short, Controlled Airborne Flight -> Safe Landing at Valid Speed
  const course1 = generateLevelCourse(1);
  const jump1 = course1.bridgeJumps[0];
  let dist = jump1.rampStartDist - 5;
  let y = 0;
  let vy = 0;
  let pitchRad = 0;
  let isAirborne = false;
  let activeJumpId: number | null = null;
  const validSpeedMs = 52; // ~187 km/h
  const dt = 0.02;

  let sawTakeoff = false;
  let sawAirborneOverGap = false;
  let sawLanding = false;
  let sawFailedJump = false;
  let totalAirborneTimeSec = 0;
  let maxAirborneHeightMeters = 0;

  while (dist < jump1.landingEndDist) {
    const nextDist = dist + validSpeedMs * dt;
    const step = stepVehicleJumpPhysics({
      prevDistanceMeters: dist,
      nextDistanceMeters: nextDist,
      speedMs: validSpeedMs,
      y,
      vy,
      pitchRad,
      isAirborne,
      activeJumpId,
      bridgeJumps: course1.bridgeJumps,
      tunnels: course1.tunnels,
      dt,
    });
    dist = nextDist;
    y = step.y;
    vy = step.vy;
    pitchRad = step.pitchRad;
    isAirborne = step.isAirborne;
    activeJumpId = step.activeJumpId;

    if (step.justTookOff) sawTakeoff = true;
    if (isAirborne) {
      totalAirborneTimeSec += dt;
      maxAirborneHeightMeters = Math.max(maxAirborneHeightMeters, y);
    }
    if (isAirborne && dist > jump1.gapStartDist + 2 && dist < jump1.gapEndDist - 2) {
      sawAirborneOverGap = true;
      assert.ok(y > 0.75, 'Vehicle must be airborne above road datum over the open gap');
    }
    if (step.justLanded) sawLanding = true;
    if (step.justFailedJump) sawFailedJump = true;
  }

  assert.equal(sawTakeoff, true, 'Vehicle must trigger takeoff at ramp lip');
  assert.equal(sawAirborneOverGap, true, 'Vehicle must fly across open bridge gap');
  assert.equal(sawLanding, true, 'Vehicle must land safely on receiving platform');
  assert.equal(sawFailedJump, false, 'Valid approach speed must not fail jump');
  assert.equal(isAirborne, false, 'Vehicle must return to grounded state after landing');
  assert.ok(
    totalAirborneTimeSec > 0.25 && totalAirborneTimeSec <= 0.65,
    `Jump airtime must be brief and controlled (got ${totalAirborneTimeSec.toFixed(2)}s)`
  );
  assert.ok(
    maxAirborneHeightMeters <= 2.4,
    `Jump apex height must stay below tunnel roof height (got ${maxAirborneHeightMeters.toFixed(2)}m)`
  );

  // 4. Test Tunnel Routing Priority: any vehicle entering a tunnel while airborne is immediately grounded onto the tunnel road
  const tun1 = course1.tunnels[0];
  const insideTunStep = stepVehicleJumpPhysics({
    prevDistanceMeters: tun1.startDist - 1,
    nextDistanceMeters: tun1.startDist + 2,
    speedMs: 55,
    y: 4.5,
    vy: 3.0,
    pitchRad: 0.12,
    isAirborne: true,
    activeJumpId: 99,
    bridgeJumps: course1.bridgeJumps,
    tunnels: course1.tunnels,
    dt: 0.02,
  });
  assert.equal(
    insideTunStep.isAirborne,
    false,
    'Vehicle entering a tunnel must never remain airborne or clip through the tunnel roof'
  );
  assert.equal(insideTunStep.y, 0, 'Vehicle inside tunnel must be grounded at road level y=0');
  assert.equal(insideTunStep.jumpState, 'grounded');

  // 5. Test Deliberate Failed Jump when Speed is Too Slow
  dist = jump1.rampStartDist - 2;
  y = 0;
  vy = 0;
  pitchRad = 0;
  isAirborne = false;
  activeJumpId = null;
  const slowSpeedMs = 15; // well below minRequiredSpeedMs
  let failedDetected = false;

  while (dist < jump1.landingEndDist && !failedDetected) {
    const nextDist = dist + slowSpeedMs * dt;
    const step = stepVehicleJumpPhysics({
      prevDistanceMeters: dist,
      nextDistanceMeters: nextDist,
      speedMs: slowSpeedMs,
      y,
      vy,
      pitchRad,
      isAirborne,
      activeJumpId,
      bridgeJumps: course1.bridgeJumps,
      tunnels: course1.tunnels,
      dt,
    });
    dist = nextDist;
    y = step.y;
    vy = step.vy;
    pitchRad = step.pitchRad;
    isAirborne = step.isAirborne;
    activeJumpId = step.activeJumpId;
    if (step.justFailedJump) {
      failedDetected = true;
    }
  }
  assert.equal(failedDetected, true, 'Insufficient speed must trigger failed-jump detection');

  // 6. Verify all 5 AI Opponents successfully jump the broken bridge and continue racing
  const aiRacers = createLevelAiOpponents(1, 62);
  for (const ai of aiRacers) {
    ai.distanceMeters = jump1.approachStartDist;
    ai.speedMs = 46;
  }
  const aibecameAirborne = new Set<string>();
  let elapsed = 0;
  for (let s = 0; s < 260; s++) {
    elapsed += dt;
    for (const ai of aiRacers) {
      stepAiOpponent({
        ai,
        allOpponents: aiRacers,
        playerX: -1.8,
        playerDist: jump1.approachStartDist + elapsed * 48,
        course: course1,
        elapsedRaceSec: elapsed,
        dt,
      });
      if (ai.isAirborne && ai.y > 0.75) {
        aibecameAirborne.add(ai.id);
      }
    }
  }
  assert.equal(
    aibecameAirborne.size,
    5,
    'All 5 AI opponents must become airborne across the broken-bridge jump'
  );
  for (const ai of aiRacers) {
    assert.ok(
      ai.distanceMeters > jump1.gapEndDist + 20,
      `AI ${ai.driverName} must land on the receiving bridge section and continue racing`
    );
    assert.equal(ai.isAirborne, false, `AI ${ai.driverName} must be grounded after landing`);
  }
});

test('32 Lifetime Challenges & Daily Challenges, Streaks, Bonus, and Live Progress Persistence', () => {
  // 1. Verify 32 total challenges and preservation of the 4 original IDs
  assert.equal(CHALLENGES_CONFIG.length, 32, 'Must configure 32 total lifetime challenges');
  const originalIds = ['dist_1000', 'coins_75', 'nearmiss_12', 'score_10000'];
  for (const origId of originalIds) {
    assert.ok(
      CHALLENGES_CONFIG.some((c) => c.id === origId),
      `Original challenge ID ${origId} must be preserved`
    );
  }

  // Verify all 6 categories have challenges
  for (const cat of ['solo', 'levels', 'skills', 'stunts', 'garage'] as const) {
    assert.ok(
      CHALLENGES_CONFIG.filter((c) => c.category === cat).length >= 3,
      `Category ${cat} must contain multiple challenges`
    );
  }

  // 2. Verify live gameplay progress updates both lifetime and daily metrics without double-counting at run end
  let save = createDefaultSaveData();
  save = recordLiveGameplayProgress(save, {
    distanceMeters: 600,
    soloDistanceMeters: 600,
    rawCoinsPickedUp: 10,
    nearMisses: 4,
    highSpeedNearMisses: 2,
    driftEvents: 2,
    successfulJumps: 10,
    tunnelsCompleted: 2,
    shieldAbsorptions: 1,
    nitroActivations: 4,
  });

  assert.equal(getChallengeMetricValue(save, 'successfulJumps'), 10);
  assert.equal(getChallengeMetricValue(save, 'tunnelsCompleted'), 2);
  assert.equal(getChallengeMetricValue(save, 'highSpeedNearMisses'), 2);

  // Claim "Airborne Rookie" (10 successful bridge jumps, +300 coins)
  const coinsBefore = save.coins;
  const claimJump = tryClaimChallengeReward(save, 'jumps_10');
  assert.equal(claimJump.success, true);
  assert.equal(claimJump.reward, 300);
  save = claimJump.data;
  assert.equal(save.coins, coinsBefore + 300);

  // Re-claiming the same challenge must be rejected
  const duplicateClaim = tryClaimChallengeReward(save, 'jumps_10');
  assert.equal(duplicateClaim.success, false);

  // Finish the Solo run passing alreadyCommitted so the 600m and 10 jumps are not double-counted
  const endRes = recordCompletedRun(save, 'solo_run_test_1', {
    score: 4500,
    distanceMeters: 1000,
    coinsEarned: 150,
    rawCoinsPickedUp: 15,
    nearMisses: 6,
    highSpeedNearMisses: 3,
    driftEvents: 3,
    successfulJumps: 12,
    tunnelsCompleted: 3,
    shieldAbsorptions: 1,
    nitroActivations: 5,
    alreadyCommitted: {
      distanceMeters: 600,
      soloDistanceMeters: 600,
      rawCoinsPickedUp: 10,
      nearMisses: 4,
      highSpeedNearMisses: 2,
      driftEvents: 2,
      successfulJumps: 10,
      tunnelsCompleted: 2,
      shieldAbsorptions: 1,
      nitroActivations: 4,
    },
  });
  save = endRes.data;
  assert.equal(
    getChallengeMetricValue(save, 'soloDistance'),
    1000,
    'Solo distance must equal total 1000m (600m live + 400m remainder)'
  );
  assert.equal(
    getChallengeMetricValue(save, 'successfulJumps'),
    12,
    'Total jumps must equal 12 (10 live + 2 remainder)'
  );

  // 3. Verify Daily Challenges generation, uniqueness, streak increment, and 250-coin daily bonus
  const day1 = '2026-10-20';
  const day2 = '2026-10-21';
  const day4 = '2026-10-23'; // skipped 2026-10-22

  const generated = generateDailyChallengesForDate(day1, 0);
  assert.equal(generated.length, 3, 'Must generate 3 daily challenges per UTC day');
  assert.equal(generated[0].difficulty, 'easy');
  assert.equal(generated[1].difficulty, 'medium');
  assert.equal(generated[2].difficulty, 'hard');
  const dailyMetrics = new Set(generated.map((d) => d.metric));
  assert.equal(dailyMetrics.size, 3, '3 daily challenges must have 3 distinct metrics');

  // Force day1 active state and complete all 3 daily challenges
  save = {
    ...save,
    dailyChallenges: {
      dateUtc: day1,
      items: generated.map((c) => ({ ...c, currentValue: c.targetValue })),
      bonusClaimed: false,
      currentStreak: 0,
      bestStreak: 0,
      lastStreakDateUtc: null,
      history: [],
    },
  };

  // Claim first daily challenge -> streak becomes 1
  const dClaim1 = tryClaimDailyChallengeReward(save, generated[0].id, day1);
  assert.equal(dClaim1.success, true);
  save = dClaim1.data;
  assert.equal(save.dailyChallenges.currentStreak, 1);
  assert.equal(save.dailyChallenges.bestStreak, 1);

  // Claim second daily challenge on same UTC day -> streak stays 1
  const dClaim2 = tryClaimDailyChallengeReward(save, generated[1].id, day1);
  assert.equal(dClaim2.success, true);
  save = dClaim2.data;
  assert.equal(save.dailyChallenges.currentStreak, 1);

  // Claim Daily Completion Bonus (+250 coins) since all 3 are completed
  const bonusClaim = tryClaimDailyCompletionBonus(save, day1);
  assert.equal(bonusClaim.success, true);
  assert.equal(bonusClaim.reward, DAILY_COMPLETION_BONUS_COINS);
  save = bonusClaim.data;
  assert.equal(save.dailyChallenges.bonusClaimed, true);

  // Roll over to next consecutive UTC day (day2) -> archives day1 into history and preserves streak
  save = ensureCurrentDailyChallenges(save, day2);
  assert.equal(save.dailyChallenges.dateUtc, day2);
  assert.equal(save.dailyChallenges.history.length, 1);
  assert.equal(save.dailyChallenges.history[0].dateUtc, day1);
  assert.equal(save.dailyChallenges.history[0].completedCount, 3);
  assert.equal(save.dailyChallenges.currentStreak, 1);

  // Complete and claim a challenge on day2 -> streak increments to 2!
  save = {
    ...save,
    dailyChallenges: {
      ...save.dailyChallenges,
      items: save.dailyChallenges.items.map((c, idx) =>
        idx === 0 ? { ...c, currentValue: c.targetValue } : c
      ),
    },
  };
  const day2Claim = tryClaimDailyChallengeReward(
    save,
    save.dailyChallenges.items[0].id,
    day2
  );
  assert.equal(day2Claim.success, true);
  save = day2Claim.data;
  assert.equal(save.dailyChallenges.currentStreak, 2);
  assert.equal(save.dailyChallenges.bestStreak, 2);

  // Skip day3 and roll over to day4 -> currentStreak resets to 0 while bestStreak remains 2
  save = ensureCurrentDailyChallenges(save, day4);
  assert.equal(save.dailyChallenges.currentStreak, 0);
  assert.equal(save.dailyChallenges.bestStreak, 2);
});



