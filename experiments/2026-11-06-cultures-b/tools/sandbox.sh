#!/usr/bin/env bash
# A throwaway copy of the parts of the tree the room programs and their test need (tools/spawn-tuner js/data/test,
# build_data.py, engine/core/height.js, catalog/), so packs not yet landed on the branch can be applied and tested:
#   tools/sandbox.sh DIR && python3 integration/apply.py nrs mde --root DIR && node DIR/tools/spawn-tuner/test/cultures_b.test.mjs DIR/tools/spawn-tuner/ --fake
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); D=$1
rm -rf "$D"; mkdir -p "$D/tools/spawn-tuner" "$D/engine/core" "$D/experiments"
cp -r "$W/tools/spawn-tuner/js" "$W/tools/spawn-tuner/data" "$W/tools/spawn-tuner/test" "$W/tools/spawn-tuner/build_data.py" "$D/tools/spawn-tuner/"
cp "$W/engine/core/height.js" "$D/engine/core/"; cp -r "$W/catalog" "$D/catalog"; ln -s "$E" "$D/experiments/2026-11-06-cultures-b"
echo "sandbox $D"
