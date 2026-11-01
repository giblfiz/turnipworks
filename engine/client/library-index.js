// THE BUILD LIBRARY'S INDEX (2026-10-25, Harry: "They also might need to be re indexed, we have added some stuff."):
// what each library area lists, and what the command bar can place by hand, from the same rules, so the two cannot
// drift apart. No three.js here: the node test (test/library-index.test.mjs) runs it on the tuner's data and fails when
// a placeable thing is in no library area.
//   a room's library  its recipe slots' things (taxonomy.js: furniture and objects), every faction's piece for a
//                     faction slot, the things no room lists ("More · <type>", taxonomy.js `more`), the hand-placed
//                     kit (walls, doors, windows, railings, fences, stairs) per wall family, and every floor as a tile
//   placeable         what the command bar's catalog offers (assets.js), less holes and anything rated out
import { STAIR_ROLES } from '../core/stairs.js';
import { isFactionSlot, factionSearchItems, factionCatalog } from '../core/faction-catalog.js';

// the six pieces every wall family has (a room's own walls)
export const KIT_PIECES = ['wall-straight', 'wall-window-small', 'wall-doorway', 'door-plank', 'door-reinforced', 'door-double-grand'];
// every kit piece a person places by hand onto 5-ft edges: those six, the barn door, railings, balustrades and fences
// (Harry 2026-10-24: "railing" and "banister" found nothing)
// and iron bars (Harry 2026-10-27: "cell bars" was on a shelf but the bar could not place it): the 5-ft barred section,
// its corner / end post (a post: it snaps to grid crosses), the barred cell door and the 10-ft portcullis (it spans two edges: modes.js placementAt); and the yard's other edge
// kit, the same day ("fences and hedges reachable from the quickbar"): the picket and wattle fences and the field gate,
// the clipped hedge, its end block (a post) and its arch, the dry-stone wall, its pier (a post) and its gate. (The
// 5x5-ft L of `hedge-corner` is left out: it does not sit on an edge or a point; a run turns at an end block.)
export const HAND_KIT = [...KIT_PIECES, 'door-barn-double', 'railing-wood', 'railing-iron', 'balustrade-stone', 'balustrade-stone-pier', 'fence-post-rail', 'fence-post-corner', 'cell-bars', 'cell-bars-post', 'door-cell-bars', 'portcullis', 'fence-picket', 'fence-wattle', 'gate-fence', 'hedge-straight', 'hedge-end-block', 'hedge-gap-arch', 'wall-drystone', 'wall-drystone-pier', 'wall-drystone-gate'];
// ROOF OBJECTS (2026-10-27, Harry: "little turret type things and such. Basically roof objects"): pieces of the vertical
// kit that stand on a roof (or a floor) by themselves, placed by hand as ordinary THINGS (moved, turned, deleted like
// furniture; not snapped to an edge): the roof hatch, a chimney stack, the skylight. The generated roof objects (the
// corner turret, the cistern, the flagpole: catalog/objects-roof.catalog.md) are things already. A thing put down where
// a roof is showing stands on it (world.js floorPoint).
export const ROOF_THINGS = ['roof-hatch', 'chimney-stack', 'roof-skylight'];
// EVERY KIT PIECE CAN BE PUT DOWN BY HAND (2026-10-29, Harry: "seems like stuff is missing"): 58 kit pieces the room
// rules use (a bar counter, the crypt's niches, glazed doors, a stable's stalls ...) were on no shelf and in no list of
// the command bar's. Each is now one of:
//   ROOM_KIT    an edge or post piece, placed like the walls, doors and windows (onto a 5-ft grid edge; a post on a
//               grid cross; a door fitted to its edge; a piece two edges wide centred on a cross). On the shelves of the
//               rooms whose rules use it (else of the types whose roles name it), with the walls or the doors.
//   KIT_THINGS  a piece that does not sit on an edge (a bridge, a porch, a bar counter's segment, a trapdoor, a roof's
//               ridge or dormer): placed as a thing, like the roof objects above. On the shelves like any thing.
//   (left out)  an open state (shown, and switched, closed: `-open`, `open_of`) and the roof materials (`roofing-*`, flat
//               pictures the roof styles use). test/library-index.test.mjs fails on a kit piece that is none of these.
export const ROOM_KIT = ['door-glazed', 'door-panelled', 'door-tower', 'door-crypt', 'door-face-carved', 'door-rune-sealed', 'door-secret-bookcase', 'crypt-gate-iron', 'tomb-door-sealed', 'gate-double-timber', 'window-stained-glass', 'wall-shop-window', 'wall-window-shop', 'wall-secret-door', 'wall-alcove', 'wall-crypt-niches', 'ossuary-wall', 'cell-holding-wood', 'city-wall', 'city-wall-turret', 'wall-crenellated', 'wall-crenellated-corner', 'parapet-straight', 'parapet-corner', 'wall-corner-inner', 'wall-corner-outer', 'stable-stall', 'stable-stall-partition', 'stable-stall-back', 'stable-stall-door', 'stable-stall-gate', 'privy-stall-door'];
export const KIT_THINGS = [...ROOF_THINGS, 'bar-counter', 'balcony-wood', 'porch-covered', 'gallery-interior', 'plank-bridge', 'bridge-stone-natural', 'cave-mouth', 'sewer-outflow', 'floor-trapdoor', 'floor-hayloft', 'hedge-corner', 'privy-stall-partition', 'roof-dormer', 'roof-ridge', 'roof-shingle-wood', 'rune-tile'];
// AN OPEN STATE of another thing (a door swung open, an open chest: shown, and switched, as the closed one). Not every
// name ending in "-open" is one: an open book, an open sack of flour, an open helm are things of their own, with no
// closed twin (11 of them were left off every shelf and out of the command bar until 2026-10-29)
export const isOpenState = (lib, id) => !!lib.objects[id]?.open_of || (typeof id === 'string' && id.endsWith('-open') && !!lib.objects[id.slice(0, -5)]);
// a kit piece no person puts down by hand: an open state of another piece, or a roof material
export const isKitStateOrMaterial = (lib, id) => isOpenState(lib, id) || /^roofing-/.test(id);
export const placeOf = (o) => o && KIT_THINGS.includes(o.id) ? 'floor' : o?.place; // how a library entry is placed by hand
// and the stairs (2026-10-11): put down by hand they open the floor above like a planned stair (core/stairs.js)
export const isHandStair = (id) => !!STAIR_ROLES[id] || id === 'stair-landing';
export const isFloorCat = (id) => typeof id === 'string' && id.startsWith('floor-') && !KIT_THINGS.includes(id); // (a trapdoor or a hayloft's floor is a thing: KIT_THINGS)
// every flat floor material in the library (the list the tuner's room floors draw from)
export const floorCats = (lib) => Object.keys(lib.objects).filter(k => isFloorCat(k) && lib.objects[k].skus.some(s => s.kind === 'flat')).sort();
// a thing (not kit, not a floor, not an open state, not a faction slot) a person can place, with a sku the library can draw
export const isHandThing = (lib, id, usable = () => true) => { const o = lib.objects[id]; return !!o && placeOf(o) !== 'kit' && !isFloorCat(id) && !isOpenState(lib, id) && !isFactionSlot(id) && o.skus.some(k => (k.kind === 'flat' || k.bounds) && usable(k)); };
// the piece offered for a stair: the one made for a 10-ft storey first (in a wall family, when one is asked for)
export const stairSku = (o, usable, fam = null) => {
  const ok = (k) => k.bounds && usable(k) && (fam == null || k.family === fam);
  return o.skus.find(k => ok(k) && k.url && /--t10$/.test(k.sku)) || o.skus.find(ok) || null;
};
export const isHandKit = (id) => HAND_KIT.includes(id) || ROOM_KIT.includes(id);
const isHandKitCat = (lib, id) => (isHandKit(id) || isHandStair(id)) && lib.objects[id]?.place === 'kit';

