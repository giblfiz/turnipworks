#!/usr/bin/env python3
"""Every mouse and keyboard rotate pivots on the centre of the view (Harry 2026-11-02, from Nick's note: "when he rotates
the camera, it rotates from mouse center rather than center of screen"; this replaced the rule of 2026-10-04, the ground
under the pointer where the gesture started: docs/UI.md "Industry standards", input.js ROTATE_ON_POINTER).

Each gesture starts FAR from the middle of the view, and two ground points are watched on screen: the one at the centre
of the view must stay put, the one that was under the pointer must move. Real input: playwright's mouse, keyboard and
wheel, CDP touch points. (Safari's gesture events exist only in Safari: they are dispatched here, as in browser_build.)

  middle-drag, Option-drag, Alt+right-drag, Option + two-finger scroll, Safari's rotate, Q / E / PageUp / PageDown
  the PiP: the centre of THAT view; the main view does not move
  speed and invert reach the drag and the keys
  a view whose centre looks at no ground: nothing jumps, nothing throws
  what must NOT change: the wheel and Safari's pinch zoom at the pointer (and a held Q does not pull that back); a
  two-finger twist or tilt stays on the fingers' midpoint, off-centre

  local:  TW_GPU=1 TW_PORTS=18996,18997 python3 engine/test/browser_rotatepivot.py --local
"""
import argparse, asyncio, json, math, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE); import served
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18996,18997').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-pivot-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:100]})'); return False

W, H = 1280, 720
FAR = (1060, 170)  # where the gestures start: far from the middle of the view, off both its axes, clear of the launchers (a pointer near them can bring a tray up over the spot)
POSE = "(v) => { const g = v.grab; return { f: [g.focus.x, g.focus.z], yaw: g.yaw, pitch: g.pitch, dist: g.dist }; }"
async def pose(pg, v='main'): return await pg.evaluate(f"({POSE})(tw.{v})")
async def setpose(pg, v='main', x=40, z=30, dist=110, pitch=52, yaw=-20):
    await pg.evaluate(f"(() => {{ const V = tw.{v}, g = V.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); V.rule = 'free'; V.glide = null; }})()")
    await pg.wait_for_timeout(120)
async def centre(pg, v='main'):
    return await pg.evaluate(f"(() => {{ const r = tw.{v}.grab.dom.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()")
async def ground(pg, x, y, v='main'):
    p = await pg.evaluate(f"(() => {{ const p = tw.{v}.grab.groundAt({x}, {y}); return p && [p.x, p.z]; }})()"); return p
async def scr(pg, p, v='main'):
    s = await pg.evaluate(f"tw.screenOf({p[0]}, {p[1]}, tw.{v}, 0)"); return [s['x'], s['y']]
