// Culture roofs (2026-11-07; docs/VERTICAL.md "Culture roofs"): the planner's pure checks (node test/cultureroofs.test.mjs).
// engine/client/roofs.js ROOF_FORMS, IRIMOYA, bendAt, ROOF_ORNAMENTS; engine/core/height.js roofFormOf, roofOrnamentOf.
import { planRoofs, coverAt, sectionLayout, bendAt, ROOF_FORMS, ROOF_STYLES, ROOF_ORNAMENTS, IRIMOYA, flatSurfaceOf } from '../client/roofs.js';
import * as HT from '../core/height.js';
import { cellsOf } from '../core/footprint.js';

let pass = 0, fail = 0;
const check = (name, ok, ev = '') => { if (ok) pass++; else { fail++; console.log('FAIL ' + name + (ev !== '' ? '  [' + (typeof ev === 'string' ? ev : JSON.stringify(ev)) + ']' : '')); } };
const room = (id, x, z, w, d, more = {}) => ({ id, building: 'b1', x, z, w, d, top: 9, y: 0, style: 'kawara', seed: 7, ...more });
function coverage(plan, rooms) {
  let bad = 0, n = 0, worst = '';
  for (const r of rooms) for (const [i, j] of cellsOf(r)) for (const dx of [1.31, 2.43, 3.77]) for (const dz of [1.39, 2.59, 3.67]) {
    const x = (r.x + i) * 5 + dx, z = (r.z + j) * 5 + dz; n++; const c = coverAt(plan, x, z); if (c !== 1) { bad++; worst ||= `${r.id} (${x}, ${z}) covered ${c}x`; }
  }
  return { bad, n, worst };
}
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// ---- every culture's roof, by its walls and type (core/height.js) ----
{
  const ents = (type) => ({ b: { kind: 'building', id: 'b' }, r: { kind: 'room', id: 'r', building: 'b', recipe: { type, x: 0, z: 0, w: 6, d: 4 } } });
  const want = [ // type, family -> style, form, ornament
    ['jpn-house', 'jpn-shoji', 'kawara', 'jpn-house', null], ['jpn-shop', 'jpn-shoji', 'kawara', 'jpn-house', null], ['jpn-dojo', 'jpn-shoji', 'kawara', 'jpn-hall', null],
    ['jpn-shrine', 'jpn-shrine', 'shingle', 'jpn-hall', null], ['jpn-teahouse', 'jpn-shoji', 'shingle', 'jpn-house', null],
    ['chn-hall', 'chn-brick', 'tongwa', 'chn-house', null], ['chn-temple', 'chn-temple', 'glazed', 'chn-temple', null],
    ['nrs-longhouse', 'norse-stave', 'sod', 'nrs', null], ['rus-izba', 'rus-log', 'tes', 'rus', null], ['rus-church', 'rus-log', 'shingle', 'rus', 'cupola'],
    ['mde-hammam', 'mde-plaster', 'plaster', null, 'dome'], ['mde-audience', 'mde-plaster', 'plaster', null, 'malqaf'],
    ['ind-durbar', 'ind-sandstone', 'flagstone', null, 'chhatris'], ['ind-mandapa', 'ind-temple', 'flagstone', null, 'shikhara'], ['ind-bazaar', 'ind-lime', 'plaster', null, null],
    ['mes-house', 'mes-stucco', 'plaster', null, null],
    ['mkt-general', 'half-timber', 'tile', null, null], // (a European house is untouched)
  ];
  for (const [type, fam, style, form, orn] of want) {
    const E = ents(type), s = HT.roofStyleOf(E, E.r, () => fam), f = HT.roofFormOf(E, E.r, s, () => fam), o = HT.roofOrnamentOf(E.r, () => fam);
    check(`${type} (${fam}): style ${style}, form ${form}, ornament ${orn}`, s === style && f === form && o === orn, [s, f, o]);
  }
  const E = ents('mkt-general');
  check('a kawara roof put on any house is built the Japanese way (the form by style)', HT.roofFormOf(E, E.r, 'kawara', () => 'half-timber') === 'jpn-house' && HT.roofFormOf(E, E.r, 'glazed', () => 'half-timber') === 'chn-temple');
  check('the five culture styles and the irimoya shape are valid room.set / building.set words', HT.CULTURE_ROOF_STYLES.every(k => !HT.roofProblem({ style: k }) && !HT.roofProblem(k, true)) && !HT.roofProblem({ shape: 'irimoya' }) && !!HT.roofProblem({ shape: 'pagoda' }));
  check('every culture style is pitched, with a modelled-section key and a painted picture', HT.CULTURE_ROOF_STYLES.every(k => ROOF_STYLES[k] && !ROOF_STYLES[k].flat && /^roof\/roofing-.+\.webp$/.test(ROOF_STYLES[k].file)));
  check("sod's flat part is turf (a lower storey's deck under a turf roof)", flatSurfaceOf('sod') === 'turf');
}

