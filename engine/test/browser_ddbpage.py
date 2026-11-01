#!/usr/bin/env python3
"""CONNECT D&D BEYOND: the help page, its film, and the way in from Settings.  (Harry 2026-10-29)

  TW_GPU=1 python3 engine/test/browser_ddbpage.py --local
  TW_GPU=1 python3 engine/test/browser_ddbpage.py --page http://127.0.0.1:8180
  (TW_PORTS=a,b when another worktree runs --local at the same time)

  PAGE   the page (docs/site/connect-dnd-beyond.md, built by engine/tools/build_site.py) loads with no console error and
         says what a player needs: the numbered setup steps with the field and button names ("List of custom domains to
         load Beyond20", Apply, "Beyond20 connected", Link), both addresses to paste, troubleshooting, what is and is
         never stored, the target (T) and the Attack button, Firefox, and the credit (Beyond20 is Kakaroto's, free and
         open source; links to its site, source and both stores) and "not affiliated with Wizards of the Coast or
         D&D Beyond"; no picture comes from anywhere but our own folder (no Wizards logo or art)
  FILM   one <video>: poster, controls, NO autoplay, preload=metadata, muted, a WebM source then an MP4 one; each answers
         200 with its video type and is under 8 MB; the browser loads it (45-90 s long); the poster and every picture
         answer 200 and have alt text
  SET    in a live table: Settings ▸ Me shows "D&D Beyond: not connected in this tab" and "Connect D&D Beyond", which
         opens the page in a new tab (the table stays); after Beyond20 says Loaded (simulated here with its DOM event:
         this is a test of OUR listener, not a demo) the open window says "D&D Beyond: connected via Beyond20" and the
         note "Beyond20 connected" shows (it waits for the loading screen to go); the GM
         also finds it in Vision, distance & rules; a player has no Vision, distance & rules
  ROUTE  (--page) /connect-dnd-beyond answers 200 HTML; /connect-dnd-beyond/ and .html 301 to it; the film answers
         byte ranges (206), so a browser can seek; sitemap.xml and llms.txt list the page
--local serves the repo (the page at /engine/client/site/connect-dnd-beyond.html) with a throwaway relay. Writes nothing
outside a throwaway campaign.
"""
import argparse, asyncio, atexit, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page', help='site origin behind nginx, e.g. http://127.0.0.1:8180')
A = ap.parse_args()
if not A.local and not A.page: ap.error('choose --local or --page ORIGIN')
NAME, TITLE, MAXB = 'connect-dnd-beyond', 'Connect D&D Beyond', 8 * 1024 * 1024
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail not in ('', None) else ''}", flush=True)
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
    data = tempfile.mkdtemp(prefix='tw-ddbpage-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
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
def get(url, headers=None, method='GET'):
    try: r = RAW.open(urllib.request.Request(url, headers={'User-Agent': 'tw-ddbpage-test', **(headers or {})}, method=method), timeout=20); return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e: return e.code, e.headers, e.read()

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=100); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False

READ = """() => {
  const v = document.querySelector('main video');
  return { title: document.querySelector('h1')?.textContent || '', text: document.body.innerText,
    steps: [...document.querySelectorAll('main ol')].map(o => [...o.children].map(li => li.innerText)),
    h2: [...document.querySelectorAll('main h2')].map(h => h.textContent),
    links: [...document.querySelectorAll('main a[href]')].map(a => a.href),
    imgs: [...document.querySelectorAll('img')].map(i => ({ src: i.currentSrc || i.src, alt: i.getAttribute('alt'), w: i.naturalWidth, inMain: !!i.closest('main') })),
    videos: document.querySelectorAll('video').length,
    video: v && { poster: v.poster, controls: v.controls, autoplay: v.autoplay || v.hasAttribute('autoplay'), muted: v.muted || v.hasAttribute('muted'), preload: v.getAttribute('preload'),
      playsinline: v.hasAttribute('playsinline'), sources: [...v.querySelectorAll('source')].map(s => [s.src, s.type]), label: v.getAttribute('aria-label') || v.getAttribute('title') || '' } };
}"""

