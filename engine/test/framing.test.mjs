// Area-thumbnail framing (core/framing.js): the structures' box, outliers dropped only when spread out; the 3/4 camera fit.
import { structureBox, fitDistance } from '../core/framing.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const R = (x, z, w, d) => ({ x0: x * 5, z0: z * 5, x1: (x + w) * 5, z1: (z + d) * 5 });

// a compact inn: everything framed
const inn = [R(0, 0, 6, 4), R(6, 0, 4, 4), R(0, 4, 4, 3), R(4, 4, 6, 3)];
const b1 = structureBox(inn);
ok(b1.x0 === 0 && b1.z0 === 0 && b1.x1 === 50 && b1.z1 === 35 && b1.kept === 4, 'a compact building: the box is all of it');
// the inn plus a small shed far away: the shed is dropped (box shrinks a lot, >= 85% of the area still covered)
const spread = [...inn, R(40, 30, 2, 2)];
const b2 = structureBox(spread);
ok(b2.x1 === 50 && b2.z1 === 35 && b2.kept === 4 && b2.cover >= 0.85, `a far outlier is dropped (${JSON.stringify(b2)})`);
// two equal buildings far apart: neither can be dropped (each is half the structure area)
const twin = [R(0, 0, 6, 4), R(40, 0, 6, 4)];
const b3 = structureBox(twin);
ok(b3.x0 === 0 && b3.x1 === 230 && b3.kept === 2, 'two big buildings far apart: both stay (each is too much of the area to drop)');
// a small room at the corner of a big hall is not an outlier (dropping it barely shrinks the box)
const hall = [R(0, 0, 12, 8), R(12, 0, 2, 2)];
ok(structureBox(hall).kept === 2, 'a small room hugging a hall stays');
ok(structureBox([]) === null, 'no rooms: no box');

// the fit: every corner of the box (10 ft tall) projects inside the frame, and a corner touches the margin
const fit = fitDistance(b1, { yaw: -20, pitch: 52, fovDeg: 45, aspect: 1.6, h: 10, margin: 0.06 });
const Y = -20 * Math.PI / 180, P = 52 * Math.PI / 180;
const back = [Math.sin(Y) * Math.cos(P), Math.sin(P), Math.cos(Y) * Math.cos(P)];
const cam = [fit.focus[0] + back[0] * fit.dist, back[1] * fit.dist, fit.focus[2] + back[2] * fit.dist];
const fwd = back.map(v => -v), right = (() => { const c = [fwd[1] * 0 - fwd[2] * 1, fwd[2] * 0 - fwd[0] * 0, fwd[0] * 1 - fwd[1] * 0]; const l = Math.hypot(...c); return c.map(v => v / l); })();
const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
const t = Math.tan(22.5 * Math.PI / 180);
let maxX = 0, maxY = 0;
for (const x of [b1.x0, b1.x1]) for (const z of [b1.z0, b1.z1]) for (const y of [0, 10]) {
  const p = [x - cam[0], y - cam[1], z - cam[2]], depth = p[0] * fwd[0] + p[1] * fwd[1] + p[2] * fwd[2];
  maxX = Math.max(maxX, Math.abs(p[0] * right[0] + p[1] * right[1] + p[2] * right[2]) / depth / (t * 1.6));
  maxY = Math.max(maxY, Math.abs(p[0] * up[0] + p[1] * up[1] + p[2] * up[2]) / depth / t);
}
ok(maxX <= 0.9401 && maxY <= 0.9401 && Math.max(maxX, maxY) > 0.93, `the 3/4 fit: every corner inside, the tightest at the 6% margin (x ${maxX.toFixed(3)}, y ${maxY.toFixed(3)})`);
const far = fitDistance(b2, {}), near = fitDistance(b1, {});
ok(Math.abs(far.dist - near.dist) < 1e-9, 'dropping the outlier means the picture is framed exactly as the inn alone');
console.log(`framing: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
