// node test/vehicles.test.mjs : THE VEHICLES (2026-11-07; Harry: "we maybe need a few more vehicle options ... choppers, APC,
// cop car"). docs/ASSETS_TO_BUILD.md "Vehicles". On the tuner's data (library.json, rooms.json; engine/client/data/types.json)
// and the code the browser runs (client/taxonomy.js, client/library-index.js, client/barwords.js, the room engine):
//   catalog   the ten new things are in the library, each with a mesh the game can draw (bounds), tier mod only, of the
//             vehicles batch; real-world sizes at 5 ft to the square (the cruiser in a sedan's box, the helicopters the
//             biggest props in the game, the drones under a square or two)
//   menu      they are Modern things (catalog set MOD / CYB: roles of the Modern buildings in types.json) and on the Build library's shelves in their own
//             "Vehicles" section, in the rooms where they belong (the cruiser on the street, the helicopters on the roof,
//             the drones in the rigger's garage), and in no fantasy room's
//   search    the command bar's words find them: chopper, gunship, cop car, apc, battlewagon, hexapod, rc car ...
//   rooms     the programs park them: some streets have the police cruiser in a parked car's place, some roofs a
//             helicopter (always with the stair hut, inside the roof, nothing tall under its rotor), some rigger's
//             garages a second drone; no fantasy room ever places one
//   desks     (Harry, same day: "security cameras for the wall ... desk debris (laptop, CRT, mouse, donut)") the eleven
//             camera and desk things are in the library (tier mod, batch moddesk-03, small but not specks); on the Dressing
//             shelves of the office, lobby, server room ...; the bar finds them; the programs hang a camera high on a wall of
//             the lobby, store, garage, server room and office, and stand the desk things ON the desks' work tops
import fs from 'node:fs';
import { buildTaxonomy } from '../client/taxonomy.js';
import { libraryContents } from '../client/library-index.js';
import { CATALOG_WORDS } from '../client/barwords.js';
import { SOLVER_OPTS } from '../core/roomgen.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import { loadTree, makeHarness, overlap } from '../../tools/spawn-tuner/test/ccm_lib.mjs';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got ?? ''); } else console.log('ok  ', name, got ?? ''); };
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const lib = read('../tuner-data/library.json'), rooms = read('../tuner-data/rooms.json'), data = read('../client/data/types.json'), spawns = read('../client/data/library-spawns.json');
const usable = (k) => solver.skuUsable(k, SOLVER_OPTS);
// id -> [min, max] of its long side in feet as the game draws it (nominal scale), and its type codes
const NEW = { 'helicopter': [[25, 36], ['MOD', 'CYB']], 'helicopter-gunship': [[36, 48], ['CYB']], 'car-police': [[13, 17], ['MOD', 'CYB']], 'suv-armoured': [[14, 19], ['MOD', 'CYB']],
  'van-armoured': [[16, 23], ['MOD', 'CYB']], 'drone-quad-light': [[1.2, 3], ['CYB']], 'drone-quad-heavy': [[2.5, 5.5], ['CYB']], 'drone-hexapod': [[5, 8.5], ['CYB']],
  'drone-rover-arm': [[2, 4.5], ['CYB']], 'drone-rover-sentry': [[2.2, 5], ['CYB']] };
const S = await loadTree('veh'), H = makeHarness(S);
const C = new solver.Ctx({ lib: S.lib, room: { id: 'x', x: 0, z: 0, w: 4, d: 4, seed: 1, type: 'mod-street', family: 'concrete' }, type: S.T['mod-street'], opts: { ...SOLVER_OPTS, scaleVariety: 0 } });
const dims = (id) => { const sk = (S.lib.objects[id]?.skus || []).find(s => s.bounds); return sk ? C.nominalDims(id, sk) : null; };

