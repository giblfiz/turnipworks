#!/usr/bin/env bash
# A text-only codex read in an isolated folder: tools/codex_read.sh DIR  (DIR holds prompt.md and the files it names;
# the answer goes to DIR/out.txt, the transcript to DIR/err.txt). Read-only sandbox; ChatGPT plan, no API key.
set -u
D=$1
cd "$D" || exit 1
codex exec --skip-git-repo-check -C "$D" -s read-only - < prompt.md > out.txt 2> err.txt
echo "rc=$?" >> out.txt
