// WHEEL OR TRACKPAD? (Harry 2026-10-06: "mouse wheel scroll pans up and down instead of zooming", in Chrome on a Mac.)
// A mouse WHEEL zooms; a trackpad's two-finger scroll PANS; a pinch (wheel + ctrlKey) zooms. Browsers send all three as
// wheel events and do not say which device it was, so it is worked out from the events' signature, PER GESTURE (a
// run of events less than GAP ms apart), never per event:
//
//                         deltaMode   deltaY per notch / event         wheelDeltaY (Chrome, Safari)   deltaX
//   Firefox, a wheel      1 (lines)*  ±3 lines (or ±1)                  -                             0
//                         * only if deltaMode is read BEFORE deltaY; otherwise Firefox converts to pixels
//   Firefox, a trackpad   0 (pixels)  small, integer or .5, a stream    absent                        often
//   Chrome, a wheel       0           ±100 / ±120 (Windows, Linux);     ±120 x n, NOT -3 x deltaY     0
//                                     on a Mac ±4.000244140625 and up
//                                     (the system's acceleration)
//   Chrome, a trackpad    0           small, a stream with momentum     exactly -3 x deltaY           often
//   Safari, a wheel       0           ±4.000244140625 and up            -3 x deltaY (no help)         0
//   Safari, a trackpad    0           integers, a stream                -3 x deltaY                   often
//   any pinch             0           small, with ctrlKey               -                             0
//
// The old rule called anything fractional or under 40 px a trackpad: right for Firefox (where a wheel comes in lines)
// and exactly wrong for a wheel in Chrome or Safari on a Mac, whose notch is 4.000244140625 px.
//
// What counts as a WHEEL, in order of strength:
//   lines or pages (deltaMode != 0)
//   wheelDeltaY a whole multiple of 120 that is not -3 x deltaY, with no deltaX          (Chrome everywhere)
//   a deltaY that is a 16.16 fixed-point value off the quarter-pixel grid (the Mac's wheel acceleration:
//   4.000244140625 = 4 + 16/65536), no deltaX                                             (Safari, Chrome on a Mac)
//   a gesture that STARTS with a whole 100 or 120 px, no deltaX (a guess; a trackpad starts small)
// What counts as a TRACKPAD: any deltaX; otherwise small pixel deltas that match none of the above.
// A gesture keeps its kind; one decisive event of the other kind inside it (deltaX, or lines) changes it for the rest.
// A wheel-looking event within STICKY ms of a trackpad gesture stays trackpad unless the evidence is strong (the
// tail of a momentum scroll can pass through a round number).
// Where this guesses wrong (a Magic Mouse or a free-spinning MX wheel looks like a trackpad), Settings ▸ Me ▸ Scroll
// wheel says which it is: auto / zoom / pan.
// Pure: no DOM, so the node tests feed it recorded and synthesized streams.
export const GAP = 180, STICKY = 350;

const quarter = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
// the Mac's accelerated wheel: 16.16 fixed-point values such as 4.000244140625 (4 + 16/65536). A trackpad's deltas are
// whole or half pixels, or (with the page zoomed) not binary fractions at all.
const macWheel = (v) => !quarter(v) && Number.isInteger(v * 65536);
// one event's evidence: 'wheel!' | 'wheel' | 'pad!' | 'pad'   (! = decisive)
export function evidence(ev) {
  // deltaMode is read FIRST, before any delta: Firefox reports a wheel in lines only to a page that asks for the mode
  // first, and quietly converts to pixels (deltaMode 0) for a page that reads deltaY first.
  const mode = ev.deltaMode;
  if (mode) return 'wheel!';
  const dy = ev.deltaY || 0, dx = ev.deltaX || 0, wd = ev.wheelDeltaY;
  if (dx !== 0) return 'pad!';
  if (dy === 0) return 'pad';
  if (Number.isFinite(wd) && wd !== 0 && Math.abs(wd) % 120 === 0 && Math.abs(wd + 3 * dy) > 1.5) return 'wheel!';
  if (macWheel(dy)) return 'wheel!';
  const a = Math.abs(dy);
  if (Number.isInteger(a) && a >= 100 && (a % 100 === 0 || a % 120 === 0)) return 'wheel'; // a whole notch: a guess (a trackpad flick passes through these too, but does not START with one)
  return 'pad';
}

export function makeWheelClassifier({ mode = () => 'auto' } = {}) {
  let cur = null, lastPad = -1e9; // cur: { kind, at, strong }
  // -> 'mouse' | 'trackpad'   (now in ms)
  function classify(ev, now) {
    const m = mode();
    if (m === 'zoom') return 'mouse';
    if (m === 'pan') return 'trackpad';
    const e = evidence(ev), strong = e.endsWith('!'), kind = e.startsWith('wheel') ? 'mouse' : 'trackpad';
    if (!cur || now - cur.at > GAP) {
      // a new gesture; a weak wheel right after a trackpad gesture is that gesture's tail
      cur = { kind: kind === 'mouse' && !strong && now - lastPad < STICKY ? 'trackpad' : kind, strong };
    } else if (strong && kind !== cur.kind) { cur.kind = kind; cur.strong = true; }      // decisive: the rest of the gesture is the other kind
    else if (!cur.strong && strong) { cur.kind = kind; cur.strong = true; }
    cur.at = now;
    if (cur.kind === 'trackpad') lastPad = now;
    return cur.kind;
  }
  return { classify, state: () => cur && { ...cur } };
}
