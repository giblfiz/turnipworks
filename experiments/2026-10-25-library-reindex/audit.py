#!/usr/bin/env python3
"""The Build library (PiP) audit, 2026-10-25 (Harry: "can we try just making every object the same size? ... They also
might need to be re indexed, we have added some stuff.").

Against a running page (dev by default) in a throwaway campaign:
  1. every room node of the Build menu's taxonomy: its library opens; what it holds; the drawn size of each thing
     (the longer side of its footprint from above, from entity.dims x libK and the way it lies), same-size on and off
  2. coverage: every usable library category (a sku with bounds or a flat, rated in) that no library area shows, and why
  3. (--shots) stills of a few libraries, same size on and off, with their meshes in, for a vision read

  TW_GPU=1 python3 experiments/2026-10-25-library-reindex/audit.py [--page URL | --local] [--shots] [--out audit-dev.json]
  --local serves this checkout (relay + static site, as browser_smalls --local); stills go to shots-local/
"""
import argparse, asyncio, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--page', default='http://127.0.0.1:8180/'); ap.add_argument('--local', action='store_true'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--out', default='audit-dev.json')
ap.add_argument('--rooms', default='common,cave,temple-nave,cult-sanctum,mkt-square,min-tunnel,hill')
A = ap.parse_args()
SHOTDIR = 'shots-local' if A.local else 'shots'
procs, tmpdirs = [], []
def start_local(RP=18171, SP=18801):
    data = tempfile.mkdtemp(prefix='tw-la-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmpdirs.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api='

# every room node: open its library, read what it lays out (sizes analytic: dims x libK, the way it lies)
SWEEP = """async () => {
  const X = tw.taxonomy, rooms = [...X.nodes.values()].filter(n => n.level === 'room'), out = [];
  const lying = (e) => { const [w, h, d] = e.dims || [0, 0, 0], k = e.libK || 1; const f = e.tiltZ ? [h, d] : e.tiltX ? [w, h] : [w, d]; return +(Math.max(...f) * k).toFixed(2); };
  for (const n of rooms) {
    // (read at once: with the Build menu closed, the next frame puts the PiP back; the area stays built)
    tw.library.show(n); const info = tw.library.info(), w = tw.worlds.get(info.area);
    const es = w ? Object.values(w.libView.entities) : [];
    out.push({ id: n.id, roomKey: n.roomKey, label: n.label, type: n.parent, shown: info.shown, area: info.area, even: info.even,
      n: es.length, cats: [...new Set(es.map(e => e.cat))], items: es.map(e => ({ cat: e.cat, sku: e.sku, side: lying(e), k: e.libK || 1, flat: !!e.flat, place: e.place, true: Math.max(...(e.dims || [0])) })) });
    await new Promise(r => setTimeout(r, 0));
  }
  tw.library.hide(); return out; }"""
# the shots: the Build menu on that room, as a person finds it (browser_smalls open_lib), then the menu closed
OPEN = """(key) => { const X = tw.taxonomy; for (const n of X.nodes.values()) if (n.level === 'room' && n.roomKey === key) { tw.build.restore(X.pathOf(n.id)); return true; } return false; }"""
async def open_lib(pg, key):
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
    if not await pg.evaluate(OPEN, key): return False
    for _ in range(3):
        await pg.evaluate('tw.build.open()')
        try: await pg.wait_for_function(f"tw.library.shown() && tw.library.info().area === 'lib:{key}'", timeout=20000)
        except Exception: pass
        await pg.evaluate('tw.build.close()'); await pg.wait_for_timeout(600)
        if await pg.evaluate(f"tw.library.shown() && tw.library.info().area === 'lib:{key}'"): return True
    return False
# the universe: every category with a usable sku the library could draw (bounds or a flat)
UNIVERSE = """(async () => { const lib = tw.lib, use = (k) => (k.kind === 'flat' || k.bounds) && tw.roomgen.skuUsable(k), out = {};
  for (const [id, o] of Object.entries(lib.objects)) { const skus = o.skus.filter(use); if (!skus.length) continue;
    out[id] = { place: o.place, skus: skus.length, open: id.endsWith('-open'), faction: (lib.flavorSlots || []).includes(id) }; }
  const rooms = await fetch(new URL('data/rooms.json', tw.tunerBase)).then(r => r.json()).catch(() => null);
  return { cats: out, flavorSlots: lib.flavorSlots || [], rooms: rooms && rooms.map(r => ({ key: r.key, recipes: r.recipes, slots: r.slots, terrain: !!r.terrain, outdoor: !!r.outdoor })) }; })()"""

async def main():
    page = start_local() if A.local else A.page
    url = page + ('&' if '?' in page else '?') + 'nointro&atmos=morning-mist'
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def game():
            ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            # (2026-10-25: a first run built all 156 library worlds in one page, then took its stills: all but the first
            #  were blank, the GPU context gone. The stills now come first, from a fresh page; a lost context is recorded)
            await pg.add_init_script("addEventListener('webglcontextlost', () => { window.__lost = (window.__lost || 0) + 1; }, true)")
            await pg.goto(url)
            await pg.fill('#newCampaign input[name=gm]', 'Harry')
            nm = await pg.query_selector('#newCampaign input[name=name]')
            if nm: await nm.fill(f"TEST library audit {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
            await pg.click('#newCampaign button')
            await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
            await pg.wait_for_timeout(1500)
            return ctx, pg
        res = {'page': 'local (this checkout)' if A.local else A.page, 'at': time.strftime('%Y-%m-%d %H:%M:%S')}
        if A.shots:
            ctx, pg = await game(); await shots_phase(pg, res); res['lost_in_shots'] = await pg.evaluate('window.__lost || 0'); await ctx.close()
        ctx, pg = await game()
        res['pref0'] = await pg.evaluate("tw.settings.prefs().libEven")
        res['universe'] = await pg.evaluate(UNIVERSE)
        res['rooms_json'] = await pg.evaluate("tw.roomgen.typeList")
        res['types_json_rooms'] = await pg.evaluate("(() => { const T = {}; for (const n of tw.taxonomy.nodes.values()) if (n.level === 'type') T[n.id] = { label: n.label, rooms: n.children.length, disabled: !!n.disabled, have: n.have, roles: n.roles }; return T; })()")
        await pg.evaluate("tw.settings.setPref('libEven', true)")
        res['even'] = await pg.evaluate(SWEEP)
        await pg.evaluate("tw.settings.setPref('libEven', false)")
        res['true'] = await pg.evaluate(SWEEP)
        await pg.evaluate("tw.settings.setPref('libEven', true)")
        # every room key opened the way a person opens it: the Build menu on that room
        keys = sorted({r['roomKey'] for r in res['even']}); res['menu'] = {}
        for key in keys: res['menu'][key] = await open_lib(pg, key)
        json.dump(res, open(os.path.join(HERE, A.out), 'w'), indent=1)
        print('room nodes', len(res['even']), 'built', sum(r['shown'] for r in res['even']), '| room keys', len(keys), 'opened from the Build menu', sum(res['menu'].values()), [k for k, v in res['menu'].items() if not v][:8])
        if A.local: res['coverage'] = await pg.evaluate('tw.library.coverage()')
        res['errors'] = errors
        json.dump(res, open(os.path.join(HERE, A.out), 'w'), indent=1)
        print('rooms', len(res['even']), 'opened', sum(r['shown'] for r in res['even']), 'errors', errors[:3], 'lost contexts in the stills page', res.get('lost_in_shots'))
        await browser.close()

def blank(path):
    from PIL import Image, ImageStat
    s = ImageStat.Stat(Image.open(path).convert('L')); return s.stddev[0] < 3

async def shots_phase(pg, res):
    if True:
        if True:
            shots = os.path.join(HERE, SHOTDIR); os.makedirs(shots, exist_ok=True); res['shots'] = []
            for key in A.rooms.split(','):
                for ev in (True, False):
                    await pg.evaluate(f"tw.settings.setPref('libEven', {str(ev).lower()})")
                    if not await open_lib(pg, key): print('  did not open', key); break
                    try: await pg.wait_for_function('tw.library.info().flown', timeout=20000)
                    except Exception: pass
                    # load every mesh (the camera only loads what it is near): fly over the layout
                    sz = await pg.evaluate("tw.worlds.get(tw.library.info().area).lay.size")
                    await pg.evaluate("tw.library.touched()")
                    for fx in (0.2, 0.5, 0.8):
                        for fz in (0.2, 0.5, 0.8):
                            await pg.evaluate(f"(() => {{ const g = tw.pip.grab; g.focus.set({sz[0] * fx}, 0, {sz[1] * fz}); g.dist = 30; g.pitch = 88; g.yaw = 0; g.update(); }})()"); await pg.wait_for_timeout(700)
                    try: await pg.wait_for_function("(() => { const l = tw.library.loaded(); return l && l.withUrl >= l.total && l.drawn >= l.total * 0.97; })()", timeout=90000)
                    except Exception: print('  (meshes not all in)', key, ev, await pg.evaluate('tw.library.loaded()'))
                    await pg.evaluate(f"(() => {{ const w = tw.worlds.get(tw.library.info().area); tw.library.target = null; tw.library.show(w.roomNode); }})()")
                    try: await pg.wait_for_function('tw.library.info().flown', timeout=20000)
                    except Exception: pass
                    await pg.wait_for_timeout(2500)
                    # measured: each thing's drawn footprint from its meshes' world boxes
                    meas = await pg.evaluate("""(() => { const w = tw.worlds.get(tw.library.info().area), out = []; w.layers.things.updateMatrixWorld(true);
                      for (const r of w.recs.values()) { const e = r.entity; if (e.kind !== 'object') continue; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
                        r.group.traverse(o => { if (!o.isMesh || o.userData?.halo || !o.geometry) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; if (!b || !isFinite(b.min.x)) return;
                          for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const p = o.localToWorld(new o.position.constructor(x, y, z)); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); n++; } });
                        if (n) out.push({ cat: e.cat, sku: e.sku, k: +(e.libK || 1).toFixed(2), side: +Math.max(x1 - x0, z1 - z0).toFixed(2), placeholder: !!r.visual?.userData?.placeholder, flat: !!e.flat }); } return out; })()""")
                    r = await pg.evaluate("(() => { const f = document.getElementById('pipFrame').getBoundingClientRect(); return { x: f.left, y: f.top, width: f.width, height: f.height }; })()")
                    name = f"{key}-{'even' if ev else 'true'}"
                    await pg.screenshot(path=os.path.join(shots, f'{name}.png'), clip=r)
                    # a close-up of the first section too (labels readable)
                    await pg.evaluate("(() => { const w = tw.worlds.get(tw.library.info().area), g = tw.pip.grab; tw.library.touched(); g.focus.set(Math.min(14, w.lay.size[0] / 2), 0, Math.min(10, w.lay.size[1] / 2)); g.dist = 30; g.pitch = 88; g.yaw = 0; g.update(); })()"); await pg.wait_for_timeout(2000)
                    await pg.screenshot(path=os.path.join(shots, f'{name}-close.png'), clip=r)
                    bl = [f for f in (name, name + '-close') if blank(os.path.join(shots, f + '.png'))]
                    res['shots'].append({'room': key, 'even': ev, 'file': f'{SHOTDIR}/{name}.png', 'measured': meas, 'loaded': await pg.evaluate('tw.library.loaded()'), 'blank': bl})
                    print('  shot', name, len(meas), 'things measured', 'BLANK: ' + ','.join(bl) if bl else '')
            await pg.evaluate("tw.settings.setPref('libEven', true)")

if __name__ == '__main__':
    try: asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
        for d in tmpdirs: shutil.rmtree(d, ignore_errors=True)
