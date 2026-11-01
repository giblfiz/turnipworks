#!/usr/bin/env python3
"""Caves in the game (2026-10-25): the tuner data entries build_data.py would write for the cave room type and its
floor, written by hand (build_data.py needs every experiment's git-ignored binaries; the landing script re-runs it in
the main checkout and checks it writes the same). Idempotent.  python3 experiments/2026-10-25-caves-game/add_tuner_data.py"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]; T = ROOT / 'tools/spawn-tuner'
p = T / 'data/rooms.json'; R = json.loads(p.read_text())
R = [r for r in R if r['key'] != 'cave']
assert R[-1]['key'] == 'hill', R[-1]['key']
R.append({"key": "cave", "floors": ["floor-cave-rock", "floor-cut-rock", "floor-earth-packed", "floor-earth-bare"], "label": "Cave", "program": "generic", "family": "cut-rock", "cells": [7, 5],
          "recipes": ["lai-cave", "dun-cave", "min-cave"], "color": "#6e6252", "byHand": True, "slots": {}, "missing": []})
p.write_text(json.dumps(R, indent=1))
p = T / 'data/library.json'; L = json.loads(p.read_text())
L['objects']['floor-cave-rock'] = {"id": "floor-cave-rock", "desc": "natural cave floor: uneven water-worn rock, dark seams and grit, no joints", "place": "kit", "fp": "1", "size": [60.0, 60.0, 1.0], "scale": [0.9, 1.1], "mat": "stone", "aff": [], "gen": "flat", "pri": "P1", "hint": "natural caves, caverns, dens", "var": [],
    "skus": [{"sku": "floor-cave-rock", "family": "", "tier": "", "shape": "v1", "piece": "", "src": "caves-01", "model": None, "kind": "flat", "url": "assets/flat/floor-cave-rock.webp", "px": [512, 512]}]}
p.write_text(json.dumps(L, indent=1))
p = T / 'prep/flats.json'; F = [f for f in json.loads(p.read_text()) if f['sku'] != 'floor-cave-rock']
F.append({"sku": "floor-cave-rock", "plate": "experiments/2026-10-05-caves/floor/floor-cave-rock.png", "opaque": True})
p.write_text(json.dumps(F, indent=1))
print('ok')
