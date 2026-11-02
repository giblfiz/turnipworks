#!/usr/bin/env python3
"""An AI seat hides its cursor (Harry 2026-11-01; docs/NETCODE.md "Hiding an AI seat's cursor"). The agent does what a real
one does: it fetches its rules card over plain HTTP and opens the addresses printed on it, so the card's own words are
what is under test. The GM's browser and a player's browser watch; what they hold is the page's own PresenceView
(tw.cursors) and what they draw is the world's cursor meshes.

  HIDE     an agent that has read a room is on both tables; the card's cursor.hide takes it off both at once, and it
           stays off past the relay's 1 s heartbeat
  LATE     a seat that joins while it is hidden does not see it; a seat that reloads (a reconnect) does not either
  SHOW     the card's cursor.show puts it back on every table, the late joiner's too
  AUTO     hidden again, a read of the whole scene leaves it hidden; a command, or a read of one room, shows it by itself

  browser-venv/bin/python engine/test/browser_agentcursor.py --local
  ... --page https://dev.turnipworks.net/          (a throwaway table on that server, deleted at the end)
  --shots DIR keeps a picture of the GM's table with the cursor on it and with it gone
"""
import argparse, asyncio, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18335,18935').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-agentcursor-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

def fetch(url):  # plain HTTP, as an AI seat's fetch tool would (a browser-like agent string: Cloudflare stands in front of dev)
    r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (turnip-works test agent)', **tw_sandbox.HEADERS}), timeout=30)
    body = r.read().decode('utf-8'); return json.loads(body) if 'json' in r.headers.get('Content-Type', '') else body
async def agent(url):  # (off the page's thread: the page must keep running while the agent waits on the relay)
    return await asyncio.to_thread(fetch, url)
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1200, 'height': 800})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST agentcursor {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw?.ready?.()', 90000), 'GM live')
        rid = await gm.evaluate('tw.spawnRoom("common", 0, 0, 6, 6, 7101)')
        await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        check(await wait(pl, 'window.tw?.ready?.()', 90000), 'player joins')
        made = await gm.evaluate("async () => { const t = await tw.createSeat({kind:'llm',name:'Helper',color:'#b48cff',scope:{areas:'*',classes:['token.move','token.edit','room','object','chat']}}); return {card: tw.cardUrl(t), area: tw.area()}; }")
        card = await agent(made['card'])
        line = next((l for l in card.split('\n') if 'cursor.hide' in l), '')
        check('Whenever you are not actively working, hide your cursor:' in line and 'When you start again, show it:' in line, 'the rules card tells the agent', line.strip()[:90])
        hide, show = (re.search(rf'(https?://\S*cmd=cursor\.{w}\S*)', line).group(1) for w in ('hide', 'show'))
        scene = re.search(r'THE SCENE [^:]*: (https?://\S+)', card).group(1)
        n = [0]
        def addr(u): n[0] += 1; return u.replace('NEW_WORD', f'word{n[0]}')
        room = scene.replace('/scene?', f'/room/{rid}?')
        SEAT = urllib.parse.parse_qs(urllib.parse.urlsplit(scene).query)['seat'][0].split('.')[0]
        on = f"tw.cursors().some(s => s.seat === '{SEAT}')"
        off = '!' + on
        drawn = f"!!tw.worldOf(tw.area()).cursors.get('{SEAT}')"

        # HIDE
        await agent(room)
        check(await wait(gm, on) and await wait(pl, on), "HIDE an agent reading a room is on the GM's table and the player's")
        check(await wait(gm, drawn), "HIDE ...and drawn on the GM's screen")
        name_tag = await gm.evaluate(f"tw.cursors().find(s => s.seat === '{SEAT}')")
        check("Harry's GM assistant" in (name_tag.get('label') or ''), 'HIDE its tag says whose agent it is', name_tag.get('label'))
        if A.shots: os.makedirs(A.shots, exist_ok=True); await gm.wait_for_timeout(1200); await gm.screenshot(path=os.path.join(A.shots, 'cursor-on.png'))
        t0 = time.time(); r = await agent(addr(hide))
        check(r.get('ok') and r.get('cursor') == 'hidden', 'HIDE the address on the card answers ok', r)
        gone = await wait(gm, off, 3000) and await wait(pl, off, 3000); ms = int((time.time() - t0) * 1000)
        check(gone, f'HIDE off both tables ({ms} ms from opening the address)')
        check(await wait(gm, '!' + drawn, 3000), "HIDE ...and no longer drawn on the GM's screen")
        if A.shots: await gm.wait_for_timeout(400); await gm.screenshot(path=os.path.join(A.shots, 'cursor-off.png'))
        await gm.wait_for_timeout(1500)
        check(await gm.evaluate(off) and await pl.evaluate(off), "HIDE it stays off past the relay's 1 s heartbeat")

        # LATE
        late_invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Jon',color:'#67dd8a'}))")
        late = await tab(late_invite)
        check(await wait(late, 'window.tw?.ready?.()', 90000), 'LATE a third seat joins while it is hidden')
        await late.wait_for_timeout(1500)
        check(await late.evaluate(off), 'LATE the late joiner does not see it')
        await pl.reload()
        check(await wait(pl, 'window.tw?.ready?.()', 90000), 'LATE the player reloads (a reconnect)')
        await pl.wait_for_timeout(1500)
        check(await pl.evaluate(off), 'LATE after the reconnect the player does not see it')

        # SHOW
        r = await agent(addr(show))
        check(r.get('ok') and r.get('cursor') == 'shown', 'SHOW the address on the card answers ok', r)
        check(await wait(gm, on, 3000) and await wait(pl, on, 3000) and await wait(late, on, 3000), 'SHOW back on every table, the late joiner\'s too')
        check(await wait(gm, drawn, 3000), "SHOW ...and drawn on the GM's screen")

        # AUTO
        await agent(addr(hide)); await wait(pl, off, 3000)
        await agent(scene); await gm.wait_for_timeout(1500)
        check(await pl.evaluate(off), 'AUTO reading the whole scene leaves it hidden')
        await agent(room)
        check(await wait(pl, on, 3000), 'AUTO reading one room shows it by itself')
        await agent(addr(hide)); await wait(pl, off, 3000)
        act = re.search(r'ADD A CREATURE TO A ROOM: .*?then (https?://\S+)', card).group(1).replace('FIGURE_ID', 'foe-goblin-club').replace('ROOM_ID', rid)
        r = await agent(addr(act))
        check(r.get('ok'), 'AUTO the agent acts: a goblin in the room', str(r)[:120])
        check(await wait(pl, on, 3000), 'AUTO a command shows it by itself: it cannot act unseen')
        check(not errors, 'no browser errors', errors[:5])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nagentcursor: {len(results)-len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
