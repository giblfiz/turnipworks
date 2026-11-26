#!/usr/bin/env python3
"""Fresh-worktree setup: one symlink per git-ignored FILE the main checkout has and this worktree lacks (models, flats,
plates, tuner assets...), so build_data.py and the browser suites see the real library. Per file, never per folder, so a
build here that unlinks a name and writes a real file never writes into main (the openmesh rule). Read-only use of main.
Never linked: players' maps (engine/data), test output (engine/test/shots), caches, logs, node_modules, this batch.
The ignore test is `git check-ignore` run in THIS worktree.
    python3 experiments/2026-11-06-sprawl/integration/link_main_binaries.py [--dry]"""
import os, subprocess, sys
from pathlib import Path
M = Path('<repo>'); W = Path(__file__).resolve().parents[3]
assert W != M
dry = '--dry' in sys.argv
SKIP_ANY = {'.git', 'node_modules', '.claude', '__pycache__'}
SKIP_PREFIX = [('experiments', '2026-11-07-cyberpunk-rooms'), ('engine', 'data'), ('engine', 'test', 'shots'), ('docs', 'marketing')]
cand = []
for root, dirs, files in os.walk(M):
    rel = Path(root).relative_to(M)
    if any(p in SKIP_ANY for p in rel.parts) or any(rel.parts[:len(s)] == s for s in SKIP_PREFIX): dirs[:] = []; continue
    dirs[:] = [d for d in dirs if d not in SKIP_ANY]
    cand += [str(rel / f) for f in files if not f.endswith(('.log', '.pyc'))]
ign = []
for k in range(0, len(cand), 5000):
    r = subprocess.run(['git', '-C', str(W), 'check-ignore', '--stdin'], input='\n'.join(cand[k:k + 5000]), capture_output=True, text=True)
    if r.returncode not in (0, 1): sys.exit(r.stderr)
    ign += r.stdout.split('\n')
# binaries are linked; small text state (json, jsonl, txt: build lists, delivery tokens, results) is COPIED, because a
# build here that rewrites one in place (open(..., 'w')) would follow a link and write into main
BIN = ('.glb', '.png', '.jpg', '.jpeg', '.webp', '.ktx2', '.bin', '.mp3', '.ogg', '.wav', '.mp4', '.webm', '.stl', '.blend', '.npz', '.npy', '.exr', '.hdr', '.zip', '.gz')
import shutil
n = c = 0
for p in filter(None, ign):
    dst = W / p
    if dst.exists() or dst.is_symlink(): continue
    src = M / p; copy = not p.lower().endswith(BIN) and src.stat().st_size < 5_000_000
    if dry: print('copy' if copy else 'link', p); n += 1; continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    if copy: shutil.copy2(src, dst); c += 1
    else: dst.symlink_to(src); n += 1
print(n, 'file links,', c, 'copies', '(dry)' if dry else '', 'of', len(cand), 'files looked at')