const DESK = { 'camera-security': [0.6, 2], 'camera-dome': [0.6, 1.6], 'laptop-open': [0.8, 1.8], 'monitor-crt': [1, 2], 'monitor-flat': [1.2, 2.4], 'keyboard': [1, 2],
  'mouse-computer': [0.25, 0.7], 'donut': [0.3, 0.7], 'donut-box': [0.7, 1.4], 'coffee-cup-paper': [0.35, 0.8], 'desk-phone': [0.5, 1.1], 'paper-stack': [0.7, 1.4] };
// ---- catalog
for (const [id, [[lo, hi], codes]] of Object.entries(NEW)) {
  const o = lib.objects[id], sk = (o?.skus || []).filter(k => k.bounds && usable(k));
  ok(`${id}: in the library with a mesh the game draws`, sk.length > 0, o ? `${o.skus.length} sku(s)` : 'missing');
  if (!sk.length) continue;
  ok(`${id}: every sku tier mod, of the vehicles batch`, o.skus.every(k => k.tier === 'mod' && k.src === 'vehicles-03'), o.skus.map(k => `${k.sku}:${k.tier}:${k.src}`).join(' '));
  ok(`${id}: a Modern thing only (no fantasy room rolls it)`, (o.only || []).join() === 'mod', JSON.stringify(o.only));
  const d = dims(id), long = d && Math.max(d.w, d.d);
  ok(`${id}: drawn ${lo}-${hi} ft long (real-world, 5 ft to the square)`, d && long >= lo && long <= hi, d && `${d.w.toFixed(1)} x ${d.d.toFixed(1)} x ${d.h.toFixed(1)} ft`);
  const mt = data.types.filter(t => t.genre === 'modern' && t.roles.includes(id)).map(t => t.code); // (since the modtypes regroup, 2026-11-07, the Modern genre's types are buildings: engine/tools/modern_buildings.json)
  ok(`${id}: a role of some Modern building (catalog set ${codes.join(', ')})`, mt.length > 0, mt.join(' '));
}
for (const [id, [lo, hi]] of Object.entries(DESK)) {
  const o = lib.objects[id], sk = (o?.skus || []).filter(k => k.bounds && usable(k));
  ok(`${id}: in the library with a mesh, tier mod, of the cameras-and-desks batch`, sk.length > 0 && o.skus.every(k => k.tier === 'mod' && k.src === 'moddesk-03') && (o.only || []).join() === 'mod', o ? o.skus.map(k => `${k.sku}:${k.tier}:${k.src}`).join(' ') : 'missing');
  const d = sk.length && dims(id), big = d && Math.max(d.w, d.d, d.h);
  ok(`${id}: ${lo}-${hi} ft at its biggest (chunky, real-world)`, d && big >= lo && big <= hi, d && `${d.w.toFixed(2)} x ${d.d.toFixed(2)} x ${d.h.toFixed(2)} ft`);
}
ok('the wall camera hangs on a wall, the dome from the ceiling', lib.objects['camera-security']?.place === 'wall' && lib.objects['camera-dome']?.place === 'ceiling', `${lib.objects['camera-security']?.place} ${lib.objects['camera-dome']?.place}`);
{ const p = dims('car-police'), s = dims('car-sedan');
  ok('the police cruiser fits a parked sedan\'s place (its footprint is no bigger)', p && s && p.w <= s.w + 0.4 && p.d <= s.d + 0.4, p && s && `cruiser ${p.w.toFixed(1)}x${p.d.toFixed(1)}, sedan ${s.w.toFixed(1)}x${s.d.toFixed(1)}`);
  const h = dims('helicopter'), g = dims('helicopter-gunship'), L = (d) => d ? Math.max(d.w, d.d) : 0;
  let big = ['', 0]; for (const [id, o] of Object.entries(S.lib.objects)) if (!NEW[id] && /^(floor|ground)$/.test(o.place) && o.skus.some(k => k.bounds)) { const l = L(dims(id)); if (l > big[1]) big = [id, l]; }
  ok('the helicopters are the biggest props in the game (the gunship the bigger)', L(h) > big[1] && L(g) > L(h), `${L(h).toFixed(1)} / ${L(g).toFixed(1)} ft; the biggest other: ${big[0]} ${big[1].toFixed(1)} ft`); }

