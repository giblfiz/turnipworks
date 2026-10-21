// Ring Lab geometry. This module has no DOM or game dependency; the offline bench and live surface use it.
// Angles are clock positions: 0 is up, 90 right, 180 down. Spans are signed only by direction.
export const ARC_KEYS = ['closed', 'primary', 'secondary', 'menu', 'conditions', 'faction', 'nested'];
export const ARC_HOLDS = ['primary', 'secondary', 'menu', 'nested'];
export const ARC_LIMITS = Object.freeze({ radius: [0, 600, 1], rx: [0, 600, 1], ry: [0, 600, 1], start: [-360, 360, 1], span: [0, 360, 1], gap: [-80, 160, 1], size: [20, 128, 1], x: [-500, 500, 1], y: [-500, 500, 1], duration: [0, 1200, 10], stagger: [0, 150, 1] });

export const arc = (holds, radius, start, span, extra = {}) => ({
  holds, radius, start, span, fit: false, direction: 'clockwise', gap: 10, size: 62, x: 0, y: 0,
  from: 'slot', duration: 300, stagger: 15, easing: 'ease-out',
  // An arc is a circle of `radius` until `ellipse` is on; then rx / ry (null = radius) and spacing by arc length.
  ellipse: false, rx: null, ry: null, ...extra,
});

// One curve (Harry 2026-10-19): primaries, secondaries and ☰ share ONE ellipse; on opening the primaries slide along it
// past 9 o'clock while the secondaries take the top. Off by default, so every circle-era preset lays out as before.
export const CURVE_LIMITS = Object.freeze({
  rx: [40, 600, 1], ry: [40, 600, 1], x: [-300, 300, 1], y: [-400, 300, 1], size: [20, 128, 1], gap: [-20, 80, 1],
  groupGap: [0, 160, 1], closedAt: [-180, 180, 1], secondaryStart: [-180, 180, 1], primaryFloor: [-200, 0, 1],
  nestOffset: [40, 240, 1], nestStart: [-180, 180, 1], nestEnd: [-180, 180, 1], duration: [0, 2000, 10], stagger: [0, 150, 1],
});
export const CURVE_EASINGS = ['ease-in-out', 'ease-out', 'linear', 'cubic-bezier(.2,.8,.2,1)', 'cubic-bezier(.6,0,.2,1)'];
export const curveDefaults = (extra = {}) => ({
  on: false, rx: 210, ry: 150, x: 0, y: 0, size: 67, gap: 12, groupGap: 16,
  closedAt: 0, secondaryStart: -90, primaryFloor: -160, nestOffset: 80, nestStart: -150, nestEnd: 75,
  duration: 520, stagger: 30, easing: 'ease-in-out', enter: 'from ☰', ...extra,
});

// SIZE IN THE WORLD (Harry 2026-10-20: "size measured in ft, and it's ok if part of it expands or scrolls off screen ...
// the oval is always an oval"). The whole ring (oval, buttons, gaps, labels, sub-menu) is ONE shape scaled as a unit:
//   button px = buttonFt × (px per ft at the piece's depth) × max(1, piece base ft / 5) ^ grow,
// held in [minPx, maxPx] (unless pure): when held, the whole ring stops shrinking or growing. The shape knobs are px at
// the design scale, where a button is the curve's (or closed ring's) `size`. No screen fitting in this mode.
export const WORLD_LIMITS = Object.freeze({ buttonFt: [0.2, 20, 0.05], grow: [0, 1.5, 0.05], minPx: [10, 200, 1], maxPx: [20, 300, 1] });
// buttonFt 6: the default play view (resetView: 95 ft away, pitch 52) shows a Medium pawn at 11.4 px per ft, so 6 ft is
// today's 68 px button there (measured 2026-10-20, tests/browser_ring_ellipse.py).
export const worldDefaults = (extra = {}) => ({ on: false, buttonFt: 6, grow: 1, minPx: 40, maxPx: 110, pure: false, ...extra });
export function worldScale(settings, pxPerFt, baseFt = 5) {
  const W = settings.world || worldDefaults(), ref = settings.curve?.on ? +settings.curve.size : +settings.arcs.closed.size;
  const grow = Math.pow(Math.max(1, (+baseFt || 5) / 5), +W.grow);
  const want = +W.buttonFt * pxPerFt * grow, px = W.pure ? want : Math.min(+W.maxPx, Math.max(+W.minPx, want));
  return { scale: px / Math.max(1, ref), buttonPx: px, wantPx: want, grow, pxPerFt, baseFt, clamped: W.pure ? null : want < +W.minPx ? 'smallest' : want > +W.maxPx ? 'largest' : null };
}

