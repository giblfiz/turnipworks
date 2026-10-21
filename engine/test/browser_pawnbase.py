#!/usr/bin/env python3
"""A raised pawn: the base stays on the ground, a beam joins base and figure, the cut asks the base
(Harry 2026-10-13; docs/PAWNS.md "A raised pawn", docs/VERTICAL.md "Flyers"). GM tab + player tab, a local relay.

  DRAGON   outdoors, raised to 40 ft, the cut at 20 ft: the whole pawn is drawn (base on the ground, beam, figure);
           the reverse: a pawn standing on the third floor is hidden when looking into the first
  STEPS    the base under a raised pawn as it is dragged: open ground, a yard, a table top, the upper floor, a roof
           (the room's top; with roofs showing, the roof's own surface), and back
  PICK     a click on the figure and a click on the base both select the pawn; a floor still stops the pointer
  CAUGHT   a sphere reaches the raised figure, a circle on the ground does not
  SEATS    a second seat sees the same base and beam; undo; reload

  TW_GPU=1 python3 engine/test/browser_pawnbase.py --local [--shots DIR]
  ... --page <game url>     against a deployed client (makes a throwaway campaign, removed at exit)
"""
import argparse, asyncio, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')
tw_sandbox.remove_campaigns()  # the campaign this suite makes is a throwaway: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail and not ok else ''}", flush=True)
RP, SP = 18097, 18722
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pawnbase-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])  # /tmp is RAM: both are removed at exit
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500&nofx'
async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
W = "tw.worldOf(tw.area())"
VIEW = "(() => { const g = tw.main.grab; g.focus.set(55, 0, 30); g.pitch = 52; g.yaw = 0; g.dist = 145; g.update(); tw.main.rule = 'free'; })()"
DRAGON, THIRD, INNER, GROUND = 'tok_pbdragon001', 'tok_pbthird0001', 'tok_pbinner0001', 'tok_pbground001'
OX, OZ = 102.5, 62.5  # a square of open ground, clear of every room

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro&nofx'
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            pg = await (await browser.new_context(viewport={'width': 1400, 'height': 900})).new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); await pg.goto(url); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST pawn base {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        # This suite compares base geometry between seats. New campaigns default
        # to fog, which can correctly hide the dragon from the player entirely;
        # fog visibility has its own dedicated browser coverage.
        await gm.evaluate("tw.dispatch('campaign.set', { defaults: { fogOfWar: false } })")
        await wait(gm, '!tw.fog.active() && tw.sync.pendingCount() === 0', 10000, 'fog off for shared base geometry')
        R = {}
        async def build(name, **a):
            rid = f"room_b{name}{random.randrange(10**6):06d}"[:24]; R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name)
        await gm.evaluate(VIEW)
        await build('inn', type='common', x=0, z=0, w=6, d=4, seed=7101); await settle(gm)
        await build('up', type='guest', x=0, z=0, w=4, d=4, y=10, seed=7102)
        await build('third', type='guest', x=0, z=0, w=2, d=4, y=20, seed=7103)
        await build('yard', type='yard', x=8, z=0, w=4, d=4, seed=7104); await settle(gm); await gm.wait_for_timeout(2500)
        base = lambda pg, id: pg.evaluate(f"tw.pawnBase('{id}')")
        async def move(id, x, z, y, pg=None): await (pg or gm).evaluate(f"tw.dispatch('token.move', {{ id: '{id}', x: {x}, z: {z}, y: {y} }})"); await wait(pg or gm, 'tw.sync.pendingCount() === 0', 5000); await (pg or gm).wait_for_timeout(250)
        async def shot(name):
            if A.shots: os.makedirs(A.shots, exist_ok=True); await gm.screenshot(path=os.path.join(A.shots, name + '.png'))
        fig = await gm.evaluate("['foe-dragon-wyrmling', 'foe-goblin-bow'].find(id => tw.assets.figures.get(id)) || tw.assets.figures.list[0]?.id || null")
        beamC = await gm.evaluate('tw.pawnBeam()')

        print('DRAGON: the cut asks the base')
        await gm.evaluate(f"""(async () => {{
          await tw.dispatch('token.create', {{ id: '{DRAGON}', name: 'Dragon', x: {OX}, z: {OZ}, color: '#3fa7ff'{f", fig: '{fig}'" if fig else ''} }});
          await tw.dispatch('token.create', {{ id: '{THIRD}', name: 'Lookout', x: 7.5, z: 12.5, y: 20, color: '#e0563a' }});
          await tw.dispatch('token.create', {{ id: '{INNER}', name: 'Cook', x: 12.5, z: 12.5, color: '#58c06a' }});
          await tw.dispatch('token.create', {{ id: '{GROUND}', name: 'Squire', x: {OX + 10}, z: {OZ}, color: '#c9a227' }}); }})()""")
        await wait(gm, 'tw.sync.pendingCount() === 0', 8000); await gm.wait_for_timeout(1500)
        b0 = await base(gm, DRAGON)
        check(b0 and b0['drop'] == 0 and b0['beam'] is None and abs(b0['baseY'] - b0['figureY']) < 0.01, 'standing on the ground: the base is under its feet, no beam', b0)
        await move(DRAGON, OX, OZ, 40)
        b = await base(gm, DRAGON)
        check(fig and b['fig'] == fig and b['nameOnBase'], 'it wears a figure, and its name is lettered on the base', [fig, b['fig'], b['nameOnBase']])
        check(b['figureY'] == 40 and abs(b['baseY']) < 0.05 and b['drop'] == 40 and b['on'] == 'ground' and b['level'] == 0, 'raised to 40 ft outdoors: the figure is at 40, the base on the ground', b)
        bm = b['beam'] or {}
        check(bm and bm['color'] == '#3fa7ff' and abs(bm['from']) < 0.05 and abs(bm['length'] - 40.12) < 0.05 and bm['label'] == '40 ft' and abs(bm['labelY'] - 40 * beamC['labelAt']) < 0.1 and bm['visible'] and bm['radius'] >= beamC['radius'] and bm['casing'] > bm['radius'], 'a beam in the pawn\'s colour joins them, base to feet, with "40 ft" on it', bm)
        await gm.evaluate("tw.setCut(20, { by: 'test' })"); await gm.wait_for_timeout(500)
        b = await base(gm, DRAGON); ci = await gm.evaluate('tw.cutInfo()')
        check(b['visible'] and b['beam'] and b['beam']['visible'] and abs(b['baseY']) < 0.05, 'HARRY\'S TEST: the cut at 20 ft, the dragon at 40 ft outdoors is drawn whole (base, beam, figure)', b)
        check(ci['pawnsAbove'] == 0, 'the meter counts no pawn above that cut (the third floor is AT 20 ft; the dragon is counted by its base)', ci.get('pawnsAbove'))
        await shot('dragon-cut20')
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['inn']}'], 'test')"); await gm.wait_for_timeout(500)
        b = await base(gm, DRAGON); t3 = await base(gm, THIRD); cook = await base(gm, INNER); ci = await gm.evaluate('tw.cutInfo()')
        check(ci['pawnsAbove'] == 1, 'looking into the first floor the meter counts one pawn above: the lookout, not the dragon', ci.get('pawnsAbove'))
        check(b['visible'] and not t3['visible'] and cook['visible'] and t3['level'] == 20, 'THE REVERSE: looking into the first floor, a pawn standing on the third is hidden; the dragon and the cook show', {'dragon': b['visible'], 'third': t3, 'cook': cook['visible']})
        await move(THIRD, 7.5, 12.5, 45); t3 = await base(gm, THIRD)
        check(not t3['visible'] and t3['level'] == 30, 'raised to 45 ft over the third floor, its base is on that room\'s top (30 ft): still hidden from the first floor', t3)
        await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(500); t3 = await base(gm, THIRD)
        check(t3['visible'] and abs(t3['baseY'] - 30) < 0.05 and t3['drop'] == 15 and t3['beam']['label'] == '15 ft', 'all levels: it shows, base on the top at 30 ft, "15 ft" on its beam', t3)
        await move(THIRD, 7.5, 12.5, 20)

        print('STEPS: the base falls to the highest ground under the figure')
        tbl = await gm.evaluate(f"""(async () => {{ const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{R['inn']}');
          const w = {W}, big = (e) => e.place === 'floor' && !e.flat && !e.parent && e.dims[1] > 1.8 && e.dims[1] < 4.5 && e.dims[0] > 2.5 && e.dims[2] > 2.5 && !w.recs.get(e.id)?.visual?.userData?.placeholder && !!w.surfaceBelow(e.x, 7, e.z, new Set(), 0);
          const t = es.find(e => big(e) && /table/i.test(e.cat + ' ' + e.name)) || es.find(big); return t ? {{ id: t.id, x: t.x, z: t.z, top: t.dims[1], name: t.name, sb: w.surfaceBelow(t.x, 7, t.z, new Set(), 0).y }} : null; }})()""")
        async def drag_to(x, z, y=None):  # the pawn as it is drawn mid-drag (what a drag sets each frame), then what is under it
            await gm.evaluate(f"tw.localDrags.set('{DRAGON}', {{ x: {x}, z: {z}{'' if y is None else f', y: {y}'} }})"); await gm.wait_for_timeout(180); return await base(gm, DRAGON)
        s = await drag_to(52.5, 12.5)
        check(abs(s['baseY']) < 0.05 and s['on'] == 'floor' and s['room'] == R['yard'] and s['drop'] == 40, 'dragged over the yard (no walls, no roof): the base is on the yard\'s ground', s)
        s = await drag_to(27.5, 17.5)
        check(abs(s['baseY'] - 10) < 0.05 and s['on'] == 'top' and s['drop'] == 30 and s['beam']['label'] == '30 ft', 'over the inn\'s one-storey part: up onto its roof (the room\'s top, 10 ft)', s)
        s = await drag_to(12.5, 12.5)
        check(abs(s['baseY'] - 20) < 0.05 and s['on'] == 'top' and s['room'] == R['up'], 'over the two-storey part: up onto that roof (20 ft)', s)
        s = await drag_to(12.5, 12.5, 15)
        check(abs(s['baseY'] - 10) < 0.05 and s['on'] == 'floor' and s['room'] == R['up'] and s['drop'] == 5, 'lowered to 15 ft there (inside the upper room): the base is on the upper floor', s)
        if tbl:
            s = await drag_to(tbl['x'], tbl['z'], 7)
            check(s['on'] == 'thing' and abs(s['baseY'] - tbl['sb']) < 0.02 and s['baseY'] > 1 and abs(s['drop'] - (7 - s['baseY'])) < 0.02 and s['level'] == 0, f"7 ft up over a table in the inn: the base is on the table top ({tbl['name']}, {tbl['top']} ft)", s)
            await shot('on-table')
        else: check(False, 'a table to stand over', 'the inn rolled none')
        s = await drag_to(OX + 20, OZ)
        check(abs(s['baseY']) < 0.05 and s['on'] == 'ground', 'and back out over open ground: down to the ground', s)
        await gm.evaluate(f"tw.localDrags.delete('{DRAGON}')"); await gm.wait_for_timeout(200)
        await gm.evaluate("tw.setRoofs(true, 'test'); tw.cutOff('test')"); await wait(gm, f"{W}.roofReport().some(r => r.shown)", 8000, 'roofs'); await gm.wait_for_timeout(1500)
        await move(DRAGON, 27.5, 17.5, 40); await gm.wait_for_timeout(600); s = await base(gm, DRAGON)
        check(s['visible'] and s['baseY'] >= 9.9 and s['baseY'] < 30 and s['on'] in ('roof', 'top') and abs(s['drop'] - (40 - s['baseY'])) < 0.02, 'with roofs showing, the base sits on the roof\'s own surface over that room', s)
        await shot('on-roof'); await gm.evaluate("(() => { const g = tw.main.grab; g.dist = 330; g.update(); })()"); await gm.wait_for_timeout(500); await shot('far'); far = await base(gm, DRAGON); await gm.evaluate(VIEW)
        check(far['beam']['radius'] > s['beam']['radius'] * 1.5, 'from far off the beam is drawn thicker, so it still reads', [far['beam']['radius'], s['beam']['radius']])
        await gm.evaluate("tw.setRoofs(false, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(600)
        await move(DRAGON, OX, OZ, 40)
        # a real drag with the mouse, by the figure: it keeps its height, the base follows under it
        fs = await gm.evaluate(f"tw.screenOf({OX}, {OZ}, tw.main, 42.2)")
        to = await gm.evaluate(f"(() => {{ const g = tw.groundAt({fs['x']}, {fs['y']}); return tw.screenOf(g[0] + (52.5 - {OX}), g[1] + (12.5 - {OZ}), tw.main, 0); }})()")
        await gm.mouse.move(fs['x'], fs['y']); await gm.mouse.down(); await gm.mouse.move(fs['x'] + 12, fs['y'] - 8, steps=3); await gm.mouse.move(to['x'], to['y'], steps=12); await gm.wait_for_timeout(350)
        mid = await base(gm, DRAGON)
        await gm.mouse.up(); await wait(gm, 'tw.sync.pendingCount() === 0', 5000); await gm.wait_for_timeout(400)
        e = await gm.evaluate(f"tw.entities()['{DRAGON}']"); s = await base(gm, DRAGON)
        check(mid['figureY'] == 40 and abs(mid['baseY']) < 0.05 and mid['room'] == R['yard'] and (e.get('y') or 0) == 40 and abs(e['x'] - 52.5) < 0.1 and abs(e['z'] - 12.5) < 0.1 and abs(s['baseY']) < 0.05, 'dragged by its figure with the mouse to the yard: it stays 40 ft up, the base is under it all the way', {'mid': mid, 'e': [e['x'], e['z'], e.get('y')]})
        await move(DRAGON, OX, OZ, 40)

        print('PICK: by the figure, by the base; a floor still stops the pointer')
        LP = [None]
        async def click_sel(x, z, y):
            await gm.evaluate('tw.select([])'); sp = await gm.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})"); await gm.mouse.move(sp['x'], sp['y']); await gm.mouse.click(sp['x'], sp['y']); await gm.wait_for_timeout(350); LP[0] = await gm.evaluate('tw.lastPress && tw.lastPress.hits'); return await gm.evaluate('[...tw.sel]')
        check(await click_sel(OX, OZ, 42.2) == [DRAGON], 'a click on the figure 40 ft up selects the pawn')
        rg = await gm.evaluate('tw.ringGeom()'); fsp = await gm.evaluate(f"tw.screenOf({OX}, {OZ}, tw.main, 42.2)"); bsp = await gm.evaluate(f"tw.screenOf({OX}, {OZ}, tw.main, 0)")
        check(rg and abs(rg['cy'] - fsp['y']) < 60 and abs(rg['cy'] - bsp['y']) > 80, 'its ring opens round the figure (not half-way down the beam)', {'ring': rg, 'figure': fsp, 'base': bsp})
        await shot('selected')
        check(await click_sel(OX + 1.3, OZ + 0.6, 0.25) == [DRAGON], 'a click on the base on the ground selects the same pawn')
        hits = await gm.evaluate(f"(() => {{ const s = tw.screenOf({OX}, {OZ}, tw.main, 20); return {W}.pickAll(tw.rayAt(s.x, s.y)).map(h => h.entity?.id).filter(Boolean); }})()")
        check(DRAGON not in hits, 'the beam itself never catches a click', hits)
        await gm.evaluate("tw.setCut(20, { by: 'test' })"); await gm.wait_for_timeout(400)
        a1 = await click_sel(OX, OZ, 42.2); l1 = LP[0]; a2 = await click_sel(OX + 1.3, OZ + 0.6, 0.25)
        check(a1 == [DRAGON] and a2 == [DRAGON], 'with the cut at 20 ft: still picked by the figure and by the base', [a1, l1, a2, LP[0]])
        await gm.evaluate("tw.cutOff('test')"); await move(INNER, 12.5, 7.5, 6); await gm.wait_for_timeout(300)
        ck = await base(gm, INNER)
        check(ck['baseY'] < 5 and ck['beam'] and ck['room'] == R['inn'], 'the cook raised 6 ft inside the inn: base on the inn\'s floor (or what stands there)', ck)
        got_f = await click_sel(12.5, 7.5, 8); got_b = await click_sel(13.6, 8.0, 0.25)
        check(INNER not in got_f and INNER not in got_b, 'all levels showing, the floor above is in the way: neither its figure nor its base is picked through it', [got_f, got_b])
        await gm.evaluate(f"tw.cutToRoom(tw.entities()['{R['inn']}'], 'test')"); await gm.wait_for_timeout(500)
        got_f = await click_sel(12.5, 7.5, 8); l1 = LP[0]; got_b = await click_sel(13.6, 8.0, 0.25)
        check(got_f == [INNER] and got_b == [INNER], 'looking into the inn: picked by its figure and by its base', [got_f, l1, got_b, LP[0]])
        await gm.evaluate("tw.cutOff('test'); tw.select([])"); await move(INNER, 12.5, 7.5, 0)

        print('CAUGHT: a sphere reaches the figure, a circle on the ground does not')
        async def caught(kind):
            await gm.evaluate(f"tw.rulers.start({{ x: {OX}, y: 0, z: {OZ} }}, {{ x: {OX + 45}, y: 0, z: {OZ} }}, '{kind}')"); await gm.wait_for_timeout(450)
            it = await gm.evaluate(f"(tw.rulers.state().items.find(i => i.kind === '{kind}') || null)"); ys = await gm.evaluate(f"{W}.layers.deco.children.filter(c => c.userData.ruler && c.children.length === 2 && c.visible).map(c => +c.position.y.toFixed(2))")
            await gm.evaluate('tw.rulers.cancel()'); await gm.wait_for_timeout(150); return it, ys
        sp, ys = await caught('sphere')
        check(sp and DRAGON in sp['caught'] and GROUND in sp['caught'], 'a 45-ft sphere on the ground under it catches the figure 40 ft up (and the squire beside it)', sp and sp['caught'])
        check(ys and all(y < 1.5 for y in ys), 'the caught ring is round the base on the ground, not up in the air', ys)
        ci, _ = await caught('circle')
        check(ci and DRAGON not in ci['caught'] and GROUND in ci['caught'], 'a 45-ft circle there catches the squire and not the dragon overhead', ci and ci['caught'])

        print('SEATS: a second seat, undo, X-ray, hide, reload')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Brakka', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite')
        invite = [w for w in (await gm.evaluate("document.querySelector('#output textarea').value")).split() if '#s=' in w][0]; await gm.keyboard.press('Escape')
        pl = await tab(invite)
        check(await wait(pl, 'window.tw && tw.ready && tw.ready() && !tw.fog.active()', 45000), 'player tab live with shared base geometry'); await pl.evaluate(VIEW); await pl.wait_for_timeout(2500)
        g, q = await base(gm, DRAGON), await base(pl, DRAGON)
        check(q and q['visible'] and q['figureY'] == 40 and abs(q['baseY']) < 0.05 and q['beam'] and q['beam']['color'] == g['beam']['color'] and q['beam']['label'] == '40 ft', 'the player sees the same thing: figure at 40 ft, base on the ground, the same beam', q)
        await pl.evaluate("tw.setCut(19, { by: 'test' })"); await pl.wait_for_timeout(400); q = await base(pl, DRAGON)
        check(q['visible'] and (await base(gm, THIRD))['visible'] and not (await base(pl, THIRD))['visible'], 'the cut is each seat\'s own: at 19 ft on the player\'s screen the dragon shows and the lookout does not; the GM still sees both')
        await pl.evaluate("tw.cutOff('test')")
        await move(DRAGON, 52.5, 12.5, 40); await wait(pl, f"Math.abs(tw.pawnBase('{DRAGON}').figureY - 40) < 0.01 && tw.entities()['{DRAGON}'].x === 52.5", 5000); await pl.wait_for_timeout(400); q = await base(pl, DRAGON)
        check(abs(q['baseY']) < 0.05 and q['room'] == R['yard'], 'moved by the GM over the yard: the player\'s copy of the base is on the yard too', q)
        await gm.evaluate('tw.undo()'); await wait(gm, f"tw.entities()['{DRAGON}'].x === {OX}", 5000); await gm.wait_for_timeout(400); s = await base(gm, DRAGON)
        check(s['figureY'] == 40 and abs(s['baseY']) < 0.05 and s['on'] == 'ground', 'undo: back over open ground, still 40 ft up on its beam', s)
        await move(DRAGON, OX, OZ, 0); s = await base(gm, DRAGON)
        check(s['drop'] == 0 and s['beam'] is None and abs(s['baseY'] - s['figureY']) < 0.01, 'lowered to the ground: the base is under its feet again, the beam is gone', s)
        await gm.evaluate('tw.undo()'); await wait(gm, f"(tw.entities()['{DRAGON}'].y || 0) === 40", 5000); await gm.wait_for_timeout(400); s = await base(gm, DRAGON)
        check(s['drop'] == 40 and s['beam'] and s['beam']['label'] == '40 ft', 'undo: raised again, beam and all', s)
        await gm.evaluate('tw.setXray(true, { quiet: true })'); await gm.wait_for_timeout(500)
        xr = await gm.evaluate(f"tw.xrayInfo().pawns.find(p => p.id === '{DRAGON}')")
        check(xr and xr['meshes'] > 0, 'the GM\'s pawn X-ray draws it (figure and base where they are)', xr)
        await shot('xray'); await gm.evaluate('tw.setXray(false, { quiet: true })')
        await gm.evaluate(f"tw.flag(['{DRAGON}'], {{ hidden: true }})"); await wait(pl, f"!tw.entities()['{DRAGON}']", 6000, 'hidden from the player'); await gm.wait_for_timeout(500)
        s = await base(gm, DRAGON)
        check(await pl.evaluate(f"!tw.entities()['{DRAGON}'] && !tw.pawnBase('{DRAGON}') && !{W}.heightLabels().some(h => h.id === '{DRAGON}')") and s['beam'] and s['visible'], 'hidden from players: the player has no pawn, base or beam; the GM keeps all three')
        await gm.evaluate(f"tw.flag(['{DRAGON}'], {{ hidden: false }})"); await wait(pl, f"!!tw.entities()['{DRAGON}']", 6000, 'revealed'); await pl.wait_for_timeout(600); q = await base(pl, DRAGON)
        check(q and q['beam'] and abs(q['baseY']) < 0.05, 'revealed: the player has it back, base on the ground', q)
        await gm.reload(); check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM reloaded'); await gm.evaluate(VIEW); await settle(gm); await gm.wait_for_timeout(2500)
        s = await base(gm, DRAGON); e = await gm.evaluate(f"tw.entities()['{DRAGON}']")
        check(s and s['figureY'] == 40 and abs(s['baseY']) < 0.05 and s['beam'] and s['beam']['label'] == '40 ft' and not any(k in e for k in ('base', 'baseY', 'foot')), 'after a reload the saved pawn is the same: only its height is stored, the base is worked out', {'s': s, 'keys': sorted(e.keys())})
        real = [x for x in errors if 'WebSocket' not in x]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0]); print(f'pawnbase: {passed}/{len(results)} passed'); return passed == len(results)

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
sys.exit(0 if ok else 1)
