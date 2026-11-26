#!/usr/bin/env python3
"""A storey the fog keeps from a player does not cover the room under it: that room's things are drawn.  (2026-11-05)

  local:  python3 engine/test/browser_fog_covered.py --local
          (TW_PORTS=relay,web picks the two ports: another worktree may be running this suite)

Why this suite exists: on live Harry, an invited PLAYER with fog of war on, looked at a two-storey tavern: the ground-floor
common room showed its floor and walls but nearly all its furniture was missing. He had explored the whole ground floor
and none of the upper storey. world.js cutSets counted the room as COVERED (every cell under a room on the floor above),
and a covered room's things are not drawn ("what nobody can see costs nothing"); but for him that upper storey is not
drawn either (fog of war), so he looked straight down into a room emptied by the perf rule.
  F1 the GM builds a tavern: a common room and an upper storey over ALL of it; invites a player; his pawn in the common room
  F2 the player, view on all levels (as a new player's is): every common-room thing he has explored is drawn; the upper
     storey he has not seen stays hidden (privacy: nothing the fog keeps is shown)
  F3 the same with the view on this level only
  F4 the GM (no fog), all levels: the common room IS covered, its things not drawn (the perf rule still works)
  F4b the GM previews as the player (only the fog changes): the room's things are drawn; back as GM, culled again
  F5 the player goes upstairs and sees that storey: now it is drawn for him and covers the room below, which is culled
     again (without a reload: the fog refresh re-works the covered rooms)
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('shift')
tw_sandbox.placeholder_pawns(True)
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); SHOTS = os.path.join(HERE, 'shots')
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18558,18958').split(','))
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--headed', action='store_true')
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
    data = tempfile.mkdtemp(prefix='tw-fogcov-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
    try: await page.wait_for_function(js, timeout=timeout, polling=100); return True
    except Exception: print(f'    (timed out: {what or js})'); return False

async def bar(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(250); await pg.keyboard.press('Enter')

async def output(pg, contains=''):
    await wait(pg, f"!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('{contains}')", 10000, 'output panel')
    v = await pg.evaluate("document.querySelector('#output textarea').value"); await pg.keyboard.press('Escape'); return v

# A ROOM'S THINGS AS THIS SEAT DRAWS THEM. `culls` are the things the perf rule may skip (not stairs, kit, edge pieces);
# `knownCulled` are things the fog lets this seat see, the cut does not hide, and that are not drawn: the bug.
ROOM_JS = """(rid) => { const w = tw.worldOf(tw.area()); w.cutPass(); const out = { n: 0, culls: 0, drawn: 0, fogHidden: 0, knownCulled: [], drawnHidden: [], covered: w.coveredRooms.has(rid), roomFog: !!w.fogRule?.(tw.entities()[rid]), fogActive: !!w.fogActive, cut: w.cut ?? null };
  for (const r of w.recs.values()) { const e = r.entity; if (e.kind !== 'object' || e.room !== rid) continue; out.n++;
    const cullable = e.place !== 'stair' && e.place !== 'kit' && !e.fromEdge; if (cullable) out.culls++;
    const fog = !!w.fogRule?.(e); if (fog) out.fogHidden++;
    if (r.group.visible) { out.drawn++; if (fog) out.drawnHidden.push(e.id); }
    else if (!fog && !w.cutHides(e) && cullable && out.knownCulled.length < 50) out.knownCulled.push(e.id); }
  out.floorFogged = [...w.shell.values()].filter(s => s.roomId === rid && s.spec.layer === 'floor').map(s => !!w.fogHidesShell(s));
  out.floorFogged = { pieces: out.floorFogged.length, fogged: out.floorFogged.filter(Boolean).length };
  out.knownCulled = { count: out.knownCulled.length, some: out.knownCulled.slice(0, 3) }; return out; }"""

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
        room = lambda pg, rid: pg.evaluate(ROOM_JS, rid)
        async def look(pg, x, z, dist=60):
            await pg.evaluate(f"(() => {{ const g = tw.main.grab; tw.centreOn({{ x: {x}, y: 0, z: {z} }}, tw.main, {{ ms: 0 }}); g.dist = {dist}; g.update(); }})()"); await pg.wait_for_timeout(700)

        # ---------- F1 the tavern, the invite, his pawn in the common room ----------
        gm = await new_page(page_url)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST fog covered ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)')
        await gm.click('#newCampaign button')
        check(await wait(gm, ready, 60000, 'gm ready'), 'GM tab live')
        fog = await gm.evaluate("tw.sync.campaign.defaults?.fogOfWar")
        common = await gm.evaluate("tw.spawnRoom('common', -6, -6, 4, 6, 7511)"); await idle(gm)              # x -30..-10, z -30..0 ft
        upper = await gm.evaluate("tw.spawnRoom('fine', -6, -6, 4, 6, 7512, undefined, 10)"); await idle(gm)   # the storey over ALL of it
        await gm.evaluate("tw.settings.setPref('invitePawn', true)")
        await bar(gm, 'invite zifnab')
        link = await output(gm, '#s=')
        ph = await gm.evaluate('tw.lastPlaceholder'); pid, seat = ph['id'], ph['seat']
        await wait(gm, f"tw.entities()['{pid}'] && tw.sync.pendingCount() === 0", 8000, 'placeholder on the table')
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{pid}', x: -20, z: -15 }})")
        await wait(gm, f"tw.entities()['{pid}'].x === -20 && tw.sync.pendingCount() === 0", 8000, 'pawn in the common room')
        C0 = await room(gm, common)
        check(fog and C0['n'] >= 5 and C0['culls'] >= 5, 'F1: a furnished common room under a storey that covers all of it; fog of war on', {'fog': fog, 'things': C0['n']})

        # ---------- F2 the player, all levels ----------
        pl = await new_page(link)
        check(await wait(pl, ready, 60000, 'player ready'), 'the player opened the invite link')
        await wait(pl, 'tw.arrival.centred', 8000, 'arrival'); await idle(pl)
        # his sight has reached every common-room thing (the vision worker is asynchronous)
        seen = await wait(pl, f"(() => {{ const w = tw.worldOf(tw.area()); const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{common}'); return w.fogActive && es.length > 0 && es.every(e => !w.fogRule(e)); }})()", 30000, 'his sight over the common room')
        await pl.evaluate("tw.cutOff('test')"); await pl.wait_for_timeout(400); await look(pl, -20, -15)
        P2, U2 = await room(pl, common), await room(pl, upper)
        print('    F2 player, all levels: common', json.dumps(P2), '\n    upper', json.dumps(U2))
        check(seen and P2['fogActive'] and P2['cut'] is None and U2['roomFog'] and U2['floorFogged']['fogged'] == U2['floorFogged']['pieces'] > 0, 'F2: he has seen the whole common room and none of the upper storey (its floor not drawn for him)', {'seen': seen, 'upper floor': U2['floorFogged']})
        check(not P2['knownCulled']['count'] and P2['drawn'] >= P2['culls'] and not P2['covered'], 'F2: all levels: every common-room thing he has seen is drawn (the unseen storey covers nothing)', {'drawn': P2['drawn'], 'of': P2['n'], 'culled': P2['knownCulled']['count']})
        check(U2['drawn'] == 0, 'F2: the upper storey\'s things stay hidden from him (privacy)', {'drawn': U2['drawn'], 'of': U2['n']})
        await pl.screenshot(path=os.path.join(SHOTS, 'fog-covered-player-all.png'))

        # ---------- F3 this level only ----------
        await pl.evaluate("tw.cutOn('test')"); await pl.wait_for_timeout(500)
        P3, U3 = await room(pl, common), await room(pl, upper)
        check(P3['cut'] is not None and not P3['knownCulled']['count'] and P3['drawn'] >= P3['culls'], 'F3: this level only: every common-room thing he has seen is drawn', {'cut': P3['cut'], 'drawn': P3['drawn'], 'culled': P3['knownCulled']['count']})
        check(U3['drawn'] == 0, 'F3: the upper storey\'s things stay hidden from him', U3['drawn'])
        await pl.evaluate("tw.cutOff('test')"); await pl.wait_for_timeout(400)

        # ---------- F4 the GM, all levels: the perf rule still culls ----------
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(400); await look(gm, -20, -15)
        G4 = await room(gm, common)
        print('    F4 GM, all levels: common', json.dumps(G4))
        check(not G4['fogActive'] and G4['covered'] and G4['drawn'] <= G4['n'] - G4['culls'], 'F4: for the GM the common room is covered and its things are not drawn (what nobody can see costs nothing)', {'covered': G4['covered'], 'drawn': G4['drawn'], 'of': G4['n']})

        # ---------- F4b the GM views as zifnab (the vision preview): the fog alone changes, and the covered rooms follow it ----------
        await gm.evaluate(f"tw.setVisionViewer('{seat}')")
        pv = await wait(gm, f"(() => {{ const w = tw.worldOf(tw.area()); const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{common}'); return w.fogActive && es.every(e => !w.fogRule(e)) && !!w.fogRule(tw.entities()['{upper}']); }})()", 30000, 'the preview as zifnab')
        await gm.wait_for_timeout(600); G4b = await room(gm, common)
        check(pv and not G4b['covered'] and not G4b['knownCulled']['count'], "F4b: the GM viewing as zifnab sees what he does: the common room's things drawn", {'covered': G4b['covered'], 'drawn': G4b['drawn'], 'of': G4b['n']})
        await gm.evaluate("tw.setVisionViewer('gm')"); await wait(gm, "!tw.worldOf(tw.area()).fogActive", 15000, 'back to the GM view'); await gm.wait_for_timeout(600); G4c = await room(gm, common)
        check(G4c['covered'] and G4c['drawn'] <= G4c['n'] - G4c['culls'], 'F4b: back to the GM view: covered and culled again', {'covered': G4c['covered'], 'drawn': G4c['drawn']})

        # ---------- F5 he goes upstairs and sees it: the room below is covered again for him ----------
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{pid}', x: -20, z: -15, y: 10 }})")
        await wait(pl, f"tw.entities()['{pid}']?.y === 10", 8000, 'upstairs'); await idle(pl)
        up = await wait(pl, f"(() => {{ const w = tw.worldOf(tw.area()); const fl = [...w.shell.values()].filter(s => s.roomId === '{upper}' && s.spec.layer === 'floor'); return fl.length > 0 && fl.every(s => !w.fogHidesShell(s)); }})()", 30000, 'his sight over the upper floor')
        # (no cut change, no reload here: the pawn's move re-worked the covered rooms BEFORE his new sight came back from the
        #  vision worker; only the fog refresh itself can bring them up to date: fog.js refreshWorld's cutDirty)
        await pl.wait_for_timeout(600)
        P5 = await room(pl, common)
        print('    F5 player upstairs, all levels: common', json.dumps(P5))
        check(up and P5['cut'] is None and P5['covered'] and P5['drawn'] <= P5['n'] - P5['culls'], 'F5: once he has seen the upper floor it covers the common room for him too: culled again', {'seen upstairs': up, 'cut': P5['cut'], 'covered': P5['covered'], 'drawn': P5['drawn'], 'of': P5['n']})

        real = [e for e in errors if 'WebSocket' not in e and 'ERR_CONNECTION_REFUSED' not in e and 'Failed to load resource' not in e]
        check(not real, 'no page errors', '; '.join(real[:5]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser fog covered: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
sys.exit(0 if ok else 1)
