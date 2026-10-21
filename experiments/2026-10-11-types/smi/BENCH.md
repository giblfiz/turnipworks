# For the Alignment Bench: smithy & workshop

For Harry's bench (https://implausible.enterprises/projects/turnip-works/align/). Everything was generated COLD, UNLIT and DRY.
The tool sweep lists these by itself (`fireType()` and the manifest's flags); this file is the notes. `prep/fire_anchors.py` derived NO anchor for the three fire pieces below (the sweep says so): they start from the type default, so the bench is where their fire gets put.

## Fire (3 new pieces)

| piece | room | flame type the code gives it | what the bench should settle |
|---|---|---|---|
| `forge` | blacksmith's forge (and it is the one a future craft with a hearth would reuse) | brazier (an open fire: `fire.js fireType`, the line added with this type) | WHERE the fire sits: on the coal bed on top of the waist-high hearth, under the hood, not on the floor and not in the ash hole; its width (a bed about 3 ft across, low flames, a strong glow) |
| `kiln-pottery` | potter's workshop; the yard, where no bloomery was made | oven (a cavity with a mouth) | the stoke hole in the front of the dome: a glow inside, little flame; smoke from the chimney pot on top would be the better tell |
| `smelter` | smith's yard, from 500 sq ft | oven (the mine type's line, `/^smelter/`: a fire behind the tap hole) | the tap hole at its foot; flame and smoke out of the open top would be the better tell |

Later crafts that will add fire sources (not built): the cooper's cresset (`craft-cooper-cresset-fire`), the bronze
furnace (`smith-furnace-bronze`), a glassblower's glory hole, the dwarven hearth (`smith-forge-dwarven-hearth`).

## Water (plain small-vessel water)

| piece | room | state |
|---|---|---|
| `quench-trough` (inn-02 mesh, reused) | by the anvil in the forge | already has automatic water (`data/water_auto.json`, `inn-02/quench-trough`): worth one look on the bench now that it is the forge's second most important piece. Steam on a quench is an effect for later (`fx-steam`) |
| `horse-trough-stone` (inn-01 / inn-02, reused) | the yard, by the hitching rail | already has automatic water |
| `rural-water-bucket-stable`, `bucket` (reused) | by the potter's wheel; the farrier's kit | already have automatic water |
| `potters-wheel` | potter | its wooden bowl was generated dry and empty: a spoonful of slip water, optional |

Not built, and they will need the bench when they are: the tanner's vats (`craft-tanner-vat-paddle`,
`craft-tanner-lime-pit`, `tanning-pit`: murky, opaque liquor, a different colour from plain water) and a dyer's vats.

## Hinge / open-shut

None in this batch (no doors, lids or twins were made).
