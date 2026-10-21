// MEASURING: distances, rulers and templates (Harry and Fauna 2026-10-11; docs/RULERS.md). Pure functions: the relay,
// every client and the tests run the same code. Feet throughout; x and z are the ground plane, y is height.
//
//   distance(a, b, rule, { ra, rb })   THE distance function. Everything that shows a distance calls it.
//   format(d, { units })               "32 ft · 6 sq", "29 ft · 6 sq (25 across, 15 up)"
//   resolve(template, entities, at)    a template as concrete geometry (an attached one: where its pawn stands)
//   catches(geometry, pawn)            THE "who is caught" test. One function.
//   cells(geometry)                    the 5-ft squares whose centres are inside (the secondary cue)
//
// A TEMPLATE (a kept one is an entity, kind 'template', in the area like any other thing: core/commands.js):
//   { id, kind: 'template', shape, x, z, y, dir, size, width?, owner, rounds?, left?, attach?, src?, name?, hidden }
//   shape    line | cone | circle | sphere | cube
//   x, z, y  its origin (ignored while `attach` names a pawn on the table: then it is that pawn)
//   dir      radians in the ground plane: it points along (cos dir, sin dir) in (x, z)
//   size     feet: a line's length, a cone's length, a circle's or sphere's radius, a cube's side
//   width    a line's width (absent = 5)
export const CELL = 5;          // a square
export const LEVEL = 10;        // "one level's height": what a circle or a line reaches up to
export const LINE_WIDTH = 5;
export const SIZE_MAX = 1000, ROUNDS_MAX = 999, WIDTH_MAX = 100;
export const EPS = 0.05;        // touching edges do not count as overlapping
export const RULES = ['true', 'five', 'alt']; // straight-line (the default) · every diagonal 5 ft · diagonals alternate 5 / 10
export const RULE_NAMES = { true: 'True distance (straight line)', five: 'Squares: every diagonal 5 ft', alt: 'Squares: diagonals 5 / 10 alternating' };
export const SHAPES = ['line', 'cone', 'circle', 'sphere', 'cube'];
export const SHAPE_NAMES = { line: 'Line', cone: 'Cone', circle: 'Circle', sphere: 'Sphere', cube: 'Cube' };

// the space a pawn takes up, as a circle on the ground: 2.5 ft per square of its size (a 1-square pawn: 5 ft across)
export const pawnRadius = (e) => 2.5 * (e?.size > 1 ? e.size : 1);

// THE DISTANCE from a to b ({ x, y, z } each). ra / rb: the radius of the pawn that end is attached to (0 = a bare
// point), so a measurement between two pawns runs BASE EDGE TO BASE EDGE, not centre to centre.
//   true   straight line in 3D. Across the ground the two radii come off first (two pawns side by side: 0 ft); the
//          height difference is then combined with what is left: sqrt(across^2 + up^2).
//   five   counted in squares, every step 5 ft whichever way it goes (the larger of the counts along x, z and y).
//   alt    counted in squares, diagonal steps cost 5, 10, 5, 10 ...: 5 x (longest count + half the second longest,
//          rounded down).
//   For the two square-counting rules each axis is counted from centre to centre in whole squares, less the squares
//   a large pawn's own space covers beyond its middle one (so two pawns side by side are 1 square = 5 ft apart, as
//   those tables count it).
// Returns { ft, across, up, squares, rule }: `up` is signed (negative = b is lower), `squares` = ft / 5.
export function distance(a, b, rule = 'true', { ra = 0, rb = 0 } = {}) {
  const dx = b.x - a.x, dz = b.z - a.z, dy = (b.y || 0) - (a.y || 0);
  if (rule !== 'five' && rule !== 'alt') {
    const across = Math.max(0, Math.hypot(dx, dz) - ra - rb), ft = Math.hypot(across, dy);
    return { ft, across, up: dy, squares: ft / CELL, rule: 'true' };
  }
  const off = (r) => r > 0 ? r / CELL - 0.5 : 0, red = off(ra) + off(rb);
  const nx = Math.max(0, Math.round(Math.abs(dx) / CELL - red)), nz = Math.max(0, Math.round(Math.abs(dz) / CELL - red)), ny = Math.round(Math.abs(dy) / CELL);
  const count = (...n) => { n.sort((p, q) => q - p); return rule === 'five' ? n[0] : n[0] + Math.floor(n[1] / 2); };
  const sq = count(nx, nz, ny), flat = count(nx, nz, 0);
  return { ft: sq * CELL, across: flat * CELL, up: Math.sign(dy) * ny * CELL, squares: sq, rule };
}

