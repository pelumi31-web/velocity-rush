import * as THREE from 'three';
import {
  BumperId,
  CarBodyStyle,
  CarConfig,
  PAINT_FINISHES,
  PAINT_PRESETS,
  RoofAccessoryId,
  SkirtId,
  SpoilerId,
  UNDERGLOW_OPTIONS,
  WHEEL_COLORS,
  WHEEL_CONFIGS,
  WheelId,
} from './config.ts';
import type { LevelHazardType } from './levelsMode.ts';
import type { CarCustomizationState } from './saveSystem.ts';

/**
 * Generates realistic multi-lane urban highway asphalt textures (albedo + roughness/bump)
 * with aggregate micro-texture, tire tracks, reflective cat's-eye studs, and rumble shoulders.
 */
export function createRoadTextures(maxAnisotropy: number): {
  albedoMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b202c';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    const lum = 22 + (i % 18);
    ctx.fillStyle = `rgb(${lum}, ${lum + 3}, ${lum + 8})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const laneX = [74, 196, 316, 438];
  ctx.fillStyle = 'rgba(11, 15, 22, 0.42)';
  for (const lx of laneX) {
    ctx.fillRect(lx - 28, 0, 16, 512);
    ctx.fillRect(lx + 12, 0, 16, 512);
  }

  ctx.fillStyle = '#131720';
  ctx.fillRect(0, 0, 18, 512);
  ctx.fillRect(494, 0, 18, 512);

  for (let y = 0; y < 512; y += 16) {
    ctx.fillStyle = '#d97706';
    ctx.fillRect(3, y, 8, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(501, y, 8, 8);
  }

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(16, 0, 5, 512);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(491, 0, 5, 512);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(251, 0, 3, 512);
  ctx.fillRect(258, 0, 3, 512);

  ctx.fillStyle = '#fef08a';
  for (let y = 32; y < 512; y += 128) {
    ctx.fillRect(254, y, 4, 6);
  }

  for (let y = 20; y < 512; y += 128) {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(133, y, 5, 64);
    ctx.fillRect(374, y, 5, 64);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(133, y + 86, 5, 6);
    ctx.fillRect(374, y + 86, 5, 6);
  }

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.anisotropy = maxAnisotropy;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = 256;
  rCanvas.height = 256;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.fillStyle = '#c2c2c2';
  rCtx.fillRect(0, 0, 256, 256);
  rCtx.fillStyle = '#858585';
  for (let i = 0; i < 1600; i++) {
    rCtx.fillRect((i * 53) % 256, (i * 97) % 256, 2, 3);
  }
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { albedoMap, roughnessMap };
}

export function createCityBuildingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 8;
  const rows = 16;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, r * cellH, 512, 5);

    for (let c = 0; c < cols; c++) {
      const hash = ((r * 31 + c * 17) * 73) % 100;
      const wx = c * cellW + 5;
      const wy = r * cellH + 7;
      const ww = cellW - 10;
      const wh = cellH - 10;

      if (hash < 22) {
        ctx.fillStyle = hash < 10 ? '#fde68a' : '#fed7aa';
      } else if (hash < 44) {
        ctx.fillStyle = hash < 32 ? '#bae6fd' : '#7dd3fc';
      } else if (hash < 68) {
        ctx.fillStyle = '#334155';
      } else {
        ctx.fillStyle = '#090d16';
      }
      ctx.fillRect(wx, wy, ww, wh);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSkyBackdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#070b16');
  grad.addColorStop(0.45, '#0f1f3d');
  grad.addColorStop(0.75, '#1e3a5f');
  grad.addColorStop(0.92, '#3b4254');
  grad.addColorStop(1.0, '#182030');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let cachedShadowTexture: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTexture) return cachedShadowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.82)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedShadowTexture = new THREE.CanvasTexture(canvas);
  return cachedShadowTexture;
}

export interface PlayerCarMeshRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Group[];
  wheelStyleGroups: Record<WheelId, THREE.Group[]>;
  activeWheelId: WheelId;
  nitroFlames: THREE.Mesh[];
  shieldBubble: THREE.Mesh;
  paintMaterial: THREE.MeshPhysicalMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  taillightMaterial: THREE.MeshStandardMaterial;
  underglowMesh: THREE.Mesh;
  underglowMaterial: THREE.MeshBasicMaterial;
  stripeDualGroup: THREE.Group;
  stripeCenterGroup: THREE.Group;
  spoilerVariants: Record<SpoilerId, THREE.Object3D>;
  bumperVariants: Record<BumperId, THREE.Object3D>;
  skirtVariants: Record<SkirtId, THREE.Object3D>;
  roofVariants: Record<RoofAccessoryId, THREE.Object3D>;
}

/**
 * Builds a single wheel slot containing switchable 3D wheel & spoke geometries for all 6 WheelIds.
 */
function createSwitchableWheelSlot(
  radius: number,
  width: number,
  caliperColorHex: number,
  isLeftWheel: boolean,
  rimMat: THREE.MeshStandardMaterial
): {
  slotGroup: THREE.Group;
  styleSubgroups: Record<WheelId, THREE.Group>;
} {
  const slotGroup = new THREE.Group();
  const dir = isLeftWheel ? -1 : 1;

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x11151c,
    roughness: 0.85,
    metalness: 0.1,
  });
  const darkHubMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.35,
  });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: caliperColorHex,
    metalness: 0.4,
    roughness: 0.3,
  });

  // Base tire tread cylinder
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI / 2);
  slotGroup.add(new THREE.Mesh(tireGeo, tireMat));

  // Inner brake rotor barrel
  const barrelGeo = new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width * 1.02, 20);
  barrelGeo.rotateZ(Math.PI / 2);
  slotGroup.add(new THREE.Mesh(barrelGeo, darkHubMat));

  // Outer alloy rim lip
  const rimRingGeo = new THREE.TorusGeometry(radius * 0.68, 0.032, 8, 24);
  rimRingGeo.rotateY(Math.PI / 2);
  const rimOut = new THREE.Mesh(rimRingGeo, rimMat);
  rimOut.position.x = dir * (width * 0.48);
  slotGroup.add(rimOut);

  // Brake caliper highlight
  const calGeo = new THREE.BoxGeometry(width * 0.9, radius * 0.45, radius * 0.32);
  const calMesh = new THREE.Mesh(calGeo, caliperMat);
  calMesh.position.set(0, radius * 0.32, -radius * 0.25);
  slotGroup.add(calMesh);

  const styleSubgroups = {} as Record<WheelId, THREE.Group>;
  const wheelIds = Object.keys(WHEEL_CONFIGS) as WheelId[];

  for (const wId of wheelIds) {
    const sg = new THREE.Group();
    const cfg = WHEEL_CONFIGS[wId];

    if (cfg.spokeStyle === 'five_star') {
      const spokeGeo = new THREE.BoxGeometry(0.03, radius * 1.28, 0.058);
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.x = dir * (width * 0.46);
        spoke.rotation.x = (s * Math.PI) / 5;
        sg.add(spoke);
      }
    } else if (cfg.spokeStyle === 'twin_spoke') {
      const spokeGeo = new THREE.BoxGeometry(0.028, radius * 1.3, 0.032);
      for (let s = 0; s < 5; s++) {
        for (const offsetAngle of [-0.09, 0.09]) {
          const spoke = new THREE.Mesh(spokeGeo, rimMat);
          spoke.position.x = dir * (width * 0.47);
          spoke.rotation.x = (s * Math.PI) / 5 + offsetAngle;
          sg.add(spoke);
        }
      }
    } else if (cfg.spokeStyle === 'multi_mesh') {
      const spokeGeo = new THREE.BoxGeometry(0.024, radius * 1.32, 0.024);
      for (let s = 0; s < 8; s++) {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.x = dir * (width * 0.47);
        spoke.rotation.x = (s * Math.PI) / 8;
        sg.add(spoke);
      }
    } else if (cfg.spokeStyle === 'aero_ring') {
      // Aero carbon fan ring + turbine blades
      const aeroRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.52, 0.06, 8, 20),
        darkHubMat
      );
      aeroRing.rotation.y = Math.PI / 2;
      aeroRing.position.x = dir * (width * 0.48);
      sg.add(aeroRing);

      const bladeGeo = new THREE.BoxGeometry(0.03, radius * 1.25, 0.055);
      for (let s = 0; s < 6; s++) {
        const blade = new THREE.Mesh(bladeGeo, rimMat);
        blade.position.x = dir * (width * 0.49);
        blade.rotation.x = (s * Math.PI) / 6;
        sg.add(blade);
      }
    } else if (cfg.spokeStyle === 'forged_luxury') {
      const spokeGeo = new THREE.BoxGeometry(0.035, radius * 1.3, 0.07);
      for (let s = 0; s < 7; s++) {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.x = dir * (width * 0.47);
        spoke.rotation.x = (s * Math.PI) / 7;
        sg.add(spoke);
      }
      const centerCap = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, 0.04, 16),
        rimMat
      );
      centerCap.rotation.z = Math.PI / 2;
      centerCap.position.x = dir * (width * 0.5);
      sg.add(centerCap);
    } else {
      // 'beadlock_slick': Motorsport center-lock with colored sidewall stripe ring
      const slickRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.84, 0.018, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      slickRing.rotation.y = Math.PI / 2;
      slickRing.position.x = dir * (width * 0.51);
      sg.add(slickRing);

      const spokeGeo = new THREE.BoxGeometry(0.032, radius * 1.28, 0.045);
      for (let s = 0; s < 6; s++) {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.x = dir * (width * 0.46);
        spoke.rotation.x = (s * Math.PI) / 6;
        sg.add(spoke);
      }
      const centerLockNut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12),
        caliperMat
      );
      centerLockNut.rotation.z = Math.PI / 2;
      centerLockNut.position.x = dir * (width * 0.51);
      sg.add(centerLockNut);
    }

    sg.visible = wId === 'std_alloy';
    slotGroup.add(sg);
    styleSubgroups[wId] = sg;
  }

  return { slotGroup, styleSubgroups };
}

/**
 * Builds genuinely distinct side-profile extruded automotive body shells for all 8 vehicle categories.
 */
function buildProfiledCarBodyShape(
  style: CarBodyStyle
): { lowerShape: THREE.Shape; cabinShape: THREE.Shape; width: number } {
  const lowerShape = new THREE.Shape();
  const cabinShape = new THREE.Shape();

  if (style === 'exotic_supercar') {
    lowerShape.moveTo(-2.2, 0.19);
    lowerShape.lineTo(-2.12, 0.42);
    lowerShape.lineTo(-1.15, 0.67);
    lowerShape.lineTo(1.2, 0.75);
    lowerShape.lineTo(2.14, 0.68);
    lowerShape.lineTo(2.18, 0.24);
    lowerShape.closePath();

    cabinShape.moveTo(-1.25, 0.64);
    cabinShape.lineTo(-0.35, 1.1);
    cabinShape.lineTo(0.65, 1.07);
    cabinShape.lineTo(1.65, 0.72);
    cabinShape.closePath();
    return { lowerShape, cabinShape, width: 2.04 };
  }

  if (style === 'track_prototype') {
    // Ultra-low Le Mans / GT3 track prototype with sculpted nose and long tail
    lowerShape.moveTo(-2.26, 0.16);
    lowerShape.lineTo(-2.18, 0.38);
    lowerShape.lineTo(-1.2, 0.62);
    lowerShape.lineTo(1.4, 0.68);
    lowerShape.lineTo(2.22, 0.62);
    lowerShape.lineTo(2.24, 0.2);
    lowerShape.closePath();

    cabinShape.moveTo(-1.05, 0.6);
    cabinShape.lineTo(-0.3, 1.04);
    cabinShape.lineTo(0.45, 1.02);
    cabinShape.lineTo(1.35, 0.66);
    cabinShape.closePath();
    return { lowerShape, cabinShape, width: 2.08 };
  }

  if (style === 'sports_coupe') {
    lowerShape.moveTo(-2.15, 0.22);
    lowerShape.lineTo(-2.08, 0.56);
    lowerShape.lineTo(-0.85, 0.74);
    lowerShape.lineTo(1.35, 0.78);
    lowerShape.lineTo(2.12, 0.72);
    lowerShape.lineTo(2.15, 0.25);
    lowerShape.closePath();

    cabinShape.moveTo(-0.85, 0.72);
    cabinShape.lineTo(-0.15, 1.2);
    cabinShape.lineTo(0.75, 1.16);
    cabinShape.lineTo(1.62, 0.76);
    cabinShape.closePath();
    return { lowerShape, cabinShape, width: 1.96 };
  }

  if (style === 'classic_muscle') {
    // Long flat muscle hood, bold vertical front fascia, fastback rear slope
    lowerShape.moveTo(-2.22, 0.24);
    lowerShape.lineTo(-2.18, 0.72);
    lowerShape.lineTo(-0.75, 0.78);
    lowerShape.lineTo(1.45, 0.82);
    lowerShape.lineTo(2.16, 0.74);
    lowerShape.lineTo(2.18, 0.26);
    lowerShape.closePath();

    cabinShape.moveTo(-0.75, 0.76);
    cabinShape.lineTo(-0.22, 1.24);
    cabinShape.lineTo(0.68, 1.22);
    cabinShape.lineTo(1.78, 0.78);
    cabinShape.closePath();
    return { lowerShape, cabinShape, width: 1.98 };
  }

  if (style === 'offroad_raider') {
    // High-clearance desert raid trophy truck silhouette
    lowerShape.moveTo(-2.18, 0.36);
    lowerShape.lineTo(-2.05, 0.92);
    lowerShape.lineTo(-0.88, 1.02);
    lowerShape.lineTo(1.85, 1.02);
    lowerShape.lineTo(2.12, 0.9);
    lowerShape.lineTo(2.16, 0.38);
    lowerShape.closePath();

    cabinShape.moveTo(-0.88, 1.0);
    cabinShape.lineTo(-0.35, 1.56);
    cabinShape.lineTo(0.75, 1.56);
    cabinShape.lineTo(0.95, 1.0);
    cabinShape.closePath();
    return { lowerShape, cabinShape, width: 2.12 };
  }

  if (style === 'luxury_suv') {
    lowerShape.moveTo(-2.2, 0.28);
    lowerShape.lineTo(-2.14, 0.86);
    lowerShape.lineTo(-0.95, 0.96);
    lowerShape.lineTo(1.95, 0.98);
    lowerShape.lineTo(2.18, 0.88);
    lowerShape.lineTo(2.2, 0.3);
    lowerShape.closePath();

    cabinShape.moveTo(-0.98, 0.94);
    cabinShape.lineTo(-0.35, 1.54);
    cabinShape.lineTo(1.65, 1.5);
    cabinShape.lineTo(2.05, 0.96);
    cabinShape.closePath();
    return { lowerShape, cabinShape, width: 2.1 };
  }

  if (style === 'sport_sedan') {
    // Three-box 4-door executive sport saloon with distinct rear trunk deck
    lowerShape.moveTo(-2.14, 0.22);
    lowerShape.lineTo(-2.06, 0.58);
    lowerShape.lineTo(-0.95, 0.76);
    lowerShape.lineTo(1.5, 0.82);
    lowerShape.lineTo(2.14, 0.78);
    lowerShape.lineTo(2.16, 0.25);
    lowerShape.closePath();

    cabinShape.moveTo(-0.95, 0.74);
    cabinShape.lineTo(-0.32, 1.28);
    cabinShape.lineTo(0.92, 1.26);
    cabinShape.lineTo(1.48, 0.8);
    cabinShape.closePath();
    return { lowerShape, cabinShape, width: 1.95 };
  }

  // Default: 'electric_sedan'
  lowerShape.moveTo(-2.14, 0.22);
  lowerShape.lineTo(-2.06, 0.54);
  lowerShape.lineTo(-1.05, 0.74);
  lowerShape.lineTo(1.45, 0.8);
  lowerShape.lineTo(2.12, 0.74);
  lowerShape.lineTo(2.14, 0.25);
  lowerShape.closePath();

  cabinShape.moveTo(-1.1, 0.72);
  cabinShape.lineTo(-0.28, 1.24);
  cabinShape.lineTo(0.88, 1.21);
  cabinShape.lineTo(1.85, 0.78);
  cabinShape.closePath();
  return { lowerShape, cabinShape, width: 1.94 };
}

function extrudeSideProfileToCarGeometry(
  shape: THREE.Shape,
  carWidth: number,
  bevelSize: number
): THREE.BufferGeometry {
  const depth = carWidth - bevelSize * 2;
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 3,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildPlayerCarMesh(config: CarConfig): PlayerCarMeshRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const { lowerShape, cabinShape, width: hullWidth } = buildProfiledCarBodyShape(
    config.bodyStyle
  );

  // 1. Grounded Contact Shadow Plane & Optional Neon Underglow Plane
  const shadowGeo = new THREE.PlaneGeometry(hullWidth * 1.32, 4.9);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    })
  );
  shadowMesh.position.y = 0.015;
  root.add(shadowMesh);

  const underglowGeo = new THREE.PlaneGeometry(hullWidth * 1.18, 4.35);
  underglowGeo.rotateX(-Math.PI / 2);
  const underglowMaterial = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMaterial);
  underglowMesh.position.y = 0.025;
  underglowMesh.visible = false;
  root.add(underglowMesh);

  // 2. Automotive Clearcoat Paint, Rim, Carbon Trim, and Glass Materials
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: config.primaryColor,
    metalness: 0.75,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.88,
    roughness: 0.18,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x11151f,
    metalness: 0.3,
    roughness: 0.75,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.95,
    roughness: 0.12,
  });

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.3,
  });

  const windowGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x090e17,
    metalness: 0.92,
    roughness: 0.06,
    clearcoat: 1.0,
  });

  const accentLightMat = new THREE.MeshStandardMaterial({
    color: config.accentColor,
    emissive: config.accentColor,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xbae6fd,
    emissiveIntensity: 2.6,
  });

  const taillightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xef4444,
    emissiveIntensity: 2.5,
    roughness: 0.2,
  });

  // 3. Sculpted Lower Body Shell & Greenhouse Cabin
  const lowerHullGeo = extrudeSideProfileToCarGeometry(lowerShape, hullWidth * 0.92, 0.09);
  const lowerHullMesh = new THREE.Mesh(lowerHullGeo, paintMaterial);
  lowerHullMesh.castShadow = true;
  lowerHullMesh.receiveShadow = true;
  bodyGroup.add(lowerHullMesh);

  const cabinWidth =
    config.bodyStyle === 'exotic_supercar' || config.bodyStyle === 'track_prototype'
      ? hullWidth * 0.7
      : hullWidth * 0.8;
  const cabinGeo = extrudeSideProfileToCarGeometry(cabinShape, cabinWidth, 0.07);
  const cabinMesh = new THREE.Mesh(cabinGeo, windowGlassMat);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  // Painted Roof Cap
  const roofCapY =
    config.bodyStyle === 'luxury_suv' || config.bodyStyle === 'offroad_raider'
      ? 1.54
      : config.bodyStyle === 'exotic_supercar'
        ? 1.11
        : config.bodyStyle === 'track_prototype'
          ? 1.05
          : 1.24;
  const roofCapLen =
    config.bodyStyle === 'luxury_suv'
      ? 1.95
      : config.bodyStyle === 'offroad_raider'
        ? 1.12
        : 1.05;
  const roofCapZ =
    config.bodyStyle === 'luxury_suv'
      ? 0.62
      : config.bodyStyle === 'offroad_raider'
        ? 0.2
        : 0.28;
  const roofCapMesh = new THREE.Mesh(
    new THREE.BoxGeometry(cabinWidth * 0.9, 0.045, roofCapLen),
    paintMaterial
  );
  roofCapMesh.position.set(0, roofCapY, roofCapZ);
  bodyGroup.add(roofCapMesh);

  // 4. Category-Specific Signature Silhouette Hardware (Makes all 8 cars immediately distinguishable!)
  if (config.bodyStyle === 'classic_muscle') {
    // Towering Chrome V8 Supercharger Hood Blower + Triple Intake Bugcatcher
    const blowerBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.16, 0.58),
      chromeMat
    );
    blowerBase.position.set(0, 0.84, -1.25);
    const blowerScoop = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.12, 0.42),
      carbonMat
    );
    blowerScoop.position.set(0, 0.95, -1.3);
    bodyGroup.add(blowerBase, blowerScoop);

    // Chrome muscle front & rear bumper bars
    const chromeBumperGeo = new THREE.BoxGeometry(hullWidth * 0.98, 0.11, 0.12);
    const frontChrome = new THREE.Mesh(chromeBumperGeo, chromeMat);
    frontChrome.position.set(0, 0.34, -2.26);
    const rearChrome = new THREE.Mesh(chromeBumperGeo, chromeMat);
    rearChrome.position.set(0, 0.38, 2.24);
    bodyGroup.add(frontChrome, rearChrome);
  } else if (config.bodyStyle === 'offroad_raider') {
    // Tubular Off-Road Front Bullbar & Rear Bed Roll-Cage + Angled Spare Wheel Carrier
    const bullbarTop = new THREE.Mesh(
      new THREE.BoxGeometry(hullWidth * 0.72, 0.06, 0.12),
      carbonMat
    );
    bullbarTop.position.set(0, 0.76, -2.25);
    bodyGroup.add(bullbarTop);

    // Rear bed roll-bars
    const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8);
    barGeo.rotateX(Math.PI / 4);
    for (const side of [-1, 1]) {
      const rollBar = new THREE.Mesh(barGeo, carbonMat);
      rollBar.position.set(side * (cabinWidth * 0.42), 1.28, 1.32);
      bodyGroup.add(rollBar);
    }

    // Rear bed mounted full-size offroad spare tire
    const spareTire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.26, 18),
      new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.85 })
    );
    spareTire.rotation.x = Math.PI / 3;
    spareTire.position.set(0, 1.08, 1.55);
    bodyGroup.add(spareTire);
  } else if (config.bodyStyle === 'track_prototype') {
    // Le Mans Prototype central carbon dorsal shark-fin stabilizer
    const sharkFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.36, 1.35),
      carbonMat
    );
    sharkFin.position.set(0, 0.96, 1.22);
    bodyGroup.add(sharkFin);

    // Front wheel-arch downforce louvers
    const louverGeo = new THREE.BoxGeometry(0.28, 0.04, 0.45);
    for (const side of [-1, 1]) {
      const louver = new THREE.Mesh(louverGeo, carbonMat);
      louver.position.set(side * (hullWidth * 0.38), 0.64, -1.3);
      bodyGroup.add(louver);
    }
  } else if (config.bodyStyle === 'sport_sedan') {
    // 4-door saloon B-pillar divider & front intercooler mesh frame
    const intercooler = new THREE.Mesh(
      new THREE.BoxGeometry(hullWidth * 0.48, 0.16, 0.09),
      chromeMat
    );
    intercooler.position.set(0, 0.28, -2.25);
    bodyGroup.add(intercooler);
  }

  // 5. Racing Stripes (Dual Le Mans or Center Apex Stripe)
  const stripeDualGroup = new THREE.Group();
  const dualGeo = new THREE.BoxGeometry(0.16, 0.02, 1.35);
  for (const sx of [-0.22, 0.22]) {
    const frontStripe = new THREE.Mesh(dualGeo, stripeMat);
    frontStripe.position.set(sx, 0.76, -1.35);
    frontStripe.rotation.x = 0.14;
    const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, roofCapLen), stripeMat);
    roofStripe.position.set(sx, roofCapY + 0.025, roofCapZ);
    stripeDualGroup.add(frontStripe, roofStripe);
  }
  stripeDualGroup.visible = false;
  bodyGroup.add(stripeDualGroup);

  const stripeCenterGroup = new THREE.Group();
  const centerFront = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 1.35), accentLightMat);
  centerFront.position.set(0, 0.76, -1.35);
  centerFront.rotation.x = 0.14;
  const centerRoof = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.02, roofCapLen),
    accentLightMat
  );
  centerRoof.position.set(0, roofCapY + 0.025, roofCapZ);
  stripeCenterGroup.add(centerFront, centerRoof);
  stripeCenterGroup.visible = false;
  bodyGroup.add(stripeCenterGroup);

  // 6. Muscular Wheel Arch Fenders
  const fenderRadius =
    config.bodyStyle === 'luxury_suv' || config.bodyStyle === 'offroad_raider' ? 0.44 : 0.38;
  const fenderArchGeo = new THREE.CylinderGeometry(
    fenderRadius,
    fenderRadius,
    hullWidth * 1.02,
    18,
    1,
    false,
    0,
    Math.PI
  );
  fenderArchGeo.rotateZ(Math.PI / 2);
  const frontArch = new THREE.Mesh(fenderArchGeo, paintMaterial);
  frontArch.position.set(0, 0.36, -1.32);
  const rearArch = new THREE.Mesh(fenderArchGeo, paintMaterial);
  rearArch.position.set(0, 0.38, 1.32);
  bodyGroup.add(frontArch, rearArch);

  // 7. Switchable Body Accessories (Spoilers, Front Bumpers, Side Skirts, Roof Accessories)
  // A. SPOILERS
  const spoilerStock = new THREE.Group();
  if (config.bodyStyle === 'sports_coupe' || config.bodyStyle === 'exotic_supercar' || config.bodyStyle === 'track_prototype') {
    const stockWing = new THREE.Mesh(
      new THREE.BoxGeometry(hullWidth * 0.9, 0.045, 0.26),
      carbonMat
    );
    stockWing.position.set(0, 0.96, 2.02);
    spoilerStock.add(stockWing);
  } else {
    const stockLip = new THREE.Mesh(
      new THREE.BoxGeometry(hullWidth * 0.82, 0.06, 0.2),
      paintMaterial
    );
    stockLip.position.set(0, 0.84, 2.1);
    spoilerStock.add(stockLip);
  }
  bodyGroup.add(spoilerStock);

  const spoilerStreet = new THREE.Group();
  const streetDucktail = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 0.88, 0.09, 0.26),
    carbonMat
  );
  streetDucktail.position.set(0, 0.88, 2.12);
  streetDucktail.rotation.x = 0.28;
  spoilerStreet.add(streetDucktail);
  spoilerStreet.visible = false;
  bodyGroup.add(spoilerStreet);

  const spoilerGtWing = new THREE.Group();
  const gtWingY = config.bodyStyle === 'luxury_suv' ? 1.58 : 1.06;
  const gtBlade = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 0.98, 0.05, 0.34),
    carbonMat
  );
  gtBlade.position.set(0, gtWingY, 2.04);
  gtBlade.rotation.x = 0.16;
  spoilerGtWing.add(gtBlade);
  for (const side of [-1, 1]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.4), paintMaterial);
    ep.position.set(side * hullWidth * 0.49, gtWingY - 0.02, 2.04);
    const py = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.22), carbonMat);
    py.position.set(side * 0.36, gtWingY - 0.14, 1.98);
    spoilerGtWing.add(ep, py);
  }
  spoilerGtWing.visible = false;
  bodyGroup.add(spoilerGtWing);

  const spoilerTrackHigh = new THREE.Group();
  const highY = 1.18;
  const mainPlane = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.06, 0.05, 0.38),
    carbonMat
  );
  mainPlane.position.set(0, highY, 2.08);
  mainPlane.rotation.x = 0.2;
  const upperFlap = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.04, 0.035, 0.18),
    accentLightMat
  );
  upperFlap.position.set(0, highY + 0.08, 2.16);
  upperFlap.rotation.x = 0.32;
  spoilerTrackHigh.add(mainPlane, upperFlap);
  for (const side of [-1, 1]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.48), paintMaterial);
    ep.position.set(side * hullWidth * 0.53, highY - 0.04, 2.08);
    const py = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.26), carbonMat);
    py.position.set(side * 0.38, highY - 0.22, 1.98);
    spoilerTrackHigh.add(ep, py);
  }
  spoilerTrackHigh.visible = false;
  bodyGroup.add(spoilerTrackHigh);

  // B. FRONT BUMPERS / SPLITTERS
  const bumperStock = new THREE.Group();
  const baseChin = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 0.98, 0.06, 0.35),
    carbonMat
  );
  baseChin.position.set(0, 0.21, -2.12);
  bumperStock.add(baseChin);
  bodyGroup.add(bumperStock);

  const bumperCanard = new THREE.Group();
  const canardLip = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.04, 0.07, 0.45),
    carbonMat
  );
  canardLip.position.set(0, 0.2, -2.18);
  bumperCanard.add(canardLip);
  for (const side of [-1, 1]) {
    const divePlane = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 0.32),
      paintMaterial
    );
    divePlane.position.set(side * hullWidth * 0.49, 0.34, -2.1);
    divePlane.rotation.z = side * 0.25;
    bumperCanard.add(divePlane);
  }
  bumperCanard.visible = false;
  bodyGroup.add(bumperCanard);

  const bumperGtPro = new THREE.Group();
  const proSplitter = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.08, 0.06, 0.58),
    carbonMat
  );
  proSplitter.position.set(0, 0.18, -2.24);
  const proAccentEdge = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.08, 0.025, 0.06),
    accentLightMat
  );
  proAccentEdge.position.set(0, 0.2, -2.51);
  bumperGtPro.add(proSplitter, proAccentEdge);
  bumperGtPro.visible = false;
  bodyGroup.add(bumperGtPro);

  // C. SIDE SKIRTS
  const skirtStock = new THREE.Group();
  const stockSill = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.0, 0.06, 2.2),
    carbonMat
  );
  stockSill.position.set(0, 0.21, 0);
  skirtStock.add(stockSill);
  bodyGroup.add(skirtStock);

  const skirtAero = new THREE.Group();
  const aeroBlade = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.06, 0.07, 2.35),
    carbonMat
  );
  aeroBlade.position.set(0, 0.2, 0);
  const aeroTrim = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.07, 0.03, 2.25),
    accentLightMat
  );
  aeroTrim.position.set(0, 0.25, 0);
  skirtAero.add(aeroBlade, aeroTrim);
  skirtAero.visible = false;
  bodyGroup.add(skirtAero);

  const skirtWidebody = new THREE.Group();
  const wideSill = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 1.12, 0.11, 2.4),
    paintMaterial
  );
  wideSill.position.set(0, 0.24, 0);
  skirtWidebody.add(wideSill);
  skirtWidebody.visible = false;
  bodyGroup.add(skirtWidebody);

  // D. ROOF ACCESSORIES
  const roofNone = new THREE.Group();
  bodyGroup.add(roofNone);

  const roofScoop = new THREE.Group();
  const scoopBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.14, 0.68),
    carbonMat
  );
  scoopBox.position.set(0, roofCapY + 0.08, roofCapZ - 0.1);
  const scoopInlet = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.09, 0.08),
    accentLightMat
  );
  scoopInlet.position.set(0, roofCapY + 0.08, roofCapZ - 0.42);
  roofScoop.add(scoopBox, scoopInlet);
  roofScoop.visible = false;
  bodyGroup.add(roofScoop);

  const roofLightbar = new THREE.Group();
  const lightBarFrame = new THREE.Mesh(
    new THREE.BoxGeometry(cabinWidth * 0.78, 0.09, 0.16),
    carbonMat
  );
  lightBarFrame.position.set(0, roofCapY + 0.08, roofCapZ - 0.35);
  const lightBarLeds = new THREE.Mesh(
    new THREE.BoxGeometry(cabinWidth * 0.72, 0.06, 0.18),
    headlightMat
  );
  lightBarLeds.position.set(0, roofCapY + 0.08, roofCapZ - 0.36);
  roofLightbar.add(lightBarFrame, lightBarLeds);
  roofLightbar.visible = false;
  bodyGroup.add(roofLightbar);

  const roofBox = new THREE.Group();
  const cargoPod = new THREE.Mesh(
    new THREE.BoxGeometry(cabinWidth * 0.58, 0.2, 1.15),
    carbonMat
  );
  cargoPod.position.set(0, roofCapY + 0.12, roofCapZ + 0.05);
  roofBox.add(cargoPod);
  roofBox.visible = false;
  bodyGroup.add(roofBox);

  // 8. Rear Diffuser, Wing Mirrors, Front Fascia Grille, Headlights & Sculpted Taillights
  const strakeGeo = new THREE.BoxGeometry(0.03, 0.16, 0.35);
  for (const sx of [-0.55, -0.2, 0.2, 0.55]) {
    const fin = new THREE.Mesh(strakeGeo, carbonMat);
    fin.position.set(sx, 0.24, 2.18);
    bodyGroup.add(fin);
  }

  const mirrorGeo = new THREE.BoxGeometry(0.22, 0.09, 0.14);
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(mirrorGeo, paintMaterial);
    mirror.position.set(side * (hullWidth * 0.49), 0.84, -0.58);
    bodyGroup.add(mirror);
  }

  const frontGrille = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 0.58, 0.22, 0.08),
    carbonMat
  );
  frontGrille.position.set(0, 0.38, -2.25);
  bodyGroup.add(frontGrille);

  const hlGeo = new THREE.BoxGeometry(0.38, 0.09, 0.1);
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, headlightMat);
    hl.position.set(side * (hullWidth * 0.32), 0.5, -2.21);
    hl.rotation.y = side * -0.15;
    bodyGroup.add(hl);
  }

  const rearPanelY =
    config.bodyStyle === 'luxury_suv' || config.bodyStyle === 'offroad_raider' ? 0.78 : 0.6;
  const rearHousing = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 0.86, 0.2, 0.08),
    carbonMat
  );
  rearHousing.position.set(0, rearPanelY, 2.23);
  bodyGroup.add(rearHousing);

  const lightbar = new THREE.Mesh(
    new THREE.BoxGeometry(hullWidth * 0.82, 0.06, 0.09),
    taillightMaterial
  );
  lightbar.position.set(0, rearPanelY + 0.03, 2.25);
  bodyGroup.add(lightbar);

  const podGeo = new THREE.BoxGeometry(0.32, 0.12, 0.1);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, taillightMaterial);
    pod.position.set(side * (hullWidth * 0.29), rearPanelY - 0.01, 2.25);
    bodyGroup.add(pod);
  }

  // 9. Exhaust Outlets & Dynamic Nitro Afterburner Cones
  const exhaustGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.26, 12);
  exhaustGeo.rotateX(Math.PI / 2);

  const outerFlameGeo = new THREE.ConeGeometry(0.15, 1.05, 12);
  outerFlameGeo.rotateX(Math.PI / 2);
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.88,
  });

  const nitroFlames: THREE.Mesh[] = [];
  const exhaustOffsets =
    config.bodyStyle === 'exotic_supercar' || config.bodyStyle === 'track_prototype'
      ? [-0.22, 0.22]
      : [-0.52, 0.52];
  for (const exX of exhaustOffsets) {
    const pipe = new THREE.Mesh(exhaustGeo, chromeMat);
    pipe.position.set(exX, 0.28, 2.26);
    bodyGroup.add(pipe);

    const flame = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    flame.position.set(exX, 0.28, 2.82);
    flame.visible = false;
    bodyGroup.add(flame);
    nitroFlames.push(flame);
  }

  // 10. Four Switchable Alloy Wheel & Brake Caliper Assemblies
  const wheelRadius =
    config.bodyStyle === 'offroad_raider'
      ? 0.42
      : config.bodyStyle === 'luxury_suv'
        ? 0.39
        : 0.35;
  const wheelWidth =
    config.bodyStyle === 'exotic_supercar' || config.bodyStyle === 'track_prototype'
      ? 0.32
      : 0.28;

  const wheels: THREE.Group[] = [];
  const wheelStyleGroups: Record<WheelId, THREE.Group[]> = {
    std_alloy: [],
    sport_twin5: [],
    multi_mesh: [],
    aero_turbine: [],
    luxury_forged: [],
    track_beadlock: [],
  };

  const wheelPositions: [number, number, number, boolean][] = [
    [-hullWidth * 0.46, wheelRadius, -1.32, true],
    [hullWidth * 0.46, wheelRadius, -1.32, false],
    [-hullWidth * 0.46, wheelRadius, 1.32, true],
    [hullWidth * 0.46, wheelRadius, 1.32, false],
  ];

  for (const [wx, wy, wz, isLeft] of wheelPositions) {
    const { slotGroup, styleSubgroups } = createSwitchableWheelSlot(
      wheelRadius,
      wheelWidth,
      config.caliperColor,
      isLeft,
      rimMaterial
    );
    slotGroup.position.set(wx, wy, wz);
    root.add(slotGroup);
    wheels.push(slotGroup);
    (Object.keys(styleSubgroups) as WheelId[]).forEach((wId) => {
      wheelStyleGroups[wId].push(styleSubgroups[wId]);
    });
  }

  // 11. Impact Shield Energy Dome
  const shieldGeo = new THREE.SphereGeometry(2.55, 16, 12);
  shieldGeo.scale(0.52, 0.34, 1.0);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
  shieldBubble.position.set(0, 0.6, 0);
  root.add(shieldBubble);

  return {
    group: root,
    bodyGroup,
    wheels,
    wheelStyleGroups,
    activeWheelId: 'std_alloy',
    nitroFlames,
    shieldBubble,
    paintMaterial,
    rimMaterial,
    taillightMaterial,
    underglowMesh,
    underglowMaterial,
    stripeDualGroup,
    stripeCenterGroup,
    spoilerVariants: {
      spoiler_stock: spoilerStock,
      spoiler_street: spoilerStreet,
      spoiler_gt_wing: spoilerGtWing,
      spoiler_track_high: spoilerTrackHigh,
    },
    bumperVariants: {
      bumper_stock: bumperStock,
      bumper_canard: bumperCanard,
      bumper_gt_pro: bumperGtPro,
    },
    skirtVariants: {
      skirt_stock: skirtStock,
      skirt_aero: skirtAero,
      skirt_widebody: skirtWidebody,
    },
    roofVariants: {
      roof_none: roofNone,
      roof_scoop: roofScoop,
      roof_lightbar: roofLightbar,
      roof_box: roofBox,
    },
  };
}

/**
 * Applies a player's saved or previewed customization state directly to the 3D PlayerCarMeshRig.
 */
export function applyCarCustomizationToRig(
  rig: PlayerCarMeshRig,
  config: CarConfig,
  cust: CarCustomizationState
): void {
  // 1. Paint Color & Finish
  const paintPreset = PAINT_PRESETS.find((p) => p.id === cust.paintId);
  const paintHex =
    cust.paintId === 'paint_factory' || !paintPreset
      ? config.primaryColor
      : paintPreset.colorInt;
  const finishCfg = PAINT_FINISHES[cust.paintFinish] ?? PAINT_FINISHES.gloss;

  rig.paintMaterial.color.setHex(paintHex);
  rig.paintMaterial.metalness = finishCfg.metalness;
  rig.paintMaterial.roughness = finishCfg.roughness;
  rig.paintMaterial.clearcoat = finishCfg.clearcoat;
  rig.paintMaterial.clearcoatRoughness = finishCfg.clearcoatRoughness;
  rig.paintMaterial.needsUpdate = true;

  // 2. Wheel Rim Color & 3D Spoke Geometry
  const rimColorCfg = WHEEL_COLORS.find((wc) => wc.id === cust.wheelColorId);
  rig.rimMaterial.color.setHex(rimColorCfg ? rimColorCfg.colorInt : 0xe2e8f0);

  const targetWheelId = cust.wheelId in rig.wheelStyleGroups ? cust.wheelId : 'std_alloy';
  rig.activeWheelId = targetWheelId;
  (Object.keys(rig.wheelStyleGroups) as WheelId[]).forEach((wId) => {
    const visible = wId === targetWheelId;
    for (const grp of rig.wheelStyleGroups[wId]) {
      grp.visible = visible;
    }
  });

  // 3. Stripes & Livery
  rig.stripeDualGroup.visible = cust.stripeId === 'stripe_dual';
  rig.stripeCenterGroup.visible = cust.stripeId === 'stripe_center';

  // 4. Underglow Neon
  const glowCfg = UNDERGLOW_OPTIONS[cust.underglowId] ?? UNDERGLOW_OPTIONS.glow_none;
  if (glowCfg.id === 'glow_none') {
    rig.underglowMesh.visible = false;
  } else {
    rig.underglowMesh.visible = true;
    rig.underglowMaterial.color.setHex(glowCfg.colorInt);
  }

  // 5. Spoilers, Bumpers, Skirts, and Roof Accessories
  (Object.keys(rig.spoilerVariants) as SpoilerId[]).forEach((id) => {
    rig.spoilerVariants[id].visible = id === cust.spoilerId;
  });
  (Object.keys(rig.bumperVariants) as BumperId[]).forEach((id) => {
    rig.bumperVariants[id].visible = id === cust.bumperId;
  });
  (Object.keys(rig.skirtVariants) as SkirtId[]).forEach((id) => {
    rig.skirtVariants[id].visible = id === cust.skirtId;
  });
  (Object.keys(rig.roofVariants) as RoofAccessoryId[]).forEach((id) => {
    rig.roofVariants[id].visible = id === cust.roofId;
  });
}

export type TrafficArchetype = 'sedan' | 'suv' | 'sport' | 'truck';

export function buildTrafficVehicleMesh(
  archetype: TrafficArchetype,
  colorHex: number
): THREE.Group {
  const group = new THREE.Group();

  const shadowGeo = new THREE.PlaneGeometry(2.4, 4.9);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );
  shadowMesh.position.y = 0.015;
  group.add(shadowMesh);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    metalness: 0.62,
    roughness: 0.26,
    clearcoat: 0.85,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b111e,
    metalness: 0.9,
    roughness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x181f2c,
    roughness: 0.8,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2a4b,
    emissive: 0xef4444,
    emissiveIntensity: 2.3,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 1.8,
  });

  if (archetype === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.9, 1.9), bodyMat);
    cab.position.set(0, 1.15, -1.9);
    cab.castShadow = true;

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 0.1), glassMat);
    windshield.position.set(0, 1.55, -2.86);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 2.55, 4.4),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.45,
        metalness: 0.25,
      })
    );
    cargoBox.position.set(0, 1.55, 1.35);
    cargoBox.castShadow = true;

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 6.2), trimMat);
    chassis.position.set(0, 0.35, 0.2);

    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.12), tailMat);
    tailBar.position.set(0, 0.55, 3.56);

    group.add(cab, windshield, cargoBox, chassis, tailBar);
  } else {
    const style =
      archetype === 'suv'
        ? 'luxury_suv'
        : archetype === 'sport'
          ? 'sports_coupe'
          : 'electric_sedan';
    const { lowerShape, cabinShape, width } = buildProfiledCarBodyShape(style);
    const lowerGeo = extrudeSideProfileToCarGeometry(lowerShape, width * 0.9, 0.08);
    const cabinGeo = extrudeSideProfileToCarGeometry(cabinShape, width * 0.78, 0.06);

    const lowerMesh = new THREE.Mesh(lowerGeo, bodyMat);
    lowerMesh.castShadow = true;
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.castShadow = true;

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.8, 0.12, 0.1),
      tailMat
    );
    tail.position.set(0, 0.62, 2.22);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.76, 0.1, 0.1),
      headMat
    );
    head.position.set(0, 0.48, -2.2);

    group.add(lowerMesh, cabinMesh, tail, head);
  }

  const wGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14);
  wGeo.rotateZ(Math.PI / 2);
  const zOffsets = archetype === 'truck' ? [-2.0, 1.2, 2.6] : [-1.3, 1.3];
  for (const wz of zOffsets) {
    for (const wx of [-0.95, 0.95]) {
      const w = new THREE.Mesh(wGeo, trimMat);
      w.position.set(wx, 0.34, wz);
      group.add(w);
    }
  }

  return group;
}

export function buildCoinCollectibleMesh(): THREE.Group {
  const group = new THREE.Group();

  const ringGeo = new THREE.TorusGeometry(0.54, 0.14, 12, 24);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.75,
    metalness: 0.9,
    roughness: 0.15,
  });
  const coreGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20);
  coreGeo.rotateX(Math.PI / 2);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.0,
    metalness: 0.85,
    roughness: 0.2,
  });

  group.add(new THREE.Mesh(ringGeo, goldMat), new THREE.Mesh(coreGeo, coreMat));
  return group;
}

/**
 * Builds a 3D Start or Checkered Finish Line Overhead Gantry spanning the 4-lane highway for Levels Mode.
 */
export function buildStartFinishGantryMesh(isFinish: boolean): THREE.Group {
  const group = new THREE.Group();

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.75,
    roughness: 0.3,
  });

  const pillarGeo = new THREE.BoxGeometry(0.65, 6.8, 0.65);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(side * 8.8, 3.4, 0);
    group.add(pillar);
  }

  // Overhead banner canvas texture (Checkered Finish vs Starting Grid)
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  if (isFinish) {
    // Classic high-contrast checkered flag pattern + FINISH text
    const sq = 16;
    for (let y = 0; y < 64; y += sq) {
      for (let x = 0; x < 512; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#f8fafc' : '#0f172a';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    ctx.fillStyle = 'rgba(6, 182, 212, 0.92)';
    ctx.fillRect(156, 8, 200, 48);
    ctx.fillStyle = '#090d16';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FINISH LINE', 256, 33);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, 512, 6);
    ctx.fillRect(0, 58, 512, 6);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STARTING GRID · 6 CARS', 256, 32);
  }

  const bannerTex = new THREE.CanvasTexture(canvas);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  const bannerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(18.2, 1.3, 0.45),
    new THREE.MeshBasicMaterial({ map: bannerTex })
  );
  bannerMesh.position.set(0, 6.2, 0);
  group.add(bannerMesh);

  // Ground start/finish checkered strip painted across the road
  const stripMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(16.2, 1.8),
    new THREE.MeshBasicMaterial({
      map: bannerTex,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  stripMesh.rotation.x = -Math.PI / 2;
  stripMesh.position.y = 0.03;
  group.add(stripMesh);

  return group;
}

/**
 * Builds a high-visibility 3D non-car hazard barrier for Levels Mode courses.
 */
export function buildLevelObstacleMesh(type: LevelHazardType): THREE.Group {
  const group = new THREE.Group();

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
    metalness: 0.4,
  });
  const stripeAmberMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 1.8,
  });
  const cyanBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 2.4,
  });
  const dangerRedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 2.2,
  });

  if (type === 'energy_pylon') {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.35, 16), baseMat);
    pedestal.position.y = 0.18;
    const pylonCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.52, 2.2, 16),
      dangerRedMat
    );
    pylonCore.position.y = 1.25;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 8, 20), cyanBeaconMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.1;
    group.add(pedestal, pylonCore, ring);
  } else if (type === 'chevron_chicane') {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.15, 0.9), baseMat);
    wall.position.y = 0.58;
    const chevronBar = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.36, 0.94), cyanBeaconMat);
    chevronBar.position.y = 0.72;
    group.add(wall, chevronBar);
  } else {
    // 'barrier_block': Heavy concrete jersey barrier with glowing amber hazard stripe & dual beacons
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.05, 0.95), baseMat);
    block.position.y = 0.52;
    const hazardBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.28, 0.32, 0.98),
      stripeAmberMat
    );
    hazardBand.position.y = 0.64;
    for (const bx of [-0.85, 0.85]) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), dangerRedMat);
      beacon.position.set(bx, 1.15, 0);
      group.add(beacon);
    }
    group.add(block, hazardBand);
  }

  return group;
}

/**
 * Builds a realistic modern highway Tunnel Entrance or Exit Portal frame
 * with concrete abutments, safety chevrons, overhead illuminated portal signage,
 * and warm-white threshold floodlights.
 */
export function buildTunnelPortalMesh(isEntrance: boolean): THREE.Group {
  const group = new THREE.Group();
  const halfRoad = 7.2; // HIGHWAY_CONFIG.roadWidth * 0.5

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.58,
    metalness: 0.22,
  });
  const lightConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0x334155,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.18,
  });
  const warmFloodMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef08a,
    emissiveIntensity: 3.4,
  });
  const amberReflectMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 2.2,
  });

  // Left & Right Heavy Concrete Portal Pylons
  const pylonGeo = new THREE.BoxGeometry(2.1, 7.6, 3.2);
  const dadoGeo = new THREE.BoxGeometry(2.22, 2.2, 3.3);
  const stripeGeo = new THREE.BoxGeometry(2.26, 0.28, 3.34);

  for (const side of [-1, 1]) {
    const px = side * (halfRoad + 1.35);
    const pylon = new THREE.Mesh(pylonGeo, concreteMat);
    pylon.position.set(px, 3.8, 0);
    group.add(pylon);

    const dado = new THREE.Mesh(dadoGeo, lightConcreteMat);
    dado.position.set(px, 1.1, 0);
    group.add(dado);

    const stripe = new THREE.Mesh(stripeGeo, amberReflectMat);
    stripe.position.set(px, 1.25, 0);
    group.add(stripe);
  }

  // Overhead Concrete Portal Arch Lintels & Retaining Wall Crown
  const lintelMesh = new THREE.Mesh(new THREE.BoxGeometry(19.6, 2.1, 3.2), concreteMat);
  lintelMesh.position.set(0, 7.15, 0);
  group.add(lintelMesh);

  const crownFascia = new THREE.Mesh(new THREE.BoxGeometry(20.0, 0.42, 3.45), lightConcreteMat);
  crownFascia.position.set(0, 8.25, 0);
  group.add(crownFascia);

  // Portal Illuminated Signboard
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 64;
  const ctx = signCanvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = isEntrance ? '#fbbf24' : '#38bdf8';
  ctx.fillRect(0, 0, 512, 6);
  ctx.fillRect(0, 58, 512, 6);
  ctx.fillStyle = '#fffbeb';
  ctx.font = 'bold 21px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isEntrance ? 'METRO EXPRESS TUNNEL · LIGHTS ON' : 'TUNNEL EXIT · CITY EXPRESSWAY',
    256,
    32
  );
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;

  const signMesh = new THREE.Mesh(
    new THREE.BoxGeometry(14.2, 1.05, 0.25),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signMesh.position.set(0, 7.1, isEntrance ? 1.58 : -1.58);
  group.add(signMesh);

  // Bright Warm-White Portal Threshold Luminaires across the ceiling soffit
  const soffitLightGeo = new THREE.BoxGeometry(2.2, 0.18, 1.4);
  for (const lx of [-4.8, -1.6, 1.6, 4.8]) {
    const lightFixture = new THREE.Mesh(soffitLightGeo, warmFloodMat);
    lightFixture.position.set(lx, 6.04, 0);
    group.add(lightFixture);
  }

  return group;
}

/**
 * Builds a 10-meter modular Illuminated Tunnel Interior Bay (`z: -5m .. +5m`).
 * Features bright ceramic lower wall panels, concrete upper walls, structural support ribs,
 * vaulted roof deck, safety barriers, and bright warm-white ceiling & wall street lighting fixtures
 * so the tunnel interior is always brightly lit and easy to read.
 */
export function buildTunnelInteriorBayMesh(): THREE.Group {
  const group = new THREE.Group();
  const halfRoad = 7.2;
  const bayLen = 10.2; // Slight overlap to prevent any hairline seam between adjacent bays

  // Bright ceramic tiled lower wall dado (warm-white self-illuminated so road edges are bright)
  const ceramicWallMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xfffbeb,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.12,
  });

  // Upper concrete tunnel wall
  const upperWallMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    emissive: 0x64748b,
    emissiveIntensity: 0.38,
    roughness: 0.52,
    metalness: 0.2,
  });

  // Structural arch support rib material
  const ribSteelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x1e293b,
    emissiveIntensity: 0.3,
    roughness: 0.42,
    metalness: 0.55,
  });

  // Ceiling concrete slab material
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    emissive: 0x334155,
    emissiveIntensity: 0.42,
    roughness: 0.55,
    metalness: 0.25,
  });

  // Bright warm-white LED / Sodium-vapor luminaire material
  const warmLuminaireMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef08a,
    emissiveIntensity: 3.6,
  });

  // Neutral-white center ceiling light strip material
  const neutralLuminaireMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 3.2,
  });

  // Roadside safety guide strip
  const guideAmberMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.4,
  });

  const lowerWallGeo = new THREE.BoxGeometry(0.65, 2.5, bayLen);
  const upperWallGeo = new THREE.BoxGeometry(0.65, 3.6, bayLen);
  const guideStripGeo = new THREE.BoxGeometry(0.08, 0.16, bayLen);
  const ribPillarGeo = new THREE.BoxGeometry(0.82, 6.1, 0.55);
  const corniceLightGeo = new THREE.BoxGeometry(0.36, 0.24, 3.8);

  for (const side of [-1, 1]) {
    const wallX = side * (halfRoad + 0.65);

    const lowerWall = new THREE.Mesh(lowerWallGeo, ceramicWallMat);
    lowerWall.position.set(wallX, 1.25, 0);
    group.add(lowerWall);

    const upperWall = new THREE.Mesh(upperWallGeo, upperWallMat);
    upperWall.position.set(wallX, 4.3, 0);
    group.add(upperWall);

    const guideStrip = new THREE.Mesh(guideStripGeo, guideAmberMat);
    guideStrip.position.set(side * (halfRoad + 0.3), 1.15, 0);
    group.add(guideStrip);

    // Structural support columns at Z = -2.5 and Z = +2.5
    for (const rz of [-2.5, 2.5]) {
      const ribPillar = new THREE.Mesh(ribPillarGeo, ribSteelMat);
      ribPillar.position.set(side * (halfRoad + 0.52), 3.05, rz);
      group.add(ribPillar);
    }

    // Dual Warm-White Upper Wall Streetlight Fixtures per bay on both left & right walls
    for (const lz of [-2.5, 2.5]) {
      const fixture = new THREE.Mesh(corniceLightGeo, warmLuminaireMat);
      fixture.position.set(side * (halfRoad - 0.12), 5.68, lz);
      fixture.rotation.z = side * 0.35;
      group.add(fixture);
    }
  }

  // Tunnel Roof Slab & Transverse Support Ribs
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.55, bayLen), ceilingMat);
  roofSlab.position.set(0, 6.25, 0);
  group.add(roofSlab);

  const roofBeamGeo = new THREE.BoxGeometry(16.0, 0.38, 0.58);
  for (const rz of [-2.5, 2.5]) {
    const beam = new THREE.Mesh(roofBeamGeo, ribSteelMat);
    beam.position.set(0, 5.92, rz);
    group.add(beam);
  }

  // Central Ceiling Bright Light Strips
  const centerLightGeo = new THREE.BoxGeometry(1.1, 0.14, 3.9);
  for (const lz of [-2.5, 2.5]) {
    const centerLight = new THREE.Mesh(centerLightGeo, neutralLuminaireMat);
    centerLight.position.set(0, 5.9, lz);
    group.add(centerLight);
  }

  return group;
}

export interface BrokenBridgeJumpMeshRig {
  rootGroup: THREE.Group;
  takeoffRampMesh: THREE.Mesh;
  leftRampGirder: THREE.Mesh;
  rightRampGirder: THREE.Mesh;
  brokenTakeoffEdgeGroup: THREE.Group;
  chasmFloorMesh: THREE.Mesh;
  chasmPiersGroup: THREE.Group;
  landingDeckMesh: THREE.Mesh;
  landingApronMesh: THREE.Mesh;
}

/**
 * Creates a reusable 3D Broken-Bridge & Angled Takeoff Ramp Rig with:
 * - Inclined asphalt/steel takeoff ramp with glowing chevron launch arrows
 * - Side steel truss girders & hazard beacons
 * - Jagged broken bridge edge & exposed steel I-beams over the open chasm
 * - Deep chasm canal floor & concrete bridge support piers below the gap
 * - Receiving bridge platform with sloped landing apron and emerald landing zone markings
 */
export function buildBrokenBridgeJumpMeshRig(): BrokenBridgeJumpMeshRig {
  const rootGroup = new THREE.Group();
  const roadWidth = 14.4;

  // 1. High-contrast Takeoff Ramp Surface Texture (Asphalt + Cyan/Amber Launch Chevrons)
  const rampCanvas = document.createElement('canvas');
  rampCanvas.width = 512;
  rampCanvas.height = 512;
  const rCtx = rampCanvas.getContext('2d')!;
  rCtx.fillStyle = '#1e293b';
  rCtx.fillRect(0, 0, 512, 512);

  // Hazard yellow/black side borders
  for (let y = 0; y < 512; y += 32) {
    rCtx.fillStyle = (y / 32) % 2 === 0 ? '#f59e0b' : '#0f172a';
    rCtx.fillRect(0, y, 24, 32);
    rCtx.fillRect(488, y, 24, 32);
  }

  // Lane dividers
  rCtx.fillStyle = 'rgba(248, 250, 252, 0.5)';
  for (const lx of [136, 256, 376]) {
    rCtx.fillRect(lx - 3, 0, 6, 512);
  }

  // Bright upward launch chevrons across all 4 lanes
  rCtx.strokeStyle = '#38bdf8';
  rCtx.lineWidth = 10;
  for (const cx of [76, 196, 316, 436]) {
    for (let cy = 64; cy < 480; cy += 96) {
      rCtx.beginPath();
      rCtx.moveTo(cx - 32, cy + 24);
      rCtx.lineTo(cx, cy - 18);
      rCtx.lineTo(cx + 32, cy + 24);
      rCtx.stroke();
    }
  }
  // Glowing amber takeoff lip warning bar at the top of the ramp (y = 0..28)
  rCtx.fillStyle = '#f59e0b';
  rCtx.fillRect(24, 0, 464, 26);

  const rampTex = new THREE.CanvasTexture(rampCanvas);
  rampTex.colorSpace = THREE.SRGBColorSpace;

  const rampMat = new THREE.MeshStandardMaterial({
    map: rampTex,
    emissive: 0x0ea5e9,
    emissiveMap: rampTex,
    emissiveIntensity: 0.42,
    roughness: 0.48,
    metalness: 0.25,
  });

  // Unit box geometry that will be scaled/angled dynamically to match each jump's rampLength & rampPeakHeight
  const takeoffRampMesh = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.45, 1), rampMat);
  rootGroup.add(takeoffRampMesh);

  // Side Steel Girders along the inclined ramp
  const girderMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.65,
  });
  const leftRampGirder = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 1), girderMat);
  const rightRampGirder = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 1), girderMat);
  rootGroup.add(leftRampGirder, rightRampGirder);

  // 2. Broken Takeoff Edge & Exposed Steel I-Beams at the lip of the chasm
  const brokenTakeoffEdgeGroup = new THREE.Group();
  const brokenConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.15,
  });
  const rustedBeamMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.5,
    metalness: 0.75,
  });
  const hazardBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 3.0,
  });

  // Exposed longitudinal I-beams jutting out over the open gap
  const ibeamGeo = new THREE.BoxGeometry(0.32, 0.42, 2.8);
  for (const bx of [-6.0, -3.6, -1.2, 1.2, 3.6, 6.0]) {
    const beam = new THREE.Mesh(ibeamGeo, rustedBeamMat);
    beam.position.set(bx, -0.35, -1.1);
    brokenTakeoffEdgeGroup.add(beam);
  }

  // Jagged fractured concrete chunks along the lip
  const chunkGeo = new THREE.BoxGeometry(1.75, 0.65, 0.9);
  for (let c = -3; c <= 3; c++) {
    const chunk = new THREE.Mesh(chunkGeo, brokenConcreteMat);
    chunk.position.set(c * 2.1, -0.25, -0.25 - (Math.abs(c) % 2) * 0.3);
    chunk.rotation.y = (c % 2 === 0 ? 1 : -1) * 0.12;
    brokenTakeoffEdgeGroup.add(chunk);
  }

  // Dual red hazard warning beacons on the ramp lip shoulders
  const beaconGeo = new THREE.SphereGeometry(0.24, 12, 12);
  for (const side of [-1, 1]) {
    const beacon = new THREE.Mesh(beaconGeo, hazardBeaconMat);
    beacon.position.set(side * (roadWidth * 0.5 + 0.35), 0.75, 0);
    brokenTakeoffEdgeGroup.add(beacon);
  }
  rootGroup.add(brokenTakeoffEdgeGroup);

  // 3. Deep Open Chasm Floor & Structural Bridge Piers below the missing section
  const chasmFloorMat = new THREE.MeshStandardMaterial({
    color: 0x040812,
    emissive: 0x082f49,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.7,
  });
  const chasmFloorMesh = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 14, 0.5, 1), chasmFloorMat);
  rootGroup.add(chasmFloorMesh);

  const chasmPiersGroup = new THREE.Group();
  const pierGeo = new THREE.BoxGeometry(1.6, 12.0, 1.8);
  for (const px of [-5.2, 0, 5.2]) {
    const pierFront = new THREE.Mesh(pierGeo, brokenConcreteMat);
    pierFront.position.set(px, -6.0, 0);
    chasmPiersGroup.add(pierFront);
  }
  // Crossbar girder on the support pier
  const crossGirder = new THREE.Mesh(
    new THREE.BoxGeometry(roadWidth + 2.4, 1.1, 2.1),
    rustedBeamMat
  );
  crossGirder.position.set(0, -0.65, 0);
  chasmPiersGroup.add(crossGirder);
  rootGroup.add(chasmPiersGroup);

  // 4. Receiving Bridge Landing Platform & Catch Apron
  const landCanvas = document.createElement('canvas');
  landCanvas.width = 512;
  landCanvas.height = 512;
  const lCtx = landCanvas.getContext('2d')!;
  lCtx.fillStyle = '#1b2230';
  lCtx.fillRect(0, 0, 512, 512);

  // High-visibility emerald/cyan landing zone target stripes on the receiving deck
  lCtx.fillStyle = '#10b981';
  lCtx.fillRect(0, 480, 512, 32);
  lCtx.strokeStyle = '#34d399';
  lCtx.lineWidth = 8;
  for (const cx of [76, 196, 316, 436]) {
    for (let cy = 120; cy < 460; cy += 110) {
      lCtx.beginPath();
      lCtx.moveTo(cx - 28, cy + 20);
      lCtx.lineTo(cx, cy - 16);
      lCtx.lineTo(cx + 28, cy + 20);
      lCtx.stroke();
    }
  }
  const landTex = new THREE.CanvasTexture(landCanvas);
  landTex.colorSpace = THREE.SRGBColorSpace;

  const landMat = new THREE.MeshStandardMaterial({
    map: landTex,
    emissive: 0x059669,
    emissiveMap: landTex,
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0.2,
  });

  const landingDeckMesh = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.45, 1), landMat);
  rootGroup.add(landingDeckMesh);

  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 1.4,
    roughness: 0.4,
    metalness: 0.5,
  });
  const landingApronMesh = new THREE.Mesh(
    new THREE.BoxGeometry(roadWidth + 0.4, 0.9, 2.2),
    apronMat
  );
  rootGroup.add(landingApronMesh);

  rootGroup.visible = false;

  return {
    rootGroup,
    takeoffRampMesh,
    leftRampGirder,
    rightRampGirder,
    brokenTakeoffEdgeGroup,
    chasmFloorMesh,
    chasmPiersGroup,
    landingDeckMesh,
    landingApronMesh,
  };
}

