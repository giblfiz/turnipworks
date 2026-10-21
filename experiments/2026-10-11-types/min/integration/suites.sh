#!/bin/bash
# suites.sh <tree> : the mine test, the golden test against sandbox/pristine, and the tuner's own node suites, one line each
T=$(realpath "$1"); H=$(dirname "$(realpath "$0")"); WT=$(realpath "$H/../../../..")
echo "min: $(node $WT/tools/spawn-tuner/test/min.test.mjs $T 2>&1 | grep -c FAIL) FAIL lines; $(node $WT/tools/spawn-tuner/test/min.test.mjs $T 2>&1 | tail -30 | grep 'checks,')"
echo "golden: $(node $WT/tools/spawn-tuner/test/golden.mjs $H/sandbox/pristine $T 2>&1 | tail -2 | tr '\n' ' ')"
cd $T; for t in solver solver2 yard repeat zones stable stacks focal wall_items logcabin wallkit anim crypt castle mansion dun; do [ -f test/$t.test.mjs ] && echo "$t: $(node test/$t.test.mjs $T 2>&1 | tail -1 | cut -c1-140)"; done
echo "fuzz: $(node test/v2_fuzz.mjs 2>&1 | tail -1 | cut -c1-140)"
