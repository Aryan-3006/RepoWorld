import * as THREE from 'three';
import { SeededRandom } from './SeededRandom';
import { projectPointToSphere, getPlanetPosition } from './coordinates';
import type { CountryData, CityData, BuildingData } from '../../../types/planet';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CountryPatch } from './CountryGenerator';
import {
  getFloorGeomSet,
  selectFloorArchetype,
  getFloorColor,
  type FloorArchetype,
} from './BuildingFactory';

// ─────────────────────────────────────────────────────────────────────────────
// Point-in-polygon (ray-casting)
// ─────────────────────────────────────────────────────────────────────────────

function pointInPolygon(point: THREE.Vector2, vs: THREE.Vector2[]): boolean {
  let inside = false;
  const { x, y } = point;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function sampleInsidePolygon(
  rng: SeededRandom,
  boundary: THREE.Vector2[],
  maxRadius: number,
  maxAttempts = 30,
): THREE.Vector2 {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist  = rng.range(0.05, 0.85) * maxRadius;
    const pt    = new THREE.Vector2(Math.cos(angle) * dist, Math.sin(angle) * dist);
    if (pointInPolygon(pt, boundary)) return pt;
  }
  return new THREE.Vector2(0, 0);
}

function sampleNearCity(
  rng: SeededRandom,
  cityCenter: THREE.Vector2,
  cityRadius: number,
  boundary: THREE.Vector2[],
  maxAttempts = 20,
): THREE.Vector2 {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist  = rng.range(0.5, 1.0) * cityRadius;
    const pt    = new THREE.Vector2(
      cityCenter.x + Math.cos(angle) * dist,
      cityCenter.y + Math.sin(angle) * dist,
    );
    if (pointInPolygon(pt, boundary)) return pt;
  }
  return cityCenter.clone();
}

// ─────────────────────────────────────────────────────────────────────────────

export interface CountryGeometryGroup {
  cityLabels: THREE.Group;
  cityMarkers: THREE.InstancedMesh;
  /** Each mesh represents a specific floor archetype (e.g. glass, industrial) */
  floorMeshes: { mesh: THREE.InstancedMesh; data: Map<number, string> }[];
  roads: THREE.Group;
}

interface PendingFloor {
  position: THREE.Vector3;
  scale:    THREE.Vector3;
  color:    THREE.Color;
  normal:   THREE.Vector3;
  id:       string; // File ID
  archetype: FloorArchetype;
}

interface PendingCityMarker {
  position: THREE.Vector3;
  normal:   THREE.Vector3;
  id:       string;
}

export class CityGenerator {
  private planet: { radius: number };
  private dummy = new THREE.Object3D();

  public fileIdToPosition   = new Map<string, THREE.Vector3>();
  public fileIdToCountryId  = new Map<string, string>();
  public fileIdToBuildingId = new Map<string, string>();
  public fileIdToInstance   = new Map<string, { mesh: THREE.InstancedMesh; instanceId: number; baseColor: THREE.Color }>();
  public buildingIdToPosition = new Map<string, THREE.Vector3>();
  public districtIdToPosition = new Map<string, THREE.Vector3>();
  public cityIdToPosition = new Map<string, THREE.Vector3>();

  constructor(_scene: THREE.Scene, planetRadius: number) {
    this.planet = { radius: planetRadius };
  }

