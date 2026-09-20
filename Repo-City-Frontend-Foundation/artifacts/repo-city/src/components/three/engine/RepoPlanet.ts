import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { VisualizationMode, WorldState, RepoPlanetAPI } from './types.ts';
import type { PlanetData } from '../../../types/planet';
import { CameraController, LEVEL_RADIUS } from './CameraController';
import type { CameraLevel } from './CameraController';
import { Planet } from './Planet';
import { Atmosphere } from './Atmosphere';
import { Starfield } from './Starfield';
import { Lighting } from './Lighting';
import { SeededRandom } from './SeededRandom';
import { CountryGenerator } from './CountryGenerator';
import type { CountryPatch } from './CountryGenerator';
import { CityGenerator } from './CityGenerator';
import type { CountryGeometryGroup } from './CityGenerator';
import { getPlanetPosition } from './coordinates';
import { ActivityVisualizer } from '../intelligence/ActivityVisualizer';
import { HotspotVisualizer } from '../intelligence/HotspotVisualizer';
import { DependencyVisualizer } from '../intelligence/DependencyVisualizer';
import { TestVisualizer } from '../intelligence/TestVisualizer';
import type { IntelligenceContext, IntelligenceVisualizer } from '../intelligence/IntelligenceMode';

// ─────────────────────────────────────────────────────────────────────────────
// RepoPlanet — the top-level Three.js scene orchestrator
//
// Architecture:
//   scene
//   ├── Starfield
//   ├── Atmosphere
//   ├── Lighting
//   └── planet.mesh  (rotates)
//       └── planetSurface  (inherits planet rotation)
//           ├── countryGroup  (borders + labels + hit meshes)
//           └── per-country groups  (city markers, buildings, roads)
// ─────────────────────────────────────────────────────────────────────────────

interface CountryRecord {
  patch: CountryPatch;
  group: CountryGeometryGroup;
}

export class RepoPlanet implements RepoPlanetAPI {
  // ── Renderers ──────────────────────────────────────────────────────────────
  private renderer:      THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene:         THREE.Scene;
  private camera:        THREE.PerspectiveCamera;
  private cameraCtrl:    CameraController;

  // ── Globe ──────────────────────────────────────────────────────────────────
  private planet:        Planet;
  private planetSurface: THREE.Group;   // child of planet.mesh — auto-rotates
  private countryGen:    CountryGenerator;
  private cityGen:       CityGenerator;

  // ── State ──────────────────────────────────────────────────────────────────
  private worldState: WorldState = {
    view:               'global',
    activeRepositoryId: null,
    activeCityId:       null,
    activeDistrictId:   null,
    activeBuildingId:   null,
    activeFileId:       null,
  };

  private currentMode: VisualizationMode = 'world';
  private activeVisualizer: IntelligenceVisualizer | null = null;
  private visualizers = {
    activity: new ActivityVisualizer(),
    hotspots: new HotspotVisualizer(),
    dependencies: new DependencyVisualizer(),
    tests: new TestVisualizer(),
  };

  private countryMap  = new Map<string, CountryRecord>();
  private hitMeshes:  THREE.Mesh[] = [];   // country raycasting meshes
  private planetData: PlanetData;

