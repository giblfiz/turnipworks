#!/usr/bin/env python3
"""Tipping a thing onto its side (Harry 2026-10-11, docs/UI.md "Tilt"): the object ring's ☰ entry and everything it touches.

  local:  TW_GPU=1 python3 engine/test/browser_tilt.py --local [--shots]
  live:   .../python engine/test/browser_tilt.py --page https://turnipworks.net/

  GROUND   tilted 90, 45, 180 and -30 degrees a thing's LOWEST POINT stays where it was upright (on the floor, and on a
           table top), it stays over its spot, its y in the data does not change; upright again = exactly as before
  RING     the entry is in the ☰ circle of a thing only (not the closed ring; not a pawn's, not a room's), under the
           one label constant; dragging it tips the thing in 15-degree steps with a track and an "upright" mark, the
           thing follows during the drag, freely with the turn's 45° notches, Shift = 15° steps, Esc cancels, a click
           does nothing;
           one undo step per gesture
  BAR      "roll 90", "roll -45", "roll 0", the alias "tilt upright"; nothing for a pawn
  CARRY    a move, a raise, a duplicate, a copy and paste, a re-roll of its room (pinned) keep the tilt
  SEES     the selection brackets are round the thing as it lies; the pointer picks it where it lies and not where it
           stood; a drawn floor over it still stops the pointer; one on the upper floor is picked
  SYNC     another seat sees the drag as it happens and the result; after a reload both still have it
"""
import argparse, asyncio, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; TMP = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18141, 18771
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-tilt-'); site = tempfile.mkdtemp(prefix='tw-site-'); TMP.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('' if A.shots else '&faces=1500')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'settled'); await pg.wait_for_timeout(300)
async def bar(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(300); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
async def output(pg, contains=''):
    await wait(pg, f"!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('{contains}')", 10000, 'output panel')
    v = await pg.evaluate("document.querySelector('#output textarea').value"); await pg.keyboard.press('Escape'); return v

E = lambda i: f"tw.entities()['{i}']"
BOX = lambda i: f"tw.worldOf(tw.area()).drawnBox('{i}')"
# how far a thing is from upright, radians, signed by which way about its own z (these suites' rolls are about z until
# the VIEW section): the angle of its stored orientation `quat` (absent = upright = 0)
TILT = lambda i: f"(({E(i)}.quat ? Math.sign({E(i)}.quat[2] || 1) * 2 * Math.acos(Math.min(1, {E(i)}.quat[3])) : 0))"
tz = lambda e: (math.copysign(1, e['quat'][2] or 1) * 2 * math.acos(min(1, e['quat'][3]))) if e and e.get('quat') else None
QJ = lambda i: f"JSON.stringify({E(i)}.quat || null)"
H = math.pi / 2
near = lambda a, b, tol=0.03: a is not None and b is not None and abs(a - b) <= tol
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
# a ray straight down through (x, z) from 60 ft up: what the pointer would pick along it, as selections
DOWN = """((x, z, opts = {}) => { const w = tw.worldOf(tw.area()), rc = tw.rayAt(innerWidth / 2, innerHeight / 2); rc.ray.origin.set(x, 60, z); rc.ray.direction.set(0, -1, 0);
  if (opts.noStop) w.noFloorStop = true; try { return w.pickAll(rc).map(h => h.entity?.id || (h.wall ? 'wall:' + h.wall : null)).filter(Boolean); } finally { w.noFloorStop = false; } })"""
# a level ray along +x at height y through z: is the thing on it?
ALONG = """((id, x0, y, z) => { const w = tw.worldOf(tw.area()), rc = tw.rayAt(innerWidth / 2, innerHeight / 2); rc.ray.origin.set(x0, y, z); rc.ray.direction.set(1, 0, 0);
  w.noFloorStop = true; try { return w.pickAll(rc).some(h => h.entity?.id === id); } finally { w.noFloorStop = false; } })"""

async def main():
    if A.local: page = start_local()
    else: page = A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def new_tab(url):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, reduced_motion='reduce'); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); return pg
        gm = await new_tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST tilt {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        await gm.evaluate(f"({SPAWN})({{ id: 'room_tiltk00001', type: 'kitchen', x: 0, z: 0, w: 6, d: 5, seed: 77 }})")
        await gm.wait_for_timeout(9000); await settle(gm)
        ids = await gm.evaluate("""(() => {
          const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === 'room_tiltk00001' && e.place === 'floor' && !e.flat && !e.fromEdge), riders = (t) => es.filter(c => c.parent === t.id);
          const free = es.filter(e => !e.parent && !riders(e).length && Math.max(...e.dims) < 6);
          const tall = free.filter(e => e.dims[1] > 1.4 * e.dims[0]).sort((a, b) => b.dims[1] - a.dims[1])[0] || free.sort((a, b) => b.dims[1] / b.dims[0] - a.dims[1] / a.dims[0])[0];
          const other = free.filter(e => e !== tall).sort((a, b) => b.dims[1] - a.dims[1])[0];
          const all = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === 'room_tiltk00001'); const rider = all.filter(e => e.parent && (e.y || 0) > 1 && !e.flat && !all.some(c => c.parent === e.id)).sort((a, b) => b.dims[1] - a.dims[1])[0];
          const pinme = free.filter(e => e !== tall && e !== other)[0];
          return { tall: tall?.id, other: other?.id, rider: rider?.id || null, pin: pinme?.id || null, n: es.length, tallDims: tall?.dims, tallCat: tall?.cat }; })()""")
        check(ids['tall'] and ids['other'], 'a kitchen with a tall free-standing thing and another', str(ids))
        T, O = ids['tall'], ids['other']
        await gm.evaluate(f"tw.batch([{{ type: 'object.move', args: {{ id: '{T}', x: {E(T)}.x, z: {E(T)}.z, rot: 0 }} }}])")
        await wait(gm, f"{E(T)}.rot === 0 && tw.sync.pendingCount() === 0"); await wait(gm, f"{BOX(T)} && !{BOX(T)}.standIn", 30000, 'the mesh is in'); await gm.wait_for_timeout(400)
        async def box(pg, i): return await pg.evaluate(BOX(i))
        async def set_tilt(i, rad, pg=None):
            pg = pg or gm
            await pg.evaluate(f"tw.dispatch('object.set', {{ id: '{i}', tiltZ: {rad} }})"); await wait(pg, "tw.sync.pendingCount() === 0", 8000); await pg.wait_for_timeout(250)
        ent0 = await gm.evaluate(f"JSON.stringify({E(T)})")

        print('GROUND: its lowest point stays where it was')
        for name, i in (('a thing on the floor', T), ('another', O)) + ((('a thing on a table top', ids['rider']),) if ids['rider'] else ()):
            await wait(gm, f"{BOX(i)} && !{BOX(i)}.standIn", 30000)
            if i == ids['rider']:  # (a thing on a table is seated on the table's real top a little after its mesh arrives, and again whenever it is posed: let that happen first, so "before" is its settled place. Live, 2026-10-12: it had not yet, and every reading was off by the same 0.15 ft)
                await set_tilt(i, 0.3); await gm.wait_for_timeout(2500); await set_tilt(i, 0); await gm.wait_for_timeout(2500)
            b0 = await box(gm, i); e0 = await gm.evaluate(E(i)); lows = {}
            for deg in (90, 45, 180, -30):
                await set_tilt(i, math.radians(deg)); b = await box(gm, i); lows[deg] = round(b['min'][1] - b0['min'][1], 3)
                if deg == 90 and i == T:
                    w0, h0 = b0['max'][0] - b0['min'][0], b0['max'][1] - b0['min'][1]; w1, h1 = b['max'][0] - b['min'][0], b['max'][1] - b['min'][1]
                    check(near(h1, w0, 0.05) and near(w1, h0, 0.05) and b['tilted'], f'{name}, tilted 90°, lies on its side: as tall as it was wide, as wide as it was tall', f'upright {w0:.2f} wide × {h0:.2f} tall; tilted {w1:.2f} × {h1:.2f}')
                    cx = (b['min'][0] + b['max'][0]) / 2; cz = (b['min'][2] + b['max'][2]) / 2
                    check(abs(cx - e0['x']) < 0.6 and abs(cz - e0['z']) < 0.6 and near(b['min'][2], b0['min'][2], 0.02) and near(b['max'][2], b0['max'][2], 0.02), f'{name}: it stays over its spot (turned about the middle of its box; nothing moves along its front-to-back axis)', f'centre off by {cx - e0["x"]:.2f}, {cz - e0["z"]:.2f} ft')
                    if A.shots: await gm.evaluate(f"(() => {{ const e = {E(i)}, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 40; g.dist = 26; g.update(); tw.main.rule = 'free'; tw.select('{i}'); }})()"); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(SHOTS, 'tilt-90.png')); await gm.evaluate("tw.select([])")
            e1 = await gm.evaluate(E(i))
            check(all(abs(v) <= 0.02 for v in lows.values()), f'{name}: tilted 90°, 45°, 180° and -30° its lowest point is where it was upright (not sunk, not floating)', f'{lows} ft; upright low {b0["min"][1]:.3f}')
            check(e1.get('y', 0) == e0.get('y', 0) and e1['x'] == e0['x'] and e1['z'] == e0['z'] and e1.get('rot', 0) == e0.get('rot', 0), f'{name}: its y, place and turn in the data are untouched by a tilt')
            await set_tilt(i, 0); b = await box(gm, i)
            check(all(near(b['min'][k], b0['min'][k], 0.005) and near(b['max'][k], b0['max'][k], 0.005) for k in range(3)) and not b['tilted'], f'{name}: upright again it is drawn exactly as before')
        check(await gm.evaluate(f"JSON.stringify({E(T)})") == ent0, 'upright again, the data is byte-for-byte what it was (no tilt field left behind)')

        print('RING: the ☰ entry, its drag, its click')
        async def frame(i, sel=True):
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
            await gm.evaluate(f"(() => {{ const e = {E(i)}, g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.yaw = 0; g.pitch = 55; g.dist = 34; g.update(); tw.main.rule = 'free'; {'tw.select(' + json.dumps(i) + ');' if sel else ''} }})()"); await gm.wait_for_timeout(700)
        HAS = "!!document.querySelector('#ring [data-cmd=\"thing.tilt\"]')"
        await frame(T)
        closed = await gm.evaluate(HAS)
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(350)
        btn = await gm.evaluate("(() => { const b = document.querySelector('#ring [data-cmd=\"thing.tilt\"]'); return b && { cap: b.dataset.tip || '', ex: b.classList.contains('ex'), drag: b.classList.contains('drag'), icon: !!b.querySelector('svg, img.paint'), title: b.title }; })()")  # (a line icon, or the house ring's painted picture)
        label = await gm.evaluate("import('./commands.js').then(m => m.TILT_LABEL).catch(() => null)")
        check(not closed and btn and btn['ex'] and btn['drag'] and btn['icon'], "a thing's closed ring has no tilt button; its ☰ circle has one: a drag button with an icon", str(btn))
        check(btn and btn['cap'] == (label or 'Roll'), f'it wears the one label constant (TILT_LABEL = {label!r}) as its name in the ring (data-tip, drawn in the ring\'s label style)', btn and btn['cap'])
        check(await gm.evaluate("tw.menuOrphans().length === 0"), 'the menu table names every menu command (no orphan)')
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'tilt-menu.png'))
        async def grab():
            await frame(T)
            await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(350)
            b = await gm.evaluate("(() => { const r = document.querySelector('#ring [data-cmd=\"thing.tilt\"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
            await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.wait_for_timeout(80)
            c = (await gm.evaluate("tw.ringDrag()"))['centre']
            return b, c
        async def arc(b, c, deg, steps=12):  # the pointer round the centre, clockwise on screen
            r = math.hypot(b['x'] - c[0], b['y'] - c[1]); a0 = math.atan2(b['x'] - c[0], -(b['y'] - c[1]))
            for k in range(1, steps + 1):
                a = a0 + math.radians(deg) * k / steps; await gm.mouse.move(c[0] + r * math.sin(a), c[1] - r * math.cos(a)); await gm.wait_for_timeout(30)
            await gm.wait_for_timeout(150)
        seq = "tw.sync.view(tw.area()).seq"
        b0 = await box(gm, T); s0 = await gm.evaluate(seq)
        b, c = await grab(); await arc(b, c, 52)
        d = await gm.evaluate("(() => { const d = tw.ringDrag(); return d && { kind: d.kind, tilt: d.delta, ticks: d.ticks, marks: [...document.querySelectorAll('#ring .rtrack text')].map(t => t.textContent), readout: document.querySelector('#ring .readout')?.innerText || '' }; })()")
        bd = await box(gm, T)
        check(d and d['kind'] == 'tilt' and near(abs(math.degrees(d['tilt'])), 52, 1.5), 'dragging the handle 52° round the centre tips it 52°: freely, degree for degree, like the turn', str(d))
        check(d and d['ticks'] == 8 and ('52' in d['readout'] or '51' in d['readout'] or '53' in d['readout']), "while dragging: the turn's circular track (its eight 45° notches) and the change read out by the handle", str(d))
        check(bd['tilted'] and max(abs((bd['max'][k] - bd['min'][k]) - (b0['max'][k] - b0['min'][k])) for k in (0, 1)) > 0.02 and near(bd['min'][1], b0['min'][1], 0.02) and await gm.evaluate(f"{TILT(T)} === 0"), 'the thing itself tips under the hand, resting on the floor, before anything is sent', f"upright {b0['min'][1]:.3f}..{b0['max'][1]:.3f}; dragging {bd['min'][1]:.3f}..{bd['max'][1]:.3f} tilted {bd['tilted']}")
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'tilt-drag.png'))
        await arc({'x': c[0] + (b['x'] - c[0]) * math.cos(math.radians(52)) - (b['y'] - c[1]) * math.sin(math.radians(52)), 'y': c[1] + (b['x'] - c[0]) * math.sin(math.radians(52)) + (b['y'] - c[1]) * math.cos(math.radians(52))}, c, 40)
        await gm.mouse.up(); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(300)
        t1 = await gm.evaluate(TILT(T)); last = await gm.evaluate("tw.ringDragLast"); s1 = await gm.evaluate(seq)
        check(near(abs(t1), H, 0.002) and last['committed'] and last['kind'] == 'tilt', 'released at 92°: caught in the 90° notch, it is stored at exactly 90° (on its side)', f'tiltZ {t1}')
        check(s1 == s0 + 1, 'the whole gesture is ONE command', f'seq {s0} -> {s1}')
        await gm.evaluate("tw.undo()"); await wait(gm, f"{TILT(T)} === 0", 8000)
        check(await gm.evaluate(f"JSON.stringify({E(T)})") == ent0, 'one undo stands it up again, exactly as it was')
        # Shift: freely
        b, c = await grab(); await gm.keyboard.down('Shift'); await arc(b, c, 37); d = await gm.evaluate("tw.ringDrag().delta"); await gm.mouse.up(); await gm.keyboard.up('Shift'); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(200)
        t2 = math.degrees(await gm.evaluate(TILT(T)))
        check(abs(abs(t2) - 37) < 8 and abs(abs(t2) / 15 - round(abs(t2) / 15)) < 0.001, 'with Shift held the tilt goes in 15° steps (as the turn does)', f'{t2:.2f}°')
        # Esc: nothing
        b, c = await grab(); await arc(b, c, 80); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200); await gm.mouse.up(); await gm.wait_for_timeout(300)
        check(near(math.degrees(await gm.evaluate(TILT(T))), t2, 0.01) and not (await gm.evaluate("tw.ringDragLast"))['committed'], 'Esc during the drag: nothing is changed')
        # back to exactly 0 by the drag: the steps land on upright
        b, c = await grab(); sg = 1 if t2 > 0 else -1
        for sweep in (-abs(round(t2)), abs(round(t2))):
            await gm.mouse.move(b['x'], b['y']); await arc(b, c, sweep, 10)
            if await gm.evaluate(f"tw.localDrags.get('{T}')?.quat === null"): break  # (the preview is upright)
        d0 = await gm.evaluate(f"tw.localDrags.get('{T}')?.quat === null ? 0 : 1"); ro = await gm.evaluate("document.querySelector('#ring .readout')?.innerText || ''"); await gm.mouse.up(); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(200)
        check(d0 == 0 and '◆' in ro and 'upright' in ro and await gm.evaluate(f"!('quat' in {E(T)})"), 'dragged back to upright it is caught in that notch at exactly 0 (the readout shows the notch) and no tilt is stored', f'{d0} {ro!r}')
        # a click on the button does nothing (a click that laid the thing over stole the short drags)
        s0 = await gm.evaluate(seq); b, c = await grab(); await gm.mouse.up(); await gm.wait_for_timeout(700)
        check(await gm.evaluate(seq) == s0 and await gm.evaluate(f"JSON.stringify({E(T)})") == ent0, 'a click on the roll button changes nothing (it says to drag)')
        # not for a pawn, not for a room
        await gm.evaluate("tw.batch([{ type: 'token.create', args: { id: 'tok_tilt000001', name: 'Brakka', x: 12.5, z: 32.5 } }])"); await wait(gm, "tw.entities()['tok_tilt000001'] && tw.sync.pendingCount() === 0", 8000)
        seen = {}
        for what, i in (('pawn', 'tok_tilt000001'), ('room', 'room_tiltk00001')):
            await frame(i); await gm.evaluate("document.querySelector('#ring [data-menu]')?.click()"); await gm.wait_for_timeout(350)  # (a room's ring can sit under the level meter)
            seen[what] = [await gm.evaluate("document.querySelectorAll('#ring .rbtn.ex').length"), await gm.evaluate(HAS)]
        check(seen['pawn'][0] > 0 and not seen['pawn'][1] and seen['room'][0] > 0 and not seen['room'][1], "a pawn's ☰ and a room's ☰ have no tilt entry", str(seen))

        print('BAR: typed')
        await frame(T); await gm.keyboard.press('Escape')
        await gm.evaluate(f"tw.select('{T}')"); await bar(gm, 'roll 90'); await wait(gm, f"Math.abs(Math.abs({TILT(T)}) - {H}) < 0.002", 6000); t90 = abs(await gm.evaluate(TILT(T)))
        await gm.evaluate(f"tw.select('{T}')"); await bar(gm, 'roll -45'); await wait(gm, f"Math.abs(Math.abs({TILT(T)}) - {H / 2}) < 0.002", 6000); t45 = -abs(await gm.evaluate(TILT(T)))
        await gm.evaluate(f"tw.select('{T}')"); await bar(gm, 'roll 0'); await wait(gm, f"!('quat' in {E(T)})", 6000); t0 = await gm.evaluate(f"'quat' in {E(T)}")
        check(near(t90, H, 0.002) and near(t45, -H / 2, 0.002) and not t0, 'the command bar: "roll 90" is a quarter roll about the view\'s axis (on its side), "roll -45" rolls it 45° back from there (the rolls add up), "roll 0" stands it upright (no field)', f'{t90} {t45}')
        await set_tilt(T, 1); await gm.evaluate(f"tw.select('{T}')"); await bar(gm, 'tilt upright'); ok_up = await wait(gm, f"!('quat' in {E(T)})", 6000)
        await gm.evaluate("tw.select('tok_tilt000001')"); s0 = await gm.evaluate(seq); await bar(gm, 'tilt 90'); await gm.wait_for_timeout(500); await gm.keyboard.press('Escape')
        check(ok_up and await gm.evaluate(seq) == s0 and await gm.evaluate("!('quat' in tw.entities()['tok_tilt000001'])"), 'the alias "tilt upright" stands it up; with a pawn selected "tilt 90" does nothing')
        found = await gm.evaluate(f"(() => {{ tw.select('{T}'); const R = tw.registry, ctx = R.ctx(); return R.search ? R.search('tilt', ctx).slice(0, 6).map(c => c.id || c.cmd?.id) : R.available(ctx).filter(c => c.id === 'thing.tilt').map(c => c.id); }})()")
        check('thing.tilt' in (found or []), 'the command is found by name with a thing selected', str(found))

        print('CARRY: a move, a raise, a duplicate, a copy and paste, a re-roll')
        await set_tilt(T, H); bt = await box(gm, T); eT = await gm.evaluate(E(T))
        await gm.evaluate(f"tw.select('{T}'); tw.nudge(1, 0)"); await wait(gm, f"{E(T)}.x === {eT['x'] + 1} && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(250); bn = await box(gm, T)
        check(near(await gm.evaluate(TILT(T)), H, 0.002) and near(bn['min'][0], bt['min'][0] + 1, 0.02) and near(bn['min'][1], bt['min'][1], 0.01) and near(bn['max'][1], bt['max'][1], 0.01), 'moved a foot: still on its side, still on the floor')
        await gm.evaluate(f"tw.rotateSelection(90)"); await wait(gm, f"Math.abs({E(T)}.rot - {H}) < 0.01 && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(250); br = await box(gm, T)
        check(near(await gm.evaluate(TILT(T)), H, 0.002) and near(br['max'][1] - br['min'][1], bn['max'][1] - bn['min'][1], 0.02) and near(br['max'][2] - br['min'][2], bn['max'][0] - bn['min'][0], 0.05) and near(br['min'][1], bn['min'][1], 0.01), 'turned a quarter: the tilt turns with it (it tips about its own axis), still on the floor')
        await gm.evaluate(f"tw.liftTo({E(T)}, 12)"); await wait(gm, f"{E(T)}.y > 5 && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300); bl = await box(gm, T); yl = await gm.evaluate(f"{E(T)}.y")
        check(near(await gm.evaluate(TILT(T)), H, 0.002) and near(bl['min'][1] - br['min'][1], yl, 0.02), 'raised: still on its side, its lowest point exactly that much higher', f'y {yl}, low +{bl["min"][1] - br["min"][1]:.3f}')
        await gm.evaluate(f"tw.liftTo({E(T)}, 0)"); await wait(gm, f"({E(T)}.y || 0) === 0 && tw.sync.pendingCount() === 0", 6000)
        before = await gm.evaluate("Object.keys(tw.entities())")
        await gm.evaluate(f"tw.select('{T}'); tw.duplicate()"); await wait(gm, f"Object.keys(tw.entities()).length === {len(before) + 1} && tw.sync.pendingCount() === 0", 6000)
        dup = await gm.evaluate(f"Object.values(tw.entities()).find(e => !{json.dumps(before)}.includes(e.id))")
        check(dup and near(tz(dup), H, 0.002) and dup['cat'] == eT['cat'], 'a duplicate lies on its side too', str(dup and dup.get('quat')))
        await wait(gm, f"{BOX(dup['id'])} && !{BOX(dup['id'])}.standIn && tw.spawningNow().anims === 0", 20000); await gm.wait_for_timeout(300); bdup = await box(gm, dup['id']); bT = await box(gm, T)
        check(near(bdup['min'][1], bT['min'][1], 0.01) and near(bdup['max'][1], bT['max'][1], 0.01) and bdup['tilted'], 'and is drawn like the original (same height, on the floor), after its spawn animation')
        before = await gm.evaluate("Object.keys(tw.entities())")
        text = await gm.evaluate(f"(() => {{ tw.select('{T}'); return tw.copy(); }})()")
        await gm.evaluate(f"tw.pasteText({json.dumps(text)}, [40, 12])"); await wait(gm, f"Object.keys(tw.entities()).length === {len(before) + 1} && tw.sync.pendingCount() === 0", 6000)
        pasted = await gm.evaluate(f"Object.values(tw.entities()).find(e => !{json.dumps(before)}.includes(e.id))")
        check(pasted and near(tz(pasted), H, 0.002), 'copied as text and pasted (the trip through a chat window): still on its side', str(pasted and pasted.get('quat')))
        # a pinned, tilted thing through its room's re-roll
        P = ids['pin'] or O
        await set_tilt(P, -H / 3); await gm.evaluate(f"tw.flag(['{P}'], {{ pinned: true }})"); await wait(gm, f"{E(P)}.pinned && tw.sync.pendingCount() === 0", 6000)
        seed0 = await gm.evaluate("tw.entities()['room_tiltk00001'].recipe.seed")
        await gm.evaluate("tw.rerollRoom(tw.entities()['room_tiltk00001'])"); await wait(gm, f"tw.entities()['room_tiltk00001'].recipe.seed !== {seed0} && tw.sync.pendingCount() === 0", 15000); await settle(gm)
        kept = await gm.evaluate(f"({{ pin: {E(P)} ? {TILT(P)} : null, tall: !!{E(T)}, dup: {E(dup['id'])}?.room }})")
        check(near(kept['pin'], -H / 3, 0.002), "its room re-rolled: the pinned thing is still there, still tilted", str(kept))
        # (T was not pinned: if the re-roll took it, put one back for the rest)
        if not kept['tall']:
            await gm.evaluate(f"tw.dispatch('object.place', {{ ...{json.dumps({k: v for k, v in eT.items() if k in ('name', 'cat', 'sku', 'url', 'place', 'layer', 'yaw', 's', 'dims')})}, id: '{T}', x: 44, z: 12, y: 0, rot: 0, tiltZ: {H} }})"); await wait(gm, f"{E(T)} && tw.sync.pendingCount() === 0", 6000); await settle(gm)
        else:
            await gm.evaluate(f"tw.batch([{{ type: 'object.move', args: {{ id: '{T}', x: 44, z: 12, rot: 0, room: '' }} }}])"); await wait(gm, f"{E(T)}.x === 44 && tw.sync.pendingCount() === 0", 6000)
        await wait(gm, f"{BOX(T)} && !{BOX(T)}.standIn", 20000); await gm.wait_for_timeout(400)

        print('SEES: the brackets, the pointer, a floor over it')
        # (T now lies in the open yard at 44, 12: nothing else near it)
        await set_tilt(T, 0); await gm.wait_for_timeout(200); up = await box(gm, T)
        await set_tilt(T, H); await gm.wait_for_timeout(200); ly = await box(gm, T)
        await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(44, 0, 12); g.yaw = 0; g.pitch = 55; g.dist = 30; g.update(); tw.main.rule = 'free'; tw.select('{T}'); }})()")
        await wait(gm, "tw.worldOf(tw.area()).selFx?.samples('selected').length > 8", 5000, 'brackets drawn'); await gm.wait_for_timeout(300)
        sb = await gm.evaluate("(() => { const pts = tw.worldOf(tw.area()).selFx.samples('selected'); const mn = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k]))); return { mn, mx, n: pts.length }; })()")
        fit = all(sb['mn'][k] <= ly['min'][k] + 0.25 and sb['mx'][k] >= ly['max'][k] - 0.25 and sb['mn'][k] > ly['min'][k] - 1.2 and sb['mx'][k] < ly['max'][k] + 1.2 for k in range(3))
        misfit_upright = sb['mx'][1] < up['max'][1] - 0.3 or sb['mx'][0] > up['max'][0] + 0.3
        check(fit and (misfit_upright or abs((up['max'][1] - up['min'][1]) - (ly['max'][1] - ly['min'][1])) < 0.3), 'the selection brackets are round the thing as it lies (not round where it stood)', f"brackets {[round(v, 2) for v in sb['mn']]}..{[round(v, 2) for v in sb['mx']]}; drawn {[round(v, 2) for v in ly['min']]}..{[round(v, 2) for v in ly['max']]}")
        if A.shots: await gm.wait_for_timeout(400); await gm.screenshot(path=os.path.join(SHOTS, 'tilt-selected.png'))
        await gm.evaluate("tw.select([])")
        hup, hly = up['max'][1] - up['min'][1], ly['max'][1] - ly['min'][1]
        cx, cz = (ly['min'][0] + ly['max'][0]) / 2, (ly['min'][2] + ly['max'][2]) / 2
        if hup > hly + 0.5:
            yhi = ly['max'][1] + (up['max'][1] - ly['max'][1]) * 0.6
            hit_hi = await gm.evaluate(f"{ALONG}('{T}', {ly['min'][0] - 8}, {yhi}, {cz})"); hit_lo = await gm.evaluate(f"{ALONG}('{T}', {ly['min'][0] - 8}, {ly['min'][1] + hly * 0.5}, {cz})")
            check(hit_lo and not hit_hi, 'the pointer finds it where it lies, and no longer up where it stood', f'a ray {yhi:.1f} ft up: {hit_hi}; through it lying: {hit_lo}')
        ex = ly['max'][0] - 0.15 * (ly['max'][0] - ly['min'][0])  # near its far end: outside where it stood upright when it is taller than wide
        s = await gm.evaluate(f"tw.screenOf({ex}, {cz}, tw.main, {ly['max'][1] - 0.05})")
        picked = await gm.evaluate(f"(() => {{ const h = tw.worldOf(tw.area()).pickAll(tw.rayAt({s['x']}, {s['y']}))[0]; return h?.entity?.id || null; }})()")
        await gm.mouse.move(s['x'], s['y']); await gm.wait_for_timeout(250); hov = await gm.evaluate("tw.hover")
        await gm.mouse.click(s['x'], s['y']); await gm.wait_for_timeout(300); sel = await gm.evaluate("[...tw.sel]")
        check(picked == T and sel == [T], 'a click on its far end (where only the lying thing is) selects it', f'pick {picked}, hover {hov}, selected {sel}')
        check(ex > up['max'][0] + 0.2 or hup <= hly + 0.5, '(that spot is outside where it stood upright)', f'{ex:.2f} vs upright edge {up["max"][0]:.2f}')
        await gm.evaluate("tw.select([])")
        # a floor over it: an upper room above the kitchen; a tilted thing under that floor, and one on it
        U = 'room_tiltu00001'
        await gm.evaluate(f"({SPAWN})({{ id: '{U}', type: 'storeroom', x: 0, z: 0, w: 6, d: 5, seed: 5, y: 10 }})")
        ok_up = await wait(gm, f"tw.entities()['{U}'] && tw.sync.pendingCount() === 0", 12000, 'the upper room'); await gm.wait_for_timeout(6000); await settle(gm)
        check(ok_up, 'an upper room over the kitchen')
        under = await gm.evaluate(f"(() => {{ const e = {E(P)}; return {{ id: e.id, x: e.x, z: e.z }}; }})()")
        await set_tilt(P, H); await gm.wait_for_timeout(300); bu = await box(gm, P); ux, uz = (bu['min'][0] + bu['max'][0]) / 2, (bu['min'][2] + bu['max'][2]) / 2
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(600)  # all levels drawn: the upper floor is over it (on lv 2 alone, lv 1's things are not drawn at all)
        thru = await gm.evaluate(f"{DOWN}({ux}, {uz})"); drawn = await gm.evaluate(f"tw.worldOf(tw.area()).recs.get('{P}').group.visible")
        check(P not in thru, 'all levels showing, straight down over a tilted thing on lv 1 with the upper floor over it: the pointer does not reach it through the floor', f'picked {thru[:3]}; the thing under the floor is {"drawn" if drawn else "not drawn (covered)"}')
        await gm.evaluate(f"tw.dispatch('object.place', {{ ...{json.dumps({k: v for k, v in eT.items() if k in ('name', 'cat', 'sku', 'url', 'place', 'layer', 'yaw', 's', 'dims')})}, id: 'obj_tiltup0001', x: 27.5, z: 22.5, y: 10, rot: 0, room: '{U}', tiltZ: {H} }})")
        await wait(gm, f"{E('obj_tiltup0001')} && tw.sync.pendingCount() === 0", 6000); await wait(gm, f"{BOX('obj_tiltup0001')} && !{BOX('obj_tiltup0001')}.standIn && tw.spawningNow().anims === 0", 20000); await gm.wait_for_timeout(400)
        bup = await box(gm, 'obj_tiltup0001')
        # (rays over a 5 × 5 grid of its box: an open frame, a rack on its side, lets a single ray through its middle)
        tops = await gm.evaluate(f"(() => {{ const down = {DOWN}, b = {json.dumps(bup)}, out = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) out.push(down(b.min[0] + (b.max[0] - b.min[0]) * (i + 0.5) / 5, b.min[2] + (b.max[2] - b.min[2]) * (j + 0.5) / 5)); return out; }})()")
        top = next((t for t in tops if t[:1] == ['obj_tiltup0001']), tops[12])
        check(near(bup['min'][1], 10 + ly['min'][1], 0.03) and bup['tilted'], 'a tilted thing placed on the upper floor rests on that floor (10 ft up)', f"low {bup['min'][1]:.3f}")
        check(top[:1] == ['obj_tiltup0001'], 'and the pointer picks it from above', f"{sum(1 for t in tops if t[:1] == ['obj_tiltup0001'])} of 25 rays over its box pick it first; {eT['cat']}")
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(400)

        print('VIEW: a roll is about the view; rolls from different views add up')
        ORI = "import('../core/orient.js')"
        MAT = lambda i: f"{ORI}.then(O => O.matrixOf({E(i)}.rot || 0, O.quatOfEntity({E(i)})))"
        # what is DRAWN: the rotation of the thing's mesh in the world (its group's turn times the tilt inside it)
        DRAWN = lambda i: f"(() => {{ const w = tw.worldOf(tw.area()), r = w.recs.get('{i}'); w.settleMatrices(); r.group.updateMatrixWorld(true); const m = (r.tiltNode || r.group).matrixWorld.elements; return [0, 1, 2].map(row => [0, 1, 2].map(c => m[c * 4 + row])); }})()"
        mnear = lambda M, N, tol=0.002: all(abs(M[r][c] - N[r][c]) < tol for r in range(3) for c in range(3))
        async def cam(yaw, pitch=55): await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(44, 0, 12); g.yaw = {yaw}; g.pitch = {pitch}; g.dist = 30; g.update(); tw.main.rule = 'free'; tw.select('{T}'); }})()"); await gm.wait_for_timeout(500)
        await gm.evaluate(f"tw.batch([{{ type: 'object.set', args: {{ id: '{T}', quat: [0, 0, 0, 1] }} }}, {{ type: 'object.move', args: {{ id: '{T}', x: 44, z: 12, rot: 0 }} }}])"); await wait(gm, f"!{E(T)}.quat && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300)
        up0 = await box(gm, T); s0 = await gm.evaluate(seq)
        await cam(0); ax1 = await gm.evaluate("tw.viewRollAxis()")
        check(abs(ax1[1]) < 1e-9 and near(math.hypot(ax1[0], ax1[2]), 1, 1e-6) and near(ax1[2], -1, 0.01), "the roll's axis is the camera's forward direction laid flat on the ground (looking north from a steep table view: due north, level)", str(ax1))
        await gm.evaluate(f"tw.rollSelection(Math.PI / 2)"); await wait(gm, f"{E(T)}.quat && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300)
        m1 = await gm.evaluate(MAT(T))
        check(mnear(m1, [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]), 'a quarter roll: the thing\'s top goes to the RIGHT as seen (clockwise on screen), exactly on its side', str(m1))
        await cam(90); ax2 = await gm.evaluate("tw.viewRollAxis()")
        check(abs(ax1[0] * ax2[0] + ax1[2] * ax2[2]) < 0.01 and near(abs(ax2[0]), 1, 0.01), 'the view orbited a quarter turn: the axis has turned with it', str(ax2))
        await gm.evaluate(f"tw.rollSelection(Math.PI / 2)"); await wait(gm, "tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(400)
        m2 = await gm.evaluate(MAT(T)); sx = 1 if ax2[0] > 0 else -1
        want = [[0, 1, 0], [0, 0, -sx], [-sx, 0, 0]]  # Rot(±x, 90°) · Rot(-z, 90°)
        q2 = await gm.evaluate(f"{E(T)}.quat")
        check(mnear(m2, want), 'a second quarter roll from the new view: the two ADD UP to Rot(x, 90°) · Rot(-z, 90°), the asserted matrix', f'{m2} quat {q2}')
        check(q2 and min(abs(q2[0]), abs(q2[1]), abs(q2[2])) > 0.4, 'an orientation no turn + single tilt holds (all three of the quaternion\'s axis parts are in play)', str(q2))
        dr = await gm.evaluate(DRAWN(T))
        check(mnear(dr, m2, 0.005), 'what is drawn is that orientation (the mesh\'s own rotation in the world)', str(dr))
        b2 = await box(gm, T)
        check(near(b2['min'][1], up0['min'][1], 0.02) and b2['tilted'], 'in that orientation it still rests where its lowest point was', f"low {b2['min'][1]:.3f} vs upright {up0['min'][1]:.3f}")
        check(await gm.evaluate(seq) == s0 + 2, 'each roll was one command')
        # a third roll at an odd angle from an odd view: arbitrary, and still grounded, bracketed, pickable, copyable
        await cam(37, 40); await gm.evaluate("tw.rollSelection(0.61)"); await wait(gm, "tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(500)
        b3 = await box(gm, T); q3 = await gm.evaluate(f"{E(T)}.quat"); m3 = await gm.evaluate(MAT(T)); d3 = await gm.evaluate(DRAWN(T))
        check(near(b3['min'][1], up0['min'][1], 0.02) and mnear(d3, m3, 0.005), 'rolled again by 35° from a third view (an arbitrary orientation): on the floor, drawn as stored', f'quat {q3}')
        await wait(gm, "tw.worldOf(tw.area()).selFx?.samples('selected').length > 8", 5000, 'brackets'); await gm.wait_for_timeout(300)
        sb = await gm.evaluate("(() => { const pts = tw.worldOf(tw.area()).selFx.samples('selected'); return { mn: [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), mx: [0, 1, 2].map(k => Math.max(...pts.map(p => p[k]))) }; })()")
        check(all(sb['mn'][k] <= b3['min'][k] + 0.3 and sb['mx'][k] >= b3['max'][k] - 0.3 and sb['mn'][k] > b3['min'][k] - 2.5 and sb['mx'][k] < b3['max'][k] + 2.5 for k in range(3)), 'the selection brackets enclose it as it lies', f"brackets {[round(v, 2) for v in sb['mn']]}..{[round(v, 2) for v in sb['mx']]}; drawn {[round(v, 2) for v in b3['min']]}..{[round(v, 2) for v in b3['max']]}")
        await gm.evaluate("tw.select([])")
        hits = await gm.evaluate(f"(() => {{ const down = {DOWN}, b = {json.dumps(b3)}; let n = 0; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (down(b.min[0] + (b.max[0] - b.min[0]) * (i + 0.5) / 5, b.min[2] + (b.max[2] - b.min[2]) * (j + 0.5) / 5)[0] === '{T}') n++; return n; }})()")
        check(hits >= 3, 'the pointer picks it where it lies', f'{hits} of 25 rays over its box')
        before = await gm.evaluate("Object.keys(tw.entities())")
        await gm.evaluate(f"tw.select('{T}'); tw.duplicate()"); await wait(gm, f"Object.keys(tw.entities()).length === {len(before) + 1} && tw.sync.pendingCount() === 0", 6000)
        d2 = await gm.evaluate(f"Object.values(tw.entities()).find(e => !{json.dumps(before)}.includes(e.id))")
        check(d2 and d2.get('quat') == q3, 'a duplicate has the same orientation', str(d2 and d2.get('quat')))
        await gm.evaluate(f"tw.liftTo({E(T)}, 12)"); await wait(gm, f"{E(T)}.y > 5 && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300); bl3 = await box(gm, T); yl3 = await gm.evaluate(f"{E(T)}.y")
        check(await gm.evaluate(f"{E(T)}.quat") == q3 and near(bl3['min'][1] - b3['min'][1], yl3, 0.02), 'raised: the same orientation, its lowest point exactly that much higher')
        await gm.evaluate(f"tw.liftTo({E(T)}, 0)"); await wait(gm, f"({E(T)}.y || 0) === 0 && tw.sync.pendingCount() === 0", 6000)
        # straight down: no forward direction is left on the ground, so the screen's up is used
        await cam(20, 89.9); axd = await gm.evaluate("tw.viewRollAxis()"); upd = await gm.evaluate("(() => { const m = tw.main.camera.matrixWorld.elements, l = Math.hypot(m[4], m[6]); return [m[4] / l, 0, m[6] / l]; })()")
        check(all(math.isfinite(v) for v in axd) and near(math.hypot(axd[0], axd[2]), 1, 1e-6) and near(axd[0], upd[0], 0.02) and near(axd[2], upd[2], 0.02), 'looking straight down the axis is the screen\'s up direction laid flat (never a vertical axis: that would be the Turn again)', f'{axd} vs screen-up {upd}')
        # the way home
        await cam(0); await gm.evaluate("document.querySelector('#ring [data-menu]')?.click()"); await gm.wait_for_timeout(350)
        has_up = await gm.evaluate("!!document.querySelector('#ring [data-cmd=\"thing.upright\"]')"); rot_before = await gm.evaluate(f"{E(T)}.rot || 0")
        if has_up: await gm.evaluate("document.querySelector('#ring [data-cmd=\"thing.upright\"]').click()")
        okh = await wait(gm, f"!{E(T)}.quat && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300); bh = await box(gm, T)
        check(has_up and okh and await gm.evaluate(f"{E(T)}.rot || 0") == rot_before and not bh['tilted'], 'the ☰ of a rolled thing has "Stand upright": one click and it stands, its Turn kept, no orientation stored')
        await gm.evaluate(f"tw.select('{T}')"); await gm.wait_for_timeout(400); await gm.evaluate("document.querySelector('#ring [data-menu]')?.click()"); await gm.wait_for_timeout(350)
        check(not await gm.evaluate("!!document.querySelector('#ring [data-cmd=\"thing.upright\"]')"), 'an upright thing\'s ☰ does not offer it')
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.undo()"); await wait(gm, f"{QJ(T)} === {json.dumps(json.dumps(q3, separators=(',', ':')))}", 6000)
        check(await gm.evaluate(f"{E(T)}.quat") == q3, 'one undo puts the arbitrary orientation back, exactly')

        print('SYNC: another seat, and a reload')
        await bar(gm, 'invite Brakka'); invite = await output(gm, '#s=')
        pl = await new_tab(invite)
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 150000, 'player ready'), 'a player joins')
        await settle(pl); await wait(pl, f"{BOX(T)} && !{BOX(T)}.standIn", 30000); await pl.wait_for_timeout(500)
        g, q = await box(gm, T), await box(pl, T)
        check(await pl.evaluate(QJ(T)) == await gm.evaluate(QJ(T)) and await gm.evaluate(QJ(T)) != 'null' and all(near(g['min'][k], q['min'][k], 0.02) and near(g['max'][k], q['max'][k], 0.02) for k in range(3)) and q['tilted'], 'the player has the tilt and draws the thing as the GM does', f"player {[round(v, 2) for v in q['min']]}..{[round(v, 2) for v in q['max']]}")
        qg0 = await gm.evaluate(QJ(T))
        b, c = await grab(); await arc(b, c, 45)
        live = await wait(pl, f"(() => {{ const b = {BOX(T)}; return b && Math.abs((b.max[1] - b.min[1]) - {q['max'][1] - q['min'][1]}) > 0.05; }})()", 4000, "the player sees the drag")
        pt = await pl.evaluate(QJ(T)); qd = await box(pl, T)
        check(live and pt == qg0 and near(qd['min'][1], q['min'][1], 0.03), "while the GM drags the handle, the player sees the thing tip (and stay on the floor) before anything is stored")
        await gm.mouse.up(); await wait(gm, "tw.sync.pendingCount() === 0", 8000)
        gt = await gm.evaluate(QJ(T)); await wait(pl, f"{QJ(T)} === {json.dumps(gt)}", 6000); await pl.wait_for_timeout(600)
        g, q = await box(gm, T), await box(pl, T)
        check(await pl.evaluate(QJ(T)) == gt and gt != qg0 and all(near(g['min'][k], q['min'][k], 0.02) and near(g['max'][k], q['max'][k], 0.02) for k in range(3)), 'on release the player has the new orientation and the same picture', gt)
        await pl.evaluate(f"tw.select('{T}')"); await pl.wait_for_timeout(500)
        await pl.evaluate("document.querySelector('#ring [data-menu]')?.click()"); await pl.wait_for_timeout(350)
        phas = await pl.evaluate(HAS); pcan = await pl.evaluate("tw.can('object')")
        check(phas == bool(pcan), "a player's ☰ offers the tilt exactly when that seat may edit things (the 'object' permission)", f'offered {phas}, may edit {pcan}')
        # (one tab at a time from here: two tabs reloading at once lose their GL context on the build box)
        await pl.context.close()
        for who in ('the GM', 'the player'):
            if who == 'the GM': pg = gm; await pg.reload()
            else: await gm.context.close(); pg = await new_tab(invite)
            ok = await wait(pg, 'window.tw && tw.ready && tw.ready()', 150000); await pg.wait_for_timeout(2500); await settle(pg); await wait(pg, f"{E(T)} && {BOX(T)} && !{BOX(T)}.standIn", 30000); await pg.wait_for_timeout(500)
            r = await box(pg, T)
            check(ok and await pg.evaluate(QJ(T)) == gt and near(abs(await pg.evaluate(TILT(P))), H, 0.002) and all(near(g['min'][k], r['min'][k], 0.02) and near(g['max'][k], r['max'][k], 0.02) for k in range(3)), f'after a reload {who} still has the tilts, drawn the same')
        check(not errors, 'no page errors', str(errors[:3]))
        await browser.close()

try:
    asyncio.run(main())
finally:
    import shutil
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pass
    for d in TMP: shutil.rmtree(d, ignore_errors=True)  # (/tmp is RAM on the build box)
bad = [r for r in results if not r[0]]
print(f"\ntilt: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
