#!/usr/bin/env python3
"""Numbers for REPORT.md from an audit.py run:  python3 analyze.py [audit-dev.json]"""
import json, os, sys, collections, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else 'audit-dev.json')))
U = R['universe']; cats = U['cats']; rooms = {r['key']: r for r in U['rooms']}
print('page', R['page'], R['at'], '| libEven pref at load', R['pref0'])

# ---- 1. same size: the analytic drawn side of every thing in every library, on and off
def sides(mode): return [(r['roomKey'], it) for r in R[mode] for it in r['items']]
ev, tr = sides('even'), sides('true')
s = sorted(it['side'] for _, it in ev); t = sorted(it['side'] for _, it in tr)
print(f"\nSAME SIZE ON : {len(s)} things in {len(R['even'])} libraries, drawn longer side {s[0]}..{s[-1]} ft, median {st.median(s)}")
odd = [(k, it['cat'], it['place'], it['side']) for k, it in ev if abs(it['side'] - 3) > 0.05]
print(f"  not 3 ft: {len(odd)}", collections.Counter((p) for _, _, p, _ in odd), odd[:10])
print(f"SAME SIZE OFF: drawn longer side {t[0]}..{t[-1]} ft, all k == 1: {all(it['k'] == 1 for _, it in tr)}")
by = collections.defaultdict(list)
for _, it in ev: by[it['place']].append(it['side'])
print('  on, by place:', {p: (min(v), max(v), len(v)) for p, v in by.items()})

# ---- measured (meshes in): the drawn footprint from the meshes' own boxes
if R.get('shots'):
    print('\nMEASURED (mesh boxes, the stills):')
    for sh in R['shots']:
        m = [x for x in sh['measured'] if not x['placeholder']]; ph = len(sh['measured']) - len(m)
        v = sorted(x['side'] for x in m)
        if not v: continue
        k = max(1, len(v) // 50)
        line = f"  {sh['room']:14s} {'even' if sh['even'] else 'true'}: {len(m)} meshes (+{ph} boxes), side {v[0]}..{v[-1]} ft, median {st.median(v):.2f}, 2-98% {v[k]}..{v[-1-k]}"
        print(line)
        if sh['even']:
            far = sorted([x for x in m if abs(x['side'] - 3) > 0.6], key=lambda x: x['side'])
            if far: print('     off 3 ft by > 0.6:', [(x['cat'], x['side']) for x in far][:12])
    # pairs Harry named: a turnip-scale prop and a door
    for sh in R['shots']:
        if sh['room'] != 'common': continue
        m = {x['cat']: x for x in sh['measured']}
        small = min((x for x in sh['measured'] if x['k'] > 3), key=lambda x: -x['k'], default=None)
        door = m.get('door-plank')
        print(f"  common {'even' if sh['even'] else 'true'}: smallest-true thing {small and (small['cat'], small['side'], 'k', small['k'])}, door-plank {door and door['side']}")

# ---- 2. coverage
shown = set(c for r in R['even'] for c in r['cats'])
print(f"\nCOVERAGE: usable categories {len(cats)}; shown in some library {len(shown & set(cats))}; not shown {len(set(cats) - shown)}")
inslot = collections.defaultdict(set)
for r in U['rooms']:
    for sl, ids in (r['slots'] or {}).items():
        if sl != 'sets':
            for i in ids: inslot[i].add(r['key'])
miss = sorted(set(cats) - shown)
why = collections.defaultdict(list)
for c in miss:
    o = cats[c]
    if o['open']: why['open state (-open): placed by opening the closed one'].append(c)
    elif o['place'] == 'kit': why['kit piece the library does not list (KIT_PIECES is six pieces)'].append(c)
    elif c.startswith('floor-'): why['floor not listed'].append(c)
    elif o['faction']: why['faction slot no room recipe names'].append(c)
    elif c in inslot: why[f'in a slot, still not shown'].append((c, sorted(inslot[c])[:3]))
    else: why['in no room recipe (rooms.json)'].append(c)
for k, v in why.items(): print(f"  {k}: {len(v)}\n    {v}")
# rooms with nothing of their own
for r in R['even']:
    own = [it for it in r['items'] if it['place'] not in ('kit', 'tile')]
    if len(own) < 3: print('  room with almost nothing of its own:', r['roomKey'], len(own), 'of', r['n'])
print('\nmenu opens', sum(R['menu'].values()), '/', len(R['menu']), '| page errors', R['errors'][:3])
