#!/usr/bin/env python3
"""Add MOD to the `set:` field of the fantasy roles the modern rooms re-skin (their modern sku is `<role>--mod`, tier mod).
Idempotent.   python3 experiments/2026-11-06-sprawl/integration/tag_shared.py   (from the repo root)"""
import re
from pathlib import Path
WANT = {'sofa': 'catalog/objects-mansion.catalog.md', 'table-billiards': 'catalog/objects-mansion.catalog.md',
        'bench-street': 'catalog/expansion-environment.catalog.md', 'bar-counter': 'catalog/fantasy-core.catalog.md',
        'back-bar-shelves': 'catalog/fantasy-core.catalog.md', 'stool-bar': 'catalog/fantasy-core.catalog.md',
        'bed-double': 'catalog/fantasy-core.catalog.md', 'chair-plain': 'catalog/fantasy-core.catalog.md'}
for rid, f in WANT.items():
    p = Path(f); lines = p.read_text().split('\n'); n = 0
    for i, l in enumerate(lines):
        if l.startswith(f'- **{rid}** — '):
            n += 1
            m = re.search(r' · set:([A-Z!,]+) · ', l)
            codes = m.group(1).split(',')
            if 'ANY' in codes or any(c.rstrip('!') == 'MOD' for c in codes): continue
            lines[i] = l[:m.start(1)] + m.group(1) + ',MOD' + l[m.end(1):]
    assert n == 1, (rid, n)
    p.write_text('\n'.join(lines))
print('ok')
