#!/usr/bin/env python3
"""Sphere as a globe, cone as a real 3D cone (2026-10-17; docs/RULERS.md "Drawn in 3D").
  local: TW_GPU=1 python3 engine/test/browser_measure_shapes.py --local [--shots]
  live:  ... --page https://turnipworks.net/    (one throwaway campaign, removed at exit)
Stills (table camera and a low angle) go to engine/test/shots/measure/ with --shots."""
import argparse, asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
SHOTS = os.path.join(HERE, 'shots', 'measure')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18178,18808').split(','))
def start_local():
    data = tempfile.mkdtemp(prefix='tw-shapes-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}); gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(str(e))); gm.on('console', lambda m: print('   console:', m.text[:200]) if m.type in ('error',) else 0)
        await gm.goto(page); await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST shapes {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        await gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=20000)
        await gm.evaluate("tw.batch([{type:'token.create',args:{id:'tok_gob00000001',name:'Goblin',x:34.5,z:27.5}}])"); await gm.wait_for_timeout(400)
        async def cam(pitch, dist, yaw=0):
            await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set(40, 0, 27); g.yaw = {yaw}; g.pitch = {pitch}; g.dist = {dist}; g.update(); }})()")
        async def one(shape, a, b, tag):
            await gm.evaluate(f"tw.rulers.start({a}, {b}, '{shape}')"); await gm.wait_for_timeout(600)
            st = await gm.evaluate('tw.rulers.state()'); it = st['items'][0]
            for name, pitch, dist in (('table', 62, 90), ('low', 14, 70)):
                await cam(pitch, dist); await gm.wait_for_timeout(500)
                if A.shots: await gm.screenshot(path=os.path.join(SHOTS, f'{tag}-{name}.png'))
            return it
        it = await one('sphere', '{ x: 40, y: 0, z: 27 }', '{ x: 55, y: 0, z: 27 }', 'sphere')
        # 8 meridians as 4 great circles + 8 parallels + the equator outline: 72 * 13
        check(it['kind'] == 'sphere' and it['segs'] == 72 * (4 + 8 + 1), 'sphere: a globe, 8 parallels + equator and 8 meridians (4 great circles)', it['segs'])
        it = await one('cone', '{ x: 20, y: 0, z: 27 }', '{ x: 50, y: 0, z: 27 }', 'cone')
        check(it['kind'] == 'cone' and it['segs'] == 3 + 72 + 8 and it['cells'] > 10, 'cone: ground footprint (3 edges) + round flat end (72) + 8 ribs; squares still tinted', (it['segs'], it['cells']))
        await gm.evaluate('tw.rulers.clear ? tw.rulers.clear() : 0')
        check(not errors, 'no page errors', errors[:2])
        await browser.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    import shutil
    for t in tmp: shutil.rmtree(t, ignore_errors=True)
bad = results.count(False); print(f"{len(results) - bad}/{len(results)} passed"); sys.exit(1 if bad else 0)
