// Choreography checks: node tools/spawn-tuner/test/anim.test.mjs
import { schedule, pose, faunaDefaultPreset, defaultPreset, sweepDistance } from '../js/anim.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const P = faunaDefaultPreset(); // fixed reference (NW sweep); the tool default is Harry's
const H = defaultPreset();
const rect = { x0: 0, z0: 0, x1: 30, z1: 20 };
const items = [];
for (let x = 2.5; x < 30; x += 5) for (let z = 2.5; z < 20; z += 5) items.push({ x, z, layer: 'floor' });
items.push({ x: 15, z: 10, layer: 'dress' }, { x: 1, z: 1, layer: 'anchor' });
const side = { ...P.in, choreo: { ...P.in.choreo, jitter: 0 } };
const { delays } = schedule(items, side, rect, null, () => 0);
// NW sweep: tile at NW corner lands first, SE last, among floor tiles
const fl = items.map((it, i) => [it, delays[i]]).filter(([it]) => it.layer === 'floor');
const first = fl.reduce((a, b) => a[1] <= b[1] ? a : b)[0], last = fl.reduce((a, b) => a[1] >= b[1] ? a : b)[0];
ok(first.x === 2.5 && first.z === 2.5, 'NW tile first'); ok(last.x === 27.5 && last.z === 17.5, 'SE tile last');
// waves: more than one tile per wave (Harry: "more than one tile at a time")
const counts = new Map(); fl.forEach(([, d]) => counts.set(d, (counts.get(d) || 0) + 1));
ok([...counts.values()].some(n => n > 1), 'some wave has >1 tile');
// layers in order: every floor tile starts before the anchor, anchor before dress
const dAnchor = delays[items.length - 1], dDress = delays[items.length - 2];
ok(Math.max(...fl.map(f => f[1])) < dAnchor + 2000 && fl[0][1] < dAnchor && dAnchor < dDress, 'layer order floor<anchor<dress');
// perWave cap
const capped = schedule(items, { ...side, choreo: { ...side.choreo, perWave: 2 } }, rect, null, () => 0);
const cc = new Map(); items.forEach((it, i) => it.layer === 'floor' && cc.set(capped.delays[i], (cc.get(capped.delays[i]) || 0) + 1));
ok(Math.max(...cc.values()) <= 2, 'perWave caps wave size');
// out reverse: dress leaves before floor
const out = schedule(items, { ...P.out, choreo: { ...P.out.choreo, jitter: 0 } }, rect, null, () => 0);
ok(out.delays[items.length - 2] < Math.min(...items.map((it, i) => it.layer === 'floor' ? out.delays[i] : 1e9)), 'out: dress leaves first');
// pose endpoints
const m = P.in.objects; const p0 = pose(m, 0), p1 = pose(m, 1);
ok(Math.abs(p0.sx - m.startScale) < 1e-6 && Math.abs(p1.sx - 1) < 1e-6 && p1.ang === 0, 'pose endpoints');
ok(Math.max(...[0.5, 0.6, 0.7, 0.8, 0.9].map(t => pose(m, t).sx)) > 1.01, 'backOut overshoots');
ok(Math.abs(sweepDistance('E', 30, 5, rect) - 0) < 1e-9 && sweepDistance('E', 0, 5, rect) === 30, 'E sweep starts at east edge');
// camera-side walls: start after every other item has started (in); leave before anything else (out)
const withNear = [...items, { x: 15, z: 20, layer: 'walls-near' }, { x: 5, z: 20, layer: 'walls-near' }];
const si = schedule(withNear, side, rect, null, () => 0);
ok(Math.min(si.delays.at(-1), si.delays.at(-2)) > Math.max(...si.delays.slice(0, -2)), 'in: near walls start after all others');
const so = schedule(withNear, { ...P.out, choreo: { ...P.out.choreo, jitter: 0 } }, rect, null, () => 0);
ok(Math.max(so.delays.at(-1), so.delays.at(-2)) + P.out.walls.dur <= Math.min(...so.delays.slice(0, -2)), 'out: near walls gone before others leave');
ok(H.name === 'harry-v2' && H.in.choreo.sweep === 'N' && H.in.objects.spin === -480 && H.out.mirror === false && H.out.objects.dur === 70, 'default preset is harry-v2 (fast out)');
console.log(fails ? `${fails} failures` : 'anim: all checks pass');
process.exit(fails ? 1 : 0);
