// "Repeat" growth (Harry 2026-10-01): node tools/spawn-tuner/test/repeat.test.mjs
// 1. Dormitories: "you never make the dorm room beds into rows down the middle when there is space". Big dorms put beds on
//    the long walls and rows of beds down the middle (storeroom aisle grammar; head to head or single, rolled), a foot chest
//    at each bed, aisles clear and walkable, every bed reachable from the door.
// 2. Kitchens: "in theory they should just get lots of cooking zones and baking areas" / "way under density target, fill
//    this crap up!" / "an industrial kitchen basically devolves to aisles": cooking lines repeat along the walls, bake
//    corners repeat, the middle becomes parallel work rows with 4-5 ft working aisles; density >= 100% of target
//    (10 props / 100 sq ft) at 30x30, 40x60 and 60x60 while working faces, oven mouths and walkways stay clear.
import { readFileSync } from 'node:fs';
import { solveRoom2, summarize2 } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor } from '../js/walls.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL', m); } };
const SEEDS = Array.from({ length: 10 }, (_, i) => (i + 1) * 7351 + 29);
function solve(type, w, d, seed) {
  const r = { id: 'r1', type, x: 2, z: 2, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created: 1 };
  r.extDoor = chooseExteriorDoor(r, [r]); const E = computeEdges([r], { engine: 'v2' });
  return solveRoom2({ lib, type: T[type], room: r, openings: E.openings.get('r1'), opts: { orient }, roomTypeOf: () => null });
}
const aabb = (p) => { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)); return [c * p.dims[0] + s * p.dims[2], s * p.dims[0] + c * p.dims[2]]; };
const overlap = (a, b) => { const [aw, ad] = aabb(a), [bw, bd] = aabb(b); return Math.abs(a.x - b.x) < (aw + bw) / 2 - 0.05 && Math.abs(a.z - b.z) < (ad + bd) / 2 - 0.05; };
const floorThings = (L) => L.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && p.orient !== 'wall' && p.rule !== 'wall-mount' && p.rule !== 'ceiling');
const front = (p, dist) => [p.x + Math.sin(p.rot) * (p.dims[2] / 2 + dist), p.z + Math.cos(p.rot) * (p.dims[2] / 2 + dist)];
const face = (p, depth) => { const fx = Math.sin(p.rot), fz = Math.cos(p.rot), off = p.dims[2] / 2 + depth / 2; return { x: p.x + fx * off, z: p.z + fz * off, rot: p.rot, dims: [p.dims[0] + 0.5, 0, depth] }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// BFS over the occupancy grid: blocked = BLOCK cells grown by one cell (a person needs ~1.5 ft)
function reachable(L, from, to) {
  const g = L.grid, nx = g.nx, nz = g.nz, blocked = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (g.cells[j * nx + i] === 1) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) blocked[jj * nx + ii] = 1; }
  const cell = ([x, z]) => [Math.min(nx - 1, Math.max(0, Math.floor((x - g.x0) / g.res))), Math.min(nz - 1, Math.max(0, Math.floor((z - g.z0) / g.res)))];
  const near = (c) => { for (let r = 0; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = c[0] + di, j = c[1] + dj; if (i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i]) return [i, j]; } return null; };
  const s = near(cell(from)), t = near(cell(to)); if (!s || !t) return false;
  const seen = new Uint8Array(nx * nz), q = [s[1] * nx + s[0]]; seen[q[0]] = 1;
  while (q.length) { const k = q.shift(); if (k === t[1] * nx + t[0]) return true; const i = k % nx, j = Math.floor(k / nx);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj, kk = jj * nx + ii; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && !blocked[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); } } }
  return false;
}

