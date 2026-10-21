#!/usr/bin/env python3
"""Second round of take-aways, aimed at what the profile named (results/profile2-*.txt). In the page only; no game code changed.
Every ablation is measured next to its own fresh baseline (A, B, A, B ...), because the box is shared.
  ao_off            contact shadows (N8AO) pass removed (ao.strength 0)
  ao_no_transp      N8AO kept, but its "transparency" re-render of the whole scene and its per-frame scene walk stubbed out
                    (N8AOPostPass.prototype.renderTransparency / detectTransparency = no-op, patched through the import map)
  shadows_off       no shadow-casting fire light (shadows.casters 0)
  static_matrices   scene.matrixWorldAutoUpdate = false (three.js stops recomputing 47k world matrices three times a frame)
  far_asleep        every piece more than 150 ft from the focus taken out of the scene graph
  top3              far_asleep + ao_no_transp + static_matrices together; top3_shadows_off adds shadows_off
  python3 ablate2.py --data <relay data dir> --rooms 203
"""
import argparse, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--out', default='results/ablate2.jsonl'); ap.add_argument('--stack-only', action='store_true', help='only the fixes stacked at the default view (quick)')
A = ap.parse_args()
B = [json.loads(l) for l in open(__import__('os').environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
ext = B['extent']; rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d']); CEN = (ext['cx'], ext['cz'])
FAR_JS = """([cx, cz, R]) => { const w = tw.worldOf(tw.area()), T = tw.THREE, v = new T.Vector3(); const far = []; window.__far = far;
  const groups = []; for (const r of w.recs.values()) if (r.group) groups.push(r.group); for (const s of (w.shell?.values?.() || [])) { const g = s.group || s; if (g && g.isObject3D) groups.push(g); }
  const b = new T.Box3(); for (const g of groups) { if (!g.parent) continue; b.setFromObject(g); if (b.isEmpty()) continue; b.getCenter(v); if (Math.hypot(v.x - cx, v.z - cz) > R) far.push([g, g.parent]); }
  for (const [g] of far) g.parent.remove(g); return far.length; }"""
UNFAR_JS = "(() => { for (const [g, p] of (window.__far || [])) if (!g.parent) p.add(g); window.__far = []; })()"
fxp = "tw.worldOf(tw.area()).fx"
ON = {
 'ao_off': f"(() => {{ const p = {fxp}.params('lighting'); window.__ao = p.ao.strength; {fxp}.setParams('lighting', {{ ...p, ao: {{ ...p.ao, strength: 0 }} }}); }})()",
 'ao_no_transp': "import('n8ao').then(m => { const P = m.N8AOPostPass.prototype; window.__n8 = [P.renderTransparency, P.detectTransparency]; P.renderTransparency = function () {}; P.detectTransparency = function () {}; return true; })",
 'shadows_off': f"(() => {{ const p = {fxp}.params('lighting'); window.__sh = p.shadows.casters; {fxp}.setParams('lighting', {{ ...p, shadows: {{ ...p.shadows, casters: 0 }} }}); }})()",
 'static_matrices': "(() => { const s = tw.worldOf(tw.area()).scene; s.updateMatrixWorld(true); s.matrixWorldAutoUpdate = false; })()",
}
OFF = {
 'ao_off': f"(() => {{ const p = {fxp}.params('lighting'); {fxp}.setParams('lighting', {{ ...p, ao: {{ ...p.ao, strength: window.__ao }} }}); }})()",
 'ao_no_transp': "import('n8ao').then(m => { const P = m.N8AOPostPass.prototype; [P.renderTransparency, P.detectTransparency] = window.__n8; return true; })",
 'shadows_off': f"(() => {{ const p = {fxp}.params('lighting'); {fxp}.setParams('lighting', {{ ...p, shadows: {{ ...p.shadows, casters: window.__sh }} }}); }})()",
 'static_matrices': "(() => { tw.worldOf(tw.area()).scene.matrixWorldAutoUpdate = true; })()",
}
def main():
    out = {'script': 'ablate2', 'rooms': A.rooms, 'stack_only': A.stack_only, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    mm.start_local(A.data)
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'])
        pg.evaluate(mm.cam_js(*C_BLD, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000)
        full = max(110, SPAN * 1.15)
        def cam(c, dist): pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(2500)
        def m(name):
            r = mm.measure(pg, 2.5, want=2, budget_s=70); out[name] = r; mm.say(f"  {name}: {r.get('mean_ms')} ms (quiet {r.get('quiet')})  draws {r.get('draw_calls')}")
        def on(k): pg.evaluate(ON[k]) if k in ON else pg.evaluate(FAR_JS, [C_BLD[0], C_BLD[1], 150]); pg.wait_for_timeout(2000)
        def off(k): pg.evaluate(OFF[k]) if k in OFF else pg.evaluate(UNFAR_JS); pg.wait_for_timeout(1500)
        for view, c, dist in (() if A.stack_only else (('default', C_BLD, 110), ('whole', CEN, full))):
            cam(c, dist)
            for k in ('ao_off', 'ao_no_transp', 'shadows_off', 'static_matrices'):
                m(f'{view}_base_before_{k}'); on(k); m(f'{view}_{k}'); off(k)
        cam(C_BLD, 110)
        m('default_base_before_top3'); on('far_asleep'); m('default_far_asleep'); on('ao_no_transp'); m('default_far_asleep_ao'); on('static_matrices'); m('default_top3'); on('shadows_off'); m('default_top3_shadows_off')
        pg.evaluate("tw.setLabels(false)"); pg.wait_for_timeout(1000); m('default_top3_shadows_labels_off'); pg.evaluate("tw.setLabels(true)")
        for k in ('shadows_off', 'static_matrices', 'far_asleep'): off(k)
        # the whole map with the three that still apply when everything is in view
        if A.stack_only: off('ao_no_transp')
        else: cam(CEN, full); on('static_matrices'); on('shadows_off'); m('whole_ao_no_transp_static_shadows_off'); off('shadows_off'); off('static_matrices'); off('ao_no_transp')
        out['errors'] = [e for e in errors if '404' not in e][:8]; out['lost'] = pg.evaluate(mm.GPU_JS)['lost']
        browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n')
try: main()
finally: mm.stop()
