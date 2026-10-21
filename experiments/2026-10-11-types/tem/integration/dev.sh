#!/bin/sh
# rebuild the dev sandbox from the worktree and run the type test:  dev.sh [test args]
H=$(cd "$(dirname "$0")" && pwd); SB=${SB:-/tmp/scratch/sb}
python3 $H/apply.py --root $H/../../../.. > /dev/null && python3 $H/sandbox.py $SB $SBARGS | head -1 && cp $H/tem.test.mjs $H/one.mjs $SB/test/ && cd $SB && node test/tem.test.mjs . "$@" 2>&1 | grep "^FAIL\|   [0-9]* x\|checks\|rooms \|^nave\|sun:\|      " | cut -c1-${COLS:-240} | awk '!/^FAIL/ || ++n <= 12'
