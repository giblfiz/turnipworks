#!/usr/bin/env bash
# A publishing round whenever new meshes have come home: QA, tiers, publish, thumbnails, blind read, deploy.
#   setsid nohup ./loop_publish.sh > /dev/null 2>&1 &      stop: touch set/PUBLISH_STOP
cd "$(dirname "$0")"; echo $$ > set/publish.pid; n0=-1
while [[ ! -f set/PUBLISH_STOP ]]; do
  n1=$(ls set/models/*.glb 2>/dev/null | wc -l)
  if [[ $n1 != "$n0" || -f set/CYCLE_NOW ]]; then rm -f set/CYCLE_NOW; n0=$n1; ./cycle.sh --no-harvest >> set/loop.log 2>&1; else sleep 30; fi
done
rm -f set/publish.pid set/PUBLISH_STOP
