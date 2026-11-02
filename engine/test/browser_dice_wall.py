#!/usr/bin/env python3
"""A PLAYER ROLLING WITH THE VIEW ON A WALL (2026-11-01, a stranger's table from r/VTT: a player seat rolled 3d10 three times;
the first throw was a normal one, the next two came in as one flat set-down with all three dice on one point, 8.0 ft from
the pawn, just past the wall of its room). A pawn's hand aims 8 ft ahead along the view. Ahead lay the next room, and the
dice had to stay in the room of the TARGET, so every landing in the pawn's own room was refused and the next room is dark to
the player: all tries spent, nothing open, the dice set down in the dark, and nothing drawn for the roller.
Two rooms sharing one wall at z = 20; the pawn in the south one, 7.5 ft from it, fog on.
  W1  facing the wall: the dice are thrown (no fallback), land in the pawn's room, spread out, and are drawn for the roller
  W2  and they reach the roller's screen (in-frame A/B, pixels), and read the committed numbers on both seats
  W3  a second roll from the same spot does the same
  W4  fog off, the same: still in the pawn's room, never set down behind the wall
  W5  facing away: as ever, a normal throw
  W6  the GM (no pawn): the hand in the view still works, in the room the view looks into
  W8  "/r" and "/roll" typed key by key, as a player does: /r d20, /r 2d6+1, /roll d20, /r stealth, all roll; "r" alone, and "r"
      before words that are no roll, do not (the "/" never reaches the bar's parsers: it opens the bar)
  W9  a pawn really upstairs (a storey over a ground room), 7.5 ft from a wall shared with the next upstairs room, facing it:
      thrown, landing on its own floor in its own room, drawn for the roller
  W10 a phone-sized player seat, same wall, facing it: the empty bar's Roll d20 throws, and it reaches that screen
  W7  no page errors
  local:  python3 engine/test/browser_dice_wall.py --local   (TW_GPU=0: SwiftShader)
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
SOFT = os.environ.get('TW_GPU', '1') == '0'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if SOFT else ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
JOIN_MS = 240000 if SOFT else 90000
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:500] if detail != '' else ''}", flush=True)

procs = []
RP, SP = 18321, 18322
def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as sk:
            if sk.connect_ex(('127.0.0.1', port)) == 0: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-dicewall-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=100); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
LAST = "tw.view().chat.slice(-1)[0]"
LOOK = "([x, z, dist, yaw]) => { const g = tw.main.grab; g.focus.set(x, 0, z); g.dist = dist; g.pitch = 55; g.yaw = yaw; g.update(); }"
READ = """(id) => { const t = tw.dice.info().find(x => x.id === id), l = tw.dice.last;
  return { settled: t?.settled, drawn: t?.drawn, reads: t?.dice.map(d => d.reads), at: t?.dice.map(d => [+d.p[0].toFixed(1), +d.p[2].toFixed(1)]), ys: t?.dice.map(d => +d.p[1].toFixed(1)), fallback: l?.fallback, tries: l?.tries, reasons: l?.reasons, to: l && [+l.to.x.toFixed(1), +l.to.z.toFixed(1)] }; }"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1000, 'height': 640}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('console', lambda m: errors.append(m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(200)
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', f"TEST dice wall {time.strftime('%m-%d %H:%M:%S')} (throwaway)"); await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog && tw.dice', JOIN_MS), 'GM did not come up'
        idle = lambda: wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 170000)
        for z in (4, 0):  # A: z 20..40, B: z 0..20
            await gm.evaluate('(z) => tw.spawnRoom("common", 0, z, 4, 4, 7610 + z)', z); await idle()
        # W9: a ground room, and two rooms on the storey over it sharing a wall at z = 20 (x 40..60, y 10)
        await gm.evaluate("tw.spawnRoom('common', 8, 0, 4, 8, 7620)"); await idle()
        for z in (4, 0): await gm.evaluate("(z) => tw.spawnRoom('guest', 8, z, 4, 4, 7621 + z, undefined, 10)", z); await idle()
        await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length >= 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        seat = await gm.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Mira').id")
        PAWN = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'token')?.id")
        if PAWN: await action(gm, f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 10, z: 27.5 }})")
        else: PAWN = 'tok_dicewall01'; await action(gm, 'tw.dispatch("token.create", ' + json.dumps({'id': PAWN, 'name': 'Mira', 'x': 10, 'z': 27.5, 'owner': seat}) + ')')
        await action(gm, "tw.registry.run('area.fogOfWar.on')")
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog && tw.dice', JOIN_MS), 'player did not join'
        await wait(pl, "tw.fog.visible(10, 27, 0) && !tw.fog.visible(10, 12, 0)", 60000, 'player vision')

        seats = [gm, pl]
        # (software GL: a tab can stall for many seconds, past the 6 s the dice lie there. So each seat throws once first, which
        # makes its dice and loads the physics, and then they lie there until cleared; each tab pins the throw at its end, and
        # is given frames to judge each die against the fog.)
        HOLD = "tw.worldOf(tw.area()).dice.params.timing.linger = 3600"
        async def warm(pg):
            await pg.evaluate("tw.roll('d6')"); await wait(pg, "!!tw.worldOf(tw.area()).dice", 60000, 'dice made'); await pg.evaluate(HOLD)
        async def pin(pg, rid):
            if not await wait(pg, f"!!tw.dice.info().find(t => t.id === '{rid}')", 60000, 'the throw reached this seat'): return False
            await pg.evaluate(f"tw.dice.seek('{rid}', 99)")
            await pg.evaluate("tw.gfx?.wake?.('dice'); new Promise(r => { let n = 4; const f = () => --n ? requestAnimationFrame(f) : r(); f(); })"); await pg.wait_for_timeout(300)
            return True
        async def roll(pg, how=None):
            for q in seats: await q.evaluate("tw.dice.clear()")
            n0 = await pg.evaluate("tw.view().chat.length")
            if how: await how()
            else: await pg.evaluate("tw.roll('3d10')")
            await wait(pg, f"tw.view().chat.length > {n0}", 20000, 'committed')
            rid = await pg.evaluate(f"{LAST}.id"); rolls = await pg.evaluate(f"{LAST}.roll.rolls")
            o = next(q for q in seats if q is not pg); await asyncio.gather(pin(pg, rid), pin(o, rid))
            ab = await pg.evaluate("tw.dice.abPixels()"); r = await pg.evaluate(READ, rid); other = await o.evaluate(READ, rid)
            spread = len({tuple(a) for a in (r['at'] or [])}) == len(r['at'] or []) > 0
            in_a = bool(r['at']) and all(0 < a[0] < 20 and 20 < a[1] < 40 for a in r['at'])
            return {**r, 'rolls': rolls, 'px': ab and ab['px'], 'spread': spread, 'inA': in_a, 'otherReads': other['reads']}

        await warm(gm); await warm(pl)
        await pl.evaluate(LOOK, [10, 27.5, 34, 0]); await pl.wait_for_timeout(800)
        a = await roll(pl)
        check(not a['fallback'] and a['spread'] and a['inA'] and a['drawn'] == [True] * 3, 'W1 facing the wall: thrown, spread out, in the pawn\'s room, drawn for the roller', a)
        check((a['px'] or 0) > 200 and a['reads'] == a['rolls'] == a['otherReads'], 'W2 they reach the screen, and read the committed numbers on both seats', {k: a[k] for k in ('px', 'reads', 'rolls', 'otherReads')})
        b = await roll(pl)
        check(not b['fallback'] and b['inA'] and b['drawn'] == [True] * 3, 'W3 a second roll from the same spot does the same', b)
        await action(gm, "tw.registry.run('area.fogOfWar.off')"); await wait(pl, "!tw.fog.active?.(tw.area())", 10000, 'fog off')
        c = await roll(pl)
        check(not c['fallback'] and c['inA'] and c['drawn'] == [True] * 3, 'W4 fog off: still in the pawn\'s room, not behind the wall', c)
        await action(gm, "tw.registry.run('area.fogOfWar.on')"); await wait(pl, "tw.fog.active?.(tw.area()) && tw.fog.visible(10, 27, 0)", 30000, 'fog on')
        await pl.evaluate(LOOK, [10, 27.5, 34, 180]); await pl.wait_for_timeout(800)
        d = await roll(pl)
        check(not d['fallback'] and d['tries'] <= 22 and d['inA'] and d['drawn'] == [True] * 3, 'W5 facing away: a normal throw', d)
        await gm.evaluate(LOOK, [10, 10, 34, 0]); await gm.wait_for_timeout(800)
        e = await roll(gm)
        check(not e['fallback'] and all(0 < x[0] < 20 and 0 < x[1] < 20 for x in e['at'] or [[0, 0]]) and e['drawn'] == [True] * 3, 'W6 the GM (no pawn): the dice land in the room the view looks into', e)

        print('"/r" TYPED KEY BY KEY')
        await pl.evaluate(LOOK, [10, 27.5, 34, 180]); await pl.wait_for_timeout(600)
        async def typed(words):
            await pl.keyboard.press('Escape'); await pl.wait_for_timeout(150)
            await pl.keyboard.press('/'); await pl.wait_for_timeout(200)  # (the first "/" opens the bar, as for a person)
            await pl.keyboard.type(words[1:], delay=30); await pl.wait_for_timeout(350)
            return await pl.evaluate("document.querySelector('#results .res[data-i=\"0\"]')?.dataset.ref || null")
        got = {}
        for words, label in (('/r d20', 'd20'), ('/r 2d6+1', '2d6+1'), ('/roll d20', 'd20'), ('/r stealth', 'd20')):
            n0 = await pl.evaluate("tw.view().chat.length"); top = await typed(words); await pl.keyboard.press('Enter')
            ok = await wait(pl, f"tw.view().chat.length > {n0}", 15000, f'{words} committed'); got[words] = {'top': top, 'expr': ok and await pl.evaluate(f"{LAST}.roll?.expr"), 'want': label}
            await pl.wait_for_timeout(600)
        check(all(g['top'] == 'cmd:chat.roll' and g['expr'] == g['want'] for g in got.values()), 'W8 /r d20, /r 2d6+1, /roll d20 and /r stealth all roll', got)
        # ("Roll dice…" itself is a row of the plain list, and "r" is the start of its name: a row, as it always was, that rolls
        # nothing. What must not happen is a roll.)
        tops, rolled = {}, {}
        for words in ('/r', '/r ', '/r d'):
            n0 = await pl.evaluate("tw.view().chat.length"); tops[words] = await typed(words); await pl.keyboard.press('Enter'); await pl.wait_for_timeout(700)
            rolled[words] = await pl.evaluate("tw.view().chat.length") > n0
        for words in ('/r nothing here', '/rotate', '/rename'): tops[words] = await typed(words)
        await pl.keyboard.press('Escape'); await pl.wait_for_timeout(200)
        check(not any(rolled.values()) and not any(tops[w] == 'cmd:chat.roll' for w in ('/r nothing here', '/rotate', '/rename')), 'W8 "r" alone, and "r" before words that are no roll, roll nothing', {'tops': tops, 'rolled': rolled})

        print('A PAWN REALLY UPSTAIRS')
        await gm.evaluate("tw.dice.clear()"); await action(gm, f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 50, z: 27.5, y: 10 }})")
        up = await wait(pl, f"tw.entities()['{PAWN}'].y === 10 && tw.fog.visible(50, 27.5, 10) && !tw.fog.visible(50, 12, 10)", 60000, 'pawn upstairs')
        await pl.wait_for_timeout(1500); await pl.evaluate(LOOK, [50, 27.5, 34, 0]); await pl.wait_for_timeout(800)
        lv = await pl.evaluate(f"(() => {{ const e = tw.entities()['{PAWN}']; return {{ y: e.y, fogL: tw.worldOf(tw.area()).fogLevel(), rooms: Object.values(tw.entities()).filter(r => r.kind === 'room').map(r => [r.recipe.x, r.recipe.z, r.recipe.y || 0]) }}; }})()")
        f = await roll(pl)
        lvl = await pl.evaluate("tw.dice.last?.level")
        ys = f['ys'] or []
        check(up and lvl == 10 and not f['fallback'] and all(40 < a[0] < 60 and 20 < a[1] < 40 for a in f['at'] or [[0, 0]]) and len(ys) == 3 and all(10 < y < 13 for y in ys) and f['drawn'] == [True] * 3 and (f['px'] or 0) > 200,
              'W9 upstairs, 7.5 ft from a shared wall, facing it: thrown, on its own floor, in its own room, drawn', {**f, 'up': up, 'level': lvl, 'ys': ys, 'state': lv})
        await action(gm, f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 10, z: 27.5, y: 0 }})"); await wait(pl, f"(tw.entities()['{PAWN}'].y || 0) === 0 && tw.fog.visible(10, 27, 0)", 40000, 'pawn back down')

        print('A PHONE-SIZED PLAYER SEAT')
        await pl.context.close()  # (the same seat on a phone; one player tab at a time on software GL)
        pctx = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
        ph = await pctx.new_page(); ph.on('pageerror', lambda e: errors.append('phone ' + str(e))); await ph.goto(invite)
        seats[1] = ph
        joined = await wait(ph, 'window.tw?.ready?.() && tw.fog && tw.dice', JOIN_MS, 'phone joined') and await wait(ph, "tw.fog.visible(10, 27, 0)", JOIN_MS, 'phone vision')
        if joined:
            await ph.wait_for_timeout(2000); await warm(ph); await ph.evaluate(LOOK, [10, 27.5, 34, 0]); await ph.wait_for_timeout(800)
            rows = []
            async def tap_roll():
                await ph.locator('#bar input').tap(timeout=20000); await ph.wait_for_timeout(900)
                rows.extend(await ph.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 2).map(r => r.innerText.replace(/\\s+/g, ' ').trim())"))
                await ph.locator('#results .res').first.tap(timeout=20000)
            g = await roll(ph, how=tap_roll)
            check(rows and rows[0].lower().startswith('roll d20') and not g['fallback'] and g['drawn'] == [True] and (g['px'] or 0) > 50 and g['reads'] == g['rolls'], 'W10 a phone seat, facing the wall: Roll d20 throws, and reaches that screen', {**g, 'rows': rows})
            await ph.screenshot(path=os.path.join(HERE, 'shots', 'dicewall-phone.png'), timeout=170000)
        else: check(False, 'W10 a phone seat, facing the wall: Roll d20 throws, and reaches that screen', 'the phone seat never came up')
        check(not errors, 'W7 no page errors', errors[:4])
        await browser.close()
    for pr in procs: pr.terminate()
    n = sum(1 for r in results if r[0]); print(f'\nbrowser dice wall: {n}/{len(results)} passed'); sys.exit(0 if n == len(results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
