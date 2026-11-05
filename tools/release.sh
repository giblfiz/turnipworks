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
#   LIVE MOVES ONLY WHEN HARRY SAYS SO (Harry, 2026-10-22): "going from dev to live needs to be an action that I
#                                          initiate … anything that goes live should be a marked branch so we can easily
#                                          roll back to it." No agent promotes on its own judgement, not at 0 connections,
#                                          not for a "hotfix"; the nightly roll is retired (its timer is disabled and
#                                          `roll` refuses). An agent says "on dev, candidate <id>, awaiting Harry's go".
#   tools/release.sh promote-now --harry [--warn S] [--feature] [ID]   put the candidate (or ID) live: banner 60 s (S) when
#                                          seats are connected, a copy of the campaigns, the swap, the checks, automatic
#                                          rollback on a failed check. --harry is required: run it only on Harry's word, in
#                                          the turn he gave it.
#   VERSIONS (Harry, 2026-11-02): "I'm declaring this to be version 0.3.4. Anything that doesn't get pushed live is not a
#           version. Small numbers for fixes and tweaks, mid numbers for features of some size. Full version is an event we
#           discuss." A release gets its number when promote-now has swapped it in and its checks have passed, never before:
#             promote-now --harry                                     the small number (0.3.4 -> 0.3.5), the default
#             promote-now --harry --feature                           the mid number (0.3.5 -> 0.4.0); the operator chooses
#             promote-now --harry --full-version-event 1.0.0          the full number; only the exact next one is accepted
#           $STATE/versions.log is the append-only ledger: version, release id, git, time. A release keeps its number for
#           good: rollback and a re-promote add no line and use none up, and the next new number is the ledger's highest
#           plus one. The number reaches the page as `version` in the release's release.json (/release.json, no-store, and it
#           follows `current` through a rollback); that field is the one write to a release after it is cut. A release
#           whose page has no version line (0.3.4 and everything before it) keeps its files untouched. Each number is
#           tagged vX.Y.Z on the release's commit and pushed, with the live-<id> tag. Never fails a swap: a number that
#           could not be written or read back is a WARNING in rolls.log, and prod stays as the swap left it.
#   MARKED: every release that goes live (promote-now or rollback) gets git tag live-<release id> on the commit it was
#           cut from, and the branch `live` is moved to that commit; both are pushed to origin. `git log live` is what
#           players have; `git checkout live-<id>` is any earlier one; promote-now <id> brings a kept one back.
#   tools/release.sh rollback [--warn S]   back to the release before the current one (banner 30 s), checked the same way
#   THE PUBLIC MIRROR FOLLOWS LIVE (Harry, 2026-11-01): after every promote-now or rollback that passes its checks, the
#           released commit is exported to the public repo (github.com/giblfiz/turnipworks) through
#           tools/public-export/export.py: excludes, scrub, every gate, tests, push. It runs in the background; the command
#           waits only until the gates have answered, at most TW_PUBLISH_WAIT seconds (300), so a failed gate shows in its
#           output, and the result always lands in rolls.log. A publish failure NEVER fails or rolls back a release: it logs
#           a WARNING, the mirror stays as it was, and `status` keeps saying so until a publish succeeds.
#   tools/release.sh publish-public [ID]   that same publish, by hand, of the live release (ID must be it: a candidate is
#                                          never published). Repeat it after fixing what a failed publish reported.
#           Test without touching anything real: TW_PUBLIC_REMOTE=<bare repo> instead of the mirror; TW_PUBLISH_FAIL_GATE=1
#           plants a file that trips the real privacy gate (a planted run can never publish).
#   tools/release.sh verify                prod's checks now; changes nothing
#   tools/release.sh status | list
#
# Every roll / promote / rollback is one line in $STATE/rolls.log, candidates one line in $STATE/candidates.log,
# details in $STATE/logs/. No mail, no page: silence is the default (read the log).
# tw-release-roll.timer (the old nightly roll) is disabled since 2026-10-22; do not re-enable it.
set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$TOOLS")"
STATE="${TW_RELEASES:-/var/lib/tw-releases}"
MAIN="${TW_MAIN:-$TW_REPO}"
DEV_WEB="${TW_DEV_WEB:-/var/www/implausible-landing/projects/turnip-works}"
PROD_PORT="${TW_PROD_PORT:-8097}" PROD_UNIT="${TW_PROD_UNIT:-tw-relay}" PROD_HOST=turnipworks.net DEV_PORT=8098
PROD_DATA="${TW_PROD_DATA:-$MAIN/engine/data}"
KEEP="${TW_RELEASE_KEEP:-5}"   # promoted releases kept for rollback (plus current, previous, candidate)
VERIFY="${TW_RELEASE_VERIFY:-$REPO/engine/tools/release_verify.mjs}"
ROLL_LOCK="${TW_RELEASE_LOCK:-/tmp/tw-release-roll.lock}"
PUBLIC_REMOTE="${TW_PUBLIC_REMOTE:-https://github.com/giblfiz/turnipworks.git}"
PUBLISH_WAIT="${TW_PUBLISH_WAIT:-300}"   # the most a promote or rollback waits for the mirror's gates to answer
EXPORT="$MAIN/tools/public-export/export.py"
LEDGER="$STATE/versions.log"
mkdir -p "$STATE/releases" "$STATE/logs"
touch "$STATE/rolls.log" "$STATE/candidates.log" "$STATE/promoted.list" "$STATE/rejected" "$STATE/public-mirror.log" "$LEDGER"

