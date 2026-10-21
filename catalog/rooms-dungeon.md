# Dungeon & prison rooms — recipes for the Dungeon type (2026-10-11)

Fourteen rooms for the Build tray's Dungeon & prison type (room definitions: `tools/spawn-tuner/build_data.py`, block `type:dun`; rules in words: `tools/spawn-tuner/ROOMS.md` → Dungeon). The recipes that already existed stay where they are and are reused: `dun-cell-block`, `dun-guard-room`, `dun-jailer-station`, `dun-interrogation`, `dun-executioners-room`, `dun-vault`, `dun-sewers`, `dun-puzzle-hall`, `dun-trial-of-crossing`, `dun-last-party`, `dun-dropped-gear`, `dun-prisoner-ration`. Traps and hazards are ordinary placeable things with the catalog's `trap` / `hazard` affordances; no trap behaviour exists.

### dun-shell P2
- walls: wall-straight, wall-doorway
- floor: floor-cut-rock, floor-flagstone-dungeon, floor-flagstone-damp, floor-flagstone-broken, floor-flagstone-large, floor-water-flooded
- openings: door-reinforced, door-cell-bars, door-rune-sealed, door-face-carved, portcullis
- supports: pillar-square, pillar-broken

### dun-corridor P2
- anchor: statue-guardian, collapse-rubble
- furnish: rubble-pile, bones-pile, pillar-square, obelisk-rune
- light: torch-bracket-rough, torch-sconce
- dress: manacles-wall, adventurer-remains, decal-cobweb, decal-cracks, decal-rubble-scatter, decal-moss, puddle, decal-bones-scatter

### dun-trap-corridor P2
- anchor: pressure-plate, trap-spikes, trap-spike-pit, pit-open, trap-blade, trap-dart-wall
- furnish: trap-flame-jet, trap-crossbow, boulder-rolling, lever-floor, lever-wall, bear-trap
- light: torch-bracket-rough, torch-sconce
- dress: adventurer-remains, bones-pile, decal-blood, decal-cracks, decal-bones-scatter

### dun-dead-end P2
- anchor: collapse-rubble, door-rune-sealed, door-face-carved, statue-guardian, mimic-chest, chest-treasure
- furnish: rubble-pile, shoring-timber, shrine-wayside
- light: torch-bracket-rough, torch-stand
- dress: adventurer-remains, decal-blood, decal-rubble-scatter, decal-cracks, decal-cobweb

### dun-cell-block-kit P2
- anchor: cell-bars, door-cell-bars
- furnish: bed-cell-stone, bed-straw-pallet, cell-bench-plank, table-square, stool-three-leg, stocks
- store: bucket-slop, chest-ironbound, barrel
- light: torch-bracket-rough, mil-guard-lantern
- dress: skeleton-chained, ball-and-chain, chain-pile, manacles-wall, key-hook-board, key-ring, lever-wall, decal-straw-scatter, bones-pile

### dun-guard-post P2
- anchor: table-square
- furnish: stool-three-leg, cot
- store: weapon-rack, chest-ironbound, barrel
- light: torch-bracket-rough, brazier-standing, mil-guard-lantern
- dress: dice-and-cup, tankard, key-hook-board, key-ring, mil-duty-roster, mil-crossbow-rack, mil-helmet-peg-rack, lever-wall, shield-round

### dun-interrogation-kit P2
- anchor: chair-interrogation, rack-torture, iron-maiden, table-torture-tools
- furnish: whipping-post, gibbet-cage-standing, cage-floor, block-headsman, stocks
- store: bucket-slop
- light: brazier-irons, torch-bracket-rough
- dress: manacles-wall, skeleton-chained, shackles-leg, decal-blood

### dun-treasure-vault P2
- anchor: chest-treasure-open, chest-treasure, dun-treasure-hoard
- furnish: statue-guardian, pedestal-display, vault-shelf-treasure
- store: strongbox-stack, chest-ironbound, gold-bars, coin-pile, silver-plate-pile, armor-chainmail-heap
- light: torch-bracket-rough
- dress: mimic-chest, pressure-plate, casket-ornate

### dun-sewer-access P2
- anchor: sewer-channel-strip, sewer-outflow, sewer-grate
- furnish: sewer-sluice-gate, ladder-wood, barrel
- light: torch-bracket-rough
- dress: sewer-debris-clog, flotsam-crate, refuse-pile, decal-slime, puddle, decal-moss

### dun-puzzle-hall-kit P2
- anchor: door-rune-sealed, door-face-carved, rune-tile, floor-mosaic, statue-rotating
- furnish: orb-socket-pedestal, block-sliding, puzzle-dial-pillar, obelisk-rune, lever-floor
- light: torch-bracket-rough
- dress: lever-wall, decal-glyph-warding, decal-drag-marks, adventurer-remains

### dun-chasm-crossing P2
- anchor: chasm-strip, chasm-strip-wide, bridge-stone-natural
- furnish: stepping-pillars, plank-bridge, bridge-post-rope, statue-guardian
- light: torch-bracket-rough
- dress: rubble-pile, adventurer-remains, decal-cracks, decal-rubble-scatter

### dun-monster-den P2
- anchor: nest-monster, carcass-ribcage, eggs-monster
- furnish: web-cocoon, stalagmite, mushroom-cave-giant
- store: bones-pile, skull-pile, refuse-pile
- light: torch-bracket-rough
- dress: adventurer-remains, decal-web-floor, decal-claw-marks, decal-bones-scatter, decal-blood, decal-slime

### dun-shrine-niche P2
- anchor: shrine-wayside, statue-forgotten-god
- furnish: statue-guardian
- light: torch-bracket-rough
- dress: decal-moss, decal-cracks

### dun-flooded-chamber P2
- anchor: pillar-waterline, statue-forgotten-god, statue-guardian
- furnish: stepping-pillars, flotsam-crate, column-drums-fallen, fountain-wall-skull
- light: torch-bracket-rough
- dress: rubble-pile, sewer-grate

### dun-collapsed-hall P2
- anchor: collapse-rubble, pillar-broken, column-drums-fallen
- furnish: ceiling-slab-fallen, shoring-timber, rubble-pile
- light: torch-bracket-rough
- dress: adventurer-remains, decal-rubble-scatter, decal-cracks
