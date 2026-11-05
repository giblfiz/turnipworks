// THE SELECTION BOX TAKES WHAT IS MOSTLY INSIDE IT (Harry 2026-11-03, trying "drag select takes the desk" on dev: "Drag
// is not grabbing the desk unless you get every little last inch of the desk in the box, and it's a little messy. I would
// say we need a sort of 'most of' the object rule with drag."; docs/UI.md "Marquee").
//
// A thing is taken when at least MARQUEE_MOST of it, AS IT IS DRAWN ON SCREEN, is inside the box. The old rule asked for
// all eight corners of the thing's world bounding box inside the box (every mesh's own box, turned to the world axes and
// padded 0.08 ft): every last inch of the thing, and a little more, since that box on screen reaches past the drawn
// outline (a desk at 26 ft, seen at 38° pitch: some 10 px on each side; more for a turned or a sprawling thing).
//
// HOW IT IS MEASURED. Each mesh's surface is sampled once, SAMPLES points spread by area (cached per geometry: clones
// share theirs). At each box, a point counts for the share of the screen its bit of surface covers: its area, turned to
// the eye (|n·(p − eye)|), shrunk by its depth cubed, which is how a small patch projects in perspective; a face the
// renderer culls (the far side of a single-sided mesh) counts for nothing, so a closed shape counts its outline once.
// The thing's share inside the box is the covered area of its points inside over that of all of them: the near side of
// a thing counts for more than the far side, as on screen, and a desk's top seen from above for nearly all of it. Rooms
// and buildings (the overview detent) are their floor rectangles, as boundsOf has them, sampled on a grid the same way;
// a building is all its rooms that the cut leaves drawn.
// Only things the box partly holds are sampled: a thing whose world box is wholly inside is wholly inside, and one whose
// world box misses the box altogether is not in it (the old test, exact at both ends).
import * as THREE from 'three';

export const MARQUEE_MOST = 0.5;   // the share of a thing, as drawn, that must be inside the box for the box to take it
const SAMPLES = 128;               // points per mesh geometry (stratified by area; the error of a share is a few %)
const ROOM_GRID = 10;              // a room's floor rectangle: ROOM_GRID × ROOM_GRID points

const cache = new WeakMap(); // geometry -> Float32Array of samples [px py pz  e1x e1y e1z  e2x e2y e2z  k] or null
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

// SAMPLES points on a geometry's triangles, by area. Each keeps its triangle's two edges (so its area and facing can be
// taken in the world, under any scale) and k = (its share of the surface) / (its triangle's doubled area).
function samplesOf(geo) {
  let s = cache.get(geo); if (s !== undefined) return s;
  const P = geo.getAttribute?.('position'), I = geo.index; s = null;
  if (P && P.count >= 3) {
    const n = Math.floor((I ? I.count : P.count) / 3), cum = new Float64Array(n), at = (i) => I ? I.getX(i) : i;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
    let tot = 0;
    for (let t = 0; t < n; t++) {
      a.fromBufferAttribute(P, at(3 * t)); b.fromBufferAttribute(P, at(3 * t + 1)); c.fromBufferAttribute(P, at(3 * t + 2));
      tot += u.subVectors(b, a).cross(v.subVectors(c, a)).length() / 2; cum[t] = tot;
    }
    if (tot > 0) {
      s = new Float32Array(SAMPLES * 10);
      for (let i = 0, lo = 0; i < SAMPLES; i++) {
        const want = (i + 0.5) / SAMPLES * tot; let hi = n - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < want) lo = m + 1; else hi = m; } // (the wants rise, so lo only climbs)
        const t = lo;
        a.fromBufferAttribute(P, at(3 * t)); b.fromBufferAttribute(P, at(3 * t + 1)); c.fromBufferAttribute(P, at(3 * t + 2));
        u.subVectors(b, a); v.subVectors(c, a);
        const r1 = Math.sqrt(halton(i + 1, 2)), r2 = halton(i + 1, 3), dbl = u.clone().cross(v).length();
        const o = i * 10;
        s[o] = a.x + r1 * ((1 - r2) * u.x + r2 * v.x); s[o + 1] = a.y + r1 * ((1 - r2) * u.y + r2 * v.y); s[o + 2] = a.z + r1 * ((1 - r2) * u.z + r2 * v.z);
        s[o + 3] = u.x; s[o + 4] = u.y; s[o + 5] = u.z; s[o + 6] = v.x; s[o + 7] = v.y; s[o + 8] = v.z;
        s[o + 9] = dbl > 0 ? (tot / SAMPLES) / dbl : 0;
      }
    }
  }
  cache.set(geo, s); return s;
}

