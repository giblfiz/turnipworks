#!/usr/bin/env python3
"""Who calls three.js: the same sampling profile as ablate.py, but each sample's time is charged to
  (a) the nearest caller OUTSIDE three.module.js (which part of the game asked three.js for the work), and
  (b) the outermost three.js entry under that caller (render / updateMatrixWorld / traverse ...),
so "three.js is 76% of the frame" becomes "the shadow pass is x, the AO pass is y, the main picture is z".
  python3 profile2.py --data <relay data dir> --rooms 203 [--view whole]
"""
import argparse, json, os, sys, time
import mm, layout
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--rooms', type=int, required=True); ap.add_argument('--out', default='results/profile2.jsonl'); ap.add_argument('--seconds', type=float, default=8); ap.add_argument('--views', default='default,whole'); ap.add_argument('--chains', default='', help='function names (comma separated): print the call chains that reach them'); ap.add_argument('--perf', default='', help='tw.perf switches, k=0/1 comma separated, set before profiling')
A = ap.parse_args()
B = [json.loads(l) for l in open(__import__('os').environ.get('BUILD_JSONL', 'results/build.jsonl'))]; B = [b for b in B if b.get('counts', {}).get('room') == A.rooms][-1]
ext = B['extent']; rs, lots = layout.rooms(B['asked']); C_BLD = (lots[0]['x'] + 40, lots[0]['z'] + 22); SPAN = max(ext['w'], ext['d']); CEN = (ext['cx'], ext['cz'])
def base(u): return os.path.basename(u.split('?')[0]) or '(native)'
def analyse(pr, frames):
    nodes = {n['id']: n for n in pr['nodes']}; parent = {}
    for n in pr['nodes']:
        for c in n.get('children', []): parent[c] = n['id']
    self_us = {}
    for nid, dt in zip(pr['samples'], pr['timeDeltas']): self_us[nid] = self_us.get(nid, 0) + dt
    total = sum(self_us.values()); by_caller = {}; by_entry = {}; passes = {}; by_leaf = {}; chains = {}
    for nid, us in self_us.items():
        chain = []; x = nid
        while x is not None: chain.append(nodes[x]['callFrame']); x = parent.get(x)
        # chain[0] = the function running; walk outward
        leaf = chain[0]; f0 = base(leaf['url'])
        if leaf['functionName'] in ('(idle)', '(program)', '(garbage collector)'): key = leaf['functionName']; entry = key; ps = key
        else:
            caller = next((c for c in chain if base(c['url']) not in ('three.module.js', '(native)')), None)
            key = f"{caller['functionName'] or '(anonymous)'} {base(caller['url'])}:{caller['lineNumber'] + 1}" if caller else '(three only)'
            three = [c for c in chain if base(c['url']) == 'three.module.js']
            idx = chain.index(caller) if caller else len(chain)
            inner = [c for c in chain[:idx] if base(c['url']) == 'three.module.js']
            entry = (f"{inner[-1]['functionName']} <- {key}") if inner else key
            # which pass: the outermost game/library frames (file names) on the stack, outermost first
            files = []
            for c in reversed(chain):
                b = base(c['url'])
                if b in ('three.module.js', '(native)', '') or b in files: continue
                files.append(b)
            ps = ' > '.join(files[:4])
        for d, k in ((by_caller, key), (by_entry, entry), (passes, ps)): d[k] = d.get(k, 0) + us
        for want in [w for w in A.chains.split(',') if w]:
            if any(c['functionName'] == want for c in chain[:3]):
                ck = want + ' <= ' + ' < '.join(f"{c['functionName'] or '(anon)'}:{c['lineNumber'] + 1}" for c in chain[:9]); chains[ck] = chains.get(ck, 0) + us
        lk = f"{leaf['functionName'] or '(anonymous)'} {base(leaf['url'])}:{leaf['lineNumber'] + 1}"; by_leaf[lk] = by_leaf.get(lk, 0) + us  # where the time is actually spent (self time), whoever asked
    top = lambda d, n: [[k, round(us / 1000 / frames, 2), round(us / total * 100, 1)] for k, us in sorted(d.items(), key=lambda x: -x[1])[:n]]
    return {'frames': frames, 'ms_per_frame': round(total / 1000 / frames, 1), 'by_nearest_game_caller': top(by_caller, 22), 'by_three_entry': top(by_entry, 26), 'by_stack_of_files': top(passes, 22), 'by_leaf': top(by_leaf, 40), 'chains': top(chains, 14)}
