// Computed roofs: pure geometry checks (node test/roofs.test.mjs). engine/client/roofs.js planRoofs.
import { planRoofs, coverAt, resolveKit, ROOF_DEFAULTS, sectionLayout, slideProp, GABLE, ROOF_STYLES, flatSurfaceOf, TURRET } from '../client/roofs.js';
import { roofStyleOf, roofProblem, ROOF_STYLE_KEYS } from '../core/height.js';
import * as HT from '../core/height.js';
import { cellsOf } from '../core/footprint.js';

let pass = 0, fail = 0;
const check = (name, ok, ev = '') => { if (ok) pass++; else { fail++; console.log('FAIL ' + name + (ev ? '  [' + ev + ']' : '')); } };
const cellsFt = (r) => cellsOf(r).map(([i, j]) => [r.x + i, r.z + j]);
// sample every cell of every room at 9 points kept 1.3 ft clear of the cell's edges (the overhang is 1 ft)
function coverage(plan, rooms, { skip = () => false } = {}) {
  let bad = 0, n = 0, worst = '';
  for (const r of rooms) for (const [gx, gz] of cellsFt(r)) for (const dx of [1.31, 2.43, 3.77]) for (const dz of [1.39, 2.59, 3.67]) {
    const x = gx * 5 + dx, z = gz * 5 + dz; if (skip(r, gx, gz)) continue; n++;
    const c = coverAt(plan, x, z); if (c !== 1) { bad++; worst ||= `${r.id} (${x}, ${z}) covered ${c}x`; }
  }
  return { bad, n, worst };
}
const room = (id, x, z, w, d, more = {}) => ({ id, building: 'b1', x, z, w, d, top: 9, y: 0, style: 'thatch', seed: 7, ...more });
const exact = (name, rooms, opts) => { const plan = planRoofs(rooms, opts); const c = coverage(plan, rooms); check(`${name}: every cell roofed exactly once`, c.bad === 0 && c.n > 0, `${c.bad}/${c.n} ${c.worst}`); return plan; };