now() { date -Iseconds; }
roll_log() { printf '%s\t%s\n' "$(now)" "$*" >> "$STATE/rolls.log"; echo "$*"; }
link_id() { [[ -L "$STATE/$1" ]] && basename "$(readlink "$STATE/$1")" || true; }
set_link() { ln -sfn "releases/$2" "$STATE/.$1.tmp" && mv -Tf "$STATE/.$1.tmp" "$STATE/$1"; }
health() { curl -s --max-time 5 "http://127.0.0.1:$1/health" || true; }
conns() { health "$PROD_PORT" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("conns", 0))
except Exception: print(0)'; }
jget() { python3 -c 'import sys,json; print(json.load(open(sys.argv[1])).get(sys.argv[2], ""))' "$1" "$2"; }
# mark_live <release id>: tag live-<id> on the release's commit, move branch `live` there, push both (Harry, 2026-10-22).
# Never fails the swap: a marking problem is logged and said, and prod stays as the swap left it.
mark_live() {
  local id=$1 sha; sha=$(jget "$STATE/releases/$id/release.json" git)
  [[ -n "$sha" ]] || { roll_log "mark: $id has no git commit in release.json; not marked"; return 0; }
  local G=(git -C "$MAIN") P=(env GH_CONFIG_DIR=$HOME/.config/gh git -C "$MAIN")
  local ver vtag=() what="tag live-$id + branch live"; ver=$(version_of "$id")
  "${G[@]}" rev-parse -q --verify "refs/tags/live-$id" >/dev/null || "${G[@]}" tag -a "live-$id" "$sha" -m "live on turnipworks.net from $(now) (release $id)" || true
  if [[ -n "$ver" ]]; then
    "${G[@]}" rev-parse -q --verify "refs/tags/v$ver" >/dev/null || "${G[@]}" tag -a "v$ver" "$sha" -m "Turnip Works $ver (release $id)" || true
    vtag=("refs/tags/v$ver"); what="tags live-$id, v$ver + branch live"
  fi
  "${G[@]}" update-ref refs/heads/live "$sha" || true
  if "${P[@]}" push -q origin "refs/tags/live-$id" "${vtag[@]}" "+refs/heads/live:refs/heads/live" 2>&1; then
    roll_log "marked: $what -> ${sha:0:8} (pushed)"
  else
    roll_log "marked locally: $what -> ${sha:0:8}; PUSH FAILED (push them by hand)"
  fi
}

