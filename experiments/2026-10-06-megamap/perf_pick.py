#!/usr/bin/env python3
"""What a pick costs: the time of world.pickAll for 400 pointer places spread over the screen at the default view (the
work done on every pointer move while hovering), with the near-the-ray filter off and on in turn, and whether the two
give the same answers. Works on the code before the fixes too (TW_MM_REPO): one mode there.
  perf_pick.py --data <relay data dir> --rooms 203 --tag new      appends one line to results/pick.jsonl"""
import argparse, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--tag', default=''); ap.add_argument('--out', default='results/pick.jsonl')
A = ap.parse_args()
B = [json.loads(l) for l in open(os.environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22)
JS = """() => { const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(); const run = () => { const ids = []; const t0 = performance.now(); let n = 0;
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) { const r = tw.rayAt(c.left + (i + 0.5) / 20 * c.width, c.top + (j + 0.5) / 20 * c.height); const hs = w.pickAll(r); ids.push(hs.map(h => h.entity?.id || h.wall || h.roof || '?').join(',')); n++; }
    return { ms: (performance.now() - t0) / n, ids, last: w.lastPick || null }; };
  const out = {}; const has = !!(tw.perf && 'pickNear' in tw.perf.get());
  if (!has) { run(); const a = run(), b = run(); out.only = +Math.min(a.ms, b.ms).toFixed(3); return out; }
  const res = { off: [], on: [] }; let same = true, ref = null;
  for (let k = 0; k < 3; k++) for (const on of [false, true]) { tw.perf.set({ pickNear: on }); const r = run(); res[on ? 'on' : 'off'].push(r.ms); if (!ref) ref = r.ids; else if (JSON.stringify(ref) !== JSON.stringify(r.ids)) same = false; if (on) out.tested = r.last; }
  out.off = +Math.min(...res.off).toFixed(3); out.on = +Math.min(...res.on).toFixed(3); out.same_answers = same; out.hits = ref.filter(x => x && !x.startsWith('room')).length; return out; }"""
def main():
    out = {'script': 'perf_pick', 'rooms': A.rooms, 'tag': A.tag, 'repo': mm.REPO, 'commit': os.popen(f'git -C {mm.REPO} rev-parse --short HEAD').read().strip(), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'load': mm.load_now()}
    mm.start_local(A.data)
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'])
        pg.evaluate(mm.cam_js(*C_BLD, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000); mm.wait_seated(pg, 240)
        out.update(pg.evaluate(JS)); out['errors'] = [e for e in errors if '404' not in e][:5]; browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n'); mm.say(json.dumps(out))
try: main()
finally: mm.stop()
