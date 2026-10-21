// Outdoors (Harry 2026-10-05): the yard is a room with NO walls.   node tools/spawn-tuner/test/yard.test.mjs [--print]
//   walls     nothing is built on a yard's open edges; a wall shared with a building belongs to the BUILDING (even when
//             the yard is older); neighbours' doors open onto the yard (wide for stables); a gate on an open side
//   layout    nothing outside the rect, no overlaps, deterministic; the path from every adjoining door to the gate stays
//             clear; sparse (density at or under the low target, and near it when there is wall to gather against); ONE
//             focal thing in the open when the size allows; the middle holds nothing else; wall signs and lights hang on a
//             real neighbouring wall (never a door, a window or thin air), facing the yard
//   plants    the recipe's `plants` slot is empty today and fills by itself when plant meshes exist (injected here)
import { readFileSync } from 'node:fs';
import { solveRoom2, summarize2, DENSITY, YARD, YARD_EDGES, yardTarget } from '../js/solver2.js';
import { solveRoom } from '../js/solver.js';
import { computeEdges, chooseExteriorDoor, CELL, roleOf, isOutdoor } from '../js/walls.js';

const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL', m); } };
const TOL = 2 / 12, INSET = 0.5;
const mk = (id, type, x, z, w, d, seed, created) => ({ id, type, x, z, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created });
const aabb = (p) => { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)); return [c * p.dims[0] + s * p.dims[2], s * p.dims[0] + c * p.dims[2]]; };
const standing = (L) => L.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && p.orient !== 'wall');
const isEdge = (p) => p.rule === 'yard-edge'; // fence / hedge / wall pieces: they stand ON the yard's boundary line and meet each other at posts and corners
const overlap = (a, b) => { if (isEdge(a) && isEdge(b)) return false; const [aw, ad] = aabb(a), [bw, bd] = aabb(b); return Math.abs(a.x - b.x) < (aw + bw) / 2 - TOL && Math.abs(a.z - b.z) < (ad + bd) / 2 - TOL; };
const hung = (L) => L.placements.filter(p => p.rule === 'yard-sign' || p.rule === 'yard-light');
const SIDE_ROT = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };

function build(rooms, { useLib = lib, typeMap = T } = {}) {
  const made = [];
  for (const r of [...rooms].sort((a, b) => a.created - b.created)) { made.push(r); r.extDoor = chooseExteriorDoor(r, made); }
  const E = computeEdges(rooms, { engine: 'v2' });
  const solve = (id, opts = {}) => { const r = rooms.find(x => x.id === id); return solveRoom2({ lib: useLib, type: typeMap[r.type], room: r, openings: E.openings.get(id), opts: { orient, minStars: 3, hideMasking: true, ...opts }, roomTypeOf: (q) => rooms.find(x => x.id === q)?.type }); };
  return { rooms, E, solve };
}
// the arrangements a yard meets: on its own, behind an inn, between inn / kitchen / stable, as a closed court, and laid BEFORE the inn
const ARR = {
  alone: (w, d, s) => [mk('y', 'yard', 6, 8, w, d, s, 1)],
  inn: (w, d, s) => [mk('c', 'common', 6, 4, 6, 4, s + 1, 1), mk('y', 'yard', 6, 8, w, d, s, 2)],
  full: (w, d, s) => [mk('c', 'common', 6, 4, 6, 4, s + 1, 1), mk('k', 'kitchen', 12, 5, 4, 3, s + 2, 2), mk('y', 'yard', 6, 8, w, d, s, 3), mk('s', 'stable', 6 + w, 8, 6, 4, s + 3, 4)],
  yardFirst: (w, d, s) => [mk('y', 'yard', 6, 8, w, d, s, 1), mk('c', 'common', 6, 4, 6, 4, s + 1, 2), mk('k', 'kitchen', 2, 8, 4, 3, s + 2, 3)],
  court: (w, d, s) => [mk('y', 'yard', 6, 8, w, d, s, 1), mk('c', 'common', 6, 4, w, 4, s + 1, 2), mk('h', 'hallway', 6, 8 + d, w, 2, s + 2, 3), mk('k', 'kitchen', 2, 8, 4, d, s + 3, 4), mk('b', 'barn', 6 + w, 8, 6, d, s + 4, 5)],
};
const SIZES = [[2, 2], [3, 3], [4, 4], [6, 5], [8, 5], [8, 8], [12, 8]];
const stats = { n: 0, dens: [], focal: 0, focalWanted: 0, signs: 0, props: 0, byArr: {} };

