#!/usr/bin/env python3
"""Headless shots of the caves-pilot page (Playwright from fauna-tools/browser-venv; never gstack).
    python3 shoot.py BASE_URL OUT_DIR [scene,scene] [extra query] [view,view]
Also prints the page's own measurements (window.__clear, __overlap, __counts) per scene.
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/') + '/', Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
scenes = (sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else 'rect,ell,two,field').split(',')
extra = sys.argv[4] if len(sys.argv) > 4 else ''
views = (sys.argv[5] if len(sys.argv) > 5 else 'table,lean,low').split(',')
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS)
    pg = b.new_page(viewport={'width': 1600, 'height': 1000})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    for sc in scenes:
        for view in views:
            pg.goto(f'{base}?scene={sc}&view={view}&ui=0{extra}')
            pg.wait_for_function('window.__ready === true', timeout=180000)
            time.sleep(3)
            tag = extra.replace('&', '_').replace('=', '') if extra else ''
            f = out / f'{sc}-{view}{tag}.png'
            pg.screenshot(path=str(f)); print(f, flush=True)
        print(sc, json.dumps({'counts': pg.evaluate('window.__counts'), 'clear': pg.evaluate('window.__clear'), 'overlap': pg.evaluate('window.__overlap')}), flush=True)
    print('\n'.join(dict.fromkeys(logs))[:3000])
    print('house lighting loaded:', pg.evaluate('window.__fx'))
    print('renderer:', pg.evaluate("(()=>{const c=document.createElement('canvas').getContext('webgl2');const e=c.getExtension('WEBGL_debug_renderer_info');return e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'})()"))
    b.close()
