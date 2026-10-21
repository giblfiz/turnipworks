// Castle (2026-10-05): nine room types. castle-rough walls (arrow slits) for the working rooms, dressed-stone for hall,
// throne room and chapel.     node tests/castle.test.mjs [tuner dir] [--print]     default tree: ../sandbox/castle
// (python3 make_sandbox.py castle --scope once,crypt,castle). At integration: copy to tools/spawn-tuner/test/ with ccm_lib.mjs.
//   rooms     eight indoor types x 6 sizes x 8 seeds x 3 arrangements: the shared checks (ccm_lib.mjs) + the room's own
//             (what stands on the dais stands wholly on it; cells are closed; the gate-to-gate line is clear ...)
//   kitchen   the castle kitchen is the inn's kitchen program, wrapped: one great hearth where 12 ft of wall is clear
//   courtyard an outdoor room with its own program: curtain wall on every open edge, gate, focal, clear ways, no inn things
//   walls     castle-rough registered, borrows fieldstone; doors: the castle leaf, double doors, the portcullis
//   a castle  the nine rooms side by side: every room reachable
//   annex     the leg of an L-shaped room: dressed, lit, no second key piece
import { readFileSync } from 'node:fs';
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
const S = await loadTree('castle'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
// The fake meshes take their size from assets.json, so the sizes in manifest_overrides.castle.json (the dais box turned,
// banner poles and round pillars capped under the wall) are applied HERE, to this test's own copy of the library, the way
// build_data.py will read them from the manifest's `size` column. --raw runs the spec sizes instead.
const RAW = process.argv.includes('--raw'), OVER = (() => { try { return JSON.parse(readFileSync(new URL('../manifest_overrides.castle.json', import.meta.url))).size; } catch { return {}; } })(); // (a sandbox has the draft file; the real tree's manifest carries the sizes)
const LIB = structuredClone(S.lib); if (!RAW) for (const o of Object.values(LIB.objects)) for (const k of o.skus) if (OVER[k.sku]) k.size = OVER[k.sku];
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7); // --only=barracks: one room type (the rest of the file still runs)
const KEYS = ['great-hall', 'throne-room', 'armoury', 'barracks', 'castle-kitchen', 'chapel', 'dungeon', 'gatehouse'].filter(k => !ONLY || k === ONLY);
for (const k of [...KEYS, 'courtyard']) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const FOCAL = { 'great-hall': /^(table-feast|table-trestle)$/, 'throne-room': /^throne$/, 'armoury': /^(weapon-rack|armor-stand)$/, 'barracks': /^(bunk-bed|cot)$/, 'castle-kitchen': /^cook-hearth/,
  'chapel': /^altar-stone$/, 'dungeon': /^(rack-torture|iron-maiden|cell-bars)/, 'gatehouse': null };
