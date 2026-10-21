#!/usr/bin/env python3
"""Frame cost and load time per detail tier with 1, 6 and 30 copies of one figure on screen (the page's crowd scene and
its bench: frames drawn back to back, each forced to finish). 1728x1000 window, pixel ratio 1, base = coloured rim.
    browser-venv/bin/python tier_bench.py BASE [fig-id] -> tier/bench.json"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/') + '/'; fig = sys.argv[2] if len(sys.argv) > 2 else 'fig-fighter'
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS)
    for tier in ('full', '20kbake', '20k1024', '5k512', '5k256'):
        for n in (1, 6, 30):
            ctx = b.new_context(viewport={'width': 1728, 'height': 1000}); pg = ctx.new_page()   # a fresh context: nothing cached, so the load time is honest
            pg.goto(f'{base}?scene=crowd&n={n}&fig={fig}&tier={tier}&ui=0'); pg.wait_for_function('window.__ready === true', timeout=180000); time.sleep(1)
            r = [pg.evaluate("window.__bench(40, 'full')") for _ in range(3)]; pl = [pg.evaluate("window.__bench(40, 'plain')") for _ in range(3)]
            loads = pg.evaluate('window.__loads'); f = next(k for k in loads if k.startswith(fig))
            row = {'full_ms': min(x['ms_per_frame'] for x in r), 'plain_ms': min(x['ms_per_frame'] for x in pl), 'tris': r[0]['triangles'], 'calls': r[0]['calls'], 'load_ms': loads[f], 'textures': r[0]['textures']}
            out[f'{tier}|{n}'] = row; print(tier, n, json.dumps(row), flush=True); ctx.close()
    b.close()
(Path(__file__).parent / 'tier/bench.json').write_text(json.dumps(out, indent=1) + '\n')
