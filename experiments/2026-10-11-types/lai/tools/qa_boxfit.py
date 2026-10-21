#!/usr/bin/env python3
"""Kit pieces that are stretched per axis to their box (spec "fit": "box", or ids given): how unequal is the stretch?
For each: mesh extents (qa/<sku>.json size_ft_at_auto_scale: x, y floor axes, z up), the box (manifest_overrides.json size,
else the spec size), the per-axis factors with the floor axes matched the better way round, and anisotropy = largest factor /
smallest. Rule of the yard and the crypt: within about 1.5x. Prints one line each; -> TYPE/qa-extra/boxfit.json
    python3 tools/qa_boxfit.py TYPE_DIR [sku ...]"""
import json, sys
from pathlib import Path
T = Path(sys.argv[1])
if sys.argv[1] == Path(__file__).resolve().parent.parent.name: T = Path(__file__).resolve().parent.parent
elif not T.exists(): T = Path(__file__).resolve().parent.parent / sys.argv[1]
spec = {a["id"]: a for a in json.loads((T / "assets.json").read_text())["assets"]}
over = json.loads((T / "manifest_overrides.json").read_text()).get("size", {}) if (T / "manifest_overrides.json").exists() else {}
want = sys.argv[2:] or [k for k, v in spec.items() if v.get("fit") == "box" or v.get("kit") == "wall"]
out = {}
for s in want:
    q = T / "qa" / f"{s}.json"
    if not q.exists(): continue
    m = json.loads(q.read_text())["size_ft_at_auto_scale"]; box = over.get(s) or spec[s]["size"]
    best = None
    for a, b in ((0, 1), (1, 0)):
        f = [box[0] / (m[a] * 12), box[1] / (m[b] * 12), box[2] / (m[2] * 12)]; an = max(f) / min(f)
        if best is None or an < best[0]: best = (an, [round(v / max(f), 2) for v in f])
    out[s] = {"mesh_ft": m, "box_in": box, "relative_stretch_w_d_h": best[1], "anisotropy": round(best[0], 2)}
    print(f"{s:44} mesh {m} box {box} stretch {best[1]} anisotropy {best[0]:.2f}{'  OVER 1.5' if best[0] > 1.5 else ''}")
(T / "qa-extra").mkdir(exist_ok=True); f = T / "qa-extra" / "boxfit.json"
old = json.loads(f.read_text()) if f.exists() else {}; old.update(out); f.write_text(json.dumps(old, indent=1))
