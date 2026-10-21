"""Selection lab screenshots for a blind visual read (2026-10-04): one prop in a lit common room, every selection style
in turn, then hover / selected / hidden side by side, the compare view and a multi-select. Walls stay on, so occlusion
by the room is visible. Files are numbered (shot-NN.png) so a blind reader can't learn the style from the name;
key.json maps numbers to styles.
python sel_shots.py BASE_URL OUTDIR"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip('/'), sys.argv[2]
STYLES = ['halo', 'footprint', 'ring', 'rim', 'ink', 'spotlight', 'brackets', 'lift', 'motes', 'tint']
key = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1500, 'height': 1000})
    pg.add_init_script("try { localStorage.removeItem('tuner.fx.selection.current'); } catch (e) {}")
    pg.goto(base + '/index.html?nobg&seed=4242')
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.selLab', timeout=60000)
    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); s.value = 'baked'; s.dispatchEvent(new Event('change')); })()")
    pg.evaluate("void tuner.createRoom('common', 4, 3, 7, 5)")
    pg.wait_for_function('tuner.episodes() === 0', timeout=240000); time.sleep(3)
    pg.evaluate("document.querySelector('details.major[data-key=\"selection\"]').open = true")
    tag = pg.evaluate("""(() => { const cx = 37.5, cz = 27.5; const t = tuner.tags().filter(t => !['floor','walls','openings'].includes(t.layer) && t.y < 0.3 && /table|bench|chest|cask|barrel/.test(t.id));
        t.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)); return t[0].tag; })()""")
    t = pg.evaluate(f"tuner.tags().find(t => t.tag === '{tag}')")
    pg.evaluate(f"tuner.cam.focus.set({t['x']}, 0, {t['z']}); tuner.cam.dist = 30; tuner.cam.pitch = 52; tuner.cam.update()")
    pg.evaluate("tuner.select(null)"); pg.evaluate(f"selLab.pick('{tag}')"); time.sleep(1)  # the lab only: no tuner room outline / tag label
    c = pg.evaluate(f"tuner.project3({t['x']}, 1, {t['z']})")
    clip = {'x': max(0, c['x'] - 330), 'y': max(60, c['y'] - 250), 'width': 660, 'height': 480}
    n = 0
    pg.evaluate("selLab.sel.clear()"); time.sleep(0.8); n += 1; pg.screenshot(path=f'{out}/shot-{n:02d}.png', clip=clip); key[n] = 'none (nothing selected)'
    pg.evaluate(f"selLab.pick('{tag}')")
    for s in STYLES:
        pg.click(f'#sel-styles button[data-style="{s}"]'); time.sleep(1.5)
        n += 1; pg.screenshot(path=f'{out}/shot-{n:02d}.png', clip=clip); key[n] = s
    pg.click('#sel-styles button[data-style="halo"]')
    pg.evaluate("tuner.cam.dist = 50; tuner.cam.pitch = 58; tuner.cam.update()"); time.sleep(0.6)
    pg.click('#sel-states'); time.sleep(1.5); n += 1; pg.screenshot(path=f'{out}/shot-{n:02d}.png'); key[n] = 'states: ' + json.dumps(pg.evaluate('selLab.labels()'))
    pg.click('#sel-compare'); time.sleep(1.8); n += 1; pg.screenshot(path=f'{out}/shot-{n:02d}.png'); key[n] = 'compare: ' + json.dumps(pg.evaluate('selLab.labels()'))
    pg.click('#sel-stop'); time.sleep(0.5)
    json.dump(key, open(f'{out}/key.json', 'w'), indent=1)
    b.close()
print(json.dumps(key, indent=1))
