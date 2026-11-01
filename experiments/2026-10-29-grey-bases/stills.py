#!/usr/bin/env python3
"""Stills of pawn bases at table distance, for blind Gemini reads (Harry 2026-10-29: "let's change bases from 5ft black to
like 4ft medium grey"; "Facing arrow can be much smaller and facing gap can go away").

  python stills.py --repo /path/to/checkout --out DIR [--disc '#757e88'] [--arrow from,out,half] [--ports 23421,23451]

A wood-floored room (the inn's common room) and a stone-floored one (a cellar), five named pawns in each facing different
ways; a high and a low view of each; the stone room again by night. `key.json` beside the stills says which pawn faces
where (never in a file name). --repo is the checkout whose engine is served (the "before" stills: main).
"""
import argparse, asyncio, atexit, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--repo', required=True); ap.add_argument('--out', required=True); ap.add_argument('--disc'); ap.add_argument('--arrow'); ap.add_argument('--ports', default='23421,23451')
A = ap.parse_args(); REPO = os.path.abspath(A.repo); ENGINE = os.path.join(REPO, 'engine'); os.makedirs(A.out, exist_ok=True)
RP, SP = (int(v) for v in A.ports.split(','))
procs, tmp = [], []
@atexit.register
def _cleanup():
    for p in procs:
        try: p.terminate()
        except Exception: pass
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
data = tempfile.mkdtemp(prefix='tw-bases-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp += [data, site]
os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
for _ in range(100):
    time.sleep(0.1)
    try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
    except Exception: pass
PAGE = f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
PAWNS = [('hero-fighter-human-m', 'Brakka', 0), ('foe-goblin-spear', 'Grishnak', 90), ('hero-wizard-elf-f', 'Mira Vale', 180), ('foe-wolf', 'Fang', 270), ('town-human-smith', 'Old Tom', 135)]
SPOTS = [(7.5, 7.5), (17.5, 7.5), (27.5, 7.5), (7.5, 17.5), (22.5, 17.5)]
COLORS = ['#d9a441', '#3fa7ff', '#e0563a', '#58c06a', '#b07cff']

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg = await (await b.new_context(viewport={'width': 1400, 'height': 900})).new_page()
        await pg.goto(PAGE); await pg.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await pg.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST bases stills {time.strftime('%H:%M:%S')} (throwaway)")
        await pg.click('#newCampaign button'); await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=45000)
        rooms = {'wood': dict(type='common', x=0, z=0, w=7, d=5, seed=6101), 'stone': dict(type='cellar', x=10, z=0, w=7, d=5, seed=6202)}
        key = {'note': 'camera yaw 0 looks toward -Z: +Z is toward the viewer (screen down), +X is screen right. faces_deg: 0 = toward the viewer, 90 = screen right, 180 = away, 270 = screen left'}
        for name, a in rooms.items():
            rid = f'room_bases{name}01'; await pg.evaluate(SPAWN, {'id': rid, **a}); rooms[name]['id'] = rid
            await pg.wait_for_function(f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", timeout=30000)
        await pg.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", timeout=90000)
        await pg.evaluate("tw.batch(Object.values(tw.entities()).filter(e => e.kind === 'object' && !tw.ST.isConnector(e) && e.place !== 'tile' && !(e.layer === 'floor')).map(e => ({ type: 'object.delete', args: { id: e.id } })))"); await pg.wait_for_timeout(800)
        key['floors'] = await pg.evaluate("(ids) => ids.map(id => { const r = tw.entities()[id]; try { return [r.recipe.type, tw.roomgen.floorFor(r.recipe)]; } catch (e) { return [r.recipe.type, String(e)]; } })", [r['id'] for r in rooms.values()])
        ops = []
        for name, a in rooms.items():
            ox = a['x'] * 5
            for i, ((fid, nmn, deg), (x, z)) in enumerate(zip(PAWNS, SPOTS)):
                ops.append({'type': 'token.create', 'args': {'id': f'tok_b{name}{i}xxxxxxx'[:16], 'name': nmn, 'x': ox + x, 'z': z, 'rot': deg * 3.14159265 / 180, 'color': COLORS[i], 'fig': fid}})
                key.setdefault(name, []).append({'name': nmn, 'fig': fid, 'faces_deg': deg})
        await pg.evaluate("(ops) => tw.batch(ops)", ops)
        await pg.wait_for_function("Object.values(tw.entities()).filter(e => e.kind === 'token').every(t => tw.worldOf(tw.area()).figureOf(t.id)?.loaded)", timeout=60000)
        if A.disc: await pg.evaluate("(c) => { for (const r of tw.worldOf(tw.area()).recs.values()) { const d = r.visual?.userData.base?.userData.disc; if (d) d.material.color.set(c); } }", A.disc)
        if A.arrow:
            f, o, h = (float(v) for v in A.arrow.split(',')); await pg.evaluate("(a) => tw.figures.setArrow(a)", {'from': f, 'out': o, 'half': h})
        await pg.evaluate("tw.clearSelection(); tw.setRoofs?.(false, 'test')"); await pg.mouse.move(5, 895)
        async def view(x, z, dist, pitch):
            await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = 0; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()"); await pg.wait_for_timeout(1800)
        for name, a in rooms.items():
            await pg.evaluate(f"tw.cutToRoom?.(tw.entities()['{a['id']}'], 'test')"); await pg.wait_for_timeout(600)
            cx = a['x'] * 5 + 17.5
            await view(cx, 12.5, 70, 62); await pg.screenshot(path=os.path.join(A.out, f'{name}-high.png'))
            await view(cx, 12.5, 48, 34); await pg.screenshot(path=os.path.join(A.out, f'{name}-low.png'))
        await pg.evaluate("tw.sync.submit('area.set', { area: tw.area(), settings: { light: 'night' } })"); await pg.wait_for_timeout(2500)
        a = rooms['stone']; await pg.evaluate(f"tw.cutToRoom?.(tw.entities()['{a['id']}'], 'test')"); await view(a['x'] * 5 + 17.5, 12.5, 60, 55); await pg.screenshot(path=os.path.join(A.out, 'stone-night.png'))
        key['base'] = await pg.evaluate("(() => { const t = Object.values(tw.entities()).find(e => e.kind === 'token'); const m = tw.worldOf(tw.area()).figureOf(t.id); return { width_ft: m.base_width_ft, disc: m.disc || null, arrow: tw.figures.arrow?.() || null }; })()")
        json.dump(key, open(os.path.join(A.out, 'key.json'), 'w'), indent=1); print(json.dumps(key['floors']), json.dumps(key['base']))
        await b.close()
asyncio.run(main())
