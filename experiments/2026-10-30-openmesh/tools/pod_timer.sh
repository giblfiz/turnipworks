#!/usr/bin/env bash
# The deletion timer: sleep, then delete the pod NO MATTER WHAT (retries), verify, and write it to spend.log.
# This timer is a LOCAL process: it dies with the build box (it did, 2026-10-06). tools/pod_deadman.sh is the copy on the pod.
# To extend: kill the pid in deletion-timer.pid, start this again, update pod.json timer_fires, re-run pod_deadman.sh.
# Started detached by pod_up.sh; cancelled by pod_down.sh. Usage: pod_timer.sh POD_ID SECONDS
source "$(dirname "$0")/pod_lib.sh"
id=$1; secs=$2
echo "$(date -Is) armed: pod $id will be deleted in ${secs}s (at $(date -d "+${secs} seconds" -Is)); timer pid $$"
echo $$ > "$B/deletion-timer.pid"                      # our own pid: `nohup setsid ... &` in the caller reports the wrong one
sleep "$secs" &
sp=$!
trap 'kill $sp 2>/dev/null; echo "$(date -Is) timer cancelled (TERM) before firing"; exit 0' TERM INT
wait $sp
trap - TERM INT
echo "$(date -Is) timer fired: deleting pod $id"
# REST v2 DELETE, verified by GET, GraphQL `remove pod` as the second road (rp_pod_kill; OPS-441). Only a verified
# "gone" is logged as deleted: the v1 version of this loop logged "deleted pod" whatever GET said, and after v1's
# 2026-11-16 shutdown (410) that line would have sat over a pod still billing.
st=unknown
for try in 1 2 3 4 5 6 7 8 9 10; do
  st=$(rp_pod_kill "$id"); kr=$?
  echo "$(date -Is) try $try: pod state -> $st"
  [[ $kr == 0 ]] && break
  sleep 30
done
if [[ $st == gone ]]; then
  log_spend "TIMER deletion timer FIRED and deleted pod $id, VERIFIED (pod state $st; pods now $(rp_pod_list || echo UNKNOWN)); balance \$$(rp_balance). Run tools/pod_down.sh to book the spend."
else
  log_spend "ERROR TIMER deletion timer FIRED but pod $id is NOT verified gone after 10 tries (last state $st). It may still be billing: check by hand. tools/pod_deadman.sh on the pod is the backstop."
  echo "$(date -Is) ERROR: pod $id NOT verified gone (last state $st)"
  exit 1
fi
