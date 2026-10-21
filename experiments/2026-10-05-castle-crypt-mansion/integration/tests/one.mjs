// one scene from a test, in detail:   node tests/one.mjs <tuner dir> <key> <w> <d> <seed> [alone|offHall]
import { readFileSync } from 'node:fs'; import { resolve } from 'node:path';
const [dirArg, key, W, D, seedS, arr = 'alone'] = process.argv.slice(2), dir = resolve(dirArg) + '/', seed = +seedS;
const s2 = await import(dir + 'js/solver2.js'), w = await import(dir + 'js/walls.js');
const lib = JSON.parse(readFileSync(dir + 'data/library.json')), types = JSON.parse(readFileSync(dir + 'data/rooms.json')), orient = JSON.parse(readFileSync(dir + 'data/orient.json')), T = Object.fromEntries(types.map(t => [t.key, t]));
const mk = (id, type, x, z, ww, dd, s, created) => { const r = { id, type, x, z, w: ww, d: dd, seed: s, wallSeed: s * 3 + 1, created }; r.family = w.familyFor(r, T[type].family); return r; };
const hall = key === 'crypt-antechamber' ? 'crypt-catacomb' : key.startsWith('crypt') ? 'crypt-antechamber' : 'hallway';
const rooms = arr === 'offHall' ? [mk('h', hall, 10, 6, Math.max(+W, 4), 4, seed + 1, 1), mk('r', key, 10, 10, +W, +D, seed, 2)] : [mk('r', key, 10, 10, +W, +D, seed, 1)];
const made = []; for (const r of rooms) { made.push(r); r.extDoor = w.chooseExteriorDoor(r, made); }
const E = w.computeEdges(rooms, { engine: 'v2' });
const L = s2.solveRoom2({ lib, type: T[key], room: rooms.at(-1), openings: E.openings.get('r'), opts: { orient, minStars: 3, hideMasking: true }, roomTypeOf: (q) => rooms.find(x => x.id === q)?.type });
console.log(s2.summarize2(L));
for (const p of L.placements) console.log(p.id.padEnd(26), String(p.x).padStart(6), String(p.y).padStart(5), String(p.z).padStart(6), (p.rot * 180 / Math.PI).toFixed(0).padStart(5), p.dims.join('x').padEnd(16), p.rule, '|', p.why);
console.log(JSON.stringify(L.paths), JSON.stringify(L.openings));
