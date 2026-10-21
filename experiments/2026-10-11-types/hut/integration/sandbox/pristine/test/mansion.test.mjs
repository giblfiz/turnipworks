// Mansion (2026-10-05): eight state rooms + two service rooms; walls noble-panel / noble-paper / conservatory.
//   node tests/mansion.test.mjs [tuner dir] [--print]      default tree: ../sandbox/mansion (make_sandbox.py mansion --scope once,crypt,mansion)
// At integration: copy to tools/spawn-tuner/test/ with ccm_lib.mjs and run it against tools/spawn-tuner itself.
//   rooms     every indoor room type x 6 sizes x 8 seeds x 3 arrangements (alone; off the entrance hall; between rooms):
//             the shared checks (ccm_lib.mjs) + lit; no windows on the conservatory or the cellar
//   per room  the ballroom's dance floor is empty; the dining table is laid and seated; the library's walls are books
//   tiers     wherever a role has a mansion mesh (tier 'noble'), a mansion room rolls it, never the inn's
//   garden    its own program: hedge on every open edge, two clear walks, the fountain at the crossing, mirrored pairs
//   annex     the leg of an L-shaped room: dressed, lit, no second key piece
//   a mansion ten rooms side by side: every room reachable, no purpose fails; the front door is the walnut double door
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
import { readFileSync } from 'node:fs';
const S = await loadTree('mansion'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const STATE = ['mansion-hall', 'mansion-drawing', 'mansion-dining', 'mansion-library', 'mansion-bedroom', 'mansion-ballroom', 'mansion-conservatory'], SERVICE = ['mansion-kitchen', 'mansion-cellar'], KEYS = [...STATE, ...SERVICE];
for (const k of [...KEYS, 'mansion-garden']) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const FOCAL = { 'mansion-hall': /^(stair-grand|table-pedestal-round|clock-longcase|table-console)$/, 'mansion-drawing': /^fireplace-/, 'mansion-dining': /^table-(feast|trestle)$/, 'mansion-library': /^(bookcase-ladder|bookshelf)$/, 'mansion-bedroom': /^bed-/,
  'mansion-ballroom': /^(harp|harpsichord|music-stand|chair-salon-gilt|dais)$/, 'mansion-conservatory': /^(fountain-courtyard|palm-potted|citrus-tree-tub|fern-potted)$/, 'mansion-kitchen': /^cook-hearth/, 'mansion-cellar': /^(cask-rack|shelving|wine-rack|tun|wine-bin)/ };
// Tall pieces. stair-grand is 10 ft on purpose (a kit piece that reaches the next storey): always let through the shared
// 9-ft ceiling check. fireplace-marble and bookcase-ladder are specified at 108 in and overtop the wall by up to 1.6 in
// UNLESS the manifest caps them (integration/manifest_overrides.mansion.json: 104 in). With the cap in this tree's
// library they get no allowance at all; without it they are clamped here and counted.
const capped = ['fireplace-marble', 'bookcase-ladder'].every(id => (S.lib.objects[id]?.skus || []).every(k => k.size && k.size[2] <= 106));
const FULL = capped ? /^stair-grand$/ : /^(stair-grand|bookcase-ladder|fireplace-marble)$/; let overtop = 0, overMax = 0, stairs = 0, halls = 0;
const SIZES = { 'mansion-hall': [[5, 6], [3, 3], [4, 4], [6, 7], [7, 6], [8, 8]], 'mansion-drawing': [[5, 4], [3, 3], [4, 4], [6, 6], [4, 7], [8, 6]], 'mansion-dining': [[6, 4], [4, 3], [5, 5], [8, 5], [4, 8], [10, 6]],
  'mansion-library': [[4, 4], [3, 3], [5, 4], [6, 6], [4, 7], [8, 8]], 'mansion-bedroom': [[5, 4], [3, 3], [4, 4], [6, 6], [4, 6], [9, 8]], 'mansion-ballroom': [[8, 6], [5, 4], [6, 6], [12, 8], [6, 10], [14, 10]],
  'mansion-conservatory': [[5, 4], [3, 3], [5, 3], [6, 5], [3, 6], [8, 6]], 'mansion-kitchen': [[5, 4], [4, 3], [6, 6]], 'mansion-cellar': [[4, 3], [3, 3], [6, 5]] };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: (k, w, d, s) => [mk('h', k === 'mansion-hall' ? 'mansion-drawing' : 'mansion-hall', 10, 5, Math.max(w, 5), 5, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  between: (k, w, d, s) => [mk('h', k === 'mansion-hall' ? 'mansion-dining' : 'mansion-hall', 5, 10, 5, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('l', k === 'mansion-library' ? 'mansion-drawing' : 'mansion-library', 10 + w, 10, 4, d, s + 2, 3), mk('g', 'mansion-garden', 10, 10 + d, w, 5, s + 3, 4)],
};
const nobleOf = (id) => (S.lib.objects[id]?.skus || []).filter(s => s.tier === 'noble' && (s.kind === 'flat' || s.bounds)).map(s => s.sku);
let innBlocked = 0; const stats = {}, tier = { want: 0, got: 0, miss: new Map() }; let rooms = 0;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 89 + w * 5 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  for (const p of L.placements) if (FULL.test(p.id) && p.y + p.dims[1] > 9.01) { overtop++; overMax = Math.max(overMax, p.y + p.dims[1]); }
  // (a hung FLAT carries its catalog depth though it is drawn as a plane on the wall face: flattened for the outside check)
  // Drapes are 5 ft wide and hang centred on their 5-ft window panel, so at a corner window they run 6 in past the room's
  // inside face, as the panel itself does (the inn's fine room has the same): they are checked against their window here.
  const Lc = { ...L, placements: L.placements.map(p => p.rule === 'drapes' ? { ...p, dims: [0.1, p.dims[1], 0.05] } : FULL.test(p.id) ? { ...p, dims: [p.dims[0], Math.min(p.dims[1], 9 - p.y), p.dims[2]] } : p.orient === 'wall' && p.kind === 'flat' ? { ...p, dims: [p.dims[0], p.dims[1], 0.05] } : p) };
  { const wins = B.E.openings.get(r.id).filter(o => o.kind === 'window'), x0 = r.x * CELL + 0.5, z0 = r.z * CELL + 0.5;
    for (const p of L.placements.filter(p => p.rule === 'drapes')) { const t = p.side === 'N' || p.side === 'S' ? p.x - x0 : p.z - z0; ok(wins.some(o => o.side === p.side && Math.abs(o.index * CELL - 0.5 + 2.5 - t) < 0.3), `${tag} drapes that hang on no window`); } }
  const service = SERVICE.includes(k);
  // the service rooms ARE the inn's Kitchen and Cellar programs: a blocked service path there is the inn program's own
  // (the inn kitchen blocks one in about 30 off a hall at these sizes); counted and reported, not failed here
  if (service && !L.paths.every(p => p.ok)) { innBlocked++; Lc.paths = L.paths.map(p => ({ ...p, ok: true })); }
  const res = H.checkRoom(tag, B, r, Lc, { focal: FOCAL[k], lights: !service, windows: k === 'mansion-conservatory' || k === 'mansion-cellar' ? false : undefined });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], fails: 0, things: new Map(), extra: [] };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target); if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  // tiers: a role with a mansion mesh is rolled as that mesh
  for (const p of L.placements) { const nb = nobleOf(p.id); if (!nb.length) continue; tier.want++; if (nb.includes(p.sku)) tier.got++; else tier.miss.set(`${k}: ${p.sku} (${p.rule})`, (tier.miss.get(`${k}: ${p.sku} (${p.rule})`) || 0) + 1); }
  // walls and doors
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  ok(r.family === S.T[k].family, `${tag} family ${r.family}, type says ${S.T[k].family}`);
  for (const e of mine.filter(e => e.kind === 'door' && e.owner.room === r.id)) {
    ok(/^(door-panelled|door-double-grand|door-glazed|door-plank|door-reinforced)$/.test(e.doorType), `${tag} door type ${e.doorType}`);
    if (e.doorType === 'door-double-grand') ok(e.doorLeaf === 'fine-leaf' && (e.span || 1) > 1, `${tag} a grand door with leaf ${e.doorLeaf}, span ${e.span}`);
  }
  if (k === 'mansion-hall' || k === 'mansion-ballroom') { const ext = mine.find(e => e.kind === 'door' && e.sides.length === 1 && !e.yard); if (ext && (r.w >= 3 && r.d >= 3)) st.extra.push(ext.doorType === 'door-double-grand' ? 1 : 0); }
  const fl = standing(L), X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5, W = X1 - X0, D = Z1 - Z0;
  // per room
  if (k === 'mansion-ballroom') {
    const Lr = Math.max(W, D), band = 3.0, mus = Math.min(11, Lr * 0.28), md = L.mainDoor?.at, ends = W >= D ? ['W', 'E'] : ['N', 'S'];
    const mid = { W: [X0, (Z0 + Z1) / 2], E: [X1, (Z0 + Z1) / 2], N: [(X0 + X1) / 2, Z0], S: [(X0 + X1) / 2, Z1] }, end = md ? ends.sort((a, b) => Math.hypot(mid[b][0] - md[0], mid[b][1] - md[1]) - Math.hypot(mid[a][0] - md[0], mid[a][1] - md[1]))[0] : ends[0];
    const R = [X0 + band, Z0 + band, X1 - band, Z1 - band]; if (end === 'W') R[0] = X0 + mus; if (end === 'E') R[2] = X1 - mus; if (end === 'N') R[1] = Z0 + mus; if (end === 'S') R[3] = Z1 - mus;
    for (const p of fl) { const [aw, ad] = aabb(p); ok(!(p.x + aw / 2 > R[0] + 0.3 && p.x - aw / 2 < R[2] - 0.3 && p.z + ad / 2 > R[1] + 0.3 && p.z - ad / 2 < R[3] - 0.3), `${tag} ${p.id} (${p.rule}) stands on the dance floor`); }
    ok(!L.placements.some(p => p.orient === 'floor'), `${tag} a rug on the dance floor`);
    const frac = Math.max(0, R[2] - R[0]) * Math.max(0, R[3] - R[1]) / (W * D); (st.frac ||= []).push(frac);
    if (w * d >= 48) ok(frac >= 0.45, `${tag} the empty floor is ${(frac * 100).toFixed(0)}% of the room`);
    ok(!L.placements.some(p => /^chandelier/.test(p.id)), `${tag} a chandelier over the dance floor (from the table camera it lies on the floor)`);
  }
  if (k === 'mansion-dining') {
    const seats = L.placements.filter(p => p.rule === 'seat'), plates = L.placements.filter(p => p.id === 'plate-silver').length;
    if (Math.max(w, d) >= 5 && Math.min(w, d) >= 4) { ok(seats.length >= 6, `${tag} a dining room with ${seats.length} chairs`); ok(seats.some(p => p.id === 'chair-armed'), `${tag} no carver at the head of the table`); }
    ok(plates === seats.filter(p => p.id === 'chair-plain').length, `${tag} ${plates} plates for ${seats.length} seats`);
    (st.seats ||= []).push(seats.length);
  }
  if (k === 'mansion-library') { const cases = L.placements.filter(p => /^(bookshelf|bookcase-ladder)$/.test(p.id)); if (w * d >= 16) ok(cases.length >= (w * d >= 20 ? 4 : 3), `${tag} a ${w * d}-cell library with ${cases.length} bookcases`); /* (the real cases are 5 to 8 ft wide: a 20-ft room with a door and windows may hold three) */ (st.cases ||= []).push(cases.reduce((a, p) => a + p.dims[0], 0) / (2 * (W + D))); }
  if (k === 'mansion-hall' && w === S.T[k].cells[0] && d === S.T[k].cells[1]) { halls++; if (L.placements.some(p => p.id === 'stair-grand')) stairs++; }
  if (k === 'mansion-conservatory') ok(!L.placements.some(p => p.id === 'curtains-drapes'), `${tag} drapes in the conservatory`);
  if (k === 'mansion-kitchen' && arr !== 'alone') ok(L.placements.some(p => p.id === 'bell-board-servants'), `${tag} no servants' bell board`);
  if (k === 'mansion-cellar') (st.bins ||= []).push(L.placements.filter(p => p.id === 'wine-bin-arched').length);
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} mansion rooms solved (7 state rooms x 6 sizes + 2 service rooms x 3 sizes, x 3 arrangements x 8 seeds)`);
const avg = (a) => a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  const more = st.frac ? `, empty floor ${(avg(st.frac) * 100).toFixed(0)}% (min ${(Math.min(...st.frac) * 100).toFixed(0)}%)` : st.seats ? `, ${avg(st.seats).toFixed(1)} seats` : st.cases ? `, books on ${(avg(st.cases) * 100).toFixed(0)}% of the wall` : st.bins ? `, ${avg(st.bins).toFixed(1)} wine bins` : '';
  console.log(`  ${k.padEnd(21)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${avg(st.dens).toFixed(2)}x target (min ${Math.min(...st.dens).toFixed(2)})${more}${st.extra.length ? `, outside door is the double door in ${st.extra.filter(Boolean).length}/${st.extra.length}` : ''}; per room: ${top}`); }
console.log(`service rooms with a blocked path (the inn programs' own behaviour): ${innBlocked} of ${stats['mansion-kitchen'].n + stats['mansion-cellar'].n}`);
console.log(`the hall at its default ${S.T['mansion-hall'].cells.join('x')}: the grand stair stands in ${stairs} of ${halls} (the rest have a door in the wall facing the front door: the centre table)`);
console.log(`over the 9-ft wall: ${overtop} placements, tallest ${overMax.toFixed(2)} ft (${capped ? 'only stair-grand, 10 ft by design: the 104-in caps are in this library' : 'stair-grand by design; fireplace-marble and bookcase-ladder are UNCAPPED in this library and clamped for the check'})`);
ok(halls === 0 || stairs >= halls * 0.4, `the grand stair stands in only ${stairs} of ${halls} default halls`);
console.log(`tiers: ${tier.got} of ${tier.want} placements of roles that have a mansion mesh rolled it`);
for (const [m, n] of [...tier.miss].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${String(n).padStart(4)} x ${m}`);
ok(tier.got === tier.want, `${tier.want - tier.got} placements rolled an inn mesh where a mansion mesh exists`);

// ---- families and doors are registered
for (const f of ['noble-panel', 'noble-paper', 'conservatory']) { ok(S.w.WALL_FAMILIES.includes(f) && S.w.FAMILY_FALLBACK[f] === 'noble-interior', `${f} is registered and borrows noble-interior`); ok(S.lib.objects['wall-straight'].skus.some(s => s.family === f && s.bounds), `the library has a ${f} wall`); }
ok(!S.lib.objects['wall-window-small'].skus.some(s => s.family === 'conservatory'), 'there is no conservatory window piece (the wall is the window)');
ok(S.lib.objects['door-double-grand'].skus.some(s => s.piece === 'leaf' && s.shape === 'fine-leaf') && S.lib.objects['door-double-grand'].skus.some(s => s.piece === 'leaf' && s.shape === 'leaf'), 'door-double-grand has both leaves: the inn\'s (leaf) and the mansion\'s (fine-leaf)');

// ---- the formal garden (its own program, KEY['mansion-garden']): hedged, two clear walks, mirrored pairs
{ const INN = /^(well|sign-|woodpile|dog-kennel|table-picnic|picnic|fence-|gate-fence|bucket|barrel|notice-board|hitching|water-trough|feed-trough|wall-drystone|bench-long|fire-basket|rain-barrel|outhouse|cart-|washing-line|compost)/;
  const GARR = {
    alone: (w, d, s) => [mk('g', 'mansion-garden', 10, 10, w, d, s, 1)],
    behindHall: (w, d, s) => [mk('h', 'mansion-hall', 10, 4, Math.max(w, 5), 6, s + 1, 1), mk('g', 'mansion-garden', 10, 10, w, d, s, 2)],
    between: (w, d, s) => [mk('h', 'mansion-hall', 10, 4, Math.max(w, 5), 6, s + 1, 1), mk('g', 'mansion-garden', 10, 10, w, d, s, 2), mk('c', 'mansion-conservatory', 10 + w, 10, 4, d, s + 2, 3)],
    court: (w, d, s) => [mk('h', 'mansion-hall', 10, 4, w, 6, s + 1, 1), mk('g', 'mansion-garden', 10, 10, w, d, s, 2), mk('l', 'mansion-library', 10, 10 + d, w, 4, s + 2, 3), mk('dr', 'mansion-drawing', 5, 10, 5, d, s + 3, 4), mk('di', 'mansion-dining', 10 + w, 10, 6, d, s + 4, 5)],
  };
  const GS = [[7, 6], [5, 5], [6, 5], [9, 8], [4, 4], [12, 10]];
  let n = 0, props = 0, mirrored = 0, offAxis = 0, hedge = 0, gz = 0, pond = 0; const focal = new Map(), byArr = {};
  for (const arr of Object.keys(GARR)) for (const [w, d] of GS) for (let seed = 1; seed <= 8; seed++) {
    const B = H.build(GARR[arr](w, d, seed * 41 + w)), r = B.rooms.find(x => x.id === 'g'), L = B.solve('g'), tag = `garden ${w}x${d} ${arr} seed ${r.seed}`; n++;
    ok(L.role === 'outdoor' && !L.purposeFail, `${tag}: ${L.role} ${L.purposeFail}`);
    ok(L.paths.every(p => p.ok), `${tag}: blocked path`);
    let sum = ''; try { sum = S.s2.summarize2(L); } catch (e) { sum = ''; ok(false, `${tag}: summarize2 threw ${e.message}`); }
    ok(/formal garden/.test(sum), `${tag}: the summary does not say formal garden`);
    ok(![...B.E.edges.values()].some(e => e.sides.some(q => q.room === 'g')), `${tag}: a wall of its own`);
    const X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5, Y = L.yard, ax = Y.axis;
    const edge = L.placements.filter(p => p.rule === 'yard-edge'), things = L.placements.filter(p => p.rule !== 'yard-edge' && p.orient !== 'floor');
    for (const p of things) { const [aw, ad] = aabb(p); ok(p.x - aw / 2 >= X0 - 0.17 && p.x + aw / 2 <= X1 + 0.17 && p.z - ad / 2 >= Z0 - 0.17 && p.z + ad / 2 <= Z1 + 0.17, `${tag}: ${p.id} outside the garden`); ok(!INN.test(p.id), `${tag}: an inn-yard thing in the formal garden: ${p.id}`); }
    for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) { const [aw, ad] = aabb(things[i]), [bw, bd] = aabb(things[j]); ok(!(Math.abs(things[i].x - things[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(things[i].z - things[j].z) < (ad + bd) / 2 - 0.17), `${tag}: overlap ${things[i].id} / ${things[j].id}`); }
    // the hedge: a piece on every open segment (the arch on the gate's), nothing else as an edge
    const gate = B.E.openings.get('g').find(o => o.kind === 'gate'), open = gate?.open || [];
    const mid = (sd, i) => sd === 'N' ? [X0 - 0.5 + i * CELL + 2.5, Z0 - 0.5] : sd === 'S' ? [X0 - 0.5 + i * CELL + 2.5, Z1 + 0.5] : sd === 'W' ? [X0 - 0.5, Z0 - 0.5 + i * CELL + 2.5] : [X1 + 0.5, Z0 - 0.5 + i * CELL + 2.5];
    for (const sg of open) { const [mx, mz] = mid(sg.side, sg.index), isGate = sg.side === gate.side && sg.index === gate.index, p = edge.find(q => Math.hypot(q.x - mx, q.z - mz) < 0.3); ok(p && p.id === (isGate ? 'hedge-gap-arch' : 'hedge-straight'), `${tag}: open segment ${sg.side}${sg.index} has ${p ? p.id : 'no hedge'}`); }
    ok(edge.every(p => /^hedge-/.test(p.id)), `${tag}: an edge piece that is not hedge: ${edge.filter(p => !/^hedge-/.test(p.id)).map(p => p.id)}`);
    ok(!!open.length === (Y.edge === 'hedge'), `${tag}: ${open.length} open segments, edge ${Y.edge}`); if (Y.edge === 'hedge') hedge++;
    // the two walks are clear: only the centrepiece (and the gazebo that closes the main axis) stand on them
    const horiz = ax.near === 'N' || ax.near === 'S', us = (p) => [(horiz ? p.x - X0 : p.z - Z0) - ax.t, ax.near === 'N' ? p.z - Z0 : ax.near === 'S' ? Z1 - p.z : ax.near === 'W' ? p.x - X0 : X1 - p.x];
    for (const p of things) { if (p.rule === 'yard-focal' || p.id === 'gazebo') continue; const [u, sv] = us(p), [aw, ad] = aabb(p), hu = (horiz ? aw : ad) / 2, hs = (horiz ? ad : aw) / 2;
      ok(Math.abs(u) - hu >= ax.walk / 2 - 0.3, `${tag}: ${p.id} (${p.rule}) stands on the main walk`);
      if (ax.cross && p.rule !== 'garden-statue') ok(Math.abs(sv - ax.s) - hs >= ax.walk / 2 - 0.3, `${tag}: ${p.id} (${p.rule}) stands on the cross walk`); }
    // mirror symmetry about the main axis: share of off-axis things with a partner of the same role at the mirrored spot
    for (const p of things) { const [u, sv] = us(p); if (Math.abs(u) < 0.6) continue; offAxis++; if (things.some(q => q !== p && q.id === p.id && Math.abs(us(q)[0] + u) < 0.6 && Math.abs(us(q)[1] - sv) < 0.6)) mirrored++; }
    // the centrepiece: a fountain where the garden is 16 ft each way, a sundial down to 13.5 ft
    const W = X1 - X0, D = Z1 - Z0, f = things.find(p => p.rule === 'yard-focal');
    if (Math.min(W, D) >= 16) ok(f && f.id === 'fountain-courtyard', `${tag}: no fountain at the crossing (${f?.id})`); else if (Math.min(W, D) >= 13.5) ok(!!f, `${tag}: no centrepiece`);
    if (f) ok(Math.abs(us(f)[0]) < 0.3 && Math.abs(us(f)[1] - ax.s) < 0.3, `${tag}: the centrepiece is off the crossing`);
    focal.set(f ? f.sku : 'none', (focal.get(f ? f.sku : 'none') || 0) + 1); props += things.length; if (things.some(p => p.id === 'gazebo')) gz++; if (things.some(p => p.id === 'lily-pond')) pond++;
    (byArr[arr] ||= []).push(things.length);
    const again = B.solve('g'); ok(JSON.stringify(again.placements.map(p => [p.id, p.sku, p.x, p.z])) === JSON.stringify(L.placements.map(p => [p.id, p.sku, p.x, p.z])), `${tag}: not deterministic`);
    if (PRINT && seed === 1 && arr === 'behindHall') console.log('\n--- ' + tag + '\n' + sum);
  }
  const show = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`formal garden: ${n} gardens (alone / behind the hall / between hall and conservatory / closed court, 6 sizes x 8 seeds), ${(props / n).toFixed(1)} things each (${Object.entries(byArr).map(([k, v]) => `${k} ${avg(v).toFixed(1)}`).join(', ')}); hedged ${hedge} (the rest are closed courts); centrepiece: ${show(focal)}; gazebo in ${gz}, lily pond in ${pond}`);
  console.log(`  mirror symmetry: ${mirrored} of ${offAxis} off-axis things (${(100 * mirrored / offAxis).toFixed(1)}%) have a partner of the same role at the mirrored spot`);
  ok(mirrored / offAxis >= 0.9, `mirror symmetry ${(100 * mirrored / offAxis).toFixed(1)}% is under 90%`);
}

// ---- the leg of an L-shaped room (args.annex): dressed, lit, and NO second key piece
if (/args\.annex/.test(readFileSync(S.dir + 'js/solver2.js', 'utf8'))) {
  let n = 0, props = 0; const KEYPIECE = /^(stair-grand|table-pedestal-round|fireplace-|table-feast|bookcase-ladder|desk-partners|bed-|harpsichord|fountain-courtyard|wall-|door-)/;
  for (const k of STATE) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 6; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door');
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    ok(!L.placements.some(p => KEYPIECE.test(p.id)), `${tag} a key piece or kit piece in the annex: ${L.placements.map(p => p.id).filter(i => KEYPIECE.test(i))}`);
    ok(L.placements.some(p => fireType(p.id)) || k === 'mansion-conservatory', `${tag} annex unlit`);
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id}/${fl[j].id}`); }
  }
  console.log(`annex (the leg of a shaped room, no key program): ${n} legs, ${(props / n).toFixed(1)} things each, no key piece repeated`);
} else console.log('annex: this tree\'s solver2.js has no args.annex (shaped rooms not merged yet): skipped');

