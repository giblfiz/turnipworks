// ROOM FOOTPRINTS (Harry 2026-10-05: "If I drag out a new room that overlaps, we are just going to make whatever
// sections of it don't overlap into a room; this will probably mostly cause L-shaped rooms").
//
// A room stands on 5-ft cells inside its bounding rectangle, recipe.{x, z, w, d} (cells). Most rooms are the whole
// rectangle and carry nothing more. A room that is not carries
//     recipe.outline   its outline as ONE closed polygon of grid points: [[u, v], ...] in cells, relative to (x, z),
//                      clockwise seen from above, starting at its top-left-most corner, no point in the middle of a
//                      straight run. An L is six points, a U or a notched side eight.
// The bounding rectangle stays in the recipe, so everything that only needs a box (framing, thumbnails, "is it on
// screen") reads x, z, w, d as before, and every campaign saved before outlines existed loads unchanged.
//
// EVERYTHING ELSE ASKS THIS FILE, never the rectangle:
//     cellsOf(rc)        the cells the room stands on (a cell is in when its CENTRE is inside the outline)
//     contains / overlap / areaCells / perimeterKeys / boundary
//     innerRect(rc)      the largest rectangle that fits inside ("the room" for furniture, and where the label sits)
//     rectsOf(rc)        the room cut into a few rectangles, largest first (the layout solver furnishes each)
//     polyFeet(rc)       the outline in feet (fog regions, the selection look)
// That is the seam for what Harry wants later (docs/VERTICAL.md "Later: rooms that are not rectangles"): outlines with
// SLANTED edges (rises of 1 in 4, 1 in 2 and 1 in 1 between grid points) for towers and ships. The stored form is
// already a polygon of grid points and cellsOf already tests cell centres against it, so slants need: outlineProblem to
// allow those slopes, boundary() to return the slanted edges as well as cell edges (walls and the edge keys follow),
// floors clipped to the polygon, and wall pieces stretched along a slant. The callers of this file do not change.
//
// Pure data, no three.js, no DOM: the relay and the browser run the same code.

const key = (i, j) => `${i}:${j}`;
const cache = new WeakMap(); // recipe object -> derived data (recipes are immutable: a change makes a new object)

export const rectOutline = (w, d) => [[0, 0], [w, 0], [w, d], [0, d]];
export const outlineOf = (rc) => rc.outline || rectOutline(rc.w, rc.d);
export const isShaped = (rc) => !!rc?.outline;

// is the point inside the polygon? (even-odd rule; works for slanted edges too)
function inside(poly, px, pz) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}

function derive(rc) {
  let D = cache.get(rc);
  if (D) return D;
  const list = [], set = new Set(), poly = rc.outline;
  for (let j = 0; j < rc.d; j++) for (let i = 0; i < rc.w; i++) if (!poly || inside(poly, i + 0.5, j + 0.5)) { list.push([i, j]); set.add(key(i, j)); }
  D = { list, set };
  cache.set(rc, D);
  return D;
}
// the room's cells as [i, j] offsets from (rc.x, rc.z)
export const cellsOf = (rc) => derive(rc).list;
export const areaCells = (rc) => derive(rc).list.length;
// does the room stand on world cell (gx, gz)?
export const hasCell = (rc, gx, gz) => gx >= rc.x && gz >= rc.z && gx < rc.x + rc.w && gz < rc.z + rc.d && derive(rc).set.has(key(gx - rc.x, gz - rc.z));
// is the point (feet) on the room's floor? (edges count, as they did for rectangles)
export function contains(rc, x, z, cell = 5) {
  if (x < rc.x * cell || z < rc.z * cell || x > (rc.x + rc.w) * cell || z > (rc.z + rc.d) * cell) return false;
  if (!rc.outline) return true;
  const gx = Math.min(rc.x + rc.w - 1, Math.floor(x / cell)), gz = Math.min(rc.z + rc.d - 1, Math.floor(z / cell));
  return hasCell(rc, gx, gz) || (x % cell === 0 && hasCell(rc, gx - 1, gz)) || (z % cell === 0 && hasCell(rc, gx, gz - 1));
}
const boxesOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
// do two rooms share a cell? (two L-shaped rooms may nest inside each other's bounding rectangles)
export function overlap(a, b) {
  if (!boxesOverlap(a, b)) return false;
  if (!a.outline && !b.outline) return true;
  const [s, t] = areaCells(a) <= areaCells(b) ? [a, b] : [b, a];
  for (const [i, j] of cellsOf(s)) if (hasCell(t, s.x + i, s.z + j)) return true;
  return false;
}

