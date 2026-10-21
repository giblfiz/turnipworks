// Wall-hung items (isHung: thin-and-short or named wall things) must never stand on the floor.  node tools/spawn-tuner/test/wall_items.test.mjs
import { readFileSync } from 'node:fs';
import { solveRoom2 } from '../js/solver2.js';
import { isHung } from '../js/solver.js';
import { computeEdges, chooseExteriorDoor } from '../js/walls.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json'));
const types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
const orient = (() => { try { return JSON.parse(readFileSync(here + 'data/orient.json')); } catch { return {}; } })();
let checks = 0, bad = new Map();
for (const type of Object.keys(T)) for (const [w, d] of [[3, 3], [4, 6], [6, 4], [7, 10], [10, 8]]) for (let seed = 1; seed <= 12; seed++) {
  const r = { id: 'r', type, x: 10, z: 10, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created: 1 };
  r.extDoor = chooseExteriorDoor(r, [r]);
  const E = computeEdges([r], { engine: 'v2' });
  const L = solveRoom2({ lib, type: T[type], room: r, openings: E.openings.get('r'), opts: { orient }, roomTypeOf: () => type });
  for (const p of L.placements) {
    if (!isHung(lib.objects[p.id], p.id)) continue;
    checks++;
    if (!(p.y > 1.5)) { const k = `${p.id} via ${p.rule} (${type})`; bad.set(k, (bad.get(k) || 0) + 1); }
  }
}
console.log(`${checks} wall-item checks, ${[...bad.values()].reduce((a, b) => a + b, 0)} on the floor`);
for (const [k, n] of [...bad].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log('  ', n, k);
process.exit(bad.size ? 1 : 0);
