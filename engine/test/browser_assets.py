#!/usr/bin/env python3
"""THE ASSETS PAGE AND ITS LINKS INTO THE GAME  (2026-11-04; engine/tools/site_assets.py, client/deeplink.js)

  TW_GPU=1 python3 engine/test/browser_assets.py --local
  TW_GPU=1 python3 engine/test/browser_assets.py --page http://127.0.0.1:8180
  (TW_PORTS=a,b when another worktree runs --local at the same time)

  PAGE   the page loads with no console error; the overview lists every pack of /assets.json, each with its own anchor
         (id pack/<slug>), its counts and a picture; the credit line is the house's
  WEIGHT the first view is light: HTML + data + pictures under 1.5 MB, fewer than 40 pictures asked for, and a pack of
         500+ things asks for only the pictures near the screen (lazy)
  PICS   every picture the catalogue names is there (--local: the files; --page: a sample of 60 over HTTP)
  ROUTE  #pack/<slug> draws the pack (one card per thing, a chip per room), #pack/<slug>/<room> its shelves,
         #thing/<id> and #figure/<id> open the asset (name, file link, "Use it in Turnip Works" -> /?place= / /?pawn=),
         #find/<words> finds; closing the asset gives the view back; a bad address falls back
  PHONE  at 390 px nothing scrolls sideways: overview, pack, room, an asset, a search
  GAME   the links act in the game for the GM only, and only arm a tool: ?place=barrel = the barrel's ghost
         (nothing placed, the address cleaned, Esc puts it away); ?pawn= = Add pawn with that figure; ?pack=CRY/crypt-vault
         = the Build menu at that room; a player's seat with ?place= gets no tool and changes nothing
  ROUTE+ (--page) /assets and /assets.json answer (JSON, CORS), /assets/ and /assets.html 301 to /assets
Writes nothing outside a throwaway campaign (named TEST, on a throwaway local relay).
"""
import argparse, asyncio, atexit, json, os, random, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page', help='site origin behind nginx, e.g. http://127.0.0.1:8180'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--only', help='comma list of sections: PAGE,WEIGHT,PICS,ROUTE,PHONE,GAME')
A = ap.parse_args()
if not A.local and not A.page: ap.error('choose --local or --page ORIGIN')
ONLY = set(A.only.split(',')) if A.only else None
want = lambda s: not ONLY or s in ONLY
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

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18361,18961').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-assets-'); site = tempfile.mkdtemp(prefix='tw-assets-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'look'))  # (the page's file links: /look/assets/...)
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    origin = f'http://127.0.0.1:{SP}'
    return origin, origin + '/engine/client/site/assets.html', origin + '/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&faces=1500'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
RAW = urllib.request.build_opener(NoRedirect)
def head(url):
    try: r = RAW.open(urllib.request.Request(url, headers={'User-Agent': 'tw-assets-test'}), timeout=15); return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e: return e.code, e.headers, e.read()

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=100); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False

NOH = "document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1"

