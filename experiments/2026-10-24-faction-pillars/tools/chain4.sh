#!/usr/bin/env bash
# after chain3: the forge pier (its plate passed by a measured override, meshed on fal on its own)
cd "$(dirname "$0")/.."
until grep -q CHAIN3-DONE chain3.log; do sleep 20; done
(cd ../.. && experiments/2026-10-24-faction-pillars/tools/qa.sh experiments/2026-10-24-faction-pillars flavor-buttress--forge-hammer-fct flavor-buttress--nature-fct) | grep "fct |"
$HOME/.local/share/tw-trimesh-venv/bin/python integration/pier_end.py models/flavor-buttress--forge-hammer-fct.glb models/flavor-buttress--nature-fct.glb > integration/pier-end-forge.json
python3 - <<'PY'
import json
from pathlib import Path
o=json.loads(Path('integration/orientation.json').read_text()); m=json.loads(Path('integration/pier-end-forge.json').read_text())
for f,r in m.items():
    sku=Path(f).stem
    o[sku]=dict(yaw=r['yaw'],sourceSha256=r['sha256'],evidence=dict(rule='pier end measured (integration/pier_end.py): tall end %s, offset %s; yaw puts the pier at +Z (in the room), the arch leaning back to the wall, as tem-01 sun/moon'%(r['tall_end'],r['offset']),measurements='integration/pier-end-forge.json',meshGate='qa/%s.verdict.json'%sku))
    print(sku, r['tall_end'], r['offset'], r['yaw'], r['ext'])
Path('integration/orientation.json').write_text(json.dumps(o,indent=1)+'\n')
PY
echo CHAIN4-DONE
