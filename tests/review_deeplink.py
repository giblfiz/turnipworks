#!/usr/bin/env python3
# Usage: python3 tests/review_deeplink.py https://implausible.enterprises/projects/turnip-works/review-meshy-depth/
"""Deep links into a review page (2026-11-10): ?sku=<asset>, #<asset>, ?sku=<group> (narrows the list to the group),
an unknown sku (toast, normal queue), and no param (unchanged: first unreviewed). The ratings API is mocked, so nothing
is written. Each opened asset must have its model in the 3 views, with no page or console errors."""
import json, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1].rstrip('/') + '/'
res = []
def check(name, ok, info=''):
    res.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name, info, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    errs = []
    def fresh():  # a new tab per link: a page torn down mid-preload logs aborted texture loads that are not this link's
        page = b.new_page(viewport={'width': 1600, 'height': 950})
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        page.route('**/api/tw-ratings/ratings*', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
        return page
    pg = fresh()
    pg.goto(BASE); pg.wait_for_function('window.__tw && __tw.sku', timeout=90000)
    assets = pg.evaluate("fetch('assets.json').then(r => r.json())")['assets']
    groups = [g for g in dict.fromkeys(a.get('group') for a in assets) if g]
    check('no param: opens the first asset as before', pg.evaluate('__tw.sku') == assets[0]['sku'], pg.evaluate('__tw.sku'))

    def opened(url, want, members=None, label=''):
        global pg
        pg.close(); errs.clear(); pg = fresh()
        pg.goto(url); pg.wait_for_function('s => window.__tw && __tw.sku === s', arg=want, timeout=90000)
        pg.wait_for_timeout(4000)  # let the preloads of the next entries finish too
        st = pg.evaluate("""() => ({sku: __tw.sku, name: document.getElementById('name').textContent,
            kids: __twDebug.VIEWS.map(v => v.pivot.children.length), frames: __twDebug.frames, filtered: __twDebug.filtered,
            active: document.querySelector('#assets button.active')?.title || null})""")
        a = next(x for x in assets if x['sku'] == want)
        # drawn, not just attached: the share of the front view's pixels that differ from its background colour
        from io import BytesIO; from PIL import Image
        im = Image.open(BytesIO(pg.locator('.view[data-view="0"]').screenshot())).convert('RGB')
        px = list(im.getdata()); st['drawn'] = round(sum(sum(abs(c - k) for c, k in zip(q, (0x29, 0x2d, 0x28))) > 40 for q in px) / len(px), 3)
        ok = st['name'] == a['name'] and st['kids'] == [1, 1, 1] and st['active'] == want and not errs and st['drawn'] > 0.03
        if members is not None: ok = ok and st['filtered'] == members
        check(f'{label} {url[len(BASE):]} -> {want}', ok, f"drawn {st['drawn']:.0%} of the front view" if ok else {**st, 'errs': errs[:3]})
        return st

    for g in groups[:3]:
        members = [a['sku'] for a in assets if a.get('group') == g]
        opened(f'{BASE}?sku={g}', members[0], members, 'group link narrows to its entries:')
    for a in [x for x in assets if x.get('group')][4:20:7] or assets[1:3]:
        opened(f"{BASE}?sku={a['sku']}", a['sku'], label='asset link:')
    a = assets[-1]
    opened(f"{BASE}#{a['sku']}", a['sku'], label='hash link:')
    pg.close(); errs.clear(); pg = fresh(); pg.goto(f'{BASE}?sku=no-such-thing'); pg.wait_for_function('window.__tw && __tw.sku', timeout=90000)
    check('unknown sku: toast, normal queue', 'No asset' in pg.locator('#toast').inner_text() and pg.evaluate('__tw.sku') == assets[0]['sku'])
    pg.screenshot(path='/tmp/review_deeplink.png')
    b.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
