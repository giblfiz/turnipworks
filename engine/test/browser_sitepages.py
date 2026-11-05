#!/usr/bin/env python3
"""THE SITE PAGES: About, Terms, Privacy, and the game's links to them.  (2026-10-21)

  TW_GPU=1 python3 engine/test/browser_sitepages.py --local
  TW_GPU=1 python3 engine/test/browser_sitepages.py --page http://127.0.0.1:8180
  (TW_PORTS=a,b when another worktree runs --local at the same time)

  BUILD  the committed engine/client/site/*.html match docs/site/*.md (engine/tools/build_site.py --check)
  PAGE   each page loads with no console error, carries its title and a "Last updated" date, has no "placeholder" in it,
         and reads on a 400-px phone (no sideways scroll, body text >= 15 px); every link to another site page resolves
  START  a first visit's start card shows Manual · About · Terms · Privacy · Source and each opens its page
  SET    (--local) in a live table, Settings shows the same row under Other games, and each opens its page
  ROUTE  (--page, a server behind nginx: dev at 127.0.0.1:8180) every page above answers 200 as HTML, /about/ and
         /about.html 301 to /about, and the game root, /engine/client/, /look/version.json, /play and /api/tw-relay/health
         still answer as before
--local serves the repo with a throwaway relay (the pages at /engine/client/site/<name>.html, the address the alternate
entry uses); --page checks the clean addresses. Writes nothing outside a throwaway campaign.
"""
import argparse, asyncio, atexit, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page', help='site origin behind nginx, e.g. http://127.0.0.1:8180'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
if not A.local and not A.page: ap.error('choose --local or --page ORIGIN')
PAGES = {'about': 'About Turnip Works', 'terms': 'Terms of Use', 'privacy': 'Privacy Policy', 'connect-dnd-beyond': 'Connect D&D Beyond',
         'features': 'A tour of Turnip Works', 'dice': 'Dice for your game system', 'switching': 'Coming from Roll20, Foundry, Owlbear Rodeo or TaleSpire?',
         'export': 'Take your maps to Foundry, Roll20 or Fantasy Grounds', 'manual': 'The Turnip Works manual'}  # (the guide pages for ad sitelinks: 2026-11-04)  # (the help page: 2026-10-29; its film and Settings entry: browser_ddbpage.py)
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
@atexit.register
def _cleanup():
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    for pr in procs:
        try: pr.wait(timeout=5)
        except subprocess.TimeoutExpired: pr.kill(); pr.wait()
    for d in tmp: shutil.rmtree(d, ignore_errors=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18351,18951').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-sitepages-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    origin = f'http://127.0.0.1:{SP}'
    return origin, origin + '/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
RAW = urllib.request.build_opener(NoRedirect)
def head(url):
    try: r = RAW.open(urllib.request.Request(url, headers={'User-Agent': 'tw-sitepages-test'}), timeout=10); return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e: return e.code, e.headers, e.read()

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=100); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False

READ = """() => {
  const p = document.querySelector('main p:not(.updated)');
  return { title: document.querySelector('h1')?.textContent || '', updated: document.querySelector('.updated')?.textContent || '',
    sw: document.documentElement.scrollWidth, w: innerWidth, font: p ? parseFloat(getComputedStyle(p).fontSize) : 0,
    fam: getComputedStyle(document.body).fontFamily, text: document.body.innerText,
    links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')) };
}"""

