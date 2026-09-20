import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchical Camera Controller
//
// Uses spherical coordinates (theta, phi, radius) around a target point.
// Fly-to animations are single-shot; they cannot stack or interrupt each other.
// Once an animation finishes the state is "frozen" and user drag/zoom applies
// relative offsets on top of it — so there is no continuous re-targeting.
// ─────────────────────────────────────────────────────────────────────────────

export type CameraLevel = 'global' | 'country' | 'city' | 'district' | 'building' | 'file';

// Radius thresholds at which each level activates (world units, planet r=100)
export const LEVEL_RADIUS: Record<CameraLevel, number> = {
  global:   340,
  country:  160,
  city:     80,
  district: 45,
  building: 22,
  file:     12,
};

const MIN_RADIUS = 10;
const MAX_RADIUS = 900;
const MIN_PHI    = 0.05;
const MAX_PHI    = Math.PI - 0.05;

export type OnLevelChange = (level: CameraLevel) => void;

interface Snapshot {
  theta:  number;
  phi:    number;
  radius: number;
  target: THREE.Vector3;
  level:  CameraLevel;
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  // ── Current live state (what the user sees) ────────────────────────────────
  private theta  = -0.5;
  private phi    = 1.2;
  private radius = 340;
  private target = new THREE.Vector3(0, 0, 0);

  // ── Level bookkeeping ──────────────────────────────────────────────────────
  private currentLevel: CameraLevel = 'global';
  private onLevelChange?: OnLevelChange;

  // ── Navigation history (for back navigation) ───────────────────────────────
  private history: Snapshot[] = [];

  // ── Animation ─────────────────────────────────────────────────────────────
  private anim: {
    active:       boolean;
    fromTheta:    number;
    fromPhi:      number;
    fromRadius:   number;
    fromTarget:   THREE.Vector3;
    toTheta:      number;
    toPhi:        number;
    toRadius:     number;
    toTarget:     THREE.Vector3;
    durationMs:   number;
    startMs:      number;
    onComplete?:  () => void;
  } | null = null;

  // ── User input ─────────────────────────────────────────────────────────────
  private isDragging  = false;
  private isPanning   = false;
  private lastMouse   = { x: 0, y: 0 };
  private listeners: Array<{ el: HTMLElement | Window; type: string; fn: EventListener }> = [];

  constructor(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    onLevelChange?: OnLevelChange,
  ) {
    this.camera         = camera;
    this.canvas         = canvas;
    this.onLevelChange  = onLevelChange;
    this.bindEvents();
    this.applyState();
  }

  // ── Public fly-to ──────────────────────────────────────────────────────────

