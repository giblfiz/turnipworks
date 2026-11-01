// SHARE A SELECTION (Harry 2026-10-29: "export import area librarys as suggested"; docs/PRODUCT_DIRECTIONS.md "Sharing
// builds", step 1; docs/NETCODE.md "Shared builds"). An area, a building, a room or a prop arrangement goes out as a small
// JSON file (`.turnip.json`) or an unlisted share link, and comes in again, in another campaign, at another spot.
//
// THE FILE IS RECIPES AND LIBRARY REFERENCES, NEVER MESHES: a room is its recipe (type, rect, seed, walls, floor), a thing
// is its catalog id and SKU plus where it stands, a wall edit is its edge key. The importer's own library turns each
// reference back into a piece; a SKU it lacks becomes the nearest SKU of that catalog id, and a catalog id it lacks
// becomes a STAND-IN (the catalog box, the thing's name and size), reported ("3 pieces your library lacks").
// GM-only parts (hidden rooms and things, monsters and other unowned pawns, traps, GM notes) travel by default, because the
// one who imports is a GM; "strip secrets" takes them out. NEVER in a file: seats, owners, tokens or links, chat, explored
// fog, turns, templates, presence, a player's pawns, a pawn's sheet link.
//
// IMPORTED JSON IS UNTRUSTED INPUT. parseShare/validateShare: caps on bytes, nesting depth (scanned before JSON.parse),
// counts and string lengths; `__proto__`, `constructor` and `prototype` keys refuse the whole file; unknown keys and kinds
// refuse; nothing that looks like a URL or embedded data except the one preview picture (a magic-checked WebP / JPEG / PNG
// data URL, never placed in the world); the result is rebuilt field by field. planImport then turns the document into
// ORDINARY COMMANDS and dry-runs every one through the same parseArgs, check and apply the relay runs on a live command
// (never an entities.set): what the relay would refuse is refused here, before anything is sent.
//
//   exportShare(entities, { kind, ids, name, strip, area, thumb, engineVersion, now })  -> { doc, left }
//   secretsIn(entities, { kind, ids })        what "strip secrets" would take out: { hiddenRooms, hiddenThings, pawns, traps, gmNotes }
//   parseShare(text) -> { doc } | { error }   validateShare(obj) -> { doc } | { error }    upgradeShare(doc)
//   placeFor(doc, target)                     the cheap part, for the ghost on every pointer move: the shift and each room's rect
//   planImport(doc, target)                   -> { ok, why?, ops, report, shift, rooms, ids }
//   summaryOf(doc)                            counts for a preview: rooms, buildings, things, pawns, levels
import { REGISTRY, parseArgs, EDGE_KEY_RE, ownsKey } from './commands.js';
import * as HT from './height.js';
import { newId as mintId, isId } from './ids.js';
import { RULE_KEYS, settingsProblem } from './state.js';
import { cellsOf, hasCell } from './footprint.js';

export const SHARE_FORMAT = 'turnip-works-share';
export const SHARE_V = 1;
export const SHARE_KINDS = ['area', 'building', 'room', 'group'];
export const SHARE_EXT = '.turnip.json';
export const SHARE_LIMITS = Object.freeze({
  bytes: 3 * 1024 * 1024,   // the whole file (the picture included)
  thumb: 300 * 1024,        // the preview picture, decoded
  depth: 8,                 // nesting of objects and arrays (the format itself needs 6)
  rooms: 400, buildings: 120, objects: 12000, edges: 8000, pawns: 400, water: 200,
  name: 60, str: 80, note: 4000, outline: 200, waterPts: 400, conditions: 20,
});
const CELL = 5, LIM = 100000;
const r2 = (v) => Math.round(v * 100) / 100;
// traps are GM-only parts (strip secrets takes them out). The library's traps: trap-*, bear-trap (not a trapdoor, not a mousetrap)
export const isTrap = (cat) => typeof cat === 'string' && (/^trap-/.test(cat) || cat === 'bear-trap');
// a PLAYER's pawn never leaves the campaign it belongs to: owned, a player's main, lent, or placed from a player's bench
const playerish = (e) => !!(e.owner || e.main || e.lender);
const ROOM_REF = 'r', BLD_REF = 'b', OBJ_REF = 'o', PAWN_REF = 'p', WATER_REF = 'w';

// ======================================================================================================== EXPORT
// what a selection takes along: { rooms: Set, objects: Set, edges: Set, pawns: Set, water: Set, buildings: Set, players }
function collect(entities, { kind, ids = [] }) {
  const E = entities || {}, all = Object.values(E);
  const rooms = new Set(), objects = new Set(), edges = new Set(), pawns = new Set(), water = new Set(), buildings = new Set();
  let players = 0;
  const addPawn = (e) => { if (playerish(e)) players++; else pawns.add(e.id); };
  if (kind === 'area') {
    for (const e of all) {
      if (e.kind === 'room') rooms.add(e.id); else if (e.kind === 'building') buildings.add(e.id); else if (e.kind === 'object') objects.add(e.id);
      else if (e.kind === 'edge') edges.add(e.id); else if (e.kind === 'water') water.add(e.id); else if (e.kind === 'token') addPawn(e);
    }
    return { rooms, objects, edges, pawns, water, buildings, players };
  }
  for (const id of ids) {
    const e = E[id]; if (!e) continue;
    if (e.kind === 'building') { buildings.add(id); for (const r of all) if (r.kind === 'room' && r.building === id) rooms.add(r.id); }
    else if (e.kind === 'room') rooms.add(id);
    else if (e.kind === 'object') objects.add(id);
    else if (e.kind === 'token') addPawn(e);
    else if (e.kind === 'water') water.add(id);
  }
  // a room takes its things, its wall edits and the pawns standing in it; a thing takes what rests on it
  for (const o of all) if (o.kind === 'object' && rooms.has(o.room)) objects.add(o.id);
  const roomList = [...rooms].map(id => E[id]);
  for (const e of all) if (e.kind === 'edge' && roomList.some(r => ownsKey({ entities: E }, r, e.key))) edges.add(e.id);
  if (rooms.size) for (const t of all) if (t.kind === 'token' && !pawns.has(t.id) && rooms.has(HT.tokenFloor(E, t).room)) { if (playerish(t)) players++; else pawns.add(t.id); }
  for (let grew = true; grew;) { grew = false; for (const o of all) if (o.kind === 'object' && o.parent && objects.has(o.parent) && !objects.has(o.id)) { objects.add(o.id); grew = true; } }
  return { rooms, objects, edges, pawns, water, buildings, players };
}
const hiddenRoomOnly = (E, rooms, e) => { const own = [...rooms].map(id => E[id]).filter(r => ownsKey({ entities: E }, r, e.key)); return own.length > 0 && own.every(r => r.hidden); };

