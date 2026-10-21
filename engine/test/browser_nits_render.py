#!/usr/bin/env python3
"""Harry's notes of 2026-10-06, the three about what is DRAWN (docs/UI.md, docs/VERTICAL.md):

  FOG     "No fog on 2nd story or higher by default": an upper room's fog height is 0 whatever its type says; its own
          Fog height still wins; back to default is 0 again; nothing is stored; the ground and the cellar are as before.
  GHOST   "it is showing THRU things that are on the second floor. It DOES need to show over things on the first floor":
          lit squares on a level are seen over the storey below and are hidden by that level's own floor and walls.
          Below ground they are seen through the ground and hidden by the cellar's floor and walls.
  LABELS  "We are getting 'blinks' on some of the room labels": a slow zoom, a slow pan off the window's edge and a slow
          pan under the picture-in-picture, and a still camera at every stop on the way: no label changes between shown
          and hidden twice within 400 ms, and none changes at all while the camera is still.

  local:  TW_GPU=1 python3 engine/test/browser_nits_render.py --local [--shots]
"""
import argparse, asyncio, io, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
RP, SP = 18121, 18751
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-nr-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500&atmos=morning-mist'
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects }, stair: false } }]); return a.id; }"""
W = "tw.worldOf(tw.area())"
FOGROOMS = f"(() => {{ const w = {W}; w.fx.atmos.warm?.(5); return {{ level: w.fogLevel(), mine: w.fogRooms().map(r => [r.id, r.height]), resolved: w.fx.atmos.rooms().map(r => [r.id, r.resolved]) }}; }})()"
async def view(pg, x, z, dist=95, pitch=60, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
async def pixels(pg, pts):
    """[r, g, b] of the page at each world point [x, y, z]"""
    scr = await pg.evaluate(f"({json.dumps(pts)}).map(([x, y, z]) => {{ const s = tw.screenOf(x, z, tw.main, y); return [s.x, s.y]; }})")
    im = Image.open(io.BytesIO(await pg.screenshot())).convert('RGB')
    return [im.getpixel((max(0, min(im.width - 1, round(x))), max(0, min(im.height - 1, round(y))))) for x, y in scr], scr
magenta = lambda p: p[0] - p[1] > 70 and p[2] - p[1] > 70

# every change of every label between shown and hidden, with its time (one sample per animation frame)
SAMPLER = """(() => { if (window.__lab) return; const L = window.__lab = { ch: {}, st: {}, last: {}, slot: {}, frames: 0 };
  (function loop() { const t = Math.round(performance.now()); L.frames++; const F = tw.labelFlips();
    for (const el of document.querySelectorAll('.rlabel')) { const id = el.dataset.id, on = el.classList.contains('on'); if (L.last[id] !== undefined && L.last[id] !== on) (L.ch[id] ||= []).push(t); L.last[id] = on;
      const sl = F[id]?.slot ?? null; if (on && L.slot[id] != null && sl != null && sl !== L.slot[id]) (L.st[id] ||= []).push(t); L.slot[id] = on ? sl : null; }
    requestAnimationFrame(loop); })(); })()"""
TAKE = "(() => { const c = __lab.ch, s = __lab.st; __lab.ch = {}; __lab.st = {}; return { ch: c, st: s, on: Object.values(__lab.last).filter(Boolean).length, all: Object.keys(__lab.last).length }; })()"
def gaps(ch):
    n = sum(len(v) for v in ch.values()); g = [b - a for v in ch.values() for a, b in zip(v, v[1:])]
    return n, (min(g) if g else None)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro&atmos=morning-mist'
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        gm = await (await browser.new_context(viewport={'width': 1400, 'height': 900})).new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST nits render {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        async def build(name, **a):
            rid = f"room_n{name}{random.randrange(10**6):06d}"[:24]; R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name)
        await view(gm, 15, 10)
        await build('common', type='common', x=0, z=0, w=6, d=4, seed=7101)
        await build('up', type='cellar', x=0, z=0, w=3, d=4, y=10, seed=7102)        # a CELLAR-type room upstairs: its type's fog is 2.5 ft
        await build('cellar', type='cellar', x=0, z=0, w=4, d=4, y=-10, seed=7103)
        await settle(gm); await gm.wait_for_timeout(1500)

        print('FOG: none on a second storey or higher by default')
        ent = await gm.evaluate(f"({{ up: tw.entities()['{R['up']}'], storey: tw.entities()['{R['up']}'].recipe.y }})")
        check('fog' not in ent['up'] and ent['storey'] == 10, 'the upper room is a cellar-type room at 10 ft with no fog of its own stored')
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['up']}'], 'test')"); await gm.wait_for_timeout(900)
        f = await gm.evaluate(FOGROOMS)
        check(f['level'] == 10 and f['mine'] == [[R['up'], 0]] and f['resolved'] == [[R['up'], 0]], 'looking at lv 2: its fog height is 0, whatever its room type says', f)
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['up']}', fog: 3 }})"); await gm.wait_for_timeout(600)
        f = await gm.evaluate(FOGROOMS)
        check(f['resolved'] == [[R['up'], 3]], 'the GM gives it 3 ft with Fog height: it has 3 ft', f['resolved'])
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['up']}', fog: 0.5 }})"); await gm.wait_for_timeout(400)
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['up']}', fog: -1 }})"); await gm.wait_for_timeout(600)
        f = await gm.evaluate(FOGROOMS); e2 = await gm.evaluate(f"tw.entities()['{R['up']}']")
        check(f['resolved'] == [[R['up'], 0]] and 'fog' not in e2, 'back to the default: none again, and nothing stored', f['resolved'])
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['cellar']}'], 'test')"); await gm.wait_for_timeout(900)
        f = await gm.evaluate(FOGROOMS)
        check(f['level'] == -10 and f['mine'] == [[R['cellar'], None]] and f['resolved'][0][1] > 1, 'the cellar below ground keeps its type\'s fog', f)
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(600)
        f = await gm.evaluate(FOGROOMS)
        check(f['level'] == 0 and f['mine'] == [[R['common'], None]], 'the ground floor follows its type as before', f['mine'])
        # the Fog height track says so (2026-10-20: it is a drag track on the ring now, not a slider panel)
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['up']}'], 'test'); tw.select('{R['up']}'); tw.emit('ring.fog', tw.entities()['{R['up']}'])"); await gm.wait_for_timeout(900)
        fb = await gm.evaluate("(() => { const r = document.querySelector('#ring .rbtn[data-cmd=\"room.fog\"]')?.getBoundingClientRect(); return r && r.width && r.left > 0 && r.top > 0 && r.right < innerWidth && r.bottom < innerHeight ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()")
        sl = None
        if fb:
            await gm.mouse.move(fb['x'], fb['y']); await gm.mouse.down(); await gm.wait_for_timeout(150)
            sl = await gm.evaluate("(() => { const d = tw.ringDrag(); return d && d.kind === 'fog' ? { start: d.track.start, marks: d.track.marks.map(m => [m.v, m.label]) } : null; })()")
            await gm.mouse.up(); await gm.wait_for_timeout(300)
        check(sl and sl['start'] == 0 and any(v == 0 and 'none' in l and 'default' in l for v, l in sl['marks']) and not any(v > 0 for v, _ in sl['marks']), 'the Fog height track on the upper room starts at none, and none is its default', sl or fb)
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.select([]); tw.cutOff('test')"); await gm.wait_for_timeout(400)

        print('GHOST: over what is below the level, behind what is on it')
        GH = lambda y, cells: f"{W}.showCells('test-ghost', {{ lit: {json.dumps(cells)}, color: '#ff00ff', opacity: 1, y: {y} }})"
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['up']}'], 'test')"); await view(gm, 15, 8, dist=80, pitch=60, y=10); await gm.wait_for_timeout(900)
        # squares: 4,1 over the common room (free at lv 2); 4,0 on the common room's north wall line; 1,1 inside the upper room
        # (its floor covers it); 1,-1 behind the upper room's north wall as seen from the south
        await gm.evaluate(GH(10, [[4, 1], [4, 0], [1, 1], [1, -1], [5, 2]])); await gm.wait_for_timeout(500)
        info = await gm.evaluate(f"{W}.ghostInfo()")
        check(all(g.get('mode') == 'depth' for g in info if 'mode' in g) and not any('passes' in g for g in info), 'on an upper level the ghost uses the ordinary depth test (no extra pass)', info)
        px, scr = await pixels(gm, [[22.5, 9.7, 7.5], [22.5, 9.7, 0.4], [7.5, 9.7, 7.5], [7.5, 9.7, -1.5], [27.5, 9.7, 12.5]])
        if A.shots: os.makedirs(SHOTS, exist_ok=True); await gm.screenshot(path=os.path.join(SHOTS, 'nits-ghost-up-test.png'))
        check(magenta(px[0]) and magenta(px[4]), 'a square over the room below is drawn OVER that room', [px[0], px[4]])
        check(magenta(px[1]), 'and over the top of the lower room\'s wall', px[1])
        check(not magenta(px[2]), 'a square under the upper room\'s own floor is hidden by that floor', px[2])
        check(not magenta(px[3]), 'a square behind the upper room\'s wall is hidden by the wall', px[3])
        await gm.evaluate(f"{W}.clearCells('test-ghost')")
        # the real tool: the grid and the valid squares of the level come up in the same mode
        await gm.evaluate("tw.modes.roomTool('guest', { tool: true }); tw.setLevel(10, { quiet: true })"); await gm.wait_for_timeout(700)
        info = await gm.evaluate(f"{W}.ghostInfo()")
        check(len([g for g in info if g.get('mode') == 'depth']) >= 3 and abs(info[0]['at'] - 9.7) < 0.01, 'the room tool\'s grid and valid squares on lv 2 are depth-tested, 0.3 ft under the floor line', info)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'nits-ghost-up.png'))
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.modes.cancel?.()"); await gm.wait_for_timeout(300)
        # below ground
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['cellar']}'], 'test')"); await view(gm, 15, 8, dist=80, pitch=60, y=-10); await gm.wait_for_timeout(900)
        p0 = (await gm.evaluate(f"{W}.ghostPasses || 0"))
        await gm.evaluate(GH(-10, [[6, 1], [6, 2], [1, 1], [1, -1]])); await gm.wait_for_timeout(600)
        info = await gm.evaluate(f"{W}.ghostInfo()"); p1 = await gm.evaluate(f"{W}.ghostPasses || 0")
        check(all(g.get('mode') == 'pre' for g in info if 'mode' in g) and p1 > p0, 'below ground the ghost tests against a depth pass of the rooms without the ground', {'passes': [p0, p1]})
        px, scr = await pixels(gm, [[32.5, -10.3, 7.5], [32.5, -10.3, 12.5], [7.5, -10.3, 7.5], [7.5, -10.3, -1.5]])
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'nits-ghost-down-test.png'))
        check(magenta(px[0]) and magenta(px[1]), 'a square under the unopened ground shows THROUGH the ground', px[:2])
        check(not magenta(px[2]), 'a square under the cellar\'s own floor is hidden by that floor', px[2])
        check(not magenta(px[3]), 'a square behind the cellar\'s wall is hidden by the wall', px[3])
        await gm.evaluate(f"{W}.clearCells('test-ghost')"); await gm.wait_for_timeout(300)
        p2 = await gm.evaluate(f"{W}.ghostPasses || 0"); await gm.wait_for_timeout(400); p3 = await gm.evaluate(f"{W}.ghostPasses || 0")
        check(p3 == p2, 'with no ghost up, the extra pass does not run', [p2, p3])
        if A.shots:
            await gm.evaluate("tw.modes.roomTool('cellar', { tool: true }); tw.setLevel(-10, { quiet: true })"); await gm.wait_for_timeout(700)
            await gm.screenshot(path=os.path.join(SHOTS, 'nits-ghost-down.png')); await gm.keyboard.press('Escape'); await gm.evaluate("tw.modes.cancel?.()")
        await gm.evaluate("tw.cutOff('test'); tw.setLevel(0, { quiet: true })"); await gm.wait_for_timeout(400)

        print('LABELS: no blinking')
        # a block of small rooms beside the inn, so their labels crowd as the view pulls back
        types = ['guest', 'kitchen', 'privy', 'storeroom', 'desk', 'guest', 'hallway', 'kitchen']
        for i, t in enumerate(types): await build(f'l{i}', type=t, x=10 + (i % 4) * 3, z=(i // 4) * 3, w=3, d=3, seed=7200 + i)
        await settle(gm); await gm.wait_for_timeout(800)
        await gm.evaluate(SAMPLER)
        async def sweep(name, steps_n, set_js, hold_every=12, ms=35):
            """move the camera in small steps; at every `hold_every`-th step stand still for 1.2 s"""
            await gm.evaluate(set_js(0)); await gm.wait_for_timeout(900); await gm.evaluate(TAKE)
            moving = {}; steps = {}; still = 0; seen = set()
            for i in range(1, steps_n + 1):
                await gm.evaluate(set_js(i / steps_n)); await gm.wait_for_timeout(ms)
                if i % hold_every == 0:
                    t = await gm.evaluate(TAKE)
                    for k, v in t['ch'].items(): moving.setdefault(k, []).extend(v)
                    for k, v in t['st'].items(): steps.setdefault(k, []).extend(v)
                    seen.add(t['on'])
                    await gm.wait_for_timeout(600); await gm.evaluate(TAKE)   # (a change may still land within the dwell of the last move)
                    await gm.wait_for_timeout(1200); t = await gm.evaluate(TAKE); still += sum(len(v) for v in t['ch'].values()) + sum(len(v) for v in t['st'].values())
            n, g = gaps(moving); ns, gs = gaps(steps)
            check(g is None or g >= 400, f'{name}: no label changes between shown and hidden twice within 400 ms', {'changes': n, 'shortest gap ms': g, 'labels': len(moving)})
            check(gs is None or gs >= 400, f'{name}: no label steps to another place twice within 400 ms', {'steps': ns, 'shortest gap ms': gs})
            check(still == 0, f'{name}: with the camera still, nothing changes or moves', still)
            return n, seen
        G = lambda body: (lambda t: f"(() => {{ const t = {t}, g = tw.main.grab; {body} g.update(); tw.main.rule = 'free'; }})()")
        n, seen = await sweep('slow zoom out (labels crowd)', 240, G("g.focus.set(15, 0, 6); g.pitch = 60; g.yaw = 0; g.dist = 40 + t * 540;"))
        off_end = await gm.evaluate("document.querySelectorAll('.rlabel:not(.on)').length")
        check(n > 0 and len(seen) > 1 and off_end > 0, 'the zoom did cross crowding thresholds (labels are hidden at the far end)', {'changes': n, 'shown at the stops': sorted(seen), 'hidden at the end': off_end})
        # (still zoomed right out) the fade, and the hidden label keeps its size
        hid = await gm.evaluate("[...document.querySelectorAll('.rlabel:not(.on)')].map(el => ({ w: el.offsetWidth, op: +getComputedStyle(el).opacity, vis: getComputedStyle(el).visibility, pe: getComputedStyle(el).pointerEvents, tr: getComputedStyle(el).transitionProperty }))")
        check(len(hid) > 0 and all(h['w'] > 20 and h['op'] == 0 and h['vis'] == 'hidden' and h['pe'] == 'none' and 'opacity' in h['tr'] for h in hid), 'a label that is not showing keeps its size, is fully faded, and cannot be clicked', hid[:2])
        await sweep('slow zoom back in', 240, G("g.focus.set(15, 0, 6); g.pitch = 60; g.yaw = 0; g.dist = 580 - t * 540;"))
        n, seen = await sweep('slow pan off the window\'s edge', 200, G("g.focus.set(15 + t * 140, 0, 6); g.pitch = 60; g.yaw = 0; g.dist = 90;"))
        check(n > 0, 'the pan did carry labels off the edge', n)
        # under the picture-in-picture window (it is at the lower right; pan the labels down and right, under it)
        await gm.evaluate("tw.openPip(tw.area())"); await gm.wait_for_timeout(700)
        pr = await gm.evaluate("(() => { const r = document.getElementById('pipFrame').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
        n, seen = await sweep('slow pan under the picture-in-picture', 200, G("g.focus.set(15 - t * 60, 0, 6 - t * 45); g.pitch = 60; g.yaw = 0; g.dist = 90;"))
        check(n > 0, 'the pan did carry labels under the picture-in-picture', {'changes': n, 'pip': pr})
        under = await gm.evaluate(f"tw.labelInfo().filter(l => l.visible && l.rect && l.rect[0] < {pr[2]} && l.rect[2] > {pr[0]} && l.rect[1] < {pr[3]} && l.rect[3] > {pr[1]}).length")
        check(under == 0, 'and none is left showing on it', under)
        await gm.evaluate("tw.closePip()")
        check(not errors, 'no page errors', errors[:3])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
    return 1 if bad else 0

try: code = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(code)
