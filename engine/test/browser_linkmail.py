#!/usr/bin/env python3
""""Email yourself your link" and the funnel, in real browsers.  (2026-10-23; docs/UI.md "Email yourself your link",
docs/NETCODE.md "The funnel", "Email yourself your link")

  local: python3 engine/test/browser_linkmail.py     (own relay + site, TW_PORTS)
  dev:   ... browser_linkmail.py --live http://127.0.0.1:8180 --data /var/lib/tw-relay-dev/data

Every address typed here goes to the relay's link-mail TEST SANDBOX (X-TW-Test), so its mail lands only in that
sandbox's outbox; the one real-looking address used is fixture@example.invalid. The GM's table in F1 is made WITHOUT the
sandbox header and with a Cloudflare country (as a real visitor's), so the funnel counts it; it is excluded by hand at
the end (funnel_report.mjs --exclude) and deleted.

  F1 a GM starts a table (start form, from the US, landing with utm_source) and a player joins from the invite: ONE
     played event, together; the landing kept; reloads and a second browser on the same seat add nothing
  F2 a table made by a sandboxed browser is recorded but left out of the count
  M1 the card: LOUD a few seconds in (not at once), never over the middle of the table, the news box unticked, a
     Privacy Policy link, the table still answers clicks under it
  M2 untouched, it settles into the chat as a line with "Email me"; one line, not one per visit
  M3 the next visit (reload): loud again
  M4 the line's button opens it; send: "Sent to f•••@example.invalid", the mail is in the sandbox outbox (link first,
     sender named, opt-out link), the address is stored as role gm, US, ad_matching_eligible true, news false
  M5 after saving: the next visit shows no card, the relay says saved
  M6 a player's first arrival: the placeholder offer first, the card only after it has gone into the chat; from
     Germany: stored NOT ad-eligible, role player
  M7 the opt-out page from the mail: a press -> never for ads; delete -> gone from the book
"""
import argparse, glob, http.server, json, mimetypes, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.link_mail(True)          # this suite is about the card
tw_sandbox.placeholder_pawns(True)  # and the arrival it must not shout over

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
TUNER = os.path.join(REPO, 'tools', 'spawn-tuner'); SHOTS = os.path.join(REPO, 'experiments', '2026-10-23-linkmail', 'stills')
ap = argparse.ArgumentParser(); ap.add_argument('--live'); ap.add_argument('--data'); ap.add_argument('--no-shots', action='store_true'); ap.add_argument('--local', action='store_true')  # (the default; for the matrix)
A = ap.parse_args()
GL = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18293,18946').split(','))
RELAY = f'http://127.0.0.1:{RP}'; API = 'http://127.0.0.1:8096'
UA = {'User-Agent': 'Mozilla/5.0 tw-linkmail-test'}
results = []; procs = []; tmp = []; made = []
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
        m = re.match(r'^/look/((?:js|data|assets)/.+|version\.json)$', path); f = None
        if m: f = os.path.join(TUNER, m.group(1))
        elif path.startswith('/engine/'): f = os.path.join(ENGINE, path[len('/engine/'):])
        else: return self.out(404, b'not found')
        f = os.path.realpath(f)
        roots = (os.path.realpath(REPO), os.path.realpath(os.path.join(TUNER, 'assets')))
        if not (any(f.startswith(root + os.sep) for root in roots) and os.path.isfile(f)): return self.out(404, b'not found')
        self.out(200, open(f, 'rb').read(), mimetypes.guess_type(f)[0] or 'application/octet-stream')

def start_local():
    data = tempfile.mkdtemp(prefix='tw-linkmail-'); tmp.append(data)
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

