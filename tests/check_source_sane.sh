#!/usr/bin/env bash
# Deploy gate (2026-10-12): a landing script deployed a half-merged world.js (conflict markers) and the live game was
# broken for about a minute. Refuse to deploy from a tree that is mid-merge, has conflict markers in shipped source,
# or has a shipped module that does not parse.   tests/check_source_sane.sh   (both deploy scripts run it first)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"; bad=0
G="$(git rev-parse --git-dir 2>/dev/null || true)"
if [ -n "$G" ]; then
  [ -f "$G/MERGE_HEAD" ] && { echo "   a merge is in progress in this tree"; bad=1; }
  U="$(git diff --name-only --diff-filter=U 2>/dev/null)"; [ -n "$U" ] && { echo "   unmerged paths: $U"; bad=1; }
fi
DIRS="engine/client engine/core engine/relay tools/spawn-tuner/js"
M="$(grep -rlE --include=*.js --include=*.mjs --include=*.html --include=*.css --include=*.json --exclude-dir=vendor --exclude-dir=node_modules '^(<<<<<<< |>>>>>>> |=======$)' $DIRS tools/spawn-tuner/data 2>/dev/null || true)"
[ -n "$M" ] && { echo "   conflict markers in:"; echo "$M" | sed 's/^/     /'; bad=1; }
while IFS= read -r f; do
  node --input-type=module --check < "$f" 2>/dev/null || { echo "   does not parse: $f"; bad=1; }
done < <(find $DIRS -name '*.js' -not -path '*/vendor/*' -not -path '*/node_modules/*' -not -path '*/test/*' 2>/dev/null)
[ $bad -eq 0 ] && echo "source sane: no merge in progress, no conflict markers, every module parses"
exit $bad
