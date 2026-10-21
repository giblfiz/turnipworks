#!/usr/bin/env bash
# Mesh QA for a type folder, all three steps: measurements + tiles (Blender), unpainted share (trimesh), verdicts (Gemini).
#   tools/qa.sh TYPE_DIR [sku ...]          -> TYPE_DIR/qa/<sku>.json, .A-D.png, .sheet.jpg, .verdict.json, summary.tsv
# Each step skips what it already did for the same GLB (sha1), so run it again after every harvest. NOVISION=1 = rules only.
set -euo pipefail
T=$(cd "$(dirname "$0")" && pwd); B=${TW_B:-$(dirname "$T")}
d=$1; shift; if [[ $d == "$(basename "$B")" ]]; then d=$B; elif [[ ! -d $d ]]; then d=$B/$d; fi
blender --background --python "$T/qa_mesh.py" -- "$d" "$@" 2>&1 | grep -E "^QA |^QAFAIL|^QASKIP|Traceback" | cut -c1-200 || true
$HOME/.local/share/tw-trimesh-venv/bin/python "$T/qa_unpainted.py" "$d" "$@" | cut -c1-200
python3 "$T/qa_gate.py" "$d" ${NOVISION:+--no-vision} "$@"
