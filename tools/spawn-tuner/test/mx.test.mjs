// The modrooms lane (2026-11-07): five more rooms of the Modern genre (penthouse, bathroom, public restroom, restaurant
// kitchen, fire escape: City) and the exec penthouse (Cyberpunk). experiments/2026-11-07-modrooms.
//   node test/mx.test.mjs [tuner dir] [--print]
//   rooms     every room type x 4 sizes x 4 seeds x 2 arrangements (alone; beside a city street): the shared checks
//             (ccm_lib.mjs: nothing outside, nothing overlapping, doors and paths clear, the focal piece, lit, deterministic)
//             plus: every placement is a modern sku or a vetted borrowed look (MX_BORROW); doors are modern doors
//   reads     each room's signature is laid (mxInfo): the sectional and the kitchen, the tub or shower with toilet and
//             basin, the row of cubicles and the sinks, the range and the prep line, the flight and the railing
//   walls     the penthouse's outside walls are glass but for the door's (seen through, stop feet); the wet rooms' tiles
//             follow walls.js MX_TILES (off by default since the blind read)
//   attached  a bathroom drawn against an apartment gets a door into it (the en suite case)
//   climb     THE FIRE ESCAPE IS A STAIRWELL: landings drawn at 10, 20 and 30 ft against a building over an alley. Each
//             landing's flight is a real connector (core/stairs.js): open (silent) under no landing, working under the next;
//             a pawn walked along a flight rises from its landing to the next; the lowest landing's drop ladder takes a
//             pawn dropped on it in the alley up to the landing; the flights alternate lanes, so no flight stands in the
//             hole of the one below
//   leak      no other room places one of this lane's skus
import { readFileSync } from 'node:fs';
import { loadTree, makeHarness, CELL } from './ccm_lib.mjs';
const S = await loadTree('mx'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = S.w.MX_ROOMS, OUT = new Set(['mod-fire-escape']), BORROW = S.s2.MX_BORROW || {};
const SKU = new Map(); for (const o of Object.values(S.lib.objects)) for (const s of o.skus) SKU.set(s.sku, { ...s, role: o.id });
const MINE = (sku) => /^modrooms-/.test(SKU.get(sku)?.src || '');
const HAS = (id) => (S.lib.objects[id]?.skus || []).some(s => s.tier === 'mod' || s.tier === 'cyb');
const V = await import(new URL('../../../engine/client/vision.js', import.meta.url));
const ST = await import(new URL('../../../engine/core/stairs.js', import.meta.url));
const HT = await import(new URL('../../../engine/core/height.js', import.meta.url));
// ---- types
const TY = JSON.parse(readFileSync(new URL('../../../engine/client/data/types.json', import.meta.url)));
const MB = JSON.parse(readFileSync(new URL('../../../engine/tools/modern_buildings.json', import.meta.url)));
const WANT_IN = { 'mod-penthouse': ['APT', 'OFC'], 'mod-penthouse-exec': ['OFC'], 'mod-bathroom': ['APT', 'BAR', 'OFC'], 'mod-restroom': ['BAR', 'OFC', 'SHP'], 'mod-kitchen': ['BAR', 'SHP'], 'mod-fire-escape': ['APT'] };
for (const [k, bs] of Object.entries(WANT_IN)) ok(bs.every(b => (MB.rooms[k] || []).includes(b)), `${k} is in the buildings ${bs} (engine/tools/modern_buildings.json): ${MB.rooms[k]}`);
for (const b of ['APT', 'OFC']) ok((TY.types.find(t => t.code === b)?.roles || []).includes('elevator-car'), `the ${b} building's shelves offer the elevator car`);
ok(KEYS.length === 6 && S.s2.MX_ROOMS?.join() === KEYS.join(), 'six rooms, the same list in walls.js and solver2.js');
for (const k of KEYS) {
  ok(!!S.T[k], `room type ${k} is in rooms.json`);
  const exec = k === 'mod-penthouse-exec';
  ok((S.T[k]?.tiers || []).join() === (exec ? 'cyb,mod' : 'mod'), `${k} tiers ${S.T[k]?.tiers}`);
  ok(S.T[k]?.recipes?.[0]?.startsWith(exec ? 'cyb-' : 'mod-'), `${k}: its first recipe files it under ${exec ? 'Cyberpunk' : 'City'}`);
}
ok(S.w.roleOf('mod-fire-escape') === 'outdoor', 'the fire escape is outdoor');
ok(!!ST.STAIR_ROLES['stair-fire-escape'] && ST.STAIR_ROLES['ladder-fire-escape']?.turn, 'the steel flight and the drop ladder are connectors (core/stairs.js STAIR_ROLES)');
const FIRE = readFileSync(new URL('../js/fx/fire.js', import.meta.url), 'utf8');
for (const id of ['mirror-bathroom', 'elevator-doors', 'range-commercial', 'fridge-reach-in']) ok(FIRE.includes(id), `fire.js types ${id}`);
const ELEC = [[/^light-fluorescent/, 'tube'], [/^(lamp-floor|mirror-bathroom)/, 'bulb'], [/^(video-screen|range-commercial|fridge-reach-in)/, 'screen']];
// ---- rooms
const SIZES = { 'mod-penthouse': [[8, 6], [6, 5], [10, 8], [6, 9]], 'mod-penthouse-exec': [[8, 6], [7, 6], [10, 7], [6, 8]], 'mod-bathroom': [[2, 2], [3, 2], [2, 3], [3, 3]],
  'mod-restroom': [[4, 3], [3, 3], [5, 4], [3, 5]], 'mod-kitchen': [[6, 4], [5, 4], [8, 5], [4, 6]], 'mod-fire-escape': [[4, 2], [5, 2], [2, 4], [6, 2]] };
const FAMILY = { 'mod-penthouse': 'drywall', 'mod-penthouse-exec': 'drywall', 'mod-bathroom': 'drywall', 'mod-restroom': 'drywall', 'mod-kitchen': 'drywall' };
const KEYRE = { 'mod-penthouse': /^(sofa-sectional|sofa)$/, 'mod-penthouse-exec': /^(sofa-sectional|sofa)$/, 'mod-bathroom': /^(bathtub|shower-stall)$/, 'mod-restroom': /^toilet-stall$/, 'mod-kitchen': /^range-commercial$/, 'mod-fire-escape': null }; // (solver2.js KEY_RE, which it does not export)
const MOD_DOORS = /^(door-flush|door-steel|door-shopfront|door-roller-shutter)$/;
const ARR = { alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  street: (k, w, d, s) => [mk('st', 'mod-street', 10, 10 + d, Math.max(w, 6), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)] };
const ready = KEYS.filter(k => { const re = KEYRE[k] || /^(stair-fire-escape|railing-iron)$/; return [...re.source.matchAll(/[a-z][a-z-]+[a-z]/g)].some(m => HAS(m[0]) && S.lib.objects[m[0]].skus.some(s => MINE(s.sku))); });
if (ready.length < KEYS.length) console.log('NOTE: no modrooms meshes yet for', KEYS.filter(k => !ready.includes(k)).join(', '), ': those rooms are skipped');
const stats = {}; let rooms = 0, glassSeen = 0, tileSeen = 0;
const modern = (p) => { const s = SKU.get(p.sku); if (!s) return false; if (s.tier === 'mod' || s.tier === 'cyb') return true; const b = BORROW[p.id]; return !!b && (!b.length || b.includes(p.sku)); };
for (const k of ready) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 4; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 131 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  if (OUT.has(k)) { ok(!L.purposeFail, `${tag} PURPOSE FAIL: ${L.purposeFail}`); const X0 = r.x * 5, Z0 = r.z * 5; for (const p of L.placements) if (p.rule !== 'fire-ladder') ok(p.x >= X0 && p.x <= X0 + r.w * 5 && p.z >= Z0 && p.z <= Z0 + r.d * 5, `${tag} ${p.id} outside the landing`); }
  else H.checkRoom(tag, B, /bathroom|restroom|kitchen/.test(k) ? { ...r, panels: (r.panels || []).filter(p => p.panel !== 'wall-tiled') } : r, L, { focal: L.purposeFail ? null : KEYRE[k], lights: true, fire: ELEC }); // (tiles are a wall to hang things on, not a window)
  const st = stats[k] ||= { n: 0, props: 0, fails: 0, things: new Map() };
  st.n++; st.props += L.placements.length; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  for (const p of L.placements) ok(modern(p), `${tag} ${p.id} (${p.sku}) is neither a modern sku nor a vetted borrowed look`);
  if (FAMILY[k]) ok(r.family === FAMILY[k], `${tag} family ${r.family}`);
  for (const e of [...B.E.edges.values()].filter(e => e.kind === 'door' && e.sides.some(s => s.room === 'r') && FAMILY[k])) ok(MOD_DOORS.test(e.doorType), `${tag} door type ${e.doorType}`);
  const I = L.mxInfo || {};
  if (!L.purposeFail) {
    if (/penthouse/.test(k)) ok(I.sofa && (w * d < 40 || I.kitchen) && I.glass >= 1, `${tag} sofa ${I.sofa} kitchen ${I.kitchen} glass sides ${I.glass}`);
    if (k === 'mod-penthouse-exec') ok(I.screen || I.sculpture || I.drone, `${tag} no near-future dressing`);
    if (k === 'mod-bathroom') ok((I.tub || I.shower) && I.toilet && I.sink, `${tag} tub ${I.tub} shower ${I.shower} toilet ${I.toilet} sink ${I.sink}`);
    if (k === 'mod-restroom') ok(I.stalls >= 2 && !!I.sinks, `${tag} stalls ${I.stalls} sinks ${I.sinks}`);
    if (k === 'mod-kitchen') ok(I.ranges >= 1 && I.hoods >= 1 && (Math.min(w, d) < 3 || I.tables >= 1) && I.shelves + I.stock >= 1, `${tag} ranges ${I.ranges} hoods ${I.hoods} tables ${I.tables} stock ${I.stock}`);
    if (k === 'mod-fire-escape') ok(I.edge > 0 && (Math.max(w, d) < 4 || I.flight), `${tag} flight ${I.flight} railing ${I.edge}`);
  }
  // glass and tiles: walls.js PANELS on real layouts
  const panels = [...B.E.edges.values()].filter(e => e.kind === 'wall' && e.panel && e.sides.some(s => s.room === 'r'));
  if (/penthouse/.test(k)) {
    const glass = panels.filter(e => e.panel === 'wall-glass-curtain');
    if (glass.length) { glassSeen++;
      const sight = V.blockingSegments(B.E.edges, {}), feet = V.blockingSegments(B.E.edges, {}, 0, { walk: true });
      const covers = (segs, e) => { const x = e.gx * 5, z = e.gz * 5, m = e.dir === 'h' ? [x + 2.5, z] : [x, z + 2.5]; return segs.some(([x0, z0, x1, z1]) => (e.dir === 'h' ? z0 === z && z1 === z && Math.min(x0, x1) <= m[0] && Math.max(x0, x1) >= m[0] : x0 === x && x1 === x && Math.min(z0, z1) <= m[1] && Math.max(z0, z1) >= m[1])); };
      for (const e of glass) { ok(!covers(sight, e), `${tag} glass ${e.key} stops sight`); ok(covers(feet, e), `${tag} glass ${e.key} does not stop feet`); }
    }
    const doorSides = new Set([...B.E.openings.get('r')].filter(o => o.kind === 'door').map(o => o.side));
    for (const p of r.panels || []) ok(!doorSides.has(p.side), `${tag} glass on the door's wall (${p.side})`);
  }
  if (/bathroom|restroom|kitchen/.test(k) && panels.length) { tileSeen++; ok(panels.every(e => e.panel === 'wall-tiled'), `${tag} a wet room's panel is ${panels.map(e => e.panel)}`); }
}
if (ready.some(k => /penthouse/.test(k))) ok(glassSeen > 0, 'some penthouse had glass walls to test');
if (ready.some(k => /bathroom|restroom|kitchen/.test(k))) ok(S.w.MX_TILES ? tileSeen > 0 : tileSeen === 0, `tiled walls ${S.w.MX_TILES ? 'on' : 'off (MX_TILES)'}: ${tileSeen} wet rooms tiled`);
// ---- attached: the en suite (a bathroom against an apartment opens into it)
if (ready.includes('mod-bathroom') && S.T['mod-apartment']) for (let seed = 1; seed <= 6; seed++) {
  const B = H.build([mk('a', 'mod-apartment', 10, 10, 6, 5, seed * 17, 1), mk('r', 'mod-bathroom', 16, 10, 2, 2, seed * 23, 2)]);
  const door = [...B.E.edges.values()].find(e => /^door/.test(e.kind) && e.sides.some(s => s.room === 'r') && e.sides.some(s => s.room === 'a'));
  ok(!!door, `en suite seed ${seed}: no door between the apartment and its bathroom`);
  const L = B.solve('r'); ok(!L.purposeFail, `en suite seed ${seed}: ${L.purposeFail}`);
}
// ---- climb: the fire escape as a stairwell, landings at 10, 20, 30 over an alley against a building
let climbs = 0;
if (ready.includes('mod-fire-escape')) for (let seed = 1; seed <= 6; seed++) for (const horiz of [true, false]) {
  const [w, d] = horiz ? [4, 2] : [2, 4], bx = horiz ? 10 : 12, bz = horiz ? 12 : 10; // the building: south of an E-W landing, east of a N-S one
  const ents = {}, put = (e) => { ents[e.id] = e; return e; };
  const room = (id, type, x, z, w, d, y) => put({ id, kind: 'room', recipe: { type, x, z, w, d, ...(y && { y }) } });
  room('alley', 'mod-alley', horiz ? 10 : 8, horiz ? 8 : 10, horiz ? 6 : 4, horiz ? 4 : 6, 0);
  const tag0 = `fire escape ${horiz ? 'E-W' : 'N-S'} seed ${seed}`;
  const lands = [10, 20, 30].map((y, i) => {
    const id = `l${i}`, bldg = horiz ? mk('b', 'mod-apartment', bx, bz, 4, 4, seed + i, 1) : mk('b', 'mod-apartment', bx, bz, 4, 4, seed + i, 1);
    const r = mk(id, 'mod-fire-escape', horiz ? 10 : 10, horiz ? 10 : 10, w, d, seed * 41 + i, 2); r.y = y; bldg.y = y;
    const B = H.build([bldg, r]), L = B.solve(id);
    room(id, 'mod-fire-escape', r.x, r.z, w, d, y);
    for (const [j, p] of L.placements.entries()) put({ id: `${id}o${j}`, kind: 'object', cat: p.id, sku: p.sku, x: p.x, y: (p.y || 0) + y, z: p.z, rot: p.rot, dims: p.dims, rule: p.rule, room: id });
    return { y, L, I: L.mxInfo || {} };
  });
  for (const ld of lands) ok(ld.I.flight && ld.I.wallSide === (horiz ? 'S' : 'E'), `${tag0} level ${ld.y}: flight ${ld.I.flight} on the building's side ${ld.I.wallSide}`);
  ok(lands[0].I.ladder && !lands[1].I.ladder && !lands[2].I.ladder, `${tag0}: only the lowest landing drops the ladder`);
  const flights = Object.values(ents).filter(e => e.cat === 'stair-fire-escape').sort((a, b) => a.y - b.y), ladder = Object.values(ents).find(e => e.cat === 'ladder-fire-escape');
  ok(flights.length === 3, `${tag0}: ${flights.length} flights`);
  if (flights.length !== 3) continue;
  for (const [i, f] of flights.entries()) {
    const Q = ST.stairStatus(ents, f);
    if (i < 2) ok(!Q.code, `${tag0}: the flight from ${f.y} does not work: ${Q.code} ${Q.why}`); else ok(Q.code === 'open', `${tag0}: the top flight (under no landing) is ${Q.code}, not open`);
    ok(ST.stairTop(f) === f.y + 10, `${tag0}: flight ${i} rises ${ST.stairTop(f) - f.y}`);
  }
  // no flight stands in the hole the flight under it opens
  for (let i = 1; i < 3; i++) { const below = new Set(ST.stairCells(flights[i - 1]).map(c => c.join())); ok(!ST.stairCells(flights[i]).some(c => below.has(c.join())), `${tag0}: flight ${i} stands in the hole of flight ${i - 1}`); }
  // walk the lowest two flights: foot -> top; the base rises with the treads to the next landing
  for (let i = 0; i < 2; i++) {
    const E = ST.stairEnds(flights[i], ents), steps = 8; let last = -1, smooth = true;
    for (let k = 0; k <= steps; k++) { const t = k / steps, x = E.foot.x + (E.top.x - E.foot.x) * t, z = E.foot.z + (E.top.z - E.foot.z) * t, b = HT.baseUnder(ents, x, z, Math.max(last, flights[i].y) + 6); if (b.y + 0.01 < last) smooth = false; last = b.y; }
    ok(smooth && Math.abs(last - (flights[i].y + 10)) < 0.6, `${tag0}: walking flight ${i} from ${E.foot.y} ends at ${last}, not ${flights[i].y + 10}`);
    const nextFoot = i < 1 ? ST.stairEnds(flights[i + 1], ents).foot : null;
    if (nextFoot) ok(Math.abs(nextFoot.y - E.top.y) < 0.1 && Math.hypot(nextFoot.x - E.top.x, nextFoot.z - E.top.z) <= 5.01, `${tag0}: the next flight's foot is not beside this one's top`);
    climbs++;
  }
  // the drop ladder: a pawn dropped on it in the alley comes out on the lowest landing
  if (ladder) {
    const Q = ST.stairStatus(ents, ladder); ok(!Q.code, `${tag0}: the drop ladder ${Q.code} ${Q.why}`);
    ok(ST.stairBase(ladder) === 0 && ST.stairTop(ladder) === 10, `${tag0}: the ladder joins ${ST.stairBase(ladder)} to ${ST.stairTop(ladder)}`);
    const hop = ST.stairHop(ents, ladder.x, ladder.z, 0); ok(hop && Math.abs(hop.y - 10) < 0.1, `${tag0}: a pawn dropped on the ladder in the alley ends at ${hop?.y}`);
  }
}
if (ready.includes('mod-fire-escape')) ok(climbs >= 20, `the fire escape was climbed ${climbs} times`);
// ---- leak: no other room places one of this lane's skus
let other = 0;
for (const t of S.types.filter(t => !KEYS.includes(t.key) && !(S.w.MH_ROOMS || []).includes(t.key) && !t.byHand && t.key !== 'hill')) /* (the modhalls corridors reuse the art canvas and the wire shelving on purpose: mh.test.mjs) */ for (let seed = 1; seed <= (/^(mod|cyb)-/.test(t.key) ? 4 : 1); seed++) {
  const B = H.build([mk('r', t.key, 10, 10, t.cells[0], t.cells[1], seed * 59, 1)]), L = B.solve('r'); other++;
  ok(!L.placements.some(p => MINE(p.sku)), `${t.key} seed ${seed} places a modrooms sku: ${L.placements.filter(p => MINE(p.sku)).map(p => p.sku)}`);
}
if (PRINT) for (const [k, st] of Object.entries(stats)) console.log(k.padEnd(20), `${st.n} rooms, ${(st.props / st.n).toFixed(1)} placements, ${st.fails} fails;`, [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([i, n]) => `${i} ${n}`).join(', '));
console.log(`mx: ${rooms} rooms (${ready.length} of ${KEYS.length} types with meshes), ${climbs} flights climbed, ${other} other rooms solved for the leak check`);
H.report('mx');
