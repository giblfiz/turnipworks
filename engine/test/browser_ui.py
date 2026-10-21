#!/usr/bin/env python3
"""Game UI acceptance: the command bar, living previews, placement, the selection ring, industry-standard input,
per-seat undo, copy/paste through plain text, hide-from-players, roster, chat and dice. Two tabs (GM + player) driven
with real keyboard and mouse input.

  local:  python3 engine/test/browser_ui.py --local
  live:   ... browser_ui.py --page https://implausible.enterprises/projects/turnip-works/engine/client/
"""
import argparse, asyncio, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
# TW_GPU=1: render on the GPU (Vulkan) instead of software GL: several times faster, and steadier on a loaded machine
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only'); ap.add_argument('--tuner')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
def port_free(port):
    """a stale relay or web server left by an interrupted run would silently serve OLD code: refuse to start"""
    import socket
    with socket.socket() as so:
        so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # as node does: a TIME_WAIT is not a live server
        try: so.bind(('127.0.0.1', port)); return True
        except OSError: return False

tmpdirs = []
def start_local():
    for port in (18099, 18724):
        if not port_free(port): sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-ui-')
    site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])  # removed at exit: /tmp is RAM on the build box  # mirrors the deploy: /engine next to /tuner (the game imports the tuner live)
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': '18099', 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', '18724', '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen('http://127.0.0.1:18099/health', timeout=1); urllib.request.urlopen('http://127.0.0.1:18724/engine/client/index.html', timeout=1); break
        except Exception: pass
    return 'http://127.0.0.1:18724/engine/client/index.html?relay=' + urllib.parse.quote('http://127.0.0.1:18099') + '&api=&nopost&faces=1500&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

async def bar(pg, text, enter=True, pick=None):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/')
    await pg.keyboard.type(text, delay=8)
    await pg.wait_for_timeout(250)
    if pick is not None:
        rows = await pg.evaluate("[...document.querySelectorAll('#results .res')].map(e => e.innerText.replace(/\\s+/g, ' '))")
        idx = next((i for i, t in enumerate(rows) if pick.lower() in t.lower()), None)
        if idx is None: print('    (no row', pick, rows[:6], ')'); return False
        for _ in range(idx): await pg.keyboard.press('ArrowDown')
    if enter: await pg.keyboard.press('Enter')
    return True

async def topdown(pg, x, z, dist=60):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = 89.5; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(120)

async def frame(pg, x, z, dist=95):  # the ring is world-sized (6 ft buttons, no screen fitting): frame the piece as the default play view does, so its ring is on screen and clear of the top bar
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = 52; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)

async def low(pg, at=0.62):  # move the camera so the selection's ring centre sits `at` of the way down the screen
    await pg.evaluate(f"""(() => {{ const g = tw.main.grab, a = tw.ringAnchor(); if (!a) return; const p0 = tw.screenOf(g.focus.x, g.focus.z, tw.main), p1 = tw.screenOf(g.focus.x, g.focus.z + 1, tw.main);
      g.focus.z -= (innerHeight * {at} - a.y) / (p1.y - p0.y); g.update(); }})()""")
    await pg.wait_for_timeout(300)

async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")

async def drag(pg, a, b, steps=10, mods=(), button='left', hold=0, during=None, step_ms=16):
    for m in mods: await pg.keyboard.down(m)
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(button=button)
    if hold: await pg.wait_for_timeout(hold)
    for i in range(1, steps + 1):
        await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(step_ms)
    if during: await during()
    await pg.mouse.up(button=button)
    for m in mods: await pg.keyboard.up(m)

