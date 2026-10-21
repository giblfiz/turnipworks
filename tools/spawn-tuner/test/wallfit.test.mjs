// The Wall fit bench's pure part (js/wallfit.js): node tools/spawn-tuner/test/wallfit.test.mjs
// stretch maths against kitScale, tolerances, seam maths against a deliberately mis-scaled fixture piece, openings from a
// raster, the snap guess closing the fixture's gap, records <-> table <-> status, and look.js's applyFit leaving no-fit alone.
import * as W from '../js/wallfit.js';
import { kitScale } from '../js/solver.js';
import { applyFit, fitIsIdentity, FIT_NONE } from '../js/wallfit.js';
import { readFileSync } from 'node:fs';
const here = new URL('..', import.meta.url).pathname, lib = JSON.parse(readFileSync(here + 'data/library.json')), orient = JSON.parse(readFileSync(here + 'data/orient.json'));
let checks = 0, fails = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// families and pieces from the real library
const fams = W.families(lib);
ok(fams.length >= 15 && fams.includes('dressed-stone') && fams.includes('rough-timber') && fams.includes('crypt-stone'), `families ${fams}`);
let nPieces = 0;
for (const f of fams) {
  const ps = W.piecesOfFamily(lib, orient, f); nPieces += ps.length;
  ok(ps.some(p => p.role === 'straight'), `${f} has a straight`);
  for (const p of ps) {
    const ks = kitScale(p.size[0] / 12, p.size[1] / 12, p.size[2] / 12, p.bounds, p.yaw);
    ok(p.s.every((v, i) => near(v, ks[i])), `${p.sku} stretch equals kitScale`);
    ok(p.aniso >= 1 && p.u > 0, `${p.sku} aniso/u`);
  }
}
ok(nPieces > 50, `pieces ${nPieces}`);
// the known janky meshes are flagged from the data alone
const ds = W.stretchFlags(W.piecesOfFamily(lib, orient, 'dressed-stone')).flatMap(x => x.flags);
ok(ds.some(f => f.kind === 'stretch' && f.sev === 'bad' && f.sku === 'wall-straight--dressed-stone'), 'dressed-stone straight flagged as pulled out of shape');
const cs = W.stretchFlags(W.piecesOfFamily(lib, orient, 'conservatory')).flatMap(x => x.flags);
ok(W.score(cs) < W.score(ds), 'a well-made family scores lower than a janky one');
// judge
ok(W.judge(0.9, 1) === 'ok' && W.judge(-1.5, 1) === 'warn' && W.judge(2.5, 1) === 'bad' && W.judge(1, 1) === 'ok', 'judge levels');
// seams: a clean run is clean, a mis-scaled piece is flagged on both sides
const run = (len, y1 = 108, c1 = 6) => ({ a0: 0, a1: len, c0: c1 - 12, c1, y0: 0, y1 });
const shift = (f, d) => ({ ...f, a0: f.a0 + d, a1: f.a1 + d });
const A = run(60), B = shift(run(60), 60);
let r = W.seamH(A, B); ok(near(r.gap, 0) && near(r.stepIn, 0) && near(r.top, 0), 'clean joint');
const fixture = shift(run(60 * 1.1, 108 * 0.95), 60);  // a piece scaled 110% long, 95% tall (the mis-scaled fixture)
r = W.seamH(A, fixture); ok(W.judge(r.top, W.TOL.height) === 'bad' && near(r.top, -5.4, 1e-6), 'mis-scaled fixture: top step');
const next = shift(run(60), 60 + 66); r = W.seamH(fixture, next); ok(near(r.gap, 0), 'fixture then next: gap 0 only because it was placed after it');
const crowd = shift(run(60), 60 + 60); r = W.seamH(fixture, crowd); ok(r.gap < -5.9 && W.judge(r.gap, W.TOL.seam) === 'bad', `overlap ${r.gap}`);
ok(W.seamPost(run(60), { a0: 56, a1: 64 }, 'a1').hole <= 0 && W.seamPost(run(50), { a0: 56, a1: 64 }, 'a1').hole === 6, 'wall short of a post is a hole');
const sv = W.seamV(108, 108, 119.76, 120); ok(near(sv.toSlab, 0) && near(sv.fromSlab, 0.24, 1e-9), 'storey seam maths');
// openings from a raster: a 40 x 80 in doorway in a 60 x 108 panel; a 14 x 30 window
const W60 = 60, H108 = 108, solid = (x0, x1, y0, y1) => [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1];
let tris = [...solid(0, 10, 0, 108), ...solid(50, 60, 0, 108), ...solid(10, 50, 80, 108)];
let g = W.rasterize(tris, W60, H108), d = W.doorOpening(g, W60, H108, 30);
ok(d && d.w === 40 && d.top === 80, `door opening ${JSON.stringify(d)}`);
tris = [...solid(0, 60, 0, 108)]; tris = [...solid(0, 60, 0, 50), ...solid(0, 60, 80, 108), ...solid(0, 20, 50, 80), ...solid(36, 60, 50, 80)];
g = W.rasterize(tris, W60, H108); const wo = W.windowOpening(g, W60, H108); ok(wo && wo.w === 16 && wo.h === 30 && wo.y0 === 50, `window opening ${JSON.stringify(wo)}`);
ok(W.windowOpening(W.rasterize(solid(0, 60, 0, 108), W60, H108), W60, H108) === null, 'a closed panel has no window opening');
// snap: the fixture (scaled 110% along, offset by 3 in) comes back to 60 in with its base on the floor; cur correction multiplies on
const have = { x: [-33 + 3, 33 + 3], y: [0, 102.6], z: [-6, 6] }, want = { x: [-30, 30], y: [0, 108], z: [-6, 6] };
const f1 = W.snapFit({ s: [1.1, 0.95, 1], o: [0.25, 0, 0], yaw: 0 }, have, want, 'xyz');
ok(near(f1.s[0], 1.1 * 60 / 66, 1e-4) && near(f1.s[1], 0.95 * 108 / 102.6, 1e-4) && near(f1.s[2], 1, 1e-6), `snap scales ${f1.s}`);
// apply the proposal to the box by hand: the new box fills the want box
const p0 = 0.25 * 12, rx = 60 / 66, lo = p0 + rx * (have.x[0] - p0) + (f1.o[0] - 0.25) * 12; ok(near(lo, -30, 1e-3), `snap offset puts the low face at -30 (got ${lo})`);
const f2 = W.snapFit(null, { x: [0, 10], y: [0, 100], z: [0, 5] }, { x: [0, 10], y: [0, 108], z: [0, 5] }, 'y'); ok(near(f2.s[1], 1.08) && f2.s[0] === 1 && f2.s[2] === 1 && f2.o.every(v => v === 0), 'axes limit what scales');
ok(W.isIdentity(null) && W.isIdentity({ s: [1, 1, 1], o: [0, 0, 0], yaw: 0 }) && !W.isIdentity({ s: [1, 1.02, 1] }), 'identity');
// records <-> state <-> the game's table
const recs = { 'wall-straight--x': { at: 't1', data: { sku: 'wall-straight--x', family: 'x', s: [1, 1.1, 1], o: [0, 0, 0.01], yaw: 0, approved: false, mark: { note: 'too tall' } } }, 'wall-window--x': { at: 't2', data: { sku: 'wall-window--x', family: 'x', s: [1, 1, 1], o: [0, 0, 0], yaw: 0, approved: true, mark: null } }, 'family/x': { at: 't3', data: { family: 'x', approved: true, scan: { score: 3 } } } };
const st = W.stateFromRecords(recs);
ok(st.pieces['wall-straight--x'].mark.note === 'too tall' && st.pieces['wall-window--x'].approved && st.fams.x.approved, 'records -> state');
const tab = W.gameTable(st.pieces); ok(Object.keys(tab).length === 1 && tab['wall-straight--x'].s[1] === 1.1, 'the game gets only the corrections that change something');
ok(W.familyStatus('x', ['wall-straight--x', 'wall-window--x'], st).status === 'approved' && W.familyStatus('y', ['q'], st).status === 'unreviewed', 'family status');
const st2 = W.stateFromRecords({ 'wall-straight--x': recs['wall-straight--x'] }); ok(W.familyStatus('x', ['wall-straight--x'], st2).status === 'marks', 'a marked piece makes the family "marks"');
// look.js: no correction = no change; applyFit composes
const m = { scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } }, rotation: { y: 0 }, position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } } };
applyFit(m, { s: [2, 3, 4], yaw: 0.5, pos: [0, 0, 0] }, null); ok(m.scale.x === 2 && m.scale.y === 3 && m.scale.z === 4 && m.rotation.y === 0.5 && m.position.y === 0, 'no fit: exactly the base');
applyFit(m, { s: [2, 3, 4], yaw: 0.5, pos: [0, 0, 0] }, { s: [1.5, 1, 1], o: [0, 0.1, 0], yaw: 90 }); ok(m.scale.x === 3 && near(m.rotation.y, 0.5 + Math.PI / 2) && near(m.position.y, 0.1), 'fit applied');
ok(fitIsIdentity(FIT_NONE) && fitIsIdentity(undefined) && !fitIsIdentity({ yaw: 3 }), 'wallfit.js identity');
// the floor slab's plan (engine/core/height.js slabRects): runs 6 in past the grid line on a room's outer edge, stays on the line at an inside side
import { slabRects, SLAB_RIM } from '../../../engine/core/height.js';
{ const one = slabRects(3, 2, null, null, 5); ok(one.length === 1 && near(one[0][0], -SLAB_RIM) && near(one[0][2], 15 + SLAB_RIM) && near(one[0][3], 10 + SLAB_RIM) && SLAB_RIM === 0.5, 'slab: a plain rectangle runs 6 in past all four edges');
  const L = [[0, 0], [1, 0], [0, 1]], rs = slabRects(2, 2, L, null, 5); ok(rs.length === 3 && rs.find(r => near(r[0], -0.5) && near(r[1], -0.5) && near(r[2], 5) && near(r[3], 5)), 'slab: an L room keeps the inside sides on the line, outer sides out');
  const hole = slabRects(3, 1, null, (i) => i === 1, 5); ok(hole.length === 2 && near(hole[0][2], 5) && near(hole[1][0], 10) && near(hole[0][0], -0.5) && near(hole[1][2], 15.5), 'slab: a stair\'s hole is left open: its sides are not pushed out into it');
  const row = slabRects(2, 1, [[0, 0], [1, 0]], null, 5); ok(row.every(r => near(r[3], 5.5) && near(r[1], -0.5)) && near(row[0][2], 5) && near(row[1][0], 5), 'slab: two cells of one room meet on the line'); }
console.log(`wallfit: ${checks - fails}/${checks} checks passed`); process.exit(fails ? 1 : 0);
