// THE VIRTUAL CLOCK (tools/promo, 2026-10-22). Installed with page.add_init_script before any of the game's code runs.
// Until __promo.freeze() the page runs on real time (it loads, joins, fetches meshes as usual). After it, time is
// whatever __promo.step(ms) says: performance.now, Date.now, requestAnimationFrame, setTimeout / setInterval all run on
// the stepped clock, so one step of 1000/60 ms renders exactly one frame of a 60 fps film however long the box takes to
// draw it. Network, workers, image decoding and promises stay real (they finish when they finish; nothing in the
// picture is timed by them once the spawn-in has started).
// Math.random is a seeded generator from the first line (the spawn-in's choreography draws on it: the same seed gives
// the same choreography, so two captures of one building differ only by what the rig changed).
(() => {
  const seed = (globalThis.__PROMO_SEED >>> 0) || 0x7e57c0de;
 let s = seed; const reseed = (v) => { s = v >>> 0; }; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rPerf = performance.now.bind(performance), rDate = Date.now, rRAF = window.requestAnimationFrame.bind(window), rCAF = window.cancelAnimationFrame.bind(window);
  const rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window), rSI = window.setInterval.bind(window), rCI = window.clearInterval.bind(window);
  const P = window.__promo = { virtual: false, t: 0, dateAt: 0, raf: new Map(), timers: new Map(), id: 1 << 24, steps: 0, rafCalls: 0, timerFires: 0 };
  performance.now = () => P.virtual ? P.t : rPerf();
  Date.now = () => P.virtual ? Math.floor(P.dateAt + P.t) : rDate();
  // rAF: in real mode a real frame, but one that lands after the freeze joins the stepped queue instead of running
  window.requestAnimationFrame = (cb) => {
    const id = ++P.id;
    if (P.virtual) { P.raf.set(id, cb); return id; }
    const real = rRAF((ts) => { P.realRaf?.delete(id); if (P.virtual) P.raf.set(id, cb); else cb(ts); });
    (P.realRaf ||= new Map()).set(id, real); return id;
  };
  window.cancelAnimationFrame = (id) => { P.raf.delete(id); const r = P.realRaf?.get(id); if (r != null) { rCAF(r); P.realRaf.delete(id); } };
  const add = (cb, ms, args, every) => {
    const id = ++P.id, delay = Math.max(0, +ms || 0);
    if (P.virtual) { P.timers.set(id, { due: P.t + delay, cb, args, every: every ? Math.max(1, delay) : 0, seq: id }); return id; }
    const fire = () => { if (typeof cb === 'function') cb(...args); };
    if (every) { const r = rSI(() => { if (P.virtual) { rCI(r); P.real.delete(id); P.timers.set(id, { due: P.t + Math.max(1, delay), cb, args, every: Math.max(1, delay), seq: id }); } else fire(); }, delay); (P.real ||= new Map()).set(id, [r, rCI]); }
    else { const r = rST(() => { P.real.delete(id); if (P.virtual) P.timers.set(id, { due: P.t, cb, args, every: 0, seq: id }); else fire(); }, delay); (P.real ||= new Map()).set(id, [r, rCT]); }
    return id;
  };
  const clear = (id) => { P.timers.delete(id); const r = P.real?.get(id); if (r) { r[1](r[0]); P.real.delete(id); } };
  window.setTimeout = (cb, ms, ...args) => add(cb, ms, args, false);
  window.setInterval = (cb, ms, ...args) => add(cb, ms, args, true);
  window.clearTimeout = clear; window.clearInterval = clear;
  P.reseed = (v) => reseed(v ?? seed); // (just before the drop: its choreography then draws the same numbers in every take)
  P.freeze = () => { if (P.virtual) return P.t; P.t = rPerf(); P.dateAt = rDate() - P.t; P.virtual = true; return P.t; };
  // back to real time (a probe still): what waits on the stepped clock is handed to the real one
  P.thaw = () => { if (!P.virtual) return; const at = P.t; P.virtual = false; const off = rPerf() - at;
    const q = [...P.raf]; P.raf.clear(); for (const [, cb] of q) window.requestAnimationFrame(cb);
    const tm = [...P.timers.values()]; P.timers.clear(); for (const t of tm) (t.every ? window.setInterval : window.setTimeout)(t.cb, t.every || Math.max(0, t.due - at), ...t.args);
    return off; };
  // advance the clock by ms: every timer that falls due fires at its own time, in order; then the frame's rAF callbacks
  // run once, with the new time (that is the frame drawn)
  P.step = (ms) => {
    const end = P.t + ms; let guard = 0;
    for (;;) {
      let next = null; for (const [id, tm] of P.timers) if (tm.due <= end && (!next || tm.due < next[1].due || (tm.due === next[1].due && tm.seq < next[1].seq))) next = [id, tm];
      if (!next || ++guard > 5000) break;
      const [id, tm] = next; P.t = Math.max(P.t, tm.due);
      if (tm.every) { tm.due += tm.every; tm.seq = ++P.id; } else P.timers.delete(id);
      P.timerFires++; try { if (typeof tm.cb === 'function') tm.cb(...tm.args); } catch (e) { console.error('promo timer', e); }
    }
    P.t = end;
    const q = [...P.raf]; P.raf.clear();
    for (const [, cb] of q) { P.rafCalls++; try { cb(P.t); } catch (e) { console.error('promo raf', e); } }
    P.steps++; return P.t;
  };
})();
