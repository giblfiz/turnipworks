#!/usr/bin/env python3
"""Blind reads of the dinosaurs IN THE GAME (shots/<id>-<mode>.png from table_shots.py; after the cyberpunk lane's
blind.py): Gemini through agy-run, ALL crops in one or two calls (random neutral names, shuffled, never told what any is).
Open question: which animal? The set's old tyrannosaur and triceratops are in the batch as the control.
    python3 blind.py [table|lean] [--batch=12]      -> blind-<mode>.json and a score line
A read is right when its species names the figure (or an accepted synonym: a brontosaurus read as any sauropod,
a pterodactyl as pteranodon / pterosaur)."""
import json, random, string, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE)); from agy import gemini, last_json
mode = next((a for a in sys.argv[1:] if not a.startswith('--')), 'table')
B = int(next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--batch=')), 12))
OK = {'foe-tyrannosaur': ['tyrannosaur', 't-rex', 't. rex', 'trex'], 'foe-triceratops': ['triceratops'], 'foe-velociraptor': ['velociraptor', 'raptor', 'deinonychus', 'utahraptor', 'dromaeosaur'],
      'foe-ankylosaurus': ['ankylosaur'], 'foe-stegosaurus': ['stegosaur'], 'foe-spinosaurus': ['spinosaur'],
      'foe-brontosaurus': ['brontosaur', 'apatosaur', 'brachiosaur', 'diplodocus', 'sauropod', 'camarasaur', 'long-neck', 'long neck'],
      'foe-pterodactyl': ['pterodactyl', 'pteranodon', 'pterosaur'], 'foe-quetzalcoatlus': ['quetzalcoatlus', 'azhdarchid', 'pterosaur', 'pterodactyl', 'pteranodon'],
      'foe-pterodactyl-fly': ['pterodactyl', 'pteranodon', 'pterosaur'], 'foe-quetzalcoatlus-fly': ['quetzalcoatlus', 'azhdarchid', 'pterosaur', 'pterodactyl', 'pteranodon']}
ONLY = next((x.split('=', 1)[1].split(',') for x in sys.argv if x.startswith('--only=')), None)
todo = [i for i in OK if (HERE / 'shots' / f'{i}-{mode}.png').exists() and (ONLY is None or i in ONLY)]
random.seed(11); random.shuffle(todo)
P = """Each image is a crop from a 3D tabletop game, seen from the players' camera: one painted miniature creature
standing on (or flying above) a round base on the table. Judge only the figure in the MIDDLE. You are not told what any
of them is meant to be. For EACH image, list first any text or labels you can read, then say:
- animal: what animal it is, as SPECIFICALLY as you can (the species if you can name it);
- how sure you are (0-1);
- what made you decide (one short phrase);
- facing: which way its HEAD and FACE point relative to the camera: toward, away, left, right (or between, e.g. toward-left);
- anything that looks broken, melted, floating or missing.
Answer with ONE JSON object and nothing after it:
{"images": [{"image": "<file name>", "labels": "<text seen or none>", "animal": "...", "conf": 0.0, "cue": "...", "facing": "...", "faults": "<short or none>"}, ...]}"""
OUT = HERE / f"blind-{mode}{'-' + '-'.join(ONLY) if ONLY else ''}.json"; res = {}
for s in range(0, len(todo), B):
    chunk = todo[s:s + B]; tag = ''.join(random.choice(string.ascii_lowercase) for _ in range(4))
    names = {f'fig{k + 1}{tag}.png': i for k, i in enumerate(chunk)}
    txt = gemini(P, [(HERE / 'shots' / f'{i}-{mode}.png', n) for n, i in names.items()], timeout=600)
    for v in (last_json(txt) or {}).get('images', []):
        i = names.get(str(v.get('image', '')).strip())
        if i: res[i] = v
    OUT.write_text(json.dumps(res, indent=1) + '\n')
right = 0
for i in todo:
    v = res.get(i, {}); a = str(v.get('animal', '')).lower(); hit = any(w in a for w in OK[i]); right += hit
    print(f"{'ok  ' if hit else 'MISS'} {i:26s} -> {v.get('animal')} ({v.get('conf')}; {v.get('cue')}) facing {v.get('facing')}; faults: {v.get('faults')}")
print(f'{mode}: {right}/{len(todo)} read as the right animal ({len(res)} read)')
