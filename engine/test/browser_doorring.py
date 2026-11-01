#!/usr/bin/env python3
"""A DOOR'S RING SITS AT THE DOOR (2026-10-29): a selected door's ring (a player's: a lone Open/Close) sat ~350 px over
it, under the command bar, because the ring was world-sized from the door's WIDTH (an 8.7-ft double door: ×1.73, the
largest button) as if that were its footprint. A piece set in a wall line is now sized as one 5-ft edge (client/surfaces/
ring.js measure; library-index.js isEdgePiece). Two seats: the GM and a player (Mira). Both ring shapes: the built-in
"Ellipse · one curve" (what a page with no house ring draws) and Harry's house ring (tests/data/...: "rev 5").

  TW_PORTS=a,b python3 engine/test/browser_doorring.py --local [--stills DIR]

  CENTRE  for a generated double door, a generated door, a window, the thing a door became, a fence gate, a portcullis
          and a cage door: the ring opens round the piece (its centre within 40 px of the piece's middle on screen)
  SIZE    each is ringed as a 5-ft edge: its ring's scale is a 5-ft wall section's at the same place (±12 %), and its
          nearest button no further from it than the wall section's (+12 %); a 10-ft-wide table still grows its ring
  NEAR    in the house ring, the nearest button is within 150 px of the piece's middle (the bug: 345 px)
  PLAYER  Mira's ring on the double door is the lone Open, and it sits as near
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--stills'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18591,18592').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-doorring-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(300)
async def settle(pg, ms=120000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(400)
async def view(pg, x, z, dist=70, pitch=60, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(500)
async def still(pg, name):
    if not A.stills: return
    os.makedirs(A.stills, exist_ok=True); await pg.wait_for_timeout(700); await pg.screenshot(path=os.path.join(A.stills, f'{name}.png'))

# the selection's ring, measured against the piece: its middle on screen (the middle of its drawn box), the ring's centre,
# its scale, and every button's distance from that middle
RING = """((id) => {
  const w = tw.worldOf(tw.area()), sh = id.startsWith('wall:') ? (w.shell.get(id.slice(5)) || w.shell.get(id.slice(5) + ':door')) : null, rec = w.recs.get(id);
  const b = sh ? new tw.THREE.Box3().setFromObject(sh.group) : rec ? w.boundsOf(rec, 'figure') : null; if (!b) return { err: 'no box' };
  const m = tw.screenOf((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, tw.main, (b.min.y + b.max.y) / 2);
  const c = tw.ringCenter(), wd = tw.ringWorld(), nodes = tw.ringNodes();
  const d = nodes.map(n => Math.hypot(n.x - m.x, n.y - m.y));
  return { mid: [Math.round(m.x), Math.round(m.y)], centre: c && [Math.round(c[0]), Math.round(c[1])], off: c ? Math.round(Math.hypot(c[0] - m.x, c[1] - m.y)) : null,
    scale: wd ? +wd.scale.toFixed(3) : null, baseFt: wd ? +wd.baseFt.toFixed(2) : null, near: d.length ? Math.round(Math.min(...d)) : null,
    buttons: nodes.map(n => n.id), top: nodes.length ? Math.round(Math.min(...nodes.map(n => n.y - n.size / 2))) : null };
})"""
POS = """((id) => { if (id.startsWith('wall:')) { const it = tw.wallItem(id); return [it.x, it.z]; } const e = tw.entities()[id]; return [e.x, e.z]; })"""

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    house = json.load(open(os.path.join(REPO, 'tests', 'data', 'ring-house-rings-2026-10-21.json')))['rev 5']
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
        if nm: await nm.fill(f"TEST doorring {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        await gm.keyboard.press('/'); await gm.keyboard.type('invite Mira', delay=8); await gm.wait_for_timeout(300); await gm.keyboard.press('Enter')
        await wait(gm, "!document.querySelector('#output').hidden", 10000, 'invite link')
        link = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(200)
        pl = await tab(link); check(await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000), 'Mira joined')
        PL = await pl.evaluate('tw.me()')

        # THE TABLE (browser_pdoors' rooms): a common room (x 0..30, z 0..20) with a double door south (h:2:4) and a
        # kitchen east through a door (v:6:0); south of them, in the open, a fence gate, a portcullis, a cage door and a
        # long table; Mira's pawn in the common room
        G = await gm.evaluate("tw.spawnRoom('common', 0, 0, 6, 4, 6)"); await idle(gm)
        await gm.evaluate("tw.spawnRoom('kitchen', 6, 0, 4, 4, 5102)"); await idle(gm)
        await gm.evaluate("tw.condButtons?.hide?.('stair-offer')")
        E = await gm.evaluate("[...tw.worldOf(tw.area()).edges.values()].map(e => ({ kind: e.kind, key: e.key, span: e.span || 1 }))")
        keys = {e['key']: e['kind'] for e in E}
        DD = 'h:2:4'; DV = 'v:6:0'; WIN = next((k for k, v in keys.items() if v == 'window'), None); WALL = 'h:1:4'
        check(keys.get(DD) == 'door' and keys.get('h:3:4') == 'door-span' and keys.get(DV) == 'door' and WIN and keys.get(WALL) == 'wall',
              'the rooms imply a double door (h:2:4 over two edges), a single door (v:6:0), a window and the wall beside the double door', {DD: keys.get(DD), DV: keys.get(DV), 'window': WIN, WALL: keys.get(WALL)})
        placed = await gm.evaluate("""(() => { const out = {};
          const put = (id, cat, x, z) => { if (!tw.assets.catalog.find(c => c.id === cat)) { out[id] = 'no ' + cat; return; } const sz = tw.roomgen.sizeOf(cat); tw.dispatch('object.place', { id, name: cat.replace(/-/g, ' '), cat, sku: sz.sku, url: sz.url, place: tw.assets.catalog.find(c => c.id === cat)?.place || 'floor', x, z, dims: sz.dims, s: sz.s || undefined, yaw: sz.yaw }); out[id] = sz.dims; };
          put('obj_drgate001', 'gate-fence', 7.5, 45); put('obj_drportc01', 'portcullis', 22.5, 45); put('obj_drcage001', 'door-cell-bars', 37.5, 45);
          const big = ['table-long', 'table-banquet', 'table-large', 'bed-double', 'table'].find(c => tw.assets.catalog.find(k => k.id === c)); if (big) put('obj_drtable01', big, 22.5, 60); out.big = big; return out; })()""")
        await idle(gm)
        print('    placed', placed)
        MI = 'tok_doorringmi'
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{MI}', name: 'Mira', x: 12.5, z: 10, owner: '{PL}', fig: 'hero-fighter-elf-f' }})"); await idle(gm)
        await view(gm, 25, 25, 110, 58); await settle(gm)
        await wait(pl, f"!!tw.worldOf(tw.area())?.recs.get('{MI}')", 30000, 'Mira sees her pawn'); await settle(pl)

        async def shape(pg, h):
            await pg.evaluate("(async (h) => { const m = await import(new URL('ringlab/presets.js', document.baseURI).href); const S = h ? m.normalize(h) : null; tw.ringSettingsOverride = S ? () => S : undefined; tw.ringRelayout(); })", h)
        async def ring(pg, sel, dist=70, pitch=60):
            x, z = await pg.evaluate(POS + f"('{sel}')")
            await view(pg, x, z, dist, pitch, 0)
            await pg.evaluate(f"tw.select('{sel}')"); await pg.wait_for_timeout(700)
            return await pg.evaluate(RING + f"('{sel}')")

        for shape_name, h in (('built-in', None), ('house rev 5', house)):
            await shape(gm, h)
            print(f'SHAPE: {shape_name}')
            for dist in (70, 40):
                ref = await ring(gm, f'wall:{WALL}', dist)
                print(f'    d{dist} reference (the 5-ft wall beside the double door) {json.dumps(ref)}')
                for label, sel in (('the generated double door', f'wall:{DD}'), ('a generated door', f'wall:{DV}'), ('a generated window', f'wall:{WIN}'),
                                   ('a fence gate', 'obj_drgate001'), ('a portcullis', 'obj_drportc01'), ('a cage door', 'obj_drcage001')):
                    if sel.startswith('obj_') and not isinstance(placed.get(sel), list): check(False, f'{label} placed', placed.get(sel)); continue
                    r = await ring(gm, sel, dist)
                    check(r.get('off') is not None and r['off'] <= 40, f'{shape_name} d{dist}: {label}: the ring opens round it (centre {r.get("off")} px from its middle)', r)
                    check(r.get('baseFt') is not None and r['baseFt'] <= 5.01, f'{shape_name} d{dist}: {label}: ringed as a 5-ft edge', r.get('baseFt'))
                    if sel == f'wall:{DD}':
                        check(r['scale'] <= ref['scale'] * 1.12, f'{shape_name} d{dist}: the double door\'s ring is the wall section\'s size (scale {r["scale"]} vs {ref["scale"]})', r)
                        check(r['near'] <= ref['near'] * 1.12 + 6, f'{shape_name} d{dist}: its nearest button is as near as the wall section\'s ({r["near"]} px vs {ref["near"]})', r)
                        if h: check(r['near'] <= 150, f'house d{dist}: the double door\'s nearest button is within 150 px of it ({r["near"]})', r)
                        if dist == 70: await still(gm, f'gm-doubledoor-{shape_name.split()[0]}')
                if placed.get('big'):
                    t = await ring(gm, 'obj_drtable01', dist)
                    check(t.get('baseFt', 0) > 5.5 or t.get('scale') is None, f'{shape_name} d{dist}: a long table ({placed["big"]}) still sizes its ring by its footprint ({t.get("baseFt")} ft)', t)

        # THE THING A DOOR BECAME: the GM opens the double door (a thing of its own, fromEdge), selects it
        await shape(gm, house)
        await gm.evaluate(f"(async () => {{ await tw.await(tw.toggleOpen(tw.wallItem('wall:{DD}'))); }})()"); await idle(gm); await gm.wait_for_timeout(600)
        oid = await gm.evaluate(f"(Object.values(tw.entities()).find(e => e.kind === 'object' && e.fromEdge === '{DD}') || {{}}).id")
        check(bool(oid), 'Open: the double door is a thing of its own', oid)
        if oid:
            for dist in (70, 40):
                r = await ring(gm, oid, dist)
                check(r.get('off') is not None and r['off'] <= 40 and r.get('baseFt', 99) <= 5.01 and r.get('near', 999) <= 150, f'house d{dist}: the opened door (a thing): ring round it, a 5-ft edge, nearest button {r.get("near")} px', r)
            await gm.evaluate(f"(async () => {{ await tw.await(tw.toggleOpen(tw.entities()['{oid}'])); }})()"); await idle(gm); await gm.wait_for_timeout(400)

        # THE PLAYER: her ring on the generated single door is the lone Open (the double door is a thing now: its too)
        print('PLAYER: Mira selects the doors')
        await idle(pl); await pl.wait_for_timeout(800)
        for shape_name, h in (('built-in', None), ('house rev 5', house)):
            await shape(pl, h)
            ref = await ring(pl, f'wall:{WALL}', 70)
            for label, sel in (('the generated door', f'wall:{DV}'), ('the door that is a thing', oid)):
                if not sel: continue
                r = await ring(pl, sel, 70)
                lone = r.get('buttons') in (['thing.open'], ['thing.close'])
                check(lone, f'{shape_name}: Mira\'s ring on {label} is the lone Open/Close', r.get('buttons'))
                check(r.get('off') is not None and r['off'] <= 40 and r.get('baseFt', 99) <= 5.01, f'{shape_name}: it opens round the door ({r.get("off")} px), sized as a 5-ft edge', r)
                if h: check(r.get('near', 999) <= 150, f'house: the lone button is within 150 px of the door ({r.get("near")})', r)
                await still(pl, f'pl-{sel.replace(":", "_")}-{shape_name.split()[0]}')
            await pl.evaluate('tw.clearSelection()')

        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        n = sum(1 for r in results if r[0])
        print(f'browser doorring: {n}/{len(results)} passed', flush=True)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
