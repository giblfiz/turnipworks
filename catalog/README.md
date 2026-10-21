# Turnip Works Catalog — taxonomy v0 (fantasy core)

Draft 2026-09-30. Status: **v0.2 in review.** Harry's scale target is about 3,000 assets for the fantasy shelf; the notes' long-run library is 5k–15k.

## What this list has to serve

The notes set five jobs for every catalog entry, and each one becomes a field:

1. **Room recipes pick by role, not by name.** The scene is a nested recipe (settlement → building → room → object). A recipe asks for "a seat" or "a wall light" and a style family answers. So the unit of the catalog is a **functional role** (`chair-armed`), never a setting-bound noun (`tavern chair`). Genre packs later (Western, Victorian, sci-fi) re-skin the same roles.
2. **Assets carry their own placement semantics.** Wall-only, on-a-surface, hangs from the ceiling, snaps as a kit segment. The building generator can't furnish a room without them.
3. **Play needs affordances.** Fog and line-of-sight need to know what blocks sight. Tokens need to know what they can sit on, hide behind, open, or light. Named scene states (lights down, doors shut) need `open` and `lit` states.
4. **The factory has limits.** Image-to-3D (TRELLIS.2) wants one chunky, isolated object. Rugs, papers and stains are flat decals. Fire and water are effects. Thin things like chains, ropes and cobwebs are risky. Printing on the P1S also suffers from thin parts.
5. **Clean provenance.** The list is derived from what rooms *do* (see `room-recipes.md`), not from any product's catalog. No competitor catalog was consulted in building it; `research/dungeon-alchemist.md` was deliberately left unopened this session.

## Granularity rule (Harry, 2026-09-30)

**One line = one distinct mesh.** Big things can be roles with variants (a bed at three wealth tiers), but small handheld things are enumerated as objects: knife, fork and spoon are three lines; an apple, a pear, a pile of apples and a basket of apples are four; a bowl and a bowl of soup are two. The headline count is **distinct objects**. The variant-expanded SKU number is secondary bookkeeping, not the target.

## The model: role × family × variant

The important structural move: **most of Harry's settings aren't categories of objects at all — they're settings of a dial.**

- **Aristocrat vs. peasant hut** is mostly the *same roles* at a different **wealth tier**. A bed is a bed; the straw pallet, the rope bed and the canopy bed are `bed` at poor / common / noble. So `wealth` is a variant axis (`p`/`c`/`n`), not three separate lists.
- **Ruins** is mostly a **condition** applied to castle, temple and manor roles (`ruin` variant), plus a small set of roles that exist *only* in ruins (rubble, fallen column drums, overgrowth).
- **Tavern, dungeon, mine, blacksmith** are real **function clusters**. They get signature roles (bar counter, cell bars, mine cart, anvil) and borrow everything else.
- **Castle** is a *settlement-scale* container: great hall, barracks, armory, chapel, dungeon. It mostly composes other clusters.

So an asset SKU = **role** (what it does) × **style family** (what it looks like: rough timber, dressed stone, noble plaster…) × **variants** (wealth, ruin, open/closed, lit/unlit, full/empty). The catalog lists roles and says which variant axes apply. `catalog_tool.py` multiplies them out into a SKU estimate.

## Tree

Top level is **function domain**, because that's how a human browses and how a style board batches (a board for "food", a board for "metal tools"). Placement is a *tag*, because that's what the engine queries.

- **A Structure** — snap-kit pieces: walls, floors, openings, stairs, supports, roofs, barriers
- **B Fixtures** — room anchors placed first: hearths, counters, forges, altars, wells, privies
- **C Furniture** — seating, tables, beds, storage furniture
- **D Containers** — chests, barrels, crates, sacks, baskets, coffins
- **E Lighting** — every light source; all of them drive fog and scene-state cues
- **F Table & kitchenware** — surface clutter for eating, drinking, cooking, games
- **G Food & provisions**
- **H Trades & work** — smithing, carpentry, textile, farming, mining, scholarship, alchemy
- **I Military** — arms, armor, training, siege, defenses
- **J Dungeon, prison & traps**
- **K Religious & funerary**
- **L Noble décor & leisure**
- **M Outdoors & settlement** — street furniture, vehicles, livestock dressing, camp
- **N Nature & cave**
- **O Ruin & debris**
- **Render sets** (`sets.md`) — pre-assembled groups (table set for dinner, table mid-feast, stocked shelf) baked locally from library objects to cut **runtime draw calls**. They're added to the library alongside their members, never replacing them, and don't count toward distinct objects.
- **Q FX & decals** — not meshes; listed so recipes can ask for them and the factory skips them
- **R Magic, cults, lairs & puzzles** — the D&D-critical layer that turns a building into an adventure site
- **S / T / U expansions** — trades & village, loot & gear, environment breadth (`expansion-*.catalog.md`)

## Line grammar and legend

```
- **role-id** — description · place · fp · size · mat · set · var · aff · gen · P# · usage hint
```

