# Bug sweep lane (bugs), 2026-11-06

Sources: docs/KNOWN_BUGS.md and wiki projects/3d-vtt/backlog ("Bugs and leftovers", "Picking", "Hills and caves").
Rule: reproduce with a test that fails on the old code, fix, prove. Three sub-lanes ran in their own worktrees:
stairs + hills (A), small bugs (B: seat, goblins, keys, deploy modes, dice W7), room dressing + fog (C).
Their own notes: experiments/2026-11-06-bugs-sublane/, experiments/2026-11-06-room-dressing/.

## Done here (engine/test/browser_pickfixes.py, engine/test/rerollwalls.test.mjs)
- **Wall picks the pawn behind it.** `pickAll` ranked every pawn under the ray first. Now what lies past the first
  wall piece ranks after it. Old 6/9, new 9/9 (WALL).
  - Trap: a freshly spawned room's walls rise one by one, the camera-side ones LAST (`world.anims`). A test that picks
    during the build sees the near wall missing, then present. Wait for `anims.size === 0`.
- **Cursors on the ground.** Presence now carries `[x, z, floor y, lift]`; the relay accepts 4 numbers (never on a
  ping) and still judges hidden rooms and fog by `x, z, floor y`. Old: 15 ft off a table top, 6 ft off a pawn; new
  under 0.01 ft (CURSOR). "Nick's hover cursor" read as other seats' cursors; unconfirmed reading.
- **Tilted table floats.** Two causes. (1) the data: riders never moved; now `app.tiltLandings` poses the table as it
  will lie (`world.withTilts`) and drops each rider onto what is under it, in the roll's batch. (2) the settler
  (tuner settle.js) seated riders on the parent's UPRIGHT mesh. That was the 0.34 ft sink at 15° (its rays start
  0.35 ft up). Old 7/10, new 10/10 (TILT).
- **Re-roll ignores deleted walls.** The solver's openings came from the rooms only; GM 'open'/'wall' edge edits now
  apply (`roomgen gmOpenings`). Old 3/5, new 5/5.
  - The strip metric needed care. Things hugging the side wall round the corner, wall trophies and hanging pot hooks
    are not "in the gap".
- **Pawns on roofs with roofs off.** `world.offRoof` hid loose things only; now pawns standing on a roof too (not flyers).
  Old 6/8, new 8/8 (ROOFPAWN).

## Seen, not fixed
- A "beans bowl" on a common room's bar counter (a kit piece) measured 1.28 ft over the counter top, as drawn
  (seed 4402). C's resting test passes all rolls, so this is a lead only, unchecked.

## Pre-existing failures (same on unchanged main 0543729f, own worktree)
- browser_rooms 127/133: 2 piece multi-move checks, 4 ring-menu listing checks.
- browser_pawnring 105/108: preload pictures.
- browser_tilt: crashes after 24 ok on a NoneType.
- settle_test 3/5: 0 items, from how I served it (environmental).