// How a distance is written. Feet and 5-ft squares are the campaign's units; a campaign set to metres reads 1.5 m a
// square (5 ft = 1.5 m, the usual conversion at the table), and the squares stay squares.
const UNIT = { ft: { k: 1, label: 'ft', dp: 0 }, m: { k: 0.3, label: 'm', dp: 1 } };
export const unitNumber = (ft, units = 'ft') => { const u = UNIT[units] || UNIT.ft, p = 10 ** u.dp; return Math.round(ft * u.k * p) / p; };
export const unitLabel = (units = 'ft') => (UNIT[units] || UNIT.ft).label;
export const feetText = (ft, units = 'ft') => `${unitNumber(ft, units)} ${unitLabel(units)}`;
export function format(d, { units = 'ft', squares = true } = {}) {
  let s = feetText(d.ft, units);
  if (squares) s += ` · ${Math.round(d.ft / CELL)} sq`;
  if (Math.abs(d.up) >= 0.5) s += ` (${unitNumber(d.across, units)} across, ${unitNumber(Math.abs(d.up), units)} ${d.up > 0 ? 'up' : 'down'})`;
  return s;
}

// A TEMPLATE AS GEOMETRY. `at(id)` may give where a pawn is DRAWN right now (a drag in progress), else its stored
// place is used. Attached to a pawn on the table, the template is measured from the EDGE of that pawn's space, as a
// ruler is: a circle or sphere is centred on the pawn and reaches `size` beyond its edge; a line, cone or cube starts
// at the edge, on the side it points.
export function resolve(t, ents = {}, at = null) {
  const e = t.attach ? ents[t.attach] : null, pawn = e && e.kind === 'token' ? e : null;
  const dir = t.dir || 0;
  let x = t.x, z = t.z, y = t.y || 0, size = t.size;
  if (pawn) {
    const p = at?.(pawn.id) || pawn, r = pawnRadius(pawn);
    y = p.y || 0;
    if (t.shape === 'circle' || t.shape === 'sphere') { x = p.x; z = p.z; size += r; } else { x = p.x + Math.cos(dir) * r; z = p.z + Math.sin(dir) * r; }
  }
  return { shape: t.shape, x, y, z, dir, size, width: t.width || LINE_WIDTH, on: !!pawn };
}
// the same from two points (a live ruler turned into a shape travels as its two ends): a = the origin, b = its far end
export function fromEnds(shape, a, b, width) {
  return { shape, x: a.x, y: a.y || 0, z: a.z, dir: Math.atan2(b.z - a.z, b.x - a.x), size: Math.hypot(b.x - a.x, b.z - a.z), width: width || LINE_WIDTH, on: false };
}
// the far end of a template's own handle: where its size and direction are dragged from
export const endOf = (g) => ({ x: g.x + Math.cos(g.dir) * g.size, y: g.y, z: g.z + Math.sin(g.dir) * g.size });

// ITS OUTLINE ON THE GROUND: a polygon ([[x, z] ...]) for a line, a cone and a cube; null for the two round ones
// (their outline is the circle of radius `size` round the origin).
//   line   `size` long from the origin, `width` wide (the origin is the middle of its near end)
//   cone   as wide at any point as that point is far from the origin, flat at its far end: a triangle `size` long and
//          `size` wide there (5e's cone)
//   cube   `size` on a side, the origin in the middle of the near face
export function outline(g) {
  if (g.shape === 'circle' || g.shape === 'sphere') return null;
  const ux = Math.cos(g.dir), uz = Math.sin(g.dir), nx = -uz, nz = ux, L = g.size;
  const at = (along, side) => [g.x + ux * along + nx * side, g.z + uz * along + nz * side];
  if (g.shape === 'cone') return [at(0, 0), at(L, L / 2), at(L, -L / 2)];
  const h = (g.shape === 'cube' ? L : g.width) / 2;
  return [at(0, -h), at(0, h), at(L, h), at(L, -h)];
}
const inPoly = (pts, x, z) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; } return inside; };
const segDist = (x, z, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0; return Math.hypot(x - ax - dx * t, z - az - dz * t); };
// does a circle on the ground overlap a polygon by more than a hair?
export function circleOverPoly(cx, cz, r, pts) {
  if (inPoly(pts, cx, cz)) return true;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if (segDist(cx, cz, pts[j], pts[i]) < r - EPS) return true;
  return false;
}
// is a point on the ground inside the outline? (the squares' centres; the pointer over a kept template)
export function inPlan(g, x, z) { const o = outline(g); return o ? inPoly(o, x, z) : Math.hypot(x - g.x, z - g.z) < g.size; }

