#!/usr/bin/env python3
"""Stills of the Build library PiP, per room type, for the vision reads (experiments/2026-10-29-piplib).

  TW_PORTS=18631,18632 TW_GPU=1 python3 experiments/2026-10-29-piplib/lib_stills.py TAG room1 room2 ...

For each room: the library opened as a person opens it (the default PiP window, its opening view), then the PiP made
big and walked in tiles at a close distance, each tile a still; plus a JSON of what lies where (cat, how it lies, its
screen box in each tile) so a vision read can be matched back to catalog ids. Also the frame time with the library open.
"""
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401
tw_sandbox.remove_campaigns()
TAG, ROOMS = sys.argv[1], sys.argv[2:]
OUT = os.path.join(HERE, 'stills', TAG); os.makedirs(OUT, exist_ok=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18631,18632').split(','))
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
procs = []

def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-pl-'); site = tempfile.mkdtemp(prefix='tw-plsite-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500&atmos=morning-mist'

async def wait(pg, js, timeout=20000):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print('    (timed out)', js[:80]); return False

FRAME = "(() => { const f = document.getElementById('pipFrame').getBoundingClientRect(); return { x: f.left, y: f.top + 24, width: f.width, height: f.height - 24 }; })()"
SHOW = """(key) => { const X = tw.taxonomy; for (const gid of X.genres) for (const tid of X.get(gid).children) for (const rid of X.get(tid).children) if (X.get(rid).roomKey === key && !X.get(tid).disabled) { tw.build.restore([gid, tid, rid]); return true; } return false; }"""
# every thing on the open library's plane: where it is on screen (inside the PiP), how it lies, its label
WHERE = """(() => { const w = tw.worlds.get(tw.library.info().area), f = document.getElementById('pipFrame').getBoundingClientRect(), out = [];
  for (const e of Object.values(w.libView.entities)) { const p = tw.screenOf(e.x, e.z, tw.pip, 0.5); if (!p || p.x < f.left || p.x > f.right || p.y < f.top + 24 || p.y > f.bottom) continue;
    out.push({ cat: e.cat, sku: e.sku, name: e.name, place: e.place, how: e.tiltZ ? 'side' : e.tiltX ? 'back' : 'up', x: Math.round(p.x - f.left), y: Math.round(p.y - f.top - 24) }); } return out; })()"""

async def main():
    url = start_local()
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        ctx = await br.new_context(viewport={'width': 1400, 'height': 900})
        if os.environ.get('LIBPOSE'): await ctx.add_init_script(f"window.TW_LIBPOSE = {os.environ['LIBPOSE']};")
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: print('pageerror', e))
        await pg.goto(url)
        await pg.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await pg.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST piplib stills {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await pg.click('#newCampaign button')
        await wait(pg, 'window.tw && tw.ready && tw.ready()', 45000)
        await pg.mouse.move(300, 500)
        report = {}
        for key in ROOMS:
            print('ROOM', key)
            await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
            if not await pg.evaluate(SHOW, key): print('  no such room'); continue
            await pg.evaluate('tw.build.open()'); await wait(pg, 'tw.library.shown()', 20000); await pg.evaluate('tw.build.close()'); await pg.wait_for_timeout(600)
            await wait(pg, 'tw.library.shown() && tw.library.info().flown', 30000)
            await wait(pg, "(() => { const l = tw.library.loaded(); return l && l.drawn >= l.withUrl * 0.97 && l.withUrl > 0; })()", 60000); await pg.wait_for_timeout(2500)
            r = await pg.evaluate(FRAME)
            if r['width'] < 10: print('  frame?', r, await pg.evaluate("JSON.stringify({ rect: tw.pip && tw.pip.rect, hidden: document.getElementById('pipFrame').hidden, info: tw.library.info() })")); await pg.screenshot(path=os.path.join(OUT, f'{key}-dbg.png')); continue
            await pg.screenshot(path=os.path.join(OUT, f'{key}-open.png'), clip=r)
            info = await pg.evaluate("(() => { const w = tw.worlds.get(tw.library.info().area); return { size: w.lay.size.map(v => +v.toFixed(1)), total: Object.keys(w.libView.entities).length, dist: +tw.pip.grab.dist.toFixed(1), heads: w.layers.deco.children.filter(m => m.userData.label?.h >= 0.8).map(m => m.userData.label.text), loaded: tw.library.loaded() }; })()")
            # frame time with this library open (the main view and the PiP drawing), 120 frames
            ft = await pg.evaluate("new Promise(res => { const t = []; let last = performance.now(), n = 0; const step = (now) => { t.push(now - last); last = now; if (++n < 120) requestAnimationFrame(step); else { t.sort((a, b) => a - b); res({ median: +t[60].toFixed(1), p95: +t[114].toFixed(1) }); } }; requestAnimationFrame(step); })")
            info['frame'] = ft
            if os.environ.get('PROBE_CATS'):
                out = []
                for cat in os.environ['PROBE_CATS'].split(','):
                    if not await pg.evaluate(f"tw.library.focus('{cat}')"): continue
                    await wait(pg, 'tw.library.info().flown', 20000); await wait(pg, "(() => { const l = tw.library.loaded(); return l && l.drawn >= l.withUrl * 0.97; })()", 30000); await pg.wait_for_timeout(1500)
                    out.append(await pg.evaluate(f"""(() => {{ const w = tw.worlds.get(tw.library.info().area), s = w.lay.slots.get('{cat}'), e = w.libView.entities[s.id], b = w.drawnBox(s.id), k = e.libK || 1;
                      return {{ cat: e.cat, sku: e.sku, how: e.tiltX ? 'back' : e.tiltZ ? 'side' : 'up', dimsK: e.dims.map(v => +(v * k).toFixed(2)), drawn: b && [0, 1, 2].map(i => +(b.max[i] - b.min[i]).toFixed(2)), standIn: b && b.standIn }}; }})()"""))
                for o in out: print('  BOX', json.dumps(o))
                continue
            if os.environ.get('PERF'):
                FTJS = "new Promise(res => { const t = []; let last = performance.now(), n = 0; const step = (now) => { t.push(now - last); last = now; if (++n < 240) requestAnimationFrame(step); else { t.sort((a, b) => a - b); res({ median: +t[120].toFixed(1), p95: +t[228].toFixed(1) }); } }; requestAnimationFrame(step); })"
                info['open'] = await pg.evaluate(FTJS)
                await pg.evaluate("tw.library.frameAll ? tw.library.frameAll() : null"); await wait(pg, 'tw.library.info().flown', 30000)
                info['flyLoad'] = await pg.evaluate(FTJS)
                await wait(pg, "(() => { const l = tw.library.loaded(); return l && l.drawn >= l.total * 0.97; })()", 120000); await pg.wait_for_timeout(1500)
                info['whole'] = await pg.evaluate(FTJS)
                await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.evaluate('tw.library.hide()'); await pg.wait_for_timeout(800)
                info['none'] = await pg.evaluate(FTJS)
                print('  PERF', key, json.dumps({k: info[k] for k in ('total', 'open', 'flyLoad', 'whole', 'none')})); report[key] = info; continue
            print('  ', json.dumps(info)[:400])
            # the big window, walked in tiles
            await pg.evaluate("(() => { const f = document.querySelector('#pipFrame .pipTitle, #pipFrame header, #pipTitle'); })()")
            await pg.evaluate("tw.pip.rect = [0.02, 0.06, 0.96, 0.9]; tw.refresh && tw.refresh()"); await pg.wait_for_timeout(600)
            sx, sz = info['size']; tiles = []
            step_x, step_z, dist = 26, 16, 26
            nx, nz = max(1, int(sx // step_x) + 1), max(1, int(sz // step_z) + 1)
            nz = min(nz, int(os.environ.get('MAXROWS', '99')))
            k = 0
            for iz in range(nz):
                for ix in range(nx):
                    fx, fz = min(sx, 13 + ix * step_x), min(sz, 8 + iz * step_z)
                    await pg.evaluate(f"(() => {{ tw.library.touched(); const g = tw.pip.grab; g.focus.set({fx}, 0, {fz}); g.dist = {dist} * Math.tan(Math.PI / 8) / Math.tan(tw.pip.camera.fov * Math.PI / 360); g.pitch = 88; g.yaw = 0; g.update(); }})()")
                    await pg.wait_for_timeout(700)
                    await wait(pg, "(() => { const l = tw.library.loaded(); return l && l.drawn >= l.withUrl * 0.97; })()", 30000); await pg.wait_for_timeout(1200)
                    r = await pg.evaluate(FRAME)
                    fn = f'{key}-t{k:02d}.png'; await pg.screenshot(path=os.path.join(OUT, fn), clip=r)
                    tiles.append({ 'file': fn, 'focus': [fx, fz], 'things': await pg.evaluate(WHERE) }); k += 1
            info['tiles'] = tiles; report[key] = info
            await pg.evaluate("tw.pip.rect = [0.64, 0.5, 0.34, 0.42]; tw.refresh && tw.refresh()"); await pg.wait_for_timeout(300)
        json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
        await br.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
