#!/usr/bin/env python3
"""The eye tyrant in the real game, locally (this worktree's engine + tuner, a throwaway relay), for the table-distance
read and the measurements: an inn common room, the eye tyrant among a human fighter, a goblin and the basilisk; how it
stands on its base (lowest point to the disc top), its drawn height; the command bar's rows for "beholder", "eye tyrant"
and "basilisk"; stills at table distance and leaning in for Gemini.
    TW_GPU=1 python3 table_shots.py [--out shots]"""
import asyncio, json, os, random, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); T = os.path.join(REPO, 'engine', 'test')
OUT = os.path.join(HERE, sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'shots'); os.makedirs(OUT, exist_ok=True)
sys.argv = [sys.argv[0], '--local']       # browser_figs reads its own flags at import
sys.path.insert(0, T)
import types                               # browser_figs runs its suite at import: take only its servers, sandbox and helpers
B = types.ModuleType('figs_helpers'); B.__file__ = os.path.join(T, 'browser_figs.py')
_src = open(B.__file__).read(); exec(compile(_src[:_src.index('async def main')], B.__file__, 'exec'), B.__dict__)
from playwright.async_api import async_playwright

PAWNS = [('tok_eyetyrant01', 'Eye tyrant', 10.0, 15.0, 'foe-eye-tyrant', 0.3), ('tok_manticore01', 'Manticore', 30.0, 15.0, 'foe-manticore', -0.3),
         ('tok_fighter0001', 'Fighter', 17.5, 22.5, 'hero-fighter-human-m', 0.6), ('tok_goblin00001', 'Goblin', 22.5, 22.5, 'foe-goblin-spear', -0.4),
         ('tok_basilisk001', 'Basilisk', 22.5, 7.5, 'foe-basilisk', -0.9)]   # (the room's label is at its middle, 20, 15: nothing stands there)

async def main():
    page = B.start_local(); res = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=['--no-sandbox', *B.GL])
        ctx = await br.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page()
        errs = []; gm.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST eye tyrant {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button'); assert await B.wait(gm, 'window.tw && tw.ready && tw.ready()', 45000)
        rid = f"room_eyet{random.randrange(10**6):06d}"
        await gm.evaluate(B.SPAWN, {'id': rid, 'type': 'common', 'x': 0, 'z': 0, 'w': 8, 'd': 6, 'seed': 6101})
        await B.wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000); await B.settle(gm)
        # clear the furniture under the four pawns only (a table through the eye tyrant would hide what is judged)
        await gm.evaluate(f"""tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}' && !tw.ST.isConnector(e) && {json.dumps([[x, z] for _, _, x, z, _, _ in PAWNS])}.some(([x, z]) => Math.hypot(e.x - x, e.z - z) < 6)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))""")
        await gm.evaluate("tw.batch(%s)" % json.dumps([{'type': 'token.create', 'args': {'id': i, 'name': n, 'x': x, 'z': z, 'rot': r, 'fig': f, 'color': '#e0b04a'}} for i, n, x, z, f, r in PAWNS]))
        await B.wait(gm, f"{B.TOKENS}.every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)", 60000, 'figures loaded'); await gm.wait_for_timeout(800)
        res['measure'] = {n: await gm.evaluate(B.FIG(i)) for i, n, *_ in PAWNS}
        res['entity'] = await gm.evaluate(B.ENT('tok_eyetyrant01'))
        for q in ('beholder', 'eye tyrant', 'basilisk', 'floating eye'):
            res.setdefault('bar', {})[q] = [r['title'] + ' | ' + r['sub'] for r in B.figs_of(await B.bar(gm, q))][:4]
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.clearSelection()"); await gm.mouse.move(5, 880); await gm.wait_for_timeout(400)
        await gm.evaluate('tw.setLabels?.(false)'); await gm.wait_for_timeout(300)   # room labels off: the shot is about the figures
        for name, (dist, pitch, yaw) in {'table': (110, 58, 0), 'table-side': (110, 58, 120), 'lean': (45, 38, 0), 'lean-back': (45, 38, 200)}.items():
            await B.view(gm, 20, 16, dist, pitch, yaw); await gm.wait_for_timeout(1500)
            await gm.screenshot(path=os.path.join(OUT, f'{name}.png'))
        res['errors'] = errs
    json.dump(res, open(os.path.join(OUT, 'result.json'), 'w'), indent=1, default=str)
    m = res['measure']['Eye tyrant'] or {}
    print(json.dumps({k: m.get(k) for k in ('loaded', 'feet_above_disc_ft', 'disc_top_ft', 'height_ft', 'overall_ft', 'stated_ft', 'scale', 'base_width_ft', 'facing_deg', 'detail')}))
    print(json.dumps(res['bar'], indent=1)); print('errors', errs[:3])

asyncio.run(main())
