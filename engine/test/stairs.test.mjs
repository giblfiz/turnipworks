// STAIRS ARE ORDINARY PLACED OBJECTS THAT GO UP OR DOWN (2026-10-11; Harry: "start in on the fixes to stairs & ladders
// as a placeable object with a context menu that lets you switch them to 'stairs down' instead of 'stairs up'").
//   node engine/test/stairs.test.mjs
// 1. put down from the library: opens the floor above, railed, a pawn crosses; move / turn / delete / duplicate / undo
// 2. stairs up <-> stairs down: same place in plan, one flight lower, the hole in THIS floor; no level above / below
// 3. a stair that cannot work says why (every code)
// 4. every stair piece of the library switches down and back
// 5. placed against furniture stairs: hidden with either room, kept through a re-roll, deleted with the room it was put in for
// 6. the offer for a room drawn by hand: only a plausible alignment; the stair core for the building generator
// 7. old `place: 'stair'` objects become ordinary stairs: units, and every stair in the corpus of saved campaigns
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyArea, inverseOf, REGISTRY } from '../core/commands.js';
import { newArea, areaForClient } from '../core/state.js';
import { loadRoomgen } from '../relay/server.js';
import { CampaignRuntime } from '../relay/campaign.js';
import { makeTokens } from '../relay/tokens.js';
import { migrateStairs } from '../core/migrate.js';
import { corpusDir } from './corpus.mjs';
import * as S from '../core/stairs.js';
import * as FP from '../core/footprint.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, d); } else if (process.env.V) console.log('ok', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const rg = await loadRoomgen(new URL('../tuner', import.meta.url).pathname, new URL('../tuner-data', import.meta.url).pathname);
const EMPTY = { hash: 't', summary: 't', objects: [] };
const B = 'bld_st00000001';
const room = (A, id, x, z, w, d, y = 0, type = 'common', extra = {}) => applyArea(A, 'room.spawn', { id, type, x, z, w, d, ...(y && { y }), seed: 1, building: B, buildingName: 'Inn', layout: EMPTY, ...extra });
const piece = (cat, sku) => { const Z = rg.sizeOf(cat, sku); return { name: cat, cat, sku: Z.sku, url: Z.url, place: Z.place, layer: 'furnish', yaw: Z.yaw, s: Z.s, dims: Z.dims }; };
const FLIGHT = piece('stair-straight', 'stair-straight--rough-timber--t10');
const holes = (A, y) => [...S.holesAt(A.entities, y)].sort();
const cellKeys = (s) => S.stairCells(s).map(c => c.join(':')).sort();
const rails = (A) => S.railsOf(A.entities).map(r => r.key).sort();
const code = (A, id) => S.stairStatus(A.entities, A.entities[id]).code;
const LOW = 'room_stlow0001', UP = 'room_stup00001', CEL = 'room_stcel0001', TOP = 'room_sttop0001';

