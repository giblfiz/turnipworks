// Darkness in fog of war: who sees what when the area is dark (core/darkness.js has the rule and the light table).
// Pure data, no DOM or three.js: the fog worker runs it (client/fog-worker.js); tests import it directly.
//
//   SEEN    = in a viewing pawn's line of sight AND (within that pawn's darkvision OR lit by a light), each radius
//             shrunk by `hint` ft: the visible core
//   HINT    = the outer `hint` ft of every radius (R - hint .. R), in line of sight, minus SEEN: explored (the veil),
//             never visible (Harry 2026-10-20: "take that 2ft remembered in instead of out"). Nothing past R is ever
//             revealed, so no new reveal rule; where another source's core covers a band cell, visible wins.
//   a LIGHT = a lit light object or a pawn's carried light; its own visibility polygon from where it stands, so a light
//             never lights through a wall and a lit room shows through an open door to whoever has line of sight into it.
//
// Light polygons are cached until the walls change (the worker drops the cache on a new geometry message) or the light
// does (its key: level, place, radius). Only lights whose reach meets a viewer's line-of-sight bounds are considered.
import { visibilityPolygon, blockingSegments, viewingPawns } from './vision.js';
import { FOG_CELL } from '../core/fog.js';
import { baseUnder } from '../core/height.js';
import { darkvisionOf, carriedLightOf } from '../core/darkness.js';

// Scanline raster of polygons into rows of inclusive 1.25-ft (or `cell`) runs, the same cells and rounding as
// fog-grid.js rasterVision (a test proves it), but each edge is bucketed into the rows it crosses instead of every row
// testing every edge: lights are many small polygons, and the fine mask rasters them at 0.3125 ft.
export function rasterPolys(polys, bounds, cell = FOG_CELL, rows = {}) {
  const bx0 = Math.floor(bounds[0] / cell), bx1 = Math.ceil(bounds[2] / cell) - 1;
  const cuts = new Map();
  for (const points of polys) {
    if (!points || points.length < 3) continue;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of points) { if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1]; }
    const lo = Math.max(Math.floor(bounds[1] / cell), Math.floor(minZ / cell)), hi = Math.min(Math.ceil(bounds[3] / cell), Math.ceil(maxZ / cell));
    if (lo >= hi) continue;
    cuts.clear();
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i]; if (a[1] === b[1]) continue;
      const e0 = Math.min(a[1], b[1]), e1 = Math.max(a[1], b[1]);
      // rows whose centre y satisfies (a.z > y) !== (b.z > y), i.e. e0 <= y < e1; +-1 slack, then the exact test
      const z0 = Math.max(lo, Math.ceil(e0 / cell - .5) - 1), z1 = Math.min(hi - 1, Math.ceil(e1 / cell - .5));
      for (let z = z0; z <= z1; z++) {
        const y = (z + .5) * cell;
        if ((a[1] > y) === (b[1] > y)) continue;
        let row = cuts.get(z); if (!row) cuts.set(z, row = []);
        row.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    for (const [z, xs] of cuts) {
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const s = Math.max(bx0, Math.ceil(xs[i] / cell - .5 + 1e-7)), t = Math.min(bx1, Math.floor(xs[i + 1] / cell - .5 - 1e-7));
        if (s <= t) (rows[z] ||= []).push([s, t]);
      }
    }
  }
  for (const [z, runs] of Object.entries(rows)) rows[z] = joinRuns(runs);
  return rows;
}
function joinRuns(runs) {
  runs.sort((a, b) => a[0] - b[0]); const out = [];
  for (const r of runs) { const last = out.at(-1); if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]); else out.push([r[0], r[1]]); }
  return out;
}
// rows ∩ rows / rows ∪ rows (each row: sorted, disjoint inclusive runs)
export function intersectRows(a, b) {
  const out = {};
  for (const [z, ra] of Object.entries(a || {})) {
    const rb = b?.[z]; if (!rb) continue;
    const row = []; let i = 0, j = 0;
    while (i < ra.length && j < rb.length) {
      const lo = Math.max(ra[i][0], rb[j][0]), hi = Math.min(ra[i][1], rb[j][1]);
      if (lo <= hi) row.push([lo, hi]);
      if (ra[i][1] < rb[j][1]) i++; else j++;
    }
    if (row.length) out[z] = row;
  }
  return out;
}
export function unionRows(a, b) {
  const out = { ...(a || {}) };
  for (const [z, runs] of Object.entries(b || {})) out[z] = out[z] ? joinRuns([...out[z], ...runs]) : runs.map(r => [r[0], r[1]]);
  return out;
}

