#!/usr/bin/env python3
"""icons/*.png (tools/icons.py post) -> engine/client/data/icons/ (the Build tray's room-, type- and genre- icons) and
icons.json (per room key / code: the paths tools/land_binaries.py copies into main).   python3 tools/icons_install.py"""
import json, shutil
from pathlib import Path
E = Path(__file__).resolve().parent.parent; W = E.parents[1]; D = W / 'engine/client/data/icons'
CODE = {'NRS': 'nrs', 'MDE': 'mde', 'RUS': 'rus', 'MES': 'mes'}; out = {}
for p in sorted((E / 'icons').glob('*.png')):
    dst = D / p.name
    if dst.is_symlink(): dst.unlink()
    shutil.copy(p, dst)
    n = p.stem; key = n[5:] if n.startswith('room-') else (CODE[n[5:]] + '-type' if n.startswith('type-') else 'nrs-genre')  # (the genre icon lands with the first pack)
    out.setdefault(key, []).append(str(dst.relative_to(W)))
(E / 'icons.json').write_text(json.dumps(out, indent=1)); print(len(out), 'icons installed')
