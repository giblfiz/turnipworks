#!/bin/bash
# match.sh NAME "spec text" IMG...  -> Gemini match read (after the blind read), saved to raw/gemini/NAME.match.txt
n=$1; spec=$2; shift 2
cat > raw/prompts/$n.match.txt <<P
You are checking a hand-painted game asset against its specification. Be strict and literal; answer briefly.
SPECIFICATION: $spec
For each requirement in the specification say MET / NOT MET / PARTLY with a few words of evidence. Count things where a count is given. Then list anything present that the specification forbids (letters or writing, blue or purple, perspective, cast shadows, extra objects). Last line: VERDICT: ACCEPT or REJECT, and the one main reason.
P
python3 $HOME/fauna-tools/gemini-vision.py gemini-2.5-pro raw/prompts/$n.match.txt "$@" | tee raw/gemini/$n.match.txt
