// THE LIGHT-USE BENCH'S IN-PAGE RECORDER (2026-11-06; tools/perf-bench/lightuse.py). Evaluated once in a game tab after
// tw.ready(); it changes nothing the game does, it only watches:
//   frames    every DRAWN frame (the game's own gate, graphics.js due(), decides): its display-frame time stamp, the
//             main-thread time from gfx.begin to gfx.end (all the frame's JavaScript and the GL calls it makes), and the
//             delay from the oldest input event not yet shown to the end of the frame that shows it
//   gpu       the game's own whole-frame timer query (gfx.timing), per drawn frame, where the browser has the extension
//   passes    (profile mode) the frame cut into consecutive GPU timer segments: before the picture, the underground
//             pre-pass, the fire's shadow, each post pass by name, and what comes after (overlays, previews)
//   js        main-thread time inside world.frame, fx.render, underPrepass, interact.frame, per drawn frame
//   long      long tasks (over 50 ms), from PerformanceObserver
// __perf.start(name) / __perf.stop() bracket one phase; stop() returns the raw numbers (lightuse.py does the sums).
(() => {
  if (window.__perf) return 'already';
  const app = window.tw, g = app.gfx, renderer = g.renderer, gl = renderer.getContext();
  const P = window.__perf = { phase: null, frames: [], pend: [], long: [], lastNow: null, js: {}, prof: null, counters: {} };
  const now = () => performance.now();
  // ---- frames
  let t0 = 0, jsAcc = {};
  const b0 = g.begin, e0 = g.end;
  g.begin = function (...a) { t0 = now(); jsAcc = {}; if (P.prof) seg('pre'); return b0.apply(this, a); };
  g.end = function (when, ...a) {
    if (P.prof) seg(null);
    const r = e0.call(this, when, ...a), t1 = now();
    if (P.phase) {
      const lat = P.pend.length ? t1 - P.pend[0] : null; jsAcc.input = P.takeInput();
      P.frames.push([+when.toFixed(2), +(t1 - t0).toFixed(2), lat == null ? null : +lat.toFixed(2), P.lastNow == null ? null : +(when - P.lastNow).toFixed(2), jsAcc, +renderer.getPixelRatio().toFixed(3)]);
      P.pend.length = 0;
    }
    P.lastNow = when;
    if (P.prof) poll();
    return r;
  };
  for (const ev of ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'keydown']) addEventListener(ev, (e) => { if (P.phase) P.pend.push(e.timeStamp); }, { capture: true, passive: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.long.push([+e.startTime.toFixed(1), +e.duration.toFixed(1), P.phase]); }).observe({ type: 'longtask', buffered: true }); } catch { }
  // ---- main-thread time inside the big pieces (wrapped on each world as it appears)
  const timed = (obj, key, label) => { const f = obj[key]; if (typeof f !== 'function' || f.__perf) return; const w = function (...a) { const s = now(); try { return f.apply(this, a); } finally { jsAcc[label] = +((jsAcc[label] || 0) + now() - s).toFixed(2); } }; w.__perf = true; obj[key] = w; };
  const wrapWorld = (w) => {
    if (!w || w.__perfWrapped) return; w.__perfWrapped = true;
    timed(w, 'frame', 'world'); timed(w, 'cutPass', 'cut');
    const up = w.underPrepass?.bind(w); if (up) w.underPrepass = (r, c) => { if (P.prof) seg('under'); const s = now(); try { return up(r, c); } finally { jsAcc.under = +((jsAcc.under || 0) + now() - s).toFixed(2); if (P.prof) seg('main'); } };
    const ud = w.underDraw?.bind(w); if (ud) w.underDraw = (...a) => { P.counters.underDraws = (P.counters.underDraws || 0) + 1; return ud(...a); };
    if (w.fx) { timed(w.fx, 'render', 'fxRender'); timed(w.fx, 'frame', 'fxFrame'); const L = w.fx.lighting; if (L?.render && !L.render.__perf) { const lr = L.render.bind(L); L.render = (dt) => { if (P.prof) seg('shadow'); return lr(dt); }; L.render.__perf = true; } }
  };
  timed(app.interact, 'frame', 'interact');
  if (app.fog) timed(app.fog, 'tick', 'fog'); if (app.pv) timed(app.pv, 'step', 'pv'); if (app.modes) timed(app.modes, 'frame', 'modes'); if (app.library) timed(app.library, 'frame', 'library');
  timed(app, 'emit', 'emit');
  // which of the frame listeners (app.on: the ring, the cut, rulers, chat ...) the 'emit' time is in: each one timed,
  // named by the first characters of its source
  P.lis = new Map();
  const wrapListeners = () => { if (!app.listeners) return; for (const fn of [...app.listeners]) { if (fn.__perf) continue; const label = String(fn).replace(/\s+/g, ' ').slice(0, 90);
    const w = (what, data) => { if (what !== 'frame' || !P.phase) return fn(what, data); const s = now(); try { return fn(what, data); } finally { P.lis.set(label, (P.lis.get(label) || 0) + now() - s); } };
    w.__perf = true; app.listeners.delete(fn); app.listeners.add(w); } };
  wrapListeners(); setInterval(wrapListeners, 2000); if (app.edgePan) timed(app.edgePan, 'step', 'edge');
  for (const v of app.views || []) timed(v, 'update', 'view');
  // time inside the page's own input handlers (window capture, first, to window bubble, last): it is not in a frame,
  // but a slow handler delays the next frame just the same. Counted into the next drawn frame as 'input'.
  let inT = null; const inAcc = { ms: 0, n: 0 };
  for (const ev of ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'mousemove', 'mousedown', 'mouseup', 'click']) {
    window.addEventListener(ev, () => { inT = now(); }, { capture: true, passive: true });
    window.addEventListener(ev, () => { if (inT != null) { inAcc.ms += now() - inT; inAcc.n++; inT = null; } }, { passive: true });
  }
  P.takeInput = () => { const r = +inAcc.ms.toFixed(2); inAcc.ms = 0; inAcc.n = 0; return r; };
  const sweep = () => { for (const w of app.worlds.values()) wrapWorld(w); };
  sweep(); setInterval(sweep, 1000);
  // ---- GPU: whole frame, from the game's own timer
  g.timing(true); app.gfxTiming = true; // (gfxTiming: Auto leaves the timer on after its measurement)
  // ---- GPU per pass (profile mode only: the whole-frame query is off then, a query cannot nest)
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let open = null; const pending = [];
  function seg(label) {
    if (!tq) return;
    if (open) { gl.endQuery(tq.TIME_ELAPSED_EXT); pending.push(open); open = null; }
    if (label && pending.length < 64) { const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); open = { q, label }; }
  }
  function poll() {
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i]; if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break; // (results come in order)
      if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6; const a = P.prof.sum[p.label] ||= [0, 0]; a[0] += ms; a[1]++; }
      gl.deleteQuery(p.q); pending.splice(i--, 1);
    }
  }
  let ppWrapped = false;
  async function wrapComposer() {
    if (ppWrapped) return; ppWrapped = true;
    const PP = await import('postprocessing'); const R = PP.EffectComposer.prototype.render;
    PP.EffectComposer.prototype.render = function (...a) {
      if (P.prof) for (const p of this.passes) if (!p.__perf) { const pr = p.render.bind(p); p.render = (...b) => { if (P.prof) seg(p.name || p.constructor?.name || 'pass'); return pr(...b); }; p.__perf = true; }
      const r = R.apply(this, a); if (P.prof) seg('after'); return r;
    };
  }
  P.profile = async (on) => {
    await wrapComposer();
    if (on) { g.timing(false); globalThis.__gpuWrap = true; P.prof = { sum: {}, frames: 0 }; } // (__gpuWrap: the fog's and the water's own queries stand aside)
    else { seg(null); P.prof = null; g.timing(true); }
    return !!tq;
  };
  P.profileRead = () => { if (!P.prof) return null; const out = {}; for (const [k, [ms, n]] of Object.entries(P.prof.sum)) out[k] = { ms: +(ms / Math.max(1, n)).toFixed(3), n }; P.prof.sum = {}; return out; };
  // ---- phases
  const fxStats = () => { try { const w = app.worldOf(app.area()); const s = w.fx?.stats?.() || {}; return { draw_calls: s.frame_draw_calls, triangles: s.frame_triangles, programs: s.programs, shadow_why: s.shadow_why, shadow_list_draws: s.shadow_list_draws, atmos_draw_calls: s.atmos_draw_calls, lights_shining: s.lights_shining, fogwar_on: s.fogwar_on, under_shown: w.underShown || 0 }; } catch (e) { return { err: String(e) }; } };
  P.start = (name) => { P.phase = name; P.lis.clear(); P.frames = []; P.pend = []; P.lastNow = null; P.t = now(); P.c0 = { ...P.counters }; P.fx0 = fxStats(); P.ilog0 = app.interact?.state?.log?.length || 0; g.clearGpu(); return true; };
  P.stop = () => {
    const name = P.phase; P.phase = null;
    const c = {}; for (const [k, v] of Object.entries(P.counters)) c[k] = v - (P.c0[k] || 0);
    const fx1 = fxStats(), why = {}; for (const k of Object.keys(fx1.shadow_why || {})) why[k] = fx1.shadow_why[k] - (P.fx0.shadow_why?.[k] || 0);
    const info = app.interact?.info?.() || {};
    return { name, wall: +(now() - P.t).toFixed(1), frames: P.frames, gpu: g.gpuSamples().map(x => +x.toFixed(3)), long: P.long.filter(l => l[0] >= P.t - 1), counters: c,
      fx: { ...fx1, shadow_why: why, shadow_list_draws: (fx1.shadow_list_draws || 0) - (P.fx0.shadow_list_draws || 0) },
      listeners: [...P.lis].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, +(v / Math.max(1, P.frames.length)).toFixed(2)]),
      governor: { shed: info.shed, learned: info.learned, resizeMs: info.resizeMs, log: (app.interact?.state?.log || info.log || []).filter(l => l[0] >= P.t - 1) }, gfx: g.info(), pixelRatio: renderer.getPixelRatio(),
      ratios: [...new Set(P.frames.map(f => f[5]))] };
  };
  P.longAll = () => P.long.slice();
  return 'ok';
})()
