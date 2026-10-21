#!/usr/bin/env python3
"""Storeys (docs/VERTICAL.md, 2026-10-05): a GM tab and a player tab. Later stages add their sections to this file.

  local:  python3 engine/test/browser_storeys.py --local [--gpu]
  live:   ... browser_storeys.py --page https://turnipworks.net/ --relay https://turnipworks.net/api/tw-relay

  STAGE A  HEIGHT   a ground room, a room on top of it (y = 10) and a cellar under it (y = -10), made through the one
                    command door: each is DRAWN at its height (floor, walls, posts, furniture); the upper room stands
                    on a floor slab; the player tab holds the same things at the same heights; a hidden upper room is
                    not in the player's world at all; a pawn's height travels; the "everything on screen is touchable"
                    invariant still holds; a flat inn beside it is exactly as before (no piece off the ground)
The test campaign is named "TEST storeys <time> (throwaway)". Screenshots land in engine/test/shots/storeys-*.png.
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from audit import AUDIT
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--relay'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--gpu', action='store_true'); ap.add_argument('--only')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
RP, SP = 18112, 18739
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-storeys-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500&nointro', f'http://127.0.0.1:{RP}'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=60000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over')
    await pg.wait_for_timeout(250)

# a room at a height through the one door (what the build mode will send): solved here, dispatched as room.spawn
SPAWN = """(a) => { const v = tw.sync.view(tw.area()), id = a.id, H = a.y || 0;
  const L = tw.roomgen.solve(v.entities, a, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return id; }"""
# what is drawn for a room: the heights of its shell pieces by layer, and of its things
DRAWN = """(rid) => { const w = tw.worldOf(tw.area()), out = { floor: [], walls: [], slab: 0, things: [], keys: [] };
  for (const s of w.shell.values()) { if (s.roomId !== rid) continue; const y = +s.group.position.y.toFixed(2);
    if (s.spec.slab) { out.slab++; out.slabY = y; continue; }
    (s.spec.layer === 'floor' ? out.floor : out.walls).push(y); if (s.group.userData.edgeKey) out.keys.push(s.group.userData.edgeKey); }
  for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.room === rid) out.things.push(+r.group.position.y.toFixed(2));
  const mm = (a) => a.length ? [Math.min(...a), Math.max(...a)] : null;
  return { floor: mm(out.floor), walls: mm(out.walls), nWalls: out.walls.length, slab: out.slab, slabY: out.slabY, things: mm(out.things), nThings: out.things.length, keys: out.keys }; }"""

async def mdrag(pg, a, b, steps=12, peek=None):
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(25)
    out = await peek() if peek else None
    await pg.mouse.up(); await pg.wait_for_timeout(300); return out
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")

async def stage_b(gm, pl):
    """STAGE B  BUILD   the level control, the room tool on an upper level (valid squares, jetty, posts, the clip at three
    squares out), furniture upstairs, things and pawns dragged onto another floor, a cellar with the ground opened, undo"""
    print('STAGE B, BUILD: the level being built on; drawing an upper room; supports; a cellar')
    X0 = 40  # cells: clear ground east of the Stage A rooms
    await gm.evaluate("tw.select([])")
    G = await gm.evaluate(f"tw.spawnRoom('common', {X0}, 0, 6, 4, 5101)")
    await wait(gm, f"tw.entities()['{G}'] && tw.sync.pendingCount() === 0", 20000, 'ground room'); await settle(gm)
    await view(gm, X0 * 5 + 22, 10, 95, 62)
    flat0 = await gm.evaluate("JSON.stringify([tw.level, !!tw.worldOf(tw.area()).levelGrid, !!tw.worldOf(tw.area()).groundOpen])")
    check(flat0 == '[0,false,false]', 'by default the level is the ground: no ghost grid, the ground whole', flat0)
    await gm.keyboard.press(']'); await gm.wait_for_timeout(200)
    check(await gm.evaluate("JSON.stringify([tw.level, tw.cut.y, !!tw.worldOf(tw.area()).levelGrid])") == '[10,19,false]', 'ONE level (Harry 2026-10-06): ] goes up to lv 2 with or without a build tool, built or not; no ghost grid until a tool is picked')
    await gm.evaluate("tw.modes.roomTool('guest', { tool: true })"); await gm.wait_for_timeout(350)
    I = await gm.evaluate("(() => { const I = tw.levelInfo(), w = tw.worldOf(tw.area()); return { ...I, grid: w.levelGrid?.userData.y ?? null, valid: w.cellMarks?.get('level-valid')?.info || null, here: tw.modes.validCells().filter(c => c[0] >= 36).length }; })()")
    check(I['y'] == 10 and I['label'] == 'lv 2' and I['grid'] == 10 and I['valid'] and I['here'] == 80 and I['valid']['lit'] >= 80 and I['valid']['y'] == 10, 'picking the room tool on lv 2 (10 ft) builds THERE, with no level control in the tray: a ghost grid at that height, the valid squares lit (the room below plus two squares out all round = 80)', str({k: I[k] for k in ('y', 'label', 'isNew', 'grid', 'valid', 'here')}))
    await gm.keyboard.press('b'); await gm.wait_for_timeout(500)
    tray = await gm.evaluate("(() => { const m = document.getElementById('buildMenu'); return { open: !m.hidden, stepper: !!m.querySelector('.blv, [data-lv]'), text: m.innerText }; })()")
    check(tray['open'] and not tray['stepper'] and 'Level:' not in tray['text'] and 'Drag a room on the map' not in tray['text'], 'the Build tray has no level stepper and no "Drag a room on the map" line', tray['text'][-160:])
    await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
    if not await gm.evaluate("tw.mode?.kind === 'room'"): await gm.evaluate("tw.modes.roomTool('guest', { tool: true })")
    await gm.keyboard.press(']'); await gm.wait_for_timeout(250); up = await gm.evaluate("tw.level")
    await gm.keyboard.press('['); await gm.wait_for_timeout(250)
    check(up == 20 and await gm.evaluate("tw.level") == 10, '] goes on up to lv 3 (a level is a place to build, built or not) and [ comes back')
    await gm.screenshot(path=os.path.join(SHOTS, 'storeys-b-valid-squares.png'))
    # drag from the room's first square to three squares out to the east: 9 x 4 asked, 8 x 4 can be carried
    a, b = await scr(gm, X0 * 5 + 2.5, 2.5, 10), await scr(gm, (X0 + 8) * 5 + 2.5, 17.5, 10)
    async def peek(): return await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return { marks: w.cellMarks.get('room-tool')?.info, plan: tw.mode.plan && { kind: tw.mode.plan.kind, lit: tw.mode.plan.lit.length, dim: tw.mode.plan.dim.length }, label: document.getElementById('modeLabel').textContent }; })()")
    mid = await mdrag(gm, a, b, peek=peek)
    check(mid['plan'] and mid['plan']['lit'] == 32 and mid['plan']['dim'] == 4 and mid['marks']['y'] == 10 and mid['marks']['lit'] == 32, 'while dragging at lv 2: the 32 squares that can be carried light up at 10 ft; the 4 that are three squares out get the red mark', str(mid))
    ok = await wait(gm, f"Object.values(tw.entities()).some(e => e.kind === 'room' && e.recipe.y === 10 && e.recipe.x === {X0}) && tw.sync.pendingCount() === 0", 20000, 'upper room')
    U = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.y === 10 && e.recipe.x === {X0})")
    check(ok and U and U['recipe']['w'] == 8 and U['recipe']['d'] == 4 and U['building'] == (await gm.evaluate(f"tw.entities()['{G}'].building")), 'the room is made at 10 ft, 8 x 4 squares (clipped to what can be carried), in the building it stands on', str(U and U['recipe']))
    await settle(gm)
    th = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{U['id']}').map(e => e.y)")
    check(len(th) > 3 and min(th) >= 10 and max(th) < 19.5, 'its furniture is solved for it and stands at its height (10 ft and up)', f'{len(th)} things, y {min(th) if th else None} to {max(th) if th else None}')
    await gm.wait_for_timeout(1500)
    sup = await gm.evaluate("tw.worldOf(tw.area()).supports()")
    br = [x for x in sup if x['kind'] == 'bracket']; po = [x for x in sup if x['kind'] == 'post']
    check(len(br) == 4 and all(abs(x['y'] + x['h'] - 9) < 0.01 and abs(x['x'] - ((X0 + 6) * 5 + 0.5 + 1.1)) < 1.2 for x in br), 'one square out is a jetty: a bracket under it against the wall below, one per 5 ft (4)', f"{len(br)} brackets, id {br[0]['id'] if br else None}, stand-in {br[0]['standIn'] if br else None}")
    check(len(po) == 3 and all(x['y'] == 0 and abs(x['h'] - 9) < 0.01 and 0 <= (X0 + 8) * 5 - x['x'] < 1.3 for x in po), 'two squares out gets posts from the ground to the slab: the outer corners and every 10 ft (3), standing just in from the slab\'s edge', f"{len(po)} posts, id {po[0]['id'] if po else None}, stand-in {po[0]['standIn'] if po else None}")
    # THE KIT'S OWN PIECES, MEASURED where they stand (2026-10-06: the vertical kit landed): a bracket's top under the slab,
    # its wall leg at the wall's outer face and on the wall side, reaching out under the overhang; a post a foot or so
    # square (the older post-timber mesh has arms and stood 5 ft across), from the ground to the slab
    await wait(gm, "tw.worldOf(tw.area()).kitReport().filter(k => k.kind === 'support').every(k => k.loaded)", 30000, 'support meshes')
    kr = [k for k in await gm.evaluate("tw.worldOf(tw.area()).kitReport()") if k['kind'] == 'support']
    kb = [k for k in kr if k['role'] == 'bracket']; kp = [k for k in kr if k['role'] == 'post']
    wall = (X0 + 6) * 5 + 0.5  # the outer face of the wall the jetty oversails (it runs along z at this x)
    okb = kb and all(not k['standIn'] and k['sku'] and abs(k['max'][1] - 9) < 0.2 and abs(k['min'][0] - wall) < 0.2 and k['max'][0] - k['min'][0] > 1.8 and k['max'][2] - k['min'][2] < 1.3 and k['lowAt'][0] < -0.2 for k in kb)
    check(okb, 'the brackets are the kit\'s piece: top within 0.2 ft of the slab\'s underside, back on the wall\'s outer face, the leg on the wall side, reaching out 2 ft or more, no wider than a joist', str([(k['sku'], k['min'], k['max'], k['lowAt']) for k in kb[:2]]))
    okp = kp and all(not k['standIn'] and k['sku'] and abs(k['min'][1]) < 0.2 and abs(k['max'][1] - 9) < 0.2 and 1.2 < k['max'][0] - k['min'][0] < 2.6 and 1.2 < k['max'][2] - k['min'][2] < 2.6 and k['max'][0] <= (X0 + 8) * 5 + 0.55 for k in kp)
    check(okp, 'the posts are the kit\'s straight post at its own proportions (2026-10-06: not squeezed to a foot): ground to slab, 1.2 to 2.6 ft across, no further out than the wall above', str([(k['sku'], k['min'], k['max']) for k in kp[:2]]))
    await wait(pl, f"tw.entities()['{U['id']}']", 10000, 'player has the upper room'); await settle(pl); await pl.wait_for_timeout(800)
    check(len(await pl.evaluate("tw.worldOf(tw.area()).supports()")) == len(sup), 'the player tab draws the same supports (they are derived from the rooms)')
    await gm.evaluate("tw.modes.cancel()"); await gm.wait_for_timeout(200)
    await gm.screenshot(path=os.path.join(SHOTS, 'storeys-b-jetty.png'))
    au = await gm.evaluate(AUDIT)
    check(au['tested'] > 100 and au['nbad'] == 0, 'touchable audit with an upper storey, brackets and posts (each as itself)', f"{au['tested']} points, {au['nbad']} untouchable or not selectable as themselves {json.dumps(au['bad'][:4]) if au['nbad'] else ''}")
    # a thing and a pawn dragged from the ground onto the upper floor take its height (and the thing its room)
    await gm.evaluate(f"(() => {{ const sz = tw.roomgen.sizeOf('crate'); tw.dispatch('object.place', {{ id: 'obj_tstcrate01', x: {X0 * 5 + 15}, z: 32, cat: 'crate', ...sz }}); tw.dispatch('token.create', {{ id: 'tok_tstup0001', name: 'Mira', x: {X0 * 5 + 25}, z: 32 }}); }})()")
    await wait(gm, "tw.entities().obj_tstcrate01 && tw.entities().tok_tstup0001 && tw.sync.pendingCount() === 0", 8000, 'crate and pawn'); await gm.wait_for_timeout(1500)
    for id, tx, what in (('obj_tstcrate01', X0 * 5 + 12, 'a thing'), ('tok_tstup0001', X0 * 5 + 20, 'a pawn')):
        e = await gm.evaluate(f"tw.entities()['{id}']")
        await mdrag(gm, await scr(gm, e['x'], e['z'], 1.0), await scr(gm, tx, 16, 10))
        await wait(gm, f"(tw.entities()['{id}'].y || 0) === 10 && tw.sync.pendingCount() === 0", 6000, f'{what} upstairs')
        n = await gm.evaluate(f"(() => {{ const e = tw.entities()['{id}']; return {{ y: e.y || 0, room: e.room || null, x: e.x, z: e.z, drawn: tw.worldOf(tw.area()).recs.get('{id}').group.position.y, drop: tw.lastDrop }}; }})()")
        check(n['y'] == 10 and abs(n['x'] - tx) <= 2.5 and abs(n['z'] - 16) <= 2.5 and (n['room'] == U['id'] if not id.startswith('tok') else (n['x'] % 5 == 2.5 and n['z'] % 5 == 2.5)), f'{what} dragged from the ground onto the upper floor lands there at 10 ft' + ('' if id.startswith('tok') else ', and is that room\'s'), str(n))
    await wait(pl, "(tw.entities().tok_tstup0001?.y || 0) === 10", 6000)
    check(await pl.evaluate("tw.worldOf(tw.area()).recs.get('tok_tstup0001').group.position.y") == 10, 'the player tab sees the pawn upstairs')
    await gm.keyboard.press('Control+z'); await wait(gm, "(tw.entities().tok_tstup0001.y || 0) === 0", 6000, 'undo')
    check(await gm.evaluate("tw.entities().tok_tstup0001.y || 0") == 0, 'undo brings the pawn back down')
    # a raised thing upstairs lands on the upper floor, not at height 0
    await gm.evaluate("tw.liftTo(tw.entities().obj_tstcrate01, 14)"); await wait(gm, "tw.entities().obj_tstcrate01.y === 14", 5000)
    await gm.evaluate("tw.liftTo(tw.entities().obj_tstcrate01, 10.02)"); await wait(gm, "Math.abs(tw.entities().obj_tstcrate01.y - 10) < 0.1", 5000)  # (10 ft, or a rug's thickness above it when the room's seed put a rug there)
    check(abs(await gm.evaluate("tw.entities().obj_tstcrate01.y") - 10) < 0.1, 'upstairs, a thing raised 4 ft hangs at 14 ft; lowered to the floor it stands on the upper floor (10 ft), not on the ground')
    # the same while something in the area is hidden from players (the GM's "Hidden" pill is a sprite: a raycast that
    # meets it without a camera throws, and the raise was then never sent)
    await gm.evaluate(f"(() => {{ const sz = tw.roomgen.sizeOf('crate'); tw.dispatch('object.place', {{ id: 'obj_tsthid001', x: {X0 * 5 + 12}, y: 10, z: 14, cat: 'crate', ...sz }}); }})()")
    await wait(gm, "tw.entities().obj_tsthid001 && tw.sync.pendingCount() === 0", 6000); await gm.evaluate("tw.dispatch('entity.flag', { ids: ['obj_tsthid001'], hidden: true })")
    await wait(gm, "tw.entities().obj_tsthid001.hidden && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(1200)
    thrown = await gm.evaluate("(() => { try { tw.liftTo(tw.entities().obj_tstcrate01, 13); return null; } catch (e) { return String(e); } })()")
    okh = await wait(gm, "tw.entities().obj_tstcrate01.y > 11.4", 5000, 'raised with a hidden thing about')  # (13 ft, or resting on something hung there when the room's random seed hangs a lamp over that spot)
    await gm.evaluate("tw.liftTo(tw.entities().obj_tstcrate01, 10.01)"); okh2 = await wait(gm, "Math.abs(tw.entities().obj_tstcrate01.y - 10) < 0.1", 5000)
    check(not thrown and okh and okh2, 'raising a thing upstairs works while another thing beside it is hidden from players', thrown or '')
    await gm.evaluate("tw.dispatch('object.delete', { id: 'obj_tsthid001' })"); await gm.wait_for_timeout(300)
    # a cellar: down two levels with the room tool, the ground opens, draw it beside the inn
    await gm.evaluate("tw.select([])")  # (with a pawn selected, [ and ] are its HP keys)
    await gm.evaluate("tw.modes.roomTool('cellar', { tool: true })"); await gm.wait_for_timeout(150)
    await gm.keyboard.press('['); await gm.wait_for_timeout(200); await gm.keyboard.press('['); await gm.wait_for_timeout(350)
    I = await gm.evaluate("({ ...tw.levelInfo(), open: !!tw.worldOf(tw.area()).groundOpen })")
    check(I['y'] == -10 and I['label'] == 'lv -1' and I['open'], 'the room tool steps below the ground: lv -1 (-10 ft)', str({k: I[k] for k in ('y', 'label', 'isNew', 'open')}))
    await mdrag(gm, await scr(gm, X0 * 5 + 2.5, 27.5, -10), await scr(gm, (X0 + 2) * 5 + 2.5, 37.5, -10))
    ok = await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room' && e.recipe.y === -10 && e.recipe.type === 'cellar' && e.recipe.z === 5) && tw.sync.pendingCount() === 0", 20000, 'cellar')
    C = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.y === -10 && e.recipe.z === 5)")
    await settle(gm); await gm.wait_for_timeout(600)
    tri = await gm.evaluate("tw.worldOf(tw.area()).ground.geometry.attributes.position.count / 3")
    hole = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), r = new tw.THREE.Raycaster(new tw.THREE.Vector3({X0 * 5 + 7}, 30, 33), new tw.THREE.Vector3(0, -1, 0)); return {{ overCellar: r.intersectObject(w.ground).length, beside: (r.set(new tw.THREE.Vector3({X0 * 5 - 20}, 30, 33), new tw.THREE.Vector3(0, -1, 0)), r.intersectObject(w.ground).length) }}; }})()") if await gm.evaluate("!!tw.THREE") else None
    check(ok and C and C['recipe']['w'] == 3 and C['recipe']['d'] == 3 and tri > 2 and (hole is None or (hole['overCellar'] == 0 and hole['beside'] == 1)), 'a cellar drawn at lv -1: made at -10 ft, and the ground is open over it (and whole beside it)', f"{C and C['recipe']} · ground triangles {tri} · {hole}")
    await gm.evaluate("tw.modes.cancel()"); await view(gm, X0 * 5 + 8, 32, 50, 70); await gm.wait_for_timeout(500)
    await gm.screenshot(path=os.path.join(SHOTS, 'storeys-b-cellar.png'))
    au = await gm.evaluate(AUDIT)
    check(au['tested'] > 60 and au['nbad'] == 0, 'touchable audit looking down into the cellar', f"{au['tested']} points, {au['nbad']} untouchable {json.dumps(au['bad'][:4]) if au['nbad'] else ''}")
    # (Stage D: the cellar came with a stair, its own command: the first undo takes the stair, the second the cellar)
    if await gm.evaluate("!!(tw.lastStair && tw.entities()[tw.lastStair])"):
        await gm.keyboard.press('Control+z'); await wait(gm, "!tw.entities()[tw.lastStair] && tw.sync.pendingCount() === 0", 8000, 'undo cellar stair')
    await gm.keyboard.press('Control+z'); await wait(gm, f"!tw.entities()['{C['id']}']", 8000, 'undo cellar')
    await gm.wait_for_timeout(400)
    check(not await gm.evaluate(f"!!tw.entities()['{C['id']}']") and not await gm.evaluate("(tw.worldOf(tw.area()).groundKey || '').split(',').some(k => +k.split(':')[0] >= 36)"), 'undo takes the cellar away and the ground closes over where it was')
    # (since Stage C the ground is opened by the CUT, over every below-ground room it shows; stepping down pinned it at lv -1)
    await gm.evaluate("tw.cutOff('test'); tw.setLevel(0)"); await gm.wait_for_timeout(200)
    check(await gm.evaluate("JSON.stringify([tw.level, !!tw.worldOf(tw.area()).levelGrid, !!tw.worldOf(tw.area()).groundOpen])") == '[0,false,false]', 'back on the ground: no ghost grid, the ground whole')
    # undo of the upper room takes its supports with it
    await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{U['id']}' }})"); await wait(gm, f"!tw.entities()['{U['id']}']", 8000); await gm.wait_for_timeout(1500)
    check(len(await gm.evaluate("tw.worldOf(tw.area()).supports()")) == 0, 'deleting the upper room takes its brackets and posts with it')
    await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{U['id']}']", 8000); await gm.wait_for_timeout(1500)
    check(len(await gm.evaluate("tw.worldOf(tw.area()).supports()")) == 7, 'and undo brings room, brackets and posts back')
    await view(gm, X0 * 5 + 22, 10, 80, 50, 35); await settle(gm); await gm.wait_for_timeout(2500)
    await gm.screenshot(path=os.path.join(SHOTS, 'storeys-b-inn-table.png'))

async def main():
    if A.local: page, relay = start_local()
    else: page, relay = A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500&nointro', (A.relay or A.page.rstrip('/') + '/api/tw-relay').rstrip('/')
    os.makedirs(SHOTS, exist_ok=True)
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if A.gpu or os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820})
            if os.environ.get('TW_SLOW_ASSETS'):  # every mesh arrives late (ms), as on a slow line: stand-ins and placeholders stay up longer
                async def _slow(route): await asyncio.sleep(int(os.environ['TW_SLOW_ASSETS']) / 1000); await route.continue_()
                await ctx.route('**/*.glb', _slow)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' and 'status of 404' not in m.text else None)  # (a local run has no version.json and no icons: 404s are not errors of the game)
            await pg.goto(url); return pg
        gm = await tab(page)
        NAME = f"TEST storeys {time.strftime('%m-%d %H:%M:%S')} (throwaway)"
        await gm.fill('#newCampaign input[name=name]', NAME); await gm.fill('#newCampaign input[name=gm]', 'Fauna-test'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live', f"{NAME} · engine {await gm.evaluate('tw.roomgen.version')}")
        ptok = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Brakka', color: '#5aa9e6' })")
        pl = await tab(page.split('#')[0].replace('nopost', 'nofx') + f'#s={ptok}')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 40000), 'player tab live')

        print('STAGE A, HEIGHT: rooms at three heights, drawn at their heights')
        await view(gm, 30, 20, 120)
        FLAT = await gm.evaluate("tw.spawnRoom('storeroom', 14, 0, 4, 3, 4203)")  # a flat room beside it, made the old way
        B = 'bld_teststorey'
        G = await gm.evaluate(SPAWN, {'id': 'room_tstg00001', 'building': B, 'buildingName': 'Two-storey inn', 'type': 'common', 'x': 0, 'z': 0, 'w': 6, 'd': 4, 'seed': 4201}); await gm.wait_for_timeout(300)
        U = await gm.evaluate(SPAWN, {'id': 'room_tstu00001', 'building': B, 'type': 'guest', 'x': 0, 'z': 0, 'w': 4, 'd': 4, 'y': 10, 'seed': 4202}); await gm.wait_for_timeout(300)
        D = await gm.evaluate(SPAWN, {'id': 'room_tstd00001', 'building': B, 'type': 'cellar', 'x': 0, 'z': 0, 'w': 4, 'd': 4, 'y': -10, 'seed': 4204})
        ids = [FLAT, G, U, D]
        ok = await wait(gm, f"{json.dumps(ids)}.every(id => tw.entities()[id]) && tw.sync.pendingCount() === 0", 30000, 'rooms')
        await wait(pl, f"{json.dumps(ids)}.every(id => tw.entities()[id])", 30000, 'player has the rooms')
        await settle(gm); await settle(pl)
        check(ok and not await gm.evaluate("(tw.lastNack || null)"), 'three rooms on one footprint at y = 0, 10 and -10, and a flat room beside them: all accepted by the relay')
        dg, du, dd, df = [await gm.evaluate(DRAWN, r) for r in (G, U, D, FLAT)]
        near = lambda a, lo, hi: a and lo - 0.05 <= a[0] and a[1] <= hi + 0.05
        check(near(dg['floor'], 0, 0.1) and near(dg['walls'], 0, 0.1) and dg['slab'] == 0 and near(df['floor'], 0, 0.1) and near(df['walls'], 0, 0.1) and all('@' not in k for k in dg['keys'] + df['keys']), 'the ground rooms are drawn exactly on the ground, with plain wall keys and no slab', f"{dg} {df['floor']}")
        check(near(du['floor'], 10, 10.1) and near(du['walls'], 10, 10.1) and du['nWalls'] > 8 and du['slab'] == 1 and abs(du['slabY'] - 9) < 0.01 and near(du['things'], 10, 19.5) and du['nThings'] > 1 and all(k.endswith('@10') for k in du['keys']), 'the upper room is drawn at 10 ft: floor, walls and posts (keys @10), its furniture, on a one-foot slab', str({k: du[k] for k in ('floor', 'walls', 'nWalls', 'slabY', 'things', 'nThings')}))
        check(near(dd['floor'], -10, -9.9) and near(dd['walls'], -10, -9.9) and dd['slab'] == 0 and near(dd['things'], -10, -0.5) and all(k.endswith('@-10') for k in dd['keys']), 'the cellar is drawn at -10 ft', str({k: dd[k] for k in ('floor', 'walls', 'things')}))
        pu = await pl.evaluate(DRAWN, U)
        check(pu['floor'] == du['floor'] and pu['nWalls'] == du['nWalls'] and pu['things'] == du['things'], 'the player tab draws the upper room at the same heights', str(pu['floor']))
        await gm.screenshot(path=os.path.join(SHOTS, 'storeys-a-three-heights.png'))
        # walls: an upper storey has no outside door
        doors = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return [...w.edges.values()].filter(e => e.y === 10 && e.kind === 'door' && e.sides.length === 1).length; }})()")
        check(doors == 0, 'no outside door upstairs', doors)
        # a pawn's height travels; nothing stores its floor
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_tstclimb01', name: 'Climber', x: 7, z: 7, y: 10 })")
        okp = await wait(pl, "tw.entities().tok_tstclimb01 && tw.worldOf(tw.area()).recs.get('tok_tstclimb01')?.group.position.y === 10", 8000, 'pawn at height on the player tab')
        check(okp and await pl.evaluate("Object.keys(tw.entities().tok_tstclimb01).every(k => !/floor|storey|level/.test(k))"), 'a pawn made at y = 10 stands at 10 ft on both tabs; it stores a height, never a floor')
        # hide the upper room: the player's world loses all of it
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U}'], hidden: true }})")
        okh = await wait(pl, f"!tw.entities()['{U}'] && !Object.values(tw.entities()).some(e => e.room === '{U}')", 8000, 'upper room gone for the player')
        await pl.wait_for_timeout(600)
        left = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return [...w.shell.values()].filter(s => s.roomId === '{U}' || (s.group.position.y > 5 && s.group.visible)).length; }})()")
        check(okh and left == 0, 'a hidden upper room: the player receives nothing of it and draws nothing above the ground floor', f'{left} pieces left')
        gh = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return [...w.shell.values()].filter(s => s.roomId === '{U}').every(s => s.hidden) && [...w.shell.values()].some(s => s.roomId === '{U}'); }})()")
        check(gh, 'the GM still sees it, in the hidden treatment')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U}'], hidden: false }})")
        check(await wait(pl, f"tw.entities()['{U}']", 8000, 'revealed'), 'revealing brings it back')
        await settle(gm); await settle(pl)
        print('TOUCHABLE: everything on screen is touchable, with rooms at three heights')
        for (x, z, dist, name) in ((30, 12, 120, 'whole'), (10, 10, 60, 'upper room')):
            await view(gm, x, z, dist); await gm.wait_for_timeout(500)
            au = await gm.evaluate(AUDIT)
            check(au['tested'] > 100 and au['nbad'] == 0, f'touchable audit ({name})', f"{au['tested']} points, {au['nbad']} untouchable {json.dumps(au['bad'][:4]) if au['nbad'] else ''}")
        if not A.only or A.only == 'b': await stage_b(gm, pl)
        check(not errors, 'no page errors', '; '.join(errors[:4]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"\nstoreys: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