// ---- IRIMOYA (hip-and-gable) ----
{
  const rooms = [room('a', 0, 0, 6, 4, { form: 'jpn-hall' })], plan = planRoofs(rooms, { has: () => true }), r = plan.roofs[0], c = coverage(plan, rooms);
  const F = ROOF_FORMS['jpn-hall'], t = Math.tan(F.pitch * Math.PI / 180), half = 10, g = half * IRIMOYA.hip, lift = (F.seat || 0) * t, Hc = 9 + lift + t * g; // (lift: the roof seated on the walls' outer face)
  check('irimoya by its form: every cell roofed exactly once', c.bad === 0, `${c.bad}/${c.n} ${c.worst}`);
  check('irimoya: shape reported, ridge along the long side at half the span x tan(pitch)', r.kind === 'irimoya' && r.axis === 'x' && near(r.ridgeY, 9 + lift + t * half, 1e-6), [r.kind, r.axis, r.ridgeY]);
  check('irimoya: two small gables, high up over the hipped ends (their foot at the hip\'s top)', r.gableEnds.length === 2 && r.gableEnds.every(G => G.irimoya && near(G.base, Hc - IRIMOYA.face * t - 0.05, 1e-6) && near(G.span, 20 - 2 * g)), r.gableEnds.map(G => [G.at, G.base, G.span]));
  check('irimoya: the gables stand g ft in from the end walls', near(r.gableEnds[0].at, g) && near(r.gableEnds[1].at, 30 - g), r.gableEnds.map(G => G.at));
  check('irimoya: the roof just outside a gable is the hip (lower than the ridge), just inside it the gable\'s full height', plan.heightAt(g - 0.3, 10) < Hc + 1e-6 && near(plan.heightAt(g + 0.3, 10), r.ridgeY, 1e-6), [plan.heightAt(g - 0.3, 10), plan.heightAt(g + 0.3, 10)]);
  check('irimoya: the ridge runs between the two gables', r.ridges.length === 1 && near(Math.min(r.ridges[0].a[0], r.ridges[0].b[0]), g, 0.26) && near(Math.max(r.ridges[0].a[0], r.ridges[0].b[0]), 30 - g, 0.26), r.ridges);
  check('irimoya: four hip ridges from the eave corners up to the gables\' feet (kawara caps its hips)', r.hips.length === 4 && r.hips.every(h => near(h.b[1], Hc) && near(h.a[1], 9 + lift - t * F.overhang)), r.hips.map(h => [h.a, h.b]));
  check("irimoya: the eaves reach the form's overhang (3 ft), not the default 1", near(Math.min(...r.planes.flatMap(p => p.poly.map(q => q[2]))), -F.overhang), Math.min(...r.planes.flatMap(p => p.poly.map(q => q[2]))));
  check('irimoya: no dormer, no European attic window, no finial; an onigawara on each end of the ridge', !r.props.some(p => ['dormer', 'finial'].includes(p.role) || p.role.startsWith('gable-')) && r.props.filter(p => p.role === 'onigawara').length === 2, r.props.map(p => p.role));
  check('a culture roof is seated on the walls\' outer face (0.5 ft out from the wall line): on the wall line it stands 0.5 x tan above the wall\'s head', near(plan.heightAt(15, 0), 9 + 0.5 * t, 1e-6) && F.seat === 0.5, plan.heightAt(15, 0));
  const eu = planRoofs([room('e', 0, 0, 6, 4, { style: 'thatch' })]);
  check('a European roof is seated as before, on the wall line', near(eu.heightAt(15, 0), 9, 1e-6));
  check('the shape word wins over the form: a jpn-hall room asked for a gable gets a gable', planRoofs([room('a', 0, 0, 6, 4, { form: 'jpn-hall', kind: 'gable' })]).roofs[0].kind === 'gable');
  const turned = planRoofs([room('a', 0, 0, 6, 4, { form: 'jpn-hall', axis: 'z' })]), tc = coverage(turned, [room('a', 0, 0, 6, 4)]);
  check('irimoya turned 90 degrees: still roofed exactly once, gables on the other pair of walls', tc.bad === 0 && turned.roofs[0].gableEnds.every(G => G.axis === 'z'), `${tc.bad} ${turned.roofs[0].gableEnds.map(G => G.axis)}`);
  const L = [room('a', 0, 0, 6, 4, { form: 'jpn-hall' }), room('b', 0, 4, 3, 4, { form: 'jpn-hall' })], Lp = planRoofs(L), Lc = coverage(Lp, L);
  check('an L of two irimoya rooms: every cell roofed exactly once', Lc.bad === 0, `${Lc.bad}/${Lc.n} ${Lc.worst}`);
  const sq = [room('s', 0, 0, 3, 3, { form: 'chn-temple', style: 'glazed' })], sp = planRoofs(sq), sc = coverage(sp, sq);
  check('a square irimoya (3x3) closes too', sc.bad === 0 && sp.roofs[0].gableEnds.length === 2, sc.worst);
  let worst = 0; for (let k = 0; k < 120; k++) { const w = 2 + (k % 6), d = 2 + ((k * 7) % 5), rs = [room('q', 0, 0, w, d, { form: 'chn-temple', style: 'glazed', seed: k, ...(k % 3 === 0 && { axis: 'z' }) })], cv = coverage(planRoofs(rs), rs); worst = Math.max(worst, cv.bad); }
  check('120 irimoya rectangles 2..7 x 2..6 (some turned): each roofed exactly once', worst === 0, worst);
}

