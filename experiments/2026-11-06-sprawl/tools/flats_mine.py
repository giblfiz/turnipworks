#!/usr/bin/env python3
"""prep/flats.py for THIS batch's flats only (tier mod, src sprawl-flats-01): the full run would rewrite every flat in
assets/flat, which in a worktree are links into main. Writes assets/flat/<sku>.webp for our skus and merges their
aspect info into prep/flats-out.json.   (run from anywhere)   python3 experiments/2026-11-06-sprawl/tools/flats_mine.py"""
import json, sys
from pathlib import Path
E = Path(__file__).resolve().parents[1]; TU = E.parents[1] / 'tools/spawn-tuner'
sys.path.insert(0, str(TU / 'prep')); import flats as F
mine = [j for j in json.loads((TU / 'prep/flats.json').read_text()) if str(E / 'flats') in j['plate']]
assert mine, 'no sprawl flats in prep/flats.json (run build_data.py first)'
for j in mine:
    t = TU / 'assets/flat' / f"{j['sku']}.webp"
    if t.is_symlink(): t.unlink()
keep = json.loads((TU / 'prep/flats-out.json').read_text())
orig_read = Path.read_text
def read_text(self, *a, **k):
    if self == TU / 'prep/flats.json': return json.dumps(mine)
    return orig_read(self, *a, **k)
Path.read_text = read_text
F.main()  # writes our webps and a flats-out.json holding only ours
Path.read_text = orig_read
ours = json.loads((TU / 'prep/flats-out.json').read_text()); keep.update(ours)
(TU / 'prep/flats-out.json').write_text(json.dumps(keep, indent=1)); print(len(ours), 'sprawl flats ->', TU / 'assets/flat')
