#!/usr/bin/env python3
"""Link main's git-ignored binaries into this worktree, file by file (a fresh worktree has none, and builds and tests
then fail falsely). Only files absent here are linked; nothing in main is touched. A few files a build REWRITES are
copied instead of linked, so a build here never writes through a link into main.

    python3 experiments/2026-11-06-cultures-a/tools/link_ignored.py [--dry-run]
"""
import os, sys, shutil
from pathlib import Path

MAIN = Path("<repo>")
W = Path(__file__).resolve().parents[3]
assert W != MAIN, "run in the worktree"
EXT = {".glb", ".gltf", ".bin", ".png", ".jpg", ".jpeg", ".webp", ".ktx2", ".hdr", ".exr", ".npz", ".npy", ".mp3", ".ogg", ".owner", ".m4a", ".opus"}
SKIP_DIRS = {".git", "node_modules", ".claude", "__pycache__", ".venv"}
COPY = {"tools/spawn-tuner/assets/delivery.json", "reviews/latest.json"}  # rewritten by builds: copy, never link
ROOTS = ["tools/spawn-tuner/assets", "experiments", "style-references", "engine/client", "catalog", "reviews", "style", "research", "web", "tools/spawn-tuner/prep", "tools/spawn-tuner/shots"]
dry = "--dry-run" in sys.argv
n = {"link": 0, "copy": 0, "have": 0}
for root in ROOTS:
    base = MAIN / root
    if not base.exists():
        continue
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            src = Path(dp) / fn
            rel = src.relative_to(MAIN)
            dst = W / rel
            ext = "".join(src.suffixes[-1:]).lower()
            want = ext in EXT or str(rel) in COPY or (root == "engine/client" and any(p in str(rel) for p in ("data/terrain", "data/caves", "data/music", "site/library")))
            if not want:
                continue
            if dst.exists() or dst.is_symlink():
                n["have"] += 1
                continue
            if dry:
                n["copy" if str(rel) in COPY else "link"] += 1
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            if str(rel) in COPY:
                shutil.copy2(src, dst); n["copy"] += 1
            else:
                os.symlink(src, dst); n["link"] += 1
for rel in COPY:
    if not (W / rel).exists() and (MAIN / rel).exists() and not dry:
        (W / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(MAIN / rel, W / rel); n["copy"] += 1
nm = W / "engine/node_modules"
if not nm.exists() and not dry:
    os.symlink(MAIN / "engine/node_modules", nm)
print(n)
