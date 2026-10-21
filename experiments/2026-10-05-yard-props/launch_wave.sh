#!/usr/bin/env bash
# Upload gated RGBA plates (masked/*.png) and start ONE TRELLIS.2 worker (RTX 4090, 24 GB) on every plate that has no GLB
# yet. Safe to re-run for another wave: finished GLBs are skipped and a running wave is never doubled.
# Usage: launch_wave.sh HOST PORT [sku ...]     (skus given = re-mesh those, overwriting)
set -euo pipefail
host=$1; port=$2; shift 2
here=$(cd "$(dirname "$0")" && pwd)
R=/workspace/tw-runs/yard-props
ssh_() { ssh -o BatchMode=yes -o ConnectTimeout=20 -p "$port" "root@$host" "$@"; }
if ssh_ "test -f $R/worker.pid && kill -0 \$(cat $R/worker.pid) 2>/dev/null"; then echo "a wave is still running; not starting another"; exit 1; fi
tar -C "$here/masked" -cf - $(cd "$here/masked" && ls ${ONLY:-*.png}) | ssh_ "mkdir -p $R/masked $R/models && tar --no-same-owner -C $R/masked -xf -"
for s in "$@"; do ssh_ "rm -f $R/models/$s.glb"; done
ssh_ bash -s <<REMOTE
set -e
cd $R
ls masked/*.png | while read p; do s=\$(basename "\$p" .png); test -f models/\$s.glb || echo $R/\$p; done > todo.txt
n=\$(wc -l < todo.txt); echo "todo \$n"
test "\$n" -gt 0 || exit 0
wave=\$(date +%H%M%S)
cd /workspace/TRELLIS.2
ENC=/workspace/.cache/huggingface/hub/models--camenduru--dinov3-vitl16-pretrain-lvd1689m/snapshots/3c276edd87d6f6e569ff0c4400e086807d0f3881
PYTHONPATH=/workspace/TRELLIS.2 HF_HOME=/workspace/.cache/huggingface nohup python /workspace/tw-pipeline/runpod_trellis2_batch.py --input-list $R/todo.txt \
  --output-dir $R/models --manifest-name worker-\$wave-manifest.json --pipeline-type 512 --faces 50000 \
  --texture-size 1024 --seed ${SEED:-42} --image-encoder \$ENC > $R/worker-\$wave.log 2>&1 < /dev/null &
echo \$! > $R/worker.pid
ln -sf $R/worker-\$wave.log $R/worker.log
echo "wave \$wave started"
REMOTE
