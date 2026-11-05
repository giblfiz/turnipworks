#!/usr/bin/env python3
"""THE SITE PAGES: docs/site/{about,terms,privacy,connect-dnd-beyond,features,dice,switching,assets,export,manual}.md -> engine/client/site/<name>.html  (2026-10-21)

  python3 engine/tools/build_site.py           write the pages (engine/deploy.sh runs this)
  python3 engine/tools/build_site.py --check   exit 1 if a committed page differs from its source

The copy lives in docs/site/*.md (read and edit it there); the HTML is generated, one self-contained page each (inline
CSS, the game's Inter and light-theme colours, a phone layout). nginx serves them at turnipworks.net/about, /terms and
/privacy (engine/relay/nginx-*.conf); the game links to them from the start card and Settings (surfaces/settings.js).
Front matter: title, nav (the short name in the link row), updated (YYYY-MM-DD, shown as "Last updated"), description
(the search snippet and the link preview's text).
HELP PAGES (2026-10-29): HELP below, the same look, nav and footer, not in the nav row. The first is "Connect D&D Beyond"
(/connect-dnd-beyond; docs/BEYOND20.md), opened from Settings ▸ Me and Vision, distance & rules. Its film and pictures are
git-ignored binaries in engine/client/site/ddb/, put there by engine/tools/build_ddb_media.sh (engine/deploy.sh runs it)
from the masters on the USB disk.

SEARCH AND LINK PREVIEWS (2026-10-23): each page carries a canonical address on turnipworks.net and Open Graph / Twitter
card tags (the picture is the game's own card, OG_IMAGE below; the homepage, engine/client/index.html, carries the same
set by hand). This also writes, beside the pages (so a release carries them with the client):
  robots.txt    PROD's (allow everyone, search and AI crawlers named; the sitemap). Dev answers its own Disallow: / in nginx.
  sitemap.xml   the public pages: /, NAV, HELP (never a campaign or table address)
  llms.txt      copied from docs/site/llms.txt (a plain summary for AI assistants; llmstxt.org)
nginx serves them at /robots.txt, /sitemap.xml and /llms.txt (engine/relay/nginx-*.conf). engine/test/seo_check.py checks it all.

THE VTT COMPARISON INDEX (2026-10-29): docs/site/vtt-index.md (the words) + docs/site/vtt-index.json (the data, checked
against docs/site/vtt-index.schema.json here: a bad row stops the build) -> vtt-index.html (engine/tools/site_vtt_index.py,
with engine/tools/site/vtt-index.{css,js} inlined), plus vtt-index.json, vtt-index.schema.json and vtt-index-md.txt (the
whole table as Markdown) beside it. nginx serves them at /vtt-index, /vtt-index.json, /vtt-index.schema.json and
/vtt-index.md. How to update the data: docs/VTT_INDEX.md (tools/vtt-index/vtt_index.py).

THE ASSETS PAGE (2026-11-04): /assets, every prop, room kit and figure by pack (the game's own Build tree), each with its own
address on the page, its file and a "Use it in Turnip Works" link (client/deeplink.js). docs/site/assets.md (the words) +
docs/site/assets-packs.json (each pack's sentence and hero) + engine/tools/site_assets_data.mjs (the data, run in Node) ->
assets.html (engine/tools/site_assets.py, engine/tools/site/assets.{css,js} inlined) and assets.json beside it (nginx: /assets
and /assets.json). Its pictures are git-ignored, in client/site/library/ (tools/site-assets/media.py; engine/deploy.sh).

THE GUIDE PAGES (2026-11-04, for Google Ads sitelinks: each a distinct page): /features (a tour of what is live), /dice (the
game-system dice words), /switching (coming from Roll20, Foundry, Owlbear Rodeo or TaleSpire), in the nav row; /export
(Universal VTT files for Foundry, Roll20, Fantasy Grounds) as a help page. All four load landing.js (LANDING above).

THE MANUAL (2026-11-04, Harry: "one of the things we clearly need for Turnip Works is an instruction manual"): /manual, one
long page with an anchored contents list (heading ids by attr_list, `## Building {#building}`), in the nav row after
Features, and linked from the game's start card and Settings. Like /features it describes only what branch `live` has.
"""
import datetime, html, json, os, re, sys
import markdown
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import site_vtt_index as vtt  # noqa: E402
import site_assets  # noqa: E402
import subprocess  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
SRC = os.path.join(REPO, 'docs', 'site'); OUT = os.path.join(ENGINE, 'client', 'site')
PAGES = ['about', 'terms', 'privacy']       # the Markdown pages
NAV = ['features', 'manual', 'assets', 'dice', 'switching', 'vtt-index', 'about', 'terms', 'privacy']   # the link row on every page (and the sitemap, after /)
INDEX = 'vtt-index'
HELP = ['connect-dnd-beyond', 'export']   # help pages: rendered like the Markdown pages, in the sitemap, not in the nav row
# AD LANDING PAGES (2026-11-04): pages an ad's sitelink lands on. Each loads client/landing.js, the same first-party note the
# front door and /vtt-index take (dd5b508f), so a table started later from "/" still carries the utm_* and the click id.
LANDING = ['features', 'dice', 'switching', 'export']  # (and assets: its own script loads landing.js, site_assets.script)
ASSETS = 'assets'
# NOT COMMITTED (2026-11-04): the assets page and its data follow the tuner's library, which changes whenever an asset
# lands; committed, they would make --check (and the suites that run it) fail on every new asset. Written by every build
# (engine/deploy.sh), git-ignored, and a release carries them with the client like the pictures.
GENERATED = {ASSETS + '.html', ASSETS + '.json'}
SOURCE = 'https://github.com/giblfiz/turnipworks'
SITE = 'https://turnipworks.net'
# the link preview's picture: a real frame of the game (the approved promo, 2026-10-23), 1200x630. A new picture gets a
# new name (Discord, X and Cloudflare keep the old one for days); change it here and in engine/client/index.html.
OG_IMAGE = SITE + '/engine/client/site/og-20261023.jpg'
OG_ALT = 'Three dice tumbling over four miniatures in a furnished 3D tavern, on a Turnip Works table'
CRAWLERS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'Claude-SearchBot',
            'Claude-User', 'ClaudeBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended']