function checkLayout(tag, B, L, y) {
  const X0 = y.x * CELL + INSET, Z0 = y.z * CELL + INSET, X1 = (y.x + y.w) * CELL - INSET, Z1 = (y.z + y.d) * CELL - INSET, W = X1 - X0, D = Z1 - Z0, A = W * D;
  ok(L.role === 'outdoor' && !L.purposeFail, `${tag} role/purpose: ${L.role} ${L.purposeFail}`);
  // nothing outside the rect (everything: props, signs on the wall face, the path's dirt)
  for (const p of L.placements) { if (isEdge(p)) continue; const [aw, ad] = aabb(p); ok(p.x - aw / 2 >= X0 - TOL && p.x + aw / 2 <= X1 + TOL && p.z - ad / 2 >= Z0 - TOL && p.z + ad / 2 <= Z1 + TOL, `${tag} ${p.id} (${p.rule}) outside the yard`); }
  // no overlaps
  const fl = standing(L);
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const a = fl[i], b = fl[j]; ok(!overlap(a, b), `${tag} overlap ${a.id}/${b.id}`); }
  // sparse on purpose: never over 1.5x the low target; the target itself is far under any indoor room
  const dv = L.checks.density;
  ok(dv.target === yardTarget(A) && dv.target <= DENSITY.yard && (A < 1200 || dv.target < DENSITY.yard) && DENSITY.yard <= 0.6 * Math.min(...Object.entries(DENSITY).filter(([k]) => k !== 'yard').map(([, v]) => v)), `${tag} yard target ${dv.target} is not well under every indoor target`);
  if (A >= 300) ok(dv.value <= 1.5 * dv.target, `${tag} density ${dv.value} over 1.5x the target`);
  // doors, gate, paths
  const ops = B.E.openings.get(y.id), doors = ops.filter(o => o.kind === 'door' && !o.part), gate = ops.find(o => o.kind === 'gate');
  const openSegs = B.E.open.get(y.id);
  ok(!!gate === openSegs.length > 0, `${tag} gate ${!!gate} but ${openSegs.length} open segments`);
  if (gate) ok(openSegs.some(s => s.side === gate.side && s.index === gate.index), `${tag} gate is not on an open segment`);
  ok(L.paths.every(p => p.ok), `${tag} blocked path: ${L.paths.filter(p => !p.ok).map(p => p.kind)}`);
  const sidePt = (side, t, off) => side === 'N' ? [X0 + t, Z0 + off] : side === 'S' ? [X0 + t, Z1 - off] : side === 'W' ? [X0 + off, Z0 + t] : [X1 - off, Z0 + t];
  const tcOf = (o) => o.index * CELL - INSET + (o.span || 1) * CELL / 2;
  if (gate) for (const d of doors) {
    const from = sidePt(d.side, tcOf(d), 1.4), to = sidePt(gate.side, tcOf(gate), 1.2);
    ok(walkable(L, from, to), `${tag} no clear way from the ${d.side} door to the gate`);
    // and the straight-ish line the solver reserved is free of props (3 ft wide)
    const path = L.paths.find(p => Math.hypot(p.pts[0][0] - from[0], p.pts[0][1] - from[1]) < 1.5);
    if (path) for (const p of fl) { if (isEdge(p)) continue; /* the path ends AT the gate piece, between the sections either side of it */ const [aw, ad] = aabb(p); for (let i = 0; i + 1 < path.pts.length; i++) ok(!segHitsBox(path.pts[i], path.pts[i + 1], p.x, p.z, aw / 2 + 1.0, ad / 2 + 1.0), `${tag} ${p.id} stands on the path`); }
  }
  if (doors.length && gate && Math.min(W, D) > 9) ok(L.paths.length >= 1 && L.paths[0].kind === 'path', `${tag} ${doors.length} doors but no main path (other doors join it where they are not already on it)`);
  // the focal thing: present when the size allows, exactly one, in the open; the middle holds nothing else
  const focal = L.placements.filter(p => p.rule === 'yard-focal');
  const allows = Math.min(W, D) >= YARD.focalMin && A >= YARD.focalArea;
  if (allows) { stats.focalWanted++; stats.focal += focal.length; }
  ok(focal.length === (allows ? 1 : 0), `${tag} ${focal.length} focal things (size ${allows ? 'allows' : 'too small'})`);
  for (const f of focal) ok(Math.min(f.x - X0, X1 - f.x, f.z - Z0, Z1 - f.z) >= 3.4 + Math.min(...aabb(f)) / 2 - 0.3, `${tag} focal ${f.id} is not in the open`);
  const mid = [X0 + W * 0.3, Z0 + D * 0.3, X1 - W * 0.3, Z1 - D * 0.3];
  if (allows) for (const p of fl) if (p.x > mid[0] && p.x < mid[2] && p.z > mid[1] && p.z < mid[3]) ok(p.zone === 'focal', `${tag} ${p.id} (${p.rule}) stands in the open middle`);
  // signs and lights: on a real wall of a neighbouring building, not a door or window, facing the yard
  for (const p of hung(L)) {
    stats.signs++;
    ok(p.side && Math.abs(p.rot - SIDE_ROT[p.side]) < 1e-3, `${tag} ${p.id} does not face the yard`);
    const along = p.side === 'N' || p.side === 'S' ? p.x - y.x * CELL : p.z - y.z * CELL, [aw, ad] = aabb(p), half = (p.side === 'N' || p.side === 'S' ? aw : ad) / 2;
    for (const t of [along - half + 0.05, along, along + half - 0.05]) {
      const i = Math.floor(t / CELL), key = p.side === 'N' ? `h:${y.x + i}:${y.z}` : p.side === 'S' ? `h:${y.x + i}:${y.z + y.d}` : p.side === 'W' ? `v:${y.x}:${y.z + i}` : `v:${y.x + y.w}:${y.z + i}`;
      const e = B.E.edges.get(key);
      ok(e && e.kind === 'wall' && e.yard?.room === y.id && !isOutdoor(B.rooms.find(r => r.id === e.sides[0].room).type), `${tag} ${p.id} hangs on ${e ? e.kind : 'thin air'} (${key})`);
    }
    const face = p.side === 'N' ? p.z - Z0 : p.side === 'S' ? Z1 - p.z : p.side === 'W' ? p.x - X0 : X1 - p.x;
    ok(face >= -0.01 && face < 1.6 && p.y >= 2.5, `${tag} ${p.id} is ${face.toFixed(2)} ft off the wall at ${p.y} ft`);
  }
  for (const p of L.placements.filter(p => /^yard-(wall|woodpile|fill|door)$/.test(p.rule) && p.side)) { // things "against the wall" are against a BUILDING wall
    const off = p.side === 'N' ? p.z - Z0 : p.side === 'S' ? Z1 - p.z : p.side === 'W' ? p.x - X0 : X1 - p.x, [aw, ad] = aabb(p);
    ok(off - (p.side === 'N' || p.side === 'S' ? ad : aw) / 2 < 0.6, `${tag} ${p.id} (${p.rule}) is not against its wall`);
    const t = p.side === 'N' || p.side === 'S' ? p.x - y.x * CELL : p.z - y.z * CELL, i = Math.floor(t / CELL);
    const key = p.side === 'N' ? `h:${y.x + i}:${y.z}` : p.side === 'S' ? `h:${y.x + i}:${y.z + y.d}` : p.side === 'W' ? `v:${y.x}:${y.z + i}` : `v:${y.x + y.w}:${y.z + i}`;
    ok(B.E.edges.has(key), `${tag} ${p.id} (${p.rule}) stands at an open edge, not a wall`);
  }
  // plants (meshes arrived 2026-10-05, outdoors-02): the slot fills by itself, 2-4 picks, and the summary says so
  { const pl = L.placements.filter(p => p.rule === 'yard-plant'), P = L.yard.plants;
    ok(P.slot.includes('bush') && P.slot.some(i => /^tree-/.test(i)) && P.placed === pl.length && pl.length <= YARD.plants[1], `${tag} plants: slot ${P.slot.length}, placed ${P.placed}/${pl.length}`);
    if (A >= 300) ok(pl.length >= 1, `${tag} no plant in a yard of ${A.toFixed(0)} sq ft`);
    ok(pl.length ? /Plants: \d+ placed/.test(summarize2(L)) : /Plants: slot has meshes but nothing fitted/.test(summarize2(L)), `${tag} summary does not say what the plants slot did`);
    stats.plants = (stats.plants || 0) + pl.length; }
  // the edge (fence / hedge / dry-stone wall, 2026-10-05): one piece on every open segment and nowhere else, the gate
  // piece on the gate's segment, posts only where a run ends or turns and never against the building
  { const E = L.placements.filter(isEdge), kind = L.yard.edge, kit = YARD_EDGES[kind];
    ok(kind === 'none' ? E.length === 0 : !!kit && E.length === L.yard.edgePieces && E.length > 0, `${tag} edge ${kind} with ${E.length} pieces`);
    if (!openSegs.length) ok(kind === 'none', `${tag} a closed court has an edge (${kind})`);
    if (kit) {
      (stats.edges ||= {})[kind] = (stats.edges[kind] || 0) + 1;
      const mid = (sg) => sg.side === 'N' ? [(y.x + sg.index + 0.5) * CELL, y.z * CELL] : sg.side === 'S' ? [(y.x + sg.index + 0.5) * CELL, (y.z + y.d) * CELL] : sg.side === 'W' ? [y.x * CELL, (y.z + sg.index + 0.5) * CELL] : [(y.x + y.w) * CELL, (y.z + sg.index + 0.5) * CELL];
      const at = (p, [x, z]) => Math.abs(p.x - x) < 0.02 && Math.abs(p.z - z) < 0.02, runs = E.filter(p => p.id !== kit[1]), posts = E.filter(p => p.id === kit[1]);
      const gaps = L.yard.edgeGaps || [], isGap = (sg) => gaps.some(q => q.side === sg.side && q.index === sg.index); // left open: a door reaches the corner there
      for (const q of gaps) ok((q.index === 0 || q.index === (q.side === 'N' || q.side === 'S' ? y.w : y.d) - 1) && doors.length > 0, `${tag} edge gap ${q.side}${q.index} is not at a corner beside a door`);
      stats.edgeGaps = (stats.edgeGaps || 0) + gaps.length;
      for (const sg of openSegs) { const here = runs.filter(p => at(p, mid(sg))), isGate = gate && sg.side === gate.side && sg.index === gate.index;
        if (isGap(sg)) { ok(here.length === 0, `${tag} a piece stands in the gap left for the door at ${sg.key}`); continue; }
        ok(here.length === 1 && here[0].id === (isGate ? kit[2] : kit[0]) && (sg.side === 'N' || sg.side === 'S') === (Math.abs(Math.sin(here[0].rot)) < 0.01), `${tag} open segment ${sg.key}: ${here.map(p => p.id).join(',') || 'nothing'} (${kind})`); }
      ok(runs.length === openSegs.length - gaps.length, `${tag} ${runs.length} ${kind} sections on ${openSegs.length} open segments (${gaps.length} left open beside a door)`);
      for (const p of posts) { const gx = p.x / CELL, gz = p.z / CELL;
        ok(Math.abs(gx - Math.round(gx)) < 0.01 && Math.abs(gz - Math.round(gz)) < 0.01, `${tag} ${p.id} is not on a grid corner (${p.x},${p.z})`);
        ok(![`h:${Math.round(gx) - 1}:${Math.round(gz)}`, `h:${Math.round(gx)}:${Math.round(gz)}`, `v:${Math.round(gx)}:${Math.round(gz) - 1}`, `v:${Math.round(gx)}:${Math.round(gz)}`].some(k => B.E.edges.get(k)?.yard?.room === y.id), `${tag} ${p.id} stands against the building wall at ${p.x},${p.z}`); }
      const builtAt = (gx, gz) => [`h:${gx - 1}:${gz}`, `h:${gx}:${gz}`, `v:${gx}:${gz - 1}`, `v:${gx}:${gz}`].some(k => B.E.edges.get(k)?.yard?.room === y.id);
      if (kit[2] === 'gate-fence') { const [mx, mz] = mid(gate), horiz = gate.side === 'N' || gate.side === 'S';
        for (const sgn of [-1, 1]) { const vx = mx + (horiz ? sgn * CELL / 2 : 0), vz = mz + (horiz ? 0 : sgn * CELL / 2); if (!builtAt(Math.round(vx / CELL), Math.round(vz / CELL))) ok(posts.some(p => at(p, [vx, vz])), `${tag} no gate post at ${vx},${vz}`); } }
    } }
  stats.n++; stats.props += fl.length; (stats.byArr[tag.split(' ')[0]] ||= []).push(+(dv.value / dv.target).toFixed(2));
}
function segHitsBox(a, b, cx, cz, hw, hd) {
  let t0 = 0, t1 = 1;
  for (const [o, dv, lo, hi] of [[a[0], b[0] - a[0], cx - hw, cx + hw], [a[1], b[1] - a[1], cz - hd, cz + hd]]) {
    if (Math.abs(dv) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let u = (lo - o) / dv, v = (hi - o) / dv; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}
// BFS over the occupancy grid; blocked = BLOCK cells grown by one cell (a person needs about 1.5 ft)
function walkable(L, from, to) {
  const g = L.grid, nx = g.nx, nz = g.nz, blocked = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (g.cells[j * nx + i] === 1) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) blocked[jj * nx + ii] = 1; }
  const cell = ([x, z]) => [Math.min(nx - 1, Math.max(0, Math.floor((x - g.x0) / g.res))), Math.min(nz - 1, Math.max(0, Math.floor((z - g.z0) / g.res)))];
  const s = cell(from), t = cell(to); if (blocked[s[1] * nx + s[0]] || blocked[t[1] * nx + t[0]]) return false;
  const seen = new Uint8Array(nx * nz), q = [s[1] * nx + s[0]]; seen[q[0]] = 1;
  while (q.length) { const k = q.shift(); if (k === t[1] * nx + t[0]) return true; const i = k % nx, j = Math.floor(k / nx);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj, kk = jj * nx + ii; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && !blocked[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); } } }
  return false;
}

