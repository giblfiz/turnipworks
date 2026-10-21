// THE FPS METER (Harry 2026-10-06: "Can you also add a toggleable FPS meter for me as well? It's fine if the only way
// to activate it is the chatbar"). A small readout in the lower right corner, above the status line: frames per
// second, the median and the worst frame time of the last two seconds (so a stutter shows), and the renderer's draw
// calls and triangles. Off by default; switched from the command bar ("FPS meter"); per seat, in this browser only
// (localStorage `tw.fps`), never sent. It costs one array write per frame; the text is rewritten twice a second.
const KEY = 'tw.fps', WINDOW_MS = 2000, EVERY_MS = 500;

export function fpsSurface(R, app) {
  const el = document.createElement('div'); el.id = 'fpsMeter'; el.hidden = true; el.setAttribute('aria-hidden', 'true');
  document.getElementById('app').append(el);
  let on = false, last = 0, shownAt = 0, times = [], stamps = [];
  try { on = localStorage.getItem(KEY) === '1'; } catch { }
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
  const fmt = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(Math.round(n));
  function show(now) {
    while (stamps.length && now - stamps[0] > WINDOW_MS) { stamps.shift(); times.shift(); }
    if (!times.length) return;
    const s = [...times].sort((a, b) => a - b), med = s[s.length >> 1], worst = s[s.length - 1], span = Math.max(1, now - (stamps[0] - times[0]));
    const st = (() => { try { const w = app.area() && app.worlds.get(app.area()); return w?.fx?.stats?.() || null; } catch { return null; } })();
    app.fpsMeter.value = { fps: Math.round(times.length * 1000 / span), median: +med.toFixed(1), worst: +worst.toFixed(1), calls: st?.frame_draw_calls ?? null, triangles: st?.frame_triangles ?? null };
    const v = app.fpsMeter.value;
    // the Graphics preset in use, whether the idle rate is on right now, and GPU time a frame where the browser can say (graphics.js)
    const g = app.gfx?.info?.() || null;
    Object.assign(v, { preset: g?.preset ?? null, autoPick: g?.preset === 'auto' ? g.autoPick : null, idle: g?.state === 'idle', rate: g?.rate || 0, gpu: g?.gpuMs ?? null, pixelRatio: g?.pixelRatio ?? null });
    const pre = g ? `${g.preset === 'auto' ? `Auto (${cap(g.autoPick)})` : cap(g.preset)}${g.pixelRatio ? ` ${g.pixelRatio}×` : ''}` : '';
    el.textContent = `${v.fps} fps${v.idle ? ` (idle: ${v.rate} a second)` : v.rate ? ` (limit ${v.rate})` : ''} · ${v.median.toFixed(1)} ms · worst ${v.worst.toFixed(1)}${v.gpu != null ? ` · GPU ${v.gpu.toFixed(1)} ms` : ''}${v.calls != null ? ` · ${fmt(v.calls)} draws · ${fmt(v.triangles)} tris` : ''}${pre ? ` · ${pre}` : ''}`;
  }
  function set(v) {
    on = !!v; app.gfx?.timing?.(on); el.hidden = !on; times = []; stamps = []; last = 0; el.textContent = on ? '… fps' : ''; app.fpsMeter.value = null;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { }
    return on;
  }
  app.fpsMeter = { get on() { return on; }, value: null, set, toggle: () => set(!on), el };
  el.hidden = !on; if (on) { el.textContent = '… fps'; app.gfx?.timing?.(true); }
  app.on((what) => {
    if (what !== 'frame' || !on) return;
    const now = performance.now();
    if (last) { times.push(now - last); stamps.push(now); }
    last = now;
    if (now - shownAt >= EVERY_MS) { shownAt = now; show(now); }
  });
  R.add({ id: 'view.fps', title: 'FPS meter', synonyms: ['fps', 'frame rate', 'frame time', 'performance', 'stats', 'framerate', 'frames per second'], icon: 'activity', group: 'View', run: () => { const v = app.fpsMeter.toggle(); app.toast(v ? 'FPS meter on' : 'FPS meter off'); } });
  return { name: 'fps' };
}
