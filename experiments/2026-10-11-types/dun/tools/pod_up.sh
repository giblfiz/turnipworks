#!/usr/bin/env bash
# ONE pod for the whole batch, on the network volume tw-trellis-cache (EUR-IS-1). Prefers an A100 80 GB (three resident
# workers); falls back to an RTX 4090 (one worker) when the A100 is out of stock there. Arms the deletion timer the
# moment a pod id exists, and a second one on the pod itself (tools/pod_deadman.sh) once ssh answers. Writes B/pod.json and the START line in B/spend.log, then runs the TRELLIS.2 setup.
#   tools/pod_up.sh [HOURS=4] [--dry-run] [--gpu a100|4090] [--no-setup]
# The method is the yard's and inn-02's: `runpodctl pod create ... --network-volume-id ... --wait`, then
# `nohup bash -c 'sleep N; runpodctl pod delete ID'`, then src/setup_runpod_trellis2_clean.sh on the pod.
set -euo pipefail
source "$(dirname "$0")/pod_lib.sh"
hours=4; dry=0; force_gpu=""; setup=1
while [[ $# -gt 0 ]]; do case $1 in
  --dry-run) dry=1;; --gpu) force_gpu=$2; shift;; --no-setup) setup=0;; [0-9]*) hours=$1;; *) echo "unknown argument $1" >&2; exit 64;; esac; shift; done
need_key
secs=$(python3 -c "print(int(float('$hours') * 3600))")

acct=$(rp_account); bal=$(jq -r .clientBalance <<<"$acct"); npods=$(jq '.pods | length' <<<"$acct")
echo "account: balance \$$bal, spend/hr $(jq -r .currentSpendPerHr <<<"$acct"), pods $(jq -c .pods <<<"$acct")"
if [[ -f $POD_JSON ]]; then echo "REFUSING: $POD_JSON exists (pod $(pod_field id)). Run tools/pod_down.sh first." >&2; [[ $dry == 1 ]] || exit 1; fi
nours=$(rp_our_pods | jq length)
if [[ $nours != 0 ]]; then echo "REFUSING: the account already has a pod named $POD_NAME: $(rp_our_pods). (Other agents' pods, $npods in all, are not our business.)" >&2; [[ $dry == 1 ]] || exit 1; fi

sa=$(rp_stock "$GPU_A100"); s4=$(rp_stock "$GPU_4090"); pa=$(rp_price "$GPU_A100"); p4=$(rp_price "$GPU_4090")
echo "stock in $DC: A100 80GB = ${sa:-not offered} (\$$pa/hr), RTX 4090 = ${s4:-not offered} (\$$p4/hr)"
order=()
case $force_gpu in
  a100) order=("$GPU_A100");; 4090) order=("$GPU_4090");;
  "") [[ -n $sa && $sa != none ]] && order+=("$GPU_A100"); order+=("$GPU_4090");;
  *) echo "--gpu a100|4090" >&2; exit 64;;
esac
create_cmd() { printf '%q ' "$RUNPODCTL" pod create --name "$POD_NAME" --gpu-id "$1" --data-center-ids "$DC" --network-volume-id "$VOLUME_ID" \
  --image "$IMAGE" --container-disk-in-gb 40 --ports 22/tcp --wait --wait-timeout 8m; }
if [[ $dry == 1 ]]; then
  echo "DRY RUN. Would try, in order:"; for g in "${order[@]}"; do echo "  $(create_cmd "$g")"; done
  echo "then: nohup setsid $TOOLS/pod_timer.sh <POD_ID> $secs   (deletes the pod after $hours h, whatever happens)"
  price=$pa; [[ ${order[0]} == "$GPU_4090" ]] && price=$p4
  echo "worst case if nothing else stops it: $hours h x \$$price = \$$(python3 -c "print(round($hours*$price,2))")"
  echo "then: write $POD_JSON, START line in $SPEND, and $TOOLS/pod_setup.sh (about 7 min)"
  exit 0
fi

