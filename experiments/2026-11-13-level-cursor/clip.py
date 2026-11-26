#!/usr/bin/env python3
"""A clip + stills of the level change (2026-11-13): the view moves, the meter opens wide, the big hand drags the marker.
  TW_GPU=1 python3 experiments/2026-11-13-level-cursor/clip.py OUTDIR"""
import asyncio, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, "tests")); import tw_sandbox; tw_sandbox.remove_campaigns()
OUT = os.path.abspath(sys.argv[1]); os.makedirs(OUT, exist_ok=True)
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
def free():
    with socket.socket() as so: so.bind(('127.0.0.1', 0)); return so.getsockname()[1]
RP, SP = free(), free(); procs = []; tmp = []
data = tempfile.mkdtemp(prefix='tw-clip-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp += [data, site]
os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': os.path.join(REPO, 'tools/spawn-tuner/js'), 'TUNER_DATA': os.path.join(REPO, 'tools/spawn-tuner/data')}, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
for _ in range(150):
    time.sleep(0.1)
    try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
    except Exception: pass
async def main():
    page = f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&nointro'
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, record_video_dir=OUT, record_video_size={'width': 1280, 'height': 800})
        pg = await ctx.new_page(); T0 = time.time(); await pg.goto(page)
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', 'TEST level clip (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=90000); await pg.wait_for_timeout(2000)
        cid = await pg.evaluate("tw.spawnRoom('cave', -6, -6, 9, 7)")
        await pg.wait_for_function("tw.condButtons.has('cave-under')", timeout=15000)
        await pg.evaluate(f"(() => {{ const r = tw.entities()['{cid}'].recipe, g = tw.main.grab; g.focus.set((r.x + r.w / 2) * 5, 0, (r.z + r.d / 2) * 5); g.update?.(); }})()")
        await pg.wait_for_timeout(2500); await pg.screenshot(path=os.path.join(OUT, 'still-0-before.png'))
        await pg.mouse.move(900, 300)
        open(os.path.join(OUT, 'press-at.txt'), 'w').write(f'{time.time() - T0:.2f}\n')
        await pg.evaluate("tw.condButtons.get('cave-under').el.click()")
        log = []
        for i in range(16):  # (the recorded video drops the frames of the move; these stills are taken as it plays)
            v = await pg.evaluate("tw.viewAnim()"); log.append(v and round(v['t']))
            if v is None and i > 2: break
            await pg.screenshot(path=os.path.join(OUT, f'move-{i:02d}.png'), clip={'x': 0, 'y': 120, 'width': 520, 'height': 560})
        open(os.path.join(OUT, 'move-t.txt'), 'w').write(repr(log) + '\n')
        await pg.wait_for_timeout(3000); await pg.screenshot(path=os.path.join(OUT, 'still-4-after.png'))
        await pg.mouse.move(700, 400); await pg.keyboard.press(']'); await pg.wait_for_timeout(2500)
        await pg.keyboard.press(']'); await pg.wait_for_timeout(2500)
        await pg.keyboard.press('['); await pg.wait_for_timeout(2500)
        # a missed offer, down into the chat
        await pg.evaluate("tw.goLevel(0, 'test')"); await pg.wait_for_timeout(1800)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(1500)
        await pg.evaluate(f"tw.offerCaveUnder('{cid}')"); await pg.wait_for_timeout(1500); await pg.evaluate("tw.condButtons.expire('cave-under')"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=os.path.join(OUT, 'still-5-offer-in-chat.png'))
        await ctx.close(); await b.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

