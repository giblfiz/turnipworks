#!/usr/bin/env python3
"""Load the LIVE page headlessly: every scene builds, the house lighting loads, no page errors, the write-back answers.
    browser-venv/bin/python live_check.py [BASE] [--post]     (--post sends one record marked as a test)"""
import json, sys, time
from playwright.sync_api import sync_playwright
base = next((a for a in sys.argv[1:] if a.startswith('http')), 'https://implausible.enterprises/projects/turnip-works/caves-pilot/').rstrip('/') + '/'
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS); pg = b.new_page(viewport={'width': 1500, 'height': 950})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    bad = []; pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    for sc in ('rect', 'ell', 'two', 'field', 'kit'):
        pg.goto(f'{base}?scene={sc}'); pg.wait_for_function('window.__ready === true', timeout=180000); time.sleep(1)
        print(sc, 'ok  lighting', pg.evaluate('window.__fx'), ' counts', json.dumps(pg.evaluate('window.__counts')), ' clear', json.dumps(pg.evaluate('window.__clear')), ' title:', pg.evaluate("document.querySelector('#title').textContent")[:50], flush=True)
    pg.goto(base); pg.wait_for_function('window.__ready === true', timeout=180000)
    print('default scene/view:', pg.evaluate('window.__state.scene'), pg.evaluate('window.__state.view'), ' version', pg.evaluate("document.querySelector('#status').textContent"))
    pg.fill('#s-wander', '2'); pg.dispatch_event('#s-wander', 'input'); time.sleep(3); print('slider -> wander', pg.evaluate('window.__P.wander'), pg.evaluate("document.querySelector('#r-wander').textContent"))
    if '--post' in sys.argv:
        pg.fill('#noteBox', 'TEST from the build agent (live check), not a verdict'); pg.click('#bad'); time.sleep(2); print('write-back:', pg.evaluate("document.querySelector('#sent').textContent"))
    pg.screenshot(path='shots/live.png')
    print('errors:', errs[:5], ' bad responses:', bad[:5])
    b.close()
