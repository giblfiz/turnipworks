#!/usr/bin/env python3
"""The phone banner and its handoff, in real browsers.  (2026-10-24; docs/UI.md "The phone banner", "On a phone"; docs/NETCODE.md
"The funnel", "Email yourself your link" ▸ the handoff. Until 2026-10-24 a phone got a separate "phone page" instead of
the table; now it goes straight into the game and the same ask is a small banner.)

  local: python3 engine/test/browser_phone.py     (own relay + site, TW_PORTS)
  dev:   ... browser_phone.py --live http://127.0.0.1:8180 --data /var/lib/tw-relay-dev/data
         [--real-mail fixture@example.invalid]   P9: one handoff NOT sandboxed, so the dev relay really sends it (its allow
                                                list must hold the address); box-local, so the funnel marks it `local`

Google Chrome at 390 x 844 with touch and a coarse pointer is "a phone"; 1280 x 800 with a mouse is "a computer". Every
handoff / funnel call carries X-TW-Test (tw_sandbox), so mail lands in the relay's link-mail test sandbox outbox and the
funnel lines are marked `sandbox` and left out.

  P1 a phone at the front door from an ad (utm_* + rdt_cid): the GAME (the start page, main.js), laid out for a phone
     (html.tw-hand), and the banner "Bigger screen? Email yourself the link" with ×, clear of the start form; no phone
     page; the ad parameters out of the address bar; nothing wider than the phone
  P2 the funnel: one 'phone' (shown) line with the visit's landing (utm_content, the click id's platform), marked sandbox
  P8 the banner opened: ONE form, the Privacy Policy link, the news box unticked; a wrong address: said in a sentence
  P3 the ask: "Sent to f•••@…"; the mail in the sandbox outbox: a turnipworks.net link with the utm, the click id and
     tw_handoff, no seat key; the address stored as role handoff; the funnel's 'handoff' line, no address in it; then
     the banner goes by itself
  P4 that link opened on a computer: the ordinary start page, the address bar cleaned, the note keeps the handoff and
     the ad's utm_content; one 'handoff_open' (desktop); a table started there carries the handoff
  P5 a computer at the front door with the same ad link: unchanged (the start page, no banner, no phone layout)
  P6 a phone opening a seat link (#s=…): the table, laid out for a phone, no banner
  P7 once per visit: a reload in the same tab shows no banner; a new visit does, and untouched it goes by itself after
     a few seconds; × closes it at once
  P10 a computer from a Google ad that lands on /vtt-index (2026-11-02): the page notes utm_* and gclid and cleans the address
     bar; it asks for nothing off this site and POSTs nothing (no tracker); "Open Turnip Works", start a table: the
     funnel's 'campaign' line has the utm_* and the gclid
  P11 a phone, the same ad: /vtt-index, then the front door: the banner's 'phone' line and the emailed link have them
  P12 a computer from an ad sitelink that lands on /features, /dice, /switching or /export (2026-11-04): each notes utm_* and
     gclid, cleans the address bar, POSTs nothing, asks for nothing off this site; its "Open Turnip Works" goes to the front
     door (the rest of the road is P10's, the same front door)
"""
import argparse, glob, http.server, json, mimetypes, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
LANDING = ['features', 'dice', 'switching', 'export', 'assets']   # the ad sitelink pages (engine/tools/build_site.py LANDING): P12
TUNER = os.path.join(REPO, 'tools', 'spawn-tuner'); SHOTS = os.path.join(REPO, 'experiments', '2026-10-24-phone', 'stills')
ap = argparse.ArgumentParser(); ap.add_argument('--live'); ap.add_argument('--data'); ap.add_argument('--real-mail'); ap.add_argument('--no-shots', action='store_true'); ap.add_argument('--local', action='store_true')
A = ap.parse_args()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18294,18947').split(','))
RELAY = f'http://127.0.0.1:{RP}'; API = 'http://127.0.0.1:8096'
UA = {'User-Agent': 'Mozilla/5.0 tw-phone-test'}
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:300] if detail != '' else ''}", flush=True)

