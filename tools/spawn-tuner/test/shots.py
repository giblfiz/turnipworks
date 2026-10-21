"""Scripted views for visual QA.  python shots.py URL PREFIX"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
url, prefix = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1600, 'height': 950})
    errs = []
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(url); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)")
    pg.wait_for_function('tuner.rooms().length === 1 && tuner.episodes() === 0', timeout=90000)
    pg.evaluate("tuner.cam.focus.set(35, 0, 25); tuner.cam.dist = 62; tuner.cam.pitch = 48; tuner.cam.yaw = -25; tuner.cam.update()")
    time.sleep(0.4); pg.screenshot(path=f'{prefix}-room.png')
    # walls only
    pg.evaluate("document.querySelectorAll('#walls').forEach(()=>{}); window.__hideProps = true")
    pg.evaluate("""(() => { for (const it of [...document.__items || []]) {} })()""")
    pg.evaluate("""tuner.hideLayers(['anchor','furnish','store','dress','floor-dress','light'])""")
    time.sleep(0.3); pg.screenshot(path=f'{prefix}-shell.png')
    pg.evaluate("tuner.hideLayers([])")
    pg.evaluate("tuner.cam.preset('top'); tuner.cam.dist = 55; tuner.cam.update()")
    time.sleep(0.3); pg.screenshot(path=f'{prefix}-top.png')
    print('overlaps', json.dumps(pg.evaluate('tuner.overlapReport(0.25)')))
    print(pg.evaluate('tuner.rooms()[0].summary'))
    print('\n'.join(errs[:10]))
    b.close()
