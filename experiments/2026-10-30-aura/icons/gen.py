#!/usr/bin/env python3
"""ONE codex exec session paints a small batch of plan.json pictures of one set (the built-in image_gen, no API key), with
three of our own icons of that set attached as STYLE references: experiments/2026-10-29-ring-attack-target/gen3.py, with
one more kind of edit.

  python3 gen.py <batch-name> <set> <id> [<id> ...] [--note "..."]

  parchment, when the charcoal painting exists: an EDIT of it into the parchment treatment (geometry kept: 10-15's way)
  a colour other than gold, when the gold painting of the same set exists: an EDIT of it, only the hue changed
"""
import json, os, subprocess, sys
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent; REPO = HERE.parents[2]
args = sys.argv[1:]; note = ''
if '--note' in args: i = args.index('--note'); note = args[i + 1]; del args[i:i + 2]
batch, s, ids = args[0], args[1], args[2:]
plan = {(p['set'], p['id']): p for p in json.load(open(HERE / 'plan.json'))['pictures']}
pics = [plan[(s, i)] for i in ids]
def png(rel):
    out = HERE / 'refs' / (Path(rel).parent.name + '--' + Path(rel).stem + '.png')
    if not out.exists(): Image.open(REPO / rel).save(out)
    return out
refs = sorted({str(png(r)) for p in pics for r in p['references']})
items = []
for p in pics:
    out = REPO / p['source']
    par = REPO / p['source'].replace('/parchment--', '/charcoal--') if s == 'parchment' else None
    gold = Path(str(REPO / p['source'].rsplit('.', 2)[0]) + '.gold.png') if p['id'].startswith('pawn.aura.color.') and not p['id'].endswith('.gold') else None
    if par is not None and par.exists():
        how = (f"EDIT, not a new design: take our own accepted charcoal painting `{par}` as the edit source and turn it into its parchment-set counterpart. "
               f"Preserve EXACTLY its composition, geometry, contours, sizes and placement; change ONLY the ground and palette treatment: pale warm parchment "
               f"circular ground, thin antique brass rim, ivory shapes that would vanish on parchment become dark slate, dark outlines for contrast; match the "
               f"parchment reference icons' look. Keep the matte hand-painted texture and native transparency outside the circle. No new objects, symbols or text. "
               f"Then also follow:\n> {p['prompt']}")
    elif gold is not None and Path(gold).exists():
        how = (f"EDIT, not a new design: take our own accepted painting `{gold}` (the GOLD wisp of this same set) as the edit source. Preserve EXACTLY its "
               f"composition, wisp shape, contours, sizes, placement, ground and rim; change ONLY the wisp's and sparks' colour to: {p['metaphor']} "
               f"Keep the matte hand-painted texture and native transparency outside the circle. No new objects, symbols or text. Then also follow:\n> {p['prompt']}")
    else:
        how = f"Generate with this prompt, verbatim, with the reference images attached as style references:\n> {p['prompt']}"
    items.append(f"### {p['id']}  ->  `{out}`\n{how}\n")
brief = f"""# Brief: {len(pics)} painted ring icons, {s} set (batch {batch})

Use your BUILT-IN image generation tool (the imagegen skill; no API calls, no scripts that draw, no SVG, no hand-built
pixels, no post-processing of pixels). For EVERY image, pass these reference images to the generator as style references
(they are our own earlier icons of the same set; match their look, not their subjects), and the edit source when an item names one
(the generator takes at most FIVE input images per call: these references plus that one edit source is within it):
{chr(10).join('- ' + r for r in refs)}
Ask for a transparent background. Save each generated PNG unmodified (no resize, recolour, mask or background removal) to
its path below, and write `<path>.json` beside it with "prompt", "references" (the files you passed, and the edit source if
any) and "output" (the original generated file path the tool returned).

{chr(10).join(items)}
Self-QA after each image (open it and look; and check alpha with
`python3 -c "from PIL import Image; im=Image.open('PATH').convert('RGBA'); w,h=im.size; print(im.size, [im.getpixel(p)[3] for p in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]], im.getpixel((w//2,h//2))[3])"`):
1. Corners alpha 0 and a solid disc (centre alpha about 250-255; the generator's native 251-254 is normal).
2. ONE circular badge whose ground, rim, disc size, brushwork and palette match the reference icons: same artist, same set.
3. The subject is exactly the one asked for, no text or numbers, no extra symbols.
4. Shrunk to 31 px it still reads: thick shapes only.
If a check fails, regenerate that one (at most 3 tries per image in all) and keep the best at the path. Never leave an
image missing: if no try passes, keep the best try and say so.
{('Reviewer note for this batch: ' + note) if note else ''}
Log tries, failures and final files in `{HERE}/logs/{batch}.md`. Then stop.
"""
bp = HERE / 'briefs' / f'{batch}.md'; bp.write_text(brief)
env = {k: v for k, v in os.environ.items() if k != 'OPENAI_API_KEY'}
extra = [str(REPO / p['source'].replace('/parchment--', '/charcoal--')) for p in pics if s == 'parchment' and (REPO / p['source'].replace('/parchment--', '/charcoal--')).exists()]
extra += [str(REPO / p['source'].rsplit('.', 2)[0]) + '.gold.png' for p in pics if p['id'].startswith('pawn.aura.color.') and not p['id'].endswith('.gold') and Path(str(REPO / p['source'].rsplit('.', 2)[0]) + '.gold.png').exists()]
cmd = ['codex', 'exec', '-s', 'workspace-write', '-C', str(REPO), '--skip-git-repo-check', '-i', *refs, *sorted(set(extra)), '--', '-']
r = subprocess.run(cmd, input=f'Read and follow the brief at {bp} exactly. The attached images are the style references (and edit sources) it names.', text=True, env=env,
                   stdout=open(HERE / 'logs' / f'{batch}.codex.txt', 'w'), stderr=subprocess.STDOUT, timeout=5400, stdin=None)
print(batch, s, 'exit', r.returncode, {i: (REPO / plan[(s, i)]['source']).exists() for i in ids}, flush=True)
