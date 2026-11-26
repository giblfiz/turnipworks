#!/usr/bin/env python3
"""Blind Gemini reads of the in-game stills (agy-run, shared queue: few calls, many images, random names, isolated folders).

  python3 judge.py RENDERS OUT.json [A,B,C]
A  name read: all 24 'alone-close' stills shuffled together, no target given ("what is this object?").
B  scoring, two calls of three subjects: per image the target is named; labels/text first, then reads-as, geometry,
   texture, defects (0-10 each); then a rank inside each subject group of 8 (4 versions x alone-close + room-close).
C  table distance: the 24 'room-table' stills: find the target in the room, how well it reads at this distance.
The name map stays outside the isolated folders (OUT.json gets it after the answers come back).
"""
import json, random, re, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

MAIN = __name__ == '__main__'
R = Path(sys.argv[1]) if MAIN else None; OUT = Path(sys.argv[2]) if MAIN else Path('/nonexistent'); PARTS = (sys.argv[3] if len(sys.argv) > 3 else 'A,B,C').split(',') if MAIN else []
SUBJ = {'store-shelving': 'a convenience-store shelving aisle (gondola) stocked with colourful goods',
        'server-rack': 'a tall server rack with glowing status lights',
        'drinks-cooler': 'a glass-door shop drinks fridge full of bottles',
        'fence-chain-link': 'a section of chain-link fence between two posts',
        'pallet-racking': 'tall warehouse pallet racking loaded with boxes',
        'antenna-mast': 'a red-and-white lattice antenna mast'}
VERS = ['cur', 'tr2', 'mx7', 'mxt']
rng = random.Random(1107)
res = json.loads(OUT.read_text()) if OUT.exists() else {}
RULES = ("Do NOT create, crop, edit or write any files. Do not run commands and do not open any file except the images named here, "
         "in this folder. These are screenshots from a 3D tabletop game; ignore interface overlays (buttons, panels, menus) at the edges. ")


def agy(d, prompt):
    for _ in range(2):
        r = subprocess.run(['flock', '/tmp/agy.lock', '~/fauna-tools/agy-run', '-t', '900', '-C', str(d), prompt],
                           capture_output=True, text=True, timeout=5400, stdin=subprocess.DEVNULL)
        for m in re.finditer(r'[\[{]', r.stdout):
            try: return json.JSONDecoder().raw_decode(r.stdout[m.start():])[0]
            except json.JSONDecodeError: continue
        print('no JSON from agy:', r.stdout[-500:], r.stderr[-300:])
    return None


def stage(items, w=1000):
    """items: [(key, path)] -> isolated folder with random names; returns (folder, {name: key})"""
    d = Path(tempfile.mkdtemp(prefix='agy-meshy-')); names = {}
    for key, p in items:
        n = f'{rng.randrange(16**6):06x}.jpg'; im = Image.open(p).convert('RGB')
        im = im.crop((40, 50, im.width - 60, im.height - 50)); im.thumbnail((w, w)); im.save(d / n, quality=88); names[n] = key
    return d, names


if 'A' in PARTS:
    items = [(f'{s}|{v}', R / f'{s}--{v}--alone-close.png') for s in SUBJ for v in VERS]; rng.shuffle(items)
    d, names = stage(items)
    ans = agy(d, RULES + f"There are {len(names)} images: {', '.join(names)}. Each shows ONE object standing alone on the table. "
              "For each image, first list any text you can read on it, then name the object in a short plain phrase as you would to a player "
              "(what is it?), give your confidence 0-100, and the setting it suggests (fantasy / modern / sci-fi / unclear). "
              'Answer ONLY with JSON: {"<image name>": {"text": [], "object": "...", "confidence": 0, "setting": "..."}, ...}')
    res['A'] = {'names': names, 'answer': ans}; OUT.write_text(json.dumps(res, indent=1)); print('A done', bool(ans))

if 'B' in PARTS:
    subs = list(SUBJ); res['B'] = []
    for k in range(0, len(subs), 3):
        group = subs[k:k + 3]; items = []
        for s in group:
            g = [(f'{s}|{v}|{view}', R / f'{s}--{v}--{view}.png') for v in VERS for view in ('alone-close', 'room-close')]; rng.shuffle(g); items += g
        d, names = stage(items)
        by = {s: [n for n, key in names.items() if key.startswith(s + '|')] for s in group}
        lines = '\n'.join(f'- group "{s}": the wanted object is {SUBJ[s]}. Images: {", ".join(by[s])}' for s in group)
        ans = agy(d, RULES + "The images come in groups; inside a group every image shows a version of the SAME wanted object (some alone on the "
                  "table, some in their room: judge the wanted object, not the room). The versions were made by different methods; judge only what you see.\n"
                  + lines + "\nFor EVERY image: first list any readable text and every label you see; then score 0-10: reads_as (how clearly it reads as the "
                  "wanted object), geometry (clean straight shelves, posts and regular repeated units, crisp edges = 10; melted, lumpy, warped or blobby = 0), "
                  "texture (clean, coherent painted surface that matches the shapes = 10; smeared, noisy, misaligned = 0), and name the worst defects in a few words. "
                  "Then for each group rank the images best to worst for use in the game. Answer ONLY with JSON: "
                  '{"images": {"<name>": {"text": [], "reads_as": 0, "geometry": 0, "texture": 0, "defects": "..."}}, "rank": {"<group>": ["<name>", ...]}}')
        res['B'].append({'names': names, 'answer': ans}); OUT.write_text(json.dumps(res, indent=1)); print('B part done', bool(ans))

if 'C' in PARTS:
    items = [(f'{s}|{v}', R / f'{s}--{v}--room-table.png') for s in SUBJ for v in VERS]; rng.shuffle(items)
    d, names = stage(items, 1200)
    tgt = {n: SUBJ[key.split('|')[0]] for n, key in names.items()}
    ans = agy(d, RULES + "Each image is a whole room seen from above at the distance of players round a table. In each, find the wanted object "
              "named for that image (there may be several copies of it) and judge it AT THIS DISTANCE. Images and wanted objects:\n"
              + '\n'.join(f'- {n}: {t}' for n, t in tgt.items()) + "\nFor EVERY image: first list any readable text; then found (yes/no), "
              "reads_as 0-10 (would a player recognise it at once as the wanted object?), clean 0-10 (straight, regular, crisp silhouette vs melted or "
              'blobby), and the worst defect in a few words. Answer ONLY with JSON: {"<name>": {"text": [], "found": "yes", "reads_as": 0, "clean": 0, "defect": "..."}}')
    res['C'] = {'names': names, 'answer': ans}; OUT.write_text(json.dumps(res, indent=1)); print('C done', bool(ans))
