#!/usr/bin/env python3
"""Hills below the ground on Harry's map (cmp_q2bjx70ajq, the hill at x 35..115, z -25..55 ft, a cave and a trap corridor
under it), before and after the see-through hills (2026-10-27).

A COPY of the campaign runs on a local relay (its own secret, its own ports); the GM token is minted locally
(../2026-10-26-levels/mint.mjs) and never printed. Nothing touches the dev or prod relays.

  TW_GPU=1 python3 experiments/2026-10-27-hill-see/browser_shots.py <data dir> <checkout> <out dir> [--sees 0,0.25,1]

<checkout> is the tree served (this branch, or main for "before"). Shoots lv 1 and lv -1 from a high and a low angle;
with --sees, lv -1 once per value, hills and ground together (set through campaign.set, as the House look sliders do when
let go). A 3/4 angle too (Harry: "I sort of am imagining that if I have a 3/4 view").
"""
import argparse, asyncio, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('data'); ap.add_argument('tree'); ap.add_argument('out'); ap.add_argument('--sees', default='')
A = ap.parse_args()
CID, AREA, GM = 'cmp_q2bjx70ajq', 'area_gmisutca4n', 'seat_18fu4xc388'
REPO = os.path.abspath(A.tree); ENGINE = os.path.join(REPO, 'engine')
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
procs = []
def start():
    data = tempfile.mkdtemp(prefix='tw-hillsee-'); shutil.copytree(os.path.join(A.data, CID), os.path.join(data, CID))
    site = tempfile.mkdtemp(prefix='tw-hillsee-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    rp, sp = free_port(), free_port()
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(rp), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(sp), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{rp}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{sp}/engine/client/index.html', timeout=1); break
        except Exception: pass
    mine = open(os.path.join(ENGINE, 'core', 'height.js'), 'rb').read()
    assert urllib.request.urlopen(f'http://127.0.0.1:{sp}/engine/core/height.js', timeout=5).read() == mine, 'the static server is not serving that checkout'
    subprocess.run(['node', os.path.join(HERE, '..', '2026-10-26-levels', 'mint.mjs'), data, CID, GM], check=True)
    toks = json.load(open(os.path.join(data, 'local-tokens.json')))
    return f'http://127.0.0.1:{sp}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{rp}') + '&api=&faces=1500', toks

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def view(pg, x, z, dist, pitch, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(500)
ANGLES = [('high', 75, 15, 150, 70, 20), ('low', 75, 15, 120, 28, 35), ('threequarter', 75, 15, 130, 45, 45)]

async def main():
    base, toks = start(); os.makedirs(A.out, exist_ok=True)
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(args=GL)
            ctx = await br.new_context(viewport={'width': 1400, 'height': 900}); pg = await ctx.new_page()
            await pg.add_init_script("try { const p = JSON.parse(localStorage.getItem('tw.prefs') || '{}'); p.linkMail = false; localStorage.setItem('tw.prefs', JSON.stringify(p)); } catch (e) {}") # (no "Keep your GM link" card over the shots)
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(base + '#s=' + toks[GM])
            await wait(pg, "window.tw && tw.sync && tw.sync.campaign && tw.area && tw.area()", 60000, 'joined')
            await pg.evaluate(f"tw.area() !== '{AREA}' && tw.setMain('{AREA}')")
            await wait(pg, f"tw.area() === '{AREA}' && Object.keys(tw.entities()).length > 20", 30000, 'area')
            await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 120000, 'settled'); await pg.wait_for_timeout(1500)
            async def shoot(tag):
                await pg.evaluate("tw.select([])"); await pg.wait_for_timeout(300)
                await pg.evaluate("tw.worldOf(tw.area()).terrain.ready"); await pg.wait_for_timeout(1200)
                for (an, x, z, dist, pitch, yaw) in ANGLES:
                    await view(pg, x, z, dist, pitch, yaw); await pg.wait_for_timeout(1200)
                    f = os.path.join(A.out, f'{tag}-{an}.png'); await pg.screenshot(path=f); print('  shot', os.path.basename(f), flush=True)
            await pg.evaluate("tw.goLevel(0, 'test')"); await pg.wait_for_timeout(1500); await shoot('lv1')
            await pg.evaluate("tw.goLevel(-10, 'test')"); await pg.wait_for_timeout(1500)
            # the hill's top over the cathedral's round hole and the grand stair's top (a room on the hill, cut away below the ground): whole
            probe = await pg.evaluate("(() => { const w = tw.worldOf(tw.area()); w.cutPass(); const want = ['13:10', '14:10', '14:0', '15:0', '14:-1', '15:-1']; const hill = Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.type === 'hill' && e.recipe.w === 16); const got = {}; for (const s of w.shell.values()) if (s.roomId === hill.id && s.spec.layer === 'floor' && !s.spec.soft) { const k = Math.floor(s.spec.x / 5) + ':' + Math.floor(s.spec.z / 5); if (want.includes(k)) got[k] = !!s.group.visible; } return { want: want.length, drawn: Object.values(got).filter(Boolean).length, got }; })()")
            print('  hilltop over the hole and the stair top at lv -1:', probe, flush=True)
            sees = [float(v) for v in A.sees.split(',') if v.strip()]
            if not sees: await shoot('lv-1')
            for v in sees:
                await pg.evaluate(f"tw.dispatch('campaign.set', {{ defaults: {{ hillSee: {v}, groundSee: {v} }} }})"); await wait(pg, f"tw.sync.pendingCount() === 0 && tw.worldOf(tw.area()).hillSee === {v} && tw.worldOf(tw.area()).groundSee === {v}", 8000, 'hillSee')
                gs = await pg.evaluate("(() => { const w = tw.worldOf(tw.area()), m = w.ground.material, g = w.ground.geometry.attributes.position; let x0 = 1e9, x1 = -1e9; for (let i = 0; i < g.count; i++) { x0 = Math.min(x0, g.getX(i)); x1 = Math.max(x1, g.getX(i)); } return { visible: w.ground.visible, transparent: m.transparent, opacity: +m.opacity.toFixed(2), color: m.color?.getHexString(), map: !!m.map, tris: g.count / 3, x: [x0, x1], open: w.groundOpenCells.size }; })()")
                print(f'  ground at {v:g}:', gs, flush=True)
                await shoot(f'lv-1-see{v:g}')
            if errs: print('PAGE ERRORS', errs[:5])
            await br.close()
    finally:
        for pr in procs: pr.terminate()
        for pr in procs:
            try: pr.wait(5)
            except Exception: pr.kill()
asyncio.run(main())
