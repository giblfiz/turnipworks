# Rulers and templates (Harry and Fauna, 2026-10-11; as built 2026-10-12)

Harry's decisions are quoted. Everything else is Fauna's design, which he asked to see built; each such choice is
listed under "Decided without Harry" with the one place to change it.

Code: `engine/core/measure.js` (the numbers: one distance function, one "who is caught" function),
`engine/core/commands.js` (`template.*`), `engine/core/turns.js` (rounds), `engine/client/surfaces/rulers.js`
(everything on screen and in the hand), `engine/relay/campaign.js` (`presence`, `entryFor`).
Tests: `engine/test/rulers.test.mjs` (node, a real relay), `engine/test/browser_rulers.py` (three seats).

## 1. Movement distance for free
Harry: "by default when you are moving your pawn(s) it should show the distance as you are dragging it around."

- While a pawn (or a group) is dragged, a line runs from where the grabbed pawn stood to where it is, with the
  distance: "30 ft · 6 sq". No tool, no key. It is gone when the pawn is let go.
- **Both pawn modes.** Moving freely (the default) it is the distance to where the pawn is; snapping to squares
  (Shift, or the Settings ▸ Me switch) it is the distance to the square it will land on. The readout is worked out
  from the same numbers the drop uses (`app.moveDrag.pawns`, written by `dragMove` in `client/input.js`).
- **A vertical part** (the floor under the pointer is upstairs, or a cellar): the true distance and its parts,
  "29 ft · 6 sq (25 across, 15 up)".
- **Everyone who can see the pawn sees it live.** It travels as presence (below). A hidden pawn's line reaches the
  GM side only.
- A group: one line, for the pawn that was grabbed.
- Not shown: the hop a pawn makes when dropped on a stair (the drop decides that; the line shows the drag).

## 2. The distance rule
Harry: "true distance for sure."

- **One function**, `distance(a, b, rule, { ra, rb })` in `core/measure.js`; everything that shows a distance calls it.
- **True distance** (straight line in 3D, in feet) is the default, written with its squares: "32 ft · 6 sq" (feet
  rounded to the foot, squares = feet / 5 rounded).
- **Two alternatives, a campaign setting** (Settings ▸ Global defaults ▸ Distance; `defaults.distance`):
  - `five`: counted in squares, every diagonal 5 ft;
  - `alt`: counted in squares, diagonals alternating 5 / 10 (5 × (longest count + half the second longest, rounded down)).
- **Edge to edge.** An end on a pawn is measured from the edge of that pawn's space (a circle of 2.5 ft per square of
  its size), not its centre: two pawns side by side are 0 ft apart. Under the two square-counting rules they are 1
  square = 5 ft apart, as those tables count.
- **Units.** The campaign's existing Units setting is honoured here: metres read 1.5 m a square.

## 3. The ruler is a button you hit
Harry: "that ruler is a button you hit."

- **Key: M** (free before; one place: `RULER_KEYS` in `surfaces/rulers.js`). Hold or tap, like the launchers:
  - **Hold M** with a pawn selected: a ruler is out at once from that pawn to whatever the pointer is on. Read it;
    let go and it stays where it pointed.
  - **Hold M** with nothing selected, or **tap M**: drag from A to B. A click instead of a drag puts A down and B
    follows the pointer until the next click. A tap is good for one measurement; tap again or Esc puts the tool away.
- Also "measure" in the command bar, and **Pawns menu ▸ Measure** (the menu steps aside).
- **Snap to target** (Harry agreed): an end let go on a pawn, or within 1.5 ft of its base, attaches to it. The
  measurement is then base edge to base edge and **follows** when either pawn moves, whoever moves it, drags included.
- **Both ends can be dragged again** (a round handle at the start, a square one at the end). A handle is never on
  the middle of a pawn: it sits where the line meets the base, so the pawn stays easy to grab.
