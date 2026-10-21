// v1 vs v2 on the same rooms, scored by the same engine-neutral audit.   node tools/spawn-tuner/test/compare.mjs
import { readFileSync } from 'node:fs';
import { solveRoom } from '../js/solver.js';
import { solveRoom2, audit } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor } from '../js/walls.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
const mk = (id, type, x, z, w, d, seed, created = 1) => ({ id, type, x, z, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created });
const CASES = [
  ['common 30x20', () => [mk('a', 'common', 2, 2, 6, 4, 0)]],
  ['common 40x25', () => [mk('a', 'common', 2, 2, 8, 5, 0)]],
  ['common 60x40', () => [mk('a', 'common', 2, 2, 12, 8, 0)]],
  ['guest 15x15', () => [mk('a', 'guest', 2, 2, 3, 3, 0)]],
  ['fine 25x25', () => [mk('a', 'fine', 2, 2, 5, 5, 0)]],
  ['privy 5x5', () => [mk('a', 'privy', 2, 2, 1, 1, 0)]],
  ['kitchen 20x15', () => [mk('a', 'kitchen', 2, 2, 4, 3, 0)]],
  ['desk + common', () => [mk('a', 'desk', 2, 2, 3, 3, 0, 2), mk('c', 'common', 5, 1, 6, 5, 99, 1)]],
  ['cellar 20x15', () => [mk('a', 'cellar', 2, 2, 4, 3, 0)]],
  ['stable 30x20', () => [mk('a', 'stable', 2, 2, 6, 4, 0)]],
];
const avg = (xs, k) => xs.reduce((a, x) => a + (typeof x[k] === 'boolean' ? +x[k] : x[k] ?? 0), 0) / xs.length;
console.log('room'.padEnd(16), 'engine', 'score', 'purpose', 'view', 'walk', 'command', 'density', 'coffin');
for (const [name, build] of CASES) {
  for (const engine of ['v1', 'v2']) {
    const rs = [];
    for (let seed = 1; seed <= 8; seed++) {
      const rooms = build(); rooms[0].seed = seed * 1009; rooms[0].wallSeed = seed * 31 + 7;
      for (const r of rooms) r.extDoor = chooseExteriorDoor(r, rooms);
      const E = computeEdges(rooms, { engine }), r = rooms[0];
      const args = { lib, type: T[r.type], room: r, openings: E.openings.get(r.id), opts: { orient }, roomTypeOf: (id) => rooms.find(x => x.id === id)?.type };
      const L = engine === 'v1' ? solveRoom(args) : solveRoom2(args);
      rs.push(audit(L, args));
    }
    console.log(name.padEnd(16), engine.padEnd(6), avg(rs, 'score').toFixed(1).padStart(5), avg(rs, 'purpose').toFixed(2).padStart(7), avg(rs, 'visible').toFixed(2).padStart(4), avg(rs, 'walkable').toFixed(2).padStart(4), avg(rs, 'command').toFixed(2).padStart(7), avg(rs, 'density').toFixed(1).padStart(7), avg(rs, 'coffin').toFixed(2).padStart(6));
  }
}
