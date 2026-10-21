#!/usr/bin/env python3
"""Loading a big map: how long until the view in front of you has all its meshes, and until the whole map has.
A cold browser joins the built map on the local relay (no network delay). Polled every 100 ms from the page:
  ready        the game is live (the state has arrived)
  view_in      nothing that the opening camera can see is still a grey stand-in
  all_in       no stand-in is left anywhere
  frames       how many frames were drawn before view_in and before all_in, and the longest gap between two
Works on the code before the fixes too (TW_MM_REPO).   perf_load.py --data <relay data dir> --rooms 203 --tag new [--extra '&perfoff=loadNear']
Appends one line to results/load.jsonl."""
import argparse, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--tag', default=''); ap.add_argument('--out', default='results/load.jsonl'); ap.add_argument('--extra', default=''); ap.add_argument('--rounds', type=int, default=1)
A = ap.parse_args()
B = [json.loads(l) for l in open(os.environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22)
WATCH = """(() => { const T = tw.THREE, fr = new T.Frustum(), m = new T.Matrix4(), v = new T.Vector3(); const L = window.__load = { t0: performance.now(), view_in: null, all_in: null, frames: 0, gap: 0, last: performance.now(), fView: null, fAll: null };
  const tick = () => { const now = performance.now(); L.frames++; L.gap = Math.max(L.gap, now - L.last); L.last = now; if (!L.all_in) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  const poll = () => { const w = tw.worldOf(tw.area()), c = tw.main.camera; if (!w.loaded) return setTimeout(poll, 100); fr.setFromProjectionMatrix(m.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse));
    let view = 0, all = 0; const seen = (x, y, z) => fr.containsPoint(v.set(x, y, z));
    for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.url && r.visual?.userData?.placeholder) { all++; if (seen(r.entity.x, r.entity.y || 0, r.entity.z)) view++; }
    for (const s of w.shell.values()) if (s.visual?.userData?.placeholder) { all++; if (seen(s.spec.x, s.spec.y || 0, s.spec.z)) view++; }
    const now = performance.now(); if (!view && L.view_in == null && w.shell.size) { L.view_in = now - L.t0; L.fView = L.frames; } if (!all && w.shell.size) { L.all_in = now - L.t0; L.fAll = L.frames; return; } L.left = [view, all]; setTimeout(poll, 100); }; poll(); })()"""
def one(p):
    t0 = time.time()
    browser = p.chromium.launch(headless=True, args=mm.ARGS + mm.UNCAPPED); ctx = browser.new_context(viewport=mm.VIEWPORT, device_scale_factor=1); pg = ctx.new_page(); mm.tw_sandbox.proxy(pg, mm.API); pg.set_default_timeout(120000)
    pg.goto(mm.page_url(A.extra) + '#s=' + B['token']); pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=600000); ready = time.time() - t0
    pg.evaluate(mm.cam_js(*C_BLD, 110)); pg.evaluate(WATCH); pg.mouse.move(5, 5)
    pg.wait_for_function('window.__load.all_in != null', timeout=900000, polling=250); L = pg.evaluate('window.__load')
    r = {'ready_s': round(ready, 1), 'view_in_s': round(ready + L['view_in'] / 1000, 1), 'all_in_s': round(ready + L['all_in'] / 1000, 1), 'frames_to_view': L['fView'], 'frames_to_all': L['fAll'], 'longest_gap_ms': round(L['gap']), 'load': mm.load_now()[0]}
    browser.close(); return r
def main():
    out = {'script': 'perf_load', 'rooms': A.rooms, 'tag': A.tag, 'extra': A.extra, 'repo': mm.REPO, 'commit': os.popen(f'git -C {mm.REPO} rev-parse --short HEAD').read().strip(), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'runs': []}
    mm.start_local(A.data)
    with sync_playwright() as p:
        for i in range(A.rounds): r = one(p); out['runs'].append(r); mm.say(f"{A.tag} {A.rooms}: {json.dumps(r)}")
    open(A.out, 'a').write(json.dumps(out) + '\n')
try: main()
finally: mm.stop()
