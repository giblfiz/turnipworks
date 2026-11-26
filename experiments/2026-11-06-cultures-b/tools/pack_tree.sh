#!/usr/bin/env bash
# Put the tree in the state "these packs have landed" (for a land-ready commit per pack): the packs' catalog object files
# in catalog/ (the others held in sandbox/held), the role catalog's by-setting lists and the Build menu's types.json
# regenerated (catalog_tool's drift on OTHER settings' lists reverted: those lists were stale before this lane), the
# integration applied, the manifests written, the library rebuilt.     tools/pack_tree.sh nrs [mde ...]
set -euo pipefail
E=$(cd "$(dirname "$0")/.." && pwd); W=$(cd "$E/../.." && pwd); cd "$W"
declare -A F=([nrs]=norse-steading [mde]=middle-east [rus]=rus-medieval [mes]=mesoamerica)
mkdir -p "$E/sandbox/held"
for c in nrs mde rus mes; do f=catalog/objects-culture-${F[$c]}.catalog.md
  if [[ " $* " == *" $c "* ]]; then [[ -f $f ]] || mv "$E/sandbox/held/$(basename $f)" "$f"; else [[ -f $f ]] && mv "$f" "$E/sandbox/held/"; rm -f catalog/out/by-setting/${c}-${F[$c]}.txt; fi; done
python3 src/catalog_tool.py > /dev/null 2>&1 || true
keep=$(for c in "$@"; do echo "catalog/out/by-setting/${c}-${F[$c]}.txt"; done)
for f in $(git diff --name-only -- catalog/out/by-setting); do grep -qx "$f" <<<"$keep" || git checkout -q -- "$f"; done
for c in nrs mde rus mes; do [[ " $* " == *" $c "* ]] || rm -f catalog/out/by-setting/${c}-${F[$c]}.txt; done  # (catalog_tool writes a list for every code it knows, landed or not)
python3 engine/tools/build_types.py
python3 "$E/integration/apply.py" "$@" | tail -1
for c in "$@"; do python3 "$E/tools/manifest.py" "$c" | tail -1; done
(cd tools/spawn-tuner && python3 build_data.py | tail -1)
