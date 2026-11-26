// measure.mjs [tuner dir] [--json out]: the density of every City and Cyberpunk room (default size and the suites' sizes, 6 seeds)
//   props/100 sq ft (what finish() reports), floor coverage (standing footprints / floor), wall-run use (ft of wall with something against it / ft of wall)
import { writeFileSync } from 'node:fs';
import { loadTree, makeHarness, standing, aabb } from '../../tools/spawn-tuner/test/ccm_lib.mjs';
const S = await loadTree('m'), H = makeHarness(S), { mk } = H;
const out = process.env.OUT || null;
const KEYS = S.types.filter(t => (process.env.KEYS||'').split(',').includes(t.key)).map(t => t.key);
const res = {};
for (const k of KEYS) {
  const T = S.T[k], sizes = [T.cells, [T.cells[0] + 2, T.cells[1] + 2], [Math.max(4, T.cells[0] - 1), Math.max(4, T.cells[1] - 1)]];
  const R = res[k] = { target: null, rows: [] };
  for (const [w, d] of sizes) for (let seed = 1; seed <= 6; seed++) {
    const B = H.build([mk('r', k, 10, 10, w, d, seed * 137 + w * 5 + d, 1)]), L = B.solve('r');
    const r = B.rooms[0], walk = S.s2.audit(L, { lib: S.lib, type: S.T[k], room: r, openings: B.E.openings.get('r'), opts: { orient: S.orient, minStars: 3, hideMasking: true } }).walkable;
    const A = L.room.feet[0] * L.room.feet[1], fl = standing(L).filter(p => p.rule !== 'yard-edge');
    const cov = fl.reduce((a, p) => { const [aw, ad] = aabb(p); return a + aw * ad; }, 0) / ((L.room.feet[0] - 1) * (L.room.feet[1] - 1));
    R.target = L.checks.density.target;
    R.rows.push({ w, d, seed, fail: L.purposeFail || null, n: L.placements.length, density: L.checks.density.value, cov: +cov.toFixed(3), paths: L.paths.every(p => p.ok), walk });
  }
}
for (const [k, R] of Object.entries(res)) {
  const def = R.rows.filter(r => r.w === S.T[k].cells[0] && r.d === S.T[k].cells[1]);
  const m = (a, f) => (a.reduce((s, r) => s + f(r), 0) / a.length);
  console.log(k.padEnd(15), `target ${String(R.target).padEnd(4)} default ${S.T[k].cells.join('x')}: density ${m(def, r => r.density).toFixed(2)} cov ${(100 * m(def, r => r.cov)).toFixed(0)}% n ${m(def, r => r.n).toFixed(1)} | all sizes: density ${m(R.rows, r => r.density).toFixed(2)} cov ${(100 * m(R.rows, r => r.cov)).toFixed(0)}% fails ${R.rows.filter(r => r.fail).length} blocked ${R.rows.filter(r => !r.paths).length} walk ${m(R.rows, r => r.walk).toFixed(2)}`);
}
if (out) writeFileSync(out, JSON.stringify(res, null, 1));
