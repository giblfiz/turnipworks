// WHAT THE DICE HIT (engine/client/diceworld.js): the colliders a roller's throw is simulated against. The rule under
// test is SECRECY: nothing hidden from players is ever a collider, even in the GM's own (public) throw.
import { diceWorld } from '../client/diceworld.js';
let pass = 0, fail = 0;
const check = (ok, name, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${d ? ' — ' + d : ''}`); };
const room = (id, x, hidden = false) => ({ id, kind: 'room', recipe: { x, z: 0, w: 4, d: 4, type: 'common' }, ...(hidden && { hidden: true }) });
const E = {
  rA: room('rA', 0), rH: room('rH', 4, true),
  tok_seen: { id: 'tok_seen', kind: 'token', x: 7.5, z: 10 }, tok_hid: { id: 'tok_hid', kind: 'token', x: 9, z: 12, hidden: true },
  tok_inroom: { id: 'tok_inroom', kind: 'token', x: 30, z: 10, room: 'rH' },
  obj_seen: { id: 'obj_seen', kind: 'object', cat: 'barrel', x: 5, z: 5, dims: [2, 3, 2], room: 'rA' }, obj_hid: { id: 'obj_hid', kind: 'object', cat: 'barrel', x: 6, z: 6, dims: [2, 3, 2], hidden: true, room: 'rA' },
  obj_inroom: { id: 'obj_inroom', kind: 'object', cat: 'table', x: 25, z: 5, dims: [4, 3, 2], room: 'rH' },
  obj_rug: { id: 'obj_rug', kind: 'object', cat: 'rug', x: 8, z: 8, dims: [4, 0.05, 3], room: 'rA' },
};
// edges: A's west wall (A only), the A|H wall (both), H's east wall (H only: a hidden room's own wall)
const edges = new Map([
  ['v:0:0', { key: 'v:0:0', gx: 0, gz: 0, dir: 'v', kind: 'wall', sides: [{ room: 'rA' }] }],
  ['v:4:1', { key: 'v:4:1', gx: 4, gz: 1, dir: 'v', kind: 'wall', sides: [{ room: 'rA' }, { room: 'rH' }] }],
  ['v:8:2', { key: 'v:8:2', gx: 8, gz: 2, dir: 'v', kind: 'wall', sides: [{ room: 'rH' }] }],
]);
const W = diceWorld({ entities: E, edges, from: { x: 10, z: 10 }, level: 0, reach: 40 });
const ids = [...W.boxes.map(b => b.id), ...W.cylinders.map(c => c.id)].filter(Boolean);
check(ids.includes('tok_seen') && ids.includes('obj_seen'), 'a seen pawn and a seen barrel are colliders', ids.join(','));
check(!ids.includes('tok_hid') && !ids.includes('obj_hid'), 'a GM-hidden pawn and a GM-hidden barrel are not');
check(!ids.includes('tok_inroom') && !ids.includes('obj_inroom'), 'nothing inside a hidden room is a collider');
check(!ids.includes('obj_rug'), 'a rug (nothing to bounce off) is not a collider');
const walls = W.boxes.filter(b => b.wall);
check(walls.length === 2 && !walls.some(b => Math.abs(b.x - 40) < 0.01), "walls: A's own and the shared A|H wall are colliders, the hidden room's own wall is not", walls.map(b => `${b.x},${b.z}`).join(' '));
check(W.surfaces.length === 2 && !W.surfaces.some(s => s.x0 === 20), "floors: A's floor and the open ground; never the hidden room's floor", JSON.stringify(W.surfaces.map(s => [s.x0, s.x1])));
check(W.left.pawns === 2 && W.left.things === 2 && W.left.rooms === 1 && W.left.walls === 1, 'what was left out is counted', JSON.stringify(W.left));
// IRON BARS (2026-10-27): seen through (vision.js SEE_THROUGH), but a die stops at them: a section and a SHUT barred door
// are boxes a storey tall; an open one is nothing
const B = { bars: { id: 'bars', kind: 'object', cat: 'cell-bars', x: 2.5, z: 10, rot: 0, dims: [5, 9, 0.4] }, cage: { id: 'cage', kind: 'object', cat: 'door-cell-bars', x: 7.5, z: 10, rot: 0, dims: [5, 9, 0.6] },
  cageOpen: { id: 'cageOpen', kind: 'object', cat: 'door-cell-bars', x: 12.5, z: 10, rot: 0, dims: [5, 9, 0.6], open: true }, plank: { id: 'plank', kind: 'object', cat: 'door-plank', x: 17.5, z: 10, rot: 0, dims: [4.3, 9, 0.3], layer: 'openings' } };
const WB = diceWorld({ entities: B, edges: new Map(), from: { x: 10, z: 10 }, level: 0, reach: 30 });
const hb = (id) => WB.boxes.filter(b => b.id === id).map(b => b.hy * 2);
check(hb('bars').join() === '9' && hb('cage').join() === '9', 'a bars section and a shut cage door stop a die (9-ft boxes)', JSON.stringify([hb('bars'), hb('cage')]));
check(!hb('cageOpen').length, 'an open cage door does not');
check(WB.boxes.filter(b => b.wall).length === 1 && !hb('plank').length, 'a shut plank door is a wall from the sight segments, as before (not a prop box)');
// ROOF TOPS AND ROOF EDGES (2026-10-27): a pawn on a flat roof at 10 ft rolls on the roof; its battlements stop dice;
// nothing of a hidden room's roof is there; a roof taken off (open) is no floor
const RT = { k: { id: 'k', kind: 'room', recipe: { type: 'great-hall', x: 0, z: 0, w: 4, d: 4, y: 0 } }, hid: { id: 'hid', kind: 'room', hidden: true, recipe: { type: 'barracks', x: 4, z: 0, w: 2, d: 2, y: 0 } }, off: { id: 'off', kind: 'room', roof: { off: true }, recipe: { type: 'barracks', x: 0, z: 4, w: 2, d: 2, y: 0 } } };
const trim = [{ role: 'battlement', room: 'k', x: 2.5, y: 10, z: 0.67, rot: 0, dims: [5, 5, 1.33] }, { role: 'turret', room: 'k', x: 1, y: 10, z: 1, rot: 0, dims: [4.5, 11, 4.5] }, { role: 'battlement', room: 'hid', x: 22.5, y: 10, z: 0.67, rot: 0, dims: [5, 5, 1.33] }, { role: 'chimney', room: 'k', x: 10, y: 8, z: 10, dims: [2.5, 8, 2.5] }];
const WR = diceWorld({ entities: RT, edges: new Map(), from: { x: 10, z: 10 }, level: 10, reach: 30, roofTrim: trim, isOpen: (r) => !!r.roof?.off });
check(WR.surfaces.length === 1 && WR.surfaces[0].top === 'k' && WR.surfaces[0].y === 10, 'a die thrown on a flat roof (level 10) lands on its top; not on a hidden room\'s, not where the roof is off', JSON.stringify(WR.surfaces));
check(WR.boxes.filter(b => b.roof).map(b => b.roof).join() === 'battlement,turret' && Math.abs(WR.boxes[0].hy * 2 - 5) < 1e-9, "the roof's battlements and its turret stop dice (a hidden room's do not; a chimney is not an edge piece)", JSON.stringify(WR.boxes));
check(diceWorld({ entities: RT, edges: new Map(), from: { x: 10, z: 10 }, level: 0, reach: 30, roofTrim: trim }).boxes.every(b => !b.roof), 'on the ground floor the roof edges are not in the way');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
