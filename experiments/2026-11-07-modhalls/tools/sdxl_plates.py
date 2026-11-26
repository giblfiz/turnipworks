#!/usr/bin/env python3
"""ON THE POD (fallback after flux_plates.py: FLUX.1-schnell's repo is gated on Hugging Face and this lane has no token):
SDXL base 1.0 (stabilityai, CreativeML Open RAIL++-M: commercial use allowed), ungated. CLIP reads 77 tokens, so each id
gets a SHORT prompt (SHORT below: the object, the house look, the flat chroma-blue ground). Three seeds each; the plates
come home, are matted by BiRefNet and gated blind like Gemini's (tools/gate_plates.py).
    python3 sdxl_plates.py OUT_DIR"""
import os, sys, time, torch
from diffusers import StableDiffusionXLPipeline
STYLE = 'stylized hand-painted miniature game prop, chunky storybook shapes, broad bevels, matte painted gradients, single object centered, isolated on a flat solid pure blue background'
NEG = 'text, letters, words, numbers, logo, photo, photorealistic, glossy, people, floor, shadow, scene, room, multiple objects, cropped'
SHORT = {
  'housekeeping-cart': 'a hotel housekeeping cart with shelves of stacked white towels and folded sheets, a canvas linen bag at one end, spray bottles on top, castor wheels',
  'pipe-run-wall': 'a straight wall-mounted run of three thick horizontal industrial pipes, dull green, rusty red and grey, flanged joints, two red valve wheels, wall brackets, front view',
  'mop-bucket': 'a yellow janitor mop bucket on wheels with a grey wringer and a mop with a wooden handle standing in it',
  'breaker-panel': 'a grey steel electrical breaker panel box on a wall, door half open showing rows of black switches, two conduit pipes rising from its top, front view',
  'ice-machine': 'a stainless steel hotel ice machine cabinet, its bin door propped open showing a heap of white ice cubes and a scoop, front three-quarter view',
}
out = sys.argv[1]; os.makedirs(out, exist_ok=True); t0 = time.time()
pipe = StableDiffusionXLPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', torch_dtype=torch.float16, variant='fp16', use_safetensors=True).to('cuda')
print(f'loaded in {time.time() - t0:.0f}s', flush=True)
for i, p in SHORT.items():
    for k in range(3):
        img = pipe(f'{p}, {STYLE}', negative_prompt=NEG, num_inference_steps=30, guidance_scale=6.5, width=1024, height=1024, generator=torch.Generator('cuda').manual_seed(2000 + k)).images[0]
        img.save(os.path.join(out, f'{i}--s{k}.jpg'), quality=95); print(i, k, f'{time.time() - t0:.0f}s', flush=True)
print('SDXL-DONE', flush=True)
