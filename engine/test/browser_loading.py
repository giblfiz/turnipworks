#!/usr/bin/env python3
"""The loading screen (docs/UI.md "The loading screen"): the first load, the failures, travelling, reconnecting.

  python3 engine/test/browser_loading.py            (Chromium on the GPU)
  TW_BROWSER=firefox ... browser_loading.py                                                 (Firefox, a window on Xvfb)
  --live https://turnipworks.net/     the checks that need no local relay, on the deployed game (one throwaway campaign)
  --only A,C  --shots                TW_PORTS=relay,site (default 18235,18865)

What a test can and cannot see of the compositor: a screenshot is what the compositor shows, so the bar's drawn length
and the mark's pixels are measured from screenshots taken WHILE the page's main thread is in a busy loop (section D).
A whole-browser (GPU process) stall cannot be produced or seen from a test; nothing here claims motion through one.
"""
import argparse, io, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--live'); ap.add_argument('--only', default=''); ap.add_argument('--shots', action='store_true')
A = ap.parse_args()
FIREFOX = os.environ.get('TW_BROWSER', '').lower() == 'firefox'; ENG = 'firefox' if FIREFOX else 'chromium'
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18235,18865').split(','))
RELAY = f'http://127.0.0.1:{RP}'; API = 'http://127.0.0.1:8096'
SLOW = 3 if FIREFOX else 1  # Firefox draws with software GL here: every wait is longer
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)
def want(sec): return not A.only or sec in A.only.split(',')

def relay_start(data):
    pr = subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT)
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'{RELAY}/health', timeout=1); break
        except Exception: pass
    return pr
def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-load-'); site = tempfile.mkdtemp(prefix='tw-load-site-'); tmp.extend([data, site])  # removed at exit: /tmp is RAM
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    procs.append(relay_start(data))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return data
def stop():
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for pr in procs:
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

UA = {'User-Agent': 'Mozilla/5.0 tw-loading-test'}
def get(url): return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read())
INN = [('common', 0, 0, 6, 5), ('kitchen', 6, 0, 4, 5), ('guest', 0, 5, 5, 4), ('guest', 5, 5, 5, 4), ('yard', 10, 0, 6, 9)]  # one inn under the opening camera
def make_campaign(relay, name, rooms=INN):
    c = json.loads(urllib.request.urlopen(urllib.request.Request(f'{relay}/campaigns', data=json.dumps({'name': name, 'gm': 'Fauna-loading'}).encode(), method='POST', headers=UA), timeout=30).read())
    assert c.get('ok'), c
    if '127.0.0.1' not in relay: tw_sandbox._made.append((relay, c['campaign'], c['token'], name))  # removed at exit
    build(relay, c, c['area'], rooms, 'a')
    return c
def build(relay, c, area, rooms, tag):
    for i, (t, x, z, w, d) in enumerate(rooms):
        q = {'cmd': 'room.spawn', 'type': t, 'x': (x - 8) * 5, 'z': (z - 8) * 5, 'w': w * 5, 'd': d * 5, 'seed': 9000 + i, 'nonce': f'{tag}{i}', 'seat': c['token']}
        get(f"{relay}/c/{c['campaign']}/a/{area}/do?" + urllib.parse.urlencode(q))

# from before the page's first script: a log of what the loading screen did, and when the first real frame was drawn
PROBE = r"""(() => { if (window.__ld) return; const P = window.__ld = { s: [], says: [], frame1: null, gaps: [], t0: performance.now() };
  let last = performance.now(), mo = null;
  setInterval(() => { const now = performance.now(); if (now - last > 80) P.gaps.push([Math.round(last), Math.round(now - last)]); last = now;
    const L = window.twLoad, el = document.getElementById('twl'); if (!L || !el) return;
    if (!mo) { const sr = el.querySelector('[aria-live]'); mo = new MutationObserver(() => P.says.push([Math.round(performance.now()), sr.textContent])); mo.observe(sr, { childList: true, characterData: true, subtree: true }); if (sr.textContent) P.says.push([0, sr.textContent]); }
    // done() records the instant the fade starts; the final progress plan remains visible through that fade.
    const shown = L.shown(); if (shown || (L.left?.mode === 'load' && !el.hidden)) P.s.push([Math.round(now), +L.bar().toFixed(4), L.barDrawn(), shown, L.mode]);
    const tw = window.tw; if (P.frame1 == null && tw && tw.ready && tw.ready() && tw.lastRenders && tw.lastRenders.some(r => r.view === 'main')) { P.frame1 = Math.round(now); P.shownAtFrame1 = shown; }
    // the moment the screen is told to leave: how many grey stand-ins are under the camera (counted here, not by the game)
    if (P.leave == null && L.left && L.left.mode === 'load' && tw && tw.main && tw.THREE) { const w = tw.worlds.get(tw.main.area), c = tw.main.camera, T = tw.THREE, fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)), v = new T.Vector3(); let n = 0, all = 0;
      for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.url && !r.asleep) { all++; if (r.visual?.userData?.placeholder && fr.containsPoint(v.set(r.entity.x, r.entity.y || 0, r.entity.z))) n++; }
      for (const s of w.shell.values()) if (!s.asleep) { all++; if (s.visual?.userData?.placeholder && fr.containsPoint(v.set(s.spec.x, s.spec.y || 0, s.spec.z))) n++; }
      P.leave = { standins: n, things: all, at: Math.round(now), hold: tw.loadHold || null }; }
    last = performance.now(); }, 16); })()"""

def lum_stats(png):
    from PIL import Image
    import numpy as np
    im = np.asarray(Image.open(io.BytesIO(png)).convert('RGB')).astype(int); lum = im.mean(axis=2)
    return {'mean': round(float(lum.mean()), 1), 'dark_share': round(float((lum < 30).mean()), 3), 'im': im}
def bar_drawn(im, box):
    """the drawn length of the bar's gold fill as a share of its track, from the pixels of a screenshot"""
    import numpy as np
    y = int(box['y'] + box['height'] / 2); x0 = int(box['x']); x1 = int(box['x'] + box['width'])
    row = im[y, x0:x1]; gold = (abs(row[:, 0] - 0xe0) < 40) & (abs(row[:, 1] - 0xb0) < 40) & (abs(row[:, 2] - 0x4a) < 50)
    return float(gold.mean())

