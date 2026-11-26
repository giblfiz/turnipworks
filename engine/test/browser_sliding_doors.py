#!/usr/bin/env python3
"""JAPANESE DOORS SLIDE (2026-11-07, lane culture-roofs, Harry: "yes do roofs and such"). The koshido (the house's
outer lattice door) and the fusuma (the inner paper panel) were hung on a hinge like every leaf and swung 175 degrees.
A leaf whose SKU record says `slides` (library.json; the run manifest's flags column) now steps out to just off the
wall's face and slides one leaf-width ALONG the wall to stand beside its opening (client/openlook.js SLIDE_ALONG).
Two seats, the GM and a player (Mira). The open state travels as every door's does; only the look differs.

  TW_PORTS=a,b python3 engine/test/browser_sliding_doors.py --local

  DATA     the koshido and fusuma leaves are marked `slides`; the house rigs them 'motion' (a slide), the plain
           plank leaf is still a hinge
  ROOM     a generated Tatami room's door (a koshido leaf), opened by Mira from the wall: drawn open on both seats;
           its leaf moved ALONG the wall by most of a leaf width (3+ ft), stayed within 1.2 ft of the wall line
           and on the floor, and did NOT turn (the leaf's world rotation is the shut one's); the GM sees it partway
           (it slides, and while sliding it does not turn either); both seats draw it at the same place
  SHUT     Mira shuts it: back where it was shut, on both seats
  FUSUMA   a fusuma leaf placed on the table slides the same way, and back
  HINGE    a common room's plank door still SWINGS (its leaf turns ~175 degrees)
  REPLAY   Mira reloads with the koshido open: drawn slid open at once
"""
import argparse, asyncio, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
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

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18477,18978').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-slide-'); site = tempfile.mkdtemp(prefix='tw-site-')
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

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(200)
async def settle(pg, ms=30000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0 && [...tw.worldOf(tw.area()).recs.values()].every(r => r.settled)", ms, 'spawn animations over'); await pg.wait_for_timeout(400)

# a thing as a seat draws it: state, rig pose, moving; and its LEAF's pose in the world: the box centre of the moving
# part's triangles (the rig's own parts, not the click proxy) and that part's world rotation (a quaternion)
POSE = """((id) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id), e = tw.entities()[id]; if (!e || !r?.visual) return null;
  const v = r.visual, R = v.userData.openRig; v.updateMatrixWorld(true);
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], q = null, n = 0;
  v.traverse(o => { if (!o.isMesh || !o.userData.hingePart || !o.geometry) return; let inPart = false; for (let p = o.parent; p; p = p.parent) if (/^open_part_|hinge/i.test(p.name || '')) inPart = true; if (!inPart) return;
    n++; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    lo = lo.map((x, i) => Math.min(x, b.min.getComponent(i))); hi = hi.map((x, i) => Math.max(x, b.max.getComponent(i)));
    if (!q) { const Q = o.getWorldQuaternion(new o.quaternion.constructor()); q = [Q.x, Q.y, Q.z, Q.w]; } });
  return { open: !!e.open, rig: R ? Math.round(R.t * 1000) / 1000 : null, moving: !!w.openAnims?.has(r), look: tw.assets.openLook(e), cat: e.cat, sku: e.sku, rot: e.rot || 0,
    parts: n, c: n ? lo.map((x, i) => (x + hi[i]) / 2) : null, ext: n ? lo.map((x, i) => hi[i] - x) : null, q }; })"""
def qangle(a, b):  # degrees between two rotations
    if not a or not b: return None
    d = abs(sum(x * y for x, y in zip(a, b))); return round(math.degrees(2 * math.acos(min(1.0, d))), 1)
def moved(a, b, wall_dir):  # (along the wall, off the wall line, up) between two leaf centres, ft
    dx, dy, dz = (b['c'][i] - a['c'][i] for i in range(3))
    ux, uz = wall_dir; along = dx * ux + dz * uz; off = -dx * uz + dz * ux
    return round(along, 2), round(off, 2), round(dy, 2)
def wall_dir_of(rot):  # a door's wall runs along its local X: (cos, -sin) of its rot in the world XZ plane
    return (math.cos(rot), -math.sin(rot))

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url, w=1400, h=900):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
            await pg.goto(url, timeout=180000, wait_until='domcontentloaded'); return pg
        gm = await tab(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST sliding doors {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        pl = await tab(link); check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000), 'Mira joined')
        await gm.evaluate("tw.registry.run('area.fogOfWar.off')"); await idle(gm); await idle(pl)

        # ================= DATA =================
        print('DATA: which leaves slide')
        d = await gm.evaluate("""(() => { const L = tw.lib.objects, k = (c, s) => L[c]?.skus.find(x => x.sku === s) || null;
          return { kosh: k('door-plank', 'door-plank--jpn-koshido-leaf')?.slides || false, fus: k('door-panelled', 'door-panelled--jpn-fusuma-leaf')?.slides || false,
                   plank: k('door-plank', 'door-plank--leaf')?.slides || false,
                   sliding: Object.values(L).flatMap(o => o.skus.filter(x => x.slides).map(x => x.sku)) }; })()""")
        check(d['kosh'] and d['fus'] and not d['plank'], 'the koshido and fusuma leaves are marked `slides`; the plain plank leaf is not', d)

        # ================= ROOM =================
        print('ROOM: a Tatami room\'s door, opened by Mira')
        R = await gm.evaluate("tw.spawnRoom('jpn-house', 0, 0, 4, 4, 4411)"); await idle(gm); await settle(gm); await settle(pl)
        key = await pl.evaluate(f"[...tw.worldOf(tw.area()).edges.values()].find(e => e.kind === 'door' && !e.open && e.owner.room === '{R}')?.key || null")
        res = await pl.evaluate(f"(async (k) => {{ const it = tw.wallItem('wall:' + k); if (!tw.canOpen(it)) return 'not openable'; const m = await tw.await(tw.toggleOpen(it)); return !!m; }})('{key}')") if key else None
        await idle(pl); await idle(gm)
        oid = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'object' && e.fromEdge === '{key}')?.id || null")
        check(res is True and oid, 'Mira opens the door from the wall: it becomes a thing of its own', {'key': key, 'res': res, 'oid': oid})
        if oid:
            await wait(gm, f"(() => {{ const d = {POSE}('{oid}'); return d && d.open && d.rig === 1 && !d.moving; }})()", 8000)
            await wait(pl, f"(() => {{ const d = {POSE}('{oid}'); return d && d.open && d.rig === 1 && !d.moving; }})()", 8000)
            og, op = await gm.evaluate(POSE + f"('{oid}')"), await pl.evaluate(POSE + f"('{oid}')")
            check(og and og['sku'] == 'door-plank--jpn-koshido-leaf' and og['look'] == 'motion', 'it is the koshido leaf, rigged to move', og and {k: og[k] for k in ('cat', 'sku', 'look')})
            # the shut pose: the same leaf with its rig at 0, measured, then put back (the GM's own drawing only)
            shut = await gm.evaluate(f"((id) => {{ const R = tw.worldOf(tw.area()).recs.get(id).visual.userData.openRig; R.set(0); const s = {POSE}(id); R.set(1); return s; }})('{oid}')")
            wd = wall_dir_of(og['rot'])
            a, o, u = moved(shut, og, wd)
            turn = qangle(shut['q'], og['q'])
            check(abs(a) >= 3.0 and abs(o) <= 1.2 and abs(u) <= 0.1, 'open, the leaf moved ALONG the wall by most of its width, stayed by the wall line and on the floor', {'along': a, 'off': o, 'up': u, 'shut_c': shut['c'], 'open_c': og['c']})
            check(turn is not None and turn <= 1.0, 'and it did not turn (a slide, not a swing)', {'turn_deg': turn})
            check(op and op['c'] and max(abs(x - y) for x, y in zip(op['c'], og['c'])) < 0.05 and qangle(op['q'], og['q']) <= 1.0, 'both seats draw it at the same place', {'gm': og['c'], 'mira': op and op['c']})
            if A.shots:
                await gm.evaluate(f"(() => {{ const e = tw.entities()['{oid}']; const g = tw.main.grab; g.focus.set(e.x, 0, e.z); g.pitch = 40; g.yaw = 20; g.dist = 26; g.update(); tw.main.rule = 'free'; }})()"); await gm.wait_for_timeout(600)
                await gm.add_style_tag(content='* { visibility: hidden !important; } canvas, canvas * { visibility: visible !important; }')  # (a blind read: the 3D view only)
                await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(A.shots, 'koshido-open.png'))

            # ================= SHUT =================
            print('SHUT: Mira shuts it')
            await pl.evaluate(f"tw.dispatch('object.open', {{ id: '{oid}', open: false }})"); await idle(pl); await idle(gm)
            await wait(gm, f"(() => {{ const d = {POSE}('{oid}'); return d && !d.open && d.rig === 0 && !d.moving; }})()", 8000)
            await wait(pl, f"(() => {{ const d = {POSE}('{oid}'); return d && !d.open && d.rig === 0 && !d.moving; }})()", 8000)
            sg, sp = await gm.evaluate(POSE + f"('{oid}')"), await pl.evaluate(POSE + f"('{oid}')")
            check(all(s and s['c'] and max(abs(x - y) for x, y in zip(s['c'], shut['c'])) < 0.05 for s in (sg, sp)), 'shut, it is back where it was shut, on both seats', {'gm': sg and sg['c'], 'mira': sp and sp['c'], 'shut': shut['c']})
            if A.shots:
                await gm.screenshot(path=os.path.join(A.shots, 'koshido-shut.png'))

            # ================= MOTION =================
            print('MOTION: the GM opens it: it slides (partway along a moment, never turned)')
            await gm.evaluate(f"tw.dispatch('object.open', {{ id: '{oid}', open: true }})")
            sawMid = await wait(gm, f"(() => {{ const d = {POSE}('{oid}'); return d && d.open && d.moving && d.rig > 0.25 && d.rig < 0.95; }})()", 3000, 'mid-slide')
            mid = await gm.evaluate(POSE + f"('{oid}')") if sawMid else None
            await wait(gm, f"(() => {{ const d = {POSE}('{oid}'); return d && d.open && d.rig === 1 && !d.moving; }})()", 8000)
            check(mid is not None and qangle(shut['q'], mid['q']) <= 1.0 and 0 < abs(moved(shut, mid, wd)[0]) < abs(a) + 0.01, 'the GM sees it partway along (it slides), never turned', mid and {'rig': mid['rig'], 'along': moved(shut, mid, wd)[0], 'turn': qangle(shut['q'], mid['q'])})
            await gm.evaluate(f"tw.dispatch('object.open', {{ id: '{oid}', open: false }})"); await idle(gm)
            await wait(gm, f"(() => {{ const d = {POSE}('{oid}'); return d && !d.open && d.rig === 0 && !d.moving; }})()", 8000)

        # ================= FUSUMA =================
        print('FUSUMA: a fusuma leaf on the table')
        sz = await gm.evaluate("tw.roomgen.sizeOf('door-panelled', 'door-panelled--jpn-fusuma-leaf')")
        await gm.evaluate("(sz) => tw.batch([{ type: 'object.place', args: { id: 'obj_fus001', name: 'fusuma', cat: 'door-panelled', sku: sz.sku, url: sz.url, place: sz.place || 'kit', layer: 'openings', x: 40, z: 10, y: 0, rot: 0.6, yaw: sz.yaw, dims: sz.dims, ...(sz.s ? { s: sz.s } : {}) } }])", sz); await idle(gm); await settle(gm)
        f0 = await gm.evaluate(POSE + "('obj_fus001')")
        await gm.evaluate("tw.dispatch('object.open', { id: 'obj_fus001', open: true })"); await idle(gm)
        await wait(gm, f"(() => {{ const d = {POSE}('obj_fus001'); return d && d.open && d.rig === 1 && !d.moving; }})()", 8000)
        f1 = await gm.evaluate(POSE + "('obj_fus001')")
        await gm.evaluate("tw.dispatch('object.open', { id: 'obj_fus001', open: false })"); await idle(gm)
        await wait(gm, f"(() => {{ const d = {POSE}('obj_fus001'); return d && !d.open && d.rig === 0 && !d.moving; }})()", 8000)
        f2 = await gm.evaluate(POSE + "('obj_fus001')")
        ok = f0 and f1 and f2 and f0['c'] and f1['c']
        fa = moved(f0, f1, wall_dir_of(0.6)) if ok else None
        check(ok and abs(fa[0]) >= 3.0 and abs(fa[1]) <= 1.2 and qangle(f0['q'], f1['q']) <= 1.0 and max(abs(x - y) for x, y in zip(f2['c'], f0['c'])) < 0.05,
              'the fusuma slides along its wall (on a turned wall too), unturned, and back', {'moved': fa, 'turn': ok and qangle(f0['q'], f1['q'])})

        # ================= HINGE =================
        print('HINGE: a common room\'s plank door still swings')
        R2 = await gm.evaluate("tw.spawnRoom('common', 30, 0, 4, 4, 77)"); await idle(gm); await settle(gm)
        k2 = await gm.evaluate(f"[...tw.worldOf(tw.area()).edges.values()].find(e => e.kind === 'door' && !e.open && e.owner.room === '{R2}')?.key || null")
        await gm.evaluate(f"(async (k) => {{ const it = tw.wallItem('wall:' + k); await tw.await(tw.toggleOpen(it)); }})('{k2}')") if k2 else None
        await idle(gm)
        o2 = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'object' && e.fromEdge === '{k2}')?.id || null")
        h1 = o2 and await wait(gm, f"(() => {{ const d = {POSE}('{o2}'); return d && d.open && d.rig === 1 && !d.moving; }})()", 8000) and await gm.evaluate(POSE + f"('{o2}')")
        h0 = h1 and await gm.evaluate(f"((id) => {{ const R = tw.worldOf(tw.area()).recs.get(id).visual.userData.openRig; R.set(0); const s = {POSE}(id); R.set(1); return s; }})('{o2}')")
        check(h1 and h0 and h1['sku'] != 'door-plank--jpn-koshido-leaf' and qangle(h0['q'], h1['q']) >= 150, 'its leaf turns about 175 degrees (a swing)', h1 and {'sku': h1['sku'], 'turn': qangle(h0['q'], h1['q'])})

        # ================= REPLAY =================
        if oid:
            print('REPLAY: Mira reloads with the koshido open')
            await gm.evaluate(f"tw.dispatch('object.open', {{ id: '{oid}', open: true }})"); await idle(gm)
            await wait(gm, f"(() => {{ const d = {POSE}('{oid}'); return d && d.open && d.rig === 1 && !d.moving; }})()", 8000)
            await pl.reload(wait_until='domcontentloaded'); await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000); await settle(pl)
            await wait(pl, f"(() => {{ const d = {POSE}('{oid}'); return d && d.open && d.rig === 1 && !d.moving; }})()", 15000)
            rp = await pl.evaluate(POSE + f"('{oid}')")
            check(rp and rp['open'] and rp['rig'] == 1 and not rp['moving'] and qangle(rp['q'], shut['q']) <= 1.0 and abs(moved(shut, rp, wall_dir_of(rp['rot']))[0]) >= 3.0, 'drawn slid open at once after a reload', rp and {'rig': rp['rig'], 'moving': rp['moving']})

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        n = sum(1 for r in results if r[0])
        print(f'browser sliding doors: {n}/{len(results)} passed', flush=True)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
