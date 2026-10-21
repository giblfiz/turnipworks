#!/usr/bin/env python3
"""The same page, the same view, the roofs' surface switched back and forth: painted flat / modelled sections (tiers by
distance) / modelled sections all at the near tier. Interleaved over rounds, so a busy box hits every case alike.

  TW_MM_REPO=<checkout> TW_MM_PORTS=18262,18889 python3 perf_ab.py --data <dir> --build <build.jsonl> [--rounds 5]
Per view and case: the median over rounds of the mean frame time, draw calls, triangles. One JSON line per view.
"""
import argparse, json, os, statistics, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '2026-10-06-megamap'))
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--build', required=True); ap.add_argument('--rounds', type=int, default=5); ap.add_argument('--out', default='perf_ab.jsonl'); ap.add_argument('--seconds', type=float, default=2.5); ap.add_argument('--views', default='table,quarter,whole'); ap.add_argument('--settle', type=int, default=1800); ap.add_argument('--cases', default='')
A = ap.parse_args()
B = [json.loads(l) for l in open(A.build)][-1]; ext = B['extent']; rs, lots = layout.rooms(B['asked']); C = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d'])
CASES = {'sections_far_plain': "tw.roofSurface('sections'); (() => { const w = tw.worldOf(tw.area()); w.constructor.ROOF_TIER = 'far'; w.roofTierAt = 0; setTimeout(() => { for (const r of w.roofRecs.values()) { const T = r.group.userData.roofTiers; if (T) { T.far.castShadow = false; T.far.userData.noCast = true; T.near.castShadow = false; T.near.userData.noCast = true; } } }, 600); })()", 'painted': "tw.roofSurface('painted')", 'sections': "tw.roofSurface('sections'); tw.worldOf(tw.area()).constructor.ROOF_TIER = 'auto'", 'sections_all_near': "tw.roofSurface('sections'); tw.worldOf(tw.area()).constructor.ROOF_TIER = 'near'"}
if A.cases: CASES = {k: v for k, v in CASES.items() if k in A.cases.split(',')}
SEC = "(() => { const w = tw.worldOf(tw.area()); w.roofTierAt = 0; return w.roofSectionReport(); })()"
mm.start_local(A.data)
try:
    with sync_playwright() as p:
        b, ctx, pg, errors, t_up = mm.open_game(p, token=B['token'])
        mm.wait_settled(pg, timeout=900); mm.wait_seated(pg, timeout=400)
        pg.evaluate("tw.setRoofs(true, 'perf'); tw.cutOff && tw.cutOff('perf')"); pg.wait_for_timeout(8000)
        for name, c, dist in (('table', C, 110), ('quarter', C, max(110, SPAN * 0.5)), ('whole', (ext['cx'], ext['cz']), max(110, SPAN * 1.15))):
            if name not in A.views.split(','): continue
            pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(3000)
            got = {k: [] for k in CASES}; sec = {}
            for r in range(A.rounds):
                for k, js in CASES.items():
                    pg.evaluate(js); pg.wait_for_timeout(A.settle); m = mm.summarize(pg.evaluate(mm.MEASURE_JS, A.seconds * 1000)); got[k].append((m.get('mean_ms'), m.get('draw_calls'), m.get('triangles'))); sec[k] = pg.evaluate(SEC)
            row = {'rooms': B['counts']['room'], 'view': name, 'dist': round(dist), 'rounds': A.rounds, 'load': mm.load_now()[0]}
            for k in CASES: row[k] = {'ms': round(statistics.median(x[0] for x in got[k]), 1), 'ms_all': [x[0] for x in got[k]], 'draw_calls': round(statistics.median(x[1] for x in got[k] if x[1] is not None)), 'triangles': round(statistics.median(x[2] for x in got[k] if x[2] is not None)), 'near': sec[k]['near'], 'far': sec[k]['far'], 'copies': sec[k]['copies'], 'section_tris': sec[k]['tris']}
            print(json.dumps(row), flush=True); open(A.out, 'a').write(json.dumps(row) + '\n')
        if errors: mm.say('errors', errors[:5])
        b.close()
except Exception as e: mm.say('FAILED', repr(e)[:300], 'page errors:', errors[-6:] if 'errors' in dir() else None); raise
finally: mm.stop()
