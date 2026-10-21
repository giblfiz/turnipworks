#!/usr/bin/env bash
# Everything between "meshes accepted" and "the programs can be tested on real meshes", in the worktree, as ONE job for
# the shared limiter:  tw-slot tools/prep_chain.sh        (log: smi/prep-chain.log)
#   manifest -> sandbox/real (library without bounds, jobs) -> runtime GLBs (2 Blender workers) -> the faces x skins
#   ladder -> sandbox/real again (bounds) -> the front sweep's views and sheets (the Gemini read is tools/orient_smi.sh)
# Runtime files are written through tools/spawn-tuner/assets, which in this worktree is a link to the MAIN tree's
# assets (new sku names only: nothing existing is touched). results / lod / jobs lists land in this worktree's prep/.
set -euo pipefail
SMI=$(cd "$(dirname "$0")/.." && pwd); ROOT=$(cd "$SMI/../../.." && pwd); T=$ROOT/tools/spawn-tuner; CCM=$ROOT/experiments/2026-10-05-castle-crypt-mansion/tools
exec >> "$SMI/prep-chain.log" 2>&1; echo "=== $(date -Is) start"
python3 $CCM/make_manifest.py "$SMI" smi-01
python3 $SMI/integration/make_sandbox_smi.py real --real | tail -14
S=$SMI/integration/sandbox/real
python3 - "$S" "$T" <<'PY'
import json, sys, pathlib
S, T = map(pathlib.Path, sys.argv[1:]); lib = json.loads((S / "data/library.json").read_text())["objects"]
mine = {s["sku"] for o in lib.values() for s in o["skus"] if s["src"] == "smi-01" and s["kind"] == "mesh"}
jobs = [{**j, "out": str(T / "assets/m" / (j["sku"] + ".glb")), "force": True} for j in json.loads((S / "prep/jobs.json").read_text()) if j["sku"] in mine]
(T / "prep/jobs-smi01.json").write_text(json.dumps(jobs, indent=1)); print(len(jobs), "jobs -> prep/jobs-smi01.json")
PY
cd "$T"; rm -f prep/results-smi01.jsonl prep/lod-smi01.jsonl
for w in 0 1; do blender --background --python prep/blender_runtime.py -- prep/jobs-smi01.json $w 2 prep/results-smi01.jsonl > prep/runtime-smi01-$w.log 2>&1 & done; wait
echo "runtime: $(wc -l < prep/results-smi01.jsonl) results"
for w in 0 1; do blender --background --python prep/blender_lod.py -- prep/jobs-smi01.json $w 2 prep/lod-smi01.jsonl > prep/lod-smi01-$w.log 2>&1 & done; wait
echo "ladder: $(wc -l < prep/lod-smi01.jsonl) results"; python3 prep/lod_tex.py | tail -2
python3 $SMI/integration/make_sandbox_smi.py real --real | tail -14
W=$T/prep/orient-sweep-smi-01; mkdir -p "$W"
python3 - "$S" "$T" "$W" <<'PY'
import json, sys, pathlib
S, T, W = map(pathlib.Path, sys.argv[1:]); lib = json.loads((S / "data/library.json").read_text())["objects"]
skus = sorted(s["sku"] for o in lib.values() for s in o["skus"] if s["src"] == "smi-01" and s["kind"] == "mesh")
(W / "list.txt").write_text("".join(f"{T / 'assets/m' / (s + '.glb')}\n" for s in skus)); (W / "skus.txt").write_text(" ".join(skus))
base = (T / "prep/orient-sweep-outdoors02/prompt_blind.txt").read_text()
(W / "prompt_blind.txt").write_text(base.replace("the yard or garden of a fantasy inn", "a smithy and its workshops: a forge, a carpenter, a potter, their yard").replace("Do not guess from what a yard usually contains", "Do not guess from what such a place usually contains"))
print(len(skus), "meshes in the sweep")
PY
blender --background --python prep/orient_views.py -- "$W/list.txt" "$W/views" > "$W/views.log" 2>&1
python3 prep/orient_sheets.py "$W/views" "$W/sheets" 4 $(cat "$W/skus.txt") | tail -1
echo "=== $(date -Is) done"
