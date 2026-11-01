#!/bin/bash
# Gemini on the real ☰ ▸ Conditions arc screenshot (shots-cond/conditions-<set>.png), from an isolated folder, stdin closed.
s=$1; here=$(cd "$(dirname "$0")" && pwd); t=$(mktemp -d /tmp/condring-XXXX); cp "$here/shots-cond/conditions-$s.png" "$t/ring.png"
P="Look at the image file $t/ring.png. Do NOT create, crop or write any files.
It is a screenshot of the real ring menu of a browser 3D fantasy tabletop game: the Conditions list of a selected pawn, opened as an arc of round painted buttons, each with its name. First read every text label in the image exactly. Then, for every button, say what its picture depicts and whether the picture fits its label (a D&D condition, an exhaustion level up or down, a custom condition, or Other...). Then: (1) do ALL the buttons look like one painted icon family (ground, rim, size, brushwork, palette, lighting)? Name any that look like a different set, and why. (2) Is each legible at this size? (3) Could any two be confused with each other? End with one line per button: LABEL: FITS|DOES NOT FIT - reason."
flock /tmp/agy.lock timeout 1500 "$here/agy-run-bounded" -m gemini-4-argon-high -C "$t" -t 600 -o "$here/shots-cond/conditions-$s.gemini.txt" "$P" < /dev/null > /dev/null 2>&1
rm -rf "$t"
