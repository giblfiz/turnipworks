// node test/hillbuild.test.mjs : BUILDING ON AND INTO HILLS (2026-10-24; Harry: "I just dropped in a hill ... but wouldn't
// let me build on top of it!", then: "The hill slope should not push thru walls. Existing (and new) rooms should trump
// hill slope, so that they can have a 'dug out' look"). docs/VERTICAL.md "Hills" (Building on a hill). The rules:
// core/height.js (roomClash, supportAt, terrainTakenAt, hillUnder, meetsGround (per room since 2026-10-26; it was hillBaseOf, per building), levelY, baseUnder, sightLevel) and the
// bank's cut at a room's outline (core/terrain.js cuttersOf, buildField).
import { terrainOf, terrainKey, cuttersOf } from '../core/terrain.js';
import * as HT from '../core/height.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CampaignRuntime } from '../relay/campaign.js';
import { makeTokens } from '../relay/tokens.js';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got ?? ''); } else console.log('ok  ', name, got ?? ''); };
const hill = (id, x, z, w, d, y = 10) => ({ id, kind: 'room', recipe: { type: 'hill', x, z, w, d, y, seed: 1, wallSeed: 8, floor: 'floor-grass' }, building: null, order: 1 });
const room = (id, x, z, w, d, y = 0, building = 'bld_' + id) => ({ id, kind: 'room', recipe: { type: 'common', x, z, w, d, seed: 3, wallSeed: 9, ...(y && { y }) }, building, order: 2 });
const bld = (id) => ({ id, kind: 'building', name: id });
const ents = (...es) => Object.fromEntries(es.map(e => [e.id, e]));

// 1. A SHRINE ON THE HILLTOP: a room at the hill's top, wholly on it
const H = hill('room_hill', 0, 0, 8, 8);
let E = ents(H);
ok('no clash: a room ON the hill top', !HT.roomClash(E, { type: 'common', x: 2, z: 2, w: 3, d: 3, y: 10 }, [10, 20]));
ok('the hill carries a room at its top (supportAt)', HT.supportAt(E, 10).any && HT.supportAt(E, 10).ok(3, 3));
ok('a room on the hill top needs nothing more (supportProblem null)', HT.supportProblem(E, { x: 2, z: 2, w: 3, d: 3 }, 10) === null, HT.supportProblem(E, { x: 2, z: 2, w: 3, d: 3 }, 10));
ok('a hill still carries nothing ABOVE its top', !HT.supportAt(E, 20).any);
E = ents(H, room('room_shrine', 2, 2, 3, 3, 10, 'bld_s'), bld('bld_s'));
ok('the ground it stands on is the hill top (hillUnder 10)', HT.hillUnder(E, E.room_shrine.recipe) === 10);
ok('it meets the ground at the hill top (meetsGround: its door, no stair offer, fog defaults), and on the map it is lv 2 (one numbering for the map, 2026-10-26)', HT.meetsGround(E, E.room_shrine) && HT.levelLabel(HT.levelOf(E, E.room_shrine)) === 'lv 2' && HT.fogDefault(E, E.room_shrine) === null);
ok('its sight level is the outdoor surface, 0 (levelY: sight and fog of war treat it as a ground storey; the cut does not)', HT.levelY(E, E.room_shrine) === 0);
ok('a building base set before 2026-10-26 is read nowhere (universal levels)', HT.meetsGround({ ...E, bld_s: { ...E.bld_s, base: 0, storey: 15 } }, E.room_shrine) && HT.roomHeight(E, E.room_shrine) === 10);
ok('no supports under a room wholly on the hill', HT.supportPlan(E, E.room_shrine).posts.length === 0 && HT.supportPlan(E, E.room_shrine).brackets.length === 0);
ok('the hill top is TAKEN where the shrine stands, not beside it', HT.terrainTakenAt(E, H, 17.5, 17.5) && !HT.terrainTakenAt(E, H, 32.5, 32.5));
ok('the hill top is still where the hill tool starts beside the shrine, not on it', HT.terrainTopAt(E, 32.5, 32.5) === 10 && HT.terrainTopAt(E, 17.5, 17.5) === 0);
// pawns
ok('a pawn in the shrine stands on its floor (10), in the shrine', (() => { const b = HT.baseUnder(E, 17.5, 17.5, 10, () => false); return b.y === 10 && b.room === 'room_shrine'; })(), HT.baseUnder(E, 17.5, 17.5, 10, () => false));
ok('floorUnder in the shrine is the shrine, not the hill', HT.floorUnder(E, 17.5, 17.5, 10)?.room === 'room_shrine');
ok('a pawn on the hilltop beside it stands on the hill', HT.baseUnder(E, 35, 35, 10, () => true).room === 'room_hill');
ok('sight: the pawn in the shrine and the pawn on the hilltop are on one level (0), as in a ground building beside a yard', HT.sightLevel(E, 17.5, 17.5, 10, () => false) === 0 && HT.sightLevel(E, 35, 35, 10, () => true) === 0);
ok('a flyer high over the hill rests its base on the hill top (a hill has no top above its floor)', HT.baseUnder(E, 35, 35, 30, () => false).y === 10);
// a storey on the shrine
E = ents(H, room('room_shrine', 2, 2, 3, 3, 10, 'bld_s'), room('room_loft', 2, 2, 3, 3, 20, 'bld_s'), bld('bld_s'));
ok('a storey on the shrine is lv 3 of the map, an upper storey: it sees at its own height (levelY 20), no ground fog, no door', !HT.meetsGround(E, E.room_loft) && HT.levelLabel(HT.levelOf(E, E.room_loft)) === 'lv 3' && HT.levelY(E, E.room_loft) === 20 && HT.fogDefault(E, E.room_loft) === 0);
ok('the storey is carried by the shrine below it', HT.supportProblem(E, { x: 2, z: 2, w: 3, d: 3 }, 20) === null);

