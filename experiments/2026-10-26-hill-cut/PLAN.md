# The hill and the cut: one numbering, the covering rule (2026-10-26)

Working doc. Harry and Fauna agreed: levels are numbered ONCE for the whole map (a shrine on a 10-ft hill is lv 2), and
at lv 1 a hill is not sliced and what stands on it stays. The rule that gives both: **the cut hides what covers the
level you are on**, not everything above a height.

## Today, measured (`measure.py`, main 3bec8260; `before.json` in the scratchpad, numbers below)

Scene: a 10-ft hill with a two-storey shrine on it (floors 10 and 20) and a cellar (-10) under one corner; a 10-ft hill
with a room dug in at the ground; a 10-ft hill with a cave (-10) under it; a two-storey inn with a cellar on open ground;
a pawn in each place.

| view | what the cut does today |
|---|---|
| lv 1 (cut 9) | hill, shrine ground storey, hill pawn shown; shrine's upper storey hidden (it is "lv 2 of its building"); inn upstairs hidden. Right by Harry's rule except the numbering. |
| lv 2 (cut 19) | everything shows: the shrine's upper storey (floor 20) is not hidden, because the cut counts from the shrine's ground (20 - 10 = 10 <= 19). On the hilltop's own level the shrine's roof storey is NOT cut away. |
| lv -1 (cut -1) | **the lid**: the ground opens over the cellar (6/6 squares) and the cave (30/35), but the hill's grass tiles over them are all drawn (11/11, 63/63) and the bank stands 10 ft over them. The cave and the cellar under a hill are under a closed lid; their pawns are "drawn", under the earth. The pawn on the hilltop is drawn standing on that lid, while every pawn on the open ground is hidden. |
| double-click the shrine | the level goes to 10, the cut to 9 (relative): **the inn's upper storey, at that same 10 ft, is hidden while you are on 10 ft**; the meter relabels itself from the shrine's ground: 10 ft = "lv 1", the ground = "lv -1", -10 = "lv -2". Click away and the same notches read lv 2 / lv 1 / lv -1 again. |
| the dug-in room | already right at every view: the hill is taken over it (no tiles, bank cut to its floor). |

What was weird, in one line: the numbering moves under you (the meter's labels and the cut change meaning with the
building in focus), the hilltop's own level never cuts the shrine's upper storey, and below ground a hill is a lid.

## The rule

`c` = the cut (a ceiling, feet, absolute); null = all levels. A room shows if its floor is at or below `c` (as ever).
A room above `c` is hidden, EXCEPT a building that **stands clear**:

- `c >= 0` (the view is at or above the ground), and
- the building meets the ground above the cut (its ground, `hillBaseOf`, the ground-contact number we keep, `> c`), and
- none of its rooms lies, in plan, over a room (not a hill) whose floor is at or below the cut and at or above the
  ground (a room you can see at your level or below it).

A building that stands clear shows WHOLE: every storey, its things and pawns, its roof when roofs are on. It covers
only the hill's solid earth. A building that does not stand clear is cut by height, exactly as today.

What stands on a hill (its things, pawns on its top): shown while `c >= 0`; hidden below the ground (`c < 0`), as
everything on the open ground is. The hill itself is never hidden (it is the earth, the lid around a dungeon, as the
ground is).

**Earth opens over what is shown below it.** Wherever the ground opens over a room being shown (the existing rule:
`groundOpen`, a below-ground room at or under the cut), the hill opens too: its top's tiles there are not drawn, the
pointer and a pawn's base go through, and the bank is cut down to the ground at the room's outline (the "rooms trump
the bank" cut, fed one more cutter list). A room dug in at or above the ground already takes the hill at every view.

**Numbering.** `level(y) = floor(y / step)`, step = the storey height of the building in focus (10 unless set), base 0
for every building. lv 1 = 0..9, lv 2 = 10..19, lv -1 = -10..-1. The meter, "lv N · …", the bar's "level N",
"Cut to lv N", a room's floor label, the AI seats' `level` all use it. A building's own storey (`storeyOf`, from its
ground) stays for what depends on ground contact: fog defaults, the stair offer, the outside door, the AI's `storey`.

