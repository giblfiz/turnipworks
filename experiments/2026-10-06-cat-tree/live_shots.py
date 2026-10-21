#!/usr/bin/env python3
"""Shots of the cat tree on the LIVE game for the blind read: in a common room next to a table (table distance, and leaning in).
    TW_GPU=1 python3 live_shots.py"""
import asyncio, os, sys, time
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
import subprocess, tempfile, urllib.parse, urllib.request, shutil
ENGINE = os.path.join(HERE, '..', '..', 'engine'); REPO = os.path.join(HERE, '..', '..'); procs = []; tmp = []
def start_local(RP=18197, SP=18826):   # the working tree's tuner + engine with a throwaway relay (as engine/test/browser_tiles.py)
    data = tempfile.mkdtemp(prefix='tw-cattree-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(os.path.abspath(ENGINE), os.path.join(site, 'engine')); os.symlink(os.path.abspath(os.path.join(REPO, 'tools', 'spawn-tuner')), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&'
LOCAL = '--local' in sys.argv; FACES = os.environ.get('FACES', ''); TAG = ('local' if LOCAL else 'open') + (f'-f{FACES}' if FACES else '')
PAGE = start_local() if LOCAL else 'https://turnipworks.net/?'
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        gm = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page()
        await gm.goto(PAGE + 'nopost&nointro' + (f'&faces={FACES}' if FACES else ''))
        await gm.fill('#newCampaign input[name=gm]', 'Fauna'); await gm.fill('#newCampaign input[name=name]', 'TEST cat tree shots ' + time.strftime('%H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        await gm.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
        X, Z = 12.5, 12.5
        await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({X}, 0, {Z}); g.pitch = 55; g.yaw = 0; g.dist = 45; g.update(); tw.main.rule = 'free'; }})()"); await gm.wait_for_timeout(500)
        for cat, x, z in (('cat-tree', X, Z), ('chair-plain', X + 5, Z), ('barrel', X - 5, Z)):
            ok = await gm.evaluate(f"(() => {{ const c = tw.assets.catById.get('{cat}'); if (!c) return false; tw.modes.place(c); return true; }})()")
            if not ok: print('no', cat); continue
            pt = await gm.evaluate(f"tw.screenOf({x}, {z}, tw.main, 0)"); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(300); await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(700); await gm.keyboard.press('Escape')
        await gm.wait_for_timeout(5000); await gm.evaluate("tw.select && tw.select()")
        print('faces dial', await gm.evaluate("tw.assets.faces()"), ' loaded', await gm.evaluate("performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes('cat-tree')).map(n => n.split('/tuner/')[1] || n)"))
        print(await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object').map(e => [e.cat, e.x, e.z, e.rot, e.dims])"))
        for name, pitch, yaw, dist in (('table', 55, 0, 45), ('table90', 55, 90, 45), ('table180', 55, 180, 45), ('table270', 55, 270, 45), ('lean', 35, 30, 16), ('lean2', 35, 210, 16)):
            await gm.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({X}, 2, {Z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); }})()"); await gm.wait_for_timeout(2500)
            await gm.screenshot(path=os.path.join(HERE, 'shots', f'{TAG}-{name}.png'))
        await b.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