// ---- 1. from the library, on the ground floor of a two-storey house ----
{
  let A = newArea('area_stairs001', 's'); A = room(A, LOW, 0, 0, 6, 4); A = room(A, UP, 0, 0, 6, 4, 10, 'guest');
  // a flight in the middle of the room, climbing toward +x (its front, local +z, is its foot: turned to face -x)
  const st = { id: 'obj_st00000001', ...FLIGHT, x: 15, y: 0, z: 12.5, rot: -Math.PI / 2, room: LOW };
  eq(REGISTRY['object.place'].check({ area: A }, st), null, 'a stair from the library is an ordinary object.place');
  const before = A; A = applyArea(A, 'object.place', st);
  const s = A.entities[st.id];
  ok(s.place === 'kit' && S.isPlacedStair(s) && !S.isStair(s) && !s.down && !('rise' in s), 'it is stored as the catalog piece it is: no hole, no rise, no direction on it (up is the default)');
  eq([cellKeys(s), holes(A, 10), holes(A, 0)], [['2:2', '3:2'], ['2:2', '3:2'], []], 'by default it goes UP: the floor above is open on exactly its squares, its own floor is whole');
  eq([S.stairHome(s), S.stairSide(s), S.stairSide(s, 0), S.stairSide(s, 10)], [0, 'up', 'up', 'down'], 'its home is the level it was put on; from the floor above the same stair reads as stairs down');
  ok(rails(A).length >= 4 && rails(A).every(k => /@10$/.test(k)), 'the hole is railed, on the floor above', rails(A).join(' '));
  eq(code(A, st.id), null, 'and it works');
  const E = S.stairEnds(s, A.entities);
  eq([S.stairHop(A.entities, 15, 12.5, 0)?.y, S.stairHop(A.entities, 15, 12.5, 10)?.y, E.foot.x, E.top.x], [10, 0, 7.5, 22.5], 'a pawn dropped on it goes up; dropped on the hole it comes down; foot and top are the squares before and beyond it');
  // move, turn, delete, undo: the hole and the railing are worked out, so they follow
  const M = applyArea(A, 'object.move', { id: st.id, x: 20, z: 7.5 });
  eq([holes(M, 10), rails(M).every(k => /@10$/.test(k)), rails(M).join() !== rails(A).join()], [['3:1', '4:1'], true, true], 'moved: the hole and its railing are where the stair is now, and nowhere else');
  const T = applyArea(A, 'object.move', { id: st.id, x: 12.5, z: 10, rot: 0 });
  eq([holes(T, 10), S.stairDir(T.entities[st.id])], [['2:1', '2:2'], [0, -1]], 'turned a quarter: the hole turns with it (it climbs away from its front)');
  const D = applyArea(A, 'object.delete', { id: st.id });
  eq([holes(D, 10), rails(D)], [[], []], 'deleted: the floor above is whole again and the railing is gone (no orphan hole)');
  const inv = inverseOf(A, 'object.delete', { id: st.id }), back = applyArea(D, inv.type, inv.args);
  eq([holes(back, 10), rails(back)], [holes(A, 10), rails(A)], 'undo: the stair, its hole and its railing are back');
  { const i2 = inverseOf(before, 'object.place', st), u = applyArea(A, i2.type, i2.args); eq([holes(u, 10), rails(u)], [[], []], 'undoing the placing closes the hole'); }
  // a duplicate is its own stair with its own hole
  const dup = applyArea(A, 'object.place', { ...st, id: 'obj_st00000002', z: 2.5 });
  eq(holes(dup, 10), ['2:0', '2:2', '3:0', '3:2'], 'a duplicate beside it opens its own squares');

  // ---- 2. STAIRS DOWN ----
  const F = S.stairFlip(s, 0);
  eq(F, { y: -10, down: true }, 'switching to stairs down from its level: the same piece, one flight lower');
  { const chair = applyArea(A, 'object.place', { id: 'obj_chair00001', x: 1, z: 1, cat: 'chair' });
    ok(/exactly its own rise/.test(REGISTRY['stair.flip'].check({ area: A }, { id: st.id, y: -5, down: true }) || '') && /not a stair/.test(REGISTRY['stair.flip'].check({ area: chair }, { id: 'obj_chair00001', y: -10, down: true }) || ''), 'the command refuses anything but one flight, and anything but a stair'); }
  const Dn = applyArea(A, 'stair.flip', { id: st.id, ...F }), d = Dn.entities[st.id];
  eq([d.x, d.z, d.rot, d.y, d.down, cellKeys(d)], [s.x, s.z, s.rot, -10, true, cellKeys(s)], 'it keeps its place in plan and its turn; its body stands one storey lower');
  eq([holes(Dn, 0), holes(Dn, 10), rails(Dn).every(k => !/@/.test(k)), rails(Dn).length > 0], [['2:2', '3:2'], [], true, true], 'the hole is now in THIS floor, railed here; the floor above is whole');
  eq([S.stairHome(d), S.stairSide(d), S.stairSide(d, 0), S.stairSide(d, -10)], [0, 'down', 'down', 'up'], 'its home is still the level it was put on');
  eq([code(Dn, st.id), d.room, S.stairHop(Dn.entities, 15, 12.5, 0)], ['nothing-below', null, null], 'with nothing built below it says so (it leads down into the earth), belongs to no room, and a pawn does not fall through');
  // build the cellar under it: it works, with nothing done to the stair
  let C = room(Dn, CEL, 0, 0, 6, 4, -10, 'cellar');
  eq([code(C, st.id), S.stairHop(C.entities, 15, 12.5, 0)?.y, S.stairHop(C.entities, 15, 12.5, -10)?.y, S.stairLinks(C.entities, C.entities[st.id])], [null, -10, 0, { from: CEL, to: LOW }], 'a cellar built under it: it works, both ways, joining the cellar to this room');
  { const i3 = inverseOf(A, 'stair.flip', { id: st.id, ...F }), u = applyArea(Dn, i3.type, i3.args); eq([u.entities[st.id], holes(u, 10), holes(u, 0)], [s, ['2:2', '3:2'], []], 'undo puts it back exactly: stairs up, the hole above'); }
  const F2 = S.stairFlip(d, 0), Up2 = applyArea(Dn, 'stair.flip', { id: st.id, ...F2 });
  eq([F2, Up2.entities[st.id].y, 'down' in Up2.entities[st.id], Up2.entities[st.id].room, holes(Up2, 10), holes(Up2, 0)], [{ y: 0, down: false }, 0, false, LOW, ['2:2', '3:2'], []], 'switched back to stairs up it is what it was');
  // the switch is counted from the level you are on: an up stair seen from the floor it arrives at is "stairs down" there
  eq(S.stairFlip(s, 10), { y: 10, down: false }, 'from the floor above, "stairs up" lifts it one flight: it now leads up from THAT floor');
  // ---- no level above ----
  const Hi = applyArea(A, 'stair.flip', { id: st.id, ...S.stairFlip(s, 10) });
  eq([code(Hi, st.id), holes(Hi, 20), rails(Hi), S.stairHop(Hi.entities, 15, 12.5, 10), Hi.entities[st.id].room], ['open', ['2:2', '3:2'], [], null, UP], 'on the top floor with nothing over it: it stands there, cuts nothing that exists, and a pawn stays put');
  const Hi2 = room(Hi, TOP, 0, 0, 6, 4, 20, 'guest');
  eq([code(Hi2, st.id), rails(Hi2).length > 0, S.stairHop(Hi2.entities, 15, 12.5, 10)?.y], [null, true, 20], 'build a floor over it and it opens that floor, railed, and works');
  // a duplicate of a stairs-down keeps its direction
  ok(applyArea(C, 'object.place', { ...C.entities[st.id], id: 'obj_st00000003', z: 2.5 }).entities.obj_st00000003.down === true, 'a stairs-down keeps its direction when it is put down again (a duplicate, a paste)');

  // ---- 5. the room it was put in for; hidden; re-roll ----
  { const G = applyArea(C, 'room.delete', { id: LOW }), i = inverseOf(C, 'room.delete', { id: LOW }), bk = applyArea(G, i.type, i.args);
    ok(!G.entities[st.id] && bk.entities[st.id] && holes(bk, 0).length === 2, 'a stairs-down goes with the room it was put in (its home level), and one undo restores both'); }
  { const G = applyArea(A, 'room.delete', { id: UP }); eq([!!G.entities[st.id], code(G, st.id), holes(G, 10)], [true, 'open', ['2:2', '3:2']], 'a stairs-up stays when the room above is deleted, and says there is no floor above'); }
  { const Hd = applyArea(A, 'entity.flag', { ids: [UP], hidden: true }), pv = areaForClient(Hd, false);
    ok(Hd.entities[st.id].hidden && !pv.entities[st.id] && S.holesAt(pv.entities, 10).size === 0, 'a placed stair is hidden with EITHER room it joins: players get no stair and a whole floor');
    const Hc = applyArea(room(A, CEL, 0, 0, 6, 4, -10, 'cellar', { hidden: true }), 'entity.flag', { ids: [CEL], hidden: true }), Fl = applyArea(Hc, 'stair.flip', { id: st.id, ...F });
    ok(Fl.entities[st.id].hidden && S.holesAt(areaForClient(Fl, false).entities, 0).size === 0, 'switched down into a hidden cellar it is hidden: the players\' floor has no hole'); }
  { const L = rg.solve(A.entities, { id: LOW, type: 'common', seed: 77 }, A.entities[LOW].order, rg.pinnedOf(A.entities, LOW)), R = applyArea(A, 'room.reroll', { id: LOW, seed: 77, layout: L });
    const on = L.objects.filter(o => !o.parent && o.place !== 'ceiling' && o.place !== 'wall' && !o.flat && [[2, 2], [3, 2], [1, 2]].some(([gx, gz]) => o.x > gx * 5 + 0.3 && o.x < gx * 5 + 4.7 && o.z > gz * 5 + 0.3 && o.z < gz * 5 + 4.7));
    ok(R.entities[st.id] && !on.length && L.objects.length > 3, 'a placed stair stays through a re-roll of its room (not pinned), and the new furniture keeps off it and its foot', on.map(o => o.cat).join()); }
}

