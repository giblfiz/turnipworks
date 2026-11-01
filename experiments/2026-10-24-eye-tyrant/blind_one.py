#!/usr/bin/env python3
"""The set's blind read of a published figure (../2026-10-06-figures/set_blind.py: its prompt, a neutral file name, the
gallery thumbnail) on the free route (agy_vision.py), into ./blind.json ONLY: a blind reader names this kind of monster by
the publisher's word, and the figure's own metadata (the set's blind.json, the manifest) must never carry that word.
    python3 blind_one.py"""
import json, sys, tempfile
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent; FIG = HERE.parent / "2026-10-06-figures"; ID = "foe-eye-tyrant"
sys.path.insert(0, str(HERE)); import agy_vision
src = (FIG / "set_blind.py").read_text(); ns = {}
exec(src[src.index('CLASSES ='):src.index('out = SET')], ns)
f = Path(tempfile.mkdtemp(prefix="figblind-")) / "figure-1.png"; Image.open(HERE / "published/thumbs" / f"{ID}.webp").convert("RGB").save(f)
import base64
r, _ = agy_vision.vision([{"inline_data": {"mime_type": "image/png", "data": base64.b64encode(f.read_bytes()).decode()}}, {"text": "[above: the figure]"}], ns["PROMPT"])
print(json.dumps(r, indent=1))
for p in (HERE / "blind.json",):
    d = json.loads(p.read_text()) if p.exists() else {}; d[ID] = r; p.write_text(json.dumps(d, indent=1) + "\n")
