# Mansion: integration notes (fork, 2026-10-05, round 2)

Files: `programs/30-mansion.js`, `hunks/walls_tail.mansion.js`, `hunks/solver_tail.mansion.js`, `tests/mansion.test.mjs`,
`manifest_overrides.mansion.json` (draft for `B/mansion/manifest_overrides.json`), `mansion_caps_sandbox.py` (sandbox helper).
Sandbox: `python3 make_sandbox.py mansion --scope once,crypt,mansion` (all 374 fake meshes; never rebuild `sandbox/pristine`).

## What is drafted

- **Seven indoor programs** (`KEY[key]`, each ending in `ccmDone`): entrance hall, drawing room, dining room, library,
  master bedroom, ballroom, conservatory; each with a `MENUS[key] = ccmAnnex(...)` for the leg of an L-shaped room.
- **The formal garden** `mansionGarden` (`KEY['mansion-garden']`, through the outdoor hook `(KEY[key] || yard)(ctx)`):
  always a clipped hedge (a section on every open grid edge, end blocks where a run ends or turns but not against the
  house, the arch on the gate's segment; rule `yard-edge`), the main axis on the garden's centre line from the house
  side, a cross walk through the middle, both kept clear, the fountain at the crossing with the walk parting both ways
  round it, everything else in mirrored pairs placed both-or-neither. It fills `ctx.yardInfo` in the shape `summarize2`
  prints and sets `ctx.densityTarget = yardTarget(area)`. No `DENSITY` entry (yard.test line 56).
- **Service rooms** run the inn's programs whole (`PROGRAM_OF`); the bell board and wine bins come from wrapping
  `KEY.kitchen` / `KEY.cellar` in the appended block (inert unless `ctx.type.key` is the mansion's).
- **Walls**: three families (fallback `noble-interior`), no windows on conservatory and cellar, the 2-cell front door
  on hall and ballroom, `DOORS` per room.

## Results (sandbox/mansion, new defaults: hall 5x6, conservatory 5x4)

`node tests/mansion.test.mjs`: 1,152 indoor rooms + 192 gardens + 126 annex legs + 12 whole mansions,
**566,294 checks, 0 failures, 0 purpose fails** (also 0 without the caps below: 566,793 checks).

| room | props | density vs target (min) | note |
|---|---|---|---|
| hall | 26 | 1.16 (0.57) | **the grand stair stands in 16 of 24 default 5x6 halls**; the other 8 have a door in the wall facing the front door (centre table) |
| drawing | 26 | 0.95 (0.60) | |
| dining | 67 | 1.39 (1.06) | 12.3 seats on average, a plate per chair |
| library | 31 | 1.19 (0.71) | books on 40% of the wall |
| bedroom | 27 | 0.79 (0.29) | thin in the 9x8 room |
| ballroom | 52 | 1.12 (0.60) | empty floor 55% of the room (min 41%) |
| conservatory | 32 | 0.83 (0.31) | thin in the 8x6 room |
| kitchen / cellar | 83 / 37 | 1.66 / 0.93 | the inn's programs; 2.9 wine bins per cellar |
| garden | 14.1 | yard target | 192 gardens: alone / behind the hall / between hall and conservatory / closed court, 6 sizes x 8 seeds |

Garden detail: hedge on every open segment in all 144 gardens that have one (the 48 closed courts have none);
centrepiece the 5-ft fountain in 128, the 8-ft in 64; gazebo in 38, lily pond in 42; no inn-yard thing anywhere; both
walks clear. **Mirror symmetry: 2,364 of 2,470 off-axis things (95.7%)** have a partner of the same role at the mirrored
spot (the rest: the pond and its balancing sundial, and pairs whose second half lost its place to a door's join walk).

Also in sandbox/mansion (with caps and tiers applied): `tests/golden.mjs` **0 differ of 348** against `sandbox/pristine`
(the inn's Fine guest room included), `tests/crypt.test.mjs` 0 failures, the tuner's `yard.test` 0, `solver2.test` 0
(580 rooms), `solver.test` 0. Tiers: 8,942 of 8,942 placements of a role with a mansion mesh rolled that mesh.

Remaining work-arounds in the test, around the shared `ccm_lib.mjs`: drapes (they hang ON a window; at a corner window they
run 6 in past the room's inside face, as in the inn's fine room) and `stair-grand` (10 ft, see below) are shrunk in a copy of
the layout before `checkRoom`. Blocked service paths in the service rooms are counted, not failed: 2 of 144; the inn's
own `kitchen` blocks 4 of 120 in the same scenes.

Seen once on the way: `tests/crypt.test.mjs` failed 3 chapels ("a chapel of N cells with under 2 seats") in one library
state of this sandbox and passes in the next; `sandbox/crypt` shows 6 of the same today. That check moves with the
library's contents (rng); it is the crypt's, not the mansion's.

## Tall pieces (task 2)

- **`fireplace-marble`, `fireplace-marble--s2`, `bookcase-ladder`: capped at 104 in** in `manifest_overrides.mansion.json`
  (`{"size": {...}}`, make_manifest.py's format). Why 104: the catalog `scale` is 0.9-1.1 and the tuner applies 15% of
  it, so a prop varies by 1.5%; 108 in came out at up to 109.6 in, 104 in tops out at 105.6 in. (Setting those catalog
  lines to `scale: 1.0-1.0` would also do; the cap needs no catalog edit.)
- **`stair-grand--noble-interior`: left at 120 in.** It is a kit piece (stretched to its box, no variety) and has to reach
  the next storey; the test lets it through by name.
- Nothing else indoors is over: the wall and door kit pieces are stretched to their openings; `gazebo` (13 ft) and
  `lamp-post-iron` (9 ft) are outdoors.
- **How the cap was tested**: `python3 mansion_caps_sandbox.py` writes the override sizes into the sandbox's fake
  `mansion-01/manifest.tsv` (`size` column) and fake bounds, and reruns the sandbox's build_data.py; the library then
  carries `size: [72, 24, 104]` on the skus (`dims()` reads `sku.size`). mansion.test.mjs detects that and gives the two
  roles NO allowance: over-9-ft placements fall from 360 to 64, all of them the stair. Run the helper after every
  `make_sandbox.py mansion` (make_sandbox.py does not read override files).

## Variants without a tier (task 3)

These five `B/mansion/assets.json` entries need `"tier": "fine"`: **`urn-decorative--porcelain`,
`urn-decorative--floor-vase`, `pedestal-display--marble`, `candelabra-standing--s1`, `candelabra-standing--s2`.**
Their roles are new in this batch and shared with the crypt (`urn-decorative--s1/--s2`, `pedestal-display`) and the castle
(`candelabra-standing--iron`), so build_data's "role + family already in the library" rule does not catch them and all
three types roll each other's. (`tier` is an assets.json field: make_manifest.py's overrides cannot set it.)
Checked with the same helper, which sets `tier` = `fine` on those five manifest rows: build_data turns them into
`noble`; no role becomes `only` (each keeps an open sku), mansion rooms then roll only the porcelain urn / marble
pedestal / gilt candelabra (tiers 8,942 of 8,942), crypt rooms only their own (crypt.test 0 failures), golden 0 differ.
`bed-canopy--state` and `flowerbed--parterre` already come out `noble` (the pair rule).

## Master bedroom: is `PROGRAM_OF['mansion-bedroom'] = 'fine'` good enough?

It would run and roll the state bed and noble bedside cabinets. It loses the marble fireplace (the inn's hearth zone
names `fireplace-wall`), the bench across the foot, the commode, gown, chaise and bureau (only by luck through the generic
fill), the sconces by the bed and the grand chandelier (`attempt()` hangs `chandelier-ring` when `key === 'fine'`).
So the bedroom has its own program; aliasing is the fallback.

## Design problems (for the mansion designer / supervisor)

1. ~~`washstand--fine` clash~~ fixed (renamed `washstand--state`; build_data no longer reports a skipped sku).
2. **The grand stair is 10 x 15 ft** (`vertical/assets.json`), not the 2x2 cells `mansion/rooms.json` says; it needs
   its run + 9 ft and a way past each side, which the new 5x6 default gives. It also needs the wall facing the front
   door free of doors: a hall with a room behind it gets the centre table instead (8 of 24 in the test).
3. **The formal garden's list does not fit its sizes.** At 42 cells (35 x 30 ft) the designer asks for the 8-ft
   fountain, an 11-ft gazebo, four 6-ft parterres, 16 roses, two corner trees (8-ft crowns), benches, statues, urns.
   With 5-ft walks the four quarters are about 13 x 11 ft each. The program gives the 8-ft fountain only from 33 ft each
   way (else the 5-ft one), parterres before trees, and lands at the yard's density, not the list's (about 4 per 100 sq ft).
4. **Gazebo and gate want the same spot** (the far end of the main axis; `yardGate` puts the gate straight across
   from the house door). The gazebo is placed only when the gate is elsewhere: 38 of 192 gardens.
5. **No balustrade is laid**: the "house side" of a garden is the house's own wall, so there is no edge segment for
   `balustrade-stone` to stand on; it would need a terrace strip. `hedge-straight` has only the `--low` (38 in) mesh
   and `hedge-corner` is unused (turns take the end block, as the yard does).
6. **The ballroom cannot be 60% empty at 8x6**: 50-55% with a 3-ft band at the walls and the musicians' end. Its
   density target (2.5) and the hall's (3) are entered as 3.5 (the tuner's yard test holds 2 <= 0.6 x every indoor target).
7. **The conservatory's fountain needs 17 ft across** (4 cells; the new 5x4 default has it); narrower ones get the palm.
8. **Dining chairs cannot tuck under the table** (the occupancy grid forbids overlap): they stand about a foot off it.
9. **Library**: bookcases cover 40% of the wall, not 50-70% (doors, windows, the fireplace).
10. `prefer_skus` naming inn meshes can never be rolled where a noble mesh of the role exists (`table-side--fine`,
    `chair-armed--fine`, `candelabra--fine`); `desk-writing--fine` and `pedestal-display--marble` are used by no program.

## Needs in shared files (nothing below was edited by this fork)

1. `hunks/walls_tail.once.js`, `specialDoor`: the OLDEST room's rule wins a shared door, so the conservatory's
   `door-glazed` and the cellar's `door-reinforced` lose to the hall's `door-panelled`. Wanted: a `rank` on a DOORS rule.
2. `tests/ccm_lib.mjs`, `checkRoom`: let `stair-grand` through the ceiling check by name; skip rule `drapes` in the
   outside-the-room check; treat a hung flat's depth as zero. (mansion.test.mjs shrinks a copy of the layout meanwhile.)
3. `make_sandbox.py`: read `manifest_overrides.<type>.json` when it fakes a manifest, so the caps need no second step.
4. `B/mansion/assets.json`: the five `tier: fine` entries above; `B/mansion/manifest_overrides.json` = the draft here.
5. `KEY.kitchen` and `KEY.cellar` are wrapped by 30-mansion.js. If the castle also wraps `KEY.kitchen`, the wrappers
   stack in file order and each must test `ctx.type.key` (the mansion's does).
6. `programs/00-common.js`: `ccmAt` now takes `sku`; 30-mansion.js still carries its own `mansionAt` (quiet by default)
   and `mansionChandelier` (`ctx.ceiling()` takes no variant). Harmless; could be folded later.
