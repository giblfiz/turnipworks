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
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
