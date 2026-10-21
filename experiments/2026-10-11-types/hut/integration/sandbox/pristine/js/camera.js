// Grab-the-world camera, ported from Map Garden 2 (scaling/grab_navigation.gd + main.gd _begin_grab/_drag_grab_to).
// The ground point under the cursor at pointer-down stays under the cursor for the whole drag: we re-solve the
// focus against the current pointer ray every move, so error cannot accumulate.
//   left/right-drag = literal grab (pan): the touched ground point stays under the cursor
//   middle-drag (or shift+left) = free orbit: yaw and pitch, pivoting on the touched ground point; pitch stays
//   above the floor (Harry 2026-10-01: "freely rotate the scene ... maintain the floor")
//   wheel       = zoom x0.9 per notch toward the cursor (the point under the cursor stays put)
//   Q/E yaw, PageUp/PageDown pitch, T top-down, G table view, H home.  Pinch zooms, one finger grabs.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class GrabCamera {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.focus = new THREE.Vector3(opts.focus?.[0] ?? 30, 0, opts.focus?.[1] ?? 20);
    this.yaw = opts.yaw ?? -20;      // degrees; 0 = looking north (toward -Z)
    this.pitch = opts.pitch ?? 52;   // degrees above the horizon
    this.dist = opts.dist ?? 95;     // feet
    this.minDist = 6; this.maxDist = 600; this.minPitch = 6; // never below the floor
    this.keys = new Set();
    this.grab = null;               // {anchor, orbit, last:{x,y}, pitchOnly}
    this.pointers = new Map();
    this.pinch = null;
    this.ray = new THREE.Raycaster();
    this.enabled = true;
    this.update();
  }

  update() {
    const yaw = THREE.MathUtils.degToRad(this.yaw), pitch = THREE.MathUtils.degToRad(this.pitch);
    // camera sits "behind" the focus: yaw 0 looks toward -Z (north)
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.camera.position.copy(this.focus).addScaledVector(off, this.dist);
    this.camera.up.copy(UP);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }

  ndc(x, y) {
    const r = this.dom.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  groundAt(x, y, planeY = 0) {
    this.ray.setFromCamera(this.ndc(x, y), this.camera);
    const { origin, direction } = this.ray.ray;
    if (Math.abs(direction.y) < 1e-6) return null;
    const t = (planeY - origin.y) / direction.y;
    if (t < 0) return null;
    return origin.clone().addScaledVector(direction, t);
  }

  // Translate the focus so `anchor` lies under screen point (x, y) again (Map Garden flat_focus_correction).
  pinTo(anchor, x, y) {
    const under = this.groundAt(x, y, anchor.y);
    if (!under) return;
    const c = anchor.clone().sub(under); c.y = 0;
    this.focus.add(c);
    this.update();
  }

  beginGrab(x, y, mode) { // mode: 'orbit' | 'pan' | 'pitch'
    const anchor = this.groundAt(x, y);
    this.grab = { anchor, mode, last: { x, y } };
  }

  dragTo(x, y) {
    const g = this.grab; if (!g) return;
    const dx = x - g.last.x, dy = y - g.last.y;
    g.last = { x, y };
    if (g.mode === 'orbit') { // rotate first, then re-pin the grabbed point (Map Garden order) = orbit about it
      this.yaw = (this.yaw - dx * 0.4 + 540) % 360 - 180;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.3, this.minPitch, 89.5);
      this.update();
      if (g.anchor) this.pinTo(g.anchor, x, y);
      return;
    }
    if (!g.anchor) return;
    this.pinTo(g.anchor, x, y);
  }

  endGrab() { this.grab = null; }

  zoomAt(x, y, f) {
    const anchor = this.groundAt(x, y);
    this.dist = THREE.MathUtils.clamp(this.dist * f, this.minDist, this.maxDist);
    this.update();
    if (anchor) this.pinTo(anchor, x, y);
  }

  preset(name, center) {
    if (center) this.focus.set(center.x, 0, center.z);
    if (name === 'top') { this.pitch = 89.5; this.yaw = 0; }
    if (name === 'table') { this.pitch = 38; this.dist = Math.min(this.dist, 45); }
    if (name === 'home') { this.pitch = 52; this.yaw = -20; this.dist = 95; }
    this.update();
  }

  // stand in a doorway at eye height (5.5 ft) and look into the room (Cliff's one camera angle)
  doorView(door, center) {
    const dx = center[0] - door[0], dz = center[1] - door[1], D = Math.max(4, Math.hypot(dx, dz));
    this.focus.set(center[0], 0, center[1]);
    this.yaw = Math.atan2(door[0] - center[0], door[1] - center[1]) * 180 / Math.PI;
    this.pitch = Math.max(this.minPitch, Math.atan2(5.5, D) * 180 / Math.PI);
    this.dist = Math.hypot(D, 5.5);
    this.update();
  }

  tick(dt) {
    let changed = false;
    if (this.keys.has('q')) { this.yaw += 55 * dt; changed = true; }
    if (this.keys.has('e')) { this.yaw -= 55 * dt; changed = true; }
    if (this.keys.has('pageup')) { this.pitch = Math.min(89.5, this.pitch + 40 * dt); changed = true; }
    if (this.keys.has('pagedown')) { this.pitch = Math.max(this.minPitch, this.pitch - 40 * dt); changed = true; }
    if (changed) this.update();
  }

  // Pinch: two pointers. Zoom by spread ratio about the midpoint, and grab with the midpoint.
  pinchStart() {
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pinch = { spread: Math.hypot(a.x - b.x, a.y - b.y), anchor: this.groundAt(mid.x, mid.y) };
    this.grab = null;
  }
  pinchMove() {
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const spread = Math.hypot(a.x - b.x, a.y - b.y);
    if (this.pinch.spread > 0) this.dist = THREE.MathUtils.clamp(this.dist * this.pinch.spread / spread, this.minDist, this.maxDist);
    this.pinch.spread = spread;
    this.update();
    if (this.pinch.anchor) this.pinTo(this.pinch.anchor, mid.x, mid.y);
  }
}
