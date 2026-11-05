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
// counts and string lengths; `__proto__`, `constructor` and `prototype` keys and unknown fields are refused; nothing that
// looks like a URL or embedded data except the one preview picture (a magic-checked WebP / JPEG / PNG data URL, never
// placed in the world); the result is rebuilt field by field. planImport then turns the document into ORDINARY COMMANDS and
// dry-runs every one through the same parseArgs, check and apply the relay runs on a live command (never an entities.set):
// what the relay would refuse is refused here, before anything is sent.
//
// BEST EFFORT (2026-11-01, Harry, on a map of his own: "it should try and just let the parts that are broken break").
// A refusal now costs the PIECE, not the file. Every rule above still stands and nothing refused ever lands: the bad piece
// is left out, what stood on it goes with it, and all of it is listed (`left`; "Imported 412 of 418 pieces; left out 6").
//   the whole file      only what cannot be read at all: not JSON, too big, too deep, not this format, a newer version, an
//                       unknown kind, a forbidden key at the top level, nothing readable in it
//   a piece             an unknown or forbidden field, a bad required or structural field (a hidden flag too: a secret never
//                       lands visible), anything the reducers refuse; the pieces past a cap
//   a detail            a bad cosmetic field ('?' in SPEC): the piece comes in without it, the list says so
//   what depends on it  a thing in a left-out room or on a left-out thing; a wall edit only that room owned; an upper room
//                       with nothing under it (the reducer's own check)
// Dropping a wrong room onto a place is still the GM's to fix: a ghost that would overlap a room is refused whole (move it).
//
//   exportShare(entities, { kind, ids, name, strip, area, thumb, engineVersion, now })  -> { doc, left }
//   secretsIn(entities, { kind, ids })        what "strip secrets" would take out: { hiddenRooms, hiddenThings, pawns, traps, gmNotes }
//   parseShare(text) -> { doc, left, total } | { error }   validateShare(obj) likewise    upgradeShare(doc)
//   placeFor(doc, target)                     the cheap part, for the ghost on every pointer move: the shift and each room's rect
//   planImport(doc, target)                   -> { ok, why?, ops, report, shift, rooms, ids }; report.pieces { landed, total }, report.left
//   leftGroups(left), leftText(report)        what was left out, in words a GM can read
//   summaryOf(doc)                            counts for a preview: rooms, buildings, things, pawns, levels
import { REGISTRY, parseArgs, EDGE_KEY_RE, ownsKey } from './commands.js';
import * as HT from './height.js';
import { newId as mintId, isId } from './ids.js';
import { RULE_KEYS, settingsProblem } from './state.js';
import { cellsOf, hasCell, perimeterKeys } from './footprint.js';
import { conditionsProblem } from './conditions.js';
import { STAIR_CODES } from './stairs.js';