// ---- 1. dormitory middle rows
const dormStats = {}, kinds = new Set();
for (const [w, d, minRow] of [[8, 8, 3], [10, 12, 10], [12, 10, 10]]) for (const seed of SEEDS) {
  const L = solve('guest', w, d, seed), tag = `dorm ${w * 5}x${d * 5} s${seed}`, sum = summarize2(L);
  const beds = L.placements.filter(p => /^bed-/.test(p.id) && p.layer === 'anchor'), row = beds.filter(p => p.rule === 'dorm-row-bed');
  (dormStats[`${w * 5}x${d * 5}`] ||= []).push(`${beds.length}/${row.length}`);
  ok(row.length >= minRow, `${tag}: only ${row.length} beds in middle rows (want >= ${minRow})`);
  ok(/^Dorm: \d+ beds/m.test(sum), `${tag}: summary has no Dorm line`);
  if (L.dorm?.kind) kinds.add(L.dorm.kind.split(' ')[0]);
  // every bed reachable: the floor at its foot (past the foot chest) is walkable from the door
  for (const b of beds) ok(reachable(L, L.mainDoor.inner, front(b, 2.6)), `${tag}: bed at ${b.x},${b.z} (${b.rule}) not reachable from the door`);
  // aisles clear and walkable from the door
  for (const p of L.paths.filter(p => /aisle/.test(p.kind))) { ok(p.ok, `${tag}: ${p.kind} blocked`); for (const end of [p.pts[0], p.pts.at(-1)]) ok(reachable(L, L.mainDoor.inner, end), `${tag}: ${p.kind} end ${end} not walkable`); }
  // foot chests: most middle-row beds have one
  const feet = L.placements.filter(p => p.rule === 'companion' && row.some(b => b.uid === p.with));
  ok(row.length === 0 || feet.length >= row.length * 0.6, `${tag}: only ${feet.length}/${row.length} middle-row beds have a foot chest`);
  const fl = floorThings(L);
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) ok(!overlap(fl[i], fl[j]), `${tag}: ${fl[i].id} overlaps ${fl[j].id}`);
}
ok(kinds.has('double') && kinds.has('single'), `dorm row style never varies (${[...kinds]})`);
// small dorms (no depth for a middle row) keep beds on the walls
for (const seed of SEEDS.slice(0, 4)) { const L = solve('guest', 6, 6, seed); ok(L.placements.filter(p => /^bed-/.test(p.id)).length >= 6 && !L.placements.some(p => p.rule === 'dorm-row-bed'), `dorm 30x30 s${seed}: should be wall beds only`); }

