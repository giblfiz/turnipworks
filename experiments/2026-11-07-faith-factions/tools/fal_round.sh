#!/usr/bin/env bash
# One fal TRELLIS.2 round for the given plate ids (fth/masked/<id>.png): stage -> /mnt/usb/.../<name>/inputs -> src/fal_trellis.py
# -> fth/models. Logs the dollars to spend.log.   tools/fal_round.sh NAME ID [ID ...]
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); N=$1; shift
F=/mnt/usb/turnip-works/lanes-2026-11-07/faith-factions/$N; mkdir -p "$F/inputs"
for i in "$@"; do cp "$E/fth/masked/$i.png" "$F/inputs/"; cp "$E/fth/plates/$i.png" /mnt/usb/turnip-works/lanes-2026-11-07/faith-factions/plates/; done
(cd "$W" && python3 src/fal_trellis.py "$F" > "$F/run.log" 2>&1)
n=$(ls "$F"/models/*.glb 2>/dev/null | wc -l); cost=$(python3 -c "import json;print(json.load(open('$F/manifest.json'))['estimated_total_cost_usd'])")
cp "$F"/models/*.glb "$E/fth/models/"
echo "$(date -Is) SPENT \$$cost fal TRELLIS.2 ($N): $n meshes [$*] (fal-ai/trellis-2, 1024, 50k faces, 2048 tex); $F/manifest.json" >> "$E/spend.log"
echo "$N: $n meshes, \$$cost"