// every category (and every faction piece, by sku) a person can place by hand that a library could show
export function handPlaceable(lib, usable = () => true) {
  const out = [];
  for (const id of Object.keys(lib.objects)) {
    if (isHandThing(lib, id, usable)) out.push({ id, kind: 'thing' });
    else if (isHandKitCat(lib, id) && lib.objects[id].skus.some(k => k.bounds && usable(k))) out.push({ id, kind: isHandStair(id) ? 'stair' : 'kit' });
  }
  for (const id of floorCats(lib)) out.push({ id, kind: 'floor' });
  for (const c of factionSearchItems(lib)) { const k = lib.objects[c.id]?.skus.find(s => s.sku === c.sku); if (k && usable(k)) out.push({ id: c.id, sku: c.sku, kind: 'faction' }); }
  return out;
}

// a library's sections of things, in order (plants: the yard's slot)
export const SECTIONS = [['anchor', 'Centrepieces'], ['furnish', 'Furniture'], ['store', 'Storage'], ['light', 'Lights'], ['dress', 'Dressing'], ['plants', 'Plants'], ['*', 'Table and tools']];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1).replace(/-/g, ' ') : s;
const famName = (f) => f ? f.replace(/-/g, ' ') : '';

// A THING'S LOOKS (2026-10-29): a catalog thing can come in several looks (a plain chair `--common` and `--fine`; a bar
// counter's straight, corner, end and flap pieces), each made several times over (`--s1`, `--s2` ...: the same look,
// generated again). The shelf showed one sku per thing; it now shows one per LOOK, so what the room can put down is
// all there (the re-generations are not repeated). In a wall family the room's own family's pieces only, when it has some.
const lookOf = (cat, k) => k.sku.replace(/--s\d+$/, '').slice(cat.length).replace(/^--/, '');
export function looksOf(lib, cat, usable = () => true, family = null) {
  const o = lib.objects[cat]; if (!o) return [];
  let ks = o.skus.filter(k => (k.kind === 'flat' || (k.bounds && k.url)) && usable(k));
  if (family && ks.some(k => k.family === family)) ks = ks.filter(k => !k.family || k.family === family);
  const seen = new Map(); for (const k of ks) { const l = lookOf(cat, k); if (!seen.has(l)) seen.set(l, k); }
  return [...seen].map(([look, k]) => ({ look: look.split('--').filter(w => w !== k.family).join(' ').replace(/-/g, ' '), sku: k }));
}

