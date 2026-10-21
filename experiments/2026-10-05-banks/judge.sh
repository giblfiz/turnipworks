#!/usr/bin/env bash
# Gemini on one round of shots: blind describe first, then the slope pilot's own questions (so the numbers compare),
# then the adversarial question.   ./judge.sh shots/r1 r1 [scene ...]
set -u; cd "$(dirname "$0")"; D=$1; TAG=$2; shift 2; SC=${@:-plateau hill cliff hollow temple}
for s in $SC; do
  ( python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro gemini/blind.txt $D/$s-table.png $D/$s-low.png > gemini/$TAG-$s.blind.txt 2>&1
    python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro gemini/judge.txt $D/$s-table.png $D/$s-low.png > gemini/$TAG-$s.judge.txt 2>&1
    python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro gemini/adversarial.txt $D/$s-table.png $D/$s-low.png > gemini/$TAG-$s.adversarial.txt 2>&1 ) &
done; wait
grep -H "VERDICT\|^1\.\|score\|Score" gemini/$TAG-*.judge.txt | cut -c1-400
