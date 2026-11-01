// HOLES, PITS AND FALLS in the data (2026-10-22; core/holes.js, core/height.js baseUnder, core/stairs.js holesAt, the batch's undo)
//   node engine/test/holes.test.mjs
import { applyArea, inverseOf } from '../core/commands.js';
import { newArea } from '../core/state.js';
import * as HO from '../core/holes.js';
import * as HT from '../core/height.js';
import * as ST from '../core/stairs.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, d); } };
const keys = (set) => [...set].sort().join(' ');
const room = (id, x, z, w, d, y = 0) => ({ id, type: 'guest', x, z, w, d, y, seed: 1, building: 'bld_holes0001', buildingName: 'Inn', layout: { hash: 'h', summary: {}, objects: [] } });

let A = newArea('area_holes001', 'holes');
A = applyArea(A, 'room.spawn', room('room_ground001', 0, 0, 4, 4));
A = applyArea(A, 'room.spawn', room('room_upper0001', 0, 0, 4, 4, 10));
const E0 = A.entities;
ok(HT.baseUnder(E0, 7.5, 7.5, 10).y === 10, 'upstairs with no hole: the base is on the upper floor');

// ---- a square hole: one square, painted like a tile ----
A = applyArea(A, 'object.place', { id: 'obj_hole00001', cat: 'hole', name: 'hole', place: 'tile', layer: 'floor', flat: true, x: 7.5, y: 10, z: 7.5, dims: [5, 0.05, 5] });
let E = A.entities, h = E.obj_hole00001;
ok(HO.isHole(h) && HO.holeShape(h) === 'square' && JSON.stringify(HO.holeCells(h)) === '[[1,1]]', 'a square hole cuts its own square', JSON.stringify(HO.holeCells(h)));
ok(keys(ST.holesAt(E, 10)) === '1:1' && ST.holesAt(E, 0).size === 0, 'the floor at 10 ft is open on that square (stairs.holesAt), the ground floor is not', keys(ST.holesAt(E, 10)));
ok(HT.baseUnder(E, 7.5, 7.5, 10).y === 0 && HT.baseUnder(E, 7.5, 7.5, 10).room === 'room_ground001', 'over the hole a pawn upstairs has its base on the floor below (0 ft)', JSON.stringify(HT.baseUnder(E, 7.5, 7.5, 10)));
ok(HT.baseUnder(E, 12.5, 7.5, 10).y === 10, 'beside it the upper floor still holds');
ok(HT.baseUnder(E, 7.5, 7.5, 20).y === 20, 'a flyer at 20 ft over the hole is over the upper room\'s top (its roof): its base is there, not down the hole', JSON.stringify(HT.baseUnder(E, 7.5, 7.5, 20)));
ok(HT.baseUnder(E, 7.5, 7.5, 15).y === 0, 'a flyer 5 ft up inside the upper room, over the hole: its base is on the floor below', JSON.stringify(HT.baseUnder(E, 7.5, 7.5, 15)));

// ---- a round hole, 10 ft across, on a grid crossing ----
A = applyArea(A, 'object.delete', { id: 'obj_hole00001' });
ok(HO.roundCentre(11, 9, 10).join() === '10,10' && HO.roundCentre(11, 9, 15).join() === '12.5,7.5' && HO.roundCentre(3, 3, 5).join() === '2.5,2.5', 'a round hole centres on a crossing (10, 20 ft) or a square\'s centre (5, 15 ft)');
A = applyArea(A, 'object.place', { id: 'obj_round0001', cat: 'hole-round', name: 'round hole 10 ft', place: 'floor', layer: 'floor', flat: true, x: 10, y: 10, z: 10, dims: [10, 0.05, 10] });
E = A.entities; h = E.obj_round0001;
ok(HO.holeSize(h) === 10 && keys(ST.holesAt(E, 10)) === '1:1 1:2 2:1 2:2', 'a 10-ft round hole cuts the four squares round its crossing', keys(ST.holesAt(E, 10)));
ok(HT.baseUnder(E, 10, 10, 10).y === 0 && HT.baseUnder(E, 13, 13, 10).y === 0, 'inside the circle the base is on the floor below');
ok(HT.baseUnder(E, 5.6, 5.6, 10).y === 10, 'in a corner of its squares, outside the circle, the upper floor holds (the floor is put back round it)', JSON.stringify(HT.baseUnder(E, 5.6, 5.6, 10)));
const R = HO.roundHolesAt(E, 10);
ok(R.length === 1 && R[0].r === 5 && R[0].cells.length === 4, 'the round holes of a floor, for drawing', JSON.stringify(R));
for (const [d, n] of [[5, 1], [15, 9], [20, 16]]) {
  const e = { kind: 'object', cat: 'hole-round', x: d % 10 ? 12.5 : 10, z: d % 10 ? 12.5 : 10, y: 10, dims: [d, 0.05, d] };
  ok(HO.holeCells(e).length === n, `a ${d}-ft round hole cuts ${n} square${n > 1 ? 's' : ''}`, HO.holeCells(e).length);
}
// a resize (object.set dims) is a new size
A = applyArea(A, 'object.set', { id: 'obj_round0001', dims: [20, 0.05, 20] });
ok(HO.holeSize(A.entities.obj_round0001) === 20 && ST.holesAt(A.entities, 10).size === 16, 'resized to 20 ft (object.set dims): it cuts the 16 squares round its crossing', ST.holesAt(A.entities, 10).size);

