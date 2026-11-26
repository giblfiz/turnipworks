#!/usr/bin/env bash
# Keep THE pod alive while it has work: every 15 min, if a worker is alive on it, push both timers to 60 min from now
# (pod_extend.sh: the pod-side dead-man first). With no worker alive it stops extending, and the timers run out by
# themselves within the hour unless tools/pod_down.sh takes it down first. Hard stop: 14:00 local.
cd "$(dirname "$0")"; source tools/pod_lib.sh; resolve_host_port auto auto
while [[ 10#$(date +%H%M) -lt 1400 && -f pod.json ]]; do
  alive=$(ssh_ "n=0; for p in $WS/tw-runs/$RUN_PREFIX-*/worker-*.pid; do test -f \$p && kill -0 \$(cat \$p) 2>/dev/null && n=\$((n+1)); done; echo \$n" 2>/dev/null || echo "?")
  if [[ $alive != 0 && $alive != "?" ]]; then tools/pod_extend.sh 60 >/dev/null 2>&1 && echo "$(date +%H:%M) $alive worker(s): timers pushed to +60 min"; else echo "$(date +%H:%M) workers alive: $alive; not extending"; fi
  sleep 900
done