// what "strip secrets" would take out of this selection (the dialog says it before you choose)
export function secretsIn(entities, sel) {
  const E = entities || {}, c = collect(E, sel);
  const hiddenRooms = [...c.rooms].filter(id => E[id].hidden).length;
  const hiddenThings = [...c.objects].filter(id => E[id].hidden && !E[E[id].room]?.hidden).length + [...c.water].filter(id => E[id].hidden).length;
  const traps = [...c.objects].filter(id => isTrap(E[id].cat) && !E[id].hidden).length;
  const pawns = c.pawns.size, gmNotes = [...c.pawns].filter(id => E[id].gmNotes).length;
  return { hiddenRooms, hiddenThings, pawns, traps, gmNotes, any: hiddenRooms + hiddenThings + pawns + traps + gmNotes > 0, players: c.players };
}

const pick = (src, keys) => { const out = {}; for (const k of keys) if (src[k] !== undefined && src[k] !== null && src[k] !== '' && src[k] !== false) out[k] = src[k]; return out; };
const ROOM_RECIPE_KEYS = ['type', 'x', 'z', 'w', 'd', 'y', 'tall', 'seed', 'wallSeed', 'wallFamily', 'floor', 'turn', 'outline', 'flavor', 'stalagObjects'];
const OBJ_KEYS = ['name', 'cat', 'sku', 'flat', 'place', 'layer', 'x', 'y', 'z', 'rot', 'yaw', 'quat', 's', 'dims', 'color', 'hidden', 'pinned', 'open', 'rule', 'orient', 'rise', 'stair', 'down', 'fromEdge', 'fromCave', 'flavor', 'factionMissing', 'factionWasHidden', 'lightRadius'];
const PAWN_KEYS = ['name', 'x', 'z', 'y', 'rot', 'color', 'fig', 'size', 'hidden', 'notes', 'gmNotes', 'mark', 'conditions', 'initBonus', 'visionRadius', 'darkvision', 'lightCarried'];
const EDGE_KEYS = ['key', 'as', 'piece', 'family', 'pick', 'doorType', 'hidden'];

// the ground a selection stands on at export (feet): what the importer lines up with the ground where it lands
function baseOf(E, roomIds, things) {
  const rooms = roomIds.map(id => E[id]).filter(r => r?.recipe && !HT.isTerrain(r.recipe));
  const ground = rooms.filter(r => HT.meetsGround(E, r));
  if (ground.length) return Math.min(...ground.map(r => HT.roomY(r.recipe)));
  if (rooms.length) { const up = rooms.map(r => HT.roomY(r.recipe)).filter(y => y >= 0); return up.length ? Math.min(...up) : 0; }
  const roots = things.filter(e => !e.parent);
  if (!roots.length) return 0;
  return Math.min(...roots.map(e => { const f = HT.floorUnder(E, e.x, e.z, (e.y || 0) + 0.5); return f ? f.y : HT.terrainTopAt(E, e.x, e.z); }));
}

export function exportShare(entities, { kind = 'group', ids = [], name = '', strip = false, area = null, thumb = null, engineVersion = '', now = new Date() } = {}) {
  if (!SHARE_KINDS.includes(kind)) throw new Error(`kind: one of ${SHARE_KINDS.join(', ')}`);
  const E = entities || {}, c = collect(E, { kind, ids });
  let left = { players: c.players, hidden: 0, pawns: 0, traps: 0, gmNotes: 0 };
  const orig = new Set(c.objects);
  if (strip) { // GM-only parts out
    for (const id of [...c.rooms]) if (E[id].hidden) { c.rooms.delete(id); left.hidden++; }
    for (const id of [...c.objects]) { const o = E[id]; if (!c.rooms.has(o.room) && o.room && E[o.room]?.hidden) { c.objects.delete(id); continue; } if (o.hidden) { c.objects.delete(id); left.hidden++; } else if (isTrap(o.cat)) { c.objects.delete(id); left.traps++; } }
    for (let gone = true; gone;) { gone = false; for (const id of [...c.objects]) { const p = E[id].parent; if (p && orig.has(p) && !c.objects.has(p)) { c.objects.delete(id); gone = true; } } } // (what rested on a stripped thing goes with it)
    for (const id of [...c.edges]) if (E[id].hidden || hiddenRoomOnly(E, Object.keys(E).filter(k => E[k].kind === 'room'), E[id])) c.edges.delete(id);
    for (const id of [...c.water]) if (E[id].hidden) { c.water.delete(id); left.hidden++; }
    left.gmNotes = [...c.pawns].filter(id => E[id].gmNotes).length;
    left.pawns = c.pawns.size; c.pawns.clear();
  }
  // refs: short opaque names, never ids (an importer mints every id anew)
  const ref = new Map(); let n = 0; const refOf = (prefix, id) => { if (!ref.has(id)) ref.set(id, prefix + (++n)); return ref.get(id); };
  const roomIds = [...c.rooms].sort((a, b) => (E[a].order || 0) - (E[b].order || 0));
  const bIds = new Set([...c.buildings, ...roomIds.map(id => E[id].building).filter(b => b && E[b] && (kind !== 'room'))]);
  if (kind === 'room') bIds.clear(); // one room alone joins (or starts) a building where it lands
  const buildings = [...bIds].filter(id => roomIds.some(r => E[r].building === id)).map(id => { const b = E[id]; return { ref: refOf(BLD_REF, id), ...pick(b, ['name', 'roof', 'roofShape']), ...(b.gen && typeof b.gen === 'object' && { gen: b.gen }) }; });
  for (const id of roomIds) refOf(ROOM_REF, id);
  const rooms = roomIds.map(id => {
    const r = E[id], rc = r.recipe || {};
    const plan = rc.plan && typeof rc.plan === 'object' ? { ...(rc.plan.b != null && { b: rc.plan.b }), ...(Array.isArray(rc.plan.entry) && { entry: rc.plan.entry }), links: Object.fromEntries(Object.entries(rc.plan.links || {}).filter(([rid]) => ref.has(rid)).map(([rid, e]) => [ref.get(rid), e])) } : null;
    return { ref: ref.get(id), ...(r.building && bIds.has(r.building) && { building: ref.get(r.building) }), ...pick(r, ['name', 'hidden', 'fog', 'roof', 'cliff']), ...pick(rc, ROOM_RECIPE_KEYS), ...(rc.wallFamily === 'auto' && { wallFamily: undefined }), ...(rc.floor === 'auto' && { floor: undefined }), ...(plan && { plan }) };
  }).map(r => JSON.parse(JSON.stringify(r))); // (drops the undefineds)
  const objIds = [...c.objects];
  for (const id of objIds) refOf(OBJ_REF, id);
  const R = (v, k) => Math.round(v * k) / k, vec = (a, k) => Array.isArray(a) ? a.map(v => typeof v === 'number' ? R(v, k) : v) : a;
  const objects = objIds.map(id => { const o0 = E[id], o = { ...o0, x: R(o0.x, 100), z: R(o0.z, 100), ...(o0.y != null && { y: R(o0.y, 1000) }), ...(o0.rot != null && { rot: R(o0.rot, 1e4) }), ...(o0.s && { s: vec(o0.s, 1e4) }), ...(o0.dims && { dims: vec(o0.dims, 1000) }), ...(o0.quat && { quat: vec(o0.quat, 1e6) }) }; return { ref: ref.get(id), ...(o.room && ref.has(o.room) && { room: ref.get(o.room) }), ...(o.parent && ref.has(o.parent) && { parent: ref.get(o.parent) }), ...pick(o, OBJ_KEYS), ...(o.lit === false && { lit: false }), ...(o.y === 0 && { y: undefined }) }; }).map(o => JSON.parse(JSON.stringify(o)));
  const edges = [...c.edges].map(id => pick(E[id], EDGE_KEYS));
  const pawns = [...c.pawns].map(id => { const t = E[id]; return { ref: refOf(PAWN_REF, id), ...pick(t, PAWN_KEYS), ...(Array.isArray(t.conditions) && !t.conditions.length && { conditions: undefined }) }; }).map(t => JSON.parse(JSON.stringify(t)));
  const water = [...c.water].map(id => ({ ref: refOf(WATER_REF, id), body: E[id].body, ...(E[id].hidden && { hidden: true }) }));
  const things = [...objIds, ...c.pawns].map(id => E[id]);
  const label = name || (kind === 'area' ? area?.name : kind === 'building' ? E[ids[0]]?.name : kind === 'room' ? (E[ids[0]]?.name || E[ids[0]]?.recipe?.type) : '') || (kind === 'group' ? `${objects.length + pawns.length} things` : 'Shared build');
  const doc = {
    format: SHARE_FORMAT, v: SHARE_V, kind, name: String(label).slice(0, SHARE_LIMITS.name), createdAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    ...(engineVersion && { engine: String(engineVersion).slice(0, SHARE_LIMITS.str) }), secrets: !strip,
    base: baseOf(E, roomIds, things),
    ...(kind === 'area' && area && { area: { name: String(area.name || label).slice(0, SHARE_LIMITS.name), ...(area.settings && Object.keys(area.settings).length && { settings: area.settings }), ...(area.ground && { ground: area.ground }) } }),
    ...(thumb && { thumb }),
    buildings, rooms, objects, edges, pawns, water,
  };
  return { doc, left };
}

