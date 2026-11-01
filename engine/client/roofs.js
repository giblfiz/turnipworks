// Computed roofs (docs/VERTICAL.md, Harry 2026-10-05: "A roof is basically a kind of room"). The SHAPE is worked out here,
// the SURFACE is modelled ROOF SECTIONS laid out instanced (2026-10-11; the four generated roofing textures drawn flat are
// the far look, the fallback and the comparison), the TRIM is generated props placed by rule. Nothing is an entity.
//
//   planRoofs(rooms, opts) -> { roofs: [roof per room], heightAt(x, z) }      pure: no three.js, runs in node (tests)
//   buildRoof(roof, { THREE, textures, wallColor }) -> THREE.Group            the meshes of one planned roof
//   loadRoofTextures(THREE, urlOf) -> { thatch, tile, slate, shingle }        the four roofing textures, set to tile
//   sectionLayout(roof, sizes) -> { style, count, matrix, clip, ... }         where the roof sections go (pure; tests)
//   roofSectionKit(THREE, scene, info) -> kit                                 one style's section, ready to instance
//   resolveKit(has) -> { role: { cat, standIn } }                             which catalog ids the trim uses today
//
// HOW THE SHAPE IS MADE. Every rectangle of every room is a little roof of its own: a HEIGHT FIELD over its rectangle,
// the lowest of its planes (a gable: two; a hip: four; flat: one). The roof of a building is the HIGHEST of its
// rectangles' fields at every point. That one rule makes joined rooms run into each other: a narrow wing's roof dies
// into the big roof it meets, two rooms in a line share one ridge, and nothing is ever covered twice. A gable whose end
// meets the side of a neighbour is carried on into the neighbour as far as the neighbour's ridge (a cross gable), so the
// two meet in valleys rather than at a wall. All the cutting is exact (convex polygons against half-planes), so there is
// no grid, no gap and no z-fighting.
//
// Heights are feet. `top` is where the roof SITS: the top of the room's walls (core/height.js ceilingOf: floor + 9).
// A pitched roof's eaves are at `top`; a flat roof is the 1-ft slab from top to top + 1, so its walking surface is at
// top + 1, level with the floor of the storey beside it.
import { rectsOf, cellsOf } from '../core/footprint.js';
import { roofStyleKey } from '../core/height.js';

export const ROOF_DEFAULTS = {
  cell: 5,
  pitch: 45,      // degrees (Harry 2026-10-11: "use them at 45 degrees"; it was 40)
  maxRise: 15,    // ft: a room wider than 30 ft has its ridge capped here (the pitch flattens), so a 40-ft hall does not tower (it was 9, which at 45 degrees would have flattened every room wider than 18 ft)
  overhang: 1,    // ft: eaves and gable verges past the wall line
  dormerEvery: 20, dormerChance: 0.3, finialChance: 0.2,
};
// style -> the roofing texture's catalog id (catalog/objects-vertical.catalog.md A12) and a plain colour for when it is absent
export const ROOF_STYLES = {
  thatch: { cat: 'roofing-thatch', color: '#a58a4f', label: 'Thatch' },
  tile: { cat: 'roofing-tile-clay', color: '#a4573a', label: 'Clay tile' },
  slate: { cat: 'roofing-slate', color: '#5b6068', label: 'Slate shingle' },
  shingle: { cat: 'roofing-shingle-wood', color: '#7a5a3c', label: 'Wood shingle' },
  // THE TEMPLE ROOF (Harry 2026-10-27: "we probably need a marble roof to look like a temple"): big marble pan tiles under
  // rounded cover tiles, at a classical temple's LOW pitch (a style may carry its own pitch: the planner uses it for every
  // rectangle of a room in that style). Its painted picture is not in the library: `file` is beside the roof sections
  // (data/roof/, built by experiments/2026-10-27-roofs-temple). No dormers on a temple.
  marble: { cat: 'roofing-marble', file: 'roof/roofing-marble.webp', color: '#e6dccb', label: 'Marble', pitch: 22, dormers: false },
  // FLAT SURFACES (2026-10-27; core/height.js FLAT_STYLES): a generated seamless 5-ft texture each, a client data file
  // (`tex`, under engine/client/data/: experiments/2026-10-27-roofs-flat/textures), an existing floor texture as the
  // stand-in until it loads, else the plain colour. `skirt`: the colour of the slab's sides. `ft`: how many feet one picture
  // covers (5 unless said: at 5 ft a 30-ft roof shows 36 copies and any landmark in an organic picture marches as a grid,
  // Gemini 2026-10-27; lead at 10 ft has its rolls 5 ft apart, as real lead rolls are). ('flat', the one stand-in deck
  // before, is a word for 'deck': core/height.js ROOF_ALIAS.)
  deck: { flat: true, tex: 'roof/roof-flat--deck.webp', standIn: ['floor-boards-rough', 'floor-planks-dark'], color: '#7a6a55', skirt: '#5e5040', label: 'Plank deck' },
  flagstone: { flat: true, tex: 'roof/roof-flat--flagstone.webp', standIn: ['floor-flagstone-large', 'floor-flagstone-square'], color: '#7c7a74', skirt: '#68665f', label: 'Flagstone' },
  lead: { flat: true, ft: 10, tex: 'roof/roof-flat--lead.webp', standIn: ['floor-flagstone-square'], color: '#6b7178', skirt: '#5a5f66', label: 'Lead sheet' },
  turf: { flat: true, ft: 15, tex: 'roof/roof-flat--turf.webp', standIn: [], color: '#5f7040', skirt: '#5c4a35', label: 'Turf' },
  plaster: { flat: true, ft: 15, tex: 'roof/roof-flat--plaster.webp', standIn: [], color: '#d9cfbb', skirt: '#c9bba1', label: 'Whitewash' },
};
// the surface the FLAT part of a roof wears (a lower storey's open deck, a flat-shaped roof): a flat style is its own; a
// pitched style has its usual flat: lead with slate (the mansion's leads), stone with marble, a plank deck with the rest
export const FLAT_FOR = { slate: 'lead', marble: 'flagstone' };
export const flatSurfaceOf = (style) => { const s = roofStyleKey(style); return ROOF_STYLES[s]?.flat ? s : FLAT_FOR[s] || 'deck'; };
// what runs round a flat roof's open edges (core/height.js ROOF_EDGES; roofEdgeOf picks the default): the trim role laid
// along each 5-ft edge, the role at each outer corner, and their stand-in boxes (ft: height, thickness; corner side, height,
// how far in from the corner its middle stands)
export const EDGE_KIT = {
  parapet: { run: 'parapet', corner: 'corner', h: 3, t: 1, cw: 1.4, ch: 3.6, ci: 0.5 },
  battlements: { run: 'battlement', corner: 'merlon', h: 5, t: 1.33, cw: 2.33, ch: 5.5, ci: 1.17 },
  railing: { run: 'railing', corner: null, h: 3, t: 0.4 },
  none: null,
};
// a client data file (a flat surface's own texture), cache-stamped like the roof sections (world.js roofSections)
export const roofDataUrl = (path) => new URL(`./data/${path}?v=${globalThis.TW_V || 'dev'}`, import.meta.url).href;
export const TURRET = { w: 4.5, h: 11, inset: 1, min: 10 }; // ft: a corner turret's box, how far in from the corner its middle stands, the smallest roof side that gets them
// the trim: each role is the first of these catalog ids the library has; anything after the first is a stand-in
export const ROOF_KIT = {
  chimney: ['chimney-stack', 'pillar-square', 'post-timber'],
  dormer: ['roof-dormer'],
  parapet: ['parapet-straight', 'wall-crenellated'],
  corner: ['parapet-corner', 'pillar-square'],
  battlement: ['wall-crenellated', 'parapet-straight'],   // (2026-10-27) a castle's edge: merlons and crenels
  merlon: ['wall-crenellated-corner', 'parapet-corner'],   //   its corner block
  turret: ['roof-bartizan', 'wall-crenellated-corner'],    //   a corner turret (generated 2026-10-27)
  railing: ['railing-wood'],                               //   a deck's timber railing
  ridge: ['roof-ridge'],
  finial: ['roof-finial', 'weathervane'],
};
export function resolveKit(has = () => false) {
  const out = {};
  for (const [role, ids] of Object.entries(ROOF_KIT)) { const i = ids.findIndex(id => has(id)); out[role] = { cat: i < 0 ? null : ids[i], standIn: i !== 0, wants: ids[0] }; }
  return out;
}