export const SHARE_FORMAT = 'turnip-works-share';
export const SHARE_V = 1;
export const SHARE_KINDS = ['area', 'building', 'room', 'group'];
export const SHARE_EXT = '.turnip.json';
export const SHARE_LIMITS = Object.freeze({
  bytes: 3 * 1024 * 1024,   // the whole file (the picture included)
  thumb: 300 * 1024,        // the preview picture, decoded
  depth: 8,                 // nesting of objects and arrays (the format itself needs 6)
  rooms: 400, buildings: 120, objects: 12000, edges: 8000, pawns: 400, water: 200,
  name: 60, str: 80, note: 4000, outline: 200, waterPts: 400,
  left: 200,                // entries a report of what was left out keeps (the count stays true past it)
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

// A DISMISSED STAIR WARNING (core/stairs.js noteOff) stays in its own world. A campaign file is that world again, so its
// import keeps the dismissal (keepNotes, from campaignAreas only). A shared build lands in someone else's world, so its
// stairs say what they say there, and its file does not carry the field at all: a build with it in would lose that
// stair at any older page, because validateShare refuses a field it does not know.
export function exportShare(entities, { kind = 'group', ids = [], name = '', strip = false, area = null, thumb = null, engineVersion = '', now = new Date(), keepNotes = false } = {}) {
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
  const objects = objIds.map(id => { const o0 = E[id], o = { ...o0, x: R(o0.x, 100), z: R(o0.z, 100), ...(o0.y != null && { y: R(o0.y, 1000) }), ...(o0.rot != null && { rot: R(o0.rot, 1e4) }), ...(o0.s && { s: vec(o0.s, 1e4) }), ...(o0.dims && { dims: vec(o0.dims, 1000) }), ...(o0.quat && { quat: vec(o0.quat, 1e6) }) }; return { ref: ref.get(id), ...(o.room && ref.has(o.room) && { room: ref.get(o.room) }), ...(o.parent && ref.has(o.parent) && { parent: ref.get(o.parent) }), ...pick(o, OBJ_KEYS), ...(keepNotes && o.noteOff && { noteOff: o.noteOff }), ...(o.lit === false && { lit: false }), ...(o.y === 0 && { y: undefined }) }; }).map(o => JSON.parse(JSON.stringify(o)));
  const edges = [...c.edges].map(id => pick(E[id], EDGE_KEYS));
  const pawns = [...c.pawns].map(id => { const t = E[id]; return { ref: refOf(PAWN_REF, id), ...pick(t, PAWN_KEYS), ...(Array.isArray(t.conditions) && !t.conditions.length && { conditions: undefined }) }; }).map(t => JSON.parse(JSON.stringify(t)));
  const water = [...c.water].map(id => ({ ref: refOf(WATER_REF, id), body: E[id].body, ...(E[id].hidden && { hidden: true }) }));
  const things = [...objIds, ...c.pawns].map(id => E[id]);
  const label = name || (kind === 'area' ? area?.name : kind === 'building' ? E[ids[0]]?.name : kind === 'room' ? (E[ids[0]]?.name || E[ids[0]]?.recipe?.type) : '') || (kind === 'group' ? `${objects.length + pawns.length} things` : 'Shared build');
  const doc = {
    format: SHARE_FORMAT, v: SHARE_V, kind, name: String(label).slice(0, SHARE_LIMITS.name), createdAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    ...(engineVersion && { engine: String(engineVersion).slice(0, SHARE_LIMITS.str) }), secrets: !strip,
    base: (() => { try { return baseOf(E, roomIds, things); } catch { return 0; } })(), // (a campaign file's rooms are untrusted: a broken one is left out later, it does not stop the rest)
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
  let obj;
  try { obj = JSON.parse(text); } catch { return fail('not JSON'); }
  return validateShare(obj);
}

// WHAT WAS LEFT OUT. pieces: whole pieces that did not come in. details: pieces that came in without some part. list: what a
// GM reads, capped (a hostile file cannot grow it), each entry cleaned of control characters and cut short. It is text for
// the screen and is always shown escaped.
export const newLeft = (from = null) => ({ pieces: from?.pieces || 0, details: from?.details || 0, list: [...(from?.list || [])] });
const clean = (s, n) => String(s).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').slice(0, n);
export function leftOut(L, what, why, piece = true, n = 1) {
  if (piece) L.pieces += n; else L.details += n;
  if (L.list.length < SHARE_LIMITS.left) L.list.push({ what: clean(what, 100), why: clean(plainRefusal(why), 200), ...(piece ? {} : { detail: true }) });
}
// a validator's or a reducer's refusal, in words a GM can use ("objects[12].url: unknown field" -> "an unknown field (url)")
function plainRefusal(why) {
  const w = String(why).replace(/^\w+\[\d+\]\.?/, '').replace(/^: /, '').replace(/^[a-z]+\.[a-z]+: /, ''); // (no list index, no command name)
  let m = w.match(/^([^:]+): unknown field$/); if (m) return `an unknown field (${m[1]})`;
  m = w.match(/^([^:]+): missing$/); if (m) return `it has no ${m[1]}`;
  if (/overlaps room/.test(w)) return 'it overlaps another room';
  if (/nothing to stand on|overhang/.test(w)) return 'nothing under it to stand on';
  if (/off the map/.test(w)) return 'it is off the map';
  return w;
}
// grouped by reason, the most pieces first: [{ why, n, names, detail }]
export function leftGroups(L) {
  const groups = new Map();
  for (const e of L?.list || []) { const k = `${e.detail ? 'd' : 'p'}|${e.why}`; const g = groups.get(k) || groups.set(k, { why: e.why, n: 0, names: [], detail: !!e.detail }).get(k); g.n++; g.names.push(e.what); }
  return [...groups.values()].sort((a, b) => a.detail - b.detail || b.n - a.n);
}
// the line for a toast and a report: "Imported 412 of 418 pieces; left out 6", or null when everything came
export function leftText(report) {
  const P = report?.pieces, L = report?.left; if (!P || !L) return null;
  if (L.pieces) return `Imported ${P.landed} of ${P.total} piece${P.total === 1 ? '' : 's'}; left out ${L.pieces}`;
  return L.details ? `Imported all ${P.total} piece${P.total === 1 ? '' : 's'}; ${L.details} came in without some detail` : null;
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
const hasUrl = (s) => /^\s*(data|javascript|vbscript|blob|file):/i.test(s) || /[a-z][a-z0-9+.-]*:\/\//i.test(s);
const noUrl = (s, where) => { if (hasUrl(s)) no(`${where}: links and embedded files are not allowed in a shared build`); return s; };
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
  stairCode: (v, w) => STAIR_CODES.includes(v) ? v : no(`${w}: not a stair warning`),
  vec3: (v, w) => Array.isArray(v) && v.length === 3 && v.every(x => finite(x)) ? [v[0], v[1], v[2]] : no(`${w}: not [x, y, z]`),
  quat: (v, w) => Array.isArray(v) && v.length === 4 && v.every(x => finite(x, 2)) ? [v[0], v[1], v[2], v[3]] : no(`${w}: not a quaternion`),
  outline: (v, w) => Array.isArray(v) && v.length >= 3 && v.length <= SHARE_LIMITS.outline && v.every(p => Array.isArray(p) && p.length === 2 && p.every(x => Number.isInteger(x) && Math.abs(x) <= 64)) ? v.map(([a, b]) => [a, b]) : no(`${w}: not an outline`),
  // (the game's own rule, so the file is never stricter than the game: "exhaustion 2" is a condition, 2026-11-01)
  conditions: (v, w) => { const why = conditionsProblem(v); if (why) no(`${w}: ${why}`); return v.slice(); },
  edgeDir: (v, w) => Array.isArray(v) && v.length >= 3 && v.length <= 4 && typeof v[0] === 'string' && /^[a-z]{1,3}$/.test(v[0]) && v.slice(1).every(x => Number.isInteger(x) && Math.abs(x) <= 64) ? v.slice() : no(`${w}: not a plan door`),
  plan: (v, w) => {
    if (!isObj(v)) no(`${w}: not a plan`);
    const out = {}; for (const k of Object.keys(v)) if (!['b', 'entry', 'links'].includes(k)) no(`${w}.${k}: unknown`);
    if (v.b !== undefined) out.b = typeof v.b === 'string' ? T.word(v.b, `${w}.b`) : T.int(v.b, `${w}.b`);
    if (v.entry !== undefined) out.entry = T.edgeDir(v.entry, `${w}.entry`);
    if (v.links !== undefined) { if (!isObj(v.links) || Object.keys(v.links).length > 32) no(`${w}.links: not a plan`); out.links = {}; for (const [k, e] of Object.entries(v.links)) out.links[T.ref(k, `${w}.links`)] = T.edgeDir(e, `${w}.links.${k}`); }
    return out;
  },
  // (the game's own rule again: a roof.trim is a chimney or dormer the GM moved or took off, in feet from the room's corner,
  // so it needs no shifting. Rebuilt piece by piece, 2026-11-01.)
  roof: (v, w) => {
    const why = HT.roofProblem(v); if (why) no(`${w}: ${why}`);
    const out = {}; for (const [k, x] of Object.entries(v)) out[k] = k === 'trim' ? Object.fromEntries(Object.entries(x).filter(([, t]) => t).map(([p, t]) => [p, t.gone ? { gone: true } : { at: [t.at[0], t.at[1]] }])) : x;
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
// '!' required: bad or missing, the piece is left out. Plain: optional, but if present and bad the piece is left out
// (what it IS, where it stands, whether it is hidden). '?' a detail: if bad, the piece comes in without it and the list says so.
// A name is the game's own length: 80 characters for a thing, a pawn or a building, 60 for a room.
const SPEC = {
  building: { ref: 'ref!', name: 'str?', roof: 'word?', roofShape: 'word?', gen: 'gen?' },
  room: { ref: 'ref!', building: 'ref?', name: 'name?', hidden: 'bool', fog: 'num?', roof: 'roof?', cliff: 'bool?', type: 'cat!', x: 'int!', z: 'int!', w: 'int!', d: 'int!', y: 'int', tall: 'int', seed: 'int!', wallSeed: 'int?', wallFamily: 'word?', floor: 'word?', turn: 'int', outline: 'outline', flavor: 'str?', stalagObjects: 'bool?', plan: 'plan?' },
  object: { ref: 'ref!', room: 'ref', parent: 'ref', name: 'str?', cat: 'cat', sku: 'sku', flat: 'bool', place: 'word', layer: 'word', x: 'num!', y: 'num', z: 'num!', rot: 'num', yaw: 'num', quat: 'quat', s: 'vec3', dims: 'vec3', color: 'color?', hidden: 'bool', pinned: 'bool?', open: 'bool?', lit: 'bool?', rule: 'str', orient: 'str', rise: 'int', stair: 'str', down: 'bool', noteOff: 'stairCode?', fromEdge: 'key', fromCave: 'bool', flavor: 'str?', factionMissing: 'bool?', factionWasHidden: 'bool?', lightRadius: 'num?' },
  edge: { key: 'key!', as: 'word', piece: 'sku', family: 'word', pick: 'int', doorType: 'word', hidden: 'bool' },
  pawn: { ref: 'ref!', name: 'str!', x: 'num!', z: 'num!', y: 'num', rot: 'num?', color: 'color?', fig: 'fig?', size: 'int?', hidden: 'bool', notes: 'note?', gmNotes: 'note?', mark: 'word?', conditions: 'conditions?', initBonus: 'int?', visionRadius: 'num?', darkvision: 'num?', lightCarried: 'num?' },
  water: { ref: 'ref!', body: 'body!', hidden: 'bool' },
  area: { name: 'name!', settings: 'settings?', ground: 'ground?' },
};
// a forbidden key anywhere inside a value (JSON.parse makes `__proto__` an ordinary own key: it is findable, and harmless until copied)
const badKeyIn = (v, d = 0) => { if (!v || typeof v !== 'object') return null; if (d > 32) return 'nested'; for (const k of Object.keys(v)) { if (BAD_KEYS.has(k)) return k; const b = badKeyIn(v[k], d + 1); if (b) return b; } return null; };
function record(v, spec, where, detail = null) {
  if (!isObj(v)) no(`${where}: not a record`);
  const bad = badKeyIn(v); if (bad) no(`refused: it has a "${bad}" key`);
  for (const k of Object.keys(v)) if (!Object.hasOwn(spec, k)) no(`${where}.${k.slice(0, 40)}: unknown field`);
  const out = {};
  for (const [k, s0] of Object.entries(spec)) {
    const tail = s0.at(-1), req = tail === '!', soft = tail === '?', s = req || soft ? s0.slice(0, -1) : s0;
    if (v[k] === undefined || v[k] === null) { if (req) no(`${where}.${k}: missing`); continue; }
    if (!soft || !detail) { out[k] = T[s](v[k], `${where}.${k}`); continue; }
    try { out[k] = T[s](v[k], `${where}.${k}`); } catch (e) { if (!(e instanceof Refuse)) throw e; detail(k, e.message); }
  }
  return out;
}
const NOUN = { buildings: 'building', rooms: 'room', objects: 'thing', edges: 'wall edit', pawns: 'creature', water: 'water' };
// a piece's name for the list: its own if that is safe to repeat, else its catalog id or room type, else its place in the file
function labelOf(list, v, i) {
  const safe = (s, re) => typeof s === 'string' && s && s.length <= SHARE_LIMITS.str && !hasUrl(s) && (!re || re.test(s));
  const name = !isObj(v) ? null : safe(v.name) ? v.name : safe(v.cat, RE.cat) ? v.cat.replace(/-/g, ' ') : safe(v.type, RE.cat) ? v.type.replace(/-/g, ' ') : null;
  return name ? `${NOUN[list]} "${name}"` : `${NOUN[list]} ${i + 1}`;
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
  const L = newLeft();
  try {
    if (!isObj(obj)) no('not a Turnip Works build');
    if (obj.format !== SHARE_FORMAT) no(obj.kind === 'turnip-works-campaign' ? 'that is a whole-campaign file: import it from Settings ▸ Invites and exports' : 'not a Turnip Works build');
    for (const k of Object.keys(obj)) if (BAD_KEYS.has(k)) no(`refused: the file has a "${k}" key`);
    if (!Number.isInteger(obj.v) || obj.v < 1) no('no version');
    if (obj.v > SHARE_V) no(`made by a newer Turnip Works (version ${obj.v}; this one reads up to ${SHARE_V}): reload the page`);
    const up = upgradeShare(obj);
    if (!SHARE_KINDS.includes(up.kind)) no(`unknown kind: ${String(up.kind).slice(0, 20)} (one of ${SHARE_KINDS.join(', ')})`);
    for (const k of Object.keys(up)) if (!TOP.includes(k)) leftOut(L, 'the file', `an unknown field (${String(k).slice(0, 40)})`, false);
    // the file's own fields: a bad one goes back to its default, and nothing in the world depends on it
    const soft = (k, read, dflt) => { if (up[k] == null) return dflt; try { return read(up[k]); } catch (e) { if (!(e instanceof Refuse)) throw e; leftOut(L, `the file's ${k}`, e.message, false); return dflt; } };
    let total = 0;
    const list = (k, spec, max) => {
      const v = up[k] ?? [], out = [];
      if (!Array.isArray(v)) { leftOut(L, `the file's ${k}`, `${k}: not a list`, false); return out; }
      if (k !== 'buildings') total += v.length;
      v.slice(0, max).forEach((x, i) => {
        const label = labelOf(k, x, i);
        try { out.push(record(x, spec, `${k}[${i}]`, (f, why) => leftOut(L, `${label}: its ${f}`, why, false))); }
        catch (e) { leftOut(L, label, e instanceof Refuse ? e.message : 'it could not be read', k !== 'buildings'); } // (a building is a label on its rooms: they come in without it)
      });
      if (v.length > max) leftOut(L, `${v.length - max} past the limit`, `${k}: at most ${max}`, k !== 'buildings', v.length - max);
      return out;
    };
    const doc = {
      format: SHARE_FORMAT, v: SHARE_V, kind: up.kind, name: soft('name', v => T.name(v, 'name'), 'Shared build') || 'Shared build',
      createdAt: soft('createdAt', v => typeof v === 'string' && RE.iso.test(v) ? v : no('createdAt: not a date'), null),
      engine: soft('engine', v => T.str(v, 'engine'), null), secrets: soft('secrets', v => T.bool(v, 'secrets'), true),
      base: soft('base', v => T.num(v, 'base'), 0),
      area: soft('area', v => record(v, SPEC.area, 'area', (f, why) => leftOut(L, `the area's ${f}`, why, false)), null),
      thumb: soft('thumb', v => thumbProblem(v) ? no(thumbProblem(v)) : v, null),
      buildings: list('buildings', SPEC.building, SHARE_LIMITS.buildings), rooms: list('rooms', SPEC.room, SHARE_LIMITS.rooms),
      objects: list('objects', SPEC.object, SHARE_LIMITS.objects), edges: list('edges', SPEC.edge, SHARE_LIMITS.edges),
      pawns: list('pawns', SPEC.pawn, SHARE_LIMITS.pawns), water: list('water', SPEC.water, SHARE_LIMITS.water),
    };
    // refs: unique (the first keeps it), and every reference points at something in the file
    const seen = new Set();
    for (const k of ['buildings', 'rooms', 'objects', 'pawns', 'water']) doc[k] = doc[k].filter((r, i) => { if (!seen.has(r.ref)) { seen.add(r.ref); return true; } leftOut(L, labelOf(k, r, i), `ref ${r.ref} is used twice`, k !== 'buildings'); return false; });
    const bRefs = new Set(doc.buildings.map(b => b.ref)), rRefs = new Set(doc.rooms.map(r => r.ref));
    for (const r of doc.rooms) { if (r.building && !bRefs.has(r.building)) { delete r.building; leftOut(L, labelOf('rooms', r, 0), 'its building was left out: it stands on its own', false); } for (const k of Object.keys(r.plan?.links || {})) if (!rRefs.has(k)) delete r.plan.links[k]; }
    doc.objects = thingsThatStand(doc.objects, rRefs, L);
    if (doc.kind === 'area' && !doc.area) doc.area = { name: doc.name };
    if (!doc.rooms.length && !doc.objects.length && !doc.pawns.length && !doc.water.length && !doc.edges.length) no(L.list.length ? `nothing in it could be read: ${L.list[0].what}: ${L.list[0].why}` : 'there is nothing in it');
    return { doc, left: L, total };
  } catch (e) { if (e instanceof Refuse) return fail(e.message); throw e; }
}
// the things whose room and support are in the file; the rest are left out, and what rested on them goes with them (one
// pass over the list however long the chain: a file may hold 12 000 things in a line)
function thingsThatStand(objects, rRefs, L) {
  const byRef = new Map(objects.map(o => [o.ref, o])), kids = new Map(), gone = new Map();
  for (const o of objects) if (o.parent) (kids.get(o.parent) || kids.set(o.parent, []).get(o.parent)).push(o);
  const drop = (o0, why0) => { const stack = [[o0, why0]]; while (stack.length) { const [o, why] = stack.pop(); if (gone.has(o.ref)) continue; gone.set(o.ref, why); for (const c of kids.get(o.ref) || []) stack.push([c, 'what it rested on was left out']); } };
  for (const o of objects) {
    if (o.room && !rRefs.has(o.room)) drop(o, 'its room was left out');
    else if (o.parent === o.ref) drop(o, 'it rests on itself');
    else if (o.parent && !byRef.has(o.parent)) drop(o, 'what it rested on was left out');
  }
  // loops of things resting on each other (each thing is walked once)
  const done = new Set();
  for (const o of objects) {
    const path = new Set(); let p = o;
    while (p && !done.has(p.ref) && !path.has(p.ref)) { path.add(p.ref); p = p.parent ? byRef.get(p.parent) : null; }
    if (p && path.has(p.ref)) drop(p, 'a loop of things resting on each other');
    for (const r of path) done.add(r);
  }
  for (const [i, o] of objects.entries()) if (gone.has(o.ref)) leftOut(L, labelOf('objects', o, i), gone.get(o.ref));
  return objects.filter(o => !gone.has(o.ref));
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
//   left           what reading the file already left out (parseShare's `left`): the plan's report carries it on
export function planImport(doc, target = {}) {
  const { area: area0 = { id: 'area_import', entities: {}, order: 0, settings: {} }, resolve = null, roomTypes = null, families = null, floors = null, figs = null, fallbackType = null, gm = true, newId = mintId, engineVersion = '', keepPlace = false, left: readLeft = null } = target;
  const E0 = area0.entities || {};
  const P = placeFor(doc, { ...target, entities: E0 });
  const { dx, dz, dy, dxc, dzc } = P;
  const L = newLeft(readLeft), report = { standIns: [], substitutes: [], roomTypes: [], families: [], figs: [], left: L, pieces: { landed: 0, total: 0 } };
  const idOf = new Map();
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
      ...(o.rule && { rule: o.rule }), ...(o.orient && { orient: o.orient }), ...(o.rise && { rise: o.rise }), ...(o.stair && { stair: o.stair }), ...(o.down && { down: true }), ...(o.noteOff && { noteOff: o.noteOff }),
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
  // THE DRY RUN: each op parsed and checked exactly as the relay will, against the area as the ops before it left it. A
  // refused op costs its piece (and what depends on it), never the plan, and nothing refused reaches `out`.
  const BY = 'seat_import0';
  const state = { local: true, seats: { [BY]: { id: BY, kind: 'human', role: gm ? 'gm' : 'player', name: 'import' } }, areas: {}, areaOrder: [], defaults: {} };
  let area = { ...area0, entities: { ...E0 } };
  const out = [];
  const run = (op) => {
    const d = REGISTRY[op.type], p = parseArgs(op.type, op.args);
    if (p.error) return `${op.type}: ${p.error}`;
    try {
      const why = d.check ? d.check({ area, state: { ...state, areas: { [area.id]: area } }, by: BY, roomTypes }, p.args) : null;
      if (why) return `${op.type}: ${typeof why === 'object' ? why.why : why}`;
      area = d.apply(area, p.args, { by: BY });
    } catch { return `${op.type}: it could not be applied`; }
    out.push({ type: op.type, args: p.args });
    return null;
  };
  const refuse = (why) => ({ ok: false, why: plainWhy(why, idOf), ops: [], report, shift: P, rooms: P.rooms });
  const goneIds = new Set(), goneRooms = [];
  // a thing left out, and everything resting on it
  const kids = new Map(); for (const o of doc.objects) if (o.parent) (kids.get(o.parent) || kids.set(o.parent, []).get(o.parent)).push(o);
  const lose = (o0, why0) => { const stack = [[o0, why0]]; while (stack.length) { const [o, why] = stack.pop(), id = idOf.get(o.ref); if (goneIds.has(id)) continue; goneIds.add(id); leftOut(L, labelOf('objects', o, 0), why); for (const c of kids.get(o.ref) || []) stack.push([c, 'what it rested on was left out']); } };
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
    else if (r.building) { const B = bInfo.get(r.building); building = { building: B.id, ...(!B.named && { buildingName: B.name }) }; }
    else { const b = HT.buildingAt(area.entities, rc, HT.spanOfArgs(area.entities, rc)); building = b ? { building: b } : { building: newId('bld'), buildingName: `Building ${++nNew}` }; }
    // (a room's things ride inside its layout, which the relay takes as one object: each is parsed and checked here as the
    // object.place it amounts to, so nothing of a wrong type gets in that way either)
    const objects = [], riding = [];
    for (const o of inRoom.get(r.ref) || []) {
      if (goneIds.has(idOf.get(o.ref))) continue;
      const { room: _, ...rest } = objArgs(o), a = { ...rest, ...(o.parent && { parent: parentArg(o) }) }, p = parseArgs('object.place', a);
      const why = p.error || REGISTRY['object.place'].check({ area }, p.args);
      if (why) { lose(o, why); continue; }
      objects.push({ ...p.args, ...(o.fromCave && { fromCave: true }) }); riding.push(o);
    }
    const plan = r.plan ? { ...(r.plan.b != null && { b: r.plan.b }), ...(r.plan.entry && { entry: r.plan.entry }), links: Object.fromEntries(Object.entries(r.plan.links || {}).map(([k, e]) => [idOf.get(k), e]).filter(([k]) => k)) } : null;
    const why = run({ type: 'room.spawn', args: { id: idOf.get(r.ref), ...building, ...(r.name && { name: r.name }), type, x: rc.x, z: rc.z, w: rc.w, d: rc.d, ...(rc.y && { y: rc.y }), ...(rc.tall && { tall: rc.tall }), seed: r.seed, ...(r.wallSeed != null && { wallSeed: r.wallSeed }), ...(wf && { wallFamily: wf }), ...(fl && { floor: fl }), ...(r.turn && { turn: r.turn }), ...(r.outline && { outline: r.outline }), ...(r.flavor && { flavor: r.flavor }), ...(r.stalagObjects && { stalagObjects: true }), ...(plan && { plan }), engine: 'v2', ...(engineVersion && { engineVersion }), layout: { hash: 'import', summary: 'imported', objects } } });
    if (why) {
      // a ghost put down where it does not fit is the GM's to move, not a broken file: on one of the target's rooms, off the
      // map, or with nothing under it when nothing of the file is missing (a room left out above is the file's fault)
      const hit = why.match(/overlaps room (\S+)/)?.[1];
      if (!keepPlace && (hit ? !!E0[hit] : /off the map/.test(why) || (/nothing to stand on|overhang/.test(why) && !goneRooms.length && !readLeft?.pieces))) return refuse(why);
      goneIds.add(idOf.get(r.ref)); goneRooms.push(rc); leftOut(L, labelOf('rooms', r, 0), why);
      for (const o of riding) lose(o, 'its room was left out');
      continue;
    }
    if (r.building) bInfo.get(r.building).named = true;
    const set = { ...(r.fog != null && { fog: r.fog }), ...(r.roof && { roof: r.roof }), ...(r.cliff && { cliff: true }) };
    if (Object.keys(set).length) after.push({ r, op: { type: 'room.set', args: { id: idOf.get(r.ref), ...set } } });
  }
  for (const { r, op } of after) { const why = run(op); if (why) leftOut(L, `${labelOf('rooms', r, 0)}: its roof, fog or cliff`, why, false); }
  for (const B of bInfo.values()) { const set = { ...(B.b.roof && { roof: B.b.roof }), ...(B.b.roofShape && { roofShape: B.b.roofShape }), ...(B.b.gen && { gen: shiftGen(B.b.gen, dxc, dzc) }) }; if (B.named && Object.keys(set).length) { const why = run({ type: 'building.set', args: { id: B.id, ...set } }); if (why) leftOut(L, `${labelOf('buildings', B.b, 0)}: its roof or recipe`, why, false); } }
  // a wall edit goes with its wall: one only a left-out room had (a door in that wall) has nothing to edit
  const lostWalls = new Set(goneRooms.flatMap(perimeterKeys)), keptWalls = new Set(goneRooms.length ? Object.values(area.entities).filter(e => e.kind === 'room').flatMap(e => perimeterKeys(e.recipe)) : []);
  for (const e of doc.edges) {
    const key = shiftKey(e.key, dxc, dzc, dy), what = `a wall edit at ${e.key}`;
    if (!key || !EDGE_KEY_RE.test(key)) { leftOut(L, what, 'it does not fit the grid here'); continue; }
    if (lostWalls.has(key) && !keptWalls.has(key)) { leftOut(L, what, 'its room was left out'); continue; }
    const why = run({ type: 'edge.set', args: { key, ...pick(e, ['as', 'piece', 'family', 'pick', 'doorType']) } }); if (why) leftOut(L, what, why);
  }
  // things not in a room of the file: where they land (the room there, if any, is computed after the rooms exist)
  const loose = order(doc.objects).filter(o => !(o.room && roomRefs.has(o.room)));
  for (const o of loose) {
    if (goneIds.has(idOf.get(o.ref))) continue;
    const args = { ...objArgs(o), ...(o.parent && { parent: parentArg(o) }) };
    args.room = HT.roomAtHeight(area.entities, args.x, args.z, args.y || 0)?.id || undefined;
    if (args.room === undefined) delete args.room;
    const why = run({ type: 'object.place', args }); if (why) lose(o, why);
  }
  for (const o of doc.objects) {
    const id = idOf.get(o.ref); if (goneIds.has(id)) continue;
    if (o.open) { const why = run({ type: 'object.open', args: { id, open: true } }); if (why) leftOut(L, `${labelOf('objects', o, 0)}: it was open`, why, false); }
    if (o.lightRadius != null) { const why = run({ type: 'object.set', args: { id, lightRadius: o.lightRadius } }); if (why) leftOut(L, `${labelOf('objects', o, 0)}: its light radius`, why, false); }
  }
  for (const t of doc.pawns) {
    let fig = t.fig; if (fig && figs && !figs.has(fig)) { report.figs.push(t.name); fig = undefined; }
    const id = mint('tok', t.ref), why = run({ type: 'token.create', args: { id, name: t.name, x: r2(t.x + dx), z: r2(t.z + dz), ...((t.y || 0) + dy ? { y: r2((t.y || 0) + dy) } : {}), rot: t.rot || 0, ...(t.color && { color: t.color }), ...(fig && { fig }), ...(t.size > 1 && { size: t.size }), ...(t.hidden && { hidden: true }), ...(t.notes && { notes: t.notes }), ...(gm && t.gmNotes && { gmNotes: t.gmNotes }), ...(t.mark && { mark: t.mark }), ...(t.conditions?.length && { conditions: t.conditions }), ...(t.initBonus != null && { initBonus: t.initBonus }), ...(t.visionRadius != null && { visionRadius: t.visionRadius }), ...(t.darkvision != null && { darkvision: t.darkvision }), ...(t.lightCarried != null && { lightCarried: t.lightCarried }) } });
    if (why) { goneIds.add(id); leftOut(L, labelOf('pawns', t, 0), why); }
  }
  for (const w of doc.water) {
    const id = mint('wtr', w.ref), why = run({ type: 'water.set', args: { id, body: { ...w.body, pts: w.body.pts.map(([x, z]) => [r2(x + dx), r2(z + dz)]), ...(w.body.y != null && { y: w.body.y + dy }), ...(w.body.ground != null && { ground: w.body.ground + dy }) } } });
    if (why) { goneIds.add(id); leftOut(L, labelOf('water', w, 0), why); }
  }
  const hidden = [...doc.rooms.filter(r => r.hidden).map(r => idOf.get(r.ref)), ...doc.water.filter(w => w.hidden).map(w => idOf.get(w.ref))].filter(id => !goneIds.has(id));
  // (a hidden room that could not be hidden must not land at all: this one refusal is the whole plan's)
  if (hidden.length) { const why = run({ type: 'entity.flag', args: { ids: hidden, hidden: true } }); if (why) return refuse(why); }
  // (a thing that rested on something left out later in the run: its room's layout was made before that was known)
  for (const op of out) if (op.type === 'room.spawn') op.args.layout = { ...op.args.layout, objects: op.args.layout.objects.filter(o => !goneIds.has(o.id)) };
  report.standIns = [...new Set(report.standIns)]; report.substitutes = [...new Set(report.substitutes)];
  report.pieces.landed = out.reduce((n, op) => n + (op.type === 'room.spawn' ? 1 + op.args.layout.objects.length : ['object.place', 'edge.set', 'token.create', 'water.set'].includes(op.type) ? 1 : 0), 0);
  report.pieces.total = doc.rooms.length + doc.objects.length + doc.edges.length + doc.pawns.length + doc.water.length + (readLeft?.pieces || 0);
  if (!report.pieces.landed) return refuse(L.list.find(e => !e.detail)?.why || 'nothing in it could be placed');
  return { ok: true, ops: out, report, shift: P, rooms: P.rooms, ids: [...idOf.values()].filter(id => !goneIds.has(id)), top: [...doc.rooms.filter(r => !HT.isTerrain(r.type) && !r.building).map(r => idOf.get(r.ref)), ...[...bInfo.values()].filter(B => B.named).map(B => B.id), ...loose.filter(o => !o.parent).map(o => idOf.get(o.ref)), ...doc.pawns.map(t => idOf.get(t.ref))].filter(id => !goneIds.has(id)), area };
}
// a generated building's recipe moved with it
const shiftGen = (g, dxc, dzc) => ({ ...g, ...(Number.isInteger(g.x) && { x: g.x + dxc }), ...(Number.isInteger(g.z) && { z: g.z + dzc }) });
// a refusal in words a GM can use ("overlaps room room_x" -> "it would overlap a room that is already there")
function plainWhy(why, idOf) {
  if (/overlaps room/.test(why)) return 'it would overlap a room that is already there: move it to open ground';
  if (/nothing to stand on|overhang/.test(why)) return 'an upper storey would have nothing under it here: put it on open ground';
  if (/off the map/.test(why)) return 'it would land off the map';
  return String(why).replace(/^[a-z]+\.[a-z]+: /, '');
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
// Best effort here too: an area that cannot be read is left out and the others come in. docs[i] is an area's document, or
// { empty, name, area } for one with nothing in it; reads[i] its { left, total, players }; `left` what could not be read at all.
export function campaignAreas(file) {
  if (!isObj(file) || !Array.isArray(file.areas)) return fail('not a Turnip Works campaign file');
  const docs = [], reads = [], left = newLeft();
  if (file.areas.length > 50) leftOut(left, `${file.areas.length - 50} areas past the limit`, 'a file holds at most 50 areas', true, file.areas.length - 50);
  for (const [i, a] of file.areas.slice(0, 50).entries()) {
    const label = isObj(a) && typeof a.name === 'string' && !hasUrl(a.name) ? `area "${a.name.slice(0, SHARE_LIMITS.name)}"` : `area ${i + 1}`;
    if (!isObj(a) || !isObj(a.entities) || Object.keys(a.entities).length > 40000) { leftOut(left, label, 'it is not an area'); continue; }
    const pre = newLeft(), ents = {};
    for (const [id, e] of Object.entries(a.entities)) { if (isId(id) && isObj(e) && !BAD_KEYS.has(id)) ents[id] = { ...e, id }; else leftOut(pre, 'a piece with no proper id', 'it could not be read'); }
    let doc, players = 0;
    try {
      const settings = isObj(a.settings) && !settingsProblem(a.settings, RULE_KEYS) ? a.settings : undefined;
      if (a.settings && !settings && Object.keys(a.settings).length) leftOut(pre, `${label}: its settings`, 'they could not be read', false);
      const out = exportShare(ents, { kind: 'area', keepNotes: true, name: String(a.name || 'Imported').slice(0, SHARE_LIMITS.name), area: { name: String(a.name || 'Imported').slice(0, SHARE_LIMITS.name), settings, ground: typeof a.ground === 'string' ? a.ground : undefined } });
      doc = out.doc; players = out.left.players;
    } catch { leftOut(left, label, 'it could not be read'); continue; }
    const v = validateShare(JSON.parse(JSON.stringify(doc)));
    if (v.error) { if (v.error === 'there is nothing in it' && !pre.pieces) { docs.push({ empty: true, name: doc.name, area: doc.area }); reads.push(null); } else leftOut(left, label, v.error); continue; }
    docs.push(v.doc); reads.push({ left: { pieces: pre.pieces + v.left.pieces, details: pre.details + v.left.details, list: [...pre.list, ...v.left.list].slice(0, SHARE_LIMITS.left) }, total: v.total + pre.pieces, players }); // (players: not a fault, the rule: a line in the toast, not the list of what broke)
  }
  return { docs, reads, left };
}
