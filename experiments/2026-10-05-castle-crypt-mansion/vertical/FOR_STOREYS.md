# The vertical kit, as shipped: for the storeys and roofs agents

Written 2026-10-06 by the castle / mansion integrator. The kit (`vertical-01`, 41 meshes) is in the library since main
7d1611e: runtime builds, the faces x skins ladder, orientation. This file is what was MEASURED on the shipped files
(`tools/spawn-tuner/assets/m/<sku>.glb` with its yaw from `data/orient.json`); the design intent is `kit.json`, the mesh
QA is `QA.md`. Nothing in the storeys or roofs code was renamed or changed by this integration except one line: the four
new wall families were added to `ROOF_BY_FAMILY` (engine/core/height.js), all slate.

## Conventions that hold for every piece

- **Box** = W x D x H in inches: W across, D front to back (for a stair: the run), H up. A sku's own box
  (`sku.size` in library.json, from `manifest_overrides.json`) wins over the catalog line of its role.
- **Per-axis fit.** Pieces whose role is `place: kit` are stretched per axis to their box by the tuner (`solver.js dims`,
  `look.js kitSpec`) and by `engine/client/stairs.js fitted()`. The others (`wall`, `floor`, `attach`: buttress, corbel,
  bracket, gargoyle, ladder, post, finial, nest, weathervane) are props: scaled uniformly so their largest side matches.
- **Orientation.** After the orient step a piece's FRONT faces local +Z (a wall piece: +Z looks away from the wall).
  For a stair the front is its FOOT: **every flight in the kit climbs toward local -Z** (measured: the correlation of
  vertex height with z is -0.4 to -0.6 on all six flights after their yaw). `engine/client/stairs.js climbOf()` measures
  the same thing itself and turns the climb onto the stair entity's +z, so the game does not depend on this; a hand
  placement in the tuner does.
- **Tiers.** The four `--t10` skus and the two new ladders carry the exclusive tier `storey` (they sit under roles the
  inn already had): no room program rolls them, and `chooseSku` returns the inn's meshes as before. They are reachable by
  sku name. Everything else in the kit is an open sku under a new role or a new shape.

## What `stairPiece(lib, kind, family)` returns today (run against the shipped library)

