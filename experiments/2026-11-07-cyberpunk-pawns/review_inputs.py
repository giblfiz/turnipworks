#!/usr/bin/env python3
"""The figure review page's inputs for this pack (../2026-10-06-figures/build_review.py picks up every experiments/*/set
with published/manifest.json + gate.json + plates.json): set/gate.json {id: {accepted_try}} and set/plates.json
{id: {tries: [{try, plate}]}} from set/gate-log.json. Plate paths point at the USB copy of the accepted plates
(git-ignored here, and the worktree goes after landing).    python3 review_inputs.py"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent; SET = HERE / 'set'
USB = Path('/mnt/usb/turnip-works/lanes-2026-11-07/cyberpunk-pawns/set-binaries/inputs')
log = json.loads((SET / 'gate-log.json').read_text())
pub = {f['id'] for f in json.loads((SET / 'published/manifest.json').read_text())['figures']}
gate, plates = {}, {}
for i in sorted(pub):
    t = next(e['try'] for e in reversed(log[i]) if e.get('ok'))
    gate[i] = {'accepted_try': t}
    plates[i] = {'tries': [{'try': t, 'plate': str(USB / f'{i}.jpg')}]}
    assert (USB / f'{i}.jpg').exists(), i
(SET / 'gate.json').write_text(json.dumps(gate, indent=1) + '\n'); (SET / 'plates.json').write_text(json.dumps(plates, indent=1) + '\n')
print(len(gate), 'figures: set/gate.json, set/plates.json')