  public generateForCountry(
    country: CountryData,
    center: CountryPatch,
    rng: SeededRandom,
  ): CountryGeometryGroup {
    const buckets = new Map<FloorArchetype, PendingFloor[]>();
    const cityMarkerPending: PendingCityMarker[] = [];
    const cityLabels = new THREE.Group();
    const roads = new THREE.Group();

    // ── Create tangent plane for the architectural site ──
    const centerPos3D = getPlanetPosition(center.lat, center.lng, this.planet.radius);
    const normal = centerPos3D.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
    if (tangent.lengthSq() < 0.001) {
      tangent = new THREE.Vector3(1, 0, 0);
    }
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    // Helper to map flat (x, y) to 3D tangent plane
    const projectFlat = (x: number, y: number) => {
      return centerPos3D.clone()
        .add(tangent.clone().multiplyScalar(x))
        .add(bitangent.clone().multiplyScalar(y));
    };

    const cityCount = country.cities.length;
    const cityGridSize = Math.ceil(Math.sqrt(cityCount));
    const citySpacing = 12.0;

    for (let c = 0; c < cityCount; c++) {
      const city = country.cities[c];
      const cx = ((c % cityGridSize) - (cityGridSize - 1) / 2) * citySpacing;
      const cy = (Math.floor(c / cityGridSize) - (cityGridSize - 1) / 2) * citySpacing;

      const cityPos3D = projectFlat(cx, cy);
      this.cityIdToPosition.set(city.id, cityPos3D);
      cityMarkerPending.push({ position: cityPos3D, normal, id: city.id });

      // Add city label slightly higher
      this.addCityLabel(city, cityPos3D, normal, cityLabels);

      const distCount = city.districts.length;
      const distGridSize = Math.ceil(Math.sqrt(distCount));
      const distSpacing = 6.0;

      for (let d = 0; d < distCount; d++) {
        const district = city.districts[d];
        const dx = cx + ((d % distGridSize) - (distGridSize - 1) / 2) * distSpacing;
        const dy = cy + (Math.floor(d / distGridSize) - (distGridSize - 1) / 2) * distSpacing;

        const distPos3D = projectFlat(dx, dy);
        this.districtIdToPosition.set(district.id, distPos3D);

        const buildCount = district.buildings.length;
        const buildGridSize = Math.ceil(Math.sqrt(buildCount));
        const buildSpacing = 1.6;

        for (let b = 0; b < buildCount; b++) {
          const building = district.buildings[b];
          const bx = dx + ((b % buildGridSize) - (buildGridSize - 1) / 2) * buildSpacing;
          const by = dy + (Math.floor(b / buildGridSize) - (buildGridSize - 1) / 2) * buildSpacing;

          const buildingPos3D = projectFlat(bx, by);
          this.buildingIdToPosition.set(building.id, buildingPos3D);

          // ── Building Foundation ──
          const maxFoot = Math.max(...building.files.map(f => this.calcFootprint(f.size)));
          const foundationHeight = 0.2;
          
          if (!buckets.has('foundation')) buckets.set('foundation', []);
          buckets.get('foundation')!.push({
            position: buildingPos3D,
            scale: new THREE.Vector3(maxFoot + 0.1, foundationHeight, maxFoot + 0.1),
            color: new THREE.Color(0x1a1a1d),
            normal: normal,
            id: building.id + '-base',
            archetype: 'foundation',
          });

          // ── Stack files as floors inside this building ──────────────────
          let currentElevation = foundationHeight;
          const gap = 0; // Removed gap for monolithic look

          // Sort files by size descending (largest at bottom)
          const sortedFiles = [...building.files].sort((a, b) => b.size - a.size);

          for (const file of sortedFiles) {
            const arch = selectFloorArchetype(file.language, file.isTest);
            const height = this.calcHeight(file.lines);
            const foot = this.calcFootprint(file.size);

            const color = getFloorColor(file.language, file.isTest, file.risk);
            const hueShift = (rng.next() - 0.5) * 0.05;
            const lumShift = (rng.next() - 0.5) * 0.15; // Dynamic luminance
            color.offsetHSL(hueShift, 0, lumShift);

            const floorPos = buildingPos3D.clone().addScaledVector(normal, currentElevation);

            if (!buckets.has(arch)) buckets.set(arch, []);
            buckets.get(arch)!.push({
              position: floorPos,
              scale: new THREE.Vector3(foot, height, foot),
              color,
              normal,
              id: file.id,
              archetype: arch,
            });

            this.fileIdToPosition.set(file.id, floorPos);
            this.fileIdToCountryId.set(file.id, country.repositoryId);
            this.fileIdToBuildingId.set(file.id, building.id);

            currentElevation += height + gap;
          }

          // ── Add Spire ──
          if (sortedFiles.length > 0) {
            if (!buckets.has('spire')) buckets.set('spire', []);
            const spireHeight = 1.0;
            buckets.get('spire')!.push({
              position: buildingPos3D.clone().addScaledVector(normal, currentElevation),
              scale: new THREE.Vector3(1, spireHeight, 1),
              color: new THREE.Color(0x888888),
              normal: normal,
              id: building.id + '-spire',
              archetype: 'spire',
            });
          }
        }
      }
    }

    const floorMeshes: { mesh: THREE.InstancedMesh; data: Map<number, string> }[] = [];
    for (const [arch, pending] of buckets) {
      if (pending.length === 0) continue;
      floorMeshes.push(this.buildInstanced(arch, pending));
    }

    const cityMarkers = this.buildCityMarkers(cityMarkerPending);

    return { cityLabels, cityMarkers, floorMeshes, roads };
  }
  // ─── Helpers ───────────────────────────────────────────────────────────────

