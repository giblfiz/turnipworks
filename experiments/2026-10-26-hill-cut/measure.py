#!/usr/bin/env python3
"""The hill and the cut, MEASURED (2026-10-26; experiments/2026-10-26-hill-cut/PLAN.md). One scene, every case the plan
names, read back from the running game at the four views (all levels, lv 1, lv 2, lv -1): which rooms, pawns and hill
tiles are drawn, how high the bank stands over a room below it, what the meter says. Run it on main (today) and on the
branch (after) and diff the two JSON files.

  python3 experiments/2026-10-26-hill-cut/measure.py OUT.json [--shots DIR]
"""
import asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
OUT = sys.argv[1]; SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
RP, SP = 18611, 18941
procs = []
def start_local():
    data = tempfile.mkdtemp(prefix='tw-hillcut-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=' + ('' if SHOTS else '&nopost') + '&faces=1500&nointro'
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox
tw_sandbox.remove_campaigns()
W = "tw.worldOf(tw.area())"
async def wait(pg, js, timeout=20000):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print('  (timed out)', js[:90]); return False
async def view(pg, x, z, dist=70, pitch=62, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(300)
async def settle(pg): await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", 90000); await pg.wait_for_timeout(300)

# what is drawn, read from the world: rooms hidden by the cut, pawns hidden, hill tiles drawn over the rooms below,
# the bank's height over them, the ground's open cells, the meter
READ = """async (S) => { const w = tw.worldOf(tw.area()), E = tw.entities(); await w.terrain.ready; w.cutPass?.();
  const FP = await import(new URL('../core/footprint.js', document.baseURI).href);
  const T = w.terrainField, cells = (rid) => { const r = E[rid].recipe; return FP.cellsOf(r).map(([i, j]) => [r.x + i, r.z + j]); };
  const tilesOver = (hid, rid) => { const C = new Set(cells(rid).map(c => c.join(':'))); let drawn = 0, all = 0; for (const s of w.shell.values()) { if (s.roomId !== hid || s.spec.layer !== 'floor') continue; if (!C.has(Math.floor(s.spec.x / 5) + ':' + Math.floor(s.spec.z / 5))) continue; all++; if (s.group.visible) drawn++; } return [drawn, all]; };
  const bankOver = (rid) => { const r = E[rid].recipe; let hi = -1e9; for (let z = r.z * 5 + 1; z <= (r.z + r.d) * 5 - 1; z += 0.5) for (let x = r.x * 5 + 1; x <= (r.x + r.w) * 5 - 1; x += 0.5) hi = Math.max(hi, T ? T.heightAt(x, z) : 0); return +hi.toFixed(2); };
  const groundOpen = (rid) => cells(rid).filter(([gx, gz]) => w.groundOpenCells?.has(gx + ':' + gz)).length;
  const shellShown = (rid) => { let n = 0, v = 0; for (const s of w.shell.values()) if (s.roomId === rid) { n++; if (s.group.visible) v++; } return [v, n]; };
  const out = { cut: tw.cut.y, level: tw.level, info: tw.cutInfo(), rooms: {}, pawns: {}, over: {}, meter: tw.meter().levels.filter(l => l.rooms || l.current).map(l => [l.y, l.label, l.rooms, l.current, l.shown]) };
  for (const [k, id] of Object.entries(S.rooms)) out.rooms[k] = { hiddenByCut: w.cutHides(E[id]), shell: shellShown(id) };
  for (const [k, id] of Object.entries(S.pawns)) { const r = w.recs.get(id); out.pawns[k] = { hiddenByCut: w.cutHides(E[id]), drawn: !!r?.group.visible }; }
  for (const [k, [hid, rid]] of Object.entries(S.under)) out.over[k] = { hillTilesDrawn: tilesOver(hid, rid), bankHigh: bankOver(rid), groundOpenCells: groundOpen(rid), cells: cells(rid).length };
  return out; }"""

async def main():
    page = start_local()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); gm = await ctx.new_page()
        gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST hillcut measure (throwaway)'); await gm.click('#newCampaign button')
        await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000)
        await gm.evaluate("tw.sync.submit('campaign.set', { defaults: { fogOfWar: false } })")
        await gm.evaluate("tw.dispatch('area.ground', { cat: 'floor-grass' })"); await gm.wait_for_timeout(600)
        sp = lambda t, x, z, w, d, seed, y: gm.evaluate(f"tw.spawnRoom('{t}', {x}, {z}, {w}, {d}, {seed}, undefined, {y})")
        R = {}
        R['hill1'] = await sp('hill', 0, 0, 8, 8, 11, 10); await gm.wait_for_timeout(500)
        R['shrine'] = await sp('common', 2, 2, 3, 4, 21, 10); await wait(gm, f"!!tw.entities()['{R['shrine']}'] && tw.sync.pendingCount() === 0")
        R['shrineUp'] = await sp('guest', 2, 2, 3, 3, 22, 20); await wait(gm, f"!!tw.entities()['{R['shrineUp']}'] && tw.sync.pendingCount() === 0")
        R['cellarUnderHill1'] = await sp('cellar', 5, 0, 3, 2, 23, -10); await wait(gm, f"!!tw.entities()['{R['cellarUnderHill1']}']")
        R['hill2'] = await sp('hill', 16, 0, 8, 7, 12, 10); await gm.wait_for_timeout(500)
        R['dug'] = await sp('storeroom', 18, 4, 3, 3, 5, 0); await wait(gm, f"!!tw.entities()['{R['dug']}']")
        R['hill3'] = await sp('hill', 32, 0, 8, 8, 13, 10); await gm.wait_for_timeout(500)
        R['caveUnderHill3'] = await sp('cave', 34, 2, 4, 4, 31, -10); await wait(gm, f"!!tw.entities()['{R['caveUnderHill3']}']")
        # a building on open ground: two storeys and a cellar
        R['innGround'] = await sp('common', 0, 18, 5, 4, 41, 0); await wait(gm, f"!!tw.entities()['{R['innGround']}']")
        R['innUp'] = await sp('guest', 0, 18, 4, 4, 42, 10); await wait(gm, f"!!tw.entities()['{R['innUp']}']")
        R['innCellar'] = await sp('cellar', 0, 18, 3, 3, 43, -10); await wait(gm, f"!!tw.entities()['{R['innCellar']}'] && tw.sync.pendingCount() === 0")
        P = {'onHill1': (32.5, 32.5, 10), 'inShrine': (17.5, 17.5, 10), 'upShrine': (17.5, 17.5, 20), 'inDug': (97.5, 27.5, 0), 'onGround': (60, 60, 0), 'inCave': (182.5, 17.5, -10), 'inn': (12.5, 102.5, 0)}
        ops = [{'type': 'token.create', 'args': {'id': f'tok_hc{k.lower()[:8]:0<8}', 'name': k, 'x': x, 'z': z, 'y': y}} for k, (x, z, y) in P.items()]
        await gm.evaluate(f"tw.batch({json.dumps(ops)})"); await wait(gm, "tw.sync.pendingCount() === 0")
        PID = {k: o['args']['id'] for k, o in zip(P, ops)}
        await settle(gm)
        ents = await gm.evaluate("tw.entities()")
        bld = {k: ents[v].get('building') for k, v in R.items()}
        S = {'rooms': R, 'pawns': PID, 'under': {'cellarUnderHill1': [R['hill1'], R['cellarUnderHill1']], 'caveUnderHill3': [R['hill3'], R['caveUnderHill3']], 'dugInHill2': [R['hill2'], R['dug']]}}
        res = {'buildings': bld, 'views': {}}
        for name, how in [('all', "tw.cutOff('m')"), ('lv1', "tw.goLevel(0, 'm')"), ('lv2', "tw.goLevel(10, 'm')"), ('lv-1', "tw.goLevel(-10, 'm')"),
                          ('lv1-shrineFocus', f"(tw.select(['{R['shrine']}']), tw.goLevel(10, 'm'))"), ('dbl-shrine', f"(tw.select([]), tw.cutToRoom(tw.entities()['{R['shrine']}'], 'm'))")]:
            await gm.evaluate(how); await gm.wait_for_timeout(900)
            res['views'][name] = await gm.evaluate(READ, S)
            print(name, json.dumps({k: v['hiddenByCut'] for k, v in res['views'][name]['rooms'].items()}), json.dumps(res['views'][name]['info'].get('text')))
            if SHOTS:
                os.makedirs(SHOTS, exist_ok=True)
                for vn, v in {'lv1': [('hill-shrine', (22, 30, 95, 48, -30, 6)), ('dug-in', (97, 28, 62, 52, -20, 2))], 'lv2': [('hill-shrine', (22, 30, 95, 48, -30, 6))], 'lv-1': [('cave-under-hill', (180, 18, 70, 60, -15, -4)), ('cellar-under-hill', (32, 8, 60, 58, -25, -4)), ('cellar-open-ground', (7.5, 97.5, 60, 58, -25, -4))]}.get(name, []):
                    await view(gm, *v); await settle(gm); await gm.wait_for_timeout(2500); await gm.screenshot(path=os.path.join(SHOTS, f'{name}-{vn}.png'), timeout=240000); print('  shot', f'{name}-{vn}.png')
                    if '--magenta' in sys.argv and name == 'lv-1': # (a flat magenta sheet 2 ft under the floors: a see-through hole shows it, a shadow does not)
                        await gm.evaluate("(async () => { const THREE = await import('three'); const w = tw.worldOf(tw.area()); const m = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = -12; m.name = 'magenta'; w.scene.add(m); })()")
                        await gm.wait_for_timeout(1500); await gm.screenshot(path=os.path.join(SHOTS, f'{name}-{vn}-magenta.png'), timeout=240000); print('  shot', f'{name}-{vn}-magenta.png')
                        await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); const m = w.scene.getObjectByName('magenta'); if (m) w.scene.remove(m); })()")
        await gm.evaluate("tw.select([])")
        if '--audit' in sys.argv: # (what a slanted view at lv -1 over the cellar under the hill meets: pieces standing above the ground near it, and rays that meet nothing)
            await gm.evaluate("tw.goLevel(-10, 'm')"); await view(gm, 32, 8, 60, 58, -25, -4); await settle(gm); await gm.wait_for_timeout(1500)
            res['audit'] = await gm.evaluate("""async (cid) => { const THREE = await import('three'); const w = tw.worldOf(tw.area()), E = tw.entities(), r = E[cid].recipe, box = new THREE.Box3(), up = [];
              w.cutPass?.(); w.scene.updateMatrixWorld(true);
              for (const s of w.shell.values()) { if (!s.group.visible) continue; box.setFromObject(s.group); if (box.isEmpty() || box.max.y < 0.5) continue; const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2; if (cx < r.x * 5 - 15 || cx > (r.x + r.w) * 5 + 15 || cz < r.z * 5 - 15 || cz > (r.z + r.d) * 5 + 15) continue; up.push([s.roomId === cid ? 'CELLAR' : (E[s.roomId]?.recipe?.type || s.roomId), s.spec.layer, s.spec.id || s.spec.gen || '', s.key || s.spec.uid || '', +box.min.y.toFixed(1), +box.max.y.toFixed(1), +cx.toFixed(1), +cz.toFixed(1)]); }
              const meshes = []; w.scene.traverseVisible(o => { if (o.isMesh && !o.isSprite) meshes.push(o); });
              const rc = new THREE.Raycaster(), cam = tw.main.camera, out = { rays: 0, none: 0, below: 0, samples: [] }, sp = (x, z, y) => tw.screenOf(x, z, tw.main, y);
              for (let z = r.z * 5 - 12; z <= (r.z + r.d) * 5 + 12; z += 1) for (let x = r.x * 5 - 12; x <= (r.x + r.w) * 5 + 12; x += 1) { const s = sp(x, z, 0); const ndc = new THREE.Vector2(s.x / innerWidth * 2 - 1, -(s.y / innerHeight) * 2 + 1); rc.setFromCamera(ndc, cam); const h = rc.intersectObjects(meshes, false)[0]; out.rays++;
                if (!h) { out.none++; if (out.samples.length < 12) out.samples.push(['none', x, z]); } else if (h.point.y < -10.3) { out.below++; if (out.samples.length < 12) out.samples.push(['below', x, z, +h.point.y.toFixed(1), h.object.name || h.object.parent?.name || '']); } }
              const probe = []; rc.layers.enableAll(); for (const [x, z] of out.samples.filter(s => s[0] === 'none').slice(0, 3).map(s => [s[1], s[2]])) { const s = sp(x, z, 0); rc.setFromCamera(new THREE.Vector2(s.x / innerWidth * 2 - 1, -(s.y / innerHeight) * 2 + 1), cam); const all = []; w.scene.traverse(o => { if (o.isMesh) all.push(o); });
                const hs = rc.intersectObjects(all, false).slice(0, 4).map(h => [+h.point.x.toFixed(1), +h.point.y.toFixed(1), +h.point.z.toFixed(1), h.object.visible, (() => { let o = h.object, vis = true; while (o) { if (!o.visible) vis = false; o = o.parent; } return vis; })(), h.object.parent?.userData?.entityId || h.object.userData?.terrainBank && 'bank' || h.object.name || '']); probe.push({ x, z, dir: rc.ray.direction.toArray().map(v => +v.toFixed(2)), hs }); }
              const mine = [...w.shell.values()].filter(s => s.roomId === cid).map(s => { box.setFromObject(s.group); return [s.spec.gen || s.spec.layer, (s.key || s.spec.uid || '').slice(-14), s.group.visible, box.isEmpty() ? null : [+box.min.y.toFixed(1), +box.max.y.toFixed(1), +box.min.z.toFixed(1), +box.max.z.toFixed(1)]]; }).filter(m => m[0] !== 'floor');
              const cellarOnly = []; for (const [x, z] of [[30, 1], [32, 1], [33, 5]]) { const s = sp(x, z, 0); rc.setFromCamera(new THREE.Vector2(s.x / innerWidth * 2 - 1, -(s.y / innerHeight) * 2 + 1), cam); const gs = [...w.shell.values()].filter(q => q.roomId === cid && q.group.visible).map(q => q.group); const h = rc.intersectObjects(gs, true)[0]; cellarOnly.push([x, z, h ? [+h.point.x.toFixed(1), +h.point.y.toFixed(1), +h.point.z.toFixed(1)] : null]); }
              return { up, rays: out, probe, mine, cellarOnly, cam: cam.position.toArray().map(v => +v.toFixed(1)) }; }""", R['cellarUnderHill1'])
            print('AUDIT', json.dumps(res['audit'])[:3000])
        # the terrain rebuild, timed
        res['terrainInfo'] = await gm.evaluate(f"(async () => {{ const t0 = performance.now(); await {W}.terrain.resync(); return {{ ms: Math.round(performance.now() - t0), ...{W}.terrain.info() }}; }})()")
        res['errors'] = errors
        json.dump(res, open(OUT, 'w'), indent=1); print('wrote', OUT, 'errors', errors[:3])
        await browser.close()
    for pr in procs: pr.terminate()
asyncio.run(main())
