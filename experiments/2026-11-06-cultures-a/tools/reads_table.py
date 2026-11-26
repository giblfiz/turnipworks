#!/usr/bin/env python3
"""Print every room read so far (SHOTDIR/read.json from tools/room_reads.py) as one line a room, and write ROOM_READS.md
beside this folder's DESIGN.md: what Gemini, told nothing, called each room's culture and kind, with its confidence.
    python3 tools/reads_table.py jpn/shots-r2 chn/shots-r1 ind/shots-r1"""
import json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent
rows = []
for d in sys.argv[1:]:
    p = E / d / 'read.json'
    if not p.exists(): continue
    for tag, v in json.loads(p.read_text()).items():
        rows.append((tag, v)); print(f"{tag:30s} | {str(v.get('culture'))[:34]:34s} {v.get('culture_conf')} | {str(v.get('room'))[:44]:44s} {v.get('room_conf')} | {'; '.join(v.get('problems') or [])[:160]}")
md = ["# Room reads (blind, table distance): \"what culture and what room is this?\"", "",
      "tools/room_shots.py (the tuner from this worktree, labels off, the high three-quarter view and the top view) -> tools/room_reads.py (agy-run, an isolated folder, neutral names, told nothing). Target: the culture named, and the room.", "",
      "| shot | culture (conf) | room (conf) | built around | problems |", "|---|---|---|---|---|"]
for tag, v in rows:
    md.append(f"| {tag} | {v.get('culture')} ({v.get('culture_conf')}) | {v.get('room')} ({v.get('room_conf')}) | {str(v.get('focal') or '')[:80]} | {'; '.join(v.get('problems') or []) or '-'} |")
(E / 'ROOM_READS.md').write_text('\n'.join(md) + '\n')
print(len(rows), 'reads -> ROOM_READS.md')
