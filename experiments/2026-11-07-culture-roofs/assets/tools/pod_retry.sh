#!/usr/bin/env bash
# Retry tools/pod_up.sh (one RTX 4090 in EUR-IS-1, the volume's data centre) every 90 s until a pod exists or MIN minutes pass.
# A failed create makes nothing (pod_up.sh asks the account after every attempt). Stops at the first pod: pod-ever-created.
#   tools/pod_retry.sh [MIN=60]
cd "$(dirname "$0")/.."; end=$(( $(date +%s) + ${1:-60} * 60 ))
while [[ $(date +%s) -lt $end ]]; do
  [[ -e pod-ever-created ]] && { echo "$(date +%T) pod exists: $(cat pod-ever-created)"; exit 0; }
  echo "$(date +%T) try"; tools/pod_up.sh 1.5 --gpu 4090 --no-setup >> worker-logs/pod-up.log 2>&1 && { echo "$(date +%T) POD UP"; exit 0; }
  [[ -e pod-ever-created ]] && { echo "$(date +%T) pod created but pod_up.sh failed later: see worker-logs/pod-up.log"; exit 1; }
  sleep 90
done; echo "$(date +%T) gave up"; exit 1
