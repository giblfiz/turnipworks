#!/bin/bash
# match.sh NAME "spec text" IMG...  -> Gemini match read (after the blind read), saved to raw/gemini/NAME.match.txt
cd "$(dirname "$0")"; n=$1; spec=$2; shift 2
cat > raw/prompts/$n.match.txt <<P
You are checking a hand-painted game asset against its specification. It is seen in play from a tabletop camera about 40 ft up. Be strict and literal; answer briefly.
SPECIFICATION: $spec
For each requirement in the specification say MET / NOT MET / PARTLY with a few words of evidence. Count things where a count is given. Then list anything present that the specification forbids (letters or writing, blue or purple, cast shadows, extra objects). Last line: VERDICT: ACCEPT or REJECT, and the one main reason.
P
./gv.sh raw/prompts/$n.match.txt raw/gemini/$n.match.txt "$@"