// ---- 3. a stair that cannot work says why ----
{
  let A = newArea('area_stairs002', 's'); A = room(A, LOW, 0, 0, 6, 4);
  const put = (T, x, z, rot, extra = {}) => applyArea(T, 'object.place', { id: 'obj_st00000009', ...FLIGHT, x, y: 0, z, rot, room: LOW, ...extra });
  const up = (T, x, z, w, d) => room(T, UP, x, z, w, d, 10, 'guest');
  eq(code(put(A, 15, 12.5, -Math.PI / 2), 'obj_st00000009'), 'open', 'nothing built over it: open (it will work the day there is a floor)');
  eq(code(put(up(A, 0, 0, 3, 4), 15, 12.5, -Math.PI / 2), 'obj_st00000009'), 'wall-above', 'half under the room above: it comes up through that room\'s wall');
  eq(code(put(up(A, 2, 2, 2, 1), 15, 12.5, -Math.PI / 2), 'obj_st00000009'), 'no-exit', 'the room above is only its own two squares: nowhere to step off');
  eq(code(put(up(A, 0, 0, 6, 4), 5, 12.5, -Math.PI / 2), 'obj_st00000009'), 'foot', 'its foot against the wall of the room it stands in: blocked at the foot');
  { const two = room(up(A, 0, 0, 8, 4), 'room_stside001', 6, 0, 2, 4, 0, 'kitchen'); eq(code(put(two, 30, 12.5, -Math.PI / 2), 'obj_st00000009'), 'wall-below', 'astride two rooms of its own floor: a wall runs through it'); }
  eq(code(put(A, 15, 12.5, -Math.PI / 2, { y: 30, room: undefined }), 'obj_st00000009'), 'nothing-below', 'left in the air: it stands on no floor');
  { const out = put(A, 45, 12.5, -Math.PI / 2, { room: undefined }); eq([code(out, 'obj_st00000009'), holes(out, 10)], ['open', ['8:2', '9:2']], 'outdoors on the ground: it stands, with nothing above it'); }
  const info = S.stairInfo(put(A, 15, 12.5, -Math.PI / 2).entities, put(A, 15, 12.5, -Math.PI / 2).entities.obj_st00000009);
  ok(info.works === false && info.problem === 'open' && /no floor/.test(info.why), 'a seat is told whether each stair works, and why not', JSON.stringify(info));
}