CSS = """
@font-face { font-family: Inter; src: url('/engine/client/vendor/inter/inter-latin-wght-normal.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
:root { --bg: #e9e6df; --paper: #fcfbf8; --raised: #f0ede6; --line: rgba(20,20,20,.14); --ink: #1a1917; --ink-2: #3d3b36; --mute: #5f5c55; --accent: #a8770f; color-scheme: light; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-underline-offset: 2px; }
a:hover { color: var(--ink); }
.top { max-width: 46rem; margin: 0 auto; padding: 18px 20px 0; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
.brand { display: flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font-weight: 650; font-size: 17px; letter-spacing: -.01em; }
.brand img { width: 36px; height: 36px; }
.links { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-left: auto; font-size: 14px; }
.links a { color: var(--ink-2); text-decoration: none; }
.links a:hover, .links a[aria-current] { color: var(--ink); text-decoration: underline; }
.links a[aria-current] { font-weight: 650; }
main { max-width: 46rem; margin: 16px auto 0; padding: 28px 20px 32px; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; }
@media (min-width: 760px) { main { padding: 40px 48px 44px; } }
h1 { margin: 0 0 4px; font-size: 30px; line-height: 1.2; font-weight: 700; letter-spacing: -.02em; }
.updated { margin: 0 0 24px; color: var(--mute); font-size: 14px; }
h2 { margin: 34px 0 8px; font-size: 20px; line-height: 1.3; font-weight: 680; letter-spacing: -.01em; }
h3 { margin: 24px 0 6px; font-size: 17px; font-weight: 650; }
p, ul { margin: 0 0 14px; } ul { padding-left: 22px; } li { margin: 0 0 6px; }
strong { font-weight: 650; }
.play { display: inline-block; margin-top: 18px; padding: 10px 16px; border-radius: 9px; background: var(--ink); color: var(--paper); text-decoration: none; font-weight: 600; }
.play:hover { color: var(--paper); background: var(--ink-2); }
@media (max-width: 520px) { .top .links { margin-left: 0; width: 100%; } }
footer { max-width: 46rem; margin: 0 auto; padding: 18px 20px 40px; color: var(--mute); font-size: 13px; }
ol { margin: 0 0 14px; padding-left: 24px; } ol li { margin: 0 0 8px; padding-left: 2px; }
code { font: 14px/1.4 ui-monospace, 'SF Mono', Menlo, Consolas, monospace; background: var(--raised); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; overflow-wrap: anywhere; }
pre { margin: 0 0 14px; padding: 10px 14px; background: var(--raised); border: 1px solid var(--line); border-radius: 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
pre code { background: none; border: 0; padding: 0; }
kbd { font: 600 13px/1 Inter, system-ui, sans-serif; padding: 2px 6px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; background: var(--paper); }
figure { margin: 18px 0 22px; }
figure video, figure img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--line); background: #1a1917; }
figcaption { margin-top: 6px; color: var(--mute); font-size: 14px; }
.note { padding: 12px 16px; margin: 0 0 16px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line); }
.note p:last-child { margin-bottom: 0; }
ol.steps { padding-left: 26px; } ol.steps > li { margin: 0 0 26px; } ol.steps > li > p { margin: 0 0 8px; } ol.steps > li::marker { font-weight: 700; }
ol.steps img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--line); background: #1a1917; }
footer .links { margin: 0 0 6px; }
"""

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Turnip Works</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Turnip Works">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og_image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{og_alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{og_image}">
<meta name="twitter:image:alt" content="{og_alt}">
<link rel="icon" href="/engine/client/mark.svg" type="image/svg+xml">
<style>{css}</style>{head_extra}
</head>
<body{body_attr}>
<header class="top">
  <a class="brand" href="/"><img src="/engine/client/mark.svg" alt="" width="36" height="36">Turnip Works</a>
  {links}