E = lambda id: f"tw.entities()['{id}']"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    tuner_url = 'http://127.0.0.1:18724/tuner/index.html?nobg&nofx&seed=4242' if A.local else (A.tuner or 'https://implausible.enterprises/projects/turnip-works/tuner/?nobg&nofx&seed=4242')
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, permissions=['clipboard-read', 'clipboard-write'], reduced_motion='reduce')  # the ring's slide is browser_ring_ellipse's; here it jumps
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('crash', lambda _p: print(f'    (renderer crashed: {url[:60]})'))
            pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
            await pg.goto(url); return pg

        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST ui ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 30000), 'GM tab live', await gm.evaluate('tw.transport()'))
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')
        T1 = await gm.evaluate('tw.area()')

        print('BAR: invite through an argument chip, permissions, history')
        await bar(gm, 'invite Brakka')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value")
        await gm.keyboard.press('Escape')
        pl = await tab(invite.replace('nopost', 'nofx'))  # the player tab runs without FX: two heavy tabs exhaust software GL
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 30000), 'player joined from the invite link the bar produced')
        PL = await pl.evaluate('tw.me()')
        await gm.keyboard.press('/'); await gm.keyboard.type('kitchen'); await gm.wait_for_timeout(300)
        first = await gm.evaluate("document.querySelector('#results .res .t')?.innerText")
        secs = await gm.evaluate("[...document.querySelectorAll('#results .sec')].map(e => e.innerText)")
        check(first == 'Build kitchen' and 'PLACE' in [s.upper() for s in secs], 'typing "kitchen": Build kitchen first, typed sections', f'{first}; sections {secs}')
        await gm.keyboard.press('Escape')
        await pl.keyboard.press('/'); await pl.keyboard.type('kitchen'); await pl.wait_for_timeout(300)
        prow = await pl.evaluate("[...document.querySelectorAll('#results .res .t')].map(e => e.innerText)")
        psecs = await pl.evaluate("[...document.querySelectorAll('#results .sec')].map(e => e.innerText.toUpperCase())")
        check('Build kitchen' not in prow and 'PLACE' not in psecs, 'player: building and placing never appear (permissions)', f'{prow[:4]}')
        await pl.keyboard.press('Escape')
        await gm.keyboard.press('/'); await gm.keyboard.press('ArrowUp')
        check(await gm.evaluate("document.querySelector('#bar input').value") == 'invite Brakka', 'Up on an empty bar recalls history')
        await gm.keyboard.press('Escape')
        keys = await gm.evaluate("(async () => { tw.emit('bar.open', 'undo'); await new Promise(r => setTimeout(r, 200)); return [...document.querySelectorAll('#results .res')].filter(r => r.innerText.includes('Undo')).map(r => r.querySelector('kbd')?.innerText) })()")
        check(any(keys), 'each command shows its key', keys[:2]); await gm.keyboard.press('Escape')

        print('BUILD: bar → kitchen → drag a rectangle → room in both tabs; re-roll keeps pins; undo', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        # an angled camera (as Harry plays), so some walls stand between the camera and the room and must come last
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(25, 0, 20); g.pitch = 52; g.yaw = 0; g.dist = 85; g.update(); tw.main.rule = 'free'; })()"); await gm.wait_for_timeout(150)
        await bar(gm, 'kitchen')
        await drag(gm, await scr(gm, 11, 6), await scr(gm, 34, 24))
        await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room') && tw.spawningNow().anims > 0", 15000, 'room')
        spawn = await gm.evaluate('tw.spawningNow()'); sig_during = await gm.evaluate("tw.signals().filter(s => s.kind !== 'sel')")
        check(spawn['last']['n'] > 20 and spawn['last']['near'] > 0 and not sig_during, "the room spawns in with the tuner's choreography (floor, walls, furniture; camera-side walls last), nothing drawn around spawning things", f"{spawn['last']['n']} pieces, {spawn['last']['near']} camera-side walls last, {round(spawn['last']['total'])} ms; signals during spawn: {sig_during}")
        stand = await gm.evaluate("""(async () => { const w = tw.worldOf(tw.area()); let worst = 0, n = 0; const t0 = performance.now();
            while (tw.spawningNow().anims > 0 && performance.now() - t0 < 30000) { n++;
              const vis = [...w.recs.values(), ...w.shell.values()].filter(r => r.group.visible && r.visual?.userData?.placeholder).length;
              worst = Math.max(worst, vis); await new Promise(r => setTimeout(r, 60)); }
            return { worst, samples: n, loadMs: w.lastEpisode?.loadMs }; })()""")
        check(stand['worst'] == 0 and stand['samples'] > 3, 'the spawn waits for the real meshes (as the tuner does): no grey stand-in is ever seen mid-flight', stand)
        await wait(gm, 'tw.spawningNow().anims === 0', 15000, 'spawn done')
        await topdown(gm, 25, 20, 80)
        room = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room')")
        await wait(pl, f"tw.entities()['{room['id']}'] && Object.values(tw.entities()).filter(e => e.room === '{room['id']}').length > 5", 15000, 'room on player')
        n_gm = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}').length")
        n_pl = await pl.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}').length")
        hg, hp = await gm.evaluate('tw.hashCheck()'), await pl.evaluate('tw.hashCheck()')
        check(room['recipe']['type'] == 'kitchen' and room['recipe']['w'] == 5 and n_gm == n_pl and n_gm > 5 and hg[0]['match'] and hp[0]['match'], 'kitchen dragged as a 25×20 ft rectangle appears in both tabs, layouts identical', f"{room['recipe']['w']*5}×{room['recipe']['d']*5} ft, {n_gm} objects, hash {hg[0]['creator']} re-solved in both tabs")
        check(await gm.evaluate(f"tw.sel.has('{room['id']}')") and await gm.evaluate("!!document.querySelector('#ring [data-cmd=\"room.reroll\"]')"), 'new room is selected; its ring offers re-roll and ☰')
        await wait(gm, "tw.signals().length === 1 && tw.signals()[0].kind === 'sel'", 6000, 'room signal'); rs = await gm.evaluate("tw.signals()")
        rst = await gm.evaluate("tw.worldOf(tw.area()).selFx?.stats().entries.filter(e => e.state === 'selected')")
        check(len(rs) == 1 and rs[0]['kind'] == 'sel' and rs[0]['depthTest'] and rst and len(rst) == 1 and rst[0]['style'] == 'brackets' and rst[0]['drawn'], 'a selected room wears the house selected look round its volume (one signal: corner brackets, depth-tested), not ants around every object', [rs, rst])
        # deselect, three ways (Harry: "selection gets stuck")
        await gm.keyboard.press('Escape')
        esc_ok = await wait(gm, 'tw.sel.size === 0 && tw.signals().length === 0', 3000, 'esc deselect')
        await gm.evaluate(f"tw.select('{room['id']}')"); await wait(gm, 'tw.signals().length === 1', 3000)
        e0 = await scr(gm, 60, 45); await gm.mouse.click(e0['x'], e0['y'])
        empty_ok = await wait(gm, 'tw.sel.size === 0 && tw.signals().length === 0', 3000, 'click-empty deselect')
        check(esc_ok and empty_ok, 'deselect: Esc and a click on empty ground clear the selection and its glow', f'esc {esc_ok}, empty click {empty_ok}')
        # the room's glow must be SEEN, from the angled view Harry plays at (walls standing)
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(25, 0, 20); g.pitch = 52; g.yaw = 0; g.dist = 70; g.update(); })()"); await gm.wait_for_timeout(300)
        await gm.evaluate(f"tw.select('{room['id']}')"); await wait(gm, 'tw.signals().length === 1', 3000)
        # the brackets stand OUTSIDE the walls and reach the wall tops, so they are seen from the angled view; rays from the
        # camera to points along them: how many arrive before a wall, board or prop (the rest show faintly: the ghost dial)
        await wait(gm, "tw.worldOf(tw.area()).selFx?.samples('selected').length > 20", 4000, 'brackets drawn')
        # (2026-10-07) the brackets BREATHE (0.4 Hz), and the count of points in plain sight swings with them (92 to 126 of 168 in one
        # room, measured): one sample passed or failed by where in the breath it fell, which depends on how long the page has been
        # open (starting a campaign stopped reloading the page, and this check began to fail 5 times in 8). The best of one breath:
        SEEN = """(() => { const w = tw.worldOf(tw.area()), cam = tw.main.camera, pts = w.selFx.samples('selected');
          let n = 0, inView = 0;
          for (const p of pts) { const s = tw.screenOf(p[0], p[2], tw.main, p[1]); if (s.x < 0 || s.y < 0 || s.x > innerWidth || s.y > innerHeight) continue; inView++;
            const r = tw.rayAt(s.x, s.y), d = Math.hypot(p[0] - cam.position.x, p[1] - cam.position.y, p[2] - cam.position.z);
            const hit = r.intersectObjects([w.layers.shell, w.layers.things], true).find(h => h.object.visible && !h.object.userData?.halo && h.distance < d - 0.15);
            if (!hit) n++; }
          return { seen: n, inView, share: inView ? n / inView : 0, ghost: w.selFx.stats().entries.find(e => e.state === 'selected')?.ghost }; })()"""
        seen = None
        for _ in range(12):
            one = await gm.evaluate(SEEN)
            if seen is None or one['share'] > seen['share']: seen = one
            await gm.wait_for_timeout(160)
        await gm.keyboard.press('Escape'); await topdown(gm, 25, 20, 80)
        check(seen['inView'] > 40 and seen['share'] >= 0.5 and seen['ghost'], "a selected room's brackets can be seen from the angled view (outside the walls, floor to wall top; the hidden part ghosts through)", f"{seen['seen']}/{seen['inView']} bracket points in plain sight")
        await gm.evaluate(f"tw.select('{room['id']}')")
        # pin one prop through its ring, then re-roll the room through the room's ring
        prop = await gm.evaluate(f"(() => {{ const o = Object.values(tw.entities()).filter(e => e.room === '{room['id']}' && e.place === 'floor' && !e.parent && e.dims[1] > 1).sort((a, b) => b.dims[0] * b.dims[2] - a.dims[0] * a.dims[2])[0]; return o; }})()")
        p_at = await scr(gm, prop['x'], prop['z'], prop['dims'][1])
        await gm.mouse.click(p_at['x'], p_at['y'])
        ok_sel = await wait(gm, f"tw.sel.has('{prop['id']}')", 3000, 'prop selected')
        if not ok_sel:  # something taller in front of it: use the breadcrumb-free route (bar search by its tag)
            tag = await gm.evaluate(f"tw.tagOf('{prop['id']}')"); await bar(gm, tag); ok_sel = await wait(gm, f"tw.sel.has('{prop['id']}')", 3000); await topdown(gm, 25, 20, 80)
        check(ok_sel and await gm.evaluate(f"[...tw.sel].join() === '{prop['id']}'"), 'selecting something else replaces the selection (the room lets go)', prop['name'])
        await gm.mouse.move(6, 520); await gm.wait_for_timeout(150)  # off the room's label (hovering a label shows the room's hover look, by design)
        await wait(gm, f"tw.signals().length === 1 && tw.signals()[0].id === '{prop['id']}'", 4000, 'prop halo only'); ps_ = await gm.evaluate('tw.signals()')
        await gm.wait_for_timeout(300); sh = await gm.evaluate("tw.worldOf(tw.area()).selFx?.stats().entries.filter(e => e.state === 'selected')")
        check(len(ps_) == 1 and ps_[0]['kind'] == 'sel' and ps_[0]['depthTest'] is True and sh and sh[0]['style'] == 'brackets' and sh[0]['segs'] == 24 and sh[0]['ghost'],
              "selection = the house look (harry-v1): corner brackets at the top and bottom of the box (shared tuner renderer), depth-tested, ghosting faintly through occluders; no box", [ps_, sh])
        other = await gm.evaluate(f"(() => {{ const o = Object.values(tw.entities()).find(e => e.room === '{room['id']}' && e.kind === 'object' && e.id !== '{prop['id']}' && !e.parent); return o && o.id; }})()")
        await gm.evaluate(f"tw.hover = '{other}'"); await gm.wait_for_timeout(500)
        hv = await gm.evaluate("tw.worldOf(tw.area()).selFx?.stats().entries.filter(e => e.state === 'hover')"); await gm.evaluate("tw.hover = null")
        check(hv and hv[0]['style'] == 'footprint' and hv[0]['depthTest'] and hv[0]['ghost'], 'hover = the house look: a thin footprint outline on the ground, depth-tested, ghosting faintly', hv)
        await frame(gm, prop['x'], prop['z']); await gm.mouse.move(6, 520)
        ring = await gm.evaluate("""(() => { const c = document.querySelector('#ring'); const bs = [...c.querySelectorAll('.rbtn')]; const r = bs.map(b => b.getBoundingClientRect());
          const cx = (Math.min(...r.map(x => x.left)) + Math.max(...r.map(x => x.right))) / 2; return { cmds: bs.map(b => b.dataset.cmd || 'menu'), slots: bs.map(b => +b.dataset.slot), size: Math.min(...r.map(x => x.width)), circle: !!c.querySelector('.ring-circle, .knob, .sizer') }; })()""")
        core = await gm.evaluate("""(() => { const g = tw.ringGeom(); const bs = [...document.querySelectorAll('#ring .rbtn')].map(b => { const r = b.getBoundingClientRect(); return { cmd: b.dataset.cmd || 'menu', x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); return { order: [...bs].sort((a, b) => a.x - b.x).map(b => b.cmd), above: bs.every(b => b.y < g.top), top: g.top, ys: bs.map(b => Math.round(b.y)) }; })()""")
        check(sorted(ring['cmds']) == sorted(['edit.rotate', 'thing.pin', 'edit.resize', 'menu']) and core['order'] == ['edit.rotate', 'edit.resize', 'thing.pin', 'menu'] and core['above'] and ring['size'] >= 66 and not ring['circle'], 'prop ring: exactly turn · size · pin · ☰, in that order, in an arc above the thing; no circle; buttons 20% bigger', [ring, core])
        # the size handle: drag it outward and the prop grows (one step); undo puts it back
        d0 = (await gm.evaluate(E(prop['id'])))['dims']
        sh = await gm.evaluate("""(() => { const b = document.querySelector('#ring [data-cmd="edit.resize"]').getBoundingClientRect(), c = tw.ringCenter(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, cx: c[0], cy: c[1] }; })()""")
        await drag(gm, sh, {'x': sh['x'] + (sh['x'] - sh['cx']) * 0.5, 'y': sh['y'] + (sh['y'] - sh['cy']) * 0.5}, steps=8, step_ms=60)
        grown = await wait(gm, f"{E(prop['id'])}.dims[0] > {d0[0]} * 1.15", 5000, 'grown')
        await gm.keyboard.press('Control+z'); await wait(gm, f"Math.abs({E(prop['id'])}.dims[0] - {d0[0]}) < 0.01", 5000, 'size undone')
        check(grown, 'dragging the size handle outward grows the prop (and Ctrl+Z puts it back)')
        await gm.evaluate(f"tw.select('{prop['id']}')")
        await gm.click('#ring [data-cmd="thing.pin"]')
        await gm.wait_for_timeout(100)
        await wait(gm, f"{E(prop['id'])}.pinned", 5000, 'pinned')
        # toggles show the action they will do now (label AND icon); the bar finds that wording
        await gm.evaluate(f"tw.select('{prop['id']}')"); await gm.wait_for_timeout(250)
        pb = await gm.evaluate("(() => { const b = document.querySelector('#ring [data-cmd=\"thing.pin\"]'); return { label: b?.getAttribute('aria-label'), icon: b?.innerHTML.includes('M15 9.34V7') }; })()")
        await gm.keyboard.press('/'); await gm.keyboard.type('unpin'); await gm.wait_for_timeout(300)
        first = await gm.evaluate("document.querySelector('#results .res .t')?.innerText")
        await gm.keyboard.press('Escape')
        other = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'object' && e.room === '{prop['room']}' && !e.pinned && e.id !== '{prop['id']}')?.id")
        await gm.evaluate(f"tw.select(['{prop['id']}', '{other}'])"); await gm.wait_for_timeout(250)
        mixed = await gm.evaluate("tw.registry.titleOf(tw.registry.get('thing.pin'), tw.registry.ctx())")
        check(pb['label'] == 'Unpin' and pb['icon'] and first == 'Unpin' and mixed == 'Pin all', 'a pinned thing\'s button says Unpin (with the unpin icon); "unpin" finds it in the bar; a mixed selection offers "Pin all"', [pb, first, mixed])
        await gm.evaluate(f"tw.select('{prop['id']}')"); await gm.wait_for_timeout(150)
        old_ids = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}').map(e => e.id).sort()")
        # (a room's world-sized ring is at its largest buttons, an oval about 690 x 490 px round the room's middle: the room
        # is framed low on the screen so the ring's top row is clear of the command bar)
        await frame(gm, 25, 20, 130); await gm.evaluate(f"tw.select('{room['id']}')"); await gm.wait_for_timeout(300); await low(gm)
        await gm.click('#ring [data-cmd="room.reroll"]')
        await wait(gm, f"{E(room['id'])}.recipe.seed !== {room['recipe']['seed']}", 8000, 'reroll')
        await wait(pl, f"tw.entities()['{room['id']}'].recipe.seed === {await gm.evaluate(E(room['id']) + '.recipe.seed')}", 8000, 'reroll on player')
        new_ids = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}').map(e => e.id).sort()")
        kept = prop['id'] in new_ids and len(set(old_ids) & set(new_ids)) == 1
        check(kept and await gm.evaluate('tw.hashCheck()[0].match') and await pl.evaluate('tw.hashCheck()[0].match'), 're-roll (ring button): new seed, new furniture, the pinned prop stays; both tabs re-solve the same hash', f"{len(old_ids)} → {len(new_ids)} objects, 1 kept")
        await gm.keyboard.press('Control+z')
        await wait(pl, f"tw.entities()['{room['id']}'].recipe.seed === {room['recipe']['seed']}", 8000, 'undo reroll on player')
        back = await pl.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}').map(e => e.id).sort()")
        check(back == old_ids, 'Ctrl+Z undoes the re-roll: the old furniture comes back exactly, in both tabs')
        await topdown(gm, 25, 20, 80)
        await gm.screenshot(path=os.path.join(SHOTS, 'ui-room.png'))

        print('PLACE: living previews, drag out of the bar, place mode with Shift, surface + wall semantics', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        await gm.keyboard.press('Escape')
        await gm.keyboard.press('/'); await gm.keyboard.type('barrel'); await gm.wait_for_timeout(300)
        live = await wait(gm, "document.querySelectorAll('#results .pvw.live').length >= 2 && tw.previewsDrawn >= 2", 20000, 'live previews')
        check(live, 'catalog results show the real model turning (live previews in scissor viewports)', f"{await gm.evaluate('document.querySelectorAll(\"#results .pvw.live\").length')} live, {await gm.evaluate('tw.previewsDrawn')} drawn this frame")
        await gm.screenshot(path=os.path.join(SHOTS, 'ui-previews.png'))
        row = await gm.evaluate("(() => { const r = document.querySelector('#results .res .pvw.live')?.closest('.res').getBoundingClientRect(); return {x: r.left + 30, y: r.top + 20}; })()")
        before = await gm.evaluate("Object.keys(tw.entities()).length")
        target = await scr(gm, 45, 12)
        await drag(gm, row, target, steps=14)
        await wait(gm, f"Object.keys(tw.entities()).length === {before + 1}", 8000, 'dragged-out barrel')
        placed = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && /barrel/.test(e.cat || '')).sort((a, b) => Math.abs(a.x - 45) + Math.abs(a.z - 12) - Math.abs(b.x - 45) - Math.abs(b.z - 12))[0]")
        check(placed and abs(placed['x'] - 45) < 1.5 and abs(placed['z'] - 12) < 1.5 and placed['x'] * 2 == round(placed['x'] * 2), 'drag a result straight out of the bar into the world: placed at the drop, snapped to the half-foot grid', f"{placed and placed['cat']} at ({placed and placed['x']}, {placed and placed['z']})")
        await wait(pl, f"tw.entities()['{placed['id']}']", 6000)
        # click = place mode with a ghost; Shift keeps placing; Esc cancels
        await bar(gm, 'crate')
        check(await gm.evaluate("tw.mode?.kind === 'place'"), 'clicking/Enter on a result enters place mode with a ghost')
        n0 = await gm.evaluate("Object.keys(tw.entities()).length")
        for x in (48, 52):
            s = await scr(gm, x, 18); await gm.mouse.move(s['x'], s['y']); await gm.keyboard.down('Shift'); await gm.mouse.click(s['x'], s['y']); await gm.keyboard.up('Shift')
        await gm.keyboard.press('Escape')
        await wait(gm, f"Object.keys(tw.entities()).length === {n0 + 2}", 6000, 'two crates')
        check(await gm.evaluate("Object.keys(tw.entities()).length") == n0 + 2 and await gm.evaluate('!tw.mode'), 'Shift keeps placing (2 placed), Esc cancels')
        # surface semantics: a tankard dropped on a tabletop gets the table as its parent and sits on top
        table = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.room === '{room['id']}' && /^table/.test(e.cat || '') && !e.parent)")
        if table:
            await topdown(gm, table['x'], table['z'], 30)
            await gm.keyboard.press('/'); await gm.keyboard.type('tankard'); await gm.wait_for_timeout(300)
            row = await gm.evaluate("(() => { const r = [...document.querySelectorAll('#results .res')].find(r => /tankard/.test(r.innerText) && r.querySelector('.pvw'))?.getBoundingClientRect(); return r && {x: r.left + 30, y: r.top + 20}; })()")
            await drag(gm, row, await scr(gm, table['x'], table['z'], table['dims'][1]), steps=14)
            await gm.wait_for_timeout(800)
            tk = await gm.evaluate("Object.values(tw.entities()).filter(e => /tankard/.test(e.cat || '')).pop()")
            check(tk and (tk.get('parent') == table['id'] or (tk.get('parent') and await gm.evaluate(f"tw.entities()['{tk.get('parent')}']?.parent") == table['id'])) and tk['y'] > 1.5, 'a surface item dropped on a tabletop sits on it (parent = the table)', f"y = {tk and tk['y']} ft on {table['name']}")
            # raise / lower an object: 3 ft above the area it hangs there; released within reach of the top it lands back on it
            if tk:
                await gm.evaluate(f"tw.select('{tk['id']}')"); await gm.wait_for_timeout(200)
                y0 = tk['y']
                await gm.evaluate(f"tw.liftTo(tw.entities()['{tk['id']}'], {y0 + 3})"); await wait(gm, f"tw.entities()['{tk['id']}'].y > {y0 + 2.5}", 5000)
                hang = await gm.evaluate(f"tw.entities()['{tk['id']}']")
                await gm.evaluate(f"tw.liftTo(tw.entities()['{tk['id']}'], {y0 + 0.8})"); await wait(gm, f"tw.entities()['{tk['id']}'].y < {y0 + 0.5}", 5000)
                landed = await gm.evaluate(f"tw.entities()['{tk['id']}']")
                check(not hang.get('parent') and abs(landed['y'] - y0) < 0.3 and landed.get('parent'), 'lifted 3 ft over the area it stays hanging; released within reach of the top it lands back on it (gravity finishes contact)', f"hang y {hang['y']} (parent {hang.get('parent')}), landed y {landed['y']} on {landed.get('parent')}")
        else: check(False, 'surface placement (no area in the kitchen to test on)')
        await topdown(gm, 25, 20, 80)
        # wall semantics
        await bar(gm, 'coat pegs')
        if await gm.evaluate("tw.mode?.kind === 'place' && tw.mode.cat.place === 'wall'"):
            s = await scr(gm, 18, 7.5); await gm.mouse.move(s['x'], s['y']); await gm.mouse.click(s['x'], s['y'])
            await gm.wait_for_timeout(600)
            wi = await gm.evaluate("Object.values(tw.entities()).filter(e => e.cat === 'coat-pegs').pop()")
            check(wi and abs(wi['z'] - 5) < 1.5 and abs(wi['rot']) < 0.01 and wi['y'] > 2, 'a wall item snaps back-to-the-wall, facing into the room, hung at hanging height', f"{wi and wi['cat']} at z = {wi and wi['z']} (north wall at z = 5), y = {wi and wi['y']}, rot {wi and round(wi['rot'], 2)}")
        else: check(False, 'wall placement (no wall item in the catalog results)'); await gm.keyboard.press('Escape')

        print('RING + ☰: hide from players (two tabs), lock, duplicate, delete, replace with similar', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        crate = await gm.evaluate("Object.values(tw.entities()).filter(e => /crate/.test(e.cat || '')).pop()")
        await gm.evaluate(f"tw.select('{crate['id']}')"); await frame(gm, crate['x'], crate['z']); await gm.wait_for_timeout(200)
        # (the new ring, 2026-10-20: ONE oval; opening ☰ SLIDES the main buttons along it, so "keeps their angular
        # positions" became "keeps their order along the one oval"; ☰ toggles open (aria-expanded) instead of turning into ×)
        # (a row too long for the house oval steps its last buttons out one ring rather than enter the 3–6 sector:
        # tw.ringNodes() marks them `spilled`; they must sit on the next ring out, and only then)
        along = "JSON.stringify(tw.ringNodes().filter(n => n.curve && !n.spilled).sort((a, b) => a.curve.s - b.curve.s).map(n => [n.id, n.key, Math.round(n.curve.cx), Math.round(n.curve.cy), Math.round(n.curve.rx), Math.round(n.curve.ry)]))"
        spill_ok = "(() => { const ns = tw.ringNodes(), m = ns.find(n => n.curve && !n.spilled)?.curve, s = tw.ringSettings(), k = tw.ringWorld()?.scale || 1; return ns.filter(n => n.spilled).every(n => Math.abs(n.curve.rx - m.rx - s.curve.nestOffset * k) < 0.5 && Math.abs(n.curve.ry - m.ry - s.curve.nestOffset * k) < 0.5) && !tw.ringWarnings().includes('3–6 sector'); })()"
        a0 = json.loads(await gm.evaluate(along)); xs0 = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn:not(.ex)')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(b => b.dataset.id)")
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(300)
        a1 = json.loads(await gm.evaluate(along))
        core0, core1 = [n[0] for n in a0], [n[0] for n in a1 if n[1] != 'secondary']
        one = len({tuple(n[2:]) for n in a0 + a1}) == 1
        check(a0 and core0 == xs0 and core1 == [n for n in core0 if n in core1] and one and await gm.evaluate(spill_ok), 'opening ☰ keeps the core buttons in their order along the ONE oval (they slide along it; nothing jumps to another curve but a button stepped out of 3–6 onto the next ring)', [a0, a1, await gm.evaluate("tw.ringNodes().filter(n => n.spilled).map(n => n.id)")])
        ex = await gm.evaluate("""(() => { const bs = [...document.querySelectorAll('#ring .rbtn.ex')], m = document.querySelector('#ring [data-menu]'); return { n: bs.length, menuGone: !!m && m.classList.contains('open') && m.getAttribute('aria-expanded') === 'true' && !document.querySelector('#ring .rbtn.ex.disabled'), caps: bs.map(b => b.dataset.tip || ''), icons: bs.filter(b => b.querySelector(':scope > svg, :scope > img')).length, keys: bs.filter(b => /\\([^)]+\\)$/.test(b.title)).length }; })()""")
        grp = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn.ex.grp')].map(b => b.dataset.group)")
        top_ = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn.ex')].map(b => b.dataset.cmd || '▸' + b.dataset.group)")
        check(top_ == ['thing.replace', 'edit.lift', 'thing.tilt', 'thing.rename', 'thing.lock', 'thing.hide'] and ex['menuGone'] and grp == ['replace'] and ex['keys'] >= 1 and all(ex['caps']) and ex['icons'] == ex['n'], '☰ opens (aria-expanded) and the options join the oval in ONE flat level (Replace ▸, raise / lower, roll, rename, lock, hide; Delete left every ring on 2026-10-11): big icons, each named, keys shown, nothing greyed; the only ▸ is Replace', f"{ex['n']} options, {ex['keys']} with keys: {ex['caps'][:8]}")
        check(not any(c in top_ for c in ('edit.duplicate', 'edit.copy', 'edit.cut')) and not await gm.evaluate("!!document.querySelector('#ring [data-group=\"edit\"], #ring [data-group=\"copy\"]')"), 'no duplicate / copy / cut on the ring, and no Edit ▸ or Copy ▸ group (Harry 2026-10-05)', top_)
        # every button's centre on the ONE oval (#ring._curve), none overlapping
        geo_js = """(() => { const c = document.getElementById('ring')._curve, a = tw.ringAnchor(), sp = new Set(tw.ringNodes().filter(n => n.spilled).map(n => n.id)); const bs = [...document.querySelectorAll('#ring .rbtn')].filter(b => !sp.has(b.dataset.id)).map(b => b.getBoundingClientRect()).map(r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, l: r.left, r: r.right, t: r.top, b: r.bottom }));
            const off = bs.map(p => Math.abs(Math.hypot((p.x - c.cx) / c.rx, (p.y - c.cy) / c.ry) - 1)); let overlap = 0;
            for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y) < Math.min(bs[i].w, bs[j].w) * 0.9) overlap++;
            return { n: bs.length, off: Math.round(Math.max(...off) * 1000) / 1000, overlap, shift: c.shift, follows: Math.round(Math.abs(c.cx - a.x)), inside: bs.every(p => p.l >= 0 && p.t >= 0 && p.r <= innerWidth && p.b <= innerHeight) }; })()"""
        g1 = await gm.evaluate(geo_js)
        # the same open ring with the crate at the right-hand screen edge: the ring is world-sized and never slides (Harry
        # 2026-10-20: "I'm still seeing the orbitals moving around to stay on the screen"): it keeps its shape round the crate
        cs = await scr(gm, crate['x'], crate['z'])
        await gm.evaluate(f"(() => {{ const g = tw.main.grab; const w = tw.screenOf({crate['x']} + 1, {crate['z']}, tw.main).x - {cs['x']}; g.focus.x -= (innerWidth - 40 - {cs['x']}) / w; g.update(); }})()")
        await gm.wait_for_timeout(400)
        edge = await scr(gm, crate['x'], crate['z']); g2 = await gm.evaluate(geo_js)
        check(g1['off'] <= 0.03 and g1['overlap'] == 0 and g1['inside'] and await gm.evaluate(spill_ok) and g2['off'] <= 0.03 and g2['overlap'] == 0 and g2['shift'] == [0, 0] and g2['follows'] <= 2 and edge['x'] > 1000, 'open ☰: standard buttons and options sit on ONE oval, none overlapping; at the screen edge the oval keeps its shape round the crate (no sliding: the world-sized ring)', f"centre: {g1}; at the edge (crate at x {round(edge['x'])}): {g2}")
        await frame(gm, crate['x'], crate['z']); await gm.wait_for_timeout(200)
        fl = await gm.evaluate("({ f: tw.ringFlyout(), hide: document.querySelector('#ring .rbtn.ex[data-cmd=\"thing.hide\"]')?.getAttribute('aria-label') })")
        check(not fl['f'] and fl['hide'] == 'Hide from players', 'hide is a top-level button, named for what it will do (no sub-menu to go through)', fl)
        await gm.click('#ring .rbtn.ex[data-cmd="thing.hide"]'); await gm.wait_for_timeout(300)
        if not await gm.evaluate(f"tw.signals().some(s => s.kind === 'hid')"): print('    (hid diag)', await gm.evaluate('JSON.stringify(tw.signals())'), await gm.evaluate(f"JSON.stringify({{h: {E(crate['id'])}?.hidden, sel: [...tw.sel]}})"))
        await wait(pl, f"!tw.entities()['{crate['id']}']", 6000, 'crate gone for player')
        gm_has = await wait(gm, f"{E(crate['id'])}?.hidden === true && tw.signals().some(s => s.id === '{crate['id']}' && s.kind === 'hid' && s.depthTest)", 4000, 'hidden treatment')
        check(gm_has and not await pl.evaluate(f"!!tw.entities()['{crate['id']}']"), 'hide from players: gone from the player tab; the GM sees it see-through with the house hidden treatment (a pulsing violet tint wash)', await gm.evaluate(f"tw.worldOf(tw.area()).selFx?.stats().entries.filter(e => e.state === 'hidden')"))
        hd = await gm.evaluate("tw.worldOf(tw.area()).selFx?.stats().entries.filter(e => e.state === 'hidden')")
        check(hd and hd[0]['style'] == 'tint' and hd[0]['drawn'] and hd[0]['depthTest'], 'hidden from players = the house look: a violet tint wash on the thing itself (shared renderer)', hd)
        st, body = 0, None
        await gm.screenshot(path=os.path.join(SHOTS, 'ui-hidden.png'))
        await gm.keyboard.press('Space'); await gm.wait_for_timeout(100); await gm.keyboard.press('h')
        await wait(pl, f"!!tw.entities()['{crate['id']}']", 6000, 'crate back for player')
        check(await pl.evaluate(f"!!tw.entities()['{crate['id']}']"), 'reveal through the chord (Space, H: flat, like the ring): back on the player tab')
        await gm.evaluate(f"tw.select('{crate['id']}')"); await gm.wait_for_timeout(100)
        await gm.keyboard.press('Space'); await gm.wait_for_timeout(100); await gm.keyboard.press('k')
        await wait(gm, f"{E(crate['id'])}.locked", 5000, 'locked')
        await gm.keyboard.press('ArrowRight'); await gm.wait_for_timeout(500)
        check(await gm.evaluate(f"{E(crate['id'])}.x") == crate['x'], 'lock: a locked thing does not move (arrow nudge refused)')
        await gm.keyboard.press('Space'); await gm.wait_for_timeout(100); await gm.keyboard.press('k')
        await wait(gm, f"!{E(crate['id'])}.locked", 5000)
        await gm.keyboard.press('ArrowRight'); await gm.keyboard.press('Shift+ArrowDown')
        await wait(gm, f"{E(crate['id'])}.x === {crate['x'] + 5} && {E(crate['id'])}.z === {crate['z'] + 1}", 5000, 'nudged')
        check(await gm.evaluate(f"{E(crate['id'])}.x") == crate['x'] + 5 and await gm.evaluate(f"{E(crate['id'])}.z") == crate['z'] + 1, 'arrows move one square (5 ft), Shift+arrow nudges 1 ft')
        n0 = await gm.evaluate("Object.keys(tw.entities()).length")
        await gm.keyboard.press('Control+d')
        await wait(gm, f"Object.keys(tw.entities()).length === {n0 + 1}", 5000, 'duplicated')
        dup = [i for i in await gm.evaluate("[...tw.sel]") if i != crate['id']]
        check(len(dup) == 1, 'Ctrl+D duplicates (the copy is selected)')
        await gm.keyboard.press('Delete')
        await wait(gm, f"Object.keys(tw.entities()).length === {n0}", 5000, 'deleted')
        check(await gm.evaluate(f"!tw.entities()['{dup[0]}']") if dup else False, 'Delete removes the selection')
        cr = await gm.evaluate(E(crate['id'])); await gm.evaluate(f"tw.select('{crate['id']}')"); await frame(gm, cr['x'], cr['z']); await gm.wait_for_timeout(150)
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(100); await gm.click('#ring .rbtn.ex[data-cmd="thing.replace"]')
        await wait(gm, "document.querySelectorAll('#ring .rbtn[data-nest]').length > 0", 5000, 'sub-menu')
        NEST = '#ring .rbtn[data-nest]'
        nv = await gm.evaluate(f"document.querySelectorAll('{NEST}').length")
        rf = await gm.evaluate('tw.ringFlyout()'); bx = rf['box']
        out = await gm.evaluate(f"(() => {{ const c = document.getElementById('ring')._curve, d = (el) => {{ const r = el.getBoundingClientRect(); return Math.hypot((r.left + r.width / 2 - c.cx) / c.rx, (r.top + r.height / 2 - c.cy) / c.ry); }}; return {{ items: Math.min(...[...document.querySelectorAll('{NEST}')].map(d)), button: d(document.querySelector('#ring .rbtn.grp[data-group=\"replace\"]')) }}; }})()")
        # (the new ring: a sub-menu is the oval grown outward, one button per variant, not a panel over its button)
        check(rf['group'] == 'replace' and rf['nest'] and rf['anchorIs'] == 'replace' and len(rf['tiles']) == nv and out['items'] > out['button'] + 0.1 and bx[0] >= 0 and bx[1] >= 0 and bx[2] <= 1280 and bx[3] <= 820,
              'Replace ▸ opens its sub-menu as the ring grown outward from the Replace button, whole on screen', [rf, out])
        await gm.screenshot(path=os.path.join(SHOTS, 'ui-replace-submenu.png'))
        await wait(gm, f"document.querySelectorAll('{NEST} .pvw.live').length > 0", 15000, 'variant previews')
        check(nv > 0 and await gm.evaluate(f"document.querySelectorAll('{NEST} .pvw.live').length") > 0, 'replace with similar: the variants as turning previews', f'{nv} variants')
        old_sku = crate['sku']
        await gm.click(f'{NEST} >> nth=-1')
        check(await gm.evaluate("!document.querySelector('#ring .rbtn[data-nest]') && tw.ringState() === 'closed'"), 'choosing one closes the sub-menu and the open ring (as the tiles did)')
        await wait(gm, f"{E(crate['id'])}.sku !== '{old_sku}'", 5000, 'replaced')
        check(await gm.evaluate(f"{E(crate['id'])}.sku") != old_sku, 'choosing a variant replaces the mesh in place', await gm.evaluate(f"{E(crate['id'])}.cat"))
        stubs = await gm.evaluate("(async () => { tw.select(tw.selected()[0].id); await new Promise(r => setTimeout(r, 100)); document.querySelector('#ring [data-menu]').click(); await new Promise(r => setTimeout(r, 100)); return { greyed: document.querySelectorAll('#ring .rbtn.ex.disabled').length, order: [...document.querySelectorAll('#ring .rbtn.ex')].map(b => b.dataset.cmd) }; })()")
        stubs2 = await gm.evaluate("(async () => { document.querySelector('#ring [data-menu]').click(); await new Promise(r => setTimeout(r, 100)); document.querySelector('#ring [data-menu]').click(); await new Promise(r => setTimeout(r, 100)); return [...document.querySelectorAll('#ring .rbtn.ex')].map(b => b.dataset.cmd); })()")
        check(stubs['greyed'] == 0 and stubs['order'] == stubs2, 'what cannot be done is not shown at all (no greyed entries), and the order is the same every time', stubs['order'][:6])
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')

        print('PAWNS: ring, HP chips, conditions, label; player permissions', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_brakka0001', name: 'Brakka', x: 22, z: 30, owner: '{PL}', color: '#5aa9e6' }})")
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_goblin0001', name: 'Goblin', x: 30, z: 30, color: '#e5734f' })")
        await wait(pl, "tw.entities()['tok_brakka0001'] && tw.entities()['tok_goblin0001']", 6000)
        await topdown(pl, 25, 25, 60)
        b = await scr(pl, 22, 30, 2.4)
        await pl.evaluate("window.__ev = []; for (const t of ['pointerdown','pointerup']) document.getElementById('c').addEventListener(t, e => __ev.push(t), true)")
        await pl.mouse.click(b['x'], b['y'])
        if not await wait(pl, "tw.sel.has('tok_brakka0001')", 3000, 'player selects own pawn'):
            print('    picked:', await pl.evaluate(f"tw.worldOf(tw.area()).pickAll(tw.rayAt({b['x']}, {b['y']})).map(h => h.entity?.id || h.wall)"), await pl.evaluate(f"document.elementFromPoint({b['x']}, {b['y']})?.id"), await pl.evaluate('[...tw.sel]'), await pl.evaluate('JSON.stringify({ev: __ev, mode: tw.mode, focus: document.activeElement?.id || document.activeElement?.tagName, log: tw.selLog.slice(-3), press: tw.lastPress})'))
        await frame(pl, 22, 30)
        pr = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || 'menu')")
        check(pr == ['edit.rotate', 'pawn.sheet', 'pawn.damage', 'menu'], "pawn ring: turn (facing) · sheet · damage · ☰, no resize (Harry 2026-10-06)", pr)
        # drag the turn button: the pawn faces a new way (one step)
        rb = await pl.evaluate("(() => { const r = document.querySelector('#ring [data-cmd=\"edit.rotate\"]').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()")
        r0 = await gm.evaluate("tw.entities()['tok_brakka0001'].rot || 0")
        await drag(pl, rb, {'x': rb['x'] + 90, 'y': rb['y'] - 60}, steps=8)
        await wait(gm, f"Math.abs((tw.entities()['tok_brakka0001'].rot || 0) - {r0}) > 0.3", 5000, 'turned')
        check(abs((await gm.evaluate("tw.entities()['tok_brakka0001'].rot || 0")) - r0) > 0.3, 'dragging the turn button turns the pawn (seen by the GM)')
        await pl.keyboard.press('='); await pl.keyboard.press('=')
        await wait(gm, "tw.entities()['tok_brakka0001'].damage === 2", 5000, 'damage via keys')
        check(await gm.evaluate("tw.entities()['tok_brakka0001'].damage") == 2, 'player adds damage to their own pawn with = (seen by the GM)')
        await pl.click('#ring [data-menu]'); await pl.wait_for_timeout(100); await pl.click('#ring .rbtn.grp[data-group="pawn.cond."]'); await pl.wait_for_timeout(150)
        await pl.click('#ring .rbtn[data-nest][data-cmd="pawn.cond.poisoned"]')
        await wait(gm, "(tw.entities()['tok_brakka0001'].conditions || []).includes('poisoned')", 5000, 'condition')
        check(await gm.evaluate("tw.entities()['tok_brakka0001'].conditions"), 'condition badge set from the ☰ tree', await gm.evaluate("tw.entities()['tok_brakka0001'].conditions"))
        await pl.keyboard.press('F2'); await pl.keyboard.press('Control+a'); await pl.keyboard.type('Brakka the Bold'); await pl.keyboard.press('Enter')
        await wait(gm, "tw.entities()['tok_brakka0001'].name === 'Brakka the Bold'", 5000, 'label')
        check(await gm.evaluate("tw.entities()['tok_brakka0001'].name") == 'Brakka the Bold', 'the pawn\'s name edited by F2, type, Enter (on its sheet card since 2026-10-11)')
        # raise / lower: a flying pawn (drag the button up with Shift: 6-inch steps)
        await pl.evaluate("tw.select('tok_brakka0001')"); await pl.wait_for_timeout(200)
        await pl.click('#ring [data-menu]'); await pl.wait_for_timeout(200)
        lb_ = await pl.evaluate("(() => { const r = document.querySelector('#ring .rbtn.ex[data-cmd=\"edit.lift\"]').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()")
        mid = {}
        async def peek_lift():
            mid['readout'] = await pl.evaluate("document.querySelector('#ring .readout')?.innerText"); mid['gm'] = await gm.evaluate("tw.drawn ? null : null")
        await drag(pl, lb_, {'x': lb_['x'], 'y': lb_['y'] - 140}, steps=8, mods=('Shift',), during=peek_lift)
        await wait(gm, "(tw.entities()['tok_brakka0001'].y || 0) > 1", 5000, 'pawn lifted')
        py = await gm.evaluate("tw.entities()['tok_brakka0001'].y || 0")
        await wait(pl, 'tw.dropLines() === 1', 3000, 'drop line')
        check(py > 1 and abs(py * 2 - round(py * 2)) < 1e-6 and 'up' in (mid.get('readout') or '') and await pl.evaluate('tw.dropLines()') == 1, 'raise / lower: a pawn flies (drag, Shift = 6-in steps, height readout, faint drop line), synced', f"y = {py} ft; readout '{mid.get('readout')}'")
        await pl.keyboard.press('Escape'); await pl.wait_for_timeout(120)  # fold the open ring away: one of its buttons may sit over the goblin
        g = await scr(pl, 30, 30, 2.4); await pl.mouse.click(g['x'], g['y']); await pl.wait_for_timeout(300)
        check(await pl.evaluate("JSON.stringify([...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || 'menu'))") == '["pawn.sheet","pawn.damage","menu"]', "player on the GM's goblin: sheet · damage · ☰ only (2026-10-06: everyone can change everyone's damage; nothing else is theirs)", await pl.evaluate("JSON.stringify({ sel: [...tw.sel], ring: [...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || b.dataset.group || 'menu') })"))
        # GM: select both pawns, "-7" in the bar = damage chips
        await gm.evaluate("tw.select(['tok_brakka0001', 'tok_goblin0001'])"); await gm.wait_for_timeout(100)
        await gm.keyboard.press('/'); await gm.keyboard.type('+7'); await gm.wait_for_timeout(250)
        chips = await gm.evaluate("[...document.querySelectorAll('#bar .chips .chip')].map(c => c.innerText)")
        await gm.keyboard.press('Enter')
        await wait(pl, "tw.entities()['tok_goblin0001'].damage === 7 && tw.entities()['tok_brakka0001'].damage === 9", 5000, 'damage')
        check(chips[:2] == ['damage', '7'] and await pl.evaluate("tw.entities()['tok_brakka0001'].damage") == 9, '"+7" with pawns selected: chips damage ▸ 7 ▸ → both; applied as one step', chips)
        check(await gm.evaluate("document.querySelectorAll('#ring .count').length") == 1, 'multi-select: one ring around the group with a count')
        await gm.keyboard.press('Control+z')
        await wait(pl, "tw.entities()['tok_brakka0001'].damage === 2", 5000, 'undo damage')
        check(await pl.evaluate("tw.entities()['tok_goblin0001'].damage || 0") == 0, 'one undo restores both pawns (a multi-target action is one step)')

        print('FIRE: light / put out, synced (the tuner\'s fire FX follows in every tab)')
        await gm.keyboard.press('Escape')
        lit = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'object' && tw.assets.lightable(e.cat) && !e.parent && e.place !== 'ceiling')")
        if not lit:
            await gm.evaluate("(() => { const sz = tw.roomgen.sizeOf('candelabra-floor') || tw.roomgen.sizeOf('lantern-hanging'); tw.dispatch('object.place', { id: 'obj_candle00001', name: 'candelabra', cat: sz.sku.split('--')[0], sku: sz.sku, url: sz.url, place: 'floor', x: 40, y: 0, z: 30, s: sz.s, dims: sz.dims, yaw: sz.yaw }); })()")
            await gm.wait_for_timeout(800); lit = await gm.evaluate("tw.entities()['obj_candle00001']")
        await gm.evaluate(f"tw.select('{lit['id']}')"); await frame(gm, lit['x'], lit['z']); await gm.wait_for_timeout(300)
        await wait(gm, "tw.fxFlames() > 0", 8000, 'flames on')
        fg0 = await gm.evaluate('tw.fxFlames()')
        showLight = "(() => { if (!document.querySelector('#ring [data-cmd=\"thing.light\"]')) document.querySelector('#ring [data-menu]')?.click(); })()"  # a lit prop's light/put-out lives in its ☰ circle
        await gm.evaluate(showLight); await gm.wait_for_timeout(150)
        lb = await gm.evaluate("document.querySelector('#ring [data-cmd=\"thing.light\"]')?.getAttribute('aria-label')")
        await gm.click('#ring [data-cmd="thing.light"]')
        await wait(pl, f"tw.entities()['{lit['id']}'].lit === false", 8000, 'put out on player tab')
        await wait(gm, f"tw.fxFlames() < {fg0}", 8000, 'put out on GM tab')
        fg1 = await gm.evaluate('tw.fxFlames()'); pl_lit = await pl.evaluate(f"tw.entities()['{lit['id']}'].lit")
        await gm.evaluate(showLight); await gm.wait_for_timeout(150)
        lb2 = await gm.evaluate("document.querySelector('#ring [data-cmd=\"thing.light\"]')?.getAttribute('aria-label')")
        await gm.evaluate(showLight); await gm.wait_for_timeout(150)
        check(lb == 'Put out' and lb2 == 'Light' and fg1 < fg0 and pl_lit is False, f"{lit['cat']}: the ring's button shows its state (lit → 'Put out', dark → 'Light'); putting it out removes its flames, synced to the other tab", f'GM flames {fg0} → {fg1}; player tab lit = {pl_lit}')
        await gm.click('#ring [data-cmd="thing.light"]')
        await wait(pl, f"tw.entities()['{lit['id']}'].lit === true", 8000, 'relit'); await wait(gm, f"tw.fxFlames() >= {fg0}", 8000, 'flames back')
        check(await gm.evaluate('tw.fxFlames()') >= fg0 and await pl.evaluate(f"tw.entities()['{lit['id']}'].lit"), 'lighting it again brings the flames back (synced)')
        await bar(gm, 'selection footprint'); await gm.evaluate(f"tw.select('{lit['id']}')"); await gm.wait_for_timeout(200)
        await wait(gm, "tw.signals()[0]?.style === 'footprint'", 4000, 'footprint'); fs = await gm.evaluate('tw.signals()')
        await bar(gm, 'selection glow halo')
        check(fs and fs[0]['style'] == 'footprint' and fs[0]['kind'] == 'footprint' and fs[0]['depthTest'], 'switchable: the footprint on the ground instead of the halo (also depth-tested)', fs)

        print('TALK: say and roll', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        await bar(pl, 'say Hello from Brakka')
        await wait(gm, "(tw.view().chat || []).some(c => c.text === 'Hello from Brakka')", 5000, 'say')
        # announce-then-settle (2026-10-04): the line shows big and centred, then settles into the log
        seen = await wait(gm, "(document.body.innerText || '').includes('Hello from Brakka')", 3000, 'announce')
        await wait(gm, "document.querySelector('#chat').innerText.includes('Hello from Brakka')", 12000, 'settled into the log')
        check(seen and await gm.evaluate("document.querySelector('#chat').innerText.includes('Hello from Brakka')"), '"say …" posts chat: announced big on the other tab, then a scrollback line')
        await pl.keyboard.press('/'); await pl.keyboard.type('roll d20+5'); await pl.wait_for_timeout(250)
        rchips = await pl.evaluate("[...document.querySelectorAll('#bar .chips .chip')].map(c => c.innerText)")
        await pl.keyboard.press('Enter')
        await wait(gm, "(tw.view().chat || []).some(c => c.roll)", 5000, 'roll')
        roll = await gm.evaluate("(tw.view().chat || []).find(c => c.roll).roll")
        check(rchips == ['roll', 'd20', '+5'] and 6 <= roll['total'] <= 25 and roll['total'] == roll['rolls'][0] + 5, '"roll d20+5": chips roll ▸ d20 ▸ +5, one result for everyone', f"{rchips} → {roll['rolls']} + 5 = {roll['total']}")

        print('INPUT: marquee, Shift/Ctrl click, Ctrl+A, Esc, pan, zoom, frame, hierarchy, copy/paste through text', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        await topdown(gm, 25, 20, 80)
        objs = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}' && !e.parent).map(e => [e.id, e.x, e.z])")
        a, b = await scr(gm, 13, 8), await scr(gm, 22, 17)
        # start the marquee on empty ground just outside the room so it isn't a press on a thing
        # start on truly empty ground just outside the room (nothing picked there, nothing on screen over it)
        # Every candidate is probed at its centre and 6 px either side (a post or a jamb just beside the point would catch a
        # press that lands a pixel off), nearest the room first; there is NO blind fallback (the old list of six ended in
        # "use (8, 3) anyway", which is how one run in three pressed a post): none free = the check fails and says so.
        st = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()); const free = (s) => [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]].every(([dx, dy]) => !w.pickAll(tw.rayAt(s.x + dx, s.y + dy)).length && document.elementFromPoint(s.x + dx, s.y + dy)?.id === 'c');
          for (let d = 0; d <= 14; d++) for (const [x, z] of [[8 - d, 3], [8, 3 - d], [8 - d, 3 - d], [8 - d, 3 - d / 2], [8 - d / 2, 3 - d]]) { const s = tw.screenOf(x, z, tw.main, 0); if (s.x > 20 && s.y > 80 && free(s)) return { ...s, at: [x, z] }; } return null; })()""")
        if not st: check(False, 'empty ground beside the room to start a marquee on (none found)'); st = await scr(gm, 8, 3)
        await drag(gm, st, b, step_ms=40)
        await wait(gm, 'tw.sel.size >= 2', 3000, 'marquee selection')  # at 3 fps the marquee's last frame lands late
        msel = await gm.evaluate('[...tw.sel]')
        inside = [o[0] for o in objs if 8 <= o[1] <= 22 and 3 <= o[2] <= 17]
        check(len(msel) >= 2 and set(msel) <= set(o[0] for o in objs) | set(await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}').map(e => e.id)")), 'left-drag on empty space draws a marquee and selects what is wholly inside', f'{len(msel)} selected' + ('' if len(msel) >= 2 else f" {[(await gm.evaluate(f'tw.entities()[{chr(39)}{i}{chr(39)}]?.kind')) for i in msel]} press {await gm.evaluate('JSON.stringify(tw.lastPress)')} log {await gm.evaluate('JSON.stringify(tw.selLog.slice(-3))')}"))
        await wait(gm, "!document.querySelector('.ann')", 15000, 'no announcement up (Esc would dismiss it first)')
        await gm.keyboard.press('Escape')
        check(await gm.evaluate('tw.sel.size') == 0, 'Esc clears the selection')
        await gm.evaluate(f"tw.select('{prop['id']}')"); await gm.keyboard.press('Control+a')
        check(await gm.evaluate('tw.sel.size') >= 5, 'Ctrl+A selects all in the room', await gm.evaluate('tw.sel.size'))
        f0 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.dist]')
        await drag(gm, await scr(gm, 25, 20), await scr(gm, 15, 20), button='right', steps=6, step_ms=250)
        f1 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.dist]')
        s = await scr(gm, 25, 20); await gm.mouse.move(s['x'], s['y']); await gm.mouse.wheel(0, -300); await gm.wait_for_timeout(200)
        f2 = await gm.evaluate('tw.main.grab.dist')
        fz = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z]')
        sa, sb = await scr(gm, 25, 20), await scr(gm, 25, 10)
        await gm.mouse.move(sa['x'], sa['y']); await gm.keyboard.down('Space'); await gm.wait_for_timeout(100)
        diag = await gm.evaluate(f"JSON.stringify({{space: tw.spaceHeld(), el: document.elementFromPoint({sa['x']}, {sa['y']})?.id || document.elementFromPoint({sa['x']}, {sa['y']})?.className, mode: tw.mode}})")
        await drag(gm, sa, sb, steps=6, step_ms=300); await gm.keyboard.up('Space')  # slow: at a few fps Chromium delivers pointer moves per frame
        f3 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z]')
        o0 = await gm.evaluate('[tw.main.grab.yaw, tw.main.grab.pitch]')
        await drag(gm, {'x': 640, 'y': 400}, {'x': 760, 'y': 470}, button='middle', steps=6, step_ms=250)
        o1 = await gm.evaluate('[tw.main.grab.yaw, tw.main.grab.pitch, tw.main.grab.minPitch]')
        check(abs(o1[0] - o0[0]) > 20 and o1[1] >= o1[2], 'middle-drag orbits the camera (yaw changes, pitch stays above the floor)', f'yaw {o0[0]:.0f} → {o1[0]:.0f}, pitch {o0[1]:.0f} → {o1[1]:.0f}')
        if abs(f3[1] - fz[1]) < 3: print('    (space diag)', diag, fz, f3)
        f1 = [f1[0], fz[1], f1[2]]
        check(abs(f1[0] - f0[0]) > 5 and f2 < f1[2] and abs(f3[1] - f1[1]) > 3 and await gm.evaluate('tw.sel.size') >= 5, 'right-drag pans, wheel zooms to the cursor, Space+drag pans (selection untouched)', f'focus {f0[:2]} → {f1[:2]} → {f3}; dist {f1[2]:.0f} → {f2:.0f}')
        # THE CAMERA OVER A ROOM LABEL (2026-10-06). A label is DOM over the canvas: the wheel did not zoom there, a right-drag
        # that began on one did not pan, and Space + drag on one MOVED THE ROOM. (This was the "load on the GPU" failure
        # of the check above: whether the room's label sat under the pointer depended on the frame.)
        await gm.keyboard.press('Escape'); await topdown(gm, 25, 20, 80); await gm.wait_for_timeout(700)
        lab = await gm.evaluate("(() => { const l = tw.labelInfo().find(l => l.kind === 'room' && l.visible && l.rect); if (!l) return null; const e = tw.ent(l.id); return { id: l.id, x: (l.rect[0] + l.rect[2]) / 2, y: (l.rect[1] + l.rect[3]) / 2, rx: e.recipe.x, rz: e.recipe.z }; })()")
        if lab:
            over = await gm.evaluate(f"document.elementFromPoint({lab['x']}, {lab['y']})?.closest('.rlabel')?.dataset.id")
            c0 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.dist]')
            await gm.mouse.move(lab['x'], lab['y']); await gm.mouse.wheel(0, -300); await gm.wait_for_timeout(250)
            c1 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.dist]')
            await topdown(gm, 25, 20, 80); await gm.wait_for_timeout(500)
            lab2 = await gm.evaluate(f"(() => {{ const l = tw.labelInfo().find(l => l.id === '{lab['id']}' && l.rect); return l && {{ x: (l.rect[0] + l.rect[2]) / 2, y: (l.rect[1] + l.rect[3]) / 2 }}; }})()") or lab
            c2 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z]')
            await drag(gm, lab2, {'x': lab2['x'] - 140, 'y': lab2['y']}, button='right', steps=6, step_ms=120)
            c3 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z]')
            await topdown(gm, 25, 20, 80); await gm.wait_for_timeout(500)
            lab3 = await gm.evaluate(f"(() => {{ const l = tw.labelInfo().find(l => l.id === '{lab['id']}' && l.rect); return l && {{ x: (l.rect[0] + l.rect[2]) / 2, y: (l.rect[1] + l.rect[3]) / 2 }}; }})()") or lab
            await gm.mouse.move(lab3['x'], lab3['y']); await gm.keyboard.down('Space'); await gm.wait_for_timeout(100)
            await drag(gm, lab3, {'x': lab3['x'], 'y': lab3['y'] - 120}, steps=6, step_ms=120); await gm.keyboard.up('Space'); await gm.wait_for_timeout(300)
            c4 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z]')
            lroom = await gm.evaluate(f"(() => {{ const e = tw.ent('{lab['id']}'); return [e.recipe.x, e.recipe.z, tw.sync.pendingCount()]; }})()")
            check(over == lab['id'] and c1[2] < c0[2] - 5, 'the wheel zooms with the pointer over a room label', f'label under pointer {over == lab["id"]}; dist {c0[2]:.0f} → {c1[2]:.0f}')
            check(abs(c3[0] - c2[0]) > 5, 'a right-drag that starts on a room label pans', f'focus x {c2[0]:.1f} → {c3[0]:.1f}')
            check(abs(c4[1] - 20) > 3 and lroom[:2] == [lab['rx'], lab['rz']], 'Space + drag on a room label pans the camera and leaves the room where it was', f'focus z 20 → {c4[1]:.1f}; room {[lab["rx"], lab["rz"]]} → {lroom[:2]}')
        else: check(False, 'a room label is showing in the top-down view (needed for the camera-over-label checks)')
        await topdown(gm, 25, 20, 80)
        await gm.evaluate(f"tw.select('{prop['id']}')"); await gm.keyboard.press('f'); await gm.wait_for_timeout(150)
        fx = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z]')
        check(abs(fx[0] - prop['x']) < 3 and abs(fx[1] - prop['z']) < 3, 'F frames the selection')
        await gm.keyboard.press('Shift+Enter'); await gm.wait_for_timeout(100)
        check(await gm.evaluate(f"tw.sel.has('{room['id']}')"), 'Shift+Enter selects the parent (prop → room)')
        await gm.keyboard.press('Shift+Enter'); await gm.wait_for_timeout(100)
        bsel = await gm.evaluate("tw.selected()[0]?.kind")
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(100)
        check(bsel == 'building' and await gm.evaluate(f"tw.sel.has('{room['id']}')"), 'Shift+Enter again → the building; Enter → its rooms')
        crumbs = await gm.evaluate("document.querySelector('#crumbs').innerText.replace(/\\s+/g, ' ')")
        check('Building 1' in crumbs and 'Kitchen' in crumbs, 'a breadcrumb shows the path', crumbs)
        await gm.keyboard.press('Control+0'); await gm.wait_for_timeout(100)
        check(abs(await gm.evaluate('tw.main.grab.dist') - 95) < 1, 'Ctrl+0 resets the view')
        await topdown(gm, 25, 20, 80)
        # copy two props, send them through a plain text box, paste at the cursor: relative layout kept
        two = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{room['id']}' && !e.parent && e.place === 'floor' && !Object.values(tw.entities()).some(c => c.parent === e.id)).slice(0, 2)")
        await gm.evaluate(f"tw.select(['{two[0]['id']}', '{two[1]['id']}'])")
        await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(200)
        clip = await gm.evaluate("navigator.clipboard.readText()")
        await gm.evaluate("(() => { const t = document.createElement('textarea'); t.id = 'scratch'; Object.assign(t.style, {position: 'fixed', left: '10px', top: '300px', width: '300px', height: '80px', zIndex: 99}); document.body.append(t); })()")
        await gm.click('#scratch'); await gm.keyboard.press('Control+v'); await gm.keyboard.type('  (sent through Discord)')
        await gm.keyboard.press('Control+a'); await gm.keyboard.press('Control+c'); await gm.evaluate("document.querySelector('#scratch').remove()")
        n0 = await gm.evaluate("Object.keys(tw.entities()).length")
        s = await scr(gm, 50, 30); await gm.mouse.move(s['x'], s['y']); await gm.mouse.move(s['x'] + 1, s['y'])
        await gm.keyboard.press('Control+v')
        await wait(gm, f"Object.keys(tw.entities()).length === {n0 + 2}", 6000, 'pasted')
        pasted = await gm.evaluate("[...tw.sel].map(id => tw.entities()[id]).filter(Boolean).map(e => [e.cat, e.x, e.z])")
        if len(pasted) == 2:
            d0 = (two[1]['x'] - two[0]['x'], two[1]['z'] - two[0]['z'])
            byc = {p[0]: p for p in pasted}
            pa, pb = (pasted[0], pasted[1]) if pasted[0][0] == two[0]['cat'] else (pasted[1], pasted[0])
            d1 = (pb[1] - pa[1], pb[2] - pa[2]); cx = (pa[1] + pb[1]) / 2; cz = (pa[2] + pb[2]) / 2
            check(abs(d0[0] - d1[0]) < 0.05 and abs(d0[1] - d1[1]) < 0.05 and abs(cx - 50) < 1 and abs(cz - 30) < 1 and 'TW1:' in clip, 'copy → plain text through a text box → paste at the cursor: relative layout kept', f'offset {d0} kept; centre ({cx:.1f}, {cz:.1f})')
        else: check(False, 'paste through text', pasted)
        # Option/Alt-drag starting ON a thing rotates the view (Harry 2026-10-04: "Option to rotate"); Ctrl/Cmd+D duplicates
        n0 = await gm.evaluate("Object.keys(tw.entities()).length")
        b0 = await gm.evaluate(E(placed['id']))
        y0 = await gm.evaluate('tw.main.grab.yaw')
        await gm.evaluate(f"tw.select('{placed['id']}')")
        await drag(gm, await scr(gm, b0['x'], b0['z'], b0['dims'][1]), await scr(gm, b0['x'] + 6, b0['z']), mods=('Alt',))
        await gm.wait_for_timeout(300)
        y1 = await gm.evaluate('tw.main.grab.yaw')
        check(abs(y1 - y0) > 2 and await gm.evaluate(f"{E(placed['id'])}.x") == b0['x'] and await gm.evaluate("Object.keys(tw.entities()).length") == n0, 'Option-drag that starts on a thing rotates the view (nothing moves, nothing is copied)', f'yaw {y0:.1f} → {y1:.1f}')
        await gm.evaluate(f"tw.select('{placed['id']}')"); await gm.keyboard.press('Control+d')
        await wait(gm, f"Object.keys(tw.entities()).length === {n0 + 1}", 5000, 'ctrl+d dup')
        check(await gm.evaluate(f"{E(placed['id'])}.x") == b0['x'] and await gm.evaluate("Object.keys(tw.entities()).length") == n0 + 1, 'Ctrl/Cmd+D duplicates (the original stays)')

        print('UNDO per seat (two tabs), GM undoes anyone', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        g0 = await gm.evaluate(E(placed['id']))
        await gm.evaluate(f"tw.select('{placed['id']}')"); await gm.keyboard.press('ArrowLeft')
        await wait(gm, f"{E(placed['id'])}.x === {g0['x'] - 5}", 4000)
        await pl.evaluate("tw.select('tok_brakka0001')"); await pl.keyboard.press('ArrowRight')
        await wait(gm, "tw.entities()['tok_brakka0001'].x === 27", 4000, 'player nudge (one square)')
        await gm.keyboard.press('Control+z')
        await wait(gm, f"{E(placed['id'])}.x === {g0['x']}", 4000, 'gm undo own')
        check(await gm.evaluate("tw.entities()['tok_brakka0001'].x") == 27, "GM's Ctrl+Z undoes the GM's own move, not the player's")
        await pl.keyboard.press('Control+z')
        await wait(gm, "tw.entities()['tok_brakka0001'].x === 22", 4000, 'player undo own')
        check(await gm.evaluate("tw.entities()['tok_brakka0001'].x") == 22, "player's Ctrl+Z undoes the player's own move")
        await pl.keyboard.press('Control+Shift+z')
        await wait(gm, "tw.entities()['tok_brakka0001'].x === 27", 4000, 'player redo')
        check(await gm.evaluate("tw.entities()['tok_brakka0001'].x") == 27, 'Ctrl+Shift+Z redoes it')
        await bar(gm, 'undo Brakka')
        await wait(gm, "tw.entities()['tok_brakka0001'].x === 22", 4000, 'gm undo player')
        check(await gm.evaluate("tw.entities()['tok_brakka0001'].x") == 22, "GM undoes the player's action from the bar (\"undo Brakka\")")

        print('WALLS: the same room in the tuner and in the game has the same wall height', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        tctx = await browser.new_context(viewport={'width': 1100, 'height': 760}); tp = await tctx.new_page()
        await tp.bring_to_front(); await tp.goto(tuner_url, wait_until='domcontentloaded', timeout=120000); await tp.wait_for_function('window.tuner && tuner.rooms', timeout=120000)
        await tp.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)")
        await tp.wait_for_function('tuner.rooms().length === 1 && tuner.episodes() === 0', timeout=90000); await tp.wait_for_timeout(1500)
        th = await tp.evaluate("tuner.wallReport().filter(w => w.layer === 'walls' && /^wall-/.test(w.sku)).map(w => ({ sku: w.sku, h: w.size[1] }))")
        tseed = (await tp.evaluate('tuner.rooms()[0].seed')); await tctx.close(); await gm.bring_to_front()
        rid = await gm.evaluate(f"tw.spawnRoom('common', 20, 3, 6, 4, {tseed})")
        await wait(gm, f"tw.spawningNow().anims === 0 && tw.wallHeights('{rid}').length > 4", 30000, 'engine walls')
        eh = await gm.evaluate(f"tw.wallHeights('{rid}')")
        tmax, emax = max(w['h'] for w in th), max(w['h'] for w in eh)
        same_skus = sorted(set(w['sku'] for w in th)) == sorted(set(w['sku'] for w in eh))
        check(abs(tmax - emax) < 1 / 12 and same_skus and emax > 8, 'rendered wall height in the game matches the tuner within an inch (same seed, same wall pieces)', f'tuner {tmax:.2f} ft, game {emax:.2f} ft; pieces {sorted(set(w["sku"] for w in eh))}')

        print('SHEET, ROSTER, PiP', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        await gm.keyboard.press('Escape'); await gm.keyboard.press('?')
        sheet = await gm.evaluate("!document.querySelector('#sheet').hidden && document.querySelector('#sheet').innerText.includes('Undo')")
        await gm.keyboard.press('Escape')
        check(sheet and await gm.evaluate("document.querySelector('#sheet').hidden"), '"?" opens the shortcut sheet (generated from the registry); Esc closes it')
        av = await gm.evaluate("[...document.querySelectorAll('#roster .av')].map(a => a.title.split('\\n')[0])")
        check(len(av) == 2 and all('Area 1' in a for a in av), 'corner roster: an avatar per seat with location', av)
        await bar(gm, 'new area Cellar')
        await wait(gm, "tw.sync.campaign.areas.length === 2", 5000)
        T2 = await gm.evaluate("tw.sync.campaign.areas.find(t => t.name === 'Cellar').id")
        await gm.evaluate(f"tw.setMain('{T2}')"); await gm.wait_for_timeout(500)
        avr = await gm.evaluate(f"(() => {{ const r = document.querySelector('#roster .av[data-seat=\"{PL}\"]').getBoundingClientRect(); return {{x: r.left + 18, y: r.top + 18}}; }})()")
        await drag(gm, avr, {'x': 500, 'y': 400}, steps=12)
        await wait(gm, f"tw.pipInfo()?.area === '{T1}'", 5000, 'pip')
        pip = await gm.evaluate('tw.pipInfo()')
        await wait(gm, 'tw.pipInfo()?.points.length === 1', 5000, 'pip follows pawn')
        pip = await gm.evaluate('tw.pipInfo()')
        check(pip and pip['area'] == T1 and pip['rule'] == 'follow' and len(pip['points']) == 1, "drag a roster avatar out: PiP of their area, following their pawn", pip and {k: pip[k] for k in ('area', 'rule', 'follow', 'points')})
        await gm.screenshot(path=os.path.join(SHOTS, 'ui-pip.png'))

        print('TOUCH: long-press selects (ring appears)', f"[fps gm {await gm.evaluate('tw.fps')}, player {await pl.evaluate('tw.fps') if 'pl' in dir() else '-'}]")
        await gm.evaluate(f"tw.closePip(); tw.setMain('{T1}')"); await gm.wait_for_timeout(600)
        await topdown(gm, 25, 25, 60)
        t = await scr(gm, 30, 30, 2.4)
        await gm.evaluate(f"""(async () => {{ const c = document.getElementById('c'); const o = {{ pointerId: 7, pointerType: 'touch', clientX: {t['x']}, clientY: {t['y']}, bubbles: true, isPrimary: true }};
          c.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 650)); c.dispatchEvent(new PointerEvent('pointerup', o)); }})()""")
        await wait(gm, "tw.sel.has('tok_goblin0001')", 3000, 'long press')
        check(await gm.evaluate("tw.sel.has('tok_goblin0001') && !document.querySelector('#ring').hidden"), 'touch long-press selects the pawn and shows its ring')

        print('REMOTE SELECTION: what another seat has selected shows faintly in their colour')
        ok = await wait(pl, "tw.worldOf(tw.area()).halos.has('tok_goblin0001|rem')", 8000, 'remote sel')
        rs = await pl.evaluate("(() => { const h = tw.worldOf(tw.area()).halos.get('tok_goblin0001|rem'); let n = 0, op = []; h?.obj.traverse(o => { if (o.material) { n++; op.push(o.material.opacity ?? o.material.uniforms?.alpha?.value); } }); return { n, op: op.slice(0, 3), color: h?.color }; })()")
        gmc = await gm.evaluate('tw.myColor()')
        check(ok and rs['color'] == gmc and rs['n'] > 0, "the GM's selection appears on the player's screen, outlined in the GM's colour (low intensity)", rs)
        await gm.evaluate("tw.select([])")
        check(await wait(pl, "!tw.worldOf(tw.area()).halos.has('tok_goblin0001|rem')", 8000, 'remote clear'), 'and goes when the GM deselects')
        await gm.screenshot(path=os.path.join(SHOTS, 'ui-final-gm.png')); await pl.screenshot(path=os.path.join(SHOTS, 'ui-final-player.png'))
        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:')) and not (A.local and 'Failed to load resource' in e)]  # local: no version.json / ratings API
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser UI: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate(); p.wait(timeout=5)
        except Exception: pass
    import shutil
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(0 if ok else 1)
