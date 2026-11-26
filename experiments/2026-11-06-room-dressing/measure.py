#!/usr/bin/env python3
"""MEASURE what the game DRAWS (2026-11-06 room-dressing lane): spawn rooms in a real game page (local relay), wait until
every piece has rested and loaded, then take every placed thing's drawn world box (THREE.Box3 of its visual, the
placeholder excluded) and print things whose drawn bottom is off the floor or whose drawn box crosses the room's walls.
  python3 experiments/2026-11-06-room-dressing/measure.py type:w:d:seed [...] [--shot out.png]
Ports: TW_PORTS (default 23403,23404)."""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '23403,23404').split(','))
procs = []
def start_local():
    data = tempfile.mkdtemp(prefix='tw-measure-'); site = tempfile.mkdtemp(prefix='tw-measure-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'

BOXES = """async (rid) => { const THREE = await import('three'); const w = tw.worldOf(tw.area()), E = tw.entities(), R = E[rid].recipe, out = [];
  for (const r of w.recs.values()) { const e = r.entity; if (e.kind !== 'object' || e.room !== rid || e.flat) continue;
    const v = r.visual; if (!v || v.userData.placeholder) { out.push({ cat: e.cat, missing: true }); continue; }
    v.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(v, true);
    out.push({ id: e.id, cat: e.cat, sku: e.sku, rule: e.rule || null, place: e.place, parent: e.parent || null, x: e.x, y: e.y || 0, z: e.z, rot: e.rot, dims: e.dims,
      min: b.min.toArray().map(v => +v.toFixed(3)), max: b.max.toArray().map(v => +v.toFixed(3)) }); }
  const floors = []; for (const s of w.shell.values()) { if (!s.visual || s.spec.layer !== 'floor') continue; s.visual.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(s.visual, true); if (b.isEmpty()) continue;
    floors.push({ room: s.roomId, sku: s.spec.sku || s.spec.key || null, x: s.spec.x, z: s.spec.z, top: +b.max.y.toFixed(3), bottom: +b.min.y.toFixed(3) }); }
  const shell = []; for (const s of w.shell.values()) { if (s.roomId !== rid || !s.visual || s.spec.layer !== 'walls') continue; s.visual.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(s.visual, true); if (b.isEmpty()) continue;
    shell.push({ sku: s.spec.sku || s.spec.key || null, x: s.spec.x, z: s.spec.z, rot: s.spec.rot, min: b.min.toArray().map(v => +v.toFixed(3)), max: b.max.toArray().map(v => +v.toFixed(3)) }); }
  return { room: { x: R.x, z: R.z, w: R.w, d: R.d }, things: out, shell, floors }; }"""

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('rooms', nargs='+'); ap.add_argument('--shot'); ap.add_argument('--json'); ap.add_argument('--close'); ap.add_argument('--pitch', type=float, default=12); ap.add_argument('--dist', type=float, default=14)
    A = ap.parse_args(); page = start_local(); res = []
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL])
            ctx = await br.new_context(viewport={'width': 1600, 'height': 900}); pg = await ctx.new_page()
            await tw_sandbox.aproxy(pg, 'http://127.0.0.1:8096')
            await pg.goto(page, timeout=180000, wait_until='domcontentloaded')
            await pg.fill('#newCampaign input[name=gm]', 'Harry')
            nm = await pg.query_selector('#newCampaign input[name=name]')
            if nm: await nm.fill(f"TEST measure {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await pg.click('#newCampaign button')
            await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
            X = 0
            for spec in A.rooms:
                t, w, d, s = spec.split(':'); w, d, s = int(w), int(d), int(s)
                rid = await pg.evaluate(f"tw.spawnRoom('{t}', {X}, 0, {w}, {d}, {s})")
                await pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=30000)
                await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({(X + w / 2) * 5}, 0, {d * 2.5}); g.pitch = 45; g.yaw = -30; g.dist = 60; g.update(); tw.main.rule = 'free'; }})()")
                await pg.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", timeout=120000)
                await pg.wait_for_timeout(1500)
                B = await pg.evaluate(BOXES, rid); B['spec'] = spec; res.append(B)
                if A.shot: await pg.screenshot(path=A.shot.replace('.png', f'-{t}.png'))
                if A.close and A.shot:  # close-ups of each thing of these cats, low and from four sides
                    for i, o in enumerate([o for o in B['things'] if o.get('cat') in A.close.split(',')]):
                        for yaw in (0, 90, 180, 270):
                            await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({o['x']}, 1, {o['z']}); g.pitch = {A.pitch}; g.yaw = {yaw}; g.dist = {A.dist}; g.update(); tw.main.rule = 'free'; }})()")
                            await pg.wait_for_timeout(700)
                            await pg.screenshot(path=A.shot.replace('.png', f"-{t}-{o['cat']}{i}-y{yaw}.png"))
                X += w + 4
            await br.close()
    finally:
        for pr in procs: pr.kill()
    for B in res:
        R = B['room']; X0, Z0, X1, Z1 = R['x'] * 5 + 0.5, R['z'] * 5 + 0.5, (R['x'] + R['w']) * 5 - 0.5, (R['z'] + R['d']) * 5 - 0.5
        print('ROOM', B['spec'], 'inner faces x', X0, X1, 'z', Z0, Z1)
        gx0, gz0, gx1, gz1 = X0 - 0.5, Z0 - 0.5, X1 + 0.5, Z1 + 0.5; reach = {'W': [], 'E': [], 'N': [], 'S': []}
        for s in B.get('shell', []):
            lo, hi = s['min'], s['max']
            if abs(s['x'] - gx0) < 1: reach['W'].append(round(hi[0] - gx0, 2))
            if abs(s['x'] - gx1) < 1: reach['E'].append(round(gx1 - lo[0], 2))
            if abs(s['z'] - gz0) < 1: reach['N'].append(round(hi[2] - gz0, 2))
            if abs(s['z'] - gz1) < 1: reach['S'].append(round(gz1 - lo[2], 2))
        fl = [f for f in B.get('floors', []) if X0 - 0.5 <= f['x'] <= X1 + 0.5 and Z0 - 0.5 <= f['z'] <= Z1 + 0.5]
        print('  floor tiles', len(fl), 'tops', sorted(set(f['top'] for f in fl)), 'bottoms', sorted(set(f['bottom'] for f in fl))[:4], 'skus', sorted(set(str(f['sku']) for f in fl)))
        print('  wall reach into the room from the grid line (ft), per side, per piece:', {k: sorted(v, reverse=True)[:8] for k, v in reach.items()})
        for o in B['things']:
            if o.get('missing'): print('  (not drawn)', o['cat']); continue
            lo, hi = o['min'], o['max']; flags = []
            if o['place'] == 'floor' and lo[1] > o['y'] + 0.08: flags.append(f"bottom {lo[1]:.2f} above its y {o['y']:.2f}")
            over = max(X0 - lo[0], lo[0] - lo[0], hi[0] - X1, Z0 - lo[2], hi[2] - Z1)
            if o['place'] == 'floor' and over > 0.05: flags.append(f"crosses a wall by {over:.2f} ft (x {lo[0]:.2f}..{hi[0]:.2f} z {lo[2]:.2f}..{hi[2]:.2f})")
            print(('  !! ' if flags else '     ') + f"{o['cat']:28s} {o['rule'] or '':14s} y {o['y']:.2f} drawn y {lo[1]:.2f}..{hi[1]:.2f} " + '; '.join(flags))
    if A.json: json.dump(res, open(A.json, 'w'), indent=1)

if __name__ == '__main__': asyncio.run(main())