### Choices (mine)

- **Per building, not per room footprint.** A building is whole or cut. Per room would need "a room standing on a
  hidden room is hidden too" (else an upper storey floats over a hidden ground storey), which is the per-building rule
  again with more steps. Cost: a building half over a dug-in room at your level is cut away whole, including the half
  that is only over earth. Never a lid, never floating.
- **A hilltop building partly over a dug-in room at your level:** cut by height (whole, as above). The dug-in room
  shows; the hilltop and its pawns stay.
- **Below the ground, the hill's things hide** (a change: today a pawn on a hill shows at lv -1). The ground and the
  hills are one earth; at lv -1 the earth is the lid and what stands on it is not drawn, on the open ground or a hill.
- **The hill opens by the room's squares** (for a cave too, whose ground opens along its lip). Simplest; Gemini judges.

## What changes (functions)

- `core/height.js`: + `levelAt(y, step)`, `levelOf(E, room)`, `cutRooms(E, cut)` -> { hidden, clear } (pure, cached
  per state and cut). `floorUnder().level` absolute. `storeyAt` deleted (no users left).
- `core/terrain.js`: `terrainKey/terrainOf(E, P, open)`: extra cutters (the view's open rooms, cut to the ground).
- `client/world.js`: `cutSets` (cutRooms; `cutClear`), `cutHides` (things/pawns by `cutHidesPoint`), `roofShown`,
  `fogLevel` (rooms at or under the cut only), `rebuildGround` (+ `hillOpenCells`, terrain resync when it changes),
  `cutPass` (hill tiles over open rooms), `floorStop`, `floorPoint`, cursors and remote wall halos, `syncTerrain`.
  Deleted: `pawnGround`.
- `client/surfaces/cut.js`: every `- groundOf` / `levelY` / `R.base` out: `cutHides`, `levelCut`, `goLevel`,
  `cutToRoom`, `cutLevels`, `cutInfo`, `meter`, `meterPing`, `floorKey`, `offer`; `restore` mends a cut saved below
  its level (a relative cut from before today).
- `client/main.js`: `levelRange` base 0; `levelInfo` absolute. `client/commands.js`: the bar's "level N".
- `relay/llm.js`: `level` labels absolute (`storey` stays the building's).

Kept: `levelY`, `sightLevel`, `groundOf`, `hillBaseOf`, `hillUnder` (sight, fog of war, darksight, atmosphere fog,
the outside door, the stair offer, fog defaults).

## Risks

- **Open-ground buildings must be identical.** For them `ground = 0`, so `clear` is never set at `c >= 0` (0 > c is
  false) and never at `c < 0`: hidden = { y > c }, today's set. Tested on generated buildings at every level.
- A field rebuild on a level change: only when the set of open rooms under a hill changes (crossing into / out of a
  below-ground level with a hill over a room). Measure; today's resync is ~150 ms with dressing.
- Saved views: a seat that was cut relative to a hill building comes back on the same level with the cut mended to it.
- A building's explicit `base` (settable, never set by the game) no longer shifts the meter's labels.

## After the first build (what the measurements and Gemini changed)

- **Shaft to crater.** Cut straight down at the room's squares, a cellar under a 10-ft hill was a 20-ft shaft; at the table's slant Gemini saw "the cellar buried under the hill" (it was open, the view could not reach in). Now the earth falls away at 45 degrees round the room, a square crater on the grid; the hill squares it reaches are drawn by the bank mesh (a round crater left flat corners of them, "a darker rectangle").
- **A hidden room gives the earth back.** At lv -1 a shrine cut away left a hole in the hilltop down to the ground (it did on main too), and with the ground left out under the crater a hole to nothing. Now a room the cut hides takes nothing from a hill (field cutters, and tiles kept but hidden while their room shows).
- **Posts on the hill.** A shrine's corner posts belonged to the hill and stood alone at lv -1 (also on main). They go to the room now.
- **The magenta sheet** (`measure.py --magenta`): a flat sheet under the floors tells a hole (magenta) from a shadow (dark). After the fixes: hairlines at wall seams only, the same as a cellar under open ground.
