// The Build menu's content tree: Genre → Type → Room (Harry 2026-10-04: the furniture and object levels went away;
// a room type's things come from its library area in the PiP). Like folders, with symlinks: a thing that belongs in
// several places is listed in each. Built at boot from what already exists:
//   types      the catalog's setting codes (TAV, NOB, CAS…), engine/client/data/types.json (tools/build_types.py)
//   rooms      the tuner's room recipes; a room's recipes ('tav-common-room') name its type
//   furniture  a room's recipe slots, things that stand, hang or mount on their own (catalog place floor / wall /
//              ceiling / ground: the "furnish / store" side)
//   objects    the room's things that sit ON something (place 'surface': the "dress" side), listed under each piece of
//              its furniture that has a top
// Every node has a hotkey letter, unique among its siblings, so the tree chords (B, then letters).
// RE-INDEXED 2026-10-25 (Harry: "They also might need to be re indexed, we have added some stuff."): a room's library
// also holds the members of its recipes' SETS (the solver places them there), and, in a room that takes faction
// flavours, every faction slot (the pillar and the corbel were in no recipe). And a thing no room lists at all goes on
// the shelves of every room of each type whose roles name it, under "More · <type>" (`more`), so every placeable thing
// is in some library area (library-index.js; test/library-index.test.mjs fails when one is not).
import { KIT_PIECES, ROOM_KIT, isHandThing, isOpenState, placeOf } from './library-index.js';
import { isFactionSlot } from '../core/faction-catalog.js';
export { KIT_PIECES };
export const LEVELS = ['genre', 'type', 'room'];
export const LEVEL_LABEL = { genre: 'Genres', type: 'Types', room: 'Rooms' };
export const LEVEL_KEY = { genre: 'G', type: 'T', room: 'R' }; // Shift+letter jumps to that level
const SLOT_ORDER = ['anchor', 'furnish', 'store', 'light', 'dress'];
export const KIT_LABELS = () => KIT_LABEL;
const KIT_LABEL = { 'wall-straight': 'Wall', 'wall-window-small': 'Window', 'wall-doorway': 'Doorway', 'door-plank': 'Door (plank)', 'door-reinforced': 'Door (reinforced)', 'door-double-grand': 'Double door' };
// a thing no recipe slot names, that the rules put down (library-spawns.json): its slot is the one most recipes give it, or
// what it is (on a surface: dressing; a light; the rest: furniture)
const LIGHTISH = /(^|-)(candle|candles|candlestick|candelabra|lantern|lamp|sconce|torch|brazier|cresset|chandelier|lightstone|firepit)(-|$)/;
// furniture with a top that things sit on (the catalog has no "has a top" field yet; its role names say it)
const HAS_TOP = /(^|-)(table|desk|counter|bar|shelf|shelves|shelving|bench|chest|washstand|barrel|cask|crate|dresser|cabinet|sideboard|trunk|altar|workbench|tun|hearth|oven|cupboard|lectern|stand|board|rack|vanity|tray)(-|$)/;

