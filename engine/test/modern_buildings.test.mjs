// node test/modern_buildings.test.mjs : THE MODERN GENRE IS BUILDINGS (Harry 2026-11-07: "under modern I think 'types' is
// split at the wrong level... types should be kinds of *building* not kinds of sub-genre (look at how fantasy got done)";
// and "we basically don't need to distinguish between cyberpunk and modern now"). engine/tools/modern_buildings.json maps
// each modern room to its buildings; engine/tools/build_types.py writes them into client/data/types.json.
//   types     the Modern genre's types are exactly the map's buildings, in its order: no City, no Cyberpunk, no MOD / CYB
//   rooms     EVERY modern room (a room whose recipes carry a modern catalog code: mod-, cyb-) is in at least one building;
//             every room the map names exists; no building has fewer than two rooms; types.json says what the map says
//             (else: run python3 engine/tools/build_types.py)
//   tree      the Build tray's taxonomy (client/taxonomy.js): Modern ▸ the buildings ▸ their rooms, hub first
//   objects   a room's things follow it: a building's roles are the modern roles its rooms name (the capsule pod is in the
//             Apartment block, not the Bar); none of a building's rooms is shelved without its own things
//   halls     each building names its corridor (`hall`); the Apartment block's and the Office tower's plans lay THAT room
//             as the spine (modhalls lane, 2026-11-07), and a corridor a building lists but did not name is no leaf room
//   build     each building drags out as a whole building (the tuner's js/buildings.js): built round its hub, every room
//             a real room type; an old saved building's code (MOD, CYB) re-rolls as the map's `legacy` building
import fs from 'node:fs';
import { buildTaxonomy } from '../client/taxonomy.js';
import { SOLVER_OPTS } from '../core/roomgen.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import * as B from '../../tools/spawn-tuner/js/buildings.js';
import * as W from '../../tools/spawn-tuner/js/walls.js';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got ?? ''); } else console.log('ok  ', name, got ?? ''); };
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const MB = read('../tools/modern_buildings.json'), TY = read('../client/data/types.json'), rooms = read('../tuner-data/rooms.json');
const lib = read('../tuner-data/library.json'), spawns = read('../client/data/library-spawns.json');
const roomOf = new Map(rooms.map(r => [r.key, r]));

// ---- types
const modern = TY.types.filter(t => t.genre === 'modern');
ok('the Modern genre\'s types are the map\'s buildings, in its order', JSON.stringify(modern.map(t => t.code)) === JSON.stringify(MB.buildings.map(b => b.code)), modern.map(t => `${t.code} ${t.label}`).join(', '));
ok('no type is City or Cyberpunk, nor the catalog codes MOD / CYB', !TY.types.some(t => MB.replaces.includes(t.code) || /^(city|cyberpunk)$/i.test(t.label)));
ok('6 to 10 buildings (fantasy-sized)', MB.buildings.length >= 6 && MB.buildings.length <= 10, MB.buildings.length);
ok('building codes are unique and none is a catalog setting code or a room recipe prefix', new Set(MB.buildings.map(b => b.code)).size === MB.buildings.length && !MB.buildings.some(b => rooms.some(r => r.recipes.some(x => x.startsWith(b.code.toLowerCase() + '-')))) && !MB.buildings.some(b => TY.types.some(t => t.genre !== 'modern' && t.code === b.code)));

// ---- rooms
const modernPrefix = MB.replaces.map(c => c.toLowerCase() + '-');
const modernRooms = rooms.filter(r => r.recipes.some(x => modernPrefix.some(p => x.startsWith(p)))).map(r => r.key);
const unmapped = modernRooms.filter(k => !MB.rooms[k]?.length);
ok('EVERY modern room is in at least one building (a new room: one line in engine/tools/modern_buildings.json `rooms`)', !unmapped.length, unmapped.join(', ') || `${modernRooms.length} modern rooms`);
const ghosts = Object.keys(MB.rooms).filter(k => !roomOf.has(k));
ok('every room the map names is a room type (rooms.json)', !ghosts.length, ghosts.join(', '));
const badCode = Object.entries(MB.rooms).filter(([, bs]) => bs.some(c => !MB.buildings.some(b => b.code === c)));
ok('every building a room names is in the map\'s buildings', !badCode.length, badCode.map(([k]) => k).join(', '));
for (const b of MB.buildings) {
  const t = modern.find(x => x.code === b.code), mine = Object.keys(MB.rooms).filter(k => MB.rooms[k].includes(b.code));
  ok(`${b.label}: at least two rooms (a one-room building is a smell)`, mine.length >= 2, mine.join(', '));
  ok(`${b.label}: types.json lists its rooms, hub first (else run engine/tools/build_types.py)`, t && JSON.stringify(t.rooms) === JSON.stringify([b.hub, ...mine.filter(k => k !== b.hub)].filter(Boolean)), t?.rooms);
  ok(`${b.label}: its hub is one of its rooms`, !b.hub || mine.includes(b.hub), b.hub);
}