# ---------- version numbers (usage header, VERSIONS) ----------
version_of() { awk -F'\t' -v id="$1" '$2 == id { print $1; exit }' "$LEDGER"; }
top_version() { awk -F'\t' '$1 ~ /^[0-9]+\.[0-9]+\.[0-9]+$/ { print $1 }' "$LEDGER" | sort -V | tail -n 1; }
next_version() { # <small|feature|full>
  local a b c; IFS=. read -r a b c <<< "$(top_version)"
  case $1 in feature) echo "$a.$((b + 1)).0" ;; full) echo "$((a + 1)).0.0" ;; *) echo "$a.$b.$((c + 1))" ;; esac
}
# check_number <id> <small|feature|full> <the full number as typed>: the operator's choice, before anything moves
check_number() {
  local have; have=$(version_of "$1")
  if [[ -n "$have" ]]; then
    [[ "$2" == small ]] || { echo "REFUSED: $1 is already v$have and a release keeps its number: leave out --feature / --full-version-event"; return 1; }
    return 0
  fi
  [[ -n "$(top_version)" ]] || { echo "REFUSED: the version ledger $LEDGER has no numbers in it, so the next one is unknown. Restore it first."; return 1; }
  [[ "$2" != full || "$3" == "$(next_version full)" ]] || { echo "REFUSED: a full version is an event Harry and Fauna discuss. If this is it: --full-version-event $(next_version full)"; return 1; }
}
# stamp_release <id> <version>: `version` in the release's own release.json, swapped in whole
stamp_release() {
  local dir="$STATE/releases/$1"
  [[ "$(jget "$dir/release.json" version)" != "$2" ]] || return 0
  grep -q 'id="twl-ver"' "$dir/engine/client/index.turnipworks.html" 2>/dev/null || return 0
  python3 - "$dir/release.json" "$2" <<'PY'
import json, os, sys
path, version = sys.argv[1:]
release = json.load(open(path)); release['version'] = version
with open(path + '.tmp', 'w') as f: json.dump(release, f, indent=1)
os.chmod(path + '.tmp', 0o644); os.replace(path + '.tmp', path)
PY
}
# number_release <id> <small|feature|full, or empty for a rollback>: after a swap has passed its checks, so a failed
# promote leaves no trace. The ledger line comes first: a line without a stamp is repaired by the next swap to that release;
# a stamp without a line would hand the same number out twice.
number_release() {
  local id=$1 bump=$2 v res sha
  v=$(version_of "$id")
  if [[ -z "$v" && -n "$bump" ]]; then
    v=$(next_version "$bump"); sha=$(jget "$STATE/releases/$id/release.json" git)
    printf '%s\t%s\t%s\t%s\n' "$v" "$id" "$sha" "$(now)" >> "$LEDGER" || return 1
    roll_log "version: $id is v$v"
  fi
  [[ -z "$v" ]] || stamp_release "$id" "$v" || return 1
  res=$(node "$VERIFY" number --want "$v" --host "$PROD_HOST") || roll_log "WARNING: VERSION NOT CONFIRMED on the page for $id: $res"
}

