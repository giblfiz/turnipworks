"""Build the Spawn Tuner's data: library.json (objects with real-world size + available meshes), rooms.json
(room types = groups of catalog recipes), and prep/jobs.json (runtime-tier downsample jobs for Blender).

Run from the repo root:  python3 tools/spawn-tuner/build_data.py
Meshes: inn-01 (experiments/2026-09-30-inn-01-500/models) with the inn-01b remeshes, then inn-02 (experiments/inn-02/models), winning where they exist.
Ratings (reviews/latest.json) ride along so the tuner can filter or flag them; unrated meshes are fine (Harry).
"""

from __future__ import annotations

import csv
import hashlib
import subprocess
import json
import pathlib
import sys

from factions import faction_data, add_faction_assets

ROOT = pathlib.Path(__file__).resolve().parents[2]
TOOL = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))
import catalog_tool as ct  # noqa: E402
sys.path.insert(0, str(ROOT / "server"))
from reviews_home import reviews_dir  # noqa: E402  the live ratings are outside the checkout (TW_REVIEWS_DIR)

INN01 = ROOT / "experiments/2026-09-30-inn-01-500"
REMESH = ROOT / "experiments/2026-09-30-inn-01b-remesh"
SMALL_IN = 14.0  # largest catalog dimension at or under this -> small tier (Harry: 3k often OK, 128 often OK)
TIERS = {"default": (5000, 256), "small": (3000, 128), "kit": (5000, 256)}

