"""Atmosphere in the GAME (2026-10-05), against a deployed game: two tabs (GM + a player from the invite link).
G1 the fog renders with the game's rooms (walls and indoors from the shell, fog height from the room's type)
G2 a pawn walking through the fog stirs it      G3 the local cursor stirs it
G4 ANOTHER SEAT'S cursor stirs this client's fog: the sim is local and never synced; presence feeds it
G6 idle, the outdoor fog keeps its wind: the game steps the fx stack in real time (milliseconds, as the tuner does)
python atmos_game.py [PAGE_URL]   (default: the live game). Runs on the box's GPU. Exit code = failures."""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from playwright.sync_api import sync_playwright
PAGE = sys.argv[1] if len(sys.argv) > 1 else 'https://implausible.enterprises/projects/turnip-works/engine/client/'
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
fails = 0
def check(n, ok, ev=''):
    global fails; print(('PASS ' if ok else 'FAIL ') + n + (f'  [{ev}]' if ev else '')); fails += 0 if ok else 1
W = "tw.worldOf(tw.area())"
def speeds(pg, pts): return pg.evaluate(f"{W}.fx.atmos.probe('velocity', {json.dumps(pts)})")
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    def tab(url):
        pg = b.new_context(viewport={'width': 1300, 'height': 850}).new_page(); pg.errs = []
        pg.on('pageerror', lambda e: pg.errs.append(str(e))); pg.goto(url); return pg
    gm = tab(PAGE + '?atmos=morning-mist&nointro')
    gm.fill('#newCampaign input[name=gm]', 'Fauna atmos test'); gm.fill('#newCampaign input[name=name]', 'TEST atmos game ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); gm.click('#newCampaign button')
    gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
    gm.evaluate("tw.spawnRoom('common', 4, 3, 7, 5, 4242)"); time.sleep(12)
    st = gm.evaluate(f"{W}.fx.stats()")
    rooms = gm.evaluate(f"{W}.fx.atmos.rooms().map(r => [r.type, r.resolved])")
    m = gm.evaluate(f"(() => {{ const a = {W}.fx.atmos, m = a.mask(); const at = (x, z) => {{ const [i, j] = a.cellOf(x, z); const o = (j * m.w + i) * 4; return [m.data[o], m.data[o + 1]]; }}; return {{ wall: at(37.5, 15), inside: at(37.5, 27.5) }}; }})()")
    dens = gm.evaluate(f"{W}.fx.atmos.probe('density', [[37.5, 27.5], [37.5, 50]])")
    check('G1 the fog renders with the game\'s rooms (shell walls, indoors, fog height by room type)', st.get('atmos_volume') and rooms == [['common', 0]] and m['wall'][0] > 128 and m['inside'][1] > 128 and dens[0] < 0.05 and dens[1] > 0.1,
          f"rooms {rooms}; mask wall {m['wall']} inside {m['inside']}; density inside {dens[0]:.3f} / outside {dens[1]:.2f}; grid {st.get('atmos_grid')}")
    gm.mouse.move(5, 5)
    gm.evaluate("tw.dispatch('token.create', { id: 'tok_fogwalk', name: 'Walker', x: 24, z: 48 })"); time.sleep(2)
    pts = [[26 + i * 2, 48] for i in range(10)]; v0 = speeds(gm, pts)
    for i in range(1, 12): gm.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_fogwalk', x: {24 + i * 2}, z: 48 }})"); time.sleep(0.12)
    time.sleep(0.3); v1 = speeds(gm, pts)
    check('G2 a pawn walking through the fog stirs it', sum(1 for a, c in zip(v0, v1) if c - a > 0.4) >= 4, f'max {max(v1):.1f} ft/s along its path')
    pts2 = [[8, 20 + i * 1.5] for i in range(8)]
    for x, z in pts2: s = gm.evaluate(f"tw.screenOf({x}, {z})"); gm.mouse.move(s['x'], s['y']); time.sleep(0.05)
    time.sleep(0.2); v2 = speeds(gm, pts2); gm.mouse.move(5, 5)
    check('G3 the local cursor stirs it', sum(1 for v in v2 if v > 0.5) >= 3, f'max {max(v2):.1f} ft/s')
    # a second seat: its cursor must disturb the GM's (local, unsynced) fog
    if gm.evaluate("document.querySelector('#bar').classList.contains('open')"): gm.keyboard.press('Escape')
    gm.keyboard.press('/'); gm.keyboard.type('invite Brakka', delay=8); time.sleep(0.3); gm.keyboard.press('Enter')
    gm.wait_for_function("!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('#s=')", timeout=15000)
    invite = [w for w in gm.evaluate("document.querySelector('#output textarea').value").split() if '#s=' in w][0]; gm.keyboard.press('Escape')
    link = invite.replace('?', '?atmos=morning-mist&nointro&', 1) if '?' in invite else invite.replace('#', '?atmos=morning-mist&nointro#', 1)
    pl = tab(link); pl.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000); time.sleep(6)
    gm.mouse.move(5, 5); time.sleep(4)  # let the GM's fog settle; its own cursor is parked off the map
    path = [[70 + 6 * ((i % 2) * 2 - 1), 44 + i * 1.2] for i in range(14)]
    c0 = gm.evaluate(f"{W}.fx.stats().atmos_cursor_stirs"); g0 = speeds(gm, path)
    for rep in range(3):
        for x, z in path: s = pl.evaluate(f"tw.screenOf({x}, {z})"); pl.mouse.move(s['x'], s['y']); time.sleep(0.06)
    time.sleep(0.4)
    g1 = speeds(gm, path); c1 = gm.evaluate(f"{W}.fx.stats().atmos_cursor_stirs"); seen = gm.evaluate(f"{W}.layers.cursors.children.length")
    check('G4 another seat\'s cursor stirs THIS client\'s fog (local sim, shared stirring)', c1 > c0 and max(g1) > max(max(g0) + 0.5, 1.0),
          f'presence splats {c0} -> {c1}; GM velocity along the player\'s path {max(g0):.2f} -> {max(g1):.2f} ft/s')
    # G6 (Harry 2026-10-05: "it looks like fog is non-moving static"): the game handed the fx stack its frame time in
    # seconds where it counts in milliseconds, so the fog ran 1000x slow: the wind died away once a room stood (0.5 ->
    # 0.2 ft/s in 35 s, no force restoring it) and the fog bank's pattern never drifted. Idle, cursors parked:
    gm.mouse.move(5, 5); pl.mouse.move(5, 5); time.sleep(20)
    far = [[-20, -20], [0, -20], [100, -15], [-20, 80], [100, 80]]
    wv = [v for v in speeds(gm, far) if v is not None]; drift = gm.evaluate(f"{W}.fx.params('atmos').outdoor.drift")
    check('G6 idle outdoor fog keeps the wind (the sim runs in real time)', len(wv) >= 3 and min(wv) > 0.8 * drift, f"wind {drift} ft/s; open ground far from the room {[round(v, 2) for v in wv]} ft/s")
    errs = [e for e in gm.errs + pl.errs]
    check('G5 no page errors in either tab', not errs, '; '.join(errs[:3]))
    b.close()
print(fails, 'failure(s)'); sys.exit(fails)
