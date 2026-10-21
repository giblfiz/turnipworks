#!/usr/bin/env python3
"""Install only accepted emblem icons in Step 3, after Steps 1/2 have landed."""
from pathlib import Path
import hashlib,json
from PIL import Image
B=Path(__file__).resolve().parents[1]
ROOT=B.parents[1]
out=ROOT/'tools/spawn-tuner/assets/emblems';out.mkdir(parents=True,exist_ok=True)
records=[]
for a in json.loads((B/'icon-assets.json').read_text())['assets']:
 f=a['faction'];v=json.loads((B/'icons/qa'/f/'verdict.json').read_text())
 if v.get('status') != 'accepted':raise ValueError(f'{f}: not accepted: {v}')
 source=B/'icons/runtime'/f'{f}@2x.png'; dest=out/f'{f}.webp'
 Image.open(source).save(dest,'WEBP',lossless=True)
 records.append(dict(faction=f,emblem=f'assets/emblems/{f}.webp',sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),source=str(source.relative_to(B))))
(B/'icons/installed.json').write_text(json.dumps(records,indent=2)+'\n')
print(f'Installed {len(records)} accepted icons')