def turnipworks_page():
    s = open(os.path.join(ENGINE, 'client', 'index.html'), encoding='utf-8').read()
    s = s.replace('<head>', '<head>\n<base href="/engine/client/">', 1).replace('content="../../tuner/"', 'content="/look/"')
    return s.replace('"../../tuner/js/', '"/look/js/').encode()

class Site(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def out(self, code, body=b'', ctype='text/plain'):
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-cache'); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path in ('/', '/engine/client/'): return self.out(200, turnipworks_page(), 'text/html; charset=utf-8')
        if path == '/privacy': return self.out(200, open(os.path.join(ENGINE, 'client', 'site', 'privacy.html'), 'rb').read(), 'text/html; charset=utf-8')
        if path in ('/vtt-index', *(f'/{p}' for p in LANDING)): return self.out(200, open(os.path.join(ENGINE, 'client', 'site', path[1:] + '.html'), 'rb').read(), 'text/html; charset=utf-8')
        m = re.match(r'^/look/((?:js|data|assets)/.+|version\.json)$', path); f = None
        if m: f = os.path.join(TUNER, m.group(1))
        elif path.startswith('/engine/'): f = os.path.join(ENGINE, path[len('/engine/'):])
        else: return self.out(404, b'not found')
        f = os.path.realpath(f)
        roots = (os.path.realpath(REPO), os.path.realpath(os.path.join(TUNER, 'assets')))
        if not (any(f.startswith(root + os.sep) for root in roots) and os.path.isfile(f)): return self.out(404, b'not found')
        self.out(200, open(f, 'rb').read(), mimetypes.guess_type(f)[0] or 'application/octet-stream')

def start_local():
    data = tempfile.mkdtemp(prefix='tw-phone-'); tmp.append(data)
    pr = subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**{k: v for k, v in os.environ.items() if not k.startswith(('TW_MAIL', 'TW_SMTP'))}, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=open(os.path.join(data, 'relay.log'), 'a'), stderr=subprocess.STDOUT); procs.append(pr)
    for _ in range(300):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'{RELAY}/health', timeout=1); break
        except Exception: pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', SP), Site); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return data
def cleanup():
    for pr in procs:
        pr.terminate()
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

AD = {'utm_source': 'reddit', 'utm_medium': 'paid', 'utm_campaign': 'phone-test', 'utm_content': 'film-15c-4x5', 'rdt_cid': 'RDTtest123'}
GOOGLE = {'utm_source': 'google', 'utm_medium': 'cpc', 'utm_campaign': 'switch', 'utm_content': 'comparison', 'gclid': 'GCLIDtest123'}

