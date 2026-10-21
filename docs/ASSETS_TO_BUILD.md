# Assets to build

A living wishlist: things a room grammar asked for and the library could not give it. Grouped by purpose. Add to it whenever a grammar leaves a slot empty; strike a line when its mesh ships.

**Status, 2026-10-05 (evening):** the Outdoors batch ran. 53 of 54 meshes shipped (`experiments/2026-10-05-yard-props/`, library source `outdoors-02`, $0.76 on RunPod) and the remaining ground textures were made on the free Codex image route (`experiments/2026-10-05-outdoors/`). A line marked **shipped** has a mesh in the tuner and the game; what is still wanted is collected under **Still to build** at the end of the Outdoors section.

How to read a line:

- **sku**: the proposed mesh name. The part before `--` is the catalog role; after it, the variant (`--s` small, `--l` large, `--s1` a shape).
- **place**: the catalog's placement type. `ground` stands outdoors, `kit` snaps to a 5-ft grid edge, `wall` mounts on a wall face, `floor` stands anywhere, `flat` is a 2D image (never sent to the 3D generator).
- **size**: width × depth × height in inches, the catalog's convention.
- **catalog**: *has a line* means the role was already in `catalog/*.catalog.md` and only lacks a mesh; *new* means the line was added on 2026-10-05 in `catalog/objects-outdoors.catalog.md`.

## Outdoors

Started 2026-10-05 with the Yard room (`tools/spawn-tuner/ROOMS.md` → Outdoors). The yard is dressed today only from meshes that exist. Its recipe (`tav-yard` in `catalog/rooms-inn.md`) names everything below in its `plants`, `edge`, `furnish` and `dress` slots, so **a mesh that ships under one of these roles appears in yards by itself**: the `plants` slot especially (2–4 bush or tree picks by the edges and doors) is empty until then.

### Risk first: leafy things are hard for the 3D generator

**Result (2026-10-05): trees work.** The test five all passed, and so did all ten trees. Each test tree was made twice, with the plain house-style prompt and with the "storybook canopy of five to seven chunky leaf clumps" prompt: both passed (Gemini, blind, on each: a tree, confidence 0.98, trunk meeting the ground, foliage as rounded clumps, no defects; one note of "visible sharp shell edges" on the plain broadleaf), so the chunky prompt was used for the rest and both versions ship. Two things to know: the generator makes trees about as wide as they are tall, so a "30-ft" tree would have a 28-ft crown (they ship smaller: see the sizes below); and a plate must ask for no ground disc, foliage as solid masses, and nothing blue (the key colour). The paragraph below is the risk as it was written before the test.

