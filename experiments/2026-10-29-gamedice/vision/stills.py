# game dice stills on clear ground (no furniture in the way), forced faces, GM throws; prints each die's pose
import asyncio, json, os, sys, subprocess, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
E='engine'; R=os.path.dirname(E); OUT=sys.argv[1]
site=tempfile.mkdtemp(); os.symlink(E, site+'/engine'); os.symlink(R+'/tools/spawn-tuner', site+'/tuner'); d=tempfile.mkdtemp()
P=[subprocess.Popen(['node',E+'/relay/server.js'],env={**os.environ,'PORT':'18361','DATA_DIR':d,'ORIENT_API':''},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL),
   subprocess.Popen([sys.executable,'-m','http.server','18362','--bind','127.0.0.1'],cwd=site,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)]
time.sleep(2)
LOOK = "(x, z, dist, pitch) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = pitch; g.yaw = 0; g.update(); }"
SH=[('l5r', 'l5r 3 ring 3 skill', [6, 2, 4, 12, 10, 3]), ('l5r-b', 'l5r 3 ring 3 skill', [5, 3, 1, 6, 8, 11]), ('v5', 'v5 6 hunger 2', [10, 7, 1, 6, 10, 1]), ('duality', 'duality+1', [11, 4])]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--enable-gpu'])
        pg=await (await b.new_context(viewport={'width':1280,'height':820})).new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto('http://127.0.0.1:18362/engine/client/index.html?relay=http%3A%2F%2F127.0.0.1%3A18361&api=&nointro&faces=1500')
        await pg.fill('#newCampaign input[name=gm]','Harry'); await pg.fill('#newCampaign input[name=name]','TEST gamedice stills (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.() && tw.dice', timeout=90000)
        await pg.evaluate("document.querySelector('#announce')?.style.setProperty('display','none')")
        for name, expr, rolls in SH:
            await pg.evaluate("tw.dice.clear()"); await pg.evaluate(f"({LOOK})(60, 60, 30, 55)"); await pg.wait_for_timeout(600)
            await pg.evaluate(f"tw.roll({json.dumps(expr)}, '', {{ given: {{ rolls: {json.dumps(rolls)}, total: 0 }} }})")
            await pg.wait_for_function("tw.dice.info().length && tw.dice.info()[0].settled", timeout=20000)
            t=await pg.evaluate("tw.dice.info()[0]")
            xs=[q['p'][0] for q in t['dice']]; zs=[q['p'][2] for q in t['dice']]
            span=max(max(xs)-min(xs), max(zs)-min(zs))
            await pg.evaluate(f"({LOOK})({sum(xs)/len(xs)}, {sum(zs)/len(zs)}, {max(12, span*2.4)}, 58)"); await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'{OUT}/still-{name}.png')
            print(name, 'drawn', t['drawn'] if 'drawn' in t else '?', [(q['type'], q.get('skin'), q['reads'], q.get('tag'), [round(v,1) for v in q['p']]) for q in t['dice']])
        print('errors', errs[:3]); await b.close()
asyncio.run(main()); [x.terminate() for x in P]
