# Market & village: blind room reads at table distance

Method (the castle / crypt / mansion one, `integration/tests/room_shots_mkt.py`): each room laid out alone in a headless
tuner at its default size, three pictures (two high three-quarter views and a top view), labels off. Gemini
(gemini-2.5-pro) is shown the pictures as `view-1..3` and asked what kind of room this is, told nothing; a second,
text-only call compares its description with what the room was meant to read as (`rooms.json`). One read is a coin
(integration PLAN, correction 15): the table below is two seeds on the deployed tuner, the rounds before it are what
changed the rooms.

## The live record (2026-10-12, the deployed tuner, seeds 11 and 12): 17 yes, 7 partly, 0 no of 24

| room | match | named as (seed 11 · seed 12) |
|---|---|---|
| `mkt-square` | yes / yes | outdoor market square · An outdoor village market square |
| `mkt-street` | yes / yes | A small market street or town square section · outdoor town street or small market square |
| `mkt-general` | yes / partly | A general store or a potter's shop · An apothecary or alchemist's shop |
| `mkt-bakery` | yes / yes | fantasy bakery or baker's shop · bakery or a baker's shop |
| `mkt-apothecary` | yes / yes | An alchemist's shop or an apothecary · apothecary |
| `mkt-tailor` | yes / yes | A tailor's shop or a fabric merchant · tailor's shop |
| `mkt-curio` | yes / yes | wizard's study or a magic/alchemical supply shop · A wizard's study or a magical curiosity shop |
| `mkt-backroom` | partly / partly | A provisioner's shop or a general store · fantasy general store or alchemist's shop |
| `mkt-passage` | partly / yes | A study, private hall, or a lord's office · manor hallway or a tavern common room |
| `mkt-watch` | partly / yes | A dungeon interrogation or torture chamber · A prison guardroom or jailer's office |
| `mkt-house` | partly / partly | An artisan's workshop and living quarters · A craftsman's workshop and living quarters |
| `mkt-bedroom` | yes / yes | A simple bedroom or an inn room · simple bedroom or an inn room |

**Shops are told apart by their stock.** Across the two seeds the five shops were named a general store / potter's shop,
a bakery (2 of 2), an apothecary (2 of 2), a tailor's shop (2 of 2) and a magic or curiosity shop (2 of 2); the one
crossing is the general store read once as "an apothecary or alchemist's shop" (jars and sacks on shelves). In the
node test no shop ever holds another trade's skeleton meshes (5,800 placements), and each has pieces no other shop has
(`test/mkt.test.mjs` prints the list).

**Not named as themselves:** the back room (a shop or general store, 2 of 2: its stocked shelves and floor stock ARE
shop stock; "a shop's storeroom" 1 read in 5 over all rounds), the living room ("an artisan's workshop and living
quarters", 4 reads of 5: a bench against the wall and the dresser read as work furniture), the passage (it is the
inn's hallway: "a study", "a manor hallway"), the watch post on one seed ("an interrogation chamber": the lockup and
the manacles are seen, the desk is not).

## What the earlier rounds changed (local, real meshes, 2026-10-12)

| round | reads | what was seen | what changed |
|---|---|---|---|
| 1 (24 reads) | 12 yes, 8 partly, 4 no | the street read as "an alchemist's shop" and "a forge" (it was shot beside a bakery, and the judge described the bakery); the watch post "a wizard's study": its 5-ft lockup was "a tall cabinet with a barred front"; the living room "a workshop": the settle was "a bed", the spinning wheel "a workbench with a mechanical device with gears"; the tailor "a scholars' dormitory" | the street is read alone; the lockup is two panels wide from 19 ft of wall, with a pallet; no settle and no spinning wheel in the living room; the back room is mostly plain shelving |
| 2 (15 reads) | 6 yes, 5 partly, 4 no | watch post 3 of 3 ("a guardroom with a holding cell"); the tailor 0 of 3: asked what each thing was, the judge called the rolled bolts "books and scrolls", the chest-high shelf units with folded cloth on top "bunks with red cushions", the cloth-covered display table "a bed with a purple mattress and a red pillow", the dress form "a chair with a red cushion"; and the forms stood in the shop window, behind the wall nearest the camera | tall shelf units only in the tailor's (`shelf`), no cloth-covered table (`noTable`), dress forms in a row before the counter (`show`) |
| 3 (6 reads, tailor only) | 0 of 6 | still "a scholar's study" at the local frame (the room about 280 px across) | no further change; see below |

**The tailor and the size of the picture.** On the local rounds the tuner's stage was 880 x 520 px and the tailor was
never named (0 of 9). On the live record the stage was 880 x 898 px (the palette is hidden for the shot: with 88 room
types it had grown to fill the page and left the stage 62 px high) and the tailor was named 2 of 2. The same build, a
larger picture: at the small frame cloth reads as books and bedding. Treat the tailor as the weakest shop.

**Measured, not read:** "clipping into the wall" was reported in most reads (a settee, a bookshelf, a chair). Every
standing thing is checked against the room's rectangle and against every other in `test/mkt.test.mjs` (0 failures in
296,936 checks); wide-view clipping calls were wrong every time they were measured in the earlier types.

Pictures and the judge's full descriptions: `shots-live/` (`read.json`), rounds in `shots-r1/`, `shots-r2/`, `shots-r3/`
(git-ignored pictures; the JSON is tracked). The tuner palette on the live site with the twelve rooms:
`shots-live-palette/tuner-palette-live.png`. The game: `live-game/result.json` (the Build tray lists the twelve rooms
with icons; a bakery built in a throwaway campaign: 17 things, no errors).
