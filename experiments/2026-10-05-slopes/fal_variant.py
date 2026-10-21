#!/usr/bin/env python3
"""Re-run chosen pieces on fal TRELLIS.2 ($0.30 each) with different mesh settings, into fal-<tag>/ .
Why: 4 of the first 10 meshes (the boxy ones: tall bank, both ledge pieces, outcrop) came back from fal's default
`remesh: true` path with few faces and black holes baked into the texture.
    python3 fal_variant.py TAG '{"remesh": false}' slope-outcrop [more ids]
    python3 fal_variant.py pad '{"_pad": 0.5}' slope-outcrop          # object shrunk to half the canvas before upload
"""
import json, shutil, sys, concurrent.futures
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "src"))
import fal_trellis as ft
tag, override, ids = sys.argv[1], json.loads(sys.argv[2]), sys.argv[3:]
root = HERE / f"fal-{tag}"
for d in ("inputs", "models", "manifests"): (root / d).mkdir(parents=True, exist_ok=True)
key = Path("~/.config/fauna/secrets/fal-api-key.txt").read_text().strip()   # the path src/fal_trellis.py uses
pad = override.pop("_pad", None)   # local only: shrink the object to this share of a larger transparent canvas
settings = {"resolution": "1024", "decimation_target": 50000, "texture_size": "2048", "remesh": True, **override}
def one(i):
    src = HERE / "masked" / f"{i}.png"; dst = root / "inputs" / f"{i}.png"; shutil.copy2(src, dst)
    if pad:
        from PIL import Image
        im = Image.open(src).convert("RGBA"); im = im.crop(im.getbbox()); side = int(max(im.size) / pad)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0)); canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2)); canvas.resize((1024, 1024), Image.LANCZOS).save(dst)
    if (root / "manifests" / f"{i}.json").exists(): return i, "skip"
    try: return i, ft.run_asset(i, dst, root, key, settings)["output_bytes"]
    except Exception as e: return i, f"FAILED {e}"[:300]
with concurrent.futures.ThreadPoolExecutor(4) as pool:
    for r in pool.map(one, ids): print(r, flush=True)
