#!/usr/bin/env python3
"""Water in the GAME (2026-10-04): the deployed game loads the tuner's shared water (fx/water.js through fx/index.js),
places a river and a pond with the water.set command (the one door), draws them through the post stack, ripples behind
a pawn wading across, removes one with water.remove, and leaves vessels dry until the house water says otherwise
(?water=<preset> overrides, for a look without touching the house). Page errors fail the run.
  python3 engine/test/water_game.py [https://turnipworks.net/] [OUTDIR] [--gpu]"""
import json, sys, time
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith('--')]
GAME = args[0] if args else 'http://127.0.0.1:8180/'
OUT = args[1] if len(args) > 1 else '/tmp'
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
SW = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
results = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

def open_game(b, extra=''):
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(GAME + ('&' if '?' in GAME else '?') + 'nointro' + extra)
    pg.fill('#newCampaign input[name=name]', 'TEST water game ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); pg.click('#newCampaign button')
    pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=90000)
    pg.wait_for_function('!!tw.worldOf(tw.area()).fx', timeout=30000)
    return pg, errs

W = "tw.worldOf(tw.area()).fx.water"
with sync_playwright() as p:
    b = p.chromium.launch(args=GPU if '--gpu' in sys.argv else SW)
    pg, errs = open_game(b)
    st = pg.evaluate(f"{W}.stats()")
    check(st is not None and 'water_on' in st, 'the game has the shared water (fx.water)', json.dumps(st)[:140])
    house = pg.evaluate("fetch('/api/tw-ratings/tuner/house').then(r => r.json()).catch(() => null)")
    if not (house or {}).get('water'):
        check(pg.evaluate(f"{W}.params.vessels.on") is False, 'no house water yet: vessels stay dry in the game')
    # a river and a pond through the command door, near the view
    f = pg.evaluate("(() => { const c = tw.main.camera; const v = new (c.position.constructor)(); c.getWorldDirection(v); const t = -c.position.y / v.y; return [c.position.x + v.x * t, c.position.z + v.z * t]; })()")
    river = {'kind': 'channel', 'pts': [[f[0] - 16, f[1] - 6], [f[0] - 4, f[1] + 2], [f[0] + 8, f[1] - 3], [f[0] + 18, f[1] + 4]], 'width': 7, 'depth': 2.5, 'flow': 1.8}
    pond = {'kind': 'pond', 'pts': [[f[0] - 6 + 5 * __import__('math').cos(a / 8 * 6.283), f[1] + 10 + 3.5 * __import__('math').sin(a / 8 * 6.283)] for a in range(8)], 'depth': 3, 'flow': 0.05}
    for wid, body in [('wat_testriver1', river), ('wat_testpond01', pond)]:
        pg.evaluate(f"tw.dispatch('water.set', {{ id: '{wid}', body: {json.dumps(body)} }})")
    pg.wait_for_function(f"{W}.bodies().length >= 2", timeout=15000); time.sleep(1.5)
    ents = pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'water').map(e => e.id)")
    check(set(ents) >= {'wat_testriver1', 'wat_testpond01'}, 'water.set puts water entities in the area', ents)
    st = pg.evaluate(f"{W}.stats()")
    check(st['water_bodies'] == 2 and st['water_draw_calls'] >= 2, 'the river and the pond draw', json.dumps({k: st[k] for k in ('water_bodies', 'water_draw_calls', 'water_grab')}))
    pg.screenshot(path=f'{OUT}/water-game-bodies.png')
    # a pawn wading across leaves ripples (the game's pawns are the water's movers)
    tok = pg.evaluate("Object.values(tw.entities()).find(e => e.kind === 'token')?.id || null")
    if not tok:
        tok = 'tok_waterwade1'; pg.evaluate(f"tw.dispatch('token.create', {{ id: '{tok}', name: 'Wader', x: {f[0] - 4}, z: {f[1] - 6} }})"); time.sleep(1)
    for k in range(9):
        pg.evaluate(f"tw.dispatch('token.move', {{ id: '{tok}', x: {f[0] - 4 + k * 0.05}, z: {f[1] - 4 + k * 1.0} }})"); time.sleep(0.12)
    time.sleep(0.3)
    h = pg.evaluate(f"{W}.readHeights('wat_testriver1', {json.dumps([[f[0] - 4 + dx, f[1] + 2 + dz] for dx in (-1.5, 0, 1.5) for dz in (-1.5, 0, 1.5)])})")
    check(sum(abs(v or 0) for v in h) > 1e-3, 'a pawn wading across the river leaves ripples', ' '.join(f'{(v or 0):+.4f}' for v in h))
    # undo-able removal through the same door
    pg.evaluate("tw.dispatch('water.remove', { id: 'wat_testpond01' })")
    pg.wait_for_function(f"{W}.bodies().length === 1", timeout=15000)
    check(True, 'water.remove takes the pond away')
    check(not errs, 'no page errors (game)', '; '.join(errs[:3]))
    pg.close()
    # ?water=<preset>: the look without the house (vessels fill)
    pg2, errs2 = open_game(b, '&water=clear-stream')
    check(pg2.evaluate(f"{W}.params.name") == 'clear-stream' and pg2.evaluate(f"{W}.params.vessels.on") is True, '?water=clear-stream: the preset, vessels filled')
    check(not errs2, 'no page errors (game, ?water=)', '; '.join(errs2[:3]))
    b.close()
print(f"water_game: {sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
