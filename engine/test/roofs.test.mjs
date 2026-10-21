// Computed roofs: pure geometry checks (node test/roofs.test.mjs). engine/client/roofs.js planRoofs.
import { planRoofs, coverAt, resolveKit, ROOF_DEFAULTS, sectionLayout } from '../client/roofs.js';
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
console.log(`${pass}/${pass + fail} roof checks passed`);
process.exit(fail ? 1 : 0);
