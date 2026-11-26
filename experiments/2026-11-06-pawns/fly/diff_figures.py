#!/usr/bin/env python3
"""After build_figures.py: is the ONLY change to data/figures.json the added `fly` objects? Compares with git HEAD's copy."""
import json, subprocess, sys
from pathlib import Path
R = Path(__file__).resolve().parents[3]
old = json.loads(subprocess.check_output(['git', '-C', str(R), 'show', 'HEAD:tools/spawn-tuner/data/figures.json'], text=True))
new = json.loads((R / 'tools/spawn-tuner/data/figures.json').read_text())
o = {f['id']: f for f in old['figures']}; n = {f['id']: f for f in new['figures']}
bad = [i for i in o if i not in n] + [i for i in n if i not in o]
bad += [i for i in n if i in o and {k: v for k, v in n[i].items() if k != 'fly'} != o[i]]
top = {k for k in set(old) | set(new) if k != 'figures' and old.get(k) != new.get(k)}
print(f"{len(n)} rows; {sum(1 for f in new['figures'] if f.get('fly'))} with fly; rows changed beyond fly: {bad or 'none'}; top-level keys changed: {top or 'none'}")
sys.exit(1 if bad or top else 0)