def main():
    live = A.live.rstrip('/') if A.live else None
    data = A.data if live else start_local()
    origin = live or f'http://127.0.0.1:{SP}'
    relay = (live + '/api/tw-relay') if live else RELAY
    admin = open(os.path.join(data, 'admin-key')).read().strip()
    direct = 'http://127.0.0.1:8098' if live else RELAY  # /admin/ is answered only on the relay's own port
    def addr(token=None, switches='faces=1500'):
        q = '&'.join(x for x in ((('relay=' + urllib.parse.quote(RELAY, safe='')) if not live else ''), switches) if x)
        return origin + '/' + (f'?{q}' if q else '') + (f'#s={token}' if token else '')
    def funnel(tables=True):
        r = urllib.request.Request(f'{direct}/admin/funnel?days=1{"&tests=1" if tables else ""}', headers={'x-tw-admin': admin, **UA})
        return json.loads(urllib.request.urlopen(r, timeout=20).read())
    def book():
        f = os.path.join(data, 'linkmail', 'test-sandbox', tw_sandbox.SID, 'addresses.json')
        try: return list(json.load(open(f))['addrs'].values())
        except Exception: return []
    def outbox():
        return [json.load(open(f)) for f in sorted(glob.glob(os.path.join(data, 'linkmail', 'test-sandbox', tw_sandbox.SID, 'outbox', '*.json')))]
    if not A.no_shots: os.makedirs(SHOTS, exist_ok=True)
    shot = lambda pg, name: None if A.no_shots else pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=GL)
        def page(country='US', counted=False):
            """counted: this browser's POST /campaigns goes WITHOUT the sandbox header (a real visitor's); every link-mail call
            is still sandboxed. country: what Cloudflare would say (CF-IPCountry), added after the browser's own CORS check."""
            ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1); pg = ctx.new_page(); pg.set_default_timeout(90000)
            pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200]))
            if not live: tw_sandbox.proxy(pg, API)
            def camp(route):
                if route.request.method != 'POST': return route.continue_()
                h = {**route.request.headers, 'cf-ipcountry': country}
                if not counted: h['x-tw-test'] = tw_sandbox.SID
                resp = route.fetch(headers=h)
                try:
                    b = resp.json()
                    if b.get('ok'): made.append((relay, b['campaign'], b['token']))
                except Exception: pass
                route.fulfill(response=resp)
            def lm(route): route.continue_(headers={**route.request.headers, 'cf-ipcountry': country, 'x-tw-test': tw_sandbox.SID})
            pg.route('**/campaigns', camp); pg.route(tw_sandbox.LINKMAIL, lm)
            return ctx, pg
        def opened(pg):
            pg.wait_for_function('window.twLoad && (twLoad.failed || (twLoad.times.frame && window.tw && tw.ready && tw.ready() && tw.loaded()))', timeout=150000)
            return pg.evaluate("({ failed: twLoad.failed || null, role: tw.sync.campaign?.my?.role, campaign: tw.sync.campaign?.id })")
        card = lambda pg: pg.evaluate("(() => { const e = document.getElementById('linkMail'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(), ch = document.getElementById('chat').getBoundingClientRect(); const hid = [...document.querySelectorAll('#chat .line')].filter(l => { const q = l.getBoundingClientRect(); if (!q.width || q.bottom < ch.top) return false; const t = document.elementFromPoint(q.left + Math.min(q.width - 2, 40), q.top + q.height / 2); return !!t?.closest?.('#linkMail'); }).map(l => l.textContent.slice(0, 50)); return { hides: hid, overChat: Math.round(r.bottom - ch.top), chatTop: Math.round(ch.top), cardBottom: Math.round(r.bottom), loud: e.classList.contains('loud'), open: e.classList.contains('opened'), x: r.left, y: r.top, w: r.width, h: r.height, news: e.querySelector('input[name=news]')?.checked ?? null, privacy: e.querySelector('.lm-privacy')?.getAttribute('href') || null, text: e.innerText.slice(0, 300) }; })()")
        lines = lambda pg: pg.evaluate("tw.actionLines.list().filter(l => l.kind === 'linkmail')")

        print(f'link mail + funnel: {origin}')
        # ---------- F1 / M1: the GM, a counted table ----------
        gctx, gm = page('US', counted=True)
        gm.goto(addr(switches='faces=1500&utm_source=testads&utm_campaign=lm1'))
        gm.fill('#newCampaign [name=name]', 'Lantern Hall'); gm.fill('#newCampaign [name=gm]', 'Gina'); gm.click('#newCampaign button[type=submit]')
        g = opened(gm); cid = g['campaign']
        check(not g['failed'] and g['role'] == 'gm', 'F1 the GM starts a table with the start form', g)
        check('utm_source' not in gm.url, 'F1b the utm parameters are taken out of the address bar (so they never ride into invite links)', gm.url.split('#')[0])
        t_ready = time.time()
        early = card(gm)
        check(early is None, 'M1 no card at once (it waits for a quiet moment)', early)
        gm.wait_for_function("document.getElementById('linkMail')?.classList.contains('loud')", timeout=60000)
        waited = round(time.time() - t_ready, 1); time.sleep(0.6); c = card(gm)  # (after its entrance)
        check(c and c['loud'] and waited >= 3, f'M1b the card comes LOUD a few seconds in ({waited} s after the table was up; after the intro)', c)
        check(c and c['news'] is False, 'M1c the news box starts unticked', c and c['news'])
        check(c and c['privacy'] in ('/privacy', 'site/privacy.html') and 'Privacy Policy' in c['text'], 'M1d a Privacy Policy link at the field', c and c['privacy'])
        check(c and 'ads' not in c['text'].lower(), 'M1e no ad-use sentence on the card', c and c['text'])
        mid = gm.evaluate("(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e?.id || e?.tagName; })()")
        check(c and c['x'] + c['w'] < 640 and mid == 'c', 'M1f it sits in the chat corner, not over the middle of the table (the canvas is under the centre)', [c and round(c['x'] + c['w']), mid])
        gm.evaluate("tw.dispatch('token.create', { id: 'tok_lmtest0001', name: 'Marker', x: 7.5, z: 2.5 })")
        check(gm.evaluate("!!tw.entities()['tok_lmtest0001']"), 'M1g play goes on with the card up')
        check(c and c['overChat'] <= 0 and not c['hides'], 'M1i it stands above the chat, hiding none of it', c and [c['cardBottom'], c['chatTop'], c['hides']])
        shot(gm, 'm1-gm-card-loud')
        focused = gm.evaluate("document.activeElement === document.querySelector('#linkMail .lm-email')")
        check(not focused, 'M1h it did not take the keyboard')
        # the invite + the player (counted table)
        tok = gm.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Bobby', color: '#33aa77' })")
        link = gm.evaluate('t => tw.inviteLink(t)', tok)
        check('utm_' not in link, 'F1c the invite link carries no utm parameters', link.split('#')[0])
        # ---------- M2: it settles ----------
        gm.wait_for_function("!document.getElementById('linkMail')", timeout=30000)
        L = lines(gm)
        check(len(L) == 1 and L[0]['button'] == 'Email me' and L[0]['state'] is None and L[0]['shown'], 'M2 untouched, it settled into the chat as ONE line with "Email me"', L)
        shot(gm, 'm2-gm-settled-in-chat')
        # ---------- the player joins: played ----------
        pctx, pl = page('DE')
        pl.goto(addr(tok)); v = opened(pl)
        check(not v['failed'] and v['role'] == 'player', 'F1d Bobby opens the invite', v)
        # M6: the placeholder offer first, the card after
        try: pl.wait_for_function("tw.condButtons.has('placeholder-hint')", timeout=20000); hint = True
        except Exception: hint = False
        both = pl.evaluate("!!document.getElementById('linkMail') && tw.condButtons.has('placeholder-hint')")
        check(hint and not both, 'M6 a player\'s first arrival: the "choose who you are" offer comes first, alone', [hint, both])
        shot(pl, 'm6-player-arrival-offer-first')
        pl.wait_for_function("document.getElementById('linkMail')?.classList.contains('loud')", timeout=60000)
        seq = pl.evaluate("({ hint: tw.condButtons.has('placeholder-hint'), hintLine: tw.actionLines.list().some(l => l.kind === 'placeholder-hint') })")
        check(not seq['hint'] and seq['hintLine'], 'M6b the card comes only after the offer has gone down into the chat', seq)
        pc = card(pl)
        check(pc and 'seat link' in pc['text'], 'M6c the player\'s card is about their seat link', pc and pc['text'][:80])
        time.sleep(0.6); pc = card(pl)
        check(pc and pc['overChat'] <= 0 and not pc['hides'], 'M6d it stands above the chat (and the offer\'s line in it), hiding none of it', pc and [pc['cardBottom'], pc['chatTop'], pc['hides']])
        shot(pl, 'm6-player-card-loud')
        time.sleep(1)
        F = funnel(); T = {t['c']: t for t in F.get('tables', [])}
        t1 = T.get(cid, {})
        check(t1.get('played') and t1.get('together') and not t1.get('test') and t1.get('country') == 'US' and t1.get('invites') == 1, 'F1e ONE played table, together, counted, from the US, 1 invite', t1)
        check((t1.get('landing') or {}).get('utm_source') == 'testads', 'F1f its landing: utm_source=testads', t1.get('landing'))
        # reloads and a second browser on the same seat
        pl.reload(); opened(pl); gm.reload(); opened(gm)
        p2ctx, p2 = page('US'); p2.goto(addr(tok)); opened(p2); time.sleep(1)
        T2 = {t['c']: t for t in funnel()['tables']}
        check(T2[cid]['joins'] == 1 and F['totals']['played'] == funnel(False)['totals']['played'], 'F1g reloads and a second browser on the same seat: still one join, one played', T2[cid])
        p2ctx.close()
        # ---------- M3: the next visit is loud again (the GM's reload above) ----------
        gm.wait_for_function("document.getElementById('linkMail')?.classList.contains('loud')", timeout=60000)
        check(len(lines(gm)) <= 1, 'M3 the next visit: loud again (and the old line is not doubled)', lines(gm))
        # ---------- M4: the line's button, and send ----------
        gm.evaluate("tw.linkMail.settle()"); gm.wait_for_function("tw.actionLines.list().some(l => l.kind === 'linkmail' && l.shown)", timeout=10000)
        lid = gm.evaluate("tw.actionLines.list().find(l => l.kind === 'linkmail').id")
        gm.click(f'#chat .line.act[data-act="{lid}"] .abtn')
        gm.wait_for_function("document.getElementById('linkMail')?.classList.contains('opened')", timeout=10000)
        try: gm.wait_for_function("document.activeElement === document.querySelector('#linkMail .lm-email')", timeout=3000); foc = True
        except Exception: foc = False
        check(foc, 'M4 the chat line\'s button opens the card, the field ready to type in', gm.evaluate("(() => { const a = document.activeElement; return a ? a.tagName + '#' + a.id + '.' + a.className : null; })()"))
        if not foc: gm.click('#linkMail .lm-email')
        gm.keyboard.type('fixture@example.invalid'); shot(gm, 'm4-gm-card-typing'); gm.keyboard.press('Enter')
        gm.wait_for_function("document.querySelector('#linkMail.done')", timeout=20000)
        done = gm.evaluate("document.getElementById('linkMail').innerText")
        check('Sent to f•••@example.invalid' in done, 'M4b "Sent to f•••@example.invalid"', done[:120]); shot(gm, 'm4-gm-sent')
        mails = outbox(); m = mails[-1] if mails else {}
        lines_ = (m.get('text') or '').split('\n')
        check(m.get('to') == 'fixture@example.invalid' and 'GM link' in (m.get('subject') or '') and len(lines_) > 2 and lines_[2].startswith('https://') and f'#s=' in lines_[2], 'M4c the mail, in the sandbox outbox: to the address, the GM link first', [m.get('subject'), lines_[:3]])
        check('made by Fauna and giblfiz' in (m.get('text') or '') and 'Implausible Enterprises LLC' in m.get('text', '') and '/linkmail/optout?a=' in m.get('text', ''), 'M4d the sender is named; an opt-out link')
        r = next((a for a in book() if a['email'] == 'fixture@example.invalid'), None)
        check(r and r['links'][0]['role'] == 'gm' and r['links'][0]['c'] == cid and r['country'] == 'US' and r['ad_matching_eligible'] is True and r['news'] is False, 'M4e stored: role gm, the campaign, US, ad_matching_eligible true, news false', r)
        # ---------- M5: saved ----------
        gm.reload(); opened(gm); time.sleep(9)
        check(card(gm) is None and gm.evaluate('tw.linkMail.saved()'), 'M5 after saving, the next visit shows no card', card(gm))
        # ---------- M6d: the player from Germany sends, with news ticked ----------
        if not card(pl): pl.evaluate("tw.linkMail.open('open')")
        pl.click('#linkMail input[name=news]'); pl.fill('#linkMail .lm-email', 'fixture@example.invalid'); pl.click('#linkMail .lm-send')
        pl.wait_for_function("document.querySelector('#linkMail.done')", timeout=20000)
        r2 = next((a for a in book() if a['email'] == 'fixture@example.invalid'), None)
        roles = sorted({l['role'] for l in (r2 or {}).get('links', [])})
        check(r2 and roles == ['gm', 'player'] and r2['ad_matching_eligible'] is False and r2['country'] == 'DE' and r2['news'] is True, 'M6e the same address from Germany (a player, news ticked): now NOT ad-eligible (sticky), both roles, news on', r2)
        # ---------- M7: the opt-out page ----------
        url = re.search(r'https?://\S+/linkmail/optout\?a=\S+', outbox()[-1]['text']).group(0)
        u = urllib.parse.urlsplit(url); here = (live + u.path if live else RELAY + u.path.replace('/api/tw-relay', '', 1)) + '?' + u.query  # (the mail names the public site; here: this run's relay)
        octx, op = page('US'); op.goto(here)
        txt = op.inner_text('main')
        check('Delete my address' in txt and 'f•••@example.invalid' in txt, 'M7 the opt-out page shows the address and its choices', txt[:160]); shot(op, 'm7-optout-page')
        op.click('text=Stop news emails'); op.wait_for_load_state()
        check(next((a for a in book() if a['email'] == 'fixture@example.invalid'), {}).get('news') is False, 'M7b one press: no more news')
        op.click('text=Delete my address'); op.wait_for_load_state()
        check('Deleted' in op.inner_text('main') and not any(a['email'] == 'fixture@example.invalid' for a in book()), 'M7c delete: gone from the book'); shot(op, 'm7-optout-deleted')
        octx.close()
        # ---------- F2: a sandboxed table ----------
        sctx, sb = page('US', counted=False)
        sb.goto(addr()); sb.fill('#newCampaign [name=name]', 'Sandboxed table'); sb.click('#newCampaign button[type=submit]'); s = opened(sb)
        t3 = sb.evaluate("tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#3377aa' })")
        s2ctx, s2 = page('US'); s2.goto(addr(t3)); opened(s2); time.sleep(1)
        T3 = {t['c']: t for t in funnel()['tables']}
        check(T3.get(s['campaign'], {}).get('test') == 'sandbox' and T3[s['campaign']]['played'], 'F2 a sandboxed table that played is recorded as "sandbox" ...', T3.get(s['campaign']))
        check(funnel(False)['totals']['played'] == F['totals']['played'], '... and left out of the count', funnel(False)['totals'])
        errs = gm.errs + pl.errs + sb.errs + s2.errs
        check(not errs, 'no page errors', errs[:4])
        for c_ in (sctx, s2ctx, pctx, gctx): c_.close()
        browser.close()
    # the counted GM table was ours: take it out of the count by hand, then delete what we made
    subprocess.run(['node', os.path.join(ENGINE, 'tools', 'funnel_report.mjs'), '--data', data, '--exclude', cid, 'browser_linkmail verification'], check=False, capture_output=True)
    for (rl, c_, t_) in made: tw_sandbox.delete_campaign(rl, c_, t_)

try: main()
finally: cleanup()
bad = [r for r in results if not r[0]]
print(f'\nbrowser_linkmail: {len(results) - len(bad)}/{len(results)} passed')
sys.exit(1 if bad else 0)