// ---------------------------------------------------------------- 1. every arrangement, size and seed
for (const [name, make] of Object.entries(ARR)) for (const [w, d] of SIZES) for (let s = 1; s <= 8; s++) {
  if (name === 'court' && (w < 3 || d < 3)) continue;
  const seed = s * 7919 + w * 31 + d, B = build(make(w, d, seed)), y = B.rooms.find(r => r.id === 'y'), tag = `${name} ${w}x${d} s${s}`;
  let L; try { L = B.solve('y'); } catch (e) { ok(false, `${tag} threw ${e.stack.split('\n').slice(0, 2).join(' ')}`); continue; }
  checkLayout(tag, B, L, y);
  ok(JSON.stringify(B.solve('y').placements) === JSON.stringify(L.placements), `${tag} not deterministic`);
  stats.dens.push(L.checks.density.value);
  // ---- walls: nothing built on the open edges; the building owns what it shares
  for (const e of B.E.edges.values()) {
    ok(e.sides.length && e.sides.every(x => !isOutdoor(B.rooms.find(r => r.id === x.room).type)), `${tag} edge ${e.key} is owned by a yard`);
    ok(!isOutdoor(B.rooms.find(r => r.id === e.owner.room).type) && e.family === B.rooms.find(r => r.id === e.owner.room).family, `${tag} edge ${e.key} family/owner`);
  }
  for (const sgm of B.E.open.get('y')) ok(!B.E.edges.has(sgm.key), `${tag} a wall stands on open edge ${sgm.key}`);
  for (const c of B.E.corners) ok([`h:${c.gx - 1}:${c.gz}`, `h:${c.gx}:${c.gz}`, `v:${c.gx}:${c.gz - 1}`, `v:${c.gx}:${c.gz}`].some(k => B.E.edges.has(k)), `${tag} a post stands alone at ${c.gx}:${c.gz}`);
  if (name === 'alone') ok(B.E.edges.size === 0 && B.E.corners.length === 0 && B.E.open.get('y').length === 2 * (w + d), `${tag} a lone yard built ${B.E.edges.size} wall pieces`);
  if (name === 'court') ok(B.E.open.get('y').length === 0 && !B.E.openings.get('y').some(o => o.kind === 'gate'), `${tag} a closed court has no gate`);
  // ---- doors: the neighbours open onto the yard
  const yd = B.E.openings.get('y').filter(o => o.kind === 'door' && !o.part);
  if (name !== 'alone') ok(yd.some(o => o.to === 'c') && B.E.openings.get('c').some(o => o.kind === 'door' && o.yard === 'y'), `${tag} the common room has no door onto the yard`);
  if (name === 'full') { const sd = yd.find(o => o.to === 's'); ok(sd && (d < 3 || sd.span >= 2), `${tag} stable door onto the yard: ${JSON.stringify(sd)}`); }
  if (name === 'inn' || name === 'full' || name === 'yardFirst') {
    const sign = L.placements.filter(p => p.id === 'sign-hanging'), cd = yd.find(o => o.to === 'c');
    const at = [(y.x + cd.index + (cd.span || 1) / 2) * CELL, y.z * CELL];
    // wherever the common room has a plain stretch of wall beside its door (not all windows), its sign hangs there
    const plain = B.E.openings.get('y').some(o => o.to === 'c' && o.kind === 'wall' && o.side === cd.side && (o.index === cd.index - 1 || o.index === cd.index + (cd.span || 1) || o.index === cd.index - 2 || o.index === cd.index + (cd.span || 1) + 1));
    ok(sign.every(p => p.rule === 'yard-sign') && (!plain || sign.some(p => Math.hypot(p.x - at[0], p.z - at[1]) < 19)), `${tag} no inn sign by the common-room door (${sign.length})`);
    if (plain) stats.innSigns = (stats.innSigns || 0) + sign.length; stats.innWalls = (stats.innWalls || 0) + (plain ? 1 : 0);
    ok(/inn/.test(L.yard.vibe), `${tag} vibe ${L.yard.vibe}`);
  }
  if (name === 'full') { ok(/stable yard/.test(L.yard.vibe), `${tag} vibe ${L.yard.vibe}`); if (w * d >= 40) { stats.stableYards = (stats.stableYards || 0) + 1; if (L.yard.doors.find(q => q.to === 'stable').things.some(i => /trough|^hay/.test(i))) stats.stableDressed = (stats.stableDressed || 0) + 1; } }
  // near the low target when there is wall to gather against and room to do it
  if ((name === 'full' || name === 'court') && w * d >= 16) ok(L.checks.density.value >= 0.6 * L.checks.density.target, `${tag} density ${L.checks.density.value} under 60% of the target with ${L.yard.wallFt} ft of wall`);
  if (process.argv.includes('--print') && s === 1 && w === 8 && d === 5) console.log(`\n--- ${tag}\n` + summarize2(L, id => T[B.rooms.find(r => r.id === id)?.type]?.label || id));
  // the classic engine still runs a yard
  if (s === 1) { try { solveRoom({ lib, type: T.yard, room: y, openings: B.E.openings.get('y'), opts: { orient } }); } catch (e) { ok(false, `${tag} v1 threw ${e.message}`); } }
}

