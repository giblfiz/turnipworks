#!/usr/bin/env python3
"""A QUICK THERE-AND-BACK KEEPS THE SEAT WHERE IT ENDED (2026-11-06; docs/NETCODE.md "Where a seat is"; client/main.js app.locate).

  python3 engine/test/browser_travelback.py --local

Found 2026-11-01: travelling to an area and back inside one relay round trip left the relay's seat location on the
OTHER area, so a reload landed there. setMain compared the destination with the campaign's confirmed location, which
had not caught up with the first trip yet, and so skipped the trip home.

  GM       the GM goes A -> B -> A in one breath; once the relay is idle its stored location is A, and a reload lands on A
  PLAYER   the same on a player's seat, and the GM's roster shows the player at A
  SLOW     a slow A -> B (round trip finished) still moves the stored location to B: the ordinary trip is untouched
  BOUNCE   A -> B -> A -> B in one breath ends on B
"""
import argparse, asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '23301,23302').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-travelback-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(600)
LOC = "tw.sync.campaign.my.location"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, **kw):
            ctx = await browser.new_context(**({'viewport': {'width': 1200, 'height': 800}} | kw))
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        async def reload(pg):
            await pg.reload(wait_until='domcontentloaded', timeout=180000)
            return await wait(pg, 'window.tw && tw.ready && tw.ready() && tw.sync.campaign && tw.area()', 45000, 'live after reload')

        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST travelback {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        AA = await gm.evaluate("tw.area()")
        BB = 'area_road000001'
        await gm.evaluate(f"tw.sync.submit('area.create', {{ id: '{BB}', name: 'The Road' }})")
        await wait(gm, "tw.sync.campaign.areas.length === 2", 8000, 'area created')
        await gm.evaluate(f"tw.sync.submit('area.visibility', {{ area: '{BB}', visibility: 'open' }})"); await idle(gm)
        check(await gm.evaluate(LOC) == AA, 'the GM starts in the first area', [await gm.evaluate(LOC), AA])

        print('GM: A -> B -> A in one breath')
        await gm.evaluate(f"(tw.setMain('{BB}'), tw.setMain('{AA}'))")
        await idle(gm)
        check(await gm.evaluate("tw.area()") == AA, 'the GM view is on A', await gm.evaluate("tw.area()"))
        await wait(gm, f"{LOC} === '{AA}'", 5000, 'stored location A')
        check(await gm.evaluate(LOC) == AA, "the relay's stored location for the GM is A, not B", await gm.evaluate(LOC))
        check(await reload(gm), 'GM reloaded')
        check(await gm.evaluate("tw.area()") == AA and await gm.evaluate(LOC) == AA, 'a reload lands the GM on A', [await gm.evaluate("tw.area()"), await gm.evaluate(LOC)])

        print('PLAYER: the same on a player seat')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        await wait(pl, f"tw.area() === '{AA}' && tw.sync.view('{AA}')", 10000, 'player on A')
        MIRA = await pl.evaluate("tw.sync.me")
        await pl.evaluate(f"(tw.setMain('{BB}'), tw.setMain('{AA}'))")
        await idle(pl)
        await wait(pl, f"{LOC} === '{AA}'", 5000, 'player stored location A')
        check(await pl.evaluate(LOC) == AA, "the relay's stored location for the player is A", await pl.evaluate(LOC))
        await wait(gm, f"tw.sync.campaign.seats.find(s => s.id === '{MIRA}')?.location === '{AA}'", 5000, 'roster A')
        check(await gm.evaluate(f"tw.sync.campaign.seats.find(s => s.id === '{MIRA}')?.location") == AA, "the GM's roster has the player at A")
        check(await reload(pl), 'player reloaded')
        check(await pl.evaluate("tw.area()") == AA, 'a reload lands the player on A', await pl.evaluate("tw.area()"))

        print('SLOW: an ordinary trip still moves the seat')
        await pl.evaluate(f"tw.setMain('{BB}')"); await idle(pl)
        await wait(pl, f"{LOC} === '{BB}'", 5000, 'stored B')
        check(await pl.evaluate(LOC) == BB, 'a slow A -> B stores B', await pl.evaluate(LOC))
        check(await reload(pl), 'player reloaded')
        check(await pl.evaluate("tw.area()") == BB, 'and a reload lands on B', await pl.evaluate("tw.area()"))

        print('BOUNCE: B -> A -> B -> A in one breath')
        await pl.evaluate(f"(tw.setMain('{AA}'), tw.setMain('{BB}'), tw.setMain('{AA}'))"); await idle(pl)
        await wait(pl, f"{LOC} === '{AA}'", 5000, 'stored A')
        check(await pl.evaluate(LOC) == AA, 'B -> A -> B -> A ends stored on A', await pl.evaluate(LOC))
        await pl.evaluate(f"(tw.setMain('{BB}'), tw.setMain('{AA}'), tw.setMain('{BB}'))"); await idle(pl)
        await wait(pl, f"{LOC} === '{BB}'", 5000, 'stored B')
        check(await pl.evaluate(LOC) == BB, 'A -> B -> A -> B ends stored on B', await pl.evaluate(LOC))
        check(await reload(pl), 'player reloaded')
        check(await pl.evaluate("tw.area()") == BB, 'and a reload lands on B', await pl.evaluate("tw.area()"))

        check(not errors, 'no page errors', errors[:5])
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
fails = [r for r in results if not r[0]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
