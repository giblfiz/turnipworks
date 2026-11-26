#!/usr/bin/env bash
# Extend BOTH timers on the existing single pod. Argument is minutes from now.
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
minutes=${1:?minutes from now required}
[[ $minutes =~ ^[0-9]+$ && $minutes -gt 0 && $minutes -le 60 ]] || exit 64
secs=$((minutes*60))
# Arm the remote backup first, so the pod is always guarded while local timer changes.
"$TOOLS/pod_deadman.sh" "$((secs+120))"
if [[ -f $B/deletion-timer.pid ]]; then kill "$(cat "$B/deletion-timer.pid")"; sleep 2; fi
rm -f "$B/deletion-timer.pid"
nohup setsid "$TOOLS/pod_timer.sh" "$(pod_field id)" "$secs" >> "$B/deletion-timer.log" 2>&1 < /dev/null &
sleep 2
test -f "$B/deletion-timer.pid" && kill -0 "$(cat "$B/deletion-timer.pid")"
jq --arg fire "$(date -d "+$secs seconds" -Is)" '.timer_fires=$fire' "$POD_JSON" > "$POD_JSON.tmp"
mv "$POD_JSON.tmp" "$POD_JSON"
log_spend "EXTEND existing pod $(pod_field id) by $minutes minutes from now; both timers armed"
