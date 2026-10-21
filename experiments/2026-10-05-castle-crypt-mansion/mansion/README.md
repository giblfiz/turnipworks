# Mansion type (2026-10-05): design and spec

The mansion designer's delivery for the castle / crypt / mansion batch (`../DESIGN_BRIEF.md`). **Design only: nothing here
has been generated, no image model was called and no money was spent.**

    python3 build_spec.py     # assets.json + prompts/<sku>.spec.md  (131 new meshes; asserts catalog, groups, parents, twins)
    python3 build_rooms.py    # rooms.json + flats.json              (checks every id against catalog, library, assets.json)
    python3 ../../../src/catalog_tool.py                             # clean: 0 WARN, 0 ERROR, no P1 orphans

Catalog files: `catalog/objects-mansion.catalog.md` (53 new lines: 48 mesh/kit roles, 5 flats) and
`catalog/rooms-mansion.md` (10 recipes, all P2 so they force no promotions). Two existing lines in
`fantasy-core.catalog.md` got `NOB` added to `set:` by hand (`telescope`, `pedestal-display`); nothing else was touched.

## Rooms

| key | label | cells | walls | focal (in order) | reads from above as | closest program |
|---|---|---|---|---|---|---|
| `mansion-hall` | Entrance hall | 5x5 | noble-panel | stair-grand (vertical kit), table-pedestal-round | stair facing the door or a round table dead centre; pale marble floor; console + gilt mirror each side | desk (axial focal) |
| `mansion-drawing` | Drawing room | 5x4 | noble-paper | fireplace-marble, sofa | white fireplace with a gilt mirror, the burgundy suite facing it across a carpet | bedroom (fine-room zones, no bed) |
| `mansion-dining` | Dining room | 6x4 | noble-panel | table-feast | one very long table with a chair every 2 ft, candelabra down the middle, sideboard of silver | common (one island, extended) |
| `mansion-library` | Library | 4x4 | noble-panel | bookcase-ladder, desk-partners | walls of bookcases, a ladder on the widest, a green-topped desk, a globe | store (wall racks) + desk |
| `mansion-bedroom` | Master bedroom | 5x4 | noble-paper | bed-canopy | the state bed centred on the far wall, vanity, wardrobe, screen | bedroom (fine), unchanged |
| `mansion-ballroom` | Ballroom | 8x6 | noble-paper | chandelier-grand, harpsichord | an EMPTY parquet floor under a row of chandeliers, gilt chairs along the walls, harpsichord at one end | barn (clear centre) |
| `mansion-conservatory` | Conservatory | 5x3 | conservatory | palm-potted, fountain-courtyard--s2, plant-stand-tiered | glass walls, patterned tiles, palms and stands of pots, two wicker chairs | outdoors (plants) indoors |
| `mansion-garden` | Formal garden | 7x6 | outdoor | fountain-courtyard, gazebo, lily-pond | hedged, striped lawn, fountain where two walks cross, everything mirrored | outdoors (the yard), symmetric |
| `mansion-kitchen` | Servants' kitchen | 5x4 | noble-interior | cook-hearth-spit | the inn kitchen + a board of call bells and silver on the pass | kitchen, unchanged |
| `mansion-cellar` | Wine cellar | 4x3 | dressed-stone | wine-bin-arched, tun-large | the inn cellar + brick-arched wine bins and a tasting table | store (cellar), unchanged |

The brief asked for 6-8 rooms: the first eight are the mansion's own. The last two are flagged `"service_room": true` in
`rooms.json`: they cost 2 new meshes between them and reuse the inn's recipes, so keeping or dropping them in the tray is free.

The garden is defined like the Yard (`build_data.py` ROOM_TYPES `yard`: `"outdoor": True`, program `outdoors`, floors are
ground, recipe slots `plants` and `edge` read by name). It differs in rules, not in kind: mirror symmetry about the path
axis, the edge is always the hedge kit (already built) or the new stone balustrade, the centre is a fountain.

