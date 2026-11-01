#!/usr/bin/env python3
"""Roof controls (2026-10-27; docs/VERTICAL.md "Controls", docs/UI.md "Roofs"). One GM tab.

  local:  TW_GPU=1 python3 engine/test/browser_roofturn.py --local
  shots:  ... --local --shots   (engine/test/shots/roofturn-{before,after}.png: one roof turned, for a Gemini read)
  dev:    ... --page https://dev.turnipworks.net/engine/client/index.html

Harry: "They also need to be deletable so rooms can be open to the sky, and rotate able on the 90 degree, so profiles
can work." A hall with an annex in line (one ridge) and a wing on its side, and a cottage standing apart.
  DELETE   a selected roof + the Delete key: the room is open to the sky (room.roof.off); one undo brings it back; the
           annex's neighbour then closes its gable against it; a pawn over an open room rests on its floor, not its top
  TURN     R turns the selected roof 90 degrees (room.roof.axis); again puts it back and stores nothing; the ring's turn
           handle: a click is a quarter turn, a drag snaps to quarter turns and shows the turned roof while held; a wing
           turned runs alongside its neighbour; a flat roof has no Turn
  SHAPE    gable / hip / flat per roof (the bar, the ring's Shape list); flat keeps the style; a building's roof shape
"""
import argparse, asyncio, json, math, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # throwaway campaigns: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18291,18816').split(','))
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-roofturn-'); site = tempfile.mkdtemp(prefix='tw-site-')
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

SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
FRAME = """async ([dist, pitch, fy]) => { const g = tw.main.grab, sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.pitch = pitch; g.yaw = 0; g.dist = dist; tw.main.rule = 'free'; g.update(); await sleep(150);
  for (let i = 0; i < 8; i++) { const an = tw.ringAnchor(); if (!an) break; const ex = an.x - innerWidth / 2, ey = an.y - innerHeight * fy; if (Math.hypot(ex, ey) < 4) break;
    const p0 = tw.screenOf(g.focus.x, g.focus.z), p1 = tw.screenOf(g.focus.x + 1, g.focus.z), p2 = tw.screenOf(g.focus.x, g.focus.z + 1);
    const a11 = p1.x - p0.x, a12 = p2.x - p0.x, a21 = p1.y - p0.y, a22 = p2.y - p0.y, det = a11 * a22 - a12 * a21; if (!det) break;
    g.focus.x += (a22 * ex - a12 * ey) / det; g.focus.z += (-a21 * ex + a11 * ey) / det; g.update(); await sleep(150); }
  await sleep(200); return tw.ringAnchor(); }"""
ROOFS = "(() => { const w = tw.worldOf(tw.area()); return Object.fromEntries(w.roofReport().map(r => [r.room, r])); })()"
brief = lambda r: {k: (r or {}).get(k) for k in ('kind', 'style', 'axis', 'autoAxis', 'gables', 'ridgeY', 'standable')}
RING = "[...document.querySelectorAll('#ring .rbtn')].filter(b => !b.closest('[hidden]')).map(b => b.dataset.cmd || b.dataset.group || (b.dataset.menu !== undefined ? 'menu' : '')).filter(Boolean)"

