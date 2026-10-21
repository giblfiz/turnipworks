#!/usr/bin/env python3
"""Frame cost of the figures page at device pixel ratio 1, 2 and 3 (Playwright device_scale_factor), on this box's GPU.
    browser-venv/bin/python perf.py BASE [query] [--size=1728x1000]
Two numbers per case: the page's own bench (frames drawn back to back, each forced to finish: the real cost of a
frame) and the frame rate the page actually runs at over 4 s (capped at the screen's 60)."""
import json, sys, time
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/') + '/'; q = next((a for a in sys.argv[2:] if not a.startswith('--')), '')
w, h = map(int, next((a.split('=')[1] for a in sys.argv if a.startswith('--size=')), '1728x1000').split('x'))   # a 16-inch MacBook Pro window in CSS px
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS)
    for dsf in (1, 2, 3):
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf); pg = ctx.new_page()
        pg.goto(f'{base}?{q}'); pg.wait_for_function('window.__ready === true', timeout=180000); time.sleep(1.5)
        row = {'dpr': dsf}
        for mode in ('full', 'noshadow', 'plain'):
            r = pg.evaluate(f"window.__bench(40, '{mode}')"); row[mode] = r['ms_per_frame']; row['buffer'] = r['buffer']; row['pixel_ratio'] = r['pixel_ratio']; row['calls'] = r['calls']; row['tris'] = r['triangles']
        row['raf_fps'] = pg.evaluate("new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 4000 ? requestAnimationFrame(f) : res(+(n / 4).toFixed(1)); }; requestAnimationFrame(f); })")
        row['draws_per_s'] = pg.evaluate("window.__drawCount ? (async () => { const a = window.__drawCount(); await new Promise(r => setTimeout(r, 3000)); return +((window.__drawCount() - a) / 3).toFixed(1); })() : null")
        print(json.dumps(row), flush=True); ctx.close()
    b.close()
