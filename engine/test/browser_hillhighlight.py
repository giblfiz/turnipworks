#!/usr/bin/env python3
"""The placement highlights on hills (2026-10-28). Harry, on dev: "Small tweak: the room/building placement highlights
don't show on top of hills when you drag."

Every footprint drawn on the ground while placing (the room tool's lit squares, the building tool's rectangle, the
footprint of a room being dragged) lies ON what you see there: a hill's top, the earth over a room dug into it. What is
measured, for each, in a real browser:
  y        the mark's height at each of its squares is at or over the drawn ground there (the hill's top, its bank)
  seen     the mark changes the pixels at those squares: a screenshot with it and one with it hidden differ there

  hover    the room tool's white square over a hilltop, before the press (lv 1)
  on top   a room tool drag started on the hilltop (the room stands on it, 10 ft)
  dug in   a drag from the open ground across the hill (the room is dug in at the ground: its squares over the hill lie
           on the hill's top, the others on the ground)
  building the building tool's rectangle over the hill
  drag     an existing ground room dragged by its label onto the hill: its footprint
  lv 2     the room tool on the hilltop's own level
  lv -1    a cellar drawn under the hill (the hills are see-through below the ground: the squares show through it)
  errors   no page errors

  local:  python3 engine/test/browser_hillhighlight.py --local [--shots DIR]
  live:   ... browser_hillhighlight.py --page https://dev.turnipworks.net/
"""
import argparse, asyncio, io, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
from PIL import Image, ImageChops, ImageStat
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18531,18861').split(','))
POST = '' if A.shots else '&nopost'
def start_local():
    data = tempfile.mkdtemp(prefix='tw-hillhi-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def settle(pg, ms=60000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over'); await pg.wait_for_timeout(250)
async def frames(pg, n=3): await pg.evaluate(f"new Promise(r => {{ let k = {n}; const f = () => --k <= 0 ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }})")
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
W = "tw.worldOf(tw.area())"
C = lambda g: g * 5 + 2.5
# the drawn ground's highest point over a square (feet): the terrain field (hill tops, banks, cut-outs), else 0
GROUND = f"((gx, gz) => {{ const T = {W}.terrainField; let hi = 0; if (T) for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) hi = Math.max(hi, T.heightAt(gx * 5 + 0.4 + i * 1.05, gz * 5 + 0.4 + j * 1.05)); return hi; }})"
# THE MARKS a footprint draws, as [gx, gz, y] per 5-ft square they cover (y: the mark's height there; the highest of its
# triangles over the square's middle). The room tool's cells (an instanced mesh), the building tool's plate, a room drag's plate.
MARKS = """((what) => { const w = tw.worldOf(tw.area()), out = [], v = new THREE_.Vector3(), M = new THREE_.Matrix4();
  const meshes = what === 'cells' ? [w.cellMarks?.get('room-tool')?.lit].filter(Boolean) : what === 'drag' ? [...(w.dragPlates || new Map()).values()] : w.layers.deco.children.filter(o => o.userData.footprint === 'building');
  for (const m of meshes) { m.updateMatrixWorld(true);
    if (m.isInstancedMesh) { for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); v.setFromMatrixPosition(M).applyMatrix4(m.matrixWorld); out.push([Math.floor(v.x / 5), Math.floor(v.z / 5), +v.y.toFixed(3)]); } continue; }
    const p = m.geometry.attributes.position, by = new Map();
    for (let t = 0; t < p.count; t += 3) { let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, t + k).applyMatrix4(m.matrixWorld); cx += v.x / 3; cy += v.y / 3; cz += v.z / 3; } const key = Math.floor(cx / 5) + ':' + Math.floor(cz / 5); by.set(key, Math.max(by.get(key) ?? -1e9, cy)); }
    for (const [k, y] of by) { const [gx, gz] = k.split(':').map(Number); out.push([gx, gz, +y.toFixed(3)]); } }
  return out; })"""
