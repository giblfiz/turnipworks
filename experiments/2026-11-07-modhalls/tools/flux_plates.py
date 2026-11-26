#!/usr/bin/env python3
"""ON THE POD: plates for the specs Gemini's image quota left undone (it ran out at 17:35, "resets at 2026-11-08T06:18Z"),
with FLUX.1-schnell (black-forest-labs, Apache-2.0 weights: open, commercial use allowed), 4 steps, no guidance, three
seeds each. Same text prompts (assets.json), same flat chroma-blue ground; the plates come home, are matted by BiRefNet
and gated blind like Gemini's (tools/gate_plates.py), the best seed per id kept.
    python3 flux_plates.py specs.json OUT_DIR          (specs.json: [{id, prompt, aspect}])"""
import json, os, sys, time
import torch
from diffusers import FluxPipeline
specs, out = json.load(open(sys.argv[1])), sys.argv[2]
os.makedirs(out, exist_ok=True)
t0 = time.time()
pipe = FluxPipeline.from_pretrained('black-forest-labs/FLUX.1-schnell', torch_dtype=torch.bfloat16).to('cuda')
print(f'loaded in {time.time() - t0:.0f}s', flush=True)
SIZE = {'portrait': (832, 1216), 'landscape': (1216, 832), 'square': (1024, 1024)}
for s in specs:
    w, h = SIZE.get(s.get('aspect'), (1024, 1024))
    for k in range(3):
        img = pipe(s['prompt'], num_inference_steps=4, guidance_scale=0.0, width=w, height=h, max_sequence_length=512,
                   generator=torch.Generator('cuda').manual_seed(1000 + k)).images[0]
        img.save(os.path.join(out, f"{s['id']}--f{k}.jpg"), quality=95)
        print(s['id'], k, f'{time.time() - t0:.0f}s', flush=True)
print('FLUX-DONE', flush=True)
