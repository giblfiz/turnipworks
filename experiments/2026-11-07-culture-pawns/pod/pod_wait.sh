#!/usr/bin/env bash
# EUR-IS-1 (where the TRELLIS cache volume is) had no 4090 and no A100 at 08:20 (another lane holds one). Ask every 90 s;
# the moment either is offered, make THE pod (tools/pod_up.sh 2: A100 first if offered, else the 4090). Gives up after 4 h.
cd "$(dirname "$0")"; source tools/pod_lib.sh
for i in $(seq 1 160); do
  a=$(rp_stock "$GPU_A100"); f=$(rp_stock "$GPU_4090")
  if [[ ( -n $a && $a != none ) || ( -n $f && $f != none ) ]]; then
    echo "$(date +%H:%M:%S) stock: A100 ${a:-not offered}, 4090 ${f:-not offered}: creating"
    tools/pod_up.sh 2 && { echo "$(date +%H:%M:%S) POD UP"; exit 0; }
    [[ -e pod-ever-created ]] && { echo "a pod was created but pod_up failed after; see pod.json"; exit 1; }
  fi
  sleep 90
done
echo "$(date +%H:%M:%S) gave up: no stock in 4 h"; exit 1
