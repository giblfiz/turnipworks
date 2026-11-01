#!/usr/bin/env python3
"""BRIEF-<n>.md for the Codex image workers (built-in image_gen, ChatGPT plan; no API key): one plate per target, each
an EDIT of its partner's look: the partner model's own renders (tools/render_ref.py) and, when it exists, the partner's
source plate, copied to ref/<id>/.
  python3 tools/write_briefs.py N [id ...]        (N workers; ids default to every target without a plate yet)"""
import json, shutil, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent
T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}
n = int(sys.argv[1]); ids = sys.argv[2:] or [i for i in T if not (E / 'plates' / f'{i}.png').exists()]
NOUN = {'floor': 'a free-standing piece of furniture', 'surface': 'a small tabletop object', 'wall': 'a piece of furniture that stands against a wall', 'kit': 'a building kit piece'}

def prompt(t):
    refs = sorted(p.name for p in (E / 'ref' / t['id']).iterdir())
    kit = t['partner_place'] == 'kit'
    if 'window' in t['id'] or 'door' in t['id']:
        frame = 'Seen from the front at a slight three-quarter angle from slightly above (camera elevation 15 degrees), so the whole face of the wall section or frame and the depth of anything swung out from it are visible; the whole piece fits in the frame.'
    elif 'trapdoor' in t['id'] or 'hatch' in t['id']:
        frame = 'Three-quarter view from ABOVE (camera elevation 45 degrees), so the flat tile and what is in or above its middle are plainly visible; the whole piece fits in the frame.'
    else:
        frame = 'Three-quarter front view from ABOVE (camera elevation 30 degrees), so the front and the top are both visible; the whole object fits in the frame.'
    return ("Use case: stylized-concept, an EDIT of an existing asset. Asset for Turnip Works, heroic hand-painted miniature game art. "
            f"The reference images ({', '.join('ref/' + t['id'] + '/' + r for r in refs)}) all show ONE existing game prop, {NOUN[t['partner_place']]} "
            f"(the game's '{t['partner_object']}'). Make the SAME object: the same design, the same materials and colours, the same ornament, "
            f"the same proportions, width and footprint, so the two could be swapped in the game without anyone noticing anything but this ONE change: "
            f"{t['change']}. The change must be obvious at a glance from across a room. Everything else stays as in the references. "
            "Stout connected forms, broad bevels, clear part separation, matte painted gradients, restrained surface texture, no glossy PBR. "
            "Exactly one complete object centered with generous clear margin on every side, no scene or additional objects, no people or creatures, no text, no logos. "
            f"{frame} Genuinely transparent background, no floor or cast shadow. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.")

def checks(t):
    st = 'OPEN (the named part plainly swung, lifted or thrown open, the opening visible)' if t['want'] == 'open' else 'SHUT (closed, nothing inside visible, nothing swung out)'
    return st

for i in ids:
    t = T[i]; d = E / 'ref' / i
    if d.exists(): shutil.rmtree(d)
    d.mkdir(parents=True)
    for tag in ('34', 'front'): shutil.copy(E / 'refs' / f"{t['partner']}-{tag}.png", d / f'partner-render-{tag}.png')
    if t['partner_plate']: shutil.copy(t['partner_plate'], d / ('partner-plate' + Path(t['partner_plate']).suffix))
groups = [ids[k::n] for k in range(n)]
for g, part in enumerate(groups, 1):
    if not part: continue
    out = [f"# Image brief: openmesh-{g}\n",
     "You are generating source plates for 3D reconstruction (image-to-3D). Use your built-in image generation tool (image_gen). Do NOT call any API with a key and do NOT write code that generates or draws or edits images: every picture must come from image_gen.\n",
     "Each shot below is the OTHER STATE (open, or shut) of an existing game prop whose look must be matched exactly. First LOOK at every reference image the prompt names (they are in this folder under ref/<id>/: renders of the existing 3D model, and sometimes its original source plate), and pass them to image_gen as reference images. Then generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square), with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing).\n",
     "Then look at your own result and check: (1) exactly one object, whole, with clear margin on every side (nothing cut off by the frame); (2) the background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it is plainly the SAME object as the references (same design, materials, colours, proportions), side by side it would read as a matching pair; (4) it is plainly in the state the shot asks for, as stated under 'State'; (5) no text, no floor, no shadow, no people. If a check fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.\n",
     f"Append one line per shot to `LOG-{g}.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots in the order listed; finish each one completely (file saved, LOG line written) before starting the next, so finished plates can be picked up while you work. When all are done, write `plates/DONE-{g}` containing the list of saved ids.\n",
     "## Shots\n"]
    for i in part:
        t = T[i]
        out.append(f"### {i}\nSize: 1024x1024 (square)\nState: {checks(t)}\n\nPrompt:\n\n{prompt(t)}\n")
    (E / f'BRIEF-{g}.md').write_text('\n'.join(out))
    print(E / f'BRIEF-{g}.md', len(part))
