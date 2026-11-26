#!/usr/bin/env python3
"""BRIEF-<name>.md for a Codex image worker (faction-pillars' write_brief.py, adapted): the exact prompts of the named
asset ids of one culture folder, one transparent PNG each, in order (a sibling's parent first).
    python3 tools/write_brief.py CODE NAME ID [ID ...]      (ID 'all' = every id of CODE/assets.json without a plate)"""
import json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent
code, name, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
B = E / code
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
if ids == ['all']:
    ids = [i for i in A if not (B / 'plates' / f'{i}.png').exists()]
SIZE = {'portrait': '1024x1536 (portrait)', 'landscape': '1536x1024 (landscape)', 'square': '1024x1024 (square)'}
out = [f"# Image brief: {code} {name}\n",
 "You are generating source plates for 3D reconstruction (image-to-3D) for a heroic hand-painted fantasy tabletop game. Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws images: every picture must come from image_gen.\n",
 "The attached image `style-anchor.png` (in this folder) is the house STYLE guide only: match its painting style, never its contents. For a shot marked EDIT, first open the named reference plate from this folder and make the new picture as an edit of it (same materials, colours and camera), changing only what the prompt says.\n",
 "For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a genuinely transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).\n",
 "Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the four corners are alpha 0); (3) it is the requested kind of object and its named features are plainly visible; (4) no text, no letters, no floor, no shadow. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.\n",
 f"Append one line per shot to `LOG-{name}.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write `plates/DONE-{name}` containing the list of saved ids.\n",
 "## Shots\n"]
for i in ids:
    a = A[i]
    ref = f"EDIT of `plates/{a['parent']}.png` (open it first and use it as the reference image)\n\n" if a.get('parent') else ""
    out.append(f"### {i}\nSize: {SIZE[a['aspect']]}\n\n{ref}Prompt:\n\n{a['prompt']}\n")
(B / f'BRIEF-{name}.md').write_text('\n'.join(out))
print(B / f'BRIEF-{name}.md', len(ids))
