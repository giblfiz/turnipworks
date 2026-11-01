#!/usr/bin/env python3
"""The area's ground (Harry 2026-10-22: "Can we allow simple tiling for the whole outdoor world? Like if I just want to
drag grass onto everything?"): one floor material over all the open ground of an area (core area.ground,
client/groundcover.js), under the rooms; set from the bar ("ground grass"), Settings ▸ Area ▸ Ground, or by dragging a
floor onto open ground and pressing its offer "Cover all open ground with …". One undo; every seat sees it; cheap (one
plane, a few instanced decal meshes); the ground's holes over a shown cellar stay open.

  local:  python3 engine/test/browser_groundcover.py --local
  live:   ... browser_groundcover.py --page http://127.0.0.1:8180/
  --shots: also the play-distance stills for a vision read (engine/test/shots/ground-*.png), with the lighting stack on
"""
import argparse, asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18413,18743').split(','))
POST = '' if A.shots else '&nopost'
def start_local():
    data = tempfile.mkdtemp(prefix='tw-ground-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + f'&api={POST}&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=60); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def view(pg, x, z, dist=70, pitch=62, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def bar_text(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(400)
async def bar_rows(pg):
    return await pg.evaluate("[...document.querySelectorAll('#results .res')].map(el => el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 80))")
async def output(pg, contains=''):
    await wait(pg, f"!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('{contains}')", 10000, 'output panel')
    v = await pg.evaluate("document.querySelector('#output textarea').value"); await pg.keyboard.press('Escape'); return v
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
TILES = "Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place === 'tile')"
GROUND = "(tw.sync.view(tw.area())?.ground || null)"
INFO = "tw.worldOf(tw.area()).groundCover.info()"
DRAWN = lambda cat: f"(() => {{ const i = {INFO}; return i.cat === {cat!r} && i.material === {cat!r}; }})()" if cat else f"({INFO}).material === 'bare'"
C = lambda g: g * 5 + 2.5

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + f'faces=1500{POST}'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' or 'ground cover' in m.text else None)
            await pg.goto(url); return pg
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST ground ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        R1 = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 4242)")
        YD = await gm.evaluate("tw.spawnRoom('yard', 0, 4, 6, 4, 515)")
        CEL = await gm.evaluate("tw.spawnRoom('cellar', 10, 0, 3, 3, 77, undefined, -10)")
        await wait(gm, f"!!tw.entities()['{R1}'] && !!tw.entities()['{YD}'] && !!tw.entities()['{CEL}']", 10000, 'rooms')
        await gm.wait_for_timeout(6000)  # the spawn choreography
        check(await gm.evaluate(f"{GROUND} === null && {DRAWN(None)}"), "a new area's open ground is bare, as before (today's look is the default)")
        bare_mat = await gm.evaluate("(() => { const m = tw.worldOf(tw.area()).ground.material; return [m.color.getHexString(), !!m.map]; })()")
        check(bare_mat == ['2b2e25', False], 'the bare ground is the original dark plane, untouched', bare_mat)

        # a player, to see it arrive
        await bar_text(gm, 'invite Brakka'); await gm.keyboard.press('Enter')
        invite = (await output(gm, '#s=')).strip().split()[-1]
        pl = await tab(invite)
        ok_pl = await wait(pl, 'window.tw && tw.ready && tw.ready()', 30000, 'player ready')
        check(ok_pl, 'a player seat joined from the invite link')
        await gm.bring_to_front()

        print('BAR: "ground grass"')
        await view(gm, 15, 20, 90, 62)
        await bar_text(gm, 'ground grass')
        rows = await bar_rows(gm)
        check(any('Cover all open ground with grass' in r for r in rows[:3]), '"ground grass" in the bar offers "Cover all open ground with grass" near the top', rows[:4])
        await bar_text(gm, 'cover ground with cobble')
        rows2 = await bar_rows(gm)
        check(any('Cover all open ground with cobble' in r for r in rows2[:3]), '"cover ground with cobble" finds it too', rows2[:4])
        await bar_text(gm, 'ground grass')
        seq0 = await gm.evaluate('tw.seq()')
        await gm.keyboard.press('Enter')  # the top row (as Harry would)
        ok = await wait(gm, f"{GROUND} === 'floor-grass'", 8000, 'ground set')
        await wait(gm, f"tw.seq() > {seq0}", 4000)
        check(ok and await gm.evaluate('tw.seq()') == seq0 + 1, 'picking it sets the area\'s ground: ONE command in the log', [seq0, await gm.evaluate('tw.seq()')])
        ok = await wait(gm, DRAWN('floor-grass'), 15000, 'drawn')
        if not ok: print('   ', errors[-5:])
        info = await gm.evaluate(INFO)
        nd = await gm.evaluate("(() => { let n = 0; tw.worldOf(tw.area()).scene.traverse(o => { if (o.isInstancedMesh || o.name === 'groundDecals') n++; }); return n; })()")
        check(ok and nd == 0, 'the ground plane wears grass: the one calm base, no scatter over the field (blind reads 2026-10-21: tufts read as confetti there)', [info, nd])
        g = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), m = w.ground.material, uv = w.ground.geometry.getAttribute('uv'), pos = w.ground.geometry.getAttribute('position'); let ok = true; for (let i = 0; i < pos.count; i++) if (Math.abs(uv.getX(i) - pos.getX(i) / 5) > 1e-6 || Math.abs(uv.getY(i) - pos.getY(i) / 5) > 1e-6) ok = false; return { wrap: m.map.wrapS === 1000 && m.map.wrapT === 1000, uvOk: ok, verts: pos.count, ents: Object.keys(tw.entities()).length }; })()")
        check(g['wrap'] and g['uvOk'] and g['verts'] <= 600, 'one plane with world UVs (one repeat per 5-ft square, on the grid), no tile entities added', g)
        same = await gm.evaluate("(() => { const look = tw.assets.look, sp = tw.tiles.tileSpecs(look, 'floor-grass', 2.5, 2.5)[0]; return [sp.url, tw.worldOf(tw.area()).groundCover.picture?.url || null, sp.rot]; })()")
        check(same[0] == same[1] and same[2] == 0, 'the ground lays the same calm base picture a grass tile or a yard lays, straight', same)
        if ok_pl:
            check(await wait(pl, f"{GROUND} === 'floor-grass'", 8000) and await wait(pl, DRAWN('floor-grass'), 15000), 'the player seat sees the grass ground too')
        check(await gm.evaluate(f"tw.entities()['{R1}'].recipe.floor") in ('auto', None), 'rooms keep their own floors (nothing written to them)')

        print('UNDO / REDO')
        await gm.evaluate('tw.undo()'); ok = await wait(gm, f"{GROUND} === null", 6000)
        check(ok and await wait(gm, DRAWN(None), 6000), 'Ctrl/⌘+Z: the bare ground is back')
        if ok_pl: check(await wait(pl, DRAWN(None), 8000), 'and on the player\'s screen')
        await gm.keyboard.press('Control+Shift+z'); ok = await wait(gm, f"{GROUND} === 'floor-grass'", 6000)
        check(ok, 'redo brings the grass back', await gm.evaluate(GROUND))

        print('PATTERNED: a 4 × 4-square layout continues')
        await gm.evaluate("tw.setGround('floor-flagstone-large')")
        ok = await wait(gm, DRAWN('floor-flagstone-large'), 15000)
        pic = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), m = w.ground.material.map; return { grid: w.groundCover.picture?.grid || 0, rep: [m.repeat.x, m.repeat.y], w: m.image?.width || 0 }; })()")
        check(ok and pic['grid'] == 4 and abs(pic['rep'][0] - 0.25) < 1e-6 and pic['w'] >= 1024, 'a gIJ floor (large flagstones) is put together once into one 4 × 4 picture, repeating every 20 ft as across a room', pic)
        await gm.evaluate("tw.undo()"); await wait(gm, f"{GROUND} === 'floor-grass'", 6000)

        print('SETTINGS: Area ▸ Ground')
        await gm.keyboard.press('s'); await wait(gm, "tw.settings.isOpen", 4000)
        await gm.evaluate("tw.settings.show('area')"); await gm.wait_for_timeout(400)
        cur = await gm.evaluate("document.querySelector('#settingsModal [data-ground]')?.value ?? null")
        check(cur == 'floor-grass', 'Settings ▸ Area settings has an "Open ground" row showing grass', cur)
        await gm.select_option('#settingsModal [data-ground]', 'floor-cobble')
        ok = await wait(gm, f"{GROUND} === 'floor-cobble'", 6000)
        check(ok, 'choosing cobble there covers the ground with cobble')
        await gm.select_option('#settingsModal [data-ground]', '')
        ok = await wait(gm, f"{GROUND} === null", 6000)
        check(ok, 'and "Bare" takes the material away')
        await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        if await gm.evaluate("tw.settings.isOpen"): await gm.evaluate("tw.settings.close()")

        print('DRAG: a floor dropped on open ground offers to cover all of it')
        async def floor_row(text):
            await bar_text(gm, text)
            return await gm.evaluate("(() => { for (const el of document.querySelectorAll('#results .res')) { if (!el.querySelector('[data-pv]')) continue; if (!/floor/i.test(el.textContent)) continue; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent.trim().slice(0, 60) }; } return null; })()")
        async def drag_floor(text, x, z, y=0):
            src = await floor_row(text); assert src, f'no floor row for {text}'
            dst = await scr(gm, x, z, y)
            await gm.mouse.move(src['x'], src['y']); await gm.mouse.down()
            for i in range(1, 13): await gm.mouse.move(src['x'] + (dst['x'] - src['x']) * i / 12, src['y'] + (dst['y'] - src['y']) * i / 12); await gm.wait_for_timeout(20)
            await gm.wait_for_timeout(250); await gm.mouse.up(); await gm.wait_for_timeout(500)
            return src
        OFFER = "(tw.condButtons.list().find(b => b.key === 'ground-cover') || null)"
        await view(gm, 15, 20, 90, 62)
        seq0 = await gm.evaluate('tw.seq()')
        src = await drag_floor('grass floor', C(8), C(2))
        ok = await wait(gm, f"{TILES}.length === 1", 6000, 'tile laid')
        if not ok: await gm.screenshot(path=os.path.join(SHOTS, 'ground-drop-fail.png'))
        check(ok and await gm.evaluate(f"{TILES}[0].cat") == 'floor-grass', 'dropped on open ground it lays one grass tile, as before', src)
        ok = await wait(gm, f"!!{OFFER}", 5000, 'offer')
        o = await gm.evaluate(OFFER)
        check(ok and o['text'] == 'Cover all open ground with grass', 'a conditional button by the drop offers "Cover all open ground with grass"', o)
        await gm.wait_for_timeout(300); o = await gm.evaluate(OFFER)
        check(o and o['visible'], 'it stands beside the drop, on screen (it never blocks: the tile is already laid)', o)
        if A.shots: await gm.screenshot(path=os.path.join(SHOTS, 'ground-offer.png'))
        await gm.evaluate("tw.condButtons.get('ground-cover').el.click()")
        ok = await wait(gm, f"{GROUND} === 'floor-grass' && {TILES}.length === 0", 8000, 'covered')
        check(ok, 'pressing it covers all open ground with grass, and the one tile is taken back (it would only sit on the grass)', [await gm.evaluate(GROUND), await gm.evaluate(f"{TILES}.length")])
        await gm.wait_for_timeout(500)
        await gm.evaluate('tw.undo()')
        ok = await wait(gm, f"{GROUND} === null && {TILES}.length === 0", 8000, 'one undo')
        check(ok, 'ONE undo after the offer: the bare ground, and no tile, exactly as before the drag', [await gm.evaluate(GROUND), await gm.evaluate(f"{TILES}.length")])
        # no offer on a room, nor when the ground already is that material
        await gm.evaluate("tw.setGround('floor-grass')"); await wait(gm, f"{GROUND} === 'floor-grass'", 6000)
        await gm.evaluate("tw.condButtons.hide('ground-cover')")
        await drag_floor('grass floor', C(8), C(5))
        await wait(gm, f"{TILES}.length === 1", 6000)
        await gm.wait_for_timeout(800)
        check(not await gm.evaluate(OFFER), 'the ground already grass: the drop is one tile and no offer')
        await gm.evaluate('tw.undo()'); await wait(gm, f"{TILES}.length === 0", 6000)
        await drag_floor('cobble floor', C(2), C(1))
        await gm.wait_for_timeout(1000)
        check(not await gm.evaluate(OFFER) and await gm.evaluate(f"tw.entities()['{R1}'].recipe.floor") == 'floor-cobble', 'onto a room: the whole room floor changes (as before), no ground offer', await gm.evaluate(f"tw.entities()['{R1}'].recipe.floor"))
        await gm.evaluate('tw.undo()'); await wait(gm, f"tw.entities()['{R1}'].recipe.floor !== 'floor-cobble'", 6000)
        if ok_pl:
            await pl.bring_to_front()
            await pl.evaluate("tw.modes.place(tw.assets.catById.get('floor-grass'), { viaDrag: true })")
            n = await pl.evaluate("tw.floorDrop.groundOffer(null, tw.assets.catById.get('floor-cobble'), { x: 40, z: 40, y: 0, room: null })")
            await pl.evaluate("tw.modes.cancel()")
            check(n is False, 'a player is never offered it (the ground is the GM side\'s)', n)
            await gm.bring_to_front()

        print('THE CUT: the ground opens over a shown cellar, grass and all')
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{CEL}'], 'test')"); await gm.wait_for_timeout(1500)
        h = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), open = w.groundOpenCells, c = tw.entities()['{CEL}'].recipe; let inside = 0; for (let i = 0; i < c.w; i++) for (let j = 0; j < c.d; j++) if (open.has((c.x + i) + ':' + (c.z + j))) inside++; return {{ inside, cells: c.w * c.d, mat: ({INFO}).material, verts: w.ground.geometry.getAttribute('position').count }}; }})()")
        check(h['inside'] == h['cells'] and h['mat'] == 'floor-grass' and h['verts'] > 6, "cut into the cellar: the grass plane opens over every square of it (the cellar shows), still one mesh", h)
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(800)
        check(await gm.evaluate(DRAWN('floor-grass')), 'cut off: the grass is whole again')

        print('A ROUND PIT in the grass: round, not a square void')
        await gm.bring_to_front(); await view(gm, 40, 40, 45, 60)
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('hole-round'))"); await gm.wait_for_timeout(200)
        await gm.evaluate("tw.registry.run('hole.size', { d: 10 })"); await gm.wait_for_timeout(300)
        pt = await scr(gm, 40, 40); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(200); await gm.mouse.click(pt['x'], pt['y'])
        await wait(gm, "Object.values(tw.entities()).some(e => e.cat === 'hole-round')", 6000, 'pit'); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(800)
        pit = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), P = w.scene.getObjectByName('groundHolePatches'), h = Object.values(tw.entities()).find(e => e.cat === 'hole-round'); return { at: h && [h.x, h.z, h.dims[0]], patches: w.groundCover.patches(), clip: P ? P.children.every(m => (m.userData.holeClip?.length ?? m.userData.holeClip) === 1 && m.material.map === w.ground.material.map) : false, open: [...w.groundOpenCells].sort() }; })()")
        check(pit['patches'] == 4 and pit['clip'], 'a 10-ft round pit on open grass: its four squares are cut from the plane and the grass is put back round the circle (clipped, same picture)', pit)
        if A.shots: await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(SHOTS, 'ground-pit.png'))
        await gm.evaluate('tw.undo()'); await wait(gm, "!Object.values(tw.entities()).some(e => e.cat === 'hole-round')", 6000)
        await gm.wait_for_timeout(500)
        check(await gm.evaluate("tw.worldOf(tw.area()).groundCover.patches()") == 0, 'undo: the pit and its patches go, the grass is whole')

        print('FOG OF WAR: the player sees the grass, the war fog lies over it')
        if ok_pl:
            await gm.evaluate("tw.sync.submit('area.set', { area: tw.area(), settings: { fogOfWar: true } })")
            await gm.evaluate("tw.batch([{ type: 'token.create', args: { id: 'tok_brakka0001', name: 'Brakka', x: 17.5, z: 27.5, owner: tw.sync.campaign.seats.find(s => s.name === 'Brakka').id } }])")
            await pl.bring_to_front(); await wait(pl, "!!tw.entities()['tok_brakka0001']", 8000)
            await pl.wait_for_timeout(2500)
            fog = await pl.evaluate(f"({{ active: !!tw.fog?.active?.(tw.area()), drawn: {DRAWN('floor-grass')} }})")
            check(fog['active'] and fog['drawn'], 'with fog of war on, the player\'s ground still wears grass (the fog pass lies over it)', fog)
            await view(pl, 17.5, 27.5, 70, 62)
            await pl.wait_for_timeout(1500)
            await pl.screenshot(path=os.path.join(SHOTS, 'ground-fog-player.png'))
            await gm.evaluate("tw.sync.submit('area.set', { area: tw.area(), settings: { darkness: true } })")
            await wait(pl, "tw.areaRule('darkness') === true", 8000, 'darkness'); await pl.wait_for_timeout(3000)
            check(await pl.evaluate(DRAWN('floor-grass')), 'darkness on: still the one grass plane under it (the dark is the fog pass)')
            await pl.screenshot(path=os.path.join(SHOTS, 'ground-dark-player.png'))
            await gm.evaluate("tw.sync.submit('area.set', { area: tw.area(), settings: { darkness: null, fogOfWar: null } })")
            await gm.bring_to_front()

        print('COST')
        await view(gm, 15, 20, 260, 55); await gm.wait_for_timeout(1200)
        cost = await gm.evaluate("(async () => { const w = tw.worldOf(tw.area()), t0 = performance.now(); let n = 0, meshes = 0; await new Promise(r => { const f = () => { if (++n < 60) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); w.scene.traverse(o => { if (o.isMesh && o.material === w.ground.material) meshes++; }); return { ms: Math.round((performance.now() - t0) / 60 * 10) / 10, groundMeshes: meshes, size: w.ground.geometry.boundingSphere ? Math.round(w.ground.geometry.boundingSphere.radius) : null }; })()")
        check(cost['groundMeshes'] == 1, 'zoomed far out over the whole field: the ground is ONE mesh wearing the material', cost)

        if A.shots:
            for name, (x, z, d, pitch, yaw) in {'play': (15, 22, 70, 62, 0), 'wide': (15, 20, 180, 50, 30), 'low': (20, 35, 40, 30, 20)}.items():
                await view(gm, x, z, d, pitch, yaw); await gm.wait_for_timeout(2500)
                await gm.screenshot(path=os.path.join(SHOTS, f'ground-grass-{name}.png'))
            await gm.evaluate("tw.setGround('floor-cobble')"); await wait(gm, DRAWN('floor-cobble'), 15000)
            await view(gm, 15, 22, 70, 62, 0); await gm.wait_for_timeout(2500); await gm.screenshot(path=os.path.join(SHOTS, 'ground-cobble-play.png'))
            await gm.evaluate("tw.setGround(null)"); await wait(gm, DRAWN(None), 15000)
            await view(gm, 15, 22, 70, 62, 0); await gm.wait_for_timeout(2500); await gm.screenshot(path=os.path.join(SHOTS, 'ground-bare-play.png'))

        real = [e for e in errors if 'favicon' not in e and '404' not in e]
        check(not real, 'no page errors', real[:3])
        await browser.close()
    for pr in procs: pr.terminate()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
    sys.exit(1 if bad else 0)

asyncio.run(main())