// ---- 4. every stair piece of the library: up, down and back ----
{
  let n = 0;
  for (const cat of Object.keys(S.STAIR_ROLES)) for (const k of rg.lib.objects[cat]?.skus.filter(k => k.bounds && k.url) || []) {
    let A = newArea('area_stairs003', 's'); A = room(A, LOW, 0, 0, 8, 8); A = room(A, UP, 0, 0, 8, 8, 10, 'guest'); A = room(A, CEL, 0, 0, 8, 8, -10, 'cellar');
    const P = piece(cat, k.sku), rise = S.STAIR_ROLES[cat].rise, even = (v) => Math.round(v / 5) % 2 === 0;
    const st = { id: 'obj_st00000004', ...P, x: even(P.dims[0]) ? 20 : 22.5, y: 0, z: even(P.dims[2]) ? 20 : 22.5, rot: 0, room: LOW };
    A = applyArea(A, 'object.place', st); const s = A.entities[st.id]; n++;
    const upOk = rise === 10 ? holes(A, 10).join() === cellKeys(s).join() && code(A, st.id) === null : code(A, st.id) === 'open'; // (a half flight reaches no floor in a 10-ft storey: it is a dais's steps)
    const Dn = applyArea(A, 'stair.flip', { id: st.id, ...S.stairFlip(s, 0) }), d = Dn.entities[st.id];
    const dnOk = d.y === -rise && d.down && cellKeys(d).join() === cellKeys(s).join() && holes(Dn, 0).join() === cellKeys(s).join() && holes(Dn, 10).length === 0 && (rise === 10 ? code(Dn, st.id) === null && d.room === CEL : true);
    const Bk = applyArea(Dn, 'stair.flip', { id: st.id, ...S.stairFlip(d, 0) });
    ok(upOk && dnOk && JSON.stringify(Bk.entities[st.id]) === JSON.stringify(s), `${k.sku}: up it opens the floor above; down it stands a storey lower under a hole in this floor; back it is as it was`, JSON.stringify([upOk, dnOk, code(A, st.id), code(Dn, st.id), holes(A, 10), holes(Dn, 0), d.room]));
  }
  ok(n >= 9, `every stair, spiral and ladder of the library was tried (${n} pieces)`);
  console.log(`  (${n} library pieces switched down and back)`);
}

