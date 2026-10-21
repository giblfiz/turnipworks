"""The live game: a throwaway campaign ("Fauna QA yard"), a common room with a yard south of it, the table view.
    browser-venv/bin/python game_yard.py https://turnipworks.net/ OUTDIR
Writes OUTDIR/game-yard.png and prints what the yard holds. Leaves one small test campaign on the relay."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
page, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg = await (await b.new_context(viewport={'width': 1400, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(page + ('&' if '?' in page else '?') + 'nopost&nointro')
        await pg.fill('#newCampaign input[name=gm]', 'Fauna QA yard'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
        r = await pg.evaluate("""(async () => {
          const wait = (ms) => new Promise(r => setTimeout(r, ms));
          const rooms = Object.values(tw.entities()).filter(e => e.kind === 'room');
          const x = Math.max(0, ...rooms.map(e => e.recipe.x + e.recipe.w)) + 4, z = 2;
          const c = tw.spawnRoom('common', x, z, 6, 4, 4243); for (let i = 0; i < 100 && !tw.entities()[c]; i++) await wait(100);
          await wait(2500);
          const y = tw.spawnRoom('yard', x, z + 4, 6, 5, 77); for (let i = 0; i < 100 && !tw.entities()[y]; i++) await wait(100);
          await wait(9000);
          const objs = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === y);
          const g = tw.main.grab; g.focus.set((x + 3) * 5, 0, (z + 6) * 5); g.pitch = 55; g.yaw = 0; g.dist = 62; g.update(); tw.main.rule = 'free';
          await wait(6000);
          return { yard: y, n: objs.length, cats: objs.map(o => o.cat || o.id).sort(), engine: tw.roomgen?.version };
        })()""")
        await pg.screenshot(path=f'{out}/game-yard.png')
        print(json.dumps(r)[:1500]); print('page errors:', errs[:3])
        await b.close()
asyncio.run(main())
