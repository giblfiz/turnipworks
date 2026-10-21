#!/bin/bash
# the whole ladder, one size after another (never two at once: they would share the GPU)
S=/tmp/scratch
PY=python3
cd "$(dirname "$0")"
for n in 15 31 52 104 203; do timeout 3000 $PY measure.py --data $S/relay-data --rooms $n >> results/measure.log 2>&1; echo "done $n $?" >> results/measure.log; done
for n in 405 802; do timeout 7200 $PY measure.py --data $S/relay-data-big --rooms $n --load-timeout 2400 >> results/measure.log 2>&1; echo "done $n $?" >> results/measure.log; done
