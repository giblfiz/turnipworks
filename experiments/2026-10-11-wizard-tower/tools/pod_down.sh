#!/usr/bin/env bash
# Delete the batch's pod, VERIFY it is gone through the API, book the measured dollars, cancel the deletion timer.
#   tools/pod_down.sh [--dry-run] [--force]
# Refuses (without --force) while a wave is running or while the pod holds GLBs that are not on this machine yet.
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
dry=0; force=0
for a in "$@"; do case $a in --dry-run) dry=1;; --force) force=1;; *) echo "unknown argument $a" >&2; exit 64;; esac; done
need_key
[[ -f $POD_JSON ]] || { echo "no $POD_JSON: nothing to take down. Account pods: $(rp_pod_list)"; exit 1; }
id=$(pod_field id); host=$(pod_field host); port=$(pod_field port); cost=$(pod_field cost_per_hr); start=$(pod_field start); bal0=$(pod_field balance_before)
code=$(rp_pod_http "$id")
echo "pod $id ($(pod_field gpu) @ \$$cost/hr, up since $start): GET pod -> $code"
if [[ $code != 404 && $force == 0 ]]; then
  # anything still running, anything not harvested?
  rep=$(ssh_ "for d in /workspace/tw-runs/$RUN_PREFIX-*/; do test -d \$d/models || continue; t=\$(basename \$d); alive=0; for p in \$d/worker-*.pid; do test -f \$p && kill -0 \$(cat \$p) 2>/dev/null && alive=\$((alive+1)); done; echo \"\${t#$RUN_PREFIX-} \$alive \$(ls \$d/models/*.glb 2>/dev/null | wc -l)\"; done" 2>/dev/null || echo "SSH_FAILED")
  bad=0
  while read -r t alive n; do
    [[ -z ${t:-} ]] && continue
    if [[ $t == SSH_FAILED ]]; then echo "cannot reach the pod by ssh to check for unharvested work (use --force)"; bad=1; continue; fi
    loc=$(ls "$B/$t/models/"*.glb 2>/dev/null | wc -l)
    echo "  $t: $alive worker(s) running, $n GLBs on the pod, $loc here"
    [[ $alive != 0 || $n -gt $loc ]] && bad=1
  done <<<"$rep"
  [[ $bad == 0 ]] || { echo "REFUSING: wave running or GLBs not harvested (tools/harvest.sh TYPE auto auto), or pass --force"; [[ $dry == 1 ]] || exit 1; }
fi
if [[ $dry == 1 ]]; then
  echo "DRY RUN. Would: $RUNPODCTL pod delete $id; verify GET pod = 404 and the pod list is empty; read the balance (now \$$(rp_balance), at start \$$bal0);"
  echo "append SPENT to $SPEND; stop the timer (pid file $B/deletion-timer.pid: $(cat "$B/deletion-timer.pid" 2>/dev/null || echo none)); move pod.json to pod-$id.json"
  exit 0
fi
for try in 1 2 3 4 5; do
  [[ $(rp_pod_http "$id") == 404 ]] && break
  "$RUNPODCTL" pod delete "$id" || true
  sleep 6
done
code=$(rp_pod_http "$id"); pods=$(rp_pod_list)
if [[ $code != 404 ]]; then echo "POD STILL THERE (GET -> $code). NOT cancelling the timer. Pods: $pods" >&2; log_spend "ERROR pod $id delete not verified (GET -> $code); timer left armed"; exit 1; fi
end=$(date -Is)
sleep 20                                   # the balance settles a few seconds after the pod stops billing
acct=$(rp_account); bal1=$(jq -r .clientBalance <<<"$acct"); rate=$(jq -r .currentSpendPerHr <<<"$acct")
read -r hrs est spent <<<"$(python3 -c "
from datetime import datetime
h=(datetime.fromisoformat('$end')-datetime.fromisoformat('$start')).total_seconds()/3600
print('%.2f %.2f %.2f' % (h, h*float('$cost'), float('$bal0')-float('$bal1')))")"
# cancel the timer: TERM to the pid it wrote itself (its trap stops the sleep and exits WITHOUT deleting); verified
# with kill -0 (never pkill -f: it matches itself)
left=0
if [[ -f $B/deletion-timer.pid ]]; then
  p=$(cat "$B/deletion-timer.pid"); kill "$p" 2>/dev/null || true; sleep 2
  kill -0 "$p" 2>/dev/null && left=1
  rm -f "$B/deletion-timer.pid"
fi
tnote="Deletion timer cancelled."; [[ $left == 1 ]] && tnote="DELETION TIMER STILL ALIVE (harmless: the pod is gone; kill it by hand)."
others=$(jq 'length' <<<"$pods")
log_spend "SPENT \$$spent RunPod pod $id: $start -> $end ($hrs h x \$$cost = \$$est est.); account balance \$$bal0 -> \$$bal1 = \$$spent measured. Pod DELETED, verified (GET pod 404, pod list $pods, spend/hr $rate). $tnote"
echo "$(date -Is) pod $id deleted and verified; $tnote" >> "$B/deletion-timer.log"
mv "$POD_JSON" "$B/pod-$id.json"
tail -1 "$SPEND"
[[ $others == 0 ]] || echo "WARNING: the account still lists pods: $pods"
