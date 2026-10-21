#!/usr/bin/env python3
"""Returning seats, other games, and default campaign names, through the actual browser.
Run through tw-slot. Optional --live https://turnipworks.net; every campaign is a
TEST … (throwaway), tracked and removed by tw_sandbox. Never print seat credentials.
The local turnipworks.net-shaped server follows browser_join.py (which runs on import).
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
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18247,18877').split(','))
RELAY = f'http://127.0.0.1:{RP}'; API = 'http://127.0.0.1:8096'
SLOW = 3 if FIREFOX else 1
UA = {'User-Agent': 'Mozilla/5.0 tw-continuity-test'}
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
        if not (any(f.startswith(root + os.sep) for root in (os.path.realpath(REPO), os.path.realpath(os.path.join(TUNER, 'assets')))) and os.path.isfile(f)): return self.out(404, b'not found')
        self.out(200, open(f, 'rb').read(), mimetypes.guess_type(f)[0] or 'application/octet-stream')

def start_local():
    import socket
    for port in (RP, SP):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-continuity-'); tmp.append(data)
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
    relay = live + '/api/tw-relay' if live else RELAY
    query = 'nointro&faces=1500' + ('' if live else '&relay=' + urllib.parse.quote(RELAY, safe=''))
    def addr(fragment=''): return origin + '/?' + query + ('#' + fragment if fragment else '')
    def games(pg): return pg.evaluate("JSON.parse(localStorage.getItem('tw.games') || '[]')")
    def opened(pg):
        pg.wait_for_function('window.twLoad && (twLoad.failed || (twLoad.times.frame && window.tw && tw.ready && tw.ready()))', timeout=120000)
        if not pg.evaluate('!!twLoad.failed'): pg.locator('#twl').wait_for(state='hidden')
        return pg.evaluate("({failed:twLoad.failed || null, campaign:window.tw?.sync?.campaign?.id, seat:window.tw?.sync?.campaign?.me, role:window.tw?.sync?.campaign?.my?.role})")
    def create(pg, name):
        pg.fill('#newCampaign [name=name]', name)
        pg.fill('#newCampaign [name=gm]', 'Continuity GM')
        pg.click('#newCampaign button[type=submit]')
        state = opened(pg)
        assert not state['failed'], 'test campaign failed to open'
        return state, urllib.parse.parse_qs(urllib.parse.urlsplit(pg.url).fragment)['s'][0]
    def choose(pg, name):
        pg.locator('#rememberedGames button').filter(has_text=name).click()
        return opened(pg)
    os.makedirs(SHOTS, exist_ok=True)
    print('continuity:', origin, flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=GL)
        contexts = []; console_messages = []
        def page(block_storage=False):
            ctx = browser.new_context(viewport={'width':1280,'height':800})
            contexts.append(ctx)
            if block_storage:
                ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}})")
            pg = ctx.new_page(); pg.set_default_timeout(90000)
            pg.on('console', lambda msg: console_messages.append(msg.text))
            if not live: tw_sandbox.proxy(pg, API)
            return ctx, pg
        ctx, gm = page()
        gm.goto(addr())
        field = gm.locator('#newCampaign [name=name]')
        field.wait_for(state='visible')
        first = field.input_value()
        good_name = lambda s: bool(re.fullmatch(r'The ([A-Z][a-z]+) ([A-Z][a-z]+) Campaign', s)) and s.split()[1] != s.split()[2]
        check(good_name(first), 'C1 default has two distinct title-cased words', first)
        gm.click('#rerollCampaign'); second = field.input_value()
        check(good_name(second) and second != first, 'C2 dice rerolls the editable default', second)
        name_a, name_b = 'TEST continuity A (throwaway)', 'TEST continuity B (throwaway)'
        a, token_a = create(gm, name_a)
        remembered = games(gm)
        check(len(remembered)==1 and remembered[0]['campaign']==a['campaign'] and remembered[0]['token']==token_a and remembered[0]['name']==name_a and remembered[0]['role']=='gm' and bool(remembered[0]['seat']) and remembered[0]['lastUsed']>0, 'C3 successful create remembers campaign, credential, name, seat, role and time')
        cookie_text = json.dumps(ctx.cookies())
        check(token_a not in cookie_text, 'C4 seat credential is not put in a cookie')
        gm.goto(addr()); resumed = opened(gm)
        check(resumed['campaign']==a['campaign'] and '#s=' in gm.url, 'C5 bare address resumes the remembered game and restores its invite address')
        check(gm.evaluate('!!twLoad.times.frame && !twLoad.failed'), 'C6 resumed game goes through loading to a rendered frame')
        gm.click('#otherGames'); gm.locator('#rememberedGames').wait_for(state='visible')
        check(urllib.parse.urlsplit(gm.url).fragment=='games' and name_a in gm.locator('#rememberedGames').inner_text(), 'C7 persistent Other games entry opens the remembered game list')
        gm.click('#startNewCampaign'); field.wait_for(state='visible')
        b, token_b = create(gm, name_b)
        check(len(games(gm))==2, 'C8 second game is remembered alongside the first')
        gm.goto(addr()); check(opened(gm)['campaign']==b['campaign'], 'C9 bare address chooses the most recently used game')
        gm.goto(addr('s='+token_a)); check(opened(gm)['campaign']==a['campaign'], 'C10 explicit invite wins over the most recent remembered game')
        check(max(games(gm),key=lambda x:x['lastUsed'])['token']==token_a, 'C11 successful invite updates last-used order without duplicating the seat')
        gm.evaluate("tw.settings.show('me')")
        settings_link = gm.get_by_role('button',name='Other games / New game',exact=True)
        # The persistent entry may share this label; the Settings entry must add another.
        check(settings_link.count() >= 2, 'C12 Settings also offers Other games / New game')
        gm.screenshot(path=os.path.join(SHOTS,'continuity-settings.png'))
        settings_link.last.click(); gm.locator('#rememberedGames').wait_for(state='visible')
        listing = gm.locator('#rememberedGames').inner_text()
        check(name_a in listing and name_b in listing and re.search(r'gm|game master',listing,re.I) is not None and re.search(r'last|ago|just|today|used',listing,re.I) is not None, 'C13 list shows both campaign names, seat role and last-used time')
        gm.screenshot(path=os.path.join(SHOTS,'continuity-games.png'))
        check(choose(gm,name_b)['campaign']==b['campaign'], 'C14 choosing the other game switches and joins it')
        gm.click('#otherGames'); gm.locator('#rememberedGames').wait_for(state='visible')
        check(choose(gm,name_a)['campaign']==a['campaign'], 'C15 switching back rejoins the first game')
        before_rename = max(games(gm),key=lambda x:x['lastUsed'])['lastUsed']
        gm.evaluate("tw.sync.submit('campaign.set',{name:'TEST continuity renamed (throwaway)'})")
        gm.wait_for_function("JSON.parse(localStorage.getItem('tw.games')).some(g=>g.name==='TEST continuity renamed (throwaway)')")
        check(max(games(gm),key=lambda x:x['lastUsed'])['lastUsed']==before_rename, 'C15b campaign rename refreshes remembered name without altering last-used time')
        player_token = gm.evaluate("tw.createSeat({kind:'human',role:'player',name:'Continuity Player',color:'#33aa77'})")
        pctx, pl = page(); pl.goto(addr('s='+player_token)); ps = opened(pl)
        check(ps['campaign']==a['campaign'] and ps['role']=='player' and len(games(pl))==1, 'C16 independent browser remembers only its own player seat')
        other_tab=ctx.new_page(); other_tab.goto(addr('games')); other_tab.locator('#forgetGames').click()
        gm.evaluate("tw.sync.submit('campaign.set',{name:'TEST continuity after forget (throwaway)'})")
        gm.wait_for_function("tw.sync.campaign.name==='TEST continuity after forget (throwaway)'")
        check(games(gm)==[], 'C16b forgetting in another tab survives a passive campaign metadata update')
        gm.click('#otherGames'); gm.locator('#gamesEmpty').wait_for(state='visible')
        check(games(gm)==[] and name_a not in gm.locator('#rememberedGames').inner_text(), 'C17 Forget this browser games clears storage and list')
        gm.goto(addr()); field.wait_for(state='visible')
        check('#s=' not in gm.url, 'C18 forgotten browser opens the start form at the bare address')
        pl.goto(addr()); check(opened(pl)['role']=='player' and len(games(pl))==1, 'C19 forgetting in one browser leaves the second seat unaffected')
        gm.goto(addr('s='+token_a)); opened(gm)
        seat_id=pl.evaluate('tw.sync.me')
        pl.goto('about:blank')
        gm.evaluate('who=>tw.revokeSeat(who)',seat_id)
        gm.wait_for_function('who=>!tw.sync.campaign.seats.some(s=>s.id===who)',arg=seat_id)
        pl.goto(addr()); pl.locator('#newCampaign [name=name]').wait_for(state='visible')
        sentence='That remembered game is no longer available; it has been forgotten.'
        check(sentence in pl.locator('body').inner_text() and games(pl)==[], 'C20 revoked remembered seat is forgotten and falls back to start with the plain sentence')
        pl.goto(addr('s='+player_token)); denied=opened(pl)
        check(denied['failed']=='denied', 'C21 rejected explicit invite keeps the normal informative loading failure')
        deleted_ctx, deleted = page(); deleted.goto(addr('s='+token_b)); opened(deleted)
        deleted.goto('about:blank')
        removed = post(f"{relay}/c/{b['campaign']}/delete?seat={token_b}&purge=1")
        assert removed.get('ok'), 'throwaway campaign delete failed'
        tw_sandbox._made[:] = [row for row in tw_sandbox._made if row[1] != b['campaign']]
        deleted.goto(addr()); deleted.locator('#newCampaign [name=name]').wait_for(state='visible')
        check(sentence in deleted.locator('body').inner_text() and games(deleted)==[], 'C21b deleted remembered campaign is forgotten and falls back to start with the plain sentence')
        blocked_ctx, blocked = page(True)
        blocked.goto(addr()); blocked.locator('#newCampaign [name=name]').wait_for(state='visible')
        check(good_name(blocked.locator('#newCampaign [name=name]').input_value()), 'C22 storage unavailable still shows the form and generated name')
        no_storage, _ = create(blocked,'TEST continuity no storage (throwaway)')
        check(no_storage['role']=='gm', 'C23 storage unavailable still creates and joins a campaign')
        blocked.goto(addr('s='+token_a)); check(opened(blocked)['campaign']==a['campaign'], 'C24 storage unavailable still joins an existing invite')
        blocked.goto(addr()); blocked.locator('#newCampaign [name=name]').wait_for(state='visible')
        check('#s=' not in blocked.url, 'C25 storage unavailable bare address remains usable')
        check(not any(token in msg for token in (token_a,token_b,player_token) for msg in console_messages), 'C26 seat credentials are never printed in browser console')
        for context in contexts:
            for pg in context.pages:
                try: pg.goto('about:blank'); pg.unroute_all(behavior='ignoreErrors')
                except Exception: pass
            context.close()
        browser.close()

try: main()
finally: cleanup()
bad = [r for r in results if not r[0]]
print(f'\n{len(results)-len(bad)} of {len(results)} passed' + (': '+ '; '.join(r[1] for r in bad) if bad else ''))
sys.exit(1 if bad else 0)
