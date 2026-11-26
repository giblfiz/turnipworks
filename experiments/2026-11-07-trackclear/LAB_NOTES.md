# The props' resize track clears the top chrome (lane `trackclear`, 2026-11-07)

Follow-up to `pawnsize` (933ea265): its third blind read found a pawn's "gargantuan" under the Hide pill, so the pawn's Size
track was stopped short of the command bar / area pills / crumbs. The props' track (`edit.resize`, same `makeTrack`) still
ran to 24 px from the screen's top, so near the top it ran under the same chrome.

## What I built
- ring.js `trackRoom(cx, cy, ux, uy, cap)` -> `{ reach, edge }`: `edge` is the old screen-edge room (24 px inset, capped);
  `reach` is that stopped 16 px short of the first top-chrome element (`bar`, `launchers`, `roster`, `underBar`) the ray
  crosses the bottom edge of, within 60 px. The pawn's inline loop is gone; both tracks call it.
- Generalised one thing from the pawn's version: the pawn's check tested the bar's span against the CENTRE's x (cx +- 60);
  the prop's resize slot (11.34 o'clock) is ~20 deg off vertical, so the ray reaches the chrome ~100 px left of cx. The
  helper tests the x where the ray actually crosses the bar's bottom. Same answer for a vertical ray.
- Props: `kMax = min(old kMax, softK(max(1.01, reach/d0)))` only when the chrome binds (reach < edge). Old floor of 130%
  is kept where only the screen edge binds. Mapping `softK(d/d0)` untouched; the handle can still be dragged past the
  rail's end (as it could past the 420-px cap before).
- Fallback added after browser_track.py: its SIZE frame grabs the cauldron's handle at y 91, in among the area pills
  (reach <= d0), and the first cut gave it a 101% rail (2 new FAILs). Clearance now applies only when reach > d0; with
  no clear room past the grab the old 130% rail stays. browser_track.py is then the same as on f939b9b7: 2 FAILs and a
  traceback at LIFT (s0['track'] is None) that predate this lane.

## Numbers (the stills' frame: 1280x820, grab at y 164, centre at y 488)
- before: rail ends at (560, 66), inside `#areaState` (58..87.5); max 130%.
- after: rail ends at (574, 142) = crumbs' bottom 125.7 + 16; max 107%.

## Open
- Near the top the visible rail beyond 100% can get very short (107% here, 101% at worst). The size still grows past it.
  Harry's call whether that is fine or whether it should compress (fit 130% into the room: would change the feel).

## Pictures (USB: /mnt/usb/turnip-works/lanes-2026-11-07/trackclear/)
`stills.py ROOT TAG OUT`: before-prop-high.png (this branch before the change = f939b9b7 code), after-prop-high.png,
contact-sheet.png. Blind Gemini read: gemini-read.txt (names in blind-map.txt): before "runs underneath the breadcrumb
bar ... readout pill covers part of the Open to players pill"; after "stopping approximately 15-20 pixels below the
breadcrumb bar ... No" overlap; picked the after image as the clear one.
