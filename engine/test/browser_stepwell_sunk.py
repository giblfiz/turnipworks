#!/usr/bin/env python3
"""THE STEPWELL IS SUNK (2026-11-07, lane culture-roofs, Harry: "yes do roofs and such"). The Indian stepwell's tank
(ind-stepwell, a 15-ft stepped tank) stood ON the ground as a 4-ft box of stairs. It is now a sunken piece
(core/holes.js PIT_CATS `sunk`): the ground over its opening is cut as the mine shaft's floor is, and its mesh is
lowered so its paved rim meets the ground and the stairs go DOWN into it (client/holes.js sinkPit).

  TW_PORTS=a,b python3 engine/test/browser_stepwell_sunk.py --local [--shots DIR]

  ROOM     a generated Stepwell ground has its tank, on a square's centre
  CUT      the ground on the tank's 3 x 3 squares is cut (core/stairs.js holesAt at the ground), and only those
  SUNK     the tank's mesh goes down into the ground (its lowest point 3+ ft below it), its rim is at the ground
           (most of its outline within a foot of it), only the gallery stands above (under 4 ft); it is NOT clipped
  FILL     its mesh covers the cut squares to their edges (no void showing round it): its box is the cut's, to 0.3 ft
  PAWN     a pawn put on the tank is offered the fall into "the stepwell", to its bottom (4 ft down)
  OTHER    a mine shaft collar on the ground is still a through pit, clipped, not lowered
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:700] if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18485,18988').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-stepwell-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(200)
async def settle(pg, ms=30000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0 && [...tw.worldOf(tw.area()).recs.values()].every(r => r.settled)", ms, 'spawn animations over'); await pg.wait_for_timeout(400)
async def view(pg, x, z, dist=40, pitch=55, yaw=30):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(500)

# the drawn mesh of a thing, in the world: its box, the heights round its outline (the rim), whether it was clipped/sunk
MESH = """((id) => { const r = tw.worldOf(tw.area()).recs.get(id); const v = r?.visual; if (!v || v.userData.placeholder) return null; v.updateMatrixWorld(true);
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; const pts = [], p = new v.position.constructor();
  v.traverse(o => { if (!o.isMesh || o.userData.pickProxy || !o.geometry) return; const pos = o.geometry.getAttribute('position'); if (!pos) return;
    for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 4000))) { p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); pts.push([p.x, p.y, p.z]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.getComponent(k)); hi[k] = Math.max(hi[k], p.getComponent(k)); } } });
  // the rim: the highest point in each of the outer cells of a 10 x 10 grid over its plan
  const n = 10, top = new Map(); for (const [x, y, z] of pts) { const i = Math.min(n - 1, Math.floor((x - lo[0]) / (hi[0] - lo[0]) * n)), j = Math.min(n - 1, Math.floor((z - lo[2]) / (hi[2] - lo[2]) * n)); if (i > 0 && i < n - 1 && j > 0 && j < n - 1) continue; const k = i + ':' + j; top.set(k, Math.max(top.get(k) ?? -1e9, y)); }
  const rim = [...top.values()].sort((a, b) => a - b);
  return { lo, hi, rim, n: pts.length, sunk: v.userData.sunk ?? null, keep: v.userData.keep || null, clip: !!v.userData.holeClip, cat: tw.entities()[id].cat }; })"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); gm.on('console', lambda m: print('   ', m.text[:900]) if m.text.startswith('DIAG') else None)
        await gm.goto(page, timeout=180000, wait_until='domcontentloaded')
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST stepwell {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await idle(gm)

        print('ROOM: a Stepwell ground')
        R = await gm.evaluate("tw.spawnRoom('ind-stepwell', 0, 0, 7, 7, 5151)"); await idle(gm); await settle(gm)
        sw = await gm.evaluate(f"(() => {{ const e = Object.values(tw.entities()).find(o => o.cat === 'ind-stepwell' && o.room === '{R}'); return e && {{ id: e.id, x: e.x, y: e.y || 0, z: e.z, rot: e.rot || 0, dims: e.dims }}; }})()")
        check(sw and abs((sw['x'] % 5) - 2.5) < 0.01 and abs((sw['z'] % 5) - 2.5) < 0.01, 'the ground has its stepped tank, on a square\'s centre', sw)
        if not sw:
            await browser.close(); sys.exit(1)
        gx, gz = int(sw['x'] // 5), int(sw['z'] // 5)
        want = {f'{gx + i}:{gz + j}' for i in (-1, 0, 1) for j in (-1, 0, 1)}
        holes = set(await gm.evaluate("[...tw.ST.holesAt(tw.entities(), 0)]"))
        check(want <= holes and len(holes - want) == 0, 'CUT: the ground is cut on the tank\'s 3 x 3 squares, and only there', {'want': sorted(want), 'cut': sorted(holes)})

        await wait(gm, f"{MESH}('{sw['id']}') !== null", 30000, 'tank mesh')
        m = await gm.evaluate(MESH + f"('{sw['id']}')")
        rim = m['rim'] if m else []
        near = sum(1 for y in rim if abs(y) <= 1.0) / max(1, len(rim))
        check(m and m['lo'][1] <= -3.0 and (m['sunk'] or 0) >= 3.0 and not m['clip'], 'SUNK: the tank goes down into the ground (its lowest point 3+ ft under it), lowered, not clipped', m and {'low': round(m['lo'][1], 2), 'high': round(m['hi'][1], 2), 'sunk': m['sunk'], 'clip': m['clip']})
        check(m and near >= 0.4 and m['hi'][1] <= 4.0, 'its rim is at the ground (most of its outline within a foot of it); only the gallery stands above, under 4 ft', m and {'rim_near_ground': round(near, 2), 'rim': [round(v, 2) for v in rim[::max(1, len(rim) // 12)]], 'high': round(m['hi'][1], 2)})

        x0, x1 = (gx - 1) * 5, (gx + 2) * 5; z0, z1 = (gz - 1) * 5, (gz + 2) * 5
        # NO VOID: rays straight down on a 15 x 15 grid over the cut squares must all meet the tank (Gemini, blind, on the first
        # sunk tank: "large gaps around it revealing the black void"; its mesh is ragged at its corners and along one side)
        miss = await gm.evaluate("""(async ([id, x0, z0, x1, z1]) => { const THREE = await import('three'); const v = tw.worldOf(tw.area()).recs.get(id).visual; v.updateMatrixWorld(true);
          const ms = []; v.traverse(o => { if (o.isMesh && !o.userData.pickProxy) ms.push(o); }); const rc = new THREE.Raycaster(), out = []; const n = 15;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = x0 + 0.15 + (x1 - x0 - 0.3) * i / (n - 1), z = z0 + 0.15 + (z1 - z0 - 0.3) * j / (n - 1);
            rc.set(new THREE.Vector3(x, 30, z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObjects(ms, false); if (!h.length) out.push([+x.toFixed(1), +z.toFixed(1)]); }
          const sides = [...new Set(ms.map(o => o.material.side))]; if (DIAG) { const keep = ms.map(o => o.material.side); ms.forEach(o => o.material.side = THREE.DoubleSide); const two = []; for (const [x, z] of out) { rc.set(new THREE.Vector3(x, 30, z), new THREE.Vector3(0, -1, 0)); if (!rc.intersectObjects(ms, false).length) two.push([x, z]); } ms.forEach((o, i) => o.material.side = keep[i]); let mr = null; v.traverse(o => { if (!mr && o.userData.meshRoot) mr = o; }); const inv = new THREE.Matrix4().copy(mr.matrixWorld).invert(), g = new THREE.Box3(); mr.traverse(o => { if (o.isMesh && o.geometry && !o.userData.pickProxy) g.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); });
            const fr = two.map(([x, z]) => { const p = new THREE.Vector3(x, 0, z).applyMatrix4(inv); return [+((p.x - g.min.x) / (g.max.x - g.min.x)).toFixed(3), +((p.z - g.min.z) / (g.max.z - g.min.z)).toFixed(3)]; });
            console.log('DIAG', JSON.stringify({ sides, oneSided: out.length, bothSides: two, glbFrac: fr, g: [g.min.x, g.min.z, g.max.x, g.max.z].map(v => +v.toFixed(3)) })); }
          return out; })""".replace('DIAG', 'true' if os.environ.get('TW_DIAG') else 'false', 1), [sw['id'], x0, z0, x1, z1])
        check(m and m['lo'][0] <= x0 + 0.05 and m['hi'][0] >= x1 - 0.05 and m['lo'][2] <= z0 + 0.05 and m['hi'][2] >= z1 - 0.05 and len(miss) <= 2, 'FILL: its mesh covers the cut squares to their edges: every ray down through the cut meets the tank (no void showing; 2 of 225 allowed: pinholes down a step\'s face)', {'misses': len(miss), 'at': miss[:8], 'x': m and [round(m['lo'][0], 2), round(m['hi'][0], 2)], 'z': m and [round(m['lo'][2], 2), round(m['hi'][2], 2)]})
        check(m and m['keep'] == [x0, z0, x1, z1], 'and none of it is drawn outside the cut (its ragged edge, stretched past it, stood up through the ground round it)', m and {'keep': m['keep'], 'cut': [x0, z0, x1, z1]})
        print('PAWN: put on the tank')
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_sw000001', name: 'Asha', x: {sw['x'] + 2.5}, y: 0, z: {sw['z'] + 2.5} }})"); await idle(gm); await settle(gm)
        pit = await gm.evaluate("(() => { const e = tw.entities()['tok_sw000001']; return tw.pitAt(e); })()")
        check(pit and pit.get('name') == 'the stepwell' and abs(pit['y'] + 4) < 0.05, 'a pawn on the tank is offered the fall into "the stepwell", to its bottom 4 ft down', pit)

        print('OTHER: the mine shaft is still a through pit')
        sz = await gm.evaluate("tw.roomgen.sizeOf('mine-shaft-collar')")
        await gm.evaluate("(sz) => tw.dispatch('object.place', { id: 'obj_shaft001', name: 'shaft', cat: 'mine-shaft-collar', sku: sz.sku, url: sz.url, place: sz.place || 'floor', layer: 'furnish', x: 62.5, z: 7.5, y: 0, rot: 0, yaw: sz.yaw, dims: sz.dims, ...(sz.s ? { s: sz.s } : {}) })", sz); await idle(gm); await settle(gm)
        await wait(gm, f"{MESH}('obj_shaft001') !== null", 30000, 'shaft mesh')
        ms = await gm.evaluate(MESH + "('obj_shaft001')")
        check(ms and ms['clip'] and ms['sunk'] is None and ms['lo'][1] > -0.3 and '12:1' in set(await gm.evaluate("[...tw.ST.holesAt(tw.entities(), 0)]")), 'the mine shaft collar cuts the ground and is clipped, not lowered', ms and {'clip': ms['clip'], 'sunk': ms['sunk'], 'low': round(ms['lo'][1], 2)})

        if A.shots:
            os.makedirs(A.shots, exist_ok=True)
            await gm.evaluate("document.querySelectorAll('#ring, #tray, .toast').forEach(n => n.hidden = true)")
            await view(gm, sw['x'], sw['z'], 52, 55, 30); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(A.shots, 'stepwell-table.png'))
            await view(gm, sw['x'], sw['z'], 26, 40, 200); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(A.shots, 'stepwell-close.png'))

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        n = sum(1 for r in results if r[0])
        print(f'browser stepwell sunk: {n}/{len(results)} passed', flush=True)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
