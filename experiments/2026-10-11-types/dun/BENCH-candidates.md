# dun-01: pieces that want Harry's Alignment Bench

Only accepted meshes are listed (see QA.md). Nothing here was placed on the Bench by this run.

## Fire anchors (the piece is painted UNLIT; the engine adds the flame)
| sku | what to anchor | note |
|---|---|---|
| trap-flame-jet | one flame anchor in the dragon's throat, pointing forward and slightly up, as a jet (not a candle flame) | spec `light: flame-jet`, `bench: fire`. A jet wants a direction as well as a point; the soot fan on the block shows which way it fires |
| shrine-wayside | two candle anchors on the offering shelf (the two wax stubs) | spec `light: candle`, `bench: fire`. Small flames; the idol niche should stay dark |

Not on the list on purpose: `adventurer-remains--s2` carries a lantern painted dark (dressing, not a light); `shoring-timber`
and `chasm-post-pair` have an empty lantern hook (hang a library lantern there if wanted); `obelisk-rune` and
`door-rune-sealed--leaf` have dull runes (the obelisk's are painted bright gold already: see QA.md) and are rune-light
candidates for the engine, not fire.

## Water
| sku | what to anchor | note |
|---|---|---|
| fountain-skull | a water surface in the half-round basin and a thin fall from the skull's mouth | spec `bench: water`; the basin is painted dry and dark. Wall piece, mount 0 |

Related, no Bench needed but the room program must know: `crate-floating` is cut flat at the waterline and carries its own
green scum patch: it sits ON the water plane of the flooded chamber (raise it to the water height). `pillar-flooded` has
its tide line at one third of its height (about 33 in): the water plane should sit at or just under that line.
`sewer-pipe-mouth` and `sewer-grate` are dry mouths; an outflow effect would be the engine's.

## Open / shut (twins and door leaves)
| sku | what | note |
|---|---|---|
| chest-treasure-open | open twin of the library's `chest-treasure` (catalog `open_of:chest-treasure`), `bench: twin` | The crypt's `chest-treasure` is ALREADY painted open and full; this is the same chest with the lid right back and overflowing. Align footprint and floor contact of the pair; size 40x30x40 against the closed line's 34x20x24 |
| door-cell-bars--leaf | hinge edge: the two knuckle hinges are on the LEFT edge as painted, lock box on the right | leaf only; box 40x7x84. Fits `wall-doorway--dressed-stone` (prison half) and the castle's dungeon |
| door-rune-sealed--leaf | no hinges are painted (a monolith): choose slide or pivot; if it pivots, either edge | leaf only; box 44x14x90; got a quarter turn so that its broad face lies along X like the other leaves. Fits `wall-doorway--cut-rock` (opening measured 36 in x 82 in on the mesh at 60x12x108: the 44 in leaf overlaps the jambs by 4 in a side, as a slab door standing in front of the opening would) |
| door-face-carved--leaf | as the rune door; the carved face is the worked side | leaf only; box 44x17x90 |

For all three leaves and the four wall panels: which broad side is the worked / room-facing face was not checked
against the engine's convention (+Z or -Z). The cut-rock panels are chiselled on both faces; `wall-straight--cut-rock--s3`
has its torch nook on ONE face only.

## Wall-mounted, mount 0 (stand on the floor against a wall: check the flat back faces the wall)
trap-dart-wall, skeleton-chained, sewer-pipe-mouth, sewer-grate, fountain-skull, shrine-wayside (floor piece, but flat-backed),
vault-shelf-treasure (floor piece, back to the wall).
