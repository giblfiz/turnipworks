#!/usr/bin/env bash
# Retry tools/pod_up.sh until a 4090 or an A100 is free in the volume's data centre (EUR-IS-1), every 3 min, at most MAX min.
# Stops at the first pod (pod_up.sh refuses a second: pod-ever-created). Log: pod-retry.log.
cd "$(dirname "$0")/.."; MAX=${MAX:-60}; t0=$(date +%s)
while (( $(date +%s) - t0 < MAX * 60 )); do
  [[ -e pod-ever-created ]] && { echo "$(date -Is) pod exists: $(cat pod-ever-created)"; exit 0; }
  echo "$(date -Is) try"; tools/pod_up.sh 1.5 > pod-up.log 2>&1 < /dev/null; tail -2 pod-up.log
  [[ -e pod-ever-created ]] && { echo "$(date -Is) pod created"; exit 0; }
  sleep 180
done; echo "$(date -Is) gave up after $MAX min"; exit 1
