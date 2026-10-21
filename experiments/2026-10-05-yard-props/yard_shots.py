"""Yards at table distance for the blind read (2026-10-05, after the outdoors-02 meshes and the edge kits).
Builds an inn (common room + kitchen) with a stable and a yard between them, once per seed, in a headless tuner on the
box's GPU, and takes the game's high three-quarter view, a top view and the yard's layout summary. Sidebars stay as
they are; the picture is the stage only.
    python3 yard_shots.py BASE_URL OUTDIR API_ORIGIN seed [seed ...] [--lone]"""
import sys, time, json, os
from playwright.sync_api import sync_playwright
base, outdir, api = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3]
lone = '--lone' in sys.argv; seeds = [a for a in sys.argv[4:] if not a.startswith('--')]
os.makedirs(outdir, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    for seed in seeds:
        pg = b.new_page(viewport={'width': 1500, 'height': 950}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/api/tw-ratings/**', lambda route: route.fulfill(response=route.fetch(url=api + route.request.url.split('/api/tw-ratings', 1)[1], method=route.request.method, headers=route.request.headers, post_data=route.request.post_data)))
        pg.goto(base + f'/index.html?nobg&seed={seed}&nofx'); pg.wait_for_selector('body[data-ready="1"]', timeout=120000)
        settle = lambda t=300000: (pg.wait_for_function('tuner.episodes() === 0', timeout=t), time.sleep(0.5))
        if not lone:
            pg.evaluate("void tuner.createRoom('common', 4, 5, 6, 4)"); settle()
            pg.evaluate("void tuner.createRoom('kitchen', 10, 6, 4, 3)"); settle()
            pg.evaluate("void tuner.createRoom('stable', 12, 9, 6, 4)"); settle()
        pg.evaluate("void tuner.createRoom('yard', 4, 9, 8, 5)"); settle(); time.sleep(1.0); settle()
        y = pg.evaluate("tuner.rooms().find(r => r.type === 'yard')"); L = pg.evaluate(f"tuner.layoutOf('{y['id']}')")
        tag = f"{'lone' if lone else 'inn'}-{seed}"
        json.dump({'yard': L['yard'], 'summary': y.get('summary'), 'placements': [[q['id'], q['sku'], q['rule'], q['x'], q['z']] for q in L['placements'] if q['rule'] != 'path-wear'], 'errors': errs,
                   'overlaps': pg.evaluate("tuner.overlapReport(0.35)"), 'outside': [o for o in pg.evaluate("tuner.outsideReport(0.6)") if o.startswith('yard')]}, open(f'{outdir}/{tag}.json', 'w'), indent=1)
        pg.evaluate("(() => { tuner.hideLabels && tuner.hideLabels(true); })()"); pg.keyboard.press('Escape'); time.sleep(0.3)
        stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
        for name, cam in (('table', "tuner.cam.focus.set(42, 0, 55); tuner.cam.dist = 72; tuner.cam.pitch = 55; tuner.cam.yaw = 0;"), ('table-sw', "tuner.cam.focus.set(42, 0, 56); tuner.cam.dist = 66; tuner.cam.pitch = 50; tuner.cam.yaw = 40;"), ('top', "tuner.cam.focus.set(44, 0, 55); tuner.cam.dist = 80; tuner.cam.pitch = 80; tuner.cam.yaw = 0;")):
            pg.evaluate("(() => { %s tuner.cam.update(); })()" % cam); time.sleep(2.5)
            pg.screenshot(path=f'{outdir}/{tag}-{name}.png', clip=stage)
        ids = [q[0] for q in json.load(open(f'{outdir}/{tag}.json'))['placements'] if q[2] != 'yard-edge']
        print(tag, '| edge', L['yard']['edge'], L['yard'].get('edgePieces'), '| focal', (L['yard']['focal'] or {}).get('id'), '| plants', L['yard']['plants']['placed'], '|', ', '.join(ids), '| errs', len(errs), flush=True)
        pg.close()
    b.close()
