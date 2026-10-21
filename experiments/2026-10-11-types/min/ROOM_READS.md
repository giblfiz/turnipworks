# Mine: blind room reads at table distance

Judge: gemini-2.5-pro, three pictures per room (two high three-quarter views, one top view) sent as view-1/2/3, no room
or type name anywhere ("what kind of room is this?"). Tools: `integration/tests/room_shots.py`, `room_reads.py`. One read
is a coin, so every room is read at least twice on each of two seeds (default size). Pictures and full answers:
`shots-r1` to `shots-r4` (before the deploy, from the real-mesh sandbox), `shots-live/` (the record, from the deployed tuner).

## Before the deploy (2026-10-12): what each round showed and what was done

**Round 1** (first real meshes). Named a mine: pithead yard 4 of 4, sorting chamber 4 of 4, smelter 4 of 4 ("blacksmith's
forge or smeltery"), flooded gallery 4 of 4 ("flooded", 2 of them "flooded mine"). Not named: tunnel ("stables", "a railway
carriage"), junction ("workshop", "guard's storeroom"), shaft head ("crafting workshop", "tanner's workshop"), collapsed
tunnel ("mine cart depot": a mine, but no collapse), tool store ("blacksmith's workshop"). Asked what it calls each thing:

- **Timber sets standing over the cart road, in a row = stable stalls** ("wooden partitions creating individual
  enclosures, 12"), the rail tiles between them feeding troughs. The frames are gone from every room; the timbering is in
  the `mine-timbered` wall panels.
- **A timber set just inside a door = a pillory or stocks; a prop set at the face = a hoist.** Gone.
- **The ore-scatter decal = piles of hay, or gold coins; a puddle = "a square glowing turquoise rune".** Neither is laid
  any more; the other decals are cut to one to three a room ("animal pelts and rugs, 7").
- **The turntable alone = a round drain grate.** With a row of track through the middle each way and a loaded cart on an
  arm it is "a mine cart turntable room".
- **The shaft collar alone = "a large dark machine with a central pit: a forge"; the winch = a spinning wheel; the bell
  post = a screw press.** With a siding and a loaded cart beside it, ore tipped at the lip and the bell gone it is "a mine
  shaft access room".
- **An axe in its chopping block = an anvil; the helmet peg rack = a weapon rack with a red shield.** Both out of every
  mine room (the anvil made the tool store a smithy).
- **The dungeon's rock fall was not seen as a fall** (pale rubble = "salt"). The fall is now the mine's own grey waste
  heap, grown to close the tunnel, with roof timbers down at its foot and a cart on its side across the rails.
- **What always worked: rails with a loaded cart on them.** Every room that has them was called a mine.

**Round 2** (after that rework), 4 reads a room: tunnel 4 of 4 ("mine cart tunnel", "depot", twice "mine cart stable":
the wall posts still suggest stalls), junction 4 of 4 ("mine cart turntable room or mine junction"), shaft head 4 of 4
("mine shaft access room", "mine shaft lift room"), sorting 4 of 4, pithead 4 of 4, smelter 4 of 4, flooded 4 of 4,
crystal seam 4 of 4 ("crystal storage room", "geode vault", "crystal cultivation room": the vein slabs along the wall are
"planters"), mess 4 of 4 as "barracks or simple living quarters" (bunks, a communal table, a cooking place: the reading
intended, without the word mess), powder store 4 of 4 as "a storeroom or cellar" (kegs read as barrels, the stacked
kegs as "rolled goods", the lamp rack as "bottles on a rack": a store, never powder). Not yet: collapsed 0 of 4 as a
collapse, working face 2 of 4, tool store 2 of 4.

**Round 3** (collapsed tunnel rebuilt from the fall outward and widened to 6x3; the face given the gold vein only, a loaded
cart and small heaps; 3 reads x 2 seeds): collapsed tunnel **6 of 6** ("a collapsed mine tunnel", "a blocked mine
tunnel"); working face 4 of 6 as "a mine storage or ore sorting room" (the others "a dwarven workshop and barracks": the
vein slabs seen as stone bunks); tool store 0 of 6 ("armoury", "armourer's workshop").
**Round 4** (tool store: one pick rack, shovels leaning, barrow and pit props first): 0 of 6 by name, "a workshop or
armoury" every time. The pick rack reads as a rack of tongs, hammers or polearms. Left: an asset need, not a layout one.

## The live record (deployed tuner, 2026-10-12 19:5x; default size, seeds 11 and 12, two reads each = 4 reads)

| room | named | what it was called |
|---|---|---|
| Tunnel junction | 4 of 4 | minecart turntable junction, mine railway junction or depot |
| Shaft head | 4 of 4 | mine shaft entrance room, ore-hoisting room |
| Collapsed tunnel | 4 of 4 | a collapsed, abandoned or blocked mine tunnel |
| Ore-sorting chamber | 4 of 4 | a mine's workroom or ore-sorting area, mine-side workshop |
| Crystal seam | 4 of 4 | crystal storeroom, crystal garden, geode storeroom ("cultivation": the vein slabs along the wall are taken for planters) |
| Smelter house | 4 of 4 | a blacksmith's forge or smithy (a furnace house; never "smelter" alone) |
| Flooded gallery | 4 of 4 flooded, 2 of 4 a mine | flooded mine chamber or pump room; flooded cellar or storeroom |
| Miners' mess | 4 of 4 as quarters | barracks or shared workers' quarters, "a combined barracks and workshop" (beds, a table, a cooking place; the word mess never) |
| Powder & lamp store | 4 of 4 as a store | a cellar or storeroom; once "a wine cellar" (never powder) |
| Mine tunnel | 4 of 4 mine and rails; 1 of 4 as a tunnel | "a minecart loading bay or tunnel section"; three times the ROOM ITSELF was taken for a wagon ("a mine transport car", "a prison railcar"): a long narrow box with planked walls and rails in it |
| Pithead yard | 2 of 4 | seed 11 "a mine head or quarry worksite" twice; seed 12 "a siege weapon workshop" twice (the headframe as a siege engine) |
| Working face | 2 of 4 | seed 12 "a mine's storeroom or small quarry workshop"; seed 11 "a simple barracks or guardroom" (the vein slabs side by side as cots) |
| Tool store | 0 of 4 | "a blacksmith's or armourer's workshop" (the pick rack as tongs and hammers, the grindstone as a forge's) |

Seven rooms are named on every read; the mess and the powder store are read as what they are without their name
(quarters; a store). Four are not reliable: the tunnel (a passage is a shape; here the shape plus rails says "wagon"), the
pithead on one seed, the working face on one seed, the tool store. What they need is in `docs/ASSETS_TO_BUILD.md` → Mine
(a pick-and-shovel piece that reads from above; powder that reads as powder) and, for the face, fewer slabs or a rougher
one (three identical slabs in a row = beds: PLAN.md 19).

**The game** (2026-10-12, `integration/tests/live_game_check.py MIN min-shaft-head 5 5`, a throwaway campaign, deleted):
Build → Fantasy → Mine lists the 13 rooms, every icon present, a shaft head builds with 19 objects and no page error;
described blind as a room with a central pit and winch, a cart on tracks, ore, barrels, "nothing broken, no placeholder,
no untextured surface". Pictures: `live-game/`.
