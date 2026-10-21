#!/usr/bin/env bash
# Pull a type's finished GLBs and its worker logs / manifests from the pod. Safe at any time, also during a wave
# (a GLB still being written is detected by its length field, removed here and fetched again next time).
#   tools/harvest.sh TYPE_DIR HOST PORT            -> TYPE_DIR/models/*.glb, TYPE_DIR/worker-logs/, TYPE_DIR/models-missing.txt
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
[[ $# -ge 3 ]] || { sed -n 2,5p "$0"; exit 64; }
resolve_type "$1"; resolve_host_port "$2" "$3"
mkdir -p "$TYPE_DIR/models" "$TYPE_DIR/worker-logs"
rsync_ -az --partial --include='*.glb' --exclude='*' "$(remote_path "$R/models/")" "$TYPE_DIR/models/"
rsync_ -az --include='worker-*-manifest.json' --exclude='*' "$(remote_path "$R/models/")" "$TYPE_DIR/worker-logs/"
rsync_ -az --include='worker-*.log' --include='todo.txt' --exclude='*' "$(remote_path "$R/")" "$TYPE_DIR/worker-logs/"
python3 - "$TYPE_DIR" <<'PY'
import json, struct, sys, statistics
from pathlib import Path
t = Path(sys.argv[1]); bad = []
for g in sorted((t / "models").glob("*.glb")):
    b = g.open("rb").read(12)
    if len(b) < 12 or b[:4] != b"glTF" or struct.unpack("<I", b[8:12])[0] != g.stat().st_size: bad.append(g.name); g.unlink()
spec = {a["id"]: a for a in json.loads((t / "assets.json").read_text())["assets"]} if (t / "assets.json").exists() else {}
want = [p.stem for p in sorted((t / "masked").glob("*.png")) if spec.get(p.stem, {}).get("route", "trellis") == "trellis"]
have = {g.stem for g in (t / "models").glob("*.glb")}
missing = [s for s in want if s not in have]
(t / "models-missing.txt").write_text("".join(s + "\n" for s in missing))
secs, failed, load = [], [], []
for m in sorted((t / "worker-logs").glob("worker-*-manifest.json")):
    for a in json.loads(m.read_text()).get("assets", []):
        if a["status"] == "complete": secs.append(a["seconds"])
        if a["status"] == "failed": failed.append((Path(a["input"]).stem, a.get("error", "")[:120]))
for l in (t / "worker-logs").glob("worker-*.log"):
    for line in l.read_text(errors="replace").splitlines():
        if '"event": "model_loaded"' in line:
            try: load.append(json.loads(line)["seconds"])
            except Exception: pass
print(f"{t.name}: {len(have)} GLBs here, {len(want)} plates for TRELLIS, {len(missing)} missing" + (f", {len(bad)} partial removed: {bad}" if bad else ""))
if secs: print(f"  mesh seconds: median {statistics.median(secs):.0f}, mean {statistics.mean(secs):.0f}, n {len(secs)}; model load seconds: {[round(x) for x in load]}")
still = [f for f in failed if f[0] in missing]
for s, e in still: print(f"  FAILED on the pod: {s}: {e}")
PY