// ---- 5b. a stair the room's layout rolled is furniture: hidden and re-rolled with its own room ----
{
  let A = newArea('area_stairs004', 's'); const hallA = { id: LOW, type: 'mansion-hall', x: 0, z: 0, w: 6, d: 6, seed: 2, building: B, buildingName: 'M' };
  A = applyArea(A, 'room.spawn', { ...hallA, layout: rg.solve(A.entities, hallA, 1) }); A = room(A, UP, 0, 0, 6, 6, 10, 'mansion-bedroom');
  const g = Object.values(A.entities).find(o => o.cat === 'stair-grand');
  ok(g && S.isConnector(g) && !S.isPlacedStair(g), 'the mansion hall\'s grand stair is a stair, and furniture');
  const Hd = applyArea(A, 'entity.flag', { ids: [UP], hidden: true });
  ok(g && !Hd.entities[g.id].hidden, 'hiding the room above leaves it standing in the hall (players then have no floor above, so no hole)');
  ok(g && REGISTRY['room.reroll'].touches({ id: LOW, seed: 1, layout: EMPTY }, A).includes(g.id), 'and a re-roll of the hall rolls it again');
  if (g) { const Dn = applyArea(A, 'stair.flip', { id: g.id, ...S.stairFlip(g, 0) }); ok(Dn.entities[g.id].down && holes(Dn, 0).length > 0 && holes(Dn, 10).length === 0, 'it switches to stairs down like any other'); }
}

