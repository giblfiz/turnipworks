#!/usr/bin/env python3
"""Import Lab acceptance: the controls do what they say.  browser-venv/bin/python test/ui_check.py [BASE] [--send]
--send also presses "This looks fine" (writes one self-test record to reviews/tuner/import_lab.jsonl)."""
import asyncio, sys, pathlib
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.async_api import async_playwright
BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://127.0.0.1:8377/import-lab/')
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
OUT = pathlib.Path(__file__).parent / 'shots'; OUT.mkdir(exist_ok=True)
fails = []
def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=GPU)
        page = await b.new_page(viewport={'width': 1680, 'height': 950}, accept_downloads=True)
        errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        await page.goto(BASE + '?capture=1&sample=cube&budget=5000')
        idle = "window.__lab && window.__lab.current && !window.__lab.busy && window.__lab.current.key === `${window.__lab.S.budget}|${window.__lab.S.bake ? window.__lab.S.tex : 0}`"
        await page.wait_for_function(idle, timeout=120000)
        check('house lighting' in await page.inner_text('#hud') and 'PLAIN' not in await page.inner_text('#hud'), 'the house lighting module loaded (not the plain fallback)')
        check(await page.evaluate("window.__lab.S.view") == 'table' and await page.evaluate("window.__lab.cam.dist") == 95, 'opens at table distance (95 ft, the game camera)')
        check('uploaded' in await page.inner_text('header'), 'the page says nothing is uploaded')
        t = await page.inner_text('#readout'); check('19,200' in t and '5,000' in t and 'GLB' in t and '%' in t, 'readout shows original and converted triangles, GLB size, time and error')
        await page.click('#budget button[data-v="10000"]'); await page.wait_for_function(idle, timeout=120000)
        check(await page.evaluate("window.__lab.current.stats.triangles") in range(9000, 10001), 'the 10k notch converts to about 10,000 triangles')
        await page.click('#bake'); await page.wait_for_function(idle, timeout=120000)
        check(await page.evaluate("window.__lab.current.stats.bake") is False and await page.evaluate("document.querySelector('#tex button').disabled"), 'bake off: no normal map, texture sizes greyed')
        await page.click('#bake'); await page.wait_for_function(idle, timeout=120000)
        await page.click('#view button[data-v="close"]'); check(await page.evaluate("window.__lab.cam.dist") < 20, 'close-up moves the camera in')
        await page.keyboard.press('1'); check(await page.evaluate("window.__lab.S.view") == 'table', 'key 1 returns to table distance')
        await page.click('#mode button[data-v="flip"]'); await page.wait_for_timeout(300)
        check(not await page.is_visible('#paneB'), 'flip mode shows one view')
        await page.keyboard.down('Space'); await page.wait_for_timeout(300)
        check((await page.inner_text('#tagA')).startswith('CONVERTED'), 'holding Space shows the converted model in place')
        await page.screenshot(path=str(OUT / 'flip-held.png'))
        await page.keyboard.up('Space'); await page.wait_for_timeout(200)
        check((await page.inner_text('#tagA')).startswith('ORIGINAL'), 'releasing Space shows the original again')
        await page.click('#mode button[data-v="side"]')
        await page.fill('#height', '9'); await page.dispatch_event('#height', 'change')
        check(abs(await page.evaluate("new (window.__lab.scene.children[0].position.constructor)().setFromMatrixScale(window.__lab.model.matrix).x") - 9) < 1e-6, 'height 9 ft scales the 1-unit cube to 9 ft')
        before = await page.evaluate("window.__lab.model.matrix.elements.join()")
        await page.click('#turn'); check(before != await page.evaluate("window.__lab.model.matrix.elements.join()"), 'Turn changes the facing')
        await page.click('#look button[data-v="primer"]'); check(await page.evaluate("window.__lab.S.look") == 'primer', 'finish buttons switch the material')
        async with page.expect_download(timeout=30000) as dl: await page.click('#download')
        d = await dl.value; path = await d.path(); head = open(path, 'rb').read(4)
        check(head == b'glTF' and d.suggested_filename.endswith('.glb'), f'download gives a GLB ({d.suggested_filename}, {pathlib.Path(path).stat().st_size:,} bytes)')
        fixture = pathlib.Path(__file__).parent / 'fixtures/bumpy-ball.stl'  # built by prep/make_fixtures.py
        check(fixture.exists(), 'the STL fixture exists (python3 prep/make_fixtures.py)')
        if fixture.exists():
            await page.set_input_files('#file', str(fixture)); await page.wait_for_function("window.__lab.model && window.__lab.model.name === 'bumpy-ball.stl' && window.__lab.current && !window.__lab.busy", timeout=120000)
            check(await page.evaluate("window.__lab.model.high.nt") == 20480 and await page.evaluate("window.__lab.S.up") == 'z', 'an STL file loads (20,480 triangles), welds, and is assumed Z-up')
            await page.screenshot(path=str(OUT / 'stl.png'))
        if '--send' in sys.argv:
            await page.fill('#note', 'Fauna self-test of the verdict button, not a real verdict')
            await page.click('#fine'); await page.wait_for_function("document.querySelector('#sent').textContent.startsWith('Sent')", timeout=15000)
            check(True, 'verdict posted: ' + await page.inner_text('#sent'))
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    print(f'{len(fails)} failed'); sys.exit(1 if fails else 0)
asyncio.run(main())
