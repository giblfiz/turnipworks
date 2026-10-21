"""Quick smoke: load, report console errors, draw one room, screenshot.  python smoke.py URL OUT.png [type]"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
rtype = sys.argv[3] if len(sys.argv) > 3 else 'common'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1600, 'height': 950})
    errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.goto(url)
    pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.evaluate(f"void tuner.createRoom('{rtype}', 4, 3, 6, 4)")
    pg.wait_for_function('tuner.rooms().length === 1 && tuner.episodes() === 0', timeout=90000)
    time.sleep(0.5)
    pg.screenshot(path=out)
    print(json.dumps(pg.evaluate('tuner.rooms()')[0]['summary']))
    print(json.dumps(pg.evaluate('tuner.stats()')))
    print(json.dumps(pg.evaluate('tuner.walls()')))
    for e in errs[:20]: print(e)
    b.close()
