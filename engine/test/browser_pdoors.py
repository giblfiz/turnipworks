#!/usr/bin/env python3
"""GENERATED DOORS FOR PLAYERS (2026-10-29): a player opens a door the rooms imply, on the map and in first person
(core/commands.js door.open: the relay works the door out and materialises it; core/roomgen.js doorPiece). Two seats:
the GM and a player (Mira). docs/UI.md "First person" ▸ Generated doors.

  TW_PORTS=a,b python3 engine/test/browser_pdoors.py --local [--stills DIR]
  ... --page https://dev.turnipworks.net/play/      (against dev: the suite makes its own throwaway campaign)

  PARITY  the relay's door (roomgen.doorPiece, run in the tab) is the piece the shell draws (wallItem), door by door,
          on the player's side and the GM's (a hidden building's door too)
  HIDDEN  a door only a hidden building owns: Mira's door.open is refused; nothing changes on the GM's side
  FOG     fog of war on: a door of a room Mira has never seen is refused (the same answer as a wall)
  TOUCH   the GM sets "Players may touch nothing": Mira's Open is refused, the door stays a generated door
  MAP     touch open again: Mira clicks a generated door on the map, Open on its ring: it opens (a thing of its own,
          in the shell piece's place) in her tab and the GM's; Close shuts it again (object.open)
  FPV     Mira in first person clicks the door in front of her: it opens on both seats; she steps through it
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
ap.add_argument('--keep', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18571,18572').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pdoors-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(400)
async def still(pg, name):
    if not A.stills: return
    os.makedirs(A.stills, exist_ok=True); await pg.wait_for_timeout(900); await pg.screenshot(path=os.path.join(A.stills, f'{name}.png'))
TOK = "((id) => { const e = tw.entities()[id]; return e ? { x: e.x, y: e.y || 0, z: e.z, rot: e.rot || 0 } : null; })"
# the thing a generated door became (fromEdge = its key), as a seat sees it; null while it is still generated
THING = "((k) => { const o = Object.values(tw.entities()).find(e => e.kind === 'object' && e.fromEdge === k); return o ? { id: o.id, open: !!o.open, cat: o.cat, sku: o.sku, url: o.url, x: o.x, y: o.y || 0, z: o.z, rot: o.rot || 0, hidden: !!o.hidden } : null; })"
GEN = "((k) => !!tw.worldOf(tw.area()).shell.get(k + ':door'))"  # the shell still draws the generated door
# a door's middle, 4 ft up, on screen
SCREEN = """(([x, y, z]) => { const v = new tw.THREE.Vector3(x, y, z).project(tw.main.camera), c = tw.gfx?.renderer?.domElement || document.querySelector('canvas'), r = c.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; })"""
# open (or shut) a generated door the way a click does, and wait for the relay's answer: true = acked, false = refused
TRY_OPEN = "(async (k) => { const it = tw.wallItem('wall:' + k); if (!tw.canOpen(it)) return 'not openable here'; const m = await tw.await(tw.toggleOpen(it)); return !!m; })"
PARITY = """((gmSide) => {
  const w = tw.worldOf(tw.area()), out = [];
  for (const e of w.edges.values()) {
    if (e.kind !== 'door' || e.open) continue;
    const it = tw.wallItem('wall:' + e.key), P = tw.roomgen.doorPiece(tw.entities(), e.key, { gmSide });
    const r2 = (v) => Math.round(v * 100) / 100, near = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
    const same = !!P && it.generated && it.cat === P.cat && it.sku === P.sku && it.url === P.url && r2(it.x) === P.x && r2(it.y) === P.y && r2(it.z) === P.z && Math.abs((it.rot || 0) - P.rot) < 1e-9 && near(it.dims, P.dims) && near(it.s, P.s) && it.room === P.room && it.name === P.name;
    out.push({ key: e.key, same, ...(same ? {} : { it: [it.cat, it.sku, it.x, it.z, it.rot, it.dims, it.s, it.room], P: P && [P.cat, P.sku, P.x, P.z, P.rot, P.dims, P.s, P.room] }) });
  }
  return out;
})"""

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
        if nm: await nm.fill(f"TEST pdoors {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.fpv', 90000), 'GM tab live')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        pl = await tab(link); check(await wait(pl, 'window.tw && tw.ready && tw.ready() && tw.fpv', 90000), 'Mira joined')
        PL = await pl.evaluate('tw.me()')

        # THE TABLE: a common room (x 0..30, z 0..20) and a kitchen east of it (x 30..50) through a door (DK); a second
        # building to the south (z 50..70) the GM hides; Mira's pawn in the common room, facing the door from 27.5
        G = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 6)"); await idle(gm)
        K = await gm.evaluate("tw.spawnRoom('kitchen', 6, 0, 4, 4, 5102)"); await idle(gm)
        H1 = await gm.evaluate("tw.spawnRoom('common', 0, 10, 4, 4, 31)"); await idle(gm)
        H2 = await gm.evaluate("tw.spawnRoom('kitchen', 4, 10, 4, 4, 32)"); await idle(gm)
        await gm.evaluate("tw.condButtons?.hide?.('stair-offer')")
        DOORS = await gm.evaluate("[...tw.worldOf(tw.area()).edges.values()].filter(e => e.kind === 'door').map(e => ({ key: e.key, room: e.owner.room, sides: e.sides.map(s => s.room), gx: e.gx, gz: e.gz, dir: e.dir, span: e.span || 1 }))")
        DK = next((d['key'] for d in DOORS if d['dir'] == 'v' and d['gx'] == 6 and sorted(d['sides']) == sorted([G, K])), None)
        MAPD = next((d['key'] for d in DOORS if d['room'] == G and d['key'] != DK and len(d['sides']) == 1), None)
        FOGD = next((d['key'] for d in DOORS if d['room'] == K and d['key'] != DK and len(d['sides']) == 1), None)
        HIDD = next((d['key'] for d in DOORS if sorted(d['sides']) == sorted([H1, H2])), None)
        check(DK and MAPD and FOGD and HIDD, 'the rooms imply the doors the suite needs (between the rooms, the common room\'s outside door, the kitchen\'s, the south building\'s inner door)', {'DK': DK, 'MAPD': MAPD, 'FOGD': FOGD, 'HIDD': HIDD, 'all': [d['key'] for d in DOORS]})
        if not (DK and MAPD and FOGD and HIDD):
            print(json.dumps(DOORS)); await browser.close(); sys.exit(1)
        DZ = await gm.evaluate(f"tw.worldOf(tw.area()).edges.get('{DK}').gz * 5 + 2.5")
        await gm.evaluate(f"tw.entities()['{H1}'].building && tw.flag([tw.entities()['{H1}'].building], {{ hidden: true }})"); await idle(gm)
        MI = 'tok_pdoormira'
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{MI}', name: 'Mira', x: 27.5, z: {DZ}, rot: Math.PI / 2, owner: '{PL}', fig: 'hero-fighter-elf-f' }})"); await idle(gm)
        await gm.evaluate("tw.registry.run('area.fogOfWar.on')"); await idle(gm)
        await view(gm, 25, 10, 90, 58); await settle(gm)
        await wait(pl, f"!!tw.worldOf(tw.area())?.recs.get('{MI}')", 30000, 'Mira sees her pawn'); await settle(pl)
        await view(pl, 25, 10, 70, 58); await pl.wait_for_timeout(2500)  # (the fog worker sees the room from her pawn)

        # ================= PARITY =================
        print('PARITY: the relay\'s door is the piece the shell draws')
        pp = await pl.evaluate(PARITY + "(false)"); gp = await gm.evaluate(PARITY + "(true)")
        check(len(pp) >= 3 and all(r['same'] for r in pp), f"Mira's side: {len(pp)} generated doors, each the same piece, place, turn, size and scale", [r for r in pp if not r['same']] or [r['key'] for r in pp])
        check(len(gp) >= 4 and all(r['same'] for r in gp) and any(r['key'] == HIDD for r in gp), f"the GM's side, the hidden building's door too: {len(gp)} doors", [r for r in gp if not r['same']] or [r['key'] for r in gp])
        check(not any(r['key'] == HIDD for r in pp), 'Mira has no door of the hidden building')

        # ================= HIDDEN =================
        print('HIDDEN: a door only the hidden building owns')
        res = await pl.evaluate(f"(async () => !!(await tw.await(tw.sync.submit('door.open', {{ key: '{HIDD}', open: true }}, tw.area()))))()")
        await idle(gm)
        check(res is False and await gm.evaluate(THING + f"('{HIDD}')") is None and await gm.evaluate(GEN + f"('{HIDD}')"), "Mira's door.open on it is refused; the GM's side still has the generated door", res)

        # ================= FOG =================
        print('FOG: the kitchen, which Mira has never seen')
        known = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), P = tw.roomgen.doorPiece(tw.entities(), '{FOGD}', {{ gmSide: false }}); return w.fogKnown ? w.fogKnown(P.x, P.z, 0) : null; }})()")
        res = await pl.evaluate(TRY_OPEN + f"('{FOGD}')"); await idle(gm)
        check(known is False and res is False and await gm.evaluate(THING + f"('{FOGD}')") is None, "the kitchen's outside door (never seen): Mira's open is refused, nothing changes", {'known': known, 'res': res})

        # ================= TOUCH =================
        print('TOUCH: players may touch nothing')
        await gm.evaluate("tw.registry.run('area.touch')"); await idle(gm); await idle(pl)
        rule = await pl.evaluate("tw.areaRule('touch')")
        res = await pl.evaluate(TRY_OPEN + f"('{MAPD}')"); await idle(gm)
        toast = await pl.evaluate("document.querySelector('#toast')?.textContent || ''")
        check(rule == 'none' and res is not True and await gm.evaluate(THING + f"('{MAPD}')") is None and await gm.evaluate(GEN + f"('{MAPD}')"), 'touch none: Mira cannot open a generated door; it stays generated', {'rule': rule, 'res': res, 'toast': toast})
        await gm.evaluate("tw.registry.run('area.touch')"); await idle(gm); await idle(pl)
        check(await pl.evaluate("tw.areaRule('touch')") != 'none', 'the GM lets players touch things again')

        # ================= MAP =================
        print('MAP: Mira clicks the common room\'s outside door and Open on its ring')
        P = await pl.evaluate(f"tw.roomgen.doorPiece(tw.entities(), '{MAPD}', {{ gmSide: false }})")
        yaw = 0 if MAPD.startswith('h') else 90
        await view(pl, P['x'], P['z'], 70, 60, yaw); await pl.wait_for_timeout(800)
        sx, sy = await pl.evaluate(SCREEN + f"([{P['x']}, 4, {P['z']}])")
        await pl.mouse.click(sx, sy); await pl.wait_for_timeout(700)
        sel = await pl.evaluate("[...tw.sel]")
        if sel != [f'wall:{MAPD}']:
            print(f'    (the click selected {sel}: selecting the door by hand)'); await pl.evaluate(f"tw.select('wall:{MAPD}')"); await pl.wait_for_timeout(600)
        check(sel == [f'wall:{MAPD}'], 'a click on the generated door selects it', sel)
        btn = pl.locator('#ring .rbtn[data-cmd="thing.open"]')
        check(await btn.count() == 1, 'its ring offers Open to the player', await pl.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || b.dataset.menu)"))
        await still(pl, 'map-before')
        if await btn.count(): await btn.first.evaluate('b => b.click()')
        await idle(pl); await idle(gm); await gm.wait_for_timeout(500)
        tp, tg = await pl.evaluate(THING + f"('{MAPD}')"), await gm.evaluate(THING + f"('{MAPD}')")
        check(tp and tp['open'] and tp['cat'] == P['cat'] and tp['sku'] == P['sku'] and tp['x'] == P['x'] and tp['z'] == P['z'], 'Open: in Mira\'s tab the door is a thing of its own, open, in the shell piece\'s place', tp)
        check(tg and tg['open'] and tg['id'] == (tp or {}).get('id') and not tg['hidden'], 'the GM\'s tab (the second seat) sees it open too', tg)
        gone = not await gm.evaluate(GEN + f"('{MAPD}')") and not await pl.evaluate(GEN + f"('{MAPD}')")
        drawn = await gm.evaluate(f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{(tg or {}).get('id')}'); return !!r && !!r.group.parent; }})()")
        check(gone and drawn, 'the shell no longer draws the generated door; the thing is drawn instead (both tabs)', {'gone': gone, 'drawn': drawn})
        check(await pl.evaluate("[...tw.sel]") == [(tp or {}).get('id')], 'the selection follows it to the new thing', await pl.evaluate("[...tw.sel]"))
        await still(pl, 'map-open'); await still(gm, 'map-open-gm')
        if await btn.count(): await btn.first.evaluate('b => b.click()')
        await idle(pl); await idle(gm); await gm.wait_for_timeout(400)
        check((await gm.evaluate(THING + f"('{MAPD}')") or {}).get('open') is False, 'Close (the same button) shuts it, on the GM\'s side too (object.open)')

        # ================= FPV =================
        print('FPV: Mira in first person clicks the door in front of her')
        await pl.evaluate("tw.clearSelection()")
        await pl.evaluate(f"tw.fpv.enter('{MI}')"); await pl.wait_for_timeout(900); await pl.evaluate("tw.fpv.setLook(90, -5)"); await pl.wait_for_timeout(700)
        check(await pl.evaluate("tw.fpv.pawnId()") == MI, 'Mira looks through her pawn')
        await still(pl, 'fpv-shut')
        res = await pl.evaluate("tw.fpv.click(700, 450)"); await idle(pl); await idle(gm); await gm.wait_for_timeout(500)
        tp, tg = await pl.evaluate(THING + f"('{DK}')"), await gm.evaluate(THING + f"('{DK}')")
        check(res == 'open' and tp and tp['open'], 'a click on the door in the view opens it (the player herself)', {'click': res, 'thing': tp, 'log': await pl.evaluate("tw.fpvLog?.slice(-2)")})
        check(tg and tg['open'], 'the GM\'s tab sees it open', tg)
        await still(pl, 'fpv-open')
        await pl.keyboard.press('w'); await pl.wait_for_timeout(800); await idle(pl)
        t = await pl.evaluate(TOK + f"('{MI}')")
        check(t and abs(t['x'] - 32.5) < 0.05, 'W steps through the open door into the kitchen', t)
        await pl.keyboard.press('s'); await pl.wait_for_timeout(800); await idle(pl)
        await pl.evaluate("tw.fpv.setLook(90, -5)"); await pl.wait_for_timeout(500)
        res = await pl.evaluate("tw.fpv.click(700, 450)"); await idle(pl); await idle(gm); await gm.wait_for_timeout(400)
        check(res == 'open' and (await gm.evaluate(THING + f"('{DK}')") or {}).get('open') is False, 'a second click shuts it (now a thing: object.open)', res)
        await pl.evaluate("tw.fpv.exit()")

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        n = sum(1 for r in results if r[0])
        print(f'browser pdoors: {n}/{len(results)} passed', flush=True)
        if A.keep: await asyncio.sleep(3600)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
