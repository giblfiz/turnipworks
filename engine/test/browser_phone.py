#!/usr/bin/env python3
"""The phone front door and its handoffs, in real browsers.  (2026-11-24, v2; docs/UI.md "The phone front door", "On a phone";
docs/NETCODE.md "The funnel", "Email yourself your link" ▸ the handoff. 2026-10-24 to 11-24 a phone got the game with an
8 s banner over it; before that a "Built for your computer" page.)

  local: python3 engine/test/browser_phone.py     (own relay + site, TW_PORTS)
  dev:   ... browser_phone.py --live http://127.0.0.1:8180 --data /var/lib/tw-relay-dev/data
         [--real-mail fixture@example.invalid]   P9: one handoff NOT sandboxed, so the dev relay really sends it (its allow
                                                list must hold the address); box-local, so the funnel marks it `local`

Google Chrome at 390 x 844 with touch and a coarse pointer is "a phone"; 1280 x 800 with a mouse is "a computer". Every
handoff / funnel call carries X-TW-Test (tw_sandbox), so mail lands in the relay's link-mail test sandbox outbox and the
funnel lines are marked `sandbox` and left out. navigator.share is stubbed where a test needs it (Chrome on Linux has none).

  P1 a phone at the front door from an ad (utm_* + rdt_cid): the FRONT DOOR (#front), not the game: no main.js, nothing
     from the 3D library's CDN; the line, the three ticks, the ask; the ad parameters out of the address bar; nothing
     wider than the phone; the primary button and the three others above the fold at 390 x 664 and at 360 x 600
  P2 the funnel: one 'phone' (shown) line with the visit's landing (utm_content, the click id's platform), marked sandbox;
     its steps: the film started (and, at the loop, finished), the buttons in view
  P8 Email it: ONE form, the Privacy Policy link, the news box unticked; a wrong address: said in a sentence
  P3 the email: "Sent to f•••@…"; the mail in the sandbox outbox: a turnipworks.net link with the utm, the click id and
     tw_handoff, no seat key; the address stored as role handoff; the funnel's 'handoff' line (via email), no address
  P13 Send myself the link (the share sheet): called inside the tap with the visit's link; done: the 'handoff' line (via
     share) and the steps; cancelled: 'share_cancel', no handoff
  P14 Copy link: the clipboard holds the link; the 'handoff' line (via copy)
  P15 Reminder: a calendar file (text/calendar) at the next 7 pm, with the link in it; the 'handoff' line (via ics)
  P16 no share sheet (a phone browser without Web Share): the three buttons, the primary hidden, still in view
  P4 the emailed link opened on a computer: the ordinary start page, the address bar cleaned, the note keeps the handoff
     and the ad's utm_content; one 'handoff_open' (desktop); a table started there carries the handoff. The shared link
     opened on a computer: its own 'handoff_open'
  P17 "Or try it on this phone": the game, laid out for a phone (main.js, the start page); remembered: the next visit
     goes straight to the game; the 'tap_here' step
  P18 a phone that remembers a game (tw.games, a returning GM): straight to the game
  P5 a computer at the front door with the same ad link: unchanged (the start page, no front door, no phone layout)
  P6 a phone opening a seat link (#s=…): the table, laid out for a phone, no front door
  P10 a computer from a Google ad that lands on /vtt-index (2026-11-02): the page notes utm_* and gclid and cleans the address
     bar; it asks for nothing off this site and POSTs nothing (no tracker); "Open Turnip Works", start a table: the
     funnel's 'campaign' line has the utm_* and the gclid
  P11 a phone, the same ad: /vtt-index, then the front door: its 'phone' line and the emailed link have them
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
TUNER = os.path.join(REPO, 'tools', 'spawn-tuner'); SHOTS = os.path.join(REPO, 'experiments', '2026-11-24-phone-front', 'stills')
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
        SHARE = "navigator.share = async (d) => { window.__shared = d; if (window.__shareCancel) throw new DOMException('cancelled', 'AbortError'); };"
        def ctx_page(phone, country='US', sandboxed=True, share=True, vp=None, init=None):
            kw = dict(viewport=vp or {'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36') if phone else dict(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
            ctx = browser.new_context(**kw, permissions=['clipboard-read', 'clipboard-write'])
            if phone and share: ctx.add_init_script(SHARE)
            if init: ctx.add_init_script(init)
            pg = ctx.new_page(); pg.set_default_timeout(90000)
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
        print(f'phone front door + handoffs: {origin}')
        def steps_of(pgid): return [e.get('what') for e in events() if e.get('ev') == 'phone_step' and e.get('pg') == pgid]
        def wait_for(fn, t=10, pg=None):   # (pg: pumps Playwright meanwhile, so its routed requests get through)
            t0 = time.time()
            while time.time() - t0 < t:
                v = fn()
                if v: return v
                if pg: pg.wait_for_timeout(200)
                else: time.sleep(0.2)
            return fn()
        def handoffs(via=None): return [e for e in events() if e.get('ev') == 'handoff' and (via is None or e.get('via') == via)]
        # ---------- P1: a phone from an ad ----------
        pctx, ph = ctx_page(True)
        n0 = len(events())
        ph.goto(addr(AD)); ph.wait_for_selector('#front', state='visible', timeout=60000); ph.wait_for_function('window.twPhone && window.twPhone.pg'); time.sleep(1.2)
        st = ph.evaluate("""(() => { const F = document.getElementById('front'), vis = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden && el.getBoundingClientRect().height > 0;
          const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
          return { front: vis(F), start: vis(document.getElementById('start')), twl: !!document.getElementById('twl'), hand: document.documentElement.classList.contains('tw-hand'), TW_PHONE: window.TW_PHONE,
            h1: F.querySelector('h1')?.innerText, ticks: [...F.querySelectorAll('.fd-ticks li')].map(l => l.innerText.trim()), share: r(document.getElementById('fdShare')), row: r(F.querySelector('.fd-row')), here: r(document.getElementById('fdHere')),
            noShare: F.classList.contains('no-share'), sw: document.documentElement.scrollWidth, url: location.href, h: innerHeight, title: document.title }; })()""")
        check(st['front'] and not st['start'] and not st['twl'] and st['TW_PHONE'], 'P1 a phone at the front door: the front door, not the game (no start form, no loading screen)', {k: st[k] for k in ('front', 'start', 'twl', 'TW_PHONE')})
        check(not any('/main.js' in u for u in ph.reqs) and not any('jsdelivr' in u or 'three' in u.rsplit('/', 1)[-1] for u in ph.reqs) and any('/phone.js' in u for u in ph.reqs), 'P1b no game loaded: no main.js, nothing from the 3D library CDN; phone.js', [u for u in ph.reqs if 'main.js' in u or 'jsdelivr' in u][:3])
        check(st['h1'] == 'A free 3D virtual tabletop in your browser.' and st['ticks'] == ['Free, not freemium', 'No account', 'Players join by link'], 'P1c the line and the three ticks (the ad\'s end card)', [st['h1'], st['ticks']])
        check(not st['noShare'] and st['share'] and st['share'][3] <= 664 and st['row'] and st['row'][3] <= 664, 'P1d the primary button and the three others are above the fold (iPhone 15: 664 px of page)', [st['share'], st['row']])
        check(st['sw'] <= 390, 'P1e nothing wider than the phone', st['sw'])
        check('utm_' not in st['url'] and 'rdt_cid' not in st['url'], 'P1f the ad parameters are taken out of the address bar', st['url'])
        check(not ph.errs, 'P1g no page errors', ph.errs)
        shot(ph, 'p1-front-390x844'); shot(ph, 'p1-front-390x844-full', True)
        PGID = ph.evaluate('window.twPhone.pg')
        # ---------- P2: the funnel ----------
        pl = wait_for(lambda: [e for e in events()[n0:] if e.get('ev') == 'phone'], 5)
        check(len(pl) == 1 and pl[0].get('pg') == PGID and (pl[0].get('landing') or {}).get('utm_content') == 'film-15c-4x5' and (pl[0].get('landing') or {}).get('click') == 'reddit' and pl[0].get('test') == 'sandbox', 'P2 one "front door shown" line: the ad\'s utm_content, Reddit, marked sandbox (left out)', pl)
        wait_for(lambda: 'video_start' in steps_of(PGID) and 'cta_visible' in steps_of(PGID), 8, ph)
        check({'video_start', 'cta_visible'} <= set(steps_of(PGID)), 'P2b its steps: the film started, the buttons came into view', steps_of(PGID))
        ph.evaluate("(() => { const v = document.getElementById('fdFilm'); v.currentTime = Math.max(0, v.duration - 0.4); })()")
        wait_for(lambda: 'video_end' in steps_of(PGID), 15, ph)
        st_lines = [e for e in events() if e.get('ev') == 'phone_step' and e.get('pg') == PGID]
        check('video_end' in steps_of(PGID) and all(e.get('test') == 'sandbox' for e in st_lines) and len(st_lines) == len(set(e['what'] for e in st_lines)), 'P2c the film looped: "finished" once; every step once, sandboxed', steps_of(PGID))
        # small screens: the ask still above the fold
        for w, hgt in ((360, 600), (393, 659)):
            sctx, sp = ctx_page(True, vp={'width': w, 'height': hgt}); sp.goto(addr(AD)); sp.wait_for_selector('#front', state='visible'); time.sleep(0.6)
            g = sp.evaluate("({ row: document.querySelector('#front .fd-row').getBoundingClientRect().bottom, share: document.getElementById('fdShare').getBoundingClientRect().bottom, sw: document.documentElement.scrollWidth })")
            check(g['row'] <= hgt and g['share'] <= hgt and g['sw'] <= w, f'P1h at {w} x {hgt}: the ask is above the fold, nothing wider than the screen', g)
            shot(sp, f'p1-front-{w}x{hgt}'); shut(sctx, sp)
        # ---------- P8: Email it, and a wrong address ----------
        ph.tap('#fdEmail'); time.sleep(0.5)
        o = ph.evaluate("""(() => { const f = document.getElementById('fdMail'); return { open: !f.hidden, forms: document.querySelectorAll('#front form').length, news: f.querySelector('input[name=news]').checked, privacy: f.querySelector('.fd-privacy')?.getAttribute('href'), focus: document.activeElement?.id, exp: document.getElementById('fdEmail').getAttribute('aria-expanded') }; })()""")
        check(o['open'] and o['forms'] == 1 and o['news'] is False and o['privacy'] in ('/privacy', 'site/privacy.html') and o['focus'] == 'fdAddr' and o['exp'] == 'true', 'P8 Email it: ONE form, the field focused, the Privacy Policy link, the news box unticked', o)
        ph.fill('#fdAddr', 'not-an-address'); ph.tap('#fdMail button[type=submit]'); time.sleep(0.3)
        check('does not look like an email' in ph.inner_text('#fdMsg') and not outbox(), 'P8b a wrong address: said in a sentence, nothing sent')
        shot(ph, 'p8-front-email-open')
        # ---------- P3: the email ----------
        ph.fill('#fdAddr', 'fixture@example.invalid'); ph.tap('#fdMail button[type=submit]')
        ph.wait_for_function("window.twPhone.state === 'sent'", timeout=30000)
        done = ph.inner_text('#fdMsg')
        check('Sent to f•••@example.invalid' in done and ph.evaluate("document.getElementById('fdMail').hidden"), 'P3 sent: "Sent to f•••@example.invalid", the form closes', done)
        shot(ph, 'p3-front-sent')
        mail = (outbox() or [None])[-1]
        link = mail['text'].split('\n')[2] if mail else ''
        u = urllib.parse.urlsplit(link); q = dict(urllib.parse.parse_qsl(u.query)); h = q.get('tw_handoff', '')
        check(mail and mail['to'] == 'fixture@example.invalid' and 'for your computer' in mail['subject'], 'P3b the mail is in the sandbox outbox, "Your Turnip Works link, for your computer"', mail and mail['subject'])
        check(re.match(r'^https://(dev\.)?turnipworks\.net/$', f'{u.scheme}://{u.netloc}{u.path}') and all(q.get(k) == v for k, v in AD.items()) and re.match(r'^hd_[0-9a-z]+$', h) and '#s=' not in link, 'P3c its link: turnipworks.net + the ad\'s utm_*, rdt_cid and tw_handoff; no seat key', link)
        rec = next((a for a in book() if a['email'] == 'fixture@example.invalid'), None)
        check(rec and rec['links'][-1]['role'] == 'handoff' and rec['links'][-1]['h'] == h and rec['news'] is False, 'P3d stored as a handoff, news off', rec and rec['links'][-1])
        hl = [e for e in events() if e.get('ev') == 'handoff' and e.get('h') == h]
        check(len(hl) == 1 and hl[0].get('via') == 'email' and 'example.invalid' not in json.dumps(hl) and hl[0].get('pg') == PGID and hl[0].get('test') == 'sandbox', 'P3e the funnel\'s "handoff" line, via email (the page\'s id, no address, sandbox)', hl)
        # ---------- P13: the share sheet ----------
        n_sh = len(handoffs('share'))
        ph.tap('#fdShare'); ph.wait_for_function("window.twPhone.state === 'shared'", timeout=10000)
        shared = ph.evaluate('window.__shared'); su = urllib.parse.urlsplit(shared['url']); sq = dict(urllib.parse.parse_qsl(su.query)); sh_h = sq.get('tw_handoff', '')
        check(all(sq.get(k) == v for k, v in AD.items()) and re.match(r'^hd_[0-9a-z]{12}$', sh_h) and su.path == '/' and 'computer' in shared.get('text', ''), 'P13 the share sheet gets the visit\'s link: utm_*, rdt_cid, its own tw_handoff', shared)
        hs = wait_for(lambda: [e for e in handoffs('share') if e.get('h') == sh_h], 5, ph)
        check(len(hs) == 1 and hs[0].get('pg') == PGID and (hs[0].get('landing') or {}).get('utm_content') == 'film-15c-4x5' and hs[0].get('test') == 'sandbox' and {'tap_share', 'share_done'} <= set(steps_of(PGID)), 'P13b shared: the "handoff" line via share, and the steps tap_share, share_done', hs)
        check('Sent' in ph.inner_text('#fdMsg'), 'P13c it says so', ph.inner_text('#fdMsg'))
        ph.evaluate('window.__shareCancel = true'); ph.tap('#fdShare'); wait_for(lambda: 'share_cancel' in steps_of(PGID), 8, ph)
        check('share_cancel' in steps_of(PGID) and len(handoffs('share')) == n_sh + 1, 'P13d a cancelled share: "share_cancel", no handoff', steps_of(PGID))
        # ---------- P14: copy link ----------
        ph.tap('#fdCopy'); ph.wait_for_function("window.twPhone.state === 'copied'", timeout=10000)
        clip = ph.evaluate('navigator.clipboard.readText()'); cq = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(clip).query))
        hc = wait_for(lambda: [e for e in handoffs('copy') if e.get('h') == cq.get('tw_handoff')], 5, ph)
        check(all(cq.get(k) == v for k, v in AD.items()) and len(hc) == 1 and {'tap_copy', 'copy_ok'} <= set(steps_of(PGID)) and 'copied' in ph.inner_text('#fdMsg').lower(), 'P14 Copy link: the clipboard holds the visit\'s link; the "handoff" line via copy', clip)
        shot(ph, 'p14-front-copied')
        # ---------- P15: the calendar reminder ----------
        with ph.expect_request(lambda r: '/linkmail/handoff/ics' in r.url, timeout=15000) as ri: ph.tap('#fdIcs')
        ics_url = ri.value.url; iq = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(ics_url).query))
        time.sleep(0.8)
        if not live or ics_url.startswith('http://127.0.0.1'): r_ics = urllib.request.urlopen(urllib.request.Request(ics_url, headers=UA), timeout=15)
        else: r_ics = urllib.request.urlopen(urllib.request.Request(relay + '/linkmail/handoff/ics?' + urllib.parse.urlsplit(ics_url).query, headers=UA), timeout=15)
        body = r_ics.read().decode(); unf = body.replace('\r\n ', '')
        t_local = time.localtime(int(iq.get('t', '0')) / 1000)
        hi = [e for e in handoffs('ics') if e.get('h') == iq.get('h')]
        check(r_ics.headers.get('content-type', '').startswith('text/calendar') and 'BEGIN:VEVENT' in body and 'Try Turnip Works on my computer' in body and f"tw_handoff={iq.get('h')}" in unf and 'utm_content=film-15c-4x5' in unf and t_local.tm_hour == 19 and t_local.tm_min == 0, 'P15 Reminder: a calendar file at 7 pm with the link in it', (r_ics.headers.get('content-type'), time.strftime('%a %H:%M', t_local)))
        check(len(hi) == 1 and 'tap_ics' in steps_of(PGID) and all(len(l.encode()) <= 75 for l in body.split('\r\n')), 'P15b the "handoff" line via ics; the file\'s lines folded at 75 octets', hi)
        # ---------- P16: no share sheet ----------
        nctx, nph = ctx_page(True, share=False, init="delete Navigator.prototype.share; try { delete navigator.share; } catch {}")
        nph.goto(addr(AD)); nph.wait_for_selector('#front', state='visible'); time.sleep(1)
        ns = nph.evaluate("({ cls: document.getElementById('front').classList.contains('no-share'), share: getComputedStyle(document.getElementById('fdShare')).display, row: document.querySelector('#front .fd-row').getBoundingClientRect().bottom, pg: window.twPhone.pg })")
        wait_for(lambda: 'cta_visible' in steps_of(ns['pg']), 5, nph)
        check(ns['cls'] and ns['share'] == 'none' and ns['row'] <= 664 and 'cta_visible' in steps_of(ns['pg']), 'P16 no share sheet: the three buttons, the primary hidden, in view', ns)
        shot(nph, 'p16-front-no-share'); shut(nctx, nph)
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
        sctx2, sk = ctx_page(False)
        sk.goto(origin + '/?' + su.query + (f'&relay={urllib.parse.quote(RELAY, safe="")}' if not live else '')); sk.wait_for_selector('#start:not([hidden])', timeout=90000); time.sleep(1.2)
        so = [e for e in events() if e.get('ev') == 'handoff_open' and e.get('h') == sh_h]
        check(len(so) == 1 and so[0].get('device') == 'desktop' and (sk.evaluate("JSON.parse(localStorage.getItem('tw.landing') || 'null')") or {}).get('handoff') == sh_h, 'P4f the SHARED link opened on a computer: its own "handoff opened" line, the note keeps it', so)
        shut(sctx2, sk)
        # ---------- P5: a computer at the front door, the same ad link: unchanged ----------
        cctx, cp = ctx_page(False)
        cp.goto(addr(AD)); cp.wait_for_selector('#start:not([hidden])', timeout=90000); time.sleep(1.5)
        check(not cp.evaluate("getComputedStyle(document.getElementById('front')).display !== 'none' || window.TW_PHONE || window.TW_HAND || document.documentElement.classList.contains('tw-hand')") and any('/main.js' in r for r in cp.reqs) and not any('/phone.js' in r for r in cp.reqs), 'P5 a computer: the start page as before (main.js; no front door, no phone.js, no phone layout)')
        check(not cp.errs, 'P5b no page errors', cp.errs)
        shot(cp, 'p5-desktop-unchanged'); shut(cctx, cp)
        # ---------- P6: a phone opening a seat link ----------
        r = urllib.request.Request(relay + '/campaigns', data=json.dumps({'name': 'TEST phone seat (throwaway)', 'gm': 'G'}).encode(), headers={'content-type': 'application/json', 'x-tw-test': tw_sandbox.SID, **UA}, method='POST')
        c6 = json.loads(urllib.request.urlopen(r, timeout=30).read()); tw_sandbox._made.append((relay, c6['campaign'], c6['token'], 'TEST phone seat (throwaway)'))
        sctx, sp = ctx_page(True); sp.goto(addr(token=c6['token'])); time.sleep(4)
        check(not sp.evaluate("getComputedStyle(document.getElementById('front')).display !== 'none' || window.TW_PHONE") and sp.evaluate("document.documentElement.classList.contains('tw-hand')") and any('/main.js' in r for r in sp.reqs), 'P6 a phone with a seat link: the table, laid out for a phone, no front door')
        shut(sctx, sp)
        # ---------- P17: "Or try it on this phone"; remembered ----------
        ph.evaluate('window.__shareCancel = false')
        ph.tap('#fdHere'); ph.wait_for_selector('#start:not([hidden])', timeout=90000); time.sleep(1.5)
        g = ph.evaluate("({ front: !!document.getElementById('front') && getComputedStyle(document.getElementById('front')).display !== 'none', hand: document.documentElement.classList.contains('tw-hand'), ok: !!localStorage.getItem('tw.phone.ok'), TW_PHONE: window.TW_PHONE })")
        check(not g['front'] and g['hand'] and g['ok'] and not g['TW_PHONE'] and any('/main.js' in u for u in ph.reqs), 'P17 "Or try it on this phone": the game, laid out for a phone (the start page); remembered', g)
        check('tap_here' in steps_of(PGID), 'P17b the step tap_here', steps_of(PGID))
        shot(ph, 'p17-front-then-game')
        p2 = pctx.new_page(); p2.goto(addr(AD)); p2.wait_for_selector('#start:not([hidden])', timeout=90000)
        check(not p2.evaluate("window.TW_PHONE") and p2.evaluate("document.documentElement.classList.contains('tw-hand')"), 'P17c the next visit on this phone: straight to the game')
        p2.close(); shut(pctx, ph)
        # ---------- P18: a phone that remembers a game ----------
        rctx, rph = ctx_page(True, init="try { localStorage.setItem('tw.games', JSON.stringify([{campaign: 'c', token: 'x', name: 'Old', seat: 'G', role: 'gm', lastUsed: 1}])); } catch {}")
        rph.goto(addr(AD)); time.sleep(3)
        check(not rph.evaluate("window.TW_PHONE") and not any('/phone.js' in u for u in rph.reqs) and any('/main.js' in u for u in rph.reqs), 'P18 a phone that remembers a game (a returning GM): the game, no front door')
        shut(rctx, rph)
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
        ip.wait_for_selector('#front', state='visible', timeout=60000); time.sleep(0.8)
        pl = [e for e in events()[n0:] if e.get('ev') == 'phone']
        L = (pl[-1].get('landing') or {}) if pl else {}
        check(len(pl) == 1 and all(L.get(k) == v for k, v in GOOGLE.items()) and pl[0].get('test') == 'sandbox', 'P11b the front door\'s "shown" line carries the utm_* and the gclid', pl)
        ip.tap('#fdEmail'); ip.fill('#fdAddr', 'fixture@example.invalid'); ip.tap('#fdMail button[type=submit]')
        ip.wait_for_function("window.twPhone.state === 'sent'", timeout=30000)
        mail = (outbox() or [None])[-1]
        link = mail['text'].split('\n')[2] if mail else ''
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(link).query))
        check(all(q.get(k) == v for k, v in GOOGLE.items()) and q.get('tw_handoff'), 'P11c the emailed link carries them to the computer', link)
        shut(ipc, ip)
        # ---------- P9: the real mail through the dev relay (box-local, so marked `local`) ----------
        if A.real_mail:
            rctx, rp = ctx_page(True, country=None, sandboxed=False)
            rp.goto(addr({**AD, 'utm_campaign': 'phone-real-mail'})); rp.wait_for_selector('#front', state='visible', timeout=60000); rp.tap('#fdEmail')
            rp.fill('#fdAddr', A.real_mail); rp.tap('#fdMail button[type=submit]'); rp.wait_for_function("window.twPhone.state === 'sent'", timeout=60000)
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