// HOW A THING LIES ON THE SHELF (2026-10-29, Harry: "Some of the objects are not rotated in sensable ways"). The library
// is seen from straight above. Until now each thing lay whichever way showed the biggest silhouette from above, so a chair
// and a stool lay on their sides, a barrel and a settle on their backs, a wall lantern on its side, a stair on its side.
// Now it follows how the thing is PLACED (its catalog `place`, the kit's kind), and two reads by Gemini:
//   up    as it stands in a room: what stands on the floor or the ground, what sits on a table, what hangs from the
//         ceiling or from a wall hook (a lantern), a stair (seen from above as it is placed, by its squares), a flat thing
//   back  face up to the camera, as it hangs on a wall: what is mounted on or stands against a wall (a sconce, a shield,
//         a fireplace, a shelf), the kit's walls, doors, windows, fences and posts; and a standing thing that is thin
//         front to back, a PANEL (a notice board, a screen, a sign, a shield on its rim: from above, edge on, it was "a
//         thin line"); and a pole six times taller than wide (whose top from above is a dot)
//   Nothing lies on its side.
export const TALL_LIES = 6; // height over the wider side of its footprint (Gemini: pillars stand, like the other pillars)
export const PANEL = 0.45; // depth over the smaller of width and height
const HANGS = /(^|-)lantern(-|$)/; // a wall lantern hangs from its hook: seen from above like a hanging lantern (Gemini: on its back it read "in side elevation")
export function poseOf(it, dims, tallLies = TALL_LIES) {
  const [w, h, d] = dims || [1, 1, 1];
  if (it.flat || it.place === 'tile') return 'up';
  if (it.place === 'kit') return isHandStair(it.cat) ? 'up' : 'back';
  if (it.place === 'wall') return HANGS.test(it.cat || '') ? 'up' : 'back';
  if (it.place === 'ceiling') return 'up';
  if (d <= PANEL * Math.min(w, h)) return 'back';
  return h > tallLies * Math.max(w, d) ? 'back' : 'up';
}