// the box, in a view: everything the measure needs, computed once per box
export function boxFrame(view, canvasRect, x0, y0, x1, y1) {
  const cam = view.camera; cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements;
  const eye = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld), fwd = cam.getWorldDirection(new THREE.Vector3());
  const [l, t, w, h] = view.rect, R = canvasRect, near = cam.near || 0.1;
  // NDC to client pixels as app.screenOf has it; so the box's own pixel edges, put in NDC
  const nx = (px) => ((px - R.left) / R.width - l) / w * 2 - 1, ny = (py) => 1 - ((py - R.top) / R.height - t) / h * 2;
  return { vp, eye, fwd, near, bx0: nx(x0), bx1: nx(x1), by0: ny(y1), by1: ny(y0), stats: { asked: 0, sampled: 0, points: 0 } };
}

// 'in' / 'out' / null (partly, or behind the eye: sample it) for a world Box3, by its eight corners
function byCorners(F, b) {
  const e = F.vp; let all = true, minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    const W = e[3] * x + e[7] * y + e[11] * z + e[15]; if (W <= F.near) return null;
    const X = (e[0] * x + e[4] * y + e[8] * z + e[12]) / W, Y = (e[1] * x + e[5] * y + e[9] * z + e[13]) / W;
    if (X < F.bx0 || X > F.bx1 || Y < F.by0 || Y > F.by1) all = false;
    minx = Math.min(minx, X); maxx = Math.max(maxx, X); miny = Math.min(miny, Y); maxy = Math.max(maxy, Y);
  }
  if (all) return 'in';
  return maxx < F.bx0 || minx > F.bx1 || maxy < F.by0 || miny > F.by1 ? 'out' : null;
}

// one point with its patch: adds its covered screen area to acc[0] (inside the box) and acc[1] (all of it). A point behind
// the eye is outside, and counts as if at the near plane (a thing reaching behind the camera is not "mostly in" a box).
// `face`: 0 the patch counts from either side (a double-sided material, a floor rectangle), 1 only when its front is to
// the eye, -1 only its back (a back-sided material): what the renderer culls is not drawn, so a closed shape counts once
// per pixel of its outline, its far side not at all.
function addPoint(F, acc, px, py, pz, nx, ny, nz, k, face = 0) {
  const e = F.vp, dx = px - F.eye.x, dy = py - F.eye.y, dz = pz - F.eye.z;
  const depth = Math.max(F.near, dx * F.fwd.x + dy * F.fwd.y + dz * F.fwd.z), dot = nx * dx + ny * dy + nz * dz;
  if (face > 0 ? dot >= 0 : face < 0 ? dot <= 0 : false) return; // (the front of a counter-clockwise face looks back at the eye)
  const wgt = k * Math.abs(dot) / (depth * depth * depth); if (!(wgt > 0)) return;
  acc[1] += wgt; const W = e[3] * px + e[7] * py + e[11] * pz + e[15]; if (W <= F.near) return;
  const X = (e[0] * px + e[4] * py + e[8] * pz + e[12]) / W, Y = (e[1] * px + e[5] * py + e[9] * pz + e[13]) / W;
  if (X >= F.bx0 && X <= F.bx1 && Y >= F.by0 && Y <= F.by1) acc[0] += wgt;
}

// is this mesh drawn, as far as the thing's own parts go? (a hidden LOD level, a switched-off part: not). The group itself
// is not asked: whether the thing as a whole may be taken (the cut, a floor over it) is selectBox's question, as before.
const drawn = (o, top) => { for (let q = o; q && q !== top; q = q.parent) if (!q.visible) return false; return true; };