  // ── Interaction ────────────────────────────────────────────────────────────
  private raycaster    = new THREE.Raycaster();
  private mouse        = new THREE.Vector2();
  private mouseDownPos = new THREE.Vector2();
  private onSelectFile?: (fileId: string) => void;
  private onStateChange?: (state: WorldState) => void;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  private animFrameId = 0;
  private clock       = new THREE.Clock();
  private canvas:     HTMLCanvasElement;
  private ro:         ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    planetData: PlanetData,
    onSelectFile?: (fileId: string) => void,
    onStateChange?: (state: WorldState) => void,
  ) {
    this.canvas        = canvas;
    this.planetData    = planetData;
    this.onSelectFile  = onSelectFile;
    this.onStateChange = onStateChange;

    const parent = canvas.parentElement;
    const initW  = parent?.clientWidth  || window.innerWidth;
    const initH  = parent?.clientHeight || window.innerHeight;

    // ── Renderer ──────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha:     false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(initW, initH);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x020203);
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // ── CSS2D label renderer ──────────────────────────────────────────────────
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(initW, initH);
    this.labelRenderer.domElement.style.position     = 'absolute';
    this.labelRenderer.domElement.style.top          = '0px';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    if (parent) parent.appendChild(this.labelRenderer.domElement);

    // ── Scene / Camera ────────────────────────────────────────────────────────
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, initW / Math.max(initH, 1), 0.1, 2000);

    this.cameraCtrl = new CameraController(
      this.camera,
      canvas,
      (level) => this.handleLevelChange(level),
    );

    // ── Globe ─────────────────────────────────────────────────────────────────
    new Lighting(this.scene);
    this.scene.add(new Starfield().mesh);

    this.planet = new Planet();
    this.scene.add(this.planet.mesh);
    this.scene.add(new Atmosphere(this.planet.radius).mesh);

    // planetSurface is a child of planet.mesh — inherits its rotation
    this.planetSurface = new THREE.Group();
    this.planet.mesh.add(this.planetSurface);

    // ── Country / city generation ─────────────────────────────────────────────
    this.countryGen = new CountryGenerator(this.scene, this.planet.radius);
    this.cityGen    = new CityGenerator(this.scene, this.planet.radius);

    this.planetSurface.add(this.countryGen.countryGroup);

    const rng = new SeededRandom(77777);

    for (const country of planetData.countries) {
      const patch = this.countryGen.generateCountry(country, rng);

      // Hit meshes, border lines, and labels are inside countryGen.countryGroup
      this.hitMeshes.push(patch.mesh);

      const group = this.cityGen.generateForCountry(country, patch, rng);

      // All per-country geometry lives in planetSurface (rotates with Earth)
      this.planetSurface.add(group.cityLabels);
      this.planetSurface.add(group.cityMarkers);
      this.planetSurface.add(group.roads);
      for (const bm of group.floorMeshes) {
        this.planetSurface.add(bm.mesh);
      }

      this.countryMap.set(country.repositoryId, { patch, group });
    }

    // Apply initial visibility (global view)
    this.applyVisibility();

    // ── Resize ────────────────────────────────────────────────────────────────
    this.ro = new ResizeObserver(() => this.handleResize());
    this.ro.observe(parent ?? canvas);

    // ── Input ─────────────────────────────────────────────────────────────────
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('click',     this.onClick);
    window.addEventListener('keydown',        this.onKeyDown);

    // ── Render loop ───────────────────────────────────────────────────────────
    this.renderLoop();
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private handleResize() {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth  : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── Level change (camera crossed a threshold) ───────────────────────────────

  private handleLevelChange(level: CameraLevel) {
    // Only update view if we're inside a repository — otherwise user is
    // zooming freely on the globe and we don't change the hierarchy.
    if (this.worldState.activeRepositoryId) {
      this.worldState.view = level;

      // If the user manually zoomed all the way out to global view,
      // we must deselect the country and recenter the camera.
      if (level === 'global') {
        this.worldState.activeRepositoryId = null;
        this.worldState.activeCityId       = null;
        this.worldState.activeDistrictId   = null;
        this.worldState.activeBuildingId   = null;
        this.worldState.activeFileId       = null;

        for (const [, rec] of this.countryMap) rec.patch.setSelected(false);

        // Smoothly animate the target back to (0,0,0) without changing the current radius
        this.cameraCtrl.flyTo(new THREE.Vector3(0, 0, 0), this.cameraCtrl.getRadius());
      }
    }
    this.applyVisibility();
    this.notifyStateChange();
  }

  // ── Visualizer Application ─────────────────────────────────────────────────

  private applyCurrentVisualizer() {
    const context: IntelligenceContext = {
      planetData: this.planetData,
      cityGen: this.cityGen,
      scene: this.scene,
      activeFileId: this.worldState.activeFileId
    };

    if (this.activeVisualizer) {
      this.activeVisualizer.reset(context);
    }

    if (this.currentMode === 'world') {
      this.activeVisualizer = null;
      // Normal colors are restored by the reset above
    } else {
      this.activeVisualizer = this.visualizers[this.currentMode];
      this.activeVisualizer.apply(context);
    }
  }

  // ── Visibility LOD ─────────────────────────────────────────────────────────

  private applyVisibility() {
    const view  = this.worldState.view;
    const repoId = this.worldState.activeRepositoryId;

    for (const [id, rec] of this.countryMap) {
      const isActive = id === repoId;

      // Country border: always visible, selected one brighter
      rec.patch.setSelected(isActive);

      if (!repoId) {
        // Global view: hide everything except borders+labels
        rec.group.cityLabels.visible  = false;
        rec.group.cityMarkers.visible = false;
        rec.group.roads.visible       = false;
        rec.group.floorMeshes.forEach(b => (b.mesh.visible = false));
        continue;
      }

      if (isActive) {
        // This is the selected repo
        const showCities    = view === 'country' || view === 'city' || view === 'district' || view === 'building' || view === 'file';
        const showBuildings = view === 'city' || view === 'district' || view === 'building' || view === 'file';
        const showRoads     = showBuildings;

        rec.group.cityLabels.visible  = showCities;
        rec.group.cityMarkers.visible = showCities && !showBuildings;
        rec.group.roads.visible       = showRoads;
        rec.group.floorMeshes.forEach(b => (b.mesh.visible = showBuildings));
      } else {
        // Other repos — subdue (keep borders but hide internal detail)
        rec.group.cityLabels.visible  = false;
        rec.group.cityMarkers.visible = false;
        rec.group.roads.visible       = false;
        rec.group.floorMeshes.forEach(b => (b.mesh.visible = false));
      }
    }

    this.applyCurrentVisualizer();
  }

  // ── Render loop ─────────────────────────────────────────────────────────────

  private renderLoop = () => {
    this.animFrameId = requestAnimationFrame(this.renderLoop);
    const delta = this.clock.getDelta();

    // Planet auto-rotates only in global view
    if (this.worldState.view === 'global' && !this.worldState.activeRepositoryId) {
      this.planet.update(delta);
    }

    // Camera must be updated every frame (drives its own animation)
    this.cameraCtrl.update();

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  // ── Input ───────────────────────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent) => {
    this.mouseDownPos.set(e.clientX, e.clientY);
  };

  private onClick = (e: MouseEvent) => {
    // Ignore drags
    if (
      Math.abs(e.clientX - this.mouseDownPos.x) > 5 ||
      Math.abs(e.clientY - this.mouseDownPos.y) > 5
    ) return;

    const rect  = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const level = this.cameraCtrl.getCurrentLevel();

    // ── A) File hit (Floor) ───────────────────────────────────────────
    if (this.worldState.activeRepositoryId && (level === 'city' || level === 'district' || level === 'building' || level === 'file')) {
      const rec = this.countryMap.get(this.worldState.activeRepositoryId);
      if (rec) {
        for (const bm of rec.group.floorMeshes) {
          if (!bm.mesh.visible) continue;
          const hits = this.raycaster.intersectObject(bm.mesh);
          if (hits.length > 0 && hits[0].instanceId !== undefined) {
            const fileId = bm.data.get(hits[0].instanceId);
            if (fileId) {
              this.selectFile(fileId);
              return;
            }
          }
        }
      }
    }

    // ── B) City marker click ───────────────────────────────────────────────
    if (this.worldState.activeRepositoryId && (level === 'country' || level === 'city')) {
      const rec = this.countryMap.get(this.worldState.activeRepositoryId);
      if (rec?.group.cityMarkers.visible) {
        const hits = this.raycaster.intersectObject(rec.group.cityMarkers);
        if (hits.length > 0) {
          const cityId = this.closestCityToPoint(hits[0].point);
          if (cityId) { this.focusCity(cityId); return; }
        }
      }
    }

    // ── C) Country hit-mesh click ──────────────────────────────────────────
    const countryHits = this.raycaster.intersectObjects(this.hitMeshes);
    if (countryHits.length > 0) {
      const id = countryHits[0].object.userData.countryId as string | undefined;
      if (id) { this.setSelectedCountry(id); return; }
    }

    // ── D) Click empty space — return to global ────────────────────────────
    if (this.worldState.activeRepositoryId) {
      this.resetCamera();
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.navigateBack();
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Convert a local-space position (in planetSurface) to world space */
  private toWorld(localPos: THREE.Vector3): THREE.Vector3 {
    this.planetSurface.updateMatrixWorld(true);
    return localPos.clone().applyMatrix4(this.planetSurface.matrixWorld);
  }

  private closestCityToPoint(worldPoint: THREE.Vector3): string | null {
    this.planetSurface.updateMatrixWorld(true);
    let bestId   = '';
    let bestDist = Infinity;
    for (const [cId, localPos] of this.cityGen.cityIdToPosition) {
      const wp = localPos.clone().applyMatrix4(this.planetSurface.matrixWorld);
      const d  = wp.distanceTo(worldPoint);
      if (d < bestDist) { bestDist = d; bestId = cId; }
    }
    return bestId || null;
  }

  private selectFile(fileId: string) {
    const buildingId = this.cityGen.fileIdToBuildingId.get(fileId) ?? null;
    this.worldState.activeBuildingId = buildingId;
    this.worldState.activeFileId     = fileId;
    this.worldState.view             = 'file';

    const localPos = this.cityGen.fileIdToPosition.get(fileId);
    if (localPos) {
      this.cameraCtrl.navigateTo(this.toWorld(localPos), 'file');
    }

    this.onSelectFile?.(fileId);
    this.applyVisibility();
    this.notifyStateChange();
  }

  private notifyStateChange() {
    this.onStateChange?.({ ...this.worldState });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  public setSelectedCountry(id: string | null) {
    if (id === this.worldState.activeRepositoryId) return;

    // Reset all countries to idle
    for (const [, rec] of this.countryMap) rec.patch.setSelected(false);

    this.worldState.activeRepositoryId = id;
    this.worldState.activeCityId       = null;
    this.worldState.activeDistrictId   = null;
    this.worldState.activeBuildingId   = null;
    this.worldState.activeFileId       = null;

    if (id) {
      this.worldState.view = 'country';
      const rec = this.countryMap.get(id);
      if (rec) {
        // Stop rotation and fly to country centre
        const localTarget = getPlanetPosition(rec.patch.lat, rec.patch.lng, this.planet.radius);
        const worldTarget = this.toWorld(localTarget);

        // Push global snapshot to history first, then navigate
        this.cameraCtrl.navigateTo(worldTarget, 'country', () => {
          this.worldState.view = 'country';
          this.applyVisibility();
          this.notifyStateChange();
        });
        rec.patch.setSelected(true);
      }
    } else {
      this.worldState.view = 'global';
      this.cameraCtrl.reset();
    }

    this.applyVisibility();
    this.notifyStateChange();
  }

  public focusCity(cityId: string) {
    const localPos = this.cityGen.cityIdToPosition.get(cityId);
    if (!localPos) return;

    this.worldState.activeCityId     = cityId;
    this.worldState.activeDistrictId = null;
    this.worldState.activeBuildingId = null;
    this.worldState.activeFileId     = null;
    this.worldState.view             = 'city';

    this.cameraCtrl.navigateTo(this.toWorld(localPos), 'city', () => {
      this.applyVisibility();
      this.notifyStateChange();
    });

    this.applyVisibility();
    this.notifyStateChange();
  }

  public focusDistrict(districtId: string) {
    const localPos = this.cityGen.districtIdToPosition.get(districtId);
    if (!localPos) return;

    this.worldState.activeDistrictId = districtId;
    this.worldState.activeBuildingId = null;
    this.worldState.activeFileId     = null;
    this.worldState.view             = 'district';

    this.cameraCtrl.navigateTo(this.toWorld(localPos), 'district', () => {
      this.applyVisibility();
      this.notifyStateChange();
    });
    this.applyVisibility();
    this.notifyStateChange();
  }

  public focusBuilding(buildingId: string) {
    const localPos = this.cityGen.buildingIdToPosition.get(buildingId);
    if (!localPos) return;

    this.worldState.activeBuildingId = buildingId;
    this.worldState.activeFileId     = null;
    this.worldState.view             = 'building';

    this.cameraCtrl.navigateTo(this.toWorld(localPos), 'building', () => {
      this.applyVisibility();
      this.notifyStateChange();
    });
    this.applyVisibility();
    this.notifyStateChange();
  }

  public focusFile(fileId: string) {
    const countryId = this.cityGen.fileIdToCountryId.get(fileId);
    if (countryId && countryId !== this.worldState.activeRepositoryId) {
      this.setSelectedCountry(countryId);
    }
    this.selectFile(fileId);
  }

  public focusContinent(continentId: string) {
    this.setSelectedCountry(continentId);
  }

  public navigateBack(): boolean {
    const didNav = this.cameraCtrl.navigateBack();
    if (!didNav) return false;

    const level = this.cameraCtrl.getCurrentLevel();

    // Rewind WorldState one step based on camera level
    if (level === 'global') {
      this.worldState = {
        view: 'global',
        activeRepositoryId: null,
        activeCityId: null,
        activeDistrictId: null,
        activeBuildingId: null,
        activeFileId: null,
      };
    } else if (level === 'country') {
      this.worldState.view             = 'country';
      this.worldState.activeCityId     = null;
      this.worldState.activeDistrictId = null;
      this.worldState.activeBuildingId = null;
      this.worldState.activeFileId     = null;
    } else if (level === 'city') {
      this.worldState.view             = 'city';
      this.worldState.activeDistrictId = null;
      this.worldState.activeBuildingId = null;
      this.worldState.activeFileId     = null;
    } else if (level === 'district') {
      this.worldState.view             = 'district';
      this.worldState.activeBuildingId = null;
      this.worldState.activeFileId     = null;
    } else if (level === 'building') {
      this.worldState.view             = 'building';
      this.worldState.activeFileId     = null;
    } else if (level === 'file') {
      this.worldState.view             = 'file';
    }

    this.applyVisibility();
    this.applyCurrentVisualizer();
    this.notifyStateChange();
    return true;
  }

  public resetCamera() {
    this.worldState = {
      view:               'global',
      activeRepositoryId: null,
      activeCityId:       null,
      activeDistrictId:   null,
      activeBuildingId:   null,
      activeFileId:       null,
    };
    this.cameraCtrl.reset();
    for (const [, rec] of this.countryMap) rec.patch.setSelected(false);
    this.applyVisibility();
    this.applyCurrentVisualizer();
    this.notifyStateChange();
  }

  public getWorldState(): WorldState {
    return { ...this.worldState };
  }

  public setMode(mode: VisualizationMode) {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.applyCurrentVisualizer();
  }

  public setShowLabels(show: boolean) {
    this.labelRenderer.domElement.style.display = show ? 'block' : 'none';
  }

  public dispose() {
    cancelAnimationFrame(this.animFrameId);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('click',     this.onClick);
    window.removeEventListener('keydown',        this.onKeyDown);
    this.cameraCtrl.dispose();
    this.ro?.disconnect();
    if (this.labelRenderer.domElement.parentElement) {
      this.labelRenderer.domElement.parentElement.removeChild(this.labelRenderer.domElement);
    }
    this.renderer.dispose();
  }
}
