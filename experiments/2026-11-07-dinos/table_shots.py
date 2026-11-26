#!/usr/bin/env python3
"""(COPY of ../2026-11-07-cyberpunk-pawns/table_shots.py, dinos lane 2026-11-07: a farm field, scenes of up to 4 dinosaurs
25-30 ft apart (the brontosaurus stands on a 20-ft base), crops scaled to each figure's size, the old tyrannosaur and
triceratops shot beside the new ones.)
The pack in the real game, locally (this worktree's engine + tuner, a throwaway relay on TW_PORTS): scenes of up to 4
figures on a farm field (anything under them cleared), each figure framed alone at TABLE distance (110 ft, 58 deg:
the game's play camera) and LEANING IN (45 ft, 38 deg), cropped round it at the game's own pixel scale; plus each whole
scene both ways for Harry. Writes shots/<id>-table.png, shots/<id>-lean.png, shots/scene-<n>-{table,lean}.png, shots/result.json
(how each stands on its base, its drawn height, its size).
    TW_GPU=1 TW_PORTS=18661,18667 python3 table_shots.py [--ids a,b] [--out shots]"""
import asyncio, json, os, random, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); T = os.path.join(REPO, 'engine', 'test')
OUT = os.path.join(HERE, sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'shots'); os.makedirs(OUT, exist_ok=True)
IDS = sys.argv[sys.argv.index('--ids') + 1].split(',') if '--ids' in sys.argv else None
FLY = '--fly' in sys.argv   # the pterosaurs ALONE, raised to 20 ft (wearing their flying pose): shots/<id>-fly-<mode>.png
sys.argv = [sys.argv[0], '--local']
sys.path.insert(0, T)
import types
B = types.ModuleType('figs_helpers'); B.__file__ = os.path.join(T, 'browser_figs.py')
_src = open(B.__file__).read(); exec(compile(_src[:_src.index('async def main')], B.__file__, 'exec'), B.__dict__)
from playwright.async_api import async_playwright

figs = json.load(open(os.path.join(REPO, 'tools/spawn-tuner/data/figures.json')))['figures']
DINOS = ['foe-tyrannosaur', 'foe-triceratops', 'foe-velociraptor', 'foe-ankylosaurus', 'foe-stegosaurus', 'foe-spinosaurus', 'foe-brontosaurus', 'foe-pterodactyl', 'foe-quetzalcoatlus']
pack = sorted([f for f in figs if f['id'] in DINOS and (IDS is None or f['id'] in IDS) and (not FLY or f.get('fly'))], key=lambda f: DINOS.index(f['id']))
LIFT = 20 if FLY else 0; TAG = '-fly' if FLY else ''
SLOTS = [(30.0, 27.5)]   # ONE figure a scene (2026-11-07: with four, a crop also held a neighbour and a blind read named the neighbour)
CROP = {'table': (110, 58, 260), 'lean': (45, 38, 560)}   # dist, pitch, crop side in px (the figure's own size on screen, with room round it)


