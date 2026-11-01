#!/usr/bin/env python3
"""Caves in the game (2026-10-25). Harry, after the caves pilot: "looks a lot more like a cave. Add a few pillars,
stalagmites and such, and let's push it into the game!" docs/VERTICAL.md "Caves".

What this drives, in a real browser, as the GM would:
  the tool    the Cave from the bar at the ground level goes down to lv -1; a drag there makes a cave at y = -10 whose
              jagged outline is stored (the squares it was given are what every seat draws)
  the rock    its outside walls draw no wall pieces and no posts; the rock chunks, corner columns, rubble and pillars
              are drawn (all their meshes load); the cave floor picture is its floor; no tile on a pillar
  stalagmites (2026-10-27) THINGS of the room, made with it at the rule's spots (none drawn as rock); one undo takes the
              cave and them; a click picks one, a drag moves it, Delete deletes it; the bar offers "stalagmite"; a pawn
              put down on one stands on the floor; an old cave (no things) still draws its own, and a re-roll converts it
  pawns       measured on the drawn meshes, as the pilot did: no rock vertex below head height inside a floor square,
              and how many edge squares a 5-ft round base would touch rock in
  the lid     at lv -1 the ground is cut along the cave's lip (open over every floor square, solid a step outside the
              lip), and the chunks' tops come up through it; at the ground level the cave is not drawn and the ground is whole
  blocking    sight: the cave's outline and its pillars block (vision.js); a pawn dragged onto a pillar square is not on
              the cave's floor there
  fog         a player with a pawn in one cave: that cave's rock shows, a second cave nobody has seen shows nothing
  re-roll     a new seed moves the rock and keeps the shape; the cave's own stalagmites follow, the one the GM moved stays
  sync        a player's tab works out the same rock
  phone       a phone-sized player tab draws the cave with no errors
  errors      no page errors

  local:  python3 engine/test/browser_caves.py --local [--shots DIR]
  live:   ... browser_caves.py --page https://dev.turnipworks.net/
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18501,18801').split(','))
POST = '' if A.shots else '&nopost'
def start_local():
    data = tempfile.mkdtemp(prefix='tw-caves-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)  # (the page is this checkout's, not a stale server's: test/served.py)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + f'&api={POST}&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def view(pg, x, z, dist=70, pitch=62, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(300)
async def bar_text(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(450)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def mdrag(pg, a, b, steps=12):
    await pg.mouse.move(a['x'], a['y']); await pg.wait_for_timeout(120); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(25)
    await pg.mouse.up(); await pg.wait_for_timeout(400)
async def settle(pg, ms=60000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over'); await pg.wait_for_timeout(250)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
W = "tw.worldOf(tw.area())"
PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' # (browser_phone.py's)
CVJS = "await import(new URL('../core/caves.js', document.baseURI).href)"
VJS = "await import(new URL('vision.js', document.baseURI).href)"
# the cave's shell pieces: how many of each, how many have their real mesh, and the room's other wall pieces and posts
PIECES = """(rid) => { const w = tw.worldOf(tw.area()), out = { roles: {}, loaded: 0, cave: 0, kitWalls: 0, posts: 0, visible: 0, tops: 0, topsUp: 0 };
  for (const s of w.shell.values()) { if (s.roomId !== rid) continue;
    if (s.spec.gen === 'cave') { out.cave++; out.roles[s.spec.cave] = (out.roles[s.spec.cave] || 0) + 1; if (s.visual && !s.visual.userData?.placeholder && s.visual.isObject3D && s.spec.layer !== 'stand') out.loaded += s.ready ? 0 : 0; if (s.group.visible) out.visible++; continue; }
    if (s.spec.layer === 'walls') { if (s.spec.wallDir === 'c' || /post|corner/.test(s.spec.id || '')) out.posts++; else out.kitWalls++; } }
  return out; }"""
LOADED = """(rid) => [...tw.worldOf(tw.area()).shell.values()].filter(s => s.roomId === rid && s.spec.gen === 'cave').every(s => s.settled)"""
# the pilot's clearance measure, on the drawn meshes: every rock vertex between 0.15 and 6.5 ft over the floor tested
# against the floor squares; how far inside a square, and which edge squares a 5-ft round base would touch rock in
CLEAR = """async (rid) => { const CV = """ + CVJS + """; const THREE = await import('three'); const w = tw.worldOf(tw.area()), E = tw.entities(), C = CV.caveOf(E, E[rid]), y0 = C.y, v = new THREE.Vector3();
  const cells = C.cells, edge = new Map();
  for (const key of cells) { const [i, j] = key.split(',').map(Number); const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([a, b]) => !cells.has(`${i + a},${j + b}`)); if (sides.length) edge.set(key, { sides, deep: 0, base: false }); }
  let maxIn = 0, tested = 0, inside = 0, why = [];
  for (const s of w.shell.values()) { if (s.roomId !== rid || s.spec.gen !== 'cave' || s.spec.cave === 'stalagmite' || s.spec.cave === 'back') continue;
    s.group.updateMatrixWorld(true);
    s.group.traverse(o => { if (!o.isMesh || o.userData.placeholder) return; const pos = o.geometry.attributes.position;
      for (let q = 0; q < pos.count; q += 2) { v.fromBufferAttribute(pos, q).applyMatrix4(o.matrixWorld); tested++;
        if (v.y < y0 + 0.15 || v.y > y0 + 6.5) continue;
        const i = Math.floor(v.x / 5), j = Math.floor(v.z / 5), k = `${i},${j}`, c = edge.get(k);
        if (!c) { if (cells.has(k)) { inside++; maxIn = 5; if (why.length < 4) why.push([s.spec.cave, s.spec.id, +v.x.toFixed(1), +v.z.toFixed(1)]); } continue; }
        let d = Infinity; for (const [a, b] of c.sides) d = Math.min(d, a === -1 ? v.x - i * 5 : a === 1 ? (i + 1) * 5 - v.x : b === -1 ? v.z - j * 5 : (j + 1) * 5 - v.z);
        if (d > c.deep) c.deep = d; if (d > maxIn) { maxIn = d; if (d > 0.1 && why.length < 4) why.push([s.spec.cave, s.spec.id, +d.toFixed(2)]); }
        if (Math.hypot(v.x - (i + 0.5) * 5, v.z - (j + 0.5) * 5) < 2.5) c.base = true; } }); }
  const list = [...edge.values()];
  return { edge_cells: list.length, max_into_room_ft: +maxIn.toFixed(2), over_line: list.filter(c => c.deep > 0.1).length, base_touches: list.filter(c => c.base).length, tested, inside, why }; }"""
# the ground's triangles under a few points (a vertical ray down onto the ground mesh)
GROUNDAT = """async (pts) => { const THREE = await import('three'); const w = tw.worldOf(tw.area()), rc = new THREE.Raycaster(); w.ground.updateMatrixWorld(true);
  return pts.map(([x, z]) => { rc.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0)); return rc.intersectObject(w.ground, false).length > 0; }); }"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + f'faces=1500{POST}'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, vp=None, mobile=False):
            ctx = await browser.new_context(viewport=vp or {'width': 1280, 'height': 820}, **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2, 'user_agent': PHONE_UA} if mobile else {})); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' or 'cave piece failed' in m.text else None)
            await pg.goto(url); return pg
        async def shot(pg, name):
            if not A.shots: return
            await settle(pg); await pg.wait_for_timeout(2500); await pg.screenshot(path=os.path.join(A.shots, f'{name}.png'), timeout=180000); print(f'    shot {name}.png')
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST caves ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        await gm.evaluate("tw.dispatch('area.ground', { cat: 'floor-grass' })"); await gm.wait_for_timeout(600)

        print('THE TOOL: "cave" from the bar, at the ground level')
        check(await gm.evaluate("tw.level") == 0, 'the level is the ground to start with')
        await bar_text(gm, 'cave'); top = await gm.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 3).map(el => el.dataset.ref || '')")
        check(any('build.cave' in (t or '') for t in top), 'the bar offers the Cave for "cave" (in its first three)', top)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await gm.evaluate("tw.registry.run('build.cave')"); await gm.wait_for_timeout(500)
        check(await gm.evaluate("tw.level") == -10 and await gm.evaluate("tw.mode?.kind === 'room' && tw.mode.type === 'cave'"), 'the Cave tool went down to lv -1 (y -10) and is live', await gm.evaluate("[tw.level, tw.mode?.type]"))
        await view(gm, 20, 15, 95, 66, 0, -10)
        await mdrag(gm, await scr(gm, 2.5, 2.5, -10), await scr(gm, 42.5, 27.5, -10), 14)
        ok = await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room' && e.recipe.type === 'cave') && tw.sync.pendingCount() === 0", 15000, 'the cave')
        R = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.type === 'cave')")
        RID = R['id'] if R else ''
        check(ok and R and R['recipe'].get('y') == -10, 'a cave is made at y -10 (lv -1)', R and R['recipe'])
        check(R and R['recipe'].get('outline') and len(R['recipe']['outline']) > 4 and (await gm.evaluate('tw.lastCave'))['jagged'], 'its jagged outline is stored on the room (worked out once, at creation)', R and len(R['recipe'].get('outline') or []))
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await settle(gm)
        rule = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const FP = await import(new URL('../core/footprint.js', document.baseURI).href); const E = tw.entities(), r = E['{RID}'], C = CV.caveOf(E, r); return {{ cells: C.cells.size, pillars: C.pillarCells.length, stored: FP.cellsOf(r.recipe).length, placements: C.placements.length }}; }})()")
        check(rule['cells'] + rule['pillars'] == rule['stored'] and rule['pillars'] >= 1, 'the rock is worked out from the stored squares (floor + pillars = the outline)', rule)

        print('THE ROCK: drawn, all its meshes in')
        check(await wait(gm, f"({LOADED})('{RID}')", 90000, 'cave pieces settled'), 'every cave piece has settled')
        pc = await gm.evaluate(f"({PIECES})('{RID}')")
        check(pc['kitWalls'] == 0 and pc['posts'] == 0, 'its outside walls draw no wall pieces and no posts', pc)
        check(pc['roles'].get('wall', 0) >= 15 and pc['roles'].get('pillar', 0) >= 1 and pc['roles'].get('back') == 1 and (pc['roles'].get('corner-in', 0) + pc['roles'].get('corner-out', 0)) >= 4, 'chunks, corner columns, rubble, pillars and the rock face behind are drawn', pc['roles'])
        check(pc['roles'].get('stalagmite', 0) == 0, 'no stalagmite is drawn as rock (they are things of the room)', pc['roles'])
        real = await gm.evaluate(f"(rid) => {{ let n = 0, ph = 0; for (const s of tw.worldOf(tw.area()).shell.values()) {{ if (s.roomId !== rid || s.spec.gen !== 'cave') continue; let mesh = false; s.visual?.traverse?.(o => {{ if (o.isMesh && !o.userData.placeholder) mesh = true; }}); if (mesh && !s.visual.userData?.placeholder) n++; else ph++; }} return {{ n, ph }}; }}", RID)
        check(real['ph'] == 0, 'every cave piece wears its real mesh (no stand-in box left)', real)
        fl = await gm.evaluate(f"(rid) => [...tw.worldOf(tw.area()).shell.values()].filter(s => s.roomId === rid && s.spec.layer === 'floor' && s.spec.sku).map(s => [s.spec.sku, Math.floor(s.spec.x / 5), Math.floor(s.spec.z / 5)])", RID)
        pill = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(); return CV.caveOf(E, E['{RID}']).pillarCells; }})()")
        check(fl and all(f[0].startswith('floor-cave-rock') for f in fl), 'its floor is the cave floor picture (floor-cave-rock)', sorted({f[0] for f in fl}))
        check(not [f for f in fl if [f[1], f[2]] in pill], 'no floor tile on a pillar square (it is rock)', pill)
        cl = await gm.evaluate(f"({CLEAR})('{RID}')")
        check(cl['inside'] == 0 and cl['max_into_room_ft'] <= 0.05, 'pawns: no rock vertex below head height inside a floor square (the pilot\'s measure)', cl)
        check(cl['base_touches'] == 0, 'pawns: a 5-ft round base on an edge square touches no rock', [cl['base_touches'], cl['edge_cells']])

        print('STALAGMITES ARE THINGS (2026-10-27, Harry: "is there a reason they are not objects?")')
        sg = await gm.evaluate(f"""(async () => {{ const CV = {CVJS}; const E = tw.entities(), r = E['{RID}'], rule = CV.caveStalagmites(E, r), w = {W};
          const things = Object.values(E).filter(e => e.kind === 'object' && e.room === '{RID}' && e.cat === 'stalagmite');
          const at = rule.filter(p => things.some(o => Math.abs(o.x - p.x) < 1e-6 && Math.abs(o.z - p.z) < 1e-6 && Math.abs(o.rot - p.rot) < 1e-6 && Math.abs(o.dims[1] - p.h) < 0.01));
          const drawn = things.filter(o => {{ const rec = w.recs.get(o.id); let mesh = false; rec?.group?.traverse(x => {{ if (x.isMesh && !x.userData.placeholder) mesh = true; }}); return mesh && rec.group.visible; }}).length;
          return {{ mark: !!r.recipe.stalagObjects, rule: rule.length, things: things.length, at: at.length, own: things.filter(o => o.fromCave).length, drawn, ids: things.map(o => o.id) }}; }})()""")
        check(sg['mark'] and sg['rule'] >= 4 and sg['things'] == sg['rule'] and sg['at'] == sg['rule'] and sg['own'] == sg['rule'], "a new cave makes its stalagmites as things of the room, one at each of the rule's spots (place, turn, height)", {k: v for k, v in sg.items() if k != 'ids'})
        await wait(gm, f"(ids => ids.every(id => {W}.recs.get(id)?.settled))({json.dumps(sg['ids'])})", 60000, 'stalagmite meshes in')
        sg2 = await gm.evaluate(f"(ids => ids.filter(id => {{ const r = {W}.recs.get(id); let m = false; r?.group?.traverse(x => {{ if (x.isMesh && !x.userData.placeholder) m = true; }}); return m && r.group.visible; }}).length)({json.dumps(sg['ids'])})")
        check(sg2 == sg['things'], 'every stalagmite is drawn with its real mesh', [sg2, sg['things']])
        # ONE UNDO: a cave of its own, drawn and undone
        RIDU = await gm.evaluate("tw.spawnRoom('cave', -30, 0, 6, 5, 777, undefined, -10)"); await wait(gm, f"!!tw.entities()['{RIDU}'] && tw.sync.pendingCount() === 0", 8000)
        nu = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{RIDU}' && e.cat === 'stalagmite').length")
        await gm.evaluate("tw.undo()"); await wait(gm, f"!tw.entities()['{RIDU}'] && tw.sync.pendingCount() === 0", 8000, 'undo')
        left = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{RIDU}').length")
        check(nu > 0 and left == 0 and not await gm.evaluate(f"!!tw.entities()['{RIDU}']"), 'one undo takes away the cave and all its stalagmites', [nu, left])
        # PICK, MOVE, DELETE, with the mouse and the keyboard, as the GM would: looking straight down on the most open one
        pick = await gm.evaluate(f"""(async () => {{ const CV = {CVJS}; const E = tw.entities(), C = CV.caveOf(E, E['{RID}']); const things = {json.dumps(sg['ids'])}.map(id => E[id]);
          const room = (o) => Math.min(...C.placements.filter(p => p.role !== 'stalagmite').map(p => Math.hypot(p.x - o.x, p.z - o.z)));
          return things.sort((a, b) => room(b) - room(a)).slice(0, 3).map(o => ({{ id: o.id, x: o.x, z: o.z, h: o.dims[1] }})); }})()""")
        picked = None
        for c in pick:
            await view(gm, c['x'], c['z'], 34, 86, 0, -10); await gm.wait_for_timeout(500)
            pt = await scr(gm, c['x'], c['z'], -10 + c['h'] * 0.55)
            await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(400)
            if await gm.evaluate(f"tw.sel.size === 1 && tw.sel.has('{c['id']}')"): picked = c; break
            await gm.keyboard.press('Escape')
        check(picked, 'a click on a stalagmite selects it (the thing, not the cave)', [pick[:1], await gm.evaluate("[...tw.sel]")])
        if picked:
            cx, cz = await gm.evaluate(f"(() => {{ const r = tw.entities()['{RID}'].recipe; return [(r.x + r.w / 2) * 5, (r.z + r.d / 2) * 5]; }})()")
            dx, dz = cx - picked['x'], cz - picked['z']; m = max(1e-6, (dx * dx + dz * dz) ** 0.5); dx, dz = dx / m * 2.5, dz / m * 2.5 # (toward the cave's middle: dropped on the rock outside a floor square it would leave the room)
            a = await scr(gm, picked['x'], picked['z'], -10 + picked['h'] * 0.55); b = await scr(gm, picked['x'] + dx, picked['z'] + dz, -10 + picked['h'] * 0.55)
            await mdrag(gm, a, b, 14); await wait(gm, 'tw.sync.pendingCount() === 0', 6000)
            mv = await gm.evaluate(f"tw.entities()['{picked['id']}']")
            check(mv and (abs(mv['x'] - picked['x']) > 1 or abs(mv['z'] - picked['z']) > 1) and not mv.get('fromCave') and mv['room'] == RID, 'a drag moves it (it is the GM\'s now: no longer the cave\'s own)', mv and [round(mv['x'] - picked['x'], 2), round(mv['z'] - picked['z'], 2), mv.get('fromCave'), mv['room']])
            MOVED = picked['id']
            dl = next(i for i in sg['ids'] if i != MOVED)
            await gm.evaluate(f"tw.select(['{dl}'])"); await gm.keyboard.press('Delete'); await wait(gm, f"!tw.entities()['{dl}'] && tw.sync.pendingCount() === 0", 6000, 'deleted')
            check(not await gm.evaluate(f"!!tw.entities()['{dl}']") and not await gm.evaluate(f"!!{W}.recs.get('{dl}')"), 'Delete deletes a stalagmite', dl)
        else: MOVED = None
        await bar_text(gm, 'stalagmite'); res = await gm.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 6).map(el => el.dataset.ref || '')")
        check(any('cat:stalagmite' in (t or '') for t in res), 'the bar offers the library\'s stalagmite, to put more down', res)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        S0 = await gm.evaluate(f"tw.entities()['{sg['ids'][-1]}']")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_cvstal001', name: 'Tam', x: {S0['x']}, z: {S0['z']}, y: -10, color: '#d46a6a' }})"); await wait(gm, f"!!{W}.pawnBaseInfo('tok_cvstal001')?.room", 6000, 'pawn on the stalagmite')
        bs = await gm.evaluate(f"{W}.pawnBaseInfo('tok_cvstal001')")
        check(bs and abs(bs['baseY'] + 10) < 0.05 and bs['room'] == RID, 'a pawn put down on a stalagmite stands on the cave floor (not on top of it)', bs)
        await gm.evaluate("tw.dispatch('token.delete', { id: 'tok_cvstal001' })")
        # AN OLD CAVE (made before 2026-10-27: no things, no mark), as an old client sent it
        OLD = await gm.evaluate("""(() => { const id = 'room_oldcave01'; tw.batch([{ type: 'room.spawn', args: { id, building: 'bld_oldcave01', buildingName: 'Old', type: 'cave', x: -30, z: 12, w: 6, d: 5, y: -10, seed: 4141, floor: 'floor-cave-rock', engine: 'v2', layout: { hash: 'old', summary: '', objects: [] } } }]); return id; })()""")
        await wait(gm, f"!!tw.entities()['{OLD}'] && tw.sync.pendingCount() === 0", 8000); await wait(gm, f"({LOADED})('{OLD}')", 60000, 'old cave settled')
        oc = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(); return {{ rule: CV.caveStalagmites(E, E['{OLD}']).length, shells: [...{W}.shell.values()].filter(s => s.roomId === '{OLD}' && s.spec.cave === 'stalagmite').length, things: Object.values(E).filter(e => e.kind === 'object' && e.room === '{OLD}').length, mark: !!E['{OLD}'].recipe.stalagObjects }}; }})()")
        check(oc['rule'] > 0 and oc['shells'] == oc['rule'] and oc['things'] == 0 and not oc['mark'], 'an old cave (no stalagmite things yet) still draws every stalagmite of its rule', oc)
        await gm.evaluate(f"tw.rerollRoom(tw.entities()['{OLD}'])"); await wait(gm, 'tw.sync.pendingCount() === 0', 6000); await gm.wait_for_timeout(600)
        oc2 = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(); return {{ rule: CV.caveStalagmites(E, E['{OLD}']).length, shells: [...{W}.shell.values()].filter(s => s.roomId === '{OLD}' && s.spec.cave === 'stalagmite').length, things: Object.values(E).filter(e => e.kind === 'object' && e.room === '{OLD}' && e.cat === 'stalagmite').length, mark: !!E['{OLD}'].recipe.stalagObjects }}; }})()")
        check(oc2['mark'] and oc2['things'] == oc2['rule'] and oc2['shells'] == 0, "a re-roll converts it: its stalagmites are things, none drawn as rock (on load the relay converts the rest: caves.test)", oc2)

        print('THE LID: the ground over the cave at lv -1, and at the ground level')
        lid = await gm.evaluate(f"""(async () => {{ const CV = {CVJS}; const FPm = await import(new URL('../core/footprint.js', document.baseURI).href); const E = tw.entities(), C = CV.caveOf(E, E['{RID}']); const L = C.lipLoops; const inside = (x, z) => {{ let c = false; for (const P of L) for (let a = 0, b = P.length - 1; a < P.length; b = a++) {{ const [xa, za] = P[a], [xb, zb] = P[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; }} return c; }};
          const floor = [...C.cells].map(k => k.split(',').map(Number)).map(([i, j]) => [(i + 0.5) * 5, (j + 0.5) * 5]);
          const out = []; for (const P of L) for (let k = 0; k < P.length; k += 7) {{ const [x, z] = P[k], [x2, z2] = P[(k + 1) % P.length], nx = z2 - z, nz = -(x2 - x), m = Math.hypot(nx, nz) || 1; for (const s of [1, -1]) {{ const q = [x + s * nx / m * 1.2, z + s * nz / m * 1.2]; if (!inside(...q)) {{ out.push(q); break; }} }} }}
          const tops = []; for (const s of tw.worldOf(tw.area()).shell.values()) if (s.roomId === '{RID}' && s.spec.cave === 'wall') {{ s.group.updateMatrixWorld(true); const b = new (await import('three')).Box3().setFromObject(s.group); tops.push(+b.max.y.toFixed(2)); }}
          const room = E['{RID}'].recipe, inRoom = out.map(([x, z]) => FPm.hasCell(room, Math.floor(x / 5), Math.floor(z / 5)));
          return {{ floor, out, tops, inRoom }}; }})()""")
        hitsIn, hitsOut = await gm.evaluate(GROUNDAT, lid['floor']), await gm.evaluate(GROUNDAT, lid['out'])
        check(not any(hitsIn), 'at lv -1 the ground is open over every floor square', sum(hitsIn))
        miss = [q for q, h, inRoom in zip(lid['out'], hitsOut, lid['inRoom']) if not h and not inRoom] # (a probe over one of the cave's own squares, at a corner the lip cuts close, is open by design)
        if miss: hitsOut2 = await gm.evaluate(GROUNDAT, [[x + 0.013, z + 0.017] for x, z in miss]); miss = [q for q, h in zip(miss, hitsOut2) if not h] # (a ray down exactly on a shared triangle edge can slip through: nudge once)
        check(len(hitsOut) >= 10 and not miss, 'and solid just outside the lip (it covers the rock beyond)', [len(hitsOut), miss[:4]])
        up = [t for t in lid['tops'] if t > 0]
        check(len(up) >= len(lid['tops']) * 0.6, "most wall chunks' tops come up through the ground's cut edge (the rim)", [len(up), len(lid['tops']), sorted(lid['tops'])[:3]])
        await view(gm, 22, 16, 95, 62, 0, -10); await shot(gm, 'cave-table')
        await view(gm, 22, 16, 55, 50, -35, -10); await shot(gm, 'cave-low')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(800)
        hid = await gm.evaluate(f"(rid) => {{ const w = tw.worldOf(tw.area()); w.cutPass?.(); return [...w.shell.values()].filter(s => s.roomId === rid && s.spec.gen === 'cave' && s.group.visible).length; }}", RID)
        whole = await gm.evaluate(GROUNDAT, lid['floor'][:6])
        check(hid == 0 and all(whole), 'at the ground level the cave is not drawn and the ground over it is whole', [hid, whole])
        await gm.evaluate("tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(800)

        print('BLOCKING: sight, and a pillar square')
        bl = await gm.evaluate(f"""(async () => {{ const CV = {CVJS}; const V = {VJS}; const E = tw.entities(), w = {W}, C = CV.caveOf(E, E['{RID}']); const segs = V.blockingSegments(w.edges, E, -10); const [pi, pj] = C.pillarCells[0];
          const has = (x0, z0, x1, z1) => segs.some(s => (Math.abs(s[0] - x0) < 1e-6 && Math.abs(s[2] - x1) < 1e-6 && Math.min(s[1], s[3]) <= Math.min(z0, z1) + 1e-6 && Math.max(s[1], s[3]) >= Math.max(z0, z1) - 1e-6) || (Math.abs(s[1] - z0) < 1e-6 && Math.abs(s[3] - z1) < 1e-6 && Math.min(s[0], s[2]) <= Math.min(x0, x1) + 1e-6 && Math.max(s[0], s[2]) >= Math.max(x0, x1) - 1e-6));
          const outer = [...w.edges.values()].filter(e => e.owner?.room === '{RID}' && (e.sides || []).length === 1); const caveRock = outer.filter(e => e.caveRock).length;
          return {{ pillar: segs.filter(s => Math.abs(Math.hypot(s[0] - (pi + 0.5) * 5, s[1] - (pj + 0.5) * 5) - CV.PILLAR_SIGHT_R) < 1e-3).length >= 6, outline: outer.length, caveRock, kinds: [...new Set(outer.map(e => e.kind))], cell: [pi, pj] }}; }})()""")
        check(bl['pillar'], "a pillar stops sight (its octagon, inside its rock: vision.js)", bl)
        check(bl['outline'] > 10 and bl['caveRock'] == bl['outline'] and bl['kinds'] == ['wall'], "the cave's outline is walls for sight (drawn as rock, not pieces)", bl)
        pi, pj = bl['cell']
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_cvpawn001', name: 'Bram', x: {(pi - 1) * 5 + 2.5}, z: {pj * 5 + 2.5}, y: -10, color: '#e8d46a' }})"); await wait(gm, "!!tw.entities()['tok_cvpawn001']", 6000)
        await wait(gm, f"!!{W}.pawnBaseInfo('tok_cvpawn001')?.room", 6000, 'the pawn\'s base worked out')
        b = await gm.evaluate(f"{W}.pawnBaseInfo('tok_cvpawn001')")
        core = await gm.evaluate(f"(async () => {{ const H = await import(new URL('../core/height.js', document.baseURI).href); const CV = {CVJS}; const E = tw.entities(); return {{ under: H.baseUnder(E, {(pi - 1) * 5 + 2.5}, {pj * 5 + 2.5}, -10).room || null, pillar: CV.onPillar(E, {pi * 5 + 2.5}, {pj * 5 + 2.5}, -10)?.id || null, beside: CV.onPillar(E, {(pi - 1) * 5 + 2.5}, {pj * 5 + 2.5}, -10)?.id || null }}; }})()")
        check(b and b['room'] == RID and abs(b['baseY'] + 10) < 0.05 and core['under'] == RID, 'a pawn put down beside the pillar stands on the cave floor at -10', [b, core])
        check(core['pillar'] == RID and core['beside'] is None, 'the square under the pillar is a pillar square (onPillar); the one beside it is floor', core)

        print('FOG: a player with a pawn in the cave; a second cave nobody has seen')
        RID2 = await gm.evaluate("tw.spawnRoom('cave', 30, -20, 6, 5, 4242, undefined, -10)")
        await wait(gm, f"!!tw.entities()['{RID2}'] && tw.sync.pendingCount() === 0", 8000)
        await wait(gm, f"({LOADED})('{RID2}')", 60000, 'second cave settled')
        link = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#67aadd' }))")
        pl = None
        if '#s=' in link:
            pl = await tab(link)
            await wait(pl, 'window.tw && tw.ready && tw.ready() && tw.fog', 90000, 'player ready')
            me = await pl.evaluate('tw.me()')
            await gm.evaluate(f"tw.dispatch('token.owner', {{ id: 'tok_cvpawn001', owner: '{me}' }})")
            await wait(pl, f"tw.entities()['tok_cvpawn001']?.owner === '{me}'", 8000, 'pawn given')
            await pl.evaluate("tw.goLevel(-10, 'test')"); await view(pl, 30, 5, 120, 62, 0, -10); await pl.wait_for_timeout(3000)
            await wait(pl, f"!!tw.entities()['{RID2}'] && ({LOADED})('{RID}')", 60000, 'player has the caves')
            fog = await pl.evaluate(f"""(() => {{ const w = {W}; w.cutPass?.(); const S = [...w.shell.values()].filter(s => s.spec.gen === 'cave' && s.spec.layer === 'walls'); const a = S.filter(s => s.roomId === '{RID}'), b = S.filter(s => s.roomId === '{RID2}');
              const px = {(pi - 1) * 5 + 2.5}, pz = {pj * 5 + 2.5}, near = a.filter(s => s.spec.fogAt.every(([x, z]) => tw.fog.visible(x, z, -10))); // (rock all of whose floor beside it is in sight right now)
              return {{ fogActive: !!w.fogActive, mine: a.filter(s => s.group.visible).length, mineAll: a.length, near: near.filter(s => s.group.visible).length, nearAll: near.length,
                shownUnknown: a.filter(s => s.group.visible && !s.spec.fogAt.some(([x, z]) => tw.fog.explored(x, z, -10))).length, other: b.filter(s => s.group.visible).length, otherAll: b.length, seesPawnSq: tw.fog.visible({(pi - 1) * 5 + 2.5}, {pj * 5 + 2.5}, -10), behindPillar: tw.fog.visible({(pi + 1) * 5 + 2.5}, {pj * 5 + 2.5}, -10) }}; }})()""")
            check(fog['fogActive'] and fog['seesPawnSq'], "fog of war is on in the player's tab and the pawn's own square is seen", fog)
            check(fog['mine'] >= 10 and fog['near'] == fog['nearAll'] and fog['nearAll'] >= 3 and fog['other'] == 0 and fog['otherAll'] > 10, "the rock the pawn sees shows (every piece whose floor is in sight); the unseen cave's rock does not", fog)
            check(fog['shownUnknown'] == 0 and fog['mine'] < fog['mineAll'], 'no rock shows beside floor nobody has seen (the far side of the pillars and the bends stays hidden)', fog)
            check(not fog['behindPillar'], 'the square just behind the pillar is not seen', fog)
            fs = await pl.evaluate(f"(() => {{ const w = {W}, E = tw.entities(); w.cutPass?.(); const st = Object.values(E).filter(e => e.kind === 'object' && e.room === '{RID2}' && e.cat === 'stalagmite'); return {{ n: st.length, shown: st.filter(o => w.recs.get(o.id)?.group.visible).length }}; }})()")
            check(fs['n'] > 0 and fs['shown'] == 0, "the unseen cave's stalagmites are not drawn for the player either", fs)
            got = await pl.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(); return JSON.stringify(CV.caveOf(E, E['{RID}']).placements.map(p => [p.role, +p.x.toFixed(3), +p.z.toFixed(3)])); }})()")
            want = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(); return JSON.stringify(CV.caveOf(E, E['{RID}']).placements.map(p => [p.role, +p.x.toFixed(3), +p.z.toFixed(3)])); }})()")
            check(got == want, "sync: a player's tab works out the same rock, piece for piece", len(json.loads(want)))
        else: check(False, 'an invite link for a player', 'no API found')

        print('RE-ROLL: a new seed, the same shape')
        before = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(); return {{ o: JSON.stringify(E['{RID}'].recipe.outline), p: JSON.stringify(CV.caveOf(E, E['{RID}']).placements.slice(0, 8).map(p => [p.x, p.z])) }}; }})()")
        await gm.evaluate(f"tw.rerollRoom(tw.entities()['{RID}'])"); await wait(gm, 'tw.sync.pendingCount() === 0', 6000); await gm.wait_for_timeout(600)
        after = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(); return {{ o: JSON.stringify(E['{RID}'].recipe.outline), p: JSON.stringify(CV.caveOf(E, E['{RID}']).placements.slice(0, 8).map(p => [p.x, p.z])) }}; }})()")
        await wait(gm, f"({LOADED})('{RID}')", 60000, 're-rolled cave settled')
        drawn = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(), C = CV.caveOf(E, E['{RID}']); const S = [...tw.worldOf(tw.area()).shell.values()].filter(s => s.roomId === '{RID}' && s.spec.gen === 'cave' && s.spec.cave !== 'back'); const want = C.placements.filter(p => p.role !== 'stalagmite').map(p => `${{p.role}}:${{p.x.toFixed(2)}}:${{p.z.toFixed(2)}}`).sort().join('|'), got = S.map(s => `${{s.spec.cave}}:${{s.spec.x.toFixed(2)}}:${{s.spec.z.toFixed(2)}}`).sort().join('|'); return {{ same: want === got, want: C.placements.length, got: S.length }}; }})()")
        check(drawn['same'], "a re-roll redraws the rock: the drawn pieces are the new seed's, piece for piece", drawn)
        check(after['o'] == before['o'] and after['p'] != before['p'], 'a re-roll moves the rock and keeps the outline', [after['o'] == before['o'], after['p'] != before['p']])
        rr = await gm.evaluate(f"(async () => {{ const CV = {CVJS}; const E = tw.entities(), rule = CV.caveStalagmites(E, E['{RID}']), own = Object.values(E).filter(e => e.kind === 'object' && e.room === '{RID}' && e.cat === 'stalagmite' && e.fromCave); return {{ own: own.length, onRule: own.filter(o => rule.some(p => p.x === o.x && p.z === o.z)).length, old: own.filter(o => {json.dumps(sg['ids'])}.includes(o.id)).length, moved: !!E['{MOVED}'] }}; }})()")
        check(rr['own'] > 0 and rr['onRule'] == rr['own'] and rr['old'] == 0, "a re-roll: the cave's own stalagmites follow (all new, at the new seed's spots)", rr)
        check(MOVED and rr['moved'], 'a re-roll: the stalagmite the GM moved stays', rr)
        await wait(gm, f"({LOADED})('{RID}')", 60000, 're-rolled cave settled')
        cl2 = await gm.evaluate(f"({CLEAR})('{RID}')")
        check(cl2['inside'] == 0 and cl2['max_into_room_ft'] <= 0.05 and cl2['base_touches'] == 0, 'pawns, after the re-roll (another seed): no rock in a floor square, no base touches rock', cl2)

        print('UNDER A HILL (2026-10-27): a cave under a hill changes nothing of it; at lv -1 the hill is see-through over it')
        RID3 = await gm.evaluate("tw.spawnRoom('cave', 20, 10, 5, 4, 5151, undefined, -10)"); await wait(gm, f"!!tw.entities()['{RID3}'] && tw.sync.pendingCount() === 0", 8000)
        HID3 = await gm.evaluate("tw.spawnRoom('hill', 18, 8, 9, 8, 77, undefined, 10)"); await wait(gm, f"!!tw.entities()['{HID3}'] && tw.sync.pendingCount() === 0", 8000)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_cvhill001', name: 'Hob', x: 127.5, z: 42.5, y: 10, color: '#9ad46a' })"); await wait(gm, "!!tw.entities()['tok_cvhill001'] && tw.sync.pendingCount() === 0", 6000)
        await wait(gm, f"({LOADED})('{RID3}')", 60000, 'cave under the hill settled'); await settle(gm)
        UNDER = """async ([cid, hid]) => { const w = tw.worldOf(tw.area()), E = tw.entities(), FP = await import(new URL('../core/footprint.js', document.baseURI).href); await w.terrain.ready; w.cutPass?.();
          const r = E[cid].recipe, cells = FP.cellsOf(r).map(([i, j]) => [r.x + i, r.z + j]), C = new Set(cells.map(c => c.join(':')));
          let tiles = 0, tilesAll = 0; for (const s of w.shell.values()) if (s.roomId === hid && s.spec.layer === 'floor') { tilesAll++; if (s.group.visible && C.has(Math.floor(s.spec.x / 5) + ':' + Math.floor(s.spec.z / 5))) tiles++; }
          const bank = Math.max(...cells.flatMap(([gx, gz]) => [[1, 1], [2.5, 2.5], [4, 4], [1, 4], [4, 1]].map(([a, b]) => w.terrainField.heightAt(gx * 5 + a, gz * 5 + b))));
          const [gx, gz] = cells[Math.floor(cells.length / 2)], fp = w.floorPoint({ origin: { x: gx * 5 + 2.5, y: 200, z: gz * 5 + 2.5 }, direction: { x: 0, y: -1, z: 0 } }, { max: tw.floorMax() }); // (straight down over the cave's middle square: a slanted ray meets the hill's top beside the shaft first, as it should)
          const op = []; for (const s of w.shell.values()) if (s.roomId === hid && s.spec.layer === 'floor') s.visual?.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) op.push(m.transparent ? m.opacity : 1); }); w.terrain.group.traverse(o => { if (o.userData.terrainBank) op.push(o.material.transparent ? o.material.opacity : 1); });
          return { see: w.hillSeeNow(), maxOp: +Math.max(...op).toFixed(3), group: w.terrain.group.visible, tiles, tilesAll, bank: +bank.toFixed(3), open: cells.filter(c => w.groundOpenCells.has(c.join(':'))).length, cells: cells.length, point: fp && { y: fp.y, room: fp.room }, pawn: w.cutHides(E['tok_cvhill001']), drawn: !!w.recs.get('tok_cvhill001')?.group.visible, info: w.terrain.info() }; }"""
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(900)
        u0 = await gm.evaluate(UNDER, [RID3, HID3])
        await gm.evaluate("tw.goLevel(-10, 'test')"); await view(gm, 112, 60, 80, 66, 0, -5); await gm.wait_for_timeout(900)
        u = await gm.evaluate(UNDER, [RID3, HID3])
        check(u['tiles'] > 0 and u['tilesAll'] > 40 and u['see'] == 0.25 and u['maxOp'] <= 0.25 + 1e-6 and u['group'], "lv -1: the hill's top is drawn whole over the cave's squares too, see-through (0.25)", u)
        check(u['bank'] == u0['bank'] and u['bank'] > 9.9 and u['open'] == u['cells'], 'lv -1: the hill keeps its shape over the cave (no crater: 10 ft as at lv 1), and the ground is open over the cave as ever', [u['bank'], u0['bank'], u['open'], u['cells']])
        check(u['point'] and u['point']['room'] == RID3 and u['point']['y'] == -10, 'lv -1: the pointer over it goes down to the cave floor, not the hilltop', u['point'])
        check(u['pawn'] and not u['drawn'], 'lv -1: a pawn on the hilltop is not drawn (below the ground, what stands on the earth is not, hill or open ground)', u)
        check(u['info']['triangles'] == u0['info']['triangles'] and u['info']['rocks'] == u0['info']['rocks'] and u['info']['bushes'] == u0['info']['bushes'], 'the bank and its dressing are the same at lv -1 as at lv 1', [u['info'], u0['info']])
        await shot(gm, 'cave-under-hill')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(900)
        u1 = await gm.evaluate(UNDER, [RID3, HID3])
        check(u1['tiles'] > 0 and u1['bank'] > 9.9 and not u1['pawn'] and u1['drawn'] and u1['maxOp'] == 1, 'lv 1: the hill is solid over the cave again, and the pawn on it is drawn', u1)
        await gm.evaluate("tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(500)

        print('PHONE: a phone-sized player tab')
        if '#s=' in link:
            # the player now picks up a phone: the desktop tab of the same seat is closed first (one device per seat, as a
            # player would; and one renderer less in this browser), and the phone is a phone (browser_phone.py's agent)
            if pl: await pl.context.close(); pl = None
            ph = await tab(link, {'width': 390, 'height': 844}, mobile=True)
            okp = await wait(ph, 'window.tw && tw.ready && tw.ready()', 180000, 'phone ready')
            if not okp:
                diag = await ph.evaluate("({ url: location.href.slice(0, 80), tw: !!window.tw, ready: !!window.tw?.ready, hand: document.documentElement.classList.contains('tw-hand'), phonePage: !!document.getElementById('phone'), banner: !!document.getElementById('phoneBanner'), start: !!document.querySelector('#newCampaign:not([hidden])'), text: document.body.innerText.slice(0, 200) })")
                print('    phone page when not ready:', diag)
            if okp:
                await ph.evaluate("tw.goLevel(-10, 'test')"); await ph.wait_for_timeout(1500)
                okp = await wait(ph, f"!!tw.entities()['{RID}'] && [...tw.worldOf(tw.area()).shell.values()].some(s => s.spec.gen === 'cave' && s.settled)", 60000, 'phone draws the cave')
            check(okp, 'a phone-sized tab loads the campaign and draws the cave', okp)
            if A.shots and okp: await ph.screenshot(path=os.path.join(A.shots, 'cave-phone.png')); print('    shot cave-phone.png')

        print('COPY: a whole cave, with its stalagmites')
        cp = await gm.evaluate(f"""(async () => {{ tw.goLevel(-10, 'test'); tw.select(['{RID}']); const t = tw.copy(); if (!t) return null; const before = new Set(Object.keys(tw.entities())); tw.pasteData(tw.clip, [-60, 60]); await new Promise(r => setTimeout(r, 1500));
          const E = tw.entities(), nr = Object.values(E).find(e => e.kind === 'room' && !before.has(e.id) && e.recipe.type === 'cave'); if (!nr) return {{ none: true }};
          const own = (rid) => Object.values(E).filter(e => e.kind === 'object' && e.room === rid && e.cat === 'stalagmite').length;
          return {{ mark: !!nr.recipe.stalagObjects, src: own('{RID}'), copy: own(nr.id), id: nr.id, y: nr.recipe.y || 0 }}; }})()""")
        await wait(gm, 'tw.sync.pendingCount() === 0', 6000)
        shells = await gm.evaluate(f"(rid => [...{W}.shell.values()].filter(s => s.roomId === rid && s.spec.cave === 'stalagmite').length)('{cp and cp.get('id')}')") if cp and cp.get('id') else -1
        check(cp and cp.get('mark') and cp['copy'] == cp['src'] and cp['src'] > 0 and shells == 0, "a copied cave brings its stalagmites as things (marked: none drawn twice)", [cp, shells])

        print('ERRORS')
        bad = [x for x in errors if 'favicon' not in x and 'ERR_' not in x and '404' not in x]
        check(not bad, 'no page errors', bad[:5])
        await browser.close()
    for pr in procs: pr.terminate()
    n_ok = sum(1 for r in results if r[0]); print(f'\nbrowser_caves: {n_ok}/{len(results)} passed')
    sys.exit(0 if n_ok == len(results) else 1)

asyncio.run(main())