def main():
    live = A.live.rstrip('/') if A.live else None
    data = None if live else start_local()
    relay = (live + '/api/tw-relay') if live else RELAY
    def url(token=None, extra=''):
        base = (f'{live}/?nointro&faces=1500{extra}' if live else f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&nointro&faces=1500' + extra)
        return base + (f'#s={token}' if token else '')
    os.makedirs(SHOTS, exist_ok=True)
    c = make_campaign(relay, 'TEST loading (throwaway)')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=GPU)
        def page(scheme='dark', vw=1280, vh=800, **kw):
            ctx = browser.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1, color_scheme=scheme, **kw); pg = ctx.new_page(); pg.set_default_timeout(60000 * SLOW)
            pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200])); pg.logs = []; pg.on('console', lambda m: pg.logs.append(m.text[:400]))
            pg.add_init_script(PROBE)
            if not live: tw_sandbox.proxy(pg, API)
            return ctx, pg
        def shot(pg, name):
            png = pg.screenshot(type='png')
            if A.shots or True: open(os.path.join(SHOTS, f'loading-{ENG}-{name}.png'), 'wb').write(png)
            return png
        def ready(pg, timeout=90000): pg.wait_for_function('window.tw && tw.ready && tw.ready() && window.__ld.frame1 != null && !!twLoad.left', timeout=timeout * SLOW)  # (the first real frame is drawn AND the screen has been told to leave: since 2026-10-11 it waits for the view's pieces)

        # ---------- A. painted before any script has arrived; says so when the scripts never come ----------
        if want('A'):
            print('A. the first paint')
            ctx, pg = page()
            held = []; pg.route('**/*', lambda r: held.append(r) if (r.request.resource_type in ('script', 'stylesheet', 'font') or '.js' in r.request.url) else r.continue_())
            t0 = time.time(); pg.goto(url(c['token']), wait_until='commit'); pg.wait_for_selector('#twl .twl-name', state='visible'); t_seen = time.time() - t0
            try: pg.wait_for_function("performance.getEntriesByType('paint').length > 0", timeout=5000)  # (the entry is reported a little after the paint itself)
            except Exception: pass
            pg.wait_for_timeout(300)
            st = pg.evaluate("""() => { const el = document.getElementById('twl'), r = el.getBoundingClientRect(), cs = getComputedStyle(el), m = el.querySelector('.twl-mark').getBoundingClientRect();
              return { w: r.width, h: r.height, bg: cs.backgroundImage.slice(0, 40), name: el.querySelector('.twl-name').textContent, words: el.querySelector('.twl-words').textContent, mark: [m.width, m.height], paints: performance.getEntriesByType('paint').map(e => [e.name, Math.round(e.startTime)]),
                scriptsDone: performance.getEntriesByType('resource').filter(e => /\\.(js|css)(\\?|$)/.test(e.name) && e.responseEnd > 0).length, sr: el.querySelector('[aria-live]').textContent, lives: document.querySelectorAll('#twl [aria-live]').length, theme: document.documentElement.dataset.theme }; }""")
            check(st['w'] >= 1270 and st['h'] >= 790 and st['name'] == 'Turnip Works' and st['words'] == 'Fetching the game', 'A1 with every script, stylesheet and font held back, the screen is up: the name, the mark, "Fetching the game"', {k: st[k] for k in ('name', 'words', 'mark')})
            check(len(held) >= 2 and st['scriptsDone'] == 0, 'A2 no script or stylesheet had answered when it was up', f"{len(held)} held, {st['scriptsDone']} answered, seen after {t_seen * 1000:.0f} ms")
            check(any(n == 'first-contentful-paint' for n, _ in st['paints']), 'A3 the browser reports a first contentful paint with the scripts still held', st['paints'])
            png = None  # (Playwright's own screenshot waits for the fonts, which wait for the held stylesheet: Chromium is asked directly.
            try:        #  Firefox under the driver gives no picture at all while a script of the page is still on its way: A3 stands for it there)
                if FIREFOX: print('  NOT VERIFIED A4 in Firefox: the driver takes no screenshot while scripts are held back (A3, the browser\'s own paint record, is the evidence; B1 has pictures through a whole load)', flush=True)
                else:
                    import base64; png = base64.b64decode(ctx.new_cdp_session(pg).send('Page.captureScreenshot', {'format': 'png'})['data'])
            except Exception as e: check(False, 'A4 a screenshot with the scripts held', str(e)[:80])
            if png:
                open(os.path.join(SHOTS, f'loading-{ENG}-first-paint.png'), 'wb').write(png); s = lum_stats(png)
                check(s['mean'] > 40 and s['dark_share'] < 0.2, 'A4 that picture is the house colour, not black', f"mean brightness {s['mean']} of 255, {s['dark_share']:.0%} near-black")
            check(st['lives'] == 1 and st['sr'] == 'Turnip Works is loading', 'A5 one polite live region, holding one line', st['sr'])
            ctx.close()
            # the same in a light-scheme browser: the theme is set before the first paint (it used to flash dark, then light)
            ctx, pg = page(scheme='light'); held2 = []; pg.route('**/*', lambda r: held2.append(r) if r.request.resource_type in ('script',) else r.continue_())
            pg.goto(url(c['token']), wait_until='commit'); pg.wait_for_selector('#twl .twl-name', state='visible')
            check(pg.evaluate('document.documentElement.dataset.theme') == 'light', 'A6 a light-scheme browser has the light theme before any script arrives')
            ctx.close()

        # ---------- B. a whole load: no black frame, the bar, leaving with the first real frame ----------
        if want('B'):
            print('B. a whole load, three times in one browser (the third knows how long this table takes)')
            ctx, pg = page(); films = []; logs = []
            for n in range(3):
                if n: pg.close(); pg = ctx.new_page(); pg.add_init_script(PROBE); pg.set_default_timeout(60000 * SLOW); pg.errs = []; pg.logs = []; pg.on('console', lambda m, pg=pg: pg.logs.append(m.text[:400])); pg.on('pageerror', lambda e, pg=pg: pg.errs.append(str(e)[:200])); tw_sandbox.proxy(pg, API) if not live else None  # (a new tab of the same browser: what it remembered is kept)
                film = []; t0 = time.time()
                pg.goto(url(c['token']), wait_until='commit')
                while time.time() - t0 < 60 * SLOW:
                    a = time.time()
                    try: film.append((round((a - t0) * 1000), pg.screenshot(type='png', timeout=10000)))
                    except Exception: pass
                    try:
                        if pg.evaluate('window.__ld && __ld.frame1 != null && window.twLoad && !twLoad.shown() && document.getElementById("twl").hidden'): break
                    except Exception: pass
                film.append((round((time.time() - t0) * 1000), pg.screenshot(type='png')))
                ld = pg.evaluate('({ leave: __ld.leave, s: __ld.s, frame1: __ld.frame1, shownAtFrame1: __ld.shownAtFrame1, says: __ld.says, gaps: __ld.gaps, T: twLoad.times, left: twLoad.left, stall: twLoad.stall, creep: twLoad.creep, log: twLoad.log, hiddenAt: twLoad.hiddenAt, words: twLoad.words })')
                if not ld['left']:  # (it never left: say why instead of tripping over it below)
                    check(False, f'B0.{n + 1} the screen left within {60 * SLOW} s', pg.evaluate("JSON.stringify({ T: twLoad.times, failed: twLoad.failed, mode: twLoad.mode, hold: window.tw && tw.loadHold, frames: window.tw && tw.stats.frames, status: window.tw && tw.sync && tw.sync.status, unsettled: window.tw && tw.main && tw.worlds.get(tw.main.area)?.unsettled(tw.main.camera) })") + ' ' + str(pg.errs[:3])); ld['left'] = {'bar': 0}; ld['T'].setdefault('frame', 0); ld['T'].setdefault('first', 0); ld['T'].setdefault('state', 0)
                films.append((film, ld)); pg.wait_for_timeout(300); logs += [l for l in pg.logs if l.startswith('tw load:')]
            for n, (film, ld) in enumerate(films):
                stats = [lum_stats(png) for _, png in film]
                worst = min(stats, key=lambda s: s['mean'])
                check(all(s['mean'] > 35 and s['dark_share'] < 0.5 for s in stats), f'B1.{n + 1} no black frame in {len(film)} screenshots through the load', f"darkest: mean {worst['mean']} of 255, {worst['dark_share']:.0%} near-black (before this work: 24, 100%)")
            for n, (film, ld) in enumerate(films):
                vals = [s[1] for s in ld['s'] if s[4] == 'load' and s[3]]; drawn = [s[2] for s in ld['s'] if s[4] == 'load' and s[3] and s[2] is not None]
                back = max([a - b for a, b in zip(vals, vals[1:])] or [0]); backd = max([a - b for a, b in zip(drawn, drawn[1:])] or [0])
                check(back <= 1e-6 and backd <= 0.004, f'B2.{n + 1} the bar never goes backwards', f'{len(vals)} samples; largest step back: planned {back:.4f}, drawn {backd:.4f}')
                top = ld['stall'] + ld['creep']
                check(max(vals or [0]) <= top + 1e-3 and top <= 0.8401 and 0.70 <= ld['stall'] <= 0.80, f'B3.{n + 1} the bar never passes the stall band (70 to 84%): it is never in the nineties', f"stall point {ld['stall']:.3f}, highest value {max(vals or [0]):.3f}, left at {ld['left']['bar']:.3f}")
                lv = ld['leave'] or {}; hold = lv.get('hold') or {}
                check(ld['frame1'] is not None and ld['T']['frame'] >= ld['frame1'] - 60 and lv.get('standins') == 0 and lv.get('things', 0) > 300 and hold.get('pieces', 0) > 100 and not hold.get('capped'), f'B4.{n + 1} the screen stays past the first real frame until every piece under the camera is in: no grey stand-in is in view when it leaves', f"first real frame {ld['frame1']} ms, told to leave at {ld['T']['frame']} ms; {lv.get('standins')} stand-ins of {lv.get('things')} things in view; waited for {hold.get('pieces')} pieces")
            film, ld = films[2]
            at_state = [s[1] for s in ld['s'] if s[0] <= ld['T']['state']]; at_state = at_state[-1] if at_state else None
            fade = [s for s in ld['s'] if ld['T']['frame'] <= s[0] <= ld['T']['frame'] + 200 and s[2] is not None]
            fade_peak = max((s[2] for s in fade), default=0)
            check(at_state is not None and ld['left']['bar'] > at_state and fade_peak >= 0.70 and fade_peak <= 0.8401 and ld['left']['bar'] <= 0.8401,
                  'B5 third load of the same table: piece progress carries the bar through the freeze, and its visible fade reaches the 70 to 84% stall band',
                  f"at state {at_state}, fade began {ld['left']['bar']}, visible fade peaked {fade_peak:.3f} in {len(fade)} samples; {ld['T']['frame'] - ld['T']['state']} ms from state to the full frame")
            early = [l for l in ld['log'] if l[0] < ld['T']['first']]; late = [l for l in ld['log'] if l[0] >= ld['T']['first']]; wait = max(1, ld['T']['frame'] - ld['T']['first'])
            check(len(early) <= 6 and len(late) <= 3 + wait / 250, 'B6 few plans: the compositor is handed the way to the first frame in one piece when the code starts, then one per step of the pieces arriving (at most four a second)', f"{len(early)} plan(s) before the first frame, {len(late)} in the {wait} ms of pieces after it")
            says = [t for _, t in ld['says']]
            check(len(says) <= 4 and 'Opening your table' in says and says[-1] == '', 'B7 the screen reader hears a few lines, not a stream', says)
            check(ld['words'] == ['Fetching the game', 'Opening your table', 'Setting out the room'], 'B8 the words under the bar, in ordinary language', ld['words'])
            log = logs
            check(len(log) == 3 and 'first frame at' in log[-1] and "the room's pieces" in log[-1] and 'screen left at' in log[-1], 'B9 the console says the real milliseconds', log[-1] if log else pg.logs[-3:])
            pg.wait_for_timeout(500)
            gone = pg.evaluate("({ hidden: document.getElementById('twl').hidden, hit: document.elementFromPoint(640, 400)?.id, after: twLoad.hiddenAt - twLoad.times.frame, mem: localStorage.getItem('tw.load') })")
            check(gone['hidden'] and gone['hit'] != 'twl', 'B10 it is gone (not merely see-through), and a click reaches the table', gone)
            check(not pg.errs, 'B11 no page errors', pg.errs[:3])
            ctx.close()

        # ---------- C. it never sits on a ready table; it is never in the way of the pointer ----------
        if want('C'):
            print('C. never on top of a ready table')
            ctx, pg = page(); pg.goto(url(c['token'])); ready(pg)
            t = pg.evaluate("""() => new Promise(done => { const out = []; let n = 0; const f = () => { const el = document.getElementById('twl'); out.push([el.hidden, +getComputedStyle(el).opacity, getComputedStyle(el).pointerEvents]); if (++n < 30) requestAnimationFrame(f); else done({ out, since: Math.round(performance.now() - twLoad.times.frame) }); }; requestAnimationFrame(f); })""")
            vis = [o for o in t['out'] if not o[0] and o[1] > 0.02]
            check(len(vis) <= 16 and all(o[2] == 'none' for o in t['out'] if not o[0]), 'C1 once the view\'s pieces are in the screen is fading or gone, and never takes the pointer', f"{len(vis)} of 30 frames still faintly visible, {t['since']} ms after it was told to leave")
            pg.wait_for_timeout(600 * SLOW)
            check(pg.evaluate("document.getElementById('twl').hidden"), 'C2 gone')
            ctx.close()

        # ---------- D. the motion runs while the main thread is blocked (measured from screenshots) ----------
        if want('D') and not live:
            print('D. the page frozen by a busy loop, the screen watched from outside')
            ctx, pg = page()
            pg.add_init_script("try { localStorage.setItem('tw.load', JSON.stringify({ toState: 9000, toLook: 300, roomLast: 4000, filesToCode: 66 })); } catch {}")
            pg.route('**/sse/**', lambda r: None)  # the table never answers: the screen stays up, its plan running
            pg.route('**/ws', lambda r: r.abort())
            pg.goto(url(c['token'], '&transport=sse'), wait_until='commit')
            pg.wait_for_function('window.twLoad && twLoad.times.look != null'); pg.wait_for_timeout(300)
            box = pg.evaluate("(() => { const r = document.querySelector('.twl-bar').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()")
            mbox = pg.evaluate("(() => { const r = document.querySelector('.twl-mark').getBoundingClientRect(); return [Math.floor(r.x) - 8, Math.floor(r.y) - 8, Math.ceil(r.right) + 8, Math.ceil(r.bottom) + 8]; })()")
            BLOCK = 2500; import numpy as np, base64
            frames = []  # (wall time received, png)
            if not FIREFOX:
                # Chromium: a screenshot waits for the main thread, so the page is watched through the screencast instead:
                # frames the compositor produced, handed over by the browser process
                cdp = ctx.new_cdp_session(pg)
                def on_frame(ev):
                    frames.append((time.time(), base64.b64decode(ev['data'])))
                    try: cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})
                    except Exception: pass
                cdp.on('Page.screencastFrame', on_frame); cdp.send('Page.startScreencast', {'format': 'png', 'everyNthFrame': 6})
            pg.wait_for_timeout(300)
            pg.evaluate(f"setTimeout(() => {{ window.__blk = [performance.now(), Date.now()]; const t = performance.now(); while (performance.now() - t < {BLOCK}); window.__blk.push(performance.now(), Date.now()); }}, 30)")
            if FIREFOX:
                time.sleep(0.2); t0 = time.time()
                while time.time() - t0 < (BLOCK - 600) / 1000:
                    try: png = pg.screenshot(type='png', timeout=BLOCK + 3000); frames.append((time.time(), png))
                    except Exception: pass
                    time.sleep(0.25)
            else: pg.wait_for_timeout(BLOCK + 400)  # (the driver keeps receiving frames while it waits)
            pg.wait_for_function('window.__blk && __blk.length === 4', timeout=BLOCK + 20000)
            if not FIREFOX: cdp.send('Page.stopScreencast')
            blk = pg.evaluate('__blk'); b0, b1 = blk[1] / 1000, blk[3] / 1000
            during = [(t, png) for t, png in frames if b0 + 0.15 < t < b1 - 0.1]
            if len(during) >= 2:
                ims = [lum_stats(png)['im'] for _, png in during]; sc = ims[0].shape[1] / 1280
                sbox = {k: v * sc for k, v in box.items()}; bars = [bar_drawn(im, sbox) for im in ims]
                x0, y0, x1, y1 = (int(v * sc) for v in mbox); markdiff = [float(np.abs(ims[i][y0:y1, x0:x1] - ims[i + 1][y0:y1, x0:x1]).mean()) for i in range(len(ims) - 1)]
                check(bars[-1] - bars[0] > 0.01 and all(b2 >= b1_ - 0.004 for b1_, b2 in zip(bars, bars[1:])), f'D1 the bar grew across {len(during)} pictures of the page taken while its main thread was blocked for {BLOCK} ms', [round(b, 3) for b in bars][:14])
                check(max(markdiff) > 0.5, 'D2 the mark moved between those pictures', [round(v, 2) for v in markdiff][:14])
                open(os.path.join(SHOTS, f'loading-{ENG}-during-freeze.png'), 'wb').write(during[-1][1])
            else:
                print(f'  NOT VERIFIED D1/D2: this browser handed over {len(during)} picture(s) of the page while its main thread was blocked ({len(frames)} in all), so motion during a blocked main thread is not shown by this test here', flush=True)
            # the same plan as the browser reports it afterwards: the animation's own clock ran through the block
            v = pg.evaluate('({ planned: twLoad.bar(), drawn: twLoad.barDrawn(), running: document.querySelector(".twl-fill").getAnimations().map(a => a.playState), mark: getComputedStyle(document.querySelector(".twl-mark")).animationName })')
            check(v['running'] == ['running'] and v['mark'] == 'twl-sway', 'D3 one running compositor animation on the bar (transform), one on the mark (transform)', v)
            ctx.close()

        # ---------- E. failures: a sentence and the one useful thing to do ----------
        if want('E'):
            print('E. failures')
            ctx, pg = page(); pg.goto(url('tw1.bogus.token'), wait_until='commit')
            pg.wait_for_selector('#twl.failed', timeout=30000 * SLOW); f = pg.evaluate("({ why: document.querySelector('.twl-why').textContent, btn: document.querySelector('.twl-fail button').textContent, sr: document.querySelector('#twl [aria-live]').textContent, bar: getComputedStyle(document.querySelector('.twl-bar')).display, kind: twLoad.failed })")
            check(f['kind'] == 'denied' and 'invite link' in f['why'] and f['btn'] == 'Start a campaign of your own' and f['bar'] == 'none' and f['sr'] == f['why'], 'E1 a link that opens no table: the sentence, read out once, the bar gone', f)
            shot(pg, 'fail-link'); pg.click('.twl-fail button'); pg.wait_for_selector('#newCampaign button', state='visible')
            check('#s=' not in pg.url and pg.evaluate("document.getElementById('twl').hidden"), 'E2 its button leads to the start form')
            ctx.close()
            ctx, pg = page(); pg.route('**/main.js*', lambda r: r.abort()); pg.goto(url(c['token']), wait_until='commit')
            pg.wait_for_selector('#twl.failed', timeout=20000 * SLOW); f = pg.evaluate("({ why: document.querySelector('.twl-why').textContent, btn: document.querySelector('.twl-fail button').textContent, kind: twLoad.failed })")
            check(f['kind'] == 'code' and 'did not finish downloading' in f['why'] and f['btn'] == 'Try again', 'E3 the game did not arrive: says so, offers Try again', f)
            ctx.close()
            ctx, pg = page(); pg.add_init_script("HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, { apply: (t, me, a) => /webgl/.test(a[0]) ? null : Reflect.apply(t, me, a) });")
            pg.goto(url(c['token']), wait_until='commit'); pg.wait_for_selector('#twl.failed', timeout=40000 * SLOW); f = pg.evaluate("({ why: document.querySelector('.twl-why').textContent, kind: twLoad.failed })")
            check(f['kind'] == 'webgl' and 'WebGL' in f['why'], 'E4 no WebGL: says so in a sentence', f)
            ctx.close()
            if not live:
                # the relay is down when the page opens; it comes back
                procs[0].terminate(); procs[0].wait(10)
                ctx, pg = page(); pg.goto(url(c['token']), wait_until='commit'); t0 = time.time()
                pg.wait_for_selector('#twl.failed', timeout=30000 * SLOW); f = pg.evaluate("({ why: document.querySelector('.twl-why').textContent, btn: document.querySelector('.twl-fail button').textContent, kind: twLoad.failed })")
                check(f['kind'] == 'relay' and 'cannot be reached' in f['why'] and f['btn'] == 'Try again now', f'E5 the relay is down: says so after {time.time() - t0:.1f} s, and keeps trying', f)
                png = shot(pg, 'fail-relay'); s = lum_stats(png); check(s['mean'] > 40, 'E6 the failure screen is the same house colour', s['mean'])
                bb = pg.evaluate("(() => { const r = document.querySelector('.twl-fail button').getBoundingClientRect(); return [r.width, r.height]; })()")
                check(bb[1] >= 44, 'E7 the button is finger-sized', bb)
                procs[0] = relay_start(data)
                ready(pg, 60000); pg.wait_for_timeout(500)
                check(pg.evaluate("document.getElementById('twl').hidden && twLoad.failed == null"), 'E8 the relay came back: the page opened by itself and the screen left')
                ctx.close()
            ctx, pg = page(); held = []; pg.add_init_script("(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 25000 ? 1500 : ms, ...a); })()")  # the 25 s patience, shortened
            pg.route('**/main.js*', lambda r: held.append(r)); pg.goto(url(c['token']), wait_until='commit')
            pg.wait_for_selector('#twl.failed', timeout=20000 * SLOW); f = pg.evaluate("({ why: document.querySelector('.twl-why').textContent, kind: twLoad.failed })")
            check(f['kind'] == 'slow' and 'longer than usual' in f['why'], 'E9 nothing arriving for a long while: says so instead of spinning for ever', f)
            ctx.close()

        # ---------- F. reduce motion, small screens, touch ----------
        if want('F'):
            print('F. reduce motion, a phone')
            for how in ('browser', 'setting'):
                kw = {'reduced_motion': 'reduce'} if how == 'browser' else {}
                ctx, pg = page(**kw); held = []
                if how == 'setting': pg.add_init_script("try { localStorage.setItem('tw.prefs', JSON.stringify({ reducedMotion: true })); } catch {}")
                pg.add_init_script("try { localStorage.setItem('tw.load', JSON.stringify({ toState: 6000, toLook: 300, roomLast: 3000, filesToCode: 66 })); } catch {}")
                pg.route('**/sse/**', lambda r: None); pg.route('**/ws', lambda r: r.abort())
                pg.goto(url(c['token'], '&transport=sse'), wait_until='commit'); pg.wait_for_function('window.twLoad && twLoad.times.code != null'); pg.wait_for_timeout(250)
                a = pg.evaluate("({ mark: getComputedStyle(document.querySelector('.twl-mark')).animationName, bar: twLoad.barDrawn() })"); pg.wait_for_timeout(700); b = pg.evaluate('twLoad.barDrawn()')
                check(a['mark'] == 'none' and b > a['bar'] + 0.005, f'F1 reduce motion ({how}): the mark is still, the bar still fills', f"mark animation {a['mark']}, bar {a['bar']:.3f} -> {b:.3f}")
                ctx.close()
            ctx, pg = page(vw=390, vh=844, has_touch=True); pg.route('**/sse/**', lambda r: None); pg.route('**/ws', lambda r: r.abort())
            pg.goto(url(c['token'], '&transport=sse'), wait_until='commit'); pg.wait_for_function('window.twLoad && twLoad.times.code != null'); pg.wait_for_timeout(400)
            g = pg.evaluate("(() => { const q = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }; return { bar: q('.twl-bar'), mark: q('.twl-mark'), name: q('.twl-name'), words: q('.twl-words'), sw: document.documentElement.scrollWidth, vw: innerWidth }; })()")
            fits = all(v[0] >= 16 and v[2] <= 390 - 16 and v[1] >= 0 and v[3] <= 844 for v in (g['bar'], g['mark'], g['name'], g['words'])) and g['sw'] <= g['vw']
            check(fits, 'F2 at phone width everything is on the screen with a margin, nothing scrolls sideways', g)
            shot(pg, 'phone'); ctx.close()
            ctx, pg = page(vw=740, vh=360, has_touch=True); pg.route('**/sse/**', lambda r: None); pg.route('**/ws', lambda r: r.abort())
            pg.goto(url(c['token'], '&transport=sse'), wait_until='commit'); pg.wait_for_function('window.twLoad && twLoad.times.code != null')
            g = pg.evaluate("(() => { const a = document.querySelector('.twl-mark').getBoundingClientRect(), b = document.querySelector('.twl-words').getBoundingClientRect(); return [Math.round(a.top), Math.round(b.bottom), innerHeight]; })()")
            check(g[0] >= 0 and g[1] <= g[2], 'F3 a phone on its side: it fits the height', g); ctx.close()

        # ---------- G. a slow network: the files move the bar ----------
        if want('G'):
            print('G. a slow network')
            ctx, pg = page()
            def slowly(r):
                time.sleep(0.012); r.fallback()  # (fallback, not continue: the house look must still come through the sandbox's own route, or the table is drawn in the dark built-in night look and reads as a black frame)
            pg.route('**/*', slowly)
            t0 = time.time(); film = []; pg.goto(url(c['token']), wait_until='commit')
            while time.time() - t0 < 120 * SLOW:
                try:
                    film.append(pg.screenshot(type='png', timeout=10000))
                    if pg.evaluate('window.__ld && __ld.frame1 != null && window.twLoad && !twLoad.shown() && document.getElementById("twl").hidden'): break
                except Exception: pass
            ld = pg.evaluate('({ s: __ld.s, T: twLoad.times, log: twLoad.log, left: twLoad.left, stall: twLoad.stall })')
            pre = [l for l in ld['log'] if l[0] < ld['T']['code']]
            check(len(pre) >= 2 and pre[-1][-1][1] > pre[0][-1][1], f"G1 while the code was fetched ({ld['T']['code']} ms) the bar followed the files that had arrived", [l[-1][1] for l in pre][:12])
            vals = [s[1] for s in ld['s'] if s[4] == 'load' and s[3]]
            check(all(b >= a - 1e-6 for a, b in zip(vals, vals[1:])) and max(vals) <= ld['stall'] + 0.041, 'G2 never backwards, never past the stall band', f"highest {max(vals):.3f}, left at {ld['left']['bar']}")
            stats = [lum_stats(png) for png in film]
            check(all(s['mean'] > 35 and s['dark_share'] < 0.5 for s in stats), f'G3 no black frame in {len(film)} screenshots', min(s['mean'] for s in stats))
            ctx.close()

        # ---------- H. the other waits: making a campaign, travelling, reconnecting ----------
        if want('H') and not live:
            print('H. making a campaign, travelling, the relay restarting')
            ctx, pg = page(); pg.goto(url()); pg.wait_for_selector('#newCampaign button', state='visible')
            check(pg.evaluate("document.getElementById('twl').hidden") and pg.evaluate("document.querySelector('#start img.mark').naturalWidth > 0"), 'H1 no seat in the link: the start form, with the mark, and no loading screen over it')
            pg.evaluate('window.__same = 1'); pg.fill('#newCampaign input[name=name]', 'TEST loading create (throwaway)'); pg.click('#newCampaign button')
            pg.wait_for_function("window.twLoad && (twLoad.shown() || (window.tw && tw.ready && tw.ready()))")
            first = pg.evaluate("({ shown: twLoad.shown(), words: twLoad.words, start: document.getElementById('start').hidden })")
            ready(pg); pg.wait_for_timeout(500)
            after = pg.evaluate("({ same: window.__same, hash: location.hash.slice(0, 3), hidden: document.getElementById('twl').hidden, navs: performance.getEntriesByType('navigation').length })")
            check(first['shown'] and first['words'][0] == 'Opening your table' and first['start'], 'H2 "Start a campaign": the form gives way to the loading screen, "Opening your table"', first)
            check(after['same'] == 1 and after['hash'] == '#s=' and after['hidden'], 'H3 the campaign opens in the same page (no second fetch of the game), and the screen leaves', after)
            ctx.close()
            # travelling to an area that is not loaded yet (the network slowed so that it takes more than a moment)
            ctx, pg = page(); pg.goto(url(c['token'], '&lag=450')); ready(pg); pg.wait_for_timeout(600)
            area2 = pg.evaluate("""() => new Promise(done => { const id = 'area_' + Math.random().toString(36).slice(2, 10); tw.sync.submit('area.create', { id, name: 'Second town' }); const iv = setInterval(() => { if (tw.sync.campaign.areas.some(a => a.id === id)) { clearInterval(iv); done(id); } }, 50); })""")
            build(RELAY, c, area2, INN, 'b')
            pg.evaluate(f"(() => {{ window.__tr = []; const iv = setInterval(() => {{ __tr.push([Math.round(performance.now()), twLoad.shown(), twLoad.mode, twLoad.words && twLoad.words[0], !!tw.sync.view('{area2}'), document.getElementById('twl').className]); }}, 16); tw.setMain('{area2}'); }})()")
            pg.wait_for_function(f"!!tw.sync.view('{area2}') && !twLoad.shown() && document.getElementById('twl').hidden", timeout=60000 * SLOW)
            tr = pg.evaluate('__tr'); up = [r for r in tr if r[1]]
            check(len(up) > 3 and up[0][2] == 'travel' and up[0][3] == 'Travelling to Second town' and up[0][5] == '', 'H4 travelling to an area not loaded yet: the same screen, "Travelling to Second town"', f"up for about {up[-1][0] - up[0][0] if up else 0} ms, from {up[0][0] - tr[0][0] if up else '-'} ms after asking")
            check(all(not r[4] for r in up[:-3]), 'H5 it is up only while there is nothing true to show (it leaves with the area\'s first frame)', [r[4] for r in up[-5:]])
            ctx.close()
            # the state arriving before any frame is drawn, and the first frame late (a slow machine, a big area): the screen
            # must not come up AFTER the area is drawn and stay (it did, in Firefox, before this check existed)
            ctx, pg = page(); pg.goto(url(c['token'])); ready(pg); pg.wait_for_timeout(800)
            ids = pg.evaluate("tw.sync.campaign.areas.map(a => a.id)"); stuck = []
            for n in range(6):
                to = ids[(n + 1) % 2]
                pg.evaluate(f"(() => {{ tw.setMain('{to}'); const t = performance.now(), ms = {[0, 150, 400, 600, 400, 30][n]}; while (performance.now() - t < ms); }})()")
                pg.wait_for_function(f"!!tw.sync.view('{to}') && tw.lastRenders.some(r => r.view === 'main' && r.area === '{to}')", timeout=60000 * SLOW); pg.wait_for_timeout(700 * SLOW)
                stuck.append(pg.evaluate("twLoad.shown() || !document.getElementById('twl').hidden"))
            check(not any(stuck), 'H5b six travels with the page busy for 0 to 600 ms right after asking: the screen is never left up over a drawn area', stuck)
            ctx.close()
            ctx, pg = page(); pg.goto(url(c['token'])); ready(pg); pg.wait_for_timeout(800)
            pg.evaluate("tw.setMain(tw.sync.campaign.areas[1].id)"); pg.wait_for_function("!!tw.sync.view(tw.main.area)"); pg.wait_for_timeout(600)
            # the relay restarts (every deploy does this)
            procs[0].terminate(); procs[0].wait(10)
            pg.wait_for_selector('#twl.pill', state='visible', timeout=15000)
            pill = pg.evaluate("(() => { const el = document.getElementById('twl'), r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { text: el.querySelector('.twl-words').textContent, sr: el.querySelector('[aria-live]').textContent, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), off: Math.round(Math.abs(r.left + r.width / 2 - innerWidth / 2)), pe: cs.pointerEvents, bar: getComputedStyle(el.querySelector('.twl-bar')).display, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.id }; })()")
            check(pill['text'] == 'The table is reconnecting…' and pill['sr'] == pill['text'], 'H6 the relay stops: a pill says "The table is reconnecting…" (and the screen reader, once)', pill['text'])
            clear = pg.evaluate("(() => { const r = document.getElementById('twl').getBoundingClientRect(); return ['#bar', '#chat', '#launchers', '#toast', '#areaBar', '#roster'].filter(s => { const e = document.querySelector(s); if (!e) return false; const q = e.getBoundingClientRect(); return q.width && q.height && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom); }); })()")
            check(pill['w'] < 320 and pill['h'] < 60 and pill['off'] <= 2 and pill['pe'] == 'none' and pill['hit'] != 'twl' and pill['bar'] == 'none' and not clear, 'H7 it is small, has no bar, covers none of the controls, and the pointer goes through it', {**pill, 'overlaps': clear})
            shot(pg, 'reconnecting')
            procs[0] = relay_start(data)
            pg.wait_for_function("tw.sync.status === 'live'", timeout=30000); pg.wait_for_timeout(300)
            check(pg.evaluate("document.getElementById('twl').hidden && document.querySelector('#twl [aria-live]').textContent === ''"), 'H8 the relay is back: the pill is gone')
            check(not pg.errs, 'H9 no page errors', pg.errs[:3])
            ctx.close()

        # ---------- J. the first common room is behind the bar; the intro shows ONE cursor (2026-10-11) ----------
        if want('J'):
            print('J. the first common room, and the intro\'s one cursor')
            c2 = make_campaign(relay, 'TEST first room (throwaway)', rooms=[])
            u2 = url(c2['token']).replace('&nointro', '').replace('?nointro&', '?')  # the intro plays: a building seat's first visit
            # Have the observer ready before the intro begins: loading it afterward can consume
            # the whole pantomime on a slow connection, leaving no cursor samples to observe.
            ctx_b, pb = page(); pb.goto(url(c2['token'])); ready(pb)
            ctx, pg = page(); reqs = []; pg.on('request', lambda r: reqs.append((time.time(), r.url)) if '/assets/' in r.url else None)
            pg.add_init_script('performance.setResourceTimingBufferSize(20000)')
            pg.goto(u2); ready(pg)
            lh = pg.evaluate('tw.loadHold'); n_before = len(reqs)
            check(lh and lh.get('warm') and lh['warm']['things'] > 10 and lh['pieces'] > 30 and lh['left'] == 0 and not lh['capped'] and n_before > 30, 'J1 an empty new table: the screen waited for the pieces of the room the intro is about to build', f"{lh}; {n_before} asset requests behind the screen")
            samples = []; t0 = time.time(); room_at = None
            while time.time() - t0 < 60 * SLOW:
                a = pg.evaluate("""(() => { const I = tw.intro, ph = I.phantom?.id, w = tw.worlds.get(tw.main.area), ep = w.lastEpisode, r = I.room && tw.entities()[I.room];
                  return { observedAt: performance.now(), state: I.info().state, ghost: !!document.querySelector('#introGhost'), ph, echo: ph ? tw.pv.on(tw.area()).filter(s => s.seat === ph && s.pos).length : 0, drawn: ph ? w.cursors.has(ph) : false, layer: w.layers.cursors.children.length,
                    room: !!r, hash: r?.layout?.hash || null, ep: r && ep && ep.dir === 'in' ? { loading: ep.loading, loadMs: ep.loadMs ?? null, n: ep.n } : null }; })()""")
                a['other'] = pb.evaluate("tw.worlds.get(tw.main.area).cursors.size")
                samples.append(a)
                if a['room'] and room_at is None: room_at = a['observedAt']
                if a['state'] in ('done', 'failed', 'interrupted') and (a['state'] != 'done' or (a['ep'] and not a['ep']['loading'])): break
                pg.wait_for_timeout(40)
            last = samples[-1]; echo = [x for x in samples if x['echo']]
            check(last['state'] == 'done' and any(x['ghost'] for x in samples), 'J2 the intro played to the end with its ghost cursor on the screen', f"{last['state']}, {len(samples)} samples")
            check(len(echo) >= 3 and not any(x['drawn'] or x['layer'] for x in samples), "J3 the phantom's cursor comes back through presence, and is NOT drawn in the world on the screen that shows the ghost: one cursor, not two", f"{len(echo)} samples with its presence here; drawn in {sum(1 for x in samples if x['drawn'] or x['layer'])}")
            check(any(x['other'] for x in samples), "J4 another screen at the same table still sees the phantom's cursor in the world", f"{sum(1 for x in samples if x['other'])} samples")
            # The intro also opens the streaming PiP library. Its later geometry/texture requests are
            # not dependencies of this room. Ask the renderer's loader for the actual room dependencies,
            # including both logical and content-addressed delivery URLs, exactly as warmup does.
            dependencies = pg.evaluate("""async () => {
              const { T } = await import(new URL('tuner.js', location.href).href);
              const w = tw.worldOf(tw.area()), L = tw.assets.look, urls = new Set();
              const add = spec => { for (const u of L.assetUrls(spec)) for (const path of [u, T.look.deliver(u)]) {
                const url = new URL(path, new URL(T.base, location.href)); urls.add(url.origin + url.pathname);
              } };
              for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.url && !r.asleep) add(tw.assets.specOf(r.entity));
              for (const sh of w.shell.values()) if (!sh.asleep && sh.spec?.url) add(sh.spec);
              return [...urls];
            }""")
            required = set(dependencies)
            def room_requests():
                # Browser startTime avoids delayed delivery of Playwright's request callbacks under load.
                entries = pg.evaluate("performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).origin + new URL(e.name).pathname, at: e.startTime, url: e.name }))")
                return [e for e in entries if e['name'] in required and room_at is not None and e['at'] > room_at - 50]
            late = room_requests()
            check(last['ep'] and last['ep']['loadMs'] is not None and last['ep']['loadMs'] <= 400 * SLOW and last['hash'] == lh['warm']['hash'] and not late, "J5 the phantom's room is the very room that was fetched (the same layout), nothing more is asked for when it arrives, and its spawn starts at once", f"spawn waited {last['ep'] and last['ep']['loadMs']} ms for {last['ep'] and last['ep']['n']} pieces; layout {last['hash']} / fetched {lh['warm']['hash']}; {len(late)} late room-asset requests among {len(required)} dependency URLs {late[:2]}")
            # Prove the scoped accounting still rejects a real late dependency, rather than merely
            # filtering away all traffic. A cache-busted fetch of one required mesh must be detected.
            probe = pg.evaluate("""async urls => {
              const url = new URL(urls.find(u => u.endsWith('.glb'))); url.searchParams.set('tw_j5_probe', Date.now());
              const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('room dependency probe: ' + r.status);
              await r.arrayBuffer(); return url.href;
            }""", dependencies)
            pg.wait_for_function("url => performance.getEntriesByName(url).length > 0", arg=probe)
            check(any(e['url'] == probe for e in room_requests()), 'J5a a deliberately late room dependency is detected by the same accounting')
            check(not pg.errs and not pb.errs, 'J6 no page errors', (pg.errs + pb.errs)[:3])
            ctx.close(); ctx_b.close()
            # the cap: pieces that never come do not keep the screen up
            ctx, pg = page(); held = []; pg.route('**/*.glb*', lambda r: held.append(r)); t0 = time.time()
            pg.goto(url(c['token'], '&holdcap=1500')); ready(pg)
            st = pg.evaluate('({ hold: tw.loadHold, T: twLoad.times, leave: __ld.leave })')
            check(st['hold']['capped'] == 'slow' and st['hold']['left'] > 0 and 450 <= st['T']['frame'] - st['T']['first'] <= 1500 + 1500 * SLOW and len(held) > 20, 'J7 pieces that do not arrive: the screen does not wait out the cap for them (it leaves a third of the way to it when nothing has come: 5 s of 15; 0.5 s of 1.5 here), with the stand-ins, as it used to', f"{st['hold']}; left {st['T']['frame'] - st['T']['first']} ms after the first frame; {len(held)} meshes held back")
            # Finish deliberately held route handlers before closing the context; otherwise
            # Playwright prints cancellation tracebacks for this intentional failure scenario.
            pg.unroute('**/*.glb*')
            for route in held: route.abort()
            ctx.close()

        # ---------- I. the mark ----------
        if want('I'):
            print('I. the mark')
            html = open(os.path.join(ENGINE, 'client', 'index.html')).read(); mark = open(os.path.join(ENGINE, 'client', 'mark.svg')).read().strip()
            body = mark.split('>', 1)[1]
            check(body in html, 'I1 the mark drawn in the page is engine/client/mark.svg, path for path')
            head = html.split('<div id="twl">')[0]
            check('<script type="module"' not in head and 'rel="stylesheet"' not in head and ' src=' not in head, 'I2 nothing before the loading screen in the page waits on another request')
            check('rel="icon"' in html and 'mark.svg' in html.split('rel="icon"')[1][:80], 'I3 the mark is the page icon')

        browser.close()
    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed ({ENG}{', live' if live else ''})")
    for r in bad: print('  FAILED:', r[1], r[2])
    return 1 if bad else 0

t_start = time.time()
try: code = main()
finally: stop()
print(f'{time.time() - t_start:.0f} s')
sys.exit(code)
