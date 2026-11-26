// probe: solve one room through the engine's roomgen exactly as spawnRoom does, print the things matching a pattern
//   node experiments/2026-11-06-room-dressing/probe.mjs <type> <w> <d> <seed> [regex]
import fs from 'node:fs';
import { makeRoomGen } from '../../engine/core/roomgen.js';
import * as walls from '../../tools/spawn-tuner/js/walls.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import * as solver2 from '../../tools/spawn-tuner/js/solver2.js';
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const lib = read('../../tools/spawn-tuner/data/library.json'), rooms = read('../../tools/spawn-tuner/data/rooms.json'), orient = read('../../tools/spawn-tuner/data/orient.json');
const rg = makeRoomGen({ walls, solver, solver2, lib, types: rooms, orient, version: 'probe' });
const [type, w, d, seed, pat] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], new RegExp(process.argv[6] || '.')];
const L = rg.solve({}, { id: 'r1', type, x: 0, z: 0, w, d, seed }, 1);
const r2 = (v) => typeof v === 'number' ? +v.toFixed(3) : v;
for (const o of L.objects) if (pat.test(o.cat)) console.log(JSON.stringify({ id: o.id, cat: o.cat, sku: o.sku, x: r2(o.x), y: r2(o.y), z: r2(o.z), rot: r2(o.rot), yaw: r2(o.yaw), s: o.s, dims: o.dims?.map(r2), parent: o.parent, rule: o.rule, orient: o.orient, place: o.place }));