- **Other seats see it live while it is drawn**, in the measurer's colour, with their name. It is also how a player
  points at a distance.
- **It is temporary.** It stays until the next click elsewhere, or Esc. A press on a pawn does not let it go
  (dragging a pawn the ruler is on is how you ask "and from here?"). It is never stored: not in the log, not in the
  campaign, not undoable.

## 4. Shapes by contextual buttons
Harry: "'measure something' and you get a contextual menu (make it a cone, sphere, circle)."

- After a measurement, a row of buttons beside its far end: **Line · Cone · Circle · Sphere · Cube**. Choosing one
  turns the SAME measurement into that template: its origin is the ruler's start, its size the ruler's length, its
  direction the ruler's direction. The handles stay: the round one moves it (onto a pawn: it starts at that pawn),
  the square one sets size and direction (whole feet; Shift: 5-ft steps).
- **Definitions** (`outline` and `catches` in `core/measure.js`):
  - **Line**: its length, 5 ft wide ("line 60 wide 10" in the bar for another width), one level high.
  - **Cone**: as wide at any point as that point is far from the origin; flat at its far end.
  - **Circle**: a radius on the ground, a cylinder one level (10 ft) high: only the things on that level.
  - **Sphere**: a true 3D radius: other levels and flyers too.
  - **Cube**: its side; the origin is the middle of its near face; as tall as its side.
- **Drawn in 3D (2026-10-17).** Only the drawing changed, never the numbers. **Sphere:** a globe: 8 parallels (4 above, 4
  below the middle) plus the equator on the floor-level centre, and 8 meridians (4 great circles), with a translucent
  ball as the fill. **Cone:** apex at the origin, a round flat end across the aim (radius size/2, so its width at any
  point is its distance), 8 ribs between, a translucent side and end; the triangle on the floor (the footprint through
  the axis) stays as its outline. The cone's axis lies at the origin's height, so its lower half is under the floor,
  as `catches` has it (it opens up and down as it opens sideways). Both rebuild their lines only when size, aim or
  origin change (the `sig`), on the same line materials as every other template. `core/measure.js` is untouched:
  `outline` is the footprint triangle and `catches` is the same exact test; the triangle was the cone's true
  cross-section through its axis, so it was not wrong. (One note, left as is: the height rule `|dy| < width/2` is a
  box where a true cone's cross-section is round, so a pawn off to the side and well above the axis can be counted
  slightly generously.) Test: `engine/test/browser_measure_shapes.py`; stills in `engine/test/shots/measure/`.
- **Fast path:** with a measurement in the hand, **1 2 3 4 5** are Line, Cone, Circle, Sphere, Cube (the digits do
  nothing otherwise). In the bar: `cone 15`, `circle 20`, `sphere 20`, `cube 10`, `line 60`. With a pawn selected the
  template drops from that pawn and is aimed with the pointer (a circle or sphere: its centre goes to the pointer and
  the label says how far that is from the pawn); a click fixes it. With no pawn: a click where it starts, then aim.
- From a pawn, a template is measured from the EDGE of the pawn's space, as a ruler is.
- Shapes and sizes only; no spell names.

## 5. Who is caught
- **The exact test** (`catches`, one function): a pawn's base is the circle of its space on the ground (radius 2.5 ft
  per square of its size) at the height of its feet. It is caught when that circle overlaps the template's outline on
  the ground by more than a hair (0.05 ft: a base that only touches the edge is out), AND its feet are within the
  template's height:
  - circle, line: from 1 ft under the template's floor to one level (10 ft) above it;
  - cube: from 1 ft under its floor up to its side length;
  - cone: no further above or below the origin than half the cone's width where the pawn stands;
  - sphere: the nearest point of the base to the origin is closer than the radius, in 3D.
- **Shown:** every caught pawn wears a red ring round its base, breathing; the label says "Cone 30 ft · 3 caught";
  hovering the label lists the names; "say who is caught" posts the list in the chat.
