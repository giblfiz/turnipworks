#!/usr/bin/env python3
"""RIDERS: what stands on a thing moves with it (Harry 2026-11-07: "If I stand a pawn on a table, and then I move the
table, it should move the pawn with it"; core/riders.js, docs/PAWNS.md "Riders"). A real library table, drawn; a pawn
put on its top the way a player does it (raised over it and let go: it settles on the top), real keys and a real drag.

  the pawn stands on the table by the browser's own look (app.pawnCarrier: what its base is drawn on)
  arrow key: the table and the pawn on it move together; the pawn on the floor beside it does not; one undo puts both back
  drag (mouse): the pawn rides, keeping its place on the top; ONE command went out
  snapshot: a table dragged UNDER a pawn standing on the floor does not scoop it up
  turn (R): the pawn goes round the table's middle and turns with it
  raise (the lift car): the table raised 5 ft takes the pawn up 5 ft; lowered, down again
  stack: a mug on a tray on the table, and a pawn on the tray, all ride
  a hanging thing on a wall carries nothing

  local:  TW_GPU=1 TW_PORTS=18417,18418 python3 engine/test/browser_riders.py --local
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE); import served
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
SHOTS = os.environ.get('TW_SHOTS') or tempfile.gettempdir()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)

procs = []; tmpdirs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18417,18418').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-riders-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
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
TID, TRAY, MUG, SHELF = 'obj_table000001', 'obj_tray0000001', 'obj_mug00000001', 'obj_shelf000001'
P_ON, P_FLOOR, P_TRAY = 'tok_onit0000001', 'tok_floor000001', 'tok_ontray00001'
async def ents(pg, ids): return await pg.evaluate(f"Object.fromEntries({json.dumps(ids)}.map(i => [i, (({{ x, y, z, rot }}) => ({{ x, y: y || 0, z, rot: rot || 0 }}))(tw.entities()[i])]))")
async def settle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 8000, 'sent'); await pg.wait_for_timeout(250)
async def view(pg, x, z, dist=26, pitch=70):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(300)
async def screen(pg, id, dy=0.0):
    return await pg.evaluate(f"(() => {{ const e = tw.entities()[{json.dumps(id)}], w = tw.worldOf(tw.area()), b = w.boundsOf(w.recs.get(e.id)); const s = tw.screenOf(e.x, e.z, tw.main, b.max.y + {dy}); return [s.x, s.y]; }})()")
async def shot(pg, name): await pg.screenshot(path=os.path.join(SHOTS, f'riders-{name}.png'))
def moved(a, b, dx, dz, tol=0.03): return abs(b['x'] - a['x'] - dx) < tol and abs(b['z'] - a['z'] - dz) < tol
async def click_thing(pg, id):
    """a real click on the thing where nothing stands on it: the first spot over its top whose pick is the thing itself"""
    p = await pg.evaluate(f"""(() => {{ const e = tw.entities()[{json.dumps(id)}], w = tw.worldOf(tw.area()), b = w.boundsOf(w.recs.get(e.id)), [dw, , dd] = e.dims;
      for (const [u, v] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3], [0, 0.35], [0.35, 0], [0, -0.35], [-0.35, 0], [0, 0]]) {{
        const c = Math.cos(e.rot || 0), sn = Math.sin(e.rot || 0), lx = u * dw, lz = v * dd, x = e.x + lx * c + lz * sn, z = e.z - lx * sn + lz * c, s = tw.screenOf(x, z, tw.main, b.max.y - 0.05);
        const hits = w.pickAll(tw.rayAt(s.x, s.y)).map(h => tw.selectionFor(h)).filter(Boolean); if (hits[0] === e.id) return [s.x, s.y]; }} return null; }})()""")
    if not p: return False
    await pg.evaluate(f"tw.lastClickAt = {json.dumps(p)}")
    await pg.mouse.click(*p); await pg.wait_for_timeout(150)
    return id in await pg.evaluate("[...tw.sel]")
async def cmds_since(pg, n0): return await pg.evaluate(f"tw.applied.slice({n0}).filter(a => a[3] !== 'fog.explore' && !String(a[3]).startsWith('presence')).map(a => a[3])")

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce')
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        NAME = f"TEST riders {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 60000), 'GM tab live', NAME)
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await gm.evaluate("document.querySelector('.lmcard .lm-x')?.click()")

        print('FIXTURE: a library table, a tray and a mug on it, a shelf on a wall, pawns')
        # the pieces are copied from a rolled room (real catalog things, sized as the game sizes them), then put on open ground
        lib = None
        for seed in range(1, 10):
            await gm.evaluate(f"tw.spawnRoom('mansion-library', 40, {(seed - 1) * 12}, 6, 6, {seed})"); await settle(gm)
            lib = await gm.evaluate("""(() => { const E = Object.values(tw.entities()), keep = (e) => e && ({ name: e.name, cat: e.cat, sku: e.sku, url: e.url, place: e.place, layer: e.layer, yaw: e.yaw || 0, s: e.s || undefined, dims: e.dims });
              const t = E.filter(e => e.kind === 'object' && /desk|table/.test(e.cat) && e.dims?.[1] > 1.5 && e.dims[1] < 4 && tw.childrenOf(e).length >= 2)[0]; if (!t) return null;
              const kids = tw.childrenOf(t).sort((a, b) => b.dims[0] * b.dims[2] - a.dims[0] * a.dims[2]);
              return { table: keep(t), tray: keep(kids[0]), mug: keep(kids[1]), shelf: keep(E.find(e => e.kind === 'object' && e.place === 'wall' && !e.fromEdge)) }; })()""")
            if lib: break
        check(lib and lib['table'] and lib['tray'] and lib['mug'], '(fixture) a rolled room gives a table and two things that stand on it', lib and {k: v and v['cat'] for k, v in lib.items()})
        await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 90000, 'spawn over')
        T = lib['table']; th = T['dims'][1]
        def place(id, spec, x, z, y=0, parent=None, extra=None):
            a = {**{k: v for k, v in spec.items() if v is not None}, 'id': id, 'x': x, 'z': z, 'y': y or 0, 'rot': 0, **({'parent': parent} if parent else {}), **(extra or {})}
            return {'type': 'object.place', 'args': a}
        await gm.evaluate(f"tw.batch({json.dumps([place(TID, T, 10, 10)])})")
        await settle(gm); await view(gm, 10, 10)
        loaded = f"(id) => {{ const r = tw.worldOf(tw.area()).recs.get(id); return !!r?.visual && !r.visual.userData?.placeholder; }}"
        check(await wait(gm, f"({loaded})({json.dumps(TID)})", 30000, 'table mesh'), '(fixture) the table is drawn (its mesh, not the stand-in box)')
        await gm.wait_for_timeout(400)
        top = await gm.evaluate(f"(() => {{ const s = tw.worldOf(tw.area()).surfaceBelow(10, 20, 10, new Set(), 0); return s && {{ y: s.y, parent: s.parent }}; }})()")
        check(top and top['parent'] == TID and top['y'] > 1, '(fixture) the table has a top a thing lands on', top)
        ty = round(top['y'], 2)
        ops = [place(TRAY, lib['tray'], 10.6, 10, ty, TID), place(MUG, lib['mug'], 10.8, 10, None, None)]
        await gm.evaluate(f"tw.batch({json.dumps(ops[:1])})"); await settle(gm)
        await wait(gm, f"({loaded})({json.dumps(TRAY)})", 30000, 'tray mesh'); await gm.wait_for_timeout(300)
        tray_top = await gm.evaluate(f"(() => {{ const s = tw.worldOf(tw.area()).surfaceBelow(10.6, {ty} + 5, 10, new Set(), 0); return s && {{ y: s.y, parent: s.parent }}; }})()")
        if lib['shelf']: await gm.evaluate(f"tw.batch({json.dumps([place(SHELF, lib['shelf'], 30, 2, 4)])})")
        mug_y = round(tray_top['y'], 2) if tray_top and tray_top['parent'] == TRAY else ty
        mug_parent = TRAY if tray_top and tray_top['parent'] == TRAY else TID
        await gm.evaluate(f"tw.batch({json.dumps([place(MUG, lib['mug'], 10.8, 10, mug_y, mug_parent)])})")
        # pawns: one beside the table on the floor, one raised over the table and let go (it settles on the top: the way a player puts it there)
        await gm.evaluate(f"""tw.batch([{{ type: 'token.create', args: {{ id: '{P_ON}', name: 'Rider', x: 8.8, z: 9.6, rot: 0 }} }}, {{ type: 'token.create', args: {{ id: '{P_FLOOR}', name: 'Floor', x: 10 + {T['dims'][0]} / 2 + 2.5, z: 10 }} }}])""")
        await settle(gm)
        await gm.evaluate(f"tw.liftTo(tw.entities()['{P_ON}'], {ty} + 1.5)"); await settle(gm)
        e = await ents(gm, [P_ON])
        check(abs(e[P_ON]['y'] - ty) < 0.06, 'a pawn raised over the table and let go settles on its top', {'pawn y': e[P_ON]['y'], 'top': ty})
        on = await gm.evaluate(f"tw.pawnCarrier?.(tw.entities()['{P_ON}'])"); fl = await gm.evaluate(f"tw.pawnCarrier?.(tw.entities()['{P_FLOOR}'])")
        check(on == TID and fl is None, 'the browser\'s look: the pawn stands on the table, the other on the floor', {'on': on, 'floor': fl})
        base = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), r = w.recs.get('{P_ON}'); const e = r.entity; w.pawnBaseAt(r, e.x, e.y || 0, e.z); return {{ ...r.baseAt, E: undefined }}; }})()")
        check(base.get('on') == 'thing' and abs(base['y'] - ty) < 0.03, 'and it is DRAWN standing there: its base on the top, no beam down to the floor (it was on the floor, under a "2.5 ft" beam, when its stored height rounded under the mesh top)', {k: base.get(k) for k in ('y', 'on')})
        await shot(gm, '1-before')

        print('ARROW KEY')
        check(await click_thing(gm, TID), '(fixture) a click selects the table')
        b0 = await ents(gm, [TID, P_ON, P_FLOOR, TRAY, MUG]); n0 = await gm.evaluate("tw.applied.length")
        await gm.keyboard.press('ArrowRight'); await settle(gm)
        b1 = await ents(gm, [TID, P_ON, P_FLOOR, TRAY, MUG]); dx, dz = b1[TID]['x'] - b0[TID]['x'], b1[TID]['z'] - b0[TID]['z']
        check(abs(dx) + abs(dz) > 4, '(fixture) the arrow moved the table a square', [dx, dz])
        check(moved(b0[P_ON], b1[P_ON], dx, dz) and abs(b1[P_ON]['y'] - b0[P_ON]['y']) < 0.02, 'arrow key: the pawn on the table moves with it, at the same height', {'table': [dx, dz], 'pawn': [b1[P_ON]['x'] - b0[P_ON]['x'], b1[P_ON]['z'] - b0[P_ON]['z']]})
        check(moved(b0[TRAY], b1[TRAY], dx, dz) and moved(b0[MUG], b1[MUG], dx, dz), 'arrow key: the tray and the mug on it ride too')
        check(moved(b0[P_FLOOR], b1[P_FLOOR], 0, 0), 'arrow key: the pawn on the floor beside it stays')
        sent = await cmds_since(gm, n0)
        check(sent == ['object.move'], 'arrow key: ONE command (the table\'s move, its riders in it)', sent)
        await shot(gm, '2-arrow')
        await gm.keyboard.press('Control+z'); await settle(gm)
        b2 = await ents(gm, [TID, P_ON, TRAY, MUG])
        check(all(moved(b0[k], b2[k], 0, 0) for k in (TID, P_ON, TRAY, MUG)), 'undo (Ctrl+Z): one step puts the table and everything on it back')

        print('DRAG')
        await view(gm, 10, 10)
        check(await click_thing(gm, TID), '(fixture) the table is selected')
        a = await gm.evaluate("tw.lastClickAt || null") or await screen(gm, TID, -0.05); b0 = await ents(gm, [TID, P_ON, P_FLOOR, MUG]); n0 = await gm.evaluate("tw.applied.length")
        await gm.mouse.move(*a); await gm.mouse.down()
        for i in range(1, 9): await gm.mouse.move(a[0] - 12 * i, a[1] + 6 * i); await gm.wait_for_timeout(30)
        mid = await gm.evaluate(f"(() => {{ const d = tw.localDrags.get('{P_ON}'); return d ? [d.x, d.z] : null; }})()")
        await shot(gm, '3-drag-mid')
        await gm.mouse.up(); await settle(gm)
        b1 = await ents(gm, [TID, P_ON, P_FLOOR, MUG]); dx, dz = b1[TID]['x'] - b0[TID]['x'], b1[TID]['z'] - b0[TID]['z']
        check(abs(dx) + abs(dz) > 1, '(fixture) the drag moved the table', [round(dx, 2), round(dz, 2)])
        check(mid is not None, 'drag: while dragging, the pawn on the table is drawn going with it (here and for other seats: the drag presence)', mid)
        check(moved(b0[P_ON], b1[P_ON], dx, dz) and abs(b1[P_ON]['y'] - b0[P_ON]['y']) < 0.05, 'drag: the pawn rides, keeping its place on the top', {'table': [round(dx, 2), round(dz, 2)], 'pawn': [round(b1[P_ON]['x'] - b0[P_ON]['x'], 2), round(b1[P_ON]['z'] - b0[P_ON]['z'], 2)]})
        check(moved(b0[MUG], b1[MUG], dx, dz), 'drag: the mug on the tray rides')
        sent = await cmds_since(gm, n0)
        check(len(sent) == 1, 'drag: ONE command went out (one entry, one undo)', sent)
        await shot(gm, '4-drag')

        print('SNAPSHOT: dragging a table under a pawn does not scoop it up')
        fp0 = await ents(gm, [P_FLOOR]); t0 = await ents(gm, [TID])
        await gm.evaluate(f"tw.select('{TID}')")
        await gm.evaluate(f"tw.moveBy([tw.entities()['{TID}']], {fp0[P_FLOOR]['x']} - {t0[TID]['x']}, {fp0[P_FLOOR]['z']} - {t0[TID]['z']})"); await settle(gm)
        fp1 = await ents(gm, [P_FLOOR, TID])
        check(abs(fp1[TID]['x'] - fp0[P_FLOOR]['x']) < 0.05 and moved(fp0[P_FLOOR], fp1[P_FLOOR], 0, 0) and abs(fp1[P_FLOOR]['y'] - fp0[P_FLOOR]['y']) < 0.02, 'the table moved under the floor pawn: the pawn did not move or rise', fp1)
        await gm.evaluate(f"tw.moveBy([tw.entities()['{TID}']], {t0[TID]['x']} - {fp0[P_FLOOR]['x']}, {t0[TID]['z']} - {fp0[P_FLOOR]['z']})"); await settle(gm)
        fp2 = await ents(gm, [P_FLOOR])
        check(moved(fp0[P_FLOOR], fp2[P_FLOOR], 0, 0), 'and moving the table away again leaves it there too (it never joined)')

        print('TURN (R)')
        await view(gm, (await ents(gm, [TID]))[TID]['x'], 10)
        check(await click_thing(gm, TID), '(fixture) the table is selected')
        b0 = await ents(gm, [TID, P_ON]); await gm.keyboard.press('r'); await settle(gm); b1 = await ents(gm, [TID, P_ON])
        import math
        da = b1[TID]['rot'] - b0[TID]['rot']; ox, oz = b0[P_ON]['x'] - b0[TID]['x'], b0[P_ON]['z'] - b0[TID]['z']
        ex, ez = b1[TID]['x'] + ox * math.cos(da) + oz * math.sin(da), b1[TID]['z'] - ox * math.sin(da) + oz * math.cos(da)
        check(abs(da) > 0.5, '(fixture) R turned the table', round(da, 3))
        check(abs(b1[P_ON]['x'] - ex) < 0.03 and abs(b1[P_ON]['z'] - ez) < 0.03, 'turn: the pawn goes round the table\'s middle with it', {'pawn': [b1[P_ON]['x'], b1[P_ON]['z']], 'expected': [round(ex, 2), round(ez, 2)]})
        check(abs(b1[P_ON]['rot'] - b0[P_ON]['rot'] - da) < 1e-3, 'turn: and it turns (its facing) by as much')
        await shot(gm, '5-turn')

        print('RAISE AND LOWER (the lift car)')
        b0 = await ents(gm, [TID, P_ON, MUG])
        await gm.evaluate(f"tw.liftTo(tw.entities()['{TID}'], 5)"); await settle(gm); b1 = await ents(gm, [TID, P_ON, MUG])
        check(abs(b1[TID]['y'] - 5) < 0.02 and abs(b1[P_ON]['y'] - b0[P_ON]['y'] - 5) < 0.03 and moved(b0[P_ON], b1[P_ON], 0, 0), 'raise: the table 5 ft up takes the pawn on it 5 ft up, in place', {'table y': b1[TID]['y'], 'pawn y': [b0[P_ON]['y'], b1[P_ON]['y']]})
        check(abs(b1[MUG]['y'] - b0[MUG]['y'] - 5) < 0.03, 'raise: the mug too')
        await shot(gm, '6-raised')
        on2 = await gm.evaluate(f"tw.pawnCarrier?.(tw.entities()['{P_ON}'])")
        check(on2 == TID, 'raised, the pawn still stands on the table by the browser\'s look (it rides on: no float)', on2)
        base2 = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), r = w.recs.get('{P_ON}'); const e = r.entity; w.pawnBaseAt(r, e.x, e.y || 0, e.z); return {{ y: r.baseAt.y, on: r.baseAt.on }}; }})()")
        check(base2['on'] == 'thing' and abs(base2['y'] - b1[P_ON]['y']) < 0.03, 'raised, its base is drawn on the raised top (it rides the lift car, it does not hang over the floor)', base2)
        await gm.evaluate(f"tw.liftTo(tw.entities()['{TID}'], 0)"); await settle(gm); b2 = await ents(gm, [TID, P_ON])
        check(abs(b2[TID]['y']) < 0.02 and abs(b2[P_ON]['y'] - b0[P_ON]['y']) < 0.03, 'lower: and down again together')

        print('STACK: a pawn on the tray')
        tr = await ents(gm, [TRAY])
        await gm.evaluate(f"tw.batch([{{ type: 'token.create', args: {{ id: '{P_TRAY}', name: 'Mouse', x: {tr[TRAY]['x']}, z: {tr[TRAY]['z']}, y: {mug_y if mug_parent == TRAY else ty} + 1.5, size: 0.5 }} }}])"); await settle(gm)
        await gm.evaluate(f"tw.liftTo(tw.entities()['{P_TRAY}'], tw.entities()['{P_TRAY}'].y)"); await settle(gm)
        car = await gm.evaluate(f"tw.pawnCarrier?.(tw.entities()['{P_TRAY}'])")
        check(car in (TRAY, MUG, TID), 'a pawn let go over the tray stands on what is drawn there', car)
        snap = await gm.evaluate(f"Object.fromEntries([...(tw.ridersSnapshot?.([tw.entities()['{TID}']]) || [])].map(([k, v]) => [k, v]))")
        R = snap.get(TID, [])
        check(all(i in R for i in (TRAY, MUG, P_ON, P_TRAY)) and P_FLOOR not in R, 'the table\'s riders, however deep: the tray, the mug, the pawn on the table and the pawn on the tray (not the floor pawn)', R)
        if lib['shelf']:
            sh = await gm.evaluate(f"Object.fromEntries([...(tw.ridersSnapshot?.([tw.entities()['{SHELF}']]) || [])])")
            check(not sh, 'a thing hung on a wall carries no pawns', sh)
        b0 = await ents(gm, [TID, P_TRAY]); await gm.evaluate(f"tw.select('{TID}'); tw.nudge(0, 5)"); await settle(gm); b1 = await ents(gm, [TID, P_TRAY])
        check(moved(b0[P_TRAY], b1[P_TRAY], 0, 5), 'the pawn on the tray rides the table')
        await shot(gm, '7-stack')

        check(not errors, 'no page errors', errors[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate(); p.wait(timeout=5)
        except Exception: pass
    import shutil
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
n = len(results); bad = [r for r in results if not r[0]]
print(f"\nbrowser_riders: {n - len(bad)}/{n} passed"); sys.exit(1 if bad or not n else 0)
