#!/usr/bin/env bash
# The suites this lane touches, on the branch tip (and solver2 / yard on main's tuner as the baseline), one line each
#   -> experiments/2026-11-06-cultures-b/worker-logs/final-suites.log
W=$(cd "$(dirname "$0")/../../.." && pwd); cd "$W"; L=$W/experiments/2026-11-06-cultures-b/worker-logs/final-suites.log; : > $L
P=experiments/2026-11-06-cultures-b/sandbox/pristine/tools/spawn-tuner
r() { echo "== $1: $(timeout 1500 "${@:2}" 2>&1 | tail -${N:-1} | tr '\n' ' ')" >> $L; }
r cultures_b node tools/spawn-tuner/test/cultures_b.test.mjs tools/spawn-tuner
r golden node tools/spawn-tuner/test/golden.mjs $P tools/spawn-tuner
r solver2 node tools/spawn-tuner/test/solver2.test.mjs tools/spawn-tuner
r solver2-MAIN node tools/spawn-tuner/test/solver2.test.mjs $P
r yard node tools/spawn-tuner/test/yard.test.mjs tools/spawn-tuner
r yard-MAIN node tools/spawn-tuner/test/yard.test.mjs $P
r assets_check python3 tools/spawn-tuner/test/assets_check.py
cd engine; N=3 r npm npm test
echo "== done" >> $L
