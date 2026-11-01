# Roof controls (scope 1 of the roof round, 2026-10-27)

Harry: "They also need to be deletable so rooms can be open to the sky, and rotate able on the 90 degree, so profiles can work."
Brief: scratchpad roofs/COMMON.md (scope 1: CONTROLS). Branch `roofs-controls`, worktree ../3d-vtt-roofs-controls.

## 2026-10-27 ~22:00 design
- DELETE = room.roof.off (existed as "Hide roof"). Delete/Backspace on a selected roof now does it (main.js deleteSelection:
  a roof in the selection becomes room.set { roof: { off: true } } in the same batch). roof.hide kept as the id (chords,
  ring tables) but reads "Remove roof (the room is open to the sky)"; room.roofShow reads "Roof back".
- Found while checking "open to the sky elsewhere": an off room was still PLANNED (only its drawing was dropped), so a
  neighbour's gable end at the join counted as closed by the missing roof: a triangular hole over the shared wall.
  planRoofs now skips `none` rooms for parts and roofs (they still cover the rooms under them).
- TURN = room.roof.axis 'x'|'z' (absolute: the way the ridge runs in plan). Chosen over a relative `turn` because joined
  rooms' automatic axis depends on neighbours (a relative turn would flip when a neighbour is added), and the brief wants
  "the forced axis wins for that room's rectangles". A turn back to the automatic axis stores nothing (planRoofs reports
  autoAxis). room.rotate with odd quarter turns flips a stored axis, so a turned room keeps its turned roof.
- SHAPE = room.roof.shape gable|hip|flat (planRoofs already had kind gable|hip; flat added). building.roofShape for a
  whole building. Shape is separate from style: flat shape draws the flat surface whatever the style; style 'flat' is
  flat whatever the shape (scope 2's flat SURFACE styles slot in there).
- Ring: roof.turn on the roof's closed ring, slot 10, drag 'roofturn' (ring.js startRoofTurn): snaps to quarter turns,
  previews via world.roofTurnPreview (this tab only), click = a quarter turn. R key. Space S = Shape, Space Q = turn.

## 22:40 results
- node: roofs.test.mjs 93/93 (26 new), core 741/741 (6 new), npm test all green.
- browser_roofturn.py (new) 40/40 local. Regressions: roofs 61/61, build 98/98, storeys 43/43, cut 142/142.
- Gemini (agy-run), before/after of the cottage turned: "Yes. The roof ridge has been turned 90 degrees so the
  triangular gable ends now face the long front and back walls instead of the short side walls." Defects it named:
  the big gable is "a flat, untextured, monochrome tan polygon" (scope 3's gable work), and the dormer/finial looked
  off in the turned view (follow-up side view: "Not seated ... only an anomalous thin wooden strip clips across the
  lower slope"). The dormer is placed by the unchanged trim rule; noted for goal 4 (trim) to measure.
- fal spend: $0.

## 23:15 landed goals 1-3 (406f8b59, candidate 20261027-231229-406f8b59); browser_roofturn 40/40 against dev.

## 23:20 goal 4: the trim is touchable (Harry: "those chimneys and windows and stuff that stick out of roofs should be selectable & moveable objects as well")
- Design (a) overrides: room.roof.trim { key: { at: [x, z] } | { gone: true } }, at from the room's corner. Not (b)
  things of the room: a thing would not follow a re-roll / turn / re-shape, and the ordinary move puts a thing on the
  ridge, not on its slope; (a) needs only a pick, a drag and one room.set.
- Keys: chimney:<fire id>, dormer:<part rel>:<face>:<n>, finial:<part rel>:<end>, else <role>:<x>:<z> (so scope 2/3's
  rule-placed pieces get keys for free; with a `slide` they move too). slideProp (roofs.js): 'roof' (upright on the roof
  under it; a chimney's height recomputed) and 'plane' (a dormer: its own slope, clamped to its box).
- room.rotate drops roof.trim (the old footprint's places); room.move keeps it (relative coords).
- The touchable audit (test/audit.py) said trim must resolve to its roof "by decision"; Harry's new word reverses that:
  a keyed piece resolves to itself now; the ridge cap is still the roof's.
- The ring didn't rebuild when a piece was moved (its signature never looked at roof state): added moved/shape/axis.
- Dormer seating (Gemini's worry in the turned shot), measured: drawn min y 12.35 vs roof 15.3 there, max 18.85: its
  foot is in the roof and it stands out of the slope. Not a turn defect.
- Results: roofs.test 101/101, core 742/742, npm test green; browser_roofturn 54/54; roofs 61/61, build 98/98,
  storeys 43/43, cut 142/142 (cut before the audit edit).
