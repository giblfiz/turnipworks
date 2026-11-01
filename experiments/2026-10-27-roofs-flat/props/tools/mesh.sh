#!/usr/bin/env bash
# One TRELLIS.2 mesh on fal (1024, $0.30) for one accepted plate: tools/mesh.sh SKU VERSION
#   masked/<sku>.png -> fal/<sku>-v<N>/inputs/<sku>.png -> fal/<sku>-v<N>/models/<sku>.glb; every charge in spend.log
set -euo pipefail
B=$(cd "$(dirname "$0")/.." && pwd); R=$(cd "$B/../../.." && pwd); s=$1; v=$2; F=$B/fal/$s-v$v
[[ -f $F/manifests/$s.json ]] && { echo "already meshed: $F"; exit 0; }
mkdir -p "$F/inputs"; cp "$B/masked/$s.png" "$F/inputs/$s.png"
echo "$(date -Iseconds) START fal TRELLIS.2 1024: $s plate v$v, \$0.30" >> "$B/spend.log"
python3 "$R/src/fal_trellis.py" "$F" > "$B/fal-$s-v$v.log" 2>&1 || true
if [[ -f $F/manifests/$s.json ]]; then
  t=$(python3 - "$B/spend.log" <<'PY'
import re,sys; print(f"{0.30*len(re.findall(r'DONE fal', open(sys.argv[1]).read()))+0.30:.2f}")
PY
); echo "$(date -Iseconds) DONE fal TRELLIS.2 $s v$v: \$0.30 (total \$$t)" >> "$B/spend.log"
  mkdir -p "$B/models/v$v"; cp "$F/models/$s.glb" "$B/models/v$v/$s.glb"; cp "$F/models/$s.glb" "$B/models/$s.glb"; echo "meshed $s v$v"
else echo "$(date -Iseconds) FAILED fal TRELLIS.2 $s v$v (see fal-$s-v$v.log)" >> "$B/spend.log"; tail -3 "$B/fal-$s-v$v.log"; exit 1; fi
