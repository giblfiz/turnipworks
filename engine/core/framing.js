// Framing an area for its thumbnail (Harry 2026-10-04): zoomed out to take in most of the structures, zoomed in so there
// is little empty space. Pure math (no THREE), shared by the client and the tests.
//   structureBox(rects)   rects: [{ x0, z0, x1, z1 }] in feet (rooms; buildings are their rooms). Returns the box that
//                         frames them: all of them, unless they are spread out, in which case far outliers are dropped
//                         as long as the box still covers >= COVER (85%) of the structure area.
//   fitDistance(...)      the camera distance at a fixed yaw/pitch that fits a box's corners in the frame with a margin.
export const COVER = 0.85;

const areaOf = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
const boxOf = (rs) => rs.length ? { x0: Math.min(...rs.map(r => r.x0)), z0: Math.min(...rs.map(r => r.z0)), x1: Math.max(...rs.map(r => r.x1)), z1: Math.max(...rs.map(r => r.z1)) } : null;

export function structureBox(rects, { cover = COVER, minShrink = 0.25 } = {}) {
  const all = rects.filter(r => areaOf(r) > 0);
  if (!all.length) return null;
  const total = all.reduce((s, r) => s + areaOf(r), 0);
  let keep = all.slice();
  // greedy: drop the room that pins an edge of the box when that shrinks the box a lot (an outlier) and what remains
  // still covers enough of the structures; compact layouts lose nothing
  for (;;) {
    const box = boxOf(keep), boxA = areaOf(box), covered = keep.reduce((s, r) => s + areaOf(r), 0);
    let best = null;
    for (const r of keep) {
      if (!(r.x0 === box.x0 || r.z0 === box.z0 || r.x1 === box.x1 || r.z1 === box.z1)) continue; // only edge-pinning rooms
      const rest = keep.filter(x => x !== r);
      if (!rest.length || (covered - areaOf(r)) / total < cover) continue;
      const a = areaOf(boxOf(rest));
      if (a <= boxA * (1 - minShrink) && (!best || a < best.a)) best = { r, a };
    }
    if (!best) return { ...box, kept: keep.length, of: all.length, cover: covered / total };
    keep = keep.filter(x => x !== best.r);
  }
}

// camera at yaw/pitch (degrees; the GrabCamera convention: yaw 0 looks toward -Z), aimed at the box's centre: the
// distance at which every corner of the box (height h) projects inside the frame, leaving `margin` (fraction of the
// half-frame) free. fovDeg is the vertical field of view.
export function fitDistance(box, { yaw = -20, pitch = 52, fovDeg = 45, aspect = 1.6, h = 10, margin = 0.06 } = {}) {
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const Y = yaw * Math.PI / 180, P = pitch * Math.PI / 180;
  const back = [Math.sin(Y) * Math.cos(P), Math.sin(P), Math.cos(Y) * Math.cos(P)];   // camera offset direction
  const fwd = back.map(v => -v);
  const right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  const ty = Math.tan(fovDeg * Math.PI / 360) * (1 - margin), tx = ty * aspect;
  const corners = [];
  for (const x of [box.x0, box.x1]) for (const z of [box.z0, box.z1]) for (const y of [0, h]) corners.push([x - cx, y, z - cz]);
  // for a point p (relative to the focus) and camera at d*back: depth = d - p·back... in camera axes:
  // x_c = p·right, y_c = p·up, depth = d - p·back; it fits when |x_c| <= tx * depth and |y_c| <= ty * depth
  let d = 1;
  for (const p of corners) {
    const xc = dot(p, right), yc = dot(p, up), pb = dot(p, back);
    d = Math.max(d, Math.abs(xc) / tx + pb, Math.abs(yc) / ty + pb);
  }
  return { focus: [cx, 0, cz], dist: d, yaw, pitch };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
