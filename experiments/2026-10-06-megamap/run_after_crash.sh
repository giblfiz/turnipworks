#!/bin/bash
# 2026-10-06, after the build box crashed at 15:33 and /tmp (the first relay data dir) was lost: the rungs up to 203 rooms were
# rebuilt through the GET API (results/build_rebuilt_after_crash.jsonl) and the runs that had not finished were made here.
D=/var/tmp/tw-megamap-relay-data
PY=python3
cd "$(dirname "$0")"; export BUILD_JSONL=results/build_rebuilt_after_crash.jsonl
L=results/after_crash.log
nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader >> $L; nvidia-smi pmon -c 1 >> $L
timeout 3000 $PY ablate2.py --data $D --rooms 203 > results/ablate2.log 2>&1; echo "done ablate2 $?" >> $L
timeout 900 $PY repeats.py --data $D --rooms 203 > results/repeats-203.log 2>&1; echo "done repeats 203 $?" >> $L
timeout 600 $PY repeats.py --data $D --rooms 52 > results/repeats-52.log 2>&1; echo "done repeats 52 $?" >> $L
for n in 31 52 104 203; do timeout 1500 $PY measure.py --data $D --rooms $n --views default,quarter,whole,post_off,fires_off --out results/measure_second_pass.jsonl --tag second-after-crash >> results/second_after_crash.log 2>&1; echo "done second $n $?" >> $L; done
timeout 1500 $PY other_browsers.py --data $D --rooms 15 52 > results/other_browsers.log 2>&1; echo "done other $?" >> $L
nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader >> $L
