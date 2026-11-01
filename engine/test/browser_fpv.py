#!/usr/bin/env python3
"""FIRST PERSON (2026-10-29; Harry: "let's also do first person (should probably be a button in the pawns menu for that
pawn owner or gm rather than scroll in. Maybe something in the players orbital too)"). client/surfaces/fpv.js,
client/ceilings.js; docs/UI.md "First person". A GM tab and two players (Mira, Bo).

  TW_PORTS=a,b python3 engine/test/browser_fpv.py --local [--stills DIR] [--only ...]
  ... --page https://dev.turnipworks.net/play/      (against dev: the suite makes its own throwaway campaign)

  ENTER   the GM enters Mira's pawn from its ☰ ("First person"); the camera is at the figure's eyes, facing its facing,
          and the figure is not drawn; Esc gives back the map's camera exactly (pose, rule, lens, cut, roofs, selection)
  KEY     Mira presses V with nothing selected: her pawn; V again leaves. Her own pawn's closed ring has "Eyes"
  DOOR    a step east through an open door goes through (one square, one token.move, facing sent with it); with the
          door shut, and into a plain wall, the step is refused and the pawn does not move
  WALK    (2026-10-30) W held walks smoothly at a walking pace and the others see her go; let go, she stops off the
          squares; one undo takes the walk back; into a wall at an angle she slides; aimed past a doorway's corner she
          rounds it; mouse look steers a walk; squares on, she settles on a square; W held up a stair to the floor above
  STAIRS  up a stair, step by step: the pawn ends on the upper floor at 10 ft, in the room above
  FOG     Mira in first person (fog of war on): a room she has never seen is not drawn and gets no ceiling; the room
          she stands in gets one
  GM      the GM in Mira's pawn sees GM-side (no fog); Mira in her own sees through fog
  OWNER   Mira cannot look through Bo's pawn (no Eyes, no First person, enter refused)
  TAG     the other seats see "in first person" over the pawn while Mira looks through it, and not after
  DICE    a roll in first person throws its dice from the pawn, ahead of it
"""
import argparse, asyncio, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--stills'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--only', default='enter,key,door,walk,stairs,fog,gm,owner,tag,dice,phone,look'); ap.add_argument('--keep', action='store_true'); ap.add_argument('--probe', action='store_true')
A = ap.parse_args(); ONLY = set(A.only.split(','))
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18531,18532').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-fpv-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(300)
async def settle(pg, ms=120000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(400)
async def view(pg, x, z, dist=80, pitch=60, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(250)
async def still(pg, name):
    if not A.stills: return
    os.makedirs(A.stills, exist_ok=True); await pg.wait_for_timeout(900); await pg.screenshot(path=os.path.join(A.stills, f'{name}.png'))
TOK = "((id) => { const e = tw.entities()[id]; return e ? { x: e.x, y: e.y || 0, z: e.z, rot: e.rot || 0 } : null; })"
POSE = "(() => { const v = tw.main, c = v.camera; return { pose: v.pose(), rule: v.rule, fov: c.fov, near: c.near, far: c.far, pos: c.position.toArray(), cut: tw.cut?.y ?? null, roofs: !!tw.roofs, sel: [...tw.sel] }; })()"
def same_pose(a, b):
    pa, pb = a['pose'], b['pose']
    return all(abs(x - y) < 1e-6 for x, y in zip(pa['focus'], pb['focus'])) and all(abs(pa[k] - pb[k]) < 1e-6 for k in ('yaw', 'pitch', 'dist')) and a['rule'] == b['rule'] and a['fov'] == b['fov'] and a['near'] == b['near'] and a['far'] == b['far'] and a['cut'] == b['cut'] and a['roofs'] == b['roofs'] and all(abs(x - y) < 1e-4 for x, y in zip(a['pos'], b['pos']))

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST fpv {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.fpv', 90000), 'GM tab live, first person loaded')
        async def invite(name):
            await gm.keyboard.press('/'); await gm.keyboard.type(f'invite {name}', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
            await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
            link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
            return link
        mira_link = await invite('Mira'); bo_link = await invite('Bo')
        pl = await tab(mira_link); check(await wait(pl, 'window.tw && tw.ready && tw.ready() && tw.fpv', 90000), 'Mira joined')
        bo = await tab(bo_link); check(await wait(bo, 'window.tw && tw.ready && tw.ready() && tw.fpv', 90000), 'Bo joined')
        PL = await pl.evaluate('tw.me()'); BO = await bo.evaluate('tw.me()')

        # THE TABLE: a common room (x 0..30, z 0..20) with a guest room on it and a stair; a kitchen east of it (x 30..50)
        # through a door; a sealed store room further east (x 55..70), never seen; a hill; a cave below ground
        G = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 6)"); await idle(gm)
        U = await gm.evaluate("tw.spawnRoom('guest', 0, 0, 4, 4, 56, undefined, 10)"); await idle(gm)
        await gm.evaluate(f"tw.takeStairOffer?.('{U}') || tw.addStair(tw.entities()['{U}'])"); await wait(gm, "tw.stairs().length >= 1 && tw.sync.pendingCount() === 0", 30000, 'the stair')
        K = await gm.evaluate("tw.spawnRoom('kitchen', 6, 0, 4, 4, 5102)"); await idle(gm)
        X = await gm.evaluate("tw.spawnRoom('storeroom', 11, 0, 3, 3, 4411)"); await idle(gm)
        H = await gm.evaluate("tw.spawnRoom('hill', 0, 9, 4, 4, 77, undefined, 10)"); await idle(gm)
        C = await gm.evaluate("tw.spawnRoom('cave', 8, 10, 6, 5, 777, undefined, -10)"); await idle(gm)
        await gm.evaluate("tw.condButtons.hide('stair-offer')")
        # the wall between the common room and the kitchen: a door at its middle (v:6:2, z 10..15)
        DK = await gm.evaluate("""(() => { const ds = [...tw.worldOf(tw.area()).edges.values()].filter(e => e.dir === 'v' && e.gx === 6 && e.kind === 'door'); return ds.length ? ds[0].key : null; })()""")
        if not DK: await gm.evaluate("tw.dispatch('edge.set', { key: 'v:6:2', as: 'door' })"); await idle(gm); DK = 'v:6:2'
        DZ = await gm.evaluate(f"tw.worldOf(tw.area()).edges.get('{DK}').gz * 5 + 2.5")
        # Mira's pawn, in the common room, two squares west of the door, facing east; Bo's in the kitchen
        MI, BP = 'tok_fpvmira01', 'tok_fpvbo0001'
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{MI}', name: 'Mira', x: 22.5, z: {DZ}, rot: Math.PI / 2, owner: '{PL}', fig: 'hero-fighter-elf-f' }})")
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{BP}', name: 'Bo', x: 42.5, z: 2.5, rot: 0, owner: '{BO}' }})"); await idle(gm)
        await view(gm, 25, 10, 90, 58); await settle(gm)
        await wait(pl, f"!!tw.worldOf(tw.area())?.recs.get('{MI}')", 30000, 'Mira sees her pawn'); await settle(pl)

        # ================= ENTER: the GM, from the pawn's ☰ =================
        if 'enter' in ONLY:
            print('ENTER: the GM looks through Mira\'s eyes from the ☰, and Esc gives the map back')
            await gm.evaluate(f"tw.select('{MI}')"); await gm.wait_for_timeout(500)
            before = await gm.evaluate(POSE)
            await gm.click('#ring .rbtn.menu'); await gm.wait_for_timeout(900)
            item = gm.locator('#ring .rbtn.ex[data-cmd="pawn.eyes"]')
            check(await item.count() == 1, 'the pawn\'s ☰ has "First person" (the GM: not on the closed ring)', await gm.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || b.dataset.id)"))
            tip = await gm.evaluate("document.querySelector('#ring .rbtn.ex[data-cmd=\"pawn.eyes\"]')?.dataset.tip")
            check(tip == 'First person', 'its caption reads "First person"', tip)
            await item.click(); await gm.wait_for_timeout(1200)
            fi = await gm.evaluate("tw.fpv.info()"); t = await gm.evaluate(TOK + f"('{MI}')")
            check(fi and fi['id'] == MI, 'first person is on, through Mira', fi and fi['id'])
            if fi:
                eye = fi['eye']; heading = fi['heading']
                check(abs(eye[0] - t['x']) < 0.3 and abs(eye[2] - t['z']) < 0.3 and 2.5 < eye[1] < 5.5, 'the camera stands at the pawn, at its eyes (2.5–5.5 ft up)', f"eye {eye}, pawn {t}, eyeOff {fi['eyeOff']}")
                check(abs(heading - 90) < 1, 'facing the pawn\'s facing (east)', heading)
                fwd = await gm.evaluate("(() => { const d = new tw.THREE.Vector3(); tw.main.camera.getWorldDirection(d); return [d.x, d.y, d.z]; })()")
                check(fwd[0] > 0.9, 'the view looks east', fwd)
                check(fi['hiddenParts'] > 0 and not fi['figureShown'], 'the pawn\'s own figure is not drawn', fi['hiddenParts'])
                check(fi['cam']['fov'] == 65 and fi['cam']['far'] == 260, 'a first-person lens', fi['cam'])
                check(await gm.evaluate("document.documentElement.classList.contains('tw-fpv') && !document.querySelector('#fpvHud').hidden && getComputedStyle(document.querySelector('#levelMeter')).display === 'none'"), 'the HUD is reduced: Exit shows, the level meter goes')
                await still(gm, 'gm-enter-common')
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(700)
            after = await gm.evaluate(POSE)
            check(not await gm.evaluate("tw.fpv.active()"), 'Esc leaves first person')
            check(same_pose(before, after), 'the map camera is back exactly: pose, rule, lens, cut, roofs', json.dumps({'before': before['pose'], 'after': after['pose']}))
            check(after['sel'] == before['sel'], 'and the selection is back', after['sel'])
            check(await gm.evaluate(f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{MI}'); return r.group.children.every(c => c.visible) || r.visual?.visible; }})()"), 'and Mira\'s figure is drawn again')
            await gm.evaluate("tw.clearSelection()")

        # ================= KEY: Mira, V =================
        if 'key' in ONLY:
            print('KEY: Mira presses V with nothing selected, and V again')
            await pl.evaluate(f"tw.select('{MI}')"); await pl.wait_for_timeout(600)
            ring = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn:not(.ex)')].map(b => b.dataset.cmd || b.dataset.id)")
            check('pawn.eyes' in ring, 'her own pawn\'s closed ring has "Eyes"', ring)
            tip = await pl.evaluate("document.querySelector('#ring .rbtn[data-cmd=\"pawn.eyes\"]')?.dataset.tip")
            check(tip == 'Eyes', 'its name on hover: "Eyes"', tip)
            await pl.evaluate("tw.clearSelection()"); await pl.wait_for_timeout(300)
            before = await pl.evaluate(POSE)
            await pl.mouse.move(700, 450); await pl.keyboard.press('v'); await pl.wait_for_timeout(1000)
            check(await pl.evaluate("tw.fpv.pawnId()") == MI, 'V: first person through her pawn', await pl.evaluate("tw.fpv.info()"))
            await pl.keyboard.press('v'); await pl.wait_for_timeout(600)
            after = await pl.evaluate(POSE)
            check(not await pl.evaluate("tw.fpv.active()") and same_pose(before, after), 'V again: back to the map, exactly where it was', json.dumps(after['pose']))

        # ================= DOOR: through an open door, not through a shut one or a wall =================
        if 'door' in ONLY:
            print('DOOR: a step through a door; refused by a shut door and by a wall')
            await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(800)
            await pl.evaluate("tw.fpv.setLook(90, -5)")  # east
            # walk up to the door: 22.5 -> 27.5 (one step), the door's line is x 30
            await pl.keyboard.press('w'); await idle(pl); await pl.wait_for_timeout(400)
            t = await pl.evaluate(TOK + f"('{MI}')")
            check(abs(t['x'] - 27.5) < 0.05 and abs(t['z'] - DZ) < 0.05, 'W: one square east (22.5 -> 27.5)', t)
            check(abs(t['rot'] - math.pi / 2) < 0.02, 'the step carries the facing (east)', t['rot'])
            shut = await pl.evaluate(f"!tw.worldOf(tw.area()).edges.get('{DK}').open")
            if not shut: await gm.evaluate(f"tw.toggleOpen(tw.wallItem('wall:{DK}'))"); await idle(gm); await idle(pl)
            await pl.keyboard.press('w'); await pl.wait_for_timeout(700); await idle(pl)
            t2 = await pl.evaluate(TOK + f"('{MI}')"); fi = await pl.evaluate("tw.fpv.info()")
            check(abs(t2['x'] - 27.5) < 0.05 and fi['blocked'] >= 1, 'the door shut: the step is refused, she stays at 27.5', {'tok': t2, 'blocked': fi['blocked']})
            await still(pl, 'player-door-shut')
            # a click on the door opens it, for a seat that may open it: here the GM in Mira's eyes (a player opening a generated
            # door herself, on the map and in first person: browser_pdoors.py)
            await gm.evaluate(f"tw.fpv.enter('{MI}')"); await gm.wait_for_timeout(900); await gm.evaluate("tw.fpv.setLook(90, -5)"); await gm.wait_for_timeout(500)
            res = await gm.evaluate("tw.fpv.click(700, 450)"); await idle(gm); await idle(pl)
            opened = await pl.evaluate(f"!!(tw.worldOf(tw.area()).edges.get('{DK}')?.open || Object.values(tw.entities()).some(e => e.fromEdge === '{DK}' && e.open))")
            check(res == 'open' and opened, 'a click on the door in the view opens it (the GM, in Mira\'s eyes)', {'click': res, 'opened': opened})
            await gm.evaluate("tw.fpv.exit()")
            if not opened: await gm.evaluate(f"tw.toggleOpen(tw.wallItem('wall:{DK}'))"); await idle(gm); await idle(pl)
            await still(pl, 'player-door-open')
            await pl.keyboard.press('w'); await pl.wait_for_timeout(700); await idle(pl)
            t3 = await pl.evaluate(TOK + f"('{MI}')")
            check(abs(t3['x'] - 32.5) < 0.05 and abs(t3['z'] - DZ) < 0.05, 'the door open: W steps through it into the kitchen (32.5)', t3)
            await pl.wait_for_timeout(600)
            fi = await pl.evaluate("tw.fpv.info()")
            check(abs(fi['eye'][0] - 32.5) < 0.6, 'the camera has glided after her', fi['eye'])
            # a plain wall: the kitchen's north wall (z 0); face north and step until it stops
            await pl.evaluate("tw.fpv.setLook(180, -5)")
            for _ in range(4): await pl.keyboard.press('w'); await pl.wait_for_timeout(450); await idle(pl)
            t4 = await pl.evaluate(TOK + f"('{MI}')"); fi = await pl.evaluate("tw.fpv.info()")
            check(abs(t4['z'] - 2.5) < 0.05 and abs(t4['x'] - 32.5) < 0.05 and fi['blocked'] >= 2, 'facing north she walks to the kitchen\'s north wall and no further (z 2.5)', {'tok': t4, 'blocked': fi['blocked']})
            await still(pl, 'player-kitchen-wall')
            # the wall test itself, straight
            check(await pl.evaluate("tw.fpv.blocked(32.5, 2.5, 32.5, -2.5)") is True and await pl.evaluate("tw.fpv.blocked(32.5, 2.5, 37.5, 2.5)") is False, 'stepBlocked: through the wall yes, along it no')
            # S steps back (and never opens Settings, the launcher's own letter on the map); Q turns
            await pl.keyboard.press('s'); await pl.wait_for_timeout(500); await idle(pl)
            t5 = await pl.evaluate(TOK + f"('{MI}')")
            check(abs(t5['z'] - 7.5) < 0.05 and not await pl.evaluate("tw.settings.state().open"), 'S: one square back (south), and Settings stays shut', {'tok': t5, 'info': await pl.evaluate("(() => { const i = tw.fpv.info(); return { blocked: i.blocked, steps: i.steps, heading: i.heading, settings: tw.settings.state().open, b: tw.fpv.blocked(32.5, 2.5, 32.5, 7.5) }; })()")})
            h0 = (await pl.evaluate("tw.fpv.info()"))['heading']
            await pl.keyboard.down('q'); await pl.wait_for_timeout(500); await pl.keyboard.up('q'); await pl.wait_for_timeout(1200); await idle(pl)
            h1 = (await pl.evaluate("tw.fpv.info()"))['heading']; t6 = await pl.evaluate(TOK + f"('{MI}')")
            check(h1 - h0 > 20 and abs(math.degrees(t6['rot']) % 360 - h1 % 360) < 3, 'Q held turns the view left, and the facing is sent once she stops', {'h0': h0, 'h1': h1, 'rot_deg': math.degrees(t6['rot'])})
            # a click on a floor square walks there by squares (back to the door's square, round nothing)
            await pl.evaluate("tw.fpv.setLook(90, -35)"); await pl.wait_for_timeout(500)
            w = await pl.evaluate("(() => { const s = tw.screenOf(42.5, 7.5, tw.main, 0); return [s.x, s.y]; })()")
            res = await pl.evaluate(f"tw.fpv.click({w[0]}, {w[1]})")
            await wait(pl, f"Math.abs(tw.entities()['{MI}'].x - 42.5) < 0.05 && tw.fpv.info().queue === 0 && tw.sync.pendingCount() === 0", 12000, 'walked')
            t7 = await pl.evaluate(TOK + f"('{MI}')")
            print('    click log', await pl.evaluate("JSON.stringify(tw.fpvLog.slice(-2))"), await pl.evaluate(f"JSON.stringify(tw.pointAt({w[0]}, {w[1]}))"), w)
            check(res == 'walk' and abs(t7['x'] - 42.5) < 0.05 and abs(t7['z'] - 7.5) < 0.05, 'a click on a floor square she sees walks her there, square by square', {'click': res, 'tok': t7})
            await pl.evaluate("tw.fpv.exit()")

        # ================= STAIRS: up to the guest room =================
        if 'stairs' in ONLY:
            print('STAIRS: up the stair, square by square')
            st = await gm.evaluate("(() => { const E = tw.entities(), s = tw.ST.stairsOf(E)[0]; if (!s) return null; const e = tw.ST.stairEnds(s, E), d = tw.ST.stairDir(s); return { id: s.id, foot: e.foot, top: e.top, dir: d, cells: tw.ST.stairCells(s).length }; })()")
            check(st is not None, 'the stair is there', st)
            if st:
                fx, fz = st['foot']['x'] if isinstance(st['foot'], dict) else st['foot'][0], st['foot']['z'] if isinstance(st['foot'], dict) else st['foot'][1]
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: {fx}, z: {fz}, y: 0 }})"); await idle(gm); await idle(pl)
                await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(600)
                hd = math.degrees(math.atan2(st['dir'][0], st['dir'][1]))
                await pl.evaluate(f"tw.fpv.setLook({hd}, 0)")
                ys = []
                for _ in range(st['cells'] + 2):
                    await pl.keyboard.press('w'); await pl.wait_for_timeout(450); await idle(pl)
                    ys.append((await pl.evaluate(TOK + f"('{MI}')"))['y'])
                t = await pl.evaluate(TOK + f"('{MI}')"); room = await pl.evaluate(f"tw.worldOf(tw.area()).pawnBaseInfo('{MI}')")
                check(abs(t['y'] - 10) < 0.3 and room and room.get('room') == U, 'up the stair she stands on the upper floor (10 ft), in the guest room', {'ys': ys, 'tok': t, 'room': room and room.get('room'), 'U': U})
                check(len([y for y in ys if 0.3 < y < 9.7]) >= 1 or ys[0] >= 9.7, 'on the way she stood on the treads (between the floors)', ys)
                await pl.wait_for_timeout(800); fi = await pl.evaluate("tw.fpv.info()")
                check(fi['eye'][1] > 12, 'the eyes are up there too', fi['eye'])
                cu = fi['ceilings'].get(U)
                check(cu and abs(cu['y'] - 19) < 0.2 and cu['cells'] > 0, 'the guest room has its ceiling at the underside of its roof slab (19 ft)', cu)
                await pl.evaluate("tw.fpv.setLook(null, 25)"); await still(pl, 'player-upstairs-ceiling'); await pl.evaluate("tw.fpv.setLook(null, -5)")
                await pl.evaluate("tw.fpv.exit()")
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: 22.5, z: {DZ}, y: 0, rot: Math.PI / 2 }})"); await idle(gm); await idle(pl)

        # ================= FOG: Mira in her pawn sees what she has seen; the store room is never drawn =================
        if 'fog' in ONLY or 'gm' in ONLY:
            print('FOG / GM: fog of war for Mira, GM-side for the GM')
            await gm.evaluate("tw.registry.run('area.fogOfWar.on')"); await idle(gm)
            await wait(pl, "tw.worldOf(tw.area()).fogActive && tw.fog.visible(22.5, 10, 0)", 20000, 'fog of war on for Mira')
            check(await pl.evaluate("tw.worldOf(tw.area()).fogActive"), 'fog of war is on for Mira')
            # the store room: sealed (its doors walled up), never seen
            await gm.evaluate(f"tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.some(s => s.room === '{X}')).map(e => ({{ type: 'edge.set', args: {{ key: e.key, as: 'wall', piece: 'wall-straight' }} }})))"); await idle(gm)
            await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(1500)
            await pl.evaluate("tw.fpv.setLook(90, -3)"); await pl.wait_for_timeout(1500)
            if 'fog' in ONLY:
                hid = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), E = tw.entities(); return {{ rule: !!w.fogRule?.(E['{X}']), shell: [...w.shell.values()].filter(s => s.roomId === '{X}' && s.group.visible).length, things: [...w.recs.values()].filter(r => r.entity.room === '{X}' && r.group.visible).length, ceil: !!tw.fpv.info().ceilings['{X}'] }}; }})()")
                check(hid['rule'] and hid['shell'] == 0 and hid['things'] == 0 and not hid['ceil'], 'the store room she has never seen is not drawn at all in first person (no walls, no things, no ceiling)', hid)
                own = await pl.evaluate(f"(() => {{ const i = tw.fpv.info(); return {{ fog: tw.worldOf(tw.area()).fogActive, here: Object.keys(i.ceilings) }}; }})()")
                room_now = await pl.evaluate(f"tw.worldOf(tw.area()).pawnBaseInfo('{MI}')?.room")
                check(own['fog'] and room_now in own['here'], 'the room she stands in has its ceiling', own)
                # WALKING IN THE FOG (2026-10-30): the reveal follows her real pawn as she walks: the kitchen's far corner, out
                # of sight from the common room (the wall beside the door), comes into view while W is still held
                await pl.evaluate("tw.fpv.exit()"); await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: 22.5, z: {DZ}, y: 0, rot: Math.PI / 2 }})"); await idle(gm); await idle(pl)
                await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(900); await pl.evaluate("tw.fpv.setLook(90, -3)")
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{BP}', x: 2.5, z: 2.5, y: 0 }})"); await idle(gm); await idle(pl); await pl.wait_for_timeout(600)  # (Bo, in the kitchen, would see it for the party)
                before = await pl.evaluate("tw.fog.visible(47.5, 17.5, 0)")
                await pl.evaluate("tw.settings.setPref('pawnSnap', 'shift')"); await pl.evaluate("tw.fpv.hold('w')")
                seen = await wait(pl, "tw.fog.visible(47.5, 17.5, 0) && tw.fpv.info().walking", 4000, 'the far corner seen mid-walk')
                mid = await pl.evaluate(f"(() => {{ const e = tw.entities()['{MI}'], i = tw.fpv.info(); return {{ pawn: [e.x, e.z], walker: i.pos, walking: i.walking }}; }})()")
                await pl.evaluate("tw.fpv.letGo()"); await pl.wait_for_timeout(600); await idle(pl); await pl.evaluate("tw.settings.setPref('pawnSnap', 'always')")
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{BP}', x: 42.5, z: 2.5, y: 0 }})"); await idle(gm)
                dbg = None if seen else await pl.evaluate(f"(() => {{ const i = tw.fpv.info(); return {{ walls: tw.fpv.walls(30, 2.5, 3), objs: Object.values(tw.entities()).filter(o => o.fromEdge === '{DK}').map(o => [o.id, o.cat, o.open, o.x, o.z, o.y || 0, o.room, o.hidden]), edge: (({{ open, kind }}) => ({{ open, kind }}))(tw.worldOf(tw.area()).edges.get('{DK}') || {{}}), gmObjs: null }}; }})()")
                check(not before and seen and mid['walking'] and mid['pawn'][0] > 24.5, 'fog of war while walking: the reveal follows her pawn, journalled as she goes (seen before she stops)', {'before': before, 'mid': mid, 'dbg': dbg})
                await still(pl, 'player-fog-common')
            if 'gm' in ONLY:
                await gm.evaluate(f"tw.fpv.enter('{MI}')"); await gm.wait_for_timeout(1500)
                g = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), E = tw.entities(); return {{ fog: !!w.fogActive, store: !w.fogRule?.(E['{X}']), id: tw.fpv.pawnId() }}; }})()")
                check(g['id'] == MI and not g['fog'] and g['store'], 'the GM in Mira\'s pawn sees GM-side: no fog, the store room is there', g)
                await gm.evaluate("tw.fpv.exit()")
            await pl.evaluate("tw.fpv.exit()")

        # ================= OWNER: Mira cannot look through Bo's pawn =================
        if 'owner' in ONLY:
            print('OWNER: not another player\'s pawn')
            await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await idle(gm)
            await wait(pl, f"!!tw.worldOf(tw.area())?.recs.get('{BP}')?.group.visible", 15000, 'Mira sees Bo\'s pawn')
            await pl.evaluate(f"tw.select('{BP}')"); await pl.wait_for_timeout(600)
            closed = await pl.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || b.dataset.id)")
            menu_has = False
            if await pl.locator('#ring .rbtn.menu').count():
                await pl.click('#ring .rbtn.menu'); await pl.wait_for_timeout(700)
                menu_has = await pl.locator('#ring .rbtn[data-cmd="pawn.eyes"]').count() > 0
            check('pawn.eyes' not in closed and not menu_has, 'Bo\'s pawn: no Eyes on Mira\'s ring, none in its ☰', closed)
            await pl.keyboard.press('Escape'); await pl.evaluate(f"tw.select('{BP}')"); await pl.mouse.move(700, 450); await pl.keyboard.press('v'); await pl.wait_for_timeout(500)
            check(not await pl.evaluate("tw.fpv.active()"), 'V with Bo\'s pawn selected does nothing')
            check(await pl.evaluate(f"tw.fpv.enter('{BP}')") is False and not await pl.evaluate("tw.fpv.active()"), 'and asking by hand is refused')
            await pl.evaluate("tw.clearSelection()")

        # ================= WALK (2026-10-30): held keys walk; walls slide; doorways round their corners; one undo a walk =================
        if 'walk' in ONLY:
            print('WALK: hold W to walk (smooth, a walking pace), slide along a wall, round a doorway\'s corner, one undo per walk')
            await pl.evaluate("tw.settings.setPref('pawnSnap', 'shift')")  # (free, the default: she stops where she stops)
            # the door between the common room and the kitchen is open (the DOOR part opened it; open it here if not)
            if not await pl.evaluate(f"!!(tw.worldOf(tw.area()).edges.get('{DK}')?.open || Object.values(tw.entities()).some(e => e.fromEdge === '{DK}' && e.open))"):
                await gm.evaluate(f"tw.toggleOpen(tw.wallItem('wall:{DK}'))"); await idle(gm); await idle(pl)
            async def put(x, z, rot=0):
                await pl.evaluate("tw.fpv.exit()"); await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: {x}, z: {z}, y: 0, rot: {rot} }})"); await idle(gm); await idle(pl)
                await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(700)
            EYE = "(() => { const i = tw.fpv.info(); return { x: i.eye[0], y: i.eye[1], z: i.eye[2], walking: i.walking, t: performance.now() }; })()"
            # HOLD: in the kitchen, facing east, W held for a second
            await put(32.5, 17.5); await pl.evaluate("tw.fpv.setLook(90, -5)"); await pl.mouse.move(700, 450)
            await pl.keyboard.down('w'); samples = []
            for _ in range(5): await pl.wait_for_timeout(180); samples.append(await pl.evaluate(EYE))
            gm_mid = await gm.evaluate(f"(() => {{ const e = tw.entities()['{MI}'], r = tw.worldOf(tw.area()).recs.get('{MI}'); return {{ x: e.x, drawn: r.group.position.x }}; }})()")
            await pl.keyboard.up('w'); await pl.wait_for_timeout(500); await idle(pl); await idle(gm); await pl.wait_for_timeout(300)
            t = await pl.evaluate(TOK + f"('{MI}')"); fi = await pl.evaluate("tw.fpv.info()")
            xs = [p['x'] for p in samples]; gaps = [b - a for a, b in zip(xs, xs[1:])]
            check(all(p['walking'] for p in samples) and all(0.3 < g < 4.0 for g in gaps), 'W held: she walks on smoothly, a little every moment (no hops of a square)', {'xs': [round(x, 2) for x in xs], 'gaps': [round(g, 2) for g in gaps]})
            pace = (xs[-1] - xs[0]) / ((samples[-1]['t'] - samples[0]['t']) / 1000)
            check(8 < pace < 14, f'at a walking pace (WALK.speed 11 ft/s)', round(pace, 2))
            check(gm_mid['x'] > 34 and gm_mid['drawn'] > 34, 'the others see her go while she walks (the pawn\'s place journalled, and drawn gliding)', gm_mid)
            check(not fi['walking'] and 40 < t['x'] < 48 and abs(t['z'] - 17.5) < 0.3 and abs(((t['x'] - 2.5) % 5)) > 0.05, 'let go: she stops where she is, off the squares (free moves)', t)
            check(abs(t['rot'] - math.pi / 2) < 0.03, 'the walk carries the facing', t['rot'])
            await pl.evaluate("tw.undo()"); await idle(pl); await pl.wait_for_timeout(400)
            t2 = await pl.evaluate(TOK + f"('{MI}')")
            check(abs(t2['x'] - 32.5) < 0.05 and abs(t2['z'] - 17.5) < 0.05, 'ONE undo takes the whole walk back (to where it began)', t2)
            # SLIDE: facing mostly north into the kitchen's north wall, a little east: she slides along it, she does not stop dead
            await put(37.5, 2.5); await pl.evaluate("tw.fpv.setLook(150, -5)")
            await pl.evaluate("tw.fpv.hold('w')"); await pl.wait_for_timeout(900); await pl.evaluate("tw.fpv.letGo()"); await pl.wait_for_timeout(500); await idle(pl)
            t = await pl.evaluate(TOK + f"('{MI}')"); fi = await pl.evaluate("tw.fpv.info()")
            check(t['x'] - 37.5 > 3 and 1.0 < t['z'] < 2.6, 'into a wall at an angle: she slides along it (east), a body\'s width off it', {'tok': t, 'contact': fi['contact']})
            # CORNER: from the common room straight at a point in the kitchen; the line clips the doorway's corner by half a foot
            # (the door spans z DZ-2.5..DZ+2.5 on x 30: from (22.5, DZ+5) at (37.5, DZ-1), the line meets x 30 half a foot inside its
            # far jamb; the body is 1.2 ft round)
            await put(22.5, DZ + 5); hd = math.degrees(math.atan2(37.5 - 22.5, (DZ - 1) - (DZ + 5))); await pl.evaluate(f"tw.fpv.setLook({hd}, -5)")
            await pl.evaluate("tw.fpv.hold('w')"); await pl.wait_for_timeout(1900); await pl.evaluate("tw.fpv.letGo()"); await pl.wait_for_timeout(500); await idle(pl)
            t = await pl.evaluate(TOK + f"('{MI}')")
            check(t['x'] > 31.5, 'aimed past a doorway\'s corner, she rounds it and walks through into the kitchen (no snag)', {'tok': t, 'walls': await pl.evaluate("tw.fpv.walls(30, 12.5, 4)"), 'door': await pl.evaluate(f"(() => {{ const e = tw.worldOf(tw.area()).edges.get('{DK}'); return {{ open: e?.open, kind: e?.kind, objs: Object.values(tw.entities()).filter(o => o.fromEdge === '{DK}').map(o => [o.cat, o.open, o.x, o.z]) }}; }})()")})
            check(await pl.evaluate(f"tw.fpv.blocked(27.5, {DZ + 5}, 32.5, {DZ + 5})") is True, '(the old step there, the view snapped to east, is refused by the wall)')
            # MOUSE LOOK while walking: W held, a drag turns the view, and the walk turns with it
            await put(32.5, 17.5); await pl.evaluate("tw.fpv.setLook(90, -5)"); await pl.mouse.move(600, 450)
            await pl.keyboard.down('w'); await pl.wait_for_timeout(250)
            await pl.mouse.down(); [await pl.mouse.move(600 + i * 16, 450) for i in range(1, 11)]; await pl.mouse.up()
            a = await pl.evaluate(EYE); await pl.wait_for_timeout(350); b = await pl.evaluate(EYE); h = (await pl.evaluate("tw.fpv.info()"))['heading']
            await pl.keyboard.up('w'); await pl.wait_for_timeout(500); await idle(pl)
            way = math.degrees(math.atan2(b['x'] - a['x'], b['z'] - a['z']))
            check(abs(h - 90) > 25 and abs(((way - h + 180) % 360) - 180) < 20, 'mouse look while W is held: the walk follows the view', {'heading': h, 'walked toward': round(way, 1)})
            # SQUARES ON: with "Pawns snap to squares: always" she settles on the nearest square when she stops
            await pl.evaluate("tw.settings.setPref('pawnSnap', 'always')")
            await put(32.5, 17.5); await pl.evaluate("tw.fpv.setLook(90, -5)")
            await pl.evaluate("tw.fpv.hold('w')"); await pl.wait_for_timeout(650); await pl.evaluate("tw.fpv.letGo()"); await pl.wait_for_timeout(600); await idle(pl)
            t = await pl.evaluate(TOK + f"('{MI}')")
            check(t['x'] >= 37.4 and abs((t['x'] - 2.5) % 5) < 0.05 and abs(t['z'] - 17.5) < 0.05, 'squares on: she settles on the nearest square she may stand on', t)
            await pl.evaluate("tw.settings.setPref('pawnSnap', 'shift')")
            # A STAIR, held: from its foot, W held up the flight to the floor above
            st = await gm.evaluate("(() => { const E = tw.entities(), s = tw.ST.stairsOf(E)[0]; if (!s) return null; const e = tw.ST.stairEnds(s, E), d = tw.ST.stairDir(s); return { foot: e.foot, top: e.top, dir: d }; })()")
            if st:
                await put(st['foot']['x'], st['foot']['z']); await pl.evaluate(f"tw.fpv.setLook({math.degrees(math.atan2(st['dir'][0], st['dir'][1]))}, 0)")
                ys = []; await pl.evaluate("tw.fpv.hold('w')")
                for _ in range(10): await pl.wait_for_timeout(200); ys.append((await pl.evaluate(EYE))['y'])
                await pl.evaluate("tw.fpv.letGo()"); await pl.wait_for_timeout(600); await idle(pl)
                t = await pl.evaluate(TOK + f"('{MI}')"); room = await pl.evaluate(f"tw.worldOf(tw.area()).pawnBaseInfo('{MI}')")
                rises = [b - a for a, b in zip(ys, ys[1:])]
                check(abs(t['y'] - 10) < 0.3 and room and room.get('room') == U, 'W held up the stair: she ends on the floor above (10 ft), in the guest room', {'tok': t, 'room': room and room.get('room')})
                check(max(rises) < 3.5 and len([y for y in ys if 5 < y < 13.5]) >= 1, 'the eyes climb with the treads (no jump of a storey)', [round(y, 2) for y in ys])
            await pl.evaluate("tw.fpv.exit()")
            await pl.evaluate("tw.settings.setPref('pawnSnap', 'always')")
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: 22.5, z: {DZ}, y: 0, rot: Math.PI / 2 }})"); await idle(gm); await idle(pl)

        # ================= TAG: the others see it =================
        if 'tag' in ONLY:
            print('TAG: the other seats see "in first person" over the pawn')
            await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(500)
            await view(gm, 25, 10, 70, 55); await view(bo, 25, 10, 70, 55)
            ok = await wait(gm, f"tw.fpv.tags().some(t => t.pawn === '{MI}' && t.shown)", 10000, 'GM tag')
            tg = await gm.evaluate("tw.fpv.tags()")
            check(ok and tg[0]['text'] == 'in first person', 'the GM sees "in first person" over Mira\'s pawn', tg)
            check(await wait(bo, f"tw.fpv.tags().some(t => t.pawn === '{MI}' && t.shown)", 10000, 'Bo tag'), 'and so does Bo')
            await still(gm, 'gm-sees-tag')
            await pl.keyboard.press('Escape')
            check(await wait(gm, f"!tw.fpv.tags().some(t => t.pawn === '{MI}')", 10000, 'tag gone'), 'when she leaves it goes')

        # ================= DICE: thrown from the pawn =================
        if 'dice' in ONLY:
            print('DICE: a roll in first person')
            await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(500); await pl.evaluate("tw.fpv.setLook(90, -20)")
            await pl.keyboard.press('/'); await pl.keyboard.type('roll d20', delay=8); await pl.wait_for_timeout(300); await pl.keyboard.press('Enter')
            ok = await wait(pl, "!!tw.dice?.last", 15000, 'dice thrown')
            t = await pl.evaluate(TOK + f"('{MI}')"); last = await pl.evaluate("tw.dice?.last && { from: tw.dice.last.from, to: tw.dice.last.to }")
            check(ok and last and abs(last['from']['x'] - t['x']) < 0.6 and abs(last['from']['z'] - t['z']) < 0.6 and last['to']['x'] > t['x'] + 3, 'the dice come from her pawn and roll ahead of her (east, where she looks)', {'last': last, 'pawn': t})
            await still(pl, 'player-dice')
            await pl.evaluate("tw.fpv.exit()")

        # ================= PHONE: a finger looks, the pad steps =================
        if 'phone' in ONLY:
            print('PHONE: Mira on a phone: drag to look, the arrow pad to step')
            pctx = await browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            ph = await pctx.new_page(); ph.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await ph.goto(mira_link, timeout=180000, wait_until='domcontentloaded')
            check(await wait(ph, 'window.tw && tw.ready && tw.ready() && tw.fpv', 90000), 'Mira joined on a phone')
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: 12.5, z: 7.5, y: 0, rot: 0 }})"); await idle(gm); await idle(ph)
            await ph.evaluate(f"tw.fpv.enter('{MI}')"); await ph.wait_for_timeout(800)
            hand = await ph.evaluate("document.documentElement.classList.contains('tw-hand')")
            pad = await ph.evaluate("(() => { const p = document.querySelector('#fpvHud .fpv-pad'); return !!p && getComputedStyle(p).display !== 'none'; })()")
            check(hand and pad, 'on a phone the four-arrow pad shows', {'tw-hand': hand, 'pad': pad})
            h0 = (await ph.evaluate("tw.fpv.info()"))['heading']
            await ph.evaluate("""(() => { const c = document.getElementById('c'), r = c.getBoundingClientRect(), y = r.top + r.height * 0.5; const ev = (t, x) => c.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: t === 'pointerup' ? 0 : 1 }));
              ev('pointerdown', 120); for (let i = 1; i <= 10; i++) ev('pointermove', 120 + i * 15); ev('pointerup', 270); })()""")
            h1 = (await ph.evaluate("tw.fpv.info()"))['heading']
            check(h1 - h0 > 20, 'a finger dragged right turns the view (grab the world: it turns left)', {'h0': h0, 'h1': h1})
            await ph.evaluate("tw.fpv.setLook(0, -5)"); t0 = await ph.evaluate(TOK + f"('{MI}')")
            await ph.tap('#fpvHud .fpv-pad [data-m=w]'); await ph.wait_for_timeout(600); await idle(ph)
            t1 = await ph.evaluate(TOK + f"('{MI}')")
            check(abs(t1['z'] - t0['z'] - 5) < 0.05, 'the pad\'s up arrow tapped: one square forward (squares on)', {'from': t0, 'to': t1})
            # held: the pad walks while the finger stays down (2026-10-30)
            await ph.evaluate("(() => { const b = document.querySelector('#fpvHud .fpv-pad [data-m=s]'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true })); window.__padB = b; })()")
            await ph.wait_for_timeout(250); mid = await ph.evaluate("tw.fpv.info()")
            await ph.wait_for_timeout(500); await ph.evaluate("window.__padB.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true }))")
            await ph.wait_for_timeout(600); await idle(ph); t2 = await ph.evaluate(TOK + f"('{MI}')")
            check(mid['walking'] and t1['z'] - t2['z'] >= 4.9 and abs((t2['z'] - 2.5) % 5) < 0.05, 'the pad\'s arrow held: she walks while the finger is down (back, here), and settles on a square', {'mid': {'walking': mid['walking'], 'pos': mid['pos']}, 'from': t1, 'to': t2})
            await still(ph, 'phone-fpv')
            await ph.tap('#fpvHud .fpv-exit'); await ph.wait_for_timeout(500)
            check(not await ph.evaluate("tw.fpv.active()"), 'Exit leaves')
            await pctx.close()

        # ================= PROBE: numbers for what the vision critic saw (only with --probe) =================
        if A.probe:
            import io
            from PIL import Image, ImageChops
            print('PROBE')
            async def put2(x, z, y=0, h=0, pt=-4):
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: {x}, z: {z}, y: {y} }})"); await idle(gm); await idle(pl)
                if not await pl.evaluate("tw.fpv.active()"): await pl.evaluate(f"tw.fpv.enter('{MI}')")
                await pl.evaluate(f"tw.fpv.setLook({h}, {pt})"); await pl.wait_for_timeout(2500)
            async def diff(name, js_off, js_on):
                await pl.evaluate("tw.freezeTime(true)"); await pl.wait_for_timeout(300)
                a = Image.open(io.BytesIO(await pl.locator('#c').screenshot())).convert('RGB')
                await pl.evaluate(js_off); await pl.wait_for_timeout(400)
                b = Image.open(io.BytesIO(await pl.locator('#c').screenshot())).convert('RGB')
                await pl.evaluate(js_on); await pl.evaluate("tw.freezeTime(false)")
                d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 24 else 0)
                print(f'    {name}: changed px {sum(1 for v in d.get_flattened_data() if v)} bbox {d.getbbox()}')
            await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await idle(gm)
            CEIL_OFF = "tw.worldOf(tw.area()).scene.getObjectByName('fpv-ceilings').visible = false"
            CEIL_ON = "tw.worldOf(tw.area()).scene.getObjectByName('fpv-ceilings').visible = true"
            await put2(12.5, 7.5, 0, 0, 40); await wait(pl, "tw.fpv.info().ceilingsPending === 0", 15000, 'ceilings built'); await diff('inside looking up: ceilings off', CEIL_OFF, CEIL_ON)
            await put2(37.5, 37.5, 0, math.degrees(math.atan2(-12.5, -27.5))); await diff('outdoor: ceilings off', CEIL_OFF, CEIL_ON)
            await put2(12.5, 7.5, 0, 0, -30); await diff('own pawn: its whole group off (0 = nothing of it shows)', "tw.worldOf(tw.area()).recs.get('{MI}').group.visible = false".replace('{MI}', MI), "tw.worldOf(tw.area()).recs.get('{MI}').group.visible = true".replace('{MI}', MI))
            await put2(7.5, 52.5, 10, 180 + math.degrees(math.atan2(10, 42)), -8); await diff('hilltop: ceilings off', CEIL_OFF, CEIL_ON)
            mats = await pl.evaluate("""(() => { const g = tw.worldOf(tw.area()).scene.getObjectByName('fpv-ceilings'); const out = []; g?.traverse(o => { if (o.isMesh && out.length < 3) out.push({ side: o.material.side, type: o.material.type, emissive: o.material.emissive?.getHexString?.(), map: !!o.material.map, mapW: o.material.map?.image?.width || null }); }); return out; })()""")
            print('    ceiling materials', mats)
            await put2(52.5, 62.5, -10, 200, 35); await wait(pl, "tw.fpv.info().ceilingsPending === 0", 15000, 'ceilings built'); await diff('cave looking up: ceilings off', CEIL_OFF, CEIL_ON)
            cave = await pl.evaluate(f"(() => {{ const E = tw.entities(), r = E['{C}'], w = tw.worldOf(tw.area()); return {{ open: w.isOpenRoom(r), type: r.recipe.type, fog: !!w.fogRule?.(r), ceil: tw.fpv.info().ceilings['{C}'] || null, top: tw.HT ? null : null, grid: w.grid.visible }}; }})()")
            print('    cave', cave)
            cdbg = await pl.evaluate(f"""(() => {{ const T = tw.THREE, w = tw.worldOf(tw.area()), g = w.scene.getObjectByName('fpv-ceilings'); let h = null; g.traverse(o => {{ if (o.userData?.ceiling === '{C}') h = o; }}); if (!h) return 'no holder';
              const ms = []; h.traverse(o => {{ if (o.isMesh) ms.push(o); }}); const m = ms[0]; m.updateMatrixWorld(true); const n = new T.Vector3(0, 1, 0), p = m.geometry.attributes.normal; if (p) n.fromBufferAttribute(p, 0); n.transformDirection(m.matrixWorld);
              const b = new T.Box3().setFromObject(h); const cam = tw.main.camera; const r = new T.Raycaster(cam.position.clone(), new T.Vector3(0, 1, 0)); r.camera = cam; const meshes = []; w.scene.traverse(o => {{ if (o.isMesh && o.visible) meshes.push(o); }}); const hits = r.intersectObjects(meshes, false).slice(0, 4).map(x => ({{ name: x.object.name || x.object.type, d: +x.distance.toFixed(2), ceil: !!x.object.userData?.ceiling, vis: x.object.visible }}));
              return {{ meshes: ms.length, geo: m.geometry.type, normal: n.toArray().map(v => +v.toFixed(2)), box: [b.min.toArray().map(v => +v.toFixed(1)), b.max.toArray().map(v => +v.toFixed(1))], vis: ms.every(o => o.visible), gvis: g.visible, parent: !!g.parent, cam: cam.position.toArray().map(v => +v.toFixed(1)), up: hits, layers: m.layers.mask }}; }})()""")
            print('    cave ceiling', cdbg)
            await diff('cave: ground plane off', "tw.worldOf(tw.area()).ground.visible = false", "tw.worldOf(tw.area()).ground.visible = true")
            gaps = await pl.evaluate("""(() => { const T = tw.THREE, w = tw.worldOf(tw.area()), out = [];
              for (const [k, sh] of w.shell) { if (!/door/.test(sh.spec.id || '') && !(sh.spec.wallDir === 'c')) continue; }
              const doors = [...w.edges.values()].filter(e => e.kind === 'door' && e.sides.length === 1);
              for (const d of doors.slice(0, 3)) { const x = d.gx * 5, z = d.gz * 5, along = d.dir === 'h' ? 'x' : 'z';
                const near = [...w.shell.values()].filter(s => { const b = new T.Box3().setFromObject(s.group); const c = b.getCenter(new T.Vector3()); return Math.abs(c.x - (d.dir === 'h' ? x + 2.5 : x)) < 4 && Math.abs(c.z - (d.dir === 'h' ? z : z + 2.5)) < 4 && b.max.y > 1; })
                  .map(s => { const b = new T.Box3().setFromObject(s.group); return { key: s.key, id: s.spec.id, lo: +b.min[along].toFixed(2), hi: +b.max[along].toFixed(2), top: +b.max.y.toFixed(1), vis: s.group.visible }; }).sort((a, b) => a.lo - b.lo);
                out.push({ edge: d.key, dir: d.dir, from: d.dir === 'h' ? x : z, to: (d.dir === 'h' ? x : z) + 5, pieces: near }); }
              return out; })()""")
            for g in gaps: print('    door', g['edge'], g['from'], g['to'], [(p['id'], p['lo'], p['hi'], p['top']) for p in g['pieces']])
            await put2(15, 12.5, 0, 0, 10); await wait(pl, "tw.fpv.info().ceilingsPending === 0", 15000, 'ceilings built')
            col = await pl.evaluate("""(() => { const T = tw.THREE, w = tw.worldOf(tw.area()), cam = tw.main.camera, out = []; const meshes = []; w.scene.traverse(o => { if (o.isMesh) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; } if (v) meshes.push(o); } });
              for (let h = 8.0; h <= 10.01; h += 0.2) { const tgt = new T.Vector3(15, h, 20.6), d = tgt.clone().sub(cam.position).normalize(); const r = new T.Raycaster(cam.position.clone(), d, 0.1, 40); const hit = r.intersectObjects(meshes, false)[0];
                let k = hit ? hit.object : null, tag = null; for (let p = k; p && !tag; p = p.parent) { if (p.userData?.ceiling) tag = 'ceiling'; for (const [key, sh] of w.shell) if (sh.group === p) { tag = key + ' ' + (sh.spec.id || ''); break; } }
                out.push([+h.toFixed(1), hit ? +hit.distance.toFixed(2) : null, hit ? +hit.point.y.toFixed(2) : null, tag || (hit ? hit.object.type : 'SKY')]); }
              return out; })()""")
            for c in col: print('    above door', c)
            await pl.evaluate("tw.fpv.exit()")

        # ================= LOOK: stills for the vision critic (only with --stills) =================
        if A.stills and 'look' in ONLY:
            print('LOOK: stills inside, in the cave, outdoors, on the hill, in fog and in darkness')
            async def put(x, z, y=0, h=0, pt=-4):
                await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{MI}', x: {x}, z: {z}, y: {y} }})"); await idle(gm); await idle(pl)
                if not await pl.evaluate("tw.fpv.active()"): await pl.evaluate(f"tw.fpv.enter('{MI}')")
                await pl.evaluate(f"tw.fpv.setLook({h}, {pt})"); await pl.wait_for_timeout(1500)
                await wait(pl, "tw.fpv.info().ceilingsPending === 0", 15000, 'ceilings built'); await pl.wait_for_timeout(1000)
            await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await idle(gm)
            await put(12.5, 7.5, 0, 0); await still(pl, 'int-a')
            await pl.evaluate("tw.fpv.setLook(0, 40)"); await still(pl, 'int-up')
            await put(42.5, DZ, 0, -90); await still(pl, 'int-door')
            await put(52.5, 62.5, -10, 90); await still(pl, 'cave-a')
            await pl.evaluate("tw.fpv.setLook(200, 35)"); await still(pl, 'cave-up')
            await put(37.5, 37.5, 0, math.degrees(math.atan2(-12.5, -27.5))); await still(pl, 'out-building')
            await pl.evaluate(f"tw.fpv.setLook({math.degrees(math.atan2(-27.5, 17.5))}, -4)"); await still(pl, 'out-hill')
            await put(7.5, 52.5, 10, 180 + math.degrees(math.atan2(10, 42)), -8); await still(pl, 'hilltop')
            await gm.evaluate("tw.registry.run('area.fogOfWar.on')"); await idle(gm)
            await put(12.5, 7.5, 0, 90); await pl.wait_for_timeout(2500); await still(pl, 'fog-int')
            await put(52.5, 7.5, 0, 90, -2); await pl.wait_for_timeout(2500); await still(pl, 'fog-unseen-wall')
            await put(37.5, 37.5, 0, -60); await pl.wait_for_timeout(2500); await still(pl, 'fog-out')
            await gm.evaluate("tw.registry.run('area.darkness.on')"); await idle(gm)
            await put(12.5, 7.5, 0, 45); await pl.wait_for_timeout(3000); await still(pl, 'dark-int')
            await gm.evaluate("tw.registry.run('area.darkness.off')"); await idle(gm)
            await pl.evaluate("tw.fpv.exit()")
        n = sum(1 for r in results if r[0])
        if errors: print('page errors:', *errors[:8], sep='\n  ')
        check(not [e for e in errors if 'fpv' in e.lower()], 'no page errors from first person', errors[:3])
        n = sum(1 for r in results if r[0])
        print(f'browser fpv: {n}/{len(results)} passed', flush=True)
        if A.keep: await asyncio.sleep(3600)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
