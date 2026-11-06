#!/usr/bin/env python3
"""A player who comes in by their invite can take hold of their own pawn, with the mouse, every time.  (2026-11-05)

  local:  python3 engine/test/browser_invite_pawn.py --local
          (TW_PORTS=relay,web picks the two ports: another worktree may be running this suite)

Why this suite exists: on live (v0.4.1) Harry invited two players into his tavern campaign; the invite put each one's
placeholder pawn on the table, and the players "couldn't select it reliably", worst after a reload (zifnab: he chose a
figure, moved his pawn about, the GM moved it, he reloaded, and could no longer take hold of it). The placeholder
suites (browser_two_tab M7) selected the pawn with tw.select, never with the mouse. Here everything is the mouse, and
every check is a run of real clicks on the pixels where the pawn is drawn (and not covered), counted:
  I1 the GM starts a campaign (fog of war on, as campaigns start), builds a tavern (a ground room, an upper storey over
     part of it) and invites a player: a placeholder pawn, his
  I2 the player opens the link: seated, the camera on his own pawn
  I3 every click on the placeholder selects it; its ring leads with "Set your pawn"; a drag moves it
  I4 he chooses a figure (the pawn editor): an ordinary pawn now, the token and its definition
  I5 he walks it in under the upper storey; the GM moves it a little (as Harry did): every click still selects it
  I6 he RELOADS: every click selects it (Harry's case)
  I7 the GM takes it upstairs (y 10, the upper room): every click selects it; and after another reload
  I8 his portrait in the Pawns menu selects it
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('shift')  # the default: pawns move freely
tw_sandbox.placeholder_pawns(True)  # the game as players get it: the invite places the pawn, the arrival centres on it
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); SHOTS = os.path.join(HERE, 'shots')
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18557,18957').split(','))
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--tries', type=int, default=10)
A = ap.parse_args()

results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)

procs = []
def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-invpawn-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(os.path.dirname(ENGINE), 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); break
        except Exception: pass
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    time.sleep(0.8)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay={urllib.parse.quote(f"http://127.0.0.1:{RP}")}&api=&nofx&boxes&nointro'

async def wait(page, js, timeout=15000, what=''):
    try: await page.wait_for_function(js, timeout=timeout, polling=50); return True
    except Exception: print(f'    (timed out: {what or js})'); return False

async def bar(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(250); await pg.keyboard.press('Enter')

async def output(pg, contains=''):
    await wait(pg, f"!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('{contains}')", 10000, 'output panel')
    v = await pg.evaluate("document.querySelector('#output textarea').value"); await pg.keyboard.press('Escape'); return v

# WHERE THE PAWN SHOWS: a grid over its drawn meshes' screen box; a point counts when the ray from it meets one of the
# pawn's meshes FIRST of everything drawn in the scene (nothing drawn in front: a floor, a wall) and no page element
# lies over it. Those are the points a player can see his pawn at, so a click there must take it. For each it also asks
# the game's own pick (world.pickAll, what a press uses) and says why it went elsewhere.
SAMPLE_JS = """([pid, n]) => { const w = tw.worldOf(tw.area()), r = w.recs.get(pid); if (!r) return { none: 'no record' }; w.settleMatrices(); w.cutPass(); r.group.updateMatrixWorld(true); w.scene.updateMatrixWorld(true);
  const cam = tw.main.camera, c = document.getElementById('c').getBoundingClientRect(), pts = [];
  const vis = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const mine = (o) => { for (let q = o; q; q = q.parent) if (q === r.group) return true; return false; };
  r.group.traverse(o => { if (!o.isMesh || !vis(o)) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox;
    for (const X of [b.min.x, b.max.x]) for (const Y of [b.min.y, b.max.y]) for (const Z of [b.min.z, b.max.z]) { const v = o.localToWorld(cam.position.clone().set(X, Y, Z)).project(cam); if (v.z < 1) pts.push([c.left + (v.x + 1) / 2 * c.width, c.top + (1 - v.y) / 2 * c.height]); } });
  if (!pts.length) return { none: 'nothing drawn' };
  const x0 = Math.max(c.left, Math.min(...pts.map(p => p[0]))), x1 = Math.min(c.right, Math.max(...pts.map(p => p[0]))), y0 = Math.max(c.top, Math.min(...pts.map(p => p[1]))), y1 = Math.min(c.bottom, Math.max(...pts.map(p => p[1])));
  const out = { box: [x0, y0, x1, y1].map(Math.round), shows: 0, ok: 0, miss: 0, covered: 0, why: {}, missAt: [], showPts: [] };
  const opaque = (h) => h.object.isMesh && vis(h.object) && !(h.object instanceof THREE.Sprite) && !h.object.userData.halo && !(h.object.material?.transparent && h.object.material.opacity < 0.5);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / n, y = y0 + (y1 - y0) * (j + 0.5) / n, ray = tw.rayAt(x, y);
    const first = ray.intersectObject(w.scene, true).find(opaque);
    if (!first || !mine(first.object)) continue;
    const el = document.elementFromPoint(x, y); if (el && el.id !== 'c') { out.covered++; continue; }
    out.shows++; out.showPts.push([Math.round(x), Math.round(y)]);
    const pk = w.pickAll(tw.rayAt(x, y)), h = pk[0];
    if (h?.entity?.id === pid) { out.ok++; continue; }
    out.miss++; const k = h ? (h.entity ? h.entity.kind + (h.floor ? '(floor)' : '') : h.roof ? 'roof' : h.wall ? 'wall' : '?') : 'nothing';
    out.why[k] = (out.why[k] || 0) + 1;
    if (out.missAt.length < 3) out.missAt.push({ at: [Math.round(x), Math.round(y)], dist: +first.distance.toFixed(2), stop: +w.floorStop(tw.rayAt(x, y).ray).toFixed(2), near: w.nearRay(tw.rayAt(x, y).ray, r.group), part: Object.keys(first.object.userData).join(',') });
  }
  Object.assign(out, { cut: w.cut, gy: +r.group.position.y.toFixed(2), cutHides: w.cutHides(r.entity), cutHidden: !!r.group.userData.cutHidden, gvis: r.group.visible, loaded: !!r.visual?.userData?.loaded });
  return out; }"""
SAMPLE_JS = SAMPLE_JS.replace('THREE.Sprite', "{ [Symbol.hasInstance]: (o) => !!o?.isSprite }")

async def click_pawn(pg, pid, label, tries=None):
    """real mouse clicks on points where the pawn shows: each must select it"""
    tries = tries or A.tries
    S = await pg.evaluate(SAMPLE_JS, [pid, 14])
    print(f'    [{label}] where it shows:', json.dumps({k: v for k, v in (S or {}).items() if k != 'showPts'}))
    pts = (S or {}).get('showPts') or []
    if not pts: check(False, f'{label}: his pawn shows on the screen', S); return 0
    rnd = random.Random(len(label)); hits = 0; misses = []
    for i in range(tries):
        await pg.keyboard.press('Escape'); await pg.evaluate("tw.select([])"); await pg.wait_for_timeout(100)
        x, y = rnd.choice(pts)
        await pg.mouse.move(x - 30, y + 20); await pg.mouse.move(x, y, steps=4); await pg.wait_for_timeout(rnd.choice([30, 120, 300]))
        await pg.mouse.down(); await pg.wait_for_timeout(rnd.choice([40, 90, 160])); await pg.mouse.up(); await pg.wait_for_timeout(300)
        sel = await pg.evaluate("[...tw.sel]")
        if sel == [pid]: hits += 1
        elif len(misses) < 3: misses.append({'at': [x, y], 'sel': sel, 'press': await pg.evaluate("tw.lastPress?.hits || null")})
    check(hits == tries and S['miss'] == 0, f'{label}: every click on his pawn selects it', f"{hits}/{tries} clicks; the pick misses {S['miss']}/{S['shows']} points where it shows" + (f'; misses {misses}' if misses else ''))
    return hits

async def main():
    page_url = start_local()
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def new_page(url):
            ctx = await browser.new_context(viewport={'width': 1200, 'height': 760})
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' else None)
            await pg.goto(url); return pg
        ready = "window.tw && tw.ready && tw.ready() && tw.loaded && tw.loaded()"
        idle = lambda pg: wait(pg, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000, 'idle')
        ent = lambda pg, pid: pg.evaluate(f"tw.entities()['{pid}'] || null")
        async def look_at(pg, pid, yaw=0.0, dist=55):
            await pg.evaluate(f"(() => {{ const e = tw.entities()['{pid}'], g = tw.main.grab; tw.centreOn({{ x: e.x, y: e.y || 0, z: e.z }}, tw.main, {{ ms: 0 }}); g.yaw += {yaw}; g.dist = {dist}; g.update(); }})()"); await pg.wait_for_timeout(900)

        # ---------- I1 the GM's campaign, a tavern, the invite ----------
        gm = await new_page(page_url)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST invite pawn ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)')
        await gm.click('#newCampaign button')
        check(await wait(gm, ready, 60000, 'gm ready'), 'GM tab live')
        fog = await gm.evaluate("tw.sync.campaign.defaults?.fogOfWar")
        await gm.evaluate("tw.spawnRoom('common', -6, -6, 8, 6, 7501)"); await idle(gm)          # the taproom: x -30..10, z -30..0 ft
        await gm.evaluate("tw.spawnRoom('fine', -6, -6, 4, 6, 7502, undefined, 10)"); await idle(gm)  # the room over its west half: x -30..-10
        await gm.evaluate("tw.settings.setPref('invitePawn', true)")
        await bar(gm, 'invite zifnab')
        link = await output(gm, '#s=')
        ph = await gm.evaluate('tw.lastPlaceholder')
        await wait(gm, f"tw.entities()['{ph['id']}'] && tw.sync.pendingCount() === 0", 8000, 'placeholder on the table')
        pid, seat, did = ph['id'], ph['seat'], ph['def']
        P = await ent(gm, pid)
        check(P and P['placeholder'] and P['owner'] == seat, "the invite put zifnab's placeholder pawn on the table", {'fog': fog, 'at': (P['x'], P['z'])})

        # ---------- I2 the player arrives ----------
        pl = await new_page(link)
        check(await wait(pl, ready, 60000, 'player ready'), 'the player opened the invite link')
        await wait(pl, 'tw.arrival.centred', 8000, 'arrival'); await idle(pl); await pl.wait_for_timeout(800)
        PE = await ent(pl, pid)
        check(await pl.evaluate('tw.me()') == seat and PE and PE.get('owner') == seat and await pl.evaluate(f"tw.canTouch(tw.entities()['{pid}'])"), 'seated as zifnab; his pawn reaches him, his to move')
        await pl.screenshot(path=os.path.join(SHOTS, 'invite-pawn-arrival.png'))

        # ---------- I3 the placeholder: click, ring, drag ----------
        await click_pawn(pl, pid, 'I3 the placeholder')
        await pl.evaluate("tw.select([])"); await click_pawn(pl, pid, 'I3 (again)', tries=1)
        ring = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => [b.dataset.id, b.dataset.tip])")
        check(ring and ring[0] == ['pawn.choose', 'Set your pawn'], 'I3: its ring leads with "Set your pawn"', ring[:2])
        S = await pl.evaluate(SAMPLE_JS, [pid, 10]); pts = S.get('showPts') or []
        if pts:
            x, y = pts[len(pts) // 2]; await pl.keyboard.press('Escape'); await pl.evaluate("tw.select([])")
            await pl.mouse.move(x, y); await pl.mouse.down()
            for i in range(1, 13): await pl.mouse.move(x + 8 * i, y + 2 * i); await pl.wait_for_timeout(30)
            await pl.mouse.up()
        moved = await wait(gm, f"(() => {{ const e = tw.entities()['{pid}']; return Math.hypot(e.x - {P['x']}, e.z - {P['z']}) > 2; }})()", 8000, 'drag reaches the GM')
        check(moved, 'I3: he drags it; it moves for the GM too', (await ent(gm, pid) or {}).get('x'))

        # ---------- I4 he chooses a figure in the pawn editor ----------
        await pl.keyboard.press('Escape'); await pl.evaluate(f"tw.select('{pid}')"); await pl.wait_for_timeout(500)
        await pl.click('#ring .rbtn.prompt'); await pl.wait_for_timeout(800)
        for _ in range(5):
            if await pl.evaluate("!!document.querySelector('#settingsModal .mptree [data-fig]')"): break
            await pl.click('#settingsModal .mptree [data-node]'); await pl.wait_for_timeout(300)
        fig = await pl.evaluate("document.querySelector('#settingsModal .mptree [data-fig]')?.dataset.fig")
        await pl.click('#settingsModal .mptree [data-fig]'); await pl.wait_for_timeout(200)  # applied at once: no Save button (Harry 2026-11-05)
        chosen = f"(() => {{ const e = tw.entities()['{pid}']; return !!e && !e.placeholder && e.fig === '{fig}'; }})()"
        ok_c = await wait(pl, chosen, 8000, 'chosen (player)') and await wait(gm, chosen, 8000, 'chosen (GM)')
        dd = await gm.evaluate(f"tw.sync.campaign.pawns.find(d => d.id === '{did}')")
        check(ok_c and fig and not dd.get('placeholder') and dd.get('fig') == fig, 'I4: he chooses a figure: an ordinary pawn now (its definition too)', fig)
        await pl.keyboard.press('Escape'); await pl.wait_for_timeout(300); await pl.evaluate("tw.settings.close?.()"); await pl.wait_for_timeout(300)
        await idle(pl)

        # ---------- I5 in under the upper storey; the GM nudges it ----------
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{pid}', x: -2.5, z: -12.5 }})")  # the taproom's open (one-storey) east half
        await wait(pl, f"tw.entities()['{pid}']?.x === -2.5", 8000, 'east half'); await look_at(pl, pid, 0, 55)
        S = await pl.evaluate(SAMPLE_JS, [pid, 10]); pts = S.get('showPts') or []
        a = await pl.evaluate(f"tw.screenOf(-22.5, -12.5)")  # the west half: under the upper room
        if pts:
            x, y = pts[len(pts) // 2]; await pl.mouse.move(x, y); await pl.mouse.down()
            for i in range(1, 16): await pl.mouse.move(x + (a['x'] - x) * i / 15, y + (a['y'] - y) * i / 15); await pl.wait_for_timeout(30)
            await pl.mouse.up()
        await wait(gm, f"tw.entities()['{pid}'].x < -10 && tw.sync.pendingCount() === 0", 8000, 'walked under')
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{pid}', x: -20.5, z: -14 }})")  # the GM moves it a little, as Harry did
        ok_u = await wait(pl, f"tw.entities()['{pid}']?.x === -20.5", 8000, 'GM move reaches the player')
        E5 = await ent(pl, pid)
        check(ok_u and not E5.get('placeholder') and E5.get('owner') == seat and not E5.get('y'), 'I5: he walks it in under the upper storey; the GM nudges it (still his, on the ground)', {k: E5.get(k) for k in ('x', 'z', 'y', 'owner')})
        await look_at(pl, pid, 0, 55)
        await click_pawn(pl, pid, 'I5 under the upper storey')
        await pl.screenshot(path=os.path.join(SHOTS, 'invite-pawn-under.png'))

        # ---------- I5b the floor under the pointer there is the ground for him (the storey he has not seen is no floor); the GM's is the upper floor ----------
        # (world.floorPoint, what every drop and tool asks: before 2026-11-05 it answered the undrawn upper floor, at 10 ft)
        fp = "(([x, z, y]) => { const s = tw.screenOf(x, z, tw.main, y), g = tw.groundAt(s.x, s.y); return g && { x: +g[0].toFixed(1), z: +g[1].toFixed(1), y: g.y || 0, room: g.room || null }; })"
        mine = await pl.evaluate(fp, [-22.5, -17.5, 0])
        await gm.evaluate(f"(() => {{ const g = tw.main.grab; tw.centreOn({{ x: -20, y: 0, z: -15 }}, tw.main, {{ ms: 0 }}); g.dist = 55; g.update(); }})()"); await gm.wait_for_timeout(600)
        gms = await gm.evaluate(fp, [-22.5, -17.5, 10])
        check(mine and mine['y'] == 0 and abs(mine['x'] + 22.5) < 0.6 and abs(mine['z'] + 17.5) < 0.6, 'I5b: for him the floor under the pointer there is the taproom\'s, on the ground', mine)
        check(gms and gms['y'] == 10 and gms['room'], "I5b: for the GM it is the upper room's floor, as ever", gms)
        # ---------- I5c he drags his portrait from the Pawns menu to a spot under that storey: it lands on the ground ----------
        await pl.keyboard.press('Escape'); await pl.evaluate("tw.select([])"); await pl.evaluate("tw.pawns.open()"); await pl.wait_for_timeout(600)
        face = f".prow[data-seat='{seat}'] .pface"
        if await pl.locator(face).count():
            src = await pl.evaluate(f"(() => {{ const r = document.querySelector(\"{face}\").getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
            dst = await pl.evaluate("tw.screenOf(-22.5, -17.5, tw.main, 0)")
            await pl.mouse.move(src['x'], src['y']); await pl.mouse.down()
            for i in range(1, 15): await pl.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 14, src['y'] + (dst['y'] - src['y']) * i / 14); await pl.wait_for_timeout(25)
            await pl.wait_for_timeout(200); await pl.mouse.up(); await pl.wait_for_timeout(500)
        landed = await wait(gm, f"(() => {{ const e = tw.entities()['{pid}']; return Math.hypot(e.x + 22.5, e.z + 17.5) < 1.5 && tw.sync.pendingCount() === 0; }})()", 8000, 'seized drop')
        E5c = await ent(gm, pid)
        check(landed and not E5c.get('y'), 'I5c: put down from his portrait under the storey he has not seen, it stands on the ground (not up in that room)', {k: E5c.get(k) for k in ('x', 'z', 'y')})
        await pl.keyboard.press('Escape')

        # ---------- I6 he reloads (Harry's case) ----------
        await pl.reload(); await wait(pl, ready, 60000, 'player again'); await idle(pl); await pl.wait_for_timeout(1500)
        print('    after the reload: cut', await pl.evaluate("tw.cut.y"), 'level', await pl.evaluate("tw.level"))
        await click_pawn(pl, pid, 'I6 after a reload (the camera as it was)')
        await look_at(pl, pid, 0, 55)
        await click_pawn(pl, pid, 'I6 after a reload (on his pawn)')
        await look_at(pl, pid, 1.3, 45)
        await click_pawn(pl, pid, 'I6 after a reload (from the side)')
        await pl.screenshot(path=os.path.join(SHOTS, 'invite-pawn-reload.png'))

        # ---------- I7 upstairs ----------
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{pid}', x: -17.5, z: -17.5, y: 10 }})")
        await wait(pl, f"tw.entities()['{pid}']?.y === 10", 8000, 'upstairs'); await idle(pl); await look_at(pl, pid, 0, 55)
        await click_pawn(pl, pid, 'I7 upstairs')
        await pl.reload(); await wait(pl, ready, 60000, 'player again'); await idle(pl); await pl.wait_for_timeout(1500); await look_at(pl, pid, 0, 55)
        await click_pawn(pl, pid, 'I7 upstairs, after a reload')

        # ---------- I8 the Pawns menu ----------
        await pl.keyboard.press('Escape'); await pl.evaluate("tw.select([])"); await pl.evaluate("tw.pawns.open()"); await pl.wait_for_timeout(500)
        face = f"#pawnsTray .prow[data-seat='{seat}'] .pface, .prow[data-seat='{seat}'] .pface"
        if await pl.locator(face).count(): await pl.locator(face).first.click(); await pl.wait_for_timeout(800)
        check(await pl.evaluate("[...tw.sel]") == [pid], 'I8: his portrait in the Pawns menu selects his pawn', await pl.evaluate("[...tw.sel]"))

        real = [e for e in errors if 'WebSocket' not in e and 'ERR_CONNECTION_REFUSED' not in e and 'Failed to load resource' not in e]
        check(not real, 'no page errors', '; '.join(real[:5]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser invite pawn: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
sys.exit(0 if ok else 1)