// ---------------- small exact geometry: convex polygons in plan (x, z) ----------------
const EPS = 1e-7;
const area2 = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
// keep the part of a convex polygon where a*x + b*z + c >= 0 (a constant half-plane keeps all or nothing: `tie` decides 0)
function clip(poly, [a, b, c], tie = true) {
  if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return c > 1e-9 || (Math.abs(c) <= 1e-9 && tie) ? poly : [];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c;
    if (dp >= -EPS) out.push(p);
    if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out.length >= 3 && Math.abs(area2(out)) > 1e-6 ? out : [];
}
const neg = ([a, b, c]) => [-a, -b, -c];
// a convex polygon minus a convex region given as half-planes [{h, tie}]: convex pieces
function subtract(poly, halves) {
  const out = []; let rem = poly;
  for (const { h, tie } of halves) {
    const outside = clip(rem, neg(h), !tie); if (outside.length) out.push(outside);
    rem = clip(rem, h, tie); if (!rem.length) return out;
  }
  return out; // what is left in `rem` is inside the region: gone
}
const rectPoly = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
const rectHalves = (r) => [[1, 0, -r.x0], [-1, 0, r.x1], [0, 1, -r.z0], [0, -1, r.z1]];
const inRect = (r, x, z, e = 1e-6) => x >= r.x0 - e && x <= r.x1 + e && z >= r.z0 - e && z <= r.z1 + e;
const hOf = (pl, x, z) => pl.a * x + pl.b * z + pl.c;
// a small seeded generator (mulberry32), so a roof's trim is the same in every client and changes with the seed
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const strSeed = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------------- the planner ----------------
// rooms: [{ id, building, x, z, w, d, outline? (5-ft cells, as a room recipe; or rect: [x, z, w, d]; or cells: [[gx, gz]...]),
//           top (ft: the top of its walls), y? (ft: its floor; lets the planner see which rooms stand on which),
//           style (ROOF_STYLES: a pitched or a flat surface; 'flat' = 'deck'), kind? ('gable' | 'hip' | 'flat': its SHAPE, room.roof.shape;
//           absent = gable), axis? ('x' | 'z': the way its ridge runs, room.roof.axis; absent = automatic), seed,
//           covered?: [[gx, gz]...], props?: false, none?: true (no roof: open to the sky), trim?: room.roof.trim (below),
//           edge? (EDGE_KIT: round the open edges of its flat part; default 'parapet'), turrets? (bartizans on its flat part's outer corners) }]
// SHAPE AND STYLE ARE SEPARATE (2026-10-27): kind 'flat' makes a flat roof whatever the style (it is drawn with the flat
// surface); a FLAT STYLE (deck, flagstone, lead, turf, plaster; 'flat' = deck) makes a flat roof whatever the kind, as 'flat' always did.
// A FORCED AXIS (a roof turned 90 degrees, Harry 2026-10-27: "rotate able on the 90 degree, so profiles can work") wins for
// every rectangle of that room: its ridge runs that way and its gable ends face the other pair of walls, even where the
// automatic choice would have pointed a wing at its neighbour. Joined rooms still run into each other by the one rule
// (the highest field wins), so a turned wing meets its neighbour in valleys or as a cross gable as the axes fall out.
// Each roof reports `axis` (as planned) and `autoAxis` (what it would have been without the force).
// opts:  { fires: [{ id, x, z }] (ft: fireplaces and hearths; each gets a chimney straight above it),
//          has: (catalogId) => bool, pitch, maxRise, overhang, dormers: bool, finials: bool }
export function planRoofs(rooms, opts = {}) {
  const O = { ...ROOF_DEFAULTS, ...opts }, C = O.cell, kit = resolveKit(O.has);
  const tanOf = (r) => Math.tan((r.pitch ?? ROOF_STYLES[r.style]?.pitch ?? O.pitch) * Math.PI / 180); // a room's own pitch, else its style's (marble: 22), else the default
  const R = rooms.map((r, order) => normalRoom(r, C, order));
  // covered cells: under a room that stands higher (its floor at or above this room's wall top), or stated outright
  for (const r of R) {
    r.coveredSet = new Set((r.covered || []).map(([gx, gz]) => `${gx}:${gz}`));
    for (const q of R) if (q !== r && q.y != null && q.y >= r.top - 0.5) for (const k of q.cellSet) if (r.cellSet.has(k)) r.coveredSet.add(k);
    r.open = r.cells.filter(([gx, gz]) => !r.coveredSet.has(`${gx}:${gz}`));
  }
  // parts: the rectangles that get a little roof each
  const parts = [];
  // a room with NO ROOF (none: true; room.roof.off, open to the sky) still covers the rooms under it (above), but gets no
  // roof and shapes no neighbour's: a roof that meets it ends there in a closed gable, as at the end of the house
  for (const r of R) {
    if (!r.open.length || r.none) continue;
    const flat = !!ROOF_STYLES[r.style]?.flat || r.kind === 'flat' || r.coveredSet.size > 0; // a storey with something built on part of it: the rest is a flat place to stand
    const rects = flat ? runsOf(r.open) : pitchedRects(r);
    for (const q of rects) {
      const p = { room: r, x0: q.gx * C, z0: q.gz * C, x1: (q.gx + q.w) * C, z1: (q.gz + q.d) * C, top: r.top, group: `${r.building ?? r.id}@${r.top}` };
      const lx = p.x1 - p.x0, lz = p.z1 - p.z0;
      p.cx = (p.x0 + p.x1) / 2; p.cz = (p.z0 + p.z1) / 2;
      // a rectangle the solver left as scraps (a one-cell stub of a staircase shape) is roofed flat rather than as a tiny gable
      p.kind = flat || q.scrap ? 'flat' : r.kind === 'hip' ? 'hip' : 'gable';
      p.axis = lx >= lz ? 'x' : 'z'; // the ridge runs along the long side
      p.half = Math.min(lx, lz) / 2; p.tan = Math.min(tanOf(r), O.maxRise / p.half); p.rise = p.tan * p.half;
      p.ridgeY = p.kind === 'flat' ? p.top + 1 : p.top + p.rise;
      p.i = parts.length; parts.push(p);
    }
  }
  const sameGroup = (a, b) => a !== b && a.group === b.group;
  const touch = (a, b, lo, hi) => Math.min(a[hi], b[hi]) - Math.max(a[lo], b[lo]) > 1e-6;
  // a nearly square rectangle joined to others on one axis only points its ridge AT them (a wing, an L's leg), so its
  // roof runs into theirs instead of leaving a gutter between two parallel ridges
  for (const p of parts) {
    if (p.kind === 'flat') continue;
    const lx = p.x1 - p.x0, lz = p.z1 - p.z0; if (Math.min(lx, lz) / Math.max(lx, lz) < 0.74) continue;
    const nb = parts.filter(b => sameGroup(p, b) && b.kind !== 'flat');
    const onX = nb.some(b => (Math.abs(b.x1 - p.x0) < 1e-6 || Math.abs(b.x0 - p.x1) < 1e-6) && touch(p, b, 'z0', 'z1')), onZ = nb.some(b => (Math.abs(b.z1 - p.z0) < 1e-6 || Math.abs(b.z0 - p.z1) < 1e-6) && touch(p, b, 'x0', 'x1'));
    if (onX === onZ) continue;
    p.axis = onX ? 'x' : 'z'; p.half = (onX ? lz : lx) / 2; p.tan = Math.min(tanOf(p.room), O.maxRise / p.half); p.rise = p.tan * p.half; p.ridgeY = p.top + p.rise;
  }
  // a roof turned 90 degrees: its own axis, whatever the automatic choice was
  const setAxis = (p, ax) => { const lx = p.x1 - p.x0, lz = p.z1 - p.z0; p.axis = ax; p.half = (ax === 'x' ? lz : lx) / 2; p.tan = Math.min(tanOf(p.room), O.maxRise / p.half); p.rise = p.tan * p.half; p.ridgeY = p.top + p.rise; };
  for (const p of parts) { p.autoAxis = p.axis; if (p.kind !== 'flat' && (p.room.axis === 'x' || p.room.axis === 'z') && p.room.axis !== p.axis) setAxis(p, p.room.axis); }
  for (const p of parts) {
    const oh = O.overhang, t = p.tan, T = p.top;
    if (p.kind === 'flat') { p.planes = [{ a: 0, b: 0, c: T + 1, face: 'flat' }]; p.dom = [{ x0: p.x0, z0: p.z0, x1: p.x1, z1: p.z1 }]; p.ends = []; continue; }
    const X = p.axis === 'x';
    // the two slopes (and a hip's two ends): height rises from each wall line towards the middle
    p.planes = X
      ? [{ a: 0, b: t, c: T - t * p.z0, face: 'N', u: [1, 0], eave: p.z0, across: 'z', sign: 1 }, { a: 0, b: -t, c: T + t * p.z1, face: 'S', u: [-1, 0], eave: p.z1, across: 'z', sign: -1 }]
      : [{ a: t, b: 0, c: T - t * p.x0, face: 'W', u: [0, -1], eave: p.x0, across: 'x', sign: 1 }, { a: -t, b: 0, c: T + t * p.x1, face: 'E', u: [0, 1], eave: p.x1, across: 'x', sign: -1 }];
    if (p.kind === 'hip') p.planes.push(...(X
      ? [{ a: t, b: 0, c: T - t * p.x0, face: 'W', u: [0, -1], eave: p.x0, across: 'x', sign: 1 }, { a: -t, b: 0, c: T + t * p.x1, face: 'E', u: [0, 1], eave: p.x1, across: 'x', sign: -1 }]
      : [{ a: 0, b: t, c: T - t * p.z0, face: 'N', u: [1, 0], eave: p.z0, across: 'z', sign: 1 }, { a: 0, b: -t, c: T + t * p.z1, face: 'S', u: [-1, 0], eave: p.z1, across: 'z', sign: -1 }]));
    // its ground: the rectangle plus the overhang, and (a gable) on into a neighbour whose side its end meets
    const [lo, hi, alo, ahi] = X ? ['z0', 'z1', 'x0', 'x1'] : ['x0', 'x1', 'z0', 'z1'];
    const main = { x0: p.x0 - oh, z0: p.z0 - oh, x1: p.x1 + oh, z1: p.z1 + oh }; p.dom = [main]; p.ends = [];
    if (p.kind === 'gable') for (const end of [alo, ahi]) {
      const at = p[end], nbs = parts.filter(b => sameGroup(p, b) && Math.abs(b[end === alo ? ahi : alo] - at) < 1e-6 && touch(p, b, lo, hi));
      const E = { end, at, joined: nbs.length > 0, to: at, lo: p[lo], hi: p[hi] };
      if (nbs.length) main[end] = at; // no verge overhang where another room's roof carries on
      for (const b of nbs) {
        if (b.kind === 'flat' || b.axis === p.axis) continue; // in line (one ridge) or against a flat roof: it just stops
        const mid = X ? b.cx : b.cz, ext = { x0: main.x0, z0: main.z0, x1: main.x1, z1: main.z1 };
        ext[lo] = Math.max(p[lo], b[lo]); ext[hi] = Math.min(p[hi], b[hi]); ext[alo] = Math.min(at, mid); ext[ahi] = Math.max(at, mid);
        p.dom.push(ext); E.to = mid; E.lo = ext[lo]; E.hi = ext[hi];
      }
      p.ends.push(E);
    }
  }
  const byGroup = new Map(); for (const p of parts) { if (!byGroup.has(p.group)) byGroup.set(p.group, []); byGroup.get(p.group).push(p); }
  const fieldOf = (p, x, z) => p.dom.some(r => inRect(r, x, z)) ? Math.min(...p.planes.map(pl => hOf(pl, x, z))) : -Infinity;
  const othersAt = (p, x, z) => Math.max(-Infinity, ...byGroup.get(p.group).filter(b => b !== p).map(b => fieldOf(b, x, z)));
  // the roof's height over a point (the highest roof there), or null where there is none
  const heightAt = (x, z) => { let h = -Infinity; for (const p of parts) if (inRect(p, x, z)) h = Math.max(h, Math.max(...byGroup.get(p.group).map(b => fieldOf(b, x, z)))); return Number.isFinite(h) ? h : null; };

  // what shows of each plane: where it is its rectangle's lowest plane, minus wherever another roof is higher
  const taller = (p) => parts.filter(b => b.top > p.top + 1e-6); // a higher part of the house stands there: its walls, not my eaves
  for (const p of parts) {
    p.pieces = [];
    for (const pl of p.planes) {
      let polys = [];
      for (const r of p.dom) { let poly = rectPoly(r); for (const m of p.planes) if (m !== pl && poly.length) poly = clip(poly, [m.a - pl.a, m.b - pl.b, m.c - pl.c], p.planes.indexOf(pl) < p.planes.indexOf(m)); if (poly.length) polys.push(poly); }
      if (p.dom.length > 1) polys = disjoint(polys);
      for (const b of byGroup.get(p.group)) {
        if (b === p || !polys.length) continue;
        for (const r of b.dom) { const halves = [...rectHalves(r).map(h => ({ h, tie: true })), ...b.planes.map(m => ({ h: [m.a - pl.a, m.b - pl.b, m.c - pl.c], tie: b.i < p.i }))]; polys = polys.flatMap(poly => subtract(poly, halves)); }
      }
      for (const b of taller(p)) polys = polys.flatMap(poly => subtract(poly, rectHalves(b).map(h => ({ h, tie: true }))));
      for (const poly of polys) p.pieces.push({ plane: pl, poly });
    }
  }

  // one roof per room
  const roofs = [], byRoom = new Map();
  for (const r of R) { if (!r.open.length || r.none) continue; const roof = { room: r.id, building: r.building ?? null, style: r.style, flatStyle: flatSurfaceOf(r.style), edge: r.edge, turrets: r.turrets, family: r.family ?? null, kind: null, ...((r.axis === 'x' || r.axis === 'z') && { forced: r.axis }), top: r.top, ridgeY: r.top, seed: r.seed, planes: [], gables: [], gableEnds: [], verges: [], skirts: [], ridges: [], standable: [], props: [] }; roofs.push(roof); byRoom.set(r.id, roof); }
  const anyTaller = (p, x, z) => taller(p).some(b => inRect(b, x, z, -1e-6));
  for (const p of parts) {
    const roof = byRoom.get(p.room.id), sec = Math.sqrt(1 + p.tan * p.tan);
    roof.kind = roof.kind && roof.kind !== p.kind ? 'mixed' : p.kind; roof.ridgeY = Math.max(roof.ridgeY, p.ridgeY); roof.axis ||= p.kind === 'flat' ? undefined : p.axis; roof.autoAxis ||= p.kind === 'flat' ? undefined : p.autoAxis;
    for (const { plane: pl, poly } of p.pieces) {
      const flat = pl.face === 'flat', pts = poly.map(([x, z]) => [x, hOf(pl, x, z), z]);
      // courses run along the eave (u), eaves at the bottom of the picture (v = 0), one picture per 5 ft along the slope
      const FT = ROOF_STYLES[roof.flatStyle]?.ft || C; // (a flat surface's picture may cover more than 5 ft: `ft`)
      const uv = poly.map(([x, z]) => flat ? [x / FT, -z / FT] : [(x * pl.u[0] + z * pl.u[1]) / C, ((pl.across === 'z' ? z : x) - pl.eave) * pl.sign * sec / C]);
      // lay: how roof sections are laid on this plane (sectionLayout): feet along the eave (world-aligned, so the courses of joined
      // rooms line up) and feet up the slope from the eave's EDGE (the overhang), so every slope starts with a whole course
      const lay = flat ? null : { u: pl.u, across: pl.across, sign: pl.sign, edge: pl.eave - pl.sign * O.overhang, tan: p.tan, a: pl.a, b: pl.b, c: pl.c };
      roof.planes.push({ face: pl.face, flat, poly: pts, uv, normal: flat ? [0, 1, 0] : norm([-pl.a, 1, -pl.b]), u: flat ? [1, 0] : pl.u, pitch: flat ? 0 : Math.atan(p.tan) * 180 / Math.PI, ...(lay && { lay }) });
    }
    if (p.kind === 'flat') {
      // the slab's sides, wherever the flat roof ends (not against a taller part of the house)
      for (let x = p.x0; x < p.x1 - 1e-6; x += C) for (const [z, dz] of [[p.z0, -1], [p.z1, 1]]) edgeOfFlat(p, x + C / 2, z + dz * 0.01) && roof.skirts.push(quad([x, z], [x + C, z], p.top, p.top + 1));
      for (let z = p.z0; z < p.z1 - 1e-6; z += C) for (const [x, dx] of [[p.x0, -1], [p.x1, 1]]) edgeOfFlat(p, x + dx * 0.01, z + C / 2) && roof.skirts.push(quad([x, z], [x, z + C], p.top, p.top + 1));
      for (let x = p.x0 + C / 2; x < p.x1; x += C) for (let z = p.z0 + C / 2; z < p.z1; z += C) roof.standable.push({ kind: 'flat', x, y: p.top + 1, z });
      continue;
    }
    const X = p.axis === 'x', mid = X ? p.cz : p.cx, P3 = (along, y, across) => X ? [along, y, across] : [across, y, along];
    // gable ends: the wall-coloured triangle under the verge, unless a neighbour's roof already closes it
    if (p.kind === 'gable') for (const E of p.ends) {
      const out = E.end.endsWith('0') ? -1 : 1, at = E.to, probe = at + out * 0.05;
      const [px, pz] = X ? [probe, mid] : [mid, probe];
      E.free = !E.joined; E.shown = othersAt(p, px, pz) < p.ridgeY - 0.05 && !anyTaller(p, px, pz);
      if (!E.shown) continue;
      const lo = p[X ? 'z0' : 'x0'], hi = p[X ? 'z1' : 'x1'], tri = [P3(at, p.top, lo), P3(at, p.top, hi), P3(at, p.ridgeY, mid)];
      roof.gables.push(tri);
      // what the gable END is made of (gableEnd below): the triangle, which way it faces, and (a free end, with a verge
      // overhang) the two sloped edges of the roof above it, where its trim goes
      const G = gableEnd(p, E, tri, { X, out, at, lo, hi, mid, oh: E.free ? O.overhang : 0 }); E.g = G; roof.gableEnds.push(G);
      if (E.free) roof.verges.push(...G.verges);
    }
    // the ridge, where it is the top of the roof: capped, and a place to stand
    const a0 = p.kind === 'hip' ? (X ? p.x0 : p.z0) + p.half : Math.min(...p.dom.map(r => X ? r.x0 : r.z0)), a1 = p.kind === 'hip' ? (X ? p.x1 : p.z1) - p.half : Math.max(...p.dom.map(r => X ? r.x1 : r.z1));
    let run = null; const flush = () => { if (run && run[1] - run[0] > 0.2) roof.ridges.push({ a: P3(run[0], p.ridgeY, mid), b: P3(run[1], p.ridgeY, mid) }); run = null; };
    for (let s = a0; s <= a1 + 1e-6; s += 0.25) { const [x, z] = X ? [s, mid] : [mid, s]; const top = fieldOf(p, x, z) > -Infinity && othersAt(p, x, z) <= p.ridgeY + 1e-6 && !anyTaller(p, x, z); if (top) run = run ? [run[0], s] : [s, s]; else flush(); }
    flush();
    for (let s = (X ? p.x0 : p.z0) + C / 2; s < (X ? p.x1 : p.z1); s += C) { const [x, z] = X ? [s, mid] : [mid, s]; if (othersAt(p, x, z) <= p.ridgeY + 1e-6 && (p.kind !== 'hip' || (s >= a0 - 1e-6 && s <= a1 + 1e-6))) roof.standable.push({ kind: 'ridge', x, y: p.ridgeY, z }); }
  }
  function edgeOfFlat(p, x, z) { // is the far side of this flat roof's edge open air (or a lower roof), so the slab's side shows?
    if (anyTaller(p, x, z)) return false;
    if (p.room.coveredSet.has(`${Math.floor(x / C)}:${Math.floor(z / C)}`)) return false;
    return !parts.some(b => b !== p && b.group === p.group && b.kind === 'flat' && inRect(b, x, z, -1e-6));
  }

  // ---------------- the trim: sparse, by rule, seeded ----------------
  const place = (roof, role, o) => { const k = kit[role]; roof.props.push({ role, cat: k.cat, standIn: k.standIn, wants: k.wants, room: roof.room, rot: 0, ...o }); };
  const partOver = (x, z) => parts.filter(p => inRect(p, x, z, -1e-6)).sort((a, b) => b.top - a.top)[0];
  // a chimney straight above each fireplace: through every floor above it, out of the topmost roof, to above its ridge
  const stacks = [];
  for (const f of O.fires || []) {
    const p = partOver(f.x, f.z); if (!p || p.room.props === false) continue;
    const roof = byRoom.get(p.room.id), at = heightAt(f.x, f.z), topY = Math.max(p.ridgeY + 2.5, at + (p.kind === 'flat' ? 6 : 3.5)), y = at - 1.5; // sunk into the roof (the kit's rule: nothing is cut to the pitch). Over a flat roof a man-high stack (2026-10-27: a 3.5-ft stub read as a birdhouse on a castle's deck)
    place(roof, 'chimney', { x: f.x, y, z: f.z, dims: [2.5, +(topY - y).toFixed(3), 2.5], fire: f.id ?? null, axis: p.axis || 'x', key: `chimney:${f.id ?? `${f.x}:${f.z}`}`, slide: { on: 'roof', sink: 1.5, above: 2.5 } }); stacks.push([f.x, f.z]);
  }
  for (const p of parts) {
    const r = p.room, roof = byRoom.get(r.id); if (r.props === false) continue;
    const rnd = rng(strSeed(`${r.seed}|${r.id}|${p.x0}:${p.z0}`)), X = p.axis === 'x';
    if (p.kind === 'flat') {
      // round a flat roof (2026-10-27: by its edge, EDGE_KIT): a section on every open 5-ft edge, a pier at every outer corner
      // of the run, or a corner turret there (r.turrets, on a roof at least TURRET.min ft both ways)
      const K = EDGE_KIT[r.edge] === undefined ? EDGE_KIT.parapet : EDGE_KIT[r.edge], turrets = !!r.turrets && Math.min(p.x1 - p.x0, p.z1 - p.z0) >= TURRET.min - 1e-6;
      const corners = new Map(), mark = (x, z, d) => { const k = `${x}:${z}`; corners.set(k, { x, z, dirs: (corners.get(k)?.dirs || new Set()).add(d) }); };
      const edge = (x0, z0, x1, z1, nx, nz) => { const ox = (x0 + x1) / 2 + nx * 0.01, oz = (z0 + z1) / 2 + nz * 0.01; if (!edgeOfFlat(p, ox, oz) || parts.some(q => q !== p && q.top >= p.top - 1e-6 && inRect(q, ox, oz, -1e-6))) return; /* open air (or a lower roof) beyond it: not against a roof at its own height */ if (K) place(roof, K.run, { x: (x0 + x1) / 2 - nx * K.t / 2, y: p.top + 1, z: (z0 + z1) / 2 - nz * K.t / 2, rot: nx ? Math.PI / 2 : 0, dims: [5, K.h, K.t], out: [nx, nz] }); mark(x0, z0, nx ? 'z' : 'x'); mark(x1, z1, nx ? 'z' : 'x'); };
      for (let x = p.x0; x < p.x1 - 1e-6; x += C) { edge(x, p.z0, x + C, p.z0, 0, -1); edge(x, p.z1, x + C, p.z1, 0, 1); }
      for (let z = p.z0; z < p.z1 - 1e-6; z += C) { edge(p.x0, z, p.x0, z + C, -1, 0); edge(p.x1, z, p.x1, z + C, 1, 0); }
      for (const c of corners.values()) {
        if (c.dirs.size !== 2) continue;
        const sx = c.x > p.cx ? -1 : 1, sz = c.z > p.cz ? -1 : 1;
        if (turrets) place(roof, 'turret', { x: c.x + sx * TURRET.inset, y: p.top + 1, z: c.z + sz * TURRET.inset, rot: Math.atan2(-sx, -sz), dims: [TURRET.w, TURRET.h, TURRET.w], out: [-sx, -sz], key: `turret:${rel(r, c.x, c.z)}`, slide: { on: 'roof', sink: 0 } }); // (a turret is touchable: selected, slid along the roof, removed)
        else if (K?.corner) place(roof, K.corner, { x: c.x + sx * K.ci, y: p.top + 1, z: c.z + sz * K.ci, dims: [K.cw, K.ch, K.cw] });
      }
      continue;
    }
    // dormers: only on big slopes, at most one per ~20 ft of eave, and then only sometimes
    const L = X ? p.x1 - p.x0 : p.z1 - p.z0;
    if (O.dormers !== false && ROOF_STYLES[r.style]?.dormers !== false && p.kind === 'gable' && L >= O.dormerEvery && p.half >= 7.5) for (const pl of p.planes) {
      const n = Math.floor(L / O.dormerEvery);
      for (let k = 0; k < n; k++) {
        const roll = rnd(), jit = rnd(); if (roll >= O.dormerChance) continue;
        const along = (X ? p.x0 : p.z0) + (k + 0.5) * L / n + Math.round((jit - 0.5) * 8) / 2, across = pl.eave + pl.sign * p.half * 0.42;
        const [x, z] = X ? [along, across] : [across, along], y = hOf(pl, x, z);
        if (Math.abs((heightAt(x, z) ?? -1e9) - y) > 0.01 || stacks.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 5)) continue; // only where this slope is the roof, clear of chimneys
        const out = pl.across === 'z' ? [0, -pl.sign] : [-pl.sign, 0];
        place(roof, 'dormer', { x, y: y - 0.6, z, rot: Math.atan2(out[0], out[1]), out, dims: [4, 4.5, 4.5], face: pl.face, key: `dormer:${rel(r, p.x0, p.z0)}:${pl.face}:${k}`,
          slide: { on: 'plane', plane: [pl.a, pl.b, pl.c], sink: 0.6, box: X ? [p.x0 + 2.5, Math.min(pl.eave, pl.eave + pl.sign * p.half) + 1.5, p.x1 - 2.5, Math.max(pl.eave, pl.eave + pl.sign * p.half) - 1.5] : [Math.min(pl.eave, pl.eave + pl.sign * p.half) + 1.5, p.z0 + 2.5, Math.max(pl.eave, pl.eave + pl.sign * p.half) - 1.5, p.z1 - 2.5] } });
      }
    }
    // a finial on a free gable peak, rarely
    if (O.finials !== false && p.kind === 'gable') for (const E of p.ends) { const roll = rnd(); if (E.free && E.shown && roll < O.finialChance) { const [x, z] = X ? [E.at, p.cz] : [p.cx, E.at]; place(roof, 'finial', { x, y: p.ridgeY, z, dims: [0.8, 2.2, 0.8], key: `finial:${rel(r, p.x0, p.z0)}:${E.end}`, slide: { on: 'roof', sink: 0 } }); } }
    // what is in a free gable: a window, a louvred vent, a round oculus (by the wall family), the carved tympanum of a temple's
    // pediment; only where the triangle has room for it. Its own generator, so the dormers' and finial's rolls are as they were.
    // Trim like the rest (keyed by its room's part, its end and its kind; a window / vent / oculus slides along its gable)
    if (O.gableOpenings !== false && p.kind === 'gable') { const grnd = rng(strSeed(`${r.seed}|${r.id}|${p.x0}:${p.z0}|gable`)), roll = [grnd(), grnd()];
      for (const E of p.ends) { if (!E.g || !E.free) continue; const o = gableOpening(E.g, roll); E.g.opening = o; if (o) roof.props.push({ ...o, room: r.id, key: `gable:${rel(r, p.x0, p.z0)}:${E.end}:${o.kind}` }); } } // (one roll for both ends: a house's two gables match)
  }
  // ---------------- THE TRIM IS TOUCHABLE (Harry 2026-10-27: "those chimneys and windows and stuff that stick out of roofs
  // should be selectable & moveable objects as well") ----------------
  // Every piece of trim has a stable KEY (its role and where the rule put it, in feet from its room's corner, so a room
  // that is moved keeps its choices); a room's own choices are OVERRIDES on room.roof.trim, by key:
  //   { at: [x, z] }   moved there (feet from the room's corner); it slides on what it stands on (prop.slide):
  //                     'roof'   the roof under it, upright (a chimney: sunk `sink` into it, its top `above` over the ridge)
  //                     'plane'  its own slope (a dormer: it never leaves its plane, kept inside `box`, facing down it)
  //   { gone: true }   removed
  // Everything else is still worked out by rule, so a re-roll, a new shape or a turn regenerates the rest; an override whose
  // key no longer comes up is simply not used. A piece with no slide can be removed but not moved. A rule that places a
  // piece of its own (a gable window, a turret) gets this for nothing: give it a key (else it gets `role:x:z`) and a slide.
  for (const roof of roofs) {
    const r = R.find(q => q.id === roof.room), T = r.trim || {};
    for (const pr of roof.props) pr.key ||= `${pr.role}:${rel(r, pr.x, pr.z)}`;
    roof.props = roof.props.filter(pr => !T[pr.key]?.gone);
    for (const pr of roof.props) {
      const at = T[pr.key]?.at; if (!at || !pr.slide) continue;
      const to = slideProp({ heightAt, roofs }, pr, r.rc.x * C + at[0], r.rc.z * C + at[1]);
      if (to) Object.assign(pr, to, { moved: true });
    }
  }
  return { roofs, heightAt, kit };
}
// where a piece of trim goes when it is moved to (x, z): { x, y, z, dims? }, or null where it cannot stand (off its slope,
// off the roof). plan: { heightAt, roofs } (planRoofs' result). The pointer's drag and the planner both ask this.
export function slideProp(plan, pr, x, z) {
  const S = pr.slide; if (!S) return null;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  if (S.on === 'plane') {
    const [a, b, c] = S.plane, [x0, z0, x1, z1] = S.box; if (x0 > x1 || z0 > z1) return null;
    x = Math.max(x0, Math.min(x1, x)); z = Math.max(z0, Math.min(z1, z));
    const y = a * x + b * z + c, h = plan.heightAt(x, z); if (h == null || Math.abs(h - y) > 0.05) return null; // where its slope is not the roof (a valley, another roof over it)
    return { x: r3(x), y: r3(y - (S.sink || 0)), z: r3(z) };
  }
  if (S.on === 'gable') { // a gable's window / vent: along the gable's face, at its own height, inside the triangle
    const across = Math.max(S.range[0], Math.min(S.range[1], S.axis === 'x' ? z : x));
    return S.axis === 'x' ? { x: r3(S.d), y: pr.y, z: r3(across) } : { x: r3(across), y: pr.y, z: r3(S.d) };
  }
  const h = plan.heightAt(x, z); if (h == null) return null;
  if (pr.role === 'chimney') { const roof = plan.roofs.find(q => q.room === pr.room), topY = Math.max((roof?.ridgeY ?? h) + (S.above ?? 2.5), h + 3.5), y = h - (S.sink ?? 1.5); return { x: r3(x), y: r3(y), z: r3(z), dims: [pr.dims[0], +(topY - y).toFixed(3), pr.dims[2]] }; }
  return { x: r3(x), y: r3(h - (S.sink || 0)), z: r3(z) };
}
const rel = (r, x, z) => `${+(x - r.rc.x * 5).toFixed(2)}:${+(z - r.rc.z * 5).toFixed(2)}`;

