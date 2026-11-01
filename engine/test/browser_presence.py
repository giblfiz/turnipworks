#!/usr/bin/env python3
"""Who is at the table (2026-10-28; docs/NETCODE.md "Ghost connections", "Disconnect"; client/surfaces/roster.js).
Harry: "if you click on one of those, it should take you to their primary pawn. And we also really need some way to
force disconnect people, because I noticed that we're just building up a collection of dead connections".

  CLICK   GM clicks a player's avatar: the view centres on their main pawn; one in another area: the GM goes there.
          A player: one in another area is a toast; one under their fog of war is a toast and the view does not move.
          A seat with no pawn on a table: a toast. Hover: name + "Click: go to their pawn".
  KICK    GM right-click: Disconnect (worded as not a ban) -> that tab gets "The GM disconnected you" with Rejoin,
          leaves the GM's roster, does not come back by itself; Rejoin brings it back. A player has no such menu, and
          a raw kick from a player is refused by the relay.
  GHOST   a whole browser frozen with SIGSTOP (a phone asleep): the relay reaps it within its timeout and its avatar
          leaves the GM's roster; SIGCONT: it reconnects by itself.

  browser-venv/bin/python engine/test/browser_presence.py --local          (own relay with TW_REAP_MS=6000)
  ... --page https://dev.turnipworks.net/ --reap 90                         (dev: the real 90 s timeout)
"""
import argparse, asyncio, json, os, shutil, signal, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--reap', type=float, default=6.0, help='the relay\'s reap timeout in seconds (local: what we start it with)'); ap.add_argument('--only')
A = ap.parse_args()
ONLY = set((A.only or '').upper().split(',')) - {''}
def want(sec): return not ONLY or sec in ONLY
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18361,18961').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-presence-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': '', 'TW_REAP_MS': str(int(A.reap * 1000))}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

def descendants(root):
    """every process under `root` (by /proc ppid), so a SIGSTOP reaches only the browser this suite launched"""
    kids = {}
    for d in os.listdir('/proc'):
        if not d.isdigit(): continue
        try:
            with open(f'/proc/{d}/stat') as f: ppid = int(f.read().rsplit(')', 1)[1].split()[1])
            kids.setdefault(ppid, []).append(int(d))
        except Exception: pass
    out, todo = [], [root]
    while todo:
        p = todo.pop()
        for c in kids.get(p, []): out.append(c); todo.append(c)
    return out
def browser_pids():
    out = []
    for pid in descendants(os.getpid()):
        try:
            with open(f'/proc/{pid}/cmdline', 'rb') as f: cmd = f.read().split(b'\0')
            if any(b'chrom' in c.lower() for c in cmd[:1]): out.append(pid)
        except Exception: pass
    return set(out)

