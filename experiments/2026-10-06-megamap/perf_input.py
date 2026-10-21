#!/usr/bin/env python3
"""From the hand to the picture: for a pan, a turn, a wheel zoom, a pawn drag and plain hovering, the time from each input
event (its own timestamp) to the end of the drawing of the first frame that shows it. Real input events (Playwright
through the DevTools protocol), one browser, uncapped. Works on the code before the fixes too (TW_MM_REPO).
  python3 perf_input.py --data <relay data dir> --rooms 203 --tag new [--views default,quarter]
What is timed: event timestamp -> the end of the JavaScript of the frame that draws it (all draw calls issued). The
graphics card's own time and the browser's compositor come after that and are not in the number (headless, uncapped).
'handler' is the time the game's own event handlers took for the event; 'frame' the mean frame time during the gesture.
Appends one line to results/input.jsonl."""
import argparse, json, os, statistics, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--tag', default=''); ap.add_argument('--out', default='results/input.jsonl')
ap.add_argument('--views', default='default'); ap.add_argument('--seated-wait', type=float, default=240); ap.add_argument('--extra', default=''); ap.add_argument('--set', default='', help='JS run in the page before the gestures (e.g. a setting)')
ap.add_argument('--rounds', type=int, default=2)
A = ap.parse_args()
B = [json.loads(l) for l in open(os.environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
ext = B['extent']; rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d'])
WATCH = """(() => { const L = window.__lat = { pending: [], done: [], frames: [], on: true };
  const types = ['pointermove', 'wheel', 'pointerdown', 'pointerup'];
  for (const t of types) { addEventListener(t, (e) => { if (!L.on) return; e.__lat = { type: t, ts: e.timeStamp, h0: performance.now() }; }, true);
    addEventListener(t, (e) => { if (!L.on || !e.__lat) return; e.__lat.h1 = performance.now(); if (t === 'pointermove' || t === 'wheel') L.pending.push(e.__lat); }, false); }
  const raf = window.requestAnimationFrame; let depth = 0;
  window.requestAnimationFrame = (f) => raf((ts) => { const a = performance.now(); depth++; try { f(ts); } finally { depth--; }
    if (depth === 0) { const b = performance.now(); if (L.on) { L.frames.push(b - a); const drawn = L.pending.filter(p => p.h1 <= a); L.pending = L.pending.filter(p => p.h1 > a); for (const p of drawn) L.done.push({ type: p.type, lat: b - p.ts, wait: p.h0 - p.ts, handler: p.h1 - p.h0, frame: b - a }); } } }); })()"""
TAKE = "(() => { const L = window.__lat, out = { done: L.done, frames: L.frames }; L.done = []; L.frames = []; L.pending = []; return out; })()"
def stats(d):
    ev = d['done']; lat = sorted(e['lat'] for e in ev); fr = d['frames']
    if not lat: return {'events': 0}
    q = lambda xs, p: xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))]
    return {'events': len(lat), 'lat_median': round(statistics.median(lat), 1), 'lat_p90': round(q(lat, 0.9), 1), 'lat_max': round(lat[-1], 1), 'wait_median': round(statistics.median(e['wait'] for e in ev), 1),
            'handler_median': round(statistics.median(e['handler'] for e in ev), 2), 'handler_max': round(max(e['handler'] for e in ev), 1), 'frame_mean': round(sum(fr) / max(1, len(fr)), 1), 'frames': len(fr)}
