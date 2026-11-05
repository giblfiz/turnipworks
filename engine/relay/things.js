// THINGS FOR THE GET API (2026-10-20): what an AI seat needs to know about the furniture and to put more down, worked
// out from the same library the relay furnishes rooms with (rt.roomgen.lib). Nothing here decides anything the core
// does not: these are readings (is it a light, does it open) and argument fillers (a library piece's mesh and size).
//   lights   the client's rule (client/assets.js lightKind): the tuner's fireType() first, else a catalog `aff: lit`
//            piece; its reach in a dark area from core/darkness.js (the GM's lightRadius first, else the house look's
//            table, rt.roomgen.lightTable: relay/server.js loadRoomgen; the core table when it has none)
//   opens    a catalog `aff: open` piece (doors, chests, shutters, coffins...)
import fs from 'node:fs';
import path from 'node:path';
import { lightKind, lightRadiusOf, LIGHT_RADII } from '../core/darkness.js';
import { roomY } from '../core/height.js';
import { hasCell } from '../core/footprint.js';
import { opensIn } from '../core/openables.js';
import { can } from '../core/perms.js';

// The tuner's fireType() (tools/spawn-tuner/js/fx/fire.js) decides which things burn in the game. That module imports
// three.js, so it cannot load in Node: its one pure function is read from the source the game runs (no copy to drift).
export function fireTypeOf(tunerDir) {
  try {
    const src = fs.readFileSync(path.join(tunerDir, 'fx', 'fire.js'), 'utf8');
    const m = src.match(/export function fireType\(id = ''\) \{\n([\s\S]*?)\n\}\n/);
    return m ? new Function('id = ""', m[1]) : null;
  } catch { return null; }
}
const libOf = (rt) => rt.roomgen?.lib || null;
export function lightOf(rt, e) {
  const lib = libOf(rt); if (!lib || e?.kind !== 'object' || !e.cat) return null;
  const kind = lightKind(e.cat, rt.roomgen.fireType?.(e.cat) || null, lib.objects[e.cat]?.aff || []);
  return kind ? { kind, radius: lightRadiusOf(e, kind, rt.roomgen.lightTable || LIGHT_RADII), lit: e.lit !== false } : null;
}
export const opens = (rt, e) => opensIn(libOf(rt), e?.cat); // (core/openables.js: the catalog's 'open', or an open state of its own)

// a thing as an AI seat reads it: its catalog piece, and only the flags that say something
export function thingFor(rt, e) {
  const L = lightOf(rt, e);
  return { ...(e.cat && { cat: e.cat }), ...(e.sku && e.cat && e.sku !== `${e.cat}--common` && { variant: e.sku.replace(`${e.cat}--`, '') }), ...(L && { light: L.kind, lit: L.lit, radius: L.radius }), ...(opens(rt, e) && { open: !!e.open }), ...(e.locked && { locked: true }), ...(e.pinned && { pinned: true }), ...(e.flavor && { faction: e.flavor }), ...(e.quat && { tilted: true }) };
}

