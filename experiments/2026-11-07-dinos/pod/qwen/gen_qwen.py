#!/usr/bin/env python3
"""ON THE POD: paint plates with Qwen-Image-Edit (QwenImageEditPlusPipeline, bf16, all on one 80 GB GPU).
    /root/qenv/bin/python gen_qwen.py JOBS.json OUTDIR [--steps 40] [--cfg 4.0]
JOBS.json: [{"id": "...", "prompt": "...", "refs": ["/root/dinos/refs/x.png", ...], "seeds": [1, 2, 3]}]
Writes OUTDIR/<id>.s<seed>.png (skips what exists) and OUTDIR/log.jsonl (seconds per image). Resumable."""
import json, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import QwenImageEditPlusPipeline
jobs, out = json.loads(Path(sys.argv[1]).read_text()), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
opt = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
steps, cfg = opt("--steps", 40), opt("--cfg", 4.0)
model = Path("/root/qwen-model.txt").read_text().strip()
t0 = time.time()
pipe = QwenImageEditPlusPipeline.from_pretrained(model, torch_dtype=torch.bfloat16, cache_dir=None).to("cuda")
pipe.set_progress_bar_config(disable=True)
print(f"loaded {model} in {time.time() - t0:.0f}s", flush=True)
log = open(out / "log.jsonl", "a")
for j in jobs:
    refs = [Image.open(r).convert("RGB") for r in j["refs"]]
    for s in j["seeds"]:
        dst = out / f"{j['id']}.s{s}.png"
        if dst.exists(): continue
        t = time.time()
        img = pipe(image=refs if len(refs) > 1 else refs[0], prompt=j["prompt"], negative_prompt=j.get("negative", " "), true_cfg_scale=cfg, guidance_scale=1.0,
                   num_inference_steps=steps, num_images_per_prompt=1, generator=torch.Generator("cuda").manual_seed(s)).images[0]
        img.save(dst)
        rec = {"id": j["id"], "seed": s, "s": round(time.time() - t, 1), "size": img.size, "model": model, "steps": steps, "cfg": cfg}
        log.write(json.dumps(rec) + "\n"); log.flush(); print(rec, flush=True)
print("ALL DONE", flush=True)
