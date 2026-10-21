#!/usr/bin/env python3
"""One page load, every still view and the pan, with the fog as shipped, without fog, and with the fog sea; and (new
code only) the fixes added one at a time. Works on the code before the fixes too (TW_MM_REPO=<checkout at main>), so the
two can be loaded in turn (old, new, old, new) and compared: FIXES.md.
  python3 perf_matrix.py --data <relay data dir> --rooms 203 --tag new [--stack] [--seated-wait 240]
Each timed view is measured twice 'as loaded' is NOT what this does: it first waits (up to --seated-wait s) for the
seating queue to run out, and says whether it did; --loaded measures the default view straight after loading as well.
Appends one line to results/matrix.jsonl."""
import argparse, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--tag', default=''); ap.add_argument('--out', default='results/matrix.jsonl')
ap.add_argument('--stack', action='store_true', help='the fixes one at a time (needs tw.perf)'); ap.add_argument('--seated-wait', type=float, default=240); ap.add_argument('--budget', type=float, default=10); ap.add_argument('--no-fog', action='store_true', help='skip the fog variants'); ap.add_argument('--extra', default='')
A = ap.parse_args()
B = [json.loads(l) for l in open(os.environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
ext = B['extent']; rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d']); CEN = (ext['cx'], ext['cz'])
PAN_JS = """(v) => { window.__pan = true; const g = tw.main.grab; let last = performance.now(), dir = 1, x0 = g.focus.x; const step = (now) => { if (!window.__pan) { g.focus.x = x0; g.update(); return; } const dt = (now - last) / 1000; last = now; g.focus.x += dir * v * dt; if (Math.abs(g.focus.x - x0) > 150) dir = -dir; g.update(); requestAnimationFrame(step); }; requestAnimationFrame(step); }"""
fxp = "tw.worldOf(tw.area()).fx"
def main():
    out = {'script': 'perf_matrix', 'rooms': A.rooms, 'tag': A.tag, 'repo': mm.REPO, 'commit': os.popen(f'git -C {mm.REPO} rev-parse --short HEAD').read().strip(), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'load_start': mm.load_now(), 'gpu_start': mm.gpu_now(), 'views': {}, 'stack': {}}
    mm.start_local(A.data)
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'], extra=A.extra)
        pg.evaluate(mm.cam_js(*C_BLD, 110)); ok, s, st = mm.wait_settled(pg, timeout=3600); out['everything_in_s'] = round(t + s, 1); pg.wait_for_timeout(2500)
        q = max(110, SPAN * 0.5); full = max(110, SPAN * 1.15)
        def cam(c, dist): pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(2200)
        def m(seconds=2.5):
            r = mm.measure(pg, seconds, want=1, budget_s=A.budget); return {k: r.get(k) for k in ('mean_ms', 'js_ms', 'p95_ms', 'max_ms', 'quiet', 'load', 'draw_calls', 'triangles')}
        def view(name):
            if name in ('default', 'pan'): cam(C_BLD, 110)
            elif name == 'quarter': cam(C_BLD, q)
            elif name == 'whole': cam(CEN, full)
            if name == 'pan': pg.evaluate(PAN_JS, 60)
            r = m()
            if name == 'pan': pg.evaluate('window.__pan = false')
            return r
        out['loaded'] = {'default': view('default'), 'seating_queue': pg.evaluate("tw.worldOf(tw.area()).settler.pending()")}
        mm.say(f"{A.tag} {A.rooms} as loaded: default {out['loaded']['default']['mean_ms']} ms, {out['loaded']['seating_queue']} things still to seat")
        out['seated'] = mm.wait_seated(pg, A.seated_wait); pg.wait_for_timeout(1500)
        A0 = json.dumps(pg.evaluate(f"{fxp}.params('atmos')")); out['atmos'] = json.loads(A0).get('name')
        fogs = [('fog', None)] + ([] if A.no_fog else [('nofog', f"{fxp}.setParams('atmos', {{ name: 'clear' }})"), ('sea', f"(() => {{ const p = {A0}; {fxp}.setParams('atmos', {{ ...p, world: {{ ...p.world, unbuilt: 0.75 }} }}); }})()")])
        for rnd in range(2):
            for fog, js in fogs:
                if js: pg.evaluate(js); pg.wait_for_timeout(1500)
                for v in ('default', 'quarter', 'whole', 'pan'):
                    r = view(v); out['views'].setdefault(f'{v}|{fog}', []).append(r)
                    mm.say(f"  {A.tag} {A.rooms} {v} {fog}: {r['mean_ms']} ms (js {r['js_ms']}, p95 {r['p95_ms']}, quiet {r['quiet']}, load {r['load']}, draws {r['draw_calls']})")
                if js: pg.evaluate(f"{fxp}.setParams('atmos', {A0})"); pg.wait_for_timeout(1500)
        if A.stack and pg.evaluate('!!(window.tw && tw.perf)'):
            flags = list(pg.evaluate('Object.keys(tw.perf.get())')); order = [k for k in ('aoList', 'sleep', 'shadowList', 'freeze') if k in flags] + [k for k in flags if k not in ('aoList', 'sleep', 'shadowList', 'freeze')]
            out['stack_order'] = order
            for rnd in range(2):
                for n in range(len(order) + 1):
                    pg.evaluate('(p) => tw.perf.set(p)', {k: i < n for i, k in enumerate(order)}); pg.wait_for_timeout(2800)
                    for v in ('default', 'quarter', 'whole'):
                        r = view(v); out['stack'].setdefault(f'{n}|{v}', []).append(r)
                        mm.say(f"  stack {A.rooms} {'+'.join(order[:n]) or 'none'} {v}: {r['mean_ms']} ms (quiet {r['quiet']}, draws {r['draw_calls']})")
            pg.evaluate('(p) => tw.perf.set(p)', {k: True for k in order})
        out['scene'] = pg.evaluate("(() => { const w = tw.worldOf(tw.area()); let n = 0; w.scene.traverse(() => n++); return { nodes: n, things: w.recs.size, shell: w.shell.size, asleep: w.sleepStats?.().asleep.length ?? null }; })()")
        out['errors'] = [e for e in errors if '404' not in e][:8]; out['lost'] = pg.evaluate(mm.GPU_JS)['lost']; out['load_end'] = mm.load_now()
        browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n')
    for k, v in out['views'].items(): mm.say(f"{A.tag} {A.rooms} {k}: {[x['mean_ms'] for x in v]}")
try: main()
finally: mm.stop()
