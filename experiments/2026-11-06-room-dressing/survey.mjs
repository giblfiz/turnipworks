// survey: every room type x a few sizes x seeds through roomgen; list floor things whose y is off the floor (no parent),
// and things on a parent whose y is not the parent's top. node experiments/2026-11-06-room-dressing/survey.mjs [seeds]
import fs from 'node:fs';
import { makeRoomGen } from '../../engine/core/roomgen.js';
import * as walls from '../../tools/spawn-tuner/js/walls.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import * as solver2 from '../../tools/spawn-tuner/js/solver2.js';
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const lib = read('../../tools/spawn-tuner/data/library.json'), rooms = read('../../tools/spawn-tuner/data/rooms.json'), orient = read('../../tools/spawn-tuner/data/orient.json');
const rg = makeRoomGen({ walls, solver, solver2, lib, types: rooms, orient, version: 'probe' });
const N = +(process.argv[2] || 3), off = new Map(), par = new Map(); let n = 0;
for (const t of rooms) for (const [w, d] of [[4, 3], [6, 5], [8, 7]]) for (let s = 1; s <= N; s++) {
  let L; try { L = rg.solve({}, { id: 'r1', type: t.key, x: 0, z: 0, w, d, seed: s * 131 + w }, 1); } catch (e) { continue; }
  n++;
  const byId = new Map(L.objects.map(o => [o.id, o]));
  for (const o of L.objects) {
    if (o.flat || o.place !== 'floor' || o.orient === 'floor' || o.orient === 'wall' || /^(wall-mount|wall-light|ceiling)$/.test(o.rule || '')) continue;
    if (!o.parent) { if ((o.y || 0) > 0.05) { const k = `${o.cat} rule=${o.rule}`; const v = off.get(k) || { n: 0, y: [] }; v.n++; v.y.push(+o.y.toFixed(2)); off.set(k, v); } }
    else { const p = byId.get(o.parent); const top = p ? (p.y || 0) + p.dims[1] : null; if (top == null || Math.abs(o.y - top) > 0.05) { const k = `${o.cat} on ${p?.cat} rule=${o.rule}`; const v = par.get(k) || { n: 0, y: [] }; v.n++; v.y.push(`${o.y.toFixed(2)}/${top?.toFixed(2)}`); par.set(k, v); } }
  }
}
console.log('rooms solved', n);
console.log('--- off the floor, no parent'); for (const [k, v] of [...off].sort((a, b) => b[1].n - a[1].n)) console.log(v.n, k, v.y.slice(0, 6).join(' '));
console.log('--- on a parent, not at its top (y/top)'); for (const [k, v] of [...par].sort((a, b) => b[1].n - a[1].n).slice(0, 40)) console.log(v.n, k, v.y.slice(0, 4).join(' '));
