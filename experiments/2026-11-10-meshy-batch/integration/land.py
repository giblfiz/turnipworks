#!/usr/bin/env python3
"""Land the 2026-11-10 Meshy drop-in into main (run inside flock /tmp/tw-main.lock):
fast-forward main to branch meshyb, then copy each chosen sku's built binaries (runtime GLB + .owner, LOD ladder, colour-map
ladder, tex-src) from the worktree into main by name, after backing main's shipped files up to the USB.
  python3 land.py [--dry]"""
import json, shutil, subprocess, sys
from pathlib import Path
M = Path('<repo>'); WT = Path('<repo>'); LANE = 'experiments/2026-11-10-meshy-batch'
BK = Path('/mnt/usb/turnip-works/lanes-2026-11-10/meshy-batch/main-shipped-backup'); dry = '--dry' in sys.argv
D = json.loads((WT / LANE / 'integration/dropin.json').read_text())
run = lambda *a, **k: subprocess.run(a, check=True, **k)

# 1. main's untracked lane folder would block the merge: move it aside, merge, put back what git does not track
aside = Path('/mnt/usb/turnip-works/lanes-2026-11-10/meshy-batch/lane-untracked-aside')
if not dry:
    if (M / LANE).exists():
        if aside.exists(): shutil.rmtree(aside)
        shutil.move(str(M / LANE), str(aside))
    run('git', '-C', str(M), 'merge', '--ff-only', 'meshyb')
    for p in aside.rglob('*'):
        q = M / LANE / p.relative_to(aside)
        if p.is_file() and not q.exists(): q.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, q)

# 2. binaries by name
TU, MT = WT / 'tools/spawn-tuner', M / 'tools/spawn-tuner'; n = 0
for sku in D['choices']:
    rels = [Path(f'assets/m/{sku}.glb'), Path(f'assets/m/{sku}.glb.owner'), Path(f'prep/tex-src/{sku}.png')]
    rels += [p.relative_to(TU) for p in TU.glob(f'assets/lod/*/{sku}.glb')] + [p.relative_to(TU) for p in TU.glob(f'assets/tex/*/{sku}.webp')]
    for r in rels:
        src, dst = TU / r, MT / r
        assert src.exists() and not src.is_symlink(), f'{src}: not a built file'
        if dry: print('copy', r); n += 1; continue
        if dst.exists():
            b = BK / r
            if not b.exists(): b.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(dst, b)
            dst.unlink()   # a hard-linked delivered copy must not change under its old token: write a new inode
        dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst); n += 1
    m = WT / LANE / 'models' / f'{sku}.glb'
    if not dry: (M / LANE / 'models').mkdir(parents=True, exist_ok=True); shutil.copy2(m, M / LANE / 'models' / m.name)
print(n, 'files', '(dry)' if dry else 'copied; shipped originals in ' + str(BK))
