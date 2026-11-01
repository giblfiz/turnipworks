#!/usr/bin/env bash
# The pod-side dead-man's switch: a second deletion timer that lives ON THE POD, so the pod still removes itself when
# the build box (and with it the local tools/pod_timer.sh) is down. Added 2026-10-06 after a box crash left five pods
# running with no live timer. It is a detached `sleep N; runpodctl remove pod $RUNPOD_POD_ID` on the pod, using the
# pod-scoped key RunPod puts in the container's environment (it is in PID 1's environment, not in an ssh shell, so the
# script reads /proc/1/environ). It is the BACKUP: arm it a little later than the local timer, which also books spend.
#   tools/pod_deadman.sh [SECONDS]     arm (or re-arm: the old one is killed first). Default: 2 min after pod.json timer_fires
#   tools/pod_deadman.sh --status      what is armed on the pod
#   tools/pod_deadman.sh --cancel      kill it (pod_down.sh does not need this: deleting the pod ends it)
# Works on the pod named by B/pod.json (TW_B=<pod folder> for the others). State on the pod's own disk, /root/tw-deadman.*
# (NOT /workspace: that is the network volume every pod shares).
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
resolve_host_port auto auto
case ${1:-} in
  --status) ssh_ 'p=$(cat /root/tw-deadman.pid 2>/dev/null); if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then echo "armed (pid $p): $(head -1 /root/tw-deadman.log)"; else echo "NOT armed"; tail -3 /root/tw-deadman.log 2>/dev/null; fi'; exit 0;;
  --cancel) ssh_ 'p=$(cat /root/tw-deadman.pid 2>/dev/null); [ -n "$p" ] && kill "$p" 2>/dev/null; rm -f /root/tw-deadman.pid; echo cancelled'; exit 0;;
esac
secs=${1:-}
if [[ -z $secs ]]; then secs=$(( $(date -d "$(pod_field timer_fires)" +%s) + 120 - $(date +%s) )); fi
[[ $secs =~ ^[0-9]+$ && $secs -gt 0 ]] || { echo "bad SECONDS '$secs'" >&2; exit 64; }
ssh_ 'cat > /root/tw-deadman.sh; chmod +x /root/tw-deadman.sh' <<'POD'
#!/bin/bash
# Dead-man's switch (tools/pod_deadman.sh on the build box wrote this): after $1 seconds this pod removes itself.
while IFS= read -r -d '' kv; do case $kv in RUNPOD_POD_ID=*|RUNPOD_API_KEY=*) export "$kv";; esac; done < /proc/1/environ
[ -n "$RUNPOD_POD_ID" ] && [ -n "$RUNPOD_API_KEY" ] || { echo "NO RUNPOD_POD_ID / RUNPOD_API_KEY in the container environment: cannot arm"; exit 1; }
echo $$ > /root/tw-deadman.pid
echo "armed $(date -Is): pod $RUNPOD_POD_ID removes itself in $1 s (at $(date -d "+$1 seconds" -Is))"
sleep "$1" & sp=$!
trap 'kill $sp 2>/dev/null; echo "$(date -Is) cancelled"; exit 0' TERM INT
wait $sp; trap - TERM INT
for try in $(seq 1 20); do echo "$(date -Is) fired, try $try"; runpodctl remove pod "$RUNPOD_POD_ID"; sleep 30; done
POD
ssh_ 'p=$(cat /root/tw-deadman.pid 2>/dev/null); [ -n "$p" ] && kill "$p" 2>/dev/null; rm -f /root/tw-deadman.pid; nohup setsid /root/tw-deadman.sh '"$secs"' > /root/tw-deadman.log 2>&1 < /dev/null & sleep 2; p=$(cat /root/tw-deadman.pid 2>/dev/null); [ -n "$p" ] && kill -0 "$p" && head -1 /root/tw-deadman.log || { echo "DEAD-MAN SWITCH DID NOT START"; cat /root/tw-deadman.log; exit 1; }'
echo "$(date -Is) pod-side dead-man's switch armed on $(pod_field id): fires $(date -d "+$secs seconds" -Is)" >> "$B/deletion-timer.log"
