// node test/terrain.test.mjs : the bank maths in the game (core/terrain.js) and the hill rules (core/height.js, the
// room commands). docs/VERTICAL.md "Terrain: computed banks"; the demo's own checks were experiments/2026-10-05-banks/test_terrain.mjs.
import { terrainOf, terrainKey, cuttersOf, buildField, clustersOf, hillsOf, dressingOf, BANKS } from '../core/terrain.js';
import * as HT from '../core/height.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CampaignRuntime } from '../relay/campaign.js';
import { makeTokens } from '../relay/tokens.js';
import { areaForClient } from '../core/state.js';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got ?? ''); } else console.log('ok  ', name, got ?? ''); };
const hill = (id, x, z, w, d, y = 10, extra = {}) => ({ id, kind: 'room', recipe: { type: 'hill', x, z, w, d, y, seed: 1, wallSeed: 8, floor: 'floor-grass' }, building: null, ...extra });
const ents = (...hs) => Object.fromEntries(hs.map(h => [h.id, h]));

// 1. one plateau 30 x 30 ft, 10 ft up, the house settings (angle 45, soft 1.2, round 0.5, rough 0.6)
let t = Date.now();
let T = terrainOf(ents(hill('room_a', 0, 0, 6, 6)));
ok('one hill, one field', T.fields.length === 1 && T.hills.length === 1, T.fields.length);
ok('built in under 1.5 s', Date.now() - t < 1500, `${Date.now() - t} ms`);
let F = T.fields[0];
ok('top is exactly 10 in the middle', T.heightAt(15, 15) === 10, T.heightAt(15, 15));
ok('top is level right to its edge squares', [[0.2, 15], [29.8, 15], [15, 0.2], [15, 29.8], [0.5, 0.5], [29.5, 29.5]].every(([x, z]) => Math.abs(T.heightAt(x, z) - 10) < 1e-6), [T.heightAt(0.2, 15), T.heightAt(29.8, 15)]);
ok('a pawn base on an edge square stands level (relief < 0.05 ft)', F.relief(2.5, 2.5, 2.4) < 0.05 && F.relief(27.5, 15, 2.4) < 0.05, F.relief(27.5, 15, 2.4));
ok('the bank lies OUTSIDE the hill: just past the edge it is still near the top', T.heightAt(30.5, 15) > 9.5 && T.heightAt(-0.5, 15) > 9.5, [T.heightAt(30.5, 15), T.heightAt(-0.5, 15)]);
ok('far ground is 0', T.heightAt(80, 80) === 0 && T.heightAt(-60, 15) === 0);
// where the bank is half way down, on each side (the roughness moves it; it should be within a few feet of 1.44 + 5/tan45)
const half = (dir) => { for (let d = 0; d < 30; d += 0.25) { const [x, z] = dir === 'E' ? [30 + d, 15] : dir === 'W' ? [-d, 15] : dir === 'N' ? [15, -d] : [15, 30 + d]; if (T.heightAt(x, z) <= 5) return d; } return 99; };
const halves = ['E', 'W', 'N', 'S'].map(half);
ok('half way down 3 to 12 ft out on every side (a 10 ft rise at about 45 degrees)', halves.every(d => d > 3 && d < 12), halves);
const foot = (dir) => { for (let d = 0; d < 40; d += 0.25) { const [x, z] = dir === 'E' ? [30 + d, 15] : [15, 30 + d]; if (T.heightAt(x, z) < 0.01) return d; } return 99; };
ok('the bank reaches the ground within 20 ft', foot('E') < 20 && foot('S') < 20, [foot('E'), foot('S')]);
let steep = 0; for (let d = 1; d < 14; d += 0.25) steep = Math.max(steep, F.slopeDeg(30 + d, 15, 0.5));
ok('the steepest part of the bank is 35 to 70 degrees', steep > 35 && steep < 70, steep.toFixed(1));
ok('no NaN anywhere', !F.h.some(Number.isNaN));
ok('the field never dips under the ground', F.h.every(v => v >= 0));
ok('the hill top samples are its own (owner 0, top)', F.sample(F.owner, 15, 15) === 0 && F.sample(F.top, 15, 15) === 1);
ok('a bank sample belongs to the hill', F.sample(F.owner, 34, 15) === 0 && F.sample(F.top, 34, 15) === 0, F.sample(F.owner, 34, 15));
// corner: round (the diagonal distance to half height about the same as straight out)
let dc = 0; for (let d = 0; d < 20; d += 0.1) if (T.heightAt(30 + d / Math.SQRT2, 30 + d / Math.SQRT2) > 5) dc = d;
ok('the outside corner is round (half height about as far out as on a side)', Math.abs(dc - halves[0]) < 4, [dc.toFixed(1), halves[0]]);

