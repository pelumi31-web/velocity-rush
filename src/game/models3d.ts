import * as THREE from 'three';
import { CarConfig } from './config.ts';

/**
 * Generates procedural road textures (albedo + bump/roughness) with crisp lane markings,
 * shoulder lines, and asphalt micro-grain. Zero external 404 dependencies.
 */
export function createRoadTextures(maxAnisotropy: number): {
  albedoMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#161b26';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt aggregate grain
  for (let i = 0; i < 3500; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    const lum = 18 + (i % 16);
    ctx.fillStyle = `rgb(${lum}, ${lum + 3}, ${lum + 9})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear tracks down the 4 lanes
  const laneX = [64, 192, 320, 448];
  ctx.fillStyle = 'rgba(10, 14, 20, 0.38)';
  for (const lx of laneX) {
    ctx.fillRect(lx - 26, 0, 14, 512);
    ctx.fillRect(lx + 12, 0, 14, 512);
  }

  // Outer highway shoulder lines (Left = warm amber, Right = electric cyan)
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(8, 0, 8, 512);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(496, 0, 8, 512);

  // Center double line and lane dividers
  // Center divider at X = 256
  ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
  ctx.fillRect(251, 0, 3, 512);
  ctx.fillRect(258, 0, 3, 512);

  // Dashed lane lines at X = 128 and X = 384
  ctx.fillStyle = '#e2e8f0';
  for (let y = 24; y < 512; y += 128) {
    ctx.fillRect(125, y, 6, 68);
    ctx.fillRect(381, y, 6, 68);
  }

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.anisotropy = maxAnisotropy;

  // Roughness map canvas (linear space)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 256;
  rCanvas.height = 256;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, 256, 256);
  rCtx.fillStyle = '#909090';
  for (let i = 0; i < 1200; i++) {
    rCtx.fillRect((i * 53) % 256, (i * 97) % 256, 2, 3);
  }
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { albedoMap, roughnessMap };
}

/**
 * Shared contact shadow disc texture so every vehicle and prop is grounded
 * on the asphalt without floating.
 */
let cachedShadowTexture: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTexture) return cachedShadowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedShadowTexture = new THREE.CanvasTexture(canvas);
  return cachedShadowTexture;
}

export interface PlayerCarMeshRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Object3D[];
  nitroFlames: THREE.Mesh[];
  shieldBubble: THREE.Mesh;
}

/**
 * Builds a multi-part composite 3D vehicle (10+ distinct parts across 3 silhouette scales:
 * Primary beveled hull, Secondary aerodynamic canopy + wing + 4 wheel assemblies,
 * Accent LED headlights, rear lightbar, twin exhausts, nitro flame cones, and contact shadow).
 * Pivot is strictly at bottom-center (y = 0 sits flush on the road).
 */
export function buildPlayerCarMesh(config: CarConfig): PlayerCarMeshRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // 1. Contact Shadow Plane (y = 0.015 to avoid z-fighting with road at y = 0)
  const shadowGeo = new THREE.PlaneGeometry(2.5, 4.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.015;
  root.add(shadowMesh);

  // Materials with varied roughness (>= 0.25 contrast between body, glass, matte trim)
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: config.primaryColor,
    metalness: 0.72,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });

  const matteCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x11151f,
    metalness: 0.25,
    roughness: 0.82,
  });

  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    metalness: 0.9,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const accentGlowMat = new THREE.MeshStandardMaterial({
    color: config.accentColor,
    emissive: config.accentColor,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.5,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff2a4b,
    emissive: 0xef4444,
    emissiveIntensity: 2.8,
  });

  // 2. Primary Lower Sculpted Hull (ExtrudeGeometry with bevels)
  const hullLength = 4.1;
  const hullWidth =
    config.bodyStyle === 'hypercar'
      ? 2.02
      : config.bodyStyle === 'gt_armored'
        ? 2.05
        : 1.92;
  const hullHeight = config.bodyStyle === 'hypercar' ? 0.42 : 0.48;

  const hullShape = new THREE.Shape();
  const hw = hullWidth * 0.46;
  const hl = hullLength * 0.48;
  hullShape.moveTo(-hw, -hl);
  hullShape.lineTo(hw, -hl);
  hullShape.lineTo(hw * 0.94, hl);
  hullShape.lineTo(-hw * 0.94, hl);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: hullHeight,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.center();

  const hullMesh = new THREE.Mesh(hullGeo, paintMat);
  hullMesh.position.y = 0.42;
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // 3. Front Splitter & Rear Diffuser (Matte Carbon)
  const splitterGeo = new THREE.BoxGeometry(hullWidth * 1.01, 0.1, 4.32);
  const splitterMesh = new THREE.Mesh(splitterGeo, matteCarbonMat);
  splitterMesh.position.set(0, 0.22, 0);
  bodyGroup.add(splitterMesh);

  // 4. Secondary Read: Sculpted Aerodynamic Cockpit Canopy
  const cabinLength = config.bodyStyle === 'hypercar' ? 2.15 : 1.95;
  const cabinHeight = config.bodyStyle === 'gt_armored' ? 0.44 : 0.38;
  const cabinGeo = new THREE.BoxGeometry(hullWidth * 0.76, cabinHeight, cabinLength);
  // Taper top vertices of the cabin for sleek fastback silhouette
  const posAttr = cabinGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    if (y > 0) {
      posAttr.setX(i, posAttr.getX(i) * 0.82);
      posAttr.setZ(i, z * 0.78 + 0.15);
    }
  }
  cabinGeo.computeVertexNormals();
  const cabinMesh = new THREE.Mesh(cabinGeo, canopyGlassMat);
  cabinMesh.position.set(0, 0.42 + hullHeight * 0.5 + cabinHeight * 0.42, 0.12);
  bodyGroup.add(cabinMesh);

  // 5. Side Intake Pods / Fender Flares
  const fenderGeo = new THREE.BoxGeometry(hullWidth * 1.04, 0.24, 1.35);
  const frontFenders = new THREE.Mesh(fenderGeo, paintMat);
  frontFenders.position.set(0, 0.44, -1.15);
  const rearFenders = new THREE.Mesh(fenderGeo, paintMat);
  rearFenders.position.set(0, 0.46, 1.2);
  bodyGroup.add(frontFenders, rearFenders);

  // 6. Accent Racing Stripe / Side Sill Trim
  const stripeGeo = new THREE.BoxGeometry(hullWidth * 1.05, 0.045, 2.6);
  const stripeMesh = new THREE.Mesh(stripeGeo, accentGlowMat);
  stripeMesh.position.set(0, 0.31, 0);
  bodyGroup.add(stripeMesh);

  // 7. Rear Aerodynamic Spoiler Wing + Pylons
  const wingWidth = hullWidth * 0.98;
  const wingBladeGeo = new THREE.BoxGeometry(wingWidth, 0.06, 0.34);
  const wingBlade = new THREE.Mesh(wingBladeGeo, config.bodyStyle === 'coupe' ? paintMat : matteCarbonMat);
  wingBlade.position.set(0, 0.96, 1.85);
  wingBlade.rotation.x = 0.14;
  bodyGroup.add(wingBlade);

  const pylonGeo = new THREE.BoxGeometry(0.08, 0.28, 0.26);
  const leftPylon = new THREE.Mesh(pylonGeo, matteCarbonMat);
  leftPylon.position.set(-wingWidth * 0.34, 0.8, 1.82);
  const rightPylon = new THREE.Mesh(pylonGeo, matteCarbonMat);
  rightPylon.position.set(wingWidth * 0.34, 0.8, 1.82);
  bodyGroup.add(leftPylon, rightPylon);

  // 8. Accent Detail: Dual LED Headlights (-Z forward) & Full-Width Rear Lightbar (+Z rear)
  const hlGeo = new THREE.BoxGeometry(0.42, 0.09, 0.1);
  const leftHl = new THREE.Mesh(hlGeo, headlightMat);
  leftHl.position.set(-hullWidth * 0.33, 0.46, -2.14);
  const rightHl = new THREE.Mesh(hlGeo, headlightMat);
  rightHl.position.set(hullWidth * 0.33, 0.46, -2.14);
  bodyGroup.add(leftHl, rightHl);

  const tlGeo = new THREE.BoxGeometry(hullWidth * 0.86, 0.11, 0.1);
  const tailLight = new THREE.Mesh(tlGeo, taillightMat);
  tailLight.position.set(0, 0.5, 2.14);
  bodyGroup.add(tailLight);

  // 9. Twin Exhaust Pipes & Dynamic Nitro Flame Cones
  const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.9,
    roughness: 0.25,
  });
  const flameGeo = new THREE.ConeGeometry(0.14, 0.95, 10);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });

  const nitroFlames: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const ex = new THREE.Mesh(exhaustGeo, exhaustMat);
    ex.position.set(side * 0.42, 0.26, 2.16);
    bodyGroup.add(ex);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(side * 0.42, 0.26, 2.68);
    flame.visible = false;
    bodyGroup.add(flame);
    nitroFlames.push(flame);
  }

  // 10. Four Composite Wheels (Tire + Metallic Rim Hub)
  const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.88,
    metalness: 0.1,
  });
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.2,
  });

  const wheels: THREE.Object3D[] = [];
  const wheelCoords = [
    [-hullWidth * 0.5, 0.34, -1.28],
    [hullWidth * 0.5, 0.34, -1.28],
    [-hullWidth * 0.5, 0.34, 1.28],
    [hullWidth * 0.5, 0.34, 1.28],
  ];

  for (const [wx, wy, wz] of wheelCoords) {
    const wGroup = new THREE.Group();
    wGroup.position.set(wx, wy, wz);
    wGroup.add(new THREE.Mesh(tireGeo, tireMat));
    wGroup.add(new THREE.Mesh(rimGeo, rimMat));
    root.add(wGroup);
    wheels.push(wGroup);
  }

  // 11. Subtle Energy Shield Hit Indicator Shell
  const shieldGeo = new THREE.SphereGeometry(2.5, 16, 12);
  shieldGeo.scale(0.52, 0.32, 1.0);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    wireframe: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
  shieldBubble.position.set(0, 0.55, 0);
  root.add(shieldBubble);

  return {
    group: root,
    bodyGroup,
    wheels,
    nitroFlames,
    shieldBubble,
  };
}

export type TrafficArchetype = 'sedan' | 'suv' | 'sport' | 'truck';

/**
 * Builds a multi-part traffic vehicle with distinct silhouette and color palette per archetype.
 */
export function buildTrafficVehicleMesh(archetype: TrafficArchetype, colorHex: number): THREE.Group {
  const group = new THREE.Group();

  // Contact shadow
  const shadowGeo = new THREE.PlaneGeometry(2.4, 4.7);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  shadowMesh.position.y = 0.015;
  group.add(shadowMesh);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    metalness: 0.55,
    roughness: 0.32,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2a4b,
    emissive: 0xef4444,
    emissiveIntensity: 2.2,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 1.5,
  });

  const isTruck = archetype === 'truck';
  const isSuv = archetype === 'suv';
  const length = isTruck ? 5.2 : 4.2;
  const width = isTruck ? 2.1 : 1.9;
  const baseH = isTruck ? 0.65 : isSuv ? 0.58 : 0.46;

  // Lower chassis
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(width, baseH, length), bodyMat);
  baseMesh.position.y = 0.25 + baseH * 0.5;
  group.add(baseMesh);

  // Bumper trim
  const bumperMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.02, 0.16, length * 1.02),
    trimMat
  );
  bumperMesh.position.y = 0.26;
  group.add(bumperMesh);

  // Upper cabin or cargo box
  const cabinLen = isTruck ? 3.5 : isSuv ? 2.5 : 1.95;
  const cabinH = isTruck ? 0.95 : isSuv ? 0.52 : 0.4;
  const cabinMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.84, cabinH, cabinLen),
    isTruck ? bodyMat : glassMat
  );
  cabinMesh.position.set(0, 0.25 + baseH + cabinH * 0.48, isTruck ? 0.45 : 0.1);
  group.add(cabinMesh);

  // Taillights (+Z faces player approaching from behind)
  const tlGeo = new THREE.BoxGeometry(width * 0.78, 0.12, 0.08);
  const tlMesh = new THREE.Mesh(tlGeo, tailMat);
  tlMesh.position.set(0, 0.48, length * 0.5 + 0.02);
  group.add(tlMesh);

  // Headlights (-Z forward)
  const hlGeo = new THREE.BoxGeometry(width * 0.72, 0.1, 0.08);
  const hlMesh = new THREE.Mesh(hlGeo, headMat);
  hlMesh.position.set(0, 0.45, -length * 0.5 - 0.02);
  group.add(hlMesh);

  // 4 wheels
  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
  const zOff = length * 0.32;
  for (const [wx, wz] of [
    [-width * 0.48, -zOff],
    [width * 0.48, -zOff],
    [-width * 0.48, zOff],
    [width * 0.48, zOff],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.33, wz);
    group.add(w);
  }

  return group;
}

/**
 * Builds a composite spinning highway coin pickup with outer gold ring, inner star core,
 * and grounded shadow disc.
 */
export function buildCoinPickupMesh(): THREE.Group {
  const group = new THREE.Group();

  const shadowGeo = new THREE.CircleGeometry(0.65, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
  );
  shadow.position.y = 0.02;
  group.add(shadow);

  const coinToken = new THREE.Group();
  coinToken.position.y = 0.85;
  group.add(coinToken);

  const ringGeo = new THREE.TorusGeometry(0.46, 0.11, 10, 20);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.75,
    metalness: 0.85,
    roughness: 0.18,
  });
  coinToken.add(new THREE.Mesh(ringGeo, goldMat));

  const coreGeo = new THREE.OctahedronGeometry(0.28, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 1.1,
    metalness: 0.5,
    roughness: 0.25,
  });
  coinToken.add(new THREE.Mesh(coreGeo, coreMat));

  return group;
}
