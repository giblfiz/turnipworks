// The cyberpunk pack, wave 2 (2026-11-07): the Modern genre's ten near-future rooms (its Cyberpunk type that day, then its buildings) on wave 1's wall families, the
// rooftop outdoor.
//   node test/cyb.test.mjs [tuner dir] [--print]
//   genre     engine types.json: no Cyberpunk (or City) type a player sees (2026-11-07); every Cyberpunk room is in a modern building
//   rooms     every room type x 4 sizes x 5 seeds x 2 arrangements (alone; beside a city street): the shared checks
//             (ccm_lib.mjs) plus: every placement is tier mod; doors are modern doors; the family is the room's
//   reads     the signature of each room is laid (cybInfo): the chair and its lamp, the desk and the turnstiles behind the
//             glass front, rows of racks, the counter and its stools, rows of capsules, the drum and the chain-link lock-up,
//             the counter and the curio shelves, the car and the bench, the deck, the stair hut and the parapet
//   sight     GLASS AND CHAIN-LINK on real layouts (engine/client/vision.js): the lobby's glass front is seen through and
//             stops feet; the hideout's lock-up is seen through and stops feet; a plain wall stops both
//   looks     the wave-2 LOOKS of shared roles are tier cyb (exclusive): a City program never rolls one; a Cyberpunk
//             program prefers it (the near-future sedan, the bowl and flask neon)
//   leak      no fantasy or City room ever places a wave-2 sku
//   lights    the wave-2 lights are typed in fx/fire.js
import { readFileSync } from 'node:fs';
import { loadTree, makeHarness } from './ccm_lib.mjs';
const S = await loadTree('cyb'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
// (2026-11-07) roles of the plain set the modern set shares (solver2.js modShared: MX_BORROW + MOD_SHARED), in their vetted looks (modLooks)
const SHARED = { has: (id) => !!S.s2.modShared?.(id) }, LOOKS = (id) => S.s2.modLooks?.(id), PLAIN = (t) => !t || t === 'common' || t === 'fine';
const KEYS = S.w.CYB_ROOMS, OUT = new Set(['cyb-rooftop']);
const SKU = new Map(); for (const o of Object.values(S.lib.objects)) for (const s of o.skus) SKU.set(s.sku, s);
const HAS = (id) => (S.lib.objects[id]?.skus || []).some(s => s.tier === 'mod' || s.tier === 'cyb');
const WAVE2 = (sku) => /^cyberpunk-/.test(SKU.get(sku)?.src || '');
const V = await import(new URL('../../../engine/client/vision.js', import.meta.url));
// ---- genre, words, lights
const TY = JSON.parse(readFileSync(new URL('../../../engine/client/data/types.json', import.meta.url)));
ok(!TY.types.some(t => ['MOD', 'CYB'].includes(t.code) || /^(city|cyberpunk)$/i.test(t.label)), 'no City or Cyberpunk type (Harry 2026-11-07: types are buildings)');
for (const k of KEYS) ok(TY.types.some(t => t.genre === 'modern' && t.rooms?.includes(k)), `${k} is in a modern building`);
ok(KEYS.length === 10, 'ten Cyberpunk rooms');
for (const k of KEYS) { ok(!!S.T[k], `room type ${k} is in rooms.json`); ok((S.T[k]?.tiers || []).join() === 'cyb,mod', `${k} rolls tiers cyb (a wave-2 look) and mod only`); ok(S.T[k]?.recipes.every(r => r.startsWith('cyb-')), `${k}: its recipes are CYB's (the catalog's code; the Build tray files it by modern_buildings.json)`); }
ok(S.w.roleOf('cyb-rooftop') === 'outdoor', 'the rooftop is outdoor');
const BW = await import(new URL('../../../engine/client/barwords.js', import.meta.url));
for (const [cmd, w] of [['build.type.t:OFC', 'cyberpunk'], ['build.type.t:HID', 'shadowrun'], ['build.type.t:APT', 'sprawl'], ['build.cyb-clinic', 'ripperdoc'], ['build.cyb-talisman', 'talismonger'], ['build.cyb-rooftop', 'rooftop'], ['build.mod-bar', 'bar']])
  ok((BW.COMMAND_WORDS[cmd] || []).includes(w), `the bar: "${w}" -> ${cmd}`);
const FIRE = readFileSync(new URL('../js/fx/fire.js', import.meta.url), 'utf8');
for (const id of ['oil-drum-fire', 'light-wall-strip', 'surgical-light', 'billboard-roof', 'video-screen', 'server-rack']) ok(FIRE.includes(id), `fire.js types ${id}`);
const ELEC = [[/^light-fluorescent/, 'tube'], [/^light-wall-strip/, 'tube'], [/^(sign-neon|billboard-roof|crystal-display|antenna-mast)/, 'neon'], [/^(surgical-light|capsule-pod|roof-access-hut|noodle-counter|curio-shelf|lamp-floor)/, 'bulb'],
  [/^oil-drum-fire/, 'brazier'], [/^(video-screen|med-monitor-rig|terminal-desk|server-rack|reception-desk|turnstile-gate|vending-machine|cooling-unit|drone-parked|atm)/, 'screen']];
// ---- rooms
const FAMILY = { 'cyb-clinic': 'concrete', 'cyb-lobby': 'drywall', 'cyb-server': 'concrete', 'cyb-noodle': 'city-brick', 'cyb-capsule': 'drywall', 'cyb-hideout': 'concrete', 'cyb-talisman': 'city-brick', 'cyb-rigger': 'concrete', 'cyb-safehouse': 'drywall' };
const FOCAL = S.s2.KEY_RE || {};
const SIZES = { 'cyb-clinic': [[6, 5], [5, 4], [7, 6], [4, 6]], 'cyb-lobby': [[8, 6], [6, 5], [10, 8], [6, 9]], 'cyb-server': [[6, 6], [5, 4], [8, 6], [4, 7]], 'cyb-noodle': [[5, 4], [4, 4], [7, 5], [4, 6]],
  'cyb-capsule': [[8, 4], [6, 4], [10, 5], [4, 8]], 'cyb-hideout': [[8, 6], [6, 5], [10, 8], [5, 8]], 'cyb-talisman': [[5, 4], [4, 4], [6, 5], [4, 6]], 'cyb-rigger': [[8, 6], [6, 5], [10, 7], [6, 9]],
  'cyb-safehouse': [[6, 5], [5, 4], [7, 6], [4, 6]], 'cyb-rooftop': [[8, 8], [6, 6], [10, 8], [5, 9]] };
const ARR = { alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  street: (k, w, d, s) => [mk('st', 'mod-street', 10, 10 + d, Math.max(w, 6), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)] };
const MOD_DOORS = /^(door-flush|door-steel|door-shopfront|door-roller-shutter)$/;
const stats = {}; let rooms = 0, glassSeen = 0, cageSeen = 0;
const KEYRE = { 'cyb-clinic': /^surgical-chair$/, 'cyb-lobby': /^(reception-desk|turnstile-gate)$/, 'cyb-server': /^server-rack$/, 'cyb-noodle': /^noodle-counter$/, 'cyb-capsule': /^capsule-pod$/, 'cyb-hideout': /^(oil-drum-fire|fence-chain-link)$/,
  'cyb-talisman': /^(display-counter-glass|curio-shelf)$/, 'cyb-rigger': /^(car-sedan|car-hatchback|workbench-garage)$/, 'cyb-safehouse': /^terminal-desk$/, 'cyb-rooftop': /^(roof-access-hut|water-tank-roof)$/ };
const ready = KEYS.filter(k => [...KEYRE[k].source.matchAll(/[a-z][a-z-]+[a-z]/g)].some(m => HAS(m[0]) && (S.lib.objects[m[0]]?.skus || []).some(s => /^cyberpunk-/.test(s.src || '') || m[0].startsWith('car-'))));
if (ready.length < KEYS.length) console.log('NOTE: no wave-2 meshes yet for', KEYS.filter(k => !ready.includes(k)).join(', '), ': those rooms are skipped');
const asObj = (p, i) => ({ id: `o${i}`, kind: 'object', cat: p.id, sku: p.sku, x: p.x, z: p.z, y: p.y || 0, rot: p.rot, dims: p.dims, layer: p.layer, room: 'r' });
for (const k of ready) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 5; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 137 + w * 5 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  const Lc = { ...L, placements: L.placements.filter(p => p.rule !== 'yard-edge').map(p => /^(water-tank-roof|billboard-roof|antenna-mast|roof-access-hut)$/.test(p.id) ? { ...p, dims: [p.dims[0], Math.min(p.dims[1], 9), p.dims[2]] } : p) };
  if (OUT.has(k)) { ok(!L.purposeFail, `${tag} PURPOSE FAIL: ${L.purposeFail}`); const X0 = r.x * 5, Z0 = r.z * 5; for (const p of L.placements) if (p.rule !== 'yard-edge') ok(p.x >= X0 && p.x <= X0 + r.w * 5 && p.z >= Z0 && p.z <= Z0 + r.d * 5, `${tag} ${p.id} outside the roof`); }
  else H.checkRoom(tag, B, r, Lc, { focal: L.purposeFail ? null : KEYRE[k], lights: true, fire: ELEC });
  const st = stats[k] ||= { n: 0, props: 0, fails: 0, things: new Map() };
  st.n++; st.props += L.placements.length; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  for (const p of L.placements) ok(['mod', 'cyb'].includes(SKU.get(p.sku)?.tier) || (SHARED.has(p.id) && PLAIN(SKU.get(p.sku)?.tier) && (!LOOKS(p.id) || LOOKS(p.id).includes(p.sku))), `${tag} ${p.id} (${p.sku}) is not a modern sku (nor a plain one of a role the modern set shares)`);
  for (const p of L.placements) if (SKU.get(p.sku)?.tier === 'cyb') ok(WAVE2(p.sku), `${tag} ${p.sku} is tier cyb but not a wave-2 look`);
  if (FAMILY[k]) ok(r.family === FAMILY[k], `${tag} family ${r.family}`);
  for (const e of [...B.E.edges.values()].filter(e => e.kind === 'door' && e.sides.some(s => s.room === 'r') && FAMILY[k])) ok(MOD_DOORS.test(e.doorType), `${tag} door type ${e.doorType}`);
  const I = L.cybInfo || {};
  if (!L.purposeFail) {
    if (k === 'cyb-clinic') ok(I.chair && (w * d < 24 || I.lamp || I.rig), `${tag} chair ${I.chair} lamp ${I.lamp} rig ${I.rig}`); // (a room under 600 sq ft may have room for the chair alone)
    if (k === 'cyb-lobby') ok(I.desk || I.gates, `${tag} desk ${I.desk} gates ${I.gates}`);
    if (k === 'cyb-server') ok(I.racks >= 2, `${tag} racks ${I.racks}`);
    if (k === 'cyb-noodle') ok(I.counters >= 1 && I.stools >= 2, `${tag} counter ${I.counters} stools ${I.stools}`);
    if (k === 'cyb-capsule') ok(I.pods >= 2, `${tag} pods ${I.pods}`);
    if (k === 'cyb-hideout') ok(I.fire || I.cage, `${tag} fire ${I.fire} cage ${I.cage}`);
    if (k === 'cyb-talisman') ok(I.counter || I.back, `${tag} counter ${I.counter} shelves ${I.back}`);
    if (k === 'cyb-rigger') ok(I.car || I.bench, `${tag} car ${I.car} bench ${I.bench}`);
    if (k === 'cyb-rooftop') ok((I.hut || I.tank) && I.edge > 0, `${tag} hut ${I.hut} tank ${I.tank} parapet ${I.edge}`);
  }
  // SIGHT on real layouts: the lobby's glass front (edge.panel), the hideout's lock-up (laid sections)
  if (k === 'cyb-lobby') {
    const glass = [...B.E.edges.values()].filter(e => e.kind === 'wall' && e.panel === 'wall-glass-curtain' && e.sides.some(s => s.room === 'r'));
    if (glass.length) { glassSeen++;
      const sight = V.blockingSegments(B.E.edges, {}), feet = V.blockingSegments(B.E.edges, {}, 0, { walk: true });
      const covers = (segs, e) => { const x = e.gx * 5, z = e.gz * 5, m = e.dir === 'h' ? [x + 2.5, z] : [x, z + 2.5]; return segs.some(([x0, z0, x1, z1]) => (e.dir === 'h' ? z0 === z && z1 === z && Math.min(x0, x1) <= m[0] && Math.max(x0, x1) >= m[0] : x0 === x && x1 === x && Math.min(z0, z1) <= m[1] && Math.max(z0, z1) >= m[1])); };
      for (const e of glass) { ok(!covers(sight, e), `${tag} glass ${e.key} stops sight`); ok(covers(feet, e), `${tag} glass ${e.key} does not stop feet`); }
      const plain = [...B.E.edges.values()].find(e => e.kind === 'wall' && !e.panel && e.sides.length === 1 && e.sides[0].room === 'r');
      if (plain) ok(covers(sight, plain), `${tag} a plain wall ${plain.key} no longer stops sight`);
    }
  }
  if (k === 'cyb-hideout' && I.cage) { cageSeen++;
    const objs = Object.fromEntries(L.placements.filter(p => /chain-link/.test(p.id)).map((p, i) => [`o${i}`, asObj(p, i)]));
    ok(V.blockingSegments([], objs).length === 0, `${tag} the lock-up stops sight`);
    ok(V.blockingSegments([], objs, 0, { walk: true }).length >= 1, `${tag} the lock-up does not stop feet`);
    ok(L.placements.some(p => p.id === 'gate-chain-link'), `${tag} the lock-up has no gate`);
  }
  if (k === 'cyb-rigger') for (const p of L.placements.filter(p => p.id === 'car-sedan')) ok(WAVE2(p.sku), `${tag} the rigger's sedan is not the near-future look (${p.sku})`);
  if (k === 'cyb-noodle') for (const p of L.placements.filter(p => p.id === 'sign-neon')) ok(SKU.get(p.sku)?.shape === 's2', `${tag} the noodle bar's neon is ${p.sku}`);
  if (k === 'cyb-talisman') for (const p of L.placements.filter(p => p.id === 'sign-neon')) ok(SKU.get(p.sku)?.shape === 's3', `${tag} the shop's neon is ${p.sku}`);
}
if (ready.includes('cyb-lobby')) ok(glassSeen > 0, 'some lobby had a glass front to test');
if (ready.includes('cyb-hideout')) ok(cageSeen > 0, 'some hideout had a lock-up to test');
// ---- looks: exactly the wave-2 looks of roles that had a mesh are tier cyb
for (const [sku, s] of SKU) if (WAVE2(sku) && s.tier === 'cyb') ok(['sign-neon', 'car-sedan'].includes(sku.split('--')[0]), `${sku} is tier cyb but its role had no City mesh`);
ok(SKU.get('sign-neon--noodle-bowl')?.tier === 'cyb' && SKU.get('sign-neon--flask')?.tier === 'cyb' && SKU.get('car-sedan--near-future')?.tier === 'cyb' && SKU.get('vending-machine')?.tier === 'mod', 'the wave-2 looks of shared roles are tier cyb, new roles tier mod');
// ---- leak: no fantasy or City room places a wave-2 sku
let other = 0;
for (const t of S.types.filter(t => !t.key.startsWith('cyb-') && !(t.recipes?.[0] || '').startsWith('cyb-') && !(S.w.MH_ROOMS || []).includes(t.key) && !t.byHand && t.key !== 'hill')) /* (the modhalls corridors, 2026-11-07, are the whole Modern genre's: they reuse its strip lights, lockers and tool chests on purpose; mh.test.mjs checks them) */ /* (a Cyberpunk room is told by its first recipe: the exec penthouse's key is mod-, 2026-11-07) */ for (let seed = 1; seed <= (t.key.startsWith('mod-') ? 6 : 2); seed++) {
  const B = H.build([mk('r', t.key, 10, 10, t.cells[0], t.cells[1], seed * 59, 1)]), L = B.solve('r'); other++;
  ok(!L.placements.some(p => WAVE2(p.sku)), `${t.key} seed ${seed} places a wave-2 sku: ${L.placements.filter(p => WAVE2(p.sku)).map(p => p.sku)}`);
}
if (PRINT) for (const [k, st] of Object.entries(stats)) console.log(k.padEnd(16), `${st.n} rooms, ${(st.props / st.n).toFixed(1)} placements, ${st.fails} fails;`, [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([i, n]) => `${i} ${n}`).join(', '));
console.log(`cyb: ${rooms} Cyberpunk rooms (${ready.length} of ${KEYS.length} types with meshes), ${other} other rooms solved for the leak check`);
H.report('cyb');
