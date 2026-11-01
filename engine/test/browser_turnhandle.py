#!/usr/bin/env python3
"""The facing arrow is a TURN HANDLE (Harry 2026-10-29: "Let's make the facing arrow a grab handle for rotation, I noticed I
frequently want to do that"; and "Facing arrow can be much smaller and facing gap can go away"). client/turnhandle.js,
docs/UI.md "Turning a pawn by its arrow". GM tab + a player tab.

  local:  TW_GPU=1 python3 engine/test/browser_turnhandle.py --local

  BASE     the base: 4 ft across, medium grey, ONE whole rim (no gap at the back), a small arrow whose point is past the rim
  HOVER    over the arrow of a pawn this seat may turn: the turn cursor and the arrow glows; over the figure: neither
  DRAG     press on the arrow and drag: it turns about its middle to face the pointer, snapped to 45°; the other seat sees
           it swing while it is dragged; let go: ONE token.move (one undo step), synced; x / z unchanged; no selection
           change, no marquee, no move. A press that never moves is the ordinary click (it selects).
  SHIFT    Shift held: free (not a 45° step)
  ESCAPE   Escape during the drag: nothing is sent, it goes back
  UNDO     undo puts the facing back, on both seats
  PLAYER   a player: no handle on someone else's pawn (no cursor, a drag turns nothing); her own pawn turns
  TOUCH    one finger on the arrow drags it round (a touch pointer), not a pan
  RAISED   a pawn raised 8 ft: its base (and arrow) stay on the ground, the arrow there turns it, its height is kept
"""
import argparse, asyncio, atexit, math, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
@atexit.register
def _cleanup():
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18337,18967').split(','))  # TW_PORTS=a,b when another worktree is running this suite
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-turnh-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
async def view(pg, x, z, dist=60, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
FIG = lambda id: f"tw.worldOf(tw.area()).figureOf('{id}')"
ENT = lambda id: f"tw.entities()['{id}']"
# the screen point of a pawn's arrow (the middle of it), and of a spot `d` ft out from its middle at `deg` (0 = +Z, 90 = +X),
# both on the plane of its BASE (the foot: on the ground under a raised pawn)
ARROW_AT = """(id) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id), b = r.visual.userData.base, A = tw.figures.arrow(), e = tw.entities()[id];
  const p = new b.position.constructor(); b.updateMatrixWorld(true); b.getWorldPosition(p); const y = p.y + b.userData.top, k = b.userData.size, d = (A.from * k + b.userData.tip) / 2, a = e.rot || 0;
  return tw.screenOf(p.x + d * Math.sin(a), p.z + d * Math.cos(a), tw.main, y); }"""
OUT_AT = """([id, deg, d]) => { const w = tw.worldOf(tw.area()), b = w.recs.get(id).visual.userData.base, p = new b.position.constructor(); b.updateMatrixWorld(true); b.getWorldPosition(p);
  const a = deg * Math.PI / 180; return tw.screenOf(p.x + d * Math.sin(a), p.z + d * Math.cos(a), tw.main, p.y + b.userData.top); }"""
DEG = lambda r: round(((r * 180 / math.pi) % 360 + 360) % 360, 2)

async def swing(pg, id, to_deg, shift=False, steps=14, up=True, d=3.2):
    """press on the pawn's arrow and drag round to `to_deg` (degrees from +Z toward +X), d ft out; let go unless up=False"""
    a = await pg.evaluate(ARROW_AT, id); e = await pg.evaluate(ENT(id)); a0 = DEG(e.get('rot') or 0)
    await pg.mouse.move(a['x'], a['y']); await pg.wait_for_timeout(150)
    if shift: await pg.keyboard.down('Shift')
    await pg.mouse.down()
    turn = ((to_deg - a0 + 540) % 360) - 180  # the short way round
    for i in range(1, steps + 1):
        p = await pg.evaluate(OUT_AT, [id, a0 + turn * i / steps, d]); await pg.mouse.move(p['x'], p['y']); await pg.wait_for_timeout(20)
    if up: await pg.mouse.up(); await pg.wait_for_timeout(400)
    if shift: await pg.keyboard.up('Shift')

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900, **kw):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, **kw)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e.stack}')); pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errors.append(f'console: {m.text[:200]}'))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST turnhandle {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        rid = await gm.evaluate(SPAWN, {'id': 'room_turnh0001', 'type': 'common', 'x': 0, 'z': 0, 'w': 8, 'd': 6, 'seed': 6101})
        await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, 'room')
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", 90000, 'spawn over')
        await gm.evaluate(f"tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}' && !tw.ST.isConnector(e)).map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))"); await gm.wait_for_timeout(500)
        await gm.evaluate(f"tw.cutToRoom?.(tw.entities()['{rid}'], 'test')"); await gm.wait_for_timeout(500)
        # the invite; Mira's tab
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx&nointro', reduced_motion='reduce')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab live')
        PL = await pl.evaluate('tw.me()')
        G, M, R = 'tok_turnhgm0001', 'tok_turnhmira001', 'tok_turnhhigh001'
        await gm.evaluate(f"""tw.batch([
          {{ type: 'token.create', args: {{ id: '{G}', name: 'Guard', x: 12.5, z: 12.5, rot: 0, color: '#d9a441', fig: 'hero-fighter-human-m' }} }},
          {{ type: 'token.create', args: {{ id: '{M}', name: 'Mira', x: 22.5, z: 12.5, rot: 0, color: '#3fa7ff', owner: '{PL}', fig: 'hero-wizard-elf-f' }} }},
          {{ type: 'token.create', args: {{ id: '{R}', name: 'Bird', x: 17.5, z: 22.5, rot: 0, y: 8, color: '#d9a441', fig: 'foe-goblin-spear' }} }}])""")
        for pg in (gm, pl):
            for t in (G, M, R): await wait(pg, f"{FIG(t)}?.loaded", 30000, f'{t} figure')
        await view(gm, 17.5, 16, 55, 60); await view(pl, 17.5, 16, 55, 60)
        await gm.evaluate("tw.clearSelection()"); await gm.mouse.move(5, 880)

        print('BASE')
        F = await gm.evaluate(FIG(G))
        check(abs(F['base_width_ft'] - 4) < 0.01 and F['disc'] == '#757e88', 'the base is 4 ft across, medium grey', [F['base_width_ft'], F['disc']])
        check(abs(F['rim_arc_deg'] - 360) < 0.1, 'the rim is ONE whole ring: no gap at the back', F['rim_arc_deg'])
        check(F['arrow_ft'] < 1.6 and math.hypot(*F['point']) > F['base_width_ft'] / 2 + 0.2, 'the arrow is small and its point is past the rim', [F['arrow_ft'], F['point']])

        print('HOVER')
        a = await gm.evaluate(ARROW_AT, G); await gm.mouse.move(a['x'], a['y']); await gm.wait_for_timeout(250)
        hov = await gm.evaluate(f"({{ cls: document.querySelector('#c').classList.contains('turn-handle'), hot: tw.worldOf(tw.area()).recs.get('{G}').visual.userData.base.userData.hot(), cur: getComputedStyle(document.querySelector('#c')).cursor }})")
        check(hov['cls'] and hov['hot'] and 'svg' in hov['cur'], 'over the arrow: the turn cursor, and the arrow glows', {**hov, 'cur': hov['cur'][:40]})
        body = await gm.evaluate(f"tw.screenOf(12.5, 12.5, tw.main, 2.5)"); await gm.mouse.move(body['x'], body['y']); await gm.wait_for_timeout(250)
        hov = await gm.evaluate(f"({{ cls: document.querySelector('#c').classList.contains('turn-handle'), hot: tw.worldOf(tw.area()).recs.get('{G}').visual.userData.base.userData.hot() }})")
        check(not hov['cls'] and not hov['hot'], 'over the figure itself: the ordinary pointer, no glow', hov)

        print('DRAG')
        seq0 = await gm.evaluate('tw.seq()'); e0 = await gm.evaluate(ENT(G))
        await swing(gm, G, 100, up=False)
        mid = await gm.evaluate(f"({{ cls: document.querySelector('#c').classList.contains('turning'), marquee: !document.querySelector('#marquee').hidden, drag: tw.localDrags.get('{G}') || null, sel: [...tw.sel] }})")
        await pl.wait_for_timeout(600); seen = await pl.evaluate(FIG(G))
        check(mid['cls'] and not mid['marquee'] and mid['drag'] and abs(DEG(mid['drag']['rot']) - 90) < 0.01 and not mid['sel'], 'mid-drag: turning, snapped to 90° (pointed at 100°), no marquee, nothing selected', mid)
        check(seen and abs(seen['facing_deg'] - 90) < 1, 'the other seat sees it swing while it is dragged', seen and seen['facing_deg'])
        await gm.mouse.up(); await gm.wait_for_timeout(600); await wait(gm, 'tw.sync.pendingCount() === 0', 8000)
        e1 = await gm.evaluate(ENT(G)); seq1 = await gm.evaluate('tw.seq()'); last = await gm.evaluate('tw.turnHandleLast')
        check(abs(DEG(e1['rot']) - 90) < 0.01 and e1['x'] == e0['x'] and e1['z'] == e0['z'], 'let go: it faces 90°, on the same spot', [e1['rot'], e1['x'], e1['z']])
        check(seq1 - seq0 == 1 and last['committed'], 'ONE command was sent (one undo step)', f'seq {seq0} -> {seq1}')
        check(not await gm.evaluate('tw.sel.size') and await gm.evaluate('tw.localDrags.size') == 0, 'no selection change, no move left in hand', await gm.evaluate('[...tw.sel]'))
        await wait(pl, f"Math.abs((({ENT(G)}.rot || 0) * 180 / Math.PI + 360) % 360 - 90) < 0.01", 6000, 'player sees the turn')
        P = await pl.evaluate(FIG(G)); check(abs(P['facing_deg'] - 90) < 0.5, 'synced: the player sees it face 90°', P['facing_deg'])
        await swing(gm, G, 205); e2 = await gm.evaluate(ENT(G)); check(abs(DEG(e2['rot']) - 225) < 0.01 or abs(DEG(e2['rot']) - 180) < 0.01, 'pointed at 205°: it snaps to a 45° step', DEG(e2['rot']))
        a = await gm.evaluate(ARROW_AT, G); await gm.mouse.move(a['x'], a['y']); await gm.wait_for_timeout(100); await gm.mouse.down(); await gm.mouse.up(); await gm.wait_for_timeout(400)
        check(await gm.evaluate(f"tw.sel.has('{G}')") and abs(DEG((await gm.evaluate(ENT(G)))['rot']) - DEG(e2['rot'])) < 0.01, 'a click on the arrow that never drags is the ordinary click: it selects, turns nothing', await gm.evaluate('[...tw.sel]'))
        await gm.evaluate("tw.clearSelection()")

        print('SHIFT')
        await swing(gm, G, 100, shift=True); e3 = await gm.evaluate(ENT(G)); d3 = DEG(e3['rot'])
        check(abs(d3 - 100) < 3 and abs(d3 / 45 - round(d3 / 45)) > 0.05, 'Shift held: free, it faces the pointer (100°), not a 45° step', d3)

        print('ESCAPE')
        seq0 = await gm.evaluate('tw.seq()'); await swing(gm, G, 300, up=False); await gm.keyboard.press('Escape'); await gm.mouse.up(); await gm.wait_for_timeout(500)
        e4 = await gm.evaluate(ENT(G)); check(abs(DEG(e4['rot']) - d3) < 0.01 and await gm.evaluate('tw.seq()') == seq0, 'Escape mid-drag: nothing sent, it goes back', [DEG(e4['rot']), d3])

        print('UNDO')
        await gm.evaluate('tw.undo()'); await gm.wait_for_timeout(700); await wait(gm, 'tw.sync.pendingCount() === 0', 8000)
        e5 = await gm.evaluate(ENT(G)); check(abs(DEG(e5['rot']) - DEG(e2['rot'])) < 0.01, 'undo: the facing is back to before the last turn', [DEG(e5['rot']), DEG(e2['rot'])])
        await wait(pl, f"Math.abs((({ENT(G)}.rot || 0) * 180 / Math.PI + 360) % 360 - {DEG(e2['rot'])}) < 0.01", 6000, 'player sees the undo')
        check(abs(DEG((await pl.evaluate(ENT(G)))['rot']) - DEG(e2['rot'])) < 0.01, 'and on the other seat')

        print('PLAYER')
        await pl.evaluate("tw.clearSelection()")
        a = await pl.evaluate(ARROW_AT, G); await pl.mouse.move(a['x'], a['y']); await pl.wait_for_timeout(250)
        check(not await pl.evaluate("document.querySelector('#c').classList.contains('turn-handle')"), "a player over the arrow of a pawn not hers: no turn cursor")
        r0 = DEG((await pl.evaluate(ENT(G)))['rot']); await swing(pl, G, (r0 + 90) % 360)
        await pl.wait_for_timeout(500); check(abs(DEG((await gm.evaluate(ENT(G)))['rot']) - r0) < 0.01 and not await pl.evaluate("tw.turnHandleLast?.id === '" + G + "'"), 'and a drag on it turns nothing', DEG((await gm.evaluate(ENT(G)))['rot']))
        await swing(pl, M, 270); await wait(gm, f"Math.abs((({ENT(M)}.rot || 0) * 180 / Math.PI + 360) % 360 - 270) < 0.01", 6000, 'GM sees her turn')
        check(abs(DEG((await gm.evaluate(ENT(M)))['rot']) - 270) < 0.01, 'her own pawn: she turns it by its arrow (the GM sees it)', DEG((await gm.evaluate(ENT(M)))['rot']))

        print('TOUCH')
        # one finger: synthetic touch pointer events on the canvas (the arrow, then round to 180°)
        a = await gm.evaluate(ARROW_AT, M); cam0 = await gm.evaluate("[tw.main.grab.focus.x, tw.main.grab.focus.z]")
        pts = [await gm.evaluate(OUT_AT, [M, 270 - 90 * i / 10, 3.2]) for i in range(1, 11)]
        await gm.evaluate("""([a, pts]) => { const c = document.querySelector('#c'), ev = (t, p) => c.dispatchEvent(new PointerEvent(t, { pointerType: 'touch', pointerId: 41, isPrimary: true, bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
          ev('pointerdown', a); for (const p of pts) ev('pointermove', p); ev('pointerup', pts[pts.length - 1]); }""", [a, pts])
        await gm.wait_for_timeout(600); await wait(gm, 'tw.sync.pendingCount() === 0', 8000)
        cam1 = await gm.evaluate("[tw.main.grab.focus.x, tw.main.grab.focus.z]")
        check(abs(DEG((await gm.evaluate(ENT(M)))['rot']) - 180) < 0.01 and abs(cam0[0] - cam1[0]) < 0.01 and abs(cam0[1] - cam1[1]) < 0.01, 'a finger on the arrow turns the pawn round (and does not pan)', [DEG((await gm.evaluate(ENT(M)))['rot']), cam0, cam1])

        print('RAISED')
        F = await gm.evaluate(FIG(R)); fy = await gm.evaluate(f"(() => {{ const b = tw.worldOf(tw.area()).recs.get('{R}').visual.userData.base, p = new b.position.constructor(); b.getWorldPosition(p); return p.y; }})()")
        check(F and abs(fy) < 0.05 and (await gm.evaluate(ENT(R))).get('y') == 8, 'a pawn raised 8 ft (inside the room): its base, with the arrow, stays on the ground', fy)
        await swing(gm, R, 90); eR = await gm.evaluate(ENT(R))
        check(abs(DEG(eR['rot']) - 90) < 0.01 and eR.get('y') == 8, 'its arrow on the ground turns it, and it keeps its height', [DEG(eR['rot']), eR.get('y')])

        bad = [x for x in errors if 'WebGL' not in x]
        check(not bad, 'no page errors', bad[:3])
        await browser.close()
    n = sum(ok for ok, _, _ in results); print(f'\nturnhandle: {n}/{len(results)} passed'); sys.exit(0 if n == len(results) else 1)

asyncio.run(main())