// ---- menu: the Vehicles section of each room's library
const X = buildTaxonomy({ lib, roomTypes: rooms, data, usable, spawns });
const roomNodes = [...X.nodes.values()].filter(r => r.level === 'room');
const recipeOf = (key) => rooms.find(r => r.key === key) || { slots: {} };
const shelf = (key) => { const node = roomNodes.find(r => r.roomKey === key); return node ? libraryContents(node, { lib, recipe: recipeOf(key), usable }) : null; };
const vehiclesOf = (key) => { const s = shelf(key); return s ? (s.find(([k]) => k === 'vehicles')?.[2] || []).map(i => i.cat) : null; };
const WANT = { 'mod-street': ['car-police', 'suv-armoured', 'van-armoured', 'car-sedan'], 'mod-garage': ['car-police', 'suv-armoured', 'van-armoured'], 'cyb-rooftop': ['helicopter', 'helicopter-gunship'],
  'cyb-rigger': ['drone-quad-light', 'drone-quad-heavy', 'drone-hexapod', 'drone-rover-arm', 'drone-rover-sentry', 'drone-parked'], 'cyb-hideout': ['van-armoured'], 'cyb-lobby': ['drone-hexapod'] };
for (const [key, ids] of Object.entries(WANT)) { const v = vehiclesOf(key);
  ok(`${key}: a Vehicles section on its shelves with ${ids.join(', ')}`, v && ids.every(i => v.includes(i)), v ? v.join(', ') : 'no such room'); }
{ const s = shelf('mod-street'), anchors = (s?.find(([k]) => k === 'anchor')?.[2] || []).map(i => i.cat);
  ok('the street\'s parked cars are shelved under Vehicles, not twice', !anchors.includes('car-sedan') && (vehiclesOf('mod-street') || []).filter(i => i === 'car-sedan').length === 1, anchors.join(', ')); }
const dressOf = (key) => { const s = shelf(key); return s ? s.flatMap(([, , l]) => l.map(i => i.cat)) : []; };
for (const [key, ids] of Object.entries({ 'mod-office': ['laptop-open', 'monitor-crt', 'keyboard', 'mouse-computer', 'donut', 'donut-box', 'coffee-cup-paper', 'desk-phone', 'paper-stack', 'camera-security'],
  'cyb-lobby': ['camera-security', 'camera-dome', 'monitor-flat'], 'mod-store': ['camera-security'], 'mod-garage': ['camera-security'], 'cyb-server': ['camera-security', 'keyboard'], 'cyb-safehouse': ['laptop-open'] })) {
  const have = dressOf(key); ok(`${key}: its shelves hold ${ids.join(', ')}`, ids.every(i => have.includes(i)), ids.filter(i => !have.includes(i)).join(', ')); }
const everywhere = new Set(roomNodes.flatMap(r => libraryContents(r, { lib, recipe: recipeOf(r.roomKey), usable }).flatMap(([, , l]) => l.map(i => i.cat))));
ok('every new vehicle, camera and desk thing is on some room\'s shelves', [...Object.keys(NEW), ...Object.keys(DESK)].every(i => everywhere.has(i)), [...Object.keys(NEW), ...Object.keys(DESK)].filter(i => !everywhere.has(i)).join(', '));
const fantasy = roomNodes.filter(r => !/^(mod|cyb)-/.test(r.roomKey) && !rooms.find(t => t.key === r.roomKey)?.tiers?.includes('mod'));
const leak = fantasy.filter(r => libraryContents(r, { lib, recipe: recipeOf(r.roomKey), usable }).some(([, , l]) => l.some(i => NEW[i.cat] || DESK[i.cat])));
ok('no fantasy or culture room shelves a vehicle', !leak.length, leak.slice(0, 6).map(r => r.roomKey).join(', '));

