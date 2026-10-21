#!/usr/bin/env bash
# Plates for the smithy type, group after group, through the castle/crypt/mansion batch's gen.py (free Codex image
# route + the gates). A quota stop waits 15 minutes and probes. Log: smi/gen.log. Usage: tools/run_plates.sh [WORKERS=3]
cd "$(dirname "$0")/.."; SMI=$PWD
export TW_B=$(dirname "$SMI")
PY=python3
GEN=$SMI/tools/gen_cpu.py
W=${1:-3}
for round in 1 2; do
  for g in p1 sib1 p2 p3 sib2; do
    while :; do
      $PY $GEN smi --group $g --workers $W --rerolls 1 >> gen.log 2>&1; rc=$?
      [[ $rc == 75 ]] || break
      echo "$(date -Is) quota stop in $g: waiting 15 min" >> gen.log; sleep 900
      $PY $GEN smi --group $g --probe >> gen.log 2>&1
    done
    echo "$(date -Is) group $g round $round done rc=$rc" >> gen.log
  done
done
echo "$(date -Is) ALL DONE" >> gen.log