// 2. a terrace on a terrace: a 20-ft hill inside a 10-ft one; and two hills side by side at 10 and 15
T = terrainOf(ents(hill('room_a', 0, 0, 12, 12, 10), hill('room_b', 4, 4, 4, 4, 20)));
F = T.fields[0];
ok('stacked: one field', T.fields.length === 1);
ok('stacked: the upper top is 20, level', T.heightAt(30, 30) === 20 && F.relief(30, 30, 2.4) < 0.05, T.heightAt(30, 30));
ok('stacked: the lower terrace is 10 away from the upper bank', T.heightAt(3, 3) === 10, T.heightAt(3, 3));
const midB = T.heightAt(44, 30);
ok('stacked: the upper bank comes down onto the lower terrace (10 < h < 20 just past its edge)', midB > 10 && midB < 20, midB);
ok('stacked: the upper bank is the upper hill\'s ground', F.sample(F.owner, 43, 30) === T.hills.findIndex(h => h.id === 'room_b'), F.sample(F.owner, 43, 30));
ok('stacked: the lower bank still runs down to 0', T.heightAt(85, 30) === 0 && T.heightAt(61, 30) > 5, [T.heightAt(61, 30), T.heightAt(85, 30)]);
T = terrainOf(ents(hill('room_a', 0, 0, 4, 6, 10), hill('room_b', 4, 0, 4, 6, 15)));
ok('side by side: each top is level at its own height', T.heightAt(10, 15) === 10 && T.heightAt(30, 15) === 15, [T.heightAt(10, 15), T.heightAt(30, 15)]);
ok('side by side: the step between them is a bank on the lower one', T.heightAt(18, 15) > 10 && T.heightAt(18, 15) < 15 && T.heightAt(20.5, 15) === 15, [T.heightAt(18, 15), T.heightAt(20.5, 15)]);

// 3. far-apart hills are separate fields; a rock face is steeper than a grass bank
T = terrainOf(ents(hill('room_a', 0, 0, 4, 4), hill('room_b', 40, 40, 4, 4)));
ok('far apart: two fields', T.fields.length === 2, T.fields.length);
const grass = terrainOf(ents(hill('room_a', 0, 0, 6, 6))), rockT = terrainOf(ents(hill('room_a', 0, 0, 6, 6, 10, { cliff: true })));
let sg = 0, sr = 0; for (let d = 0.5; d < 12; d += 0.25) { sg = Math.max(sg, grass.fields[0].slopeDeg(30 + d, 15, 0.5)); sr = Math.max(sr, rockT.fields[0].slopeDeg(30 + d, 15, 0.5)); }
ok('a rock face is steeper than the grass bank', sr > sg + 8 && sr > 60, [sg.toFixed(1), sr.toFixed(1)]);
const falls = (TT) => { for (const z of [2.5, 15, 27.5]) { let prev = 99; for (let d = 0; d < 22; d += 0.25) { const v = TT.heightAt(30 + d, z); if (v > prev + 0.15) return [z, d, v, prev]; prev = v; } } return true; };
ok('a rock face falls all the way down: no trench and berm at its foot', falls(rockT) === true, falls(rockT));
ok('a grass bank falls all the way down too', falls(grass) === true, falls(grass));
ok('a rock face is marked rock on the bank', rockT.fields[0].sample(rockT.fields[0].rock, 31.5, 15) > 0.6 && grass.fields[0].sample(grass.fields[0].rock, 31.5, 15) === 0);
{ const L = hill('room_l', 0, 0, 6, 6); L.recipe.outline = [[0, 0], [6, 0], [6, 2], [3, 2], [3, 6], [0, 6]]; const LT = terrainOf(ents(L));
  ok('a shaped hill (an L): its squares only', LT.hills[0].cells.length === 24, LT.hills[0].cells.length);
  ok('a shaped hill (an L): the notch is low, the arms are its top', LT.heightAt(25, 25) < 6 && LT.heightAt(7.5, 25) === 10 && LT.heightAt(25, 5) === 10, [LT.heightAt(25, 25), LT.heightAt(7.5, 25)]); }

