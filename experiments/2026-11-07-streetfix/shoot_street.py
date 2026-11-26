#!/usr/bin/env python3
"""Stills of the decal-bearing rooms at table distance (streetfix lane, 2026-11-07): a city street, a back alley and a
few rooms of other packs that lay flats over their floor (the dungeon's chasm and sewer, the mine's rail junction, a
lair). Each room is spawned on a local relay, the camera set to a table view, a still saved. Also prints the heights of
the room's floor flats, so the coplanar ones show.

  python3 experiments/2026-11-07-streetfix/shoot_street.py --tag before --out DIR
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
ap = argparse.ArgumentParser(); ap.add_argument('--tag', required=True); ap.add_argument('--out', required=True); ap.add_argument('--rooms', default=''); ap.add_argument('--tuner', default='')
A = ap.parse_args()
RP, SP = 19575, 19576
ROOMS = [  # key, w, d (cells), seed, camera [dist, pitch]
    ('mod-street', 10, 5, 7, [55, 55]), ('mod-street', 12, 6, 3, [70, 60]), ('mod-alley', 10, 3, 5, [45, 55]),
    ('dun-chasm', 6, 5, 4, [50, 55]), ('dun-sewer', 6, 5, 4, [50, 55]), ('min-junction', 5, 5, 4, [45, 55]),
]
if A.rooms: ROOMS = [r for r in ROOMS if r[0] in A.rooms.split(',')]
procs = []
def start():
    data = tempfile.mkdtemp(prefix='tw-street-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(A.tuner or os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nopost&faces=1500'

async def main():
    os.makedirs(A.out, exist_ok=True)
    page = start()
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 820}); pg = await ctx.new_page()
        await pg.goto(page + '&nointro')
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.fill('#newCampaign input[name=name]', 'TEST streetfix (throwaway)'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=40000)
        await pg.add_style_tag(content='#linkMail{display:none!important}')
        x0 = 0
        for key, w, d, seed, (dist, pitch) in ROOMS:
            rid = await pg.evaluate(f"tw.spawnRoom('{key}', {x0}, 0, {w}, {d}, {seed})")
            await pg.wait_for_function(f"!!tw.entities()['{rid}']", timeout=10000)
            await pg.wait_for_timeout(7000)
            flats = await pg.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.flat && e.room === '{rid}').map(e => [e.cat, +(e.y || 0).toFixed(4)])")
            hs = {}
            for c, y in flats: hs.setdefault(c, set()).add(y)
            print(key, {c: sorted(v) for c, v in hs.items()})
            cx, cz = (x0 + w / 2) * 5, d * 2.5  # (spawnRoom takes cells)
            await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({cx}, 0, {cz}); g.pitch = {pitch}; g.yaw = 20; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=os.path.join(A.out, f'{A.tag}-{key}-{w}x{d}.png'))
            x0 += w + 6
        await b.close()
try: asyncio.run(main())
finally:
    for pr in procs: pr.kill()