// ---- Ellipse geometry ----------------------------------------------------------------------------------------------
// Clock angle θ is the DIRECTION from the centre (0 up, 90 right), the parameter t the ellipse's own angle
// (x = rx·sin t, y = −ry·cos t). Arc length s runs clockwise and is 0 at 12 o'clock; it is unwrapped (a second lap
// keeps counting), so a slide from s0 to s1 never jumps across the seam.
const D = Math.PI / 180, LUT_N = 2048, luts = new Map();
export function ellipseLut(rx, ry) {
  rx = Math.max(1e-3, +rx); ry = Math.max(1e-3, +ry);
  const key = rx + '|' + ry; let lut = luts.get(key);
  if (lut) return lut;
  const t = new Float64Array(LUT_N + 1), s = new Float64Array(LUT_N + 1);
  let px = 0, py = 0;
  for (let i = 0; i <= LUT_N; i++) {
    const a = -180 + 360 * i / LUT_N, x = rx * Math.sin(a * D), y = -ry * Math.cos(a * D);
    t[i] = a; s[i] = i ? s[i - 1] + Math.hypot(x - px, y - py) : 0; px = x; py = y;
  }
  const zero = s[LUT_N / 2]; for (let i = 0; i <= LUT_N; i++) s[i] -= zero;
  lut = { rx, ry, t, s, L: s[LUT_N] - s[0] };
  if (luts.size > 64) luts.clear();
  luts.set(key, lut); return lut;
}
export const paramOf = (rx, ry, angle) => Math.atan2(Math.sin(angle * D) / rx, Math.cos(angle * D) / ry) / D;
export const clockOf = (rx, ry, t) => Math.atan2(rx * Math.sin(t * D), ry * Math.cos(t * D)) / D;
export const ellipsePoint = (cx, cy, rx, ry, t) => ({ x: cx + rx * Math.sin(t * D), y: cy - ry * Math.cos(t * D) });
// Arc length at clock angle θ (any real θ; laps add L).
export function sAt(lut, angle) {
  const lap = Math.floor((+angle + 180) / 360), a = +angle - 360 * lap;
  let t = paramOf(lut.rx, lut.ry, a); if (a < -179.999999 && t > 0) t = -180;
  const f = Math.min(LUT_N, Math.max(0, (t + 180) / 360 * LUT_N)), i = Math.min(LUT_N - 1, Math.floor(f));
  return lut.s[i] + (lut.s[i + 1] - lut.s[i]) * (f - i) + lap * lut.L;
}
// Parameter t and clock angle at arc length s (unwrapped like sAt).
export function atS(lut, s) {
  const lap = Math.floor((s - lut.s[0]) / lut.L), r = s - lap * lut.L;
  let lo = 0, hi = LUT_N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lut.s[m] <= r) lo = m; else hi = m; }
  const f = (r - lut.s[lo]) / Math.max(1e-12, lut.s[hi] - lut.s[lo]), t = lut.t[lo] + (lut.t[hi] - lut.t[lo]) * f;
  return { t: t + 360 * lap, angle: clockOf(lut.rx, lut.ry, t) + 360 * lap };
}
export function curvePoint(c, s) { const lut = ellipseLut(c.rx, c.ry), { t, angle } = atS(lut, s); return { ...ellipsePoint(c.cx, c.cy, c.rx, c.ry, t), angle }; }
// Keyframes for a slide along the ellipse from arc length s0 to s1: one about every `every` px of travel, so the
// browser's straight steps between them stay within a fraction of a pixel of the curve. shift0/shift1 are the edge
// rule's screen shifts at either end (both 0 unless the ring is pushed off an edge).
export function slideKeyframes(c, s0, s1, { every = 6, shift0 = [0, 0], shift1 = [0, 0] } = {}) {
  const steps = Math.max(2, Math.ceil(Math.abs(s1 - s0) / every));
  return Array.from({ length: steps + 1 }, (_, k) => {
    const u = k / steps, p = curvePoint(c, s0 + (s1 - s0) * u);
    return { offset: u, x: p.x + shift0[0] + (shift1[0] - shift0[0]) * u, y: p.y + shift0[1] + (shift1[1] - shift0[1]) * u };
  });
}
const onCurve = (item, key, c, s, size, arc) => { const p = curvePoint(c, s); return { item, key, angle: p.angle, center: { x: c.cx, y: c.cy }, x: p.x, y: p.y, size, arc, curve: { cx: c.cx, cy: c.cy, rx: c.rx, ry: c.ry, s } }; };
function pointsOnEllipse(a, items, anchor, scale, key) {
  const count = items.length, sign = a.direction === 'counterclockwise' ? -1 : 1;
  const c = { cx: anchor.x + a.x * scale, cy: anchor.y + a.y * scale, rx: (a.rx ?? a.radius) * scale, ry: (a.ry ?? a.radius) * scale };
  const lut = ellipseLut(c.rx, c.ry), s0 = sAt(lut, +a.start);
  // fit: a fixed pitch (size + gap) along the curve from the start; otherwise even arc length across the span.
  const len = sAt(lut, +a.start + sign * (+a.span || 0)) - s0, pitch = (+a.size + +a.gap) * scale;
  return items.map((item, i) => onCurve(item, key, c, a.fit ? s0 + sign * i * pitch : count <= 1 ? s0 + len / 2 : s0 + len * i / (count - 1), +a.size * scale, a));
}

