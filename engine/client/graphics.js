// GRAPHICS: WHAT THE PICTURE COSTS, PER VIEWER (Harry 2026-10-11: "this thing cooks the GPU ... we might just need to
// cut some of these features, or at the very least have toggles").
//
// Two separate costs, and this file owns both:
//
// 1. WORK PER FRAME. Every pixel is shaded by several passes (the fire's shadow, contact shadows, the fog march, water,
//    bloom), and a 2x screen has four times the pixels. Settings > Me > Graphics has a preset (Low / Medium / High /
//    Custom, or Auto) and a switch for each pass under it. Every switch SKIPS THE WORK (the pass, the simulation, the
//    shadow draw), and none of them changes a compiled shader, so flipping one does not freeze (the "far fires' lights"
//    freeze, engine/LAB_NOTES.md, was a light count changing under every program).
//
// 2. WORK PER SECOND. Heat is frames x cost, and a tabletop is mostly a still picture. THE IDLE RATE: after
//    IDLE_AFTER_MS with no input, no camera movement, no drag, no spawn animation and nothing arriving from the relay,
//    the picture is drawn IDLE_FPS times a second instead of every display frame (fog still drifts, fires still burn:
//    simulations step by time, not by frame). Any pointer, key, wheel or touch event, a change from another seat or a
//    running animation puts it back to full rate on the very next display frame: the loop still wakes every display
//    frame, it only skips the drawing, so the hand never waits. A hidden tab draws nothing at all.
//    "Frame rate limit" is the same gate while active: a 120 Hz screen draws twice as often as a 60 Hz one for the
//    same picture.
//
// All of it is this browser's own (localStorage tw.prefs, through surfaces/settings.js): never sent, never the house
// look. HIGH IS TODAY'S LOOK, exactly. Under a test driver (navigator.webdriver) the idle rate, the frame-rate limit and
// Auto do nothing unless the test sets tw.gfxForce = true: they follow the clock, and suites about something else would
// come and go with the load on the box (the same rule as interact.js's governor).
export const IDLE_AFTER_MS = 2000;       // how long with nothing happening before the idle rate
export const IDLE_FPS = 20;              // the idle rate a new viewer gets (Settings: Off / 30 / 20 / 10)
export const IDLE_CHOICES = [0, 30, 20, 10];
export const FOG_HALF = 0.5;             // "soft effects at half resolution": the fog's own target, each way
export const DENSITY = { native: 2, 1.5: 1.5, 1: 1 }; // the most drawing-buffer pixels per CSS pixel (native: the screen's own, at most 2, as before)

