#!/bin/bash
# the roof browser suites, one after another, on this lane's ports (culture-roofs, 2026-11-07)
cd $TW_REPO
for t in browser_gables browser_roofs browser_roofflat browser_roofturn browser_cultureroofs; do
  echo "== $t"; TW_GPU=1 TW_PORTS=18473,18974 timeout 1500 python3 engine/test/$t.py --local 2>&1 | grep -E "FAIL|passed|Traceback" | tail -12
done
