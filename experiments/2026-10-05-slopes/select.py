#!/usr/bin/env python3
"""Copy the chosen generation of each piece (chosen.json) into web-models/ (git-ignored binaries)."""
import json, shutil
from pathlib import Path
H = Path(__file__).resolve().parent; (H / "web-models").mkdir(exist_ok=True)
for k, v in json.loads((H / "chosen.json").read_text()).items():
    if not k.startswith("_"): shutil.copy2(H / v / "models" / f"{k}.glb", H / "web-models" / f"{k}.glb"); print(k, "<-", v)
