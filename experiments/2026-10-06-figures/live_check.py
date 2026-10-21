#!/usr/bin/env python3
"""Load the LIVE page headlessly: every scene builds, the house lighting loads, no page errors or missing files, the
controls work, the write-back answers.
    browser-venv/bin/python live_check.py [BASE] [--post]     (--post sends one record marked as a TEST)"""
import json, sys, time
from playwright.sync_api import sync_playwright
base = next((a for a in sys.argv[1:] if a.startswith('http')), 'https://implausible.enterprises/projects/turnip-works/figures-pilot/').rstrip('/') + '/'
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS); pg = b.new_page(viewport={'width': 1500, 'height': 950})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    bad = []; got = []; pg.on('response', lambda r: (bad.append(f'{r.status} {r.url}') if r.status >= 400 else got.append(r.url)))
    for sc in ('room', 'fig-fighter', 'fig-wizard', 'fig-goblin', 'fig-wolf'):
        pg.goto(f'{base}?scene={sc}'); pg.wait_for_function('window.__ready === true', timeout=180000); time.sleep(1)
        print(sc, 'ok  lighting', pg.evaluate('window.__fx'), ' title:', pg.evaluate("document.querySelector('#title').textContent"), ' figs', json.dumps(pg.evaluate('window.__figs')), flush=True)
    pg.goto(base); pg.wait_for_function('window.__ready === true', timeout=180000)
    st = pg.evaluate('window.__state'); print('defaults:', {k: st[k] for k in ('scene', 'view', 'base', 'night', 'second', 'tier', 'spin')}, ' version', pg.evaluate("document.querySelector('#status').textContent"))
    for base_kind in ('dark', 'ring', 'none', 'rim'):
        pg.click(f'[data-base={base_kind}]'); time.sleep(0.4); f = pg.evaluate('window.__figs'); print(' base', base_kind, {k: v['feet_above_base_ft'] for k, v in f.items()})
    pg.click('[data-color="2"]'); pg.click('[data-view=lean]'); pg.click('[data-view=close]'); pg.click('[data-view=table]')
    pg.check('#spin'); time.sleep(1.5); r0 = pg.evaluate('window.__spinProbe()'); time.sleep(2.0); r1 = pg.evaluate('window.__spinProbe()'); print(' turntable: turned', round((r1 - r0) * 57.2958, 1), 'degrees in 2 s (6 rpm = 72)'); pg.uncheck('#spin')
    pg.uncheck('#night'); pg.check('#night'); pg.select_option('#tier', '20k1024'); pg.wait_for_function('window.__ready === true', timeout=180000); pg.select_option('#tier', 'full'); pg.wait_for_function('window.__ready === true', timeout=180000)
    pg.click('[data-scene=tiers]'); pg.wait_for_function('window.__ready === true', timeout=180000); time.sleep(1); print(' tiers side by side:', list(pg.evaluate('window.__loads').keys())[-5:]); pg.click('[data-scene=room]'); pg.wait_for_function('window.__ready === true', timeout=180000)
    pg.uncheck('#second'); pg.wait_for_function('window.__ready === true', timeout=180000); print(' first tries:', list(pg.evaluate('window.__figs').keys())); pg.check('#second'); pg.wait_for_function('window.__ready === true', timeout=180000)
    if '--post' in sys.argv:
        pg.fill('.fig[data-fig=fig-wolf] textarea', 'TEST from the build agent (live check), not a verdict'); pg.click('.fig[data-fig=fig-wolf] .bad'); time.sleep(2); print('write-back:', pg.evaluate("document.querySelector('.fig[data-fig=fig-wolf] .sent').textContent"))
    pg.screenshot(path='shots/live.png')
    print('files fetched:', len(set(got)), ' errors:', errs[:5], ' bad responses:', bad[:5])
    b.close()
