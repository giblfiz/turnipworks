#!/usr/bin/env bash
# Put the pipeline scripts on the pod and run the TRELLIS.2 setup (about 7 min on the yard's 4090: torch 2.6 + the
# prebuilt wheels from the network volume). Safe to re-run. Waits on the setup's PID FILE, never on pgrep.
#   tools/pod_setup.sh [HOST PORT]
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
resolve_host_port "${1:-auto}" "${2:-auto}"
ssh_ 'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader; test -d /workspace/TRELLIS.2 && test -d /workspace/trellis2-built-wheels && echo "volume ok"; mkdir -p /workspace/tw-pipeline /workspace/tw-runs'
for f in runpod_trellis2_batch.py patch_trellis2_clean_export.py clean_uv_rasterizer.py setup_runpod_trellis2_clean.sh; do
  l=$(sha1sum "$ROOT/src/$f" | cut -c1-40); r=$(ssh_ "sha1sum /workspace/tw-pipeline/$f 2>/dev/null | cut -c1-40" || true)
  if [[ $l != "$r" ]]; then echo "updating $f on the pod"; scp -q -o BatchMode=yes -P "$port" "$ROOT/src/$f" "root@$host:/workspace/tw-pipeline/$f"; fi
done
L=/workspace/tw-runs/$RUN_PREFIX-setup.log
ssh_ "if test -f $L.pid && kill -0 \$(cat $L.pid) 2>/dev/null; then echo 'setup already running'; else cd /workspace; nohup bash /workspace/tw-pipeline/setup_runpod_trellis2_clean.sh > $L 2>&1 < /dev/null & echo \$! > $L.pid; echo 'setup started'; fi"
t0=$(date +%s)
while ssh_ "kill -0 \$(cat $L.pid) 2>/dev/null"; do sleep 20; printf '\r setup running %ss ' $(( $(date +%s) - t0 )); done; echo
ssh_ "tail -3 $L | cut -c1-200"
if ssh_ "grep -q 'clean TRELLIS.2 imports verified' $L"; then echo "SETUP OK in $(( $(date +%s) - t0 ))s"; else echo "SETUP FAILED: see $L on the pod" >&2; exit 1; fi