E = lambda i: f"tw.entities()['{i}']"
FOCUS_D = lambda i: f"(() => {{ const e = tw.entities()['{i}'], f = tw.main.grab.focus; return e ? Math.hypot(f.x - e.x, f.z - e.z) : null; }})()"
AV = lambda seat: f"#roster .av[data-seat=\"{seat}\"]"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        flags = ['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
        browser = await p.chromium.launch(headless=not A.headed, args=flags)
        errors = []
        async def tab(url, b=browser, w=1300, h=850):
            ctx = await b.new_context(viewport={'width': w, 'height': h})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: (errors.append(f'pageerror: {e}'), print(f'    PAGEERROR {e}', flush=True)))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST presence {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live')
        check(await gm.evaluate('tw.sync.campaign.defaults.fogOfWar === true && tw.sync.campaign.defaults.sharedPartyVision === false'), 'a new campaign: fog of war on, shared sight off')
        A1 = await gm.evaluate('tw.area()')
        await gm.evaluate("tw.sync.submit('area.create', { id: 'area_road000001', name: 'The Road' })"); await wait(gm, "tw.sync.campaign.areas.length === 2", 8000, 'second area')
        A2 = 'area_road000001'
        links = {}
        for name in ('Mira', 'Tony', 'Kit'):
            links[name] = await gm.evaluate(f"async () => tw.inviteLink(await tw.createSeat({{kind:'human',role:'player',name:'{name}',color:'#67aadd'}}))")
        # Tony in a browser of his own: the one frozen in GHOST
        frozen_before = browser_pids()
        browser2 = await p.chromium.launch(headless=not A.headed, args=flags)
        tony_pids = browser_pids() - frozen_before
        mi = await tab(links['Mira'] + '&nofx'); kit = await tab(links['Kit'] + '&nofx'); to = await tab(links['Tony'] + '&nofx', b=browser2)
        for n, pg in (('Mira', mi), ('Kit', kit), ('Tony', to)): check(await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000, n), f'{n} joins')
        S = {n: await pg.evaluate('tw.me()') for n, pg in (('Harry', gm), ('Mira', mi), ('Kit', kit), ('Tony', to))}
        # Mira's pawn in a room; Tony's far off across open ground (out of her sight: fog on, sight not shared); Kit's on The Road
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 6, 4242)")
        await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room') && tw.sync.pendingCount() === 0", 30000, 'room')
        BR, TO, KI = 'tok_brakka0001', 'tok_tony000001', 'tok_kit0000001'
        await gm.evaluate(f"""tw.batch([{{type:'token.create', args:{{id:'{BR}', name:'Brakka', x:12.5, z:12.5, owner:'{S['Mira']}', main:true}}}},
            {{type:'token.create', args:{{id:'{TO}', name:'Bard', x:212.5, z:212.5, owner:'{S['Tony']}', main:true}}}},
            {{type:'token.create', args:{{id:'{KI}', name:'Scout', x:22.5, z:12.5, owner:'{S['Kit']}', main:true}}}}])""")
        await wait(gm, f"{E(KI)} && tw.sync.pendingCount() === 0", 10000, 'pawns')
        await gm.evaluate(f"tw.sync.submit('transfer', {{ id: '{KI}', from: '{A1}', to: '{A2}', x: 7.5, z: 7.5 }})")
        await wait(gm, f"!{E(KI)} && tw.sync.campaign.party.pawns.some(p => p.id === '{KI}' && p.area === '{A2}')", 10000, 'Kit on the road')
        await wait(gm, "tw.sync.campaign.party.pawns.length === 3", 15000, 'party (GM)')
        for pg in (gm, mi, kit, to): await wait(pg, "tw.sync.campaign.party.pawns.length >= 2 && tw.sync.campaign.seats.filter(s => s.online).length === 4", 15000, 'party and roster')
        for pg in (gm, mi): await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(60, 0, 60); g.update(); tw.main.rule = 'free'; })()")

        # ---------------- CLICK ----------------
        if want('CLICK'):
            n = await gm.evaluate("document.querySelectorAll('#roster .av').length")
            check(n == 4, 'the GM\'s roster: one avatar per seat at the table (Harry, Mira, Tony, Kit)', n)
            await gm.hover(AV(S['Mira'])); tip = await gm.evaluate(f"document.querySelector('{AV(S['Mira'])}').title")
            check(tip.startswith('Mira') and 'Click: go to their pawn (Brakka)' in tip and 'Right-click: disconnect (not a ban' in tip, 'hover: her name and "Click: go to their pawn"; for the GM, how to disconnect', tip.replace('\n', ' | '))
            await gm.click(AV(S['Mira'])); await gm.wait_for_timeout(700)
            d = await gm.evaluate(FOCUS_D(BR)); last = await gm.evaluate('tw.roster.last')
            check(d is not None and d < 1.5 and last['kind'] == 'pawn' and last['id'] == BR, 'GM clicks Mira: the view centres on Brakka', f'{d} {last}')
            check(await gm.evaluate(f"tw.sel.has('{BR}')"), 'and Brakka is selected')
            await gm.click(AV(S['Kit']))
            ok = await wait(gm, f"tw.area() === '{A2}' && !!{E(KI)}", 15000, 'gm to the road'); await gm.wait_for_timeout(700)
            d = await gm.evaluate(FOCUS_D(KI))
            check(ok and d is not None and d < 1.5, "GM clicks Kit: his pawn is in The Road, the GM goes there and centres on it", d)
            await gm.evaluate(f"tw.setMain('{A1}')"); await wait(gm, f"tw.area() === '{A1}' && !!{E(BR)}", 15000)
            # a player
            await wait(mi, f"!!{E(TO)} && !!{E(BR)} && tw.fog.visible(12.5, 12.5, 0, '{A1}')", 15000, 'Mira sees her own pawn')
            fog = await mi.evaluate(f"[tw.fog.active('{A1}'), tw.fog.visible(212.5, 212.5, 0, '{A1}')]")
            check(fog[0] and not fog[1], "precondition: fog is on for Mira and Tony's pawn is outside her sight", fog)
            await mi.evaluate("(() => { const g = tw.main.grab; g.focus.set(60, 0, 60); g.update(); })()")
            await mi.click(AV(S['Tony'])); await mi.wait_for_timeout(500)
            st = await mi.evaluate("({ last: tw.roster.last, toast: document.querySelector('#toast').textContent, f: [tw.main.grab.focus.x, tw.main.grab.focus.z] })")
            check(st['last'].get('why') and "can't see Bard" in st['toast'] and abs(st['f'][0] - 60) < 0.5, "Mira clicks Tony: his pawn is under her fog of war: a toast, and her view does not move", st)
            await mi.click(AV(S['Kit'])); await mi.wait_for_timeout(500)
            st = await mi.evaluate("({ last: tw.roster.last, toast: document.querySelector('#toast').textContent, area: tw.area() })")
            check(st['area'] == A1 and 'no pawn on a table' in st['toast'] and 'Road' not in st['toast'] and 'Scout' not in st['toast'], "Mira clicks Kit while The Road is hidden from players: \"no pawn on a table\" (neither the pawn nor the area is named)", st)
            await gm.evaluate(f"tw.sync.submit('area.visibility', {{ area: '{A2}', visibility: 'open' }})")
            await wait(mi, f"tw.sync.campaign.party.pawns.some(p => p.id === '{KI}')", 10000, 'the road opened')
            await mi.click(AV(S['Kit'])); await mi.wait_for_timeout(500)
            st = await mi.evaluate("({ last: tw.roster.last, toast: document.querySelector('#toast').textContent, area: tw.area() })")
            check(st['area'] == A1 and 'Scout' in st['toast'] and 'The Road' in st['toast'], "The Road opened: Mira clicks Kit: his pawn is in another area: a toast says where, she stays", st)
            await mi.click(AV(S['Mira'])); await mi.wait_for_timeout(700)
            d = await mi.evaluate(FOCUS_D(BR))
            check(d is not None and d < 1.5, 'Mira clicks herself: her view centres on Brakka', d)
            await mi.click(AV(S['Harry'])); await mi.wait_for_timeout(400)
            st = await mi.evaluate("({ last: tw.roster.last, toast: document.querySelector('#toast').textContent })")
            check(st['last'].get('kind') == 'cursor' or 'no pawn on a table' in st['toast'], 'Mira clicks the GM (no pawn): their cursor, or a toast saying they have no pawn', st)
            # a pawn hidden from players is not even sent: the toast says "no pawn", and no position leaks
            await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{TO}'], hidden: true }}, '{A1}')")
            await wait(mi, f"!{E(TO)}", 10000, 'hidden from Mira')
            r = await mi.evaluate(f"tw.roster.target('{S['Tony']}')")
            check(r['kind'] != 'pawn' and r['id'] is None, 'a pawn hidden from players: a player\'s click has no pawn to go to', r)
            await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{TO}'], hidden: false }}, '{A1}')")

        # ---------------- KICK ----------------
        if want('KICK'):
            # a player: no menu, and the relay refuses a raw kick
            await mi.click(AV(S['Kit']), button='right'); await mi.wait_for_timeout(300)
            check(await mi.evaluate("!document.querySelector('.rosterpop')"), 'a player right-clicking an avatar gets no disconnect menu')
            await mi.evaluate(f"tw.sync.kick('{S['Kit']}')"); await wait(mi, 'tw.lastKick', 5000, 'refusal')
            lk = await mi.evaluate('tw.lastKick')
            check(lk and lk['ok'] is False and 'only the GM' in lk['why'], 'a player\'s kick is refused by the relay', lk)
            await mi.evaluate(f"tw.sync.kick('{S['Harry']}')"); await mi.wait_for_timeout(600)
            check(await gm.evaluate("tw.sync.status === 'live'") and await kit.evaluate("tw.sync.status === 'live'"), 'nobody was disconnected (the GM can never be)')
            # the GM
            await gm.click(AV(S['Kit']), button='right')
            ok = await wait(gm, "!!document.querySelector('.rosterpop [data-act=kick]')", 4000, 'menu')
            txt = await gm.evaluate("document.querySelector('.rosterpop')?.innerText || ''")
            check(ok and 'Disconnect Kit' in txt and 'Not a ban' in txt and 'rejoin' in txt and 'Revoke their link' in txt, 'GM right-clicks Kit: a menu with "Disconnect Kit", worded as not a ban, and the way to revoke the link', txt.replace('\n', ' | '))
            t0 = time.time()
            await gm.click('.rosterpop [data-act=kick]')
            ok = await wait(kit, "tw.sync.status === 'kicked' && tw.kickedShown()", 5000, 'kit kicked')
            card = await kit.evaluate("document.getElementById('twKicked')?.innerText || ''")
            check(ok and 'disconnected you' in card and 'not a ban' in card and 'Rejoin' in card, "Kit's tab: \"The GM disconnected you\", not a ban, a Rejoin button", card.replace('\n', ' | '))
            gone = await wait(gm, f"!document.querySelector('{AV(S['Kit'])}')", 5000, 'kit avatar gone')
            check(gone, f"Kit's avatar leaves the GM's roster ({time.time() - t0:.1f} s)")
            check('Disconnected Kit' in await gm.evaluate("document.querySelector('#toast').textContent"), 'the GM is told, in a toast')
            await kit.wait_for_timeout(2500)
            check(await kit.evaluate("tw.sync.status === 'kicked'") and await gm.evaluate(f"!tw.sync.campaign.seats.find(s => s.id === '{S['Kit']}').online"), 'Kit does not reconnect by himself')
            await kit.click('#twKicked .twkRejoin')
            ok = await wait(kit, "tw.sync.status === 'live' && !tw.kickedShown()", 10000, 'rejoin')
            back = await wait(gm, f"!!document.querySelector('{AV(S['Kit'])}')", 6000, 'kit back on the roster')
            check(ok and back, 'Rejoin: Kit is back on the same link, and on the GM\'s roster')
            check(await wait(kit, "!!tw.sync.view(tw.area()) && tw.sync.campaign.seats.filter(s => s.online).length === 4", 10000, 'kit table'), 'and his table came back with him (his area loaded, everyone online)')

        # ---------------- GHOST ----------------
        if want('GHOST'):
            check(len(tony_pids) >= 2, 'Tony\'s browser processes found (only those are frozen)', len(tony_pids))
            check(await gm.evaluate(f"!!document.querySelector('{AV(S['Tony'])}')"), 'Tony is on the GM\'s roster')
            for pid in tony_pids:
                try: os.kill(pid, signal.SIGSTOP)
                except ProcessLookupError: pass
            t0 = time.time()
            limit = A.reap + 2 + 2 + 3  # the timeout, one reaper tick (<= reap/3, at most 15 s), the roster's 2 s redraw, slack
            if A.reap > 30: limit = A.reap + 15 + 2 + 5
            gone = await wait(gm, f"!document.querySelector('{AV(S['Tony'])}')", int(limit * 1000) + 5000, 'ghost reaped')
            took = time.time() - t0
            # (locally the reaper is what closes it; through Cloudflare the edge often drops a frozen stream first: 32 s,
            # 73 s on dev 2026-10-28. Either way it must be gone by the reaper's limit)
            check(gone and (A.reap * 0.8 <= took if A.local else True) and took <= limit, f"Tony's whole browser frozen (a phone asleep): his avatar leaves the GM's roster in {took:.1f} s (timeout {A.reap:g} s)")
            for pid in tony_pids:
                try: os.kill(pid, signal.SIGCONT)
                except ProcessLookupError: pass
            # (through Cloudflare a thawed browser's new stream waits ~30 s on its pooled HTTP/2 connection to the edge,
            # which it has not yet noticed is dead; the client's watchdog shows "reconnecting" meanwhile, not a false "live")
            back = await wait(gm, f"!!document.querySelector('{AV(S['Tony'])}')", 20000 if A.local else 60000, 'tony back')
            check(back and await to.evaluate("tw.sync.status === 'live'"), 'thawed: Tony reconnects by himself and is back on the roster')

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser2.close(); await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    time.sleep(0.3)
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nbrowser_presence: {len(results) - len(bad)}/{len(results)} passed", flush=True)
sys.exit(1 if bad else 0)
