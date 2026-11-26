// WHAT A NEW HILL DOES TO WHAT IS ALREADY THERE (2026-11-06; docs/VERTICAL.md "Hills"). node engine/test/hillground.test.mjs
// 1. a hill drawn over pawns and loose things on the ground raises them onto its top (core/height.js hillLifts; the room
//    tool sends the lifts in the same command as the hill: client/main.js spawnRoom): not left inside the earth
// 2. a room dug into a hill's side never gets its outside door on the earth side (core/roomgen.js roomsOf: the door's
//    outside square is solid earth above the room's floor -> that wall is not a door candidate; walls.js chooseExteriorDoor)
import { applyArea } from '../core/commands.js';
import { newArea } from '../core/state.js';
import { loadRoomgen } from '../relay/server.js';
import * as HT from '../core/height.js';

let n = 0, fails = 0;
const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } else if (process.env.V) console.log('ok  ', name); };
const EMPTY = { hash: 't', summary: 't', objects: [] };
const C = (g) => g * 5 + 2.5;

// ---- 1. a new hill over pawns and things ----
{
  let A = newArea('area_hground01', 'h');
  const run = (type, args) => { A = applyArea(A, type, args); };
  run('room.spawn', { id: 'room_hgdug0001', type: 'common', x: 0, z: 0, w: 3, d: 3, seed: 1, building: 'bld_hg000001', buildingName: 'Dug', layout: EMPTY });
  run('token.create', { id: 'tok_hgopen001', name: 'Bram', x: C(5), z: C(5), color: '#e8d46a' }); // on the open ground, inside the hill to be
  run('token.create', { id: 'tok_hgroom001', name: 'Ada', x: C(1), z: C(1), color: '#6ad4c8' }); // in the room the hill will be dug round
  run('token.create', { id: 'tok_hgbank001', name: 'Pip', x: C(9), z: C(5), color: '#c58be0' }); // just off its edge (on the bank to be)
  run('object.place', { id: 'obj_hgbarrel1', name: 'barrel', cat: 'barrel', place: 'floor', layer: 'furnish', x: C(6), y: 0, z: C(3), rot: 0, dims: [2, 3, 2] }); // a loose thing on the ground
  run('token.create', { id: 'tok_hgontop01', name: 'Tom', x: C(6), z: C(3), y: 3, color: '#aa5533' }); // standing on that barrel
  const hill = { id: 'room_hghill001', type: 'hill', x: 0, z: 0, w: 8, d: 8, y: 10, seed: 4 };
  const L = typeof HT.hillLifts === 'function' ? HT.hillLifts(A.entities, hill) : null;
  ok('there is a rule for what a new hill lifts (core/height.js hillLifts)', Array.isArray(L), L);
  const by = Object.fromEntries((L || []).map(l => [l.id, l]));
  ok('a pawn on the open ground where the hill goes is lifted onto its top (10 ft)', by.tok_hgopen001?.y === 10, by.tok_hgopen001);
  ok('a pawn in a room the hill is dug round is not (the room takes the hill there: it stands on its floor)', !by.tok_hgroom001, by.tok_hgroom001);
  ok('a pawn beside the hill (on its bank) is not (standing on a bank is not built: the toast tells the GM)', !by.tok_hgbank001, by.tok_hgbank001);
  ok('a loose thing on the ground goes up too, and becomes the hill\'s (it rides with it)', by.obj_hgbarrel1?.y === 10 && by.obj_hgbarrel1?.room === hill.id, by.obj_hgbarrel1);
  ok('a pawn standing on that thing keeps its footing: 3 ft up, now 13', by.tok_hgontop01?.y === 13, by.tok_hgontop01);
  // the command the room tool sends: the hill, then the lifts (client/main.js spawnRoom)
  run('room.spawn', { ...hill, layout: EMPTY });
  for (const l of L || []) run(l.kind === 'token' ? 'token.move' : 'object.move', { id: l.id, x: A.entities[l.id].x, z: A.entities[l.id].z, y: l.y, ...(l.kind === 'object' && { room: l.room }) });
  const at = (id) => { const t = A.entities[id]; return HT.baseUnder(A.entities, t.x, t.z, t.y || 0); };
  ok('after: Bram stands on the hill\'s top, not inside it', A.entities.tok_hgopen001.y === 10 && at('tok_hgopen001').room === hill.id && HT.earthAt(A.entities, C(5), C(5)) === 10, at('tok_hgopen001'));
  ok('...Ada is still on the dug-in room\'s floor at 0', (A.entities.tok_hgroom001.y || 0) === 0 && at('tok_hgroom001').room === 'room_hgdug0001', at('tok_hgroom001'));
  ok('...the barrel stands on the hill, the hill\'s', A.entities.obj_hgbarrel1.y === 10 && A.entities.obj_hgbarrel1.room === hill.id);
  // a hill drawn on a hill: a terrace 10 ft higher lifts what stands on the lower top
  const terrace = { id: 'room_hghill002', type: 'hill', x: 4, z: 4, w: 3, d: 3, y: 20, seed: 5 };
  const L2 = typeof HT.hillLifts === 'function' ? HT.hillLifts(A.entities, terrace) : [];
  ok('a terrace on the hill lifts the pawn on the lower top from 10 to 20', L2.find(l => l.id === 'tok_hgopen001')?.y === 20 && L2.length === 1, L2);
  // nothing on a map without anything under the hill
  ok('a hill over empty ground lifts nothing', typeof HT.hillLifts === 'function' && HT.hillLifts(A.entities, { id: 'room_hghill003', type: 'hill', x: 30, z: 30, w: 4, d: 4, y: 10 }).length === 0);
}