</header>
<main>
<h1>{title}</h1>
<p class="updated">Last updated {updated}</p>
{body}
<a class="play" href="/">Open Turnip Works</a>
</main>
<footer>
  {links}
  <div>© {year} Implausible Enterprises LLC · Engine AGPL-3.0 · Assets CC BY 4.0</div>
</footer>{script}
</body>
</html>
"""


def front(text):
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    if not m: sys.exit('a site page needs front matter (title, nav, updated, description)')
    meta = dict(line.split(':', 1) for line in m.group(1).splitlines() if ':' in line)
    return {k.strip(): v.strip() for k, v in meta.items()}, text[m.end():]


def index_data():
    d = json.load(open(os.path.join(SRC, INDEX + '.json'), encoding='utf-8'))
    sys.path.insert(0, os.path.join(REPO, 'tools', 'vtt-index')); import vtt_index  # noqa: E402
    bad = vtt_index.problems(d)
    if bad: sys.exit('docs/site/vtt-index.json has problems (python3 tools/vtt-index/vtt_index.py validate):\n  ' + '\n  '.join(bad[:20]))
    return d


def render(name, metas, data=None):
    meta, body = front(open(os.path.join(SRC, name + '.md'), encoding='utf-8').read())
    body = re.sub(r'^# .*\n', '', body.lstrip('\n'), count=1)  # the template prints the title itself
    updated = metas[name]['updated']
    day = datetime.date.fromisoformat(updated)
    cur = ' aria-current="page"'
    nav = ''.join(f'<a href="/{p}"{cur if p == name else ""}>{html.escape(metas[p]["nav"])}</a>' for p in NAV)
    links = f'<nav class="links" aria-label="Turnip Works pages">{nav}<a href="{SOURCE}">Source</a></nav>'
    out = markdown.markdown(body, extensions=['extra', 'sane_lists', 'md_in_html'], output_format='html')
    extra = {'head_extra': '', 'body_attr': '', 'script': ''}
    if name in LANDING:
        extra['script'] = '\n<script type="module" src="/engine/client/landing.js"></script>'
    if name == ASSETS:
        d, metas_a = assets_data()
        out = site_assets.body(out, d, metas_a)
        desc = meta['description'].replace('[[THINGS]]', f"{d['counts']['things']:,}").replace('[[FIGURES]]', str(d['counts']['figures']))
        meta = {**meta, 'description': desc}
        extra = {'head_extra': '\n' + site_assets.head_extra(d, desc), 'body_attr': ' class="wide"', 'script': '\n' + site_assets.script(metas_a)}
    if name == INDEX:
        out = vtt.body(out, data)
        extra = {'head_extra': '\n' + vtt.head_extra(data, meta['description']), 'body_attr': ' class="wide"', 'script': '\n' + vtt.script()}
    return TEMPLATE.format(title=html.escape(meta['title']), description=html.escape(meta['description'], quote=True), css=CSS.strip(),
                           url=f'{SITE}/{name}', og_image=OG_IMAGE, og_alt=html.escape(OG_ALT, quote=True),
                           links=links, updated=f'{day.day} {day:%B %Y}', year=day.year, body=out, **extra)


_ASSETS = None
def assets_data():
    """the assets page's data (engine/tools/site_assets_data.mjs: the game's Build tree, run in Node) and its packs' words"""
    global _ASSETS
    if _ASSETS is None:
        r = subprocess.run(['node', os.path.join(HERE, 'site_assets_data.mjs')], capture_output=True, text=True)
        if r.returncode: sys.exit('the assets page data failed (node engine/tools/site_assets_data.mjs):\n' + r.stderr[-2000:])
        d = json.loads(r.stdout)
        metas = json.load(open(os.path.join(SRC, 'assets-packs.json'), encoding='utf-8'))['packs']
        missing = [p['slug'] for p in d['packs'] if p['slug'] not in metas]
        if missing: sys.exit(f'docs/site/assets-packs.json has no entry for the pack(s) {", ".join(missing)} (a new Build-menu type with rooms: give it a sentence)')
        _ASSETS = (d, metas)
    return _ASSETS


