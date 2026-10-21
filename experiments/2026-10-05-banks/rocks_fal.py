#!/usr/bin/env python3
"""masked/<id>.png -> fal TRELLIS.2 ($0.30 each, the slope pilot's settings) -> fal/models/<id>.glb. Skips what exists.
    python3 rocks_fal.py [id ...]"""
import json, shutil, sys, concurrent.futures
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "src"))
import fal_trellis as ft
root = HERE / "fal"
for d in ("inputs", "models", "manifests"): (root / d).mkdir(parents=True, exist_ok=True)
key = Path("~/.config/fauna/secrets/fal-api-key.txt").read_text().strip()   # the path src/fal_trellis.py uses
settings = {"resolution": "1024", "decimation_target": 50000, "texture_size": "2048", "remesh": True}
ids = sys.argv[1:] or [a["id"] for a in json.load(open(HERE / "assets.json"))["assets"]]
def one(i):
    if (root / "models" / f"{i}.glb").exists(): return i, "skip"
    dst = root / "inputs" / f"{i}.png"; shutil.copy2(HERE / "masked" / f"{i}.png", dst)
    try: return i, ft.run_asset(i, dst, root, key, settings).get("output_bytes")
    except Exception as e: return i, f"FAILED {e}"[:300]
with concurrent.futures.ThreadPoolExecutor(3) as pool:
    for r in pool.map(one, ids): print(r, flush=True)
