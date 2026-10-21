#!/usr/bin/env python3
"""Step 1: what a common room looks like in the GAME with every flame real, a pool of 4 and no real lights, with the
stand-in glow off (the default from 2026-10-12) and on. Local relay + static server (as engine/test/browser_graphics.py).
  tw-slot python3 experiments/2026-10-12-glow/game_room.py [tag]"""
import asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
RP, SP = 18641, 18642; TAG = sys.argv[1] if len(sys.argv) > 1 else 'a'
procs = []; tmp = []
def start():
    data = tempfile.mkdtemp(prefix='tw-glow-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(600):
        time.sleep(0.2)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=5000'
W = "tw.worldOf(tw.area())"
async def main():
    url = start()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--no-sandbox', *GL])
            pg = await (await b.new_context(viewport={'width': 1400, 'height': 900})).new_page()
            pg.on('pageerror', lambda e: print('pageerror', e))
            await pg.goto(url); await pg.fill('#newCampaign input[name=gm]', 'Harry')
            nm = await pg.query_selector('#newCampaign input[name=name]')
            if nm: await nm.fill(f"TEST glow {time.strftime('%H:%M:%S')} (throwaway)")
            await pg.click('#newCampaign button'); await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=90000)
            await pg.evaluate("tw.settings.setGfx('high')")
            await pg.evaluate("tw.spawnRoom('common', 2, 2, 6, 5, 7101)")
            await pg.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0 && Object.keys(tw.entities()).length > 10", timeout=120000)
            await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(25, 0, 22); g.pitch = 50; g.yaw = 20; g.dist = 48; g.update(); tw.main.rule = 'free'; })()")
            await pg.wait_for_timeout(4000)
            for lights in ('all', '4', 'none'):
                for glow in ((False,) if lights == 'all' else (False, True)):
                    await pg.evaluate(f"tw.settings.setPref('lights', '{lights}'); tw.settings.setPref('farGlow', {str(glow).lower()})")
                    await pg.wait_for_function(f"{W}.fx.fire.capWant === {W}.fx.fire.cap", timeout=60000); await pg.mouse.move(5, 5); await pg.wait_for_timeout(2500)
                    info = await pg.evaluate(f"({{ pool: {W}.fx.fire.pool(), glows: {W}.fx.fire.glowCount(), on: {W}.fx.fire.glowOn }})")
                    f = os.path.join(HERE, 'shots', f"game-{TAG}-lights-{lights}-glow-{'on' if glow else 'off'}.png"); await pg.screenshot(path=f); print(f, info, flush=True)
            await b.close()
    finally:
        for pr in procs: pr.terminate()
        for t in tmp: shutil.rmtree(t, ignore_errors=True)
asyncio.run(main())
