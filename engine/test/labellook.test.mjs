// The label look (engine/client/labels/look.js): today's numbers, the starter, sizes, the cap and the fade.
import assert from 'node:assert/strict';
import { TODAY, LIMITS, NEVER_FT, NO_CAP, normalize, starter, envelope, sameAsToday, textPx, fadeAt } from '../client/labels/look.js';
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; };
// today: exactly the look before the lab (style.css .rlabel 24 px / building 13 px; labels.js ROOF 10.2, +4, 2 / 4 px, 450 ms)
const T = normalize(TODAY);
ok(T.size.px === 24 && Math.abs(T.size.px * T.size.building - 13) < 1e-9 && T.place.ft === 10.2 && T.place.buildingFt === 4, 'today: 24 / 13 px at 10.2 ft, +4 ft');
ok(T.crowd.leave === 2 && T.crowd.arriveX === 4 && T.crowd.arriveY === 3 && T.crowd.edgeIn === 40 && T.crowd.edgeOut === 90 && T.crowd.dwell === 450 && T.crowd.stepY === 5 && T.crowd.stepX === 6 && T.crowd.pawn === 6, 'today: the crowd rules');
ok(T.size.capPct === NO_CAP && T.when.fadeFt === NEVER_FT && T.when.roomsFt === NEVER_FT && T.when.underRoof === true && !T.size.world, 'today: no cap, no fades, labels hide under roofs');
ok(textPx(T, { kind: 'room' }).px === 24 && Math.abs(textPx(T, { kind: 'building' }).px - 13) < 1e-9, 'today: text 24 / 13 px');
ok(fadeAt(T, 1e5) === 1, 'today: never fades');
ok(sameAsToday(TODAY) && !sameAsToday(starter()), 'sameAsToday');
// the starter (Harry 2026-10-20): buildings 1.35x, never wider than 75 %, hidden below 9 px
const S = starter();
ok(S.size.building === 1.35 && S.size.capPct === 75 && S.size.hidePx === 9 && Math.abs(textPx(S, { kind: 'building' }).px - 32.4) < 1e-9, 'starter');
// normalize: partial and wrong-typed records fall back to today, envelopes round-trip
ok(normalize({ size: { px: 30, world: 'yes', bogus: 1 } }).size.px === 30 && normalize({ size: { world: 'yes' } }).size.world === false && !('bogus' in normalize({ size: { bogus: 1 } }).size), 'normalize keeps good values only');
ok(JSON.stringify(normalize(envelope(S))) === JSON.stringify(S) && normalize({ settings: { look: { opacity: 50 } } }).look.opacity === 50, 'envelope round-trips');
// world size: ft x px per ft, clamped
const W = normalize({ ...S, size: { ...S.size, world: true, ft: 2, minPx: 12, maxPx: 36, capPct: NO_CAP } });
ok(textPx(W, { kind: 'room', pxPerFt: 10 }).px === 20 && textPx(W, { kind: 'room', pxPerFt: 10 }).why === 'world', 'world: 2 ft at 10 px/ft = 20 px');
ok(textPx(W, { kind: 'room', pxPerFt: 1 }).px === 12 && textPx(W, { kind: 'room', pxPerFt: 1 }).why === 'smallest', 'world: held at the smallest');
ok(textPx(W, { kind: 'room', pxPerFt: 100 }).px === 36 && textPx(W, { kind: 'room', pxPerFt: 100 }).why === 'largest', 'world: held at the largest');
ok(Math.abs(textPx(W, { kind: 'building', pxPerFt: 10 }).px - 27) < 1e-9, 'world: building ratio on the clamped room size');
// the cap: the smallest result wins
ok(textPx(S, { kind: 'room', perPx: 5, spanPx: 100 }).px === 15 && textPx(S, { kind: 'room', perPx: 5, spanPx: 100 }).why === 'cap', 'cap: 75 % of 100 px at 5 px per px of text = 15 px');
ok(textPx(S, { kind: 'room', perPx: 5, spanPx: 1000 }).px === 24, 'cap: a wide room does not grow a label');
// the fade: 1 nearer than X, 0 at 1.3 X
const F = normalize({ when: { fadeFt: 100 } });
ok(fadeAt(F, 90) === 1 && Math.abs(fadeAt(F, 115) - 0.5) < 1e-9 && fadeAt(F, 140) === 0, 'fade ramp');
for (const [k, [a, b, st]] of Object.entries(LIMITS)) { const [g, f] = k.split('.'); ok(g in TODAY && f in TODAY[g] && a < b && st > 0, `limits ${k}`); }
console.log('labellook:', n, 'checks');
