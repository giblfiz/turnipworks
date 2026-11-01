// FOG ON THE CLOCK (tools/promo, 2026-10-22). An init script: the fog of war's sight is computed in a Web Worker on real
// time (engine/client/fog.js, fog-worker.js), one job in flight. The rig steps the page's clock far faster or slower than
// the worker answers, so pawns and the fog could flicker between "pending" and "seen". This counts the fog worker's jobs
// in flight; the rig waits (real time) for none before it draws the next frame, as a real browser would have had the
// answer within the frame (a job takes a few ms to ~100 ms).
(() => {
  const RW = window.Worker; if (!RW) return; let n = 0;
  window.Worker = class extends RW {
    constructor(u, o) { super(u, o); if (String(u).includes('fog-worker')) { this.__fog = 1; this.addEventListener('message', () => { n = Math.max(0, n - 1); }); } }
    postMessage(m, t) { if (this.__fog) n++; return t === undefined ? super.postMessage(m) : super.postMessage(m, t); }
  };
  window.__fogInflight = () => n;
})();
