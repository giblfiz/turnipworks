// Stables (Harry 2026-10-01): node tools/spawn-tuner/test/stable.test.mjs
// stalls 5 ft on centre and 10 ft deep, each with a gate and hay; a centre aisle >= 9 ft wide, walkable from the door to
// both ends; stall rows on one or both long walls, varying across seeds; super-jumbo stables (75x75) get back-to-back
// middle rows and dozens of stalls; the summary reports the choices.
import { readFileSync } from 'node:fs';
import { solveRoom2, summarize2 } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor } from '../js/walls.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 30) console.log('FAIL', m); } };
function solve(w, d, seed) {
  const r = { id: 'r1', type: 'stable', x: 2, z: 2, w, d, seed, wallSeed: seed * 3 + 1, family: T.stable.family, created: 1 };
  r.extDoor = chooseExteriorDoor(r, [r]); const E = computeEdges([r], { engine: 'v2' });
  return solveRoom2({ lib, type: T.stable, room: r, openings: E.openings.get('r1'), opts: { orient }, roomTypeOf: () => 'stable' });
}
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
const walls = { m: new Set(), l: new Set() };
const big = [];
for (const [w, d, min] of [[6, 4, 3], [8, 8, 5], [10, 6, 8], [15, 15, 24]]) for (let seed = 1; seed <= 12; seed++) {
  const L = solve(w, d, seed * 4049 + 7), S = L.stable, tag = `stable ${w * 5}x${d * 5} s${seed}`;
  ok(!L.purposeFail, `${tag}: purpose fail ${L.purposeFail}`);
  ok(S && S.stalls >= min, `${tag}: only ${S && S.stalls} stalls (want >= ${min})`);
  if (!S) continue;
  const gates = L.placements.filter(p => p.id === 'stable-stall-gate'), parts = L.placements.filter(p => p.id === 'stable-stall-partition' && /stall partition/.test(p.why));
  ok(gates.length === S.stalls, `${tag}: ${gates.length} gates for ${S.stalls} stalls`);
  ok(S.hayStalls === S.stalls, `${tag}: hay in ${S.hayStalls} of ${S.stalls} stalls`);
  ok(S.mangers + S.buckets >= S.stalls * 0.9, `${tag}: ${S.mangers} mangers + ${S.buckets} buckets for ${S.stalls} stalls`);
  // 10 ft deep: every stall partition is 10 ft long (no pony stalls at these sizes)
  ok(parts.length >= S.stalls + 1 && parts.every(p => Math.abs(p.dims[0] - 10) < 0.01), `${tag}: partitions not 10 ft (${[...new Set(parts.map(p => p.dims[0]))]})`);
  // 5 ft on centre: gates along each row line, neighbours 5 ft apart (a cross aisle or door makes a bigger gap)
  const axisX = S.axis === 'east-west';
  const rows = new Map();
  for (const g of gates) { const key = (axisX ? g.z : g.x).toFixed(1); if (!rows.has(key)) rows.set(key, []); rows.get(key).push(axisX ? g.x : g.z); }
  let fives = 0, bad = 0;
  for (const us of rows.values()) { us.sort((a, b) => a - b); for (let i = 1; i < us.length; i++) { const dd = us[i] - us[i - 1]; if (Math.abs(dd - 5) < 0.3) fives++; else if (dd < 4.6) bad++; } }
  ok(bad === 0 && (gates.length < 2 || fives >= 1), `${tag}: stalls not 5 ft on centre (${fives} at 5 ft, ${bad} too close)`);
  // the aisle: >= 9 ft wide, walkable from the main door to both of its ends
  ok(S.aisle >= 9 - 1e-6, `${tag}: aisle only ${S.aisle} ft`);
  for (const p of L.paths.filter(p => p.kind === 'aisle')) for (const end of [p.pts[0], p.pts.at(-1)]) ok(reachable(L, L.mainDoor.inner, end), `${tag}: aisle end ${end} not walkable from the door`);
  const sum = summarize2(L);
  ok(/Stalls: \d+ \(5×10 ft\) on (one long wall|both long walls)/.test(sum), `${tag}: summary missing the stall line`);
  if (w * d >= 64) (w === 15 ? walls.l : walls.m).add(S.walls);
  if (w === 15) big.push(S);
}
ok(walls.m.size === 2 && walls.l.size === 2, `one/both walls don't vary across seeds: 40x40 ${[...walls.m]}, 75x75 ${[...walls.l]}`);
ok(big.every(S => S.middleRows >= 1 && S.stalls >= 24), `75x75: middle rows ${big.map(S => S.middleRows)} stalls ${big.map(S => S.stalls)}`);
ok(big.some(S => S.crossAisles >= 1), '75x75: no cross aisles in the long middle rows');
console.log(`stable: ${checks} checks, ${fails} failures; 75x75 stalls ${Math.min(...big.map(S => S.stalls))}-${Math.max(...big.map(S => S.stalls))}, middle rows ${[...new Set(big.map(S => S.middleRows))]}`);
process.exit(fails ? 1 : 0);