async def main():
    print('BUILD'); r = subprocess.run([shutil.which('python3') or sys.executable, os.path.join(ENGINE, 'tools', 'build_site.py'), '--check'], capture_output=True, text=True)
    check(r.returncode == 0, 'committed pages match docs/site/*.md', (r.stdout + r.stderr).strip())
    if A.local: origin, game = start_local(); addr = lambda p: f'{origin}/engine/client/site/{p}.html'
    else: origin = A.page.rstrip('/'); game = origin + '/'; addr = lambda p: f'{origin}/{p}'
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL])
        print('PAGE')
        for name, title in PAGES.items():
            ctx = await browser.new_context(viewport={'width': 400, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}')); pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
            resp = await pg.goto(addr(name)); await pg.wait_for_load_state('networkidle')
            d = await pg.evaluate(READ)
            check(resp and resp.status == 200, f'{name}: loads', resp and resp.status)
            check(not errs, f'{name}: no console errors', '; '.join(errs)[:300])
            check(d['title'] == title, f'{name}: title', d['title'])
            check(re.match(r'Last updated \d{1,2} \w+ 20\d\d$', d['updated']), f'{name}: dated', d['updated'])
            check('placeholder' not in d['text'].lower(), f'{name}: never says placeholder')
            check(d['sw'] <= d['w'], f'{name}: no sideways scroll at 400 px', f"{d['sw']} vs {d['w']}")
            check(d['font'] >= 15 and 'Inter' in d['fam'], f'{name}: readable body text in Inter', f"{d['font']}px {d['fam'][:40]}")
            if not A.local:  # the clean addresses only exist behind nginx
                inner = sorted({h for h in d['links'] if h.startswith('/')})
                bad = [h for h in inner if head(origin + h)[0] != 200]
                check(not bad, f'{name}: its site links resolve ({", ".join(inner)})', bad)
            await pg.screenshot(path=os.path.join(tempfile.gettempdir(), f'tw-sitepage-{name}-400.png'), full_page=False)
            await ctx.close()

        print('START')
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
        await pg.goto(game)
        check(await wait(pg, "!!document.querySelector('#start:not([hidden]) .metalinks a')", 30000, 'start card'), 'start card shows the link row')
        links = await pg.evaluate("[...document.querySelectorAll('#start .metalinks a')].map(a => [a.textContent, a.href])")
        check([t for t, _ in links] == ['Manual', 'About', 'Terms', 'Privacy', 'Source'], 'start card: Manual · About · Terms · Privacy · Source', [t for t, _ in links])
        for label, href in links[:4]:
            want = addr(label.lower())
            check(href == want, f'start card: {label} points at {want}', href)
            async with ctx.expect_page() as newp: await pg.click(f'#start .metalinks a:text-is("{label}")')
            np = await newp.value; await np.wait_for_load_state('load')
            check(await np.evaluate("document.querySelector('h1')?.textContent") == PAGES[label.lower()], f'start card: {label} opens its page in a new tab')
            await np.close()
        check(links and links[-1][1] == 'https://github.com/giblfiz/turnipworks', 'start card: Source is the public repo', links[-1][1] if links else None)
        check(not errs, 'start card: no page errors', errs[:3])

        if A.local:
            print('SET')
            await pg.fill('#newCampaign input[name=name]', 'TEST site pages ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await pg.click('#newCampaign button')
            check(await wait(pg, 'window.tw && tw.ready && tw.ready()', 60000), 'table live')
            await pg.evaluate("tw.settings.show('nav')")
            check(await wait(pg, "!!document.querySelector('#settingsModal .smeta a')", 8000, 'settings links'), 'Settings shows the link row')
            sl = await pg.evaluate("[...document.querySelectorAll('#settingsModal .smeta a')].map(a => [a.textContent, a.href, a.target])")
            check([t for t, _, _ in sl] == ['Manual', 'About', 'Terms', 'Privacy', 'Source'], 'Settings: Manual · About · Terms · Privacy · Source', [t for t, _, _ in sl])
            check(all(t == '_blank' for _, _, t in sl), 'Settings: the links open a new tab (the table stays)')
            for label, href, _ in sl[:4]:
                check(href == addr(label.lower()), f'Settings: {label} points at its page', href)
                async with ctx.expect_page() as newp: await pg.click(f'#settingsModal .smeta a:text-is("{label}")')
                np = await newp.value; await np.wait_for_load_state('load')
                check(await np.evaluate("document.querySelector('h1')?.textContent") == PAGES[label.lower()], f'Settings: {label} opens its page')
                await np.close()
            check(await pg.evaluate("tw.ready()"), 'the table is still live after opening them')
        await browser.close()

    if not A.local:
        print('ROUTE')
        for name in PAGES:
            st, h, body = head(f'{origin}/{name}')
            check(st == 200 and 'text/html' in (h.get('Content-Type') or ''), f'/{name}: 200 text/html', f"{st} {h.get('Content-Type')}")
            for alt in (f'/{name}/', f'/{name}.html'):
                st, h, _ = head(origin + alt)
                check(st == 301 and (h.get('Location') or '').endswith(f'/{name}'), f'{alt} -> /{name}', f"{st} {h.get('Location')}")
        st, h, body = head(origin + '/'); check(st == 200 and b'tw-channel' in body and b'<base href="/engine/client/">' in body, 'game root: the game page', st)
        check(b'href="/privacy"' in body and b'href="/terms"' in body, 'game root: start card links use the clean addresses')
        st, _, _ = head(origin + '/engine/client/'); check(st == 200, '/engine/client/: 200', st)
        st, _, body = head(origin + '/look/version.json'); check(st == 200 and b'"v"' in body, '/look/version.json: 200', st)
        st, h, _ = head(origin + '/play'); check(st == 301, '/play: 301 (old address)', st)
        st, _, body = head(origin + '/api/tw-relay/health')
        try: ok = st == 200 and json.loads(body).get('ok') is True
        except Exception: ok = False
        check(ok, '/api/tw-relay/health: ok', body[:120])
        st, _, _ = head(origin + '/api/tw-relay/admin/x'); check(st == 404, '/api/tw-relay/admin/: still closed', st)

    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed" + (f"; FAILED: {', '.join(r[1] for r in bad)}" if bad else ''))
    sys.exit(1 if bad else 0)

asyncio.run(main())