async def main():
    if A.local: origin, page_url, game_url = start_local()
    else: origin = A.page.rstrip('/'); page_url = origin + '/assets'; game_url = origin + '/?faces=1500'  # (its TEST table is deleted at the end: tw_sandbox)
    D = json.loads(head(origin + ('/engine/client/site/assets.json' if A.local else '/assets.json'))[2])
    packs = D['packs']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL])
        errors = []
        async def new_page(w=1280, h=800, phone=False, game=False):
            ctx = await browser.new_context(viewport={'width': w, 'height': h}, **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if phone else {}))
            pg = await ctx.new_page()
            if not game:  # (the game's own console has its own suites; here a page left mid-load aborts its texture fetches)
                pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
                pg.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' and 'favicon' not in m.text else None)
            else: pg.on('pageerror', lambda e: errors.append(f'game pageerror: {e}'))
            return pg

        # ---------- PAGE + WEIGHT ----------
        if want('PAGE') or want('WEIGHT'):
            print('PAGE')
            pg = await new_page(); sizes = []; pics = []
            async def on_resp(r):
                try: b = await r.body(); sizes.append(len(b))
                except Exception: pass
            pg.on('response', lambda r: asyncio.ensure_future(on_resp(r)))
            pg.on('request', lambda r: pics.append(r.url) if r.resource_type == 'image' else None)
            await pg.goto(page_url, wait_until='load'); await pg.wait_for_timeout(1500)
            ov = await pg.evaluate("""() => ({ cards: [...document.querySelectorAll('#packs a.pk')].map(a => ({ id: a.id, href: a.getAttribute('href'), txt: a.innerText, img: !!a.querySelector('img') })),
                credit: document.querySelector('#creditline')?.textContent, title: document.title, h1: document.querySelector('h1')?.textContent })""")
            check(len(ov['cards']) == len(packs), 'PAGE the overview lists every pack of the catalogue', f"{len(ov['cards'])} cards, {len(packs)} packs")
            check(all(c['id'] == f"pack/{p['slug']}" and c['href'] == f"#pack/{p['slug']}" for c, p in zip(ov['cards'], packs)), 'PAGE each pack card has its own anchor and address (#pack/<slug>)')
            check(all(c['img'] for c in ov['cards']), 'PAGE each pack card has a picture (a hero still or its things)')
            check(ov['credit'] == 'Turnip Works assets (https://turnipworks.net), CC BY 4.0', 'PAGE the credit line is the house\'s', ov['credit'])
            check(ov['h1'] == 'Assets' and 'Assets' in ov['title'], 'PAGE title and heading', ov['title'])
            if want('WEIGHT'):
                await pg.wait_for_timeout(800)
                total = sum(sizes)
                check(total < 1.5e6, 'WEIGHT the first view is under 1.5 MB (HTML, data, pictures)', f'{total / 1e6:.2f} MB, {len(sizes)} responses')
                check(len(pics) < 40, 'WEIGHT the first view asks for fewer than 40 pictures', f'{len(pics)} pictures')
                big = max(packs, key=lambda p: len(p['things']))
                pics.clear()
                await pg.evaluate(f"location.hash = 'pack/{big['slug']}'"); await wait(pg, "document.querySelectorAll('#view a.card').length > 0", 8000)
                await pg.wait_for_timeout(1200)
                n = await pg.evaluate("document.querySelectorAll('#view a.card').length")
                check(n == len(big['things']) and len(pics) < n / 3, f"WEIGHT a pack of {n} things asks only for the pictures near the screen (lazy)", f'{len(pics)} pictures asked for')
            await pg.close()

        # ---------- PICS ----------
        if want('PICS'):
            print('PICS')
            names = [f"t/{l[0]}.{l[1]}.webp" for t in D['things'].values() for l in t['l']] + [f"f/{fid}-{f['x'].split('-')[-1]}.webp" for fid, f in D['figures'].items()]
            heroes = json.load(open(os.path.join(REPO, 'docs', 'site', 'assets-packs.json')))['packs']
            names += [f"h/{v['hero']}-{w}.webp" for v in heroes.values() if v.get('hero') for w in (600, 1200)]
            if A.local:
                lib = os.path.join(ENGINE, 'client', 'site', 'library'); miss = [n for n in names if not os.path.isfile(os.path.join(lib, n))]
                check(not miss, 'PICS every picture the catalogue names is in client/site/library', f"{len(miss)} missing: {', '.join(miss[:5])}" if miss else f'{len(names)} pictures')
            else:
                random.seed(7); sample = random.sample(names, 60); bad = [n for n in sample if head(origin + D['media'] + n)[0] != 200]
                check(not bad, 'PICS a sample of 60 pictures answers 200', ', '.join(bad[:5]))
            # the files the page links: --local the tuner's files; --page a sample of 20 over HTTP
            files = [('assets/flat/' if t.get('f') else 'assets/m/') + l[0] + ('.webp' if t.get('f') else '.glb') for t in D['things'].values() for l in t['l']] + [f"assets/figures/{fid}--{f['x']}.glb" for fid, f in D['figures'].items()]
            if A.local:
                miss = [f for f in files if not os.path.isfile(os.path.join(REPO, 'tools', 'spawn-tuner', f))]
                check(not miss, 'PICS every file the page links is one the game serves (/look/)', ', '.join(miss[:5]) or f'{len(files)} files')
            else:
                random.seed(8); bad = [f for f in random.sample(files, 20) if head(origin + D['files'] + f)[0] != 200]
                check(not bad, 'PICS a sample of 20 linked files answers 200 under /look/', ', '.join(bad[:5]))

        # ---------- ROUTE ----------
        if want('ROUTE'):
            print('ROUTE')
            pg = await new_page(); await pg.goto(page_url + '#pack/tavern-inn', wait_until='load')
            tav = next(p for p in packs if p['slug'] == 'tavern-inn')
            ok = await wait(pg, f"document.querySelectorAll('#view a.card').length === {len(tav['things'])}", 10000)
            st = await pg.evaluate("({ chips: document.querySelectorAll('#view .chips a').length, packs: getComputedStyle(document.querySelector('#packs')).display === 'none' && scrollY < 900, use: document.querySelector('#view a.btn.primary')?.getAttribute('href'), h2: document.querySelector('#view h2')?.textContent })")
            check(ok and st['chips'] == len(tav['rooms']) + 1, '#pack/tavern-inn draws the pack: a card per thing, a chip per room', f"{len(tav['things'])} things, {st['chips']} chips")
            check(st['packs'], 'a pack view hides the overview (drawn, not just flagged) and starts near the top of the page')
            check(st['use'] == '/?pack=TAV', 'the pack\'s "Use it in Turnip Works" opens the Build menu at it (/?pack=TAV)', st['use'])
            common = next(r for r in tav['rooms'] if r['key'] == 'common')
            await pg.evaluate("location.hash = 'pack/tavern-inn/common'")
            ok = await wait(pg, f"document.querySelectorAll('#view h3').length === {len(common['sections'])}", 8000)
            st = await pg.evaluate("({ h2: document.querySelector('#view h2')?.textContent, cur: document.querySelector('#view .chips a[aria-current]')?.textContent, n: document.querySelectorAll('#view a.card').length, use: document.querySelector('#view a.btn.primary')?.getAttribute('href') })")
            check(ok and st['h2'] == 'Common room' and st['cur'] == 'Common room', '#pack/tavern-inn/common draws the room, shelf by shelf, as the Build menu lists it', f"{len(common['sections'])} shelves, {st['n']} cards")
            check(st['use'] == '/?pack=TAV%2Fcommon', 'the room\'s link opens the Build menu at that room', st['use'])
            await pg.evaluate("location.hash = 'thing/barrel'")
            ok = await wait(pg, "document.querySelector('#asset').open && document.querySelector('#as-name')?.textContent === 'Barrel'", 8000)
            st = await pg.evaluate("({ use: document.querySelector('#dlg a.btn.primary')?.getAttribute('href'), file: document.querySelector('#as-file')?.getAttribute('href'), where: document.querySelectorAll('#dlg .where a').length, size: document.querySelector('#dlg dl')?.innerText })")
            check(ok and st['use'] == '/?place=barrel', '#thing/barrel opens the barrel, with "Use it in Turnip Works" -> /?place=barrel', st['use'])
            check((st['file'] or '').startswith('/look/assets/m/barrel') and (st['file'] or '').endswith('.glb'), 'the barrel\'s file is the GLB the game loads', st['file'])
            check(st['where'] > 0 and 'ft' in (st['size'] or ''), 'it says where it is (rooms) and its size in feet', f"{st['where']} rooms")
            if len(D['things']['barrel']['l']) > 1:
                f0 = st['file']; await pg.click('#dlg [data-look="1"]'); f1 = await pg.evaluate("document.querySelector('#as-file').getAttribute('href')")
                check(f1 != f0, 'picking another look changes the picture and the file', f1)
            await pg.keyboard.press('Escape'); ok = await wait(pg, "!document.querySelector('#asset').open && location.hash === '#pack/tavern-inn/common'", 5000)
            check(ok, 'closing the asset gives the room back (Back)', await pg.evaluate('location.hash'))
            await pg.goto(page_url + '#figure/beast-ape'); ok = await wait(pg, "document.querySelector('#asset').open && document.querySelector('#as-name')?.textContent === 'Ape'", 8000)
            use = await pg.evaluate("document.querySelector('#dlg a.btn.primary')?.getAttribute('href')")
            check(ok and use == '/?pawn=beast-ape', 'a figure opens from its own address (#figure/beast-ape), "Use" -> /?pawn=', use)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            await pg.goto(page_url + '#find/owlbear'); ok = await wait(pg, "[...document.querySelectorAll('#view a.card span')].some(s => /owlbear/i.test(s.textContent))", 8000)
            check(ok, '#find/owlbear finds the owlbear', await pg.evaluate("document.querySelector('#count').textContent"))
            await pg.fill('#q', 'throne'); ok = await wait(pg, "location.hash === '#find/throne' && [...document.querySelectorAll('#view a.card span')].some(s => /^throne$/i.test(s.textContent))", 6000)
            check(ok, 'typing in the search finds as you type, and the address follows (#find/throne)')
            await pg.goto(page_url + '#pack/no-such-pack'); await pg.wait_for_timeout(800)
            check(await pg.evaluate("getComputedStyle(document.querySelector('#packs')).display !== 'none' && document.querySelector('#view').hidden"), 'an unknown pack falls back to the overview')
            await pg.goto(page_url + '#thing/no-such-thing'); await pg.wait_for_timeout(800)
            check(await pg.evaluate("!document.querySelector('#asset').open"), 'an unknown thing opens nothing')
            await pg.close()

        # ---------- PHONE ----------
        if want('PHONE'):
            print('PHONE')
            pg = await new_page(390, 844, phone=True)
            for h in ['', '#pack/wizard-alchemist-library', '#pack/wizard-alchemist-library/wiz-lab', '#pack/figures', '#thing/fireplace-wall', '#find/candle']:
                await pg.goto(page_url + h, wait_until='load'); await pg.wait_for_timeout(900)
                sw = await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
                check(await pg.evaluate(NOH), f"PHONE no sideways scroll at 390 px: {h or 'the overview'}", f'{sw[0]} / {sw[1]}')
            await pg.close()

        # ---------- GAME (--local) ----------
        if want('GAME'):
            print('GAME')
            gm = await new_page(1200, 760, game=True)
            await gm.goto(game_url + '&place=barrel', wait_until='load')
            await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST assets deep link ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)')
            await gm.click('#newCampaign button')
            check(await wait(gm, 'window.tw && tw.ready && tw.ready() && tw.loaded()', 40000, 'gm ready'), 'GAME a new table from a link with ?place=barrel (the start card, then the table)')
            ok = await wait(gm, "tw.mode?.kind === 'place' && tw.mode?.cat?.id === 'barrel'", 20000, 'place mode')
            st = await gm.evaluate("({ search: location.search, ents: Object.values(tw.entities()).filter(e => e.kind === 'object').length, toast: document.querySelector('#toast')?.textContent, intro: tw.intro?.state || null })")
            check(ok, 'GAME ?place=barrel arms the barrel for the GM (its ghost follows the pointer)', st['toast'])
            check(st['ents'] == 0, 'GAME nothing is put down by the link itself', f"{st['ents']} things on the table")
            check('place=' not in st['search'], 'GAME the address is cleaned (a reload or an invite does not carry it)', st['search'])
            check(st['intro'] != 'running', 'GAME the first-visit intro waits (it would fight the armed tool)', st['intro'])
            await gm.keyboard.press('Escape'); ok = await wait(gm, "tw.mode === null || tw.mode?.kind !== 'place'", 4000)
            check(ok, 'GAME Esc puts the armed thing away')
            token = await gm.evaluate("new URLSearchParams(location.hash.slice(1)).get('s')")
            await gm.goto(game_url + '&nointro&pawn=beast-ape#s=' + token, wait_until='load')
            ok = await wait(gm, "window.tw && tw.ready && tw.ready() && tw.mode?.kind === 'place' && tw.mode?.pawn?.fig?.id === 'beast-ape'", 40000, 'pawn tool')
            if not ok: print('    (pawn page:', await gm.evaluate("({ href: location.href, start: !document.querySelector('#start')?.hidden, tw: !!window.tw, load: document.querySelector('#loading, .loading')?.innerText?.slice(0, 200) })"), ')')
            check(ok, 'GAME ?pawn=beast-ape arms Add pawn with the ape', await gm.evaluate("document.querySelector('#toast')?.textContent"))
            await gm.keyboard.press('Escape')
            await gm.goto(game_url + '&nointro&pack=CRY%2Fcrypt-vault#s=' + token, wait_until='load')
            ok = await wait(gm, "window.tw && tw.ready && tw.ready() && tw.build?.state().open && tw.build.state().path.includes('Burial vault')", 40000, 'build menu')
            st = await gm.evaluate("tw.build.state()")
            check(ok, 'GAME ?pack=CRY/crypt-vault opens the Build menu at the burial vault (its room tool)', ' › '.join(st.get('path', [])))
            check(await gm.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length === 0"), 'GAME and builds nothing by itself')
            await gm.goto(game_url + '&nointro&place=no-such-thing#s=' + token, wait_until='load')
            ok = await wait(gm, "window.tw && tw.ready && tw.ready() && /No \"no-such-thing\"/.test(document.querySelector('#toast')?.textContent || '')", 40000, 'unknown toast')
            check(ok and await gm.evaluate("tw.mode?.kind !== 'place'"), 'GAME an unknown thing says so and arms nothing')
            # a player's seat: invite, then the link
            await gm.goto(game_url + '&nointro#s=' + token, wait_until='load'); await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000)
            if await gm.evaluate("document.querySelector('#bar').classList.contains('open')"): await gm.keyboard.press('Escape')
            await gm.keyboard.press('/'); await gm.keyboard.type('invite Brakka', delay=8); await gm.wait_for_timeout(250); await gm.keyboard.press('Enter')
            await wait(gm, "!document.querySelector('#output').hidden && document.querySelector('#output textarea').value.includes('#s=')", 10000, 'invite')
            invite = await gm.evaluate("document.querySelector('#output textarea').value"); await gm.keyboard.press('Escape')
            ptoken = urllib.parse.parse_qs(urllib.parse.urlparse(invite.strip()).fragment)['s'][0]
            await gm.close()  # (one software-rendered table at a time: the player's would take minutes beside it)
            pl = await new_page(1200, 760, game=True)
            await pl.goto(game_url + '&nointro&place=barrel#s=' + ptoken, wait_until='load')
            t0 = time.time(); ok = await wait(pl, "window.tw && tw.ready && tw.ready() && tw.deepLinked", 90000, 'the player link read')
            st = await pl.evaluate("({ gm: tw.gm(), mode: tw.mode?.kind || null, search: location.search, link: tw.deepLinked, things: Object.values(tw.entities()).filter(e => e.kind === 'object').length })")
            ok = ok and st['link'].get('ok') is False and 'GM' in (st['link'].get('msg') or '') and st['things'] == 0
            check(ok and not st['gm'] and st['mode'] is None, 'GAME a player\'s seat with ?place= gets no tool, only a note', f"{st['link']} after {time.time() - t0:.0f} s")
            check('place=' not in st['search'], 'GAME ... and its address is cleaned too', st['search'])
            await pl.close()

        if A.page:
            print('ROUTE+')
            s, h, b = head(origin + '/assets'); check(s == 200 and 'text/html' in (h.get('Content-Type') or ''), '/assets answers 200 HTML', s)
            s, h, b = head(origin + '/assets.json'); check(s == 200 and 'json' in (h.get('Content-Type') or '') and h.get('Access-Control-Allow-Origin') == '*', '/assets.json answers JSON with CORS', f"{s} {h.get('Content-Type')}")
            for u in ('/assets/', '/assets.html'):
                s, h, b = head(origin + u); check(s == 301 and (h.get('Location') or '').endswith('/assets'), f'{u} 301s to /assets', f"{s} {h.get('Location')}")

        bad = [e for e in errors if 'Failed to load resource' not in e]
        check(not bad, 'no console errors or page errors', '; '.join(bad[:3]))
        await browser.close()
    n_ok = sum(1 for r in results if r[0])
    print(f'\n{n_ok}/{len(results)} passed')
    sys.exit(0 if n_ok == len(results) else 1)

asyncio.run(main())