# ---------- the public mirror ----------
# publish_public <release id> <why>: export the release's commit to the public repo. Exit 0 = the mirror is on it (or it
# stood down because live moved on); anything else = the mirror is untouched and a WARNING is in rolls.log. Every gate runs
# on every publish, and there is no way to skip one from here.
mirror_record() { printf '%s\t%s\t%s\t%s\t%s\n' "$(now)" "$1" "${2:0:8}" "$3" "$4" >> "$STATE/public-mirror.log"; }
mirror_fail() { # <id> <sha> <reason> <log>
  mirror_record "$1" "$2" FAILED "$3"
  roll_log "WARNING: PUBLIC MIRROR NOT UPDATED for $1 (git ${2:0:8}): $3. The mirror is untouched and the release stands. Fix it, then tools/release.sh publish-public (log $(basename "$4"))"
}
publish_failure() { # <export out dir>: why it failed, counts only (the hits themselves are private and stay in the log)
  python3 - "$1" <<'PY'
import json, sys
try: rep = json.load(open(sys.argv[1] + '/export-report.json'))
except Exception: print('the export stopped before its gates'); sys.exit()
g, t = rep['gates'], rep.get('tests') or {}
bad = [k for k, v in t.items() if v['rc'] and v.get('baseline_rc', 0) == 0]
if not g['ok']: print(f"PRIVACY GATE FAILED: structure {g['structure']}, deny {g['deny']}, gitleaks {g['gitleaks']}, trufflehog {g['trufflehog']}")
elif bad: print(f"tests failed on the export: {', '.join(bad)[:200]}")
else: print('the gates passed but the commit or push failed')
PY
}
publish_public() {
  local id=$1 why=$2 sha out log res commit
  sha=$(jget "$STATE/releases/$id/release.json" git 2>/dev/null || true)
  log="${TW_PUBLISH_LOG:-$STATE/logs/$(date +%Y%m%d-%H%M%S)-publish-public.log}"
  [[ -n "$sha" ]] || { mirror_fail "$id" "" "its release.json has no git commit" "$log"; return 1; }
  exec 8>"$STATE/.publish.lock"; flock 8
  # queued behind another publish while live moved again: the release now live has its own publish, and it must land last
  if [[ "$id" != "$(link_id current)" ]]; then roll_log "public mirror: $id is no longer live; left to the publish of $(link_id current)"; return 0; fi
  out=$(mktemp -d /tmp/tw-public-export.XXXXXX)
  if ! python3 "$EXPORT" publish --ref "$sha" --remote "$PUBLIC_REMOTE" --out "$out" --test --push -m "Live release $id ($why)." > "$log" 2>&1 || [[ ! -s "$out/publish-result.json" ]]; then
    res=$(publish_failure "$out"); cp "$out/export-report.json" "${log%.log}.report.json" 2>/dev/null || true
    rm -rf "$out"; mirror_fail "$id" "$sha" "$res" "$log"; return 1
  fi
  cp "$out/export-report.json" "${log%.log}.report.json" 2>/dev/null || true
  res=$(python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(r["public_commit"][:10], "unchanged" if r["unchanged"] else "pushed", r["files"])' "$out/publish-result.json")
  rm -rf "$out"
  read -r commit res why <<< "$res"
  mirror_record "$id" "$sha" "$res" "$commit"
  roll_log "public mirror OK: $id (git ${sha:0:8}) -> $commit ($res, $why files; log $(basename "$log"))"
}
# publish_public_bg <release id> <what>: after a swap has passed. Detached from this command and from the roll lock, so a
# slow publish holds up neither the terminal for long nor the next rollback. Always returns 0.
publish_public_bg() {
  local id=$1 what=$2 pid i log="$STATE/logs/$(date +%Y%m%d-%H%M%S)-publish-public.log"
  exec 7>&-
  roll_log "public mirror: publishing $id in the background (waiting for the gates, at most ${PUBLISH_WAIT} s; the result lands in rolls.log either way)"
  TW_PUBLISH_LOG="$log" setsid nohup "$TOOLS/release.sh" publish-public "$id" "$what" </dev/null >>"$STATE/logs/publish-public-bg.log" 2>&1 &
  pid=$!
  for (( i = 0; i < PUBLISH_WAIT; i++ )); do
    kill -0 "$pid" 2>/dev/null || break
    if grep -q "gates: .*'ok': True" "$log" 2>/dev/null; then echo "public mirror: the gates passed; the tests and the push go on in the background (tools/release.sh status tells)"; return 0; fi
    sleep 1
  done
  if kill -0 "$pid" 2>/dev/null; then echo "public mirror: the gates have not answered yet; still publishing in the background (tools/release.sh status tells)"; return 0; fi
  wait "$pid" 2>/dev/null || true
  tail -n 1 "$STATE/rolls.log" | cut -f2- || true
}
mirror_status() {
  local last good
  last=$(tail -n 1 "$STATE/public-mirror.log"); good=$(awk -F'\t' '$4 != "FAILED" { g = $2 } END { print g }' "$STATE/public-mirror.log")
  echo "public mirror: ${last:-never published by this script} (fields: time, release, git, result, public commit or reason)"
  flock -n "$STATE/.publish.lock" true 2>/dev/null || echo "public mirror: a publish is running now"
  [[ "$good" == "$(link_id current)" ]] || echo "WARNING: the public mirror is not on the live release $(link_id current) (last published: ${good:-none}); tools/release.sh publish-public"
}
cmd_publish_public() {
  local id=${1:-$(link_id current)} why=${2:-by hand}
  [[ -n "$id" && -d "$STATE/releases/$id" ]] || { echo "no such release: '$id' (tools/release.sh list)"; exit 1; }
  [[ "$id" == "$(link_id current)" ]] || { echo "REFUSED: the mirror follows live, and $id is not live ($(link_id current) is)"; exit 1; }
  publish_public "$id" "$why"
}

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
  echo "prod is $(link_id current); the candidate goes live only on Harry's word (tools/release.sh promote-now --harry)"
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
run_verify() { # run_verify <id> [--number <ledger's number>] → prints the JSON line, exit status = verified
  local id=$1; shift
  node "$VERIFY" verify --release "$STATE/releases/$id" --port "$PROD_PORT" --host "$PROD_HOST" "$@"
}

# ---------- roll / promote-now / rollback: one road ----------
# swap_to <target id> <warn seconds> <what> <banner word> [<small|feature|full>: number it if it has no number yet]
swap_to() {
  local target=$1 warn=$2 what=$3 word=$4 bump=${5:-}
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
    0) number_release "$target" "$bump" || roll_log "WARNING: VERSION NOT RECORDED for $target (live is fine; read the ledger $LEDGER)"
       mark_live "$target"
       roll_log "$what OK: $cur -> $target ($(grep -m1 'connections:' "$log" | sed -E 's/^[^ ]+ //' | cut -c1-80); log $(basename "$log"))" ;;
    1) roll_log "$what FAILED VERIFY, ROLLED BACK: $cur -> $target -> $cur (why: $why; log $(basename "$log"))"
       [[ "$what" == rollback ]] || printf '%s\t%s\t%s\n' "$target" "$(now)" "$why" >> "$STATE/rejected" ;;
    3) roll_log "$what ABORTED before the swap: the copy of the campaigns failed (log $(basename "$log"))" ;;
    *) roll_log "$what FAILED (exit $rc), prod may be down: read $log" ;;
  esac
  prune >/dev/null || true
  tail -n 4 "$log"
  [[ $rc -ne 0 ]] || publish_public_bg "$target" "$what" || true   # after the swap, the checks and the mark; never its verdict
  return $rc
}

