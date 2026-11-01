#!/usr/bin/env python3
"""masked/foe-eye-tyrant.png -> fal-ai/trellis-2, by the figures pilot's own runner (../2026-10-06-figures/mesh_fal.py:
the set's settings, the request id saved so a lost poll cannot lose a paid mesh), pointed at THIS folder: its masked/,
its fal-trellis2<tag>/ and its own spend.log, with this job's cap of $3.00 (Harry pre-approved fal spend; $0.30 a mesh).
    python3 mesh.py [--tag=-r2]"""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE.parent / "2026-10-06-figures"))
import mesh_fal as mf
mf.HERE = HERE; mf.CAP = 3.00
tag = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--tag=")), "")
print("fal balance before:", mf.balance(), "| spent here so far: $%.2f of $%.2f" % (mf.spent(), mf.CAP), flush=True)
print(mf.run("trellis2", "foe-eye-tyrant", tag), flush=True)
print("fal balance after:", mf.balance(), "| spent here: $%.2f" % mf.spent(), flush=True)