// 4. the dressing: seeded, on the banks only, never on a top
T = terrainOf(ents(hill('room_a', 0, 0, 6, 6)));
const D1 = dressingOf(T.fields[0], BANKS, { seed: 3 }), D2 = dressingOf(T.fields[0], BANKS, { seed: 3 });
ok('dressing: some rocks and bushes', D1.length >= 4 && D1.some(o => o.id === 'rock-boulder'), D1.length);
ok('dressing: the same seed gives the same pieces', JSON.stringify(D1) === JSON.stringify(D2));
ok('dressing: nothing on the hill top', D1.every(o => !(o.x > 1 && o.x < 29 && o.z > 1 && o.z < 29)), D1.filter(o => o.x > 1 && o.x < 29 && o.z > 1 && o.z < 29).length);
const D3 = dressingOf(T.fields[0], { ...BANKS, dress: 0 }, { seed: 3 });
ok('dressing 0: bare', D3.length === 0, D3.length);
ok('dressing keeps out where told', dressingOf(T.fields[0], BANKS, { seed: 3, keepOut: (x) => x > 30 }).every(o => o.x <= 30 + 2.5));

// 5. the hill rules (core/height.js, room commands)
const H = ents(hill('room_a', 0, 0, 6, 6));
ok('isTerrain', HT.isTerrain({ type: 'hill' }) && !HT.isTerrain({ type: 'yard' }));
ok('terrainTopAt: 10 on the hill, 0 off it', HT.terrainTopAt(H, 15, 15) === 10 && HT.terrainTopAt(H, 40, 15) === 0);
ok('a pawn on the hill: its base is the hill top', HT.baseUnder(H, 15, 15, 10, () => true).y === 10);
ok('sight: a pawn on a hill is on the ground level for fog', HT.sightLevel(H, 15, 15, 10, () => true) === 0);
ok('no supports under a hill', HT.supportPlan(H, H.room_a).posts.length === 0 && HT.supportPlan(H, H.room_a).brackets.length === 0);
ok('hill clashes: another hill at the same height over it', !!HT.roomClash(H, { type: 'hill', x: 3, z: 3, w: 4, d: 4, y: 10 }, [10, 20]));
ok('hill clashes: a hill on top of it (20 ft) is fine', !HT.roomClash(H, { type: 'hill', x: 1, z: 1, w: 3, d: 3, y: 20 }, [20, 30]));
ok('hill clashes: a 15 ft hill on it is fine', !HT.roomClash(H, { type: 'hill', x: 1, z: 1, w: 3, d: 3, y: 15 }, [15, 25]));
ok('hill clashes: a ground room inside it is no clash (2026-10-24: dug into it, rooms trump the hill)', !HT.roomClash(H, { type: 'common', x: 1, z: 1, w: 3, d: 3 }, [0, 10]));
ok('hill clashes: a cottage ON the hill top is not a clash', !HT.roomClash(H, { type: 'hut-cottage', x: 1, z: 1, w: 3, d: 3, y: 10 }, [10, 20]));
ok('hill clashes: a cellar under it is fine', !HT.roomClash(H, { type: 'cellar', x: 1, z: 1, w: 3, d: 3, y: -10 }, [-10, 0]));
ok('a hill does not carry an upper room', !HT.supportAt(H, 20).any);

