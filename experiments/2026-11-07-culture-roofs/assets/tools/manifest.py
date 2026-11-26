#!/usr/bin/env python3
"""The accepted ornament meshes -> catalog/runs/croof-01/manifest.tsv (the cultures-b columns), which
tools/spawn-tuner/culture_roofs.py reads; and catalog/objects-culture-roofs.catalog.md (one line per NEW role).
Accepted = models/<id>.glb exists and the id is not in qa/rejects.json.   python3 tools/manifest.py [--dry-run]"""
import csv, json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent; ROOT = E.parents[2]
dry = '--dry-run' in sys.argv
T = json.loads((E / 'targets.json').read_text())
rej = json.loads((E / 'qa/rejects.json').read_text()) if (E / 'qa/rejects.json').exists() else {}
over = json.loads((E / 'qa/sizes.json').read_text()) if (E / 'qa/sizes.json').exists() else {}
TIER = {'mes-court-endwall': 'mes', 'mes-court-ball': 'mes', 'mes-court-hip-guard': 'mes', 'roof-onigawara': 'jpn', 'roof-chiwen': 'chn', 'roof-cupola-onion': 'rus', 'roof-dome': 'mde', 'roof-malqaf': 'mde', 'roof-shikhara': 'ind'}
COLS = 'sku object group lane gen family tier shape piece place fp mat pri desc hint open_of mount flags note size source'.split()
rows, left = [], []
for t in T:
    i = t['id']
    if not (E / 'models' / f'{i}.glb').exists(): left.append((i, 'no GLB')); continue
    if i in rej: left.append((i, 'rejected: ' + rej[i])); continue
    size = over.get(i) or t['size']
    rows.append({'sku': i, 'object': t['obj'], 'group': 'p1', 'lane': '3d', 'gen': 'mesh' if t['code'] == 'mes' else 'kit', 'family': '', 'tier': TIER.get(t['obj'], ''), 'shape': t.get('shape', ''),
                 'piece': '', 'place': t['place'], 'fp': t['fp'], 'mat': t['mat'], 'pri': t.get('pri', 'P2'), 'desc': t['desc'], 'hint': t['hint'], 'open_of': '', 'mount': '',
                 'flags': '', 'note': f"culture roofs ({t.get('culture', '')}): {t['see']}", 'size': 'x'.join(f'{v:g}' for v in size), 'source': i})
print(f'{len(rows)} rows; left out: {left}')
CAT = ['# Culture roofs — roof ornaments (2026-11-07)', '',
       'The roof ornaments of the culture packs, placed by the roof builder by rule (engine/client/roofs.js; experiments/2026-11-07-culture-roofs/PLAN.md),'
       ' not by room programs: each carries its culture\'s exclusive tier. Designs: experiments/2026-11-07-culture-roofs/assets/spec.py, after the sensitivity'
       ' read (assets/sensitivity-codex.md). The ridge skus --kawara / --tongwa / --glazed are skus of the existing kit role `roof-ridge`'
       ' (objects-vertical.catalog.md) and need no line here; ind-chhatri (objects-india.catalog.md) is reused.', '', '## CR1. Roof ornaments', '']
SETS = {'jpn': 'JPN!', 'chn': 'CHN!', 'rus': 'RUS!', 'mde': 'MDE!', 'ind': 'IND!'}
for t in T:
    if t['obj'] == 'roof-ridge' or t['code'] == 'mes': continue   # (ridge skus: an existing role; SUCH's pieces: its own catalog lines)
    w, d, h = over.get(t['id']) or t['size']   # the mesh's own proportions (qa/sizes.json)
    CAT.append(f"- **{t['obj']}** — {t['desc']} · kit · {t['fp']} · size:{w:g}x{d:g}x{h:g} · {t['mat']} · set:{SETS[TIER[t['obj']]]} · var:- · aff:- · kit · {t.get('pri', 'P2')} · {t['hint']}; {t['culture']}")
if not dry:
    out = ROOT / 'catalog/runs/croof-01/manifest.tsv'; out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', newline='') as fh:
        w = csv.DictWriter(fh, COLS, delimiter='\t'); w.writeheader(); w.writerows(rows)
    (ROOT / 'catalog/objects-culture-roofs.catalog.md').write_text('\n'.join(CAT) + '\n')
    print(out, ROOT / 'catalog/objects-culture-roofs.catalog.md')
