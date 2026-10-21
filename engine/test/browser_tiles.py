#!/usr/bin/env python3
"""Floor tiles (Harry 2026-10-04): every tuner floor is a placeable 5-ft tile: in the bar and the library areas (a
Floors section, the room type's own floors first), drag-out placement, a PAINT tool (drag a run, Shift-drag a
rectangle; one command each), snapped to the grid, replacing the cell's generated floor, patterns continuing across
tiles by world cell, rugs on top, and ordinary objects afterwards (select, move, swap, delete, copy/paste).

  local:  python3 engine/test/browser_tiles.py --local
  live:   ... browser_tiles.py --page https://turnipworks.net/
"""
import argparse, asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
# TW_GPU=1: render on the GPU (Vulkan) instead of software GL: several times faster, and steadier on a loaded machine
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
RP, SP = 18097, 18726
def start_local():
    data = tempfile.mkdtemp(prefix='tw-tiles-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def drag(pg, a, b, steps=12, step_ms=30):
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, steps + 1):
        await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(step_ms)
    await pg.mouse.up()
async def topdown(pg, x, z, dist=60, pitch=89.5):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(200)
from audit import AUDIT  # "everything on screen is touchable" (engine/test/audit.py)
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
async def audit(pg, label):
    await pg.evaluate("tw.scene?.updateMatrixWorld?.(); tw.worldOf(tw.area()).scene.updateMatrixWorld()")
    a = await pg.evaluate(AUDIT)
    check(a['tested'] > 50 and a['nbad'] == 0, f'everything on screen is touchable ({label}): every drawn point that is not ground or floor picks something selectable', f"{a['tested']} points · {a['nbad']} untouchable {a['kinds']} {a['bad'][:2]}")
