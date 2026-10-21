#!/usr/bin/env python3
"""A friend joins by the link the GM sends: the whole path, as an outsider walks it.  (2026-10-11)

  live:   python3 engine/test/browser_join.py --live https://turnipworks.net
  local:  ... browser_join.py            (a relay and a small web server laid out as turnipworks.net is: the game at "/"
                                          with <base href="/engine/client/">, the tuner at /look/, /tuner/ a 301 elsewhere)
  TW_BROWSER=firefox ... browser_join.py  (Firefox, a window on Xvfb)

Why this suite exists: from 2026-10-07 to 2026-10-11 a GM who started a campaign on turnipworks.net had the address
/engine/client/#s=… in the address bar (a bare '#s=…' given to history.replaceState resolves against the page's <base>),
so every invite link copied from that tab pointed at the OTHER site's page, which cannot load the look from this origin.
Friends saw "The game did not finish downloading." No other suite walked start-form -> invite link -> fresh browser on a
page with a <base>.

  J1 the GM starts a campaign with the start FORM; the address keeps the page's own path
  J2 the invite link has the page's own path
  J3 a fresh browser opens the BARE link (no test switches): seated as the player, at the GM's table, first frame drawn
  J4 each sees the other online; a pawn the GM places reaches the player
  J5 the GM reloads the tab: the table opens again
  J6 the address the broken links carried (/engine/client/#s=…) opens the table too (those links are out there)
  J7 a link to a deleted campaign says so in a sentence, and what to do
  J8 the look not arriving says so in a sentence, and what to do
"""
import argparse, http.server, json, mimetypes, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
TUNER = os.path.join(REPO, 'tools', 'spawn-tuner'); SHOTS = os.path.join(HERE, 'shots')
ap = argparse.ArgumentParser(); ap.add_argument('--live'); ap.add_argument('--only', default='')
A = ap.parse_args()
FIREFOX = os.environ.get('TW_BROWSER', '').lower() == 'firefox'; ENG = 'firefox' if FIREFOX else 'chromium'
GL = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18237,18867').split(','))
RELAY = f'http://127.0.0.1:{RP}'; API = 'http://127.0.0.1:8096'
SLOW = 3 if FIREFOX else 1
UA = {'User-Agent': 'Mozilla/5.0 tw-join-test'}
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)

def turnipworks_page():
    """engine/deploy.sh's index.turnipworks.html, made the same way from the working tree's index.html"""
    s = open(os.path.join(ENGINE, 'client', 'index.html'), encoding='utf-8').read()
    s = s.replace('<head>', '<head>\n<base href="/engine/client/">', 1).replace('content="../../tuner/"', 'content="/look/"')
    return s.replace('"../../tuner/js/', '"/look/js/').encode()

class Site(http.server.BaseHTTPRequestHandler):
    """turnipworks.net's nginx (engine/relay/nginx-turnipworks.net.conf), as far as a page load goes"""
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def out(self, code, body=b'', ctype='text/plain', extra=()):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-cache')
        for k, v in extra: self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path in ('/', '/engine/client/', '/engine/client/index.html'): return self.out(200, turnipworks_page(), 'text/html; charset=utf-8')
        m = re.match(r'^/look/((?:js|data|assets)/.+|version\.json)$', path); f = None
        if m: f = os.path.join(TUNER, m.group(1))
        elif path.startswith('/engine/'): f = os.path.join(ENGINE, path[len('/engine/'):])
        elif path.startswith('/api/'): return self.out(404, b'{}', 'application/json')
        else: return self.out(301, extra=[('Location', f'http://127.0.0.1:1/projects/turnip-works{path}')])  # the tools live on the other site
        f = os.path.realpath(f)
        roots = (os.path.realpath(REPO), os.path.realpath(os.path.join(TUNER, 'assets')))  # worktrees share ignored assets
        if not (any(f.startswith(root + os.sep) for root in roots) and os.path.isfile(f)): return self.out(404, b'not found')
        self.out(200, open(f, 'rb').read(), mimetypes.guess_type(f)[0] or 'application/octet-stream')