// commands (through the relay, as a seat sends them): spawn a hill with no building, grass by default; it needs no
// support; raise and lower; rock sides; undo and redo; a player receives it; it survives a reload
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-hills-')), tokens = makeTokens('hill-tests');
let { rt, gmSeat: gm } = CampaignRuntime.create({ id: 'cmp_hills0001', dir, name: 'TEST Hills (throwaway)', gmName: 'GM', tokens });
const area = rt.state.areaOrder[0], pl = 'seat_player0001';
const run = (type, args = {}, who = gm) => rt.dispatch(who, { type, args, area });
run('seat.create', { id: pl, kind: 'human', role: 'player', name: 'P', color: '#aabbcc' });
const A = () => rt.state.areas[area].entities, NOLAY = { hash: 'hill', summary: '', objects: [] }; // (the test relay has no room engine: the layout a client would send)
let r = run('room.spawn', { id: 'room_hill0001', type: 'hill', x: 0, z: 0, w: 6, d: 6, y: 10, seed: 5, building: 'bld_hill0001', buildingName: 'B', layout: NOLAY });
ok('room.spawn: a hill at 10 ft with nothing under it', r.ok, r.error);
ok('the hill belongs to no building and makes none', r.ok && A().room_hill0001.building === null && !A().bld_hill0001, A().room_hill0001?.building);
ok('the hill is grass by default', A().room_hill0001?.recipe.floor === 'floor-grass', A().room_hill0001?.recipe.floor);
ok('a hill at 0 is refused', !run('room.spawn', { id: 'room_hill0000', type: 'hill', x: 20, z: 0, w: 2, d: 2, seed: 5, layout: NOLAY }).ok);
ok('a hill on the hill (20 ft) spawns', run('room.spawn', { id: 'room_hill0002', type: 'hill', x: 1, z: 1, w: 2, d: 2, y: 20, seed: 5, layout: NOLAY }).ok);
ok('a ground room inside the hill spawns, dug into it (2026-10-24)', run('room.spawn', { id: 'room_cmn00001', type: 'common', x: 2, z: 2, w: 2, d: 2, seed: 5, building: 'bld_dug00001', buildingName: 'Dug', layout: NOLAY }).ok);
// "Room type" does not cross ground and rooms (2026-11-05, live: a hill made a chapel floated 10 ft up and vanished
// at the ground). A hill's y is its height, a room's its floor: refused both ways; within each side it still works.
r = run('room.reroll', { id: 'room_hill0001', seed: 6, type: 'chapel', layout: NOLAY });
ok('a hill cannot be given a room type (room.reroll type=chapel refused)', !r.ok && A().room_hill0001.recipe.type === 'hill' && A().room_hill0001.recipe.y === 10, r.error);
r = run('room.reroll', { id: 'room_cmn00001', seed: 6, type: 'hill', layout: NOLAY });
ok('a room cannot be made a hill', !r.ok && A().room_cmn00001.recipe.type === 'common', r.error);
ok('a hill still re-rolls (no type)', run('room.reroll', { id: 'room_hill0001', seed: 7, layout: NOLAY }).ok && A().room_hill0001.recipe.type === 'hill' && A().room_hill0001.recipe.seed === 7);
ok('a room still changes type (common -> kitchen)', run('room.reroll', { id: 'room_cmn00001', seed: 7, type: 'kitchen', layout: NOLAY }).ok && A().room_cmn00001.recipe.type === 'kitchen');
ok('(and back)', run('undo').ok && A().room_cmn00001.recipe.type === 'common');
r = run('room.spawn', { id: 'room_cave0001', type: 'cave', x: 40, z: 0, w: 3, d: 3, y: -10, seed: 5, building: 'bld_cave0001', buildingName: 'Cave', layout: NOLAY });
ok('a cave under the ground spawns', r.ok, r.error);
ok('a cave becomes a room (its y is a floor, as a room\'s: a cellar at -10)', run('room.reroll', { id: 'room_cave0001', seed: 6, type: 'cellar', layout: NOLAY }).ok && A().room_cave0001.recipe.type === 'cellar' && A().room_cave0001.recipe.y === -10);
ok('a cellar cannot be made a hill either', !run('room.reroll', { id: 'room_cave0001', seed: 6, type: 'hill', layout: NOLAY }).ok);
ok('raise 5 ft', run('room.move', { id: 'room_hill0001', dx: 0, dz: 0, dy: 5 }).ok && A().room_hill0001.recipe.y === 15);
ok('lower to 5 ft', run('room.move', { id: 'room_hill0001', dx: 0, dz: 0, dy: -10 }).ok && A().room_hill0001.recipe.y === 5);
ok('not to the ground', !run('room.move', { id: 'room_hill0001', dx: 0, dz: 0, dy: -5 }).ok && A().room_hill0001.recipe.y === 5);
ok('undo the lowering: 15 ft again', run('undo').ok && A().room_hill0001.recipe.y === 15, A().room_hill0001.recipe.y);
ok('redo: 5 ft', run('redo').ok && A().room_hill0001.recipe.y === 5);
ok('rock sides on', run('room.set', { id: 'room_hill0001', cliff: true }).ok && A().room_hill0001.cliff === true);
ok('a player receives the hill and its rock sides', areaForClient(rt.state.areas[area], false, pl).entities.room_hill0001?.cliff === true);
ok('rock sides off (the field goes)', run('room.set', { id: 'room_hill0001', cliff: false }).ok && !('cliff' in A().room_hill0001));
ok('undo: rock sides back', run('undo').ok && A().room_hill0001.cliff === true);
ok('a player may not make a hill', !run('room.spawn', { id: 'room_hillp001', type: 'hill', x: 30, z: 30, w: 2, d: 2, y: 10, seed: 5, layout: NOLAY }, pl).ok);
rt.close(); rt = new CampaignRuntime({ id: 'cmp_hills0001', dir, tokens }); rt.load();
ok('kept in the saved campaign', A().room_hill0001?.recipe.type === 'hill' && A().room_hill0001.recipe.y === 5 && A().room_hill0001.cliff === true && A().room_hill0002?.recipe.y === 20);
rt.close(); fs.rmSync(dir, { recursive: true, force: true });

