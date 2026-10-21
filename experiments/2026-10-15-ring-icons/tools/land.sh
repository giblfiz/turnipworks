#!/usr/bin/env bash
# Invoke only after final review/commit: flock /tmp/tw-main.lock <this script>
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
MAIN=$TW_REPO
BATCH=experiments/2026-10-15-ring-icons
cd "$ROOT"
python3 "$BATCH/tools/validate.py"
test -z "$(git status --porcelain --untracked-files=normal)" || { echo 'Worktree must be committed before landing'; exit 1; }
git fetch origin
LAND="codex-j-land-$(date +%Y%m%dT%H%M%S)"
git switch -c "$LAND"
git merge origin/main -m $'Merge origin/main for painted ring icon landing\n\nCo-Authored-By: Codex <noreply@openai.com>'
python3 tools/tool-sweep/check.py
python3 tools/tool-sweep/sku_guard.py
(cd engine && npm test)
python3 "$BATCH/tools/validate.py"
git -C "$MAIN" merge --ff-only "$LAND"
# Generated binaries follow repository policy: main+deployment copies, not Git.
mkdir -p "$MAIN/tools/spawn-tuner/assets/ui-icons" "$MAIN/$BATCH"
rsync -a --delete tools/spawn-tuner/assets/ui-icons/ "$MAIN/tools/spawn-tuner/assets/ui-icons/"
rsync -a --exclude '__pycache__' "$BATCH/" "$MAIN/$BATCH/"
(cd "$MAIN" && tools/spawn-tuner/deploy.sh)
(cd "$MAIN" && GH_CONFIG_DIR=$HOME/.config/gh git push origin main)
git -C "$MAIN" rev-parse HEAD