// 2. PARTLY ON THE HILL: the rule is the storeys' own overhang rule (a hill is the "room below")
E = ents(H);
ok('overhanging the hill edge by 10 ft is carried (a jetty, posts)', HT.supportProblem(E, { x: 6, z: 2, w: 4, d: 3 }, 10) === null, HT.supportProblem(E, { x: 6, z: 2, w: 4, d: 3 }, 10));
ok('overhanging by 15 ft is refused, and says so', /overhang the rooms \(or the hill\) below it by at most 10 ft/.test(HT.supportProblem(E, { x: 6, z: 2, w: 5, d: 3 }, 10) || ''), HT.supportProblem(E, { x: 6, z: 2, w: 5, d: 3 }, 10));
ok('wholly off the hill at 10 ft: nothing to stand on', /nothing to stand on/.test(HT.supportProblem(E, { x: 12, z: 2, w: 2, d: 2 }, 10) || ''));
E = ents(H, room('room_jetty', 6, 2, 4, 3, 10, 'bld_j'), bld('bld_j'));
const SP = HT.supportPlan(E, E.room_jetty);
ok('the overhang gets the storeys\' supports: brackets one out, posts two out', SP.brackets.length > 0 && SP.posts.length > 0, [SP.brackets.length, SP.posts.length]);
ok('its posts stand on the ground below the overhang (y0 0)', SP.posts.every(p => p.y0 === 0), SP.posts.map(p => p.y0));
ok('a room half on the hill still meets the ground at its top (it stands on the hill)', HT.meetsGround(E, E.room_jetty));
// straddling two hills
const H2 = hill('room_hill2', 8, 0, 4, 8, 15);
E = ents(H, H2);
ok('straddling a 10-ft and a 15-ft hill at 10 ft: carried (on one, dug into the other)', HT.supportProblem(E, { x: 6, z: 2, w: 4, d: 3 }, 10) === null);
E = ents(H, H2, room('room_str', 6, 2, 4, 3, 10, 'bld_t'), bld('bld_t'));
ok('...its ground is 10: it meets the ground', HT.hillUnder(E, E.room_str.recipe) === 10 && HT.meetsGround(E, E.room_str));
ok('...the 15-ft hill\'s top is taken where it is dug in', HT.terrainTakenAt(E, H2, 42.5, 17.5) && !HT.terrainTakenAt(E, H2, 52.5, 17.5));
E = ents(H, H2);
ok('at 15 ft on the higher hill it may overhang the lower one by 10 ft', HT.supportProblem(E, { x: 6, z: 2, w: 4, d: 3 }, 15) === null);