async def main():
    if A.local: origin, game = start_local(); page = f'{origin}/engine/client/site/{NAME}.html'
    else: origin = A.page.rstrip('/'); game = origin + '/'; page = f'{origin}/{NAME}'
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--autoplay-policy=no-user-gesture-required'])
        print('PAGE')
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 900}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}')); pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
        resp = await pg.goto(page); await pg.wait_for_load_state('networkidle')
        await pg.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager'; })")  # (the pictures below the fold too)
        await wait(pg, "[...document.images].every(i => i.complete)", 15000, 'pictures loaded')
        d = await pg.evaluate(READ); t = d['text']
        check(resp and resp.status == 200, 'the page loads', resp and resp.status)
        check(not errs, 'no console errors', '; '.join(errs)[:300])
        check(d['title'] == TITLE, 'its title', d['title'])
        flat = ' '.join(' '.join(o) for o in d['steps'])
        need = ['Beyond20', 'Advanced Options', 'List of custom domains to load Beyond20', 'Apply', 'Allow', 'Beyond20 connected', 'Link']
        check(d['steps'] and all(w in flat for w in need), 'numbered steps name the field and every button: ' + ', '.join(need), [w for w in need if w not in flat])
        st = await pg.evaluate("[...document.querySelectorAll('main ol.steps > li')].map(li => [li.querySelector('p')?.innerText.length || 0, !!li.querySelector('a > img[src*=\\'/ddb/step-\\']'), li.querySelector('img')?.naturalWidth || 0, li.querySelector('a:has(> img)')?.getAttribute('href') || ''])")
        check(len(st) == 23 and all(p > 20 and im and w > 0 and '-full-' in a for p, im, w, a in st), 'one numbered step per click, 23 of them, each with its picture (loaded) linking to the whole screen', [i + 1 for i, x in enumerate(st) if not (x[0] > 20 and x[1] and x[2] > 0 and '-full-' in x[3])] or len(st))
        check('https://turnipworks.net/*' in t and 'https://dev.turnipworks.net/*' in t, 'both addresses to paste are on the page')
        for h in ['Troubleshooting', 'What we store', 'Target', 'Attack', 'Firefox']:
            check(any(h.lower() in x.lower() for x in d['h2']) or h.lower() in t.lower(), f'covers: {h}', d['h2'])
        check(re.search(r'never (log|sign) in', t, re.I) and re.search(r'spell', t, re.I) and re.search(r'never', t, re.I), 'says what is never stored and that we never log into D&D Beyond')
        check(re.search(r'not affiliated with Wizards of the Coast', t) and 'D&D Beyond' in t, 'says plainly: not affiliated with Wizards of the Coast or D&D Beyond')
        check('Kakaroto' in t and re.search(r'free', t, re.I) and re.search(r'open[- ]source', t, re.I), 'credits Beyond20: free, open source, by Kakaroto')
        want = {'its site': 'beyond20.here-for-more.info', 'its source': 'github.com/kakaroto/Beyond20', 'the Chrome Web Store': 'chromewebstore.google.com',
                'Firefox Add-ons': 'addons.mozilla.org'}
        for what, host in want.items():
            check(any(host in h for h in d['links']), f'links {what} ({host})')
        ours = [i for i in d['imgs'] if i['inMain']]
        check(all(urllib.parse.urlparse(i['src']).path.startswith('/engine/client/site/ddb/') for i in ours), 'every picture on the page is our own capture (engine/client/site/ddb/), none hot-linked', [i['src'] for i in ours])
        check(all(i['w'] > 0 for i in ours) and all((i['alt'] or '').strip() for i in ours), f'all {len(ours)} pictures load and carry alt text', [(i['src'][-40:], i['w'], i['alt']) for i in ours if not i['w'] or not (i['alt'] or '').strip()])

        print('FILM')
        v = d['video']
        check(d['videos'] == 1 and v, 'one <video> on the page', d['videos'])
        if v:
            check(v['poster'] and v['controls'] and not v['autoplay'] and v['preload'] == 'metadata' and v['muted'], 'poster, controls, no autoplay, preload=metadata, muted', v)
            check([ty for _, ty in v['sources']] == ['video/webm', 'video/mp4'], 'a WebM source, then an MP4 one', v['sources'])
            for src, ty in v['sources'] + [(v['poster'], 'image/jpeg')]:
                st, h, body = get(src)
                ok = st == 200 and (h.get('Content-Type') or '').startswith(ty) and 0 < len(body) <= MAXB
                check(ok, f'{src.rsplit("/", 1)[-1]}: 200 {ty}, {len(body) / 1e6:.2f} MB (under 8)', f"{st} {h.get('Content-Type')}")
            ok = await wait(pg, "document.querySelector('main video').readyState >= 1", 20000, 'film metadata')
            info = await pg.evaluate("(() => { const v = document.querySelector('main video'); return { dur: v.duration, w: v.videoWidth, h: v.videoHeight, src: v.currentSrc, paused: v.paused }; })()")
            check(ok and 45 <= info['dur'] <= 90 and info['w'] >= 1280, 'the browser loads the film: 45-90 s, at least 1280 wide', info)
            check(info['paused'], 'it does not start by itself', info['paused'])
            played = await pg.evaluate("(async () => { const v = document.querySelector('main video'); try { await v.play(); await new Promise(r => setTimeout(r, 1500)); const t = v.currentTime; v.pause(); return t; } catch (e) { return String(e); } })()")
            check(isinstance(played, (int, float)) and played > 0.5, 'and plays when asked', played)
        await ctx.close()
        ctx = await browser.new_context(viewport={'width': 400, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True); pg = await ctx.new_page()
        await pg.goto(page); await pg.wait_for_load_state('networkidle')
        ph = await pg.evaluate("(() => { const v = document.querySelector('main video'); return { sw: document.documentElement.scrollWidth, w: innerWidth, vw: v ? v.getBoundingClientRect().width : 0 }; })()")
        check(ph['sw'] <= ph['w'] and 300 <= ph['vw'] <= ph['w'], 'on a 400-px phone: no sideways scroll, the film fits the width', ph)
        await ctx.close()

        print('SET')
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); gm = await ctx.new_page(); errs = []
        gm.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
        await gm.goto(game)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        await gm.fill('#newCampaign input[name=name]', 'TEST ddb page ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw?.ready?.() && tw.settings && tw.b20', 90000, 'GM table'), 'GM table live')
        inv = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({kind:'human',role:'player',name:'Mira',color:'#67aadd'}))")
        pctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); pl = await pctx.new_page()
        pl.on('pageerror', lambda e: errs.append(f'player pageerror: {e}'))
        await pl.goto(inv)
        check(await wait(pl, 'window.tw?.ready?.() && tw.settings && tw.b20', 90000, 'player table'), 'player table live')
        ROW = "(() => { const g = [...document.querySelectorAll('#settingsModal .sgrp')].find(g => g.querySelector('h3')?.textContent === 'D&D Beyond'); if (!g) return null; const a = g.querySelector('a.sddb-help'); return { status: g.querySelector('.sddb')?.textContent, on: g.querySelector('.sddb')?.classList.contains('on'), link: a && [a.textContent.trim(), a.href, a.target, a.rel] }; })()"
        want_href = (origin + f'/{NAME}') if not A.local else (origin + f'/engine/client/site/{NAME}.html')
        await pl.evaluate("tw.settings.show('me')"); await wait(pl, "!!document.querySelector('#settingsModal .sddb')", 8000, 'D&D Beyond row')
        r = await pl.evaluate(ROW)
        check(r and r['status'] == 'D&D Beyond: not connected in this tab' and not r['on'], 'player: Settings ▸ Me says "D&D Beyond: not connected in this tab"', r)
        check(r and r['link'] and r['link'][0] == 'Connect D&D Beyond' and r['link'][1] == want_href and r['link'][2] == '_blank' and 'noopener' in r['link'][3], f'and offers "Connect D&D Beyond" -> {want_href}, a new tab', r and r['link'])
        async with pctx.expect_page() as newp: await pl.click('#settingsModal a.sddb-help')
        np = await newp.value; await np.wait_for_load_state('load')
        check(await np.evaluate("document.querySelector('h1')?.textContent") == TITLE, 'clicking it opens the help page in a new tab')
        await np.close()
        check(await pl.evaluate("tw.ready() && tw.settings.state().open"), 'the table and Settings are still open behind it')
        # Beyond20's content script announces itself with this DOM event (src/common/utils.js forwardMessageToDOM): a test of our listener
        await pl.evaluate("document.dispatchEvent(new CustomEvent('Beyond20_Loaded', { detail: [{ action: 'loaded' }] }))")
        ok = await wait(pl, "document.querySelector('#settingsModal .sddb.on')?.textContent === 'D&D Beyond: connected via Beyond20'", 8000, 'connected row')
        check(ok, 'after Beyond20 reports in, the open window says "D&D Beyond: connected via Beyond20"', await pl.evaluate(ROW))
        note = await wait(pl, "!!tw.b20.told && document.querySelector('#toast')?.textContent.startsWith('Beyond20 connected')", 6000, 'the note')
        check(note and await pl.evaluate("document.getElementById('twl')?.hidden !== false"), 'and the "Beyond20 connected" note shows once the loading screen has gone (never under it)', await pl.evaluate("[tw.b20.told, document.querySelector('#toast')?.textContent]"))
        secs = await pl.evaluate("tw.settings.state().sections")
        check('campaign' not in secs, 'a player has no Vision, distance & rules section', secs)
        await gm.evaluate("tw.settings.show('campaign')"); await wait(gm, "!!document.querySelector('#settingsModal .sddb')", 8000, 'GM row')
        r = await gm.evaluate(ROW)
        check(r and r['link'] and r['link'][1] == want_href and r['status'] == 'D&D Beyond: not connected in this tab', 'GM: Vision, distance & rules carries the same entry (this GM tab has no Beyond20)', r)
        await gm.evaluate("tw.settings.show('me')"); await wait(gm, "!!document.querySelector('#settingsModal .sddb')", 8000, 'GM me row')
        check(await gm.evaluate(ROW), 'GM: and Settings ▸ Me too')
        await gm.evaluate("tw.settings.close()"); await pl.evaluate("tw.settings.close()")
        check(not errs, 'no page errors in either tab', errs[:3])
        await browser.close()

    print('ROUTE')
    if not A.local:
        st, h, _ = get(f'{origin}/{NAME}')
        check(st == 200 and 'text/html' in (h.get('Content-Type') or ''), f'/{NAME}: 200 text/html', f"{st} {h.get('Content-Type')}")
        for alt in (f'/{NAME}/', f'/{NAME}.html'):
            st, h, _ = get(origin + alt)
            check(st == 301 and (h.get('Location') or '').endswith(f'/{NAME}'), f'{alt} -> /{NAME}', f"{st} {h.get('Location')}")
        if v:
            st, h, body = get(v['sources'][1][0], {'Range': 'bytes=0-1023'})
            check(st == 206 and len(body) == 1024, 'the MP4 answers a byte range (206): a browser can seek in it', st)
    st, _, body = get(origin + ('/sitemap.xml' if not A.local else '/engine/client/site/sitemap.xml'))
    check(st == 200 and b'https://turnipworks.net/connect-dnd-beyond' in body, 'sitemap.xml lists https://turnipworks.net/connect-dnd-beyond', st)
    st, _, body = get(origin + ('/llms.txt' if not A.local else '/engine/client/site/llms.txt'))
    check(st == 200 and b'https://turnipworks.net/connect-dnd-beyond' in body and b'Beyond20' in body, 'llms.txt links the page and names Beyond20', st)

    bad = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed" + (f"; FAILED: {', '.join(r[1] for r in bad)}" if bad else ''))
    sys.exit(1 if bad else 0)

asyncio.run(main())
