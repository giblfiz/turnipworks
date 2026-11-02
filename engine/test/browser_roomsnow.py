#!/usr/bin/env python3
"""An area with no view yet (2026-11-01; prod tickets tkt_ca0515e32e, tkt_8c28438f82, tkt_d1e2cde9ec). One GM tab.

  local:  TW_GPU=0 python3 engine/test/browser_roomsnow.py --local
  dev:    ... browser_roomsnow.py --page https://dev.turnipworks.net/

A world exists before its first snapshot: from the first frame after the area is chosen, on every load and every travel.
Its caches are keyed on view.entities, which is undefined until the view comes, the same as a key that was never set, so
nothing filled them: roomsNow() answered undefined and roomYsNow() threw. With the cut on that was every frame (fogLevel,
caught in main.js, so nothing was drawn or finished); with or without it, every pointer move (floorPoint, uncaught).

  CACHE      the rooms are still kept: the same list until the state changes, then the new rooms
  TRAVEL     the cut on, the snapshot held back: frames finish, no error, the pointer can do anything; when the view
             comes, the level's fog is that view's (fogLevel keeps its answer: the empty one must not outlive the wait)
  LEFT       the cut on, and away again before the snapshot lands: it is dropped, so that world never gets a view; the
             page must go on drawing (it used to stop for good, loading screen up, until a reload)
  LOAD       a load with a saved cut, on a slow line, with the pointer moving
  GM         a GM-side world handed a null view (the relay's `hidden`, for an area gone): the hidden-things list is the same
             kind of cache
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); A = ap.parse_args()
results = []; procs = []; tmpdirs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18195,18820').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-rooms-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
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

# every error a page has: frames caught in main.js, and what reaches the window
INIT = """window.__errs = [];
{ const o = console.error; console.error = function (...a) { if (a[0] === 'frame') __errs.push('frame: ' + String(a[1]).slice(0, 120)); return o.apply(this, a); }; }
addEventListener('error', (e) => __errs.push('uncaught: ' + String(e.message).slice(0, 120) + ' ' + String(e.error?.stack || '').split('\\n')[1]?.trim().slice(0, 70)));"""
# hold a snapshot back, as a slow line would (tests only; the relay still sent it)
HOLD = """() => { if (window.__hold) return; const s = tw.sync, o = s.onMessage.bind(s); window.__hold = { areas: new Set(), held: [], pass: o }; s.onMessage = (m) => { if (m.t === 'snap' && __hold.areas.has(m.area)) { __hold.held.push(m); return; } o(m); }; }"""
RELEASE = "(() => { __hold.areas.clear(); for (const m of __hold.held.splice(0)) __hold.pass(m); })()"
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
LOADING = "(() => { const e = document.getElementById('twl'), s = e && getComputedStyle(e); return !!e && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.01; })()"
AREAS = dict(b='area_noviewb0001', c='area_noviewc0001', d='area_noviewd0001')

async def wait(pg, js, timeout=15000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def errs(pg): return await pg.evaluate('__errs.splice(0)')
async def frames_run(pg):  # do frames finish? (a frame that throws never reaches the count)
    a = await pg.evaluate('tw.stats.frames'); await pg.wait_for_timeout(1200); return await pg.evaluate('tw.stats.frames') - a
async def room(pg, a): await pg.evaluate(SPAWN, a); return await wait(pg, f"tw.entities()['{a['id']}'] && tw.sync.pendingCount() === 0", 30000, a['id'])
async def go(pg, area): await pg.evaluate(f"tw.setMain('{area}')"); return await wait(pg, f"tw.sync.view('{area}')", 15000, area)

async def level2(pg):  # lv 2 and its cut, written and still there after the frames that bring an area's own saved cut back (surfaces/cut.js restore)
    for _ in range(30):
        await pg.evaluate("tw.storeyTour && (tw.storeyTour.end ||= 'test'); tw.goLevel(10, 'test')"); await pg.wait_for_timeout(500)
        if await pg.evaluate("tw.cut.y === 19 && tw.level === 10"):
            await pg.wait_for_timeout(1000)
            if await pg.evaluate("tw.cut.y === 19 && tw.level === 10 && Object.values(JSON.parse(Object.entries(localStorage).find(([k]) => k.startsWith(`tw.cut.${tw.sync.campaign.id}.`))?.[1] || '{}').areas || {}).length > 0"): return True
    return False

async def hand(pg):
    """everything a hand can do on the canvas: move, press and release, double-click, wheel, the keys that ask where the pointer is"""
    await pg.mouse.move(380, 300); await pg.mouse.move(420, 320, steps=3)
    await pg.mouse.down(); await pg.mouse.move(440, 330, steps=2); await pg.mouse.up()
    await pg.mouse.click(460, 340, button='right'); await pg.mouse.click(400, 300, click_count=2)
    await pg.mouse.wheel(0, 120); await pg.wait_for_timeout(120)
    await pg.evaluate("(() => { try { return [tw.groundAt(400, 300), tw.pointAt(400, 300), tw.cutTargetAt(400, 300), tw.worldOf(tw.area()).pick(tw.rayAt(400, 300))].length; } catch (e) { __errs.push('asked: ' + e); } })()")

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        ctx = await browser.new_context(viewport={'width': 1000, 'height': 640}); await ctx.add_init_script(INIT)
        gm = await ctx.new_page()
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST no view yet {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live')
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })"); await wait(gm, 'tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0')
        home = await gm.evaluate('tw.area()')
        ok = await room(gm, dict(id='room_noviewground', type='common', x=0, z=0, w=4, d=4, seed=5101)) and await room(gm, dict(id='room_noviewupper1', type='guest', x=0, z=0, w=4, d=4, y=10, seed=5103))
        for i, (k, id_) in enumerate(AREAS.items()):
            await gm.evaluate(f"tw.sync.submit('area.create', {{ id: '{id_}', name: 'Road {k}' }})"); await wait(gm, f'tw.sync.campaign.areas.length === {i + 2}')
        check(ok and await gm.evaluate('tw.sync.campaign.areas.length') == 4, 'two storeys and three more areas')

        print('CACHE: the rooms are still kept')
        C = """(() => { const w = tw.worldOf(tw.area()), a = w.roomsNow(), y = w.roomYsNow(); return { same: a === w.roomsNow() && y === w.roomYsNow(), rooms: a.length, ys: y }; })()"""
        c0 = await gm.evaluate(C); check(c0['same'] and c0['rooms'] == 2 and c0['ys'] == [10, 0], 'the same list asked twice, and the heights high to low', str(c0))
        await gm.evaluate("window.__kept = tw.worldOf(tw.area()).roomsNow()"); await gm.wait_for_timeout(500)
        check(await gm.evaluate("__kept === tw.worldOf(tw.area()).roomsNow()"), 'and from frame to frame')
        await room(gm, dict(id='room_noviewcellar', type='cellar', x=0, z=0, w=4, d=4, y=-10, seed=5104)); c1 = await gm.evaluate(C)
        check(c1['rooms'] == 3 and c1['ys'] == [10, 0, -10] and not await gm.evaluate("__kept === tw.worldOf(tw.area()).roomsNow()"), 'a new state: the new room, on a new list', str(c1))

        # a room upstairs in B, its cut remembered there, then a fresh page: B's world is yet to be made
        check(await go(gm, AREAS['b']), 'to B')
        await room(gm, dict(id='room_noviewbgroun', type='common', x=0, z=0, w=4, d=4, seed=5106)); await room(gm, dict(id='room_noviewbupper', type='guest', x=0, z=0, w=4, d=4, y=10, seed=5105))
        check(await level2(gm), 'lv 2 in B, remembered')
        check(await go(gm, home), 'back home'); check(await level2(gm), 'lv 2 at home, remembered')
        await gm.reload(); check(await wait(gm, f"window.tw && tw.ready && tw.ready() && tw.sync.view('{home}')", 60000), 'a fresh page: every other area has no world yet')
        check(await wait(gm, 'tw.cut.y === 19', 10000), 'the cut is on, at lv 2', str(await gm.evaluate('tw.cut.y')))
        await gm.evaluate(HOLD); await errs(gm)

        print('TRAVEL: the cut on, the snapshot held back')
        b = AREAS['b']
        await gm.evaluate(f"__hold.areas.add('{b}'); tw.setMain('{b}')"); await wait(gm, f"tw.worlds.get('{b}')?.cut != null", 8000, "B's world exists, with the cut")
        NV = f"(() => {{ const w = tw.worlds.get('{b}'); try {{ return {{ view: w.view, cut: w.cut, rooms: w.roomsNow(), ys: w.roomYsNow() }}; }} catch (e) {{ return {{ view: w.view, cut: w.cut, threw: String(e) }}; }} }})()"
        s = await gm.evaluate(NV)
        check(s['view'] is None and s['cut'] == 19 and s.get('rooms') == [] and s.get('ys') == [], 'no view, the cut on: no rooms, and no heights', str(s))
        n = await frames_run(gm); check(n > 0, 'frames finish meanwhile', f'{n} in 1.2 s')
        e = await errs(gm); check(not e, 'no frame fails', str(e[:2]))
        await hand(gm); await hand(gm)
        e = await errs(gm); check(not e, 'and the pointer does everything it can with no error', str(e[:3]))
        await gm.evaluate("tw.goLevel(10, 'test')"); await wait(gm, f"tw.worlds.get('{b}').cut === 19", 8000, 'the cut back on (a double-click on open ground takes it off, as ever)'); await frames_run(gm)
        check(await gm.evaluate(f"tw.worlds.get('{b}').fogLevelKept === 0 && tw.worlds.get('{b}').fogLevelCut === 19"), 'fogLevel has kept its answer for the empty world', str(await gm.evaluate(f"tw.worlds.get('{b}').fogLevelKept")))
        await gm.evaluate(RELEASE); check(await wait(gm, f"tw.sync.view('{b}')"), 'the view comes')
        await wait(gm, "tw.cut.y === 19 && tw.level === 10", 8000, 'the cut remembered for B'); await gm.wait_for_timeout(1000)
        s = await gm.evaluate(f"(() => {{ const w = tw.worlds.get('{b}'); return {{ rooms: w.roomsNow().length, ys: w.roomYsNow(), fog: w.fogLevel(), applied: w.fogL ?? null, cut: w.cut }}; }})()")
        check(s['rooms'] == 2 and s['ys'] == [10, 0], "the rooms are the view's: the empty list did not outlive the wait", str(s))
        check(s['fog'] == 10 and s['applied'] == 10, 'the fog is on lv 2 (nor did the empty answer)', str(s))
        check(await wait(gm, f"!{LOADING}", 8000, 'the loading screen leaves'), 'no loading screen left up')
        e = await errs(gm); check(not e, 'no error after it either', str(e[:2]))

        print('LEFT: away again before the snapshot lands (it is dropped)')
        check(await go(gm, home), 'home again, the cut on'); await wait(gm, 'tw.cut.y === 19', 5000); await gm.wait_for_timeout(600)
        c_ = AREAS['c']
        await gm.evaluate(f"__hold.areas.add('{c_}'); tw.setMain('{c_}')"); await wait(gm, f"tw.worlds.has('{c_}')", 8000, "C's world")
        await gm.evaluate(f"tw.setMain('{home}')"); await gm.wait_for_timeout(250); await gm.evaluate(RELEASE)
        await gm.evaluate(f"tw.worlds.get('{c_}').setCut(19)")  # (the cut that froze the page; where C has no saved cut of its own a finished frame takes it off, so this says so)
        check(await wait(gm, f"tw.sync.view('{home}')", 15000), 'home has its view')
        check(await gm.evaluate(f"tw.worlds.get('{c_}').view === null && !tw.sync.view('{c_}')"), "C's world is left with no view, and none will come")
        await gm.wait_for_timeout(1500)
        n = await frames_run(gm); check(n > 0, 'the page goes on drawing', f'{n} frames in 1.2 s')
        check(await gm.evaluate("tw.lastRenders?.some(r => r.view === 'main')"), 'home is on the screen')
        check(await wait(gm, f"!{LOADING}", 8000, 'the loading screen leaves'), 'the loading screen left')
        await hand(gm); e = await errs(gm); check(not e, 'no error, by frame or by hand', str(e[:3]))

        print('LOAD: a saved cut, a slow line, the pointer moving')
        # (setMain only tells the relay where the seat is when the last answer says otherwise: there and back inside a round trip leaves the seat in C, and a reload would land there)
        was = await gm.evaluate('tw.sync.campaign.my.location'); print(f'    (the relay has the seat in {"home" if was == home else was})')
        await gm.evaluate(f"tw.sync.submit('seat.locate', {{ area: '{home}' }})"); await wait(gm, f"tw.sync.campaign.my.location === '{home}'", 8000, 'the seat is home')
        url = gm.url; head, _, frag = url.partition('#'); slow = head + ('&' if '?' in head else '?') + 'lag=300' + ('#' + frag if frag else '')
        await gm.goto(slow)
        for i in range(120):
            await gm.mouse.move(300 + i % 40, 300); await gm.wait_for_timeout(50)
            if await gm.evaluate(f"!!(window.tw && tw.sync?.view('{home}'))"): break
        check(await wait(gm, f"window.tw && tw.ready && tw.ready() && tw.sync.view('{home}')", 60000), 'the page came up')
        await gm.wait_for_timeout(1500)
        s = await gm.evaluate("(() => { const w = tw.worlds.get(tw.area()); return { cut: tw.cut.y, fog: w.fogLevel(), rooms: w.roomsNow().length }; })()")
        check(s['cut'] == 19 and s['fog'] == 10 and s['rooms'] == 3, 'the cut, the fog and the rooms are all there', str(s))
        e = await errs(gm); check(not e, 'no error on the way', str(e[:3]))

        print('GM: a GM-side world handed a null view')
        await gm.evaluate(HOLD)
        await gm.evaluate("(() => { const w = tw.worldOf('area_noviewgone01'); w.sync(null, { gmSide: true }); })()")
        n = await frames_run(gm); check(n > 0, 'frames finish', f'{n} in 1.2 s')
        e = await errs(gm); check(not e, 'no error', str(e[:2]))
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
    for r in bad: print('  FAILED:', r[1], '—', r[2])
    return 1 if bad else 0

code = 1
try: code = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
sys.exit(code)