// A radius-limited polygon needs only the walls that come within its radius, and a closing box just outside the circle:
// on a 50-room town that is a handful of segments instead of hundreds (a far wall can never be the nearest hit).
function near(seg, ox, oz, r) {
  const out = [], r2 = (r + 1e-6) * (r + 1e-6);
  for (const s of seg) {
    const dx = s[2] - s[0], dz = s[3] - s[1], len = dx * dx + dz * dz;
    const t = len > 0 ? Math.max(0, Math.min(1, ((ox - s[0]) * dx + (oz - s[1]) * dz) / len)) : 0;
    const ex = s[0] + t * dx - ox, ez = s[1] + t * dz - oz;
    if (ex * ex + ez * ez <= r2) out.push(s);
  }
  return out;
}
export function radiusPolygon(at, seg, radius, simplify) {
  if (!Number.isFinite(radius)) return null;
  const [ox, oz] = at, R = radius + 1;
  return visibilityPolygon(at, near(seg, ox, oz, radius), { bounds: [ox - R, oz - R, ox + R, oz + R], radius, simplify });
}
const bbox = (polys) => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of polys) for (const [x, z] of p) { if (x < x0) x0 = x; if (z < z0) z0 = z; if (x > x1) x1 = x; if (z > z1) z1 = z; } return [x0, z0, x1, z1]; };

// The sight of one viewer (or the party) in a dark area, per level:
//   { los: [points] (line of sight, as computeVision), dv, dvHint, lit, litHint: [points] }
// `lights`: [{ x, z, level, radius }] (client/fog.js: lit, unhidden light objects); pawns' carried lights are added here.
// `cache`: a Map the caller keeps across calls (light polygons); `walls`: a Map level -> blocking segments, likewise.
export function darkSight({ entities, edges, lights = [], hint = 0, bounds, cache = new Map(), walls = new Map(), ...options }) {
  const wallsAt = level => { if (!walls.has(level)) walls.set(level, blockingSegments(edges, entities, level)); return walls.get(level); };
  const out = new Map(), level = l => { if (!out.has(l)) out.set(l, { los: [], dv: [], dvHint: [], lit: [], litHint: [], lights: 0 }); return out.get(l); };
  for (const { pawn, level: l, radius } of viewingPawns(entities, options)) {
    const seg = wallsAt(l), at = [pawn.x, pawn.z], L = level(l), dv = Math.min(radius, darkvisionOf(pawn)), core = Math.max(0, dv - hint);
    L.los.push(visibilityPolygon(at, seg, { bounds, radius, simplify: options.simplify }));
    if (core > 0) L.dv.push(radiusPolygon(at, seg, core, options.simplify) || visibilityPolygon(at, seg, { bounds, radius: core, simplify: options.simplify }));
    if (dv > core) L.dvHint.push(radiusPolygon(at, seg, dv, options.simplify) || visibilityPolygon(at, seg, { bounds, radius: dv, simplify: options.simplify }));
  }
  // carried lights: every unhidden pawn's (a monster's torch shows it to the party), from where its base stands
  const all = [...lights];
  for (const e of Object.values(entities)) {
    if (e.kind !== 'token' || e.hidden) continue;
    const r = carriedLightOf(e); if (r > 0) all.push({ x: e.x, z: e.z, level: baseUnder(entities, e.x, e.z, e.y || 0, options.isOpen).y, radius: r });
  }
  for (const [l, L] of out) {
    if (!L.los.length) continue;
    const [x0, z0, x1, z1] = bbox(L.los), seg = wallsAt(l), keys = [];
    for (const g of all) {
      if (g.level !== l || !(g.radius > 0)) continue;
      const reach = g.radius, core = Math.max(0, g.radius - hint);
      if (g.x + reach < x0 || g.x - reach > x1 || g.z + reach < z0 || g.z - reach > z1) continue; // out of every viewer's sight
      const key = `${l}|${g.x}|${g.z}|${g.radius}|${hint}`;
      let c = cache.get(key);
      if (!c) {
        // its polygons, and their 1.25-ft rows (unclipped: a light's own extent), both kept until the walls change
        c = { lit: core > 0 ? radiusPolygon([g.x, g.z], seg, core) : null };
        c.litHint = reach > core ? radiusPolygon([g.x, g.z], seg, reach) : null;
        c.rows = c.lit ? rasterPolys([c.lit], ANY) : {}; c.hintRows = c.litHint ? rasterPolys([c.litHint], ANY) : {};
        if (cache.size > 4000) cache.clear();
        cache.set(key, c);
      }
      if (c.lit) L.lit.push(c.lit); if (c.litHint) L.litHint.push(c.litHint); L.lights++; keys.push(key);
    }
    // every light in view, lit cells as one set of rows: cached by which lights they are (a pawn's step rarely changes it)
    const ukey = 'U|' + keys.join(';');
    let u = cache.get(ukey);
    if (!u) {
      u = { rows: {}, hintRows: {} };
      for (const k of keys) { const c = cache.get(k); u.rows = unionRows(u.rows, c.rows); u.hintRows = unionRows(u.hintRows, c.hintRows); }
      cache.set(ukey, u);
    }
    L.litRows = u.rows; L.litHintRows = u.hintRows;
  }
  return out;
}
const ANY = [-1e6, -1e6, 1e6, 1e6];