// ---------------- GABLE ENDS (Harry 2026-10-27: "those triangle wedges that fill out the wall below the slope of the roof
// kind of need something to blend them into the style of the building. Right now they are too flat, and windowless") ----
// A gable end is the room's own wall carried up into the triangle: it wears the wall FAMILY's look (buildRoof: the
// family's generated wall, baked flat, data/gables.json), stands flush with the wall's outer face, is trimmed along its
// two sloped edges (a bargeboard on a timber house, a stone coping on a stone one, the raking cornice of a pediment on a
// marble temple, which also gets the level cornice along its foot), and has an opening in it where there is room.
//   G = { tri, at, out: [nx, nz] (the way it faces), axis, lo, hi, mid, base, apex, span, rise, tan, free, oh, face (ft
//         out from the wall line), trim: 'board' | 'coping' | 'cornice', verges: [{ a, b, out }], opening? }
export const GABLE = { face: 0.5, minRise: 2.5 }; // ft: the wall's outer face off its grid line (a wall is 12 in); no opening in a gable lower than this
// the trim, by wall family: stone families get a stone coping, the rest a timber bargeboard; a marble roof is a pediment
const STONE_FAMILIES = new Set(['dressed-stone', 'fieldstone', 'castle-rough', 'tower-stone', 'temple-stone', 'crypt-stone', 'black-stone', 'cut-rock', 'noble-interior', 'conservatory']);
export const gableTrim = (family, style) => style === 'marble' ? 'cornice' : STONE_FAMILIES.has(family) ? 'coping' : 'board';
// what may go in a gable, by wall family (first = the likelier); sizes in ft [w, h] (the plates: data/gables.json)
export const GABLE_OPENINGS = { window: [2.5, 2.7], vent: [2.17, 2.67], oculus: [2.5, 2.5] };
const OPENINGS_BY = { stone: ['oculus', 'vent'], timber: ['window', 'vent'], rough: ['vent', 'window'] };
const ROUGH_FAMILIES = new Set(['rough-timber', 'log-cabin', 'mine-timbered']);
export const gableOpeningsFor = (family) => STONE_FAMILIES.has(family) ? OPENINGS_BY.stone : ROUGH_FAMILIES.has(family) ? OPENINGS_BY.rough : OPENINGS_BY.timber;
function gableEnd(p, E, tri, { X, out, at, lo, hi, mid, oh }) {
  const r = p.room, o = X ? [out, 0] : [0, out], trim = gableTrim(r.family, r.style), face = E.free ? GABLE.face : 0;
  const P3 = (along, y, across) => X ? [along, y, across] : [across, y, along], v = at + out * oh; // the verge line: where the roof's end stands
  const eave = (side) => { const e = side < 0 ? lo - oh : hi + oh; return P3(v, p.top - p.tan * oh, e); };
  const verges = E.free ? [{ a: eave(-1), b: P3(v, p.ridgeY, mid), out: o, trim }, { a: eave(1), b: P3(v, p.ridgeY, mid), out: o, trim }] : [];
  return { tri, at, out: o, axis: p.axis, lo, hi, mid, base: p.top, apex: p.ridgeY, span: hi - lo, rise: p.ridgeY - p.top, tan: p.tan, free: !!E.free, oh, face, trim, family: r.family ?? null, style: r.style, verges, opening: null };
}
// the opening of one gable end, seeded (re-roll changes it), as a piece of the roof's TRIM (roof.props, beside the dormers
// and the finial; `key` names it stably: room, which end, what it is): { role: 'gable-window' | 'gable-vent' | 'gable-oculus' |
// 'pediment', kind, x, y, z (its centre on the gable's face), dims [w, h, d], rot, out, tri? (the pediment: its triangle) } or null.
// The game draws it from the gable kit (data/gables.json: a generated plate, keyed), a plain dark stand-in without it.
function gableOpening(G, [kindRoll, hRoll]) {
  if (G.rise < GABLE.minRise) return null;
  const d = G.at + (G.out[0] || G.out[1]) * G.face, at = (y) => G.axis === 'x' ? [d, y, G.mid] : [G.mid, y, d], rot = Math.atan2(G.out[0], G.out[1]);
  if (G.style === 'marble') { // the carved relief fills the pediment inside its cornices; a small one stays plain
    if (G.span < 12) return null;
    const [x, y, z] = at(G.base);
    return { role: 'pediment', kind: 'tympanum', family: G.family, standIn: true, cat: null, x, y, z, rot, out: G.out, dims: [+G.span.toFixed(3), +G.rise.toFixed(3), 0.05], tri: G.tri.map(q => q.slice()) };
  }
  const width = (y) => G.span * (1 - (y - G.base) / G.rise); // the triangle's width at a height
  const kinds = gableOpeningsFor(G.family), first = kindRoll < 0.75 ? 0 : 1, order = [kinds[first], ...kinds.filter((_, i) => i !== first)];
  for (const kind of order) {
    const [w, h] = GABLE_OPENINGS[kind], margin = 0.6;
    // its foot a little above the wall's head; higher, by the roll, when the triangle has height to spare
    const lowest = G.base + 0.9, highest = G.base + G.rise * (1 - (w + 2 * margin) / G.span) - h; if (highest < lowest) continue;
    const yb = lowest + Math.min(highest - lowest, G.rise * 0.18) * hRoll, yc = yb + h / 2;
    if (width(yb + h) < w + 2 * margin) continue;
    const [x, , z] = at(yc);
    // it slides ALONG its gable at its own height, never out of the triangle (slideProp 'gable')
    const room = Math.max(0, G.span * (1 - (yb + h - G.base) / G.rise) / 2 - margin - w / 2);
    return { role: 'gable-' + kind, kind, standIn: true, cat: null, x, y: +yc.toFixed(3), z, rot, out: G.out, dims: [w, h, 0.05], slide: { on: 'gable', axis: G.axis, d, range: [+(G.mid - room).toFixed(3), +(G.mid + room).toFixed(3)] } };
  }
  return null;
}

