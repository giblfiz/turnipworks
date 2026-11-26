#!/usr/bin/env python3
"""BRIEF-<n>.md for the Codex image workers (built-in image_gen on the ChatGPT plan; no API key, no paid API): one plate per
target of targets.json, in the house style (D, heroic hand-painted). A wall SIBLING is an edit of its parent's accepted
plate (plates/<parent>.png), so it is only briefed once that exists.
  python3 tools/briefs.py N [id ...]       (N workers; ids default to every target with no plate yet whose parent, if any, has one)
Then run each:  codex exec --skip-git-repo-check -s workspace-write -C <this folder> - < BRIEF-k.md   (tools/plates.sh)"""
import json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent
T = {t['id']: t for t in json.loads((E / 'targets.json').read_text())}
STYLE_REF = 'style-references/heroic-handpainted-tavern-v1.png'
style = (E.parents[2] / 'style/heroic-handpainted.object.md').read_text()
head, rest = style.split('\n\nGeometry:', 1)
body = 'Geometry:' + rest.split('\n\nPresentation for image-to-3D:')[0]
VIEW = {'prop': 'three-quarter front view from ABOVE (camera elevation about 30 degrees), so the front and the top are both visible',
        'top': 'three-quarter view from HIGH above (camera elevation about 50 degrees), so its whole top and its height are both plainly visible',
        'wall': 'seen from its broad face at a slight three-quarter angle from slightly above (camera elevation about 15 degrees), the whole face visible'}

def prompt(t):
    w, d, h = t['size']
    view = VIEW['wall' if t['kind'] == 'wall' else (t.get('view') or 'prop')]
    if t['kind'] == 'wall':
        piece = {'wall-straight': 'a straight wall section', 'wall-doorway': 'a wall section with an empty door opening', 'wall-window-small': 'a wall section with a window'}[t['obj']]
        design = (t['design'] + ' It is a TALL, NARROW upright slab, almost TWICE as tall as it is wide (portrait format, like a wide door standing on end), about'
                  ' 5 ft wide, 9 ft tall and 1 ft thick. It must NOT be square and must NOT be wider than it is tall. The top edge is one level line, the bottom'
                  ' edge sits flat, and both side edges are clean flat vertical cuts so that copies butt together into a longer wall. NO floor, NO ground, NO'
                  ' base slab, NO roof, NO corner return, nothing attached.')
        if t.get('parent'):
            design = ('The reference image plates/' + t['parent'] + '.png is the existing plain straight section of this SAME wall. The new piece must look cut'
                      ' from the same wall: the SAME materials, colours, thickness, height, width and proportions, painting style and camera angle. Change ONLY'
                      ' what is described here: ' + design)
        subj = piece
    else:
        subj = t['desc']
        design = (t['design'] + f' Real-world size about {w:g} in wide x {d:g} in deep x {h:g} in tall: keep these proportions.'
                  ' It stands on nothing: NO floor, NO rug, NO ground patch, NO base slab or plinth under it that the real object would not have.')
    return (head.replace('{subject}', subj).replace('Using the supplied image only', 'Using the style reference image only') + '\n\n' + body +
            f'\n\nPresentation for image-to-3D: exactly one complete asset, centered, {view}, generous clear space around every edge, a genuinely TRANSPARENT'
            ' background (no floor plane, no horizon, no cast shadow, no environment), neutral even lighting with no coloured light casts, no people or'
            ' animals, no additional loose objects, no text or lettering. Thick reconstructible parts; no wires, chains, thin spikes or isolated floating components.'
            f'\n\nSpecific design: {design}')

n = int(sys.argv[1])
ids = sys.argv[2:] or [i for i, t in T.items() if not (E / 'plates' / f'{i}.png').exists() and (not t.get('parent') or (E / 'plates' / f"{t['parent']}.png").exists())]
groups = [ids[k::n] for k in range(n)]
for g, part in enumerate(groups, 1):
    if not part: continue
    out = [f'# Image brief: culture-roofs-{g}\n',
           'You are generating source plates for 3D reconstruction (image-to-3D) for a tabletop game. Use your built-in image generation tool (image_gen).'
           ' Do NOT call any API with a key and do NOT write code that generates, draws or edits images: every picture must come from image_gen.\n',
           f'For each shot below: pass the house STYLE REFERENCE image `{STYLE_REF}` to image_gen as a style reference (and, where the prompt names one, the'
           ' plates/<id>.png reference in this folder too). Generate ONE image from the prompt EXACTLY as written (copy it verbatim), size 1024x1024 (square),'
           ' with a transparent background. Save it as `plates/<id>.png` in this folder (create `plates/` if missing). The image tool may return another size or'
           ' aspect (portrait, landscape, 1254 px): THAT IS FINE, keep it as it is; never retry for size.\n',
           'Then look at your own result and check: (1) exactly one object, whole, nothing cut off by the frame (a tight margin is fine); (2) the'
           ' background is genuinely transparent (check with Python/PIL that the PNG has an alpha channel and the corners are alpha 0); (3) it plainly shows'
           ' what the shot asks for (the line `Should read as`), with the proportions asked for; (4) no text, no floor, no shadow, no people. If a check'
           ' fails, generate again (at most 3 tries per shot) and keep the best; overwrite the file only with a better one.\n',
           f'Append one line per shot to `LOG-{g}.md`: id, tries, the checks that passed or failed, and one sentence on what the picture shows. Do the shots'
           ' in the order listed; finish each one completely (file saved, LOG line written) before starting the next. When all are done, write'
           f' `plates/DONE-{g}` containing the list of saved ids.\n', '## Shots\n']
    for i in part:
        out.append(f"### {i}\nSize: 1024x1024 (square)\nShould read as: {T[i]['see']}\n\nPrompt:\n\n{prompt(T[i])}\n")
    (E / f'BRIEF-{g}.md').write_text('\n'.join(out))
    print(E / f'BRIEF-{g}.md', len(part))
