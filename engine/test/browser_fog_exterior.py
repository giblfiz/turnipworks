#!/usr/bin/env python3
"""EXTERIORS ABOVE (2026-11-24; core/exterior.js, docs/VERTICAL.md "Exteriors above").

  tw-slot browser-venv/bin/python engine/test/browser_fog_exterior.py --local [--shots]
  (TW_PORTS=relay,web picks the two ports)

Why this suite exists: on dev, Harry's player Foggy stood out in the open in front of the Dragon Temple and saw most of it as
grey checker. The fog's picture is drawn by HEIGHT (fx/fogwar.js: a fragment reads the mask of the highest level at or
below it) and the masks were the SIGHT LEVELS (core/height.js levelY), so once a map had any upper storey, everything 10 ft
or more up (a temple on a 10-ft hill, which sees at the ground's level 0; a statue on a pillar; every roof) read the upper
storey's mask, which only pawns upstairs ever write. And a player on the ground had no way to see the outside of anything
above the ground. Then: "there's a hidden sculpture on top of the pillar right out in front of the temple that shouldn't be
hidden; it's standing out there right out in the open".

A tavern (one storey) with a roofed guest room over its west end; a 10-ft hill with a hall on it (a ground storey on the hill);
out in the open a pillar with a statue on top (10 ft up); a barrel inside the roofed guest room. The player's pawn stands on
the open ground.
  X1 the fog's bands are heights: 0, 10 and 20 (the guest room's and the hill hall's roofs)
  X2 the statue on the pillar, out in the open 10 ft up, is known, drawn and reaches the screen; its spot is seen at 11 ft
  X3 the hill's top beside the hall is seen at 10 ft (it sees at the ground's level), as the ground in front of it is
  X4 the guest room's outside wall upstairs is drawn (its shell is known from outside)
  X5 SECRECY: the barrel in the roofed guest room is not drawn, shows no pixels, and its spot is not seen at 10 ft
  X6 roofs on: the tavern's roof beside the guest room is seen; the guest room's inside under its roof still is not
  X7 the GM (no fog) draws the barrel; previewing as the player hides it and keeps the statue
  X8 the pawn goes up into the guest room: the fog lies on lv 2, the barrel is seen; the player's memory (the relay's seen
     sets) now holds level 10 and the exterior keys; back on the ground the barrel stays remembered
LOOKING DOWN (Harry: "Line of sight down from a terrace should work too"): a roof-off yard on the tavern's east end, a barrel
on the ground north of the tavern (behind its walls from where the pawn stood).
  X9 from the yard the ground past the tavern's edges is seen, and the barrel there is known
  X10 not the ground under the yard's own floor, nor the inside of the roofed tavern below (its roof, yes)
HOLES (Harry: "fix the holes in floor bug"):
  X11 the hall on the hill, known from outside: every piece of its floor is drawn, the unseen ones too (they were left out,
      and the hill's top is not drawn where a room takes it: a hole into the hill)
HOLES IN A FLOOR (Harry: "it's acting like a pillar ... you SHOULD be able to see down into it based on line of sight"): a
passage dug into the hill under the hall with a 10-ft hole over it; a cellar under the tavern with a 5-ft hole over it.
  X12 across the hole the hall's far side and a barrel there are seen (the passage's walls, 10 ft under, no longer stand in it)
  X13 at the edge, the passage floor and a barrel beyond the hole's middle are seen; the side under the pawn's own floor is not
  X14 from the edge of the tavern's hole: the cellar barrel across it is seen, the one under the pawn's side and one off the cone are not
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
tw_sandbox.placeholder_pawns(True)
sys.path.insert(0, HERE); import served  # noqa: E402
SHOTS = os.path.join(HERE, 'shots', 'fog-exterior')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18764,18964').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-fogext-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False

def pixels(png):
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return {'magenta': int(((r > 120) & (b > 120) & (g < 110) & (r - g > 60) & (b - g > 60)).sum()), 'green': int(((g > 120) & (r < 110) & (b < 110) & (g - r > 60) & (g - b > 60)).sum())}

TINT = """([ids, col]) => { const w = tw.worldOf(tw.area()); let n = 0; for (const id of ids) { const r = w.recs.get(id); if (!r) continue;
  r.group.traverse(o => { if (!o.isMesh) return; const m = (Array.isArray(o.material) ? o.material[0] : o.material).clone(); m.map = null; m.color?.set(col); if (m.emissive) { m.emissive.set(col); m.emissiveIntensity = 1; } m.needsUpdate = true; o.material = m; n++; }); }
  return n; }"""
COUNT_FRAMES = "(() => { window.__frames = 0; const c = () => { window.__frames++; requestAnimationFrame(c); }; c(); })()"
SEEN = "([x, z, y]) => { const w = tw.worldOf(tw.area()), f = w.fx?.fogwar || w.fogwar; return !!f?.enabled && f.isPointSeen(x, z, y); }"
DRAWN = "(id) => !!tw.worldOf(tw.area()).recs.get(id)?.group.visible"
POSE = "([x, y, z, d]) => { tw.main.rule = 'free'; tw.main.setPose({ focus: [x, y, z], dist: d, yaw: -20, pitch: 52 }); }"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 900, 'height': 600}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); await pg.goto(url); await pg.add_style_tag(content='#linkMail{display:none!important}'); return pg
        async def settle(pg, frames=45):
            await pg.evaluate("window.__frames === undefined && " + COUNT_FRAMES)
            start = await pg.evaluate('window.__frames')
            for i in range(400):
                await pg.evaluate("tw.gfx?.wake?.('test')"); await pg.mouse.move(450 + i % 5, 300); await pg.wait_for_timeout(250)
                if await pg.evaluate('window.__frames') - start >= frames: break
        async def shot(pg, name):
            png = await pg.screenshot(timeout=170000)
            if A.shots: open(os.path.join(SHOTS, name + '.png'), 'wb').write(png)
            return png
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', f"TEST fog exterior {time.strftime('%m-%d %H:%M:%S')} (throwaway)"); await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw?.ready?.() && tw.fog', 150000), 'GM did not come up'
        idle = lambda: wait(gm, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 170000)
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 10, 4, 7501)"); await idle()                   # the tavern, 0..50 x 0..20
        await gm.evaluate("tw.spawnRoom('guest', 0, 0, 4, 4, 7502, undefined, 10)"); await idle()     # its roofed guest room, upstairs at the west end
        await gm.evaluate("tw.spawnRoom('hill', 14, 0, 8, 8, 7630, undefined, 10)"); await idle()     # a 10-ft hill, 70..110 x 0..40
        await gm.evaluate("tw.spawnRoom('common', 15, 1, 4, 4, 7503, undefined, 10)"); await idle()   # a hall on the hill (a ground storey there)
        R = await gm.evaluate("(() => { const E = tw.entities(), r = (t, y) => Object.values(E).find(e => e.kind === 'room' && e.recipe.type === t && (e.recipe.y || 0) === y)?.id; return { tavern: r('common', 0), guest: r('guest', 10), hall: r('common', 10), hill: r('hill', 10) }; })()")
        assert all(R.values()), f'rooms not built: {R}'
        await gm.evaluate("(r) => { const s = (c) => tw.roomgen.sizeOf(c); tw.dispatch('object.place', { id: 'obj_xtpillar01', x: 40, z: 40, y: 0, cat: 'pillar-round', ...s('pillar-round') }); tw.dispatch('object.place', { id: 'obj_xtstatue01', x: 40, z: 40, y: 10, cat: 'barrel', ...s('barrel') }); tw.dispatch('object.place', { id: 'obj_xtinside01', x: 10, z: 10, y: 10, cat: 'barrel', room: r.guest, ...s('barrel') }); }", R)
        await idle()
        invite = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Foggy',color:'#e06c75'}))")
        await idle(); PAWN = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'token')?.id"); assert PAWN, 'the invite put no pawn on the table'
        await gm.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 40, z: 62, y: 0 }})"); await idle()
        pl = await tab(invite)
        assert await wait(pl, 'window.tw?.ready?.() && tw.fog', 170000), 'player did not join'
        await pl.evaluate(COUNT_FRAMES)
        assert await wait(pl, f"!!tw.entities()['{PAWN}'] && tw.fog.visible(40, 62, 0) && !tw.fog.info().areas.some(a => a.pending)", 60000, 'player vision'), 'player has no vision'
        await settle(pl, 20)
        bands = await pl.evaluate("tw.fog.info().areas[0].levels.map(l => l.floorY)")
        check(bands == [0, 10, 20], 'X1 the fog\'s bands are heights: 0, 10, 20', bands)

        await pl.evaluate(POSE, [25, 8, 25, 85]); await settle(pl, 10); await pl.evaluate(POSE, [25, 8, 25, 85])  # (the statue and the guest room both in frame)
        n = await pl.evaluate(TINT, [['obj_xtstatue01'], '#ff00ff']); await settle(pl)
        png0 = await shot(pl, 'statue'); P = pixels(png0)
        # secrecy A/B: tint the hidden barrel; if anything of it were drawn the frame would change there
        n2 = await pl.evaluate(TINT, [['obj_xtinside01'], '#00ffff']); await settle(pl, 15); await pl.evaluate(POSE, [25, 8, 25, 85]); await settle(pl, 15)
        png1 = await shot(pl, 'statue-b'); P2 = pixels(png1)
        a0 = np.asarray(Image.open(io.BytesIO(png0)).convert('RGB')).astype(np.int16); a1 = np.asarray(Image.open(io.BytesIO(png1)).convert('RGB')).astype(np.int16)
        cyan = int(((a1[..., 1] > 150) & (a1[..., 2] > 150) & (a1[..., 0] < 90)).sum()) - int(((a0[..., 1] > 150) & (a0[..., 2] > 150) & (a0[..., 0] < 90)).sum())
        S = {'hidden': await pl.evaluate("tw.fog.hidden(tw.entities()['obj_xtstatue01'])"), 'drawn': await pl.evaluate(DRAWN, 'obj_xtstatue01'), 'seen11': await pl.evaluate(SEEN, [40, 40, 11])}
        check(not S['hidden'] and S['drawn'] and S['seen11'] and P['magenta'] > 40, 'X2 the statue on the pillar, out in the open 10 ft up, is known, drawn, seen and on screen', {**S, **P, 'tinted': n})
        H = {'hilltop10': await pl.evaluate(SEEN, [105, 35, 10.2]), 'ground': await pl.evaluate(SEEN, [60, 50, 0.2])}
        check(H['hilltop10'] and H['ground'], 'X3 the hill\'s top beside its hall is seen at 10 ft, as the open ground is', H)
        W = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); let n = 0, all = 0; for (const s of w.shell.values()) if (s.roomId === '{R['guest']}' && s.spec.layer === 'walls' && (s.spec.y || 0) === 10) {{ all++; if (s.group?.visible) n++; }} return {{ drawn: n, of: all, room: !tw.fog.hidden(tw.entities()['{R['guest']}']) }}; }})()")
        check(W['drawn'] > 0 and W['room'], 'X4 the guest room upstairs: its shell is known from outside and some of its walls are drawn', W)
        # NO HOLES IN A HILLTOP FLOOR (Harry: "fix the holes in floor bug"): the hall on the hill is known from outside, so every
        # piece of its floor is drawn (the fog's checker where unseen), none left as a hole into the hill
        FL = await pl.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); let n = 0, drawn = 0, kept = 0; for (const s of w.shell.values()) if (s.roomId === '{R['hall']}' && s.spec.layer === 'floor') {{ n++; if (s.group?.visible) drawn++; if (w.fogHidesShell(s)) kept++; }} return {{ pieces: n, drawn, unseen: kept, known: !tw.fog.hidden(tw.entities()['{R['hall']}']) }}; }})()")
        check(FL['known'] and FL['pieces'] > 0 and FL['drawn'] == FL['pieces'] and FL['unseen'] > 0, 'X11 the hall on the hill: every floor piece drawn, the unseen ones too (no hole into the hill)', FL)
        I = {'hidden': await pl.evaluate("tw.fog.hidden(tw.entities()['obj_xtinside01'])"), 'drawn': await pl.evaluate(DRAWN, 'obj_xtinside01'), 'seen10': await pl.evaluate(SEEN, [10, 10, 10.5]), 'cyanAdded': cyan, 'tinted': n2, 'statueStill': P2['magenta']}
        check(I['hidden'] and not I['drawn'] and not I['seen10'] and cyan <= 0 and n2 > 0, 'X5 SECRECY: the barrel in the roofed guest room is not drawn, adds no pixels when tinted, its spot unseen', I)
        await pl.evaluate("tw.setRoofs(true, 'bar')"); await settle(pl, 30)
        F = {'tavernRoof': await pl.evaluate(SEEN, [40, 10, 10.6]), 'guestInside': await pl.evaluate(SEEN, [10, 10, 10.6]), 'barrel': await pl.evaluate(DRAWN, 'obj_xtinside01')}
        if A.shots: await shot(pl, 'roofs')
        check(F['tavernRoof'] and not F['guestInside'] and not F['barrel'], 'X6 roofs on: the tavern\'s roof is seen, the guest room\'s inside is not', F)
        await pl.evaluate("tw.setRoofs(false, 'bar')")

        G = {'gmBarrel': await gm.evaluate(DRAWN, 'obj_xtinside01') or not await gm.evaluate("tw.fog.hidden(tw.entities()['obj_xtinside01'])")}
        await gm.evaluate("(id) => tw.setVisionViewer(id)", await pl.evaluate("tw.me()")); await wait(gm, "!tw.fog.info().areas.some(a => a.pending)", 30000)
        await settle(gm, 10)
        G.update({'asBarrel': await gm.evaluate("tw.fog.hidden(tw.entities()['obj_xtinside01'])"), 'asStatue': await gm.evaluate("tw.fog.hidden(tw.entities()['obj_xtstatue01'])")})
        await gm.evaluate("tw.setVisionViewer('gm')")
        check(G['gmBarrel'] and G['asBarrel'] and not G['asStatue'], 'X7 the GM sees the barrel; viewing as the player hides it and keeps the statue', G)

        await pl.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 10, z: 12, y: 10 }})")
        assert await wait(pl, f"tw.entities()['{PAWN}'].y === 10 && tw.sync.pendingCount() === 0 && !tw.fog.info().areas.some(a => a.pending)", 30000, 'pawn up')
        await settle(pl, 20); await pl.evaluate(POSE, [10, 10, 12, 45]); await settle(pl, 30)
        up = {'fogLevel': await pl.evaluate("tw.worldOf(tw.area()).fogLevel()"), 'barrelSeen': not await pl.evaluate("tw.fog.hidden(tw.entities()['obj_xtinside01'])"), 'seen10': await pl.evaluate(SEEN, [10, 10, 10.5])}
        if A.shots: await shot(pl, 'upstairs')
        await pl.evaluate("tw.fog.sendNow()")
        await wait(gm, f"(() => {{ const k = Object.keys(tw.view().fog?.viewers?.['{await pl.evaluate('tw.me()')}'] || {{}}); return k.includes('10') && k.includes('10.5'); }})()", 20000, 'memory at the relay')
        up['memory'] = await gm.evaluate(f"Object.keys(tw.view().fog?.viewers?.['{await pl.evaluate('tw.me()')}'] || {{}}).sort()")
        await pl.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 40, z: 62, y: 0 }})")
        assert await wait(pl, f"(tw.entities()['{PAWN}'].y || 0) === 0 && tw.sync.pendingCount() === 0 && !tw.fog.info().areas.some(a => a.pending)", 30000, 'pawn down')
        up['remembered'] = not await pl.evaluate("tw.fog.hidden(tw.entities()['obj_xtinside01'])")
        check(up['fogLevel'] == 10 and up['barrelSeen'] and up['seen10'] and '10' in up['memory'] and '10.5' in up['memory'] and up['remembered'], 'X8 upstairs the barrel is seen; the seen sets gain level 10 and the exterior; remembered back on the ground', up)
        # LOOKING DOWN (Harry: "Line of sight down from a terrace should work too"): a roof-off yard on the tavern's east end
        await gm.evaluate("tw.spawnRoom('yard', 6, 0, 4, 4, 7504, undefined, 10)"); await idle()
        await gm.evaluate("tw.dispatch('object.place', { id: 'obj_xtnorth01', x: 25, z: -12, y: 0, cat: 'barrel', ...tw.roomgen.sizeOf('barrel') })"); await idle()
        INSIDE = [[x, z, 0.2] for x in (5, 15, 25, 35, 45) for z in (3, 10, 17)]  # the roofed tavern's floor, under the guest room and the yard too
        seenIn = lambda: pl.evaluate("(pts) => pts.filter(p => { const w = tw.worldOf(tw.area()), f = w.fx?.fogwar || w.fogwar; return f.isPointSeen(...p); }).map(p => p.join(','))", INSIDE)
        before = {'north': not await pl.evaluate("tw.fog.hidden(tw.entities()['obj_xtnorth01'])"), 'northSeen': await pl.evaluate(SEEN, [25, -12, 0.2]), 'inside': await seenIn()}
        await pl.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 40, z: 10, y: 10 }})")
        assert await wait(pl, f"tw.entities()['{PAWN}'].y === 10 && tw.sync.pendingCount() === 0 && !tw.fog.info().areas.some(a => a.pending)", 30000, 'pawn onto the yard')
        await settle(pl, 20); await pl.evaluate(POSE, [30, 5, 10, 95]); await settle(pl, 30)
        D = {'before': before, 'fogLevel': await pl.evaluate("tw.worldOf(tw.area()).fogLevel()"), 'northSeen': await pl.evaluate(SEEN, [25, -12, 0.2]), 'north': not await pl.evaluate("tw.fog.hidden(tw.entities()['obj_xtnorth01'])"),
             'southPastEdge': await pl.evaluate(SEEN, [40, 30, 0.2]), 'inside': await seenIn(), 'tavernRoof': await pl.evaluate(SEEN, [25, 10, 10.6])}
        if A.shots: await shot(pl, 'look-down')
        check(not before['north'] and not before['northSeen'] and D['fogLevel'] == 10 and D['northSeen'] and D['north'] and D['southPastEdge'], 'X9 looking down from the roof-off yard: the ground past the tavern\'s edges and a barrel there behind its walls', D)
        newly = sorted(set(D['inside']) - set(before['inside']))
        check(not newly and D['tavernRoof'], 'X10 but nothing more of the roofed tavern\'s floor below (under the yard, under the guest room, its inside): its roof, yes', {'newly seen inside': newly, 'seen through its door from the ground before': before['inside'], 'roof': D['tavernRoof']})
        # HOLES (2026-11-25; Harry: "it's acting like a pillar (you can't see past it onto the same level), and honestly you
        # SHOULD be able to see down into it based on line of sight"): a passage dug into the hill under the hall, a 10-ft hole
        # in the hall's floor over it; a cellar under the tavern's west end with a 5-ft hole in the tavern's floor over it
        await gm.evaluate("tw.spawnRoom('common', 16, 2, 2, 2, 7506, undefined, 0)"); await idle()          # the passage, 80..90 x 10..20, floor 0, in the hill
        await gm.evaluate("tw.spawnRoom('common', 0, 0, 4, 4, 7507, undefined, -10)"); await idle()        # the cellar, 0..20 x 0..20, floor -10
        RR = await gm.evaluate("(() => { const E = tw.entities(), r = (y, x) => Object.values(E).find(e => e.kind === 'room' && (e.recipe.y || 0) === y && e.recipe.x === x && e.recipe.type === 'common')?.id; return { passage: r(0, 16), cellar: r(-10, 0) }; })()")
        assert all(RR.values()), f'hole rooms not built: {RR}'
        await gm.evaluate("""(r) => { const s = (c) => tw.roomgen.sizeOf(c), b = (id, x, y, z, room) => tw.dispatch('object.place', { id, x, z, y, cat: 'barrel', room, ...s('barrel') });
          tw.dispatch('object.place', { id: 'obj_xthole01', x: 85, z: 15, y: 10, cat: 'hole-round', room: r.hall, dims: [10, 0.05, 10] });
          tw.dispatch('object.place', { id: 'obj_xthole02', x: 12.5, z: 7.5, y: 0, cat: 'hole', place: 'tile', room: r.tavern, dims: [5, 0.05, 5] });
          b('obj_xthallfar', 93, 10, 15, r.hall); b('obj_xtpasnear', 82, 0, 15, r.passage); b('obj_xtpasfar', 88.5, 0, 15, r.passage);
          b('obj_xtcelfar', 5, -10, 7.5, r.cellar); b('obj_xtcelnear', 18, -10, 7.5, r.cellar); b('obj_xtceloff', 5, -10, 18, r.cellar); }""", {**R, **RR})
        await idle()
        hid = lambda i: pl.evaluate(f"tw.fog.hidden(tw.entities()['{i}'])")
        VIS = "([x, z, y]) => { const w = tw.worldOf(tw.area()), f = w.fx?.fogwar || w.fogwar; return !!f?.enabled && f.isPointVisible(x, z, y); }"
        await pl.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 78, z: 15, y: 10 }})")
        assert await wait(pl, f"tw.entities()['{PAWN}'].y === 10 && tw.entities()['{PAWN}'].x === 78 && tw.sync.pendingCount() === 0 && !tw.fog.info().areas.some(a => a.pending)", 30000, 'pawn into the hall')
        await settle(pl, 20); await pl.evaluate(POSE, [86, 6, 15, 45]); await settle(pl, 30)
        if A.shots: await shot(pl, 'hole-hall')
        H1 = {'farSide': await pl.evaluate(VIS, [93, 15, 10.2]), 'farBarrel': not await hid('obj_xthallfar')}
        check(H1['farSide'] and H1['farBarrel'], 'X12 a hole is not a pillar: across it the hall\'s far side and a barrel there are seen', H1)
        H2 = {'passageFar': await pl.evaluate(VIS, [88.5, 15, 0.2]), 'barrelFar': not await hid('obj_xtpasfar'), 'passageNear': await pl.evaluate(VIS, [81, 15, 0.2]), 'barrelNear': not await hid('obj_xtpasnear')}
        check(H2['passageFar'] and H2['barrelFar'] and not H2['passageNear'] and not H2['barrelNear'], 'X13 at the edge, down the hole: the passage floor and a barrel beyond the middle; not the side under the pawn\'s own floor', H2)
        await pl.evaluate(f"tw.dispatch('token.move', {{ id: '{PAWN}', x: 17.5, z: 7.5, y: 0 }})")
        assert await wait(pl, f"(tw.entities()['{PAWN}'].y || 0) === 0 && tw.entities()['{PAWN}'].x === 17.5 && tw.sync.pendingCount() === 0 && !tw.fog.info().areas.some(a => a.pending)", 30000, 'pawn into the tavern')
        await settle(pl, 20); await pl.evaluate(POSE, [10, -5, 8, 45]); await settle(pl, 30)
        if A.shots: await shot(pl, 'hole-cellar')
        H3 = {'far': not await hid('obj_xtcelfar'), 'farFloor': await pl.evaluate(VIS, [5, 7.5, -9.8]), 'near': not await hid('obj_xtcelnear'), 'off': not await hid('obj_xtceloff'), 'offFloor': await pl.evaluate(VIS, [5, 18, -9.8])}
        check(H3['far'] and H3['farFloor'] and not H3['near'] and not H3['off'] and not H3['offFloor'], 'X14 a shaft to a cellar: only the cone through the opening (the barrel across it; not the one under the pawn\'s side nor one off to the side)', H3)
        check(not errors, 'no page errors', errors[:3])
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
bad = [r for r in results if not r[0]]
print(f"{len(results) - len(bad)}/{len(results)} passed"); sys.exit(1 if bad or not results else 0)