// 3. DUG INTO THE HILL: a room at the ground under a hill
E = ents(H);
ok('no clash: a ground room inside the hill', !HT.roomClash(E, { type: 'common', x: 2, z: 2, w: 3, d: 3 }, [0, 10]));
ok('no clash: a hill drawn over a ground room', !HT.roomClash(ents(room('room_dug', 2, 2, 3, 3)), { type: 'hill', x: 0, z: 0, w: 8, d: 8, y: 10 }, [10, 20]));
ok('two hills at the same height still clash', !!HT.roomClash(E, { type: 'hill', x: 3, z: 3, w: 2, d: 2, y: 10 }, [10, 20]));
E = ents(H, room('room_dug', 2, 2, 3, 3, 0, 'bld_d'), bld('bld_d'));
ok('a dug-in room is a ground storey (it meets the ground, lv 1, levelY 0)', HT.meetsGround(E, E.room_dug) && HT.levelOf(E, E.room_dug) === 0 && HT.levelY(E, E.room_dug) === 0);
ok('a pawn inside it stands on its floor, not on the hilltop above it', (() => { const b = HT.baseUnder(E, 17.5, 17.5, 0, () => false); return b.y === 0 && b.room === 'room_dug'; })(), HT.baseUnder(E, 17.5, 17.5, 0, () => false));
ok('and one dropped at 10 ft over it does not stand on the cut-away hill top (it is on the room\'s top)', HT.baseUnder(E, 17.5, 17.5, 10, () => true).y === 0 && HT.baseUnder(E, 17.5, 17.5, 10, () => true).room === 'room_dug');
ok('a cellar under the hill takes nothing (the hill is whole over it)', !HT.terrainTakenAt(ents(H, room('room_cel', 2, 2, 3, 3, -10)), H, 17.5, 17.5));
ok('a room above the hill top takes nothing', !HT.terrainTakenAt(ents(H, room('room_up', 2, 2, 3, 3, 20)), H, 17.5, 17.5));

