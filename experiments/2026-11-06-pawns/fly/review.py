#!/usr/bin/env python3
"""The blind reads (Gemini through agy-run; neutral names, an isolated folder):
  1. FACING: the flying mesh from four sides on one sheet (A front, B right, C back, D left of the mesh's own +Z):
     which panel shows its face? -> yaw.json (the turn that puts its face on +Z, the engine's front).
  2. AT THE TABLE: the flying figure alone, 10 ft over its base, at table distance: "is this flying? what creature?"
  3. SIZE: the standing figure and the flying one side by side: the same creature, the same size?
    python3 review.py [ids...] [--skip-yaw]      -> yaw.json, blind.json, shots/
Needs measure_fly.py run first (qa/<id>.json); re-runs it for an id whose yaw changed."""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HERE, FLIERS, gemini, last_json, standing
from shoot import shoot

TRIM = '~/.local/share/tw-trimesh-venv/bin/python'
YF, BF = HERE / 'yaw.json', HERE / 'blind.json'
load = lambda p: json.loads(p.read_text()) if p.exists() else {}


def sheet(i):
    views = [shoot(f'yaw{d}', i, HERE / 'shots' / f'{i}-v{d}.png') for d in (0, 90, 180, 270)]
    W = 640; S = Image.new('RGB', (2 * W, 2 * W), (200, 200, 205)); dr = ImageDraw.Draw(S)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 44)
    except Exception: font = ImageFont.load_default()
    for k, (p, lab) in enumerate(zip(views, 'ABCD')):
        im = Image.open(p).convert('RGBA'); bg = Image.new('RGBA', im.size, (200, 200, 205, 255)); bg.alpha_composite(im)
        S.paste(bg.convert('RGB').resize((W, W)), ((k % 2) * W, (k // 2) * W)); dr.text(((k % 2) * W + 16, (k // 2) * W + 10), lab, fill=(20, 20, 20), font=font)
    out = HERE / 'shots' / f'{i}-sheet.png'; S.save(out); return out


FACE = """img1 is a sheet of four views of ONE painted miniature figure of a flying creature, each panel labelled with a big letter (A, B, C, D) in its top-left corner. First list the labels you can read. The camera goes round the figure: each panel is the same figure seen from a different side.
For each panel say what you see of the creature: its face / front, its right side, its back / tail, or its left side.
Then: in WHICH panel is the creature's FACE pointing most directly toward the viewer?
End with ONE JSON object: {"labels": ["..."], "panels": {"A": "...", "B": "...", "C": "...", "D": "..."}, "front": "A"|"B"|"C"|"D", "confidence": 0.0-1.0}"""
TABLE = """img1 is a still from a 3D tabletop game, at the distance a player sees the table from. First list any text or labels you can read in it. Then describe the miniature figure standing over the round grey base: what creature is it (best guess and a second guess)? Is it FLYING (airborne, wings spread) or standing / perched on something? What colours is it painted? Is anything about it malformed, broken, see-through or hard to read?
End with ONE JSON object: {"labels": ["..."], "creature": "<best guess>", "second": "<second guess>", "flying": true|false, "wings": "spread|folded|none seen", "colours": "...", "faults": "<short or none>", "blind": "<one sentence describing the figure>"}"""
PAIR = """img1 is a still from a 3D tabletop game: two miniature figures, each over a round grey base on a floor with a 5-ft grid. First list any text or labels you can read. The LEFT one stands; the RIGHT one is raised up on a coloured rod.
Are the two the SAME creature, painted the same way? Judge the SIZE of the creatures' bodies (head size, body bulk, leg thickness), not wingspan or height: is the right one's BODY about the same size as the left one's, clearly bigger, or clearly smaller? By about how much?
End with ONE JSON object: {"labels": ["..."], "same_creature": true|false, "same_paint": true|false, "right_body_vs_left": "same|bigger|smaller", "ratio": <right body size / left body size, e.g. 1.0>, "notes": "..."}"""
YAW_OF = {'A': 0, 'B': 270, 'C': 180, 'D': 90}   # the panel the face is seen in -> the turn that brings the face onto +Z


if __name__ == '__main__':
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or [i for i in FLIERS if (HERE / 'qa' / f'{i}.json').exists()]
    Y, B = load(YF), load(BF)
    for i in ids:
        if '--skip-yaw' not in sys.argv and i not in Y:
            q = json.loads((HERE / 'qa' / f'{i}.json').read_text())
            if q['facing_deg']: print(i, 'qa already turned; re-measure with yaw 0 first'); continue
            txt = gemini(FACE, [sheet(i)]); j = last_json(txt) or {}
            Y[i] = YAW_OF.get(str(j.get('front', 'A')).strip()[:1], 0); YF.write_text(json.dumps(Y, indent=1) + '\n')
            (HERE / 'gemini').mkdir(exist_ok=True); (HERE / 'gemini' / f'{i}-facing.txt').write_text(txt)
            print(i, 'facing', j.get('front'), j.get('confidence'), '-> yaw', Y[i], flush=True)
            if Y[i]: subprocess.run([TRIM, str(HERE / 'measure_fly.py'), i], capture_output=True, text=True)
        t = shoot('table', i); p = shoot('pair', i)
        tj = last_json(gemini(TABLE, [t])) or {}; pj = last_json(gemini(PAIR, [p])) or {}
        crit = standing()[i]['name'].lower(); guess = f"{tj.get('creature', '')} {tj.get('second', '')}".lower()
        B[i] = {'blind': tj.get('blind'), 'flying': tj.get('flying'), 'creature_guess': tj.get('creature'), 'second': tj.get('second'), 'wings': tj.get('wings'), 'faults': tj.get('faults'),
                'pair': pj, 'name': crit}
        BF.write_text(json.dumps(B, indent=1) + '\n')
        print(i, json.dumps(B[i])[:700], flush=True)
