#!/usr/bin/env python3
"""Movement rings (Harry 2026-11-02; docs/UI.md "Movement rings"; client/surfaces/moverings.js, core/walk.js).

  local:  TW_GPU=1 python3 engine/test/browser_moverings.py --local [--shots] [--only GM,FOG,PERF]

Three rooms in a row (1: x 0..20, 2: x 20..40 and deeper, 3: x 40..60 set back), fog of war on, two players.
  GM     a click shows no rings; dragging a monster: rings from where it stood, the GM's walls (fog is not the GM's),
         through the open door and not through the shut one; they stay put while the pawn moves, go on the drop; the
         dragged line bends through the doorway and reads the walk; a door shut mid-session is picked up by the next drag
  FOG    THE FOG RULE. Mira has walked rooms 2 and 3; Kit has only ever stood in room 1. Kit's ring holds only cells Kit
         has explored (it stops at his fog's edge), it passes the open door into what he saw through it, and the GM
         opening a door neither can see changes NOTHING in Kit's field while Mira's grows into room 3. Walls in ground
         Kit has not explored, taken away, leave his field exactly as it is. A drag into his unexplored ground keeps the
         straight line. A GM dragging a monster through ground Kit has not seen: no ring, no line, no new key on his page
  PERF   (its own campaign: a town of about 50 rooms) the cost when a drag starts and the frame time while dragging,
         rings off and on, A B A B in one page
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
SHOTS = os.path.join(HERE, 'shots', 'moverings')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--only')
ap.add_argument('--rooms', type=int, default=50, help='PERF: the town size')
A = ap.parse_args()
ONLY = set((A.only or '').upper().split(',')) - {''}
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
def want(sec): return not ONLY or sec in ONLY

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18487,18987').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-moverings-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
RX = """(() => { window.__rx = [];
  const WS = window.WebSocket; window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (ev) => { try { window.__rx.push(String(ev.data)); } catch { } }); } }; })()"""
SCR = lambda x, z, y=0: f"(() => {{ const p = tw.screenOf({x}, {z}, tw.main, {y}); return [p.x, p.y]; }})()"
MR = "tw.moveRings.state()"
ITEM = "(tw.rulers.state().items.find(i => i.key === 'move') || null)"
CELLS = "JSON.stringify(tw.moveRings.cells())"

def diff_px(a, b, t=6):
    import io
    from PIL import Image, ImageChops
    d = ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'), Image.open(io.BytesIO(b)).convert('RGB')).convert('L')
    return sum(d.point(lambda v: 255 if v > t else 0).histogram()[255:])

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, dpr=1):
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=dpr); await ctx.add_init_script(RX)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' and ('Shader' in m.text or 'WebGLProgram' in m.text) else None); await pg.goto(url); return pg
        async def action(pg, code):
            await pg.evaluate(code); await wait(pg, 'tw.sync.pendingCount() === 0', 15000, 'command accepted'); await pg.wait_for_timeout(250)
        async def at(pg, x, z, y=0): return await pg.evaluate(SCR(x, z, y))
        async def shot(pg, name):
            if A.shots: await pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
        async def grab(pg, x, z, tx, tz, steps=8):  # press on the pawn at (x, z) and drag it towards (tx, tz); stays held
            x0, y0 = await at(pg, x, z); x1, y1 = await at(pg, tx, tz)
            await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x0 + 6, y0 + 3, steps=2)
            await pg.mouse.move(x1, y1, steps=steps); await pg.wait_for_timeout(350)
        async def drop(pg, back=None):  # let go (back: over the start, so the pawn stays where it was)
            if back: bx, by = await at(pg, *back); await pg.mouse.move(bx, by, steps=4)
            await pg.mouse.up(); await pg.wait_for_timeout(300)

        if want('GM') or want('FOG'):
            gm = await tab(page)
            await gm.fill('#newCampaign input[name=gm]', 'Harry')
            await gm.fill('#newCampaign input[name=name]', f"TEST moverings {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await gm.click('#newCampaign button')
            check(await wait(gm, 'window.tw?.ready?.() && tw.fog && tw.moveRings', 90000), 'GM live, with movement rings')
            check(await gm.evaluate('tw.sync.campaign.defaults.fogOfWar === true'), 'a new campaign has fog of war on')
            pages = [gm]; seats = []
            for name in ['Mira', 'Kit']:
                invite = await gm.evaluate("async name => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name,color:'#67aadd'}))", name)
                pg = await tab(invite); pages.append(pg)
                check(await wait(pg, 'window.tw?.ready?.() && tw.fog && tw.moveRings', 90000), name + ' joins')
                seats.append(await pg.evaluate('tw.me()'))
            mi, kit = pages[1:]
            for x, z, w, d, seed in [(0, 0, 4, 4, 7301), (4, 0, 4, 6, 7302), (8, 2, 4, 4, 7303)]:
                await gm.evaluate('(a) => tw.spawnRoom("common", ...a)', [x, z, w, d, seed])
                await wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000, 'room built')
            # every outside edge a plain wall (no windows, no outside doors): the rooms join only by their two inner doors
            await action(gm, "tw.batch([...tw.worldOf(tw.area()).edges.values()].filter(e => e.sides.length === 1).map(e => ({type:'edge.set',args:{key:e.key,as:'wall',piece:'wall-straight'}})))")
            doors = await gm.evaluate("""(() => { const out = {}; for (const e of tw.worldOf(tw.area()).edges.values()) if (e.kind === 'door' && e.sides.length === 2 && !e.spanOf) { const gx = e.gx; out[gx === 4 ? 'a' : gx === 8 ? 'b' : 'x' + e.key] = { key: e.key, z0: e.gz * 5, z1: (e.gz + (e.span || 1)) * 5 }; } return out; })()""")
            check('a' in doors and 'b' in doors, 'two inner doors: rooms 1 and 2, rooms 2 and 3', doors)
            DA, DB = doors['a'], doors['b']
            OPEN = "(k) => tw.await(tw.toggleOpen(tw.wallItem('wall:' + k)))"
            await gm.evaluate(OPEN, DA['key']); await wait(gm, f"Object.values(tw.entities()).some(e => e.fromEdge === '{DA['key']}' && e.open) && tw.sync.pendingCount() === 0", 15000, 'door a open')
            DOOR_A = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.fromEdge === '{DA['key']}')?.id")
            MP, KP, NPC, NPC2 = 'tok_mrmira0001', 'tok_mrkit00001', 'tok_mrgobl0001', 'tok_mrogre0001'
            # WHO SEES WHAT, worked out here from the plan: room 2 (x 20..40, z 0..30) is a plain box, so from a spot in room 1
            # the only sight into it is through door a's gap; a ray through the gap lands on x = X at z = band(X)
            def band(px, pz, X):
                zs = [pz + (zg - pz) * (X - px) / (20 - px) for zg in (DA['z0'], DA['z1'])]
                return max(0, min(zs)), min(30, max(zs))
            def sees(px, pz, X, z0, z1, pad=2.5): lo, hi = band(px, pz, X); return lo <= z1 + pad and hi >= z0 - pad
            spots = [(2.5 + 5 * i, 2.5 + 5 * j) for i in range(4) for j in range(4)]
            calm = [q for q in spots if not sees(*q, 40, DB['z0'], DB['z1'])]   # door b out of sight from there
            KX, KZ = max(calm, key=lambda q: q[0])          # Kit: as near door a as door b allows (his ring then reaches through it)
            MX, MZ = next(q for q in calm if q != (KX, KZ) and abs(q[0] - KX) + abs(q[1] - KZ) >= 5)
            hide = [(x, z) for x in (25, 27.5, 30, 32.5, 35) for z in (5, 10, 15, 20, 25) if not sees(KX, KZ, x, z, z, 4) and not sees(MX, MZ, x, z, z, 4)]
            OX, OZ = hide[len(hide) // 2] if hide else (35, 5)
            print(f'    door a {DA}, door b {DB}; Kit at {(KX, KZ)}, Mira at {(MX, MZ)}, the ogre at {(OX, OZ)}', flush=True)
            await action(gm, 'tw.batch(' + json.dumps([
                {'type': 'token.create', 'args': {'id': MP, 'name': 'Mira scout', 'x': 50, 'z': 20, 'owner': seats[0]}},   # first in room 3
                {'type': 'token.create', 'args': {'id': KP, 'name': 'Kit scout', 'x': KX, 'z': KZ, 'owner': seats[1]}},
                {'type': 'token.create', 'args': {'id': NPC, 'name': 'Goblin', 'x': 7.5, 'z': 2.5}},
                {'type': 'token.create', 'args': {'id': NPC2, 'name': 'Ogre', 'x': OX, 'z': OZ}}]) + ')')
            VIEW = "(() => { const g = tw.main.grab; g.focus.set(28, 0, 14); g.yaw = 0; g.pitch = 64; g.dist = 92; g.update(); tw.main.rule = 'free'; tw.settings.setGfx('medium'); })()"
            for pg in pages: await wait(pg, f"!!tw.entities()['{NPC2}']", 30000); await pg.evaluate(VIEW)
            # Mira walks: room 3, then room 2, then room 1 (each place seen before the next)
            SEEN = lambda x, z: f"tw.fog.visible({x},{z},0)"
            check(await wait(mi, SEEN(50, 20), 20000), 'Mira sees room 3 from inside it')
            await action(gm, f"tw.dispatch('token.move',{{id:'{MP}',x:30,z:20}})"); check(await wait(mi, SEEN(30, 25), 20000), 'Mira sees room 2')
            await action(gm, f"tw.dispatch('token.move',{{id:'{MP}',x:{MX},z:{MZ}}})"); await wait(mi, SEEN(MX, MZ), 20000)
            await mi.evaluate('tw.fog.sendNow()'); await mi.wait_for_timeout(600)
            check(await mi.evaluate("tw.fog.explored(50,20,0) && tw.fog.explored(30,25,0) && !tw.fog.visible(30,25,0)"), 'Mira remembers rooms 2 and 3 (explored, not in sight now)')
            check(await kit.evaluate(f"!tw.fog.explored({OX},{OZ},0) && !tw.fog.explored(50,20,0) && tw.fog.explored(10,10,0)"), 'Kit has explored only room 1 (and what the doorway shows)')
            await gm.wait_for_timeout(400)

        # ================= GM =================
        if want('GM'):
            print('GM')
            check(await wait(gm, f"{MR}.warm === 2 && {MR}.program", 10000, 'compiled'), 'the ring material is compiled while the table loads, before any drag', await gm.evaluate(MR))
            for y in (0, 1.5, 3):  # (the base, then the figure: whichever the click lands on selects it)
                nx, ny = await at(gm, 7.5, 2.5, y); await gm.mouse.click(nx, ny); await gm.wait_for_timeout(350)
                if await gm.evaluate("tw.selected().some(e => e.kind === 'token')"): break
            sel = await gm.evaluate(f"({{ sel: tw.selected().filter(e => e.kind === 'token').map(e => e.id), shown: {MR}.shown, drag: !!tw.moveDrag, drags: {MR}.stats.drags }})")
            check(sel['sel'] and not sel['shown'] and not sel['drag'] and sel['drags'] == 0, 'a click (select) shows no rings', sel)
            await gm.evaluate('tw.clearSelection()')
            zs = min(DA['z1'] + 5, 17.5); zt = min(DA['z1'] + 9, 27.5)
            await gm.evaluate(f"tw.dispatch('token.move',{{id:'{NPC}',x:7.5,z:{zs}}})"); await wait(gm, f"tw.entities()['{NPC}'].z === {zs}", 5000)
            await grab(gm, 7.5, zs, 27.5, zt)
            st = await gm.evaluate(MR)
            check(st['shown'] and st['lead'] == NPC and abs(st['origin'][0] - 7.5) < 1e-6 and abs(st['origin'][1] - zs) < 1e-6, 'dragging a monster: rings, from where it stood', st)
            check(st['fog'] is False, 'the GM walks on every wall the GM has (fog of war is not the GM\'s)')
            d_room2 = await gm.evaluate("tw.moveRings.distanceAt(27.5, 7.5)"); d_room3 = await gm.evaluate("tw.moveRings.distanceAt(45, 20)")
            check(d_room2 < 40 and d_room3 >= 1e4, 'through the open door into room 2; not through the shut door into room 3', [d_room2, d_room3])
            it = await gm.evaluate(ITEM)
            md = await gm.evaluate("tw.moveDrag.pawns"); straight = (md['dx'] ** 2 + md['dz'] ** 2) ** 0.5
            ft = float(it['text'].split(' ')[0]) if it else 0
            check(it and it.get('path') and len(it['path']) > 2 and ft > straight + 1, 'the dragged line bends through the doorway and reads the walk, not the straight line', {'text': it and it['text'], 'straight': round(straight, 1), 'path': it and it.get('path')})
            jamb = it and it.get('path') and any(abs(px - 20) < 2.5 and DA['z0'] - 1.5 <= pz <= DA['z1'] + 1.5 for px, pz in it['path'][1:-1])
            check(jamb, 'its bend is at the doorway', it and it.get('path'))
            # drawn, for real: the same instant with the rings off and on (the route off in both, so only the rings differ)
            await gm.evaluate("tw.moveRings.set('route', false); tw.moveRings.set('on', false)"); await gm.wait_for_timeout(300); off_ = await gm.screenshot()
            await gm.evaluate("tw.moveRings.set('on', true)"); await gm.wait_for_timeout(400); on_ = await gm.screenshot()
            await gm.evaluate("tw.moveRings.set('route', true)"); await gm.wait_for_timeout(200)
            npx = diff_px(off_, on_)
            check(npx > 1500, 'the rings are on the screen (pixels that change when they are switched on)', npx)
            await shot(gm, 'gm-drag')
            drags = (await gm.evaluate(MR))['stats']['drags']
            x2, y2 = await at(gm, 12.5, 2.5); await gm.mouse.move(x2, y2, steps=5); await gm.wait_for_timeout(250)
            st2 = await gm.evaluate(MR); it2 = await gm.evaluate(ITEM)
            check(st2['shown'] and st2['origin'] == st['origin'] and st2['stats']['drags'] == drags, 'the rings stay where the drag began while the pawn moves (worked out once a drag)', st2['stats'])
            check(it2 and not it2.get('path'), 'where the straight line is the walk, the line is straight as before', it2)
            check(st['stats']['last']['totalMs'] < 60, 'the drag\'s field cost', st['stats']['last'])
            await drop(gm, back=(7.5, zs))
            fo = await gm.evaluate(f"({{ shown: {MR}.shown, leaving: {MR}.leaving, opacity: {MR}.opacity, route: tw.moveRings.route(27.5, 7.5) }})")
            check(fo['shown'] and fo['leaving'] and 0 < fo['opacity'] < 1 and fo['route'] is None, 'let go: the rings fade out where they were (Harry 2026-11-03), and offer no route', fo)
            await gm.wait_for_timeout(1000)
            check(await gm.evaluate(f"!{MR}.shown && !tw.worldOf(tw.area()).layers.deco.children.some(o => o.userData.moveRings && o.visible)"), 'a second after the drop: the rings are gone')
            # a door shut mid-session is picked up by the next drag
            await action(gm, f"tw.toggleOpen(tw.entities()['{DOOR_A}'])"); await wait(gm, f"!tw.entities()['{DOOR_A}'].open", 5000)
            await grab(gm, 7.5, zs, 27.5, zt); shut = await gm.evaluate("tw.moveRings.distanceAt(27.5, 7.5)"); it3 = await gm.evaluate(ITEM); await drop(gm, back=(7.5, zs))
            await action(gm, f"tw.toggleOpen(tw.entities()['{DOOR_A}'])"); await wait(gm, f"tw.entities()['{DOOR_A}'].open", 5000)
            await grab(gm, 7.5, zs, 27.5, zt); again = await gm.evaluate("tw.moveRings.distanceAt(27.5, 7.5)"); await drop(gm, back=(7.5, zs))
            check(shut >= 1e4 and again < 40 and it3 and not it3.get('path'), 'the door shut: the next drag stops at it (and the line is straight again); opened: through it again', [shut, again])
            # NO WALK, IN RED (Harry 2026-11-03: "I would love it if it also turned red when that happens"); every frame is
            # recorded, so a red flash at the start, at the drop or in the fade out would show
            REC = """(() => { window.__red = []; window.__upAt = null; addEventListener('pointerup', () => { window.__upAt ??= performance.now(); }, { capture: true, once: true });
              window.__redOff = tw.on((w) => { if (w !== 'frame') return; const i = tw.rulers.state().items.find(i => i.key === 'move'); window.__red.push([performance.now(), i ? (i.noRoute ? 'red' : 'ok') : '-']); }); })()"""
            RED_STOP = "(() => { window.__redOff?.(); return { up: window.__upAt, frames: window.__red }; })()"
            RED = "(() => ({ red: tw.moveRings.LOOK.noRoute, mine: tw.myColor(), lab: document.querySelector('#rulers .rlab.move')?.style.getPropertyValue('--c') || null }))()"
            col = await gm.evaluate(RED)
            await gm.evaluate(REC); await grab(gm, 7.5, zs, 27.5, zt); okit = await gm.evaluate(ITEM); await drop(gm, back=(27.5, zt)); await gm.wait_for_timeout(1200)
            rec = await gm.evaluate(RED_STOP)
            lines = [f[1] for f in rec['frames'] if f[1] != '-' and (not rec['up'] or f[0] <= rec['up'])]; after = [f[1] for f in rec['frames'] if rec['up'] and f[0] > rec['up'] + 1]
            # (on its way the pointer may pass over ground no walk reaches, a wall's far side: red there is right; the drag's first
            # frames, its end and every frame after the drop are what must never flash)
            check(okit and not okit.get('noRoute') and okit['color'] == col['mine'] and lines and 'red' not in lines[:3] and lines[-1] == 'ok' and 'red' not in after and 'ok' not in after, 'a spot the walk reaches: the line keeps its colour; no red as the drag starts, at its end, or after the drop through the fade', {'item': okit and okit['color'], 'first': lines[:3], 'last': lines[-1:], 'after': sorted(set(after))})
            await gm.evaluate(f"tw.dispatch('token.move',{{id:'{NPC}',x:7.5,z:{zs}}})"); await wait(gm, f"tw.entities()['{NPC}'].x === 7.5", 5000); await gm.wait_for_timeout(300)
            await grab(gm, 7.5, zs, 50, 20)  # room 3: door b is shut
            rit = await gm.evaluate(ITEM); rcol = await gm.evaluate(RED)
            check(rit and rit.get('noRoute') and rit['color'] == col['red'] and not rit.get('path') and rcol['lab'] == col['red'], 'into a walled-off room: the straight line and its number, in red', {'item': rit, 'label': rcol['lab']})
            await shot(gm, 'gm-red')
            if A.shots and os.environ.get('MR_PROBE'):  # candidate reds on one frozen instant
                await gm.evaluate('tw.freezeTime(true)')
                for tag, c in (('a', '#ff4b3a'), ('b', '#ff2d55'), ('c', '#ff1a1a'), ('d', '#ff6f6f'), ('e', '#ff3df0')):
                    await gm.evaluate(f"tw.moveRings.set('noRoute', '{c}')"); await gm.wait_for_timeout(250); await shot(gm, f'red-{tag}')
                await gm.evaluate(f"tw.moveRings.set('noRoute', '{col['red']}'); tw.freezeTime(false)")
            await gm.evaluate(REC); await drop(gm, back=(7.5, zs)); await gm.wait_for_timeout(1200); rec = await gm.evaluate(RED_STOP)
            after = [f[1] for f in rec['frames'] if rec['up'] and f[0] > rec['up'] + 1]
            check(rec['up'] and after and 'red' not in after and 'ok' not in after, 'let go: no red (and no line) in any frame after the drop, through the fade', {'after': len(after), 'kinds': sorted(set(after))})
            reach0 = await gm.evaluate("tw.moveRings.LOOK.reach"); await gm.evaluate("tw.moveRings.set('reach', 20)")
            await grab(gm, 7.5, zs, 27.5, zt); far = await gm.evaluate(ITEM); await drop(gm, back=(7.5, zs)); await gm.evaluate(f"tw.moveRings.set('reach', {reach0})"); await gm.wait_for_timeout(1100)
            check(far and far.get('noRoute') and far['color'] == col['red'], 'further than the last ring (20 ft here, the walk is about 24): red too', far)
            # THE NAME (Harry 2026-11-03: "I think 'movement rings' would be better"): the bar lists "Movement rings tuner";
            # the old "move rings tuner" still finds it, and is never what is shown
            BAR = """async (qs) => { tw.emit('bar.open'); const input = document.querySelector('#bar textarea'), out = {};
              for (const q of qs) { input.value = q; input.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 30)); out[q] = [...document.querySelectorAll('#results .res')].slice(0, 3).map(el => ({ ref: el.dataset.ref || '', t: el.querySelector('.t')?.textContent || '' })); }
              input.value = ''; input.dispatchEvent(new Event('input')); document.activeElement?.blur(); tw.registry.surfaces.find(s => s.name === 'bar')?.close(); return out; }"""
            bar = await gm.evaluate(BAR, ['movement rings tuner', 'move rings tuner'])
            hit = {q: next((r for r in rows if 'moveRingsTuner' in r['ref']), None) for q, rows in bar.items()}
            check(all(hit.values()) and all(h['t'].startswith('Movement rings tuner') for h in hit.values()), 'the bar: "movement rings tuner" finds the tuner, the old "move rings tuner" too, and both show the new name', hit)
            shown = await gm.evaluate("[...document.querySelectorAll('#moverings-panel, #results, #keys, .help, [data-help]')].map(e => e.textContent).join(' ') + ' ' + JSON.stringify(tw.registry.all().filter(c => c.id === 'view.moveRingsTuner').map(c => [typeof c.title === 'function' ? c.title() : c.title, c.short, c.hint || '']))")
            check('move rings' not in shown.lower(), 'nowhere shown says "move rings" (the title, the short name, the hint)', shown[:200])
            # THE TUNER: sliders over the look, live; Hold keeps the last drag's rings up
            await gm.evaluate("tw.registry.run('view.moveRingsTuner')"); await gm.wait_for_timeout(300)
            check(await gm.evaluate("document.querySelector('#moverings-panel .lk-head b')?.textContent === 'Movement rings' && !document.querySelector('#moverings-panel').textContent.toLowerCase().includes('move rings')"), 'the tuner is titled "Movement rings", and says nothing else')
            tn = await gm.evaluate("""(() => { const d = document.querySelector('#moverings-panel'), r = d && d.querySelector('input[data-path="boldAlpha"]'); if (!r) return null; r.value = '0.8'; r.dispatchEvent(new Event('input', { bubbles: true })); const h = d.querySelector('input[data-path="hold"]'); h.checked = true; h.dispatchEvent(new Event('input', { bubbles: true })); return { sliders: d.querySelectorAll('input[type=range]').length, bold: tw.moveRings.LOOK.boldAlpha, uniform: tw.moveRings.material.uniforms.uAlpha.value.y, hold: tw.moveRings.LOOK.hold }; })()""")
            check(tn and tn['sliders'] >= 12 and tn['bold'] == 0.8 and abs(tn['uniform'] - 0.8) < 1e-6 and tn['hold'], 'the tuner: its sliders change the rings live', tn)
            await grab(gm, 7.5, zs, 27.5, zt); await drop(gm, back=(7.5, zs))
            held = await gm.evaluate(f"{MR}.shown")
            await gm.evaluate("""(() => { const d = document.querySelector('#moverings-panel'); const h = d.querySelector('input[data-path="hold"]'); h.checked = false; h.dispatchEvent(new Event('input', { bubbles: true })); d.querySelector('[data-role="revert"]').click(); })()"""); await gm.wait_for_timeout(250)
            await gm.wait_for_timeout(1100)  # (unticked: they fade out over a second)
            check(held and not await gm.evaluate(f"{MR}.shown") and await gm.evaluate("tw.moveRings.LOOK.boldAlpha") != 0.8, 'Hold keeps the rings after letting go; unticked they go; Revert puts the look back')
            await gm.evaluate("document.querySelector('#moverings-panel [data-role=collapse]').click()")

        # ================= LOOK (stills for a blind read: the same held drag, the look's variants) =================
        if want('LOOK') and A.shots and (want('GM') or want('FOG')):
            print('LOOK')
            zs = min(DA['z1'] + 5, 17.5)
            await gm.evaluate(f"tw.dispatch('token.move',{{id:'{NPC}',x:7.5,z:{zs}}})"); await wait(gm, f"tw.entities()['{NPC}'].z === {zs}", 5000)
            # every variant at the same instant of the same drag; 'none' keeps the field (so the bent line is the same) with nothing drawn
            V = {'none': {'thinAlpha': 0, 'boldAlpha': 0, 'lastAlpha': 0, 'casingAlpha': 0},
                 'default': {},                                               # (Gemini's pick of five, 2026-11-02)
                 'plain': {'casingAlpha': 0},
                 'faint': {'casingAlpha': 0.5, 'casingPx': 1, 'thinAlpha': 0.34, 'boldAlpha': 0.55, 'lastAlpha': 0.22},
                 'strong': {'casingAlpha': 0.5, 'casingPx': 1, 'thinAlpha': 0.5, 'boldAlpha': 0.75, 'lastAlpha': 0.32}}
            if os.environ.get('MR_PROBE'): V.update({'thin-only': {'boldAlpha': 0, 'lastAlpha': 0}, 'bold-only': {'thinAlpha': 0, 'lastAlpha': 0}, 'last-only': {'thinAlpha': 0, 'boldAlpha': 0}})
            base = await gm.evaluate("JSON.stringify(tw.moveRings.LOOK)")
            for name, fx, fz, dist in (('far', 20, 14, 92), ('near', 14, 12, 50)):
                await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({fx}, 0, {fz}); g.yaw = 0; g.pitch = 64; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()"); await gm.wait_for_timeout(900)
                await grab(gm, 7.5, zs, 27.5, min(DA['z1'] + 9, 27.5)); await gm.evaluate('tw.freezeTime(true)')  # (one frozen instant: flames and dust hold still, so only the rings differ)
                V2 = {**V, 'none2': V['none']} if os.environ.get('MR_PROBE') else V
                for tag, vals in V2.items():
                    await gm.evaluate("(b) => { const L = JSON.parse(b); for (const k in L) tw.moveRings.set(k, L[k]); }", base)
                    for k, v in vals.items(): await gm.evaluate(f"tw.moveRings.set('{k}', {json.dumps(v)})")
                    await gm.mouse.move(*(await at(gm, 27.5, min(DA['z1'] + 9, 27.5)))); await gm.wait_for_timeout(300); await shot(gm, f'look-{name}-{tag}')
                await gm.evaluate("(b) => { const L = JSON.parse(b); for (const k in L) tw.moveRings.set(k, L[k]); }", base); await gm.evaluate('tw.freezeTime(false)')
                await drop(gm, back=(7.5, zs))
            await gm.evaluate(VIEW); await gm.evaluate(f"tw.dispatch('token.move',{{id:'{NPC}',x:7.5,z:2.5}})")

        # ================= FOG =================
        if want('FOG'):
            print('FOG')
            # the rooms are laid out for a 40-ft reach (room 3 is past 40 ft through door b); Harry's look reaches 30
            for pg in (mi, kit): await pg.evaluate("tw.moveRings.set('reach', 40)")
            EXPLORED_ALL = "(() => { const s = tw.moveRings.state(), c = tw.moveRings.cells(); return { n: c.length, bad: c.filter(([x, z]) => !tw.fog.explored(x, z, s.level)).length, past: c.filter(([x]) => x > 20).length, deep: c.filter(([x, z]) => x > 21 && z > 12.5).length, room3: c.filter(([x]) => x > 40).length }; })()"
            await grab(kit, KX, KZ, 10, 10)
            ks = await kit.evaluate(MR); kc = await kit.evaluate(EXPLORED_ALL); kitCells1 = await kit.evaluate(CELLS)
            check(ks['shown'] and ks['fog'] is True, 'Kit drags his pawn: rings, worked out under fog of war', ks)
            check(kc['n'] > 150 and kc['bad'] == 0, 'every cell of Kit\'s ring is ground Kit has explored: the ring stops at his fog\'s edge', kc)
            check(kc['past'] > 0, 'it does pass the open door, into what Kit saw through it', kc)
            # the leak test, statically: every wall in ground Kit has not explored, taken away, changes nothing
            same = await kit.evaluate("tw.moveRings.withoutUnknownWalls()")
            check(same['same'] and same['dropped'] > 0, 'walls in ground Kit has not explored make no difference to his field (none of them bends it)', same)
            await shot(kit, 'kit-drag')
            if A.shots and os.environ.get('MR_PROBE'):  # the thin rings alone (Kit's field has no 30-ft ring), at a few weights, one frozen instant
                await kit.evaluate('tw.freezeTime(true)'); base_ = await kit.evaluate("JSON.stringify(tw.moveRings.LOOK)")
                for tag, vals in (('t0', {'thinAlpha': 0, 'casingAlpha': 0}), ('t1', {}), ('t2', {'thinAlpha': 0.55, 'thinWidth': 1.6}), ('t3', {'thinAlpha': 0.7, 'thinWidth': 2.0})):
                    await kit.evaluate("(b) => { const L = JSON.parse(b); for (const k in L) tw.moveRings.set(k, L[k]); }", base_)
                    for k, v in vals.items(): await kit.evaluate(f"tw.moveRings.set('{k}', {json.dumps(v)})")
                    await kit.wait_for_timeout(300); await shot(kit, f'thin-{tag}')
                await kit.evaluate("(b) => { const L = JSON.parse(b); for (const k in L) tw.moveRings.set(k, L[k]); }", base_); await kit.evaluate('tw.freezeTime(false)')
            await drop(kit, back=(KX, KZ))
            await grab(mi, MX, MZ, 10, 12.5)
            ms_ = await mi.evaluate(MR); mc = await mi.evaluate(EXPLORED_ALL); miCells1 = await mi.evaluate(CELLS)
            unk = await kit.evaluate("(cells) => cells.filter(([x, z]) => x > 20 && !tw.fog.explored(x, z, 0)).length", json.loads(miCells1))
            check(ms_['shown'] and mc['bad'] == 0 and unk > 40, 'Mira, who walked room 2, has her ring in parts of room 2 Kit has never seen', {'mira': mc, 'kit': kc, 'mira cells Kit does not know': unk})
            await shot(mi, 'mira-drag')
            await drop(mi, back=(MX, MZ))
            # the GM opens the door between rooms 2 and 3: neither player can see it
            zb = (DB['z0'] + DB['z1']) / 2
            check(await kit.evaluate(f"!tw.fog.explored(39.4, {zb}, 0) && !tw.fog.explored(40.6, {zb}, 0)") and await mi.evaluate(f"!tw.fog.visible(39.4, {zb}, 0)"), 'the far door: Kit has never seen it, Mira cannot see it now')
            await gm.evaluate(OPEN, DB['key']); await wait(gm, f"Object.values(tw.entities()).some(e => e.fromEdge === '{DB['key']}' && e.open) && tw.sync.pendingCount() === 0", 15000, 'door b open')
            for pg in (mi, kit): await wait(pg, f"Object.values(tw.entities()).some(e => e.fromEdge === '{DB['key']}')", 10000, 'door b arrives')
            await kit.wait_for_timeout(500)
            await grab(kit, KX, KZ, 10, 10); kitCells2 = await kit.evaluate(CELLS); await drop(kit, back=(KX, KZ))
            await grab(mi, MX, MZ, 10, 12.5); mc2 = await mi.evaluate(EXPLORED_ALL); miCells2 = await mi.evaluate(CELLS); await drop(mi, back=(MX, MZ))
            check(kitCells1 == kitCells2, 'THE FOG RULE: the GM opening a door Kit has never seen changes not one cell of Kit\'s field', f"{len(json.loads(kitCells1))} cells, identical")
            check(miCells1 != miCells2 and mc2['room3'] > mc['room3'], 'while Mira, who knows room 3, now has her ring through it', [mc['room3'], mc2['room3']])
            # a drag into ground Kit has not explored: the straight line, as always
            await grab(kit, KX, KZ, OX, OZ)
            ki = await kit.evaluate(ITEM); kmd = await kit.evaluate("tw.moveDrag.pawns")
            kst = (kmd['dx'] ** 2 + kmd['dz'] ** 2) ** 0.5
            check(ki and not ki.get('path') and abs(float(ki['text'].split(' ')[0]) - round(kst)) < 0.01, 'dragged into unexplored ground: no route is known, the straight line and its number stand', ki)
            await drop(kit, back=(KX, KZ))
            # the GM drags the ogre through room 2, where Kit has never been: nothing on Kit's page
            rx0 = await kit.evaluate("window.__rx.length")
            await grab(gm, OX, OZ, 48, DB['z0'] - 5); await gm.wait_for_timeout(500)  # (below door b's jamb: the walk has to turn there)
            gs = await gm.evaluate(MR); gitem = await gm.evaluate(ITEM)
            kview = await kit.evaluate(f"(() => ({{ rings: tw.moveRings.state().shown, items: tw.rulers.state().items.map(i => i.key + ':' + (i.path ? 'path' : 'line')), ogre: !!tw.worldOf(tw.area()).recs.get('{NPC2}')?.group.visible }}))()")
            await shot(kit, 'kit-watching-gm')
            await drop(gm, back=(OX, OZ))
            rx = await kit.evaluate(f"window.__rx.slice({rx0}).join('\\n')")
            check(gs['shown'] and gitem and gitem.get('path'), 'the GM has the rings and the bent line, through the door Kit never saw', gitem and gitem.get('path'))
            check(not kview['rings'] and not kview['items'] and not kview['ogre'], 'Kit watching: no rings, no line, no ogre: his view is what it was before movement rings', kview)
            check('"path"' not in rx and 'moveRing' not in rx, 'nothing new on the wire: what reached Kit\'s page carries no route and no ring', f"{len(rx)} bytes received")
            # red is the dragging seat's own: Mira's walled-off drag is red on her screen, the GM sees it in her colour
            await grab(mi, MX, MZ, MX, 27)  # (north of room 1's north wall: outside, walled off)
            mred = await mi.evaluate(ITEM); gsee = await gm.evaluate(f"(tw.rulers.state().items.find(i => i.key === 'seat:{seats[0]}') || null)"); mcol = await gm.evaluate(f"tw.seatColor('{seats[0]}')")
            await drop(mi, back=(MX, MZ))
            check(mred and mred.get('noRoute'), 'Mira drags her pawn into ground she cannot walk to: red on her screen', mred)
            check(gsee and not gsee.get('noRoute') and gsee['color'] == mcol and not gsee.get('path'), 'the GM watching sees her straight line in her own colour, as before (no red on another seat)', gsee)

        # ================= PERF =================
        if want('PERF'):
            print('PERF: a town')
            sys.path.insert(0, os.path.join(REPO, 'experiments', '2026-10-06-megamap')); import layout  # noqa
            rs, lots = layout.rooms(A.rooms); ext = layout.extent(rs)
            pf = await tab(page)
            await pf.fill('#newCampaign input[name=gm]', 'Harry'); await pf.fill('#newCampaign input[name=name]', f"TEST moverings town {time.strftime('%H:%M:%S')} (throwaway)")
            await pf.click('#newCampaign button'); await wait(pf, 'window.tw?.ready?.() && tw.moveRings', 90000)
            t0 = time.time()
            skipped = 0
            for r in rs:  # (as the megamap's build.py: a room the solver cannot lay out is skipped and counted)
                res = await pf.evaluate("(a) => { try { return { id: tw.spawnRoom(...a) }; } catch (e) { return { err: String(e && e.message || e) }; } }", list(r[:7]))
                if not res.get('id'): skipped += 1; continue
                await wait(pf, f"!!tw.entities()['{res['id']}'] && tw.sync.pendingCount() === 0", 120000, 'room')
            print(f'    {skipped} of {len(rs)} rooms the solver could not lay out (skipped)', flush=True)
            await wait(pf, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading', 240000, 'spawned')
            info = await pf.evaluate("(() => { const E = Object.values(tw.entities()); return { rooms: E.filter(e => e.kind === 'room').length, objects: E.filter(e => e.kind === 'object').length, edges: tw.worldOf(tw.area()).edges.size }; })()")
            print(f'    town built in {time.time() - t0:.0f} s: {info}', flush=True)
            # a pawn in each of a few rooms; the camera as the game opens (110 ft from a building's middle)
            pick = await pf.evaluate("(() => Object.values(tw.entities()).filter(e => e.kind === 'room' && !e.recipe.y).slice(0, 6).map(r => [(r.recipe.x + r.recipe.w / 2) * 5, (r.recipe.z + r.recipe.d / 2) * 5]))()")
            toks = [{'type': 'token.create', 'args': {'id': f'tok_perf{i:06d}', 'name': f'P{i}', 'x': x, 'z': z}} for i, (x, z) in enumerate(pick)]
            await pf.evaluate(f"tw.batch({json.dumps(toks)})"); await wait(pf, f"!!tw.entities()['tok_perf{len(pick) - 1:06d}']", 10000)
            FRAMES = """(ms) => new Promise(res => { const t = []; let last = performance.now(); const end = last + ms; function f(now) { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ n: t.length, mean: t.reduce((a, b) => a + b, 0) / t.length, p50: t[t.length >> 1], p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1] }); } } requestAnimationFrame(f); })"""
            rows = []
            for rnd in range(4):
                on = rnd % 2 == 1
                await pf.evaluate(f"tw.moveRings.set('on', {str(on).lower()})")
                for i, (x, z) in enumerate(pick[:4]):
                    await pf.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.yaw = 0; g.pitch = 58; g.dist = 110; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
                    await pf.wait_for_timeout(1500)
                    x0, y0 = await at(pf, x, z); await pf.mouse.move(x0, y0); await pf.mouse.down()
                    meas = pf.evaluate(FRAMES, 600)  # the first 600 ms of the drag: does its start cost a hitch?
                    for k in range(12): await pf.mouse.move(x0 + 8 + k * 9, y0 + 4 + k * 5); await pf.wait_for_timeout(45)
                    first = await meas
                    moving = pf.evaluate(FRAMES, 1500)
                    for k in range(30): await pf.mouse.move(x0 + 116 - k * 4, y0 + 64 - (k % 7) * 6); await pf.wait_for_timeout(45)
                    during = await moving
                    st = await pf.evaluate(MR)
                    await pf.mouse.move(x0, y0, steps=3); await pf.mouse.up(); await pf.wait_for_timeout(300)
                    rows.append({'on': on, 'pawn': i, 'startMax': round(first['max'], 1), 'startP95': round(first['p95'], 1), 'dragMean': round(during['mean'], 1), 'dragP95': round(during['p95'], 1), 'field': st['stats']['last'] if on else None})
                    print('    ' + json.dumps(rows[-1]), flush=True)
            def agg(on, k): v = [r[k] for r in rows if r['on'] == on]; return round(sum(v) / len(v), 1) if v else None
            fields = [r['field'] for r in rows if r['on'] and r['field']]
            summary = {'town': info, 'off': {k: agg(False, k) for k in ('startMax', 'startP95', 'dragMean', 'dragP95')}, 'on': {k: agg(True, k) for k in ('startMax', 'startP95', 'dragMean', 'dragP95')},
                       'fieldMs': {'mean': round(sum(f['totalMs'] for f in fields) / len(fields), 2), 'max': round(max(f['totalMs'] for f in fields), 2), 'wallMs': round(max(f['wallMs'] for f in fields), 2), 'segs': max(f['segs'] for f in fields)} if fields else None}
            print('PERF ' + json.dumps(summary), flush=True)
            check(fields and summary['fieldMs']['max'] < 50, 'on a town: a drag\'s field costs a few ms', summary['fieldMs'])
            check(summary['on']['dragMean'] is not None and summary['on']['dragMean'] <= summary['off']['dragMean'] * 1.15 + 1.5, 'the frame time while dragging is the same with the rings as without', [summary['off'], summary['on']])
            await pf.evaluate("tw.moveRings.set('on', true)")

        check(not errors, 'no page errors', errors[:5])
        await browser.close()
    bad = [r for r in results if not r[0]]
    print(f"moverings: {len(results) - len(bad)}/{len(results)} ok")
    return 1 if bad else 0

try:
    rc = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
sys.exit(rc)
