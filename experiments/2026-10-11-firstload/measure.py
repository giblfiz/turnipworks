#!/usr/bin/env python3
"""First load, with the room's pieces counted (2026-10-11): when does the loading screen leave, and when does what it
uncovers look right?

  python3 experiments/2026-10-11-firstload/measure.py [--live URL] [--n 3] [--net]
  TW_LOAD_REPO=<checkout to serve>  (default: this one; the main checkout before the merge is "before")
  --net   local only: the browser's network held to 20 Mbit/s down, 40 ms a request (Chromium's own throttle), so the
          meshes take a while to arrive as they do from the live site

Two cases, each a cold browser context:
  join    one inn (5 rooms) under the opening camera, an old campaign (?nointro)
  new     an empty new campaign, the intro plays: its phantom builds the first common room
Printed per load (ms from navigation): first real frame, loading screen gone, the view's meshes all in, how many grey
stand-ins were in view when the screen left; for `new`: the phantom's room arrived, its spawn began (it waits for its
meshes), and the wait between the two.
"""
import argparse, json, os, statistics, sys, time, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), '2026-10-07-loading')); import stack  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402
stack.tw_sandbox.remove_campaigns()
ap = argparse.ArgumentParser(); ap.add_argument('--live'); ap.add_argument('--n', type=int, default=3); ap.add_argument('--net', action='store_true'); ap.add_argument('--faces', default=''); ap.add_argument('--only', default='')
A = ap.parse_args()
INN = [('common', 0, 0, 6, 5), ('kitchen', 6, 0, 4, 5), ('guest', 0, 5, 5, 4), ('guest', 5, 5, 5, 4), ('yard', 10, 0, 6, 9)]

PROBE = r"""(() => { if (window.__fl) return; const P = window.__fl = { t: {}, standins: null, intro: {} };
  const mark = (k) => { if (P.t[k] == null) P.t[k] = Math.round(performance.now()); };
  let fr, m4, v3;
  const left = (tw) => { const w = tw.worlds.get(tw.main.area), c = tw.main.camera, T = tw.THREE; if (!w?.loaded || !T) return null;
    fr ||= new T.Frustum(); m4 ||= new T.Matrix4(); v3 ||= new T.Vector3(); fr.setFromProjectionMatrix(m4.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse));
    const seen = (x, y, z) => fr.containsPoint(v3.set(x, y, z)); let n = 0;
    for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.url && !r.asleep && r.visual?.userData?.placeholder && seen(r.entity.x, r.entity.y || 0, r.entity.z)) n++;
    for (const s of w.shell.values()) if (!s.asleep && s.visual?.userData?.placeholder && seen(s.spec.x, s.spec.y || 0, s.spec.z)) n++;
    return n; };
  setInterval(() => { const tw = window.tw, L = window.twLoad; if (!tw?.ready?.() || !tw.main) return;
    if (tw.lastRenders?.some(r => r.view === 'main')) mark('frame1'); else return;
    const n = left(tw);
    if (L && (L.left || L.hiddenAt) && P.t.gone == null) { mark('gone'); P.standins = n; P.hold = tw.loadHold || null; }
    if (!L && P.t.gone == null) { mark('gone'); P.standins = n; } // (a client from before the loading screen)
    if (n === 0 && P.t.frame1 != null) mark('view_in');
    const I = tw.intro; if (!I) return;
    if (I.room && tw.entities()[I.room]) { mark('room'); const w = tw.worlds.get(tw.main.area), ep = w.lastEpisode;
      if (ep && ep.dir === 'in' && !ep.loading && P.t.spawn == null) { mark('spawn'); P.intro = { loadMs: ep.loadMs ?? 0, n: ep.n, total: Math.round(ep.total) }; } }
    if (I.info().state !== 'idle') P.intro.state = I.info().state;
  }, 20);
})()"""

def run(pw, url, intro, net):
    b = pw.chromium.launch(args=stack.GPU); ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    logs = []; page.on('console', lambda m: logs.append(m.text) if m.text.startswith('tw load') else None)
    reqs = {'n': 0, 'bytes': 0}
    def fin(r):
        try: reqs['n'] += 1; reqs['bytes'] += r.sizes()['responseBodySize']
        except Exception: pass
    page.on('requestfinished', fin)
    if net:
        cdp = ctx.new_cdp_session(page); cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 40, 'downloadThroughput': 20e6 / 8, 'uploadThroughput': 5e6 / 8})
    page.add_init_script(PROBE); page.goto(url)
    t0 = time.time(); done = False
    while time.time() - t0 < 90:
        r = page.evaluate('window.__fl || null')
        if r and r['t'].get('gone') is not None and r['t'].get('view_in') is not None and (not intro or r['t'].get('spawn') is not None or r['intro'].get('state') == 'failed'):
            done = True; break
        page.wait_for_timeout(100)
    r = page.evaluate('window.__fl'); r['req'] = dict(reqs); r['line'] = logs[-1] if logs else ''; r['done'] = done
    b.close(); return r

def main():
    live = A.live.rstrip('/') if A.live else None
    if not live: stack.start_local()
    relay = (live + '/api/tw-relay') if live else stack.RELAY
    rows = []
    try:
        with sync_playwright() as pw:
            faces = f'&faces={A.faces}' if A.faces else ''
            base = (f'{live}/?x=1' if live else f'http://127.0.0.1:{stack.SP}/engine/client/index.html?relay=' + urllib.parse.quote(stack.RELAY)) + faces
            for case in ('join', 'new'):
                if A.only and case not in A.only: continue
                for i in range(A.n):
                    c = stack.make_campaign(relay, f'TEST firstload {case} {i} (throwaway)')
                    if case == 'join':
                        for k, (t, x, z, w, d) in enumerate(INN):
                            stack.get(f"{relay}/c/{c['campaign']}/a/{c['area']}/do?" + urllib.parse.urlencode({'cmd': 'room.spawn', 'type': t, 'x': (x - 8) * 5, 'z': (z - 8) * 5, 'w': w * 5, 'd': d * 5, 'seed': 9000 + k, 'nonce': f'm{i}{k}', 'seat': c['token']}))
                    r = run(pw, base + ('&nointro' if case == 'join' else '') + f"#s={c['token']}", case == 'new', A.net and not live)
                    t = r['t']; row = {'case': case, 'frame1': t.get('frame1'), 'gone': t.get('gone'), 'view_in': t.get('view_in'), 'standins_at_gone': r['standins'], 'room': t.get('room'), 'spawn': t.get('spawn'), 'room_wait': (t['spawn'] - t['room']) if t.get('spawn') and t.get('room') else None, 'intro': r['intro'], 'hold': r.get('hold'), 'req': r['req'], 'done': r['done'], 'line': r['line']}
                    rows.append(row); print(json.dumps(row), flush=True)
        for case in ('join', 'new'):
            rs = [r for r in rows if r['case'] == case]
            if not rs: continue
            med = lambda k: (lambda v: round(statistics.median(v)) if v else None)([r[k] for r in rs if r[k] is not None])
            print(f"MEDIAN {case}: first frame {med('frame1')}, screen gone {med('gone')}, view's meshes in {med('view_in')}, stand-ins in view when the screen left {med('standins_at_gone')}" + (f", phantom's room arrived {med('room')}, its spawn began {med('spawn')} (waited {med('room_wait')} ms for meshes)" if case == 'new' else ''))
    finally:
        if not live: stack.stop()
main()
