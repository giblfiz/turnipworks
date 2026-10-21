#!/usr/bin/env python3
"""Headless shots of the figures-pilot page (Playwright from fauna-tools/browser-venv; never gstack).
    python3 shoot.py BASE_URL OUT_DIR NAME=QUERY [NAME=QUERY ...]
e.g. room-table='scene=room&view=table'. Prints the page's own measurements (window.__figs) and any page errors."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/') + '/', Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1600, 'height': 1000})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    pg.on('response', lambda r: logs.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    for spec in sys.argv[3:]:
        name, q = spec.split('=', 1)
        pg.goto(f'{base}?{q}&ui=0')
        pg.wait_for_function('window.__ready === true', timeout=180000); time.sleep(2.5)
        pg.screenshot(path=str(out / f'{name}.png')); print(name, json.dumps(pg.evaluate('window.__figs')), flush=True)
    print('\n'.join(dict.fromkeys(logs))[:3000])
    print('house lighting loaded:', pg.evaluate('window.__fx'))
    print('renderer:', pg.evaluate("(()=>{const c=document.createElement('canvas').getContext('webgl2');const e=c.getExtension('WEBGL_debug_renderer_info');return e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'})()"))
    b.close()