// THE LIBRARY, searched (/c/<campaign>/things?q=candle): what an AI seat can put down with object.place&cat=ID
const SKIP = (id, o) => id.startsWith('floor-') || id.endsWith('-open') || id.startsWith('flavor-') || (o.place === 'kit' && !/^door|^window|^stair|^ladder/.test(id));
export function findThings(rt, q, limit = 12) {
  const lib = libOf(rt); if (!lib) return [];
  const words = String(q || '').toLowerCase().split(/[\s,+]+/).filter(Boolean);
  const hits = [];
  for (const [id, o] of Object.entries(lib.objects)) {
    if (SKIP(id, o) || !o.skus?.some(k => k.url)) continue;
    const hay = `${id.replace(/-/g, ' ')} ${o.desc || ''} ${o.hint || ''} ${(o.aff || []).join(' ')}`.toLowerCase();
    const score = words.reduce((n, w) => n + (id.includes(w) ? 3 : hay.includes(w) ? 1 : 0), 0);
    if (words.length && words.every(w => hay.includes(w))) hits.push({ id, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.id.length - b.id.length || (a.id < b.id ? -1 : 1)).slice(0, limit).map(({ id }) => thingBrief(rt, id));
}
export function thingBrief(rt, id) {
  const o = libOf(rt).objects[id], L = lightKind(id, rt.roomgen.fireType?.(id) || null, o.aff || []);
  return { id, name: id.replace(/-/g, ' '), place: o.place, ...(o.desc && { desc: o.desc.slice(0, 80) }), ...(L && { light: L }), ...(opensIn(libOf(rt), id) && { opens: true }) };
}
// object.place&cat=ID: the piece's mesh and size from the library, as the browser's Library does (core/roomgen.js
// sizeOf: the solver's own sizing); a wall piece hangs at 7 ft. Refused with the nearest ids for an unknown cat.
export function placeArgs(rt, a) {
  const lib = libOf(rt); if (!lib || !a.cat || a.url) return { args: a };
  if (!lib.objects[a.cat]) { const near = findThings(rt, a.cat.replace(/-/g, ' '), 6).map(t => t.id); return { error: `no thing "${a.cat}" in the library${near.length ? ` (did you mean: ${near.join(', ')}?)` : ''}; search: /things?q=WORDS` }; }
  const sz = rt.roomgen.sizeOf(a.cat, a.sku || null); if (!sz) return { error: `${a.cat} has no mesh yet` };
  return { args: { ...a, name: a.name || a.cat.replace(/-/g, ' '), sku: sz.sku, url: sz.url, flat: String(sz.flat), place: a.place || sz.place || 'floor', s: JSON.stringify(sz.s), dims: JSON.stringify(sz.dims), yaw: String(sz.yaw || 0), ...(a.y == null && sz.place === 'wall' && { y: '7' }) } };
}
// A ROOM IS NOT A THING (2026-11-02; a helper called Luna: "placing a 'cave' object only makes a marker rather than a cave
// room"). object.place with no cat answers ok and leaves a bare box with that name on the table, so a word that names a
// room type must get the right call back at the moment of the mistake. A word names a room type when it is the type's key
// or label ("Cave mouth"), or one word of them ("crypt", "forge"), or a plain synonym of one ("basement").
const ROOM_WORDS = { basement: 'cellar', cavern: 'cave', grotto: 'cave' };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function roomTypesNamed(rt, word) {
  const types = rt.roomgen?.typeList || [], w0 = norm(word), w = ROOM_WORDS[w0] || w0;
  if (!w || w === 'room') return [];
  const exact = types.filter(t => norm(t.key) === w || norm(t.label) === w), cave = /\bcave\b/.test(w) ? types.filter(t => t.key === 'cave') : [];
  if (exact.length) return [...new Set([...cave, ...exact])];
  return w.includes(' ') ? [] : types.filter(t => norm(t.key).split(' ').includes(w) || norm(t.label).split(' ').includes(w)).slice(0, 4);
}
// the right call, spelled out: under the ground for what lives there, in the type's own size
const BELOW = /^(cave|cellar|mansion-cellar|crypt-|dun-|min-)/;
const roomCall = (t) => `room.spawn&type=${t.key}&x=FEET&z=FEET&w=${(t.cells?.[0] || 6) * 5}&d=${(t.cells?.[1] || 4) * 5}${BELOW.test(t.key) ? '&y=-10' : ''}`;
// what to say when `word` was asked of the things and is a room: null when it is no room. area null: the seat's right anywhere
export function roomHint(rt, seat, area, word) {
  const ts = roomTypesNamed(rt, word); if (!ts.length) return null;
  const list = ts.map(t => `${t.label} (${roomCall(t)})`).join('; ');
  return can(rt.state, seat, 'room', area).ok ? `"${word}" is a room, not a thing. Make it with ${list}.` : `"${word}" is a room, not a thing, and this seat has no "room" permission, so it cannot build one: ask the GM (${ts[0].label}: ${roomCall(ts[0])}).`;
}

// REPLACE WITH SIMILAR (the ring's "Replace with similar", client/assets.js similar): with no cat, the next mesh of the
// same piece, else a sibling piece that shares a word of its name and is put down the same way
export function similarArgs(rt, e, a) {
  const lib = libOf(rt), o = lib?.objects[e.cat]; if (!o) return { error: `${e.name || e.id} has no library piece to swap` };
  const ok = (k) => k.url && k.bounds && (rt.roomgen.skuUsable?.(k) ?? true);
  const own = o.skus.filter(ok);
  if (own.length > 1) { const i = own.findIndex(k => k.sku === e.sku), k = own[(i + 1) % own.length]; return { args: { ...a, cat: e.cat, sku: k.sku, url: k.url } }; }
  const words = new Set(e.cat.split('-').filter(w => w.length > 2));
  const sib = Object.entries(lib.objects).find(([id, x]) => id !== e.cat && x.place === o.place && !SKIP(id, x) && id.split('-').some(w => words.has(w)) && x.skus.some(ok));
  if (!sib) return { error: `nothing similar to ${e.cat} in the library` };
  const sz = rt.roomgen.sizeOf(sib[0]);
  return { args: { ...a, cat: sib[0], sku: sz.sku, url: sz.url, flat: String(sz.flat), s: JSON.stringify(sz.s), dims: JSON.stringify(sz.dims), yaw: String(sz.yaw || 0), name: a.name || sib[0].replace(/-/g, ' ') } };
}

// token.create&room=ROOM (no x, z): the free square nearest the room's middle (no pawn on it, no furniture standing on
// its centre); a large creature (size 2, 4) on free squares where four meet. null = none free.
export function freeSpot(E, room, size = 1) {
  const R = room.recipe, y = roomY(R), n = Math.max(1, Math.min(4, size || 1));
  const pawns = Object.values(E).filter(e => e.kind === 'token');
  const things = Object.values(E).filter(e => e.kind === 'object' && !e.flat && e.place !== 'tile' && e.place !== 'wall' && !e.fromEdge && Math.abs((e.y || 0) - y) < 6);
  const busy = (cx, cz) => pawns.some(p => Math.abs(p.x - cx) < 2.5 * (p.size || 1) && Math.abs(p.z - cz) < 2.5 * (p.size || 1)) || things.some(o => Math.abs(o.x - cx) < (o.dims?.[0] || 2) / 2 + 0.5 && Math.abs(o.z - cz) < (o.dims?.[2] || 2) / 2 + 0.5);
  const mid = [(R.x + R.w / 2) * 5, (R.z + R.d / 2) * 5], spots = [];
  for (let i = 0; i + n <= R.w; i++) for (let j = 0; j + n <= R.d; j++) {
    const cells = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) cells.push([R.x + i + a, R.z + j + b]);
    if (!cells.every(([cx, cz]) => hasCell(R, cx, cz)) || cells.some(([cx, cz]) => busy(cx * 5 + 2.5, cz * 5 + 2.5))) continue;
    const x = (R.x + i + n / 2) * 5, z = (R.z + j + n / 2) * 5;
    spots.push({ x, z, d: Math.hypot(x - mid[0], z - mid[1]) });
  }
  spots.sort((a, b) => a.d - b.d);
  return spots[0] ? { x: spots[0].x, z: spots[0].z, y } : null;
}
