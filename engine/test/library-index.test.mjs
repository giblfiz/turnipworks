// node test/library-index.test.mjs : THE BUILD LIBRARY'S INDEX (2026-10-25; Harry: "They also might need to be re
// indexed, we have added some stuff."). docs/UI.md "Every placeable thing is on some library's shelves".
// On the tuner's own data (library.json, rooms.json; engine/client/data/types.json) and the code the browser runs
// (client/taxonomy.js, client/library-index.js, the room engine's catalog sizes), with the live ratings left out:
//   rooms       every room type the tuner has is a room of some type in the Build menu (else it has no library area)
//   its own     every room's library lists every thing its recipe slots name, and the members of its sets
//   sizes       every thing a library lists has a catalog size (library.js leaves out a thing with none, silently)
//   everything  every thing, kit piece, stair, floor and faction piece the command bar can place is in some library
//               area: a new asset no room lists, a new room type no type lists, or a new kind of hand-placed piece
//               fails here, by name
import fs from 'node:fs';
import { buildTaxonomy } from '../client/taxonomy.js';
import { libraryContents, handPlaceable, HAND_KIT, KIT_PIECES, ROOM_KIT, KIT_THINGS, isHandStair, isOpenState, isKitStateOrMaterial, placeOf, floorCats, kitSectionOf, poseOf } from '../client/library-index.js';
import { isFactionSlot, factionCatalog } from '../core/faction-catalog.js';
import { makeRoomGen, SOLVER_OPTS } from '../core/roomgen.js';
import * as walls from '../../tools/spawn-tuner/js/walls.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import * as solver2 from '../../tools/spawn-tuner/js/solver2.js';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got ?? ''); } else console.log('ok  ', name, got ?? ''); };
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const lib = read('../tuner-data/library.json'), rooms = read('../tuner-data/rooms.json'), orient = read('../tuner-data/orient.json'), data = read('../client/data/types.json'), spawns = read('../client/data/library-spawns.json');
const usable = (k) => solver.skuUsable(k, SOLVER_OPTS);
const roomgen = makeRoomGen({ walls, solver, solver2, lib, types: rooms, orient, version: 'library-index-test' });
const X = buildTaxonomy({ lib, roomTypes: rooms, data, usable, spawns });
const roomNodes = [...X.nodes.values()].filter(n => n.level === 'room');
const recipeOf = (key) => rooms.find(r => r.key === key) || { slots: {} };
const contents = new Map(roomNodes.map(n => [n.id, libraryContents(n, { lib, recipe: recipeOf(n.roomKey), usable })]));
const itemsOf = (id) => contents.get(id).flatMap(([, , list]) => list);
const short = (xs, k = 12) => xs.length > k ? `${xs.slice(0, k).join(', ')} … (${xs.length})` : xs.join(', ');

// ---- rooms: every tuner room type is in the Build menu
const keys = new Set(roomNodes.map(n => n.roomKey));
const noType = rooms.filter(r => !keys.has(r.key)).map(r => r.key);
ok('every room type the tuner has is a room of some type in the Build menu (so it has a library area)', !noType.length, noType.length ? `not listed: ${noType.join(', ')} (their recipes' prefixes name no type in engine/client/data/types.json)` : `${keys.size} room types, ${roomNodes.length} room nodes`);
ok('the hand-placed kit pieces exist in the library (a renamed piece fails here)', HAND_KIT.every(id => lib.objects[id]), HAND_KIT.filter(id => !lib.objects[id]).join(', '));
ok('a room listed under several types has one library: every node of it lists the same things', [...keys].every(k => { const ns = roomNodes.filter(n => n.roomKey === k).map(n => JSON.stringify(itemsOf(n.id))); return new Set(ns).size === 1; }));

