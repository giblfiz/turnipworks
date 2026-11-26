# Pawns lane, 2026-11-06: resize and flying (engine side)

Harry: "doing resizing for pawns (which should also change their footprint) also for pawns that often fly (like say a
dragon) let's make an alt of them flying and when they get their vertical set switch to flying mode."
The flying figures themselves (generation, cost, Gemini reads): `fly/LAB_NOTES.md`. As built: docs/PAWNS.md "A pawn's
size" and "A flying pawn".

## What existed (read before changing)
- `size` was already on pawns, definitions and cast entries: whole squares a side, 1 to 4, checked by `figProblem`;
  only the BASE and the occupied squares read it. The figure was drawn at its made height whatever the size (docs/PAWNS.md
  2026-10-12: "two sizes and they are independent"). A large figure stood on 2 because placing wrote its figure's size.
- A "Enlarge / reduce (later)" stub in the ☰.
- Pawn moves are never blocked by walls in the engine (client/vision.js note); the blocked-move feedback that exists is
  solid rock (held at the last legal place during a drag; a toast for arrow keys / the bar) and a room drop that overlaps
  (red label, toast).
- Raise / lower: a pawn under 5 ft over its base settles (`PAWN_BEAM.land`); the base stays down, a beam joins them.

## Decisions
- One number, `size`, squares a side; 0.5 (tiny) and whole numbers 1 to 8. Absent = 1 (kept: the client's fallback to
  the figure's size was dropped so the client and the relay read the same rule; every way a pawn is made writes its size).
- The figure scales by `size / made size`, except a figure made tiny already is not shrunk again (`figureK`).
- Definition = default, pawn = override. Changing figure keeps a chosen size.
- Fit = the disc's radius from every wall, for bases over one square only. Client-side hint like the movement rings; the
  relay checks the value's shape only.
- Flying = 5 ft or more over the base (`FLY.at` = `PAWN_BEAM.land`); a soft shadow for any pawn in the air.

## Runs
- 22:40 `node test/size.test.mjs`: 42/42 first run.
- `npm test` touched suites: core 748, llm 267 (the short card has a budget: the SIZE line moved to help/pawns only),
  share 210 (an invalid size in an imported pawn must still reach the reducer's check: sizeField was dropping it
  silently — fixed by passing it as is), party 74, pawnbase 30, harness 5, walk 25, the rest unchanged.
- 22:55 `browser_size.py --local`: 31/32; the one miss was the test's own idea of a tiny formation (nearest free
  quarters spread in a cross, not into one square): rewritten to test sharing a square and never taking a quarter.
- After the rebase on main (478bcb13; one conflict, figures.js imports: main's figsearch.js kept): size 42/42, core
  748, llm 267, share 210, browser_size 32/32 on the real fly rows.
- Touched browser suites, branch vs unchanged main (git archive of 0543729f, same box, run back to back):
  pawnbase 44/44, shift 29/29, moverings 49/49 on the branch. browser_rooms: the ☰ tables now list Size (and Aura,
  which they had missed: failing on main too); "a multi-selection of pieces moves as one" fails on the branch and not
  on the base, but the base never loaded the wall window's mesh (its box placeholder was picked) while the branch did and
  the press went through the window's opening: an environment difference, not this change (debugged with pick
  traces). browser_figs (label keys, label height, stair), lift_hard (table top), statusfx, fly (roof click), pawnsmenu
  (follow): failing on both, or the base could not load figures to compare; for Fauna to rerun on main.

## Gemini, blind (gemini-3.8-flash-high via agy-run; neutral names; labels first)
Stills: /mnt/usb/turnip-works/lanes-2026-11-06/pawns/stills/size-*.png.
- Dragon on the ground vs at 20 ft: "Red dragon: standing on the ground (100%)" / "flying in the air (100%) ... directly
  over the ground base labeled Red dragon ... a vertical riser connects the ground base to the elevated dragon, 20 ft".
  The hero raised with no flying pose: also "flying (100%)", by the riser.
- Medium / large / huge: "the exact same model ... at three standard tabletop scale categories"; heights 1 : 2 : 3,
  bases 1 : 2 : 3 ("1x1, 2x2, 3x3").
- It did not mention the shadow (the base and the beam carry "where"). It said the STANDING red dragon faces away
  from its base's facing arrow while the flying one faces it: the standing figure's own facing, not looked at here.
