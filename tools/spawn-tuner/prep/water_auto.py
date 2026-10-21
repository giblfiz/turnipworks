"""Automatic water surfaces for every water vessel (the Water FX's fallback, 2026-10-04).
Drives the Alignment Bench's own WATER auto-fit (web/align/js/mode-water.js + vessel.js: raycast height map, priority
flood, footprint fit) headlessly over its whole water queue and writes data/water_auto.json, keyed by MESH id, in the
exact record shape the bench saves (kind "water_surface"). Harry's bench records (GET /tuner/water_surfaces) win over
these at run time, one mesh at a time, the way fire overrides win over data/fire_anchors.json.
  python3 prep/water_auto.py [BENCH_URL]      (default: the deployed bench, which imports the deployed tuner's library)
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'https://implausible.enterprises/projects/turnip-works/align/'
OUT = Path(__file__).resolve().parent.parent / 'data' / 'water_auto.json'

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1200, 'height': 800})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # read-only: the bench saves a dirty entry when it moves on (and on unload); never let this script write records
    ctx.route('**/api/tw-ratings/**', lambda route: route.continue_() if route.request.method == 'GET' else route.fulfill(status=200, content_type='application/json', body='{"ok": true, "at": "dry-run"}'))
    pg.goto(f'{URL}?mode=water&filter=all')
    pg.wait_for_function('window.bench && window.bench.cur()', timeout=120000)
    entries = pg.evaluate('bench.Q.water.map(e => ({sku: e.sku, mesh: e.mesh, id: e.id}))')
    out = {}
    for e in entries:
        s = json.dumps(e['sku'])
        pg.evaluate(f'bench.go({s})')
        pg.wait_for_function(f'bench.cur() && bench.cur().sku === {s} && document.getElementById("busy").hidden && bench.state() && bench.state().foot', timeout=90000)
        time.sleep(0.2)
        # bench.modeObj().auto() would re-fit; open() already ran the auto fit unless a record exists, so re-run auto
        pg.evaluate('bench.modeObj().auto()')
        rec = pg.evaluate('(() => { const r = bench.modeObj().record(); bench.modeObj().saved(); return r; })()')
        rec.update(mesh=e['mesh'], sku=e['sku'], id=e['id'], by='water_auto.py', auto=True)
        out[e['mesh']] = rec
        print(e['sku'], 'found' if rec.get('found') else 'NO POOL', rec.get('shape'), rec.get('y'), flush=True)
    b.close()
OUT.write_text(json.dumps(dict(sorted(out.items())), separators=(',', ':')) + '\n')
print(f'wrote {len(out)} records -> {OUT}; page errors: {errs[:5]}')
