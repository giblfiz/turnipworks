// node sweep.mjs <tree> : every farmstead room at several sizes and seeds, alone and beside a neighbour; prints crashes, purpose fails, blocked paths, counts
import { loadTree, makeHarness } from '../../../../tools/spawn-tuner/test/ccm_lib.mjs';
const S = await loadTree('x'), H = makeHarness(S);
const KEYS = S.types.filter(t => t.group === 'Farmstead');
for (const t of KEYS) { const [w0, d0] = t.cells; let n = 0, fails = 0, blocked = 0, crash = 0, props = [], un = new Map(), dens = [];
  for (const [w, d] of [[w0, d0], [Math.max(2, w0 - 1), Math.max(2, d0 - 1)], [w0 + 1, d0 + 1], [d0 + 2, w0 + 2], [Math.round(w0 * 1.6), Math.round(d0 * 1.6)]]) for (let seed = 1; seed <= 8; seed++) for (const nb of [null, 'hut-kitchen', 'hut-farmyard']) {
    const rooms = [H.mk('r', t.key, 10, 10, w, d, seed * 37 + w, 2)]; if (nb && nb !== t.key) rooms.push(H.mk('n', nb, 10, 6, Math.max(w, 4), 4, seed + 5, 1));
    try { const B = H.build(rooms), L = B.solve('r'); n++; if (L.purposeFail) { fails++; if (fails <= 2) console.log('  FAIL', t.key, w + 'x' + d, 'seed', seed * 37 + w, nb || 'alone', L.purposeFail); } if (!L.paths.every(p => p.ok)) { blocked++; if (blocked <= 2) console.log('  BLOCKED', t.key, w + 'x' + d, 'seed', seed * 37 + w, nb || 'alone', L.paths.filter(p => !p.ok).map(p => p.kind).join(',')); }
      props.push(L.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length); dens.push(L.checks.density.value / L.checks.density.target); for (const u of L.unplaced) un.set(u.id + ':' + u.why, (un.get(u.id + ':' + u.why) || 0) + 1); }
    catch (e) { crash++; if (crash <= 2) console.log('  CRASH', t.key, w + 'x' + d, seed, nb, e.stack.split('\n').slice(0, 4).join(' | ')); } }
  const avg = a => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1);
  console.log(t.key.padEnd(14), 'n', n, 'crash', crash, 'fail', fails, 'blocked', blocked, 'props', avg(props), 'min', Math.min(...props), 'dens/target', avg(dens), '| unplaced:', [...un].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => v + 'x ' + k).join('; ')); }
