#!/bin/bash
# suites.sh <checkout> <tag> [suite ...]   node gates, then browser suites; results in /var/tmp/tw-delivery/suites-<tag>/
REPO=$1; TAG=$2; shift 2; OUT=/var/tmp/tw-delivery/suites-$TAG; mkdir -p $OUT; PY=python3
cd "$REPO"
echo "== $TAG at $(git rev-parse --short HEAD) $(date) load $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a $OUT/summary.txt
node tools/spawn-tuner/test/golden.mjs /var/www/implausible-landing/projects/turnip-works/tuner tools/spawn-tuner > $OUT/golden.log 2>&1; echo "golden: exit $? $(tail -1 $OUT/golden.log | cut -c1-160)" | tee -a $OUT/summary.txt
python3 tools/spawn-tuner/test/assets_check.py --quiet > $OUT/assets_check.log 2>&1; echo "assets_check: exit $? $(tr '\n' ' ' < $OUT/assets_check.log | cut -c1-200)" | tee -a $OUT/summary.txt
(cd engine && node test/core.test.mjs > $OUT/core.log 2>&1; echo "core: exit $? $(tail -1 $OUT/core.log | cut -c1-120)"; node test/relay.test.mjs > $OUT/relay.log 2>&1; echo "relay: exit $? $(tail -1 $OUT/relay.log | cut -c1-120)") | tee -a $OUT/summary.txt
for t in "$@"; do
  a=$(date +%s)
  TW_GPU=1 timeout 2400 $PY engine/test/browser_$t.py --local > "$OUT/$t.log" 2>&1; rc=$?
  b=$(date +%s)
  echo "$t: exit $rc, $(grep -c '^ *ok ' "$OUT/$t.log") ok, $(grep -c '^ *FAIL' "$OUT/$t.log") failed, $((b - a)) s, load $(cut -d' ' -f1 /proc/loadavg)" | tee -a $OUT/summary.txt
done
echo "== done $(date)" | tee -a $OUT/summary.txt