// ---- tree
const usable = (k) => solver.skuUsable(k, SOLVER_OPTS);
const X = buildTaxonomy({ lib, roomTypes: rooms, data: TY, usable, spawns });
const g = X.get('g:modern');
ok('the Build tray: Modern ▸ the buildings', g && JSON.stringify(g.children.map(id => X.get(id).label)) === JSON.stringify(MB.buildings.map(b => b.label)), g?.children.map(id => X.get(id).label));
for (const b of MB.buildings) {
  const tn = X.get(`t:${b.code}`), want = TY.types.find(t => t.code === b.code)?.rooms || [];
  ok(`${b.label} ▸ its rooms, in the map's order`, tn && !tn.disabled && JSON.stringify(tn.children.map(id => X.get(id).roomKey)) === JSON.stringify(want), tn?.children.map(id => X.get(id).label));
}
const reached = new Set(g.children.flatMap(tid => X.get(tid).children.map(id => X.get(id).roomKey)));
ok('every modern room is reachable in the tray', modernRooms.every(k => reached.has(k)), modernRooms.filter(k => !reached.has(k)).join(', '));
ok('a room in two buildings is in the tray under each (the menu\'s symlinks)', !!X.get('r:APT:cyb-rooftop') && !!X.get('r:OFC:cyb-rooftop') && !!X.get('r:APT:cyb-safehouse') && !!X.get('r:HID:cyb-safehouse'));

// ---- objects follow their rooms
const roles = (code) => new Set(TY.types.find(t => t.code === code)?.roles || []);
ok('the capsule pod is in the Apartment block (the capsule hotel), not the Bar', roles('APT').has('capsule-pod') && !roles('BAR').has('capsule-pod'));
ok('the server rack is in the Office tower, not the Storefronts', roles('OFC').has('server-rack') && !roles('SHP').has('server-rack'));
ok('the surgical chair is in the Storefronts (the street clinic)', roles('SHP').has('surgical-chair'));
for (const b of MB.buildings) for (const tid of [`t:${b.code}`]) for (const rid of X.get(tid).children) {
  const r = X.get(rid); ok(`${b.label} ▸ ${r.label}: its shelves hold its own things`, r.furniture.filter(f => !f.kit).length + r.objects.length >= 3, r.furniture.length + r.objects.length);
}

// ---- whole buildings
const typesOf = (code) => X.get(`t:${code}`).children.map(id => X.get(id)).map(r => ({ key: r.roomKey, cells: r.cells || [3, 3], outdoor: !!W.isOutdoor?.(r.roomKey) || roomOf.get(r.roomKey)?.program === 'outdoors' }));
const rolesOf = (b, types) => B.buildingRoles(W.ROLES, { hub: b.hub, hall: b.hall, rooms: types.map(t => t.key) }); // (as client/main.js rolesOf)
for (const b of MB.buildings) {
  const types = typesOf(b.code), P = B.programmeFor(b.code, types, rolesOf(b, types));
  ok(`${b.label}: a dragged building is built round its hub`, P.hub?.key === b.hub, P.hub?.key);
  for (const seed of [3, 11]) {
    const plan = B.generate({ code: b.code, rect: { x: 0, z: 0, w: 14, d: 11 }, seed, storeys: P.storeys.def, front: 'S', types, roles: rolesOf(b, types) });
    const inside = (plan?.rooms || []).filter(r => !r.outside);
    ok(`${b.label} seed ${seed}: the plan's rooms are its own room types`, inside.length >= 2 && (plan.rooms || []).every(r => types.some(t => t.key === r.type)), (plan?.rooms || []).map(r => r.type).join(','));
  }
}
// ---- corridors (modhalls lane, 2026-11-07: Harry "definitely modern hallways as well"): a building's `hall` is its own
// corridor room, and the generator's spine is THAT room, where a fantasy building has its hallway (before: the hub's own type
// was laid as the corridor: a row of "Apartment" rooms one cell wide). Every building names one; types.json carries it.
for (const b of MB.buildings) {
  ok(`${b.label}: names its corridor (hall), one of its rooms and a passage`, !!b.hall && Object.keys(MB.rooms).filter(k => MB.rooms[k].includes(b.code)).includes(b.hall) && W.ROLES[b.hall]?.role === 'passage', b.hall);
  ok(`${b.label}: types.json carries its hall (else run engine/tools/build_types.py)`, TY.types.find(t => t.code === b.code)?.hall === b.hall, TY.types.find(t => t.code === b.code)?.hall);
  ok(`${b.label}: the Build tray's type node knows its hall`, X.get(`t:${b.code}`)?.hall === b.hall);
}
for (const code of ['APT', 'OFC']) {
  const b = MB.buildings.find(x => x.code === code), types = typesOf(code); let halls = 0, wrong = [];
  for (const [w, d, storeys] of [[14, 11, 2], [20, 16, 1], [12, 8, 2], [24, 12, 3]]) for (const seed of [2, 9]) {
    const plan = B.generate({ code, rect: { x: 0, z: 0, w, d }, seed, storeys, front: 'S', types, roles: rolesOf(b, types) });
    for (const r of plan.rooms.filter(r => r.role === 'hall')) { halls++; if (r.type !== b.hall) wrong.push(r.type); }
  }
  ok(`${b.label}: the building generator lays its corridor (${b.hall}) as the spine`, halls > 0 && !wrong.length, `${halls} corridors${wrong.length ? `, ${wrong.length} of the wrong type: ${[...new Set(wrong)]}` : ''}`);
}
{ const b = MB.buildings.find(x => x.code === 'APT'), types = typesOf('APT'), P = B.programmeFor('APT', types, rolesOf(b, types));
  ok('the Apartment block\'s hotel corridor is in its tray but never laid as a room of a generated building', types.some(t => t.key === 'mod-hotel-corridor') && !P.rooms.some(r => r.key === 'mod-hotel-corridor') && P.hall === 'mod-apartment-hallway'); }
ok('an old saved building\'s code re-rolls: types.json `legacy` maps MOD and CYB to a modern building', MB.replaces.every(c => modern.some(t => t.code === TY.legacy?.[c])) && X.legacy?.MOD === TY.legacy.MOD, TY.legacy);

console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
