"""Quick look: load the bench in one mode, print page errors + state, save a screenshot.
python smoke.py URL MODE [SKU]"""
import sys, json, time
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
url, mode = sys.argv[1], sys.argv[2]
sku = sys.argv[3] if len(sys.argv) > 3 else ''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(f"{url}?mode={mode}&filter=all" + (f"&sku={sku}" if sku else ''))
    try: pg.wait_for_function('window.bench && window.bench.cur()', timeout=60000)
    except Exception as e:
        print('TIMEOUT; errors:', errs[:10]); print(pg.evaluate('document.getElementById("status").innerText + " | " + document.getElementById("name").innerText + " | busy " + !document.getElementById("busy").hidden')); pg.screenshot(path='shots/smoke-timeout.png'); sys.exit(1)
    time.sleep(3)
    print(json.dumps(pg.evaluate('({cur: bench.cur(), mode: bench.mode(), q: Object.fromEntries(Object.entries(bench.Q).map(([k,v])=>[k,v.length])), state: bench.state(), status: document.getElementById("status").innerText})'), default=str)[:2500])
    pg.screenshot(path=f"web/align/test/shots/smoke-{mode}{'-'+sku if sku else ''}.png")
    print('errors:', errs[:10])
    b.close()