| kind | timber families | families with "stone" in the name |
|---|---|---|
| straight | `stair-straight--rough-timber` (the inn's mesh, unchanged) | `stair-straight--dressed-stone` (the inn's, unchanged) |
| half | `stair-half--rough-timber` (NEW: was the straight flight as a stand-in) | `stair-half--dressed-stone` (NEW) |
| ladder | `ladder-wood` (the inn's) | the same |

Two things to know, neither changed here: (1) the `--t10` flights are NOT picked (the inn's sku sorts first and matches
"stone" / "timber" too); to use the kit's 10-riser flights ask for `--t10` by name. (2) `STONE = /stone/` calls
**`castle-rough` a timber family** (its name has no "stone"), so a castle's stairs come out in timber; `noble-panel`,
`noble-paper` and `conservatory` are timber by the same test, which is right for them.

## Stairs

| sku | shipped box (in) | foot and top tread | climbs toward | yaw | use |
|---|---|---|---|---|---|
| `stair-straight--dressed-stone--t10` | 48 x 120 x 120 | foot on the floor at the low end; top tread at 120 in, with a top landing 20% of the run | -Z | -90 | a full flight, 1 x 2 cells; squeezed a quarter in width (a 62-in mesh in 48) |
| `stair-straight--rough-timber--t10` | 52 x 120 x 120 | first riser 12.5 in; top tread at 118 in (the last 2 in are the upper floor's nosing) | -Z | none | a full flight, 1 x 2 cells; 52 wide (4 in clear each side of a 60-in cell); solid side rails |
| `stair-wall-hugging--dressed-stone` | 48 x 120 x 120 | top tread at 119 in | -Z | -90 | a full flight against a wall, 1 x 2 cells; right-handed as made, mirror for the other hand |
| `stair-half--dressed-stone` | 48 x 60 x 60 | six risers; top tread at 60 in | -Z | none | a half flight (a dais, a stage, a half level), 1 cell |
| `stair-half--rough-timber` | 48 x 60 x 60 | six risers, side rails; top tread at 60 in | -Z | none | a half flight, 1 cell |
| `stair-landing--dressed-stone--t10` | 60 x 60 x 60 | a solid block; its top is the walking surface at 60 in | no direction (a level block) | none | the landing of an L or dog-leg built from two half flights |
| `stair-landing--rough-timber--t10` | 60 x 60 x 69 | a deck on corner posts; the DECK is at 60 in, the posts rise to 69 (the box height) | no direction (a level block) | none | the same in timber: the box is taller than the level it serves |
| `stair-spiral-wide--dressed-stone` | 108 x 108 x 120 | round the newel through 360 degrees; last tread at 113 in | -Z (round the newel) | none | a tower stair, 9 x 9 ft (the mesh is 6.6 ft across at 10 ft tall and is widened to 9) |
| `stair-spiral-wide--rough-timber` | 108 x 108 x 120 | through about 330 degrees, the last 30 open (the way in); last tread at 113 in | -Z (round the newel) | none | turns the OTHER way from the stone spiral: mirror one if a tower mixes them |
| `stair-grand--noble-interior` | 120 x 180 x 158 | 14 even risers; top tread at 120 in; balustrade and newel caps rise to 158 (the box height) | -Z | none | the mansion entrance hall's focal, 10 x 15 ft; the box height is NOT the storey height |

Not in the kit: **a quarter-turn stair in either material** (`stair-quarter-turn--dressed-stone` was rejected: two flights in
line, not an L; the timber one never got a plate). Build the L from two `stair-half` and a `stair-landing` (the kit's own
fallback: one module). A stair with a rail or a newel has its top tread BELOW the mesh top (the grand stair, the timber
landing, both spirals): never read the storey height off the box.

**Tall rooms.** `room.recipe.tall` is per room; there is no per-room-type default in the data today (`height.js`
reads the recipe only), so the castle great hall and the mansion's hall and ballroom are one storey when made. A
`tall` field on the room type in `data/rooms.json` (`ROOM_TYPES` in `build_data.py`) read by `room.spawn` would do it;
not added here. When rooms are tall by default the 104-in caps below can be lifted in the manifest without regenerating.

## Everything else

| sku | role (place) | shipped box (in) | yaw | use |
|---|---|---|---|---|
| `buttress--s1` | buttress (wall) | 30 x 48 x 108 | 180 | against an outside wall under an overhang or a tall wall (SUPPORT_KIT.buttress) |
| `buttress--s2` | buttress (wall) | 36 x 48 x 108 (catalog) | 90 | against an outside wall under an overhang or a tall wall (SUPPORT_KIT.buttress) |
| `chimney-stack--brick` | chimney-stack (kit) | 28 x 28 x 84 | none | sunk into a roof plane (ROOF_KIT.chimney); the shape names the house: brick, cottage, mansion (48 x 24, three pots), stone |
| `chimney-stack--cottage` | chimney-stack (kit) | 32 x 32 x 48 | none | sunk into a roof plane (ROOF_KIT.chimney); the shape names the house: brick, cottage, mansion (48 x 24, three pots), stone |
| `chimney-stack--mansion` | chimney-stack (kit) | 48 x 24 x 132 | -90 | sunk into a roof plane (ROOF_KIT.chimney); the shape names the house: brick, cottage, mansion (48 x 24, three pots), stone |
| `chimney-stack--stone` | chimney-stack (kit) | 30 x 30 x 84 | none | sunk into a roof plane (ROOF_KIT.chimney); the shape names the house: brick, cottage, mansion (48 x 24, three pots), stone |
| `corbel-stone--s1` | corbel-stone (wall) | 12 x 18 x 18 (catalog) | 180 | under an overhang, stone buildings (SUPPORT_KIT.bracket); 18-in pieces, do not read at table distance |
| `corbel-stone--s2` | corbel-stone (wall) | 12 x 18 x 18 (catalog) | 0 | under an overhang, stone buildings (SUPPORT_KIT.bracket); 18-in pieces, do not read at table distance |
| `gargoyle-spout--plain` | gargoyle-spout (wall) | 10 x 30 x 14 | none | at a parapet or an eaves corner; no code asks for it yet |
| `gargoyle-spout--s1` | gargoyle-spout (wall) | 14 x 36 x 18 (catalog) | 0 | at a parapet or an eaves corner; no code asks for it yet |
| `jetty-bracket--s1` | jetty-bracket (wall) | 10 x 30 x 36 (catalog) | 90 | under a jettied upper storey, timber buildings (SUPPORT_KIT.bracket) |
| `jetty-bracket--s2` | jetty-bracket (wall) | 10 x 30 x 36 (catalog) | -90 | under a jettied upper storey, timber buildings (SUPPORT_KIT.bracket) |
| `ladder-wood--leaning` | ladder-wood (wall) | 24 x 34 x 126 | 0 | leaning: a loft or hatch ladder, feet on the floor only; upright: flat against a wall. Both are WIDE (44 to 46 in at 10 ft) |
| `ladder-wood--upright` | ladder-wood (wall) | 24 x 9 x 120 | none | leaning: a loft or hatch ladder, feet on the floor only; upright: flat against a wall. Both are WIDE (44 to 46 in at 10 ft) |
| `nest-bird--s1` | nest-bird (attach) | 14 x 14 x 7 (catalog) | none | on a chimney or a ridge; rounded underside |
| `parapet-corner--dressed-stone` | parapet-corner (kit) | 16 x 16 x 44 (catalog) | none | the pier at a corner of a flat roof's parapet (ROOF_KIT.corner) |
| `parapet-straight--dressed-stone` | parapet-straight (kit) | 60 x 12 x 36 (catalog) | none | the ledge round a flat roof (ROOF_KIT.parapet) |
| `post-timber--plain` | post-timber (floor) | 12 x 12 x 108 | none | under an overhang, timber buildings (SUPPORT_KIT.post); 9 ft, capped under the wall top |
| `roof-dormer--shingle` | roof-dormer (kit) | 72 x 60 x 42 | none | sunk into a roof plane (ROOF_KIT.dormer); shape = the roofing it matches |
| `roof-dormer--slate` | roof-dormer (kit) | 44 x 60 x 78 | none | sunk into a roof plane (ROOF_KIT.dormer); shape = the roofing it matches |
| `roof-dormer--tile` | roof-dormer (kit) | 48 x 60 x 66 | none | sunk into a roof plane (ROOF_KIT.dormer); shape = the roofing it matches |
| `roof-finial--s1` | roof-finial (attach) | 10 x 10 x 24 | none | on a ridge end or a hip point (ROOF_KIT.finial) |
| `roof-finial--s2` | roof-finial (attach) | 9 x 9 x 30 | none | on a ridge end or a hip point (ROOF_KIT.finial) |
| `roof-hatch--wood` | roof-hatch (kit) | 48 x 48 x 12 | none | the way out onto a flat roof; closed and open twins (the open one's curb is 52 in against 48) |
| `roof-hatch-open--wood` | roof-hatch-open (kit) | 48 x 52 x 50 (catalog) | none | see roof-hatch |
| `roof-ridge--lead` | roof-ridge (kit) | 60 x 14 x 9 | none | along a ridge (ROOF_KIT.ridge); lead for slate and tile roofs, thatch for thatch |
| `roof-ridge--thatch` | roof-ridge (kit) | 60 x 24 x 12 | none | along a ridge (ROOF_KIT.ridge); lead for slate and tile roofs, thatch for thatch |
| `roof-skylight--lead` | roof-skylight (kit) | 48 x 48 x 23 | none | sunk into a flat or low roof |
| `wall-crenellated--dressed-stone` | wall-crenellated (kit) | 60 x 16 x 60 | none | battlements round a flat roof, the castle's parapet (ROOF_KIT.parapet, second choice); also the castle courtyard's fallback curtain wall |
| `wall-crenellated-corner--dressed-stone` | wall-crenellated-corner (kit) | 28 x 28 x 66 (catalog) | none | the battlement's corner piece |
| `weathervane--banner` | weathervane (attach) | 30 x 8 x 48 (catalog) | none | on a ridge or a finial (ROOF_KIT.finial, second choice); spiked, no flat foot |

Notes: `wall-crenellated--dressed-stone` ships at a 1.57x height stretch (accepted: it stands level with its corner
piece). `roof-ridge--lead` 60 x 14 x 9, `roof-hatch--wood` 48 x 48 x 12 and `roof-skylight--lead` 48 x 48 x 23 are
lower than their meshes (they are sunk into the roof). `chimney-stack--mansion` is the one roof piece with a long side:
its yaw (-90) lays the long side along local X. Roofing surfaces (`roofing-thatch`, `-tile-clay`, `-slate`,
`-shingle-wood`) are flats, live since the crypt.

## Names the roofs and supports code asks for, against what exists

`ROOF_KIT` and `SUPPORT_KIT` (engine/client/roofs.js, world.js) ask by ROLE, and every role they name first now has a
mesh: `chimney-stack`, `roof-dormer`, `parapet-straight`, `parapet-corner`, `roof-ridge`, `roof-finial`, `jetty-bracket`,
`post-timber`, `buttress`; second choices `wall-crenellated`, `weathervane`, `corbel-stone` too. No mismatch found. Not
made: `roof-dormer--thatch`, `roof-ridge--tile` (no plate), and no glass roof for the conservatory (it takes slate).

## Capped under the wall (lift when rooms are tall)

`banner-pole--s1/--s2`, `pillar-round`, `fireplace-grand`, `fireplace-marble`, `bookcase-ladder`: 104 in in the manifests
(`../castle/manifest_overrides.json`, `../mansion/manifest_overrides.json`). `post-timber--plain` is 108.
