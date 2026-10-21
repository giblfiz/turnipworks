// Views are first-class (principle 6): a view is (area, camera rule), drawn into a rectangle of the one canvas.
// Camera rules:
//   free    the tuner's grab-the-world camera (GrabCamera), driven by pointer input (main view only)
//   pinned  a fixed pose (whatever the camera showed when it was pinned)
//   follow  follow-group: centroid plus fit-to-bounds of chosen tokens (all tokens if none chosen), smoothed,
//           widening as they spread
// All three keep their pose in a GrabCamera (focus, yaw, pitch, dist), so switching rules never jumps.
import * as THREE from 'three';
import { T } from './tuner.js'; // the tuner's grab-the-world camera, imported live

let nextViewId = 1;

export class View {
  constructor({ area, rule = 'free', rect = [0, 0, 1, 1], dom, follow = null, pose = null }) {
    this.id = nextViewId++;
    this.area = area; this.rule = rule; this.rect = rect; this.follow = follow;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);
    this.grab = new T.camera.GrabCamera(this.camera, dom, pose || {});
  }

  setRule(rule, follow = this.follow) { this.rule = rule; this.follow = follow; }

  // rect is [left, top, width, height] as fractions of the canvas; returns WebGL pixels (origin bottom-left)
  pixels(W, H) {
    const [l, t, w, h] = this.rect;
    const pw = Math.round(w * W), ph = Math.round(h * H);
    return { x: Math.round(l * W), y: Math.round(H - (t * H) - ph), w: pw, h: ph };
  }
  contains(px, py, W, H) { const [l, t, w, h] = this.rect; return px >= l * W && px <= (l + w) * W && py >= t * H && py <= (t + h) * H; }

  update(dt, world) {
    const g = this.grab;
    if (this.rule === 'follow' && world) {
      // follow: token ids, or { owner: seat } = that person's pawns, resolved every frame (they may not be loaded yet)
      const ids = this.follow?.owner ? [...world.recs.values()].filter(r => r.entity.kind === 'token' && r.entity.owner === this.follow.owner).map(r => r.entity.id) : this.follow;
      const pts = world.pointsOf(ids?.length ? ids : null);
      if (pts.length) {
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const spread = Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cz)));
        const fov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
        const aspect = Math.min(1, this.camera.aspect);
        const want = THREE.MathUtils.clamp(((spread + 10) / Math.tan(fov)) / aspect * 1.15, 28, 500);
        const k = 1 - Math.exp(-dt * 3);
        g.focus.x += (cx - g.focus.x) * k; g.focus.z += (cz - g.focus.z) * k;
        g.dist += (want - g.dist) * k;
        g.pitch += (58 - g.pitch) * k;
      }
    }
    this.glideStep();
    g.tick(this.rule === 'free' ? dt : 0);
    g.update();
    if (this.glide) this.glide.seen = [g.focus.x, g.focus.z, g.yaw, g.pitch, g.dist];
  }

  // A GLIDE (Harry 2026-10-06: a double-click also centres): the focus eases to a point over a short time; heading,
  // pitch and distance are left alone. ANY camera input ends it at once: if the pose is not what the glide last left
  // (a pan, a turn, a zoom, a follow rule, a set pose), the glide is dropped and the input wins.
  glideTo(x, z, ms = 300) { const g = this.grab; this.glide = { from: [g.focus.x, g.focus.z], to: [x, z], t0: performance.now(), ms, seen: [g.focus.x, g.focus.z, g.yaw, g.pitch, g.dist] }; }
  glideStep(now = performance.now()) {
    const G = this.glide, g = this.grab; if (!G) return;
    const cur = [g.focus.x, g.focus.z, g.yaw, g.pitch, g.dist];
    if (cur.some((v, i) => Math.abs(v - G.seen[i]) > 1e-6)) { this.glide = null; return; }
    const t = Math.min(1, (now - G.t0) / G.ms), k = 1 - Math.pow(1 - t, 3); // ease out
    g.focus.x = G.from[0] + (G.to[0] - G.from[0]) * k; g.focus.z = G.from[1] + (G.to[1] - G.from[1]) * k;
    if (t >= 1) this.glide = null;
  }

  // the pose (focus, heading, pitch, distance) as plain numbers, and back; a set pose is where the camera IS (no glide)
  pose() { const g = this.grab; return { focus: [g.focus.x, g.focus.y, g.focus.z], yaw: g.yaw, pitch: g.pitch, dist: g.dist }; }
  setPose(p) { const g = this.grab; g.focus.set(p.focus[0], p.focus[1] || 0, p.focus[2]); g.yaw = p.yaw; g.pitch = p.pitch; g.dist = THREE.MathUtils.clamp(p.dist, g.minDist, g.maxDist); g.update(); return this.pose(); }
  aspect(W, H) { return (this.rect[2] * W) / (this.rect[3] * H); } // of its rectangle on a W×H canvas

  // focus and spread, for tests and the HUD
  describe() { const f = this.grab.focus; return { area: this.area, rule: this.rule, follow: this.follow, focus: [+f.x.toFixed(2), +f.z.toFixed(2)], dist: +this.grab.dist.toFixed(1), yaw: +this.grab.yaw.toFixed(2), pitch: +this.grab.pitch.toFixed(2) }; }
}

// A pose shown in a frame of another shape (Harry 2026-10-05: opening an area on its thumbnail's view; the PiP swap).
// Same focus, heading and pitch. The field of view is vertical, so the same distance shows the same height of world; a
// NARROWER frame would cut the sides off, so there the camera backs away until the same width is in view. Nothing that
// was in the picture is lost; a wider frame just shows more to the sides.
export const fitPose = (pose, fromAspect, toAspect) => ({ ...pose, dist: pose.dist * Math.max(1, fromAspect / toAspect) });
const samePose = (a, b) => a && b && Math.abs(a.dist - b.dist) < 1e-6 && Math.abs(a.yaw - b.yaw) < 1e-6 && Math.abs(a.pitch - b.pitch) < 1e-6 && a.focus.every((v, i) => Math.abs(v - b.focus[i]) < 1e-6);
// two views trade poses (each area keeps its own camera through a swap). A pose that was backed away to fit a narrower
// frame goes back to exactly what it was if nothing moved it meanwhile, so swapping twice changes nothing.
export function swapPoses(a, b, W, H) {
  const give = (from, to) => {
    const p = from.pose(), af = from.aspect(W, H), at = to.aspect(W, H), c = from.carried;
    const back = c && samePose(c.applied, p) && Math.abs(c.fromAspect - at) < 1e-3;
    return { pose: back ? { ...p, dist: c.orig.dist } : fitPose(p, af, at), orig: p, fromAspect: af };
  };
  const toB = give(a, b), toA = give(b, a);
  b.carried = { applied: b.setPose(toB.pose), orig: toB.orig, fromAspect: toB.fromAspect };
  a.carried = { applied: a.setPose(toA.pose), orig: toA.orig, fromAspect: toA.fromAspect };
}
