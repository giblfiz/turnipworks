#!/usr/bin/env python3
"""Stairs (storeys, Stage D; docs/VERTICAL.md "Getting up and down", docs/UI.md "Stairs"). GM tab + player tab.

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

RP, SP = 18091, 18716
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-stairs-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
            pg.on('console', lambda m: print('    console:', m.text[:400]) if 'visual failed' in m.text else None)
            await pg.goto(url); return pg
        gm = await tab(page, *((1920, 1080) if full else (1400, 900)))
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST stairs {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')

        # ================= AUTO =================
        print('AUTO: a storey with no connection gets its stair')
        G = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 6)")
        await wait(gm, f"tw.entities()['{G}'] && tw.sync.pendingCount() === 0", 30000, 'ground room')
        check(await gm.evaluate("tw.lastStair") is None and await gm.evaluate("tw.stairs().length") == 0, 'a ground-floor room gets no stair')
        low0 = await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{G}').length")
        seq0 = await gm.evaluate("tw.applied.length")
        U = await gm.evaluate("tw.spawnRoom('guest', 0, 0, 4, 4, 56, undefined, 10)")
        await wait(gm, f"tw.entities()['{U}'] && tw.sync.pendingCount() === 0", 30000, 'upper room')
        # (2026-10-11) a room drawn by hand gets NO stair; the planner's stair is asked for ("Add stair"), its own command
        check(await gm.evaluate("tw.lastStair") is None and await gm.evaluate("tw.stairs().length") == 0, 'drawing an upper room places no stair by itself')
        offered = await gm.evaluate("tw.lastStairOffer && tw.condButtons.has('stair-offer')")
        check(offered, 'over a common room with a free run a flight lines up: "Add stairs down" is offered beside the new room', str(await gm.evaluate("tw.lastStairOffer")))
        await gm.evaluate(f"tw.takeStairOffer('{U}') || tw.addStair(tw.entities()['{U}'])")
        await wait(gm, f"tw.stairs().length === 1 && tw.sync.pendingCount() === 0", 30000, 'the stair')
        await gm.evaluate("tw.lastStair = tw.stairs()[0].id")
        SID = await gm.evaluate("tw.lastStair"); st = await gm.evaluate(STAIR + f"('{SID}')")
        toast = await gm.evaluate("document.querySelector('#toast').textContent")
        applied = await gm.evaluate(f"tw.applied.slice({seq0}).map(a => a[3])")
        check(st and st['place'] == 'kit' and st['down'] and st['works'] and st['room'] == G and st['y'] == 0 and st['links'] == {'from': G, 'to': U} and st['url'], 'the planner\'s stair for the upper room comes up into it from the room below: an ordinary placed stair of the LOWER room, a real catalog piece, put in for the room above', json.dumps({k: st[k] for k in ('cat', 'sku', 'kind', 'cells', 'links')} if st else None))
        check(applied[-2:] in (['room.spawn', 'batch'], ['room.spawn', 'object.place']), 'the stair is its OWN command, after the room', str(applied))
        check(await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{G}' && !tw.ST.isConnector(o)).length") == low0, 'nothing in the room below was removed for it')
        check(not await gm.evaluate(ONSTAIR + f"('{U}', {json.dumps(st['cells'] + [st['ends']['topCell']])})"), 'the room above was laid again round the hole and the top landing')
        # a cellar beside the inn (nothing above it): a stair up to open ground
        C = await gm.evaluate("tw.spawnRoom('cellar', 7, 0, 3, 3, 3, undefined, -10)")
        await wait(gm, f"tw.entities()['{C}'] && tw.sync.pendingCount() === 0", 30000, 'cellar')
        check(await gm.evaluate("tw.stairs().length") == 1, 'nor does a cellar drawn by hand get one')
        await gm.evaluate(f"tw.lastStair = tw.addStair(tw.entities()['{C}'])")
        await wait(gm, f"tw.lastStair && tw.entities()[tw.lastStair]?.room === '{C}' && tw.sync.pendingCount() === 0", 30000, 'cellar stair')
        CID = await gm.evaluate("tw.lastStair"); cs = await gm.evaluate(STAIR + f"('{CID}')")
        check(cs and cs['room'] == C and cs['y'] == -10 and not cs['down'] and cs['works'] and cs['links']['to'] is None, 'a cellar with nothing above it gets a stair up to open ground', json.dumps(cs and {k: cs[k] for k in ('kind', 'cells', 'links')}))
        await settle(gm)
        await view(gm, 22, 10, 85, 60)
        if A.shots: return await shots(gm, G, U, C, SID, browser)

        # ================= HOLE =================
        print('HOLE: the floor above is cut on exactly the stair\'s squares')
        other = [[c[0] + (2 if c[0] < 2 else -2), c[1]] for c in st['cells']]
        f = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(st['cells'])})"); fo = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps([c for c in other if c not in st['cells']])})")
        check(f['tiles'] == 0 and f['slab'] == 0 and fo['tiles'] >= 1 and fo['slab'] >= 1, 'no floor tile and no slab on the stair\'s squares upstairs; floor and slab elsewhere', str({'hole': f, 'elsewhere': fo}))
        gk = await gm.evaluate("tw.worldOf(tw.area()).groundKey")
        check(all(f"{c[0]}:{c[1]}" in gk.split(',') for c in cs['cells']), 'the ground is cut where the cellar\'s stair comes up, with the cut off', gk)
        g = await gm.evaluate(f"(() => {{ const s = tw.entities()['{SID}']; return tw.groundAt(tw.screenOf(s.x, s.z, tw.main, 0).x, tw.screenOf(s.x, s.z, tw.main, 0).y) && tw.worldOf(tw.area()).pick(tw.rayAt(tw.screenOf(s.x, s.z, tw.main, 3).x, tw.screenOf(s.x, s.z, tw.main, 3).y))?.entity?.id; }})()")
        await gm.evaluate("tw.setCut(9, { pinned: true, by: 'test' })"); await gm.wait_for_timeout(400)
        pk = await gm.evaluate(f"(() => {{ const s = tw.entities()['{SID}'], p = tw.screenOf(s.x, s.z, tw.main, 4); return tw.worldOf(tw.area()).pick(tw.rayAt(p.x, p.y))?.entity?.id; }})()")
        check(pk == SID, 'with the cut at lv 1 a click on the stair picks the stair', str(pk))

        # ================= LOOK =================
        print('LOOK: the catalog\'s stair, fitted, climbing toward the upper floor')
        await wait(gm, f"!tw.worldOf(tw.area()).recs.get('{SID}').visual.userData?.placeholder", 30000, 'stair mesh')
        cl = await gm.evaluate(CLIMB + f"('{SID}')")
        check(cl and not cl['placeholder'] and not cl['info'] and abs(cl['minY']) < 0.4 and abs(cl['maxY'] - 10) < 0.6 and cl['topHalf'] > cl['footHalf'] + 1.5, 'the stair is the real mesh (no stand-in), from the floor to 10 ft, higher at its top end than at its foot', str(cl))

        ks = [k for k in await gm.evaluate("tw.worldOf(tw.area()).kitReport()") if k['kind'] == 'stair' and k['role'] == 'straight']
        hole = await gm.evaluate(f"(() => {{ const s = tw.entities()['{SID}']; return tw.ST.stairDir(s); }})()")  # the way it climbs (toward the hole's far end)
        sxz = await gm.evaluate(f"[tw.entities()['{SID}'].x, tw.entities()['{SID}'].z]")
        k0 = next((k for k in ks if abs(k['at'][0] - sxz[0]) < 0.01 and abs(k['at'][2] - sxz[1]) < 0.01), None)
        up = k0 and (k0['lowAt'][0] * hole[0] + k0['lowAt'][1] * hole[1])  # its low part sits at the foot: against the climb
        check(k0 and '--t10' in (k0['sku'] or '') and abs(k0['max'][1] - (k0['at'][1] + 10)) < 0.2 and abs(k0['min'][1] - k0['at'][1]) < 0.2 and up < -0.1, 'it is the flight made for a 10-ft storey (--t10): top tread within 0.2 ft of the upper floor, foot on the lower, its low end at the foot of the climb', str(k0 and (k0['sku'], k0['min'], k0['max'], k0['lowAt'], hole)))

        # ================= UNDO =================
        print('UNDO: the stair first, then the room')
        await gm.evaluate("tw.setCut(null, { by: 'test' })")
        # (the cellar and its stair were made after the upper room: take them back first, then the upper room's own two steps)
        await gm.keyboard.press('Control+z'); await wait(gm, f"!tw.entities()['{CID}'] && tw.sync.pendingCount() === 0", 8000, 'cellar stair undone')
        check(await gm.evaluate(f"!tw.entities()['{CID}'] && !!tw.entities()['{C}']"), 'the first undo removes just the stair: the cellar stays')
        await gm.keyboard.press('Control+z'); await wait(gm, f"!tw.entities()['{C}'] && tw.sync.pendingCount() === 0", 8000, 'cellar undone')
        await gm.keyboard.press('Control+z'); await wait(gm, f"!tw.entities()['{SID}'] && tw.sync.pendingCount() === 0", 8000, 'stair undone')
        ff = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(st['cells'])})")
        check(await gm.evaluate(f"!tw.entities()['{SID}'] && !!tw.entities()['{U}']") and ff['tiles'] == 2 and ff['slab'] >= 1, 'undo again: the upper room\'s stair goes, the room stays, and its floor is whole again', str(ff))
        await gm.keyboard.press('Control+z'); await wait(gm, f"!tw.entities()['{U}'] && tw.sync.pendingCount() === 0", 8000, 'room undone')
        check(await gm.evaluate(f"!tw.entities()['{U}'] && !!tw.entities()['{G}']"), 'the next undo removes the upper room')
        for (what, js) in (('the room', f"tw.entities()['{U}']"), ('its stair', f"tw.entities()['{SID}']"), ('the cellar', f"tw.entities()['{C}']"), ("the cellar's stair", f"tw.entities()['{CID}']")):
            await gm.keyboard.press('Control+Shift+z'); await wait(gm, f"{js} && tw.sync.pendingCount() === 0", 8000, f'redo {what}')
        check(await gm.evaluate(f"['{U}', '{SID}', '{C}', '{CID}'].every(id => !!tw.entities()[id])"), 'redo brings them back in order: the room, its stair, the cellar, its stair')
        await settle(gm)
        # "Add stair": delete the stair, then ask for one from the command bar with the room selected
        await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{SID}' }})"); await wait(gm, f"!tw.entities()['{SID}'] && tw.sync.pendingCount() === 0", 8000)
        await gm.evaluate(f"tw.select('{U}')"); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('add stair', delay=8); await gm.wait_for_timeout(350)
        row = await gm.evaluate("document.querySelector('#results .res .t')?.innerText || ''"); await gm.keyboard.press('Enter')
        await wait(gm, f"tw.stairs().some(s => s.to === '{U}') && tw.sync.pendingCount() === 0", 8000, 'stair added from the bar')
        added = await gm.evaluate(f"tw.stairs().filter(s => s.to === '{U}').map(s => s.id)")
        check('stair' in row.lower() and len(added) == 1, '"Add stair" is in the command bar: it joins the selected room to the storey below', f'{row!r} {added}')
        SID = added[0] if added else SID
        await gm.keyboard.press('Escape'); await gm.evaluate("tw.select([])")
        await wait(gm, f"!tw.worldOf(tw.area()).recs.get('{SID}').visual.userData?.placeholder", 30000, 'stair mesh')
        await settle(gm)

        # ================= EDIT =================
        print('EDIT: moving it moves the hole; R turns it a quarter turn; a drag keeps whole squares')
        await gm.evaluate("tw.setCut(9, { pinned: true, by: 'test' })"); await gm.wait_for_timeout(300)
        st = await gm.evaluate(STAIR + f"('{SID}')")
        await gm.evaluate(f"tw.select('{SID}')"); await gm.wait_for_timeout(250)
        rot0 = st['rot']; await gm.keyboard.press('r'); await wait(gm, f"Math.abs((tw.entities()['{SID}'].rot || 0) - {rot0}) > 0.1 && tw.sync.pendingCount() === 0", 6000, 'turned')
        r1 = await gm.evaluate(f"tw.entities()['{SID}'].rot || 0")
        check(abs(abs(r1 - rot0) - 1.5708) < 0.01, 'R turns a stair a quarter turn (it stands on whole squares)', f'{rot0:.2f} -> {r1:.2f}')
        await gm.keyboard.press('Control+z'); await wait(gm, f"Math.abs((tw.entities()['{SID}'].rot || 0) - {rot0}) < 0.01 && tw.sync.pendingCount() === 0", 6000, 'turn undone')
        a = await scr(gm, st['x'], st['z'], 2); b = await scr(gm, st['x'] + 6.2, st['z'] + 0.8, 2)
        await drag(gm, a, b); await wait(gm, "tw.sync.pendingCount() === 0", 5000)
        s2 = await gm.evaluate(STAIR + f"('{SID}')")
        moved = s2['x'] != st['x'] or s2['z'] != st['z']
        check(moved and all(abs((v / 2.5) - round(v / 2.5)) < 1e-6 for v in (s2['x'], s2['z'])) and s2['y'] == 0 and abs(s2['rot'] - st['rot']) < 0.01, 'a drag moves the stair by whole squares (released 6.2 ft away it lands on the grid), on its floor', f"({st['x']}, {st['z']}) -> ({s2['x']}, {s2['z']})")
        await gm.evaluate("tw.setCut(null, { by: 'test' })"); await gm.wait_for_timeout(500)
        fnew = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(s2['cells'])})"); gone = [c for c in st['cells'] if c not in s2['cells']]
        fold = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(gone)})") if gone else {'tiles': 1, 'slab': 1}
        inU = await gm.evaluate(f"{json.dumps(s2['cells'])}.every(([gx, gz]) => tw.footprint.hasCell(tw.entities()['{U}'].recipe, gx, gz))")
        check((not inU) or (fnew['tiles'] == 0 and fnew['slab'] == 0 and fold['tiles'] >= 1 and fold['slab'] >= 1), 'the hole upstairs follows the stair: cut where it now stands, floor back where it stood', str({'new': fnew, 'old': fold, 'under U': inU}))
        await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{SID}'].x === {st['x']} && tw.entities()['{SID}'].z === {st['z']} && tw.sync.pendingCount() === 0", 6000, 'move undone')
        st = await gm.evaluate(STAIR + f"('{SID}')")

        # ================= TOUCH =================
        print('TOUCH: everything on screen is touchable, at each cut')
        await gm.evaluate("tw.select([])")
        for (name, cut, focus) in (('cut off', None, (22, 10, 85)), ('lv 1', 9, (22, 10, 75)), ('lv 2', 19, (22, 10, 85)), ('lv -1', -1, (40, 8, 50))):
            await gm.evaluate(f"tw.setCut({json.dumps(cut)}, {{ pinned: true, by: 'test' }})"); await view(gm, focus[0], focus[1], focus[2], 60); await gm.wait_for_timeout(500)
            au = await gm.evaluate(AUDIT)
            check(au['tested'] > 40 and au['nbad'] == 0, f'{name}: everything on screen is touchable', f"{au['tested']} points, {au['nbad']} untouchable {json.dumps(au['bad'][:4]) if au['nbad'] else ''}")
        await gm.evaluate("tw.setCut(null, { by: 'test' })")

        # ================= PAWNS =================
        print('PAWNS: across a stair')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        PL = await pl.evaluate('tw.me()')
        foot = st['ends']['foot']; top = st['ends']['top']
        px, pz = foot['x'] - (st['x'] - foot['x']) * 0.0, foot['z']  # the pawn starts on the foot landing
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_mira00001', name: 'Mira', x: {px}, z: {pz}, owner: '{PL}' }})")
        await wait(pl, "tw.entities()['tok_mira00001']", 8000); await settle(pl, 60000)
        pst = await pl.evaluate(STAIR + f"('{SID}')")
        check(pst and pst['cells'] == st['cells'] and await pl.evaluate(f"[...tw.ST.holesAt(tw.entities(), 10)].length") == await gm.evaluate("[...tw.ST.holesAt(tw.entities(), 10)].length"), 'the player has the same stair and the same hole')
        await pl.evaluate("tw.setCut(9, { pinned: true, by: 'test' })"); await view(pl, st['x'], st['z'], 45, 62); await pl.wait_for_timeout(500)
        base = await pl.evaluate("({ cut: tw.cut.y, writes: tw.cutLog.length })")
        a = await scr(pl, px, pz, 1.2); b = await scr(pl, st['x'], st['z'], 0)
        await drag(pl, a, b); await wait(pl, "(tw.entities()['tok_mira00001'].y || 0) === 10 && tw.sync.pendingCount() === 0", 6000, 'pawn upstairs')
        t = await pl.evaluate("tw.entities()['tok_mira00001']")
        check(t.get('y') == 10 and abs(t['x'] - top['x']) < 0.01 and abs(t['z'] - top['z']) < 0.01, 'a pawn dragged onto the stair from below arrives on the top landing, at the upper floor\'s height (one move)', f"({t['x']}, {t['z']}, y {t.get('y')}) want ({top['x']}, {top['z']}, 10)")
        fl = await pl.evaluate(f"(() => {{ const f = tw.ST && tw.entities()['tok_mira00001']; const H = tw.levelInfo; return null; }})()")
        await wait(pl, "tw.condButtons.has('cut-offer')", 6000, 'the offer')
        of = await pl.evaluate("tw.condButtons.list().filter(b => b.key === 'cut-offer')"); now = await pl.evaluate("({ cut: tw.cut.y, writes: tw.cutLog.length })")
        check(len(of) == 1 and of[0]['text'] == 'Cut to lv 2', 'its owner is offered "Cut to lv 2"', str(of))
        check(now == base, 'and the view did not move by itself: the cut is what it was', f'{base} -> {now}')
        check(await gm.evaluate("(tw.entities()['tok_mira00001'].y || 0) === 10"), 'the GM sees the pawn upstairs too')
        # from above: with the cut showing lv 2, drag it onto the hole
        await pl.evaluate("tw.setCut(19, { pinned: true, by: 'test' })"); await pl.wait_for_timeout(500)
        a = await scr(pl, top['x'], top['z'], 11.2); b = await scr(pl, st['x'], st['z'], 10)
        await drag(pl, a, b); await wait(pl, "(tw.entities()['tok_mira00001'].y || 0) === 0 && tw.sync.pendingCount() === 0", 6000, 'pawn downstairs')
        t = await pl.evaluate("tw.entities()['tok_mira00001']")
        check((t.get('y') or 0) == 0 and abs(t['x'] - foot['x']) < 0.01 and abs(t['z'] - foot['z']) < 0.01, 'dragged onto the hole from above, it goes down to the stair\'s foot', f"({t['x']}, {t['z']}, y {t.get('y')})")
        # with the cut showing the destination, a pawn can simply be dragged onto that floor
        far = await pl.evaluate(f"(() => {{ const rc = tw.entities()['{U}'].recipe, S = tw.ST, holes = S.holesAt(tw.entities(), 10); for (let i = 0; i < rc.w; i++) for (let j = 0; j < rc.d; j++) {{ const gx = rc.x + i, gz = rc.z + j; if (holes.has(gx + ':' + gz)) continue; const p = tw.screenOf(gx * 5 + 2.5, gz * 5 + 2.5, tw.main, 10), hit = tw.worldOf(tw.area()).pick(tw.rayAt(p.x, p.y)); if (hit?.floor) return {{ x: gx * 5 + 2.5, z: gz * 5 + 2.5 }}; }} return null; }})()")
        if far:
            a = await scr(pl, foot['x'], foot['z'], 1.2)
            await pl.evaluate("tw.setCut(null, { by: 'test' })"); await pl.wait_for_timeout(300); await pl.evaluate("tw.setCut(19, { pinned: true, by: 'test' })"); await pl.wait_for_timeout(300)
            vis = await pl.evaluate("tw.worldOf(tw.area()).recs.get('tok_mira00001').group.visible")
            check(vis, 'with the cut at lv 2 the pawn downstairs is still drawn (below the cut)')
        await pl.evaluate("tw.setCut(null, { by: 'test' })")

        # ================= REROLL =================
        print('REROLL: either room keeps the stair, and keeps furniture off it')
        for (rid, cells, what) in ((G, st['cells'] + [st['ends']['footCell']], 'lower'), (U, st['cells'] + [st['ends']['topCell']], 'upper')):
            h0 = await gm.evaluate(f"tw.entities()['{rid}'].layout.hash")
            await gm.evaluate(f"tw.rerollRoom(tw.entities()['{rid}'])"); await wait(gm, f"tw.entities()['{rid}'].layout.hash !== '{h0}' && tw.sync.pendingCount() === 0", 30000, f're-roll {what}')
            on = await gm.evaluate(ONSTAIR + f"('{rid}', {json.dumps(cells)})"); still = await gm.evaluate(STAIR + f"('{SID}')")
            check(still and still['cells'] == st['cells'] and not on, f'a re-roll of the {what} room keeps the stair and puts nothing on it or its landing', str(on))
        await settle(gm)

        # ================= SECRETS =================
        print('SECRETS: a hidden cellar\'s stair never reaches the player')
        check(await pl.evaluate(f"!!tw.entities()['{CID}'] && tw.worldOf(tw.area()).groundKey.length > 0"), 'before: the player has the cellar\'s stair and the cut in the ground')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{C}'], hidden: true }})")
        await wait(pl, f"!tw.entities()['{C}'] && !tw.entities()['{CID}']", 8000, 'cellar hidden'); await pl.wait_for_timeout(500)
        pv = await pl.evaluate(f"({{ stair: !!tw.entities()['{CID}'], cellar: !!tw.entities()['{C}'], ground: tw.worldOf(tw.area()).groundKey, stairs: tw.stairs().map(s => s.id), json: JSON.stringify(tw.entities()).includes('{CID}') }})")
        check(not pv['stair'] and not pv['cellar'] and pv['ground'] == '' and CID not in pv['stairs'] and not pv['json'], 'hiding the cellar hides its stair: the player has no stair there and the ground is whole', str(pv))
        gv = await gm.evaluate(f"({{ hidden: tw.entities()['{CID}'].hidden, ground: tw.worldOf(tw.area()).groundKey }})")
        check(gv['hidden'] and gv['ground'], 'the GM still has it (hidden), and the GM\'s ground is still cut', str(gv))
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U}'], hidden: true }})")
        await wait(pl, f"!tw.entities()['{U}'] && !tw.entities()['{SID}']", 8000, 'upper hidden')
        check(await pl.evaluate(f"!tw.entities()['{SID}'] && !!tw.entities()['{G}'] && tw.ST.holesAt(tw.entities(), 10).size === 0"), 'hiding the upper room hides the stair up to it too: the player keeps the room below, with no stair in it')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{U}'], hidden: false }})"); await wait(pl, f"tw.entities()['{SID}']", 8000, 'upper revealed')
        check(await pl.evaluate(f"!!tw.entities()['{SID}']"), 'revealing it brings the stair back')

        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502'))]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'stairs: {passed}/{len(results)} passed')
    return passed == len(results)

async def shots(gm, G, U, C, SID, browser):
    """full look, 1920x1080, table distance: the inn at lv 1 and lv 2 with its stair (for a Gemini blind read)"""
    await gm.evaluate("tw.select([])"); await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{C}' }})")
    K = await gm.evaluate("tw.spawnRoom('kitchen', 6, 0, 4, 4, 5102)"); await gm.wait_for_timeout(500)
    U2 = await gm.evaluate("tw.spawnRoom('guest', 4, 0, 4, 4, 5104, undefined, 10)"); await gm.wait_for_timeout(1500)
    s2 = await gm.evaluate("tw.lastStair")
    if s2: await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{s2}' }})")  # one stair in the picture
    await settle(gm, 120000); await gm.wait_for_timeout(4000)
    st = await gm.evaluate(STAIR + f"('{SID}')")
    for (name, cut) in (('lv1', 9), ('lv2', 19)):
        await gm.evaluate(f"tw.setCut({json.dumps(cut)}, {{ pinned: true, by: 'test' }})"); await view(gm, 25, 12, 70, 55, 0.5); await gm.wait_for_timeout(2500)
        await gm.screenshot(path=os.path.join(SHOTS, f'stairs-{name}.png'))
        await view(gm, st['x'], st['z'], 34, 50, 0.9); await gm.wait_for_timeout(2500)
        await gm.screenshot(path=os.path.join(SHOTS, f'stairs-{name}-close.png'))
    print('shots written:', SHOTS, 'stair', json.dumps({k: st[k] for k in ('cat', 'sku', 'kind', 'cells')}))
    await browser.close(); return True

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)
