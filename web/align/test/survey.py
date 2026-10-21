"""Walk every item of one mode and report the automatic guess (water: pool found / depth / peel; open: mode, edge, rig).
python survey.py URL MODE [--shots]"""
import sys, json, time
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
url, mode = sys.argv[1], sys.argv[2]
shots = '--shots' in sys.argv
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f"{url}?mode={mode}&filter=all")
    pg.wait_for_function('window.bench && window.bench.cur()', timeout=90000)
    skus = pg.evaluate(f'bench.Q.{mode}.map(e => e.sku)')
    out = []
    for s in skus:
        pg.evaluate(f'bench.go({json.dumps(s)})')
        pg.wait_for_function(f'bench.cur() && bench.cur().sku === {json.dumps(s)} && document.getElementById("busy").hidden', timeout=60000)
        time.sleep(0.4)
        st = pg.evaluate('bench.state()')
        if mode == 'water':
            f = st['foot'] or {}
            row = {'sku': s, 'found': st['found'], 'depth_in': round(f.get('depthIn', 0), 1), 'rim': f.get('rim'), 'cells': f.get('cells'), 'peel': pg.evaluate('document.getElementById("w-fit").textContent')}
        elif mode == 'open':
            row = {'sku': s, 'mode': st['p']['mode'], 'moving': st['p']['moving'], 'edge': st['p'].get('edge'), 'angle': st['p']['openAngle'], 'rigged': st['rigged'], 'yaw': st['yaw']}
        else:
            row = {'sku': s, 'n': len(st['list']), 'source': st['source'], 'type': st['type']}
        out.append(row); print(json.dumps(row), flush=True)
        if shots: pg.screenshot(path=f"web/align/test/shots/survey-{mode}-{s}.png")
    print('errors:', errs[:10])
    json.dump(out, open(f'web/align/test/survey-{mode}.json', 'w'), indent=1)
    b.close()
