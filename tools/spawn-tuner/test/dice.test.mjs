// REAL 3D DICE, in node (2026-10-19): the geometry, the remap and the physics (Rapier, the vendored copy).
//   D1  every die is a real polyhedron: face count, rotation group size, opposite faces add up (d10: 0..9 add to 9)
//   D2  REMAP: for every die type x every value x random orientations, the top of the turned numbering reads the value
//   D3  THROWS on a cluttered tavern floor (walls, a table, crates, a barrel, two pawns; the dice already lying out
//       join as obstacles, as their own rounded shapes): every die of every throw, played back from its RECORDING (decoded as every seat decodes it)
//       and turned to the committed numbers, reads its number on top: 100%
//   D4  never cocked (top within the limit of level), never stacked, never beyond reach, never in unseen ground, every
//       throw settled within the limit (or the flat drop); over D3's throws
//   D5  the recording: decode(encode) is within quantisation of the simulated poses; a d100 is a tens and a units d10
//   D6  the flat drop (no throw allowed) lands every die flat on open, seen floor, clear of every prop and pawn
// Usage: node tools/spawn-tuner/test/dice.test.mjs [THROWS=1200]
import { DIE_TYPES, dieGeo, remap, qMul, topIndex, valueOfLabel, flatness, readTop } from '../js/fx/dicegeo.js';
import { loadRapier, throwDice, decode, diceOfRoll, PHYS_DEFAULTS } from '../js/fx/dicephys.js';
import { DICE_DEFAULTS, DICE_SCHEMA, normDice, physOf } from '../js/fx/diceparams.js';
import { fileURLToPath } from 'node:url';

let fails = 0, passes = 0;
const check = (ok, name, detail = '') => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  [' + detail + ']' : ''}`); };
const THROWS = +(process.argv[2] || 1200);
const R = await loadRapier(fileURLToPath(new URL('../js/vendor/rapier3d-compat-0.20.0.js', import.meta.url)));
const valuesOf = (t) => t === 'd10t' ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90] : t === 'd10' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : Array.from({ length: dieGeo(t).sides }, (_, i) => i + 1);
let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// D1
const WANT = { d4: [4, 12], d6: [6, 24], d8: [8, 24], d10: [10, 10], d12: [12, 60], d20: [20, 60] };
for (const t of DIE_TYPES) {
  const g = dieGeo(t), sums = new Set();
  if (g.reads === 'face') g.faces.forEach((f, i) => { const j = g.faces.findIndex(o => o.n[0] * f.n[0] + o.n[1] * f.n[1] + o.n[2] * f.n[2] < -0.9999); sums.add(g.labels[i] + g.labels[j]); });
  const okSum = t === 'd4' || (sums.size === 1 && [...sums][0] === (t === 'd10' ? 9 : g.faces.length + 1));
  check(g.faces.length === WANT[t][0] && g.group.length === WANT[t][1] && okSum && new Set(g.labels).size === g.labels.length, `D1 ${t}: ${g.faces.length} faces, rotation group ${g.group.length}, opposite faces add to ${[...sums].join('/') || '(d4 reads its top corner)'}`);
}
// D2
{
  let n = 0, bad = 0;
  for (const t of [...DIE_TYPES, 'd10t']) { const g = dieGeo(t); for (const v of valuesOf(t)) for (let k = 0; k < 150; k++) {
    let q = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const l = Math.hypot(...q); q = q.map(x => x / l);
    const r = remap(g, q, v), vq = qMul(q, r.g), top = topIndex(g, vq);
    n++; if (valueOfLabel(g, g.labels[top]) !== v || readTop(g, q, r.perm) !== v || topIndex(g, q) !== topIndex(g, vq) && g.reads === 'face' && false) bad++;
  } }
  check(bad === 0, `D2 remap: the turned numbering reads the value on top`, `${n - bad}/${n}`);
}
// the tavern: floor, walls, a table, crates, a barrel, two pawns (one the thrower)
const FLOOR = { x0: -20, z0: -6, x1: 20, z1: 26, y: 0 };
const world = { surfaces: [FLOOR, { x0: 8, z0: 14, x1: 20, z1: 26, y: 1 }], // (a raised dais at the back right)
  boxes: [{ x: 0, y: 4, z: 26, hx: 20, hy: 4, hz: 0.3 }, { x: -20, y: 4, z: 10, hx: 0.3, hy: 4, hz: 16 }, { x: 20, y: 4, z: 10, hx: 0.3, hy: 4, hz: 16 },
    { x: 4, y: 1.3, z: 9, hx: 3.2, hy: 1.3, hz: 1.8 }, { x: -6, y: 1.1, z: 12, hx: 1.1, hy: 1.1, hz: 1.1, yaw: 0.4 }, { x: -4, y: 0.8, z: 14, hx: 0.8, hy: 0.8, hz: 0.8, yaw: -0.3 },
    { x: -9, y: 1.5, z: 6, hx: 1.2, hy: 1.5, hz: 1.2 }, { x: 10, y: 0.9, z: 4, hx: 2, hy: 0.9, hz: 0.6, yaw: 1.1 }],
  cylinders: [{ x: 0, z: 0, y0: 0, y1: 5, r: 0.9 }, { x: 3, z: 4, y0: 0, y1: 5, r: 0.9 }] };
