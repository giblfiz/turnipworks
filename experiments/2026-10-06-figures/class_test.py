#!/usr/bin/env python3
"""Can a blind viewer tell the classes apart? Gemini's first and second guess (set/blind.json, from the gallery
thumbnails, never told what the figure is) against the class each hero was made as.   python3 class_test.py"""
import json
from collections import Counter, defaultdict
from pathlib import Path
S = Path(__file__).resolve().parent / "set"
spec = {a["id"]: a for a in json.loads((S / "assets.json").read_text())["assets"]}; b = json.loads((S / "blind.json").read_text())
rows = [(i, spec[i]["cls"], (r.get("class_guess") or "none").lower(), (r.get("class_second") or "none").lower(), (r.get("people") or "").lower(), spec[i]["race"]) for i, r in b.items() if spec.get(i, {}).get("group") == "hero"]
by = defaultdict(list)
for r in rows: by[r[1]].append(r)
print(f"{len(rows)} heroes read blind. class: first guess right / right in two guesses / n   | what it was called instead")
tot = [0, 0]
for c in sorted(by):
    rs = by[c]; ok = sum(r[2] == c for r in rs); ok2 = sum(c in (r[2], r[3]) for r in rs); tot[0] += ok; tot[1] += ok2
    wrong = Counter(r[2] for r in rs if r[2] != c)
    print(f"  {c:10} {ok:3} / {ok2:3} / {len(rs):3}   {dict(wrong) if wrong else ''}")
print(f"  all        {tot[0]} / {tot[1]} / {len(rows)}")
RN = {"small": ("halfling", "gnome"), "orc": ("orc", "half-orc"), "elf": ("elf",), "human": ("human",), "dwarf": ("dwarf",), "tiefling": ("tiefling",), "dragonborn": ("dragonborn",)}
pe = defaultdict(lambda: [0, 0, Counter()])
for r in rows:
    good = any(n in r[4] for n in RN[r[5]]); pe[r[5]][0] += good; pe[r[5]][1] += 1
    if not good: pe[r[5]][2][r[4]] += 1
print("people named right:", {k: f"{v[0]}/{v[1]}" + (f" {dict(v[2])}" if v[2] else "") for k, v in pe.items()})
