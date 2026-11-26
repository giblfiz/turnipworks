// What stands on a thing goes with it (Harry 2026-11-02), in core, so the relay and every seat agree (an AI seat's object.delete
// goes straight here). browser_marqueefold.py has the real input.
import { applyArea, inverseOf, goesWith, restingOn, checkCommand, ridersOf, carrierOfPawn, pawnRestsOn, parseArgs } from '../core/commands.js';
import { newArea } from '../core/state.js';
let bad = 0, n = 0; const ok = (c, name) => { n++; if (!c) { bad++; console.log('FAIL', name); } };
const obj = (id, parent, extra = {}) => ({ id, name: id, cat: 'crate', x: 10, z: 10, dims: [1, 1, 1], ...(parent && { parent }), ...extra });
let A = newArea('t', 'T');
for (const [id, p, x] of [['obj_desk0000001'], ['obj_tray0000001', 'obj_desk0000001'], ['obj_cup00000001', 'obj_tray0000001'], ['obj_lock0000001', 'obj_desk0000001', { locked: true }], ['obj_onlk0000001', 'obj_lock0000001'], ['obj_near0000001']]) A = applyArea(A, 'object.place', obj(id, p, x));
A = { ...A, entities: { ...A.entities, obj_lock0000001: { ...A.entities.obj_lock0000001, locked: true } } };
ok(restingOn(A.entities, 'obj_desk0000001').length === 2, 'restingOn: the two on the desk');
const w = goesWith(A.entities, 'obj_desk0000001');
ok(w.gone.sort().join() === 'obj_cup00000001,obj_tray0000001' && w.kept.map(e => e.id).join() === 'obj_lock0000001', 'goesWith: what goes, and the locked thing stays (and what stands on it)');
const D = applyArea(A, 'object.delete', { id: 'obj_desk0000001' }), inv = inverseOf(A, 'object.delete', { id: 'obj_desk0000001' });
ok(!D.entities.obj_desk0000001 && !D.entities.obj_tray0000001 && !D.entities.obj_cup00000001, 'delete takes the desk and all that stands on it, however deep');
ok(D.entities.obj_lock0000001 && !D.entities.obj_lock0000001.parent, 'a locked thing stays, standing on nothing');
ok(D.entities.obj_onlk0000001?.parent === 'obj_lock0000001', 'what stands on a locked thing stays on it');
ok(D.entities.obj_near0000001, 'a thing beside the desk is left alone');
const B = applyArea(D, inv.type, inv.args);
ok(JSON.stringify(Object.keys(B.entities).sort()) === JSON.stringify(Object.keys(A.entities).sort()) && Object.keys(A.entities).every(k => JSON.stringify(B.entities[k]) === JSON.stringify(A.entities[k])), 'one undo restores everything exactly');
const C = applyArea(A, 'batch', { ops: [{ type: 'object.delete', args: { id: 'obj_desk0000001' } }, { type: 'object.delete', args: { id: 'obj_near0000001' } }] }), iv2 = inverseOf(A, 'batch', { ops: [{ type: 'object.delete', args: { id: 'obj_desk0000001' } }, { type: 'object.delete', args: { id: 'obj_near0000001' } }] });
ok(!C.entities.obj_cup00000001 && !C.entities.obj_near0000001 && Object.keys(A.entities).every(k => JSON.stringify(applyArea(C, iv2.type, iv2.args).entities[k]) === JSON.stringify(A.entities[k])), 'in a batch too, one undo');

