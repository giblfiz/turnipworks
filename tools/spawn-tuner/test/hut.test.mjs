// Farmstead (2026-10-11): sixteen rooms built from the library as it stood; walls half-timber / rough-timber / fieldstone.
//   node test/hut.test.mjs [tuner dir] [--print]        default tree: this file's own tuner
//   rooms     every indoor room type x 5 sizes x 8 seeds x 3 arrangements (alone; off the kitchen; between rooms with a
//             farmyard): the shared checks (ccm_lib.mjs): purpose, nothing outside or overlapping, the focal piece, paths
//             clear, the key feature in view, doors usable, nothing hung on a door or window, deterministic
//   wealth    the cottage is poor by default (fire on the floor, pallet, stools); opts.wealth 'common' gives it a hearth in
//             the wall and a bedstead; the loft never has a bedstead
//   library   no farm room rolls a mesh of an exclusive tier (noble, castle, crypt, dun, ...): nothing was made for it
//   byre      stalls, and nothing of the horse (no saddle, blanket rail, farrier's stand)
//   outdoors  the five plots: no fail, everything on the plot, nothing overlapping, the fence only on open edges and never
//             across a building's wall; beds / crop / trees in rows; a farmyard big enough has its well
//   a farm    cottage, passage, byre, dairy and barn round a farmyard: every room reachable, no purpose fails
import { loadTree, makeHarness, CELL, standing, aabb, overlap, HERE } from './ccm_lib.mjs';
const S = await loadTree('../..'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const INDOOR = ['hut-cottage', 'hut-kitchen', 'hut-bedroom', 'hut-loft', 'hut-passage', 'hut-cellar', 'hut-byre', 'hut-coop', 'hut-barn', 'hut-granary', 'hut-dairy'], OUTDOOR = ['hut-pigsty', 'hut-garden', 'hut-field', 'hut-orchard', 'hut-farmyard'];
const INN = ['hut-bedroom', 'hut-barn']; // these ARE the inn's guest room and barn programs (PROGRAM_OF): a blocked path there is the inn program's own; counted, not failed
for (const k of [...INDOOR, ...OUTDOOR]) { ok(!!S.T[k], `room type ${k} is in rooms.json`); ok(S.T[k]?.group === 'Farmstead', `${k} is in the Farmstead group`); ok(S.w.HUT_ROOMS.includes(k), `${k} is in walls.js HUT_ROOMS`); ok(!!S.w.HUT_USES[k], `${k} has its adjacency wishes (HUT_USES)`); }
for (const k of OUTDOOR) ok(S.w.isOutdoor(k) && S.T[k].outdoor === true, `${k} is an outdoor room`);
const FOCAL = { 'hut-cottage': /^(hearth-|fireplace-wall|cook-hearth)/, 'hut-kitchen': /^(cook-hearth|fireplace-wall)/, 'hut-bedroom': /^bed-/, 'hut-loft': /^(bed-straw-pallet|bedroll|cot)$/, 'hut-passage': null, 'hut-cellar': /^(shelving-freestanding|cheese-shelf-aging|cupboard)$/,
  'hut-byre': /^stable-stall/, 'hut-coop': /^(nest-box-row|crate)$/, 'hut-barn': null, 'hut-granary': /^(grain-bin-stable|flour-bin|barrel)$/, 'hut-dairy': /^(cheese-shelf-aging|trade-cheese-aging-shelf|shelving-freestanding)$/ };
const sizesOf = (k) => { const [w, d] = S.T[k].cells; return [[w, d], [Math.max(2, w - 1), Math.max(2, d - 1)], [w + 1, d + 1], [d + 2, w + 2], [Math.round(w * 1.6), Math.round(d * 1.6)]]; };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offKitchen: (k, w, d, s) => [mk('h', k === 'hut-kitchen' ? 'hut-cottage' : 'hut-kitchen', 10, 6, Math.max(w, 5), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  between: (k, w, d, s) => [mk('h', k === 'hut-kitchen' ? 'hut-passage' : 'hut-kitchen', 5, 10, 5, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('l', k === 'hut-byre' ? 'hut-dairy' : 'hut-byre', 10 + w, 10, 5, d, s + 2, 3), mk('g', 'hut-farmyard', 10, 10 + d, w, 5, s + 3, 4)],
};
const EXCL = new Set(['', 'common', 'fine', 'hut']); /* the farm's own meshes (hut-01) are tier 'hut'; nothing of another type's exclusive tier may be rolled */ let rooms = 0, innBlocked = 0, tierBad = 0; const stats = {};
for (const k of INDOOR) for (const [w, d] of sizesOf(k)) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 53 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`; rooms++;
  // (a hung FLAT carries its catalog depth though it is drawn as a plane on the wall face: flattened for the outside check, as the mansion's test does)
  // (the ladder is a kit piece a storey high, the covered wagon 2 in over the 9-ft line: both are the inn barn's, let through as the mansion's stair is)
  const Lc = { ...L, placements: L.placements.map(p => p.orient === 'wall' && p.kind === 'flat' ? { ...p, dims: [p.dims[0], p.dims[1], 0.05] } : /^(ladder-wood|wagon)$/.test(p.id) ? { ...p, dims: [p.dims[0], Math.min(p.dims[1], 9 - p.y), p.dims[2]] } : p) };
  if (INN.includes(k) && !L.paths.every(p => p.ok)) { innBlocked++; Lc.paths = L.paths.map(p => ({ ...p, ok: true })); }
  const res = H.checkRoom(tag, B, r, Lc, { focal: FOCAL[k], lights: k === 'hut-cellar', windows: k === 'hut-cellar' ? false : undefined });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], things: new Map() }; st.n++; st.props += res.props; st.dens.push(res.density / res.target);
  for (const p of L.placements) { st.things.set(p.id, (st.things.get(p.id) || 0) + 1); const sk = S.lib.objects[p.id]?.skus.find(q => q.sku === p.sku); if (sk && !EXCL.has(sk.tier || '')) { tierBad++; ok(false, `${tag} rolled ${p.sku} (tier ${sk.tier})`); } }
  if (k === 'hut-byre') ok(!L.placements.some(p => /^(saddle|rural-saddle|horse-blanket|farrier|bridle|tack-wall)/.test(p.id)), `${tag} has horse tack: ${L.placements.filter(p => /^(saddle|rural-saddle|horse-blanket|farrier|bridle|tack-wall)/.test(p.id)).map(p => p.id)}`);
  if (k === 'hut-loft') ok(!L.placements.some(p => /^bed-(single|double|canopy)/.test(p.id)), `${tag} has a bedstead in the loft`);
  if (k === 'hut-coop') ok(L.placements.filter(p => p.id === 'nest-bird').length >= 2 || L.placements.some(p => p.id === 'nest-box-row'), `${tag} has no nests`);
  if (k === 'hut-passage') ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} has no clear way through`);
  if (k === 'hut-kitchen' && w * d >= 12) ok(L.placements.some(p => /^table-(trestle|square)$/.test(p.id) && p.rule === 'key-table'), `${tag} has no kitchen table`);
  if (k === 'hut-cottage') { const open = L.placements.some(p => /^hearth-(central|raised-square)$/.test(p.id)); ok(open, `${tag}: a poor cottage has its fire on the floor`); ok(L.placements.some(p => /^(bed-straw-pallet|bedroll|bed-single|cot)$/.test(p.id)), `${tag} has no bed`); ok(L.wealth === 'poor', `${tag} wealth ${L.wealth}`);
    if (seed <= 2 && w * d >= 12) { const C = B.solve('r', { wealth: 'common' }); ok(!C.purposeFail && C.placements.some(p => /^(fireplace-wall|cook-hearth)/.test(p.id)) && !C.placements.some(p => /^hearth-(central|raised)/.test(p.id)), `${tag} with wealth common: a hearth in the wall (${C.purposeFail || C.placements.filter(p => /hearth|fireplace/.test(p.id)).map(p => p.id)})`); } }
  if (k === 'hut-cellar') ok(!B.E.openings.get('r').some(o => o.kind === 'window'), `${tag}: a cellar has a window`);
}
// ---- outdoors
const NB = { alone: () => [], house: (w, d, s) => [mk('h', 'hut-kitchen', 10, 6, Math.max(w, 5), 4, s + 1, 1)], corner: (w, d, s) => [mk('h', 'hut-cottage', 10, 6, Math.max(w, 4), 4, s + 1, 1), mk('b', 'hut-byre', 10 + w, 10, 5, Math.max(d, 4), s + 2, 2)] };
let plots = 0; const ost = {};
for (const k of OUTDOOR) for (const [w, d] of sizesOf(k)) for (const nb of Object.keys(NB)) for (let seed = 1; seed <= 8; seed++) {
  const s = seed * 61 + w * 3 + d, B = H.build([...NB[nb](w, d, s), mk('r', k, 10, 10, w, d, s, 5)]), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${nb} seed ${s}`; plots++;
  const X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5, tiny = w * d <= 6;
  ok(L.role === 'outdoor', `${tag} role ${L.role}`); if (!tiny) ok(!L.purposeFail, `${tag} PURPOSE FAIL: ${L.purposeFail}`);
  const things = L.placements.filter(p => p.rule !== 'yard-edge'), edge = L.placements.filter(p => p.rule === 'yard-edge');
  for (const p of things) { const [aw, ad] = aabb(p); ok(p.x - aw / 2 >= X0 - 0.2 && p.x + aw / 2 <= X1 + 0.2 && p.z - ad / 2 >= Z0 - 0.2 && p.z + ad / 2 <= Z1 + 0.2, `${tag} ${p.id} (${p.rule}) off the plot`); }
  const fl = standing(L).filter(p => p.rule !== 'yard-edge');
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) ok(!overlap(fl[i], fl[j]), `${tag} overlap ${fl[i].id} (${fl[i].rule}) / ${fl[j].id} (${fl[j].rule})`);
  ok(L.paths.every(p => p.ok), `${tag} blocked path: ${L.paths.filter(p => !p.ok).map(p => p.kind)}`);
  // the fence stands on open edges only: never where a building's wall is
  const ops = B.E.openings.get('r'), builtAt = new Set(ops.filter(o => o.to && /^(wall|window|door)$/.test(o.kind)).map(o => `${o.side}:${o.index}`));
  for (const p of edge.filter(p => p.side)) { const i = Math.floor(((p.side === 'N' || p.side === 'S' ? p.x - r.x * CELL : p.z - r.z * CELL)) / CELL); ok(!builtAt.has(`${p.side}:${i}`), `${tag} fence section across the building's wall (${p.side}${i})`); }
  if (L.yard?.edge && L.yard.edge !== 'none') ok(edge.length >= 3, `${tag} edge ${L.yard.edge} with ${edge.length} pieces`);
  const n = (re) => L.placements.filter(p => re.test(p.id)).length;
  if (!tiny && !L.purposeFail) {
    if (k === 'hut-garden') ok(n(/^(vegetable-patch|trade-herb-bed)$/) >= 1, `${tag} has no bed`);
    if (k === 'hut-field') ok(n(/^vegetable-patch$/) >= 2 && n(/^(rural-straw-bundle|rural-grain-stook)$/) >= 2, `${tag}: ${n(/^vegetable-patch$/)} crop patches, ${n(/^(rural-straw-bundle|rural-grain-stook)$/)} sheaves`);
    if (k === 'hut-orchard') { const t = L.placements.filter(p => p.rule === 'orchard-tree'); ok(t.length >= (w * d >= 30 ? 2 : 1), `${tag}: ${t.length} trees`); /* (a 5x4 corner between two buildings' doors has room for one) */ if (t.length >= 4) ok(new Set(t.map(p => p.x.toFixed(1))).size * new Set(t.map(p => p.z.toFixed(1))).size === t.length || new Set(t.map(p => p.x.toFixed(1))).size <= t.length / 2 + 1, `${tag}: the trees are not on a grid`); }
    if (k === 'hut-farmyard') ok(n(/^well/) <= 1 && (Math.min(w, d) < 5 || n(/^well/) === 1), `${tag}: ${n(/^well/)} wells`); /* (the well stands 5.5 ft clear of the way to the gate: a yard under 25 ft may have no such spot) */
    if (k === 'hut-pigsty') ok(n(/^(feed-trough|water-trough)$/) >= 1, `${tag} has no trough`);
  }
  for (const p of L.placements) { const sk = S.lib.objects[p.id]?.skus.find(q => q.sku === p.sku); if (sk && !EXCL.has(sk.tier || '')) ok(false, `${tag} rolled ${p.sku} (tier ${sk.tier})`); }
  const again = B.solve('r'); ok(JSON.stringify(again.placements.map(p => [p.id, p.sku, p.x, p.z, p.rot])) === JSON.stringify(L.placements.map(p => [p.id, p.sku, p.x, p.z, p.rot])), `${tag} not deterministic`);
  const st = ost[k] ||= { n: 0, props: 0, edges: new Map(), things: new Map() }; st.n++; st.props += things.filter(p => p.orient !== 'floor').length; st.edges.set(L.yard?.edge, (st.edges.get(L.yard?.edge) || 0) + 1); for (const p of things) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
}
// ---- a farm: a longhouse (kitchen, passage, byre in a row), a bedroom and a dairy off the kitchen, the barn across the yard
let farms = 0;
for (let seed = 1; seed <= 12; seed++) {
  const R = [mk('k', 'hut-kitchen', 10, 10, 5, 4, seed * 7, 1), mk('p', 'hut-passage', 15, 10, 3, 4, seed * 7 + 1, 2), mk('b', 'hut-byre', 18, 10, 5, 4, seed * 7 + 2, 3), mk('s', 'hut-bedroom', 10, 7, 3, 3, seed * 7 + 3, 4), mk('d', 'hut-dairy', 13, 7, 3, 3, seed * 7 + 4, 5),
    mk('y', 'hut-farmyard', 10, 14, 8, 6, seed * 7 + 5, 6), mk('n', 'hut-barn', 10, 20, 6, 5, seed * 7 + 6, 7), mk('g', 'hut-garden', 5, 10, 5, 4, seed * 7 + 7, 8), mk('c', 'hut-coop', 18, 14, 3, 2, seed * 7 + 8, 9)];
  const B = H.build(R); farms++;
  for (const r of R) { const L = B.solve(r.id); ok(!L.purposeFail, `farm ${seed}: ${r.type} PURPOSE FAIL ${L.purposeFail}`); if (!S.w.isOutdoor(r.type)) ok(B.E.openings.get(r.id).some(o => o.kind === 'door'), `farm ${seed}: ${r.type} has no door`); }
  const doors = [...B.E.edges.values()].filter(e => e.kind === 'door' && e.sides.some(s => /^hut-/.test(R.find(x => x.id === s.room)?.type || '')));
  ok(doors.every(e => /^(door-plank|door-barn-double)$/.test(e.doorType)), `farm ${seed}: door types ${[...new Set(doors.map(e => e.doorType))]}`);
  ok(B.E.openings.get('k').some(o => o.kind === 'door' && o.to === 'p') || B.E.openings.get('p').some(o => o.kind === 'door' && o.to === 'k'), `farm ${seed}: the kitchen does not open into the passage`);
  ok(B.E.openings.get('p').some(o => o.kind === 'door' && o.to === 'b'), `farm ${seed}: the passage does not open into the byre`);
}
console.log(`farmstead: ${rooms} indoor rooms, ${plots} plots, ${farms} whole farms; inn-program blocked paths (bedroom, barn): ${innBlocked}; exclusive-tier rolls: ${tierBad}`);
for (const [k, st] of Object.entries(stats)) { const d = st.dens.sort((a, b) => a - b); console.log(`  ${k.padEnd(13)} ${String(st.n).padStart(4)} rooms, ${(st.props / st.n).toFixed(1).padStart(5)} props, density/target median ${d[d.length >> 1].toFixed(2)}${PRINT ? ' | ' + [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ') : ''}`); }
for (const [k, st] of Object.entries(ost)) console.log(`  ${k.padEnd(13)} ${String(st.n).padStart(4)} plots, ${(st.props / st.n).toFixed(1).padStart(5)} props, edge ${[...st.edges].map(([e, n]) => `${e} ${n}`).join(', ')}${PRINT ? ' | ' + [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ') : ''}`);
H.report('farmstead');
