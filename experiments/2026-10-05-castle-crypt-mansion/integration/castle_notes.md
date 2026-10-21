# Castle: integration notes (the castle fork, 2026-10-05)

Files: `programs/20-castle.js`, `hunks/walls_tail.castle.js`, `hunks/solver_tail.castle.js`, `tests/castle.test.mjs`.
Sandbox: `python3 make_sandbox.py castle --scope once,crypt,castle` (fake meshes for all 374 specs).

## What passes (round 2: defaults great-hall 10x6, barracks 7x5; the courtyard has its own program)

`node tests/castle.test.mjs`: 1,152 indoor rooms (8 types x 6 sizes x 3 arrangements x 8 seeds), 192 courtyards (6 sizes x
4 arrangements x 8 seeds), 12 whole castles, 126 annex legs: **617,544 checks, 0 failures, 0 purpose fails.**
`--only=<key>` runs one type; `--raw` runs the spec sizes without the manifest overrides (also 0 failures).

| room | program | per room (mean over 144) |
|---|---|---|
| great-hall | `castleGreatHall` | dais in 60%, 2.2 seats on the lord's side, hearth in 80%, 0.8 trestles |
| throne-room | `castleThrone` | throne on a dais in 100%, runner in 80%, avenue of 9.7 |
| armoury | `castleArmoury` | 6.0 racks, 7.3 armour stands |
| barracks | `castleBarracks` | 6.8 bunks, 2.6 footlockers, guard table in 70% |
| castle-kitchen | `castleKitchen` (wraps the inn's `KEY.kitchen`) | 2.0 hearths, the great one in 70% of kitchens, never two |
| chapel | `chapel(ctx, CASTLE_CHAPEL)` | dais + altar in 100%, 4.1 seats |
| dungeon | `castleDungeon` | 2.0 cells, rack 100%, iron maiden 100% |
| gatehouse | `castleGatehouse` | clear gate-to-gate line in 100%, windlass in 80% |
| courtyard | `castleCourtyard` (in place of `yard()`) | 15.1 things, 14.6 edge pieces, focal in 160 of 160 that allow one |

Also in `sandbox/castle`: `tests/golden.mjs` vs `sandbox/pristine` (348 inn scenes, 0 differ); the tuner's own `yard.test`,
`solver2.test` (560 rooms), `solver.test`, `repeat.test`, `v2_fuzz`: 0 failures.
**`tests/crypt.test.mjs` shows 6 failures** ("a chapel of N cells with M seats", crypt-chapel alone / offHall). They are
not the castle's: a crypt-only sandbox built from the same tree (`--scope once,crypt`) shows the same six. Something
in the shared drafts or the real tree changed the crypt chapel since round 1.

Counted and excused: the **hub loop** (`attempt()`'s own walk after the hall is furnished) finds no way round in 8 of 144
great halls; the aisle walk is clear in every hall.

**Courtyard** (`castleCourtyard`, registered as `KEY.courtyard`, needs the scope-castle hook `(KEY[key] || yard)(ctx)`):
curtain wall (`city-wall`) on every open grid edge, on the grid line, rule `yard-edge`; a turret (`city-wall-turret`)
where a run turns or ends in the open, never at a vertex a building touches; the two-cell `portcullis` at the gate
(`gate-double-timber` 1 in 3; a one-segment gap between turrets where no neighbour segment is open); falls back to the
vertical kit's `wall-crenellated` / `-corner` when `city-wall` has no mesh. Then the well (2 in 3) or stone trough in the
open, every door's way to the gate reserved 4 ft wide, the watch by the gate (sentry box, brazier or beacon, banner,
watch lantern), things by each door by the room behind it, a training corner from 900 sq ft (two butts with their range
kept clear, two dummies and a pell, practice arms), siege stores at the wall. `ctx.densityTarget = yardTarget(area)`;
no `DENSITY.courtyard`. No inn things (the test holds a list). Not built: the sand patch, tourney rails, quintain.

**Dais** (task 2): solved both ways. `castleDais` reads the mesh's box and lays the LONG side along the wall, so the
spec mesh (110 x 170) is laid a quarter turned; and `manifest_overrides.castle.json` gives the dais the box 170 x 110,
which makes the solver's own box rule turn it (the right fix: hand placement in the game then also gets it the right
way round). The test asserts the long side is along the wall with the override and with `--raw`.

