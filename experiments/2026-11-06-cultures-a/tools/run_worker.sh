#!/usr/bin/env bash
# One Codex image worker on one brief:   tools/run_worker.sh CODE NAME    (CODE/BRIEF-NAME.md -> CODE/plates/*.png)
# ChatGPT plan (codex login), no API key. Transcript: CODE/worker-logs/NAME.codex.log (git-ignored).
set -u
E=$(cd "$(dirname "$0")/.." && pwd); B=$E/$1; N=$2
mkdir -p "$B/plates" "$B/worker-logs"
[[ -f $B/style-anchor.png ]] || cp -L style-references/heroic-handpainted-tavern-v1.png "$B/style-anchor.png"
echo "$(date -Is) START worker $1/$N" >> "$E/workers.log"
codex exec --skip-git-repo-check -C "$B" -s workspace-write -i "$B/style-anchor.png" - < "$B/BRIEF-$N.md" > "$B/worker-logs/$N.codex.log" 2>&1
echo "$(date -Is) END worker $1/$N rc=$? plates=$(ls "$B"/plates/*.png 2>/dev/null | wc -l)" >> "$E/workers.log"
