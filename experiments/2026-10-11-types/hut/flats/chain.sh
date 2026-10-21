#!/bin/bash
# chain.sh : wait for the mesh plate queue (../queue.pid) to finish, then paint the flats one at a time
cd "$(dirname "$0")"
while kill -0 "$(cat ../queue.pid 2>/dev/null)" 2>/dev/null; do sleep 20; done
./run_queue.sh gen-1.log floor-field-furrows room-hut-cottage room-hut-kitchen room-hut-bedroom room-hut-loft room-hut-passage room-hut-cellar room-hut-byre room-hut-coop room-hut-pigsty room-hut-barn room-hut-granary room-hut-dairy room-hut-garden room-hut-field room-hut-orchard room-hut-farmyard
