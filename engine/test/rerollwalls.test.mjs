// A RE-ROLL KNOWS THE WALLS THE GM TOOK AWAY (bug sweep 2026-11-06; docs/KNOWN_BUGS.md, core/roomgen.js gmOpenings).
// The walls engine gives the solver a room's openings from the rooms alone, so a wall segment the GM had opened
// (an 'edge' entity, as: 'open') was still a wall to the solver: a re-roll stood furniture against the gap.
//   OPEN     over 16 seeds of three room types (common, guest, kitchen): the segments the plain layout hugs with furniture are opened; solved
//            again with the same seed, nothing stands in the doorway-deep strip inside any opened segment
//   SAME     with no edits, or with an edit on another level, the layout is exactly what it was (same hash)
//   REVERT   a door put back to plain wall ('wall') is no longer kept clear as a door: the summary no longer names it
//   node engine/test/rerollwalls.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRoomgen } from '../relay/server.js';
import { edgeId } from '../core/commands.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), TUNER = path.join(HERE, '..', '..', 'tools', 'spawn-tuner');
let checks = 0, fails = 0;
const ok = (m, c, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra).slice(0, 600)); } else if (process.env.V) console.log('ok', m); };
const rg = await loadRoomgen(path.join(TUNER, 'js'), path.join(TUNER, 'data'), { orientApi: null });

const W = 6, D = 5, CELL = 5, DEEP = 3, END = 1.25; // the room: 6 x 5 squares at the origin; the strip kept clear: 3 ft deep, less 1.25 ft at each end (the jambs, and what hugs the wall round the corner)
const segs = [];
for (let i = 0; i < W; i++) segs.push({ key: `h:${i}:0`, box: [i * CELL + END, 0, (i + 1) * CELL - END, DEEP] }, { key: `h:${i}:${D}`, box: [i * CELL + END, D * CELL - DEEP, (i + 1) * CELL - END, D * CELL] });
for (let j = 0; j < D; j++) segs.push({ key: `v:0:${j}`, box: [0, j * CELL + END, DEEP, (j + 1) * CELL - END] }, { key: `v:${W}:${j}`, box: [W * CELL - DEEP, j * CELL + END, W * CELL, (j + 1) * CELL - END] });
// a thing's footprint (its turn: a quarter turn swaps width and depth) against a strip: overlapping by more than 0.3 ft both ways
const foot = (o) => { const q = Math.abs(Math.round((o.rot || 0) / (Math.PI / 2))) % 2, [w, , d] = o.dims || [1, 1, 1], hw = (q ? d : w) / 2, hd = (q ? w : d) / 2; return [o.x - hw, o.z - hd, o.x + hw, o.z + hd]; };
// what counts: a thing standing on the floor (not flat, not hung from a beam or the ceiling) in the strip; and a thing
// placed AGAINST a wall only where that wall is the opened one (a rack against the side wall round the corner, or a
// trophy hung on it, is not standing against the gap)
const stands = (o) => !o.flat && !['ceiling', 'tile', 'wall-hang', 'attach'].includes(o.place) && (o.y || 0) < 0.5 && o.layer !== 'rug' && !/rug|carpet/.test(o.cat || '');
const sideOf = (key) => key.startsWith('h:') ? (key.endsWith(':0') ? 'n' : 's') : (key.startsWith('v:0:') ? 'w' : 'e');
const hugSide = (f) => { const d = { w: f[0], e: W * CELL - f[2], n: f[1], s: D * CELL - f[3] }; return Object.keys(d).sort((a, b) => d[a] - d[b])[0]; };
const blocks = (o, b, key) => { const f = foot(o); if (o.place === 'wall' && hugSide(f) !== sideOf(key)) return false; return Math.min(f[2], b[2]) - Math.max(f[0], b[0]) > 0.3 && Math.min(f[3], b[3]) - Math.max(f[1], b[1]) > 0.3; };
const spawn = (type, seed) => ({ id: 'room_rw', type, x: 0, z: 0, w: W, d: D, seed, building: 'bld_rw' });
const edits = (keys, as = 'open') => Object.fromEntries(keys.map(k => [edgeId(k), { id: edgeId(k), kind: 'edge', key: k, as }]));

let opened = 0, hugged = 0, still = [];
for (const type of ['common', 'guest', 'kitchen']) for (let seed = 1; seed <= 16; seed++) {
  const L0 = rg.solve({}, spawn(type, seed), 1);
  const hug = segs.filter(s => L0.objects.some(o => stands(o) && blocks(o, s.box, s.key))).slice(0, 2);
  if (!hug.length) continue;
  hugged += hug.length;
  const L1 = rg.solve(edits(hug.map(s => s.key)), spawn(type, seed), 1);
  opened += hug.length;
  for (const s of hug) for (const o of L1.objects) if (stands(o) && blocks(o, s.box, s.key)) still.push({ type, seed, key: s.key, cat: o.cat, at: [o.x, o.z], place: o.place, layer: o.layer, y: o.y, foot: foot(o).map(v => +v.toFixed(2)) });
}
ok('OPEN: the plain layouts do stand things along walls (the case exists)', hugged >= 20, hugged);
ok('OPEN: with those wall segments taken away, a layout of the same seed keeps a doorway-deep strip inside each one clear', still.length === 0, { opened, still: still.slice(0, 6), n: still.length });

const A = rg.solve({}, spawn('common', 7), 1), B = rg.solve(edits(['h:2:9@10']), spawn('common', 7), 1);
ok('SAME: an edit on another level changes nothing', A.hash === B.hash);
const C = rg.solve(edits(['h:2:0'], 'wall'), spawn('common', 7), 1);
ok('SAME: turning a plain wall into plain wall changes nothing', A.hash === C.hash);

// REVERT: the room's own outside door, put back to wall by the GM
const doorKey = (() => { for (const s of segs) { const L = rg.solve(edits([s.key], 'wall'), spawn('common', 7), 1); if (L.hash !== A.hash) return s.key; } return null; })();
ok('REVERT: putting one of its door segments back to wall changes what the solver works around', !!doorKey, doorKey);

console.log(`rerollwalls: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