cmd_roll() {
  # retired 2026-10-22: live moves only on Harry's word (promote-now --harry). Kept so a stray timer firing is harmless.
  roll_log "roll: refused (the nightly roll is retired; live moves only by promote-now --harry). candidate $(link_id candidate), prod $(link_id current)"
  return 0
}
cmd_promote_now() {
  exec 7>"$ROLL_LOCK"; flock -n 7 || { echo "a roll is running"; exit 1; }
  local warn=60 target="" harry="" bump=small full="" feature=""
  while [[ $# -gt 0 ]]; do case "$1" in --warn) warn=$2; shift 2;; --harry) harry=1; shift;; --feature) feature=1; bump=feature; shift;; --full-version-event) full=$2; bump=full; shift 2;; *) target=$1; shift;; esac; done
  if [[ -z "$harry" ]]; then
    echo "REFUSED: live moves only when Harry initiates it (2026-10-22). On his word: tools/release.sh promote-now --harry [ID]"
    echo "candidate $(link_id candidate), prod $(link_id current)"; exit 1
  fi
  target=${target:-$(link_id candidate)}
  [[ -n "$target" && -d "$STATE/releases/$target" ]] || { echo "no such release: '$target' (tools/release.sh list)"; exit 1; }
  [[ "$target" != "$(link_id current)" ]] || { echo "$target is already prod"; exit 0; }
  [[ -z "$feature" || "$bump" != full ]] || { echo "REFUSED: --feature or --full-version-event, not both"; exit 1; }
  check_number "$target" "$bump" "$full" || exit 1
  local ver; ver=$(version_of "$target")
  if [[ -n "$ver" ]]; then echo "$target keeps v$ver"; else echo "$target becomes v$(next_version "$bump") once its checks pass"; fi
  swap_to "$target" "$warn" promote-now updating "$bump"
}
cmd_rollback() {
  exec 7>"$ROLL_LOCK"; flock -n 7 || { echo "a roll is running"; exit 1; }
  local warn=30; [[ "${1:-}" == --warn ]] && warn=$2
  local prev; prev=$(link_id previous)
  [[ -n "$prev" && -d "$STATE/releases/$prev" ]] || { echo "no previous release to roll back to"; exit 1; }
  swap_to "$prev" "$warn" rollback restarting
}

version_label() { local v; v=$(version_of "$1"); if [[ -n "$v" ]]; then echo "v$v"; else echo "no number"; fi; }
cmd_status() {
  local r
  for r in current previous candidate; do
    local id; id=$(link_id "$r")
    if [[ -n "$id" ]]; then printf '%-9s %s  (%s, git %s, client %s, tuner %s)\n' "$r" "$id" "$(version_label "$id")" "$(jget "$STATE/releases/$id/release.json" git | cut -c1-8)" "$(jget "$STATE/releases/$id/release.json" client)" "$(jget "$STATE/releases/$id/release.json" tuner)"; else printf '%-9s -\n' "$r"; fi
  done
  if [[ -n "$(top_version)" ]]; then echo "live version: $(version_label "$(link_id current)") (next promote v$(next_version small), --feature v$(next_version feature); ledger $LEDGER)"
  else echo "WARNING: live version unknown: the ledger $LEDGER has no numbers in it"; fi
  echo "prod relay :$PROD_PORT $(health "$PROD_PORT")"
  echo "dev relay  :$DEV_PORT $(health "$DEV_PORT")"
  echo "dev serves client $(grep -oE "TW_V = '[0-9]+'" "$DEV_WEB/engine/client/index.turnipworks.html" | grep -oE '[0-9]+'), tuner $(jget "$DEV_WEB/tuner/version.json" v)"
  echo "live moves only on Harry's word: tools/release.sh promote-now --harry (branch live = $(git -C "$MAIN" rev-parse --short live 2>/dev/null || echo none))"
  mirror_status
  echo "last rolls ($STATE/rolls.log):"; tail -n 5 "$STATE/rolls.log" | sed 's/^/  /'
  [[ -s "$STATE/rejected" ]] && { echo "rejected candidates:"; tail -n 3 "$STATE/rejected" | sed 's/^/  /'; }
  return 0
}
cmd_list() { ls -1 "$STATE/releases" | while read -r id; do printf '%s  %s  %s\n' "$id" "$(version_label "$id")" "$(cat "$STATE/releases/$id/release.json" | tr -d '\n ' | cut -c1-160)"; done; }

case "${1:-}" in
  candidate) shift; cmd_candidate "$@" ;;
  roll) cmd_roll ;;
  promote-now) shift; cmd_promote_now "$@" ;;
  rollback) shift; cmd_rollback "$@" ;;
  verify) id=$(link_id current); res=$(run_verify "$id" --number "$(version_of "$id")") && { echo "prod $id verified: $res"; } || { echo "prod $id NOT verified: $res"; exit 1; } ;;
  status) cmd_status ;;
  list) cmd_list ;;
  mark) shift; mark_live "${1:-$(link_id current)}" ;;
  publish-public) shift; cmd_publish_public "$@" ;;
  *) sed -n '2,56p' "$0"; exit 2 ;;
esac