- **The squares** whose centres are inside are tinted, as the secondary cue (none for a template of thousands of
  squares).
- Each seat works it out from what it holds: a player's page has no hidden pawns, so cannot count or name one, and
  the chat line never names a pawn hidden from players.

## 6. Make persistent
Harry: "if you take one of those you get a second one 'make persistent' (possibly with a # rounds in there… and auto
add it to the init list as a thin little line)."

- After choosing a shape, ONE bar: **Keep (K)** · **1 round** · **N rounds [number]** · **Attach to <pawn>** (when its origin is on a pawn). Duration and attachment are independent toggles: use both for an aura that expires. Every touch keeps immediately; further touches update the SAME entity, with one undo for the creation gesture. Keep preserves current settings. Clicking an active duration or attachment toggles it off. Updating duration never moves an unattached template when its original pawn moves; Keep and attachment changes preserve any rounds already elapsed.
- The bar stays until a click elsewhere, Esc, or 8 seconds idle (`KEEP_BAR_IDLE_MS`). Editing the number applies it immediately; Enter accepts it too. N defaults to 2 until a number is entered. The old ten-round preset is removed; any number remains valid.
- Relay undo grouping uses `keepSession` on `template.place`/`template.set`, restricted to the same seat, template, session and that seat’s undo head within 10 seconds between writes. Other seats’ unrelated actions and natural turn countdowns do not split the gesture; an intervening edit to this template or another action by its creator does.
- **A kept template is an entity** in the area, like any thing: `{ id: tpl_…, kind: 'template', shape, x, z, y, dir,
  size, width?, owner, rounds?, left?, attach?, src?, name?, hidden }`. So it is in the command log, in the saved
  campaign, in a snapshot, sent to everyone who can see the area, and its undo is the ordinary one.
  - Commands (class `template`, which players hold): `template.place`, `template.set`, `template.delete` (its owner
    and the GM side), `template.clear` (GM: every template of the area; one undo brings them back).
  - `owner` is written from who sent it, never from the arguments.
- **Drawn quietly:** a thin outline and a faint fill in its owner's colour, a small mark at its origin. Its numbers
  and the rings on who it catches show only under the pointer or when it is selected (click the mark). Selected, its
  owner and the GM get the handles and Remove · rounds · Detach; Delete removes it.
- **Attached** (an aura): it is centred on its pawn and reaches its size beyond the pawn's edge, and goes where the
  pawn is drawn, drags included. If the pawn leaves the table it stays where it last stood.
- **Rounds.**
  - With a fight running, a template with rounds gets a **thin row in the turn order**: an hourglass, its name,
    "3 rounds left". The row is nobody's turn: the marker passes it, and each pass takes a round off.
  - **Where the row sits:** just BEFORE its creator's entry (the pawn it was cast from; else its owner's first pawn in
    the order; else, the GM's, before the entry whose turn it is; else last). So "1 round" runs out as the turn comes
    back round to its creator. The GM can drag the row anywhere.
  - **At zero it does not vanish.** It says "expired", and its owner and the GM are offered **Remove / Keep** (beside
    the template and on its row). Keep takes its rounds away: it stays until removed. If nobody answers, it is
    removed the next time the turn moves on (Remove is the default).
  - Previous gives a round back to a row it passes back over; a removed template stays removed.
  - With no fight running, "N rounds" is simply kept; it gets its row when a fight starts. Ending a fight keeps the
    count it had.
  - Removing the row removes the template, and the other way round.

## 7. Permissions and hiding
- Players measure and place templates anywhere in an area they can see.
- **The relay's filtering is the hiding.** A template is hidden when it is marked `hidden`, and then no word of it
  reaches a player seat (snapshots, log entries, the turn order, the GET API), exactly like any hidden thing.
  - The GM side's template on a hidden pawn or in a hidden room MUST be hidden: the relay refuses it otherwise, so a
    careless client cannot leak one.
  - Hiding or revealing a room, or a pawn, hides or reveals the templates standing in it, or attached to it.
  - A player cannot hide a template. A player who measures over ground where a hidden room stands keeps her template
    (she is not told the room is there).
