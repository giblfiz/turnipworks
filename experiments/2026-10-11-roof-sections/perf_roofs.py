#!/usr/bin/env python3
"""Frame time, draw calls and triangles of ROOFS ON on a big map, one checkout and one surface at a time.

  TW_MM_REPO=<checkout> TW_MM_PORTS=18262,18889 python3 perf_roofs.py --data <relay data dir> --build <build.jsonl> --tag before [--extra '&roofsurface=painted']
The map is a megamap rung (experiments/2026-10-06-megamap/build_get.py, 200 rooms asked); the measuring is that folder's
(mm.py: uncapped, 1920x1080, the box's GPU, runs kept only when the GPU was ours). Views: the table view on the central
building (110 ft), a quarter of the map, the whole map; each with roofs off and roofs on. One JSON line per view.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '2026-10-06-megamap'))
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--build', required=True); ap.add_argument('--tag', required=True); ap.add_argument('--extra', default=''); ap.add_argument('--out', default='perf.jsonl'); ap.add_argument('--shot')
A = ap.parse_args()
B = [json.loads(l) for l in open(A.build)][-1]; ext = B['extent']; rs, lots = layout.rooms(B['asked']); C = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d'])
SEC = "(() => { const w = tw.worldOf(tw.area()); return { roofs: w.roofRecs ? w.roofRecs.size : 0, sections: w.roofSectionReport ? w.roofSectionReport() : null, asleep: [...(w.roofRecs?.values() || [])].filter(r => r.asleep).length }; })()"
mm.start_local(A.data)
try:
    with sync_playwright() as p:
        b, ctx, pg, errors, t_up = mm.open_game(p, token=B['token'], extra=A.extra)
        mm.wait_settled(pg, timeout=900); mm.wait_seated(pg, timeout=400)
        def cam(c, dist): pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5)
        for roofs in (False, True):
            pg.evaluate(f"tw.setRoofs({'true' if roofs else 'false'}, 'perf'); tw.cutOff && tw.cutOff('perf')"); pg.wait_for_timeout(6000)
            for name, c, dist in (('table', C, 110), ('quarter', C, max(110, SPAN * 0.5)), ('whole', (ext['cx'], ext['cz']), max(110, SPAN * 1.15))):
                cam(c, dist); pg.wait_for_timeout(4000); m = mm.measure(pg, 3.0, want=2, budget_s=70)
                row = {'tag': A.tag, 'rooms': B['counts']['room'], 'roofs_on': roofs, 'view': name, 'dist': round(dist), 'mean_ms': m.get('mean_ms'), 'p95_ms': m.get('p95_ms'), 'js_ms': m.get('js_ms'), 'draw_calls': m.get('draw_calls'), 'triangles': m.get('triangles'), 'quiet': m.get('quiet'), 'runs': m.get('runs'), **pg.evaluate(SEC)}
                print(json.dumps(row), flush=True); open(A.out, 'a').write(json.dumps(row) + '\n')
                if A.shot and roofs: pg.screenshot(path=f'{A.shot}-{name}.png')
        if errors: mm.say('errors', errors[:5])
        b.close()
finally: mm.stop()
