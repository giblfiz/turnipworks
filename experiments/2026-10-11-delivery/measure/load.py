#!/usr/bin/env python3
"""Cold load of a scene: where the time goes (download list, decode, GPU upload, shader compile, draw) + the scene census.
  python3 load.py room inn town      -> /var/tmp/tw-asset-cost/out/load-<scene>.json
"""
import gzip, json, os, sys, time, ac
from playwright.sync_api import sync_playwright
mm = ac.mm
def file_of(url):
    u = url.split('?')[0]
    for pre, d in (('/tuner/', os.path.join(ac.REPO, 'tools/spawn-tuner')), ('/engine/', os.path.join(ac.REPO, 'engine'))):
        if pre in u and '127.0.0.1' in u: return os.path.join(d, u.split(pre, 1)[1])
for name in sys.argv[1:]:
    with sync_playwright() as p:
        q, _ = mm.wait_gpu_quiet(timeout=60)
        S = ac.open_scene(p, name, profile=True); pg = S['pg']; out = {'scene': name, 'quiet_start': q, 'load_avg': mm.load_now(), 't_ready_s': round(S['t_ready'], 2)}
        ok, t_set, st = mm.wait_settled(pg, timeout=900); out['t_settled_s'] = round(time.time() - S['t0'], 2); out['settled'] = ok
        prof = S['cdp'].send('Profiler.stop')['profile']
        out['gl_load'] = pg.evaluate('__glw.snap()'); out['tex_ledger_at_settle'] = pg.evaluate('__glw.texSummary()'); out['longtasks'] = pg.evaluate('__glw.longtasks')
        cats, fns = ac.profile_table(prof); out['profile_ms'] = cats; out['profile_top'] = fns; out['profile_span_ms'] = round((prof['endTime'] - prof['startTime']) / 1000)
        ok2, t_seat = mm.wait_seated(pg, timeout=600); out['t_seated_s'] = round(time.time() - S['t0'], 2)
        out['console'] = S['console'][:10]; out['errors'] = S['errors'][:8]
        out['census'] = pg.evaluate(ac.CENSUS); out['fx'] = {k: v for k, v in pg.evaluate("tw.worldOf(tw.area()).fx.stats()").items() if k in ('frame_draw_calls', 'frame_triangles', 'programs', 'fire_lights', 'lights_shining', 'shadow_casters')}
        out['tex_ledger'] = pg.evaluate('__glw.texSummary()'); out['gl_total'] = pg.evaluate('__glw.snap()')
        out['ctx_lost'] = ac.ctx_lost(pg); out['load_avg_end'] = mm.load_now()
        out['heap_mb'] = round(pg.evaluate('performance.memory.usedJSHeapSize') / 1e6); out['gpu_proc_mb'] = mm.my_gpu_mem()
        # the files this load asked for
        by = {}; files = []
        for url, size, timing in S['reqs']:
            f = file_of(url); ext = url.split('?')[0].rsplit('.', 1)[-1].lower() if '.' in url.split('?')[0].rsplit('/', 1)[-1] else 'api'
            kind = 'mesh .glb' if ext == 'glb' else 'texture .webp/.png' if ext in ('webp', 'png', 'jpg') else 'code .js/.css/.html' if ext in ('js', 'css', 'html', 'mjs') else 'data .json' if ext == 'json' else 'other'
            if 'cdn.jsdelivr' in url: kind = 'three.js from CDN'
            raw = os.path.getsize(f) if f and os.path.isfile(f) else (size or 0)
            gz = len(gzip.compress(open(f, 'rb').read(), 6)) if f and os.path.isfile(f) and ext not in ('webp', 'png', 'jpg') else raw
            e = by.setdefault(kind, {'n': 0, 'raw': 0, 'wire_gzip': 0}); e['n'] += 1; e['raw'] += raw; e['wire_gzip'] += gz
            if f: files.append([os.path.relpath(f, ac.REPO), raw, gz])
        out['requests'] = by; out['files'] = files
        out['frame'] = mm.measure(pg, want=1, budget_s=30)
        pg.screenshot(path=f'{ac.OUT}/load-{name}.png')
        json.dump(out, open(f'{ac.OUT}/load-{name}.json', 'w'), indent=1)
        print(json.dumps({k: v for k, v in out.items() if k not in ('files', 'profile_top', 'longtasks', 'gl_load', 'gl_total')}, indent=1)[:6000], flush=True)
        S['browser'].close()