## Wall styles

- **`noble-interior` (exists)**: cream plaster over a low honey wainscot with a plain dado rail (prompts in
  `experiments/2026-10-01-walls/prompts/`). It suits the service wing and corridors and is too plain for the state rooms, so it
  is the kitchen's family only. It had no doorway: `wall-doorway--noble-interior` is specified here, painted from its plate.
- **`noble-panel` (new)**: dark oak wainscot to 6 ft in two tiers of panels, plate rail, cream plaster and cornice.
  Wall, `--s2`, tall window, open twin, doorway.
- **`noble-paper` (new)**: sage-green damask wallpaper over a 3-ft cream panelled dado. The same five pieces.
- **`conservatory` (new, my addition)**: a 2-ft brick plinth under cream glazing bars and frosted panes. Wall, `--s2`,
  doorway; no window piece (`look.js` already falls back to `wall-straight`).
- The tall window is a sku of the engine's window role `wall-window-small` (that is the id `look.js` places by family).
- **Doors**: the existing `door-double-grand--leaf` is carved oak with iron studs and ring pulls: right for a castle, wrong
  here. New: `door-panelled--leaf` (new role, six panels, brass knob), `door-double-grand--fine-leaf` (painted from it),
  `door-glazed--leaf` (new role, conservatory and garden).

## Counts: 131 new meshes (budget about 135)

| prio | p1 | sib1 | p2 | sib2 | p3 | total |
|---|---|---|---|---|---|---|
| 1 focal, wall kit, what makes a room read | 19 | 12 | 0 | 0 | 0 | 31 |
| 2 furniture | 0 | 18 | 28 | 5 | 0 | 51 |
| 3 smalls, second shapes, open twins | 0 | 6 | 0 | 8 | 35 | 49 |

99 roles: 48 new, the rest existing roles that had no mesh (bookshelf, daybed, chandelier-grand, fountain-courtyard,
planter-topiary, statue-bust, harp, silver, books ...) or a noble sku of a role that has rough ones.

**Groups are scheduling, prio is importance** (they differ on purpose): `sib1` is painted from an accepted `p1` plate, so
a prio-2 armchair painted from the prio-1 sofa is `sib1`. `sib2` is painted from a `p2` plate OR from a `sib1` plate: the
five open twins whose closed twin is itself a sibling (two open windows, `sideboard-open`, `cabinet-china-open`) are two
steps deep and must run after `sib1` is accepted. Every sibling carries `"parent"`.

**Suites (one first piece, siblings painted from its plate):**
- burgundy drawing-room suite from `sofa`: armchair, wing chair, settee, footstool, chaise (`daybed--fine`), bench, tripod table
- mahogany dining suite from `table-feast--fine`: three dining chairs, carver, shorter table, sideboard, china cabinet
- walnut bedroom suite from `bed-canopy--state`: dressing table, commode, bedside cabinet
- oak library fittings from `bookshelf--fine--s1`: two more bookcases, `bookcase-ladder`; desk suite from `desk-partners`: library table, green leather wing chair
- cream-and-gilt ballroom set from `chair-salon-gilt--s1` (second chair, bench, stool) and from `mirror-pier-gilt` (console table)
- garden stone is one written recipe (weathered cream-grey limestone, ochre lichen) shared by fountain, statues, urns, bench, sundial, pool, balustrade

**The canopy bed**: the two inn skus are a fine guest's bed. A lord's needs to be bigger and richer, so one variant,
`bed-canopy--state` (6 x 7.5 ft, carved tester, tied-back green hangings). It has no `tier` on purpose (see below).

## Reuse: 136 library roles

Listed per room under `reuse` in `rooms.json` (every one checked to have a sku in `library.json`). The kitchen and
cellar are the inn's recipes plus 3 objects. Tableware, food, lights, rugs, hedges, trees, planters, wardrobes with their
open twins, hearth tools, mirrors, vanity smalls all come from the library. From the other designers: the vertical kit's
`stair-grand--noble-interior`; the castle's `goblet-silver`, `platter-silver`, `armor-stand--s1/s2`.

