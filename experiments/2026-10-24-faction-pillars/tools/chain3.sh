#!/usr/bin/env bash
# after chain2: orientation for every accepted pillar (five-view sheets, one agy read a sheet) and pier (measured pier end)
cd "$(dirname "$0")/.."
until grep -q CHAIN2-DONE chain2.log; do sleep 20; done
(cd ../.. && experiments/2026-10-24-faction-pillars/tools/qa.sh experiments/2026-10-24-faction-pillars flavor-pillar--sword-shield-fct) | grep "fct |"
ACC=$(awk -F'\t' '$2=="accept"{print $1}' qa/summary.tsv | grep -v dragons)
PIL=$(echo "$ACC" | grep '^flavor-pillar' | tr '\n' ' '); PIER=$(echo "$ACC" | grep '^flavor-buttress' | tr '\n' ' ')
echo "pillars: $PIL"; echo "piers: $PIER"
if [[ -n ${PIL// } ]]; then
  (cd ../.. && python3 experiments/2026-10-24-faction-pillars/integration/orientation_prepare.py --skus $PIL) | tail -2
  python3 integration/orient_sheets.py $(ls orientation/raw/sheet-*.json | xargs -n1 basename | sed 's/.json//')
fi
if [[ -n ${PIER// } ]]; then
  $HOME/.local/share/tw-trimesh-venv/bin/python integration/pier_end.py $(for s in $PIER; do echo models/$s.glb; done) > integration/pier-end-rest.json
  python3 - <<'PY'
import json
from pathlib import Path
o=json.loads(Path('integration/orientation.json').read_text()); m=json.loads(Path('integration/pier-end-rest.json').read_text())
for f,r in m.items():
    sku=Path(f).stem
    o[sku]=dict(yaw=r['yaw'],sourceSha256=r['sha256'],evidence=dict(rule='pier end measured (integration/pier_end.py): tall end %s, offset %s; yaw puts the pier at +Z (in the room), the arch leaning back to the wall, as tem-01 sun/moon'%(r['tall_end'],r['offset']),measurements='integration/pier-end-rest.json',meshGate='qa/%s.verdict.json'%sku))
    print(sku, r['tall_end'], r['offset'], r['yaw'], r['ext'])
Path('integration/orientation.json').write_text(json.dumps(o,indent=1)+'\n')
PY
fi
echo CHAIN3-DONE
