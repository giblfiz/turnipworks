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
st=$(rp_pod_state "$id")
echo "pod $id ($(pod_field gpu) @ \$$cost/hr, up since $start): pod state -> $st"
if [[ $st != gone && $force == 0 ]]; then
  # anything still running, anything not harvested?
  rep=$(ssh_ "for d in /workspace/tw-runs/$RUN_PREFIX-*/; do test -d \$d/models || continue; t=\$(basename \$d); alive=0; for p in \$d/worker-*.pid; do test -f \$p && kill -0 \$(cat \$p) 2>/dev/null && alive=\$((alive+1)); done; echo \"\${t#$RUN_PREFIX-} \$alive \$(ls \$d/models/*.glb 2>/dev/null | wc -l)\"; done" 2>/dev/null || echo "SSH_FAILED")
  bad=0
  while read -r t alive n; do
    [[ -z ${t:-} ]] && continue
    if [[ $t == SSH_FAILED ]]; then echo "cannot reach the pod by ssh to check for unharvested work (use --force)"; bad=1; continue; fi
    [[ $t == "$(basename "$B")" ]] || continue
    loc=$(find -L "$B/models/" -maxdepth 1 -name '*.glb' 2>/dev/null | wc -l)
    echo "  $t: $alive worker(s) running, $n GLBs on the pod, $loc here"
    [[ $alive != 0 || $n -gt $loc ]] && bad=1
  done <<<"$rep"
  [[ $bad == 0 ]] || { echo "REFUSING: wave running or GLBs not harvested (tools/harvest.sh TYPE auto auto), or pass --force"; [[ $dry == 1 ]] || exit 1; }
fi
if [[ $dry == 1 ]]; then
  echo "DRY RUN. Would: DELETE $RP_API/pods/$id (GraphQL remove pod if that fails); verify the pod is gone (GET 404 or TERMINATED) and no pod named $POD_NAME is left; read the balance (now \$$(rp_balance), at start \$$bal0);"
  echo "append SPENT to $SPEND; stop the timer (pid file $B/deletion-timer.pid: $(cat "$B/deletion-timer.pid" 2>/dev/null || echo none)); move pod.json to pod-$id.json"
  exit 0
fi
for try in 1 2 3 4 5; do       # REST v2 + GraphQL fallback (rp_pod_kill; OPS-441)
  [[ $(rp_pod_state "$id") == gone ]] && break
  rp_pod_kill "$id" >/dev/null || true
done
st=$(rp_pod_state "$id"); pods=$(rp_our_pods) || pods="UNKNOWN (pod list failed)"
if [[ $st != gone ]]; then echo "POD NOT VERIFIED GONE (state $st). NOT cancelling the timer. Pods: $pods" >&2; log_spend "ERROR pod $id delete not verified (state $st); timer left armed"; exit 1; fi
end=$(date -Is)
sleep 20                                   # the balance settles a few seconds after the pod stops billing
acct=$(rp_account); bal1=$(jq -r .clientBalance <<<"$acct"); rate=$(jq -r .currentSpendPerHr <<<"$acct")
read -r hrs est spent <<<"$(python3 -c "
from datetime import datetime
h=(datetime.fromisoformat('$end')-datetime.fromisoformat('$start')).total_seconds()/3600
print('%.3f %.2f %.2f' % (h, h*float('$cost'), float('$bal0')-float('$bal1')))")"
# cancel the timer: TERM to the pid it wrote itself (its trap stops the sleep and exits WITHOUT deleting); verified
# with kill -0 (never pkill -f: it matches itself)
left=0
if [[ -f $B/deletion-timer.pid ]]; then
  p=$(cat "$B/deletion-timer.pid"); kill "$p" 2>/dev/null || true; sleep 2
  kill -0 "$p" 2>/dev/null && left=1
  rm -f "$B/deletion-timer.pid"
fi
tnote="Deletion timer cancelled."; [[ $left == 1 ]] && tnote="DELETION TIMER STILL ALIVE (harmless: the pod is gone; kill it by hand)."
others=$(jq 'length' <<<"$pods" 2>/dev/null) || others=unknown
log_spend "SPENT \$$est RunPod pod $id: $start -> $end = $hrs h x \$$cost/hr = \$$est (OUR pod's uptime x its rate; the account balance moved \$$bal0 -> \$$bal1 = \$$spent but sibling pods bill the same account, so that figure is NOT ours). Pod DELETED, verified (pod state $st, pods named $POD_NAME: $pods). $tnote"
echo "$(date -Is) pod $id deleted and verified; $tnote" >> "$B/deletion-timer.log"
mv "$POD_JSON" "$B/pod-$id.json"
tail -1 "$SPEND"
[[ $others == 0 ]] || echo "WARNING: the account still lists pods named $POD_NAME: $pods"
