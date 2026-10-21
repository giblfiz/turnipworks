#!/bin/bash
# after the ladder: who-calls-three profiles, a second pass over the three headline views, other engines
S=/tmp/scratch
PY=python3
cd "$(dirname "$0")"
timeout 1200 $PY profile2.py --data $S/relay-data --rooms 203 > results/profile2-203.txt 2>&1; echo "done profile2 $?" >> results/rest.log
for n in 15 31 52 104 203; do timeout 1500 $PY measure.py --data $S/relay-data --rooms $n --views default,quarter,whole,post_off,fires_off --out results/measure_second_pass.jsonl --tag second >> results/second.log 2>&1; echo "done second $n $?" >> results/rest.log; done
timeout 1500 $PY other_browsers.py --data $S/relay-data --rooms 15 52 > results/other_browsers.log 2>&1; echo "done other $?" >> results/rest.log
