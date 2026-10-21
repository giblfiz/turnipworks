#!/usr/bin/env python3
"""Where the time goes at one size: a CPU profile of the frame, and things taken away one at a time (in the page, no game code changed).

  python3 ablate.py --data <relay data dir> --rooms 203
  profile          Chrome's sampling profiler for 6 s at the default view and at the whole-map view: self time per function
  hide_far         every thing, wall, floor and roof more than 150 ft from the camera's focus set invisible
                   (what culling by building would save in DRAWING; the per-frame JavaScript still walks them)
  detach_far       the same pieces taken out of the scene graph (three.js no longer walks them either)
  far_lights_out   point lights more than 120 ft from the camera's focus taken out of the scene
  faces_1500       the whole map at the lowest detail tier (tw.setFaces(1500)): what distance detail levels could save
"""
import argparse, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--out', default='results/ablate.jsonl')
ap.add_argument('--seconds', type=float, default=2.5); ap.add_argument('--runs', type=int, default=3); ap.add_argument('--skip', default='')
A = ap.parse_args()
B = [json.loads(l) for l in open(__import__('os').environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
ext = B['extent']; rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d']); CEN = (ext['cx'], ext['cz'])

FAR_JS = """([cx, cz, R, mode]) => { const w = tw.worldOf(tw.area()), T = tw.THREE, v = new T.Vector3(); const far = []; window.__far = far;
  const groups = []; for (const r of w.recs.values()) if (r.group) groups.push(r.group); for (const s of (w.shell?.values?.() || [])) { const g = s.group || s; if (g && g.isObject3D) groups.push(g); }
  for (const s of (w.roofRecs?.values?.() || [])) { const g = s.group || s; if (g && g.isObject3D) groups.push(g); }
  const b = new T.Box3();
  for (const g of groups) { if (!g.parent) continue; b.setFromObject(g); if (b.isEmpty()) continue; b.getCenter(v); if (Math.hypot(v.x - cx, v.z - cz) > R) far.push([g, g.parent, g.visible]); }
  for (const [g] of far) { if (mode === 'hide') g.visible = false; else g.parent.remove(g); }
  return { groups: groups.length, far: far.length }; }"""
UNFAR_JS = "(() => { for (const [g, p, v] of (window.__far || [])) { if (!g.parent) p.add(g); g.visible = v; } window.__far = []; })()"
VIS_JS = "(() => { let n = 0, m = 0; const w = tw.worldOf(tw.area()); const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }; w.scene.traverse(o => { if (o.isMesh) { m++; if (vis(o)) n++; } }); return [n, m]; })()"

def profile(pg, ctx, seconds=6):
    cdp = ctx.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 500}); cdp.send('Profiler.start')
    f0 = pg.evaluate('tw.stats.frames'); pg.wait_for_timeout(seconds * 1000); f1 = pg.evaluate('tw.stats.frames')
    pr = cdp.send('Profiler.stop')['profile']; cdp.detach()
    nodes = {n['id']: n for n in pr['nodes']}; self_us = {}
    for nid, dt in zip(pr['samples'], pr['timeDeltas']): self_us[nid] = self_us.get(nid, 0) + dt
    total = sum(self_us.values()) or 1; agg = {}
    for nid, us in self_us.items():
        cf = nodes[nid]['callFrame']; key = f"{cf['functionName'] or '(anonymous)'} {os.path.basename(cf['url'].split('?')[0])}:{cf['lineNumber'] + 1}"
        agg[key] = agg.get(key, 0) + us
    byfile = {}
    for k, us in agg.items():
        f = k.split(' ')[-1].split(':')[0] or k.split(' ')[0]; byfile[f] = byfile.get(f, 0) + us
    frames = max(1, f1 - f0)
    return {'frames': frames, 'ms_per_frame_total': round(total / 1000 / frames, 2),
            'top': [[k, round(us / total * 100, 1), round(us / 1000 / frames, 2)] for k, us in sorted(agg.items(), key=lambda x: -x[1])[:28]],
            'by_file': [[k, round(us / total * 100, 1), round(us / 1000 / frames, 2)] for k, us in sorted(byfile.items(), key=lambda x: -x[1])[:14]]}

