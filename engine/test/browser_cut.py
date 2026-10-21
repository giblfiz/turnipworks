#!/usr/bin/env python3
"""The cut (storeys, Stage C; docs/VERTICAL.md "What you see: the cut height", docs/UI.md "The cut"). GM tab + player tab.

  local:  TW_GPU=1 python3 engine/test/browser_cut.py --local
  shots:  ... browser_cut.py --local --shots     (full look; screenshots for a Gemini blind read in engine/test/shots/cut-*.png)

A two-storey inn with a cellar: ground floor (common room + kitchen), two rooms upstairs, a cellar under the common room.
  RULE       what is drawn at each cut (off, lv 2, lv 1, lv -1): rooms whole or not at all, things with their room, loose
             things and pawns by their own height, the ground opened only below 0
  CONTROLS   double-click a room / a label / open ground; floor up / down pin; a double-click overrides the pin
  UNASKED    the view never changes floor by itself: moving, raising, selecting, zooming, panning, another seat building,
             a pawn changing floor, a reload: the cut is what it was (app.cutLog shows who wrote it)
  CLICKS     at each cut, a dense grid of picks and 200 real clicks never reach anything on a hidden level; the
             "everything on screen is touchable" audit holds per visible level
  FLOORS     a floor that is drawn stops the pointer (Harry 2026-10-06: "on floor two I can still select things on floor
             one directly thru the actual floor"): click, hover, double-click, ping point, drag and the selection box
             on lv 2 never reach what is under its floor; what shows beside the floor or through a stair's hole is
             still reached; the closed ground over a cellar and a roof stop it the same way     (--floors: only this)
  INDICATOR  always visible, truthful in every state, clear of the Build tray, the PiP and the command bar; after reload
  OFFERS     "Cut to lv N": the owner only; the GM only for the last pawn the GM moved; one at a time; replaced; fades.
             Roofs: no button when zoomed out (removed 2026-10-06); the top of the level meter; zooming changes nothing
  LAMPS      lamps of rooms that are not visible are off
  SECRETS    a player with a hidden upper room sees no trace of it at any cut, and the level list does not name it
"""
import argparse, asyncio, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from audit import AUDIT  # noqa: E402
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--floors', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmpdirs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18093,18718').split(','))  # TW_PORTS=18103,18728 when another worktree is running this suite
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-cut-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('' if full else '&faces=1500')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")

SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
# the cut, who wrote it last, and what is drawn
STATE = "(() => ({ cut: tw.cut.y, pinned: tw.cut.pinned, writes: tw.cutLog.length, last: tw.cutLog.at(-1)?.by || null, level: tw.level }))()"
REPORT = "(() => { const w = tw.worldOf(tw.area()), r = w.cutReport(); const shown = (id) => !!r.rooms[id] && r.rooms[id].shown > 0 && r.rooms[id].hidden === 0, gone = (id) => !!r.rooms[id] && r.rooms[id].shown === 0; return { cut: r.cut, shown: Object.keys(r.rooms).filter(shown), gone: Object.keys(r.rooms).filter(gone), mixed: Object.keys(r.rooms).filter(id => !shown(id) && !gone(id)), thingsHidden: r.things.hidden, groundOpen: r.groundOpen, lit: r.lit, covered: r.covered }; })()"
# every grid point's pick: does anything a click would select, or the floor it would land on, sit on a level the cut hides?
PICKS = """(() => { const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(), bad = []; let n = 0, hit = 0;
  for (let i = 0; i < 64; i++) for (let j = 0; j < 40; j++) { const x = c.left + (i + 0.5) * c.width / 64, y = c.top + (j + 0.5) * c.height / 40, ray = tw.rayAt(x, y); n++;
    for (const h of w.pickAll(ray)) { hit++; const e = h.wall ? tw.ent('wall:' + h.wall) : h.entity; if (e && tw.cutHides(e)) bad.push([Math.round(x), Math.round(y), e.id || h.wall]); }
    const g = tw.groundAt(x, y); if (g && g.room && g.y > (tw.cut.y ?? Infinity)) bad.push([Math.round(x), Math.round(y), 'floor@' + g.y]); } // (a room's floor above the cut; the open ground itself stays the ground)
  return { n, hit, nbad: bad.length, bad: bad.slice(0, 5) }; })()"""

# ---- FLOORS: the pointer against the DRAWN floors (the oracle below raycasts the meshes themselves, nothing of the picker's) ----
# the first thing drawn along a pointer ray: { floor: room id | 'ground' | null, id: entity id | wall key | null, dist }
FIRST = """((x, y) => { const w = tw.worldOf(tw.area()), ray = tw.rayAt(x, y); const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const layers = [w.layers.shell, w.layers.things, w.ground]; if (w.roofLayer && w.roofsOn) layers.push(w.roofLayer);
  const h = ray.intersectObjects(layers, true).find(h => h.object.isMesh && !h.object.isSprite && !h.object.userData.halo && vis(h.object) && (!h.object.material || h.object.material.opacity > 0.05));
  if (!h) return null; let o = h.object; while (o && !o.userData.shellKey && !o.userData.entityId && !o.userData.roofOf && !o.userData.ground) o = o.parent;
  return { floor: o?.userData.ground ? 'ground' : o?.userData.floor ? o.userData.roomId : null, roof: o?.userData.roofOf || null, id: o?.userData.entityId || o?.userData.edgeKey || null, dist: h.distance, y: h.point.y }; })"""
# what the pointer does at a screen point, by every path that asks: the pick, what a click would select, the
# double-click's room, the ping point
AT = """((x, y) => { const w = tw.worldOf(tw.area()), hits = w.pickAll(tw.rayAt(x, y)), t = tw.cutTargetAt(x, y), p = tw.pointAt(x, y);
  return { sel: hits.map(h => tw.selectionFor(h)).filter(Boolean), dbl: t.room ? t.room.id : t.ground ? 'ground' : null, pointY: p ? Math.round(p.y * 10) / 10 : null, surface: w.surfaceAt(tw.rayAt(x, y), new Set(), -100)?.parent || null }; })"""
# across the screen: does any pick lie BEHIND the first floor (or the ground) drawn along its ray?
THROUGH = """(() => { const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(), bad = []; let n = 0, hit = 0, stopped = 0;
  const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const floors = [...w.shell.values()].filter(s => s.spec.layer === 'floor').map(s => s.group).concat([w.ground]);
  for (let i = 0; i < 64; i++) for (let j = 0; j < 40; j++) { const x = c.left + (i + 0.5) * c.width / 64, y = c.top + (j + 0.5) * c.height / 40, ray = tw.rayAt(x, y); n++;
    const f = ray.intersectObjects(floors, true).find(h => h.object.isMesh && vis(h.object)); if (!f) continue; stopped++;
    for (const h of w.pickAll(ray)) { if (h.floor || h.roof || !h.point) continue; hit++; const d = h.point.distanceTo(ray.ray.origin); if (d > f.distance + 0.3) bad.push([Math.round(x), Math.round(y), h.entity?.id || h.wall, Math.round(d - f.distance)]); } }
  return { n, hit, stopped, nbad: bad.length, bad: bad.slice(0, 5), kinds: [...new Set(bad.map(b => String(b[2]).replace(/[0-9]+/g, '#')))].slice(0, 8) }; })()"""

