#!/usr/bin/env python3
"""Open pages in Playwright's FIREFOX (Harry's browser; --chromium for Chromium) and say whether they come up: console errors, page errors,
failed requests, whether the page reached its ready flag, the WebGL renderer.
    browser-venv/bin/python ff_check.py URL [URL ...] [--shot=DIR]"""
import sys, time
from playwright.sync_api import sync_playwright
dsf = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--dsf=')), 1)); urls = [a for a in sys.argv[1:] if a.startswith('http')]; shot = next((a.split('=')[1] for a in sys.argv if a.startswith('--shot=')), None)
with sync_playwright() as p:
    import os
    chromium = '--chromium' in sys.argv
    headed = bool(os.environ.get('DISPLAY'))   # headless Firefox has no WebGL on this box: run it on the Xvfb display (DISPLAY=:99)
    b = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']) if chromium else p.firefox.launch(headless=not headed, firefox_user_prefs={'webgl.force-enabled': True, 'layers.acceleration.force-enabled': True})
    for u in urls:
        pg = b.new_page(viewport={'width': 1500, 'height': 950}, device_scale_factor=dsf); logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text[:400]}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {str(e)[:600]}'))
        pg.on('requestfailed', lambda r: logs.append(f'FAILED: {r.url} {r.failure}'))
        pg.on('response', lambda r: logs.append(f'{r.status} {r.url}') if r.status >= 400 else None)
        pg.goto(u); ok = True
        try: pg.wait_for_function('window.__ready === true', timeout=60000)
        except Exception: ok = False
        time.sleep(2)
        gl = pg.evaluate("(()=>{try{const c=document.createElement('canvas').getContext('webgl2');if(!c)return 'NO WEBGL2';const e=c.getExtension('WEBGL_debug_renderer_info');return (e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER))+' | float RT: '+!!c.getExtension('EXT_color_buffer_float')+' half: '+!!c.getExtension('EXT_color_buffer_half_float')}catch(e){return 'ERR '+e}})()")
        print(f'\n== {u}\n   ready: {ok}   status: {pg.evaluate("document.querySelector(\'#status\')?.textContent")}   fx: {pg.evaluate("window.__fx")}   gl: {gl}')
        print('   canvas:', pg.evaluate("(()=>{const c=document.querySelector('canvas');if(!c)return null;const g=c.getContext('webgl2');return {w:c.width,h:c.height,drawingBuffer:g?[g.drawingBufferWidth,g.drawingBufferHeight]:null,lost:g?g.isContextLost():null,dpr:devicePixelRatio}})()"))
        # is anything drawn? the share of non-black pixels in a screenshot of the canvas
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(pg.screenshot())).convert('L').resize((150, 95)); px = list(im.getdata()); print('   picture: share of pixels brighter than near-black:', round(sum(v > 24 for v in px) / len(px), 2))
        for l in list(dict.fromkeys(logs))[:14]: print('   ', l)
        if shot: pg.screenshot(path=f'{shot}/ff-{u.rstrip("/").split("/")[-1].split("?")[0] or "page"}.png')
        pg.close()
    b.close()
