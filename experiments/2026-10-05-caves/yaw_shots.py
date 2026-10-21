#!/usr/bin/env python3
"""Four work-lit views of each piece, turned 0/90/180/270 degrees about the vertical, for the blind "which side is the
front" read (yaw_judge.sh). browser-venv/bin/python yaw_shots.py BASE OUT [ids]"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/') + '/', Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
kit = json.loads((Path(__file__).parent / 'kit.json').read_text())
ids = sys.argv[3].split(',') if len(sys.argv) > 3 else [k for k in kit if not k.startswith('_')]
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS); pg = b.new_page(viewport={'width': 900, 'height': 900})
    pg.on('pageerror', lambda e: print('pageerror', e))
    for i in ids:
        for spin in (0, 90, 180, 270):
            pg.goto(f'{base}?scene=kit&only={i}&spin={spin}&ui=0&bright=1&view=low&yaw=0&pitch=14&dist=26')
            pg.wait_for_function('window.__ready === true', timeout=120000); time.sleep(1.5)
            pg.screenshot(path=str(out / f'{i}-spin{spin}.png'))
        print(i, flush=True)
    b.close()