export const point = (cx, cy, radius, angle) => ({
  x: cx + radius * Math.sin(angle * Math.PI / 180),
  y: cy - radius * Math.cos(angle * Math.PI / 180),
});

export function spanOf(a, count, scale = 1) {
  if (!a.fit) return +a.span || 0;
  if (count < 2) return 0;
  // Fit is an explicit mode, never a silent enlargement of the chosen span.
  return (count - 1) * ((+a.size + +a.gap) * scale) / Math.max(1, +a.radius * scale) * 180 / Math.PI;
}

export function pointsOnArc(a, items, anchor, scale = 1, key = '') {
  if (a.ellipse) return pointsOnEllipse(a, items, anchor, scale, key);
  const count = items.length, sign = a.direction === 'counterclockwise' ? -1 : 1;
  const span = spanOf(a, count, scale), center = { x: anchor.x + a.x * scale, y: anchor.y + a.y * scale };
  return items.map((item, i) => {
    const angle = +a.start + sign * (count <= 1 ? span / 2 : span * i / (count - 1));
    const p = point(center.x, center.y, +a.radius * scale, angle);
    return { item, key, angle, center, x: p.x, y: p.y, size: +a.size * scale, arc: a };
  });
}

export function snapArc(target, source, how, sourceCount = 1, scale = 1) {
  const out = { ...target }, sign = source.direction === 'counterclockwise' ? -1 : 1;
  if (how === 'radius') out.radius = source.radius;
  if (how === 'align') out.start = source.start;
  if (how === 'continue') {
    const step = ((+source.size + +target.size) / 2 + +target.gap) * scale / Math.max(1, +target.radius * scale) * 180 / Math.PI;
    out.start = +source.start + sign * (spanOf(source, sourceCount, scale) + step);
    out.direction = source.direction;
  }
  if (how === 'grow') {
    // Grow, never scale: both semi-axes gain the same offset, so the gap between the arcs is even all round.
    const off = (+source.size + +target.size) / 2 + +target.gap;
    Object.assign(out, { ellipse: true, rx: (source.ellipse ? source.rx ?? source.radius : source.radius) + off, ry: (source.ellipse ? source.ry ?? source.radius : source.radius) + off, x: source.x, y: source.y, radius: +source.radius + off });
  }
  if (how === 'mirror') { out.start = -(+source.start); out.span = source.span; out.fit = source.fit; out.direction = source.direction === 'clockwise' ? 'counterclockwise' : 'clockwise'; out.x = -source.x; out.y = source.y; }
  return out;
}

export function nestedKey(id = '') {
  if (id === 'faction.set') return 'faction';
  if (id.startsWith('pawn.cond.')) return 'conditions';
  return 'nested';
}

