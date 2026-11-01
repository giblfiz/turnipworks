#!/usr/bin/env python3
"""First look (2026-10-25): which usable library categories no room recipe slot names, grouped by catalog place."""
import json, collections, os
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = json.load(open(os.path.join(REPO, 'tools/spawn-tuner/data/library.json'))); O = d['objects']
r = json.load(open(os.path.join(REPO, 'tools/spawn-tuner/data/rooms.json')))
def usable(k):
    m = k.get('model')
    if not m: return True
    if m.get('masking'): return False
    return m.get('stars') is None or m['stars'] >= 3
inslot = set()
for x in r:
    for s, ids in (x.get('slots') or {}).items():
        if s != 'sets': inslot |= set(ids)
U = {i: o for i, o in O.items() if any((k.get('kind') == 'flat' or k.get('bounds')) and usable(k) for k in o['skus'])}
print('objects', len(O), 'usable cats', len(U), 'named in a slot', len(inslot & set(U)))
byplace = collections.defaultdict(list)
for i in U:
    if i not in inslot: byplace[O[i]['place']].append(i)
for p, l in byplace.items(): print(p, len(l), sorted(l))
nb = [i for i, o in O.items() if i not in U and any(k.get('url') and k.get('kind') != 'flat' and not k.get('bounds') and usable(k) for k in o['skus'])]
print('mesh with url but no bounds, nothing else usable:', len(nb), nb)
print('unusable cats', len([i for i in O if i not in U]))
