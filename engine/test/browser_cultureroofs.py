#!/usr/bin/env python3
"""Culture roofs (2026-11-07; docs/VERTICAL.md "Culture roofs"). GM tab, roofs on.

  local:  TW_GPU=1 TW_PORTS=18473,18974 python3 engine/test/browser_cultureroofs.py --local
  shots:  ... --local --shots DIR   (one outside view per culture at table distance, roofs on, for a blind Gemini read)
  dev:    ... --page https://dev.turnipworks.net/

Two buildings per culture, built by the room engine with their own types (so their wall families decide the roof):
  CHOICE    each culture's roof by default: Japan kawara (irimoya, bent eaves), China tongwa on the house and glazed on the
            temple (bent, upturned corners), Norse sod, Rus' plank (tes) with an onion cupola on the church, Mamluk flat
            with a dome on the hammam and a wind-catcher on the qa'a, India flat with chhatris and a shikhara; Mexica flat
  SHAPE     an irimoya roof has two small gables high up over hipped ends; its ridge ends carry their ornament
  BEND      a bent roof's sections carry the bend (per copy), and the far tier the same
  DRAWN     every ornament is drawn from the library (not a stand-in) once the meshes are in
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--only', help='comma list of culture codes to build (shots)')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18473,18974').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-croofs-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=120000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)

SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
REPORT = """(() => { const w = tw.worldOf(tw.area()), out = {};
  for (const rec of w.roofRecs.values()) { const r = rec.roof;
    out[r.room] = { style: r.style, family: r.family, kind: r.kind, form: r.form || null, bent: !!r.bent, ridgeY: r.ridgeY, top: r.top, gables: r.gableEnds.length,
      gableBases: r.gableEnds.map(G => +(G.base - r.top).toFixed(3)), ridges: r.ridges.length, hips: (r.hips || []).length,
      props: r.props.map(p => ({ role: p.role, cat: p.cat, key: p.key })), drawn: rec.props.map(p => ({ role: p.role, cat: p.cat, sku: p.sku, standIn: p.standIn })),
      tiers: rec.group.userData.roofTiers ? { count: rec.group.userData.roofTiers.count, bend: !!rec.group.userData.roofTiers.bend } : null, shown: rec.group.visible }; }
  return out; })()"""
# culture -> buildings (type, w, d); each building is one room of its own type, built by the room engine
CULTURES = {
    'jpn': [('jpn-house', 6, 4), ('jpn-shrine', 5, 4)],
    'chn': [('chn-hall', 6, 4), ('chn-temple', 6, 5)],
    'nrs': [('nrs-longhouse', 8, 4), ('nrs-meadhall', 7, 4)],
    'rus': [('rus-izba', 4, 4), ('rus-church', 5, 4)],
    'mde': [('mde-hammam', 4, 4), ('mde-audience', 6, 4)],
    'ind': [('ind-durbar', 6, 4), ('ind-mandapa', 5, 4)],
    'mes': [('mes-house', 4, 4), ('mes-shrine', 4, 4)],
}

async def build(gm, codes):
    B = {}
    for ci, code in enumerate(codes):
        x = 0
        for ti, (typ, w, d) in enumerate(CULTURES[code]):
            rid = f"room_cr{code}{ti}{random.randrange(10**6):06d}"[:24]
            a = dict(type=typ, x=x, z=ci * 40, w=w, d=d, seed=9100 + ci * 10 + ti) # (cultures 200 ft apart: one culture to a picture)
            await gm.evaluate(SPAWN, {'id': rid, **a})
            ok = await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, typ)
            check(ok, f'{code}: {typ} built')
            B[(code, typ)] = (rid, a); x += w + 4
        await settle(gm)
    return B

async def shots(gm, B, codes, out):
    os.makedirs(out, exist_ok=True)
    await gm.evaluate("document.body.classList.add('shot')")
    # blind reads: nothing but the 3D view (no menus, no 'Building N' pills: a label must not tell the judge anything)
    await gm.add_style_tag(content='* { visibility: hidden !important; } canvas, canvas * { visibility: visible !important; }')
    await gm.wait_for_timeout(4000)
    for code in codes:
        rooms = [B[(code, t)][1] for t, _, _ in CULTURES[code]]
        x0 = min(a['x'] for a in rooms) * 5; x1 = max((a['x'] + a['w']) for a in rooms) * 5; z0 = min(a['z'] for a in rooms) * 5; z1 = max((a['z'] + a['d']) for a in rooms) * 5
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        for tag, (dist, pitch, yaw) in {'34': (95, 38, 35), 'low': (80, 22, -30), 'near': (50, 26, 140)}.items():
            await view(gm, cx, cz, dist, pitch, yaw, 8)
            await gm.wait_for_timeout(3500)
            await gm.screenshot(path=os.path.join(out, f'{code}-{tag}.png'))
        print('  shot', code, flush=True)
    # close looks at the buildings whose roofs carry the most new geometry (an irimoya's corners and hips, a tower on a deck)
    for code, typ in [('chn', 'chn-temple'), ('jpn', 'jpn-shrine'), ('ind', 'ind-mandapa'), ('jpn', 'jpn-house')]:
        if (code, typ) not in B: continue
        a = B[(code, typ)][1]; cx, cz = (a['x'] + a['w'] / 2) * 5, (a['z'] + a['d'] / 2) * 5
        for k, yaw in enumerate((40, 220)):
            await view(gm, cx, cz, 38, 24, yaw, 10); await gm.wait_for_timeout(3000)
            await gm.screenshot(path=os.path.join(out, f'close-{typ}-{k}.png'))

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    codes = A.only.split(',') if A.only else list(CULTURES)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 1000}, reduced_motion='reduce')
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST culture roofs {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        B = await build(gm, codes)
        await gm.evaluate("tw.setRoofs(true, 'test'); tw.cutOff('test')")
        await wait(gm, f"tw.worldOf(tw.area()).roofRecs?.size >= {sum(1 for c in codes for _ in CULTURES[c]) - 1}", 30000, 'roofs drawn')
        await gm.wait_for_timeout(1500)
        rep = await gm.evaluate(REPORT)
        if A.shots:
            json.dump({f'{c}/{t}': rep.get(B[(c, t)][0]) for (c, t) in B}, open(os.path.join(A.shots, 'report.json') if os.path.isdir(A.shots) else '/dev/null', 'w'), indent=1) if os.path.isdir(A.shots) else None
            await shots(gm, B, codes, A.shots)
            os.makedirs(A.shots, exist_ok=True); json.dump({f'{c}/{t}': rep.get(B[(c, t)][0]) for (c, t) in B}, open(os.path.join(A.shots, 'report.json'), 'w'), indent=1)
            await browser.close(); return True
        await checks(gm, B, rep, codes)
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()
    passed = sum(1 for r in results if r[0])
    print(f'cultureroofs: {passed}/{len(results)} passed')
    return passed == len(results)

WANT = { # (culture, type) -> style, form, kind, ornament roles the roof carries
    ('jpn', 'jpn-house'): ('kawara', 'jpn-house', 'gable', ['onigawara']), ('jpn', 'jpn-shrine'): ('shingle', 'jpn-hall', 'irimoya', []),
    ('chn', 'chn-hall'): ('tongwa', 'chn-house', 'gable', []), ('chn', 'chn-temple'): ('glazed', 'chn-temple', 'irimoya', ['chiwen']),
    ('nrs', 'nrs-longhouse'): ('sod', 'nrs', 'gable', []), ('nrs', 'nrs-meadhall'): ('sod', 'nrs', 'gable', []),
    ('rus', 'rus-izba'): ('tes', 'rus', 'gable', []), ('rus', 'rus-church'): ('shingle', 'rus', 'gable', ['cupola']),
    ('mde', 'mde-hammam'): ('plaster', None, 'flat', ['dome']), ('mde', 'mde-audience'): ('plaster', None, 'flat', ['malqaf']),
    ('ind', 'ind-durbar'): ('flagstone', None, 'flat', ['chhatri']), ('ind', 'ind-mandapa'): ('flagstone', None, 'flat', ['shikhara']),
    ('mes', 'mes-house'): ('plaster', None, 'flat', []), ('mes', 'mes-shrine'): ('plaster', None, 'flat', []),
}
ORN = ['onigawara', 'chiwen', 'cupola', 'dome', 'malqaf', 'shikhara', 'chhatri']

async def checks(gm, B, rep, codes):
    print('CHOICE: each culture\'s roof by default')
    for (code, typ), (rid, a) in B.items():
        r = rep.get(rid); w = WANT[(code, typ)]
        if not r: check(False, f'{typ}: has a roof', None); continue
        roles = sorted({p['role'] for p in r['props'] if p['role'] in ORN})
        check(r['style'] == w[0] and r['form'] == w[1] and r['kind'] == w[2] and roles == sorted(w[3]), f'{typ}: {w[0]} roof, form {w[1]}, {w[2]}, ornaments {w[3]}', (r['style'], r['form'], r['kind'], roles))
    print('SECTIONS and BEND')
    for (code, typ) in B:
        r = rep[B[(code, typ)][0]]; w = WANT[(code, typ)]
        if w[2] == 'flat': continue
        check(r['tiers'] and r['tiers']['count'] > 0, f'{typ}: laid in its modelled {r["style"]} sections', r['tiers'])
    kits = await gm.evaluate("tw.worldOf(tw.area()).roofSectionReport().kits")
    check(all(k in kits for k in ('kawara', 'tongwa', 'glazed', 'sod', 'tes')), 'the five culture sections are loaded', kits)
    for key in [('chn', 'chn-temple'), ('jpn', 'jpn-shrine'), ('jpn', 'jpn-house')]:
        r = rep[B[key][0]]; check(r['bent'] and r['tiers']['bend'], f'{key[1]}: its sections carry the bend', (r['bent'], r['tiers']))
    r = rep[B[('chn', 'chn-hall')][0]]; check(not r['bent'], 'an ordinary Beijing house is not bent (the sensitivity read)', r['bent'])
    # the bent copies' bend numbers reach the GPU: the instanced attribute is on both tiers' geometry
    att = await gm.evaluate(f"""(() => {{ const T = tw.worldOf(tw.area()).roofRecs.get('{B[('chn', 'chn-temple')][0]}').group.userData.roofTiers; const a = T.near.geometry.getAttribute('aRoofBend'), b = T.far.geometry.getAttribute('aRoofBend'); return a && b ? [a.itemSize, a.count, a.array[4], a.array[5]] : null; }})()""")
    check(att and att[0] == 16 and att[1] > 0 and att[2] > 0 and att[3] > 1, "the temple's copies carry aRoofBend (eave lift, corner lift) on both tiers", att)
    print('SHAPE: irimoya')
    t = rep[B[('chn', 'chn-temple')][0]]
    check(t['gables'] == 2 and all(b > 2 for b in t['gableBases']) and t['hips'] == 4, 'the temple: two small gables high up over hipped ends, four hip ridges', (t['gableBases'], t['hips']))
    print('DRAWN: ornaments and caps from the library')
    lib = await gm.evaluate("Object.keys(tw.worldOf(tw.area()).assets.lib.objects).filter(k => /^(roof-onigawara|roof-chiwen|roof-cupola-onion|roof-dome|roof-malqaf|roof-shikhara|ind-chhatri)$/.test(k))")
    for (code, typ), (rid, a) in B.items():
        for d in rep[rid]['drawn']:
            if d['role'] not in ORN: continue
            want = {'onigawara': 'roof-onigawara', 'chiwen': 'roof-chiwen', 'cupola': 'roof-cupola-onion', 'dome': 'roof-dome', 'malqaf': 'roof-malqaf', 'shikhara': 'roof-shikhara', 'chhatri': 'ind-chhatri'}[d['role']]
            if want in lib: check(not d['standIn'] and d['sku'], f'{typ}: its {d["role"]} is the library\'s {want}', d)
            else: print(f'    ({want} is not in the library yet: {typ} draws a stand-in box)')
    caps = await gm.evaluate(f"""(() => {{ const rec = tw.worldOf(tw.area()).roofRecs.get('{B[('chn', 'chn-temple')][0]}'); return {{ ridge: rec.ridge, hips: rec.group.children.filter(h => h.userData.roofProp === 'hip').length }}; }})()""")
    check(caps['hips'] >= 8, 'the temple: its hips are capped in short pieces up each hip line', caps)
    await gm.wait_for_timeout(2500)
    hp = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), rec = w.roofRecs.get('{B[('chn', 'chn-temple')][0]}'), T = window.THREE || null; const out = [];
      rec.group.updateMatrixWorld(true);
      for (const h of rec.group.children.filter(h => h.userData.roofProp === 'hip')) {{
        const p = h.position, kids = h.children.length; let best = Infinity, which = -1;
        rec.roof.hips.forEach((L, i) => {{ const ax = L.b[0] - L.a[0], az = L.b[2] - L.a[2], t = Math.max(0, Math.min(1, ((p.x - L.a[0]) * ax + (p.z - L.a[2]) * az) / (ax * ax + az * az))); const d = Math.hypot(p.x - L.a[0] - ax * t, p.z - L.a[2] - az * t); if (d < best) {{ best = d; which = i; }} }});
        out.push({{ hip: which, off: +best.toFixed(3), y: +p.y.toFixed(2), kids, rot: [h.rotation.y, h.rotation.z].map(v => +v.toFixed(2)), scale: h.children[0]?.scale?.toArray().map(v => +v.toFixed(2)) }}); }}
      return out; }})()""")
    per = {}
    for h in hp: per.setdefault(h['hip'], []).append(h)
    check(len(per) == 4 and all(len(v) >= 2 and all(x['kids'] > 0 and x['off'] < 0.05 for x in v) for v in per.values()), 'every hip line of the temple has its own loaded cap pieces standing on it', {k: [(x['off'], x['kids'], x['rot']) for x in v] for k, v in per.items()})
    print('CONTROLS: the styles and the shape are offered')
    rid = B[('jpn', 'jpn-house')][0]
    await gm.evaluate(f"tw.select('roof:{rid}')"); await gm.wait_for_timeout(300)
    ids = await gm.evaluate("tw.registry.available().map(c => c.id).filter(x => x.startsWith('roof.style.') || x.startsWith('roof.shape.'))")
    check(all(f'roof.style.{k}' in ids for k in ('tongwa', 'glazed', 'sod', 'tes')) and 'roof.style.kawara' not in ids and 'roof.shape.irimoya' in ids, "a kawara roof's Style list offers the other culture styles, its Shape list Hip-and-gable", ids)
    pic = await gm.evaluate("(() => { const c = tw.registry.available().find(c => c.id === 'roof.style.glazed'); return c && c.pic ? c.pic() : null; })()")
    check(pic and 'roof/roofing-glazed.webp' in pic, 'the glazed style has its swatch', pic)
    st = await gm.evaluate(f"fetch(new URL('data/roof/roofing-kawara.webp', document.baseURI)).then(r => r.status)")
    check(st == 200, 'the painted kawara picture is served', st)
    await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{rid}', roof: {{ shape: 'irimoya' }} }})"); await gm.wait_for_timeout(1500)
    r2 = (await gm.evaluate(REPORT))[rid]
    check(r2['kind'] == 'irimoya' and r2['gables'] == 2 and r2['hips'] == 4, 'Shape: Hip-and-gable turns the townhouse into an irimoya', (r2['kind'], r2['gables'], r2['hips']))
    await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(1500)
    check((await gm.evaluate(REPORT))[rid]['kind'] == 'gable', 'one undo puts the gable back')
    rid2 = B[('rus', 'rus-church')][0]; cu = next(p for p in rep[rid2]['props'] if p['role'] == 'cupola')
    await gm.evaluate(f"tw.dispatch('room.set', {{ id: '{rid2}', roof: {{ trim: {{ '{cu['key']}': {{ gone: true }} }} }} }})"); await gm.wait_for_timeout(1500)
    check(not any(p['role'] == 'cupola' for p in (await gm.evaluate(REPORT))[rid2]['props']), "the church's cupola is trim: removed by its key")
    await gm.keyboard.press('Control+z'); await gm.wait_for_timeout(1500)
    check(any(p['role'] == 'cupola' for p in (await gm.evaluate(REPORT))[rid2]['props']), 'and undo brings it back')

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)
