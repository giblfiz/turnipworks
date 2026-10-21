# Farmstead: blind room reads at table distance

Judge: gemini-2.5-pro, blind (three pictures as view-1/2/3: two high three-quarter views and a top view; no room or type
name anywhere), the question "what kind of room is this, in a few words". Pictures: `integration/tests/room_shots.py`
(the room alone in the tuner, labels and fx off), page 1500 x 1500 as the dungeon's and the temple's shots. Each room at
its default size, seeds 11 and 12, read twice = 4 reads a room (`integration/tests/room_reads.py`). One read is a coin.
Rounds: `shots-r1` (all sixteen, with the hut-01 meshes), `shots-r2` (six rooms reworked), `shots-r3` (the kitchen again).
The first two rounds on 2026-10-11 (library meshes only) are summarised under "What the reads changed".

## The record (local tuner, 2026-10-12; the live record is at the end)

| room | named | what the four reads said |
|---|---|---|
| Cottage (one room) | **4 of 4** (r2) | "a simple one-room home or dwelling"; "a simple one-room dwelling or hut"; "a rustic single-person dwelling (or a barracks room)"; "a one-room dwelling, like a rustic cabin" |
| Farmhouse kitchen | **2 of 4**, all four a hearth-and-table common room (r3) | "a tavern common room or a farmhouse kitchen / dining area" x2; "a tavern common room or a craftsman's home"; "a tavern common room". Its rival is the inn's common room |
| Farmhouse bedroom | **4 of 4** (r1) | "a simple bedroom", "a rustic bedroom or inn room" |
| Sleeping loft | 4 of 4 as shared sleeping quarters, **0 of 4 as a loft** (r1) | "a simple barracks or shared sleeping quarters" x4. Nothing in a roofless cutaway says "under the roof" |
| Cross-passage | **4 of 4 a hallway or corridor** (r2) | "a notice board hallway"; "a public bulletin corridor"; "a themed hallway"; "a tavern hallway". The "notices" are the patches where the wattle shows |
| Root cellar | **4 of 4** a pantry, storeroom or larder (r1) | "a storeroom, pantry, or larder" (the roots are named every time; "cellar" itself is not: no roof, no stair) |
| Byre | **2 of 4** (r1) | seed 12: "a small stable or barn", "a stable or a room with animal stalls"; seed 11: "a crude barracks or bunkhouse" x2 (the straw in the stalls as beds). No cow is in it |
| Chicken coop | **3 of 4** (r1) | "a henhouse or chicken coop"; "a chicken coop or hen house"; "a small stable, animal pen, or coop"; one "a bakery storeroom" (the eggs as loaves) |
| Pigsty | **4 of 4** an animal pen or sty (r1) | "an animal pen or pigsty"; "an animal pen or a creature's sty"; "a small livestock pen" |
| Hay barn | **4 of 4** (r1) | "a barn, stable, or carriage house" (the inn's barn: the wagon decides it) |
| Granary & threshing floor | **0 of 4** as a granary; a farm work shed (r2) | "a farmer's workshop or a barn tool shed" x2; "a stable storeroom"; "a rustic guardhouse or stable". With the grain heap (r1) it was "a brewer's or alchemist's workshop" 4 of 4: the heap was withdrawn |
| Dairy | **0 of 4** (r2) | "a pantry, storeroom, or potter's workshop"; "a kitchen storeroom or a pantry". The cheeses on their shelves are bowls from above |
| Vegetable garden | **4 of 4** (r1) | "a fenced vegetable garden" |
| Field edge | 4 of 4 a farm or garden plot, **0 of 4 "a field"** (r1) | "a fenced vegetable garden or allotment"; "a small farm or garden plot". The crop is the garden's cabbage patch: a grain crop does not exist yet |
| Orchard corner | **4 of 4** (r1) | "a walled apple orchard", "a fenced orchard" |
| Farmyard | **4 of 4** (r2) | "a farmyard pen or a small village courtyard"; "a fenced farmyard"; "a village work yard" x2 |

Named without help on 3 reads of 4 or better: cottage, bedroom, passage, cellar (as a food store), coop, pigsty, barn,
garden, orchard, farmyard (10 of 16). On the line: kitchen, byre. Read as a near relative: loft (a dormitory), field (a
garden plot). NOT named: granary, dairy.

## What the reads changed
- **Picture size.** The first round (one seed, 950-px page) put a 20-ft room at 220 px: the coop was "a bedroom", the
  byre "a barracks", everything else "a workshop". The reads above are at the landed types' size.
- **The straw-bedding flat is a bed.** `rural-straw-bedding` is drawn as a made-up pallet with a blanket: in the coop and
  the sty it made "a bedroom" and "living quarters". Hay scatter only.
- **The puddle flat is a magic spring.** A turquoise pond with a rocky rim in the sty: "a small sanctuary", "a druid's
  courtyard". The wallow is dark dirt patches.
- **Two beds are a lodging house.** The cottage with a second pallet was "a barracks or shared tavern lodging": one bed
  under 20 cells.
- **A fork by the door is a weapon rack**; a bench in a passage is a workbench; a lantern hung over a table lies on it
  (in the dairy: "an anvil"); jars on a cupboard are "glowing potions".
- **The spit hearth is a still.** `cook-hearth-spit` (dark ironwork, a green pot) made the kitchen "an alchemist's
  workshop" 3 reads of 4: the plain stone fireplace is the farm kitchen's hearth.
- **Windows with bars are a jail.** `wall-window-small--wattle-daub` was painted with three stout wooden bars: the
  passage read "a jail corridor", the cottage "a guard's quarters". Withdrawn; a wattle-daub wall shows plain daub where
  a window was rolled, and the passage has no windows at all.
- **An orange cone with a knob is a still.** `rural-grain-heap-threshed` meshed as a smooth orange cone, the shovel's
  handle as its knob: the granary was a brewery 4 of 4. Withdrawn.
- **A yard with no fence is a workshop yard**: the farmyard is always fenced now; the stone horse trough read as "a large
  stone forge" (the wooden trough only).
- **Rows make the plot.** Beds in rows = a vegetable garden; trees on a grid = an orchard (both 4 of 4 from the first
  round on).

## The live record (https://implausible.enterprises/projects/turnip-works/tuner, after the landing, 2026-10-12)
`shots-live/`, seed 11, default sizes, each read twice (`reads-live.txt`); every picture loaded with 0 errors.

| room | 2 reads |
|---|---|
| Cottage | "a rustic, single-room dwelling or barracks room"; "a simple, rustic living quarters or barracks room" |
| Farmhouse kitchen | "a tavern common room or a large farmhouse kitchen / dining area"; "a tavern's common room or a rustic kitchen / dining room" |
| Bedroom | "a simple inn room or rustic bedroom"; "a humble bedroom or an inn room" |
| Sleeping loft | "a shared barracks room or guard's quarters"; "a barracks room or shared workers' quarters" |
| Cross-passage | "a decorated dungeon hallway"; "a castle or barracks corridor" (a corridor both times; never a farm's) |
| Root cellar | "a pantry, cellar, or storeroom"; "a greengrocer's storeroom" |
| Byre | "an animal stable or barn"; "a stable or a small barn" |
| Chicken coop | "a chicken coop or hen house" x2 |
| Pigsty | "an animal pen or pigsty"; "an animal pen, most likely a pigsty" |
| Hay barn | "a barn, stable, or carriage house" x2 |
| Granary | "a barn's workshop and storage area"; "a multi-purpose barn, workshop, or storeroom" (NOT a granary) |
| Dairy | **"a cheesemaking room or a cheese cellar"; "a cheesemaker's workshop or a cheese aging room"** (the pails of white milk and the cheeses on the floor, added after r2, did it: 0 of 4 before, 2 of 2 here; two reads are not yet a record) |
| Vegetable garden | "a fenced vegetable garden" x2 |
| Field edge | "a fenced vegetable garden or farm plot" x2 (NOT a field) |
| Orchard | "a walled apple orchard" x2 |
| Farmyard | "a farmyard or village commons"; "a farmstead work yard" |

The game: `integration/tests/live_game_check.py` on https://turnipworks.net/ (a throwaway campaign, deleted on exit):
Build → Fantasy → Farmstead lists 16 rooms, none disabled, no icon missing; a cottage spawned with 26 things (hearth,
straw pallet, butter churn among them) and a farmyard with 46, no page errors (`live-game/*/result.json`).