function normalRoom(r, C, order) {
  let rc;
  if (r.rect) rc = { x: r.rect[0], z: r.rect[1], w: r.rect[2], d: r.rect[3] };
  else if (r.cells && r.x == null) { const xs = r.cells.map(c => c[0]), zs = r.cells.map(c => c[1]); rc = { x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs) + 1, d: Math.max(...zs) - Math.min(...zs) + 1 }; }
  else rc = { x: r.x, z: r.z, w: r.w, d: r.d, ...(r.outline && { outline: r.outline }) };
  const cells = r.cells && r.x == null && !r.rect ? r.cells.map(([a, b]) => [a, b]) : cellsOf(rc).map(([i, j]) => [rc.x + i, rc.z + j]);
  const style = roofStyleKey(r.style);
  return { ...r, rc, cells, cellSet: new Set(cells.map(([a, b]) => `${a}:${b}`)), style: ROOF_STYLES[style] ? style : 'thatch', seed: r.seed ?? 1, order, fromCells: !!(r.cells && r.x == null && !r.rect) };
}
// a room's rectangles for a pitched roof: the layout solver's own (largest first); cells it leaves over become scraps
function pitchedRects(r) {
  if (r.fromCells) return runsOf(r.cells, true);
  const out = rectsOf(r.rc).map(q => ({ gx: r.rc.x + q.i, gz: r.rc.z + q.j, w: q.w, d: q.d })), have = new Set();
  for (const q of out) for (let i = 0; i < q.w; i++) for (let j = 0; j < q.d; j++) have.add(`${q.gx + i}:${q.gz + j}`);
  return [...out, ...runsOf(r.cells.filter(([a, b]) => !have.has(`${a}:${b}`))).map(q => ({ ...q, scrap: true }))];
}
// cells as a few rectangles: runs along x, stacked while the next row has the same run (greedy; exact cover, no overlap)
function runsOf(cells, big = false) {
  const set = new Set(cells.map(([a, b]) => `${a}:${b}`)), used = new Set(), out = [];
  const sorted = [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [gx, gz] of sorted) {
    if (used.has(`${gx}:${gz}`)) continue;
    let w = 1; while (set.has(`${gx + w}:${gz}`) && !used.has(`${gx + w}:${gz}`)) w++;
    let d = 1; for (;;) { let ok = true; for (let i = 0; i < w; i++) if (!set.has(`${gx + i}:${gz + d}`) || used.has(`${gx + i}:${gz + d}`)) { ok = false; break; } if (!ok) break; d++; }
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) used.add(`${gx + i}:${gz + j}`);
    out.push({ gx, gz, w, d });
  }
  return big ? out.sort((a, b) => b.w * b.d - a.w * a.d) : out;
}
// overlapping convex polygons of one plane (its rectangle and its run-on into a neighbour) as pieces that do not overlap
function disjoint(polys) {
  const out = [];
  for (const poly of polys) {
    let pieces = [poly];
    for (const done of out) { const halves = edgesAsHalves(done).map(h => ({ h, tie: true })); pieces = pieces.flatMap(p => subtract(p, halves)); }
    out.push(...pieces);
  }
  return out;
}
function edgesAsHalves(poly) { // the inside of each edge of a convex polygon, whichever way it winds
  const s = Math.sign(area2(poly)) || 1, out = [];
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], a = -(q[1] - p[1]) * s, b = (q[0] - p[0]) * s; out.push([a, b, -(a * p[0] + b * p[1])]); }
  return out;
}
const norm = (v) => { const l = Math.hypot(...v); return v.map(x => x / l); };
const quad = (a, b, y0, y1) => [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];

