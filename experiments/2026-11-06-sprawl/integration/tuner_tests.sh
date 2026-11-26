#!/usr/bin/env bash
# Every node suite of the tuner (tools/spawn-tuner/test/*.test.mjs), one line each: its last line of output.
#   experiments/2026-11-06-sprawl/integration/tuner_tests.sh [TUNER_DIR]       (run from the repo root)
set -uo pipefail
T=${1:-tools/spawn-tuner}
for t in "$T"/test/*.test.mjs; do
  r=$(timeout 900 node -- "$t" "$T" 2>&1 | tail -1 | cut -c1-140)
  echo "$(basename "$t"): $r"
done