// a thing's world box, as world.boundsOf has it (every mesh's own box, to the world axes, padded 0.08), but from the box
// each geometry already keeps: boundsOf works each one out again from its vertices, which over a big map is most of the
// time a selection box takes (1,200 things: ~100 ms). Geometries are not edited in place (a thing's look is replaced).
const _b = new THREE.Box3(), _m = new THREE.Box3();
export function boundsFast(rec, skip) {
  _b.makeEmpty(); rec.group.updateMatrixWorld(true);
  rec.group.traverse(o => { if (!o.isMesh || o.isSprite || skip(o)) return; const g = o.geometry; if (!g) return; if (!g.boundingBox) g.computeBoundingBox(); _b.union(_m.copy(g.boundingBox).applyMatrix4(o.matrixWorld)); });
  return _b.isEmpty() ? null : _b.clone().expandByScalar(0.08);
}

// THE SHARE OF A THING (an object or a pawn: world.recs' rec) THAT IS INSIDE THE BOX, as drawn, 0..1. `bounds` is
// world.boundsOf(rec) (taken here when not given); `skip(o)` leaves a mesh out as boundsOf does.
export function thingShare(F, rec, bounds, skip) {
  F.stats.asked++;
  if (!bounds) return 0;
  const k = byCorners(F, bounds); if (k === 'in') return 1; if (k === 'out') return 0;
  F.stats.sampled++;
  const acc = [0, 0];
  rec.group.updateMatrixWorld(true);
  rec.group.traverse(o => {
    if (!o.isMesh || o.isSprite || o.material?.isLineMaterial || skip(o) || !drawn(o, rec.group) || o.material?.visible === false) return; // (fat lines, a pawn's ring: no area to speak of)
    const s = samplesOf(o.geometry); if (!s) return;
    const m = o.matrixWorld.elements; F.stats.points += SAMPLES;
    const mats = Array.isArray(o.material) ? o.material : [o.material], side = mats.some(q => q?.side === THREE.DoubleSide) ? THREE.DoubleSide : mats[0]?.side ?? THREE.FrontSide;
    const flip = o.matrixWorld.determinant() < 0 ? -1 : 1, face = side === THREE.DoubleSide ? 0 : (side === THREE.BackSide ? -1 : 1) * flip; // (a mirrored thing turns its faces inside out; three.js flips them back)
    for (let i = 0; i < s.length; i += 10) {
      const x = s[i], y = s[i + 1], z = s[i + 2];
      const px = m[0] * x + m[4] * y + m[8] * z + m[12], py = m[1] * x + m[5] * y + m[9] * z + m[13], pz = m[2] * x + m[6] * y + m[10] * z + m[14];
      const ux = m[0] * s[i + 3] + m[4] * s[i + 4] + m[8] * s[i + 5], uy = m[1] * s[i + 3] + m[5] * s[i + 4] + m[9] * s[i + 5], uz = m[2] * s[i + 3] + m[6] * s[i + 4] + m[10] * s[i + 5];
      const vx = m[0] * s[i + 6] + m[4] * s[i + 7] + m[8] * s[i + 8], vy = m[1] * s[i + 6] + m[5] * s[i + 7] + m[9] * s[i + 8], vz = m[2] * s[i + 6] + m[6] * s[i + 7] + m[10] * s[i + 8];
      addPoint(F, acc, px, py, pz, uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx, s[i + 9], face); // (the world cross: the patch's world area and facing)
    }
  });
  return acc[1] > 0 ? acc[0] / acc[1] : 0;
}

// a floor rectangle [x0, z0, x1, z1] at height y: adds to acc as thingShare's points do (rooms; a building is its rooms)
export function addRect(F, acc, x0, z0, x1, z1, y) {
  F.stats.points += ROOM_GRID * ROOM_GRID;
  const k = (x1 - x0) * (z1 - z0) / (ROOM_GRID * ROOM_GRID);
  for (let i = 0; i < ROOM_GRID; i++) for (let j = 0; j < ROOM_GRID; j++) addPoint(F, acc, x0 + (x1 - x0) * (i + 0.5) / ROOM_GRID, y, z0 + (z1 - z0) * (j + 0.5) / ROOM_GRID, 0, 1, 0, k);
}