export function buildArcItems(settings, content, state = 'closed', nested = null, scale = 1, anchor = { x: 0, y: 0 }) {
  if (settings.curve?.on) return buildCurveItems(settings, content, state, nested, scale, anchor);
  const primary = content.primary || [], secondary = content.secondary || [];
  const menu = secondary.length ? [{ id: 'menu', label: 'All options', icon: 'menu' }] : [];
  const children = nested?.children || [];
  const pool = { primary, secondary, menu, nested: children };
  const keys = state === 'closed' ? ['closed', 'menu'] : state === 'nested' ? ['primary', 'secondary', 'menu', nestedKey(nested?.id)] : ['primary', 'secondary', 'menu'];
  return keys.flatMap(key => {
    const a = settings.arcs[key] || settings.arcs.nested;
    if (!a) return [];
    // ☰ has one independent position in each state; closed and expanded use the same object.
    if (key === 'menu' && !menu.length) return [];
    const items = pool[a.holds] || [];
    return pointsOnArc(a, items, anchor, scale, key);
  });
}

// The one-curve layout. Arc-length positions (clockwise, px at this scale):
//   closed    P1 … Pn, ☰  centred on closedAt. ☰ IS ONE MORE BUTTON IN THE ROW (Harry 2026-10-20: "the 'fewer options'
//             button should get added to the orbital as if it is exactly like every other button. No special
//             spacing/size/settings"): the same curve, pitch, size and slide; there is no menuGap any more (an old
//             saved ring that carries one loads, and it is dropped: presets.js normalize).
//   expanded  S1 at secondaryStart, S2 … Sm, ☰ clockwise; Pn one pitch + groupGap counterclockwise of S1, … P1 last.
//             The primaries keep their order and spacing, so opening slides the group rigidly along the curve.
//             If P1 would pass primaryFloor (the bottom of the curve runs under the pawn, into 3–6), the whole expanded
//             row turns clockwise just enough to keep P1 there: still one curve, the junction a little above 9.
//   nested    the same ellipse grown by nestOffset on BOTH semi-axes, pitch-spaced from nestStart clockwise and never
//             past nestEnd; what does not fit starts the next ring out (another nestOffset).
// The slide's stagger runs along each row: ☰ is the row's last button (shut: after the main buttons; open: after the extra
// ones), not a group of its own that set off at once.
export const rowOf = (n, view) => n.key === 'menu' ? (view === 'closed' ? 'closed' : 'secondary') : n.key;
export function curveOf(settings, scale = 1, anchor = { x: 0, y: 0 }, grow = 0) {
  const C = settings.curve, g = grow * C.nestOffset * scale;
  return { cx: anchor.x + C.x * scale, cy: anchor.y + C.y * scale, rx: C.rx * scale + g, ry: C.ry * scale + g };
}
export function curveSlots(settings, counts, scale = 1, anchor = { x: 0, y: 0 }) {
  const C = settings.curve, c = curveOf(settings, scale, anchor), lut = ellipseLut(c.rx, c.ry);
  const pitch = (C.size + C.gap) * scale, np = counts.primary, nm = counts.menu ? 1 : 0, ns = counts.secondary;
  const row = Array.from({ length: np + nm }, (_, i) => i * pitch);
  const inSector = sectorTest(settings, scale, anchor), bad = s => inSector(curvePoint(c, s));
  const all = L => [...L.primary, ...L.secondary, ...L.menu];
  // THE 3–6 SECTOR IS NEVER ENTERED, AND A ROW STAYS ONE ROW (Harry 2026-10-21, approving: "slide the WHOLE row back ...
  // instead of stepping end buttons out one ring. ☰ must always stay in line as the row's last button"): a row that would
  // put a button or its name in 3–6 slides along its own curve, as a whole, to the nearest place where every button and
  // name is clear (back, anticlockwise, first; forward when it is the FIRST button's name that reaches 6:00). Only a row
  // that fits nowhere on the curve steps its end buttons one ring out. No setting changes: `slid` says how far it went.
  const settle = (lay, s0) => {
    const ok = s => !all(lay(s)).some(bad);
    if (ok(s0)) return s0;
    for (let d = 2 * scale; d <= lut.L / 2; d += 2 * scale) { if (ok(s0 - d)) return s0 - d; if (ok(s0 + d)) return s0 + d; }
    return null;
  };
  const shut = f => ({ primary: row.slice(0, np).map(v => f + v), secondary: [], menu: nm ? [f + row.at(-1)] : [] });
  const first0 = sAt(lut, C.closedAt) - (row.length ? row.at(-1) / 2 : 0), first = settle(shut, first0) ?? first0;
  const back = np ? C.groupGap * scale + np * pitch : 0;
  const s10 = Math.max(sAt(lut, C.secondaryStart), sAt(lut, C.primaryFloor) + back);
  const lay = s1 => ({
    primary: Array.from({ length: np }, (_, i) => s1 - C.groupGap * scale - (np - i) * pitch),
    secondary: Array.from({ length: ns }, (_, j) => s1 + j * pitch),
    menu: nm ? [s1 + ns * pitch] : [],
  });
  // A row that fits nowhere on the curve: the fewest LAST EXTRA buttons step one ring out, so ☰ still closes the row
  // in line (buildCurveItems puts them out there, above where the row ends)
  let spill = 0, s1 = settle(lay, s10);
  const layK = k => s1 => { const L = lay(s1); return { ...L, secondary: L.secondary.slice(0, ns - k), menu: nm ? [s1 + (ns - k) * pitch] : [] }; };
  for (let k = 1; s1 == null && k <= ns; k++) { const t = settle(layK(k), s10); if (t != null) { s1 = t; spill = k; } }
  if (s1 == null) s1 = s10;
  const ex = spill ? layK(spill)(s1) : lay(s1);
  const at = s => atS(lut, s).angle;
  return {
    curve: c, pitch, junction: at(s1), spill,
    closed: { primary: row.slice(0, np).map(v => first + v), menu: nm ? [first + row.at(-1)] : [] },
    expanded: ex,
    // (Ring lab's readout: where the setting puts the row, and where it went)
    slid: { closed: Math.abs(first - first0) > 0.5 ? { from: at(first0 + (row.length ? row.at(-1) / 2 : 0)), to: at(first + (row.length ? row.at(-1) / 2 : 0)) } : null,
      expanded: Math.abs(s1 - s10) > 0.5 ? { from: at(s10), to: at(s1) } : null },
  };
}
// IN THE 3–6 SECTOR: a button at point p, OR ITS NAME (the rule says "including captions"): curved names above / below
// a button reach 1.2 × its half-width sideways (renderer and surfaces/ring.js draw them so), names under it go below it
export function sectorTest(settings, scale = 1, anchor = { x: 0, y: 0 }) {
  const C = settings.curve, half = C.size * scale / 2, mode = settings.labelMode || 'hover', k = settings.world?.on ? scale : 1;
  const rr = Math.max(6, half + (+settings.labelOffset || 0) * k) * (mode === 'under' ? 0.85 : 1.2);
  return (p) => (p.x + half > anchor.x && p.y + half > anchor.y)
    || (mode === 'over' && p.x + rr > anchor.x && p.y > anchor.y)
    || (mode === 'under' && p.x + rr > anchor.x && p.y + rr > anchor.y)
    || (mode === 'below' && settings.labelWhen === 'always' && p.x + 45 * k > anchor.x && p.y + half + 4 + ((+settings.fontSize || 11) + 9) * k > anchor.y);
}
// THE 3–6 SECTOR IS NEVER ENTERED (the design rule, 2026-10-11): a sub-menu ring stops where its next button's box would
// reach right of AND below the piece, whatever "ends by" says (Harry's Revised 4 ends at 3:46), and carries on one ring out.
export function nestedSlots(settings, count, scale = 1, anchor = { x: 0, y: 0 }, first = 1, info = null, avoid = []) {
  // Each ring takes a run of pitch-spaced buttons from nestStart clockwise, never past nestEnd or into 3–6. A run that
  // would not fit SLIDES BACK (anticlockwise) as a whole, as far as the main row's floor (primaryFloor) on that ring,
  // before anything steps one ring out (Harry 2026-10-21), but never onto a button of the open row under it (`avoid`: the
  // grown oval runs closer to the main one round the sides); what still does not fit carries on one ring further out.
  const C = settings.curve, pitch = (C.size + C.gap) * scale, inSector = sectorTest(settings, scale, anchor), out = [];
  for (let ring = first; out.length < count && ring < 12 + first; ring++) {
    const c = curveOf(settings, scale, anchor, ring), lut = ellipseLut(c.rx, c.ry);
    const a = sAt(lut, C.nestStart), b = sAt(lut, C.nestEnd + (C.nestEnd < C.nestStart ? 360 : 0)), lo = Math.min(a, sAt(lut, C.primaryFloor));
    const hits = (s) => { const p = curvePoint(c, s), r = C.size * scale / 2; return avoid.some(q => Math.hypot(q.x - p.x, q.y - p.y) < r + q.size / 2 - 0.2 * scale); }; // (scaled: the same shape at any size; under the 0.5 px warnings() allows up to x2.5)
    const fits = (s0, strict) => { let n = 0; for (let s = s0; s <= b + 1e-6 && n < count - out.length; s += pitch) { if (inSector(curvePoint(c, s)) || (strict && hits(s))) break; n++; } return n; };
    const want = count - out.length;
    let start = a, n = fits(a, true);
    if (n < want) { // the nearest start (back first, then forward up to half a pitch) where the rest fits clear of 3–6 and of
      // the open row; else the one that holds the most, nearest first
      let best = { s: a, n, d: 0 };
      for (let d = 2 * scale; d <= (a - lo) + 1e-6 || d <= pitch / 2; d += 2 * scale) {
        for (const s0 of [a - d, a + d]) {
          if ((s0 < a && s0 < lo - 1e-6) || (s0 > a && d > pitch / 2) || inSector(curvePoint(c, s0)) || hits(s0)) continue;
          const k = fits(s0, true); if (k > best.n) best = { s: s0, n: k, d };
        }
        if (best.n >= want) break;
      }
      start = best.s; n = best.n;
    }
    if (info && ring === first && start !== a) info.nested = { from: C.nestStart, to: atS(lut, start).angle };
    for (let i = 0; i < n; i++) out.push({ curve: c, s: start + i * pitch, ring });
    if (!n && ring > first + 2) break;
  }
  return out;
}
export function buildCurveItems(settings, content, state = 'closed', nested = null, scale = 1, anchor = { x: 0, y: 0 }) {
  const C = settings.curve, primary = content.primary || [], secondary = content.secondary || [];
  const menu = secondary.length ? [{ id: 'menu', label: 'All options', icon: 'menu' }] : [];
  const motion = { duration: C.duration, stagger: C.stagger, easing: C.easing, from: 'curve' }, size = C.size * scale;
  const slots = curveSlots(settings, { primary: primary.length, secondary: secondary.length, menu: menu.length }, scale, anchor), c = slots.curve;
  if (state === 'closed') return Object.assign([
    ...primary.map((it, i) => onCurve(it, 'closed', c, slots.closed.primary[i], size, motion)),
    ...menu.map(it => onCurve(it, 'menu', c, slots.closed.menu[0], size, motion)),
  ], { slid: slots.slid.closed && { row: 'closed', ...slots.slid.closed } });
  const keep = secondary.length - slots.spill;
  const out = [
    ...primary.map((it, i) => onCurve(it, 'primary', c, slots.expanded.primary[i], size, motion)),
    ...secondary.slice(0, keep).map((it, j) => onCurve(it, 'secondary', c, slots.expanded.secondary[j], size, motion)),
    ...menu.map(it => onCurve(it, 'menu', c, slots.expanded.menu[0], size, motion)),
  ];
  if (slots.spill) { // (a row too long for this oval anywhere: its last EXTRA buttons step out to the next ring, above the
    // end of the row, the last as far round as the 3–6 sector allows; ☰ stays in line at the row's end)
    const g = curveOf(settings, scale, anchor, 1), lut = ellipseLut(g.rx, g.ry), inSector = sectorTest(settings, scale, anchor);
    const bad = s => inSector(curvePoint(g, s));
    let end = sAt(lut, out[out.length - 1].angle);
    while (bad(end)) end -= 2 * scale;
    secondary.slice(keep).forEach((it, i, tail) => out.splice(primary.length + keep + i, 0, { ...onCurve(it, 'secondary', g, end - (tail.length - 1 - i) * slots.pitch, size, motion), spilled: true }));
  }
  if (state === 'nested') {
    const kids = nested?.children || [], key = nestedKey(nested?.id);
    // (the separate rings' settings play no part here: Harry 2026-10-20 changed the Conditions ring and nothing moved)
    // (a row that stepped buttons out onto ring 1 keeps it: the sub-menu starts one ring further out)
    const info = {}; nestedSlots(settings, kids.length, scale, anchor, slots.spill ? 2 : 1, info, out).forEach((p, i) => out.push({ ...onCurve(kids[i], key, p.curve, p.s, size, motion), ring: p.ring }));
    if (info.nested) out.slid = { row: 'nested', ...info.nested };
  }
  if (!out.slid && slots.slid.expanded) out.slid = { row: 'expanded', ...slots.slid.expanded };
  return out;
}

