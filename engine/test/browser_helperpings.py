#!/usr/bin/env python3
"""A person points; the helpers are told (Harry 2026-11-02; docs/NETCODE.md "A ping reaches the helpers"). Real seats in real
browsers, on both transports: the helpers do what a real one does, fetch the rules card and open the addresses printed on it,
asleep in the card's own long wait while a person holds the mouse still on a pawn.

  LABEL    the GM's screen shows a building's label; its helper reads the same one in the scene, paired with the id; a
           player's helper reads none
  MOUSE    press and hold with a mouse (0.7 s): the helpers' long wait wakes with who, where and what is there
  ALT      Alt/Option+click: the same
  TOUCH    a finger held still: the same
  SECRET   a hold inside a room hidden from players: the GM's helper hears it, the player's helper does not, and its long
           wait is not ended early
  SHORT    a click and a drag tell nobody

  browser-venv/bin/python engine/test/browser_helperpings.py --local
  ... --page https://dev.turnipworks.net/          (a throwaway table on that server, deleted at the end)
"""
import argparse, asyncio, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox
sys.path.insert(0, HERE); import served  # noqa: E402
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:300] if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18337,18937').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-helperpings-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

def fetch(url):  # plain HTTP, as an AI seat's fetch tool would (a browser-like agent string: Cloudflare stands in front of dev)
    r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (turnip-works test agent)', **tw_sandbox.HEADERS}), timeout=40)
    body = r.read().decode('utf-8'); return json.loads(body) if 'json' in r.headers.get('Content-Type', '') else body
