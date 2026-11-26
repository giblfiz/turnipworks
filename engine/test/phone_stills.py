#!/usr/bin/env python3
"""Stills of the four phone fixes (2026-11-11), for before / after and the blind Gemini read.

  TW_GPU=1 python3 engine/test/phone_stills.py --local --tag before|after
Writes experiments/2026-11-11-phone-product/stills/<tag>-<orientation>-<what>.jpg: the Pawns tray as the GM and as a
player, Build open, the bar open and with "elf barbarian" typed, a quickbar pick tapped (after: the ghost and its ✕).
"""
import argparse, asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import phonekit as K
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox

ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--tag', default='after')
A = ap.parse_args()
OUT = os.path.join(K.REPO, 'experiments', '2026-11-11-phone-product', 'stills'); os.makedirs(OUT, exist_ok=True)

async def run(p, page, W, H):
    o = 'portrait' if H > W else 'landscape'
    S = lambda pg, what: pg.screenshot(path=os.path.join(OUT, f'{A.tag}-{o}-{what}.jpg'), type='jpeg', quality=72)
    br, ctx, pg, cdp, errs = await K.gm_table(p, page, W, H, 'stills')
    await K.furnish(pg)
    b = await K.at(pg, '#launchers .launcher:nth-child(1)'); await K.tap(cdp, *b); await pg.wait_for_timeout(900); await S(pg, 'pawns-gm')
    await K.esc_all(pg)
    b = await K.at(pg, '#launchers .launcher:nth-child(2)'); await K.tap(cdp, *b); await pg.wait_for_timeout(900); await S(pg, 'build')
    await K.esc_all(pg)
    b = await K.at(pg, '#bar textarea'); await K.tap(cdp, *b); await pg.wait_for_timeout(700); await S(pg, 'bar')
    await pg.keyboard.type('elf barbarian'); await pg.wait_for_timeout(900); await S(pg, 'bar-elf')
    r = await K.at(pg, '#results .res'); await K.tap(cdp, *r); await pg.wait_for_timeout(1000); await S(pg, 'bar-tapped')
    await K.esc_all(pg)
    pl, pctx, pcdp, perrs = await K.player(br, pg, W, H)
    b = await K.at(pl, '#launchers .launcher:nth-child(1)'); await K.tap(pcdp, *b); await pl.wait_for_timeout(900)
    await pl.screenshot(path=os.path.join(OUT, f'{A.tag}-{o}-pawns-player.jpg'), type='jpeg', quality=72)
    await pctx.close(); await br.close()
    print(o, 'errors', errs[:3], perrs[:3])

async def main():
    page = K.start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with K.async_playwright() as p:
        await run(p, page, 390, 844)
        await run(p, page, 844, 390)
try: asyncio.run(main())
finally: K.cleanup()
print('stills in', OUT)
