#!/usr/bin/env python3
"""Gemini's BLIND read of the before/after lineups and the standing pterodactyl (dinohuge lane, 2026-11-07), through
agy-run (the dinos lane's agy.py: an isolated folder, random names, stdin closed). Never told which lineup is which,
nor what changed. -> blind.json
    python3 blind.py"""
import json, random, sys
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE.parent / '2026-11-07-dinos'))
from agy import gemini, last_json
U = Path('/mnt/usb/turnip-works/lanes-2026-11-07/dinohuge'); W = U / 'blind-in'; W.mkdir(exist_ok=True)
random.seed(1107); tag = {}
for k in ('before', 'after'):
    im = Image.open(U / k / 'lineup-low.png'); n = f'row-{random.randrange(10**4):04d}.png'
    im.crop((240, 200, 1760, 440)).resize((1520 * 2, 240 * 2), Image.LANCZOS).save(W / n); tag[n] = k
n = f'fig-{random.randrange(10**4):04d}.png'; Image.open(U / 'ptero-stand/foe-pterodactyl-lean.png').save(W / n); tag[n] = 'ptero-lean'
P = """You are checking painted tabletop miniature figures in a 3D game, seen on round bases on a grid floor. Report what is WRITTEN or LABELLED in each image first (any text, numbers, labels), then the figures.
For each image whose name starts with "row-": the figures stand in one row. Going LEFT TO RIGHT, for each figure give: what animal it is (your best guess of the species), its height relative to the others (rank 1 = tallest in that row), and whether its round base is small, medium, large or very large compared with the others. Then say which figure is the tallest and whether any figure looks too big or too small next to the others for what that animal is.
Then compare the two "row-" images: they show the same figures; list which figures are DIFFERENT in size or shape between the two images and how.
For the image whose name starts with "fig-": one figure on its round base. What creature, what pose (standing, flying, wings folded or spread), and does it sit right on its base: is its body or feet touching the base, floating above it, or sunk into it?
Answer with JSON at the end: {"labels": {...}, "rows": {"<name>": {"left_to_right": [{"animal":..,"height_rank":..,"base":..}], "tallest":.., "odd_sizes":..}}, "differences": [..], "fig": {"creature":..,"pose":..,"on_base":..,"notes":..}}"""
txt = gemini(P, sorted(W.glob('*.png')))
j = last_json(txt) or {'raw': txt}
json.dump({'key': tag, 'read': j}, open(HERE / 'blind.json', 'w'), indent=1)
print(json.dumps({'key': tag, 'read': j}, indent=1))