// ---- 2. kitchens: repeat + industrial work rows + density >= 100%
const kStats = {};
let peelNear = 0, peelN = 0;
for (const [w, d] of [[6, 6], [8, 12], [12, 8], [12, 12]]) for (const seed of SEEDS.slice(0, 8)) {
  const L = solve('kitchen', w, d, seed), tag = `kitchen ${w * 5}x${d * 5} s${seed}`, sum = summarize2(L), K = L.kitchen;
  const D = L.checks.density;
  (kStats[`${w * 5}x${d * 5}`] ||= []).push(D.value);
  ok(D.value >= D.target, `${tag}: density ${D.value} under target ${D.target}`);
  ok(/^Kitchen: /m.test(sum), `${tag}: summary has no Kitchen line`);
  const ovens = L.placements.filter(p => p.id === 'bread-oven'), hearths = L.placements.filter(p => p.id === 'cook-hearth-spit');
  if (w * d >= 96) {
    ok(hearths.length + ovens.length >= 4, `${tag}: only ${hearths.length} cooking lines + ${ovens.length} bake corners (want >= 4)`);
    ok(K.rows >= 1 && K.tables >= 6, `${tag}: no industrial work rows (${K.rows} rows, ${K.tables} stations)`);
    ok(L.zones.some(z => z.kind === 'pass'), `${tag}: the serving pass got squeezed out`);
    const aisles = L.paths.filter(p => p.kind === 'aisle');
    ok(aisles.length >= 2, `${tag}: work rows without working aisles`);
    ok(L.rows && L.rows.aisle >= 4 && L.rows.aisle <= 5, `${tag}: working aisle ${L.rows?.aisle} ft (want 4-5)`);
    for (const p of aisles) { ok(p.ok, `${tag}: working aisle blocked`); for (const end of [p.pts[0], p.pts.at(-1)]) ok(reachable(L, L.mainDoor.inner, end), `${tag}: working aisle end not walkable from the door`); }
  }
  // working faces: nothing stands in an oven's mouth or a cooking line's working face (paths may cross them)
  const fl = floorThings(L);
  for (const a of [...ovens, ...hearths]) for (const p of fl) if (p.uid !== a.uid && p.with !== a.uid) ok(!overlap(p, face(a, 4)), `${tag}: ${p.id} (${p.rule}) stands in the working face of ${a.id}`);
  for (const o of ovens) { peelN++; const pe = L.placements.filter(p => p.id === 'bread-peel').sort((a, b) => dist(a, o) - dist(b, o))[0]; if (pe && dist(pe, o) <= 7.5) peelNear++; }
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) ok(!overlap(fl[i], fl[j]), `${tag}: ${fl[i].id} overlaps ${fl[j].id}`);
}
ok(peelN > 0 && peelNear / peelN >= 0.6, `peel near its oven in only ${peelNear}/${peelN}`);
// ---- 3. one-wall stables: the bare wall's band is the tack & feed wall, not an empty band (Harry 2026-10-01)
const TACKFEED = /^(tack-wall|saddle-rack|horse-blanket-rail|rural-saddle-riding|bridle-hanging|rural-horse-brasses|horse-collar|grain-bin-stable|rural-oat-sack|hay-bale|hay-pile|farrier-stand|rural-water-bucket-stable|bucket|rural-grooming-box|manure-heap|rural-manure-barrow|pitchfork)$/;
const bareCov = [];
let oneWall = 0;
for (const [w, d] of [[6, 4], [8, 6], [10, 6], [8, 8]]) for (let i = 1; i <= 14; i++) {
  const seed = i * 9973 + 5, L = solve('stable', w, d, seed), S = L.stable, tag = `stable ${w * 5}x${d * 5} s${seed}`;
  if (!S || S.walls !== 'one') continue;
  oneWall++;
  ok(S.bareSide, `${tag}: one-wall stable without a bare-wall fill`);
  if (!S.bareSide) continue;
  const g = L.grid, X0 = g.x0, Z0 = g.z0, X1 = X0 + g.nx * g.res, Z1 = Z0 + g.nz * g.res;
  const horiz = S.bareSide === 'N' || S.bareSide === 'S', len = horiz ? X1 - X0 : Z1 - Z0;
  const things = L.placements.filter(p => TACKFEED.test(p.id));
  // door openings on the bare wall (plus a 2.5-ft approach either side) are doorways, not empty band: skip them
  const doorT = L.openings.filter(o => o.kind === 'door' && o.side === S.bareSide).map(o => { const a = o.at_ft - 0.5; return [a - 2.5, a + (o.span || 1) * 5 + 2.5]; });
  let hit = 0, n = 0;
  for (let t = 3; t <= len - 3; t += 1) {
    if (doorT.some(([a, b]) => t >= a && t <= b)) continue;
    const pt = S.bareSide === 'N' ? [X0 + t, Z0 + 1.5] : S.bareSide === 'S' ? [X0 + t, Z1 - 1.5] : S.bareSide === 'W' ? [X0 + 1.5, Z0 + t] : [X1 - 1.5, Z0 + t];
    n++;
    if (things.some(p => { const [aw, ad] = aabb(p); const dx = Math.max(0, Math.abs(p.x - pt[0]) - aw / 2), dz = Math.max(0, Math.abs(p.z - pt[1]) - ad / 2); return Math.hypot(dx, dz) <= 3; })) hit++;
  }
  if (n) bareCov.push(hit / n);
  ok(n === 0 || hit / n >= 0.6, `${tag}: bare ${S.bareSide} wall only ${(100 * hit / n).toFixed(0)}% furnished (want >= 60%)`);
  for (const p of L.paths.filter(p => p.kind === 'aisle')) ok(p.ok, `${tag}: stable aisle blocked`);
  for (const p of L.paths.filter(p => p.kind === 'aisle')) for (const end of [p.pts[0], p.pts.at(-1)]) ok(reachable(L, L.mainDoor.inner, end), `${tag}: aisle end not walkable`);
  const fl = floorThings(L);
  for (let a = 0; a < fl.length; a++) for (let b = a + 1; b < fl.length; b++) ok(!overlap(fl[a], fl[b]), `${tag}: ${fl[a].id} overlaps ${fl[b].id}`);
}
ok(oneWall >= 6, `only ${oneWall} one-wall stables sampled`);
console.log(`one-wall stables: ${oneWall}; bare wall furnished min ${Math.round(100 * Math.min(...bareCov))}% mean ${Math.round(100 * bareCov.reduce((a, b) => a + b, 0) / bareCov.length)}%`);
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} [${v.join(' ')}]`).join('; ');
console.log(`dorm beds total/middle-row: ${fmt(dormStats)}; row styles ${[...kinds].join('+')}`);
console.log(`kitchen density (target 10): ${fmt(Object.fromEntries(Object.entries(kStats).map(([k, v]) => [k, [`min ${Math.min(...v)}`, `mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`]])))}; peel by its oven ${peelNear}/${peelN}`);
// 4. Outdoors (Harry 2026-10-05): the yard does NOT repeat. As it grows it stays sparse (density at or under the low target),
//    keeps ONE focal thing and an open middle; only the wall-gathered things and the edge outbuildings grow.
{
  const dens = {};
  for (const [w, d] of [[4, 4], [8, 6], [12, 8], [16, 12]]) for (const seed of SEEDS.slice(0, 6)) {
    const rooms = [{ id: 'c', type: 'common', x: 6, z: 4, w: 6, d: 4, seed: seed + 1, wallSeed: seed * 3 + 2, family: T.common.family, created: 1 }, { id: 'y', type: 'yard', x: 6, z: 8, w, d, seed, wallSeed: seed * 3 + 1, family: T.yard.family, created: 2 }];
    for (const r of rooms) r.extDoor = chooseExteriorDoor(r, rooms);
    const E = computeEdges(rooms, { engine: 'v2' });
    const L = solveRoom2({ lib, type: T.yard, room: rooms[1], openings: E.openings.get('y'), opts: { orient }, roomTypeOf: (id) => rooms.find(r => r.id === id)?.type });
    const tag = `yard ${w * 5}x${d * 5} s${seed}`, dv = L.checks.density;
    (dens[`${w * 5}x${d * 5}`] ||= []).push(dv.value);
    ok(dv.value <= 1.5 * dv.target, `${tag}: density ${dv.value} over 1.5x the target ${dv.target}`);
    ok(L.placements.filter(p => p.rule === 'yard-focal').length === 1, `${tag}: ${L.placements.filter(p => p.rule === 'yard-focal').length} focal things`);
    ok(L.paths.length && L.paths.every(p => p.ok), `${tag}: path blocked`);
    const X0 = 30.5, Z0 = 40.5, W = w * 5 - 1, D = d * 5 - 1;
    for (const p of floorThings(L)) if (p.x > X0 + W * 0.3 && p.x < X0 + W * 0.7 && p.z > Z0 + D * 0.3 && p.z < Z0 + D * 0.7) ok(p.zone === 'focal', `${tag}: ${p.id} stands in the open middle`);
  }
  console.log('yard density (target 2 per 100 sq ft, thinning past 600 sq ft; stays sparse as it grows): ' + Object.entries(dens).map(([k, v]) => `${k} [mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}]`).join('; '));
}
console.log(`repeat: ${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
