# Shared by pod_up.sh / pod_down.sh / pod_timer.sh / launch_wave.sh / harvest.sh / wait_wave.sh. Source it.
TOOLS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
B=${TW_B:-$(dirname "$TOOLS")}      # B = the TYPE folder itself here (experiments/2026-10-11-types/min): one type, one agent, one pod; all state files live in it
ROOT=${TW_ROOT:-$(cd "$B/../.." && pwd)}
POD_JSON=$B/pod.json
SPEND=$B/spend.log
RUNPODCTL=${RUNPODCTL:-/usr/local/bin/runpodctl}
VOLUME_ID=7hbjaot7ej            # tw-trellis-cache, EUR-IS-1, 50 GB
DC=EUR-IS-1
IMAGE=runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04
POD_NAME=${POD_NAME:-tw-meshy}
GPU_A100="NVIDIA A100-SXM4-80GB"
GPU_4090="NVIDIA GeForce RTX 4090"
RUN_PREFIX=meshy                     # remote run dir: /workspace/tw-runs/meshy-<folder>

need_key() { : "${RUNPOD_API_KEY:?RUNPOD_API_KEY is not in the environment (do not read credential files; start from a fauna session)}"; }

# RunPod APIs (OPS-441). REST v1 (rest.runpod.io/v1) returns 410 Gone from 2026-11-16, so pods are listed, read and
# deleted through REST v2 (spec: https://api.runpod.io/v2/openapi.json). runpodctl 2.14's `pod get/list/delete` are v1
# and die with it; its `pod create`, `gpu list` and `remove pod` are GraphQL (probed 2026-11-06), which RunPod
# deprecates "early 2027". Both base URLs can be overridden for the mock-API test (RP_API, RP_GQL).
RP_API=${RP_API:-https://api.runpod.io/v2}
RP_GQL=${RP_GQL:-https://api.runpod.io/graphql}

# rp_v2 METHOD PATH [BODYFILE]: one REST v2 call. Backs off exponentially on 429 (RunPod asks for this). Prints the
# HTTP status (000 = no answer); the body goes to BODYFILE, default /dev/null.
rp_v2() {
  need_key; local m=$1 path=$2 out=${3:-/dev/null} code i
  for i in 1 2 3 4 5 6; do
    code=$(curl -s -m 30 -X "$m" -o "$out" -w '%{http_code}' -H "Authorization: Bearer $RUNPOD_API_KEY" "$RP_API$path") || code=${code:-000}
    [[ $code == 429 ]] || break
    sleep $((2 ** i))
  done
  echo "${code:-000}"
}

# account: balance, spend/hr, pods (GraphQL; read-only)
rp_account() {
  need_key
  curl -s -m 30 -H "Authorization: Bearer $RUNPOD_API_KEY" -H "Content-Type: application/json" \
    -d '{"query":"query { myself { clientBalance currentSpendPerHr pods { id name desiredStatus costPerHr } } }"}' \
    "$RP_GQL" | jq -c '.data.myself'
}
rp_balance() { rp_account | jq -r '.clientBalance'; }
# HTTP status of GET pod (raw). To decide whether a pod is gone, use rp_pod_state: v2 can answer a deleted pod with
# 200 + status TERMINATED as well as with 404.
rp_pod_http() { rp_v2 GET "/pods/$1"; }
# rp_pod_get ID: the pod's v2 JSON on stdout, or return 1 (no body printed) when the API doesn't answer 200
rp_pod_get() {
  local f code; f=$(mktemp); code=$(rp_v2 GET "/pods/$1" "$f")
  if [[ $code == 200 ]] && jq -e .id "$f" >/dev/null 2>&1; then cat "$f"; rm -f "$f"; return 0; fi
  rm -f "$f"; echo "rp_pod_get $1: GET -> $code" >&2; return 1
}
# rp_pod_state ID: "gone" (404, or 200 with status TERMINATED) | "present:<STATUS>" | "unknown:<http code>".
# Only "gone" means gone. A 410, a 401, a timeout are "unknown", never "gone" and never "present".
rp_pod_state() {
  local f code st; f=$(mktemp); code=$(rp_v2 GET "/pods/$1" "$f")
  case $code in
    404) echo gone;;
    200) st=$(jq -r '.status // empty' "$f" 2>/dev/null || true)
         if [[ $st == TERMINATED ]]; then echo gone; elif [[ -n $st ]]; then echo "present:$st"; else echo "unknown:200-unparsed"; fi;;
    *) echo "unknown:$code";;
  esac
  rm -f "$f"
}
# rp_pod_delete ID: DELETE through v2; prints the HTTP status (204 = deleted, 404 = already gone). Verify with rp_pod_state.
rp_pod_delete() { rp_v2 DELETE "/pods/$1"; }
# rp_pod_kill ID: v2 DELETE, and if the pod is not then verifiably gone, the GraphQL `runpodctl remove pod` as a second
# road. Prints the final rp_pod_state; returns 0 only when that is "gone".
rp_pod_kill() {
  local st dc
  dc=$(rp_pod_delete "$1"); sleep 6; st=$(rp_pod_state "$1")
  if [[ $st != gone ]]; then
    echo "$(date -Is) v2 DELETE pod $1 -> $dc, state -> $st; trying runpodctl remove pod (GraphQL)" >&2
    "$RUNPODCTL" remove pod "$1" >&2 || true; sleep 10; st=$(rp_pod_state "$1")
  fi
  echo "$st"; [[ $st == gone ]]
}
# rp_pod_list: every pod on the account (all pages) as [{id, name, status, cost, desiredStatus, costPerHr}]; the last two
# are v1-shaped aliases for older callers. If ANY page fails, prints nothing and returns 1: a list we could not read is
# UNKNOWN, never "no pods".
rp_pod_list() {
  local f code cur="" all='[]' page q
  f=$(mktemp)
  for page in $(seq 1 50); do
    q="/pods?limit=1000"; [[ -n $cur ]] && q+="&cursor=$(jq -rn --arg c "$cur" '$c | @uri')"
    code=$(rp_v2 GET "$q" "$f")
    if [[ $code != 200 ]] || ! jq -e '.pods | type == "array"' "$f" >/dev/null 2>&1; then
      echo "rp_pod_list: UNKNOWN (GET /pods -> $code). This is not the same as no pods." >&2; rm -f "$f"; return 1
    fi
    all=$(jq -c --argjson a "$all" '$a + [.pods[] | {id, name, status, cost, desiredStatus: .status, costPerHr: .cost}]' "$f")
    if [[ $(jq -r '.pagination.hasNextPage // false' "$f") != true ]]; then rm -f "$f"; echo "$all"; return 0; fi
    cur=$(jq -r '.pagination.nextCursor // empty' "$f")
    [[ -n $cur ]] || break
  done
  rm -f "$f"; echo "rp_pod_list: UNKNOWN (pagination did not end cleanly)" >&2; return 1
}
# sibling agents run tw-arc / tw-clt / tw-tem / tw-mkt: never ours to touch. Returns 1 when the list is unknown.
rp_our_pods() { local l; l=$(rp_pod_list) || return 1; jq -c --arg n "$POD_NAME" '[.[] | select(.name == $n and .status != "TERMINATED")]' <<<"$l"; }
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
  if [[ $1 == "$(basename "$B")" ]]; then TYPE_DIR=$B; elif [[ -d $1 ]]; then TYPE_DIR=$(cd "$1" && pwd); else TYPE_DIR=$B/$1; fi
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
gate = json.loads((t / "gate-manifest.json").read_text()).get("assets", {}) if (t / "gate-manifest.json").exists() else {}
other = []
import os
for p in sorted((t / "masked").glob("*.png")):
    st = gate.get(p.stem, {}).get("status")
    # EARLY=1 (sprawl): mesh a plate the gate has not judged yet (agy is the bottleneck; a mesh costs cents, an idle pod more);
    # the mesh gate judges the result, and a plate the gate later refuses is re-plated and re-meshed
    if st != "accepted" and not (os.environ.get("EARLY") == "1" and st is None): continue
    if spec.get(p.stem, {}).get("lane", "3d") != "3d": continue
    r = spec.get(p.stem, {}).get("route", "trellis")
    if r == "trellis": print(p.stem)
    else: other.append(f"{p.stem}\t{r}")
(t / "route-other.txt").write_text("".join(o + "\n" for o in other))
PY
}