// THE CUT AND THE HILL (2026-10-26; docs/VERTICAL.md "The cut, one numbering for the map"). One numbering for the whole
// map; the cut hides what COVERS the level you are on (core/height.js cutRooms, cutHidesBase). (2026-10-27) A room below
// the ground never changes a hill's shape: the crater of 2026-10-26 is gone (the hill is see-through there instead).
{
  const R = (id, x, z, w, d, y, building) => ({ id, kind: 'room', recipe: { type: 'common', x, z, w, d, seed: 3, wallSeed: 9, ...(y && { y }) }, building, order: 2 });
  const B = (id) => ({ id, kind: 'building', name: id });
  const E = ents(hill('room_hc_hill', 0, 0, 8, 8), R('room_hc_shrine', 2, 2, 3, 4, 10, 'bld_hc_s'), R('room_hc_shrup', 2, 2, 3, 3, 20, 'bld_hc_s'), B('bld_hc_s'),
    R('room_hc_inn', 20, 0, 5, 4, 0, 'bld_hc_i'), R('room_hc_innup', 20, 0, 4, 4, 10, 'bld_hc_i'), R('room_hc_cellar', 20, 0, 3, 3, -10, 'bld_hc_i'), B('bld_hc_i'),
    { ...R('room_hc_under', 5, 0, 3, 2, -10, 'bld_hc_u') }, B('bld_hc_u'));
  const ids = (s) => [...s].sort().join(',');
  ok('numbering: 10 ft is lv 2 wherever it is, 9 ft lv 1, -10 ft lv -1', HT.levelLabel(HT.levelAt(10)) === 'lv 2' && HT.levelAt(9) === 0 && HT.levelLabel(HT.levelAt(-10)) === 'lv -1' && HT.levelAt(-1) === -1);
  ok('the shrine on the 10-ft hill IS lv 2 (levelOf), and a ground storey (it meets the ground: meetsGround)', HT.levelOf(E, E.room_hc_shrine) === 1 && HT.meetsGround(E, E.room_hc_shrine) && !HT.meetsGround(E, E.room_hc_shrup), HT.levelOf(E, E.room_hc_shrine));
  ok('a pawn in the shrine is on lv 2 (floorUnder level; storey is that level\'s number, 1, since 2026-10-26)', HT.floorUnder(E, 17.5, 17.5, 10).level === 'lv 2' && HT.floorUnder(E, 17.5, 17.5, 10).storey === 1, HT.floorUnder(E, 17.5, 17.5, 10));
  ok('ground contact: the shrine meets the ground at the hilltop; no fog default of an upper storey', HT.fogDefault(E, E.room_hc_shrine) === null && HT.fogDefault(E, E.room_hc_shrup) === 0);
  let C = HT.cutRooms(E, 9);
  ok('lv 1 (cut 9): the shrine stands clear, WHOLE (both storeys); the inn upstairs is hidden', ids(C.clear) === 'room_hc_shrine,room_hc_shrup' && ids(C.hidden) === 'room_hc_innup', [ids(C.clear), ids(C.hidden)]);
  C = HT.cutRooms(E, 19);
  ok('lv 2 (cut 19): on the hilltop\'s own level the shrine\'s upper storey is hidden over its ground storey; nothing stands clear', ids(C.hidden) === 'room_hc_shrup' && C.clear.size === 0, [ids(C.clear), ids(C.hidden)]);
  C = HT.cutRooms(E, -1);
  ok('lv -1 (cut -1): everything above the ground is hidden, on the open ground and on the hill', ids(C.hidden) === 'room_hc_inn,room_hc_innup,room_hc_shrine,room_hc_shrup' && C.clear.size === 0, ids(C.hidden));
  ok('all levels: nothing hidden', HT.cutRooms(E, null).hidden.size === 0);
  ok('a hill is never hidden by the cut, at any level', [-11, -1, 9, 19, 29].every(c => !HT.cutRooms(E, c).hidden.has('room_hc_hill')));
  // what stands on things, by its base
  const hb = (y, room, c) => HT.cutHidesBase(E, { y, room }, c);
  ok('a pawn on the hilltop shows at lv 1 and lv 2, hides at lv -1 (with everything on the open ground)', !hb(10, 'room_hc_hill', 9) && !hb(10, 'room_hc_hill', 19) && hb(10, 'room_hc_hill', -1) && hb(0, null, -1));
  ok('a pawn in the shrine shows at lv 1 (it stands clear), one upstairs in the inn hides at lv 1', !hb(10, 'room_hc_shrine', 9) && !hb(20, 'room_hc_shrup', 9) && hb(10, 'room_hc_innup', 9) && hb(20, 'room_hc_shrup', 19));
  // a building on the open ground: exactly the old rule, { y > cut }, at every cut (hills elsewhere or not)
  const gen = []; for (let b = 0; b < 6; b++) { const x = 40 + b * 12, h = 1 + (b % 3); gen.push(B('bld_g' + b)); for (let s = -1; s < h; s++) gen.push(R(`room_g${b}_${s + 1}`, x, b % 2 ? 2 : 30, 4 + (b % 2), 4, s * 10, 'bld_g' + b)); }
  const G = { ...E, ...Object.fromEntries(gen.map(e => [e.id, e])) };
  const same = [-21, -11, -1, 9, 19, 29, 39].every(c => gen.filter(e => e.kind === 'room').every(r => HT.cutRooms(G, c).hidden.has(r.id) === ((r.recipe.y || 0) > c)));
  ok('six buildings on open ground: hidden at every cut exactly as before (floor above the cut)', same);
  // a lid would be: a hilltop building over a room you can see. Dug in at the ground, a separate building on the hilltop half over it
  const L = ents(hill('room_hc_h2', 0, 0, 8, 8), R('room_hc_dug', 2, 2, 3, 3, 0, 'bld_hc_d'), B('bld_hc_d'), R('room_hc_top', 4, 2, 3, 3, 10, 'bld_hc_t'), R('room_hc_topup', 4, 2, 3, 3, 20, 'bld_hc_t'), B('bld_hc_t'), R('room_hc_far', 0, 6, 2, 2, 10, 'bld_hc_f'), B('bld_hc_f'));
  C = HT.cutRooms(L, 9);
  ok('lv 1: a hilltop building half over a dug-in room in view is cut away whole (no lid); one only over earth stands clear', ids(C.hidden) === 'room_hc_top,room_hc_topup' && ids(C.clear) === 'room_hc_far', [ids(C.hidden), ids(C.clear)]);
  // (2026-10-27) A ROOM BELOW THE GROUND NEVER CHANGES THE HILL (Harry: "Rooms _under_ the ground level shouldn't change
  // the shape of the hill"): no cutter, the same field sample for sample, the same tops, the same dressing
  ok('cuttersOf: a room below the ground is no cutter (it does not take the hill)', !cuttersOf(E).some(c => c.id === 'room_hc_under') && !cuttersOf(E, ['room_hc_shrine']).some(c => c.id === 'room_hc_under'));
  { const { room_hc_under, bld_hc_u, ...noCellar } = E, A = terrainOf(E), Z = terrainOf(noCellar), FA = A.fields[0], FZ = Z.fields[0];
    ok('the field over the cellar under the hill is the field without it, sample for sample (heights, tops, cut)', FA.h.length === FZ.h.length && FA.h.every((v, k) => v === FZ.h[k]) && FA.top.every((v, k) => v === FZ.top[k]) && FA.cut.every((v, k) => v === FZ.cut[k]));
    ok('...the hilltop over it stands at 10 ft, whole, and the key is the same (nothing is built again for it)', Math.abs(A.heightAt(32.5, 5) - 10) < 1e-6 && terrainKey(E).key === terrainKey(noCellar).key);
    const dA = JSON.stringify(dressingOf(FA, BANKS, { seed: 3 })), dZ = JSON.stringify(dressingOf(FZ, BANKS, { seed: 3 }));
    ok('...and its dressing is the same rocks and bushes', dA === dZ && dA.length > 2);
    ok('...nor at a view that hides the rooms above the ground (lv -1)', terrainKey(E, BANKS, ['room_hc_shrine', 'room_hc_shrup', 'room_hc_inn', 'room_hc_innup']).key === terrainKey(noCellar, BANKS, ['room_hc_shrine', 'room_hc_shrup', 'room_hc_inn', 'room_hc_innup']).key);
    ok('...and the hilltop over it is not taken (a pawn and the pointer find the hill there)', !HT.terrainTakenAt(E, E.room_hc_hill, 32.5, 5) && HT.terrainTopAt(E, 32.5, 5) === 10, HT.terrainTopAt(E, 32.5, 5)); }
  ok('a room the cut hides takes nothing from the hill (cuttersOf hidden): the shrine is a cutter, hidden it is not', cuttersOf(E).some(c => c.id === 'room_hc_shrine') && !cuttersOf(E, ['room_hc_shrine']).some(c => c.id === 'room_hc_shrine'));
  ok('the hidden key differs (the field is built again only when the hidden set changes)', terrainKey(E).key !== terrainKey(E, BANKS, ['room_hc_shrine']).key && terrainKey(E, BANKS, []).key === terrainKey(E).key);
}
// (2026-10-27) House look ▸ Hills below ground: see-through is a campaign setting, a number from 0 to 1
{ const { settingsProblem, CAMPAIGN_KEYS } = await import('../core/state.js');
  ok('hillSee and groundSee: 0, 0.25 and 1 are fine; 1.5, -0.1, "0.2" and NaN are refused; null resets it', ['hillSee', 'groundSee'].every(k => [0, 0.25, 1, null].every(v => !settingsProblem({ [k]: v }, CAMPAIGN_KEYS)) && [1.5, -0.1, '0.2', NaN].every(v => !!settingsProblem({ [k]: v }, CAMPAIGN_KEYS))));
  // (2026-11-03) and House look ▸ Above the ground: underground shows
  ok('underSee: the same kind (0 to 1, null resets it)', [0, 0.15, 1, null].every(v => !settingsProblem({ underSee: v }, CAMPAIGN_KEYS)) && [1.5, -0.1, '0.2', NaN].every(v => !!settingsProblem({ underSee: v }, CAMPAIGN_KEYS))); }
console.log(`terrain: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
