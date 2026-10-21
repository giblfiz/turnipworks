"""Outdoors in the Spawn Tuner (Harry 2026-10-05): the Yard room type through the real page.
An inn (common room + kitchen), a stable and a yard between them: the palette has Yard; a yard builds NO walls or posts of
its own and its ground tiles are a ground material; the neighbours' doors open onto it (the stable's is wide); the yard's
props stay inside it and off the path; the inn's sign hangs on the common room's wall; a yard laid BEFORE its neighbour is
laid out again when the neighbour arrives; with "fog the unbuilt world" on, the yard clears the fog sea as a room does.
python yard_ui.py BASE_URL OUTDIR [API_ORIGIN]   (API_ORIGIN e.g. http://127.0.0.1:8096 when BASE_URL is a local static server)
YARD_GPU=1 runs on the box's GPU (ANGLE over Vulkan) instead of SwiftShader. Exit code = number of failures."""
import sys, time, json, os
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

base, outdir = sys.argv[1].rstrip('/'), sys.argv[2]
api_origin = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(outdir, exist_ok=True)
fails = 0
def check(name, ok, ev=''):
    global fails
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{ev}]' if ev else ''), flush=True); fails += 0 if ok else 1

with sync_playwright() as p:
    ARGS = ['--no-sandbox'] + (['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('YARD_GPU') else [])
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
    if api_origin:
        tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { for (const k of Object.keys(localStorage)) if (k.startsWith('tuner.fx.atmos')) localStorage.removeItem(k); for (const k of ['spawn','light','atmos','fire','water','layout','bench','keys']) localStorage.setItem('tuner.fold.' + k, 'open'); } catch (e) {}")
    fx = '' if os.environ.get('YARD_FX', '1') == '1' else '&nofx'
    pg.goto(base + f'/index.html?nobg&seed=4242{fx}')
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
    settle = lambda t=240000: (pg.wait_for_function('tuner.episodes() === 0', timeout=t), time.sleep(0.4))
    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); s.value = 'baked'; s.dispatchEvent(new Event('change')); })()")

    # Y1 the palette and the room-type select have the Yard
    pal = pg.evaluate("[...document.querySelectorAll('#palette button')].map(b => b.dataset.type)")
    check('Y1 palette has a Yard button (hotkey =) and the type select lists it', 'yard' in pal and pg.locator('#roomType option[value="yard"]').count() == 1 and '=' in pg.locator('#palette button[data-type="yard"]').inner_text(), f'{len(pal)} types')

    # Y2 a yard laid FIRST, alone: no walls, no posts, ground tiles, a focal thing; nothing hung in thin air
    pg.evaluate("void tuner.createRoom('yard', 4, 9, 8, 5)")  # x 20..60, z 45..70 ft
    settle()
    y = pg.evaluate("tuner.rooms().find(r => r.type === 'yard')")
    walls0 = pg.evaluate("tuner.wallReport().length")
    fl = pg.evaluate(f"tuner.floorReport('{y['id']}')")
    L = pg.evaluate(f"tuner.layoutOf('{y['id']}')")
    check('Y2 a lone yard builds no walls, doors or posts', walls0 == 0, f'{walls0} wall pieces')
    check('Y2b its floor is ground (grass / earth / cobble / gravel), one tile per 5-ft cell', fl['floor'] in ('floor-grass', 'floor-earth-packed', 'floor-cobble', 'floor-gravel', 'floor-earth-bare') and len(fl['tiles']) == 40, f"{fl['floor']}, {len(fl['tiles'])} tiles")
    check('Y2c lone yard: one focal thing, a gate, nothing on a wall', sum(1 for q in L['placements'] if q['rule'] == 'yard-focal') == 1 and L['yard']['gate'] and not any(q['rule'] in ('yard-sign', 'yard-light') for q in L['placements']), f"focal {L['yard']['focal']}, gate {L['yard']['gate']}")
    n_alone = len([q for q in L['placements'] if q['rule'] not in ('path-wear', 'yard-edge')])  # (the fence round a lone yard is long: count its things)

    # Y3 the inn arrives beside it: the yard is laid out again around the new wall and door (same seed)
    pg.evaluate("void tuner.createRoom('common', 4, 5, 6, 4)")   # x 20..50, z 25..45: its south wall is the yard's north edge
    settle()
    pg.evaluate("void tuner.createRoom('kitchen', 10, 6, 4, 3)")  # x 50..70, z 30..45: south wall on the yard's north edge (x 50..60)
    settle()
    pg.evaluate("void tuner.createRoom('stable', 12, 9, 6, 4)")   # x 60..90, z 45..65: west wall is the yard's east edge
    settle(); time.sleep(1.0); settle()
    rooms = pg.evaluate("tuner.rooms()")
    L = pg.evaluate(f"tuner.layoutOf('{y['id']}')")
    doors = [o for o in L['openings'] if o['kind'] == 'door' and not o.get('part')]
    types = {r['id']: r['type'] for r in rooms}
    to = sorted(types[o['to']] for o in doors)
    check('Y3 the neighbours\' doors open onto the yard (common room, kitchen, stable)', to == ['common', 'kitchen', 'stable'], f'{to}')
    sd = next((o for o in doors if types[o['to']] == 'stable'), None)
    check('Y3b the stable\'s door onto the yard is wide (10 ft or more)', sd and (sd.get('span') or 1) >= 2, f"{(sd or {}).get('span')} segments")
    check('Y3c the yard was laid out again when its neighbours arrived', len([q for q in L['placements'] if q['rule'] not in ('path-wear', 'yard-edge')]) > n_alone and L['yard']['wallFt'] >= 50 and 'inn' in L['yard']['vibe'] and 'stable yard' in L['yard']['vibe'], f"{L['yard']['vibe']}; {L['yard']['wallFt']} ft of wall; {len(L['placements'])} placements (was {n_alone})")
    signs = [q for q in L['placements'] if q['id'] == 'sign-hanging']
    check('Y3d the inn\'s sign hangs on the common room\'s wall, facing the yard', len(signs) >= 1 and all(abs(q['z'] - 45.5) < 0.6 and 20 < q['x'] < 50 and q['y'] > 5 and abs(q['rot']) < 0.01 for q in signs), json.dumps([[q['x'], q['y'], q['z']] for q in signs]))

    json.dump({'yard': L, 'rooms': [{k: r[k] for k in ('id', 'type', 'x', 'z', 'w', 'd', 'summary')} for r in rooms]}, open(f'{outdir}/yard-layout.json', 'w'), indent=1)
    # Y4 walls: every wall piece belongs to a building; none stands on the yard's open south and west edges
    wr = pg.evaluate("tuner.wallReport()")
    on_open = [w for w in wr if (abs(w['at'][1] - 70) < 0.6 and 20 <= w['at'][0] <= 60) or (abs(w['at'][0] - 20) < 0.6 and 45.5 < w['at'][1] <= 70) or (abs(w['at'][0] - 60) < 0.6 and 65.5 < w['at'][1] <= 70)]
    check('Y4 no wall, door or post stands on the yard\'s open edges', len(on_open) == 0 and len(wr) > 30, f'{len(on_open)} of {len(wr)} pieces')
    dr = pg.evaluate("tuner.doors()")
    check('Y4b door pieces: a barn-double on the stable side', any(d['room'] == 'stable' and d['type'] == 'door-barn-double' and d['span'] >= 2 for d in dr), json.dumps(dr))

    # Y5 measured in the scene: the yard's props stay inside it and none overlap
    ov = pg.evaluate("tuner.overlapReport(0.35)"); out = pg.evaluate("tuner.outsideReport(0.6)")
    yard_out = [o for o in out if 'yard' in json.dumps(o)] if isinstance(out, list) else out
    check('Y5 no props overlap in the scene', len(ov['overlaps']) == 0, f"{ov['props']} props; {ov['overlaps'][:4]}")
    check('Y5b nothing of the yard pokes outside it', len(yard_out) == 0 if isinstance(yard_out, list) else True, json.dumps(yard_out)[:300])
    check('Y5c paths: door to gate clear, the other doors join it', len(L['paths']) >= 2 and L['paths'][0]['kind'] == 'path' and all(q['ok'] for q in L['paths']), json.dumps([[q['kind'], q['len'], q['ok']] for q in L['paths']]))
    summ = next(r for r in rooms if r['id'] == y['id'])['summary']
    check('Y5d the summary names the yard: no walls, the plants placed, the ground', 'no walls' in summ and __import__('re').search(r'Plants: \d+ placed', summ) and 'Ground:' in summ and 'No walls.' in summ, summ.split('\n')[-1])

    # Y6 overlays: paths, zones and the gate marker draw
    pg.evaluate("tuner.select('%s')" % y['id'])
    c0 = pg.evaluate("tuner.overlayCount()")
    for sel in ('#ovPaths', '#ovZones'):
        if pg.locator(sel).count() and not pg.locator(sel).is_checked(): pg.check(sel)
    time.sleep(0.5)
    c1 = pg.evaluate("tuner.overlayCount()")
    check('Y6 overlays draw the yard\'s paths, zones and gate', c1 >= 8, f'{c0} -> {c1} overlay objects')
    pg.evaluate("(() => { tuner.cam.focus.set(50, 0, 50); tuner.cam.dist = 70; tuner.cam.pitch = 55; tuner.cam.yaw = 0; tuner.cam.update(); })()"); time.sleep(1.5)
    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
    pg.screenshot(path=f'{outdir}/yard-overlays.png', clip=stage)
    for sel in ('#ovPaths', '#ovZones'):
        if pg.locator(sel).count() and pg.locator(sel).is_checked(): pg.uncheck(sel)
    pg.keyboard.press('Escape'); time.sleep(0.3)

    # Y7 the pictures for the blind read (no labels, no overlays): from the yard side, and from above
    pg.evaluate("(() => { tuner.hideLabels && tuner.hideLabels(true); })()")
    for name, cam in (('yard-inn-south', "tuner.cam.focus.set(42, 0, 52); tuner.cam.dist = 58; tuner.cam.pitch = 38; tuner.cam.yaw = 0;"), ('yard-inn-sw', "tuner.cam.focus.set(42, 0, 54); tuner.cam.dist = 62; tuner.cam.pitch = 34; tuner.cam.yaw = 35;"), ('yard-inn-top', "tuner.cam.focus.set(48, 0, 50); tuner.cam.dist = 86; tuner.cam.pitch = 78; tuner.cam.yaw = 0;")):
        pg.evaluate("(() => { %s tuner.cam.update(); })()" % cam); time.sleep(2.0)
        pg.screenshot(path=f'{outdir}/{name}.png', clip=stage)

    # close-ups of the things a blind read should name (a woodpile, the sign, the trough, the well)
    Lc = pg.evaluate(f"tuner.layoutOf('{y['id']}')")
    for pid, yaw in (('woodpile', 0), ('sign-hanging', 0), ('well', 20), ('bench', 0)):
        q = next((q for q in Lc['placements'] if q['id'].startswith(pid) and q['rule'] != 'yard-focal-with'), None) or next((q for q in Lc['placements'] if q['id'].startswith(pid)), None)
        if not q: continue
        pg.evaluate("(() => { tuner.cam.focus.set(%f, 2.5, %f); tuner.cam.dist = 20; tuner.cam.pitch = 24; tuner.cam.yaw = %d; tuner.cam.update(); })()" % (q['x'], q['z'] + 2, yaw)); time.sleep(1.5)
        pg.screenshot(path=f'{outdir}/yard-close-{pid}.png', clip=stage)
    for q in [q for q in Lc['placements'] if q.get('side') in ('E', 'W') and q['rule'] == 'yard-door'][:1]:
        pg.evaluate("(() => { tuner.cam.focus.set(%f, 2.5, %f); tuner.cam.dist = 20; tuner.cam.pitch = 24; tuner.cam.yaw = %d; tuner.cam.update(); })()" % (q['x'], q['z'], -90 if q['side'] == 'E' else 90)); time.sleep(1.5)
        pg.screenshot(path=f'{outdir}/yard-close-sidewall.png', clip=stage)

    # Y8 fog: with the unbuilt world fogged, the yard's ground clears the fog sea like any room's floor
    if fx == '' and pg.evaluate('!!window.fx && !!fx.atmos'):
        pg.evaluate("document.querySelector('details.major[data-key=\"atmos\"]').open = true")
        # (the fog is simulated in a window around the view: look at the yard first; a probe outside the window is None)
        pg.evaluate("(() => { tuner.cam.focus.set(40, 0, 60); tuner.cam.dist = 80; tuner.cam.pitch = 60; tuner.cam.yaw = 0; tuner.cam.update(); })()")
        pg.check('#fx-atmos-unbuilt'); time.sleep(5)
        hv = pg.evaluate("fx.atmos.probe('heavy', [[40, 58], [30, 62], [50, 52], [40, 76], [14, 58], [40, 80], [10, 62]])")
        inside, beyond = hv[:3], [v for v in hv[3:] if v is not None]
        check('Y8 "fog the unbuilt world": none over the yard, the fog sea beyond its open edges', all(v is not None and v < 0.04 for v in inside) and len(beyond) >= 2 and min(beyond) > 0.12, json.dumps([None if v is None else round(v, 3) for v in hv]))
        ar0 = pg.evaluate("fx.stats().atmos_arrivals")
        pg.evaluate("void tuner.createRoom('yard', 6, 15, 4, 4)")  # a second yard out in the fog south of the first: x 30..50, z 75..95
        settle(); time.sleep(5)
        hk = pg.evaluate("fx.atmos.probe('heavy', [[40, 85], [35, 80], [45, 90]])")
        check('Y8b a new yard arrives in the fog: its footprint is blown clear', pg.evaluate("fx.stats().atmos_arrivals") > ar0 and all(v is not None and v < 0.05 for v in hk), f'heavy over the new yard {[None if v is None else round(v, 3) for v in hk]}')
        pg.evaluate("(() => { tuner.cam.focus.set(52, 0, 58); tuner.cam.dist = 96; tuner.cam.pitch = 50; tuner.cam.yaw = 0; tuner.cam.update(); })()"); time.sleep(2)
        pg.screenshot(path=f'{outdir}/yard-fog.png', clip=stage)
        pg.uncheck('#fx-atmos-unbuilt')
    else:
        print('SKIP Y8 fog (FX off)')

    # Y9 roll again keeps the rules; delete the inn: the yard forgets its wall things
    pg.evaluate(f"void tuner.rollRoom('{y['id']}')"); settle()
    L2 = pg.evaluate(f"tuner.layoutOf('{y['id']}')")
    check('Y9 roll again: a new layout, still one focal thing, paths clear', L2['room']['seed'] != L['room']['seed'] and sum(1 for q in L2['placements'] if q['rule'] == 'yard-focal') == 1 and all(q['ok'] for q in L2['paths']))
    cid = next(r['id'] for r in rooms if r['type'] == 'common')
    pg.evaluate(f"tuner.deleteRoom('{cid}')"); time.sleep(1.5); settle(); time.sleep(1.5); settle()
    L3 = pg.evaluate(f"tuner.layoutOf('{y['id']}')")
    check('Y9b the inn is deleted: the yard is laid out again with no inn sign left hanging', not any(q['id'] == 'sign-hanging' for q in L3['placements']) and 'inn' not in L3['yard']['vibe'], L3['yard']['vibe'])
    check('Y10 no page errors', not errs, '; '.join(errs[:3]))
    b.close()
print(f'yard_ui: {fails} failures')
sys.exit(fails)
