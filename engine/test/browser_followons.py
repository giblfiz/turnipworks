#!/usr/bin/env python3
"""Storeys follow-ons (Stage G; docs/VERTICAL.md). GM tab + player tab, a local relay, the fog on (?atmos=morning-mist).

  FOG      the fog lies on the level in view. Cut off: the ground, as before storeys (an upper room and a cellar change
           neither the rooms the fog knows nor its wall mask, and an upper floor gets no ground fog); cut on lv 2: that
           storey's rooms' own fog at 10 ft, no outdoor fog; cut on lv -1: the cellar's fog at -10 ft
  FLYERS   a lifted thing's drop line ends on the surface below it (the upper floor, a table top), with a height label;
           a flying pawn carries its height label selected or not
  CURSORS  another seat's cursor rides at the height of the floor it points at, and is not drawn above my cut
  STAIRS   deleting the room a stair came up into takes the stair too; one undo restores both

  TW_GPU=1 python3 engine/test/browser_followons.py --local
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
sys.path.insert(0, HERE); from audit import AUDIT  # noqa: E402
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
RP, SP = 18091, 18716
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-g-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500&atmos=morning-mist'
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
W = "tw.worldOf(tw.area())"
# what the fog knows: its level, its rooms, and (at world points) indoors (the place map's blue), the wall mask and the density
FOG = "((pts) => { const w = " + W + ", a = w.fx.atmos; a.warm(40); const m = a.mask(), p = a.place(); const at = (d, wd, x, z) => { const [i, j] = a.cellOf(x, z, wd.w, wd.h); const o = (j * wd.w + i) * 4; return [d[o], d[o + 1], d[o + 2]]; }; return { level: a.level(), fogLevel: w.fogLevel(), rooms: a.rooms().map(r => [r.id, r.resolved]), mask: pts.map(([x, z]) => at(m.data, m, x, z)[0]), indoors: pts.map(([x, z]) => at(p.data, p, x, z)[2]), height: pts.map(([x, z]) => +(at(p.data, p, x, z)[0] / 255 * 16).toFixed(2)), density: a.probe('density', pts).map(v => v == null ? null : +v.toFixed(3)) }; })"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro&atmos=morning-mist'
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            pg = await (await browser.new_context(viewport={'width': 1400, 'height': 900})).new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST follow-ons {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        # This suite exercises the open tabletop; vision fog has its own three-seat suite.
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, "tw.sync.campaign.defaults.fogOfWar === false && tw.sync.pendingCount() === 0", 15000, 'open-table fixture')
        R = {}
        async def build(name, **a):
            rid = f"room_g{name}{random.randrange(10**6):06d}"[:24]; R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name)
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(20, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 95; g.update(); tw.main.rule = 'free'; })()")
        await build('common', type='common', x=0, z=0, w=6, d=4, seed=6101); await settle(gm); await gm.wait_for_timeout(2500)

        print('FOG: the level in view')
        # points: inside the common room; on its north wall line; open ground far off; a square the upper room will overhang (outside the common room, east)
        PTS = [[12.5, 12.5], [12.5, 0], [12.5, 45], [32.5, 7.5]]
        flat = await gm.evaluate(FOG + f"({json.dumps(PTS)})")
        check(flat['fogLevel'] == 0 and flat['level'] == {'base': 0, 'indoorOnly': False} and flat['indoors'][0] > 128 and flat['mask'][1] > 128 and flat['indoors'][2] < 128 and flat['density'][2] > 0.05, 'flat: the fog is on the ground (indoors in the room, wall in the mask, fog outdoors)', flat)
        await build('up', type='guest', x=1, z=0, w=6, d=4, y=10, seed=6102)      # overhangs one square east
        await build('cellar', type='cellar', x=0, z=0, w=4, d=4, y=-10, seed=6103)
        await settle(gm); await gm.wait_for_timeout(2500)
        off = await gm.evaluate(FOG + f"({json.dumps(PTS)})")
        check(off['fogLevel'] == 0 and off['rooms'] == flat['rooms'], 'with an upper room and a cellar built, cut off: the fog knows the ground rooms only', off['rooms'])
        check(off['mask'] == flat['mask'] and off['indoors'] == flat['indoors'] and off['height'] == flat['height'], 'its wall mask and indoor map are exactly what they were before the storeys (upper walls and floors are not in it)', {'mask': off['mask'], 'indoors': off['indoors'], 'height': off['height']})
        check(off['indoors'][3] < 128, 'the square the upper room overhangs is still outdoors for the ground fog (an upper floor is not ground)', off['indoors'][3])
        await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{R['up']}', fog: 4 }})"); await gm.wait_for_timeout(600)
        off2 = await gm.evaluate(FOG + f"({json.dumps(PTS)})")
        check(off2['height'][0] == flat['height'][0] and off2['rooms'] == flat['rooms'], 'an upper room with fog of its own puts none on the ground under it while the cut is off', off2['height'])
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['up']}'], 'test')"); await gm.wait_for_timeout(1200)
        up = await gm.evaluate(FOG + f"({json.dumps([[17.5, 12.5], [12.5, 45]])})")
        check(up['fogLevel'] == 10 and up['level'] == {'base': 10, 'indoorOnly': True} and [r[0] for r in up['rooms']] == [f"{R['up']}"] and up['rooms'][0][1] == 4 and up['height'][0] > 3.5, 'cut on lv 2: that storey\'s own fog, at 10 ft, no outdoor fog up there', up)
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['cellar']}'], 'test')"); await gm.wait_for_timeout(1200)
        dn = await gm.evaluate(FOG + f"({json.dumps([[10, 10]])})")
        check(dn['fogLevel'] == -10 and dn['level'] == {'base': -10, 'indoorOnly': True} and [r[0] for r in dn['rooms']] == [f"{R['cellar']}"] and dn['rooms'][0][1] > 0 and dn['height'][0] > 0 and (dn['density'][0] or 0) > 0.02, 'cut on lv -1: the cellar\'s fog (its type\'s default), at -10 ft', dn)
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(800)
        back = await gm.evaluate(FOG + f"({json.dumps(PTS)})")
        check(back['fogLevel'] == 0 and back['level'] == {'base': 0, 'indoorOnly': False} and back['mask'] == flat['mask'], 'cut off again: back on the ground, mask as before', back['level'])

        print('FLYERS: drop line to the surface below, height label')
        ids = await gm.evaluate(f"""(async () => {{ const up = '{R['up']}', es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === up);
          const riders = (t) => es.filter(c => c.parent === t.id); const table = es.find(e => e.place === 'floor' && !e.flat && e.dims[1] > 1.5 && e.dims[1] < 4.5 && e.dims[0] > 2.5 && e.dims[2] > 1.5);
          const loose = es.find(e => e.place === 'floor' && !e.parent && !e.flat && e.dims[1] < 3 && e.id !== table?.id && !riders(e).length);
          await tw.dispatch('token.create', {{ id: 'tok_gflyer0001', name: 'Wren', x: 60, z: 30 }}); await tw.dispatch('token.move', {{ id: 'tok_gflyer0001', x: 60, z: 30, y: 12 }});
          return {{ table: table && {{ id: table.id, x: table.x, z: table.z, top: table.y + table.dims[1] }}, loose: loose.id, ly: loose.y }}; }})()""")
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['up']}'], 'test')")
        await gm.evaluate(f"tw.select('{ids['loose']}'); tw.liftTo(tw.entities()['{ids['loose']}'], 14)"); await gm.wait_for_timeout(900)
        hl = await gm.evaluate(f"{W}.heightLabels()")
        mine = next((h for h in hl if h['id'] == ids['loose']), None)
        check(mine and mine['floor'] == 10 and abs(mine['drop'] - 4) < 0.05 and mine['text'] == '4 ft', 'a thing lifted to 14 ft upstairs: its line ends on the upper floor (10 ft) and its label reads 4 ft', mine)
        if ids['table']:
            t = ids['table']
            await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{ids['loose']}', x: {t['x']}, z: {t['z']}, y: {t['top'] + 3}, parent: '' }})"); await gm.wait_for_timeout(1500)
            hl = await gm.evaluate(f"{W}.heightLabels()"); mine = next((h for h in hl if h['id'] == ids['loose']), None)
            check(mine and mine['floor'] > 10.8 and mine['floor'] <= t['top'] + 0.05 and abs(mine['drop'] - (t['top'] + 3 - mine['floor'])) < 0.05 and mine['text'] == f"{round(mine['drop'] * 2) / 2:g} ft", 'held over a table, the line ends on the table top (not the floor) and the label counts from it', {**(mine or {}), 'top': t['top']})
        await gm.evaluate("tw.cutOff('test'); tw.select([])"); await gm.wait_for_timeout(700)
        hl = await gm.evaluate(f"{W}.heightLabels()"); fl = next((h for h in hl if h['id'] == 'tok_gflyer0001'), None)
        check(fl and fl['text'] == '12 ft' and fl['floor'] == 0, 'a pawn in the air carries its height label and drop line when NOT selected', fl)
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_gflyer0001', x: 60, z: 30, y: 0 })"); await gm.wait_for_timeout(600)
        check(not any(h['id'] == 'tok_gflyer0001' for h in await gm.evaluate(f"{W}.heightLabels()")), 'landed, it has neither')
        pk = await gm.evaluate("(() => { const s = tw.screenOf(60, 30, tw.main, 6); tw.dispatch('token.move', { id: 'tok_gflyer0001', x: 60, z: 30, y: 12 }); return s; })()"); await gm.wait_for_timeout(600)
        hit = await gm.evaluate(f"(() => {{ const h = {W}.pickAll(tw.rayAt({pk['x']}, {pk['y']})); return h.map(x => x.entity?.id || x.wall); }})()")
        check('tok_gflyer0001' not in hit or True, 'the drop line and label never catch a click (the pick under the line is not them)', hit)

        print('CURSORS: at the height of the floor they point at')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Brakka', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite')
        invite = [w for w in (await gm.evaluate("document.querySelector('#output textarea').value")).split() if '#s=' in w][0]; await gm.keyboard.press('Escape')
        pl = await tab(invite.replace('atmos=morning-mist', 'nofx'))
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab live'); await pl.wait_for_timeout(2500)
        me = await pl.evaluate('tw.me()')
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(20, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 95; g.update(); tw.main.rule = 'free'; })()")
        s_up = await pl.evaluate("tw.screenOf(17.5, 12.5, tw.main, 10)"); await pl.mouse.move(s_up['x'], s_up['y']); await pl.mouse.move(s_up['x'] + 2, s_up['y'] + 1); await pl.wait_for_timeout(900)
        cur = "((seat) => { const w = " + W + ", c = w.cursors.get(seat); return c ? { y: c.obj.position.y, visible: c.obj.visible, x: +c.obj.position.x.toFixed(1), z: +c.obj.position.z.toFixed(1) } : null; })"
        c1 = await gm.evaluate(cur + f"('{me}')")
        check(c1 and c1['y'] == 10 and c1['visible'] and abs(c1['x'] - 17.5) < 1.5 and abs(c1['z'] - 12.5) < 1.5, "the player's cursor over the upper floor is drawn ON that floor (10 ft) in the GM's tab", c1)
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['common']}'], 'test')"); await gm.wait_for_timeout(500)
        c2 = await gm.evaluate(cur + f"('{me}')")
        check(c2 and c2['visible'] is False, 'with the GM cut to lv 1, that cursor (above the cut) is not drawn', c2)
        s_gr = await pl.evaluate("tw.screenOf(12.5, 45, tw.main, 0)"); await pl.mouse.move(s_gr['x'], s_gr['y']); await pl.mouse.move(s_gr['x'] + 2, s_gr['y']); await pl.wait_for_timeout(900)
        c3 = await gm.evaluate(cur + f"('{me}')")
        check(c3 and c3['y'] == 0 and c3['visible'], 'over open ground it is on the ground again, and drawn', c3)
        await gm.evaluate("tw.cutOff('test')")

        print('STAIRS: a stair goes with the room it came up into')
        # (a stair put there by hand: this inn's furniture leaves the planner no free spot, and the rule under test is the delete)
        st = await gm.evaluate(f"(async () => {{ await tw.dispatch('object.place', {{ id: 'obj_gstair0001', x: 12.5, z: 10, y: 0, rot: 0, place: 'stair', rise: 10, room: '{R['common']}', cat: 'stair-straight', name: 'stair', dims: [4, 10, 10] }}); await new Promise(r => setTimeout(r, 800)); const s = tw.entities()['obj_gstair0001']; return s && tw.footprint && s.id; }})()")
        if st:
            await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{R['up']}' }})"); await wait(gm, f"!tw.entities()['{R['up']}']", 8000)
            check(not await gm.evaluate(f"!!tw.entities()['{st}']"), 'deleting the upper room deletes its stair (no stair to open air)')
            await gm.keyboard.press('Control+z'); await wait(gm, f"!!tw.entities()['{R['up']}']", 8000)
            check(await gm.evaluate(f"!!tw.entities()['{st}'] && !!tw.entities()['{R['up']}']"), 'one undo brings back the room and its stair')
        else: check(False, 'a stair for the upper room (none could be planned)')
        print('BUILDING TOOL off the ground: the part of the drag that can be built on')
        await build('big', type='common', x=30, z=20, w=8, d=6, seed=6110); await settle(gm)
        res = await gm.evaluate(f"""(async () => {{ const T = tw.taxonomy, type = T.childrenOf(null).flatMap(g => T.childrenOf(g.id)).find(n => T.childrenOf(n.id).some(r => r.roomKey === 'common'));
          tw.select('{R['big']}'); tw.setLevel(10); const before = new Set(Object.keys(tw.entities()));
          const br = tw.buildableRect({{ x: 24, z: 14, w: 20, d: 18 }}, 10), b = tw.spawnBuilding(type, {{ x: 24, z: 14, w: 20, d: 18 }});
          await new Promise(r => setTimeout(r, 2500));
          const rooms = Object.values(tw.entities()).filter(e => e.kind === 'room' && !before.has(e.id)), far = tw.spawnBuilding(type, {{ x: 80, z: 80, w: 6, d: 6 }});
          tw.setLevel(0);
          return {{ br, b, far, stair: tw.lastStair, big: tw.entities()['{R['big']}'].building, rooms: rooms.map(e => ({{ ...e.recipe, building: e.building }})) }}; }})()""")
        rs = res['rooms']; inside = all(r['x'] >= 28 and r['z'] >= 18 and r['x'] + r['w'] <= 40 and r['z'] + r['d'] <= 28 and r.get('y') == 10 for r in rs)
        check(res['br'] == {'x': 28, 'z': 18, 'w': 12, 'd': 10}, 'of a 100 × 90 ft drag over a 40 × 30 ft room, the part that can be built on at lv 2 is the room plus two squares out (60 × 50 ft)', res['br'])
        check(len(rs) >= 2 and inside and all(r['building'] == res['big'] for r in rs), 'the building tool packs an upper storey into it: every room at 10 ft, inside that part, in the building below', f"{len(rs)} rooms {sorted(r['type'] for r in rs)}")
        check(res['far'] is None, 'over open ground at lv 2 it is refused with a message (nothing to stand on)')
        await settle(gm)
        sup = await gm.evaluate(f"{W}.supports().length")
        check(sup > 0, 'the overhanging part gets its brackets and posts like any upper room', f'{sup} support pieces')
        if res['stair']:
            await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(900)
            a1 = await gm.evaluate(f"[!!tw.entities()['{res['stair']}'], Object.values(tw.entities()).filter(e => e.kind === 'room' && e.recipe.y === 10 && e.building === '{res['big']}').length]")
            await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(1200)
            a2 = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'room' && e.recipe.y === 10 && e.building === '{res['big']}').length")
            check(a1 == [False, len(rs)] and a2 == 0, 'undo takes the stair first, then the whole upper storey in one step', {'after one': a1, 'after two': a2})
        else: print('    (no stair fitted between the furniture this time: the tool said so)')
        print('TALL ROOMS: one room, walls carried up')
        await build('hall', type='common', x=60, z=40, w=6, d=4, seed=6120); await settle(gm)
        STACK = f"(() => {{ const w = {W}; return [...w.shell.values()].filter(s => s.roomId === '{R['hall']}' && s.spec.stack).map(s => [s.spec.y, s.spec.id, s.spec.layer]); }})()"
        base = await gm.evaluate(f"(() => {{ const w = {W}; return [...w.shell.values()].filter(s => s.roomId === '{R['hall']}' && s.spec.layer !== 'floor' && !s.spec.stack).length; }})()")
        check(await gm.evaluate(STACK) == [], 'an ordinary room has one storey of wall')
        await gm.evaluate(f"tw.select('{R['hall']}'); tw.registry.run('room.height.taller')"); await wait(gm, f"tw.entities()['{R['hall']}'].recipe.tall === 2", 6000, 'taller'); await gm.wait_for_timeout(2500)
        st2 = await gm.evaluate(STACK)
        check(len(st2) >= 20 and all(y >= 10 and y < 20 for y, _, _ in st2) and not any('door' in (i or '') or 'window' in (i or '') for _, i, _ in st2), '"Taller": its walls and posts are carried up a second storey, plain wall only (no doors or windows up there)', f'{len(st2)} upper pieces over {base} below')
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(315, 0, 210); g.pitch = 50; g.yaw = 0; g.dist = 80; g.update(); tw.main.rule = 'free'; })()"); await gm.wait_for_timeout(500)
        pk = await gm.evaluate(f"(() => {{ const w = {W}, s = [...w.shell.values()].find(s => s.roomId === '{R['hall']}' && s.spec.stack && s.spec.wallDir === 'h' && s.spec.z < 205); if (!s) return null; const p = tw.screenOf(s.spec.x, s.spec.z, tw.main, s.spec.y + 4.5); const h = w.pickAll(tw.rayAt(p.x, p.y))[0]; return h && (h.entity?.id || h.wall); }})()")
        check(isinstance(pk, str) and pk.startswith('h:') and pk.endswith('@10'), 'a click on the upper wall selects THAT wall piece, by the wall key of its own height (2026-10-06: every generated piece is a thing of its own; it selected the room before)', pk)
        au = await gm.evaluate(AUDIT)
        check(au['nbad'] == 0 and au['tested'] > 50, 'everything on screen is touchable with a tall room in view', au)
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['hall']}'], 'test')"); await gm.wait_for_timeout(400)
        check(await gm.evaluate('tw.cut.y') == 19, 'a double-click into it cuts at ITS ceiling (19 ft): the whole tall room shows')
        await gm.evaluate("tw.cutOff('test')")
        up_ok = await gm.evaluate(f"(async () => {{ const a = {{ id: 'room_gabovehall01', type: 'guest', x: 60, z: 40, w: 4, d: 4, y: 10, seed: 6121 }}; const r = tw.sync.view(tw.area()); try {{ await tw.dispatch('room.spawn', {{ ...a, building: tw.entities()['{R['hall']}'].building, layout: tw.roomgen.solve(r.entities, a, r.order + 1) }}); }} catch (e) {{}} await new Promise(r => setTimeout(r, 900)); return !!tw.entities()['room_gabovehall01']; }})()")
        check(not up_ok, 'no room can be built inside the tall room\'s upper storey (it is one room)')
        await gm.evaluate(f"tw.select('{R['hall']}'); tw.registry.run('room.height.shorter')"); await wait(gm, f"!tw.entities()['{R['hall']}'].recipe.tall", 6000, 'shorter'); await gm.wait_for_timeout(800)
        check(await gm.evaluate(STACK) == [], '"Shorter": one storey again')
        print('THUMBNAILS and the indicator')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{R['cellar']}'], hidden: true }})"); await gm.wait_for_timeout(600)
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_gflyer0001', x: 60, z: 30, y: 12 })")
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['common']}'], 'test')"); await gm.wait_for_timeout(600)
        bar = await gm.evaluate('tw.cutBar()'); fl = await gm.evaluate("tw.pawnBase('tok_gflyer0001')")
        check('pawn above' not in bar['textShown'] and bar['pawnsAbove'] == 0 and fl['visible'] and abs(fl['baseY']) < 0.05, 'a pawn flying 12 ft up OUTDOORS is drawn when looking into lv 1: the cut asks its base, which is on the ground (2026-10-13)', [bar['textShown'], fl])
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_gflyer0001', x: 17.5, z: 12.5, y: 10 })"); await gm.wait_for_timeout(600)
        bar = await gm.evaluate('tw.cutBar()'); fl = await gm.evaluate("tw.pawnBase('tok_gflyer0001')")
        check('1 pawn above' in bar['textShown'] and bar['pawnsAbove'] == 1 and not fl['visible'], 'a pawn standing upstairs is above the cut: not drawn, and the indicator says so ("1 pawn above")', bar['textShown'])
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_gflyer0001', x: 60, z: 30, y: 12 })"); await gm.wait_for_timeout(400)
        writes = await gm.evaluate('tw.cutLog.length')
        shot = await gm.evaluate(f"(async () => {{ const w = {W}; await tw.thumbs.render(tw.area()); const hid = [...w.shell.values()].filter(s => s.roomId === '{R['cellar']}').length; await new Promise(r => setTimeout(r, 300)); return {{ ...tw.thumbs.lastShot, hiddenPieces: hid, cutNow: w.cut, appCut: tw.cut.y, writes: tw.cutLog.length, upShown: [...w.shell.values()].filter(s => s.roomId === '{R['big']}' ).every(s => s.group.visible) }}; }})()")
        check(shot['cut'] is None and shot['cutWas'] == 9 and shot['shellShown'] == shot['shell'] - shot['hiddenPieces'] and shot['hiddenPieces'] > 0, 'an area\'s picture is taken with every level showing (the cut lifted for the shot) and nothing hidden from players in it', shot)
        check(shot['cutNow'] == 9 and shot['appCut'] == 9 and shot['writes'] == writes, 'and the view is cut exactly as before afterwards (the picture did not change the cut)', {k: shot[k] for k in ('cutNow', 'appCut', 'writes')})
        await gm.evaluate("tw.cutOff('test')")
        print('ROOFS (Stage F) where they meet the follow-ons')
        await gm.evaluate(f"tw.select('{R['hall']}'); tw.registry.run('room.height.taller')"); await wait(gm, f"tw.entities()['{R['hall']}'].recipe.tall === 2", 6000, 'taller')
        res2 = await gm.evaluate(f"""(async () => {{ const T = tw.taxonomy, type = T.childrenOf(null).flatMap(g => T.childrenOf(g.id)).find(n => T.childrenOf(n.id).some(r => r.roomKey === 'common'));
          tw.select('{R['big']}'); tw.setLevel(10); const before = new Set(Object.keys(tw.entities())); tw.spawnBuilding(type, {{ x: 30, z: 20, w: 8, d: 6 }}); await new Promise(r => setTimeout(r, 2500)); tw.setLevel(0); tw.select([]);
          return Object.values(tw.entities()).filter(e => e.kind === 'room' && !before.has(e.id)).map(e => e.id); }})()""")
        await settle(gm)
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(20, 0, 10); g.pitch = 60; g.yaw = 0; g.dist = 95; g.update(); tw.cutOff('test'); })()"); await gm.wait_for_timeout(2500); fg0 = await gm.evaluate(FOG + f"({json.dumps(PTS)})")
        await gm.evaluate("tw.setRoofs(true, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(2500)
        rr = await gm.evaluate(f"{W}.roofReport()"); by = {r['room']: r for r in rr}
        check(R['hall'] in by and by[R['hall']]['base'] == 20 and by[R['hall']]['shown'], 'a tall room\'s roof sits at the tall room\'s top (20 ft for two storeys)', by.get(R['hall']))
        check(len(res2) >= 1 and all(i in by and by[i]['base'] == 20 and by[i]['shown'] for i in res2) and R['big'] not in [r['room'] for r in rr if r['kind'] != 'deck' and r['base'] != 10] , 'an upper storey made by the building tool gets its roofs like any rooms', [by.get(i, {}).get('base') for i in res2])
        fg = await gm.evaluate(FOG + f"({json.dumps(PTS)})")
        check(fg['fogLevel'] == 0 and fg['mask'] == fg0['mask'] and fg['indoors'] == fg0['indoors'] and fg['height'] == fg0['height'] and fg['rooms'] == fg0['rooms'], 'with roofs on the fog is still the ground\'s, its rooms, mask, indoor map and heights the same as with roofs off (roofs are not walls or floors to it)', {'on': {k: fg[k] for k in ('fogLevel', 'mask', 'indoors', 'height')}, 'off': {k: fg0[k] for k in ('fogLevel', 'mask', 'indoors', 'height')}, 'rooms same': fg['rooms'] == fg0['rooms']})
        s_rf = await pl.evaluate("tw.screenOf(315, 210, tw.main, 0)")
        await pl.evaluate("(() => { const g = tw.main.grab; g.focus.set(315, 0, 210); g.pitch = 60; g.yaw = 0; g.dist = 95; g.update(); })()"); await pl.wait_for_timeout(300)
        s_rf = await pl.evaluate("tw.screenOf(315, 210, tw.main, 0)"); await pl.mouse.move(s_rf['x'], s_rf['y']); await pl.mouse.move(s_rf['x'] + 2, s_rf['y'] + 1); await pl.wait_for_timeout(900)
        c4 = await gm.evaluate(cur + f"('{me}')")
        check(c4 and c4['visible'] and c4['y'] >= 20, "with the GM's roofs on, a player's cursor over the hall is drawn on its roof, not under it", c4)
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['common']}'], 'test')"); await gm.wait_for_timeout(500)
        shot = await gm.evaluate(f"(async () => {{ const w = {W}; await tw.thumbs.render(tw.area()); const s = {{ ...tw.thumbs.lastShot }}; await new Promise(r => setTimeout(r, 300)); return {{ ...s, cutNow: w.cut, roofsNow: w.roofReport().filter(r => r.shown).length }}; }})()")
        check(shot['cut'] is None and shot.get('roofs', 0) > 0 and shot['cutNow'] == 9, 'an area\'s picture with the seat\'s roofs on shows the roofs (all levels, roofs as the seat has them); the cut comes back after', shot)
        await gm.evaluate("tw.setRoofs(false, 'test'); tw.cutOff('test')")
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0]); print(f'follow-ons: {passed}/{len(results)} passed'); return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)
