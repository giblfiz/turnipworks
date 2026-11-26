// THE SELECTED PAWN'S RING NO LONGER COSTS A FRAME (2026-11-06, the SPEED lane; docs/PERF.md "What a selected pawn cost").
// The light-use bench (tools/perf-bench/lightuse.py) found 110 to 140 ms of every frame inside the ring's frame listener
// whenever a pawn was selected or dragged, on the build box and on the front web server alike: the ring's slots were searched for again
// every frame (and the oval tables that search builds were thrown away by the search itself). Checked here:
//   MEMO      the same shape, counts and scale search once, wherever the ring is; a different shape searches again
//   SAME      the memo's answer, moved to an anchor, is the answer a fresh search at that anchor gives (to 1e-6 px)
//   ITEMS     buildArcItems at two anchors: the same buttons, moved by the difference
//   SAFE      changing what one call returned does not change the next
//   BOXES     a mesh's bounding box is worked out once, and again only when its positions change (geobox.js)
//   node engine/test/ring_frame_cost.test.mjs
import assert from 'node:assert/strict';
import * as M from '../client/ringlab/model.js';
import { BUILTINS, normalize } from '../client/ringlab/presets.js';
import { geoBox } from '../client/geobox.js';
let n = 0; const ok = (v, msg) => { assert.ok(v, msg); n++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

ok(typeof M.curveSlots === 'function' && M.slotStats && typeof M.clearSlotMemo === 'function', 'the slot search is memoised (slotStats, clearSlotMemo)');
const curved = Object.values(BUILTINS).map(normalize).filter(s => s.curve?.on);
ok(curved.length > 0, 'a one-curve preset to test with');
for (const S0 of curved.slice(0, 3)) {
  for (const counts of [{ primary: 4, secondary: 6, menu: 1 }, { primary: 4, secondary: 16, menu: 1 }]) { // (16: a row too long for the oval: the grow search)
    for (const scale of [1, 1.37]) {
      M.clearSlotMemo(); const s0 = M.slotStats.searches;
      const A = { x: 640, y: 410 }, B = { x: 97.25, y: 803.5 };
      const a = M.curveSlots(S0, counts, scale, A), b = M.curveSlots(S0, counts, scale, B);
      ok(M.slotStats.searches - s0 === 1, `one search for one shape, two anchors (${counts.secondary} extra, ×${scale})`);
      ok(near(a.curve.cx - A.x, b.curve.cx - B.x) && near(a.curve.cy - A.y, b.curve.cy - B.y) && a.curve.rx === b.curve.rx, 'the oval moves with the anchor');
      M.clearSlotMemo(); const fresh = M.curveSlots(S0, counts, scale, B);
      const same = (x, y) => x.length === y.length && x.every((v, i) => near(v, y[i]));
      ok(near(fresh.curve.cx, b.curve.cx) && near(fresh.curve.cy, b.curve.cy) && same(fresh.closed.primary, b.closed.primary) && same(fresh.expanded.secondary, b.expanded.secondary) && same(fresh.expanded.primary, b.expanded.primary) && fresh.spill === b.spill && fresh.grown === b.grown,
        `the memo's answer moved to an anchor is a fresh search's there (${counts.secondary} extra, ×${scale}, spill ${fresh.spill}, grown ${fresh.grown})`);
      b.closed.primary[0] = 1e9; b.expanded.secondary.length = 0; const c = M.curveSlots(S0, counts, scale, B);
      ok(c.closed.primary[0] !== 1e9 && c.expanded.secondary.length === fresh.expanded.secondary.length, 'what a call returned can be changed without changing the next');
    }
  }
  const content = { primary: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], secondary: Array.from({ length: 8 }, (_, i) => ({ id: 's' + i })) };
  for (const view of ['closed', 'expanded']) {
    const p = M.buildArcItems(S0, content, view, null, 1.2, { x: 500, y: 400 }), q = M.buildArcItems(S0, content, view, null, 1.2, { x: 230, y: 610 });
    ok(p.length === q.length && p.every((x, i) => near(x.x - 500, q[i].x - 230, 1e-6) && near(x.y - 400, q[i].y - 610, 1e-6)), `${view}: the same buttons at another anchor, moved by the difference`);
  }
  const k0 = M.slotStats.searches; M.curveSlots({ ...S0, labelMode: S0.labelMode === 'under' ? 'over' : 'under' }, { primary: 4, secondary: 6, menu: 1 }, 1, { x: 0, y: 0 });
  ok(M.slotStats.searches === k0 + 1, 'another label mode is another shape: searched again');
}

// BOXES
let calls = 0;
const geo = () => ({ attributes: { position: { version: 0 } }, morphAttributes: {}, boundingBox: null, computeBoundingBox() { calls++; this.boundingBox = { n: calls }; } });
const g = geo(); geoBox(g); geoBox(g); geoBox(g);
ok(calls === 1, 'a mesh asked three times works its box out once');
g.attributes.position.version++; geoBox(g); ok(calls === 2, 'its positions changed (needsUpdate): worked out again');
g.attributes.position = { version: 0 }; geoBox(g); ok(calls === 3, 'a new position attribute: worked out again');
g.boundingBox = null; geoBox(g); ok(calls === 4, 'a box someone cleared: worked out again');
const m = geo(); m.morphAttributes.position = [{}]; geoBox(m); geoBox(m); ok(calls === 6, 'a morphing mesh: always fresh');
ok(geoBox(null) === null && geoBox({}) === null, 'nothing to measure: null');
console.log('ring_frame_cost:', n, 'checks');