def main():
    live = A.live.rstrip('/') if A.live else None
    data = A.data if live else start_local()
    origin = live or f'http://127.0.0.1:{SP}'
    relay = (live + '/api/tw-relay') if live else RELAY
    def addr(params=None, token=None, extra=''):
        q = dict(params or {})
        if not live: q['relay'] = RELAY
        qs = urllib.parse.urlencode(q)
        return origin + '/' + (f'?{qs}' if qs else '') + extra + (f'#s={token}' if token else '')
    evf = os.path.join(data, 'funnel', 'events.jsonl')
    def events():
        try: return [json.loads(l) for l in open(evf) if l.strip()]
        except Exception: return []
    sbx = os.path.join(data, 'linkmail', 'test-sandbox', tw_sandbox.SID)
    def outbox(): return [json.load(open(f)) for f in sorted(glob.glob(os.path.join(sbx, 'outbox', '*.json')))]
    def book():
        try: return list(json.load(open(os.path.join(sbx, 'addresses.json')))['addrs'].values())
        except Exception: return []
    if not A.no_shots: os.makedirs(SHOTS, exist_ok=True)
    shot = lambda pg, name, full=False: None if A.no_shots else pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        def ctx_page(phone, country='US', sandboxed=True):
            kw = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36') if phone else dict(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
            ctx = browser.new_context(**kw); pg = ctx.new_page(); pg.set_default_timeout(90000)
            pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200]))
            pg.reqs = []; pg.on('request', lambda r: pg.reqs.append(r.url))
            if not live: tw_sandbox.proxy(pg, API)
            def lm(route):
                h = {**route.request.headers, **({'cf-ipcountry': country} if country else {})}
                if sandboxed: h['x-tw-test'] = tw_sandbox.SID
                route.continue_(headers=h)
            pg.route(tw_sandbox.LINKMAIL, lm)
            return ctx, pg
        def shut(ctx, pg):
            for x in (pg, ctx):
                try: x.unroute_all(behavior='ignoreErrors')
                except Exception: pass
            ctx.close()
        print(f'phone banner + handoff: {origin}')
        # ---------- P1: a phone from an ad ----------
        pctx, ph = ctx_page(True)
        n0 = len(events())
        ph.goto(addr(AD)); ph.wait_for_selector('#phoneBanner', timeout=60000); time.sleep(1)
        st = ph.evaluate("""(() => { const B = document.getElementById('phoneBanner'), vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden; };
          const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
          return { phone: !!document.getElementById('phone'), start: vis('start'), hand: document.documentElement.classList.contains('tw-hand'), TW_PHONE: window.TW_PHONE,
            text: B?.innerText || '', x: !!B?.querySelector('.pb-x'), banner: r(B?.querySelector('.pb-shut')), submit: r(document.querySelector('#newCampaign button[type=submit]') || document.querySelector('#newCampaign button')), field: r(document.querySelector('#newCampaign [name=gm]')),
            sw: document.documentElement.scrollWidth, url: location.href, h: innerHeight, state: window.twPhone?.state }; })()""")
        check(st['start'] and st['hand'] and st['TW_PHONE'] and not st['phone'], 'P1 a phone at the front door: the game (the start page), laid out for a phone, no phone page', {k: st[k] for k in ('start', 'hand', 'TW_PHONE', 'phone')})
        check(any('/main.js' in u for u in ph.reqs), 'P1b the game itself is loaded (main.js)')
        check('Bigger screen?' in st['text'] and 'Email yourself the link' in st['text'] and st['x'] and st['state'] == 'shut', 'P1c the banner: "Bigger screen? Email yourself the link", ×', st['text'])
        ov = lambda a, b: bool(a and b and a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3])
        check(st['banner'] and st['banner'][3] <= st['h'] and not ov(st['banner'], st['submit']) and not ov(st['banner'], st['field']), 'P1d the banner is on screen and clear of the start form (its field and button)', [st['banner'], st['submit'], st['field']])
        check(st['sw'] <= 390, 'P1e nothing wider than the phone', st['sw'])
        check('utm_' not in st['url'] and 'rdt_cid' not in st['url'], 'P1f the ad parameters are taken out of the address bar', st['url'])
        check(not ph.errs, 'P1g no page errors', ph.errs)
        shot(ph, 'p1-phone-banner-390x844')
        # ---------- P2: the funnel's 'phone' line ----------
        time.sleep(0.5)
        pl = [e for e in events()[n0:] if e.get('ev') == 'phone']
        check(len(pl) == 1 and (pl[0].get('landing') or {}).get('utm_content') == 'film-15c-4x5' and (pl[0].get('landing') or {}).get('click') == 'reddit' and pl[0].get('test') == 'sandbox', 'P2 one "phone banner shown" line: the ad\'s utm_content, Reddit, marked sandbox (left out)', pl)
        # ---------- P8: the banner opened, and a wrong address ----------
        ph.tap('#phoneBanner .pb-open'); time.sleep(0.4)
        o = ph.evaluate("""(() => { const C = document.querySelector('#phoneBanner .pb-card'); const b = C.getBoundingClientRect(); return { open: !C.hidden, forms: C.querySelectorAll('form').length, news: C.querySelector('input[name=news]')?.checked ?? null, privacy: C.querySelector('.lm-privacy')?.getAttribute('href'), text: C.innerText, box: [b.left, b.top, b.right, b.bottom], h: innerHeight, w: innerWidth }; })()""")
        check(o['open'] and o['forms'] == 1 and o['news'] is False and o['privacy'] in ('/privacy', 'site/privacy.html') and 'Email yourself the link' in o['text'], 'P8 opened: ONE form, the Privacy Policy link, the news box unticked', [o['forms'], o['news'], o['privacy']])
        check(o['box'][0] >= 0 and o['box'][1] >= 0 and o['box'][2] <= o['w'] and o['box'][3] <= o['h'], 'P8b the open card is whole on the screen', o['box'])
        time.sleep(9)
        check(ph.evaluate("window.twPhone.state") == 'open', 'P8c open, it does not go by itself')
        ph.fill('#phoneBanner .lm-email', 'not-an-address'); ph.tap('#phoneBanner .lm-send'); time.sleep(0.3)
        check('does not look like an email' in ph.inner_text('#phoneBanner .lm-msg') and not outbox(), 'P8d a wrong address: said in a sentence, nothing sent')
        shot(ph, 'p8-phone-banner-open')
        # ---------- P3: the ask ----------
        ph.fill('#phoneBanner .lm-email', 'fixture@example.invalid'); ph.tap('#phoneBanner .lm-send')
        ph.wait_for_selector('#phoneBanner .pb-card.done', timeout=30000)
        done = ph.inner_text('#phoneBanner .pb-card')
        check('Sent to f•••@example.invalid' in done, 'P3 sent: "Sent to f•••@example.invalid"', done)
        shot(ph, 'p3-phone-sent')
        mail = (outbox() or [None])[-1]
        link = mail['text'].split('\n')[2] if mail else ''
        u = urllib.parse.urlsplit(link); q = dict(urllib.parse.parse_qsl(u.query)); h = q.get('tw_handoff', '')
        check(mail and mail['to'] == 'fixture@example.invalid' and 'for your computer' in mail['subject'], 'P3b the mail is in the sandbox outbox, "Your Turnip Works link, for your computer"', mail and mail['subject'])
        check(re.match(r'^https://(dev\.)?turnipworks\.net/$', f'{u.scheme}://{u.netloc}{u.path}') and all(q.get(k) == v for k, v in AD.items()) and re.match(r'^hd_[0-9a-z]+$', h) and '#s=' not in link, 'P3c its link: turnipworks.net + the ad\'s utm_*, rdt_cid and tw_handoff; no seat key', link)
        rec = next((a for a in book() if a['email'] == 'fixture@example.invalid'), None)
        check(rec and rec['links'][-1]['role'] == 'handoff' and rec['links'][-1]['h'] == h and rec['news'] is False, 'P3d stored as a handoff, news off', rec and rec['links'][-1])
        hl = [e for e in events() if e.get('ev') == 'handoff' and e.get('h') == h]
        check(len(hl) == 1 and 'example.invalid' not in json.dumps(hl) and hl[0].get('pg') and hl[0].get('test') == 'sandbox', 'P3e the funnel\'s "handoff emailed" line (the banner\'s id, no address, sandbox)', hl)
        time.sleep(7.5)
        check(not ph.evaluate("!!document.getElementById('phoneBanner')"), 'P3f sent, the banner goes by itself a few seconds later')
        # ---------- P4: the link on a computer ----------
        dctx, dk = ctx_page(False)
        open_url = (origin + '/?' + u.query + (f'&relay={urllib.parse.quote(RELAY, safe="")}' if not live else ''))
        dk.goto(open_url); dk.wait_for_selector('#start:not([hidden])', timeout=90000); time.sleep(1.5)
        ds = dk.evaluate("({ phone: !!document.getElementById('phone'), TW_PHONE: window.TW_PHONE, url: location.href, note: JSON.parse(localStorage.getItem('tw.landing') || 'null') })")
        check(not ds['phone'] and not ds['TW_PHONE'] and 'tw_handoff' not in ds['url'] and 'utm_' not in ds['url'], 'P4 on a computer the link opens the ordinary start page; the address bar is cleaned', ds['url'])
        check((ds['note'] or {}).get('handoff') == h and (ds['note'] or {}).get('utm_content') == 'film-15c-4x5' and (ds['note'] or {}).get('rdt_cid') == 'RDTtest123', 'P4b the note keeps the handoff, the ad\'s utm_content and click id', ds['note'])
        ho = [e for e in events() if e.get('ev') == 'handoff_open' and e.get('h') == h]
        check(len(ho) == 1 and ho[0].get('device') == 'desktop', 'P4c one "handoff opened on desktop" line', ho)
        dk.reload(); dk.wait_for_selector('#start:not([hidden])'); time.sleep(1)
        check(len([e for e in events() if e.get('ev') == 'handoff_open' and e.get('h') == h]) == 1, 'P4d a reload adds nothing')
        dk.fill('#newCampaign [name=name]', 'TEST phone handoff (throwaway)'); dk.click('#newCampaign button[type=submit]')
        cl = None
        for _ in range(100):
            cl = next((e for e in events() if e.get('ev') == 'campaign' and (e.get('landing') or {}).get('handoff') == h), None)
            if cl: break
            time.sleep(0.2)
        check(cl and (cl.get('landing') or {}).get('handoff') == h and cl.get('test') == 'sandbox', 'P4e a table started there carries the handoff ("phone ad → desktop")', cl and cl.get('landing'))
        shot(dk, 'p4-desktop-from-handoff')
        shut(dctx, dk)
        # ---------- P5: a computer at the front door, the same ad link: unchanged ----------
        cctx, cp = ctx_page(False)
        cp.goto(addr(AD)); cp.wait_for_selector('#start:not([hidden])', timeout=90000); time.sleep(1.5)
        check(not cp.evaluate("!!document.getElementById('phone') || !!document.getElementById('phoneBanner') || window.TW_PHONE || window.TW_HAND || document.documentElement.classList.contains('tw-hand')") and any('/main.js' in r for r in cp.reqs) and not any('/phone.js' in r for r in cp.reqs), 'P5 a computer: the start page as before (main.js; no banner, no phone.js, no phone layout)')
        check(not cp.errs, 'P5b no page errors', cp.errs)
        shot(cp, 'p5-desktop-unchanged'); shut(cctx, cp)
        # ---------- P6: a phone opening a seat link ----------
        r = urllib.request.Request(relay + '/campaigns', data=json.dumps({'name': 'TEST phone seat (throwaway)', 'gm': 'G'}).encode(), headers={'content-type': 'application/json', 'x-tw-test': tw_sandbox.SID, **UA}, method='POST')
        c6 = json.loads(urllib.request.urlopen(r, timeout=30).read()); tw_sandbox._made.append((relay, c6['campaign'], c6['token'], 'TEST phone seat (throwaway)'))
        sctx, sp = ctx_page(True); sp.goto(addr(token=c6['token'])); time.sleep(4)
        check(not sp.evaluate("!!document.getElementById('phone') || !!document.getElementById('phoneBanner') || window.TW_PHONE") and sp.evaluate("document.documentElement.classList.contains('tw-hand')") and any('/main.js' in r for r in sp.reqs), 'P6 a phone with a seat link: the table, laid out for a phone, no banner')
        shut(sctx, sp)
        # ---------- P7: once per visit; it goes by itself; × ----------
        ph.reload(); ph.wait_for_selector('#start:not([hidden])', timeout=90000); time.sleep(3)
        check(not ph.evaluate("!!document.getElementById('phoneBanner')") and ph.evaluate("window.twPhone?.state") == 'seen', 'P7 a reload in the same visit (tab): no banner again')
        shut(pctx, ph)
        vctx, vp = ctx_page(True); vp.goto(addr()); vp.wait_for_selector('#phoneBanner', timeout=60000)
        t0 = time.time()
        while time.time() - t0 < 14 and vp.evaluate("!!document.getElementById('phoneBanner')"): time.sleep(0.25)
        gone = time.time() - t0
        check(not vp.evaluate("!!document.getElementById('phoneBanner')") and 5 < gone < 12, f'P7b a new visit: the banner, and untouched it goes by itself ({gone:.1f} s)')
        shut(vctx, vp)
        xctx, xp = ctx_page(True); xp.goto(addr()); xp.wait_for_selector('#phoneBanner', timeout=60000)
        xp.tap('#phoneBanner .pb-x'); time.sleep(0.6)
        check(not xp.evaluate("!!document.getElementById('phoneBanner')") and not xp.errs, 'P7c × closes it at once')
        shut(xctx, xp)
        # ---------- P10: a computer from an ad that lands on the comparison index ----------
        def index_visit(pg):   # -> (the note, the address bar); land on /vtt-index, then click through to the front door
            pg.goto(origin + '/vtt-index?' + urllib.parse.urlencode(GOOGLE), wait_until='load')
            pg.wait_for_function("localStorage.getItem('tw.landing') !== null", timeout=15000)
            seen = pg.evaluate("({ note: JSON.parse(localStorage.getItem('tw.landing')), url: location.href })")
            pg.click('a.play'); pg.wait_for_url(lambda a: urllib.parse.urlsplit(a).path == '/', timeout=30000)
            if not live: pg.goto(addr())   # the local site has no /api/tw-relay: the same front door, told where the relay is
            return seen
        host = urllib.parse.urlsplit(origin).netloc
        ictx, ik = ctx_page(False)
        ik.route(re.compile(r'/campaigns(\?|$)'), lambda route: route.continue_(headers={**route.request.headers, 'cf-ipcountry': 'US', 'x-tw-test': tw_sandbox.SID}))
        ik_posts = []; ik.on('request', lambda r: ik_posts.append(r.url) if r.method == 'POST' else None)
        seen = index_visit(ik)
        n_note = seen['note'] or {}
        check(all(n_note.get(k) == v for k, v in GOOGLE.items()), 'P10 /vtt-index notes the ad: utm_* and gclid in tw.landing', n_note)
        check('utm_' not in seen['url'] and 'gclid' not in seen['url'], 'P10b the address bar is cleaned there too', seen['url'])
        check(not ik_posts, 'P10c the index POSTed nothing', ik_posts)
        ik.wait_for_selector('#start:not([hidden])', timeout=90000)
        ik.fill('#newCampaign [name=name]', 'TEST index landing (throwaway)'); ik.click('#newCampaign button[type=submit]')
        cl = None
        for _ in range(100):
            cl = next((e for e in events() if e.get('ev') == 'campaign' and (e.get('landing') or {}).get('gclid') == 'GCLIDtest123'), None)
            if cl: break
            time.sleep(0.2)
        L = (cl or {}).get('landing') or {}
        check(cl and all(L.get(k) == v for k, v in GOOGLE.items()) and L.get('click') == 'google' and cl.get('test') == 'sandbox' and cl.get('country') == 'US', 'P10d the table\'s funnel line carries the utm_* and the gclid', cl)
        shut(ictx, ik)
        ictx, ik = ctx_page(False); ik.goto(origin + '/vtt-index?' + urllib.parse.urlencode(GOOGLE), wait_until='networkidle'); time.sleep(1)
        off = [u for u in ik.reqs if u.startswith('http') and urllib.parse.urlsplit(u).netloc != host]
        check(not off, 'P10e the page itself asks for nothing off this site (no tracker, no pixel)', off)
        check(not ik.errs, 'P10f no page errors', ik.errs)
        shut(ictx, ik)
        # ---------- P12: the ad sitelink pages (2026-11-04) ----------
        for lp in LANDING:
            lctx, lk = ctx_page(False); lposts = []; lk.on('request', lambda r: lposts.append(r.url) if r.method == 'POST' else None)
            lk.goto(origin + f'/{lp}?' + urllib.parse.urlencode(GOOGLE), wait_until='networkidle')
            try: lk.wait_for_function("localStorage.getItem('tw.landing') !== null", timeout=15000)
            except Exception: pass
            seen = lk.evaluate("({ note: JSON.parse(localStorage.getItem('tw.landing') || 'null'), url: location.href })")
            note = seen['note'] or {}
            off = [u for u in lk.reqs if u.startswith('http') and urllib.parse.urlsplit(u).netloc != host]
            check(all(note.get(k) == v for k, v in GOOGLE.items()) and 'utm_' not in seen['url'] and 'gclid' not in seen['url'],
                  f'P12 /{lp} notes the ad (utm_* and gclid) and cleans the address bar', (note, seen['url']))
            check(not lposts and not off and not lk.errs, f'P12b /{lp} POSTs nothing, asks for nothing off this site, no page errors', (lposts, off, lk.errs))
            lk.click('a.play'); lk.wait_for_url(lambda a: urllib.parse.urlsplit(a).path == '/', timeout=30000)
            check(urllib.parse.urlsplit(lk.url).path == '/', f'P12c /{lp}: "Open Turnip Works" goes to the front door', lk.url)
            shut(lctx, lk)
        # ---------- P11: a phone from the same ad ----------
        n0 = len(events())
        ipc, ip = ctx_page(True)
        seen = index_visit(ip)
        check(all((seen['note'] or {}).get(k) == v for k, v in GOOGLE.items()), 'P11 a phone: /vtt-index notes the ad too', seen['note'])
        ip.wait_for_selector('#phoneBanner', timeout=60000); time.sleep(0.8)
        pl = [e for e in events()[n0:] if e.get('ev') == 'phone']
        L = (pl[-1].get('landing') or {}) if pl else {}
        check(len(pl) == 1 and all(L.get(k) == v for k, v in GOOGLE.items()) and pl[0].get('test') == 'sandbox', 'P11b the front door\'s "phone banner shown" line carries the utm_* and the gclid', pl)
        ip.tap('#phoneBanner .pb-open'); ip.fill('#phoneBanner .lm-email', 'fixture@example.invalid'); ip.tap('#phoneBanner .lm-send')
        ip.wait_for_selector('#phoneBanner .pb-card.done', timeout=30000)
        mail = (outbox() or [None])[-1]
        link = mail['text'].split('\n')[2] if mail else ''
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(link).query))
        check(all(q.get(k) == v for k, v in GOOGLE.items()) and q.get('tw_handoff'), 'P11c the emailed link carries them to the computer', link)
        shut(ipc, ip)
        # ---------- P9: the real mail through the dev relay (box-local, so marked `local`) ----------
        if A.real_mail:
            rctx, rp = ctx_page(True, country=None, sandboxed=False)
            rp.goto(addr({**AD, 'utm_campaign': 'phone-real-mail'})); rp.wait_for_selector('#phoneBanner', timeout=60000); rp.tap('#phoneBanner .pb-open')
            rp.fill('#phoneBanner .lm-email', A.real_mail); rp.tap('#phoneBanner .lm-send'); rp.wait_for_selector('#phoneBanner .pb-card.done', timeout=60000)
            rr = rp.evaluate("window.twPhone.sent")
            check(rr and rr.get('transport') == 'gmail-api', f'P9 a real handoff to {A.real_mail}: sent through the dev relay\'s {rr and rr.get("transport")}', rr)
            last = [e for e in events() if e.get('ev') == 'handoff'][-1:]
            check(last and last[0].get('test') == 'local', 'P9b the box-local send is marked local (left out of the count)', last)
            print(f'  (P9 handoff id {last and last[0].get("h")}: open the mailed link on a computer to finish the check)')
            shut(rctx, rp)
        browser.close()

try: main()
finally: cleanup()
n = sum(1 for r in results if r[0])
print(f'phone: {n}/{len(results)} checks passed')
sys.exit(0 if n == len(results) and results else 1)
