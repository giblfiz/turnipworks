#!/usr/bin/env python3
"""One-off (2026-10-29): merge the row files of this experiment into docs/site/vtt-index.json.
  python3 experiments/2026-10-29-vttindex/assemble.py [--alive alive-indie.json]
Keeps alive {} from --alive (a copy the alive checker wrote) by id. Later edits go through tools/vtt-index/vtt_index.py."""
import json, os, sys
H = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(H))
crit = json.load(open(os.path.join(H, 'criteria.json')))
rows = []
for f in ['ours.json', 'established-A.json', 'established-B.json', 'indie-1.json', 'indie-2.json', 'indie-3.json']:
    p = os.path.join(H, f)
    if os.path.exists(p): rows += json.load(open(p)); print(f, 'ok', file=sys.stderr)
    else: print(f, 'MISSING', file=sys.stderr)
alive = {}
if '--alive' in sys.argv:
    for p in json.load(open(sys.argv[sys.argv.index('--alive') + 1]))['products']: alive[p['id']] = p['alive']
for r in rows:
    if r['id'] in alive and alive[r['id']].get('how') != 'not yet checked': r['alive'] = alive[r['id']]
    r.setdefault('maker', None); r.setdefault('licence', None)
    for c in r['features'].values():
        if c.get('note') is None: c.pop('note', None)
        if 'src' in c and not c['src']: c['src'] = None
    r['upsides'] = [u for u in r.get('upsides', []) if u][:4]; r['downsides'] = [u for u in r.get('downsides', []) if u][:4]
    if r.get('reddit'): r['reddit'] = {k: v for k, v in r['reddit'].items() if k in ('maker', 'post', 'date', 'more')}
d = {
  'name': 'Turnip Works VTT comparison index', 'version': 1, 'updated': '2026-10-29',
  'url': 'https://turnipworks.net/vtt-index', 'json_url': 'https://turnipworks.net/vtt-index.json',
  'markdown_url': 'https://turnipworks.net/vtt-index.md', 'schema_url': 'https://turnipworks.net/vtt-index.schema.json',
  'license': 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/): reuse it, credit "Turnip Works VTT comparison index"',
  'maintainer': 'Turnip Works (https://turnipworks.net/), which makes one of the VTTs listed',
  'disclosure': 'We make Turnip Works, one of the products in this table. The table is our own development checklist, so expect our row to fill up over time. Our row is scored by the same rules as every other row; a feature of ours that is built but only on our development server counts as partial, the way anyone else\'s beta does.',
  'corrections': 'Makers and users can send a correction from the form on https://turnipworks.net/vtt-index ("Claim yours / correct me"), or write to hello@turnipworks.net.',
  'criteria': crit, 'products': rows}
out = os.environ.get('VTT_INDEX_JSON') or os.path.join(REPO, 'docs', 'site', 'vtt-index.json')
json.dump(d, open(out, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); open(out, 'a').write('\n')
print(f'{len(rows)} rows -> {out}', file=sys.stderr)
