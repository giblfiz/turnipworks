#!/usr/bin/env bash
# (2026-11-07) EUR-IS-1 (where the TRELLIS volume lives) had no 4090, L4 or A100 free. Try every 4 min for up to N hours:
# whichever of 4090 / L4 / A100 the account can create first (pod_up.sh refuses a second pod, so this makes at most one).
#   tools/pod_wait_up.sh [HOURS_TO_KEEP_TRYING=2] [POD_TIMER_HOURS=2]
T=$(cd "$(dirname "$0")" && pwd); B=$(dirname "$T"); end=$(( $(date +%s) + ${1:-2} * 3600 ))
while [[ $(date +%s) -lt $end ]]; do
  [[ -f $B/pod.json ]] && { echo "$(date -Is) pod.json exists: up"; exit 0; }
  for g in 4090 l4 a100; do
    st=$(source "$T/pod_lib.sh"; case $g in 4090) rp_stock "$GPU_4090";; l4) rp_stock "NVIDIA L4";; a100) rp_stock "$GPU_A100";; esac)
    echo "$(date -Is) $g stock: ${st:-?}"
    [[ ${st:-none} == none ]] && continue
    rm -f "$B/pod-create.out" "$B/pod-create.err"
    "$T/pod_up.sh" "${2:-2}" --gpu "$g" && exit 0
    [[ -f $B/pod-ever-created ]] && { echo "a pod was created but pod_up failed after: see the log"; exit 1; }
  done
  sleep 240
done
echo "$(date -Is) gave up"; exit 1
