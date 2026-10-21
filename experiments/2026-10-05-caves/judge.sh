#!/usr/bin/env bash
# Gemini on one round of shots, one image per call: blind describe first, then the pilot's questions.
#   ./judge.sh shots/r1 r1 [view ...] -- [scene ...]      (default: table view; rect ell two field)
set -u; cd "$(dirname "$0")"; D=$1; TAG=$2; shift 2
VIEWS=(); while [ $# -gt 0 ] && [ "$1" != "--" ]; do VIEWS+=("$1"); shift; done; [ $# -gt 0 ] && shift
[ ${#VIEWS[@]} -eq 0 ] && VIEWS=(table); SC=${@:-rect ell two field}; M=${MODEL:-gemini-2.5-pro}
for s in $SC; do for v in "${VIEWS[@]}"; do
  ( python3 $HOME/fauna-tools/gemini-vision.py $M gemini/blind.txt $D/$s-$v.png > gemini/$TAG-$s-$v.blind.txt 2>&1
    python3 $HOME/fauna-tools/gemini-vision.py $M gemini/judge.txt $D/$s-$v.png > gemini/$TAG-$s-$v.judge.txt 2>&1 ) &
done; done; wait
grep -H "^CONTINUOUS_ROCK\|^OUTLINE_VISIBLE\|^VERDICT" gemini/$TAG-*.judge.txt
