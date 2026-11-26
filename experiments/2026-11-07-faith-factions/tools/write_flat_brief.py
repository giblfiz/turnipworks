#!/usr/bin/env python3
"""BRIEF-<name>.md for a Codex image worker painting FLAT pieces and emblems (fth/flats.json -> fth/flats/<id>.png).
    python3 tools/write_flat_brief.py NAME ID [ID ...]"""
import json, sys
from pathlib import Path
B = Path(__file__).resolve().parent.parent / 'fth'
name, ids = sys.argv[1], sys.argv[2:]
A = {a['id']: a for a in json.loads((B / 'flats.json').read_text())['assets']}
SIZE = {'portrait': '1024x1536 (portrait)', 'landscape': '1536x1024 (landscape)', 'square': '1024x1024 (square)'}
out = [f"# Image brief: fth {name} (flat pieces)\n",
 "You are painting flat game art (wall hangings, wall roundels, floor emblems, picker icons) for a heroic hand-painted tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen. Any size is fine; the sizes below are a preference.\n",
 "The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents.\n",
 "For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim) with a genuinely transparent background. Save it as `flats/<id>.png` in this folder (create `flats/` if missing).\n",
 "Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side; (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it shows what the prompt asks, accurately (these are SACRED symbols of real faiths: a cross, a dharma wheel, the Om sign, a figure of the Buddha: they must be drawn correctly and respectfully); (4) NO text, letters, numbers or script-like marks anywhere (the Om sign, where asked for, is the only exception). If a check fails, generate again (at most 3 tries per shot) and keep the best.\n",
 f"Append one line per shot to `LOG-{name}.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Finish each shot completely before the next. When all are done, write `flats/DONE-{name}` listing the saved ids.\n",
 "## Shots\n"]
for i in ids:
    a = A[i]
    out.append(f"### {i}\nSize: {SIZE[a['aspect']]}\n\nPrompt:\n\n{a['prompt']}\n")
(B / f'BRIEF-{name}.md').write_text('\n'.join(out))
print(B / f'BRIEF-{name}.md', len(ids))
