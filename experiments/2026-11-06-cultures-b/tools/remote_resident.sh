#!/usr/bin/env bash
# Run ON THE POD (ssh ... bash -s < tools/remote_resident.sh): stop the non-resident worker and start ONE resident worker
# (all models stay on the 24 GB card) on every plate without a GLB, the packs in landing order (Norse first). The
# 2026-11-06 wave ran 50-60 s a mesh non-resident.
set -e
R=/workspace/tw-runs/cultb-2026-11-06-cultures-b; WS=/workspace; cd $R
if [ -f worker-1.pid ] && kill -0 $(cat worker-1.pid) 2>/dev/null; then kill $(cat worker-1.pid); sleep 5; fi
for p in nrs wall-straight--norse wall-doorway--norse mde wall-straight--mde wall-doorway--mde wall-window-small--mde rus wall-straight--rus wall-doorway--rus wall-window-small--rus mes wall-straight--mes wall-doorway--mes door; do
  ls masked/$p*.png 2>/dev/null; done | awk '!seen[$0]++' | while read p; do s=$(basename $p .png); test -f models/$s.glb || echo $R/$p; done > shard-res
echo "todo $(wc -l < shard-res)"
ENC=$WS/.cache/huggingface/hub/models--camenduru--dinov3-vitl16-pretrain-lvd1689m/snapshots/3c276edd87d6f6e569ff0c4400e086807d0f3881
cd $WS/TRELLIS.2
OMP_NUM_THREADS=8 MKL_NUM_THREADS=8 OPENBLAS_NUM_THREADS=8 NUMEXPR_NUM_THREADS=8 PYTHONPATH=$WS/TRELLIS.2 HF_HOME=$WS/.cache/huggingface nohup python $WS/tw-pipeline/runpod_trellis2_batch.py --input-list $R/shard-res \
  --output-dir $R/models --manifest-name worker-1-res-manifest.json --pipeline-type 512 --faces 50000 --texture-size 1024 --seed 42 --resident --image-encoder $ENC > $R/worker-1-res.log 2>&1 < /dev/null &
echo $! > $R/worker-1.pid; echo "resident worker $(cat $R/worker-1.pid)"
