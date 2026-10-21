#!/usr/bin/env python3
"""Stills of every roof style from the table camera (full look, 1920x1080), for the before / after and Gemini's blind reads.

  TW_GPU=1 python3 shots.py --out shots/after                       this checkout
  ... shots.py --repo /path/to/another/checkout --out shots/before                                         the code as it was
  ... shots.py --out shots/painted --query roofsurface=painted                                             the one switch
One inn (a common room with a kitchen wing and a back wing: a cross gable, valleys, a chimney) and a cottage, on a local
relay with a throwaway campaign. Per style: <style>-table.png (95 ft, the game's table view) and <style>-close.png (45 ft).
Prints what was drawn (renderer.info, the section report) as JSON lines.
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument('--repo', default=os.path.dirname(os.path.dirname(HERE))); ap.add_argument('--out', required=True); ap.add_argument('--query', default=''); ap.add_argument('--styles', default='thatch,tile,slate,shingle'); ap.add_argument('--ports', default='18391,18916'); ap.add_argument('--day', action='store_true'); ap.add_argument('--switch', action='store_true'); ap.add_argument('--eval', default=''); ap.add_argument('--page', help='a deployed game (e.g. https://turnipworks.net/): a throwaway campaign there, removed at exit')
A = ap.parse_args(); REPO = os.path.abspath(A.repo); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
from playwright.async_api import async_playwright
RP, SP = (int(x) for x in A.ports.split(',')); procs = []
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
def start_local():
    data = tempfile.mkdtemp(prefix='tw-shingles-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('&' + A.query if A.query else '')
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
INFO = """(() => { const w = tw.worldOf(tw.area()), s = w.fx?.stats?.() || {}; return { sections: w.roofSectionReport ? w.roofSectionReport() : null, roofs: w.roofReport().length, calls: s.frame_draw_calls, triangles: s.frame_triangles }; })()"""
async def view(pg, x, z, dist, pitch, yaw):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(1800)
async def main():
    page = (A.page + ('&' if '?' in A.page else '?') + 'nointro' + ('&' + A.query if A.query else '')) if A.page else start_local(); os.makedirs(A.out, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        ctx = await browser.new_context(viewport={'width': 1920, 'height': 1080}); gm = await ctx.new_page(); errs = []
        gm.on('pageerror', lambda e: errs.append(str(e))); gm.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST shingles {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button'); await gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=6, d=4, seed=6101)), ('kitchen', dict(type='kitchen', x=6, z=0, w=4, d=4, seed=6102)),
                          ('wing', dict(type='guest', x=1, z=4, w=3, d=4, seed=6103)), ('cottage', dict(type='guest', x=13, z=6, w=4, d=3, seed=6107))):
            rid = f"room_sh{name}{random.randrange(10**6):06d}"[:24]; R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            await gm.wait_for_function(f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", timeout=40000)
        await gm.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", timeout=120000)
        b_inn = await gm.evaluate(f"tw.entities()['{R['common']}'].building"); b_cot = await gm.evaluate(f"tw.entities()['{R['cottage']}'].building")
        await gm.evaluate("tw.setRoofs(true, 'shots'); tw.cutOff('shots')"); await gm.wait_for_timeout(2500); await gm.evaluate("document.body.classList.add('shot')")
        if A.day: await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); w.hemi.intensity = 2.4; w.sun.intensity = 3.2; })()")
        for style in A.styles.split(','):
            await gm.evaluate(f"tw.batch([{{ type: 'building.set', args: {{ id: '{b_inn}', roof: '{style}' }} }}, {{ type: 'building.set', args: {{ id: '{b_cot}', roof: '{style}' }} }}])"); await gm.wait_for_timeout(3500)
            if A.eval: await gm.evaluate(A.eval); await gm.wait_for_timeout(1500)
            await view(gm, 40, 18, 95, 48, -25); await gm.screenshot(path=os.path.join(A.out, f'{style}-table.png')); info = await gm.evaluate(INFO)
            await view(gm, 30, 14, 45, 42, -25); await gm.screenshot(path=os.path.join(A.out, f'{style}-close.png'))
            await view(gm, 30, 14, 60, 80, 20); await gm.screenshot(path=os.path.join(A.out, f'{style}-top.png'))
            print(json.dumps({'style': style, **info}), flush=True)
        if A.switch:  # the one switch, the roofs switch and a style change, over and over: nothing may leak or break
            mem = "(() => { const i = tw.main.renderer?.info || tw.worldOf(tw.area()).fx?.renderer?.info; const w = tw.worldOf(tw.area()); return { geometries: i?.memory?.geometries, textures: i?.memory?.textures, programs: i?.programs?.length, sections: w.roofSectionReport(), shown: w.roofReport().filter(r => r.shown).length }; })()"
            print(json.dumps({'switch': 'start', **(await gm.evaluate(mem))}))
            for k in range(6):
                await gm.evaluate("tw.roofSurface('painted')"); await gm.wait_for_timeout(500); a = await gm.evaluate(mem)
                await gm.evaluate("tw.roofSurface('sections')"); await gm.wait_for_timeout(500)
                await gm.evaluate("tw.setRoofs(false, 't')"); await gm.wait_for_timeout(900); await gm.evaluate("tw.setRoofs(true, 't')"); await gm.wait_for_timeout(900)
                await gm.evaluate("tw.setCut(9, { pinned: true, by: 't' })"); await gm.wait_for_timeout(700); await gm.evaluate("tw.cutOff('t')"); await gm.wait_for_timeout(900)
                print(json.dumps({'switch': k, 'painted': a, 'sections': await gm.evaluate(mem)}))
        print(json.dumps({'client': await gm.evaluate('window.TW_V'), 'page': page.split('?')[0]}))
        if errs: print('ERRORS', json.dumps(errs[:8])[:1500])
        await browser.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
