# Riders lane, 2026-11-07

Harry: "If I stand a pawn on a table, and then I move the table, it should move the pawn with it." Global engine rule;
the `modrooms` lane's elevator car relies on it (moving the car vertically carries its riders).

## What was already there (found first)
- Things already rode things since 2026-11-02 (`parent`, `restingOn` / `goesWith` in core/commands.js): moveBy, the drag,
  Turn and liftTo each sent the children's moves as separate ops in a batch. Pawns never rode: a pawn has no parent; its
  base is drawn on the highest surface under it by `world.pawnBaseAt` -> `world.surfaceBelow` (a downward raycast).
- An AI seat's `object.move` through the relay moved the thing alone (the children stayed, floating).
- Permissions: only GM-side seats hold `object`. Players cannot move things. A batch is checked op by op with each op's
  own class, so carrying another player's pawn as a `token.move` op would be refused for any seat without `token.move`.

## Decisions
- **One mechanism, in core:** `object.move` gains `carry: [ids]`. Core moves each rigidly with the carrier (offset kept,
  turned about the carrier's middle by the change in rot, raised by the change in y; a carried object's room recomputed;
  a carried pawn goes through `pawnIntoRoom`, so it hides in a hidden room as a walked pawn does). One command = one log
  entry for every seat, one undo (touches lists the riders). Old journal lines have no carry: unchanged replay.
- **Permission = the carrier's** (Harry's ruling, relayed mid-task: "riders ride regardless of who owns them"). The rider's
  class is not checked; `carryProblem` checks plausibility (objects: in the carrier's parent chain; pawns: over the box of
  the carrier or another carried carrier, feet between its floor and 1 ft over its top). Locked things never ride.
- **Membership:** things by `parent` (unchanged); pawns by the browser's own downward look (`app.pawnCarrier`: what the
  base is drawn on, feet within 0.35 ft of the hit), falling back to the data (`carrierOfPawn`: box top within 0.6 ft) only
  when nothing is drawn under the pawn. The relay (AI seats) uses the data. Snapshot at move start (drag grab, key press,
  ring grab), passed through to the release.
- **Client paths moved to carry:** moveBy (arrows, bar), the drag (single placement and group), turnOps / rotateSelection
  / the ring's turn (preview via `app.posesOf`), liftTo and the ring's raise preview. Things on things now ride in `carry`
  too (one op instead of a batch of child moves).
- Not carriers: tiles, holes/pits, stairs/ladders, wall pieces, doors, windows, wall-hung things. Pawns are not carriers.

## Results
- core riders.test.mjs 29/29 (8 before); riders_relay.test.mjs 20/20 (10/20 on old code); browser_riders.py 34/34
  (22/34 on old code: every riding check fails).
- Regression run: see the report (suites listed there).

## Found on the way
- Gemini's blind read of the stills: the rider's base was drawn ON THE FLOOR under the desk with a "2.5 ft" beam, though
  its stored y was the desk top. Cause: pawnLandY settles at the mesh top (2.4539), the move rounds to 2.45, and
  world.pawnBaseAt required `sb.y <= y`. Fixed with a 0.02 ft rounding allowance; browser_riders asserts the drawn base
  on the top, before and after the lift.
- Regression run at --jobs 3: browser_shift and browser_fpv failed under load, both pass alone (29/29, 81/81).

## Open
- Pawns on a TIPPED thing (Roll) do not land (tiltLandings is things only). Delete / hide of a table leave its pawns.
- A tab opened before the deploy applies a carry as the carrier's move alone until reload.
- `tools/run_all_tests.py` refuses to run on main too: MATRIX ERROR (38 unclassified suites, missing tools/perf-bench/lightuse.py). Not this lane's.
