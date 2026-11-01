#!/usr/bin/env python3
"""Write one brief per planned picture and run the Codex worker's built-in image_gen on it.
Usage: gen.py <set> <id> [extra note for a regeneration]   (run from anywhere)"""
import json, subprocess, sys, os
from pathlib import Path
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
s, pid = sys.argv[1], sys.argv[2]
note = sys.argv[3] if len(sys.argv) > 3 else ''
pic = next(p for p in json.load(open(HERE / 'plan-additions.json'))['pictures'] if p['set'] == s and p['id'] == pid)
out = REPO / pic['source']
refs = sorted(str(p) for p in (HERE / 'refs').glob(f'{s}--*.png'))
brief = f"""# Brief: one painted ring icon, {s} set, {pid} ("{pic['title']}")

Make ONE image with your BUILT-IN image generation tool (no API calls, no scripts that draw, no SVG, no hand-built pixels).
Use this prompt for the generation, verbatim:

> {pic['prompt']}

Save the generated PNG, unmodified (no resizing, recolouring, masking or background removal), to:
`{out}`
Then write `{out}.json` with keys "prompt" (the exact prompt) and "output" (the original generated file path the tool returned).

This icon joins an existing family of painted ring icons. Existing members of the {s} set, for comparison only (do NOT feed them to the generator):
{chr(10).join('- ' + r for r in refs)}

Self-QA, after each generation (open the image and look; also run python with Pillow to check alpha:
`python3 -c "from PIL import Image; im=Image.open('{out}').convert('RGBA'); w,h=im.size; print(im.size, [im.getpixel(p)[3] for p in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]], im.getpixel((w//2,h//2))[3])"`):
1. The four corners are fully transparent (alpha 0) and the disc is solid (centre alpha about 250-255: the generator's native 251-254 is normal, the existing family has exactly that). Only an opaque background (corners not 0) or a see-through disc (centre alpha under 240) fails.
2. A single circular badge, {('dark charcoal ground, thin slate rim' if s=='charcoal' else 'warm pale parchment ground, thin antique brass rim')}, matching the reference icons' disc size, rim and painted brushwork.
3. The subject matches the metaphor exactly; no text, numbers, extra symbols or scene.
4. Shrink it mentally to 31 px: does it still read? Thick shapes only.
5. Side by side with the reference icons it looks like the same artist and set.
If any check fails, regenerate (same prompt, up to 4 tries total) and keep only the best passing result at the output path.
{('Extra note from the reviewer for this regeneration: ' + note) if note else ''}
Log what you did (tries, what failed, final file) in `{HERE}/logs/{s}--{pid}.md`. Then stop.
"""
bp = HERE / 'briefs' / f'{s}--{pid}.md'
bp.write_text(brief)
env = {k: v for k, v in os.environ.items() if k != 'OPENAI_API_KEY'}
r = subprocess.run(['codex', 'exec', '-s', 'workspace-write', '-C', str(REPO), '--skip-git-repo-check', '-'],
                   input=f'Read and follow the brief at {bp} exactly.', text=True, env=env,
                   stdout=open(HERE / 'logs' / f'{s}--{pid}.codex.txt', 'w'), stderr=subprocess.STDOUT, timeout=1500)
print(s, pid, 'exit', r.returncode, 'exists', out.exists())
