#!/usr/bin/env python3
"""A against B in one page, in turn (A, B, A, B ...), for the big-map fixes (FIXES.md). Each fix has a switch in the
game (tw.perf.set, engine/client/world.js PERF): off is the code as it was. One browser, one map, one view at a time.
  python3 perf_ab.py --data <relay data dir> --rooms 203 --flags aoList [--base k=v,..] [--views default,quarter,whole,pan] [--rounds 2]
--flags   the switches that differ between A (all of them off) and B (all of them on)
--base    switches held the same in A and B (e.g. sleep=0 while measuring aoList alone); the rest keep their defaults
Appends one line to results/fixes.jsonl. Needs BUILD_JSONL (build_get.py's record of the maps on that relay)."""
import argparse, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--flags', required=True); ap.add_argument('--base', default='')
ap.add_argument('--views', default='default,quarter,whole'); ap.add_argument('--rounds', type=int, default=2); ap.add_argument('--out', default='results/fixes.jsonl'); ap.add_argument('--tag', default=''); ap.add_argument('--extra', default='')
ap.add_argument('--budget', type=float, default=14, help='seconds to wait for a quiet GPU before each timed run (the box is shared: it rarely is)')
ap.add_argument('--atmos', default='', help="a built-in atmosphere name or 'sea' (the house fog with the fog sea on) to load before measuring")
A = ap.parse_args()
B = [json.loads(l) for l in open(os.environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
ext = B['extent']; rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d']); CEN = (ext['cx'], ext['cz'])
FLAGS = A.flags.split(','); BASE = dict((k, v not in ('0', 'false', 'off')) for k, v in (kv.split('=') for kv in A.base.split(',') if kv))
PAN_JS = """(v) => { window.__pan = true; const g = tw.main.grab; let last = performance.now(), dir = 1, x0 = g.focus.x; const step = (now) => { if (!window.__pan) { g.focus.x = x0; g.update(); return; } const dt = (now - last) / 1000; last = now; g.focus.x += dir * v * dt; if (Math.abs(g.focus.x - x0) > 150) dir = -dir; g.update(); requestAnimationFrame(step); }; requestAnimationFrame(step); }"""
def main():
    out = {'script': 'perf_ab', 'rooms': A.rooms, 'flags': FLAGS, 'base': BASE, 'tag': A.tag, 'atmos': A.atmos, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'load_start': mm.load_now(), 'gpu_start': mm.gpu_now(), 'views': {}}
    mm.start_local(A.data)
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'], extra=A.extra)
        pg.evaluate(mm.cam_js(*C_BLD, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000)
        out['commit'] = os.popen(f'git -C {mm.REPO} rev-parse --short HEAD').read().strip(); out['perf_default'] = pg.evaluate('tw.perf.get()')
        if A.atmos:
            if A.atmos == 'sea': pg.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = fx.params('atmos'); fx.setParams('atmos', { ...p, world: { ...p.world, unbuilt: 0.75 } }); })()")
            else: pg.evaluate(f"tw.worldOf(tw.area()).fx.setParams('atmos', {{ name: '{A.atmos}' }})")
            pg.wait_for_timeout(1500)
        out['atmos_name'] = pg.evaluate("tw.worldOf(tw.area()).fx.params('atmos').name"); out['atmos_unbuilt'] = pg.evaluate("tw.worldOf(tw.area()).fx.params('atmos').world?.unbuilt")
        def setf(on): pg.evaluate('(p) => tw.perf.set(p)', {**BASE, **{k: on for k in FLAGS}}); pg.wait_for_timeout(1800)
        def cam(c, dist): pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(2500)
        q = max(110, SPAN * 0.5); full = max(110, SPAN * 1.15)
        for view in A.views.split(','):
            if view in ('default', 'pan'): cam(C_BLD, 110)
            elif view == 'quarter': cam(C_BLD, q)
            elif view == 'whole': cam(CEN, full)
            if view == 'pan': pg.evaluate(PAN_JS, 60)
            rows = []
            for i in range(A.rounds):
                for on in (False, True):
                    setf(on); r = mm.measure(pg, 2.5, want=1, budget_s=A.budget); st = pg.evaluate("(() => { const w = tw.worldOf(tw.area()), s = w.fx.stats(); let n = 0; w.scene.traverse(() => n++); return { nodes: n, ao_see_through: s.ao_see_through, casters: s.shadow_casters, asleep: w.sleepStats?.() || null }; })()")
                    rows.append({'on': on, 'mean_ms': r.get('mean_ms'), 'js_ms': r.get('js_ms'), 'p95_ms': r.get('p95_ms'), 'quiet': r.get('quiet'), 'load': r.get('load'), 'draws': r.get('draw_calls'), **st})
                    mm.say(f"  {A.rooms} {view} {'B on ' if on else 'A off'} {r.get('mean_ms')} ms  js {r.get('js_ms')}  p95 {r.get('p95_ms')}  quiet {r.get('quiet')}  load {r.get('load')}  nodes {st['nodes']}  draws {r.get('draw_calls')}")
            if view == 'pan': pg.evaluate('window.__pan = false')
            a = [x['mean_ms'] for x in rows if not x['on']]; b = [x['mean_ms'] for x in rows if x['on']]
            out['views'][view] = {'A_ms': a, 'B_ms': b, 'A': round(sum(a) / len(a), 1), 'B': round(sum(b) / len(b), 1), 'disturbed': any(not x['quiet'] for x in rows), 'rows': rows}
            mm.say(f"{A.rooms} {view}: A {out['views'][view]['A']} -> B {out['views'][view]['B']} ms{' *' if out['views'][view]['disturbed'] else ''}")
        out['errors'] = [e for e in errors if '404' not in e][:8]; out['lost'] = pg.evaluate(mm.GPU_JS)['lost']; out['load_end'] = mm.load_now()
        browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n')
try: main()
finally: mm.stop()
