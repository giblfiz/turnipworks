# Denser City and Cyberpunk rooms (lane `denserooms`, 2026-11-07)

Harry: "many of the cyberpunk rooms need to default to denser packing as well as with modern rooms"; then "note some of
our isle-packing options", "it can look at how storage rooms are done in fantasy (aisles)", "is there anything we can bring
over or re-use from our existing model sets? Like fantasy surely has some useful stuff (all those vegetables, etc.)".

## What the density setting is (found, not invented)
- `solver2.js` `DENSITY[type]`: props per 100 sq ft, the per-room-type default. Fantasy rooms reach it because
  `attempt()` runs `fillDensity()` (edge dressing toward the target) after the zones. Every program room (castle, crypt,
  City, Cyberpunk...) ends with `ccmDone()`, which switches that fill off, so for them the number was only REPORTED.
- There is no game-side slider; `docs/PERF.md` "levers" are frame-rate switches, unrelated.
- Measured on main (adfd00a7), `measure.mjs`, default size + two others, 6 seeds: every City/Cyberpunk room stood at
  15-80% of its own target (`before.json`); the fantasy rooms sampled sit at or above theirs (common 8.3/8, wizard study
  5.9/6, mansion library 6.3/4.5).
- The aisle packing is `aisleStore()`, the storeroom/cellar grammar (`PROGRAMS.storeroom`, `.cellar`), already reused by
  the industrial kitchen and the dormitory through its `cfg`. That is what the rows here use.

## What was done
- `modDense()`: walk the ways first (a hub's swirl via `cbLoop`, the main door to the key piece's front or nearest
  reachable side, other doors to the main door), then the room's own list against free walls, like with like, until the
  DENSITY target, the walls are full, or 42% of the floor is covered. A candidate with no 3-ft way to its key piece takes a
  15-point score penalty (`ctx.scorePenalty`, finish()), so best-of-4 prefers one with a way.
- `modTops()`: things on top of pieces the solver keeps no surface for (cafe tables, counters, the kitchenette). Never on
  desks: the `vehicles` lane is placing desk debris.
- Shared roles: after the rebase on main 8c7a9056 the guards (`modOnly`/`cybOnly`) admit `modShared(id)` = the modrooms
  lane's `MX_BORROW` (their vetted looks) plus this lane's `MOD_SHARED` (23 roles not in it), filtered to `modLooks(id)`
  (`MOD_LOOKS.crate = ['crate--s4']`). Overlapping roles (rugs, potted plants, bread, potato crate) now follow MX_BORROW.
  Note: MX_BORROW passes apple-crate and fruit-crate-mixed, which this lane's plate read called medieval; the fills here
  do not ask for them.
- `modAisles()` = `aisleStore(ctx, 'mod-rows', ...)` with: no lanterns (new cfg `lamp: null`), modern receiving stock
  (`recvIds`), forced `rows`, `wallMax`, `minRun`; rows of one unit are undone whole (`minUnits`). Zones it adds are
  `noLamp` (attempt() would hang a fantasy lantern over every zone of a big room).
- Rows: corner store (shelving, fruit-crate end caps), server room (racks; ranks stay the fallback), warehouse (racking,
  the storeroom's own rolls and 3.5-4-ft aisles, double downgrades to single), magic shop (a double curio shelf down the
  shop when it is deep enough from the door), capsule hotel (a back-to-back middle row from a 33-ft-wide hall).
- Targets raised: clinic 4 -> 5, noodle 5 -> 6, hideout 4 -> 5, rigger 3.5 -> 4.5. Unchanged: street, alley, parking
  garage, lobby, rooftop (open), capsule (its walls are full at the default size: 53% of the floor).

## Blind reads (Gemini via agy-run, one call each, random names, before + after at table distance)
- r1 (all 12): fuller in 11 of 12, the same in 1 (office, already 8/10); nothing medieval. Flagged: the store's "two counters
  inside the doorway" and "gondolas clipping" (wooden end caps and back-to-back rows), the magic shop's middle shelf "in the
  walking route inside the doorway", the bar's "table and stool just inside the doorway", two safehouse mattresses touching.
  Fixed: an apron kept clear inside every door, `doorLane` for the shop shelf, single rows and no end caps in the store, the
  warehouse walks its ways before staging pallets, no extra safehouse mattresses.
- r2 (all 12) and r3 (store, warehouse): doors clear in both; r3 called the wooden crates and an "iron-banded chest" (a
  crate sku) medieval. A read of the ten crate plates: crate--s1/s2/s3/s5, fruit, apple and bottle crates read medieval;
  crate--s4, cabbage and potato crates read modern. Those three alone are shared now.
- Every read flags "fluorescent fixtures floating / on the floor": the tuner draws ceiling fittings; the game does not
  draw them from the table (world.js CEILING_FITTINGS, the cyberpunk lane). Not this lane's.
- The 0-10 fullness scale drifts between calls (the same before-picture scored 3 and 5): read within one call only.

## Dead ends, kept for the next one
- An inline `//` comment inside a one-line object literal ate the rest of the line twice. Comments go above.
- Walking the bar's swirl before the booths lost the booths (KEEP along the walls): walk after the wall pieces, before
  the floor pieces.
- The office ranks tightened (aisle 4 ft, margin 1.8 ft) broke audit()'s 2.5-ft walker to the cubicles: reverted.
- Tops before the wall fill met the target with cups and bowls and left the floor as bare as before: walls first now.
- audit() `walkable` is an imperfect guard here: its key piece is the first KEY_RE match (the hideout's first FENCE
  section), its goal the piece's front. It was already under 1 on main for several rooms (server 0.22). The suite guard is
  `ccm_lib.walkCheck` (a 2-ft walker on the finished layout: doors joined, standing room by the key piece).

## Files
- `measure.mjs` (OUT=file.json): density / coverage / walks per room; `before.json`, `after.json`.
- `tools/room_shots.py` (the cyberpunk lane's, reused), `tools/link_main_binaries.py` (tuner assets only),
  `tools/run_node_suites.py`.
- Pictures: `/mnt/usb/turnip-works/lanes-2026-11-07/denserooms/` (`before/`, `after/` final, `after-r1/`, `after-r2/`,
  `contact-sheet-before-after.jpg`, `blind*/read.json`, `crate-read.txt`).
- Waiting loops: `until ! pgrep -f X` matches its own shell and never ends. Wait on a file instead.
