# Dungeon & prison: blind room reads at table distance

Judge: gemini-2.5-pro, three pictures per room (two high three-quarter views, one top view) sent as view-1/2/3, no room
or type name anywhere ("what kind of room is this?"). Tools: `integration/tests/room_shots.py`, `room_reads.py`. One read
is a coin, so every room is read twice on each of two seeds. Pictures and full answers: `shots-live/` (the record, from the
deployed tuner, 2026-10-12 17:2x), `shots-r1` to `shots-r3` (the three rounds before the deploy, local).

## The live record (default size, seeds 11 and 12, two reads each = 4 reads)

| room | named | what it was called |
|---|---|---|
| Cell block | 4 of 4 | prison block, jail, holding cells |
| Guard room | 4 of 4 | barracks or guardroom |
| Treasure vault | 4 of 4 | treasure room, vault, treasury |
| Monster den | 4 of 4 | monster's lair, creature nest, hatchery |
| Puzzle hall | 4 of 4 | puzzle room or ritual / ceremonial chamber |
| Shrine | 4 of 4 | small shrine, chapel, tomb antechamber |
| Flooded chamber | 4 of 4 | flooded chamber, cistern, water-puzzle room |
| Sewer | 3 of 4 | sewer passage, dungeon channel, aqueduct; once "corridor or barracks room" |
| Corridor | 2 of 4 | seed 12 "dungeon corridor" twice; seed 11 "holding pen", "tomb" |
| Interrogation room | 2 of 4 | seed 11 "torture chamber / torturer's workshop"; seed 12 "blacksmith's forge" twice |
| Chasm crossing | 1 of 4 | "guardroom or chasm crossing" once; else "guardroom", "monster pen" |
| Trap corridor | 0 of 4 | "dungeon workshop or torture chamber", "guardroom storeroom" |
| Dead end | 0 of 4 | "workshop", "guard post", "prison smithy" |
| Collapsed hall | 0 of 4 | "dungeon chamber", "crypt", "treasure room", "dark throne room" |

Seven rooms are named on every read, the sewer on three of four. Six are not reliably named: four of them are the
passages and the stub (a corridor is a shape, and the table camera sits 95 ft from an 8-cell room: what stands in it
is a few pixels), the interrogation room on one seed, the collapsed hall.

## What the judge called things (asked "list every kind of thing you see"), and what was done

- **Water painted dark green read as moss; olive read as a dirt path.** Flooded chamber "grassy floor", sewer "forge".
  Both flats were hue-graded (`flats/grade_water.py`): flooded 0 of 4 -> 4 of 4, sewer 0 of 4 -> 3 of 4.
- **A statue on the axis makes any room a shrine** (flooded chamber, chasm): removed; the flooded chamber has an outfall there.
- **The hoard in a 20-ft vault read as a round sand table, strongboxes as furnaces, the loaded shelf as a bookcase,
  gold-bar stacks as cots**: the vault is now chests, gold and coin only, the hoard from 30 cells: 0 of 4 -> 4 of 4.
- **Iron gates on a corridor read as cell doors**: oak everywhere.
- **A pressure plate is a chopping block, a dart wall a rack of pigeon-holes, the spike plate a baking tray, the trip
  crossbow a sawhorse**: the big traps go first, on the centre line, with blood beside them. Still not named.
- **`collapse-rubble` reads as a mound of skulls, pale `rubble-pile--s2` as bone fragments, fallen column drums as cogs,
  a timber prop over a body as a rack with a victim**: the prop and the body were taken out. Still not named: an asset need
  (`docs/ASSETS_TO_BUILD.md`).
- **The cut-rock walls came out ochre and read as timber**: colour maps pulled toward grey (`tools/grade_cut_rock.py`).
- **Measured, not believed**: no "floating" or "clipping" call was acted on.

## A thing found on the way

The tuner page gives the stage what the palette leaves: with 65 room types listed the stage is 253 px high in a 950-px
window, and the hint line covers the room. `room_shots.py` now uses a 1500-px-high page and hides the hint. The first
live record, taken before that, read almost every room wrongly and was thrown away.
