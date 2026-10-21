#!/usr/bin/env bash
# Upload gated RGBA plates (masked/*.png) to the pod and start 3 resident TRELLIS.2 workers on every plate that has
# no GLB yet. Safe to re-run for a second wave: finished GLBs are skipped and a running wave is never doubled.
# Usage: experiments/inn-02/launch_wave.sh HOST PORT
set -euo pipefail
host=$1; port=$2
here=$(cd "$(dirname "$0")" && pwd)
R=/workspace/tw-runs/inn-02
ssh_() { ssh -o BatchMode=yes -o ConnectTimeout=20 -p "$port" "root@$host" "$@"; }
if ssh_ "for n in 1 2 3; do test -f $R/worker-\$n.pid && kill -0 \$(cat $R/worker-\$n.pid) 2>/dev/null && exit 0; done; exit 1"; then
  echo "a wave is still running; not starting another"; exit 1
fi
tar -C "$here/masked" -cf - $(cd "$here/masked" && ls *.png) | ssh_ "mkdir -p $R/masked $R/models && tar --no-same-owner -C $R/masked -xf -"
ssh_ bash -s <<EOF
set -e
cd $R
ls masked/*.png | while read p; do s=\$(basename "\$p" .png); test -f models/\$s.glb || echo $R/\$p; done > todo.txt
n=\$(wc -l < todo.txt); echo "todo \$n"
test "\$n" -gt 0 || exit 0
# forward / forward-offset / reverse queues (inn-01 pattern) over disjoint thirds
split -n l/3 -d todo.txt shard-
wave=\$(date +%H%M%S)
cd /workspace/TRELLIS.2
ENC=/workspace/.cache/huggingface/hub/models--camenduru--dinov3-vitl16-pretrain-lvd1689m/snapshots/3c276edd87d6f6e569ff0c4400e086807d0f3881
for n in 1 2 3; do
  shard=$R/shard-0\$((n-1))
  test \$n -eq 3 && tac \$shard > \$shard.rev && shard=\$shard.rev
  PYTHONPATH=/workspace/TRELLIS.2 HF_HOME=/workspace/.cache/huggingface nohup python /workspace/tw-pipeline/runpod_trellis2_batch.py --input-list \$shard \
    --output-dir $R/models --manifest-name worker-\$n-\$wave-manifest.json --pipeline-type 512 --faces 50000 \
    --texture-size 1024 --resident --image-encoder \$ENC > $R/worker-\$n.log 2>&1 < /dev/null &
  echo \$! > $R/worker-\$n.pid
done
echo "wave \$wave started"
EOF
