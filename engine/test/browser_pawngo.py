#!/usr/bin/env python3
"""GETTING TO ANY PAWN FROM THE PAWNS MENU (Harry 2026-11-03, after a pawn of his went where no view showed it: "a bug
with landing weird on a misplaced ladder is ok... but can't get to the pawn is not ok"; "when you click a portrait in the
pawns you go to them (that should also cut you to their level)... but lets also let you drag that portrait onto the
board as if you had seized their token, so you can always grab and place them from the pawn menu"). GM tab + two
players. docs/UI.md "Getting to any pawn: the Pawns menu's portraits".

  python3 engine/test/browser_pawngo.py --local [--shots] [--only go,seize,player]
  TW_PORTS=a,b   free ports when another run holds the defaults

  The map (made here, by hand): a 10-ft hill; west of it, a cellar at lv -1 and, under that, a one-square crypt passage
  at lv -2. Mira's pawn stands at 0 ft on the cellar's top at the foot of the hill's bank (where Harry's went: no room
  of its own, under the bank), Tobias's in the cellar.
  GO      the GM on lv -2 clicks Mira's portrait: the view is cut to her level (lv 1), centred on her, and she is
          selected; from lv 1, Tobias's portrait takes the view DOWN to lv -1 (until 2026-11-03 it only ever went up)
  SEIZE   the GM drags Mira's portrait onto the passage at lv -2: she is under the pointer while held (the drag line's
          numbers say so), lands on the passage's floor at -20 ft (the floor that shows under the pointer), one
          token.move, one undo; no new pawn; Esc while it is held: nothing moves
  ROCK    (Harry: "Nope, dragging thru rock should push back onto legal space on the same level.") the GM drags a
          pawn with the real mouse along the passage at lv -2 and slips off it into the rock: while over rock it is held
          on the last passage square it crossed, at -20, and it ends in the passage where the pointer comes back; let go
          far out in rock with no floor near, it is put down on that last passage square; the arrow keys into the rock
          leave it where it is (and say so); dragged onto the passage's ladder it climbs it to the cellar
  PLAYER  Mira clicks her own portrait: her view is cut to her level; she drags her own portrait and her pawn moves
          (the GM sees it); Tobias's portrait cannot be seized by her (no seize, her drag moves nothing) and a click on
          it never takes her view to his level; a pawn the GM hid is in no player's menu or traffic
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # pawns snap to the squares in this suite (said here, not left to the default)
tw_sandbox.remove_campaigns()   # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only', default='go,seize,player,rock')
A = ap.parse_args(); ONLY = set(A.only.split(','))
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18479,18979').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pawngo-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)  # (the page is this checkout's, not a stale server's: test/served.py)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=90, pitch=60, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def at(pg, css):
    await pg.locator(css).first.scroll_into_view_if_needed(); await pg.wait_for_timeout(60)
    return await pg.evaluate(f"(() => {{ const r = document.querySelector({json.dumps(css)}).getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
async def shot(pg, name):
    os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS, f'pawngo-{name}.png'))
TOK = "((id) => { const e = tw.entities()[id]; return e ? { x: e.x, y: e.y || 0, z: e.z } : null; })"
MOVES = "tw.applied.filter(a => a[3] === 'token.move' || a[3] === 'batch').length"
async def open_p(pg):
    if not await pg.evaluate('tw.pawns.isOpen'): await pg.evaluate('tw.pawns.open()')
    await wait(pg, "!!document.querySelector('#pawnsTray .prow')", 5000, 'pawns menu open'); await pg.wait_for_timeout(200)
async def close_p(pg):
    if await pg.evaluate('tw.pawns.isOpen'): await pg.evaluate('tw.pawns.close()')
    await pg.wait_for_timeout(150)
# press on a portrait, move in steps to a screen point, let go there (or not): the real mouse; `mid(pg)` is asked while held
async def portrait_drag(pg, css, dst, mid=None, steps=14):
    src = await at(pg, css)
    await pg.mouse.move(src['x'], src['y']); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(src['x'] + (dst['x'] - src['x']) * i / steps, src['y'] + (dst['y'] - src['y']) * i / steps); await pg.wait_for_timeout(25)
    await pg.wait_for_timeout(200)
    held = await mid(pg) if mid else None
    await pg.mouse.up(); await pg.wait_for_timeout(500)
    return held

MI, TO, HID = 'tok_pgmira001', 'tok_pgtobi001', 'tok_pghide001'
async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.add_init_script("window.__rx = []; (() => { const ES = window.EventSource; if (!ES) return; window.EventSource = function (u, o) { const s = new ES(u, o); s.addEventListener('message', (m) => { try { window.__rx.push(m.data); } catch {} }); return s; }; window.EventSource.prototype = ES.prototype; })(); (() => { const WS = window.WebSocket; window.WebSocket = function (u, p) { const s = p ? new WS(u, p) : new WS(u); s.addEventListener('message', (m) => { try { window.__rx.push(String(m.data)); } catch {} }); return s; }; window.WebSocket.prototype = WS.prototype; Object.assign(window.WebSocket, WS); })();")
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST pawn go {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        async def idle(pg=None): await wait(pg or gm, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await (pg or gm).wait_for_timeout(350)
        players = {}
        for name in ('Mira', 'Tobias'):
            await gm.keyboard.press('/'); await gm.keyboard.type(f'invite {name}', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
            invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
            players[name] = await tab(invite + '&nofx')
            check(await wait(players[name], 'window.tw && tw.ready && tw.ready()', 45000), f'{name} joined')
        mi, to = players['Mira'], players['Tobias']
        S = {n: await pg.evaluate('tw.me()') for n, pg in players.items()}

        # the map: a hill (10 ft) on cells x 10..17; west of it a cellar at -10 (cells 8..9 x 1..3) and under that a passage
        # at -20 (cell 9, z -4..3). Furniture out: the test is about where the pawns stand.
        rooms = [await gm.evaluate("tw.spawnRoom('hill', 10, 0, 8, 8, 77, undefined, 10)")]; await idle()
        rooms.append(await gm.evaluate("tw.spawnRoom('cellar', 8, 1, 2, 3, 3, undefined, -10)")); await idle()
        rooms.append(await gm.evaluate("tw.spawnRoom('crypt-passage', 9, -4, 1, 8, 5, undefined, -20)")); await idle()
        for rid in rooms: await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{rid}').forEach(o => tw.dispatch('object.delete', {{ id: o.id }}))")
        await idle(); await gm.evaluate("tw.condButtons.hide('stair-offer')")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{MI}', name: 'Mira', x: 48.5, y: 0, z: 12.5, owner: '{S['Mira']}', fig: 'hero-fighter-dwarf-f', main: true }})")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{TO}', name: 'Elowen', x: 42.5, y: -10, z: 12.5, owner: '{S['Tobias']}', fig: 'hero-wizard-elf-f', main: true }})")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{HID}', name: 'Secret twin', x: 47.5, y: -20, z: -7.5, owner: '{S['Tobias']}', fig: 'hero-wizard-elf-f', hidden: true }})")
        await idle()
        b = await gm.evaluate(f"(() => {{ const e = tw.entities()['{MI}']; return {{ base: tw.pawnLevel(e), room: (window.HT || null) && null }}; }})()")
        check(b['base'] == 0, "Mira's pawn stands at 0 ft over the cellar's top, by the hill's bank (the shape of Harry's lost pawn)", b)
        await view(gm, 45, 5, 90, 58); await settle(gm)

        if 'go' in ONLY:
            print('GO: a portrait click goes to the pawn and cuts to its level')
            await gm.evaluate("tw.goLevel(-20, 'test')"); await gm.wait_for_timeout(300)
            hidden = await gm.evaluate(f"tw.cutHides(tw.entities()['{MI}'])")
            check(hidden, 'on lv -2 the cut hides Mira (her base is at 0)', hidden)
            await open_p(gm); await gm.click(f'#pawnsTray .prow[data-seat="{S["Mira"]}"] .pface'); await gm.wait_for_timeout(900)
            st = await gm.evaluate(f"({{ cut: tw.cut.y, level: tw.level, sel: [...tw.sel], hides: tw.cutHides(tw.entities()['{MI}']), focus: [tw.main.grab.focus.x, tw.main.grab.focus.z], go: tw.pawns.lastGo }})")
            check(st['cut'] == 9 and st['level'] == 0 and not st['hides'], "a click on her portrait cuts the view to her level, lv 1 (cut 9 ft), so she is drawn", st)
            check(st['sel'] == [MI] and abs(st['focus'][0] - 48.5) < 3 and abs(st['focus'][1] - 12.5) < 3, '...centres on her and selects her', st)
            if A.shots: await close_p(gm); await shot(gm, 'go-mira')
            await open_p(gm); await gm.click(f'#pawnsTray .prow[data-seat="{S["Tobias"]}"] .pface'); await gm.wait_for_timeout(900)
            st = await gm.evaluate(f"({{ cut: tw.cut.y, level: tw.level, sel: [...tw.sel], hides: tw.cutHides(tw.entities()['{TO}']) }})")
            check(st['level'] == -10 and st['cut'] is not None and st['cut'] < 0 and not st['hides'] and st['sel'] == [TO], "from lv 1, Elowen's portrait takes the view DOWN to the cellar's level (lv -1) and selects her", st)
            await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(200)
            await open_p(gm); await gm.click(f'#pawnsTray .prow[data-seat="{S["Mira"]}"] .pface'); await gm.wait_for_timeout(900)
            st = await gm.evaluate("({ cut: tw.cut.y, level: tw.level })")
            check(st['cut'] == 9 and st['level'] == 0, 'from all levels too: the click cuts to her level', st)
            await close_p(gm)

        if 'seize' in ONLY:
            print('SEIZE: drag a portrait onto the board')
            await gm.evaluate("tw.goLevel(-20, 'test')"); await gm.evaluate("tw.clearSelection()"); await view(gm, 47, -5, 70, 62, 0, -20); await gm.wait_for_timeout(600)
            await open_p(gm)
            cls = await gm.evaluate(f"document.querySelector('#pawnsTray .prow[data-seat=\"{S['Mira']}\"] .pface').classList.contains('seize')")
            check(cls, "the GM's portraits of pawns in this area can be seized (they carry the grab cursor; a finger drags them)", cls)
            n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length"); m0 = await gm.evaluate(MOVES); was = await gm.evaluate(TOK + f"('{MI}')")
            dst = await scr(gm, 47.5, -12.5, -20)
            async def mid(pg): return await pg.evaluate(f"({{ d: tw.localDrags.get('{MI}') || null, pawns: tw.moveDrag?.pawns || null, out: document.getElementById('pawnsTray').classList.contains('out') }})")
            held = await portrait_drag(gm, f'#pawnsTray .prow[data-seat="{S["Mira"]}"] .pface', dst, mid); await idle()
            d = held and held['d']
            check(d and abs(d['x'] - 47.5) < 1.5 and abs(d['z'] + 12.5) < 1.5 and abs(d.get('y', 99) + 20) < 0.6, 'while held she is under the pointer, on the passage floor that shows there (-20 ft), not walked on her own level', held)
            check(held and held['pawns'] and held['pawns']['lead'] == MI and held['pawns']['y0'] == 0, '...it is an ordinary pawn drag: the drag line and the movement rings run from where she stood (0 ft)', held and held['pawns'])
            check(held and held['out'], '...and the menu stepped aside for the drag', held)
            t = await gm.evaluate(TOK + f"('{MI}')"); n1 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'token').length"); m1 = await gm.evaluate(MOVES)
            check(t and abs(t['x'] - 47.5) < 1 and abs(t['z'] + 12.5) < 1 and t['y'] == -20, 'let go there, she stands in the passage at -20 ft', t)
            check(n1 == n0 and m1 - m0 == 1, 'it is the pawn itself (no new pawn) in one move command', [n0, n1, m1 - m0])
            await wait(mi, f"(tw.entities()['{MI}']?.y || 0) === -20", 8000, 'Mira sees her pawn move')
            check(await mi.evaluate(f"(tw.entities()['{MI}']?.y || 0) === -20"), "Mira's own tab has her pawn in the passage")
            if A.shots: await close_p(gm); await shot(gm, 'seized')
            await gm.keyboard.press('Escape'); await gm.mouse.click(700, 450); await gm.wait_for_timeout(200)
            await gm.keyboard.press('Control+z'); await idle()
            t = await gm.evaluate(TOK + f"('{MI}')")
            check(t == was, 'one undo puts her back where she was', [t, was])
            # Esc while it is in the hand: nothing moved
            await open_p(gm); m0 = await gm.evaluate(MOVES)
            async def esc(pg): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150); return await pg.evaluate(f"!!tw.localDrags.get('{MI}')")
            still = await portrait_drag(gm, f'#pawnsTray .prow[data-seat="{S["Mira"]}"] .pface', dst, esc); await idle()
            check(not still and await gm.evaluate(TOK + f"('{MI}')") == was and await gm.evaluate(MOVES) == m0, 'Esc while she is in the hand: she is back where she stood and nothing was sent', [still, await gm.evaluate(TOK + f"('{MI}')")])
            await close_p(gm)

        if 'rock' in ONLY:
            print('ROCK: a drag through the rock below the ground stays on its level')
            RK = 'tok_pgrock001'
            await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{RK}', name: 'Delver', x: 47.5, y: -20, z: -17.5, fig: 'hero-fighter-dwarf-f' }})")
            # a ladder in the passage at its square z 1 (cell 9, 1), climbed toward +x, its foot west in the rock, its top in the cellar
            await gm.evaluate("(() => { const sz = tw.roomgen.sizeOf('ladder-wood'); tw.dispatch('object.place', { id: 'obj_pglad01', name: 'ladder wood', cat: 'ladder-wood', sku: sz.sku, url: sz.url, place: 'wall', layer: 'furnish', x: 47.5, y: -20, z: 7.5, rot: 3 * Math.PI / 2, dims: sz.dims, s: sz.s || undefined, yaw: sz.yaw, room: '" + rooms[2] + "' }); })()"); await idle()
            await gm.evaluate("tw.goLevel(-20, 'test')"); await gm.evaluate("tw.clearSelection()"); await view(gm, 45, -5, 75, 70, 0, -20); await settle(gm); await gm.wait_for_timeout(500)
            async def rdrag(pts, mid_at=None, steps=10):
                ps = [await scr(gm, x, z, -20) for x, z in pts]; seen = []
                await gm.mouse.move(ps[0]['x'], ps[0]['y']); await gm.mouse.down()
                for k in range(len(ps) - 1):
                    for i in range(1, steps + 1): await gm.mouse.move(ps[k]['x'] + (ps[k + 1]['x'] - ps[k]['x']) * i / steps, ps[k]['y'] + (ps[k + 1]['y'] - ps[k]['y']) * i / steps); await gm.wait_for_timeout(20)
                    await gm.wait_for_timeout(120)
                    seen.append(await gm.evaluate(f"({{ d: tw.localDrags.get('{RK}') || null, rock: !!tw.moveDrag?.pawns?.rock }})"))
                await gm.mouse.up(); await gm.wait_for_timeout(450); await idle()
                return seen
            seen = await rdrag([(47.5, -17.5), (37.5, -7.5), (47.5, 2.5)])
            t = await gm.evaluate(TOK + f"('{RK}')")
            over = seen[0]
            check(over['rock'] and over['d'] and 45 <= over['d']['x'] <= 50 and over['d'].get('y') == -20, 'over the rock beside the passage it is held on the passage at -20 (shown there, the pointer away in the rock)', over)
            check(t and t['y'] == -20 and abs(t['x'] - 47.5) < 2.6 and abs(t['z'] - 2.5) < 2.6, 'back over the passage it follows the pointer again and is let go there, at -20 (on dev it came up to 0 ft for good)', t)
            seen = await rdrag([(47.5, 2.5), (47.5, -7.5), (95, -7.5)])
            t = await gm.evaluate(TOK + f"('{RK}')")
            check(seen[-1]['rock'] and t and t['y'] == -20 and 45 <= t['x'] <= 50 and -20 <= t['z'] <= 15, 'let go far out in the rock, no floor of lv -2 near: it is put down on the last passage square it crossed, at -20', t)
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{RK}', x: 47.5, z: -12.5, y: -20 }})"); await idle()
            await gm.evaluate(f"tw.select('{RK}')"); await gm.wait_for_timeout(100)
            m0 = await gm.evaluate(MOVES); toast0 = await gm.evaluate("document.body.innerText.includes('Solid rock')")
            await gm.evaluate("tw.nudge(5, 0)"); await idle()
            t = await gm.evaluate(TOK + f"('{RK}')"); toast = await gm.evaluate("document.body.innerText.includes('Solid rock')")
            check(t == {'x': 47.5, 'y': -20, 'z': -12.5} and await gm.evaluate(MOVES) == m0 and toast and not toast0, 'an arrow key into the rock leaves it where it is, and says so (nothing sent)', [t, toast])
            await gm.evaluate("tw.clearSelection()")
            await rdrag([(47.5, -12.5), (47.5, -2.5), (47.5, 7.5)])
            t = await gm.evaluate(TOK + f"('{RK}')")
            check(t and t['y'] == -10 and abs(t['x'] - 42.5) < 0.6 and abs(t['z'] - 7.5) < 0.6, 'dragged along the passage onto its ladder, it climbs it: into the cellar at -10, beside the hole', t)
            await gm.evaluate("tw.setCut(null, { by: 'test' })")

        if 'player' in ONLY:
            print('PLAYER: own portrait, someone else\'s, what a player is sent')
            await mi.evaluate("tw.goLevel(-20, 'test')"); await mi.wait_for_timeout(200)
            await open_p(mi); await mi.click(f'#pawnsTray .prow[data-seat="{S["Mira"]}"] .pface'); await mi.wait_for_timeout(900)
            st = await mi.evaluate(f"({{ cut: tw.cut.y, level: tw.level, sel: [...tw.sel] }})")
            check(st['cut'] == 9 and st['level'] == 0 and st['sel'] == [MI], 'Mira clicks her own portrait: her view is cut to her level and her pawn selected', st)
            seize_other = await mi.evaluate(f"(() => {{ const el = document.querySelector('#pawnsTray .prow[data-seat=\"{S['Tobias']}\"] .pface'); return el ? el.classList.contains('seize') : null; }})()")
            check(seize_other is False, "Elowen's portrait (Tobias's) is not seizable for Mira", seize_other)
            m0 = await mi.evaluate(MOVES); was = await mi.evaluate(TOK + f"('{TO}')")
            await view(mi, 45, 10, 80, 60)
            await portrait_drag(mi, f'#pawnsTray .prow[data-seat="{S["Tobias"]}"] .pface', await scr(mi, 52.5, 22.5, 10)); await idle(mi)
            check(await mi.evaluate(TOK + f"('{TO}')") == was and await mi.evaluate(MOVES) == m0, "dragging Elowen's portrait onto the map moves nothing for Mira", await mi.evaluate(TOK + f"('{TO}')"))
            await open_p(mi); await mi.click(f'#pawnsTray .prow[data-seat="{S["Tobias"]}"] .pface'); await mi.wait_for_timeout(900)
            st = await mi.evaluate("({ cut: tw.cut.y, level: tw.level })")
            check(st['level'] == 0 and st['cut'] == 9, "a click on Elowen's portrait never takes Mira's view down to Elowen's level (lv -1)", st)
            await open_p(mi)
            dst = await scr(mi, 52.5, 22.5, 10)
            await portrait_drag(mi, f'#pawnsTray .prow[data-seat="{S["Mira"]}"] .pface', dst); await idle(mi)
            t = await mi.evaluate(TOK + f"('{MI}')")
            check(t and abs(t['x'] - 52.5) < 1 and abs(t['z'] - 22.5) < 1 and t['y'] == 10, 'Mira drags her own portrait onto the hilltop: her pawn stands there (10 ft)', t)
            await wait(gm, f"(tw.entities()['{MI}']?.y || 0) === 10", 8000, 'the GM sees it')
            check(await gm.evaluate(f"(tw.entities()['{MI}']?.y || 0) === 10"), 'the GM sees it there')
            await mi.wait_for_timeout(500)
            leak = {n: await pg.evaluate(f"window.__rx.some(t => t.includes('{HID}') || t.includes('Secret twin'))") for n, pg in players.items()}
            dom = {n: await pg.evaluate("document.body.innerText.includes('Secret twin')") for n, pg in players.items()}
            ents = {n: await pg.evaluate(f"!!tw.entities()['{HID}']") for n, pg in players.items()}
            check(not any(leak.values()) and not any(dom.values()) and not any(ents.values()), 'the pawn the GM hid is in no player\'s traffic, page or state (its owner\'s included)', [leak, dom, ents])
            await open_p(gm)
            check(await gm.evaluate("document.body.innerText.includes('Secret twin') || !!tw.entities()['" + HID + "']"), 'the GM has it')
            await close_p(gm)

        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"pawngo: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
