#!/usr/bin/env python3
"""Tag every role a lair recipe names with set:LAI (catalog_tool warns "lacks set:LAI" otherwise, and the game's Build
tray lists a type's furniture from the set tags). Idempotent: run it again after a merge that touched the same lines.
    python3 experiments/2026-10-11-types/lai/tools/add_set.py [--check]
"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[4]
want = set()
for f in sorted((ROOT / "catalog").glob("room*.md")):
    cur = None
    for line in f.read_text().splitlines():
        m = re.match(r"^### (\S+)", line)
        if m: cur = m.group(1); continue
        if cur and cur.startswith("lai-") and line.startswith("- ") and ":" in line:
            want |= {x.strip() for x in line.split(":", 1)[1].split(",") if x.strip() and not x.strip().startswith("fx-")}
changed = []
for f in sorted((ROOT / "catalog").glob("*.catalog.md")):
    out = []
    for line in f.read_text().splitlines(keepends=True):
        m = re.match(r"^- \*\*([a-z0-9-]+)\*\*", line)
        if m and m.group(1) in want:
            s = re.search(r"set:([A-Z!,]+)", line)
            if s and "LAI" not in re.split(r"[,!]", s.group(1)) and "ANY" not in s.group(1):
                line = line[:s.end()] + ",LAI" + line[s.end():]; changed.append(m.group(1))
        out.append(line)
    if changed and "--check" not in sys.argv: f.write_text("".join(out))
print(f"{len(changed)} roles {'would be ' if '--check' in sys.argv else ''}tagged set:LAI: {' '.join(sorted(set(changed)))}")