// 4. THE BANK IS CUT AT A ROOM'S OUTLINE (the unit test Harry's note asked for)
const T0 = terrainOf(ents(H)); // the hill alone
const inside = (T, x0, z0, x1, z1, step = 0.25) => { let hi = -1e9; for (let z = z0; z <= z1 + 1e-9; z += step) for (let x = x0; x <= x1 + 1e-9; x += step) hi = Math.max(hi, T.heightAt(x, z)); return hi; };
// a room dug in across the hill's east edge, at the ground: cells x 6..9, z 2..4 (feet 30..50 x 10..25)
const dug = room('room_dug', 6, 2, 4, 3, 0, 'bld_d');
let T = terrainOf(ents(H, dug, bld('bld_d')));
ok('before: the hill rises over those squares', inside(T0, 30, 10, 50, 25) > 9.9, inside(T0, 30, 10, 50, 25));
ok('dug in: nothing of the hill rises inside the room\'s outline (the bank\'s height there is its floor, 0)', inside(T, 30, 10, 50, 25) <= 1e-6, inside(T, 30, 10, 50, 25));
ok('the earth meets the wall\'s outer face at its own height (half a foot out, inside the hill: still the top)', Math.abs(T.heightAt(29.5, 17.5) - 10) < 1e-6 && Math.abs(T.heightAt(35, 9.5) - 10) < 1e-6, [T.heightAt(29.5, 17.5), T.heightAt(35, 9.5)]);
ok('the bank beside the room is untouched further off', Math.abs(T.heightAt(42, 30) - T0.heightAt(42, 30)) < 1e-6 && Math.abs(T.heightAt(15, 15) - 10) < 1e-6);
// a room beside the hill (its bank lies where the room is)
const side = room('room_side', 8, 2, 3, 3, 0, 'bld_e');
ok('a room beside the hill: the bank would lie on its floor', inside(T0, 41, 11, 54, 24) > 2, inside(T0, 41, 11, 54, 24));
T = terrainOf(ents(H, side, bld('bld_e')));
ok('...and is cut away inside it (nothing above its floor)', inside(T, 40, 10, 55, 25) <= 1e-6, inside(T, 40, 10, 55, 25));
ok('...while the earth outside its west wall is banked up against it', T.heightAt(39.5, 17.5) > 5, T.heightAt(39.5, 17.5));
// order does not matter: the field is worked out from the rooms, never from history
const A = terrainOf(ents(dug, H, bld('bld_d'))), B = terrainOf(ents(H, dug, bld('bld_d')));
ok('room first or hill first: the same ground, sample for sample', A.fields.length === 1 && A.fields[0].h.every((v, k) => v === B.fields[0].h[k]));
// a room ON the hill does not change the hill
T = terrainOf(ents(H, room('room_shrine', 2, 2, 3, 3, 10, 'bld_s'), bld('bld_s')));
ok('a shrine on the top changes nothing of the ground', T.fields[0].h.every((v, k) => v === T0.fields[0].h[k]));
// a cellar does not cut it
T = terrainOf(ents(H, room('room_cel', 2, 2, 3, 3, -10)));
ok('a cellar under the hill cuts nothing', T.fields[0].h.every((v, k) => v === T0.fields[0].h[k]));
// the key: a room far from every hill does not touch it
ok('a room far from the hill leaves the terrain key alone', terrainKey(ents(H)).key === terrainKey(ents(H, room('room_far', 60, 60, 2, 2))).key);
ok('a room in the hill changes it', terrainKey(ents(H)).key !== terrainKey(ents(H, dug)).key);
ok('cuttersOf: a room below the ground is no cutter, even one tall enough to reach above it (2026-10-27: a cellar never changes the hill)', cuttersOf(ents(H, room('room_tall', 2, 2, 2, 2, -10))).length === 0 && cuttersOf(ents(H, { ...room('room_tc', 2, 2, 2, 2, -10), recipe: { ...room('room_tc', 2, 2, 2, 2, -10).recipe, tall: 2 } })).length === 0);
{ const tc = { ...room('room_tc', 2, 2, 2, 2, -10), recipe: { ...room('room_tc', 2, 2, 2, 2, -10).recipe, tall: 2 } }, E2 = ents(H, tc), T2 = terrainOf(E2);
  ok('...a tall cellar under the hill: the field is the hill alone\'s, sample for sample, and the hilltop over it is not taken', T2.fields[0].h.every((v, k) => v === T0.fields[0].h[k]) && !HT.terrainTakenAt(E2, H, 12.5, 12.5) && HT.terrainTakers(E2).length === 0); }
// dressing never on a room's floor (the keepOut is the client's; the field itself has no bank there)
const F = terrainOf(ents(H, dug, bld('bld_d'))).fields[0];
let bankIn = 0; for (let z = 10.5; z < 25; z += 0.5) for (let x = 30.5; x < 50; x += 0.5) if (F.sample(F.h, x, z) - F.sample(F.cell, x, z) > 0.004) bankIn++;
ok('no bank sample inside the dug-in room (no triangle is drawn there)', bankIn === 0, bankIn);

