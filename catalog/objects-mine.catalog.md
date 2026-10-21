# Mine gaps — the mine type (2026-10-11)

Objects the mine rooms (`experiments/2026-10-11-types/min/DESIGN.md`: tunnel, junction, working face, collapsed tunnel, flooded gallery, shaft head, ore-sorting chamber, tool store, miners' mess, powder & lamp store, crystal seam, pithead yard, smelter house) want and the catalog lacked. Most of what a mine wants already had a line (mine-cart, ore-pile, ore-vein, smelter, mine-headframe, windlass, powder-keg, sorting-table, the `rural-*` mining set, and the dungeon's shoring-timber, collapse-rubble and cut-rock walls): those are generated under their own roles. Thin things are designed STOUT (rails are a flat strip on the floor, never a mesh; tools are racked against a backboard as one mass).

**Status (2026-10-11): specified in `experiments/2026-10-11-types/min/build_spec.py`; NOT yet generated (the image allowance ran out before the first plate). The rooms solve without them, plainer.** The timbered wall style is the kit family `mine-timbered` (the dungeon's `cut-rock` with a timber post and a cap beam): `wall-straight--mine-timbered` (two versions), `wall-doorway--mine-timbered`.

## H9. Mining (mine, 2026-10-11)

- **mine-tool-rack** — stout timber wall rack hung with two fat pickaxes, a shovel and a sledge against a plank backboard, one solid mass · wall · 1 · mount:0 · size:48x14x60 · mixed · set:MIN!,DUN,SMI · var:- · aff:use,loot · mesh · P1 · tool stores, working faces; reads as "picks" from above
- **mine-lamp-rack** — plank shelf rack with six fat miners' lamps on pegs and a candle box, unlit · wall · sub · mount:0 · size:40x12x56 · mixed · set:MIN!,DUN · var:- · aff:use,lit · mesh · P1 · the lamp store, the shaft head; the engine adds the flames
- **powder-keg-stack** — pyramid of small blasting-powder kegs marked with a red band, a fat fuse coil on top · floor · 1 · size:40x30x40 · wood · set:MIN!,CAS,DUN · var:- · aff:hazard,cover · mesh · P1 · the powder store; the fuse everyone watches
- **mine-shaft-collar** — square shaft mouth seen as an object: a kerb of fat squared timbers round a black opening, the top of a stout ladder over one side · floor · 1 · size:70x70x16 · wood · set:MIN!,DUN,RUI · var:- · aff:pass,hazard,climb · mesh · P1 · the shaft head: the way down; reads as a hole although it stands on the floor
- **ingot-stack** — criss-cross stack of rough cast metal pigs (iron-grey and copper-red) · floor · sub · size:30x22x16 · metal · set:MIN,SMI!,MKT · var:shape · aff:loot,carry · mesh · P2 · the smelter's output; trade cargo

## H10. Mine flats (mine, 2026-10-11)

- **mine-rail-strip** — cart track on the floor, one 5-ft tile of a row: two iron rails on fat timber sleepers in a bed of dark ballast · floor · 1 · size:60x60x0.1 · mixed · set:MIN! · var:shape · aff:- · flat · P1 · laid in a row down a tunnel; carts stand on it
- **mine-rail-cross** — cart turntable seen from above: an iron-rimmed round timber plate with rails crossing on it, track stubs to the four sides · floor · 1 · size:60x60x0.1 · mixed · set:MIN! · var:- · aff:use · flat · P1 · the middle of a junction
- **mine-rail-end** — the end of the track: rails stopping at a fat timber buffer baulk · floor · 1 · size:60x60x0.1 · mixed · set:MIN · var:- · aff:- · flat · P3 · at the working face
- **decal-ore-scatter** — scatter of dark ore lumps and glinting chips · floor · sub · size:36x30x0.1~0.5-2.5 · stone · set:MIN!,SMI,DUN · var:shape · aff:- · flat · P2 · round heaps, carts and sorting tables
- **decal-coal-dust** — smear of black coal dust and cart ruts · floor · sub · size:48x36x0.1~0.5-2.5 · stone · set:MIN,SMI · var:shape · aff:- · flat · P3 · tunnels, the smelter floor
