#!/usr/bin/env bash
# Commit a SNAPSHOT of Harry's live review data (ratings, bench records, house look, sent presets) into reviews/.
#
# The live records are not in any git checkout (2026-10-12): the write-back server keeps them in the folder
# server/reviews_home.py names (TW_REVIEWS_DIR; on the build box /var/lib/tw-ratings). The repo carries a copy only so a
# clone has ratings to build from and a commit says which ratings it was built with. This script is the ONLY writer of
# the in-repo reviews/: it copies every record file from the live home (client IPs dropped, test sandbox left out),
# checks no line went missing, and commits exactly those paths. The live home is only read.
#
#   tools/snapshot_reviews.sh             in the MAIN checkout: takes the landing lock, commits, pushes
#   tools/snapshot_reviews.sh --no-push   commit only (a landing script that already holds the lock and pushes itself:
#                                         TW_LOCK_HELD=1 tools/snapshot_reviews.sh --no-push)
# Nothing to commit is not an error. Other branches never run this: two snapshots on two branches would conflict.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PUSH=1; [[ "${1:-}" == "--no-push" ]] && PUSH=0
[[ -n "${TW_LOCK_HELD:-}" ]] || exec env TW_LOCK_HELD=1 flock /tmp/tw-main.lock "$0" "$@"
die() { echo "SNAPSHOT FAILED: $*" >&2; exit 1; }
cd "$REPO"
LIVE="$(python3 server/reviews_home.py)"
[[ -d "$LIVE" ]] || die "the live home $LIVE does not exist"
[[ "$(realpath "$LIVE")" != "$(realpath "$REPO/reviews")" ]] || die "the live home IS this checkout's reviews/ (TW_REVIEWS_DIR): nothing to copy"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || die "run this in the main checkout (this one is on $(git rev-parse --abbrev-ref HEAD))"
if (( PUSH )); then
  export GH_CONFIG_DIR="${GH_CONFIG_DIR:-$HOME/.config/gh}"
  git fetch -q origin || die "fetch"
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || die "main is not origin/main: land or push first, or use --no-push"
fi
n=0
while IFS= read -r -d '' rel; do
  rel="${rel#./}"; src="$LIVE/$rel"; dst="$REPO/reviews/$rel"
  mkdir -p "$(dirname "$dst")"
  python3 tools/git-filters/strip_ip.py < "$src" > "$dst.snap-tmp" || die "could not copy $rel"
  if [[ "$rel" == *.jsonl ]]; then
    [[ "$(wc -l < "$src")" == "$(wc -l < "$dst.snap-tmp")" ]] || { rm -f "$dst.snap-tmp"; die "$rel: the copy has a different number of lines"; }
  else
    python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2])); sys.exit(0 if set(a)==set(b) else 1)' "$src" "$dst.snap-tmp" || { rm -f "$dst.snap-tmp"; die "$rel: the copy has different keys"; }
  fi
  mv "$dst.snap-tmp" "$dst"
  git add -- "reviews/$rel"
  n=$((n + 1))
done < <(cd "$LIVE" && find . -type f \( -name '*.jsonl' -o -name '*.json' \) -not -path './test-sandbox/*' -print0 | sort -z)
if git diff --cached --quiet -- reviews; then echo "snapshot: $n files, nothing new since the last one"; exit 0; fi
ratings=$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$LIVE/latest.json")
git commit -q -m "Reviews snapshot $(date +%Y-%m-%d\ %H:%M): $ratings rated keys, $n record files (copied from the live home by tools/snapshot_reviews.sh)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: <session>" -- reviews
echo "snapshot: committed $(git log --oneline -1 | cut -c1-70)"
if (( PUSH )); then git push -q origin main || die "committed, not pushed"; echo "snapshot: pushed"; fi
