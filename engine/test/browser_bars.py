#!/usr/bin/env python3
"""IRON BARS AND CAGE DOORS (Harry 2026-10-27, building a dragon-cult temple: "I need bars / grates as a kind of 'wall'
(not usually used as actual wall) and like cage doors"), in the real client.

  TW_GPU=1 TW_PORTS=a,b python3 engine/test/browser_bars.py --local [--shots DIR]
  ... --page http://127.0.0.1:8180/         (dev; a throwaway campaign, removed afterwards)

BAR      "iron bars", "cell bars", "cage door", "portcullis" ... put that piece first among the things to place; Enter
         enters placement of it.
RUN      in placement of the bars, Shift-clicks along a grid line INSIDE a room lay one 5-ft section on each edge, end to
         end, a storey tall (8.5-9.5 ft); the cage door goes on an edge of the run, fitted to it.
WALL     a section placed onto the room's own wall line takes the generated wall's place (the edge is opened).
WIDE     the portcullis (10 ft) is centred on a grid cross and covers two edges.
SHELF    every bars piece is on some library shelf (tw.library.coverage()).
SHOTS    the run at play distance (bars-room.png, bars-close.png) for the Gemini read; no verdict here.
"""
import argparse, asyncio, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT / 'tests')); import tw_sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page', default='http://127.0.0.1:8180/')
ap.add_argument('--shots', default=str(ROOT / 'engine/test/shots/bars')); A = ap.parse_args()
results, procs, tmp = [], [], []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(('ok   ' if ok else 'FAIL ') + name + (' — ' + str(detail) if detail else ''), flush=True)
def free():
    with socket.socket() as s: s.bind(('127.0.0.1', 0)); return s.getsockname()[1]