def robots():
    agents = ''.join(f'User-agent: {a}\n' for a in ['*'] + CRAWLERS)
    return ('# turnipworks.net: crawl everything public, search engines and AI crawlers alike (written by engine/tools/build_site.py)\n'
            '# (dev.turnipworks.net answers Disallow: / from its nginx instead of this file)\n'
            f'{agents}Disallow: /api/\nDisallow: /s/\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')  # /s/: unlisted share links (2026-10-29, relay/shares.js)


def sitemap(metas):
    newest = max(metas[p]['updated'] for p in PAGES)
    urls = [(f'{SITE}/', newest)] + [(f'{SITE}/{p}', metas[p]['updated']) for p in NAV + HELP]
    body = ''.join(f'  <url><loc>{u}</loc><lastmod>{d}</lastmod></url>\n' for u, d in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}</urlset>\n'


def main():
    check = '--check' in sys.argv
    metas = {p: front(open(os.path.join(SRC, p + '.md'), encoding='utf-8').read())[0] for p in NAV + HELP}
    data = index_data()
    metas[INDEX]['updated'] = max(metas[INDEX]['updated'], data['updated'])  # the page is as new as its data
    bad = []
    os.makedirs(OUT, exist_ok=True)
    files = [(p + '.html', render(p, metas, data)) for p in NAV + HELP]
    files += [('robots.txt', robots()), ('sitemap.xml', sitemap(metas)), ('llms.txt', open(os.path.join(SRC, 'llms.txt'), encoding='utf-8').read()),
              (INDEX + '.json', open(os.path.join(SRC, INDEX + '.json'), encoding='utf-8').read()),
              (INDEX + '.schema.json', open(os.path.join(SRC, INDEX + '.schema.json'), encoding='utf-8').read()),
              (INDEX + '-md.txt', vtt.markdown(data)),  # (.txt: engine/deploy.sh leaves *.md files out of the client)
              (ASSETS + '.json', json.dumps(assets_data()[0], ensure_ascii=False, separators=(',', ':')))]
    for p, page in files:
        dst = os.path.join(OUT, p)
        old = open(dst, encoding='utf-8').read() if os.path.exists(dst) else None
        if check:
            if old != page and p not in GENERATED: bad.append(p)
        elif old != page:
            open(dst, 'w', encoding='utf-8').write(page)
    if bad: sys.exit(f'site pages out of date: {", ".join(bad)} (run python3 engine/tools/build_site.py)')
    print('site pages ' + ('match their sources' if check else 'built') + f': {", ".join(f for f, _ in files)}')


if __name__ == '__main__':
    main()
