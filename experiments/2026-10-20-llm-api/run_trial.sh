#!/usr/bin/env bash
# One live trial of the GET API with a small model through `codex exec` (the subscription; never a paid API key).
#   experiments/2026-10-20-llm-api/run_trial.sh N [model] [effort] [tail]   -> transcript-N.md (+ outcome-N.json) here
# tail: the GM's request (default prompt-tail.txt, the five tasks; prompt-tail-more.txt asks for more)
# The model gets ONLY the rules card and one ability (curl of an address); see README.md "The live trial".
set -euo pipefail
X="$(cd "$(dirname "$0")" && pwd)"; N="${1:?trial number}"; MODEL="${2:-gpt-5.6-luna}"; EFFORT="${3:-low}"; TAIL="${4:-$X/prompt-tail.txt}"
W="$(mktemp -d)"; mkdir -p "$W/empty"; PORT=$((8190 + N % 9))
node "$X/trial_relay.mjs" "$PORT" "$W" > "$W/relay.log" 2>&1 & RP=$!
trap 'kill $RP 2>/dev/null || true; rm -rf "$W"' EXIT
for i in $(seq 1 100); do [[ -f "$W/trial.json" ]] && break; sleep 0.3; done
{ cat "$X/prompt-head.txt"; cat "$W/card.txt"; cat "$TAIL"; } > "$W/prompt.txt"
(cd "$W/empty" && timeout 900 codex exec -m "$MODEL" -c model_reasoning_effort="$EFFORT" --skip-git-repo-check --json -o "$W/last.txt" - < "$W/prompt.txt" > "$W/transcript.jsonl" 2> "$W/stderr.txt") || echo "codex exited $?"
{ echo "# Live trial $N — $MODEL ($EFFORT), card $(wc -c < "$W/card.txt") chars, $(date -Iseconds)"; echo; python3 "$X/transcript.py" "$W/transcript.jsonl" "$(grep -o 'seat=seat_[^&) ]*' "$W/card.txt" | head -1 | cut -c6-)"; } > "$X/transcript-$N.md"
# what actually happened on the table (read with the GM's own token)
python3 - "$W/trial.json" > "$X/outcome-$N.json" <<'PY'
import json, sys, urllib.request
t = json.load(open(sys.argv[1]))
s = json.load(urllib.request.urlopen(f"{t['base']}/c/{t['campaign']}/a/{t['area']}/scene?seat={t['gmToken']}"))
lit = {l['id']: l['lit'] for l in s['lights']}
print(json.dumps({'rooms': [{'id': r['id'], 'label': r['label'], 'hidden': bool(r.get('hidden'))} for r in s['rooms']],
  'pawns': [{'name': p['name'], 'figure': p.get('figure'), 'room': p.get('room')} for p in s['pawns']],
  'litNow': [l['id'] for l in t['lightsOut'] if lit.get(l['id'])], 'chat': s['chat']}, indent=1))
PY
cat "$W/last.txt"; echo; echo "-> $X/transcript-$N.md, $X/outcome-$N.json"