TILES = "Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place === 'tile')"
C = lambda g: g * 5 + 2.5

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, permissions=['clipboard-read', 'clipboard-write'])
        gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
        await gm.goto(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST tiles ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        rid = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 4242)")
        await wait(gm, f"!!tw.entities()['{rid}']", 10000, 'room')
        await gm.wait_for_timeout(6000)  # the spawn choreography
        await topdown(gm, 10, 10, 70)
        W = "tw.worldOf(tw.area())"
        await topdown(gm, 15, 10, 55, 55); await gm.wait_for_timeout(1500)
        await audit(gm, 'after building a room')
        # negative control: make the posts unpickable again (as before the fix): the audit must catch them
        neg = await gm.evaluate(f"(() => {{ const w = {W}, ps = [...w.shell.values()].filter(s => /^c/.test(s.key)); ps.forEach(s => s.group.userData.edgeKey = null); const a = " + AUDIT + "; ps.forEach(s => s.group.userData.edgeKey = s.key); return a; })()")
        check(neg['nbad'] > 0 and any(k.startswith('c') for k in neg['kinds']), 'control: with the posts made unpickable (the old bug), the audit does catch them', f"{neg['nbad']} untouchable points {neg['kinds']}")
        await topdown(gm, 10, 10, 70)

        print('CATALOG: every floor is a tile in the bar')
        cat = await gm.evaluate(f"({{ tiles: tw.assets.catalog.filter(c => c.place === 'tile').map(c => c.id), floors: tw.tiles.floorCats(tw.lib) }})")
        check(len(cat['tiles']) == len(cat['floors']) >= 25 and all(f in cat['tiles'] for f in ('floor-brick-herringbone-bw', 'floor-checker-bw', 'floor-flagstone-broken', 'floor-flagstone-large', 'floor-earth-straw', 'floor-planks-dark')), 'every flat floor material (patterned, checkers, flagstones, broken flagstones, the straw scatter) is a placeable tile', f"{len(cat['tiles'])} tiles")

        print('PAINT: drag a run across cells, one command, snapped, replacing the generated floor')
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('floor-brick-herringbone-bw'))")
        check(await gm.evaluate("tw.mode?.kind === 'place' && tw.modes.isPaint() && tw.mode.keep"), 'picking a floor tile gives the paint tool (it stays until Esc)')
        await drag(gm, await scr(gm, C(0), C(0)), await scr(gm, C(3), C(0)))
        ok = await wait(gm, f"{TILES}.length === 4", 8000, 'run')
        ts = await gm.evaluate(f"{TILES}.map(e => [e.x, e.z, e.y, e.layer, e.flat, e.cat, e.room])")
        check(ok and sorted((t[0], t[1]) for t in ts) == [(C(i), C(0)) for i in range(4)] and all(t[2] == 0 and t[3] == 'floor' and t[4] and t[6] == rid for t in ts), 'a drag across four cells lays four tiles, each centred on its 5-ft cell, flat, in the room', ts[:2])
        hidden = await gm.evaluate(f"[...{W}.shell.keys()].filter(k => k.startsWith('{rid}:f')).map(k => k.split(':f')[1])")
        check(all(f'{i}:0' not in hidden for i in range(4)) and '4:0' in hidden and '0:1' in hidden, "the tiled cells' generated floor is gone (no doubled floor, no z-fighting); the untouched cells keep theirs", f"{len(hidden)} generated cells left")
        drawn = await gm.evaluate(f"(async () => {{ const w = {W}; await Promise.all([...w.recs.values()].filter(r => r.entity.place === 'tile').map(r => r.ready)); return [...w.recs.values()].filter(r => r.entity.place === 'tile').map(r => !!r.visual?.userData?.tile && r.group.position.y === 0); }})()")
        check(drawn and all(drawn), "each tile draws the tuner's own floor texture", drawn)
        await gm.evaluate("tw.undo()")
        ok = await wait(gm, f"{TILES}.length === 0", 8000, 'undo run')
        back = await gm.evaluate(f"[...{W}.shell.keys()].filter(k => k.startsWith('{rid}:f0:0')).length")
        check(ok and back == 1, 'ONE undo takes the whole stroke back, and the generated floor returns')

        print('RECTANGLE: Shift-drag fills a rectangle (one command)')
        await gm.keyboard.down('Shift')
        await drag(gm, await scr(gm, C(0), C(0)), await scr(gm, C(3), C(2)))
        await gm.keyboard.up('Shift')
        ok = await wait(gm, f"{TILES}.length === 12", 8000, 'rect')
        check(ok, 'Shift-drag from one cell to another fills the 4 × 3 rectangle: 12 tiles', await gm.evaluate(f"{TILES}.length"))
        check(await gm.evaluate("tw.mode?.kind === 'place' && tw.modes.isPaint()"), 'and the paint tool is still live')
        # continuity: a tile's crop is its WORLD cell's, exactly what the room's own floor would draw there
        cont = await gm.evaluate(f"""(() => {{ const look = tw.assets.look, rm = tw.entities()['{rid}'];
          const room = tw.roomgen.roomsOf(tw.entities()).find(r => r.id === '{rid}'), gen = look.floorSpecs({{ ...room, floor: 'floor-brick-herringbone-bw' }}).specs;
          return {TILES}.map(e => {{ const t = tw.tiles.tileSpecs(look, e.cat, e.x, e.z)[0], g = gen.find(s => s.x === e.x && s.z === e.z); return [t.sku, g?.sku, t.rot]; }}); }})()""")
        shapes = {c[0].split('--')[-1] for c in cont}
        check(cont and all(c[0] == c[1] and c[2] == 0 for c in cont) and len(shapes) >= 9, 'herringbone continues across tiles: each tile shows the crop of the 4 × 4-cell layout its world cell picks, exactly as the room floor would (unrotated)', f"{len(shapes)} distinct crops")
        await gm.keyboard.press('Escape')
        await topdown(gm, C(1.5), C(1), 26, 70)
        await gm.wait_for_timeout(1500)
        await gm.screenshot(path=os.path.join(SHOTS, 'tiles-herringbone.png'))

        await topdown(gm, 15, 10, 55, 55); await gm.wait_for_timeout(1500)
        await audit(gm, 'after painting floors')
        await topdown(gm, 10, 10, 70)
        print('REPLACE + RUGS: painting over a tile takes its place; rugs lie on top')
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('floor-planks-dark'))")
        await topdown(gm, 10, 10, 70)
        p = await scr(gm, C(1), C(1)); await gm.mouse.click(p['x'], p['y'])
        ok = await wait(gm, f"{TILES}.some(e => e.cat === 'floor-planks-dark')", 8000, 'replace')
        cell = await gm.evaluate(f"{TILES}.filter(e => e.x === {C(1)} && e.z === {C(1)}).map(e => e.cat)")
        check(ok and cell == ['floor-planks-dark'] and await gm.evaluate(f"{TILES}.length") == 12, 'a click paints one cell; the herringbone tile there is replaced (one tile per cell)', cell)
        await gm.keyboard.press('Escape')
        rug = await gm.evaluate("tw.assets.catalog.find(c => c.flat && c.place === 'floor' && /rug|carpet/.test(c.id))?.id")
        await gm.evaluate(f"tw.modes.place(tw.assets.catById.get('{rug}'))")
        p = await scr(gm, C(2) + 1, C(1)); await gm.mouse.move(p['x'] - 5, p['y']); await gm.mouse.click(p['x'], p['y'])
        ok = await wait(gm, f"Object.values(tw.entities()).some(e => e.cat === '{rug}' && !e.room?.startsWith('x') && e.y >= 0.03 && Math.abs(e.x - {C(2) + 1}) < 1)", 8000, 'rug')
        check(ok, 'a rug placed on painted tiles lies above them (y ≥ 0.03, the tiles sit at 0.02)', rug)
        await gm.keyboard.press('Escape')

        print('OBJECTS: select, swap for similar, move, copy/paste, delete')
        # tiles outside any room, clear of furniture
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('floor-flagstone-broken'))")
        await topdown(gm, -10, 10, 60)
        await drag(gm, await scr(gm, C(-3), C(1)), await scr(gm, C(-2), C(1)))
        await wait(gm, f"{TILES}.filter(e => e.x < 0).length === 2", 8000, 'outside')
        await gm.keyboard.press('Escape')
        tid = await gm.evaluate(f"{TILES}.find(e => e.x === {C(-3)}).id")
        p = await scr(gm, C(-3), C(1)); await gm.mouse.click(p['x'], p['y'])
        await gm.wait_for_timeout(400)
        check(await gm.evaluate(f"tw.sel.has('{tid}')") and await gm.evaluate("!!document.querySelector('#ring [data-cmd]') && !document.querySelector('#ring [data-cmd=\"edit.resize\"]')"), 'a click selects a tile like any object; its ring has no resize (a tile is one cell)')
        sim = await gm.evaluate(f"tw.assets.similar('floor-flagstone-broken').map(v => v.cat)")
        check(len(sim) >= 8 and all(s.startswith('floor-') for s in sim) and sim[0].startswith('floor-flagstone'), '"replace with similar" offers the other floor materials, nearest in kind first', sim[:4])
        await gm.evaluate(f"tw.replaceWith(tw.entities()['{tid}'], tw.assets.similar('floor-flagstone-broken')[0])")
        ok = await wait(gm, f"tw.entities()['{tid}'].cat === '{sim[0]}'", 8000, 'swap')
        check(ok and await gm.evaluate(f"tw.entities()['{tid}'].x === {C(-3)} && tw.entities()['{tid}'].place === 'tile'"), 'swapping keeps it a tile on its cell', sim[0])
        # move by dragging (selected): it snaps to the next cell, replacing the tile that was there
        await gm.wait_for_timeout(300)
        await drag(gm, await scr(gm, C(-3), C(1)), await scr(gm, C(-3) + 5.6, C(1) + 0.8))
        ok = await wait(gm, f"tw.entities()['{tid}'].x === {C(-2)}", 8000, 'move')
        out = await gm.evaluate(f"{TILES}.filter(e => e.x < 0).map(e => [e.id, e.x, e.z])")
        check(ok and len(out) == 1 and out[0][2] == C(1), 'dragging a selected tile moves it cell to cell, onto the grid, and it takes the place of the tile it lands on', out)
        await gm.evaluate(f"tw.select(['{tid}'])"); await gm.evaluate("tw.duplicate()")
        ok = await wait(gm, f"{TILES}.filter(e => e.x < 0).length === 2", 8000, 'dup')
        dup = await gm.evaluate(f"{TILES}.filter(e => e.x < 0 && e.id !== '{tid}').map(e => [e.x, e.z])")
        check(ok and dup and (dup[0][0] - 2.5) % 5 == 0 and (dup[0][1] - 2.5) % 5 == 0, 'copy/paste (duplicate) lands the copy on a grid cell', dup)
        await gm.evaluate(f"tw.select(['{tid}'])"); await gm.wait_for_timeout(200)
        p = await scr(gm, C(-2), C(1)); await gm.mouse.move(p['x'], p['y'])
        await gm.keyboard.press('Delete')
        check(await wait(gm, f"!tw.entities()['{tid}']", 8000, 'delete'), 'Delete removes a tile')

        print('LIBRARY: a Floors section (the room type\'s own floors first), drag-out')
        await gm.evaluate("(() => { const n = [...tw.taxonomy.nodes.values()].find(n => n.level === 'room' && n.roomKey === 'common'); tw.build.restore(tw.taxonomy.pathOf(n.id)); tw.build.open(); })()")
        await wait(gm, "tw.library.shown()", 6000, 'library')
        lay = await gm.evaluate("(() => { const w = tw.worlds.get(tw.library.info().area); const labels = w.lay.labels.filter(l => l.head).map(l => l.text); return { labels, floors: Object.values(w.libView.entities).filter(e => e.place === 'tile').map(e => e.cat) }; })()")
        check('FLOORS' in lay['labels'] and len(lay['floors']) == len(cat['floors']), 'the library area has a FLOORS section (and MORE FLOORS): every floor material, as a tile', [l for l in lay['labels'] if 'FLOOR' in l])
        fcat = lay['floors'][0]
        await gm.evaluate(f"tw.library.focus('{fcat}')")
        await wait(gm, "tw.library.info().flown", 45000, 'fly')
        await gm.wait_for_timeout(800)
        a = await gm.evaluate(f"tw.library.screenOf('{fcat}')")
        await topdown(gm, -10, 10, 60)
        b = await scr(gm, C(-4), C(3))
        await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
        for i in range(1, 15):
            await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 14, a['y'] + (b['y'] - a['y']) * i / 14); await gm.wait_for_timeout(40)
        await gm.mouse.up()
        ok = await wait(gm, f"{TILES}.some(e => e.cat === '{fcat}' && e.x === {C(-4)} && e.z === {C(3)})", 8000, 'drag out')
        check(ok, 'dragging a floor out of the library lays a tile on the cell under the drop', fcat)
        for _ in range(3):
            if not await gm.evaluate("!!tw.mode || tw.build.isOpen"): break
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)

        print('RE-ROLL keeps the painted floor')
        n = await gm.evaluate(f"{TILES}.filter(e => e.room === '{rid}').length")
        await gm.evaluate(f"tw.rerollRoom(tw.entities()['{rid}'])")
        await gm.wait_for_timeout(3000)
        check(n == 12 and await gm.evaluate(f"{TILES}.filter(e => e.room === '{rid}').length") == n, 're-rolling the room keeps its painted tiles (like pinned props and edited walls)', n)

        await gm.evaluate("tw.build.close(); tw.mode && tw.modes.cancel()"); await gm.wait_for_timeout(200)
        print('POSTS: corner and jamb posts are ordinary objects; a post with no wall left goes by itself')
        P = lambda k: f"{W}.shell.has('{k}')"
        check(await gm.evaluate(P('c0:0')) and await gm.evaluate(P('c6:0')), 'the room has its corner posts', None)
        await gm.evaluate("tw.select(['wall:c6:0'])"); await gm.wait_for_timeout(300)
        st = await gm.evaluate("JSON.stringify({ ring: [...document.querySelectorAll('#ring [data-cmd]')].map(b => b.dataset.cmd), mode: tw.mode?.kind || null, open: tw.build.isOpen, hidden: document.getElementById('ring').hidden, kind: tw.selected()[0]?.kind })")
        check('"edit.rotate"' in st and '"object"' in st, 'a post can be selected (its ring appears)', st)
        await gm.evaluate("tw.registry.run('thing.pin')")
        ok = await wait(gm, "Object.values(tw.entities()).some(e => e.fromEdge === 'c6:0' && e.pinned)", 8000, 'pin post')
        check(ok, 'pinning a post makes it an ordinary (pinned) object in its place')
        await gm.evaluate("tw.select(['wall:h:0:0', 'wall:v:0:0', 'wall:h:5:0', 'wall:v:6:0']); tw.deleteSelection()")
        ok = await wait(gm, f"!{W}.shell.has('c0:0')", 8000, 'lonely post')
        check(ok, 'deleting both walls at a corner removes its post too (nothing left standing there)')
        check(await gm.evaluate("Object.values(tw.entities()).some(e => e.fromEdge === 'c6:0' && e.pinned)"), 'but a post that was pinned (edited) stays when its walls go')
        post = await gm.evaluate(f"[...{W}.shell.keys()].find(k => /^c\\d+:\\d+$/.test(k))")
        await gm.evaluate(f"tw.select(['wall:{post}']); tw.deleteSelection()")
        check(await wait(gm, f"!{W}.shell.has('{post}')", 8000, 'delete post'), 'a generated post can be deleted on its own', post)
        await topdown(gm, 15, 10, 55, 55); await gm.wait_for_timeout(1500)
        await audit(gm, 'after deleting walls')

        print('RING DRAGS: a frozen frame (resize through the centre, rotate, raise)')
        await topdown(gm, 15, 10, 70)
        oid = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place === 'floor' && !e.flat && e.dims && Math.max(...e.dims) > 2 && !e.parent).sort((a, b) => Math.hypot(a.x - 15, a.z - 10) - Math.hypot(b.x - 15, b.z - 10))[0]?.id")
        await gm.evaluate(f"tw.select(['{oid}'])"); await gm.wait_for_timeout(500)
        hb = await gm.evaluate("(() => { const r = document.querySelector('#ring [data-cmd=\"edit.resize\"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        await gm.mouse.move(hb['x'], hb['y']); await gm.mouse.down()
        await gm.mouse.move(hb['x'] + 2, hb['y'] + 6); await gm.wait_for_timeout(60)
        d = await gm.evaluate('tw.ringDrag()')
        cx, cy = d['centre']; ux, uy = d['dir']
        ui = await gm.evaluate("({ hidden: getComputedStyle(document.querySelector('#ring [data-cmd=\"edit.rotate\"]')).opacity === '0', guide: !!document.querySelector('#ring svg.guide .cross'), ro: document.querySelector('#ring .readout')?.textContent || '' })")
        ks, cs = [], []
        far = d['d0'] * 1.6
        for i in range(0, 41):  # from the handle, in through the centre and out the other side
            t = 1 - i / 20.0
            px, py = cx + ux * d['d0'] * t * 1.0, cy + uy * d['d0'] * t
            await gm.mouse.move(px, py); await gm.wait_for_timeout(15)
            r = await gm.evaluate('tw.ringDrag()'); ks.append(r['k']); cs.append(tuple(r['centre']))
        side = []
        for o in (-40, -20, 0, 20, 40):  # sideways at a fixed distance along the ray: no change
            await gm.mouse.move(cx + ux * d['d0'] * 0.6 - uy * o, cy + uy * d['d0'] * 0.6 + ux * o); await gm.wait_for_timeout(15)
            side.append((await gm.evaluate('tw.ringDrag()'))['k'])
        out = []
        for i in range(0, 30):  # out to the far extreme
            t = 0.6 + i * 0.6
            await gm.mouse.move(min(1275, max(5, cx + ux * d['d0'] * t)), min(815, max(5, cy + uy * d['d0'] * t))); await gm.wait_for_timeout(10)
            out.append((await gm.evaluate('tw.ringDrag()'))['k'])
        await gm.mouse.move(hb['x'], hb['y']); await gm.wait_for_timeout(30); await gm.mouse.up()
        inc = [b - a for a, b in zip(ks, ks[1:])]
        check(all(x <= 1e-9 for x in inc) and min(ks) >= 0.2 and ks[-1] < 0.3 and len(set(cs)) == 1, 'resize, in through the centre and beyond: the scale only ever shrinks (no flip back, no shake), eases into its 0.2× stop, and the centre never moves', f"k {ks[0]:.2f} → {min(ks):.3f}; steps up: {sum(1 for x in inc if x > 1e-9)}")
        check(max(side) - min(side) < 0.005, 'moving sideways (along a fixed distance on the handle\'s ray) changes nothing', [round(x, 4) for x in side])
        oinc = [b - a for a, b in zip(out, out[1:])]
        soft = await gm.evaluate('[tw.ringSoftK(4), tw.ringSoftK(8), tw.ringSoftK(50), tw.ringSoftK(-50)]')
        check(all(x >= -1e-9 for x in oinc) and max(out) <= 5 and out[-1] > 2.5 and 4.9 < soft[1] < soft[2] <= 5 and soft[3] >= 0.2, 'outward to the far extreme: it only grows, easing into its 5× stop (never past it, never back)', f"{out[0]:.2f} → {out[-1]:.3f} on screen; f(8) = {soft[1]:.3f}, f(50) = {soft[2]:.4f}")
        check(ui['hidden'] and ui['guide'] and '%' in ui['ro'] and 'ft' in ui['ro'], 'during the drag the other buttons step aside; a centre crosshair, a guide line and a live % · ft readout show', ui)
        # rotate: the centre stays frozen while the handle circles
        await gm.wait_for_timeout(400)
        rb = await gm.evaluate("(() => { const r = document.querySelector('#ring [data-cmd=\"edit.rotate\"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        await gm.mouse.move(rb['x'], rb['y']); await gm.mouse.down(); await gm.mouse.move(rb['x'] + 5, rb['y'] + 5); await gm.wait_for_timeout(40)
        d = await gm.evaluate('tw.ringDrag()'); cx, cy = d['centre']; import math
        R0 = math.hypot(rb['x'] - cx, rb['y'] - cy); a0 = math.atan2(rb['x'] - cx, -(rb['y'] - cy)); rc, ds = [], []
        for i in range(1, 25):
            a = a0 + i * math.pi / 24
            await gm.mouse.move(cx + R0 * math.sin(a), cy - R0 * math.cos(a)); await gm.wait_for_timeout(15)
            r = await gm.evaluate('tw.ringDrag()'); rc.append(tuple(r['centre'])); ds.append(r['delta'])
        await gm.mouse.move(rb['x'], rb['y']); await gm.mouse.up()
        dd = [b - a for a, b in zip(ds, ds[1:])]
        check(len(set(rc)) == 1 and all(x < 0 for x in dd) and abs(ds[-1] + math.pi) < 0.2, 'rotate: the frame is frozen too (same centre throughout); the turn follows the pointer smoothly to 180°', f"{math.degrees(-ds[-1]):.0f}°")
        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:')) and not (A.local and 'Failed to load resource' in e)]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser tiles: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate()
        except Exception: pass
sys.exit(0 if ok else 1)
