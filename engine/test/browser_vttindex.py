#!/usr/bin/env python3
"""THE VTT COMPARISON INDEX PAGE (2026-10-29; docs/VTT_INDEX.md).

  python3 engine/test/browser_vttindex.py --local
  python3 engine/test/browser_vttindex.py --page http://127.0.0.1:8180
  (TW_PORTS=a,b when another worktree runs --local at the same time)

  DATA    docs/site/vtt-index.json validates against its schema and the house rules (tools/vtt-index/vtt_index.py), exactly
          one row is ours, the committed engine/client/site/ files match their sources (build_site.py --check)
  LOAD    the page loads with no console error, every product is a row, the disclosure and "Last updated" are there, no
          "vibe" anywhere, the Dataset metadata parses and points at the data
  FILTER  3D / Free to start / Runs in a browser / Open source / Site is up / group / kind / search each show exactly the
          rows the JSON says, the count says so, and they combine
  SORT    a column sorts yes > partial > no > ? (and back), the name column A-Z
  DETAIL  a name opens its details (summary, every criterion, the sources), the address says #vtt=<id>, Escape closes it,
          and a #vtt=<id> address opens it on load
  FIX     "Correct this row" fills the form; a correction with no words is refused in the page; one with words reaches
          the relay's ticket box (its test sandbox) as kind "correction" with the product and field
  PHONE   at 400 x 800: no sideways scroll on the page (the table scrolls inside its own box), body text >= 15 px, the
          details fit the screen
  ROUTE   (--page) /vtt-index answers HTML, /vtt-index/ and /vtt-index.html 301 to it, /vtt-index.json and
          /vtt-index.schema.json answer JSON (the data validates), /vtt-index.md answers text/markdown, llms.txt and
          sitemap.xml name the page
Writes nothing outside the relay's ticket test sandbox.
"""
import argparse, asyncio, atexit, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402
sys.path.insert(0, os.path.join(REPO, 'tools', 'vtt-index')); import vtt_index  # noqa: E402
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page', help='site origin behind nginx, e.g. http://127.0.0.1:8180'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--shots', help='write desktop and phone screenshots to this folder')
A = ap.parse_args()
if not A.local and not A.page: ap.error('choose --local or --page ORIGIN')
DATA = json.load(open(os.path.join(REPO, 'docs', 'site', 'vtt-index.json'), encoding='utf-8'))
P = DATA['products']
results = []; procs = []; tmp = []


def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:300] if detail else ''}", flush=True)


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
relay_data = None


def start_local():
    global relay_data
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    relay_data = tempfile.mkdtemp(prefix='tw-vttindex-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([relay_data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine'))
    log = open(os.path.join(relay_data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': relay_data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/site/vtt-index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/site/vtt-index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}', safe=''), f'http://127.0.0.1:{RP}'


def get(url, method='GET'):
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k): return None
    op = urllib.request.build_opener(NoRedirect)
    try:
        with op.open(urllib.request.Request(url, method=method, headers={'User-Agent': 'Mozilla/5.0 tw-test'}), timeout=20) as r: return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read()


def expect(pred):
    return sum(1 for p in P if pred(p))


def data_checks():
    bad = vtt_index.problems(DATA)
    check(not bad, 'DATA vtt-index.json validates (schema + house rules)', bad[:5])
    check(sum(p['group'] == 'ours' for p in P) == 1 and next(p for p in P if p['group'] == 'ours')['id'] == 'turnip-works', 'DATA exactly one row is ours (turnip-works)')
    check(all(p['last_checked'] and p['alive']['checked'] for p in P), 'DATA every row carries a last-checked date and a site-check date')
    r = subprocess.run(['python3', os.path.join(ENGINE, 'tools', 'build_site.py'), '--check'], capture_output=True, text=True)
    check(r.returncode == 0, 'DATA the committed site files match their sources (build_site.py --check)', (r.stdout + r.stderr).strip()[-200:])


