// one room of each given type, summary printed:   node tests/smoke.mjs <tuner dir> <key prefix> [w d] [seed]
import { readFileSync } from 'node:fs'; import { resolve } from 'node:path';
const dir = resolve(process.argv[2]) + '/', pre = process.argv[3] || 'crypt', W = +process.argv[4] || 0, D = +process.argv[5] || 0, seed = +process.argv[6] || 7;
const s2 = await import(dir + 'js/solver2.js'), w = await import(dir + 'js/walls.js');
const lib = JSON.parse(readFileSync(dir + 'data/library.json')), types = JSON.parse(readFileSync(dir + 'data/rooms.json')), orient = JSON.parse(readFileSync(dir + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
for (const t of types.filter(t => t.key.startsWith(pre) || (t.group || '').toLowerCase() === pre)) {
  const r = { id: 'a', type: t.key, x: 4, z: 4, w: W || t.cells[0], d: D || t.cells[1], seed, wallSeed: seed * 3 + 1, created: 1 }; r.family = w.familyFor(r, t.family);
  r.extDoor = w.chooseExteriorDoor(r, [r]);
  const E = w.computeEdges([r], { engine: 'v2' });
  try {
    const L = s2.solveRoom2({ lib, type: t, room: r, openings: E.openings.get('a'), opts: { orient, minStars: 3, hideMasking: true }, roomTypeOf: () => t.key });
    console.log('\n=== ' + t.key + '\n' + s2.summarize2(L));
    const c = new Map(); for (const p of L.placements) c.set(p.id, (c.get(p.id) || 0) + 1);
    console.log('Things: ' + [...c].map(([i, n]) => n > 1 ? `${i} ×${n}` : i).join(', '));
    console.log('Edges: ' + [...E.edges.values()].map(e => e.kind === 'wall' ? (e.panel ? 'P' : '.') : e.kind[0].toUpperCase() + (e.doorType ? `(${e.doorType})` : '')).join(''));
  } catch (e) { console.log('\n=== ' + t.key + ' THREW', e.stack.split('\n').slice(0, 4).join('\n')); }
}