| field | values |
|---|---|
| **place** | `kit` snaps to grid edges/cells · `floor` · `wall` mounts on a wall face · `ceiling` hangs · `surface` sits on a table/shelf/counter · `ground` outdoor terrain · `attach` hangs from a socket on another asset |
| **fp** (5-ft grid *occupancy*: which squares the object claims; small props on a table claim none, their table does) | `tiny` hand-sized · `sub` smaller than a cell, several share one · `1` · `1x2` · `2x2` · `2x3` · `3x3` · `big` · `edge` wall-edge segment |
| **size** | `size:WxDxH[~MIN-MAX]`: nominal real-world bounding box in **inches** (width × depth × height). The optional range is proportional scale multipliers the placement engine may use; a barrel `size:22x22x34~0.7-3.5` runs from about 2 ft to 10 ft. No range means rigid and human-scaled (±10%): chairs, doors, stairs, cutlery, tools. The engine scales each generated mesh to its nominal size (TRELLIS outputs arrive normalized). Size is **independent of fp** (Harry, 2026-09-30). |
| **mat** | style-board family: `wood` `metal` `stone` `ceramic` `cloth` `glass` `food` `organic` (hay, bone, leather, wicker, plants) `paper` `mixed` |
| **set** | `TAV` tavern/inn · `DUN` dungeon/prison · `MIN` mine · `CAS` castle/keep · `NOB` aristocrat/manor · `RUI` ruins · `HUT` peasant hut/farmstead · `SMI` blacksmith/workshop · `TEM` temple/chapel · `CRY` crypt/tomb · `MKT` market/street/village · `ARC` wizard/alchemist/library · `CMP` camp/wilderness · `LAI` monster/dragon lair · `GRV` druid grove/fey · `CLT` cult sanctum · `ANY` ubiquitous. All are first-class (Harry, 2026-09-30: lean into what a D&D game needs). **`!` = signature**: this object *tells you* where you are. |
| **var** | `shape` three distinct silhouettes so repeats don't read as copies · `wealth` poor/common/noble · `ruin` broken/decayed version · `open` open/closed · `lit` lit/unlit · `fill` empty/full · `size` s/m/l · `pile` single/cluster · `-` none |
| **aff** | `sit` `sleep` `open` `lit` (light source, fog-relevant) `block` (blocks movement) `los` (blocks sight) `cover` (half/¾ cover) `climb` `hide` `loot` (searchable) `carry` (a token can pick it up) `use` (workstation / interactable) `hazard` `trap` `pass` (traversal: door, stair, ladder) `-` |
| **gen** | `mesh` TRELLIS default · `kit` modular, snap edges must be protected from decimation (12k tier) · `thin` mesh with fragile thin parts: needs a chunky style or a hand pass · `flat` **2D** — decal, card or billboard (pages, cards, rugs, banners, cloth hangings, stains, grass and vine cards); never sent to TRELLIS · `fx` particle/shader · *(compounds moved to `sets.md`)* |
| **open_of:** *(optional, 2026-10-02)* | this line is the OPEN state of another object (two-state swap mesh, e.g. `open_of:chest-ironbound`); the closed object must carry `var:open` and the same `place`. Open states are not placed by room recipes; they ride their closed object. See `objects-open-states.catalog.md` |
| **mount:** *(optional, 2026-10-02)* | inches from the floor to the bottom edge of a wall-mounted object; **required** for `wall` + `tiny` + `aff:lit` (wall lights). Optional tagged fields may sit anywhere after the description |
| **P#** | `P1` enough to dress every **real** room of each core building (tavern kitchen, cellar and stable, not just the common room); each slot of a P1 room needs ≥3 P1 options (Harry: "the kitchen is real, and will need at least a few veggies") · `P2` full core coverage · `P3` flavor and long tail |

## Style families for Structure (A)

Kit roles get realized per family. P1 builds three (Harry, 2026-09-30): **rough-timber**, **dressed-stone**, **cave-rock** — together they cover tavern, hut, castle, dungeon and mine. The full set of seven: **rough-timber** (plank, log), **half-timber** (wattle-and-daub, beams), **fieldstone** (dry-laid, peasant and ruin), **dressed-stone** (castle, temple), **noble-interior** (plaster, wood panel, marble floor), **cave-rock** (mine and natural dungeon), **cut-rock** (hewn dungeon and crypt). A structural role × 7 families is where most of the count comes from, which is why structure is listed once rather than per setting.

## Out of scope for this shelf

Creatures and character minis (a separate STL→GLB and HeroForge path). **Animals are never live props** — but animals in states of being prepared to eat (hung, plucked, spitted, butchered) are food props (Harry, 2026-09-30); ships and docks (the next pack); anything gunpowder or clockwork beyond a fantasy blasting-powder keg.

## Files

- `fantasy-core.catalog.md` + `expansion-*.catalog.md` — the list (the tool reads every `*.catalog.md`)
- `room-recipes.md` + `rooms-*.md` — the functional derivation: rooms → slots → roles
- `objects-lighting.catalog.md` (wall/floor lights and open fires, all generated UNLIT), `objects-open-states.catalog.md`, `objects-inn-kit.catalog.md` — added for the inn-02 batch
- `../src/catalog_tool.py` — parses and validates both, checks recipe coverage, renders `out/`
- `out/simple-list.txt` — plain names by domain (what Harry asked for)
- `out/by-setting/*.txt` — "what can I use in a tavern" pick lists, signature items first