// (tests, and anything that asks "is this spot roofed, and by how many surfaces"): the planes of every roof over a point
export function coverAt(plan, x, z) {
  let n = 0;
  for (const roof of plan.roofs) for (const pl of roof.planes) if (inPoly(pl.poly.map(p => [p[0], p[2]]), x, z)) n++;
  return n;
}
function inPoly(poly, x, z) { const s = Math.sign(area2(poly)) || 1; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; if (((q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0])) * s < -1e-9) return false; } return true; }

// ---------------- ROOF SECTIONS (Harry 2026-10-11) ----------------
// "Our programatic roofs look tacky. Let's make some small shingles-sections for each type in the system, and use them
// at 45 degrees." The surface of a pitched roof is one modelled 5 ft x 5 ft patch of roofing per style (real overlapping
// shingles, tiles, slates, thatch layers: experiments/2026-10-11-roof-sections), laid out as a grid of copies on every
// slope. The shape logic above is untouched: a section is only ever laid where a planned plane is.
//
// TRIMMING. A slope is a set of convex pieces (hips, valleys, gable verges, the ridge, where a taller part of the house
// stands). A section that lies wholly inside a piece is drawn whole. One that crosses the piece's edge is drawn with
// CLIP PLANES of its own: up to four planes per copy, each the VERTICAL plane through one edge of the piece, and the
// pixel shader drops what is outside. Vertical, so the two slopes that meet at a hip, a valley or the ridge are cut by
// the very same plane and meet without a notch, relief and all. A copy that would need more than four planes (a
// section crossed by five edges: rare) is drawn as two copies, the piece split along a diagonal. Nothing is cut on the
// CPU, nothing is stencilled, and every copy is still the one shared geometry.
//
// sectionLayout is pure (node tests): roof -> where each copy stands and its planes, as flat arrays ready for
// InstancedMesh. Local frame of a section (feet): x along the eave, y the relief off the roof plane, z up the slope.
export const SECTION = { size: 5, near: 170, far: 190 }; // ft: a section's side; within `near` of the camera a roof wears the modelled tier, beyond `far` the flat one (between: as it was)
const NO_PLANE = [0, 0, 0, 1];
export function sectionLayout(roof, { size = SECTION.size, sink = 0 } = {}) {
  const mats = [], clips = [], cells = []; let split = 0, whole = 0;
  for (const pl of roof.planes) {
    const L = pl.lay; if (!L) continue;
    const X = L.across === 'x', sec = Math.sqrt(1 + L.tan * L.tan), cos = 1 / sec, sin = L.tan / sec;
    // plan (x, z) -> (U: feet along the eave, S: feet up the slope from the eave's edge)
    const US = ([x, , z]) => [x * L.u[0] + z * L.u[1], ((X ? x : z) - L.edge) * L.sign * sec];
    const poly = pl.poly.map(US), Uh = [L.u[0], 0, L.u[1]], Vh = X ? [L.sign * cos, sin, 0] : [0, sin, L.sign * cos], Nn = pl.normal;
    const us = poly.map(p => p[0]), ss = poly.map(p => p[1]);
    const i0 = Math.floor(Math.min(...us) / size + 1e-6), i1 = Math.ceil(Math.max(...us) / size - 1e-6), j0 = Math.floor(Math.min(...ss) / size + 1e-6), j1 = Math.ceil(Math.max(...ss) / size - 1e-6);
    for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
      const U0 = i * size, S0 = j * size, U1 = U0 + size, S1 = S0 + size;
      let Q = poly; for (const h of [[1, 0, -U0], [-1, 0, U1], [0, 1, -S0], [0, -1, S1]]) { Q = clip(Q, h); if (!Q.length) break; }
      if (!Q.length || Math.abs(area2(Q)) < 2e-3) continue;
      // where this copy stands: the cell's corner on the plane, sunk by `sink` along the normal (so the MEAN of the relief lies on the planned plane)
      const pa = L.edge + L.sign * S0 * cos, px = X ? pa : U0 * L.u[0], pz = X ? U0 * L.u[1] : pa, py = L.a * px + L.b * pz + L.c;
      const M = [Uh[0], Uh[1], Uh[2], 0, Nn[0], Nn[1], Nn[2], 0, Vh[0], Vh[1], Vh[2], 0, px - Nn[0] * sink, py - Nn[1] * sink, pz - Nn[2] * sink, 1];
      const onEdge = (p, q) => (Math.abs(p[0] - U0) < 1e-5 && Math.abs(q[0] - U0) < 1e-5) || (Math.abs(p[0] - U1) < 1e-5 && Math.abs(q[0] - U1) < 1e-5) || (Math.abs(p[1] - S0) < 1e-5 && Math.abs(q[1] - S0) < 1e-5) || (Math.abs(p[1] - S1) < 1e-5 && Math.abs(q[1] - S1) < 1e-5);
      const emit = (P, depth) => {
        const s = Math.sign(area2(P)) || 1, cuts = [];
        for (let k = 0; k < P.length; k++) {
          const p = P[k], q = P[(k + 1) % P.length]; if (onEdge(p, q)) continue; // the section itself ends there
          let a = -(q[1] - p[1]) * s, b = (q[0] - p[0]) * s; const l = Math.hypot(a, b); if (l < 1e-9) continue; a /= l; b /= l;
          // inside is a*U + b*S + d >= 0 on the plane; a point of the relief (x, y, z in the section) stands over U0 + x and, in
          // plan, y*sin short of S0 + z: so the plane through the edge that is VERTICAL in the world is
          cuts.push([a, -b * L.tan, b, a * (U0 - p[0]) + b * (S0 - p[1]) + 0.004]);
        }
        if (cuts.length > 4 && P.length > 3 && depth < 4) { const m = P.length >> 1; split++; emit(P.slice(0, m + 1), depth + 1); emit([...P.slice(m), P[0]], depth + 1); return; }
        if (!cuts.length) whole++;
        while (cuts.length < 4) cuts.push(NO_PLANE);
        mats.push(...M); for (const c of cuts.slice(0, 4)) clips.push(...c);
        cells.push({ face: pl.face, i, j, area: Math.abs(area2(P)) / 2, cuts: cuts.filter(c => c !== NO_PLANE).length });
      };
      emit(Q, 0);
    }
  }
  return { style: roof.style, count: cells.length, whole, split, matrix: new Float32Array(mats), clip: new Float32Array(clips), cells };
}