// ---- THE BEND ----
{
  const plan = planRoofs([room('t', 0, 0, 6, 5, { form: 'chn-temple', style: 'glazed' })]), r = plan.roofs[0], B = r.planes.find(p => p.lay?.bend)?.lay.bend;
  check('a temple roof is bent: every slope carries the bend', r.bent && r.planes.filter(p => !p.flat).every(p => p.lay.bend), r.planes.map(p => !!p.lay?.bend));
  const F = ROOF_FORMS['chn-temple'].bend;
  check('the eave line lifts by `eave`, an eave corner by eave + corner', near(bendAt(B, 15, B.z0), F.eave, 1e-6) && near(bendAt(B, B.x0, B.z0), F.eave + F.corner, 1e-6), [bendAt(B, 15, B.z0), bendAt(B, B.x0, B.z0)]);
  check('no lift at the ridge or deep in the slope', bendAt(B, 15, 12.5) === 0 && bendAt(B, 15, B.z0 + B.reach + 0.01) === 0);
  check('the lift is the same on both sides of a hip line (no step where two slopes meet)', [0.5, 1, 2, 3].every(s => near(bendAt(B, B.x0 + s, B.z0 + s + 1e-9), bendAt(B, B.x0 + s + 1e-9, B.z0 + s), 1e-6)));
  check('the lift rises toward the corner along the eave (an upturned corner)', bendAt(B, B.x0 + 1, B.z0) > bendAt(B, B.x0 + 4, B.z0) && bendAt(B, B.x0 + 4, B.z0) > bendAt(B, 15, B.z0));
  const lay = sectionLayout(r);
  check('every section copy carries its 16 bend numbers', lay.bend.length === lay.count * 16 && lay.bent && lay.bend[4] === F.eave && lay.bend[6] > 0, [lay.bend.length, lay.count]);
  const flat = sectionLayout(planRoofs([room('h', 0, 0, 6, 4, { style: 'thatch' })]).roofs[0]);
  check('a European roof is straight: zero bend for every copy', !flat.bent && flat.bend.every(v => v === 0) && flat.bend.length === flat.count * 16);
  const house = planRoofs([room('h', 0, 0, 6, 4, { style: 'tongwa', form: 'chn-house' })]).roofs[0];
  check('an ordinary Beijing house: a plain gable, no bend (the sensitivity read)', house.kind === 'gable' && !house.bent, [house.kind, house.bent]);
  const jh = planRoofs([room('j', 0, 0, 6, 4, { form: 'jpn-house' })]).roofs[0];
  check('an ordinary Kyoto townhouse: a kawara gable (kirizuma), deep eaves, only a slight sweep, no corner lift', jh.kind === 'gable' && jh.bent && ROOF_FORMS['jpn-house'].bend.corner === 0 && near(Math.min(...jh.planes.flatMap(p => p.poly.map(q => q[2]))), -2.5));
  const v = jh.gableEnds[0];
  check('the bend rides on the gable ends, so their verge trim follows the slope', !!v.bend);
  const joined = planRoofs([room('a', 0, 0, 4, 4, { form: 'jpn-house' }), room('b', 4, 0, 4, 4, { form: 'jpn-house' })]);
  const Bj = joined.roofs[0].planes.find(p => p.lay?.bend)?.lay.bend;
  check('two rooms in a line: no upturn where their roofs meet (the shared end is not an eave)', Bj && Bj.x1 > 1000, Bj && Bj.x1);
}

