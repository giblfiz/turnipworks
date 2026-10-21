#!/usr/bin/env python3
"""Shift = snap to steps, everywhere; and Roll is the Turn's gesture about another axis (Harry 2026-10-11, docs/UI.md).

  local:  TW_GPU=1 python3 engine/test/browser_shift.py --local
  live:   .../python engine/test/browser_shift.py --page https://turnipworks.net/

  SAME     the same scripted pointer path on the Turn handle and on the Roll handle (the same angles round the centre):
           the same change in degrees, step by step, the same readout, notches, ticks, Shift steps, Esc, one undo
  SHORT    a short, slow drag (the case a click handler would steal): the thing follows from the first pixels past
           the 4-px slack, in proportion; a press and release without moving does nothing on Roll
  HANDLES  every ring handle: free by default, Shift = steps (turn 15, roll 15, raise 6 in, resize 25%, damage 5)
  PAWNS    a dragged pawn moves freely, Shift snaps it to the squares; Settings > Me "Pawns snap to squares: always"
           turns that round; the bar has both; the placing ghost of a figure dragged out of a list obeys the same
  THINGS   furniture moves freely, Shift snaps it to the half squares; a wall piece is left as it was
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

RP, SP = 18147, 18777
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-shift-'); site = tempfile.mkdtemp(prefix='tw-site-'); TMP.extend([data, site])
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


tw_sandbox.pawn_snap('shift')  # the default, said out loud: this suite is about it
E = lambda i: f"tw.entities()['{i}']"
H = math.pi / 2
near = lambda a, b, tol=0.03: a is not None and b is not None and abs(a - b) <= tol
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""

async def main():
    if A.local: page = start_local()
    else: page = A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(str(e))); await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST shift {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 150000), 'GM tab live')
        await gm.evaluate(f"({SPAWN})({{ id: 'room_shiftk0001', type: 'kitchen', x: 0, z: 0, w: 6, d: 5, seed: 77 }})"); await gm.wait_for_timeout(9000); await settle(gm)
        T = await gm.evaluate("(() => { const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place === 'floor' && !e.parent && !e.flat && !e.fromEdge && !es0(e)); function es0(e) { return Object.values(tw.entities()).some(c => c.parent === e.id); } const e = es.find(e => /barrel/.test(e.cat)) || es[0]; return e.id; })()")
        K = await gm.evaluate("(Object.values(tw.entities()).find(e => e.kind === 'object' && e.place === 'kit') || {}).id || null")
        RESET = f"tw.batch([{{ type: 'object.move', args: {{ id: '{T}', x: 44.3, z: 12.4, rot: 0, room: '' }} }}, {{ type: 'object.set', args: {{ id: '{T}', quat: [0, 0, 0, 1] }} }}])"
        async def reset(): await gm.evaluate(RESET); await wait(gm, f"{E(T)}.x === 44.3 && !{E(T)}.rot && !{E(T)}.quat && tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(200)
        await reset()
        POSE = f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{T}'); return [r.group.rotation.y * 180 / Math.PI, (r.tiltNode?.rotation.z || 0) * 180 / Math.PI]; }})()"
        DATA = f"[({E(T)}.rot || 0) * 180 / Math.PI, ({E(T)}.quat ? 2 * Math.acos(Math.min(1, {E(T)}.quat[3])) : 0) * 180 / Math.PI]"  # (the roll: the angle of its stored orientation)
        STATE = "(() => { const d = tw.ringDrag(); return d && { delta: d.delta * 180 / Math.PI, notch: d.notch, ticks: d.ticks, readout: document.querySelector('#ring .readout')?.innerText || '', marks: [...document.querySelectorAll('#ring .rtrack text')].map(t => t.textContent).filter(Boolean), rail: !!document.querySelector('#ring .rtrack') }; })()"
        seq = "tw.sync.view(tw.area()).seq"
        async def press(cmd):
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
            await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(44.3, 0, 12.4); g.yaw = 0; g.pitch = 55; g.dist = 34; g.update(); tw.main.rule = 'free'; tw.select('{T}'); }})()"); await gm.wait_for_timeout(700)
            if not await gm.evaluate(f"!!document.querySelector('#ring [data-cmd=\"{cmd}\"]')"): await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(350)
            b = await gm.evaluate(f"(() => {{ const r = document.querySelector('#ring [data-cmd=\"{cmd}\"]').getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
            await gm.mouse.move(b['x'], b['y']); await gm.mouse.down(); await gm.wait_for_timeout(100)
            c = (await gm.evaluate("tw.ringDrag()"))['centre']
            return b, c, math.hypot(b['x'] - c[0], b['y'] - c[1]), math.atan2(b['x'] - c[0], -(b['y'] - c[1]))
        async def to(c, rad, a0, deg, pause=30): a = a0 + math.radians(deg); await gm.mouse.move(c[0] + rad * math.sin(a), c[1] - rad * math.cos(a)); await gm.wait_for_timeout(pause)
        AX = {'edit.rotate': 0, 'thing.tilt': 1}
        # the script: the hand's angle round the centre, in degrees clockwise on screen, sample by sample
        PATH = [1, 2, 3, 5, 8, 12, 17, 23, 30, 38, 42, 43, 44, 46, 50, 61, 75, 88, 91, 97, 110, 100, 84, 70]  # (no sample exactly 4° from a notch: that edge is a rounding coin-toss)

        print('SAME: one scripted drag, on Turn and on Roll')
        runs = {}
        for cmd in ('edit.rotate', 'thing.tilt'):
            await reset(); s0 = await gm.evaluate(seq)
            b, c, rad, a0 = await press(cmd); trace = []
            for deg in PATH:
                await to(c, rad, a0, deg); st = await gm.evaluate(STATE); ps = await gm.evaluate(POSE); trace.append({'hand': deg, 'delta': st['delta'], 'seen': ps[AX[cmd]], 'other': ps[1 - AX[cmd]], 'readout': st['readout'], 'notch': st['notch']})
            mid = await gm.evaluate(STATE); stored_mid = await gm.evaluate(DATA)
            await gm.mouse.up(); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(300)
            after = await gm.evaluate(DATA); s1 = await gm.evaluate(seq); last = await gm.evaluate("tw.ringDragLast")
            await gm.evaluate("tw.undo()"); await gm.wait_for_timeout(900); undone = await gm.evaluate(DATA)
            # Shift: the same path, in steps
            b, c, rad, a0 = await press(cmd); await gm.keyboard.down('Shift'); sh = []
            for deg in PATH: await to(c, rad, a0, deg); sh.append(round((await gm.evaluate(STATE))['delta'], 2))
            await gm.keyboard.up('Shift'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200); await gm.mouse.up(); await gm.wait_for_timeout(400)
            esc = await gm.evaluate(DATA)
            runs[cmd] = {'trace': trace, 'ticks': mid['ticks'], 'marks': mid['marks'], 'rail': mid['rail'], 'stored_mid': stored_mid, 'after': after, 'cmds': s1 - s0, 'committed': last['committed'], 'undone': undone, 'shift': sh, 'esc': esc, 'radius': rad}
        Tn, Rl = runs['edit.rotate'], runs['thing.tilt']
        mag = lambda r: [round(abs(x['delta']), 2) for x in r['trace']]
        sign = lambda r: {(-1 if x['delta'] < 0 else 1) for x in r['trace'] if abs(x['delta']) > 0.01}
        check(mag(Tn) == mag(Rl), 'the same hand path gives the SAME change in degrees on Turn and on Roll, at every sample', f"turn {mag(Tn)}\n         roll {mag(Rl)}")
        check(len(sign(Tn)) == 1 and len(sign(Rl)) == 1, 'each goes one way round for the whole path (no flip mid-drag)', f'turn {sign(Tn)}, roll {sign(Rl)}')
        check(all(near(abs(x['seen']), abs(x['delta']), 0.05) and abs(x['other']) < 0.01 for x in Tn['trace']) and all(near(abs(x['seen']), abs(x['delta']), 0.05) and abs(x['other']) < 0.01 for x in Rl['trace']), 'the thing itself follows at every sample: about the vertical axis for Turn, about the view axis for Roll, and nothing else moves')
        moved = lambda r: [(x['readout'].split(' · ')[0], x['notch'] is not None) for x in r['trace'] if x['hand'] >= 3]  # (Roll also names a stop: "90° ◆ · on its side")
        #  # (the first two samples are inside the 4-px slack on Turn's smaller circle: no drag yet there)
        check(moved(Tn) == moved(Rl), 'the same readout and the same notch catches (0, 45, 90), sample by sample', f"turn {[(x['readout'], x['notch']) for x in Tn['trace']]}\n         roll {[(x['readout'], x['notch']) for x in Rl['trace']]}")
        free = [m for h, m in zip(PATH, mag(Rl)) if h in (8, 12, 17, 23, 30, 38, 61, 75, 110, 100, 84, 70)]
        check(free == [8, 12, 17, 23, 30, 38, 61, 75, 110, 100, 84, 70] and mag(Rl)[PATH.index(44)] == 45 and mag(Rl)[PATH.index(88)] == 90 and mag(Rl)[PATH.index(91)] == 90 and mag(Rl)[PATH.index(2)] == 0, 'degree for degree off the notches (one degree of hand = one degree of roll); within 4° of 0, 45 and 90 it is held in the notch', str(mag(Rl)))
        check(Tn['ticks'] == Rl['ticks'] == 8 and Tn['rail'] and Rl['rail'] and Tn['marks'] == [] and 'on its side' in Rl['marks'] and 'upside down' in Rl['marks'], "the same track: a circle, eight notch ticks; Roll's also names its stops (on its side, upside down)", f"{Tn['ticks']} / {Rl['ticks']} ticks; marks {Tn['marks']} / {Rl['marks']}")
        check(abs(Tn['stored_mid'][0]) < 0.01 and abs(Rl['stored_mid'][1]) < 0.01, 'nothing is stored while the handle is held')
        check(near(abs(Tn['after'][0]), 70, 0.05) and near(abs(Rl['after'][1]), 70, 0.05) and abs(Tn['after'][1]) < 0.01 and abs(Rl['after'][0]) < 0.01 and Tn['cmds'] == Rl['cmds'] == 1, 'on release each stores the same 70°, as ONE command', f"turn {Tn['after']}, roll {Rl['after']}")
        check(all(abs(v) < 0.01 for v in Tn['undone'] + Rl['undone']), 'one undo puts each back')
        check([abs(v) for v in Tn['shift']] == [abs(v) for v in Rl['shift']] and all(abs(abs(v) / 15 - round(abs(v) / 15)) < 1e-6 for v in Rl['shift']) and len(set(abs(v) for v in Rl['shift'])) >= 6, 'with Shift held both go in the same 15° steps', str([abs(v) for v in Rl['shift']]))
        check(all(abs(v) < 0.01 for v in Tn['esc'] + Rl['esc']), 'Esc mid-drag changes nothing, on either')
        print(f"    (the handles: Turn rides a circle of {Tn['radius']:.0f} px on the closed ring, Roll one of {Rl['radius']:.0f} px in the open ☰ circle: the same degrees per degree, more pixels per degree on Roll)")

        print('SHORT: a short, slow drag')
        for cmd, name in (('edit.rotate', 'Turn'), ('thing.tilt', 'Roll')):
            res = {}
            for px in (0, 3, 8, 14, 24):
                await reset(); s0 = await gm.evaluate(seq)
                b, c, rad, a0 = await press(cmd); await gm.wait_for_timeout(150)
                for k in range(1, px + 1): await to(c, rad, a0, math.degrees(k / rad), 45)  # a pixel at a time, slowly
                seen = (await gm.evaluate(POSE))[AX[cmd]]; await gm.mouse.up(); await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(700)
                res[px] = {'arc': math.degrees(px / rad), 'seen': seen, 'stored': (await gm.evaluate(DATA))[AX[cmd]], 'cmds': await gm.evaluate(seq) - s0}
            det = {k: (round(v['arc'], 1), round(v['stored'], 1)) for k, v in res.items()}
            notch = lambda v: v['arc'] <= 4.0  # (within the 0° notch's catch the thing is held upright: the turn's own rule)
            check(all((abs(v['stored']) < 0.01 and abs(v['seen']) < 0.01) if notch(v) else (near(abs(v['seen']), v['arc'], 0.3) and near(abs(v['stored']), v['arc'], 0.3) and v['cmds'] == 1) for k, v in res.items() if k >= 8), f'{name}: a slow drag of 8, 14 and 24 px moves the thing by just that arc (held at 0 only inside the 4° notch), and stores it', f'px: (arc°, stored°) {det}')
            if cmd == 'thing.tilt':
                check(res[0]['cmds'] == 0 and res[3]['cmds'] == 0 and abs(res[0]['stored']) < 0.01 and abs(res[3]['stored']) < 0.01, 'Roll: a press and release without moving, or within the 4-px slack, changes NOTHING (no click action to steal a short drag)', str(det))
            else:
                check(near(abs(res[0]['stored']), 45, 0.05), "Turn: a click is still its 45° turn (its own, older shortcut; Roll has none)", str(det))

        print('HANDLES: free by default, Shift = steps')
        async def handle(cmd, dx, dy, shift, read):
            await reset(); b, c, rad, a0 = await press(cmd)
            if shift: await gm.keyboard.down('Shift')
            vals = []
            for k in range(1, 13): await gm.mouse.move(b['x'] + dx * k / 12, b['y'] + dy * k / 12); await gm.wait_for_timeout(30); vals.append(await gm.evaluate(read))
            if shift: await gm.keyboard.up('Shift')
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150); await gm.mouse.up(); await gm.wait_for_timeout(300); return vals
        lf, ls = await handle('edit.lift', 0, -90, False, "tw.ringDrag().y"), await handle('edit.lift', 0, -90, True, "tw.ringDrag().y")
        check(any(abs(v * 2 - round(v * 2)) > 0.01 for v in lf) and all(abs(v * 2 - round(v * 2)) < 1e-6 for v in ls) and len(set(ls)) > 2, 'raise / lower: free by default, 6-inch steps with Shift', f'{[round(v, 2) for v in lf[-4:]]} / {ls[-4:]}')
        b, c, rad, a0 = await press('edit.resize'); u = [(b['x'] - c[0]) / rad, (b['y'] - c[1]) / rad]; await gm.keyboard.press('Escape'); await gm.mouse.up(); await gm.wait_for_timeout(300)
        rf, rs = await handle('edit.resize', u[0] * 80, u[1] * 80, False, "tw.ringDrag().k"), await handle('edit.resize', u[0] * 80, u[1] * 80, True, "tw.ringDrag().k")
        check(any(abs(v * 4 - round(v * 4)) > 0.01 for v in rf) and all(abs(v * 4 - round(v * 4)) < 1e-6 for v in rs) and len(set(rs)) > 1, 'resize: free by default, 25% steps with Shift', f'{[round(v, 2) for v in rf[-4:]]} / {rs[-4:]}')
        await reset()

        print('PAWNS: free, Shift snaps; the switch turns it round')
        await gm.evaluate("tw.batch([{ type: 'token.create', args: { id: 'tok_shift00001', name: 'Brakka', x: 52.5, z: 22.5 } }])"); await wait(gm, "tw.entities()['tok_shift00001'] && tw.sync.pendingCount() === 0", 8000)
        P = "tw.entities()['tok_shift00001']"
        async def drag_pawn(tx, tz, shift):
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.select([]); (() => { const g = tw.main.grab; g.focus.set(55, 0, 25); g.yaw = 0; g.pitch = 70; g.dist = 45; g.update(); tw.main.rule = 'free'; })()"); await gm.wait_for_timeout(500)
            e = await gm.evaluate(f"({{ x: {P}.x, z: {P}.z }})"); a = await gm.evaluate(f"tw.screenOf({e['x']}, {e['z']}, tw.main, 1.5)"); t = await gm.evaluate(f"tw.screenOf({tx}, {tz})")
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
            if shift: await gm.keyboard.down('Shift')
            for k in range(1, 11): await gm.mouse.move(a['x'] + (t['x'] - a['x']) * k / 10, a['y'] + (t['y'] - a['y']) * k / 10); await gm.wait_for_timeout(30)
            await gm.wait_for_timeout(120); await gm.mouse.up()
            if shift: await gm.keyboard.up('Shift')
            await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(300)
            return await gm.evaluate(f"[{P}.x, {P}.z]")
        centred = lambda p: abs((p[0] - 2.5) / 5 - round((p[0] - 2.5) / 5)) < 1e-6 and abs((p[1] - 2.5) / 5 - round((p[1] - 2.5) / 5)) < 1e-6
        check(await gm.evaluate("tw.prefs.pawnSnap") == 'shift', 'the switch starts at "only with Shift"')
        f1 = await drag_pawn(58.6, 26.1, False); s1 = await drag_pawn(63.9, 31.2, True)
        check(not centred(f1) and math.hypot(f1[0] - 58.6, f1[1] - 26.1) < 2.6, 'by default a dragged pawn goes where it is put, off the squares', str(f1))
        check(centred(s1) and abs(s1[0] - 62.5) < 5.01 and abs(s1[1] - 32.5) < 5.01, 'with Shift it snaps to the middle of a square', str(s1))
        await gm.keyboard.press('Escape'); await bar(gm, 'Pawns snap to squares: always'); await gm.wait_for_timeout(400)
        check(await gm.evaluate("tw.prefs.pawnSnap") == 'always' and await gm.evaluate("JSON.parse(localStorage.getItem('tw.prefs')).pawnSnap") == 'always', 'the command bar\'s "Pawns snap to squares: always" sets the switch, and it is kept in this browser')
        s2 = await drag_pawn(57.1, 23.9, False); f2 = await drag_pawn(51.2, 28.8, True)
        check(centred(s2) and not centred(f2), 'switched to "always": a dragged pawn snaps, and Shift frees it (the rule before 2026-10-11)', f'{s2} {f2}')
        await gm.evaluate("tw.settings.open && tw.settings.open('me')"); await gm.wait_for_timeout(600)
        row = await gm.evaluate("(() => { const el = document.querySelector('[data-pref=\"pawnSnap\"]'); return el && { value: el.value, options: [...el.options].map(o => o.textContent), label: el.closest('.srow, tr, div')?.innerText.split('\\n')[0] || '' }; })()")
        check(row and row['value'] == 'always' and len(row['options']) == 2, 'Settings ▸ Me has the switch "Pawns snap to squares" with its two choices', str(row))
        if row: await gm.select_option('[data-pref="pawnSnap"]', 'shift'); await gm.wait_for_timeout(300)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        check(await gm.evaluate("tw.prefs.pawnSnap") == 'shift', 'and choosing "Only with Shift" there puts it back')
        # the placing ghost of a figure dragged out of a list: the same rule, the same switch
        async def drop(shift, x, z):
            before = await gm.evaluate("Object.keys(tw.entities())")
            await gm.evaluate(f"(() => {{ tw.pawnTool.start(null); tw.mode.viaDrag = true; tw.pawnTool.placeAt(null, Object.assign([{x}, {z}], {{ y: 0 }}), {{ shiftKey: {str(shift).lower()} }}); tw.modes.cancel(); }})()")
            await wait(gm, f"Object.keys(tw.entities()).length === {len(before) + 1} && tw.sync.pendingCount() === 0", 8000)
            return await gm.evaluate(f"(() => {{ const e = Object.values(tw.entities()).find(e => !{json.dumps(before)}.includes(e.id)); return e && [e.x, e.z]; }})()")
        g1, g2 = await drop(False, 71.3, 11.8), await drop(True, 76.4, 16.9)
        await gm.evaluate("tw.settings.setPref('pawnSnap', 'always')"); g3, g4 = await drop(False, 81.3, 11.8), await drop(True, 86.4, 16.9); await gm.evaluate("tw.settings.setPref('pawnSnap', 'shift')")
        check(g1 and not centred(g1) and near(g1[0], 71.3, 0.02) and centred(g2) and centred(g3) and not centred(g4), 'a figure dragged out of a list: let go off the squares by default, on a square with Shift; with the switch on "always", the other way round', f'{g1} {g2} {g3} {g4}')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('?'); await gm.wait_for_timeout(500)
        txt = await gm.evaluate("document.body.innerText")
        check('Moves freely · snaps to the squares' in txt and 'in steps: turn and roll 15°' in txt and 'snaps to the half squares' in txt, 'the "?" sheet says it: pawns, things and the ring handles (Shift = steps)')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')

        print('THINGS: furniture is free, Shift snaps to the half squares')
        async def drag_thing(i, tx, tz, shift):
            await gm.keyboard.press('Escape'); await gm.evaluate(f"tw.select([]); (() => {{ const g = tw.main.grab; g.focus.set(48, 0, 14); g.yaw = 0; g.pitch = 70; g.dist = 40; g.update(); tw.main.rule = 'free'; }})()"); await gm.wait_for_timeout(500)
            e = await gm.evaluate(f"({{ x: {E(i)}.x, z: {E(i)}.z, h: {E(i)}.dims[1] }})"); a = await gm.evaluate(f"tw.screenOf({e['x']}, {e['z']}, tw.main, {e['h'] * 0.5})"); t = await gm.evaluate(f"tw.screenOf({tx}, {tz}, tw.main, {e['h'] * 0.5})")
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await gm.mouse.move(a['x'] + 6, a['y'] + 6)
            if shift: await gm.keyboard.down('Shift')
            for k in range(1, 11): await gm.mouse.move(a['x'] + (t['x'] - a['x']) * k / 10, a['y'] + (t['y'] - a['y']) * k / 10); await gm.wait_for_timeout(30)
            await gm.wait_for_timeout(120); await gm.mouse.up()
            if shift: await gm.keyboard.up('Shift')
            await wait(gm, "tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(300)
            return await gm.evaluate(f"[{E(i)}.x, {E(i)}.z]")
        half = lambda p: abs(p[0] / 2.5 - round(p[0] / 2.5)) < 1e-6 and abs(p[1] / 2.5 - round(p[1] / 2.5)) < 1e-6
        t1 = await drag_thing(T, 49.1, 15.7, False); t2 = await drag_thing(T, 53.4, 18.6, True)
        check(not half(t1) and math.hypot(t1[0] - 44.3, t1[1] - 12.4) > 2 and half(t2) and math.hypot(t2[0] - t1[0], t2[1] - t1[1]) > 2, 'a piece of furniture dragged: where it is put by default; with Shift on the half squares (2.5 ft)', f'{t1} {t2}')
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
    for d in TMP: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\nshift: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
