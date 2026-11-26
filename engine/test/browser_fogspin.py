#!/usr/bin/env python3
"""THE FOG STAYS PUT WHILE THE VIEW TURNS (2026-11-06; Nick 2026-11-01: fog of war "a little janky while the view rotates").
  python3 engine/test/browser_fogspin.py --local
A GM and one player; three rooms in a row (A | B | C), the player's pawn in A, so the war-fog bank stands over B and C
and its edge runs along the A|B wall. In the PLAYER's tab, at the Medium graphics preset (Soft effects at half
resolution: the fluid steps every other frame, graphics.js), the fog's flow is frozen (flow speed 0: the field holds
still in the world) and the camera yaws round its focus 2 degrees a frame. After each drawn frame the bank is read at
fixed world points across its edge, through the same window the picture is drawn with (atmos.probe).
  S1  the turn moves the fog's simulation window (atmos fitWindow follows the visible ground, which swings round the
      focus as the view turns): the scenario exercises what it is about
  S2  the fog read at fixed world points does not change from frame to frame while only the camera moves: before
      2026-11-06 a window that moved on a frame the fluid did not step was drawn over the fields of the OLD window,
      the bank jumping a cell and back (the jank)
  S3  with the camera still, the same points do not change either (the control)
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--frames', type=int, default=120)
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '23409,23410').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-fogspin-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

# after each drawn frame (a timeout after the frame's callbacks: the app has stepped and drawn it), the bank at fixed points
SPIN = """async ([n, step, pts]) => { const w = tw.worldOf(tw.area()), a = w.fx.atmos, g = tw.main.grab, out = [];
  const after = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  for (let i = 0; i < n; i++) { if (step) { g.yaw = ((g.yaw + step + 540) % 360) - 180; g.update(); } tw.gfx?.wake?.('test'); await after();
    const s = a.stats(); out.push({ yaw: g.yaw, shifts: s.atmos_shifts, zooms: s.atmos_zooms, heavy: a.probe('heavy', pts) }); }
  return out; }"""

def deltas(rows):
    out = []
    for a, b in zip(rows, rows[1:]):
        d = [abs((y or 0) - (x or 0)) for x, y in zip(a['heavy'], b['heavy']) if x is not None and y is not None]
        out.append((max(d) if d else 0.0, b['shifts'] - a['shifts'], b['yaw']))
    return out

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(250)
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', f"TEST fogspin {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog', 90000), 'GM did not come up'
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog', 90000), 'player did not join'
        seat = await pl.evaluate('tw.me()')
        for x in [0, 4, 8]:
            await gm.evaluate('(x) => tw.spawnRoom("common", x, 0, 4, 4, 7401+x)', x)
            await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        await action(gm, "tw.registry.run('area.fogOfWar.on')")
        await action(gm, f"tw.dispatch('token.create', {{ id: 'tok_fsmira0001', name: 'Mira', x: 7.5, z: 10, owner: '{seat}' }})")
        await pl.evaluate("tw.settings.setGfx('medium')")
        await wait(pl, "tw.fog.visible(7.5,10,0) && !tw.fog.visible(50,10,0)", 60000, 'player vision')
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(20, 0, 10); g.yaw = 0; g.pitch = 50; g.dist = 55; g.update(); tw.main.rule = 'free'; })()")
        await pl.mouse.move(2, 2)  # (the pointer stirs the fog: keep it off the map)
        await pl.wait_for_timeout(2500)
        every = await pl.evaluate("tw.worldOf(tw.area()).fx.atmos.viewEvery")
        # let the bank settle, then freeze the flow: the field stands still in the world
        await pl.evaluate("tw.worldOf(tw.area()).fx.atmos.warm(240)")
        await pl.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = JSON.parse(JSON.stringify(fx.atmos.params)); p.flow.speed = 0; p.flow.breath = 0; fx.setParams('atmos', p); })()")
        await pl.wait_for_timeout(800)
        pts = [[14 + 0.5 * i, z] for i in range(25) for z in (6.0, 10.0, 14.0)]  # across the bank's edge at the A|B wall (x 20)
        edge = await pl.evaluate("(pts) => tw.worldOf(tw.area()).fx.atmos.probe('heavy', pts)", pts)
        vals = [v for v in edge if v is not None]
        print(f'  (viewEvery {every}; bank across the edge: min {min(vals):.3f} max {max(vals):.3f})')
        still = await pl.evaluate(SPIN, [30, 0, pts])
        spin = await pl.evaluate(SPIN, [A.frames, 2, pts])
        ds, dsp = deltas(still), deltas(spin)
        moved = sum(1 for _, sh, _ in dsp if sh > 0)
        check(every == 2 and max(vals) - min(vals) > 0.3 and moved >= A.frames // 4,
              'S1 at Medium the fluid steps every other frame, the bank has an edge to see, and the turn moves the fog window', dict(viewEvery=every, edge=[round(min(vals), 3), round(max(vals), 3)], window_moves=f'{moved}/{len(dsp)} frames'))
        worst = max(dsp, key=lambda t: t[0]); jumps = [t for t in dsp if t[0] > 0.02]
        check(worst[0] <= 0.02, 'S2 while only the camera turns, the bank at fixed world points holds still frame to frame (max change <= 0.02)',
              dict(worst=round(worst[0], 3), at_yaw=worst[2], frames_over=f'{len(jumps)}/{len(dsp)}', first=[(round(d, 3), sh, y) for d, sh, y in jumps[:6]]))
        check(max(d for d, _, _ in ds) <= 0.02, 'S3 control: camera still, the same points hold still', round(max(d for d, _, _ in ds), 4))
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
        for d in tmp: shutil.rmtree(d, ignore_errors=True)
    n = sum(1 for ok, *_ in results if ok)
    print(f'browser fogspin: {n}/{len(results)} passed', flush=True)
    sys.exit(0 if results and n == len(results) else 1)
