#!/usr/bin/env python3
"""The version number on the loading screen (docs/UI.md "The loading screen", docs/NETCODE.md "Version numbers").

  python3 engine/test/browser_version.py        (TW_BROWSER=firefox for Firefox)

Needs no relay, no port and no server: the page is the source index.html stamped the way engine/deploy.sh and a release
stamp it, answered by the browser driver at a made-up address, so its /release.json can say anything at all. main.js is
an empty file, so nothing ever tells the loading screen to leave and it stays up for as long as a test needs it.
"""
import json, os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # (the suite lint; nothing here writes)

HERE = os.path.dirname(os.path.abspath(__file__)); CLIENT = os.path.join(HERE, '..', 'client')
ENG = 'firefox' if os.environ.get('TW_BROWSER', '').lower() == 'firefox' else 'chromium'
ORIGIN = 'http://turnip.test'; STAMP = '20261102000000'
SOURCE = open(os.path.join(CLIENT, 'index.html'), encoding='utf-8').read(); CSS = open(os.path.join(CLIENT, 'style.css'), encoding='utf-8').read()
results = []
def check(ok, name, detail=''):
    results.append(bool(ok)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail != '' else ''}", flush=True)

def stamped(channel):
    s = SOURCE.replace("TW_V = 'dev'", f"TW_V = '{STAMP}'").replace('?v=dev', f'?v={STAMP}').replace('<head>', '<head>\n<base href="/engine/client/">')
    return s.replace('<meta name="tw-channel" content="source">', f'<meta name="tw-channel" content="{channel}">')

NUMBERED = {'id': 'x', 'client': STAMP, 'version': '0.3.5'}
def as_json(body): return lambda r: r.fulfill(status=200, content_type='application/json', headers={'Cache-Control': 'no-store'}, body=body if isinstance(body, str) else json.dumps(body))