// ---- its own: the recipe slots and the sets
const libItem = (id) => { const o = lib.objects[id]; return o && placeOf(o) !== 'kit' && !isOpenState(lib, id) && !isFactionSlot(id) && o.skus.some(k => (k.kind === 'flat' || k.bounds) && usable(k)); };
const slotMiss = [], setMiss = [];
for (const n of roomNodes) {
  const r = recipeOf(n.roomKey), have = new Set(itemsOf(n.id).map(it => it.cat));
  for (const [s, ids] of Object.entries(r.slots || {})) if (s !== 'sets') for (const id of ids) if (libItem(id) && !have.has(id)) slotMiss.push(`${n.roomKey}:${id}`);
  for (const sid of r.slots?.sets || []) for (const [id] of lib.sets?.[sid]?.members || []) if (libItem(id) && !have.has(id)) setMiss.push(`${n.roomKey}:${sid}/${id}`);
}
ok('every room\'s library lists every thing its recipe slots name', !slotMiss.length, short(slotMiss));
ok('... and every member of its recipe\'s sets (a bottle row, a crate stack)', !setMiss.length, short(setMiss));
const flavor = roomNodes.filter(n => recipeOf(n.roomKey).flavors?.length);
ok('a room that takes faction flavours shows every faction slot, the pillar and the corbel too', flavor.length > 0 && flavor.every(n => (lib.flavorSlots || []).every(id => !libItem(id) || itemsOf(n.id).some(it => it.cat === id))), `${flavor.length} rooms, slots ${(lib.flavorSlots || []).join(' ')}`);

// ---- sizes
const noSize = [];
for (const n of roomNodes) for (const it of itemsOf(n.id)) if (it.place !== 'tile' && !roomgen.sizeOf(it.cat, it.sku)) noSize.push(`${n.roomKey}:${it.cat}${it.sku ? '/' + it.sku : ''}`);
ok('every thing a library lists has a catalog size (none is left out of its picture)', !noSize.length, short([...new Set(noSize)]));

// ---- everything: the command bar's placeable things, each in some library area
const shown = new Set(), shownSku = new Set();
for (const n of roomNodes) for (const it of itemsOf(n.id)) { shown.add(it.cat); if (it.sku) shownSku.add(`${it.cat}|${it.sku}`); }
const all = handPlaceable(lib, usable);
const missing = all.filter(p => p.kind === 'faction' ? !shownSku.has(`${p.id}|${p.sku}`) : !shown.has(p.id));
const by = (k) => all.filter(p => p.kind === k).length;
ok('every thing, kit piece, stair, floor and faction piece a person can place is in some library area', !missing.length, missing.length ? `in none: ${short(missing.map(p => p.kind + ':' + p.id + (p.sku ? '/' + p.sku : '')), 40)}` : `${all.length} placeable (things ${by('thing')}, kit ${by('kit')}, stairs ${by('stair')}, floors ${by('floor')}, faction pieces ${by('faction')})`);
const stairsIn = roomNodes.filter(n => itemsOf(n.id).some(it => isHandStair(it.cat)));
ok('stairs are on the shelves (the menu says they are placed from the library)', stairsIn.length === roomNodes.length, `${stairsIn.length}/${roomNodes.length} libraries`);
const kitIn = roomNodes.filter(n => KIT_PIECES.every(id => itemsOf(n.id).some(it => it.cat === id)));
ok('every library has its walls, doors and windows', kitIn.length === roomNodes.length, `${kitIn.length}/${roomNodes.length}`);
const bare = (n) => n.furniture.filter(f => !f.kit).length + n.objects.length < 10; // (a room the GM furnishes by hand, the cave: its More shelves are its types' other rooms' things)
const more = roomNodes.filter(n => n.more?.length), moreIds = new Set(roomNodes.filter(n => !bare(n)).flatMap(n => (n.more || []).flatMap(m => m.ids)));
ok('the things no room\'s recipe lists are on the "More" shelves of the rooms of their types', moreIds.size > 0 && [...moreIds].every(id => !rooms.some(r => Object.entries(r.slots || {}).some(([s, ids]) => s !== 'sets' && ids.includes(id)))), `${moreIds.size} things, on ${more.length} room nodes' shelves`);
// a NEW asset that no recipe and no type's roles name: it is on the shelves anyway (every room's "More")
{
  const lib2 = { ...lib, objects: { ...lib.objects, 'test-new-turnip': { id: 'test-new-turnip', place: 'surface', size: [6, 6, 6], skus: [{ sku: 'test-new-turnip', kind: 'mesh', url: 'x.glb', bounds: [1, 1, 1] }] } } };
  const X2 = buildTaxonomy({ lib: lib2, roomTypes: rooms, data, usable, spawns });
  const with2 = [...X2.nodes.values()].filter(n => n.level === 'room' && libraryContents(n, { lib: lib2, recipe: recipeOf(n.roomKey), usable }).some(([, , l]) => l.some(it => it.cat === 'test-new-turnip')));
  ok('a new asset no recipe or role names lands on the shelves anyway ("More", in every room)', with2.length === roomNodes.length, `${with2.length}/${roomNodes.length}`);
}
const cave = roomNodes.find(n => n.roomKey === 'cave');
ok('the cave (no recipe things of its own: the GM furnishes it by hand) has its types\' rooms\' things on its shelves (it had 6 things, 2026-10-29)', cave && itemsOf(cave.id).filter(it => it.place !== 'kit' && it.place !== 'tile').length > 100, cave && `${itemsOf(cave.id).filter(it => it.place !== 'kit' && it.place !== 'tile').length} things, sections ${contents.get(cave.id).map(([, t]) => t).filter(t => t.startsWith('More')).join(', ')}`);