mm.start_local(A.data)
try:
    with sync_playwright() as p:
        browser, ctx, pg, errors, t = mm.open_game(p, token=B['token'])
        pg.evaluate(mm.cam_js(*C_BLD, 110)); mm.wait_settled(pg, timeout=3600); pg.wait_for_timeout(3000)
        out = {'script': 'profile2', 'rooms': A.rooms, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
        out['gl_limits'] = pg.evaluate("(() => { const gl = document.querySelector('#c').getContext('webgl2'); return { MAX_FRAGMENT_UNIFORM_VECTORS: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS), MAX_VERTEX_UNIFORM_VECTORS: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE) }; })()")
        if A.perf: pg.evaluate('(p) => tw.perf.set(p)', dict((k, v not in ('0', 'false', 'off')) for k, v in (kv.split('=') for kv in A.perf.split(',')))); pg.wait_for_timeout(2500)
        for name, c, dist in (('default', C_BLD, 110), ('whole', CEN, max(110, SPAN * 1.15))):
            if name not in A.views.split(','): continue
            pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); }})()"); pg.evaluate(mm.cam_js(c[0], c[1], dist)); pg.mouse.move(5, 5); pg.wait_for_timeout(3000); mm.wait_gpu_quiet(timeout=40)
            cdp = ctx.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 500}); cdp.send('Profiler.start')
            f0 = pg.evaluate('tw.stats.frames'); pg.wait_for_timeout(A.seconds * 1000); f1 = pg.evaluate('tw.stats.frames')
            pr = cdp.send('Profiler.stop')['profile']; cdp.detach(); out[name] = analyse(pr, max(1, f1 - f0)); out[name]['others_gpu_after'] = mm.others_gpu()
            # how many times the whole scene is rendered / walked per frame
        out['renders_per_frame'] = pg.evaluate("""() => new Promise(res => { const w = tw.worldOf(tw.area()), s = w.scene; let umw = 0, trav = 0; const f0 = tw.stats.frames;
          const u = s.updateMatrixWorld, t = s.traverse, tv = s.traverseVisible; let travV = 0;
          s.updateMatrixWorld = function (...a) { umw++; return u.apply(this, a); }; s.traverse = function (...a) { trav++; return t.apply(this, a); }; s.traverseVisible = function (...a) { travV++; return tv.apply(this, a); };
          setTimeout(() => { delete s.updateMatrixWorld; delete s.traverse; delete s.traverseVisible; const n = Math.max(1, tw.stats.frames - f0); res({ frames: n, scene_updateMatrixWorld_per_frame: +(umw / n).toFixed(2), scene_traverse_per_frame: +(trav / n).toFixed(2), scene_traverseVisible_per_frame: +(travV / n).toFixed(2) }); }, 6000); })""")
        browser.close()
    open(A.out, 'a').write(json.dumps(out) + '\n')
    for name in A.views.split(','):
        x = out[name]; print('\n==', name, x['frames'], 'frames', x['ms_per_frame'], 'ms/frame')
        for k in ('by_stack_of_files', 'by_nearest_game_caller', 'by_three_entry', 'by_leaf', 'chains'):
            print(' --', k)
            for a, b, c in x[k]: print(f'   {b:8.2f} ms  {c:5.1f}%  {a}')
    print(out['renders_per_frame'], out['gl_limits'])
finally: mm.stop()