def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-join-'); tmp.append(data)
    pr = subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT); procs.append(pr)
    for _ in range(150):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'{RELAY}/health', timeout=1); break
        except Exception: pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', SP), Site); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
def cleanup():
    for pr in procs:
        pr.terminate()
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

def post(url, body=None):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(body or {}).encode(), method='POST', headers=UA), timeout=30).read())

def main():
    live = A.live.rstrip('/') if A.live else None
    if not live: start_local()
    origin = live or f'http://127.0.0.1:{SP}'
    relay = (live + '/api/tw-relay') if live else RELAY
    q_relay = '' if live else 'relay=' + urllib.parse.quote(RELAY, safe='')   # (local only: the small web server is no proxy)
    def addr(path='/', token=None, switches=''):
        q = '&'.join(x for x in (q_relay, switches) if x)
        return origin + path + (f'?{q}' if q else '') + (f'#s={token}' if token else '')
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=GL)
        def page():
            ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1); pg = ctx.new_page(); pg.set_default_timeout(90000 * SLOW)
            pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200])); pg.bad = []
            pg.on('requestfailed', lambda r: pg.bad.append(r.url[:140]) if '/sse/' not in r.url and '/ws' not in r.url else None)
            if not live: tw_sandbox.proxy(pg, API)
            return ctx, pg
        def shut(ctx, pg):
            # (a page still fetching when its context closes leaves the sandbox's route handlers answering a closed page)
            try: pg.goto('about:blank'); pg.unroute_all(behavior='ignoreErrors'); ctx.unroute_all(behavior='ignoreErrors')
            except Exception: pass
            ctx.close()
        def opened(pg, timeout=120000):
            """the table is open (a first real frame) or the loading screen has said why not"""
            pg.wait_for_function('window.twLoad && (twLoad.failed || (twLoad.times.frame && window.tw && tw.ready && tw.ready()))', timeout=timeout * SLOW)
            return pg.evaluate("({ failed: twLoad.failed || null, why: twLoad.failed ? document.querySelector('.twl-why').textContent : '', btn: twLoad.failed ? document.querySelector('.twl-fail button').textContent : '', me: window.tw?.sync?.campaign?.my?.name || null, role: window.tw?.sync?.campaign?.my?.role || null, campaign: window.tw?.sync?.campaign?.id || null, area: window.tw?.area?.() || null, path: location.pathname, transport: window.tw?.transport?.() || null })")

        print(f'join by link: {origin} ({ENG})')
        # ---------- J1: the GM, through the start form ----------
        gctx, gm = page()
        if FIREFOX: gctx.unroute(tw_sandbox.CAMPAIGNS)  # (in Firefox the sandbox's note-taking route leaves the page unable to read the answer to POST /campaigns: the form says "could not be reached". A real Firefox has no such route; the campaign is noted by hand below)
        gm.goto(addr('/', switches='nointro&faces=1500'))
        gm.fill('#newCampaign [name=name]', 'TEST join (throwaway)'); gm.fill('#newCampaign [name=gm]', 'Fauna-join'); gm.click('#newCampaign button[type=submit]')
        g = opened(gm)
        if FIREFOX and g['campaign']: tw_sandbox._made.append((relay, g['campaign'], gm.url.split('#s=')[-1], 'TEST join (throwaway)'))  # removed at exit
        check(not g['failed'] and g['role'] == 'gm', 'J1 the GM starts a campaign with the start form: the table opens', g)
        check(g['path'] == '/' and '#s=' in gm.url, "J1b the GM's address keeps the page's own path (a bare '#s=' resolves against <base>)", gm.url.split('#')[0])
        # ---------- J2: the invite link ----------
        tok = gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#33aa77' })")
        link = gm.evaluate('t => tw.inviteLink(t)', tok) if tok else ''
        u = urllib.parse.urlsplit(link)
        check(bool(tok) and u.path == '/' and u.fragment == f's={tok}' and f'{u.scheme}://{u.netloc}' == origin, "J2 the invite link is this page's own address plus the seat", link.split('#')[0])
        # ---------- J3: a fresh browser, the bare link ----------
        bare = addr('/', tok)  # what a friend gets: no test switches at all
        pctx, pl = page(); t0 = time.time(); pl.goto(bare); v = opened(pl); took = round(time.time() - t0, 1)
        check(not v['failed'] and v['me'] == 'Pat' and v['role'] == 'player' and v['campaign'] == g['campaign'] and v['area'] == g['area'], f'J3 a fresh browser opens the link: seated as the player at the GM\'s table ({took} s, {v["transport"]})', v)
        check(not pl.errs and not pl.bad, 'J3b nothing failed to load on the way, no page error', (pl.errs + pl.bad)[:4])
        pl.screenshot(path=os.path.join(SHOTS, f'join-{ENG}-player.png'))
        # ---------- J4: both ways ----------
        try:
            gm.wait_for_function("tw.sync.campaign.seats.some(s => s.name === 'Pat' && s.online)", timeout=20000 * SLOW); pl.wait_for_function("tw.sync.campaign.seats.some(s => s.role === 'gm' && s.online)", timeout=20000 * SLOW); both = True
        except Exception: both = False
        check(both, 'J4 each sees the other online')
        gm.evaluate("tw.dispatch('token.create', { id: 'tok_jointest01', name: 'Marker', x: 2.5, z: 2.5 })")
        try: pl.wait_for_function("!!tw.entities()['tok_jointest01']", timeout=20000 * SLOW); seen = True
        except Exception: seen = False
        check(seen, 'J4b a pawn the GM places reaches the player')
        # ---------- J5: the GM reloads ----------
        gm.reload(); r = opened(gm)
        check(not r['failed'] and r['role'] == 'gm' and r['campaign'] == g['campaign'], 'J5 the GM reloads the tab: the table opens again', r)
        shut(pctx, pl)
        # ---------- J6: the address the broken links carried ----------
        for path in ('/engine/client/', '/engine/client/index.html'):
            ctx, pg = page(); pg.goto(addr(path, tok, 'nointro&faces=1500')); v = opened(pg)
            check(not v['failed'] and v['me'] == 'Pat' and v['campaign'] == g['campaign'], f'J6 a link made 2026-10-07..11 ({path}#s=…) opens the table', v if v['failed'] else '')
            if path.endswith('/'):
                l2 = pg.evaluate("tw.inviteLink('x')")
                check(urllib.parse.urlsplit(l2).path == path, 'J6b (an invite link from that address carries that address: it opens too)', l2)
            shut(ctx, pg)
        # ---------- J7: a dead link ----------
        c = post(f'{relay}/campaigns', {'name': 'TEST join dead (throwaway)', 'gm': 'Fauna-join'})
        gone = post(f"{relay}/c/{c['campaign']}/delete?seat={c['token']}&purge=1")
        ctx, pg = page(); pg.goto(addr('/', c['token'])); v = opened(pg)
        check(gone.get('ok') and v['failed'] == 'denied' and 'new link' in v['why'], 'J7 a link to a deleted campaign: says so, and to ask for a new link', v['why'] or v)
        shut(ctx, pg)
        # ---------- J8: the look does not arrive ----------
        ctx, pg = page(); pg.route('**/look/js/**', lambda r: r.abort()); pg.goto(addr('/', tok)); v = opened(pg)
        check(v['failed'] == 'code' and 'did not finish downloading' in v['why'] and 'tell whoever sent you the link' in v['why'] and v['btn'] == 'Try again', 'J8 the look not arriving: says so, and what to do', v['why'] or v)
        shut(ctx, pg); shut(gctx, gm); browser.close()

try: main()
finally: cleanup()
bad = [r for r in results if not r[0]]
print(f'\n{len(results) - len(bad)} of {len(results)} passed' + (': ' + '; '.join(r[1] for r in bad) if bad else ''))
sys.exit(1 if bad else 0)
