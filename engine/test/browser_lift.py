#!/usr/bin/env python3
"""Raise / lower regression (Harry 2026-10-05: "raise is now dropping everything instantly back to the floor. Can't
levitate stuff and also can't place it on tables"). Real pointer gestures on the ring's Raise / lower drag button.

  A thing raised to about 4 ft stays there; a thing raised to just above a table rests on the table top; a pawn raised
  (5 ft or more: under 5 it settles, browser_lift_hard HOVER) flies. Each is checked in the GM's tab (state AND what is drawn), in a second tab, and again after a reload.

  local:  TW_GPU=1 python3 engine/test/browser_lift.py --local
  live:   ... browser_lift.py --page https://turnipworks.net/
Live runs make one campaign named "TEST lift (throwaway)".
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits

GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

def start_local():
    import socket
    for port in (18097, 18722):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-lift-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': '18097', 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', '18722', '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen('http://127.0.0.1:18097/health', timeout=1); urllib.request.urlopen('http://127.0.0.1:18722/engine/client/index.html', timeout=1); break
        except Exception: pass
    return 'http://127.0.0.1:18722/engine/client/index.html?relay=' + urllib.parse.quote('http://127.0.0.1:18097') + '&api=&nointro'

# what the state says and what is drawn, for one thing
SEEN = "((id) => { const e = tw.entities()[id], r = tw.worldOf(tw.area()).recs.get(id); return e && r ? { y: e.y || 0, drawn: +r.group.position.y.toFixed(2), parent: e.parent || null } : null; })"

async def main():
    page = start_local() if A.local else (A.page or 'http://127.0.0.1:8180/') + ('&' if '?' in (A.page or '') else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, permissions=['clipboard-read', 'clipboard-write'])
            pg = await ctx.new_page(); await pg.goto(url); return pg
        async def ready(pg, t=45000):
            try: await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=t); return True
            except Exception: return False
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill('TEST lift (throwaway)')
        await gm.click('#newCampaign button')
        check(await ready(gm), 'GM tab live')
        # a kitchen (tables with things on them, things on the floor) and a pawn
        ids = await gm.evaluate("""async () => {
          const rid = 'room_lift' + Math.random().toString(36).slice(2, 8), a = { id: rid, type: 'kitchen', x: 0, z: 0, w: 6, d: 5, seed: 77 };
          await tw.dispatch('room.spawn', { ...a, engineVersion: tw.roomgen.version, layout: tw.roomgen.solve(tw.entities(), a, 1) });
          const tok = 'tok_lift' + Math.random().toString(36).slice(2, 8); await tw.dispatch('token.create', { id: tok, name: 'Brakka', x: 40, z: 12 });
          await new Promise(r => setTimeout(r, 9000));
          const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === rid), riders = (t) => es.filter(c => c.parent === t.id);
          const table = es.filter(e => riders(e).length && e.dims[1] > 2 && e.dims[1] < 4 && e.dims[0] > 3).sort((p, q) => riders(p).length - riders(q).length)[0];
          const floor = es.find(e => e.place === 'floor' && !e.parent && !e.flat && e.dims[1] < 3 && !riders(e).length);
          const small = es.find(e => e.place === 'floor' && !e.parent && !e.flat && e.dims[1] < 2.5 && e.dims[0] < 2.5 && e.id !== floor.id && !riders(e).length) || floor;
          return { tok, floor: floor.id, table: table.id, tableTop: table.dims[1], tableAt: [table.x, table.z], small: small.id }; }""")
        async def invite():
            await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await gm.wait_for_function("!document.querySelector('#output').hidden", timeout=10000)
            link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); return link
        pl = await tab((await invite()) + '&nofx')
        check(await ready(pl), 'second tab joined')

        async def raise_by_ring(pg, id, to_y):
            """the real gesture: select, open the ring's menu, press the Raise / lower drag button and drag up"""
            await pg.evaluate(f"(() => {{ const e = tw.entities()['{id}'], g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 52; g.dist = 95; g.update(); tw.main.rule = 'free'; tw.select('{id}'); }})()")  # (the ring is world-sized since 2026-10-20: framed so it is on screen, clear of the top bar)
            await pg.wait_for_timeout(700)
            await pg.click('#ring [data-menu]'); await pg.wait_for_timeout(850)  # (☰ slides the buttons along the oval: ~520 ms + stagger)
            grp = await pg.query_selector('#ring .rbtn.grp[data-group="edit"]')  # (the grouped menu of 2026-10-05; a flat menu has the button at the top level)
            if grp: await grp.click(); await pg.wait_for_timeout(250)
            b = await pg.evaluate("(() => { const el = document.querySelector('[data-cmd=\"edit.lift\"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
            if not b: return None
            y0 = await pg.evaluate(f"tw.entities()['{id}'].y || 0")
            ppf = await pg.evaluate(f"(() => {{ const e = tw.entities()['{id}']; return Math.max(4, Math.abs(tw.screenOf(e.x, e.z, tw.main, e.y || 0).y - tw.screenOf(e.x, e.z, tw.main, (e.y || 0) + 1).y)); }})()")
            dy = (to_y - y0) * ppf
            await pg.mouse.move(b['x'], b['y']); await pg.mouse.down()
            mid = None
            for i in range(1, 11):
                await pg.mouse.move(b['x'] + (3 if i % 2 else -3), b['y'] - dy * i / 10); await pg.wait_for_timeout(30)  # a hand wobbles sideways
            mid = await pg.evaluate(SEEN + f"('{id}')")
            await pg.mouse.up(); await pg.wait_for_timeout(1500)
            await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
            return mid

        async def everywhere(id, want, what, parent=None, tol=0.35):
            a = await gm.evaluate(SEEN + f"('{id}')")
            ok = lambda s: s and abs(s['y'] - want) < tol and abs(s['drawn'] - want) < tol and (parent is None or s['parent'] == parent)
            check(ok(a), f'{what}: stays in the GM tab (state and drawn)', a)
            try: await pl.wait_for_function(f"Math.abs(((tw.entities()['{id}'] || {{}}).y || 0) - {want}) < {tol}", timeout=8000)
            except Exception: pass
            b = await pl.evaluate(SEEN + f"('{id}')"); check(ok(b), f'{what}: the second tab sees it', b)
            await gm.wait_for_timeout(2500)
            c = await gm.evaluate(SEEN + f"('{id}')"); check(ok(c), f'{what}: still there 2.5 s later (nothing pulls it down)', c)

        print('RAISE: a thing to 4 ft')
        mid = await raise_by_ring(gm, ids['floor'], 4)
        check(mid and mid['drawn'] > 3, 'while dragging, the thing rides up with the pointer', mid)
        await everywhere(ids['floor'], 4, 'a floor thing raised to 4 ft')

        print('RAISE: onto a table')
        top = ids['tableTop']
        await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{ids['small']}', x: {ids['tableAt'][0]}, z: {ids['tableAt'][1]}, y: 0, parent: '' }})"); await gm.wait_for_timeout(600)
        await raise_by_ring(gm, ids['small'], top + 0.8)  # released within reach above the top: it lands on it
        s = await gm.evaluate(SEEN + f"('{ids['small']}')")
        check(s and s['parent'] == ids['table'] and abs(s['y'] - top) < 0.6, 'a thing raised to just above a table rests on the table top (parent = the table)', {**(s or {}), 'top': top})
        await everywhere(ids['small'], s['y'] if s else top, 'the thing on the table', parent=ids['table'])

        print('RAISE: a pawn')
        await raise_by_ring(gm, ids['tok'], 7)  # (7, not 3: since 2026-10-19 a pawn under 5 ft above its base settles there, browser_lift_hard HOVER)
        await everywhere(ids['tok'], 7, 'a pawn raised to 7 ft')

        print('RELOAD: all three survive')
        before = {k: await gm.evaluate(SEEN + f"('{ids[k]}')") for k in ('floor', 'small', 'tok')}
        await gm.reload()
        check(await ready(gm), 'GM tab back after a reload')
        await gm.wait_for_timeout(6000)
        for k, what in (('floor', 'the raised thing'), ('small', 'the thing on the table'), ('tok', 'the flying pawn')):
            a = await gm.evaluate(SEEN + f"('{ids[k]}')"); b = before[k]
            check(a and b and abs(a['y'] - b['y']) < 0.05 and abs(a['drawn'] - b['y']) < 0.4 and a['parent'] == b['parent'], f'{what} is where it was after the reload', {'before': b, 'after': a})
        await browser.close()
    print(f'browser lift: {sum(results)}/{len(results)} passed')
    return all(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)