// ---- 6. the offer for a room drawn by hand, and the stair core ----
{
  const stub = (a, order) => ({ id: a.id, kind: 'room', recipe: { ...a }, building: a.building, order });
  let offers = 0, tried = 0, kitchens = 0, clean = 0;
  for (let seed = 1; seed <= 20; seed++) for (const type of ['common', 'kitchen']) {
    let A = newArea('area_stairs005', 's'); const a1 = { id: LOW, type, x: 0, z: 0, w: 6, d: 5, seed, building: B, buildingName: 'Inn' };
    A = applyArea(A, 'room.spawn', { ...a1, layout: rg.solve(A.entities, a1, 1) });
    const a2 = { id: UP, type: 'guest', x: 0, z: 0, w: 5, d: 5, y: 10, seed: seed + 100, building: B };
    A = applyArea(A, 'room.spawn', { ...a2, layout: rg.solve(A.entities, a2, 2) }); // drawn by hand: furnished, NO stair
    const P = rg.stairOffer(A.entities, A.entities[UP]);
    if (type === 'kitchen') { if (P) kitchens++; continue; }
    tried++; if (!P) continue; offers++;
    const so = { id: 'obj_st00000005', kind: 'object', ...P.args }, cs = S.stairCells(so), E = S.stairEnds(so);
    const lowObjs = Object.values(A.entities).filter(o => o.kind === 'object' && o.room === LOW && !o.parent && o.place !== 'ceiling' && o.place !== 'wall' && !o.flat);
    const onLow = lowObjs.filter(o => [...cs, E.footCell].some(([gx, gz]) => o.x > gx * 5 + 0.3 && o.x < gx * 5 + 4.7 && o.z > gz * 5 + 0.3 && o.z < gz * 5 + 4.7));
    // taking it: the stair, and the new room laid again round the hole
    const L = rg.solve({ ...A.entities, [so.id]: so }, { id: UP, type: 'guest', seed: a2.seed }, 2, []);
    const onUp = L.objects.filter(o => !o.parent && o.place !== 'ceiling' && o.place !== 'wall' && !o.flat && [...cs, E.topCell].some(([gx, gz]) => o.x > gx * 5 + 0.3 && o.x < gx * 5 + 4.7 && o.z > gz * 5 + 0.3 && o.z < gz * 5 + 4.7));
    let T = applyArea(A, 'object.place', so); T = applyArea(T, 'room.reroll', { id: UP, seed: a2.seed, layout: L });
    if (P.kind === 'straight' && P.label === 'Add stairs down' && P.args.down && !onLow.length && !onUp.length && S.stairStatus(T.entities, T.entities[so.id]).code === null) clean++;
    else ok(false, `offer seed ${seed}: a straight flight on free floor, working once taken`, JSON.stringify([P.kind, P.label, onLow.map(o => o.cat), onUp.map(o => o.cat), S.stairStatus(T.entities, T.entities[so.id])]));
  }
  ok(kitchens === 0, 'over a kitchen (not a hallway or common room) no stair is ever offered', `${kitchens}`);
  ok(offers > 0 && offers < tried && clean === offers, `over a furnished common room an offer appears only when a flight really lines up (${offers} of ${tried} rooms): never a ladder, never on furniture, both landings free, and it works once taken`);
  console.log(`  (offer: ${offers} of ${tried} common rooms; 0 of 20 kitchens)`);
  // a hallway below with a clear run: offered; nothing below that is plausible: not
  { let A = newArea('area_stairs006', 's'); A = room(A, LOW, 0, 0, 2, 6, 0, 'hallway'); A = room(A, UP, 0, 0, 2, 6, 10, 'guest');
    const P = rg.stairOffer(A.entities, A.entities[UP]); ok(P && P.label === 'Add stairs down' && P.from === LOW && /^stair-straight/.test(P.args.cat), 'an empty hallway below: "Add stairs down" is offered');
    const A2 = applyArea(A, 'object.place', { id: 'obj_st00000006', ...P.args }); eq(rg.stairOffer(A2.entities, A2.entities[UP]), null, 'a room that has stairs is offered none'); }

  // the stair core: three storeys, a switchback of straight flights
  for (const kind of ['straight', 'ladder']) {
    let A = newArea('area_stairs007', 's'); for (const [i, y] of [0, 10, 20].entries()) A = room(A, `room_stcore000${i}`, 0, 0, 5, 5, y, i ? 'guest' : 'common');
    const C = rg.stairCore({ at: { gx: 1, gz: 1, q: 0 }, levels: [0, 10, 20], kind, family: 'rough-timber' });
    C.stairs.forEach((a, i) => { A = applyArea(A, 'object.place', { id: `obj_stcore000${i}`, ...a, room: S.stairRoomAt(A.entities, { kind: 'object', ...a }, a.y) }); });
    const st = S.stairsOf(A.entities), stand = (y) => st.filter(s => S.stairBase(s) === y).flatMap(cellKeys);
    ok(st.length === 2 && st.every(s => S.stairStatus(A.entities, s).code === null && s.pinned && !s.down), `a ${kind} core through three storeys: one ${kind} per storey, every one works`, JSON.stringify(st.map(s => S.stairStatus(A.entities, s))));
    ok(holes(A, 10).length && holes(A, 20).length && !holes(A, 10).some(k => stand(10).includes(k)), `${kind} core: the upper flight never stands on the lower one's hole`, `${holes(A, 10)} / ${stand(10)}`);
    const h1 = S.stairHop(A.entities, st[0].x, st[0].z, 0), h2 = h1 && S.stairHop(A.entities, st[1].x, st[1].z, 10);
    ok(h1?.y === 10 && h2?.y === 20 && Math.hypot(h1.x - S.stairEnds(st[1], A.entities).foot.x, h1.z - S.stairEnds(st[1], A.entities).foot.z) <= 7.1, `${kind} core: a pawn goes up both, and the top of one is beside the foot of the next`, JSON.stringify([h1, h2, S.stairEnds(st[1], A.entities).foot]));
    ok(C.keep.length === 3 && C.keep.every(k => k.cells.length >= 2), `${kind} core: it says which squares of each floor to keep clear`);
  }
}

