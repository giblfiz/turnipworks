#!/usr/bin/env bash
# Upload a type folder's gated RGBA plates (masked/*.png) and start TRELLIS.2 workers on every plate that has no GLB yet.
# Safe to re-run for another wave: finished GLBs are skipped and a running wave of the same type is never doubled.
#   tools/launch_wave.sh TYPE_DIR HOST PORT [sku ...]        HOST PORT may be `auto auto` (read from B/pod.json)
#   skus given = re-mesh those (their GLBs on the pod are removed first; a fresh random seed unless SEED is set)
# Env: WORKERS=n (default 3 on an A100 80 GB, 1 on a 4090)   RESIDENT=1|0 (default 1 on the A100: all models stay on the GPU)
#      QUEUE=1  start although another type's wave is running: these workers load on the CPU and go to the GPU when the
#               others exit (runpod_trellis2_batch.py --wait-pids, the inn-02 trick). Without it the script refuses.
#      SEED=n   DRY=1 (print what would be uploaded and started, touch nothing)
# All types share the one pod; each has its own remote dir /workspace/tw-runs/ccm-<type>. Assets whose spec says
# "route": "hunyuan-mv" (or anything but trellis) are NOT sent; they are listed in TYPE_DIR/route-other.txt.
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
[[ $# -ge 3 ]] || { sed -n 2,12p "$0"; exit 64; }
resolve_type "$1"; resolve_host_port "$2" "$3"; shift 3
gpu=$(pod_field gpu)
if [[ $gpu == *A100* ]]; then defw=3; defres=1; else defw=1; defres=0; fi
W=${WORKERS:-$defw}; RES=${RESIDENT:-$defres}
[[ $W == 1 || $gpu == *A100* || -n ${FORCE_WORKERS:-} || -n ${TW_LOCAL:-} ]] || { echo "WORKERS=$W on '${gpu:-unknown GPU}': a 24 GB card holds one worker. Set FORCE_WORKERS=1 to insist." >&2; exit 64; }
mapfile -t skus < <(trellis_skus "$TYPE_DIR")
[[ ${#skus[@]} -gt 0 ]] || { echo "$TYPE: no gated plates for TRELLIS in $TYPE_DIR/masked"; exit 0; }
other=$(wc -l < "$TYPE_DIR/route-other.txt")
seed=${SEED:-42}; [[ $# -gt 0 && -z ${SEED:-} ]] && seed=$(( (RANDOM << 15 | RANDOM) % 1000000 + 100 ))
echo "$TYPE: ${#skus[@]} plates for TRELLIS ($other on another route, see route-other.txt); workers $W, resident $RES, seed $seed; re-mesh: ${*:-none}"
PYBIN=${REMOTE_PY:-python}
if [[ ${DRY:-0} == 1 ]]; then
  echo "DRY: would upload ${#skus[@]} PNGs to $R/masked, remove GLBs for [$*], and start $W worker(s) on what has no GLB:"
  echo "  PYTHONPATH=$WS/TRELLIS.2 HF_HOME=$WS/.cache/huggingface $PYBIN $WS/tw-pipeline/runpod_trellis2_batch.py --input-list $R/shard-<wave>-0N --output-dir $R/models --manifest-name worker-N-<wave>-manifest.json --pipeline-type ${PIPE:-512} --faces 50000 --texture-size ${TEX:-1024} --seed $seed $([[ $RES == 1 ]] && echo --resident) --image-encoder <dinov3 mirror>"
  exit 0
fi
# anything running? this type: refuse. another type: refuse, or queue behind it.
live=$(ssh_ "for p in $WS/tw-runs/$RUN_PREFIX-*/worker-*.pid; do test -f \$p && kill -0 \$(cat \$p) 2>/dev/null && echo \$p:\$(cat \$p); done; true")
if grep -q "/$RUN_PREFIX-$TYPE/" <<<"$live"; then echo "a wave of $TYPE is still running; not starting another"; exit 1; fi
waitpids=""
if [[ -n $live ]]; then
  [[ ${QUEUE:-0} == 1 ]] || { echo "another type's wave is running ($(tr '\n' ' ' <<<"$live")). QUEUE=1 to load on the CPU and wait for it, or tools/wait_wave.sh first."; exit 1; }
  waitpids=$(sed 's/.*://' <<<"$live" | paste -sd, -)
fi
ssh_ "mkdir -p $R/masked $R/models"
printf '%s.png\n' "${skus[@]}" | tar -C "$TYPE_DIR/masked" -cf - -T - | ssh_ "tar --no-same-owner -C $R/masked -xf -"
for s in "$@"; do ssh_ "rm -f $R/models/$s.glb"; done
ssh_ bash -s <<REMOTE
set -e
cd $R
ls masked/*.png | while read p; do s=\$(basename "\$p" .png); test -f models/\$s.glb || echo $R/\$p; done > todo.txt
n=\$(wc -l < todo.txt); echo "todo \$n"
test "\$n" -gt 0 || exit 0
w=$W; test "\$n" -lt "\$w" && w=\$n
wave=\$(date +%H%M%S)
rm -f worker-*.pid
split -n l/\$w -d todo.txt shard-\$wave-
cd $WS/TRELLIS.2 2>/dev/null || true
ENC=$WS/.cache/huggingface/hub/models--camenduru--dinov3-vitl16-pretrain-lvd1689m/snapshots/3c276edd87d6f6e569ff0c4400e086807d0f3881
i=0
for shard in $R/shard-\$wave-*; do
  i=\$((i+1))
  PYTHONPATH=$WS/TRELLIS.2 HF_HOME=$WS/.cache/huggingface nohup $PYBIN $WS/tw-pipeline/runpod_trellis2_batch.py --input-list \$shard \
    --output-dir $R/models --manifest-name worker-\$i-\$wave-manifest.json --pipeline-type ${PIPE:-512} --faces 50000 \
    --texture-size ${TEX:-1024} --seed $seed $([[ $RES == 1 ]] && echo --resident) ${waitpids:+--wait-pids $waitpids} --image-encoder \$ENC > $R/worker-\$i-\$wave.log 2>&1 < /dev/null &
  echo \$! > $R/worker-\$i.pid
done
echo \$wave > $R/wave.txt
echo "wave \$wave started: \$i worker(s) on \$n plates${waitpids:+ (waiting for pids $waitpids before the GPU)}"
REMOTE
echo "$(date -Is) $TYPE launch: workers $W resident $RES seed $seed remesh [$*]" >> "$TYPE_DIR/waves.log"
