# First person: walking (FPV walk), 2026-10-30

Harry, 2026-10-30: "FPV movement, which I notice I get stuck on stuff because I'm trapped on the grid." Critical, base-level
polish. Branch `fpvwalk`, worktree `../3d-vtt-fpvwalk`. DEV only. Code: engine/client/surfaces/fpv.js (the walker),
engine/client/main.js (`app.walkStep`, `moveBy`'s `walk`), engine/core/commands.js (`token.move` `walk`), engine/relay/campaign.js
(`joinsWalk`). Doc: docs/UI.md "First person" ▸ "Moving: walking".

## What "stuck" was (read from the code, then measured)
- A W press was a WHOLE-SQUARE step, its direction the view's snapped to the nearest of eight, refused outright when the
  centre-to-centre line crossed a wall (`stepBlocked`); held, it retried the same refused step every 260 ms. No sliding.
  So: look along a wall a little into it (or at anything 23–67° off an axis near a wall) and the snapped step goes INTO the
  wall, forever. Measured: 9 of the 10 "along a wall" walks on origin/main stuck exactly 5.9 ft short (a square and a body).
- A diagonal step through a doorway's corner is refused (the wall's ends are stretched 0.05 ft so a diagonal cannot squeeze
  between two walls meeting at a point): aimed at a room beyond a doorway, the grid walker stops at the jamb.
- NOT furniture: furniture never stopped a step (vision.js blockers: walls, doors, cave rock; plus windows and shut bars).
- Off-grid pawns are legal in core (`token.move` x, z are free numbers; a dragged pawn has moved freely since 2026-10-11; the
  pref "Pawns snap to squares: always" snaps). So the walk is OFF-GRID, and snaps at the end only under that pref.

## Design (each a constant in fpv.js WALK)
- Held keys give a direction from the view (several add up), velocity eases to WALK.speed 11 ft/s (Shift x1.8) with
  WALK.accel 16/s. The walker is a circle, WALK.radius 1.5 ft (2 ft max for big pawns), pushed out of the wall segments it
  overlaps each substep (≤ 0.4 ft), never crossing one: that is the slide and the corner rounding. Same segments as before
  (`moveSegments`).
- Heights per substep by `app.walkStep` (moveBy's own rule, extracted: `standY`): stairs climb smoothly, a drop or a pit stops
  the walk there (moveBy offers the fall), a ladder / spiral square hops (moveBy) and stops the walk.
- The pawn: presence drag every frame (others see it glide, 18 Hz, smoothed), `token.move` with `walk` every 250 ms and at the
  end (fog's reveal follows the real pawn), one undo step per walk (relay joins moves of one walk; rulers.test.mjs +5 checks).
  A walk's `token.move` does not end the seat's presence drag (main.js onEntry), else the others' pawn would flick back.
- Someone else moves the pawn mid-walk (GM, undo, a refusal): the walk ends where the pawn is.
- Snap pref "always": nearest legal centre at the stop; a tap that has not left its square goes one square on (the old step,
  so `browser_fpv`'s tap checks and the habit both still hold).
- Locked mouse: a click is a click at the centre dot (was: a step forward).

## Stuck rate (walk_stuck.py; inn seed 101: 16 rooms, 548 things, 2 stairs; 36 routes frozen in routes-inn-101.json)
Driver: every 30 ms look at the current aim (+ a hand wobble), W held (a real keydown on the window: same input for both
builds). Stuck = no 0.5 ft nearer for 1.5 s; failed = stuck > 4 s or 40 s. Routes over a stairwell / hole are left out
(both builds rightly stop there and offer the fall).
| scenario | origin/main f0228c68 (grid step) | fpvwalk |
|---|---|---|
| A: wobble 8°, aims at doorway middles | 15/36 failed (41.7%), 15 stuck events, median 1.40 s | 1/36 (2.8%), 1 event, median 2.0 s |
| B: wobble 20°, door aims 1.5 ft off middle | 3/36 (8.3%), 10 stuck events, median 1.68 s | 2/36 (5.6%), 2 events, median 2.0 s |
| A, snap pref "always" | - | 1/36 (2.8%) |
(The grid walk is faster where it works: 19 ft/s in square hops vs a walking 11 ft/s.) The one failure left in A: "direct
h:8:7 common -> privy" aims a hair east of the corner where two open doorways meet (h:8:7 and h:9:7, wall x 45 between
them); the body rounds that corner on the kitchen's side and goes through the wrong doorway, then presses on the wall. B's
second: an aim reached 3 ft early beside a doorway, then the next aim through the wall: the slide takes her along it, away.
- Smoothness: eye speed per rendered frame while walking, p5 10.3 / median 11.0 / p95 11.1 ft/s (147 frames). Observer (the
  GM's map, presence glide): p5 3.6 / median 10.0 / p95 16.1 / max 18.8 ft/s: no jumps (a square's jump would read 300).
- Cost: the eyes' frame 0.3 ms median, 3.6 ms p95 (the frames that journal a move: moveBy 3.8 ms here); walkStep 0.18 ms.

## Gemini (agy-run gemini-4-argon-high; describe first, then judge; contact sheets of 6 frames)
- r1 (radius 1.2): wall walk 2/10 "Pressing into a wall puts the camera centimeters from the mesh"; door walk staged badly
  ("There is no doorway in door.png at all": the first frame was already past it). → WALK.radius 1.5 (eyes a foot off a
  wall's face: raycast from the eye at rest against a wall, 1.07 ft; near plane 0.25), stills restaged with steering.
- r2: path along the doorway walk on the map "progresses sensibly ... through the door into the Hallway" (5/10, the 5 for the
  staged stop at the end); "walks straight through the solid wooden door panel" (1/10). MEASURED, not mine: every OPEN door
  is drawn SHUT (its mesh box spans the opening: v:7:7 open, box x 34.83–35.17, z 35.31–39.65), so walking through an open
  doorway walks through a drawn door. Door open/close rendering is the other agent's lane (doors, chests): LEFT for it.
  Wall walk 1–2/10: the eyes measure 1.07 ft off the wall's face, no clipping; the stills staged an aim a foot INTO the wall
  so the last frames stare at it. Also seen, pre-existing: a seam of sky between timbers, labels over pawns.

## Suites (fpvwalk, local, box quiet: load 1–4)
- browser_fpv 68/68 (was 53: + WALK 11, phone hold 1, fog mid-walk 1, + tap/blocked wording), npm test all green (relay 228,
  core 748 ...), rulers 125/125 (+5 walk undo), pdoors 23/23, fog 43/43, pawnsmenu 168/168, stairs 44/46 (the same two fail on
  origin/main f0228c68: the cellar stair's ground cut, pre-existing).
