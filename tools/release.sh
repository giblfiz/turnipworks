#!/usr/bin/env bash
# PROD RELEASES for https://turnipworks.net/ (2026-10-19; docs/NETCODE.md "Two servers"). Harry: "On the main server we
# have scheduled downtime in the middle of the night, and we roll it over to whatever the current fully deployed build
# is. And then we just have a URL like dev.turnipworks.net that we roll over whenever we need to."
#
# Agents deploy to DEV (engine/deploy.sh, tools/spawn-tuner/deploy.sh: dev.turnipworks.net, relay tw-relay-dev :8098).
# Prod serves a pinned RELEASE: a snapshot of the dev client + core, the relay code (git HEAD of main) and the tuner
# files the game imports (js/, data/, assets/ hard-linked, version.json), kept in $STATE/releases/<id>/. Prod's
# campaigns stay where they are (engine/data of the main checkout; the hourly backups cover it).
#
#   tools/release.sh candidate             snapshot what dev serves now as a release and mark it the candidate. A landing
#                                          script runs it after its suites pass and its dev deploy, inside the landing
#                                          lock (TW_LOCK_HELD=1; without it the script takes /tmp/tw-main.lock itself).
#                                          It refuses when the dev relay is down or the snapshot's own relay cannot start.
#   tools/release.sh roll                  THE NIGHTLY ROLL (tw-release-roll.timer: fires 03:25, swaps at 03:30
#                                          America/Los_Angeles). Candidate = current, or a rejected one: nothing.
#                                          Otherwise: a 5-minute banner on every seat ("Server updating at 3:30, back in
#                                          a minute"; no seat connected: no wait), a copy of the campaigns, the swap, a
#                                          prod relay restart, the checks (engine/tools/release_verify.mjs verify). A
#                                          failed check rolls back to the release before by itself and marks the
#                                          candidate rejected (it is never tried again; the next candidate is).
#   tools/release.sh promote-now [--warn S] [ID]   the same now, for a hotfix: banner 60 s (S), the candidate or ID,
#                                          even a rejected one.
#   tools/release.sh rollback [--warn S]   back to the release before the current one (banner 30 s), checked the same way
#   tools/release.sh verify                prod's checks now; changes nothing
#   tools/release.sh status | list
#
# Every roll / promote / rollback is one line in $STATE/rolls.log, candidates one line in $STATE/candidates.log,
# details in $STATE/logs/. No mail, no page: silence is the default (read the log).
# The roll time: /etc/systemd/system/tw-release-roll.timer (OnCalendar; the banner text follows the clock).
set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$TOOLS")"
STATE="${TW_RELEASES:-/var/lib/tw-releases}"
MAIN="${TW_MAIN:-$TW_REPO}"
DEV_WEB="${TW_DEV_WEB:-/var/www/implausible-landing/projects/turnip-works}"
PROD_PORT=8097 PROD_UNIT=tw-relay PROD_HOST=turnipworks.net DEV_PORT=8098
PROD_DATA="${TW_PROD_DATA:-$MAIN/engine/data}"
KEEP="${TW_RELEASE_KEEP:-5}"   # promoted releases kept for rollback (plus current, previous, candidate)
VERIFY="$REPO/engine/tools/release_verify.mjs"
mkdir -p "$STATE/releases" "$STATE/logs"
touch "$STATE/rolls.log" "$STATE/candidates.log" "$STATE/promoted.list" "$STATE/rejected"

now() { date -Iseconds; }
roll_log() { printf '%s\t%s\n' "$(now)" "$*" >> "$STATE/rolls.log"; echo "$*"; }
link_id() { [[ -L "$STATE/$1" ]] && basename "$(readlink "$STATE/$1")" || true; }
set_link() { ln -sfn "releases/$2" "$STATE/.$1.tmp" && mv -Tf "$STATE/.$1.tmp" "$STATE/$1"; }
health() { curl -s --max-time 5 "http://127.0.0.1:$1/health" || true; }
conns() { health "$PROD_PORT" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("conns", 0))
except Exception: print(0)'; }
jget() { python3 -c 'import sys,json; print(json.load(open(sys.argv[1])).get(sys.argv[2], ""))' "$1" "$2"; }