def main():
    with sync_playwright() as p:
        browser = getattr(p, ENG).launch(headless=True, args=['--no-sandbox'] if ENG == 'chromium' else [])
        def page(channel='prod', answer=as_json(NUMBERED), vw=1280, vh=800, hand=False):
            ctx = browser.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1); pg = ctx.new_page(); pg.errs = []; pg.asked = []
            pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200]))
            def route(r):
                u = r.request.url
                if u.startswith(ORIGIN + '/engine/client/?') or u == ORIGIN + '/engine/client/': return r.fulfill(status=200, content_type='text/html', body=stamped(channel))
                if '/release.json' in u: pg.asked.append(r.request.headers.get('cache-control', '')); return answer(r)
                if '/style.css' in u: return r.fulfill(status=200, content_type='text/css', body=CSS)
                if '/main.js' in u or '/phone.js' in u: return r.fulfill(status=200, content_type='text/javascript', body='')   # no game: the screen stays up
                return r.abort()
            pg.route('**/*', route)
            pg.goto(f"{ORIGIN}/engine/client/?nointro{'&hand=1' if hand else ''}", wait_until='commit'); pg.wait_for_selector('#twl .twl-name', state='visible')
            return ctx, pg
        ver = lambda pg: pg.evaluate("document.getElementById('twl-ver').textContent")
        # where the line is against the screen's contents and the window: the real boxes of everything that is showing
        LAYOUT = """() => { const v = document.getElementById('twl-ver').getBoundingClientRect(), box = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
          const kids = [...document.querySelectorAll('#twl .twl-mark, #twl .twl-name, #twl .twl-bar, #twl .twl-words, #twl .twl-why, #twl .twl-fail button, #twl .twl-detail')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height > 0);
          const lowest = Math.max(...kids.map(e => e.getBoundingClientRect().bottom)), ti = document.querySelector('#twl .twl-name').getBoundingClientRect();
          return { top: v.top, bottom: v.bottom, left: v.left, right: v.right, h: v.height, w: innerWidth, H: innerHeight, lowest, gap: v.top - lowest, size: parseFloat(getComputedStyle(document.getElementById('twl-ver')).fontSize), shown: getComputedStyle(document.getElementById('twl-ver')).display !== 'none' }; }"""
        def layout_ok(pg, name, need=4):
            l = pg.evaluate(LAYOUT)
            check(l['shown'] and l['h'] > 0 and l['bottom'] <= l['H'] - 8 and l['left'] >= 0 and l['right'] <= l['w'], f'{name}: the line is on the screen, at the foot', {k: round(l[k], 1) for k in ('top', 'bottom', 'H', 'size')})
            check(l['gap'] >= need, f'{name}: it touches nothing above it', f"{l['gap']:.1f} px clear of the lowest thing on the screen")

        print('V. what the line says')
        ctx, pg = page(); pg.wait_for_function("document.getElementById('twl-ver').textContent !== ''", timeout=5000)
        check(ver(pg) == 'v0.3.5', 'V1 a numbered live release: v0.3.5', ver(pg))
        check(len(pg.asked) == 1, 'V2 asked for once, and the browser told not to use a copy', pg.asked)
        check(not pg.errs, 'V3 no script error', pg.errs); ctx.close()
        for ch in ('dev', 'source'):
            ctx, pg = page(ch); pg.wait_for_timeout(400)
            check(ver(pg) == 'dev build' and not pg.asked, f'V4 channel {ch}: "dev build", never a number, and /release.json is not asked', (ver(pg), pg.asked)); ctx.close()

        print('F. every way the answer can fail shows nothing and breaks nothing')
        CASES = [('404', lambda r: r.fulfill(status=404, body='nope')), ('500', lambda r: r.fulfill(status=500, body='no')), ('the network failed', lambda r: r.abort()), ('not JSON', as_json('<html>hello')),
                 ('no number: the moment between the swap and the stamp', as_json({'id': 'x', 'client': STAMP})), ('another build\'s number (a stale page)', as_json({'client': '19991231', 'version': '9.9.9'})),
                 ('a number that is not one', as_json({'client': STAMP, 'version': '<img src=x>'})), ('JSON null', as_json('null')), ('a redirect to another site', lambda r: r.fulfill(status=301, headers={'Location': 'https://elsewhere.test/release.json'}))]
        for name, answer in CASES:
            ctx, pg = page(answer=answer); pg.wait_for_timeout(300)
            screen = pg.evaluate("({ words: twLoad.words, failed: twLoad.failed || null, name: document.querySelector('.twl-name').textContent })")
            check(ver(pg) == '' and not pg.errs and screen['words'] == ['Fetching the game'] and not screen['failed'], f'F {name}', (ver(pg), pg.errs, screen)); ctx.close()
        hung = []
        ctx, pg = page(answer=lambda r: hung.append(r))
        pg.wait_for_timeout(200); check(ver(pg) == '' and len(hung) == 1, 'F no answer at all: the line stays empty', ver(pg))
        left = pg.evaluate("() => { twLoad.at('code'); twLoad.at('look'); twLoad.at('welcome', 'k'); twLoad.at('state'); twLoad.done(); return { left: !!twLoad.left, shown: twLoad.shown() }; }")
        check(left['left'] and not left['shown'], 'F the screen does not wait for it: told to leave, it leaves', left)
        pg.wait_for_timeout(4300); check(ver(pg) == '' and not pg.errs, 'F given up after 4 s, without a sound', pg.errs); hung[0].abort(); ctx.close()

        print('L. where it sits')
        for name, vw, vh, hand in (('desktop', 1280, 800, False), ('small desktop', 1024, 600, False), ('phone', 390, 844, True), ('small phone', 320, 568, True), ('phone on its side', 667, 375, True)):
            ctx, pg = page(vw=vw, vh=vh, hand=hand); pg.wait_for_function("document.getElementById('twl-ver').textContent !== ''", timeout=5000)
            check(not pg.evaluate('twLoad.failed'), f'{name}: the ordinary loading screen', pg.evaluate('twLoad.failed')); layout_ok(pg, name)
            def failing(name):   # (a failure's sentences fill a screen under 480 px tall: the number gives way to them there)
                pg.wait_for_timeout(50)
                if vh > 480: check(ver(pg) == 'v0.3.5', f'{name}: the number stays', ver(pg)); layout_ok(pg, name)
                else: check(not pg.evaluate(LAYOUT)['shown'], f'{name}: the number gives way')
            pg.evaluate("twLoad.fail('relay')"); failing(f'{name}, a failure')
            pg.evaluate("twLoad.mend('relay'); twLoad.fail('code', 'x'.repeat(400))"); failing(f'{name}, the longest failure')
            ctx.close()

        print('M. the same screen\'s other uses')
        ctx, pg = page(); pg.wait_for_function("document.getElementById('twl-ver').textContent !== ''", timeout=5000)
        pg.evaluate("() => { twLoad.off(); twLoad.wait('net', 'Reconnecting'); }"); pg.wait_for_selector('#twl.pill', state='visible')
        check(pg.evaluate("getComputedStyle(document.getElementById('twl-ver')).display") == 'none', 'M1 reconnecting: the small pill carries no number')
        pg.evaluate("() => { twLoad.clear('net'); twLoad.wait('travel', 'Walking to the cellar'); }"); pg.wait_for_function("twLoad.mode === 'travel' && twLoad.shown()", timeout=3000)
        layout_ok(pg, 'M2 travelling'); check(ver(pg) == 'v0.3.5', 'M3 travelling shows the same number, with no second question', pg.asked)
        check(len(pg.asked) == 1, 'M4 asked once in all', pg.asked)
        check(not pg.errs, 'M5 no script error', pg.errs); ctx.close()
        browser.close()
    print(f'browser_version ({ENG}): {sum(results)}/{len(results)} checks passed')
    return 0 if all(results) else 1

sys.exit(main())
