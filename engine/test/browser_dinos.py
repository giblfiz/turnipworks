#!/usr/bin/env python3
"""THE DINOSAURS ON THE TABLE (Harry 2026-11-07: "let's get our top 8 favorites all done"; docs/PAWNS.md "The dinosaurs").
  TW_GPU=1 TW_PORTS=18661,18667 python3 engine/test/browser_dinos.py --local [--shots DIR]

A farm field, the nine dinosaurs placed as a GM places them (token.create with the figure and its size from the list).
  STAND   every one loads, stands on its own disc (feet on the disc), its disc 80% of its footprint: medium 4 ft, large 8,
          huge 12, gargantuan 16; drawn at its made size (the figure's height in the list, at the table's own scale, the
          same scale the set's tyrannosaur is drawn at). The tyrannosaur and triceratops are HUGE (15-ft base, 12-ft disc;
          Harry 2026-11-07, dinohuge lane); the pterodactyl STANDS in its flying pose (Harry: the standing mesh thrown
          away), on its disc, wings spread
  FLY     the pterodactyl and quetzalcoatlus raised to 20 ft wear their FLYING pose (the pack's own fly manifest, built
          by build_figures.py), the base stays on the ground with a shadow; lowered, they stand again
--shots DIR: also a still of each raised pterosaur, leaning in, for the blind read (experiments/2026-11-07-dinos)."""
import asyncio, json, math, os, random, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
sys.argv = [sys.argv[0], '--local']
sys.path.insert(0, HERE)
import types
B = types.ModuleType('figs_helpers'); B.__file__ = os.path.join(HERE, 'browser_figs.py')
_src = open(B.__file__).read(); exec(compile(_src[:_src.index('async def main')], B.__file__, 'exec'), B.__dict__)
from playwright.async_api import async_playwright

