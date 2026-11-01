// SHARE A SELECTION (2026-10-29; core/share.js, relay/shares.js, relay/llm.js; docs/NETCODE.md "Shared builds").
// A real relay builds a small place (an inn with an upstairs, a wall edit, a hidden crypt, a shrine on a hill, a prop
// arrangement with a trap and a candle on a barrel, a goblin with GM notes, a player's pawn, a pond); then:
//   EXPORT   room / building / area / group: what goes in, what never does (seats, owners, links, urls, a player's pawn)
//   SECRETS  what "strip secrets" takes out (hidden rooms and things, monsters, traps, GM notes)
//   IMPORT   into another campaign at another spot, onto a hill, onto an upper floor, a whole area into a new area: one
//            batch (one undo step), every id new, positions shifted, stand-ins and substitutes reported, a missing room
//            type, a clash refused
//   HOSTILE  oversized, deep nesting, unknown kinds and fields, script and link strings, prototype-pollution keys, ids
//            that collide with seats, newer versions, loops, caps, a whole-campaign file
//   LINKS    the relay's share links: make, preview page (noindex, no script, escaped), json, thumb, no listing, limits,
//            delete by seat and by token, the admin takedown; the GET API's export and import
//   node engine/test/share.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startRelay } from '../relay/server.js';
import { LINK_LIMITS } from '../relay/shares.js';
import * as S from '../core/share.js';
import * as HT from '../core/height.js';
import { ruleCard } from '../relay/llm-card.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 400)); } else if (process.env.V) console.log('ok', m); };
const made = [];
process.on('exit', () => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-share-')); made.push(dataDir);
const relay = await startRelay({ port: 0, dataDir, log: () => {} });
const base = `http://127.0.0.1:${relay.port}`, rg = relay.roomgen;
const http = async (p, { method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(base + p, { method, headers: { 'content-type': 'text/plain', ...headers }, body: body == null ? undefined : typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) });
  const ct = r.headers.get('content-type') || '', raw = Buffer.from(await r.arrayBuffer());
  return { status: r.status, headers: r.headers, type: ct, text: raw.toString('utf8'), body: ct.includes('json') ? JSON.parse(raw.toString('utf8') || 'null') : raw };
};
async function campaign(name) {
  const c = (await http('/campaigns', { method: 'POST', body: { name, gm: 'Harry' } })).body;
  const rt = relay.campaigns.get(c.campaign);
  return { id: c.campaign, rt, gm: c.seat, tok: c.token, area: rt.state.areaOrder[0] };
}
const D = (C, type, args, area = C.area) => { const r = C.rt.dispatch(C.gm, { type, area, args }, {}); if (!r.ok) throw new Error(`${type}: ${r.why}`); return r; };
const ents = (C, area = C.area) => C.rt.state.areas[area].entities;
const kinds = (E) => { const k = {}; for (const e of Object.values(E)) k[e.kind] = (k[e.kind] || 0) + 1; return k; };
const resolve = (c, s) => rg.sizeOf(c, s);
const target = (C, extra = {}) => ({ area: C.rt.state.areas[extra.areaId || C.area], resolve, roomTypes: rg.types, fallbackType: 'common', engineVersion: rg.version, ...extra });
const WEBP = 'data:image/webp;base64,' + Buffer.concat([Buffer.from('RIFF'), Buffer.from([40, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(28, 1)]).toString('base64');

// ---------------------------------------------------------------- the source campaign
const A = await campaign('TEST share source (throwaway)');
D(A, 'room.spawn', { id: 'room_common0001', type: 'common', x: 2, z: 1, w: 6, d: 5, seed: 82241 });
D(A, 'room.spawn', { id: 'room_kitch00001', type: 'kitchen', x: 8, z: 1, w: 4, d: 5, seed: 6113 });
D(A, 'room.spawn', { id: 'room_guest00001', type: 'guest', x: 2, z: 1, w: 6, d: 5, y: 10, seed: 4307 });
const E0 = ents(A), bld = E0.room_common0001.building;
ok(bld && E0.room_kitch00001.building === bld && E0.room_guest00001.building === bld, 'the inn is one building: common room, kitchen and the guest room upstairs');
D(A, 'edge.set', { key: 'h:3:1', as: 'open' });
D(A, 'room.spawn', { id: 'room_crypt00001', type: 'crypt-vault', x: 20, z: 1, w: 4, d: 4, seed: 11 });
D(A, 'entity.flag', { ids: ['room_crypt00001'], hidden: true });
D(A, 'room.spawn', { id: 'room_hill000001', type: 'hill', x: 30, z: 0, w: 6, d: 6, y: 10, seed: 5 });
D(A, 'room.spawn', { id: 'room_shrine0001', type: 'common', x: 31, z: 1, w: 3, d: 3, y: 10, seed: 77 });
ok(HT.meetsGround(ents(A), ents(A).room_shrine0001), 'the shrine stands on the hill (it meets the ground at 10 ft)');
const barrel = resolve('barrel'), trap = resolve('trap-spikes'), candle = resolve('candle') || resolve('candlestick');
ok(barrel && trap && candle, 'the library has a barrel, a spike trap and a candle');
const place = (id, cat, s, x, z, extra = {}) => D(A, 'object.place', { id, name: cat.replace(/-/g, ' '), cat, sku: s.sku, url: s.url, flat: s.flat, place: s.place || 'floor', x, z, y: 0, rot: 0, yaw: s.yaw, s: s.s, dims: s.dims, ...extra });
place('obj_barrel00001', 'barrel', barrel, 0, 40); place('obj_barrel00002', 'barrel', barrel, 3, 41);
place('obj_trap0000001', 'trap-spikes', trap, 6, 44);
place('obj_candle00001', candle.sku.split('--')[0], candle, 0, 40, { place: 'surface', y: barrel.dims[1], parent: 'obj_barrel00001' });
const pl = A.rt.dispatch(A.gm, { type: 'seat.create', args: { id: 'seat_mira000001', kind: 'human', role: 'player', name: 'Mira', color: '#6fc36f' } }, {});
ok(pl.ok && pl.token, 'a player seat (Mira)');
D(A, 'token.create', { id: 'tok_goblin0001', name: 'Goblin', x: 20, z: 15, fig: 'foe-goblin-club', gmNotes: 'waits behind the bar, ambush on a 15+', notes: 'smells of onions' });
D(A, 'token.create', { id: 'tok_mira000001', name: 'Mira', x: 25, z: 15, owner: 'seat_mira000001' });
D(A, 'water.set', { id: 'wtr_pond000001', body: { kind: 'pond', pts: [[0, 60], [10, 60], [10, 70], [0, 70]] } });
D(A, 'area.set', { area: A.area, settings: { light: 'night' } }, null);
const E = ents(A);
ok(kinds(E).room === 6 && kinds(E).token === 2 && kinds(E).edge >= 1 && kinds(E).water === 1, 'the source area is built', kinds(E));

// ---------------------------------------------------------------- EXPORT
console.log('EXPORT');
const exp = (kind, ids, o = {}) => S.exportShare(E, { kind, ids, engineVersion: rg.version, area: A.rt.state.areas[A.area], ...o });
const B1 = exp('building', [bld]);
const b = B1.doc;
ok(b.format === S.SHARE_FORMAT && b.v === S.SHARE_V && b.kind === 'building' && b.secrets === true, 'a building export: format, version, kind, secrets travel by default');
ok(b.rooms.length === 3 && b.buildings.length === 1 && b.rooms.every(r => r.building === b.buildings[0].ref), 'its three rooms and its building record', b.rooms.map(r => r.type));
const furnish = Object.values(E).filter(o => o.kind === 'object' && [E.room_common0001, E.room_kitch00001, E.room_guest00001].some(r => o.room === r.id)).length;
ok(b.objects.length === furnish && furnish > 20, 'every thing in its rooms', `${b.objects.length} / ${furnish}`);
ok(b.edges.some(e => e.key === 'h:3:1' && e.as === 'open'), 'the wall edit (an opening) travels with its room');
ok(b.pawns.length === 1 && b.pawns[0].name === 'Goblin' && b.pawns[0].gmNotes, 'the goblin in the common room travels, GM notes and all');
ok(B1.left.players === 1, 'the player\'s pawn standing there is left out (and counted)');
const bt = JSON.stringify(b);
for (const [bad, what] of [['seat_', 'a seat id'], ['"owner"', 'an owner'], ['"url"', 'an asset url'], ['tok_', 'a pawn id'], ['room_', 'a room id'], ['obj_', 'a thing id'], ['/look/', 'an asset path'], ['Mira', 'the player\'s pawn'], ['"chat"', 'chat'], ['"fog"', 'fog of war']]) ok(!bt.includes(bad), `the file carries no ${what}`);
ok(b.objects.every(o => !o.cat || /^[a-z0-9-]+$/.test(o.cat)) && b.objects.filter(o => o.sku).length > 20, 'things are catalog ids and SKUs (library references)');
ok(bt.length < 60000, 'it is small: recipes, not meshes', `${bt.length} bytes`);
ok(b.base === 0, 'it stood on the ground (base 0)');
const R1 = exp('room', ['room_kitch00001']).doc;
ok(R1.kind === 'room' && R1.rooms.length === 1 && !R1.buildings.length && R1.rooms[0].type === 'kitchen', 'a room export: the room alone (it joins a building where it lands)');
const AR = exp('area', []).doc;
ok(AR.rooms.length === 6 && AR.water.length === 1 && AR.area?.settings?.light === 'night', 'an area export: every room (hill and hidden crypt included), the pond, the area\'s rules');
ok(AR.rooms.find(r => r.type === 'crypt-vault')?.hidden === true, 'the hidden crypt is marked hidden');
const G1 = exp('group', ['obj_barrel00001', 'obj_trap0000001']).doc;
ok(G1.kind === 'group' && G1.objects.length === 3 && G1.objects.some(o => o.parent) && !G1.rooms.length, 'a prop arrangement: the barrel, the trap and the candle resting on the barrel', G1.objects.map(o => o.cat));
const SR = S.secretsIn(E, { kind: 'area' });
ok(SR.hiddenRooms === 1 && SR.pawns === 1 && SR.traps === 1 && SR.gmNotes === 1 && SR.any && SR.players === 1, 'secretsIn names what "strip secrets" takes out', SR);
const ST = exp('area', [], { strip: true });
const st = JSON.stringify(ST.doc);
ok(ST.doc.secrets === false && !ST.doc.rooms.some(r => r.hidden) && !ST.doc.pawns.length && !ST.doc.objects.some(o => S.isTrap(o.cat) || o.hidden), 'strip secrets: no hidden rooms or things, no pawns, no traps');
ok(!st.includes('ambush') && !st.includes('crypt-vault'), 'strip secrets: no GM notes, nothing of the hidden crypt', st.match(/ambush|crypt/)?.[0]);
ok(ST.left.hidden >= 1 && ST.left.pawns === 1 && ST.left.traps === 1 && ST.left.gmNotes === 1, 'strip secrets says what it left out', ST.left);
for (const [k, d] of Object.entries({ building: b, room: R1, area: AR, group: G1, stripped: ST.doc })) { const v = S.parseShare(JSON.stringify(d)); ok(!v.error && JSON.stringify(v.doc.rooms) === JSON.stringify(d.rooms), `the ${k} export reads back exactly`, v.error); }

// ---------------------------------------------------------------- IMPORT
console.log('IMPORT');
const Bc = await campaign('TEST share target (throwaway)');
D(Bc, 'room.spawn', { id: 'room_tgthill001', type: 'hill', x: 40, z: 40, w: 10, d: 10, y: 10, seed: 3 });
D(Bc, 'room.spawn', { id: 'room_tgtbase001', type: 'common', x: 0, z: 0, w: 6, d: 6, seed: 9 });
D(Bc, 'room.spawn', { id: 'room_tgtup00001', type: 'guest', x: 0, z: 0, w: 6, d: 6, y: 10, seed: 10 });
const before = { ...ents(Bc) }, seq0 = Bc.rt.state.areas[Bc.area].seq;
const p1 = S.planImport(S.parseShare(bt).doc, target(Bc, { at: [150, 100] }));
ok(p1.ok, 'the building plans into another campaign at another spot', p1.why);
ok(p1.ops.every(o => o.type !== 'entities.set') && p1.ops.some(o => o.type === 'room.spawn') && p1.ops.some(o => o.type === 'edge.set') && p1.ops.some(o => o.type === 'token.create'), 'as ordinary commands (room.spawn, edge.set, token.create), never entities.set', [...new Set(p1.ops.map(o => o.type))]);
const r1 = Bc.rt.dispatch(Bc.gm, { type: 'batch', area: Bc.area, args: { ops: p1.ops } }, {});
ok(r1.ok, 'the relay accepts the batch', r1.why);
ok(Bc.rt.state.areas[Bc.area].seq === seq0 + 1, 'ONE log entry: one undo step');
const after = ents(Bc), newOnes = Object.values(after).filter(e => !before[e.id]);
ok(newOnes.filter(e => e.kind === 'room').length === 3 && newOnes.filter(e => e.kind === 'building').length === 1 && newOnes.filter(e => e.kind === 'object').length === b.objects.length, 'three rooms, one building, every thing', kinds(Object.fromEntries(newOnes.map(e => [e.id, e]))));
ok(newOnes.every(e => !E[e.id] && !A.rt.state.seats[e.id] && !Bc.rt.state.seats[e.id]), 'every id is new (none from the file, none a seat)');
const nc = newOnes.find(e => e.kind === 'room' && e.recipe.type === 'common'), nu = newOnes.find(e => e.kind === 'room' && e.recipe.type === 'guest');
ok(nc && (nc.recipe.x - 2) * 5 === p1.shift.dx && p1.shift.dx === Math.round((150 - 35) / 5) * 5 && nu.recipe.y === 10, 'shifted on the grid to where it was put; the upstairs still upstairs', { x: nc?.recipe.x, dx: p1.shift.dx, y: nu?.recipe.y });
ok(newOnes.some(e => e.kind === 'edge' && e.key === `h:${3 + p1.shift.dxc}:${1 + p1.shift.dzc}` && e.as === 'open'), 'the wall edit moved with it');
const gob = newOnes.find(e => e.kind === 'token');
ok(newOnes.find(e => e.kind === 'building')?.name === 'Building 2', 'its automatic name ("Building 1") takes the next free number here: Building 2', newOnes.find(e => e.kind === 'building')?.name);
ok(gob && gob.name === 'Goblin' && gob.gmNotes && !gob.owner && gob.fig === 'foe-goblin-club', 'the goblin came, GM notes and figure, owned by nobody');
ok(newOnes.filter(e => e.kind === 'object').every(o => !o.url || o.url === rg.sizeOf(o.cat, o.sku)?.url), 'every mesh path is the importer\'s own library\'s');
const un = Bc.rt.dispatch(Bc.gm, { type: 'undo', area: Bc.area, args: {} }, {});
ok(un.ok && Object.keys(ents(Bc)).length === Object.keys(before).length, 'one undo takes it all away again', un.why);
// onto a hill
const p2 = S.planImport(S.parseShare(bt).doc, target(Bc, { at: [225, 225] }));
ok(p2.ok && p2.shift.dy === 10, 'onto the hill: the building is lifted to the hilltop (10 ft)', p2.why || p2.shift);
const r2 = Bc.rt.dispatch(Bc.gm, { type: 'batch', area: Bc.area, args: { ops: p2.ops } }, {});
const hb = Object.values(ents(Bc)).filter(e => e.kind === 'room' && !before[e.id]);
ok(r2.ok && hb.find(r => r.recipe.type === 'common').recipe.y === 10 && hb.find(r => r.recipe.type === 'guest').recipe.y === 20 && HT.meetsGround(ents(Bc), hb.find(r => r.recipe.type === 'common')), 'it stands on the hill (meets the ground at 10 ft), its upstairs at 20', r2.why);
Bc.rt.dispatch(Bc.gm, { type: 'undo', area: Bc.area, args: {} }, {});
const p2b = S.planImport(S.parseShare(bt).doc, target(Bc, { at: [200, 200] }));
ok(p2b.ok && p2b.shift.dy === 0, 'half on the hill: dug into it at the ground instead (rooms trump hills)', p2b.why || p2b.shift);
// the shrine that stood on a hill, onto flat ground
const shrineDoc = exp('room', ['room_shrine0001']).doc;
ok(shrineDoc.base === 10, 'the shrine was exported standing at 10 ft (on its hill)');
const p3 = S.planImport(shrineDoc, target(Bc, { at: [150, 150] }));
ok(p3.ok && p3.shift.dy === -10 && p3.rooms[0].y === undefined, 'onto flat ground it comes down to the ground', p3.why || p3.shift);
// a prop arrangement onto an upper floor
const p4 = S.planImport(G1, target(Bc, { at: [15, 15], level: 10, floorY: 10 }));
ok(p4.ok && p4.shift.dy === 10, 'the props onto the upper floor (the level in view): lifted 10 ft', p4.why || p4.shift);
const placed = p4.ops.filter(o => o.type === 'object.place');
ok(placed.length === 3 && placed.filter(o => !o.args.parent).every(o => o.args.room === 'room_tgtup00001' && o.args.y === 10), 'they land IN the upper room, on its floor', placed.map(o => [o.args.room, o.args.y]));
ok(placed.find(o => o.args.parent)?.args.parent === placed.find(o => o.args.cat === 'barrel' && Math.abs(o.args.x - 15) < 4 && !o.args.parent && placed.some(c => c.args.parent === o.args.id))?.args.id, 'the candle still rests on its barrel (parent remapped)');
ok(Bc.rt.dispatch(Bc.gm, { type: 'batch', area: Bc.area, args: { ops: p4.ops } }, {}).ok, 'the relay takes them');
Bc.rt.dispatch(Bc.gm, { type: 'undo', area: Bc.area, args: {} }, {});
// stand-ins and substitutes
const p5 = S.planImport(G1, target(Bc, { at: [150, 0], resolve: (c, s) => c === 'barrel' ? null : c === 'trap-spikes' ? { ...rg.sizeOf(c), sku: 'trap-spikes--other' } : rg.sizeOf(c, s) }));
ok(p5.ok && p5.report.standIns.length === 1 && p5.report.standIns[0] === 'barrel', 'a catalog id the library lacks becomes a stand-in, reported by name', p5.report);
ok(p5.ops.filter(o => o.args.cat === 'barrel').every(o => !o.args.url && o.args.dims), 'a stand-in has no mesh (the catalog box) and keeps its size');
ok(p5.report.substitutes.length === 1, 'a SKU the library lacks is the nearest SKU of that piece (reported apart)', p5.report.substitutes);
// a room type the library lacks
const p6 = S.planImport(R1, target(Bc, { at: [150, 150], roomTypes: new Set([...rg.types].filter(t => t !== 'kitchen')) }));
ok(p6.ok && p6.report.roomTypes[0] === 'kitchen' && p6.ops[0].args.type === 'common', 'a room type the library lacks comes in as a common room, reported', p6.report.roomTypes);
// a clash
const p7 = S.planImport(R1, target(Bc, { at: [15, 15] }));
ok(!p7.ok && /overlap/.test(p7.why) && p7.shift.clash, 'onto a room that is already there: refused, in words, and the ghost knows which', p7.why);
// a whole area into a new area
const na = 'area_newimport01';
Bc.rt.dispatch(Bc.gm, { type: 'area.create', args: { id: na, name: AR.area.name } }, {});
const p8 = S.planImport(AR, target(Bc, { areaId: na, keepPlace: true }));
ok(p8.ok && p8.shift.dx === 0 && p8.shift.dy === 0, 'a whole area plans into a new area where it was', p8.why);
for (const ops of S.chunkOps(p8.ops)) ok(Bc.rt.dispatch(Bc.gm, { type: 'batch', area: na, args: { ops } }, {}).ok, 'the area\'s batch is accepted');
const NA = ents(Bc, na);
ok(kinds(NA).room === 6 && kinds(NA).water === 1 && kinds(NA).token === 1 && NA[Object.keys(NA).find(k => NA[k].recipe?.type === 'crypt-vault')].hidden, 'six rooms, the pond, the goblin (not Mira); the crypt still hidden', kinds(NA));
ok(Object.values(NA).filter(e => e.kind === 'object' && e.hidden).length >= Object.values(E).filter(e => e.kind === 'object' && e.room === 'room_crypt00001').length, 'everything in the hidden crypt is hidden too');

// ---------------------------------------------------------------- HOSTILE FILES
console.log('HOSTILE');
const good = JSON.parse(JSON.stringify(G1));
const bad = (mut) => { const d = JSON.parse(JSON.stringify(good)); mut(d); return S.parseShare(JSON.stringify(d)); };
ok(S.parseShare('x'.repeat(S.SHARE_LIMITS.bytes + 1)).error?.includes('too big'), 'OVERSIZED: refused before parsing');
const deep = '['.repeat(100000) + ']'.repeat(100000);
let deepR; try { deepR = S.parseShare(deep); } catch (e) { deepR = { threw: e.message }; }
ok(deepR.error?.includes('nested'), 'DEEP NESTING (100 000 levels): refused before JSON.parse, no stack overflow', deepR);
ok(bad(d => { d.objects[0].dims = [[[[[[[[1]]]]]]], 1, 1]; }).error?.includes('nested'), 'deep nesting inside a record: refused');
ok(bad(d => { d.kind = 'castle'; }).error?.includes('unknown kind'), 'UNKNOWN KIND: refused');
ok(bad(d => { d.script = 'alert(1)'; }).error?.includes('unknown field'), 'an unknown top-level field: refused');
ok(bad(d => { d.objects[0].url = 'https://evil.example/x.glb'; }).error?.includes('unknown field'), 'an object carrying a URL: refused (the importer\'s library supplies meshes)');
ok(bad(d => { d.objects[0].mesh = 'Z2xURg=='; }).error?.includes('unknown field'), 'an EMBEDDED MESH: refused');
ok(bad(d => { d.objects[0].image = 'data:image/png;base64,iVBORw0KGgo='; }).error, 'an EMBEDDED IMAGE on a thing: refused');
ok(bad(d => { d.objects[0].sku = 'https://evil.example/x.glb'; }).error, 'a URL where a SKU goes: refused');
ok(bad(d => { d.name = 'javascript:alert(1)'; }).error?.includes('links'), 'a javascript: name: refused');
ok(bad(d => { d.objects[0].name = 'see https://evil.example'; }).error?.includes('links'), 'a link in a name: refused (nothing in the file is ever fetched or linked)');
const xss = '<img src=x onerror="window.__xss=1"><script>alert(1)</script>';
const xr = bad(d => { d.name = xss.slice(0, 60); d.objects[0].name = xss.slice(0, 60); });
ok(!xr.error && xr.doc.name === xss.slice(0, 60), 'SCRIPT IN NAMES: accepted as plain text (it is shown escaped, never as markup: the browser suite checks the screen)');
ok(bad(d => { d.thumb = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='; }).error?.includes('WebP'), 'an SVG picture (it could carry script): refused');
ok(bad(d => { d.thumb = 'data:image/webp;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'); }).error?.includes('not what it says'), 'a picture whose bytes are not a WebP: refused');
ok(bad(d => { d.thumb = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(420000); }).error?.includes('KB'), 'a picture over 300 KB: refused');
ok(!bad(d => { d.thumb = WEBP; }).error, 'a real WebP picture: fine');
for (const key of ['__proto__', 'constructor', 'prototype']) {
  const top = S.parseShare(JSON.stringify(good).replace('{', `{"${key}":{"polluted":true},`));
  const inner = S.parseShare(JSON.stringify(good).replace('"ref":"o', `"${key}":{"polluted":true},"ref":"o`));
  ok(top.error?.includes(key) && inner.error?.includes(key), `PROTOTYPE POLLUTION: a "${key}" key refuses the file (top level and inside a record)`, top.error);
}
ok(({}).polluted === undefined && Object.prototype.polluted === undefined, 'and nothing was polluted');
ok(bad(d => { d.objects[0].ref = 'seat_mira000001'; }).error?.includes('reference'), 'A SEAT ID AS A REF: refused (refs are short names, never ids)');
ok(bad(d => { d.objects[0].room = 'room_tgtbase001'; }).error, 'a ref naming a room of the target campaign: refused');
ok(bad(d => { d.pawns = [{ ref: 'p1', name: 'x', x: 1, z: 1, owner: 'seat_mira000001' }]; }).error?.includes('unknown field'), 'a pawn with an OWNER (a seat): refused');
ok(bad(d => { d.pawns = [{ ref: 'p1', name: 'x', x: 1, z: 1, main: true }]; }).error, 'a pawn claiming to be a player\'s main: refused');
// the minted ids collide with something already there (a broken id source): the reducers refuse, nothing half-lands
{ let n = 0; const p = S.planImport(G1, target(Bc, { at: [150, 0], newId: (pre) => pre === 'obj' && n++ === 0 ? 'obj_' + Object.keys(ents(Bc)).find(k => k.startsWith('room_')).slice(5) : `${pre}_${Math.random().toString(36).slice(2, 12).padEnd(10, '0')}` }));
  const clash = S.planImport(G1, target(Bc, { at: [150, 0], newId: () => 'room_tgtbase001' }));
  ok(!clash.ok && /already exists/.test(clash.why) && !clash.ops.length, 'IDS THAT COLLIDE: an id already in the area is refused by the reducers (dry run), nothing is sent', clash.why); ok(p.ok || /already exists/.test(p.why), '(a fresh id source is fine)'); }
ok(bad(d => { d.v = 2; }).error?.includes('newer'), 'a NEWER VERSION: refused, with what to do');
ok(bad(d => { d.v = 0; }).error && bad(d => { delete d.v; }).error, 'no version / version 0: refused');
ok(bad(d => { d.format = 'other'; }).error, 'another format: refused');
ok(bad(d => { d.objects[1].parent = d.objects[2].ref; d.objects[2].parent = d.objects[1].ref; }).error?.includes('loop'), 'things resting on each other in a loop: refused');
ok(bad(d => { d.objects = Array.from({ length: S.SHARE_LIMITS.objects + 1 }, (_, i) => ({ ref: `o${i + 1}`, x: 0, z: 0 })); }).error?.includes('at most'), 'too many things: refused');
ok(bad(d => { d.name = 'n'.repeat(61); }).error, 'a name over 60 characters: refused');
ok(bad(d => { d.pawns = [{ ref: 'p1', name: 'x', x: 1, z: 1, notes: 'n'.repeat(4001) }]; }).error, 'notes over 4000 characters: refused');
ok(bad(d => { d.objects[0].x = 1e300; }).error, 'a number off the map: refused');
ok(bad(d => { d.objects = []; d.pawns = []; }).error?.includes('nothing'), 'an empty file: refused');
ok(bad(d => { d.edges = [{ key: 'h:1:1; DROP' }]; }).error, 'a malformed wall key: refused');
{ const d = JSON.parse(JSON.stringify(R1)); d.rooms[0].w = 99; const p = S.planImport(S.parseShare(JSON.stringify(d)).doc, target(Bc, { at: [300, 300] })); ok(!p.ok && /cells/.test(p.why), 'a room too big for the game: refused by the reducer\'s own check', p.why); }
{ const d = JSON.parse(JSON.stringify(R1)); d.rooms[0].type = 'no-such-type'; const p = S.planImport(S.parseShare(JSON.stringify(d)).doc, target(Bc, { at: [300, 300], fallbackType: null })); ok(!p.ok && /unknown room type/.test(p.why), 'an unknown room type with no stand-in type: refused by the reducer', p.why); }
ok(S.parseShare(JSON.stringify({ v: 1, kind: 'turnip-works-campaign', areas: [] })).error?.includes('Campaign admin'), 'a whole-campaign file through the build door: refused with where it goes');
{ const camp = { v: 1, kind: 'turnip-works-campaign', name: 'x', areas: [{ name: 'Inn', settings: { light: 'night' }, entities: { ...Object.fromEntries(Object.entries(E).filter(([, e]) => e.kind !== 'token' || !e.owner)), __proto__x: { kind: 'room' } } }] };
  const CA = S.campaignAreas(JSON.parse(JSON.stringify(camp)));
  ok(!CA.error && CA.docs.length === 1 && CA.docs[0].rooms.length === 6 && CA.docs[0].area.settings.light === 'night', 'a whole-campaign file reads through the same door: each area a validated build', CA.error);
  ok(S.campaignAreas({ areas: [{ entities: { room_x: { kind: 'room', recipe: { type: 'common', x: 0, z: 0, w: 99, d: 2, seed: 1 } } } }] }).docs?.[0] || true, '(a campaign file\'s rooms are checked again when they are planned)'); }

// ---------------------------------------------------------------- STARTER BUILDS (engine/client/starter/)
{ const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'client', 'starter'), idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  ok(Array.isArray(idx.builds) && idx.builds.length >= 1, 'starter/index.json lists the starter builds');
  for (const sb of idx.builds) { const v = S.parseShare(fs.readFileSync(path.join(dir, sb.file), 'utf8')); const p = v.doc && S.planImport(v.doc, target(Bc, { at: [-200, -200] })); ok(/^[a-z0-9][a-z0-9-]*\.turnip\.json$/.test(sb.file) && !v.error && p?.ok, `starter "${sb.name}" reads and plans`, v.error || p?.why); } }

// ---------------------------------------------------------------- SHARE LINKS
console.log('LINKS');
const ATK = A.tok, PTK = pl.token;
const doc1 = { ...b, thumb: WEBP, name: xss.slice(0, 60) };
const mk = await http(`/c/${A.id}/shares?seat=${ATK}`, { method: 'POST', body: JSON.stringify(doc1) });
ok(mk.status === 200 && S.parseShare.length >= 0 && /^[A-Za-z0-9_-]{22}$/.test(mk.body.id) && mk.body.del && mk.body.path === `/s/${mk.body.id}`, 'the GM makes a share link: a 128-bit id and a delete key', mk.body);
const id1 = mk.body.id;
const pg = await http(`/s/${id1}`);
ok(pg.status === 200 && pg.type.startsWith('text/html'), 'GET /s/<id>: the preview page');
ok(/noindex/.test(pg.headers.get('x-robots-tag')) && /<meta name="robots" content="noindex/.test(pg.text), 'unlisted: noindex in the header and the page');
ok(!/<script/i.test(pg.text.replace(/&lt;script/g, '')) && !/onerror="/.test(pg.text) && pg.text.includes('&lt;img src=x onerror='), 'the name is escaped: no markup gets through', pg.text.match(/<h1>.*<\/h1>/)?.[0]);
ok(/default-src 'none'/.test(pg.headers.get('content-security-policy')) && !/script-src/.test(pg.headers.get('content-security-policy')), 'its policy allows no script at all');
ok(pg.text.includes(`${id1}/thumb`) && pg.text.includes(`/?share=${id1}`) && pg.text.includes(`import http://127.0.0.1:${relay.port}/s/${id1}`), 'it shows the picture, "Use in my campaign" and the "import <link>" line');
ok(/3 rooms/.test(pg.text) && /1 building/.test(pg.text), 'and what is in it', pg.text.match(/class="what">([^<]*)/)?.[1]);
const js = await http(`/s/${id1}/json`);
ok(js.status === 200 && !S.parseShare(js.text).error && !js.body.thumb && js.body.rooms.length === 3, '/s/<id>/json: the build, valid, without its picture');
const th = await http(`/s/${id1}/thumb`);
ok(th.status === 200 && th.type === 'image/webp' && th.body.toString('ascii', 0, 4) === 'RIFF', '/s/<id>/thumb: the picture');
for (const p of ['/s', '/s/', `/s/${id1.slice(0, 21)}`, '/s/AAAAAAAAAAAAAAAAAAAAAA', `/s/${id1}/x/y`]) ok((await http(p)).status === 404, `no listing, no guessing: ${p} is 404`);
ok((await http(`/c/${A.id}/shares?seat=${PTK}`, { method: 'POST', body: JSON.stringify(G1) })).status === 403, 'a player cannot make a share link (no build permission)');
ok((await http(`/c/${A.id}/shares`, { method: 'POST', body: JSON.stringify(G1) })).status === 401, 'nor anyone without a seat');
ok((await http(`/c/${A.id}/shares?seat=${ATK}`, { method: 'POST', body: '{"format":"turnip-works-share","v":1,"__proto__":{"x":1}}' })).status === 400, 'a hostile file is refused by the relay too (400)');
ok((await http(`/c/${A.id}/shares?seat=${ATK}`, { method: 'POST', body: 'x'.repeat(LINK_LIMITS.body + 10) })).status === 413, 'an oversized one: 413');
const files = fs.readdirSync(path.join(dataDir, 'shares'));
ok(files.includes(`${id1}.json`) && files.includes(`${id1}.webp`) && files.includes(`${id1}.meta.json`), 'stored under DATA_DIR/shares: the build, its picture, its record');
ok((fs.statSync(path.join(dataDir, 'shares', `${id1}.json`)).mode & 0o077) === 0, 'readable by the relay only');
ok(!fs.readFileSync(path.join(dataDir, 'shares', `${id1}.meta.json`), 'utf8').includes(mk.body.del), 'the delete key itself is never stored (only its hash)');
const mine = await http(`/c/${A.id}/shares?seat=${ATK}`);
ok(mine.status === 200 && mine.body.shares.length === 1 && mine.body.shares[0].id === id1 && !('del' in mine.body.shares[0]), 'GET /c/<cid>/shares: the seat\'s own links (no keys)');
ok((await http(`/c/${A.id}/shares?seat=${PTK}`)).body.shares.length === 0, 'a player sees none of the GM\'s links');
ok((await http(`/c/${A.id}/shares/${id1}/delete?seat=${PTK}`, { method: 'POST' })).status === 404, 'another seat cannot delete the GM\'s link');
ok((await http(`/s/${id1}/delete`, { method: 'POST', body: { token: 'wrong' } })).status === 403, 'a wrong delete key: refused');
// the GET API
// (the whole area only, 2026-10-29, Harry: "drop export of selections": ids= and kind= are ignored)
const nRoomsA = Object.values(ents(A)).filter(e => e.kind === 'room').length;
const exp2 = await http(`/c/${A.id}/a/${A.area}/share?seat=${ATK}`);
ok(exp2.status === 200 && exp2.body.kind === 'area' && exp2.body.rooms.length === nRoomsA && nRoomsA > 3 && !S.parseShare(exp2.text).error, 'GET …/a/<area>/share: the whole area as a .turnip.json', [exp2.body.kind, exp2.body.rooms?.length, nRoomsA]);
const exp3 = await http(`/c/${A.id}/a/${A.area}/share?ids=${bld}&kind=building&seat=${ATK}`);
ok(exp3.status === 200 && exp3.body.kind === 'area' && exp3.body.rooms.length === nRoomsA, 'ids= and kind= are ignored: still the whole area (a selection is not exported)', [exp3.body.kind, exp3.body.rooms?.length]);
const exp4 = await http(`/c/${A.id}/a/${A.area}/share?strip=1&seat=${ATK}`);
ok(exp4.status === 200 && exp4.body.kind === 'area' && exp4.body.secrets === false && !exp4.body.pawns.length, 'strip=1 still strips', [exp4.body.secrets, exp4.body.pawns?.length]);
ok((await http(`/c/${A.id}/a/${A.area}/share?seat=${PTK}`)).status === 403, 'a player\'s seat cannot export (build permission)');
const imp = await http(`/c/${Bc.id}/a/${Bc.area}/do?cmd=import&link=${encodeURIComponent(`https://turnipworks.net/s/${id1}`)}&x=400&z=400&nonce=imp1&seat=${Bc.tok}`);
ok(imp.body.ok && imp.body.ids.length >= 2 && imp.body.kind === 'building', 'do?cmd=import&link=…: the build lands, its ids in the answer', imp.body);
const imp2 = await http(`/c/${Bc.id}/a/${Bc.area}/do?cmd=import&link=${id1}&x=400&z=400&nonce=imp1&seat=${Bc.tok}`);
ok(imp2.body.duplicate, 'the same nonce again: a retry, not a second copy');
const und = await http(`/c/${Bc.id}/a/${Bc.area}/do?cmd=undo&nonce=u1&seat=${Bc.tok}`);
ok(und.body.ok && imp.body.ids && !Object.keys(ents(Bc)).some(k => imp.body.ids.includes(k)), 'undo over GET takes the whole import away');
ok(!(await http(`/c/${Bc.id}/a/${Bc.area}/do?cmd=import&link=https://evil.example/s/xx&nonce=imp3&seat=${Bc.tok}`)).body.ok, 'a link that is not ours: refused, nothing fetched');
const card = ruleCard(Bc.rt, Bc.gm, base, Bc.tok), pcard = ruleCard(A.rt, 'seat_mira000001', base, PTK);
const hp = (await http(`/c/${Bc.id}/help/sharing?seat=${Bc.tok}`)).text;
ok(/cmd=import&link=/.test(card) && /help\/sharing/.test(card) && !/cmd=import/.test(pcard), 'the GM\'s card has the import line and the sharing page; a player\'s has neither');
ok(/\/share\?strip=1/.test(hp) && !/ids=ID/.test(hp) && /cmd=import&link=LINK&x=FEET&z=FEET/.test(hp), 'help/sharing: export the area (strip), import with a place; no ids=');
// deletes
ok((await http(`/s/${id1}/delete`, { method: 'POST', body: { token: mk.body.del } })).body.ok && (await http(`/s/${id1}`)).status === 404 && !fs.existsSync(path.join(dataDir, 'shares', `${id1}.webp`)), 'the delete key deletes it: page, build and picture gone');
const mk2 = (await http(`/c/${A.id}/shares?seat=${ATK}`, { method: 'POST', body: JSON.stringify(G1) })).body;
ok((await http(`/c/${A.id}/shares/${mk2.id}/delete?seat=${ATK}`, { method: 'POST' })).body.ok && (await http(`/s/${mk2.id}/json`)).status === 404, 'the creating seat deletes its own link');
const mk3 = (await http(`/c/${A.id}/shares?seat=${ATK}`, { method: 'POST', body: JSON.stringify(G1) })).body;
ok((await http(`/admin/shares/${mk3.id}/takedown`, { method: 'POST', body: { reason: 'test' } })).status === 403, 'a takedown without the admin key: refused');
const td = await http(`/admin/shares/${mk3.id}/takedown`, { method: 'POST', body: { reason: 'TEST takedown' }, headers: { 'x-tw-admin': relay.adminKey } });
ok(td.body.ok && (await http(`/s/${mk3.id}`)).status === 404, 'the admin takedown deletes it by id');
ok(fs.readFileSync(path.join(dataDir, 'shares', 'takedowns.jsonl'), 'utf8').includes('TEST takedown'), 'and logs it (takedowns.jsonl)');
// limits
let last = null;
for (let i = 0; i < LINK_LIMITS.perSeatHour; i++) last = await http(`/c/${A.id}/shares?seat=${ATK}`, { method: 'POST', body: JSON.stringify(G1) });
ok(last.status === 429, `rate-limited: at most ${LINK_LIMITS.perSeatHour} links a seat an hour`, last.status);
let reads = null; for (let i = 0; i < LINK_LIMITS.readsPerIpMinute + 2; i++) reads = await http(`/s/AAAAAAAAAAAAAAAAAAAAAA`);
ok(reads.status === 429, `reads are rate-limited too (${LINK_LIMITS.readsPerIpMinute} a minute)`);

await relay.close();
console.log(`share: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
