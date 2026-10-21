#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 6 ]]; then
  printf 'usage: %s HOST PORT POD_ID REMOTE_RUN LOCAL_RUN EXPECTED_GLB\n' "$0" >&2
  exit 64
fi

host=$1
port=$2
pod_id=$3
remote_run=${4%/}
local_run=${5%/}
expected=$6
project_root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$local_run/models"
log="$local_run/harvest.log"

remote() {
  ssh -o BatchMode=yes -o ConnectTimeout=15 -p "$port" "root@$host" "$@"
}

while true; do
  status=$(remote "count=\$(find '$remote_run/models' -type f -name '*.glb' | wc -l); fail=\$(grep -h asset_failed '$remote_run'/worker-?.log 2>/dev/null | wc -l); alive=0; for n in 1 2 3; do test -f '$remote_run'/worker-\$n.pid && kill -0 \$(cat '$remote_run'/worker-\$n.pid) 2>/dev/null && alive=\$((alive+1)); done; printf '%s %s %s' \"\$count\" \"\$fail\" \"\$alive\"")
  printf '%s count/fail/alive %s\n' "$(date -Is)" "$status" >>"$log"
  count=$(awk '{print $1}' <<<"$status")
  alive=$(awk '{print $3}' <<<"$status")
  if (( count >= expected )); then
    break
  fi
  if (( alive == 0 )); then
    printf '%s workers exited early at %s/%s\n' "$(date -Is)" "$count" "$expected" >>"$log"
    touch "$local_run/HARVEST_FAILED"
    exit 1
  fi
  sleep 60
done

rsync -az --partial -e "ssh -o BatchMode=yes -p $port" \
  "root@$host:$remote_run/models/" "$local_run/models/"
for name in worker-1-manifest.json worker-2-manifest.json worker-3-manifest.json \
            worker-1.log worker-2.log worker-3.log; do
  scp -q -P "$port" "root@$host:$remote_run/$name" "$local_run/" || true
done

local_count=$(find "$local_run/models" -type f -name '*.glb' | wc -l)
if (( local_count != expected )); then
  printf '%s local collection mismatch: %s/%s\n' "$(date -Is)" "$local_count" "$expected" >>"$log"
  touch "$local_run/HARVEST_FAILED"
  exit 1
fi

blender --background --python "$project_root/src/validate_glb_batch.py" -- \
  "$local_run/models" "$local_run/blender-validation.json" >>"$log" 2>&1
touch "$local_run/HARVEST_COMPLETE"
"$project_root/src/delete_runpod_pod.sh" "$pod_id" >>"$log" 2>&1
