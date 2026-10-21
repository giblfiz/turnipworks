# Room spec: what a room should look like on the inside

This file is the layout program's rulebook, written with Harry on 2026-10-01. Mark it up freely: the v2 engine (`js/solver2.js`) is being brought into line with it, room by room.

**Status key:** ✅ built · 🟡 partly built · ⬜ spec only.

## Genre (read this first)

Turnip Works is **D&D fantasy, not history** (Harry, 2026-10-01): inns are hotel-plus-bar, strangers walk in, ordinary people deal in gold, nobody is bigoted (not even against tieflings), you can get coffee — and nobody watches anybody poo. When historical accuracy and player expectation disagree, **player expectation wins**. Use history for texture, never to override what a table expects to find.

Other **flavors** — a strict *historic* one, Wild West, sci‑fi — are possible later but as far off as each other (Harry, 2026-10-01). Keep rules written against **roles** (a bed, a cooking line, a seat bank), not specific objects, so a flavor can be a different asset pack plus a short list of rule overrides on the same engine.

## Principles (every room)

**Law (always holds):**

1. **Role.** Each room is a *hub*, a *passageway*, a *terminal*, a *uses* room, or *mixed* (or *outdoor*: a yard, with no walls and its own rules; see Outdoors at the end). Role decides the doors, the walking lines and the furniture logic. "Who counts" picks whose movement defines the role (guests, staff, horses). 🟡
   - Several doors ≠ passageway. The kitchen *uses* the pantry; it isn't a corridor to it.
2. **Walking lines (chi flow).** Draw the paths first: door → key feature in a terminal; door → door in a passageway; a loop in a hub. Reserve them about 3 ft wide. No door straight across a room unless it's a passageway on purpose. Long straight runs get gentle slowing. 🟡
3. **Key purpose.** Every type has a must-have, placed first, with pride of place relative to the walking lines. If it can't fit, the room fails loudly (red outline, first line of the summary). 🟡
   - **Growth mode per key feature:** *promote* (moves to the centre as the room grows: the bed), *repeat* (more of it along walls: cooking lines, stalls, shelving, privy seats), or *extend* (gets longer: the bar). ✅ Reported on a `Growth:` summary line.