// the switches a preset sets (prefs keys). Not in a preset: the idle rate, the frame-rate limit, geometry detail, "Lighting effects" (the
// whole post stack) and "Lighter picture while moving".
export const GFX_KEYS = ['lights', 'shadowsFx', 'contactFx', 'fogFx', 'softHalf', 'waterFx', 'fireFx', 'density'];
export const LIGHTS = { all: Infinity, 16: 16, 8: 8, 4: 4, none: 0 }; // "Real lights from fires": every flame, or a fixed pool of the nearest N (fx/fire.js setCap)
export const MAX_FPS = 60; // the frame-rate limit a new viewer gets while active (a 120 Hz screen otherwise draws everything twice)
export const GFX_PRESETS = {
  high:   { lights: 'all', shadowsFx: true,  contactFx: true,  fogFx: true,  softHalf: false, waterFx: true,  fireFx: true,  density: 'native' },
  medium: { lights: '8',   shadowsFx: true,  contactFx: true,  fogFx: true,  softHalf: true,  waterFx: true,  fireFx: true,  density: '1.5' },
  low:    { lights: '4',   shadowsFx: false, contactFx: false, fogFx: false, softHalf: true,  waterFx: false, fireFx: false, density: '1' },
};
export const GFX_ORDER = ['low', 'medium', 'high'];
export const GFX_LABEL = { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', custom: 'Custom' };
// farGlow: "Glow under far fires", the stand-in for the light of a flame that is not a real light. In no preset.
//   'auto' (a new viewer)  what the house says: ON only once a far-fire glow has been sent from the Spawn Tuner's panel
//                          with "Use in game" (fx.farglow.inHouse); until then OFF (Harry 2026-10-12, on the first
//                          version: "much much worse than nothing at this point")
//   true / false           this viewer's own choice (Settings > Me > Graphics, the command bar), to compare
export const GFX_DEFAULTS = { gfx: 'auto', gfxAuto: 'high', ...GFX_PRESETS.high, idleFps: IDLE_FPS, maxFps: MAX_FPS, farGlow: 'auto' };
export const farGlowOn = (p, w) => p.farGlow === true || (p.farGlow !== false && p.farGlow !== 'false' && !!w?.fx?.farglow?.inHouse);
// which preset do these prefs amount to? (Custom = none of them)
export const presetOf = (p) => GFX_ORDER.find(n => GFX_KEYS.every(k => String(p[k] ?? GFX_PRESETS.high[k]) === String(GFX_PRESETS[n][k]))) || 'custom';

// ---- Auto: a short measurement once the first area is up and still, and a watch after that
const AUTO = {
  settleMs: 1500, giveUpMs: 45000,   // measure when nothing has been loading or animating for settleMs (or never, after giveUpMs)
  skip: 20, frames: 90, maxMs: 4000, // frames thrown away after a change, frames measured, and the longest a measurement runs
  badMs: 1000 / 45,                  // frames slower than 45 a second: step down
  badGpuMs: 12,                      // or more than this of GPU time a frame, where the browser can say (a 60th of a second is 16.7)
  gain: 0.9,                         // a step down is kept only if it bought 10%; else it is put back and Auto stops (it is not the picture that is slow)
  watchMs: 28, watchFrames: 240,     // later: this many active frames in a row averaging over watchMs
  hitchMs: 250, cooldownMs: 60000,
};

export function createGraphics(app, { renderer, canvas, busy = () => false }) {
  const driven = typeof navigator !== 'undefined' && navigator.webdriver === true;
  const live = () => !driven || !!app.gfxForce;
  const P = () => app.prefs || GFX_DEFAULTS;
  const S = { state: 'full', why: 'start', lastWake: performance.now(), lastDraw: -1e9, drawn: 0, skipped: 0, wakes: 0, idleSince: null, dprSeen: devicePixelRatio };

  // ---------------- the idle rate
  function wake(why = 'input') { S.lastWake = performance.now(); if (S.state !== 'full') { S.wakes++; S.why = why; } }
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup', 'touchstart', 'touchmove']) addEventListener(ev, () => wake(ev), { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => wake('visible'));
  addEventListener('resize', () => wake('resize'));
  app.on?.((what) => { if (what === 'entry' || what === 'change') wake('net'); });
  let pose = '';
  const poseNow = () => { let s = ''; for (const v of [app.main, app.pip]) { const c = v?.camera; if (c) s += `${c.position.x.toFixed(3)},${c.position.y.toFixed(3)},${c.position.z.toFixed(3)},${c.quaternion.x.toFixed(4)},${c.quaternion.y.toFixed(4)},${c.fov}|${v.area}|${v.rect}`; } return s; };
  // is anything going on that the eye would see stutter? (asked once per display frame: all of it is cheap)
  function activeNow() {
    if (busy()) return 'loading';
    if (app.localDrags?.size) return 'drag';
    if (app.interact?.state.active) return 'hand';
    if (app.beforeViews?.length) return 'picture';
    if (app.frozenAt != null) return 'frozen';
    for (const w of app.worlds.values()) if (w.anims?.size) return 'animation';
    if (app.dice?.busy?.()) return 'dice'; // (dice in the air or fading; lying still they cost nothing extra)
    return '';
  }
  // (main.js, every display frame) is this one drawn?
  function due(now) {
    if (document.hidden) { S.state = 'hidden'; return false; }
    const p = P(), on = live(), t = performance.now();
    const why = activeNow(); if (why) { S.lastWake = t; S.why = why; }
    const idleFps = on ? +(p.idleFps ?? IDLE_FPS) || 0 : 0;
    const idle = idleFps > 0 && t - S.lastWake > IDLE_AFTER_MS && !auto.hold;
    const cap = idle ? idleFps : on ? +(p.maxFps ?? MAX_FPS) || 0 : 0;
    if (cap > 0) { const gap = 1000 / cap; if (now - S.lastDraw < gap - Math.min(gap * 0.4, 7)) { S.skipped++; return false; } } // (the tolerance: a 60 limit on a 75 Hz screen must not become 37)
    S.state = idle ? 'idle' : 'full'; S.rate = cap; S.gap = now - S.lastDraw; S.lastDraw = now; S.drawn++;
    if (t - (S.dprT || 0) > 1000) { S.dprT = t; if (devicePixelRatio !== S.dprSeen) { S.dprSeen = devicePixelRatio; applyDensity(); } } // (the window moved to another screen)
    return true;
  }

  // ---------------- GPU time per frame (EXT_disjoint_timer_query_webgl2: Chromium; not Firefox or Safari)
  const gl = renderer.getContext();
  const tq = gl.getExtension?.('EXT_disjoint_timer_query_webgl2') || null;
  const G = { on: false, open: null, pending: [], ms: [], last: null };
  function timing(on) { G.on = !!on && !!tq; globalThis.__gpuWrap = G.on || undefined; if (!G.on) G.ms.length = 0; return G.on; } // (__gpuWrap: the fog and the water leave the one query to us)
  function begin() {
    if (!G.on || G.open || G.pending.length > 8) return;
    try { const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); G.open = q; } catch { G.open = null; }
  }
  function end(now) {
    if (G.open) { try { gl.endQuery(tq.TIME_ELAPSED_EXT); G.pending.push(G.open); } catch { } G.open = null; }
    for (let i = G.pending.length - 1; i >= 0; i--) {
      const q = G.pending[i]; let ok = false; try { ok = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); } catch { ok = true; }
      if (!ok) continue;
      try { if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; G.last = ms; G.ms.push(ms); if (G.ms.length > 240) G.ms.shift(); } gl.deleteQuery(q); } catch { }
      G.pending.splice(i, 1);
    }
    // the camera moved during this frame (a glide, a follow, a key held down): not idle
    const ps = poseNow(); if (ps !== pose) { pose = ps; if (S.drawn > 2) wake('camera'); }
    autoFrame(now);
  }
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

  // ---------------- applying the switches
  function applyDensity() {
    const want = Math.min(DENSITY[P().density] || 2, devicePixelRatio);
    if (Math.abs(renderer.getPixelRatio() - want) < 1e-3) return false;
    app.interact?.reset?.();       // (the governor's own "fewer pixels" stage keeps a pixel ratio to come back to)
    renderer.setPixelRatio(want);  // (three.js resizes the canvas itself; the post stack's buffers are ours to resize)
    const W = canvas.clientWidth, H = canvas.clientHeight; if (W && H) for (const w of app.worlds.values()) w.fx?.setSize(W, H);
    return true;
  }
  function applyWorld(w) {
    const p = P();
    const fx = w.fx; if (!fx) return;
    fx.atmos?.setOff?.(p.fogFx === false);                       // nothing drawn, nothing simulated (fx/atmos.js)
    fx.atmos?.setViewScale?.(p.softHalf ? FOG_HALF : 1); fx.atmos?.setViewEvery?.(p.softHalf ? 2 : 1); // half the pixels each way, and the fluid stepped every other frame
    fx.lighting?.setViewer?.({ shadows: p.shadowsFx !== false, contact: p.contactFx !== false, half: !!p.softHalf, dance: p.fireFx !== false, bloom: p.bloomFx !== false, aa: p.aaFx !== false });
    fx.fire?.setLite?.(p.fireFx === false);
    if (fx.farglow?.setViewer) fx.farglow.setViewer(p.farGlow ?? 'auto'); else fx.fire?.setGlow?.(farGlowOn(p, w)); // (fx/farglow.js works 'auto' out itself: the house look can arrive after this)
    fx.fire?.setCap?.(LIGHTS[p.lights ?? 'all'] ?? Infinity); // (two steps, so no program is compiled in a frame: fx/fire.js setCap)
    fx.water?.setLite?.(p.waterFx === false);
  }
  function apply() { applyDensity(); for (const [id, w] of app.worlds) if (!String(id).startsWith('lib:')) applyWorld(w); wake('settings'); }

  // ---------------- Auto
  const auto = { phase: 'off', hold: false, t0: 0, quietAt: 0, n: 0, iv: [], from: null, before: null, note: '', last: null, ema: 0, slow: 0, stoppedAt: -1e9, done: false, lastT: 0 };
  const isAuto = () => live() && P().gfx === 'auto';
  const pick = () => GFX_ORDER.includes(P().gfxAuto) ? P().gfxAuto : 'high';
  function setPick(name, why) { app.settings?.setAuto?.(name, why); }
  function startMeasure(now, then) { auto.phase = 'measure'; auto.hold = true; auto.t0 = now; auto.n = 0; auto.iv = []; auto.then = then; auto.lastT = 0; timing(true); G.ms.length = 0; }
  function finishMeasure() {
    auto.hold = false; if (!app.fpsMeter?.on && !app.gfxTiming) timing(false);
    const iv = median(auto.iv), g = G.ms.length >= 10 ? median(G.ms.slice(-auto.iv.length)) : null;
    if (self.fake) return { frames: auto.iv.length, gpu: null, ...self.fake(pick()) }; // (tests: pretend what a preset costs here)
    return { ms: iv == null ? null : +iv.toFixed(1), gpu: g == null ? null : +g.toFixed(1), frames: auto.iv.length };
  }
  const bad = (m) => m.ms != null && (m.ms > AUTO.badMs || (m.gpu != null && m.gpu > AUTO.badGpuMs));
  function judge(m) {
    const then = auto.then; auto.last = { ...m, preset: pick(), at: Date.now() };
    if (then === 'first' || then === 'watch') {
      if (!bad(m) || pick() === 'low') { auto.phase = 'watch'; auto.done = true; if (auto.from && auto.from !== pick()) tell(); return; }
      if (!auto.from) { auto.from = pick(); auto.first = m; } auto.before = m;
      setPick(GFX_ORDER[GFX_ORDER.indexOf(pick()) - 1], m); auto.phase = 'settle'; auto.t0 = performance.now(); auto.then = 'after'; return;
    }
    // after a step down: did it buy anything?
    const b = auto.before, gained = (b.ms && m.ms < b.ms * AUTO.gain) || (b.gpu != null && m.gpu != null && m.gpu < b.gpu * AUTO.gain);
    if (!gained) { // not the picture: put it back, and leave it alone for this visit
      setPick(GFX_ORDER[GFX_ORDER.indexOf(pick()) + 1], null); auto.note = 'not-graphics'; auto.phase = 'stopped'; auto.done = true;
      if (auto.from && auto.from !== pick()) tell(); return;
    }
    if (bad(m) && pick() !== 'low') { auto.before = m; setPick(GFX_ORDER[GFX_ORDER.indexOf(pick()) - 1], m); auto.phase = 'settle'; auto.t0 = performance.now(); return; }
    auto.phase = 'watch'; auto.done = true; tell();
  }
  // Auto changed something: say so, with one Undo (which is "use what I had", pinned: Auto never overrides a choice)
  function tell() {
    const from = auto.from, to = pick(); auto.from = null; if (!from || from === to) return;
    const b = auto.first || auto.before || {}, why = b.gpu != null && b.gpu > AUTO.badGpuMs ? `the picture took ${b.gpu} ms of GPU time a frame` : `frames took ${b.ms} ms`;
    auto.told = { from, to, why, at: Date.now() };
    app.emit?.('gfx.auto', auto.told);
    notice(`Graphics: Auto chose ${GFX_LABEL[to]} for this machine (${why} on ${GFX_LABEL[from]}).`, `Undo: use ${GFX_LABEL[from]}`, () => app.settings?.setGfx?.(from));
  }
  let noteEl = null, noteT = 0;
  function notice(text, action, run) {
    noteEl ||= Object.assign(document.createElement('div'), { id: 'gfxNote' }); if (!noteEl.parentNode) document.getElementById('app')?.append(noteEl);
    noteEl.innerHTML = '<span></span><button type="button" class="undo"></button><button type="button" class="x" aria-label="Dismiss">×</button>';
    noteEl.querySelector('span').textContent = text; noteEl.querySelector('.undo').textContent = action;
    const close = () => { noteEl.hidden = true; clearTimeout(noteT); };
    noteEl.querySelector('.undo').onclick = () => { close(); run(); }; noteEl.querySelector('.x').onclick = close;
    noteEl.hidden = false; clearTimeout(noteT); noteT = setTimeout(close, 20000);
  }
  const still = () => !activeNow() && app.ready?.() && ![...app.worlds.values()].some(w => w.lastEpisode?.loading);
  function autoFrame(now) {
    if (!isAuto()) { if (auto.phase !== 'off') { auto.phase = 'off'; auto.hold = false; } return; }
    const t = performance.now();
    if (auto.phase === 'off') { auto.phase = 'wait'; auto.t0 = t; auto.quietAt = 0; auto.done = false; auto.note = ''; auto.from = null; }
    if (auto.phase === 'wait') { // the first area is up, and nothing has been loading or animating for a moment
      if (t - auto.t0 > AUTO.giveUpMs) { auto.phase = 'watch'; return; }
      if (!still()) { auto.quietAt = 0; return; }
      auto.quietAt ||= t; if (t - auto.quietAt >= AUTO.settleMs) startMeasure(t, 'first');
      return;
    }
    if (auto.phase === 'settle') { if (t - auto.t0 > 600) startMeasure(t, auto.then); return; }
    if (auto.phase === 'measure') {
      if (auto.lastT && ++auto.n > AUTO.skip) auto.iv.push(now - auto.lastT);
      auto.lastT = now;
      if (auto.iv.length >= AUTO.frames || t - auto.t0 > AUTO.maxMs) judge(finishMeasure());
      return;
    }
    if (auto.phase === 'watch') { // later: many active frames in a row that are slow
      const gap = S.gap; if (S.state !== 'full' || !(gap > 0) || gap > AUTO.hitchMs || activeNow() === 'loading') { auto.slow = 0; auto.ema = 0; return; }
      auto.ema = auto.ema ? auto.ema + (gap - auto.ema) / 30 : gap;
      auto.slow = auto.ema > AUTO.watchMs ? auto.slow + 1 : 0;
      if (auto.slow >= AUTO.watchFrames && pick() !== 'low' && t - auto.stoppedAt > AUTO.cooldownMs) { auto.slow = 0; auto.stoppedAt = t; auto.from = null; startMeasure(t, 'watch'); }
    }
  }
  // (settings: Auto was chosen again) measure afresh, from High
  function restartAuto() { auto.phase = 'off'; auto.hold = false; auto.told = null; auto.done = false; auto.note = ''; auto.from = null; }

  const self = {
    due, begin, end, wake, apply, applyWorld, applyDensity, timing, restartAuto, notice,
    get state() { return S.state; },
    gpuMs: () => { const m = median(G.ms.slice(-60)); return m == null ? null : +m.toFixed(2); },
    gpuSamples: () => G.ms.slice(), clearGpu: () => { G.ms.length = 0; },
    hasTimer: !!tq,
    farGlow: () => farGlowOn(P(), [...app.worlds.values()].find(w => w.fx)),
    info: () => ({ live: live(), preset: P().gfx || 'auto', resolved: presetOf(P()), autoPick: pick(), state: S.state, why: S.why, rate: S.rate || 0, idleFps: +(P().idleFps ?? IDLE_FPS) || 0, maxFps: +(P().maxFps ?? MAX_FPS) || 0,
      density: P().density || 'native', pixelRatio: +renderer.getPixelRatio().toFixed(3), buffer: [canvas.width, canvas.height], drawn: S.drawn, skipped: S.skipped, wakes: S.wakes,
      timer: !!tq, timing: G.on, gpuMs: self.gpuMs(), auto: { phase: auto.phase, last: auto.last, note: auto.note, told: auto.told || null, done: auto.done } }),
    AUTO, fake: null, renderer, // (renderer: tests and measurements read renderer.info)
    // (tests) pretend what each preset costs on this machine: fn(presetName) -> { ms, gpu? }; null = measure for real
    pretend(fn) { self.fake = fn; },
  };
  return self;
}
