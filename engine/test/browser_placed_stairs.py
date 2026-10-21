#!/usr/bin/env python3
"""PLACED STAIRS: up and down (2026-10-11). The helpers below are browser_stairs.py's.

  TW_GPU=1 python3 engine/test/browser_placed_stairs.py --local

  NOAUTO   a room drawn by hand upstairs gets no stair; over a kitchen nothing is offered
  OFFER    over a hallway with a clear run a conditional button offers "Add stairs down"; pressing it puts the stair in
  PLACE    a flight picked in the library and clicked into a room goes UP: hole and railing drawn in the floor above
  DOWN     the ring's "Stairs down": same place in plan, one storey lower, the hole drawn in THIS floor; "Nothing below"
           is written over it until a cellar is built under it; undo; "Stairs up" from the command bar
  FOLLOW   move, turn, duplicate and delete: the drawn hole and railing follow; no hole is left behind
  POINTER  a floor stops the pointer beside the hole; through the hole the stair is reached
  SYNC     a second tab (a player) has the same stair, hole and railing at every step; its pawn crosses

(old header) Stairs (storeys, Stage D; docs/VERTICAL.md "Getting up and down", docs/UI.md "Stairs"). GM tab + player tab.

  local:  TW_GPU=1 python3 engine/test/browser_stairs.py --local
  shots:  ... browser_stairs.py --local --shots   (full look; engine/test/shots/stairs-*.png for a Gemini blind read)

  AUTO     drawing an upper room adds its stair (its own command); a cellar beside the inn gets one up to open ground
  HOLE     the floor and slab above are cut on exactly the stair's squares; the ground is cut over the cellar's stair
  LOOK     the stair is the catalog's mesh, fitted to its rise and run, its high end at the upper floor's side
  UNDO     the first undo removes the stair, the second the room; redo brings both back
  EDIT     moving it moves the hole; R turns it a quarter turn; a drag keeps it on whole squares
  TOUCH    everything on screen is touchable at each cut
  PAWNS    a pawn dragged onto the stair from below arrives on the landing upstairs (y = 10); its owner is offered
           "Cut to lv 2" and the view does not move; dragged onto the hole from above, it goes down
  REROLL   re-rolling either room keeps the stair and keeps furniture off it
  SECRETS  a hidden cellar's stair is not sent to the player: no stair, no hole in the ground
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from audit import AUDIT  # noqa: E402
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18097, 18722
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pstairs-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
async def view(pg, x, z, dist=80, pitch=60, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def drag(pg, a, b, steps=12):
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(25)
    await pg.mouse.up(); await pg.wait_for_timeout(500)

# a stair as the game sees it: the entity, its squares, its ends, what it joins
STAIR = "((id) => { const E = tw.entities(), s = E[id]; if (!s) return null; const S = tw.ST; return { id, cat: s.cat, sku: s.sku, url: s.url, place: s.place, rise: S.stairRise(s), down: !!s.down, works: !S.stairStatus(E, s).code, x: s.x, y: s.y || 0, z: s.z, rot: s.rot || 0, room: s.room, hidden: !!s.hidden, cells: S.stairCells(s), ends: S.stairEnds(s), links: S.stairLinks(E, s), kind: S.stairKind(s) }; })"
# what is drawn of a room's floor: the floor tiles and the slab boxes standing on given squares
FLOOR_ON = """((rid, cells) => { const w = tw.worldOf(tw.area()); let tiles = 0, slab = 0; const inCell = (x, z) => cells.some(([gx, gz]) => x > gx * 5 && x < gx * 5 + 5 && z > gz * 5 && z < gz * 5 + 5);
  for (const s of w.shell.values()) { if (s.roomId !== rid || s.spec.layer !== 'floor') continue;
    if (s.spec.slab) { s.group.updateMatrixWorld(true); s.visual?.traverse?.(o => { if (o.isMesh) { const p = o.getWorldPosition(new (o.position.constructor)()); const sx = o.geometry.parameters?.width || 5, sz = o.geometry.parameters?.depth || 5; if (sx <= 5.01 && sz <= 5.01 ? inCell(p.x, p.z) : cells.some(([gx, gz]) => Math.abs(p.x - (gx * 5 + 2.5)) < sx / 2 && Math.abs(p.z - (gz * 5 + 2.5)) < sz / 2)) slab++; } }); }
    else if (inCell(s.spec.x, s.spec.z)) tiles++; }
  return { tiles, slab }; })"""
# is the stair's mesh the real piece, and does it climb toward its top end? (mean height of its vertices near each end)
CLIMB = """((id) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id), s = tw.entities()[id], E = tw.ST.stairEnds(s); if (!r?.visual) return null;
  r.group.updateMatrixWorld(true); const v = new (r.group.position.constructor)(); let lo = [0, 0], hi = [0, 0], minY = 1e9, maxY = -1e9;
  r.visual.traverse(o => { if (!o.isMesh || !o.geometry?.attributes?.position) return; const p = o.geometry.attributes.position, st = Math.max(1, Math.floor(p.count / 2000));
    for (let i = 0; i < p.count; i += st) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      const df = Math.hypot(v.x - E.foot.x, v.z - E.foot.z), dt = Math.hypot(v.x - E.top.x, v.z - E.top.z); if (df < dt) { lo[0] += v.y; lo[1]++; } else { hi[0] += v.y; hi[1]++; } } });
  return { placeholder: !!r.visual.userData?.placeholder, info: r.visual.userData?.stair || null, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), footHalf: +(lo[0] / Math.max(1, lo[1])).toFixed(2), topHalf: +(hi[0] / Math.max(1, hi[1])).toFixed(2) }; })"""
ONSTAIR = """((rid, cells) => Object.values(tw.entities()).filter(o => o.kind === 'object' && o.room === rid && !tw.ST.isConnector(o) && !o.parent && o.place !== 'ceiling' && o.place !== 'wall' && !o.flat && cells.some(([gx, gz]) => o.x > gx * 5 + 0.3 && o.x < gx * 5 + 4.7 && o.z > gz * 5 + 0.3 && o.z < gz * 5 + 4.7)).map(o => o.cat))"""

async def main():
    page = start_local(False) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, permissions=['clipboard-read', 'clipboard-write'])
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: print('    console:', m.text[:300]) if 'visual failed' in m.text else None)
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST placed stairs {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        W = "tw.worldOf(tw.area())"
        async def idle(pg=None): await wait(pg or gm, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await (pg or gm).wait_for_timeout(350)
        HOLES = "((y) => [...tw.ST.holesAt(tw.entities(), y)].sort())"
        RAILS = f"(() => {W}.rails().map(r => r.key).sort())"
        NOTES = f"(() => {W}.stairNoteList())"

        # ================= NOAUTO / OFFER =================
        print('NOAUTO: a room drawn by hand gets no stair')
        K = await gm.evaluate("tw.spawnRoom('kitchen', 0, 0, 5, 4, 4)"); await idle()
        KU = await gm.evaluate("tw.spawnRoom('guest', 0, 0, 5, 4, 41, undefined, 10)"); await idle()
        check(await gm.evaluate("tw.stairs().length") == 0 and await gm.evaluate("tw.lastStair") is None, 'a room drawn over a kitchen: no stair is placed')
        check(await gm.evaluate("tw.lastStairOffer") is None and not await gm.evaluate("tw.condButtons.has('stair-offer')"), 'and none is offered (a kitchen is not where a stair lines up)')
        print('OFFER: a hallway below with a clear run')
        H = await gm.evaluate("tw.spawnRoom('hallway', 8, 0, 2, 6, 9)"); await idle()
        hall_free = await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{H}' && !o.parent && o.place !== 'wall' && o.place !== 'ceiling' && !o.flat).length")
        HU = await gm.evaluate("tw.spawnRoom('guest', 8, 0, 2, 6, 42, undefined, 10)"); await idle()
        off = await gm.evaluate("tw.lastStairOffer"); btn = await gm.evaluate("tw.condButtons.list().filter(b => b.key === 'stair-offer')")
        check(await gm.evaluate("tw.stairs().length") == 0, 'drawing the room over the hallway places no stair either')
        check(off and off['label'] == 'Add stairs down' and off['from'] == H and len(btn) == 1 and btn[0]['text'] == 'Add stairs down', 'but a flight lines up with the hallway: a conditional button offers "Add stairs down"', f'{off} {btn} (hallway things on the floor: {hall_free})')
        await view(gm, 45, 15, 70, 60); await settle(gm)
        if off:
            await gm.click('.cbtn:has-text("Add stairs down")'); await wait(gm, "tw.stairs().length === 1 && tw.sync.pendingCount() === 0", 20000, 'offered stair placed')
            s0 = (await gm.evaluate("tw.stairs()"))[0]
            check(s0['works'] and s0.get('down') and s0['from'] == H and s0['to'] == HU and s0['kind'] == 'straight', 'pressing it puts a straight flight in, from the hallway up into the new room, and it works', json.dumps(s0)[:300])
            on = await gm.evaluate(ONSTAIR + f"('{HU}', {json.dumps([[c[0] // 5, c[1] // 5] for c in s0['cells']])})")
            check(not on, 'the new room was laid again round the hole', str(on))
            await gm.keyboard.press('Control+z'); await wait(gm, "tw.stairs().length === 0 && tw.sync.pendingCount() === 0", 10000, 'offer undone')
            check(await gm.evaluate("tw.stairs().length") == 0 and await gm.evaluate(HOLES + "(10)") == [], 'one undo takes the stair away and closes the floor')

        # ================= PLACE =================
        print('PLACE: a flight from the library goes up')
        G = await gm.evaluate("tw.spawnRoom('common', 14, 0, 6, 5, 6)"); await idle()
        await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{G}').forEach(o => tw.dispatch('object.delete', {{ id: o.id }}))"); await idle()  # an empty room: the test is about the stair
        U = await gm.evaluate("tw.spawnRoom('guest', 14, 0, 6, 5, 43, undefined, 10)"); await idle()
        await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{U}').forEach(o => tw.dispatch('object.delete', {{ id: o.id }}))"); await idle()
        await gm.evaluate("tw.condButtons.hide('stair-offer')")
        await view(gm, 85, 12.5, 75, 62); await settle(gm)
        await gm.evaluate("(tw.setLevel(0), tw.setCut(9, { pinned: true, by: 'test' }))"); await gm.wait_for_timeout(500)
        lvl = await gm.evaluate("tw.level")
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('stair-straight'))"); await gm.wait_for_timeout(300)
        pt = await scr(gm, 85, 12.5, 0); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(200); await gm.mouse.click(pt['x'], pt['y'])
        await wait(gm, "tw.stairs().length === 1 && tw.sync.pendingCount() === 0", 15000, 'placed'); await gm.keyboard.press('Escape')
        SID = (await gm.evaluate("tw.stairs()"))[0]['id']; st = await gm.evaluate(STAIR + f"('{SID}')")
        check(st and st['place'] == 'kit' and st['y'] == 0 and not st['down'] and st['room'] == G and len(st['cells']) == 2, 'picked in the library and clicked into the room it is an ordinary object of that room, on two whole squares', json.dumps(st and {k: st[k] for k in ('sku', 'x', 'y', 'z', 'cells', 'room')}))
        holes = await gm.evaluate(HOLES + "(10)")
        check(holes == sorted(f"{c[0]}:{c[1]}" for c in st['cells']) and st['works'], 'it goes UP by default: the floor above is open on exactly its squares, and it works', str(holes))
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(600)
        f = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(st['cells'])})")
        check(f == {'tiles': 0, 'slab': 0}, 'DRAWN: no floor tile and no slab on those squares upstairs', str(f))
        await wait(gm, f"{W}.rails().filter(r => r.stair === '{SID}').length > 0", 10000, 'rails')
        r_up = await gm.evaluate(RAILS + "()")
        check(len(r_up) >= 3 and all(k.endswith('@10') for k in r_up), 'and a railing is drawn round the hole, on the floor above', str(r_up))
        await wait(gm, f"!{W}.recs.get('{SID}').visual.userData?.placeholder", 60000, 'stair mesh')
        cl = await gm.evaluate(CLIMB + f"('{SID}')")
        check(cl and not cl['placeholder'] and abs(cl['minY']) < 0.4 and abs(cl['maxY'] - 10) < 0.8 and cl['topHalf'] > cl['footHalf'] + 1.5, 'the mesh is the real flight, floor to floor, higher at its top end', str(cl))
        check(await gm.evaluate(NOTES + "()") == [], 'a stair that works carries no note')

        # ================= SYNC (the second tab) =================
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        PL = await pl.evaluate('tw.me()')
        async def same(what):
            await idle(gm); await wait(pl, f"JSON.stringify(tw.stairs().map(s => [s.id, s.cells, s.top, s.bottom, !!s.down, s.works])) === {json.dumps(json.dumps(await gm.evaluate('tw.stairs().map(s => [s.id, s.cells, s.top, s.bottom, !!s.down, s.works])'), separators=(',', ':')))}", 8000, f'player sync: {what}')
            a = await gm.evaluate("[tw.stairs().map(s => [s.id, s.cells, s.top, s.bottom, !!s.down, s.works]), " + HOLES + "(0), " + HOLES + "(10)]"); b = await pl.evaluate("[tw.stairs().map(s => [s.id, s.cells, s.top, s.bottom, !!s.down, s.works]), " + HOLES + "(0), " + HOLES + "(10)]")
            check(a == b, f'SYNC {what}: the player has the same stairs and the same holes', '' if a == b else f'{a} != {b}')
        await same('placed')

        # ================= DOWN =================
        print('DOWN: the ring switches it to stairs down')
        await gm.evaluate("(tw.setLevel(0), tw.setCut(9, { pinned: true, by: 'test' }))"); await gm.wait_for_timeout(400)
        await gm.evaluate(f"tw.select('{SID}')"); await gm.wait_for_timeout(300)
        menu = await gm.evaluate("tw.menuFor ? tw.menuFor().map(n => n.cmd ? [n.cmd.id, String(tw.R.titleOf(n.cmd, tw.ctx()))] : [n.group]) : null")
        if menu is not None: check(any(m[0] == 'stair.flip' and m[1].startswith('Stairs down') for m in menu), 'the stair\'s menu has "Stairs down"', str(menu))
        await gm.keyboard.press('/'); await gm.keyboard.type('stairs down', delay=8); await gm.wait_for_timeout(350)
        top = await gm.evaluate("document.querySelector('#bar .row.active, #results .active, .cmdrow.active')?.textContent || ''")
        await gm.keyboard.press('Enter'); await wait(gm, f"(tw.entities()['{SID}'].y || 0) === -10 && tw.sync.pendingCount() === 0", 8000, 'switched down')
        d = await gm.evaluate(STAIR + f"('{SID}')")
        check(d['y'] == -10 and d['down'] and d['x'] == st['x'] and d['z'] == st['z'] and abs(d['rot'] - st['rot']) < 1e-9 and d['cells'] == st['cells'], '"Stairs down": it keeps its place in plan and its turn and stands one storey lower', f"{top!r} {json.dumps({k: d[k] for k in ('x', 'y', 'z', 'down', 'room')})}")
        check(await gm.evaluate(HOLES + "(0)") == holes and await gm.evaluate(HOLES + "(10)") == [], 'the hole is now in THIS floor; the floor above is whole')
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(600)
        f0 = await gm.evaluate(FLOOR_ON + f"('{G}', {json.dumps(st['cells'])})"); f1 = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(st['cells'])})")
        check(f0['tiles'] == 0 and f1['tiles'] == 2, 'DRAWN: this floor is open on its squares, and the floor above has its tiles back (no orphan hole)', f'{f0} {f1}')
        r_dn = await gm.evaluate(RAILS + "()")
        check(len(r_dn) >= 3 and not any('@' in k for k in r_dn), 'the railing moved down with the hole', str(r_dn))
        nt = await gm.evaluate(NOTES + "()")
        check(len(nt) == 1 and nt[0]['id'] == SID and nt[0]['text'] == 'Nothing below' and nt[0]['code'] == 'nothing-below', 'with no storey below it SAYS so: "Nothing below" is written over it', str(nt))
        if A.shots:
            os.makedirs(SHOTS, exist_ok=True)
            await gm.evaluate("(tw.setLevel(0), tw.setCut(9, { pinned: true, by: 'test' }))"); await gm.evaluate("tw.select([])"); await view(gm, 85, 12.5, 48, 58, 0.5); await settle(gm); await gm.wait_for_timeout(2500)
            await gm.screenshot(path=os.path.join(SHOTS, 'placed-stairs-nothing-below.png'))
            await gm.evaluate("tw.setCut(null, { by: 'test' })")
        await same('stairs down')
        # a cellar under it: it works, with nothing done to the stair
        C = await gm.evaluate("tw.spawnRoom('cellar', 14, 0, 6, 5, 3, undefined, -10)"); await idle()
        await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{C}').forEach(o => tw.dispatch('object.delete', {{ id: o.id }}))"); await idle()
        await gm.evaluate("tw.condButtons.hide('stair-offer')")
        d2 = (await gm.evaluate("tw.stairs()"))[0]
        check(d2['works'] and d2['from'] == C and d2['to'] == G and await gm.evaluate(NOTES + "()") == [], 'a cellar drawn under it: it works (cellar to this room) and the note is gone', json.dumps(d2)[:260])
        check(await gm.evaluate("tw.stairs().length") == 1, 'and the cellar was given no stair of its own')
        await same('cellar built')
        if A.shots:
            os.makedirs(SHOTS, exist_ok=True)
            await gm.evaluate("(tw.setLevel(0), tw.setCut(9, { pinned: true, by: 'test' }))"); await gm.evaluate("tw.select([])"); await view(gm, 85, 12.5, 48, 58, 0.5); await settle(gm); await gm.wait_for_timeout(2500)
            await gm.screenshot(path=os.path.join(SHOTS, 'placed-stairs-down.png'))
            await gm.evaluate("tw.setCut(null, { by: 'test' })")
        # undo / redo of the switch itself
        await gm.evaluate(f"tw.select('{SID}')"); await gm.evaluate("tw.flipStairs()"); await wait(gm, f"(tw.entities()['{SID}'].y || 0) === 0 && tw.sync.pendingCount() === 0", 8000, 'up again')
        check(await gm.evaluate(HOLES + "(10)") == holes and await gm.evaluate(HOLES + "(0)") == [] and not await gm.evaluate(f"!!tw.entities()['{SID}'].down"), '"Stairs up" puts it back: the hole above, this floor whole')
        await gm.keyboard.press('Control+z'); await wait(gm, f"(tw.entities()['{SID}'].y || 0) === -10 && tw.sync.pendingCount() === 0", 8000, 'undo the switch')
        check(await gm.evaluate(HOLES + "(0)") == holes and await gm.evaluate(HOLES + "(10)") == [], 'undo: stairs down again, hole and all')
        await same('undo')

        # ================= POINTER =================
        print('POINTER: a floor stops the pointer; the hole lets it through')
        await gm.evaluate("tw.select([])"); await gm.evaluate("(tw.setLevel(0), tw.setCut(9, { pinned: true, by: 'test' }))"); await view(gm, 85, 12.5, 60, 70); await gm.wait_for_timeout(600)
        await gm.evaluate(f"tw.dispatch('object.place', {{ id: 'obj_barrel00001', name: 'barrel', cat: 'barrel', x: 77.5, y: -10, z: 22.5, room: '{C}', dims: [2.5, 3.5, 2.5] }})"); await idle()
        pk_floor = await gm.evaluate(f"(() => {{ const p = tw.screenOf(77.5, 22.5, tw.main, 0); return {W}.pick(tw.rayAt(p.x, p.y))?.entity?.id || null; }})()")
        pk_hole = await gm.evaluate(f"(() => {{ const s = tw.entities()['{SID}'], p = tw.screenOf(s.x, s.z, tw.main, -4); return {W}.pick(tw.rayAt(p.x, p.y))?.entity?.id || null; }})()")
        check(pk_floor != 'obj_barrel00001', 'a barrel in the cellar under whole floor is not reached through the floor', str(pk_floor))
        check(pk_hole == SID, 'through the hole the stair is reached', str(pk_hole))
        gk = await gm.evaluate(f"{W}.groundKey.split(',')")
        check(all(f"{c[0]}:{c[1]}" in gk for c in st['cells']), 'DRAWN: the ground itself is open in the hole of a ground-floor room (the stair below shows, not grass)', str(gk))

        # ================= PAWN =================
        print('PAWN: down the stairs-down and back')
        ends = d2
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_mira00001', name: 'Mira', x: {ends['top'][0]}, z: {ends['top'][1]}, owner: '{PL}' }})")
        await wait(pl, "tw.entities()['tok_mira00001']", 8000); await settle(pl, 60000)
        await pl.evaluate("(tw.setLevel(0), tw.setCut(9, { pinned: true, by: 'test' }))"); await view(pl, 85, 12.5, 45, 64); await pl.wait_for_timeout(600)
        a = await scr(pl, ends['top'][0], ends['top'][1], 1.2); b = await scr(pl, st['x'], st['z'], 0)
        await drag(pl, a, b); await wait(pl, "(tw.entities()['tok_mira00001'].y || 0) === -10 && tw.sync.pendingCount() === 0", 8000, 'pawn down')
        t = await pl.evaluate("tw.entities()['tok_mira00001']")
        check(t.get('y') == -10 and abs(t['x'] - ends['bottom'][0]) < 0.01 and abs(t['z'] - ends['bottom'][1]) < 0.01, 'the player\'s pawn dragged onto the hole goes down to the stair\'s foot in the cellar', f"({t['x']}, {t['z']}, y {t.get('y')}) want {ends['bottom']}")
        await wait(pl, "tw.condButtons.has('cut-offer')", 6000, 'the cut offer')
        check(await pl.evaluate("tw.condButtons.list().some(b => b.key === 'cut-offer' && /lv -1/.test(b.text))"), 'and its owner is offered the cut to lv -1 (the view does not move by itself)')
        check(await gm.evaluate("(tw.entities()['tok_mira00001'].y || 0) === -10"), 'the GM sees it in the cellar')
        hop = await pl.evaluate(f"tw.stairHop({st['x']}, {st['z']}, -10)")
        check(hop and hop['y'] == 0, 'from the cellar the same stair takes it up again', str(hop))

        # ================= FOLLOW =================
        print('FOLLOW: move, turn, duplicate, delete')
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.evaluate(f"tw.select('{SID}')"); await gm.wait_for_timeout(200)
        await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{SID}', x: {st['x']} + 5, z: {st['z']} + 5 }})"); await idle()
        m = await gm.evaluate(STAIR + f"('{SID}')"); hm = await gm.evaluate(HOLES + "(0)")
        fold = await gm.evaluate(FLOOR_ON + f"('{G}', {json.dumps([c for c in st['cells'] if c not in m['cells']])})"); fnew = await gm.evaluate(FLOOR_ON + f"('{G}', {json.dumps(m['cells'])})")
        check(hm == sorted(f"{c[0]}:{c[1]}" for c in m['cells']) and fnew['tiles'] == 0 and fold['tiles'] >= 1 and m['y'] == -10, 'moved: the drawn hole is where the stair is now and the floor is back where it was', f'{hm} {fold} {fnew}')
        rm = await gm.evaluate(RAILS + "()"); check(rm != r_dn and len(rm) >= 3, 'the railing went with it', str(rm))
        await gm.keyboard.press('r'); await wait(gm, f"Math.abs((tw.entities()['{SID}'].rot || 0) - {m['rot']}) > 0.1 && tw.sync.pendingCount() === 0", 6000, 'turned')
        t2 = await gm.evaluate(STAIR + f"('{SID}')"); ht = await gm.evaluate(HOLES + "(0)")
        check(abs(abs(t2['rot'] - m['rot']) - 1.5708) < 0.01 and ht == sorted(f"{c[0]}:{c[1]}" for c in t2['cells']) and ht != hm, 'R turns it a quarter turn and the hole turns with it', f'{hm} -> {ht}')
        await same('moved and turned')
        await gm.keyboard.press('Control+d'); await wait(gm, "tw.stairs().length === 2 && tw.sync.pendingCount() === 0", 8000, 'duplicate')
        two = await gm.evaluate("tw.stairs()"); dup = next((s for s in two if s['id'] != SID), None)
        check(dup and dup.get('down') and dup['top'][2] == 0 and len(await gm.evaluate(HOLES + "(0)")) >= 3, 'Ctrl+D: the duplicate is a stairs-down too, with a hole of its own', json.dumps(dup)[:200] if dup else '')
        await same('duplicated')
        if dup:
            await gm.evaluate(f"tw.select('{dup['id']}')"); await gm.wait_for_timeout(150); await gm.keyboard.press('Delete'); await wait(gm, "tw.stairs().length === 1 && tw.sync.pendingCount() === 0", 8000, 'duplicate deleted')
        await gm.evaluate(f"tw.select('{SID}')"); await gm.wait_for_timeout(150); await gm.keyboard.press('Delete'); await wait(gm, "tw.stairs().length === 0 && tw.sync.pendingCount() === 0", 8000, 'deleted')
        await gm.wait_for_timeout(500)
        fa = await gm.evaluate(FLOOR_ON + f"('{G}', {json.dumps(t2['cells'])})")
        check(await gm.evaluate(HOLES + "(0)") == [] and await gm.evaluate(HOLES + "(10)") == [] and await gm.evaluate(RAILS + "()") == [] and fa['tiles'] == len(t2['cells']), 'deleted: no hole on any floor, no railing, the floor tiles are back', f"{fa}")
        await same('deleted')
        await gm.keyboard.press('Control+z'); await wait(gm, "tw.stairs().length === 1 && tw.sync.pendingCount() === 0", 8000, 'delete undone')
        check(await gm.evaluate(HOLES + "(0)") == ht and len(await gm.evaluate(RAILS + "()")) >= 3, 'undo: the stair, its hole and its railing are back')
        await same('delete undone')
        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"placed stairs: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
