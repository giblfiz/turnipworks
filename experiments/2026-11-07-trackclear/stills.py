#!/usr/bin/env python3
"""Before / after stills for the props' resize track near the top of the screen (lane trackclear, 2026-11-07). A prop
high on the screen, its resize handle grabbed and dragged out to the far end of its track: before, the track runs on
under the area pills and the crumbs (or the command bar); after, it stops short of them, as a pawn's Size track does.
Runs against any checkout on a throwaway local relay, painted ring pictures (charcoal), and saves <tag>-prop-high.png.

  TW_GPU=1 python3 stills.py ROOT TAG OUTDIR [ports a,b]
"""
import asyncio, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request, shutil
from playwright.async_api import async_playwright
ROOT, TAG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
RP, SP = (int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '18683,19283').split(','))
ENGINE = os.path.join(ROOT, 'engine'); os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, os.path.join(ROOT, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
procs, tmp = [], []
def start():
    data = tempfile.mkdtemp(prefix='tw-tcstill-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(ROOT, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'
RBTN = "(() => { const e = document.querySelector('#ring .rbtn[data-cmd=\"edit.resize\"]'); if (!e) return null; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, under: document.elementFromPoint(x, y)?.closest('.rbtn')?.dataset.cmd || null }; })()"
async def main():
    url = start()
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        pg = await (await br.new_context(viewport={'width': 1280, 'height': 820})).new_page()
        await pg.goto(url)
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', f'TEST trackclear stills {TAG} (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw?.ready?.()', timeout=90000)
        await pg.evaluate("tw.dispatch('campaign.set', { defaults: { fogOfWar: false } })")
        await pg.evaluate('tw.spawnRoom("common", 0, 0, 6, 5, 7711)')
        await pg.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=120000)
        await pg.evaluate("(() => { const b = tw.ringSettings(); tw.ringSettingsOverride = () => ({ ...b, iconSet: 'charcoal' }); })()")
        prop = await pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object' && e.place !== 'tile' && !e.locked && !e.parent && e.dims && e.dims[1] > 1.5).sort((a, b) => (Math.abs(a.x - 15) + Math.abs(a.z - 12.5)) - (Math.abs(b.x - 15) + Math.abs(b.z - 12.5)))[0]")
        async def look(dz):
            await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({prop['x']}, 0, {prop['z'] + dz}); g.dist = 60; g.pitch = 55; g.yaw = 0; g.update(); }})()")
            await pg.keyboard.press('Escape'); await pg.evaluate(f"tw.select('{prop['id']}')"); await pg.wait_for_timeout(300)
        best = None
        for dz in [k * 1.5 for k in range(-16, 17)]:
            await look(dz); b = await pg.evaluate(RBTN)
            if b and b['under'] == 'edit.resize' and (best is None or abs(b['y'] - 170) < abs(best[1]['y'] - 170)): best = (dz, b)
        await look(best[0]); await pg.wait_for_timeout(1200); b = await pg.evaluate(RBTN)
        await pg.mouse.move(b['x'], b['y']); await pg.mouse.down(); await pg.wait_for_timeout(100)
        d = await pg.evaluate('tw.ringDrag()'); end = d['track']['ends'][1]
        for i in range(1, 13): await pg.mouse.move(b['x'] + (end[0] - b['x']) * i / 12, b['y'] + (end[1] - b['y']) * i / 12); await pg.wait_for_timeout(30)
        await pg.wait_for_timeout(700); await pg.screenshot(path=os.path.join(OUT, f'{TAG}-prop-high.png'))
        print('  track ends', d['track']['ends'], 'max', d['track']['max'], 'grab', b)
        await pg.keyboard.press('Escape'); await pg.mouse.up()
        await br.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
print('stills:', sorted(f for f in os.listdir(OUT) if f.startswith(TAG)))
