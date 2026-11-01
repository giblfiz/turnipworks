"""THE VTT COMPARISON INDEX PAGE (2026-10-29): docs/site/vtt-index.json + docs/site/vtt-index.md -> the page's body,
its Dataset metadata, and a plain markdown copy of the whole table. Used by engine/tools/build_site.py.

The table is written into the HTML (crawlers, readers without JavaScript and AI assistants see every row); the page's
script (engine/tools/site/vtt-index.js) only filters, sorts, opens a product's details (from the same JSON, fetched)
and sends corrections to the relay's ticket box (POST /api/tw-relay/tickets/site, engine/relay/tickets.js).
How to update the data: docs/VTT_INDEX.md.
"""
import html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
E = lambda s: html.escape(str(s), quote=True)
PLAT = {'browser': 'Browser', 'windows': 'Win', 'mac': 'Mac', 'linux': 'Linux', 'ios': 'iOS', 'android': 'Android', 'vr': 'VR', '?': '?'}
PLAT_LONG = {'browser': 'web browser', 'windows': 'Windows', 'mac': 'Mac', 'linux': 'Linux', 'ios': 'iOS', 'android': 'Android', 'vr': 'VR headset', '?': 'unknown'}
GROUP = {'ours': 'Ours', 'established': 'Established', 'indie': 'New & indie'}
ALIVE = {'alive': 'up', 'dead': 'gone', 'unknown': '?'}
# the table's columns, in order (community lives in the detail view: it is a sentence, not a value)
COLS = ['dims', 'platform', 'price', 'accounts', 'fog', 'lighting', 'mapbuild', 'levels', 'sheets', 'ddb', 'dice', 'phone',
        'offline', 'opensource', 'ai', 'modding', 'stage']
SHORT = {'dims': '2D / 3D', 'platform': 'Runs on', 'price': 'Price', 'accounts': 'Accounts', 'fog': 'Fog', 'lighting': 'Lighting',
         'mapbuild': 'Map building', 'levels': 'Levels', 'sheets': 'Sheets & rules', 'ddb': 'D&D Beyond', 'dice': 'Dice',
         'phone': 'Phones', 'offline': 'Offline / self-host', 'opensource': 'Open source', 'ai': 'AI', 'modding': 'Mods / API', 'stage': 'Stage'}


def asset(name):
    return open(os.path.join(HERE, 'site', name), encoding='utf-8').read()


def val_text(fid, v):
    if isinstance(v, list): return ' · '.join(PLAT.get(x, x) for x in v)
    return v


def tone(fid, v):
    """the cell's colour class: green for the thing people ask for, amber for part of it, grey for unknown"""
    if isinstance(v, list): return 'v-q' if v == ['?'] else 'v-n'
    if v == '?': return 'v-q'
    if fid in ('price', 'accounts', 'dims', 'stage'): return 'v-n'
    if fid == 'dice': return {'3D': 'v-yes', 'roller': 'v-part', 'no': 'v-no'}.get(v, 'v-n')
    return {'yes': 'v-yes', 'partial': 'v-part', 'no': 'v-no'}.get(v, 'v-n')


def flags(p):
    f = p['features']
    dims = f['dims']['v']; plat = f['platform']['v']
    return {
        'id': p['id'], 'group': p['group'], 'kind': p['kind'], 'alive': p['alive']['state'],
        'd3': '1' if dims in ('3D', '2D+3D') else '0',
        'free': '1' if f['price']['v'] in ('free', 'free tier') else '0',
        'browser': '1' if 'browser' in plat else '0',
        'os': '1' if f['opensource']['v'] in ('yes', 'partial') else '0',
    }


def cell(fid, c):
    v = c['v']; unv = c.get('verified') is False and v not in ('?', ['?'])
    t = val_text(fid, v)
    tip = c.get('note') or ''
    data = json.dumps(v) if isinstance(v, list) else v
    return (f'<td class="{tone(fid, v)}" data-c="{fid}" data-v="{E(data)}"' + (f' title="{E(tip)}"' if tip else '') + '>'
            + E(t) + ('<span class="unv" title="not confirmed from a source"> (?)</span>' if unv else '') + '</td>')


