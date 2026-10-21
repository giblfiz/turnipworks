#!/usr/bin/env python3
"""Thin-part check for barred / caged / ribbed meshes: is the piece see-through where it should be, or did the bars fuse
into a sheet (or drop)? Surface samples projected along a horizontal axis onto a grid on the face seen from that axis.
-> filled share of the bounding rectangle, and the number of separate solid runs ("bars") on three horizontal scan lines.
    ~/.local/share/tw-trimesh-venv/bin/python tools/qa_seethrough.py TYPE_DIR sku[:axis] ...   (axis thin|x|z, default thin)
Writes TYPE_DIR/qa-extra/seethrough.json and prints an ascii picture. GLB axes: y up."""
import json, sys
from pathlib import Path
import numpy as np, trimesh
T = Path(sys.argv[1]); out = {}
for arg in sys.argv[2:]:
    sku, _, ax = arg.partition(":")
    m = trimesh.load(T / "models" / f"{sku}.glb", force="mesh")
    lo, hi = m.bounds; ext = hi - lo
    a = {"x": 0, "z": 2}.get(ax) if ax in ("x", "z") else (0 if ext[0] < ext[2] else 2)
    b = 2 - a                                            # the other horizontal axis = across the face
    nx, ny = 96, int(96 * ext[1] / ext[b]) or 1
    pts = m.sample(600000)                               # surface samples binned on the face (no rtree in the venv): a cell is solid if any surface lies in it
    iu = np.clip(((pts[:, b] - lo[b]) / ext[b] * nx).astype(int), 0, nx - 1); iv = np.clip(((pts[:, 1] - lo[1]) / ext[1] * ny).astype(int), 0, ny - 1)
    hit = np.zeros((ny, nx), bool); hit[iv, iu] = True
    runs = lambda row: int(np.sum(np.diff(np.concatenate([[0], row.astype(int)])) == 1))
    lines = {f"{int(f*100)}%": runs(hit[int(ny * f)]) for f in (0.3, 0.5, 0.8)}
    rec = {"view_axis": "xz"[a // 2], "size": [round(float(x), 3) for x in ext], "filled_share": round(float(hit.mean()), 3), "solid_runs_at_height": lines}
    out[sku] = rec; print(sku, json.dumps(rec))
    step = max(1, ny // 30)
    for r in range(ny - 1, -1, -step): print("   " + "".join("#" if h else "." for h in hit[r][::2]))
(T / "qa-extra").mkdir(exist_ok=True); p = T / "qa-extra" / "seethrough.json"
old = json.loads(p.read_text()) if p.exists() else {}; old.update(out); p.write_text(json.dumps(old, indent=1) + "\n")
