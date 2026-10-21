#!/bin/bash
# after_land.sh : the live checks, run AFTER the lock is released. Writes into ../shots-live, ../live-game; prints one line each.
M=$TW_REPO; H=$(cd "$(dirname "$0")/.." && pwd); PY=python3
SLOT=/tmp/scratch/tw-slot
cd $M
echo "--- assets, live:"; python3 tools/spawn-tuner/test/assets_check.py --live 2>&1 | tail -3 | cut -c1-200
echo "--- tool sweep:"; python3 tools/tool-sweep/check.py 2>&1 | grep -i "hut-01\|coverage OK\|not in the asset rater" | cut -c1-240
echo "--- live rooms.json:"; curl -s https://implausible.enterprises/projects/turnip-works/tuner/data/rooms.json | python3 -c "import json,sys; r=json.load(sys.stdin); print(len(r), 'room types;', sum(t.get('group')=='Farmstead' for t in r), 'of the Farmstead')"
echo "--- the game:"; mkdir -p $H/live-game
$SLOT $PY $H/integration/tests/live_game_check.py HUT hut-cottage 4 4 $H/live-game/cottage --name zz-hut-check-fauna 2>&1 | tail -1 | cut -c1-900
$SLOT $PY $H/integration/tests/live_game_check.py HUT hut-farmyard 6 5 $H/live-game/farmyard --name zz-hut-check-fauna 2>&1 | tail -1 | cut -c1-300
echo "--- live shots (the record), one seed, read twice:"
$SLOT $PY $H/integration/tests/room_shots.py farmstead https://implausible.enterprises/projects/turnip-works/tuner $H/shots-live http://127.0.0.1:8096 --sizes default --seeds 11 > $H/shots-live.log 2>&1; grep -c things $H/shots-live.log; grep -v "errs 0" $H/shots-live.log | head -3
python3 $H/integration/tests/room_reads.py $H/shots-live --repeat 2 --par 8 > $H/reads-live.txt 2>&1; wc -l < $H/reads-live.txt
echo AFTER LAND DONE