// 5. THROUGH THE RELAY: both orders, and undo restores the bank exactly
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-hillbuild-')), tokens = makeTokens('hillbuild-tests');
const { rt, gmSeat: gm } = CampaignRuntime.create({ id: 'cmp_hillb0001', dir, name: 'TEST hillbuild (throwaway)', gmName: 'GM', tokens });
const area = rt.state.areaOrder[0], run = (type, args = {}) => rt.dispatch(gm, { type, args, area });
const Ent = () => rt.state.areas[area].entities, NOLAY = { hash: 'x', summary: '', objects: [] };
let r = run('room.spawn', { id: 'room_first001', type: 'common', x: 20, z: 0, w: 3, d: 3, seed: 2, building: 'bld_first001', buildingName: 'First', layout: NOLAY });
ok('a ground room first', r.ok, r.why);
r = run('room.spawn', { id: 'room_hillr001', type: 'hill', x: 18, z: -2, w: 7, d: 7, y: 10, seed: 5, layout: NOLAY });
ok('then a hill over it: allowed (rooms trump the hill)', r.ok, r.why);
ok('...nothing of the hill inside the room', inside(terrainOf(Ent()), 100, 0, 115, 15) <= 1e-6, inside(terrainOf(Ent()), 100, 0, 115, 15));
r = run('room.spawn', { id: 'room_shrine01', type: 'common', x: 18, z: 3, w: 2, d: 2, y: 10, seed: 2, building: 'bld_shrine01', buildingName: 'Shrine', layout: NOLAY });
ok('a room on the hill top (the relay accepts it)', r.ok, r.why);
ok('...it meets the ground (a ground storey) on lv 2', HT.meetsGround(Ent(), Ent().room_shrine01) && HT.levelOf(Ent(), Ent().room_shrine01) === 1);
r = run('room.spawn', { id: 'room_float01', type: 'common', x: 40, z: 0, w: 2, d: 2, y: 10, seed: 2, building: 'bld_shrine01', layout: NOLAY });
ok('a room at the shrine\'s height far off the hill is still refused (nothing to stand on)', !r.ok && /nothing to stand on|overhang/.test(r.why || ''), JSON.stringify(r).slice(0, 300));
const before = terrainOf(Ent()).fields[0].h.slice();
r = run('room.spawn', { id: 'room_dug0001', type: 'common', x: 23, z: 3, w: 2, d: 3, seed: 2, building: 'bld_dug0001', buildingName: 'Dug', layout: NOLAY });
ok('a hill first, then a room dug into its edge', r.ok, r.why);
ok('...nothing of the hill inside it', inside(terrainOf(Ent()), 115, 15, 125, 30) <= 1e-6, inside(terrainOf(Ent()), 115, 15, 125, 30));
ok('undo: the bank is back exactly as it was', run('undo').ok && !Ent().room_dug0001 && terrainOf(Ent()).fields[0].h.every((v, k) => v === before[k]));
ok('redo: cut again', run('redo').ok && inside(terrainOf(Ent()), 115, 15, 125, 30) <= 1e-6);
r = run('room.move', { id: 'room_dug0001', dx: 0, dz: 3, dy: 0 });
ok('moving the room: the cut follows it (the old place has its bank back)', r.ok && inside(terrainOf(Ent()), 115, 30, 125, 45) <= 1e-6 && terrainOf(Ent()).heightAt(117.5, 17.5) > 1, [r.why, terrainOf(Ent()).heightAt(117.5, 17.5)]);
r = run('room.delete', { id: 'room_dug0001' });
ok('deleting it: the bank is whole again', r.ok && terrainOf(Ent()).fields[0].h.every((v, k) => v === before[k]), r.why);
rt.close(); fs.rmSync(dir, { recursive: true, force: true });

console.log(`hillbuild: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
