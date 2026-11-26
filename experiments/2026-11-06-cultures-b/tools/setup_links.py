#!/usr/bin/env python3
"""A fresh worktree has none of main's git-ignored binaries (meshes, textures, plates, icons). Link each one that this
worktree lacks to main's file (read-only use), so build_data.py, the tuner and the game see the whole library. Files this
batch builds itself are written over the link by the build steps (they unlink first). engine/data (players' maps) is
never touched.   python3 experiments/2026-11-06-cultures-b/tools/setup_links.py"""
import os
from pathlib import Path
W = Path(__file__).resolve().parents[3]; M = Path('<repo>')
assert W != M
EXT = {'.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.ktx2', '.owner', '.hdr', '.exr', '.mp4', '.webm', '.zip'}
SKIP = {'.git', '.claude', 'node_modules', '__pycache__'}
n = made = 0
for root, dirs, files in os.walk(M):
    rel = Path(root).relative_to(M)
    dirs[:] = [d for d in dirs if d not in SKIP and not (str(rel) == 'engine' and d == 'data')]
    for f in files:
        if Path(f).suffix.lower() not in EXT: continue
        n += 1; dst = W / rel / f
        if dst.exists() or dst.is_symlink(): continue
        dst.parent.mkdir(parents=True, exist_ok=True); os.symlink(M / rel / f, dst); made += 1
nm = W / 'engine/node_modules'
if not nm.exists() and not nm.is_symlink(): os.symlink(M / 'engine/node_modules', nm); print('engine/node_modules linked')
print(f'{n} binaries in main, {made} links made')