// ---- 2. a dug-in room's outside door ----
{
  const ENG = new URL('../', import.meta.url);
  const rg = await loadRoomgen(new URL('tuner', ENG).pathname, new URL('tuner-data', ENG).pathname);
  const room = (id, type, x, z, w, d, y, seed, order) => ({ id, kind: 'room', order, recipe: { type, x, z, w, d, seed, wallSeed: seed + 1, ...(y && { y }) } });
  const ents = (...es) => Object.fromEntries(es.map(e => [e.id, e]));
  // the square just outside a perimeter edge (tools/spawn-tuner/js/walls.js perimeter keys)
  const outside = (key, side) => { const [, a, b] = key.split(':').map(Number); return side === 'N' ? [a, b - 1] : side === 'S' ? [a, b] : side === 'W' ? [a - 1, b] : [a, b]; };
  const doorEarth = (E, id) => { const r = rg.roomsOf(E).find(r => r.id === id), D = r.extDoor; return { D, earth: D ? D.keys.map(k => HT.earthAt(E, C(outside(k, D.side)[0]), C(outside(k, D.side)[1]))) : [] }; };
  let total = 0, onEarth = 0, none = 0; const ex = [];
  for (const type of ['common', 'guest', 'kitchen', 'storeroom', 'chapel', 'great-hall']) for (let seed = 1; seed <= 40; seed++) for (const [rx, w] of [[6, 6], [4, 8], [8, 4]]) {
    const E = ents(room('room_hill', 'hill', 0, 0, 10, 10, 10, 3, 1), room('room_dug', type, rx, 3, w, 4, 0, seed, 2));
    const { D, earth } = doorEarth(E, 'room_dug'); total++;
    if (!D) { none++; continue; }
    if (earth.some(h => h > 0.5)) { onEarth++; if (ex.length < 3) ex.push({ type, seed, rx, w, side: D.side, earth }); }
  }
  ok(`a room dug into a hill's side never has its outside door onto the earth (${total} rooms: 6 types x 40 seeds x 3 depths)`, onEarth === 0, { onEarth, ex });
  ok('...and every one of them still has a door (it has open sides)', none === 0, none);
  { // a room wholly inside the hill (every side is earth): no door out (the way in is a stair, a cave, a neighbour)
    const E = ents(room('room_hill', 'hill', 0, 0, 10, 10, 10, 3, 1), room('room_deep', 'common', 3, 3, 4, 4, 0, 7, 2));
    ok('a room dug in on every side has no outside door (never one onto the earth)', !doorEarth(E, 'room_deep').D, doorEarth(E, 'room_deep').D);
  }
  { // a room on the open ground: its door is exactly as it was, a hill elsewhere on the map or not
    let same = 0, m = 0;
    for (const type of ['common', 'guest', 'kitchen', 'chapel']) for (let seed = 1; seed <= 20; seed++) {
      const r = room('room_flat', type, 20, 3, 6, 4, 0, seed, 2), a = doorEarth(ents(r), 'room_flat').D, b = doorEarth(ents(room('room_hill', 'hill', 0, 0, 10, 10, 10, 3, 1), r), 'room_flat').D;
      m++; if (JSON.stringify(a) === JSON.stringify(b)) same++;
    }
    ok(`a room on the open ground keeps the door it had (${m} rooms, a hill two squares off)`, same === m, { same, m });
  }
  { // a shrine ON the hill: its door is on the hilltop's side, never into a higher terrace beside it
    const E = ents(room('room_hill', 'hill', 0, 0, 12, 12, 10, 3, 1), room('room_terr', 'hill', 0, 0, 12, 4, 20, 3, 1), room('room_shr', 'chapel', 3, 4, 4, 4, 10, 5, 3));
    const { D, earth } = doorEarth(E, 'room_shr');
    ok('a shrine on the hill backed against a higher terrace: its door is not into the terrace', D && earth.every(h => h <= 10.5), { D, earth });
  }
}

console.log(`hillground: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
