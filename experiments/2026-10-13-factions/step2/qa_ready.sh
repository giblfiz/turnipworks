#!/usr/bin/env bash
# Explicit Step2 spec/output paths keep concurrent Step1 QA evidence independent.
set -euo pipefail
B=$(cd "$(dirname "$0")/.." && pwd)
T="$B/tools"
Q="$B/step2/mesh-qa"
mkdir -p "$Q"
mapfile -t SKUS < <(python3 - "$B" <<'PY'
import sys,json,pathlib
b=pathlib.Path(sys.argv[1])
for a in json.loads((b/'step2-assets.json').read_text())['assets']:
 if a['lane']=='3d' and (b/'models'/f"{a['id']}.glb").exists():print(a['id'])
PY
)
if (( ${#SKUS[@]} == 0 )); then echo 'No Step2 meshes harvested yet'; exit 0; fi
"/tmp/scratch/tw-slot" blender --background --python "$T/qa_mesh.py" -- "$B" --assets "$B/step2-assets.json" --out "$Q" "${SKUS[@]}"
$HOME/.local/share/tw-trimesh-venv/bin/python "$T/qa_unpainted.py" "$B" --out "$Q" "${SKUS[@]}"
python3 "$T/qa_gate.py" "$B" --assets "$B/step2-assets.json" --out "$Q" "${SKUS[@]}"
