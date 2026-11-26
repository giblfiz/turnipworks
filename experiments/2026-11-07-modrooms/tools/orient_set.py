#!/usr/bin/env python3
"""data/orient.json for this batch's props (run after build_data.py), with the evidence per mesh in qa-extra/orient-decisions.json:
  props    yaw from qa-extra/orient-read.json (Gemini: which of four turns shows the FRONT), when it is not symmetric and
           its confidence is at least 60; a mesh that was not read gets NO entry (the solver's box rule turns it)
  kit      none: the runtime tier turns wall panels, leaves and posts (prep/blender_runtime.py kit_fix)
    python3 experiments/2026-11-06-sprawl/tools/orient_set.py"""
import json
from pathlib import Path
E = Path(__file__).resolve().parent.parent; TU = E.parents[1] / 'tools/spawn-tuner'
L = json.load(open(TU / 'data/library.json'))['objects']; O = json.load(open(TU / 'data/orient.json'))
read = json.loads((E / 'qa-extra/orient-read.json').read_text()) if (E / 'qa-extra/orient-read.json').exists() else {}
dec = {}
for oid, o in L.items():
    for k in o['skus']:
        if k.get('src') != 'sprawl-01' or k.get('kind') != 'mesh' or o['place'] == 'kit': continue
        r = read.get(k['sku'])
        if r and r.get('yaw') is not None and not r.get('symmetric') and (r.get('conf') or 0) >= 60: y, why = r['yaw'], f"Gemini four-turn front read: {r.get('object')}, conf {r.get('conf')}"
        else: y, why = 0, ('read symmetric / unsure: ' + json.dumps(r) if r else 'not read (the four-turn read was stopped after 8 of 32 for the shared agy queue): no entry, the box rule decides')
        if r and r.get('yaw') is not None: O[k['mesh']] = y
        else: O.pop(k['mesh'], None)  # no entry: solver.js dims() turns a mesh whose long side disagrees with its catalog box (the box rule)
        dec[k['mesh']] = {'yaw': y, 'evidence': why}
(TU / 'data/orient.json').write_text(json.dumps(O, indent=1))
(E / 'qa-extra/orient-decisions.json').write_text(json.dumps(dec, indent=1))
for m, d in sorted(dec.items()): print(f"{d['yaw']:>4} {m:52s} {d['evidence'][:90]}")