async def main():
    full = A.shots
    page = start_local(full) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 1000} if full else {'width': 1400, 'height': 900}, reduced_motion='reduce')
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST roofturn {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')

        R = {}
        for (name, a) in (('hall', dict(type='common', x=0, z=0, w=8, d=4, seed=7101)), ('annex', dict(type='storeroom', x=8, z=0, w=4, d=4, seed=7102)),
                          ('wing', dict(type='kitchen', x=2, z=4, w=4, d=4, seed=7103)), ('cottage', dict(type='guest', x=18, z=0, w=6, d=4, seed=7104))):
            rid = f"room_rt{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built')
        await settle(gm)
        E = lambda id: f"tw.entities()['{id}']"
        await gm.evaluate("tw.setRoofs(true, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(800)
        await view(gm, 60, 20, 150, 55)
        r = await gm.evaluate(ROOFS)
        check(all(R[k] in r for k in R), 'roofs on: a roof over every room', {k: (r.get(R[k]) or {}).get('kind') for k in R})
        cot = R['cottage']
        if A.shots: return await shots(gm, R, browser)

        # ================= DELETE =================
        print('DELETE: Delete on a selected roof opens the room to the sky')
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(300)
        check(await gm.evaluate("tw.sel.size === 1 && [...tw.sel][0]") == 'roof:' + cot, 'the cottage roof is selected')
        await gm.mouse.move(700, 450); await gm.keyboard.press('Delete'); await gm.wait_for_timeout(600)
        r = await gm.evaluate(ROOFS)
        check(await gm.evaluate(E(cot) + '.roof?.off') is True and cot not in r and await gm.evaluate('tw.sel.size') == 0, 'the Delete key: room.roof.off, no roof drawn, nothing selected')
        check(await gm.evaluate(f"tw.worldOf(tw.area()).isOpenRoom({E(cot)})"), 'the room counts as open to the sky (isOpenRoom)')
        bu = await gm.evaluate(f"(async () => {{ const H = await import(new URL('../core/height.js', location.href).href).catch(() => null); if (!H) return null; const c = {E(cot)}.recipe, w = tw.worldOf(tw.area()); return [H.baseUnder(tw.entities(), (c.x + 1) * 5, (c.z + 1) * 5, 15, (e) => w.isOpenRoom(e)), H.baseUnder(tw.entities(), (c.x + 1) * 5, (c.z + 1) * 5, 15)]; }})()")
        if bu: check(bu[0]['on'] == 'floor' and bu[1]['on'] == 'top', 'a pawn held over the open room comes down to its floor, not onto its top', bu)
        else: print('    (core/height.js not importable from the page: baseUnder covered by core.test.mjs)')
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(700)
        r = await gm.evaluate(ROOFS)
        check(cot in r and await gm.evaluate(E(cot) + '.roof') is None, 'one undo brings the roof back (and the room carries no roof field again)')
        # the ring's Remove roof (☰) and the bar's words do the same
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(300)
        await gm.evaluate(FRAME, [110, 52, 0.6]); await gm.wait_for_timeout(300)
        ring = await gm.evaluate(RING)
        check('roof.turn' in ring and 'roof.reroll' in ring and 'menu' in ring, 'its closed ring: Turn, Re-roll and the menu', ring)
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(800)
        opened = await gm.evaluate(RING)
        title = await gm.evaluate("document.querySelector('#ring [data-cmd=\"roof.hide\"]')?.getAttribute('aria-label') || document.querySelector('#ring [data-cmd=\"roof.hide\"]')?.title || ''")
        check('roof.hide' in opened and 'roof.shape.' in opened and 'roof.style.' in opened, 'the open menu: Style, Shape and Remove roof', opened)
        check('remove' in title.lower() or 'sky' in title.lower(), 'the button reads as removing the roof, not hiding it', title)
        await gm.click('#ring [data-cmd="roof.hide"]'); await gm.wait_for_timeout(600)
        check(await gm.evaluate(E(cot) + '.roof?.off') is True, 'Remove roof on the ring: open to the sky')
        await gm.evaluate(f"tw.select('{cot}')"); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('roof back', delay=8); await gm.wait_for_timeout(350); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(600)
        check(await gm.evaluate(E(cot) + '.roof') is None and cot in await gm.evaluate(ROOFS), '"roof back" in the bar puts it back')
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('open to the sky', delay=8); await gm.wait_for_timeout(350)
        top = await gm.evaluate("(() => { const b = tw.registry.surfaces.find(s => s.name === 'bar'); return b?.state?.()?.items?.[0] || document.querySelector('#bar .row.sel, #bar li.sel, #bar [aria-selected=true]')?.textContent || null; })()")
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(600)
        check(await gm.evaluate(E(cot) + '.roof?.off') is True, '"open to the sky" in the bar removes it', top)
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(600)
        # a roof in line with an open room closes its gable against it
        g0 = (await gm.evaluate(ROOFS))[R['hall']]['gables']
        await gm.evaluate(f"tw.select('roof:{R['annex']}')"); await gm.mouse.move(700, 450); await gm.keyboard.press('Backspace'); await gm.wait_for_timeout(700)
        r = await gm.evaluate(ROOFS)
        check(R['annex'] not in r and r[R['hall']]['gables'] > g0, 'Backspace on the annex roof: the hall closes its gable end against the open annex', f"{g0} -> {r[R['hall']]['gables']}")
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(700)
        check(R['annex'] in await gm.evaluate(ROOFS), 'undo: the annex roof is back')

        # ================= TURN =================
        print('TURN: a quarter turn of the ridge')
        r = await gm.evaluate(ROOFS); a0 = r[cot]['axis']
        check(a0 == 'x' and r[cot]['autoAxis'] == 'x', 'the cottage (30 x 20 ft) has its ridge along the long side, x', brief(r[cot]))
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(300); await gm.mouse.move(700, 450)
        await gm.keyboard.press('r'); await gm.wait_for_timeout(700)
        r = await gm.evaluate(ROOFS)
        check(r[cot]['axis'] == 'z' and await gm.evaluate(E(cot) + '.roof?.axis') == 'z' and r[cot]['gables'] == 2, 'R: the ridge runs along z (room.roof.axis), two gable ends on the other pair of walls', brief(r[cot]))
        await gm.keyboard.press('r'); await gm.wait_for_timeout(700)
        check((await gm.evaluate(ROOFS))[cot]['axis'] == 'x' and await gm.evaluate(E(cot) + '.roof') is None, 'R again: back along x, and nothing is stored')
        await gm.keyboard.press('r'); await gm.wait_for_timeout(600); await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(700)
        check((await gm.evaluate(ROOFS))[cot]['axis'] == 'x', 'one undo takes a turn back')
        # the ring's turn handle: a click
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(300)
        await gm.evaluate(FRAME, [110, 52, 0.6]); await gm.wait_for_timeout(300)
        h = await gm.evaluate("(() => { const b = document.querySelector('#ring [data-cmd=\"roof.turn\"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, drag: b.classList.contains('drag') }; })()")
        check(h and h['drag'], 'the roof ring\'s Turn is a drag handle', h)
        if h:
            await gm.mouse.click(h['x'], h['y']); await gm.wait_for_timeout(700)
            check((await gm.evaluate(ROOFS))[cot]['axis'] == 'z', 'a click on the turn handle: a quarter turn')
            await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(700)
            await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(300); await gm.evaluate(FRAME, [110, 52, 0.6]); await gm.wait_for_timeout(300)
            h = await gm.evaluate("(() => { const b = document.querySelector('#ring [data-cmd=\"roof.turn\"]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
            # a drag: round the frozen centre by about 100 degrees, then 170 (an even number of quarter turns: no change), then back to 100
            await gm.mouse.move(h['x'], h['y']); await gm.mouse.down(); await gm.mouse.move(h['x'] + 6, h['y'] + 2, steps=2); await gm.wait_for_timeout(100)
            c = (await gm.evaluate('tw.ringDrag && tw.ringDrag()') or {}).get('centre')
            check(bool(c), 'the drag has a frozen centre', c)
            if c:
                cx, cy = c; rr = math.hypot(h['x'] - cx, h['y'] - cy); a0s = math.atan2(h['x'] - cx, -(h['y'] - cy))
                at = lambda deg: (cx + rr * math.sin(a0s + math.radians(deg)), cy - rr * math.cos(a0s + math.radians(deg)))
                for d in range(10, 101, 10): x, y = at(d); await gm.mouse.move(x, y); await gm.wait_for_timeout(30)
                await gm.wait_for_timeout(400)
                mid = await gm.evaluate(ROOFS)
                prev = await gm.evaluate("tw.worldOf(tw.area()).roofTurnPreview")
                check(mid[cot]['axis'] == 'z' and prev and prev.get('axis') == 'z' and await gm.evaluate(E(cot) + '.roof') is None, 'mid-drag at about 100°: the roof is shown turned (this tab only), nothing sent yet', prev)
                for d in range(110, 181, 10): x, y = at(d); await gm.mouse.move(x, y); await gm.wait_for_timeout(30)
                await gm.wait_for_timeout(300)
                check((await gm.evaluate(ROOFS))[cot]['axis'] == 'x', 'at about 180°: two quarter turns, the ridge as it was')
                for d in range(170, 89, -10): x, y = at(d); await gm.mouse.move(x, y); await gm.wait_for_timeout(30)
                await gm.mouse.up(); await gm.wait_for_timeout(800)
                last = await gm.evaluate('tw.ringDragLast')
                check(last and last.get('kind') == 'roofturn' and last.get('committed') and (await gm.evaluate(ROOFS))[cot]['axis'] == 'z' and await gm.evaluate(E(cot) + '.roof?.axis') == 'z' and not await gm.evaluate("tw.worldOf(tw.area()).roofTurnPreview"), 'let go at a quarter turn: one room.set, the ridge along z', last)
            else: await gm.mouse.up()
        # a wing pointed at its neighbour, turned to run alongside
        r = await gm.evaluate(ROOFS)
        check(r[R['wing']]['axis'] == 'z', 'the wing points its ridge at the hall (automatic)', brief(r[R['wing']]))
        await gm.evaluate(f"tw.select('roof:{R['wing']}')"); await gm.wait_for_timeout(200); await gm.mouse.move(700, 450); await gm.keyboard.press('r'); await gm.wait_for_timeout(700)
        r = await gm.evaluate(ROOFS)
        cover = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), e = {E(R['wing'])}.recipe; let bad = 0, n = 0;
          for (let i = 0; i < e.w; i++) for (let j = 0; j < e.d; j++) for (const [dx, dz] of [[1.4, 1.6], [3.6, 3.4]]) {{ n++; if (w.roofPlan.heightAt((e.x + i) * 5 + dx, (e.z + j) * 5 + dz) == null) bad++; }} return {{ bad, n }}; }})()""")
        check(r[R['wing']]['axis'] == 'x' and await gm.evaluate(E(R['wing']) + '.roof?.axis') == 'x' and cover['bad'] == 0, 'turned, the wing runs alongside the hall; it is still roofed everywhere', {**brief(r[R['wing']]), **cover})
        await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(600)

        # ================= SHAPE =================
        print('SHAPE: gable, hip, flat per roof')
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(200)
        style0 = (await gm.evaluate(ROOFS))[cot]['style']
        await gm.keyboard.press('/'); await gm.keyboard.type('hip roof', delay=8); await gm.wait_for_timeout(350); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(700)
        r = await gm.evaluate(ROOFS)
        check(r[cot]['kind'] == 'hip' and await gm.evaluate(E(cot) + '.roof?.shape') == 'hip' and r[cot]['gables'] == 0 and r[cot]['axis'] == 'z', '"hip roof" in the bar: a hip roof (no gable walls), still turned', brief(r[cot]))
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(200)
        await gm.evaluate(FRAME, [110, 52, 0.6]); await gm.wait_for_timeout(300)
        await gm.click('#ring [data-menu]'); await gm.wait_for_timeout(700)
        await gm.click('#ring [data-group="roof.shape."]'); await gm.wait_for_timeout(700)
        nest = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest]')].map(b => b.dataset.cmd)")
        check('roof.shape.flat' in nest and 'roof.shape.gable' in nest and 'roof.shape.auto' in nest and 'roof.shape.hip' not in nest, 'the ring\'s Shape list: Gable, Flat, Automatic (not the one it is)', nest)
        if 'roof.shape.flat' in nest: await gm.click('#ring .rbtn[data-nest][data-cmd="roof.shape.flat"]'); await gm.wait_for_timeout(800)
        r = await gm.evaluate(ROOFS)
        check(r[cot]['kind'] == 'flat' and r[cot]['style'] == style0 and r[cot]['standable'] == 24, 'Flat from the ring: a flat roof, its style kept (the flat surface drawn), 24 squares to stand on', brief(r[cot]))
        await gm.evaluate(f"tw.select('roof:{cot}')"); await gm.wait_for_timeout(300); await gm.evaluate(FRAME, [110, 52, 0.6]); await gm.wait_for_timeout(300)
        ring = await gm.evaluate(RING)
        check('roof.turn' not in ring, 'a flat roof has no Turn', ring)
        await gm.evaluate(f"tw.registry.run('roof.shape.auto')"); await gm.wait_for_timeout(700)
        check((await gm.evaluate(ROOFS))[cot]['kind'] == 'gable' and await gm.evaluate(E(cot) + '.roof?.shape') is None, 'Automatic: a gable again, no shape stored')
        # a building's roofs all at once
        b = await gm.evaluate(E(R['hall']) + '.building')
        await gm.evaluate(f"tw.select('{b}')"); await gm.wait_for_timeout(200)
        await gm.evaluate("tw.registry.run('building.roofShape.hip')"); await gm.wait_for_timeout(800)
        r = await gm.evaluate(ROOFS)
        check(await gm.evaluate(f"tw.entities()['{b}'].roofShape") == 'hip' and all(r[R[k]]['kind'] == 'hip' for k in ('hall', 'annex', 'wing')) and r[cot]['kind'] == 'gable', 'the building\'s Roof shape: Hip: every roof of it hipped, the cottage (another building) untouched', {k: r[R[k]]['kind'] for k in R})
        await gm.evaluate("tw.registry.run('building.roofShape.auto')"); await gm.wait_for_timeout(700)
        check(await gm.evaluate(f"'roofShape' in tw.entities()['{b}']") is False, 'Automatic: the building carries no shape again')

        # ================= TRIM =================
        print('TRIM: a chimney, a dormer: selected, dragged along the roof, removed, one undo each')
        await view(gm, 60, 20, 110, 55)
        TRIM = "((rid, role) => { const w = tw.worldOf(tw.area()), rec = w.roofRecs.get(rid); return rec ? rec.roof.props.filter(p => p.role === role).map(p => ({ key: p.key, x: p.x, y: p.y, z: p.z, dims: p.dims, moved: !!p.moved, slide: p.slide || null })) : []; })"
        SCR = "(([x, y, z]) => { const s = tw.screenOf(x, z, tw.main, y); return { x: s.x, y: s.y }; })"
        PICK = "(([x, y]) => { const h = tw.worldOf(tw.area()).pickAll(tw.rayAt(x, y))[0]; return h ? tw.selectionFor(h) : null; })"
        wing = R['wing']; ch = (await gm.evaluate(f"{TRIM}('{wing}', 'chimney')") or [None])[0]
        check(bool(ch) and ch['key'].startswith('chimney:') and ch['slide'], 'the wing\'s chimney (over its fireplace) has a key and slides on the roof', ch)
        if ch:
            tid = f"trim:{wing}|{ch['key']}"
            pt = await gm.evaluate(SCR, [ch['x'], ch['y'] + ch['dims'][1] * 0.8, ch['z']])
            check(await gm.evaluate(PICK, [pt['x'], pt['y']]) == tid, 'the pointer over the chimney meets the chimney, not the roof', await gm.evaluate(PICK, [pt['x'], pt['y']]))
            await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(500)
            check(await gm.evaluate("[...tw.sel]") == [tid] and (await gm.evaluate("tw.selected()[0]") or {}).get('kind') == 'trim', 'a click selects the chimney itself', await gm.evaluate("[...tw.sel]"))
            await wait(gm, f"[...tw.worldOf(tw.area()).halos.values()].some(h => h.id === '{tid}')", 3000, 'chimney halo')
            check(await gm.evaluate(f"[...tw.worldOf(tw.area()).halos.values()].some(h => h.id === '{tid}')"), 'it wears the selection look')
            # drag it 5 ft along the roof (from the chimney to a point of the wing's roof 5 ft off, the same move on screen)
            hx = await gm.evaluate(f"tw.worldOf(tw.area()).roofPlan.heightAt({ch['x'] - 5}, {ch['z']})")
            a = await gm.evaluate(SCR, [ch['x'], ch['y'] + ch['dims'][1] * 0.8, ch['z']]); b = await gm.evaluate(SCR, [ch['x'] - 5, (hx or ch['y']) + ch['dims'][1] * 0.8 - 1.5, ch['z']])
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
            for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(25)
            mid = await gm.evaluate(f"(() => {{ const t = tw.worldOf(tw.area()).trimPiece('{wing}', '{ch['key']}'); return t && t.holder.position.toArray(); }})()")
            await gm.mouse.up(); await gm.wait_for_timeout(900)
            at = await gm.evaluate(E(wing) + f".roof?.trim?.['{ch['key']}']?.at")
            c2 = (await gm.evaluate(f"{TRIM}('{wing}', 'chimney')"))[0]
            h2 = await gm.evaluate(f"tw.worldOf(tw.area()).roofPlan.heightAt({c2['x']}, {c2['z']})")
            check(mid and abs(mid[0] - ch['x']) > 1, 'mid-drag the chimney is drawn where the pointer has it', mid)
            check(at and c2['moved'] and abs(c2['x'] - ch['x']) > 1 and abs(c2['y'] - (h2 - 1.5)) < 0.01 and c2['dims'][1] > 3.5, 'let go: room.roof.trim moves it; it stands upright in the roof under it (sunk 1.5 ft), its top over the ridge', {'at': at, 'was': [ch['x'], ch['z']], 'now': [c2['x'], c2['y'], c2['z']], 'roof': h2})
            ring = await gm.evaluate(RING)
            check('trim.reset' in ring, 'its ring: Put back', ring)
            await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{wing}', roof: {{ seed: 4242 }} }})"); await gm.wait_for_timeout(800)
            check((await gm.evaluate(f"{TRIM}('{wing}', 'chimney')"))[0]['moved'], 're-rolling the roof keeps the moved chimney')
            await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(500); await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(800)
            c3 = (await gm.evaluate(f"{TRIM}('{wing}', 'chimney')"))[0]
            check(not c3['moved'] and abs(c3['x'] - ch['x']) < 0.01 and await gm.evaluate(E(wing) + '.roof?.trim') is None, 'undo: back over its fireplace, nothing stored')
            await gm.evaluate(f"tw.select('{tid}')"); await gm.wait_for_timeout(300); await gm.mouse.move(700, 450); await gm.keyboard.press('Delete'); await gm.wait_for_timeout(800)
            check(await gm.evaluate(E(wing) + f".roof?.trim?.['{ch['key']}']?.gone") is True and not await gm.evaluate(f"{TRIM}('{wing}', 'chimney')"), 'Delete: the chimney is gone (room.roof.trim)')
            await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(800)
            check(len(await gm.evaluate(f"{TRIM}('{wing}', 'chimney')")) == 1, 'one undo brings it back')
        # a dormer: the cottage's big slopes (re-roll until one comes up)
        dm = []
        for seed in (0, 11, 23, 37, 41, 53, 67, 79, 83, 97, 101, 113):
            if seed: await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{cot}', roof: {{ seed: {seed} }} }})"); await gm.wait_for_timeout(500)
            dm = await gm.evaluate(f"{TRIM}('{cot}', 'dormer')")
            if dm: break
        check(bool(dm), 'the cottage has a dormer (some seed)', dm)
        if dm:
            d = dm[0]; pl = d['slide']['plane']
            kit = await gm.evaluate(f"tw.worldOf(tw.area()).kitReport().find(k => k.kind === 'roof' && k.role === 'dormer' && k.room === '{cot}')")
            if kit and kit.get('loaded'): check(kit['min'][1] <= kit['roofAt'] + 0.2 and kit['max'][1] > kit['roofAt'] + 1.5, 'the dormer as drawn: its foot in the roof, standing out of the slope', {k: kit.get(k) for k in ('min', 'max', 'roofAt', 'at', 'sku')})
            a = await gm.evaluate(SCR, [d['x'], d['y'] + 2.5, d['z']])
            await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(200)
            first = await gm.evaluate(PICK, [a['x'], a['y']])
            if first == f"trim:{cot}|{d['key']}":
                # drag 6 ft along the eave, then on up over the ridge: it never leaves its slope
                along = [6, 0] if abs(pl[1]) > abs(pl[0]) else [0, 6]
                tx, tz = d['x'] + along[0], d['z'] + along[1]; b = await gm.evaluate(SCR, [tx, pl[0] * tx + pl[1] * tz + pl[2] + 1.9, tz])
                await gm.mouse.move(a['x'], a['y']); await gm.mouse.down()
                for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(25)
                await gm.mouse.move(b['x'], b['y'] - 220, steps=8); await gm.wait_for_timeout(100)
                await gm.mouse.up(); await gm.wait_for_timeout(900)
                d2 = next((x for x in await gm.evaluate(f"{TRIM}('{cot}', 'dormer')") if x['key'] == d['key']), None)
                on = d2 and abs(d2['y'] + 0.6 - (pl[0] * d2['x'] + pl[1] * d2['z'] + pl[2])) < 0.01
                check(d2 and d2['moved'] and on and (abs(d2['x'] - d['x']) > 2 or abs(d2['z'] - d['z']) > 2), 'a dormer dragged along and then up over the ridge stays on its own slope, facing down it', {'was': [d['x'], d['z']], 'now': d2 and [d2['x'], d2['y'], d2['z']]})
                await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(700)
            else: check(False, 'the pointer over the dormer meets the dormer', first)

        # ================= SAVED =================
        print('SAVED: a reload keeps the turned roof')
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000); await settle(gm)
        await gm.evaluate("tw.setRoofs(true, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(1200)
        check((await gm.evaluate(ROOFS)).get(cot, {}).get('axis') == 'z', 'after a reload the cottage roof is still turned')
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'roofturn: {passed}/{len(results)} passed')
    return passed == len(results)

async def shots(gm, R, browser):
    """the cottage roof as it comes, then turned 90 degrees: table distance, for a Gemini read"""
    cot = R['cottage']
    await gm.evaluate("document.body.classList.add('shot')")
    for name, yaw in (('before', -35), ('after', -35), ('after-side', 60), ('after-back', 145)):
        if name == 'after': await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{cot}', roof: {{ axis: 'z' }} }})"); await gm.wait_for_timeout(2500)
        await gm.evaluate("tw.select([])"); await view(gm, 105, 12, 85 if name in ('before', 'after') else 60, 42, yaw); await gm.wait_for_timeout(2500)
        await gm.screenshot(path=os.path.join(SHOTS, f'roofturn-{name}.png'))
        print('  shot', name, json.dumps((await gm.evaluate(ROOFS))[cot])[:300])
    await browser.close(); return True

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)
