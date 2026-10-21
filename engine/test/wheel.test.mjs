// Wheel or trackpad? (client/wheel.js; Harry 2026-10-06: a mouse wheel panned in Chrome on a Mac.) Streams with each
// browser's and device's signature go through the classifier; a wheel must zoom ('mouse') and a trackpad pan.
//   node engine/test/wheel.test.mjs
import { makeWheelClassifier, evidence } from '../client/wheel.js';
let pass = 0, fail = 0;
const check = (ok, name, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail && !ok ? ' — ' + detail : ''}`); };
// run a stream [[dtMs, event], ...] and return the kinds
const run = (stream, mode = 'auto', C = makeWheelClassifier({ mode: () => mode }), t0 = 0) => { let t = t0; const out = stream.map(([dt, ev]) => C.classify(ev, (t += dt))); out.end = t; out.C = C; return out; };
const all = (ks, k) => ks.every(x => x === k);
const pad = (dys, { dx = () => 0, wd = true, gap = 12 } = {}) => dys.map((dy, i) => [gap, { deltaMode: 0, deltaY: dy, deltaX: dx(i), ...(wd && { wheelDeltaY: -Math.trunc(dy * 3) }) }]);
const momentum = [1, 2, 4, 7, 12, 19, 27, 40, 52, 61, 55, 48, 40, 33, 27, 22, 18, 14, 11, 9, 7, 5, 4, 3, 2, 1, 1];

// ---- a physical wheel ----
check(all(run([1, 2, 3, 4].map(() => [90, { deltaMode: 0, deltaY: 4.000244140625, deltaX: 0, wheelDeltaY: -120 }])), 'mouse'), 'Chrome on a Mac, a wheel turned slowly (4.000244140625 px a notch, wheelDeltaY -120): zoom');
check(all(run([[60, { deltaMode: 0, deltaY: 4.000244140625, deltaX: 0, wheelDeltaY: -120 }], [30, { deltaMode: 0, deltaY: 31.25390625, deltaX: 0, wheelDeltaY: -240 }], [25, { deltaMode: 0, deltaY: 86.8125, deltaX: 0, wheelDeltaY: -360 }], [25, { deltaMode: 0, deltaY: -12.5078125, deltaX: 0, wheelDeltaY: 120 }]]), 'mouse'), 'Chrome on a Mac, a wheel spun fast (accelerated deltas, wheelDeltaY in whole 120s): zoom');
check(all(run([1, 2, 3].map(() => [70, { deltaMode: 0, deltaY: 100, deltaX: 0, wheelDeltaY: -120 }])), 'mouse'), 'Chrome on Windows (100 px, wheelDeltaY -120): zoom');
check(all(run([1, 2, 3].map(() => [70, { deltaMode: 0, deltaY: -53, deltaX: 0, wheelDeltaY: 120 }])), 'mouse'), 'Chrome on Linux (53 px, wheelDeltaY 120): zoom');
check(all(run([1, 2, 3].map(() => [70, { deltaMode: 0, deltaY: 120, deltaX: 0, wheelDeltaY: -120 }])), 'mouse'), 'Chrome, a 120 px notch (wheelDeltaY -120): zoom');
check(all(run([1, 2, 3].map(() => [80, { deltaMode: 1, deltaY: 3, deltaX: 0 }])), 'mouse'), 'Firefox, a wheel (lines): zoom');
check(all(run([1, 2].map(() => [80, { deltaMode: 1, deltaY: -1, deltaX: 0 }])), 'mouse'), 'Firefox, a wheel set to one line: zoom');
check(all(run([1, 2].map(() => [80, { deltaMode: 2, deltaY: 1, deltaX: 0 }])), 'mouse'), 'a wheel set to pages: zoom');
check(all(run([1, 2, 3].map(() => [90, { deltaMode: 0, deltaY: 4.000244140625, deltaX: 0, wheelDeltaY: -12 }])), 'mouse'), 'Safari, a wheel (4.000244140625 px; its wheelDeltaY is no help): zoom');
check(all(run([[90, { deltaMode: 0, deltaY: -4.000244140625, deltaX: 0, wheelDeltaY: 12 }], [40, { deltaMode: 0, deltaY: -22.3359375, deltaX: 0, wheelDeltaY: 67 }]]), 'mouse'), 'Safari, a wheel spun faster: zoom');
check(all(run([1, 2].map(() => [90, { deltaMode: 0, deltaY: 100, deltaX: 0 }])), 'mouse'), 'a browser with no wheelDelta, 100 px notches: zoom');

{ // Firefox hands out lines only if deltaMode is read before deltaY (it converts to pixels otherwise): the classifier must ask in that order
  let asked = false; const ev = { get deltaMode() { asked = true; return 1; }, get deltaY() { return asked ? 3 : 48; }, deltaX: 0 };
  check(evidence(ev) === 'wheel!', 'deltaMode is read before deltaY (Firefox reports a wheel in lines only then)'); }
check(all(run([[90, { deltaMode: 0, deltaY: -100, deltaX: 0, wheelDeltaY: 300 }], [300, { deltaMode: 0, deltaY: -100, deltaX: 0, wheelDeltaY: 300 }]]), 'mouse'), 'Firefox in pixel mode, whole 100 px notches (what Playwright sends): zoom');

// ---- a trackpad ----
check(all(run(pad(momentum)), 'trackpad'), 'Chrome, a two-finger scroll with momentum (passes through 40 px = wheelDeltaY -120): pan', String(run(pad(momentum))));
check(all(run(pad(momentum.map(v => v / 2))), 'trackpad'), 'Chrome on a 2x screen (half-pixel deltas): pan');
check(all(run(pad(momentum.map(v => v / 1.1))), 'trackpad'), 'Chrome with the page zoomed to 110% (deltas that are not round): pan');
check(all(run(pad(momentum, { dx: (i) => (i % 3 ? 0 : 1) })), 'trackpad'), 'a diagonal scroll (some deltaX): pan');
check(all(run(pad(momentum, { wd: false })), 'trackpad'), 'Firefox, a trackpad (pixels, no wheelDelta): pan');
check(all(run(pad(momentum.map(v => -v / 2), { wd: false })), 'trackpad'), 'Firefox, a trackpad on a 2x screen: pan');
check(all(run(pad(momentum.map(Math.round))), 'trackpad'), 'Safari, a trackpad (whole pixels): pan');
check(all(run(pad([40, 80, 120, 160, 120, 100, 60, 30, 10])), 'trackpad'), 'a hard flick whose deltas pass through 100 and 120: still a pan (wheelDeltaY is exactly -3 x deltaY)');
check(all(run(pad([3, 8, 20, 60, 100, 120, 100, 60, 20], { wd: false })), 'trackpad'), 'the same flick in Firefox (no wheelDelta): a pan (the gesture began small)');

// ---- per gesture, not per event ----
{ const C = makeWheelClassifier(); const a = run(pad(momentum), 'auto', C); const tail = run([[60, { deltaMode: 0, deltaY: 100, deltaX: 0 }]], 'auto', C, a.end);
  check(all(tail, 'trackpad'), 'a round 100 px event 60 ms after a trackpad gesture is its tail: still a pan'); }
{ const C = makeWheelClassifier(); const a = run(pad(momentum), 'auto', C); const w = run([[900, { deltaMode: 0, deltaY: 4.000244140625, deltaX: 0, wheelDeltaY: -120 }]], 'auto', C, a.end);
  check(all(w, 'mouse'), 'a wheel notch a second after a trackpad scroll: zoom (a new gesture, and the evidence is decisive)'); }
{ const C = makeWheelClassifier(); const a = run(pad(momentum), 'auto', C); const w = run([[100, { deltaMode: 1, deltaY: 3, deltaX: 0 }]], 'auto', C, a.end);
  check(all(w, 'mouse'), 'a line-mode wheel straight after a trackpad scroll: zoom at once'); }
{ const ks = run([[80, { deltaMode: 0, deltaY: 100, deltaX: 0 }], [12, { deltaMode: 0, deltaY: 33, deltaX: 4 }], [12, { deltaMode: 0, deltaY: 100, deltaX: 0 }]]);
  check(ks[0] === 'mouse' && ks[1] === 'trackpad' && ks[2] === 'trackpad', 'a gesture that turns out to be a trackpad (a deltaX arrives) stays one', String(ks)); }
{ const ks = run([[80, { deltaMode: 0, deltaY: 4.000244140625, deltaX: 0, wheelDeltaY: -120 }], [40, { deltaMode: 0, deltaY: 8, deltaX: 0, wheelDeltaY: -120 }], [40, { deltaMode: 0, deltaY: 12, deltaX: 0, wheelDeltaY: -120 }]]);
  check(all(ks, 'mouse'), 'a wheel gesture stays a wheel whatever its later deltas look like', String(ks)); }

// ---- the setting overrules ----
check(all(run(pad(momentum), 'zoom'), 'mouse'), 'Scroll wheel: always zoom — a trackpad stream zooms');
check(all(run([1, 2].map(() => [80, { deltaMode: 1, deltaY: 3, deltaX: 0 }]), 'pan'), 'trackpad'), 'Scroll wheel: always pan — a line-mode wheel pans');
check(evidence({ deltaMode: 0, deltaY: 0, deltaX: 0 }) === 'pad' && evidence({ deltaMode: 0, deltaY: 4.5, deltaX: 0 }) === 'pad' && evidence({ deltaMode: 0, deltaY: 4.000244140625, deltaX: 0 }) === 'wheel!', 'evidence: 4.5 px is a trackpad, 4.000244140625 px is a wheel');

console.log(`wheel: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