// ---------------------------------------------------------------- 2. door policy details
{ // a privy on the yard opens onto it and nowhere else; a guest room off a hallway does not get a second door to the yard
  const B = build([mk('c', 'common', 6, 4, 6, 4, 11, 1), mk('y', 'yard', 6, 8, 8, 5, 12, 2), mk('p', 'privy', 4, 9, 2, 2, 13, 3), mk('h', 'hallway', 14, 8, 2, 6, 14, 4), mk('g', 'guest', 16, 8, 3, 3, 15, 5)]);
  const pd = B.E.openings.get('p').filter(o => o.kind === 'door');
  ok(pd.length === 1 && pd[0].yard === 'y' && /only door, opens onto the yard/.test(pd[0].why), `privy doors ${JSON.stringify(pd)}`);
  ok(B.E.openings.get('h').some(o => o.kind === 'door' && o.yard === 'y'), 'hallway has no door onto the yard');
  const gd = B.E.openings.get('g').filter(o => o.kind === 'door' && !o.part);
  ok(gd.length === 1 && gd[0].to === 'h', `guest doors ${JSON.stringify(gd)}`);
  // every indoor room is still reachable (the yard is a way in)
  const L = B.solve('y'); ok(L.yard.doors.some(d => d.to === 'privy'), 'yard does not know its privy door');
}
{ // a building's sticky front door that faces the yard stays its front door (grand, wide): the yard is a forecourt
  let seen = 0;
  for (let s = 1; s <= 40; s++) {
    const B = build([mk('c', 'common', 6, 4, 6, 4, s * 13, 1), mk('y', 'yard', 6, s % 2 ? 8 : 0, 6, 4, s * 17, 2)]); // south of the inn (its front), or north (its back)
    const e = [...B.E.edges.values()].find(x => x.kind === 'door' && x.yard);
    ok(!!e, `s${s} common room has no door onto the yard`);
    if (e && /entrance from outside/.test(e.why)) { seen++; ok(e.doorType === 'door-double-grand' && e.span === 2, `forecourt door ${e.doorType} x${e.span}`); ok(/forecourt/.test(B.solve('y').yard.vibe), 'front door onto the yard is not a forecourt'); }
    else if (e) ok(/opens onto the yard/.test(e.why) && e.span === 1, `back door ${e.why} x${e.span}`);
  }
  ok(seen > 3 && seen < 40, `forecourts ${seen}/40 (want both front and back doors across seeds)`);
}
{ // the neighbours are not harmed: every room type at its usual size, with a yard on any side, still gets its key purpose
  // (a work room's or a stable's one outside door MOVES to the yard instead of gaining a second one; a lobby gets none)
  let n = 0, bad = [];
  for (const t of types.filter(t => t.key !== 'yard')) for (const side of ['S', 'E', 'N']) for (let s = 1; s <= 8; s++) {
    const [w, d] = t.cells, yard = side === 'S' ? mk('y', 'yard', 10, 10 + d, Math.max(w, 6), 5, s, 2) : side === 'E' ? mk('y', 'yard', 10 + w, 10, 6, Math.max(d, 5), s, 2) : mk('y', 'yard', 10, 5, Math.max(w, 6), 5, s, 2);
    const B = build([mk('r', t.key, 10, 10, w, d, s * 7919, 1), yard]), L = B.solve('r'); n++;
    if (L.purposeFail) bad.push(`${t.key} yard ${side} s${s}: ${L.purposeFail}`);
    const ext = B.E.openings.get('r').filter(o => o.kind === 'door' && !o.part), role = roleOf(t.key);
    if (role === 'uses' || role === 'mixed' || role === 'terminal') ok(ext.length === 1 && ext[0].yard === 'y', `${t.key} beside a yard (${side}) should have ONE outside door, onto the yard: ${JSON.stringify(ext.map(o => [o.side, o.yard]))}`);
    if (role === 'hub' || t.key === 'hallway') ok(ext.some(o => o.yard === 'y') && ext.length <= 2, `${t.key} beside a yard (${side}): ${ext.length} doors`);
    if (t.key === 'desk') ok(ext.length === 1, `front desk beside a yard (${side}) got ${ext.length} doors`);
  }
  ok(bad.length === 0, `rooms beside a yard lost their key purpose: ${bad.slice(0, 5).join('; ')}`);
  console.log(`neighbours: ${n} rooms beside a yard, ${bad.length} purpose fails`);
  // a closed court: the kitchen keeps its street door (the court is no way in from outside) and gains one onto the court
  const B = build(ARR.court(8, 6, 4242)), kd = B.E.openings.get('k').filter(o => o.kind === 'door' && !o.part);
  ok(kd.some(o => o.yard === 'y') && kd.some(o => !o.yard && !o.to), `kitchen on a closed court: ${JSON.stringify(kd.map(o => [o.side, o.to, o.yard]))}`);
}
{ // a room that is turned into a yard forgets its sticky front door (the tuner's "change type"): no door appears in the neighbour's wall for it
  const rooms = [mk('c', 'common', 6, 4, 6, 4, 77, 1), mk('g', 'guest', 6, 8, 4, 4, 78, 2)];
  for (const r of rooms) r.extDoor = chooseExteriorDoor(r, rooms);
  rooms[1].type = 'yard';   // extDoor stays on the object, as in the tuner
  const E = computeEdges(rooms, { engine: 'v2' });
  ok(![...E.edges.values()].some(e => e.doorFor === 'g') && E.open.get('g').length === 12, 'a guest room turned yard kept its old front door');
}
{ // two yards side by side: open ground between them, no wall, no door
  const B = build([mk('a', 'yard', 4, 4, 4, 4, 5, 1), mk('b', 'yard', 8, 4, 4, 4, 6, 2)]);
  ok(B.E.edges.size === 0 && B.E.open.get('a').length === 12 && B.E.open.get('b').length === 12, `two yards built ${B.E.edges.size} edges, open ${B.E.open.get('a').length}/${B.E.open.get('b').length}`);
  B.solve('a'); B.solve('b');
}