// One style's section ready to draw: the two tiers' geometry out of its GLB (`near`: the wedges; `far`: one quad with
// a normal map), their materials with the per-copy clip planes patched in, and the depth materials shadows need.
// info: { mean_ft, max_ft } from data/roofsections.json.
const sectionClasses = new WeakMap();
function sectionMats(THREE) {
  if (sectionClasses.has(THREE)) return sectionClasses.get(THREE);
  // (flat: the SHADOW a roof casts is the planned plane's, the relief pressed flat. The sun's shadow map has a texel of about
  // two inches: wedges that cast on each other came out as black slits and lit scraps on the slopes turned from the sun.)
  const patch = (sh, flat) => {
    sh.vertexShader = 'attribute mat4 aRoofClip;\nvarying vec4 vRoofClip;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRoofClip = vec4(position, 1.0) * aRoofClip;' + (flat ? '\n  transformed.y = 0.0;' : ''));
    sh.fragmentShader = 'varying vec4 vRoofClip;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (any(lessThan(vRoofClip, vec4(0.0)))) discard;');
  };
  // (classes, not onBeforeCompile set on an instance: the fly-away fades a CLONE of a material, and a clone keeps its class)
  const mk = (Base, key, flat = false) => class extends Base { onBeforeCompile(sh) { patch(sh, flat); } customProgramCacheKey() { return key; } };
  const C = { Surface: mk(THREE.MeshStandardMaterial, 'tw-roof-section'), Depth: mk(THREE.MeshDepthMaterial, 'tw-roof-section-depth', true), Distance: mk(THREE.MeshDistanceMaterial, 'tw-roof-section-dist', true) };
  sectionClasses.set(THREE, C); return C;
}
export function roofSectionKit(THREE, scene, info = {}) {
  const C = sectionMats(THREE), pick = (name) => { let m = null; scene.traverse(o => { if (o.isMesh && (o.name === name || o.parent?.name === name)) m ||= o; }); return m; };
  const near = pick('near'), far = pick('far'); if (!near || !far) return null;
  const mat = (src, withNormal) => {
    const m = new C.Surface({ map: src.map, roughness: src.roughness ?? 0.9, metalness: 0, side: THREE.DoubleSide });
    if (m.map) m.map.anisotropy = 8;
    if (withNormal && src.normalMap) { m.normalMap = src.normalMap; m.normalScale.copy(src.normalScale); }
    return m;
  };
  return { near: near.geometry, far: far.geometry, nearMat: mat(near.material, false), farMat: mat(far.material, true),
    depth: new C.Depth({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }), distance: new C.Distance({ side: THREE.DoubleSide }),
    sink: 0, top: info.max_ft ?? 0.5, // (the wedges stand ON the planned plane, which is also their own lowest face: a trim cut never opens onto the room below)
    tris: near.geometry.index ? near.geometry.index.count / 3 : near.geometry.attributes.position.count / 3 };
}
// the two tiers of one roof: InstancedMeshes that share the kit's vertex buffers and each other's per-copy buffers
function sectionMeshes(THREE, roof, kit) {
  const lay = sectionLayout(roof, { sink: kit.sink }); if (!lay.count) return null;
  const im = new THREE.InstancedBufferAttribute(lay.matrix, 16), ic = new THREE.InstancedBufferAttribute(lay.clip, 16);
  const box = new THREE.Box3(); for (const pl of roof.planes) if (pl.lay) for (const q of pl.poly) box.expandByPoint(new THREE.Vector3(q[0], q[1], q[2])); box.max.y += kit.top; box.expandByScalar(0.05);
  const one = (src, material, name) => {
    const geo = new THREE.BufferGeometry(); geo.setIndex(src.index); for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, src.attributes[k]);
    geo.setAttribute('aRoofClip', ic);
    // (the shared buffers belong to the kit: whoever disposes this geometry, the cut's fly-away included, frees only what is this roof's)
    geo.dispose = function () { if (!this.index) return; this.setIndex(null); for (const k of ['position', 'normal', 'uv']) this.deleteAttribute(k); THREE.BufferGeometry.prototype.dispose.call(this); m.dispose(); };
    const m = new THREE.InstancedMesh(geo, material, lay.count); m.instanceMatrix = im; m.name = name;
    m.customDepthMaterial = kit.depth; m.customDistanceMaterial = kit.distance; m.castShadow = true; m.receiveShadow = true;
    m.raycast = () => {}; // the pointer meets the planned plane (the unseen 'surface' mesh), never a copy outside its trim
    m.userData.roofOf = roof.room; m.userData.roofPart = name; m.userData.roofSections = lay.count;
    // its bounds are what is DRAWN (the planned slopes plus the relief), not the untrimmed copies: selection brackets, the sleep test and culling use them
    m.boundingBox = box.clone(); m.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    return m;
  };
  const near = one(kit.near, kit.nearMat, 'sections'), far = one(kit.far, kit.farMat, 'sections-far');
  far.visible = false;
  return { near, far, lay };
}
// which tier a roof wears: the modelled one near the camera, the flat one far away (world.js asks a few times a second)
export function setRoofTier(group, near) { const T = group.userData.roofTiers; if (!T || T.isNear === near) return false; T.isNear = near; T.near.visible = near; T.far.visible = !near; return true; }

