#!/usr/bin/env python3
"""Which types.json roles name each category no library shows (from audit-dev.json)"""
import json, os, collections
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
R = json.load(open(os.path.join(HERE, 'audit-dev.json'))); cats = R['universe']['cats']
types = json.load(open(os.path.join(REPO, 'engine/client/data/types.json')))['types']
shown = set(c for r in R['even'] for c in r['cats'])
miss = sorted(c for c in set(cats) - shown if not cats[c]['open'] and cats[c]['place'] != 'kit')
roleof = collections.defaultdict(list)
for t in types:
    for c in t['roles']:
        roleof[c].append(t['code'])
for c in miss: print(f"{c:32s} {cats[c]['place']:8s} {roleof.get(c)}")
print('no type:', [c for c in miss if c not in roleof])

# per type: its usable roles that none of its rooms' libraries show (shown elsewhere or nowhere)
byroom = {r['id']: set(r['cats']) for r in R['even']}
for t in types:
    rooms = [i for i in byroom if i.startswith(f"r:{t['code']}:")]
    have = set().union(*(byroom[i] for i in rooms)) if rooms else set()
    roles = [c for c in t['roles'] if c in cats and not cats[c]['open'] and cats[c]['place'] != 'kit' and not c.startswith('floor-')]
    gap = [c for c in roles if c not in have]
    print(f"{t['code']} rooms {len(rooms):2d} usable roles {len(roles):4d} not in its rooms {len(gap):4d} (of which shown nowhere {len([c for c in gap if c not in shown])})")
