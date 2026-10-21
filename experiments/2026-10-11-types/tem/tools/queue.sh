#!/usr/bin/env bash
# The plate queue: runs tools/gen.py over the steps in B/queue.txt, one after another, logging to B/queue.log.
#   B/queue.txt   one step per line:  TYPE GROUP [extra gen.py arguments]      (# comments; append lines while it runs)
#       crypt p1
#       crypt sib1
#       castle p1 --prio 1
#   tools/queue.sh            run until no step is left          FOLLOW=1 tools/queue.sh   keep waiting for new lines
#   nohup tools/queue.sh > /dev/null 2>&1 &                      (it logs to B/queue.log itself; one queue at a time: B/queue.lock)
# Order: the file's order, except that a type's parent group always runs before its sibling group (p1 before sib1,
# p2 before sib2; a plain `sib` waits for every p group), because a sibling is painted from its parent's accepted
# plate. gen.py also leaves a sibling waiting (not failed) while its parent plate does not exist.
# Done steps are remembered in B/queue.done (delete a line there to run a step again; gen.py skips accepted plates anyway).
# QUOTA: when gen.py stops for Codex quota (exit 75, B/QUOTA_STOP holds the exact error text) the queue does NOT exit.
# It sleeps PROBE_EVERY seconds (default 900) and then asks Codex for ONE image (gen.py --probe: the next waiting plate).
# While that fails it sleeps again; when it succeeds gen.py removes QUOTA_STOP and the queue carries on. Every probe is
# a line in B/queue.log. It never calls a paid image model. Env: WORKERS (2), PROBE_EVERY (900), PY.
set -uo pipefail
TOOLS=$(cd "$(dirname "$0")" && pwd); B=${TW_B:-$(dirname "$TOOLS")}
PY=${PY:-python3}
Q=$B/queue.txt; DONE=$B/queue.done; LOG=$B/queue.log; STOP=$B/QUOTA_STOP
WORKERS=${WORKERS:-2}; PROBE_EVERY=${PROBE_EVERY:-900}
exec 9> "$B/queue.lock"; flock -n 9 || { echo "another queue.sh holds $B/queue.lock"; exit 1; }
echo $$ > "$B/queue.pid"; touch "$DONE" "$LOG"
log() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
# next pending step -> "LINE_NO<TAB>TYPE GROUP ARGS"; parents before siblings of the same type
next_step() {
  awk -v done="$DONE" '
    BEGIN { while ((getline l < done) > 0) { split(l, f, "\t"); d[f[1] "\t" f[2]] = 1 } }
    { line = $0; sub(/#.*/, "", line); gsub(/^[ \t]+|[ \t]+$/, "", line); gsub(/[ \t]+/, " ", line)
      if (line == "" || ((NR "\t" line) in d)) next
      n++; no[n] = NR; txt[n] = line; split(line, w, " "); ty[n] = w[1]; gr[n] = w[2] }
    END { if (!n) exit
          pick = 1
          if (gr[1] ~ /^sib/) { want = gr[1]; sub(/^sib/, "p", want)        # sib2 waits for p2 only; plain "sib" for any p group
            for (i = 2; i <= n; i++) if (ty[i] == ty[1] && (gr[i] == want || (want == "p" && gr[i] ~ /^p[0-9]*$/))) { pick = i; break } }
          print no[pick] "\t" txt[pick] }' "$Q" 2>/dev/null
}
mark() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$(date -Is)" >> "$DONE"; }   # line no, text, status
log "queue start (pid $$, workers $WORKERS, probe every ${PROBE_EVERY}s)"
while true; do
  step=$(next_step)
  if [[ -z $step ]]; then
    [[ ${FOLLOW:-0} == 1 ]] && { sleep 60; continue; }
    log "queue empty: done"; "$TOOLS/quota_status.sh" | tee -a "$LOG"; exit 0
  fi
  no=${step%%$'\t'*}; txt=${step#*$'\t'}; read -r type group extra <<<"$txt"
  if [[ -z ${group:-} || ! -f $B/$type/assets.json ]]; then log "SKIP line $no '$txt': needs 'TYPE GROUP' and $B/$type/assets.json"; mark "$no" "$txt" skipped; continue; fi
  if [[ -f $STOP ]]; then
    # quota stop: wait, then ONE image request
    last=$(jq -r '.last_probe // .time // empty' "$STOP" 2>/dev/null); due=0
    [[ -n $last ]] && due=$(( $(date -d "$last" +%s) + PROBE_EVERY - $(date +%s) ))
    if (( due > 0 )); then log "QUOTA_STOP: next probe in ${due}s ($type $group)"; sleep "$due"; fi
    log "PROBE: one image request, $type $group"
    # shellcheck disable=SC2086
    "$PY" "$TOOLS/gen.py" "$B/$type" --group "$group" $extra --probe >> "$LOG" 2>&1; rc=$?
    case $rc in
      0)  if [[ -f $STOP ]]; then log "PROBE: the plate did not get as far as an image and QUOTA_STOP is still there; waiting"; jq --arg t "$(date -Is)" '.last_probe = $t' "$STOP" > "$STOP.tmp" && mv "$STOP.tmp" "$STOP"
          else log "PROBE OK: Codex painted again; QUOTA_STOP removed; resuming"; fi;;
      3)  log "PROBE: no plate left to try in $type $group; step done"; mark "$no" "$txt" ok;;
      75) log "PROBE: still stopped: $(jq -r '.error_text' "$STOP" 2>/dev/null | tr '\n' ' ' | cut -c1-300)";;
      *)  log "PROBE: gen.py exit $rc (see above); waiting"; [[ -f $STOP ]] && jq --arg t "$(date -Is)" '.last_probe = $t' "$STOP" > "$STOP.tmp" && mv "$STOP.tmp" "$STOP";;
    esac
    continue
  fi
  log "STEP line $no: $type $group $extra"
  # shellcheck disable=SC2086
  "$PY" "$TOOLS/gen.py" "$B/$type" --group "$group" --workers "$WORKERS" $extra >> "$LOG" 2>&1; rc=$?
  case $rc in
    0)  log "STEP done: $type $group"; mark "$no" "$txt" ok;;
    75) log "QUOTA_STOP in $type $group: $(jq -r '.error_text' "$STOP" 2>/dev/null | tr '\n' ' ' | cut -c1-300) | waiting list: $B/$type/plates-waiting.txt";;
    *)  log "STEP FAILED (gen.py exit $rc): $type $group; going on"; mark "$no" "$txt" "failed-$rc";;
  esac
done
