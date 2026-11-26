#!/usr/bin/env python3
"""review.py's three blind reads, BATCHED: up to N figures per Gemini call (the shared agy lock was the bottleneck:
another lane's calls held it 4-5 minutes each, and review.py makes three calls a figure).
    python3 review_batch.py [ids...] [--n=4] [--only=facing,table,pair]
1. FACING: each figure's four-view sheet (img1..imgN): which panel shows the face -> yaw.json; re-measures turned ones.
2. TABLE: each figure alone, 10 ft over its base, at table distance: flying? what creature? -> blind.json
3. PAIR: standing beside flying: same creature, same body size? -> blind.json[id].pair"""
import json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, FLIERS, gemini, last_json, standing
from shoot import shoot
from review import sheet, YAW_OF, YF, BF, TRIM

load = lambda p: json.loads(p.read_text()) if p.exists() else {}
arg = lambda k, d: next((a.split('=', 1)[1] for a in sys.argv if a.startswith(k + '=')), d)
N = int(arg('--n', 4)); ONLY = arg('--only', 'facing,table,pair').split(',')
if arg('--blind', None): BF = HERE / arg('--blind', None)   # (a second run at the same time writes its own file; merged after)
ids = [a for a in sys.argv[1:] if not a.startswith('--')] or [i for i in FLIERS if (HERE / 'qa' / f'{i}.json').exists()]
chunks = [ids[k:k + N] for k in range(0, len(ids), N)]
OUT = '\nAnswer for EACH image separately, in order. End your reply with ONE JSON object: {"images": [ <one object per image, in order, of the form below> ]}\n'

FACE = """Each image (img1, img2, ...) is a sheet of four views of ONE painted miniature figure of a flying creature; the images show different figures. In each sheet every panel is labelled with a big letter (A, B, C, D) in its top-left corner: the camera goes round the figure, so each panel is the same figure from a different side. First list the labels you can read.
For each image: which panel shows the creature's FACE pointing most directly toward the viewer?""" + OUT + '{"image": "img1", "front": "A"|"B"|"C"|"D", "confidence": 0.0-1.0, "panels": "<A: ..., B: ..., C: ..., D: ...>"}'
TABLE = """Each image (img1, img2, ...) is a still from a 3D tabletop game, at the distance a player sees the table from; each shows a different miniature figure over a round grey base, joined to it by a coloured rod. First list any text or labels you can read in each.
For each image: what creature is the figure (best guess and second guess)? Is it FLYING (airborne, wings spread) or standing / perched? What colours is it painted? Is anything about it malformed, broken, see-through or hard to read?""" + OUT + '{"image": "img1", "creature": "<best guess>", "second": "<second guess>", "flying": true|false, "wings": "spread|folded|none seen", "colours": "...", "faults": "<short or none>", "blind": "<one sentence describing the figure>"}'
PAIR = """Each image (img1, img2, ...) is a still from a 3D tabletop game: two miniature figures, each over a round grey base on a floor with a 5-ft grid. The LEFT one stands; the RIGHT one is raised on a coloured rod. Each image is a different pair. First list any text or labels you can read.
For each image: are the two the SAME creature, painted the same way? Judge the SIZE of the creatures' BODIES (head size, body bulk, leg thickness), not wingspan or height: is the right one's body about the same size as the left one's, clearly bigger, or clearly smaller, and by about how much?""" + OUT + '{"image": "img1", "same_creature": true|false, "same_paint": true|false, "right_body_vs_left": "same|bigger|smaller", "ratio": <right body / left body, e.g. 1.0>, "notes": "<short>"}'


def ask(prompt, imgs, tag):
    txt = gemini(prompt, imgs, timeout=420)
    (HERE / 'gemini').mkdir(exist_ok=True); (HERE / 'gemini' / f'{tag}.txt').write_text(txt)
    j = last_json(txt) or {}; rows = j.get('images') or []
    return rows + [{}] * (len(imgs) - len(rows))


Y, B = load(YF), load(BF)
for ch in chunks:
    if 'facing' in ONLY:
        todo = [i for i in ch if i not in Y]
        if todo:
            rows = ask(FACE, [sheet(i) for i in todo], 'facing-' + '+'.join(todo)[:120])
            for i, r in zip(todo, rows):
                Y[i] = YAW_OF.get(str(r.get('front', 'A')).strip()[:1], 0); print(i, 'facing', r.get('front'), r.get('confidence'), '-> yaw', Y[i], flush=True)
                YF.write_text(json.dumps(Y, indent=1) + '\n')
                if Y[i] != json.loads((HERE / 'qa' / f'{i}.json').read_text())['facing_deg']: subprocess.run([TRIM, str(HERE / 'measure_fly.py'), i], capture_output=True, text=True)
    if 'table' in ONLY:
        rows = ask(TABLE, [shoot('table', i) for i in ch], 'table-' + '+'.join(ch)[:120])
        for i, r in zip(ch, rows):
            B.setdefault(i, {}).update(blind=r.get('blind'), flying=r.get('flying'), creature_guess=r.get('creature'), second=r.get('second'), wings=r.get('wings'), faults=r.get('faults'), name=standing()[i]['name'])
            print(i, 'TABLE', json.dumps(r)[:400], flush=True)
        BF.write_text(json.dumps(B, indent=1) + '\n')
    if 'pair' in ONLY:
        rows = ask(PAIR, [shoot('pair', i) for i in ch], 'pair-' + '+'.join(ch)[:120])
        for i, r in zip(ch, rows):
            B.setdefault(i, {})['pair'] = r; print(i, 'PAIR', json.dumps(r)[:300], flush=True)
        BF.write_text(json.dumps(B, indent=1) + '\n')
