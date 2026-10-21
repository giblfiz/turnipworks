#!/usr/bin/env bash
# The old suites that load the game, one after another, with counts and wall time:  run_suites.sh <checkout> <tag>
REPO=$1; TAG=$2; OUT="$(cd "$(dirname "$0")" && pwd)/results/suites-$TAG"; mkdir -p "$OUT"; PY=python3
cd "$REPO"
for t in ui nits build figs pawnsmenu two_tab areas turns; do
  a=$(date +%s)
  TW_GPU=1 timeout 1500 $PY engine/test/browser_$t.py --local > "$OUT/$t.log" 2>&1
  b=$(date +%s)
  echo "$t: $(grep -c '^ *ok ' "$OUT/$t.log") ok, $(grep -c '^ *FAIL' "$OUT/$t.log") failed, $((b - a)) s" | tee -a "$OUT/summary.txt"
done
