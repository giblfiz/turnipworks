#!/usr/bin/env python3
"""SEARCH AND LINK PREVIEWS: what a crawler or a link-preview bot gets from the site.  (2026-10-23)

  python3 engine/test/seo_check.py                                   dev, box-local (http://127.0.0.1:8180)
  python3 engine/test/seo_check.py --page http://127.0.0.1 --host turnipworks.net      prod through the box's nginx
  python3 engine/test/seo_check.py --page https://turnipworks.net                      prod the public way (Cloudflare)
  python3 engine/test/seo_check.py --source                          the committed files only (no server)
  ... --mock card.png                                                also draw a chat-app style preview card (Playwright)

  SRC    engine/client/site/* match their sources (build_site.py --check); the homepage source carries the same picture
  TAGS   /, /about, /vtt-index, /terms, /privacy, /connect-dnd-beyond, fetched as Googlebot, Discordbot, Twitterbot and facebookexternalhit: 200 HTML, one
         <title>, a description of 50-170 characters, canonical = og:url = https://turnipworks.net<path>, og:title,
         og:description, og:type, og:site_name, og:image (absolute https) 1200x630, twitter:card summary_large_image,
         twitter:image; every tag inside <head> and in the first 32 KB; no key twice; no "forever" in any copy
  IMAGE  the picture answers 200 image/jpeg here, is 1200x630 and under 300 KB
  ROBOTS dev: robots.txt shuts everyone out and every page says X-Robots-Tag noindex. prod: robots.txt lets every named
         search and AI crawler fetch the pages (urllib.robotparser) but not /api/, names the sitemap; no page says noindex
  MAP    sitemap.xml parses, lists exactly the six public pages (no campaign or table address), each answers 200 here
  LLMS   llms.txt answers 200 text/plain utf-8, starts "# Turnip Works" with a "> " summary, and its turnipworks.net links
         answer 200 here
Absolute turnipworks.net addresses are asked of the server under test by their path (dev serves the same files).
Reads only; writes nothing but the --mock picture.
"""
import argparse, html.parser, io, os, re, subprocess, sys, urllib.error, urllib.parse, urllib.request, urllib.robotparser
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
SITE = 'https://turnipworks.net'
PAGES = ['/', '/about', '/vtt-index', '/terms', '/privacy', '/connect-dnd-beyond']
BOTS = {'Googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Discordbot': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'Twitterbot': 'Twitterbot/1.0',
        'facebookexternalhit': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'}
CRAWLERS = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'Claude-SearchBot', 'ClaudeBot',
            'PerplexityBot', 'Google-Extended', 'Applebot', 'SomeNewBot']
NEED_PROP = ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:url', 'og:image', 'og:image:width', 'og:image:height']
NEED_NAME = ['description', 'twitter:card', 'twitter:image', 'twitter:title', 'twitter:description']

ap = argparse.ArgumentParser()
ap.add_argument('--page', default='http://127.0.0.1:8180', help='origin to ask (default: dev, box-local)')
ap.add_argument('--host', help='Host header to send (e.g. turnipworks.net through the box\'s own nginx)')
ap.add_argument('--expect', choices=['dev', 'prod'], help='which robots rules to expect (default: from the address)')
ap.add_argument('--source', action='store_true', help='check the committed files only')
ap.add_argument('--mock', help='also draw a preview card of the homepage to this PNG')
A = ap.parse_args()
ORIGIN = A.page.rstrip('/')
EXPECT = A.expect or ('dev' if ('dev.' in (A.host or ORIGIN) or ':8180' in ORIGIN) else 'prod')
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

def get(path_or_url, ua='Mozilla/5.0 (seo_check)'):
    path = urllib.parse.urlsplit(path_or_url).path or '/' if path_or_url.startswith('http') else path_or_url
    req = urllib.request.Request(ORIGIN + path, headers={'User-Agent': ua, **({'Host': A.host} if A.host else {})})
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k): return None
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=20) as r: return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read()