// ---- search: the bar's words
const terms = (id) => CATALOG_WORDS.filter(([re]) => re.test(id)).flatMap(([, w]) => w);
for (const [q, ids] of [['chopper', ['helicopter', 'helicopter-gunship']], ['helicopter', ['helicopter', 'helicopter-gunship']], ['gunship', ['helicopter-gunship']], ['cop car', ['car-police']], ['police car', ['car-police']],
  ['apc', ['van-armoured']], ['battlewagon', ['van-armoured']], ['armoured suv', ['suv-armoured']], ['hexapod', ['drone-hexapod']], ['gun drone', ['drone-quad-light', 'drone-quad-heavy']], ['rc car', ['drone-rover-arm', 'drone-rover-sentry']], ['vehicle', ['car-police', 'helicopter']],
  ['security camera', ['camera-security', 'camera-dome']], ['cctv', ['camera-security']], ['laptop', ['laptop-open']], ['crt', ['monitor-crt']], ['mouse', ['mouse-computer']], ['donut', ['donut', 'donut-box']], ['coffee', ['coffee-cup-paper']]])
  ok(`the bar's words: "${q}" names ${ids.join(', ')}`, ids.every(i => terms(i).includes(q)), ids.map(i => `${i}: ${terms(i).length} words`).join('; '));