def table(d):
    P = sorted(d['products'], key=lambda p: p['name'].lower().lstrip('(').replace('unnamed) ', 'zzz'))
    head = ('<tr><th scope="col" class="nmh"><button type="button" data-sort="name">Product</button></th>'
            + ''.join(f'<th scope="col"><button type="button" data-sort="{c}">{E(SHORT[c])}</button></th>' for c in COLS)
            + '<th scope="col"><button type="button" data-sort="alive">Site</button></th></tr>')
    rows = []
    for p in P:
        fl = flags(p)
        attrs = ' '.join(f'data-{k}="{E(v)}"' for k, v in fl.items())
        sub = E(GROUP[p['group']]) + ('' if p['kind'] == 'vtt' else f' · <span class="nw">{E(p["kind"])}</span>')
        name = (f'<th scope="row" class="nm"><a href="#vtt={E(p["id"])}" data-open="{E(p["id"])}">{E(p["name"])}</a>'
                + (' <span class="ours">we make this</span>' if p['group'] == 'ours' else '') + f'<small>{sub}</small></th>')
        al = p['alive']
        alive = f'<td class="al-{al["state"]}" data-c="alive" data-v="{al["state"]}" title="{E((al.get("how") or "") + ", checked " + al["checked"])}">{ALIVE[al["state"]]}</td>'
        rows.append(f'<tr {attrs}>' + name + ''.join(cell(c, p['features'][c]) for c in COLS) + alive + '</tr>')
    return head, '\n'.join(rows), len(P)


def filters(d):
    n = len(d['products'])
    kinds = sorted({p['kind'] for p in d['products']}, key=lambda k: (k != 'vtt', k))
    return f'''<form class="filters" id="filters" role="search" aria-label="Filter the table" onsubmit="return false">
  <details class="ffold" id="ffold" open><summary>Filters</summary><div class="ffbody">
  <fieldset><legend>Show only</legend>
    <label><input type="checkbox" data-f="d3"> 3D</label>
    <label><input type="checkbox" data-f="free"> Free to start</label>
    <label><input type="checkbox" data-f="browser"> Runs in a browser</label>
    <label><input type="checkbox" data-f="os"> Open source</label>
    <label><input type="checkbox" data-f="alive"> Site is up</label>
  </fieldset>
  <label class="sel">Group <select data-f="group"><option value="">All</option><option value="established">Established</option><option value="indie">New &amp; indie</option><option value="ours">Ours</option></select></label>
  <label class="sel">Kind <select data-f="kind"><option value="">Every kind</option>{''.join(f'<option value="{E(k)}">{E(k)}</option>' for k in kinds)}</select></label>
  <label class="sel grow">Search <input type="search" data-f="q" placeholder="a name or a word" autocomplete="off"></label>
  </div></details>
  <p class="count" id="count" aria-live="polite">Showing {n} of {n}</p>
</form>
<p class="legend" aria-label="What the cell colours mean"><b>Key</b> <span class="v-yes">yes</span> <span class="v-part">partial</span> <span class="v-no">no</span> <span class="v-q">? unknown</span> <span class="v-n">n/a, or a plain value</span> <span class="unv">(?) not confirmed from a source</span> <span class="swipe">more columns to the right: scroll or swipe the table sideways \u2192</span><span class="hov">· hover a cell for its note</span></p>'''


def glossary(d):
    out = ['<dl class="gloss">']
    for c in d['criteria']:
        out.append(f'<dt>{E(c["label"])}</dt><dd>{E(c["gloss"])}</dd>')
    out.append('<dt>Site</dt><dd>Whether the product\'s own website answered when we last checked: up, gone (the page or the name has disappeared), or ? (it did not say, or there is no website). Hover or open the row for the date.</dd>')
    out.append('<dt>Group</dt><dd>How the row was made, not how good or how old a product is. Established: well-known products and close competitors, checked against their official sites and docs. New &amp; indie: found through their makers\' posts on r/VTT and described from those posts and their sites. Ours: Turnip Works, which we make.</dd>')
    out.append('<dt>n/a</dt><dd>Not applicable: the feature does not fit that kind of tool (a map maker has no dice).</dd>')
    out.append('<dt>(?)</dt><dd>A value we could not confirm from a source. Treat it as a lead, not a fact.</dd>')
    out.append('</dl>')
    return '\n'.join(out)


