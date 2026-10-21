// Storeroom / cellar aisles (Harry 2026-10-01): node tools/spawn-tuner/test/stacks.test.mjs
// big rooms fill the middle with rows of shelving; aisles walkable from the door; the four per-generation choices vary;
// very long rows get extra cross aisles; the summary reports every choice.
import { readFileSync } from 'node:fs';
import { solveRoom2, summarize2 } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor } from '../js/walls.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 30) console.log('FAIL', m); } };
function solve(type, w, d, seed) {
  const r = { id: 'r1', type, x: 2, z: 2, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created: 1 };
  r.extDoor = chooseExteriorDoor(r, [r]); const E = computeEdges([r], { engine: 'v2' });
  return solveRoom2({ lib, type: T[type], room: r, openings: E.openings.get('r1'), opts: { orient }, roomTypeOf: () => type });
}
const aabb = (p) => { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)); return [c * p.dims[0] + s * p.dims[2], s * p.dims[0] + c * p.dims[2]]; };
// fraction of the room's middle third (both axes) lying within 1 ft of a floor-standing object's footprint
function middleCoverage(L) {
  const g = L.grid, x1 = g.x0 + g.nx * g.res, z1 = g.z0 + g.nz * g.res, W = x1 - g.x0, D = z1 - g.z0;
  const box = [g.x0 + W / 3, g.z0 + D / 3, g.x0 + 2 * W / 3, g.z0 + 2 * D / 3];
  const feet = L.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor').map(p => { const [aw, ad] = aabb(p); return [p.x - aw / 2 - 1, p.z - ad / 2 - 1, p.x + aw / 2 + 1, p.z + ad / 2 + 1]; });
  let n = 0, hit = 0;
  for (let x = box[0] + 0.25; x < box[2]; x += 0.5) for (let z = box[1] + 0.25; z < box[3]; z += 0.5) { n++; if (feet.some(f => x >= f[0] && x <= f[2] && z >= f[1] && z <= f[3])) hit++; }
  return hit / n;
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
const seen = { rows: new Set(), orient: new Set(), receiving: new Set(), mix: new Set() };
const covs = [];
for (const type of ['storeroom', 'cellar']) for (const [w, d] of [[8, 12], [12, 8]]) for (let seed = 1; seed <= 12; seed++) {
  const L = solve(type, w, d, seed * 6151 + 3), S = L.store, tag = `${type} ${w * 5}x${d * 5} s${seed}`;
  ok(S && S.rowsCount >= 1 && S.units >= 6, `${tag}: no stacks (${JSON.stringify(S && { rows: S.rowsCount, units: S.units })})`);
  if (!S) continue;
  const mc = middleCoverage(L); covs.push(mc);
  ok(mc >= 0.20, `${tag}: middle third only ${(mc * 100).toFixed(0)}% near shelving`);
  for (const p of L.paths.filter(p => p.kind === 'aisle')) {
    if (!p.pts.length) { ok(false, `${tag}: an aisle path found no route (${p.kind}, ok=${p.ok})`); continue; }
    for (const end of [p.pts[0], p.pts.at(-1)]) ok(reachable(L, L.mainDoor.inner, end), `${tag}: aisle end ${end} not walkable from the door`);
  }
  ok(!L.purposeFail, `${tag}: purpose fail ${L.purposeFail}`);
  const sum = summarize2(L);
  ok(/Aisles: \d+ (single|double) rows/.test(sum) && /(pointing away from the door|along the long axis)/.test(sum) && /receiving area/.test(sum) && (type !== 'cellar' || /rows: (casks & wine racks only|racks mixed with shelving)/.test(sum)), `${tag}: summary missing a choice`);
  seen.rows.add(S.rows); seen.orient.add(S.orient); seen.receiving.add(S.receiving || !!S.receivingDropped); if (S.mix) seen.mix.add(S.mix);
}
ok(seen.rows.size === 2 && seen.orient.size === 2 && seen.receiving.size === 2 && seen.mix.size === 2, `choices don't vary across seeds: ${JSON.stringify(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]])))}`);
// very long rows: extra cross aisles (a 60x100 room, rows along the 100)
let longRuns = 0, extra = 0;
for (let seed = 1; seed <= 10; seed++) { const L = solve('storeroom', 12, 20, seed * 977); const S = L.store; if (S && S.axis === 'north-south') { longRuns++; if (S.crossAisles >= 2) extra++; } }
ok(longRuns === 0 || extra === longRuns, `long rows without extra cross aisles: ${extra}/${longRuns}`);
// small rooms keep wall storage (no phantom aisles)
for (let seed = 1; seed <= 6; seed++) { const L = solve('storeroom', 3, 3, seed * 31); ok(!L.store && !L.paths.some(p => p.kind === 'aisle' && p.pts.length === 2 && L.zones.some(z => z.kind === 'stacks')), `15x15 storeroom s${seed} got stacks`); }
// fuzz: random sizes; every aisle end walkable from the door, no drawn aisle/cross-aisle crosses a blocked cell
const mrng = (() => { let a = 12345; return () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; }; })();
let fuzzRooms = 0, fuzzStacks = 0;
for (let k = 0; k < 40; k++) {
  const type = k % 2 ? 'cellar' : 'storeroom', w = 4 + Math.floor(mrng() * 11), d = 4 + Math.floor(mrng() * 11), seed = 1 + Math.floor(mrng() * 1e6);
  const L = solve(type, w, d, seed), tag = `fuzz ${type} ${w * 5}x${d * 5} s${seed}`; fuzzRooms++;
  ok(!L.purposeFail, `${tag}: purpose fail ${L.purposeFail}`);
  if (!L.store) continue; fuzzStacks++;
  const g = L.grid;
  for (const p of L.paths.filter(p => p.kind === 'aisle' || p.kind === 'cross-aisle')) {
    if (!p.pts.length) { ok(false, `${tag}: empty ${p.kind}`); continue; }
    for (const end of [p.pts[0], p.pts.at(-1)]) ok(reachable(L, L.mainDoor.inner, end), `${tag}: ${p.kind} end ${end} not walkable from the door`);
    let blocked = 0;
    for (let q = 0; q + 1 < p.pts.length; q++) { const [a, b] = [p.pts[q], p.pts[q + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t <= len; t += 0.25) { const x = a[0] + (b[0] - a[0]) * t / Math.max(len, 1e-6), z = a[1] + (b[1] - a[1]) * t / Math.max(len, 1e-6); const i = Math.floor((x - g.x0) / g.res), j = Math.floor((z - g.z0) / g.res); if (i >= 0 && j >= 0 && i < g.nx && j < g.nz && g.cells[j * g.nx + i] === 1) blocked++; } }
    ok(!blocked, `${tag}: ${p.kind} crosses ${blocked} blocked samples`);
  }
}
console.log(`stacks: ${checks} checks, ${fails} failures; middle-third coverage min ${(Math.min(...covs) * 100).toFixed(0)}% mean ${(covs.reduce((a, b) => a + b, 0) / covs.length * 100).toFixed(0)}%; long rooms with extra cross aisles ${extra}/${longRuns}; fuzz ${fuzzStacks}/${fuzzRooms} random rooms had stacks`);
process.exit(fails ? 1 : 0);
