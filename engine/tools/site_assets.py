"""THE ASSETS PAGE (2026-11-04, Harry: "an assets page that demos all of the assets and asset packs and deep links to them"):
docs/site/assets.md (the words) + engine/client/site/assets.json (the data: engine/tools/site_assets_data.mjs, the game's own
Build tree) + docs/site/assets-packs.json (each pack's sentence and hero picture) -> the page at /assets. Used by
engine/tools/build_site.py.

The pack overview is written into the HTML (crawlers and readers without JavaScript see every pack, its rooms and its
counts); the page's script (engine/tools/site/assets.js) fetches /assets.json once and draws a pack, a room, a search or
one asset from it. Every view has its own address on the page (the fragment):
  /assets#pack/<pack>             a pack: all its things (a Build-menu type: tavern-inn, crypt-tomb ...; or building-kit,
                                  faction-pieces, figures)
  /assets#pack/<pack>/<room>      one room's library, shelf by shelf, as the game's Build menu lists it
  /assets#thing/<id>              one prop: its looks, size, the file, "Use it in Turnip Works" (/?place=<id>)
  /assets#figure/<id>             one figure (/?pawn=<id>)
  /assets#find/<words>            a search
The pictures (engine/client/site/library/, git-ignored) are made by tools/site-assets/media.py.
"""
import html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
E = lambda s: html.escape(str(s), quote=True)


def asset(name):
    return open(os.path.join(HERE, 'site', name), encoding='utf-8').read()


def thumb(d, cat, look=0):
    t = d['things'][cat]; sku, h = t['l'][look][:2]
    return f"{d['media']}t/{sku}.{h}.webp"


def fig_thumb(d, fid):
    return f"{d['media']}f/{fid}-{d['figures'][fid]['x'].split('-')[-1]}.webp"


def pack_pic(d, p, meta):
    """the card's picture: the pack's hero still, else four of its own things' pictures"""
    hero = meta.get('hero')
    if hero:
        src = f"{d['media']}h/{hero}"
        return (f'<img class="hero" src="{src}-600.webp" srcset="{src}-600.webp 600w, {src}-1200.webp 1200w" '
                f'sizes="(max-width: 640px) 92vw, 380px" width="600" height="338" loading="lazy" decoding="async" alt="">')
    ids = p['things'][:4]
    pic = (lambda i: fig_thumb(d, i)) if p.get('kind') == 'figures' else (lambda i: thumb(d, i))
    return '<span class="mosaic">' + ''.join(f'<img src="{pic(i)}" width="128" height="128" loading="lazy" decoding="async" alt="">' for i in ids) + '</span>'


def counts(p):
    n = len(p['things'])
    if p.get('kind') == 'figures': return f'{n} figures'
    rooms = len(p['rooms']); word = {'kit': 'kinds', 'factions': 'factions'}.get(p.get('kind'), 'rooms')
    return f'{rooms} {word} · {n} things'


def overview(d, metas):
    cards = []
    for p in d['packs']:
        m = metas.get(p['slug'], {})
        rooms = ', '.join(r['label'] for r in p['rooms'])
        cards.append(f'<li><a class="pk" id="pack/{E(p["slug"])}" href="#pack/{E(p["slug"])}">{pack_pic(d, p, m)}'
                     f'<span class="pkt"><strong>{E(p["label"])}</strong><small>{E(counts(p))}</small></span>'
                     f'<span class="pkb">{E(m.get("blurb", ""))}</span><span class="sr"> Rooms: {E(rooms)}.</span></a></li>')
    return '<ul class="packs" id="packs" aria-label="The packs">' + ''.join(cards) + '</ul>'


def browser(d, metas):
    c = d['counts']
    tools = ('<div class="libtools" role="search"><label class="sr" for="q">Search the assets</label>'
             f'<input id="q" type="search" placeholder="Search {c["things"] + c["figures"]:,} assets" title="A name: barrel, owlbear, throne, candle…" autocomplete="off" enterkeyhint="search">'
             '<span class="count" id="count" aria-live="polite"></span></div>')
    return ('<div class="lib" id="lib">' + tools + overview(d, metas) +
            '<section class="view" id="view" aria-live="polite" hidden></section>'
            '<noscript><p class="small">Browsing inside a pack, search and the asset pages need JavaScript; every asset is also listed in '
            '<a href="/assets.json">the catalogue (JSON)</a>.</p></noscript></div>'
            '<dialog id="asset" aria-labelledby="as-name"><div class="dlg" id="dlg"></div></dialog>')


def credit(d):
    return (f'<div class="note credit"><p><strong>Free to use under CC BY 4.0.</strong> Credit line: '
            f'<code id="creditline">{E(d["credit"])}</code> <button type="button" class="copy" data-copy="#creditline">Copy</button></p></div>')


def body(md_html, d, metas):
    c = d['counts']
    out = md_html
    for k, v in {'THINGS': f'{c["things"]:,}', 'LOOKS': f'{c["looks"]:,}', 'ROOMS': c['rooms'], 'FIGURES': c['figures']}.items():
        out = out.replace(f'[[{k}]]', str(v))
    out = out.replace('<p>[[CREDIT]]</p>', credit(d)).replace('<p>[[BROWSER]]</p>', browser(d, metas))
    out = out.replace('<p>[[CREDITLINE]]</p>', f'<pre><code>{E(d["credit"])}</code></pre>')
    assert '[[' not in out, 'an unreplaced marker in docs/site/assets.md'
    return out


def head_extra(d, desc):
    c = d['counts']
    ld = {
        '@context': 'https://schema.org', '@type': 'Dataset', 'name': 'Turnip Works assets',
        'description': desc, 'url': 'https://turnipworks.net/assets', 'license': d['license'],
        'isAccessibleForFree': True, 'inLanguage': 'en', **({'dateModified': d['updated'][:10]} if d.get('updated') else {}),
        'creator': {'@type': 'Organization', 'name': 'Turnip Works', 'url': 'https://turnipworks.net/'},
        'keywords': ['3D models', 'GLB', 'tabletop RPG', 'virtual tabletop', 'fantasy props', 'miniatures', 'CC BY 4.0', 'D&D'],
        'variableMeasured': [f'{c["things"]} props', f'{c["figures"]} figures'],
        'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': 'https://turnipworks.net/assets.json'}],
    }
    js = json.dumps(ld, ensure_ascii=False).replace('</', '<\\/')
    return (f'<link rel="alternate" type="application/json" href="/assets.json" title="The catalogue (JSON)">\n'
            f'<script type="application/ld+json">{js}</script>\n<style>{asset("assets.css").strip()}</style>')


# landing.js: this is a page an ad can land on, like /features (build_site.py LANDING)
def script(metas):
    heroes = {k: v['hero'] for k, v in metas.items() if v.get('hero')}
    blurbs = {k: v.get('blurb', '') for k, v in metas.items()}
    cfg = json.dumps({'heroes': heroes, 'blurbs': blurbs}, ensure_ascii=False).replace('</', '<\\/')
    return (f'<script>window.TW_ASSETS = {cfg};</script>\n<script>' + asset('assets.js').strip() + '</script>\n'
            '<script type="module" src="/engine/client/landing.js"></script>')
