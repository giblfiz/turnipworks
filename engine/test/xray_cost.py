#!/usr/bin/env python3
"""Pawn X-ray: what it costs on a big scene, and pictures for a blind read.   (2026-10-06)

  TW_GPU=1 python3 engine/test/xray_cost.py [--rooms 24] [--pawns 60] [--shots DIR]

A local relay and site (nothing live). Builds a two-storey inn with roofs plus a grid of rooms over GET, puts figure
pawns in and on them (4 owned by a player, the rest the GM's, some hidden, some upstairs), then times frames with the
X-ray off and on, alternating, with the frame rate uncapped. Prints one JSON line. --shots writes without / with
pictures (roofs on, table camera) for engine/test/shots or a Gemini read.
"""
import argparse, json, os, shutil, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
ap = argparse.ArgumentParser(); ap.add_argument('--rooms', type=int, default=24); ap.add_argument('--pawns', type=int, default=60); ap.add_argument('--shots'); ap.add_argument('--seconds', type=float, default=3)
A = ap.parse_args()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18175,18805').split(','))
procs = []; tmp = []
def start():
    data = tempfile.mkdtemp(prefix='tw-xray-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'
MEASURE = """(ms) => new Promise(resolve => { const dts = []; let last = null, t0 = null; const tick = (now) => { if (last !== null) dts.push(now - last); else t0 = now; last = now; if (now - t0 < ms) requestAnimationFrame(tick); else resolve({ n: dts.length, wall: now - t0 }); }; requestAnimationFrame(tick); })"""
def main():
    page = start()
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-frame-rate-limit', '--disable-gpu-vsync'])
        pg = b.new_context(viewport={'width': 1600, 'height': 900}, device_scale_factor=1).new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(page); pg.fill('#newCampaign input[name=gm]', 'Harry'); pg.fill('#newCampaign input[name=name]', 'TEST xray cost (throwaway)'); pg.click('#newCampaign button')
        pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=90000)
        cid, area, tok = pg.evaluate("[tw.sync.campaign.id, tw.area(), new URLSearchParams(location.hash.slice(1)).get('s')]")
        base = f'http://127.0.0.1:{RP}/c/{cid}'
        def get(path, **q): return json.loads(urllib.request.urlopen(f"{base}{path}?{urllib.parse.urlencode({**q, 'seat': tok})}", timeout=60).read())
        player = get('/do', cmd='seat.create', id='seat_xrayplyr01', kind='human', role='player', name='Mira')
        rooms = [('common', 0, 0, 30, 20, 0), ('kitchen', 30, 0, 20, 20, 0), ('guest', 0, 0, 20, 20, 10), ('fine', 30, 0, 20, 20, 10)]
        types = ['common', 'kitchen', 'guest', 'storeroom', 'cellar']
        for i in range(max(0, A.rooms - 4)): rooms.append((types[i % len(types)], 70 + (i % 5) * 35, (i // 5) * 30, 25, 20, 0))
        made = 0
        for i, (t, x, z, w, d, y) in enumerate(rooms):
            r = get(f'/a/{area}/do', cmd='room.spawn', type=t, x=x, z=z, w=w, d=d, seed=4000 + i, **({'y': y} if y else {}))
            made += 1 if r.get('ok') else 0
            if not r.get('ok') and made == 0: print('room.spawn refused:', r.get('why'), file=sys.stderr)
        figs = [f['id'] for f in get('/figures', q='hero', limit=40)['figures']][:4] + [f['id'] for f in get('/figures', q='foe', limit=40)['figures']]
        n = 0
        for i in range(A.pawns):
            rm = rooms[i % len(rooms)]; owned = i < 4; hidden = (not owned) and i % 9 == 5
            x = rm[1] + 2.5 + 5 * ((i // len(rooms)) % max(1, rm[3] // 5)); z = rm[2] + 2.5 + 5 * ((i // (len(rooms) * 2)) % max(1, rm[4] // 5)) + (5 if i % 2 else 0)
            r = get(f'/a/{area}/do', cmd='token.create', fig=figs[i % len(figs)], x=x, z=min(z, rm[2] + rm[4] - 2.5), **({'y': rm[5]} if rm[5] else {}), **({'owner': 'seat_xrayplyr01'} if owned else {}), **({'hidden': 'true'} if hidden else {}))
            n += 1 if r.get('ok') else 0
        pg.wait_for_function(f"Object.values(tw.entities()).filter(e => e.kind === 'token').length >= {n} && tw.sync.pendingCount() === 0", timeout=120000)
        t0 = time.time()
        while time.time() - t0 < 240:  # every figure loaded, every room in
            st = pg.evaluate("(() => { const w = tw.worldOf(tw.area()); let wait = 0; for (const r of w.recs.values()) if (r.entity.kind === 'token' && r.visual?.userData.fig && !r.visual.userData.loaded && !r.visual.userData.failed) wait++; const s = tw.spawningNow(); return { wait, anims: s.anims }; })()")
            if st['wait'] == 0 and st['anims'] == 0: break
            pg.wait_for_timeout(500)
        pg.wait_for_timeout(2500)
        cam = lambda x, z, dist, pitch=55, yaw=0: pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
        ex = max(r[1] + r[3] for r in rooms); ez = max(r[2] + r[4] for r in rooms)
        out = {'rooms': made, 'pawns': n, 'entities': pg.evaluate('Object.keys(tw.entities()).length')}
        for view, (x, z, dist) in {'whole map': (ex / 2, ez / 2, max(ex, ez) * 0.75), 'the inn, close': (25, 10, 70)}.items():
            cam(x, z, dist); pg.wait_for_timeout(1200); off = []; on = []
            for k in range(3):
                pg.evaluate('tw.setXray(false, { quiet: true })'); pg.wait_for_timeout(300); m = pg.evaluate(MEASURE, A.seconds * 1000); off.append(m['wall'] / max(1, m['n']))
                pg.evaluate('tw.setXray(true, { quiet: true })'); pg.wait_for_timeout(300); m = pg.evaluate(MEASURE, A.seconds * 1000); on.append(m['wall'] / max(1, m['n']))
            info = pg.evaluate('tw.xrayInfo()')
            out[view] = {'off_ms': [round(v, 2) for v in off], 'on_ms': [round(v, 2) for v in on], 'off_median': round(statistics.median(off), 2), 'on_median': round(statistics.median(on), 2), 'extra_ms': round(statistics.median(on) - statistics.median(off), 2), 'xray_draws': info['draws'], 'xray_tris': info['tris'], 'xray_cpu_ms': info['cpuMs'], 'materials': info['materials']}
        pg.evaluate('tw.setXray(false, { quiet: true })')
        if A.shots:
            os.makedirs(A.shots, exist_ok=True)
            pg.evaluate("tw.setRoofs && tw.setRoofs(true, 'test'); tw.cutOff && tw.cutOff('test')"); cam(25, 12, 78, 50, 20); pg.mouse.move(5, 5); pg.wait_for_timeout(2500)
            pg.screenshot(path=os.path.join(A.shots, 'xray-roofs-without.png'))
            pg.evaluate('tw.setXray(true, { quiet: true })'); pg.wait_for_timeout(900); pg.screenshot(path=os.path.join(A.shots, 'xray-roofs-with.png'))
            inn = pg.evaluate("tw.xrayInfo().pawns.filter(p => p.at[0] < 52 && p.at[2] < 22).map(p => ({ color: p.color, y: p.at[1] }))")
            out['inn_pawns'] = {'total': len(inn), 'players': sum(1 for p in inn if p['color'] == '#39d5ff'), 'upstairs': sum(1 for p in inn if p['y'] > 5)}
            pg.evaluate("tw.setRoofs(false, 'test'); tw.goLevel && tw.goLevel(0, 'test'); tw.cutOn && tw.cutOn('test')"); pg.wait_for_timeout(1800)
            pg.screenshot(path=os.path.join(A.shots, 'xray-cut-with.png'))
            pg.evaluate('tw.setXray(false, { quiet: true })'); pg.wait_for_timeout(900); pg.screenshot(path=os.path.join(A.shots, 'xray-cut-without.png'))
        out['errors'] = errs[:3]
        print(json.dumps(out)); b.close()
try: main()
finally:
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(timeout=5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