def main():
    out = {'script': 'ablate', 'rooms': A.rooms, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    mm.start_local(A.data)
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'])
        pg.evaluate(mm.cam_js(*C_BLD, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000)
        def cam(c, dist): pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(2500)
        def m(name):
            r = mm.measure(pg, A.seconds); r['visible_meshes'] = pg.evaluate(VIS_JS); out[name] = r
            mm.say(f"  {name}: {r.get('mean_ms')} ms (js {r.get('js_ms')}, quiet {r.get('quiet')})  draws {r.get('draw_calls')}  tris {r.get('triangles')}  vis {r['visible_meshes']}")
        full = max(110, SPAN * 1.15)
        cam(C_BLD, 110); m('default'); out['profile_default'] = profile(pg, ctx)
        cam(CEN, full); m('whole'); out['profile_whole'] = profile(pg, ctx)
        # ---- far pieces invisible, then detached (default view)
        cam(C_BLD, 110)
        out['hide_far_n'] = pg.evaluate(FAR_JS, [C_BLD[0], C_BLD[1], 150, 'hide']); pg.wait_for_timeout(1500); m('default_hide_far')
        out['hide_far_still_hidden'] = pg.evaluate("window.__far.filter(f => !f[0].visible).length")
        out['profile_default_hide_far'] = profile(pg, ctx)
        pg.evaluate(UNFAR_JS); pg.wait_for_timeout(500)
        out['detach_far_n'] = pg.evaluate(FAR_JS, [C_BLD[0], C_BLD[1], 150, 'detach']); pg.wait_for_timeout(1500); m('default_detach_far')
        out['detach_far_still_out'] = pg.evaluate("window.__far.filter(f => !f[0].parent).length")
        out['profile_default_detach_far'] = profile(pg, ctx)
        # ... plus labels and fog off on top: the floor a "sleeping far buildings" design could reach without touching the per-frame walks
        pg.evaluate("tw.setLabels(false)"); pg.wait_for_timeout(1000); m('default_detach_far_labels_off'); pg.evaluate("tw.setLabels(true)")
        pg.evaluate(UNFAR_JS); pg.wait_for_timeout(1000)
        # ---- real lights far from the camera taken out of the scene (what "cap live lights by distance" would save):
        # three.js shades every lit pixel with every point light in the scene, wherever the light is
        LIGHTS = """([cx, cz, R]) => { const w = tw.worldOf(tw.area()), T = tw.THREE, v = new T.Vector3(); const out = []; let all = 0;
          w.scene.traverse(o => { if (o.isPointLight || o.isSpotLight) { all++; o.getWorldPosition(v); if (Math.hypot(v.x - cx, v.z - cz) > R) out.push([o, o.parent]); } });
          for (const [o] of out) o.parent.remove(o); window.__lights = out; return { lights: all, far: out.length }; }"""
        cam(C_BLD, 110); m('default_again')
        out['far_lights_n'] = pg.evaluate(LIGHTS, [C_BLD[0], C_BLD[1], 120]); pg.wait_for_timeout(2500); m('default_far_lights_out')
        out['far_lights_still_out'] = pg.evaluate("window.__lights.filter(l => !l[0].parent).length"); out['programs_after_lights'] = pg.evaluate("tw.worldOf(tw.area()).fx.stats().programs")
        cam(CEN, full); m('whole_far_lights_out')
        pg.evaluate("(() => { for (const [o, p] of window.__lights) if (!o.parent) p.add(o); window.__lights = []; })()"); pg.wait_for_timeout(2500)
        # ---- whole map with one thing off at a time
        cam(CEN, full)
        pg.evaluate("tw.setLabels(false)"); pg.wait_for_timeout(1500); m('whole_labels_off'); pg.evaluate("tw.setLabels(true)")
        fxp = "tw.worldOf(tw.area()).fx"
        pg.evaluate(f"(() => {{ const l = {fxp}.lighting; l.params.on = false; l.apply(); }})()"); pg.wait_for_timeout(1500); m('whole_post_off'); pg.evaluate(f"(() => {{ const l = {fxp}.lighting; l.params.on = true; l.apply(); }})()")
        pg.evaluate("(() => { const w = tw.worldOf(tw.area()); w.fxItems = () => []; })()"); pg.wait_for_timeout(2500); m('whole_fires_off'); pg.evaluate("(() => { delete tw.worldOf(tw.area()).fxItems; })()"); pg.wait_for_timeout(1500)
        # ---- the lowest detail tier
        if 'faces' not in A.skip:
            t0 = time.time(); pg.evaluate("tw.setFaces(1500)"); pg.wait_for_timeout(3000); ok, s, st = mm.wait_settled(pg, timeout=1800); out['faces_1500_swap_s'] = round(time.time() - t0, 1)
            cam(CEN, full); m('whole_faces_1500'); cam(C_BLD, 110); m('default_faces_1500')
        out['errors'] = [e for e in errors if '404' not in e][:8]; out['lost'] = pg.evaluate(mm.GPU_JS)['lost']
        browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n')
try: main()
finally: mm.stop()
