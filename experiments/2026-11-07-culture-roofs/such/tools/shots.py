#!/usr/bin/env python3
"""Table-camera stills of the SUCH items, from ANY checkout (this worktree, or the scratch copy of main for the
"before" pictures): the game client (engine/client), its own local relay, fog off, the UI hidden.
  TW_PORTS=a,b python3 shots.py REPO OUTDIR [scene,...]
Scenes: ballcourt (cells from --court WxD), stepwell, mexhouse (a Mexica house: its walls), walls (the two
mes-stucco straight-wall skus alone, side by side)."""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
ap = argparse.ArgumentParser(); ap.add_argument('repo'); ap.add_argument('out'); ap.add_argument('scenes', nargs='?', default='ballcourt,stepwell,mexhouse,walls')
ap.add_argument('--court', default='14x6'); ap.add_argument('--tag', default=''); ap.add_argument('--seed', type=int, default=7301)
A = ap.parse_args()
REPO = os.path.abspath(A.repo); ENGINE = os.path.join(REPO, 'engine'); os.makedirs(A.out, exist_ok=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18477,18978').split(','))
procs = []
def start():
    data = tempfile.mkdtemp(prefix='tw-such-shots-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'
async def wait(pg, js, timeout=12000):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: return False
async def settle(pg): await wait(pg, "tw.sync.pendingCount() === 0 && [...tw.worldOf(tw.area()).recs.values()].every(r => r.settled)", 60000); await pg.wait_for_timeout(1500)
async def view(pg, x, z, dist, pitch, yaw):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(900)
HIDE = "(() => { document.body.classList.add('shot'); const s = document.createElement('style'); s.textContent = '* { visibility: hidden !important; } canvas, canvas * { visibility: visible !important; }'; document.head.appendChild(s); })()"  # (as browser_cultureroofs.py: nothing but the 3D view; no menus, no room-name pills)
async def main():
    url = start(); out = []
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'])
        ctx = await b.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
        pg = await ctx.new_page(); await pg.goto(url, timeout=180000, wait_until='domcontentloaded')
        await pg.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await pg.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST such shots {time.strftime('%H:%M:%S')} (throwaway)")
        await pg.click('#newCampaign button'); await wait(pg, 'window.tw && tw.ready && tw.ready()', 120000)
        await pg.evaluate("tw.registry.run('area.fogOfWar.off')"); await pg.wait_for_timeout(500)
        tag = A.tag
        for sc in A.scenes.split(','):
            if sc == 'ballcourt':
                W, D = (int(v) for v in A.court.split('x'))
                R = await pg.evaluate(f"tw.spawnRoom('mes-ballcourt', 0, 0, {W}, {D}, {A.seed})"); await settle(pg)
                cx, cz = W * 2.5, D * 2.5
                inv = await pg.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{R}' && e.kind === 'object').map(e => e.cat)")
                out.append({'scene': sc, 'room': R, 'cats': sorted(set(inv)), 'n': len(inv)})
                await pg.evaluate(HIDE)
                for nm_, d, pi, yw in (('table', W * 5 * 1.25, 55, 25), ('top', W * 5 * 1.2, 85, 0)):
                    await view(pg, cx, cz, d, pi, yw); f = os.path.join(A.out, f'ballcourt-{nm_}{tag}.png'); await pg.wait_for_timeout(2500); await pg.screenshot(path=f); out[-1][nm_] = f
            if sc == 'stepwell':
                R = await pg.evaluate(f"tw.spawnRoom('ind-stepwell', 0, 12, 7, 7, {A.seed})"); await settle(pg); await pg.evaluate(HIDE)
                inv = await pg.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{R}' && e.kind === 'object').map(e => e.cat)")
                out.append({'scene': sc, 'room': R, 'cats': sorted(set(inv))})
                for nm_, d, pi, yw in (('table', 50, 55, 25), ('low', 30, 35, 200)):
                    await view(pg, 17.5, 77.5, d, pi, yw); f = os.path.join(A.out, f'stepwell-{nm_}{tag}.png'); await pg.wait_for_timeout(2500); await pg.screenshot(path=f); out[-1][nm_] = f
            if sc == 'mexhouse':
                R = await pg.evaluate(f"tw.spawnRoom('mes-house', 12, 12, 6, 4, {A.seed})"); await settle(pg); await pg.evaluate(HIDE)
                skus = await pg.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object').map(e => e.sku).filter(s => /mes-stucco/.test(s || ''))")
                edges = await pg.evaluate("[...tw.worldOf(tw.area()).edges.values()].filter(e => e.family === 'mes-stucco').map(e => e.kind)")
                out.append({'scene': sc, 'room': R, 'edgeKinds': {k: edges.count(k) for k in set(edges)}})
                for nm_, d, pi, yw in (('table', 45, 55, 25), ('wall', 26, 30, 160)):
                    await view(pg, 75, 70, d, pi, yw); f = os.path.join(A.out, f'mexhouse-{nm_}{tag}.png'); await pg.wait_for_timeout(2500); await pg.screenshot(path=f); out[-1][nm_] = f
            if sc == 'walls':
                ops = []
                for i, sku in enumerate(['wall-straight--mes-stucco', 'wall-straight--mes-stucco--s2']):
                    sz = await pg.evaluate(f"tw.roomgen.sizeOf('wall-straight', '{sku}')")
                    if sz: ops.append({'type': 'object.place', 'args': {'id': f'obj_wall{i:04d}', 'name': sku, 'cat': 'wall-straight', 'sku': sz['sku'], 'url': sz['url'], 'place': 'kit', 'layer': 'walls', 'x': 120 + i * 12, 'z': 10, 'y': 0, 'rot': 0, 'yaw': sz['yaw'], 'dims': sz['dims'], **({'s': sz['s']} if sz.get('s') else {})}})
                await pg.evaluate("(ops) => tw.batch(ops)", ops); await settle(pg); await pg.evaluate(HIDE)
                await view(pg, 126, 10, 30, 30, 0); f = os.path.join(A.out, f'walls-pair{tag}.png'); await pg.wait_for_timeout(2500); await pg.screenshot(path=f)
                out.append({'scene': sc, 'pair': f, 'left': 'wall-straight--mes-stucco', 'right': 'wall-straight--mes-stucco--s2'})
        await b.close()
    for pr in procs: pr.terminate()
    print(json.dumps(out, indent=1))
try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
