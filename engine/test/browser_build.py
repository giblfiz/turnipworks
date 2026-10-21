#!/usr/bin/env python3
"""Build rung acceptance (Harry 2026-10-03): the Build launcher and menu (genre → type → room → furniture → object,
chorded letters, Shift+level jumps), tool state shown by an animated cursor, the building tool, the library shelves in
the PiP (fly to the menu's item, progressive meshes, drag out, copy and paste), and room/building labels as the
selection handles (rename; a player never receives them). Two tabs (GM + player), real keyboard and mouse input.

  local:  python3 engine/test/browser_build.py --local
  live:   ... browser_build.py --page https://turnipworks.net/
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
# TW_GPU=1: render on the GPU (Vulkan) instead of software GL: several times faster, and steadier on a loaded machine
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
SHOTS = os.path.join(HERE, 'shots')
# how many rooms a building type has is read from the type data (the tuner's rooms.json; a room's recipes, 'nob-...', name its
# type: the Build menu's own join, engine/client/taxonomy.js), never written here: types gain rooms (2026-10-12)
_ROOMS = json.load(open(os.path.join(REPO, 'tools', 'spawn-tuner', 'data', 'rooms.json')))
def n_rooms(code): return sum(any(x.startswith(code.lower() + '-') for x in r.get('recipes', [])) for r in _ROOMS)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
def port_free(port):
    import socket
    with socket.socket() as so:
        so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try: so.bind(('127.0.0.1', port)); return True
        except OSError: return False

def start_local():
    for port in (18096, 18725):
        if not port_free(port): sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-build-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': '18096', 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', '18725', '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen('http://127.0.0.1:18096/health', timeout=1); urllib.request.urlopen('http://127.0.0.1:18725/engine/client/index.html', timeout=1); break
        except Exception: pass
    return 'http://127.0.0.1:18725/engine/client/index.html?relay=' + urllib.parse.quote('http://127.0.0.1:18096') + '&api=&nopost&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def drag(pg, a, b, steps=10, step_ms=30, hold=0):
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    if hold: await pg.wait_for_timeout(hold)
    for i in range(1, steps + 1):
        await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(step_ms)
    await pg.mouse.up()
async def topdown(pg, x, z, dist=60, pitch=89.5):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(150)
state = lambda pg: pg.evaluate('tw.build.state()')

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nopost&faces=1500'
    nointro = page + '&nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}, permissions=['clipboard-read', 'clipboard-write'])
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else (print('    (warn)', m.text[:300]) if 'footLine' in m.text else None))
            await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST build ' + __import__('time').strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')

        print('INTRO: on the first visit a phantom seat acts the first build out; the GM gets an undo chip')
        seen = {'cursors': set(), 'ghost': 0, 'kinds': set(), 'menu': 0}
        t0 = time.time()
        while time.time() - t0 < 120:
            st = await gm.evaluate("({ i: tw.intro.info(), cur: tw.cursors().filter(c => c.ghost).map(c => c.name), g: !!document.querySelector('#introGhost'), k: tw.cursorState?.kind || null, m: tw.build.isOpen })")
            seen['cursors'].update(st['cur']); seen['ghost'] += st['g']; seen['menu'] += bool(st['m'])
            if st['k']: seen['kinds'].add(st['k'])
            if st['i']['state'] in ('done', 'failed', 'interrupted'): break
            await gm.wait_for_timeout(150)
        info = await gm.evaluate('tw.intro.info()')
        check(info['state'] == 'done' and seen['ghost'] > 3 and seen['menu'] > 2, 'the intro runs by itself on the first visit: a ghost cursor opens Build and picks through the menus', f"{info['state']} · steps {info['steps']}")
        st = info['steps']
        check([x for x in st if x in ('g:fantasy', 't:TAV', 'r:TAV:common', 'room')] == ['g:fantasy', 't:TAV', 'r:TAV:common', 'room'], 'it goes Fantasy → Tavern & inn → Common room, then drags a room out', st)
        check({'building', 'room'} <= seen['kinds'], 'the cursor visibly changes with each tool on the way', sorted(seen['kinds']))
        check('Intro' in seen['cursors'], "the phantom is a real seat: its own ghost cursor moves in the world (the agent API's look)", sorted(seen['cursors']))
        intro_room = await gm.evaluate("tw.intro.room")
        ok = await wait(gm, f"!!tw.entities()['{intro_room}']", 10000, 'intro room')
        chip = await gm.evaluate('tw.undoChips()')
        check(ok and chip and chip[0]['type'] == 'room.spawn' and "Undo Intro's room" in chip[0]['text'], "the phantom's room arrives as another seat's change, with the GM's floating undo chip beside it", chip)
        check(await gm.evaluate("!document.querySelector('#introHint').hidden && document.querySelector('#introHint').textContent.includes('B')"), 'then it hands over: "Press B to build"')
        await wait(gm, f"!tw.sync.campaign.seats.some(s => s.name === 'Intro')", 8000, 'phantom leaves')
        check(await gm.evaluate("!tw.sync.campaign.seats.some(s => s.name === 'Intro')"), 'and the phantom seat leaves the roster')
        await gm.click('.uchip')
        check(await wait(gm, f"!tw.entities()['{intro_room}']", 8000, 'chip undo'), "one click on the undo chip removes the phantom's room")
        await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000, 'reload')
        await gm.wait_for_timeout(4000)
        check(await gm.evaluate("tw.intro.info().state") == 'idle', 'it never runs again on the next visit')
        await gm.evaluate("tw.registry.run('help.intro')")
        await wait(gm, "tw.intro.info().state === 'running' && !!document.querySelector('#introGhost')", 8000, 'replay')
        await gm.wait_for_timeout(1800)
        await gm.keyboard.press('Shift')
        await wait(gm, "tw.intro.info().state === 'interrupted'", 4000, 'interrupt')
        await gm.wait_for_timeout(700)
        check(await gm.evaluate("tw.intro.info().state") == 'interrupted' and await gm.evaluate("!document.querySelector('#introGhost') && !tw.build.isOpen"), '"Replay intro" plays it again, and any real input stops it at once')
        await gm.wait_for_timeout(2000)
        tok = await gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Brakka', color: '#6fc36f' })")
        pl = await tab((await gm.evaluate(f"tw.inviteLink('{tok}')")).replace('nopost', 'nofx'))
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 40000), 'player tab live')
        await gm.bring_to_front()

        print('TRAY: one tray from the left (Genre → Type → Room), chords, Shift+G/T/R, sticky; the pointer itself changes')
        check(await gm.evaluate("!document.querySelector('#launchers').hidden && !!document.querySelector('.launcher[data-l=build] img.lic')") and await pl.evaluate("document.querySelector('.launcher[data-l=build]').hidden"), 'the Build launcher (the painted hammer and saw) sits upper-left for the GM; a player who cannot build never sees it', [await gm.evaluate("[document.querySelector('#launchers').hidden, !!document.querySelector('.launcher[data-l=build] img.lic')]"), await pl.evaluate("[document.querySelector('.launcher[data-l=build]').hidden, tw.can('room'), tw.can('object'), tw.sync.status]")])
        curs = lambda: gm.evaluate("getComputedStyle(document.getElementById('c')).cursor")
        await gm.mouse.move(520, 420)
        await gm.keyboard.press('b'); await gm.wait_for_timeout(400)
        s = await state(gm)
        check(s['open'] and s['path'][-1] == 'Common room' and s['active'] == 'room' and s['tool'] == 'room' and await gm.evaluate("tw.library.shown() && tw.pip?.area === 'lib:common'"), 'B reopens exactly where the last pick was (Fantasy › Tavern & inn › Common room), its tool live and its library open in the PiP', s['path'])
        geo = await gm.evaluate("""(() => { const m = { left: parseFloat(getComputedStyle(document.getElementById('buildMenu')).left), top: parseFloat(getComputedStyle(document.getElementById('buildMenu')).top) }, l = document.querySelector('.launcher').getBoundingClientRect(), ts = [...document.querySelectorAll('#buildMenu .btile')].map(t => t.getBoundingClientRect());
          const cols = new Set(ts.map(t => Math.round(t.left))).size, anc = [...document.querySelectorAll('#buildMenu .bchip')].map(c => c.getBoundingClientRect().bottom), grid = document.querySelector('#buildMenu .bgrid').getBoundingClientRect().top;
          return { left: m.left, ll: l.left, top: m.top, lb: l.bottom, cols, anc: anc.length, above: anc.every(b => b <= grid + 1), flyouts: document.querySelectorAll('#buildMenu .casc, #buildMenu .kids').length, imgs: [...document.querySelectorAll('#buildMenu .btile')].every(t => t.querySelector('.nic') && t.querySelector('.bl').textContent) }; })()""")
        check(abs(geo['left'] - geo['ll']) < 1 and geo['top'] > geo['lb'] and geo['cols'] == 2 and geo['anc'] == 2 and geo['above'] and geo['flyouts'] == 0 and geo['imgs'], 'ONE tray: left edge on the Build button\'s, the levels above as a stacked breadcrumb, the options as a two-column grid of big icon tiles (labels under), no fly-outs', geo)
        c_room = await curs()
        await gm.keyboard.press('Shift+G'); await gm.wait_for_timeout(250)
        s = await state(gm); c_none = await curs()
        check(s['active'] == 'genre' and s['tool'] is None and 'cursors/' not in c_none, 'Shift+G jumps to the genres: no tool, the ordinary pointer', [s['path'], c_none[:40]])
        await gm.keyboard.press('f'); await gm.wait_for_timeout(200)
        s = await state(gm); types = s['list']
        check(s['active'] == 'type' and len(types) >= 10 and any('Tavern' in t for t in types), 'a letter picks the genre and its types become the current list (every type has a letter)', f"{len(types)} types: {types[:4]}")
        hot_t = next(t.split(':')[0] for t in types if 'Tavern' in t)
        await gm.keyboard.press(hot_t); await gm.wait_for_timeout(300)
        s = await state(gm); cur = await gm.evaluate('tw.cursorState'); c_build = await curs()
        check(s['tool'] == 'building' and s['active'] == 'room' and cur and cur['kind'] == 'building' and 'cursors/build' in c_build and await gm.evaluate("document.querySelector('#toolCursor').classList.contains('pop')"), 'picking a type: the building tool; the POINTER itself becomes the building cursor (a pop announces it); its rooms list', [s['path'], c_build[:90]])
        rooms = s['list']; hot_c = next(t.split(':')[0] for t in rooms if 'Common' in t)
        sw0 = cur['switches']
        await gm.keyboard.press(hot_c); await gm.wait_for_timeout(400)
        s = await state(gm); cur = await gm.evaluate('tw.cursorState'); c_room = await curs()
        check(s['tool'] == 'room' and cur['kind'] == 'room' and cur['switches'] == sw0 + 1 and 'cursors/room' in c_room and await gm.evaluate("tw.library.shown()"), 'a room letter: the room-drawing pointer, and the room type\'s library pops open in the PiP', [s['path'][-1], c_room[:90]])
        await gm.keyboard.press('Shift+T'); await gm.wait_for_timeout(300)
        s = await state(gm)
        check(s['active'] == 'type' and s['tool'] == 'building' and len(s['path']) == 2, 'Shift+T jumps back up to the types (level jumps never collide with item letters)', s['path'])
        await gm.keyboard.press(hot_t); await gm.keyboard.press(hot_c); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        await gm.mouse.move(530, 430); await gm.wait_for_timeout(200)
        check(not (await state(gm))['open'] and await gm.evaluate("tw.mode?.kind === 'room' && tw.mode.tool") and 'cursors/room' in await curs(), 'Esc closes the tray; the tool and its pointer stay')
        await gm.keyboard.down('Space'); sp = await curs(); await gm.keyboard.up('Space')
        check(sp == 'grab' and 'cursors/room' in await curs(), 'Space shows the grab hand for panning, and the tool pointer comes back after', sp)
        await gm.keyboard.press('b'); await gm.wait_for_timeout(300)
        await gm.click('#buildMenu .bchip[data-anc="1"]'); await gm.wait_for_timeout(300)
        s = await state(gm)
        check(s['active'] == 'type' and s['path'][-1].startswith('Tavern'), 'clicking a level in the breadcrumb goes back up to it, inside the same tray', s['path'])
        await gm.keyboard.press(hot_t); await gm.keyboard.press(hot_c); await gm.wait_for_timeout(200)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        check(not await gm.evaluate('tw.mode') and 'cursors/' not in await curs() and not await gm.evaluate('tw.library.shown()'), 'a second Esc puts the tool away: the ordinary pointer, the library closes')
        # the PiP is a window: move by the title bar, resize from a corner, double-click for big, remembered
        await gm.keyboard.press('b'); await gm.wait_for_timeout(400); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        bar = await gm.evaluate("(() => { const r = document.querySelector('#pipFrame .bar').getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; })()")
        r0 = await gm.evaluate('tw.pip.rect')
        await drag(gm, bar, {'x': bar['x'] - 200, 'y': bar['y'] - 60}, steps=8, step_ms=40)
        r1 = await gm.evaluate('tw.pip.rect')
        se = await gm.evaluate("(() => { const r = document.querySelector('#pipFrame .rz[data-d=se]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, cur: getComputedStyle(document.querySelector('#pipFrame .rz[data-d=se]')).cursor }; })()")
        await drag(gm, se, {'x': se['x'] + 120, 'y': se['y'] + 80}, steps=8, step_ms=40)
        r2 = await gm.evaluate('tw.pip.rect')
        await drag(gm, {'x': se['x'] + 120, 'y': se['y'] + 80}, {'x': 2000, 'y': 2000}, steps=4, step_ms=40)
        r3 = await gm.evaluate('tw.pip.rect')
        await gm.dblclick('#pipFrame .bar span'); await gm.wait_for_timeout(200); rb = await gm.evaluate('tw.pip.rect')
        await gm.dblclick('#pipFrame .bar span'); await gm.wait_for_timeout(200); rn = await gm.evaluate('tw.pip.rect')
        saved = await gm.evaluate("JSON.parse(localStorage.getItem(`tw.pip.${tw.sync.campaign.id}.${tw.me()}`)).rect")
        H_ = await gm.evaluate("document.getElementById('c').clientHeight")  # (since 2026-10-06 the level meter is on the left edge; the PiP may reach the bottom again)
        ok = r1[0] < r0[0] - 0.1 and r2[2] > r1[2] and r2[3] > r1[3] and se['cur'] == 'nwse-resize' and abs(r3[0] - r2[0]) < 1e-6 and abs(r3[0] + r3[2] - 1) < 1e-3 and abs(r3[1] + r3[3] - 1) < 1e-3 and rb != rn and abs(rn[2] - r3[2]) < 1e-6 and saved == rn
        check(ok, 'the PiP is a window: drag by its title bar, resize from a corner (resize cursor, kept on screen), double-click for big and back, remembered per seat', [r0, r1, r2, r3, rb, rn])
        await gm.evaluate("(() => { tw.pip.rect = [0.64, 0.5, 0.34, 0.42]; localStorage.setItem(`tw.pip.${tw.sync.campaign.id}.${tw.me()}`, JSON.stringify({ rect: tw.pip.rect })); })()")
        await gm.keyboard.press('Escape')
        print('BUILDING TOOL: a dragged rectangle becomes a whole inn in one step')
        await topdown(gm, 40, 30, 110)
        await gm.keyboard.press('b'); await gm.keyboard.press('Shift+T'); await gm.keyboard.press(hot_t); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length")
        await gm.evaluate("tw.mode && (tw.mode.seed = 7)")  # (whole buildings: the layout is the seed's; a fixed one keeps the walls this suite drags in the same places)
        await drag(gm, await scr(gm, 11, 6), await scr(gm, 79, 54), steps=12)
        ok = await wait(gm, "Object.values(tw.entities()).filter(e => e.kind === 'room').length >= 4 && tw.sync.pendingCount() === 0", 30000, 'inn rooms')
        rs = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => ({ id: e.id, type: e.recipe.type, b: e.building, x: e.recipe.x, z: e.recipe.z, w: e.recipe.w, d: e.recipe.d }))")
        bld = await gm.evaluate(f"tw.entities()['{rs[0]['b']}']") if rs else None
        check(ok and len({r['b'] for r in rs}) == 1 and bld and bld['name'] == 'Tavern & inn' and {'common', 'kitchen'} <= {r['type'] for r in rs}, 'the building tool packs the inn\'s rooms into the rectangle: one building, named for its type', f"{len(rs)} rooms: {sorted(r['type'] for r in rs)}")
        await wait(gm, 'tw.spawningNow().anims === 0', 40000, 'spawn done')
        await gm.keyboard.press('Escape')
        await gm.keyboard.press('Control+z')
        undone = await wait(gm, "Object.values(tw.entities()).filter(e => e.kind === 'room').length === 0", 15000, 'undo inn')
        check(undone, 'one Ctrl+Z takes the whole building back (one command)')
        await gm.keyboard.press('Control+Shift+z')
        await wait(gm, f"Object.values(tw.entities()).filter(e => e.kind === 'room').length === {len(rs)} && tw.sync.pendingCount() === 0", 15000, 'redo inn')
        await wait(gm, 'tw.spawningNow().anims === 0', 40000, 'respawn done')
        # (2026-10-11, whole buildings: the tool now makes a two-storey inn with a cellar; engine/test/browser_buildings.py
        # tests that. The rest of THIS suite is about labels and the library on one floor, so the inn is made again with one
        # storey, and `rs` is its ground-floor rooms: a room under another floor or under the ground carries no label.)
        check(await gm.evaluate("new Set(Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => e.recipe.y || 0)).has(10) && !!tw.entities()[tw.lastBuilding].gen"), 'the inn has an upper storey and remembers how it was made (whole buildings)')
        await gm.evaluate("tw.regenBuilding(tw.lastBuilding, { storeys: 1, outbuildings: false, seed: 7 })")
        await wait(gm, "!Object.values(tw.entities()).some(e => e.kind === 'room' && (e.recipe.y || 0) === 10) && Object.values(tw.entities()).filter(e => e.kind === 'room').length >= 4 && tw.sync.pendingCount() === 0", 30000, 'one-storey inn')
        await wait(gm, 'tw.spawningNow().anims === 0', 40000, 'one-storey inn drawn')
        for k in await gm.evaluate("tw.condButtons.list().map(x => x.key).filter(k => k.startsWith('bld-'))"): await gm.evaluate(f"tw.condButtons.hide('{k}')")
        rs = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room' && !(e.recipe.y || 0)).map(e => ({ id: e.id, type: e.recipe.type, b: e.building, x: e.recipe.x, z: e.recipe.z, w: e.recipe.w, d: e.recipe.d }))")

        print('LABELS: the selection handles; floor clicks select nothing; rename; players never receive them')
        await topdown(gm, 40, 30, 110, pitch=70); await gm.wait_for_timeout(400)
        L = await gm.evaluate('tw.labelInfo()')
        vis = [l for l in L if l['visible']]
        overl = sum(1 for i, a in enumerate(vis) for b in vis[i + 1:] if a['rect'][0] < b['rect'][2] and b['rect'][0] < a['rect'][2] and a['rect'][1] < b['rect'][3] and b['rect'][1] < a['rect'][3])
        check(any(l['kind'] == 'building' and l['visible'] for l in L) and len([l for l in L if l['kind'] == 'room']) == len(rs) and overl == 0, 'every room and the building has a label; the visible ones never overlap', f"{len(vis)}/{len(L)} visible, {overl} overlaps")
        common = next(r for r in rs if r['type'] == 'common')
        await gm.click(f'.rlabel[data-id="{common["id"]}"]'); await gm.wait_for_timeout(200)
        check(await gm.evaluate(f"[...tw.sel].join() === '{common['id']}'"), 'clicking a room label selects the whole room')
        await gm.click(f'.rlabel[data-id="{rs[0]["b"]}"]'); await gm.wait_for_timeout(200)
        check(await gm.evaluate(f"[...tw.sel].join() === '{rs[0]['b']}'"), 'clicking the building label selects the building')
        # a floor click inside the room: away from its furniture, its label and its walls
        await gm.keyboard.press('Escape')
        spot = await gm.evaluate(f"""(() => {{ const r = tw.entities()['{common['id']}'].recipe, w = tw.worldOf(tw.area());
          for (let i = 1; i < 30; i++) for (let j = 1; j < 30; j++) {{ const x = r.x * 5 + 1.5 + (r.w * 5 - 3) * i / 30, z = r.z * 5 + 1.5 + (r.d * 5 - 3) * j / 30; const s = tw.screenOf(x, z, tw.main, 0);
            const hits = w.pickAll(tw.rayAt(s.x, s.y)); const el = document.elementFromPoint(s.x, s.y); if (hits[0]?.floor && el?.id === 'c') return s; }} return null; }})()""")
        if spot:
            await gm.mouse.click(spot['x'], spot['y']); await gm.wait_for_timeout(200)
            check(await gm.evaluate('tw.sel.size') == 0, 'a click on the floor selects nothing')
        else: check(False, 'a click on the floor selects nothing (no clear floor spot found)')
        # (since storeys, Stage C a double-click on a room's label sets the cut; F2 renames)
        await gm.click(f'.rlabel[data-id="{common["id"]}"]'); await gm.wait_for_timeout(450); await gm.keyboard.press('F2'); await gm.wait_for_timeout(200)
        diag = await gm.evaluate(f"JSON.stringify({{ input: !!document.querySelector('.rlabel input'), active: document.activeElement?.tagName, label: tw.labelInfo().find(l => l.id === '{common['id']}'), at: document.elementFromPoint(...(() => {{ const r = document.querySelector('.rlabel[data-id=\"{common['id']}\"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})())?.className }})")
        await gm.keyboard.press('Control+a'); await gm.keyboard.type('Secret vault'); await gm.keyboard.press('Enter')
        ok = await wait(gm, f"tw.entities()['{common['id']}'].name === 'Secret vault' && tw.sync.pendingCount() === 0", 6000, 'rename')
        if not ok: print('    (rename diag)', diag, await gm.evaluate(f"JSON.stringify({{ name: tw.entities()['{common['id']}'].name, toast: document.querySelector('#toast').textContent, pend: tw.sync.pendingCount() }})"))
        ok = ok and await wait(gm, f"document.querySelector('.rlabel[data-id=\"{common['id']}\"] .lt')?.textContent === 'Secret vault'", 4000, 'label text')
        check(ok, 'F2 on a selected room renames it at its label (a synced, undoable room.set)')
        await wait(pl, f"!!tw.entities()['{common['id']}']", 8000, 'player has the room')
        await pl.wait_for_timeout(500)
        blob = await pl.evaluate("JSON.stringify([...tw.sync.areas.values()].map(a => [a.confirmed, a.view]))")
        pl_labels = await pl.evaluate("document.querySelectorAll('.rlabel').length")
        check(await pl.evaluate(f"!!tw.entities()['{common['id']}']") and 'Secret vault' not in blob and 'Tavern & inn' not in blob and pl_labels == 0, 'the player has the room, but no label ever reached them (the relay strips names) and none is drawn')

        print('WALLS, DOORS, WINDOWS are ordinary objects: delete, move, swap, place by hand; re-roll keeps edits')
        await gm.keyboard.press('Escape')
        E3 = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()); const es = [...w.edges.values()].filter(e => !e.y); // (ground-floor walls: the inn has a cellar under it since 2026-10-11)
          const pick = (f) => es.find(f)?.key || null;
          return { outer: pick(e => e.kind === 'wall' && e.sides.length === 1 && w.shell.has(e.key)), inner: pick(e => e.kind === 'wall' && e.sides.length === 2 && w.shell.has(e.key)),
                   door: pick(e => e.kind === 'door' && w.shell.has(e.key + ':door')), outer2: es.filter(e => e.kind === 'wall' && e.sides.length === 1 && w.shell.has(e.key)).map(e => e.key)[3] || null }; })()""")
        shellHas = lambda key: f"tw.worldOf(tw.area()).shell.has('{key}')"
        await gm.evaluate(f"tw.select('wall:{E3['inner']}')"); await gm.wait_for_timeout(300)
        wr = await gm.evaluate("[...document.querySelectorAll('#ring .rbtn')].map(b => b.dataset.cmd || 'menu')")
        check({'edit.rotate', 'thing.pin', 'edit.resize', 'menu'} <= set(wr), 'a generated wall segment selects like an object: the same ring as a prop', wr)
        # the ring sits on each thing's projected bounds: its core arc above the top edge (a wall's top, not its foot)
        picks = await gm.evaluate(f"""(() => {{ const es = Object.values(tw.entities()); return {{ wall: 'wall:{E3['inner']}', door: {json.dumps('wall:' + (E3['door'] or ''))}, candle: es.find(e => /candle/.test(e.cat || '') && !e.parent)?.id || es.find(e => /candle/.test(e.cat || ''))?.id, rug: es.find(e => /^rug/.test(e.cat || ''))?.id }}; }})()""")
        anch = {}
        for nm, pid in picks.items():
            if not pid or pid == 'wall:': continue
            await gm.evaluate(f"tw.select('{pid}')"); await gm.wait_for_timeout(300)
            anch[nm] = await gm.evaluate("""(() => { const g = tw.ringGeom(); if (!g) return null; const ys = [...document.querySelectorAll('#ring .rbtn:not(.ex)')].filter(b => !b.dataset.slot || ![4, 5, 6, 7, 8].includes(Math.round(+b.dataset.slot))).map(b => { const r = b.getBoundingClientRect(); return r.top + r.height / 2; }); /* the core arc (an openable keeps its old size handle at 4 for now) */ return { above: ys.length > 0 && ys.every(y => y < g.top), h: Math.round(g.hy * 2), n: ys.length }; })()""")
        check(len(anch) >= 3 and all(v and v['above'] for v in anch.values()) and anch.get('wall', {}).get('h', 0) > 25, 'the ring anchors on projected bounds: on a wall, a door, a candle and a rug the core buttons sit above the top edge', anch)
        await gm.evaluate(f"tw.select('wall:{E3['inner']}')"); await gm.wait_for_timeout(200)
        n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object').length")
        await gm.keyboard.press('Delete')
        ok = await wait(gm, f"!{shellHas(E3['inner'])}", 6000, 'inner deleted')
        sides = await gm.evaluate(f"tw.worldOf(tw.area()).edges.get('{E3['inner']}').sides.map(s => s.room)")
        n1 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object').length")
        pl_open = await wait(pl, f"!!tw.worldOf(tw.area()).shell && !tw.worldOf(tw.area()).shell.has('{E3['inner']}')", 8000, 'player sees opening')
        check(ok and n1 == n0 and len(sides) == 2 and pl_open, 'Delete just deletes it: the shared wall is gone between both rooms, nothing replaces it (every tab)', f"{E3['inner']} between {sides}")
        await gm.keyboard.press('Control+z')
        check(await wait(gm, shellHas(E3['inner']), 6000, 'wall back'), 'one undo puts it back')
        if E3['door']:
            await gm.evaluate(f"tw.select('wall:{E3['door']}')"); await gm.wait_for_timeout(200)
            await gm.keyboard.press('Delete')
            ok = await wait(gm, f"!tw.worldOf(tw.area()).shell.has('{E3['door']}:door') && !tw.worldOf(tw.area()).shell.has('{E3['door']}')", 6000, 'door deleted')
            check(ok, 'Delete on a door removes the door (no automatic wall)')
            await gm.keyboard.press('Control+z'); await wait(gm, f"tw.worldOf(tw.area()).shell.has('{E3['door']}:door')", 6000, 'door back')
        else: check(False, 'door delete (no door found)')
        # move a generated wall piece: it becomes an object (one command hides the generated one and places it)
        await topdown(gm, 40, 30, 90)
        wi = await gm.evaluate(f"tw.wallItem('wall:{E3['outer']}')")
        a = await scr(gm, wi['x'], wi['z'], 4.5)
        await gm.evaluate(f"tw.select('wall:{E3['outer']}')"); await gm.wait_for_timeout(200)
        await drag(gm, a, await scr(gm, wi['x'] + 5, wi['z'] + 5, 4.5), steps=10, step_ms=60)
        ok = await wait(gm, f"Object.values(tw.entities()).some(e => e.fromEdge === '{E3['outer']}' && tw.sync.pendingCount() === 0)", 8000, 'wall moved')
        mv = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.fromEdge === '{E3['outer']}')")
        check(ok and not await gm.evaluate(shellHas(E3['outer'])) and mv and (abs(mv['x'] - wi['x']) > 1 or abs(mv['z'] - wi['z']) > 1) and mv['place'] == 'kit', 'dragging a generated wall moves it as an object (snapped to the 5-ft grid edges)', mv and [mv['x'], mv['z'], mv['rot']])
        # swap for similar: the same fly-out of turning previews as any object
        # (the new ring, 2026-10-20: world-sized, so the piece is framed as the default play view does; Replace's variants
        # open as the ring grown outward, one .rbtn[data-nest] per variant, instead of a panel of tiles)
        await gm.evaluate(f"(() => {{ const e = tw.entities()['{mv['id']}'], g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.pitch = 52; g.yaw = 0; g.dist = 95; g.update(); tw.main.rule = 'free'; }})()")
        await gm.evaluate(f"tw.select('{mv['id']}')"); await gm.wait_for_timeout(300)
        await gm.evaluate("tw.registry.run('thing.replace')"); await gm.wait_for_timeout(900)
        nfly = await gm.evaluate("document.querySelectorAll('#ring .rbtn[data-nest]').length")
        await gm.click('#ring .rbtn[data-nest] >> nth=0')
        sw = await wait(gm, f"tw.entities()['{mv['id']}'].sku !== '{mv['sku']}'", 6000, 'wall swapped')
        check(nfly > 0 and sw, 'swap for similar works on a wall like on any object', nfly)
        await topdown(gm, 40, 30, 90)
        # re-roll: the room's generated walls come back new; the edited wall stays where it was put
        room_of = mv.get('room')
        if room_of:
            await gm.evaluate(f"tw.rerollRoom(tw.entities()['{room_of}'])")
            await wait(gm, 'tw.sync.pendingCount() === 0', 10000, 'reroll')
            kept = await gm.evaluate(f"!!tw.entities()['{mv['id']}']")
            check(kept, 're-roll keeps a hand-edited wall (like a pinned prop); the rest regenerate')
        # place a door by hand onto a wall line from the build menu: it snaps into the line and takes the wall's place
        if E3['outer2']:
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
            await gm.keyboard.press('b'); await gm.keyboard.press('Shift+R'); await gm.wait_for_timeout(400); await gm.keyboard.press('Escape')
            hd = await gm.evaluate("tw.library.focus('door-plank')")
            if not hd: print('    (door diag)', await gm.evaluate("JSON.stringify({ info: tw.library.info(), mode: tw.mode?.kind, slots: tw.worlds.get('lib:common') ? [...tw.worlds.get('lib:common').lay.slots.keys()].filter(k => /door|wall/.test(k)) : null })"))
            await wait(gm, 'tw.library.info().flown', 40000, 'door in view'); await gm.wait_for_timeout(600)
            # an outer wall of the inn that is on screen and not under the PiP window
            E3['outer2'] = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()), f = document.getElementById('pipFrame').getBoundingClientRect();
              for (const e of w.edges.values()) { if (e.kind !== 'wall' || e.sides.length !== 1 || e.y || !w.shell.has(e.key)) continue; const it = tw.wallItem('wall:' + e.key); const p = tw.screenOf(it.x, it.z, tw.main, 0);
                if (p.x > 80 && p.x < innerWidth - 40 && p.y > 90 && p.y < innerHeight - 40 && !(p.x > f.left - 20 && p.x < f.right + 20 && p.y > f.top - 20 && p.y < f.bottom + 20)) return e.key; } return null; })()""") or E3['outer2']
            wi2 = await gm.evaluate(f"tw.wallItem('wall:{E3['outer2']}')")
            src = await gm.evaluate("tw.library.screenOf('door-plank')"); dst = await scr(gm, wi2['x'] + 0.6, wi2['z'] + 0.4)
            await gm.mouse.move(src['x'], src['y']); await gm.mouse.down()
            for i in range(1, 13): await gm.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 12, src['y'] + (dst['y'] - src['y']) * i / 12); await gm.wait_for_timeout(40)
            mid = await gm.evaluate("getComputedStyle(document.getElementById('c')).cursor")
            await gm.mouse.up()
            ok = await wait(gm, f"Object.values(tw.entities()).some(e => e.cat === 'door-plank' && Math.abs(e.x - {wi2['x']}) < 0.6 && Math.abs(e.z - {wi2['z']}) < 0.6) && !{shellHas(E3['outer2'])}", 8000, 'door placed')
            if not ok: print('    (door diag)', wi2['x'], wi2['z'], src, dst, await gm.evaluate(f"JSON.stringify({{ doors: Object.values(tw.entities()).filter(e => e.cat === 'door-plank').map(e => [e.x, e.z, e.rot]), shell: tw.worldOf(tw.area()).shell.has('{E3['outer2']}'), toast: document.querySelector('#toast').textContent, edges: Object.values(tw.entities()).filter(e => e.kind === 'edge').map(e => e.key) }})"))
            check(hd and ok and 'cursors/place' in mid, 'a door dragged out of the library (the place pointer while dragging) snaps into the wall line and takes that wall\'s place', [E3['outer2'], mid[:60]])
            await gm.keyboard.press('Escape')
        await gm.evaluate('tw.clearSelection()')
        # another seat's wall edit shows up for the GM with the floating undo chip
        mt = await gm.evaluate("tw.createSeat({ kind: 'llm', name: 'Mason', color: '#7fb0ff', scope: { areas: '*', classes: ['room'] } })")
        url = await gm.evaluate(f"`${{tw.relayBase}}/c/${{tw.sync.campaign.id}}/a/${{tw.area()}}/do?cmd=edge.set&key={E3['inner']}&as=open&nonce=mason1&seat={mt}`")
        r = await gm.evaluate(f"fetch('{url}').then(r => r.json())")
        ok = r.get('ok') and await wait(gm, f"!tw.worldOf(tw.area()).shell.has('{E3['inner']}') && tw.undoChips().some(c => c.type === 'edge.set')", 8000, 'mason chip')
        chip = await gm.evaluate("tw.undoChips().find(c => c.type === 'edge.set')")
        check(ok and chip and "Mason's wall change" in chip['text'], "another seat's wall edit arrives with the GM's undo chip beside it", chip)
        if chip: await gm.evaluate(f"document.querySelector('.uchip[data-seat=\"{chip['seat']}\"]')?.click()")  # (at 1–3 fps the chip may already be fading)
        check(await wait(gm, f"tw.worldOf(tw.area()).shell.has('{E3['inner']}')", 6000, 'chip undo wall'), 'one click on the chip puts the wall back')

        print('LIBRARY: picking a room type opens its knolled library in the PiP; a pick there flies the camera; drag out; copy and paste')
        await gm.bring_to_front()  # (the player's tab opened later; keep the GM tab's frames running)
        await gm.keyboard.press('b'); await gm.keyboard.press('Shift+R'); await gm.wait_for_timeout(600); await gm.keyboard.press('Escape')
        info = await gm.evaluate('tw.library.info()')
        check(info['shown'] and info['area'] == 'lib:common' and await gm.evaluate("tw.pip?.area") == 'lib:common', "with Common room picked, the PiP shows the common room's library area", info['area'])
        await wait(gm, 'tw.library.info().flown', 15000, 'overview')
        fr = await gm.evaluate("""(() => { const w = tw.worlds.get('lib:common'), f = document.getElementById('pipFrame').getBoundingClientRect(); let out = 0, n = 0;
          for (const e of Object.values(w.libView.entities)) { n++; const p = tw.screenOf(e.x, e.z, tw.pip, 0); if (p.x < f.left || p.x > f.right || p.y < f.top || p.y > f.bottom) out++; } return { n, out }; })()""")
        check(fr['n'] > 50 and fr['out'] == 0, 'the library opens zoomed out to frame ALL its things', fr)
        lb = await gm.evaluate("""(() => { const w = tw.worlds.get('lib:common'), rs = [];
          for (const m of w.layers.deco.children) { const L = m.userData.label; if (!L) continue; const p = m.position;
            const a = tw.screenOf(p.x - L.w / 2, p.z - L.h / 2, tw.pip, 0.02), b = tw.screenOf(p.x + L.w / 2, p.z + L.h / 2, tw.pip, 0.02);
            rs.push([Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y), L.text]); }
          // things' footprints count too: a label may not lie on a thing
          let bad = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const A = rs[i], B = rs[j]; if (A[0] < B[2] - 0.5 && B[0] < A[2] - 0.5 && A[1] < B[3] - 0.5 && B[1] < A[3] - 0.5) bad.push(A[4] + ' / ' + B[4]); }
          const [sx, sz] = w.lay.size; return { n: rs.length, overlaps: bad.length, sample: bad.slice(0, 4), aspect: +(sx / sz).toFixed(2) }; })()""")
        check(lb['n'] > 50 and lb['overlaps'] == 0 and 0.9 < lb['aspect'] < 2.4, 'library labels never collide (projected at the opening framing), and the packed layout is shaped like the PiP window', lb)
        cats = await gm.evaluate("(() => { const w = tw.worlds.get('lib:common'); return Object.values(w.libView.entities).slice(0, 40).map(e => e.cat); })()")
        async def pick_in_pip(cat):
            p_ = await gm.evaluate(f"tw.library.screenOf('{cat}')"); await gm.mouse.click(p_['x'], p_['y']); await gm.wait_for_timeout(200)
            return await gm.evaluate('tw.library.info()')
        visible = await gm.evaluate(f"(() => {{ const r = document.getElementById('pipFrame').getBoundingClientRect(); return {json.dumps(cats)}.filter(c => {{ const p = tw.library.screenOf(c); return p && p.x > r.left + 20 && p.x < r.right - 20 && p.y > r.top + 30 && p.y < r.bottom - 20 && tw.library.pick(p.x, p.y)?.id === c; }}); }})()")  # (a thing with something solid at its middle: an open frame, a stand or a doorway, is missed there at any size)
        i1 = await pick_in_pip(visible[0]) if visible else None
        await gm.keyboard.press('f')  # the pointer is over the PiP: F frames the picked thing there
        await wait(gm, 'tw.library.info().flown', 45000, 'flown 1')
        f1 = await gm.evaluate('tw.library.info()')
        slot = await gm.evaluate(f"tw.library.slotOf('{visible[0]}')") if visible else None
        check(i1 and i1['sel'] == visible[0] and slot and abs(f1['focus'][0] - slot['x']) < 0.6 and f1['target']['dist'] < 40, "a click in the library picks a thing; F over the PiP flies its camera to it", [visible[:3], f1['target'], f1['focus']])
        kn = await gm.evaluate("""(() => { const w = tw.worlds.get('lib:common'), es = Object.values(w.libView.entities);
          const tall = es.filter(e => e.dims[1] > 0.8 * Math.max(e.dims[0], e.dims[2]) && e.dims[1] > 0.6 && !e.flat);
          return { n: es.length, square: es.every(e => !e.rot), tall: tall.length, lying: tall.filter(e => { const [w, h, d] = e.dims, best = Math.max(h * d, w * h); return Math.abs(e.tiltZ || 0) > 1 || Math.abs(e.tiltX || 0) > 1 || w * d >= best; }).length, kit: es.filter(e => e.place === 'kit').length,
                   pitch: tw.pip.grab.pitch, heads: w.layers.deco.children.length, sample: tall.slice(0, 3).map(e => e.cat) }; })()""")
        check(kn['n'] > 50 and kn['square'] and kn['tall'] > 0 and kn['lying'] == kn['tall'] and kn['pitch'] > 80 and kn['kit'] > 0, 'knolling: a top-down camera over a tidy 90° grid; tall things lie down (chairs on their side, walls and doors on their back); walls, doors and windows have their own sections', kn)
        # a room type whose library was never opened: its meshes arrive a few at a time, not all at once
        await gm.keyboard.press('b'); await gm.keyboard.press('Shift+R'); await gm.wait_for_timeout(200)
        hot_g = next((t.split(':')[0] for t in (await state(gm))['list'] if t.endswith(':Guest room')), None)
        await gm.keyboard.press(hot_g); await gm.wait_for_timeout(250)
        ld0 = await gm.evaluate('tw.library.loaded()'); await gm.wait_for_timeout(2500); ld1 = await gm.evaluate('tw.library.loaded()')
        check(ld0 and ld0['withUrl'] < ld0['total'] and ld1['withUrl'] > ld0['withUrl'], 'meshes load progressively: a few at a time as the PiP camera looks', [ld0, ld1])
        await gm.keyboard.press('Shift+R'); hot_c2 = next((t.split(':')[0] for t in (await state(gm))['list'] if t.endswith(':Common room')), None)
        await gm.keyboard.press(hot_c2); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        cat_id = (await gm.evaluate('tw.library.info()'))['sel']; cat = cat_id
        await wait(gm, 'tw.library.info().flown', 45000, 'still'); await gm.wait_for_timeout(800)
        src = await gm.evaluate(f"tw.library.screenOf('{cat_id}')")
        n0 = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.cat === '{cat_id}').length")
        # a drop point inside the common room that is not under the PiP window or a label
        dst = await gm.evaluate(f"""(() => {{ const f = document.getElementById('pipFrame').getBoundingClientRect(); const r = tw.entities()['{common['id']}'].recipe;
          for (let i = 1; i < 9; i++) for (let j = 1; j < 9; j++) {{ const s = tw.screenOf((r.x + r.w * i / 9) * 5, (r.z + r.d * j / 9) * 5, tw.main, 0);
            if (s.x > 60 && s.y > 90 && s.x < innerWidth - 30 && s.y < innerHeight - 30 && !(s.x > f.left - 30 && s.x < f.right + 30 && s.y > f.top - 30 && s.y < f.bottom + 30) && document.elementFromPoint(s.x, s.y)?.id === 'c') return s; }} return null; }})()""")
        await drag(gm, src, dst, steps=14, step_ms=40)
        ok = await wait(gm, f"Object.values(tw.entities()).filter(e => e.cat === '{cat_id}').length === {n0 + 1}", 8000, 'dragged out')
        if not ok: print('    (drag diag)', src, dst, await gm.evaluate("JSON.stringify({ toast: document.querySelector('#toast').textContent, mode: tw.mode && { kind: tw.mode.kind, via: tw.mode.viaDrag }, ld: tw.lastDown, pip: tw.pip?.rect, at: document.elementFromPoint(" + str(src['x']) + ", " + str(src['y']) + ")?.id })"))
        up = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.cat === '{cat_id}').pop()")
        check(ok and up and not up.get('tiltZ') and (up.get('y') or 0) < 0.05 + (5 if up.get('place') == 'wall' else 0), 'dragging a thing out of the library places it in the world, upright, by its usual placement rules', f'{cat} ({cat_id}) y={up and up.get("y")}')
        check(await gm.evaluate("tw.mode?.kind === 'room' && tw.mode.tool") and await gm.evaluate('tw.library.shown()'), 'after the drag, the room tool is back and the library stays open')
        # copy and paste: click the thing on the shelf, Ctrl+C, then Ctrl+V over the world
        await gm.mouse.click(src['x'], src['y']); await gm.wait_for_timeout(200)
        check(await gm.evaluate('tw.library.info().sel') == cat_id, 'a click in the library picks that thing')
        await gm.keyboard.press('Control+c'); await gm.wait_for_timeout(200)
        await gm.mouse.move(dst['x'] + 40, dst['y'] + 30); await gm.wait_for_timeout(100)
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(100)
        await gm.mouse.move(dst['x'] + 42, dst['y'] + 32); await gm.wait_for_timeout(100)
        await gm.keyboard.press('Control+v')
        ok = await wait(gm, f"Object.values(tw.entities()).filter(e => e.cat === '{cat_id}').length === {n0 + 2}", 8000, 'pasted')
        check(ok, 'copy on the shelf, paste in the world (the ordinary paste path)')
        await gm.screenshot(path=os.path.join(SHOTS, 'build-library.png'))

        print('PIP INPUT: the PiP takes input under the pointer; the tool waits there; gestures latch to their view')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await gm.keyboard.press('b'); await gm.keyboard.press('Shift+R'); await gm.wait_for_timeout(400)
        hot_k = next((t.split(':')[0] for t in (await state(gm))['list'] if 'Kitchen' in t), None)
        await gm.mouse.move(130, 200); await gm.keyboard.press(hot_k); await gm.wait_for_timeout(300)
        tile_cur = await gm.evaluate("getComputedStyle(document.querySelector('#buildMenu .btile')).cursor")
        check('cursors/room' in tile_cur, 'the room pointer is on the instant the room is picked, even over the tray', tile_cur[:80])
        await gm.keyboard.press('Escape')
        pr = await gm.evaluate("(() => { const r = document.getElementById('pipFrame').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + 12, l: r.left, t: r.top, w: r.width, h: r.height }; })()")
        mp = {'x': 360, 'y': 420}
        await gm.mouse.move(mp['x'], mp['y']); await gm.wait_for_timeout(150); c_main = await gm.evaluate("getComputedStyle(document.getElementById('c')).cursor")
        await gm.mouse.move(pr['x'], pr['y'], steps=4); await gm.wait_for_timeout(150); c_pip = await gm.evaluate("getComputedStyle(document.getElementById('c')).cursor"); still = await gm.evaluate("tw.mode?.kind === 'room' && tw.mode.tool")
        await gm.mouse.move(mp['x'], mp['y'], steps=4); await gm.wait_for_timeout(150); c_back = await gm.evaluate("getComputedStyle(document.getElementById('c')).cursor")
        check('cursors/room' in c_main and c_pip == 'default' and still and 'cursors/room' in c_back, 'over the PiP: the select pointer and the room tool waits; back over the main view its pointer returns', [c_main[:40], c_pip, c_back[:40]])
        cams = "JSON.stringify({ m: [tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.dist, tw.main.grab.yaw], p: [tw.pip.grab.focus.x, tw.pip.grab.focus.z, tw.pip.grab.dist, tw.pip.grab.yaw], v: tw.wheelView })"
        async def wheel_at(x, y, dx, dy, ctrl=False, alt=False, pause=0.3):
            await gm.wait_for_timeout(int(pause * 1000))
            await gm.evaluate(f"document.getElementById('c').dispatchEvent(new WheelEvent('wheel', {{ deltaX: {dx}, deltaY: {dy}, deltaMode: 0, ctrlKey: {str(ctrl).lower()}, altKey: {str(alt).lower()}, clientX: {x}, clientY: {y}, bubbles: true, cancelable: true }}))")
            return json.loads(await gm.evaluate(cams))
        c0 = json.loads(await gm.evaluate(cams))
        z1 = await wheel_at(pr['x'], pr['y'], 0, 100)
        p1 = await wheel_at(pr['x'], pr['y'], 6.5, 9.25)
        r1 = await wheel_at(pr['x'], pr['y'], 20.5, 0.5, alt=True)
        k1 = await wheel_at(pr['x'], pr['y'], 0, -12, ctrl=True)
        check(z1['v'] == 'pip' and z1['p'][2] != c0['p'][2] and z1['m'] == c0['m'] and p1['p'][:2] != z1['p'][:2] and abs(r1['p'][3] - p1['p'][3]) > 2 and k1['p'][2] < r1['p'][2] and k1['m'] == c0['m'], 'wheel, two-finger pan, Option+scroll rotate and pinch over the PiP move the PiP\'s camera, never the main view', [c0['p'], z1['p'], p1['p'], r1['p'], k1['p']])
        # latching: a wheel sequence that starts over the main view stays with it as it slides over the PiP
        a1 = await wheel_at(mp['x'], mp['y'], 3.5, 4.25, pause=0.4)
        a2 = await wheel_at(pr['x'], pr['y'], 3.5, 4.25, pause=0.03)
        check(a1['v'] == 'main' and a2['v'] == 'main' and a2['p'] == a1['p'], 'a wheel/trackpad sequence latches to the view it started in (until ~150 ms of quiet)', [a1['v'], a2['v']])
        m0 = json.loads(await gm.evaluate(cams))
        await gm.mouse.move(mp['x'], mp['y']); await gm.mouse.down(button='right')
        for i in range(1, 11): await gm.mouse.move(mp['x'] + (pr['x'] - mp['x']) * i / 10, mp['y'] + (pr['y'] - mp['y']) * i / 10); await gm.wait_for_timeout(40)
        await gm.mouse.up(button='right'); m1 = json.loads(await gm.evaluate(cams))
        check(m1['m'][:2] != m0['m'][:2] and m1['p'] == m0['p'], 'a pan that starts in the main view and slides over the PiP keeps panning the main view', [m0['m'][:2], m1['m'][:2]])
        # read-only: with something selected in the main view, Delete over the PiP does nothing
        sel_id = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'object' && !e.fromEdge)?.id")
        await gm.evaluate(f"tw.select('{sel_id}')"); await gm.mouse.move(pr['x'], pr['y']); await gm.wait_for_timeout(150)
        await gm.keyboard.press('Delete'); await gm.wait_for_timeout(400)
        check(await gm.evaluate(f"!!tw.entities()['{sel_id}']"), 'over the PiP, Delete is inert (the library is read-only; the main selection is untouched)')
        await gm.mouse.move(mp['x'], mp['y']); await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')

        await topdown(gm, 40, 30, 110, pitch=60)
        print('VIEWS: the main window always shows the area you are in; the PiP shows the library (Harry 2026-10-04 bug)')
        renders = lambda: gm.evaluate("JSON.stringify({ r: tw.lastRenders, area: tw.area(), W: document.getElementById('c').clientWidth, H: document.getElementById('c').clientHeight })")
        async def views_ok(expect_pip):
            await gm.wait_for_timeout(500)
            await gm.evaluate('tw.lastRenders = null')  # read a frame drawn AFTER the change
            fresh = await wait(gm, 'Array.isArray(tw.lastRenders) && tw.lastRenders.length > 0', 15000, 'a fresh frame')
            d = json.loads(await renders())
            d['fresh'] = fresh
            main = [r for r in d['r'] if r['view'] == 'main']; pip = [r for r in d['r'] if r['view'] == 'pip']
            ok = len(main) == 1 and main[0]['area'] == d['area'] and main[0]['viewport']['w'] == d['W'] and main[0]['viewport']['h'] == d['H'] and main[0]['viewport']['x'] == 0
            ok = ok and ((len(pip) == 1 and pip[0]['area'] == expect_pip and pip[0]['viewport']['w'] < d['W'] * 0.5) if expect_pip else not pip)
            return ok, {'main': main, 'pip': pip}
        async def main_drawn():  # the left part of the main window (never under the PiP) shows a world, not a blank
            from PIL import Image, ImageStat; import io
            await gm.evaluate("(() => { const st = document.createElement('style'); st.id = 'onlycanvas'; st.textContent = '#app > :not(#c) { visibility: hidden !important; }'; document.head.append(st); })()")  # the canvas alone: DOM labels must not count as 'drawn'
            png = await gm.screenshot(clip={'x': 120, 'y': 140, 'width': 480, 'height': 420}, timeout=120000)
            await gm.evaluate("document.getElementById('onlycanvas')?.remove()")
            return sum(ImageStat.Stat(Image.open(io.BytesIO(png)).convert('L')).stddev) > 6
        await gm.bring_to_front()
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await gm.keyboard.press('b'); await gm.keyboard.press('Shift+R'); await gm.wait_for_timeout(500)
        await gm.keyboard.press('ArrowRight'); await gm.keyboard.press('ArrowRight'); await gm.keyboard.press('Escape')
        libarea = await gm.evaluate('tw.pip?.area')
        ok1, d1 = await views_ok(libarea)
        check(ok1 and (libarea or '').startswith('lib:') and await main_drawn(), 'library open, menu navigated (another room type: its library): the main view draws the current area full-window, the PiP the library', d1)
        await gm.evaluate('tw.swapPip()'); ok2, d2 = await views_ok(libarea)
        check(ok2, 'swap with the library PiP is refused: the shelves never become the main view', d2)
        await gm.evaluate('tw.closePip()'); ok3, d3 = await views_ok(None)
        check(ok3 and await main_drawn(), 'PiP closed: the main view alone, still drawn', d3)
        a2 = await gm.evaluate("tw.createArea('Cellar', 'gm')"); await wait(gm, f"tw.sync.campaign.areas.some(a => a.id === '{a2}')", 6000, 'area 2')
        here = await gm.evaluate('tw.area()')
        await gm.evaluate(f"tw.openPip('{a2}')"); await wait(gm, f"!!tw.view('{a2}')", 8000, 'pip area view'); ok4, d4 = await views_ok(a2)
        await gm.evaluate('tw.swapPip()'); await wait(gm, f"tw.area() === '{a2}' && !!tw.view()", 8000, 'swapped')
        ok5, d5 = await views_ok(here)
        await gm.evaluate('tw.swapPip()'); await wait(gm, f"tw.area() === '{here}' && !!tw.view()", 8000, 'swapped back')
        ok6, d6 = await views_ok(a2)
        check(ok4 and ok5 and ok6 and await main_drawn(), 'a PiP of another area swaps both ways; the main view always draws the area you are in, full-window', [d4, d5, d6])
        await gm.evaluate('tw.closePip()')

        print('TRACKPAD: two-finger scroll pans, pinch zooms, Option+scroll orbits; the mouse wheel still zooms')
        async def wheel(dx, dy, mode=0, ctrl=False, alt=False, pause=0.45):
            await gm.wait_for_timeout(int(pause * 1000))
            return await gm.evaluate(f"""(() => {{ const c = document.getElementById('c'), g = tw.main.grab, b = {{ f: [g.focus.x, g.focus.z], d: g.dist, y: g.yaw, p: g.pitch }};
              c.dispatchEvent(new WheelEvent('wheel', {{ deltaX: {dx}, deltaY: {dy}, deltaMode: {mode}, ctrlKey: {str(ctrl).lower()}, altKey: {str(alt).lower()}, clientX: 500, clientY: 420, bubbles: true, cancelable: true }}));
              return {{ did: tw.wheelLog.at(-1), df: Math.hypot(g.focus.x - b.f[0], g.focus.z - b.f[1]), dd: g.dist - b.d, dy: g.yaw - b.y, dp: g.pitch - b.p, p: g.pitch, min: g.minPitch }}; }})()""")
        await topdown(gm, 40, 30, 110, pitch=55)
        m = await wheel(0, 100)
        t1 = await wheel(3.5, 7.25)
        t2 = await wheel(0, 12)
        check(m['did'] == 'zoom' and m['dd'] > 0 and m['df'] < 3 and t1['did'] == 'pan' and t1['df'] > 0.05 and abs(t1['dd']) < 1e-6 and t2['did'] == 'pan', 'a mouse notch (100, no deltaX) zooms; trackpad-like deltas (fractional, deltaX) pan, the distance unchanged', [m, t1, t2])
        ln = await wheel(0, 3, mode=1, pause=0.5)
        pz = await wheel(0, 8, ctrl=True)
        check(ln['did'] == 'zoom' and pz['did'] == 'zoom' and pz['dd'] > 0, 'line-mode wheel zooms; a pinch (ctrlKey wheel) zooms out when pinching in', [ln, pz])
        ob = await wheel(24.5, 0.5, alt=True)
        fl = await wheel(0.5, -400.5, alt=True, pause=0.05)
        check(ob['did'] == 'orbit' and abs(ob['dy']) > 1 and fl['did'] == 'orbit' and fl['p'] >= fl['min'] - 1e-6, 'Option + two-finger scroll rotates (yaw), and the pitch never drops below the floor', [ob, fl])
        # one rotate behaviour: the ground point under the pointer where the gesture began stays put on screen
        pv = await gm.evaluate("""(async () => { const c = document.getElementById('c'), g = tw.main.grab; await new Promise(r => setTimeout(r, 500));
          const a = g.groundAt(500, 420); const w = (dx, dy) => c.dispatchEvent(new WheelEvent('wheel', { deltaX: dx, deltaY: dy, deltaMode: 0, altKey: true, clientX: 500, clientY: 420, bubbles: true, cancelable: true }));
          for (let i = 0; i < 6; i++) { w(9.5, 3.25); await new Promise(r => setTimeout(r, 30)); }
          const s = tw.screenOf(a.x, a.z, tw.main, 0); return { dx: s.x - 500, dy: s.y - 420 }; })()""")
        await gm.mouse.move(520, 400); await gm.wait_for_timeout(200)
        qk = await gm.evaluate("(() => { const g = tw.main.grab; const a = g.groundAt(520, 400); return [a.x, a.z, g.yaw]; })()")
        await gm.keyboard.down('q'); await wait(gm, f"Math.abs(tw.main.grab.yaw - ({qk[2]})) > 8", 6000, 'q turns'); await gm.keyboard.up('q')
        qa = await gm.evaluate(f"(() => {{ const s = tw.screenOf({qk[0]}, {qk[1]}, tw.main, 0); return [s.x - 520, s.y - 400, tw.main.grab.yaw]; }})()")
        check(abs(pv['dx']) < 2 and abs(pv['dy']) < 2 and abs(qa[0]) < 2 and abs(qa[1]) < 2 and abs(qa[2] - qk[2]) > 5, 'every rotate pivots on the ground point under the pointer where it began (Option+scroll, Q/E), like middle-drag', [pv, qa])
        ge = await gm.evaluate("""(() => { const c = document.getElementById('c'), g = tw.main.grab, d0 = g.dist, y0 = g.yaw;
          const ev = (t, s, r) => { const e = new Event(t, { cancelable: true }); Object.assign(e, { scale: s, rotation: r, clientX: 500, clientY: 420 }); c.dispatchEvent(e); };
          ev('gesturestart', 1, 0); ev('gesturechange', 1.5, 20); ev('gestureend', 1.5, 20); return { dd: g.dist - d0, dy: g.yaw - y0 }; })()""")
        check(ge['dd'] < 0 and abs(ge['dy']) > 5, "Safari's gesture events: pinch out zooms in, two-finger rotate turns the view", ge)
        # Cmd-drag and Option-drag on empty ground (no mouse buttons needed beyond the one a trackpad has)
        await gm.keyboard.press('Escape')
        spot = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()); for (let y = 300; y < 700; y += 30) for (let x = 120; x < 600; x += 30) { if (!w.pickAll(tw.rayAt(x, y)).length && tw.groundAt(x, y) && document.elementFromPoint(x, y)?.id === 'c') return { x, y }; } return null; })()""")
        if spot:
            f0 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.yaw]')
            await gm.keyboard.down('Meta'); await drag(gm, spot, {'x': spot['x'] + 90, 'y': spot['y'] + 40}, steps=8, step_ms=60); await gm.keyboard.up('Meta')
            f1 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.yaw]')
            if abs(f1[0] - f0[0]) + abs(f1[1] - f0[1]) <= 1: print('    (cmd diag)', spot, await gm.evaluate("JSON.stringify({ ld: tw.lastDown, lp: tw.lastPress, mode: tw.mode?.kind || null, menu: tw.build.isOpen, at: document.elementFromPoint(" + str(spot['x']) + ", " + str(spot['y']) + ")?.id })"))
            check(abs(f1[0] - f0[0]) + abs(f1[1] - f0[1]) > 1 and await gm.evaluate('tw.sel.size') == 0 and await gm.evaluate("document.getElementById('marquee').hidden"), 'Cmd+drag on empty space pans (no box, nothing selected)', [f0, f1])
            spot2 = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()); for (let y = 300; y < 700; y += 30) for (let x = 120; x < 600; x += 30) { if (!w.pickAll(tw.rayAt(x, y)).length && tw.groundAt(x, y) && document.elementFromPoint(x, y)?.id === 'c') return { x, y }; } return null; })()""")
            await gm.keyboard.down('Alt'); await drag(gm, spot2, {'x': spot2['x'] + 120, 'y': spot2['y']}, steps=8, step_ms=60); await gm.keyboard.up('Alt')
            f2 = await gm.evaluate('[tw.main.grab.focus.x, tw.main.grab.focus.z, tw.main.grab.yaw]')
            check(abs(f2[2] - f1[2]) > 10, 'Option+drag on empty space rotates', [f1[2], f2[2]])
        else: check(False, 'Cmd/Option-drag (no empty spot found)')
        sheet = await gm.evaluate("(() => { tw.emit('sheet.toggle'); const t = document.getElementById('sheet').innerText; tw.emit('sheet.toggle'); return t; })()")
        check('Two-finger scroll' in sheet and 'Pinch' in sheet and 'Option' in sheet, 'the ? sheet lists the trackpad gestures')

        print('ROOM TOOL from the menu')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await gm.keyboard.press('b'); await gm.keyboard.press('Shift+R'); await gm.wait_for_timeout(200)
        s = await state(gm); hot_k = next((t.split(':')[0] for t in s['list'] if 'Kitchen' in t), None)
        await gm.keyboard.press(hot_k); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length")
        await topdown(gm, 60, 30, 150)
        await drag(gm, await scr(gm, 91, 6), await scr(gm, 109, 21), steps=10)
        ok = await wait(gm, f"Object.values(tw.entities()).filter(e => e.kind === 'room').length === {n0 + 1}", 10000, 'kitchen')
        check(ok and await gm.evaluate("Object.values(tw.entities()).some(e => e.kind === 'room' && e.recipe.type === 'kitchen' && e.recipe.x >= 18)") and await gm.evaluate("tw.mode?.kind === 'room' && tw.mode.tool"), 'the room tool from the menu draws a kitchen; the tool stays for the next one')
        await gm.keyboard.press('Escape')

        print('LAUNCHERS: Pawns (placeholder) and Settings (a shell) right of Build; trays mutually exclusive')
        await gm.bring_to_front()
        async def tap(pg, sel):  # a real mouse click at the element's centre (headless at 1-3 fps: no stability wait)
            r = await pg.evaluate(f"(() => {{ const r = document.querySelector('{sel}').getBoundingClientRect(); return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }}; }})()")
            await pg.mouse.click(r['x'], r['y'])
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        L = await gm.evaluate("""[...document.querySelectorAll('#launchers .launcher')].map(b => { const r = b.getBoundingClientRect(); return { l: b.dataset.l, x: r.left, y: r.top, w: r.width, h: r.height, img: !!b.querySelector('img.lic'), cap: b.querySelector('.lcap')?.textContent }; })""")
        ok = [x['l'] for x in L] == ['pawns', 'build', 'settings'] and all(abs(x['y'] - L[0]['y']) < 1 and abs(x['w'] - L[0]['w']) < 1 and abs(x['h'] - L[0]['h']) < 1 and x['img'] for x in L) and L[0]['x'] < L[1]['x'] < L[2]['x'] and L[1]['x'] - (L[0]['x'] + L[0]['w']) < 12
        check(ok, 'Pawns, Build, Settings sit in one row in that order (Harry 2026-10-06: Pawns furthest to the left), each immediately right of the last, the same box size, each with its painted icon', [(x['l'], round(x['x']), round(x['w'])) for x in L])
        await gm.keyboard.press('b'); await gm.wait_for_timeout(250)
        await tap(gm, ".launcher[data-l=pawns]"); await gm.wait_for_timeout(250)
        st = await gm.evaluate("({ p: !document.getElementById('pawnsTray').hidden, t: document.getElementById('pawnsTray').innerText, b: tw.build.isOpen })")
        check(st['p'] and 'PAWNS' in st['t'].upper() and 'PARTY' in st['t'].upper() and not st['b'], 'Pawns opens its tray (the Pawns menu: docs/PAWNS.md, engine/test/browser_pawnsmenu.py), and the open Build tray closes', st['t'].replace('\n', ' ')[:80])
        await tap(gm, ".launcher[data-l=settings]"); await gm.wait_for_timeout(300)
        st = await gm.evaluate("({ ...tw.settings.state(), pawns: !document.getElementById('pawnsTray').hidden, shown: !document.getElementById('settingsModal').hidden, cats: [...document.querySelectorAll('#settingsModal .scat')].map(c => c.textContent.trim()) })")
        check(st['open'] and st['shown'] and not st['pawns'] and st['sections'] == ['nav', 'me', 'area', 'defaults', 'admin', 'feedback'] and st['section'] == 'nav', 'Settings opens a modal window with its six categories on the left (World navigation first; Feedback since 2026-10-19); Pawns closes', st['cats'])
        await tap(gm, '#settingsModal .scat[data-sec=me]'); await gm.wait_for_timeout(200)
        check(await gm.evaluate("tw.settings.state().section === 'me' && !!document.querySelector('#settingsModal .myname')"), 'a category on the left switches the pane (Me: name, colour, controls…)')
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(150)
        check(await gm.evaluate("!tw.settings.state().open && document.getElementById('settingsModal').hidden"), 'Esc closes Settings')
        await tap(gm, ".launcher[data-l=settings]"); await gm.wait_for_timeout(200)
        await gm.evaluate("document.activeElement?.blur()")
        await gm.keyboard.press('b'); await gm.wait_for_timeout(250)
        check(await gm.evaluate("tw.build.isOpen && !tw.settings.state().open"), 'opening Build (B) closes Settings: one at a time')
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await pl.bring_to_front()
        await tap(pl, ".launcher[data-l=settings]"); await pl.wait_for_timeout(300)
        ps = await pl.evaluate("({ ...tw.settings.state(), vis: [...document.querySelectorAll('#launchers .launcher')].filter(b => !b.hidden).map(b => b.dataset.l) })")
        check(ps['open'] and ps['sections'] == ['nav', 'me', 'feedback'] and ps['vis'] == ['pawns', 'settings'], 'a player sees Pawns and Settings (no Build); their Settings has only World navigation, Me and Feedback', ps)
        await pl.keyboard.press('Escape')
        await gm.bring_to_front()

        print('YARD')  # outdoors (2026-10-05): Genre → Tavern & inn → Yard; its library area; a yard spawned in the game builds no walls
        yn = await gm.evaluate("(() => { const n = tw.taxonomy.get('r:TAV:yard'); return n && { label: n.label, parent: tw.taxonomy.get(n.parent)?.label, hot: n.hot, furniture: n.furniture.filter(f => !f.kit).map(f => f.cat), cells: n.cells }; })()")
        check(yn and yn['label'] == 'Yard' and yn['parent'] == 'Tavern & inn' and all(k in yn['furniture'] for k in ('well', 'woodpile', 'sign-hanging', 'hitching-post', 'rain-barrel', 'lantern-post')), 'Build menu: Fantasy → Tavern & inn → Yard, with the yard\'s things for its library area', yn and {**yn, 'furniture': len(yn['furniture'])})
        ys = await gm.evaluate("""(async () => {
          const rg = tw.roomgen, rooms = Object.values(tw.entities()).filter(e => e.kind === 'room');
          const x = Math.max(0, ...rooms.map(e => e.recipe.x + e.recipe.w)) + 3, z = 2;   // open ground east of everything
          const id = tw.spawnRoom('yard', x, z, 6, 5, 4242);
          for (let i = 0; i < 100 && !tw.entities()[id]; i++) await new Promise(r => setTimeout(r, 100));
          const yard = tw.entities()[id]; if (!yard) return { err: 'no yard room' };
          await new Promise(r => setTimeout(r, 3000));
          const E = rg.edges(tw.entities()), w = tw.worldOf(tw.area());
          const shell = [...w.shell.values()].filter(it => it.roomId === id || it.spec?.roomId === id);
          const layer = (it) => it.spec?.layer || it.layer;
          return { id, objects: Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === id).length, open: E.open.get(id).length,
            walls: shell.filter(it => layer(it) === 'walls' || layer(it) === 'openings').length, floor: shell.filter(it => layer(it) === 'floor' && !it.spec.soft).length, ground: rg.floorFor(yard.recipe) };
        })()""")
        check(ys.get('objects', 0) >= 2 and ys.get('walls') == 0 and ys.get('floor') == 30 and ys.get('open') == 22 and str(ys.get('ground', '')).startswith('floor-'), 'a yard spawned in the game: ground tiles, things, and no walls of its own', ys)

        print('CRYPT')  # 2026-10-05: Fantasy -> Crypt & tomb -> seven rooms, each with a painted icon and a library area
        cn = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:CRY'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(cn and not cn['disabled'] and len(cn['rooms']) == n_rooms('CRY') > 0 and all(r['things'] >= 6 and r['hot'] for r in cn['rooms']), f"Build menu: Fantasy -> Crypt & tomb -> {n_rooms('CRY')} rooms (as the type data)," ' each with things for its library area and a hotkey', cn)
        inn = await gm.evaluate("tw.taxonomy.get('t:TAV').children.map(id => tw.taxonomy.get(id).roomKey)")
        check(not any(k.startswith(('crypt-', 'mansion-', 'castle-')) or k in ('chapel', 'dungeon', 'barracks') for k in inn), 'no crypt, castle or mansion room is listed under Tavern & inn', inn)

        print('LAIR')  # type:lai 2026-10-11: Fantasy -> Monster lair -> ten rooms, each with an icon and a library area
        la = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:LAI'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        LAI_KEYS = ['lair-mouth', 'lair-passage', 'lair-warren', 'lair-beast', 'lair-spider', 'lair-larder', 'lair-pit', 'lair-hatchery', 'lair-trophy', 'lair-dragon']
        check(la and not la['disabled'] and all(any(r['key'] == k and r['things'] >= 3 for r in la['rooms']) for k in LAI_KEYS), 'Build menu: Fantasy -> Monster lair -> the 10 lair rooms, each with things for its library area', la)  # type:lai
        print('CASTLE')  # 2026-10-06: Fantasy -> Castle -> nine rooms, each with a painted icon and a library area
        cs = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:CAS'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(cs and not cs['disabled'] and len(cs['rooms']) == n_rooms('CAS') > 0 and all(r['things'] >= 6 and r['hot'] for r in cs['rooms']), f"Build menu: Fantasy -> Castle -> {n_rooms('CAS')} rooms (as the type data)," ' each with things for its library area and a hotkey', cs)
        print('MANSION')  # 2026-10-06: Fantasy -> Mansion (code NOB) -> ten rooms, each with a painted icon and a library area
        mn = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:NOB'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(mn and not mn['disabled'] and len(mn['rooms']) == n_rooms('NOB') > 0 and all(r['things'] >= 6 and r['hot'] for r in mn['rooms']), f"Build menu: Fantasy -> Mansion -> {n_rooms('NOB')} rooms (as the type data)," ' each with things for its library area and a hotkey', mn)
        print('TEMPLE')  # 2026-10-11: Fantasy -> Temple & chapel (code TEM) -> ten rooms, each with a painted icon and a library area
        tm = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:TEM'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(tm and not tm['disabled'] and len(tm['rooms']) == n_rooms('TEM') > 0 and all(r['things'] >= 4 for r in tm['rooms']), f"Build menu: Fantasy -> Temple & chapel -> {n_rooms('TEM')} rooms (as the type data)," ' each with things for its library area', tm)
        print('DUNGEON')  # type:dun 2026-10-11: Fantasy -> Dungeon & prison -> fourteen rooms (plus the castle's rooms that carry dun- recipes), each with a library area
        dn = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:DUN'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        DUN_KEYS = ['dun-corridor', 'dun-trap-corridor', 'dun-dead-end', 'dun-cell-block', 'dun-guard-room', 'dun-interrogation', 'dun-vault', 'dun-sewer', 'dun-puzzle-hall', 'dun-chasm', 'dun-den', 'dun-shrine', 'dun-flooded', 'dun-collapsed']
        check(dn and not dn['disabled'] and all(any(r['key'] == k and r['things'] >= 5 for r in dn['rooms']) for k in DUN_KEYS), 'Build menu: Fantasy -> Dungeon & prison -> the 14 dungeon rooms, each with things for its library area', dn)
        print('WIZARD')  # 2026-10-11: Fantasy -> Wizard's tower (code ARC) -> eleven rooms, each with a painted icon and a library area
        wz = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:ARC'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(wz and not wz['disabled'] and len(wz['rooms']) == 11 and all(r['things'] >= 6 and r['hot'] for r in wz['rooms']), "Build menu: Fantasy -> Wizard's tower -> 11 rooms, each with things for its library area and a hotkey", wz)
        print('MARKET')  # 2026-10-12: Fantasy -> Market & village (code MKT) -> twelve rooms
        mk = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:MKT'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(mk and not mk['disabled'] and len(mk['rooms']) == 12 and all(r['things'] >= 6 and r['hot'] for r in mk['rooms']), 'Build menu: Fantasy -> Market & village -> 12 rooms, each with things for its library area and a hotkey', mk)
        print('MINE')  # type:min 2026-10-11: Fantasy -> Mine -> thirteen rooms, each with a library area
        mi = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:MIN'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        MIN_KEYS = ['min-tunnel', 'min-junction', 'min-face', 'min-collapsed', 'min-flooded', 'min-shaft-head', 'min-sorting', 'min-tool-store', 'min-mess', 'min-powder-store', 'min-seam', 'min-pithead', 'min-smelter']
        check(mi and not mi['disabled'] and all(any(r['key'] == k and r['things'] >= 5 for r in mi['rooms']) for k in MIN_KEYS), 'Build menu: Fantasy -> Mine -> the 13 mine rooms, each with things for its library area', mi)
        print('CULT')  # 2026-10-11: Fantasy -> Cult sanctum -> nine rooms, each with a painted icon and a library area
        cu = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:CLT'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(cu and not cu['disabled'] and len(cu['rooms']) == 9 and all(r['things'] >= 6 and r['hot'] for r in cu['rooms']), 'Build menu: Fantasy -> Cult sanctum -> 9 rooms, each with things for its library area and a hotkey', cu)
        print('FARMSTEAD')  # type:hut 2026-10-11: Fantasy -> Farmstead (code HUT) -> sixteen rooms, each with an icon and a library area
        ht = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:HUT'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        HUT_KEYS = ['hut-cottage', 'hut-kitchen', 'hut-bedroom', 'hut-loft', 'hut-passage', 'hut-cellar', 'hut-byre', 'hut-coop', 'hut-pigsty', 'hut-barn', 'hut-granary', 'hut-dairy', 'hut-garden', 'hut-field', 'hut-orchard', 'hut-farmyard']
        check(ht and not ht['disabled'] and all(any(r['key'] == k and r['things'] >= 5 for r in ht['rooms']) for k in HUT_KEYS), 'Build menu: Fantasy -> Farmstead -> the 16 farm rooms, each with things for its library area', ht)
        print('SMITHY')  # 2026-10-11: Fantasy -> Smithy & workshop (code SMI) -> nine rooms
        sm = await gm.evaluate("(() => { const t = tw.taxonomy.get('t:SMI'); return t && { disabled: !!t.disabled, rooms: t.children.map(id => tw.taxonomy.get(id)).map(n => ({ key: n.roomKey, label: n.label, hot: n.hot, things: n.furniture.filter(f => !f.kit).length })) }; })()")
        check(sm and not sm['disabled'] and len(sm['rooms']) == 9 and all(r['things'] >= 6 and r['hot'] for r in sm['rooms']), 'Build menu: Fantasy -> Smithy & workshop -> 9 rooms, each with things for its library area and a hotkey', sm)
        print('ICONS')
        miss = await gm.evaluate("""(async () => { const out = []; for (const n of tw.taxonomy.nodes.values()) { if (!['genre', 'type', 'room'].includes(n.level)) continue;
          const key = n.level === 'genre' ? 'genre-' + n.key : n.level === 'type' ? 'type-' + n.code : 'room-' + n.roomKey; const r = await fetch('data/icons/' + key + '.png', { method: 'HEAD' }); if (!r.ok) out.push(key); } return out; })()""")
        check(not miss, 'every genre, type and room has its icon', miss[:6])
        miss = await gm.evaluate("(async () => { const out = []; for (const k of ['tool-build', 'tool-pawns', 'tool-settings']) { const r = await fetch('data/icons/' + k + '.png', { method: 'HEAD' }); if (!r.ok) out.push(k); } return out; })()")
        check(not miss, 'the three launcher icons (hammer and saw, pawn, gear) are there', miss)
        real = [e for e in errors if not any(s in e for s in ('WebSocket', 'ERR_CONNECTION', '502', 'Refused:')) and not (A.local and 'Failed to load resource' in e)]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'browser build: {passed}/{len(results)} passed')
    return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for p in procs:
        try: p.terminate()
        except Exception: pass
sys.exit(0 if ok else 1)
