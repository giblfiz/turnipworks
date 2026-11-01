#!/usr/bin/env python3
"""UNIVERSAL VTT EXPORT (2026-10-24; Harry: "Universal VTT export"; client/uvtt.js, core/uvtt.js, docs/UI.md
"Universal VTT export"). A GM builds a small inn in 3D and downloads the level in view as a .dd2vtt.

  python3 engine/test/browser_uvtt.py --local [--shots] [--out DIR]
  (run it from a checkout that has the ignored models: the main checkout, or a worktree with them linked)

  FILE     Settings > Invites and exports > Universal VTT: the button downloads <campaign>-<area>-<level>.dd2vtt; every field
           of the format; format 0.3, origin 0, map_size = the rooms' box + 1 square; the PNG is map_size x ppg
  WALLS    line_of_sight is the world's walls of that level, exactly: total wall length + door and window widths =
           the level's edges (no gaps, no doubles); every door is a closed portal on its edge, every window an open one,
           and each is a gap in the walls; the lit lamps of that level are the lights
  PARSE    an independent parser (a Python port of Foundry's Universal Battlemap Importer, moo-man/FVTT-DD-Import
           ddimport.js 6.1.1: walls, doors, lights as Foundry makes them; plus MapTool's format check) reads the file
  LEVEL    upstairs: the upper room's walls only, the same box (the storeys' files stack); the view's cut, roofs, grid,
           camera and hidden things are exactly as they were after an export
  HIDDEN   a hidden room is not in the file (walls, lights) unless "Include hidden" is ticked
  BAR      "export uvtt" in the command bar downloads too (with 140 px when typed); a player has no such command and
           no Universal VTT group
  --shots  writes the exported PNG and an overlay (walls red, doors blue, windows cyan, lights yellow) as JPGs to --out
"""
import argparse, asyncio, base64, io, json, math, os, struct, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()   # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--out', default=os.path.join(HERE, 'shots', 'uvtt')); ap.add_argument('--ppg', type=int, default=70)
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = [int(p) for p in os.environ.get('TW_PORTS', '18241,18842').split(',')]
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-uvtt-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(400)

def png_size(b):
    if b[:8] != b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack('>II', b[16:24])

# ---- an independent reading: Foundry's Universal Battlemap Importer (ddimport.js 6.1.1, single-file path), in Python ----
def foundry_import(f, offset=(0, 0)):
    """What Foundry's importer makes of the file: the scene size, wall documents, door/window walls, light documents."""
    R = f['resolution']; ppg = R['pixels_per_grid']; ox, oy = R['map_origin']['x'], R['map_origin']['y']; sx, sy = R['map_size']['x'], R['map_size']['y']
    width, height = sx * ppg, sy * ppg
    def within(p): return ox <= p['x'] <= ox + sx and oy <= p['y'] <= oy + sy
    def to_px(p): return ((p['x'] - ox) * ppg + offset[0], (p['y'] - oy) * ppg + offset[1])
    walls = []
    for line in f.get('line_of_sight', []):   # objects_line_of_sight: ignored on a single file (only the legacy stitch mode reads it)
        for a, b in zip(line, line[1:]):
            if not within(a) and not within(b): continue  # isWithinMap: dropped only when BOTH ends are outside
            walls.append({'c': [*to_px(a), *to_px(b)], 'door': 0})
    # the importer also joins one polyline's end to another's start where they are exactly equal (no new wall there)
    doors = []
    for d in f.get('portals', []):
        a, b = d['bounds'][0], d['bounds'][1]
        doors.append({'c': [*to_px(a), *to_px(b)], 'door': 1 if d['closed'] else 0, 'light': 'NORMAL' if d['closed'] else 'PROXIMITY', 'sight': 'NORMAL' if d['closed'] else 'PROXIMITY'})
    lights = []
    for l in f.get('lights', []):
        if not within(l['position']): continue
        x, y = to_px(l['position'])
        lights.append({'x': x, 'y': y, 'color': '#' + l['color'][2:], 'dim': l['range'] * 5, 'bright': l['range'] * 5 / 2, 'alpha': 0.05 * l['intensity']})
    return {'width': width, 'height': height, 'walls': walls, 'doors': doors, 'lights': lights}
def maptool_ok(f): return f.get('format') in (0.2, 0.3)