prune() {
  local keep=" $(link_id current) $(link_id previous) $(link_id candidate) $(cat "$STATE/rolling" 2>/dev/null || true) "
  keep+=" $(tac "$STATE/promoted.list" | awk '!seen[$0]++' | head -n "$KEEP" | tr '\n' ' ') "
  local d n
  for d in "$STATE"/releases/*/; do
    n=$(basename "$d")
    [[ "$keep" == *" $n "* ]] && continue
    rm -rf "$d" && echo "pruned release $n"
  done
  find "$STATE/releases" -maxdepth 1 -name '.*.part' -mmin +60 -exec rm -rf {} + 2>/dev/null || true
}

# ---------- candidate ----------
cmd_candidate() {
  if [[ "${TW_LOCK_HELD:-}" != 1 ]]; then exec env TW_LOCK_HELD=1 flock /tmp/tw-main.lock "$0" candidate "$@"; fi
  local h; h=$(health "$DEV_PORT")
  [[ "$h" == *'"ok":true'* ]] || { echo "NOT A CANDIDATE: the dev relay (:$DEV_PORT) is not answering (a broken dev deploy is never promoted): $h"; exit 1; }
  local page="$DEV_WEB/engine/client/index.turnipworks.html"
  local V TV SHA SHORT ID TMP
  V=$(grep -oE "TW_V = '[0-9]+'" "$page" | grep -oE '[0-9]+') || { echo "NOT A CANDIDATE: no client stamp in $page"; exit 1; }
  TV=$(jget "$DEV_WEB/tuner/version.json" v)
  [[ -n "$TV" ]] || { echo "NOT A CANDIDATE: no tuner version.json in the dev tree"; exit 1; }
  SHA=$(git -C "$MAIN" rev-parse HEAD); SHORT=${SHA:0:8}
  if [[ -n "$(git -C "$MAIN" status --porcelain -- engine/relay engine/core)" ]]; then
    echo "warning: the main checkout has uncommitted changes in engine/relay or engine/core; the release takes the committed $SHORT"
  fi
  ID="$(date +%Y%m%d-%H%M%S)-$SHORT"
  TMP="$STATE/releases/.$ID.part"
  rm -rf "$TMP"; mkdir -p "$TMP/tuner" "$TMP/app"
  trap 'rm -rf "$TMP"' EXIT
  rsync -a "$DEV_WEB/engine/" "$TMP/engine/"
  sed -i -E 's#<meta name="tw-channel" content="[a-z]+">#<meta name="tw-channel" content="prod">#' "$TMP/engine/client/index.turnipworks.html" "$TMP/engine/client/index.html"
  rsync -a "$DEV_WEB/tuner/js" "$DEV_WEB/tuner/data" "$TMP/tuner/"
  cp -p "$DEV_WEB/tuner/version.json" "$TMP/tuner/version.json"
  # the meshes and pictures (11 GB): hard links, not copies. A deploy replaces a file (rsync writes a new one and
  # renames it), so a link keeps the old bytes for the release. Never edit a deployed asset in place.
  cp -al "$DEV_WEB/tuner/assets" "$TMP/tuner/assets"
  git -C "$MAIN" archive "$SHA" engine/relay engine/core engine/package.json | tar -x -C "$TMP/app" --strip-components=1
  cp -a "$MAIN/engine/node_modules" "$TMP/app/node_modules"
  python3 - "$TMP/release.json" "$ID" "$SHA" "$V" "$TV" <<'PY'
import json, sys, datetime, getpass
out, id_, sha, v, tv = sys.argv[1:]
json.dump({"id": id_, "git": sha, "client": v, "tuner": tv, "made": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "by": getpass.getuser()}, open(out, "w"), indent=1)
PY
  cp "$TMP/release.json" "$TMP/app/release.json"
  find "$TMP/engine" "$TMP/tuner/js" "$TMP/tuner/data" "$TMP/app" -type d -exec chmod 755 {} +
  find "$TMP/engine" "$TMP/tuner/js" "$TMP/tuner/data" "$TMP/app" "$TMP/release.json" "$TMP/tuner/version.json" -type f -exec chmod 644 {} +
  chmod 755 "$TMP" "$TMP/tuner"
  # the release's own relay must start on its own files and seat a player (a throwaway relay; nothing live touched)
  local sp; sp=$(node "$VERIFY" spawn --release "$TMP") || { echo "NOT A CANDIDATE: the release's relay did not start and seat a player: $sp"; exit 1; }
  mv "$TMP" "$STATE/releases/$ID"; trap - EXIT
  set_link candidate "$ID"
  printf '%s\tcandidate %s (git %s, client %s, tuner %s)\n' "$(now)" "$ID" "$SHORT" "$V" "$TV" >> "$STATE/candidates.log"
  echo "release candidate $ID (git $SHORT, client $V, tuner $TV; own relay: $sp)"
  echo "prod is $(link_id current); the nightly roll promotes the candidate (tools/release.sh status)"
  prune
}

# ---------- the banner ----------
notice() { # notice <text> <at ms> <until ms>  (or: notice --clear)
  local key; key=$(cat "$PROD_DATA/admin-key" 2>/dev/null || true)
  local body
  if [[ "$1" == --clear ]]; then body='{"clear":true}'; else body=$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "at": int(sys.argv[2]), "until": int(sys.argv[3])}))' "$1" "$2" "$3"); fi
  curl -s --max-time 5 -X POST -H "x-tw-admin: $key" -H 'content-type: application/json' --data "$body" "http://127.0.0.1:$PROD_PORT/admin/notice" || echo '{"ok":false,"why":"no answer"}'
}

restart_prod() {
  sudo systemctl restart "$PROD_UNIT"
  local i
  for i in $(seq 1 150); do [[ "$(health "$PROD_PORT")" == *'"ok":true'* ]] && return 0; sleep 0.2; done
  return 1
}
run_verify() { # run_verify <id> → prints the JSON line, exit status = verified
  node "$VERIFY" verify --release "$STATE/releases/$1" --port "$PROD_PORT" --host "$PROD_HOST"
}

# ---------- roll / promote-now / rollback: one road ----------
# swap_to <target id> <warn seconds> <what> <banner word>
swap_to() {
  local target=$1 warn=$2 what=$3 word=$4
  local cur prev log c at_s at until res
  cur=$(link_id current); prev=$(link_id previous)
  log="$STATE/logs/$(date +%Y%m%d-%H%M%S)-$what.log"
  echo "$target" > "$STATE/rolling"
  (
    echo "$(now) $what: $cur -> $target (warn ${warn}s)"
    c=$(conns)
    if [[ "$c" -gt 0 && "$warn" -gt 0 ]]; then
      at_s=$(( $(date +%s) + warn ))
      at=$(( at_s * 1000 )); until=$(( at + 120000 ))
      echo "$(now) $c connections: banner: $(notice "Server $word at $(date -d "@$at_s" +%-l:%M), back in a minute" "$at" "$until")"
      sleep $(( at_s - $(date +%s) > 0 ? at_s - $(date +%s) : 0 ))
    else
      echo "$(now) $c connections: no banner, no wait"
    fi
    # a copy of every saved campaign first (2026-10-06): no copy, no restart
    if ! DATA_DIR="$PROD_DATA" "$MAIN/engine/tools/backup_data.sh" "$what-$target"; then
      echo "$(now) the copy of the campaigns failed: nothing changed"; notice --clear >/dev/null; exit 3
    fi
    [[ -n "$cur" ]] && set_link previous "$cur"
    set_link current "$target"
    echo "$target" >> "$STATE/promoted.list"
    restart_prod && echo "$(now) prod relay up: $(health "$PROD_PORT")" || echo "$(now) prod relay NOT answering after the restart"
    if res=$(run_verify "$target"); then
      echo "$(now) verified: $res"; exit 0
    fi
    echo "$(now) VERIFY FAILED: $res"
    [[ -n "$cur" ]] || { echo "$(now) nothing to roll back to"; exit 4; }
    set_link current "$cur"
    if [[ -n "$prev" ]]; then set_link previous "$prev"; else rm -f "$STATE/previous"; fi
    restart_prod || true
    if back=$(env -u TW_RELEASE_FAIL_VERIFY node "$VERIFY" verify --release "$STATE/releases/$cur" --port "$PROD_PORT" --host "$PROD_HOST"); then
      echo "$(now) rolled back to $cur, verified: $back"; exit 1
    fi
    echo "$(now) rolled back to $cur and ITS CHECK FAILED TOO: $back"; exit 2
  ) > "$log" 2>&1 && rc=0 || rc=$?
  rm -f "$STATE/rolling"
  local why; why=$(grep -m1 'VERIFY FAILED' "$log" | sed -E 's/.*"failed":\[([^]]*)\].*/\1/' | cut -c1-300 || true)
  case $rc in
    0) roll_log "$what OK: $cur -> $target ($(grep -m1 'connections:' "$log" | sed -E 's/^[^ ]+ //' | cut -c1-80); log $(basename "$log"))" ;;
    1) roll_log "$what FAILED VERIFY, ROLLED BACK: $cur -> $target -> $cur (why: $why; log $(basename "$log"))"
       [[ "$what" == rollback ]] || printf '%s\t%s\t%s\n' "$target" "$(now)" "$why" >> "$STATE/rejected" ;;
    3) roll_log "$what ABORTED before the swap: the copy of the campaigns failed (log $(basename "$log"))" ;;
    *) roll_log "$what FAILED (exit $rc), prod may be down: read $log" ;;
  esac
  prune >/dev/null || true
  tail -n 4 "$log"
  return $rc
}