4. **Command position.** Primary spots (bed, keeper's chair, barkeep, hearth seat) have:
   - a wall or solid back (tortoise) and open space in front (phoenix);
   - support either side (dragon and tiger);
   - the door in view, diagonally, never in its blast line;
   - and never the coffin position (except a *focal* feature, Principle 8, which faces the door on purpose). 🟡
5. **One camera angle.** The room should read right from the doorway: the key feature in view (except where privacy overrides); tall blocky storage on the door wall, not facing you. 🟡
6. **Zones.** Big rooms are clusters of small ones: a rug, inward-facing seating around a focus, its own light. Rugs are where you stay; bare floor is where you walk; paths run between zones, never through them. 🟡
7. **Density, not counts.** Each room has a target: props per 100 sq ft, or floor coverage for storage rooms. Zones repeat as rooms grow, so big rooms never read bare. 🟡 Kitchens now meet theirs at every size (≥ 10 per 100 sq ft from 30×30 to 60×60: loaded tables, hung things, wall racks, larder runs). Very big fine rooms (about 3.6 against 6.5) and big dormitories (about 3–4 against 8) are still under.

8. **Axial focal placement** (Harry, 2026-10-01, generalized from the fine-room bed). A *focal* key feature — bed, throne, altar, shop counter, a showpiece hearth — goes on the wall **opposite the main door, centred, flanked symmetrically** by its companions; loose placement only when the room is too small. Overrides the coffin/blast-line rule for that feature. Exceptions: privacy features (privy seat, bath) stay out of the door's line; repeated features (cooking lines, stalls, shelving, dorm beds) use the aisle grammar; a big fine room still promotes its bed to the centre. ✅ `focalPlace()`; the summary says `Focal: X centred opposite the door ✓` or why not.
   - Instances: the guest-room and fine-room bed (nightstands both sides); the front-desk counter (keeper's chair behind, a candle at each end); the common-room hearth.
   - The hearth is axial only when the wall facing the door is a *short* wall (or the room is square); on a long facing wall it stays a short-wall pole, because the loop needs the length. The summary notes the choice.
   - Fallbacks: a room under its floor (fine room 200 sq ft), a facing wall that can't take the piece plus both flankers, or a door on that wall (the axis is then a through-way). A window does not stop it: the piece stands in front of the window and that window loses its drapes.
   - A one-door front desk is a dead-end lobby: the counter takes the axial spot first, and the through-line ends at its front.
9. **Grade floor by room wealth** (Harry, 2026-10-01). A room's wealth sets a minimum object grade: fine rooms never get poor-grade objects (straw pallets, three-legged stools, crude boards); a servant's bed in a fine room is at least common grade. Data-driven so poor rooms (hovels) can flip it. ✅ `ROOM_WEALTH` (fine → fine, everything else common) and `WEALTH_FLOOR`. An object's grade comes from an explicit `POOR` list plus name patterns (broken, chipped, dented, moldy, stale, crude, rusty…). `ctx.has()` refuses below-grade objects, so every roll and companion skips them without special cases. A guest dorm still rolls straw pallets.

**Zone anatomy** (from Harry's notes and moves, 2026-10-01): ✅ Reported on an `Anatomy:` summary line.

- **Companions** sit within reach: peel with the oven, nightstands with the bed, towel with the tub. ✅ `companion()`; the oven picks a spot with clear wall beside it for the peel.
- **Working face:** appliances and furniture need standing room in front (oven mouth, hearth, wardrobe doors, bed sides). ✅ Kept clear after placement, and checked free when the anchor itself is placed.
- **Dividers** are screens, rugs and the backs of seating, not walls. Screens shelter private zones (dressing, bathing). ✅ A screen-folding stands on a zone's open edge, between the zone and the door. It is never used as wall dressing.
- **Like with like:** same-function things cluster (tubs together, barrels together). ✅ Tubs within the bathing zone; barrels, crates, sacks and bales join their kind in the edge fill.
- **Privacy gradient inside the room:** bathing and dressing deepest or screened; sitting nearer the fire and the door. ✅ (fine room)
- **Floating seating:** in big rooms, chairs leave the walls and gather into their zone. ✅ From 450 sq ft, zone seats sit at least 2.5 ft off the walls, and chairs are not used as edge dressing.

**Aisle rooms** (2026-10-01, Harry: "an industrial kitchen basically devolves to aisles"). Storeroom, cellar, dormitory, big kitchen and stable all converge on one grammar once they're big: **rows of the room's key thing** (shelving, cask racks, beds, work tables + cooking stations, stalls) with **aisles between** (3–4 ft; 4–5 ft where people carry hot or heavy things; ~10 ft for horses), a **cross aisle at the door end**, extra cross aisles every ~25–35 ft, end caps facing the cross aisle, walls keep their wall-things. Orientation and single/double rows are style rolls. New room types should get this for free by naming their row item. ✅ One code path, `aisleStore(ctx, kind, feature, cfg)`. The cfg names the row item, foot item, aisle width, bands, caps, hangings and zone; it can downgrade a double row to single, fill leftover depth with a single row, and slide the pattern off anything already placed. Storeroom and cellar use the defaults (unchanged); `kitchenRowCfg` and `dormRowCfg` are the first two clients. The stable keeps its own stall code.

**Style rolls (dice).** Style choices are rolled per generation and named in the summary; Roll again rerolls them. Principles are law; style is dice.

## Rooms

Each room is written as **must** (★ key feature) / **rolls** / **grows** (zones in the order they appear).

### Common room (hub)
- **Must:** ★ hearth circle and ★ bar and tap (barkeep lane, stools). They are the poles of the swirl loop. The bar *extends*. ✅ poles, ✅ extend (up to 8 pieces, by area and wall).
- **Grows:**
  - dining islands (repeat) ✅ · entry landing (pegs, notice board, bench) ✅
  - snug / nook (settle, quiet corner) ✅ · stage and audience ✅
  - adventurers' table ✅ (the nook) · serving station (casks, trays, by the kitchen door) ✅ when a kitchen door opens off the room
  - barrel tables ✅

### Kitchen (uses: cellar, storeroom; who counts: staff)
- **Must:** ★ cooking line (hearth or spit, pots, with a working face). It *repeats* along walls as the kitchen grows; it is never a centerpiece. ✅ Uncapped by area: 1 + one per 350 sq ft over 450 (up to 10). Pots go beside, not in front; a kettle or ham hangs over each.
- **Grows:**
  - bake corner (oven, peel, bread rack, flour; the oven mouth stays clear) ✅ Repeats, one per 700 sq ft, up to 4. The peel is within reach in about 85–95% of kitchens; the peel mesh is modelled diagonally, 4.6 ft wide.
  - prep island ✅ (repeats; replaced by the work rows in an industrial kitchen) · scullery ✅ (repeats per 1,100 sq ft, with washing-up clutter) · larder corners ✅ (repeat), plus larder runs on the free wall
  - serving pass (toward the common room) ✅ (placed before the rows in a big kitchen, against a wall) · staff table ✅ (rolled: trestle or square; not guaranteed in an industrial kitchen)
- **Industrial kitchen** (from 700 sq ft and 24 ft on the short side) ✅. The middle devolves to aisles: rows of prep tables end to end, with cauldrons and chopping blocks as segments and as end caps.
  - Rows are rolled single or double, and leftover depth gets a single row.
  - Working aisles are 4–5 ft, with a cross aisle at the door end and more every ~25–35 ft. Aisle orientation is rolled.
  - Hams, onions and kettles hang over the aisles. Cooking lines and bake corners stay on the walls.
  - The summary says `Kitchen: N cooking lines on the walls, M bake corners; R rows (…)`.
  - Density: 30×30 ≈ 13–15, 40×60 ≈ 12–13, 60×60 ≈ 11–12 per 100 sq ft (target 10).

- **Harry (2026-10-01):** a big kitchen should simply get *lots of cooking zones and baking areas* (repeat the cooking line and bake corners, plus prep islands in the middle as work rows) rather than reading empty. That is how kitchens meet their density. ✅ (see Industrial kitchen above)

### Storeroom (terminal; who counts: staff) ✅
- **Must:** ★ wall racks.
- **Grows:** aisle stacks (parallel shelving rows, a cross aisle at the door end, extra cross aisles when very large) · end caps · receiving bay · tally desk (big rooms) ✅ (by the door when the aisles leave no free floor).
- **Rolls:** single or double rows · aisles toward the door or along the long axis · receiving bay or not.
- **Density:** floor coverage (about 25%).

### Cellar (terminal; who counts: staff) ✅
- **Must:** ★ cask hall.
- **Grows:** the same aisle grammar with cask and wine-rack rows · stair or trapdoor landing at the entrance end · cold store (cheese, hams) ✅ · tapping spot (barrel table, mugs, candle) ✅, when the aisles leave room.
- **Rolls:** racks only, or racks mixed with shelving.
- **Density:** floor coverage (about 33%). Small cellars may stay wall-only; that's fine.

### Guest room (terminal)
- **Must:** ★ sleep (bed deep and diagonal from the door, with nightstands). ✅
- **Grows:** wash (stand, jug, towel) ✅ · stow (chest, pegs, wardrobe) ✅ · window seat ✅ (rolled: bench or armchair).
- **Big:** becomes a **dormitory**: a row of beds sharing wash and stow zones. ✅ From 380 sq ft: wall beds (rolled: single or straw pallet), a chest each, pegs.
  - **Middle rows** ✅ (aisle grammar) when there is space: from 600 sq ft, with room for two wall bands plus a row.
  - Rows are head-to-head double or single (rolled), with a foot chest at each bed's foot, 3–4-ft aisles and a cross aisle at the door end.
  - Wall beds keep the long walls.
  - The summary says `Dorm: N beds in M rows`. A 50×60 dorm holds about 22–34 beds, 11–16 of them in the middle.
- **Not a dorm:** the bed is the axial focal (Principle 8): centred on the wall facing the door, a nightstand each side.

### Fine room (terminal)
- **Must:** ★ sleep. The bed is the axial focal (Principle 8) unless the room is big, when it *promotes* to the centre with a rug under it. ✅ From 30 ft on both sides and 1,000 sq ft: a central island, never in the door's line, with nightstands, a rug and a foot chest.
- **Grows:**
  - hearth sitting ✅ · reading and writing ✅
  - dressing (wardrobe, mirror, vanity, sheltered by a screen) ✅ (screened in most rooms; a screen loses if it would hide the bed from the door)
  - bathing (tubs together, screened, deep) ✅ (rolled: one or two tubs; a towel stand within reach)
  - private dining ✅ · servant's corner (big rooms) ✅ (a common-grade bed: the grade floor takes the straw pallet out of the roll)
- Screens divide zones; they are not wall decoration (Harry's note). ✅

- **Harry 2026-10-01:** when the bed is *not* promoted to the centre, it goes **directly opposite the main door, centred on that wall, a nightstand on both sides** — the grand-bedroom reveal. This overrides the feng-shui coffin/blast-line rule for the fine room's main bed (one-camera-angle wins); Very small fine rooms (under 200 sq ft, or a facing wall too short for bed + two nightstands) place it loosely. **No straw pallets** in fine rooms; a servant's bed is at least mid-grade. ✅ Generalized as Principles 8 and 9; guest rooms now get the same axial bed.

### Privy (terminal)
- **Must:** ★ seat bank. The seat stays out of the door's line, and the bank grows into a row of partitioned seats. ✅ bank (up to 5 seats along a wall); ⬜ partitions (no partition object in the library).
- **Grows:** wash basin · supplies (bucket, rags, moss basket).

- **Huge privies** ("we just hope they don't"): the genre answer is a modern-ish washroom — a **row of stalls** (seat + partitions + small door) facing a **row of wash basins** with a mirror over them; towels and a bucket by the door. It's the aisle-room grammar with stalls as the row item. Needs two new meshes (stall partition, stall door — a small in-seat fal job); not built until wanted. ⬜

### Hallway (passageway)
- **Must:** ★ the through-line. ✅
- **Grows:** bench niches ✅ (alternating sides) · light posts 🟡 (sconces; no indoor light post object) · display wall ✅ · door and stair landings ✅ (door landings).

- **Sizes (measured 2026-10-11, `test/halls.test.mjs`):** it furnishes at 1 and 2 cells wide, 2 to 16 long. L-shaped it works 2 cells wide; at 1 cell wide an L fails when its main run is entered from its leg (the line is drawn 4 ft straight across). Left as it is (the golden test); the castle, mansion and crypt passages do not have this limit.

### Front desk (passageway with a checkpoint)
- **Must:** ★ desk checkpoint (counter, keeper's chair, strongbox, key board behind). ✅ It is the axial focal (Principle 8): centred on the wall facing the door, a candle at each end, 3.5 ft behind it for the keeper. Where the facing wall can't take it, it falls back to beside the through-line.
- **Grows:** waiting (bench, rug) ✅ · notice wall ✅ · luggage drop ✅ · lounge (big rooms) ✅.

### Stable (mixed: a passageway for horses, a terminal for grooms) 🟡 agent building
- **Must:**
  - ★ stalls *repeat*: 5 ft wide × 10 ft deep, a partition every 5 ft, a front gate, a manger or bucket on the back wall, dense hay inside;
  - a 10-ft centre aisle linking the end doors.
- **Rolls:** stall rows on one long wall or both.
- **Grows:** super-jumbo stables get back-to-back stall rows in the middle, with aisles between them.
- **Edges:** tack wall (saddles, bridles, blankets) · feed store by a door · muck corner by the exit.
- **Floor:** packed earth with a random scatter layer of hay and dirt (floors agent).

- **Harry 2026-10-01:** stables "nailed it"; 40×40 with two stall rows looks fine. One-wall rolls: fill the bare wall's band with tack + feed ✅. The bare long wall gets three clusters: a tack wall (saddle rack, blanket rail, saddle, bridles, brasses, horse collar), feed (grain bin, oat sacks, hay bales) and grooming (farrier stand, buckets). The 10-ft aisle stays clear. Measured: 75–100% of the bare wall (mean 98%, doors excluded) has tack or feed within 3 ft. Straw floor: "way way better" with the scatter layer but **still needs work** — next pass ideas: more hay/dirt decal variants, per-patch tint and density variation, a scatter that thins along walking lines (trodden aisle) and thickens in stalls/corners. ⬜

### Barn (mixed)
- **Must:** ★ central drive (open floor, wagon). 🟡 (the wagon mesh is masking-filtered)
- **Grows:** hay mow (stacked bales and piles) ✅ · animal pens ✅ (built from stall partitions and gates, hay and a trough inside) · tool wall ✅ · feed and grain ✅ · loft ladder ✅ · troughs ✅.

## Outdoors

### Yard (outdoor: a room with no walls) ✅ built 2026-10-05

Harry approved the design on 2026-10-05: a yard, garden or forecourt, at first dressed **only from meshes we already had**. The same evening the outdoor batch shipped (53 meshes, library source `outdoors-02`): plants, trees, three kinds of edge and yard furniture. What is still wanted is in `docs/ASSETS_TO_BUILD.md`. Code: `yard()` in `js/solver2.js`, the outdoor role and door policy in `js/walls.js`; tests in `test/yard.test.mjs` and `test/yard_ui.py`.

**What "no walls" means** (`walls.js`, `computeEdges`):

- A yard's own edges are **open ground**: no *wall* (nothing in the wall map), no door. Two yards side by side are one stretch of ground. A fence, hedge or low stone wall may stand on them: that is the yard's own furniture, laid by its grammar (see **The edge** below).
- An edge shared with a building is the **building's** exterior wall: its family, its facing, its windows, even when the yard was laid first. The edge remembers the yard it looks onto (`e.yard`).
- The yard has **ground** instead of a floor: grass by default, else packed earth, cobbles, gravel (the room's Floor select chooses). Grass and gravel are new flat textures made on the free image route; tufts and worn patches are scattered over grass so a lawn is not one flat green.
- **The edge** (2026-10-05, when the kits got meshes): rolled by the seed from what suits the neighbours, with "none" always in the roll. Stable yards: post-and-rail fence or a dry-stone wall. A kitchen's garden: wattle fence, picket fence or hedge. Inn yards: stone wall, hedge, picket or post-and-rail. A yard on its own: post-and-rail, hedge, stone wall or wattle.
  - One 5-ft section stands on every open grid edge, **on the grid line** (where a wall would stand), so the run meets the building's corner. A side shared with another yard stays open.
  - Where a run ends or turns there is a corner post (fences), a square hedge block or a stone pier; not where the run ends against the building. A fence's gate hangs between two posts.
  - The **gate piece** stands on the gate's segment: a field gate, a walk-through arch in the hedge, or a gap between two stone piers.
  - Where a wide door reaches the yard's corner (a 10-ft stable or inn door, half of it past the yard), the first section of the run that starts there is left out, so no fence ends in the middle of a doorway.
  - A hedge or stone wall is thicker than the 6 in between the grid line and the yard's ground: the strip it covers is blocked, and things "at the edge" stand inside it.
  - Edge pieces are not props: they do not count toward the yard's density, and they are the only yard things allowed outside its rect and touching each other.
  - Kit pieces are stretched to their box, so the boxes follow the meshes: fence 40 in tall, hedge 38 in, wall 33 in (the catalog's 48, 60 and 36 would have stretched them by half again).
- **Fog:** a yard is outdoors for the wind and the outdoor fog profile, but it is *built* ground: the fog sea over the unbuilt world does not lie on it, and a yard arriving in the fog blows it clear as a room does.

**Doors onto the yard** ("neighbouring rooms' doors open onto it"):

- A building's sticky front door that already faces the yard stays its front door (grand, wide): the yard is then a **forecourt**.
- **Common room, hallway:** keep their street door and get a **back door** onto the yard.
- **Kitchen, stable, barn:** their one outside door **moves** to the yard (wide for stables and barns). A stable opens onto its yard; the kitchen's back door is the yard door. Only onto a yard with an open side: on a closed court they keep the street door too, so the building can still be entered.
- **Terminals** (privy, store, guest room): one door only. An inside door beats the yard; the yard beats the street (the privy across the yard).
- **Front desk:** no back door; a lobby's door is its front door.
- **The gate** is where the yard's path leaves: on an open side, straight across from the main door when it can be. With edge "none" there is no gate piece, only the place the path runs to. A court closed on all four sides has none.
- Measured: every room type at its usual size, with a yard on any side, still gets its key purpose (264 rooms, 0 fails).

**Sparse on purpose** (Principle 7 does not apply outdoors):

- Target **2 props per 100 sq ft** up to about 600 sq ft, thinning with the square root of the area beyond that (a yard's things gather along its walls and edges, which grow with its perimeter, not its area). The lowest indoor target is 3.5.
- A yard does **not** repeat as it grows: still one focal thing, an open middle, more at the wall and an outbuilding or two on the far edge.
- A yard with no building beside it has nothing to gather against, and stays near-empty (a well, a bucket, a bench, a lamp post) until plants exist.

**Where things gather**, in the order they are placed:

1. **One focal thing in the open** (when the yard is at least 15 ft each way and about 300 sq ft): a **well** with its bucket; rolled sometimes a fire pit with benches facing it (inn) or a stone horse trough (stable yard); **a big tree** is in the roll too (the broadleaf, the apple tree or the great oak, never the slender birch; if none fits the yard, the well stands in). As near the middle as it can be while standing clear of the straight door-to-gate line.
2. **The paths**, reserved before anything else gathers: main door → gate, every other door → gate. 4 ft wide, kept clear. (Not door → nearest point of the main path: that runs along the building wall and reserves the wall things gather against.)
3. **Beside each door, by what the door leads to:**
   - *Common room, front desk:* **the inn's hanging sign on the wall beside the door**, facing the yard; a lantern on the other side; a bench against the wall; then a notice or two, barrels and empties.
   - *Kitchen:* a lamp; the rain barrel; then crates of vegetables, a bucket, the washtub.
   - *Stable, barn:* a barn lantern; a trough along the wall; then hay bales, a mounting block, a barrow, a hitching rail out front, the muck heap further along.
   - *Hallway:* a lantern and a bench. *Privy:* a lantern and a bucket.
4. **A lamp post beside the gate.**
5. **The woodpile against the building wall**, by the kitchen door if there is one, with the chopping block (the stump with the axe) in front of it.
6. **By the gate and at the wall:** a notice board facing people coming in, a hitching rail for riders, a fire basket or brazier in bigger yards, the hand cart, a rain barrel under the eaves.
7. **Plants:** the recipe's `plants` slot, **2–4 bush or tree picks by the open edges and beside the doors**. It filled by itself when the plant meshes arrived (2026-10-05): over the test's 272 yards, 2.5 plants a yard, from bushes, the berry bush, barrel and stone planters, the flowerbed and the trees. Trees stand on the open edge in yards of 500 sq ft or more. A tree's footprint is its crown: nothing else stands under it.
   - **Yard furniture from the same batch**, each waiting for room in the budget, so a yard takes one or two: a **picnic table** out from the inn's door (the beer garden, from 500 sq ft); by a kitchen door the **spade, rake and hoe** leaning on the wall, a **vegetable patch or herb bed** on the open edge, then a **compost bin** (600) and a **washing line** (700) at the far edge; a **trellis** on the building wall; a **kennel** by the gate in one yard in three; the inn's **sign on its own post** by the gate, rolled against the notice board; **log seats** round the fire pit; **one long woodpile** in place of two short ones where there is 22 ft of wall.
8. **Big yards** (from about 1,100 sq ft): an outhouse, a woodshed, a cart shelter on the open edge. Never in the middle.
9. **Toward the target:** more of what already stands at the wall, like with like (barrels, crates, sacks, hay).

Signs and lamps hang only on plain wall: never on a door, a window, a door's jamb posts or thin air. The trodden path (`decal-path-worn`, made 2026-10-05) is laid along the main door-to-gate line, a patch every 2.8 ft.

**Vibe by neighbours** (named in the summary): *inn yard* or *inn forecourt* (common room, front desk, hallway), *stable yard* (stable, barn), *kitchen garden* (kitchen); they combine. Herbs, vegetable beds and a washing line arrived with the 2026-10-05 batch (item 7).

**In the tuner:** a yard is dressed by what stands around it, so when a neighbour arrives, leaves or changes type, the yards it touches are laid out again with the same seed (locked things stay). In the game a yard keeps its layout until it is re-rolled: build the yard after its buildings, or re-roll it.

**Gemini's blind read** (gemini-2.5-pro, describe first, then judge; a yard between a common room, a kitchen and a stable; four rounds):

- **What it is:** every round named it without being told: "the courtyard of an inn or tavern", "the working courtyard of a fantasy-style inn or tavern", very confident each time, from the sign by the door, the well and the attached stable. It read the middle as open, the yard as sparse, the path from the big doors as clear.
- **What it caught, and what changed:** dirt patches laid along the path read as "a trail of identical, poorly placed" blobs (gone: the path waits for its own decal); the price board is an easel mesh and floated on the wall (off the wall list); the plain grass read as "a perfectly flat, textureless green plane" (tufts and worn patches scattered over it: the last round reads "green grass with small patches of dirt and a few small white flowers", and no patch "looks like a sticker").
- **What it got wrong:** from a wide angle it called the bench by the well a floating grindstone, and the trough clipped into the wall. Close-ups of the same frame say a bench and a trough, both sitting on the grass, nothing clipping; the layout engine keeps 3 in between a yard thing and the wall face. Wide-angle "floating" calls are triage, not verdicts.
- **After the outdoor batch** (2026-10-05 evening, gemini-2.5-pro, describe first; five inn yards and three lone yards at the table camera): every inn yard was named an inn or tavern courtyard, the lone ones "an enclosed courtyard or garden" and "a small fenced-in yard". Trees: "reads clearly as a tree, with a visible gnarled brown trunk and a large, leafy green crown… stylized, rounded masses", the apple tree named as an apple tree each time. Bushes and flowerbeds read as bushes and flowers. Hedge: "a thick, manicured hedge… four thicker square posts at the corners… an arched opening", joins "very cleanly". Stone wall and fence: named, corners clean in four of five reads. **What it got wrong or disliked:** it did not find the closed field gate in two of four fenced yards at that distance, and put it on the wrong side in a third (a close view shows the gate between its two posts), in one read it called a fence corner "two posts clipped into one another" (each section has its own posts 15 in from the corner post), it calls the lamp post "a stone pedestal on a slab", it misnamed the kennel three times (workbench, beehive, "workshop machine"), and it says the worn path "continues under" the focal tree (the path runs under the crown, 5.5 ft or more from the trunk: measured over 60 yards).
- **In close-up** it named the woodpile against the wall (about half the door's height), the stump with the axe in front of it, the sign on its bracket beside the door at a sensible height (the turnip sign), the trough, the lanterns flush to the wall, the bucket by the well.

## Crypt (seven room types, built 2026-10-05)

Wall family `crypt-stone` (dark dressed stone; corners borrow dressed-stone pillars). **No windows**, so every room ends with at least one light. Doors: the iron gate (`crypt-gate-iron`) to outside, the black oak leaf (`door-crypt`) between rooms. Each program lays the whole room (`solver2.js`, the appended `ccm:solver2.crypt` block; source `experiments/2026-10-05-castle-crypt-mansion/integration/programs/10-crypt.js`). The leg of an L-shaped room gets walls, lights and benches, never a second key piece.

- **Special wall panels** stand in for a plain panel on OUTSIDE walls only (they are 16 to 18 in thick; the room face stays flush, the rest goes outward): burial niches on the long walls of the vault (1 in 2) and on EVERY segment of the catacomb's long walls, skull walls on every outside wall of the ossuary but its door wall, a blind sealed door in a third of antechambers and relic chambers. Nothing tall stands in front of a panel and nothing hangs on one.
- **Antechamber** (4x3, passage): the weeping angel or the draped urn centred on the wall facing the gate, a brazier each side, stone benches on the side walls, urns in the door-wall corners; plaques, an urn niche, wall torches every 11 ft.
- **Burial vault** (5x4, terminal): under 20 cells one tomb in the middle; from 20, tombs in ranks lying across the room either side of a 4.5-ft aisle, the knight's effigy first, one tomb in six open; a tall candle at each head corner of the key tomb; coffins lying along the plain walls; grave ledgers set in the floor.
- **Ossuary** (4x4, terminal): NO shrine (from above it read as a throne). A great heap of skulls in the middle of the floor, 5 ft across (the largest the catalog allows the role), more bones heaped against it; skull-faced pillars on a square round it (two beside it under 17 ft across); a bone trough per 12 ft of side wall, heaps in the far corners and along the walls, a rack of bones only where a plain panel is left; a tall candle either side of the heap, skull candles on the troughs, torches on the door wall; the bone-strewn earth floor always.
- **Catacomb corridor** (10x3, passage): the walls are the feature, niches from end to end. Entered at an END; alone, it has a way on at the other end (the oak door). A clear line down the middle; coffins and wrapped bodies under the niches about every 9 ft (both walls at 3 cells wide), loose bones, tall candles on the floor, a torch on each end wall; earth floors. No rack, urn niche, plaque, lidless coffin, candle stubs or skull heaps (each read as something else: bookshelf, wine rack, workbench, gold, hay).
- **Chapel of rest** (4x7, terminal; the shared `chapel()` program, also the castle chapel's): altar on the short end wall (bare stone: two candelabra and one thing; the cloth read as an open book), the door on the short wall facing it; the bier before it with a coffin (3 in 4) or a wrapped body lying on it and four tall candles (the red pall read as a throne: it only stands in when there is no bier mesh); stone benches in at most six rows facing the altar, or either side of the bier when the room is too short for rows behind it; in a long chapel, sarcophagi along the side walls behind the seats; sanctuary lamp, censer, plaques and candle sconces.
- **Embalming room** (4x4, a work room): the slab in the middle (two thirds of the time with a shrouded body) with 3 ft of standing room down both sides, the salt tub at its foot, bucket and linen within reach; work table and jar shelves on one wall (the end wall in rooms under 17 ft across); coffins waiting on another; a lantern over the slab.
- **Relic chamber** (3x3, terminal, one door): the gold reliquary shrine facing the door between two fire bowls; the open chest of gold in a far corner turned toward the door; chests with coin heaps on the side walls; pedestals with relics from 12 cells.
- **Sizes**: the chapel and the embalming room are larger than first designed (4x5 had no room for benches behind the bier; 4x3 had no slack for the work table).
- **Passage** (`crypt-passage`, 6x2, passage; added 2026-10-11 for the whole-building generator, `docs/BUILDINGS.md`): the plain corridor of a dungeon (the catacomb is 3 cells wide with niches on every panel: a set piece, not a way through). One shared program (`hallProgram`, the `buildings:solver2.halls` block in `solver2.js`; tables in `HALLS`), dressed lightly and only from meshes the library already had. The through-line first; a torch about every 12 ft, the long walls in turn; a memorial plaque now and then; a cobweb. 2 cells wide: sometimes a stone bench or an urn against a wall. 1 cell wide: nothing stands on the floor. No windows; doors `crypt-gate-iron` out, `door-crypt` between rooms. Not in `THROUGH` or `DOOR_ENDS`. Test: `test/halls.test.mjs`.
- **Tests**: `test/crypt.test.mjs` (1,008 rooms, 126 legs, 12 whole crypts, real meshes), `test/golden.mjs` (the twelve older room types are unchanged, scene for scene), `test/assets_check.py` (nothing listed without its file).
- **Door and panel rules a room type can ask for** (`walls.js`, the appended block): `DOOR_ENDS` (the outside door goes on a short wall: catacomb, chapel), `THROUGH` (a lone corridor gets a second door in its far end wall: catacomb), and on a `PANELS` rule `ends` (panels run into the corners), `doorWall: false` (the door wall stays plain) and `shapes` (which versions of the panel).
- **Blind reads at table distance** and what they changed: `experiments/2026-10-05-castle-crypt-mansion/crypt/ROOM_READS.md`. Named without help, 3 of 4 seeds at two sizes: antechamber, vault, embalming room, relic chamber, and since the rework the ossuary (15 of 16 over the local and the live round) and the chapel (16 of 16, "funerary chapel"). The catacomb is named a catacomb about 7 times in 10 at its default 10x3 and 3 to 5 in 10 at other sizes: the niche panels read as shelves of books, as cells, or as burial niches by turns.

## Castle (nine room types, built 2026-10-06)

Wall families: `castle-rough` (dark rough ashlar; its window is an arrow slit; corners borrow fieldstone pillars) for the working rooms, `dressed-stone` for the great hall, throne room and chapel. Doors: the iron-bound oak leaf (`door-reinforced`, shape `castle-leaf`); a 10-ft double door on the hall, throne room and chapel; the portcullis on the gatehouse. Programs: `solver2.js`, the appended `ccm:solver2.castle` block (source `experiments/2026-10-05-castle-crypt-mansion/integration/programs/20-castle.js`). Castle meshes of roles the inn already had are sku tier `castle`, rolled only by these rooms.

- **Entered at an end.** The great hall, throne room, chapel and gatehouse take their outside door on a SHORT wall (`DOOR_ENDS`), facing the dais, throne or altar down the long axis.
- **The dais** is a low platform (16 in): a kit-generated prop stretched per axis to its own box (`fit: box` on the sku; `solver.js dims`). What stands on it is recorded at its height. Its long side lies along the wall.
- **Great hall** (10x6, hub): dais on the end wall with the 14-ft high table on it, linen on the table, the high seat centred behind with armed chairs either side and nobody on the hall side; the arms and banners on the wall behind; the great hearth centred on a long wall; the lower tables (the dark feast tables; trestles under 26 ft across) end to end in two rows either side of a 5-ft aisle, a bench each side of each, a feast on them and no tankards; the royal runner down the aisle; banners and tapestries on the long walls, one per 6 ft; armour by the door; torches; standing lights at the dais step. NO ring chandelier (from above it lies on the floor).
- **Throne room** (5x8, terminal): the throne on the dais, a banner pole each side, the runner from the door to the dais foot with 5 ft kept clear, a mirrored avenue either side repeating pillar, brazier, armour; courtiers' stools at the dais foot; stained glass in the long walls, one panel in two.
- **Armoury** (4x4, terminal): the tall rack on the wall facing the door, racks along the walls (two before anything else goes by the door; the real racks are 5 ft wide), armour stands in ranks facing the door from 20x20 ft (corners below), repair bench and grindstone by the door.
- **Barracks** (7x5, terminal): bunks head to the wall down both long walls, one per 5 ft, a footlocker at each foot where 4.5 ft is left to walk; the guard table against the door wall; helmet pegs between bunks.
- **Castle kitchen** (6x5, uses a cellar or storeroom): the inn's cooking triangle with the 11-ft great hearth as its first line, THEN the castle's works: the cauldron on its crane in the open before the hearth, the 10-ft work table across the middle with the roast on it, the pig on its spit at the table's end, hams on a hook rail over it, cupboards on the walls. The service triangle is walked first so none of it stands in the way. One scullery, ONE larder corner, no bake corner; its own fill (hung racks, work on the tables, one corner stack).
- **Castle chapel** (4x7, terminal; the shared `chapel()`): the one-step square dais on the end wall with the altar on it, pews in rows facing it from 5 ft before the dais, lectern, font and candle rack by the door, stained glass in the long walls. No bier.
- **Dungeon** (6x5, terminal): from 300 sq ft and 21 ft across, cells 10 ft deep along one long wall: full-height partitions, a barred front and a door to each (the crypt's iron gate until `door-cell-bars` is re-made; one cell in five stands open), pallet, bucket and hay inside, manacles and the plank bed on the back wall; a 5-ft aisle; in the open half the rack, the iron maiden on the wall facing the door, stocks, pillory, cage along the far wall as it grows; the doorway's view of the key piece is kept clear. Dark on purpose: one light per 250 sq ft.
- **Gatehouse** (3x5, passage): a clear line from gate to gate; standing alone it has a gate at EACH end, the portcullis outside and the timber double gate straight across (`THROUGH` + `WAY_ON`); a worn way on the floor between them; the windlass and its lever beside the outer gate; a fire; under 24 cells no arms and no table at all.
- **Courtyard** (8x7, outdoor: its own program in place of `yard()`): curtain wall on every open edge with a turret where a run ends or turns, the portcullis or timber gate at the gate; a well or trough; every door's way to the gate kept clear; the watch by the gate; a training corner from 900 sq ft (butts with their range clear, dummies, a pell, practice arms); siege stores at the wall. Nothing of the inn's yard.
- **Passage** (`castle-passage`, 6x2, passage; added 2026-10-11 for the whole-building generator): `castle-rough` walls, the iron-bound oak leaf. One shared program (`hallProgram`, the `buildings:solver2.halls` block in `solver2.js`; tables in `HALLS`), dressed lightly and only from meshes the library already had. The through-line first; a torch about every 12 ft; banners, tapestries, shields and weapon racks on the walls, about one per 16 ft. 2 cells wide: now and then a suit of armour, a bench or a chest against a wall. 1 cell wide: nothing stands on the floor.
- **Tests**: `test/castle.test.mjs` (1,152 rooms, 192 courtyards, 126 legs, 12 whole castles, real meshes), `test/golden.mjs`.
- **Blind reads at table distance**: `experiments/2026-10-05-castle-crypt-mansion/castle/ROOM_READS.md`. Named on 3 of 4 seeds or better: throne room, armoury, barracks, kitchen, chapel, dungeon, courtyard (as a training yard); the great hall (4 of 4 on the live record, 7 reads of 8 before it; its rival is "tavern common room"); the GATEHOUSE 3 of 4 on the live runs but about half of all reads ("castle guardroom" otherwise): not reliably named.

## Mansion (ten room types, built 2026-10-06)

Wall families: `noble-panel` (oak wainscot), `noble-paper` (damask over a dado; its doorway is borrowed), `conservatory` (glass on a brick plinth: the wall IS the window, so no window edges and no drapes); the kitchen keeps `noble-interior`, the cellar `dressed-stone`. Every room is `wealth: fine` and lists tier `noble`: the mansion's own meshes, which no inn room rolls (the Fine guest room is in the golden test). Doors: panelled leaves; the walnut double door where the opening is wide (hall, ballroom); a glazed door on the conservatory. Programs: the appended `ccm:solver2.mansion` block (source `.../integration/programs/30-mansion.js`).

- **Entrance hall** (5x6, hub): the grand stair (`stair-grand--noble-interior`, 10 x 15 ft, top tread at 10 ft) centred on the wall facing the front door; where a door stands in that wall or the hall is small, a round table at the exact centre. A console under a pier mirror on each side wall, the long-case clock, the hall stand by the door. Sparse and symmetric: the floor is part of the read.
- **Drawing room** (5x4, terminal): the marble fireplace on the wall facing the door, a sitting group floating before it; as the room grows a card table, a bureau, a harp corner, a chaise.
- **Dining room** (6x4, terminal): ONE long table on the room's long axis, a chair every 2 ft down both sides, a carver at each end, a place laid before every chair; the fireplace on a short wall, the sideboard on a long one.
- **Library** (4x4, terminal): the ladder bookcase centred on the wall facing the door, the partners' desk before it; then bookcases butted side by side until half the wall is books (at least four where the walls allow, the door wall too), BEFORE the reading fire and the study table.
- **Master bedroom** (5x4, terminal): the state bed centred on the wall facing the door, a cabinet each side, a bench across its foot; a hearth with two chairs; a dressing corner; bureau, chaise, washstand as it grows.
- **Ballroom** (8x6, hub): the middle stays EMPTY (no props, no rugs, and no chandeliers: from above they lie on the floor); gilt chairs in runs along the long walls, pier mirrors over consoles, sconces; the musicians at the short end farthest from the door (harp, stands and chairs; the harpsichord and the refreshment sideboard from 70 cells).
- **Conservatory** (5x4, terminal): a fountain (from 17 ft across) or a tall palm at the centre with the path round it, palms in the corners, tiered plant stands against the glass, orange trees along the path, a sitting clearing, a potting corner.
- **Formal garden** (7x6, outdoor: its own program): always a clipped hedge with an arch at the gate; a main axis from the house door and a cross axis, both kept clear; the fountain at the crossing; everything else in mirrored pairs (topiary, parterres ringed with roses, statues, benches, urns, orange tubs); a gazebo and a lily pond in big ones. The mown lawn's stripes are never rotated.
- **Servants' kitchen** (6x5): the castle kitchen's program (the great hearth, the work table, the spit, the hook rail) without the cauldron crane, plus the bell board by the door to the house.
- **Wine cellar** (5x4, no windows): the inn's cellar program, then wine racks lining the wall and dusty bottles on what stands there (the arched wine bins when that mesh exists).
- **Corridor** (`mansion-corridor`, 6x2, passage; added 2026-10-11 for the whole-building generator): `noble-panel` walls, panelled doors, wealth fine. One shared program (`hallProgram`, the `buildings:solver2.halls` block in `solver2.js`; tables in `HALLS`), dressed lightly and only from meshes the library already had. A runner down the middle from 15 ft long; candle sconces about every 12 ft; paintings about one per 12 ft. 2 cells wide: a console under its pier mirror (once), then an upholstered bench, a floor vase, a pedestal or a bust. 1 cell wide: nothing stands on the floor.
- **Tests**: `test/mansion.test.mjs` (1,152 rooms, 192 gardens, 126 legs, 12 whole mansions; every placement of a role with a mansion mesh rolled it).
- **Blind reads**: `experiments/2026-10-05-castle-crypt-mansion/mansion/ROOM_READS.md`. Named 4 of 4: entrance hall, drawing room, dining room, library, bedroom, conservatory, formal garden. NOT named: the ballroom ("reception hall", "antechamber", "gallery": 0 of 4), the wine cellar (a cellar, not a WINE cellar). On the line: the kitchen (3 of 4 live, 2 of 4 before; "workshop", "forge" otherwise).

## Monster lair (ten room types, built 2026-10-11/12)

A lair is the home of a creature, so a lair room is defined by its OCCUPANT. Walls: `cut-rock` (hewn rock: the dungeon's family, shared; a natural `cave-rock` family is wanted). **No windows.** Doors: the iron-bound oak leaf on most openings (a cave opening with no leaf is wanted), plank doors in the warren, the iron gate on the prisoner pit. Programs: `solver2.js`, the appended `type:lai` block (source `experiments/2026-10-11-types/lai/integration/programs.js`; `apply.py` there puts it back after a hand correction). Every piece is named in order of preference (the lair's own mesh from `lai-01`, then the dungeon batch's, then what the library always had). Whole lairs: `buildings.js BUILDING_TYPES.LAI` (carved, loops 0.45, pacing 0.8: you arrive in the warren, cave passages for corridors, the dragon's hoard the reward at the deepest dead end, one door). `experiments/2026-10-11-types/lai/DESIGN.md`.

- **The den skeleton** (`laiDen(ctx, K)`): one skeleton, dressed by the creature kind K. Six beats, each carried in the placement's `rule`: **BED** (`den-bed`: the deepest corner, or the far corner nearest a second door), **SPOT** (a patch of floor before the bed kept clear for the creature's FIGURE: 10 ft for a dragon, bear or owlbear, 5 ft for a spider, never more than two fifths of the room's short side; recorded on the bed's placement as `lair.spot` / `lair.stand`), **HOARD** (`den-hoard`: what it hoards or guards, within reach of the bed, never by the door), **FEED** (`den-feed`: its leftovers, in the half of the room the bed is not in), **SIGNS** (`den-sign`: what warns the party, within a few steps inside the main door), **ESCAPE** (every second door is joined to the SPOT by a kept-clear walking line of kind `escape`; with one door, the creature's own stand-in where it has one). Dens of beasts, spiders and dragons have NO light.
- **Dragon's hoard** (8x7, terminal, the HEART): the hoard is the bed. The great heap against the wall facing the way in (the hoard mound with a sleeping hollow pressed into its top, 11 ft across); before it the hollow where the dragon lies, ringed by a crescent of smaller heaps, bars and plate that opens toward the door; chests on the walls, a crown left on a lid; a carcass on a patch of soot; soot inside the door and one who got that far. Plain "dragon".
- **Spider nest** (6x6, terminal): the funnel of its web fills the far corner, its dark mouth to the room, on a sheet of web over the floor with the egg sacs in it; its catch wrapped and kept along the walls, web spun round each; web across the floor inside the door and hung on every wall; dry bones.
- **Beast den** (5x5, terminal: bear, wolves, owlbear): a nest of bedding on trampled straw in the far corner; what it dragged home beside it; the kill in the open floor with blood under it; a blood trail in from the mouth and bones thrown out by it; standing rock. Nothing made, nothing lit.
- **Goblin warren** (7x6, HUB; kobolds, orcs and the like): the skeleton with plural beats and a seventh, the chieftain's seat on the wall facing the way in (skulls heaped each side, a stolen banner, a skin before it). Bunks, pallets and bedrolls down one side wall; the cook fire off the walking line with log seats and the pot; stolen goods heaped anyhow down the other side wall; a snare beside the way in and skulls and spears at the door; no stand-in bolt hole (a rolled ladder is a real stair now); torches. The seat is the bone throne on its heap of loot, the bunks the crude goblin bunk.
- **Larder** (4x4, uses a den): kills hung in rows over the far half, the chopping block under them with blood round it, racks of smoked meat, barrels and sacks (no bones, no wrapped bodies, no troughs: with them it read as a necromancer's laboratory), the next meal alive in a cage in a far corner; the keeper's torch by the door.
- **Hatchery** (5x4, terminal, DEEP): the great clutch (dragon eggs) lying IN a great nest in the middle of the floor (in half of them braziers by the side walls: something tends these eggs; beside the nest they read as a cooking fire); a few smaller clutches on straw round the walls; the brood mother's nest in a far corner from 16 cells.
- **Prisoner pit** (5x5, terminal): the pit in the middle of the floor, kept clear (a painted hole where the library has the flat, else the oubliette grating); cages against the walls with filthy straw, manacles between them; the keeper's stool, keys and torch by the door.
- **Trophy cave** (7x3, passage, DEEP; entered at an end): a clear way down the middle; things on plinths (a crown, a helm, a skull), shield stacks, banners, skull totems, a stretched hide and taken weapons stood down both long walls, heads and shields hung above; with no way on, the dragon skull at the far end between two banners. No armour stands (they read as racks and stocks) and no bone heaps.
- **Cave passage** (8x2, passage; entered at an end; alone it has a way on): the way WINDS. The walking line is laid first, bending from side to side about every 9 ft, and boulders or a stalagmite are left standing in the pocket each bend turns away from. One cell wide: straight, nothing stands. Whose passage it is shows by seed (old bones; webs; trodden and torch-lit).
- **Cave mouth** (7x6, OUTDOOR, the ENTRANCE): open ground. The way in kept clear from the open side to the lair's door, a skull totem either side of it where it reaches the mouth, rock either side of the mouth, loose bones on it and the dead beside it; standing alone (no lair beside it) the cave-mouth piece itself stands at the far edge, its opening to the way in; off to one side the last party's camp (fire ring, bedrolls, a log, their packs; a cart from 1,400 sq ft); burnt trees, boulders and a little scrub at the far edges.
- **For the building generator (a "carved" site with loops).** Graph role and depth of each room are in `walls.js` (`ROLES[key].role`, `.depth`, `.boltHole`) and here:

  | room | role | depth | joins |
  |---|---|---|---|
  | Cave mouth | outdoor | entrance (0) | the first passage's door opens onto it; never joined to a den directly |
  | Cave passage | passage | mid (any) | everything; LOOPS are made of passages: a den's second door joins a passage that returns to an earlier one |
  | Goblin warren | hub | mid | passages; larder, prisoner pit and trophy cave open off it |
  | Beast den | terminal (+ optional bolt hole) | mid | one passage; never next to the warren |
  | Spider nest | terminal (+ optional bolt hole) | mid or deep | one passage; a larder |
  | Larder | uses (a den) | mid | its den, on the den's side |
  | Prisoner pit | terminal | mid | the warren or a passage, away from the entrance |
  | Hatchery | terminal | deep | behind a den (the den is the only way to it), never off the entrance |
  | Trophy cave | passage | deep | the last room before the heart |
  | Dragon's hoard | terminal | heart (deepest) | one way in: the trophy cave or the last passage; the largest room; no bolt hole |

  One creature kind per lair is the plain case (the passage's seed style is the cue for the next room); a dragon's lair with a kobold warren, hatchery, larder and pit in front of it is the full set.
- **Tests**: `test/lai.test.mjs` (1,392 rooms; the skeleton's beats and their places; each den has beat pieces no other den uses; dark dens; the winding passage; it passes on the library with and without the dungeon batch), `test/golden.mjs` (0 of 660 older scenes differ).
- **Blind reads at table distance**: `experiments/2026-10-11-types/lai/ROOM_READS.md`.
## Temple & chapel (ten room types, built 2026-10-11)

Wall family `temple-stone` (pale dressed limestone; a tall lancet window; corners, doorways and floors borrow dressed-stone; slate roof). Doors: the iron-bound oak leaf; a 10-ft double door on the nave and the cathedrals. Programs: `solver2.js`, the appended `tem:solver2` block (source `experiments/2026-10-11-types/tem/integration/programs-tem.js`). **Everything here is flavor-neutral**: no emblem on a wall, a pew or an altar. What says which faith is only in the flavor slots (next section). The castle already has a chapel and the crypt a chapel of rest: they stay as they are, and the nave runs the same shared `chapel()`.

- **Temple nave** (5x8, terminal, entered at an END): ONE program from a roadside chapel to a cathedral, by the size drawn.
  - *Chapel* (under 30 ft deep): the altar on the end wall with no dais, two or three rows of seats (under 20 ft across, benches along the side walls instead), the idol in a corner of the altar wall and a tall light in the other, lectern, font and alms box by the door.
  - *Nave* (from 30 ft deep): the one-step dais with the altar on it and the idol behind the altar against the wall; from 34 ft a 9-ft chancel with the sigil in its floor, the pulpit one side and the lectern the other; pews in at most six rows.
  - *Cathedral* (from 34 ft across and 45 ft deep): two rows of columns with the pews between them and the side aisles kept clear; a 15-ft chancel with choir stalls facing each other across the sigil; the organ in a corner of the door wall, a confessional in each aisle; a pier against the aisle walls INSIDE about every 22 ft (staggered between the columns); a sculpture at the head of each side aisle; at most nine rows.
  - Stained glass (an abstract pattern, no picture) in the long walls, one panel in two.
- **Cathedral** (8x14): the nave program at cathedral size. **Dark cathedral** (8x14): the same program in `crypt-stone` walls with no windows, and its flavor list is the evil one. That is the whole difference: it is the test that a recipe changes alignment by its flavor pieces alone.
- **Shrine** (3x4, terminal): the idol centred on the wall facing the door (a bare altar when the flavor has none), a tall light each side, the sigil in the floor before it, a kneeling desk each side of the approach, offering candles on the side walls, benches by the door in a longer room, banners on the side walls.
- **Vestry** (3x3, uses the nave): one or two sets of robes on their stands on the wall facing the door with a tall candle each side; the vesting table against a SIDE wall with the vessels (and the altarpiece) on it (in the middle of the room it was a lord's desk with a high-backed chair behind it); the kneeling desk, the basin, chests and cupboards on the side walls. Three robes in a row are a tailor's shop.
- **Cloister walk** (8x3, the type's passage; alone it has a door at each end): a clear line down the middle; a row of columns 7.5 ft apart down one side; stone benches down the other; the sculpture half way; the sigil in the floor from 15 ft across; urns in the corners.
- **Scriptorium** (5x5, terminal): copying desks in rows either side of an aisle, facing the reader's lectern on the far wall; scroll racks and cupboards down the side walls; a tall light in each far corner.
- **Infirmary** (7x5, terminal): made beds (the cots read as green tables) head to the wall down both long walls, one about every 6.5 ft, a stool at each, with a clear aisle; the treatment bench in the middle of the ward where there is 9 ft between the bed feet (else before the drawers); the healer's end on the short wall farther from the door: the apothecary's drawers and the healer's table with basin and tinctures; lanterns over the aisle. It still reads as a dormitory (see the reads).
- **Priest's cell** (2x3, terminal): a narrow bed along the wall, the kneeling desk under the faith's medallion, a small desk, one chest, one candle, a rush mat.
- **Bell tower base** (3x3, terminal): the great bell in its frame in the middle of the floor with room to walk round it; the ringers' bench and chest; torches.
- **Tests**: `test/tem.test.mjs` (1,080 rooms; the flavor rules; the nave at six sizes), `test/golden.mjs`.
- **Blind reads at table distance**: `experiments/2026-10-11-types/tem/ROOM_READS.md`.

## Flavor slots (2026-10-11): one religious room, any faith

Harry is designing **flavors**: a short list of symbol-themes, never named gods, that re-dress a religious place. Thirteen factions are available: good `sun`, `moon`, `nature`, `sword-shield`; sinister `devils`, `spiders`, `dragons` (plain, one head), `skulls`, `tentacles`; neutral `death` (raven/hourglass, respectful funerary), `scales-coin`, `forge-hammer`, `sea-storm`. The game now calls these **Factions** and offers a data-driven picker (2026-10-13; docs/UI.md → Factions). What is built is the contract it will use, shared by the Temple and the Cult sanctum:

- **A religious room is built neutral.** Walls, floors, pews, altar, lectern, font, columns, candle stands carry no emblem.
- **All iconography is one of nine slot roles** (`catalog/objects-flavor.catalog.md`). A flavor is a sku of each role, conventionally `<role>--<flavor>` with a collision-safe batch suffix where needed; the flavor is the sku's `shape`, not its filename suffix. Harry's scope: a handful of pieces per flavor, most of them flat.

| slot | role | kind | where a program puts it |
|---|---|---|---|
| 1 | `flavor-altarpiece` | mesh | on the altar, centred (the vesting table in a vestry) |
| 2 | `flavor-idol` | mesh | behind the altar against the end wall; the focus of a shrine |
| 3 | `flavor-banner` | flat | hung on the side walls |
| 4 | `flavor-relief` | flat or mesh | wall medallion: the altar wall, the door wall, a cell |
| 5 | `flavor-sigil` | flat | in the floor: the chancel, before a shrine's idol, a cloister |
| 6 | `flavor-censer` | mesh, a light | the pair flanking the altar or the idol |
| 7 | `flavor-sculpture` | mesh | a second showpiece that is not the idol: the head of a side aisle, the door end, a cloister |
| 8 | `flavor-buttress` | mesh | a 9-ft upright carved pier, kept as Harry approved; along the walls inside a cathedral or sanctum; use each SKU’s measured box |
| 9 | `flavor-corbel` | mesh | a stout carved bracket, nominal 24x24x30 in; flat back toward the wall, front +Z inward, flat top at 9-ft beam height (the spider variant is 36 in high); repeated along long walls in large naves, cathedrals, sanctums and inner sanctums |

- **One room, one flavor.** A program asks for a slot role and gets only its room's flavor; a slot that flavor has no piece for stays empty (or takes the neutral piece the program names: a chalice on the altar, the kit buttress). An unfilled censer slot reuses the existing bronze `censer-hanging`, mounted from the ceiling over the altar or before the idol. Flavors are never mixed.
- **Which flavor**, in order: explicit `room.flavor` (the solver receives the client's inherited building/room choice), `opts.flavor` (the tuner: `?flavor=moon`), then the existing default pool. Automatic defaults stay sun/moon for Temple and devils/spiders for Dark cathedral/Cult; the nine added factions are used only when selected. Buildings retain their seeded choice, while standalone rooms take the first available default.
- **Filled today (2026-10-13)**: sun/moon/devils/spiders fill all nine slots, including the new corbels; the sun idol was replaced and the old mesh retained. Each of the nine added factions fills idol, corbel and altarpiece with meshes, plus banner, relief and floor sigil with native-alpha flats: 27 meshes and 27 flats. Their censer, sculpture and pier slot arrays are deliberately empty; the censer fallback is the neutral ceiling `censer-hanging`, and sculpture/pier stay optional. Banners are dressed before corbels; long-wall cloth is proportionally shortened below the beam supports so both remain present without intersecting. An idol that fits neither the normal chancel position nor its corner is uniformly fitted to the measured chancel gap.
- **Picker data**: `data/factions.json` has `version`, `slots`, and `factions`; `library.json` also exposes `factions` and `flavorSlots`. Each faction has `id`, `label`, `pieceLabel`, `aliases`, `group` (good/neutral/sinister), `emblem` (`assets/emblems/<id>.webp`, all thirteen installed), `available`, `slots` (role → SKU array), `emptySlots`, and `fallbacks`. Empty slots stay empty; sculpture and pier are optional. Automatic building defaults remain sun/moon and devils/spiders so adding factions cannot re-roll existing buildings. Explicit `room.flavor` or `opts.flavor` selects any faction.
- **To add a flavor**: make its skus under the nine roles, nothing else. No program, recipe or room type changes.

- **As built with the cult batch (2026-10-12):** the shared code is the block `// >>> types:flavor` in `js/solver2.js` (`withFlavor(ctx, FLAVORS.evil | FLAVORS.good, forced)`, `flavorOf`, `flavorHas`). In the game, rooms of one BUILDING take one flavor (a seeded pick among the list's flavors that have an idol; `engine/core/roomgen.js` passes `building` and `flavor`), so rooms side by side never disagree; a room outside any building takes the first of its list. `devils` and `spiders` are filled: idol, sculpture, buttress, altar-piece and censer as meshes; banner, relief and sigil flat. The cult's relief cards are 1 in deep (their own box; the catalog line is the 8-in tablet). The cult's `flavor-buttress` pieces are Harry-approved 9-ft upright carved piers. Keep their existing meshes and each SKU’s measured box; use them as interior piers in large sanctums, not as promised replacements for the vertical kit's outside supports.

## Cult sanctum (nine room types, built 2026-10-11)

Wall family `black-stone` (near-black basalt ashlar with one dark red band; corners borrow dressed-stone pillars; slate roof); the hidden entrance is `dressed-stone`, because from outside it is a cellar. **No windows**, so every room ends with at least one light. Doors: black oak (`door-crypt`) inside and out; the hidden entrance has a plain cellar door to outside and to ordinary rooms, and **the bookcase** (`door-secret-bookcase`, a leaf) toward any other sanctum room. Programs: `solver2.js`, the appended `types:clt.solver2` block. Sanctum meshes of roles the library already had (the black pillar) are sku tier `cult`. All iconography is in the flavor slots above; nothing else in these rooms carries a symbol.

- **Hidden entrance** (4x3, passage): reads as an ordinary cellar store: shelves, barrels, crates and sacks thin along the walls, a lantern, cobwebs, sometimes a trapdoor. Nothing of the cult shows. Standing alone it still has its way on: the bookcase straight across from the cellar door (`THROUGH` + `WAY_ON any`).
- **Processional passage** (8x3, passage, entered at an end, a way on at the other): a clear line down the middle on the runner; against the long walls, mirrored pairs every 5 ft: hooded statues (every second pair of figures the flavor's sculpture) and fire bowls in turn; alcove panels (`wall-alcove`) in every second panel of both long walls, nothing tall before them; banners and reliefs on the plain panels. Under 9 ft across: the walls and their lights only.
- **Sanctum** (6x9, terminal, door on a short wall): the idol centred on the end wall (rooms 19 ft deep or more); the altar slab on the axis before it, lying across the axis where the room is wide enough, with the altar-piece, a candle toward each end and one ritual thing (dagger, chalice or bowl); a censer each side; the plain ritual circle with the sigil inside it on the axis before the altar, its floor kept clear; a fire bowl each side of the circle; at most four rows of seats behind the circle either side of the aisle; pillars against the long walls in mirrored pairs from 19 ft across, the flavor's buttresses in their place from 29 ft; sculptures (else hooded statues) in the corners of the end wall; banners and reliefs down the long walls.
- **Summoning chamber** (5x5, terminal): the plain circle with the sigil dead centre (the sigil alone in a small room); a boundary stone at each of its four points; tall candles at the two side points; the empty arch centred on the wall facing the door; the chained book on its lectern at the circle's edge, off the door's line, turned to the circle; fire bowls in the far corners; a work table by the door.
- **Holding cells** (5x4, terminal, dark): cages in a row along the wall facing the door, one per 6 ft; a bucket; manacles on the side walls; a pallet; the gaoler's table, stool and keys by the door; ONE fire.
- **Robing room** (4x3, uses the sanctum): a rail of hooded robes standing in the open along the room's long axis (two from 20 cells; against the far wall in a small room); peg rails of robes on the walls; a bench, chests, a wardrobe; a table with blank masks and a folded robe; somewhere to wash by the door.
- **Forbidden library** (4x4, terminal): the chained book on its lectern in the middle of the floor facing the door (on the far wall in a small room), a tall candle each side; bookcases side by side, the wall facing the door first, until half the wall length is books; a reading table with the strapped tomes, the chained book, a black candle, a skull.
- **Acolytes' quarters** (5x4, terminal): pallets (bunks from 35 cells) heads to the wall, one per 4.5 ft, down both long walls where two fit with a way between; a chest at each foot where 4 ft is left to walk; robes on pegs by the door; a small table. No arms.
- **Inner sanctum** (3x4, terminal): the idol centred on the wall facing the door; the sigil on the floor before it and the offering bowl on it; a censer each side; the open treasure chest in a door-wall corner, chests on the side walls, pedestals with a tome or a chalice; a sculpture and a fire bowl in the far corners from 20 cells. One vault in three has the high priest's secret door standing ajar (`wall-secret-door`, a panel).
- **The leg of an L-shaped room** gets walls, lights and the flavor's signs, never a second key piece.
- **Tests**: `test/cult.test.mjs` (972 rooms in both flavors, 162 legs, 12 whole sanctums of nine, the flavor rules), `test/golden.mjs`.
- **Changed after the blind reads (2026-10-12):** the passage keeps at most ONE alcove panel (a row of red-arched alcoves with candle wax read as furnaces) and one pair of fire bowls for every two pairs of figures; the robing room's rail stands at the wall under 30 cells, with a wardrobe from 12 cells and the flavor's banner over the robes.
- **Blind reads at table distance** (local, both flavors): `experiments/2026-10-11-types/clt/ROOM_READS.md`. Named: the sanctum ("demonic chapel", "unholy chapel"; as spiders 3 of 4), the summoning chamber, the inner sanctum (a shrine of its flavor), the holding cells, the passage after the change (a ceremonial hall, 6 of 6). Correct but not the cult's own: the library (a library), the quarters (a dormitory), the hidden entrance (a storeroom, as intended). NOT named: the ROBING ROOM, an armoury in 10 reads of 10 (the hooded robes read as weapons and armour from above).

## Dungeon & prison (fourteen room types, built 2026-10-11/12)

THE D&D dungeon: an adventure site, not a realistic gaol. Wall families: `dressed-stone` for the prison half (cell block, guard room, interrogation room, treasure vault, sewer, flooded chamber) and the new `cut-rock` for the adventure half (hewn from the living rock: no blocks, no joints; corners, floors and family-keyed props borrow dressed stone; roof style `flat`). No windows anywhere. Doors: the iron-bound oak leaf (`door-reinforced`, shape `castle-leaf`) everywhere (the iron gate on a corridor read as a cell). Programs: `solver2.js`, the appended `type:dun` block; registrations in `walls.js` `type:dun`; data in `build_data.py` `type:dun`. Every dungeon mesh and decal except the wall kit carries the exclusive sku tier `dun`: a room type of another kind takes them by adding `'dun'` to its `tiers`.

- **Chasms and channels are flats.** Terrain below floor level does not exist, so a chasm (`chasm-strip`, `chasm-strip-wide`) and a sewer channel (`sewer-channel-strip`) are opaque 5-ft tiles laid in a row from wall to wall (`dunFlat`, stretched a little to fit the room's length); the row is closed to everything else and the walk is drawn across it at the bridge. `pit-open` is the same trick for one square.
- **Traps and hazards are ordinary things** with the catalog's `trap` / `hazard` affordances (pressure plates, spike plate, spike pit, the open pit, swinging blade, dart wall, flame jet, trip crossbow, bear trap, rolling boulder, floor and wall levers). No trap behaviour exists.
- **Corridor** (8x2, passage; `THROUGH` + `DOOR_ENDS`): the connective tissue for the layout generator. A clear through-line between its two farthest doors; every other door joins it (a junction); torches in turn down the long walls. By width: 1 cell = nothing stands (things hang, decals lie); 2 cells = rubble, bones or a statue on the side the line leaves free; 3 cells = alcove statues in facing pairs. With ONE door and no way on it ends in a fall of rock.
- **Trap corridor** (8x3, passage): the through-line first, then a gauntlet set ON it about every 6 ft: the big legible traps first (blade across the way, open pit, spike pit, spike plate; a big trap sits on the corridor's centre line), plates between; one dart wall beside a plate; blood by the traps; the lever by the far door; whoever came before short of the first trap.
- **Dead end** (4x2, terminal): what the passage stops at, by seed: a fall of rock (two in four), a sealed rune or face door standing blind in the end wall, or a chest with a body before it (one chest in three is the mimic).
- **Cell block** (8x6, terminal, entered at an end): 10-ft cells along one long wall, or both from 29 ft across; full-height stone partitions, a `cell-bars` panel and a barred door (`door-cell-bars--leaf`) to each, one in six standing open; a cell that a door of the room would open into is left out. Inside: pallet or stone bunk, bucket, straw; one cell in five has the chained skeleton. Keys and lever by the door, the jailer's table in an aisle of 8 ft. Too small for a row: one cage across the far end.
- **Guard room** (5x4, uses the cells, vault and interrogation room): the table in the middle with stools, dice, tankards and a lantern; cots along one side wall, three at most (more is a barracks); arms on the wall facing the door; keys, roster and lever by the door; a brazier.
- **Interrogation room** (5x4, terminal): the restraint chair in the middle facing the door (the rack where there is none), irons heating beside it, the table of tools on the nearest wall, the iron maiden on the wall facing the door; post, cage, block and stocks as it grows.
- **Treasure vault** (4x4, terminal): the open chest on the wall facing the door with gold stacked each side; chests, strongboxes, gold bars and coin down the side walls and in heaps on the floor (shelves and silver read as a storeroom and were dropped); the great hoard in the middle only from 30 cells (it read as a round table in a small vault); guardians in the far corners from 20 cells; a pressure plate inside the door half the time; one chest in three vaults is the mimic.
- **Sewer** (8x3, passage): a channel down its length in the row no door opens onto (the middle where every door is an end door on one side of it, else against a doorless long wall), a pipe mouth or barred outfall at each end that has no door, sluice, clog and flotsam in the water, slime and puddles on the walkway. One cell wide = a culvert with no channel.
- **Puzzle hall** (6x6, terminal): the sealed rune door on the wall facing the entrance with an orb pedestal each side; a 2x2 or 3x3 square of rune tiles in the floor (the mosaic one hall in three); a turning statue at each corner, each facing its own way; the sliding block and its scrape marks; levers by the entrance.
- **Chasm crossing** (7x5, passage; `THROUGH` with `WAY_ON any`): the chasm from wall to wall across the way (10 ft wide from 24 ft deep), the stone bridge on the door's own line with posts at its ends, the walk over it; under 17 ft deep there is no bridge (a crack to jump).
- **Monster den** (5x5, terminal): the nest in a far corner with eggs, the picked carcass in the open floor, wrapped victims along the walls with web on the floor, heaps of bones, the last party nearest the door, claw marks inside it. One torch.
- **Shrine** (3x3, terminal): the wayside shrine (the forgotten god from 16 cells) on the wall facing the door, a tall candle each side, offering bowl and kneeler before it; trays and urns along the sides; two benches at most.
- **Flooded chamber** (5x4, terminal): its only floor is water (`floor-water-flooded`); tide-marked pillars in two rows, an outfall in the far wall (a statue there made it a shrine), pillar tops as stepping stones from the door, flotsam.
- **Collapsed hall** (6x5, terminal): rock falls side by side across the far end and one in the middle, two rows of columns (broken toward the fall), fallen drums, a ceiling slab, stone everywhere.
- **Shared on purpose (mine, lair, ruins, caves).** Take these by adding `'dun'` to the room type's `tiers`: the `cut-rock` wall kit (three plain panels and a doorway; no tier, any room may name the family), `floor-cut-rock` (+v2, v3), `dun-corridor` itself as a passage room, `collapse-rubble` (+s2), `rubble-pile` (+s2), `ceiling-slab-fallen`, `shoring-timber` (a mine prop frame), `stalagmite` (+s2), `mushroom-cave-giant`, `boulder-rolling`, `stepping-pillars`, `bridge-stone-natural` / `plank-bridge`, the strips (`chasm-strip`, `chasm-strip-wide`, `pit-open`), `nest-monster`, `eggs-monster`, `carcass-ribcage`, `web-cocoon` (+s2), `decal-web-floor`, `decal-claw-marks`, `decal-slime`, `decal-rubble-scatter`, `adventurer-remains` (+s2), `dun-treasure-hoard`. Helpers worth calling rather than copying: `dunFlat` (a flat at an exact spot, stretched), `dunThrough` (through-line plus junction branches), `dunScatter`, `dunFocal`.
- **Tests**: `test/dun.test.mjs` (2,016 rooms, junctions and dead ends, 168 legs, whole dungeons; real meshes), `test/golden.mjs` (0 differ).
- **Blind reads at table distance**: `experiments/2026-10-11-types/dun/ROOM_READS.md`. Named on every read: cell block, guard room, treasure vault, monster den, puzzle hall, shrine, flooded chamber; the sewer 3 of 4. Not reliably named: the corridor and the interrogation room (2 of 4), the chasm crossing (1), the trap corridor, dead end and collapsed hall (0).

## Market & village (twelve room types, built 2026-10-11)

Wall families: `half-timber` for shops and houses (the family the inn already had; it gained a second wall shape, a doorway and the shop window), `fieldstone` for the watch post. Programs: `solver2.js`, the appended `mkt:solver2` block (source `experiments/2026-10-11-types/mkt/integration/programs.mkt.js`). Suggested sizes stack into one two-storey building: shop 4x4 + back room 4x3 + passage 2x7 below; living room 4x4 + bedroom 4x3 + the same passage above.

- **The shop skeleton: ONE program, the trade is data.** Every shop is the same room: the counter facing the door, 4 ft off the wall behind it (the keeper's lane and stool; a way round the roomier end is reserved first); stocked shelves butted along the wall behind the counter and down the side walls until about 45% of the wall is stock; one slot in the floor each side of the way in, for the display table and the trade's own pieces, turned parallel to the side walls; floor stock at an end of the counter and by the door; a price board and lanterns. A **trade** is a sku tier on five roles (`counter-shop`, `shop-shelf-stocked`, `craft-display-table-goods`, `shop-floor-stock`, `shop-sign`) plus a line in `MKT_TRADES` naming its signature pieces. A room type lists its trade's tier first in `tiers` (`build_data.py`), so `chooseSku` rolls the baker's counter in the bakery and the tailor's in the tailor's. **A new trade = meshes for the five roles in a new tier + one line in `MKT_TRADES` + one room-type line.** No new program.
  - **General store** (`mkt-general`): the row of dry-goods bins on a side wall; barrels, sacks, crates, spice sacks, pots.
  - **Bakery** (`mkt-bakery`): the inn's bread oven, bread rack and pretzel rack on the side walls, the dough trough in the floor; flour.
  - **Apothecary** (`mkt-apoth`): the cabinet of small drawers centred on the wall BEHIND the counter; the tincture rack; a small table of jars and herbs.
  - **Tailor & draper** (`mkt-tailor`): the cutting table and two dress forms in the floor, the standing mirror and the spinning wheel at the wall, a striped rug.
  - **Magic & curio shop** (`mkt-curio`): the display case and pedestals in the floor, a telescope and a globe, a round rug.
- **Adding a trade (a cobbler, a chandler, the smithy's shopfront …): a stock list, not a room.** Four steps, no solver code:
  1. **Meshes** for the five skeleton roles, loaded with the trade's stock, each with `"tier": "<your-tier>"` in its spec so the manifest's `tier` column carries it: `counter-shop--<trade>` (6 ft counter, goods on one end of the top), `shop-shelf-stocked--<trade>` and `--<trade>--s2` (a tall and a chest-high shelf unit, solid back, the biggest things on TOP: that is what the table camera sees), `craft-display-table-goods--<trade>`, `shop-floor-stock--<trade>`; optionally `shop-sign--<trade>`. One colour story and a few BIG things per trade: shops are told apart from above by colour and silhouette. Prompts to copy: `experiments/2026-10-11-types/mkt/build_spec.py` (`TRADES`).
  2. **The tier is exclusive**: add it to `EXCLUSIVE` in `build_data.py` (as the `mkt-…` line does), and make your batch block keep the manifest's `tier`.
  3. **One call in `solver2.js`**, in your own appended block: `mktRegisterTrade('<room key>', { tier, name, hero, floor, by, sign, table?, rug? })`. `hero` = the signature pieces as `[role, where]`, where = `'far'` (centred on the wall behind the counter), `'wall'` (a side wall) or `'floor'` (in the floor before the counter); `floor` = loose stock against the walls; `by` = what stands outside its door on a street. The five lines in `MKT_TRADES` are the examples.
  4. **One call in `walls.js`**, `mktRegisterShop('<room key>')` (the role, the shop window in the street wall, no other windows, no door into the shop next door), and **one room-type line** in `build_data.py` with `'tiers': ['<your-tier>', 'mkt']` (your tier FIRST) and a recipe of your own type's prefix.
  The back room, the square's open trestles and the street's door dressing pick the trade up by themselves (they read `MKT_TRADES` by the neighbour's room key); add the tier to those three room types' `tiers` so they may roll it. `test/mkt.test.mjs` checks every skeleton placement against the room's first tier.
- **The shop front.** The shop window (`wall-window-shop`, a kit role of its own) stands in for EVERY plain panel of the wall that has the shop's street door in it and for no other (`PANELS` with `only`); shops and the back room roll no other windows (`NO_WINDOWS`), so the other three walls are shelves from end to end.
- **No door between two fronts.** Two shops side by side (or a shop and the watch post, or a neighbour's living room) are two businesses: `mktNoLink` in `walls.js`, one hook line at the top of `linkWhy`. A shop still opens into its back room, the passage, and onto a street or square.
- **Shop back room** (4x3, terminal, no windows): racks round the walls, plain storeroom shelving and stocked shelves in turn; the stock is **the trade of the shop it opens off** (the general store's when it stands alone); crates, barrels and sacks stacked like with like in the corners; the tally desk with the ledger and the strongbox by the door.
- **Shop passage & stair** (2x7): the inn's hallway program in half-timber walls (`PROGRAM_OF`). The stair itself is placed by the game's storeys tool.
- **Watch post** (4x4, fieldstone): the sergeant's desk facing the door with his chair behind it; a **timber lockup** in a far corner (from 14 ft each way): a pen 5 ft deep and one or two panels wide of `cell-holding-wood`, one panel the gate, hay, a stool or pallet and a bucket inside; arms racks behind the desk; the bench by the door; the wanted wall (bounties, a proclamation, the roster, keys); from 20 cells an off-duty table, from 30 a cot.
- **Town house: living room** (4x4): the hearth on the wall facing the door, a rocking chair one side of the way to it and the settle the other, both facing the fire; the family table laid for a meal; the dresser, a cupboard, the spinning wheel, a chest; a cradle within reach of the fire in most.
- **Town house: bedroom** (4x3): the inn's guest room program in half-timber walls (`PROGRAM_OF`).
- **Market square** (8x7, outdoor, its own program): one thing in the middle (the market cross twice in five, a well, a fountain or the pump), stalls in two rows facing each other across it (12 ft between the rows, a gap where the cross way passes; a second pair of rows in a deep square), wares set out on the ground beside each stall, open trestles of different trades round the edge facing in, the crier's stand by the middle, a cart at the edge, the notice board by the way in, a lamp at each corner, a bollard each side of the way in. Every door's way to the gate is reserved before a stall stands. No fence or wall: a square is open.
- **Town street** (10x3, outdoor, its own program): a clear way down the middle from end to end (at least half the width); everything stands in a band at the two sides: a lamp about every 25 ft on alternate sides, the pump and its trough from 40 ft, a bench, a cart, barrels; a pair of bollards at each open end.
- **By the doors along a square or a street:** the trade's sign on the building's wall (the pretzel for the bakery, the inn's own sign for a common room), the trade's stock and a thing or two against the wall, a lantern; awnings over one window in two.
- **Tests**: `test/mkt.test.mjs` (1,296 indoor rooms, 288 squares and streets, 144 legs, 40 stacked buildings, 12 whole streets; every placement of a skeleton role is the room's own trade), `test/golden.mjs`.
- **Blind reads at table distance**: `experiments/2026-10-11-types/mkt/ROOM_READS.md`.

## Wizard's tower (eleven room types, built 2026-10-11/12)

Wall family: `tower-stone` (warm buff ashlar, one plum-grey band course, a leaded lancet as its window piece; corners, floors and stairs borrow dressed stone; slate roof). The apothecary shop is `half-timber` with ONE display-window panel (`wall-shop-window`, a special panel on a plain outside wall, its bay turned outward). Door: the pale round-topped `door-tower` leaf in every tower doorway. No windows: summoning chamber, scrying room, potion store. Every room lists tiers `wizard` (its own meshes of roles other types also have: the crammed bookcase, the purple bed, the second drawer cabinet and scroll rack), `noble` and `ccm`. Programs: the appended `wiz:solver2.wizard` block (source `experiments/2026-10-11-wizard-tower/integration/programs/40-wizard.js`), built on the castle / crypt / mansion helpers. Tower rooms are small, so every program runs from 2x2 cells and the focal piece falls back from its best place to any wall that takes it.

**Arcane iconography is on separate props only**, for the coming flavours system: the ritual circle (`decal-ritual-circle`, two versions), the inlaid star floor (`decal-star-floor`) and the star chart (`map-wall--stars`) are flats; walls, doors, furniture and cloth carry no runes, stars or moons. Swap those three and the candle colours and the type is a moon-cult's or a devil-cult's.

- **Alchemy laboratory** (5x4, uses the store): the brick furnace on the wall facing the door; dressed benches of apparatus along the walls (their glass is the room's colour); the copper still; the cauldron of green brew out on the floor from 16 cells; reagent shelves; the growing vat from 20 cells; a mixing table in a big one.
- **Library & study** (4x4, terminal): crammed bookcases butted along the walls (about 40% of the wall), the desk before them, the great book on its lectern beside the desk; scroll rack, armillary sphere, staves, the cabinet of curiosities; books piled on the floor.
- **Summoning chamber** (4x4, terminal, no windows): the circle in the exact middle, sized to the room (5 to 14 ft), nothing standing in it; five tall candles on its rim (seven from 16 cells), never in a doorway; a crystal pylon toward each corner; the book on its lectern facing the circle between two braziers.
- **Observatory** (4x4, terminal): the great telescope in the middle of the floor on the star chart; armillary sphere and orrery toward the far corners; the chart table by the wall; star charts pinned up.
- **Scrying room** (3x3, terminal, no windows): the stone basin in the middle (from 12 ft across) with a tall candle at each of its diagonals and one stool; the great crystal ball on its pedestal facing the door between two candle stands; a standing mirror against a wall from 16 cells. No cushions (they read as a cot) and no mirror in a corner (a crossbow on the floor).
- **Potion store** (3x3, terminal, no windows): the drawer cabinet facing the door, shelves of bottles side by side on every wall that takes one (only bottle shelves: the curio cabinet and plain shelving read as bookcases), crates, barrels and carboys on the floor.
- **Apothecary shop** (4x3, half-timber, uses the store and the laboratory): the counter across the room, the keeper's side behind it against the wall of drawers and bottle shelves; a bench for customers by the door; the sign; one display window.
- **Wizard's bedchamber** (4x4, terminal): the purple curtained bed on the wall facing the door; the robe and pointed hat on their stand beside it (the piece that says whose room it is); a trunk at the foot; wardrobe, bookcase, the familiar's perch.
- **Familiars' menagerie** (4x4, terminal): the great iron cage in the middle on straw; standing birdcages round the walls (two of every three pieces), a hutch, a planted tank; the great egg in its nest and the perch tree in far corners. Cages are what says "animals": with the nest in the middle the room was a workshop with a fire pit, with the perch tree a tailor's.
- **Tower stair** (3x3, hub): the stone spiral in a far corner (9 ft across; the floor left as an L from door to door), a bust, a bench, torches. Since 2026-10-11 the role makes the stair: the game opens the floor above it, rails the hole and carries pawns.
- **Enchanter's workshop** (5x4, terminal): the free-standing stone arch on the wall facing the door, a crystal pylon each side; the enchanter's table before it; crystal clusters in the far corners; staves, scrolls, a bench; braziers by the door.
- **A tower, storey by storey.** Rooms stack as any rooms do (`core.test.mjs` solves three of them at y = -10, 10 and 30). A workable tower is a 4x4 or 5x5 footprint: ground floor the shop (or the store) with the stair room beside it, then laboratory, study, bedchamber, summoning chamber, the observatory on top; put the Tower stair on every floor in the same corner, or let the game add its flight. Round walls do not exist: see the README's "How a square tower reads".
- **Tests**: `test/wizard.test.mjs` (1,584 rooms, 198 legs, 12 tower floors; 218,863 checks). The golden test holds every older type unchanged.
- **Blind reads**: `experiments/2026-10-11-wizard-tower/wizard/ROOM_READS.md`. On the live record ten rooms are named 4 of 4 (the store as an alchemist's or apothecary's room, a store in 3 of 4). NOT named: the scrying room ("ritual chamber or a small shrine" 4 of 4, never "scrying").

## Mine (thirteen room types, built 2026-10-11)

A mine is mostly TUNNEL, so the passage rooms come first. Eleven rooms underground (hewn rock, **no windows**, every room ends with at least one lantern), two on the surface. Wall families: `mine-timbered` (the dungeon's `cut-rock` with a timber post up each panel and a cap beam along the top; it draws plain cut-rock until its own three panels are in the library) for tunnels and stores, bare `cut-rock` for the face, the seam, the sorting chamber and the mess; the smelter house is fieldstone with windows; the pithead yard is outdoor. Doors: plank; the powder store's is iron-bound oak. Each program lays the whole room (`solver2.js`, the appended `type:min` block, which uses the dungeon block's helpers; walls and roles in `walls.js` `type:min`). Every list of pieces ends in things the library had before the mine's own meshes, so a room still solves, plainer, while a mesh is missing.

**The graph (for the building generator).** `walls.js` `ROLES` holds each room's role, `MIN_DEPTH` (exported) its depth hint. A carved site: rooms floating in rock, joined by `min-tunnel`s with loops through `min-junction`s.

| room | role | depth | joins to |
|---|---|---|---|
| Mine tunnel `min-tunnel` | passageway (the connective tissue; any length, 1 to 3 cells wide) | any | everything; a door at each end when alone, a side door makes a turning |
| Tunnel junction `min-junction` | hub (3 or 4 ways; where loops close) | any | tunnels only, ideally; a store may hang off it |
| Shaft head `min-shaft-head` | hub and THE VERTICAL LINK (one per level, stacked: the ladder climbs to the level above) | near the shaft | the pithead yard above; tunnels; the sorting chamber, tool store and mess |
| Ore-sorting chamber `min-sorting` | uses (the tool store, the powder store) | near the shaft | the shaft head or a tunnel beside it |
| Tool store `min-tool-store`, Miners' mess `min-mess` | terminal | near the shaft | the shaft head, the sorting chamber or the first tunnel |
| Powder & lamp store `min-powder-store` | terminal, locked | mid (away from the mess and the shaft) | a tunnel, never a hub |
| Working face `min-face` | terminal: a dead end | deep | the end of a tunnel (several per mine) |
| Collapsed tunnel `min-collapsed` | terminal: a dead end (it may hide a way on) | deep | the end of a tunnel; a loop that no longer closes |
| Flooded gallery `min-flooded` | terminal | deep (the lowest level) | a tunnel |
| Crystal seam `min-seam` | terminal: the reward room, one door | deepest, farthest from the shaft | behind a face, a collapse or a flooded gallery |
| Pithead yard `min-pithead` | outdoor (a hub in use) | surface | the shaft head below it; the smelter house |
| Smelter house `min-smelter` | terminal | surface | the yard |

- **The cart road** (`minRoad`): rail tiles (the flat `mine-rail-strip`, 5 ft each, as the sewer's channel is laid) in one row down the long way of a room. Two cells wide and more, the row lies against a long wall with no door and out of line with the end doors, so every door opens onto the walkway beside it; one cell wide, the tunnel is all road. Carts stand ON it; nothing else does. No timber sets stand over it: from the table camera a row of them read as stable stalls (the timbering is in the wall panels).
- **Mine tunnel** (8x2, passageway): a clear through-line door to door; the cart road with two carts on it (three from 9 cells); a lantern about every 13 ft; a warning board; from 3 cells wide, pit props, ore and barrels against the wall across from the road. With one door and no way on it ends at broken rock.
- **Tunnel junction** (4x4, hub): a row of track through the middle each way and the turntable (flat) where they cross; every door joined to it and the way round kept; a loaded cart on the arm that runs to a wall with no door; ore heaps and pit props in the corners; a way-board. No frame at the doors (it read as stocks).
- **Working face** (4x3, dead end, entered at the far end): the vein slabs (`ore-vein`) side by side across the whole end wall, or a muck pile where there is no vein mesh; heaps of broken ore at its foot; a cart waiting; the tool rack and a kibble against the side wall; a standing lantern.
- **Collapsed tunnel** (6x2, dead end): the roof down across the far end: the grey waste-rock heap grown to close the tunnel (the dungeon's rock fall reads as a mound of skulls from above), one per 9 ft of wall; the road runs under it; a cart caught and tipped; a fallen beam; smaller heaps thinning away from the fall; a warning board by the way in; ONE lantern.
- **Flooded gallery** (6x3): the floor IS the water (`floor-water-flooded`, the only floor). Timber props stand in it in two rows; what stopped the work is at the far end (the pump, else a fall); a cart half drowned; crates and barrels afloat.
- **Shaft head** (5x5, hub): the shaft in the middle of the floor (the timber collar; else the dungeon's open-pit flat; else a well); the winch beside it on the side away from the door; kibbles and tipped ore at the lip; from 4 cells a siding along a wall with no door, a loaded cart on it; lamp rack, pit props and the tool rack round the walls. **The ladder way is NOT rolled by the room**: a `ladder-wood` is a stair (`engine/core/stairs.js`: it opens the floor it reaches), so the building generator plans it, or it is put down by hand at the shaft ("Stairs down", `docs/VERTICAL.md`). No caves and no slopes: the shaft is a marker and the storeys do the rest.
- **Ore-sorting chamber** (6x5, uses): sorting tables down the middle (the middle one first, the walks drawn to it); ore in heaps along the far wall, like with like; a siding with loaded carts down one side from 3 cells; barrels, crates and a barrow round the rest.
- **Tool store** (4x3): the tool rack on the wall facing the door; more tools beside it; pit props, a barrow, a grindstone, a kibble; coats on pegs. (No axe in its block: it read as an anvil; no helmet rack: a weapon rack.)
- **Miners' mess** (6x4): one long table in the middle with a bench each side and food on it; the cook fire on the wall facing the door; two bunks at most (more reads as a barracks); kegs and pegs.
- **Powder & lamp store** (3x3, locked): the powder stacked on the wall facing the door and in rows along the walls; the lamps racked by the door, away from it; a sand bucket; ONE closed lantern by the door.
- **Crystal seam** (5x5, one door): the great crystal in the middle of the floor (on the far wall in a small room); the crystal vein across the wall behind; crystals growing along the walls; by the door a cart and the tools of whoever found it. Almost no lamp: the crystals are the light.
- **Pithead yard** (8x7, outdoor): the headframe over the shaft mouth in the middle (else a well-house); the winch; the stockpile in a row along one edge, timber along another; carts, a barrow, the cart shed from 42 cells; lantern posts; a way-board by the way in.
- **Smelter house** (5x4, fieldstone): the furnace on the wall facing the door with standing room before it; fuel and the quench trough beside it; ingots along one wall; ore by the door; a wash tub.
- **Light sources for the Alignment Bench**: `experiments/2026-10-11-types/min/BENCH.md`.
- **Whole mines**: `js/buildings.js` `BUILDING_TYPES.MIN` (carved, loops 0.4, pacing 0.5, two levels going DOWN; hub the shaft head, hall the tunnel, the seam the reward at the deepest dead end); `engine/test/buildings.test.mjs --code=MIN`.
- **Tests**: `test/min.test.mjs` (1,872 rooms, 144 legs, 10 whole mines; it also runs against a library with none of the mine's own meshes), `test/golden.mjs`.
- **Blind reads at table distance** (the live record, 4 reads a room): `experiments/2026-10-11-types/min/ROOM_READS.md`. Named every time: junction, shaft head, collapsed tunnel, sorting chamber, crystal seam, smelter house, flooded gallery (as flooded). Read as what they are without the name: the mess ("workers' quarters"), the powder store ("a storeroom"). Not reliable: the tunnel (three reads in four take the long room with rails for a wagon), the pithead on one seed (the headframe as a siege engine), the working face on one seed (vein slabs as cots), the tool store ("an armourer's workshop").

## Farmstead (sixteen room types, built 2026-10-11/12)

The humble end of the world: a peasant's one-room cottage, a farmhouse, its outbuildings and its plots. Catalog code `HUT`; Build → Fantasy → Farmstead. The rooms were first laid out from the library as it stood (the inn's, the stable's and the yard's meshes); the `hut-01` batch then added the signature pieces a farm is told by from above (nest boxes, a butter churn, a cheese press, a haystack, stooks, a scarecrow, a plough, a pigsty, bee skeps, bean poles, a sand box of roots, a grain heap, a dovecote) and the farm's own wall family. Programs: `solver2.js`, the appended `type:hut` block (source `experiments/2026-10-11-types/hut/integration/solver2_tail.js`). Farm meshes are sku tier `hut`, rolled only by these rooms (another type takes them by adding `hut` to its `tiers`).

- **Walls.** `wattle-daub` (new: cracked lime-washed daub between a sill beam and a wall plate, the wattle showing where the daub has fallen; corners, floors and family-keyed props borrow half-timber) for the cottage, the passage and most of the house; `half-timber` for the better farmhouse; `rough-timber` (with its log-cabin share) for the outbuildings; `fieldstone` for what is dug in or kept cool (root cellar, dairy). Each room type rolls among them by its wall seed (`FAMILY_ODDS`). Doors are plank doors; the hay barn's is the 10- or 15-ft barn door. In the game every farm room is **thatched** whatever its walls rolled (`ROOF_BY_TYPE`, `engine/core/height.js`).
- **Wealth: poor by default.** The cottage and the loft are `wealth: poor`: the fire on the floor, a straw pallet, three-legged stools, rushlights. The farmhouse rooms are `common`: a hearth in the wall, a bedstead, a trestle and benches. `room.wealth` or the solver option `wealth` (`poor` | `common`) overrides the type's: a `common` cottage gets its hearth in the wall and a bedstead.
- **Animals are figures, never props** (the figure set has cow, ox, pig, sheep, goat, chicken, mule, pony, dog, cat, and the scarecrow that walks). Byre, sty and coop are dressed empty and read by their stalls, troughs, nests and straw.
- **Graph roles and adjacencies for a building layout** (`walls.js`: `ROLES`, and the exported `HUT_USES`: what each room wants to touch, which stand apart, which lie above or below). The building generator's programme is `BUILDING_TYPES.HUT` (`js/buildings.js`): tree-shaped, by function, packed; ONE storey, a second only as the loft; the kitchen is the hub; outbuildings stand apart in the farmyard behind.

| room | role | uses (wants to touch) | where it stands |
|---|---|---|---|
| Cottage (one room) | hub | farmyard, garden, byre, root cellar | a building by itself |
| Farmhouse kitchen | hub | bedroom, passage, dairy, root cellar, loft, farmyard, garden | the house: everything opens off it |
| Farmhouse bedroom | terminal | kitchen | the house |
| Sleeping loft | terminal | kitchen, cottage | over the house (level +1) |
| Cross-passage | passageway | kitchen, byre, farmyard | between house and byre (a longhouse), or the back way out |
| Root cellar | terminal | kitchen, cottage | under the house (level -1) |
| Byre (cowshed) | mixed | passage, farmyard, barn | attached to the passage, or an OUTBUILDING |
| Chicken coop | terminal | farmyard, garden | OUTBUILDING, apart in the yard |
| Pigsty | outdoor | farmyard | apart in the yard (a plot, not a building) |
| Hay barn | mixed | farmyard, field, granary | OUTBUILDING, across the yard |
| Granary & threshing floor | terminal | barn, farmyard | OUTBUILDING (or the far end of a big house) |
| Dairy | terminal | kitchen, byre | attached behind the kitchen, or an OUTBUILDING |
| Vegetable garden | outdoor | kitchen, cottage | a plot beside the house |
| Field edge | outdoor | barn, farmyard | a plot beyond the yard |
| Orchard corner | outdoor | garden, farmyard | a plot |
| Farmyard | outdoor | cottage, kitchen, byre, barn | the open ground the buildings stand round |

- **Cottage** (4x4, hub; the most-used room of the type): the fire first. Poor: an open hearth on the floor a little past the middle, the pot on it, stools round it. Common: the hearth centred on the wall facing the door. THE bed in the far corner away from the door, head to the wall, a chest at its foot, a mat beside it (a second pallet only from 20 cells: two beds in a small room read as a lodging house). The table on the door's side of the fire with stools and supper; ONE corner heaped with stores, roots beside it; a shelf, garlic and herbs on the walls; pegs, tools and a bucket by the door; a rushlight. With two doors the loop between them is walked first, so nothing stands in the way through.
- **Farmhouse kitchen** (5x4, hub): the cooking hearth centred on the wall facing the door; ONE table in the middle, lengthways, a bench each side, food on it, a ham and onions hung over it; the settle in the chimney corner, the chair and the cat's basket by the fire; the dresser on a side wall, cupboard and work board on the other; flour bin, the butter churn by the dresser, stores in a corner; washtub and pegs by the door. The table goes down BEFORE the walks: they go round it.
- **Farmhouse bedroom** (3x3, terminal): the inn's guest-room program (`PROGRAM_OF`), dressed from the farm's recipe.
- **Sleeping loft** (4x3, terminal, poor): pallets in a row under the eaves, heads to the long wall, starting at the end away from the door; what keeps dry up here heaped at the other end (apples, grain, hay); onions strung from the rafters; the hatch with the ladder's head inside the door. No bedstead ever. (No full ladder: that mesh is a storey high.)
- **Cross-passage** (6x2, passageway; `THROUGH` + `DOOR_ENDS`): the way through, kept clear; nearly bare: cloaks on pegs, boots and a bucket inside the doors, a barrel or a sack against the wall, one lantern. (A bench read as a work table from above and made the passage a workshop: none.)
- **Root cellar** (3x3, terminal, fieldstone, no windows): store shelves centred on the wall facing the door, more down the sides; the sand box of carrots and beets; roots HEAPED on the earth floor (twice a kitchen's heap), low crates of them, barrels and crocks in a corner with the lantern set down on one; onions and a ham hung; the ladder by the door.
- **Byre** (5x4, mixed): the stable's stall rows and centre aisle with nothing of the horse about it (no saddle, blanket rail or farrier's stand); a milking stool and a pail of milk before every other stall; the muck barrow by the door; hay and feed in a corner.
- **Chicken coop** (3x2, terminal): nest boxes in a row along the wall facing the door (the three-box unit with its eggs; crates with a nest in each where that mesh is missing), more down one side; the roost perches on the other; feed trough, a sack of corn and a barrel with the egg basket on it by the door; straw scattered. (Not the straw-bedding flat: it is drawn as a made-up pallet with a blanket, and the coop read as a bedroom.)
- **Hay barn** (6x5, mixed): the inn's barn program (`PROGRAM_OF`): the clear drive and the wagon, the hay mow, pens, the tool wall.
- **Granary & threshing floor** (4x4, terminal): grain bins centred on the wall facing the door, bins and barrels along the walls, sacks (OPEN ones: a shut sack reads as a bedroll) in a corner or two; the MIDDLE is the threshing floor: kept clear, the heap of threshed grain on it with the winnowing basket, straw scattered, stooks and sheaves standing at its edge, the fork dropped beside it; the sieve on a barrel; the cat's basket, because of the mice.
- **Dairy** (3x3, terminal, fieldstone): cheese shelves centred on the wall facing the door, more beside them; the table in the middle with big cheeses and the day's milk; the butter churn by it; the cheese press against a wall; the brine trough; cheeses stacked on the floor to ripen; milk pails and the scalding tub by the door. No lantern hung over the table (from above it lies ON the table and read as an anvil).
- **Outdoor plots** share `hutPlot()`: which stretches are a building's wall, the gate, the edge kit laid on the open grid edges (the yard's code, the kind named by the room), the yard's thinning density target. An outdoor program that cannot place its key thing fails loudly (`hutPlotFail`).
  - **Pigsty** (4x3): wattle hurdles (or rails) all round and a gate; the trough inside the gate; the sty itself (the low stone shelter with its own walled yard) in the far corner, straw trodden out of it; the wallow is churned mud in the middle (dark patches, NOT the puddle flat: it is a turquoise pond and the sty read as a shrine round a magic spring); a slop bucket, roots, a second trough.
  - **Vegetable garden** (5x4): a wattle or picket fence and a gate; BEDS IN ROWS, long sides parallel, a 2.5-ft path between every two, two rows where the depth allows, one bed in four herbs; no bed lies across the straight way from the house door to the gate; compost in the far corner, the water barrel, the barrow inside the gate, a spade laid in a path, baskets of what was pulled; bean poles, bee skeps and the scarecrow at the far edge; berry bushes.
  - **Field edge** (8x5): the headland (the unploughed strip, 5 to 9 ft) along the near side with the cart, bales, sacks, a fork; stooks in a row at its edge, the scarecrow and the plough beyond them on bare ploughed ground (`floor-field-furrows`, laid straight so the furrows run on); the standing crop on the far part, patches laid edge to edge by measurement in bands; a lane through the crop to a gate in the far edge, or a verge along a side gate; the haystack at the headland's end; post-and-rail, wattle or nothing.
  - **Orchard corner** (6x5): fruit trees IN ROWS on a square grid (that is what makes it an orchard and not a wood), all the same size; crates and baskets of apples between the rows; a log to sit on, the barrow inside the gate, bee skeps at the far wall, the press and a barrel by the gate from 700 sq ft; a dry-stone wall, rails or wattle. No reserved path: you walk under the trees.
  - **Farmyard** (6x5): the well in the open, 5.5 ft clear of the straight way from door to gate, bucket and trough by it; at the house wall the woodpile with the chopping block, the water barrel; the kennel by the gate; the muck heap in the far corner; the cart at the open edge; bales under a scatter of hay; the haystack from 450 sq ft; woodshed or outhouse from 900, the dovecote from 1,100; mud by the well and in the gateway. Sparse: the middle stays open for turning a cart.
- **Sizes**: the passage is 6x2 (at 5x3 it was a room, not a way through); the coop 3x2 (at 2x2 the near wall hid the floor).
- **Tests**: `test/hut.test.mjs` (1,320 indoor rooms, 600 plots, 12 whole farms; no exclusive-tier mesh of another type rolled; no horse tack in the byre; a poor cottage's fire is on the floor and a common one's in the wall), `test/golden.mjs` (every older room type unchanged), `test/buildings.test.mjs --code=HUT` (720 of 720 plans keep every rule).
- **Blind reads at table distance**: `experiments/2026-10-11-types/hut/ROOM_READS.md`.

## Smithy & workshop (nine room types, built 2026-10-11)

Places where things are made. Wall families (none new): `fieldstone` for the fire rooms (forge, armourer, potter), `rough-timber` for the woodshop and the stock store, `half-timber` for the shop front, the quarters and the passage. Programs: `solver2.js`, the appended `smi:solver2` block (source `experiments/2026-10-11-types/smi/integration/programs.smi.js`). Every mesh of the batch is sku tier `smi`, rolled only by these rooms (the inn's front desk keeps its own counter; a mine or a castle that lists `anvil` or `coal-bin` keeps what it had). **The making side and the selling side share roles:** the workshop's finished-goods rack, its sword barrel and its sign ARE the market shop skeleton's `shop-shelf-stocked`, `shop-floor-stock` and `shop-sign`, in tier `smi`.

**The workshop skeleton.** ONE program (`smiWorkshop`) lays every workshop; the craft is one line of data (`SMI_CRAFTS`). In the order it is laid:
1. the **heat source** centred on the wall facing the door (forge, kiln); a craft with no fire has none;
2. the **workstation** one step (3 ft) in front of it (anvil, wheel), or in the middle of the floor where there is no fire (the carpenter's bench, across the room; the armour on its form), with 1.6 ft kept clear all round and standing room at the fire;
3. the walk from every door to the workstation, reserved before anything else stands;
4. **beside the heat**, on its wall: bellows one side, fuel the other;
5. **within reach** of the workstation: the quench trough (water) and the grindstone by the anvil; clay and a water bucket by the wheel; shavings and a sawhorse by the bench;
6. the **bench** against the side wall nearest the work, the **tool wall** hung over and beside it;
7. **finished goods** down the other side wall, repeating as the room grows (armour stands in ranks from 30 cells);
8. **raw stock** by the door (sawn boards lie along the wall), loose kit against the walls, wall lanterns.

A new craft is a workstation mesh and a line of data, not a new room: `docs/ASSETS_TO_BUILD.md` → Smithy & workshop.

Graph roles and adjacency, for the building generator (as the inn's rooms have them):

### Blacksmith's forge (`smi-forge`, 5x4; uses: `smi-stock`, `smi-armoury`, `smi-carpenter`, `smi-potter`; who counts: the smith and his striker)
- **Must:** ★ the forge on the wall facing the door, the anvil one step before it. **Grows:** bellows and coal bin beside the forge; quench trough and grindstone by the anvil; workbench and tool boards; racks of finished ironwork; bar iron and coal by the door.
- **Opens to:** the yard (horses come to it), the shop front, the stock store, the other workshops, the passage. Ground floor; an outside wall for the chimney. In a generated building it is the HUB, open to the street (below).

### Armourer & weaponsmith (`smi-armoury`, 5x4; uses: `smi-stock`; who counts: the armourer)
- **Must:** ★ a harness on its fitting form in the middle of the floor. **Grows:** the repair bench under the tool board; armour stands and weapon racks down the wall (stands in ranks from 30 cells); a spare stand and a grindstone within reach (no anvil: with one in the middle of the floor the room read as the forge); the sword barrel and shields by the door.
- **Opens to:** the forge or the shop front (it is reached through one of them), the stock store.

### Carpenter's woodshop (`smi-carpenter`, 5x4; uses: `smi-stock`; who counts: the carpenter)
- **Must:** ★ the workbench across the middle of the floor, room to walk round it. No fire. **Grows:** shavings and a sawhorse by the bench; the tool board; half-built and finished furniture down one wall; sawn boards stacked along the wall by the door, the offcut bin, firewood.
- **Opens to:** the yard (timber comes in long), the stock store, the forge or shop front.

### Potter's workshop (`smi-potter`, 5x4; uses: `smi-stock`; who counts: the potter)
- **Must:** ★ the kiln on the wall facing the door, the wheel one step before it. **Grows:** firewood and the clay bin beside the kiln; a water bucket by the wheel; the glazing bench; drying racks of pots down the walls; finished ware and big jars by the door.
- **Opens to:** the yard (a second kiln or the bloomery stands out there), the stock store, the shop front.

### Smith's shop front (`smi-shopfront`, 4x4; hub; who counts: customers)
- **A trade of the market's shop skeleton, not a program of its own:** `mktRegisterTrade('smi-shopfront', { tier: 'smi', … })` and `mktRegisterShop('smi-shopfront')` (Market & village → "Adding a trade"). So: ★ the smith's counter facing the street door with the keeper's lane behind it; racks of finished blades on the wall behind and down the sides; the display table of ironwork and a harness on its form in the floor before the counter; the sword barrel by the counter and by the door; weapon racks and armour stands as its own pieces; the shop window in the street wall and no other window. Its tiers are `['smi', 'mkt']`.
- **Opens to:** the street (its main door) and the forge. Known limit of the skeleton: a shop under 20 x 20 ft with a second door in the wall facing the street door has no wall for its counter (2 of 96 in the test).

### Stock store (`smi-stock`, 4x3; terminal; who counts: the craftsmen)
- **Must:** ★ store shelving on the wall facing the door, the bar iron beside it (with the bar iron first the room read as a workshop with benches). **Grows:** one kind after another round the walls, each beside the last (bar iron, shelving, coal, sawn boards, clay), corner stacks of crates, barrels and sacks, a tally desk by the door from 12 cells. No windows.
- **Opens to:** one workshop (the one that uses it), or the forge.

### Smith's yard (`smi-yard`, 6x5; outdoor: a room with no walls)
- **Must:** ★ the shoeing stocks in the open, turned to the gate (under 19 ft across: the hitching rail), the farrier's anvil, hoof stand and box within reach. **Grows:** hitching rails and the stone trough (water) by the way in; the smithy's sign and a lantern on the building wall by each workshop door, with that craft's things outside it; from 500 sq ft the bloomery at the edge with its coal; a cart, sawn boards, a spare wheel, firewood. Every door's way to the gate is kept clear.
- **Opens to:** nothing of its own: the forge, the woodshop and the potter open onto it. Ground floor, beside the forge.

### Smith's quarters (`smi-quarters`, 4x3; terminal; who counts: the household)
- The inn's guest room in half-timber walls (`PROGRAM_OF`). **Upstairs**, over the shop front or the stock store (never over the forge), reached by the passage's stair.

### Workshop passage & stair (`smi-passage`, 2x6; passageway)
- The inn's hallway in half-timber walls (`PROGRAM_OF`). Carries the stair to the quarters; joins the shop front, the forge and the back door.

**The whole building** (`js/buildings.js` `BUILDING_TYPES.SMI`; docs/BUILDINGS.md): a tree, by function, packed, **2 storeys**. The FORGE is the hub and stands open to the street (the stair core and the doors to the other rooms take its back wall, so the forge itself goes on a side wall); the shop front beside it at the street from 50 cells (the shop skeleton needs its back wall for the counter, so it is not the hub); the stock store off the forge; the armourer behind from 70 cells, the carpenter from 100, the potter in a wing from 140, each with a door onto the yard where it has an outside wall there; the smith's quarters fill the upper floor; the yard (5 cells deep) behind.
- **Tests**: `test/smi.test.mjs` (960 indoor rooms, 144 yards, 12 whole smithies; no workshop holds another craft's signature piece; every skeleton placement in the shop front is the smith's), `test/golden.mjs`, `engine/test/buildings.test.mjs --code=SMI`.
- **Blind reads at table distance**: `experiments/2026-10-11-types/smi/ROOM_READS.md`.

## Rooms that are not rectangles (the game, 2026-10-05)
The tuner draws rectangles. The game also makes L-shaped rooms (docs/UI.md, "Overlapping draws make L-shaped rooms") and furnishes them with this same solver, unchanged:
- The largest rectangle inside the room is solved as the room it is. The rest is solved as more of the same room with `annex: true`: no second key purpose, just zones, edges and light.
- Where two rectangles meet, each is given a **join**: an opening as wide as the meeting, kept clear like a doorway. A real door, when there is one, is the door that counts.
- `walls.perimeter` follows `room.cells` when a room has them; rectangles are untouched.
- Tests: `test/shaped.test.mjs`.

### Faction picker and inheritance (2026-10-13)

The user sees **Faction**, never flavor. Building `flavor` → room `recipe.flavor` → object `flavor`, with absent values inherited and explicit overrides retained. The existing room/building/piece ☰, command bar and first-per-type drag-out emblem offer all use the same logged command. Re-dressing swaps only existing faction slots and ordinary wall banners; transforms, pins, other furniture and deletions survive. Missing slots are suppressed reversibly, never filled by another faction. The Build Factions shelf exposes those gaps.

Discovery reads all `flavor-*` roles and their SKU `shape`, not a closed faction/slot list. `library.factions` decorates entries with `label`, optional `pieceLabel`, `group`, optional `aliases`, and optional `emblem` relative to the tuner; metadata maps and Task C's array entries are supported. The display name is faction first; buttress displays as **pier**, sigil as **floor sigil**, altarpiece as **altar piece**. New unknown slots append to the fixed shelf order. Fallback icons crop each faction's sigil. `chooseSku` resolves a single faction even for blind rolls outside a recipe's flavor wrapper, fixing Temple sun/moon mixing. Exact golden scene records: `test/faction-golden.json`.