// 1.25-ft rows onto a finer grid (each fine cell takes the coarse cell its centre falls in), clipped to `bounds`
export function upsampleRows(rows, bounds, step, cell = FOG_CELL) {
  const out = {}, bx0 = Math.floor(bounds[0] / step), bx1 = Math.ceil(bounds[2] / step) - 1, bz0 = Math.floor(bounds[1] / step), bz1 = Math.ceil(bounds[3] / step) - 1;
  for (const [zs, runs] of Object.entries(rows || {})) {
    const zc = +zs, f0 = Math.max(bz0, Math.ceil(zc * cell / step - .5)), f1 = Math.min(bz1, Math.ceil((zc + 1) * cell / step - .5) - 1);
    if (f0 > f1) continue;
    const fine = [];
    for (const [a, b] of runs) { const s = Math.max(bx0, Math.ceil(a * cell / step - .5)), t = Math.min(bx1, Math.ceil((b + 1) * cell / step - .5) - 1); if (s <= t) fine.push([s, t]); }
    if (fine.length) for (let z = f0; z <= f1; z++) out[z] = fine.map(r => [r[0], r[1]]);
  }
  return out;
}

// Rows at `cell` ft: { current: seen, reach: seen ∪ hint } per level (the worker's `current` and what joins explored).
// Line of sight and darkvision are rastered at `cell`; the lit cells are the cached 1.25-ft rows (upsampled for the fine
// mask: a light's round edge steps by 1.25 ft inside the sight feather, its shadow edges come from the fine line of sight).
export function rasterDark(sight, bounds, cell = FOG_CELL, { hint = true } = {}) {
  const current = {}, reach = {};
  const lit = rows => cell === FOG_CELL ? rows : upsampleRows(rows, bounds, cell);
  for (const [l, L] of sight) {
    if (!L.los.length) continue;
    const los = rasterPolys(L.los, bounds, cell);
    const seen = unionRows(rasterPolys(L.dv, bounds, cell), intersectRows(los, lit(L.litRows)));
    current[l] = seen;
    if (hint) reach[l] = unionRows(seen, unionRows(rasterPolys(L.dvHint, bounds, cell), intersectRows(los, lit(L.litHintRows))));
  }
  return { current, reach };
}

// The exact (polygon) test for one point: pawns, picking, cursors (client/fog.js visible)
import { pointInPolygon } from './vision.js';
const boxes = new WeakMap();
const inside = (x, z, p) => { let b = boxes.get(p); if (!b) boxes.set(p, b = bbox([p])); return x >= b[0] - 1e-6 && x <= b[2] + 1e-6 && z >= b[1] - 1e-6 && z <= b[3] + 1e-6 && pointInPolygon(x, z, p); };
export function darkVisibleAt(sight, x, z, level = 0) {
  const L = sight?.get?.(level); if (!L) return false;
  if (L.dv.some(p => inside(x, z, p))) return true;
  return L.lit.some(p => inside(x, z, p)) && L.los.some(p => inside(x, z, p));
}
// What the worker posts back for darkVisibleAt (the hint polygons stay in the worker)
export const sightForClient = sight => [...sight].map(([l, L]) => [l, { los: L.los, dv: L.dv, lit: L.lit, dvHint: [], litHint: [], lights: L.lights }]); // (no rows)
