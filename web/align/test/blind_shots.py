"""Shots for the Gemini blind-first check: auto anchors only, no editor markers, no inset.
python blind_shots.py BENCH_URL  -> test/shots/blind-<mode>-<sku>.png"""
import sys, json, time
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
FIRE = ['candlestick--common', 'candelabra--common', 'torch-sconce--s1', 'lantern-hanging--common', 'chandelier--x', 'fireplace--dressed-stone']
WATER = ['bucket--empty', 'horse-trough-stone--empty', 'washtub--empty', 'well--open', 'rain-barrel--open', 'basin-stone--s1']
OPEN = [('trunk-travel--s1', 1.0), ('door-plank--leaf', 0.55), ('floor-trapdoor--rough-timber', 0.7), ('stable-stall-gate--s2', 0.6)]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1100, 'height': 900})
    pg.add_init_script('window.__noInset = true; try { localStorage.clear(); } catch (e) {}')
    pg.goto(URL + '?mode=fire&filter=all'); pg.wait_for_function('window.bench && bench.cur()', timeout=90000)
    def go(mode, sku):
        if pg.evaluate('bench.mode()') != mode: pg.evaluate(f'bench.setMode({json.dumps(mode)})')
        q = pg.evaluate(f'bench.Q[{json.dumps(mode)}].map(e => e.sku)')
        if sku not in q: sku = next((s for s in q if s.startswith(sku.split('--')[0])), None)
        if not sku: return None
        pg.evaluate(f'bench.go({json.dumps(sku)})')
        pg.wait_for_function(f'bench.cur() && bench.cur().sku === {json.dumps(sku)} && document.getElementById("busy").hidden', timeout=60000)
        pg.evaluate('bench.helpers(false)'); time.sleep(0.8)
        return sku
    shot = lambda name: pg.locator('#gl').screenshot(path=f'shots/blind-{name}.png')
    for s in FIRE:
        s = go('fire', s)
        if not s: continue
        # close on the first flame: a quarter of the object's size away, slightly above
        info = pg.evaluate("(() => { const T = bench.ctx.THREE, it = bench.ctx.cur().it, b = new T.Box3().setFromObject(it.group), sz = b.getSize(new T.Vector3()); const w = bench.fire.worldOfU(it, bench.state().list[0]); return { w: [w.x, w.y, w.z], s: Math.max(sz.x, sz.y, sz.z), type: bench.state().type }; })()")
        big = info['type'] in ('hearth', 'oven', 'brazier', 'chandelier')
        k = 1.4 if info['type'] in ('lantern', 'torch') else 0.55
        if not big: pg.evaluate(f"bench.look({info['w']}, {max(0.6, info['s'] * k)}, [0.5, 0.35, 1])")
        time.sleep(1.2); shot(f'fire-{s}'); print('fire', s, info['type'])
    for s in WATER:
        s = go('water', s)
        if not s: continue
        pg.evaluate("(() => { const T = bench.ctx.THREE, b = new T.Box3().setFromObject(bench.ctx.cur().it.group), c = b.getCenter(new T.Vector3()), sz = b.getSize(new T.Vector3()); bench.look([c.x, c.y, c.z], Math.max(sz.x, sz.y, sz.z) * 2.2, [0.35, 0.9, 0.75]); })()")
        time.sleep(0.8); shot(f'water-{s}'); print('water', s)
    for s, t in OPEN:
        s = go('open', s)
        if not s: continue
        pg.keyboard.press('c'); time.sleep(0.2)
        pg.evaluate(f"(() => {{ const m = bench.modeObj(); }})()")
        # hold the swing at t: open fully, then (for partial) let the frame loop park it
        pg.keyboard.press('o'); time.sleep(1.6)
        if pg.evaluate('bench.state().t') < 0.5: pg.keyboard.press('o'); time.sleep(1.6)
        pg.evaluate("bench.frameItem()"); time.sleep(0.5)
        shot(f'open-{s}'); print('open', s, pg.evaluate('bench.state().p.edge'))
    b.close()
