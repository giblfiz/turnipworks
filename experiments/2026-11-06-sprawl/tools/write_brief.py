#!/usr/bin/env python3
"""BRIEF-<name>.md for a Codex image worker: the exact prompts of the named asset ids (assets.json), one PNG each.
A sibling (spec `parent`) is an EDIT: its parent's accepted plate (masked/<parent>.png) is copied to ref/<id>/parent.png
and named in the shot as the reference image.
    python3 tools/write_brief.py NAME ID [ID ...]     |  NAME all-parents [N]  (every spec without a parent, split N ways)
                                                       |  NAME siblings          (every sibling whose parent is accepted)"""
import json, shutil, sys
from pathlib import Path
B = Path(__file__).resolve().parent.parent
A = {a['id']: a for a in json.loads((B / 'assets.json').read_text())['assets']}
name, ids = sys.argv[1], sys.argv[2:]
groups = None
have = lambda i: (B / 'plates' / f'{i}.png').exists()
if ids[:1] == ['all-parents']:
    n = int(ids[1]) if len(ids) > 1 else 1
    todo = [i for i, a in A.items() if not a.get('parent') and not have(i)]
    groups = [todo[k::n] for k in range(n)]
elif ids == ['siblings']:
    ids = [i for i, a in A.items() if a.get('parent') and not have(i) and ((B / 'masked' / f"{a['parent']}.png").exists() or have(a['parent']))]
elif ids[:1] == ['missing']:
    ids = [i for i, a in A.items() if not have(i) and (not a.get('parent') or (B / 'masked' / f"{a['parent']}.png").exists() or have(a['parent']))]
groups = groups or [ids]
SIZE = {'portrait': '1024x1536 (portrait)', 'landscape': '1536x1024 (landscape)', 'square': '1024x1024 (square)'}
for g, part in enumerate(groups, 1):
    if not part: continue
    nm = name if len(groups) == 1 else f'{name}-{g}'
    out = [f"# Image brief: {nm}\n",
     "You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates images or draws anything: every picture must come from image_gen.\n",
     "For each shot below: generate ONE image from the prompt EXACTLY as written (copy it verbatim), size as stated, with a transparent background. If the shot names a reference image, LOOK at it first and pass it to image_gen as the reference image (the new picture is an edit of it). Save the result as `plates/<id>.png` in this folder (create `plates/` if missing).\n",
     "Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is plainly the requested kind of object, in a modern-day style; (4) NO text, letters, numbers, logos or brand marks anywhere on it (look closely: signs, screens, packages, cars); (5) no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.\n",
     f"Append one line per shot to `LOG-{nm}.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-{nm}` containing the list of saved ids.\n",
     "## Shots\n"]
    for i in part:
        a = A[i]; ref = ''
        if a.get('parent'):
            d = B / 'ref' / i; d.mkdir(parents=True, exist_ok=True); src = B / 'masked' / f"{a['parent']}.png"
            shutil.copy(src if src.exists() else B / 'plates' / f"{a['parent']}.png", d / 'parent.png')
            ref = f"Reference image: ref/{i}/parent.png (the accepted plate of `{a['parent']}`; keep everything the prompt does not change)\n"
        out.append(f"### {i}\nSize: {SIZE[a['aspect']]}\n{ref}\nPrompt:\n\n{a['prompt']}\n")
    (B / f'BRIEF-{nm}.md').write_text('\n'.join(out))
    print(B / f'BRIEF-{nm}.md', len(part))
