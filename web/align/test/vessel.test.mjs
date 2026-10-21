// node web/align/test/vessel.test.mjs: synthetic vessels through basin() + footprint()
import { basin, footprint, hull, insetConvex } from '../js/vessel.js';
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
// a 20x12 trough: walls 1 high, floor 0.2, a spout notch at 0.8 on one wall cell, outside = no surface
const nx = 24, nz = 16, H = new Float64Array(nx * nz).fill(NaN);
for (let z = 2; z < 14; z++) for (let x = 2; x < 22; x++) H[z * nx + x] = (x === 2 || x === 21 || z === 2 || z === 13) ? 1 : 0.2;
let B = basin({ nx, nz, H, floorY: 0, minDepth: 0.04 });
check(B && B.cells.length === 18 * 10, `trough interior = 180 cells (got ${B?.cells.length})`);
check(Math.abs(B.rim - 1) < 1e-9 && Math.abs(B.floor - 0.2) < 1e-9, `rim 1, floor 0.2 (got ${B.rim}, ${B.floor})`);
H[2 * nx + 10] = 0.8; B = basin({ nx, nz, H, floorY: 0, minDepth: 0.04 });
check(Math.abs(B.rim - 0.8) < 1e-9, `a spout notch lowers the rim to 0.8 (got ${B.rim})`);
// a closed lid (flat top): nothing pools
const Hc = new Float64Array(nx * nz).fill(NaN); for (let z = 2; z < 14; z++) for (let x = 2; x < 22; x++) Hc[z * nx + x] = 1;
check(basin({ nx, nz, H: Hc, floorY: 0, minDepth: 0.04 }) === null, 'a closed top has no basin');
// footprint of the trough cells: ellipse axes along x, sizes ~ the box
const cells = B.cells.map(i => [i % nx + 0.5, ((i / nx) | 0) + 0.5]);
const fe = footprint(cells, 1, { shape: 'ellipse' });
check(Math.abs(fe.ellipse.rot) < 1e-6 || Math.abs(Math.abs(fe.ellipse.rot) - Math.PI) < 1e-6, `ellipse along x (rot ${fe.ellipse.rot})`);
check(fe.ellipse.r[0] > 9 && fe.ellipse.r[0] < 12.5 && fe.ellipse.r[1] > 5 && fe.ellipse.r[1] < 7, `ellipse semi-axes ~ (10.4, 5.8): ${fe.ellipse.r.map(v => v.toFixed(2))}`);
const fp = footprint(cells, 1, { shape: 'poly', inset: 0.5 });
const xs = fp.poly.map(p => p[0]), zs = fp.poly.map(p => p[1]);
check(Math.abs(Math.min(...xs) - 3.5) < 1e-6 && Math.abs(Math.max(...xs) - 20.5) < 1e-6 && Math.abs(Math.min(...zs) - 3.5) < 1e-6, `poly inset 0.5 from the 3..21 x 3..13 interior: x ${Math.min(...xs)}..${Math.max(...xs)} z ${Math.min(...zs)}..${Math.max(...zs)}`);
check(hull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]).length === 4, 'hull drops interior points');
check(insetConvex([[0, 0], [4, 0], [4, 4], [0, 4]], 1).every(([x, z]) => x === 1 || x === 3), 'square inset by 1');
// rotated ellipse: a diagonal band
const diag = []; for (let i = 0; i < 30; i++) for (let j = -2; j <= 2; j++) diag.push([i + j * 0.5, i - j * 0.5]);
const fd = footprint(diag, 1); check(Math.abs(Math.abs(fd.ellipse.rot) - Math.PI / 4) < 0.05, `diagonal band -> rot 45° (${(fd.ellipse.rot * 180 / Math.PI).toFixed(1)}°)`);
// containment: a disc with a long thin slot (a handle hole) -> the outline shrinks to stay over the disc
const disc = []; for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) if (x * x + z * z <= 64) disc.push([x, z]);
for (let x = 9; x <= 14; x++) disc.push([x, 0]);
const set = new Set(disc.map(([x, z]) => `${x},${z}`)), ins = (x, z) => set.has(`${Math.round(x)},${Math.round(z)}`) && set.has(`${Math.round(x) + 1},${Math.round(z)}`) && set.has(`${Math.round(x) - 1},${Math.round(z)}`);
const raw = footprint(disc, 1), held = footprint(disc, 1, { inside: ins });
const reach = (f) => Math.max(...f.poly.map(([x, z]) => Math.hypot(x, z)));
check(reach(held) <= 8.2 && reach(held) < reach(raw), `the slot does not pull the outline out of the disc (raw ${reach(raw).toFixed(2)}, held ${reach(held).toFixed(2)})`);
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