// WHAT A ROOM'S LIBRARY LISTS, before any sizes (library.js lays it out; the node test checks it):
//   [[key, title, [{ cat, sku?, label, place }], opts?]]: the SECTIONS (what its recipe and its rules put down, every
//   look of each), its FACTIONS (each faction's pieces, where faction pieces come up), "More · <type>" (taxonomy.js
//   `more`), the room type's own floors, the kit (walls; doors and windows; stairs: one section each, every wall
//   family's pieces in it, the room's own first), the other floors.
//   A floor is { place: 'tile' } (sized as a 5-ft tile); the rest are sized by the catalog (roomgen.sizeOf).
//   opts.ordered: lay the section out in its own order (the kit: by family), not biggest first.
export function libraryContents(roomNode, { lib, recipe = { slots: {} }, usable = () => true, factionName = (cat) => cat }) {
  const sec = (k) => SECTIONS.some(([s]) => s === k) ? k : '*';
  const slotOf = (id) => { for (const [k, ids] of Object.entries(recipe.slots || {})) if (k !== 'sets' && ids.includes(id)) return sec(k); return sec(roomNode.slotOf?.[id]); }; // (a set's member, a spawned thing: the taxonomy's slot)
  const looks = (it) => { const ls = looksOf(lib, it.cat, usable, recipe.family); return ls.length > 1 ? ls.map(({ look, sku }) => ({ ...it, sku: sku.sku, label: look ? `${it.label} · ${look}` : it.label })) : [it]; };
  const items = [...(roomNode.furniture || []).filter(n => !n.kit).map(n => ({ cat: n.cat, label: n.label, place: n.place })), ...(roomNode.objects || []).map(id => ({ cat: id, label: cap(id), place: 'surface' }))].filter(it => !isFactionSlot(it.cat)).flatMap(looks);
  const bySec = new Map(SECTIONS.map(([k]) => [k, []]));
  for (const it of items) bySec.get(slotOf(it.cat)).push(it);
  const out = SECTIONS.map(([k, t]) => [k, t, bySec.get(k)]);
  // the faction pieces, where they come up (taxonomy.js factionSlots), grouped under each faction
  out.push(...factionSections(lib, roomNode.factionSlots || [], usable, factionName));
  // the things no room's recipe or rules list, from each of this room's types, a section per type
  for (const m of roomNode.more || []) out.push([`more:${m.code}`, m.title, m.ids.map(id => ({ cat: id, label: cap(id), place: placeOf(lib.objects[id]) })).flatMap(roomNode.bare ? (it) => [it] : looks)]); // (a bare room's borrowed shelves: one look each)
  // floors: every floor material as a 5-ft tile, the room type's own floors first (Harry 2026-10-04)
  const all = floorCats(lib), own = (recipe.floors || []).filter(f => all.includes(f)), tile = (id) => ({ cat: id, label: cap(id.replace(/^floor-/, '')), place: 'tile' });
  if (own.length) out.push(['floors', 'Floors', own.map(tile)]);
  // walls; doors and windows; stairs (every wall family's, the room's own first, then the room's own special pieces)
  const kitLabel = (id) => (roomNode.furniture || []).find(f => f.cat === id)?.label || cap(id);
  out.push(...kitSections(lib, recipe.family, usable, kitLabel, roomNode.roomKit || []));
  const rest = all.filter(f => !own.includes(f));
  if (rest.length) out.push(['floors-more', own.length ? 'More floors' : 'Floors', rest.map(tile)]);
  return out.filter(([, , list]) => list.length);
}

