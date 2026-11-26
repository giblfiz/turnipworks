#!/usr/bin/env python3
"""After regen.sh: keep catalog/out to main + THIS lane (run from the repo root). src/catalog_tool.py rewrites every
by-setting file and the simple list from every catalog on disk, so another lane's uncommitted-to-main catalog drift
(roof ornaments, the ballcourt) shows up here; it is not ours. The by-setting files other than the Modern ones go back
to REF; the simple list keeps REF's lines plus this lane's (catalog/objects-modhalls.catalog.md roles and headings).
    python3 experiments/2026-11-07-modhalls/integration/keep_mine.py [REF=main]"""
import re, subprocess, sys
from pathlib import Path
REF = sys.argv[1] if len(sys.argv) > 1 else 'main'
show = lambda p: subprocess.run(['git', 'show', f'{REF}:{p}'], capture_output=True, text=True, check=True).stdout
mine_cat = Path('catalog/objects-modhalls.catalog.md').read_text()
ROLES = set(re.findall(r'^- \*\*([a-z0-9-]+)\*\*', mine_cat, re.M)); HEADS = set(re.findall(r'^## (.+)$', mine_cat, re.M))
for p in sorted(Path('catalog/out/by-setting').glob('*.txt')):
    if p.name in ('mod-modern-city.txt', 'cyb-cyberpunk.txt'): continue
    ref = show(str(p))
    if p.read_text() != ref: p.write_text(ref); print('restored', p)
sl = Path('catalog/out/simple-list.txt'); ref = show(str(sl)).split('\n'); refset = set(ref)
mine = lambda l: any(re.match(rf'^\s+P\d\s+{re.escape(r)}\s', l) for r in ROLES) or l.strip() in HEADS
out = [l for l in sl.read_text().split('\n') if l in refset or mine(l) or not l.strip()]
# (blank lines kept only where REF or our block has them: collapse runs)
res = []; [res.append(l) for l in out if not (not l.strip() and res and not res[-1].strip())]
sl.write_text('\n'.join(res)); print('simple-list:', sum(1 for l in res if mine(l)), 'lines of ours,', len(res) - len(ref), 'more than', REF)
