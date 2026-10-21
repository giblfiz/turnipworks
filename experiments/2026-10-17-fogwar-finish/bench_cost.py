#!/usr/bin/env python3
"""Measure GPU time at 2x DPR on Medium on one room and on the big town (50 rooms), with vision fog active and GM view."""
import argparse, json, os, statistics, sys, time
REPO = os.environ.get('BENCH_REPO', '<repo>')
os.environ['TW_MM_REPO'] = REPO
os.environ.setdefault('TW_MM_PORTS', '18268,18895')
sys.path.insert(0, os.path.join(REPO, 'experiments', '2026-10-06-megamap'))
import mm, layout
mm.tw_sandbox.remove_campaigns()
from playwright.sync_api import sync_playwright

GPU_JS = """(n) => new Promise(resolve => { tw.gfx.timing(true); tw.gfx.clearGpu(); const f0 = tw.stats.frames, t0 = performance.now();
  const tick = () => { const g = tw.gfx.gpuSamples(); const t = performance.now();
    if (g.length >= n || t - t0 > 20000) { const s = [...g].sort((a, b) => a - b); const k = s.slice(0, Math.max(1, Math.floor(s.length * 0.95))); resolve({ gpu: s.length ? k.reduce((a, b) => a + b, 0) / k.length : null, med: s.length ? s[s.length >> 1] : null, p90: s.length ? s[Math.floor(s.length * 0.9)] : null, n: s.length, frame: (t - t0) / Math.max(1, tw.stats.frames - f0), frames: tw.stats.frames - f0, programs: tw.worldOf(tw.area()).fx.stats().programs, fogwar: tw.worldOf(tw.area()).fx.fogwar.stats() }); }
    else setTimeout(tick, 50); }; tick(); })"""
SETTLED = "(() => { const f = tw.worldOf(tw.area()).fx.fire; return f.cap === f.capWant; })()"

def open_page(p, dpr, token=None, campaign=None):
    browser = p.chromium.launch(headless=True, args=mm.ARGS + mm.UNCAPPED)
    ctx = browser.new_context(viewport=mm.VIEWPORT, device_scale_factor=dpr)
    pg = ctx.new_page()
    mm.tw_sandbox.proxy(pg, mm.API)
    pg.set_default_timeout(180000)
    if token:
        pg.goto(mm.page_url() + '#s=' + token)
    else:
        pg.goto(mm.page_url())
        pg.fill('#newCampaign input[name=name]', campaign)
        pg.fill('#newCampaign input[name=gm]', 'Fauna-bench')
        pg.click('#newCampaign button')
    pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=600000)
    pg.mouse.move(5, 5)
    return browser, pg

def build_scene(p, name, rs, px, pz):
    b, pg = open_page(p, 1, campaign=name)
    token = pg.evaluate("new URLSearchParams(location.hash.slice(1)).get('s')")
    for r in rs:
        rid = pg.evaluate("([t,x,z,w,d,seed,y]) => { try { return tw.spawnRoom(t, x, z, w, d, seed, undefined, y); } catch (e) { return null; } }", list(r[:7]))
        if rid:
            try: pg.wait_for_function(f"!!tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", timeout=60000)
            except Exception: pass
    seat = pg.evaluate("async () => { const s = await tw.createSeat({kind:'human',role:'player',name:'BenchViewer',color:'#67aadd'}); return s?.id || s; }")
    pg.evaluate("([s, x, z]) => tw.dispatch('token.create', {id:'tok_bench0001', name:'Scout', x, z, owner: s})", [seat, px, pz])
    pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=30000)
    mm.wait_settled(pg, timeout=900)
    pg.wait_for_timeout(1000)
    b.close()
    return token, seat

def measure_scene(p, scene, rounds=4):
    b, pg = open_page(p, 2, token=scene['token'])
    try:
        dist = 62 if scene['name'] == 'room' else 110
        pg.evaluate(mm.cam_js(scene['cx'], scene['cz'], dist))
        mm.wait_settled(pg, timeout=900)
        mm.wait_seated(pg, 120)
        pg.evaluate(mm.cam_js(scene['cx'], scene['cz'], dist))
        pg.evaluate("tw.settings.setGfx('medium')")
        pg.wait_for_function(SETTLED, timeout=30000)
        pg.wait_for_timeout(2000)
        cases = [
            ('medium_gm', "tw.setVisionViewer('gm')", "!tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_on"),
            ('medium_fog', "tw.setVisionViewer('party')", "tw.worldOf(tw.area()).fx.fogwar.stats().fogwar_on"),
        ]
        got = {k: [] for k, _, _ in cases}
        prog_counts = []
        for i in range(rounds):
            for k, js, cond in cases:
                pg.evaluate(js)
                pg.wait_for_function(cond, timeout=15000)
                pg.wait_for_timeout(900)
                mm.wait_gpu_quiet(timeout=6)
                r = pg.evaluate(GPU_JS, 120)
                got[k].append(r)
                prog_counts.append(r['programs'])
        out = {}
        for k, rs in got.items():
            g = [r['gpu'] for r in rs if r['gpu'] is not None]
            f = [r['frame'] for r in rs]
            out[k] = {
                'gpu_med': round(statistics.median(g), 3) if g else None,
                'gpu_min': round(min(g), 3) if g else None,
                'gpu_all': [round(x, 3) for x in g],
                'frame_med': round(statistics.median(f), 2),
                'programs': [r['programs'] for r in rs],
                'fogwar_on': rs[-1]['fogwar'].get('fogwar_on'),
            }
        return out
    finally:
        b.close()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tag', default='before')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bench_results.json'))
    A = ap.parse_args()
    data = mm.start_local()
    import urllib.request
    for _ in range(240):
        try: urllib.request.urlopen(f'{mm.RELAY}/health', timeout=2); break
        except Exception: time.sleep(0.5)
    try:
        with sync_playwright() as p:
            tok_r, seat_r = build_scene(p, 'TEST bench room (throwaway)', [('common', 200, 200, 6, 5, 7101, 0), ('common', 206, 200, 4, 5, 7105, 0)], 1012.5, 1012.5)
            rs_big, lots = layout.rooms(50)
            cx_b, cz_b = lots[0]['x'] + 40, lots[0]['z'] + 22
            tok_b, seat_b = build_scene(p, 'TEST bench big 50 (throwaway)', rs_big, lots[0]['x'] + 12.5, lots[0]['z'] + 12.5)
            res = {
                'tag': A.tag,
                'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                'room': measure_scene(p, {'name': 'room', 'token': tok_r, 'seat': seat_r, 'cx': 1020, 'cz': 1012}),
                'big': measure_scene(p, {'name': 'big', 'token': tok_b, 'seat': seat_b, 'cx': cx_b, 'cz': cz_b}),
            }
            print('BENCH_RESULT:', json.dumps(res, indent=2), flush=True)
            all_res = {}
            if os.path.exists(A.out):
                try: all_res = json.load(open(A.out))
                except Exception: pass
            all_res[A.tag] = res
            json.dump(all_res, open(A.out, 'w'), indent=2)
    finally:
        mm.stop()
        mm.tw_sandbox.remove_campaigns()

if __name__ == '__main__':
    main()
