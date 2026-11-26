#!/usr/bin/env bash
# PUBLISH A TREE WEB-READABLE (2026-11-06; docs/STATUS.md "Deploys set their own file modes").
#   tools/publish_tree.sh SRC/ DST/ [more rsync options...]
# The one copy step of engine/deploy.sh and tools/spawn-tuner/deploy.sh: rsync SRC/ into DST/ with every file landing
# 644 and every directory 755 AS IT IS COPIED, then the same modes over the whole of DST (files a run before left behind,
# and what the deploy wrote there itself). The checkouts are group-only (660 / 2770: umask 007), and nginx reads as
# "other", so a file published with its source mode is a 403.
# Found 2026-11-05: a tuner deploy left new icon files at 660 and dev 403'd them until they were fixed by hand. The modes
# used to be set only at the END of the deploy, after the version stamping, so any step that stopped the deploy in
# between (set -e) left every new or changed file at its source mode; now the copy itself sets them.
# A symlink in the published tree is published as a symlink (nginx then reads its target, at the target's own mode);
# one that points outside DST is named on stderr as a WARNING (a worktree's links into the main checkout, a stray
# self-link), never followed: following one that loops would never end.
# Tested by tests/test_publish_tree.py (scratch folders only).
set -euo pipefail
[[ $# -ge 2 ]] || { echo "usage: $0 SRC/ DST/ [rsync options...]" >&2; exit 2; }
src=$1 dst=$2; shift 2
mkdir -p "$dst"
rsync -a --chmod=D755,F644 "$@" "$src" "$dst"
# (a directory may keep its setgid bit, 2755: only rwxr-xr-x is asked of it)
find "$dst" -type d \( ! -perm -0755 -o -perm /0022 \) -exec chmod 755 {} +
find "$dst" -type f ! -perm 644 -exec chmod 644 {} +
real=$(cd "$dst" && pwd -P)
while IFS= read -r -d '' l; do
  t=$(readlink -f "$l" || true)
  [[ -n $t && $t == "$real"/* ]] || echo "WARNING: $l is a symlink out of the published tree (-> $(readlink "$l")): nginx serves its target at the target's own mode" >&2
done < <(find "$dst" -type l -print0)