def dist2(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

async def watched(pg, gesture, name, start=FAR, v='main', need=(5, 40)):
    """Run the gesture and judge it: the centre's ground point stays put, the pointer's moves."""
    # (a chip can be up over the start spot just after a spawn: a press on it is a press on the chip, not on the map)
    check(await wait(pg, f"document.elementFromPoint({start[0]}, {start[1]})?.id === 'c'", 12000, 'the map under the start spot'), f'{name}: (fixture) the gesture starts on the map')
    c = await centre(pg, v); gc = await ground(pg, *c, v); gp = await ground(pg, *start, v); p0 = await pose(pg, v)
    sp0 = await scr(pg, gp, v)
    await gesture(); await pg.wait_for_timeout(120)
    p1 = await pose(pg, v); sc = await scr(pg, gc, v); sp = await scr(pg, gp, v)
    turned = max(abs(((p1['yaw'] - p0['yaw'] + 540) % 360) - 180), abs(p1['pitch'] - p0['pitch']))
    check(turned > need[0] and dist2(sc, c) < 2 and dist2(sp, sp0) > need[1], f'{name}: the point at the centre of the view stays put, the point that was under the pointer moves',
          {'turned°': round(turned, 1), 'centre off px': round(dist2(sc, c), 2), 'pointer point moved px': round(dist2(sp, sp0), 1)})

async def mouse_drag(pg, a, b, button='left', steps=8, mods=()):
    for m in mods: await pg.keyboard.down(m)
    await pg.mouse.move(*a); await pg.mouse.down(button=button)
    for i in range(1, steps + 1): await pg.mouse.move(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps); await pg.wait_for_timeout(16)
    await pg.mouse.up(button=button)
    for m in mods: await pg.keyboard.up(m)
    # (Chromium holds back a CDP middle release until the next press, on the old pivot as on this one, so the gesture would
    # stay open and the next move back to the start would undo the turn: it is closed here as the release would close it)
    await pg.wait_for_timeout(40)
    await pg.evaluate("if (tw.touchState().gesture) document.getElementById('c').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 1, pointerId: 1, pointerType: 'mouse' }))")
    await wait(pg, "!tw.touchState().gesture", 2000, 'the drag ended')

async def hold(pg, key, ms=420):
    await pg.keyboard.down(key); await pg.wait_for_timeout(ms); await pg.keyboard.up(key)

async def opt_scroll(pg, at, n=8, dx=9.5, dy=3.25):
    await pg.mouse.move(*at); await pg.keyboard.down('Alt')
    for _ in range(n): await pg.mouse.wheel(dx, dy); await pg.wait_for_timeout(30)
    await pg.keyboard.up('Alt')

GEST = """(x, y, steps) => { const c = document.getElementById('c');
  const ev = (t, s, r) => { const e = new Event(t, { cancelable: true }); Object.assign(e, { scale: s, rotation: r, clientX: x, clientY: y }); c.dispatchEvent(e); };
  ev('gesturestart', 1, 0); for (const [s, r] of steps) ev('gesturechange', s, r); ev('gestureend', 1, 0); }"""

async def touch(cdp, typ, pts):
    await cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce')
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        NAME = f"TEST pivot {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live', NAME)
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await gm.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
        await gm.evaluate("tw.spawnRoom('common', 4, 2, 8, 6, 42)")
        await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room') && tw.sync.pendingCount() === 0", 30000, 'room')
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 60000, 'spawn over')

        print('THE MAIN VIEW')
        for name, gesture in (
            ('middle-drag', lambda: mouse_drag(gm, FAR, (FAR[0] + 150, FAR[1] + 60), 'middle')),
            ('Option-drag', lambda: mouse_drag(gm, FAR, (FAR[0] + 150, FAR[1] + 60), 'left', mods=('Alt',))),
            ('Alt+right-drag', lambda: mouse_drag(gm, FAR, (FAR[0] + 150, FAR[1] + 60), 'right', mods=('Alt',))),
            ('Option + two-finger scroll', lambda: opt_scroll(gm, FAR)),
            ('Safari\'s two-finger rotate', lambda: gm.evaluate(f"({GEST})({FAR[0]}, {FAR[1]}, [[1, 8], [1, 16], [1, 24]])")),
            ('Q', lambda: hold(gm, 'q')), ('E', lambda: hold(gm, 'e')), ('PageUp', lambda: hold(gm, 'PageUp')), ('PageDown', lambda: hold(gm, 'PageDown'))):
            await setpose(gm)
            if name in ('Q', 'E', 'PageUp', 'PageDown'): await gm.mouse.move(*FAR); await gm.wait_for_timeout(60)
            await watched(gm, gesture, name)
        # the pitch stays above the floor, as before
        await setpose(gm, pitch=8)
        await mouse_drag(gm, (640, 200), (640, 40), 'middle')
        pz = await pose(gm); check(pz['pitch'] >= await gm.evaluate('tw.main.grab.minPitch') - 1e-6, 'a rotate still never goes below the floor', pz['pitch'])

        print('THE PiP: the centre of THAT view, and only that view moves')
        await setpose(gm)
        await gm.evaluate("tw.openPip(tw.area())"); await wait(gm, "!!tw.pip && !document.getElementById('pipFrame').hidden", 8000, 'PiP')
        await setpose(gm, 'pip', x=42, z=28, dist=90)
        rc = await gm.evaluate("(() => { const r = tw.pip.grab.dom.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()")
        cn = await centre(gm, 'pip'); cm = await centre(gm)
        check(dist2(cn, cm) > 100, "(fixture) the PiP's centre is not the main canvas's", [cn, cm])
        inner = (rc['l'] + rc['w'] * 0.14, rc['t'] + rc['h'] * 0.8)  # off to a corner of the PiP
        m0 = await pose(gm)
        for name, gesture in (
            ('PiP middle-drag', lambda: mouse_drag(gm, inner, (inner[0] + 90, inner[1] - 40), 'middle')),
            ('PiP Option-drag', lambda: mouse_drag(gm, inner, (inner[0] + 90, inner[1] - 40), 'left', mods=('Alt',))),
            ('PiP Option + two-finger scroll', lambda: opt_scroll(gm, inner)),
            ('PiP Safari rotate', lambda: gm.evaluate(f"({GEST})({inner[0]}, {inner[1]}, [[1, 8], [1, 16], [1, 24]])"))):
            await setpose(gm, 'pip', x=42, z=28, dist=90)
            await watched(gm, gesture, name, start=inner, v='pip', need=(5, 8))
        m1 = await pose(gm)
        check(m1 == m0, 'the main view never moved while the PiP turned', [m0, m1])
        await gm.mouse.move(*inner); await gm.wait_for_timeout(60); await setpose(gm)
        await watched(gm, lambda: hold(gm, 'q'), 'Q with the pointer over the PiP turns the MAIN view (as before), about the main centre', start=FAR)
        await gm.evaluate("tw.closePip()"); await gm.wait_for_timeout(150)

        print('SPEED AND INVERT reach the drag and the keys')
        await setpose(gm); await gm.evaluate("(() => { tw.prefs.rotateSpeed = 2; tw.prefs.invertRotate = true; })()")
        y0 = (await pose(gm))['yaw']; await mouse_drag(gm, FAR, (FAR[0] + 100, FAR[1]), 'middle'); y1 = (await pose(gm))['yaw']
        check(abs(((y1 - y0 + 540) % 360 - 180) - 80) < 1, 'a drag of 100 px at speed 2, inverted, turns 80° the other way (0.4 ° / px)', round(y1 - y0, 2))
        await setpose(gm); c = await centre(gm); gc = await ground(gm, *c); y0 = (await pose(gm))['yaw']; await gm.mouse.move(*FAR); await hold(gm, 'q'); y1 = (await pose(gm))['yaw']
        slow = await scr(gm, gc)
        await gm.evaluate("(() => { tw.prefs.rotateSpeed = 1; tw.prefs.invertRotate = false; })()")
        await setpose(gm); y2 = (await pose(gm))['yaw']; await gm.mouse.move(*FAR); await hold(gm, 'q'); y3 = (await pose(gm))['yaw']
        a, b = ((y1 - y0 + 540) % 360 - 180), ((y3 - y2 + 540) % 360 - 180)
        check(a * b < 0 and abs(a) > abs(b) * 1.3 and dist2(slow, c) < 2, 'Q held: speed and invert reach it, still about the centre', [round(a, 1), round(b, 1)])

        print('NO GROUND AT THE CENTRE: no jump, no throw')
        e0 = len(errors)
        async def track(gesture, name):
            await gm.evaluate("(() => { window.__t = []; const g = tw.main.grab; window.__ti = setInterval(() => __t.push([g.focus.x, g.focus.z, g.camera.position.x, g.camera.position.y, g.camera.position.z]), 16); })()")
            await gesture(); await gm.wait_for_timeout(80)
            tr = await gm.evaluate("(() => { clearInterval(__ti); return __t; })()")
            df = max(math.hypot(a[0] - tr[0][0], a[1] - tr[0][1]) for a in tr); step = max(math.dist(a[2:], b[2:]) for a, b in zip(tr, tr[1:]))
            check(df < 1e-6 and step < 30, f'{name}: the focus holds and the camera has no step', {'focus moved': round(df, 4), 'largest step ft': round(step, 2), 'dist': 110})
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 0, 30); g.minPitch = 0; g.pitch = 0; g.yaw = 0; g.dist = 110; g.update(); tw.main.rule = 'free'; })()")
        none = await gm.evaluate("(() => { const r = document.getElementById('c').getBoundingClientRect(); return tw.main.grab.groundAt(r.left + r.width / 2, r.top + r.height / 2) === null; })()")
        check(none, '(fixture) level with the horizon, the centre of the view looks at no ground')
        await track(lambda: mouse_drag(gm, FAR, (FAR[0] + 60, FAR[1]), 'middle'), 'a middle-drag at the horizon')
        await track(lambda: hold(gm, 'q', 250), 'Q at the horizon')
        await track(lambda: opt_scroll(gm, FAR, n=4), 'Option-scroll at the horizon')
        # the same with the view's focus off the ground (a library shelf, a swapped pose): the far ground is not swung about
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 30, 30); g.pitch = 6; g.yaw = 0; g.dist = 110; g.update(); })()")
        await track(lambda: mouse_drag(gm, FAR, (FAR[0] + 60, FAR[1] + 20), 'middle'), 'a middle-drag with the focus 30 ft up, nearly flat')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 0, 30); g.minPitch = 6; g.update(); })()")
        check(len(errors) == e0, 'nothing threw', errors[e0:e0 + 3])

        print('WHAT DID NOT CHANGE')
        await setpose(gm); gp = await ground(gm, *FAR); await gm.mouse.move(*FAR); await gm.mouse.wheel(0, -100); await gm.wait_for_timeout(250)
        s = await scr(gm, gp); check(dist2(s, FAR) < 2, 'the wheel still zooms toward the cursor', round(dist2(s, FAR), 2))
        await setpose(gm); gp = await ground(gm, *FAR); d0 = (await pose(gm))['dist']
        await gm.evaluate(f"({GEST})({FAR[0]}, {FAR[1]}, [[1.25, 0], [1.5, 0]])"); await gm.wait_for_timeout(100)
        s = await scr(gm, gp); check(dist2(s, FAR) < 2 and (await pose(gm))['dist'] < d0, "Safari's pinch still zooms at the pointer", round(dist2(s, FAR), 2))
        await setpose(gm); await gm.mouse.move(*FAR); gp = await ground(gm, *FAR); f0 = (await pose(gm))['f']; d0 = (await pose(gm))['dist']
        await gm.keyboard.down('q')
        for _ in range(4): await gm.mouse.wheel(0, -100); await gm.wait_for_timeout(60)
        await gm.keyboard.up('q'); f1 = (await pose(gm))['f']; d1 = (await pose(gm))['dist']
        check(d1 < d0 and dist2(f0, f1) > 2, 'the wheel during a held Q still zooms toward the cursor: the rotate does not pull the view back to the old centre', {'focus moved': round(dist2(f0, f1), 2), 'dist': [round(d0), round(d1)]})

        print('TOUCH: the fingers hold the world, off-centre (a context with touch)')
        ctx2 = await browser.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce', has_touch=True)
        t = await ctx2.new_page(); terr = []; t.on('pageerror', lambda e: terr.append(str(e)))
        await t.goto(page)
        await t.fill('#newCampaign input[name=name]', NAME + ' t'); await t.fill('#newCampaign input[name=gm]', 'Fauna-test'); await t.click('#newCampaign button')
        await wait(t, 'window.tw && tw.ready && tw.ready()', 60000, 'touch tab')
        await t.evaluate("document.querySelector('.lmcard .lm-x')?.click()")
        cdp = await ctx2.new_cdp_session(t)
        mid = (360, 300); R = 70  # far from the centre (640, 360)
        await setpose(t)
        gm_ = await ground(t, *mid); c = await centre(t); gc = await ground(t, *c)
        await touch(cdp, 'touchStart', [(mid[0] - R, mid[1]), (mid[0] + R, mid[1])])
        for s in range(1, 15):
            a = math.radians(40 * s / 14); await touch(cdp, 'touchMove', [(mid[0] - R * math.cos(a), mid[1] - R * math.sin(a)), (mid[0] + R * math.cos(a), mid[1] + R * math.sin(a))]); await asyncio.sleep(0.016)
        await asyncio.sleep(0.05); sm = await scr(t, gm_); sc = await scr(t, gc); await touch(cdp, 'touchEnd', []); await t.wait_for_timeout(150)
        p1 = await pose(t)
        check(abs(p1['yaw'] + 20) > 15 and dist2(sm, mid) < 3 and dist2(sc, c) > 20, "a two-finger twist off-centre stays on the fingers' midpoint, not the centre of the screen", {'midpoint off px': round(dist2(sm, mid), 2), 'centre moved px': round(dist2(sc, c), 1), 'yaw': round(p1['yaw'], 1)})
        await setpose(t)
        y = 460; gm_ = await ground(t, mid[0], y); c = await centre(t); gc = await ground(t, *c)
        await touch(cdp, 'touchStart', [(mid[0] - 60, y), (mid[0] + 60, y)])
        for s in range(1, 13): await touch(cdp, 'touchMove', [(mid[0] - 60, y - 100 * s / 12), (mid[0] + 60, y - 100 * s / 12)]); await asyncio.sleep(0.016)
        await asyncio.sleep(0.05); sm = await scr(t, gm_); sc = await scr(t, gc); lock = await t.evaluate("tw.twoFinger.lock"); await touch(cdp, 'touchEnd', []); await t.wait_for_timeout(150)
        p1 = await pose(t)
        check(lock == 'tilt' and abs(p1['pitch'] - 52) > 8 and dist2(sm, (mid[0], y)) < 3 and dist2(sc, c) > 8, "a two-finger tilt off-centre stays on where the fingers came down", {'lock': lock, 'point off px': round(dist2(sm, (mid[0], y)), 2), 'centre moved px': round(dist2(sc, c), 1), 'pitch': round(p1['pitch'], 1)})
        check(not terr, 'no page errors in the touch tab', terr[:2])
        await ctx2.close()

        real = [e for e in errors if 'favicon' not in e]
        check(not real, 'no page errors', real[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
    for r in bad: print('  FAIL', r[1], r[2])
    return 1 if bad else 0

code = 1
try: code = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(code)
