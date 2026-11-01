#!/usr/bin/env python3
"""Hills (2026-10-24; Harry: "a way to raise some earth, maybe by default with grass on it. Could be a room type out in
nature, but get things one story up"). docs/VERTICAL.md "Terrain: computed banks" (Built: "Hills"). A HILL is a room
of a terrain type, drawn like a room: outdoor, grass on top, its top one storey up (10 ft); the engine lays the banks
(core/terrain.js, client/terrain.js) with Harry's house settings and dresses them with the generated rock.

What this drives, in a real browser, as a GM and a player would:
  findable     the bar ("hill", "mound", "raise ground", "terrace", "rise", "knoll", "plateau"; "hill 20 ft") and the
               Build tray (beside the Yard, under the inn and three other types)
  drawing      the room tool drags a hill: 10 ft up, no building, grass; on a hill it makes a higher terrace (20 ft);
               "hill 20 ft" draws 20 ft hills; two hills side by side at different heights (whole storeys only since
               2026-10-26: Harry, "5-foot hills can be done as objects, sort of like tables")
  banks        worked out and drawn: one bank mesh per cluster, the generated boulders and library bushes on it; the
               top level to its edge; a terrace on a terrace; rock sides
  standing     a pawn dragged onto the hill stands on its top (10 ft); a thing put on it stands there and is the hill's
  height       Raise 10 ft / Lower 10 ft / 20 ft from the hill's menu (pawns on it ride along), one undo each
  the cut      at lv 1 the hill and the pawn on it still show (a hill is ground); the fog's level stays the ground's
  sight        with fog of war on, a player's pawn on the ground sees the hill top beside it, and from the top the ground
  sync         a player's tab gets the hill and draws its banks; a reload keeps it all
  errors       no page errors anywhere

  local:  python3 engine/test/browser_hills.py --local
  live:   ... browser_hills.py --page http://127.0.0.1:8180/
  --shots DIR   also save play-distance pictures (the lighting stack on) for a vision read
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18517,18847').split(','))
POST = '' if A.shots else '&nopost'
def start_local():
    data = tempfile.mkdtemp(prefix='tw-hills-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)  # (the page is this checkout's, not a stale server's: test/served.py)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + f'&api={POST}&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def view(pg, x, z, dist=70, pitch=62, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(300)
async def bar_text(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(450)
async def bar_refs(pg, k=3):
    return await pg.evaluate(f"[...document.querySelectorAll('#results .res')].slice(0, {k}).map(el => el.dataset.ref || el.getAttribute('data-ref') || '')")
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def drag(pg, a, b, steps=10):
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move(a['x'] + 6, a['y'] + 4, steps=2); await pg.mouse.move(b['x'], b['y'], steps=steps); await pg.wait_for_timeout(250); await pg.mouse.up()
    await pg.wait_for_timeout(500)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
W = "tw.worldOf(tw.area())"
INFO = f"{W}.terrain.info()"
# (2026-10-27) the bank's shape, for "nothing changed": its triangles, a hash of every field height, the rocks and bushes
BANKINFO = "(async () => { const w = tw.worldOf(tw.area()); await w.terrain.ready; await new Promise(r => setTimeout(r, 50)); await w.terrain.ready; const i = w.terrain.info(); let h = 7; for (const f of w.terrainField.fields) for (let k = 0; k < f.h.length; k++) h = (Math.imul(h, 31) + Math.round(f.h[k] * 1000)) >>> 0; return { tris: i.triangles, rocks: i.rocks, bushes: i.bushes, h }; })()"
# the hill's look below the ground: its top's tiles drawn, and every material of the top, the bank and the dressing (n, solid, opacity, depth written)
SEE = """(hid) => { const w = tw.worldOf(tw.area()); w.cutPass?.(); w.hillSeePass?.(); const ms = (objs) => { const out = []; for (const v of objs) v?.traverse?.(o => { if (o.isMesh) for (const m of [].concat(o.material)) out.push(m); }); return out; };
  const sum = (L) => ({ n: L.length, solid: L.filter(m => !m.transparent).length, maxOp: L.length ? +Math.max(...L.map(m => m.transparent ? m.opacity : 1)).toFixed(3) : null, minOp: L.length ? +Math.min(...L.map(m => m.transparent ? m.opacity : 1)).toFixed(3) : null, dw: L.filter(m => m.depthWrite).length });
  const tiles = [...w.shell.values()].filter(s => s.roomId === hid && s.spec.layer === 'floor'), g = w.terrain.group, bank = [], dress = []; g.traverse(o => { if (o.userData.terrainBank) bank.push(o); else if (o.userData.terrainDress) dress.push(o); });
  return { see: w.hillSeeNow(), tiles: tiles.length, tilesShown: tiles.filter(s => s.group.visible).length, tile: sum(ms(tiles.map(s => s.visual))), group: g.visible, bank: sum(ms(bank)), dress: sum(ms(dress)) }; }"""
HILLS = "Object.values(tw.entities()).filter(e => e.kind === 'room' && e.recipe.type === 'hill')"
TREADY = f"(async () => {{ await {W}.terrain.ready; return {INFO}; }})()"
C = lambda g: g * 5 + 2.5

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + f'faces=1500{POST}'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' or 'terrain' in m.text else None)
            await pg.goto(url); return pg
        async def shot(pg, name):
            if not A.shots: return
            await pg.wait_for_timeout(1500); await pg.screenshot(path=os.path.join(A.shots, f'{name}.png')); print(f'    shot {name}.png')
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST hills ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        await gm.evaluate("tw.dispatch('area.ground', { cat: 'floor-grass' })"); await gm.wait_for_timeout(600)

        print('FINDABLE: the bar and the Build tray')
        for q in ['hill', 'mound', 'raise ground', 'terrace', 'rise', 'knoll', 'plateau']:
            await bar_text(gm, q); refs = await bar_refs(gm)
            check('cmd:build.hill' in refs, f'bar "{q}": Build hill is in the top three', refs)
        await gm.keyboard.press('Escape')
        tray = await gm.evaluate("[...tw.taxonomy.nodes.values()].filter(n => n.level === 'room' && n.roomKey === 'hill').map(n => n.parent)")
        check('t:TAV' in tray and len(tray) >= 3, 'the Build tray lists the Hill (beside the Yard under the inn, and in other types)', tray)
        yard_sib = await gm.evaluate("tw.taxonomy.get('t:TAV').children.includes('r:TAV:hill') && tw.taxonomy.get('t:TAV').children.includes('r:TAV:yard')")
        check(yard_sib, 'under Tavern & inn the Hill sits with the Yard')
        prog = await gm.evaluate("(tw.buildingProgramme('TAV')?.rooms || []).concat(tw.buildingProgramme('TAV')?.out || []).map(r => r.key)")
        check('hill' not in prog, 'a whole inn never packs a hill into itself', prog)

        print('DRAWING: the room tool makes a hill one storey up')
        await view(gm, 15, 15, 90, 70)
        await bar_text(gm, 'hill'); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(400)
        mode = await gm.evaluate("tw.mode && { kind: tw.mode.kind, type: tw.mode.type }")
        check(mode == {'kind': 'room', 'type': 'hill'}, 'Enter on the bar row gives the hill tool', mode)
        await drag(gm, await scr(gm, C(0), C(0)), await scr(gm, C(5), C(5)))
        await wait(gm, f"{HILLS}.length === 1", 8000, 'the hill')
        H = await gm.evaluate(f"{HILLS}[0]")
        check(H and H['recipe']['x'] == 0 and H['recipe']['z'] == 0 and H['recipe']['w'] == 6 and H['recipe']['d'] == 6, 'a 30 x 30 ft hill where it was dragged', H and H['recipe'])
        check(H and H['recipe'].get('y') == 10, 'its top is 10 ft up: one storey', H and H['recipe'].get('y'))
        check(H and H.get('building') is None, 'it belongs to no building', H and H.get('building'))
        check(H and H['recipe'].get('floor') == 'floor-grass', 'its ground is grass by default', H and H['recipe'].get('floor'))
        objs = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{H['id']}').length")
        check(objs == 0, 'nothing is laid out on its top (bare ground)', objs)
        HID = H['id']
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        info = await gm.evaluate(TREADY)
        check(info['fields'] == 1 and info['banks'] == 1 and info['triangles'] > 1000, 'one bank mesh worked out round it', info)
        check(info['rocks'] >= 2 and info['bushes'] >= 1, 'dressed with the generated boulder and library bushes', info)
        check(info['settings'] == {'angle': 45, 'soft': 1.2, 'round': 0.5, 'rough': 0.6, 'dress': 0.45, 'earth': 0.8, 'cliffAngle': 76}, "Harry's house settings", info['settings'])
        hs = await gm.evaluate(f"[[15, 15], [0.3, 15], [29.7, 29.7], [31, 15], [37, 15], [60, 15]].map(([x, z]) => +{W}.terrain.heightAt(x, z).toFixed(2))")
        check(hs[0] == 10 and hs[1] == 10 and hs[2] == 10 and 9 < hs[3] <= 10 and 0 < hs[4] < 9 and hs[5] == 0, 'the field: level top to its edge, the bank outside it, the ground beyond', hs)
        slab = await gm.evaluate(f"[...{W}.shell.values()].filter(s => s.roomId === '{HID}' && (s.spec.slab || s.spec.support)).length")
        check(slab == 0, 'no floor slab and no posts under a hill', slab)
        tiles = await gm.evaluate(f"[...{W}.shell.values()].filter(s => s.roomId === '{HID}' && s.spec.layer === 'floor' && s.spec.sku && s.spec.sku.startsWith('floor-grass')).map(s => s.group.position.y)")
        check(len(tiles) == 36 and all(abs(y - 10) < 0.05 for y in tiles), 'its top: 36 grass squares at 10 ft', [len(tiles), tiles[:2]])
        await view(gm, 15, 15, 120, 52, -20); await shot(gm, 'hill-table')

        print('STANDING: a pawn and a thing on top')
        PAWN = 'tok_hillpawn1'
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{PAWN}', name: 'Bram', x: 42.5, z: 17.5, color: '#e8d46a' }})")
        await wait(gm, f"!!tw.entities()['{PAWN}']", 6000); await gm.wait_for_timeout(1200)
        await view(gm, 25, 17, 80, 66)
        await drag(gm, await scr(gm, 42.5, 17.5, 1.5), await scr(gm, 17.5, 17.5, 10), 14)
        await wait(gm, 'tw.sync.pendingCount() === 0', 5000); await gm.wait_for_timeout(500)
        e = await gm.evaluate(f"tw.entities()['{PAWN}']")
        check(abs(e['x'] - 17.5) < 1.2 and abs(e['z'] - 17.5) < 1.2 and abs((e.get('y') or 0) - 10) < 0.01, 'a pawn dragged from the ground onto the hill stands on its top (10 ft)', {k: e.get(k) for k in ('x', 'y', 'z')})
        b = await gm.evaluate(f"{W}.pawnBaseInfo('{PAWN}')")
        check(b and abs(b['baseY'] - 10) < 0.05 and b['room'] == HID and b['drop'] == 0, 'its base rests on the hill top (no beam, no gap)', b)
        offer = await gm.evaluate("tw.condButtons.has('cut-offer')")
        check(not offer, 'going up onto a hill offers no "Cut to lv 2" (a hill is the ground, not a storey)', offer)
        await bar_text(gm, 'barrel'); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(500)
        sp = await scr(gm, 7.5, 22.5, 10); await gm.mouse.move(sp['x'], sp['y']); await gm.wait_for_timeout(250); await gm.mouse.click(sp['x'], sp['y']); await gm.wait_for_timeout(800)
        await gm.keyboard.press('Escape')
        bar = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && /barrel/.test(e.cat)).map(e => ({ y: e.y, room: e.room, x: e.x, z: e.z }))")
        check(len(bar) >= 1 and abs((bar[0]['y'] or 0) - 10) < 0.05 and bar[0]['room'] == HID, 'a barrel put down on the hill stands on its top and is the hill\'s', bar)
        await view(gm, 15, 15, 95, 50, -25); await shot(gm, 'pawn-on-hill')

        print('HEIGHT: raise, lower, a step; the pawn rides along; one undo each')
        await gm.evaluate(f"tw.select(['{HID}'])"); await gm.wait_for_timeout(300)
        ids = await gm.evaluate("tw.registry.available().map(c => c.id).filter(id => id.startsWith('room.hill') || id.startsWith('room.height') || id.startsWith('room.walls'))")
        check('room.hill.height.raise' in ids and 'room.hill.height.lower' not in ids and 'room.hill.height.20' in ids and 'room.hill.cliff' in ids and not any(i.startswith('room.height') for i in ids), "the hill's own commands (and not a tall room's Taller; a 10-ft hill is as low as a hill goes, so no Lower)", [i for i in ids if not i.startswith('room.walls')])
        menu = await gm.evaluate("tw.registry.available().filter(c => c.menu && (c.id.startsWith('room.hill'))).map(c => c.group)")
        check(menu and all(g.startswith('Hill') for g in menu), "they sit in the hill's ☰ (Hill ▸ Height, Hill)", menu)
        await gm.evaluate("tw.registry.run('room.hill.height.raise')")
        await wait(gm, f"tw.entities()['{HID}'].recipe.y === 20", 9000, 'raise')
        y = await gm.evaluate(f"[tw.entities()['{HID}'].recipe.y, tw.entities()['{PAWN}'].y, Object.values(tw.entities()).find(e => /barrel/.test(e.cat || ''))?.y]")
        check(y == [20, 20, 20], 'Raise 10 ft: the hill is 20 ft (a whole storey up), the pawn and the barrel on it rode up', y)
        hs5 = await gm.evaluate("tw.registry.available().filter(c => /^room\\.hill\\.height\\.(5|15)$/.test(c.id)).length")
        check(hs5 == 0, 'no 5-ft or 15-ft hill step is offered (whole storeys only)', hs5)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{HID}'].recipe.y === 10", 4000, 'undo')
        y = await gm.evaluate(f"[tw.entities()['{HID}'].recipe.y, tw.entities()['{PAWN}'].y]")
        check(y == [10, 10], 'one undo puts the hill and the pawn back at 10 ft', y)
        await gm.evaluate(f"tw.select(['{HID}'])"); await bar_text(gm, 'hill 20 ft'); refs = await bar_refs(gm)
        check('cmd:room.hill.height.20' in refs, 'bar "hill 20 ft" with the hill selected offers its 20 ft step', refs)
        await gm.keyboard.press('Enter'); await wait(gm, f"tw.entities()['{HID}'].recipe.y === 20", 9000, '20 ft')
        y = await gm.evaluate(f"[tw.entities()['{HID}'].recipe.y, tw.entities()['{PAWN}'].y]")
        check(y == [20, 20], 'Hill 20 ft: two storeys up, the pawn with it', y)
        info = await gm.evaluate(TREADY)
        hs = await gm.evaluate(f"+{W}.terrain.heightAt(15, 15).toFixed(2)")
        check(hs == 20 and info['banks'] == 1, 'the bank is worked out again for 20 ft', [hs, info])
        await gm.evaluate(f"tw.select(['{HID}'])"); await bar_text(gm, 'lower hill'); refs = await bar_refs(gm)
        check('cmd:room.hill.height.lower' in refs, 'bar "lower hill" offers Lower 10 ft', refs)
        await gm.keyboard.press('Escape'); r = await gm.evaluate(f"tw.setHillHeight(tw.entities()['{HID}'], 10)"); ok = await wait(gm, f"tw.entities()['{HID}'].recipe.y === 10", 6000)
        check(ok, 'and back to 10 ft (two steps down in one)', [r, await gm.evaluate(f"tw.entities()['{HID}'].recipe.y"), await gm.evaluate("tw.lastToast || document.querySelector('#toast')?.textContent || ''")])

        print('ROCK SIDES')
        await gm.evaluate(f"tw.select(['{HID}'])"); await bar_text(gm, 'rock face'); refs = await bar_refs(gm)
        check('cmd:room.hill.cliff' in refs, 'bar "rock face" with the hill selected offers Rock sides', refs)
        await gm.keyboard.press('Enter'); await wait(gm, f"tw.entities()['{HID}'].cliff === true", 4000, 'cliff')
        info = await gm.evaluate(TREADY)
        steep = await gm.evaluate(f"(() => {{ const F = {W}.terrainField.fields[0]; let s = 0; for (let d = 0.5; d < 10; d += 0.25) s = Math.max(s, F.slopeDeg(30 + d, 15, 0.5)); return +s.toFixed(1); }})()")
        check(steep > 60, 'rock sides: the bank is a steep rock face', steep)
        await view(gm, 15, 15, 120, 52, -20); await shot(gm, 'rock-sides')
        await gm.keyboard.press('Control+z'); await wait(gm, f"!tw.entities()['{HID}'].cliff", 4000, 'undo cliff')
        check(not await gm.evaluate(f"tw.entities()['{HID}'].cliff"), 'one undo: grass banks again')

        print('TERRACES: a hill on the hill; two side by side; "hill 20 ft"')
        await gm.evaluate(f"(() => {{ tw.dispatch('token.move', {{ id: '{PAWN}', x: 16.25, z: 28.75, y: 10 }}); const b = Object.values(tw.entities()).find(e => /barrel/.test(e.cat || '')); if (b) tw.dispatch('object.move', {{ id: b.id, x: 25, z: 22.5, y: 10 }}); }})()"); await gm.wait_for_timeout(500) # (out of the way of the banks the next terraces lay on this hill: the 20-ft one beside it too, 2026-10-26)
        await view(gm, 15, 15, 90, 70)
        await gm.evaluate("tw.modes.roomTool('hill')"); await gm.wait_for_timeout(200)
        await drag(gm, await scr(gm, C(0), C(0), 10), await scr(gm, C(1), C(2), 10))
        await wait(gm, f"{HILLS}.length === 2", 6000, 'the second hill')
        H2 = await gm.evaluate(f"{HILLS}.find(e => e.id !== '{HID}')")
        check(H2 and H2['recipe'].get('y') == 20, 'drawn on the hill: a higher terrace, 20 ft (10 ft on the 10-ft hill)', H2 and H2['recipe'])
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        await bar_text(gm, 'hill 5 ft'); refs5 = await bar_refs(gm)
        check(not refs5 or refs5[0] != 'cmd:build.hill.step', 'bar "hill 5 ft": no 5-ft hill tool (a low rise is a thing to stand on)', refs5)
        await bar_text(gm, 'hill 20 ft'); refs = await bar_refs(gm)
        check(refs and refs[0] == 'cmd:build.hill.step', 'bar "hill 20 ft" with nothing selected: the hill tool at 20 ft', refs)
        await gm.keyboard.press('Enter'); await gm.wait_for_timeout(300)
        await drag(gm, await scr(gm, C(6), C(1)), await scr(gm, C(8), C(4)))
        await wait(gm, f"{HILLS}.length === 3", 6000, 'the 20 ft hill')
        H3 = await gm.evaluate(f"{HILLS}.find(e => e.id !== '{HID}' && e.id !== '{H2['id'] if H2 else ''}')")
        check(H3 and H3['recipe'].get('y') == 20 and H3['recipe']['x'] == 6, 'beside the 10 ft hill: a 20 ft hill (two heights side by side)', H3 and H3['recipe'])
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        info = await gm.evaluate(TREADY)
        hs = await gm.evaluate(f"[[5, 7.5], [25, 17.5], [42.5, 12.5], [31, 12.5], [28, 12.5]].map(([x, z]) => +{W}.terrain.heightAt(x, z).toFixed(2))")
        check(info['fields'] == 1 and hs[0] == 20 and 10 <= hs[1] <= 20 and hs[2] == 20 and hs[3] == 20 and 10 < hs[4] < 20, 'one field: 20 on the terrace (its bank comes down onto the 10-ft hill), 20 beside it, level to its edge, its bank down onto the 10-ft hill', [info, hs])
        await view(gm, 22, 15, 135, 52, -20); await shot(gm, 'terraces')
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_hillbank1', name: 'Pip', x: 77.5, z: 12.5, color: '#c58be0' })"); await gm.wait_for_timeout(500)
        HB = await gm.evaluate("tw.spawnRoom('hill', 12, 1, 3, 4, 99, undefined, 10)"); await wait(gm, f"!!tw.entities()['{HB}']", 6000); await gm.wait_for_timeout(300)
        bur = await gm.evaluate("[tw.lastBuried, document.querySelector('#toast')?.textContent || '']")
        check(bur[0] == ['tok_hillbank1'] and 'Pip' in bur[1], "a hill drawn beside a pawn whose square its bank now covers: the GM is told, by name", bur)
        await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{HB}' }}); tw.dispatch('token.delete', {{ id: 'tok_hillbank1' }})"); await wait(gm, f"{HILLS}.length === 3", 6000)

        print('THE CUT AND THE FOG LEVEL: a hill is ground')
        await gm.evaluate("tw.setCut(9, { by: 'test' })"); await gm.wait_for_timeout(600)
        cut = await gm.evaluate(f"(() => {{ const w = {W}; return {{ hill: w.cutHides(tw.entities()['{HID}']), pawn: w.cutHides(tw.entities()['{PAWN}']), drawn: w.recs.get('{PAWN}')?.group.visible, fog: w.fogLevel() }}; }})()")
        check(cut == {'hill': False, 'pawn': False, 'drawn': True, 'fog': 0}, 'cut at lv 1 (9 ft): the hill and the pawn on it still show; the fog stays on the ground', cut)
        # (2026-10-26) one numbering for the map: the hilltop's level is lv 2; below the ground the hill is the earth's lid, and what stands on it is not drawn
        lab = await gm.evaluate("[tw.levelInfo(10).label, tw.levelInfo(0).label, tw.levelInfo(-10).label]")
        check(lab == ['lv 2', 'lv 1', 'lv -1'], "the hilltop's height is lv 2, the ground lv 1 (the map's numbering)", lab)
        await gm.evaluate("tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(600)
        cut = await gm.evaluate(f"(() => {{ const w = {W}; w.cutPass?.(); const tiles = [...w.shell.values()].filter(s => s.roomId === '{HID}' && s.spec.layer === 'floor'); return {{ hill: w.cutHides(tw.entities()['{HID}']), pawn: w.cutHides(tw.entities()['{PAWN}']), drawn: w.recs.get('{PAWN}')?.group.visible, tiles: tiles.filter(s => s.group.visible).length == tiles.length }}; }})()")
        check(cut == {'hill': False, 'pawn': True, 'drawn': False, 'tiles': True}, 'lv -1: the hill is still drawn whole (nothing under it), the pawn on it is not (as on the open ground)', cut)

        print('BELOW THE GROUND (2026-10-27): a cellar under the hill changes nothing of it; at lv -1 the hill is see-through')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(600)
        b0 = await gm.evaluate(BANKINFO); sb = await gm.evaluate(f"({SEE})('{HID}')") # (the hill as drawn at lv 1: its own materials)
        CID = await gm.evaluate("tw.spawnRoom('cellar', 2, 2, 2, 2, 4242, undefined, -10)"); await wait(gm, f"!!tw.entities()['{CID}'] && tw.sync.pendingCount() === 0", 8000, 'a cellar under the hill'); await gm.wait_for_timeout(900)
        b1 = await gm.evaluate(BANKINFO)
        check(b1 == b0 and b0['tris'] > 1000, 'lv 1: the cellar under the hill leaves the bank exactly as it was (triangles, every height, rocks, bushes)', [b0, b1])
        await gm.evaluate("tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(900)
        b2 = await gm.evaluate(BANKINFO); se = await gm.evaluate(f"({SEE})('{HID}')")
        check(b2 == b0, 'lv -1: the same bank, no crater over the cellar (triangles, every height, rocks, bushes)', [b0, b2])
        check(se['see'] == 0.25 and se['group'] and se['tilesShown'] == se['tiles'] == sb['tiles'] >= 36, 'lv -1: the hill is drawn whole (every tile of its top, its grass and scatter), see-through at the default 0.25', se)
        check(se['tile']['n'] > 0 and se['tile']['solid'] == 0 and se['tile']['dw'] == 0 and se['tile']['maxOp'] <= 0.25 + 1e-6 and se['tile']['minOp'] > 0, "lv -1: every material of the hill's top is see-through (opacity 0.25 at most, no depth written)", se['tile'])
        check(se['bank']['n'] >= 1 and se['bank']['solid'] == 0 and se['bank']['dw'] == 0 and se['bank']['maxOp'] == se['bank']['minOp'] == 0.25, 'lv -1: the bank at 0.25, no depth written', se['bank'])
        check(se['dress']['n'] > 0 and se['dress']['solid'] == 0 and se['dress']['dw'] == 0 and se['dress']['maxOp'] <= 0.25 + 1e-6, 'lv -1: its rocks and bushes too', se['dress'])
        lib = await gm.evaluate(f"(() => {{ const w = {W}; let n = 0, see = 0; for (const r of w.recs.values()) r.group.traverse(o => {{ if (o.isMesh) for (const m of [].concat(o.material)) {{ n++; if (m.transparent && !m.depthWrite && m.opacity <= 0.25 + 1e-6) see++; }} }}); return [n, see]; }})()")
        check(lib[1] == 0, "...and nothing else in the area is faded with it (a bush's library material is copied, never changed)", lib)
        dn = await gm.evaluate(f"(() => {{ const w = {W}, r = tw.entities()['{CID}'].recipe, x = (r.x + 1) * 5, z = (r.z + 1) * 5; const fp = w.floorPoint({{ origin: {{ x, y: 200, z }}, direction: {{ x: 0, y: -1, z: 0 }} }}, {{ max: tw.floorMax() }}); const st = w.floorStop({{ origin: {{ x: x - 14, y: 40, z }}, direction: {{ x: 0.3 / Math.hypot(0.3, 1), y: -1 / Math.hypot(0.3, 1), z: 0 }} }}); return {{ fp: fp && [fp.y, fp.room], open: [[r.x, r.z], [r.x + 1, r.z + 1]].every(([a, b]) => w.groundOpenCells.has(a + ':' + b)), stopY: +(40 - st / Math.hypot(0.3, 1)).toFixed(2) }}; }})()")
        check(dn['fp'] == [-10, CID] and dn['open'], 'lv -1: the ground is open over the cellar as ever, and the pointer straight down over it reaches its floor', dn)
        check(abs(dn['stopY'] + 10) < 0.01, 'lv -1: a slanted ray over the hill is not stopped by its top (it is see-through): it goes through the opening onto the cellar floor', dn)
        # (2026-10-27, Harry: "that should probably also apply to the ground itself") the ground fades too, and a click on it goes through
        GR = f"""(() => {{ const w = {W}; w.groundSeePass(); const m = w.ground.material, r = tw.entities()['{CID}'].recipe, x = (r.x + 1) * 5, z = (r.z + 1) * 5, k = Math.hypot(0.5, 1);
          const st = w.floorStop({{ origin: {{ x: x - 27, y: 40, z }}, direction: {{ x: 0.5 / k, y: -1 / k, z: 0 }} }}); return {{ see: w.groundSeeNow(), visible: w.ground.visible, transparent: m.transparent, op: +m.opacity.toFixed(3), dw: m.depthWrite, closedAt: !w.groundOpenCells.has(Math.floor((x - 7) / 5) + ':' + Math.floor(z / 5)), stopY: +(40 - st / k).toFixed(2) }}; }})()"""
        g1 = await gm.evaluate(GR)
        check(g1['see'] == 0.25 and g1['visible'] and g1['transparent'] and g1['op'] == 0.25 and not g1['dw'], 'lv -1: the ground is see-through at the default 0.25, no depth written', g1)
        check(g1['closedAt'] and abs(g1['stopY'] + 10) < 0.01, 'lv -1: a slanted ray through the faded ground beside the cellar (no opening there) goes on into the cellar: a click there reaches it', g1)
        await gm.evaluate(f"{W}.setGroundSee(1)"); await gm.wait_for_timeout(200); g2 = await gm.evaluate(GR)
        check(not g2['transparent'] and g2['dw'] and abs(g2['stopY']) < 0.05, 'ground at 1: solid, and that ray stops on it, as before', g2)
        await gm.evaluate(f"{W}.setGroundSee(0)"); await gm.wait_for_timeout(200); g3 = await gm.evaluate(GR)
        check(not g3['visible'] and abs(g3['stopY'] + 10) < 0.01, 'ground at 0: not drawn, and the ray reaches the cellar', g3)
        await gm.evaluate(f"{W}.setGroundSee(0.25)"); await gm.wait_for_timeout(200)
        await gm.evaluate(f"{W}.setHillSee(0)"); await gm.wait_for_timeout(300)
        z0 = await gm.evaluate(f"({SEE})('{HID}')")
        check(z0['see'] == 0 and not z0['group'] and z0['tilesShown'] == 0, 'at 0: nothing of the hill is drawn (its top, bank, rocks and bushes)', z0)
        await gm.evaluate(f"{W}.setHillSee(1)"); await gm.wait_for_timeout(300)
        z1 = await gm.evaluate(f"({SEE})('{HID}')")
        check({**z1, 'see': 0} == {**sb, 'see': 0} and z1['bank']['solid'] == z1['bank']['n'] == z1['bank']['dw'], 'at 1: solid, its own materials back (exactly as at lv 1)', [z1, sb])
        await gm.evaluate(f"{W}.setHillSee(0.25)"); await gm.wait_for_timeout(200)
        await view(gm, 15, 15, 70, 50, -25); await shot(gm, 'hill-see-lv-1')
        # the slider: Settings ▸ House look ▸ Hills below ground: see-through (live; kept by the campaign when let go)
        await gm.evaluate("tw.settings.show('house')"); await gm.wait_for_timeout(400)
        sl = await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-hillsee]'); return el && { v: +el.value, out: el.nextElementSibling.textContent, label: el.closest('.srow').querySelector('label').textContent }; })()")
        gl = await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-groundsee]'); return el && { v: +el.value, out: el.nextElementSibling.textContent, row: el.closest('.srow') === document.querySelector('#settingsModal [data-hillsee]').closest('.srow') }; })()")
        check(sl and sl['v'] == 0.25 and sl['out'] == '0.25' and 'Below the ground' in sl['label'] and gl and gl['v'] == 0.25 and gl['out'] == '0.25' and gl['row'], 'House look has the two sliders side by side (Hills, Ground), each at 0.25 with its readout', [sl, gl])
        await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-hillsee]'); el.value = '0.6'; el.dispatchEvent(new Event('input')); })()"); await gm.wait_for_timeout(300)
        lv = await gm.evaluate(f"[{W}.hillSee, ({SEE})('{HID}').bank.maxOp, tw.sync.campaign.defaults?.hillSee ?? null, document.querySelector('#settingsModal [data-hillsee]').nextElementSibling.textContent]")
        check(lv[0] == 0.6 and lv[1] == 0.6 and lv[2] is None and lv[3] == '0.60', 'dragging it: the view follows live (0.6), the campaign is not told yet', lv)
        await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-hillsee]'); el.dispatchEvent(new Event('change')); })()"); await wait(gm, "tw.sync.campaign.defaults?.hillSee === 0.6 && tw.sync.pendingCount() === 0", 6000, 'hillSee stored')
        await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-groundsee]'); el.value = '0.4'; el.dispatchEvent(new Event('input')); })()"); await gm.wait_for_timeout(300)
        gv = await gm.evaluate(f"[{W}.groundSee, ({GR}).op, tw.sync.campaign.defaults?.groundSee ?? null]")
        check(gv == [0.4, 0.4, None], 'dragging the Ground slider: the ground follows live (0.4), not sent yet', gv)
        await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-groundsee]'); el.dispatchEvent(new Event('change')); })()"); await wait(gm, "tw.sync.campaign.defaults?.groundSee === 0.4 && tw.sync.pendingCount() === 0", 6000, 'groundSee stored')
        await gm.evaluate("document.querySelector('#settingsModal [data-act=\"hillsee-copy\"]').click()"); await gm.wait_for_timeout(200)
        cp = await gm.evaluate("tw.settings.lastCopied || (window.tw && tw.app?.settings?.lastCopied) || null")
        check(cp == 'hillSee 0.60 groundSee 0.40', 'let go: the campaign keeps both; Copy gives the values', cp)
        await gm.evaluate("(() => { const b = document.querySelector('#settingsModal [data-act=\"hillsee-reset\"]'); b && b.click(); })()"); await wait(gm, "tw.sync.campaign.defaults?.hillSee == null && tw.sync.campaign.defaults?.groundSee == null && tw.sync.pendingCount() === 0", 6000, 'hillSee reset')
        await gm.wait_for_timeout(300); rs = await gm.evaluate(f"[{W}.hillSee, {W}.groundSee]")
        check(rs == [0.25, 0.25], 'Reset: both back to the game defaults, 0.25', rs)
        await gm.evaluate("tw.settings.close()"); await gm.wait_for_timeout(200)
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(700)
        s1 = await gm.evaluate(f"({SEE})('{HID}')")
        check(s1 == sb, 'back at lv 1: the hill is solid again, exactly as it was', [s1, sb])
        g4 = await gm.evaluate(GR); check(g4['see'] == 1 and g4['visible'] and not g4['transparent'] and g4['dw'], 'and the ground solid', g4)
        await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{CID}' }})"); await wait(gm, f"!tw.entities()['{CID}'] && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(500)
        await gm.evaluate("tw.goLevel(0, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(300)

        print('SIGHT: fog of war over a hill is the ground\'s')
        sl = await gm.evaluate(f"(async () => {{ const H = await import(new URL('../core/height.js', document.baseURI).href); const E = tw.entities(), open = (r) => true; return [H.sightLevel(E, 17.5, 17.5, 10, open), H.sightLevel(E, 52.5, 47.5, 0, open)]; }})()")
        check(sl == [0, 0], 'a pawn on the hill and one on the ground see at the same level (the ground\'s)', sl)

        print('SYNC: a player sees it; a reload keeps it')
        link = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#67aadd' }))")
        if '#s=' in link:
            pl = await tab(link)
            await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000, 'player ready')
            ok = await wait(pl, f"{HILLS}.length === 3", 30000, 'player sees the hills')
            if not ok: print('    player sees:', await pl.evaluate(f"(() => {{ try {{ return [tw.me && tw.me(), {HILLS}.length, Object.keys(tw.entities()).length]; }} catch (e) {{ return String(e); }} }})()"))
            check(ok, 'a player\'s tab gets the three hills')
            pinfo = await pl.evaluate(TREADY) if ok else None
            check(pinfo and pinfo['fields'] == 1 and pinfo['banks'] == 1 and pinfo['rocks'] == info['rocks'], 'and draws the same banks and rocks', [pinfo, info])
        else:
            check(False, 'an invite link for a player', 'no API found')
        await gm.bring_to_front(); await gm.reload(); await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000, 'reload'); await wait(gm, f"{HILLS}.length === 3", 30000, 'reloaded hills')
        info2 = await gm.evaluate(TREADY)
        e = await gm.evaluate(f"[tw.entities()['{HID}']?.recipe.y, tw.entities()['{PAWN}']?.y]")
        check(e == [10, 10] and info2['banks'] == 1, 'after a reload: the hills, the pawn on top and the banks are all there', [e, info2])

        print('ERRORS')
        bad = [x for x in errors if 'favicon' not in x and 'ERR_' not in x and '404' not in x]
        check(not bad, 'no page errors', bad[:5])
        await browser.close()
    for pr in procs: pr.terminate()
    n_ok = sum(1 for r in results if r[0]); print(f'\nbrowser_hills: {n_ok}/{len(results)} passed')
    sys.exit(0 if n_ok == len(results) else 1)

asyncio.run(main())
