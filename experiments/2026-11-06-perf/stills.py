#!/usr/bin/env python3
"""Stills for Harry's taste call (2026-11-06): what the picture looks like WHILE MOVING at fewer pixels.
The bench's inn and town at table view, the house look, High, a 1440 x 900 window at 1x, drawn at a pixel ratio of
1 (rest: the look, unchanged), 0.75 (the default built), 0.6 and 0.5. Each still is taken with time frozen.
  TW_PERF_PORTS=17651,17652 python3 stills.py --data ~/.cache/tw-perf-bench-local --out DIR
"""
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, os.path.join(REPO, 'tools', 'perf-bench')); sys.path.insert(0, os.path.join(REPO, 'tests'))
import tw_sandbox  # noqa
from stack import Stack  # noqa
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--out', required=True); ap.add_argument('--maps', default='inn,town'); ap.add_argument('--preset', default='high')
A = ap.parse_args(); os.makedirs(A.out, exist_ok=True)
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
st = json.load(open(os.path.join(A.data, 'maps.json')))
with Stack(A.data), sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=GPU)
    for n in A.maps.split(','):
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1); pg = ctx.new_page(); tw_sandbox.proxy(pg, 'http://127.0.0.1:8096'); pg.set_default_timeout(300000)
        pg.goto(Stack.page_url() + '#s=' + st[n]['token']); pg.wait_for_function('window.tw && tw.ready && tw.ready() && tw.loaded && tw.loaded()', timeout=300000)
        pg.evaluate(f"tw.settings.setGfx('{A.preset}')")
        c = st[n]['camera']; c = {**c, 'dist': min(c['dist'], 70)}
        pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({c['x']}, 0, {c['z']}); g.pitch = {c['pitch']}; g.yaw = 0.35; g.dist = {c['dist']}; g.update(); tw.main.rule = 'free'; }})()")
        pg.wait_for_function("(() => { const w = tw.worldOf(tw.area()); let ph = 0; w.scene.traverse(o => { if (o.userData?.placeholder && o.visible !== false) ph++; }); return ph === 0 && tw.spawningNow().anims === 0 && w.settler.pending() === 0; })()", timeout=600000)
        pg.mouse.move(5, 895); pg.wait_for_timeout(3000)
        pg.evaluate('tw.frozenAt = 1e6'); pg.wait_for_timeout(500)
        for pr in (1, 0.75, 0.6, 0.5):
            pg.evaluate(f"(() => {{ const r = tw.gfx.renderer; r.setPixelRatio({pr}); const c = document.getElementById('c'); tw.worldOf(tw.area()).fx?.setSize(c.clientWidth, c.clientHeight); }})()"); pg.wait_for_timeout(700)
            pg.screenshot(path=os.path.join(A.out, f'{n}-{A.preset}-pr{pr}.png'), clip={'x': 300, 'y': 150, 'width': 840, 'height': 600})
        pg.evaluate('tw.frozenAt = null'); ctx.close()
    b.close()
print('stills in', A.out)
