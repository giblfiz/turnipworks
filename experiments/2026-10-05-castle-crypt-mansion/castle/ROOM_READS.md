# Castle rooms: blind reads at table distance (2026-10-06)

Judge: Gemini (gemini-2.5-pro), told nothing: three pictures of one room (two high three-quarter views and a top view,
sent as view-1/2/3) and "what kind of room is this?" (`../integration/tests/room_shots.py` takes the pictures,
`../integration/tests/room_reads.py` asks, several at a time; the prompt is the crypt's, word for word). Default size,
seeds 11 to 14. A room passes when it is named specifically on 3 of the 4 seeds. Quoted: the judge's answer to
"what kind of room is this", shortened only at the end. Every full description of the rounds: `reads-rounds/round-N.json` (and `-things.json`: the judge asked what it takes
each thing for); of the deployed tuner: `shots-live/` (pictures are git-ignored).

One read is a coin (PLAN.md 15): where a room was close to the line it was read twice and both reads are given.

## Result before the first deploy (a local tuner serving that code; the record is LIVE, at the end)

| room | default | reads | verdict |
|---|---|---|---|
| Great hall | 10x6 | "castle great hall or feasting hall" · "castle's great hall or a tavern common room" · "tavern common room or a castle feasting hall" · "castle great hall or a barracks mess hall" (second reads: "tavern common room or a castle's feasting/mess hall" · "tavern common room or an inn's dining hall" · "tavern or inn common room" · "castle great hall or a tavern common room") | named in 6 of 8 reads, on 4 of 4 seeds; its rival is the tavern common room (first choice in 3 of 8) |
| Throne room | 5x8 | "throne room or royal audience hall" · "throne room or audience chamber" · "throne room or audience hall" · "throne room or audience hall" | 4 of 4 |
| Armoury | 4x4 | "armorer's workshop or showroom" · "armory or a barracks workshop" · "barracks armory or a guardroom" · "armory, barracks, or guardroom" | 3 of 4 (4 of 4 in round 1) |
| Barracks | 7x5 | "barracks or communal dormitory" x 4 | 4 of 4 |
| Castle kitchen | 6x5 | "castle or tavern kitchen and dining area" · "large medieval-style kitchen or workshop" · "large kitchen or scullery" · "combination blacksmith's forge and alchemist's workshop" | 3 of 4 |
| Castle chapel | 4x7 | "small chapel or temple" · "small chapel or prayer hall" · "chapel or small temple" · "small chapel, temple, or prayer hall" | 4 of 4 |
| Dungeon | 6x5 | "dungeon jail or a guardroom with holding cells" · "dungeon guardroom with a holding cell or a small prison/torture chamber" · "dungeon jail or prison cells" · "dungeon holding cell or a guardroom with a prison cell" | 4 of 4 |
| Gatehouse | 3x5 | "fortress gatehouse or a castle guardroom" · "castle or keep utility room" · "castle or dungeon guardroom" · "castle gatehouse or guardroom" (second reads: "castle gatehouse or a dungeon guardroom" · "small barracks, stable, or guardroom" · "dungeon entrance hall, guardroom, or gatehouse" · "gatehouse, guardroom, or fortified entryway") | **2 of 4** (5 of 8 reads). DOES NOT PASS: alone it is a castle guardroom |
| Courtyard | 8x7, with a great hall on its north side | "barracks with a training yard" · "barracks courtyard and common room" · "barracks or guardhouse with a training yard" · "guardhouse and training yard" | 4 of 4 as a training yard or courtyard (the "barracks" and "common room" are the hall beside it, which is in the picture) |

In the GAME (https://turnipworks.net/, a new campaign `zz-castle-check-fauna`, room labels hidden, a 5x8 throne room,
26 things, no page or HTTP errors): "A throne room or royal audience chamber." The Build tray lists Castle with its nine
rooms, each with an icon. The campaign was removed afterwards.

## The rounds, and what each changed (the program, never the test, never a mesh)

| round | read | what it was | change |
|---|---|---|---|
| 1 (the drafts on real meshes) | great hall: "tavern common room or a castle's mess hall" 4 of 4 | the 6-ft ring chandeliers were "large circular metal grates with a star pattern in the floor" / "wagon wheels on the floor"; the door stood in a long wall, so the hearth went to the end wall ("tucked into a corner") and there was one trestle row; no bench found room (the real trestles are 3.5 to 4 ft deep, catalog 2.5) | the outside door is on a short wall facing the dais (`DOOR_ENDS`, also throne room and chapel); no ring chandelier, standing lights at the dais step; the arms and banners behind the high seat |
| 1 | castle kitchen: "workshop and storeroom ... bakery, brewery, or alchemist's lab" · "artisan's workshop or a large production kitchen" · "workshop storeroom or a kitchen pantry" | the inn's kitchen program in a 750-sq-ft room: four larder corners and larder runs on every wall ("a huge collection of goods: barrels, sacks, pottery"), the bread oven "a large bellows" or "a kiln", the great hearth "a forge" | the castle's own works (cauldron on its crane before the hearth, the 10-ft work table across the middle with the roast on it, the pig on its spit at its end, hams on the hook rail, cupboards) and its own fill; ONE larder corner, no bake corner |
| 1 | gatehouse: "dungeon guardroom or small armory", "castle guardroom or gatehouse chamber" (1 of 4) | one gate; a table, a stool and dice in the side band | a gate at each end, straight across (`THROUGH` + `WAY_ON`) |
| 1 | dungeon 4 of 4 with the crypt's iron gate as the cell door ("barred gate"); armoury, barracks, throne room, chapel, courtyard pass | | kept |
| 2 | great hall: "tavern common room or a castle mess hall" 3 of 4, "tavern or inn common room" | the dais with the high table and chairs behind it, at the end wall: "an L-shaped counter that functions as a bar, with shelves behind it"; trestles with tankards: "common tables for patrons" | lower tables = the 10-ft feast tables, benches both sides (measured from the meshes), a feast on them and no tankards, the royal runner down the aisle, white linen on the high table |
| 2 | kitchen 3 of 4; gatehouse 1 of 4 ("castle guardroom or armory"; the windlass is "a forge" or "bellows") | | gatehouse: default 3x5 entered at an end, no guard table under 30 cells, fewer arms |
| 3 | great hall: 5 of 8 reads; one seed "guild hall common room or barracks recreation room" twice | `table-feast--s2` has a GREEN top: "five identical green-topped tables, likely for billiards" | lower tables = the dark 14-ft `table-feast` (trestles in a hall under 26 ft across) |
| 3 | gatehouse: 4 of 8 ("dungeon cell or a secure storeroom": two barred gates and little else is a cell) | | the far gate is the timber double gate; a worn way on the floor from gate to gate |
| 4 (shipped) | see the table above | | |

## What the programs cannot fix (asset notes, also in docs/ASSETS_TO_BUILD.md)

- **Gatehouse.** Nothing in the library says "the way through": no murder hole, no cart ruts, no drawbridge, and a
  portcullis reads as "a barred gate" (a cell) as readily as a castle gate. The worn-path decal was taken for hay once.
  In a castle it stands against the courtyard and the curtain wall and is read from them; alone it is a guardroom.
- `chandelier-ring--great` (and every ring chandelier) from the table camera: a wheel or a grate on the floor.
- `table-feast--s2`: green top, reads as a billiard or gaming table. `bread-oven` (an inn mesh): "a large blue bellows", "a kiln".
- `windlass`: "a wooden contraption with a crank", once "a forge" with "an anvil". `cook-hearth-spit--great`: "a forge or a large fireplace".
- `dais` at its catalog height (16 in) is not noticed from above; the high table on it with chairs behind is a bar counter
  unless something else says dining (the linen does).
- The real meshes are stouter than their catalog lines: `fireplace-grand` 7.4 x 4.8 x 8.7 ft (capped at 104 in), trestle
  tables 3.5 to 4 ft deep, `weapon-rack` 5 ft wide, `cell-bench-plank` 3.3 ft deep, `pillar-round` 3.1 ft across,
  `cage-floor` and `pillory` 5.5 to 6 ft tall.

## "Looks wrong" lines, and what measurement said

| said | measured | action |
|---|---|---|
| "barrels or stools by the main door clip into the wall", "the leftmost chair may clip the wall" | `tuner.overlapReport(0.35)` and `tuner.outsideReport(0.6)` are written beside every picture (`<tag>.json`); the node test holds every room to "nothing outside, nothing overlapping" (346,530 checks, 0 failures) | none |
| kitchen: "pottery rims pass through one another" (round 1) | the inn's like-with-like piles, 31 things in four corners; gone with the castle's own fill | the program changed for the read, not for this |

## One more pass after the first live reads (round 5)

On the first live run (below) the great hall was named on 2 seeds of 4 and the gatehouse on 3. One change each:
the hall's long walls carry banners and tapestries only, one per 6 ft (shield displays and trophy heads had been "weapon
racks" and "framed pictures": a tavern's walls); a gatehouse under 24 cells keeps no arms at all, only the windlass, its
lever, a fire and the worn way. Local, two reads a seed (`reads-rounds/round-5.json`): great hall named in 7 reads of 8
(first choice in 5); gatehouse in 4 of 8 ("guardroom, gatehouse, or barracks antechamber" · "castle or dungeon
gatehouse/guardroom" · "castle guardroom or barracks" x 2 · "dungeon entrance hall or a fortified corridor" ·
"fortified gatehouse passage or a castle entryway" · "dungeon guardroom or antechamber" · "dungeon guardroom or fortified
passage"): no better, kept (the room is emptier and the passage clearer). The judge describes a gatehouse every time
("a secure, transitional space like an entrance to a castle") and names it a guardroom half the time.

## LIVE (the record)

The deployed tuner (https://implausible.enterprises/projects/turnip-works/tuner/), one read a seed. 0 page errors, 0 HTTP
errors, 0 overlaps, nothing outside a room and no purpose fail in every room shot. `assets_check.py --live`: 0 missing on
both hosts after each deploy (17,319, then 17,329 files).

First run, v=20261006005828, all nine rooms (`shots-live/`):

| room | reads | verdict |
|---|---|---|
| Great hall | "castle great hall or feasting room" · "tavern common room or a castle's great hall" · "tavern common room or an inn's dining hall" · "tavern common room or a castle mess hall" | 2 of 4: see the second run |
| Throne room | "throne room or an audience chamber" · "throne room or royal audience hall" · "throne room or an audience hall" · "small throne room or an audience chamber" | 4 of 4 |
| Armoury | "armory or a barracks showroom" · "armorer's workshop and showroom" · "armory or barracks storeroom" · "armory or a barracks storeroom" | 4 of 4 |
| Barracks | "barracks or a communal dormitory" · "barracks, dormitory, or bunkhouse" x 3 | 4 of 4 |
| Castle kitchen | "rustic kitchen or a castle scullery" · "large kitchen or a combined kitchen and workshop" · "well-equipped kitchen or a workshop for an alchemist/cook" · "fantasy crafting workshop ... blacksmith's forge and an alchemist's laboratory" | 3 of 4 |
| Castle chapel | "small chapel or temple room" · "small chapel or temple" · "chapel, small temple, or sanctuary" · "small chapel, temple, or audience hall" | 4 of 4 |
| Dungeon | "dungeon holding cells or a small jail" · "dungeon cell and work/torture area" · "dungeon cells or a prison block" · "dungeon prison cell or guardroom" | 4 of 4 |
| Gatehouse | "castle or fortress gatehouse/entryway" · "small stable or barracks guardroom" · "guardroom or a gatehouse antechamber" · "gatehouse guardroom or a dungeon antechamber" | 3 of 4 |
| Courtyard (a great hall beside it) | "guardhouse with a training yard" x 2 · "guardhouse common room and training yard" · "barracks training yard and common room" | 4 of 4 as a training yard |

Second run, v=20261006020315, the two rooms round 5 changed (`shots-live-2/`):

| room | reads | verdict |
|---|---|---|
| Great hall | "castle's great hall or dining hall" · "castle's great hall or a feasting hall" · "castle's great hall or dining hall" · "castle's great hall or feasting room" | **4 of 4**, first choice every time |
| Gatehouse | "fortified corridor or gatehouse" · "dungeon guardroom or makeshift barracks" · "castle gatehouse or a fortified passage" · "fortified gatehouse or guardroom" | 3 of 4 on this run; over every run since its second gate, about half the reads. Recorded as NOT reliably named |