async def floors(gm, R):
    print('FLOORS: a floor that is drawn stops the pointer')
    sel = "[...tw.sel]"
    async def lv(y):  # go to a level (null: all levels)
        await gm.evaluate(f"{json.dumps(y)} == null ? tw.cutOff('test') : tw.goLevel({json.dumps(y)}, 'test')"); await gm.wait_for_timeout(350)
    async def box(x0, y0, x1, y1, out=(-9, -9)):
        # (a press on a room's label would drag the room, one on a wall piece would drag the piece: begin on bare
        # canvas with nothing under the pointer, a little further out if need be)
        for _ in range(12):
            if await gm.evaluate(f"document.elementFromPoint({x0}, {y0})?.id === 'c' && !tw.pip?.contains({x0}, {y0}, innerWidth, innerHeight) && !tw.worldOf(tw.area()).pickAll(tw.rayAt({x0}, {y0})).some(h => tw.selectionFor(h))"): break
            x0 += out[0]; y0 += out[1]
        await gm.evaluate("tw.select([])"); await gm.mouse.move(x0, y0); await gm.mouse.down(); await gm.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=4); await gm.mouse.move(x1, y1, steps=4); await gm.mouse.up(); await gm.wait_for_timeout(200)
        return await gm.evaluate("[...tw.sel].map(id => { const e = tw.ent(id); return { id, room: e?.room || null, y: e?.y || 0, kind: e?.kind }; })")
    await lv(10); await view(gm, 12, 10, 70, 72); await gm.evaluate("tw.select([])")
    # a pawn on lv 1 under the upper floor, where nothing of lv 2 stands in the way: the upper FLOOR is what is drawn there
    spot = await gm.evaluate(f"""(() => {{ const first = {FIRST}; for (const [x, z] of [[12.5, 12.5], [7.5, 12.5], [12.5, 7.5], [7.5, 7.5], [17.5, 12.5], [12.5, 17.5], [7.5, 17.5], [17.5, 7.5]]) {{
        const ok = [1, 2.5, 4].every(y => {{ const s = tw.screenOf(x, z, tw.main, y), f = first(s.x, s.y); return f && f.floor === '{R['up1']}'; }}); if (ok) return [x, z]; }} return null; }})()""")
    check(spot, 'a spot on the upper floor with nothing of lv 2 over it', str(spot))
    if not spot: return
    ux, uz = spot
    await view(gm, 50, 12, 55, 82); await gm.wait_for_timeout(300)  # (and one in the part of the kitchen no upper room covers, clear of its furniture)
    kspot = await gm.evaluate(f"""(() => {{ const first = {FIRST}; for (const [x, z] of [[46, 12], [47.5, 7.5], [42.5, 12.5], [47.5, 12.5], [42.5, 7.5], [45, 10], [47.5, 17.5], [42.5, 17.5], [45, 5], [45, 15], [47.5, 2.5], [42.5, 2.5]]) {{
        const ok = [1, 2.5, 4].every(y => {{ const s = tw.screenOf(x, z, tw.main, y), f = first(s.x, s.y); return f && f.floor === '{R['kitchen']}'; }}); if (ok) return [x, z]; }} return null; }})()""")
    check(kspot, 'a clear spot on the open part of the ground floor', str(kspot)); kx, kz = kspot or (46, 12)
    await view(gm, 12, 10, 70, 72)
    await gm.evaluate(f"tw.batch([{{ type: 'token.create', args: {{ id: 'tok_under00001', name: 'Under', x: {ux}, z: {uz} }} }}, {{ type: 'token.create', args: {{ id: 'tok_yard000001', name: 'Yard', x: 57.5, z: 12.5 }} }}, {{ type: 'token.create', args: {{ id: 'tok_kitchen001', name: 'Cook', x: {kx}, z: {kz} }} }}])")
    await wait(gm, "tw.entities()['tok_kitchen001'] && tw.sync.pendingCount() === 0", 8000); await settle(gm); await gm.wait_for_timeout(400)
    s = await scr(gm, ux, uz, 2.5)
    f = await gm.evaluate(f"{FIRST}({s['x']}, {s['y']})")
    drawn = await gm.evaluate("tw.worldOf(tw.area()).recs.get('tok_under00001').group.visible")
    check(f and f['floor'] == R['up1'] and drawn, "on lv 2, over a pawn standing on lv 1: what is drawn at that spot is the upper room's floor (the pawn is in the scene, under it)", str(f))
    # the old way (the test knob puts it back): the pick went by the thing list and took the pawn through the floor
    old = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); w.noFloorStop = true; try {{ return {AT}({s['x']}, {s['y']}); }} finally {{ w.noFloorStop = false; }} }})()")
    check(old['sel'][:1] == ['tok_under00001'] and old['dbl'] == R['common'], 'THE BUG, as it was (floor stop switched off): the pick takes the pawn under the floor, and a double-click there would cut down to lv 1', str(old))
    at = await gm.evaluate(f"{AT}({s['x']}, {s['y']})")
    check(not at['sel'], 'the pick there reaches nothing: the floor stops it', str(at['sel']))
    check(at['dbl'] == R['up1'] and at['pointY'] == 10, 'a double-click there is on the upper room, and a ping lands on the upper floor (10 ft)', str(at))
    await gm.mouse.move(s['x'] + 3, s['y'] + 3); await gm.mouse.move(s['x'], s['y']); await gm.wait_for_timeout(120)
    check(await gm.evaluate("tw.hover") is None, 'hover there shows nothing', str(await gm.evaluate("tw.hover")))
    await gm.mouse.click(s['x'], s['y']); await gm.wait_for_timeout(350)
    check(await gm.evaluate(sel) == [], 'a real click there selects nothing', str(await gm.evaluate(sel)))
    await gm.wait_for_timeout(400); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(500)
    st = await gm.evaluate(STATE)
    check(st['cut'] == 19 and st['level'] == 10, 'a real double-click there leaves you on lv 2 (it used to take the pawn\'s room: down to lv 1)', str(st))
    await lv(10); await view(gm, 12, 10, 70, 72); await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(400)
    # a drag begun there is a selection box, never a move of the pawn below
    await gm.mouse.move(s['x'], s['y']); await gm.mouse.down(); await gm.mouse.move(s['x'] + 30, s['y'] + 20, steps=4); await gm.wait_for_timeout(80)
    mq = await gm.evaluate("!document.getElementById('marquee').hidden"); await gm.mouse.up(); await gm.wait_for_timeout(250)
    pos = await gm.evaluate("(() => { const e = tw.entities()['tok_under00001']; return [e.x, e.z]; })()")
    check(mq and pos == [ux, uz], 'a drag begun there draws a selection box; the pawn below does not move', f'{mq} {pos}')
    # the selection box over the whole upper room: lv 2's things, none of lv 1's (drawn or not)
    a, b = await scr(gm, -3, -3, 19), await scr(gm, 23, 23, 10)
    got = await box(a['x'] - 12, a['y'] - 12, b['x'] + 12, b['y'] + 12)
    below = [g['id'] for g in got if g['id'] == 'tok_under00001' or g['room'] == R['common'] or (g['kind'] == 'token' and g['y'] < 10)]
    check(len(got) >= 3 and not below, "a box dragged over the upper room on lv 2 gathers that room's things and nothing from under its floor", f"{len(got)} gathered, from below: {below[:4]}")
    await gm.evaluate("tw.select([])")
    th = await gm.evaluate(THROUGH)
    check(th['stopped'] > 500 and th['nbad'] == 0, 'lv 2: across 2,560 screen points, no pick lies behind the first floor drawn along its ray', str(th))
    # WHAT YOU CAN SEE BELOW IS STILL YOURS: beside the building, and in the part of the ground floor no upper room covers
    await view(gm, 50, 12, 55, 82); await gm.wait_for_timeout(300)
    for (tid, x, z, where) in (('tok_yard000001', 57.5, 12.5, 'in the yard beside the building'), ('tok_kitchen001', kx, kz, 'on lv 1 where no upper floor covers it')):
        s2 = await scr(gm, x, z, 3); f2 = await gm.evaluate(f"{FIRST}({s2['x']}, {s2['y']})")
        await gm.evaluate("tw.select([])"); await gm.mouse.move(s2['x'] + 2, s2['y']); await gm.mouse.move(s2['x'], s2['y']); await gm.wait_for_timeout(120); hov = await gm.evaluate("tw.hover")
        await gm.mouse.click(s2['x'], s2['y']); await gm.wait_for_timeout(450)
        check(f2 and f2['id'] == tid and hov == tid and await gm.evaluate(sel) == [tid], f'a pawn {where}, seen from lv 2, is hovered and selected as before', f"drawn {f2 and f2['id']}, hover {hov}, sel {await gm.evaluate(sel)}")
    a, b = await scr(gm, 35, -5, 8), await scr(gm, 67, 24, 0)
    got = await box(a['x'], b['y'], b['x'], a['y'], (-9, 9))  # (from the bare ground south-west of the kitchen)
    check({'tok_yard000001', 'tok_kitchen001'} <= {g['id'] for g in got}, 'and a box over them gathers both', str([g['id'] for g in got if g['kind'] == 'token']))
    await view(gm, 12, 10, 70, 72); await gm.wait_for_timeout(300)
    # THROUGH A STAIR'S HOLE: the floor is open there, and the stair that comes up through it is reached
    await gm.evaluate("tw.select([])")
    # (a small tower of its own, emptied, so the stair always has room: two rooms, one over the other)
    T = []
    for y in (0, 10):
        tid = f"room_cuttower{y}{random.randrange(10**6):06d}"; T.append(tid)
        await gm.evaluate(SPAWN, {'id': tid, 'type': 'guest', 'x': -8, 'z': 0, 'w': 4, 'd': 4, 'y': y, 'seed': 5110 + y})
        await wait(gm, f"tw.entities()['{tid}'] && tw.sync.pendingCount() === 0", 30000, 'tower room')
    await gm.evaluate(f"tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && ['{T[0]}', '{T[1]}'].includes(e.room) && !e.fromEdge && e.place !== 'kit').map(e => ({{ type: 'object.delete', args: {{ id: e.id }} }})))")
    await gm.wait_for_timeout(400); await settle(gm)
    sid = await gm.evaluate(f"tw.addStair(tw.entities()['{T[1]}']) || tw.stairWhy")
    await wait(gm, f"tw.entities()['{sid}'] && tw.sync.pendingCount() === 0", 8000, f'stair: {sid}'); await settle(gm); await view(gm, -30, 10, 60, 72); await gm.wait_for_timeout(600)
    holes = await gm.evaluate("[...tw.ST.holesAt(tw.entities(), 10)].map(k => k.split(':').map(Number))")
    reach = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), first = {FIRST}; let seen = 0, got = 0; const miss = [];
      for (const [gx, gz] of {json.dumps(holes)}) for (const [u, v] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) {{ const s = tw.screenOf((gx + u) * 5, (gz + v) * 5, tw.main, 10), f = first(s.x, s.y); if (!f || f.id !== '{sid}' || f.y > 9.9) continue; seen++;
        if (w.pickAll(tw.rayAt(s.x, s.y)).some(h => h.entity?.id === '{sid}')) got++; else miss.push([gx, gz, u, v]); }} return {{ seen, got, miss: miss.slice(0, 3) }}; }})()""")
    check(len(holes) >= 1 and reach['seen'] >= 1 and reach['got'] == reach['seen'], "through the stair's hole in the upper floor, the stair below the floor line is reached wherever it is what is drawn", f"{len(holes)} hole cells, {reach}")
    th = await gm.evaluate(THROUGH)
    check(th['nbad'] == 0, 'with the hole in the floor: still no pick behind a drawn floor', str(th))
    await gm.evaluate(f"tw.batch([{{ type: 'room.delete', args: {{ id: '{T[1]}' }} }}, {{ type: 'room.delete', args: {{ id: '{T[0]}' }} }}])"); await gm.wait_for_timeout(700); await settle(gm)
    check(await gm.evaluate(f"!tw.entities()['{T[0]}'] && !tw.entities()['{T[1]}'] && !tw.entities()['{sid}']"), '(the tower is taken down again)')
    await view(gm, 12, 10, 70, 72)
    # ---- the mirror cases ----
    # above the cut: nothing of lv 2 is reached from lv 1
    await lv(0); await view(gm, 12, 10, 70, 72)
    s3 = await scr(gm, 8, 8, 12.5); at3 = await gm.evaluate(f"{AT}({s3['x']}, {s3['y']})")
    check('tok_upstairs01' not in at3['sel'] and at3['dbl'] != R['up1'], 'on lv 1: the pawn standing on lv 2 (not drawn) is not reached', str(at3))
    th = await gm.evaluate(THROUGH); check(th['nbad'] == 0, 'lv 1: no pick behind a drawn floor', str(th))
    a, b = await scr(gm, -4, -4, 0), await scr(gm, 54, 24, 0)
    got = await box(a['x'] - 10, a['y'] - 10, b['x'] + 10, b['y'] + 10)
    up = [g['id'] for g in got if g['room'] in (R['up1'], R['up2']) or g['y'] >= 10 or g['room'] == R['cellar']]
    check(len(got) >= 5 and 'tok_under00001' in {g['id'] for g in got} and not up, 'on lv 1 a box over the ground floor gathers its things (the pawn that was under the floor too), nothing from lv 2 or the cellar', f"{len(got)} gathered, wrong: {up[:4]}")
    # a cellar under the closed ground, away from the building: its pawn is out of reach until the ground opens
    await gm.evaluate("tw.select([])")
    cid = f"room_cutdeep{random.randrange(10**6):06d}"
    await gm.evaluate(SPAWN, {'id': cid, 'type': 'cellar', 'x': 14, 'z': 2, 'w': 4, 'd': 4, 'y': -10, 'seed': 5106})
    await wait(gm, f"tw.entities()['{cid}'] && tw.sync.pendingCount() === 0", 30000, 'second cellar')
    await gm.evaluate("tw.batch([{ type: 'token.create', args: { id: 'tok_deep000001', name: 'Deep', x: 82.5, z: 22.5, y: -10 } }])"); await wait(gm, "tw.entities()['tok_deep000001']", 8000); await settle(gm)
    await lv(None); await view(gm, 80, 20, 70, 72); await gm.wait_for_timeout(300)
    s4 = await scr(gm, 82.5, 22.5, -7.5); f4 = await gm.evaluate(f"{FIRST}({s4['x']}, {s4['y']})"); at4 = await gm.evaluate(f"{AT}({s4['x']}, {s4['y']})")
    await gm.mouse.move(s4['x'], s4['y']); await gm.mouse.click(s4['x'], s4['y']); await gm.wait_for_timeout(350)
    check(f4 and f4['floor'] == 'ground' and not at4['sel'] and at4['dbl'] == 'ground' and at4['pointY'] == 0 and await gm.evaluate(sel) == [], 'all levels, closed ground over a cellar: a click on the ground reaches nothing in the cellar under it', f'{f4} {at4}')
    a, b = await scr(gm, 66, 6, 0), await scr(gm, 94, 34, 0)
    got = await box(a['x'], a['y'], b['x'], b['y'])
    check(not got, 'and a box on the ground over it gathers nothing from the cellar', str([g['id'] for g in got][:5]))
    th = await gm.evaluate(THROUGH); check(th['nbad'] == 0, 'all levels: no pick behind a drawn floor or the ground', str(th))
    await lv(-10); await view(gm, 80, 20, 70, 72); await gm.wait_for_timeout(500)
    s4 = await scr(gm, 82.5, 22.5, -7.5); await gm.evaluate("tw.select([])"); await gm.mouse.move(s4['x'], s4['y']); await gm.mouse.click(s4['x'], s4['y']); await gm.wait_for_timeout(350)
    check(await gm.evaluate(sel) == ['tok_deep000001'], 'on lv -1 the ground is open over the cellar and its pawn is selected', str(await gm.evaluate(sel)))
    th = await gm.evaluate(THROUGH); check(th['nbad'] == 0, 'lv -1: no pick behind a drawn floor or the ground', str(th))
    await gm.evaluate("tw.select([])")
    await gm.evaluate(f"tw.batch([{{ type: 'token.delete', args: {{ id: 'tok_deep000001' }} }}, {{ type: 'room.delete', args: {{ id: '{cid}' }} }}])"); await gm.wait_for_timeout(500)
    # roofs on: a roof stops the pointer (it did for clicks already), and the box as well
    await lv(None); await gm.evaluate("tw.setRoofs(true, 'test')"); await view(gm, kx, kz, 60, 86); await wait(gm, "tw.worldOf(tw.area()).roofReport().some(r => r.shown)", 15000, 'roofs'); await gm.wait_for_timeout(1200)
    s5 = await scr(gm, kx, kz, 3); f5 = await gm.evaluate(f"{FIRST}({s5['x']}, {s5['y']})"); at5 = await gm.evaluate(f"{AT}({s5['x']}, {s5['y']})")
    check(f5 and f5['roof'] and 'tok_kitchen001' not in at5['sel'] and at5['sel'][:1] == ['roof:' + f5['roof']], 'roofs on: over a pawn indoors the roof is what is drawn, and the pick takes the roof, not the pawn', f'{f5} {at5}')
    await view(gm, 30, 10, 95, 60); await gm.wait_for_timeout(300)
    a, b = await scr(gm, -6, -6, 30), await scr(gm, 64, 26, 0)
    got = await box(a['x'] - 20, a['y'] - 20, b['x'] + 20, b['y'] + 20)
    ids = {g['id'] for g in got}
    check('tok_yard000001' in ids and not ({'tok_kitchen001', 'tok_under00001', 'tok_mira00001', 'tok_upstairs01'} & ids) and not [g for g in got if g['room']], 'roofs on: a box over the whole inn gathers the pawn in the yard and nothing from under the roofs', str(sorted(ids))[:200])
    await gm.evaluate("tw.setRoofs(false, 'test'); tw.select([])"); await gm.wait_for_timeout(400)
    await gm.evaluate("tw.batch(['tok_under00001', 'tok_yard000001', 'tok_kitchen001'].map(id => ({ type: 'token.delete', args: { id } })))"); await gm.wait_for_timeout(400)
    await lv(0); await gm.evaluate("tw.cutOff('test')"); await view(gm, 25, 10, 95, 60)

async def main():
    full = A.shots
    page = start_local(full) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, permissions=['clipboard-read', 'clipboard-write'])
            if os.environ.get('TW_SLOW_ASSETS'):  # every mesh arrives late (ms), as on a slow line: stand-ins and placeholders stay up longer
                async def _slow(route): await asyncio.sleep(int(os.environ['TW_SLOW_ASSETS']) / 1000); await route.continue_()
                await ctx.route('**/*.glb', _slow)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url); return pg
        gm = await tab(page, *((1920, 1080) if full else (1400, 900)))
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST cut {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')

        # ---- the inn: two rooms on the ground, two upstairs, a cellar ----
        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=6, d=4, seed=5101)), ('kitchen', dict(type='kitchen', x=6, z=0, w=4, d=4, seed=5102)),
                          ('up1', dict(type='guest', x=0, z=0, w=4, d=4, y=10, seed=5103)), ('up2', dict(type='guest', x=4, z=0, w=4, d=4, y=10, seed=5104)),
                          ('cellar', dict(type='cellar', x=0, z=0, w=4, d=4, y=-10, seed=5105))):
            rid = f"room_cut{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built' + (f" at {a.get('y')} ft" if a.get('y') else ''))
        await settle(gm)
        b_inn = await gm.evaluate(f"tw.entities()['{R['common']}'].building")
        await gm.evaluate(f"tw.dispatch('building.set', {{ id: '{b_inn}', name: 'Inn' }})")
        same = await gm.evaluate(f"['{R['kitchen']}', '{R['up1']}', '{R['up2']}', '{R['cellar']}'].every(id => tw.entities()[id].building === '{b_inn}')")
        check(same, 'all five rooms are one building')
        await view(gm, 25, 10, 95, 60)

        if A.shots: return await shots(gm, R, browser)

        # the player, a pawn of theirs downstairs, an NPC, a loose crate upstairs height in the yard (a flyer stand-in)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        PL = await pl.evaluate('tw.me()')
        await gm.evaluate(f"tw.batch([{{ type: 'token.create', args: {{ id: 'tok_mira00001', name: 'Mira', x: 12, z: 12, owner: '{PL}' }} }}, {{ type: 'token.create', args: {{ id: 'tok_goblin0001', name: 'Goblin', x: 22, z: 12 }} }}, {{ type: 'token.create', args: {{ id: 'tok_upstairs01', name: 'Maid', x: 8, z: 8, y: 10 }} }}])")
        await wait(pl, "tw.entities()['tok_upstairs01']", 8000); await settle(gm); await settle(pl)

        # ================= FLOORS =================
        await floors(gm, R)
        if A.floors:
            real = [e for e in errors if 'WebSocket' not in e and 'ERR_CONNECTION' not in e]
            check(not real, 'no page errors', '; '.join(real[:4])); return await browser.close()

        # ================= RULE =================
        print('RULE: what is drawn at each cut')
        ceil = await gm.evaluate(f"(() => {{ const E = tw.entities(), H = tw.footprint && null; return {{}}; }})()")
        C = {'lv1': 9, 'lv2': 19, 'cellar': -1}
        r0 = await gm.evaluate(REPORT)
        check(r0['cut'] is None and len(r0['shown']) == 5 and not r0['gone'] and not r0['thingsHidden'] and not r0['groundOpen'], 'cut off: every room is drawn, nothing hidden, the ground whole', str({k: r0[k] for k in ('cut', 'gone', 'groundOpen')}))
        async def at(y, pinned=False):
            await gm.evaluate(f"tw.setCut({json.dumps(y)}, {{ pinned: {json.dumps(pinned)}, by: 'test' }})"); await gm.wait_for_timeout(200)
            return await gm.evaluate(REPORT)
        r = await at(C['lv2'])
        # WHAT NOBODY CAN SEE IS NOT DRAWN (frame time, 2026-10-06): with the ground closed, a cellar's things and shell
        # more than 7.5 ft from a stair's hole are not drawn; every such piece belongs to a covered room; opened, all of it is
        un = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), r = w.cutReport(), E = tw.entities(); const cov = new Set(r.covered); const drawn = (id) => { let n = 0; for (const x of w.recs.values()) if (x.entity.room === id && x.group.visible) n++; return n; }; return { things: r.unseen.things.length, rooms: Object.keys(r.unseen.rooms), allCovered: r.unseen.things.every(id => cov.has(E[id].room)) && Object.keys(r.unseen.rooms).every(id => cov.has(id)), stairsDrawn: Object.values(E).filter(e => e.place === 'stair').every(e => w.recs.get(e.id).group.visible), cellarDrawn: drawn('" + R['cellar'] + "'), cellarThings: Object.values(E).filter(e => e.kind === 'object' && e.room === '" + R['cellar'] + "').length }; })()")
        check(un['things'] > 0 and un['allCovered'] and un['stairsDrawn'] and un['cellarDrawn'] < un['cellarThings'], 'ground closed: what nobody can see is not drawn (covered rooms only; stairs always drawn; part of the cellar under the closed ground)', str(un))
        check(len(r['shown']) == 5 and not r['gone'] and not r['mixed'], 'cut at lv 2 (19 ft): all five rooms show (nothing is above it)', str(r['gone']))
        r = await at(C['lv1'])
        up_things = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && (e.room === '{R['up1']}' || e.room === '{R['up2']}')).map(e => e.id)")
        check(set(r['gone']) == {R['up1'], R['up2']} and set(r['shown']) == {R['common'], R['kitchen'], R['cellar']} and not r['mixed'], 'cut at lv 1 (9 ft): the two upper rooms are gone WHOLE (floor, slab, walls, posts), the ground floor and cellar whole', f"gone {len(r['gone'])}, mixed {r['mixed']}")
        check(set(up_things) <= set(r['thingsHidden']) and 'tok_upstairs01' in r['thingsHidden'] and 'tok_mira00001' not in r['thingsHidden'], 'their things go with them, and the pawn standing upstairs; the pawn downstairs stays', f"{len(up_things)} things upstairs, {len(r['thingsHidden'])} hidden")
        down_hidden = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{R['common']}' && !w.recs.get(e.id).group.visible && !w.anims.has(w.recs.get(e.id).group)).length; }})()")
        check(down_hidden == 0 and not r['groundOpen'], 'nothing on the ground floor is hidden, tall things included (a room shows whole: nothing is sliced); the ground is whole')
        r = await at(C['cellar'])
        un = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), r = w.cutReport(); return { things: r.unseen.things.filter(id => tw.entities()[id].room === '" + R['cellar'] + "').length, shell: r.unseen.rooms['" + R['cellar'] + "'] || 0 }; })()")
        check(un['things'] == 0 and un['shell'] == 0, 'cut at lv -1: the opened cellar is drawn whole', str(un))
        check(set(r['shown']) == {R['cellar']} and len(r['gone']) == 4 and r['groundOpen'], 'cut at lv -1 (-1 ft): only the cellar shows, and the ground is opened over it', str({'shown': len(r['shown']), 'gone': len(r['gone']), 'open': r['groundOpen']}))
        check('tok_mira00001' in r['thingsHidden'] and 'tok_goblin0001' in r['thingsHidden'], 'pawns standing on the ground are above that cut: hidden')
        r = await at(None)
        check(len(r['shown']) == 5 and not r['thingsHidden'] and not r['groundOpen'], 'cut off again: everything is back and the ground closes')
        # a tall thing: a loose pillar standing on the ground and reaching 15 ft is whole at lv 1
        await gm.evaluate("tw.dispatch('object.place', { id: 'obj_tallpost001', x: 60, z: 10, cat: 'post-timber', ...tw.roomgen.sizeOf('post-timber'), dims: [1, 15, 1] })"); await gm.wait_for_timeout(500)
        r = await at(C['lv1'])
        check('obj_tallpost001' not in r['thingsHidden'], 'something that spans the cut is shown whole when its base is at or below the cut (a 15-ft post on the ground, cut at 9 ft)')
        await gm.evaluate("tw.dispatch('object.move', { id: 'obj_tallpost001', x: 60, z: 10, y: 12 })"); await gm.wait_for_timeout(500)
        r = await gm.evaluate(REPORT)
        check('obj_tallpost001' in r['thingsHidden'], 'a loose thing whose base is above the cut is hidden (raised to 12 ft)')
        await gm.evaluate("tw.dispatch('object.delete', { id: 'obj_tallpost001' })"); await at(None)

        # ================= CONTROLS =================
        print('CONTROLS: double-click, level up / down, all levels')
        await view(gm, 25, 10, 95, 60); await gm.evaluate("tw.select([])")
        w0 = (await gm.evaluate(STATE))['writes']
        # double-click a spot upstairs (the upper floor is what you see there)
        s = await scr(gm, 7.5, 12.5, 10); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(300)
        st = await gm.evaluate(STATE)
        check(st['cut'] == 19 and not st['pinned'] and st['last'] == 'dblclick', 'double-click a spot in an upper room: the cut goes to that room\'s ceiling (19 ft), not pinned', str(st))
        check(st['level'] == 10, 'and its floor becomes the level a room tool would draw on', st['level'])
        # double-click a ground-floor room's LABEL
        lab = await gm.evaluate(f"(() => {{ const l = tw.labelInfo().find(l => l.id === '{R['kitchen']}'); return l && l.rect && {{ x: (l.rect[0] + l.rect[2]) / 2, y: (l.rect[1] + l.rect[3]) / 2 }}; }})()")
        await gm.mouse.dblclick(lab['x'], lab['y']); await gm.wait_for_timeout(350)
        st = await gm.evaluate(STATE); r = await gm.evaluate(REPORT)
        check(st['cut'] == 9 and not st['pinned'] and st['last'] == 'label' and set(r['gone']) == {R['up1'], R['up2']}, "double-click a room's label: the cut goes to that room's ceiling (9 ft); the upper rooms are gone", str(st))
        check(not await gm.evaluate("!!document.querySelector('#labels input')"), 'a double-click on a room label no longer starts a rename')
        labels = await gm.evaluate("tw.labelInfo().filter(l => l.visible).map(l => l.id)")
        check(R['up1'] not in labels and R['up2'] not in labels and R['common'] in labels and b_inn in labels, 'labels respect the cut: no label for the rooms above it; the building keeps its label')
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(250)
        lab_all = await gm.evaluate("tw.labelInfo().filter(l => l.visible).map(l => l.id)")
        check(R['common'] not in lab_all and R['cellar'] not in lab_all and R['up1'] in lab_all and R['kitchen'] in lab_all, 'with all levels showing, a room wholly under the upper floor and the cellar under the ground carry no label (it would read as the room above); a room only partly covered keeps its own')
        await gm.evaluate("tw.setCut(9, { by: 'label' })"); await gm.wait_for_timeout(250)
        await gm.evaluate(f"tw.select('{R['kitchen']}')"); await gm.keyboard.press('F2'); await gm.wait_for_timeout(200)
        check(await gm.evaluate("!!document.querySelector('#labels input')"), 'F2 still renames a room'); await gm.keyboard.press('Escape'); await gm.evaluate("tw.select([])")
        # ONE LEVEL (Harry 2026-10-06): [ and ] move the level you are on; you see it and you build on it; any level, built or not
        await gm.keyboard.press('['); await gm.wait_for_timeout(250); st = await gm.evaluate(STATE)
        check(st['cut'] == -1 and st['level'] == -10, '[ (level down) from lv 1: you are on lv -1 and the view is cut to it', str(st))
        await gm.keyboard.press('['); await gm.wait_for_timeout(250); st = await gm.evaluate(STATE)
        check(st['cut'] == -11 and st['level'] == -20, '[ again: lv -2, where nothing is built yet (a level is a place to build, built or not)', str(st))
        await gm.keyboard.press(']'); await gm.keyboard.press(']'); await gm.keyboard.press(']'); await gm.wait_for_timeout(250); st = await gm.evaluate(STATE)
        check(st['cut'] == 19 and st['level'] == 10, '] ] ] steps up through lv -1 and lv 1 to lv 2', str(st))
        await gm.keyboard.press(']'); await gm.wait_for_timeout(250); st = await gm.evaluate(STATE); r = await gm.evaluate(REPORT)
        check(st['cut'] == 29 and st['level'] == 20 and not r['gone'], '] above the top storey: lv 3, an empty level to build on (everything below it shows); it is NOT "all levels"', str(st))
        await gm.keyboard.press('\\'); await gm.wait_for_timeout(250); st = await gm.evaluate(STATE)
        check(st['cut'] is None and st['level'] == 20, '\\ shows all levels; the level you are on does not change', str(st))
        await gm.keyboard.press('\\'); await gm.wait_for_timeout(250); st = await gm.evaluate(STATE)
        check(st['cut'] == 29 and st['level'] == 20, '\\ again: back to the level you are on', str(st))
        for _ in range(20): await gm.keyboard.press(']')
        await gm.wait_for_timeout(250); st = await gm.evaluate(STATE); rng = await gm.evaluate("tw.levelRange()")
        check(st['level'] == rng['hiY'] == 50, '] stops at the top of the meter (5 storeys above the ground storey)', f"{st} {rng}")
        for _ in range(30): await gm.keyboard.press('[')
        await gm.wait_for_timeout(250); st = await gm.evaluate(STATE)
        check(st['level'] == rng['loY'] == -60, '[ stops at the bottom of the meter (6 storeys down)', str(st))
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(200); st = await gm.evaluate(STATE)
        check(st['cut'] == 9 and st['level'] == 0, 'back on lv 1', str(st))
        # a pawn selected: its damage keys are = and - (2026-10-06; HP was on [ and ]); ] and [ are level keys, always
        await gm.evaluate("tw.select('tok_goblin0001')"); await gm.keyboard.press('='); await gm.wait_for_timeout(300)
        st = await gm.evaluate(STATE); hp = await gm.evaluate("tw.entities()['tok_goblin0001'].damage || 0")
        check(st['cut'] == 9 and hp == 1, 'with a pawn selected = is one damage, and the cut does not move', f'cut {st["cut"]}, damage {hp}')
        await gm.keyboard.press(']'); await gm.wait_for_timeout(300); st = await gm.evaluate(STATE); hp = await gm.evaluate("tw.entities()['tok_goblin0001'].damage || 0")
        check(st['cut'] == 19 and st['level'] == 10 and hp == 1, 'with a pawn selected ] steps the level up (and leaves its damage alone)', str(st))
        await gm.evaluate("tw.select([])")
        # a double-click after a level step: the room's level
        await gm.keyboard.press('['); await gm.wait_for_timeout(200)
        s = await scr(gm, 40, 10, 0.1); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(300); st = await gm.evaluate(STATE)
        check(st['cut'] == 9 and st['level'] == 0 and st['last'] == 'dblclick', 'a double-click (in the kitchen) goes to that room\'s level', str(st))
        s = await scr(gm, 62, 32, 0); tg = await gm.evaluate(f"JSON.stringify([tw.cutTargetAt({s['x']}, {s['y']}).ground || false, document.elementFromPoint({s['x']}, {s['y']})?.id])")
        await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(300); st = await gm.evaluate(STATE); st['target'] = tg
        check(st['cut'] is None and st['last'] == 'dblclick' and st['level'] == 0, 'double-click open ground: all levels show; the level you are on stays', str(st))
        # the bar finds every one of them
        names = await gm.evaluate("tw.registry.all().map(c => c.id)")
        check(all(c in names for c in ('level.up', 'level.down', 'cut.off', 'cut.room', 'cut.pawn', 'view.roofsOn', 'view.roofsOff')), 'floor up / down, show all levels, look into this room, cut to my pawn and roofs on / off are registry commands (bar, keys, chords)')
        await gm.evaluate(f"tw.select('{R['kitchen']}')"); await gm.evaluate("tw.registry.run('cut.room')"); await gm.wait_for_timeout(200)
        check((await gm.evaluate(STATE))['cut'] == 9, '"Look into this room" from the bar cuts to the selected room'); await gm.evaluate("tw.select([])")

        await gm.keyboard.press('?'); await gm.wait_for_timeout(300)
        sheet = await gm.evaluate("document.getElementById('sheet').innerText")
        check('Level up' in sheet and 'Level down' in sheet and 'Show all levels' in sheet, 'the "?" sheet lists level up, level down and show all levels', sheet[-400:])
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        if not await gm.evaluate("document.getElementById('sheet').hidden"): await gm.keyboard.press('?')

        # ================= INDICATOR =================
        print('INDICATOR: always on screen, truthful, never covered')
        async def bar_state(pg=gm): return await pg.evaluate("tw.cutBar()")
        MARK = "(() => { const e = document.querySelector('#levelMeter .lm-n.cur em'); return e ? { text: e.textContent, bg: getComputedStyle(e).backgroundColor } : null; })()"
        b = await bar_state(); vp = await gm.evaluate("[innerWidth, innerHeight]")
        check(b['shown'] and b['on'] and 'lv 1' in b['textShown'] and 'Inn' in b['textShown'], 'cut at lv 1: the meter says so ("Showing lv 1 · Inn …")', b['textShown'])
        check(b['rect'][0] <= 0.5 and b['rect'][1] <= 0.5 and b['rect'][3] >= vp[1] - 0.5 and b['rect'][2] - b['rect'][0] <= 24, 'the meter is a slim rail on the left edge, the whole height of the screen', str(b['rect']))
        ys = [n['y'] for n in b['notches']]
        check(ys == list(range(50, -70, -10)), 'a notch per storey: 5 above the ground storey and 6 below it, highest at the top', str(ys))
        built = sorted(n['y'] for n in b['notches'] if 'rooms' in n['cls'])
        check(built == [-10, 0, 10] and [n['y'] for n in b['notches'] if 'ground' in n['cls']] == [0], 'the storeys with rooms (lv -1, lv 1, lv 2) carry the heavier notch; the ground is marked', str(built))
        check([n['y'] for n in b['notches'] if 'hid' in n['cls']] == [50, 40, 30, 20, 10], 'the storeys the cut hides are dimmed', str([n['y'] for n in b['notches'] if 'hid' in n['cls']]))
        loud = await gm.evaluate(MARK)
        check(b['marker'] and loud['text'] == '1' and b['marker']['rect'][2] <= 21, 'the level you are on is marked with its number, readable without hovering', str(loud))
        await gm.keyboard.press('['); await gm.wait_for_timeout(450); b = await bar_state()
        check('lv -1' in b['textShown'] and b['marker']['text'] == '-1', 'on lv -1: the marker moves there', b['textShown'])
        n0 = next(n for n in b['notches'] if n['y'] == 0)
        await gm.mouse.click(4, n0['at'][1]); await gm.wait_for_timeout(450); b = await bar_state()
        check(b['y'] == 9 and b['level'] == 0 and b['marker']['text'] == '1', 'a click on a notch goes to that level', b['textShown'])
        # drag along the rail: the level follows
        n2 = next(n for n in b['notches'] if n['y'] == 10); n3 = next(n for n in b['notches'] if n['y'] == 20)
        await gm.mouse.move(4, n0['at'][1]); await gm.mouse.down(); await gm.mouse.move(6, n3['at'][1], steps=5); await gm.wait_for_timeout(150); mid = await gm.evaluate(STATE)
        await gm.mouse.move(6, n2['at'][1], steps=3); await gm.mouse.up(); await gm.wait_for_timeout(450); st = await gm.evaluate(STATE)
        check(mid['level'] == 20 and st['level'] == 10 and st['cut'] == 19 and st['last'] == 'meter', 'a drag along the rail scrubs through the levels and stays where it is let go', f"{mid} {st}")
        await gm.mouse.move(700, 400); await gm.wait_for_timeout(300)
        await gm.mouse.click(4, n0['at'][1]); await gm.wait_for_timeout(300); await gm.mouse.move(700, 400); await gm.wait_for_timeout(450)
        await gm.mouse.click(8, b['cap']['at'][1]); await gm.wait_for_timeout(250); await gm.mouse.move(700, 400); await gm.wait_for_timeout(450); b = await bar_state()
        quiet = await gm.evaluate(MARK)
        check(not b['on'] and b['textShown'].startswith('All levels') and b['shown'] and b['cap']['on'] and quiet and quiet['text'] == '1' and quiet['bg'] != loud['bg'], 'its cap shows all levels: the cap lights, the marker stays on lv 1 (where you build) but goes quiet; with a cut it is the loud colour', f"{b['textShown']} | {quiet} vs {loud}")
        await gm.mouse.click(8, b['cap']['at'][1]); await gm.wait_for_timeout(250); await gm.mouse.move(700, 400); b2 = await bar_state()
        check(b2['on'] and b2['y'] == 9, 'the cap again: back to the level you are on', b2['textShown'])
        await gm.mouse.click(8, b['cap']['at'][1]); await gm.mouse.move(700, 400); await gm.wait_for_timeout(450)
        hov = await gm.evaluate("(async () => { const el = document.getElementById('levelMeter'); return el.matches(':hover'); })()")
        await gm.mouse.move(5, 300); await gm.wait_for_timeout(400)
        wide = await gm.evaluate("(() => { const el = document.getElementById('levelMeter'), l = el.querySelector('.lm-n.rooms b').getBoundingClientRect(), r = el.getBoundingClientRect(); return { w: r.width, labelIn: l.right <= r.right + 0.5 && l.width > 10, text: el.querySelector('.lm-n.ground b').textContent, focus: document.activeElement === document.body || document.activeElement?.id || '' }; })()")
        check(not hov and wide['w'] > 80 and wide['labelIn'] and 'lv 1' in wide['text'], 'under the pointer it widens and the labels read ("lv 1 · ground")', str(wide))
        await gm.mouse.move(700, 400); await gm.wait_for_timeout(450)
        for (vw, vh) in ((900, 420), (480, 640)):
            await gm.set_viewport_size({'width': vw, 'height': vh}); await gm.wait_for_timeout(500)
            sm = await gm.evaluate("(() => { const b = tw.cutBar(), l = document.querySelector('#launchers .launcher:not([hidden])').getBoundingClientRect(), c = document.getElementById('chat').getBoundingClientRect(), hs = b.notches.map(n => n.at[1]); return { rect: b.rect, launcher: l.left, chat: c.left, gap: Math.min(...hs.slice(1).map((y, i) => y - hs[i])), marker: b.marker, h: innerHeight }; })()")
            check(sm['rect'][3] >= sm['h'] - 0.5 and sm['launcher'] >= sm['rect'][2] and sm['chat'] >= sm['rect'][2] and sm['gap'] >= 12 and sm['marker'], f'a small window ({vw} x {vh}): the meter is whole, its notches at least 12 px apart, and the launchers and the chat sit beside it', str(sm))
        await gm.set_viewport_size({'width': vp[0], 'height': vp[1]}); await gm.wait_for_timeout(500)
        # never under the Build tray, the PiP or the command bar
        over = lambda a, r: a[0] < r['right'] and r['left'] < a[2] and a[1] < r['bottom'] and r['top'] < a[3]
        rect = lambda sel: gm.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width ? {{ left: r.left, top: r.top, right: r.right, bottom: r.bottom }} : null; }})()")
        await gm.keyboard.press('b'); await gm.wait_for_timeout(500)
        tray = await rect('#buildMenu'); b = await bar_state()
        check(tray and not over(b['rect'], tray), 'the open Build tray does not cover it', str(tray))
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('floor'); await gm.wait_for_timeout(350)
        bar, res = await rect('#bar'), await rect('#results'); b = await bar_state()
        rows = await gm.evaluate("[...document.querySelectorAll('#results .res')].map(e => e.innerText.replace(/\\s+/g, ' ')).join(' | ')")
        check(bar and not over(b['rect'], bar) and (not res or not over(b['rect'], res)), 'the open command bar and its results do not cover it')
        check('Level up' in rows and 'Level down' in rows, 'the bar finds "floor up" and "floor down" (Level up / Level down)', rows[:160])
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        # a PiP dragged as far left as it goes still leaves the meter clear
        await gm.evaluate("tw.openPip(tw.area())"); await gm.wait_for_timeout(300)
        await gm.evaluate("(() => { tw.pip.rect = [0.2, 0.5, 0.6, 0.5]; })()")
        bb = await gm.evaluate("(() => { const r = document.querySelector('#pipFrame .bar').getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }; })()")
        await gm.mouse.move(bb['x'], bb['y']); await gm.mouse.down(); await gm.mouse.move(bb['x'] - 900, bb['y'] + 300, steps=6); await gm.mouse.up(); await gm.wait_for_timeout(250)
        pip = await rect('#pipFrame'); b = await bar_state()
        check(pip and not over(b['rect'], pip) and pip['left'] < 40, 'the PiP window, dragged to the left edge, stops beside it', f"pip left {pip and round(pip['left'])}, meter right {round(b['rect'][2])}")
        # cut to an upper level with the PiP open: the main view still fills its own viewport (the PiP root-cause case)
        await gm.evaluate("tw.setCut(19, { by: 'test' })"); await gm.wait_for_timeout(600)
        lr = await gm.evaluate("JSON.stringify(tw.lastRenders.map(r => [r.view, r.via, r.viewport.w > 1000]))")
        check('"main","fx",true' in lr and '"pip"' in lr, 'cut to lv 2 with a PiP open, the main view draws through the stack into its own full viewport and the PiP into its own', lr)
        await gm.evaluate("tw.closePip(); tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(200)
        pb = await bar_state(pl)
        check(pb['shown'] and not pb['on'] and pb['marker'], 'the player has the meter too')

        # ================= UNASKED =================
        print('UNASKED: nothing but a double-click, a floor step or an offer ever moves the cut')
        for (name, cut, pinned) in (('cut at lv 1', 9, False), ('all levels', None, False)):
            await gm.evaluate(f"tw.setCut({json.dumps(cut)}, {{ pinned: {json.dumps(pinned)}, by: 'test' }})"); await gm.wait_for_timeout(150)
            base = await gm.evaluate(STATE)
            # move a pawn, across rooms; raise a pawn through the ceiling (it changes floor); select things, a room, a building
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_goblin0001', x: 40, z: 12 })"); await gm.wait_for_timeout(200)
            await gm.evaluate("tw.liftTo(tw.entities()['tok_goblin0001'], 10)"); await gm.wait_for_timeout(300)
            await gm.evaluate("tw.liftTo(tw.entities()['tok_goblin0001'], 0)"); await gm.wait_for_timeout(300)
            await gm.evaluate(f"tw.select('tok_goblin0001'); tw.select('{R['common']}'); tw.select('{b_inn}'); tw.select('{R['up1']}'); tw.select([])")
            # zoom all the way out and back, pan, rotate
            await gm.evaluate("(() => { const g = tw.main.grab; g.dist = g.maxDist; g.update(); })()"); await gm.wait_for_timeout(250)
            await gm.mouse.move(700, 450); await gm.mouse.wheel(0, -600); await gm.mouse.wheel(0, 900); await gm.wait_for_timeout(200)
            await gm.mouse.move(900, 600); await gm.mouse.down(button='right'); await gm.mouse.move(820, 560, steps=4); await gm.mouse.up(button='right')
            await gm.keyboard.press('q'); await gm.keyboard.press('e')
            await view(gm, 25, 10, 95, 60)
            # single clicks: on a thing, on a floor, on open ground; a marquee; F to frame
            for (x, z, y) in ((12, 12, 1), (40, 10, 0), (95, 45, 0)):
                s = await scr(gm, x, z, y); await gm.mouse.click(s['x'], s['y']); await gm.wait_for_timeout(450)  # (slower than a double-click)
            await gm.evaluate("tw.select('tok_mira00001')"); await gm.keyboard.press('f'); await gm.evaluate("tw.select([])"); await view(gm, 25, 10, 95, 60)
            # the player moves their own pawn up a floor and back; the player builds nothing but the GM gets a room from a seat that is not them
            await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 12, z: 12, y: 10 })"); await gm.wait_for_timeout(350)
            await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 12, z: 12, y: 0 })"); await gm.wait_for_timeout(350)
            # a build tool picked and put away (no level stepped)
            await gm.evaluate("tw.modes.roomTool('guest', { tool: true })"); await gm.wait_for_timeout(150); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
            # undo / redo
            await gm.evaluate("tw.undo()"); await gm.wait_for_timeout(250); await gm.evaluate("tw.redo()"); await gm.wait_for_timeout(250)
            now = await gm.evaluate(STATE)
            check(now['cut'] == base['cut'] and now['pinned'] == base['pinned'] and now['writes'] == base['writes'], f'{name}: after moving and raising pawns across floors, selecting, zooming all the way out, panning, rotating, clicking, framing, another seat\'s pawn changing floor, picking a tool, undo and redo, the cut is untouched (no write at all)', f"{base['cut']}/{base['pinned']} -> {now['cut']}/{now['pinned']}, writes {base['writes']} -> {now['writes']} (last by {now['last']})")
        # another seat builds a room upstairs while the GM is cut at lv 1: it arrives hidden, the cut does not move
        await gm.evaluate("tw.setCut(9, { pinned: false, by: 'test' })")
        seat = await gm.evaluate("tw.createSeat({ kind: 'llm', name: 'Builder', scope: { areas: '*', classes: ['room', 'object'] } })")
        base = await gm.evaluate(STATE)
        relay = urllib.parse.unquote(page.split('relay=')[1].split('&')[0]) if 'relay=' in page else None
        if relay and seat:
            cid = await gm.evaluate('tw.sync.campaign.id'); area = await gm.evaluate('tw.area()')
            q = urllib.parse.urlencode({'cmd': 'room.spawn', 'type': 'guest', 'x': 40, 'z': 0, 'w': 20, 'd': 20, 'y': 10, 'seed': 7, 'seat': seat, 'nonce': f'n{random.randrange(10**9)}'})
            try: ans = json.loads(urllib.request.urlopen(urllib.request.Request(f'{relay}/c/{cid}/a/{area}/do?{q}', headers={'User-Agent': 'tw-test'}), timeout=20).read())
            except Exception as e: ans = {'error': str(e)}
            got = await wait(gm, "Object.values(tw.entities()).filter(e => e.kind === 'room' && e.recipe.y === 10).length === 3", 15000, "the AI seat's upper room")
            await settle(gm); now = await gm.evaluate(STATE); r = await gm.evaluate(REPORT)
            nid = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.y === 10 && e.recipe.x === 8)?.id")
            check(got and now['cut'] == 9 and now['writes'] == base['writes'] and nid in r['gone'], 'an AI seat builds a room upstairs over GET while the GM is cut at lv 1: the cut does not move and the new room stays out of sight', str(ans)[:120] if not got else '')
        else: check(False, 'AI seat room over GET (no relay address / seat)')

        # A PICTURE TAKEN WHILE THE CUT MOVES (2026-10-06, seen on live: ground-floor walls clickable at lv -1). The area's
        # thumbnail lifts the cut for one frame; a cut set in that frame must be the one that is put back.
        race = await gm.evaluate("""(async () => { const w = tw.worldOf(tw.area()), W = (ms) => new Promise(r => setTimeout(r, ms)), out = [];
          for (const [a, b] of [[9, -1], [-1, 19], [19, null], [null, 9]]) {
            a == null ? tw.cutOff('test') : tw.setCut(a, { pinned: true, by: 'test' }); await W(300);
            const p = tw.thumbs.render(tw.area()); await W(0);
            b == null ? tw.cutOff('test') : tw.setCut(b, { pinned: true, by: 'test' }); await p; await W(300);
            const bad = [...w.shell.values()].filter(s => s.group.visible && s.group.userData.edgeKey && tw.cutHides(tw.ent('wall:' + s.group.userData.edgeKey))).length;
            out.push({ from: a, to: b, world: w.cut ?? null, app: tw.cut.y ?? null, bad, shot: tw.thumbs.lastShot?.cut ?? null }); }
          return out; })()""")
        check(all(r['world'] == r['app'] == r['to'] and r['bad'] == 0 and r['shot'] is None for r in race), 'a picture of the area taken in the very frame the cut moves: the view lands on the new level (nothing of the old one is left drawn or clickable), and the picture still shows every level', str(race))

        # ================= CLICKS =================
        print('CLICKS: hidden levels never catch a click; everything on screen is touchable, per visible level')
        await gm.evaluate("tw.select([])")
        for (name, cut, focus) in (('cut off', None, (25, 10, 95)), ('lv 2', 19, (25, 10, 95)), ('lv 1', 9, (25, 10, 80)), ('lv -1', -1, (10, 10, 60))):
            await gm.evaluate(f"tw.setCut({json.dumps(cut)}, {{ pinned: true, by: 'test' }})"); await view(gm, focus[0], focus[1], focus[2], 60); await gm.wait_for_timeout(500)
            pk = await gm.evaluate(PICKS)
            check(pk['n'] == 2560 and pk['hit'] > 300 and pk['nbad'] == 0, f'{name}: 2,560 picks across the screen, none resolves to anything on a hidden level', f"{pk['hit']} hits, {pk['nbad']} bad {pk['bad']}")
            au = await gm.evaluate(AUDIT)
            check(au['tested'] > 60 and au['nbad'] == 0, f'{name}: everything on screen is touchable', f"{au['tested']} points, {au['nbad']} untouchable {json.dumps(au['bad'][:4]) if au['nbad'] else ''}")
        # 200 real clicks at lv 1 and 200 at lv -1: whatever gets selected is on a visible level; hover likewise
        rnd = random.Random(7)
        for (name, cut, focus) in (('lv 1', 9, (25, 10, 80)), ('lv -1', -1, (12, 10, 55))):
            await gm.evaluate(f"tw.setCut({json.dumps(cut)}, {{ pinned: true, by: 'test' }})"); await view(gm, focus[0], focus[1], focus[2], 62); await gm.wait_for_timeout(300)
            bad = []; picked = 0; base = await gm.evaluate(STATE)
            for i in range(200):
                x, y = rnd.uniform(150, 1250), rnd.uniform(120, 800)
                await gm.mouse.move(x, y); await gm.mouse.click(x, y)
                if i % 10 == 9:
                    got = await gm.evaluate("(() => { const out = [...tw.sel].map(id => tw.ent(id)).filter(Boolean); const h = tw.hover && tw.ent(tw.hover); return { sel: out.map(e => [e.id, tw.cutHides(e)]), hover: h ? [h.id, tw.cutHides(h)] : null, ring: !document.getElementById('ring').hidden }; })()")
                    picked += len(got['sel'])
                    bad += [s for s in got['sel'] if s[1]] + ([got['hover']] if got['hover'] and got['hover'][1] else [])
                await gm.wait_for_timeout(260 if i % 2 else 30)  # some pairs land as double-clicks: those may set the cut, never select the hidden
            after_sel = await gm.evaluate("[...tw.sel].map(id => tw.ent(id)).filter(e => e && tw.cutHides(e)).length")
            check(not bad and after_sel == 0, f'{name}: 200 real clicks select and hover only what is visible', f'{picked} selections sampled, bad {bad[:3]}')
            await gm.keyboard.press('Escape'); await gm.evaluate("tw.select([])")
        # a selected thing that the cut then hides is deselected
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); tid = up_things[0]
        await gm.evaluate(f"tw.select('{tid}')"); await gm.evaluate("tw.setCut(9, { by: 'test' })"); await gm.wait_for_timeout(200)
        check(await gm.evaluate("tw.sel.size") == 0 and await gm.evaluate("document.getElementById('ring').hidden"), 'a selected thing that the cut then hides is deselected (its ring goes)')
        await gm.evaluate(f"tw.select('{tid}')")
        check(await gm.evaluate("tw.sel.size") == 0, 'and nothing on a hidden level can be selected by any route')
        # a thing dropped where an upper floor is hidden lands on the floor you can see
        g = await gm.evaluate("(() => { const s = tw.screenOf(7.5, 12.5, tw.main, 0); const p = tw.groundAt(s.x, s.y); return p && { y: p.y, room: p.room }; })()")
        check(g and g['y'] == 0 and g['room'] == R['common'], 'the floor under the pointer is the floor you can see (the ground floor, not the hidden upper floor over it)', str(g))
        # select-all and a marquee leave the hidden level alone
        await view(gm, 25, 10, 95, 60); await gm.mouse.move(60, 110); await gm.mouse.down(); await gm.mouse.move(1340, 850, steps=6); await gm.mouse.up(); await gm.wait_for_timeout(250)
        mq = await gm.evaluate("[...tw.sel].map(id => tw.ent(id)).filter(e => e && tw.cutHides(e)).length")
        n_sel = await gm.evaluate("tw.sel.size")
        check(mq == 0 and n_sel > 5, 'a marquee over the whole inn takes nothing from the hidden upper floor', f'{n_sel} selected')
        await gm.evaluate("tw.select([])")

        # ================= LAMPS =================
        print('LAMPS: lamps belong to their room; rooms not visible have theirs switched off')
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(300)
        lit = await gm.evaluate(f"(() => {{ const E = Object.values(tw.entities()), w = tw.worldOf(tw.area()); const all = E.filter(e => e.kind === 'object' && e.lit !== false && w.recs.get(e.id)?.it); const by = (rid) => all.filter(e => e.room === rid).length; return {{ all: all.length, up: by('{R['up1']}') + by('{R['up2']}') + Object.values(tw.entities()).filter(r => r.kind === 'room' && r.recipe.y === 10 && r.recipe.x === 8).reduce((n, r) => n + by(r.id), 0), common: by('{R['common']}'), kitchen: by('{R['kitchen']}'), cellar: by('{R['cellar']}'), covered: w.cutReport().covered, lit: w.litCount() }}; }})()")
        check(R['cellar'] in lit['covered'] and R['common'] in lit['covered'], 'cut off: the cellar (under the ground) and the common room (wholly under the upper floor) count as not visible', str(lit['covered'])[:120])
        r1 = await at(9); r2 = await at(-1); r3 = await at(None)
        check(r1['lit'] < lit['all'] and r1['lit'] <= lit['all'] - lit['up'], 'cut at lv 1: every lamp upstairs is off', f"{lit['all']} lit things in all, {lit['up']} upstairs; switched on: all levels {r3['lit']}, lv 1 {r1['lit']}, lv -1 {r2['lit']}")
        check(r2['lit'] == lit['cellar'], 'cut at lv -1: only the cellar\'s lamps are on', f"{r2['lit']} on, the cellar has {lit['cellar']}")
        check(r3['lit'] <= lit['all'] - lit['cellar'], 'all levels: lamps under a floor (the cellar, a room wholly under the storey above) are off', f"{r3['lit']} on")

        # ================= OFFERS =================
        print('OFFERS: "Cut to lv N"; roofs on the meter')
        offers = lambda pg: pg.evaluate("tw.condButtons.list().filter(b => b.key === 'cut-offer' || b.key === 'roofs-on')")
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await pl.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(1200)
        # the PLAYER's pawn changes floor (moved by the GM): the player is offered it, and the view does not move by itself
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_goblin0001', x: 40, z: 12, y: 0 })"); await gm.wait_for_timeout(300)
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 12, z: 12, y: 10 })")
        await wait(pl, "tw.condButtons.has('cut-offer')", 6000, 'the offer')
        po = await offers(pl); go = await offers(gm); pst = await pl.evaluate(STATE)
        check(len(po) == 1 and po[0]['text'] == 'Cut to lv 2' and po[0]['docked'] == 'bottom' and pst['cut'] is None, "the player's pawn goes up a floor: the player is offered \"Cut to lv 2\" in its fixed slot, and their view has not moved", str(po))
        check(len(go) == 1 and go[0]['text'] == 'Cut to lv 2', 'the GM moved it, so the GM is offered it too (the last pawn the GM moved)', str(go))
        foc = await pl.evaluate("(() => { const b = document.querySelector('.cbtn.cutoffer'); return { tab: b.tabIndex, active: document.activeElement === b }; })()")
        check(foc['tab'] == -1 and not foc['active'], 'the offer never takes the keyboard focus')
        # an NPC changes floor, moved by the GM: the player gets nothing new (the old offer is still theirs); the GM's is replaced
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_goblin0001', x: 40, z: 12, y: -10 })"); await gm.wait_for_timeout(700)
        go = await offers(gm); po = await offers(pl)
        check(len(go) == 1 and go[0]['data']['token'] == 'tok_goblin0001', 'only ONE cut offer at a time: a second pawn changing floor replaces it', str(go))
        check(len(po) == 1 and po[0]['data']['token'] == 'tok_mira00001', 'a pawn that is not theirs brings the player nothing', str(po))
        # the player moves their own pawn back down: the GM (who did not move it) is offered nothing for it
        await gm.evaluate("tw.condButtons.hide('cut-offer')")
        await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 12, z: 12, y: 0 })"); await gm.wait_for_timeout(900)
        check(len(await offers(gm)) == 0, 'a pawn moved by someone else brings the GM no offer')
        po = await offers(pl)
        check(len(po) == 1 and po[0]['text'] == 'Cut to lv 1', 'the player, back on the ground floor, is offered "Cut to lv 1"', str(po))
        # press it: the cut goes there (not pinned); and it is gone
        await pl.click('.cbtn.cutoffer'); await pl.wait_for_timeout(400); pst = await pl.evaluate(STATE)
        check(pst['cut'] == 9 and pst['level'] == 0 and pst['last'] == 'offer', 'pressing it goes to that level (cut at 9 ft)', str(pst))
        await pl.wait_for_timeout(1200); check(len(await offers(pl)) == 0, 'and the button goes')
        # moving within the floor, or raising within the room, offers nothing
        await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 20, z: 14, y: 0 })"); await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 20, z: 14, y: 3 })"); await pl.wait_for_timeout(700)
        check(len(await offers(pl)) == 0, 'moving about on the same floor (or flying 3 ft up inside the room) offers nothing')
        # it fades after a few seconds
        await pl.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 12, z: 12, y: 10 })"); await wait(pl, "tw.condButtons.has('cut-offer')", 5000)
        t0 = time.time(); await wait(pl, "!tw.condButtons.has('cut-offer')", 12000, 'fade'); life = time.time() - t0
        check(5 < life < 9 and (await pl.evaluate(STATE))['cut'] == 9, 'unpressed, the offer fades after about 6 s, and the view stayed where it was', f'{life:.1f} s')
        # ROOFS (Harry 2026-10-06: "Roofs on doesn't get a chat line, it doesn't even get a conditional"): zooming offers
        # nothing; roofs live at the top of the level meter, above the highest level
        await view(gm, 25, 10, 95, 60); await gm.wait_for_timeout(300); base = await gm.evaluate(STATE)
        await gm.evaluate("(() => { const g = tw.main.grab; g.dist = g.maxDist; g.update(); })()"); await gm.wait_for_timeout(900)
        now = await gm.evaluate(STATE)
        check(not await offers(gm) and not await gm.evaluate("!!document.querySelector('.cbtn.roofson')") and now['writes'] == base['writes'] and not await gm.evaluate('tw.roofs'), 'zoomed all the way out: no "Roofs on" button any more, and zooming changed nothing by itself')
        await view(gm, 25, 10, 95, 60); await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(400); b = await gm.evaluate("tw.cutBar()")
        check(b['roof'] and not b['roof']['on'] and b['roof']['at'][1] < b['cap']['at'][1] < b['notches'][0]['at'][1], 'the roofs position is the very top of the meter, above "all levels" and the highest level', str(b['roof']))
        await gm.mouse.click(8, b['roof']['at'][1]); await gm.mouse.move(700, 400); await gm.wait_for_timeout(500); now = await gm.evaluate(STATE); b = await gm.evaluate("tw.cutBar()")
        check(await gm.evaluate('tw.roofs') is True and now['cut'] is None and now['level'] == 0 and b['roof']['on'] and now['last'] == 'meter', 'a click on it puts the roofs on with all levels showing; the level you are on stays', str(now))
        await gm.mouse.click(8, b['roof']['at'][1]); await gm.mouse.move(700, 400); await gm.wait_for_timeout(500); now = await gm.evaluate(STATE)
        check(await gm.evaluate('tw.roofs') is False and now['cut'] == 9, 'a click again takes them off and puts the view back on the level it was cut to', str(now))
        await gm.evaluate("tw.goLevel(tw.levelRange().hiY, 'test')"); await gm.keyboard.press(']'); await gm.wait_for_timeout(400); now = await gm.evaluate(STATE)
        up = await gm.evaluate('tw.roofs'); await gm.keyboard.press('['); await gm.wait_for_timeout(400); dn = await gm.evaluate(STATE)
        check(up is True and now['cut'] is None and now['level'] == 50 and await gm.evaluate('tw.roofs') is False and dn['level'] == 50 and dn['cut'] == 59, '] past the top of the meter shows the roofs; [ from there hides them (the level does not move)', f"{now} {dn}")
        await gm.evaluate("tw.registry.run('view.roofsOn')"); await gm.wait_for_timeout(300); on = await gm.evaluate('tw.roofs')
        await gm.evaluate("tw.registry.run('view.roofsOff')"); await gm.wait_for_timeout(300)
        check(on is True and await gm.evaluate('tw.roofs') is False, '"Roofs on" and "Roofs off" are still in the command bar')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(300)

        # ================= NO DEPTH LOOK (dropped 2026-10-11: Harry, "The 'poor focus' on lower levels is not really working out") =================
        print('SHARP: nothing is blurred or dimmed below the level in view')
        d = {}
        for (name, cut) in (('off', None), ('lv2', 19), ('lv1', 9), ('cellar', -1)):
            await gm.evaluate(f"tw.setCut({json.dumps(cut)}, {{ by: 'test' }})"); await gm.wait_for_timeout(300)
            d[name] = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return { passes: w.fx.stats().post_passes, depth: 'depth' in w.fx, focus: 'depthFocus' in tw, keys: Object.keys(w.fx.stats()).filter(k => k.startsWith('depth')) }; })()")
        check(len({v['passes'] for v in d.values()}) == 1 and isinstance(d['lv2']['passes'], int), 'the post stack is the same at every cut: looking down from lv 2 adds no pass', str({k: v['passes'] for k, v in d.items()}))
        check(not any(v['depth'] or v['focus'] or v['keys'] for v in d.values()), 'the depth look is gone from the effects stack and the game (no fx.depth, no tw.depthFocus, no depth numbers)', str(d['lv2']))

        # ================= SECRETS =================
        print('SECRETS: a hidden upper room leaves no trace for the player at any cut')
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await pl.evaluate("tw.setCut(null, { by: 'test' })")
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{R['up1']}', '{R['up2']}'], hidden: true }})")
        extra = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room' && e.recipe.y === 10 && e.recipe.x === 8).map(e => e.id)")
        if extra: await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: {json.dumps(extra)}, hidden: true }})")
        await wait(pl, "!Object.values(tw.entities()).some(e => e.kind === 'room' && e.recipe.y === 10)", 8000, 'upper rooms gone for the player'); await pl.wait_for_timeout(500)
        lv = await pl.evaluate("JSON.stringify(tw.cutLevels().map(l => l.label))")
        check(lv == '["lv -1","lv 1"]', "the player's level list has no lv 2 (it is worked out from what the seat was sent)", lv)
        seen = []
        for cut in (None, 19, 9, -1):
            await pl.evaluate(f"tw.setCut({json.dumps(cut)}, {{ by: 'test' }})"); await pl.wait_for_timeout(250)
            seen.append(await pl.evaluate("(() => { const w = tw.worldOf(tw.area()); return { pieces: [...w.shell.values()].filter(s => s.group.position.y > 5).length, things: Object.values(tw.entities()).filter(e => e.kind === 'object' && (e.y || 0) >= 10).length, labels: tw.labelInfo().length, bar: tw.cutBar().textShown }; })()"))
        check(all(s['pieces'] == 0 and s['things'] == 0 for s in seen) and not any('lv 2' in s['bar'] and 'hidden' in s['bar'] for s in seen), 'at every cut the player draws nothing of the hidden storey, and the indicator never counts it', str([(s['pieces'], s['bar']) for s in seen]))
        await pl.evaluate("tw.goLevel(0, 'test')"); await pl.keyboard.press(']'); await pl.wait_for_timeout(350)
        pst = await pl.evaluate("(() => { const m = tw.meter(), w = tw.worldOf(tw.area()); return { level: tw.level, built: m.levels.filter(l => l.rooms).map(l => l.y), pieces: [...w.shell.values()].filter(s => s.group.visible && s.group.position.y > 5).length, text: tw.cutBar().textShown }; })()")
        check(pst['level'] == 10 and 10 not in pst['built'] and pst['pieces'] == 0 and 'hidden' not in pst['text'], 'the player can step up to lv 2 like any empty level: the meter marks nothing built there and nothing of it is drawn', str(pst))
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{R['up1']}', '{R['up2']}'], hidden: false }})"); await wait(pl, f"tw.entities()['{R['up1']}']", 8000)

        # ================= RELOAD =================
        print('RELOAD: the cut and its indicator come back as they were')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(200)
        await gm.reload(); check(await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.cutBar', 45000), 'GM tab back after a reload'); await gm.wait_for_timeout(2500)
        st = await gm.evaluate(STATE); b = await gm.evaluate("tw.cutBar()"); r = await gm.evaluate(REPORT)
        check(st['cut'] == 9 and st['level'] == 0 and b['on'] and b['marker']['text'] == '1' and 'lv 1' in b['textShown'] and set(r['gone']) >= {R['up1'], R['up2']}, 'after a reload you are still on lv 1 with the view cut to it, the meter says so and the upper rooms are not drawn', f"{st} | {b['textShown']}")
        check(st['writes'] == 0, 'and that was remembered, not re-decided (no write since the reload)')
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.cutBar', 45000); await gm.wait_for_timeout(1500)
        check((await gm.evaluate(STATE))['cut'] is None and not (await gm.evaluate("tw.cutBar()"))['on'], 'left at all levels, it reloads at all levels')
        real = [e for e in errors if 'WebSocket' not in e and 'ERR_CONNECTION' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

async def shots(gm, R, browser):
    """full-look screenshots at table distance for a blind read (the lead's four views)"""
    await gm.wait_for_timeout(4000); await settle(gm)
    await gm.evaluate("document.body.classList.add('shooting')")
    for (name, cut, pose) in (('lv2', 19, (22, 12, 78, 56, -25)), ('lv1', 9, (25, 12, 78, 56, -25)), ('cellar', -1, (10, 12, 55, 58, -25)), ('all', None, (22, 12, 85, 52, -25))):
        await gm.evaluate(f"{json.dumps(cut)} == null ? (tw.goLevel(0, 'test'), tw.cutOff('test')) : tw.goLevel({json.dumps(cut)} - 9, 'test')"); await view(gm, pose[0], pose[1], pose[2], pose[3], pose[4]); await gm.wait_for_timeout(2500)
        await gm.screenshot(path=os.path.join(SHOTS, f'cut-{name}.png'))
        if name == 'lv2':  # the meter under the pointer (wide, labels showing), and the Build tray open beside it
            await gm.mouse.move(6, 500); await gm.wait_for_timeout(500); await gm.screenshot(path=os.path.join(SHOTS, 'meter-hover.png'))
            await gm.mouse.move(900, 500); await gm.keyboard.press('b'); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(SHOTS, 'meter-tray.png')); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(400)
        print('shot', name, await gm.evaluate("JSON.stringify({ cut: tw.cut.y, bar: tw.cutBar().textShown })"))
    await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)  # (/tmp is RAM: a suite removes what it made)
bad = [r for r in results if not r[0]]
print(f"\ncut: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