// WHO IS CAUGHT. One function; the exact test:
//   A pawn's base is the circle of its space on the ground (radius 2.5 ft per square of its size) at the height of
//   its feet. It is caught when that circle OVERLAPS the template's outline on the ground by more than a hair
//   (0.05 ft: bases that only touch the edge are out), AND its feet are within the template's height:
//     circle, line   from 1 ft under the template's floor up to one level (10 ft) above it: the things on that level
//                    (and a flyer under its ceiling), never the floor above or below
//     cube           from 1 ft under its floor up to its side length
//     cone           no further above or below the origin than half the cone's width where the pawn stands (a cone
//                    opens upward and downward as it opens sideways; never less than 1 ft)
//     sphere         a true 3D radius: the nearest point of the base to the origin is closer than the radius, so it
//                    reaches other levels and flyers
// `g` is resolve()'s geometry; `p` is { x, y, z, size }.
export function catches(g, p) {
  const r = pawnRadius(p), dy = (p.y || 0) - g.y, flat = Math.hypot(p.x - g.x, p.z - g.z);
  if (g.shape === 'sphere') return Math.hypot(Math.max(0, flat - r), dy) < g.size - EPS;
  if (g.shape === 'circle') return flat < g.size + r - EPS && dy >= -1 && dy < LEVEL - 1;
  if (!circleOverPoly(p.x, p.z, r, outline(g))) return false;
  if (g.shape === 'cube') return dy >= -1 && dy < Math.max(g.size, 1) - EPS;
  if (g.shape === 'cone') { const along = (p.x - g.x) * Math.cos(g.dir) + (p.z - g.z) * Math.sin(g.dir), w = Math.min(g.size, Math.max(0, along) + r); return Math.abs(dy) < Math.max(1, w / 2); }
  return dy >= -1 && dy < LEVEL - 1; // line
}
// every pawn of `ents` a template catches (its own attached pawn is never "caught" by its aura), nearest first
export function caughtBy(t, ents, at = null) {
  const g = resolve(t, ents, at), out = [];
  for (const e of Object.values(ents)) {
    if (e.kind !== 'token' || e.id === t.attach) continue;
    const p = at?.(e.id) || e;
    if (catches(g, { x: p.x, y: p.y || 0, z: p.z, size: e.size })) out.push(e);
  }
  return out.sort((p, q) => Math.hypot(p.x - g.x, p.z - g.z) - Math.hypot(q.x - g.x, q.z - g.z));
}

// THE SQUARES: the centres of the 5-ft squares that lie inside the outline (many tables rule by squares). Nothing for
// a template so large that tinting it would be thousands of squares.
export const CELLS_MAX = 2500;
export function cells(g) {
  const o = outline(g), xs = o ? o.map(p => p[0]) : [g.x - g.size, g.x + g.size], zs = o ? o.map(p => p[1]) : [g.z - g.size, g.z + g.size];
  const i0 = Math.floor(Math.min(...xs) / CELL), i1 = Math.floor(Math.max(...xs) / CELL), j0 = Math.floor(Math.min(...zs) / CELL), j1 = Math.floor(Math.max(...zs) / CELL);
  if (!(g.size > 0) || (i1 - i0 + 1) * (j1 - j0 + 1) > CELLS_MAX * 4) return [];
  const out = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL; if (inPlan(g, cx, cz)) out.push([cx, cz]); }
  return out.length > CELLS_MAX ? [] : out;
}

// a template's short name ("Cone 15 ft"; its own name when it has one)
export const templateName = (t, units = 'ft') => t.name || `${SHAPE_NAMES[t.shape] || 'Template'} ${feetText(t.size, units)}`;

// A RULER IN PRESENCE (never stored): what a seat is measuring right now, as its two ends.
//   { k: 'rule' | 'move' | a shape, a: [x, z, y], b: [x, z, y], ap?, bp?: the pawn an end is on, w?: a line's width }
// 'move' = the line a dragged pawn has travelled so far. The relay passes only this shape on.
const KINDS = ['rule', 'move', ...SHAPES];
export function cleanRuler(r) {
  if (!r || typeof r !== 'object') return null;
  const pt = (v) => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e5) ? v.map(n => Math.round(n * 100) / 100) : null;
  const a = pt(r.a), b = pt(r.b); if (!a || !b) return null;
  const id = (v) => typeof v === 'string' && /^tok_[0-9a-z]{4,24}$/.test(v);
  return { k: KINDS.includes(r.k) ? r.k : 'rule', a, b, ...(id(r.ap) && { ap: r.ap }), ...(id(r.bp) && { bp: r.bp }), ...(typeof r.w === 'number' && r.w > 0 && r.w <= WIDTH_MAX && { w: r.w }) };
}
