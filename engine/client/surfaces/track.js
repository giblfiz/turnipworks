// THE DRAG TRACK (Harry 2026-10-06: "the size-slider... should draw a little track that the handle slides along when
// you grab it"). ONE small piece for every handle that is dragged along a path: the ring's resize, raise / lower,
// turn, and a pawn's damage. It draws, in an SVG it is handed:
//   the rail      the path from the smallest value to the largest (a line, an arc, or any path a function gives)
//   ticks         short strokes across the rail at the values asked for (a `major` one is longer)
//   marks         named values: a longer stroke and a small label ("100%", "floor", "lands", "0", "half", "max")
//   the value     a dot riding the rail at the CURRENT value (what a release would commit), and the stretch of rail
//                 from the start value to it, drawn solid
//   the readout   the current value in words, by the handle (an HTML chip in `layer`), through `format`
// It is drawing only: it never catches a pointer event (the SVG group and the chip are pointer-events: none, in CSS
// and inline), it does nothing between calls (no timers, no per-frame work), and it knows nothing about the ring.
//
//   const T = makeTrack(svg, { min, max, value, ticks, marks, format, direction, layer });
//     min, max     the ends of the rail, in the value's own units
//     value        where it starts (the solid stretch is measured from here)
//     ticks        [v | { v, major, k }]            k is copied to data-k (the turn handle's notch index)
//     marks        [{ v, label, cls }]
//     format       (v) => text for the readout
//     direction    how a value becomes a screen point, one of:
//                    { from: [x, y], to: [x, y] }                       a straight line, min at `from`, max at `to`
//                    { centre: [x, y], radius, zero, per }              an arc: value v sits at angle zero + v * per
//                                                                       (radians, clockwise from straight up)
//                    { at: (v) => [x, y] }                              anything else (the resize handle's eased ray)
//     layer        the element the readout chip goes in (omit for no readout)
//   T.set(v, [x, y])   the value now; the chip sits by the point given (the handle), else by the dot
//   T.at(v)            the screen point of a value          T.text(v)   the readout's text
//   T.release()        the drag is over: fade out and go (at once with reduced motion). T.remove() goes at once.
//   T.info()           (tests) what is drawn
//
// A pawn's DAMAGE handle is the fourth caller (ring.js): a line from 0 outward along the handle's ray, a tick every 5,
// one mark at 0, and no far end: the ring re-makes the track with a longer rail as the value nears its end.
const NS = 'http://www.w3.org/2000/svg';
const FADE_MS = 180;
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion'); } catch { return false; } };
const f1 = (n) => +n.toFixed(1);

export function makeTrack(svg, { min, max, value = min, ticks = [], marks = [], format = (v) => String(Math.round(v)), direction, layer = null, samples = 48 } = {}) {
  const d = direction || {};
  const at = d.at ? d.at
    : d.centre ? (v) => { const a = d.zero + v * d.per; return [d.centre[0] + d.radius * Math.sin(a), d.centre[1] - d.radius * Math.cos(a)]; }
    : (v) => { const t = max === min ? 0 : (v - min) / (max - min); return [d.from[0] + (d.to[0] - d.from[0]) * t, d.from[1] + (d.to[1] - d.from[1]) * t]; };
  const clamp = (v) => Math.max(min, Math.min(max, v));
  // the direction across the rail at a value (unit normal), for ticks and labels
  const normal = (v) => { const e = (max - min) / 400 || 1e-3, a = at(clamp(v - e)), b = at(clamp(v + e)); let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; return [-ty, tx]; };
  const path = (a, b) => { const n = d.from ? 1 : samples, pts = []; for (let i = 0; i <= n; i++) pts.push(at(a + (b - a) * i / n)); return pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join(''); };
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'rtrack'); g.style.pointerEvents = 'none';
  const stroke = (v, half, cls, k) => { const p = at(v), n = normal(v); return `<line class="${cls}"${k != null ? ` data-k="${k}"` : ''} data-v="${+(+v).toFixed(4)}" x1="${f1(p[0] - n[0] * half)}" y1="${f1(p[1] - n[1] * half)}" x2="${f1(p[0] + n[0] * half)}" y2="${f1(p[1] + n[1] * half)}"/>`; };
  const T = ticks.map(t => typeof t === 'number' ? { v: t } : t).filter(t => t.v >= min - 1e-9 && t.v <= max + 1e-9);
  const M = marks.filter(m => m.v >= min - 1e-9 && m.v <= max + 1e-9);
  g.innerHTML = `<path class="rail" d="${path(min, max)}"/><path class="fill" d=""/>`
    + T.map(t => stroke(t.v, t.major ? 7 : 4, `tick${t.major ? ' major' : ''}`, t.k)).join('')
    + M.map(m => { const p = at(m.v), n = normal(m.v); return `${stroke(m.v, 9, `mark ${m.cls || ''}`)}${m.label ? `<text class="mlabel ${m.cls || ''}" data-v="${+(+m.v).toFixed(4)}" x="${f1(p[0] + n[0] * 14)}" y="${f1(p[1] + n[1] * 14)}" text-anchor="${n[0] > 0.3 ? 'start' : n[0] < -0.3 ? 'end' : 'middle'}" dominant-baseline="middle">${String(m.label).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</text>` : ''}`; }).join('')
    + '<circle class="knob" r="4"/>';
  svg.append(g);
  const fill = g.querySelector('.fill'), knob = g.querySelector('.knob');
  let ro = null;
  if (layer) { ro = document.createElement('div'); ro.className = 'readout'; ro.style.pointerEvents = 'none'; layer.append(ro); }
  let cur = value, gone = false;
  const api = {
    el: g, readout: ro, at, text: (v) => format(v),
    set(v, pt = null) {
      if (gone) return; cur = v;
      const p = at(v); knob.setAttribute('cx', f1(p[0])); knob.setAttribute('cy', f1(p[1]));
      fill.setAttribute('d', Math.abs(v - value) < 1e-9 ? '' : path(clamp(value), clamp(v)));
      if (ro) { const q = pt || p; ro.textContent = format(v); ro.style.left = `${q[0] + 30}px`; ro.style.top = `${q[1] - 14}px`; }
    },
    remove() { gone = true; g.remove(); ro?.remove(); },
    // the drag is over: the track and its chip leave the ring (which is about to be rebuilt) and fade where they are
    release() {
      if (gone) return; gone = true;
      if (reduced() || !document.body) { g.remove(); ro?.remove(); return; }
      const host = document.createElement('div'); host.className = 'rtrack-out'; host.style.pointerEvents = 'none';
      const seat = getComputedStyle(svg).getPropertyValue('--seat'); if (seat) host.style.setProperty('--seat', seat);
      const s2 = document.createElementNS(NS, 'svg'); s2.append(g); host.append(s2); if (ro) host.append(ro);
      (document.getElementById('app') || document.body).append(host);
      requestAnimationFrame(() => host.classList.add('out'));
      setTimeout(() => host.remove(), FADE_MS + 60);
    },
    info: () => ({ min, max, start: value, value: cur, text: ro?.textContent ?? format(cur), knob: [+knob.getAttribute('cx'), +knob.getAttribute('cy')], ticks: T.map(t => ({ v: t.v, at: at(t.v).map(f1), major: !!t.major })), marks: M.map(m => ({ v: m.v, label: m.label || '', cls: m.cls || '', at: at(m.v).map(f1) })), ends: [at(min).map(f1), at(max).map(f1)] }),
  };
  api.set(value);
  if (ro) ro.textContent = ''; // nothing to say until the handle moves
  return api;
}