Image-to-3D wants one chunky, isolated object. A tree is thin branches and thousands of leaves: the usual failures are a canopy that comes out as one smooth blob or as a spiky shell, leaf islands floating free of the trunk, a background matte that eats the gaps between branches, and a mesh that looks fine from the side and like a green disc from above (the table's camera is mostly above).

**Test five before any batch:** `tree-deciduous--s`, `tree-fruit--s`, `tree-birch--s`, `bush--s1`, `hedge-straight--low`. Pass means, for each: the canopy reads as leaf masses, the trunk is its own shape and meets the ground, nothing floats, the matte is clean, and it still reads as a tree from 60° above. If trees fail and bushes pass, ship bushes and hedges and keep trees on the list. Things to try before giving up on a species: ask for a "chunky, clustered canopy of a few big leaf clumps" in the plate prompt (a storybook tree, not a botanical one); generate trunk and canopy as two meshes and join them; for small plants only, crossed flat cards (`grass-tall` and `flowers-wild` are already flat in the catalog).

### Trees (three species, two sizes each)

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `tree-deciduous--s` `--s2` | young broadleaf tree, 11 ft with a 9–10-ft crown | ground | 122×122×132 | a tree at the yard's open edge; the everyday plant pick | **shipped** (two shapes) |
| `tree-deciduous--l` | full broadleaf tree, 20 ft with an 18-ft crown | ground | 223×223×240 | **the yard's focal thing** ("a well, or a big tree once trees exist"): the grammar rolls for it | **shipped** |
| `tree-fruit--s` `--s2` | young apple tree, 9 ft | ground | 100×100×108 | kitchen gardens; reads from above (round, low) | **shipped** (two shapes) |
| `tree-fruit--l` | old apple tree with a spreading crown, 13 ft across | ground | 156×156×139 | inn yards and orchards; a bench goes under it | **shipped** |
| `tree-birch--s` `--s2` | slender young birch, 17 ft with a 7-ft crown | ground | 83×83×204 | a narrow tree for small yards and beside gates | **shipped** (two shapes) |
| `tree-birch--l` | tall white birch, 22 ft (its crown came out 12 ft wide: not slender) | ground | 145×145×264 | height without a wide crown; clusters of three | **shipped** |
| `tree-oak-great` | broad spreading oak, 26 ft across and 20 ft tall | ground | 312×312×234 | the focal tree of a big inn yard or village green | **shipped** (fits only yards over about 35 ft each way) |

### Bushes and shrubs

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `bush--s1` `--s2` `--s3` | round garden bush, three silhouettes | ground | 40×40×36 | the yard's commonest plant pick: flanking a door, along an open edge | **shipped** (three shapes) |
| `bush-berry` | berry bush | ground | 36×36×36 | kitchen gardens; something to forage | **shipped** |
| `planter-barrel--s1` `--s2` | half barrel planted with flowers | ground | 26×26×30 | either side of an inn's door: the cheapest way to say "this door is looked after" | **shipped** (two shapes) |
| `planter-stone` | stone planter with a shrub | ground | 24×24×36 | forecourts, front desks | **shipped** |
| `flowerbed` | cultivated flowerbed | ground | 60×60×18 | against the building wall under the windows | **shipped** |
| `flowerbox-window` | window box of flowers on brackets | wall | 42×9×12, 30 off the ground | under the windows of the wall facing the yard | **shipped**; the grammar does not hang it yet |
| `trellis-vine` | wall trellis with a climbing plant | wall | 48×8×84 | dresses a long bare building wall; thin lattice, test first | **shipped** (the lattice held: the vine covers it) |

### Hedge sections

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `hedge-straight--low` | clipped hedge, waist to chest high, one 5-ft section | kit (edge) | 60×24×40 | the yard's **hedge** edge option | **shipped** at 60×22×38 |
| `hedge-corner` | hedge corner | kit (edge) | 60×60×60 | an L-shaped corner, for hand-built hedges | **shipped** at 60×60×38; the yard uses `hedge-end-block` at its corners |
| `hedge-gap-arch` | hedge section with a walk-through arch | kit (edge) | 60×30×84 | the gate in a hedged yard | **shipped** at 60×26×68 |

### Grass and small growth

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `decal-grass-tuft--s1…s4` | tuft of longer grass, clover or daisies, from above | flat (ground) | 36×30 | scattered over grass so a lawn is not one flat green | new; **made 2026-10-05** |
| `decal-grass-worn--s1…s3` | patch of lawn worn to pale earth | flat (ground) | 48×36 | scattered thinly over grass | new; **made 2026-10-05** |
| `grass-tall` | tall grass clump, crossed cards | flat (ground) | 30×30×30 | along open edges and fence lines | has a line |
| `flowers-wild` | wildflower patch | flat (ground) | 30×30×14 | by the edges, with the bushes | has a line |

### Low fence sections and a gate

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `fence-post-rail` | post-and-rail fence, one 5-ft section | kit (edge) | 60×6×48 | the yard's **low fence** edge option; stable yards and paddocks | **shipped** at 60×7×40 |
| `fence-wattle` | woven wattle fence | kit (edge) | 60×4×42 | kitchen gardens | **shipped** at 60×5×36 |
| `fence-picket` | picket fence | kit (edge) | 60×3×40 | tidy forecourts | **shipped** at 60×4×38 |
| `fence-post-corner` | stout corner or end post | kit (edge) | 8×8×48 | closes fence runs at corners and either side of the gate | **shipped** at 9×9×46 |
| `gate-fence` | small field gate (open and shut) | kit (edge) | 48×4×42 | **the gate** of every fenced yard | **shipped** at 48×5×40, closed; an open twin is still wanted |

### Stone wall sections

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `wall-drystone` | low dry-stone wall, one 5-ft section | kit (edge) | 60×24×36 | the yard's **stone wall** edge option | **shipped** at 60×18×33 |
| `wall-drystone-gate` | wall section with a gap and stone piers | kit (edge) | 60×24×42 | the gate in a walled yard | **shipped** at 60×20×39 |
| `gatepost-stone` | stone gateposts with finials | ground | 30×30×72 | a grander gate for forecourts | **shipped** (one pier); not placed by the grammar yet |

### Yard furniture

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `table-picnic` | plank table with attached benches | ground | 72×60×30 | the beer garden: the one thing an inn yard has that we cannot fake with indoor tables | **shipped**; inn yards over 500 sq ft set one out from the door |
| `sign-post-inn` | free-standing post with a hanging inn sign | ground | 36×8×108 | at the gate, facing the road | **shipped**; rolled against the notice board by the gate |
| `signpost` | crossroads signpost | ground | 24×24×84 | by the gate of a forecourt | **shipped**; not placed by the grammar yet |
| `log-seat` | log bench | ground | 72×16×16 | around the fire pit | **shipped**; the fire pit's first choice of seat |
| `well-house` | roofed well with a windlass | ground | 60×60×120 | a second focal thing, so not every yard has the same well | **shipped**; in the anchor slot, not yet in the focal roll |
| `hitching-post--s2` `--s3` | hitching rail, two more shapes | ground | 72×6×40 | we have one (inn-01); stable yards place several | **shipped** (three shapes now) |
| `sawhorse` | sawhorse with a plank | floor | 40×24×30 | by the woodpile | **shipped**; not placed by the grammar yet |
| `axe-woodcutter` | felling axe | floor | 34×10×2 | leaning on the woodpile; thin, test first | **shipped** (reads as a hatchet, lying flat); not placed by the grammar yet |
| `dog-kennel` | small plank kennel, no dog | ground | 30×40×30 | by the gate | **shipped**; one yard in three (at table distance it reads poorly: Gemini called it a workbench and a beehive) |

*We already have:* the chopping block with its axe (`chopping-block`, inn-02), the woodpile (two shapes), the well, the hitching rail (one shape), the hanging sign (three shapes), lamp posts (`lantern-post`, `lamp-post-wood`), troughs, the rain barrel, the hand cart, the outhouse, the woodshed and the cart shelter. The yard uses all of them.

### Kitchen garden and wash day

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `trade-herb-bed` | herb bed with labels | ground | 36×96×10 | "outside a kitchen: a rain barrel, crates, and herbs later" | **shipped** (reads as a planter of succulents, 2.6 ft tall) |
| `vegetable-patch` | tilled rows with sprouting crops | ground | 60×110×12 | the kitchen garden itself | **shipped**; kitchen yards roll this or the herb bed on the open edge |
| `garden-tools-leaning` | spade, rake and hoe leaning together | wall | 24×10×60 | one chunky mesh in place of three thin ones; by the kitchen door | **shipped** |
| `hoe`, `rake`, `spade-garden`, `watering-can`, `trowel-garden` | single garden tools | floor / surface | small | singly, for tool walls; long handles are thin, so the bundle above comes first | **shipped**: rake, spade, watering can, trowel. **`hoe` rejected** (both meshes broke into floating pieces) |
| `compost-heap` | slatted compost bin | ground | 48×48×30 | the far corner of a kitchen garden | **shipped** |
| `clothesline` | washing line between two posts, with linen | ground | 120×12×72 | wash day beside the washtub; thin rope, test first | **shipped** (the rope and linen held as one solid piece) |

### Ground textures (flat images, free route)

| sku | what | place | size (in) | why it is wanted | catalog |
|---|---|---|---|---|---|
| `floor-grass` (+ `--v2…v4`) | short trodden yard grass | flat (ground) | 60×60 | the yard's default ground | new; **made 2026-10-05** |
| `floor-gravel--c1` `--c2` | raked pea gravel | flat (ground) | 60×60 | forecourts and drives | new; **made 2026-10-05** |
| `decal-path-worn--s1…s4` | stretch of trodden earth, soft-edged | flat (ground) | 60×48 | **the path from door to gate.** The grammar lays it by itself | **made 2026-10-05** (four shapes); Gemini, blind: "a worn dirt path" |
| `dirt-path-tile` | dirt path tile (straight, bend, fork) | flat (ground) | 60×60 | a drawn path that follows the grid, for forecourts | has a line |
| `floor-grass-worn` | grass worn to bare earth in patches | flat (ground) | 60×60 | busy yards and paddocks | **made 2026-10-05** (one variant; a yard's Floor select offers it) |
| `floor-grass-meadow` | longer grass with small flowers | flat (ground) | 60×60 | gardens and orchards | **made 2026-10-05** (one variant) |
| `floor-cobble-mossy` | old cobbles with moss in the joints | flat (ground) | 60×60 | back yards; we have plain `floor-cobble` | **made 2026-10-05** (one variant) |

Notes from making the two that exist. A grass texture tiles cleanly with itself, but mixing its variants shows the 5-ft grid (Gemini: 2 of 5 with rotation, 3 of 5 with matched borders), so grass lays one variant straight and relies on the scattered tufts for variety. Fine even noise like gravel mixes invisibly once its variants share a border (`edge_match.py`). A grass image must be keyed on magenta or blue, never green.

### What else the yard grammar wanted and could not find

- ~~**An edge kit.**~~ **Done 2026-10-05.** Five kinds have all three pieces (a straight section, a piece that ends or turns a run, a gate) and the yard rolls one of them or none: post-and-rail, picket and wattle fence (`fence-post-corner`, `gate-fence`), hedge (`hedge-end-block`, new; `hedge-gap-arch`), dry-stone wall (`wall-drystone-pier`, new; `wall-drystone-gate`). Rules in `tools/spawn-tuner/ROOMS.md` → Outdoors.
- **A sign board flat to the wall.** `price-board`'s mesh is an easel about 1.7 ft deep, so hung on a wall it floats. Either a `price-board` variant that is a flat board, or stand the easel on the ground by the door.
- ~~**A second woodpile size.**~~ **Shipped 2026-10-05** as its own catalog object, `woodpile-long` (96×20×40), so it never lands by an indoor hearth; a yard with 22 ft of building wall stacks one long pile in place of two short ones.
- **Soft edges for decals the layout places** (an engine job, not an asset): floor decals laid by the floor (hay and dirt scatter, the new grass tufts) are alpha-blended in the tuner and the game; decals placed by a room's layout (hay by the stable door, the future worn path) are blended in the tuner but cut out hard in the game.

### Fixes found on the way (data, not meshes): both done 2026-10-05

- `bounty-poster` and `proclamation-scroll` listed their height as depth, so indoors they hung as slivers. The catalog lines now read `11x0.1x15` and `14x0.3x20`.
- `catalog_tool.py --fix-tags` matched exactly four fields before `set:`; the lines have five or six since `size:` and `mount:` arrived, so it matched nothing and still printed "added". It now takes any number of fields, counts what it changed, and exits 1 naming any object it could not edit.

### Still to build (Outdoors), after the 2026-10-05 batch

| what | why |
|---|---|
| `hoe` | rejected twice: a single thin tool breaks apart. Try it leaning in a bucket, or leave it to the bundle |
| `gate-fence-open` | the field gate ships closed; at table distance a closed gate reads as more fence (Gemini did not find the gate in two fenced yards until shown a close view). An open twin, or a hinge record on the Alignment Bench |
| `dog-kennel` again | reads as a doghouse alone, not in a yard: bigger, with a plainer arched door |
| `grass-tall`, `flowers-wild` | crossed flat cards: there is no route for standing flats yet (floor decals and wall images only) |
| `dirt-path-tile` (straight, bend, fork) | a drawn path on the grid, for forecourts: a design job (three pieces that must join), not attempted |
| a flat `price-board` | the mesh is an easel; hung on a wall it floats |
| second variants of `floor-grass-worn`, `floor-grass-meadow`, `floor-cobble-mossy` | one variant each: Gemini saw the same landmarks repeat (3–5 of 5) where plain grass scores 2 of 5 |
| a slender `tree-birch--l` | the tall birch came out 12 ft wide |
| grammar, not assets | the window box (hangs under a window: the wall-hanging rule avoids windows), `well-house` in the focal roll, `gatepost-stone` pairs at a forecourt gate, `signpost`, `sawhorse` and the axe by the woodpile, hitching rails in a row, a choice of edge in the room menu (today it is rolled by the seed) |

## Crypt

### What shipped (2026-10-05, library source `crypt-01`)
73 meshes for $0.97 on RunPod (`experiments/2026-10-05-castle-crypt-mansion/crypt/QA.md`): the `crypt-stone` wall kit (two plain panels, doorway, three burial-niche panels, two skull walls, a sealed door), the iron gate and the oak door leaf, three sarcophagi with two open twins, coffins (one open), the knight's effigy, altar, bier and pall, embalming slab (empty and with a body), bone shrine, reliquary shrine, weeping angel, draped urn, skull and bone heaps, bone racks, pillar, trough, urns, canopic jars, nine lights, and the small ritual pieces. Flats: `floor-tomb-slabs` and `floor-bone-strewn` (four variants each), loose-bone and grave-ledger decals, two moss decals, the altar cloth, seven room icons. Four roofing textures came with the same flats run.

### Still to build (Crypt)

| what | why |
|---|---|
| `tomb-slab` | plate rejected twice (a base slab painted under it). The vault uses the flat `decal-grave-ledger` instead |
| `skull-pile--s2` | plate rejected twice (a grid of skulls on posts, not a heap). Skull heaps are the most repeated piece and there is ONE mesh: Gemini called two heaps "identical assets" |
| ~~`rite-bone-candelabra`~~ | SHIPPED 2026-10-06 (painted later the same night): on the chapel altar and the ossuary's first bone trough |
| `wall-crypt-niches` that read as BURIAL (the one thing between the catacomb and its name) | at table distance all three versions read by turns as shelves of books or scrolls ("tomb-library"), barred cells ("prison block"), shelves of sacks, and burial niches; the catacomb is named a catacomb only when they are taken for body storage (about 7 in 10 at 10x3). Wanted: fewer, larger recesses (two a panel), each with a whole pale SKELETON or a skull row lying in it, bone-white against dark stone, nothing bundle- or scroll-shaped, no bars or grilles |
| `rite-funeral-pall` again | the red-and-gold pall reads as a throne or a draped banquet table from above (the chapel became a throne room). The chapel now lays a coffin on the bare bier. Wanted: black or undyed cloth, the coffin's shape plain under it |
| `ossuary-shrine` again (the mesh is no longer placed anywhere) | from above it reads as a throne ("bone throne", "undead throne room"), its painted candles as gold. Wanted: a wall of stacked skulls with a low offering shelf, no backrest shape |
| `ossuary-wall` with skulls that read | at table distance the two panels read as a carved block and as green panels. Fewer, bigger skulls in rows |
| `catacomb-shelf-bones--s1` again | reads as a bookcase of scrolls |
| `sarcophagus--s3` again | reads as a big banded chest (olive-brown, no lid figure) |
| `urn-decorative--s2` again | reads as a barrel |
| `candle-drippings-mound`, unlit colour | pale yellow wax reads as a heap of gold coins; it is used only at a monument's foot now |
| open twins for `sarcophagus--s2`, `--s3`, `coffin--s2` | only the s1 designs can stand open |
| `statue-deity`, `holy-symbol-sun` | in the chapel recipe, no mesh. (`pew`, `lectern` and `tome-holy` arrived with the castle; the chapel of rest keeps its stone benches and takes no lectern: its reads were made that way) |
| `decal-moss--s1` (the wall-foot strip) | rejected (drawn as flowers) |
| vault treasures: `crown`, `scepter`, `orb-regal`, `helm-great`, `shield-kite`, `necklace-jeweled` | royal-tomb recipe roles with no mesh |
| a graveyard | the outdoor room (`cry-graveyard`) was not designed: gravestones, iron fence, mausoleum front |
| grammar, not assets | a door-side preference so the door faces the altar; `room.panels` are not mapped onto the parts of an L-shaped room; a whole crypt from the building tool has two outside doors |

## Castle

### What shipped (2026-10-06, library source `castle-01`)
115 meshes (`experiments/2026-10-05-castle-crypt-mansion/castle/QA.md`; the three types and the kit together cost $3.07 on RunPod): the `castle-rough` wall kit (two plain panels, doorway, arrow slit), a stained-glass panel in dressed stone, `cell-bars`, the portcullis and its raised twin, the curtain wall and its turret, the timber double gate and the iron-bound door leaf; two daises, two feast tables, the high seat, throne, great hearth, 11-ft cooking hearth, great prep table, cauldron crane, pig on a spit; pews, lectern, font, prayer-candle rack; footlocker (and open twin), racks, three armour stands, pavise, shield stack, spear tripod, crossbow rack, helmet pegs; rack, iron maiden (and open twin), cage, stocks, pillory, block, manacles, plank bed; windlass, lever, sentry box, signal beacon, oil pot, ballista, quintain, catapult stones, archery target, training pieces; banner poles, round pillar, heraldic shields and smalls. Flats: `floor-flagstone-rushes`, `floor-setts-courtyard`, `floor-sand-training`, banners, tapestries, the royal runner, linen, blood, a drain grate. Nine rooms: `tools/spawn-tuner/ROOMS.md` → Castle; blind reads: `experiments/2026-10-05-castle-crypt-mansion/castle/ROOM_READS.md`.

### Still to build (Castle)

| what | why |
|---|---|
| `door-cell-bars` and `door-cell-bars-open` | REJECTED: the panel came out nearly square twice (0.91 and 0.88 wide:tall against 0.56). A new plate with the TALL, NARROW sentence would probably cure it; the open twin's mesh passes and waits for it. Until then the dungeon's cell door is the crypt's `crypt-gate-iron` (4 ft in a 5-ft half front; it reads: "barred gate", dungeon 4 of 4) and one cell in five stands open as a gap |
| `table-experiment`, `archery-target--s2`, `armor-chainmail-heap`, `axe-hand`, `mortar-large-stone` | never painted (the plate gate refused each twice). No program depends on them |
| **something that says "the way through" for the gatehouse** | the one castle room that does not pass (named a gatehouse in about half the reads, a "castle guardroom" otherwise). Wanted: a murder-hole ceiling panel or floor grate, cart ruts or a paved carriageway as a floor strip, a drawbridge end; and a portcullis whose arch is the thing (the grille reads as "a barred gate": a cell) |
| `table-feast--s2` again | its top is GREEN: five of them were "gaming tables, likely for billiards". Used only as the high table on the small dais now. Wanted: dark wood or white linen |
| `chandelier-ring--great` (any ring chandelier) seen from above | "a wagon wheel on the floor", "a round floor grate". Not hung in the great hall any more. Wanted: lit candles that read as light, or a canopy shape; or a rule that the table camera fades what hangs |
| `windlass` again | "a wooden contraption with a crank", "a treasure chest", "a forge". Wanted: a drum with a thick rope or chain running up |
| `cook-hearth-spit--great` | "a forge" in half the reads of both kitchens; wanted: a visible spit with a joint on it and pots at the kerb |
| `bread-oven` (inn mesh) | "a large blue bellows", "a kiln": dropped from the castle and mansion kitchens |
| `dais` | at 16 in it is not seen from above, and the mesh is 32 in at its own proportions (flattened 2x by the box); a dais with a carpet or a contrasting top would read |
| arrow-slit wall and `cell-bars` re-plates | both squeezed a quarter in width at the box (inside the kit rule; invisible at table distance) |
| `skeleton-chained`, `spear-bundle`, `armory-rack-filled`, `weapon-rack-enchanted`, `mil-arrow-sheaf`, `mil-ballista-bolts`, `mil-siege-ladder`, `mil-watch-rattle`, `mil-horse-barding-stand`, `cage-hanging`, `flail`, `morningstar` and the feast smalls | named by the recipes, in no batch |
| grammar, not assets | a sand patch, tourney rails and the quintain in the courtyard's training corner (pieces exist, not laid); a per-room-type `tall` default (the great hall is one storey when made) |

## Mansion

### What shipped (2026-10-06, library source `mansion-01`)
119 meshes (`experiments/2026-10-05-castle-crypt-mansion/mansion/QA.md`), 27 of them tier `fine` (rolled only by mansion rooms: tier `noble`): wall families `noble-panel` (two panels, doorway, window and open twin), `noble-paper` (two panels, window and open twin), `conservatory` (one glazed panel, doorway), a new `noble-interior` doorway; three door leaves (panelled, glazed, the walnut double door); the grand stair is the kit's. Marble fireplace, state bed, two mahogany dining tables and their chairs, sideboard, china cabinet and bureau (each with an open twin), sofa, settee, salon chairs, partners' desk, library table, ladder bookcase and a fine bookshelf, billiard table, harpsichord, harp, two grand chandeliers, gilt pier mirror, long-case clock, hall stand, consoles, commode, washstand, gown on a form, telescope, globe; two fountains, wall fountain, lily pond, birdbath, gazebo, statues, topiary, parterre, roses, palms, ferns, citrus tubs, plant stands, potting bench, garden urns. Flats: `floor-marble-cabochon`, `floor-parquet-versailles`, `floor-tile-encaustic`, `floor-lawn-mown` (never rotated: its stripes are imposed), still lifes, tapestries `--s3`/`--s4`. Ten rooms: `tools/spawn-tuner/ROOMS.md` → Mansion; blind reads: `experiments/2026-10-05-castle-crypt-mansion/mansion/ROOM_READS.md`.

### Still to build (Mansion)

| what | why |
|---|---|
| `wall-doorway--noble-paper` | REJECTED (0.79 wide:tall, a 20-in opening). The family borrows the `noble-interior` doorway (generated rooms draw jamb posts and a leaf anyway) |
| `wall-straight--conservatory--s2` | never painted (refused twice, and after a retry): the conservatory has ONE panel |
| `wine-bin-arched` | never painted. **The wine cellar is named a cellar or storeroom, never a WINE cellar** (1 read in 8). The existing `wine-rack` reads as "a crate with a bottle" or "empty shelving". Wanted: the arched brick bin full of bottle ends, and a wine rack whose bottles show from above |
| `fireplace-marble--s2`, `daybed--fine`, `statue-bust--s2`, `lamp-post-iron` | never painted. The garden has no lamp, the library's reading fire uses the one fireplace |
| `platter-silver-domed`, `tray-silver`, `pitcher-silver`, `cutlery-set-silver`, `decanter-crystal` | never painted: the sideboard and the ballroom's refreshments are thin |
| **what makes a ballroom** | the one state room that does not pass: "a formal reception hall or antechamber", "a gallery", "a dressing room" (0 of 4). An empty floor is not a read. Chandeliers from above lie on the floor ("fallen or stored"); the 20 gilt chairs along the walls are not seen; `harpsichord` is "a billiards table" or "a war table", `harp` "a golden horn" or, on a platform, "a throne". Wanted: a bandstand or musicians' gallery piece that reads as music (instruments in number, music desks), a dance-floor inlay as a floor, a chandelier that reads from above |
| a kitchen that reads without help | the servants' kitchen is named a kitchen in 5 reads of 8 ("blacksmith's forge", "crafter's workshop" otherwise): see Castle (the great hearth, the bread oven). Wanted besides: a range or a dresser of plates, a scullery sink, copper pans on a rack that read from above |
| `music-stand` (an older mesh) again | 3 x 4 x 3 ft: "armor stands or workbenches" |
| 6 flats not made | two each of `painting-landscape`, `rug-grand`, `curtains-drapes` (the ids existed) |
| wardrobe pair, `birdcage`, `doormat`, the dining and dressing-table smalls (27 and 31 roles) | in the recipes, no mesh |
| grammar, not assets | a rank on `DOORS` rules (the conservatory's glazed door loses a shared wall to the hall's panelled one); a balustrade on the garden's house side; the gazebo and the gate want the same spot; dining chairs cannot tuck under the table |

## Monster lair

### What shipped (2026-10-12, library source `lai-01`; flats `lai-flats-01`)
16 meshes for $1.22 on RunPod (`experiments/2026-10-11-types/lai/DESIGN.md`, `qa/summary.tsv`): the dragon's hoard heap with its sleeping hollow and a smaller heap (both colour-graded to gold: as meshed they were orange and read as nests), the dragon skull, dragon eggs, a gnawed carcass, the spider's funnel web and floor egg sacs, the beast's great nest, a hide on a drying frame, the goblin chieftain's bone throne on its heap of loot, a crude bunk, a skull totem, a cave mouth, a rock outcrop, boulders, a burnt tree. Flats: a painted floor web, two painted scorch marks, ten painted room icons; plus two flats derived from our own plates on 2026-10-11 (soot, a second web).

### Still to build (Monster lair)

| what | why |
|---|---|
| wall kit `cave-rock` (3 panels + doorway) and `floor-cave-natural` | the lair stands in the dungeon's hewn `cut-rock`: the passage reads as "a dungeon corridor" two times in three. A lair wants water-worn natural rock |
| `cave-opening--leaf` (an opening with no door) | every doorway hangs a leaf, so a beast's den has an iron-bound oak door |
| a web that stands up: `web-curtain` card, `web-cocoon-hanging` | the spider nest's webs are flat on the floor and small on the walls; only the funnel stands |
| `scales-pile`, `treasure-hoard-spill` | the dragon's hollow is marked by soot alone |
| `drum-war`, `banner-standard-war`, `hide-curtain--leaf`, `campfire` (an unlit mesh the fire rules skip) | the warren; the last party's camp at the cave mouth burns because every fire pit is lit |
| `pit-kerb`, `trophy-rack-skulls`, `tusks`, `skull-monster`, `claw-giant`, `pelts-stack`, `dung-heap`, `stalagmite--s3` | variety for the pit, the trophy cave and the beast den |
| flats: claw marks on a wall, a blood drag trail | signs inside a den's door |
| a second bone heap that reads as BONES from above | `bones-pile` and `skull-pile` read as dark mounds or "spiky pods" at table distance; only the flat loose-bone decal reads as bones |

## Dungeon & prison

### What shipped (2026-10-12, library sources `dun-01` and `dun-flats-01`)
75 meshes ($2.48 RunPod, two A100 sessions, 0 rejected) and 24 flats (5 floors, 4 strips, 15 decals and tiles) plus 14 room icons: `experiments/2026-10-11-types/dun/` (`DESIGN.md`, `QA.md`, `flats/README.md`). The `cut-rock` wall kit (three panels, a doorway); three door leaves (barred cell door, rune-sealed slab, carved face); traps (pressure plates, spike plate, spike pit, swinging blade, dart wall, flame jet, trip crossbow, bear trap, boulder, floor lever); puzzle pieces; prison pieces; treasure; den, collapse, chasm, sewer, flooded-chamber and shrine pieces.

### Still to build (Dungeon)
- **A cooler, darker hewn rock, painted so.** The cut-rock panels came out ochre brown; their colour maps were pulled 60% toward grey afterwards (`tools/grade_cut_rock.py`). A re-plate asking for cold grey-black rock would be better than the grade.
- **Water that is water.** `floor-water-flooded` and the sewer strip were painted dark green / olive and read as moss and dirt from the table; both were hue-graded (`flats/grade_water.py`). The real answer is the engine's water surface on a room floor and in a channel (neither exists).
- **Terrain below the floor.** Chasm, pit and sewer channel are painted tiles; with depth in the engine they want real edges: `chasm-edge`, `floor-pit-edge`, `sewer-channel` / `sewer-walkway` / `sewer-junction` kit pieces.
- **Traps that read from above.** A pressure plate reads as a chopping block and the dart wall as a rack of pigeon-holes: wanted are a plate with a painted warning ring, a dart wall with scorch and darts on the floor before it, a tripwire, a net, a portcullis in cut-rock (`portcullis--cut-rock`), a `cage-hanging` over a pit, a closed twin for `trap-spikes` (retracted) and for `mimic-chest`.
- **A rock fall that is not a heap of skulls.** `collapse-rubble` reads as a bone mound from the table (pale, lumpy): re-plate with big angular slabs, dust and a snapped beam, darker.
- **Corridor dressing by rhythm**: a pilaster / rib arch piece and an alcove wall panel per family (`wall-alcove--cut-rock`, `--dressed-stone`), so a corridor has architecture where nothing may stand.
- **Second shapes not made** (Codex allowance): `chasm-strip--s2`, `sewer-channel-strip--s2`, `decal-slime--s2`, `decal-cracks--s2`, `decal-rubble-scatter--s2`, `decal-straw-scatter--s2`, `decal-glyph-warding--s2`, `decal-scorch--s1`.
- **Recipe roles with no mesh yet** (from the older dun- recipes): `table-experiment`, `cage-hanging`, `manacles-loose`, `hood-executioner`, `jug-of-water-cell`, `treasure-hoard` (the render set), `tripwire`, `caltrops-scatter`, `alarm-bells-string`, `sewer-ladder-manhole`, `torch-dropped`, the last party's small gear.
- **For the castle**: its dungeon still hangs the crypt's gate on its cells. `door-cell-bars--leaf` now exists (tier `dun`): add `'dun'` to the castle dungeon's `tiers` to use it (it changes that room's golden record, so it was not done here).

## Mine

### What shipped (2026-10-12, library source `min-01`, flats `min-flats-01`)
30 meshes: the `mine-timbered` wall kit (straight, straight `--s2` with lagging boards, doorway), `ore-vein` (gold and copper) and `ore-vein--s2` (crystals) as wall-placed slabs, `mine-cart` (loaded) and `--s2` (empty), `rural-ore-cart-tipped`, `ore-pile` and `--s2` (stockpile), `rural-tailings-pile`, `rural-slag-heap`, `mine-tool-rack`, `mine-lamp-rack`, `powder-keg-stack`, `rural-pit-props-stack`, `coal-bin--mine`, `mine-shaft-collar`, `sorting-table`, `smelter--mine`, `mine-headframe`, `rural-water-pump-mine`, `rural-ore-bucket` (a kibble), `beam-collapsed`, `shoring-timber--s2` (cracked; in the library, no room lays it), `crystal-formation--s3`, `geode-cluster`, `ingot-stack`, `rural-sign-danger-mine`, `rural-bellows-ventilation`. Flats: `mine-rail-strip` (two versions), `mine-rail-cross` (turntable), `mine-rail-end`, `decal-ore-scatter` (two), `decal-coal-dust`; 13 room icons.

### Still to build (Mine)
- **A pick-and-shovel piece that reads from above.** `mine-tool-rack` reads as a rack of tongs, hammers or polearms; the tool store is "a workshop or armoury" on every read. Wanted: picks and shovels lying crossed on a low stand, or a barrow full of picks: heads up, seen from the table camera before it is meshed.
- **Powder that reads as powder.** The keg stack reads as "rolled goods", single kegs as barrels: the powder store is "a cellar". Wanted: a keg with a red band painted on its TOP (the face the camera sees) and a fuse trailing on the floor; `powder-keg` single.
- **A rock fall of the mine's own**: grey broken rock with snapped props sticking UP out of it, tallest at the wall (the dungeon's `collapse-rubble` reads as a mound of skulls; the collapsed tunnel uses the waste heap grown large).
- **Rejected or not made in this batch:** `lumber-pile` (plate rejected twice: a single plank bundle), `sluice-box` (meshed lying diagonally: footprint 3.8x squarer than its line; re-plate square-on).
- **Track pieces:** a curve tile and a points tile (the road is laid in straight rows; a tunnel that bends has no track round the corner); a wall-end buffer is made (`mine-rail-end`) but no program lays it.
- **The vertical link's own piece:** a ladder way that reads as a shaft from above (a framed hole with the ladder in it, usable as the stair itself: role `mine-ladder-shaft`), and `lift-cage`. Today the collar is a marker and the library's `ladder-wood` is the stair.
- **Small mine things of the catalog not made** (surface clutter, P2/P3): `rural-lamp-miners`, `rural-helmet-candle`, `rural-pick-miners`, `rural-hammer-and-gad`, the ore chunks (`rural-ore-*-chunk`), `rural-gold-nuggets`, `rural-assay-scale`, `rural-foreman-desk`, `rural-mine-map-board`, `rural-canary-cage-empty`, `rural-fuse-coil`, `rural-shaft-cover-planks`, `stalactite`, `cave-mouth` (the way in from a hillside).
- **A glow for crystals**: the game has flames only; the seam's crystals are waived in `tools/tool-sweep/waivers.json` until a glow effect exists.
- **Second wall look**: the brief's "worked seam with ore glints" is the `ore-vein` slab stood against the wall, not a wall family; a kit panel would let a whole room be vein.

## Wizard's tower

### What shipped (2026-10-12, library source `wizard-01`)
58 meshes (58 plates, 58 accepted by mesh QA, none rejected), 4 flats and 11 room icons: `experiments/2026-10-11-wizard-tower/README.md`. Wall kit `tower-stone` (two straight panels, doorway, lancet window, the `door-tower` leaf) and the half-timber shop window; furnace, two dressed benches, still, two reagent shelves, drawer cabinet, vat, green cauldron, jars; lectern with the great book, scroll rack, staff rack, two crammed bookcases, curio cabinet, armillary sphere, chalkboard; brazier, two pylons, portal arch, enchanter's table, crystals; great telescope, orrery; scrying basin, crystal ball on its pedestal, cushions; counter, sign, potion crate; the purple bed, the robe-and-hat stand, perch, hat; birdcage, planted tank, hutch, great egg, perch tree; ten table-top smalls.

### Still to build (Wizard's tower)
Ordered by what a room read or a player would miss first.

0. **Measured: four tower rooms stacked read as "a tenement or tall townhouse" from outside** (README, "How a square tower reads"). In order of effect: item 2 (the roof), an OUTER wall face for `tower-stone` that reads as stone from a distance (it was called wood siding), then item 1.
1. **Round walls.** A tower is round; the engine has straight walls only (docs/VERTICAL.md "rooms that are not rectangles": octagons from slanted edges are designed, not built). `tower-round-segment` has a catalog line and no mesh on purpose. Until then a tower is a square keep.
2. **A tower roof.** A square tower gets the same slate gable as a house. Wanted: a pyramid / cone cap as a roof shape, and an observatory roof (a dome, or a roof with a shutter the telescope looks through).
3. **Effects that the pieces were made to carry** (none exists): a portal surface in `portal-arch` (`fx-portal`); coloured flame for `elemental-brazier` (`fx-colored-flame`); a glow on `arcane-pylon`, `crystal-formation`, `crystal-glowing`, the crystal balls and the ritual circle (`fx-magic-glow`). These are also where a flavour would show first.
4. **Table-top apparatus with no mesh**: `alch-retort`, `alch-vial-rack`, `scales-balance`, `specimen-jar`, `alch-bell-jar`, `candle-cluster`, `glow-orb` (a wizard's own light: every tower room is lit by the inn's candles and lanterns today). `table-experiment` (the strapped slab table of a mad laboratory).
5. **Open twins**: none was made. The lancet window does not open; `alch-specimen-cabinet`, the drawer cabinet and the shop counter have no open state.
6. **More for the menagerie**: cages read, the rest did not (the nest was "a fire pit", the perch tree "a coat rack", the planted tank "a workbench", the hutch "a chest"). Wanted: a second and third cage shape (a hanging cage, a low kennel cage with bars on top), a familiar's creature set as figures (owl, raven, cat, toad).
7. **Things designed around and left out**: `teleport-circle-dais` (a low stone ring: the circle as a mesh), `arcane-coil`, `alch-summoning-candles-ring` (the candles are placed one by one instead), `stuffed-crocodile` and `alch-drying-rack-reagents` (ceiling pieces: from above they lie on the floor), `alch-fume-hood`, `door-rune-sealed` and `rune-tile` (iconography: for the flavours work).
8. **A wizard's wall hangings** as flavour cards (moon, sun, devil): today the tower hangs the inn's tapestries and one star chart.

## Farmstead

### What shipped (2026-10-12, library sources `hut-01` and `hut-flats-01`)
19 meshes ($1.48 RunPod, one A100 session; 22 plated, 3 withdrawn) and one seamless ground plus 16 painted room icons: `experiments/2026-10-11-types/hut/` (`README.md`, `ROOM_READS.md`, `BENCH.md`, `build_spec.py`, `flats/`). The `wattle-daub` wall kit (two plain panels, a doorway); for the coop `nest-box-row`, `chicken-perch-ladder`, `egg-basket`; for the dairy `butter-churn`, `cheese-press`, `rural-milk-churn-tall`; `pigsty` (the sty with its own walled mud yard); for field, garden and yard `rural-grain-stook`, `scarecrow-post`, `plough`, `dovecote`, `beehive-skep`, `bean-poles-wigwam`; `root-sand-box` (cellar), `winnowing-basket` (granary), `loft-ladder-head` (loft); the ground `floor-field-furrows` (laid straight: the furrows run on from tile to tile). Every farm mesh but the wall kit is sku tier `hut`.

### Still to build (Farmstead)
- **Re-plate the three withdrawn pieces** (plates and first meshes are kept in the batch folder, `models-rejected/`): `haystack-field` (asked for "one smooth solid surface" and got a yellow pot under a leather lid: ask for broad shaggy layers of hay); `rural-grain-heap-threshed` (an orange cone with the shovel's handle as a knob: the granary read as a brewery; ask for pale wheat-gold, a slumped irregular heap, the shovel lying beside it); `wall-window-small--wattle-daub` (three wooden bars = a jail window from above: an unbarred opening, one plank shutter half open).
- **What would name the two rooms that are not named.** The dairy ("a pantry", "a potter's workshop"): the cheeses on shelves are bowls from above; it wants `trade-cheese-vat` (a big round vat of white curd), `trade-curds-draining` (white cloth bags hung over a tub) and a row of `rural-milk-churn-tall` singles; milk is what reads. The granary ("a farm work shed"): the grain heap above, `rural-chaff-pile`, a flail pair, grain bins with their lids off showing gold, `staddle-stones` outside.
- **A grain crop.** The field's crop is the garden's cabbage patch laid edge to edge, so the field reads as a garden plot: `crop-field-tile` as a 5-ft block of standing wheat (painted as one solid golden mass) and its cut-stubble twin.
- **Signature pieces another batch is making, to use when they land:** `spinning-wheel`, `cradle` (the cottage and the bedroom place them when the library has them).
- **Not made, still in the recipes' `wants`:** `truckle-bed`, `apple-rack-slatted`, `cellar-steps-earth`, `rural-stool-milking`, `cowbell`, `craft-yoke-ox`, `rural-chicken-feeder`, `rural-pig-sty-trough`, `rural-mud-wallow`, `rural-harrow`, `quern-hand`, `cold-frame`, `stile`, `rural-apple-ladder` (12 ft and thin: needs a stout design), `windfall-apples-scatter` (a flat), `mounting-stone`, `pot-hook-tripod`, `bread-trough-kneading`.
- **A cowshed that is not a stable.** The byre is the stable's stalls without the tack and reads as a stable half the time and a bunkhouse the rest: low tie-stalls with a dung channel and a hay rack would be a mesh set of its own.
- **A loft that reads as a loft** needs the roof: rafters or a sloped-ceiling cue that the cutaway keeps (today: "a dormitory").
- **Wealth as a dial.** `room.wealth` is read by the farm programs; nothing in the tuner's room panel or the game sets it yet.

## Vertical kit

### What shipped (2026-10-06, library source `vertical-01`)
41 meshes, in the library and placeable by hand; no room program uses them (the grand stair excepted, in the mansion's hall), the storeys and roofs code asks for them by role. Stairs in stone and timber (10-riser straight flights `--t10`, half flights, landings, a wall-hugging flight, two wide spirals), the grand stair, two ladders, jetty brackets, a timber post, buttresses, corbels, three dormers, four chimney stacks, parapet and corner, battlement and corner, two ridges, two finials, a weathervane, a skylight, a roof hatch and its open twin, two gargoyles, a nest. Measured boxes, tread heights and which way each climbs: `experiments/2026-10-05-castle-crypt-mansion/vertical/FOR_STOREYS.md`.

### Roof sections (2026-10-11)
Four modelled 5 ft x 5 ft roof sections (thatch, clay tile, slate, wood shingle), built from the roofing plates above by measurement (no generation, $0), laid out instanced by `engine/client/roofs.js`. They are roof surface, not library objects: `engine/client/data/roofsections.json`, files in `engine/client/data/roof/`. `experiments/2026-10-11-roof-sections/README.md`; docs/VERTICAL.md "Roof sections".

### Still to build (Vertical kit)

| what | why |
|---|---|
| **a quarter-turn stair**, stone and timber | `stair-quarter-turn--dressed-stone` REJECTED (two flights in line, not an L: the reconstruction flattens the turn; re-plate from a higher camera); the timber one never painted. Meanwhile an L is two `stair-half` and a `stair-landing` |
| `roof-dormer--thatch`, `roof-ridge--tile` | never painted |
| `wall-crenellated--dressed-stone` again | ships at a 1.57x height stretch (accepted); the first to re-plate if it shows |
| a glass roof | the conservatory takes slate |
| a flat-roof surface | a deck still wears the rough-boards floor texture; the four pitched styles have modelled roof sections (2026-10-11, `experiments/2026-10-11-roof-sections`) |
| a second roof section per style | one 5 ft section repeats over a whole slope; a second, edge-matched one mixed per copy would break the repeat (needs a second plate per style: four free image requests) |
| hip and valley trim | sections are cut clean at a hip or a valley, with nothing laid over the cut; no roof uses a hip yet |
| narrower ladders | both new ladders are 44 to 46 in wide at 10 ft (catalog 24) |

## Temple & chapel

### What shipped (2026-10-11, library source `tem-01`)

29 meshes, all accepted, and 6 flat images (`experiments/2026-10-11-types/tem/`): the `temple-stone` wall kit (two plain panels, a lancet window, an abstract stained-glass panel); a marble altar, pulpit, pipe organ, choir stall, confessional, kneeling desk, alms box, two sets of vestments, two copying desks, scroll rack, apothecary's drawers, treatment bench, the great bell in its frame; and the flavor slots for `sun` and `moon` (idol, altarpiece, censer, sculpture, upright carved pier as meshes; banner, wall medallion and floor sigil flat).

Task C Step 1 (2026-10-13, verified live): sun and moon now also have carved wall corbels. The sun idol was replaced with a clear sun-face standard; the previous mesh is retained in replacement provenance.

Task C Step 2 (2026-10-13, verified live): nature, sword-shield and the four neutral themes (death, scales-coin, forge-hammer, sea-storm) join the library. Each new theme has idol/corbel/altarpiece meshes and banner/relief/sigil flats; sculpture and pier are deliberately empty, with the existing neutral hanging censer used by new recipes.

Task C Step 3 (2026-10-13, verified live): all thirteen factions now have painted emblem icons, individually read at 31px and loaded in the public picker.

### Still to build (Temple)

| sku | place | size | catalog | why |
|---|---|---|---|---|
| `sickbed--screened` (or a folding screen, `rite-confession-screen` re-used) | floor | 36x78x60 | new | the infirmary reads as a dormitory in every blind read: beds in rows. A bed behind a cloth screen, a stretcher or a bandage trolley would say "sick". |
| `cloister-arcade--temple-stone` | kit | 60x14x108 | new | a low wall with twin columns and arches: the cloister walk has free-standing columns today and reads as "a ceremonial hall". |
| `pillar-round--temple` | floor | 16x16x104 | has a line | the one column mesh is 3.1 ft across at its capital: a slim pale column for the nave arcade and the cloister. |
| `wall-window-large--temple-stone` | kit | 60x12x108 | has a line | a broad traceried window for the end wall behind the altar. |
| `bookshelf--plain` | wall | 40x14x78 | has a line | the only bookshelf meshes are the mansion's (tier `noble`): the scriptorium has scroll racks and cupboards only. |
| `rite-bell-rope`, `stair-spiral` as a prop | ceiling / floor | | has a line | the bell tower base has the bell and nothing that goes up. |
| `flavor-relief--sun` / `--moon` as carved meshes | wall | 34x6x34 | role exists | today flat images (Harry: keep flavors mostly flat); a mesh only if the flat medallions look thin close up. |

## Market & village

### What shipped (2026-10-11, library source `mkt-01`)
61 meshes for $1.09 on RunPod (`experiments/2026-10-11-types/mkt/README.md`): the shop skeleton in five trades (general store, bakery, apothecary, tailor, curio: a counter, two stocked shelf units, a display table and floor stock each, 25 meshes; four hanging signs), the trades' own pieces (dry-goods bins, the apothecary's drawers, a dress form, the cutting table, the curio display case, scales), six market stalls, the market cross, pump and trough, crier's stand, ground displays (pottery, rugs, spices, flowers), the pedlar's cart, an awning, the iron street lamp, a bollard, the watch desk and the timber lockup (panel and gate), a cradle and a spinning wheel, and three half-timber kit pieces (second wall, doorway, shop window). Twelve room icons.

### Still to build (Market & village)

| what | why |
|---|---|
| `awning--s2` | never made: the gate compares its colours with its parent's, and the piece is the same awning in other colours. Every awning is the burgundy one |
| **a tailor that reads at a small size** | named a tailor's shop 2 of 2 on the live record (a large picture) and 0 of 9 on the smaller local frames ("a scholar's study", "a dormitory"). From far off rolled bolts of cloth are books and scrolls, folded cloth on a shelf top is bedding, a cloth-covered table is a bed. Wanted: bolts standing on end in strong colours, gowns hanging on a rail, a taller dress form; then the cloth-covered display table can come back |
| `shop-sign--general` … one sign per trade is made (general, apothecary, tailor, curio); the bakery hangs the inn's pretzel | nothing wanted; listed so a new trade remembers its sign |
| an OPEN twin of `cell-holding-wood--gate` | the lockup's gate is one shut panel (BENCH.md: hinge) |
| a market stall seen from BEHIND | stalls face the middle of the square; the row nearer the camera shows its plain back and its awning. A canvas back-cloth or crates stacked behind would dress it |
| street surface kit (`street-cobble-tile`, `street-gutter`, `jetty-overhang`) | the street is the yard's cobble floor; no kerb, gutter or overhanging upper storey |
| town-house smalls (`basket-lidded`, `cups-stack`, `tinderbox`) and a `bed-box` / `bed-cupboard` | the bedroom is the inn's guest room; nothing says "family" but the cradle |

**The remaining trades.** Each needs ONLY its tier of the five skeleton roles (a counter, two shelf units, a display table, floor stock: 5 meshes) and a sign, plus the signature pieces below; then one line in `MKT_TRADES` (`solver2.js`) and one room-type line (`build_data.py`). The recipes exist (`catalog/rooms-*.md`, ids `mkt-…`).

| trade | signature pieces to make | already in the library |
|---|---|---|
| cobbler | `cobbler-bench`, `craft-display-shelf-boots` | `boots-row` |
| chandler | `candle-dipping-rack`, `trade-candles-hanging` | candles, `candle-box-sconce` |
| fletcher / bowyer | `fletcher-bench`, `craft-quiver-rack` | `quiver-arrows`, `arrow-barrel`, `archery-target` |
| jeweller / goldsmith | `jeweler-bench`, `rings-tray` | `display-case-glass`, `jewelry-box`, `strongbox`, `scales-balance` |
| potter | `potters-wheel`, `kiln-pottery`, `pots-drying-shelf` | `pottery-for-sale` |
| butcher | none | `butcher-block`, `trade-butcher-hooks-rail`, `carcass-hanging`, `sausage-string`, `trade-apron-bloody` |
| fishmonger | `fish-crate-iced`, `fish-barrel-salted` | `fish`, `crab`, `mussels-bucket`, `salted-fish-stack` |
| armourer / weapon shop | none | `weapon-rack`, `armor-stand`, shields (castle) |
| leatherworker / saddler | `leather-workbench`, `leather-goods-display` | `saddle`, `saddle-rack` |
| bookseller / scrivener | none | `bookshelf`, `book-stack`, `desk-writing`, `inkwell-quill` |
| outfitter, pawnbroker | none (a mixed tier) | `backpack`, `bedroll`, `rope-coil`, `lantern-hand` |
| barber-surgeon | `barber-chair`, `trade-barber-pole` | `sickbed`, `shaving-kit`, `bandage-roll` |
| counting house | `counting-table`, `abacus` | `ledger-accounts`, `coin-stack`, `strongbox`, `scales-balance` |
| carpenter, cooper, glassblower, bindery, dyer, tanner, mill | workshops with a bench or a vat as the key piece: nearer the Smithy type's shape than a shop's | – |

## Cult sanctum

### What shipped (2026-10-12, library source `cult-01`, flats `cult-flats-01`)
41 meshes: the `black-stone` wall kit (plain x2, doorway, alcove, secret door ajar), the bookcase door leaf, two altars, two hooded statues, a black pillar, the portal arch, the chained-book lectern, a robe rail and two peg rails of robes, a cage, two boundary stones, the offering bowl, the black fire bowl, nine smalls, and the flavor pieces for devils and spiders (idol, sculpture, upright carved pier, altar-piece, censer each). Flats: `floor-basalt-dark` x4, the plain ritual circle, banner / relief / sigil for both flavors, nine room icons.

Task C Step 1 (2026-10-13, verified live): devils and spiders now also have carved wall corbels. The existing upright piers are kept.

Task C Step 2 (2026-10-13, verified live): plain one-headed dragons, skulls and tentacles each have idol/corbel/altarpiece meshes and banner/relief/sigil flats. Sculpture and pier are deliberately empty; new recipes reuse the neutral hanging censer.

### Still to build (Cult sanctum)
| piece | why |
|---|---|
| a robe stand that reads as cloth from above | the robing room reads as an armoury in every blind read: hooded robes on a rail look like weapon heads |
| `door-secret-bookcase-open` | the open twin was rejected (it came out as the closed bookcase); the engine swings the leaf |
| a shut twin of `wall-secret-door--black-stone` | the panel exists only standing ajar |
| `rite-cult-mask-blank` | rejected: lying flat it is an egg; wants a mask on a stand or a row of masks on a shelf |
| a buttress within the kit's 48-in reach, per flavor | the existing faction meshes are approved upright 9-ft piers; they do not fill the vertical kit's short-reach exterior buttress role |
| `rite-cult-mask-horned`, `alch-summoning-candles-ring`, `phylactery`, `tentacles-floor` | named in the older clt recipes, no mesh |

## Smithy & workshop

### What shipped (2026-10-12, library source `smi-01`)
25 meshes for $1.78 on RunPod (the pod idled to its timer: the meshing itself was about 25 minutes), 25 of 26 plates accepted (`experiments/2026-10-11-types/smi/README.md`). Forge with its hood, great bellows, anvil on its stump, coal bin, the smith's tool board, bar-iron rack; breastplate on a fitting form; carpenter's bench, woodworking tool board, sawn-board stack, shavings heap, offcut bin; pottery kiln, potter's wheel, pot rack, clay bin, glazed ware on a pallet; a heavy trade workbench; coal heap; bloomery (`smelter`); and the smith's TRADE of the market's shop skeleton, tier `smi`: counter, stocked rack (swords and a shield), display table, sword barrel (floor stock), anvil sign. No new wall family, no flats. Reused: quench trough, grindstone, weapon racks, armour stands, repair bench, shoeing stocks, hitching rail, troughs, sawhorse, woodpile.

### Still to build (Smithy & workshop)

| what | why |
|---|---|
| `craft-chair-half-built` | the one plate rejected (twice: the gate called the clamp I asked for "invented"). Re-prompt WITHOUT the clamp. Until then the carpenter's finished goods are the inn's plain chairs, a table and a chest |
| a second, lower stocked rack `shop-shelf-stocked--smith--s2` and a tools-and-pots variant | the shop skeleton asks for two shelf shapes a trade; the smith has one, so a shop front repeats the same rack five times |
| `smith-mail-in-progress`, `smith-helm-stake`, a rack of spear and axe heads | the armourer shares racks and stands with the castle armoury; these are what would make it a WORKshop from above |
| `craft-wheel-half-built`, `craft-saw-pit-frame`, a pole lathe | the carpenter's own big silhouettes (a wheel and a lathe have thin parts: design them stout) |
| a glazing table with bowls of colour, a pug mill | the potter's bench is the plain trade bench today |
| wall family `smithy-brick` (soot-blackened brick, a wide cart door, a louvred smoke vent as its window) | the fire rooms use the inn's fieldstone |
| soot and scorch decals, a cinder patch, a sawdust floor, a clay-splashed floor | none of the crafts marks its floor yet |
| `fx-sparks` at the anvil, steam at the quench, kiln smoke | effects, not meshes |
| a glow in the forge's coal bed that does not depend on the flame | the forge was generated cold (grey coals): from above its fire is only the bench-placed flame |

### The other crafts: a workstation and a stock list each, not a room
Each becomes a room by ONE `SMI_CRAFTS` line + one room-type line + one recipe (README, "A new craft"). Roles are the catalog's.

| craft | heat / power | workstation | tool wall | raw | finished | notes |
|---|---|---|---|---|---|---|
| Tanner | none; VATS: `craft-tanner-vat-paddle`, `craft-tanner-lime-pit` (water, for the bench: murky liquor, not plain water) | `craft-tanner-fleshing-beam` | a board of fleshing knives | `craft-tanner-bark-pile`, a stack of raw hides | `hide-stretching-frame` in rows, `craft-leather-roll` rack | the frames in rows are the top-down signature |
| Cooper | `craft-cooper-cresset-fire` (fire) | `craft-cooper-shaving-horse`, `barrel-in-progress` | croze, adze and drawknife board | `barrel-staves-bundle`, `hoops-iron-stack` | the library's `barrel`, `bucket`, `cask-rack` | the half-built barrel is the signature; all else exists |
| Wheelwright | none | `craft-wheel-half-built` on its stand | the carpenter's board | spokes and felloes stack, `craft-boards-planed-stack` | `wheel-spare`, `cart-hand` | |
| Bowyer & fletcher | none | `craft-bow-tillering-tree`, a fletching bench | a board of drawknives and bow strings | `craft-bow-stave-raw` bundles, `craft-arrow-shafts-bundle` | a rack of bows, `arrow-barrel` | |
| Saddler & leatherworker | none | `leather-workbench`, `craft-stitching-pony` | awls and punches board | `craft-leather-roll`, hides | `saddle-rack`, `craft-saddle-horse-stand`, `armor-dummy-leather` | half of it exists |
| Bell founder & bronze caster | `smith-furnace-bronze` (fire) | `smith-bell-mould` in its pit | ladles and tongs | `smith-ingot-bronze` stacks, `smith-scrap-bin` | a finished bell on a frame | a yard craft as much as a room |
| Locksmith & jeweller | a small bench forge | a fine bench with `smith-anvil-small` | files and gravers board | `smith-ingot-silver`, wire | a display case (the market's `display-case-glass`) | sells: its front is a shop-skeleton trade |
| Glassblower | a glory-hole furnace (fire, a glowing mouth) | a blowing bench with rails | blowpipes rack (thin: one chunky rack) | sand and ash bins | a shelf of bottles (the apothecary's stock reads close) | |
| Weaver & dyer | DYE VATS (water, coloured) | a loom | shuttles and combs | wool sacks, `spinning-wheel` | cloth bolts (the tailor's stock) | |
| Dwarven or arcane forge | `smith-forge-dwarven-hearth`, `smith-molten-channel` | `smith-rune-anvil` | as the smith | `smith-ingot-mithral` | as the smith | a variant line of the forge, in another wall family |
