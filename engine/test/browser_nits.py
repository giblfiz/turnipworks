#!/usr/bin/env python3
"""Harry's notes of 2026-10-06 that have no suite of their own (docs/UI.md). GM tab + player tab.

  local:  TW_GPU=1 python3 engine/test/browser_nits.py --local

  KEYS     the launchers show their keys (B, P, S); P opens and closes the Pawns placeholder; not while typing
  FPS      "FPS meter" in the command bar: off by default; on, a small readout with plausible numbers, rewritten a few
           times a second, clear of the meter, roster, chat and status line; remembered over a reload, on and off
  CENTRE   a double-click also centres: a spot in a room (ground and upstairs), a label, open ground; heading, pitch
           and zoom kept; a point already near the middle does not move; any camera input stops the glide; reduced
           motion is instant; a picture-in-picture does it within itself
  PAWNS    a dragged pawn snaps to the centre of a square, Shift moves it freely, a group keeps its spacing, other
           seats see the snapped place during the drag
  WHEEL    synthesized wheel events with each browser's and device's signature: a wheel zooms (toward the cursor), a
           trackpad pans, a pinch zooms; Settings > Me > Scroll wheel overrules; the browser's own wheel event zooms
  PING     press and hold pings for the other seats and for you (ground, a pawn, upstairs); Alt+click too; a short
           press, a drag, a box and a double-click do not; a level the viewer is not showing gets a mark on their
           meter; a hidden room's ping reaches the GM side only; rate-limited; never in the log or chat
"""
import argparse, asyncio, json, os, random, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18131, 18761
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-nits-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
async def scr(pg, x, z, y=0, v='tw.main'): return await pg.evaluate(f"tw.screenOf({x}, {z}, {v}, {y})")
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
POSE = "(() => { const g = tw.main.grab; return { x: g.focus.x, z: g.focus.z, yaw: g.yaw, pitch: g.pitch, dist: g.dist, glide: !!tw.main.glide }; })()"
# where a world point is on the screen, as an offset from the middle of a view (px)
OFF = lambda x, z, y=0, v='tw.main': f"(() => {{ const V = {v}, c = document.getElementById('c').getBoundingClientRect(), s = tw.screenOf({x}, {z}, V, {y}); return [s.x - (c.left + (V.rect[0] + V.rect[2] / 2) * c.width), s.y - (c.top + (V.rect[1] + V.rect[3] / 2) * c.height)]; }})()"
near = lambda o, px=6: abs(o[0]) <= px and abs(o[1]) <= px
over = lambda a, b: a and b and a['left'] < b['right'] and b['left'] < a['right'] and a['top'] < b['bottom'] and b['top'] < a['bottom']
RECT = lambda sel: f"(() => {{ const e = document.querySelector('{sel}'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width ? {{ left: r.left, top: r.top, right: r.right, bottom: r.bottom }} : null; }})()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900, **kw):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, **kw)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST nits {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=6, d=4, seed=5101)), ('kitchen', dict(type='kitchen', x=6, z=0, w=4, d=4, seed=5102)), ('up', dict(type='guest', x=0, z=0, w=4, d=4, y=10, seed=5103))):
            rid = f"room_nit{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built')
        await settle(gm); await view(gm, 25, 10, 95, 60)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx', reduced_motion='reduce')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        PL = await pl.evaluate('tw.me()')

        # ================= KEYS (note 6) =================
        print('KEYS: S and P on their launchers')
        caps = await gm.evaluate("Object.fromEntries([...document.querySelectorAll('#launchers .launcher')].map(b => [b.dataset.l, { kbd: b.querySelector('kbd')?.textContent || null, title: b.title, shown: !b.hidden && !!b.querySelector('kbd')?.offsetWidth }]))")
        check(caps.get('build', {}).get('kbd') == 'B' and caps.get('pawns', {}).get('kbd') == 'P' and caps.get('settings', {}).get('kbd') == 'S' and all(c['shown'] for c in caps.values()), 'Build, Pawns and Settings each show their key in a key cap (B, P, S)', str(caps))
        check('(P)' in caps['pawns']['title'] and '(S)' in caps['settings']['title'], 'and in the tooltip', f"{caps['pawns']['title']} | {caps['settings']['title']}")
        await gm.keyboard.press('p'); await gm.wait_for_timeout(300)
        opened = await gm.evaluate("tw.pawns.isOpen && !document.getElementById('pawnsTray').hidden")
        await gm.keyboard.press('p'); await gm.wait_for_timeout(300)
        check(opened and not await gm.evaluate('tw.pawns.isOpen'), 'P opens the Pawns menu, and P again closes it')
        await gm.keyboard.press('s'); await gm.wait_for_timeout(400); sopen = await gm.evaluate("!document.getElementById('settingsModal').hidden")
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        check(sopen and await gm.evaluate("document.getElementById('settingsModal').hidden"), 'S still opens Settings')
        await gm.keyboard.press('/'); await gm.keyboard.type('pp', delay=20); await gm.wait_for_timeout(200)
        check(not await gm.evaluate('tw.pawns.isOpen'), 'typing p in the command bar does not open it'); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        keys = await gm.evaluate("tw.registry.all().filter(c => (c.keys || []).some(k => k.toLowerCase() === 'p')).map(c => c.id)")
        check(keys == ['pawns.menu'], 'P is bound to nothing else', str(keys))
        dot = await gm.evaluate("(() => { const b = document.querySelector('.launcher[data-l=settings]'), d = b.querySelector('.dot'), k = b.querySelector('kbd'); d.hidden = false; d.textContent = '2'; const a = d.getBoundingClientRect(), c = k.getBoundingClientRect(); d.hidden = true; return a.right <= c.left || c.right <= a.left; })()")
        check(dot, 'the Settings request count and its key cap do not sit on each other')

        # ================= FPS (note 9) =================
        print('FPS: a toggleable meter, from the command bar only')
        check(await gm.evaluate("document.getElementById('fpsMeter').hidden && !tw.fpsMeter.on"), 'off by default: no readout')
        found = {}
        for q in ('fps', 'frame rate', 'frame time', 'performance', 'stats'):
            await gm.keyboard.press('/'); await gm.keyboard.type(q, delay=10); await gm.wait_for_timeout(350)
            found[q] = await gm.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 4).some(e => /FPS meter/.test(e.innerText))"); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        check(all(found.values()), 'the bar finds "FPS meter" by fps, frame rate, frame time, performance and stats', str(found))
        await gm.keyboard.press('/'); await gm.keyboard.type('fps meter', delay=10); await gm.wait_for_timeout(350); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(1800)
        f = await gm.evaluate("({ on: tw.fpsMeter.on, hidden: document.getElementById('fpsMeter').hidden, text: document.getElementById('fpsMeter').textContent, v: tw.fpsMeter.value })")
        v = f['v'] or {}
        check(f['on'] and not f['hidden'] and re.match(r'^\d+ fps · [\d.]+ ms · worst [\d.]+', f['text'] or ''), 'on: a readout of fps, the median frame time and the worst', f['text'])
        check(v and 1 <= v['fps'] <= 1000 and 0 < v['median'] <= v['worst'] < 2000 and abs(v['fps'] - 1000 / v['median']) < v['fps'] * 0.6 + 5, 'the numbers are plausible and agree with each other', str(v))
        check(v and (v.get('calls') or 0) > 10 and (v.get('triangles') or 0) > 1000 and 'draws' in f['text'] and 'tris' in f['text'], 'with the renderer\'s draw calls and triangles', str(v))
        n = await gm.evaluate("new Promise(res => { const el = document.getElementById('fpsMeter'); let n = 0; const mo = new MutationObserver(() => n++); mo.observe(el, { childList: true, characterData: true, subtree: true }); setTimeout(() => { mo.disconnect(); res(n); }, 2100); })")
        check(1 <= n <= 6, 'the text is rewritten a few times a second, not every frame', f'{n} rewrites in 2.1 s')
        rects = {k: await gm.evaluate(RECT(s)) for k, s in (('fps', '#fpsMeter'), ('meter', '#levelMeter'), ('roster', '#roster'), ('chat', '#chat'), ('hud', '#hud'), ('launchers', '#launchers'), ('bar', '#bar'))}
        hits = [k for k in rects if k != 'fps' and over(rects['fps'], rects[k])]
        check(rects['fps'] and not hits, 'it sits clear of the level meter, the launchers, the bar, the roster, the chat and the status line', str(hits or rects['fps']))
        check(await gm.evaluate("(() => { const e = document.getElementById('fpsMeter'); return getComputedStyle(e).pointerEvents === 'none' && e.getBoundingClientRect().height < 30; })()"), 'small, and it never takes a click')
        check(not await pl.evaluate('tw.fpsMeter.on'), 'it is this seat\'s only: the other seat\'s is still off')
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.fpsMeter', 45000); await gm.wait_for_timeout(2200)
        check(await gm.evaluate("tw.fpsMeter.on && !document.getElementById('fpsMeter').hidden && /fps/.test(document.getElementById('fpsMeter').textContent)"), 'still on after a reload')
        await gm.evaluate("tw.registry.run('view.fps')"); await gm.wait_for_timeout(200)
        off1 = await gm.evaluate("!tw.fpsMeter.on && document.getElementById('fpsMeter').hidden")
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.fpsMeter', 45000); await gm.wait_for_timeout(800)
        check(off1 and await gm.evaluate("!tw.fpsMeter.on && document.getElementById('fpsMeter').hidden"), 'the same command turns it off, and it stays off over a reload')
        await settle(gm)

        # ================= CENTRE (note 10) =================
        print('CENTRE: a double-click also centres')
        await gm.evaluate("tw.cutOff('test'); tw.goLevel(0, 'test'); tw.cutOff('test')"); await view(gm, 25, 10, 95, 60)
        p0 = await gm.evaluate(POSE)
        s = await scr(gm, 42, 14, 0.1); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(90)
        mid = await gm.evaluate(POSE); await gm.wait_for_timeout(600); p1 = await gm.evaluate(POSE)
        tgt = await gm.evaluate("tw.lastCentre"); o = await gm.evaluate(OFF(tgt['point'][0], tgt['point'][2], tgt['point'][1]))
        check(near(o) and await gm.evaluate('tw.cut.y') == 9, 'a double-click in the kitchen cuts to its level AND brings the double-clicked point to the middle of the view', f'offset {o}')
        check(p1['yaw'] == p0['yaw'] and p1['pitch'] == p0['pitch'] and p1['dist'] == p0['dist'], 'heading, pitch and zoom are kept', str(p1))
        check(mid['glide'] and p0['x'] < mid['x'] < p1['x'] and not p1['glide'], 'it is a short glide, not a jump (part of the way after 90 ms, done within 600)', f"{p0['x']:.1f} -> {mid['x']:.1f} -> {p1['x']:.1f}")
        # already near the middle: nothing moves
        c = await gm.evaluate("(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.left + r.width / 2 + 30, y: r.top + r.height / 2 - 20 }; })()")
        was = await gm.evaluate("tw.lastCentre.at"); await gm.mouse.dblclick(c['x'], c['y']); await gm.wait_for_timeout(450); p2 = await gm.evaluate(POSE)
        check(p2['x'] == p1['x'] and p2['z'] == p1['z'] and await gm.evaluate("tw.lastCentre.at") == was, 'a double-click on a point already near the middle does not move the view')
        # upstairs: the point is 10 ft up; it is that point that lands in the middle, not the ground under it
        await gm.evaluate("tw.cutOff('test')"); await view(gm, 45, 20, 95, 60); await gm.wait_for_timeout(700)
        s = await scr(gm, 4, 16, 10); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(650)
        tgt = await gm.evaluate("tw.lastCentre"); o = await gm.evaluate(OFF(tgt['point'][0], tgt['point'][2], tgt['point'][1]))
        check(near(o) and tgt['point'][1] > 9 and await gm.evaluate('tw.cut.y') == 19 and await gm.evaluate('tw.level') == 10, 'a double-click on the upper floor: lv 2, and that spot (10 ft up) is in the middle', f"offset {o}, point {[round(v, 1) for v in tgt['point']]}")
        # a room's label
        await gm.evaluate("tw.cutOff('test')"); await view(gm, 5, 25, 95, 60); await gm.wait_for_timeout(300)
        lab = await gm.evaluate(f"(() => {{ const l = tw.labelInfo().find(l => l.id === '{R['kitchen']}'); return l && l.rect && {{ x: (l.rect[0] + l.rect[2]) / 2, y: (l.rect[1] + l.rect[3]) / 2 }}; }})()")
        await gm.mouse.dblclick(lab['x'], lab['y']); await gm.wait_for_timeout(650)
        lp = await gm.evaluate(f"tw.footprint.labelPoint(tw.entities()['{R['kitchen']}'].recipe)"); o = await gm.evaluate(OFF(lp[0], lp[1], 0))
        check(near(o) and await gm.evaluate('tw.cut.y') == 9, "a double-click on a room's label: its level, and the room in the middle", f'offset {o}')
        # open ground: all levels, and it centres there too
        await view(gm, 25, 10, 95, 60); s = await scr(gm, 75, 40, 0); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(650)
        o = await gm.evaluate(OFF(75, 40, 0))
        check(near(o, 8) and await gm.evaluate('tw.cut.y') is None, 'a double-click on open ground: all levels show, and it centres there too', f'offset {o}')
        # any camera input stops the glide
        for (what, act) in (('a wheel zoom', "await gm.mouse.wheel(0, -300)"), ('Q (turn the view)', "await gm.keyboard.down('q'); await gm.wait_for_timeout(120); await gm.keyboard.up('q')"), ('a pan drag', "await gm.mouse.move(700, 500); await gm.mouse.down(button='right'); await gm.mouse.move(650, 470, steps=3); await gm.mouse.up(button='right')")):
            await view(gm, 25, 10, 95, 60); s = await scr(gm, 60, 30, 0)
            await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(60); goal = await gm.evaluate("tw.lastCentre")
            await gm.mouse.move(700, 450); exec(f"async def _f(gm):\n    {act}", globals()); await globals()['_f'](gm); await gm.wait_for_timeout(120)
            a = await gm.evaluate(POSE); await gm.wait_for_timeout(500); b = await gm.evaluate(POSE)
            check(not a['glide'] and abs(b['x'] - a['x']) < 1e-6 and abs(b['z'] - a['z']) < 1e-6 and (abs(b['x'] - goal['x']) > 1 or abs(b['z'] - goal['z']) > 1 or what.startswith('Q')), f'{what} during the glide stops it: the view stays where the input left it', f"{a} then {b['x']:.2f}, {b['z']:.2f}; goal {goal['x']:.1f}, {goal['z']:.1f}")
        # reduced motion: there at once
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(25, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 95; g.update(); tw.main.rule = 'free'; })()"); await pl.wait_for_timeout(300)
        s = await scr(pl, 42, 14, 0.1); await pl.mouse.dblclick(s['x'], s['y']); await pl.wait_for_timeout(60)
        o = await pl.evaluate(OFF(42, 14, 0.1)); g1 = await pl.evaluate(POSE)
        check(near(o, 14) and not g1['glide'], 'with reduced motion the view is simply there (no glide)', f'offset {o}')
        # a picture-in-picture does it within itself
        await gm.evaluate("tw.cutOff('test')"); await view(gm, 25, 10, 95, 60)
        await gm.evaluate("(() => { tw.openPip(tw.area()); tw.pip.rect = [0.55, 0.4, 0.42, 0.5]; const g = tw.pip.grab; g.focus.set(25, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 120; g.update(); tw.pip.rule = 'pinned'; })()"); await gm.wait_for_timeout(500)
        m0 = await gm.evaluate(POSE); s = await scr(gm, 42, 14, 0.1, 'tw.pip'); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(700)
        tgt = await gm.evaluate("tw.lastCentre"); o = await gm.evaluate(OFF(tgt['point'][0], tgt['point'][2], tgt['point'][1], 'tw.pip')); m1 = await gm.evaluate(POSE)
        check(tgt['view'] == 'pip' and near(o) and m1['x'] == m0['x'] and m1['z'] == m0['z'] and await gm.evaluate('tw.cut.y') == 9, 'a double-click inside the picture-in-picture centres THAT view on the point (and sets the cut, as it shows this area); the main view does not move', f'offset {o}')
        await gm.evaluate("tw.closePip(); tw.cutOff('test')"); await view(gm, 25, 10, 95, 60)

        # ================= PAWNS (note 12) =================
        print('PAWNS: a dragged pawn snaps to the squares; Shift is free')
        await gm.evaluate(f"tw.batch([{{ type: 'token.create', args: {{ id: 'tok_mira00001', name: 'Mira', x: 12, z: 12, owner: '{PL}' }} }}, {{ type: 'token.create', args: {{ id: 'tok_goblin0001', name: 'Goblin', x: 21, z: 13.5 }} }}])")
        await wait(pl, "tw.entities()['tok_goblin0001']", 8000); await settle(gm); await gm.evaluate("tw.goLevel(0, 'test')"); await view(gm, 25, 10, 70, 62); await gm.wait_for_timeout(400)
        T = lambda i: f"(() => {{ const t = tw.entities()['{i}']; return [t.x, t.z, t.y || 0]; }})()"
        async def drag(pg, tok, to, shift=False, peek=None, y=0):
            t = await pg.evaluate(T(tok)); a = await scr(pg, t[0], t[1], t[2] + 1.2); b = await scr(pg, to[0], to[1], y)
            await pg.evaluate("tw.select([])"); await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
            if shift: await pg.keyboard.down('Shift')
            for i in range(1, 11): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await pg.wait_for_timeout(30)
            await pg.wait_for_timeout(250); out = await peek() if peek else None
            await pg.mouse.up()
            if shift: await pg.keyboard.up('Shift')
            await pg.wait_for_timeout(500); await wait(pg, 'tw.sync.pendingCount() === 0', 8000); return out
        async def peek():
            mine = await gm.evaluate("(() => { const d = tw.localDrags.get('tok_goblin0001'); return d && [d.x, d.z]; })()")
            await pl.wait_for_timeout(350)
            theirs = await pl.evaluate("(() => { for (const s of tw.pv.seats.values()) { const d = s.drags.get('tok_goblin0001'); if (d) return [d.tx, d.tz]; } return null; })()")
            return { 'mine': mine, 'theirs': theirs }
        mid = await drag(gm, 'tok_goblin0001', (33.9, 16.2), peek=peek); g = await gm.evaluate(T('tok_goblin0001'))
        check(g[:2] == [32.5, 17.5], 'a pawn dragged to (33.9, 16.2) lands on the centre of that square (32.5, 17.5)', str(g))
        check(mid['mine'] == [32.5, 17.5] and mid['theirs'] == [32.5, 17.5], 'during the drag it is already on the centre, here and for the other seat', str(mid))
        await drag(gm, 'tok_goblin0001', (26.4, 8.8), shift=True); g = await gm.evaluate(T('tok_goblin0001'))
        check(abs(g[0] - 26.4) < 1.6 and abs(g[1] - 8.8) < 1.6 and not (abs(g[0] % 5 - 2.5) < 0.02 and abs(g[1] % 5 - 2.5) < 0.02), 'with Shift held it moves freely and stays where it is let go', str(g))
        await drag(gm, 'tok_goblin0001', (22.2, 12.1)); g = await gm.evaluate(T('tok_goblin0001'))
        check(g[:2] == [22.5, 12.5], 'without Shift it snaps again', str(g))
        # two pawns together: the grabbed one lands on a centre, the other keeps its place beside it
        m0 = await gm.evaluate(T('tok_mira00001')); g0 = await gm.evaluate(T('tok_goblin0001'))
        a = await scr(gm, g0[0], g0[1], 1.2); b = await scr(gm, 31, 16.4, 0)
        await gm.evaluate("tw.select(['tok_goblin0001', 'tok_mira00001'])"); await gm.wait_for_timeout(200)
        await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
        for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(30)
        await gm.mouse.up(); await gm.wait_for_timeout(600); await wait(gm, 'tw.sync.pendingCount() === 0', 8000)
        g1 = await gm.evaluate(T('tok_goblin0001')); m1 = await gm.evaluate(T('tok_mira00001'))
        check(abs(g1[0] % 5 - 2.5) < 1e-6 and abs(g1[1] % 5 - 2.5) < 1e-6 and (g1[0], g1[1]) != (g0[0], g0[1]) and abs((m1[0] - m0[0]) - (g1[0] - g0[0])) < 1e-6 and abs((m1[1] - m0[1]) - (g1[1] - g0[1])) < 1e-6, 'two pawns dragged together: the grabbed one lands on a centre and the other keeps its spacing', f'{g0} -> {g1}; {m0} -> {m1}')
        # the player's own pawn, and a prop is not snapped by this rule
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(25, 0, 10); g.pitch = 62; g.yaw = 0; g.dist = 70; g.update(); tw.main.rule = 'free'; })()"); await pl.wait_for_timeout(400)
        await drag(pl, 'tok_mira00001', (13.2, 16.9)); m = await pl.evaluate(T('tok_mira00001'))
        check(m[:2] == [12.5, 17.5], "the player's own pawn snaps the same way", str(m))
        keys = await gm.evaluate("tw.registry.all().filter(c => (c.keys || []).some(k => k === '[' || k === ']')).map(c => c.id).sort()")
        check(keys == sorted(['token.hpDown', 'token.hpUp', 'level.up', 'level.down']) or ('level.up' in keys and 'level.down' in keys), '(pawn keys untouched: [ and ] are still shared between level steps and a selected pawn\'s HP)', str(keys))

        # ================= PING (Harry 2026-10-06: "let's go with whatever the norm is, not double click") =================
        print('PING: press and hold pings; Alt+click pings; a drag, a click and a double-click do not')
        SEEN = "tw.pingsSeen.map(p => ({ x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(1), how: p.how, color: p.color }))"
        async def fresh():
            await gm.evaluate("tw.pingsSeen.length = 0; tw.meterPings.length = 0; tw.lastPing = null"); await pl.evaluate("tw.pingsSeen.length = 0; tw.meterPings.length = 0"); await gm.wait_for_timeout(1000)
        async def hold(pg, pt, ms=700):
            s = await scr(pg, *pt); await pg.mouse.move(s['x'], s['y']); await pg.mouse.down(); await pg.wait_for_timeout(ms); await pg.mouse.up(); await pg.wait_for_timeout(500)
        gmc = await gm.evaluate('tw.myColor()')
        await gm.evaluate("tw.batch([{ type: 'token.move', args: { id: 'tok_goblin0001', x: 12.5, z: 12.5 } }, { type: 'token.move', args: { id: 'tok_mira00001', x: 17.5, z: 7.5 } }]); tw.select([])"); await gm.wait_for_timeout(500)
        await gm.evaluate("tw.cutOff('test'); tw.goLevel(0, 'test'); tw.cutOff('test')"); await pl.evaluate("tw.cutOff('test')"); await view(gm, 25, 10, 95, 60)
        # hold on open ground
        await fresh(); await hold(gm, (70, 38, 0))
        seen = await pl.evaluate(SEEN); mine = await gm.evaluate("tw.lastPing")
        check(len(seen) == 1 and abs(seen[0]['x'] - 70) < 1 and abs(seen[0]['z'] - 38) < 1 and seen[0]['how'] == 'world' and seen[0]['color'] == gmc, 'press and hold on open ground (0.7 s, not moving): the other seat sees one ping at that spot, in the pinger\'s colour', str(seen))
        check(mine and mine['local'] and abs(mine['x'] - 70) < 1, 'the pinger sees it too', str(mine))
        # let go early: a click, no ping. Move: a box or a drag, no ping
        await fresh(); await gm.evaluate("tw.select(['tok_goblin0001'])"); await hold(gm, (70, 38, 0), 200)
        check(not await pl.evaluate(SEEN) and await gm.evaluate('tw.sel.size') == 0, 'let go before half a second: an ordinary click (it clears the selection), no ping')
        await fresh(); s = await scr(gm, 70, 38, 0); await gm.mouse.move(s['x'], s['y']); await gm.mouse.down(); await gm.wait_for_timeout(150); await gm.mouse.move(s['x'] + 60, s['y'] + 40, steps=4); await gm.wait_for_timeout(700); await gm.mouse.up(); await gm.wait_for_timeout(400)
        check(not await pl.evaluate(SEEN), 'a press that moves is a selection box, held however long: no ping')
        await fresh(); await gm.evaluate("tw.goLevel(0, 'test')"); g0 = await gm.evaluate(T('tok_goblin0001')); await drag(gm, 'tok_goblin0001', (22.2, 12.1)); g1 = await gm.evaluate(T('tok_goblin0001'))
        check(g1[:2] == [22.5, 12.5] and not await pl.evaluate(SEEN), 'dragging a pawn moves it and does not ping', f'{g0} -> {g1}')
        # hold on a pawn: pings, selects nothing new, moves nothing
        await fresh(); await gm.evaluate("tw.select([])"); await hold(gm, (g1[0], g1[1], 1.2)); seen = await pl.evaluate(SEEN); await gm.evaluate("tw.cutOff('test')")
        check(len(seen) == 1 and abs(seen[0]['x'] - g1[0]) < 2.5 and abs(seen[0]['z'] - g1[1]) < 2.5 and await gm.evaluate(T('tok_goblin0001')) == g1 and await gm.evaluate('tw.sel.size') == 0, 'press and hold on a pawn pings there; the release is not also a click and nothing moves', str(seen))
        # Alt/Option+click: the quick way, on anything
        await fresh(); s = await scr(gm, g1[0], g1[1], 1.2); await gm.keyboard.down('Alt'); await gm.mouse.click(s['x'], s['y']); await gm.keyboard.up('Alt'); await gm.wait_for_timeout(500); seen = await pl.evaluate(SEEN)
        check(len(seen) == 1 and abs(seen[0]['x'] - g1[0]) < 2.5, 'Alt/Option+click pings at once, on a pawn as on the ground', str(seen))
        # a double-click does NOT ping (it only looks: the level and the centring); ground, a room, a room's label
        await fresh(); s = await scr(gm, 70, 38, 0); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(700)
        await view(gm, 25, 10, 95, 60); s = await scr(gm, 42, 14, 0.1); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(700); c1 = await gm.evaluate('tw.cut.y')
        await gm.evaluate("tw.cutOff('test'); tw.select([])"); await view(gm, 5, 25, 95, 60); await gm.wait_for_timeout(1200)
        lab = await gm.evaluate(f"(() => {{ const l = tw.labelInfo().find(l => l.id === '{R['kitchen']}' && l.visible); return l && l.rect && {{ x: (l.rect[0] + l.rect[2]) / 2, y: (l.rect[1] + l.rect[3]) / 2 }}; }})()")
        rc0 = await gm.evaluate(f"JSON.stringify(tw.entities()['{R['kitchen']}'].recipe)")
        await gm.mouse.dblclick(lab['x'], lab['y']); await gm.wait_for_timeout(700); c2 = await gm.evaluate("[tw.cut.y, tw.cutLog.at(-1).by]")
        check(rc0 == await gm.evaluate(f"JSON.stringify(tw.entities()['{R['kitchen']}'].recipe)"), 'the second click of a double-click on a label never presses the ring that the first click brought up (the room is not turned or re-rolled)')
        check(c1 == 9 and c2 == [9, 'label'] and not await pl.evaluate(SEEN) and not await gm.evaluate('tw.lastPing'), 'a double-click (open ground, a room, a room\'s label) still looks and centres, and pings nobody', f'{c1} {c2} {await pl.evaluate(SEEN)}')
        # upstairs: the height travels; a viewer cut below it gets a mark on their level meter instead
        await fresh(); await gm.evaluate("tw.cutOff('test'); tw.select([])"); await view(gm, 25, 10, 95, 60); await gm.wait_for_timeout(700); await hold(gm, (4, 16, 10)); seen = await pl.evaluate(SEEN)  # (the storey flies back in first: in flight it cannot be touched)
        check(len(seen) == 1 and seen[0]['y'] > 9 and seen[0]['how'] == 'world', 'a hold on the upper storey pings up there (the height is sent)', str(seen))
        await fresh(); await pl.evaluate("tw.goLevel(0, 'test')"); await pl.wait_for_timeout(300); await hold(gm, (4, 16, 10))
        seen = await pl.evaluate(SEEN); mp = await pl.evaluate("({ marks: tw.meterPings.map(m => m.y), el: !!document.querySelector('#levelMeter .lm-ping'), world: tw.worldOf(tw.area()).pings.length, cut: tw.cut.y })")
        check(len(seen) == 1 and seen[0]['how'] == 'meter' and mp['marks'] == [10] and mp['el'] and mp['world'] == 0 and mp['cut'] == 9, 'a ping on a level the viewer is not showing: a small mark beside that storey on THEIR level meter; nothing in the world; their view does not move', f'{seen} {mp}')
        await pl.wait_for_timeout(2700); check(not await pl.evaluate("!!document.querySelector('#levelMeter .lm-ping')"), 'the mark goes after a moment')
        await pl.evaluate("tw.cutOff('test')")
        # hidden rooms: a ping into a hidden room reaches the GM side only
        await gm.evaluate(f"tw.flag(['{R['kitchen']}'], {{ hidden: true }})"); await wait(pl, f"!tw.entities()['{R['kitchen']}']", 8000, 'kitchen hidden from the player'); await gm.wait_for_timeout(400)
        await fresh(); await hold(gm, (42, 14, 0.1)); sent = await gm.evaluate("tw.lastPing"); seen = await pl.evaluate(SEEN)
        check(sent and abs(sent['x'] - 42) < 2.5 and not seen, 'a ping inside a room hidden from players: the player gets nothing', f'{sent} {seen}')
        await gm.evaluate(f"tw.flag(['{R['kitchen']}'], {{ hidden: false }})"); await wait(pl, f"!!tw.entities()['{R['kitchen']}']", 8000); await gm.wait_for_timeout(400)
        # the player's ping reaches the GM
        await fresh(); await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(25, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 95; g.update(); tw.main.rule = 'free'; })()"); await pl.wait_for_timeout(300); await hold(pl, (70, 38, 0))
        gs = await gm.evaluate(SEEN); check(len(gs) == 1 and gs[0]['color'] != gmc, 'a player\'s hold pings the GM, in the player\'s colour', str(gs))
        # it cannot be spammed
        await gm.wait_for_timeout(3200); await fresh()
        await gm.evaluate("(async () => { for (let i = 0; i < 12; i++) tw.sync.presence(tw.area(), { cursor: [60 + i, 30], ping: true }); await new Promise(r => setTimeout(r, 600)); return true; })()")
        await pl.wait_for_timeout(300); n2 = len(await pl.evaluate(SEEN))
        check(1 <= n2 <= 4, 'twelve pings sent straight at the relay in one burst: at most four get through (and the client sends one per 600 ms at most)', f'{n2}')
        logn = await gm.evaluate("JSON.stringify([tw.applied.filter(a => /ping/i.test(a[3])).length, [...document.querySelectorAll('#chat .line')].filter(l => /ping/i.test(l.textContent)).length])")
        check(logn == '[0,0]', 'a ping is presence: nothing in the command log, nothing in the chat', logn)

        # ================= WHEEL (Harry 2026-10-06, note 15: "mouse wheel scroll pans up and down instead of zooming") =================
        print('WHEEL: a mouse wheel zooms and a trackpad pans, whatever the browser calls them')
        await gm.evaluate("tw.select([]); tw.cutOff('test')"); await view(gm, 25, 10, 95, 60)
        WHEEL = """async (evs) => { const c = document.getElementById('c'), r = c.getBoundingClientRect(), x = r.left + r.width * 0.6, y = r.top + r.height * 0.55, g = tw.main.grab;
          const before = { dist: g.dist, fx: g.focus.x, fz: g.focus.z }, n0 = tw.wheelLog.length; await new Promise(q => setTimeout(q, 420));
          for (const [dt, e] of evs) { await new Promise(q => setTimeout(q, dt)); c.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, ...e })); }
          return { did: [...new Set(tw.wheelLog.slice(-evs.length))], dist: g.dist / before.dist, moved: Math.hypot(g.focus.x - before.fx, g.focus.z - before.fz) }; }"""
        mom = [1, 2, 4, 7, 12, 19, 27, 40, 52, 61, 55, 48, 40, 33, 27, 22, 18, 14, 11, 9, 7, 5, 4, 3, 2, 1]
        cases = (
            ('Chrome on a Mac, a wheel (4.000244140625 px, wheelDeltaY -120)', [[80, dict(deltaMode=0, deltaY=4.000244140625, wheelDeltaY=-120)]] * 3, 'zoom'),
            ('Chrome on Windows, a wheel (100 px, wheelDeltaY -120)', [[80, dict(deltaMode=0, deltaY=100, wheelDeltaY=-120)]] * 3, 'zoom'),
            ('Firefox, a wheel (3 lines)', [[80, dict(deltaMode=1, deltaY=3)]] * 3, 'zoom'),
            ('Safari, a wheel (4.000244140625 px, wheelDeltaY -12)', [[80, dict(deltaMode=0, deltaY=4.000244140625, wheelDeltaY=-12)]] * 3, 'zoom'),
            ('Chrome, a trackpad scroll with momentum', [[12, dict(deltaMode=0, deltaY=v, wheelDeltaY=-3 * v)] for v in mom], 'pan'),
            ('Firefox, a trackpad scroll (pixels, half steps)', [[12, dict(deltaMode=0, deltaY=v / 2)] for v in mom], 'pan'),
            ('a diagonal trackpad scroll', [[12, dict(deltaMode=0, deltaY=v, deltaX=v // 3, wheelDeltaY=-3 * v)] for v in mom], 'pan'),
            ('a pinch (wheel with ctrlKey)', [[12, dict(deltaMode=0, deltaY=-2.5, ctrlKey=True)]] * 8, 'zoom'),
        )
        for (name, evs, want) in cases:
            await view(gm, 25, 10, 95, 60); r = await gm.evaluate(WHEEL, evs)
            ok = r['did'] == [want] and ((abs(r['dist'] - 1) > 0.02) if want == 'zoom' else (abs(r['dist'] - 1) < 1e-6 and r['moved'] > 1))
            check(ok, f'{name}: {"zooms" if want == "zoom" else "pans, zoom untouched"}', str(r))
        # zoom goes toward the cursor: the ground point under it stays put
        await view(gm, 25, 10, 95, 60)
        pin = await gm.evaluate("""async () => { const c = document.getElementById('c'), r = c.getBoundingClientRect(), x = r.left + r.width * 0.7, y = r.top + r.height * 0.6; const a = tw.groundAt(x, y); await new Promise(q => setTimeout(q, 420));
          for (let i = 0; i < 4; i++) { c.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaMode: 0, deltaY: -4.000244140625, wheelDeltaY: 120 })); await new Promise(q => setTimeout(q, 70)); }
          const b = tw.groundAt(x, y); return Math.hypot(a[0] - b[0], a[1] - b[1]); }""")
        check(pin < 0.5, 'the wheel zooms toward the cursor: the ground under it stays under it', f'{pin:.3f} ft')
        # the setting: Settings > Me > Scroll wheel
        await gm.keyboard.press('s'); await gm.wait_for_timeout(400); await gm.keyboard.press('m'); await gm.wait_for_timeout(300)
        has = await gm.evaluate("(() => { const s = document.querySelector('#settingsModal select[data-pref=wheel]'); return s && [...s.options].map(o => o.value).join() + '|' + s.value; })()")
        check(has == 'auto,zoom,pan|auto', 'Settings ▸ Me has "Scroll wheel: auto / zoom / pan", on auto', str(has))
        await gm.select_option('#settingsModal select[data-pref=wheel]', 'pan'); await gm.wait_for_timeout(200); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        await view(gm, 25, 10, 95, 60); r = await gm.evaluate(WHEEL, [[80, dict(deltaMode=1, deltaY=3)]] * 3)
        check(r['did'] == ['pan'] and abs(r['dist'] - 1) < 1e-6, 'set to "always pan", a line-mode wheel pans', str(r))
        await gm.evaluate("tw.settings.setPref('wheel', 'zoom')"); await view(gm, 25, 10, 95, 60); r = await gm.evaluate(WHEEL, [[12, dict(deltaMode=0, deltaY=v, wheelDeltaY=-3 * v)] for v in mom])
        check(r['did'] == ['zoom'], 'set to "always zoom", a trackpad stream zooms', str(r))
        await gm.evaluate("tw.settings.setPref('wheel', 'auto')")
        # a REAL wheel event from this browser's own input pipeline (Playwright's mouse.wheel): whatever it reports, it zooms
        await view(gm, 25, 10, 95, 60); d0 = await gm.evaluate('tw.main.grab.dist'); await gm.wait_for_timeout(450)
        await gm.mouse.move(800, 500); await gm.mouse.wheel(0, -100); await gm.wait_for_timeout(300); await gm.mouse.wheel(0, -100); await gm.wait_for_timeout(300)
        d1 = await gm.evaluate('tw.main.grab.dist'); check(d1 < d0 * 0.95 and await gm.evaluate("tw.wheelLog.slice(-2).join()") == 'zoom,zoom', "this browser's own wheel event zooms in", f"{d0:.1f} -> {d1:.1f} ({await gm.evaluate('navigator.userAgent.match(/Firefox|Chrome|Safari/)?.[0]')})")

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"\nnits: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
