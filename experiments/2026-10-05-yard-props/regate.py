#!/usr/bin/env python3
"""Gate an EXISTING plate again against a corrected spec (no new image): used once, for hedge-end-block, whose second
plate (a flat-topped hedge cube) was rejected only because the gate text demanded a domed top.
    tw-birefnet-venv/bin/python regate.py . --ids hedge-end-block --redo --rerolls 0   (PLATE=path/to/plate.jpg)"""
import os, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
import plate_gate_batch as pgb
def reuse(root, asset, attempt, extra):
    (root / "work").mkdir(exist_ok=True); (root / "prompts").mkdir(exist_ok=True)
    out = root / "work" / f"{asset['id']}.try{attempt}.jpg"; shutil.copy2(os.environ["PLATE"], out)
    (root / "prompts" / f"{asset['id']}.try{attempt}.md").write_text(asset["prompt"] + "\n\n[plate reused from " + os.environ["PLATE"] + "; gate text corrected]\n")
    return out
pgb.generate = reuse; pgb.IMAGE_COST = 0.0
if __name__ == "__main__": pgb.main()
