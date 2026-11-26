#!python3
"""Rooms of one culture at table distance (the farmstead's integration/tests/room_shots.py, the shooting half): each room
laid out ALONE in a headless Spawn Tuner served from THIS worktree (labels off, fx off), the game's high three-quarter
view, a second from the south-west and a top view, plus <tag>.json (placements, overlap and outside reports, page errors).
    tools/room_shots.py GROUP OUTDIR [--seeds 11,12] [--sizes default,big] [--keys a,b] [--beside key:w:d] [--port 18961]
GROUP is the rooms' `group` in data/rooms.json (Japan, China, India). The ratings API is answered with an empty list."""
import sys, time, json, os, subprocess, pathlib
E = pathlib.Path(__file__).resolve().parent.parent; TU = E.parents[1] / 'tools/spawn-tuner'
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = lambda k, d: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
GROUP, outdir = args[0], args[1]; port = int(opt('--port', '18961'))
seeds = opt('--seeds', '11,12').split(','); sizes = opt('--sizes', 'default,big').split(',')
os.makedirs(outdir, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=TU, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
base = f'http://127.0.0.1:{port}'
try:
    time.sleep(1.5)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        types = [t for t in json.loads((TU / 'data/rooms.json').read_text()) if (t.get('group') or '') == GROUP]
        only = [k for k in opt('--keys', '').split(',') if k]; types = [t for t in types if not only or t['key'] in only]
        for t in types:
            for size in sizes:
                w, d = t['cells'] if size == 'default' else [min(16, round(t['cells'][0] * 1.5)), min(16, round(t['cells'][1] * 1.5))]
                for seed in seeds:
                    pg = b.new_page(viewport={'width': 1500, 'height': 1500}); errs = []
                    pg.on('pageerror', lambda e: errs.append(str(e)))
                    pg.on('response', lambda r: errs.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and '/api/' not in r.url else None)
                    pg.route('**/api/**', lambda route: route.fulfill(status=200, content_type='application/json', body='[]'))
                    pg.goto(base + f'/index.html?nobg&seed={seed}&nofx'); pg.wait_for_selector('body[data-ready="1"]', timeout=180000)
                    settle = lambda tmo=300000: (pg.wait_for_function('tuner.episodes() === 0', timeout=tmo), time.sleep(0.5))
                    bes = opt('--beside', '') if t.get('outdoor') else ''
                    if bes: bk, bw, bd = bes.split(':'); pg.evaluate(f"void tuner.createRoom('{bk}', 4, {5 - int(bd)}, {bw}, {bd})"); settle(); time.sleep(0.5); settle()
                    pg.evaluate(f"void tuner.createRoom('{t['key']}', 4, 5, {w}, {d})"); settle(); time.sleep(1.0); settle()
                    r = pg.evaluate(f"tuner.rooms().find(r => r.type === '{t['key']}')"); L = pg.evaluate(f"tuner.layoutOf('{r['id']}')")
                    tag = f"{t['key']}-{size}-{seed}"
                    json.dump({'key': t['key'], 'cells': [w, d], 'seed': seed, 'purposeFail': L.get('purposeFail'), 'summary': r.get('summary'), 'placements': [[q['id'], q['sku'], q['rule'], q['x'], q['z']] for q in L['placements']],
                               'unplaced': L.get('unplaced'), 'errors': errs, 'overlaps': pg.evaluate("tuner.overlapReport(0.35)"), 'outside': pg.evaluate("tuner.outsideReport(0.6)")}, open(f'{outdir}/{tag}.json', 'w'), indent=1)
                    pg.evaluate("(() => { tuner.hideLabels && tuner.hideLabels(true); })()"); pg.add_style_tag(content='#hint, #hud { display: none !important; }'); pg.keyboard.press('Escape'); time.sleep(0.6)
                    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
                    cx, cz, span = (4 + w / 2) * 5, (5 + d / 2) * 5, max(w, d) * 5
                    for name, cam in (('table', f"tuner.cam.focus.set({cx}, 0, {cz + 2}); tuner.cam.dist = {span * 1.9 + 20}; tuner.cam.pitch = 55; tuner.cam.yaw = 0;"),
                                      ('table-sw', f"tuner.cam.focus.set({cx}, 0, {cz + 2}); tuner.cam.dist = {span * 1.7 + 18}; tuner.cam.pitch = 50; tuner.cam.yaw = 40;"),
                                      ('top', f"tuner.cam.focus.set({cx}, 0, {cz}); tuner.cam.dist = {span * 1.8 + 20}; tuner.cam.pitch = 89; tuner.cam.yaw = 0;")):
                        pg.evaluate("(() => { %s tuner.cam.update(); })()" % cam); time.sleep(2.5)
                        pg.screenshot(path=f'{outdir}/{tag}-{name}.png', clip=stage)
                    print(tag, '| things', len(L['placements']), '| purpose', L.get('purposeFail') or 'ok', '| errs', len(errs), errs[:2], flush=True)
                    pg.close()
        b.close()
finally:
    srv.terminate()
