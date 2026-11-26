#!/bin/bash
# the browser suites near stairs and hills, one after another on ports 23201..23214, a summary line each.
#   bash run_browser.sh <outdir> [suite ...]
cd "$(dirname "$0")/../.." || exit 1
OUT="$1"; shift; mkdir -p "$OUT"
SUITES=${*:-"stairnote hills hillbuild caves stairs grandstair placed_stairs"}
p=23201
for s in $SUITES; do
  TW_PORTS="$p,$((p + 1))" timeout 1500 python3 "engine/test/browser_$s.py" --local > "$OUT/$s.txt" 2>&1
  echo "== $s exit $? : $(grep -E 'passed|Error' "$OUT/$s.txt" | tail -1)"
  p=$((p + 2))
done