// ---------------------------------------------------------------- 3. plants arrive: the slot fills by itself
{
  const lib2 = structuredClone(lib);
  const fake = (id, from, size, place = 'ground') => { lib2.objects[id] = { ...structuredClone(lib.objects[from]), id, size, place, scale: [1, 1] }; };
  fake('bush', 'barrel', [40, 40, 36]); fake('bush-berry', 'barrel', [36, 36, 36]); fake('tree-deciduous', 'well', [84, 84, 240]); fake('planter-barrel', 'barrel', [26, 26, 30]);
  const T2 = { ...T, yard: { ...T.yard, slots: { ...T.yard.slots, plants: ['bush', 'bush-berry', 'planter-barrel', 'tree-deciduous'] }, missing: T.yard.missing.filter(i => !lib2.objects[i]) } };
  let total = 0, treeFocal = 0, n = 0;
  for (const name of ['alone', 'inn', 'full']) for (const [w, d] of [[4, 4], [6, 5], [8, 8], [12, 8]]) for (let s = 1; s <= 6; s++) {
    const B = build(ARR[name](w, d, s * 104729 + w), { useLib: lib2, typeMap: T2 }), y = B.rooms.find(r => r.id === 'y'), L = B.solve('y'), tag = `plants ${name} ${w}x${d} s${s}`;
    const X0 = y.x * CELL + INSET, Z0 = y.z * CELL + INSET, X1 = (y.x + y.w) * CELL - INSET, Z1 = (y.z + y.d) * CELL - INSET;
    const pl = L.placements.filter(p => p.rule === 'yard-plant'); n++; total += pl.length;
    ok(pl.length >= (w * d < 20 ? 1 : YARD.plants[0]) && pl.length <= YARD.plants[1] && L.yard.plants.placed === pl.length, `${tag} ${pl.length} plants (want ${YARD.plants.join('–')})`);
    for (const p of pl) { const [aw, ad] = aabb(p), edge = Math.min(p.x - aw / 2 - X0, X1 - p.x - aw / 2, p.z - ad / 2 - Z0, Z1 - p.z - ad / 2); ok(edge < 2.2, `${tag} ${p.id} is ${edge.toFixed(1)} ft from any edge (plants stand by the edges and the doors)`); }
    if (L.yard.focal?.kind === 'a big tree') { treeFocal++; ok(/^tree-/.test(L.yard.focal.id), `${tag} tree focal is ${L.yard.focal.id}`); }
    const fl = standing(L);
    for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const a = fl[i], b = fl[j]; ok(!overlap(a, b), `${tag} overlap ${a.id}/${b.id}`); }
    ok(L.paths.every(p => p.ok) && /Plants: \d+ placed/.test(summarize2(L)), `${tag} paths/summary`);
  }
  ok(treeFocal > 0, 'a big tree never became the focal thing once trees exist');
  console.log(`plants (injected meshes): ${(total / n).toFixed(1)} per yard over ${n} yards; a tree was the focal thing in ${treeFocal}`);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`yard density as a share of its target (${DENSITY.yard} per 100 sq ft up to ${YARD.taper} sq ft, thinning beyond; indoor targets ${Math.min(...Object.entries(DENSITY).filter(([k]) => k !== 'yard').map(([, v]) => v))}–${Math.max(...Object.values(DENSITY))}): ` + Object.entries(stats.byArr).map(([k, v]) => `${k} ${mean(v).toFixed(1)} [${Math.min(...v)}–${Math.max(...v)}]`).join('; '));
ok(stats.stableDressed >= 0.9 * stats.stableYards, `only ${stats.stableDressed}/${stats.stableYards} stable doors have a trough or hay beside them`);
console.log(`stable doors with a trough or hay beside them: ${stats.stableDressed}/${stats.stableYards} (the rest have no wall left beside a wide door)`);
console.log(`inn signs: ${stats.innSigns} on ${stats.innWalls} common-room walls with a plain stretch by the door`);
console.log(`focal present ${stats.focal}/${stats.focalWanted} where the size allows; ${stats.signs} signs and lights, all on a real neighbouring wall`);
console.log(`plants from real meshes: ${(stats.plants / stats.n).toFixed(1)} per yard; edges: ${JSON.stringify(stats.edges || {})} (the rest none: closed courts, and 'none' stays in the roll)`);
console.log(`yard: ${stats.n} yards, ${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
