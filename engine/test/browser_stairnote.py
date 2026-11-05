#!/usr/bin/env python3
"""DISMISSING A STAIR'S WARNING (2026-11-02; docs/UI.md "A stair's warning"; surfaces/stairnotes.js).

  python3 engine/test/browser_stairnote.py --local [--shots]

  SHOWN    a stair with nothing over it wears its note, and on the GM's seat a × just past the note's end
  PLAYER   a player sees the note, has no ×, and the relay refuses the command from that seat
  CLICK    a real mouse click on the × hides the note on both seats, and selects nothing behind it
  RELOAD   a reload keeps it hidden
  RING     the stair's ☰ offers "Show stair warning again"; a real click brings the note back
  BAR      "dismiss stair warning" in the command bar; undo brings it back, redo takes it away
  FAULT    a different fault shows its own note, with a ×
  CAMERA   off screen the × is not there to be hit
  PHONE    on a phone-sized touch seat the target is at least 40 px and a real tap dismisses

Every seat's transport is checked: ws by default (since 2026-11-02 clients try it first, then SSE), so a seat that fell
back fails here rather than passing quietly. --transport sse forces the fallback. --page https://dev.turnipworks.net/
runs it through the real tunnel.
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--transport', choices=['ws', 'sse'], default='ws', help='what every seat must be on: ws (the default path, 2026-11-02) or sse, forced, for the fallback')
A = ap.parse_args()
FORCE = '&transport=sse' if A.transport == 'sse' else ''  # (ws is not forced: a seat that FELL BACK to SSE must fail the transport check)
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18131,18732').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-stairnote-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
async def view(pg, x, z, dist=80, pitch=60, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(350)
W = "tw.worldOf(tw.area())"
NOTES = f"{W}.stairNoteList()"
UP = "(() => { const r = document.getElementById('twl'); return !r || r.hidden || getComputedStyle(r).display === 'none' || getComputedStyle(r).visibility === 'hidden' || +getComputedStyle(r).opacity === 0; })()"  # the loading screen has left
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(350)
async def shot(pg, name):
    if A.shots:
        os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS, f'stairnote-{name}.png'))
        x = await pg.evaluate("tw.stairNoteX()[0]?.box || null")
        if x:  # the note and its × close up, for a blind read
            vw = pg.viewport_size; l = max(0, x[0] - 170); t = max(0, x[1] - 20); w = min(vw['width'] - l, 240); h = min(vw['height'] - t, 90)
            await pg.screenshot(path=os.path.join(SHOTS, f'stairnote-{name}-close.png'), clip={'x': l, 'y': t, 'width': w, 'height': h})

async def main():
    page = (start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro') + FORCE
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, **kw):
            ctx = await browser.new_context(**({'viewport': {'width': 1400, 'height': 900}} | kw))
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST stairnote {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        G = await gm.evaluate("tw.spawnRoom('common', 15, 0, 6, 5, 77)"); await idle(gm)
        await view(gm, 85, 12.5, 75, 62)
        await gm.evaluate("(tw.setLevel(0), tw.setCut(9, { pinned: true, by: 'test' }))"); await gm.wait_for_timeout(500)
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('stair-straight'))"); await gm.wait_for_timeout(300)
        pt = await gm.evaluate("tw.screenOf(85, 12.5, tw.main, 0)")
        await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(200); await gm.mouse.click(pt['x'], pt['y'])
        await wait(gm, "tw.stairs().length === 1 && tw.sync.pendingCount() === 0", 15000, 'placed'); await gm.keyboard.press('Escape')
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(600)
        SID = (await gm.evaluate("tw.stairs()"))[0]['id']

        print('SHOWN: the note, and its ×')
        n = await gm.evaluate(NOTES)
        check(len(n) == 1 and n[0]['id'] == SID and n[0]['text'] == 'No floor above yet' and n[0]['shown'], 'the stair wears its note', n)
        await wait(gm, "tw.stairNoteX().length === 1 && tw.stairNoteX()[0].shown", 8000, '× shown')
        x = await gm.evaluate("tw.stairNoteX()")
        check(len(x) == 1 and x[0]['id'] == SID and x[0]['shown'], 'on the GM seat it has a ×', x)
        # the × stands just past the note's right end, at the note's height
        geo = await gm.evaluate(f"""(() => {{ const w = {W}, t = w.stairNotes.get('{SID}'), r = document.getElementById('c').getBoundingClientRect(), f = tw.main.camera.projectionMatrix.elements[5] * r.height * tw.main.rect[3] / 2, s = tw.screenOf(t.position.x, t.position.z, tw.main, t.position.y); return {{ cx: s.x, cy: s.y, right: s.x + t.scale.x * f / 2, half: t.scale.y * f / 2 }}; }})()""")
        d = x[0]['disc']; dcx, dcy = d[0] + d[2] / 2, d[1] + d[3] / 2
        check(abs(dcy - geo['cy']) < 2 and abs(d[0] - geo['right']) < 4, 'just past the end of the note, at its height, never over its words', [d, geo])
        check(x[0]['box'][2] >= 28 and d[2] >= 18, 'a mouse target of 28 px round a 20 px disc', x[0])
        await shot(gm, 'desktop-shown')

        print('PLAYER: sees it, cannot touch it')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx' + FORCE)
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        tr = [await gm.evaluate('tw.transport()'), await pl.evaluate('tw.transport()')]
        check(tr == [A.transport, A.transport], f'both seats are on {A.transport}: what follows is that transport, not a fallback', tr)
        await wait(pl, f"tw.worldOf(tw.area()).stairNoteList().length === 1", 15000, 'player note')
        await pl.wait_for_timeout(500)
        check(len(await pl.evaluate(NOTES)) == 1, 'a player sees the note (GM-only notes is a separate question)')
        check(await pl.evaluate("document.querySelectorAll('#stairNoteX .snx').length") == 0 and await pl.evaluate("tw.stairNoteX().length") == 0, 'and has no ×')
        await pl.evaluate(f"tw.select(['{SID}'])"); await pl.wait_for_timeout(300)
        ctx_cmd = await pl.evaluate("tw.registry.available().some(c => c.id === 'stair.note')")
        check(not ctx_cmd, 'nor the command in its bar or ring')
        await pl.evaluate(f"tw.select([])")
        cid = await pl.evaluate(f"tw.sync.submit('object.set', {{ id: '{SID}', noteOff: 'open' }}, tw.area())")
        await pl.wait_for_timeout(900)
        await idle(pl); await idle(gm)
        check(await gm.evaluate(f"!tw.entities()['{SID}'].noteOff"), 'the same command typed into the player seat by hand: the relay refuses, nothing changes', cid)
        check(len(await gm.evaluate(NOTES)) == 1 and len(await pl.evaluate(NOTES)) == 1, 'both seats still have the note')

        print('CLICK: a real click on the ×')
        d = (await gm.evaluate("tw.stairNoteX()"))[0]['disc']
        hit = await gm.evaluate(f"document.elementFromPoint({d[0] + d[2] / 2}, {d[1] + d[3] / 2})?.closest('.snx')?.dataset.id")
        check(hit == SID, 'the point under the disc is the button, not the canvas or a label', hit)
        await gm.mouse.move(d[0] + d[2] / 2, d[1] + d[3] / 2); await gm.wait_for_timeout(250); await shot(gm, 'desktop-hover')
        await gm.mouse.click(d[0] + d[2] / 2, d[1] + d[3] / 2); await idle(gm)
        check(await gm.evaluate(NOTES) == [], 'the note is gone from the GM seat', await gm.evaluate(NOTES))
        await wait(pl, "tw.worldOf(tw.area()).stairNoteList().length === 0", 8000, 'player note gone')
        check(await pl.evaluate(NOTES) == [], 'and from the player seat: it is in the world, not in a browser')
        tr = [await gm.evaluate('tw.transport()'), await pl.evaluate('tw.transport()')]
        check(tr == [A.transport, A.transport], 'and neither seat dropped to another transport to get it', tr)
        check(await gm.evaluate("tw.stairNoteX().length") == 0 and await gm.evaluate("document.querySelectorAll('#stairNoteX .snx').length") == 0, 'the × goes with it')
        check(await gm.evaluate(f"tw.entities()['{SID}'].noteOff") == 'open', 'stored on the stair, as the code')
        check(await gm.evaluate("tw.selected().length") == 0, 'the click selected nothing behind it')
        check(not (await gm.evaluate(f"tw.stairs()"))[0]['works'], 'the stair is no less broken: only the note went')
        await shot(gm, 'desktop-dismissed')

        print('RELOAD: it stays hidden')
        await gm.reload(wait_until='domcontentloaded', timeout=180000)
        check(await wait(gm, f"window.tw && tw.ready && tw.ready() && {W}?.recs.has('{SID}')", 60000, 'reloaded'), 'GM tab back, with the stair')
        await gm.wait_for_timeout(800)
        check(await gm.evaluate(NOTES) == [] and await gm.evaluate("tw.stairNoteX().length") == 0, 'after a reload the note and the × are still gone')
        await pl.reload(wait_until='domcontentloaded', timeout=180000)
        await wait(pl, f"window.tw && tw.ready && tw.ready() && {W}?.recs.has('{SID}')", 60000, 'player reloaded'); await pl.wait_for_timeout(600)
        check(await pl.evaluate(NOTES) == [], 'for the player too')

        print('RING: the way back')
        await view(gm, 85, -10, 75, 62)  # (the stair low in the window: the open ring is 600 px across, and its top would run under the bar)
        await gm.evaluate(f"tw.select(['{SID}'])"); await gm.wait_for_timeout(400)
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(450)
        menu = await gm.evaluate("tw.ringMenu().map(n => n.cmd || '▸' + n.group)")
        check('stair.note' in menu and 'stair.flip' in menu, "the stair's ☰ has it, beside Stairs up / down", menu)
        title = await gm.evaluate("tw.registry.titleOf(tw.registry.get('stair.note'))")
        check(title == 'Show stair warning again', 'it names what you would get', title)
        await shot(gm, 'desktop-ring')
        b = await gm.query_selector('#ring .rbtn[data-cmd="stair.note"]'); await b.click(timeout=8000); await idle(gm)
        n = await gm.evaluate(NOTES)
        check(len(n) == 1 and n[0]['text'] == 'No floor above yet', 'a real click brings the note back', n)
        check(await gm.evaluate(f"!('noteOff' in tw.entities()['{SID}'])"), 'and leaves nothing on the stair')
        await wait(pl, "tw.worldOf(tw.area()).stairNoteList().length === 1", 8000, 'player note back')
        check(len(await pl.evaluate(NOTES)) == 1, 'for the player too')

        print('BAR: without the small target')
        await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select(['{SID}'])"); await gm.wait_for_timeout(300)
        await gm.keyboard.press('/'); await gm.keyboard.type('dismiss stair warning', delay=8); await gm.wait_for_timeout(400); await gm.keyboard.press('Enter'); await idle(gm)
        check(await gm.evaluate(NOTES) == [], 'typed in the command bar it dismisses the selected stair', await gm.evaluate("document.querySelector('#barInput, #bar textarea')?.value"))
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(200)
        await gm.keyboard.press('Control+z'); await idle(gm)
        check(len(await gm.evaluate(NOTES)) == 1, 'undo brings it back')
        await wait(gm, "tw.stairNoteX().length === 1 && tw.stairNoteX()[0].shown", 5000, '× back')
        await gm.keyboard.press('Control+Shift+z'); await idle(gm)
        check(await gm.evaluate(NOTES) == [] and await gm.evaluate(f"tw.entities()['{SID}'].noteOff") == 'open', 'redo takes it away')
        await gm.keyboard.press('Control+z'); await idle(gm)

        print('FAULT: another fault, another note')
        d0 = await gm.evaluate(f"tw.entities()['{SID}']")
        await gm.evaluate(f"tw.select(['{SID}'])"); await gm.wait_for_timeout(200)
        await gm.evaluate("tw.registry.run('stair.note')"); await idle(gm); await gm.evaluate("tw.select([])")
        check(await gm.evaluate(NOTES) == [], 'dismissed again')
        cells = (await gm.evaluate("tw.stairs()"))[0]['cells']
        # a room overhead that covers only half of the stair: "Comes up through a wall"
        minx = min(c[0] for c in cells); minz = min(c[1] for c in cells); xs = sorted({c[0] for c in cells}); zs = sorted({c[1] for c in cells})
        half = (xs[0] // 5 - 3, zs[0] // 5 - 2, 4, 5) if len(xs) > 1 else (xs[0] // 5 - 2, zs[0] // 5 - 3, 5, 4)
        await gm.evaluate(f"tw.spawnRoom('guest', {half[0]}, {half[1]}, {half[2]}, {half[3]}, 5, undefined, 10)"); await idle(gm); await gm.wait_for_timeout(500)
        n = await gm.evaluate(NOTES)
        code = await gm.evaluate(f"tw.stairStatus(tw.entities()['{SID}']).code")
        check(len(n) == 1 and code != 'open' and n[0]['code'] == code, 'with a room over part of it the fault changes, and the new note shows through the old dismissal', [n, code])
        await wait(gm, "tw.stairNoteX().length === 1", 5000, '× on the new note')
        check(await gm.evaluate("tw.stairNoteX().length") == 1, 'with its own ×')

        print('CAMERA: where the × is not')
        await view(gm, 900, 900, 60, 60); await gm.wait_for_timeout(300)
        xx = await gm.evaluate("tw.stairNoteX()")
        check(xx and not xx[0]['shown'], 'the note off screen: no ×', xx)
        await view(gm, 85, 12.5, 75, 62)

        print('PHONE: a real tap')
        url = gm.url
        ph = await tab(url + (FORCE if FORCE not in url else ''), viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
        live = await wait(ph, f"window.tw && tw.ready && tw.ready() && {W}?.recs.has('{SID}')", 60000, 'phone seat')
        check(live and await ph.evaluate("tw.gm()"), 'the GM seat on a phone')
        await wait(ph, UP, 90000, 'the loading screen left')  # (the × is measured on the table, not through the loading screen)
        await view(ph, 85, -6, 75, 62); await ph.wait_for_timeout(1000); await wait(ph, "tw.stairNoteX().length === 1 && tw.stairNoteX()[0].shown", 8000, '× on the phone')
        px = (await ph.evaluate("tw.stairNoteX()"))
        check(px and px[0]['box'][2] >= 40 and px[0]['box'][3] >= 40 and px[0]['disc'][2] >= 26, 'the target is at least 40 px, the disc 26', px)
        hit = await ph.evaluate(f"document.elementFromPoint({px[0]['box'][0] + 22}, {px[0]['box'][1] + 22})?.closest('.snx')?.dataset.id")
        check(hit == SID, 'on the table, the point under it is the button', hit)
        await shot(ph, 'phone-shown')
        b = px[0]['box']; await ph.touchscreen.tap(b[0] + b[2] / 2, b[1] + b[3] / 2); await idle(ph)
        check(await ph.evaluate(NOTES) == [], 'a real tap dismisses it')
        await shot(ph, 'phone-dismissed')
        await wait(gm, f"{W}.stairNoteList().length === 0", 8000, 'other GM tab')
        check(await gm.evaluate(NOTES) == [], 'on every seat')
        # the phone on its side
        await ph.evaluate(f"tw.select(['{SID}'])"); await ph.wait_for_timeout(200); await ph.evaluate("tw.registry.run('stair.note')"); await idle(ph); await ph.evaluate("tw.select([])")
        await ph.set_viewport_size({'width': 844, 'height': 390}); await ph.wait_for_timeout(5000); await view(ph, 85, 12.5, 60, 62)  # (5 s: the toast has gone)
        await wait(ph, "tw.stairNoteX().length === 1 && tw.stairNoteX()[0].shown", 8000, '× on the phone, on its side')
        lx = await ph.evaluate("tw.stairNoteX()")
        check(lx and lx[0]['box'][2] >= 40, 'on its side too', lx)
        dd = lx[0]['disc']; tops = await ph.evaluate(f"[[{dd[0] + dd[2] / 2}, {dd[1] + 2}], [{dd[0] + dd[2] / 2}, {dd[1] + dd[3] - 2}], [{dd[0] + 2}, {dd[1] + dd[3] / 2}], [{dd[0] + dd[2] - 2}, {dd[1] + dd[3] / 2}]].map(([x, y]) => document.elementFromPoint(x, y)?.closest('.snx') ? 1 : document.elementFromPoint(x, y)?.className || document.elementFromPoint(x, y)?.id)")
        check(tops == [1, 1, 1, 1], 'all round the disc the button is on top, a room label beside it or not', tops)
        await shot(ph, 'phone-landscape')
        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"stair note: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
