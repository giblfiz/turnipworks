#!/usr/bin/env python3
"""The real ☰ ▸ Aura arc (a pawn with an aura), in each painted set, for Gemini: shots/ring-<set>.png.
  TW_PORTS=a,b browser-venv/bin/python shoot_ring.py"""
import asyncio, os, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE))); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox; tw_sandbox.remove_campaigns()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18771,18772').split(','))
procs = []
def start():
    data = tempfile.mkdtemp(prefix='tw-aura-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'
async def main():
    page = start(); os.makedirs(os.path.join(HERE, 'shots'), exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        pg = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page()
        await pg.goto(page); await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', f'TEST aura ring {time.strftime("%H:%M:%S")} (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.()', timeout=120000)
        await pg.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')
        await pg.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=120000)
        fig = await pg.evaluate("tw.assets.figures.list.find(f => /^hero-/.test(f.id)).id")
        await pg.evaluate("f => tw.dispatch('token.create', { id: 'tok_aurring001', name: 'Brakka', x: 12.5, z: 12.5, fig: f, aura: { level: 3, color: 'blue' } })", fig)
        await pg.wait_for_function('tw.sync.pendingCount() === 0', timeout=30000); await pg.wait_for_timeout(3000)
        await pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(12.5, 0, 12.5); g.dist = 30; g.pitch = 50; g.yaw = 0; g.update(); })()")
        for s in ('charcoal', 'parchment'):
            await pg.evaluate("s => { const b = tw.ringSettings(); tw.ringSettingsOverride = () => ({ ...b, iconSet: s }); }", s)
            await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate("tw.select('tok_aurring001')"); await pg.wait_for_timeout(800)
            await pg.evaluate("document.querySelector('#ring .rbtn[data-menu]').click()"); await pg.wait_for_timeout(700)
            await pg.screenshot(path=os.path.join(HERE, 'shots', f'menu-{s}.png'))
            await pg.evaluate("document.querySelector('#ring .rbtn.ex[data-group=\"pawn.aura.\"]').click()"); await pg.wait_for_timeout(1500)
            painted = await pg.evaluate("[...document.querySelectorAll('#ring .rbtn[data-nest][data-group=\"pawn.aura.\"]')].map(b => [b.dataset.cmd, b.classList.contains('painted') || !!b.querySelector('img.paint')])")
            print(s, painted)
            await pg.screenshot(path=os.path.join(HERE, 'shots', f'ring-{s}.png'))
        await b.close()
    for pr in procs: pr.terminate()
try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
