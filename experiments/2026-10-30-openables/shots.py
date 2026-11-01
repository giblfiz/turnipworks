#!/usr/bin/env python3
"""OPENABLES, SHUT AND OPEN AT TABLE DISTANCE (2026-10-30). Places one of every openable SKU on an empty table (plus
the things that SHOULD open: kinds with an "-open" twin or a hatch, whether or not the game lets them yet), shoots each
shut, opens them all with object.open (the same journal line a click sends), shoots each open. The crops are written
under OUT/blind/ with random names (the key in OUT/key.json, outside the folder Gemini sees), for the blind
"open or shut?" read (judge.py).

  TW_PORTS=a,b python3 experiments/2026-10-30-openables/shots.py OUT [--only cat,cat]
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(ENGINE, 'test')); sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa
tw_sandbox.remove_campaigns()
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--only'); ap.add_argument('--dist', type=float, default=34); ap.add_argument('--pitch', type=float, default=52)
ap.add_argument('--crop', type=int, default=300); ap.add_argument('--still', action='store_true', help='reduce motion (no open animation)')
A = ap.parse_args()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18731,18732').split(','))
procs = []

# the kinds to shoot: every catalog object that says it opens, and the ones that should (an "-open" twin, a hatch)
SHOULD = ['bread-oven', 'cupboard', 'iron-maiden', 'wardrobe', 'salt-box', 'smith-farrier-box', 'rural-grooming-box', 'wall-window-small', 'floor-trapdoor', 'oubliette-hatch']

def start_local():
    data = tempfile.mkdtemp(prefix='tw-openables-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print('    (timed out:', js[:70], ')'); return False

async def main():
    url = start_local(); os.makedirs(os.path.join(A.out, 'blind'), exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-renderer-backgrounding'])
        ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1, reduced_motion='reduce' if A.still else 'no-preference')
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url, timeout=180000, wait_until='domcontentloaded')
        await pg.fill('#newCampaign input[name=gm]', 'Harry'); await pg.click('#newCampaign button')
        await wait(pg, 'window.tw && tw.ready && tw.ready()', 90000)
        items = await pg.evaluate("""(([should, only]) => {
          const L = tw.lib.objects, out = [], isState = (id) => !!L[id]?.open_of || (id.endsWith('-open') && !!L[id.slice(0, -5)]);
          const cats = Object.keys(L).filter(id => !isState(id) && (L[id].aff || []).includes('open')).concat(should).filter(id => L[id] && (!only || only.includes(id)));
          for (const cat of [...new Set(cats)].sort()) for (const k of L[cat].skus) { if (!k.bounds || !k.url) continue; const sz = tw.roomgen.sizeOf(cat, k.sku); if (sz) out.push({ cat, sku: k.sku, sz, uiOpens: tw.assets.openable(cat) }); }
          return out; })""", [SHOULD, A.only.split(',') if A.only else None])
        print(len(items), 'skus')
        COLS = 12; SP_ = 16
        ops = []
        for i, it in enumerate(items):
            it['id'] = f'obj_op{i:03d}'; it['x'] = 8 + (i % COLS) * SP_; it['z'] = 8 + (i // COLS) * SP_
            sz = it['sz']; ops.append({'type': 'object.place', 'args': {'id': it['id'], 'name': it['cat'].replace('-', ' '), 'cat': it['cat'], 'sku': sz['sku'], 'url': sz['url'], 'place': sz['place'] or 'floor', 'layer': 'openings' if sz['place'] == 'kit' else 'furnish', 'x': it['x'], 'z': it['z'], 'y': 0, 'rot': 0, 'yaw': sz['yaw'], 'dims': sz['dims'], **({'s': sz['s']} if sz.get('s') else {})}})
        # a door, gate or portcullis stands in a doorway, as it does in the game (a lone leaf turned 100 degrees is just a
        # door turned round): its width set as a generated door's (one 5-ft edge, two for a pair) between two wall sections
        wall = await pg.evaluate("(() => { const sz = tw.roomgen.sizeOf('wall-straight'); return sz; })()")
        FLOOR_OR_WALL = ('roof-hatch', 'floor-trapdoor', 'oubliette-hatch', 'wall-window-small', 'wall-secret-door')
        PAIR = ('door-double-grand', 'door-barn-double', 'gate-double-timber')
        for i, it in enumerate(items):
            if it['sz']['place'] != 'kit' or it['cat'] in FLOOR_OR_WALL: continue
            span = 2 if it['cat'] in PAIR else 1; w = span * 5 - (8 if span == 1 else 16) / 12
            a = ops[i]['args']; a['dims'] = [w, a['dims'][1], a['dims'][2]]; a.pop('s', None)
            for side in (-1, 1):
                ops.append({'type': 'object.place', 'args': {'id': f"{it['id']}w{'l' if side < 0 else 'r'}", 'name': 'wall', 'cat': 'wall-straight', 'sku': wall['sku'], 'url': wall['url'], 'place': 'kit', 'layer': 'walls', 'x': it['x'] + side * (span * 2.5 + 2.5), 'z': it['z'], 'y': 0, 'rot': 0, 'yaw': 0, 'dims': [5, 9, 1]}})
        for k in range(0, len(ops), 40): await pg.evaluate("(ops) => tw.batch(ops)", ops[k:k + 40]); await wait(pg, 'tw.sync.pendingCount() === 0', 30000)
        await wait(pg, "tw.spawningNow().anims === 0 && tw.sync.pendingCount() === 0", 120000); await pg.wait_for_timeout(3000)
        await wait(pg, "[...tw.worldOf(tw.area()).recs.values()].every(r => r.settled)", 120000)
        key = {}
        async def shoot(state):
            for it in items:
                h = it['sz']['dims'][1]
                await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({it['x']}, {h / 2}, {it['z']}); g.pitch = {A.pitch}; g.yaw = 30; g.dist = {A.dist}; g.update(); tw.main.rule = 'free'; }})()")
                await pg.wait_for_timeout(350)
                name = f"{random.getrandbits(40):010x}.png"; c = A.crop
                await pg.screenshot(path=os.path.join(A.out, 'blind', name), clip={'x': 700 - c / 2, 'y': 450 - c / 2, 'width': c, 'height': c})
                key[name] = {'cat': it['cat'], 'sku': it['sku'], 'state': state}
        await shoot('shut')
        # each thing's visual, as the world sees it (rig, swap, nothing)
        await pg.evaluate("(ids) => tw.batch(ids.map(id => ({ type: 'object.open', args: { id, open: true } })))", [it['id'] for it in items])
        await wait(pg, 'tw.sync.pendingCount() === 0', 30000); await pg.wait_for_timeout(2500)
        await wait(pg, "[...tw.worldOf(tw.area()).recs.values()].every(r => r.settled)", 60000); await pg.wait_for_timeout(1500)
        looks = await pg.evaluate("(ids) => ids.map(id => { const r = tw.worldOf(tw.area()).recs.get(id), e = tw.entities()[id], R = r?.visual?.userData.openRig; let twin = null; r?.visual?.traverse(o => { if (o.userData.meshRoot && !twin) twin = o.name || true; }); const sp = tw.assets.specOf(e); return { look: tw.assets.openLook?.(e) ?? null, rigT: R ? R.t : null, rigMode: sp.openRig ? ({ hinge: 'swing', leaf: 'swing flat to the wall', double: 'pair, each flat to its wall', slide: 'slide up' })[sp.openRig.mode] : sp.hinge ? 'swing (bench)' : null, spec: sp.id }; })", [it['id'] for it in items])
        for it, L in zip(items, looks): it.update(L)
        await shoot('open')
        json.dump(key, open(os.path.join(A.out, 'key.json'), 'w'), indent=1)
        json.dump(items, open(os.path.join(A.out, 'items.json'), 'w'), indent=1)
        print('page errors:', errs[:3])
        await b.close()

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