// The room's boundary as unit wall segments. Each: { key, side, index, line }:
//   key    the wall-edge key ('h:gx:gz' runs along x on grid line z = gz; 'v:gx:gz' along z on line x = gx), world cells
//   side   which side of the ROOM it is on (N: the room lies south of it, and so on)
//   index  the cell offset along the bounding rectangle's side (from rc.x for N / S, from rc.z for W / E)
//   line   the grid line it sits on, as an offset from the bounding rectangle (an inner wall is not on its edge)
export function boundary(rc) {
  const D = derive(rc);
  if (D.boundary) return D.boundary;
  const out = [], has = (i, j) => D.set.has(key(i, j));
  for (const [i, j] of D.list) {
    if (!has(i, j - 1)) out.push({ key: `h:${rc.x + i}:${rc.z + j}`, side: 'N', index: i, line: j });
    if (!has(i, j + 1)) out.push({ key: `h:${rc.x + i}:${rc.z + j + 1}`, side: 'S', index: i, line: j + 1 });
    if (!has(i - 1, j)) out.push({ key: `v:${rc.x + i}:${rc.z + j}`, side: 'W', index: j, line: i });
    if (!has(i + 1, j)) out.push({ key: `v:${rc.x + i + 1}:${rc.z + j}`, side: 'E', index: j, line: i + 1 });
  }
  return (D.boundary = out);
}
// WALL KEYS CARRY THEIR HEIGHT (storeys, 2026-10-05): 'h:x:z@<y>', 'v:x:z@<y>', 'c<x>:<z>@<y>', y = the floor height in
// feet of the rooms the wall belongs to. At y = 0 the suffix is left out, so every key in every campaign saved before
// storeys is unchanged. boundary() above gives the keys WITHOUT the suffix (one height at a time, as the wall engine
// works); perimeterKeys() gives them with it.
export const levelSuffix = (y) => y ? `@${y}` : '';
export const keyLevel = (key) => { const i = key.indexOf('@'); return i < 0 ? 0 : +key.slice(i + 1); };
export const keyBase = (key) => { const i = key.indexOf('@'); return i < 0 ? key : key.slice(0, i); };
export const keyAt = (key, y) => keyBase(key) + levelSuffix(y);
// every wall-edge key on the room's boundary, and every post position on it ('c<x>:<z>': the grid vertices it passes),
// at the room's own height
export function perimeterKeys(rc) {
  const sfx = levelSuffix(rc.y || 0);
  return sfx ? flatKeys(rc).map(k => k + sfx) : flatKeys(rc);
}
function flatKeys(rc) {
  const keys = [], verts = new Set();
  for (const e of boundary(rc)) {
    keys.push(e.key);
    const [d, xs, zs] = e.key.split(':'), x = +xs, z = +zs;
    verts.add(`c${x}:${z}`); verts.add(d === 'h' ? `c${x + 1}:${z}` : `c${x}:${z + 1}`);
  }
  return [...keys, ...verts];
}

