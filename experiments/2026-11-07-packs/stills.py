#!/usr/bin/env python3
"""Stills of the assets page AS IF its pack release were published (build_site.py --assets-preview), desktop and phone,
plus the page as built (unpublished) for comparison. Writes PNGs to the folder given (default the lane's USB folder).
  python3 experiments/2026-11-07-packs/stills.py [OUT] [PORT]"""
import asyncio, os, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); ENGINE = os.path.join(REPO, 'engine')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/mnt/usb/turnip-works/lanes-2026-11-07/packs/stills'
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 19071
site = tempfile.mkdtemp(prefix='tw-packs-stills-'); os.symlink(ENGINE, os.path.join(site, 'engine'))
subprocess.run(['python3', os.path.join(ENGINE, 'tools', 'build_site.py'), '--assets-preview', os.path.join(site, 'preview')], check=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/preview/assets.html', timeout=1); break
    except Exception: time.sleep(0.1)
O = f'http://127.0.0.1:{PORT}'
SHOTS = [  # (name, url, width, height, phone, scroll to selector)
    ('desk-overview', '/preview/assets.html', 1280, 900, False, '#lib'),
    ('desk-pack-tavern', '/preview/assets.html#pack/tavern-inn', 1280, 900, False, None),
    ('desk-pack-figures', '/preview/assets.html#pack/figures', 1280, 900, False, None),
    ('phone-overview', '/preview/assets.html', 390, 844, True, '#lib'),
    ('phone-pack-tavern', '/preview/assets.html#pack/tavern-inn', 390, 844, True, None),
    ('phone-pack-figures-hero', '/preview/assets.html#pack/figures/hero', 390, 844, True, None),
    ('desk-overview-unpublished', '/engine/client/site/assets.html', 1280, 900, False, '#lib'),
    ('desk-pack-figures-open', '/preview/assets.html#pack/figures', 1280, 900, False, 'click:.hdd summary'),
    ('phone-pack-figures-open', '/preview/assets.html#pack/figures', 390, 844, True, 'click:.hdd summary'),
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        for name, url, w, h, phone, sel in SHOTS:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if phone else {}))
            pg = await ctx.new_page(); await pg.goto(O + url, wait_until='load'); await pg.wait_for_timeout(1800)
            if sel and sel.startswith('click:'): await pg.click(sel[6:]); await pg.evaluate(f"document.querySelector('{sel[6:]}').scrollIntoView({{block: 'center'}})")
            elif sel: await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView()")
            await pg.wait_for_timeout(900)
            sw = await pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
            await pg.screenshot(path=os.path.join(OUT, name + '.png')); print(name, 'scrollWidth/innerWidth', sw)
            await ctx.close()
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
