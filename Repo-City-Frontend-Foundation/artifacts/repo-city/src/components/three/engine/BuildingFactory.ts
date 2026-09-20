import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// BuildingFactory — Procedural architecture library
// 
// In Phase 3, a Building is a Folder, and Files are Floors.
// We generate a "floor slab" geometry. Different languages can have slightly
// different slab geometries (e.g., standard box vs chamfered).
// ─────────────────────────────────────────────────────────────────────────────

export type FloorArchetype = 'standard' | 'glass' | 'industrial' | 'foundation' | 'spire';

export interface BuildingGeomSet {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

function createWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base glass background
  ctx.fillStyle = '#020205';
  ctx.fillRect(0, 0, 256, 256);

  // Window panes
  ctx.fillStyle = '#ffffff';
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      ctx.fillRect(x * 32 + 4, y * 32 + 4, 24, 26);
    }
  }

  // Vertical mullions
  ctx.fillStyle = '#111115';
  for (let x = 0; x < 8; x++) {
    ctx.fillRect(x * 32 - 2, 0, 4, 256);
  }

  // Horizontal bands
  ctx.fillStyle = '#1a1a20';
  for (let y = 0; y < 8; y++) {
    ctx.fillRect(0, y * 32 - 2, 256, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1);
  return tex;
}

let sharedWindowTexture: THREE.CanvasTexture | null = null;
function getWindowTexture() {
  if (!sharedWindowTexture) sharedWindowTexture = createWindowTexture();
  return sharedWindowTexture;
}

let sharedBorderTexture: THREE.CanvasTexture | null = null;
function getBorderTexture() {
  if (!sharedBorderTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4; // 2px inner border
    ctx.strokeRect(0, 0, 128, 128);

    sharedBorderTexture = new THREE.CanvasTexture(canvas);
  }
  return sharedBorderTexture;
}

const _cache = new Map<FloorArchetype, BuildingGeomSet>();

export function getFloorGeomSet(archetype: FloorArchetype): BuildingGeomSet {
  if (_cache.has(archetype)) return _cache.get(archetype)!;

  let geometry: THREE.BufferGeometry;
  let material: THREE.Material | THREE.Material[];

  const tex = getWindowTexture();
  const borderTex = getBorderTexture();

  const topMat = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.1,
    color: 0xffffff,
    emissiveMap: borderTex,
    emissive: 0xffffff,
  });

  let sideMat: THREE.MeshStandardMaterial;

  switch (archetype) {
    case 'glass':
      geometry = new THREE.BoxGeometry(0.95, 1, 0.95);
      geometry.translate(0, 0.5, 0);
      sideMat = new THREE.MeshStandardMaterial({
        roughness: 0.1,
        metalness: 0.9,
        map: tex,
        emissiveMap: borderTex,
        emissive: 0xffffff,
      });
      material = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
      break;

    case 'industrial':
      geometry = new THREE.BoxGeometry(1.05, 1, 1.05);
      geometry.translate(0, 0.5, 0);
      sideMat = new THREE.MeshStandardMaterial({
        roughness: 0.8,
        metalness: 0.2,
        map: tex,
        emissiveMap: borderTex,
        emissive: 0xffffff,
      });
      material = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
      break;

    case 'foundation':
      geometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
      geometry.translate(0, 0.5, 0);
      material = new THREE.MeshStandardMaterial({
        roughness: 1.0,
        metalness: 0.0,
        color: 0x1a1a1d,
        emissiveMap: borderTex,
        emissive: 0xffffff,
      });
      break;

    case 'spire':
      // Using a thin cylinder for the antenna/spire
      geometry = new THREE.CylinderGeometry(0.02, 0.1, 1.0, 8);
      geometry.translate(0, 0.5, 0);
      material = new THREE.MeshStandardMaterial({
        roughness: 0.4,
        metalness: 0.8,
        color: 0x888899,
      });
      break;

    case 'standard':
    default:
      geometry = new THREE.BoxGeometry(1.0, 1, 1.0);
      geometry.translate(0, 0.5, 0);
      sideMat = new THREE.MeshStandardMaterial({
        roughness: 0.5,
        metalness: 0.3,
        map: tex,
        emissiveMap: borderTex,
        emissive: 0xffffff,
      });
      material = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
      break;
  }

  const set = { geometry, material };
  _cache.set(archetype, set);
  return set;
}

export function selectFloorArchetype(language: string, isTest: boolean): FloorArchetype {
  if (isTest) return 'industrial';
  if (language === 'TypeScript' || language === 'TSX') return 'glass';
  if (language === 'Go' || language === 'Rust') return 'industrial';
  return 'standard';
}

export function getFloorColor(language: string, isTest: boolean, risk: string): THREE.Color {
  let base: number;

  if (isTest) {
    base = 0x2e4235; // Muted steel green
  } else if (risk === 'high') {
    base = 0x4a4845; // Warmer grey/concrete
  } else {
    switch (language) {
      case 'TypeScript': base = 0x304045; break; // Dark cyan/grey glass
      case 'TSX': base = 0x30453d; break; // Dark greenish glass
      case 'CSS': base = 0x353a3e; break; // Slate
      case 'JSON': base = 0x404040; break; // Mid-grey
      case 'Python': base = 0x353d36; break; // Olive grey
      case 'Go': base = 0x30353a; break; // Dark steel
      case 'Rust': base = 0x3d3a38; break; // Iron grey
      default: base = 0x3a3a3a; break; // Default grey
    }
  }

  return new THREE.Color(base);
}