// ---- rooms: what the programs park
const { mk } = H; let police = 0, streets = 0, heli = 0, roofs = 0, drones = 0, riggers = 0;
const TALL = /^(roof-access-hut|water-tank-roof|billboard-roof|antenna-mast)$/;
for (let seed = 1; seed <= 24; seed++) for (const [w, d] of [[10, 5], [8, 4], [12, 6]]) {
  const B = H.build([mk('r', 'mod-street', 10, 10, w, d, seed * 31 + w, 1)]), L = B.solve('r'); streets++;
  const P = L.placements.filter(p => p.id === 'car-police'); police += P.length > 0;
  ok(`street ${w}x${d} seed ${seed}: at most one police cruiser, parked at the kerb`, P.length <= 1 && P.every(p => p.rule === 'parked-car'), P.map(p => p.rule).join());
  for (const p of P) ok(`street ${w}x${d} seed ${seed}: the cruiser overlaps nothing`, !L.placements.some(q => q !== p && !q.parent && q.y < 0.5 && q.orient !== 'floor' && q.kind !== 'flat' && overlap(p, q)), L.placements.filter(q => q !== p && q.kind !== 'flat' && overlap(p, q)).map(q => q.id).join());
}
ok('about one street in three has the police cruiser', police >= streets * 0.15 && police <= streets * 0.6, `${police} of ${streets}`);
for (let seed = 1; seed <= 30; seed++) for (const [w, d] of [[8, 8], [10, 8], [10, 10]]) {
  const B = H.build([mk('r', 'cyb-rooftop', 10, 10, w, d, seed * 53 + w, 1)]), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'); roofs++;
  const P = L.placements.filter(p => /^helicopter/.test(p.id)); heli += P.length > 0;
  ok(`roof ${w}x${d} seed ${seed}: solved`, !L.purposeFail, L.purposeFail);
  if (!P.length) continue;
  const p = P[0], R = Math.max(p.dims[0], p.dims[2]) / 2, X0 = r.x * 5, Z0 = r.z * 5;
  ok(`roof ${w}x${d} seed ${seed}: one aircraft, with the stair hut (the way down)`, P.length === 1 && L.cybInfo?.hut, `${P.length} ${L.cybInfo?.hut}`);
  ok(`roof ${w}x${d} seed ${seed}: the ${p.id}'s rotor is over the roof`, p.x - R >= X0 - 0.5 && p.x + R <= X0 + r.w * 5 + 0.5 && p.z - R >= Z0 - 0.5 && p.z + R <= Z0 + r.d * 5 + 0.5, `${p.x},${p.z} r ${R.toFixed(1)}`);
  const under = L.placements.filter(q => TALL.test(q.id) && Math.hypot(Math.max(Math.abs(q.x - p.x) - q.dims[0] / 2, 0), Math.max(Math.abs(q.z - p.z) - q.dims[2] / 2, 0)) < R * 0.97);
  ok(`roof ${w}x${d} seed ${seed}: nothing tall under the rotor`, !under.length, under.map(q => q.id).join());
}
ok('some roofs have a helicopter, not all', heli >= roofs * 0.15 && heli < roofs, `${heli} of ${roofs}`);
for (let seed = 1; seed <= 20; seed++) {
  const B = H.build([mk('r', 'cyb-rigger', 10, 10, 8, 6, seed * 41, 1)]), L = B.solve('r'); riggers++;
  drones += L.placements.some(p => /^drone-(quad|rover|hexapod)/.test(p.id));
}
ok('most rigger\'s garages have a second drone (a gun or utility drone)', drones >= riggers * 0.5, `${drones} of ${riggers}`);
// cameras and desk things, as the programs lay them
const DESKS = /^(cubicle-desk|terminal-desk|reception-desk|workbench-garage)$/, cams = {}, onDesk = {}, tried = {};
for (const [key, w, d] of [['mod-office', 8, 6], ['mod-office', 10, 8], ['cyb-lobby', 8, 6], ['mod-store', 6, 5], ['mod-garage', 8, 6], ['cyb-server', 6, 6], ['cyb-safehouse', 6, 5], ['cyb-rigger', 8, 6]]) for (let seed = 1; seed <= 6; seed++) {
  const B = H.build([mk('r', key, 10, 10, w, d, seed * 67 + w, 1)]), L = B.solve('r'); tried[key] = (tried[key] || 0) + 1;
  const C = L.placements.filter(p => p.id === 'camera-security'); cams[key] = (cams[key] || 0) + (C.length > 0);
  for (const p of C) ok(`${key} seed ${seed}: the camera is high on a wall (${p.y.toFixed(1)} ft up)`, p.side && p.y >= 6.5 && p.y + p.dims[1] <= 9.05, `${p.side} ${p.y}`);
  for (const p of L.placements.filter(p => DESK[p.id] && !/^camera-/.test(p.id))) {
    const desk = L.placements.find(q => q.uid === p.parent); onDesk[key] = (onDesk[key] || 0) + 1;
    ok(`${key} seed ${seed}: ${p.id} stands on a desk's work top`, desk && DESKS.test(desk.id) && p.y > desk.y + 0.3 * desk.dims[1] && p.y < desk.y + 0.7 * desk.dims[1], desk ? `${desk.id} y ${p.y} of ${desk.dims[1]}` : 'no parent desk');
  }
}
for (const k of ['cyb-lobby', 'mod-store', 'mod-garage', 'cyb-server', 'mod-office']) ok(`${k}: every room has a security camera`, cams[k] === tried[k], `${cams[k] || 0} of ${tried[k]}`);
ok('desk things on the office desks', (onDesk['mod-office'] || 0) >= 12, onDesk['mod-office']);
for (const k of ['cyb-lobby', 'cyb-server', 'cyb-safehouse']) ok(`${k}: desk things on its desk`, (onDesk[k] || 0) >= 3, onDesk[k]);
let leakRooms = 0; const leaks = [];
for (const t of S.types.filter(t => !/^(mod|cyb)-/.test(t.key) && !t.byHand && t.key !== 'hill')) for (let seed = 1; seed <= 2; seed++) {
  const B = H.build([mk('r', t.key, 10, 10, t.cells[0], t.cells[1], seed * 59, 1)]), L = B.solve('r'); leakRooms++;
  for (const p of L.placements) if (NEW[p.id] || DESK[p.id]) leaks.push(`${t.key}:${p.id}`);
}
ok(`no fantasy or culture room places a vehicle, camera or desk thing (${leakRooms} rooms solved)`, !leaks.length, leaks.slice(0, 6).join(', '));
console.log(`vehicles: ${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
