#!/usr/bin/env python3
"""FALLS, HOLES AND PITS (2026-10-22; Harry: "If you drag a pawn out over open air, it should give you a contextual
option to 'fall xx feet?' ... distinct from height adjusting"; "place holes between floors"; "pits ... need to have
some of that stair behavior"). GM tab + player tab.

  python3 engine/test/browser_falls.py --local [--shots] [--only fall,hole,pit]

  FALL   a pawn dragged (a real mouse) off an upper room into the open air stays where it was let go, at 10 ft, hovering;
         "Fall 10 ft?" is offered beside it; the player sees it hovering; pressing it lands it on the ground and the chat
         says "Mira falls 10 ft"; one undo puts it back up and takes the line away; ignored, the offer goes down into
         the chat as a line with the same button; a pawn that was already up (flying) is offered nothing; the arrow keys
         off the edge offer it too; the bar's "fall"; a pawn dragged onto a visible lower floor where there IS floor at
         the drag's plane (the old rule) still goes there
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # pawns snap to the squares in this suite (said here, not left to the default)
tw_sandbox.remove_campaigns()   # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only', default='fall,hole,pit,stack')
A = ap.parse_args(); ONLY = set(A.only.split(','))
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18197,18822').split(','))  # TW_PORTS=a,b: free ports when another run holds these
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-falls-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)  # (the page is this checkout's, not a stale server's: test/served.py)
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
async def mdrag(pg, a, b, steps=12):
    await quiet(pg)
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(25)
    await pg.mouse.up(); await pg.wait_for_timeout(400)
async def quiet(pg):  # the big announcement of a chat line ("Mira falls 10 ft") takes a click: wait for it to land first
    await wait(pg, "!tw.announce.info().showing && !tw.announce.info().queue.length", 15000, 'announcement landed')
async def shot(pg, name):
    os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS, f'falls-{name}.png'))
TOK = "((id) => { const e = tw.entities()[id]; return e ? { x: e.x, y: e.y || 0, z: e.z } : null; })"
FALLBTN = "(() => tw.condButtons.list().filter(b => b.key === 'fall'))()"

async def main():
    page = start_local(False) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h})
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST falls {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        async def idle(pg=None): await wait(pg or gm, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await (pg or gm).wait_for_timeout(350)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        PL = await pl.evaluate('tw.me()')

        # an inn of two storeys, empty (the test is about what is under the pawn): a 4 x 4 common room, a guest room on it
        G = await gm.evaluate("tw.spawnRoom('common', 4, 0, 4, 4, 6)"); await idle()
        U = await gm.evaluate("tw.spawnRoom('guest', 4, 0, 4, 4, 43, undefined, 10)"); await idle()
        for rid in (G, U): await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{rid}').forEach(o => tw.dispatch('object.delete', {{ id: o.id }}))")
        await idle(); await gm.evaluate("tw.condButtons.hide('stair-offer')")

        if 'fall' in ONLY:
            print('FALL: off an upper room into the open air')
            await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_mira00001', name: 'Mira', x: 32.5, y: 10, z: 12.5, owner: '{PL}' }})"); await idle()
            await view(gm, 32, 12, 70, 58); await settle(gm); await gm.wait_for_timeout(800)
            # the pawn is on the east side of the upper room (x 20..40); dragged two squares out past its east wall (x 47.5)
            a = await scr(gm, 32.5, 12.5, 10.8); b = await scr(gm, 47.5, 12.5, 10)
            await mdrag(gm, a, b); await idle()
            t = await gm.evaluate(TOK + "('tok_mira00001')"); fb = await gm.evaluate(FALLBTN)
            check(t and abs(t['x'] - 47.5) < 0.1 and abs(t['z'] - 12.5) < 0.1 and t['y'] == 10, 'let go over the open air it stays where it was let go, at 10 ft (not put down on the ground under the pointer)', str(t))
            info = await gm.evaluate("tw.worldOf(tw.area()).pawnBaseInfo('tok_mira00001')")
            check(info and info['drop'] > 9.5 and info['beam'] and info['beam']['visible'], 'it hovers like a raised pawn: its base is on the ground 10 ft below, with the beam', str(info and {k: info[k] for k in ('figureY', 'baseY', 'drop')}))
            check(len(fb) == 1 and fb[0]['text'] == 'Fall 10 ft?' and fb[0]['visible'], 'a conditional button beside it offers "Fall 10 ft?"', str(fb))
            if A.shots: await shot(gm, 'offer')
            await wait(pl, "(tw.entities().tok_mira00001?.y || 0) === 10 && Math.abs(tw.entities().tok_mira00001.x - 47.5) < 0.1", 8000, 'player sees hovering')
            check(await pl.evaluate("tw.entities().tok_mira00001.y") == 10, 'the player sees it there, hovering at 10 ft')
            box = await gm.evaluate("(() => { const b = [...document.querySelectorAll('.cbtn')].find(x => x.textContent.includes('Fall')); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()")
            pawn_px = await scr(gm, 47.5, 12.5, 10)
            check(abs(box['x'] - pawn_px['x']) < 260 and abs(box['y'] - pawn_px['y']) < 160 and not (abs(box['x'] - pawn_px['x']) < 10 and abs(box['y'] - pawn_px['y']) < 10), 'the button is beside the pawn, not over it', f"{box} vs {pawn_px}")
            await gm.mouse.click(box['x'], box['y']); await idle()
            t = await gm.evaluate(TOK + "('tok_mira00001')"); chat = await gm.evaluate("(tw.view().chat || []).map(c => c.text)")
            check(t and t['y'] == 0 and abs(t['x'] - 47.5) < 0.1, 'pressed: it lands on the ground under it (0 ft)', str(t))
            check(chat and chat[-1] == 'Mira falls 10 ft', 'and the chat says "Mira falls 10 ft"', str(chat[-2:]))
            await wait(pl, "(tw.entities().tok_mira00001?.y || 0) === 0 && (tw.view().chat || []).some(c => c.text === 'Mira falls 10 ft')", 8000, 'player sees the fall')
            check(await pl.evaluate("(tw.entities().tok_mira00001.y || 0) === 0 && (tw.view().chat || []).some(c => c.text === 'Mira falls 10 ft')"), 'the player sees it land and reads the line')
            await gm.keyboard.press('Control+z'); await idle()
            t = await gm.evaluate(TOK + "('tok_mira00001')"); chat = await gm.evaluate("(tw.view().chat || []).map(c => c.text)")
            check(t['y'] == 10 and 'Mira falls 10 ft' not in chat, 'one undo puts it back up and takes the line away', f"{t} {chat[-2:]}")
            # ignored: down into the chat as a line with the same button
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 32.5, z: 12.5, y: 10 })"); await idle()
            a = await scr(gm, 32.5, 12.5, 10.8); b = await scr(gm, 32.5, -7.5, 10)
            await mdrag(gm, a, b); await idle()
            fb = await gm.evaluate(FALLBTN); t = await gm.evaluate(TOK + "('tok_mira00001')")
            check(len(fb) == 1 and t['y'] == 10 and abs(t['z'] + 7.5) < 0.1, 'off the north edge: hovering again, offered again', f"{t} {fb}")
            await gm.evaluate("tw.condButtons.expire('fall')"); await gm.wait_for_timeout(1400)
            ln = await gm.evaluate("[...document.querySelectorAll('#chat .actline, #chat [data-act]')].map(e => e.textContent.trim()).filter(t => t.includes('drop'))")
            check(not await gm.evaluate("tw.condButtons.has('fall')") and ln and 'Mira is over a 10-ft drop' in ln[-1] and 'Fall 10 ft' in ln[-1], 'ignored, it goes down into the chat: "Mira is over a 10-ft drop · Fall 10 ft"', str(ln))
            check((await gm.evaluate(TOK + "('tok_mira00001')"))['y'] == 10, 'and the pawn is left hovering')
            clicked = await gm.evaluate("(() => { const l = [...document.querySelectorAll('#chat .actline, #chat [data-act]')].reverse().find(e => e.textContent.includes('drop')); const b = l && l.querySelector('button'); if (b) b.click(); return !!b; })()"); await idle()
            check(clicked and (await gm.evaluate(TOK + "('tok_mira00001')"))['y'] == 0, "the line's button makes the fall")
            # a pawn already up (flying) is offered nothing
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 32.5, z: 12.5, y: 25 })"); await idle(); await gm.wait_for_timeout(300)
            await gm.evaluate("tw.condButtons.hide('fall')")
            a = await scr(gm, 32.5, 12.5, 25.8); b = await scr(gm, 47.5, 12.5, 25)
            await mdrag(gm, a, b); await idle()
            t = await gm.evaluate(TOK + "('tok_mira00001')")
            check(t['y'] == 25 and not await gm.evaluate("tw.condButtons.has('fall')"), 'a pawn that was already up (raised 15 ft over the roof) keeps its height when dragged off, and is offered nothing', str(t))
            # the bar's "fall" (any pawn that is up)
            await gm.evaluate("tw.select('tok_mira00001')"); await gm.wait_for_timeout(150)
            await gm.keyboard.press('/'); await gm.keyboard.type('fall', delay=10); await gm.wait_for_timeout(400)
            rows = await gm.evaluate("[...document.querySelectorAll('#bar .row, #bar [data-cmd]')].slice(0, 4).map(r => r.textContent.trim())")
            await gm.keyboard.press('Enter'); await idle()
            t = await gm.evaluate(TOK + "('tok_mira00001')")
            check(t['y'] == 0, 'the bar\'s "fall" with the flyer selected drops it to the ground (25 ft)', f"{t} rows {rows}")
            check((await gm.evaluate("(tw.view().chat || []).map(c => c.text)"))[-1] == 'Mira falls 25 ft', '... and says "Mira falls 25 ft"')
            # the arrow keys walk it off the edge: offered too
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 37.5, z: 12.5, y: 10 })"); await idle()
            await gm.evaluate("tw.select('tok_mira00001')"); await gm.mouse.move(5, 5)
            await view(gm, 32, 12, 70, 58, 0); await quiet(gm)
            for _ in range(2): await gm.keyboard.press('ArrowRight'); await gm.wait_for_timeout(250)
            await idle(); t = await gm.evaluate(TOK + "('tok_mira00001')"); fb = await gm.evaluate(FALLBTN)
            check(t['x'] > 40 and t['y'] == 10 and len(fb) == 1 and fb[0]['text'] == 'Fall 10 ft?', 'walked off the edge with the arrow keys: hovering, and offered the fall', f"{t} {fb}")
            await gm.evaluate("tw.condButtons.hide('fall')")
            # from the ground to where the upper floor shows: a pawn keeps its level (2026-10-26, universal levels; it used to
            # pop up onto the floor it was shown): it is on the ground floor under it, and nothing is offered
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 52.5, z: 12.5, y: 0 })"); await idle(); await gm.evaluate("tw.select([])")
            a = await scr(gm, 52.5, 12.5, 0.8); b = await scr(gm, 32.5, 12.5, 10)
            await mdrag(gm, a, b); await idle()
            t = await gm.evaluate(TOK + "('tok_mira00001')")
            check(t['y'] == 0 and t['x'] < 50 and not await gm.evaluate("tw.condButtons.has('fall')"), 'a pawn dragged from the ground to where the upper floor shows keeps its level: on the floor below it, and nothing is offered', str(t))


        if 'hole' in ONLY:
            print('HOLE: square holes painted like a floor tile, round ones placed like a thing')
            W = "tw.worldOf(tw.area())"
            HOLES = "((y) => [...tw.ST.holesAt(tw.entities(), y)].sort())"
            # what is drawn of a room's floor on given squares: floor tiles (plain or clipped round a circle) and slab boxes
            FLOOR_ON = """((rid, cells) => { const w = tw.worldOf(tw.area()); let tiles = 0, clipped = 0, slab = 0, rim = 0; const inCell = (x, z) => cells.some(([gx, gz]) => x > gx * 5 && x < gx * 5 + 5 && z > gz * 5 && z < gz * 5 + 5);
              for (const s of w.shell.values()) { if (s.roomId !== rid || s.spec.layer !== 'floor') continue;
                if (s.spec.slab) { s.group.updateMatrixWorld(true); s.visual?.traverse?.(o => { if (!o.isMesh) return; if (o.geometry.type === 'CylinderGeometry') { rim++; return; } const p = o.getWorldPosition(new (o.position.constructor)()); const sx = o.geometry.parameters?.width || 5, sz = o.geometry.parameters?.depth || 5; if (sx <= 5.01 && sz <= 5.01 ? inCell(p.x, p.z) : cells.some(([gx, gz]) => Math.abs(p.x - (gx * 5 + 2.5)) < sx / 2 && Math.abs(p.z - (gz * 5 + 2.5)) < sz / 2)) slab++; }); }
                else if (inCell(s.spec.x, s.spec.z) && !s.spec.soft) { if (s.visual?.userData?.holeClip) clipped++; else tiles++; } }
              return { tiles, clipped, slab, rim }; })"""
            await gm.evaluate("(tw.setLevel(10), tw.setCut(19, { pinned: true, by: 'test' }))"); await gm.wait_for_timeout(400)
            await view(gm, 30, 10, 60, 62); await settle(gm); await quiet(gm)
            # the bar knows it by its words
            rows = await gm.evaluate("""async (qs) => { tw.emit('bar.open'); const input = document.querySelector('#bar input'), out = {};
              for (const q of qs) { input.value = q; input.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 30)); out[q] = [...document.querySelectorAll('#results .res')].slice(0, 6).map(el => el.dataset.ref || ''); }
              input.value = ''; input.dispatchEvent(new Event('input')); document.activeElement?.blur(); tw.registry.surfaces.find(s => s.name === 'bar')?.close(); return out; }""", ['hole', 'pit', 'opening', 'drop', 'chasm', 'round hole', 'hole 15 ft'])
            okw = all(any(r.startswith('cat:hole') or r == 'cmd:hole.size' for r in rows[q][:4]) for q in rows)
            check(okw, 'the bar offers a hole for "hole", "pit", "opening", "drop", "chasm", "round hole", "hole 15 ft"', json.dumps(rows)[:600])
            # SQUARE: the paint tool, one square, then a run of two
            await gm.evaluate("tw.modes.place(tw.assets.catById.get('hole'))"); await gm.wait_for_timeout(300)
            pt = await scr(gm, 22.5, 2.5, 10); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(150); await gm.mouse.click(pt['x'], pt['y']); await idle()
            a = await scr(gm, 22.5, 7.5, 10); b = await scr(gm, 27.5, 7.5, 10)
            await gm.mouse.move(a['x'], a['y']); await gm.mouse.down(); await gm.mouse.move(b['x'], b['y'], steps=8); await gm.mouse.up(); await idle()
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
            sq = await gm.evaluate("Object.values(tw.entities()).filter(e => e.cat === 'hole').map(e => [e.x, e.y, e.z, e.place]).sort()")
            check(sq == [[22.5, 10, 2.5, 'tile'], [22.5, 10, 7.5, 'tile'], [27.5, 10, 7.5, 'tile']], 'three square holes, each on its square of the upper floor, laid like tiles (a click, then a stroke of two)', str(sq))
            check(await gm.evaluate(HOLES + "(10)") == ['4:0', '4:1', '5:1'], 'the floor at 10 ft is open on exactly those squares', await gm.evaluate(HOLES + "(10)"))
            await gm.wait_for_timeout(800)
            f = await gm.evaluate(FLOOR_ON + f"('{U}', [[4, 0], [4, 1], [5, 1]])")
            check(f['tiles'] == 0 and f['slab'] == 0, 'DRAWN: no floor tile and no slab on them', str(f))
            g0 = await gm.evaluate("(() => { const p = tw.screenOf(22.5, 7.5, tw.main, 10); return tw.groundAt(p.x, p.y); })()")
            check(g0 and g0[0] is not None and await gm.evaluate("(() => { const p = tw.screenOf(22.5, 7.5, tw.main, 10); const g = tw.groundAt(p.x, p.y); return g.y; })()") == 0, 'the pointer goes through a hole to the floor below')
            if A.shots: await shot(gm, 'square-holes')
            # a pawn let go over a hole: hangs over the drop, is offered the fall, falls to the ground floor
            await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_kit000001', name: 'Kit', x: 37.5, y: 10, z: 12.5, owner: '{PL}' }})"); await idle(); await settle(gm)
            a = await scr(gm, 37.5, 12.5, 10.8); b = await scr(gm, 27.5, 7.5, 10)
            await mdrag(gm, a, b); await idle()
            t = await gm.evaluate(TOK + "('tok_kit000001')"); fb = await gm.evaluate(FALLBTN)
            check(t and t['y'] == 10 and abs(t['x'] - 27.5) < 0.1 and abs(t['z'] - 7.5) < 0.1 and len(fb) == 1 and fb[0]['text'] == 'Fall 10 ft?', 'a pawn let go over a hole hangs over it at 10 ft and is offered "Fall 10 ft?"', f"{t} {fb}")
            if A.shots: await shot(gm, 'over-hole')
            await gm.evaluate("(() => { const b = [...document.querySelectorAll('.cbtn')].find(x => x.textContent.includes('Fall')); b && b.click(); })()"); await idle()
            t = await gm.evaluate(TOK + "('tok_kit000001')")
            check(t['y'] == 0 and await gm.evaluate("tw.worldOf(tw.area()).pawnLevel(tw.entities().tok_kit000001)") == 0, 'taken: it falls through the hole onto the ground floor', str(t))
            # ROUND: a 10-ft hole on a crossing, from the bar's words; then made wider
            await gm.evaluate("tw.registry.run('hole.size', { d: 10 })"); await gm.wait_for_timeout(300)
            pt = await scr(gm, 31, 14, 10); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(200); await gm.mouse.click(pt['x'], pt['y']); await idle()
            rh = await gm.evaluate("Object.values(tw.entities()).filter(e => e.cat === 'hole-round').map(e => ({ id: e.id, x: e.x, y: e.y, z: e.z, d: e.dims[0] }))")
            check(len(rh) == 1 and rh[0]['x'] == 30 and rh[0]['z'] == 15 and rh[0]['y'] == 10 and rh[0]['d'] == 10, '"hole 10 ft": a round hole 10 ft across, put down on the nearest crossing of the upper floor', str(rh))
            RH = rh[0]['id'] if rh else None
            await gm.wait_for_timeout(1200)
            cells4 = [[5, 2], [6, 2], [5, 3], [6, 3]]
            f = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(cells4)})")
            check(f['tiles'] == 0 and f['clipped'] == 4 and f['slab'] == 4 and f['rim'] == 1, 'DRAWN: its four squares are floor again with the circle cut out (4 clipped tiles), the slab the same, and the slab\'s round cut edge', str(f))
            gin = await gm.evaluate("(() => { const p = tw.screenOf(30, 15, tw.main, 10); return tw.groundAt(p.x, p.y).y; })()"); gout = await gm.evaluate("(() => { const p = tw.screenOf(25.6, 10.6, tw.main, 10); return tw.groundAt(p.x, p.y).y; })()")
            check(gin == 0 and gout == 10, 'the pointer goes through the circle, and stops on the floor in the corner of its squares', f"{gin} {gout}")
            if A.shots: await shot(gm, 'round-hole')
            await gm.evaluate(f"tw.select('{RH}')"); await gm.wait_for_timeout(150)
            await gm.evaluate("tw.registry.run('hole.wider')"); await idle()
            e = await gm.evaluate(f"(() => {{ const e = tw.entities()['{RH}']; return {{ x: e.x, z: e.z, d: e.dims[0], name: e.name }}; }})()")
            check(e['d'] == 15 and e['x'] == 32.5 and e['z'] == 17.5 and len(await gm.evaluate(HOLES + "(10)")) == 3 + 9, '☰ Wider: 15 ft across, on a square\'s centre now, cutting nine squares', str(e))
            await gm.evaluate("tw.registry.run('hole.narrower')"); await idle()
            check(await gm.evaluate(f"tw.entities()['{RH}'].dims[0]") == 10, '☰ Narrower: back to 10 ft')
            # the player has the same holes
            await wait(pl, f"tw.entities()['{RH}']?.dims?.[0] === 10", 8000, 'player round hole')
            a1 = await gm.evaluate(HOLES + "(10)"); b1 = await pl.evaluate(HOLES + "(10)")
            check(a1 == b1, 'the player has the same holes in the same floor', f"{a1} {b1}")
            # undo takes the last change back; deleting a hole closes the floor
            await gm.evaluate(f"tw.select('{RH}')"); await gm.keyboard.press('Delete'); await idle(); await gm.wait_for_timeout(600)
            f = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(cells4)})")
            check(f['tiles'] == 4 and f['clipped'] == 0 and f['rim'] == 0, 'deleted: the floor is whole again on its squares', str(f))
            await gm.keyboard.press('Control+z'); await idle()
            check(await gm.evaluate(f"!!tw.entities()['{RH}']"), 'undo brings it back')
            await gm.evaluate("(tw.setCut(null, { by: 'test' }))")


        if 'pit' in ONLY:
            print('PIT: the library\'s pits (a through shaft, a spike pit)')
            G2 = await gm.evaluate("tw.spawnRoom('common', 14, 0, 4, 4, 7)"); await idle()
            U2 = await gm.evaluate("tw.spawnRoom('guest', 14, 0, 4, 4, 44, undefined, 10)"); await idle()
            for rid in (G2, U2): await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{rid}').forEach(o => tw.dispatch('object.delete', {{ id: o.id }}))")
            await idle(); await gm.evaluate("tw.condButtons.hide('stair-offer')")
            await gm.evaluate("(tw.setLevel(10), tw.setCut(19, { pinned: true, by: 'test' }))"); await view(gm, 80, 10, 55, 62); await settle(gm); await quiet(gm)
            async def put(cat, x, z):
                await quiet(gm)
                await gm.evaluate(f"tw.modes.place(tw.assets.catById.get('{cat}'))"); await gm.wait_for_timeout(300)
                pt = await scr(gm, x, z, 10); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(200); await gm.mouse.click(pt['x'], pt['y']); await idle()
                await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
                return await gm.evaluate(f"(() => {{ const e = Object.values(tw.entities()).filter(o => o.cat === '{cat}').pop(); return e && {{ id: e.id, x: e.x, y: e.y, z: e.z }}; }})()")
            sh = await put('mine-shaft-collar', 82, 6)
            check(sh and sh['x'] == 82.5 and sh['z'] == 7.5 and sh['y'] == 10, 'the mine shaft goes down on a square\'s centre of the upper floor', str(sh))
            await wait(gm, f"tw.worldOf(tw.area()).recs.get('{sh['id']}')?.visual?.userData?.holeClip", 30000, 'shaft mesh clipped')
            check('16:1' in await gm.evaluate("[...tw.ST.holesAt(tw.entities(), 10)]") and await gm.evaluate(f"!!tw.worldOf(tw.area()).recs.get('{sh['id']}').visual.userData.holeClip"), 'it is a THROUGH pit: the floor under its opening is cut and its own black bottom is cut out of its mesh')
            gin = await gm.evaluate("(() => { const p = tw.screenOf(82.5, 7.5, tw.main, 10); return tw.groundAt(p.x, p.y).y; })()")
            check(gin == 0, 'the pointer goes down the shaft to the floor below', gin)
            if A.shots: await view(gm, 82.5, 7.5, 30, 70); await gm.wait_for_timeout(600); await shot(gm, 'shaft'); await view(gm, 80, 10, 55, 62)
            await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_bram00001', name: 'Bram', x: 87.5, y: 10, z: 17.5, owner: '{PL}' }})"); await idle(); await settle(gm); await quiet(gm)
            await mdrag(gm, await scr(gm, 87.5, 17.5, 10.8), await scr(gm, 82.5, 7.5, 10)); await idle()
            t = await gm.evaluate(TOK + "('tok_bram00001')"); fb = await gm.evaluate(FALLBTN)
            check(t['y'] == 10 and abs(t['x'] - 82.5) < 0.1 and len(fb) == 1 and fb[0]['text'] == 'Fall 10 ft?', 'a pawn let go over the shaft hangs over it and is offered "Fall 10 ft?"', f"{t} {fb}")
            await gm.evaluate("(() => { const b = [...document.querySelectorAll('.cbtn')].find(x => x.textContent.includes('Fall')); b && b.click(); })()"); await idle()
            check((await gm.evaluate(TOK + "('tok_bram00001')"))['y'] == 0, 'taken: down the shaft to the ground floor')
            # the spike pit: a pit with its own bottom
            sp = await put('trap-spike-pit', 77.5, 12.5)
            check(sp and sp['y'] == 10 and not await gm.evaluate(f"tw.ST.holesAt(tw.entities(), 10).has('15:2')"), 'the spike pit stands on the upper floor and cuts nothing (it has a bottom of its own)', str(sp))
            await gm.evaluate("tw.dispatch('token.move', { id: 'tok_bram00001', x: 87.5, z: 17.5, y: 10 })"); await idle(); await quiet(gm)
            await mdrag(gm, await scr(gm, 87.5, 17.5, 10.8), await scr(gm, sp['x'] + 0.6, sp['z'] + 0.4, 10.5)); await idle()
            fb = await gm.evaluate(FALLBTN); t = t0 = await gm.evaluate(TOK + "('tok_bram00001')")
            check(len(fb) == 1 and fb[0]['text'] == 'Fall into the spike pit?', 'a pawn put down on it is offered "Fall into the spike pit?"', f"{t} {fb}")
            if A.shots: await shot(gm, 'spike-offer')
            await gm.evaluate("(() => { const b = [...document.querySelectorAll('.cbtn')].find(x => x.textContent.includes('Fall')); b && b.click(); })()"); await idle()
            t = await gm.evaluate(TOK + "('tok_bram00001')"); chat = await gm.evaluate("(tw.view().chat || []).map(c => c.text)")
            check(abs(t['x'] - sp['x']) < 0.05 and abs(t['z'] - sp['z']) < 0.05 and abs(t['y'] - 10.25) < 0.05 and chat[-1] == 'Bram falls into the spike pit', 'taken: it is in the middle of the pit, at its bottom, and the chat says "Bram falls into the spike pit"', f"{t} {chat[-1:]}")
            await quiet(gm); await gm.keyboard.press('Control+z'); await idle()
            t = await gm.evaluate(TOK + "('tok_bram00001')")
            check(abs(t['y'] - t0['y']) < 0.05 and abs(t['x'] - t0['x']) < 0.05 and 'Bram falls into the spike pit' not in await gm.evaluate("(tw.view().chat || []).map(c => c.text)"), 'one undo puts it back where it was put down and takes the line away', f"{t} vs {t0}")
            await gm.evaluate("(tw.setCut(null, { by: 'test' }))")

        if 'stack' in ONLY:
            # STACKED HOLES (Harry 2026-10-27: "When I drop something down a stack of two holes on top of each other ... it asks
            # to 'drop 10 ft' and then lands on next hole, and then asks to 'drop 10 ft' again... should probably just be 'drop
            # 20 ft'"). Three storeys (0, 10, 20 ft); holes in the 20 and 10-ft floors on the same squares: one fall, the whole way.
            print('STACK: holes over holes, one fall to the bottom')
            S0 = await gm.evaluate("tw.spawnRoom('common', 24, 0, 4, 4, 8)"); await idle()
            S1 = await gm.evaluate("tw.spawnRoom('guest', 24, 0, 4, 4, 45, undefined, 10)"); await idle()
            S2 = await gm.evaluate("tw.spawnRoom('guest', 24, 0, 4, 4, 46, undefined, 20)"); await idle()
            for rid in (S0, S1, S2): await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.room === '{rid}').forEach(o => tw.dispatch('object.delete', {{ id: o.id }}))")
            await idle(); await gm.evaluate("tw.condButtons.hide('stair-offer')")
            HOLE = "((id, cat, x, y, z, d) => tw.dispatch('object.place', { id, cat, name: cat === 'hole' ? 'hole' : `round hole ${d} ft`, place: cat === 'hole' ? 'tile' : 'floor', layer: 'floor', flat: true, x, y, z, dims: [d, 0.05, d] }))"
            # square over square at (127.5, 2.5); round 10 ft over round 10 ft on the crossing (130, 15); and a round 10-ft hole
            # at 20 ft on the crossing (135, 5) over only ONE square hole below it (partial overlap: one of its four squares)
            for args in [("obj_stksq20", 'hole', 127.5, 20, 2.5, 5), ("obj_stksq10", 'hole', 127.5, 10, 2.5, 5),
                         ("obj_stkrd20", 'hole-round', 130, 20, 15, 10), ("obj_stkrd10", 'hole-round', 130, 10, 15, 10),
                         ("obj_stkpt20", 'hole-round', 135, 20, 5, 10), ("obj_stkpt10", 'hole', 137.5, 10, 2.5, 5)]:
                await gm.evaluate(HOLE + f"{tuple(args)!r}".replace("'", '"'))
            await idle()
            await gm.evaluate("(tw.setLevel(20), tw.setCut(29, { pinned: true, by: 'test' }))"); await view(gm, 130, 10, 60, 62); await settle(gm); await quiet(gm)
            await gm.wait_for_timeout(1200)
            DROP = "((id, x, y, z) => { const e = tw.entities()[id]; return tw.pawnDropAt(e, x, y, z); })"
            await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_stack0001', name: 'Rook', x: 122.5, y: 20, z: 12.5, owner: '{PL}' }})"); await idle(); await settle(gm)
            for (x, z, want, what) in [(127.5, 2.5, 20, 'square over square'), (130, 15, 20, 'round over round (its middle)'), (132.5, 17.5, 20, 'round over round (inside both circles)'),
                                       (137.5, 2.5, 20, 'a round hole over a square one: where the square is under it'), (132.5, 2.5, 10, 'the same round hole where the floor below is whole'),
                                       (122.5, 12.5, 0, 'no hole: on the floor')]:
                d = await gm.evaluate(DROP + f"('tok_stack0001', {x}, 20, {z})")
                check(d and abs(d['drop'] - want) < 0.05, f'over {what}: the drop from the 20-ft floor is {want} ft', str(d))
            # dragged onto the stacked square holes: ONE offer, the whole way down, and one fall to the ground floor
            await mdrag(gm, await scr(gm, 122.5, 12.5, 20.8), await scr(gm, 127.5, 2.5, 20)); await idle()
            t = await gm.evaluate(TOK + "('tok_stack0001')"); fb = await gm.evaluate(FALLBTN)
            check(t and t['y'] == 20 and abs(t['x'] - 127.5) < 0.1 and abs(t['z'] - 2.5) < 0.1 and len(fb) == 1 and fb[0]['text'] == 'Fall 20 ft?', 'let go over two holes one over the other: it hangs at 20 ft and is offered "Fall 20 ft?" (not 10)', f"{t} {fb}")
            await gm.evaluate("(() => { const b = [...document.querySelectorAll('.cbtn')].find(x => x.textContent.includes('Fall')); b && b.click(); })()"); await idle()
            t = await gm.evaluate(TOK + "('tok_stack0001')"); chat = await gm.evaluate("(tw.view().chat || []).map(c => c.text)")
            check(t['y'] == 0 and chat[-1] == 'Rook falls 20 ft' and not await gm.evaluate("tw.condButtons.has('fall')"), 'taken: one fall to the ground floor, "Rook falls 20 ft", and nothing more is offered', f"{t} {chat[-1:]}")
            # round over round: the same, by the bar's "fall"
            await quiet(gm); await gm.evaluate("tw.dispatch('token.move', { id: 'tok_stack0001', x: 132.5, z: 17.5, y: 20 })"); await idle()
            await gm.evaluate("tw.select('tok_stack0001')"); await gm.wait_for_timeout(150)
            ttl = await gm.evaluate("tw.registry.titleOf(tw.registry.get('pawn.fall'))")
            await gm.evaluate("tw.registry.run('pawn.fall')"); await idle()
            t = await gm.evaluate(TOK + "('tok_stack0001')")
            check(t['y'] == 0 and ttl.startswith('Fall 20 ft'), 'over two round holes the bar\'s "fall" drops it the whole 20 ft to the ground floor', f"{t} {ttl}")
            # a THING dragged (a real mouse) onto the two round holes goes down both, onto the ground floor (the pointer goes
            # through every opening; neither hole's invisible plate is a table top to stand it on)
            await gm.evaluate("(() => { const sz = tw.roomgen.sizeOf('crate'); tw.dispatch('object.place', { id: 'obj_stkbox1', name: 'crate', cat: 'crate', sku: sz.sku, url: sz.url, place: 'floor', x: 122.5, y: 20, z: 7.5, dims: sz.dims, s: sz.s || undefined, yaw: sz.yaw }); })()"); await idle(); await settle(gm); await gm.wait_for_timeout(600)
            await view(gm, 131, 16, 60, 88); await gm.wait_for_timeout(400); await quiet(gm)  # (from overhead: the pointer goes down through both circles)
            await mdrag(gm, await scr(gm, 122.5, 7.5, 21), await scr(gm, 132.5, 17.5, 0)); await idle()
            bx = await gm.evaluate(TOK + "('obj_stkbox1')")
            check(bx and bx['y'] == 0 and abs(bx['x'] - 132.5) < 1.5 and abs(bx['z'] - 17.5) < 1.5, 'a thing dragged onto two round holes one over the other goes down both, onto the ground floor', str(bx))
            await gm.evaluate("(tw.setCut(null, { by: 'test' }))")

        check(not errors, 'no page errors', '; '.join(errors[:3]))
        await browser.close()

try:
    asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"falls: {len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
