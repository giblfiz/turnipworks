#!/bin/bash
# the stacked fixes at the default view on the smaller maps (quick form of ablate2.py)
D=/var/tmp/tw-megamap-relay-data; PY=python3
cd "$(dirname "$0")"; export BUILD_JSONL=results/build_rebuilt_after_crash.jsonl; L=results/after_crash.log
for n in 52 104 31; do cat /proc/loadavg >> $L; timeout 1500 $PY ablate2.py --stack-only --data $D --rooms $n > results/ablate2-$n-stack.log 2>&1; echo "done ablate2 stack $n $?" >> $L; done