FIGS = {f['id']: f for f in json.load(open(os.path.join(REPO, 'tools/spawn-tuner/data/figures.json')))['figures']}
DINOS = ['foe-tyrannosaur', 'foe-triceratops', 'foe-velociraptor', 'foe-ankylosaurus', 'foe-stegosaurus', 'foe-spinosaurus', 'foe-brontosaurus', 'foe-pterodactyl', 'foe-quetzalcoatlus']
SIZE = {'foe-tyrannosaur': 3, 'foe-triceratops': 3, 'foe-velociraptor': 1, 'foe-ankylosaurus': 3, 'foe-stegosaurus': 3, 'foe-spinosaurus': 3, 'foe-brontosaurus': 4, 'foe-pterodactyl': 2, 'foe-quetzalcoatlus': 3}
SLOTS = [(12.5 + 25 * (k % 3), 12.5 + 25 * (k // 3)) for k in range(9)]
checks = fails = 0


def check(c, m, d=''):
    global checks, fails
    checks += 1
    if not c: fails += 1; print('FAIL', m, json.dumps(d, default=str)[:400])
    elif os.environ.get('V'): print('ok', m)


async def main():
    page = B.start_local()
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=['--no-sandbox', *B.GL])
        gm = await (await br.new_context(viewport={'width': 1400, 'height': 900})).new_page()
        errs = []; gm.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST dinosaurs {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button'); assert await B.wait(gm, 'window.tw && tw.ready && tw.ready()', 45000)
        rid = f"room_dns{random.randrange(10**6):06d}"
        await gm.evaluate(B.SPAWN, {'id': rid, 'type': 'hut-field', 'x': 0, 'z': 0, 'w': 15, 'd': 15, 'seed': 7111})
        await B.wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000); await B.settle(gm)
        await gm.evaluate(f"""tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}' && !tw.ST.isConnector(e)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))""")
        # ---- STAND
        print('STAND')
        missing = [i for i in DINOS if i not in FIGS]
        check(not missing, 'all nine dinosaurs are in the figure list', missing)
        toks = {i: f"tok_dino{k}{random.randrange(10**5):05d}" for k, i in enumerate(DINOS)}
        await gm.evaluate('ops => tw.batch(ops)', [{'type': 'token.create', 'args': {'id': toks[i], 'name': str(k + 1), 'x': x, 'z': z, 'rot': 0, 'fig': i, 'size': (FIGS.get(i) or {}).get('size', 1)}}
                                                   for k, (i, (x, z)) in enumerate(zip(DINOS, SLOTS)) if i in FIGS])
        loaded = await B.wait(gm, f"{json.dumps([toks[i] for i in DINOS if i in FIGS])}.every(t => tw.worldOf(tw.area()).figureOf(t)?.loaded)", 120000, 'dinosaurs loaded')
        check(loaded, 'every dinosaur figure loads')
        rex = await gm.evaluate(B.FIG(toks['foe-tyrannosaur'])) or {}
        for i in DINOS:
            if i not in FIGS: continue
            m = await gm.evaluate(B.FIG(toks[i])) or {}; f = FIGS[i]
            check(m.get('loaded') and abs(m.get('feet_above_disc_ft') or 0) < 0.05, f'{f["name"]} stands on its disc', m)
            check(f['size'] == SIZE[i] and abs((m.get('base_width_ft') or 0) - SIZE[i] * 5 * 0.8) < 0.05, f'{f["name"]}: {SIZE[i] * 5}-ft footprint, disc {SIZE[i] * 4} ft across', [f['size'], m.get('base_width_ft')])
            check(abs((m.get('scale') or 0) - (rex.get('scale') or -1)) < 1e-6 and abs((m.get('overall_ft') or 0) - f['oh']) < 0.01, f'{f["name"]} is drawn at its made size, at the scale the tyrannosaur is drawn at', [m.get('scale'), rex.get('scale'), m.get('overall_ft'), f['oh']])
        # the pterodactyl on the ground: its FLYING mesh (the standing one is gone), lowest point on its disc, as tall as raised
        pt = FIGS.get('foe-pterodactyl') or {}; pm = await gm.evaluate(B.FIG(toks['foe-pterodactyl'])) or {}
        check(pt.get('url', '').rsplit('-', 1)[-1] == (pt.get('fly') or {}).get('url', '').rsplit('-', 1)[-1] and pm.get('loaded') and abs(pm.get('feet_above_disc_ft') or 0) < 0.05
              and abs((pm.get('overall_ft') or 0) - (pt.get('fly') or {}).get('oh', -1)) < 0.01, 'the pterodactyl stands in its flying pose, on its disc, as tall as when it flies', [pt.get('url'), (pt.get('fly') or {}).get('url'), pm])
        # ---- FLY
        print('FLY')
        for i in ('foe-pterodactyl', 'foe-quetzalcoatlus'):
            if i not in FIGS: check(False, f'{i} is in the list'); continue
            t, (x, z) = toks[i], SLOTS[DINOS.index(i)]
            check(bool(FIGS[i].get('fly')), f'{FIGS[i]["name"]} has a flying pose in the list', FIGS[i].get('fly'))
            b0 = await gm.evaluate(f"tw.pawnBase('{t}')") or {}
            check(b0.get('pose') == 'stand' and not b0.get('flying'), f'{FIGS[i]["name"]} on the ground: standing', b0)
            await gm.evaluate(f"tw.batch([{{ type: 'token.move', args: {{ id: '{t}', x: {x}, z: {z}, y: 20 }} }}])"); await B.settle(gm)
            ok = await B.wait(gm, f"tw.pawnBase('{t}')?.pose === 'fly'", 30000, f'{i} fly pose')
            b1 = await gm.evaluate(f"tw.pawnBase('{t}')") or {}; fm = await gm.evaluate(B.FIG(t)) or {}
            check(ok and b1.get('flying') and b1.get('shadow'), f'{FIGS[i]["name"]} raised to 20 ft wears its flying pose, a shadow under it', b1)
            check(fm.get('pose') == 'fly' and fm.get('loaded') and (fm.get('drawn_tris') or 0) > 0, f'{FIGS[i]["name"]}: the flying figure is the one drawn', {k: fm.get(k) for k in ('pose', 'loaded', 'drawn_tris')})
            if SHOTS:
                os.makedirs(SHOTS, exist_ok=True); await gm.evaluate('tw.setLabels?.(false)'); await gm.keyboard.press('Escape'); await gm.evaluate('tw.clearSelection()')
                await B.view(gm, x, z, 70, 32, 0); await gm.wait_for_timeout(1500)
                c = await B.scr(gm, x, z, 20 + FIGS[i]['fly']['h'] / 2); side = 640
                await gm.screenshot(path=os.path.join(SHOTS, f'{i}-fly-lean.png'), clip={'x': max(0, c['x'] - side / 2), 'y': max(0, c['y'] - side / 2), 'width': side, 'height': side})
            await gm.evaluate(f"tw.batch([{{ type: 'token.move', args: {{ id: '{t}', x: {x}, z: {z}, y: 0 }} }}])"); await B.settle(gm)
            check(await B.wait(gm, f"tw.pawnBase('{t}')?.pose === 'stand'", 15000), f'{FIGS[i]["name"]} lowered: standing again', await gm.evaluate(f"tw.pawnBase('{t}')"))
        check(not errs, 'no page errors', errs[:3])
    print(f'dinos (browser): {checks - fails}/{checks} passed')
    sys.exit(1 if fails else 0)

asyncio.run(main())
