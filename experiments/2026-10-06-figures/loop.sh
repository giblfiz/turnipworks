#!/usr/bin/env bash
# The set's conveyor: every few minutes hand new plates to idle pods, bring meshes home, QA, publish, deploy.
#   setsid nohup ./loop.sh > set/loop.out 2>&1 &      stop: touch set/LOOP_STOP
cd "$(dirname "$0")"; echo $$ > set/loop.pid
while [[ ! -f set/LOOP_STOP ]]; do
  n0=$(ls set/models/*.glb 2>/dev/null | wc -l)
  python3 dispatch.py --min=${MIN:-10} 2>&1 | tail -6 >> set/loop.log
  n1=$(ls set/models/*.glb 2>/dev/null | wc -l)
  if [[ $n1 != "$n0" || -f set/CYCLE_NOW ]]; then rm -f set/CYCLE_NOW; ./cycle.sh --no-harvest >> set/loop.log 2>&1; fi
  sleep ${EVERY:-150}
done
rm -f set/loop.pid set/LOOP_STOP; echo "$(date +%H:%M:%S) loop ended" >> set/loop.log
