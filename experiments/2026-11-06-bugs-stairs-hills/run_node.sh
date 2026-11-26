#!/bin/bash
# the node suites near stairs and hills, one line of tail each.  bash run_node.sh <label>
cd "$(dirname "$0")/../../engine" || exit 1
for t in stairnote stairs grandstair hillbuild caves terrain levels "$@"; do
  case "$t" in before|after|*-*) continue;; esac
  echo "== $t"; timeout 900 node "test/$t.test.mjs" 2>&1 | tail -4
done
