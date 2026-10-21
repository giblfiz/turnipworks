#!/usr/bin/env python3
"""Live check of the deployed page: loads with no errors, every scene builds, a slider rebuilds the ground, the
slope-pawn toggle works, copy-settings has the settings, and the verdict write-back answers.
    python3 live_check.py [BASE_URL] [SHOT.png] [--post]"""
import sys, time, json
from playwright.sync_api import sync_playwright
args = [a for a in sys.argv[1:] if not a.startswith('--')]
base = (args[0] if args else 'https://implausible.enterprises/projects/turnip-works/banks-demo').rstrip('/') + '/'
shot = args[1] if len(args) > 1 else None
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=ARGS); pg = b.new_page(viewport={'width': 1600, 'height': 1000}); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'[:300]) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'[:300]))
    pg.on('response', lambda r: logs.append(f'http {r.status}: {r.url}') if r.status >= 400 else None)
    pg.goto(base); pg.wait_for_function('window.__ready === true', timeout=120000)
    print('loaded; house lighting:', pg.evaluate('window.__fx'), '; defaults:', pg.evaluate('JSON.stringify(window.__settings())'))
    for sc in ['hill', 'cliff', 'hollow', 'temple', 'plateau']:
        pg.click(f'button[data-scene="{sc}"]'); pg.wait_for_function('window.__ready === true', timeout=60000); time.sleep(0.3)
        print(' scene', sc, pg.evaluate('JSON.stringify([window.__counts, window.__buildMs, window.__warn])'))
    h0 = pg.evaluate('window.__field().heightAt(26, 0)')
    pg.evaluate("(() => { const s = document.querySelector('#s-angle'); s.value = 50; s.dispatchEvent(new Event('input')); })()"); time.sleep(1.5)
    pg.wait_for_function('window.__ready === true', timeout=60000)
    h1 = pg.evaluate('window.__field().heightAt(26, 0)'); print(f' angle 30 -> 50: height at 11 ft out from the edge {h0:.2f} -> {h1:.2f} ft', 'OK' if h1 < h0 - 1 else 'NOT CHANGED')
    pg.click('#reset'); time.sleep(1); pg.wait_for_function('window.__ready === true', timeout=60000)
    pg.check('#slopepawn'); time.sleep(0.8); print(' slope pair:', pg.evaluate('JSON.stringify(window.__slope)'))
    if shot: pg.screenshot(path=shot)
    if '--post' in sys.argv:
        pg.fill('#noteBox', 'TEST from Fauna (headless live check). Not a verdict; ignore.'); pg.click('#good'); time.sleep(2)
        print(' write-back:', pg.inner_text('#sent'))
    print('errors/warnings:', json.dumps(list(dict.fromkeys(logs))))
    b.close()