def correct(d):
    names = sorted(d['products'], key=lambda p: p['name'].lower())
    opts = ''.join(f'<option value="{E(p["id"])}">{E(p["name"])}</option>' for p in names)
    fields = ''.join(f'<option value="{E(c["id"])}">{E(c["label"])}</option>' for c in d['criteria'])
    return f'''<form class="fix" id="fix" novalidate>
  <label>Product <select name="product" required><option value="">Choose one</option><option value="new">Not listed yet: add mine</option>{opts}</select></label>
  <label>About <select name="field"><option value="">Anything</option>{fields}<option value="upsides">Upsides / downsides</option><option value="summary">The summary</option></select></label>
  <label class="tick"><input type="checkbox" name="maker"> I make this product</label>
  <label>Your correction <textarea name="text" required maxlength="4000" rows="5" placeholder="What is wrong or missing, and a link where a reader can see it"></textarea></label>
  <label>How to reach you, if you'd like an answer (optional) <input name="contact" maxlength="200" autocomplete="off" placeholder="a Reddit name, an email address, a Discord name"></label>
  <div class="send"><button type="submit">Send correction</button> <span class="msg" id="fixmsg" role="status"></span></div>
</form>
<p class="small">What you send comes privately to us (it is not posted anywhere) and is used to correct the table: the words, the product and anything you type in the last box. Details in the <a href="/privacy">Privacy Policy</a>. You can also email <span class="addr">hello@turnipworks.net</span>.</p>'''


def data_links(d):
    return f'''<p>The whole table is open data under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>: reuse it, credit "Turnip Works VTT comparison index". It is the same data at three stable addresses, for people, scripts and AI assistants:</p>
<ul>
<li><a href="/vtt-index.json">turnipworks.net/vtt-index.json</a>: every row, every cell, with its note, source and whether it was confirmed.</li>
<li><a href="/vtt-index.md">turnipworks.net/vtt-index.md</a>: the same as plain text (Markdown).</li>
<li><a href="/vtt-index.schema.json">turnipworks.net/vtt-index.schema.json</a>: the JSON Schema the data follows.</li>
</ul>
<p>Each row carries the date it was last checked. {sum(p["group"] == "indie" for p in d["products"])} new and indie rows, {sum(p["group"] == "established" for p in d["products"])} established ones, and ours.</p>'''


def body(md_html, d):
    head, rows, n = table(d)
    tbl = (filters(d) + f'\n<div class="tableframe" id="tableframe"><div class="tablewrap" tabindex="0" role="region" aria-label="The comparison table (scrolls sideways)"><table class="vtt" id="vtt">'
           f'<caption class="sr">{n} virtual tabletops and related tools, by name. Hover a cell for its note; open a name for the details and sources.</caption>'
           f'<thead>{head}</thead><tbody>\n{rows}\n</tbody></table></div></div>'
           '<noscript><p class="small">Filtering and the detail view need JavaScript; the same details are in <a href="/vtt-index.md">the plain-text version</a>.</p></noscript>')
    rep = {'TABLE': tbl, 'GLOSSARY': glossary(d), 'CORRECT': correct(d), 'DATA': data_links(d)}
    out = md_html.replace('[[COUNT]]', str(n))
    for k, v in rep.items(): out = out.replace(f'<p>[[{k}]]</p>', v)
    assert '[[' not in out, 'an unreplaced marker in docs/site/vtt-index.md'
    dialog = '<dialog id="detail" aria-labelledby="dt-name"><div class="dlg" id="dlg"></div></dialog>'
    return out + '\n' + dialog


def head_extra(d, desc):
    ld = {
        '@context': 'https://schema.org', '@type': 'Dataset', 'name': 'Turnip Works VTT comparison index',
        'description': desc + ' ' + d['disclosure'],
        'url': d['url'], 'sameAs': d['json_url'], 'license': 'https://creativecommons.org/licenses/by/4.0/',
        'isAccessibleForFree': True, 'dateModified': d['updated'], 'inLanguage': 'en',
        'creator': {'@type': 'Organization', 'name': 'Turnip Works', 'url': 'https://turnipworks.net/'},
        'keywords': ['virtual tabletop', 'VTT', 'tabletop RPG', 'comparison', 'Roll20', 'Foundry VTT', 'Owlbear Rodeo', 'TaleSpire', '3D VTT'],
        'variableMeasured': [c['label'] for c in d['criteria']],
        'distribution': [
            {'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': d['json_url']},
            {'@type': 'DataDownload', 'encodingFormat': 'text/markdown', 'contentUrl': d['markdown_url']}],
    }
    js = json.dumps(ld, ensure_ascii=False).replace('</', '<\\/')
    return (f'<link rel="alternate" type="application/json" href="/vtt-index.json" title="The data (JSON)">\n'
            f'<link rel="alternate" type="text/markdown" href="/vtt-index.md" title="The data (Markdown)">\n'
            f'<script type="application/ld+json">{js}</script>\n<style>{asset("vtt-index.css").strip()}</style>')