def start():
    ports = os.environ.get('TW_PORTS'); rp, sp = (int(v) for v in ports.split(',')) if ports else (free(), free())
    data = tempfile.mkdtemp(prefix='tw-bars-'); site = tempfile.mkdtemp(prefix='tw-bars-site-'); tmp.extend([data, site])
    os.symlink(ROOT / 'engine', site + '/engine'); os.symlink(ROOT / 'tools/spawn-tuner', site + '/tuner')
    log = open(data + '/relay.log', 'w')
    procs.append(subprocess.Popen(['node', str(ROOT / 'engine/relay/server.js')], env={**os.environ, 'PORT': str(rp), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': str(ROOT / 'tools/spawn-tuner/js'), 'TUNER_DATA': str(ROOT / 'tools/spawn-tuner/data')}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(sp), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        try: urllib.request.urlopen(f'http://127.0.0.1:{rp}/health'); break
        except Exception: time.sleep(.1)
    return f'http://127.0.0.1:{sp}/engine/client/index.html?relay=http://127.0.0.1:{rp}&api='
async def wait(pg, js, timeout=30000): await pg.wait_for_function(js, timeout=timeout)
async def idle(pg): await wait(pg, 'tw.sync.pendingCount() === 0')
async def snap(pg, name):
    Path(A.shots).mkdir(parents=True, exist_ok=True); await pg.screenshot(path=str(Path(A.shots) / (name + '.png')))
async def look(pg, x, z, dist=60, pitch=58, yaw=0):
    await pg.evaluate('([x,z,d,p,y])=>{const g=tw.main.grab;g.focus.set(x,0,z);g.dist=d;g.pitch=p;g.yaw=y;g.update();tw.main.rule="free"}', [x, z, dist, pitch, yaw]); await pg.wait_for_timeout(500)
NEW = "old=>Object.values(tw.entities()).filter(e=>!old.includes(e.id))"

async def main():
    base = start() if A.local else A.page
    url = base + ('&' if '?' in base else '?') + 'nointro&nopost&faces=1500'
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling'])
        ctx = await b.new_context(viewport={'width': 1400, 'height': 950}); pg = await ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(url); await pg.fill('#newCampaign input[name=name]', 'TEST bars ' + time.strftime('%H:%M:%S') + ' (throwaway)'); await pg.fill('#newCampaign input[name=gm]', 'Fauna'); await pg.click('#newCampaign button')
        await wait(pg, 'window.tw?.ready?.()', 90000)
        # the scene: a 30 x 25 ft room at the origin, its furniture cleared so the bars are the thing
        room = await pg.evaluate("tw.spawnRoom('common', 0, 0, 6, 5, 4101)")
        await wait(pg, 'tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', 120000)
        await pg.evaluate(f"tw.batch(Object.values(tw.entities()).filter(e=>e.kind==='object'&&e.room==='{room}'&&!['walls','openings'].includes(e.layer)&&e.place!=='tile').map(e=>({{type:'object.delete',args:{{id:e.id}}}})))"); await idle(pg)

        # ---------- BAR ----------
        async def bar(q):
            await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel();tw.clearSelection()')
            await pg.keyboard.press('/'); await pg.locator('#bar input').fill(q); await pg.wait_for_timeout(250)
            return await pg.evaluate('[...document.querySelectorAll("#results .res")].map(el => el.dataset.ref || "")')
        places = [r for r in await bar('bars') if r.startswith('cat:')]; check('cat:cell-bars' in places[:3], 'bar "bars" -> cell-bars among the first three to place ("bar" is also the tavern word)', places[:3])
        for q, want in [('iron bars', 'cat:cell-bars'), ('cell bars', 'cat:cell-bars'), ('jail bars', 'cat:cell-bars'), ('prison bars', 'cat:cell-bars'),
                        ('cage door', 'cat:door-cell-bars'), ('cell door', 'cat:door-cell-bars'), ('portcullis', 'cat:portcullis')]:
            places = [r for r in await bar(q) if r.startswith('cat:')]
            check(bool(places) and places[0] == want, f'bar "{q}" -> {want} first to place', places[:3])
        async def enter(q, cat):
            await bar(q); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
            check(await pg.evaluate(f"tw.mode?.cat?.id === '{cat}'"), f'Enter on "{q}" enters placement of {cat}')

        # ---------- RUN: a cell front across the room on the grid line z = 10, the door on the third edge ----------
        await look(pg, 15, 12, dist=55)
        async def click_edge(x, z, shift=True):
            pt = await pg.evaluate(f'tw.screenOf({x},{z},tw.main,0)'); await pg.mouse.move(pt['x'], pt['y']); await pg.wait_for_timeout(120)
            if shift: await pg.keyboard.down('Shift')
            await pg.mouse.click(pt['x'], pt['y'])
            if shift: await pg.keyboard.up('Shift')
            await idle(pg)
        old = await pg.evaluate('Object.keys(tw.entities())')
        await enter('iron bars', 'cell-bars')
        for gx in [0, 1, 3, 4, 5]: await click_edge(gx * 5 + 2.5, 10.2)
        await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel()')
        await enter('cage door', 'door-cell-bars'); await click_edge(12.5, 10.2, shift=False)
        made = await pg.evaluate(NEW, old)
        bars = sorted([e for e in made if e.get('cat') == 'cell-bars'], key=lambda e: e['x']); door = [e for e in made if e.get('cat') == 'door-cell-bars']
        check([e['x'] for e in bars] == [2.5, 7.5, 17.5, 22.5, 27.5] and all(e['z'] == 10 and abs(e['rot']) < 1e-6 for e in bars), 'five sections end to end on the grid line', [(e['x'], e['z'], e['rot']) for e in bars])
        check(all(8.5 <= e['dims'][1] <= 9.5 and 4.5 <= e['dims'][0] <= 5.5 for e in bars), 'each section is 5 ft long and a storey tall', [e['dims'] for e in bars][:2])
        check(all(e.get('layer') == 'walls' and e.get('room') == room for e in bars), 'sections are wall-layer pieces of the room')
        check(len(door) == 1 and door[0]['x'] == 12.5 and door[0]['z'] == 10, 'the cage door sits on the third edge of the run', [(e['x'], e['z']) for e in door])
        if door: check(8.5 <= door[0]['dims'][1] <= 9.5 and 4.9 <= door[0]['dims'][0] <= 5.1, 'the door fills its whole 5-ft edge (a run of bars has no jamb posts), a storey tall', door[0]['dims'])
        await pg.evaluate('tw.clearSelection()'); await pg.wait_for_timeout(3500)
        await look(pg, 15, 12, dist=55, pitch=58); await pg.wait_for_timeout(1500); await snap(pg, 'bars-room')
        await look(pg, 15, 12, dist=30, pitch=42); await pg.wait_for_timeout(1500); await snap(pg, 'bars-close')

        # ---------- SIGHT and the DOOR: a player's pawn north of the bars sees through them; dice stop at them ----------
        did = door[0]['id'] if door else None
        await pg.evaluate("tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd',placeholder:false})"); await idle(pg)
        seat = await pg.evaluate("tw.sync.campaign.seats.find(s => s.name === 'Mira' && s.role === 'player')?.id")
        await pg.evaluate(f"tw.dispatch('token.create',{{id:'tok_barsmira01',name:'Mira',x:7.5,z:5,owner:'{seat}'}})"); await idle(pg)
        check(await pg.evaluate(f"tw.setVisionViewer('{seat}')"), 'the GM views the area as the player (fog of war on)')
        async def sight_settled():
            await pg.wait_for_timeout(600); await wait(pg, "tw.fog.info().areas.every(a => !a.pending)", 30000); await pg.wait_for_timeout(400)
        await sight_settled()
        SEES = lambda x, z: f"tw.fog.visible({x},{z},0)"
        check(await pg.evaluate("tw.fog.active()"), 'fog of war is active for the preview')
        check(await pg.evaluate(SEES(7.5, 7.5)), 'control: the pawn sees its own side of the bars')
        check(await pg.evaluate(SEES(7.5, 20)) and await pg.evaluate(SEES(22.5, 20)), 'the pawn sees through the bars into the far half of the room')
        check(await pg.evaluate(SEES(12.5, 20)), 'the pawn sees through the SHUT cage door')
        # dice: the sections and the shut door are boxes a storey tall (the only movement blocking the engine has)
        DICE = "(id) => { const w = tw.worldOf(tw.area()); const D = tw.dice.world({ entities: tw.entities(), edges: w.edges, from: { x: 12.5, z: 10 }, level: 0, reach: 20 }); return D.boxes.filter(b => b.id === id).map(b => +(b.hy * 2).toFixed(2)); }"
        if did:
            check(await pg.evaluate(f"({DICE})('{did}')") == [9], 'a thrown die meets the shut cage door (a box 9 ft tall)', await pg.evaluate(f"({DICE})('{did}')"))
            hs = [await pg.evaluate(f"({DICE})('{e['id']}')") for e in bars[:2]]
            check(all(h == [9] for h in hs), 'a thrown die meets the bars', hs)
        # a solid wall placed on the same line stops the same sight (the probe is not blind)
        await pg.evaluate("tw.setVisionViewer('gm')")
        wid = 'obj_barswallctl'
        await pg.evaluate(f"tw.batch([{{type:'object.delete',args:{{id:'{bars[3]['id']}'}}}},{{type:'object.place',args:{{id:'{wid}',name:'wall',cat:'wall-straight',sku:{json.dumps(await pg.evaluate("tw.lib.objects['wall-straight'].skus.find(k=>k.bounds).sku"))},url:{json.dumps(await pg.evaluate("tw.lib.objects['wall-straight'].skus.find(k=>k.bounds).url"))},place:'kit',layer:'walls',x:22.5,y:0,z:10,rot:0,yaw:0,dims:[5,9,1],room:'{room}'}}}}])"); await idle(pg)
        await pg.evaluate(f"tw.dispatch('token.move',{{id:'tok_barsmira01',x:22.5,z:7.5}})"); await idle(pg)
        await pg.evaluate(f"tw.setVisionViewer('{seat}')"); await sight_settled()
        check(not await pg.evaluate(SEES(22.5, 12.5)) and await pg.evaluate(SEES(7.5, 20)), 'control: a plain wall section on the line blocks what is behind it; the bars beside it do not')
        await pg.evaluate("tw.setVisionViewer('gm')"); await pg.evaluate("tw.undo()"); await idle(pg); await pg.evaluate("tw.undo()"); await idle(pg)
        check(await pg.evaluate(f"!!tw.ent('{bars[3]['id']}') && !tw.ent('{wid}')"), 'undo puts the bars section back in place of the wall', await pg.evaluate(f"[!!tw.ent('{bars[3]['id']}'), !!tw.ent('{wid}')]"))
        await pg.evaluate(f"tw.dispatch('token.move',{{id:'tok_barsmira01',x:7.5,z:5}})"); await idle(pg)
        if did:
            hinge = f"(() => {{ const r = tw.worldOf(tw.area()).recs.get('{did}'); let t = null; r?.group.traverse(o => {{ if (o.userData.hinge) t = o.userData.hinge.t; }}); return t; }})()"
            await wait(pg, f"{hinge} !== null", 30000)
            check(await pg.evaluate(hinge) == 0, 'the shut cage door hangs on its hinge, closed')
            await pg.evaluate(f"tw.toggleOpen(tw.ent('{did}'))"); await idle(pg); await pg.wait_for_timeout(800)
            check(await pg.evaluate(f"tw.ent('{did}').open === true"), 'Open opens the cage door')
            await wait(pg, f"{hinge} === 1", 30000); check(await pg.evaluate(hinge) == 1, 'it is drawn swung open (the hinge at 1)')
            check(await pg.evaluate(f"({DICE})('{did}')") == [], 'open, it no longer stops a die')
            await pg.evaluate(f"tw.setVisionViewer('{seat}')"); await sight_settled()
            check(await pg.evaluate(SEES(12.5, 20)), 'open, sight passes as before')
            await pg.evaluate("tw.setVisionViewer('gm')")
            await pg.evaluate('tw.clearSelection()'); await look(pg, 15, 12, dist=55, pitch=58); await pg.wait_for_timeout(2500); await snap(pg, 'bars-door-open')
            await pg.evaluate(f"tw.toggleOpen(tw.ent('{did}'))"); await idle(pg)
            check(await pg.evaluate(f"!tw.ent('{did}').open"), 'Close shuts it again'); await wait(pg, f"{hinge} === 0", 30000)
            check(await pg.evaluate(f"({DICE})('{did}')") == [9], 'shut again, it stops a die again')

        # ---------- WALL: onto the room's own south wall line (z = 25) ----------
        await look(pg, 15, 20, dist=55)
        key = await pg.evaluate("(() => { const e = [...tw.worldOf(tw.area()).edges.values()].find(e => e.dir === 'h' && e.gz === 5 && e.gx === 1); return e ? e.key : null; })()")
        old = await pg.evaluate('Object.keys(tw.entities())')
        await enter('cell bars', 'cell-bars'); await click_edge(7.5, 25.2, shift=False)
        made = await pg.evaluate(NEW, old)
        check(key and any(e.get('kind') == 'edge' and e.get('key') == key and e.get('as') == 'open' for e in made) and any(e.get('cat') == 'cell-bars' and e['z'] == 25 for e in made), 'on the wall line the section takes the generated wall\'s place', [(e.get('kind'), e.get('key') or e.get('cat')) for e in made])

        # ---------- WIDE: the portcullis on open ground ----------
        old = await pg.evaluate('Object.keys(tw.entities())')
        await look(pg, 50, 10, dist=45)
        await enter('portcullis', 'portcullis'); await click_edge(51.1, 10.3, shift=False)
        made = [e for e in await pg.evaluate(NEW, old) if e.get('cat') == 'portcullis']
        check(len(made) == 1 and made[0]['x'] == 50 and made[0]['z'] == 10 and 9 <= made[0]['dims'][0] <= 11, 'the portcullis is centred on a grid cross, 10 ft across', [(e['x'], e['z'], e['dims']) for e in made])

        # ---------- PAINT: press and drag along a line lays a run of bars in one command (open ground, z = 60) ----------
        await look(pg, 12, 60, dist=55)
        await enter('iron bars', 'cell-bars')
        old = await pg.evaluate('Object.keys(tw.entities())'); n0 = await pg.evaluate('tw.sync.pendingCount()')
        a = await pg.evaluate('tw.screenOf(2.6,60.3,tw.main,0)'); m = await pg.evaluate('tw.screenOf(13,61,tw.main,0)'); z = await pg.evaluate('tw.screenOf(22.4,61.4,tw.main,0)')
        await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move(m['x'], m['y'], steps=6); await pg.mouse.move(z['x'], z['y'], steps=6); await pg.wait_for_timeout(200)
        info = await pg.evaluate('tw.modes.runInfo()')
        check(info == [f'h:{g}:12' for g in range(5)], 'while dragging, the run is the five edges from the press to the pointer, along the press line', info)
        await snap(pg, 'bars-paint-preview')
        await pg.mouse.up(); await idle(pg)
        run = sorted([e for e in await pg.evaluate(NEW, old) if e.get('cat') == 'cell-bars'], key=lambda e: e['x'])
        check([(e['x'], e['z']) for e in run] == [(5 * g + 2.5, 60) for g in range(5)], 'letting go lays five sections end to end', [(e['x'], e['z']) for e in run])
        check(await pg.evaluate("tw.mode === null || tw.mode?.cat?.id !== 'cell-bars'"), 'the placement ends with the stroke (Shift keeps it)')
        await pg.evaluate('tw.undo()'); await idle(pg)
        check(not [e for e in await pg.evaluate(NEW, old) if e.get('cat') == 'cell-bars'], 'one undo takes the whole run away')
        await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel()')

        # ---------- CORNER: an L of bars on open ground (z = 80), the iron post at its corner and its two free ends ----------
        await look(pg, 10, 82, dist=45)
        old = await pg.evaluate('Object.keys(tw.entities())')
        await enter('iron bars', 'cell-bars')
        a = await pg.evaluate('tw.screenOf(2.6,80.2,tw.main,0)'); z = await pg.evaluate('tw.screenOf(12.4,80.3,tw.main,0)')
        await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move(z['x'], z['y'], steps=8); await pg.mouse.up(); await idle(pg)
        await enter('iron bars', 'cell-bars')
        a = await pg.evaluate('tw.screenOf(15.2,82.6,tw.main,0)'); z = await pg.evaluate('tw.screenOf(15.3,87.4,tw.main,0)')
        await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move(z['x'], z['y'], steps=8); await pg.mouse.up(); await idle(pg)
        places = [r for r in await bar('bars post') if r.startswith('cat:')]
        check(places[:1] == ['cat:cell-bars-post'], 'bar "bars post" -> cell-bars-post first to place', places[:3])
        await enter('corner post', 'cell-bars-post')
        for (x, zz) in [(15.1, 80.1), (0.1, 80.1), (15.1, 89.9)]: await click_edge(x, zz)
        await pg.keyboard.press('Escape'); await pg.evaluate('tw.modes.cancel();tw.clearSelection()')
        made = await pg.evaluate(NEW, old)
        posts = sorted((e['x'], e['z']) for e in made if e.get('cat') == 'cell-bars-post'); secs = [e for e in made if e.get('cat') == 'cell-bars']
        check(posts == [(0, 80), (15, 80), (15, 90)], 'the posts snap to the corner and the two free ends (grid crosses)', posts)
        check(sorted((e['x'], e['z']) for e in secs) == [(2.5, 80), (7.5, 80), (12.5, 80), (15, 82.5), (15, 87.5)], 'two painted runs make the L: three along, two down (a run down a v line too)', sorted((e['x'], e['z']) for e in secs))
        pe = [e for e in made if e.get('cat') == 'cell-bars-post']
        check(all(8.5 <= e['dims'][1] <= 9.5 for e in pe), 'a post is a storey tall', [e['dims'] for e in pe][:1])
        await pg.evaluate("tw.setVisionViewer('gm')")
        await look(pg, 9, 85, dist=40, pitch=55, yaw=0.5); await pg.wait_for_timeout(2500); await snap(pg, 'bars-corner')

        # ---------- YARD EDGES: fences, hedges and dry-stone walls from the bar (Harry 2026-10-27) ----------
        await look(pg, 30, 45, dist=55)
        for i, (q, cat, post) in enumerate([('picket fence', 'fence-picket', False), ('wattle', 'fence-wattle', False), ('field gate', 'gate-fence', False), ('hedge', 'hedge-straight', False),
                                             ('hedgerow', 'hedge-straight', False), ('hedge arch', 'hedge-gap-arch', False), ('hedge', 'hedge-end-block', True), ('dry stone wall', 'wall-drystone', False),
                                             ('stone wall', 'wall-drystone-pier', True), ('stone wall', 'wall-drystone-gate', False)]):
            places = [r for r in await bar(q) if r.startswith('cat:')]
            check(f'cat:{cat}' in places[:3], f'bar "{q}" -> {cat} among the first three to place', places[:3])
            if not i or cat in ('hedge-end-block', 'wall-drystone-pier', 'wall-drystone-gate', 'hedge-gap-arch', 'gate-fence') or q in ('picket fence', 'wattle', 'dry stone wall', 'hedge'):
                if f'cat:{cat}' not in places[:3]: continue
                await pg.locator(f'#results .res[data-ref="cat:{cat}"]').first.click(); await pg.wait_for_timeout(250)
                if not await pg.evaluate(f"tw.mode?.cat?.id === '{cat}'"): check(False, f'Enter on "{q}" enters placement of {cat}', await pg.evaluate('tw.mode?.cat?.id')); continue
                old = await pg.evaluate('Object.keys(tw.entities())')
                x, z = 5 * i + 2.6, 45.2
                await click_edge(x, z, shift=False)
                made = [e for e in await pg.evaluate(NEW, old) if e.get('cat') == cat]
                want = (5 * i + 2.5, 45) # (a post snaps to the nearest cross or edge midpoint: here the midpoint)
                check(len(made) == 1 and (made[0]['x'], made[0]['z']) == want, f'{cat} placed by hand on the grid ({"a point" if post else "an edge"})', [(e['x'], e['z']) for e in made])

        # ---------- SHELF ----------
        cov = await pg.evaluate('tw.library.coverage()')
        check(not [m for m in cov['missing'] if any(c in m for c in ('cell-bars', 'portcullis'))], 'every bars piece is on a library shelf', cov['missing'][:5])
        check(not errors, 'no page errors', errors[:3])
        await b.close()
    print(f'{sum(results)}/{len(results)} passed', flush=True)
    return all(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
    tw_sandbox.remove_campaigns()
sys.exit(0 if ok else 1)