// ---------------- outlines from cells, and back ----------------
// The outline of a set of cells ([i, j] in any integer frame), clockwise seen from above (z grows downward on the map),
// collinear points merged, starting at the top-left-most corner. null when the cells are not ONE simple shape: several
// pieces, a hole, or two parts touching only at a corner.
export function traceOutline(cells) {
  if (!cells.length) return null;
  const set = new Set(cells.map(([i, j]) => key(i, j))), has = (i, j) => set.has(key(i, j));
  const next = new Map(); let count = 0;
  const add = (a, b) => { const k = key(a[0], a[1]); if (next.has(k)) next.set(k, null); else next.set(k, b); count++; }; // two edges out of one point: a pinch
  for (const [i, j] of cells) {
    if (!has(i, j - 1)) add([i, j], [i + 1, j]);             // top, heading east
    if (!has(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);     // right, heading south
    if (!has(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);     // bottom, heading west
    if (!has(i - 1, j)) add([i, j + 1], [i, j]);             // left, heading north
  }
  let start = null;
  for (const [i, j] of cells) if (!has(i, j - 1) && !has(i - 1, j) && (!start || j < start[1] || (j === start[1] && i < start[0]))) start = [i, j];
  const pts = []; let p = start, used = 0;
  do {
    const q = next.get(key(p[0], p[1]));
    if (!q) return null;
    pts.push(p); p = q; used++;
    if (used > count) return null;
  } while (p[0] !== start[0] || p[1] !== start[1]);
  if (used !== count) return null; // edges left over: a hole, or a second piece
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[(k + pts.length - 1) % pts.length], b = pts[k], c = pts[(k + 1) % pts.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b); // a real corner
  }
  return out;
}
const sameOutline = (a, b) => a.length === b.length && a.every((p, k) => p[0] === b[k][0] && p[1] === b[k][1]);
// Why a recipe's outline is not acceptable, or null. Today an outline's edges run along the grid (see the note at the
// top for slants); it must fill its bounding rectangle's extent and be one simple shape.
export function outlineProblem(rc) {
  const o = rc.outline;
  if (o == null) return null;
  if (!Array.isArray(o) || o.length < 4 || o.length > 64) return 'outline: 4 to 64 [x, z] grid points';
  if (!o.every(p => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] <= rc.w && p[1] <= rc.d)) return 'outline: whole-cell points inside the room\'s rectangle';
  for (let k = 0; k < o.length; k++) { const a = o[k], b = o[(k + 1) % o.length]; if ((a[0] !== b[0]) === (a[1] !== b[1])) return 'outline: every edge runs along the grid, east-west or north-south'; }
  const cells = []; for (let j = 0; j < rc.d; j++) for (let i = 0; i < rc.w; i++) if (inside(o, i + 0.5, j + 0.5)) cells.push([i, j]);
  if (!cells.length) return 'outline: encloses no cell';
  const traced = traceOutline(cells);
  if (!traced || !sameOutline(traced, o)) return 'outline: one simple shape, clockwise from its top-left corner, with no extra points';
  const xs = o.map(p => p[0]), zs = o.map(p => p[1]);
  if (Math.min(...xs) !== 0 || Math.min(...zs) !== 0 || Math.max(...xs) !== rc.w || Math.max(...zs) !== rc.d) return 'outline: must reach all four sides of the room\'s rectangle (x, z, w, d are its bounding box)';
  return null;
}
// the outline to store: nothing for a plain rectangle
export const storedOutline = (rc) => rc.outline && !sameOutline(rc.outline, rectOutline(rc.w, rc.d)) ? rc.outline.map(([u, v]) => [u, v]) : undefined;
// one clockwise quarter turn of an outline inside its w x d rectangle (the rectangle becomes d x w): (u, v) -> (d - v, u)
export function turnOutline(outline, w, d) {
  const cells = []; for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) if (inside(outline, i + 0.5, j + 0.5)) cells.push([d - 1 - j, i]);
  return traceOutline(cells);
}