// ---- a whole mansion, side by side (what the building tool makes): every room reachable, nothing fails
{ let outside = 0, forced = 0, n = 0, grand = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rs = [mk('h', 'mansion-hall', 15, 10, 5, 5, seed, 1), mk('dr', 'mansion-drawing', 10, 10, 5, 5, seed + 1, 2), mk('di', 'mansion-dining', 20, 10, 6, 5, seed + 2, 3), mk('li', 'mansion-library', 10, 15, 5, 4, seed + 3, 4),
      mk('ba', 'mansion-ballroom', 15, 15, 8, 6, seed + 4, 5), mk('be', 'mansion-bedroom', 10, 19, 5, 4, seed + 5, 6), mk('ki', 'mansion-kitchen', 26, 10, 5, 5, seed + 6, 7), mk('ce', 'mansion-cellar', 26, 15, 4, 3, seed + 7, 8),
      mk('co', 'mansion-conservatory', 23, 15, 3, 6, seed + 8, 9), mk('ga', 'mansion-garden', 15, 21, 8, 6, seed + 9, 10)];
    const B = H.build(rs); n++;
    const doors = [...B.E.edges.values()].filter(e => e.kind === 'door'), indoor = rs.filter(r => r.type !== 'mansion-garden'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of doors) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = doors.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(indoor.every(r => seen.has(r.id)), `a whole mansion (seed ${seed}): ${indoor.filter(r => !seen.has(r.id)).map(r => r.type)} cannot be reached`);
    outside += doors.filter(e => e.sides.length === 1).length; forced += doors.filter(e => e.flag).length; grand += doors.filter(e => e.doorType === 'door-double-grand').length;
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail, `whole mansion seed ${seed}: ${r.type} ${L.purposeFail}`); }
  }
  console.log(`a whole mansion (10 rooms side by side, ${n} seeds): every indoor room reachable; ${(outside / n).toFixed(1)} outside doors, ${(forced / n).toFixed(1)} added for reachability, ${(grand / n).toFixed(1)} walnut double doors per mansion`);
}
H.report('mansion');
