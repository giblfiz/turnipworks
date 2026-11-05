#!/usr/bin/env python3
"""One grid (Harry 2026-11-03): "let's only show the grid that you're drawing on." While a build tool is up on a level
above or below the ground, that level's ghost grid is the only grid drawn; the ground's 5-ft grid comes back, as the
area's rule says, when the build grid goes (back to the ground, or the tool put away).

  local:  python3 engine/test/browser_onegrid.py --local [--gpu]

  LEVELS     lv 1 (ground) build: the ground grid only; lv 2 and lv 3 build: the level grid only; lv -1 (a cellar)
             build: the level grid only; back to the ground, or the tool put away: the ground grid again
  RULE       the area's "Hide the grid": off at every level, and the level grid still shows while building upstairs
  FPV        first person hides the ground grid and gives it back exactly; after it, still one grid
  UVTT       a map export of lv 2 with "grid" on, while building there, draws the grid; the view is put back
Screenshots: engine/test/shots/onegrid-{before,after}-lv2.png (before = the ground grid's holder forced on, as it was).
"""
import argparse, asyncio, base64, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--relay'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--gpu', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18211,18811').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-onegrid-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=' + ('' if os.environ.get('TW_POST') else '&nopost') + '&faces=1500&nointro', f'http://127.0.0.1:{RP}'  # TW_POST=1: the lighting stack on (the screenshots as a table sees them)

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=60000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over')
    await pg.wait_for_timeout(250)

# every grid the frame would draw: GridHelpers whose whole chain of parents is visible, and their heights
GRIDS = """(() => { const w = tw.worldOf(tw.area()), out = [];
  w.scene.traverseVisible(o => { if (o.type === 'GridHelper') { const p = new tw.THREE.Vector3(); o.getWorldPosition(p); out.push({ who: o === w.grid ? 'ground' : o === w.levelGrid ? 'level' : 'other', y: +p.y.toFixed(2) }); } });
  return { grids: out, shown: w.groundGridShown(), rule: w.grid.visible, level: tw.level, tool: tw.levelInfo().tool }; })()"""
