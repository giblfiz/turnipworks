# BIG POOL stills (2026-10-29): 12d6 and 20d10 thrown with given faces in a furnished common room at the house look
# (the dev house dice, passed as a JSON file), settled; the camera on the pool; tags hidden for one shot (faces only).
#   python bigpool_stills.py OUTDIR house-dice.json [relay_port,site_port]
import asyncio, json, os, sys, subprocess, tempfile, time
from playwright.async_api import async_playwright
E = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'engine'); E = os.path.abspath(E); R = os.path.dirname(E)
OUT = sys.argv[1]; HOUSE = json.load(open(sys.argv[2])); RP, SP = (int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '18471,18472').split(','))
site = tempfile.mkdtemp(); os.symlink(E, site + '/engine'); os.symlink(R + '/tools/spawn-tuner', site + '/tuner'); d = tempfile.mkdtemp()
P = [subprocess.Popen(['node', E + '/relay/server.js'], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': d, 'ORIENT_API': ''}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
     subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)]
time.sleep(2)
LOOK = "(x, z, dist, pitch) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = pitch; g.yaw = 0; g.update(); }"
SH = [('12d6', '12d6', [6, 1, 3, 5, 2, 4, 6, 6, 1, 2, 5, 3]), ('20d10', '20d10', [7, 1, 10, 4, 9, 2, 8, 3, 6, 5, 10, 1, 7, 2, 9, 4, 3, 8, 5, 6])]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{SP}/engine/client/index.html?relay=http%3A%2F%2F127.0.0.1%3A{RP}&api=&nointro&faces=1500')
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', 'TEST bigpool stills (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.() && tw.dice', timeout=600000, polling=250)
        await pg.evaluate("async (h) => { const m = await import(new URL('tuner.js', document.baseURI).href); m.T.house.dice = h; }", HOUSE)
        await pg.evaluate('tw.spawnRoom("common", 0, 0, 8, 6, 7711)')
        await pg.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=600000, polling=250)
        await pg.evaluate("document.querySelector('#announce')?.style.setProperty('display','none')")
        for name, expr, rolls in SH:
            await pg.evaluate("tw.dice.clear()"); await pg.evaluate(f"({LOOK})(20, 12, 34, 55)"); await pg.wait_for_timeout(1200)
            await pg.evaluate(f"tw.roll({json.dumps(expr)}, '', {{ given: {{ rolls: {json.dumps(rolls)}, total: 0 }} }})")
            await pg.wait_for_function("tw.dice.info().length && tw.dice.info()[0].settled && tw.dice.info()[0].dice.every(d => d.tag)", timeout=60000, polling=100)
            await pg.evaluate("tw.dice.seek(tw.dice.info()[0].id, 1e4)")  # (hold it: no fade while the shots are taken)
            t = await pg.evaluate("tw.dice.info()[0]"); last = await pg.evaluate("(({ tries, fallback, setDown, hands, ms, wall } = tw.dice.last || {}) => ({ tries, fallback, setDown, hands, ms, wall }))()")
            xs = [q['p'][0] for q in t['dice']]; zs = [q['p'][2] for q in t['dice']]
            span = max(max(xs) - min(xs), max(zs) - min(zs))
            await pg.evaluate(f"({LOOK})({sum(xs) / len(xs)}, {sum(zs) / len(zs)}, {max(14, span * 1.5)}, 70)"); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'{OUT}/bigpool-{name}.png')
            # faces only: the tags taken off
            await pg.evaluate("for (const w of tw.worlds.values()) w.dice?.root.traverse(o => { if (o.isSprite && o.userData.diceTag) o.visible = false; })"); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'{OUT}/bigpool-{name}-faces.png')
            print(json.dumps({'name': name, 'committed': rolls, 'reads': [q['reads'] for q in t['dice']], 'drawn': t.get('drawn'), 'throw': last}))
        print('errors', errs[:3]); await b.close()
asyncio.run(main()); [x.terminate() for x in P]