async def agent(url): return await asyncio.to_thread(fetch, url)
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL])
        errors = []
        async def tab(url, **kw):
            ctx = await browser.new_context(viewport={'width': 1200, 'height': 800}, **kw)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        for gm_way, pl_way in (('ws', 'sse'), ('sse', 'ws')):
            print(f'-- the GM on {gm_way}, the player on {pl_way}')
            gm = await tab(page + f'&transport={gm_way}')
            await gm.fill('#newCampaign input[name=gm]', 'Harry')
            await gm.fill('#newCampaign input[name=name]', f"TEST helperpings {gm_way} {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await gm.click('#newCampaign button')
            check(await wait(gm, 'window.tw?.ready?.()', 90000), 'GM live')
            kind = await gm.evaluate('tw.transport()')
            check(kind == gm_way, f"the GM's browser really is on {gm_way}", kind)
            rid = await gm.evaluate('tw.spawnRoom("common", 0, 0, 6, 6, 7101)')
            vault = await gm.evaluate('tw.spawnRoom("kitchen", 12, 0, 6, 6, 7102)')
            await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
            await gm.evaluate("tw.dispatch('token.create', { id: 'tok_grum000001', name: 'Grum', x: 7.5, z: 7.5 })")
            await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{vault}'], hidden: true }})")
            await wait(gm, f"tw.sync.pendingCount() === 0 && !!tw.entities()['tok_grum000001']", 8000)
            invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
            pl = await tab(invite.replace(f'transport={gm_way}', f'transport={pl_way}'))
            check(await wait(pl, 'window.tw?.ready?.()', 90000), 'player joins')
            kind = await pl.evaluate('tw.transport()')
            check(kind == pl_way, f"the player's browser really is on {pl_way}", kind)
            mk = "async ([n, c]) => tw.cardUrl(await tw.createSeat({kind:'llm',name:n,color:'#b48cff',scope:{areas:'*',classes:c}}))"
            gcard = await agent(await gm.evaluate(mk, ['Helper', ['token.move', 'room', 'object', 'chat', 'reveal']]))
            pcard = await agent(await pl.evaluate(mk, ['Scout', ['token.move', 'chat']]))
            addr = lambda c, pat: re.search(pat, c).group(1)
            gscene, pscene = addr(gcard, r'THE SCENE [^:]*: (https?://\S+)'), addr(pcard, r'THE SCENE [^:]*: (https?://\S+)')
            gwait, pwait = addr(gcard, r'To wait for talk[^:]*: (https?://\S+)'), addr(pcard, r'To wait for talk[^:]*: (https?://\S+)')
            check('PING' in gcard and 'look at this' in pcard, 'the card tells them')

            # LABEL
            shown = await gm.evaluate("(() => { const b = tw.labelInfo().find(l => l.kind === 'building'); return b && { id: b.id, text: b.text }; })()")
            sc = await agent(gscene); ps = await agent(pscene)
            row = next((b for b in sc.get('buildings', []) if shown and b['id'] == shown['id']), None)
            check(shown and row and row.get('label') == shown['text'], "LABEL the GM's helper reads the label on the GM's screen, paired with its id", f'{shown} {row}')
            check(ps.get('buildings') and all('label' not in b and b['name'] == 'Building' for b in ps['buildings']) and not await pl.evaluate('tw.labelInfo().length'), "LABEL a player sees none on screen, and her helper reads none", ps.get('buildings'))
            gc = (await agent(gwait.replace('after=CURSOR&', '').replace('wait=25', 'wait=0')))['cursor']
            pc = (await agent(pwait.replace('after=CURSOR&', '').replace('wait=25', 'wait=0')))['cursor']

            async def told(do, secs=8, g=True, pp=True):
                """both helpers asleep in the card's own wait; `do` happens; -> what each was told, and how long it slept"""
                async def one(url, cur, on):
                    if not on: return None
                    t = time.time(); r = await agent(url.replace('CURSOR', urllib.parse.quote(cur)).replace('wait=25', f'wait={secs}')); return [e for e in r['events'] if e['kind'] == 'ping'], time.time() - t
                ga, pa = asyncio.create_task(one(gwait, gc, g)), asyncio.create_task(one(pwait, pc, pp))
                await asyncio.sleep(0.5); await do()
                return await ga, await pa
            at = lambda x, z, y=0: gm.evaluate(f'(() => {{ const s = tw.screenOf({x}, {z}, tw.main, {y}); return [s.x, s.y]; }})()')
            async def hold(x, z, pg=None, ms=750):
                pg = pg or gm; sx, sy = await at(x, z, 0.1)
                await pg.mouse.move(sx, sy); await pg.mouse.down(); await pg.wait_for_timeout(ms); await pg.mouse.up(); await pg.wait_for_timeout(300)
            # MOUSE
            await gm.wait_for_timeout(700)
            g, q = await told(lambda: hold(7.5, 7.5))
            check(len(g[0]) == 1 and g[0][0]['by'] == 'Harry' and g[1] < 4 and abs(g[0][0]['x'] - 7.5) < 3 and g[0][0]['there'].get('pawn', {}).get('name') == 'Grum', "MOUSE a held mouse on a pawn: the GM's helper wakes with who, where and what is there", g)
            check(len(q[0]) == 1 and q[1] < 4 and q[0][0]['there'].get('pawn', {}).get('name') == 'Grum' and q[0][0]['there']['room']['label'] == 'Common room', "MOUSE the player's helper too", q)
            # ALT
            await gm.wait_for_timeout(700)
            async def alt():
                sx, sy = await at(20, 20, 0.1); await gm.keyboard.down('Alt'); await gm.mouse.click(sx, sy); await gm.keyboard.up('Alt'); await gm.wait_for_timeout(200)
            g, q = await told(alt)
            check(len(g[0]) == 1 and len(q[0]) == 1 and g[1] < 4 and q[0][0]['there'].get('room', {}).get('label') == 'Common room', 'ALT Alt/Option+click on a floor: both told, the room named', [g, q])
            # the other way: a player points, on the other transport
            await gm.wait_for_timeout(700)
            async def phold():
                sx, sy = await pl.evaluate('(() => { const s = tw.screenOf(7.5, 7.5, tw.main, 0.1); return [s.x, s.y]; })()')
                await pl.mouse.move(sx, sy); await pl.mouse.down(); await pl.wait_for_timeout(750); await pl.mouse.up(); await pl.wait_for_timeout(300)
            g, q = await told(phold)
            check(len(g[0]) == 1 and g[0][0]['by'] == 'Mira' and len(q[0]) == 1 and q[0][0]['by'] == 'Mira', "a player's hold, over her transport: both helpers told", [g, q])
            # TOUCH (the page's own touch path: a finger held still)
            await gm.wait_for_timeout(700)
            async def finger():
                sx, sy = await at(7.5, 7.5, 0.1)
                await gm.evaluate(f"""(async () => {{ const c = document.querySelector('#c'), o = {{ pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: {sx}, clientY: {sy}, bubbles: true, cancelable: true }}; c.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 750)); c.dispatchEvent(new PointerEvent('pointerup', {{ ...o, buttons: 0 }})); }})()""")
            g, q = await told(finger)
            check(len(g[0]) == 1 and len(q[0]) == 1, 'TOUCH a finger held still: both told', [g, q])
            # SHORT
            await gm.wait_for_timeout(700)
            async def short():
                sx, sy = await at(20, 20, 0.1); await gm.mouse.move(sx, sy); await gm.mouse.down(); await gm.wait_for_timeout(100); await gm.mouse.up()
                await gm.mouse.move(sx + 60, sy); await gm.mouse.down(); await gm.mouse.move(sx + 120, sy + 30, steps=6); await gm.wait_for_timeout(800); await gm.mouse.up()
            g, q = await told(short, secs=3)
            check(not g[0] and not q[0], 'SHORT a click and a dragged box tell nobody', [g, q])
            # SECRET
            await gm.wait_for_timeout(700)
            g, q = await told(lambda: hold(75, 15), secs=4)
            check(len(g[0]) == 1 and g[0][0]['there'].get('room', {}).get('hidden') is True and g[1] < 3.5, "SECRET a hold in a hidden room: the GM's helper hears it, room and all", g)
            check(not q[0] and q[1] > 3.5, "SECRET the player's helper hears nothing, and its wait runs its full length", q)
            await gm.context.close(); await pl.context.close()
        check(not errors, 'no page errors', errors[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"browser_helperpings: {len(results) - len(bad)}/{len(results)} passed"); return 1 if bad else 0

try: code = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for t in tmp: shutil.rmtree(t, ignore_errors=True)
sys.exit(code)
