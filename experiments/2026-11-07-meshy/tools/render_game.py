#!/usr/bin/env python3
"""The meshy lane's in-game stills (2026-11-07): every candidate of a subject in the REAL engine, like for like.

  TW_PORTS=19787,19788 python3 experiments/2026-11-07-meshy/tools/render_game.py OUTDIR [subject ...]

For each subject: (1) ROOM: its own room type spawned at a fixed seed; every thing of the subject's category swapped
(object.replace) to each version in turn, the same table-distance view (and a closer one on the first such thing) shot
for each; (2) ALONE: each version alone on the table, three-quarter close, and at table distance.
Versions: cur (the shipped sku), tr2 (TRELLIS regenerated, seed 7311), mx7 (Meshy 7.1 + remesh 20k), mxt (Meshy
Smart Topology t2.5 10k). All four went through the same runtime prep (5,000 faces, 256-px colour map, LOD ladder).
"""
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(os.path.join(HERE, '../../..')); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(ENGINE, 'test')); sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
SUBJECTS = {  # subject (= category) -> (room key, room w, d in cells, seed)
    'store-shelving': ('mod-store', 6, 5, 5101), 'drinks-cooler': ('mod-store', 6, 5, 5101), 'pallet-racking': ('mod-warehouse', 7, 6, 5102),
    'server-rack': ('cyb-server', 6, 5, 5103), 'fence-chain-link': ('cyb-hideout', 6, 5, 5104), 'antenna-mast': ('cyb-rooftop', 6, 5, 5105),
}
ONLY = sys.argv[2:] or list(SUBJECTS)
VERSIONS = os.environ.get('VERSIONS', 'cur,tr2,mx7,mxt').split(',')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19787,19788').split(','))
procs = []


def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-meshy-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&nodelivery'


async def wait(pg, js, timeout=12000):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {js[:80]})'); return False
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000); await pg.wait_for_timeout(300)
async def settle(pg): await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", 120000); await pg.wait_for_timeout(1500)
async def view(pg, x, z, dist, pitch, yaw, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(400)
def sku_of(subject, v): return subject if v == 'cur' else f'{subject}--{v}'


async def main():
    page = start_local()
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        ctx = await br.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
        gm = await ctx.new_page(); errs = []; gm.on('pageerror', lambda e: errs.append(str(e)))
        await gm.goto(page, timeout=180000, wait_until='domcontentloaded')
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST meshy {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        assert await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab never came up'
        await gm.evaluate("tw.registry.run('view.roofsOff')"); await gm.wait_for_timeout(500)
        log = {}
        for subj in ONLY:
            key, w, d, seed = SUBJECTS[subj]; rec = log.setdefault(subj, {})
            R = await gm.evaluate(f"tw.spawnRoom('{key}', 0, 0, {w}, {d}, {seed})"); await idle(gm); await settle(gm)
            ids = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{R}' && e.cat === '{subj}').map(e => ({{id: e.id, x: e.x, z: e.z, sku: e.sku, dims: e.dims}}))")
            if not ids:  # the room did not roll one: put one in its middle
                await gm.evaluate(f"tw.dispatch('object.place', {{ id: 'obj_mshy0001', x: {w * 2.5}, z: {d * 2.5}, cat: '{subj}', room: '{R}', ...tw.roomgen.sizeOf('{subj}') }})"); await idle(gm); await settle(gm)
                ids = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.cat === '{subj}').map(e => ({{id: e.id, x: e.x, z: e.z, sku: e.sku, dims: e.dims}}))")
            rec['room'] = {'key': key, 'things': len(ids), 'skus': sorted({i['sku'] for i in ids})}
            span = max(w, d) * 5; cx, cz = w * 2.5, d * 2.5; f = ids[0]
            for v in VERSIONS:
                s = sku_of(subj, v)
                for i in ids: await gm.evaluate(f"tw.dispatch('object.replace', {{ id: '{i['id']}', cat: '{subj}', sku: '{s}', url: 'assets/m/{s}.glb' }})")
                await idle(gm); await settle(gm)
                await view(gm, cx, cz + 2, span * 1.9 + 20, 55, 0); await gm.screenshot(path=f'{OUT}/{subj}--{v}--room-table.png')
                await view(gm, f['x'], f['z'], max(f['dims']) * 2.4 + 8, 38, 25, max(f['dims'][1] / 2, 1)); await gm.screenshot(path=f'{OUT}/{subj}--{v}--room-close.png')
            await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{R}' }})"); await idle(gm)
            for v in VERSIONS:  # alone on the table
                s = sku_of(subj, v); oid = f'obj_mshy{abs(hash((subj, v))) % 10**6:06d}'
                await gm.evaluate(f"tw.dispatch('object.place', {{ id: '{oid}', x: 200, z: 200, cat: '{subj}', ...tw.roomgen.sizeOf('{subj}'), sku: '{s}', url: 'assets/m/{s}.glb', yaw: 0 }})"); await idle(gm); await settle(gm)
                dims = await gm.evaluate(f"tw.entities()['{oid}'].dims"); h = dims[1]
                await view(gm, 200, 200, max(dims) * 2.2 + 6, 28, 30, h / 2); await gm.screenshot(path=f'{OUT}/{subj}--{v}--alone-close.png')
                await view(gm, 200, 200, max(dims) * 2.2 + 6, 28, 210, h / 2); await gm.screenshot(path=f'{OUT}/{subj}--{v}--alone-back.png')
                await view(gm, 200, 200, 60, 55, 0); await gm.screenshot(path=f'{OUT}/{subj}--{v}--alone-table.png')
                await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{oid}' }})"); await idle(gm)
            print(subj, json.dumps(rec), flush=True)
        json.dump(log, open(f'{OUT}/render-log.json', 'w'), indent=1)
        print('page errors:', errs[:5])
        await br.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