// ---- ORNAMENTS ----
{
  const one = (more, w = 5, d = 4, opts = {}) => planRoofs([room('o', 0, 0, w, d, more)], opts).roofs[0];
  const church = one({ style: 'shingle', form: 'rus', ornament: 'cupola' });
  const cu = church.props.filter(p => p.role === 'cupola');
  check('a Rus\' church: one cupola, on the middle of its ridge', cu.length === 1 && near(cu[0].x, 12.5) && near(cu[0].z, 10) && near(cu[0].y, church.ridgeY - 0.6) && cu[0].wants === 'roof-cupola-onion' && cu[0].fit === 'ornament', cu);
  const ham = one({ style: 'plaster', ornament: 'dome' }, 4, 4), dm = ham.props.filter(p => p.role === 'dome');
  check('a hammam: one dome in the middle of its flat roof, sized to the roof', dm.length === 1 && near(dm[0].x, 10) && near(dm[0].z, 10) && near(dm[0].y, 10 - 0.3) && near(dm[0].dims[0], 12), dm);
  const qaa = one({ style: 'plaster', ornament: 'malqaf' }, 6, 4), mq = qaa.props.filter(p => p.role === 'malqaf');
  check("a qa'a: a wind-catcher against its north edge", mq.length === 1 && mq[0].z < 5 && near(mq[0].rot, Math.PI), mq);
  const dur = one({ style: 'flagstone', ornament: 'chhatris' }, 6, 4), ch = dur.props.filter(p => p.role === 'chhatri');
  check('a Rajput palace hall: a chhatri on each outer corner of its terrace, in place of the corner piers', ch.length === 4 && !dur.props.some(p => p.role === 'corner') && ch.every(p => p.wants === 'ind-chhatri'), dur.props.filter(p => p.role !== 'parapet').map(p => p.role));
  const tem = one({ style: 'flagstone', ornament: 'shikhara' }, 5, 6, { marks: [{ x: 12.5, z: 26 }] }), sk = tem.props.filter(p => p.role === 'shikhara');
  check('a Nagara temple: the shikhara stands over its sanctum (the mark), kept inside the roof', sk.length === 1 && near(sk[0].x, 12.5) && sk[0].z > 18 && sk[0].z + sk[0].dims[2] / 2 <= 30 + 1e-6, sk);
  const tem2 = one({ style: 'flagstone', ornament: 'shikhara' }, 5, 6), sk2 = tem2.props.find(p => p.role === 'shikhara');
  check('no sanctum mark: the shikhara in the middle', sk2 && near(sk2.x, 12.5) && near(sk2.z, 15), sk2);
  const gl = one({ style: 'glazed', form: 'chn-temple' }, 6, 5);
  check('a glazed temple roof: a chiwen on each end of its ridge, looking out along it', gl.props.filter(p => p.role === 'chiwen').length === 2 && gl.props.filter(p => p.role === 'chiwen').every(p => Math.abs(Math.abs(p.out[0]) - 1) < 1e-9), gl.props.filter(p => p.role === 'chiwen').map(p => p.out));
  const row = planRoofs([room('a', 0, 0, 4, 4, { form: 'jpn-house' }), room('b', 4, 0, 4, 4, { form: 'jpn-house' })]).roofs.flatMap(r => r.props.filter(p => p.role === 'onigawara'));
  check('two kawara rooms in a line: onigawara on the two outer ends only, none where the ridge runs on', row.length === 2 && row.every(p => p.x < 5 || p.x > 35), row.map(p => p.x));
  check('ornaments are trim: keyed, and removable by key', [...cu, ...dm, ...ch, ...sk].every(p => typeof p.key === 'string' && p.slide?.on === 'roof'));
  const gone = planRoofs([room('o', 0, 0, 5, 4, { style: 'shingle', form: 'rus', ornament: 'cupola', trim: { [cu[0].key]: { gone: true } } })]).roofs[0];
  check('a removed cupola stays removed (room.roof.trim)', !gone.props.some(p => p.role === 'cupola'));
  check('no ornament on a European roof', !one({ style: 'slate' }).props.some(p => ROOF_ORNAMENTS[p.role] || ['onigawara', 'chiwen', 'cupola', 'dome', 'malqaf', 'shikhara', 'chhatri'].includes(p.role)));
}

console.log(`${pass}/${pass + fail} culture roof checks passed`);
process.exit(fail ? 1 : 0);