SPAWN = """(a) => { const v = tw.sync.view(tw.area()), L = tw.roomgen.solve(v.entities, a, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""

def whos(g): return sorted(x['who'] for x in g['grids'])
async def at(gm, y, tool):
    await gm.evaluate(f"tw.setLevel({y})")
    if tool and not await gm.evaluate("tw.levelInfo().tool"): await gm.evaluate("tw.modes.roomTool('guest', { tool: true })")
    if not tool and await gm.evaluate("tw.levelInfo().tool"): await gm.evaluate("tw.modes.cancel()")
    await gm.wait_for_timeout(300)
    return await gm.evaluate(GRIDS)

async def main():
    if A.local: page, relay = start_local()
    else: page, relay = A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro', (A.relay or A.page.rstrip('/') + '/api/tw-relay').rstrip('/')
    if 'turnipworks.net' in page and 'dev.' not in page: sys.exit('not on live')
    os.makedirs(SHOTS, exist_ok=True)
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if A.gpu or os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, accept_downloads=True)
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' and 'status of 404' not in m.text else None)
        await gm.goto(page)
        NAME = f"TEST onegrid {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.fpv', 60000), 'GM tab live')

        B = 'bld_testonegrid'
        await gm.evaluate(SPAWN, {'id': 'room_togg00001', 'building': B, 'buildingName': 'Two-storey inn', 'type': 'common', 'x': 0, 'z': 0, 'w': 6, 'd': 4, 'seed': 4301}); await gm.wait_for_timeout(300)
        await gm.evaluate(SPAWN, {'id': 'room_togu00001', 'building': B, 'type': 'guest', 'x': 0, 'z': 0, 'w': 4, 'd': 4, 'y': 10, 'seed': 4302})
        await wait(gm, "tw.entities().room_togg00001 && tw.entities().room_togu00001 && tw.sync.pendingCount() === 0", 30000, 'rooms')
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_togmira01', name: 'Mira', x: 12.5, z: 12.5, rot: Math.PI / 2 })")
        await view(gm, 15, 10, 95, 55, 30); await settle(gm)

        print('LEVELS: one grid, the one you are drawing on')
        g = await gm.evaluate(GRIDS)
        check(whos(g) == ['ground'] and g['level'] == 0, 'no tool, the ground: the ground grid only', g)
        g = await at(gm, 0, True)
        check(whos(g) == ['ground'] and g['tool'], 'building on the ground (lv 1): the ground grid only', g)
        g = await at(gm, 10, True)
        check(whos(g) == ['level'] and abs(g['grids'][0]['y'] - 9.7) < 0.05 and g['rule'], 'building on lv 2 (10 ft): the level grid only, at that height; the area rule untouched', g)
        await view(gm, 15, 10, 95, 55, 30); await gm.wait_for_timeout(800)
        # before (as it was: the ground grid drawn as well) and after, for a blind read
        # (the old rule, held for the shot: every refresh re-runs showLevelGrid, so it is wrapped, not set once)
        await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), f = w.showLevelGrid; w._slg = f; w.showLevelGrid = function (y) { f.call(this, y); this.gridHold.visible = true; }; w.gridHold.visible = true; })()"); await gm.wait_for_timeout(600)
        g = await gm.evaluate(GRIDS)
        check(whos(g) == ['ground', 'level'], '(the before shot: the old rule, both grids drawn)', g)
        await gm.screenshot(path=os.path.join(SHOTS, 'onegrid-before-lv2.png'))
        await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); w.showLevelGrid = w._slg; delete w._slg; tw.refresh(); })()"); await gm.wait_for_timeout(600)
        g = await gm.evaluate(GRIDS)
        check(whos(g) == ['level'], 'a refresh puts the one-grid rule back', g)
        await gm.screenshot(path=os.path.join(SHOTS, 'onegrid-after-lv2.png'))
        g = await at(gm, 20, True)
        check(whos(g) == ['level'] and abs(g['grids'][0]['y'] - 19.7) < 0.05, 'building on lv 3 (20 ft): the level grid only', g)
        g = await at(gm, -10, True)
        check(whos(g) == ['level'] and abs(g['grids'][0]['y'] + 10.3) < 0.05, 'building below the ground (-10 ft): the level grid only', g)
        g = await at(gm, 0, True)
        check(whos(g) == ['ground'], 'back to the ground with the tool up: the ground grid again', g)
        g = await at(gm, 10, True); g2 = await at(gm, 10, False)
        check(whos(g) == ['level'] and whos(g2) == ['ground'] and g2['level'] == 10, 'on lv 2, putting the build tool away: the level grid goes, the ground grid comes back', g2)

        print('RULE: the area says "no grid"')
        A_ID = await gm.evaluate("tw.area()")
        await gm.evaluate(f"tw.sync.submit('area.set', {{ area: '{A_ID}', settings: {{ grid: false }} }})")
        check(await wait(gm, "!tw.worldOf(tw.area()).grid.visible", 8000, 'rule off'), 'the area\'s grid rule turns it off')
        seen = []
        for (y, tool) in ((0, False), (0, True), (10, True), (-10, True), (0, True), (10, False), (0, False)):
            g = await at(gm, y, tool); seen.append((y, tool, whos(g)))
        bad = [s for s in seen if 'ground' in s[2]]
        lv = [s for s in seen if s[1] and s[0] != 0]
        check(not bad, 'grid off stays off at every level, tool up or not', seen)
        check(all(s[2] == ['level'] for s in lv), 'the level grid still shows while building above or below (it is the drawing aid, not the area\'s grid)', lv)
        await gm.evaluate(f"tw.sync.submit('area.set', {{ area: '{A_ID}', settings: {{ grid: true }} }})")
        check(await wait(gm, "tw.worldOf(tw.area()).grid.visible", 8000, 'rule on'), 'and back on')
        g = await at(gm, 0, False)
        check(whos(g) == ['ground'], 'the ground grid shows again on the ground', g)

        print('FPV: first person hides the ground grid and gives it back')
        await gm.evaluate("tw.fpv.enter('tok_togmira01')"); await gm.wait_for_timeout(1200)
        g = await gm.evaluate(GRIDS)
        check(await gm.evaluate("tw.fpv.active()") and 'ground' not in whos(g), 'in first person: no ground grid', g)
        await gm.evaluate("tw.fpv.exit()"); await gm.wait_for_timeout(800)
        g = await gm.evaluate(GRIDS)
        check(not await gm.evaluate("tw.fpv.active()") and whos(g) == ['ground'] and g['rule'], 'out of it: the ground grid exactly as before', g)
        g = await at(gm, 10, True)
        await gm.evaluate("tw.fpv.enter('tok_togmira01')"); await gm.wait_for_timeout(1200)
        gi = await gm.evaluate(GRIDS)
        check(whos(gi) == [], 'first person from a lv 2 build: no grid at all (neither the ground\'s nor the level\'s, at eye level)', gi)
        await gm.evaluate("tw.fpv.exit()"); await gm.wait_for_timeout(800)
        g = await gm.evaluate(GRIDS)
        one = whos(g) == (['level'] if g['tool'] and g['level'] != 0 else ['ground'])
        check(one and g['rule'], 'after it: one grid, the right one for the level and tool (the rule\'s own setting kept)', g)

        print('UVTT: a map of lv 2 while building there')
        g = await at(gm, 10, True)
        # (the pictures are not byte-stable frame to frame, so count the ground grid's actual draws: onBeforeRender runs only
        # when the renderer draws it; on lv 2 with the tool up the main view never does, so any draw is the export's)
        DRAWS = "(async (grid) => { const w = tw.worldOf(tw.area()); let n = 0; w.grid.onBeforeRender = () => { n++; }; try { await tw.uvtt.build({ ppg: 70, grid }); } finally { w.grid.onBeforeRender = () => {}; } return n; })"
        n1 = await gm.evaluate(DRAWS + "(true)"); n0 = await gm.evaluate(DRAWS + "(false)")
        check(n1 > 0 and n0 == 0, 'with "grid" on the export draws the ground grid (the lv 2 squares, seen straight down); with it off, not', f'draws: on {n1}, off {n0}')
        g2 = await gm.evaluate(GRIDS)
        check(whos(g2) == ['level'] and g2['rule'] == g['rule'], 'afterwards: still the one level grid, the rule as it was', g2)

        check(not errors, 'no page errors', '; '.join(errors[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"\nonegrid: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
