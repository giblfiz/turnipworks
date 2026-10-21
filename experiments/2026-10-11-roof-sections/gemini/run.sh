#!/bin/bash
# Gemini's reads (gemini-2.5-pro): a blind description of every table still, before and after, and a blind pair per style
# (A and B assigned by pairs.txt, which Gemini never sees). Run from this folder after shots.py.
GV="python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro"
T=$(mktemp -d)
for st in thatch tile slate shingle; do
  for w in before after; do cp shots/$w/$st-table.png $T/roof.png; $GV gemini/blind.txt $T/roof.png > gemini/blind-$w-$st.txt 2>&1 & done
  case $st in thatch|slate) a=after; b=before;; *) a=before; b=after;; esac
  mkdir -p $T/$st; cp shots/$a/$st-table.png $T/$st/A.png; cp shots/$b/$st-table.png $T/$st/B.png; echo "$st A=$a B=$b (table view)" >> gemini/pairs.txt
  $GV gemini/pair.txt $T/$st/A.png $T/$st/B.png > gemini/pair-$st.txt 2>&1 &
  wait
done
rm -rf $T
