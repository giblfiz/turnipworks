"""Object move/turn edits: drag, nudge, turn, record, persist across reload, survive Roll, ride along in Send map.
python edit_test.py URL [--writeback]"""
import sys, time, json
# panels start folded; the tests drive every control, so open them all
OPEN_PANELS = "for (const k of ['spawn','light','atmos','fire','water','layout','bench','keys']) localStorage.setItem('tuner.fold.' + k, 'open')"
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; WB = '--writeback' in sys.argv
res = []
def check(n, c, ev=''): c = bool(c); res.append(c); print(('PASS ' if c else 'FAIL ') + n + (f'  [{ev}]' if ev else ''), flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(viewport={'width': 1500, 'height': 900}); pg.add_init_script(OPEN_PANELS)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]'); pg.select_option('#lodFaces', 'baked'); time.sleep(0.3)
    pg.evaluate("localStorage.removeItem('tuner.objEdits')")
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); pg.wait_for_function('tuner.episodes() === 0', timeout=120000)
    pg.evaluate("tuner.cam.preset('top', {x: 35, z: 25}); tuner.cam.dist = 60; tuner.cam.update()"); time.sleep(0.4)
    t = pg.evaluate("(() => { const L = tuner.layoutOf(tuner.rooms()[0].id); const p = L.placements.find(p => p.rule === 'cluster' || p.id.startsWith('table')); return p && {tag: p.tag, x: p.x, z: p.z, y: p.dims[1]}; })()")
    kids0 = pg.evaluate(f"tuner.layoutOf(tuner.rooms()[0].id).placements.filter(q => q.parent && q.parent === tuner.layoutOf(tuner.rooms()[0].id).placements.find(p => p.tag === '{t['tag']}').uid).map(q => [q.x, q.z])")
    pg.evaluate(f"tuner.selectTag('{t['tag']}')"); time.sleep(0.2)
    a = pg.evaluate(f"tuner.project3({t['x']}, {t['y'] * 0.9}, {t['z']})"); b2 = pg.evaluate(f"tuner.project3({t['x'] + 3}, {t['y'] * 0.9}, {t['z'] + 2})")
    pg.mouse.move(a['x'], a['y']); pg.mouse.down()
    for i in range(1, 13): pg.mouse.move(a['x'] + (b2['x'] - a['x']) * i / 12, a['y'] + (b2['y'] - a['y']) * i / 12)
    pg.mouse.up(); time.sleep(0.4)
    e = [x for x in pg.evaluate('tuner.objEdits()') if x['tag'] == t['tag']]
    check('E1 drag the selected object moves it and records from/to + context', e and e[0].get('to') and e[0]['moved_ft'] > 2 and 'context_to' in e[0] and e[0]['context_to'].get('nearest_wall'), json.dumps(e[0] if e else None)[:300])
    kids1 = pg.evaluate(f"tuner.layoutOf(tuner.rooms()[0].id).placements.filter(q => q.parent && q.parent === tuner.layoutOf(tuner.rooms()[0].id).placements.find(p => p.tag === '{t['tag']}').uid).map(q => [q.x, q.z])")
    check('E2 things on the table ride along', len(kids0) == len(kids1) and all(abs((k1[0] - k0[0]) - (e[0]['to']['x'] - e[0]['from']['x'])) < 0.05 for k0, k1 in zip(kids0, kids1)), f'{len(kids0)} items')
    pg.keyboard.press(']'); pg.keyboard.press('Shift+]'); pg.keyboard.press('ArrowUp'); time.sleep(0.5)
    e = [x for x in pg.evaluate('tuner.objEdits()') if x['tag'] == t['tag']][0]
    check('E3 [ ] turn and arrows nudge, accumulated into one edit', abs(e['turned_deg']) == 60 and e['edits'] >= 2, f"turned {e['turned_deg']}, edits {e['edits']}")
    pg.click('#roll'); pg.wait_for_function('tuner.episodes() === 0', timeout=120000); time.sleep(0.3)
    after = pg.evaluate(f"tuner.layoutOf(tuner.rooms()[0].id).placements.filter(p => p.tag === '{t['tag']}').map(p => [p.x, p.z])")
    check('E4 an edited object survives Roll again (locked)', after and abs(after[0][0] - e['to']['x']) < 0.05, f'{after}')
    pg.reload(); pg.wait_for_selector('body[data-ready="1"]')
    check('E5 edits persist across reload until sent', any(x['tag'] == t['tag'] for x in pg.evaluate('tuner.objEdits()')))
    if WB:
        pg.select_option('#lodFaces', 'baked'); pg.evaluate("void tuner.createRoom('guest', 4, 3, 3, 3)"); pg.wait_for_function('tuner.episodes() === 0', timeout=120000)
        pg.fill('#layoutNote', 'acceptance test (Fauna) - ignore'); pg.click('#sendMap'); time.sleep(2)
        check('E6 Send map carries the edits and clears them', 'edit' in pg.locator('#toast').inner_text() and not pg.evaluate('tuner.objEdits()'), pg.locator('#toast').inner_text())
    check('E0 no page errors', not errs, '; '.join(errs[:2]))
    b.close()
print(f"{sum(res)}/{len(res)} passed"); sys.exit(len(res) - sum(res))