// ---------------- three.js: the meshes of one planned roof ----------------
// textures: { thatch, tile, slate, shingle } (THREE.Texture, repeat-wrapped; loadRoofTextures) or absent (plain colours).
// sections: { thatch, tile, slate, shingle } (roofSectionKit) or absent: with a style's kit the slopes are drawn as roof
// sections, and the planned 'surface' mesh stays as what the pointer meets (its material is not drawn).
// Pickable meshes carry userData.roofOf = the room's id. The trim (roof.props) is NOT drawn here: the game draws those
// placements with its normal object visuals; propStandIns() below draws plain boxes for a demo or a missing mesh.
const mats = new WeakMap();
// gables: the gable kit (loadGableKit) or absent: with it a gable end wears its wall family's look and its trim the kit's
// wood / stone / marble cornice; without it (or before a picture has arrived) plain colours, as before.
export function buildRoof(roof, { THREE, textures = {}, sections = null, gables = null, wallColor = '#b9ad98', ridgeColor = null } = {}) {
  const g = new THREE.Group(); g.name = `roof:${roof.room}`; g.userData.roofOf = roof.room;
  const cache = mats.get(textures) || (mats.set(textures, new Map()), mats.get(textures));
  const mat = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  const surface = (style) => mat('s:' + style, () => { const S = ROOF_STYLES[style] || ROOF_STYLES.thatch, map = textures[style] || null; return new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : S.color, map, roughness: style === 'slate' || style === 'tile' ? 0.8 : style === 'lead' ? 0.7 : 0.97, metalness: 0, side: THREE.DoubleSide }); });
  const plain = (color) => mat('c:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  const mesh = (tris, uvs, material, name) => {
    if (!tris.length) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    if (uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = true; m.receiveShadow = true; m.userData.roofOf = roof.room; m.userData.roofPart = name; g.add(m);
  };
  const fan = (poly, uv, tris, uvs, up) => { // triangles facing up (or as given), from a convex polygon
    const flip = up && ((poly[1][2] - poly[0][2]) * (poly[2][0] - poly[0][0]) - (poly[1][0] - poly[0][0]) * (poly[2][2] - poly[0][2])) < 0;
    for (let i = 1; i + 1 < poly.length; i++) { const [a, b, c] = flip ? [0, i + 1, i] : [0, i, i + 1]; tris.push(poly[a], poly[b], poly[c]); if (uv) uvs.push(uv[a], uv[b], uv[c]); }
  };
  const st = [], su = [], ft = [], fu = [];
  for (const pl of roof.planes) fan(pl.poly, pl.uv, pl.flat ? ft : st, pl.flat ? fu : su, true);
  const flatStyle = roof.flatStyle || flatSurfaceOf(roof.style), style = ROOF_STYLES[roof.style]?.flat ? 'thatch' : roof.style, kit = sections?.[style] || null, sec = kit && st.length ? sectionMeshes(THREE, roof, kit) : null;
  mesh(st, su, sec ? mat('unseen', () => new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })) : surface(style), 'surface');
  if (sec) { const s = g.children[g.children.length - 1]; s.castShadow = false; s.userData.noCast = true; g.add(sec.near, sec.far); g.userData.roofTiers = { near: sec.near, far: sec.far, isNear: true, count: sec.lay.count, whole: sec.lay.whole, split: sec.lay.split, tris: kit.tris }; }
  mesh(ft, fu, surface(flatStyle), 'flat');
  // THE GABLE ENDS: the triangle at the wall's outer face (and its inner face), in the wall family's look, world-aligned so
  // its 5-ft panels stand over the wall's; the trim along the verges; a pediment's level cornice (gableMeshes below)
  for (const part of gableMeshes(roof, gables, wallColor)) { const n = g.children.length; mesh(part.tris, part.uvs, part.material(THREE, plain, mat), part.name); if (g.children.length > n) g.children[n].userData.pic = part.key; } // (pic: which picture it wears, or plain:<colour>)
  const kt = []; for (const q of roof.skirts) fan(q, null, kt, null, false);
  mesh(kt, null, plain(ROOF_STYLES[flatStyle]?.skirt || '#6f6a5f'), 'skirt');
  // the ridge cap: a low dark strip sunk over the ridge line, so the two slopes never meet in a bare knife edge
  const rt = [], w = 0.45, hgt = 0.28, drop = 0.3;
  for (const { a, b } of roof.ridges) {
    const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]), o = alongX ? [0, w] : [w, 0], y0 = a[1] - drop, y1 = a[1] + hgt;
    const A = [a[0] - o[0], y0, a[2] - o[1]], B = [b[0] - o[0], y0, b[2] - o[1]], Cc = [b[0] + o[0], y0, b[2] + o[1]], D = [a[0] + o[0], y0, a[2] + o[1]], E = [a[0], y1, a[2]], F = [b[0], y1, b[2]];
    rt.push(A, B, F, A, F, E, D, E, F, D, F, Cc, A, E, D, B, Cc, F);
  }
  mesh(rt, null, plain(ridgeColor || shade(ROOF_STYLES[roof.style]?.color || '#666', 0.62)), 'ridge');
  return g;
}
// ---------------- the gable kit (2026-10-27): what the gable ends and their trim wear ----------------
// data/gables.json (experiments/2026-10-27-roofs-temple/install.py) names the pictures: per wall family the family's own
// generated wall baked flat (5 ft wide, `ft[1]` tall: the band between plinth and cap, so it can repeat up a gable), the
// openings' keyed plates, the cornice strip, the wall kit's wood and stone. Pictures load on first ask; onLoad(name) says
// one has arrived (the game rebuilds its roofs: until then a gable is drawn in the plain stand-in colours).
export const TRIM = { // ft: how a verge trim stands about the verge line (in: back towards the wall, out: past it) and about the roof plane
  board: { in: 0.17, out: 0.03, below: 0.85, above: 0.42, color: '#5a4632' },
  coping: { in: 0.55, out: 0.12, below: 0.55, above: 0.55, color: '#8c877b' },
  cornice: { in: 0.5, out: 0.18, below: 0.9, above: 0.35, color: '#e9e2d3' },
};
export function loadGableKit(THREE, man, urlOf, onLoad = () => {}, loadTexture = null) {
  const loader = loadTexture ? null : new THREE.TextureLoader(), got = new Map(), ready = new Set();
  const tex = (url, srgb) => {
    if (got.has(url)) return ready.has(url) ? got.get(url) : null;
    let t; const done = () => { ready.add(url); onLoad(url); };
    if (loadTexture) { t = new THREE.Texture(); loadTexture(urlOf(url)).then(g => { t.image = g.image; t.flipY = g.flipY; t.needsUpdate = true; done(); }, () => { }); }
    else t = loader.load(urlOf(url), done, undefined, () => { });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    got.set(url, t); return null;
  };
  const pair = (e) => { if (!e) return null; const map = tex(e.url, true), normal = e.normal ? tex(e.normal, false) : null; return map && (!e.normal || normal) ? { map, normal, ft: e.ft, key: e.url } : null; };
  return { man, wall: (fam) => pair(man?.walls?.[fam]), trim: (t) => pair(man?.trim?.[t]), cornice: () => pair(man?.cornice), opening: (kind) => pair(man?.openings?.[kind]), loaded: () => ready.size };
}
// the gable ends' meshes of one roof: [{ name, tris, uvs, material(THREE, plain, cache) }]
function gableMeshes(roof, kit, wallColor) {
  const out = [], groups = new Map();
  const add = (name, mkey, make, tris, uvs) => { const k = name + '|' + mkey; if (!groups.has(k)) { const g = { name, key: mkey, tris: [], uvs: [], material: (THREE, plain, cache) => cache('g:' + mkey, () => make(THREE, plain)) }; groups.set(k, g); out.push(g); } const g = groups.get(k); g.tris.push(...tris); g.uvs.push(...uvs); };
  const std = (pic, color, rough = 0.95) => (THREE, plain) => pic ? new THREE.MeshStandardMaterial({ map: pic.map, normalMap: pic.normal || null, roughness: rough, metalness: 0, side: THREE.DoubleSide }) : plain(color);
  for (const G of roof.gableEnds || roof.gables.map(tri => ({ tri, face: 0, out: [0, 0], verges: [] }))) {
    const [ox, oz] = G.out, right = [oz, -ox]; // the way an onlooker outside reads left to right
    const wallPic = kit?.wall(G.family) || null, ft = wallPic?.ft || [5, 7.6];
    const uvOf = (q) => [(q[0] * right[0] + q[2] * right[1]) / ft[0], (q[1] - (G.base ?? q[1])) / ft[1]];
    const faces = G.face ? [G.face, -G.face] : [0];
    for (const f of faces) {
      const t = G.tri.map(q => [q[0] + ox * f, q[1], q[2] + oz * f]);
      add('gable', wallPic ? wallPic.key : 'plain:' + wallColor, std(wallPic, wallColor), t, t.map(uvOf));
    }
    // the trim along each verge: a beam with a vertical cross-section, its top a little above the roof plane
    const T = TRIM[G.trim]; if (!T) continue;
    const pic = G.trim === 'board' ? kit?.trim('wood') : G.trim === 'coping' ? kit?.trim('stone') : null, front = G.trim === 'cornice' ? kit?.cornice() : null;
    const body = G.trim === 'cornice' ? 'plain:' + T.color : pic ? pic.key : 'plain:' + T.color, bodyMat = G.trim === 'cornice' ? std(null, T.color) : std(pic, T.color, 0.9);
    const frontKey = front ? front.key : body, frontMat = front ? std(front, T.color, 0.85) : bodyMat, tft = pic?.ft || 6;
    const beam = (A, B, offs, low, high) => { // A -> B along the verge; offs [in, out] across it (signed by `out`); low/high below/above the line A-B
      const P = (q, o, dy) => [q[0] + ox * o, q[1] + dy, q[2] + oz * o], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
      const [oi, oo] = offs, c = P;
      const quad = (a, b, cc, d) => [a, b, cc, a, cc, d];
      const fu = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
      // front (outermost): the cornice strip runs along it; v up its height
      add('verge', frontKey, frontMat, quad(c(A, oo, -low), c(B, oo, -low), c(B, oo, high), c(A, oo, high)), fu(0, L / (front ? front.ft * (low + high) : tft), 0, front ? 1 : (low + high) / tft));
      const sides = [[c(A, oi, -low), c(B, oi, -low), c(B, oi, high), c(A, oi, high)], [c(A, oi, high), c(B, oi, high), c(B, oo, high), c(A, oo, high)], [c(A, oi, -low), c(B, oi, -low), c(B, oo, -low), c(A, oo, -low)], [c(A, oi, -low), c(A, oo, -low), c(A, oo, high), c(A, oi, high)]];
      for (const q of sides) add('verge', body, bodyMat, quad(...q), fu(0, L / tft, 0, (low + high) / tft));
    };
    for (const v of G.verges || []) beam(v.a, v.b, [-T.in, T.out], T.below, T.above);
    // a pediment's level cornice along its foot, eave edge to eave edge, its top level with the raking cornice's at the corners
    if (G.trim === 'cornice' && G.verges?.length === 2) {
      const [a, b] = [G.verges[0].a, G.verges[1].a], drop = G.base - a[1];
      const A = [a[0], G.base, a[2]], B = [b[0], G.base, b[2]];
      beam(A, B, [-T.in, T.out], drop + T.below, T.above - drop); // (its top may lie below the gable's foot: the line A-B is at the foot)
    }
  }
  return out;
}
// ONE GABLE PIECE (a window, a vent, an oculus, a pediment's tympanum: roof.props roles 'gable-*' and 'pediment'), drawn
// in the piece's own frame (the game's holder stands at p.x, p.y, p.z turned by p.rot, so local +z faces out of the gable):
// the kit's keyed plate on a card a hair proud of the face, or a plain dark stand-in. Returns { mesh, standIn }.
export const isGablePiece = (p) => p.role === 'pediment' || String(p.role).startsWith('gable-');
export function gablePiece(THREE, p, kit) {
  const pic = kit?.opening(p.kind) || null, [w, h] = p.dims;
  let geo;
  if (p.role === 'pediment') { // the triangle, inset a little inside its cornices; the plate's triangle fills its own box
    const s = 0.94, hw = (w / 2) * s, top = h * s;
    geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([-hw, 0.02, 0, hw, 0.02, 0, 0, top, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); geo.computeVertexNormals();
  } else geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, 0, 0.04);
  const material = pic ? new THREE.MeshStandardMaterial({ map: pic.map, alphaTest: 0.5, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    : new THREE.MeshStandardMaterial({ color: p.role === 'pediment' ? '#d8cfbd' : '#2b2622', roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (pic && p.role === 'pediment') {
    material.alphaTest = 0.02;
    // the relief is carved in the temple's own stone: its plate (cream marble) is graded to the wall
    // family's colour (Gemini 2026-10-27: a cream panel on golden walls read as "a flat pasted-on pediment board")
    const wm = kit.man?.walls?.[p.family]?.mean, pm = kit.man?.openings?.tympanum?.mean;
    if (wm && pm) material.color.setRGB(...wm.map((v, i) => Math.min(1.25, Math.max(0.4, v / Math.max(0.05, pm[i]))))).convertSRGBToLinear?.();
  }
  const m = new THREE.Mesh(geo, material); m.receiveShadow = true; m.castShadow = false; m.name = p.role;
  return { mesh: m, standIn: !pic };
}
const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

// the roofing textures, set up to tile (one picture = 5 ft; the planner's UVs are in pictures)
// loadTexture (the tuner's js/tex.js, 2026-10-11): the picture is decoded off the main thread; without it, THREE.TextureLoader
// dataUrl(path) -> the URL of a client data file (a flat surface's own `tex`, the marble's `file`); without it they wear their stand-in
export function loadRoofTextures(THREE, urlOf, onLoad = () => {}, loadTexture = null, dataUrl = null) {
  const out = {}, loader = loadTexture ? null : new THREE.TextureLoader();
  for (const [style, S] of Object.entries(ROOF_STYLES)) {
    // the urls to try in order: the catalog's texture, the style's own data file, its stand-ins (a file that fails: the next)
    const urls = [(S.cat && urlOf(S.cat)) || null, ((S.tex || S.file) && dataUrl && dataUrl(S.tex || S.file)) || null, ...(S.standIn || []).map(urlOf)].filter(Boolean); if (!urls.length) continue;
    const t = new THREE.Texture(); // (it exists at once: the roof's material holds it; its picture arrives when decoded)
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; out[style] = t;
    const next = (i) => {
      if (i >= urls.length) { delete out[style]; return; }
      t.userData.url = urls[i];
      if (loadTexture) loadTexture(urls[i]).then(got => { t.image = got.image; t.flipY = got.flipY; t.needsUpdate = true; onLoad(style); }, () => next(i + 1));
      else loader.load(urls[i], (got) => { t.image = got.image; t.needsUpdate = true; onLoad(style); }, undefined, () => next(i + 1));
    };
    next(0);
  }
  return out;
}

// plain boxes for a roof's trim (a demo, or a role whose mesh has not landed): chimney, dormer, parapet, pier, finial
export function propStandIns(roof, { THREE, colors = {} } = {}) {
  const g = new THREE.Group(); g.name = `roof-props:${roof.room}`;
  const C = { chimney: '#7d6a5c', dormer: '#b9ad98', parapet: '#8c877b', corner: '#8c877b', battlement: '#8c877b', merlon: '#8c877b', turret: '#8c877b', railing: '#6b5440', finial: '#3b3a36', ...colors };
  for (const p of roof.props) {
    const [w, h, d] = p.dims, m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: C[p.role] || '#888', roughness: 0.95 }));
    m.position.set(p.x, p.y + h / 2, p.z); m.rotation.y = p.rot || 0; m.castShadow = true; m.userData.roofProp = p.role; m.userData.roofOf = roof.room; g.add(m);
    if (p.role === 'dormer') { // a little gabled lid, so the stand-in reads as a dormer and not a crate
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.78, 1.6, 4, 1), new THREE.MeshStandardMaterial({ color: '#5a5148', roughness: 0.95 }));
      lid.rotation.y = Math.PI / 4; lid.scale.z = d / w; lid.position.set(0, h / 2 + 0.8, 0); m.add(lid);
    }
  }
  return g;
}
