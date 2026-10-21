#!/usr/bin/env python3
"""Load one rung of the ladder cold and measure it: load times, memory, scene counts, frame time per view, the relay.

  python3 measure.py --data <relay data dir> --rooms 52 [--views all] [--out results/measure.jsonl]
The campaign is found in results/build.jsonl (the GM token). A fresh browser (cold cache) joins it, so the scene is in the
state a returning GM gets: stored furniture, shared materials. Frame times are uncapped (no vsync) at 1920x1080, on the
box's GPU; each view is settled for 2.5 s, then timed for RUNS x SECONDS of requestAnimationFrame.
"""
import argparse, glob, json, os, sys, time, urllib.request
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True)
ap.add_argument('--out', default='results/measure.jsonl'); ap.add_argument('--seconds', type=float, default=2.5); ap.add_argument('--runs', type=int, default=3)
ap.add_argument('--views', default='all'); ap.add_argument('--capped', action='store_true'); ap.add_argument('--max-load', type=float, default=6.0); ap.add_argument('--tag', default='')
ap.add_argument('--load-timeout', type=float, default=3600)
A = ap.parse_args()
B = [json.loads(l) for l in open(__import__('os').environ.get('BUILD_JSONL', 'results/build.jsonl'))]
B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
ext = B['extent']; TOKEN = B['token']
rs, lots = layout.rooms(B['asked'])
lot = {l['name']: l for l in reversed(lots)}  # the first (most central) lot of each kind
C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22)                                   # the central inn
C_UP = ((lot.get('mansion') or lots[0])['x'] + 50, (lot.get('mansion') or lots[0])['z'] + 20)  # a three-storey mansion with a cellar
SPAN = max(ext['w'], ext['d'])

SCENE_JS = """(() => { const w = tw.worldOf(tw.area()); const geos = new Set(), mats = new Set(), texs = new Map(), pairs = new Map(); let meshes = 0, vis = 0, tris = 0, groups = 0, nodes = 0, inst = 0;
  const lights = {}; let casters = 0, visLights = 0;
  const isVis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  w.scene.traverse(o => { nodes++; if (o.isLight) { lights[o.type] = (lights[o.type] || 0) + 1; if (isVis(o) && o.intensity > 0) visLights++; if (o.castShadow) casters++; }
    if (!o.isMesh) { if (o.isGroup) groups++; return; } meshes++; if (o.isInstancedMesh) inst++;
    const v = isVis(o); if (v) vis++; const g = o.geometry; geos.add(g.uuid);
    const t = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0); if (v) tris += t;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { if (!m) continue; mats.add(m.uuid);
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) { const x = m[k]; if (x && x.image) texs.set(x.uuid, (x.image.width || 0) * (x.image.height || 0)); }
      if (v) { const key = g.uuid + '|' + m.uuid; pairs.set(key, (pairs.get(key) || 0) + 1); } } });
  let repeats = 0, top = []; for (const [k, n] of pairs) { if (n > 1) repeats += n - 1; } top = [...pairs.values()].sort((a, b) => b - a).slice(0, 8);
  let px = 0; for (const n of texs.values()) px += n;
  return { nodes, groups, meshes, visible_meshes: vis, visible_triangles: Math.round(tris), geometries: geos.size, materials: mats.size, textures: texs.size, texture_mb_est: Math.round(px * 4 * 1.33 / 1e6),
    unique_mesh_material_pairs: pairs.size, repeat_draws: repeats, top_repeats: top, lights, visible_lights: visLights, shadow_casting_lights: casters, recs: w.recs.size, shell: w.shell?.size ?? null, roof_recs: w.roofRecs?.size ?? null }; })()"""
FX_JS = """(() => { const s = tw.worldOf(tw.area()).fx?.stats?.() || {}; const k = ['frame_draw_calls', 'frame_triangles', 'programs', 'post_passes', 'shadow_casters', 'fire_lights', 'volume_fires', 'small_flames', 'shared_lights', 'lantern_lights', 'particle_systems', 'atmos_cpu_ms', 'atmos_sim_cpu_ms', 'atmos_gpu_sim_ms', 'atmos_gpu_draw_ms', 'atmos_grid', 'atmos_window_ft', 'atmos_rooms', 'atmos_volume', 'depth_on', 'depth_path', 'water_cpu_ms'];
  const o = {}; for (const x of k) o[x] = s[x] ?? null; o.lit = tw.worldOf(tw.area()).litCount?.() ?? null; o.cam_dist = Math.round(tw.main.grab.dist); o.labels = document.querySelectorAll('.roomLabel, .label, [data-label]').length; return o; })()"""
