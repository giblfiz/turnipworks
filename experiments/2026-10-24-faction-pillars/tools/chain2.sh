#!/usr/bin/env bash
# after chain1: gate the eight v3 pier plates (agy, serial), mesh the accepted ones on fal ($0.30 each), mesh-QA them
cd "$(dirname "$0")/.."
until grep -q CHAIN1-DONE chain1.log; do sleep 20; done
B=$(python3 -c "import json;print(' '.join(a['id'] for a in json.load(open('assets.json'))['assets'] if a['id'].startswith('flavor-buttress') and 'dragons' not in a['id']))")
python3 tools/gate_plates.py $B
rm -rf fal4; mkdir -p fal4/inputs; n=0
for s in $B; do [[ -f masked/$s.png ]] && cp masked/$s.png fal4/inputs/ && n=$((n+1)); done
echo "$(date -Is) START fal TRELLIS.2 1024: $n v3 pier plates, \$0.30 each = \$$(python3 -c "print(round($n*0.3,2))")" >> spend.log
python3 ../../src/fal_trellis.py fal4 > fal-5.log 2>&1
python3 - <<'PY' >> spend.log
import json; m=json.load(open('fal4/manifest.json')); from datetime import datetime
print(f"{datetime.now().astimezone().isoformat(timespec='seconds')} DONE fal TRELLIS.2 {len(m['assets'])} piers: ${m['estimated_total_cost_usd']:.2f}; failed {[f['asset'] for f in m['failed']]}")
PY
for g in fal4/models/*.glb; do cp "$g" models/; done
D=$(ls fal4/models/*.glb | xargs -n1 basename | sed 's/.glb//')
(cd ../.. && experiments/2026-10-24-faction-pillars/tools/qa.sh experiments/2026-10-24-faction-pillars $D)
echo CHAIN2-DONE
