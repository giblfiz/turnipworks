"""Close views of chosen spots in the same yards as yard_shots.py (diagnosis only: the verdict is the table-distance read).
    browser-venv/bin/python yard_close.py BASE OUTDIR API seed [--lone] -- name:idprefix[:yaw[:dist[:pitch]]] ...   (idprefix 'GATE' = the gate)"""
import sys, time, json, os
from playwright.sync_api import sync_playwright
base, outdir, api, seed = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3], sys.argv[4]
lone = '--lone' in sys.argv; spots = sys.argv[sys.argv.index('--') + 1:]
os.makedirs(outdir, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
    pg = b.new_page(viewport={'width': 1500, 'height': 950})
    pg.route('**/api/tw-ratings/**', lambda route: route.fulfill(response=route.fetch(url=api + route.request.url.split('/api/tw-ratings', 1)[1], method=route.request.method, headers=route.request.headers, post_data=route.request.post_data)))
    pg.goto(base + f'/index.html?nobg&seed={seed}&nofx'); pg.wait_for_selector('body[data-ready="1"]', timeout=120000)
    settle = lambda t=300000: (pg.wait_for_function('tuner.episodes() === 0', timeout=t), time.sleep(0.5))
    if not lone:
        for r in ("'common', 4, 5, 6, 4", "'kitchen', 10, 6, 4, 3", "'stable', 12, 9, 6, 4"): pg.evaluate(f"void tuner.createRoom({r})"); settle()
    pg.evaluate("void tuner.createRoom('yard', 4, 9, 8, 5)"); settle(); time.sleep(1.0); settle()
    y = pg.evaluate("tuner.rooms().find(r => r.type === 'yard')"); L = pg.evaluate(f"tuner.layoutOf('{y['id']}')")
    pg.evaluate("(() => { tuner.hideLabels && tuner.hideLabels(true); })()"); pg.keyboard.press('Escape'); time.sleep(0.3)
    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
    for sp in spots:
        name, pid, *rest = sp.split(':'); yaw = float(rest[0]) if rest else 0; dist = float(rest[1]) if len(rest) > 1 else 24; pitch = float(rest[2]) if len(rest) > 2 else 32
        if pid == 'GATE': x, z = L['yard']['gateAt']
        else:
            q = next((q for q in L['placements'] if q['id'].startswith(pid)), None)
            if not q: print('no', pid); continue
            x, z = q['x'], q['z']
        pg.evaluate("(() => { tuner.cam.focus.set(%f, 2, %f); tuner.cam.dist = %f; tuner.cam.pitch = %f; tuner.cam.yaw = %f; tuner.cam.update(); })()" % (x, z, dist, pitch, yaw)); time.sleep(2.2)
        pg.screenshot(path=f"{outdir}/{'lone' if lone else 'inn'}-{seed}-close-{name}.png", clip=stage); print('shot', name, x, z, flush=True)
    b.close()
