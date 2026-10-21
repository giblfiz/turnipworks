"""A|B wall screenshots for Gemini triage: for each family pair, generated (A, left) and kit (B, right) rooms of the
same type side by side (one cell apart), shot from outside (walls only), at table distance (with props) and close on a
corner. python kit_shots.py URL -> test/shots/kitab-<pair>-<view>.png
"""
import sys, time
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
SHOTS = os.environ.get('TW_TEST_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))
os.makedirs(SHOTS, exist_ok=True)
PAIRS = [('stone', 'dressed-stone', 'kit-stone', 'common'), ('halftimber', 'half-timber', 'kit-half-timber', 'common'), ('plank', 'rough-timber', 'kit-plank', 'stable')]
only = sys.argv[2:] or [p[0] for p in PAIRS]


def settle(pg):
    pg.wait_for_function('tuner.episodes() === 0', timeout=120000); time.sleep(0.4)


def cam(pg, x, z, yaw, pitch, dist):
    pg.evaluate(f"tuner.cam.focus.set({x}, 0, {z}); tuner.cam.yaw = {yaw}; tuner.cam.pitch = {pitch}; tuner.cam.dist = {dist}; tuner.cam.update()")
    time.sleep(0.6)


with sync_playwright() as p:
    for name, a, b, rtype in PAIRS:
        if name not in only: continue
        for attempt in range(2):  # software GL can crash: retry once in a fresh browser
            try:
                br = p.chromium.launch(args=['--no-sandbox'])
                pg = br.new_page(viewport={'width': 1600, 'height': 950})
                pg.add_init_script("for (const k of ['spawn','light','atmos','fire','water','layout','bench','keys']) localStorage.setItem('tuner.fold.' + k, 'open'); localStorage.removeItem('tuner.wallKit')")
                pg.goto(URL + '?nobg&nofx&seed=777&capture'); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
                pg.select_option('#lodFaces', 'baked')
                for fam, x in ((a, 2), (b, 9)):
                    pg.evaluate(f"tuner.createRoom('{rtype}', {x}, 2, 6, 4)"); settle(pg)
                    rid = pg.evaluate('tuner.rooms().at(-1).id')
                    pg.evaluate(f"tuner.select('{rid}')"); pg.select_option('#roomWalls', fam); settle(pg)
                pg.evaluate("tuner.select(null)")
                pg.evaluate("document.querySelectorAll('aside').forEach(a => a.style.display = 'none'); window.dispatchEvent(new Event('resize'))")
                time.sleep(0.5)
                props = pg.evaluate("[...new Set(tuner.tags().map(t => t.layer))].filter(l => !['walls', 'openings', 'floor'].includes(l))")
                pg.evaluate(f"tuner.hideLayers({props})")
                cam(pg, 40, 25, 0, 16, 62); pg.screenshot(path=f'{SHOTS}/kitab-{name}-outside.png')
                cam(pg, 40, 25, 180, 16, 62); pg.screenshot(path=f'{SHOTS}/kitab-{name}-north.png')
                cam(pg, 40, 20, 25, 42, 58); pg.evaluate("tuner.hideLayers([])"); time.sleep(0.4); pg.screenshot(path=f'{SHOTS}/kitab-{name}-table.png')
                pg.evaluate(f"tuner.hideLayers({props})")
                cam(pg, 10, 30, 35, 12, 16); pg.screenshot(path=f'{SHOTS}/kitab-{name}-cornerA.png')
                cam(pg, 45, 30, 35, 12, 16); pg.screenshot(path=f'{SHOTS}/kitab-{name}-cornerB.png')
                br.close(); print('shots', name); break
            except Exception as e:
                print('retry', name, str(e)[:200])
                try: br.close()
                except Exception: pass
