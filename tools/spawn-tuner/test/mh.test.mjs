// The modhalls lane (2026-11-07): the Modern genre's corridors (Harry: "definitely modern hallways as well"): the apartment
// hallway, the office corridor, the hotel corridor and the service corridor. experiments/2026-11-07-modhalls.
//   node tools/spawn-tuner/test/mh.test.mjs [tuner dir] [--print]
//   types     the four are room types (rooms.json), tier mod, passages, filed under City; walls.js and solver2.js list the
//             same four; each is in its Modern buildings (engine/tools/modern_buildings.json) and is the `hall` of the
//             buildings that build round it; their lights are lights (fx/fire.js)
//   rooms     every corridor x widths 1 and 2 cells x lengths 2..12 x both directions x a door at each end / one door x
//             seeds: the shared checks (ccm_lib.mjs: no purpose fail, nothing outside, nothing overlapping, doors and paths
//             clear, nothing hung on a door, lit, deterministic) plus: nothing standing on the floor of a corridor one cell
//             wide; a 2-ft walker reaches every door from the main one (walkCheck); every placement a modern sku or a vetted borrowed look (MX_BORROW); the doors modern ones
//   reads     each corridor's signature (mxInfo), once its meshes exist: the runner down the apartment hallway and the
//             hotel corridor, sconces down them; fluorescent panels in the office and service corridors; the pipes high on
//             one service-corridor wall, never over a door; the exit sign and the extinguisher in every corridor 3+ cells
//             long; the mailboxes only on the ground floor
//   leak      no other room places one of this lane's skus
import { readFileSync } from 'node:fs';
import { loadTree, makeHarness, CELL, standing, walkCheck } from './ccm_lib.mjs';
const S = await loadTree('mh'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = S.w.MH_ROOMS || [], BORROW = S.s2.MX_BORROW || {};
const SKU = new Map(); for (const o of Object.values(S.lib.objects)) for (const s of o.skus) SKU.set(s.sku, { ...s, role: o.id });
const MINE = (sku) => /^modhalls-/.test(SKU.get(sku)?.src || '');
const HASMINE = (id) => (S.lib.objects[id]?.skus || []).some(s => MINE(s.sku));
const B = await import(S.dir + 'js/buildings.js');
// ---- types
const TY = JSON.parse(readFileSync(new URL('../../../engine/client/data/types.json', import.meta.url)));
const MB = JSON.parse(readFileSync(new URL('../../../engine/tools/modern_buildings.json', import.meta.url)));
const WANT = ['mod-apartment-hallway', 'mod-office-corridor', 'mod-hotel-corridor', 'mod-service-corridor'];
ok(KEYS.join() === WANT.join() && (S.s2.MH_ROOMS || []).join() === WANT.join(), `four corridors, the same list in walls.js and solver2.js: ${KEYS} / ${S.s2.MH_ROOMS}`);
const WANT_IN = { 'mod-apartment-hallway': ['APT'], 'mod-office-corridor': ['OFC'], 'mod-hotel-corridor': ['APT'], 'mod-service-corridor': ['BAR', 'SHP', 'WHS', 'HID'] };
const HALL_OF = { APT: 'mod-apartment-hallway', OFC: 'mod-office-corridor', BAR: 'mod-service-corridor', SHP: 'mod-service-corridor', WHS: 'mod-service-corridor', HID: 'mod-service-corridor' };
for (const k of WANT) {
  ok(!!S.T[k], `room type ${k} is in rooms.json`);
  ok((S.T[k]?.tiers || []).join() === 'mod' && S.T[k]?.recipes?.[0] === k, `${k}: tier mod, its first recipe its own key (${S.T[k]?.tiers} ${S.T[k]?.recipes})`);
  ok(S.w.roleOf(k) === 'passage', `${k} is a passage (${S.w.roleOf(k)})`);
  ok(WANT_IN[k].every(b => (MB.rooms[k] || []).includes(b)), `${k} is in the buildings ${WANT_IN[k]} (modern_buildings.json: ${MB.rooms[k]})`);
}
for (const [code, hall] of Object.entries(HALL_OF)) {
  ok(MB.buildings.find(b => b.code === code)?.hall === hall, `${code}'s hall is ${hall} (modern_buildings.json)`);
  ok(TY.types.find(t => t.code === code)?.hall === hall, `types.json: ${code} carries hall ${hall} (else run engine/tools/build_types.py)`);
}
const FIRE = readFileSync(S.dir + 'js/fx/fire.js', 'utf8'); // (it imports three.js: read as text, as mx.test does)
ok(/sconce-wall-modern\/\.test\(id\)\) return 'bulb'/.test(FIRE) && /exit-sign\/\.test\(id\)\) return 'exit'/.test(FIRE) && /\n  exit: +\{[^}]*electric:/.test(FIRE), 'the sconce is a bulb, the exit sign a green glow (fx/fire.js)');
ok(typeof B.buildingRoles === 'function', 'buildings.js buildingRoles (a building\'s hub and hall)');
const ELEC = [[/^light-fluorescent/, 'tube'], [/^light-wall-strip/, 'tube'], [/^sconce-wall-modern/, 'bulb'], [/^exit-sign/, 'exit']];
// ---- rooms
const MOD_DOORS = /^(door-flush|door-steel|door-shopfront|door-roller-shutter)$/;
const NEAR = { 'mod-apartment-hallway': ['mod-apartment', 'mod-bathroom'], 'mod-office-corridor': ['cyb-lobby', 'mod-office'], 'mod-hotel-corridor': ['cyb-lobby', 'cyb-capsule'], 'mod-service-corridor': ['mod-bar', 'mod-kitchen'] };
const modern = (p) => { const s = SKU.get(p.sku); if (!s) return false; if (s.tier === 'mod' || s.tier === 'cyb') return true; const b = BORROW[p.id]; return !!b && (!b.length || b.includes(p.sku)); };
const stats = {}; let rooms = 0;
for (const k of WANT.filter(k => S.T[k])) for (const wd of [1, 2]) for (let len = 2; len <= 12; len++) for (const flip of [0, 1]) for (const ends of [2, 1]) for (let seed = 1; seed <= 2; seed++) {
  const w = flip ? wd : len, d = flip ? len : wd, tag = `${k} ${w}x${d} ends${ends} s${seed}`;
  const h = mk('r', k, 0, 0, w, d, seed * 31 + len, 3);
  const a = mk('a', NEAR[k][0], flip ? -2 : -6, flip ? -6 : -2, 6, 6, 7, 1), b = mk('b', NEAR[k][1], flip ? -1 : len, flip ? len : -1, 4, 4, 9, 2);
  let Bd, L;
  try { Bd = H.build(ends === 2 ? [a, b, h] : [a, h]); L = Bd.solve('r'); } catch (e) { ok(false, `${tag} THREW ${e.message}`); continue; }
  rooms++;
  const doors = Bd.E.openings.get('r').filter(o => o.kind === 'door');
  ok(doors.length >= 1, `${tag} has no door`);
  H.checkRoom(tag, Bd, h, L, { focal: null, lights: true, fire: ELEC });
  const wc = walkCheck(h, Bd.E.openings.get('r'), L, null); ok(wc.doors, `${tag}: a 2-ft walker cannot reach every door from the main one (ccm_lib walkCheck)`);
  for (const p of L.placements) ok(modern(p), `${tag} ${p.id} (${p.sku}) is neither a modern sku nor a vetted borrowed look`);
  for (const e of [...Bd.E.edges.values()].filter(e => e.kind === 'door' && e.sides.some(s => s.room === 'r'))) ok(MOD_DOORS.test(e.doorType), `${tag} door type ${e.doorType}`);
  if (wd === 1) ok(!standing(L).some(p => p.rule !== 'rug' && p.orient !== 'floor' && p.y < 0.5 && !/^(rug|decal)/.test(p.id)), `${tag} something stands on the floor of a 5-ft corridor: ${standing(L).filter(p => p.rule !== 'rug').map(p => p.id)}`);
  const I = L.mxInfo || {}, st = stats[k] ||= { n: 0, props: 0, things: new Map() };
  st.n++; st.props += L.placements.length; for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  if (L.purposeFail) continue;
  if (/apartment|hotel/.test(k) && len >= 3) ok(I.runner >= 1, `${tag} no runner down the corridor`);
  if (/apartment|hotel/.test(k) && HASMINE('sconce-wall-modern')) ok(I.lights >= 1, `${tag} no sconce`);
  if (/office|service/.test(k)) ok(I.tubes >= 1, `${tag} no fluorescent panel`);
  if (k === 'mod-service-corridor' && HASMINE('pipe-run-wall')) {
    ok(I.pipes >= 1 || len < 3, `${tag} no pipes along the wall`); // (a 10-ft stub: its walls are door and a gap shorter than one 5-ft run)
    const pipes = L.placements.filter(p => p.id === 'pipe-run-wall'), X0 = h.x * CELL + 0.5, Z0 = h.z * CELL + 0.5;
    ok(new Set(pipes.map(p => p.side)).size <= 1, `${tag} pipes on more than one wall`);
    for (const p of pipes) for (const o of doors.filter(o => o.side === p.side)) { const t = p.side === 'N' || p.side === 'S' ? p.x - X0 : p.z - Z0, a0 = o.index * CELL - 0.5, a1 = a0 + CELL; ok(!(t + p.dims[0] / 2 > a0 + 0.05 && t - p.dims[0] / 2 < a1 - 0.05), `${tag} a pipe over the ${o.side} door`); }
  }
  if (len >= 3) for (const id of ['exit-sign', 'fire-extinguisher']) if (HASMINE(id)) ok(I.once?.includes(id), `${tag} no ${id}`);
  ok(!L.placements.some(p => p.id === 'mailbox-bank') || !(h.y > 0), `${tag} mailboxes above the ground floor`);
}
// mailboxes: on the ground floor's hallway only
if (HASMINE('mailbox-bank') && S.T['mod-apartment-hallway']) {
  let ground = 0, up = 0;
  for (let seed = 1; seed <= 12; seed++) for (const y of [0, 10]) { const h = mk('r', 'mod-apartment-hallway', 0, 0, 8, 2, seed * 13, 2); if (y) h.y = y; const L = H.build([mk('a', 'mod-apartment', -6, -2, 6, 6, 7, 1), h]).solve('r'); const n = L.placements.filter(p => p.id === 'mailbox-bank').length; if (y) up += n; else ground += n; }
  ok(ground > 0 && up === 0, `mailboxes: ${ground} on the ground floor, ${up} upstairs`);
}
// ---- buildings: the plan's corridors are the building's own corridor (buildings.js, as client/main.js builds them)
const tray = (code) => (TY.types.find(t => t.code === code)?.rooms || []).filter(k => S.T[k]).map(k => ({ key: k, cells: S.T[k].cells || [3, 3], outdoor: !!S.T[k].outdoor || S.T[k].program === 'outdoors' }));
let plans = 0;
for (const [code, hall] of Object.entries(HALL_OF)) {
  const types = tray(code), bt = TY.types.find(t => t.code === code), roles = B.buildingRoles(S.w.ROLES, { hub: bt?.hub, hall: bt?.hall, rooms: types.map(t => t.key) });
  ok(B.programmeFor(code, types, roles).hall === hall, `${code}: the programme's hall is ${hall}`);
  let halls = 0;
  for (const [w, d] of [[14, 11], [20, 16], [12, 8], [24, 12]]) for (const storeys of [1, 2, 3]) for (const seed of [1, 7, 19]) {
    const plan = B.generate({ code, rect: { x: 0, z: 0, w, d }, seed, storeys, front: 'S', types, roles }); plans++;
    const hs = plan.rooms.filter(r => r.role === 'hall');
    halls += hs.length;
    ok(hs.every(r => r.type === hall), `${code} ${w}x${d}x${storeys} s${seed}: a corridor of type ${[...new Set(hs.map(r => r.type))]} (wanted ${hall})`);
    ok(!plan.rooms.some(r => r.role !== 'hall' && /hallway|corridor/.test(r.type)), `${code} ${w}x${d}x${storeys} s${seed}: a corridor laid as a room: ${plan.rooms.filter(r => r.role !== 'hall' && /hallway|corridor/.test(r.type)).map(r => r.type)}`);
  }
  ok(halls > 0, `${code}: its plans have corridors (${halls})`);
}
// ---- leak: no other room places one of this lane's skus
let other = 0;
for (const t of S.types.filter(t => !WANT.includes(t.key) && !t.byHand && t.key !== 'hill')) for (let seed = 1; seed <= (/^(mod|cyb)-/.test(t.key) ? 3 : 1); seed++) {
  const Bd = H.build([mk('r', t.key, 10, 10, t.cells[0], t.cells[1], seed * 59, 1)]), L = Bd.solve('r'); other++;
  ok(!L.placements.some(p => MINE(p.sku)), `${t.key} seed ${seed} places a modhalls sku: ${L.placements.filter(p => MINE(p.sku)).map(p => p.sku)}`);
}
if (PRINT) for (const [k, st] of Object.entries(stats)) console.log(k.padEnd(22), `${st.n} rooms, ${(st.props / st.n).toFixed(1)} placements;`, [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([i, n]) => `${i} ${n}`).join(', '));
console.log(`mh: ${rooms} corridors solved, ${plans} building plans, ${other} other rooms solved for the leak check; meshes: ${['sconce-wall-modern', 'pipe-run-wall', 'exit-sign'].map(i => `${i} ${HASMINE(i) ? 'yes' : 'not yet'}`).join(', ')}`);
H.report('mh');