// FACTION PIECES WHERE THEY COME UP (Harry 2026-10-29: "we should have all those faction objects anywhere they come up"):
// every faction's piece for each faction slot this room uses, grouped under the faction ("Faction · Sun"); where only a
// slot or two come up (a castle hall's banners), one section of them all.
export function factionSections(lib, slots, usable = () => true, factionName = (cat) => cat) {
  if (!slots.length) return [];
  const { factions } = factionCatalog(lib);
  const per = factions.map(f => [f, slots.filter(c => f.slots[c] && usable(f.slots[c])).map(c => ({ cat: c, sku: f.slots[c].sku, label: factionName(c, f.slots[c]), place: lib.objects[c]?.place }))]).filter(([, l]) => l.length);
  if (slots.length <= 2) return [['factions', 'Faction pieces', per.flatMap(([, l]) => l)]];
  return per.map(([f, l]) => [`faction:${f.id}`, `Faction · ${f.label}`, l]);
}

// THE HAND-PLACED KIT (Harry 2026-10-29: "The wall/door count is fine, but they don't need their own sections by
// type"): every wall family's pieces, as before, in three sections, not one per family: Walls (walls, railings, fences,
// hedges, bars, posts ...), Doors & windows, Stairs. In each, the room's own family first, then the room's own special
// pieces (ROOM_KIT routed to it: the crypt's niches, a stable's stalls), then the other families; each label names its
// family. A piece that is the same sku in two families' lists is shown once. [key, title, [{ cat, sku, label, place: 'kit' }], { ordered }]
const DOORISH = /^(door-|gate-|crypt-gate|tomb-door|portcullis)|window|-gate$|-arch$|stall-door|secret-door|^wall-doorway/;
export const kitSectionOf = (id) => isHandStair(id) ? 'stairs' : DOORISH.test(id) ? 'doors' : 'walls';
// a piece set in a wall line (a wall section, door, window, gate, portcullis, bars, fence, railing, hedge; its open
// state too): long along its edge and a few inches across, so its width is not the size of its footprint
export const isEdgePiece = (id) => typeof id === 'string' && !isHandStair(id) && (HAND_KIT.includes(id.replace(/-open$/, '')) || DOORISH.test(id));
export function kitSections(lib, recipeFamily, usable, labelOf = (id) => id, roomKit = []) {
  const ok = (k) => k.bounds && usable(k);
  const fams = [...new Set((lib.objects['wall-straight']?.skus || []).filter(ok).map(k => k.family).filter(Boolean))].sort((a, b) => (b === recipeFamily) - (a === recipeFamily));
  const ids = [...HAND_KIT, ...Object.keys(lib.objects).filter(id => isHandStair(id) && !HAND_KIT.includes(id)).sort()].filter(id => isHandKitCat(lib, id));
  const lists = { walls: [], doors: [], stairs: [] }, seen = new Set();
  const put = (id, k) => { if (seen.has(`${id}|${k.sku}`)) return; seen.add(`${id}|${k.sku}`); lists[kitSectionOf(id)].push({ cat: id, sku: k.sku, label: k.family ? `${labelOf(id)} · ${famName(k.family)}` : labelOf(id), place: 'kit' }); };
  fams.forEach((fam, i) => {
    for (const id of ids) {
      const o = lib.objects[id], st = isHandStair(id);
      const k = (st ? stairSku(o, usable, fam) : o.skus.find(x => x.family === fam && ok(x))) || (i === 0 ? (st ? stairSku(o, usable) : o.skus.find(ok)) : null);
      if (k) put(id, k);
    }
    if (i === 0) for (const id of roomKit) if (isHandKitCat(lib, id)) { const fs = new Set(); for (const k of lib.objects[id].skus) if (ok(k) && !fs.has(k.family || '')) { fs.add(k.family || ''); put(id, k); } } // (each family it comes in)
  });
  return [['kit:walls', 'Walls', lists.walls], ['kit:doors', 'Doors & windows', lists.doors], ['kit:stairs', 'Stairs', lists.stairs]].filter(([, , l]) => l.length).map(s => [...s, { ordered: true }]);
}
