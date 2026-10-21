#!/usr/bin/env python3
"""Suites: has a sibling's colour drifted from its parent's? Mean base-colour of each mesh (the texture sampled at the
vertices' UVs, in CIE Lab) for every asset with a "parent" in the same type whose GLB and parent GLB exist.
dE = Lab distance of the two means (under ~10: same family; over ~20: look at it). A NOTE, not a verdict: an open twin
shows its inside, a doorway shows less wall.   tw-trimesh-venv/bin/python tools/qa_suite.py TYPE_DIR  -> qa-extra/suite.json"""
import json, sys
from pathlib import Path
import numpy as np, trimesh
T = Path(sys.argv[1])
if sys.argv[1] == Path(__file__).resolve().parent.parent.name: T = Path(__file__).resolve().parent.parent
elif not T.exists(): T = Path(__file__).resolve().parent.parent / sys.argv[1]
spec = {a["id"]: a for a in json.loads((T / "assets.json").read_text())["assets"]}
def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); xyz = c @ M.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116); return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
cache = {}
def mean(s):
    if s in cache: return cache[s]
    p = T / "models" / f"{s}.glb"
    if not p.exists(): cache[s] = None; return None
    m = trimesh.load(p, force="mesh"); img = np.asarray(m.visual.material.baseColorTexture.convert("RGB")); uv = np.asarray(m.visual.uv)
    h, w = img.shape[:2]; x = np.clip((uv[:, 0] % 1.0 * w).astype(int), 0, w - 1); y = np.clip(((1 - uv[:, 1] % 1.0) * h).astype(int), 0, h - 1)
    c = img[y, x].astype(float); cache[s] = (c.mean(0), lab(c).mean(0)); return cache[s]
out = {}
for s, x in spec.items():
    par = x.get("parent") or x.get("twin_of") or next((Path(r).stem for r in x.get("refs", []) if Path(r).stem in spec and Path(r).stem != s), None)
    if not par or par not in spec: continue
    a, b = mean(par), mean(s)
    if a is None or b is None: continue
    dE = float(np.linalg.norm(a[1] - b[1])); out[s] = {"parent": par, "rgb": [int(v) for v in b[0]], "parent_rgb": [int(v) for v in a[0]], "dE": round(dE, 1)}
for s, r in sorted(out.items(), key=lambda kv: -kv[1]["dE"]): print(f"{r['dE']:5.1f}  {s:44} rgb {r['rgb']}  parent {r['parent']} {r['parent_rgb']}")
(T / "qa-extra").mkdir(exist_ok=True); (T / "qa-extra" / "suite.json").write_text(json.dumps(out, indent=1))
