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
for try in 1 2 3 4 5 6 7 8 9 10; do
  "$RUNPODCTL" pod delete "$id"
  sleep 6
  code=$(rp_pod_http "$id")
  echo "$(date -Is) try $try: GET pod -> $code"
  [[ $code == 404 ]] && break
  sleep 30
done
log_spend "TIMER deletion timer FIRED and deleted pod $id (GET pod -> $code; pods now $(rp_pod_list)); balance \$$(rp_balance). Run tools/pod_down.sh to book the spend."