// ---- 7. old stairs become ordinary ones ----
const sameStair = (Eb, b, Ea, a) => {
  const eb = S.stairEnds(b, Eb), ea = S.stairEnds(a, Ea), lad = S.stairKind(b) === 'ladder';
  return cellKeys(b).join() === cellKeys(a).join() && S.stairBase(b) === S.stairBase(a) && S.stairTop(b) === S.stairTop(a) && eb.footCell.join() === ea.footCell.join()
    && (lad || eb.topCell.join() === ea.topCell.join()) // (a ladder is now left at the top on the side it was climbed from)
    && (lad || S.stairDir(b).join() === S.stairDir(a).join());
};
{
  let A = newArea('area_stairs008', 's'); A = room(A, LOW, 0, 0, 6, 4); A = room(A, UP, 0, 0, 6, 4, 10, 'guest'); A = room(A, CEL, 0, 0, 6, 4, -10, 'cellar');
  const old = [
    { id: 'obj_old0000001', name: 'stair', cat: 'stair-straight', sku: 'stair-straight--rough-timber--t10', url: 'assets/m/stair-straight--rough-timber--t10.glb', place: 'stair', stair: 'straight', rise: 10, x: 12.5, y: 0, z: 10, rot: 0, dims: [4.4, 10, 10], room: LOW },
    { id: 'obj_old0000002', name: 'ladder', cat: 'ladder-wood', sku: 'ladder-wood--upright', url: 'assets/m/ladder-wood--upright.glb', place: 'stair', stair: 'ladder', rise: 10, x: 22.5, y: -10, z: 7.5, rot: Math.PI / 2, dims: [2.2, 10, 1.6], room: CEL },
    { id: 'obj_old0000003', name: 'stair', place: 'stair', rise: 10, x: 20, y: 0, z: 17.5, rot: Math.PI / 2, dims: [4.4, 10, 10], room: LOW }, // (no mesh: the stand-in)
  ];
  for (const o of old) A = applyArea(A, 'object.place', o);
  ok(S.stairsOf(A.entities).every(S.isStair), 'the reducer still takes an old stair as it was written (a journal replays as it was)');
  const rt = { state: { areas: { a: A } }, undo: new Map([['a', [{ inv: { type: 'entities.set', args: { set: { [old[0].id]: A.entities[old[0].id] } } } }]]]), redo: new Map() };
  const n = migrateStairs(rt, rg.stairPieceOf), Bf = A.entities, Af = rt.state.areas.a.entities;
  eq([n, migrateStairs(rt, rg.stairPieceOf)], [{ stairs: 3, stored: 1 }, { stairs: 0, stored: 0 }], 'three old stairs and one in the undo history are converted; a second pass changes nothing');
  ok(old.every(o => S.isPlacedStair(Af[o.id]) && !S.isStair(Af[o.id]) && !('stair' in Af[o.id]) && sameStair(Bf, Bf[o.id], Af, Af[o.id])), 'each is an ordinary placed stair on the same squares, between the same floors, with the same foot and top', JSON.stringify(old.map(o => [cellKeys(Bf[o.id]), cellKeys(Af[o.id]), S.stairEnds(Bf[o.id], Bf).topCell, S.stairEnds(Af[o.id], Af).topCell])));
  eq([holes({ entities: Af }, 10), holes({ entities: Af }, 0)], [holes(A, 10), holes(A, 0)], 'every hole is where it was');
  eq([Af[old[0].id].down, Af[old[1].id].down, Af[old[0].id].place, Af[old[1].id].place, Af[old[0].id].dims, 'rise' in Af[old[0].id], Af[old[2].id].url], [true, undefined, 'kit', 'wall', FLIGHT.dims, false, FLIGHT.url], 'a stair up into an upper room was put in for that room (stairs down); a cellar\'s is its own; each takes the library\'s size; one that had no mesh (a stand-in) gets the library\'s piece');
  ok(!S.isStair(rt.undo.get('a')[0].inv.args.set[old[0].id]), 'an undo can no longer bring an old-shaped stair back');
}
// the corpus of real saved campaigns: every old stair, before and after
{
  const dir = corpusDir(), tokens = makeTokens('test-secret'), quiet = () => {}, made = [];
  const copy = (d) => { const t = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tw-stairsmig-')), d); made.push(path.dirname(t)); fs.mkdirSync(t, { recursive: true }); for (const f of ['journal.jsonl', 'snapshot.json']) if (fs.existsSync(path.join(dir, d, f))) fs.copyFileSync(path.join(dir, d, f), path.join(t, f)); return t; };
  let camps = 0, withStairs = 0, stairs = 0, flights = 0, ladders = 0, down = 0, bad = 0, holesSame = 0, railsSame = 0, ladderAreas = 0, areas = 0, works = 0, again = 0;
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.startsWith('cmp_')) : []) {
    const has = ['journal.jsonl', 'snapshot.json'].some(f => { try { return fs.readFileSync(path.join(dir, d, f), 'utf8').includes('"place":"stair"'); } catch { return false; } });
    camps++; if (!has) continue;
    let O, N, dn;
    try { O = new CampaignRuntime({ id: d, dir: copy(d), tokens, roomgen: rg, log: quiet }); O.load({ stairs: false }); O.journal.close();
      dn = copy(d); N = new CampaignRuntime({ id: d, dir: dn, tokens, roomgen: rg, log: quiet }); N.load(); N.close(); } catch (e) { ok(false, `${d}: loads (${e.message})`); continue; }
    let here = 0;
    for (const [aid, Ao] of Object.entries(O.state.areas)) {
      const An = N.state.areas[aid], olds = Object.values(Ao.entities).filter(S.isStair); if (!olds.length) continue;
      areas++; here += olds.length;
      for (const o of olds) {
        const n = An.entities[o.id]; stairs++;
        if (S.stairKind(o) === 'ladder') ladders++; else flights++;
        if (n?.down) down++;
        if (!n || S.isStair(n) || !S.isPlacedStair(n) || !n.url || !sameStair(Ao.entities, o, An.entities, n) || !!n.hidden !== !!o.hidden || n.room !== o.room) { bad++; if (bad < 4) console.log('   ', d, o.id, JSON.stringify([cellKeys(o), n && cellKeys(n), S.stairEnds(o, Ao.entities).topCell, n && S.stairEnds(n, An.entities).topCell])); }
        else if (S.stairStatus(An.entities, n).code === null) works++;
      }
      const ys = [...new Set(olds.map(S.stairTop))];
      if (ys.every(y => holes(Ao, y).join() === holes(An, y).join())) holesSame++;
      // the railing: identical, except round a LADDER's hole, where the open side moves to the side it is climbed from
      // (the same number of sections: one side opens, the other closes)
      const lad = olds.some(o => S.stairKind(o) === 'ladder'), ro = S.railsOf(Ao.entities).map(r => r.key).sort(), rn = S.railsOf(An.entities).map(r => r.key).sort();
      if (lad) ladderAreas++;
      if (ro.join() === rn.join() || (lad && Math.abs(ro.length - rn.length) <= olds.filter(o => S.stairKind(o) === 'ladder').length)) railsSame++;
      if (Object.values(An.entities).some(S.isStair)) bad++;
    }
    if (here) withStairs++;
    // the converted campaign was written back as a snapshot: opened again there is nothing left to convert
    try { const R = new CampaignRuntime({ id: d, dir: dn, tokens, roomgen: rg, log: quiet }); if (R.load().stairs === 0 && !Object.values(R.state.areas).some(a => Object.values(a.entities).some(S.isStair))) again++; R.journal.close(); } catch { /* counted as not again */ }
  }
  for (const m of made) fs.rmSync(m, { recursive: true, force: true });
  if (camps) {
    ok(stairs > 0 && bad === 0, `the corpus: all ${stairs} old stairs (${flights} flights, ${ladders} ladders) in ${withStairs} of ${camps} saved campaigns became ordinary placed stairs on the same squares, between the same floors, in the same room, with a real mesh`, `bad ${bad}`);
    ok(holesSame === areas && railsSame === areas, `the corpus: in all ${areas} areas that have stairs every hole is where it was, and every railing section too (but round the ${ladders} ladders' holes in ${ladderAreas} areas, where the open side is now the side the ladder is climbed from)`, `${holesSame}/${areas} ${railsSame}/${areas}`);
    ok(again === withStairs, 'the corpus: each converted campaign, opened again, has nothing left to convert', `${again}/${withStairs}`);
    console.log(`  (corpus: ${stairs} old stairs in ${withStairs} of ${camps} campaigns converted: ${flights} flights, ${ladders} ladders; ${down} read as stairs down (put in for the room above); ${works} work where they stand)`);
  } else console.log('  (no corpus of saved campaigns here: the conversion was checked on made-up stairs only)');
}

console.log(`stairs: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
