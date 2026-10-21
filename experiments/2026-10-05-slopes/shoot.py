#!/usr/bin/env python3
"""Headless shots of the slopes-pilot page (Playwright from fauna-tools/browser-venv; never gstack).
    python3 shoot.py BASE_URL OUT_DIR [scene,scene] [extra query]
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/') + '/', Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
scenes = (sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else 'hill,plateau,cliff,blobs,kit').split(',')
extra = sys.argv[4] if len(sys.argv) > 4 else ''
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1600, 'height': 1000})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    for sc in scenes:
        for view in ('table', 'low'):
            pg.goto(f'{base}?scene={sc}&view={view}&ui=0{extra}')
            pg.wait_for_function('window.__ready === true', timeout=120000)
            time.sleep(2.5)
            tag = extra.replace('&', '_').replace('=', '') if extra else ''
            f = out / f'{sc}-{view}{tag}.png'
            pg.screenshot(path=str(f)); print(f, flush=True)
    print('\n'.join(dict.fromkeys(logs))[:3000])
    print('house lighting loaded:', pg.evaluate('window.__fx'))
    print('renderer:', pg.evaluate("(()=>{const c=document.createElement('canvas').getContext('webgl2');const e=c.getExtension('WEBGL_debug_renderer_info');return e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'})()"))
    b.close()