- **Presence:** a ruler, a dragged pawn's line or an unkept template that touches a hidden pawn, or has an end in a
  hidden room, is passed to the GM side only.
- The GM removes any template, and has "clear all templates" (the bar; Pawns menu ▸ GM).

## What a finger does
- A pawn cannot be dragged by a finger today (one finger pans), so there is no drag readout on touch.
- Pawns menu ▸ Measure turns the tool on; then **one finger drags from A to B**. A tap puts A down and the next tap
  puts B. Two fingers still pan and zoom (a second finger landing ends the drawing).
- The handles and the buttons take a finger (the handles have a 40-px target). A tap on open floor lets the
  measurement go.
- Not built for touch: hold-M, the digit keys, hovering a kept template (tap its mark instead).

## The look, in one place
`RULER_LOOK` in `surfaces/rulers.js`: line widths, the dark casing that makes a line readable over any floor, fill
and square opacities for a live, a kept and a hovered template, the caught ring, label and handle sizes, the snap
distance. Lines are drawn over everything (no depth test), fills sit just above their floor, words are DOM, so they
face the camera and read in first person and in fog. A template on a level above the cut is not drawn.

## In the protocol
- **Presence** gains `ruler: { k: 'rule' | 'move' | a shape, a: [x, z, y], b: [x, z, y], ap?, bp?, w? }`
  (`cleanRuler`): the two ends, the pawns they are on, a line's width. Never stored.
- **`turn.view`** may carry `set`: the templates a Next or Previous changed, as the receiving seat may see them
  (a player seat never receives `turn.next` itself).
- **Campaign defaults:** `distance: 'true' | 'five' | 'alt'`.

## Not in this version (Harry agreed)
Walls blocking a template or a ruler, line of sight, cover. Also not: movement budgets per turn, path waypoints.
- **Where they would go:** a budget is one more argument to the readout in `frame()` (`ruleItem('move', …)`): colour
  the label when `d.ft` passes the pawn's speed. Waypoints: `app.moveDrag.pawns` becomes a list of legs and
  `distance` is summed over them; the presence shape would carry the legs.
- AI seats do not see templates in the GET `state` yet (they are entities, so the commands work through `do`).

## Decided without Harry (each is one small place to change)
| Choice | Taken | The alternative | Where |
|---|---|---|---|
| Keys | M measure, K keep, 1 to 5 the shapes | letters for the shapes | `RULER_KEYS` |
| A pawn's space for measuring | a circle, 2.5 ft per square of its size | the painted base's radius | `pawnRadius`, core/measure.js |
| Squares shown | feet / 5, rounded | one decimal | `format` |
| A press on a pawn keeps the ruler | yes | any press lets it go | the capture `pointerdown` in rulers.js |
| Template sizes while dragging | whole feet; Shift 5-ft steps | always 5-ft steps | `RULER_LOOK.sizeStep` |
| "One level" | 10 ft | the building's own storey height | `LEVEL`, core/measure.js |
| Touching edges | not caught (0.05 ft) | caught | `EPS` |
| An aura's size | measured from the pawn's edge | from its centre | `resolve` |
| A kept template's rings and numbers | only under the pointer or selected | always | `shapeItem(… quiet)` |
| Where the row sits | before its creator's entry | after it; at the end | `tplIndex`, core/turns.js |
| Expired and unanswered | removed when the turn next moves on | stays until someone answers | `advance`, core/turns.js |
| Ending a fight | the count is kept | starts again next fight | `left` stays on the entity |
| At most | 200 templates an area; size 1000 ft; 999 rounds | | core/commands.js, core/measure.js |