async def visible(page):
    return await page.evaluate("() => [...document.querySelectorAll('#vtt tbody tr')].filter(r => !r.hidden).map(r => r.dataset.id)")


async def run(url, relay):
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=not A.headed)
        ctx = await br.new_context(viewport={'width': 1366, 'height': 900})
        page = await ctx.new_page(); errors = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        r = await page.goto(url, wait_until='load')
        check(r and r.status == 200, 'LOAD the page answers 200', r and r.status)
        n = await page.locator('#vtt tbody tr').count()
        check(n == len(P), 'LOAD every product is a row', f'{n} rows, {len(P)} products')
        body = await page.inner_text('body')
        check('We make Turnip Works' in body and 'development checklist' in body and 'expect our row to fill up' in body, 'LOAD the disclosure is on the page')
        check(re.search(r'Last updated \d{1,2} \w+ 20\d\d', body), 'LOAD it says when it was last updated')
        html_ = await page.content()
        check('vibe' not in html_.lower(), 'LOAD no "vibe" anywhere on the page')
        check('placeholder' not in body.lower(), 'LOAD no "placeholder" in the copy')
        ld = await page.evaluate("() => [...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s => JSON.parse(s.textContent))")
        check(ld and ld[0].get('@type') == 'Dataset' and any(d.get('contentUrl', '').endswith('/vtt-index.json') for d in ld[0].get('distribution', [])) and ld[0].get('license', '').startswith('https://creativecommons.org/'),
              'LOAD Schema.org Dataset metadata, with the JSON as a download and the licence', ld and ld[0].get('@type'))
        above = await page.evaluate("() => [...document.querySelectorAll('#vtt tbody tr')].filter(r => r.getBoundingClientRect().bottom < innerHeight).length")
        check(above >= 3, 'LOAD at 1366 x 900 the table is above the fold (3+ rows)', above)
        check(await page.locator('#vtt tbody tr[data-id="turnip-works"] .ours').count() == 1, 'LOAD our row is labelled "we make this"')
        check('hello@turnipworks.net' in body and await page.locator('a[href^="mailto:"]').count() == 0, 'LOAD the address is shown as text, with no mailto link')

        # FILTER: each against the JSON
        F = {
            'd3': lambda p: p['features']['dims']['v'] in ('3D', '2D+3D'),
            'free': lambda p: p['features']['price']['v'] in ('free', 'free tier'),
            'browser': lambda p: 'browser' in p['features']['platform']['v'],
            'os': lambda p: p['features']['opensource']['v'] in ('yes', 'partial'),
            'alive': lambda p: p['alive']['state'] == 'alive',
        }
        for f, pred in F.items():
            await page.check(f'#filters input[data-f="{f}"]')
            v = await visible(page); want = expect(pred)
            cnt = await page.inner_text('#count')
            check(len(v) == want and str(want) in cnt and 0 < want < len(P), f'FILTER "{f}" shows the {want} rows the JSON says', f'{len(v)} shown; "{cnt}"')
            await page.uncheck(f'#filters input[data-f="{f}"]')
        await page.check('#filters input[data-f="d3"]'); await page.check('#filters input[data-f="free"]'); await page.check('#filters input[data-f="browser"]')
        v = await visible(page); want = expect(lambda p: F['d3'](p) and F['free'](p) and F['browser'](p))
        check(len(v) == want and 'turnip-works' in v, f'FILTER 3D + free + browser combine ({want} rows, ours among them)', len(v))
        for f in ('d3', 'free', 'browser'): await page.uncheck(f'#filters input[data-f="{f}"]')
        await page.select_option('#filters select[data-f="group"]', 'ours')
        check(await visible(page) == ['turnip-works'], 'FILTER group "Ours" shows just our row')
        await page.select_option('#filters select[data-f="group"]', 'established')
        check(len(await visible(page)) == expect(lambda p: p['group'] == 'established'), 'FILTER group "Established" shows the established rows')
        await page.select_option('#filters select[data-f="group"]', '')
        await page.select_option('#filters select[data-f="kind"]', 'map maker')
        check(len(await visible(page)) == expect(lambda p: p['kind'] == 'map maker') >= 1, 'FILTER kind "map maker"')
        await page.select_option('#filters select[data-f="kind"]', '')
        await page.fill('#filters input[data-f="q"]', 'owlbear')
        v = await visible(page)
        check('owlbear-rodeo' in v and len(v) < 10, 'FILTER search "owlbear" finds Owlbear Rodeo', v)
        await page.fill('#filters input[data-f="q"]', '')
        check(len(await visible(page)) == len(P) and 'all' in (await page.inner_text('#count')).lower(), 'FILTER cleared: every row again')

        # SORT
        RANK = {'yes': 0, 'partial': 1, 'no': 2, 'n/a': 8, '?': 9}
        await page.click('#vtt thead button[data-sort="fog"]')
        vals = await page.evaluate("() => [...document.querySelectorAll('#vtt tbody tr')].map(r => r.querySelector('[data-c=fog]').dataset.v)")
        ranks = [RANK.get(x, 5) for x in vals]
        check(ranks == sorted(ranks) and vals[0] == 'yes', 'SORT Fog: yes, then partial, then no, then unknown', vals[:3] + ['…'] + vals[-2:])
        await page.click('#vtt thead button[data-sort="fog"]')
        vals = await page.evaluate("() => [...document.querySelectorAll('#vtt tbody tr')].map(r => r.querySelector('[data-c=fog]').dataset.v)")
        check([RANK.get(x, 5) for x in vals] == sorted([RANK.get(x, 5) for x in vals], reverse=True), 'SORT Fog again: the other way')
        check(await page.get_attribute('#vtt thead th:has(button[data-sort="fog"])', 'aria-sort') == 'descending', 'SORT the header says how it is sorted (aria-sort)')
        await page.click('#vtt thead button[data-sort="name"]')
        names = await page.evaluate("() => [...document.querySelectorAll('#vtt tbody tr')].map(r => r.cells[0].querySelector('a').textContent.toLowerCase()).filter(n => !n.startsWith('('))")
        check(names == sorted(names), 'SORT Product: A to Z (the unnamed ones last)')

        # DETAIL
        pid = 'owlbear-rodeo' if any(p['id'] == 'owlbear-rodeo' for p in P) else P[1]['id']
        prod = next(p for p in P if p['id'] == pid)
        await page.click(f'#vtt tbody tr[data-id="{pid}"] a[data-open]')
        await page.wait_for_selector('dialog#detail[open]')
        dtext = await page.inner_text('#dlg')
        check(prod['name'] in dtext and prod['summary'][:40] in dtext and all(c['label'] in dtext for c in DATA['criteria']), 'DETAIL opens with the name, summary and every criterion')
        nsrc = await page.locator('#dlg .srcs a').count()
        check(nsrc == len(prod['sources']) and nsrc > 0, 'DETAIL lists its sources as links', f'{nsrc} of {len(prod["sources"])}')
        check(page.url.endswith(f'#vtt={pid}'), 'DETAIL the address says #vtt=<id>', page.url[-40:])
        await page.keyboard.press('Escape')
        check(not await page.locator('dialog#detail[open]').count() and '#vtt=' not in page.url, 'DETAIL Escape closes it and clears the address')
        await page.goto(url.split('#')[0] + '#vtt=turnip-works', wait_until='load')
        await page.wait_for_selector('dialog#detail[open]', timeout=5000)
        dtext = await page.inner_text('#dlg')
        check('Turnip Works' in dtext and 'We make it' in dtext, 'DETAIL a #vtt= address opens that row on load (ours carries its disclosure)')

        # FIX
        await page.click('#dlg [data-fix]')
        await page.wait_for_timeout(500)
        check(await page.input_value('#fix select[name=product]') == 'turnip-works' and not await page.locator('dialog#detail[open]').count(), 'FIX "Correct this row" closes the details and fills the form')
        await page.click('#fix button[type=submit]')
        check('Write what should change' in await page.inner_text('#fixmsg'), 'FIX no words: the page asks for them and sends nothing')
        await page.select_option('#fix select[name=product]', pid)
        await page.select_option('#fix select[name=field]', 'price')
        await page.check('#fix input[name=maker]')
        await page.fill('#fix textarea[name=text]', 'TEST correction from browser_vttindex (throwaway)')
        await page.fill('#fix input[name=contact]', 'u/test-only')
        async with page.expect_response(lambda r: '/tickets/site' in r.url and r.request.method == 'POST') as resp:
            await page.click('#fix button[type=submit]')
        rr = await resp.value; j = await rr.json()
        await page.wait_for_timeout(200)
        msg = await page.inner_text('#fixmsg')
        check(rr.status == 200 and j.get('ok') and 'Thank you' in msg and j['id'] in msg, 'FIX a correction reaches the ticket box and the page says so', msg)
        key = None
        if A.local: key = open(os.path.join(relay_data, 'tickets', 'triage.key')).read().strip()
        else:
            for kf in ('/var/lib/tw-relay-dev/data/tickets/triage.key',):
                try: key = open(kf).read().strip()
                except Exception: pass
        if key:
            req = urllib.request.Request(f'{relay}/tickets/{j["id"]}', headers={**tw_sandbox.HEADERS, 'Authorization': f'Bearer {key}'})
            t = json.loads(urllib.request.urlopen(req, timeout=10).read())['ticket']
            check(t['kind'] == 'correction' and t['site']['product'] == pid and t['site']['field'] == 'price' and t['site']['maker'] and t['site']['contact'] == 'u/test-only', 'FIX it is a "correction" with the product, field, maker tick and contact', t.get('site'))
            live = json.loads(urllib.request.urlopen(urllib.request.Request(f'{relay}/tickets?kind=correction', headers={'Authorization': f'Bearer {key}'}), timeout=10).read())
            check(not any(x['id'] == j['id'] for x in live['tickets']), 'FIX the test correction stayed in the test sandbox (not in the live list)')
        else:
            check(False, 'FIX the triage key is readable to check the ticket')
        check(not errors, 'LOAD no console errors on the way', errors[:3])

        # PHONE
        ph = await br.new_context(viewport={'width': 400, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pp = await ph.new_page(); perr = []
        pp.on('pageerror', lambda e: perr.append(str(e)))
        await pp.goto(url.split('#')[0], wait_until='load')
        m = await pp.evaluate("""() => { const w = document.querySelector('.tablewrap'); return { sw: document.scrollingElement.scrollWidth, iw: innerWidth,
            tw: w.scrollWidth, tc: w.clientWidth, fs: parseFloat(getComputedStyle(document.querySelector('main > p:not(.updated)')).fontSize) } }""")
        check(m['sw'] <= m['iw'], 'PHONE no sideways scroll on the page at 400 px', m)
        check(m['tw'] > m['tc'], 'PHONE the table scrolls sideways inside its own box', m)
        check(m['fs'] >= 15, 'PHONE body text is at least 15 px', m['fs'])
        ph = await pp.evaluate("() => ({ top: Math.round(document.querySelector('.tableframe').getBoundingClientRect().top), fold: document.getElementById('ffold').open, h: innerHeight })")
        check(not ph['fold'] and ph['top'] < 1.2 * ph['h'], 'PHONE the filters fold away; the table starts within the first screen and a bit (the disclosure comes first)', ph)
        await pp.click('#ffold > summary')
        check(await pp.locator('#filters input[data-f="d3"]').is_visible(), 'PHONE "Filters" opens them')
        if A.shots:
            os.makedirs(A.shots, exist_ok=True)
            await page.goto(url.split('#')[0], wait_until='load'); await page.evaluate('scrollTo(0, 0)')
            await page.screenshot(path=os.path.join(A.shots, 'desktop-top.png'))
            await page.locator('.filters').scroll_into_view_if_needed(); await page.screenshot(path=os.path.join(A.shots, 'desktop-table.png'))
            await pp.screenshot(path=os.path.join(A.shots, 'phone-top.png'))
            await pp.evaluate("() => scrollTo(0, document.querySelector('.filters').getBoundingClientRect().top + scrollY - 8)"); await pp.screenshot(path=os.path.join(A.shots, 'phone-table.png'))
        await pp.click('#vtt tbody tr[data-id="turnip-works"] a[data-open]')
        await pp.wait_for_selector('dialog#detail[open]')
        box = await pp.evaluate("() => { const r = document.getElementById('detail').getBoundingClientRect(); return { l: r.left, r: r.right, iw: innerWidth, sw: document.scrollingElement.scrollWidth } }")
        check(box['l'] >= 0 and box['r'] <= box['iw'] and box['sw'] <= box['iw'], 'PHONE the details fit the screen', box)
        if A.shots: await pp.screenshot(path=os.path.join(A.shots, 'phone-detail.png'))
        check(not perr, 'PHONE no page errors', perr[:2])
        if A.shots:
            await page.click('#vtt tbody tr[data-id="roll20"] a[data-open]') if any(p['id'] == 'roll20' for p in P) else None
            await page.wait_for_timeout(300); await page.screenshot(path=os.path.join(A.shots, 'desktop-detail.png'))
        await br.close()


def route_checks(origin):
    st, h, b = get(origin + '/vtt-index')
    check(st == 200 and 'text/html' in h.get('Content-Type', ''), 'ROUTE /vtt-index answers HTML', st)
    for p in ('/vtt-index/', '/vtt-index.html'):
        st, h, _ = get(origin + p)
        check(st == 301 and h.get('Location', '').endswith('/vtt-index'), f'ROUTE {p} -> 301 /vtt-index', (st, h.get('Location')))
    st, h, b = get(origin + '/vtt-index.json')
    ok = st == 200 and 'application/json' in h.get('Content-Type', '')
    try: d = json.loads(b); bad = vtt_index.problems(d)
    except Exception as e: d, bad = None, [str(e)]
    check(ok and d and not bad and len(d['products']) == len(P), 'ROUTE /vtt-index.json answers the data, and it validates', (st, h.get('Content-Type'), bad[:2]))
    check(h.get('Access-Control-Allow-Origin') == '*', 'ROUTE the JSON may be read from any site (CORS *)')
    st, h, b = get(origin + '/vtt-index.schema.json')
    check(st == 200 and 'application/json' in h.get('Content-Type', '') and json.loads(b).get('$id', '').endswith('/vtt-index.schema.json'), 'ROUTE /vtt-index.schema.json answers the schema', st)
    st, h, b = get(origin + '/vtt-index.md')
    check(st == 200 and 'text/markdown' in h.get('Content-Type', '') and b.decode('utf-8').startswith('# Turnip Works VTT comparison index'), 'ROUTE /vtt-index.md answers Markdown', (st, h.get('Content-Type')))
    st, _, b = get(origin + '/llms.txt')
    check(st == 200 and b'turnipworks.net/vtt-index' in b and b'vtt-index.json' in b, 'ROUTE llms.txt names the index and its JSON')
    st, _, b = get(origin + '/sitemap.xml')
    check(st == 200 and b'<loc>https://turnipworks.net/vtt-index</loc>' in b, 'ROUTE sitemap.xml lists /vtt-index')


def main():
    data_checks()
    if A.local:
        url, relay = start_local()
    else:
        url, relay = A.page.rstrip('/') + '/vtt-index', A.page.rstrip('/') + '/api/tw-relay'
        route_checks(A.page.rstrip('/'))
    asyncio.run(run(url, relay))
    bad = [r for r in results if not r[0]]
    print(f"\nbrowser_vttindex: {len(results) - len(bad)}/{len(results)} passed" + (f" ({'local' if A.local else A.page})"))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