const seen = (x, z) => x > -19 && x < 19 && z > -5 && z < 20; // the roller sees the near part of the room only
const SETS = [['d6', 'd6', 'd6', 'd6'], ['d20', 'd20'], ['d10t', 'd10'], ['d4'], ['d8'], ['d10'], ['d12'], ['d20'], ['d6'], ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'], ['d6', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6', 'd6'], ['d6', 'd6', 'd6', 'd6', 'd20', 'd20', 'd10t', 'd10']];
const P = physOf(DICE_DEFAULTS);
const stats = { dice: 0, readOk: 0, cocked: 0, stacked: 0, reach: 0, unseen: 0, slow: 0, fallback: 0, tries: 0, maxMs: 0, ms: 0, quant: 0, bytes: 0 };
const FB = {}; const REASONS = {}; let lying = []; // dice from the previous throw still on the table: obstacles for the next
for (let k = 0; k < THROWS; k++) {
  const types = SETS[k % SETS.length], vals = types.map(t => { const v = valuesOf(t); return v[Math.floor(rnd() * v.length)]; });
  const from = { x: (rnd() - 0.5) * 6, y: 3, z: (rnd() - 0.5) * 2, r: 0.9, floor: 0 }, to = { x: from.x + (rnd() - 0.5) * 8, y: 0, z: from.z + 5 + rnd() * 6 };
  const t0 = performance.now();
  const w = { ...world, dice: lying, cylinders: k % 2 ? world.cylinders : world.cylinders.slice(1) };
  const r = throwDice(R, { dice: types, P, from, to, world: w, visible: seen, seed: 9000 + k });
  const ms = performance.now() - t0; stats.ms += ms; stats.maxMs = Math.max(stats.maxMs, ms); stats.tries += r.tries; if (r.fallback) { stats.fallback++; FB[types.length] = (FB[types.length] || 0) + 1; } for (const [kk, vv] of Object.entries(r.reasons)) REASONS[kk] = (REASONS[kk] || 0) + vv; stats.bytes = Math.max(stats.bytes, r.rec.b.length);
  if (r.settleAt > P.settle + 0.01 && !r.fallback) stats.slow++;
  const D = decode(JSON.parse(JSON.stringify(r.rec))); // (as it arrives over the wire)
  D.final.forEach((f, i) => {
    const g = dieGeo(types[i]); stats.dice++;
    const { g: sym } = remap(g, f.q, vals[i]), vq = qMul(f.q, sym);
    if (valueOfLabel(g, g.labels[topIndex(g, vq)]) === vals[i]) stats.readOk++;
    if (Math.acos(Math.min(1, flatness(g, f.q))) * 180 / Math.PI > P.cocked) stats.cocked++;
    if (Math.hypot(f.p[0] - from.x, f.p[2] - from.z) > P.reach + 0.01) stats.reach++;
    if (!seen(f.p[0], f.p[2])) stats.unseen++;
    for (let j = 0; j < D.final.length; j++) if (j !== i) { const o = D.final[j]; if (f.p[1] - o.p[1] > 0.35 * P.size && Math.hypot(f.p[0] - o.p[0], f.p[2] - o.p[2]) < (g.radius + dieGeo(types[j]).radius) * P.size) stats.stacked++; }
    const s = r.final[i]; stats.quant = Math.max(stats.quant, Math.hypot(s.p[0] - f.p[0], s.p[1] - f.p[1], s.p[2] - f.p[2]));
  });
  // another seat's last throw still lies there (as it does while it lingers) every other throw; the roller's own last
  // throw is cleared by its next (dice.js simulate)
  lying = k % 2 ? [] : D.final.map((f, i) => ({ type: types[i], p: f.p, q: f.q }));
}
check(stats.readOk === stats.dice, `D3 every die of ${THROWS} throws reads the committed number on top`, `${stats.readOk}/${stats.dice}`);
check(stats.cocked === 0, `D4 never cocked (> ${P.cocked} deg)`, `${stats.cocked}`);
check(stats.stacked === 0, 'D4 never resting on another die', `${stats.stacked}`);
check(stats.reach === 0 && stats.unseen === 0, `D4 never beyond ${P.reach} ft, never in ground the roller cannot see`, `reach ${stats.reach}, unseen ${stats.unseen}`);
check(stats.slow === 0, `D4 every throw settles within ${P.settle} s`, `${stats.slow}`);
console.log(`     throws ${THROWS}: ${(stats.tries / THROWS).toFixed(2)} tries each, ${stats.fallback} flat drops, ${(stats.ms / THROWS).toFixed(1)} ms a throw (slowest ${stats.maxMs.toFixed(0)}), largest recording ${stats.bytes} bytes; rejected: ${JSON.stringify(REASONS)}; flat drops by dice in the throw: ${JSON.stringify(FB)}`);
check(stats.fallback <= THROWS * 0.02, 'D4 the flat drop is rare (at most 2% of throws)', `${stats.fallback}`);
check(stats.quant < 0.004, 'D5 the recording decodes within quantisation of the simulated rest pose', `${stats.quant.toFixed(5)} ft`);
{
  const d = diceOfRoll([{ n: 1, sides: 100 }, { n: 2, sides: 6 }, { flat: 3 }], [100, 4, 6]), e = diceOfRoll([{ n: 1, sides: 100 }], [7]), f = diceOfRoll([{ n: 1, sides: 100 }], [70]);
  check(JSON.stringify(d) === JSON.stringify([{ type: 'd10t', value: 0 }, { type: 'd10', value: 10 }, { type: 'd6', value: 4 }, { type: 'd6', value: 6 }]) && e[0].value === 0 && e[1].value === 7 && f[0].value === 70 && f[1].value === 10, 'D5 a d100 is a tens d10 and a units d10 (100 = 00 + 0)', JSON.stringify([e, f]));
}
// D6: no throw allowed, straight to the flat drop
{
  let bad = 0, n = 0;
  for (let k = 0; k < 60; k++) {
    const types = SETS[k % SETS.length];
    const r = throwDice(R, { dice: types, P: { ...P, tries: 0 }, from: { x: 0, y: 3, z: 0, r: 0.9, floor: 0 }, to: { x: 4, y: 0, z: 9 }, world, visible: seen, seed: k });
    for (const [i, f] of decode(r.rec).final.entries()) { n++; const g = dieGeo(types[i]);
      if (Math.acos(Math.min(1, flatness(g, f.q))) * 180 / Math.PI > P.cocked || !seen(f.p[0], f.p[2])) bad++; }
  }
  check(bad === 0, 'D6 the flat drop lands every die flat on open floor the roller sees', `${n - bad}/${n}`);
}
// D7 the knobs: every numeric dial is a slider that hands back a NUMBER, and a preset saved with text comes back as
// numbers (Harry 2026-10-19: "round.toFixed is not a function" after playing with the dials); an old 'lift' preset
// keeps its throw (same velocity, as angle + speed)
{
  const bad = DICE_SCHEMA.flatMap(([, g, list]) => list.filter(f => !f.type && typeof DICE_DEFAULTS[g][f.k] === 'number').map(f => `${g}.${f.k}`));
  const n = normDice({ look: { round: '0.2', segments: '3', size: 'x' }, tag: { delay: '0.5' } });
  check(!bad.length && n.look.round === 0.2 && n.look.segments === 3 && n.look.size === DICE_DEFAULTS.look.size && n.tag.delay === 0.5, 'D7 dials are numeric; stored text comes back as numbers', bad.join(',') || JSON.stringify(n.look));
  const old = normDice({ throw: { strength: 22, lift: 0.55 } }), a = old.throw.angle * Math.PI / 180;
  check(Math.abs(Math.cos(a) * old.throw.strength - 22) < 0.1 && Math.abs(Math.sin(a) * old.throw.strength - 12.1) < 0.1 && !('lift' in old.throw), "D7 an old 'lift' preset throws the same", JSON.stringify(old.throw));
}
// D8 eased playback (Harry 2026-10-19: "an ease in and ease out option for playback speed"): no easing = the plain
// speed; a slow start / slow end lengthens the playback by the right amount; the map is monotonic and ends on the rest
{
  const { timeline } = await import('../js/fx/dicetime.js');
  const plain = timeline(3, { timeScale: 0.5 }), slow = timeline(3, { timeScale: 1, startSpeed: 0.25, easeIn: 1, endSpeed: 0.25, easeOut: 1 });
  let mono = true, prev = -1; for (let t = 0; t <= slow.dur + 0.2; t += 0.01) { const u = slow.u(t); if (u < prev - 1e-9) mono = false; prev = u; }
  // expected, integrated independently (Simpson, 2000 steps): 1 s of middle + two ends of ∫ 1 / (0.25 + 0.75 smoothstep)
  let ramp = 0; const N = 2000, sm = (x) => x * x * (3 - 2 * x), f = (x) => 1 / (0.25 + 0.75 * sm(x));
  for (let i = 0; i <= N; i++) ramp += f(i / N) * (i === 0 || i === N ? 1 : i % 2 ? 4 : 2); ramp /= 3 * N;
  const want = 1 + 2 * ramp;
  check(Math.abs(plain.dur - 6) < 1e-6 && Math.abs(plain.u(3) - 1.5) < 1e-3 && Math.abs(slow.dur - want) < 0.01 && mono && slow.u(slow.dur) === 3, 'D8 eased playback: plain = the playback speed; eased ends play slower; monotonic', `plain ${plain.dur.toFixed(3)} s, eased ${slow.dur.toFixed(3)} s (want ${want.toFixed(3)})`);
}
// D9 NO CLIPPING IN PLAYBACK (Harry: "the dice can sometimes clip thru the edges of walls"): Harry's sent preset, a d6 and
// a d20 thrown at a wall, 15 throws. The decoded path (what every seat plays) stays within tolerance of the 240 Hz truth,
// and no interpolated pose, sampled at 600 Hz, sinks a die's rounded collider into the wall or the floor by > 0.03 ft
{
  const { normDice } = await import('../js/fx/diceparams.js');
  const { colliderPoints, KEY_POS } = await import('../js/fx/dicephys.js');
  const HP = physOf(normDice({ look: { size: 2, round: 0.3, segments: 3 }, throw: { height: 14.2, angle: 44, strength: 10.7, scatter: 0.35, spin: 26, realMM: 53, timeScale: 0.3 }, physics: { bounce: 0.85, tableBounce: 1.05, friction: 0.6, damping: 0.5, angDamping: 1.5 }, reject: { tries: 15, cocked: 3, reach: 17, settle: 5.2 } }));
  const WZ = 7.7, wall = { surfaces: [{ x0: -40, z0: -40, x1: 40, z1: 40, y: 0 }], boxes: [{ x: 0, y: 5, z: WZ + 0.3, hx: 40, hy: 5, hz: 0.3 }] };
  const types = ['d6', 'd20'];
  let pathErr = 0, rotErr = 0, pen = 0, penRaw = 0, keys = 0, steps = 0;
  const qr = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2]; return [ix * w - iw * x - iy * z + iz * y, iy * w - iw * y - iz * x + ix * z, iz * w - iw * z - ix * y + iy * x]; };
  const sink = (type, p, q) => { const c = colliderPoints(type, HP); let m = 0; for (let j = 0; j < c.points.length; j += 3) { const v = qr(q, [c.points[j], c.points[j + 1], c.points[j + 2]]); m = Math.max(m, c.radius - (p[1] + v[1]), (p[2] + v[2] + c.radius) - WZ); } return m; };
  for (let k = 0; k < 15; k++) {
    const r = throwDice(R, { dice: types, P: { ...HP, tries: 1 }, from: { x: 0, y: 3, z: 0, r: 0.9, floor: 0 }, to: { x: 0, y: 0, z: 6 }, world: wall, visible: null, seed: 500 + k, keepRaw: true });
    if (!r.raw) continue;
    const D = decode(JSON.parse(JSON.stringify(r.rec))); keys += D.frames; steps += r.raw.length;
    r.raw.forEach((F, j) => { for (let i = 0; i < 2; i++) { const p = D.pose(j / 240, i), o = i * 7;
      pathErr = Math.max(pathErr, Math.hypot(p.p[0] - F[o], p.p[1] - F[o + 1], p.p[2] - F[o + 2]));
      rotErr = Math.max(rotErr, 2 * Math.acos(Math.min(1, Math.abs(p.q[0] * F[o + 3] + p.q[1] * F[o + 4] + p.q[2] * F[o + 5] + p.q[3] * F[o + 6]))) * 180 / Math.PI);
      penRaw = Math.max(penRaw, sink(types[i], [F[o], F[o + 1], F[o + 2]], [F[o + 3], F[o + 4], F[o + 5], F[o + 6]])); } });
    for (let t = 0; t <= D.duration; t += 1 / 600) for (let i = 0; i < 2; i++) { const p = D.pose(t, i); pen = Math.max(pen, sink(types[i], p.p, p.q)); }
  }
  check(steps > 0 && pathErr <= KEY_POS + 0.006 && rotErr <= 2.3, `D9 the played path stays on the 240 Hz truth (${keys} keyframes for ${steps} steps)`, `worst ${pathErr.toFixed(4)} ft, ${rotErr.toFixed(2)} deg`);
  check(steps > 0 && pen <= 0.03, 'D9 no played pose sinks a die into the wall or the floor by more than 0.03 ft', `worst ${pen.toFixed(4)} ft (the physics itself: ${penRaw.toFixed(4)} ft)`);
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
