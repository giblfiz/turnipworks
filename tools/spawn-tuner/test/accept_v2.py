"""Layout engine v2 acceptance checks (browser, real UI).  python accept_v2.py URL
Each stage runs in a fresh browser (headless software GL is fragile across long sessions); use ?nobg in URL."""
import json
import sys
import time

import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
SHOTS = os.environ.get('TW_TEST_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))
os.makedirs(SHOTS, exist_ok=True)
results, errors = [], []


def check(name, cond, evidence=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{evidence}]' if evidence else ''), flush=True)


def settle(pg, timeout=120000):
    pg.wait_for_function('tuner.episodes() === 0', timeout=timeout)
    time.sleep(0.3)


def stage(p):
    br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    pg.goto(URL)
    pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    # Layout controls are intentionally folded until the user opens their panel.
    for key in ('layout', 'bench'):
        panel = pg.locator(f'details.major[data-key="{key}"]')
        if not panel.evaluate('e => e.open'): panel.locator('summary').click()
    return br, pg


with sync_playwright() as p:
    # V1 default engine is v2: a common room is a HUB with zones and a clear loop
    br, pg = stage(p)
    eng = pg.eval_on_selector('#engine', 'e => e.value')
    pg.evaluate("void tuner.createRoom('common', 4, 3, 8, 5)"); settle(pg)
    L = pg.evaluate("(() => { const L = tuner.layoutOf(tuner.rooms()[0].id); return { engine: L.engine, role: L.role, zones: L.zones.length, paths: L.paths.map(p => p.ok), fail: L.purposeFail, summary: L.summary.split('\\n').slice(0, 2).join(' / ') }; })()")
    check('V1 engine selector defaults to v2; common room is a HUB with zones and a clear loop', eng == 'v2' and L['engine'] == 'v2' and L['role'] == 'hub' and L['zones'] >= 2 and L['paths'] and all(L['paths']), json.dumps(L))
    # V4 overlays: paths / zones / sight lines draw something; toggling off removes it
    pg.check('#ovPaths'); pg.check('#ovZones'); pg.check('#ovSight'); time.sleep(0.4)
    n_on = pg.evaluate('tuner.overlayCount()')
    pg.screenshot(path=f'{SHOTS}/v2-overlays.png')
    pg.uncheck('#ovPaths'); pg.uncheck('#ovZones'); pg.uncheck('#ovSight'); time.sleep(0.3)
    n_off = pg.evaluate('tuner.overlayCount()')
    check('V4 overlays draw paths, zones and sight lines; toggle off clears them', n_on > 3 and n_off == 0, f'{n_on} -> {n_off}')
    # V5 doorway camera
    pg.evaluate("tuner.select(tuner.rooms()[0].id)"); pg.click('#doorView'); time.sleep(0.3)
    pitch = pg.evaluate('tuner.cam.pitch'); camy = pg.evaluate('tuner.cam.camera.position.y')
    check('V5 doorway view: camera at eye height in the door, looking in', pitch < 30 and 3 < camy < 9, f'pitch {pitch:.1f}, eye {camy:.1f} ft')
    pg.screenshot(path=f'{SHOTS}/v2-doorview.png')
    # V3 switch engine to v1 and back: rooms re-planned with the same seeds
    seed0 = pg.evaluate('tuner.rooms()[0].seed')
    pg.select_option('#engine', 'v1'); time.sleep(0.5); settle(pg)
    e1 = pg.evaluate("tuner.layoutOf(tuner.rooms()[0].id).engine || 'v1'")
    pg.select_option('#engine', 'v2'); time.sleep(0.5); settle(pg)
    e2 = pg.evaluate("tuner.layoutOf(tuner.rooms()[0].id).engine")
    check('V3 engine switch re-plans every room with the same seed (v2 -> v1 -> v2)', e1 == 'v1' and e2 == 'v2' and pg.evaluate('tuner.rooms()[0].seed') == seed0, f'{e1} -> {e2}')
    br.close()

    # V2 a 5x5 privy gets its seat; V6 an impossible room fails loudly (red outline + summary first line)
    br, pg = stage(p)
    pg.evaluate("void tuner.createRoom('privy', 4, 3, 1, 1)"); settle(pg)
    P = pg.evaluate("(() => { const L = tuner.layoutOf(tuner.rooms()[0].id); return { fail: L.purposeFail, seat: L.placements.some(p => /privy-seat/.test(p.id)) }; })()")
    check('V2 a 5x5 ft privy gets its seat', P['seat'] and not P['fail'], json.dumps(P))
    pg.evaluate("void tuner.createRoom('guest', 8, 3, 1, 1)"); settle(pg)
    G = pg.evaluate("(() => { const r = tuner.rooms().at(-1); const L = tuner.layoutOf(r.id); return { fail: L.purposeFail, first: L.summary.split('\\n')[0], red: tuner.failOutlines() }; })()")
    check('V6 impossible key purpose fails loudly: summary first line + red outline', bool(G['fail']) and G['first'].startswith('⚠ PURPOSE FAIL') and G['red'] >= 1, json.dumps(G))
    br.close()

    # V7 density not counts: a 60x40 common room is not sparser than 85% of a 30x20
    br, pg = stage(p)
    pg.evaluate("void tuner.createRoom('common', 2, 2, 6, 4)"); settle(pg)
    pg.evaluate("void tuner.createRoom('common', 2, 10, 12, 8)"); settle(pg)
    D = pg.evaluate("tuner.rooms().map(r => { const L = tuner.layoutOf(r.id); return { d: L.checks.density.value, z: L.zones.length }; })")
    check('V7 density holds in a 60x40 common room; zones grow with area', D[1]['d'] >= 0.85 * D[0]['d'] and D[1]['z'] > D[0]['z'], json.dumps(D))
    pg.evaluate("tuner.cam.preset('home', {x: 40, z: 60}); tuner.cam.dist = 120; tuner.cam.update()"); pg.check('#ovZones'); pg.check('#ovPaths'); time.sleep(0.5)
    pg.screenshot(path=f'{SHOTS}/v2-big-common.png')
    br.close()

    check('V0 no page errors', not errors, '; '.join(errors[:3]))

fails = sum(1 for _, ok in results if not ok)
print(f'\n{len(results) - fails}/{len(results)} passed')
sys.exit(fails)