arm_timer() {   # $1 pod id. Detached from this shell; survives it.
  rm -f "$B/deletion-timer.pid"
  nohup setsid "$TOOLS/pod_timer.sh" "$1" "$secs" >> "$B/deletion-timer.log" 2>&1 < /dev/null &
  sleep 2; test -f "$B/deletion-timer.pid" && kill -0 "$(cat "$B/deletion-timer.pid")" || { echo "TIMER DID NOT START: deleting pod $1 now" >&2; "$RUNPODCTL" pod delete "$1"; exit 1; }
}
id=""; gpu=""
for g in "${order[@]}"; do
  echo "creating: $g"
  set +e; eval "$(create_cmd "$g")" > "$B/pod-create.out" 2> "$B/pod-create.err"; rc=$?; set -e
  cat "$B/pod-create.err" | tail -3
  # whatever the CLI said, ask the account: a pod may exist even after an error or a --wait timeout
  id=$(rp_pod_list | jq -r --arg n "$POD_NAME" '[.[] | select(.name == $n)][0].id // empty')
  if [[ -z $id && $rc != 0 ]]; then sleep 15; id=$(rp_pod_list | jq -r --arg n "$POD_NAME" '[.[] | select(.name == $n)][0].id // empty'); fi   # the list can lag
  if [[ -n $id ]]; then gpu=$g; arm_timer "$id"; echo "pod $id exists; deletion timer armed ($hours h)"; break; fi
  echo "no pod from $g (rc $rc): $(tail -c 300 "$B/pod-create.out")"
done
[[ -n $id ]] || { echo "could not create a pod (A100 and 4090 both refused)"; exit 1; }
n=$(rp_our_pods | jq 'length')
if [[ $n != 1 ]]; then echo "WARNING: the account lists $n pods named $POD_NAME, expected 1: $(rp_our_pods)" >&2; log_spend "WARNING $n pods named $POD_NAME after create: $(rp_our_pods)"; fi

# ssh address: from the create output, else ask (it can take a minute after a --wait timeout)
host=$(sed -n '/^{/,$p' "$B/pod-create.out" | jq -r '.ssh.ip // empty' 2>/dev/null || true)
port=$(sed -n '/^{/,$p' "$B/pod-create.out" | jq -r '.ssh.port // empty' 2>/dev/null || true)
for i in $(seq 1 30); do
  [[ -n $host && -n $port ]] && break
  sleep 10; j=$("$RUNPODCTL" pod get "$id" 2>/dev/null || true)
  host=$(jq -r '.ssh.ip // empty' <<<"$j" 2>/dev/null || true); port=$(jq -r '.ssh.port // empty' <<<"$j" 2>/dev/null || true)
done
cost=$(rp_pod_list | jq -r --arg i "$id" '.[] | select(.id == $i) | .costPerHr')
jq -n --arg id "$id" --arg name "$POD_NAME" --arg gpu "$gpu" --arg host "$host" --arg port "$port" --arg cost "$cost" --arg start "$(date -Is)" \
  --arg hours "$hours" --arg fires "$(date -d "+${secs} seconds" -Is)" --arg bal "$bal" --arg vol "$VOLUME_ID" --arg dc "$DC" \
  '{id: $id, name: $name, gpu: $gpu, host: $host, port: ($port | tonumber? // $port), cost_per_hr: ($cost | tonumber? // $cost), start: $start,
    timer_hours: ($hours | tonumber), timer_fires: $fires, timer_pid_file: "deletion-timer.pid", balance_before: ($bal | tonumber), volume: $vol, data_center: $dc}' > "$POD_JSON"
note=""; [[ $gpu == "$GPU_4090" && -z $force_gpu ]] && note=" (A100 stock in $DC: ${sa:-not offered})"
log_spend "START RunPod pod $id $POD_NAME: 1x $gpu secure $DC @ \$$cost/hr$note; balance \$$bal; deletion timer $hours h => worst case \$$(python3 -c "print(round($hours*$cost,2))")"
cat "$POD_JSON"
[[ -n $host && -n $port ]] || { echo "pod $id has no ssh address yet; the timer is armed. Check 'runpodctl pod get $id', fix pod.json, run tools/pod_setup.sh"; exit 1; }
# second timer, ON THE POD (tools/pod_deadman.sh): fires 10 min after the local one, and does not need the build box to be up
for i in 1 2 3 4 5 6; do "$TOOLS/pod_deadman.sh" && break; echo "dead-man's switch not armed yet (ssh not up?), try $i"; sleep 15; done
"$TOOLS/pod_deadman.sh" --status | grep -q '^armed' || { echo "WARNING: NO POD-SIDE DEAD-MAN'S SWITCH on $id; only the local timer guards it" >&2; log_spend "WARNING pod $id has no pod-side dead-man's switch"; }
if [[ $setup == 1 ]]; then "$TOOLS/pod_setup.sh"; fi
