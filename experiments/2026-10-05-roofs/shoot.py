#!/usr/bin/env python3
"""Screenshot the roofs demo per style (table distance) for Gemini's blind read.  ./shoot.py [outdir]
Serves the repo root on a free port; chromium with the GPU flags the game tests use."""
import sys, os, time, subprocess, socket
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
os.makedirs(OUT, exist_ok=True)
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(0.8)
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        for style in ['thatch', 'tile', 'slate', 'shingle', 'flat']:
            for view in (['table', 'top'] if style == 'thatch' else ['table']):
                pg = b.new_context(viewport={'width': 1500, 'height': 900}).new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
                pg.goto(f'http://127.0.0.1:{port}/experiments/2026-10-05-roofs/index.html?style={style}&view={view}&seed=3')
                try: pg.wait_for_function('window.nFrames > 5 && (window.texLoaded || 0) >= 4', timeout=30000)
                except Exception: print('not ready:', pg.evaluate('[window.nFrames, window.texLoaded]'), errs); raise
                time.sleep(0.6)
                pg.evaluate("document.getElementById('ui').style.visibility = 'hidden'") # a DOM overlay only; the canvas is untouched
                f = os.path.join(OUT, f'{style}-{view}.png'); pg.screenshot(path=f)
                print(f, pg.evaluate('JSON.stringify(window.stats)'), 'errors:', errs)
                pg.close()
        b.close()
finally:
    srv.terminate()
