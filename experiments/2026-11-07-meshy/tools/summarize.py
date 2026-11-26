#!/usr/bin/env python3
"""work/judge.json + work/geom.json + work/meshy-tasks.json -> RESULTS.md (per-subject table and per-version means)."""
import json, statistics as st
from pathlib import Path

E = Path(__file__).resolve().parents[1]
J = json.loads((E / 'work/judge.json').read_text()); G = json.loads((E / 'work/geom.json').read_text()); T = json.loads((E / 'work/meshy-tasks.json').read_text())
SUBJ = ['store-shelving', 'server-rack', 'drinks-cooler', 'pallet-racking', 'fence-chain-link', 'antenna-mast']
VERS = ['cur', 'tr2', 'mx7', 'mxt']; LAB = {'cur': 'current', 'tr2': 'TRELLIS regen', 'mx7': 'Meshy 7.1', 'mxt': 'Meshy ST'}
cell = {}
A = J.get('A') or {}
for n, key in A.get('names', {}).items():
    a = (A.get('answer') or {}).get(n) or {}; cell.setdefault(key, {})['named'] = f"{a.get('object', '?')} ({a.get('confidence', '?')})"
for part in J.get('B', []):
    ans = part.get('answer') or {}; imgs = ans.get('images', {})
    for n, key in part['names'].items():
        s, v, view = key.split('|'); a = imgs.get(n) or {}
        c = cell.setdefault(f'{s}|{v}', {})
        for k in ('reads_as', 'geometry', 'texture'):
            if isinstance(a.get(k), (int, float)): c.setdefault(k, []).append(a[k])
        if a.get('defects'): c.setdefault('defects', []).append(f"{view}: {a['defects']}")
    for g, order in (ans.get('rank') or {}).items():
        keys = [part['names'].get(n) for n in order if n in part['names']]
        for i, key in enumerate(keys):
            s, v, view = key.split('|'); cell.setdefault(f'{s}|{v}', {}).setdefault('rank', []).append(i + 1)
C = J.get('C') or {}
for n, key in C.get('names', {}).items():
    a = (C.get('answer') or {}).get(n) or {}; c = cell.setdefault(key, {})
    c['table_reads'] = a.get('reads_as'); c['table_clean'] = a.get('clean'); c['table_defect'] = a.get('defect')
m = lambda xs: round(st.mean(xs), 1) if xs else None
rows = ['| subject | version | named blind (A) | reads | geom | tex | mean rank /8 | table reads/clean | axis share | in-game tris | runtime+lod10k+t256 KB | cost |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|']
agg = {v: {} for v in VERS}
for s in SUBJ:
    for v in VERS:
        c = cell.get(f'{s}|{v}', {}); g = G.get(f'{s}|{v}', {}); gg = g.get('game', {})
        kb = round(sum(g.get(k) or 0 for k in ('runtime_glb_bytes', 'lod10k_bytes', 'tex256_bytes')) / 1024)
        cost = {'cur': 'shipped', 'tr2': '~$0.01-0.05', 'mx7': '30 cr $0.60', 'mxt': '15 cr $0.30'}[v]
        rows.append(f"| {s} | {LAB[v]} | {c.get('named', '')} | {m(c.get('reads_as', []))} | {m(c.get('geometry', []))} | {m(c.get('texture', []))} | {m(c.get('rank', []))} | {c.get('table_reads')}/{c.get('table_clean')} | {gg.get('axis_share')} | {gg.get('tris')} | {kb} | {cost} |")
        for k in ('reads_as', 'geometry', 'texture', 'rank'): agg[v].setdefault(k, []).extend(c.get(k, []))
        for k in ('table_reads', 'table_clean'):
            if isinstance(c.get(k), (int, float)): agg[v].setdefault(k, []).append(c[k])
        agg[v].setdefault('axis', []).append(gg.get('axis_share') or 0)
summ = ['| version | reads | geometry | texture | mean rank /8 | table reads | table clean | axis share |', '|---|---|---|---|---|---|---|---|']
for v in VERS:
    a = agg[v]; summ.append(f"| {LAB[v]} | {m(a.get('reads_as', []))} | {m(a.get('geometry', []))} | {m(a.get('texture', []))} | {m(a.get('rank', []))} | {m(a.get('table_reads', []))} | {m(a.get('table_clean', []))} | {round(st.mean(a['axis']), 3)} |")
defects = []
for s in SUBJ:
    for v in VERS:
        c = cell.get(f'{s}|{v}', {}); defects.append(f"- {s} / {LAB[v]}: " + '; '.join(c.get('defects', [])) + (f"; table: {c.get('table_defect')}" if c.get('table_defect') else ''))
(E / 'RESULTS.md').write_text('# Results (blind Gemini reads + measured geometry)\n\n## Per version, all six subjects\n\n' + '\n'.join(summ)
                              + '\n\n## Per subject\n\n' + '\n'.join(rows) + '\n\n## Defects named\n\n' + '\n'.join(defects) + '\n')
print('\n'.join(summ)); print(); print('\n'.join(rows))