  private project2D(x: number, y: number, lat: number, lng: number): THREE.Vector3 {
    return projectPointToSphere(x, y, lat, lng, this.planet.radius);
  }

  private calcHeight(lines: number): number {
    // 0-100 LOC -> 0.1 to 0.3
    // 100-500 LOC -> 0.3 to 1.0
    // 500-1000 LOC -> 1.0 to 2.0
    // 1000+ LOC -> 2.0 to 4.0
    if (lines < 100) return 0.1 + (lines / 100) * 0.2;
    if (lines < 500) return 0.3 + ((lines - 100) / 400) * 0.7;
    if (lines < 1000) return 1.0 + ((lines - 500) / 500) * 1.0;
    return Math.min(4.0, 2.0 + ((lines - 1000) / 1000) * 2.0);
  }

  private calcFootprint(size: number): number {
    // Files within a folder share a base footprint scale, slightly varied
    return 0.6 + Math.min(0.4, size / 80000);
  }

  private addCityLabel(
    city: CityData,
    pos3D: THREE.Vector3,
    normal: THREE.Vector3,
    group: THREE.Group,
  ) {
    const pos = pos3D.clone().addScaledVector(normal, 4.0);

    const container = document.createElement('div');
    container.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 5px',
      'pointer-events: none',
    ].join(';');

    const dot = document.createElement('span');
    dot.style.cssText = [
      'width: 8px',
      'height: 8px',
      'border-radius: 50%',
      'background: #5ec8f5',
      'box-shadow: 0 0 6px 2px rgba(94,200,245,0.7)',
      'flex-shrink: 0',
      'display: block',
    ].join(';');

    const text = document.createElement('span');
    text.textContent = city.name;
    text.style.cssText = [
      'color: #ddf4ff',
      'font-family: "Space Mono", "Courier New", monospace',
      'font-size: 10px',
      'font-weight: bold',
      'letter-spacing: 1px',
      'text-shadow: 0 0 6px rgba(0,150,255,0.8), 0 1px 3px rgba(0,0,0,1)',
      'white-space: nowrap',
    ].join(';');

    container.appendChild(dot);
    container.appendChild(text);

    const label = new CSS2DObject(container);
    label.position.copy(pos);
    group.add(label);
  }

  private buildInstanced(
    archetype: FloorArchetype,
    pending: PendingFloor[],
  ): { mesh: THREE.InstancedMesh; data: Map<number, string> } {
    const { geometry, material } = getFloorGeomSet(archetype);
    const data = new Map<number, string>();
    const clonedMaterial = Array.isArray(material) ? material.map(m => m.clone()) : material.clone();
    const mesh = new THREE.InstancedMesh(geometry, clonedMaterial, pending.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < pending.length; i++) {
      const f = pending[i];
      this.dummy.position.copy(f.position);
      this.dummy.scale.copy(f.scale);
      const q = new THREE.Quaternion().setFromUnitVectors(up, f.normal);
      this.dummy.quaternion.copy(q);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      mesh.setColorAt(i, f.color);
      data.set(i, f.id);
      this.fileIdToInstance.set(f.id, {
        mesh,
        instanceId: i,
        baseColor: f.color.clone()
      });
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return { mesh, data };
  }

  private buildCityMarkers(pending: PendingCityMarker[]): THREE.InstancedMesh {
    const geom = new THREE.CylinderGeometry(1.8, 1.8, 0.12, 8);
    const mat  = new THREE.MeshStandardMaterial({
      color: 0x5ec8f5,
      roughness: 0.4,
      metalness: 0.5,
      emissive: 0x1a4455,
    });
    const mesh = new THREE.InstancedMesh(geom, mat, pending.length || 1);
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < pending.length; i++) {
      const m = pending[i];
      this.dummy.position.copy(m.position);
      this.dummy.scale.set(1, 1, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(up, m.normal);
      this.dummy.quaternion.copy(q);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  
  
  public update(_deltaTime: number) {}
}
