#!/usr/bin/env python3
"""(2026-10-27 roofs-flat props copy of the bars tool: per-shot Check line from assets.json.)
BRIEF-<name>.md for a Codex image worker: the exact prompts of the named asset ids (assets.json), one PNG each."""
import json, sys
from pathlib import Path
B = Path(__file__).resolve().parent.parent
name, ids = sys.argv[1], sys.argv[2:]
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
ids = ids if ids != ['rest'] else [i for i in A if 'dragons' not in i]
ids = ids if ids != ['buttresses'] else [i for i in A if i.startswith('flavor-buttress')]
out = [f"# Image brief: {name}\n",
 "You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.\n",
 "For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).\n",
 "Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is the requested kind of object, as described for each shot under 'Check'; (4) no text, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.\n",
 "Append one line per shot to `LOG.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-" + name + "` containing the list of saved ids.\n",
 "## Shots\n"]
for i in ids:
    a = A[i]; size = {'portrait': '1024x1536 (portrait)', 'landscape': '1536x1024 (landscape)', 'square': '1024x1024 (square)'}[a['aspect']]
    out.append(f"### {i}\nSize: {size}\n\nCheck: {a.get('check', a['gate']['desc'])}\n\nPrompt:\n\n{a['prompt']}\n")
(B / f'BRIEF-{name}.md').write_text('\n'.join(out))
print(B / f'BRIEF-{name}.md', len(ids))