**Tall pieces** (task 3): `manifest_overrides.castle.json` caps `banner-pole--s1/--s2` and `pillar-round` at 104 in (their
catalog `scale` is 0.9-1.1, which at the tuner's 15% variety is +-1.5%, so 104 in stays under 8.8 ft). The fake meshes
take their size from assets.json, so the test applies the override file to ITS OWN copy of the library (`sku.size`, as
build_data.py reads the manifest's `size` column): 465 poles placed, 0 over the wall; the excuse is gone (it remains
only under `--raw`). Left tall on purpose: `city-wall` 132, `city-wall-turret` 156, `gate-double-timber` 120,
`mil-signal-beacon` 120: all outdoor-only, and a curtain wall should overtop the buildings. Poles still stand on the
floor at the ends of the dais, not on it (104 in + a 16-in step).

## Design problems (for the castle designer)

1. **Dais vs table**: handled (see above). Still true: `dais--s2` (110 square) cannot carry any `table-feast`, so a hall
   under 17 ft across has its high table on the floor.
2. **The great hall rarely gets its trestle rows as specified, even at 10x6.** Dais 9 ft + hearth working face + 6-ft aisle
   + door landing leave room for 1-2 trestles, not two rows. With the door in a long wall I moved the hearth to the end
   wall opposite the dais, or it and the door landing take both rows. The spec assumes the door is in the short wall
   facing the dais; door sides are seeded (`chooseExteriorDoor`, being edited by another agent), so this is not guaranteed.
   Same for the throne room and chapel ("door in the short wall facing the throne").
3. **A 6x4 barracks cannot hold 12 bunks, footlockers and a guard table (the default is 7x5 now).** The real bunk meshes are 4 ft wide
   and 6.5 deep: two walls of bunks leave a 6-ft way, footlockers at both feet leave 3.3 ft (under the 2.5-ft-clearance
   standard after rounding), and a table in the middle closes it. At 7x5 both walls get bunks and footlockers; the
   table stands against the door wall.
4. **Tall pieces**: capped in `manifest_overrides.castle.json` (see above); the catalog lines could say 104 too.
5. **`cook-hearth-spit--great` is 11 ft.** Castle-rough walls roll arrow slits on 1 edge in 4, and tall pieces avoid
   windows, so only 70% of kitchens have a clear 12-ft run. The rest get the inn's hearth.
6. `armoury`'s recipes name `armory-rack-filled` and `weapon-rack-enchanted`, which have
   no catalog line.
7. **Named by the recipes, in no batch**: `skeleton-chained`, `spear-bundle` (and the smalls in each room's `missing` list
   in `sandbox/castle/build_data.log`). Nothing a program depends on.
8. **`cell-bench-plank` is a hung piece 24 in deep**: it can only hang on a room wall, so it lands on the cells' back wall,
   not a side partition. `door-cell-bars` catalog box is 36x3x84 but the spec is a 60x4x108 panel (own size is used).

## Needs in shared files (what is left)

1. **The crypt chapel regression** above (6 failures in `crypt.test.mjs`, with or without the castle scope).
2. `ccmFocalOn` and `chapel()` still take no sku wish (`castleChapel` wraps `ctx.chooseSku` to get `dais--s2`); `ccmAt`
   has one now, `castlePut` is kept only because it also quiets its miss. `seatFor` / `ccmRanks` size by the catalog
   line, so `pew--s3` (66 in) is never chosen: a 4-cell chapel seats on `bench-stone`.
3. `solver.js` `ctx.rug` and `ctx.ceiling` take no sku wish (`castleRug`, `castleChandelier` record directly).
4. `PROGRAM_OF` is not used for the castle kitchen (with it every cooking line rolled the 11-ft hearth and 6 of 144
   kitchens had none): `castleKitchen` wraps `KEY.kitchen`, and `MENUS['castle-kitchen']` = the inn's menus + a last
   entry that calls `kitchenFill`.
5. `manifest_overrides.castle.json` must be copied to `../castle/manifest_overrides.json` before `make_manifest.py`.
6. `engine/client/pack.js` `APART` needs `'courtyard'` (never packed inside a building).