// ---- a hole in the ground over a cellar, and on bare ground over nothing ----
let B = newArea('area_holes002', 'cellar');
B = applyArea(B, 'room.spawn', { ...room('room_cellar001', 0, 0, 3, 3, -10), type: 'cellar' });
B = applyArea(B, 'object.place', { id: 'obj_hole00002', cat: 'hole', place: 'tile', flat: true, x: 7.5, y: 0, z: 7.5, dims: [5, 0.05, 5] });
ok(HT.baseUnder(B.entities, 7.5, 7.5, 0).y === -10, 'a hole in the ground over a cellar: the base is on the cellar floor', JSON.stringify(HT.baseUnder(B.entities, 7.5, 7.5, 0)));
B = applyArea(B, 'object.place', { id: 'obj_hole00003', cat: 'hole', place: 'tile', flat: true, x: 42.5, y: 0, z: 42.5, dims: [5, 0.05, 5] });
ok(HT.baseUnder(B.entities, 42.5, 42.5, 0).y === 0, 'a hole in bare ground over nothing: nothing to fall to (the base stays on the ground)');

// ---- PITS: the library's pit pieces (core/holes.js PIT_CATS) ----
let C = newArea('area_holes003', 'pits');
C = applyArea(C, 'room.spawn', room('room_pground01', 0, 0, 4, 4));
C = applyArea(C, 'room.spawn', room('room_pupper001', 0, 0, 4, 4, 10));
C = applyArea(C, 'object.place', { id: 'obj_shaft0001', cat: 'mine-shaft-collar', x: 7.5, y: 10, z: 7.5, dims: [5.75, 3.09, 5.83] });
C = applyArea(C, 'object.place', { id: 'obj_spikes001', cat: 'trap-spike-pit', x: 17.5, y: 10, z: 7.5, dims: [4.83, 1.2, 4.83] });
let P = C.entities;
ok(HO.isOpening(P.obj_shaft0001) && !HO.isOpening(P.obj_spikes001) && HO.isPit(P.obj_spikes001), 'the mine shaft is a through opening; the spike pit is a pit with its own bottom (not an opening)');
ok(keys(ST.holesAt(P, 10)) === '1:1', 'the shaft cuts the square under its opening (3.8 ft square, on a square\'s centre)', keys(ST.holesAt(P, 10)));
ok(HT.baseUnder(P, 7.5, 7.5, 10).y === 0 && HT.baseUnder(P, 17.5, 7.5, 10).y === 10, 'over the shaft the base is on the floor below; over the spike pit it is the pit\'s own floor');
ok(HO.pitAt(P, 17.5, 7.5, 10)?.id === 'obj_spikes001' && !HO.pitAt(P, 17.5, 1, 10) && !HO.pitAt(P, 17.5, 7.5, 0), 'a pawn standing at 10 ft inside the spike pit\'s opening is ON it; at its kerb or on another floor it is not');
let D = newArea('area_holes004', 'shaft on bare ground');
D = applyArea(D, 'object.place', { id: 'obj_shaft0002', cat: 'mine-shaft-collar', x: 2.5, y: 0, z: 2.5, dims: [5.75, 3.09, 5.83] });
ok(HT.baseUnder(D.entities, 2.5, 2.5, 0).y === 0 && HO.pitAt(D.entities, 2.5, 2.5, 0)?.id === 'obj_shaft0002', 'a shaft on bare ground over nothing: no floor below, so a pawn on it is ON the pit (it falls in, as into a pit with a bottom)');