def main():
    out = {'script': 'perf_input', 'rooms': A.rooms, 'tag': A.tag, 'repo': mm.REPO, 'commit': os.popen(f'git -C {mm.REPO} rev-parse --short HEAD').read().strip(), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'load_start': mm.load_now(), 'gpu_start': mm.gpu_now(), 'set': A.set, 'gestures': {}}
    mm.start_local(A.data)
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'], extra=A.extra)
        pg.evaluate(mm.cam_js(*C_BLD, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(2500); out['seated'] = mm.wait_seated(pg, A.seated_wait)
        pg.evaluate('window.tw && (tw.interactForce = true)')  # (the game's shedding while the hand moves is off under a test driver unless asked for)
        if A.set: pg.evaluate(A.set); pg.wait_for_timeout(800)
        pg.evaluate(WATCH)
        # a pawn to drag: in the street south of the first building, on open ground
        px, pz = C_BLD[0] + 2.5, lots[0]['z'] + 62.5
        pg.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_perfinput1', name: 'Hand', x: {px}, z: {pz} }})"); pg.wait_for_function("tw.entities()['tok_perfinput1'] && tw.sync.pendingCount() === 0", timeout=60000); pg.wait_for_timeout(800)
        W, H = mm.VIEWPORT['width'], mm.VIEWPORT['height']
        def cam(c, dist): pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(2000)
        def gesture(name, fn):
            pg.evaluate(TAKE); fn(); pg.wait_for_timeout(250); s = stats(pg.evaluate(TAKE)); s['load'] = mm.load_now()[0]; s['others_gpu'] = mm.others_gpu()
            out['gestures'].setdefault(name, []).append(s); mm.say(f"  {A.tag} {A.rooms} {name}: latency median {s.get('lat_median')} p90 {s.get('lat_p90')} ms, handler {s.get('handler_median')} ms, frame {s.get('frame_mean')} ms, {s.get('events')} events")
        def drag(button, n=36, step=9, pause=16):
            def f():
                x, y = W * 0.5, H * 0.55; pg.mouse.move(x, y); pg.mouse.down(button=button)
                for i in range(n): x += step * (1 if (i // 12) % 2 == 0 else -1); y += step * 0.3; pg.mouse.move(x, y); pg.wait_for_timeout(pause)
                pg.mouse.up(button=button)
            return f
        def wheel():
            pg.mouse.move(W * 0.5, H * 0.5)
            for i in range(24): pg.mouse.wheel(0, -100 if i < 12 else 100); pg.wait_for_timeout(30)
        def hover():
            for i in range(36): pg.mouse.move(W * 0.3 + i * 18, H * 0.4 + (i % 6) * 14); pg.wait_for_timeout(16)
        def pawn():
            e = pg.evaluate("tw.entities()['tok_perfinput1']"); s = pg.evaluate(f"tw.screenOf({e['x']}, {e['z']}, tw.main, 1.5)")
            pg.mouse.move(s['x'], s['y']); pg.wait_for_timeout(150); pg.mouse.down(); x, y = s['x'], s['y']
            for i in range(36): x += 8 * (1 if (i // 12) % 2 == 0 else -1); y += 2; pg.mouse.move(x, y); pg.wait_for_timeout(16)
            out.setdefault('dragging', []).append(pg.evaluate('tw.localDrags.size')); pg.mouse.up(); pg.wait_for_timeout(400)
            pg.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_perfinput1', x: {px}, z: {pz} }})"); pg.wait_for_timeout(500)
        for view in A.views.split(','):
            for rnd in range(A.rounds):
                cam(C_BLD if view != 'pawnview' else (px, pz), 110 if view == 'default' else max(110, SPAN * 0.5))
                gesture(f'{view}|pan', drag('right')); cam(C_BLD, 110 if view == 'default' else max(110, SPAN * 0.5))
                gesture(f'{view}|rotate', drag('middle')); cam(C_BLD, 110 if view == 'default' else max(110, SPAN * 0.5))
                gesture(f'{view}|wheel', wheel); cam((px, pz), 110 if view == 'default' else max(110, SPAN * 0.5))
                gesture(f'{view}|pawn', pawn); cam(C_BLD, 110 if view == 'default' else max(110, SPAN * 0.5))
                gesture(f'{view}|hover', hover)
        pg.evaluate("window.__lat.on = false"); pg.evaluate("tw.dispatch('token.delete', { id: 'tok_perfinput1' })"); pg.wait_for_timeout(800)
        out['left'] = pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length"); out['errors'] = [e for e in errors if '404' not in e][:8]; out['load_end'] = mm.load_now()
        browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n')
try: main()
finally: mm.stop()