const FIRE = [[/flame-bowl/, 'brazier'], [/sand-tray/, 'stubs'], [/cresset/, 'torch'], [/signal-beacon|boiling-oil|fire-basket|cauldron-crane|pig-on-spit/, 'brazier']]; // the fireType() lines crypt + castle add
const SIZES = { 'great-hall': [[10, 6], [6, 10], [8, 5], [4, 4], [6, 4], [3, 6]], 'throne-room': [[5, 8], [8, 5], [4, 4], [3, 5], [6, 10], [5, 5]], 'armoury': [[4, 4], [3, 3], [5, 3], [6, 5], [4, 7], [8, 6]],
  'barracks': [[7, 5], [6, 4], [4, 3], [3, 5], [5, 7], [10, 6]], 'castle-kitchen': [[6, 5], [5, 4], [4, 4], [8, 6], [6, 8], [10, 8]], 'chapel': [[4, 7], [3, 5], [5, 5], [7, 4], [6, 10], [4, 4]],
  'dungeon': [[6, 5], [3, 3], [4, 4], [5, 8], [8, 6], [10, 6]], 'gatehouse': [[4, 4], [3, 3], [4, 2], [3, 5], [6, 4], [6, 6]] };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: (k, w, d, s) => [mk('h', k === 'great-hall' ? 'gatehouse' : 'great-hall', 10, 5, Math.max(w, 6), 5, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', k === 'gatehouse' ? 'armoury' : 'gatehouse', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', k === 'barracks' ? 'armoury' : 'barracks', 10, 10 + d, Math.max(w, 3), 4, s + 2, 3), mk('y', 'courtyard', 10 + w, 10, 6, d, s + 3, 4)],
};
const stats = {}; let rooms = 0, tallPoles = 0, poles = 0, loops = 0; // loops: attempt()'s own hub loop (run after the hall is furnished) that found no way round: counted, not failed
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 89 + w * 5 + d), { lib: LIB }), r = B.rooms.find(x => x.id === 'r'), L0 = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  // (--raw only: at its spec size a banner-pole is 110 in, 2 in over the wall; counted, then clamped so the ceiling check judges the rest)
  for (const p of L0.placements) if (p.id === 'banner-pole') { poles++; if (p.y + p.dims[1] > 9.01) tallPoles++; }
  if (L0.paths.some(p => p.kind === 'loop' && !p.ok)) loops++;
  const solve0 = B.solve, clamp = (L) => ({ ...L, paths: L.paths.filter(p => p.kind !== 'loop' || p.ok), placements: RAW ? L.placements.map(p => p.id === 'banner-pole' ? { ...p, dims: [p.dims[0], Math.min(p.dims[1], 9 - p.y), p.dims[2]] } : p) : L.placements });
  B.solve = (id, o) => clamp(solve0(id, o)); const L = clamp(L0);
  const kitchen = k === 'castle-kitchen';
  // (the inn's kitchen program reports its own misses and may leave a blocked service line in odd sizes, as the inn's does: purpose, bounds and overlaps are held, paths are counted)
  const res = kitchen ? (() => { ok(!L.purposeFail || w * d < 20, `${tag} PURPOSE FAIL: ${L.purposeFail}`); const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id}/${fl[j].id}`); } if (!L.purposeFail) ok(L.placements.some(p => FOCAL[k].test(p.id)), `${tag} no cooking hearth`); return { props: L.placements.filter(p => p.orient !== 'floor').length, density: L.checks.density.value, target: L.checks.density.target, score: L.score }; })()
    : H.checkRoom(tag, B, r, L, { focal: FOCAL[k], lights: true, fire: FIRE });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], fails: 0, things: new Map(), extra: {} };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target); if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  const bump = (name, v = 1) => st.extra[name] = (st.extra[name] || 0) + v;
  const X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5;
  // what stands on a dais stands wholly on it, and nothing on it overlaps anything else on it
  const byUid = new Map(L.placements.map(p => [p.uid, p])), up = L.placements.filter(p => p.on);
  for (const p of up) { const b = byUid.get(p.on), [aw, ad] = aabb(p), [bw, bd] = aabb(b); ok(Math.abs(p.x - b.x) + aw / 2 <= bw / 2 + 0.2 && Math.abs(p.z - b.z) + ad / 2 <= bd / 2 + 0.2 && Math.abs(p.y - b.dims[1]) < 0.02, `${tag} ${p.id} is not wholly on the ${b.id}`); }
  for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) { const [aw, ad] = aabb(up[i]), [bw, bd] = aabb(up[j]); ok(!(Math.abs(up[i].x - up[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(up[i].z - up[j].z) < (ad + bd) / 2 - 0.17), `${tag} ${up[i].id} / ${up[j].id} overlap on the dais`); }
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  ok(r.family === S.T[k].family, `${tag} family ${r.family}`);
  // doors: the castle's leaf on its single doors, the double door / portcullis on a 10-ft outside opening
  for (const e of mine.filter(e => e.kind === 'door' && e.owner.room === r.id)) {
    const wide = (e.span || 1) > 1 && e.sides.length === 1;
    ok(wide ? (k === 'gatehouse' ? (e.flag === 'way-on' ? e.doorType === 'gate-double-timber' : e.doorType === 'portcullis') : e.doorType === 'door-double-grand') : /^(door-reinforced|door-crypt|crypt-gate-iron)$/.test(e.doorType), `${tag} door type ${e.doorType} (span ${e.span || 1}, ${e.sides.length} sides)`);
    if (e.doorType === 'door-reinforced') ok(e.doorLeaf === 'castle-leaf', `${tag} a castle door without the castle leaf`);
  }
  for (const e of mine.filter(e => e.panel && e.owner.room === r.id)) ok(e.panel === 'window-stained-glass' && e.kind === 'wall' && e.sides.length === 1 && (k === 'throne-room' || k === 'chapel'), `${tag} panel ${e.panel} on a ${e.kind} edge of a ${k}`);
  // type-specific
  if (k === 'great-hall') { const dais = L.placements.find(p => p.id === 'dais'), t = L.placements.find(p => p.rule === 'key-high-table'); bump('dais', dais ? 1 : 0); bump('trestles', L.placements.filter(p => p.rule === 'trestle-row').length); bump('hearth', L.placements.some(p => /^fireplace/.test(p.id)) ? 1 : 0); bump('lord\'s seats', L.placements.filter(p => p.rule === 'high-seat').length);
    if (dais && dais.sku === 'dais') { const [aw, ad] = aabb(dais), alongX = Math.min(dais.z - Z0, Z1 - dais.z) < Math.min(dais.x - X0, X1 - dais.x); ok(alongX ? aw > ad : ad > aw, `${tag} the dais stands with its short side to the wall`); }
    if (Math.min(w, d) >= 5 && arr === 'alone') ok(!!dais && t?.on === dais.uid, `${tag} a hall ${Math.min(w, d)} cells across with no high table on a dais`); // (smaller, or with a door in every end wall: the table stands on the floor; the rate is printed)
    if (t) for (const c of L.placements.filter(p => p.rule === 'high-seat')) ok(Math.hypot(c.x - t.x, c.z - t.z) < t.dims[0] / 2 + 2, `${tag} a lord's chair away from the high table`);
    if (w * d >= 40) ok(L.placements.some(p => /^fireplace/.test(p.id)), `${tag} a ${w * d}-cell hall with no hearth`); }
  if (k === 'throne-room') { const th = L.placements.find(p => p.id === 'throne'); bump('on a dais', th?.on ? 1 : 0); bump('runner', L.placements.filter(p => p.id === 'rug-runner').length); bump('avenue', L.placements.filter(p => p.rule === 'avenue').length);
    // nothing but the runner on the walk from the door to the dais foot
    const th2 = L.paths.find(p => p.kind === 'aisle'); if (th2) for (const p of standing(L)) { if (p.id === 'dais') continue; const [aw, ad] = aabb(p); for (let i = 0; i + 1 < th2.pts.length; i++) { const a = th2.pts[i], b = th2.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, u = Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.z - a[1]) * vz) / L2)); ok(Math.hypot(p.x - a[0] - u * vx, p.z - a[1] - u * vz) > Math.min(aw, ad) / 2 + 0.7, `${tag} ${p.id} stands on the processional line`); } } }
  if (k === 'armoury') { bump('racks', L.placements.filter(p => p.id === 'weapon-rack').length); bump('stands', L.placements.filter(p => p.id === 'armor-stand').length); if (w * d >= 16) ok(L.placements.filter(p => p.id === 'weapon-rack').length >= (w * d >= 20 ? 3 : 2), `${tag} a ${w * d}-cell armoury with under 3 racks`); }
  if (k === 'barracks') { const n = L.placements.filter(p => p.rule === 'bunk').length; bump('bunks', n); bump('lockers', L.placements.filter(p => p.id === 'mil-footlocker').length); bump('guard table', L.placements.some(p => p.rule === 'guard-table') ? 1 : 0); if (w * d >= 20) ok(n >= 3, `${tag} a ${w * d}-cell barracks with ${n} bunks`); }
  // (a cell = a barred front; its door is door-cell-bars, or the crypt's iron gate while that mesh is missing, or an open gap)
  if (k === 'dungeon') { const bars = L.placements.filter(p => p.rule === 'cell' && /^(cell-bars|door-cell-bars|crypt-gate-iron)/.test(p.id)), nc = L.dungeonInfo?.cells ?? bars.filter(p => p.id === 'cell-bars').length; bump('cells', nc); bump('rack', L.placements.some(p => p.id === 'rack-torture') ? 1 : 0); bump('maiden', L.placements.some(p => /^iron-maiden/.test(p.id)) ? 1 : 0);
    if (arr === 'alone' && w * d >= 30 && Math.min(w, d) >= 5) ok(nc >= 2, `${tag} a ${w}x${d} dungeon with ${nc} cells`);
    ok(bars.filter(p => p.id !== 'cell-bars').length <= nc, `${tag} more cell doors than cells`);
    for (const p of bars) ok(!!p.s && p.kind === 'mesh', `${tag} a cell piece without a kit scale`); }
  if (k === 'gatehouse') { bump('windlass', L.placements.some(p => p.id === 'windlass') ? 1 : 0); const th = L.paths.find(p => p.kind === 'through'); ok(!!th && th.ok, `${tag} no clear gate-to-gate line`);
    if (th) for (const p of standing(L)) { const [aw, ad] = aabb(p); for (let i = 0; i + 1 < th.pts.length; i++) { const a = th.pts[i], b = th.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, u = Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.z - a[1]) * vz) / L2)); ok(Math.hypot(p.x - a[0] - u * vx, p.z - a[1] - u * vz) > Math.min(aw, ad) / 2 + 1.2, `${tag} ${p.id} stands in the passage`); } } }
  if (k === 'chapel') { bump('seats', L.placements.filter(p => p.rule === 'pew').length); bump('dais', L.placements.some(p => p.id === 'dais') ? 1 : 0); if (w * d >= 24 && Math.min(w, d) >= 4) ok(L.placements.filter(p => p.rule === 'pew').length >= (w * d >= 28 ? 2 : 1), `${tag} a ${w * d}-cell chapel with under ${w * d >= 28 ? 2 : 1} seats`); /* (a 25-ft-square chapel has one row; the real pews are 4.1 ft tall, and an off-centre double door's view of the altar keeps one block clear) */ ok(!L.placements.some(p => /funeral/.test(p.id)), `${tag} a bier in the castle chapel`); }
  if (kitchen) { bump('great hearths', L.placements.filter(p => p.sku === 'cook-hearth-spit--great').length); bump('hearths', L.placements.filter(p => p.id === 'cook-hearth-spit').length); bump('blocked paths', L.paths.filter(p => !p.ok).length); bump('unplaced', L.unplaced.length); }
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} castle rooms solved (8 indoor types x 6 sizes x 3 arrangements x 8 seeds)`);
for (const [k, st] of Object.entries(stats)) console.log(`  ${k.padEnd(15)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target (min ${Math.min(...st.dens).toFixed(2)}); per room: ${Object.entries(st.extra).map(([n, v]) => `${n} ${(v / st.n).toFixed(1)}`).join(', ')}`);
console.log(`hub loops blocked (great hall, attempt()'s own walk): ${loops}`);
console.log(`banner poles: ${poles} placed, ${tallPoles} taller than the 9-ft wall (${RAW ? 'spec sizes: 110 in' : 'with manifest_overrides.castle.json: 104 in'})`);
if (!RAW) ok(tallPoles === 0, `${tallPoles} banner poles over the wall with the size override`);

// ---- courtyard: an outdoor room with its own program (castleCourtyard). Curtain wall on every open edge, a gate, one
// focal thing in the open, clear ways from every door to the gate, bare of the inn yard's things
{ ok(S.w.isOutdoor('courtyard'), 'the courtyard is an outdoor room');
  const INN_ONLY = /^(sign-|picnic|dog-kennel|washing|bush|tree-|flowerbed|hedge|fence|planter|outhouse|woodshed|trellis|vegetable|herb-bed|compost|decal-path)/;
  const CARR = {
    alone: (w, d, s) => [mk('y', 'courtyard', 10, 10, w, d, s, 1)],
    hall: (w, d, s) => [mk('h', 'great-hall', 10, 4, 10, 6, s + 1, 1), mk('y', 'courtyard', 10, 10, w, d, s, 2)],
    castle: (w, d, s) => [mk('h', 'great-hall', 10, 4, 10, 6, s + 1, 1), mk('k', 'castle-kitchen', 10 - 6, 10, 6, 5, s + 2, 2), mk('y', 'courtyard', 10, 10, w, d, s, 3), mk('g', 'gatehouse', 10 + w, 10, 4, 4, s + 3, 4)],
    closed: (w, d, s) => [mk('y', 'courtyard', 10, 10, w, d, s, 1), mk('h', 'great-hall', 10, 4, w, 6, s + 1, 2), mk('b', 'barracks', 10, 10 + d, w, 5, s + 2, 3), mk('k', 'castle-kitchen', 10 - 6, 10, 6, d, s + 3, 4), mk('a', 'armoury', 10 + w, 10, 4, d, s + 4, 5)],
  };
  const st = { n: 0, props: 0, focal: 0, focalWanted: 0, edge: 0, turrets: 0, gates: new Map(), training: 0, dens: [], things: new Map() };
  for (const [w, d] of [[8, 7], [3, 3], [4, 4], [6, 5], [10, 8], [12, 6]]) for (const arr of Object.keys(CARR)) for (let seed = 1; seed <= 8; seed++) {
    const B = H.build(CARR[arr](w, d, seed * 71 + w), { lib: LIB }), y = B.rooms.find(r => r.id === 'y'), L = B.solve('y'), tag = `courtyard ${w}x${d} ${arr} seed ${y.seed}`; st.n++;
    const X0 = y.x * CELL + 0.5, Z0 = y.z * CELL + 0.5, X1 = (y.x + y.w) * CELL - 0.5, Z1 = (y.z + y.d) * CELL - 0.5, W = X1 - X0, D = Z1 - Z0, A = W * D;
    ok(L.role === 'outdoor' && !L.purposeFail && L.yard?.vibe === 'castle courtyard', `${tag} role / purpose / program: ${L.role} ${L.purposeFail} ${L.yard?.vibe}`);
    ok(typeof S.s2.summarize2(L) === 'string', `${tag} summary`);
    ok(![...B.E.edges.values()].some(e => e.sides.some(s => s.room === 'y')), `${tag} a wall of its own`);
    const isEdge = (p) => p.rule === 'yard-edge', inner = L.placements.filter(p => !isEdge(p)), edge = L.placements.filter(isEdge);
    for (const p of inner) { const [aw, ad] = aabb(p); ok(p.x - aw / 2 >= X0 - 0.17 && p.x + aw / 2 <= X1 + 0.17 && p.z - ad / 2 >= Z0 - 0.17 && p.z + ad / 2 <= Z1 + 0.17, `${tag} ${p.id} (${p.rule}) outside the courtyard`); ok(!INN_ONLY.test(p.id), `${tag} an inn-yard thing in the bailey: ${p.id}`); }
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { if (isEdge(fl[i]) && isEdge(fl[j])) continue; const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id} (${fl[i].rule}) / ${fl[j].id} (${fl[j].rule})`); }
    ok(L.paths.every(p => p.ok), `${tag} blocked path: ${L.paths.filter(p => !p.ok).map(p => p.kind)}`);
    // the edge: something of the curtain wall on EVERY open segment (a section, or the gate piece across it; a one-segment gate may be a gap between turrets)
    const openSegs = B.E.open.get('y'), ops = B.E.openings.get('y'), gate = ops.find(o => o.kind === 'gate');
    ok(!!gate === openSegs.length > 0, `${tag} gate ${!!gate} with ${openSegs.length} open segments`);
    const gx0 = y.x * CELL, gz0 = y.z * CELL, mid = (s) => s.side === 'N' ? [gx0 + s.index * 5 + 2.5, gz0] : s.side === 'S' ? [gx0 + s.index * 5 + 2.5, gz0 + y.d * 5] : s.side === 'W' ? [gx0, gz0 + s.index * 5 + 2.5] : [gx0 + y.w * 5, gz0 + s.index * 5 + 2.5];
    const gp = edge.find(p => /^(portcullis|gate-double-timber)$/.test(p.id));
    for (const s of openSegs) { const [mx, mz] = mid(s), sec = edge.some(p => /^(city-wall|wall-crenellated)$/.test(p.id) && Math.hypot(p.x - mx, p.z - mz) < 0.1), g = gp && Math.hypot(gp.x - mx, gp.z - mz) < 2.6, gap = !gp && gate && s.side === gate.side && s.index === gate.index;
      ok(sec || g || gap, `${tag} open segment ${s.side}${s.index} has no curtain wall`); ok(!(sec && g), `${tag} wall section and gate on one segment`); }
    for (const p of edge) ok(/^(city-wall|city-wall-turret|portcullis|gate-double-timber|wall-crenellated|wall-crenellated-corner)$/.test(p.id) && !!p.s, `${tag} edge piece ${p.id}`);
    // turrets only on open ground: never at a vertex a building wall touches
    for (const p of edge.filter(p => /turret|corner/.test(p.id))) ok(![...B.E.edges.values()].some(e => { const ends = e.dir === 'h' ? [[e.gx, e.gz], [e.gx + 1, e.gz]] : [[e.gx, e.gz], [e.gx, e.gz + 1]]; return ends.some(([vx, vz]) => Math.hypot(vx * 5 - p.x, vz * 5 - p.z) < 0.1); }), `${tag} a turret where the wall meets a building`);
    if (openSegs.length >= 4 && arr === 'alone') ok(edge.filter(p => /turret/.test(p.id)).length >= 4, `${tag} a free-standing bailey with under 4 turrets`);
    const focal = L.placements.filter(p => p.rule === 'yard-focal'), allows = Math.min(W, D) >= S.s2.YARD.focalMin && A >= S.s2.YARD.focalArea;
    if (allows) { st.focalWanted++; st.focal += focal.length; } ok(focal.length === (allows ? 1 : 0), `${tag} ${focal.length} focal things (size ${allows ? 'allows' : 'too small'})`);
    for (const f of focal) ok(/^(well|horse-trough-stone)$/.test(f.id) && Math.min(f.x - X0, X1 - f.x, f.z - Z0, Z1 - f.z) >= 3, `${tag} focal ${f.id} is not in the open`);
    const dv = L.checks.density; ok(dv.target === S.s2.yardTarget(A), `${tag} target ${dv.target}`); if (A >= 300) ok(dv.value <= 1.6 * dv.target, `${tag} density ${dv.value} over 1.6x the target ${dv.target}`);
    if (arr !== 'alone') ok([...B.E.edges.values()].some(e => e.kind === 'door' && e.yard?.room === 'y'), `${tag} no neighbour's door opens onto it`);
    const again = B.solve('y'); ok(JSON.stringify(again.placements.map(p => [p.id, p.x, p.z])) === JSON.stringify(L.placements.map(p => [p.id, p.x, p.z])), `${tag} not deterministic`);
    st.props += inner.filter(p => p.orient !== 'floor').length; st.edge += edge.length; st.turrets += edge.filter(p => /turret/.test(p.id)).length; st.training += L.yard.training ? 1 : 0; st.dens.push(dv.value / dv.target); st.gates.set(gp ? gp.id : gate ? 'gap' : 'closed court', (st.gates.get(gp ? gp.id : gate ? 'gap' : 'closed court') || 0) + 1);
    for (const p of inner) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
    if (PRINT && seed === 1) console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
  }
  console.log(`courtyard: ${st.n} solved (6 sizes x 4 arrangements x 8 seeds); ${(st.props / st.n).toFixed(1)} things, ${(st.edge / st.n).toFixed(1)} edge pieces (${(st.turrets / st.n).toFixed(1)} turrets), focal in ${st.focal} of ${st.focalWanted} that allow one, training corner in ${st.training}; gate: ${[...st.gates].map(([g, c]) => `${g} ${c}`).join(', ')}; density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target`);
  console.log(`  it lays: ${[...st.things].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([i, c]) => `${i} ${c}`).join(', ')}`);
}

// ---- walls and doors
ok(S.w.WALL_FAMILIES.includes('castle-rough') && S.w.FAMILY_FALLBACK['castle-rough'] === 'fieldstone' && S.w.meshFamily('castle-rough') === 'fieldstone', 'castle-rough is registered and borrows fieldstone');
for (const piece of ['wall-straight', 'wall-window-small', 'wall-doorway', 'portcullis', 'city-wall']) ok(S.lib.objects[piece]?.skus.some(s => s.family === 'castle-rough' && s.bounds), `the library has a castle-rough ${piece}`);
ok(S.lib.objects['window-stained-glass']?.skus.some(s => s.family === 'dressed-stone'), 'the stained-glass panel is a dressed-stone piece');
{ const leaves = S.lib.objects['door-reinforced'].skus.filter(s => s.piece === 'leaf').map(s => s.shape); console.log(`door-reinforced leaves in the library: ${leaves.join(', ') || 'none'}${leaves.includes('leaf') ? '  <-- shape "leaf": look.js will hang it in the INN\'s reinforced doorways too (castle_notes.md, needs in shared files #1)' : ''}`); }

// ---- a whole castle, side by side: every room reachable
{ let outside = 0, forced = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rs = [mk('g', 'gatehouse', 10, 10, 4, 4, seed, 1), mk('y', 'courtyard', 14, 10, 8, 7, seed + 1, 2), mk('h', 'great-hall', 14, 5, 8, 5, seed + 2, 3), mk('t', 'throne-room', 22, 2, 5, 8, seed + 3, 4), mk('k', 'castle-kitchen', 8, 5, 6, 5, seed + 4, 5),
      mk('c', 'chapel', 22, 10, 4, 7, seed + 5, 6), mk('b', 'barracks', 14, 17, 6, 4, seed + 6, 7), mk('a', 'armoury', 10, 14, 4, 4, seed + 7, 8), mk('d', 'dungeon', 20, 17, 6, 5, seed + 8, 9)];
    const B = H.build(rs, { lib: LIB }); n++;
    const doors = [...B.E.edges.values()].filter(e => e.kind === 'door'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of doors) { if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); } }
    const src = doors.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(rs.filter(r => r.id !== 'y').every(r => seen.has(r.id)), `a castle (seed ${seed}): ${rs.filter(r => r.id !== 'y' && !seen.has(r.id)).map(r => r.type)} cannot be reached`);
    outside += doors.filter(e => e.sides.length === 1 && !e.yard).length; forced += doors.filter(e => e.flag).length;
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail, `castle seed ${seed}: ${r.type} ${L.purposeFail}`); }
  }
  console.log(`a whole castle (9 rooms round a courtyard, ${n} seeds): every room reachable; ${(outside / n).toFixed(1)} doors to outside per castle, ${(forced / n).toFixed(1)} added for reachability`);
}

// ---- the leg of an L-shaped room (args.annex: no key program runs there): dressed, lit, and NO second key piece
if (/args\.annex/.test(readFileSync(S.dir + 'js/solver2.js', 'utf8'))) {
  let n = 0, props = 0;
  for (const k of KEYS.filter(k => k !== 'castle-kitchen')) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 6; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door');
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    const KEYP = /^(dais|throne|table-feast|fireplace|altar-stone|bunk-bed|rack-torture|iron-maiden|windlass|cell-bars|door-|wall-|portcullis|window-)/;
    ok(!L.placements.some(p => KEYP.test(p.id)), `${tag} a key piece or kit piece in the annex: ${L.placements.map(p => p.id).filter(i => KEYP.test(i))}`);
    ok(L.placements.some(p => fireType(p.id, FIRE)), `${tag} annex unlit`);
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id}/${fl[j].id}`); }
  }
  console.log(`annex (the leg of a shaped room, no key program): ${n} legs, ${(props / n).toFixed(1)} things each, no key piece repeated`);
} else console.log('annex: this tree\'s solver2.js has no args.annex (shaped rooms not merged yet): skipped');
H.report('castle');