// ---------------- drawing a room over others ----------------
// What is left of a dragged rectangle (cells) once the cells other rooms stand on are taken out: its separate pieces,
// biggest first. Each piece is a room recipe's shape { x, z, w, d, outline?, cells: n } or, when it cannot be one
// (it would enclose another room), { ..., hole: true }. `covered` are the rectangle's cells that are taken.
export function piecesOf(rect, others) {
  const free = new Set(), covered = [];
  for (let gz = rect.z; gz < rect.z + rect.d; gz++) for (let gx = rect.x; gx < rect.x + rect.w; gx++) {
    if (others.some(o => hasCell(o, gx, gz))) covered.push([gx, gz]); else free.add(key(gx, gz));
  }
  const pieces = [];
  for (const k0 of [...free]) {
    if (!free.has(k0)) continue;
    const comp = [], stack = [k0.split(':').map(Number)]; free.delete(k0);
    while (stack.length) {
      const [gx, gz] = stack.pop(); comp.push([gx, gz]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(gx + dx, gz + dz); if (free.has(k)) { free.delete(k); stack.push([gx + dx, gz + dz]); } }
    }
    const x = Math.min(...comp.map(c => c[0])), z = Math.min(...comp.map(c => c[1])), w = Math.max(...comp.map(c => c[0])) - x + 1, d = Math.max(...comp.map(c => c[1])) - z + 1;
    const outline = traceOutline(comp.map(([gx, gz]) => [gx - x, gz - z]));
    const p = { x, z, w, d, cells: comp.length, world: comp };
    if (!outline) p.hole = true; else if (comp.length !== w * d) p.outline = outline;
    pieces.push(p);
  }
  pieces.sort((a, b) => b.cells - a.cells || a.z - b.z || a.x - b.x);
  return { pieces, covered };
}

// ---------------- rectangles inside a room ----------------
// the largest rectangle of cells in a set (ties: the one nearest the middle, then the top-left-most): { i, j, w, d }
function largestRect(set, W, D, cx, cz) {
  const h = new Array(W).fill(0); let best = null;
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) h[i] = set.has(key(i, j)) ? h[i] + 1 : 0;
    for (let i = 0; i < W; i++) {
      let m = Infinity;
      for (let e = i; e < W && h[e] > 0; e++) { // rectangles whose bottom row is j, spanning columns i..e
        m = Math.min(m, h[e]);
        const r = { i, j: j - m + 1, w: e - i + 1, d: m }, area = r.w * r.d, off = Math.abs(r.i + r.w / 2 - cx) + Math.abs(r.j + r.d / 2 - cz);
        if (!best || area > best.area || (area === best.area && (off < best.off - 1e-9 || (Math.abs(off - best.off) < 1e-9 && (r.j < best.r.j || (r.j === best.r.j && r.i < best.r.i)))))) best = { r, area, off };
      }
    }
  }
  return best && best.r;
}
// the largest rectangle that fits inside the room, as cell offsets from (rc.x, rc.z)
export function innerRect(rc) {
  const D = derive(rc);
  return D.inner || (D.inner = rc.outline ? largestRect(D.set, rc.w, rc.d, rc.w / 2, rc.d / 2) : { i: 0, j: 0, w: rc.w, d: rc.d });
}
// the room as a few rectangles, largest first (the first is innerRect): what the layout solver furnishes, one at a time.
// A staircase-like shape stops after `max` pieces; the cells left over simply stay bare.
export function rectsOf(rc, max = 5) {
  if (!rc.outline) return [{ i: 0, j: 0, w: rc.w, d: rc.d }];
  const D = derive(rc);
  if (D.rects) return D.rects;
  const left = new Set(D.set), out = [];
  while (left.size && out.length < max) {
    const r = out.length ? largestRect(left, rc.w, rc.d, out[0].i + out[0].w / 2, out[0].j + out[0].d / 2) : innerRect(rc);
    out.push(r);
    for (let j = r.j; j < r.j + r.d; j++) for (let i = r.i; i < r.i + r.w; i++) left.delete(key(i, j));
  }
  return (D.rects = out);
}
// where the room's label (and anything else that wants "the middle of the room") goes, in feet: the middle of the
// largest rectangle inside it, which is always on its floor (the middle of an L's bounding box may be in the notch)
export function labelPoint(rc, cell = 5) { const r = innerRect(rc); return [(rc.x + r.i + r.w / 2) * cell, (rc.z + r.j + r.d / 2) * cell]; }
// the outline in world feet (fog regions, the selection look)
export const polyFeet = (rc, cell = 5) => outlineOf(rc).map(([u, v]) => [(rc.x + u) * cell, (rc.z + v) * cell]);
