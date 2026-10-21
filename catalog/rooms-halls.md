# Hallway rooms for the castle, mansion and crypt types (2026-10-11)

Every building type has a hallway room: the whole-building generator's circulation spine (`docs/BUILDINGS.md`). The inn has `tav-hallway`. These three are dressed only from meshes the library already had: nothing was generated for them. Room definitions: `tools/spawn-tuner/build_data.py` (`castle-passage`, `mansion-corridor`, `crypt-passage`); programs: the `buildings:solver2.halls` block at the end of `tools/spawn-tuner/js/solver2.js`.

### cas-passage P1
- anchor: wall-straight, door-reinforced
- furnish: armor-stand, bench-long, chest-plain
- light: torch-bracket-rough, torch-sconce, torch-stand
- dress: banner-wall, tapestry, shield-display, weapon-rack, trophy-head

### nob-corridor P1
- anchor: wall-straight, door-panelled
- furnish: table-console, bench-upholstered, urn-decorative, pedestal-display, statue-bust, clock-longcase
- light: sconce-candle-triple
- dress: rug-runner, painting-landscape, painting-portrait, painting-still-life, mirror-pier-gilt, vase-flowers, clock-mantel, candelabra

### cry-passage P1
- anchor: wall-straight, door-crypt
- furnish: bench-stone, urn-decorative
- light: torch-sconce, torch-bracket-rough, rite-pillar-candle-tall, candlestand-pricket
- dress: decal-cobweb, decal-bones-scatter, decal-moss, rite-memorial-plaque, burial-urn-niche
