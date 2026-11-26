// Why a spot is refused: logs every fits() call near a point while one City room is solved.
//   node experiments/2026-11-06-sprawl/integration/dbg_fits.mjs tools/spawn-tuner mod-bar 12 8 354 60.14,62
import { loadTree, makeHarness } from '../../../tools/spawn-tuner/test/ccm_lib.mjs';
const S = await loadTree('mod'), H = makeHarness(S);
const [key, w, d, seed, pt] = process.argv.slice(3), [px, pz] = pt.split(',').map(Number);
const C = S.s1.Ctx.prototype, fits = C.fits;
C.fits = function (x, z, aw, ad, keep) { const r = fits.call(this, x, z, aw, ad, keep); if (Math.hypot(x - px, z - pz) < 0.6) { const [i0, i1, j0, j1] = this.cells(x, z, aw, ad); const vals = []; for (let j = Math.max(0, j0); j < Math.min(this.nz, j1); j++) for (let i = Math.max(0, i0); i < Math.min(this.nx, i1); i++) vals.push(this.grid[j * this.nx + i]); console.log('fits', x.toFixed(2), z.toFixed(2), aw.toFixed(2), ad.toFixed(2), 'keep', keep, '->', r, 'cells', [i0, i1, j0, j1], 'nx', this.nx, 'nz', this.nz, 'vals', [...new Set(vals)], 'X0', this.X0, 'X1', this.X1); } return r; };
const B = H.build([H.mk('r', key, 10, 10, +w, +d, +seed, 1)]), L = B.solve('r');
console.log(JSON.stringify(L.modInfo));
