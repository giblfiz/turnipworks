#!/bin/bash
# probe.sh N EVERY NAME... : after a quota stop, ask Codex for ONE image (the first NAME) every EVERY seconds, at most N
# times. While it still fails, QUOTA_STOP.txt gets one more entry. When it works, the rest of the queue runs.
cd "$(dirname "$0")"; tries=$1; every=$2; shift 2
for i in $(seq 1 $tries); do
  sleep $every
  mv QUOTA_STOP.txt QUOTA_STOP.prev.txt 2>/dev/null
  echo "$(date '+%F %T') PROBE $i: $1" >> probe.log
  python3 gen.py "$1" >> probe.log 2>&1
  if [ -f QUOTA_STOP.txt ]; then cat QUOTA_STOP.prev.txt QUOTA_STOP.txt > q.tmp 2>/dev/null; mv q.tmp QUOTA_STOP.txt; rm -f QUOTA_STOP.prev.txt; echo "$(date '+%F %T') PROBE $i: still stopped" >> probe.log
  else echo "$(date '+%F %T') PROBE $i: Codex painted again; running the queue" >> probe.log; rm -f QUOTA_STOP.prev.txt; shift; exec ./run_queue.sh gen-4.log "$@"; fi
done
echo "$(date '+%F %T') probes used up: finishing with what exists" >> probe.log