// ---- PAWNS RIDE TOO (Harry 2026-11-07: "If I stand a pawn on a table, and then I move the table, it should move the pawn
// with it"): object.move `carry`, core/riders.js. Every check here fails on the code before (no carry, no ridersOf).
{
  const near = (a, b) => Math.abs(a - b) < 0.011;
  let T = newArea('r', 'R');
  const place = (id, x, z, extra = {}) => { T = applyArea(T, 'object.place', { id, name: id, cat: 'table', x, z, dims: [6, 3, 4], ...extra }); };
  place('obj_table000001', 10, 10);
  place('obj_tray0000001', 11, 10, { dims: [2, 0.2, 2], y: 3, parent: 'obj_table000001' });
  place('obj_mug00000001', 11.5, 10, { dims: [0.4, 0.5, 0.4], y: 3.2, parent: 'obj_tray0000001' });
  place('obj_shelf000001', 30, 0, { place: 'wall', dims: [3, 1, 1], y: 4 });
  place('obj_lockd000001', 9, 11, { dims: [0.5, 0.5, 0.5], y: 3, parent: 'obj_table000001' });
  T = { ...T, entities: { ...T.entities, obj_lockd000001: { ...T.entities.obj_lockd000001, locked: true } } };
  const pawn = (id, x, z, y, extra = {}) => { T = applyArea(T, 'token.create', { id, name: id, x, z, y, owner: 'seat_other0001', ...extra }); };
  pawn('tok_onit0000001', 8.5, 9, 3);              // on the table's top
  pawn('tok_ontray00001', 10.6, 10.4, 3.2);        // on the tray on the table
  pawn('tok_floor000001', 14, 10, 0);              // beside it on the floor (inside the box in plan, but on the floor)
  pawn('tok_flies000001', 9, 10, 9);               // flying over it
  pawn('tok_away0000001', 40, 40, 3);              // at a table's height, far away
  pawn('tok_hid00000001', 12, 11, 3, { hidden: true }); // hidden from players, on the table
  const E = T.entities;
  ok(pawnRestsOn(E.tok_onit0000001, E.obj_table000001) && !pawnRestsOn(E.tok_floor000001, E.obj_table000001) && !pawnRestsOn(E.tok_flies000001, E.obj_table000001) && !pawnRestsOn(E.tok_away0000001, E.obj_table000001), 'a pawn rests on a table when its feet are at the top over its box; not on the floor under it, flying over it or far off');
  ok(carrierOfPawn(E, E.tok_ontray00001)?.id === 'obj_tray0000001', 'a pawn on a tray on a table stands on the tray (the top nearest its feet)');
  const R = ridersOf(E, 'obj_table000001');
  ok(['obj_tray0000001', 'obj_mug00000001', 'tok_onit0000001', 'tok_ontray00001', 'tok_hid00000001'].every(id => R.includes(id)) && R.length === 5, 'riders of the table: the tray, the mug on it, the pawns on it and on the tray, the hidden pawn; not the locked thing, the floor, the flyer, the far one', R);
  ok(ridersOf(E, 'obj_shelf000001').length === 0, 'a thing on a wall carries no pawns');
  // the move: 10 ft east, up 5 ft (a lift car), a quarter turn
  const args = { id: 'obj_table000001', x: 20, z: 10, y: 5, rot: Math.PI / 2, carry: R };
  ok(checkCommand({ state: { seats: { s: { id: 's', role: 'gm', kind: 'human' } }, areas: { r: T } }, by: 's' }, { type: 'object.move', area: 'r', args }) === null, 'the relay\'s check passes the move with its riders');
  const M = applyArea(T, 'object.move', args), m = M.entities;
  // rigid: the offset from the table's middle turned by a quarter turn (x' = dx cos + dz sin, z' = -dx sin + dz cos: (dx, dz) -> (dz, -dx))
  const at = (id, dx, dz) => near(m[id].x, 20 + dz) && near(m[id].z, 10 - dx);
  ok(at('tok_onit0000001', -1.5, -1) && near(m.tok_onit0000001.y, 8), 'the pawn on the table rides: same place on the table, turned with it, raised with it', m.tok_onit0000001);
  ok(near(m.tok_onit0000001.rot, Math.PI / 2), 'and it turns too (its facing)');
  ok(at('obj_tray0000001', 1, 0) && near(m.obj_tray0000001.y, 8) && near(m.obj_tray0000001.rot, Math.PI / 2) && at('obj_mug00000001', 1.5, 0) && near(m.obj_mug00000001.y, 8.2) && at('tok_ontray00001', 0.6, 0.4) && near(m.tok_ontray00001.y, 8.2), 'recursion: the tray, the mug on the tray and the pawn on the tray ride the table');
  ok(m.tok_floor000001.x === 14 && m.tok_flies000001.x === 9 && m.tok_away0000001.x === 40 && m.obj_lockd000001.x === 9, 'the floor pawn, the flyer, the far pawn and the locked thing stay');
  ok(at('tok_hid00000001', 2, 1) && m.tok_hid00000001.hidden, 'the hidden pawn rides, still hidden');
  const inv = inverseOf(T, 'object.move', args), U = applyArea(M, inv.type, inv.args);
  ok(Object.keys(T.entities).every(k => JSON.stringify(U.entities[k]) === JSON.stringify(T.entities[k])), 'ONE undo puts the table and every rider back exactly');
  const plain = applyArea(T, 'object.move', { id: 'obj_table000001', x: 20, z: 10 });
  ok(plain.entities.tok_onit0000001.x === 8.5 && plain.entities.obj_tray0000001.x === 11, 'an object.move without carry (an old journal line) moves the thing alone, as it always did');
  const chk = (carry) => checkCommand({ state: { seats: { s: { id: 's', role: 'gm', kind: 'human' } }, areas: { r: T } }, by: 's' }, { type: 'object.move', area: 'r', args: { id: 'obj_table000001', x: 20, z: 10, carry } });
  ok(/not standing on/.test(chk(['tok_away0000001'])?.why || ''), 'a carry cannot take a pawn from across the room');
  ok(/not standing on/.test(chk(['obj_lockd000001'])?.why || ''), 'a carry cannot take a locked thing');
  ok(chk(['tok_ontray00001']) === null, 'a pawn on the tray may be named on the table\'s move (it is on what rides)');
  ok(parseArgs('object.move', { id: 'obj_table000001', x: '1', z: '2', carry: 'tok_onit0000001,obj_tray0000001' }, { fromQuery: true }).args?.carry?.length === 2, 'carry from a query: ids, comma-separated');
  // THE PERMISSION RULE (Harry 2026-11-07): the mover's permission to move the CARRIER is what counts. An AI seat of the GM
  // holding only 'object' (it may not move pawns) moving the table carries another player's pawn; the same seat moving that
  // pawn on its own is refused.
  const seats = { gm: { id: 'gm', role: 'gm', kind: 'human' }, pl: { id: 'seat_other0001', role: 'player', kind: 'human' }, ai: { id: 'ai', kind: 'llm', creator: 'gm', scope: { areas: '*', classes: ['object'] } } };
  const st = { seats, areas: { r: T } };
  ok(checkCommand({ state: st, by: 'ai' }, { type: 'object.move', area: 'r', args }) === null, 'permission: a seat that may move the table carries the pawns on it, whoever owns them');
  ok(checkCommand({ state: st, by: 'ai' }, { type: 'token.move', area: 'r', args: { id: 'tok_onit0000001', x: 1, z: 1 } })?.code === 'forbidden', 'permission: the same seat may not move that pawn by itself');
  ok(checkCommand({ state: st, by: 'seat_other0001' }, { type: 'object.move', area: 'r', args })?.code === 'forbidden', 'permission: a player (who may not move the table) cannot carry anything');
  // INTO A HIDDEN ROOM: a carried pawn hides there as a walked one does (not a player's pawn: HIDE_ROOM_HIDES_PLAYER_PAWNS)
  let H = applyArea(T, 'room.spawn', { id: 'room_secret0001', type: 'storeroom', x: 3, z: 0, w: 4, d: 4, seed: 1 });
  H = applyArea(H, 'entity.flag', { ids: ['room_secret0001'], hidden: true, _roomPlayerOwners: [] });
  const HM = applyArea(H, 'object.move', { id: 'obj_table000001', x: 25, z: 10, carry: ['tok_onit0000001'], _roomPlayerOwners: [] });
  ok(HM.entities.tok_onit0000001.hidden && HM.entities.tok_onit0000001.hiddenByRoom === 'room_secret0001', 'a pawn carried into a hidden room hides with it, as a walked one does (so the player side is told nothing of where it went)');
  const HP = applyArea(H, 'object.move', { id: 'obj_table000001', x: 25, z: 10, carry: ['tok_onit0000001'], _roomPlayerOwners: ['seat_other0001'] });
  ok(!HP.entities.tok_onit0000001.hidden, 'a PLAYER\'s pawn carried into a hidden room stays shown (HIDE_ROOM_HIDES_PLAYER_PAWNS, as for a walk)');
}
console.log(`riders: ${n - bad}/${n} checks passed`); process.exit(bad ? 1 : 0);
