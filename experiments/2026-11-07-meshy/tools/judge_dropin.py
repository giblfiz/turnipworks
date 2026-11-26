#!/usr/bin/env python3
"""Blind before/after read of the drop-in in its own rooms (one agy call): which of each pair is the better room, do the
shelves' goods / the racks' fronts face the aisles, anything floating, clipping or out of scale.
  python3 judge_dropin.py BEFORE_DIR AFTER_DIR OUT.json"""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from judge import agy, stage, RULES  # noqa: E402  (judge.py's parts run only when asked: PARTS from argv[3])

B, A, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
rng = random.Random(1108); items = []; pairs = {}
for s, what in (('store-shelving', 'convenience-store shelving aisles (gondolas) stocked with goods'), ('server-rack', 'server racks')):
    for view in ('room-table', 'room-close'):
        two = [('before', B / f'{s}--cur--{view}.png'), ('after', A / f'{s}--cur--{view}.png')]; rng.shuffle(two)
        items += [(f'{s}|{view}|{w}', p) for w, p in two]; pairs[(s, view)] = what
d, names = stage(items, 1200)
inv = {v: k for k, v in names.items()}
lines = '\n'.join(f'- pair: {inv[f"{s}|{v}|{w0}"]} and {inv[f"{s}|{v}|{w1}"]} ({what}, {"whole room at table distance" if v == "room-table" else "closer"})'
                  for (s, v), what in pairs.items() for w0, w1 in [sorted(['before', 'after'])])
ans = agy(d, RULES + "Each PAIR below shows the same generated room twice with different 3D models for the named things. For each image, first list any "
          "readable text; then judge the named things: reads_as 0-10, clean 0-10 (straight, regular, crisp vs melted or blobby), faces_ok (yes/no/unclear: do the "
          "goods on the shelves / the fronts of the racks face the aisles and open floor rather than a wall or each other's backs), problems (floating, clipping, "
          "out of scale, wrong way round). Then say which image of each pair is the better room for players and why in one line.\n" + lines +
          '\nAnswer ONLY with JSON: {"images": {"<name>": {"text": [], "reads_as": 0, "clean": 0, "faces_ok": "yes", "problems": "..."}}, "pairs": [{"a": "<name>", "b": "<name>", "better": "<name>", "why": "..."}]}')
OUT.write_text(json.dumps({'names': names, 'answer': ans}, indent=1)); print('done', bool(ans))