// ======================================================================================================== READ (untrusted)
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// the deepest nesting of objects/arrays in a JSON text, without parsing it (strings skipped): a file 100 000 levels deep
// never reaches JSON.parse
export function jsonDepth(text) {
  let d = 0, max = 0, inStr = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (inStr) { if (ch === 92) i++; else if (ch === 34) inStr = false; continue; }
    if (ch === 34) inStr = true; else if (ch === 123 || ch === 91) { if (++d > max) max = d; } else if (ch === 125 || ch === 93) d--;
  }
  return max;
}
const fail = (why) => ({ error: why });
export function parseShare(text) {
  if (typeof text !== 'string') return fail('not a text file');
  if (text.length > SHARE_LIMITS.bytes) return fail(`too big: a shared build is at most ${Math.round(SHARE_LIMITS.bytes / 1048576)} MB`);
  if (jsonDepth(text) > SHARE_LIMITS.depth) return fail('nested too deeply to be a Turnip Works build');
  let bad = null, obj;
  try { obj = JSON.parse(text, (k, v) => { if (BAD_KEYS.has(k)) bad = k; return v; }); } catch { return fail('not JSON'); }
  if (bad) return fail(`refused: the file has a "${bad}" key`);
  return validateShare(obj);
}

// field specs: a key's type; '!' = required. Every record is rebuilt from these keys only; any other key refuses the file.
const RE = {
  ref: /^[a-z]{1,2}\d{1,6}$/, cat: /^[a-z0-9][a-z0-9-]{0,63}$/, sku: /^[a-z0-9][a-z0-9._-]{0,99}$/i, word: /^[a-z0-9][a-z0-9_.-]{0,79}$/i,
  color: /^#[0-9a-f]{6}$/i, iso: /^[0-9T:.+\-Z]{10,40}$/, fig: /^[a-z0-9][a-z0-9-]{0,63}$/,
};
class Refuse extends Error {}
const no = (why) => { throw new Refuse(why); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v, lim = LIM) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;
const noUrl = (s, where) => { if (/^\s*(data|javascript|vbscript|blob|file):/i.test(s) || /[a-z][a-z0-9+.-]*:\/\//i.test(s)) no(`${where}: links and embedded files are not allowed in a shared build`); return s; };
const T = {
  ref: (v, w) => typeof v === 'string' && RE.ref.test(v) ? v : no(`${w}: not a reference`),
  num: (v, w) => finite(v) ? v : no(`${w}: not a number`),
  int: (v, w) => Number.isInteger(v) && Math.abs(v) <= 2 ** 31 ? v : no(`${w}: not a whole number`),
  bool: (v, w) => typeof v === 'boolean' ? v : no(`${w}: not true/false`),
  name: (v, w) => typeof v === 'string' && v.length <= SHARE_LIMITS.name ? noUrl(v, w) : no(`${w}: a name of at most ${SHARE_LIMITS.name} characters`),
  str: (v, w) => typeof v === 'string' && v.length <= SHARE_LIMITS.str ? noUrl(v, w) : no(`${w}: at most ${SHARE_LIMITS.str} characters`),
  note: (v, w) => typeof v === 'string' && v.length <= SHARE_LIMITS.note ? v : no(`${w}: at most ${SHARE_LIMITS.note} characters`),
  word: (v, w) => typeof v === 'string' && RE.word.test(v) ? v : no(`${w}: not a plain word`),
  cat: (v, w) => typeof v === 'string' && RE.cat.test(v) ? v : no(`${w}: not a catalog id`),
  sku: (v, w) => typeof v === 'string' && RE.sku.test(v) ? v : no(`${w}: not a library piece`),
  fig: (v, w) => typeof v === 'string' && RE.fig.test(v) ? v : no(`${w}: not a figure id`),
  color: (v, w) => typeof v === 'string' && RE.color.test(v) ? v : no(`${w}: not a #rrggbb colour`),
  key: (v, w) => typeof v === 'string' && EDGE_KEY_RE.test(v) ? v : no(`${w}: not a wall segment`),
  vec3: (v, w) => Array.isArray(v) && v.length === 3 && v.every(x => finite(x)) ? [v[0], v[1], v[2]] : no(`${w}: not [x, y, z]`),
  quat: (v, w) => Array.isArray(v) && v.length === 4 && v.every(x => finite(x, 2)) ? [v[0], v[1], v[2], v[3]] : no(`${w}: not a quaternion`),
  outline: (v, w) => Array.isArray(v) && v.length >= 3 && v.length <= SHARE_LIMITS.outline && v.every(p => Array.isArray(p) && p.length === 2 && p.every(x => Number.isInteger(x) && Math.abs(x) <= 64)) ? v.map(([a, b]) => [a, b]) : no(`${w}: not an outline`),
  conditions: (v, w) => Array.isArray(v) && v.length <= SHARE_LIMITS.conditions && v.every(x => typeof x === 'string' && /^[a-z][a-z -]{0,39}$/i.test(x)) ? v.slice() : no(`${w}: not a list of conditions`),
  edgeDir: (v, w) => Array.isArray(v) && v.length >= 3 && v.length <= 4 && typeof v[0] === 'string' && /^[a-z]{1,3}$/.test(v[0]) && v.slice(1).every(x => Number.isInteger(x) && Math.abs(x) <= 64) ? v.slice() : no(`${w}: not a plan door`),
  plan: (v, w) => {
    if (!isObj(v)) no(`${w}: not a plan`);
    const out = {}; for (const k of Object.keys(v)) if (!['b', 'entry', 'links'].includes(k)) no(`${w}.${k}: unknown`);
    if (v.b !== undefined) out.b = typeof v.b === 'string' ? T.word(v.b, `${w}.b`) : T.int(v.b, `${w}.b`);
    if (v.entry !== undefined) out.entry = T.edgeDir(v.entry, `${w}.entry`);
    if (v.links !== undefined) { if (!isObj(v.links) || Object.keys(v.links).length > 32) no(`${w}.links: not a plan`); out.links = {}; for (const [k, e] of Object.entries(v.links)) out.links[T.ref(k, `${w}.links`)] = T.edgeDir(e, `${w}.links.${k}`); }
    return out;
  },
  roof: (v, w) => {
    if (!isObj(v)) no(`${w}: not a roof`);
    const out = {}; for (const [k, x] of Object.entries(v)) { if (!['style', 'seed', 'off', 'shape', 'axis', 'edge', 'turrets'].includes(k)) no(`${w}.${k}: unknown`); out[k] = typeof x === 'boolean' ? x : typeof x === 'number' ? T.num(x, `${w}.${k}`) : T.word(x, `${w}.${k}`); }
    return out;
  },
  gen: (v, w) => { // a generated building's recipe: small, flat (dials one level deeper)
    if (!isObj(v) || JSON.stringify(v).length > 2000) no(`${w}: not a building recipe`);
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (!RE.word.test(k)) no(`${w}: bad key`);
      if (isObj(x)) { out[k] = {}; for (const [k2, y] of Object.entries(x)) { if (!RE.word.test(k2) || !(finite(y) || typeof y === 'boolean' || (typeof y === 'string' && RE.word.test(y)))) no(`${w}.${k}: not a dial`); out[k][k2] = y; } }
      else if (finite(x) || typeof x === 'boolean') out[k] = x; else out[k] = T.word(x, `${w}.${k}`);
    }
    return out;
  },
  body: (v, w) => {
    if (!isObj(v)) no(`${w}: not water`);
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === 'kind') out.kind = ['channel', 'pond'].includes(x) ? x : no(`${w}.kind: channel or pond`);
      else if (k === 'pts') out.pts = Array.isArray(x) && x.length <= SHARE_LIMITS.waterPts && x.every(p => Array.isArray(p) && p.length === 2 && p.every(n => finite(n))) ? x.map(([a, b]) => [a, b]) : no(`${w}.pts: not points`);
      else if (['width', 'depth', 'flow', 'dir', 'y', 'ground', 'bankWet'].includes(k)) out[k] = T.num(x, `${w}.${k}`);
      else no(`${w}.${k}: unknown`);
    }
    return out;
  },
  settings: (v, w) => { if (!isObj(v)) no(`${w}: not settings`); const why = settingsProblem(v, RULE_KEYS); if (why) no(`${w}: ${why}`); return { ...v }; },
  ground: (v, w) => typeof v === 'string' && /^floor-[a-z0-9-]{1,60}$/.test(v) ? v : no(`${w}: not a ground material`),
};
const SPEC = {
  building: { ref: 'ref!', name: 'name', roof: 'word', roofShape: 'word', gen: 'gen' },
  room: { ref: 'ref!', building: 'ref', name: 'name', hidden: 'bool', fog: 'num', roof: 'roof', cliff: 'bool', type: 'cat!', x: 'int!', z: 'int!', w: 'int!', d: 'int!', y: 'int', tall: 'int', seed: 'int!', wallSeed: 'int', wallFamily: 'word', floor: 'word', turn: 'int', outline: 'outline', flavor: 'word', stalagObjects: 'bool', plan: 'plan' },
  object: { ref: 'ref!', room: 'ref', parent: 'ref', name: 'name', cat: 'cat', sku: 'sku', flat: 'bool', place: 'word', layer: 'word', x: 'num!', y: 'num', z: 'num!', rot: 'num', yaw: 'num', quat: 'quat', s: 'vec3', dims: 'vec3', color: 'color', hidden: 'bool', pinned: 'bool', open: 'bool', lit: 'bool', rule: 'word', orient: 'word', rise: 'int', stair: 'word', down: 'bool', fromEdge: 'key', fromCave: 'bool', flavor: 'word', factionMissing: 'bool', factionWasHidden: 'bool', lightRadius: 'num' },
  edge: { key: 'key!', as: 'word', piece: 'sku', family: 'word', pick: 'int', doorType: 'word', hidden: 'bool' },
  pawn: { ref: 'ref!', name: 'name!', x: 'num!', z: 'num!', y: 'num', rot: 'num', color: 'color', fig: 'fig', size: 'int', hidden: 'bool', notes: 'note', gmNotes: 'note', mark: 'word', conditions: 'conditions', initBonus: 'int', visionRadius: 'num', darkvision: 'num', lightCarried: 'num' },
  water: { ref: 'ref!', body: 'body!', hidden: 'bool' },
  area: { name: 'name!', settings: 'settings', ground: 'ground' },
};
function record(v, spec, where) {
  if (!isObj(v)) no(`${where}: not a record`);
  for (const k of Object.keys(v)) if (!spec[k]) no(`${where}.${k}: unknown field`);
  const out = {};
  for (const [k, s0] of Object.entries(spec)) {
    const req = s0.endsWith('!'), s = req ? s0.slice(0, -1) : s0;
    if (v[k] === undefined || v[k] === null) { if (req) no(`${where}.${k}: missing`); continue; }
    out[k] = T[s](v[k], `${where}.${k}`);
  }
  return out;
}
const TOP = ['format', 'v', 'kind', 'name', 'createdAt', 'engine', 'secrets', 'base', 'area', 'thumb', 'buildings', 'rooms', 'objects', 'edges', 'pawns', 'water'];
const THUMB_RE = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;
const b64bytes = (s, n) => { const t = s.slice(0, Math.ceil(n / 3) * 4 + 4); if (typeof atob === 'function') { const b = atob(t); return Array.from(b.slice(0, n), c => c.charCodeAt(0)); } return [...Buffer.from(t, 'base64').subarray(0, n)]; };
export function thumbProblem(s) {
  const m = typeof s === 'string' && s.match(THUMB_RE); if (!m) return 'the picture must be a WebP, JPEG or PNG data URL';
  const bytes = Math.floor(m[2].length * 3 / 4) - (m[2].endsWith('==') ? 2 : m[2].endsWith('=') ? 1 : 0);
  if (bytes > SHARE_LIMITS.thumb) return `the picture is at most ${SHARE_LIMITS.thumb / 1024} KB`;
  const h = b64bytes(m[2], 12), str = (a, b) => String.fromCharCode(...h.slice(a, b));
  const ok = m[1] === 'webp' ? str(0, 4) === 'RIFF' && str(8, 12) === 'WEBP' : m[1] === 'jpeg' ? h[0] === 0xff && h[1] === 0xd8 : h[0] === 0x89 && str(1, 4) === 'PNG';
  return ok ? null : 'the picture is not what it says it is';
}
export function validateShare(obj) {
  try {
    if (!isObj(obj)) no('not a Turnip Works build');
    if (obj.format !== SHARE_FORMAT) no(obj.kind === 'turnip-works-campaign' ? 'that is a whole-campaign file: import it from Settings ▸ Invites and exports' : 'not a Turnip Works build');
    for (const k of Object.keys(obj)) if (!TOP.includes(k)) no(`unknown field ${String(k).slice(0, 40)}`);
    if (!Number.isInteger(obj.v) || obj.v < 1) no('no version');
    if (obj.v > SHARE_V) no(`made by a newer Turnip Works (version ${obj.v}; this one reads up to ${SHARE_V}): reload the page`);
    const up = upgradeShare(obj);
    if (!SHARE_KINDS.includes(up.kind)) no(`unknown kind: ${String(up.kind).slice(0, 20)} (one of ${SHARE_KINDS.join(', ')})`);
    const list = (k, spec, max) => { const v = up[k] ?? []; if (!Array.isArray(v)) no(`${k}: not a list`); if (v.length > max) no(`${k}: at most ${max}`); return v.map((x, i) => record(x, spec, `${k}[${i}]`)); };
    const doc = {
      format: SHARE_FORMAT, v: SHARE_V, kind: up.kind, name: T.name(up.name ?? 'Shared build', 'name') || 'Shared build',
      createdAt: up.createdAt != null ? (typeof up.createdAt === 'string' && RE.iso.test(up.createdAt) ? up.createdAt : no('createdAt: not a date')) : null,
      engine: up.engine != null ? T.str(up.engine, 'engine') : null, secrets: up.secrets === undefined ? true : T.bool(up.secrets, 'secrets'),
      base: up.base == null ? 0 : T.num(up.base, 'base'),
      area: up.area != null ? record(up.area, SPEC.area, 'area') : null,
      thumb: up.thumb != null ? (thumbProblem(up.thumb) ? no(thumbProblem(up.thumb)) : up.thumb) : null,
      buildings: list('buildings', SPEC.building, SHARE_LIMITS.buildings), rooms: list('rooms', SPEC.room, SHARE_LIMITS.rooms),
      objects: list('objects', SPEC.object, SHARE_LIMITS.objects), edges: list('edges', SPEC.edge, SHARE_LIMITS.edges),
      pawns: list('pawns', SPEC.pawn, SHARE_LIMITS.pawns), water: list('water', SPEC.water, SHARE_LIMITS.water),
    };
    // refs: unique, and every reference points at something in the file
    const seen = new Set();
    for (const r of [...doc.buildings, ...doc.rooms, ...doc.objects, ...doc.pawns, ...doc.water]) { if (seen.has(r.ref)) no(`ref ${r.ref} is used twice`); seen.add(r.ref); }
    const bRefs = new Set(doc.buildings.map(b => b.ref)), rRefs = new Set(doc.rooms.map(r => r.ref)), oRefs = new Set(doc.objects.map(o => o.ref));
    for (const r of doc.rooms) { if (r.building && !bRefs.has(r.building)) no(`room ${r.ref}: no building ${r.building}`); for (const k of Object.keys(r.plan?.links || {})) if (!rRefs.has(k)) delete r.plan.links[k]; }
    for (const o of doc.objects) { if (o.room && !rRefs.has(o.room)) no(`thing ${o.ref}: no room ${o.room}`); if (o.parent && !oRefs.has(o.parent)) no(`thing ${o.ref}: no thing ${o.parent} under it`); if (o.parent === o.ref) no(`thing ${o.ref} rests on itself`); }
    // a chain of things resting on things is finite (no loops)
    const par = new Map(doc.objects.map(o => [o.ref, o.parent]));
    for (const o of doc.objects) { let p = o.parent, k = 0; while (p && k++ <= doc.objects.length) p = par.get(p); if (p) no(`thing ${o.ref}: a loop of things resting on each other`); }
    if (doc.kind === 'area' && !doc.area) doc.area = { name: doc.name };
    if (!doc.rooms.length && !doc.objects.length && !doc.pawns.length && !doc.water.length && !doc.edges.length) no('there is nothing in it');
    return { doc };
  } catch (e) { if (e instanceof Refuse) return fail(e.message); throw e; }
}

