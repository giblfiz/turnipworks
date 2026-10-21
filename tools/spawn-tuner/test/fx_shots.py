"""FX harness shots + cost table (LIGHTING + FIRE, 2026-10-02).
python fx_shots.py BASE_URL OUTDIR [trivial|tuner]
Headless fps is meaningless (software GL); the honest numbers are whole-frame draw calls, triangles and shader programs,
measured by toggling one feature at a time from a baseline. Retries the page once if software GL crashes."""
import sys, time, json, os
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

base, outdir = sys.argv[1].rstrip('/'), sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else 'trivial'
os.makedirs(outdir, exist_ok=True)

def page_for(b, url, errs):
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.goto(url)
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
    pg.wait_for_function('!!window.fx', timeout=60000)
    return pg

def settle(pg, s=1.2):
    time.sleep(s)

def stats(pg):
    return pg.evaluate('fx.stats()')

def setp(pg, name, patch):
    pg.evaluate(f"""(() => {{ const p = fx.params('{name}'); const patch = {json.dumps(patch)};
      for (const [k, v] of Object.entries(patch)) {{ if (v && typeof v === 'object') Object.assign(p[k], v); else p[k] = v; }}
      fx.setParams('{name}', p); }})()""")

OFF_L = {'on': True, 'shadows': {'casters': 0, 'dance': 0}, 'bloom': {'strength': 0}, 'ao': {'strength': 0}, 'shafts': {'on': False}, 'grade': {'vignette': 0}}
OFF_F = {'particles': {'embers': 0, 'smoke': 0}, 'types': {'hearth': 0, 'oven': 0, 'brazier': 0, 'torch': 0, 'lantern': 0, 'candle': 0}, 'light': {'candleLights': 0}}

def run(b, url, tag):
    errs = []
    pg = page_for(b, url, errs)
    if mode == 'tuner':
        pg.evaluate("void tuner.createRoom('common', 4, 3, 7, 5)")
        pg.wait_for_function('tuner.rooms().length === 1 && tuner.episodes() === 0', timeout=120000)
        pg.keyboard.press('g'); settle(pg, 1.5)
    settle(pg, 2)
    rows = []
    # plain three.js render, no FX at all
    setp(pg, 'lighting', {'on': False}); setp(pg, 'fire', OFF_F); settle(pg)
    rows.append(('no FX (plain render)', stats(pg)))
    pg.screenshot(path=f'{outdir}/{tag}-0-off.png')
    setp(pg, 'lighting', OFF_L); settle(pg)
    rows.append(('post stack only (tone+grade+SMAA)', stats(pg)))
    steps = [
        ('+ hearth flame (volume)', 'fire', {'types': {'hearth': 1, 'oven': 1, 'brazier': 1, 'torch': 1}}),
        ('+ candles/lanterns (billboards)', 'fire', {'types': {'lantern': 1, 'candle': 1}, 'light': {'candleLights': 4}}),
        ('+ embers', 'fire', {'particles': {'embers': 0.5}}),
        ('+ smoke', 'fire', {'particles': {'smoke': 0.35}}),
        ('+ bloom', 'lighting', {'bloom': {'strength': 0.9}}),
        ('+ N8AO', 'lighting', {'ao': {'strength': 2.5}}),
        ('+ 1 fire shadow (static map)', 'lighting', {'shadows': {'casters': 1, 'dance': 0}}),
        ('+ shadow dance (refresh 2nd frame)', 'lighting', {'shadows': {'dance': 0.35}}),
        ('+ 2nd shadow-casting fire', 'lighting', {'shadows': {'casters': 2}}),
        ('back to 1 shadow fire', 'lighting', {'shadows': {'casters': 1}}),
        ('+ vignette', 'lighting', {'grade': {'vignette': 0.35}}),
        ('+ light shafts', 'lighting', {'shafts': {'on': True}}),
    ]
    for label, name, patch in steps:
        setp(pg, name, patch); settle(pg)
        rows.append((label, stats(pg)))
    pg.screenshot(path=f'{outdir}/{tag}-1-all.png')
    # the defaults as shipped (shafts off), for judging
    pg.evaluate("fx.setParams('lighting', {}); fx.setParams('fire', {})"); settle(pg, 2)
    pg.screenshot(path=f'{outdir}/{tag}-2-defaults.png')
    if mode == 'trivial':
        pg.evaluate("setView('close')"); settle(pg, 1); pg.screenshot(path=f'{outdir}/{tag}-3-close.png')
        time.sleep(0.25); pg.screenshot(path=f'{outdir}/{tag}-3-close-b.png')
        pg.evaluate("setView('candle')"); settle(pg, 1); pg.screenshot(path=f'{outdir}/{tag}-4-candle.png')
        pg.evaluate("setView('table')")
    rows.append(('defaults', stats(pg)))
    pg.close()
    return rows, errs

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    url = f'{base}/fx.html' + ('?mode=trivial&candles=1' if mode == 'trivial' else '?seed=7')
    try:
        rows, errs = run(b, url, mode)
    except Exception as e:  # software GL can crash: retry once
        print('retry after:', str(e)[:200])
        rows, errs = run(b, url, mode)
    prev = None
    print(f"{'step':40s} {'calls':>6s} {'Δcalls':>7s} {'tris':>9s} {'Δtris':>8s} {'max calls':>9s} {'max tris':>9s} {'shaders':>7s} passes casters")
    for label, s in rows:
        dc = s['frame_draw_calls'] - (prev['frame_draw_calls'] if prev else 0)
        dt = s['frame_triangles'] - (prev['frame_triangles'] if prev else 0)
        print(f"{label:40s} {s['frame_draw_calls']:6d} {dc:+7d} {s['frame_triangles']:9d} {dt:+8d} {s['frame_draw_calls_max']:9d} {s['frame_triangles_max']:9d} {s['programs']:7d} {s['post_passes']:6d} {s['shadow_casters']:3d}")
        prev = s
    print(json.dumps(rows[-1][1]))
    for e in errs[:30]: print(e)
    b.close()
