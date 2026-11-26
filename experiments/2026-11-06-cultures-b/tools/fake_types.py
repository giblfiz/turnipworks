#!/usr/bin/env python3
"""fake_types.json: every pack's room types (tools/spawn-tuner/culture_packs_b.py) for the --fake mode of
tools/spawn-tuner/test/cultures_b.test.mjs (test the programs before the meshes exist)."""
import json, sys
from pathlib import Path
E = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(E.parents[1] / 'tools/spawn-tuner'))
import culture_packs_b as cb
(E / 'fake_types.json').write_text(json.dumps([rt for rts in cb.ROOM_TYPES.values() for rt in rts], indent=1)); print('fake_types.json')
