#!/usr/bin/env python3
"""The underground shows through the ground from above (2026-11-03). Harry: "I think that it probably looks better by
default if we can see underground structures even when we're overground. But they would just have a level of, you
know, a level of fade to them that's relatively aggressive, right? And we already have that code for sure. It's just,
I think it should basically always be running." docs/VERTICAL.md "The underground shows from above", docs/UI.md "Hills".

What this drives, in a real browser, as a GM and a player would:
  the GM       at the ground level (lv 1 in the meter, goLevel(0)) and at lv 2 (goLevel(10)) a cellar under a house, a
               dungeon room under the open ground, a cave and a cave under a hill all show through the ground (the
               picture over them changes), at the campaign's default `underSee`; with the cut off too
  the surface  away from the underground, and on a barrel standing on the ground over a cellar, the picture is the same
               pixel for pixel with the underground shown or not; no material of the ground or the hill is touched
  the slider   Settings ▸ House look ▸ Above the ground: underground shows: live, kept by the campaign when let go,
               Copy and Reset; at 0 nothing shows (the picture is the old one)
  picks        at the ground level a click over the cellar on the open ground hits the ground (and what stands on it),
               never the cellar or its things; the double-click's room and the ping point are the ground's
  below        at lv -1 nothing of it runs: the picture is the same at any `underSee` (the ground and hills fade there
               by their own sliders, as before)
  cost         a still view draws the underground once, not every frame; the frame time with it on and off on a map of
               24 furnished libraries (~1,200 things) with four cellars under it
  privacy      a player whose pawn is in one cellar: from the ground level that cellar shows through, a cellar nobody
               has seen does not (not listed, and the picture over it is the old one), a hidden one is not even there
  errors       no page errors anywhere

  local:  TW_PORTS=18233,18833 python3 engine/test/browser_undersee.py --local
  --shots DIR   also save 3/4 pictures at the ground level (the lighting stack on) with the underground off and on, for a
                vision read; --sees 0.1,0.15,0.2 shoots once per value
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots'); ap.add_argument('--sees', default=''); ap.add_argument('--noperf', action='store_true'); ap.add_argument('--post', action='store_true', help='the lighting stack on (as players have it) without taking pictures'); ap.add_argument('--perfonly', action='store_true'); ap.add_argument('--uncapped', action='store_true', help='no vsync, no frame-rate limit: the real cost of a frame (perf_cases.py)')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18233,18833').split(','))
POST = '' if A.shots or A.post else '&nopost'
def start_local():
    data = tempfile.mkdtemp(prefix='tw-undersee-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
async def settle(pg, ms=60000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over'); await pg.wait_for_timeout(250)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
W = "tw.worldOf(tw.area())"
INFO = f"{W}.underInfo()"
# the screen rectangle (CSS px) of a world box's corners at a height, and the canvas's own
RECT = """((x0, z0, x1, z1, y) => { const ps = []; for (const x of [x0, x1]) for (const z of [z0, z1]) ps.push(tw.screenOf(x, z, tw.main, y)); return [Math.min(...ps.map(p => p.x)), Math.min(...ps.map(p => p.y)), Math.max(...ps.map(p => p.x)), Math.max(...ps.map(p => p.y))]; })"""
# what the pointer does at a screen point (browser_cut.py's AT): the pick, what a click would select, the double-click's room, the ping point
AT = """((x, y) => { const w = tw.worldOf(tw.area()), hits = w.pickAll(tw.rayAt(x, y)), t = tw.cutTargetAt(x, y), p = tw.pointAt(x, y);
  return { sel: hits.map(h => tw.selectionFor(h)).filter(Boolean), dbl: t.room ? t.room.id : t.ground ? 'ground' : null, pointY: p ? Math.round(p.y * 10) / 10 : null }; })"""

def png(b):
    from PIL import Image; import numpy as np
    return np.asarray(Image.open(io.BytesIO(b)).convert('RGB')).astype('int16')
def diff(a, b, r, pad=4):
    """mean absolute difference (0..255) of two pictures inside a rectangle [x0, y0, x1, y1] drawn in a little"""
    x0, y0, x1, y1 = [int(round(v)) for v in r]; x0 += pad; y0 += pad; x1 -= pad; y1 -= pad
    h, w = a.shape[:2]; x0, x1 = max(0, x0), min(w, x1); y0, y1 = max(0, y0), min(h, y1)
    if x1 <= x0 or y1 <= y0: return None
    return round(float(abs(a[y0:y1, x0:x1] - b[y0:y1, x0:x1]).mean()), 3)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + f'faces=1500{POST}'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, *(['--disable-frame-rate-limit', '--disable-gpu-vsync'] if A.uncapped else []), '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); pg = await ctx.new_page()
            await pg.add_init_script("try { const p = JSON.parse(localStorage.getItem('tw.prefs') || '{}'); p.linkMail = false; localStorage.setItem('tw.prefs', JSON.stringify(p)); } catch (e) {}") # (no "Keep your GM link" card over the pictures)
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' else None)
            await pg.goto(url); return pg
        async def setsee(pg, v):
            await pg.evaluate(f"tw.dispatch('campaign.set', {{ defaults: {{ underSee: {json.dumps(v)} }} }})")
            want = 'tw.worldOf(tw.area()).underSee === ' + (str(v) if v is not None else "(await import(new URL('world.js', document.baseURI).href)).UNDER_SEE")
            if v is None: await pg.wait_for_timeout(800)
            else: await wait(pg, f"tw.sync.pendingCount() === 0 && {W}.underSee === {v}", 8000, f'underSee {v}')
            await wait(pg, f"{W}.underShown === {W}.underSeeNow()", 30000, 'drawn at it') # (a frame has been drawn with it)
            await pg.wait_for_timeout(500)
        async def pic(pg, ms=700):
            # (a slow software renderer draws a frame or two a second: wait until the underground has been drawn the same
            # for a while, and a few more frames have gone by, so two pictures of the same thing are the same)
            await wait(pg, "(async () => { const w = tw.worldOf(tw.area()), d = w.underDraws || 0, f = tw.stats.frames; await new Promise(r => setTimeout(r, 1200)); return (w.underDraws || 0) === d && tw.stats.frames >= f + 2; })()", 60000, 'the picture still')
            await pg.wait_for_timeout(ms); return png(await pg.screenshot(timeout=180000))
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST undersee ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        await gm.evaluate("tw.dispatch('area.ground', { cat: 'floor-grass' })"); await gm.wait_for_timeout(600)
        DEF = await gm.evaluate("(async () => (await import(new URL('world.js', document.baseURI).href)).UNDER_SEE)()")
        check(0.05 <= DEF <= 0.3, 'the default is an aggressive fade (UNDER_SEE)', DEF)

        print('THE SCENE: a house with a cellar, a dungeon room under the open ground, a cave, a hill with a cave under it, a hidden cellar, a far cellar')
        # squares (5 ft): the house 0..6 x 0..5 over its cellar; the dungeon room 9..14 x 0..4; the cave -10..-4 x 0..5;
        # the hill 0..8 x 9..17 (10 ft) over a cave 2..6 x 11..15; a hidden cellar 17..21 x 0..4; a far cellar 9..13 x 8..12
        ids = await gm.evaluate("""(() => ({ house: tw.spawnRoom('common', 0, 0, 6, 5, 8101), cellar: tw.spawnRoom('cellar', 0, 0, 6, 5, 8102, undefined, -10),
          dungeon: tw.spawnRoom('cellar', 9, 0, 5, 4, 8103, undefined, -10), cave: tw.spawnRoom('cave', -10, 0, 6, 5, 8104, undefined, -10),
          hill: tw.spawnRoom('hill', 0, 9, 8, 8, 8105, undefined, 10), hillcave: tw.spawnRoom('cave', 2, 11, 4, 4, 8106, undefined, -10),
          hidden: tw.spawnRoom('cellar', 17, 0, 4, 4, 8107, undefined, -10), far: tw.spawnRoom('cellar', 9, 8, 4, 4, 8108, undefined, -10) }))()""")
        await wait(gm, f"Object.values({json.dumps(ids)}).every(id => !!tw.entities()[id]) && tw.sync.pendingCount() === 0", 15000, 'the rooms')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{ids['hidden']}'], hidden: true }})")
        await gm.evaluate("tw.dispatch('object.place', { id: 'obj_usbarrel01', x: 57.5, z: 7.5, cat: 'barrel', ...tw.roomgen.sizeOf('barrel') })") # (on the ground over the dungeon room)
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_uspawn0001', name: 'Bram', x: 57.5, z: 12.5, y: -10, color: '#e8d46a' })")  # (in the dungeon room)
        await wait(gm, "!!tw.entities()['obj_usbarrel01'] && !!tw.entities()['tok_uspawn0001'] && tw.sync.pendingCount() === 0", 8000, 'the barrel and the pawn')
        await gm.evaluate("tw.worldOf(tw.area()).terrain.ready"); await settle(gm); await gm.wait_for_timeout(1500)
        E = await gm.evaluate(f"(() => {{ const E = tw.entities(); return Object.fromEntries(Object.entries({json.dumps(ids)}).map(([k, id]) => [k, E[id] && {{ y: E[id].recipe.y || 0, type: E[id].recipe.type, hidden: !!E[id].hidden }}])); }})()")
        check(all(E.values()) and E['cellar']['y'] == -10 and E['hill']['y'] == 10 and E['hidden']['hidden'], '(fixture) the rooms are where they were put', E)

        if A.perfonly: await gm.evaluate("tw.goLevel(0, 'test')")
        else:
          print('THE GM, AT THE GROUND LEVEL')
          await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(600)
          await gm.evaluate("tw.freezeTime(true)")
          await view(gm, 15, 22, 150, 50, 20); await gm.wait_for_timeout(800)
          i0 = await gm.evaluate(INFO)
          under = [ids[k] for k in ('cellar', 'dungeon', 'cave', 'hillcave', 'hidden', 'far')]
          check(i0['see'] == DEF and i0['shown'] == DEF and all(r in i0['rooms'] for r in under) and ids['house'] not in i0['rooms'] and ids['hill'] not in i0['rooms'], 'every room under the ground is shown through it (the hidden one too: the GM sees it), nothing above it is in the list', i0)
          check('tok_uspawn0001' in i0['things'] and 'obj_usbarrel01' not in i0['things'], "the pawn in the dungeon room is in it, the barrel on the ground is not", i0['things'])
          check(i0['lid'] > 0 and i0['draws'] >= 1, 'the lid (the house floor, the hill top) is known, and the underground has been drawn', [i0['lid'], i0['draws'], i0['last']])
          MATS = f"(() => {{ const w = {W}, out = []; const look = (o) => o.traverse(m => {{ if (m.isMesh && m !== w.underQuad) for (const x of [].concat(m.material)) out.push(x.uuid + ':' + x.transparent + ':' + x.depthWrite + ':' + x.opacity.toFixed(3)); }}); look(w.ground); look(w.terrain.group); for (const s of w.shell.values()) if (!w.unseenUnder.has(s.roomId)) look(s.group); for (const r of w.recs.values()) if (r.entity.y == null || r.entity.y >= 0) look(r.group); return {{ n: out.length, key: out.sort().join('|'), ground: w.ground.material.transparent, quad: !!w.underQuad?.visible }}; }})()"
          on = await pic(gm); m_on = await gm.evaluate(MATS)
          await setsee(gm, 0); i_off = await gm.evaluate(INFO); off = await pic(gm); m_off = await gm.evaluate(MATS)
          check(m_on['n'] > 50 and m_on['key'] == m_off['key'] and not m_on['ground'] and not m_on['quad'], 'every material of the ground, the hills, the rooms and things above the ground is the same with the underground shown or not (and the quad is in the scene only while the main view draws)', [m_on['n'], m_on['key'] == m_off['key'], m_on['ground'], m_on['quad']])
          check(i_off['see'] == 0 and i_off['shown'] == 0, 'underSee 0: nothing is shown', i_off)
          R = {}
          for k, (x0, z0, x1, z1) in {'cellar': (0, 0, 30, 25), 'dungeon': (45, 0, 70, 20), 'cave': (-50, 0, -20, 25), 'hillcave': (10, 55, 30, 75), 'far': (45, 40, 65, 60), 'open': (-45, 60, -25, 80), 'open2': (80, 60, 100, 80)}.items():
              R[k] = await gm.evaluate(f"({RECT})({x0}, {z0}, {x1}, {z1}, {10 if k == 'hillcave' else 0})")
          bar = await gm.evaluate(f"(() => {{ const b = {W}.boundsOf({W}.recs.get('obj_usbarrel01')); const c = tw.screenOf((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, tw.main, (b.min.y + b.max.y) / 2); return [c.x - 3, c.y - 3, c.x + 3, c.y + 3]; }})()")
          d = {k: diff(on, off, r) for k, r in R.items()}; d['barrel'] = diff(on, off, bar, 0)
          print('    mean |on - off| over each place:', d)
          check(all((d[k] or 0) > 1.0 for k in ('cellar', 'dungeon', 'cave', 'far')), 'the picture over the cellar under the house, the dungeon room, the cave and the far cellar changes (they show through)', d)
          check((d['hillcave'] or 0) > 0.5, 'the cave under the hill shows through the hill top too', d['hillcave'])
          check(d['open'] == 0 and d['open2'] == 0, 'the open ground away from the underground is the same, pixel for pixel', [d['open'], d['open2']])
          check(d['barrel'] is not None and d['barrel'] < 0.5, 'a barrel standing on the ground over the dungeon room is not washed over (the ground is the lid, the barrel stands in front of it)', d['barrel'])
          await setsee(gm, None)

          print('STILL VIEW: drawn once, not every frame')
          n0 = (await gm.evaluate(INFO))['draws']; await gm.wait_for_timeout(1500); n1 = (await gm.evaluate(INFO))['draws']
          check(n1 - n0 <= 1, 'a still camera does not draw the underground again (draws in 1.5 s)', n1 - n0)
          await view(gm, 16, 22, 150, 50, 20); await wait(gm, f"{W}.underDraws > {n1}", 15000, 'drawn again'); n2 = (await gm.evaluate(INFO))['draws']
          check(n2 > n1, 'a moved camera does', n2 - n1)

          print('LV 2 AND THE CUT OFF')
          await gm.evaluate("tw.goLevel(10, 'test')"); await gm.wait_for_timeout(700); i1 = await gm.evaluate(INFO)
          check(i1['shown'] == DEF and all(r in i1['rooms'] for r in under), 'at lv 2 the underground shows through the ground too', i1)
          await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(700); i2 = await gm.evaluate(INFO)
          check(i2['shown'] == DEF and all(r in i2['rooms'] for r in under), 'with the cut off too', i2)

          print('PICKS AT THE GROUND LEVEL: the ground over the dungeon room takes the click')
          await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(600)
          await view(gm, 57, 10, 60, 70, 0); await gm.wait_for_timeout(500)
          pts = await gm.evaluate("[[47.5, 2.5], [62.5, 17.5], [52.5, 12.5], [67.5, 7.5]].map(([x, z]) => tw.screenOf(x, z, tw.main, 0))")
          at = [await gm.evaluate(f"({AT})({p['x']}, {p['y']})") for p in pts]
          dun = ids['dungeon']
          check(all(a['dbl'] == 'ground' and a['pointY'] == 0 and not any(dun in json.dumps(s) for s in a['sel']) for a in at), 'over the dungeon room: the double-click finds the ground, the point is on it (0 ft), no pick reaches the room under it', at)
          pp = await gm.evaluate("tw.screenOf(57.5, 12.5, tw.main, -9)") # (the pawn in the dungeon room, under the ground there)
          pa = await gm.evaluate(f"({AT})({pp['x']}, {pp['y']})")
          check(not any('tok_uspawn0001' in json.dumps(s) for s in pa['sel']) and pa['dbl'] == 'ground', 'the pawn shown faintly under the ground is not picked at the ground level', pa)
          bp = await gm.evaluate("(() => { const b = tw.worldOf(tw.area()).boundsOf(tw.worldOf(tw.area()).recs.get('obj_usbarrel01')); return tw.screenOf((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, tw.main, b.max.y - 0.3); })()")
          ba = await gm.evaluate(f"({AT})({bp['x']}, {bp['y']})")
          check(any('obj_usbarrel01' in json.dumps(s) for s in ba['sel']) and not any(dun in json.dumps(s) for s in ba['sel']), 'the barrel standing on the ground over it is still what the pointer takes there', ba)
          on_canvas = await gm.evaluate(f"document.elementFromPoint({pts[2]['x']}, {pts[2]['y']})?.id === 'c'") # (a room's label is a page element: a click on it takes the room, by design)
          await gm.evaluate("tw.select([])")
          if on_canvas: await gm.mouse.click(pts[2]['x'], pts[2]['y']); await gm.wait_for_timeout(400)
          check(await gm.evaluate("[...tw.sel]") == [], 'a click on the ground over the dungeon room selects nothing under it', await gm.evaluate("[...tw.sel]"))

          print('BELOW THE GROUND: unchanged')
          await gm.evaluate("tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(800)
          await view(gm, 15, 22, 150, 50, 20); await gm.wait_for_timeout(800)
          b1 = await pic(gm); ib = await gm.evaluate(INFO)
          await setsee(gm, 0); b0 = await pic(gm)
          await setsee(gm, 1); b2 = await pic(gm)
          full = [0, 0, 1280, 820]
          check(ib['see'] == 0 and ib['shown'] == 0 and diff(b1, b0, full, 0) == 0 and diff(b2, b0, full, 0) == 0, 'at lv -1 nothing of it runs: the picture is the same at underSee 0, the default and 1', [ib['see'], diff(b1, b0, full, 0), diff(b2, b0, full, 0)])
          await setsee(gm, None)

          print('THE SLIDER: Settings ▸ House look ▸ Above the ground: underground shows')
          await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(500)
          await gm.evaluate("tw.settings.show('house')"); await gm.wait_for_timeout(500)
          sl = await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-undersee]'); return el && { v: +el.value, out: el.nextElementSibling.textContent, label: el.closest('.srow')?.querySelector('label')?.textContent || '', row: el.closest('.srow')?.textContent.slice(0, 80), nextToBelow: !!document.querySelector('#settingsModal [data-groundsee]') }; })()")
          check(sl and abs(sl['v'] - DEF) < 1e-9 and sl['out'] == f'{DEF:.2f}' and sl['nextToBelow'] and 'Above the ground' in sl['row'], 'the slider is in House look beside the Below the ground pair, at the default', sl)
          if sl:
              await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-undersee]'); el.value = '0.4'; el.dispatchEvent(new Event('input')); })()"); await gm.wait_for_timeout(250)
              live = await gm.evaluate(f"[{W}.underSee, tw.sync.campaign.defaults.underSee ?? null]")
              check(live == [0.4, None], 'dragging it moves the view live, before the campaign has it', live)
              await gm.evaluate("(() => { const el = document.querySelector('#settingsModal [data-undersee]'); el.dispatchEvent(new Event('change')); })()")
              await wait(gm, "tw.sync.campaign.defaults.underSee === 0.4", 6000, 'campaign has it')
              check(await gm.evaluate("tw.sync.campaign.defaults.underSee") == 0.4, 'let go, the campaign keeps it (every seat draws the same)')
              await gm.wait_for_timeout(400)
              await gm.evaluate("document.querySelector('#settingsModal [data-act=\"undersee-copy\"]')?.click()"); await gm.wait_for_timeout(200)
              check(await gm.evaluate("tw.settings?.lastCopied ?? null") in ('underSee 0.40', None), 'Copy gives "underSee 0.40"', await gm.evaluate("tw.settings?.lastCopied ?? null"))
              has_reset = await gm.evaluate("!!document.querySelector('#settingsModal [data-act=\"undersee-reset\"]')")
              check(has_reset, 'a Reset shows once it is set')
              if has_reset:
                  await gm.evaluate("document.querySelector('#settingsModal [data-act=\"undersee-reset\"]').click()")
                  await wait(gm, f"tw.sync.campaign.defaults.underSee == null && {W}.underSee === {DEF}", 6000, 'reset')
                  check(await gm.evaluate(f"tw.sync.campaign.defaults.underSee == null && {W}.underSee === {DEF}"), 'Reset gives the default back')
              await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)

          if A.shots:
              print('SHOTS: the ground level, 3/4 view')
              await gm.evaluate("tw.freezeTime(false)")
              await gm.evaluate("tw.goLevel(0, 'test')"); await gm.evaluate("tw.select([])")
              sees = [float(v) for v in A.sees.split(',') if v.strip()] or [DEF]
              for v in [0.0] + sees:
                  await setsee(gm, v)
                  for (an, x, z, dist, pitch, yaw) in [('threequarter', 15, 22, 150, 45, 25), ('high', 15, 22, 170, 70, 10)]:
                      await view(gm, x, z, dist, pitch, yaw); await gm.wait_for_timeout(2500)
                      await gm.screenshot(path=os.path.join(A.shots, f'undersee-{v:g}-{an}.png')); print(f'    shot undersee-{v:g}-{an}.png')
              await setsee(gm, None); await gm.evaluate("tw.freezeTime(true)")

          print('PRIVACY: a player with a pawn in the dungeon room')
          link = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#67aadd' }))")
          if '#s=' in link:
              pl = await tab(link)
              await wait(pl, 'window.tw && tw.ready && tw.ready() && !!tw.fog', 180000, 'player ready')
              me = await pl.evaluate('tw.me()')
              await gm.evaluate(f"tw.dispatch('token.owner', {{ id: 'tok_uspawn0001', owner: '{me}' }})")
              await wait(pl, f"tw.entities()['tok_uspawn0001']?.owner === '{me}'", 8000, 'pawn given')
              await wait(pl, f"!!tw.entities()['{ids['far']}'] && !!tw.entities()['{ids['dungeon']}']", 20000, 'player has the rooms')
              await pl.evaluate("tw.goLevel(0, 'test')"); await pl.wait_for_timeout(500)
              await view(pl, 15, 22, 150, 50, 20); await pl.wait_for_timeout(3000); await settle(pl)
              await wait(pl, f"{INFO}.rooms.includes('{dun}')", 20000, 'the dungeon room shows for the player')
              ip = await pl.evaluate(INFO)
              hid = await pl.evaluate(f"!!tw.entities()['{ids['hidden']}']")
              check(await pl.evaluate(f"!!{W}.fogActive"), "fog of war is on in the player's tab")
              check(dun in ip['rooms'], 'from the ground level the player sees the dungeon room its pawn is in through the ground', ip)
              check(ids['far'] not in ip['rooms'] and ids['cave'] not in ip['rooms'] and ids['cellar'] not in ip['rooms'] and ids['hillcave'] not in ip['rooms'], 'the cellars and caves nobody has seen are not shown through the ground', ip['rooms'])
              check(not hid and ids['hidden'] not in ip['rooms'], "the hidden cellar is not in the player's tab at all", hid)
              await pl.evaluate("tw.freezeTime(true)"); pon = await pic(pl)
              await setsee(gm, 0); await wait(pl, f"{W}.underSee === 0", 8000, 'player has 0'); poff = await pic(pl)
              await setsee(gm, None); await wait(pl, f"{W}.underSee === {DEF}", 8000, 'player default')
              PR = {}
              for k, (x0, z0, x1, z1) in {'far': (45, 40, 65, 60), 'cave': (-50, 0, -20, 25), 'dungeon': (45, 0, 70, 20)}.items(): PR[k] = await pl.evaluate(f"({RECT})({x0}, {z0}, {x1}, {z1}, 0)")
              pd = {k: diff(pon, poff, r) for k, r in PR.items()}
              print('    player: mean |on - off|:', pd)
              check(pd['far'] == 0 and pd['cave'] == 0, "the picture over the unseen cellar and cave is the old one, pixel for pixel, in the player's tab", pd)
              q0 = (await pl.evaluate(INFO))['draws']; await pl.wait_for_timeout(2500); q1 = (await pl.evaluate(INFO))['draws']
              check(q1 - q0 <= 1, "a still view in the player's tab (fog of war on) does not draw the underground again", q1 - q0)
              # the GM's 'view as' this player draws the same as the player
              await gm.evaluate(f"tw.setVisionViewer('{me}')"); await gm.wait_for_timeout(1500)
              ig = await gm.evaluate(INFO)
              check(dun in ig['rooms'] and ids['far'] not in ig['rooms'] and ids['hidden'] not in ig['rooms'], "the GM viewing as the player is shown the same (the dungeon room, not the far cellar, not the hidden one)", ig['rooms'])
              await gm.evaluate("tw.setVisionViewer('gm')")
              await pl.close()
          else: check(False, 'an invite link for a player', 'no API found')

        if not A.noperf:
            print('THE COST: 24 furnished libraries over four cellars')
            await gm.evaluate("tw.freezeTime(false)")
            for i in range(24):
                await gm.evaluate(f"tw.spawnRoom('mansion-library', {30 + (i % 6) * 12}, {60 + (i // 6) * 9}, 9, 7, {200 + i})")
            for i in range(4):
                await gm.evaluate(f"tw.spawnRoom('cellar', {30 + i * 24}, {62}, 8, 6, {300 + i}, undefined, -10)")
            await wait(gm, "tw.sync.pendingCount() === 0", 30000, 'big map sent')
            await wait(gm, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 240000, 'big map spawned')
            await gm.evaluate("tw.goLevel(0, 'test')")
            things = await gm.evaluate(f"[...{W}.recs.values()].filter(r => r.entity.kind === 'object').length")
            FT = """(async (ms, orbit) => { const G0 = (await import('three')).Object3D.prototype.__twGraph, g0 = G0?.gen; const t = []; let last = performance.now(), a = 0; const g = tw.main.grab; const y0 = g.yaw; const t0 = last;
              const w0 = tw.worldOf(tw.area()), keep = w0.underPrepass; let pre = 0, preN = 0; w0.underPrepass = function (...x) { const q = performance.now(); try { return keep.apply(this, x); } finally { pre += performance.now() - q; preN++; } };
              await new Promise(res => { const f = (now) => { t.push(now - last); last = now; if (orbit) { g.yaw = y0 + (now - t0) / 60; g.update(); } if (now - t0 < ms) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
              g.yaw = y0; g.update(); delete w0.underPrepass; t.sort((a, b) => a - b); return { graph: (G0?.gen ?? 0) - (g0 ?? 0), med: +t[Math.floor(t.length / 2)].toFixed(2), p95: +t[Math.floor(t.length * 0.95)].toFixed(2), n: t.length, pre: +(pre / Math.max(1, preN)).toFixed(2), last: w0.underLast }; })"""
            await view(gm, 100, 80, 160, 50, 15); await gm.wait_for_timeout(2000)
            out = {}
            for v in (0, None, 0, None):
                await setsee(gm, v); await gm.wait_for_timeout(800)
                for orbit in (False, True):
                    r = await gm.evaluate(f"{FT}(4000, {json.dumps(orbit)})")
                    out.setdefault(f"{'on' if v is None else 'off'}-{'orbit' if orbit else 'still'}", []).append(r)
            ul = await gm.evaluate(INFO)
            summ = {k: {'med': sorted(x['med'] for x in v)[len(v) // 2], 'p95': max(x['p95'] for x in v), 'prepass_ms': max(x['pre'] for x in v), 'fps': round(sum(x['n'] for x in v) / (4 * len(v))), 'graph_changes': max(x['graph'] for x in v)} for k, v in out.items()}
            print('  COST', json.dumps({'things': things, 'under pieces': ul['pieces'], 'under things': len(ul['things']), 'underDraw': ul['last'], 'frames': summ}))
            check(things > 900, '(fixture) a big map', things)
            check(ul['last'] and ul['last']['ms'] < 50, 'one draw of the underground (both buffers) costs little on the CPU', ul['last'])

        print('ERRORS')
        bad = [x for x in errors if 'favicon' not in x and 'ERR_' not in x and '404' not in x]
        check(not bad, 'no page errors', bad[:5])
        await browser.close()
    for pr in procs: pr.terminate()
    n_ok = sum(1 for r in results if r[0]); print(f'\nbrowser_undersee: {n_ok}/{len(results)} passed')
    sys.exit(0 if n_ok == len(results) else 1)

asyncio.run(main())
