#!/usr/bin/env python3
"""The cat tree on the LIVE game: the command bar finds it by four phrasings, Enter + a click places it, a table-distance shot.
    TW_GPU=1 python3 live_check.py [https://turnipworks.net/]"""
import asyncio, os, sys, time, json
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaign made here is a throwaway: deleted from the relay when the script exits
PAGE = next((a for a in sys.argv[1:] if a.startswith('http')), 'https://turnipworks.net/')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ok_all = True
def check(ok, name, detail=''):
    global ok_all; ok_all = ok_all and bool(ok); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
async def bar(pg, text):
    if not await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('/'); await pg.wait_for_timeout(150)
    await pg.evaluate("(() => { const i = document.querySelector('#bar input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()")
    await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(300)
    return await pg.evaluate("[...document.querySelectorAll('#results .res .t')].map(e => e.textContent)")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 820}); gm = await ctx.new_page(); errors = []
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(PAGE + ('&' if '?' in PAGE else '?') + 'nopost&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Fauna'); await gm.fill('#newCampaign input[name=name]', 'TEST cat tree ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        await gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
        print('client', await gm.evaluate("document.querySelector('script[src*=\"main.js\"]')?.src || ''"), ' tuner', await gm.evaluate("fetch(tw.T?.base ? tw.T.base + 'version.json' : 'https://implausible.enterprises/projects/turnip-works/tuner/version.json').then(r => r.json()).catch(e => String(e))"))
        c = await gm.evaluate("(() => { const c = tw.assets.catById.get('cat-tree'); return c ? { name: c.name, desc: c.desc, hint: c.hint, place: c.place, sku: c.sku, url: c.url } : null; })()")
        check(c, 'the live library has cat-tree', c)
        rid = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 4242)"); await gm.wait_for_function(f"!!tw.entities()['{rid}']", timeout=15000); await gm.wait_for_timeout(7000)
        for q in ('cat tree', 'cat tower', 'scratching post', 'cat furniture'):
            rows = await bar(gm, q); check('Cat tree' in rows[:3], f'"{q}" finds it in the top three rows', rows[:4])
        rows = await bar(gm, 'cat tree'); check(rows and rows[0] == 'Cat tree', '"cat tree": it is the FIRST row (Enter picks it)', rows[:3])
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(400)
        m = await gm.evaluate("tw.mode && { kind: tw.mode.kind, cat: tw.mode.cat?.id || tw.mode.item?.id || null }"); check(m and m['kind'] == 'place', 'Enter starts placing', m)
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(15, 0, 10); g.pitch = 55; g.yaw = 0; g.dist = 55; g.update(); tw.main.rule = 'free'; })()"); await gm.wait_for_timeout(500)
        pt = await gm.evaluate("tw.screenOf(27.5, 17.5, tw.main, 0)"); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(300); await gm.mouse.click(pt['x'], pt['y'])
        try: await gm.wait_for_function("Object.values(tw.entities()).some(e => e.cat === 'cat-tree')", timeout=10000)
        except Exception: pass
        e = await gm.evaluate("(() => { const e = Object.values(tw.entities()).find(e => e.cat === 'cat-tree'); return e && { id: e.id, x: e.x, z: e.z, y: e.y, dims: e.dims, sku: e.sku, place: e.place, room: e.room }; })()")
        check(e, 'a click on a square places a cat tree', e)
        if e:
            drawn = await gm.evaluate(f"(async () => {{ const w = tw.worldOf(tw.area()), r = w.recs.get('{e['id']}'); await r.ready; await new Promise(s => setTimeout(s, 4000)); return !!r.visual && !r.visual.userData?.placeholder; }})()")
            check(drawn, 'its mesh is drawn (not the stand-in box)')
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.select && tw.select()"); await gm.wait_for_timeout(600)
            await gm.screenshot(path=os.path.join(HERE, 'shots', 'room-a.png'))
            await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({e['x']}, 2, {e['z']}); g.pitch = 42; g.yaw = 35; g.dist = 26; g.update(); }})()"); await gm.wait_for_timeout(2500)
            await gm.screenshot(path=os.path.join(HERE, 'shots', 'room-b.png'))
        check(not errors, 'no page errors', errors[:3])
        await b.close()
    print('PASS' if ok_all else 'FAILED'); sys.exit(0 if ok_all else 1)
asyncio.run(main())
