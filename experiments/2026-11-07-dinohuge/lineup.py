#!/usr/bin/env python3
"""THE NINE DINOSAURS IN A ROW (dinohuge lane, 2026-11-07): the before/after still of the tyrannosaur and triceratops
going from large (10-ft base) to huge (15-ft base). The real game, locally (this worktree's engine + tuner, a throwaway
relay on TW_PORTS): a farm field cleared, the nine placed as a GM places them (token.create with each figure's own size
from figures.json), shortest base first, side by side, all turned the same way; then the whole row from a low camera
(heights compare) and from the play camera's pitch. Writes <out>/lineup-low.png, lineup-table.png, lineup.json (each
figure's drawn height, scale and disc as the game reports them).
    TW_GPU=1 TW_PORTS=28731,28737 python3 lineup.py --out DIR"""
import asyncio, json, math, os, random, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); T = os.path.join(REPO, 'engine', 'test')
OUT = sys.argv[sys.argv.index('--out') + 1]; os.makedirs(OUT, exist_ok=True)
sys.argv = [sys.argv[0], '--local']
sys.path.insert(0, T)
import types
B = types.ModuleType('figs_helpers'); B.__file__ = os.path.join(T, 'browser_figs.py')
_src = open(B.__file__).read(); exec(compile(_src[:_src.index('async def main')], B.__file__, 'exec'), B.__dict__)
from playwright.async_api import async_playwright

FIGS = {f['id']: f for f in json.load(open(os.path.join(REPO, 'tools/spawn-tuner/data/figures.json')))['figures']}
# a fixed order (the same before and after): small to big by the NEW sizes, the two changed ones among their peers
ROW = ['foe-velociraptor', 'foe-pterodactyl', 'foe-triceratops', 'foe-ankylosaurus', 'foe-stegosaurus', 'foe-tyrannosaur', 'foe-spinosaurus', 'foe-quetzalcoatlus', 'foe-brontosaurus']
Z = 30.0


def slots():
    # side by side along x: each takes its base, or its reach when wider (the brontosaurus's neck), plus a gap
    w = [max(FIGS[i]['base'], 1.4 * FIGS[i].get('reach', 0)) for i in ROW]
    xs, x = [], 10.0
    for k, i in enumerate(ROW):
        x += w[k] / 2; xs.append(x); x += w[k] / 2 + 2
    return xs, x + 8


async def main():
    xs, length = slots(); cx = (xs[0] + xs[-1]) / 2
    page = B.start_local(); res = {'figures': {}}
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=['--no-sandbox', *B.GL])
        gm = await (await br.new_context(viewport={'width': 1800, 'height': 800})).new_page()
        errs = []; gm.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST dino lineup {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button'); assert await B.wait(gm, 'window.tw && tw.ready && tw.ready()', 45000)
        rid = f"room_dnl{random.randrange(10**6):06d}"
        await gm.evaluate(B.SPAWN, {'id': rid, 'type': 'hut-field', 'x': 0, 'z': 0, 'w': math.ceil(length / 5), 'd': 12, 'seed': 7111})
        await B.wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000); await B.settle(gm)
        await gm.evaluate(f"""tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}' && !tw.ST.isConnector(e)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))""")
        await gm.evaluate('tw.setLabels?.(false)')
        # all turned the same way: three-quarter to the low camera (it looks along -z from +z... the play camera's yaw 0)
        await B.view(gm, cx, Z, 60, 12, 0)
        cam = await gm.evaluate('({x: tw.main.camera.position.x, z: tw.main.camera.position.z})')
        rot = math.atan2(cam['x'] - cx, cam['z'] - Z) + math.radians(55)
        toks = {i: f"tok_dnl{k}{random.randrange(10**5):05d}" for k, i in enumerate(ROW)}
        await gm.evaluate('ops => tw.batch(ops)', [{'type': 'token.create', 'args': {'id': toks[i], 'name': str(k + 1), 'x': x, 'z': Z, 'rot': rot, 'fig': i, 'color': '#e0b04a', 'size': FIGS[i]['size']}}
                                                   for k, (i, x) in enumerate(zip(ROW, xs))])
        await B.wait(gm, f"{json.dumps(list(toks.values()))}.every(t => tw.worldOf(tw.area()).figureOf(t)?.loaded)", 120000, 'figures loaded'); await gm.wait_for_timeout(1000)
        await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection()'); await gm.mouse.move(5, 790); await gm.wait_for_timeout(300)
        for i in ROW:
            m = await gm.evaluate(B.FIG(toks[i])) or {}
            res['figures'][i] = {'size': FIGS[i]['size'], 'base_ft': FIGS[i]['base'], 'h_list': FIGS[i]['h'], **{k: m.get(k) for k in ('loaded', 'feet_above_disc_ft', 'height_ft', 'overall_ft', 'scale', 'base_width_ft')}}
        for name, (dist, pitch) in {'low': (length * 0.62, 9), 'table': (length * 0.78, 40)}.items():
            await B.view(gm, cx, Z, dist, pitch, 0); await gm.wait_for_timeout(1800)
            await gm.screenshot(path=os.path.join(OUT, f'lineup-{name}.png'))
        res['errors'] = errs; res['row'] = ROW; res['x'] = xs
    json.dump(res, open(os.path.join(OUT, 'lineup.json'), 'w'), indent=1, default=str)
    for i in ROW: print(i, res['figures'][i])
    print('page errors:', errs[:3])

asyncio.run(main())