export function buildTaxonomy({ lib, roomTypes, data, usable = () => true, spawns = null }) {
  // SPAWNS (2026-10-29, engine/tools/library_spawns.mjs -> client/data/library-spawns.json): what each room type's rules
  // put down, beyond its recipe slots (the program's own lights, tableware, rugs, a dragon's hoard): on its shelves too
  const spawnsOf = (key) => spawns?.rooms?.[key] || [];
  const slotVotes = new Map(); for (const r of roomTypes) for (const [k, ids] of Object.entries(r.slots || {})) if (k !== 'sets') for (const id of ids) { const v = slotVotes.get(id) || slotVotes.set(id, {}).get(id); v[k] = (v[k] || 0) + 1; }
  const guessSlot = (id) => { const v = slotVotes.get(id); if (v) return Object.entries(v).sort((a, b) => b[1] - a[1])[0][0]; const o = lib.objects[id]; return LIGHTISH.test(id) || o?.place === 'ceiling' ? 'light' : o?.place === 'surface' ? 'dress' : 'furnish'; };
  const kitUsers = new Map(); // ROOM_KIT piece -> the room keys whose recipe or rules use it
  const nodes = new Map();
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const nameOf = (id) => cap(id.replace(/-/g, ' '));
  const libItem = (id) => { const o = lib.objects[id]; return o && placeOf(o) !== 'kit' && !isOpenState(lib, id) && !isFactionSlot(id) && o.skus.some(k => (k.kind === 'flat' || k.bounds) && usable(k)) ? o : null; };
  const add = (n) => { nodes.set(n.id, n); return n; };

  const genres = data.genres.map(g => add({ id: `g:${g.key}`, level: 'genre', label: g.label, key: g.key, parent: null, children: [] }));
  for (const t of data.types) {
    const g = nodes.get(`g:${t.genre}`); if (!g) continue;
    const rooms = roomTypes.filter(r => (r.recipes || []).some(x => x.startsWith(t.code.toLowerCase() + '-')));
    const have = t.roles.filter(id => libItem(id)).length;
    const tn = add({ id: `t:${t.code}`, level: 'type', label: t.label, code: t.code, parent: g.id, children: [], have, roles: t.roles.length,
      note: rooms.length ? `${rooms.length} room${rooms.length === 1 ? '' : 's'}` : 'no room recipes yet', disabled: !rooms.length });
    g.children.push(tn.id);
    for (const r of rooms) {
      const rn = add({ id: `r:${t.code}:${r.key}`, level: 'room', label: r.label, roomKey: r.key, cells: r.cells, family: r.family, parent: tn.id, children: [], furniture: [] });
      tn.children.push(rn.id);
      const seen = new Set(), furn = [], objs = [], factionSlots = new Set(r.flavors?.length ? lib.flavorSlots || [] : []);
      const take = (id, k) => {
        if (isOpenState(lib, id)) id = lib.objects[id].open_of || id.slice(0, -5); // (an open chest is on the shelf closed)
        if (isFactionSlot(id)) { factionSlots.add(id); return; }
        if (id === 'banner-wall') factionSlots.add('flavor-banner'); // (a wall banner is a faction mark: core/factions.js factionSlot)
        if (ROOM_KIT.includes(id)) { (kitUsers.get(id) || kitUsers.set(id, new Set()).get(id)).add(r.key); return; }
        if (seen.has(id)) return; seen.add(id); const o = libItem(id); if (o) (placeOf(o) === 'surface' ? objs : furn).push({ id, o, slot: k });
      };
      const slots = Object.keys(r.slots || {}).sort((a, b) => (SLOT_ORDER.indexOf(a) + 99) % 99 - (SLOT_ORDER.indexOf(b) + 99) % 99);
      for (const k of slots) if (k !== 'sets') for (const id of r.slots[k]) take(id, k);
      // the members of its sets (a bottle row, a crate stack: the solver stands them in this room), then what its rules
      // put down (spawns), then, in a room that takes faction flavours, every faction slot (factionSlots, above)
      for (const sid of r.slots?.sets || []) for (const [id] of lib.sets?.[sid]?.members || []) take(id, 'dress');
      for (const id of spawnsOf(r.key)) if (lib.objects[id]) take(id, guessSlot(id));
      rn.factionSlots = (lib.flavorSlots || []).filter(id => factionSlots.has(id)).concat([...factionSlots].filter(id => !(lib.flavorSlots || []).includes(id)));
      for (const f of furn) {
        rn.furniture.push({ id: `f:${r.key}:${f.id}`, label: nameOf(f.id), cat: f.id, place: placeOf(f.o), top: HAS_TOP.test(f.id) });
      }
      rn.objects = objs.map(x => x.id); // the room's objects, for its library shelves
      rn.recipeIds = new Set(Object.entries(r.slots || {}).flatMap(([k, ids]) => k === 'sets' ? [] : ids)); // (what its recipe names: what a bare room borrows, below)
      rn.slotOf = Object.fromEntries([...furn, ...objs].map(x => [x.id, x.slot])); // (a set member or a spawned thing: no recipe slot names it)
      rn.more = [];
      // walls, doors and windows, placeable by hand (in the room's own wall family first)
      for (const id of r.terrain ? [] : KIT_PIECES) { // (a hill has no walls: its library is its ground materials)
        const o = lib.objects[id]; if (!o) continue;
        const k = o.skus.find(s => s.family === r.family && s.bounds && usable(s)) || o.skus.find(s => s.bounds && usable(s)); if (!k) continue;
        rn.furniture.push({ id: `f:${r.key}:${id}`, label: KIT_LABEL[id] || nameOf(id), cat: id, sku: k.sku, place: 'kit', kit: true });
      }
    }
  }
  // THE THINGS NO ROOM LISTS: on the shelves of every room of each type whose roles name the thing ("More · <type>";
  // a thing no type with rooms names goes on every room's). A room listed under several types (the chapel, the hill,
  // the cave) shows each of its types' sections, whichever type it was opened from (its library area is one).
  const roomNodes = [...nodes.values()].filter(n => n.level === 'room');
  // THE ROOMS' OWN KIT PIECES (library-index.js ROOM_KIT): on the shelves of the rooms whose recipe or rules use the
  // piece; one no room uses, on the rooms of the types whose roles name it (else every room's)
  const roomedTypes = data.types.filter(t => nodes.get(`t:${t.code}`)?.children.length);
  for (const id of ROOM_KIT) {
    if (!lib.objects[id]) continue;
    let keys = kitUsers.get(id);
    if (!keys?.size) { const ts = roomedTypes.filter(t => t.roles.includes(id)); keys = new Set((ts.length ? ts : roomedTypes).flatMap(t => nodes.get(`t:${t.code}`).children.map(rid => nodes.get(rid).roomKey))); }
    for (const n of roomNodes) if (keys.has(n.roomKey)) (n.roomKit ||= []).push(id);
  }
  const listed = new Set(roomNodes.flatMap(n => [...n.furniture.map(f => f.cat), ...n.objects]));
  const orphans = Object.keys(lib.objects).filter(id => !listed.has(id) && isHandThing(lib, id, usable)).sort();
  const roomed = data.types.filter(t => nodes.get(`t:${t.code}`)?.children.length);
  const more = new Map(); // room key -> Map(type code -> { title, ids })
  for (const id of orphans) {
    const ts = roomed.filter(t => t.roles.includes(id));
    for (const t of ts.length ? ts : roomed) for (const rid of nodes.get(`t:${t.code}`).children) {
      const key = nodes.get(rid).roomKey, m = more.get(key) || more.set(key, new Map()).get(key);
      (m.get(t.code) || m.set(t.code, { code: t.code, title: `More · ${t.label}`, ids: [] }).get(t.code)).ids.push(id);
    }
  }
  // A ROOM THE GM FURNISHES BY HAND (2026-10-29: the cave, whose rules put down only its stalagmites, had 6 things on
  // its shelves): one with fewer than BARE things of its own also gets what its types' other rooms' RECIPES name ("More · <type>"; not
  // what their rules add, nor their looks: 334 things and every look of each halved the frame rate framed whole)
  const BARE = 10, own = (n) => n.furniture.filter(f => !f.kit).length + n.objects.length;
  for (const n of roomNodes) if (own(n) < BARE) {
    n.bare = true; // (its More shelves show one look of each thing: library-index.js)
    const m = more.get(n.roomKey) || more.set(n.roomKey, new Map()).get(n.roomKey), mine = new Set([...n.furniture.map(f => f.cat), ...n.objects]);
    for (const tid of [...nodes.values()].filter(t => t.level === 'type' && t.children.some(rid => nodes.get(rid).roomKey === n.roomKey)).map(t => t.id)) {
      const t = nodes.get(tid), ids = [...new Set(t.children.map(rid => nodes.get(rid)).filter(o => o.roomKey !== n.roomKey && own(o) >= BARE).flatMap(o => [...o.furniture.filter(f => !f.kit).map(f => f.cat), ...o.objects].filter(id => o.recipeIds.has(id))))].filter(id => !mine.has(id)).sort();
      const sec = m.get(t.code) || m.set(t.code, { code: t.code, title: `More · ${t.label}`, ids: [] }).get(t.code);
      sec.ids.push(...ids.filter(id => !sec.ids.includes(id)));
    }
  }
  for (const n of roomNodes) { const had = new Set(); n.more = [...(more.get(n.roomKey)?.values() || [])].map(s => ({ ...s, ids: s.ids.filter(id => !had.has(id) && had.add(id)) })).filter(s => s.ids.length); } // (once per library: the first of its types that names it)
  for (const n of nodes.values()) assignKeys(n.children.map(id => nodes.get(id)));
  assignKeys(genres);
  return {
    nodes, genres: genres.map(g => g.id),
    get: (id) => nodes.get(id),
    childrenOf: (id) => (id == null ? genres.map(g => g.id) : nodes.get(id)?.children || []).map(c => nodes.get(c)),
    siblingsOf: (id) => { const n = nodes.get(id); return n?.parent ? nodes.get(n.parent).children.map(c => nodes.get(c)) : genres; },
    pathOf: (id) => { const out = []; for (let n = nodes.get(id); n; n = n.parent && nodes.get(n.parent)) out.unshift(n.id); return out; },
    // the first descendant path that reaches a level (for Shift+letter jumps into levels below the current one)
    firstAt: (fromId, level) => {
      const walk = (ids) => { for (const id of ids) { const c = nodes.get(id); if (c.disabled) continue; if (c.level === level) return c.id; const r = walk(c.children); if (r) return r; } return null; };
      return walk(fromId ? nodes.get(fromId)?.children || [] : genres.map(g => g.id));
    },
  };
}

// unique letters per sibling list: word initials, then the label's other letters, then any letter, then digits
function assignKeys(list) {
  const used = new Set();
  for (const n of list) {
    const words = n.label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const cands = [...words.map(w => w[0]), ...words.join(''), ...'abcdefghijklmnopqrstuvwxyz0123456789'];
    n.hot = cands.find(c => /[a-z0-9]/.test(c) && !used.has(c)) || null;
    if (n.hot) used.add(n.hot);
  }
}