  /**
   * Animate smoothly toward a world-space target position at a given radius.
   * Safe to call at any time — previous animation is superseded.
   */
  flyTo(
    worldTarget: THREE.Vector3,
    targetRadius: number,
    onComplete?: () => void,
    durationMs = 1400,
  ) {
    // Cancel any ongoing animation cleanly
    if (this.anim?.active) {
      // Snap to wherever we currently are
      this.applyState();
      this.anim = null;
    }

    // When looking at a specific world point, we want the camera to orbit
    // around that point.  We keep the current theta / phi for continuity.
    const clampedRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, targetRadius));
    const targetPhi     = Math.max(MIN_PHI, Math.min(MAX_PHI, 1.05)); // slight top-down tilt

    this.anim = {
      active:     true,
      fromTheta:  this.theta,
      fromPhi:    this.phi,
      fromRadius: this.radius,
      fromTarget: this.target.clone(),
      toTheta:    this.theta,      // don't change azimuth — camera orbits to face the target naturally
      toPhi:      targetPhi,
      toRadius:   clampedRadius,
      toTarget:   worldTarget.clone(),
      durationMs,
      startMs:    performance.now(),
      onComplete,
    };
  }

  /**
   * Push the current state onto the history stack and fly to a new location.
   */
  navigateTo(
    worldTarget: THREE.Vector3,
    level: CameraLevel,
    onComplete?: () => void,
  ) {
    // Save current snapshot for back navigation
    this.history.push(this.snapshot());
    this.flyTo(worldTarget, LEVEL_RADIUS[level], onComplete);
    this.currentLevel = level;
    this.onLevelChange?.(level);
  }

  /**
   * Navigate back one level.  Returns true if navigation happened.
   */
  navigateBack(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.flyTo(prev.target, prev.radius);
    this.currentLevel = prev.level;
    this.onLevelChange?.(prev.level);
    return true;
  }

  /**
   * Reset to the global view, clearing history.
   */
  reset() {
    this.history = [];
    this.flyTo(new THREE.Vector3(0, 0, 0), LEVEL_RADIUS.global);
    this.currentLevel = 'global';
    this.onLevelChange?.('global');
  }

  // ── Update — called every frame ────────────────────────────────────────────

  /**
   * MUST be called in the render loop every frame.
   * Advances any in-progress animation and applies the camera transform.
   */
  update() {
    if (this.anim && this.anim.active) {
      const now = performance.now();
      const t   = Math.min((now - this.anim.startMs) / this.anim.durationMs, 1);
      const e   = easeInOutCubic(t);

      this.theta  = lerpAngle(this.anim.fromTheta,  this.anim.toTheta,  e);
      this.phi    = THREE.MathUtils.lerp(this.anim.fromPhi,    this.anim.toPhi,    e);
      this.radius = THREE.MathUtils.lerp(this.anim.fromRadius, this.anim.toRadius, e);
      this.target.lerpVectors(this.anim.fromTarget, this.anim.toTarget, e);

      if (t >= 1) {
        this.anim.active = false;
        this.anim.onComplete?.();
        this.anim = null;
        this.checkLevelByRadius();
      }
    }

    this.applyState();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getCurrentLevel(): CameraLevel { return this.currentLevel; }
  getRadius():       number       { return this.radius; }
  isAnimating():     boolean      { return this.anim?.active ?? false; }
  getHistory():      Snapshot[]   { return this.history; }

  /** Get world-space direction from camera to target */
  getForward(): THREE.Vector3 {
    return this.target.clone().sub(this.camera.position).normalize();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private snapshot(): Snapshot {
    return {
      theta:  this.theta,
      phi:    this.phi,
      radius: this.radius,
      target: this.target.clone(),
      level:  this.currentLevel,
    };
  }

  private applyState() {
    const { theta, phi, radius, target } = this;
    this.camera.position.set(
      target.x + radius * Math.sin(phi) * Math.cos(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.sin(theta),
    );
    this.camera.lookAt(target);
  }

  private checkLevelByRadius() {
    const r = this.radius;
    let level: CameraLevel;
    if      (r > LEVEL_RADIUS.country)  level = 'global';
    else if (r > LEVEL_RADIUS.city)     level = 'country';
    else if (r > LEVEL_RADIUS.district) level = 'city';
    else if (r > LEVEL_RADIUS.building) level = 'district';
    else if (r > LEVEL_RADIUS.file)     level = 'building';
    else                                level = 'file';

    if (level !== this.currentLevel) {
      this.currentLevel = level;
      this.onLevelChange?.(level);
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  private bind(el: HTMLElement | Window, type: string, fn: EventListener) {
    el.addEventListener(type, fn, { passive: false } as EventListenerOptions);
    this.listeners.push({ el, type, fn });
  }

  private bindEvents() {
    const canvas = this.canvas;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        this.isPanning = true;
      } else if (e.button === 0) {
        this.isDragging = true;
      }
      this.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging && !this.isPanning) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };

      if (this.isDragging) {
        // Don't orbit during animation — interrupt it first
        if (this.anim?.active) {
          this.anim.active = false;
          this.anim = null;
        }
        const speed = 0.004;
        this.theta -= dx * speed;
        this.phi    = Math.max(MIN_PHI, Math.min(MAX_PHI, this.phi + dy * speed));
      }

      if (this.isPanning) {
        if (this.anim?.active) { this.anim.active = false; this.anim = null; }
        const panSpeed = this.radius * 0.0006;
        const right = new THREE.Vector3();
        const up    = new THREE.Vector3();
        right.crossVectors(
          this.camera.getWorldDirection(new THREE.Vector3()),
          this.camera.up,
        ).normalize();
        up.copy(this.camera.up);
        this.target.addScaledVector(right, -dx * panSpeed);
        this.target.addScaledVector(up,     dy * panSpeed);
      }
    };

    const onMouseUp = () => {
      this.isDragging = false;
      this.isPanning  = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (this.anim?.active) { this.anim.active = false; this.anim = null; }
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.radius * factor));
      this.checkLevelByRadius();
    };

    // Touch
    let lastTouchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastMouse.x;
        const dy = e.touches[0].clientY - this.lastMouse.y;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (this.anim?.active) { this.anim.active = false; this.anim = null; }
        this.theta -= dx * 0.005;
        this.phi    = Math.max(MIN_PHI, Math.min(MAX_PHI, this.phi + dy * 0.005));
      } else if (e.touches.length === 2) {
        const dist   = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const factor = lastTouchDist / dist;
        this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.radius * factor));
        lastTouchDist = dist;
        this.checkLevelByRadius();
      }
    };

    const onTouchEnd = () => { this.isDragging = false; };

    this.bind(canvas, 'mousedown',  onMouseDown  as EventListener);
    this.bind(window, 'mousemove',  onMouseMove  as EventListener);
    this.bind(window, 'mouseup',    onMouseUp    as EventListener);
    this.bind(canvas, 'wheel',      onWheel      as EventListener);
    this.bind(canvas, 'touchstart', onTouchStart as EventListener);
    this.bind(canvas, 'touchmove',  onTouchMove  as EventListener);
    this.bind(canvas, 'touchend',   onTouchEnd   as EventListener);
  }

  dispose() {
    for (const { el, type, fn } of this.listeners) {
      el.removeEventListener(type, fn);
    }
    this.listeners = [];
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Lerp angles via shortest arc to avoid 360°→0° jumps */
function lerpAngle(a: number, b: number, t: number): number {
  let delta = b - a;
  // Normalize to [-π, π]
  while (delta > Math.PI)  delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}