INIT = "(async () => { window.THREE_ = await import('three'); return !!THREE_.Vector3; })()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + f'faces=1500{POST}'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); gm.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' or 'terrain' in m.text else None)
        await gm.goto(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST hillhighlight ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        check(await gm.evaluate(INIT), '(three in the page, for the measures)')
        await gm.evaluate("tw.dispatch('area.ground', { cat: 'floor-grass' })"); await gm.wait_for_timeout(600)
        HID = await gm.evaluate("tw.spawnRoom('hill', 0, 0, 8, 8, 11, undefined, 10)")
        await wait(gm, f"!!tw.entities()['{HID}'] && tw.sync.pendingCount() === 0", 6000, 'the hill')
        info = await gm.evaluate(f"(async () => {{ await {W}.terrain.ready; return {W}.terrain.info(); }})()")
        check(info['banks'] == 1, 'a 10-ft hill, its bank drawn', info)
        await settle(gm)

        # is the mark SEEN at these squares? a small screenshot at each square's middle (at the mark's own height), with the
        # marks and with them hidden: the mean difference of the pixels there
        async def seen(what, sq):
            hide = {'cells': f"(on) => {{ const c = {W}.cellMarks?.get('room-tool'); if (c) c.lit.visible = on; }}",
                    'drag': f"(on) => {{ for (const m of ({W}.dragPlates || new Map()).values()) m.visible = on; }}",
                    'building': f"(on) => {{ for (const m of {W}.layers.deco.children) if (m.userData.footprint === 'building') m.visible = on; }}"}[what]
            spots = []
            for gx, gz, y in sq:
                s = await scr(gm, C(gx), C(gz), y)
                if s and 20 < s['x'] < 1260 and 20 < s['y'] < 800: spots.append((gx, gz, s))
            if not spots: return {}
            x0 = max(0, int(min(s['x'] for *_, s in spots)) - 8); y0 = max(0, int(min(s['y'] for *_, s in spots)) - 8)
            x1 = min(1280, int(max(s['x'] for *_, s in spots)) + 8); y1 = min(820, int(max(s['y'] for *_, s in spots)) + 8)
            async def grab():  # (only the box round the spots: a whole-page shot of a SwiftShader canvas can take over 30 s)
                await frames(gm, 3); png = await gm.screenshot(clip={'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}, timeout=180000); im = Image.open(io.BytesIO(png)).convert('RGB')
                return {(gx, gz): im.crop((int(s['x']) - 6 - x0, int(s['y']) - 6 - y0, int(s['x']) + 6 - x0, int(s['y']) + 6 - y0)) for gx, gz, s in spots}
            on = await grab(); await gm.evaluate(f"({hide})(false)"); off = await grab(); await gm.evaluate(f"({hide})(true)"); await frames(gm, 2)
            out = {}
            for k in on:
                out[k] = round(sum(ImageStat.Stat(ImageChops.difference(on[k], off[k])).mean) / 3, 1)
            return out
        # every mark at or over the drawn ground under it (the highest point of the ground over its square, less a hair)
        async def over_ground(marks):
            g = await gm.evaluate(f"(sq) => sq.map(([gx, gz]) => +({GROUND})(gx, gz).toFixed(3))", [m[:2] for m in marks])
            return [(m[0], m[1], m[2], g[i]) for i, m in enumerate(marks) if m[2] < g[i] - 0.01]
        async def shot(name):
            if not A.shots: return
            await gm.screenshot(path=os.path.join(A.shots, f'{name}.png'), timeout=180000); print(f'    shot {name}.png')
        hill = lambda gx, gz: 0 <= gx < 8 and 0 <= gz < 8

        print('HOVER: the room tool over the hilltop, before the press (lv 1)')
        await view(gm, 22, 26, 80, 55, 0, 5)
        await gm.evaluate("tw.modes.roomTool('common')"); await gm.wait_for_timeout(250)
        s = await scr(gm, C(4), C(4), 10); await gm.mouse.move(s['x'], s['y']); await gm.wait_for_timeout(200); await gm.mouse.move(s['x'] + 1, s['y']); await gm.wait_for_timeout(300)
        mk = await gm.evaluate(f"{MARKS}('cells')")
        check(mk and mk[0][:2] == [4, 4] and mk[0][2] >= 10, 'the white square is at the hilltop square, at or over 10 ft', mk)
        sn = await seen('cells', mk[:1])
        check(sn and min(sn.values()) > 6, 'and it is seen there (pixels with it and without it differ)', sn)

        print('ON TOP: a room tool drag started on the hilltop')
        a, b = await scr(gm, C(2), C(2), 10), await scr(gm, C(5), C(5), 10)
        await gm.mouse.move(a['x'], a['y']); await gm.wait_for_timeout(120); await gm.mouse.down()
        for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(30)
        await gm.wait_for_timeout(300)
        mk = await gm.evaluate(f"{MARKS}('cells')"); lv = await gm.evaluate("tw.mode?.level")
        check(lv == 10 and len(mk) == 16, 'while dragging: 16 squares, the room at 10 ft (on the hill)', [lv, len(mk)])
        bad = await over_ground(mk)
        check(not bad, 'every lit square lies at or over the hilltop (none buried under its grass)', bad[:4])
        sn = await seen('cells', [m for m in mk if (m[0] + m[1]) % 2 == 0][:5])
        check(sn and min(sn.values()) > 6, 'and they are seen', sn)
        await shot('ontop-drag')
        await gm.keyboard.press('Escape'); await gm.mouse.up(); await gm.wait_for_timeout(300)
        if await gm.evaluate('!!tw.mode'): await gm.evaluate('tw.modes.cancel()')
        await wait(gm, 'tw.sync.pendingCount() === 0', 5000)
        n0 = await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length")

        print('DUG IN: a drag from the open ground across the hill')
        await gm.evaluate("tw.modes.roomTool('common')"); await gm.wait_for_timeout(250)
        a, b = await scr(gm, C(10), C(3), 0), await scr(gm, C(6), C(5), 10)
        await gm.mouse.move(a['x'], a['y']); await gm.wait_for_timeout(120); await gm.mouse.down()
        for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(30)
        await gm.wait_for_timeout(300)
        mk = await gm.evaluate(f"{MARKS}('cells')"); st = await gm.evaluate("({ level: tw.mode?.level, label: document.getElementById('modeLabel').textContent, rect: tw.mode?.rect })")
        on_h = [m for m in mk if hill(m[0], m[1])]; off_h = [m for m in mk if not hill(m[0], m[1])]; R = st['rect']
        want_h = sum(1 for gz in range(R['z'], R['z'] + R['d']) for gx in range(R['x'], R['x'] + R['w']) if hill(gx, gz))
        check(st['level'] == 0 and 'dug into' in st['label'] and len(mk) == R['w'] * R['d'] and len(on_h) == want_h >= 2 and len(off_h) >= 2, 'the room is at the ground, dug into the hill: some of its squares over the hill, some off it', [st, len(on_h), len(off_h)])
        bad = await over_ground(mk)
        check(not bad, 'every lit square lies at or over the ground drawn there (the hilltop over the hill, the bank by it)', bad[:4])
        check(all(m[2] >= 10 for m in on_h) and all(m[2] < 10 for m in off_h if m[0] >= 9), 'the squares over the hill on its top, those on the open ground on the ground', [on_h[:3], [m for m in off_h if m[0] >= 9][:3]])
        sn = await seen('cells', on_h[:4] + off_h[-2:])
        check(sn and min(sn.values()) > 6, 'and they are seen, on the hill and off it', sn)
        await shot('dugin-drag')
        await gm.keyboard.press('Escape'); await gm.mouse.up(); await gm.wait_for_timeout(300)
        if await gm.evaluate('!!tw.mode'): await gm.evaluate('tw.modes.cancel()')
        check(await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length") == n0, '(Esc: nothing was made)')

        print('BUILDING: the building tool\'s rectangle over the hill')
        hasb = await gm.evaluate("(() => { const n = [...tw.taxonomy.nodes.values()].find(n => n.level === 'type' && n.code); if (!n) return false; tw.modes.buildingTool(n); return tw.mode?.kind === 'building'; })()")
        if hasb:
            await gm.wait_for_timeout(250)
            a, b = await scr(gm, C(11), C(2), 0), await scr(gm, C(5), C(6), 10)
            await gm.mouse.move(a['x'], a['y']); await gm.wait_for_timeout(120); await gm.mouse.down()
            for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(30)
            await gm.wait_for_timeout(300)
            mk = await gm.evaluate(f"{MARKS}('building')"); rect = await gm.evaluate('tw.mode.rect')
            on_h = [m for m in mk if hill(m[0], m[1])]
            check(rect and len(mk) == rect['w'] * rect['d'] and len(on_h) >= 4, 'the rectangle covers its squares, some of them over the hill', [rect, len(mk), len(on_h)])
            bad = await over_ground(mk)
            check(not bad, 'every square of it lies at or over the ground drawn there (on the hilltop over the hill)', bad[:4])
            sn = await seen('building', on_h[:4])
            check(sn and min(sn.values()) > 6, 'and it is seen over the hill', sn)
            await shot('building-drag')
            await gm.keyboard.press('Escape'); await gm.mouse.up(); await gm.wait_for_timeout(300)
            if await gm.evaluate('!!tw.mode'): await gm.evaluate('tw.modes.cancel()')
            check(await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length") == n0, '(Esc: no building was made)')
        else: print('    (no building type in the taxonomy here)')

        print('DRAG: a ground room dragged by its label onto the hill')
        RID = await gm.evaluate("tw.spawnRoom('storeroom', 12, 10, 3, 3, 5, undefined, 0)")
        await wait(gm, f"!!tw.entities()['{RID}'] && tw.sync.pendingCount() === 0", 8000, 'the room'); await settle(gm)
        await view(gm, 30, 34, 85, 55, 0, 5); await gm.evaluate(f"tw.select(['{RID}'])"); await gm.wait_for_timeout(500)
        la = await gm.evaluate(f"""(() => {{ const el = document.querySelector('.rlabel[data-id="{RID}"]'); if (!el || !el.classList.contains('on')) return null; const r = el.getBoundingClientRect();
            for (let j = 1; j < 6; j++) for (let i = 1; i < 10; i++) {{ const x = r.left + r.width * i / 10, y = r.top + r.height * j / 6, top = document.elementFromPoint(x, y); if (top && !top.closest('#ring .rbtn') && el.contains(top) || top === el) return {{ x, y }}; }} return null; }})()""")
        if la:
            a, b = await scr(gm, C(13), C(11), 0), await scr(gm, C(5), C(5), 0)  # 8 squares west, 6 north: over the hill (at the ground, dug in)
            await gm.mouse.move(la['x'], la['y']); await gm.mouse.down()
            for i in range(1, 13): await gm.mouse.move(la['x'] + (b['x'] - a['x']) * i / 12, la['y'] + (b['y'] - a['y']) * i / 12); await gm.wait_for_timeout(40)
            await gm.wait_for_timeout(600)
            d = await gm.evaluate('tw.roomDrag'); mk = await gm.evaluate(f"{MARKS}('drag')")
            on_h = [m for m in mk if hill(m[0], m[1])]
            check(d and d['dx'] and len(mk) == 9 and len(on_h) >= 4, 'dragging: the footprint, 9 squares, over the hill', [d, len(mk), len(on_h)])
            bad = await over_ground(mk)
            check(not bad, 'every square of the footprint lies at or over the ground drawn there (on the hilltop)', bad[:4])
            sn = await seen('drag', on_h[:4])
            check(sn and min(sn.values()) > 6, 'and it is seen over the hill', sn)
            await shot('room-drag')
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200); await gm.mouse.up(); await gm.wait_for_timeout(500)
            await wait(gm, 'tw.sync.pendingCount() === 0', 5000)
        else: check(False, "the room's label, to drag it by", la)
        await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{RID}' }})"); await wait(gm, f"!tw.entities()['{RID}'] && tw.sync.pendingCount() === 0", 6000)
        await gm.evaluate("tw.select([])")

        print("LV 2: the room tool on the hilltop's own level")
        await gm.evaluate("tw.goLevel(10, 'test')"); await gm.wait_for_timeout(700)
        await view(gm, 22, 26, 80, 55, 0, 10)
        await gm.evaluate("tw.modes.roomTool('common')"); await gm.wait_for_timeout(250)
        a, b = await scr(gm, C(1), C(1), 10), await scr(gm, C(4), C(3), 10)
        await gm.mouse.move(a['x'], a['y']); await gm.wait_for_timeout(120); await gm.mouse.down()
        for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(30)
        await gm.wait_for_timeout(300)
        mk = await gm.evaluate(f"{MARKS}('cells')"); lv = await gm.evaluate("tw.mode?.level")
        check(lv == 10 and len(mk) == 12, 'while dragging: 12 squares at 10 ft', [lv, len(mk)])
        bad = await over_ground(mk)
        check(not bad, 'every lit square lies at or over the hilltop', bad[:4])
        sn = await seen('cells', mk[::3][:4])
        check(sn and min(sn.values()) > 6, 'and they are seen', sn)
        await gm.keyboard.press('Escape'); await gm.mouse.up(); await gm.wait_for_timeout(300)
        if await gm.evaluate('!!tw.mode'): await gm.evaluate('tw.modes.cancel()')

        print('LV -1: a cellar drawn under the hill (the hill is see-through below the ground)')
        await gm.evaluate("tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(900)
        await view(gm, 22, 26, 80, 55, 0, -10)
        await gm.evaluate("tw.modes.roomTool('storeroom')"); await gm.wait_for_timeout(250)
        a, b = await scr(gm, C(2), C(2), -10), await scr(gm, C(5), C(4), -10)
        await gm.mouse.move(a['x'], a['y']); await gm.wait_for_timeout(120); await gm.mouse.down()
        for i in range(1, 11): await gm.mouse.move(a['x'] + (b['x'] - a['x']) * i / 10, a['y'] + (b['y'] - a['y']) * i / 10); await gm.wait_for_timeout(30)
        await gm.wait_for_timeout(400)
        mk = await gm.evaluate(f"{MARKS}('cells')"); st = await gm.evaluate(f"({{ level: tw.mode?.level, see: {W}.hillSee, ghost: {W}.ghostInfo() }})")
        check(st['level'] == -10 and len(mk) == 12, 'while dragging: 12 squares at -10 ft, under the hill', [st['level'], len(mk), st['see']])
        sn = await seen('cells', mk[::3][:4])
        check(sn and min(sn.values()) > 4, 'and they are seen through the see-through hill', [sn, st['ghost']])
        await shot('cellar-drag')
        await gm.keyboard.press('Escape'); await gm.mouse.up(); await gm.wait_for_timeout(300)
        if await gm.evaluate('!!tw.mode'): await gm.evaluate('tw.modes.cancel()')
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(300)

        print('ERRORS')
        bad = [x for x in errors if 'favicon' not in x and 'ERR_' not in x and '404' not in x]
        check(not bad, 'no page errors', bad[:5])
        await browser.close()
    for pr in procs: pr.terminate()
    n_ok = sum(1 for r in results if r[0]); print(f'\nbrowser_hillhighlight: {n_ok}/{len(results)} passed')
    sys.exit(0 if n_ok == len(results) else 1)

asyncio.run(main())
