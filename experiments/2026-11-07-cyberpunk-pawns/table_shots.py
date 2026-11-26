#!/usr/bin/env python3
"""The pack in the real game, locally (this worktree's engine + tuner, a throwaway relay on TW_PORTS): scenes of up to 8
figures on a modern street (furniture under them cleared), each figure framed alone at TABLE distance (110 ft, 58 deg:
the game's play camera) and LEANING IN (45 ft, 38 deg), cropped round it at the game's own pixel scale; plus each whole
scene both ways for Harry. Writes shots/<id>-table.png, shots/<id>-lean.png, shots/scene-<n>-{table,lean}.png, shots/result.json
(how each stands on its base, its drawn height, its size).
    TW_GPU=1 TW_PORTS=18431,18437 python3 table_shots.py [--ids a,b] [--out shots]"""
import asyncio, json, os, random, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); T = os.path.join(REPO, 'engine', 'test')
OUT = os.path.join(HERE, sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'shots'); os.makedirs(OUT, exist_ok=True)
IDS = sys.argv[sys.argv.index('--ids') + 1].split(',') if '--ids' in sys.argv else None
sys.argv = [sys.argv[0], '--local']
sys.path.insert(0, T)
import types
B = types.ModuleType('figs_helpers'); B.__file__ = os.path.join(T, 'browser_figs.py')
_src = open(B.__file__).read(); exec(compile(_src[:_src.index('async def main')], B.__file__, 'exec'), B.__dict__)
from playwright.async_api import async_playwright

figs = json.load(open(os.path.join(REPO, 'tools/spawn-tuner/data/figures.json')))['figures']
pack = [f for f in figs if f['group'] in ('runner', 'modern', 'robot') and (IDS is None or f['id'] in IDS)]
SLOTS = [(7.5, 8.0), (17.5, 8.0), (27.5, 8.0), (37.5, 8.0), (7.5, 22.0), (17.5, 22.0), (27.5, 22.0), (37.5, 22.0)]
CROP = {'table': (110, 58, 260), 'lean': (45, 38, 560)}   # dist, pitch, crop side in px (the figure's own size on screen, with room round it)


async def main():
    page = B.start_local(); res = {'figures': {}}
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=['--no-sandbox', *B.GL])
        ctx = await br.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page()
        errs = []; gm.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST cyberpunk pawns {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button'); assert await B.wait(gm, 'window.tw && tw.ready && tw.ready()', 45000)
        rid = f"room_cyb{random.randrange(10**6):06d}"
        await gm.evaluate(B.SPAWN, {'id': rid, 'type': 'mod-street', 'x': 0, 'z': 0, 'w': 9, 'd': 6, 'seed': 7111})
        await B.wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000); await B.settle(gm)
        await gm.evaluate(f"""tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}' && !tw.ST.isConnector(e) && {json.dumps(SLOTS)}.some(([x, z]) => Math.hypot(e.x - x, e.z - z) < 7)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))""")
        await gm.evaluate('tw.setLabels?.(false)')
        for s in range(0, len(pack), len(SLOTS)):
            group = pack[s:s + len(SLOTS)]; n = s // len(SLOTS) + 1
            old = await gm.evaluate(f"{B.TOKENS}.map(t => t.id)")
            if old: await gm.evaluate("tw.batch(%s)" % json.dumps([{'type': 'token.delete', 'args': {'id': i}} for i in old])); await gm.wait_for_timeout(600)
            toks = [(f"tok_cy{n:02d}{k}{random.randrange(10**5):05d}", f, SLOTS[k]) for k, f in enumerate(group)]
            # (neutral names: the base carries the name, and a blind read must not be told)
            await gm.evaluate("tw.batch(%s)" % json.dumps([{'type': 'token.create', 'args': {'id': i, 'name': str(k + 1), 'x': x, 'z': z, 'rot': 0, 'fig': f['id'], 'color': '#e0b04a', 'size': f['size']}} for k, (i, f, (x, z)) in enumerate(toks)]))
            await B.wait(gm, f"{B.TOKENS}.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)", 90000, 'figures loaded'); await gm.wait_for_timeout(800)
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.clearSelection()"); await gm.mouse.move(5, 880); await gm.wait_for_timeout(300)
            for mode, (dist, pitch, _) in CROP.items():
                await B.view(gm, 22.5, 15, dist, pitch, 0); await gm.wait_for_timeout(1500)
                await gm.screenshot(path=os.path.join(OUT, f'scene-{n}-{mode}.png'))
            for i, f, (x, z) in toks:
                m = await gm.evaluate(B.FIG(i)); res['figures'][f['id']] = {k: (m or {}).get(k) for k in ('loaded', 'feet_above_disc_ft', 'height_ft', 'overall_ft', 'scale', 'base_width_ft')}
                for mode, (dist, pitch, side) in CROP.items():
                    await B.view(gm, x, z, dist, pitch, 0); await gm.wait_for_timeout(900)
                    c = await B.scr(gm, x, z, (f['h'] * 0.67) / 2)
                    side2 = side * (1.6 if f['size'] > 1 else 1)
                    clip = {'x': max(0, c['x'] - side2 / 2), 'y': max(0, c['y'] - side2 / 2), 'width': side2, 'height': side2}
                    await gm.screenshot(path=os.path.join(OUT, f"{f['id']}-{mode}.png"), clip=clip)
            print('scene', n, 'done:', [f['id'] for f in group], flush=True)
        res['errors'] = errs
    json.dump(res, open(os.path.join(OUT, 'result.json'), 'w'), indent=1, default=str)
    bad = {k: v for k, v in res['figures'].items() if not v.get('loaded') or abs(v.get('feet_above_disc_ft') or 0) > 0.05}
    print(len(res['figures']), 'figures shot;', 'not loaded or off their disc:', bad, '; page errors:', errs[:3])

asyncio.run(main())