def script():
    return '<script>' + asset('vtt-index.js').strip() + '</script>'


# ---- the plain-text copy (/vtt-index.md) ----
def md_cell(fid, c):
    v = c['v']; t = ', '.join(PLAT_LONG.get(x, x) for x in v) if isinstance(v, list) else v
    if c.get('verified') is False and v not in ('?', ['?']): t += ' (?)'
    return t


def markdown(d):
    L = [f'# {d["name"]}', '', f'Last updated {d["updated"]}. Web page: {d["url"]} · JSON: {d["json_url"]} · Schema: {d["schema_url"]}', '',
         f'**Disclosure.** {d["disclosure"]}', '', f'**Corrections.** {d["corrections"]}', '', f'**Licence.** {d["license"]}', '',
         '**How to read it.** Values are yes / partial / no / n/a (not applicable) / ?. "?" means unknown (not found), not absent. Values describe the product as people can get it now (planned or unreleased work is in the note); an official first-party extension counts as built in, a third-party add-on as partial. "(?)" after a value means it could not be confirmed from a source. Established rows were checked against official sites and docs; new and indie rows come from their makers\' r/VTT posts and sites, as read on 2026-10-24, and only their sites\' liveness was re-checked since.', '',
         '## What the fields mean', '']
    for c in d['criteria']: L.append(f'- **{c["label"]}** (`{c["id"]}`): {c["gloss"]}')
    L += ['', '## Overview', '', '| Product | Group | Kind | 2D/3D | Runs on | Price | Fog | Lighting | Levels | Sheets & rules | Open source | Stage | Site |', '|' + '---|' * 13]
    P = sorted(d['products'], key=lambda p: p['name'].lower())
    esc = lambda s: str(s).replace('|', '\\|')
    for p in P:
        f = p['features']
        L.append('| ' + ' | '.join(esc(x) for x in [p['name'], GROUP[p['group']], p['kind'], md_cell('dims', f['dims']), md_cell('platform', f['platform']), md_cell('price', f['price']),
                                                    md_cell('fog', f['fog']), md_cell('lighting', f['lighting']), md_cell('levels', f['levels']), md_cell('sheets', f['sheets']),
                                                    md_cell('opensource', f['opensource']), md_cell('stage', f['stage']), ALIVE[p['alive']['state']]]) + ' |')
    L += ['', '## Every product', '']
    crit = {c['id']: c['label'] for c in d['criteria']}
    for p in P:
        L += [f'### {p["name"]}', '', p['summary'], '',
              f'- Group: {GROUP[p["group"]]}; kind: {p["kind"]}' + (f'; maker: {p["maker"]}' if p.get('maker') else ''),
              f'- Website: {p["url"] or "none found"}' + (f'; licence: {p["licence"]}' if p.get('licence') else ''),
              f'- Site check: {p["alive"]["state"]} ({p["alive"].get("how", "")}, {p["alive"]["checked"]}); features last checked {p["last_checked"]}']
        if p.get('reddit', {}).get('post'): L.append(f'- r/VTT post: {p["reddit"]["post"]}' + (f' by {p["reddit"]["maker"]}' if p['reddit'].get('maker') else '') + (f' ({p["reddit"]["date"]})' if p['reddit'].get('date') else ''))
        L.append('')
        for fid, c in p['features'].items():
            if fid == 'community':
                if c.get('note'): L.append(f'- {crit[fid]}: {c["note"]}' + (f' [source]({c["src"]})' if c.get('src') else ''))
                continue
            L.append(f'- {crit[fid]}: **{md_cell(fid, c)}**' + (f': {c["note"]}' if c.get('note') else '') + (f' [source]({c["src"]})' if c.get('src') else ''))
        if p['upsides']: L += ['', 'Upsides:'] + [f'- {u}' for u in p['upsides']]
        if p['downsides']: L += ['', 'Downsides:'] + [f'- {u}' for u in p['downsides']]
        if p['sources']: L += ['', 'Sources: ' + ' · '.join(f'[{s.get("label") or s["url"]}]({s["url"]})' for s in p['sources'])]
        L.append('')
    return '\n'.join(L).rstrip() + '\n'
