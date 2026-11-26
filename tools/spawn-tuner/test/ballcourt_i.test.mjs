// THE MEXICA BALLCOURT READS AS A BALLCOURT (2026-11-07, lane culture-roofs; Harry: "yes do roofs and such"). Blind
// reads called mes-ballcourt a "council chamber": benches round an empty floor, the rings did not carry it. Now (js/
// solver2.js mes-ballcourt, the osides op's ends/rest/across and the ofield op): the I plan, the plastered court with a
// centre line painted across the alley between the rings (Duran: a black or green line), the rubber ball.
//   node test/ballcourt_i.test.mjs [tuner dir]
// The two new meshes (mes-court-endwall, mes-court-ball) are put into the library in memory at their catalog size when
// they have not landed yet (the --fake method of cultures_b.test.mjs), so the program is tested before its meshes.
import { loadTree, makeHarness } from './ccm_lib.mjs';
const S = await loadTree('real'), H = makeHarness(S), { ok, mk } = H;
const FAKE = [['mes-court-endwall', 'ground', '1x2', [120, 24, 48]], ['mes-court-ball', 'floor', 'sub', [10, 10, 10]]];
for (const [id, place, fp, size] of FAKE) if (!S.lib.objects[id]?.skus?.some(k => k.bounds))
  S.lib.objects[id] = { id, desc: id, place, fp, size, scale: [0.9, 1.1], mat: 'stone', aff: [], gen: 'mesh', pri: 'P1', hint: '', var: [], only: ['mes'],
    skus: [{ sku: id, family: '', tier: 'mes', shape: '', kind: 'mesh', url: 'x', bounds: [size[0] / 12, size[2] / 12, size[1] / 12] }] };
const T = S.T['mes-ballcourt'];
ok(T, 'mes-ballcourt is a room type');
ok(T.cells[0] === 16 && T.cells[1] === 6, `the court is 16 x 6 squares (80 x 30 ft, the I plan's room), not ${T.cells}`);
ok(T.floors[0] === 'floor-ind-lime' && T.floors.length === 1, `the whole court is lime-plastered (${T.floors})`);
let n = 0;
const box = (p) => { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)), w = p.dims[0], d = p.dims[2]; return [p.x - (c * w + s * d) / 2, p.z - (s * w + c * d) / 2, p.x + (c * w + s * d) / 2, p.z + (s * w + c * d) / 2]; };
for (const seed of [7301, 11, 4242]) for (const [w, d] of [[16, 6], [6, 16]]) {
  const r = mk('r', 'mes-ballcourt', 10, 10, w, d, seed, 2), B = H.build([r]), L = B.solve('r'), P = L.placements, tag = `${w}x${d} seed ${seed}`;
  const Lx = w >= d, along = (p) => Lx ? p.x : p.z, across = (p) => Lx ? p.z : p.x;
  const xs = P.map(box), X0 = Math.min(...xs.map(b => b[0])), X1 = Math.max(...xs.map(b => b[2])), Z0 = Math.min(...xs.map(b => b[1])), Z1 = Math.max(...xs.map(b => b[3]));
  const cAlong = Lx ? (X0 + X1) / 2 : (Z0 + Z1) / 2, cAcross = Lx ? (Z0 + Z1) / 2 : (X0 + X1) / 2;
  const benches = P.filter(p => /^mes-court-(wall|ring)$/.test(p.id)), rings = P.filter(p => p.id === 'mes-court-ring'), ends = P.filter(p => p.id === 'mes-court-endwall');
  const sides = [benches.filter(p => across(p) < cAcross), benches.filter(p => across(p) > cAcross)];
  ok(L.purposeFail == null, `${tag}: it solves (${L.purposeFail})`);
  ok(sides.every(s => s.length >= 3 && s.length % 2 === 1), `${tag}: an odd run of bench sections down each side of the alley (${sides.map(s => s.length)})`);
  ok(rings.length === 2 && rings.every(p => Math.abs(along(p) - cAlong) < 0.1) && Math.abs(across(rings[0]) - across(rings[1])) > 10, `${tag}: a ring on each bench, both at mid-court, facing each other (${rings.map(p => [p.x, p.z])})`);
  // the I: end-zone walls beyond both ends of each bench run, and across both short ends; the end zones are wider than the alley
  const bAlong = benches.map(along), lo = Math.min(...bAlong), hi = Math.max(...bAlong);
  const m = (a) => ((a % Math.PI) + Math.PI) % Math.PI, sideEnds = ends.filter(p => Math.abs(m(p.rot) - m(benches[0].rot)) < 0.01), acrossEnds = ends.filter(p => !sideEnds.includes(p));
  ok(sideEnds.length === 4 && sideEnds.every(p => along(p) < lo - 4 || along(p) > hi + 4), `${tag}: low walls on the end zones' long sides, beyond the benches (${sideEnds.length})`);
  ok(acrossEnds.length >= 2 && new Set(acrossEnds.map(p => Math.sign(along(p) - cAlong))).size === 2, `${tag}: low walls across both ends (${acrossEnds.length})`);
  const inner = (ps) => { const a = ps.filter(p => across(p) < cAcross), b = ps.filter(p => across(p) > cAcross); if (!a.length || !b.length) return null;
    const bb = (p) => { const q = box(p); return Lx ? [q[1], q[3]] : [q[0], q[2]]; }; return Math.min(...b.map(p => bb(p)[0])) - Math.max(...a.map(p => bb(p)[1])); };
  const alleyW = inner(benches), endW = inner(sideEnds);
  ok(alleyW != null && endW != null && endW >= alleyW + 6, `${tag}: the end zones are wider than the alley (the I): ${endW?.toFixed(1)} ft vs ${alleyW?.toFixed(1)} ft`);
  // the centre line: across the alley at mid-court, on the rings' line, from bench to bench
  const line = P.find(p => p.id === 'decal-mes-court-line');
  ok(line && Math.abs(along(line) - cAlong) < 0.1 && Math.abs(Math.abs(Math.sin(line.rot)) - (Lx ? 1 : 0)) < 0.01 && line.dims[0] >= 0.85 * alleyW, `${tag}: the centre line is painted across the alley between the rings, bench to bench (${line && [line.x, line.z, line.rot.toFixed(2), line.dims[0]]})`);
  const ball = P.find(p => p.id === 'mes-court-ball');
  ok(ball && along(ball) > lo - 5 && along(ball) < hi + 5 && Math.abs(across(ball) - cAcross) < alleyW / 2, `${tag}: the rubber ball lies in the alley (${ball && [ball.x, ball.z]})`);
  // nothing of the court overlaps (the sections touch end to end)
  const solid = [...benches, ...ends]; let over = 0;
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) { const a = box(solid[i]), b = box(solid[j]); const ix = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), iz = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (ix > 0.15 && iz > 0.15) over++; }
  ok(over === 0, `${tag}: no two court pieces overlap (${over})`);
  n++;
}
console.log(`ballcourt I: ${n} courts solved and checked`);
H.report?.('ballcourt_i');