// ---- STACKED HOLES (2026-10-27, Harry: "a stack of two holes on top of each other ... should probably just be 'drop 20 ft'") ----
// three storeys, 0 / 10 / 20 ft; openings in the 20 and 10-ft floors: the base is on the first WHOLE floor under them all
let K = newArea('area_holes004', 'stack');
for (const [id, y] of [['room_stk00000', 0], ['room_stk00010', 10], ['room_stk00020', 20]]) K = applyArea(K, 'room.spawn', room(id, 0, 0, 4, 4, y));
const place = (id, cat, x, y, z, d) => { K = applyArea(K, 'object.place', { id, cat, place: cat === 'hole' ? 'tile' : 'floor', flat: true, x, y, z, dims: [d, 0.05, d] }); };
place('obj_stksq0020', 'hole', 2.5, 20, 2.5, 5); place('obj_stksq0010', 'hole', 2.5, 10, 2.5, 5);           // square over square
place('obj_stkrd0020', 'hole-round', 10, 20, 15, 10); place('obj_stkrd0010', 'hole-round', 10, 10, 15, 10); // round over round
place('obj_stkpt0020', 'hole-round', 15, 20, 5, 10); place('obj_stkpt0010', 'hole', 17.5, 10, 2.5, 5);      // round over one square of it
const KE = K.entities, bu = (x, z, y = 20) => HT.baseUnder(KE, x, z, y).y;
ok(bu(2.5, 2.5) === 0, 'a square hole over a square hole: from the 20-ft floor the base is on the ground floor (20 ft down), not on the 10-ft floor', bu(2.5, 2.5));
ok(bu(10, 15) === 0 && bu(12.5, 17.5) === 0, 'a round hole over a round hole: the base goes down both, to the ground floor', `${bu(10, 15)} ${bu(12.5, 17.5)}`);
ok(bu(17.5, 2.5) === 0 && bu(12.5, 2.5) === 10 && bu(17.5, 7.5) === 10, 'partial overlap: down both only where the lower hole is under the upper one; elsewhere in the upper hole, the 10-ft floor', `${bu(17.5, 2.5)} ${bu(12.5, 2.5)} ${bu(17.5, 7.5)}`);
ok(bu(2.5, 12.5) === 20, 'beside the holes the 20-ft floor holds');
ok(bu(2.5, 2.5, 25) === 0, 'a flyer 5 ft up in the top room over the stack: its base is at the bottom of it', bu(2.5, 2.5, 25));
// and down into a cellar: holes at 10 and 0 over a cellar at -10
place('obj_stkcl0000', 'hole', 2.5, 0, 2.5, 5); K = applyArea(K, 'room.spawn', { ...room('room_stkcellar', 0, 0, 2, 2, -10), type: 'cellar' });
ok(HT.baseUnder(K.entities, 2.5, 2.5, 20).y === -10, 'three holes one over the other over a cellar: from 20 ft the base is on the cellar floor, 30 ft down', HT.baseUnder(K.entities, 2.5, 2.5, 20).y);

// ---- the batch's undo takes its chat line away too (a fall: the move and "Mira falls 10 ft", one step) ----
A = applyArea(A, 'token.create', { id: 'tok_mira00001', name: 'Mira', x: 30, z: 30, y: 10 });
const batch = { ops: [{ type: 'token.move', args: { id: 'tok_mira00001', x: 30, z: 30, y: 0 } }, { type: 'chat.say', args: { id: 'msg_fall00001', text: 'Mira falls 10 ft' } }] };
const inv = inverseOf(A, 'batch', batch);
const A2 = applyArea(A, 'batch', batch, { by: 'seat_gm' });
ok((A2.entities.tok_mira00001.y || 0) === 0 && A2.chat.some(c => c.text === 'Mira falls 10 ft'), 'the fall: the pawn on the ground and the line in the chat');
const A3 = applyArea(A2, inv.type, inv.args);
ok(A3.entities.tok_mira00001.y === 10 && !(A3.chat || []).some(c => c.id === 'msg_fall00001'), 'its undo: the pawn back up AND the line gone', JSON.stringify(inv).slice(0, 200));
const redo = inverseOf(A2, inv.type, inv.args), A4 = applyArea(A3, redo.type, redo.args);
ok((A4.entities.tok_mira00001.y || 0) === 0 && A4.chat.some(c => c.id === 'msg_fall00001'), 'and the redo puts both back');
const plain = inverseOf(A, 'batch', { ops: [{ type: 'token.move', args: { id: 'tok_mira00001', x: 31, z: 30 } }] });
ok(plain.type === 'entities.set', 'a batch with no chat line inverts exactly as before (entities.set)');

console.log(`holes: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