cmd_roll() {
  exec 7>/tmp/tw-release-roll.lock; flock -n 7 || { echo "another roll is running"; exit 0; }
  local cand cur; cand=$(link_id candidate); cur=$(link_id current)
  if [[ -z "$cand" ]]; then roll_log "roll: no candidate"; return 0; fi
  if [[ "$cand" == "$cur" ]]; then roll_log "roll: nothing to do (prod is $cur, the candidate)"; return 0; fi
  if cut -f1 "$STATE/rejected" | grep -qx "$cand"; then roll_log "roll: candidate $cand was rejected ($(grep -m1 "^$cand" "$STATE/rejected" | cut -f2-)); prod stays $cur"; return 0; fi
  swap_to "$cand" "${TW_ROLL_WARN:-300}" roll updating
}
cmd_promote_now() {
  exec 7>/tmp/tw-release-roll.lock; flock -n 7 || { echo "a roll is running"; exit 1; }
  local warn=60 target=""
  while [[ $# -gt 0 ]]; do case "$1" in --warn) warn=$2; shift 2;; *) target=$1; shift;; esac; done
  target=${target:-$(link_id candidate)}
  [[ -n "$target" && -d "$STATE/releases/$target" ]] || { echo "no such release: '$target' (tools/release.sh list)"; exit 1; }
  [[ "$target" != "$(link_id current)" ]] || { echo "$target is already prod"; exit 0; }
  swap_to "$target" "$warn" promote-now updating
}
cmd_rollback() {
  exec 7>/tmp/tw-release-roll.lock; flock -n 7 || { echo "a roll is running"; exit 1; }
  local warn=30; [[ "${1:-}" == --warn ]] && warn=$2
  local prev; prev=$(link_id previous)
  [[ -n "$prev" && -d "$STATE/releases/$prev" ]] || { echo "no previous release to roll back to"; exit 1; }
  swap_to "$prev" "$warn" rollback restarting
}

cmd_status() {
  local r
  for r in current previous candidate; do
    local id; id=$(link_id "$r")
    if [[ -n "$id" ]]; then printf '%-9s %s  (git %s, client %s, tuner %s)\n' "$r" "$id" "$(jget "$STATE/releases/$id/release.json" git | cut -c1-8)" "$(jget "$STATE/releases/$id/release.json" client)" "$(jget "$STATE/releases/$id/release.json" tuner)"; else printf '%-9s -\n' "$r"; fi
  done
  echo "prod relay :$PROD_PORT $(health "$PROD_PORT")"
  echo "dev relay  :$DEV_PORT $(health "$DEV_PORT")"
  echo "dev serves client $(grep -oE "TW_V = '[0-9]+'" "$DEV_WEB/engine/client/index.turnipworks.html" | grep -oE '[0-9]+'), tuner $(jget "$DEV_WEB/tuner/version.json" v)"
  systemctl list-timers tw-release-roll.timer --no-pager 2>/dev/null | sed -n 2p | sed 's/^/next roll: /' || true
  echo "last rolls ($STATE/rolls.log):"; tail -n 5 "$STATE/rolls.log" | sed 's/^/  /'
  [[ -s "$STATE/rejected" ]] && { echo "rejected candidates:"; tail -n 3 "$STATE/rejected" | sed 's/^/  /'; }
  return 0
}
cmd_list() { ls -1 "$STATE/releases" | while read -r id; do printf '%s  %s\n' "$id" "$(cat "$STATE/releases/$id/release.json" | tr -d '\n ' | cut -c1-160)"; done; }

case "${1:-}" in
  candidate) shift; cmd_candidate "$@" ;;
  roll) cmd_roll ;;
  promote-now) shift; cmd_promote_now "$@" ;;
  rollback) shift; cmd_rollback "$@" ;;
  verify) id=$(link_id current); res=$(run_verify "$id") && { echo "prod $id verified: $res"; } || { echo "prod $id NOT verified: $res"; exit 1; } ;;
  status) cmd_status ;;
  list) cmd_list ;;
  *) sed -n '2,30p' "$0"; exit 2 ;;
esac
