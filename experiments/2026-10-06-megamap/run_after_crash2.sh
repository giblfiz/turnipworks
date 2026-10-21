#!/bin/bash
# after run_after_crash.sh: the second ablation repeated at 203 rooms (its default-view baselines moved between 178 and 406 ms
# in the first run), and at 104 and 52 rooms, to say what the same fixes do for smaller maps.
D=/var/tmp/tw-megamap-relay-data
PY=python3
cd "$(dirname "$0")"; export BUILD_JSONL=results/build_rebuilt_after_crash.jsonl
L=results/after_crash.log
until grep -q "done other" $L; do sleep 10; done
# as run: only 203 finished this way (the box was busy and every timed run waits for a quiet GPU); 104 and 52 were then
# run by hand with --stack-only (results/ablate2-<n>-stack.log)
for n in 203 104 52; do nvidia-smi pmon -c 1 | grep -v "^#" >> $L; cat /proc/loadavg >> $L; timeout 3000 $PY ablate2.py --data $D --rooms $n > results/ablate2-$n-repeat.log 2>&1; echo "done ablate2 repeat $n $?" >> $L; done
