#!/usr/bin/env python3
"""For Fauna, under the lock, BEFORE the merge: copy one pack's git-ignored binaries from this worktree into main (new
names only; refuses to overwrite a different file). The source meshes (experiments/2026-11-06-cultures-b/models, which
build_data.py reads), their runtime tier, LOD ladder and texture ladder (tools/spawn-tuner/assets/{m,lod,tex}), the room
icons (engine/client/icons? see ICONS below) and the plates (kept for provenance).
    python3 experiments/2026-11-06-cultures-b/tools/land_binaries.py nrs [--dry-run]      (run the WORKTREE's copy)"""
import csv, hashlib, json, shutil, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent; W = E.parents[1]; M = Path('<repo>')
assert W != M, "run the worktree's copy"
code = sys.argv[1]; dry = '--dry-run' in sys.argv
rows = list(csv.DictReader(open(W / f'catalog/runs/cultb-{code}-01/manifest.tsv'), delimiter='\t'))
rel = []
for r in rows:
    s, src = r['sku'], r['source']
    rel += [f'experiments/2026-11-06-cultures-b/models/{src}.glb', f'experiments/2026-11-06-cultures-b/plates/{src}.png', f'tools/spawn-tuner/assets/m/{s}.glb']
    rel += [str(p.relative_to(W)) for p in sorted((W / 'tools/spawn-tuner/assets/lod').glob(f'*/{s}.glb'))]
    rel += [str(p.relative_to(W)) for p in sorted((W / 'tools/spawn-tuner/assets/tex').glob(f'*/{s}.webp'))]
    o = W / f'tools/spawn-tuner/assets/m/{s}.glb.owner'
    if o.exists() and not o.is_symlink(): rel.append(str(o.relative_to(W)))
icons = json.loads((E / 'icons.json').read_text()) if (E / 'icons.json').exists() else {}
rel += [p for k, ps in icons.items() if k.startswith(code + '-') for p in ps]
sha = lambda p: hashlib.sha1(p.read_bytes()).hexdigest()
n = {'new': 0, 'same': 0}
for r in rel:
    src, dst = W / r, M / r
    if src.is_symlink() or not src.exists(): sys.exit(f'REFUSING: {r} is not a file built here')
    if dst.exists():
        if sha(src) == sha(dst): n['same'] += 1; continue
        sys.exit(f'REFUSING: main has a different {r}')
    n['new'] += 1
    if not dry: dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst); dst.chmod(0o664)
print(f"{code}: {len(rel)} binaries, {n}{' (dry run)' if dry else ' copied into main'}")