# Room types for the palette. Each is a set of catalog recipes; the solver program (solver.js) decides where
# things go. "family" = structure kit family for walls/floors. Sizes are default drag hints in 5-ft cells.
ROOM_TYPES = [
    {"key": "common", "label": "Common room", "program": "common", "family": "rough-timber", "cells": [6, 4],
     "floors": ["floor-planks-worn", "floor-planks-stained", "floor-planks-rushes", "floor-planks-dark", "floor-flagstone-irregular", "floor-flagstone-large"], "recipes": ["tav-common-room", "tav-bar-service", "tav-place-setting", "tav-supper-service",
                 "tav-adventurers-table", "tav-bard-corner", "tav-common-fare"], "color": "#d9a441"},
    {"key": "kitchen", "floors": ["floor-flagstone-irregular", "floor-brick-herringbone-bw", "floor-checker-bw", "floor-checker-red", "floor-tile-kitchen-small", "floor-brick-herringbone", "floor-terracotta", "floor-tile-hex", "floor-planks-worn"], "label": "Kitchen", "program": "kitchen", "family": "rough-timber", "cells": [4, 3],
     "recipes": ["tav-kitchen", "tav-kitchen-tools", "tav-kitchen-larder"], "color": "#d9654f"},
    {"key": "storeroom", "floors": ["floor-boards-rough", "floor-planks-worn", "floor-earth-packed", "floor-flagstone-irregular", "floor-flagstone-large"], "label": "Storeroom", "program": "store", "family": "rough-timber", "cells": [3, 3],
     "recipes": ["tav-storeroom"], "color": "#9c7a4a"},
    {"key": "cellar", "floors": ["floor-flagstone-damp", "floor-flagstone-broken", "floor-flagstone-large", "floor-flagstone-square", "floor-earth-packed", "floor-cobble"], "label": "Cellar / pantry", "program": "store", "family": "dressed-stone", "cells": [4, 3],
     "recipes": ["tav-cellar", "tav-pantry-cellar"], "color": "#7d8a99"},
    {"key": "guest", "floors": ["floor-planks-worn", "floor-planks-dark", "floor-boards-rough"], "label": "Guest room", "program": "bedroom", "family": "rough-timber", "cells": [3, 3],
     "recipes": ["tav-guest-room", "tav-guest-room-full"], "color": "#8fb35a"},
    {"key": "fine", "floors": ["floor-planks-polished", "floor-parquet-herringbone", "floor-checker-stone", "floor-tile-delft", "floor-tile-harlequin", "floor-checker-bw"], "label": "Fine guest room", "program": "bedroom", "family": "rough-timber", "cells": [4, 4],
     "recipes": ["tav-guest-room-fine"], "color": "#b07cc6", "wealth": "fine"},
    {"key": "privy", "floors": ["floor-boards-rough", "floor-earth-packed", "floor-earth-bare"], "label": "Privy", "program": "privy", "family": "rough-timber", "cells": [2, 2],
     "recipes": ["tav-privy"], "color": "#6f8f7a"},
    {"key": "hallway", "floors": ["floor-planks-dark", "floor-planks-worn", "floor-flagstone-square", "floor-tile-harlequin", "floor-flagstone-large"], "label": "Hallway", "program": "hallway", "family": "rough-timber", "cells": [6, 2],
     "recipes": ["tav-hallway"], "color": "#c8b89a"},
    {"key": "desk", "floors": ["floor-planks-dark", "floor-tile-harlequin", "floor-tile-hex", "floor-tile-delft", "floor-checker-bw", "floor-flagstone-square", "floor-checker-stone", "floor-planks-polished"], "label": "Front desk", "program": "desk", "family": "rough-timber", "cells": [3, 3],
     "recipes": ["tav-front-desk"], "color": "#5fa8a0"},
    {"key": "stable", "floors": ["floor-earth-straw", "floor-earth-bare", "floor-cobble", "floor-boards-rough", "floor-flagstone-large", "floor-flagstone-broken"], "label": "Stable", "program": "stable", "family": "rough-timber", "cells": [6, 4],
     "recipes": ["tav-stable", "tav-stable-row"], "color": "#a8834f"},
    {"key": "barn", "floors": ["floor-earth-straw", "floor-earth-bare", "floor-boards-rough", "floor-flagstone-large", "floor-cobble"], "label": "Barn", "program": "barn", "family": "rough-timber", "cells": [6, 5],
     "recipes": ["tav-barn"], "color": "#8a5a3a"},
    # Outdoors (Harry 2026-10-05): a room with NO walls (walls.js role 'outdoor'); its floors are GROUND (first = default)
    {"key": "yard", "floors": ["floor-grass", "floor-earth-packed", "floor-cobble", "floor-gravel", "floor-earth-bare", "floor-grass-worn", "floor-grass-meadow", "floor-cobble-mossy"], "label": "Yard", "program": "outdoors", "family": "rough-timber", "cells": [6, 5],
     "recipes": ["tav-yard"], "color": "#6fae5c", "outdoor": True},
    # Crypt (2026-10-05): seven rooms, crypt-stone walls, no windows. v2 programs: js/solver2.js (the appended block)
    {'key': 'crypt-antechamber', 'label': 'Antechamber', 'program': 'generic', 'family': 'crypt-stone', 'cells': [4, 3], 'floors': ['floor-flagstone-damp', 'floor-flagstone-large', 'floor-tomb-slabs', 'floor-flagstone-broken'], 'recipes': ['cry-antechamber'], 'color': '#8a8fa8', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    {'key': 'crypt-vault', 'label': 'Burial vault', 'program': 'generic', 'family': 'crypt-stone', 'cells': [5, 4], 'floors': ['floor-tomb-slabs', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-flagstone-broken'], 'recipes': ['cry-burial-vault', 'cry-crypt', 'cry-royal-tomb'], 'color': '#6f7590', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    {'key': 'crypt-ossuary', 'label': 'Ossuary', 'program': 'generic', 'family': 'crypt-stone', 'cells': [4, 4], 'floors': ['floor-bone-strewn'], 'recipes': ['cry-ossuary', 'cry-catacombs'], 'color': '#a39a86', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    {'key': 'crypt-catacomb', 'label': 'Catacomb corridor', 'program': 'generic', 'family': 'crypt-stone', 'cells': [10, 3], 'floors': ['floor-earth-packed', 'floor-bone-strewn'], 'recipes': ['cry-catacomb-corridor', 'cry-catacombs'], 'color': '#5e6b7a', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    {'key': 'crypt-chapel', 'label': 'Chapel of rest', 'program': 'generic', 'family': 'crypt-stone', 'cells': [4, 7], 'floors': ['floor-tomb-slabs', 'floor-flagstone-square', 'floor-flagstone-large', 'floor-checker-stone', 'floor-flagstone-damp'], 'recipes': ['cry-chapel-of-rest'], 'color': '#b0a7c0', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    {'key': 'crypt-embalming', 'label': 'Embalming room', 'program': 'generic', 'family': 'crypt-stone', 'cells': [4, 4], 'floors': ['floor-flagstone-damp', 'floor-flagstone-square', 'floor-flagstone-large', 'floor-tile-kitchen-small'], 'recipes': ['cry-embalming-workroom', 'cry-embalming-room'], 'color': '#7f9a94', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    {'key': 'crypt-relic', 'label': 'Relic chamber', 'program': 'generic', 'family': 'crypt-stone', 'cells': [3, 3], 'floors': ['floor-flagstone-square', 'floor-checker-stone', 'floor-tomb-slabs', 'floor-flagstone-large', 'floor-flagstone-damp'], 'recipes': ['cry-relic-chamber', 'cry-grave-offerings'], 'color': '#c9b458', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    # Castle (2026-10-05): nine rooms; castle-rough for the working rooms, dressed-stone for hall, throne room and chapel
    {'key': 'great-hall', 'label': 'Great hall', 'program': 'generic', 'family': 'dressed-stone', 'cells': [10, 6], 'floors': ['floor-flagstone-rushes', 'floor-flagstone-square', 'floor-flagstone-large', 'floor-checker-stone', 'floor-planks-rushes'], 'recipes': ['cas-hall-high-table', 'cas-great-hall', 'cas-high-table-setting', 'cas-feast-spread'], 'color': '#b5533c', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'throne-room', 'label': 'Throne room', 'program': 'generic', 'family': 'dressed-stone', 'cells': [5, 8], 'floors': ['floor-checker-stone', 'floor-tile-encaustic', 'floor-flagstone-square', 'floor-checker-bw', 'floor-tile-harlequin'], 'recipes': ['cas-throne-dais', 'cas-throne-room'], 'color': '#c9a227', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'armoury', 'label': 'Armoury', 'program': 'generic', 'family': 'castle-rough', 'cells': [4, 4], 'floors': ['floor-flagstone-large', 'floor-flagstone-irregular', 'floor-flagstone-square', 'floor-boards-rough'], 'recipes': ['cas-armoury-racks', 'cas-armory', 'cas-armory-full', 'cas-armory-smalls'], 'color': '#7d8791', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'barracks', 'label': 'Barracks / guard room', 'program': 'generic', 'family': 'castle-rough', 'cells': [7, 5], 'floors': ['floor-planks-rushes', 'floor-flagstone-rushes', 'floor-boards-rough', 'floor-flagstone-large', 'floor-planks-worn'], 'recipes': ['cas-barracks-rows', 'cas-barracks', 'cas-barracks-kit', 'dun-guard-room'], 'color': '#8c6b4f', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'castle-kitchen', 'label': 'Castle kitchen', 'program': 'generic', 'family': 'castle-rough', 'cells': [6, 5], 'floors': ['floor-flagstone-irregular', 'floor-flagstone-large', 'floor-brick-herringbone', 'floor-terracotta', 'floor-flagstone-damp'], 'recipes': ['cas-castle-kitchen', 'cas-great-kitchen'], 'color': '#c4703d', 'group': 'Castle', 'borrow': ['tav-kitchen', 'tav-kitchen-tools', 'tav-kitchen-larder'], 'tiers': ['castle', 'ccm']},
    {'key': 'chapel', 'label': 'Castle chapel', 'program': 'generic', 'family': 'dressed-stone', 'cells': [4, 7], 'floors': ['floor-checker-stone', 'floor-tile-encaustic', 'floor-flagstone-square', 'floor-tomb-slabs'], 'recipes': ['cas-castle-chapel', 'tem-castle-chapel', 'tem-chapel', 'tem-sanctuary-service', 'tem-altar-service'], 'color': '#9a8fb5', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'dungeon', 'label': 'Dungeon', 'program': 'generic', 'family': 'castle-rough', 'cells': [6, 5], 'floors': ['floor-flagstone-damp', 'floor-flagstone-broken', 'floor-flagstone-large', 'floor-earth-packed'], 'recipes': ['cas-castle-dungeon', 'dun-castle-dungeon', 'dun-cell-block', 'dun-interrogation', 'dun-jailer-station', 'dun-prisoner-ration'], 'color': '#55606b', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'gatehouse', 'label': 'Gatehouse', 'program': 'generic', 'family': 'castle-rough', 'cells': [3, 5], 'floors': ['floor-cobble', 'floor-setts-courtyard', 'floor-flagstone-large', 'floor-flagstone-broken'], 'recipes': ['cas-gatehouse', 'cas-gate-defense', 'dun-guard-room'], 'color': '#6d7f5c', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'courtyard', 'label': 'Courtyard', 'program': 'outdoors', 'family': 'castle-rough', 'cells': [8, 7], 'floors': ['floor-setts-courtyard', 'floor-cobble', 'floor-cobble-mossy', 'floor-earth-packed', 'floor-sand-training', 'floor-gravel', 'floor-grass-worn'], 'recipes': ['cas-courtyard', 'cas-training-yard', 'cas-gate-defense'], 'color': '#8f9b7a', 'group': 'Castle', 'outdoor': True, 'tiers': ['castle', 'ccm']},
    # Mansion (2026-10-05): eight state rooms + two service rooms; every room wealth 'fine', its own meshes are tier 'noble'
    {'key': 'mansion-hall', 'label': 'Entrance hall', 'program': 'generic', 'family': 'noble-panel', 'cells': [5, 6], 'floors': ['floor-marble-cabochon', 'floor-checker-bw', 'floor-tile-harlequin', 'floor-checker-stone', 'floor-planks-polished'], 'recipes': ['nob-entrance-hall'], 'color': '#d8c27a', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-drawing', 'label': 'Drawing room', 'program': 'generic', 'family': 'noble-paper', 'cells': [5, 4], 'floors': ['floor-parquet-versailles', 'floor-parquet-herringbone', 'floor-planks-polished', 'floor-planks-dark'], 'recipes': ['nob-drawing-room', 'nob-parlor'], 'color': '#a9c4a0', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-dining', 'label': 'Dining room', 'program': 'generic', 'family': 'noble-panel', 'cells': [6, 4], 'floors': ['floor-planks-polished', 'floor-parquet-herringbone', 'floor-parquet-versailles', 'floor-checker-stone'], 'recipes': ['nob-dining-room', 'nob-dining', 'nob-silver-service'], 'color': '#b98b5e', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-library', 'label': 'Library', 'program': 'generic', 'family': 'noble-panel', 'cells': [4, 4], 'floors': ['floor-planks-dark', 'floor-parquet-herringbone', 'floor-planks-polished', 'floor-parquet-versailles'], 'recipes': ['nob-library', 'nob-study', 'nob-study-desk'], 'color': '#7a5c3e', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-bedroom', 'label': 'Master bedroom', 'program': 'generic', 'family': 'noble-paper', 'cells': [5, 4], 'floors': ['floor-parquet-herringbone', 'floor-planks-polished', 'floor-parquet-versailles', 'floor-planks-dark'], 'recipes': ['nob-master-bedroom', 'nob-bedchamber', 'nob-dressing-room', 'nob-dressing-room-2'], 'color': '#c59bb0', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-ballroom', 'label': 'Ballroom', 'program': 'generic', 'family': 'noble-paper', 'cells': [8, 6], 'floors': ['floor-parquet-versailles', 'floor-marble-cabochon', 'floor-parquet-herringbone', 'floor-tile-harlequin'], 'recipes': ['nob-ballroom', 'nob-music-room'], 'color': '#e2d6a8', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-conservatory', 'label': 'Conservatory', 'program': 'generic', 'family': 'conservatory', 'cells': [5, 4], 'floors': ['floor-tile-encaustic', 'floor-terracotta', 'floor-tile-hex', 'floor-flagstone-square', 'floor-brick-herringbone'], 'recipes': ['nob-conservatory'], 'color': '#8fbf8f', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-garden', 'label': 'Formal garden', 'program': 'outdoors', 'family': 'noble-panel', 'cells': [7, 6], 'floors': ['floor-lawn-mown', 'floor-grass', 'floor-gravel', 'floor-grass-meadow', 'floor-cobble'], 'recipes': ['nob-formal-garden', 'nob-garden', 'nob-manor-grounds'], 'color': '#6fae5c', 'group': 'Mansion', 'outdoor': True, 'tiers': ['noble', 'ccm']},
    {'key': 'mansion-kitchen', 'label': "Servants' kitchen", 'program': 'generic', 'family': 'noble-interior', 'cells': [6, 5], 'floors': ['floor-flagstone-square', 'floor-checker-red', 'floor-tile-kitchen-small', 'floor-brick-herringbone', 'floor-flagstone-irregular', 'floor-terracotta'], 'recipes': ['nob-servants-kitchen'], 'color': '#d9654f', 'group': 'Mansion', 'borrow': ['tav-kitchen', 'tav-kitchen-tools', 'tav-kitchen-larder'], 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'mansion-cellar', 'label': 'Wine cellar', 'program': 'generic', 'family': 'dressed-stone', 'cells': [5, 4], 'floors': ['floor-flagstone-damp', 'floor-flagstone-large', 'floor-flagstone-square', 'floor-brick-herringbone', 'floor-cobble'], 'recipes': ['nob-wine-cellar'], 'color': '#7d8a99', 'group': 'Mansion', 'borrow': ['tav-cellar', 'tav-pantry-cellar'], 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    # Hallways for the castle, mansion and crypt (2026-10-11): the whole-building generator's spine (docs/BUILDINGS.md). Existing meshes only. v2 programs: js/solver2.js (the buildings:solver2.halls block)
    {'key': 'castle-passage', 'label': 'Passage', 'program': 'generic', 'family': 'castle-rough', 'cells': [6, 2], 'floors': ['floor-flagstone-large', 'floor-flagstone-irregular', 'floor-flagstone-square', 'floor-flagstone-rushes'], 'recipes': ['cas-passage'], 'color': '#8a8f84', 'group': 'Castle', 'tiers': ['castle', 'ccm']},
    {'key': 'mansion-corridor', 'label': 'Corridor', 'program': 'generic', 'family': 'noble-panel', 'cells': [6, 2], 'floors': ['floor-planks-polished', 'floor-parquet-herringbone', 'floor-checker-bw', 'floor-marble-cabochon'], 'recipes': ['nob-corridor'], 'color': '#cdbb8a', 'group': 'Mansion', 'tiers': ['noble', 'ccm'], 'wealth': 'fine'},
    {'key': 'crypt-passage', 'label': 'Passage', 'program': 'generic', 'family': 'crypt-stone', 'cells': [6, 2], 'floors': ['floor-flagstone-damp', 'floor-flagstone-broken', 'floor-flagstone-large', 'floor-earth-packed'], 'recipes': ['cry-passage'], 'color': '#6b7383', 'group': 'Crypt', 'tiers': ['crypt', 'ccm']},
    # Temple & chapel (2026-10-11): ten rooms, temple-stone walls; `flavors` = which flavor slots dress the room (js/solver2.js, the tem block)
    {'key': 'temple-nave', 'label': 'Temple nave', 'program': 'generic', 'family': 'temple-stone', 'cells': [5, 8], 'floors': ['floor-checker-stone', 'floor-flagstone-square', 'floor-marble-cabochon', 'floor-tile-encaustic'], 'recipes': ['tem-nave'], 'color': '#d8cfa4', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'cathedral', 'label': 'Cathedral', 'program': 'generic', 'family': 'temple-stone', 'cells': [8, 14], 'floors': ['floor-marble-cabochon', 'floor-checker-stone', 'floor-flagstone-square', 'floor-tile-encaustic'], 'recipes': ['tem-nave'], 'color': '#e3d9a8', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'cathedral-dark', 'label': 'Dark cathedral', 'program': 'generic', 'family': 'crypt-stone', 'cells': [8, 14], 'floors': ['floor-flagstone-damp', 'floor-tomb-slabs', 'floor-checker-stone', 'floor-flagstone-large'], 'recipes': ['tem-nave'], 'color': '#6f5a6e', 'group': 'Temple', 'tiers': ['crypt', 'ccm'], 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles']},
    {'key': 'temple-shrine', 'label': 'Shrine', 'program': 'generic', 'family': 'temple-stone', 'cells': [3, 4], 'floors': ['floor-checker-stone', 'floor-flagstone-square', 'floor-marble-cabochon', 'floor-tile-encaustic'], 'recipes': ['tem-shrine'], 'color': '#cfc08a', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'temple-vestry', 'label': 'Vestry', 'program': 'generic', 'family': 'temple-stone', 'cells': [3, 3], 'floors': ['floor-flagstone-square', 'floor-checker-stone', 'floor-tile-encaustic'], 'recipes': ['tem-vestry-room'], 'color': '#c4b79a', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'temple-cloister', 'label': 'Cloister walk', 'program': 'generic', 'family': 'temple-stone', 'cells': [8, 3], 'floors': ['floor-flagstone-square', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['tem-cloister-walk'], 'color': '#b9c2a0', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'temple-scriptorium', 'label': 'Scriptorium', 'program': 'generic', 'family': 'temple-stone', 'cells': [5, 5], 'floors': ['floor-flagstone-square', 'floor-tile-encaustic', 'floor-checker-stone'], 'recipes': ['tem-scriptorium-room'], 'color': '#c9b98c', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'temple-infirmary', 'label': 'Infirmary', 'program': 'generic', 'family': 'temple-stone', 'cells': [7, 5], 'floors': ['floor-flagstone-square', 'floor-checker-stone', 'floor-tile-encaustic'], 'recipes': ['tem-infirmary-ward'], 'color': '#cdd3c4', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'temple-cell', 'label': "Priest's cell", 'program': 'generic', 'family': 'temple-stone', 'cells': [2, 3], 'floors': ['floor-flagstone-square', 'floor-flagstone-large'], 'recipes': ['tem-priest-cell'], 'color': '#b7ad98', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    {'key': 'temple-belltower', 'label': 'Bell tower base', 'program': 'generic', 'family': 'temple-stone', 'cells': [3, 3], 'floors': ['floor-flagstone-square', 'floor-flagstone-large'], 'recipes': ['tem-bell-tower'], 'color': '#bfb18f', 'group': 'Temple', 'tiers': ['temple', 'ccm'], 'flavors': ['sun', 'moon', 'nature', 'sword-shield']},
    # >>> type:dun  Dungeon & prison (2026-10-11): 14 rooms; prison half in dressed-stone, adventure half in cut-rock (hewn rock); no windows
    {'key': 'dun-corridor', 'label': 'Corridor', 'program': 'generic', 'family': 'cut-rock', 'cells': [8, 2], 'floors': ['floor-cut-rock', 'floor-flagstone-dungeon', 'floor-flagstone-damp', 'floor-flagstone-broken'], 'recipes': ['dun-corridor'], 'color': '#5d646e', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-trap-corridor', 'label': 'Trap corridor', 'program': 'generic', 'family': 'cut-rock', 'cells': [8, 3], 'floors': ['floor-flagstone-dungeon', 'floor-cut-rock', 'floor-flagstone-large'], 'recipes': ['dun-trap-corridor', 'dun-dropped-gear'], 'color': '#a5523f', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-dead-end', 'label': 'Dead end', 'program': 'generic', 'family': 'cut-rock', 'cells': [4, 2], 'floors': ['floor-cut-rock', 'floor-flagstone-broken', 'floor-flagstone-dungeon'], 'recipes': ['dun-dead-end'], 'color': '#4a4f57', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-cell-block', 'label': 'Cell block', 'program': 'generic', 'family': 'dressed-stone', 'cells': [8, 5], 'floors': ['floor-flagstone-dungeon', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-flagstone-broken'], 'recipes': ['dun-cell-block', 'dun-cell-block-kit', 'dun-prisoner-ration'], 'color': '#66707c', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-guard-room', 'label': 'Guard room', 'program': 'generic', 'family': 'dressed-stone', 'cells': [5, 4], 'floors': ['floor-flagstone-dungeon', 'floor-flagstone-large', 'floor-flagstone-damp'], 'recipes': ['dun-guard-room', 'dun-jailer-station', 'dun-guard-post'], 'color': '#8a7355', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-interrogation', 'label': 'Interrogation room', 'program': 'generic', 'family': 'dressed-stone', 'cells': [5, 4], 'floors': ['floor-flagstone-damp', 'floor-flagstone-dungeon', 'floor-flagstone-broken'], 'recipes': ['dun-interrogation', 'dun-interrogation-kit', 'dun-executioners-room'], 'color': '#7c4a4a', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-vault', 'label': 'Treasure vault', 'program': 'generic', 'family': 'dressed-stone', 'cells': [4, 4], 'floors': ['floor-flagstone-large', 'floor-flagstone-dungeon', 'floor-checker-stone'], 'recipes': ['dun-vault', 'dun-treasure-vault'], 'color': '#c9a640', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-sewer', 'label': 'Sewer', 'program': 'generic', 'family': 'dressed-stone', 'cells': [8, 3], 'floors': ['floor-flagstone-damp', 'floor-flagstone-broken', 'floor-flagstone-dungeon'], 'recipes': ['dun-sewers', 'dun-sewer-access'], 'color': '#5f7a5a', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-puzzle-hall', 'label': 'Puzzle hall', 'program': 'generic', 'family': 'cut-rock', 'cells': [6, 6], 'floors': ['floor-flagstone-large', 'floor-flagstone-dungeon', 'floor-cut-rock'], 'recipes': ['dun-puzzle-hall', 'dun-puzzle-hall-kit'], 'color': '#6a6fb0', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-chasm', 'label': 'Chasm crossing', 'program': 'generic', 'family': 'cut-rock', 'cells': [7, 5], 'floors': ['floor-cut-rock', 'floor-flagstone-broken'], 'recipes': ['dun-chasm-crossing', 'dun-trial-of-crossing'], 'color': '#3d4654', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-den', 'label': 'Monster den', 'program': 'generic', 'family': 'cut-rock', 'cells': [5, 5], 'floors': ['floor-cut-rock', 'floor-earth-packed', 'floor-bone-strewn'], 'recipes': ['dun-monster-den', 'dun-last-party'], 'color': '#7a6a4a', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-shrine', 'label': 'Shrine', 'program': 'generic', 'family': 'cut-rock', 'cells': [3, 3], 'floors': ['floor-cut-rock', 'floor-flagstone-large', 'floor-flagstone-dungeon'], 'recipes': ['dun-shrine-niche'], 'color': '#9c8fb8', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-flooded', 'label': 'Flooded chamber', 'program': 'generic', 'family': 'dressed-stone', 'cells': [5, 4], 'floors': ['floor-water-flooded'], 'recipes': ['dun-flooded-chamber'], 'color': '#3f6f7a', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    {'key': 'dun-collapsed', 'label': 'Collapsed hall', 'program': 'generic', 'family': 'cut-rock', 'cells': [6, 5], 'floors': ['floor-flagstone-broken', 'floor-cut-rock', 'floor-flagstone-dungeon'], 'recipes': ['dun-collapsed-hall'], 'color': '#857f73', 'group': 'Dungeon', 'tiers': ['dun', 'crypt', 'castle', 'ccm']},
    # <<< type:dun
    # Wizard's tower (2026-10-11): eleven rooms, tower-stone walls (the apothecary shop: half-timber). v2 programs: js/solver2.js (the appended wiz block)
    {'key': 'wiz-lab', 'label': 'Alchemy laboratory', 'program': 'generic', 'family': 'tower-stone', 'cells': [5, 4], 'floors': ['floor-flagstone-square', 'floor-tile-hex', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['arc-tower-laboratory'], 'color': '#7fae6a', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-study', 'label': 'Library & study', 'program': 'generic', 'family': 'tower-stone', 'cells': [4, 4], 'floors': ['floor-planks-dark', 'floor-planks-worn', 'floor-planks-stained', 'floor-flagstone-square'], 'recipes': ['arc-tower-study'], 'color': '#9a7bb8', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-summoning', 'label': 'Summoning chamber', 'program': 'generic', 'family': 'tower-stone', 'cells': [4, 4], 'floors': ['floor-flagstone-large', 'floor-flagstone-square', 'floor-checker-stone'], 'recipes': ['arc-tower-summoning'], 'color': '#b0483f', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-observatory', 'label': 'Observatory', 'program': 'generic', 'family': 'tower-stone', 'cells': [4, 4], 'floors': ['floor-planks-dark', 'floor-flagstone-square', 'floor-checker-stone', 'floor-planks-worn'], 'recipes': ['arc-tower-observatory'], 'color': '#c9a84a', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-scrying', 'label': 'Scrying room', 'program': 'generic', 'family': 'tower-stone', 'cells': [3, 3], 'floors': ['floor-checker-stone', 'floor-tile-encaustic', 'floor-flagstone-square', 'floor-planks-dark'], 'recipes': ['arc-tower-scrying'], 'color': '#8fb0b8', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-store', 'label': 'Potion store', 'program': 'generic', 'family': 'tower-stone', 'cells': [3, 3], 'floors': ['floor-flagstone-square', 'floor-flagstone-large', 'floor-planks-worn'], 'recipes': ['arc-tower-store'], 'color': '#6d8a55', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-apothecary', 'label': 'Apothecary shop', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 3], 'floors': ['floor-planks-worn', 'floor-planks-stained', 'floor-tile-hex', 'floor-flagstone-square'], 'recipes': ['arc-tower-apothecary'], 'color': '#c98a4a', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-bedchamber', 'label': "Wizard's bedchamber", 'program': 'generic', 'family': 'tower-stone', 'cells': [4, 4], 'floors': ['floor-planks-dark', 'floor-planks-worn', 'floor-planks-stained', 'floor-flagstone-square'], 'recipes': ['arc-tower-bedchamber'], 'color': '#7a5ca8', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-menagerie', 'label': "Familiars' menagerie", 'program': 'generic', 'family': 'tower-stone', 'cells': [4, 4], 'floors': ['floor-flagstone-rushes', 'floor-planks-rushes', 'floor-flagstone-square', 'floor-planks-worn'], 'recipes': ['arc-tower-menagerie'], 'color': '#a8a05c', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-stair', 'label': 'Tower stair', 'program': 'generic', 'family': 'tower-stone', 'cells': [3, 3], 'floors': ['floor-flagstone-square', 'floor-checker-stone', 'floor-flagstone-large', 'floor-tile-hex'], 'recipes': ['arc-tower-stair'], 'color': '#8a8fa0', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    {'key': 'wiz-workshop', 'label': "Enchanter's workshop", 'program': 'generic', 'family': 'tower-stone', 'cells': [5, 4], 'floors': ['floor-checker-stone', 'floor-flagstone-square', 'floor-tile-encaustic', 'floor-flagstone-large'], 'recipes': ['arc-tower-workshop'], 'color': '#b06fb0', 'group': "Wizard's tower", 'tiers': ['wizard', 'noble', 'ccm']},
    # >>> mkt:room-types
    # Market & village (2026-10-11): twelve rooms. ONE shop program; a shop's trade is the sku tier it lists first (the shop skeleton:
    # experiments/2026-10-11-types/mkt/README.md). The square and the street are outdoor rooms with their own grammar
    {'key': 'mkt-square', 'label': 'Market square', 'program': 'outdoors', 'family': 'half-timber', 'cells': [8, 7], 'floors': ['floor-cobble', 'floor-setts-courtyard', 'floor-cobble-mossy', 'floor-earth-packed', 'floor-gravel', 'floor-grass-worn'], 'recipes': ['mkt-market-square', 'mkt-square', 'mkt-produce-stalls'], 'color': '#c98f4e', 'group': 'Market & village', 'outdoor': True, 'tiers': ['mkt', 'mkt-general', 'mkt-bakery', 'mkt-apoth', 'mkt-tailor', 'mkt-curio']},
    {'key': 'mkt-street', 'label': 'Town street', 'program': 'outdoors', 'family': 'half-timber', 'cells': [10, 3], 'floors': ['floor-cobble', 'floor-setts-courtyard', 'floor-earth-packed', 'floor-cobble-mossy', 'floor-gravel'], 'recipes': ['mkt-street', 'mkt-town-street'], 'color': '#9aa0a6', 'group': 'Market & village', 'outdoor': True, 'tiers': ['mkt', 'mkt-general', 'mkt-bakery', 'mkt-apoth', 'mkt-tailor', 'mkt-curio']},
    {'key': 'mkt-general', 'label': 'General store', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 4], 'floors': ['floor-planks-worn', 'floor-planks-stained', 'floor-boards-rough', 'floor-flagstone-irregular', 'floor-planks-dark'], 'recipes': ['mkt-shop-general', 'mkt-general-store'], 'color': '#b98a4a', 'group': 'Market & village', 'tiers': ['mkt-general', 'mkt']},
    {'key': 'mkt-bakery', 'label': 'Bakery', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 4], 'floors': ['floor-brick-herringbone', 'floor-terracotta', 'floor-flagstone-irregular', 'floor-planks-worn', 'floor-tile-kitchen-small'], 'recipes': ['mkt-shop-bakery', 'mkt-bakery'], 'color': '#e0b56a', 'group': 'Market & village', 'tiers': ['mkt-bakery', 'mkt']},
    {'key': 'mkt-apothecary', 'label': 'Apothecary', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 4], 'floors': ['floor-tile-hex', 'floor-planks-dark', 'floor-planks-stained', 'floor-checker-stone', 'floor-flagstone-square'], 'recipes': ['mkt-shop-apothecary', 'mkt-apothecary-shop', 'mkt-apothecary'], 'color': '#7fae7a', 'group': 'Market & village', 'tiers': ['mkt-apoth', 'mkt']},
    {'key': 'mkt-tailor', 'label': 'Tailor & draper', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 4], 'floors': ['floor-planks-stained', 'floor-planks-polished', 'floor-planks-worn', 'floor-planks-dark'], 'recipes': ['mkt-shop-tailor', 'mkt-tailor', 'mkt-tailor-shop'], 'color': '#b0527a', 'group': 'Market & village', 'tiers': ['mkt-tailor', 'mkt']},
    {'key': 'mkt-curio', 'label': 'Magic & curio shop', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 4], 'floors': ['floor-planks-dark', 'floor-checker-stone', 'floor-planks-stained', 'floor-tile-encaustic'], 'recipes': ['mkt-shop-curio', 'mkt-magic-shop', 'mkt-pawn-curio'], 'color': '#8a63b5', 'group': 'Market & village', 'tiers': ['mkt-curio', 'mkt']},
    {'key': 'mkt-backroom', 'label': 'Shop back room', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 3], 'floors': ['floor-boards-rough', 'floor-planks-worn', 'floor-flagstone-irregular', 'floor-earth-packed'], 'recipes': ['mkt-shop-backroom'], 'borrow': ['tav-storeroom'], 'color': '#8c7355', 'group': 'Market & village', 'tiers': ['mkt', 'mkt-general', 'mkt-bakery', 'mkt-apoth', 'mkt-tailor', 'mkt-curio']},
    {'key': 'mkt-passage', 'label': 'Shop passage & stair', 'program': 'generic', 'family': 'half-timber', 'cells': [2, 7], 'floors': ['floor-planks-worn', 'floor-boards-rough', 'floor-planks-stained', 'floor-flagstone-irregular'], 'recipes': ['mkt-shop-passage'], 'borrow': ['tav-hallway'], 'color': '#a89a7c', 'group': 'Market & village', 'tiers': ['mkt']},
    {'key': 'mkt-watch', 'label': 'Watch post', 'program': 'generic', 'family': 'fieldstone', 'cells': [4, 4], 'floors': ['floor-flagstone-large', 'floor-flagstone-irregular', 'floor-boards-rough', 'floor-planks-worn'], 'recipes': ['mkt-watch-house', 'mkt-watch-post'], 'borrow': ['dun-guard-room'], 'color': '#6f7f8f', 'group': 'Market & village', 'tiers': ['mkt']},
    {'key': 'mkt-house', 'label': 'Town house: living room', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 4], 'floors': ['floor-planks-worn', 'floor-planks-stained', 'floor-planks-rushes', 'floor-flagstone-irregular'], 'recipes': ['mkt-town-house'], 'borrow': ['hut-cottage', 'hut-kitchen-lived-in'], 'color': '#c7a36b', 'group': 'Market & village', 'tiers': ['mkt']},
    {'key': 'mkt-bedroom', 'label': 'Town house: bedroom', 'program': 'generic', 'family': 'half-timber', 'cells': [4, 3], 'floors': ['floor-planks-stained', 'floor-planks-worn', 'floor-planks-dark'], 'recipes': ['mkt-town-bedroom'], 'borrow': ['tav-guest-room', 'tav-guest-room-full'], 'color': '#b9a0c0', 'group': 'Market & village', 'tiers': ['mkt']},
    # <<< mkt:room-types
    # >>> type:min  Mine (2026-10-11): 13 rooms; tunnels and chambers in mine-timbered / cut-rock (hewn rock, no windows), the pithead yard and the smelter on the surface
    {'key': 'min-tunnel', 'label': 'Mine tunnel', 'program': 'generic', 'family': 'mine-timbered', 'cells': [8, 2], 'floors': ['floor-cut-rock', 'floor-earth-packed', 'floor-flagstone-broken', 'floor-earth-bare'], 'recipes': ['min-tunnel', 'min-gallery'], 'color': '#6b5a45', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-junction', 'label': 'Tunnel junction', 'program': 'generic', 'family': 'mine-timbered', 'cells': [4, 4], 'floors': ['floor-cut-rock', 'floor-earth-packed', 'floor-flagstone-broken', 'floor-earth-bare'], 'recipes': ['min-junction', 'min-gallery'], 'color': '#7a6a52', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-face', 'label': 'Working face', 'program': 'generic', 'family': 'cut-rock', 'cells': [4, 3], 'floors': ['floor-cut-rock', 'floor-earth-packed', 'floor-flagstone-broken', 'floor-earth-bare'], 'recipes': ['min-face', 'min-ore-face', 'min-working-face'], 'color': '#8a7440', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-collapsed', 'label': 'Collapsed tunnel', 'program': 'generic', 'family': 'mine-timbered', 'cells': [6, 3], 'floors': ['floor-cut-rock', 'floor-flagstone-broken', 'floor-earth-packed'], 'recipes': ['min-collapsed'], 'color': '#857f73', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-flooded', 'label': 'Flooded gallery', 'program': 'generic', 'family': 'mine-timbered', 'cells': [6, 3], 'floors': ['floor-water-flooded'], 'recipes': ['min-flooded'], 'color': '#3f6f7a', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-shaft-head', 'label': 'Shaft head', 'program': 'generic', 'family': 'mine-timbered', 'cells': [5, 5], 'floors': ['floor-cut-rock', 'floor-earth-packed', 'floor-flagstone-broken', 'floor-earth-bare'], 'recipes': ['min-shaft', 'min-shaft-head'], 'color': '#a08456', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-sorting', 'label': 'Ore-sorting chamber', 'program': 'generic', 'family': 'cut-rock', 'cells': [6, 5], 'floors': ['floor-cut-rock', 'floor-earth-packed', 'floor-flagstone-broken', 'floor-earth-bare'], 'recipes': ['min-sorting', 'min-ore-sorting'], 'color': '#9a6b3f', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-tool-store', 'label': 'Tool store', 'program': 'generic', 'family': 'mine-timbered', 'cells': [4, 3], 'floors': ['floor-earth-packed', 'floor-cut-rock', 'floor-planks-worn'], 'recipes': ['min-tools', 'min-tool-store'], 'color': '#7d6b4d', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-mess', 'label': "Miners' mess", 'program': 'generic', 'family': 'cut-rock', 'cells': [6, 4], 'floors': ['floor-earth-packed', 'floor-cut-rock', 'floor-planks-worn'], 'recipes': ['min-mess'], 'color': '#b08a5a', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-powder-store', 'label': 'Powder & lamp store', 'program': 'generic', 'family': 'mine-timbered', 'cells': [3, 3], 'floors': ['floor-earth-packed', 'floor-cut-rock'], 'recipes': ['min-powder'], 'color': '#a5523f', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-seam', 'label': 'Crystal seam', 'program': 'generic', 'family': 'cut-rock', 'cells': [5, 5], 'floors': ['floor-cut-rock', 'floor-earth-bare'], 'recipes': ['min-seam', 'min-strike'], 'color': '#8f6fc0', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-pithead', 'label': 'Pithead yard', 'program': 'outdoors', 'family': 'fieldstone', 'cells': [8, 7], 'floors': ['floor-earth-bare', 'floor-gravel', 'floor-earth-packed', 'floor-cobble'], 'recipes': ['min-pithead'], 'color': '#8c7a5e', 'group': 'Mine', 'outdoor': True, 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    {'key': 'min-smelter', 'label': 'Smelter house', 'program': 'generic', 'family': 'fieldstone', 'cells': [5, 4], 'floors': ['floor-earth-packed', 'floor-flagstone-irregular', 'floor-cobble', 'floor-flagstone-broken'], 'recipes': ['min-smeltery'], 'color': '#c96a3a', 'group': 'Mine', 'tiers': ['min', 'dun', 'wizard', 'ccm']},
    # <<< type:min
    # >>> types:clt
    # Cult sanctum (2026-10-11): nine rooms, black-stone walls (the hidden entrance is a dressed-stone cellar), no windows. v2 programs: js/solver2.js (the appended types:clt block)
    {'key': 'cult-entry', 'label': "Hidden entrance", 'program': 'generic', 'family': 'dressed-stone', 'cells': [4, 3], 'floors': ['floor-flagstone-damp', 'floor-flagstone-large', 'floor-flagstone-broken', 'floor-earth-packed'], 'recipes': ['clt-hidden-entry'], 'color': '#7a6f5c', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    {'key': 'cult-passage', 'label': "Processional passage", 'program': 'generic', 'family': 'black-stone', 'cells': [8, 3], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-passage'], 'color': '#5a4a52', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    {'key': 'cult-sanctum', 'label': "Sanctum", 'program': 'generic', 'family': 'black-stone', 'cells': [6, 9], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-great-sanctum', 'clt-sanctum'], 'color': '#8c2f39', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    {'key': 'cult-summoning', 'label': "Summoning chamber", 'program': 'generic', 'family': 'black-stone', 'cells': [5, 5], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-summoning', 'clt-ritual-circle'], 'color': '#6d3fa0', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    {'key': 'cult-cells', 'label': "Holding cells", 'program': 'generic', 'family': 'black-stone', 'cells': [5, 4], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-cells'], 'color': '#4f5560', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    {'key': 'cult-vestry', 'label': "Robing room", 'program': 'generic', 'family': 'black-stone', 'cells': [4, 3], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-vestry'], 'color': '#6b5a4a', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    {'key': 'cult-library', 'label': "Forbidden library", 'program': 'generic', 'family': 'black-stone', 'cells': [4, 4], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-library'], 'color': '#3f5d4a', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm', 'noble']},
    {'key': 'cult-quarters', 'label': "Acolytes' quarters", 'program': 'generic', 'family': 'black-stone', 'cells': [5, 4], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-quarters'], 'color': '#7d7468', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    {'key': 'cult-vault', 'label': "Inner sanctum", 'program': 'generic', 'family': 'black-stone', 'cells': [3, 4], 'floors': ['floor-basalt-dark', 'floor-flagstone-damp', 'floor-flagstone-large', 'floor-checker-stone'], 'recipes': ['clt-idol-vault', 'clt-inner-sanctum'], 'color': '#b08d2f', 'group': 'Cult sanctum', 'flavors': ['devils', 'spiders', 'skulls', 'dragons', 'tentacles'], 'tiers': ['cult', 'ccm']},
    # <<< types:clt
    # >>> type:hut  Farmstead (2026-10-11): sixteen rooms from the library as it stood (no new mesh, no exclusive tier); the cottage and
    # the loft are wealth 'poor' (the type's default look), the farmhouse rooms 'common'; five are outdoor rooms; walls half-timber
    # (wattle and daub), rough-timber and fieldstone, rolled per room (walls.js FAMILY_ODDS in the type:hut block).
    # Source: experiments/2026-10-11-types/hut/integration/room_types.py
    {'key': 'hut-cottage', 'label': 'Cottage (one room)', 'program': 'generic', 'family': 'wattle-daub', 'cells': [4, 4], 'floors': ['floor-earth-packed', 'floor-planks-rushes', 'floor-flagstone-rushes', 'floor-boards-rough', 'floor-earth-straw'], 'recipes': ['hut-farm-cottage', 'hut-cottage', 'hut-peasant-supper', 'hut-supper'], 'color': '#b08a4f', 'group': 'Farmstead', 'tiers': ['hut'], 'wealth': 'poor'},
    {'key': 'hut-kitchen', 'label': 'Farmhouse kitchen', 'program': 'generic', 'family': 'half-timber', 'cells': [5, 4], 'floors': ['floor-flagstone-irregular', 'floor-flagstone-rushes', 'floor-planks-worn', 'floor-brick-herringbone', 'floor-boards-rough', 'floor-terracotta'], 'recipes': ['hut-farm-kitchen', 'hut-kitchen-lived-in', 'hut-kitchen-shelf', 'hut-supper'], 'color': '#d38b3a', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-bedroom', 'label': 'Farmhouse bedroom', 'program': 'generic', 'family': 'wattle-daub', 'cells': [3, 3], 'floors': ['floor-planks-worn', 'floor-boards-rough', 'floor-planks-rushes', 'floor-planks-dark'], 'recipes': ['hut-farm-bedroom'], 'color': '#8fb35a', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-loft', 'label': 'Sleeping loft', 'program': 'generic', 'family': 'rough-timber', 'cells': [4, 3], 'floors': ['floor-boards-rough', 'floor-planks-worn', 'floor-planks-rushes'], 'recipes': ['hut-farm-loft'], 'color': '#a8a05a', 'group': 'Farmstead', 'tiers': ['hut'], 'wealth': 'poor'},
    {'key': 'hut-passage', 'label': 'Cross-passage', 'program': 'generic', 'family': 'wattle-daub', 'cells': [6, 2], 'floors': ['floor-flagstone-irregular', 'floor-cobble', 'floor-earth-packed', 'floor-boards-rough', 'floor-flagstone-rushes'], 'recipes': ['hut-farm-passage'], 'color': '#c8b89a', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-cellar', 'label': 'Root cellar', 'program': 'generic', 'family': 'fieldstone', 'cells': [3, 3], 'floors': ['floor-earth-packed', 'floor-earth-bare', 'floor-flagstone-damp', 'floor-cobble'], 'recipes': ['hut-farm-root-cellar'], 'color': '#7d8a99', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-byre', 'label': 'Byre (cowshed)', 'program': 'generic', 'family': 'rough-timber', 'cells': [5, 4], 'floors': ['floor-earth-straw', 'floor-cobble', 'floor-earth-bare', 'floor-flagstone-broken', 'floor-boards-rough'], 'recipes': ['hut-farm-byre', 'hut-byre'], 'color': '#a8834f', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-coop', 'label': 'Chicken coop', 'program': 'generic', 'family': 'rough-timber', 'cells': [3, 2], 'floors': ['floor-earth-straw', 'floor-earth-bare', 'floor-boards-rough'], 'recipes': ['hut-farm-coop', 'hut-dairy-and-apiary'], 'color': '#c9a640', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-pigsty', 'label': 'Pigsty', 'program': 'outdoors', 'family': 'rough-timber', 'cells': [4, 3], 'floors': ['floor-earth-bare', 'floor-earth-packed', 'floor-earth-straw'], 'recipes': ['hut-farm-pigsty', 'hut-farmyard-pens'], 'color': '#9a7a6a', 'group': 'Farmstead', 'tiers': ['hut'], 'outdoor': True},
    {'key': 'hut-barn', 'label': 'Hay barn', 'program': 'generic', 'family': 'rough-timber', 'cells': [6, 5], 'floors': ['floor-earth-straw', 'floor-earth-bare', 'floor-boards-rough', 'floor-cobble', 'floor-flagstone-large'], 'recipes': ['hut-farm-hay-barn', 'hut-barn-tools'], 'color': '#8a5a3a', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-granary', 'label': 'Granary & threshing floor', 'program': 'generic', 'family': 'rough-timber', 'cells': [4, 4], 'floors': ['floor-boards-rough', 'floor-planks-worn', 'floor-earth-packed', 'floor-flagstone-large'], 'recipes': ['hut-farm-granary', 'hut-barn-tools'], 'color': '#c7a35a', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-dairy', 'label': 'Dairy', 'program': 'generic', 'family': 'fieldstone', 'cells': [3, 3], 'floors': ['floor-flagstone-damp', 'floor-flagstone-square', 'floor-flagstone-irregular', 'floor-brick-herringbone', 'floor-tile-kitchen-small'], 'recipes': ['hut-farm-dairy', 'hut-dairy'], 'color': '#cfd6c4', 'group': 'Farmstead', 'tiers': ['hut']},
    {'key': 'hut-garden', 'label': 'Vegetable garden', 'program': 'outdoors', 'family': 'half-timber', 'cells': [5, 4], 'floors': ['floor-earth-packed', 'floor-earth-bare', 'floor-grass-worn'], 'recipes': ['hut-farm-garden', 'hut-farmyard-tools'], 'color': '#7fb04f', 'group': 'Farmstead', 'tiers': ['hut'], 'outdoor': True},
    {'key': 'hut-field', 'label': 'Field edge', 'program': 'outdoors', 'family': 'rough-timber', 'cells': [8, 5], 'floors': ['floor-field-furrows', 'floor-earth-bare'], 'recipes': ['hut-farm-field', 'hut-harvest-field', 'hut-fields'], 'color': '#b5894b', 'group': 'Farmstead', 'tiers': ['hut'], 'outdoor': True},
    {'key': 'hut-orchard', 'label': 'Orchard corner', 'program': 'outdoors', 'family': 'rough-timber', 'cells': [6, 5], 'floors': ['floor-grass-meadow', 'floor-grass', 'floor-grass-worn'], 'recipes': ['hut-farm-orchard', 'hut-orchard-farmland'], 'color': '#5f9e55', 'group': 'Farmstead', 'tiers': ['hut'], 'outdoor': True},
    {'key': 'hut-farmyard', 'label': 'Farmyard', 'program': 'outdoors', 'family': 'rough-timber', 'cells': [6, 5], 'floors': ['floor-earth-packed', 'floor-earth-bare', 'floor-cobble', 'floor-cobble-mossy', 'floor-grass-worn'], 'recipes': ['hut-farm-farmyard', 'hut-yard', 'hut-farmstead-grounds'], 'color': '#6fae5c', 'group': 'Farmstead', 'tiers': ['hut'], 'outdoor': True},
    # <<< type:hut
    # >>> smi:room-types
    # Smithy & workshop (2026-10-11): nine rooms. ONE workshop program; the craft is a line of data (the workshop skeleton:
    # experiments/2026-10-11-types/smi/README.md, js/solver2.js SMI_CRAFTS). The yard is an outdoor room with its own grammar
    {'key': 'smi-forge', 'label': "Blacksmith's forge", 'program': 'generic', 'family': 'fieldstone', 'cells': [5, 4], 'floors': ['floor-flagstone-irregular', 'floor-earth-packed', 'floor-flagstone-large', 'floor-cobble', 'floor-brick-herringbone'], 'recipes': ['smi-room-forge', 'smi-forge-room', 'smi-working-forge'], 'color': '#d0703a', 'group': 'Smithy & workshop', 'tiers': ['smi']},
    {'key': 'smi-armoury', 'label': 'Armourer & weaponsmith', 'program': 'generic', 'family': 'fieldstone', 'cells': [5, 4], 'floors': ['floor-flagstone-large', 'floor-flagstone-irregular', 'floor-flagstone-square', 'floor-boards-rough', 'floor-earth-packed'], 'recipes': ['smi-room-armoury', 'smi-armorer-workshop'], 'color': '#9aa7b5', 'group': 'Smithy & workshop', 'tiers': ['smi']},
    {'key': 'smi-carpenter', 'label': "Carpenter's woodshop", 'program': 'generic', 'family': 'rough-timber', 'cells': [5, 4], 'floors': ['floor-boards-rough', 'floor-planks-worn', 'floor-earth-packed', 'floor-planks-dark'], 'recipes': ['smi-room-carpenter', 'smi-carpenter-shop'], 'color': '#d9bd72', 'group': 'Smithy & workshop', 'tiers': ['smi']},
    {'key': 'smi-potter', 'label': "Potter's workshop", 'program': 'generic', 'family': 'fieldstone', 'cells': [5, 4], 'floors': ['floor-terracotta', 'floor-brick-herringbone', 'floor-earth-packed', 'floor-flagstone-irregular', 'floor-boards-rough'], 'recipes': ['smi-room-potter'], 'color': '#c9824f', 'group': 'Smithy & workshop', 'tiers': ['smi']},
    {'key': 'smi-shopfront', 'label': "Smith's shop front", 'program': 'generic', 'family': 'half-timber', 'cells': [4, 4], 'floors': ['floor-planks-worn', 'floor-planks-dark', 'floor-flagstone-irregular', 'floor-boards-rough', 'floor-planks-stained'], 'recipes': ['smi-room-shopfront', 'smi-shopfront'], 'color': '#b98a4a', 'group': 'Smithy & workshop', 'tiers': ['smi', 'mkt']},
    {'key': 'smi-stock', 'label': 'Stock store', 'program': 'generic', 'family': 'rough-timber', 'cells': [4, 3], 'floors': ['floor-earth-packed', 'floor-boards-rough', 'floor-flagstone-irregular', 'floor-flagstone-large'], 'recipes': ['smi-room-stock'], 'color': '#8c7355', 'group': 'Smithy & workshop', 'tiers': ['smi']},
    {'key': 'smi-yard', 'label': "Smith's yard", 'program': 'outdoors', 'family': 'fieldstone', 'cells': [6, 5], 'floors': ['floor-earth-packed', 'floor-cobble', 'floor-gravel', 'floor-earth-bare', 'floor-setts-courtyard', 'floor-grass-worn'], 'recipes': ['smi-room-yard', 'smi-farrier-bay'], 'color': '#a08a5c', 'group': 'Smithy & workshop', 'outdoor': True, 'tiers': ['smi']},
    {'key': 'smi-quarters', 'label': "Smith's quarters", 'program': 'generic', 'family': 'half-timber', 'cells': [4, 3], 'floors': ['floor-planks-worn', 'floor-planks-stained', 'floor-planks-dark', 'floor-boards-rough'], 'recipes': ['smi-room-quarters'], 'borrow': ['tav-guest-room', 'tav-guest-room-full'], 'color': '#b9a0c0', 'group': 'Smithy & workshop', 'tiers': ['smi']},
    {'key': 'smi-passage', 'label': 'Workshop passage & stair', 'program': 'generic', 'family': 'half-timber', 'cells': [2, 6], 'floors': ['floor-boards-rough', 'floor-planks-worn', 'floor-flagstone-irregular', 'floor-planks-dark'], 'recipes': ['smi-room-passage'], 'borrow': ['tav-hallway'], 'color': '#a89a7c', 'group': 'Smithy & workshop', 'tiers': ['smi']},
    # <<< smi:room-types
    # >>> type:lai  Monster lair (2026-10-11): ten rooms in cut-rock walls (shared with the dungeon), no windows; the dens share one skeleton (js/solver2.js laiDen)
    {'key': 'lair-mouth', 'label': 'Cave mouth', 'program': 'outdoors', 'family': 'cut-rock', 'cells': [7, 6], 'floors': ['floor-earth-bare', 'floor-earth-packed', 'floor-grass-worn', 'floor-gravel', 'floor-bone-strewn'], 'recipes': ['lai-cave-mouth', 'lai-dragon-approach'], 'color': '#8b8468', 'group': 'Lair', 'outdoor': True, 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-passage', 'label': 'Cave passage', 'program': 'generic', 'family': 'cut-rock', 'cells': [8, 2], 'floors': ['floor-earth-packed', 'floor-earth-bare', 'floor-flagstone-broken'], 'recipes': ['lai-cave-passage'], 'color': '#5a5348', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-warren', 'label': 'Goblin warren', 'program': 'generic', 'family': 'cut-rock', 'cells': [7, 6], 'floors': ['floor-earth-packed', 'floor-earth-straw', 'floor-earth-bare', 'floor-flagstone-broken'], 'recipes': ['lai-goblin-den', 'lai-warlord-hall', 'lai-warband-camp'], 'color': '#7f8a45', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-beast', 'label': 'Beast den', 'program': 'generic', 'family': 'cut-rock', 'cells': [5, 5], 'floors': ['floor-earth-bare', 'floor-earth-packed', 'floor-bone-strewn'], 'recipes': ['lai-beast-den'], 'color': '#8a6b4a', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-spider', 'label': 'Spider nest', 'program': 'generic', 'family': 'cut-rock', 'cells': [6, 6], 'floors': ['floor-earth-packed', 'floor-earth-bare', 'floor-flagstone-broken'], 'recipes': ['lai-spider-den', 'lai-spider-hollow'], 'color': '#9aa0a8', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-larder', 'label': 'Larder', 'program': 'generic', 'family': 'cut-rock', 'cells': [4, 4], 'floors': ['floor-earth-packed', 'floor-flagstone-damp', 'floor-earth-bare'], 'recipes': ['lai-larder'], 'color': '#a0564a', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-pit', 'label': 'Prisoner pit', 'program': 'generic', 'family': 'cut-rock', 'cells': [5, 5], 'floors': ['floor-earth-packed', 'floor-flagstone-broken', 'floor-flagstone-damp'], 'recipes': ['lai-prisoner-pit'], 'color': '#4f5560', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-hatchery', 'label': 'Hatchery', 'program': 'generic', 'family': 'cut-rock', 'cells': [5, 4], 'floors': ['floor-earth-straw', 'floor-earth-bare', 'floor-earth-packed'], 'recipes': ['lai-hatchery', 'lai-sky-nest'], 'color': '#c9b27a', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-trophy', 'label': 'Trophy cave', 'program': 'generic', 'family': 'cut-rock', 'cells': [7, 3], 'floors': ['floor-earth-packed', 'floor-flagstone-broken', 'floor-bone-strewn'], 'recipes': ['lai-trophy-cave', 'lai-stone-gaze-gallery'], 'color': '#9c8fb8', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    {'key': 'lair-dragon', 'label': "Dragon's hoard", 'program': 'generic', 'family': 'cut-rock', 'cells': [8, 7], 'floors': ['floor-flagstone-broken', 'floor-earth-packed', 'floor-earth-bare'], 'recipes': ['lai-dragon-lair', 'lai-dragon-hoard'], 'color': '#d0a534', 'group': 'Lair', 'tiers': ['lai', 'dun', 'ccm']},
    # <<< type:lai
]
SHELL = "any-shell"

# Mesh identity (2026-10-02): orientation corrections belong to one mesh, not to a sku name. inn-02 regenerated 52
# inn-01 problem assets under the SAME sku names (some came out turned 90 deg), so a sku-keyed yaw measured on the old
# mesh would land on the new one. Every mesh sku carries `mesh` = "<src>/<sku>@<sha1 of the source GLB, 8 hex>", and
# data/orient.json is keyed by that id. `was` lists the meshes a sku showed before (newest first) with the time the
# newer one went live, so the tuner can file Harry's old sku-keyed server records (no data.mesh) under the mesh he was
# looking at when he made them. inn-02 meshes were generated 11:41-14:09 PDT; SRC_LIVE is the tuner deploy that first showed them.
SRC_LIVE = {"inn-02": "2026-10-02T15:59:27-0700"}


def mesh_id(src, sku, glb):
    return f"{src}/{sku}@{hashlib.sha1(pathlib.Path(glb).read_bytes()).hexdigest()[:8]}"


def load_manifest(path):
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def main() -> None:
    # gate (2026-10-12), BEFORE anything is read or written: two batches must not claim one sku. This script keeps whichever
    # block comes first without a word, and the other batch's runtime build then overwrites the shared assets/m/<sku>.glb.
    guard = subprocess.run([sys.executable, str(ROOT / "tools/tool-sweep/sku_guard.py"), "--quiet"])
    if guard.returncode:
        sys.exit("build_data.py: NOTHING WRITTEN (sku collision above; rename the newer batch's sku, or tools/tool-sweep/sku_guard_allow.json)")
    roles = {}
    for path in sorted((ROOT / "catalog").glob("*.catalog.md")):
        more, errs = ct.parse_catalog(path)
        if errs:
            sys.exit(f"catalog errors in {path.name}: {errs[:3]}")
        roles.update(more)
    recipes = {}
    for path in [ROOT / "catalog/room-recipes.md"] + sorted((ROOT / "catalog").glob("rooms-*.md")):
        rooms, _ = ct.parse_recipes(path)
        recipes.update({r["id"]: r for r in rooms})
    sets, _ = ct.parse_sets(ROOT / "catalog/sets.md")
    ratings = json.loads((reviews_dir() / "latest.json").read_text())

    skus = {}  # sku -> record
    for row in load_manifest(ROOT / "catalog/runs/inn-01/manifest.tsv"):
        glb = INN01 / "models" / f"{row['sku']}.glb"
        plate = INN01 / "inputs" / f"{row['sku']}.jpg"
        if row["lane"] == "3d" and glb.exists():
            skus[row["sku"]] = {**row, "src": "inn-01", "glb": glb, "piece": ""}
        elif row["lane"] == "2d" and plate.exists():
            skus[row["sku"]] = {**row, "src": "inn-01", "plate": plate, "piece": ""}
    # flat-only additions (2026-10-01, Harry: floors and rugs are just images): seamless floors + keyed rugs
    for path in sorted((ROOT / "experiments/2026-10-01-floors/seamless").glob("*.png")):
        obj, _, var = path.stem.partition("--")  # floor-x--v2..v4 are colour-matched variants of floor-x
        skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var or "v1",
                           "src": "floors-01", "plate": path, "piece": "", "opaque": True}
    for path in sorted((ROOT / "experiments/2026-10-01-rugs/inputs").glob("*.jpg")):
        obj, _, var = path.stem.partition("--")  # rug-hay-scatter--s1..s3 are shape variants
        skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var,
                           "src": "rugs-01", "plate": path, "piece": ""}
    # floor expansion (2026-10-01 evening): composed exact-grid patterns (c1..c3), seamless flagstones/earth (v1..v4),
    # keyed hay and dirt scatter decals laid over earth floors
    F2 = ROOT / "experiments/2026-10-01-floors2"
    for folder in ("seamless", "composed"):
        for path in sorted((F2 / folder).glob("*.png")):
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var or "v1",
                               "src": "floors-02", "plate": path, "piece": "", "opaque": True}
    for path in sorted((F2 / "inputs").glob("*.jpg")):
        if path.stem.startswith(("rug-hay-scatter--", "decal-dirt-patch--")):
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var,
                               "src": "floors-02", "plate": path, "piece": ""}
    # outdoor ground (2026-10-05, the yard): seamless grass and gravel (v1..v4) from the free Codex image route
    for path in sorted((ROOT / "experiments/2026-10-05-outdoors/seamless").glob("*.png")):
        obj, _, var = path.stem.partition("--")
        skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var or "v1",
                           "src": "outdoors-01", "plate": path, "piece": "", "opaque": True}
    # ... and keyed grass decals (tufts, worn patches) that look.js SCATTER lays over floor-grass
    for path in sorted((ROOT / "experiments/2026-10-05-outdoors/decals").glob("*.jpg")):
        obj, _, var = path.stem.partition("--")
        skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var,
                           "src": "outdoors-01", "plate": path, "piece": ""}
    # >>> type:lai
    # Monster lair: one run folder (lai-01: the signature meshes, 2026-10-12) and its flats, by the dungeon's and the mine's rules:
    # a sku name that exists is never replaced; EVERY lair mesh carries the exclusive tier `lai` (rolled only by room types
    # that list it), so no older room gains a thing by this batch. Its two flats are DERIVED from our own plates
    # (experiments/2026-10-11-types/lai/tools/derive_flats.py): decal-scorch and giant-web-floor, roles that had no image; they carry the tier too (the mine's smelter
    # names decal-scorch in a recipe: test/golden.mjs caught it gaining one).
    LAI = ROOT / "experiments/2026-10-11-types/lai"
    for path in sorted((LAI / "flats/decals").glob("*.jpg")):
        if path.stem not in skus:
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "lai", "shape": var, "src": "lai-flats-01", "plate": path, "piece": ""}
    lai_manifest = ROOT / "catalog/runs/lai-01/manifest.tsv"
    lai_skipped = []
    for row in (load_manifest(lai_manifest) if lai_manifest.exists() else []):
        glb = LAI / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            lai_skipped.append(row["sku"])
            continue
        row = dict(row)
        if row["family"]:  # (no wall kit in this run: a family column is a shape)
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
            row["family"] = ""
        row["tier"] = "lai"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "lai-01", "glb": glb, "piece": "", "hung": "hung" in flags, "fit": "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if lai_skipped:
        print(f"lair: {len(lai_skipped)} sku names already in the library, NOT replaced: {', '.join(lai_skipped[:8])}")
    # <<< type:lai
    remeshed = 0
    for row in load_manifest(ROOT / "catalog/runs/inn-01b/manifest.tsv"):
        glb = REMESH / "models" / f"{row['sku']}.glb"
        if glb.exists():
            skus[row["sku"]] = {**row, "src": "inn-01b", "glb": glb}
            remeshed += 1
    # fal wall batch 2026-10-01 (Harry: "we only end up with one wall"): <object>--<family>[--sN]
    for glb in sorted((ROOT / "experiments/2026-10-01-walls/models").glob("*.glb")):
        parts = glb.stem.split("--")
        # Harry 2026-10-05: the stacked-log wall is lovely but can't be mixed with the plank walls: its own family
        if glb.stem == "wall-straight--rough-timber--s3":
            parts[1] = "log-cabin"
        skus[glb.stem] = {"sku": glb.stem, "object": parts[0], "lane": "3d", "gen": "kit", "family": parts[1], "tier": "",
                          "shape": parts[2] if len(parts) > 2 else "", "place": "kit", "fp": "edge", "src": "walls-01", "glb": glb, "piece": ""}
    # leaf-only doors (2026-10-01): the inn-01 door meshes carry their own frames, so stretched they still look small
    for glb in sorted((ROOT / "experiments/2026-10-01-doors/models").glob("*.glb")):
        obj, _, var = glb.stem.partition("--")
        skus[glb.stem] = {"sku": glb.stem, "object": obj, "lane": "3d", "gen": "kit", "family": "", "tier": "", "shape": var,
                          "place": "kit", "fp": "edge", "src": "doors-01", "glb": glb, "piece": "leaf"}
    # stable kit (fal, 2026-10-01): stall gate, 10-ft stall partition, manger s2
    for glb in sorted((ROOT / "experiments/2026-10-01-stable/models").glob("*.glb")):
        obj, _, var = glb.stem.partition("--")
        kit = obj in ("stable-stall-gate", "stable-stall-partition")
        skus[glb.stem] = {"sku": glb.stem, "object": obj, "lane": "3d", "gen": "kit" if kit else "mesh", "family": "", "tier": "", "shape": var,
                          "place": "kit" if kit else "wall", "fp": "edge" if kit else "1", "src": "stable-01", "glb": glb, "piece": ""}
    # railings (fal, 2026-10-06): the wrought-iron section that goes round a stair's hole in a stone building
    for glb in sorted((ROOT / "experiments/2026-10-06-railings/fal/models").glob("*.glb")):
        obj, _, var = glb.stem.partition("--")
        skus[glb.stem] = {"sku": glb.stem, "object": obj, "lane": "3d", "gen": "kit", "family": "", "tier": "", "shape": var,
                          "place": "kit", "fp": "edge", "src": "railings-01", "glb": glb, "piece": ""}
    # cat tree (fal, 2026-10-06): one prop a playtester asked for at the table; experiments/2026-10-06-cat-tree
    for glb in sorted((ROOT / "experiments/2026-10-06-cat-tree/models").glob("*.glb")):
        obj, _, var = glb.stem.partition("--")
        skus[glb.stem] = {"sku": glb.stem, "object": obj, "lane": "3d", "gen": "mesh", "family": "", "tier": "", "shape": var,
                          "place": "floor", "fp": "1", "src": "cat-tree-01", "glb": glb, "piece": "", "rev": True}
    # inn-02 (RunPod, 2026-10-02): regenerated inn-01 problem assets win over inn-01/inn-01b; open states, wall/ground
    # lights (generated unlit), open fires, empty vessels, grammar gaps and extra variants are new SKUs
    INN02 = ROOT / "experiments/inn-02"
    inn02_manifest = ROOT / "catalog/runs/inn-02/manifest.tsv"
    if inn02_manifest.exists():
        for row in load_manifest(inn02_manifest):
            glb = INN02 / "models" / f"{row['sku']}.glb"
            if glb.exists():
                old = skus.get(row["sku"])
                was = ([{"mesh": mesh_id(old["src"], row["sku"], old["glb"]), "until": SRC_LIVE["inn-02"]}] + old.get("was", [])) \
                    if old and "glb" in old else []
                skus[row["sku"]] = {**row, "src": "inn-02", "glb": glb, "piece": "", **({"was": was} if was else {})}
    # outdoors-02 (RunPod, 2026-10-05): the yard's plants, trees, edge kits (fence / hedge / dry-stone wall with their
    # corner pieces and gates), yard furniture and garden things. A row may carry its own `size` (W x D x H in): two
    # tree sizes live under one catalog line, and the low hedge is not the catalog's 5-ft maze hedge.
    YARD02 = ROOT / "experiments/2026-10-05-yard-props"
    yard02_manifest = ROOT / "catalog/runs/outdoors-02/manifest.tsv"
    if yard02_manifest.exists():
        for row in load_manifest(yard02_manifest):
            glb = YARD02 / "models" / f"{row['source']}.glb"
            if glb.exists():
                skus[row["sku"]] = {**row, "src": "outdoors-02", "glb": glb, "piece": "",
                                    **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    # castle / crypt / mansion + the vertical kit (RunPod + the free image route, 2026-10-05): four run folders, one
    # manifest each, and one flats folder. A mesh row may carry its own `size`. Rules that keep the inn as it was:
    #   - a sku name that already exists is NEVER replaced by this batch (the new stairs are `--t10` skus beside the inn's);
    #   - a new sku under a role + family the library ALREADY HAD (a great chandelier-ring, a royal rug-runner, a t10 stair)
    #     gets an EXCLUSIVE tier named for its run; so does every mesh the mansion specified as tier `fine` (-> `noble`).
    #     Exclusive tiers are rolled only by room types that list them in `tiers` (solver.js chooseSku), so every inn
    #     room keeps rolling exactly the meshes it had. New roles, and wall pieces in a new family, are open to all.
    CCM = ROOT / "experiments/2026-10-05-castle-crypt-mansion"
    CCM_FAMILIES = {"crypt-stone", "castle-rough", "noble-panel", "noble-paper", "conservatory", "noble-interior",
                    "dressed-stone", "fieldstone", "half-timber", "rough-timber", "log-cabin"}
    CCM_TIER = {"crypt-01": "crypt", "castle-01": "castle", "mansion-01": "noble", "vertical-01": "storey"}
    had = {(r["object"], r["family"]) for r in skus.values()}  # role + family pairs with a mesh or flat before this batch
    for folder, ext, opaque in (("seamless", "png", True), ("decals", "jpg", False)):
        for path in sorted((CCM / "flats" / folder).glob(f"*.{ext}")):
            obj, _, var = path.stem.partition("--")  # floor-x--v2..v4: colour-matched variants; decal-x--s1..: shape variants
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "ccm" if (obj, "") in had else "",
                               "shape": var or ("v1" if opaque else ""), "src": "ccm-flats-01", "plate": path, "piece": "", **({"opaque": True} if opaque else {})}
    ccm_skipped = []
    for src, folder in (("crypt-01", "crypt"), ("castle-01", "castle"), ("mansion-01", "mansion"), ("vertical-01", "vertical")):
        manifest = ROOT / "catalog/runs" / src / "manifest.tsv"
        if not manifest.exists():
            continue
        for row in load_manifest(manifest):
            glb = CCM / folder / "models" / f"{row['source']}.glb"
            if not glb.exists():
                continue
            if row["sku"] in skus:
                ccm_skipped.append(f"{src}/{row['sku']} (kept {skus[row['sku']]['src']})")
                continue
            row = dict(row)
            # make_manifest.py reads the first `--` part of a kit sku as its wall family: right for wall-straight--crypt-stone,
            # wrong for door-crypt--leaf, stair-straight--t10, portcullis--..--raised. What is not a wall family is shape.
            if row["family"] and row["family"] not in CCM_FAMILIES:
                row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
                row["family"] = ""
            known = (row["object"], row["family"]) in had
            piece = "leaf" if row["shape"] == "leaf" or row["shape"].endswith("-leaf") else ""  # leaf-only doors fill their opening (look.js)
            if piece and row["shape"] == "leaf" and any(o == row["object"] for o, _ in had):  # (by role alone: the inn's framed doors carry a family, a leaf does not)
                row["shape"] = CCM_TIER[src] + "-leaf"  # a second leaf for a door the inn already hangs: only by request (walls.js DOORS leaf)
            if (src == "mansion-01" and row["tier"] == "fine") or (known and not piece):
                row["tier"] = CCM_TIER[src]
            flags = set(filter(None, (row.get("flags") or "").split(",")))
            skus[row["sku"]] = {**row, "src": src, "glb": glb, "piece": piece, "hung": "hung" in flags, "fit": "box" if row.get("gen") == "kit" and row.get("size") and row["place"] != "kit" else "",  # a kit-generated piece that stands as a prop (the dais): stretched per axis to its own box, as kit pieces are (solver.js dims)
                                **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if ccm_skipped:
        print(f"castle/crypt/mansion: {len(ccm_skipped)} sku names already in the library, NOT replaced: {', '.join(ccm_skipped[:8])}")
    # >>> tem:data.batch
    # temple & chapel (2026-10-11): one run folder (experiments/2026-10-11-types/tem/batch, manifest catalog/runs/tem-01) and
    # one flats folder. Same rules as the castle / crypt / mansion block: a sku name that exists is never replaced; a new
    # mesh under a role + family the library already had (the marble altar) gets the exclusive tier `temple`.
    TEM = ROOT / "experiments/2026-10-11-types/tem"
    tem_had = {(r["object"], r["family"]) for r in skus.values()}
    for path in sorted((TEM / "flats/decals").glob("*.jpg")):
        obj, _, var = path.stem.partition("--")  # flavor-banner--sun: the flavor is the shape
        if path.stem not in skus:
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var, "src": "tem-flats-01", "plate": path, "piece": ""}
    tem_manifest = ROOT / "catalog/runs/tem-01/manifest.tsv"
    for row in (load_manifest(tem_manifest) if tem_manifest.exists() else []):
        glb = TEM / "batch/models" / f"{row['source']}.glb"
        if not glb.exists() or row["sku"] in skus:
            continue
        row = dict(row)
        if row["family"] and row["family"] != "temple-stone":
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
            row["family"] = ""
        if (row["object"], row["family"]) in tem_had or row["object"] in ("rite-alms-box",):  # (the alms box is in a recipe the castle chapel reads: the golden test)
            row["tier"] = "temple"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "tem-01", "glb": glb, "piece": "", "hung": "hung" in flags, "fit": "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    # <<< tem:data.batch
    # >>> type:dun
    # Dungeon & prison (2026-10-11): one run folder (dun-01) and its flats folder, by the castle / crypt / mansion rules:
    # a sku name that exists is never replaced; a new mesh under a role + family the library already had gets the
    # exclusive tier `dun` (rolled only by room types that list it), so every older room rolls what it rolled before;
    # so does every other dungeon mesh and decal (see below). A room type of another kind takes them by adding 'dun' to its `tiers`.
    DUN = ROOT / "experiments/2026-10-11-types/dun"
    dun_had = {(r["object"], r["family"]) for r in skus.values()}
    for folder, ext, opaque in (("seamless", "png", True), ("decals", "jpg", False)):
        for path in sorted((DUN / "flats" / folder).glob(f"*.{ext}")):
            if path.stem in skus:
                continue
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "" if opaque and (obj, "") not in dun_had else "dun",
                               "shape": var or ("v1" if opaque else ""), "src": "dun-flats-01", "plate": path, "piece": "", **({"opaque": True} if opaque else {})}
    dun_manifest = ROOT / "catalog/runs/dun-01/manifest.tsv"
    dun_skipped = []
    for row in (load_manifest(dun_manifest) if dun_manifest.exists() else []):
        glb = DUN / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            dun_skipped.append(row["sku"])
            continue
        row = dict(row)
        if row["family"] and row["family"] != "cut-rock" and row["family"] not in CCM_FAMILIES:  # (door-cell-bars--leaf: not a wall family, a shape)
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
            row["family"] = ""
        known = (row["object"], row["family"]) in dun_had
        piece = "leaf" if row["shape"] == "leaf" or row["shape"].endswith("-leaf") else ""
        if piece and row["shape"] == "leaf" and any(o == row["object"] for o, _ in dun_had):
            row["shape"] = "dun-leaf"
        if row["family"] != "cut-rock":  # every dungeon mesh but the wall kit: older rooms' recipes name some of these roles (the castle armoury
            row["tier"] = "dun"          # asks for a chainmail heap), and a room that did not have a thing must not gain it by this batch
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "dun-01", "glb": glb, "piece": piece, "hung": "hung" in flags, "fit": "box" if row.get("gen") == "kit" and row.get("size") and row["place"] != "kit" else "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if dun_skipped:
        print(f"dungeon: {len(dun_skipped)} sku names already in the library, NOT replaced: {', '.join(dun_skipped[:8])}")
    # <<< type:dun
    # wizard's tower (RunPod + the free image route, 2026-10-11): one run folder (wizard-01) and its flats. The rules that keep
    # every older room as it was (test/golden.mjs): a sku name that exists is never replaced; a new sku gets the EXCLUSIVE tier
    # `wizard` when its role + family already had a mesh OR when its role is named by a recipe of any older room type (so
    # no inn, crypt, castle or mansion room starts rolling an alembic). Everything else (new roles, the tower-stone wall
    # family) is open to all. Exclusive tiers are rolled only by room types that list them in `tiers`.
    WIZ = ROOT / "experiments/2026-10-11-wizard-tower"
    WIZ_FAMILIES = {"tower-stone", "half-timber"}
    wiz_had = {(r["object"], r["family"]) for r in skus.values()}
    wiz_rooms = {rt["key"] for rt in ROOM_TYPES if rt.get("group") == "Wizard's tower"}
    wiz_elsewhere = {oid for rt in ROOM_TYPES if rt["key"] not in wiz_rooms for rid in rt["recipes"] + rt.get("borrow", []) for ids in recipes[rid]["slots"].values() for oid in ids}
    for path in sorted((WIZ / "flats/decals").glob("*.jpg")):
        obj, _, var = path.stem.partition("--")
        skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "wizard" if (obj, "") in wiz_had or obj in wiz_elsewhere else "",
                           "shape": var, "src": "wizard-flats-01", "plate": path, "piece": ""}
    wiz_skipped = []
    wiz_manifest = ROOT / "catalog/runs/wizard-01/manifest.tsv"
    for row in (load_manifest(wiz_manifest) if wiz_manifest.exists() else []):
        glb = WIZ / "wizard/models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            wiz_skipped.append(row["sku"]); continue
        row = dict(row)
        if row["family"] and row["family"] not in WIZ_FAMILIES:  # (make_manifest.py reads the first `--` part of a kit sku as its wall family: wrong for door-tower--leaf)
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p); row["family"] = ""
        piece = "leaf" if row["shape"] == "leaf" else ""
        if not piece and row["place"] != "kit" and ((row["object"], row["family"]) in wiz_had or row["object"] in wiz_elsewhere or row["tier"] == "wizard"):
            row["tier"] = "wizard"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "wizard-01", "glb": glb, "piece": piece, "hung": "hung" in flags, "fit": "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if wiz_skipped:
        print(f"wizard: {len(wiz_skipped)} sku names already in the library, NOT replaced: {', '.join(wiz_skipped[:8])}")
    # market & village (RunPod, 2026-10-11): experiments/2026-10-11-types/mkt, one manifest. THE SHOP SKELETON: a trade
    # (general store, bakery, apothecary, tailor, curio) is a sku TIER on the shop roles (counter-shop,
    # shop-shelf-stocked, craft-display-table-goods, shop-floor-stock, shop-sign), written in the manifest's `tier`
    # column (mkt-general ...). A room type lists its trade's tier first in `tiers`, so one shop program lays every shop.
    # Every other mesh of the batch gets tier `mkt` (every older room keeps rolling exactly what it had: another type
    # opts in by listing `mkt` in its room types' `tiers`); a sku name that already exists is never replaced.
    MKT = ROOT / "experiments/2026-10-11-types/mkt"
    mkt_manifest = ROOT / "catalog/runs/mkt-01/manifest.tsv"
    MKT_FAMILIES = {"half-timber", "fieldstone", "rough-timber", "dressed-stone"}
    MKT_TIERS = {"mkt", "mkt-general", "mkt-bakery", "mkt-apoth", "mkt-tailor", "mkt-curio"}
    if mkt_manifest.exists():
        mkt_skipped = []
        for row in load_manifest(mkt_manifest):
            glb = MKT / "models" / f"{row['source']}.glb"
            if not glb.exists():
                continue
            if row["sku"] in skus:
                mkt_skipped.append(row["sku"])
                continue
            row = dict(row)
            if row["family"] and row["family"] not in MKT_FAMILIES:  # make_manifest.py reads a kit sku's first `--` part as its wall family (cell-holding-wood--gate)
                row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
                row["family"] = ""
            if not row["tier"] and row["place"] != "kit":  # every mesh that is not a trade's is tier `mkt`: a NEW role is as exclusive as a new sku of an old one
                row["tier"] = "mkt"                         # (an untiered scales-balance or spice sack changed the wizard's apothecary: test/golden.mjs). Wall and lockup kit pieces stay open
            flags = set(filter(None, (row.get("flags") or "").split(",")))
            skus[row["sku"]] = {**row, "src": "mkt-01", "glb": glb, "piece": "", "hung": "hung" in flags,
                                **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
        if mkt_skipped:
            print(f"market: {len(mkt_skipped)} sku names already in the library, NOT replaced: {', '.join(mkt_skipped[:8])}")
    # >>> type:min
    # Mine (2026-10-11): one run folder (min-01) and its flats folder, by the castle / crypt / mansion rules:
    # a sku name that exists is never replaced; a new mesh under a role + family the library already had gets the
    # exclusive tier `min` (rolled only by room types that list it), so every older room rolls what it rolled before;
    # so does every other mine mesh and decal (see below). A room type of another kind takes them by adding 'min' to its `tiers`.
    MIN = ROOT / "experiments/2026-10-11-types/min"
    min_had = {(r["object"], r["family"]) for r in skus.values()}
    for folder, ext, opaque in (("seamless", "png", True), ("decals", "jpg", False)):
        for path in sorted((MIN / "flats" / folder).glob(f"*.{ext}")):
            if path.stem in skus:
                continue
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "" if opaque and (obj, "") not in min_had else "min",
                               "shape": var or ("v1" if opaque else ""), "src": "min-flats-01", "plate": path, "piece": "", **({"opaque": True} if opaque else {})}
    min_manifest = ROOT / "catalog/runs/min-01/manifest.tsv"
    min_skipped = []
    for row in (load_manifest(min_manifest) if min_manifest.exists() else []):
        glb = MIN / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            min_skipped.append(row["sku"])
            continue
        row = dict(row)
        if row["family"] and row["family"] not in ("cut-rock", "mine-timbered") and row["family"] not in CCM_FAMILIES:  # (not a wall family: a shape)
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p)
            row["family"] = ""
        known = (row["object"], row["family"]) in min_had
        piece = "leaf" if row["shape"] == "leaf" or row["shape"].endswith("-leaf") else ""
        if piece and row["shape"] == "leaf" and any(o == row["object"] for o, _ in min_had):
            row["shape"] = "min-leaf"
        if row["family"] != "mine-timbered":  # every mine mesh but the wall kit: older rooms' recipes name some of these roles (a smithy asks
            row["tier"] = "min"          # for a coal bin), and a room that did not have a thing must not gain it by this batch
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "min-01", "glb": glb, "piece": piece, "hung": "hung" in flags, "fit": "box" if row.get("gen") == "kit" and row.get("size") and row["place"] != "kit" else "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if min_skipped:
        print(f"mine: {len(min_skipped)} sku names already in the library, NOT replaced: {', '.join(min_skipped[:8])}")
    # <<< type:min
    # >>> types:clt
    # Cult sanctum (RunPod + the free image route, 2026-10-11): one run folder, one manifest, its own flats. The ccm rules:
    # a sku name that already exists is never replaced; a new sku under a role + family the library already had gets the
    # exclusive tier `cult` (rolled only by room types that list it), EXCEPT the flavor-* roles: a flavor sku is asked for
    # by its shape (the flavor), by any religious type, so it carries no tier. A second sku part that is not a wall family is the shape.
    CLT = ROOT / "experiments/2026-10-11-types/clt"
    clt_manifest = ROOT / "catalog/runs/cult-01/manifest.tsv"
    CLT_FAMILIES = {"black-stone"}
    had_clt = {(r["object"], r["family"]) for r in skus.values()}
    # ... and a role that is NEW with this batch but is named in a recipe of an older room type (candle-cluster in the crypt's and
    # the chapel's) is tiered too: an existing room never starts rolling a new thing (test/golden.mjs holds all 38 to that)
    clt_roles_before = {r["object"] for r in skus.values()}
    clt_foreign = {oid for rt in ROOM_TYPES if rt.get("group") != "Cult sanctum" for rid in rt["recipes"] + rt.get("borrow", []) for ids in recipes[rid]["slots"].values() for oid in ids} - clt_roles_before
    clt_skipped = []
    for folder, ext, opaque in (("seamless", "png", True), ("decals", "jpg", False)):
        for path in sorted((CLT / "flats" / folder).glob(f"*.{ext}")):
            obj, _, var = path.stem.partition("--")
            if path.stem in skus:
                clt_skipped.append(f"flat {path.stem} (kept {skus[path.stem]['src']})"); continue
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "cult" if (obj, "") in had_clt and not obj.startswith("flavor-") else "",
                               "shape": var or ("v1" if opaque else ""), "src": "cult-flats-01", "plate": path, "piece": "", **({"opaque": True} if opaque else {}),
                               **({"own_size": [48.0, 1.0, 60.0]} if obj == "flavor-relief" else {})}  # a flat card: 1 in deep, not the catalog line's 8-in tablet
    for row in (load_manifest(clt_manifest) if clt_manifest.exists() else []):
        glb = CLT / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            clt_skipped.append(f"{row['sku']} (kept {skus[row['sku']]['src']})"); continue
        row = dict(row)
        if row["family"] and row["family"] not in CLT_FAMILIES:
            row["shape"] = "--".join(p for p in (row["family"], row["shape"]) if p); row["family"] = ""
        piece = "leaf" if row["shape"] == "leaf" or row["shape"].endswith("-leaf") else ""
        if ((row["object"], row["family"]) in had_clt or row["object"] in clt_foreign) and not piece and not row["object"].startswith("flavor-"):
            row["tier"] = "cult"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "cult-01", "glb": glb, "piece": piece, "hung": "hung" in flags,
                            "fit": "box" if row.get("gen") == "kit" and row.get("size") and row["place"] != "kit" else "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if clt_skipped:
        print(f"cult sanctum: {len(clt_skipped)} sku names already in the library, NOT replaced: {', '.join(clt_skipped[:8])}")
    # <<< types:clt
    # >>> type:hut-batch
    # Farmstead (2026-10-12): one run folder (hut-01) and its flats, by the castle / crypt / mansion / dungeon rules: a sku name
    # that exists is never replaced; every farm mesh but the wall kit carries the exclusive tier `hut` (older rooms' recipes name
    # some of these roles: the mansion's garden asks for a bee skep and a dovecote, and a room must not gain a thing by this
    # batch: test/golden.mjs). A room type of another kind takes them by adding 'hut' to its `tiers`.
    HUT = ROOT / "experiments/2026-10-11-types/hut"
    for path in sorted((HUT / "flats/seamless").glob("*.png")):
        if path.stem not in skus:
            obj, _, var = path.stem.partition("--")
            skus[path.stem] = {"sku": path.stem, "object": obj, "lane": "2d", "family": "", "tier": "", "shape": var or "v1", "src": "hut-flats-01", "plate": path, "piece": "", "opaque": True}
    hut_manifest = ROOT / "catalog/runs/hut-01/manifest.tsv"
    hut_skipped = []
    for row in (load_manifest(hut_manifest) if hut_manifest.exists() else []):
        glb = HUT / "models" / f"{row['source']}.glb"
        if not glb.exists():
            continue
        if row["sku"] in skus:
            hut_skipped.append(row["sku"])
            continue
        row = dict(row)
        if row["family"] != "wattle-daub":
            row["tier"] = "hut"
        flags = set(filter(None, (row.get("flags") or "").split(",")))
        skus[row["sku"]] = {**row, "src": "hut-01", "glb": glb, "piece": "", "hung": "hung" in flags, "fit": "box" if row.get("gen") == "kit" and row.get("size") and row["place"] != "kit" else "",
                            **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
    if hut_skipped:
        print(f"farmstead: {len(hut_skipped)} sku names already in the library, NOT replaced: {', '.join(hut_skipped[:8])}")
    # <<< type:hut-batch
    # smithy & workshop (RunPod, 2026-10-11): experiments/2026-10-11-types/smi, one manifest. THE WORKSHOP SKELETON is in
    # js/solver2.js (SMI_CRAFTS): a craft is a line of data naming its heat source, workstation, tool wall, raw stock and
    # finished goods. The shop front is a TRADE of the market's shop skeleton (tier `smi` on its five roles: solver2.js
    # mktRegisterTrade). Every mesh of the batch is tier `smi`; a sku name that already exists is never replaced.
    SMI = ROOT / "experiments/2026-10-11-types/smi"
    smi_manifest = ROOT / "catalog/runs/smi-01/manifest.tsv"
    if smi_manifest.exists():
        smi_skipped = []
        for row in load_manifest(smi_manifest):
            glb = SMI / "models" / f"{row['source']}.glb"
            if not glb.exists():
                continue
            if row["sku"] in skus:
                smi_skipped.append(row["sku"])
                continue
            row = dict(row)
            if not row["tier"]:  # every mesh of the batch is tier `smi` (as the market's are `mkt`): a NEW role is as exclusive as a new sku of an old one,
                row["tier"] = "smi"  # so a mine or a castle that lists `anvil` or `coal-bin` in a recipe keeps rolling exactly what it had
            flags = set(filter(None, (row.get("flags") or "").split(",")))
            skus[row["sku"]] = {**row, "src": "smi-01", "glb": glb, "piece": "", "hung": "hung" in flags,
                                **({"own_size": [float(v) for v in row["size"].split("x")]} if row.get("size") else {})}
        if smi_skipped:
            print(f"smithy: {len(smi_skipped)} sku names already in the library, NOT replaced: {', '.join(smi_skipped[:8])}")
    add_faction_assets(skus, ROOT, mesh_id)
    # a remeshed piece set supersedes the whole-object SKU it was split from (bar-counter pieces)
    pieced = {(r["object"], r["family"], r["tier"]) for r in skus.values() if r.get("piece")}
    for sku in [s for s, r in skus.items() if not r.get("piece") and (r["object"], r["family"], r["tier"]) in pieced]:
        del skus[sku]

    def rating(src, sku, target):
        rec = ratings.get(f"{src}/{sku}/{target}")
        return None if rec is None else {"stars": rec.get("stars"), "note": (rec.get("note") or "").strip(),
                                         "masking": "masking" in (rec.get("tags") or [])}

    runtime = {}  # sku -> {faces, bytes, bounds} from prep/blender_runtime.py (bounds in GLB units, x/up/z)
    for path in sorted((TOOL / "prep").glob("results-*.jsonl")):
        for line in path.read_text().splitlines():
            rec = json.loads(line)
            if "bounds" in rec:
                runtime[rec["sku"]] = rec
    flat_info = json.loads((TOOL / "prep/flats-out.json").read_text()) if (TOOL / "prep/flats-out.json").exists() else {}
    objects, jobs = {}, []
    for sku, r in sorted(skus.items()):
        role = roles.get(r["object"])
        if role is None or role["size"] is None:
            continue
        w, d, h = role["size"]
        obj = objects.setdefault(r["object"], {
            "id": r["object"], "desc": role["desc"], "place": role["place"], "fp": role["fp"],
            "size": [w, d, h], "scale": list(role["scale"]), "mat": role["mat"], "aff": role["aff"],
            "gen": role["gen"], "pri": role["pri"], "hint": role["hint"], "var": role["var"], "skus": [],
            **({"open_of": role["open_of"]} if role.get("open_of") else {}),
            **({"mount": role["mount"]} if role.get("mount") is not None else {})})
        rec = {"sku": sku, "family": r["family"], "tier": r["tier"], "shape": r["shape"], "piece": r.get("piece", ""),
               "src": r["src"], "model": rating(r["src"], sku, "model"), "plate": rating(r["src"], sku, "plate")}
        if "glb" in r:
            tier = "kit" if role["place"] == "kit" else ("small" if max(w, d, h) <= SMALL_IN else "default")
            faces, tex = TIERS[tier]
            rec.update(kind="mesh", url=f"assets/m/{sku}.glb", lod=tier, tex=tex, mesh=mesh_id(r["src"], sku, r["glb"]))
            if r.get("was"):
                rec["was"] = r["was"]
            if r.get("own_size"):
                rec["size"] = r["own_size"]
            if r.get("rev"):  # a mesh replaced under the same sku: look.js puts this on the colour map's URL (cached 4 h)
                rec["rev"] = rec["mesh"].rsplit("@", 1)[1]
            if sku in runtime:
                rec.update(bounds=runtime[sku]["bounds"], faces=runtime[sku]["faces"], kb=round(runtime[sku]["bytes"] / 1024))
            jobs.append({"sku": sku, "src": str(r["glb"]), "out": str(TOOL / "assets/m" / f"{sku}.glb"),
                         "faces": faces, "tex": tex, "kitfix": role["place"] == "kit" and role["fp"] == "edge"})
        else:
            rec.update(kind="flat", url=f"assets/flat/{sku}.webp", plate=str(r["plate"]))
            if r.get("own_size"):  # types:clt: a flat with its own box (the relief cards)
                rec["size"] = r["own_size"]
            if sku in flat_info:
                rec.update(px=[flat_info[sku]["w"], flat_info[sku]["h"]])
        obj["skus"].append(rec)

    EXCLUSIVE = {"crypt", "castle", "noble", "storey", "ccm", "wizard"}  # sku tiers rolled only by room types that list them in `tiers` (the batch block above)
    EXCLUSIVE |= {"temple"}  # temple & chapel (2026-10-11)
    EXCLUSIVE |= {"dun"}  # type:dun (Dungeon & prison, 2026-10-11)
    EXCLUSIVE |= {"mkt", "mkt-general", "mkt-bakery", "mkt-apoth", "mkt-tailor", "mkt-curio"}  # market & village: `mkt` and one tier per trade (the shop skeleton)
    EXCLUSIVE |= {"min"}  # type:min (Mine, 2026-10-11)
    EXCLUSIVE |= {"cult"}  # types:clt
    EXCLUSIVE |= {"hut"}  # type:hut (Farmstead, 2026-10-12)
    EXCLUSIVE |= {"smi"}  # smithy & workshop (2026-10-11): every mesh of the batch; the shop front is the trade `smi` of the shop skeleton
    EXCLUSIVE |= {"lai"}  # type:lai (Monster lair, 2026-10-12)
    for obj in objects.values():
        tiers = {s["tier"] for s in obj["skus"]}
        if tiers and tiers <= EXCLUSIVE:
            obj["only"] = sorted(tiers)
        if any(skus[s["sku"]].get("hung") for s in obj["skus"]):
            obj["hung"] = True
        for s in obj["skus"]:
            if skus[s["sku"]].get("fit"):
                s["fit"] = skus[s["sku"]]["fit"]
    visible = lambda oid, rt: not objects[oid].get("only") or any(t in objects[oid]["only"] for t in rt.get("tiers", []))
    # room types: union of recipe slots, filtered to objects we can show (mesh or flat) plus sets we can assemble
    rooms_out = []
    for rt in ROOM_TYPES:
        slots, missing = {}, set()
        for rid in rt["recipes"] + rt.get("borrow", []):
            rec = recipes[rid]
            for slot, ids in rec["slots"].items():
                for oid in ids:
                    if oid in objects and visible(oid, rt):
                        slots.setdefault(slot, [])
                        if oid not in slots[slot]:
                            slots[slot].append(oid)
                    elif oid in sets and all(m in objects for m, _ in sets[oid]["members"]):
                        slots.setdefault("sets", [])
                        if oid not in slots["sets"]:
                            slots["sets"].append(oid)
                    elif not oid.startswith("fx-"):
                        missing.add(oid)
        rooms_out.append({**rt, "slots": slots, "missing": sorted(missing)})
    used_sets = {s for rt in rooms_out for s in rt["slots"].get("sets", [])}
    shell = {slot: [o for o in ids if o in objects] for slot, ids in recipes[SHELL]["slots"].items()}

    (TOOL / "data").mkdir(exist_ok=True)
    (TOOL / "prep").mkdir(exist_ok=True)
    flats = [dict(sku=s["sku"], plate=s.pop("plate"), opaque=skus[s["sku"]].get("opaque", False), **({"native_alpha": True} if skus[s["sku"]].get("native_alpha") else {})) for o in objects.values() for s in o["skus"] if s["kind"] == "flat"]
    # A flat is LISTED only when its built image exists (2026-10-05: batch folders are globbed while their agents are still
    # adding PNGs; six floors went live listed with no image). prep/flats.json still names every flat, so the order stays
    # build_data.py -> prep/flats.py -> build_data.py; `--list-unbuilt` lists them anyway (a sandbox with no assets).
    if "--list-unbuilt" not in sys.argv:
        unbuilt = {f["sku"] for f in flats if not (TOOL / "assets/flat" / f"{f['sku']}.webp").exists()}
        if unbuilt:
            for oid in list(objects):
                had = len(objects[oid]["skus"]); objects[oid]["skus"] = [s for s in objects[oid]["skus"] if s["sku"] not in unbuilt]
                if had and not objects[oid]["skus"]: del objects[oid]
            for rt in rooms_out: rt["slots"] = {k: (v if k == "sets" else [i for i in v if i in objects]) for k, v in rt["slots"].items()}
            shell = {slot: [o for o in ids if o in objects] for slot, ids in shell.items()}
            print(f"NOT LISTED: {len(unbuilt)} flat images are not built yet (run prep/flats.py, then build_data.py again): {sorted(unbuilt)[:6]}")
    lib = {"objects": objects, "shell": shell,
           "sets": {sid: {"id": sid, "place": sets[sid]["place"], "fp": sets[sid]["fp"], "hint": sets[sid]["hint"],
                          "members": sets[sid]["members"]} for sid in sorted(used_sets)}}
    factions = faction_data(objects, TOOL)
    lib["factions"] = factions["factions"]
    lib["flavorSlots"] = factions["slots"]
    (TOOL / "data/factions.json").write_text(json.dumps(factions, indent=1))
    (TOOL / "data/library.json").write_text(json.dumps(lib, indent=1))
    (TOOL / "data/rooms.json").write_text(json.dumps(rooms_out, indent=1))
    (TOOL / "prep/jobs.json").write_text(json.dumps(jobs, indent=1))
    (TOOL / "prep/flats.json").write_text(json.dumps(flats, indent=1))
    n_mesh = sum(1 for o in objects.values() for s in o["skus"] if s["kind"] == "mesh")
    # orient.json keys must name a mesh this library shows now or showed before (a stale key is harmless but reported)
    orient = json.loads((TOOL / "data/orient.json").read_text()) if (TOOL / "data/orient.json").exists() else {}
    known = {s["mesh"] for o in objects.values() for s in o["skus"] if s.get("mesh")}
    past = {w["mesh"] for o in objects.values() for s in o["skus"] for w in s.get("was", [])}
    bad = [k for k in orient if k not in known and k not in past]
    print(f"orient.json: {sum(k in known for k in orient)} keys on current meshes, {sum(k in past for k in orient)} on superseded meshes"
          + (f", {len(bad)} unknown: {bad[:6]}" if bad else ""))
    print(f"objects {len(objects)}  mesh skus {n_mesh} (remeshed {remeshed})  flats {len(flats)}  jobs {len(jobs)}")
    for rt in rooms_out:
        n = sum(len(v) for v in rt["slots"].values())
        print(f"  {rt['key']:10s} {n:3d} objects  missing {len(rt['missing'])}: {', '.join(rt['missing'][:8])}")


if __name__ == "__main__":
    main()
