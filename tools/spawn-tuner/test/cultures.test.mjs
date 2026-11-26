// Culture packs A (2026-11-06, cultures-a): Japan, China, India rooms on the culture skeleton (js/solver2.js ca: blocks).
//   node test/cultures.test.mjs [tuner dir] [--print] [--only=jpn,chn]
//   rooms     every indoor room type x 5 sizes x 6 seeds x 3 arrangements (alone; off the culture's hub; between two
//             rooms with its outdoor ground): the shared checks (ccm_lib.mjs): purpose, inside, no overlap, the focal
//             piece, paths clear, the key feature in view, doors usable, nothing hung on a door or window, deterministic
//   tiers     a culture room rolls no mesh of another type's exclusive tier (castle, crypt, noble, hut, chn for a jpn room ...)
//   axial     the sacred focal pieces (the shrine's offering table, the Buddha, the sanctum door) stand ONLY as the focal piece
//   facing    Nandi faces the sanctum door on the worship axis
//   sacred    a culture's sacred pieces are placed ONLY by its sacred rooms (the shrine's offering table, bell, box,
//             lion-dogs, torii and basin by the shrine hall and approach; the kamidana only by the dojo, high and centred
//             on the wall facing the door, nothing standing under it); no sacred piece in any other room of any type
//   dojo      the practice floor is clear: nothing stands in the middle half of the room
//   outdoors  the culture's grounds: no fail, everything on the ground, nothing overlapping, the path clear; the torii
//             astride the shrine approach's path; the tea garden's fence only on open edges
import { loadTree, makeHarness, CELL, standing, aabb, overlap } from './ccm_lib.mjs';
const S = await loadTree('../..'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const CULTURES = {
  jpn: { group: 'Japan', hub: 'jpn-house', ground: 'jpn-garden',
    focal: { 'jpn-house': /^jpn-tokonoma$/, 'jpn-teahouse': /^jpn-tokonoma$/, 'jpn-dojo': /^jpn-kamidana$/, 'jpn-shrine': /^jpn-shinsen-altar$/, 'jpn-shop': /^jpn-shop-platform$/, 'jpn-shrine-court': /^jpn-torii$/, 'jpn-garden': /^jpn-tsukubai$/ },
    sacred: { 'jpn-shinsen-altar': ['jpn-shrine'], 'jpn-saisen-bako': ['jpn-shrine'], 'jpn-bell-rope': ['jpn-shrine'], 'jpn-komainu': ['jpn-shrine-court'], 'jpn-torii': ['jpn-shrine-court'], 'jpn-chozuya': ['jpn-shrine-court'], 'jpn-kamidana': ['jpn-dojo'] },
    hung: { 'jpn-kamidana': 'jpn-dojo' }, axial: ['jpn-shinsen-altar'] },
  chn: { group: 'China', hub: 'chn-hall', ground: 'chn-courtyard',
    focal: { 'chn-hall': /^chn-console-table$/, 'chn-teahouse': /^chn-tea-counter$/, 'chn-study': /^(chn-bookcase|chn-painting-table)$/, 'chn-temple': /^chn-buddha-altar$/, 'chn-market': /^chn-market-stall$/, 'chn-courtyard': /^chn-taihu-rock$/ },
    sacred: { 'chn-buddha-altar': ['chn-temple'], 'chn-offering-table': ['chn-temple'], 'chn-incense-burner': ['chn-temple'], 'chn-kneeling-cushion': ['chn-temple'], 'chn-temple-bell': ['chn-temple'], 'chn-temple-drum': ['chn-temple'] }, axial: ['chn-buddha-altar'] },
  ind: { group: 'India', hub: 'ind-bazaar', ground: 'ind-haveli',
    focal: { 'ind-durbar': /^ind-gaddi-throne$/, 'ind-mandapa': /^ind-sanctum-door$/, 'ind-bazaar': /^ind-merchant-seat$/, 'ind-kitchen': /^ind-chulha$/, 'ind-haveli': /^ind-tulsi$/, 'ind-stepwell': /^ind-stepwell$/ },
    sacred: { 'ind-sanctum-door': ['ind-mandapa'], 'ind-nandi': ['ind-mandapa'], 'ind-temple-bell': ['ind-mandapa'], 'ind-tulsi': ['ind-haveli'] }, axial: ['ind-sanctum-door'],
    facing: { 'ind-nandi': 'ind-sanctum-door' } },
};
const codes = Object.keys(CULTURES).filter(c => !ONLY.length || ONLY.includes(c));
const ROOMS = (c) => S.types.filter(t => t.key.startsWith(c + '-')).map(t => t.key);
const SACRED = Object.assign({}, ...Object.values(CULTURES).map(c => c.sacred));
const sizesOf = (k) => { const [w, d] = S.T[k].cells; return [[w, d], [Math.max(2, w - 1), Math.max(2, d - 1)], [w + 1, d + 1], [d + 1, w], [Math.round(w * 1.5), Math.round(d * 1.5)]]; };
const own = (c) => new Set(['', 'common', 'fine', c]);
let rooms = 0, grounds = 0; const stats = {};
for (const c of codes) {
  const C = CULTURES[c], all = ROOMS(c), indoor = all.filter(k => !S.w.isOutdoor(k)), outdoor = all.filter(k => S.w.isOutdoor(k));
  ok(all.length >= 5, `${c}: ${all.length} room types (want 5-7)`);
  for (const k of all) { ok(S.T[k].group === C.group, `${k} is in the ${C.group} group`); ok((S.T[k].recipes[0] || '').startsWith(c + '-'), `${k}'s first recipe names its type`); ok(S.T[k].missing?.length === 0 || PRINT, `${k} lacks ${S.T[k].missing}`); }
  const ARR = {
    alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
    offHub: (k, w, d, s) => [mk('h', k === C.hub ? indoor.find(x => x !== C.hub) : C.hub, 10, 6, Math.max(w, 4), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
    between: (k, w, d, s) => [mk('h', k === C.hub ? indoor.find(x => x !== C.hub) : C.hub, 5, 10, 5, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('g', C.ground, 10, 10 + d, w, 5, s + 3, 4)],
  };
  for (const k of indoor) for (const [w, d] of sizesOf(k)) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 6; seed++) {
    const B = H.build(ARR[arr](k, w, d, seed * 53 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`; rooms++;
    const Lc = { ...L, placements: L.placements.map(p => p.orient === 'wall' && p.kind === 'flat' ? { ...p, dims: [p.dims[0], p.dims[1], 0.05] } : p) };
    const res = H.checkRoom(tag, B, r, Lc, { focal: C.focal[k], lights: !B.E.openings.get('r').some(o => o.kind === 'window'), fire: [[/^jpn-(andon|toro)$/, 'lantern']] }); // (js/fx/fire.js: the culture lamps the game lights)
    const st = stats[k] ||= { n: 0, props: 0, dens: [], things: new Map() }; st.n++; st.props += res.props; st.dens.push(res.density / res.target);
    for (const p of L.placements) { st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
      const sk = S.lib.objects[p.id]?.skus.find(q => q.sku === p.sku); if (sk) ok(own(c).has(sk.tier || ''), `${tag} rolled ${p.sku} (tier ${sk.tier})`);
      if (SACRED[p.id]) ok(SACRED[p.id].includes(k), `${tag} placed the sacred ${p.id} (it belongs to ${SACRED[p.id]})`);
      if ((C.axial || []).includes(p.id)) ok(p.rule === 'key-focal', `${tag} the ${p.id} is not the room's focal piece on its axis (rule ${p.rule})`);
      if (C.facing?.[p.id]) { const q = L.placements.find(x => x.id === C.facing[p.id]); if (q) { const dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz) || 1; ok((Math.sin(p.rot) * dx + Math.cos(p.rot) * dz) / n > 0.9, `${tag} the ${p.id} does not face the ${q.id}`); } } }
    for (const [id, where] of Object.entries(C.hung || {})) if (k === where) { const q = L.placements.find(p => p.id === id);
      if (ok(!!q, `${tag} has no ${id}`)) { ok(q.y >= 5.5, `${tag} ${id} hung low (bottom at ${q.y.toFixed(1)} ft)`); ok(q.focal || q.rule === 'key-focal', `${tag} ${id} is not the focal piece`);
        const fl = standing(L).filter(p => Math.hypot(p.x - q.x, p.z - q.z) < 3 && p.dims[1] > 1.5); ok(!fl.length, `${tag} something stands under the ${id}: ${fl.map(p => p.id)}`); } }
    if (k === 'jpn-dojo') { const X0 = r.x * CELL, Z0 = r.z * CELL, W = r.w * CELL, D = r.d * CELL, inMid = (p) => Math.abs(p.x - (X0 + W / 2)) < W / 4 && Math.abs(p.z - (Z0 + D / 2)) < D / 4;
      ok(!standing(L).some(inMid), `${tag} the practice floor is not clear: ${standing(L).filter(inMid).map(p => p.id)}`); }
  }
  // ---- the culture's grounds
  const NB = { alone: () => [], house: (w, d, s) => [mk('h', C.hub, 10, 6, Math.max(w, 4), 4, s + 1, 1)], corner: (w, d, s) => [mk('h', C.hub, 10, 6, Math.max(w, 4), 4, s + 1, 1), mk('b', indoor.at(-1), 10 + w, 10, 4, Math.max(d, 4), s + 2, 2)] };
  for (const k of outdoor) for (const [w, d] of sizesOf(k)) for (const nb of Object.keys(NB)) for (let seed = 1; seed <= 6; seed++) {
    const s = seed * 61 + w * 3 + d, B = H.build([...NB[nb](w, d, s), mk('r', k, 10, 10, w, d, s, 5)]), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${nb} seed ${s}`; grounds++;
    const X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5, tiny = w * d <= 9 || Math.min(w, d) <= 3; // (a 15-ft strip between two buildings takes its path and little else: its signature is not required)
    ok(L.role === 'outdoor', `${tag} role ${L.role}`); if (!tiny) ok(!L.purposeFail, `${tag} PURPOSE FAIL: ${L.purposeFail}`);
    const things = L.placements.filter(p => p.rule !== 'yard-edge'), edge = L.placements.filter(p => p.rule === 'yard-edge');
    for (const p of things) { const [aw, ad] = aabb(p); ok(p.x - aw / 2 >= X0 - 0.2 && p.x + aw / 2 <= X1 + 0.2 && p.z - ad / 2 >= Z0 - 0.2 && p.z + ad / 2 <= Z1 + 0.2, `${tag} ${p.id} (${p.rule}) off the ground`); }
    const fl = standing(L).filter(p => p.rule !== 'yard-edge' && p.rule !== 'yard-gatepiece');
    for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) ok(!overlap(fl[i], fl[j]), `${tag} overlap ${fl[i].id} (${fl[i].rule}) / ${fl[j].id} (${fl[j].rule})`);
    ok(L.paths.every(p => p.ok), `${tag} blocked path: ${L.paths.filter(p => !p.ok).map(p => p.kind)}`);
    if (!tiny && C.focal[k]) ok(L.placements.some(p => C.focal[k].test(p.id)), `${tag} no ${C.focal[k]}`);
    for (const p of L.placements) { const sk = S.lib.objects[p.id]?.skus.find(q => q.sku === p.sku); if (sk) ok(own(c).has(sk.tier || ''), `${tag} rolled ${p.sku} (tier ${sk.tier})`); if (SACRED[p.id]) ok(SACRED[p.id].includes(k), `${tag} placed the sacred ${p.id}`); }
    const ops = B.E.openings.get('r'), builtAt = new Set(ops.filter(o => o.to && /^(wall|window|door)$/.test(o.kind)).map(o => `${o.side}:${o.index}`));
    for (const p of edge.filter(p => p.side)) { const i = Math.floor(((p.side === 'N' || p.side === 'S' ? p.x - r.x * CELL : p.z - r.z * CELL)) / CELL); ok(!builtAt.has(`${p.side}:${i}`), `${tag} fence across a building's wall (${p.side}${i})`); }
  }
}
// ---- sacred pieces never appear in another type's rooms (every non-culture room type, one size, two seeds)
let others = 0;
for (const t of S.types.filter(t => !/^(jpn|chn|ind)-/.test(t.key) && !t.outdoor && t.key !== 'cave' && t.key !== 'hill').slice(0, 400)) for (const seed of [3, 11]) {
  const B = H.build([mk('r', t.key, 10, 10, t.cells[0], t.cells[1], seed, 1)]), L = B.solve('r'); others++;
  for (const p of L.placements) ok(!SACRED[p.id] && !/^(jpn|chn|ind)-/.test(p.id), `${t.key} seed ${seed} placed the culture piece ${p.id}`);
}
if (PRINT) for (const [k, st] of Object.entries(stats)) console.log(k.padEnd(18), `${st.n} rooms, ${(st.props / st.n).toFixed(1)} props, density ${(st.dens.reduce((a, b) => a + b, 0) / st.n * 100).toFixed(0)}% of target;`, [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', '));
H.report(`cultures (${codes.join(', ')}): ${rooms} rooms, ${grounds} grounds, ${others} other rooms`);