## Flags for integration

- **Wealth and tier**: all rooms are wealth `fine`; `solver.js chooseSku` then takes only skus whose tier is `fine` when
  a role has any. 23 new skus of existing roles carry `"tier": "fine"`. Side effect to know about: the inn's Fine guest room
  will start picking these too (e.g. its dining chairs become the mahogany ones), and existing untiered inn skus of those
  roles drop out of fine rooms. `prefer_skus` per room is there if you would rather pin than rely on tier.
- **Hung** (`"hung": true`): `mirror-pier-gilt`, `sconce-candle-triple--fine`, `bell-board-servants`. The first two fail
  `isHung()`'s size test and need their roles in `HUNG_IDS`. Paintings, tapestries and drapes are flats.
- **Lights** (all UNLIT; `fireType()` already matches every id): fireplace x2, chandelier x2, candle x4
  (`candelabra-standing--s1/s2`, `sconce-candle-triple--fine`, `candelabra--fine--s2`), lantern x1 (`lamp-post-iron`).
  solver2 names `chandelier-ring` for big-room lights; mansion rooms want `chandelier-grand`.
- **Per-sku sizes**: variants whose size differs from the role's carry their own `size` (bookcases, state bed, short table).

## Bench items (Harry, Alignment Bench)

- **fire (9)**: fireplace-marble, fireplace-marble--s2, chandelier-grand, chandelier-grand--s2, candelabra-standing--s1,
  candelabra-standing--s2, sconce-candle-triple--fine, candelabra--fine--s2, lamp-post-iron
- **water (5)**: fountain-courtyard, fountain-courtyard--s2, fountain-wall, lily-pond, birdbath (all generated dry)
- **hinge (11)**: door-panelled--leaf, door-double-grand--fine-leaf, door-glazed--leaf, both open windows,
  sideboard / sideboard-open, cabinet-china / cabinet-china-open, desk-bureau / desk-bureau-open

## Risks (where I expect the generator to struggle)

1. **gazebo**: an open ring of columns under a dome. The yard's well-house (two posts and a roof) came through TRELLIS, but
   six columns may fuse or drop. Route `trellis` first, `hunyuan-mv` if the gaps fill. Loss is small: the garden reads without it.
2. **chandelier-grand** (catalog `thin`): written as fused tiers of chunky crystal with no chains. Expect a re-roll.
3. **harp**: the strings are specified as a solid striped panel; a plate with real strings will reconstruct as rags.
4. **Glass**: window panes, the conservatory wall, mirrors and the china cabinet are all painted OPAQUE (cream, mint-cream,
   silver-grey) because blue is the mask colour. The conservatory wall is the least proven piece in the kit.
5. **bookcase-ladder**: the leaning ladder is thick and touches top and bottom, but there is a gap behind it.
6. **Wallpaper seams**: the damask is three columns with edges in plain ground, but a hand-painted repeat will not line up
   perfectly between `s1` and `s2`. If it bothers at table scale, drop `s2` and use one panel.
7. **Statues and busts** are stone figures: the house style says "no people", so the gate text insists on one stone colour
   and a generic face, and forbids inscriptions. The gown stands on a headless form.
8. **Big plain masses** (table tops, the billiard bed, marble) can come back partly unpainted: each has inlay, veining or
   objects written in for that reason.
9. **Open twins** of the cabinet and bureau show contents (china, pigeonholes) rather than an empty hollow: shallower than
   the inn's empty chests, so easier for TRELLIS, but the pair must still match.

## Not decided

- Whether the two service rooms belong in the mansion's tray at all (they are in `rooms.json`, flagged).
- `tier: fine` versus a new tier for the mansion (it changes the inn's Fine room: see above).
- The garden's gravel walks are described as ground strips of `floor-gravel`; the yard grammar lays `decal-path-worn` today.
