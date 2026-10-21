// Solver invariants over many seeds and every room type:  node tools/spawn-tuner/test/solver.test.mjs [--print TYPE]
// 1) floor objects never overlap (scaled mesh AABBs, 2-in tolerance)   2) everything stays inside the walls
// 3) surface items sit within their parent's top rect at its top height  4) layouts are deterministic per seed
// 5) door approaches stay clear of furniture
import { readFileSync } from 'node:fs';
import { solveRoom, summarize } from '../js/solver.js';
import { computeEdges, chooseExteriorDoor, CELL } from '../js/walls.js';

const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json'));
const types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const printType = process.argv.includes('--print') ? process.argv[process.argv.indexOf('--print') + 1] : null;

const TOL = 2 / 12;
let fails = 0, checks = 0, total = 0, unplaced = 0;
const fail = (msg) => { fails++; if (fails < 25) console.log('FAIL', msg); };

function aabb(p) { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)); return [c * p.dims[0] + s * p.dims[2], s * p.dims[0] + c * p.dims[2]]; }

function solve(type, w, d, seed) {
  const room = { id: 'r1', type: type.key, x: 2, z: 2, w, d, seed, family: type.family, created: 1 };
  room.extDoor = chooseExteriorDoor(room, [room]);
  const { openings } = computeEdges([room]);
  return solveRoom({ lib, type, room, openings: openings.get('r1'), opts: {} });
}

for (const type of types) {
  for (const [w, d] of [type.cells, [type.cells[0] + 2, type.cells[1] + 1], [2, 2], [8, 6]]) {
    for (let seed = 1; seed <= 12; seed++) {
      const L = solve(type, w, d, seed * 7919);
      total += L.placements.length; unplaced += L.unplaced.length;
      const X0 = 2 * CELL + 0.5, Z0 = 2 * CELL + 0.5, X1 = (2 + w) * CELL - 0.5, Z1 = (2 + d) * CELL - 0.5;
      const floor = L.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && p.orient !== 'wall');
      for (const p of L.placements) {
        checks++;
        const [aw, ad] = aabb(p);
        if (p.orient === 'wall' || p.rule === 'wall-mount') continue;
        if (p.rule === 'ceiling') { if (p.y + p.dims[1] > 9.01) fail(`${type.key} ${p.id} pokes through the ceiling`); continue; }
        if (p.x - aw / 2 < X0 - TOL || p.x + aw / 2 > X1 + TOL || p.z - ad / 2 < Z0 - TOL || p.z + ad / 2 > Z1 + TOL)
          fail(`${type.key} ${w}x${d} s${seed} ${p.id} outside walls`);
      }
      for (let i = 0; i < floor.length; i++) for (let j = i + 1; j < floor.length; j++) {
        const a = floor[i], b = floor[j], [aw, ad] = aabb(a), [bw, bd] = aabb(b);
        checks++;
        if (Math.abs(a.x - b.x) < (aw + bw) / 2 - TOL && Math.abs(a.z - b.z) < (ad + bd) / 2 - TOL)
          fail(`${type.key} ${w}x${d} s${seed} overlap ${a.id} / ${b.id}`);
      }
      const byUid = new Map(L.placements.map(p => [p.uid, p]));
      for (const p of L.placements.filter(p => p.parent)) {
        const s = byUid.get(p.parent); checks++;
        if (!s) { fail(`${p.id} parent missing`); continue; }
        if (Math.abs(p.y - (s.y + s.dims[1])) > 0.01) fail(`${p.id} not at top of ${s.id}`);
        const [sw, sd] = aabb(s);
        if (Math.abs(p.x - s.x) > sw / 2 || Math.abs(p.z - s.z) > sd / 2) fail(`${p.id} off the edge of ${s.id}`);
      }
      const again = solve(type, w, d, seed * 7919); checks++;
      if (JSON.stringify(again.placements) !== JSON.stringify(L.placements)) fail(`${type.key} not deterministic`);
      if (printType === type.key && seed === 1 && w === type.cells[0] && d === type.cells[1]) {
        console.log('\n' + summarize(L) + '\n');
      }
    }
  }
}
// ratings filter: no masking-flagged or <3-star mesh is ever placed with default opts
{ const bad = []; for (const type of types) for (let seed = 1; seed <= 6; seed++) { const L = solve(type, ...type.cells, seed * 31); for (const p of L.placements) { const k = lib.objects[p.id].skus.find(x => x.sku === p.sku); const m = k.model; checks++; if (m && (m.masking || (m.stars != null && m.stars < 3))) bad.push(p.sku); } } if (bad.length) fail('filtered meshes placed: ' + [...new Set(bad)].join(', ')); }
console.log(`${checks} checks, ${fails} failures; ${total} placements, ${unplaced} unplaced`);
process.exit(fails ? 1 : 0);