def overlay(png, f, path):
    from PIL import Image, ImageDraw
    im = Image.open(io.BytesIO(png)).convert('RGB'); d = ImageDraw.Draw(im); ppg = f['resolution']['pixels_per_grid']
    P = lambda p: (p['x'] * ppg, p['y'] * ppg)
    for line in f['line_of_sight']:
        d.line([P(p) for p in line], fill=(255, 30, 30), width=max(2, ppg // 18))
    for p in f['portals']:
        d.line([P(p['bounds'][0]), P(p['bounds'][1])], fill=(40, 90, 255) if p['closed'] else (0, 230, 230), width=max(3, ppg // 12))
    for l in f['lights']:
        x, y = P(l['position']); r = max(4, ppg // 8); d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 230, 0), width=3)
    im.save(path, quality=88)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(A.out, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST uvtt {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        async def idle(pg=None): await wait(pg or gm, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await (pg or gm).wait_for_timeout(350)

        # a small inn: a common room and a kitchen side by side, furnished; a guest room upstairs over the common room
        C = await gm.evaluate("tw.spawnRoom('common', 2, 1, 6, 5, 82241)"); await idle()
        K = await gm.evaluate("tw.spawnRoom('kitchen', 8, 1, 4, 5, 6113)"); await idle()
        U = await gm.evaluate("tw.spawnRoom('guest', 2, 1, 6, 5, 4307, undefined, 10)"); await idle()
        await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(35, 0, 15); g.pitch = 60; g.yaw = 0; g.dist = 90; g.update(); tw.main.rule = 'free'; })()")
        await settle(gm)
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(600); await settle(gm)

        # ---------------- FILE: the Settings button ----------------
        print('FILE: Settings > Invites and exports > Universal VTT')
        await gm.evaluate(f"tw.uvtt.savePrefs({{ ppg: {A.ppg}, hidden: false, grid: false, pawns: false }})")
        await gm.evaluate("tw.settings.show('admin')"); await gm.wait_for_timeout(500)
        btn = await gm.query_selector('[data-act="uvtt"]')
        txt = await btn.inner_text() if btn else ''
        check(btn and 'Download as Universal VTT (.dd2vtt)' in txt, 'Invites and exports has "Download as Universal VTT (.dd2vtt)"', txt)
        grp = await gm.evaluate("[...document.querySelectorAll('.sgrp')].map(g => g.textContent).find(t => t.includes('Universal VTT')) || ''")
        check((await gm.evaluate("tw.uvtt.levelLabel(0)")) in grp and 'Foundry' in grp and all(str(n) in grp for n in (70, 100, 140, 200)), 'it names the level (the ground storey), the VTTs, and offers 70 / 100 / 140 / 200 px', grp[:160])
        keep = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return { cut: w.cut ?? null, grid: w.grid.visible, pose: tw.main.pose(), roofs: !!w.roofsOn, deco: w.layers.deco.visible, appCut: tw.cut.y }; })()")
        t0 = time.time()
        async with gm.expect_download(timeout=180000) as dl_info:
            await btn.click()
        dl = await dl_info.value
        fpath = os.path.join(A.out, dl.suggested_filename); await dl.save_as(fpath)
        print(f'    (export took {time.time() - t0:.1f} s, {os.path.getsize(fpath) / 1e6:.2f} MB)')
        lab0 = await gm.evaluate("tw.uvtt.levelLabel(0).replace(/[^\\w-]+/g, '-')")
        check(dl.suggested_filename.endswith(f'-{lab0}.dd2vtt') and dl.suggested_filename.startswith('TEST-uvtt'), 'the download is <campaign>-<area>-<level>.dd2vtt', dl.suggested_filename)
        f = json.load(open(fpath))
        for k in ('format', 'resolution', 'line_of_sight', 'objects_line_of_sight', 'portals', 'environment', 'lights', 'image'): check(k in f, f'the file has "{k}"')
        R = f['resolution']
        check(f['format'] == 0.3 and R['map_origin'] == {'x': 0, 'y': 0} and R['pixels_per_grid'] == A.ppg, f'format 0.3, origin (0, 0), {A.ppg} px a square', str(R))
        # the rooms span cells x 2..12, z 1..6 (all levels): + 1 square round = 12 x 7
        check(R['map_size'] == {'x': 12, 'y': 7}, "map_size is the rooms' box + 1 square: 12 x 7", str(R['map_size']))
        png = base64.b64decode(f['image']); sz = png_size(png)
        check(sz == (12 * A.ppg, 7 * A.ppg), f'the image is a PNG of map_size x ppg ({12 * A.ppg} x {7 * A.ppg})', str(sz))
        info = await gm.evaluate("tw.uvtt.last")
        check(info and info['level'] == 0 and info['roomsHere'] == 2, 'it is the ground storey: the two ground rooms', str(info and {k: info[k] for k in ('level', 'roomsHere', 'tiles', 'ms')}))
        after = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return { cut: w.cut ?? null, grid: w.grid.visible, pose: tw.main.pose(), roofs: !!w.roofsOn, deco: w.layers.deco.visible, appCut: tw.cut.y }; })()")
        check(after == keep, 'afterwards the view is exactly as it was (cut, grid, camera, roofs, signs)', f'{keep} -> {after}' if after != keep else '')
        last = await gm.evaluate("document.querySelector('.uvtt-last')?.textContent || ''")
        check('walls' in last and 'doors' in last and 'MB' in last, 'the panel says what went into the last file', last[:140])
        # the picture is not blank: some spread of colour
        from PIL import Image
        im = Image.open(io.BytesIO(png)).convert('RGB'); ex = im.getextrema()
        check(all(hi - lo > 40 for lo, hi in ex), 'the picture has content (not one flat colour)', str(ex))
        if A.shots:
            im.save(os.path.join(A.out, 'ground.jpg'), quality=90); overlay(png, f, os.path.join(A.out, 'ground-overlay.jpg'))
            # the game's own view of the same storey, from nearly straight above, to compare the look with
            await gm.evaluate("tw.settings.close()"); await gm.wait_for_timeout(300)
            pose = await gm.evaluate("tw.main.pose()")
            await gm.evaluate("(() => { const g = tw.main.grab; g.focus.set(35, 0, 17.5); g.pitch = 89; g.yaw = 0; g.dist = 70; g.update(); })()"); await gm.wait_for_timeout(1500)
            await gm.screenshot(path=os.path.join(A.out, 'game-topdown.jpg'), quality=85, type='jpeg')
            await gm.evaluate(f"tw.main.setPose({json.dumps(pose)})"); await gm.wait_for_timeout(500)
            await gm.evaluate("tw.settings.show('admin')"); await gm.wait_for_timeout(300)

        # ---------------- WALLS: against the world's own edges ----------------
        print('WALLS: line_of_sight and portals against the world')
        W = await gm.evaluate("""(() => { const w = tw.worldOf(tw.area()), out = [];
          for (const e of w.edges.values()) if (!e.key.includes('@')) out.push({ key: e.key, dir: e.dir, gx: e.gx, gz: e.gz, kind: e.kind, span: e.span || 1, open: !!e.open });
          return out; })()""")
        edges = [e for e in W if not e['open']]
        L = lambda s: math.hypot(s[1]['x'] - s[0]['x'], s[1]['y'] - s[0]['y'])
        wall_len = sum(L(s) for s in f['line_of_sight']); port_len = sum(L(p['bounds']) for p in f['portals'])
        check(abs(wall_len + port_len - len(edges)) < 1e-6, 'walls + doors + windows = every ground edge of the two rooms, once', f'{wall_len} + {port_len} vs {len(edges)}')
        # the perimeter of a 6x5 and a 4x5 room sharing 5: 22 + 18 - 5 = 35 unit edges
        check(len(edges) == 35, 'the two ground rooms have 35 wall edges (22 + 18 - the shared 5)', len(edges))
        doors = [e for e in edges if e['kind'] == 'door']; wins = [e for e in edges if e['kind'] == 'window']
        check(len([p for p in f['portals'] if p['closed']]) == len(doors) and len(doors) >= 2, 'a closed portal for every door (the way in, the kitchen door)', f"{len(doors)} doors")
        check(len([p for p in f['portals'] if not p['closed']]) == len(wins), 'an open portal for every window', f"{len(wins)} windows")
        def door_at(e):
            a = (e['gx'] - 1, e['gz'] - 0); n = e['span'] if e['kind'] == 'door' else 1
            b = (a[0] + n, a[1]) if e['dir'] == 'h' else (a[0], a[1] + n)
            return any({(q['x'], q['y']) for q in p['bounds']} == {a, b} for p in f['portals'])
        check(all(door_at(e) for e in doors + wins), 'every portal stands on its own edge (bounds = the edge, in squares from the box corner)')
        mid_on_wall = lambda p: any(abs((s[1]['x'] - s[0]['x']) * (p['y'] - s[0]['y']) - (s[1]['y'] - s[0]['y']) * (p['x'] - s[0]['x'])) < 1e-6 and min(s[0]['x'], s[1]['x']) - 1e-6 <= p['x'] <= max(s[0]['x'], s[1]['x']) + 1e-6 and min(s[0]['y'], s[1]['y']) - 1e-6 <= p['y'] <= max(s[0]['y'], s[1]['y']) + 1e-6 for s in f['line_of_sight'])
        check(not any(mid_on_wall(p['position']) for p in f['portals']), 'every door and window is a gap in the walls')
        lit = await gm.evaluate("tw.uvtt.geometry({ level: 0 }).rawLights.length")
        check(len(f['lights']) == lit and lit >= 1, 'the lit lamps of the ground floor are the lights', f"{len(f['lights'])} lights")

        # ---------------- PARSE: Foundry's importer, ported ----------------
        print("PARSE: Foundry's Universal Battlemap Importer (ported) and MapTool")
        S = foundry_import(f)
        check(S['width'] == sz[0] and S['height'] == sz[1], 'Foundry: the scene is the picture\'s size', f"{S['width']} x {S['height']}")
        check(len(S['walls']) == sum(len(l) - 1 for l in f['line_of_sight']) and all(0 <= c <= max(S['width'], S['height']) for w_ in S['walls'] for c in w_['c']), 'Foundry: every wall segment lands inside the scene')
        check(len([d for d in S['doors'] if d['door'] == 1]) == len(doors) and len([d for d in S['doors'] if d['door'] == 0 and d['sight'] == 'PROXIMITY']) == len(wins), 'Foundry: doors become doors; windows become see-through walls (proximity sight and light)')
        check(len(S['lights']) == len(f['lights']) and all(len(l['color']) == 7 for l in S['lights']) and all(l['dim'] > 0 for l in S['lights']), 'Foundry: every light is kept, with a #RRGGBB colour and a radius', str(S['lights'][:1]))
        check(maptool_ok(f), 'MapTool: the format is one it accepts (0.2 / 0.3)')

        # ---------------- LEVEL: upstairs ----------------
        print('LEVEL: the upper storey')
        await gm.evaluate("tw.goLevel(10, 'test')"); await gm.wait_for_timeout(500); await settle(gm, 30000)
        keep = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return { cut: w.cut ?? null, grid: w.grid.visible, pose: tw.main.pose(), appCut: tw.cut.y }; })()")
        r = await gm.evaluate(f"tw.uvtt.build({{ ppg: {A.ppg} }}).then(r => ({{ f: r.json, name: r.name }}))")
        fu = json.loads(r['f'])
        Wu = await gm.evaluate("[...tw.worldOf(tw.area()).edges.values()].filter(e => e.key.endsWith('@10') && !e.open).length")
        lu = sum(L(s) for s in fu['line_of_sight']) + sum(L(p['bounds']) for p in fu['portals'])
        check(Wu == 22 and abs(lu - 22) < 1e-6, "upstairs: the guest room's 22 edges only", f'{lu} of {Wu}')
        check(fu['resolution']['map_size'] == f['resolution']['map_size'], "the same box as the ground's file (the storeys' files stack)")
        lab10 = await gm.evaluate("tw.uvtt.levelLabel(10).replace(/[^\\w-]+/g, '-')")
        check(r['name'].endswith(f'-{lab10}.dd2vtt') and lab10 != lab0, 'the file is named for its level', r['name'])
        after = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return { cut: w.cut ?? null, grid: w.grid.visible, pose: tw.main.pose(), appCut: tw.cut.y }; })()")
        check(after == keep, 'and the view is put back', f'{keep} -> {after}' if after != keep else '')
        if A.shots:
            pu = base64.b64decode(fu['image']); Image.open(io.BytesIO(pu)).convert('RGB').save(os.path.join(A.out, 'upper.jpg'), quality=90); overlay(pu, fu, os.path.join(A.out, 'upper-overlay.jpg'))
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(500)

        # ---------------- HIDDEN ----------------
        print('HIDDEN: a hidden room')
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{K}'], hidden: true }})"); await idle(); await settle(gm, 30000)
        hid = await gm.evaluate("tw.entities()[%s]?.hidden" % json.dumps(K))
        g1 = await gm.evaluate("(() => { const g = tw.uvtt.geometry({ level: 0 }); return { len: g.walls.reduce((a, s) => a + Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y), 0) + g.portals.reduce((a, p) => a + Math.hypot(p.bounds[1].x - p.bounds[0].x, p.bounds[1].y - p.bounds[0].y), 0), lights: g.lights.length, box: g.box }; })()")
        g2 = await gm.evaluate("(() => { const g = tw.uvtt.geometry({ level: 0, includeHidden: true }); return { len: g.walls.reduce((a, s) => a + Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y), 0) + g.portals.reduce((a, p) => a + Math.hypot(p.bounds[1].x - p.bounds[0].x, p.bounds[1].y - p.bounds[0].y), 0), lights: g.lights.length, box: g.box }; })()")
        check(hid and abs(g1['len'] - 22) < 1e-6, 'hidden kitchen: only the common room\'s 22 edges (its shared wall is the common room\'s own)', f"{g1['len']} (hidden={hid})")
        check(abs(g2['len'] - 35) < 1e-6 and g2['box']['w'] > g1['box']['w'], '"Include hidden": the kitchen is back, and the map is wider for it', f"{g2['len']} {g2['box']} vs {g1['box']}")
        rh = await gm.evaluate(f"tw.uvtt.build({{ ppg: {A.ppg} }}).then(r => r.info)")
        check(rh and rh['box']['w'] == g1['box']['w'], 'the exported file leaves it out too', str(rh and rh['box']))
        await gm.evaluate(f"tw.dispatch('entity.flag', {{ ids: ['{K}'], hidden: false }})"); await idle()

        # ---------------- BAR, and the player ----------------
        print('BAR: "export uvtt", and a player')
        await gm.evaluate("tw.settings.close()"); await gm.wait_for_timeout(300)
        await gm.keyboard.press('/'); await gm.keyboard.type('export uvtt 140', delay=8); await gm.wait_for_timeout(500)
        top = await gm.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 3).map(e => e.dataset.ref)")
        check(top and top[0] == 'cmd:export.uvtt', '"export uvtt 140" puts the export first', str(top))
        async with gm.expect_download(timeout=180000) as dl2:
            await gm.keyboard.press('Enter')
        d2 = await dl2.value; p2 = os.path.join(A.out, 'bar-' + d2.suggested_filename); await d2.save_as(p2)
        f2 = json.load(open(p2))
        check(f2['resolution']['pixels_per_grid'] == 140 and png_size(base64.b64decode(f2['image'])) == (12 * 140, 7 * 140), 'Enter downloads it at 140 px a square', str(f2['resolution']))
        if A.shots:
            p140 = base64.b64decode(f2['image']); Image.open(io.BytesIO(p140)).convert('RGB').save(os.path.join(A.out, 'ground-140.jpg'), quality=90); overlay(p140, f2, os.path.join(A.out, 'ground-140-overlay.jpg'))
        await gm.keyboard.press('Escape')
        for q in ('dd2vtt', 'export to foundry', 'export to roll20', 'export to owlbear'):
            await gm.keyboard.press('/'); await gm.keyboard.type(q, delay=5); await gm.wait_for_timeout(400)
            top = await gm.evaluate("[...document.querySelectorAll('#results .res')].slice(0, 3).map(e => e.dataset.ref)")
            check('cmd:export.uvtt' in top, f'"{q}" finds it', str(top)); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
        pl = await tab(invite + '&nofx')
        check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 45000), 'player tab joined')
        await pl.keyboard.press('/'); await pl.keyboard.type('export to foundry', delay=5); await pl.wait_for_timeout(500)
        refs = await pl.evaluate("[...document.querySelectorAll('#results .res')].map(e => e.dataset.ref)")
        check('cmd:export.uvtt' not in refs, 'a player has no Universal VTT export in the bar', str(refs[:4]))
        await pl.keyboard.press('Escape')
        perr = await pl.evaluate("tw.uvtt.build({ ppg: 70 }).then(() => 'built', e => e.message)")
        check(perr == 'only the GM can export the map', 'and cannot build one by hand', perr)
        check(not errors, 'no page errors', str(errors[:3]))
        await browser.close()

    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    n = sum(1 for r in results if r[0]); print(f'\nUVTT {n}/{len(results)}')
    sys.exit(0 if n == len(results) else 1)

asyncio.run(main())