export function fitToScreen(nodes, width, height, edgeRule = 'slide', top = 56, margin = 8) {
  if (!nodes.length) return { nodes: [], shift: [0, 0] };
  const copy = nodes.map(n => ({ ...n }));
  if (edgeRule === 'flip' || edgeRule === 'rotate') {
    const mid = { x: nodes.reduce((v, n) => v + n.center.x, 0) / nodes.length, y: nodes.reduce((v, n) => v + n.center.y, 0) / nodes.length };
    for (const n of copy) {
      let dx = n.x - mid.x, dy = n.y - mid.y;
      if (edgeRule === 'flip') { if (mid.x < width / 3 || mid.x > width * 2 / 3) dx = -dx; if (mid.y < height / 3 || mid.y > height * 2 / 3) dy = -dy; }
      else { const a = mid.x < width / 2 ? Math.PI / 4 : -Math.PI / 4; [dx, dy] = [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; }
      n.x = mid.x + dx; n.y = mid.y + dy;
    }
  }
  if (edgeRule === 'squash') {
    const mid = { x: nodes.reduce((v, n) => v + n.center.x, 0) / nodes.length, y: nodes.reduce((v, n) => v + n.center.y, 0) / nodes.length };
    const k = Math.min(1, (width - 2 * margin) / Math.max(1, 2 * Math.max(...copy.map(n => Math.abs(n.x - mid.x) + n.size / 2))), (height - top - margin) / Math.max(1, 2 * Math.max(...copy.map(n => Math.abs(n.y - mid.y) + n.size / 2))));
    for (const n of copy) { n.x = mid.x + (n.x - mid.x) * k; n.y = mid.y + (n.y - mid.y) * k; }
  }
  const minX = Math.min(...copy.map(n => n.x - n.size / 2)), maxX = Math.max(...copy.map(n => n.x + n.size / 2));
  const minY = Math.min(...copy.map(n => n.y - n.size / 2)), maxY = Math.max(...copy.map(n => n.y + n.size / 2));
  const dx = minX < margin ? margin - minX : maxX > width - margin ? width - margin - maxX : 0;
  const dy = minY < top ? top - minY : maxY > height - margin ? height - margin - maxY : 0;
  for (const n of copy) { n.x += dx; n.y += dy; n.center = { x: n.center.x + dx, y: n.center.y + dy }; }
  return { nodes: copy, shift: [dx, dy] };
}

export function warnings(nodes, trackSamples = [], width, height, anchor, labelBoxes = [], top = 56) {
  const out = new Set(), boxes = nodes.map(n => ({ x: n.x - n.size / 2, y: n.y - n.size / 2, w: n.size, h: n.size }));
  const all = [...boxes, ...labelBoxes, ...trackSamples.map(p => ({ x: p.x - 3, y: p.y - 3, w: 6, h: 6 }))];
  for (const b of all) {
    if (b.x < 0 || b.y < top || b.x + b.w > width || b.y + b.h > height) out.add('off screen');
    if (b.x + b.w > anchor.x && b.y + b.h > anchor.y && b.x < width && b.y < height) out.add('3–6 sector');
  }
  // Buttons are round: two overlap when their centres are closer than their radii add up (a square-box test flagged
  // diagonal neighbours on every arc). The sector and screen tests above stay square: they must be conservative.
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < (a.size + b.size) / 2 - 0.5) out.add('button overlap');
  }
  return [...out];
}
