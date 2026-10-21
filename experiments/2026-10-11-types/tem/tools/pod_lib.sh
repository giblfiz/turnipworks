# Shared by pod_up.sh / pod_down.sh / pod_timer.sh / launch_wave.sh / harvest.sh / wait_wave.sh. Source it.
TOOLS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
B=${TW_B:-$(dirname "$TOOLS")}      # TW_B: point the scripts at a scratch copy of the batch folder (tests)
ROOT=${TW_ROOT:-$(cd "$B/../../.." && pwd)}
POD_JSON=$B/pod.json
SPEND=$B/spend.log
RUNPODCTL=${RUNPODCTL:-/usr/local/bin/runpodctl}
VOLUME_ID=7hbjaot7ej            # tw-trellis-cache, EUR-IS-1, 50 GB
DC=EUR-IS-1
IMAGE=runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04
POD_NAME=${POD_NAME:-tw-type-tem}
GPU_A100="NVIDIA A100-SXM4-80GB"
GPU_4090="NVIDIA GeForce RTX 4090"
RUN_PREFIX=tem                  # remote run dirs: /workspace/tw-runs/ccm-<type>

need_key() { : "${RUNPOD_API_KEY:?RUNPOD_API_KEY is not in the environment (do not read credential files; start from a fauna session)}"; }

# account: balance, spend/hr, pods (GraphQL; read-only)
rp_account() {
  need_key
  curl -s -m 30 -H "Authorization: Bearer $RUNPOD_API_KEY" -H "Content-Type: application/json" \
    -d '{"query":"query { myself { clientBalance currentSpendPerHr pods { id name desiredStatus costPerHr } } }"}' \
    https://api.runpod.io/graphql | jq -c '.data.myself'
}
rp_balance() { rp_account | jq -r '.clientBalance'; }
# HTTP status of GET pod (404 = gone)
rp_pod_http() { need_key; curl -s -m 30 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $RUNPOD_API_KEY" "https://rest.runpod.io/v1/pods/$1"; }
rp_pod_list() { need_key; curl -s -m 30 -H "Authorization: Bearer $RUNPOD_API_KEY" https://rest.runpod.io/v1/pods | jq -c '[.[] | {id, name, desiredStatus, costPerHr}]'; }
# stock of a GPU in the volume's data centre: High | Medium | Low | none | (empty = not offered)
rp_stock() { "$RUNPODCTL" gpu list 2>/dev/null | jq -r --arg g "$1" --arg dc "$DC" '.[] | select(.gpuId == $g) | (.dataCenterAvailability // [])[] | select(.dataCenterId == $dc) | .stockStatus'; }
rp_price() { "$RUNPODCTL" gpu list 2>/dev/null | jq -r --arg g "$1" '.[] | select(.gpuId == $g) | .securePricePerHr'; }

pod_field() { jq -r ".$1 // empty" "$POD_JSON" 2>/dev/null || true; }
# HOST PORT from the arguments, or from pod.json when given as "auto" (or missing)
resolve_host_port() {
  host=${1:-auto}; port=${2:-auto}
  if [[ -n ${TW_LOCAL:-} ]]; then host=local; port=0; return; fi
  if [[ $host == auto || $port == auto ]]; then host=$(pod_field host); port=$(pod_field port); fi
  [[ -n $host && -n $port ]] || { echo "no HOST PORT and no $POD_JSON" >&2; exit 64; }
}
# TW_LOCAL=<dir>: no pod at all; "remote" commands run in a local shell and /workspace is <dir> (tests of the wave logic)
WS=${TW_LOCAL:-/workspace}
if [[ -n ${TW_LOCAL:-} ]]; then
  ssh_() { if [[ $# -gt 0 ]]; then bash -c "$*"; else bash -s; fi; }
  RSYNC_SRC=""; rsync_() { rsync "$@"; }
else
  ssh_() { ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -p "$port" "root@$host" "$@"; }
  rsync_() { rsync -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p $port" "$@"; }
fi
remote_path() { if [[ -n ${TW_LOCAL:-} ]]; then echo "$1"; else echo "root@$host:$1"; fi; }
# type folder -> absolute path + remote run dir
resolve_type() {
  if [[ -d $1 ]]; then TYPE_DIR=$(cd "$1" && pwd); else TYPE_DIR=$B/$1; fi
  [[ -d $TYPE_DIR ]] || { echo "no type folder $1" >&2; exit 64; }
  TYPE=$(basename "$TYPE_DIR"); R=$WS/tw-runs/$RUN_PREFIX-$TYPE
}
log_spend() { printf '%s %s\n' "$(date -Is)" "$*" >> "$SPEND"; }
# skus of a type folder that go to TRELLIS (route "trellis" or unset) and have a gated plate: one per line
trellis_skus() {
  python3 - "$1" <<'PY'
import json, sys
from pathlib import Path
t = Path(sys.argv[1]); spec = {}
if (t / "assets.json").exists(): spec = {a["id"]: a for a in json.loads((t / "assets.json").read_text())["assets"]}
other = []
for p in sorted((t / "masked").glob("*.png")):
    r = spec.get(p.stem, {}).get("route", "trellis")
    if r == "trellis": print(p.stem)
    else: other.append(f"{p.stem}\t{r}")
(t / "route-other.txt").write_text("".join(o + "\n" for o in other))
PY
}