async def main():
    page = B.start_local(); res = {'figures': {}}
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=['--no-sandbox', *B.GL])
        ctx = await br.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page()
        errs = []; gm.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST dinosaurs {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button'); assert await B.wait(gm, 'window.tw && tw.ready && tw.ready()', 45000)
        rid = f"room_dno{random.randrange(10**6):06d}"
        await gm.evaluate(B.SPAWN, {'id': rid, 'type': 'hut-field', 'x': 0, 'z': 0, 'w': 12, 'd': 11, 'seed': 7111})
        await B.wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000); await B.settle(gm)
        await gm.evaluate(f"""tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}' && !tw.ST.isConnector(e) && {json.dumps(SLOTS)}.some(([x, z]) => Math.hypot(e.x - x, e.z - z) < 22)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))""")
        await gm.evaluate('tw.setLabels?.(false)')
        for s in range(0, len(pack), len(SLOTS)):
            group = pack[s:s + len(SLOTS)]; n = s // len(SLOTS) + 1
            old = await gm.evaluate(f"{B.TOKENS}.map(t => t.id)")
            if old: await gm.evaluate("tw.batch(%s)" % json.dumps([{'type': 'token.delete', 'args': {'id': i}} for i in old])); await gm.wait_for_timeout(600)
            toks = [(f"tok_dn{n:02d}{k}{random.randrange(10**5):05d}", f, SLOTS[k]) for k, f in enumerate(group)]
            # FACING THE CAMERA, turned 30 degrees (a figure faces its own +Z at rot 0: (sin rot, cos rot)); the play camera's yaw is
            # the same in both modes, so one angle serves both (the first stills showed some figures from behind)
            await B.view(gm, SLOTS[0][0], SLOTS[0][1], 45, 38, 0)
            cam = await gm.evaluate('({x: tw.main.camera.position.x, z: tw.main.camera.position.z})')
            import math; ROT = math.atan2(cam['x'] - SLOTS[0][0], cam['z'] - SLOTS[0][1]) + math.radians(30)
            # (neutral names: the base carries the name, and a blind read must not be told)
            await gm.evaluate("tw.batch(%s)" % json.dumps([{'type': 'token.create', 'args': {'id': i, 'name': str(k + 1), 'x': x, 'z': z, **({'y': LIFT} if LIFT else {}), 'rot': ROT, 'fig': f['id'], 'color': '#e0b04a', 'size': f['size']}} for k, (i, f, (x, z)) in enumerate(toks)]))
            await B.wait(gm, f"{B.TOKENS}.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)", 90000, 'figures loaded'); await gm.wait_for_timeout(800)
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.clearSelection()"); await gm.mouse.move(5, 880); await gm.wait_for_timeout(300)
            for mode, (dist, pitch, _) in CROP.items():
                await B.view(gm, 30, 27.5, dist, pitch, 0); await gm.wait_for_timeout(1500)
                await gm.screenshot(path=os.path.join(OUT, f'scene{TAG}-{n}-{mode}.png'))
            for i, f, (x, z) in toks:
                if FLY: await B.wait(gm, f"tw.pawnBase('{i}')?.pose === 'fly'", 30000, 'fly pose')
                m = await gm.evaluate(B.FIG(i)); res['figures'][f['id'] + TAG] = {k: (m or {}).get(k) for k in ('loaded', 'feet_above_disc_ft', 'height_ft', 'overall_ft', 'scale', 'base_width_ft')}
                for mode, (dist, pitch, side) in CROP.items():
                    await B.view(gm, x, z, dist, pitch, 0)
                    if FLY:   # the camera looks at the ground: lift its focus to the flyer, or it is above the frame
                        fy = LIFT + f['fly']['h'] * 0.67 / 2
                        await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {fy}, {z}); g.update(); }})()")
                    await gm.wait_for_timeout(900)
                    c = await B.scr(gm, x, z, LIFT + f['fly']['h'] * 0.67 / 2) if FLY else await B.scr(gm, x, z, f['oh'] / 2)
                    side2 = min(880, side * max(0.8, (max(f['fly']['span'], f['fly']['h']) * 0.8 if FLY else max(f['oh'], f['base'] * 0.6)) / 6.5))
                    clip = {'x': max(0, c['x'] - side2 / 2), 'y': max(0, c['y'] - side2 / 2), 'width': side2, 'height': side2}
                    await gm.screenshot(path=os.path.join(OUT, f"{f['id']}{TAG}-{mode}.png"), clip=clip)
            print('scene', n, 'done:', [f['id'] for f in group], flush=True)
        res['errors'] = errs
    json.dump(res, open(os.path.join(OUT, f'result{TAG}.json'), 'w'), indent=1, default=str)
    bad = {k: v for k, v in res['figures'].items() if not v.get('loaded') or (not FLY and abs(v.get('feet_above_disc_ft') or 0) > 0.05)}
    print(len(res['figures']), 'figures shot;', 'not loaded or off their disc:', bad, '; page errors:', errs[:3])

asyncio.run(main())