class Head(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.in_head = False; self.head_done = False; self.titles = []; self._t = None
        self.props = []; self.names = []; self.links = []; self.outside = []; self.offsets = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'head': self.in_head = True
        if tag == 'body': self.in_head = False; self.head_done = True
        if tag == 'title' and self.in_head: self._t = ''
        if tag == 'meta' and ('property' in a or 'name' in a):
            key = a.get('property') or a.get('name')
            if not self.in_head: self.outside.append(key)
            (self.props if 'property' in a else self.names).append((key, a.get('content', '')))
            self.offsets.append(self.getpos())
        if tag == 'link' and a.get('rel') == 'canonical': self.links.append(a.get('href'))
    def handle_endtag(self, tag):
        if tag == 'title' and self._t is not None: self.titles.append(self._t.strip()); self._t = None
        if tag == 'head': self.in_head = False; self.head_done = True
    def handle_data(self, d):
        if self._t is not None: self._t += d

def tags(body):
    text = body.decode('utf-8'); p = Head(); p.feed(text)
    lines = text.split('\n'); off = lambda pos: sum(len(l) + 1 for l in lines[:pos[0] - 1]) + pos[1]
    return p, max((off(o) for o in p.offsets), default=0)

def page_checks(path, body, label):
    p, last = tags(body)
    props, names = dict(p.props), dict(p.names)
    want = SITE + ('/' if path == '/' else path)
    check(len(p.titles) == 1 and p.titles[0], f'{label} {path}: one <title>', p.titles)
    d = names.get('description', '')
    check(50 <= len(d) <= 170, f'{label} {path}: description 50-170 characters', f'{len(d)}: {d}')
    miss = [k for k in NEED_PROP if not props.get(k)] + [k for k in NEED_NAME if not names.get(k)]
    check(not miss, f'{label} {path}: every Open Graph and Twitter tag present', miss or '')
    dup = sorted({k for k, _ in p.props + p.names if [x for x, _ in p.props + p.names].count(k) > 1})
    check(not dup, f'{label} {path}: no tag twice', dup or '')
    check(p.links == [want] and props.get('og:url') == want, f'{label} {path}: canonical = og:url = {want}', (p.links, props.get('og:url')))
    img = props.get('og:image', '')
    check(img.startswith(SITE + '/') and img == names.get('twitter:image'), f'{label} {path}: og:image absolute on {SITE}, = twitter:image', img)
    check(props.get('og:image:width') == '1200' and props.get('og:image:height') == '630' and names.get('twitter:card') == 'summary_large_image',
          f'{label} {path}: 1200x630, summary_large_image')
    check(not p.outside and last < 32768, f'{label} {path}: tags inside <head>, all in the first 32 KB', f'last at byte {last}' + (f'; outside: {p.outside}' if p.outside else ''))
    copy = ' '.join(v for _, v in p.props + p.names) + ' '.join(p.titles)
    check('forever' not in copy.lower(), f'{label} {path}: no "forever" in the copy')
    return img, props, names, p.titles[0] if p.titles else ''

def image_check(url, fetch):
    from PIL import Image
    st, h, b = fetch(url)
    ct = h.get('Content-Type', '')
    try: size = Image.open(io.BytesIO(b)).size
    except Exception as e: size = repr(e)
    check(st == 200 and ct.startswith('image/jpeg') and size == (1200, 630) and len(b) < 300_000,
          f'IMAGE {urllib.parse.urlsplit(url).path}: 200 image/jpeg 1200x630 < 300 KB', f'{st} {ct} {size} {len(b)} bytes')

def source_checks():
    r = subprocess.run(['python3', os.path.join(ENGINE, 'tools', 'build_site.py'), '--check'], capture_output=True, text=True)
    check(r.returncode == 0, 'SRC engine/client/site/* match docs/site (build_site.py --check)', (r.stdout + r.stderr).strip())
    home = open(os.path.join(ENGINE, 'client', 'index.html'), 'rb').read()
    img, *_ = page_checks('/', home, 'SRC')
    src = open(os.path.join(ENGINE, 'tools', 'build_site.py'), encoding='utf-8').read()
    m = re.search(r"^OG_IMAGE = SITE \+ '([^']+)'", src, re.M); theirs = SITE + m.group(1) if m else None
    check(img == theirs, 'SRC the homepage and the site pages name the same picture', (img, theirs))
    path = os.path.join(ENGINE, 'client', urllib.parse.urlsplit(img).path.split('/engine/client/', 1)[-1])
    image_check(img, lambda u: (200, {'Content-Type': 'image/jpeg'}, open(path, 'rb').read()) if os.path.exists(path) else (404, {}, b''))

def server_checks():
    print(f'server {ORIGIN}{" (Host: " + A.host + ")" if A.host else ""}, expecting {EXPECT} rules')
    img = None; home = None
    for path in PAGES:
        for bot, ua in BOTS.items():
            st, h, b = get(path, ua)
            ok = st == 200 and h.get('Content-Type', '').startswith('text/html')
            check(ok, f'TAGS {path} as {bot}: 200 HTML', f'{st} {h.get("Content-Type")}')
            if not ok: continue
            if bot == 'Googlebot':
                got = page_checks(path, b, 'TAGS'); img = img or got[0]
                if path == '/': home = got
                xr = h.get('X-Robots-Tag', '')
                if EXPECT == 'dev': check('noindex' in xr, f'ROBOTS {path}: X-Robots-Tag noindex (dev)', xr)
                else: check('noindex' not in xr, f'ROBOTS {path}: no noindex (prod)', xr or 'none')
    if img: image_check(img, get)
    st, h, b = get('/robots.txt'); txt = b.decode('utf-8', 'replace')
    check(st == 200 and h.get('Content-Type', '').startswith('text/plain'), 'ROBOTS /robots.txt answers 200 text/plain', f'{st} {h.get("Content-Type")}')
    rp = urllib.robotparser.RobotFileParser(); rp.parse(txt.splitlines())
    if EXPECT == 'dev':
        shut = [c for c in CRAWLERS if not rp.can_fetch(c, SITE + '/') and not rp.can_fetch(c, SITE + '/about')]
        check(len(shut) == len(CRAWLERS), 'ROBOTS dev robots.txt shuts every crawler out', f'{len(shut)}/{len(CRAWLERS)}')
        check('noindex' in h.get('X-Robots-Tag', ''), 'ROBOTS dev robots.txt itself says noindex', h.get('X-Robots-Tag'))
    else:
        bad = [c for c in CRAWLERS if not all(rp.can_fetch(c, SITE + p) for p in PAGES + ['/engine/client/main.js', '/llms.txt'])]
        check(not bad, 'ROBOTS every named search and AI crawler may fetch the pages, the game code and llms.txt', bad or ', '.join(CRAWLERS))
        check(not rp.can_fetch('Googlebot', SITE + '/api/tw-relay/health'), 'ROBOTS /api/ is left out')
        check(not rp.can_fetch('Googlebot', SITE + '/s/AAAAAAAAAAAAAAAAAAAAAA'), 'ROBOTS /s/ (unlisted share links) is left out')
        check(re.search(r'(?mi)^Sitemap:\s*' + re.escape(SITE + '/sitemap.xml') + r'\s*$', txt), 'ROBOTS names the sitemap')
    st, h, b = get('/sitemap.xml')
    try: locs = [e.text for e in ET.fromstring(b).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    except ET.ParseError as e: locs = [repr(e)]
    check(st == 200 and 'xml' in h.get('Content-Type', ''), 'MAP /sitemap.xml answers 200 XML', f'{st} {h.get("Content-Type")}')
    check(locs == [SITE + p for p in PAGES], 'MAP lists exactly the six public pages', locs)
    dead = [l for l in locs if get(l)[0] != 200]
    check(not dead and not any(c in ''.join(locs) for c in '#?'), 'MAP every address answers 200, none a campaign or table', dead or '')
    st, h, b = get('/llms.txt'); txt = b.decode('utf-8', 'replace')
    check(st == 200 and h.get('Content-Type', '').startswith('text/plain') and 'utf-8' in h.get('Content-Type', '').lower(),
          'LLMS /llms.txt answers 200 text/plain utf-8', f'{st} {h.get("Content-Type")}')
    check(txt.startswith('# Turnip Works\n') and re.search(r'(?m)^> \S', txt) and 'forever' not in txt.lower(), 'LLMS "# Turnip Works", a "> " summary, no "forever"')
    links = sorted(set(re.findall(r'https://turnipworks\.net[^\s)\]]*', txt)))
    dead = [l for l in links if get(l)[0] != 200]
    check(links and not dead, f'LLMS its {len(links)} turnipworks.net links answer 200', dead or '')
    return home

def mock(home, out):
    """A chat-app style card (as Discord and X draw it: the picture at ~400 px, the site, title and description)."""
    import base64
    sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: F401 (the page is set_content: nothing to write, but every browser of a test wears the header)
    from playwright.sync_api import sync_playwright
    img, props, names, title = home
    st, h, b = get(img)
    data = 'data:image/jpeg;base64,' + base64.b64encode(b).decode()
    esc = lambda s: s.replace('&', '&amp;').replace('<', '&lt;')
    page = f"""<!doctype html><meta charset=utf-8><style>
      body {{ margin: 0; padding: 24px; background: #313338; font: 15px/1.35 system-ui, sans-serif; color: #dbdee1; width: 520px; }}
      .msg {{ margin-bottom: 8px; }} .msg a {{ color: #00a8fc; }}
      .card {{ max-width: 432px; border-left: 4px solid #1e1f22; background: #2b2d31; border-radius: 4px; padding: 8px 16px 16px 12px; }}
      .site {{ font-size: 12px; color: #b5bac1; margin: 8px 0 4px; }} .t {{ color: #00a8fc; font-weight: 600; margin-bottom: 8px; }}
      .d {{ font-size: 14px; margin-bottom: 14px; }} .card img {{ width: 400px; height: 210px; border-radius: 4px; display: block; }}
      .x {{ margin-top: 28px; width: 400px; border: 1px solid #3f4147; border-radius: 16px; overflow: hidden; position: relative; }}
      .x img {{ width: 400px; height: 210px; display: block; }} .x span {{ position: absolute; left: 10px; bottom: 10px; background: rgba(0,0,0,.77); color: #fff; font-size: 13px; padding: 1px 5px; border-radius: 4px; }}
    </style><div class=msg>here's the table: <a>https://turnipworks.net/#s=…</a></div>
    <div class=card><div class=site>{esc(props.get('og:site_name', ''))}</div><div class=t>{esc(props.get('og:title', ''))}</div>
    <div class=d>{esc(props.get('og:description', ''))}</div><img src="{data}"></div>
    <div class=x><img src="{data}"><span>turnipworks.net</span></div>"""
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-sandbox']); pg = br.new_page(viewport={'width': 568, 'height': 700}, device_scale_factor=1)
        pg.set_content(page); pg.wait_for_timeout(200); pg.screenshot(path=out, full_page=True); br.close()
    print(f'  mock preview card: {out}')

if A.source: source_checks()
else:
    home = server_checks()
    if A.mock and home: mock(home, A.mock)
bad = [n for ok, n in results if not ok]
print(f'\nseo_check: {len(results) - len(bad)}/{len(results)} ok' + (f'; FAILED: {bad}' if bad else ''))
sys.exit(1 if bad else 0)