// VERSIONS: UPGRADES[n] turns a version-n document into version n+1 (pure). Version 1 is the first; a later format adds
// its hook here and bumps SHARE_V, and every older file still reads.
export const UPGRADES = {};
export function upgradeShare(doc) {
  let d = doc;
  while (d.v < SHARE_V) { const up = UPGRADES[d.v]; if (!up) throw new Refuse(`cannot read version ${d.v}`); d = up(d); }
  return d;
}

// ======================================================================================================== IMPORT
export function summaryOf(doc) {
  const solid = (doc.rooms || []).filter(r => !HT.isTerrain(r.type));
  const levels = new Set(solid.map(r => HT.levelAt(r.y || 0)));
  return { kind: doc.kind, name: doc.name, rooms: solid.length, hills: (doc.rooms || []).length - solid.length, buildings: (doc.buildings || []).length, things: (doc.objects || []).length, pawns: (doc.pawns || []).length, water: (doc.water || []).length, levels: levels.size, secrets: !!doc.secrets };
}
// the source's rooms as entities (refs as ids), for the height rules (does this room meet the ground?)
const srcEntities = (doc) => Object.fromEntries(doc.rooms.map(r => [r.ref, { id: r.ref, kind: 'room', building: r.building || null, recipe: { type: r.type, x: r.x, z: r.z, w: r.w, d: r.d, ...(r.y && { y: r.y }), ...(r.tall && { tall: r.tall }), ...(r.outline && { outline: r.outline }) } }]));
const rectOf = (r, dxc = 0, dzc = 0, dy = 0) => ({ type: r.type, x: r.x + dxc, z: r.z + dzc, w: r.w, d: r.d, ...((r.y || 0) + (HT.isTerrain(r.type) ? 0 : dy) ? { y: (r.y || 0) + (HT.isTerrain(r.type) ? 0 : dy) } : {}), ...(r.tall > 1 && { tall: r.tall }), ...(r.outline && { outline: r.outline }) });
// THE SHIFT: where the document lands. target: { entities, at: [x, z] feet (the pointer), level (feet, the level in view),
// floorY? (the floor under the pointer, when the caller knows it), keepPlace? (a whole area into a new area: no shift) }
export function placeFor(doc, { entities = {}, at = null, level = 0, floorY = null, keepPlace = false } = {}) {
  const E = entities || {}, rooms = doc.rooms || [];
  const solid = rooms.filter(r => !HT.isTerrain(r.type));
  const grid = rooms.length > 0 || (doc.edges || []).length > 0 || (doc.objects || []).some(o => ['tile', 'kit', 'stair'].includes(o.place) || o.fromEdge);
  let dx = 0, dz = 0, dy = 0;
  if (!keepPlace && at) {
    let cx, cz;
    if (rooms.length) { const x0 = Math.min(...rooms.map(r => r.x)), x1 = Math.max(...rooms.map(r => r.x + r.w)), z0 = Math.min(...rooms.map(r => r.z)), z1 = Math.max(...rooms.map(r => r.z + r.d)); cx = (x0 + x1) / 2 * CELL; cz = (z0 + z1) / 2 * CELL; }
    else { const pts = [...(doc.objects || []).filter(o => !o.parent), ...(doc.pawns || [])].map(e => [e.x, e.z]).concat((doc.water || []).flatMap(w => w.body.pts)); cx = pts.length ? (Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2 : 0; cz = pts.length ? (Math.min(...pts.map(p => p[1])) + Math.max(...pts.map(p => p[1]))) / 2 : 0; }
    if (grid) { dx = Math.round((at[0] - cx) / CELL) * CELL; dz = Math.round((at[1] - cz) / CELL) * CELL; } else { dx = r2(at[0] - cx); dz = r2(at[1] - cz); }
  }
  const dxc = dx / CELL, dzc = dz / CELL;
  if (!keepPlace) {
    const base = doc.base || 0;
    if (solid.length) {
      const S = srcEntities(doc), ground = solid.filter(r => HT.meetsGround(S, S[r.ref]));
      if (ground.length) {
        // a building meets the ground where it lands: the top of a hill under it (the document's own hills included)
        const hills = Object.values(E).filter(HT.isTerrainRoom).map(h => h.recipe).concat(rooms.filter(r => HT.isTerrain(r.type)).map(r => rectOf(r, dxc, dzc)));
        // ON the hill only when its ground storey lies wholly on hilltop; part on, part off, it is DUG INTO the hill at the
        // ground (rooms trump hills: core/height.js), as a room drawn there would be
        const lowest = Math.min(...ground.map(r => r.y || 0));
        let top = Infinity;
        for (const r of ground.filter(g => (g.y || 0) === lowest)) { const rc = rectOf(r, dxc, dzc); for (const [i, j] of cellsOf(rc)) { let t = 0; for (const h of hills) if (hasCell(h, rc.x + i, rc.z + j)) t = Math.max(t, HT.roomY(h)); top = Math.min(top, t); } }
        dy = (Number.isFinite(top) ? top : 0) - lowest;
      } else dy = (base > 0 ? Math.max(0, HT.levelFloor(level || 0)) : 0) - base; // an upper room alone: onto the level in view (the ground on lv 1)
    } else {
      const f = floorY ?? (at ? (HT.floorUnder(E, at[0], at[1], (level || 0) + 0.5)?.y ?? HT.terrainTopAt(E, at[0], at[1])) : base);
      dy = r2(f - base);
    }
  }
  const out = rooms.map(r => ({ ref: r.ref, terrain: HT.isTerrain(r.type), ...rectOf(r, dxc, dzc, dy) }));
  let clash = null;
  for (const rc of out) {
    const hit = HT.roomClash(E, rc, HT.spanOfArgs(E, { y: rc.y || 0, tall: rc.tall || 1 }));
    if (hit) { clash = { ref: rc.ref, hit: hit.id }; break; }
  }
  return { dx, dz, dy, dxc, dzc, rooms: out, clash, grid };
}
// an edge key moved by whole cells and feet: 'h:3:4@10' + (2, -1, 10) -> 'h:5:3@20'
export function shiftKey(key, dxc, dzc, dy) {
  const at = key.indexOf('@'), base = at < 0 ? key : key.slice(0, at), y = (at < 0 ? 0 : +key.slice(at + 1)) + dy;
  let m = base.match(/^([jr]?[hv]):(-?\d+):(-?\d+)$/), out;
  if (m) out = `${m[1]}:${+m[2] + dxc}:${+m[3] + dzc}`;
  else { m = base.match(/^([cp])(-?\d+):(-?\d+)$/); if (!m) return null; out = `${m[1]}${+m[2] + dxc}:${+m[3] + dzc}`; }
  return out + (y ? `@${y}` : '');
}

// THE DOCUMENT AS COMMANDS, dry-run against the target area. target:
//   area        the area the commands are for (its entities and order), as the client's view of it
//   at, level, floorY, keepPlace    as placeFor
//   resolve(cat, sku) -> { sku, url, flat, s, dims, yaw } | null    the IMPORTER's library (null: it lacks that catalog id)
//   roomTypes, families, floors, figs   Sets of what this library has (null: do not check)
//   fallbackType   a room type the library has, for a room type it lacks
//   gm             the importer is the GM side (GM notes travel)      newId     id minting
//   engineVersion  the room engine's version (recorded on each room)
export function planImport(doc, target = {}) {
  const { area: area0 = { id: 'area_import', entities: {}, order: 0, settings: {} }, resolve = null, roomTypes = null, families = null, floors = null, figs = null, fallbackType = null, gm = true, newId = mintId, engineVersion = '' } = target;
  const E0 = area0.entities || {};
  const P = placeFor(doc, { ...target, entities: E0 });
  const { dx, dz, dy, dxc, dzc } = P;
  const report = { standIns: [], substitutes: [], roomTypes: [], families: [], figs: [], left: [] };
  const ops = [], idOf = new Map();
  const mint = (prefix, ref) => { const id = newId(prefix); idOf.set(ref, id); return id; };
  // buildings: new ids, names that do not repeat the target's
  let nB = Object.values(E0).filter(e => e.kind === 'building').length;
  // (a building still wearing its automatic name, "Building 3", takes the next free number here: never a second "Building 1")
  const autoName = (n) => !n || /^Building \d+$/.test(n);
  const bInfo = new Map(doc.buildings.map(b => [b.ref, { id: mint('bld', b.ref), name: autoName(b.name) ? `Building ${++nB}` : b.name, b, named: false }]));
  // objects by room, resolved by the importer's library
  for (const o of doc.objects) mint('obj', o.ref);
  const objArgs = (o) => {
    const x = r2(o.x + dx), z = r2(o.z + dz), y = r2((o.y || 0) + dy);
    let lib = null, standIn = false;
    // (a thing with no SKU has no mesh by nature: a hole in the floor. Only a library piece is looked up.)
    if (o.cat && o.sku) { lib = resolve ? resolve(o.cat, o.sku) : { sku: o.sku, url: null, flat: o.flat }; if (!lib) standIn = true; else if (resolve && lib.sku && lib.sku !== o.sku) report.substitutes.push(o.name || o.cat); }
    if (standIn) report.standIns.push(o.name || o.cat);
    const same = lib && (!o.sku || lib.sku === o.sku);
    const a = {
      id: idOf.get(o.ref), name: o.name || (o.cat || 'thing').replace(/-/g, ' '), cat: o.cat, sku: lib?.sku || o.sku, url: lib?.url || undefined, flat: lib ? !!lib.flat : !!o.flat,
      place: o.place, layer: o.layer, x, y, z, rot: o.rot || 0, yaw: same ? (o.yaw || 0) : (lib?.yaw ?? o.yaw ?? 0), ...(o.quat && { quat: o.quat }),
      s: (same ? o.s : lib?.s) || o.s || undefined, dims: (same ? o.dims : lib?.dims) || o.dims || undefined,
      ...(o.color && { color: o.color }), ...(o.hidden && { hidden: true }), ...(o.pinned && { pinned: true }), ...(o.lit === false && { lit: false }),
      ...(o.rule && { rule: o.rule }), ...(o.orient && { orient: o.orient }), ...(o.rise && { rise: o.rise }), ...(o.stair && { stair: o.stair }), ...(o.down && { down: true }),
      ...(o.fromEdge && { fromEdge: shiftKey(o.fromEdge, dxc, dzc, dy) }), ...(o.fromCave && { fromCave: true }), ...(o.flavor && { flavor: o.flavor }),
      ...(o.factionMissing && { factionMissing: true, factionWasHidden: !!o.factionWasHidden }),
    };
    if (a.fromEdge === null) delete a.fromEdge;
    return a;
  };
  const roomRefs = new Set(doc.rooms.map(r => r.ref));
  const order = (list) => { const byRef = new Map(list.map(o => [o.ref, o])), out = [], done = new Set(); const visit = (o) => { if (done.has(o.ref)) return; done.add(o.ref); if (o.parent && byRef.has(o.parent)) visit(byRef.get(o.parent)); out.push(o); }; list.forEach(visit); return out; }; // parents first
  const inRoom = new Map(); for (const o of order(doc.objects)) if (o.room && roomRefs.has(o.room)) (inRoom.get(o.room) || inRoom.set(o.room, []).get(o.room)).push(o);
  const parentArg = (o) => o.parent ? idOf.get(o.parent) : undefined;
  // rooms: lowest first (what an upper room stands on is made before it); hills first of all (rooms stand on them)
  const rooms = doc.rooms.slice().sort((a, b) => HT.isTerrain(b.type) - HT.isTerrain(a.type) || (a.y || 0) - (b.y || 0));
  for (const r of rooms) mint('room', r.ref);
  const after = [];
  let nNew = nB;
  for (const r of rooms) {
    const terrain = HT.isTerrain(r.type), rc = rectOf(r, dxc, dzc, dy);
    let type = r.type;
    if (roomTypes && !roomTypes.has(type)) { report.roomTypes.push(type); type = terrain ? type : (fallbackType || type); }
    const wf = r.wallFamily && families && !families.has(r.wallFamily) ? (report.families.push(r.wallFamily), undefined) : r.wallFamily;
    const fl = r.floor && floors && !floors.has(r.floor) ? (report.families.push(r.floor), undefined) : r.floor;
    let building;
    if (terrain) building = {};
    else if (r.building) { const B = bInfo.get(r.building); building = { building: B.id, ...(!B.named && { buildingName: B.name }) }; B.named = true; }
    else { const b = HT.buildingAt(E0, rc, HT.spanOfArgs(E0, rc)); building = b ? { building: b } : { building: newId('bld'), buildingName: `Building ${++nNew}` }; }
    // (a room's things ride inside its layout, which the relay takes as one object: each is parsed here as the
    // object.place it amounts to, so nothing of a wrong type gets in that way either)
    const objects = [];
    for (const o of inRoom.get(r.ref) || []) { const { room: _, ...rest } = objArgs(o), a = { ...rest, ...(o.parent && { parent: parentArg(o) }) }, p = parseArgs('object.place', a); if (p.error) return { ok: false, why: `a thing in ${r.name || r.type}: ${p.error}`, ops: [], report, shift: P, rooms: P.rooms }; objects.push({ ...p.args, ...(o.fromCave && { fromCave: true }) }); }
    const plan = r.plan ? { ...(r.plan.b != null && { b: r.plan.b }), ...(r.plan.entry && { entry: r.plan.entry }), links: Object.fromEntries(Object.entries(r.plan.links || {}).map(([k, e]) => [idOf.get(k), e]).filter(([k]) => k)) } : null;
    ops.push({ type: 'room.spawn', args: { id: idOf.get(r.ref), ...building, ...(r.name && { name: r.name }), type, x: rc.x, z: rc.z, w: rc.w, d: rc.d, ...(rc.y && { y: rc.y }), ...(rc.tall && { tall: rc.tall }), seed: r.seed, ...(r.wallSeed != null && { wallSeed: r.wallSeed }), ...(wf && { wallFamily: wf }), ...(fl && { floor: fl }), ...(r.turn && { turn: r.turn }), ...(r.outline && { outline: r.outline }), ...(r.flavor && { flavor: r.flavor }), ...(r.stalagObjects && { stalagObjects: true }), ...(plan && { plan }), engine: 'v2', ...(engineVersion && { engineVersion }), layout: { hash: 'import', summary: 'imported', objects } } });
    const set = { ...(r.fog != null && { fog: r.fog }), ...(r.roof && { roof: r.roof }), ...(r.cliff && { cliff: true }) };
    if (Object.keys(set).length) after.push({ type: 'room.set', args: { id: idOf.get(r.ref), ...set } });
  }
  ops.push(...after);
  for (const B of bInfo.values()) { const set = { ...(B.b.roof && { roof: B.b.roof }), ...(B.b.roofShape && { roofShape: B.b.roofShape }), ...(B.b.gen && { gen: shiftGen(B.b.gen, dxc, dzc) }) }; if (B.named && Object.keys(set).length) ops.push({ type: 'building.set', args: { id: B.id, ...set } }); }
  for (const e of doc.edges) { const key = shiftKey(e.key, dxc, dzc, dy); if (!key || !EDGE_KEY_RE.test(key)) { report.left.push(`a wall edit at ${e.key}`); continue; } ops.push({ type: 'edge.set', args: { key, ...pick(e, ['as', 'piece', 'family', 'pick', 'doorType']) } }); }
  // things not in a room of the file: where they land (the room there, if any, is computed after the rooms exist)
  const loose = order(doc.objects).filter(o => !(o.room && roomRefs.has(o.room)));
  const looseOps = loose.map(o => ({ o, op: { type: 'object.place', args: { ...objArgs(o), ...(o.parent && { parent: parentArg(o) }) } } }));
  for (const o of doc.objects) {
    const id = idOf.get(o.ref);
    if (o.open) ops.push({ _late: true, type: 'object.open', args: { id, open: true } });
    if (o.lightRadius != null) ops.push({ _late: true, type: 'object.set', args: { id, lightRadius: o.lightRadius } });
  }
  const pawnOps = doc.pawns.map(t => {
    let fig = t.fig; if (fig && figs && !figs.has(fig)) { report.figs.push(t.name); fig = undefined; }
    return { type: 'token.create', args: { id: mint('tok', t.ref), name: t.name, x: r2(t.x + dx), z: r2(t.z + dz), ...((t.y || 0) + dy ? { y: r2((t.y || 0) + dy) } : {}), rot: t.rot || 0, ...(t.color && { color: t.color }), ...(fig && { fig }), ...(t.size > 1 && { size: t.size }), ...(t.hidden && { hidden: true }), ...(t.notes && { notes: t.notes }), ...(gm && t.gmNotes && { gmNotes: t.gmNotes }), ...(t.mark && { mark: t.mark }), ...(t.conditions?.length && { conditions: t.conditions }), ...(t.initBonus != null && { initBonus: t.initBonus }), ...(t.visionRadius != null && { visionRadius: t.visionRadius }), ...(t.darkvision != null && { darkvision: t.darkvision }), ...(t.lightCarried != null && { lightCarried: t.lightCarried }) } };
  });
  const waterOps = doc.water.map(w => ({ type: 'water.set', args: { id: mint('wtr', w.ref), body: { ...w.body, pts: w.body.pts.map(([x, z]) => [r2(x + dx), r2(z + dz)]), ...(w.body.y != null && { y: w.body.y + dy }), ...(w.body.ground != null && { ground: w.body.ground + dy }) } } }));
  const hidden = [...doc.rooms.filter(r => r.hidden).map(r => idOf.get(r.ref)), ...doc.water.filter(w => w.hidden).map(w => idOf.get(w.ref))];

  // THE DRY RUN: each op parsed and checked exactly as the relay will, against the area as the ops before it left it
  const BY = 'seat_import0';
  const state = { local: true, seats: { [BY]: { id: BY, kind: 'human', role: gm ? 'gm' : 'player', name: 'import' } }, areas: {}, areaOrder: [], defaults: {} };
  let area = { ...area0, entities: { ...E0 } };
  const out = [];
  const run = (op) => {
    const d = REGISTRY[op.type], p = parseArgs(op.type, op.args);
    if (p.error) return `${op.type}: ${p.error}`;
    const why = d.check ? d.check({ area, state: { ...state, areas: { [area.id]: area } }, by: BY, roomTypes }, p.args) : null;
    if (why) return `${op.type}: ${typeof why === 'object' ? why.why : why}`;
    area = d.apply(area, p.args, { by: BY });
    out.push({ type: op.type, args: p.args });
    return null;
  };
  for (const op of ops.filter(o => !o._late)) { const why = run(op); if (why) return { ok: false, why: plainWhy(why, idOf), ops: [], report, shift: P, rooms: P.rooms }; }
  for (const { o, op } of looseOps) {
    op.args.room = HT.roomAtHeight(area.entities, op.args.x, op.args.z, op.args.y || 0)?.id || undefined;
    if (op.args.room === undefined) delete op.args.room;
    const why = run(op); if (why) return { ok: false, why: plainWhy(why, idOf, o), ops: [], report, shift: P, rooms: P.rooms };
  }
  for (const op of [...ops.filter(o => o._late).map(({ _late, ...op }) => op), ...pawnOps, ...waterOps, ...(hidden.length ? [{ type: 'entity.flag', args: { ids: hidden, hidden: true } }] : [])]) { const why = run(op); if (why) return { ok: false, why: plainWhy(why, idOf), ops: [], report, shift: P, rooms: P.rooms }; }
  report.standIns = [...new Set(report.standIns)]; report.substitutes = [...new Set(report.substitutes)];
  return { ok: true, ops: out, report, shift: P, rooms: P.rooms, ids: [...idOf.values()], top: [...doc.rooms.filter(r => !HT.isTerrain(r.type) && !r.building).map(r => idOf.get(r.ref)), ...[...bInfo.values()].filter(B => B.named).map(B => B.id), ...loose.filter(o => !o.parent).map(o => idOf.get(o.ref)), ...doc.pawns.map(t => idOf.get(t.ref))], area };
}
// a generated building's recipe moved with it
const shiftGen = (g, dxc, dzc) => ({ ...g, ...(Number.isInteger(g.x) && { x: g.x + dxc }), ...(Number.isInteger(g.z) && { z: g.z + dzc }) });
// a refusal in words a GM can use ("overlaps room room_x" -> "it would overlap a room that is already there")
function plainWhy(why, idOf) {
  if (/overlaps room/.test(why)) return 'it would overlap a room that is already there: move it to open ground';
  if (/nothing to stand on|overhang/.test(why)) return 'an upper storey would have nothing under it here: put it on open ground';
  if (/off the map/.test(why)) return 'it would land off the map';
  return why;
}

// the ops of a plan in batches that each fit one relay message (a big area goes in several; a selection is normally one)
export function chunkOps(ops, { maxOps = 1500, maxBytes = 700000 } = {}) {
  const out = []; let cur = [], n = 0;
  for (const op of ops) { const sz = JSON.stringify(op).length; if (cur.length && (cur.length >= maxOps || n + sz > maxBytes)) { out.push(cur); cur = []; n = 0; } cur.push(op); n += sz; }
  if (cur.length) out.push(cur);
  return out;
}

// A WHOLE-CAMPAIGN FILE (the export in Settings ▸ Invites and exports, `turnip-works-campaign`) read through the same door: each area
// becomes a share document of kind 'area', built field by field from the file's entities (which are untrusted too), then
// validated. The old import wrote the file's entities straight in (entities.set); this never does.
export function campaignAreas(file) {
  if (!isObj(file) || !Array.isArray(file.areas) || file.areas.length > 50) return fail('not a Turnip Works campaign file');
  const docs = [];
  for (const [i, a] of file.areas.entries()) {
    if (!isObj(a) || !isObj(a.entities) || Object.keys(a.entities).length > 40000) return fail(`area ${i + 1}: not an area`);
    const ents = {};
    for (const [id, e] of Object.entries(a.entities)) if (isId(id) && isObj(e) && !BAD_KEYS.has(id)) ents[id] = { ...e, id };
    let doc;
    try {
      const settings = isObj(a.settings) && !settingsProblem(a.settings, RULE_KEYS) ? a.settings : undefined;
      doc = exportShare(ents, { kind: 'area', name: String(a.name || 'Imported').slice(0, SHARE_LIMITS.name), area: { name: String(a.name || 'Imported').slice(0, SHARE_LIMITS.name), settings, ground: typeof a.ground === 'string' ? a.ground : undefined } }).doc;
    } catch { return fail(`area ${i + 1}: could not be read`); }
    const v = validateShare(JSON.parse(JSON.stringify(doc)));
    if (v.error) { if (v.error === 'there is nothing in it') { docs.push({ empty: true, name: doc.name, area: doc.area }); continue; } return fail(`area ${i + 1} (${doc.name}): ${v.error}`); }
    docs.push(v.doc);
  }
  return { docs };
}
