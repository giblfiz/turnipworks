#!/usr/bin/env python3
"""Exact-text edits from a JSON file: [[path, old, new], ...] (each old must occur once).   python3 tools/ed.py edits.json"""
import json, sys
from pathlib import Path
W = Path(__file__).resolve().parents[3]
for p, a, b in json.loads(Path(sys.argv[1]).read_text()):
    f = W / p; s = f.read_text()
    assert s.count(a) == 1, f'{p}: {s.count(a)} x {a[:80]!r}'
    f.write_text(s.replace(a, b)); print('edited', p)