// ---- 2026-10-29 (Harry: "The objects feel sparse somehow, are we missing stuff?" ... "we should have all those faction
// objects anywhere they come up" ... "The wall/door count is fine, but they don't need their own sections by type")
// every kit piece is accounted for: a floor, the hand kit, a room's kit, a stair, a kit thing, or an open state / roof material
const drawable = (o) => o.skus.some(k => (k.kind === 'flat' || k.bounds) && usable(k));
const kitIds = Object.keys(lib.objects).filter(id => lib.objects[id].place === 'kit' && drawable(lib.objects[id]));
const floorsAll = new Set(floorCats(lib));
const unsorted = kitIds.filter(id => !floorsAll.has(id) && !HAND_KIT.includes(id) && !ROOM_KIT.includes(id) && !KIT_THINGS.includes(id) && !isHandStair(id) && !isKitStateOrMaterial(lib, id));
ok('every kit piece is placeable by hand (hand kit, a room\'s kit, a kit thing, a stair, a floor) or is an open state / roof material: a new kit piece fails here until it is sorted (library-index.js)', !unsorted.length, unsorted.length ? `unsorted: ${unsorted.join(', ')}` : `${kitIds.length} kit pieces`);
const placeableKit = kitIds.filter(id => !isKitStateOrMaterial(lib, id));
const shelvedKit = placeableKit.filter(id => shown.has(id)), placeableIds = new Set(all.map(p => p.id));
ok('every placeable kit piece is reachable from at least one shelf, and the command bar can place it', shelvedKit.length === placeableKit.length && placeableKit.every(id => placeableIds.has(id)), `${shelvedKit.length}/${placeableKit.length} on a shelf; not shelved: ${short(placeableKit.filter(id => !shown.has(id)))}; not placeable: ${short(placeableKit.filter(id => !placeableIds.has(id)))}`);
const kitMiss = [];
for (const n of roomNodes) { const r = recipeOf(n.roomKey), have = new Set(itemsOf(n.id).map(it => it.cat)); for (const [s, ids] of Object.entries(r.slots || {})) if (s !== 'sets') for (const id of ids) if ((ROOM_KIT.includes(id) || KIT_THINGS.includes(id)) && drawable(lib.objects[id] || { skus: [] }) && !have.has(id)) kitMiss.push(`${n.roomKey}:${id}`); }
ok('a room\'s own kit pieces are on its shelves (the crypt\'s niches, the stable\'s stalls, the common room\'s bar counter)', !kitMiss.length, kitMiss.length ? short(kitMiss) : `e.g. crypt-vault: ${itemsOf(roomNodes.find(n => n.roomKey === 'crypt-vault').id).filter(it => ROOM_KIT.includes(it.cat)).map(it => it.cat).join(', ')}`);
const notEverywhere = ['wall-crypt-niches', 'stable-stall', 'window-stained-glass'].filter(id => itemsOf(roomNodes.find(n => n.roomKey === 'common').id).some(it => it.cat === id));
ok('... and only where they belong: the common room has no crypt niches, stalls or stained glass', !notEverywhere.length, notEverywhere.join(', '));
// the kit: three sections at most (walls; doors and windows; stairs), every family's pieces in them, as many as before
const kitSecs = roomNodes.map(n => contents.get(n.id).filter(([k]) => k.startsWith('kit:')));
ok('the walls, doors and windows are in at most three sections (walls; doors & windows; stairs), not one per wall family', kitSecs.every(ss => ss.length <= 3 && ss.every(([k]) => ['kit:walls', 'kit:doors', 'kit:stairs'].includes(k))), [...new Set(kitSecs.flat().map(([k, t]) => t))].join(' | '));
const famsN = new Set((lib.objects['wall-straight'].skus || []).filter(k => k.bounds && usable(k)).map(k => k.family).filter(Boolean)).size;
const common = roomNodes.find(n => n.roomKey === 'common'), commonKit = itemsOf(common.id).filter(it => it.place === 'kit');
ok('... with every wall family\'s pieces still there (a wall in each family), each label naming its family', commonKit.filter(it => it.cat === 'wall-straight').length === famsN && commonKit.filter(it => it.cat === 'wall-straight').every(it => / · /.test(it.label)), `${commonKit.length} kit pieces in the common room, ${famsN} families`);
ok('... doors and windows in their section, walls in theirs', contents.get(common.id).every(([k, , l]) => !k.startsWith('kit:') || l.every(it => `kit:${kitSectionOf(it.cat)}` === k)));
// the things the rules put down (library-spawns.json), on the room's shelves; a few rooms solved again now, to catch a stale index
const spawnMiss = [];
for (const n of roomNodes) { const have = new Set(itemsOf(n.id).map(it => it.cat)); for (const id of spawns.rooms[n.roomKey] || []) { const c = isOpenState(lib, id) ? (lib.objects[id].open_of || id.slice(0, -5)) : id === 'banner-wall' ? id : id; if (lib.objects[c] && (libItem(c) || ROOM_KIT.includes(c)) && !have.has(c)) spawnMiss.push(`${n.roomKey}:${c}`); } }
ok('everything a room\'s rules put down (library-spawns.json) is on its shelves', Object.keys(spawns.rooms).length >= rooms.length - 2 && !spawnMiss.length, spawnMiss.length ? short(spawnMiss) : `${Object.keys(spawns.rooms).length} room types, ${Object.values(spawns.rooms).reduce((s, l) => s + l.length, 0)} spawned ids`);
{
  const fresh = [], keys = ['common', 'crypt-vault', 'lair-dragon', 'wiz-lab'];
  for (const key of keys) {
    const n = roomNodes.find(x => x.roomKey === key), have = new Set(itemsOf(n.id).map(it => it.cat)), r = recipeOf(key);
    for (const seed of [3, 4]) for (const o of roomgen.solve({}, { id: 'room_t', type: key, x: 0, z: 0, w: Math.ceil(r.cells[0] * (seed === 4 ? 1.5 : 1)), d: r.cells[1], seed }, 1).objects) {
      const c = isOpenState(lib, o.cat) ? (lib.objects[o.cat].open_of || o.cat.slice(0, -5)) : o.cat;
      if (!have.has(c) && (libItem(c) || ROOM_KIT.includes(c) || isFactionSlot(c))) fresh.push(`${key}:${c}`);
    }
  }
  ok('solved again now, those rooms put down nothing that is not on their shelves (else re-run engine/tools/library_spawns.mjs)', !fresh.length, fresh.length ? short([...new Set(fresh)]) : keys.join(', '));
}
// factions: wherever a faction piece comes up, every faction's piece for it, grouped under the faction
const facs = factionCatalog(lib).factions;
const hall = roomNodes.find(n => n.roomKey === 'great-hall'), hallBanners = itemsOf(hall.id).filter(it => it.cat === 'flavor-banner');
ok('the great hall (its rules hang wall banners, a faction mark) shows every faction\'s banner', hallBanners.length === facs.filter(f => f.slots['flavor-banner']).length, `${hallBanners.length} banners`);
const nave = roomNodes.find(n => n.roomKey === 'temple-nave'), naveSecs = contents.get(nave.id).filter(([k]) => k.startsWith('faction:'));
ok('the temple nave shows each faction\'s pieces under that faction, one section each', naveSecs.length === facs.length && naveSecs.every(([, t, l]) => /^Faction · /.test(t) && l.every(it => isFactionSlot(it.cat))), naveSecs.map(([, t, l]) => `${t.slice(10)} ${l.length}`).join(', '));
ok('... and no faction piece is mixed into its other sections', contents.get(nave.id).every(([k, , l]) => k.startsWith('faction') || l.every(it => !isFactionSlot(it.cat))));
// looks: every look of a thing (a plain chair and a fine one), not every re-generation of it
const chairs = itemsOf(common.id).filter(it => it.cat === 'chair-plain');
ok('a thing with several looks shows each look once (the plain chair: common and fine), not each re-generation', chairs.length === 2 && new Set(chairs.map(c => c.label)).size === 2, chairs.map(c => `${c.label} (${c.sku})`).join(', '));
// a thing whose name ends in "-open" but is no open state (an open book) is placeable and shelved
const opens = ['book-open', 'flour-sack-open', 'helm-open'].filter(id => lib.objects[id]);
ok('an open book, an open flour sack, an open helm (things of their own, not open states) are placeable and on a shelf', opens.every(id => placeableIds.has(id) && shown.has(id)) && !placeableIds.has('door-plank-open'), opens.join(', '));
const sizes2 = []; for (const n of roomNodes) for (const it of itemsOf(n.id)) if (it.place !== 'tile' && !roomgen.sizeOf(it.cat, it.sku)) sizes2.push(`${n.roomKey}:${it.cat}/${it.sku || ''}`);
ok('every look, faction piece and kit piece on a shelf has a catalog size', !sizes2.length, short([...new Set(sizes2)]));
// how things lie on the shelves (poseOf): as they are placed; nothing on its side
{
  const pose = (id, sku) => { const o = lib.objects[id], z = roomgen.sizeOf(id, sku); return poseOf({ cat: id, place: placeOf(o), flat: z?.flat }, z?.dims); };
  const want = { 'chair-plain': 'up', 'stool-bar': 'up', 'barrel': 'up', 'table-square': 'up', 'candle': 'up', 'pillar-round': 'up', 'stair-straight': 'up', 'chandelier-ring': 'up', 'lantern-wall-iron': 'up',
    'fireplace-wall': 'back', 'shield-display': 'back', 'sconce-candle-double': 'back', 'notice-board': 'back', 'bath-screen-cloth': 'back', 'wall-straight': 'back', 'door-plank': 'back', 'fence-picket': 'back' };
  const got = Object.fromEntries(Object.keys(want).filter(id => lib.objects[id]).map(id => [id, pose(id)]));
  const bad = Object.entries(got).filter(([id, p]) => p !== want[id]);
  ok('things lie as they are placed: chairs, stools, barrels, candles, pillars, stairs, lanterns stand; wall things, boards, screens and the kit lie face up', !bad.length, bad.map(([id, p]) => `${id}: ${p}, want ${want[id]}`).join('; '));
  const side = []; for (const n of roomNodes) for (const it of itemsOf(n.id)) { const z = it.place === 'tile' ? null : roomgen.sizeOf(it.cat, it.sku); if (z && !['up', 'back'].includes(poseOf({ ...it, flat: z.flat }, z.dims))) side.push(it.cat); }
  ok('... and nothing on any shelf lies on its side', !side.length, short([...new Set(side)]));
}
console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
