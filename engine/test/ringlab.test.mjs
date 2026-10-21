import assert from 'node:assert/strict';
import {ARC_LIMITS,buildArcItems,pointsOnArc,snapArc} from '../client/ringlab/model.js';
import {BUILTINS,normalize,migrateV1,envelope} from '../client/ringlab/presets.js';
let n=0;const ok=(value,msg)=>{assert.ok(value,msg);n++};
const c={primary:[{id:'a'},{id:'b'}],secondary:[{id:'c'},{id:'d'}]};
for(const [name,preset] of Object.entries(BUILTINS)){const s=normalize(preset);ok(s.arcs.primary.radius>=0,name+' radius');ok(envelope(s).version===2,name+' version');}
const s=normalize(BUILTINS['Quiet brass · Fauna']);
s.arcs.primary.radius=310;s.arcs.secondary.radius=110;
let nodes=buildArcItems(s,c,'expanded',null,1,{x:500,y:500});
ok(nodes.find(x=>x.key==='primary').arc.radius>nodes.find(x=>x.key==='secondary').arc.radius,'radii can swap');
s.arcs.secondary.radius=s.arcs.closed.radius;s.arcs.secondary.start=s.arcs.closed.start;s.arcs.secondary.span=s.arcs.closed.span;
nodes=buildArcItems(s,c,'expanded',null,1,{x:500,y:500});
ok(nodes.find(x=>x.key==='secondary').x===pointsOnArc(s.arcs.closed,c.primary,{x:500,y:500})[0].x,'expanded arc can coincide with closed');
const continuation=snapArc({...s.arcs.secondary,radius:200},{...s.arcs.primary,radius:200,start:5,span:35},'continue',2);
const tail=pointsOnArc({...s.arcs.primary,radius:200,start:5,span:35},c.primary,{x:0,y:0}).at(-1),head=pointsOnArc(continuation,c.secondary,{x:0,y:0})[0];
ok(Math.hypot(head.x-tail.x,head.y-tail.y)>0 && Math.hypot(head.x-tail.x,head.y-tail.y)<160,'continue places next button after previous');
const limits=JSON.stringify(ARC_LIMITS);for(const a of Object.values(s.arcs)){a.radius=0;a.start=-360;a.span=360;a.gap=-80;}ok(JSON.stringify(ARC_LIMITS)===limits,'ranges independent of values');
const old=migrateV1({radius:123,arcStart:0,arcSpan:0,primaryRadius:300,secondaryRadius:100,arcSpacing:0});ok(old.arcs.closed.start===0&&old.arcs.closed.span===0,'v1 zero values retained');ok(normalize({version:1,settings:{radius:123}}).arcs.closed.radius===123,'v1 loads');
console.log('ringlab:',n,'checks');

