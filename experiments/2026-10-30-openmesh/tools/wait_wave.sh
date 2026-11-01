#!/usr/bin/env bash
# Wait until a type's wave has finished, by its worker PID FILES on the pod (kill -0), never by pgrep / pkill: those
# match their own command line (the yard's pod sat idle for 8 minutes because of that).
#   tools/wait_wave.sh TYPE_DIR|all HOST PORT [TIMEOUT_MIN=180]
# Prints one status line a minute: workers alive, GLBs done / plates, failures. Exit 0 = no worker left, 1 = timeout,
# 2 = the pod stopped answering (5 failed checks in a row).
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
[[ $# -ge 3 ]] || { sed -n 2,7p "$0"; exit 64; }
what=$1; resolve_host_port "$2" "$3"; tmo=${4:-180}
if [[ $what == all ]]; then glob="$WS/tw-runs/$RUN_PREFIX-*"; else resolve_type "$what"; glob=$R; fi
t0=$(date +%s); miss=0
while true; do
  if st=$(ssh_ "alive=0; glb=0; plates=0; fail=0; for d in $glob; do test -d \$d/models || continue; for p in \$d/worker-*.pid; do test -f \$p && kill -0 \$(cat \$p) 2>/dev/null && alive=\$((alive+1)); done; glb=\$((glb+\$(ls \$d/models/*.glb 2>/dev/null | wc -l))); plates=\$((plates+\$(ls \$d/masked/*.png 2>/dev/null | wc -l))); w=\$(cat \$d/wave.txt 2>/dev/null); fail=\$((fail+\$(cat \$d/worker-*-\$w.log 2>/dev/null | grep -c asset_failed))); done; echo \$alive \$glb \$plates \$fail"); then
    miss=0; read -r alive glb plates fail <<<"$st"
    echo "$(date +%H:%M:%S) $what: $alive worker(s) alive, $glb / $plates GLBs, $fail failed in this wave"
    [[ $alive == 0 ]] && exit 0
  else
    miss=$((miss+1)); echo "$(date +%H:%M:%S) no answer from the pod ($miss)"; [[ $miss -ge 5 ]] && exit 2
  fi
  (( $(date +%s) - t0 > tmo * 60 )) && { echo "timeout after $tmo min"; exit 1; }
  sleep "${POLL:-60}"
done