// ---- rectangles ----
{
  const plan = exact('rectangle 6x4', [room('a', 0, 0, 6, 4)]);
  const r = plan.roofs[0];
  check('gable by default, ridge along the long side (x)', r.kind === 'gable' && r.axis === 'x', `${r.kind} ${r.axis}`);
  check('ridge height = top + half span (45 degrees)', Math.abs(r.ridgeY - (9 + 10)) < 1e-6 && r.planes.every(p => Math.abs(p.pitch - 45) < 1e-9), r.ridgeY);
  check('two gable ends', r.gables.length === 2, r.gables.length);
  check('eaves at the wall top, overhang 1 ft below it', Math.abs(Math.min(...r.planes.flatMap(p => p.poly.map(q => q[1]))) - (9 - 1)) < 1e-6);
  check('the overhang reaches 1 ft past the wall line', Math.abs(Math.min(...r.planes.flatMap(p => p.poly.map(q => q[2]))) + ROOF_DEFAULTS.overhang) < 1e-9);
  check('ridge places to stand: one per cell along it', r.standable.filter(s => s.kind === 'ridge').length === 6);
  check('uv: eaves at v = 0, v grows up the slope', r.planes.every(p => p.poly.every((q, i) => (p.uv[i][1] > 0.01) === (q[1] > 9.01))));
  const tall = planRoofs([room('a', 0, 0, 3, 7)]).roofs[0];
  check('ridge along the long side (z)', tall.axis === 'z');
  const wide = planRoofs([room('a', 0, 0, 10, 8)]).roofs[0];
  check('a room wider than 30 ft is capped at 15 ft of rise', Math.abs(wide.ridgeY - 24) < 1e-6, wide.ridgeY);
  exact('hip 6x4', [room('a', 0, 0, 6, 4, { kind: 'hip' })]);
  const hip = planRoofs([room('a', 0, 0, 6, 4, { kind: 'hip' })]).roofs[0];
  check('a hip has four faces and no gable wall', new Set(hip.planes.map(p => p.face)).size === 4 && hip.gables.length === 0);
  exact('flat 3x3', [room('a', 0, 0, 3, 3, { style: 'flat' })]);
  const flat = planRoofs([room('a', 0, 0, 3, 3, { style: 'flat' })]).roofs[0];
  check('flat: walking surface at top + 1, nine places to stand, a slab side on every outer edge', flat.planes.every(p => p.poly.every(q => q[1] === 10)) && flat.standable.length === 9 && flat.skirts.length === 12);
}
// ---- an L (one room, outline), each way round ----
for (const [name, outline] of [['L', [[0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]]], ['L leg right', [[0, 0], [6, 0], [6, 6], [4, 6], [4, 3], [0, 3]]], ['U', [[0, 0], [7, 0], [7, 5], [5, 5], [5, 2], [2, 2], [2, 5], [0, 5]]], ['notch', [[0, 0], [6, 0], [6, 4], [4, 4], [4, 3], [2, 3], [2, 4], [0, 4]]]]) {
  const w = Math.max(...outline.map(p => p[0])), d = Math.max(...outline.map(p => p[1]));
  const rooms = [room('a', 2, -1, w, d, { outline })], plan = exact(name, rooms);
  const notch = []; for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (!cellsOf(rooms[0]).some(([a, b]) => a === i && b === j)) notch.push([(2 + i) * 5 + 2.5, (-1 + j) * 5 + 2.5]);
  check(`${name}: nothing over the middle of the notch`, notch.every(([x, z]) => coverAt(plan, x, z) === 0), notch.length);
}
// ---- joined rooms ----
{
  const L = planRoofs([room('l', 0, 0, 6, 6, { outline: [[0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]] })]).roofs[0];
  check("an L's square leg points its ridge at the main part (a cross gable, no gutter between parallel ridges)", L.ridges.some(r => Math.abs(r.a[0] - r.b[0]) < 1e-6 && Math.max(r.a[2], r.b[2]) > 29) && L.gables.length === 3, JSON.stringify(L.ridges));
  const tw = planRoofs([room('tower', 0, 0, 3, 3, { style: 'flat', top: 19 }), room('lean', 3, 0, 3, 3)]).roofs[0];
  check('a flat tower keeps its whole ledge above a lower neighbour (12 parapets, 4 piers)', tw.props.filter(p => p.role === 'parapet').length === 12 && tw.props.filter(p => p.role === 'corner').length === 4, tw.props.map(p => p.role).join());

  // in a line, same width: one ridge, no wall between
  const plan = exact('two in a line', [room('a', 0, 0, 5, 4), room('b', 5, 0, 4, 4)]);
  check('in a line: no gable wall where they meet (2 gable ends in all)', plan.roofs.reduce((n, r) => n + r.gables.length, 0) === 2, plan.roofs.map(r => r.gables.length).join(','));
  check('in a line: the ridge is one height across the join', Math.abs(plan.heightAt(24.9, 10) - plan.heightAt(25.1, 10)) < 1e-6);
  // a T: the stem's end meets the bar's side
  const T = [room('bar', 0, 0, 8, 4), room('stem', 3, 4, 2, 5)], tp = exact('a T', T);
  const stem = tp.roofs.find(r => r.room === 'stem'), bar = tp.roofs.find(r => r.room === 'bar');
  check('T: the stem has one gable end (the free one)', stem.gables.length === 1 && bar.gables.length === 2, `${stem.gables.length} ${bar.gables.length}`);
  check('T: the stem runs on into the bar (its roof reaches past the join)', Math.min(...stem.planes.flatMap(p => p.poly.map(q => q[2]))) < 20 - 1, Math.min(...stem.planes.flatMap(p => p.poly.map(q => q[2]))));
  check('T: the stem dies into the bar below the bar\'s ridge', stem.ridgeY < bar.ridgeY && Math.abs(tp.heightAt(20, 10) - bar.ridgeY) < 1e-6);
  check('T: continuous at the join (no step along the stem\'s ridge line)', Math.abs(tp.heightAt(20, 19.99) - tp.heightAt(20, 20.01)) < 0.05, `${tp.heightAt(20, 19.99)} ${tp.heightAt(20, 20.01)}`);
  // a T where the stem is as wide as the bar is deep, and one where it is wider (its ridge is higher than the bar's)
  exact('T, equal spans', [room('bar', 0, 0, 8, 4), room('stem', 2, 4, 4, 5)]);
  exact('T, big stem', [room('bar', 0, 0, 8, 3), room('stem', 1, 3, 5, 6)]);
  // side by side (parallel ridges), offset; a corner join; a different building next door; a pinwheel of four
  exact('side by side', [room('a', 0, 0, 6, 3), room('b', 1, 3, 6, 4)]);
  exact('corner', [room('a', 0, 0, 6, 3), room('b', 6, 0, 3, 7)]);
  exact('two buildings touching', [room('a', 0, 0, 6, 3), room('b', 0, 3, 6, 4, { building: 'b2' })]);
  exact('four rooms', [room('a', 0, 0, 5, 3), room('b', 5, 0, 3, 5), room('c', 0, 3, 3, 5), room('d', 3, 5, 5, 3), room('e', 3, 3, 2, 2, { style: 'flat' })]);
  const two = planRoofs([room('a', 0, 0, 6, 3), room('b', 0, 3, 6, 4, { building: 'b2' })]);
  check('different buildings keep their own gable ends', two.roofs.every(r => r.gables.length === 2));
  // a mix of gable, hip and flat in one building
  exact('gable + hip + flat', [room('a', 0, 0, 6, 4), room('b', 6, 0, 4, 4, { kind: 'hip' }), room('c', 0, 4, 3, 3, { style: 'flat' })]);
}
// ---- two storeys: a smaller upper floor ----
{
  const lower = room('lower', 0, 0, 8, 5), upper = room('upper', 0, 0, 5, 5, { y: 10, top: 19 });
  const plan = planRoofs([lower, upper]), lo = plan.roofs.find(r => r.room === 'lower'), up = plan.roofs.find(r => r.room === 'upper');
  const c = coverage(plan, [lower], { skip: (r, gx) => gx === 5 }); // (the upper roof's own 1-ft overhang hangs over the column beside it)
  check('two storeys: every ground cell under exactly one roof', c.bad === 0, c.worst);
  check('no lower roof under the upper storey', cellsFt(upper).every(([gx, gz]) => !lo.planes.some(p => p.poly.some(() => false)) && coverAt({ roofs: [lo] }, gx * 5 + 2.5, gz * 5 + 2.5) === 0));
  check('the uncovered part of the lower storey is flat, at the upper floor\'s height', lo.kind === 'flat' && lo.planes.every(p => p.flat && p.poly.every(q => q[1] === 10)) && lo.standable.length === 15, `${lo.kind} ${lo.standable.length}`);
  check('the upper storey has its own pitched roof from its own wall top', up.kind === 'gable' && up.top === 19 && up.ridgeY > 19);
  check('no slab side or parapet against the upper storey\'s wall', lo.skirts.length === 3 + 3 + 5 && lo.props.filter(p => p.role === 'parapet').length === 11, `${lo.skirts.length} ${lo.props.filter(p => p.role === 'parapet').length}`);
  check('piers at the two free corners of the parapet', lo.props.filter(p => p.role === 'corner').length === 2, lo.props.filter(p => p.role === 'corner').length);
  // a lower room beside a taller one: its eaves stop at the taller wall
  const side = planRoofs([room('low', 0, 0, 4, 4), room('hall', 4, 0, 4, 4, { top: 19 })]);
  check('a lower roof does not poke into a taller neighbour', coverAt({ roofs: [side.roofs[0]] }, 20.5, 7) === 0 && coverAt({ roofs: [side.roofs[0]] }, 19.5, 7) === 1);
  // wholly covered: no roof at all
  check('a wholly covered room has no roof', planRoofs([room('g', 0, 0, 4, 4), room('u', 0, 0, 4, 4, { y: 10, top: 19 })]).roofs.map(r => r.room).join() === 'u');
  check('covered cells may be stated outright', planRoofs([room('g', 0, 0, 2, 1, { covered: [[0, 0]] })]).roofs[0].standable.length === 1);
}
// ---- trim ----
{
  const rooms = [room('a', 0, 0, 10, 5, { seed: 11 }), room('b', 10, 0, 4, 5, { style: 'flat' })], fires = [{ id: 'f1', x: 12.5, z: 2 }, { id: 'f2', x: 61, z: 12.5 }];
  const has = (id) => ['roof-dormer', 'pillar-square'].includes(id);
  const a = planRoofs(rooms, { fires, has }), b = planRoofs(rooms, { fires, has });
  check('trim is deterministic per seed', JSON.stringify(a.roofs.map(r => r.props)) === JSON.stringify(b.roofs.map(r => r.props)));
  const seeds = new Set(); for (let s = 1; s <= 12; s++) seeds.add(JSON.stringify(planRoofs([{ ...rooms[0], seed: s }], { has }).roofs[0].props.map(p => [p.role, p.x, p.z])));
  check('a re-roll (another seed) changes the trim', seeds.size >= 4, seeds.size);
  const ch = a.roofs.flatMap(r => r.props).filter(p => p.role === 'chimney');
  check('one chimney per fireplace, exactly above it', ch.length === 2 && fires.every(f => ch.some(c => c.x === f.x && c.z === f.z && c.fire === f.id)));
  const c1 = ch.find(c => c.fire === 'f1'), ra = a.roofs[0];
  check('a chimney starts inside the roof and ends above the ridge', c1.y < a.heightAt(12.5, 2) && c1.y + c1.dims[1] > ra.ridgeY + 2, `${c1.y} ${c1.dims[1]} ${ra.ridgeY}`);
  check('a chimney over a flat roof belongs to that roof', ch.find(c => c.fire === 'f2').room === 'b');
  check('stand-ins are named: chimney -> pillar-square (wants chimney-stack), dormer is the real piece', c1.cat === 'pillar-square' && c1.standIn && c1.wants === 'chimney-stack' && resolveKit(has).dormer.standIn === false && resolveKit(has).parapet.cat === null);
  let most = 0, small = 0, off = 0;
  for (let s = 1; s <= 60; s++) {
    const P = planRoofs([{ ...rooms[0], seed: s }], { has }), d = P.roofs[0].props.filter(p => p.role === 'dormer'); most = Math.max(most, d.length);
    for (const p of d) if (Math.abs(P.heightAt(p.x, p.z) - (p.y + 0.6)) > 0.02) off++;
    small += planRoofs([{ ...room('s', 0, 0, 3, 2), seed: s }], { has }).roofs[0].props.filter(p => p.role === 'dormer').length;
  }
  check('dormers are sparse: at most one per 20 ft of eave (a 50-ft room: 4 at most), on the slope', most >= 1 && most <= 4 && off === 0, `${most} ${off}`);
  check('no dormers on a small roof', small === 0);
  check('trim can be switched off per room', planRoofs([{ ...rooms[0], props: false }], { fires, has }).roofs[0].props.length === 0);
  check('a flat roof gets its ledge: a parapet on each open edge', a.roofs[1].props.filter(p => p.role === 'parapet').length === 4 + 5 + 4, a.roofs[1].props.filter(p => p.role === 'parapet').length);
}
// ---- many random buildings: the one rule holds ----
{
  let bad = 0, n = 0, worst = '';
  const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; })();
  for (let t = 0; t < 300; t++) {
    const rooms = [], taken = new Set();
    for (let k = 0; k < 6; k++) {
      const w = 1 + Math.floor(rnd() * 6), d = 1 + Math.floor(rnd() * 6), x = Math.floor(rnd() * 10), z = Math.floor(rnd() * 10);
      let ok = true; for (let i = 0; i < w && ok; i++) for (let j = 0; j < d; j++) if (taken.has(`${x + i}:${z + j}`)) { ok = false; break; }
      if (!ok) continue;
      for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) taken.add(`${x + i}:${z + j}`);
      rooms.push(room('r' + k, x, z, w, d, { kind: rnd() < 0.25 ? 'hip' : 'gable', style: rnd() < 0.15 ? 'flat' : 'tile', building: rnd() < 0.8 ? 'b1' : 'b2' }));
    }
    const c = coverage(planRoofs(rooms), rooms); n += c.n; bad += c.bad; if (c.bad && !worst) worst = `trial ${t}: ${c.worst} ${JSON.stringify(rooms.map(r => [r.id, r.x, r.z, r.w, r.d, r.kind, r.style, r.building]))}`;
  }
  check('300 random buildings: every sampled point roofed exactly once', bad === 0 && n > 10000, `${bad}/${n} ${worst}`);
}
// ---- roof sections (2026-10-11): the copies cover every slope exactly once, each with at most four clip planes ----
{
  const slope = (roof) => roof.planes.filter(p => p.lay).reduce((s, pl) => { let a = 0; const p = pl.poly; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[2] - q[0] * p[i][2]; } return s + Math.abs(a) / 2 * Math.sqrt(1 + pl.lay.tan ** 2); }, 0);
  const gable = planRoofs([room('a', 0, 0, 6, 4)]).roofs[0], L = sectionLayout(gable);
  check('sections: a 30 x 20 gable is 64 copies, 36 of them whole', L.count === 64 && L.whole === 36 && L.matrix.length === 64 * 16 && L.clip.length === 64 * 16, `${L.count} ${L.whole}`);
  check('sections: the copies add up to the slopes', Math.abs(L.cells.reduce((s, c) => s + c.area, 0) - slope(gable)) < 1e-6);
  check('sections: every slope starts with a whole course at the eave (row 0 at the overhang)', Math.min(...L.cells.map(c => c.j)) === 0);
  // a copy's frame is right-handed and unit; its clip planes keep its own middle when it is whole
  let bad = 0; for (let k = 0; k < L.count; k++) { const m = L.matrix.subarray(k * 16, k * 16 + 16), X = [m[0], m[1], m[2]], Y = [m[4], m[5], m[6]], Z = [m[8], m[9], m[10]], c = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]]; if (Math.hypot(c[0] - Z[0], c[1] - Z[1], c[2] - Z[2]) > 1e-6 || Y[1] <= 0) bad++; }
  check('sections: every copy is a right-handed frame with its relief pointing up', bad === 0, bad);
  // a point of a copy, by its clip planes, is kept exactly when it is over the planned piece (checked against the plan's own cover)
  let n = 0, wrong = 0;
  for (const rooms of [[room('a', 0, 0, 6, 4)], [room('a', 0, 0, 6, 4, { kind: 'hip' })], [room('l', 0, 0, 6, 6, { outline: [[0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]] })], [room('a', 0, 0, 6, 3), room('b', 6, 0, 3, 5), room('c', 2, 3, 2, 4)]]) {
    const plan = planRoofs(rooms);
    for (const roof of plan.roofs) {
      const S = sectionLayout(roof); let kept = 0;
      for (let k = 0; k < S.count; k++) for (const [x, z] of [[0.7, 0.9], [2.5, 2.5], [4.3, 1.1], [1.2, 4.4], [3.9, 3.6]]) {
        const c = S.clip.subarray(k * 16, k * 16 + 16); let inside = true; for (let q = 0; q < 4; q++) if (c[q * 4] * x + c[q * 4 + 2] * z + c[q * 4 + 3] < 0) inside = false;
        if (inside) kept += 1;
      }
      const want = slope(roof) / 25 * 5; n++; if (Math.abs(kept - want) > Math.max(6, want * 0.12)) wrong++; // five sample points a copy: kept points ~ area
      if (Math.abs(S.cells.reduce((s, c) => s + c.area, 0) - slope(roof)) > 1e-6 || S.cells.some(c => c.cuts > 4)) wrong++;
    }
  }
  check('sections: gable, hip, L and joined rooms: areas exact, never more than four planes, kept points follow the area', wrong === 0 && n >= 6, `${wrong}/${n}`);
  const flat = planRoofs([room('a', 0, 0, 3, 3, { style: 'flat' })]).roofs[0];
  check('sections: a flat roof has none', sectionLayout(flat).count === 0);
  // 300 random buildings: exact areas, at most four planes a copy
  let s = 99; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; let worst = 0, over = 0, splits = 0;
  for (let t = 0; t < 300; t++) {
    const rooms = [], taken = new Set();
    for (let k = 0; k < 5; k++) { const w = 1 + Math.floor(rnd() * 6), d = 1 + Math.floor(rnd() * 6), x = Math.floor(rnd() * 10), z = Math.floor(rnd() * 10); let ok = true; for (let i = 0; i < w && ok; i++) for (let j = 0; j < d; j++) if (taken.has(`${x + i}:${z + j}`)) { ok = false; break; } if (!ok) continue; for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) taken.add(`${x + i}:${z + j}`); rooms.push(room('r' + k, x, z, w, d, { kind: rnd() < 0.25 ? 'hip' : 'gable', building: rnd() < 0.8 ? 'b1' : 'b2' })); }
    for (const roof of planRoofs(rooms).roofs) { const S = sectionLayout(roof); worst = Math.max(worst, Math.abs(S.cells.reduce((a, c) => a + c.area, 0) - slope(roof))); over += S.cells.filter(c => c.cuts > 4).length; splits += S.split; }
  }
  check('sections: 300 random buildings covered (slivers under a thousandth of a square foot are not drawn), no copy with more than four planes', worst < 0.01 && over === 0, `worst ${worst} over ${over} splits ${splits}`);
}
// ---- controls (2026-10-27): a forced ridge axis, shape flat whatever the style; the data's validation ----
{
  const auto = planRoofs([room('a', 0, 0, 6, 4)]).roofs[0];
  const turned = exact('rectangle 6x4 turned (axis z)', [room('a', 0, 0, 6, 4, { axis: 'z' })]).roofs[0];
  check('turned: the ridge runs along z, the automatic one along x', auto.axis === 'x' && auto.autoAxis === 'x' && turned.axis === 'z' && turned.autoAxis === 'x' && turned.forced === 'z', `${auto.axis}/${turned.axis}/${turned.autoAxis}`);
  const gx = (r) => r.gables.map(t => t[0][0] === t[1][0] ? 'x-end' : 'z-end').sort().join();
  check('turned: the gable ends face the other pair of walls (on the z ends, not the x ends)', gx(auto) === 'x-end,x-end' && gx(turned) === 'z-end,z-end', `${gx(auto)} | ${gx(turned)}`);
  check('turned: the ridge is over the middle across x (half span 15 ft, capped rise)', Math.abs(turned.ridgeY - (9 + 15)) < 1e-6 && turned.ridges.every(r => Math.abs(r.a[0] - 15) < 1e-6 && Math.abs(r.b[0] - 15) < 1e-6), turned.ridgeY);
  const same = planRoofs([room('a', 0, 0, 6, 4, { axis: 'x' })]).roofs[0];
  check('a forced axis the same as the automatic one changes nothing', JSON.stringify({ ...same, forced: undefined }) === JSON.stringify({ ...auto, forced: undefined }));
  // a wing pointed at its neighbour (the automatic choice) and the same wing turned along its neighbour
  const hall = room('h', 0, 0, 8, 4), wing = room('w', 2, 4, 4, 4);
  const p0 = exact('hall + wing', [hall, wing]), p1 = exact('hall + wing turned', [hall, { ...wing, axis: 'x' }]);
  const W0 = p0.roofs.find(r => r.room === 'w'), W1 = p1.roofs.find(r => r.room === 'w');
  check('a wing points its ridge at its neighbour; turned, it runs alongside', W0.axis === 'z' && W1.axis === 'x' && W1.autoAxis === 'z', `${W0.axis} ${W1.axis}`);
  // the hall turned across: its ridge across z, so the wing (pointed at it, along z too) is in line
  const p2 = exact('hall turned + wing', [{ ...hall, axis: 'z' }, wing]);
  check('the turned hall has its ridge across (z)', p2.roofs.find(r => r.room === 'h').axis === 'z');
  // an L-shaped room (two rectangles): the force wins for both
  const L = { ...room('L', 0, 0, 6, 6), outline: [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]] };
  const pl = exact('L turned', [{ ...L, axis: 'x' }]);
  check('an L turned: every planned plane slopes across z (the ridges run along x)', pl.roofs[0].planes.filter(p => !p.flat).every(p => p.face === 'N' || p.face === 'S'), pl.roofs[0].planes.map(p => p.face).join());
  // shape flat with a pitched style; shape hip
  const f = exact('shape flat, thatch', [room('a', 0, 0, 4, 4, { kind: 'flat' })]).roofs[0];
  check('shape flat: flat whatever the style (the style is kept, the flat surface is drawn)', f.kind === 'flat' && f.style === 'thatch' && f.planes.every(p => p.flat) && !f.axis, f.kind);
  const fs = planRoofs([room('a', 0, 0, 4, 4, { style: 'flat', kind: 'gable' })]).roofs[0];
  check('style flat: still flat with a gable shape asked for', fs.kind === 'flat');
  const fa = planRoofs([room('a', 0, 0, 6, 4, { kind: 'flat', axis: 'z' })]).roofs[0];
  check('a flat roof ignores a forced axis', fa.kind === 'flat' && !fa.axis);
  const h = exact('hip turned', [room('a', 0, 0, 6, 4, { kind: 'hip', axis: 'z' })]).roofs[0];
  check('a hip turned: its ridge runs along z', h.kind === 'hip' && h.axis === 'z' && h.ridges.every(r => Math.abs(r.a[0] - r.b[0]) < 1e-6));
}
{ // a room open to the sky (none): its neighbour's roof ends at it in a closed gable; a room under it stays covered
  const a = room('a', 0, 0, 4, 4), b = room('b', 4, 0, 4, 4);
  const both = planRoofs([a, b]), open = planRoofs([a, { ...b, none: true, props: false }]);
  const A0 = both.roofs.find(r => r.room === 'a'), A1 = open.roofs.find(r => r.room === 'a');
  check('open to the sky: no roof for it', !open.roofs.some(r => r.room === 'b') && open.roofs.length === 1);
  check('open to the sky: the neighbour closes its gable against it (a wall triangle at x = 20)', A1.gables.length > A0.gables.length && A1.gables.some(t => t.every(q => Math.abs(q[0] - 20) < 1e-6)), `${A0.gables.length} -> ${A1.gables.length}`);
  const low = room('low', 0, 10, 4, 4, { top: 9 }), up = room('up', 0, 10, 4, 4, { y: 10, top: 19, none: true, props: false });
  check('open to the sky upstairs: the storey under it is still covered (no roof drawn through its floor)', !planRoofs([low, up]).roofs.some(r => r.room === 'low'));
}
{ // THE TRIM IS TOUCHABLE (2026-10-27): every piece has a key; room.roof.trim moves or removes it, the rest stays by rule
  const fires = [{ id: 'obj_fire1', x: 12.5, z: 7.5 }];
  let seed = 1, base; for (; seed < 200; seed++) { base = planRoofs([room('a', 0, 0, 6, 4, { seed })], { fires }); if (base.roofs[0].props.some(p => p.role === 'dormer')) break; }
  const R0 = base.roofs[0], ch = R0.props.find(p => p.role === 'chimney'), dm = R0.props.find(p => p.role === 'dormer');
  check('trim: every piece has a key; the chimney is keyed by its fireplace', R0.props.every(p => p.key) && ch?.key === 'chimney:obj_fire1' && /^dormer:0:0:[NS]:\d$/.test(dm?.key || ''), R0.props.map(p => p.key).join());
  const moved = planRoofs([room('a', 0, 0, 6, 4, { seed, trim: { 'chimney:obj_fire1': { at: [22.5, 5] } } })], { fires }).roofs[0], c2 = moved.props.find(p => p.role === 'chimney');
  check('trim: a chimney moved stands in the roof there, upright, its top over the ridge', c2.moved && c2.x === 22.5 && c2.z === 5 && Math.abs(c2.y - (moved.planes.length && (9 + 5) - 1.5)) < 1e-6 && c2.y + c2.dims[1] >= moved.ridgeY + 2.5 - 1e-6, JSON.stringify(c2));
  const gone = planRoofs([room('a', 0, 0, 6, 4, { seed, trim: { [dm.key]: { gone: true } } })], { fires }).roofs[0];
  check('trim: a piece removed is gone; the rest are as they were', !gone.props.some(p => p.key === dm.key) && gone.props.length === R0.props.length - 1);
  const [a, b, c] = dm.slide.plane, far = planRoofs([room('a', 0, 0, 6, 4, { seed, trim: { [dm.key]: { at: [29, 19] } } })], { fires }).roofs[0].props.find(p => p.key === dm.key);
  check('trim: a dormer moved past its slope is kept on it (inside its box), on its plane', far.moved && Math.abs(far.y + 0.6 - (a * far.x + b * far.z + c)) < 1e-6 && far.x <= 30 - 2.5 + 1e-9 && far.x > 20, JSON.stringify(far));
  const there = planRoofs([room('a', 4, 2, 6, 4, { seed, trim: { 'chimney:obj_fire1': { at: [22.5, 5] } } })], { fires: [{ id: 'obj_fire1', x: 32.5, z: 17.5 }] }).roofs[0].props.find(p => p.role === 'chimney');
  check('trim: an override is from the room\'s corner, so a moved room keeps it', there.x === 42.5 && there.z === 15, `${there.x} ${there.z}`);
  check('slideProp: off the roof is nowhere', slideProp(base, ch, 100, 100) === null);
  const HT = await import('../core/height.js');
  check('roofProblem: trim accepted / refused', HT.roofProblem({ trim: { 'chimney:obj_1': { at: [1, 2] }, 'dormer:0:0:N:0': { gone: true }, 'finial:0:0:x0': null } }) === null && !!HT.roofProblem({ trim: { 'chimney:x': { at: [1] } } }) && !!HT.roofProblem({ trim: { 'chimney:x': { gone: false } } }) && !!HT.roofProblem({ trim: { 'bad key': { gone: true } } }) && !!HT.roofProblem({ trim: [] }));
  check('mergeRoof: trim piece by piece; null puts one back; none left = no field', JSON.stringify(HT.mergeRoof({ trim: { 'a:1': { gone: true } } }, { trim: { 'b:2': { at: [1, 1] } } })) === '{"trim":{"a:1":{"gone":true},"b:2":{"at":[1,1]}}}' && HT.mergeRoof({ trim: { 'a:1': { gone: true } } }, { trim: { 'a:1': null } }) === undefined);
}
{
  const HT = await import('../core/height.js');
  check('roofProblem: shape and axis accepted', HT.roofProblem({ shape: 'hip' }) === null && HT.roofProblem({ axis: 'z' }) === null && HT.roofProblem({ shape: 'auto', axis: 'auto' }) === null && HT.roofProblem({ off: true }) === null);
  check('roofProblem: a bad shape / axis / field refused', !!HT.roofProblem({ shape: 'dome' }) && !!HT.roofProblem({ axis: 'y' }) && !!HT.roofProblem({ turn: 1 }));
  check('mergeRoof: auto clears shape and axis; nothing left = no field', HT.mergeRoof({ shape: 'hip', axis: 'z' }, { shape: 'auto', axis: 'auto' }) === undefined && JSON.stringify(HT.mergeRoof({ style: 'tile' }, { axis: 'x' })) === '{"style":"tile","axis":"x"}');
  const E = { b: { id: 'b', kind: 'building', roofShape: 'flat' }, r1: { id: 'r1', kind: 'room', building: 'b' }, r2: { id: 'r2', kind: 'room', building: 'b', roof: { shape: 'hip' } }, r3: { id: 'r3', kind: 'room' } };
  check('roofShapeOf: the room\'s own, else its building\'s, else automatic', HT.roofShapeOf(E, E.r2) === 'hip' && HT.roofShapeOf(E, E.r1) === 'flat' && HT.roofShapeOf(E, E.r3) === undefined);
  check('roofShapeProblem', HT.roofShapeProblem('hip') === null && HT.roofShapeProblem('auto') === null && !!HT.roofShapeProblem('dome'));
}
// ---- the temple roof and the gable ends (2026-10-27) ----
{
  const t = planRoofs([room('t', 0, 0, 5, 8, { style: 'marble', family: 'temple-stone' })]).roofs[0];
  check('marble: its own pitch (22 deg) on every plane, ridge at half span x tan 22', t.planes.every(p => Math.abs(p.pitch - 22) < 1e-9) && Math.abs(t.ridgeY - 9 - 12.5 * Math.tan(22 * Math.PI / 180)) < 1e-9, t.ridgeY);
  check('marble: no dormers on a temple', !t.props.some(p => p.role === 'dormer'));
  check('marble: both gable ends are pediments (cornice trim, a tympanum each)', t.gableEnds.length === 2 && t.gableEnds.every(G => G.trim === 'cornice' && G.free && G.verges.length === 2) && t.props.filter(p => p.role === 'pediment').length === 2);
  exact('marble beside a 45-degree wing: every cell roofed once', [room('n', 0, 0, 5, 8, { style: 'marble' }), room('w', 5, 3, 4, 3, { style: 'slate' })]);
  check('marble: a room\'s own pitch still wins', Math.abs(planRoofs([room('t', 0, 0, 5, 8, { style: 'marble', pitch: 30 })]).roofs[0].planes[0].pitch - 30) < 1e-9);
  check('styles: marble is a roof style the relay accepts', ROOF_STYLE_KEYS.includes('marble') && roofProblem({ style: 'marble' }) === null && roofProblem('marble', true) === null);
  const ents = (type, fam) => ({ b: { kind: 'building', id: 'b' }, r: { kind: 'room', id: 'r', building: 'b', recipe: { type, x: 0, z: 0, w: 5, d: 8 } } });
  const E1 = ents('temple-nave'), E2 = ents('cathedral');
  check('by default: a temple is marble, a cathedral keeps slate', roofStyleOf(E1, E1.r, () => 'temple-stone') === 'marble' && roofStyleOf(E2, E2.r, () => 'temple-stone') === 'slate');
  const h = planRoofs([room('h', 0, 0, 6, 4, { style: 'tile', family: 'half-timber' })]).roofs[0], s = planRoofs([room('s', 0, 0, 6, 4, { style: 'slate', family: 'dressed-stone' })]).roofs[0];
  check('gables: one gable end per gable triangle, flush with the wall face', h.gableEnds.length === h.gables.length && h.gableEnds.every(G => G.face === GABLE.face));
  check('gables: a timber house has bargeboards, a stone one copings', h.gableEnds.every(G => G.trim === 'board') && s.gableEnds.every(G => G.trim === 'coping'));
  const ops = (r) => r.props.filter(p => p.role.startsWith('gable-') || p.role === 'pediment');
  check('gables: a 20-ft gable gets an opening at each end, the two alike, with stable keys', ops(h).length === 2 && ops(h)[0].kind === ops(h)[1].kind && ops(h).every(p => /^gable:0:0:x[01]:(window|vent)$/.test(p.key)), ops(h).map(p => p.key).join());
  check('gables: a stone house\'s opening is an oculus or a vent; a timber house\'s a window or a vent', ops(s).every(p => ['oculus', 'vent'].includes(p.kind)) && ops(h).every(p => ['window', 'vent'].includes(p.kind)));
  check('gables: a 10-ft gable has no room for one', ops(planRoofs([room('x', 0, 0, 3, 2, { style: 'tile', family: 'half-timber' })]).roofs[0]).length === 0);
  const kinds = new Set(); for (let sd = 1; sd < 30; sd++) kinds.add(ops(planRoofs([room('h', 0, 0, 6, 4, { style: 'tile', family: 'half-timber', seed: sd })]).roofs[0]).map(p => p.kind + p.y).join());
  check('gables: the seed picks them (re-roll changes them; the same seed the same)', kinds.size > 2 && JSON.stringify(ops(planRoofs([room('h', 0, 0, 6, 4, { style: 'tile', family: 'half-timber', seed: 5 })]).roofs[0])) === JSON.stringify(ops(planRoofs([room('h', 0, 0, 6, 4, { style: 'tile', family: 'half-timber', seed: 5 })]).roofs[0])), kinds.size);
  const L = planRoofs([room('a', 0, 0, 6, 4), room('b', 6, 0, 4, 4)]);
  check('gables: in a line, only the two free ends carry trim and openings', L.roofs.reduce((n, r) => n + r.verges.length, 0) === 4 && L.roofs.reduce((n, r) => n + ops(r).length, 0) <= 2);
  const g0 = ops(h)[0], sl = slideProp({ heightAt: () => null, roofs: [h] }, g0, g0.x + 40, g0.z + 40);
  check('gables: a window / vent slides along its own gable, at its height, inside the triangle', sl && sl.x === g0.x && sl.y === g0.y && sl.z === g0.slide.range[1] && g0.slide.range[1] > g0.z, JSON.stringify([sl, g0.slide]));
  const moved = planRoofs([room('h', 0, 0, 6, 4, { style: 'tile', family: 'half-timber', trim: { [g0.key]: { at: [0.5 * 0, 8] } } })]).roofs[0], gone = planRoofs([room('h', 0, 0, 6, 4, { style: 'tile', family: 'half-timber', trim: { [g0.key]: { gone: true } } })]).roofs[0];
  check('gables: an override moves one (room.roof.trim), or removes it', ops(moved).find(p => p.key === g0.key)?.moved && ops(gone).length === 1, JSON.stringify(ops(moved).map(p => [p.key, p.z, p.moved])));
  const dormers = (fam) => planRoofs([room('d', 0, 0, 8, 4, { style: 'tile', family: fam, seed: 3 })]).roofs[0].props.filter(p => p.role === 'dormer').map(p => [p.x, p.z]).join();
  check('gables: the openings leave the dormer and finial rolls as they were', dormers('half-timber') === dormers(undefined));
}
// ---- FLAT SURFACES, EDGES AND CORNER TURRETS (2026-10-27) ----
{
  const all = ['parapet-straight', 'parapet-corner', 'wall-crenellated', 'wall-crenellated-corner', 'roof-bartizan', 'railing-wood'], has = (id) => all.includes(id);
  for (const st of HT.FLAT_STYLES) {
    const r = planRoofs([room('a', 0, 0, 3, 3, { style: st })], { has }).roofs[0];
    check(`flat surface ${st}: a flat roof that wears it, at top + 1`, r.kind === 'flat' && r.style === st && r.flatStyle === st && r.planes.every(p => p.flat && p.poly.every(q => q[1] === 10)) && !!ROOF_STYLES[st].tex, `${r.kind} ${r.style} ${r.flatStyle}`);
  }
  const old = planRoofs([room('a', 0, 0, 3, 3, { style: 'flat' })], { has }).roofs[0];
  check("'flat' (a saved map's word) is the plank deck", old.kind === 'flat' && old.style === 'deck' && HT.roofStyleKey('flat') === 'deck' && HT.isFlatStyle('flat') && !HT.roofProblem({ style: 'flat' }) && !HT.roofProblem('flat', true));
  check("a pitched roof's flat part wears its usual flat (slate: lead; thatch: a plank deck)", flatSurfaceOf('slate') === 'lead' && flatSurfaceOf('thatch') === 'deck' && flatSurfaceOf('turf') === 'turf');
  const roles = (edge, more = {}) => planRoofs([room('a', 0, 0, 4, 3, { style: 'flagstone', edge, ...more })], { has }).roofs[0].props.map(p => p.role);
  const count = (xs, k) => xs.filter(x => x === k).length;
  const P = roles('parapet'), B = roles('battlements'), R = roles('railing'), N = roles('none'), T = roles('battlements', { turrets: true });
  check('parapet: a section on each open 5-ft edge (14 on a 20 x 15 roof) and a pier at each corner', count(P, 'parapet') === 14 && count(P, 'corner') === 4, P.join());
  check('battlements: merlons on each edge, a corner block at each corner', count(B, 'battlement') === 14 && count(B, 'merlon') === 4 && !B.includes('parapet'), B.join());
  check('railing: timber railing on each edge, no piers', count(R, 'railing') === 14 && R.length === 14, R.join());
  check('no edge: nothing', N.length === 0, N.join());
  check('corner turrets: one on each outer corner instead of its block', count(T, 'turret') === 4 && count(T, 'merlon') === 0 && count(T, 'battlement') === 14, T.join());
  const tur = planRoofs([room('a', 0, 0, 4, 3, { style: 'flagstone', edge: 'battlements', turrets: true })], { has }).roofs[0].props.filter(p => p.role === 'turret');
  check('a turret stands just inside its corner, on the roof, facing out', tur.every(p => p.y === 10 && (Math.abs(p.x - TURRET.inset) < 1e-9 || Math.abs(p.x - (20 - TURRET.inset)) < 1e-9) && (Math.abs(p.z - TURRET.inset) < 1e-9 || Math.abs(p.z - (15 - TURRET.inset)) < 1e-9) && p.cat === 'roof-bartizan'), JSON.stringify(tur.map(p => [p.x, p.z, p.rot])));
  check('no turrets on a roof narrower than 10 ft', !planRoofs([room('a', 0, 0, 1, 3, { style: 'flagstone', edge: 'battlements', turrets: true })], { has }).roofs[0].props.some(p => p.role === 'turret'));
  check('without the generated turret the corner block stands in', planRoofs([room('a', 0, 0, 4, 3, { style: 'flagstone', edge: 'battlements', turrets: true })], { has: (id) => id !== 'roof-bartizan' && has(id) }).roofs[0].props.filter(p => p.role === 'turret').every(p => p.cat === 'wall-crenellated-corner' && p.standIn));
  // an L: the inner corner gets nothing, the outer five corners a turret each
  const L = planRoofs([room('l', 0, 0, 4, 4, { style: 'flagstone', edge: 'battlements', turrets: true, outline: undefined, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [0, 3], [1, 3]], x: undefined })], { has }).roofs[0].props.filter(p => p.role === 'turret');
  check('an L-shaped flat roof: turrets on its five outer corners, none in the inner corner', L.length === 5 && !L.some(p => Math.hypot(p.x - 10, p.z - 10) < 3), JSON.stringify(L.map(p => [p.x, p.z])));
  // a lower storey's open deck keeps its edge rule: nothing against the upper storey's walls
  const two = planRoofs([room('g', 0, 0, 4, 2, { style: 'thatch', edge: 'battlements' }), room('u', 0, 0, 2, 2, { y: 10, top: 19 })], { has }).roofs.find(r => r.room === 'g');
  check("a lower storey's deck: battlements on its open edges only, its surface the pitched style's flat", two.kind === 'flat' && two.flatStyle === 'deck' && two.props.filter(p => p.role === 'battlement').length === 6, two.props.map(p => p.role).join());
}
// ---- flat by default (core/height.js) ----
{
  const E = (rooms, b = null) => Object.fromEntries([...rooms.map((r, i) => [r.id, { kind: 'room', building: b?.id, order: i, ...r }]), ...(b ? [[b.id, { kind: 'building', ...b }]] : [])]);
  const keep = E([{ id: 'r1', recipe: { type: 'great-hall', x: 0, z: 0, w: 6, d: 4 } }, { id: 'r2', recipe: { type: 'chapel', x: 6, z: 0, w: 3, d: 3 } }], { id: 'b1' });
  const st = HT.roofStyleOf(keep, keep.r2, () => 'dressed-stone'), edge = HT.roofEdgeOf(keep, keep.r2, flatSurfaceOf(st), () => 'dressed-stone');
  check('a castle (by its first room, the great hall) is flagstoned and battlemented, with corner turrets', st === 'flagstone' && edge === 'battlements' && HT.roofTurretsOf(keep, keep.r2, edge, () => 'dressed-stone'), `${st} ${edge}`);
  check("a castle's own choices still win", HT.roofStyleOf({ ...keep, b1: { ...keep.b1, roof: 'slate' } }, keep.r2) === 'slate' && HT.roofEdgeOf({ ...keep, r2: { ...keep.r2, roof: { edge: 'parapet' } } }, { ...keep.r2, roof: { edge: 'parapet' } }, 'flagstone') === 'parapet' && !HT.roofTurretsOf(keep, { ...keep.r2, roof: { turrets: false } }, 'battlements'));
  const cot = E([{ id: 'c', recipe: { type: 'hut-cottage', x: 0, z: 0, w: 4, d: 3 } }]);
  check('a cottage is still thatched; its deck (if any) has a timber railing', HT.roofStyleOf(cot, cot.c) === 'thatch' && HT.roofEdgeOf(cot, cot.c, flatSurfaceOf('thatch')) === 'railing' && !HT.roofTurretsOf(cot, cot.c, 'railing'));
  check('dungeon and mine walls: turf, with a stone parapet', HT.ROOF_BY_FAMILY['cut-rock'] === 'turf' && HT.ROOF_BY_FAMILY['mine-timbered'] === 'turf' && HT.EDGE_BY_SURFACE.turf === 'parapet');
  const tower = E([{ id: 't1', recipe: { type: 'wiz-study', x: 0, z: 0, w: 3, d: 3 } }, { id: 't2', recipe: { type: 'wiz-observatory', x: 0, z: 0, w: 3, d: 3, y: 20 } }], { id: 'b2' });
  check("the wizard's observatory is a flat platform on the tower (its own type), the study below keeps the tower's slate", HT.roofStyleOf(tower, tower.t2, () => 'tower-stone') === 'flagstone' && HT.roofStyleOf(tower, tower.t1, () => 'tower-stone') === 'slate');
  check('room.roof edge and turrets are checked and merged', !HT.roofProblem({ edge: 'battlements', turrets: true }) && !!HT.roofProblem({ edge: 'moat' }) && !!HT.roofProblem({ turrets: 'yes' }) && JSON.stringify(HT.mergeRoof({ edge: 'railing', turrets: true }, { edge: 'auto', turrets: 'auto' })) === undefined);
}
console.log(`${pass}/${pass + fail} roof checks passed`);
process.exit(fail ? 1 : 0);