RESET_JS = "(() => { tw.setCut && tw.setCut(null, { pinned: true, by: 'megamap' }); tw.setRoofs && tw.setRoofs(false, 'megamap'); })()"
def cam(pg, c, dist, pitch=55): pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist, pitch))
def quiet():
    t0 = time.time(); l = mm.load_now()
    return l
PAN_JS = """(v) => { window.__pan = true; const g = tw.main.grab; let last = performance.now(), dir = 1, x0 = g.focus.x; const step = (now) => { if (!window.__pan) { g.focus.x = x0; g.update(); return; } const dt = (now - last) / 1000; last = now; g.focus.x += dir * v * dt; if (Math.abs(g.focus.x - x0) > 150) dir = -dir; g.update(); requestAnimationFrame(step); }; requestAnimationFrame(step); }"""

def main():
    out = {'script': 'measure', 'tag': A.tag, 'rooms': A.rooms, 'campaign': B['campaign'], 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'uncapped': not A.capped, 'extent_ft': [ext['w'], ext['d']]}
    t0 = time.time(); mm.start_local(A.data); out['relay_boot_s'] = round(time.time() - t0, 2)
    cdir = [d for d in glob.glob(os.path.join(A.data, 'cmp_*')) if TOKEN and os.path.isdir(d)]
    gpu0 = mm.gpu_now(); out['gpu_before'] = gpu0; out['load_before'] = mm.load_now()
    with sync_playwright() as p:
        t0 = time.time()
        try: browser, ctx, pg, errors, t_ready = mm.open_game(p, uncapped=not A.capped, token=TOKEN)
        except Exception as e:
            out['load_failed'] = str(e)[:300]; print(json.dumps(out)); open(A.out, 'a').write(json.dumps(out) + '\n'); return
        out['ready_s'] = round(t_ready, 2)
        out['renderer'] = pg.evaluate(mm.GPU_JS)
        cam(pg, C_BLD, 110)
        try: pg.wait_for_function('tw.stats.frames > 2', timeout=600000); out['first_frames_s'] = round(time.time() - t0, 2)
        except Exception as e: out['first_frames_s'] = None
        ok, s, st = mm.wait_settled(pg, timeout=A.load_timeout)
        out['all_streamed_s'] = round(time.time() - t0 - 2.0, 1); out['settled'] = ok; out['faces'] = pg.evaluate('String(tw.facesUsed)')
        out['counts'] = pg.evaluate(mm.COUNTS_JS)
        out['house'] = pg.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx; return { atmos: fx?.params('atmos')?.name ?? null, post: !!fx?.params('lighting')?.on }; })()")
        pg.evaluate(RESET_JS); pg.wait_for_timeout(3000)
        out['heap_mb'] = round(pg.evaluate('performance.memory.usedJSHeapSize') / 1e6)
        out['gpu_mem_mb'] = mm.my_gpu_mem(); gpu1 = mm.gpu_now(); out['gpu_mem_mb_added'] = (gpu1.get('mem_mb', 0) - gpu0.get('mem_mb', 0)) if gpu0 else None
        out['state_json_mb'] = round(pg.evaluate("JSON.stringify(tw.sync.view(tw.area()).entities).length") / 1e6, 2)
        # a pawn to drag, standing in the street beside the central building
        tok = pg.evaluate(f"(() => {{ const have = Object.values(tw.entities()).find(e => e.kind === 'token'); if (have) return have.id; const id = 'tok_' + Math.random().toString(36).slice(2, 12).padEnd(10, '0'); tw.dispatch('token.create', {{ id, name: 'Megamap pawn', x: {C_BLD[0]}, z: {lots[0]['z'] - 7.5} }}); return id; }})()")
        pg.wait_for_timeout(1500); out['pawn'] = bool(pg.evaluate(f"!!tw.entities()['{tok}']"))

        views = {}
        def view(name, setup=None, during=None, after=None, c=C_BLD, dist=110):
            if A.views != 'all' and name not in A.views.split(','): return
            pg.evaluate(RESET_JS); cam(pg, c, dist)
            if setup: setup()
            pg.mouse.move(5, 5); pg.wait_for_timeout(2500); load = quiet()
            if during: during()
            try: m = mm.measure(pg, A.seconds)
            except Exception as e: m = {'mean_ms': None, 'error': str(e)[:200]}
            m['fx'] = pg.evaluate(FX_JS); m['gpu_util'] = mm.gpu_now().get('util'); m['lost'] = pg.evaluate(mm.GPU_JS)['lost']
            if after: after()
            views[name] = m; mm.say(f"  {A.rooms} {name}: {m.get('mean_ms')} ms (js {m.get('js_ms')}, quiet {m.get('quiet')}, {len(m.get('runs', []))} runs)  p95 {m.get('p95_ms')}  worst {m.get('max_ms')}  draws {m.get('draw_calls')}  tris {m.get('triangles')}")
        q = max(110, SPAN * 0.5); full = max(110, SPAN * 1.15)
        fxp = "tw.worldOf(tw.area()).fx"
        view('default')
        out['scene_default'] = pg.evaluate(SCENE_JS)
        view('quarter', dist=q)
        view('whole', c=(ext['cx'], ext['cz']), dist=full)
        out['scene_whole_dist'] = [round(q), round(full), pg.evaluate('tw.main.grab.dist'), pg.evaluate('tw.main.camera ? tw.main.camera.far : null')]
        view('whole_capped600', c=(ext['cx'], ext['cz']), dist=min(600, full))
        view('roofs', setup=lambda: pg.evaluate("tw.setRoofs(true, 'megamap')"))
        view('roofs_whole', setup=lambda: pg.evaluate("tw.setRoofs(true, 'megamap')"), c=(ext['cx'], ext['cz']), dist=full)
        view('upper_cut', setup=lambda: pg.evaluate("tw.setCut(19, { pinned: true, by: 'megamap' })"), c=C_UP)
        view('cellar', setup=lambda: pg.evaluate("tw.setCut(-1, { pinned: true, by: 'megamap' })"), c=C_UP, dist=80)
        view('pan', during=lambda: pg.evaluate(PAN_JS, 60), after=lambda: pg.evaluate('window.__pan = false'))
        # hover: the mouse sweeps the map (pick raycasts); drag: the pawn is held and carried along the street
        def sweep(n_s, hold=None):
            q, _ = mm.wait_gpu_quiet(timeout=40); pg.evaluate(f"window.__m = ({mm.MEASURE_JS})({n_s * 1000})")
            t = time.time(); i = 0
            while time.time() - t < n_s: i += 1; pg.mouse.move(700 + 500 * abs(((i * 7) % 200) / 100 - 1), 520 + 40 * ((i % 40) / 40)); pg.wait_for_timeout(8)
            r = mm.summarize(pg.evaluate('window.__m')); r['mouse_moves'] = i; r['others_gpu'] = mm.others_gpu(); r['quiet'] = bool(q and (r['others_gpu'] or 0) <= 4); return r
        if A.views == 'all' or 'hover' in A.views:
            pg.evaluate(RESET_JS); cam(pg, C_BLD, 110); pg.wait_for_timeout(2000); views['hover'] = sweep(A.seconds * 1.5); mm.say(f"  hover: {views['hover']}")
        if (A.views == 'all' or 'drag' in A.views) and out['pawn']:
            cam(pg, (C_BLD[0], lots[0]['z'] - 7.5), 110); pg.wait_for_timeout(1500)
            xy = pg.evaluate(f"(() => {{ const e = tw.entities()['{tok}']; return tw.screenOf(e.x, e.z); }})()")
            views['drag_at'] = xy
            try:
                sx, sy = (xy['x'], xy['y']) if isinstance(xy, dict) else (xy[0], xy[1])
                pg.mouse.move(sx, sy - 8); pg.wait_for_timeout(200); pg.mouse.down(); pg.mouse.move(sx + 30, sy - 8, steps=5)
                q, _ = mm.wait_gpu_quiet(timeout=40); pg.evaluate(f"window.__m = ({mm.MEASURE_JS})({A.seconds * 1500})"); t = time.time(); i = 0
                while time.time() - t < A.seconds * 1.5: i += 1; pg.mouse.move(sx + 300 * abs(((i * 5) % 200) / 100 - 1), sy - 8); pg.wait_for_timeout(8)
                r = mm.summarize(pg.evaluate('window.__m')); r['mouse_moves'] = i; r['dragging'] = pg.evaluate('tw.localDrags.size'); r['others_gpu'] = mm.others_gpu(); r['quiet'] = bool(q and (r['others_gpu'] or 0) <= 4); pg.mouse.up(); views['drag'] = r; mm.say(f"  drag: {r}")
            except Exception as e: views['drag'] = {'error': str(e)[:200]}; pg.mouse.up()
        # switches: each from the default view, one thing off at a time
        view('labels_off', setup=lambda: pg.evaluate("tw.setLabels(false)"), after=lambda: pg.evaluate("tw.setLabels(true)"))
        A0 = pg.evaluate(f"JSON.stringify({fxp}.params('atmos'))")
        view('fog_off', setup=lambda: pg.evaluate(f"{fxp}.setParams('atmos', {{ name: 'clear' }})"), after=lambda: pg.evaluate(f"{fxp}.setParams('atmos', {A0})"))
        view('fog_off_whole', setup=lambda: pg.evaluate(f"{fxp}.setParams('atmos', {{ name: 'clear' }})"), after=lambda: pg.evaluate(f"{fxp}.setParams('atmos', {A0})"), c=(ext['cx'], ext['cz']), dist=full)
        view('shadows_off', setup=lambda: pg.evaluate(f"(() => {{ const p = {fxp}.params('lighting'); window.__sh = p.shadows.casters; {fxp}.setParams('lighting', {{ ...p, shadows: {{ ...p.shadows, casters: 0 }} }}); }})()"),
             after=lambda: pg.evaluate(f"(() => {{ const p = {fxp}.params('lighting'); {fxp}.setParams('lighting', {{ ...p, shadows: {{ ...p.shadows, casters: window.__sh }} }}); }})()"))
        view('fires_off', setup=lambda: pg.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); window.__fi = w.fxItems; w.fxItems = () => []; }})()"),
             after=lambda: pg.evaluate("(() => { const w = tw.worldOf(tw.area()); delete w.fxItems; })()"))
        view('post_off', setup=lambda: pg.evaluate(f"(() => {{ const l = {fxp}.lighting; l.params.on = false; l.apply(); }})()"),
             after=lambda: pg.evaluate(f"(() => {{ const l = {fxp}.lighting; l.params.on = true; l.apply(); }})()"))
        pg.wait_for_timeout(1500)
        out['views'] = views

        # ---------- the relay: idle cost with this tab attached, a second client joining late, a GET state
        pid = mm.relay_pid(); c0, rss = mm.proc_stat(pid); time.sleep(5); c1, rss = mm.proc_stat(pid)
        rel = {'cpu_pct_idle_one_client': round((c1 - c0) / 5 * 100, 1), 'rss_mb': rss}
        for d in cdir:
            j = os.path.join(d, 'journal.jsonl')
            if os.path.exists(j) and TOKEN: pass
        t0 = time.time(); c0, _ = mm.proc_stat(pid)
        b2, ctx2, pg2, e2, t2 = mm.open_game(p, uncapped=not A.capped, token=TOKEN)
        rel['late_join_ready_s'] = round(t2, 2)
        pg2.wait_for_function(f"Object.keys(tw.entities()).length >= {out['counts']['all']}", timeout=600000); rel['late_join_all_entities_s'] = round(time.time() - t0, 2)
        ok2, s2, _ = mm.wait_settled(pg2, timeout=A.load_timeout); rel['late_join_all_streamed_s'] = round(time.time() - t0 - 2.0, 1)
        c1, _ = mm.proc_stat(pid); rel['late_join_relay_cpu_s'] = round(c1 - c0, 2)
        # a command's round trip with the map this size: the pawn moves a square (from the second tab; the first must see it)
        rt = pg2.evaluate(f"(async () => {{ const t = performance.now(); const e = tw.entities()['{tok}']; const cid = tw.dispatch('token.move', {{ id: '{tok}', x: e.x + 5, z: e.z }}); await tw.await(cid); return performance.now() - t; }})()") if out['pawn'] else None
        rel['token_move_ack_ms'] = round(rt, 1) if rt is not None else None
        b2.close()
        out['relay'] = rel
        out['errors'] = [e for e in errors if '404' not in e][:8]; out['lost_end'] = pg.evaluate(mm.GPU_JS)['lost']
        browser.close()
    # the campaign's files
    for d in glob.glob(os.path.join(A.data, 'cmp_*')):
        try:
            if B['campaign'] in open(os.path.join(d, 'snapshot.json')).read(4000) or B['campaign'] in open(os.path.join(d, 'journal.jsonl')).read(4000):
                out['relay']['journal_mb'] = round(os.path.getsize(os.path.join(d, 'journal.jsonl')) / 1e6, 2); out['relay']['snapshot_mb'] = round(os.path.getsize(os.path.join(d, 'snapshot.json')) / 1e6, 2)
        except Exception: pass
    open(A.out, 'a').write(json.dumps(out) + '\n')
    mm.say(json.dumps({k: v for k, v in out.items() if k != 'views'}))

try: main()
finally: mm.stop()
