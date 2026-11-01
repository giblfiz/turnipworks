#!/usr/bin/env bash
# dragon pier v3: plate gate -> fal; then mesh QA of the 12 RunPod pillars (agy calls one at a time)
cd "$(dirname "$0")/.."
python3 tools/gate_plates.py flavor-buttress--dragons-fct
if [[ -f masked/flavor-buttress--dragons-fct.png ]]; then
  mkdir -p fal3/inputs; cp masked/flavor-buttress--dragons-fct.png fal3/inputs/
  echo "$(date -Is) START fal TRELLIS.2 1024: flavor-buttress--dragons-fct v3 plate (side profile), \$0.30" >> spend.log
  python3 ../../src/fal_trellis.py fal3 > fal-4.log 2>&1 && echo "$(date -Is) DONE fal TRELLIS.2 flavor-buttress--dragons-fct v3: \$0.30" >> spend.log
  mkdir -p models/v2; mv models/flavor-buttress--dragons-fct.glb models/v2/; cp fal3/models/flavor-buttress--dragons-fct.glb models/
  (cd ../.. && experiments/2026-10-24-faction-pillars/tools/qa.sh experiments/2026-10-24-faction-pillars flavor-buttress--dragons-fct)
fi
P=$(ls models/flavor-pillar--*.glb | xargs -n1 basename | sed 's/.glb//' | grep -v dragons)
(cd ../.. && experiments/2026-10-24-faction-pillars/tools/qa.sh experiments/2026-10-24-faction-pillars $P)
echo CHAIN1-DONE
