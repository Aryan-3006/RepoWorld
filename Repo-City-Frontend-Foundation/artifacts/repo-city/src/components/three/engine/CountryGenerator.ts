import * as THREE from 'three';
import { SeededRandom } from './SeededRandom';
import { getPlanetPosition, projectPointToSphere } from './coordinates';
import type { CountryData } from '../../../types/planet';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// ─────────────────────────────────────────────────────────────────────────────
// CountryGenerator
//
// Renders repository countries as subtle glowing border lines on the Earth.
// The Earth texture is fully visible through the territory.
//
// IMPORTANT:
//   Country lat/lng now comes from CountryData (explicit, non-random).
//   This ensures countries are always placed on land and never drift.
// ─────────────────────────────────────────────────────────────────────────────

const BORDER_COLOR_IDLE     = 0x2a6e7a; // dim teal
const BORDER_COLOR_SELECTED = 0x00e5ff; // bright cyan
const BORDER_OPACITY_IDLE   = 0.40;
const BORDER_OPACITY_SEL    = 1.0;

export interface CountryPatch {
  lat: number;
  lng: number;
  radius: number;
  shape: THREE.Shape;
  boundaryPoints2D: THREE.Vector2[];
  /** The invisible hit-mesh used for raycasting */
  mesh: THREE.Mesh;
  /** The visible border line */
  borderLine: THREE.LineLoop;
  /** Call to visually highlight / reset the country */
  setSelected(selected: boolean): void;
}

export class CountryGenerator {
  private planetRadius: number;
  public countryGroup: THREE.Group;

  constructor(_scene: THREE.Scene, planetRadius: number) {
    this.planetRadius = planetRadius;
    this.countryGroup = new THREE.Group();
  }

  public generateCountry(country: CountryData, rng: SeededRandom): CountryPatch {
    // Use the explicit lat/lng from CountryData — no longer random
    const lat = country.lat;
    const lng = country.lng;

    // Country size roughly proportional to file count
    const baseRadius = Math.max(14, Math.min(28, Math.sqrt(country.stats.files) * 2.0));

    const { hitMesh, borderLine, shape, boundaryPoints2D } =
      this.createCountryGeometry(lat, lng, baseRadius, rng);

    hitMesh.userData = {
      type:      'country',
      countryId: country.repositoryId,
    };

    this.countryGroup.add(hitMesh);
    this.countryGroup.add(borderLine);

    // Repository label above country centre
    this.addCountryLabel(country, lat, lng);

    const setSelected = (selected: boolean) => {
      const mat = borderLine.material as THREE.LineBasicMaterial;
      mat.color.setHex(selected ? BORDER_COLOR_SELECTED : BORDER_COLOR_IDLE);
      mat.opacity = selected ? BORDER_OPACITY_SEL : BORDER_OPACITY_IDLE;
      mat.needsUpdate = true;
    };

    return {
      lat,
      lng,
      radius: baseRadius,
      shape,
      boundaryPoints2D,
      mesh: hitMesh,
      borderLine,
      setSelected,
    };
  }

  // ── Private geometry helpers ────────────────────────────────────────────────

  private createCountryGeometry(
    lat: number,
    lng: number,
    size: number,
    rng: SeededRandom,
  ) {
    const segments = 52;
    const shape = new THREE.Shape();
    const borderPoints3D: THREE.Vector3[] = [];
    const boundaryPoints2D: THREE.Vector2[] = [];

    // Organic noise on the border radius
    const noise = Array.from({ length: segments }, () => rng.range(0.70, 1.30));
    const smoothed = noise.map((v, i) => {
      const prev = noise[(i - 1 + segments) % segments];
      const next = noise[(i + 1) % segments];
      return prev * 0.2 + v * 0.6 + next * 0.2;
    });

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const r     = size * smoothed[i % segments];
      const x     = Math.cos(angle) * r;
      const y     = Math.sin(angle) * r;

      if (i === 0) shape.moveTo(x, y);
      else          shape.lineTo(x, y);

      if (i < segments) boundaryPoints2D.push(new THREE.Vector2(x, y));

      // Project onto sphere (tiny offset to avoid z-fighting)
      borderPoints3D.push(
        projectPointToSphere(x, y, lat, lng, this.planetRadius * 1.004),
      );
    }

    // ── Border LineLoop ─────────────────────────────────────────────────────
    const lineGeom = new THREE.BufferGeometry().setFromPoints(borderPoints3D);
    const lineMat  = new THREE.LineBasicMaterial({
      color:       BORDER_COLOR_IDLE,
      transparent: true,
      opacity:     BORDER_OPACITY_IDLE,
      depthWrite:  false,
    });
    const borderLine = new THREE.LineLoop(lineGeom, lineMat);

    // ── Invisible ShapeGeometry hit mesh for raycasting ─────────────────────
    const hitGeom = new THREE.ShapeGeometry(shape);
    const positions = hitGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const projected = projectPointToSphere(px, py, lat, lng, this.planetRadius * 1.001);
      positions.setXYZ(i, projected.x, projected.y, projected.z);
    }
    hitGeom.computeVertexNormals();

    const hitMat  = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitMesh = new THREE.Mesh(hitGeom, hitMat);

    return { hitMesh, borderLine, shape, boundaryPoints2D };
  }

  private addCountryLabel(country: CountryData, lat: number, lng: number) {
    const labelPos = getPlanetPosition(lat, lng, this.planetRadius * 1.06);
    const div = document.createElement('div');
    div.className = 'country-label';
    div.textContent = country.name.toUpperCase();
    div.style.cssText = [
      'color: #e0f4ff',
      'font-family: "Space Mono","Courier New",monospace',
      'font-size: 11px',
      'font-weight: bold',
      'letter-spacing: 2.5px',
      'pointer-events: none',
      'text-shadow: 0 0 8px rgba(0,200,255,0.6), 0 1px 2px rgba(0,0,0,0.9)',
      'white-space: nowrap',
    ].join(';');

    const label = new CSS2DObject(div);
    label.position.copy(labelPos);
    this.countryGroup.add(label);
  }
}