// ---- Ellipses and one curve (2026-10-19) ----
const { readFileSync } = await import('node:fs');
const M = await import('../client/ringlab/model.js');
const { layouts, GOLDEN_URL } = await import('./ringlab_layouts.mjs');
const counts = {}; const okc = (group, value, msg) => { ok(value, msg); counts[group] = (counts[group] || 0) + 1; };
// 1. Every circle-era preset (and saved-record shapes) lays out bit-for-bit as main did before ellipses.
const golden = JSON.parse(readFileSync(GOLDEN_URL)), now = layouts();
const differ = Object.keys(golden).filter(k => golden[k] !== now[k]);
okc('golden', Object.keys(golden).length === 1032 && Object.keys(now).length === 1032, 'golden covers 1032 layouts');
okc('golden', differ.length === 0, 'circle presets unchanged: ' + differ.slice(0, 5).join(' / '));
for (const name of ['Current game · baseline', 'Mockup 11 · close reading', 'Tight horseshoe', 'Quiet brass · Fauna']) okc('golden', normalize(BUILTINS[name]).curve.on === false && Object.values(normalize(BUILTINS[name]).arcs).every(a => !a.ellipse), name + ' stays circles');
// Arc length between two points of an ellipse, by an independent Simpson integral over its parameter (clockwise > 0).
const tOf = (c, p) => Math.atan2((p.x - c.cx) / c.rx, -(p.y - c.cy) / c.ry);
function arcLen(c, p, q) {
  let a = tOf(c, p), b = tOf(c, q); while (b - a > Math.PI) b -= 2 * Math.PI; while (a - b > Math.PI) b += 2 * Math.PI;
  const N = 2000, h = (b - a) / N, f = t => Math.hypot(c.rx * Math.cos(t), c.ry * Math.sin(t));
  let sum = f(a) + f(b); for (let i = 1; i < N; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return sum * h / 3;
}
// Distance from a point to an ellipse (dense sampling, then refinement).
function offEllipse(c, p) {
  let best = Infinity, bt = 0;
  for (let i = 0; i < 3600; i++) { const t = i / 3600 * 2 * Math.PI, d = Math.hypot(c.cx + c.rx * Math.sin(t) - p.x, c.cy - c.ry * Math.cos(t) - p.y); if (d < best) { best = d; bt = t; } }
  for (let h = 2 * Math.PI / 3600; h > 1e-9; h /= 2) for (const t of [bt - h, bt + h]) { const d = Math.hypot(c.cx + c.rx * Math.sin(t) - p.x, c.cy - c.ry * Math.cos(t) - p.y); if (d < best) { best = d; bt = t; } }
  return best;
}
// 2. An arc made an ellipse with rx = ry = radius is the same circle; spacing then follows arc length.
const circ = { ...normalize(BUILTINS['Current game · baseline']).arcs.secondary }, six = Array.from({ length: 6 }, (_, i) => ({ id: 'i' + i }));
for (const fit of [false, true]) {
  const a = pointsOnArc({ ...circ, fit }, six, { x: 700, y: 450 }), b = pointsOnArc({ ...circ, fit, ellipse: true, rx: circ.radius, ry: circ.radius }, six, { x: 700, y: 450 });
  okc('ellipse arcs', a.every((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y) < 0.05), `circle as ellipse matches (fit ${fit})`);
}
for (const [rx, ry, start, dir] of [[210, 150, -90, 'clockwise'], [320, 140, 200, 'counterclockwise'], [120, 260, -40, 'clockwise']]) {
  const a = { ...circ, ellipse: true, rx, ry, start, fit: true, direction: dir, size: 67, gap: 12, x: 15, y: -40 };
  const pts = pointsOnArc(a, six, { x: 700, y: 450 }), c = { cx: 715, cy: 410, rx, ry };
  pts.slice(1).forEach((p, i) => okc('pitch', Math.abs(Math.abs(arcLen(c, pts[i], p)) - 79) <= 1, `${rx}x${ry} ${dir}: pitch ${arcLen(c, pts[i], p).toFixed(2)}`));
  okc('ellipse arcs', Math.abs(Math.atan2(pts[0].x - 715, -(pts[0].y - 410)) * 180 / Math.PI - ((start + 540) % 360 - 180)) < 0.05, `${rx}x${ry} first button at the start angle`);
  const span = pointsOnArc({ ...a, fit: false, span: 150 }, six, { x: 700, y: 450 }), L = arcLen(c, span[0], span[1]);
  okc('ellipse arcs', span.slice(1).every((p, i) => Math.abs(Math.abs(arcLen(c, span[i], p)) - Math.abs(L)) <= 1), `${rx}x${ry} fit-into-span keeps even distance`);
}
// 3. One curve: the new preset on the real registry snapshot (pawn, every object kind, room, building; GM and player).
const E = normalize(BUILTINS['Ellipse · one curve']), C = E.curve;
okc('preset', C.on && C.rx === 210 && C.ry === 150 && C.size === 67 && C.gap === 12, 'Ellipse · one curve: 67 px, 12 px gap, 210 x 150');
const top = M.sAt(M.ellipseLut(210, 150), 90) - M.sAt(M.ellipseLut(210, 150), -90);
okc('preset', Math.floor(top / 79) + 1 === 8, `9->3 top half ${top.toFixed(1)} px holds 8 buttons at 79 px pitch`);
const reg = JSON.parse(readFileSync(new URL('../../tools/spawn-tuner/ring/registry.json', import.meta.url))).kinds;
const faction = { id: 'faction.set', children: Array.from({ length: 7 }, (_, i) => ({ id: 'faction.' + i })) };
const inSector = (n, A) => n.x + n.size / 2 > A.x && n.y + n.size / 2 > A.y;
const pitch = (C.size + C.gap);
for (const [kind, content] of Object.entries(reg)) for (const A of [{ x: 720, y: 450 }, { x: 640, y: 420 }]) {
  const runs = [['closed', null], ['expanded', null], ...content.secondary.filter(x => x.children?.length).map(x => ['nested', x]), ['nested', faction]];
  for (const [state, nested] of runs) {
    const nodes = buildArcItems(E, content, state, nested, 1, A), fit = M.fitToScreen(nodes, 1440, 900, E.edgeRule, 54);
    const w = M.warnings(fit.nodes, [], 1440, 900, A, [], 54);
    okc('sector', !w.length && !fit.nodes.some(n => inSector(n, A)), `${kind} ${state} ${nested?.id || ''} @${A.x}: ${w.join(', ') || 'clear'}`);
    if (state === 'nested' && nested.children.length) {
      const kids = nodes.filter(n => n.ring);
      okc('nested', kids.length === nested.children.length && kids.every(n => n.curve.rx === C.rx + n.ring * C.nestOffset && n.curve.ry === C.ry + n.ring * C.nestOffset && n.curve.cx === A.x + C.x && n.curve.cy === A.y + C.y), `${kind} ${nested.id}: grown by ${C.nestOffset} on both semi-axes, never scaled`);
      for (const ring of new Set(kids.map(n => n.ring))) { const r = kids.filter(n => n.ring === ring); r.slice(1).forEach((p, i) => okc('pitch', Math.abs(arcLen(p.curve, r[i], p) - pitch) <= 1, `${kind} ${nested.id} ring ${ring} pitch`)); }
    }
  }
  // Continuity: the expanded primaries, secondaries and ☰ are one ellipse, in order, pitch apart, one group gap.
  const ex = buildArcItems(E, content, 'expanded', null, 1, A), c = ex[0]?.curve;
  if (!ex.length) continue;
  okc('one curve', ex.every(n => offEllipse(c, n) < 0.5 && n.curve.rx === c.rx && n.curve.cy === c.cy), `${kind}: one ellipse`);
  const order = [...ex].sort((a, b) => a.curve.s - b.curve.s), keys = order.map(n => n.key).join(' ');
  okc('one curve', /^(primary )*(secondary )*(menu)?$/.test(keys + ' ') || /^(primary )*(secondary )*menu$/.test(keys), `${kind}: order ${keys}`);
  order.slice(1).forEach((q, i) => {
    const p = order[i], want = pitch + (p.key === 'primary' && q.key !== 'primary' ? C.groupGap : 0);   // (☰ is one more button: no gap of its own)
    okc('one curve', Math.abs(arcLen(c, p, q) - want) <= 1, `${kind}: ${p.item.id} -> ${q.item.id} ${arcLen(c, p, q).toFixed(2)} (want ${want})`);
  });
  const cl = buildArcItems(E, content, 'closed', null, 1, A);
  okc('one curve', cl.every(n => n.curve && offEllipse(c, n) < 0.5), `${kind}: closed row on the same ellipse`);
  if (content.secondary.length) okc('one curve', [...cl].sort((a, b) => a.curve.s - b.curve.s).at(-1).item.id === 'menu' && order.at(-1).item.id === 'menu', `${kind}: ☰ at the right end, closed and open`);
  // ☰ IS EXACTLY LIKE EVERY OTHER BUTTON (Harry 2026-10-20): shut, one pitch after the last main button; open, one pitch
  // after the last extra button; the same size; its slide staggers as the next button of the row it ends in
  if (content.secondary.length) {
    const sc = [...cl].sort((a, b) => a.curve.s - b.curve.s);
    if (sc.length > 1) okc('menu', Math.abs(arcLen(c, sc.at(-2), sc.at(-1)) - pitch) <= 1, `${kind}: shut, ☰ one pitch after the last main button (${arcLen(c, sc.at(-2), sc.at(-1)).toFixed(2)})`);
    okc('menu', [...cl, ...ex].every(n => n.size === cl[0].size), `${kind}: ☰ the same size as the rest, shut and open`);
    okc('menu', M.rowOf(cl.find(n => n.item.id === 'menu'), 'closed') === 'closed' && M.rowOf(ex.find(n => n.item.id === 'menu'), 'expanded') === 'secondary', `${kind}: ☰ staggers with its row`);
  }
  // 4. The slide: every primary moves counterclockwise along the curve; the in-between points the browser draws (the
  //    chord midpoints between keyframes) stay on the ellipse, and no moment of the slide enters 3-6.
  for (const [a, b] of [[cl, ex], [ex, cl]]) for (const n of b) {
    const o = a.find(x => x.item.id === n.item.id); if (!o) continue;
    const k = M.slideKeyframes(n.curve, o.curve.s, n.curve.s), mids = k.slice(1).map((f, i) => ({ x: (f.x + k[i].x) / 2, y: (f.y + k[i].y) / 2 }));
    const worst = Math.max(...mids.map(p => offEllipse(c, p)), ...k.map(p => offEllipse(c, p)));
    okc('slide', worst <= 2, `${kind} ${n.item.id} ${a === cl ? 'open' : 'close'}: worst ${worst.toFixed(3)} px off the ellipse`);
    okc('sector', !k.some(p => inSector({ ...p, size: n.size }, A)), `${kind} ${n.item.id} slide stays out of 3-6`);
    if (n.key === 'primary') okc('slide', o.curve.s > n.curve.s, `${kind} ${n.item.id} slides counterclockwise on opening`);
  }
}
// 5. The ☰ grows the same way for any arc: "Grow from" adds one offset to both semi-axes.
const grown = snapArc({ ...circ, size: 67, gap: 12 }, { ...circ, ellipse: true, rx: 210, ry: 150, size: 67 }, 'grow');
okc('nested', grown.ellipse && grown.rx === 210 + 79 && grown.ry === 150 + 79, 'Grow from: +79 on both semi-axes');
// 6. The lowest floor at a point (2026-10-20): ground, or a cellar's floor; core/height.js lowestFloorAt.
const HT = await import('../core/height.js');
const rooms = { c: { id: 'c', kind: 'room', recipe: { type: 'common', x: 2, z: 10, w: 4, d: 4, y: -10 } }, g: { id: 'g', kind: 'room', recipe: { type: 'common', x: 2, z: 2, w: 6, d: 5 } }, u: { id: 'u', kind: 'room', recipe: { type: 'common', x: 2, z: 2, w: 6, d: 5, y: 10 } } };
okc('floor', HT.lowestFloorAt(rooms, 20, 60) === -10, 'over the cellar: -10');
okc('floor', HT.lowestFloorAt(rooms, 20, 20) === 0, 'in a room with one above it: the ground');
okc('floor', HT.lowestFloorAt(rooms, 200, 200) === 0, 'open ground: 0');
okc('floor', HT.lowestFloorAt({}, 0, 0) === 0, 'no rooms: 0');
// 7. Plain words (2026-10-20): every angle reads as a clock.
const PNL = await import('../client/ringlab/panel.js');
for (const [deg, want] of [[0, '12:00'], [90, '3:00'], [180, '6:00'], [-90, '9:00'], [270, '9:00'], [-180, '6:00'], [-21, '11:18']]) okc('clock', PNL.clockText(deg) === want, `${deg}° reads ${want} (got ${PNL.clockText(deg)})`);
okc('clock', PNL.clockSpan(100) === '3 h 20 min' && PNL.clockSpan(30) === '1 h' && PNL.clockSpan(15) === '30 min', 'a spread reads as clock time');
// 8. With One curve on, which knobs are INERT (no effect on any button's place or motion), measured, not guessed: the
//    separate rings' every field (the sub-menus keep their slide time and easing only). And no knob the short drawer
//    shows is dead: each one changes the layout, the motion or the world size.
const door = { primary: reg['openable:gm'].primary, secondary: reg['openable:gm'].secondary };
const kinds = [reg['pawn:gm'], reg['room:gm'], door, reg['light:gm']];
const out = (s, extra = {}) => JSON.stringify([kinds.flatMap(c => ['closed', 'expanded', ...c.secondary.filter(x => x.children?.length).map(x => x.id), 'faction.set'].map(st => {
  const nest = st.includes('.') ? (c.secondary.find(x => x.id === st) || { id: 'faction.set', children: [{ id: 'f1' }, { id: 'f2' }] }) : null;
  return buildArcItems(s, c, nest ? 'nested' : st, nest, 1, { x: 700, y: 450 }).map(n => [n.item.id, n.key, +n.x.toFixed(6), +n.y.toFixed(6), n.size, n.arc.duration, n.arc.stagger, n.arc.easing]);
})), [2, 6, 30].map(px => [5, 20, 80].map(b => s.world.on ? M.worldScale(s, px, b) : null))]);   // (world.on is what makes the lab apply the scale: surfaces/ringlab.js)
const bump = v => typeof v === 'boolean' ? !v : typeof v === 'number' ? v + 7 : v === null ? 123 : v === 'clockwise' ? 'counterclockwise' : v === 'counterclockwise' ? 'clockwise' : v === 'ease-out' ? 'linear' : v === 'slot' ? 'centre' : v === 'primary' ? 'secondary' : v === 'secondary' ? 'primary' : v === 'menu' ? 'nested' : v === 'nested' ? 'menu' : v + 'x';
const E2 = normalize(BUILTINS['Ellipse · one curve']), base0 = out(E2), inert = [], live = [];
for (const key of ['closed', 'primary', 'secondary', 'menu', 'conditions', 'faction', 'nested']) for (const f of Object.keys(E2.arcs[key])) {
  const t = structuredClone(E2); t.arcs[key][f] = bump(t.arcs[key][f]); (out(t) === base0 ? inert : live).push(`${key}.${f}`);
}
okc('inert', live.length === 0, 'One curve on: every separate-ring field is inert (the drawer hides them all): live ' + live.join(' '));
okc('inert', inert.length === 7 * Object.keys(E2.arcs.closed).length, `${inert.length} separate-ring fields measured inert`);
for (const w of [false, true]) {
  const s0 = structuredClone(E2); s0.world.on = w; if (w) s0.world.buttonFt = 6;
  const shown = PNL.simplePaths(s0).flatMap(([, ps]) => ps), b0 = out(s0);
  for (const p of shown) { const t = structuredClone(s0); const v = PNL.getPath(t, p); PNL.setPath(t, p, /(At|Start|Floor|End)$/.test(p) ? v + 30 : bump(v)); okc('live', out(t) !== b0, `short drawer${w ? ' (Size in the world on)' : ''}: ${p} does something`); }
  okc('live', shown.length <= 20 && !shown.includes('curve.on') && shown.includes('curve.nestStart') && shown.includes('curve.nestEnd'), `short drawer: ${shown.length} knobs (20 at most), no One curve tick, sub-menu start and end`);
}
// 9. Size in the world: button px = buttonFt x px-per-ft x growth, inside the comfort band; the shape scales as one.
const Wd = structuredClone(E2); Object.assign(Wd.world, { on: true, buttonFt: 6, grow: 1, minPx: 40, maxPx: 110, pure: false });
for (const px of [8, 10, 12, 15, 18]) okc('world', Math.abs(M.worldScale(Wd, px, 5).buttonPx - 6 * px) < 1e-9 && !M.worldScale(Wd, px, 5).clamped, `between the limits the button follows px per ft (1/distance): ${px} px/ft -> ${6 * px} px`);
okc('world', M.worldScale(Wd, 200, 5).buttonPx === 110 && M.worldScale(Wd, 200, 5).clamped === 'largest' && M.worldScale(Wd, 1, 5).buttonPx === 40 && M.worldScale(Wd, 1, 5).clamped === 'smallest', 'the comfort band holds at both ends');
okc('world', M.worldScale(Wd, 2, 20).grow === 4 && M.worldScale(Wd, 2, 80).grow === 16 && M.worldScale(Wd, 2, 5).grow === 1 && M.worldScale(Wd, 2, 2.5).grow === 1, 'a 20 ft base grows the ring x4, 80 ft x16; Medium and Small x1');
okc('world', M.worldScale({ ...Wd, world: { ...Wd.world, grow: 0 } }, 2, 80).grow === 1 && Math.abs(M.worldScale({ ...Wd, world: { ...Wd.world, grow: .5 } }, 2, 80).grow - 4) < 1e-12, 'the growth knob is an exponent');
okc('world', M.worldScale({ ...Wd, world: { ...Wd.world, pure: true } }, 200, 5).buttonPx === 1200 && M.worldScale({ ...Wd, world: { ...Wd.world, pure: true } }, 200, 5).clamped === null, 'pure world size: no limits');
for (const sc of [0.4, 1.7, 3.3]) {
  const a = buildArcItems(E2, reg['light:gm'], 'expanded', null, 1, { x: 0, y: 0 }), b = buildArcItems(E2, reg['light:gm'], 'expanded', null, sc, { x: 0, y: 0 });
  okc('world', a.every((n, i) => Math.abs(b[i].x / sc - n.x) < 1e-6 && Math.abs(b[i].y / sc - n.y) < 1e-6 && Math.abs(b[i].size / sc - n.size) < 1e-9), `the shape is invariant: positions / scale identical at x${sc}`);
}
okc('preset', normalize(BUILTINS['Ellipse · one curve']).world.on === true && ['Current game · baseline', 'Mockup 11 · close reading', 'Tight horseshoe', 'Quiet brass · Fauna'].every(k => normalize(BUILTINS[k]).world.on === false), 'Ellipse · one curve is world-sized; the circle presets are not');
// 10. An old saved ring with a ☰ gap loads, and the gap is gone (2026-10-20)
{ const withGap = structuredClone(normalize(BUILTINS['Ellipse · one curve'])); withGap.curve.menuGap = 40; const n2 = normalize({ version: 2, settings: withGap });
  okc('menu', !('menuGap' in n2.curve) && out(n2) === out(normalize(BUILTINS['Ellipse · one curve'])), 'a saved ring carrying menuGap 40 loads and lays out exactly as without it');
  const c2 = structuredClone(withGap); c2.centre.pawn = 33; c2.world.buttonFt = 4.5; const n3 = normalize({ version: 2, settings: c2 });
  okc('menu', n3.centre.pawn === 33 && n3.world.buttonFt === 4.5 && n3.curve.rx === c2.curve.rx, 'and the rest of it still loads: centre, world and curve kept');
  okc('menu', !PNL.simplePaths(n2).flat(2).includes('curve.menuGap') && !('menuGap' in M.CURVE_LIMITS), 'no ☰-only knob in Ring lab'); }
// 11. A ROW SLIDES, IT DOES NOT BREAK (Harry 2026-10-21): with Harry's own rings (Revised 4, rev 5, unchanged, from
//     /tuner/rings) and the built-in, on every kind, shut / open / every sub-menu, at three sizes: no button and no name in
//     3–6; ☰ on the main curve, the last button of the row; only a row that fits nowhere on the curve steps EXTRA buttons out
{ const harry = JSON.parse(readFileSync(new URL('../../tests/data/ring-house-rings-2026-10-21.json', import.meta.url)));
  for (const [nm, S] of [...Object.entries(harry).map(([k, v]) => [k, normalize(v)]), ['built-in', normalize(BUILTINS['Ellipse · one curve'])]]) {
    let n0 = 0, inSec = [], menuOff = [], stepped = [];
    for (const [kind, c] of Object.entries(reg)) for (const sc of [0.6, 1, 1.6]) for (const st of ['closed', 'expanded', ...c.secondary.filter(x => x.children?.length).map(x => x.id)]) {
      const nest = st.includes('.') ? c.secondary.find(x => x.id === st) : null, A = { x: 720, y: 450 };
      const ns = buildArcItems(S, c, nest ? 'nested' : st, nest, sc, A), test = M.sectorTest(S, sc, A); n0++;
      if (ns.some(n => test(n))) inSec.push(`${kind} ${st} x${sc}`);
      const main = ns.filter(n => !n.spilled && !n.ring).sort((a, b) => a.curve.s - b.curve.s), m = ns.find(n => n.item.id === 'menu');
      if (m && (m.spilled || m.ring || main.at(-1) !== m)) menuOff.push(`${kind} ${st} x${sc}`);
      if (ns.some(n => n.spilled)) stepped.push(`${kind} ${st}`);
    }
    okc('slide', !inSec.length, `${nm}: no button or name in 3–6 over ${n0} rings: ${inSec.slice(0, 3).join(' / ')}`);
    okc('slide', !menuOff.length, `${nm}: ☰ always the last button of the row, on the curve: ${menuOff.slice(0, 3).join(' / ')}`);
    if (nm === 'built-in') okc('slide', !stepped.length, 'built-in: nothing steps out');
  }
  // a slid row is the same shape at any size (the ring is world-sized: the screen edge changes its scale, not its shape)
  for (const [nm, v] of Object.entries(harry)) { const S = normalize(v); let worst = 0;
    for (const [kind, c] of Object.entries(reg)) for (const st of ['expanded', ...c.secondary.filter(x => x.children?.length).map(x => x.id)]) {
      const nest = st.includes('.') ? c.secondary.find(x => x.id === st) : null, A = { x: 500, y: 400 }, ref = buildArcItems(S, c, nest ? 'nested' : st, nest, 1, A);
      for (const sc of [0.43, 0.77, 1.62]) buildArcItems(S, c, nest ? 'nested' : st, nest, sc, A).forEach((q, i) => { worst = Math.max(worst, ref[i] ? Math.hypot((q.x - A.x) / sc - (ref[i].x - A.x), (q.y - A.y) / sc - (ref[i].y - A.y)) : 1e9); }); }
    okc('slide', worst < 1, `${nm}: every slid row and sub-menu is the same shape at x0.43 … x1.62 (worst ${worst.toFixed(3)} px)`); }
  // and a slid sub-menu never lands on a button of the open row under it (rev 5's sub-menu ring is 1 px clear of the main one)
  for (const [nm, v] of Object.entries(harry)) { const S = normalize(v), hit = [];
    for (const [kind, c] of Object.entries(reg)) for (const st of c.secondary.filter(x => x.children?.length).map(x => x.id)) for (let sc = 0.3; sc < 2.01; sc += 0.05) {
      const nest = c.secondary.find(x => x.id === st), A = { x: 700, y: 450 }; if (M.warnings(buildArcItems(S, c, 'nested', nest, sc, A), [], 1e5, 1e5, A, [], -1e5).includes('button overlap')) hit.push(`${kind} ${st} x${sc.toFixed(2)}`); }
    okc('slide', !hit.length, `${nm}: no sub-menu button overlaps another, x0.3 … x2: ${hit.slice(0, 3).join(' / ')}`); }
  const r5 = normalize(harry['rev 5']), pawn = buildArcItems(r5, reg['pawn:gm'], 'expanded', null, 1, { x: 720, y: 450 });
  okc('slide', pawn.slid?.row === 'expanded' && pawn.slid.to > pawn.slid.from, `rev 5, a pawn opened: the row slid forward off 6:00 (its first name reached past it) and says so: ${JSON.stringify(pawn.slid)}`);
  okc('slide', JSON.stringify(normalize(harry['rev 5']).curve) === JSON.stringify(r5.curve) && harry['rev 5'].data.settings.curve.primaryFloor === -160, 'his numbers are untouched: a layout rule, not a settings edit');
}
console.log('ringlab ellipse:', Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('ringlab:', n, 'checks');
