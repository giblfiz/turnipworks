#!/usr/bin/env python3
"""One pack's accepted meshes -> catalog/runs/cultb-<code>-01/manifest.tsv (the outdoors-02 columns + `piece`), which
tools/spawn-tuner/culture_packs_b.py reads. Accepted = models/<id>.glb exists and the id is not in qa/rejects.json.
sku: the target id; a piece under a shared role (the shop skeleton's five, a door leaf) is <role>--<code> / --leaf.
    python3 tools/manifest.py nrs [--dry-run]"""
import csv, json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent; ROOT = E.parents[1]
code = sys.argv[1]; dry = '--dry-run' in sys.argv
T = [t for t in json.loads((E / 'targets.json').read_text()) if t['code'] == code]
rej = json.loads((E / 'qa/rejects.json').read_text()) if (E / 'qa/rejects.json').exists() else {}
over = json.loads((E / 'qa/sizes.json').read_text()) if (E / 'qa/sizes.json').exists() else {}
COLS = 'sku object group lane gen family tier shape piece place fp mat pri desc hint open_of mount flags note size source'.split()
rows, left = [], []
for t in T:
    i = t['id']
    if not (E / 'models' / f'{i}.glb').exists(): left.append((i, 'no GLB')); continue
    if i in rej: left.append((i, 'rejected: ' + rej[i])); continue
    wall = t['kind'] == 'wall'; shared = not wall and t['obj'] != i
    leaf = i.endswith('--leaf')
    sku = i if (wall or leaf or not shared) else f"{t['obj']}--{code}"
    size = over.get(i) or (t['size'] if shared and not leaf else [])  # (a piece under a shared role ships at its own designed box)
    rows.append({'sku': sku, 'object': t['obj'], 'group': 'p1' if not t.get('parent') else 'sib1', 'lane': '3d', 'gen': 'kit' if (wall or t['place'] == 'kit') else 'mesh',
                 'family': t.get('family', '') if wall else '', 'tier': code, 'shape': t.get('shape', '') if wall else ('leaf' if leaf else (code if shared else '')),
                 'piece': 'leaf' if leaf else '', 'place': t['place'], 'fp': t['fp'], 'mat': t['mat'], 'pri': t.get('pri', 'P1'), 'desc': t.get('desc', t['see']), 'hint': t.get('hint', ''),
                 'open_of': '', 'mount': '', 'flags': ','.join(t.get('flags', [])), 'note': f"culture packs B ({code}): {t['see']}", 'size': 'x'.join(f'{v:g}' for v in size) if size else '', 'source': i})
print(f'{code}: {len(rows)} rows; left out: {left}')
if not dry:
    out = ROOT / f'catalog/runs/cultb-{code}-01/manifest.tsv'; out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', newline='') as fh:
        w = csv.DictWriter(fh, COLS, delimiter='\t'); w.writeheader(); w.writerows(rows)
    print(out)
