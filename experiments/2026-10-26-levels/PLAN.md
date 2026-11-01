# Universal levels: pawns keep their level, stairs are walked (2026-10-26)

Harry, after playing on dev: "I noticed bugs around the differing levels for differing buildings. I keep getting pawns
popping up and down by full level increments incorrectly when I snap to floor. All and all I think it might make sense
to refactor to a universal level height model. Also, I feel like pawns going up and down stairs need to basically snap up
to and down to the level of the stairs." Redirected mid-work: "Mid-stairs need to not snap landing. A stair is not a
teleporter. A stair is a place that people can stand ... people stand on stairs. It's an extremely common move with
pawns." And: "5-foot hills can be done as objects, sort of like tables, rather than as deep, complicated things."

The rule as built: docs/VERTICAL.md "Universal levels"; how it feels: docs/UI.md "Pawns keep their level; stairs are
walked". Branch `levels`.

## Files here

- `repro.py`: a COPY of Harry's campaign (`cmp_q2bjx70ajq`) on a local relay with its own secret and free ports; seat
  tokens are minted locally (`mint.mjs`) and never printed. Drags pawns with the real mouse (as the GM with a probe pawn,
  as the player with Tony) between the cathedral, the hilltop, the great hall, the mansion hall, its grand stair and the
  second building's upper hall, at each view (all levels, lv 1, lv 2), and records the height, the base and what it
  stands on. `--shots DIR` writes close stills; `--only TEXT` runs the cases whose name has TEXT. It refuses to run if the
  static server is not serving this checkout.
- `before.json`: on e43075cb (the base). `after.json`, `after-player.json`: on this branch (the stair cases before the
  base was set on the uphill tread: since then a pawn let go halfway up the grand stair stands at 5.8 ft, not 5.0).
- `stairinfo.mjs`, `core_check.mjs`: the same map by the core rules in node (rooms, ground contact, the cut, a walk).

## The map

Area "Intesst": a 10-ft hill (x 35..115, z -25..55 ft). Building 1: a cathedral (y 10, on the hill), a hallway and a
temple vestry (y 10, on the hill), a mansion hall (y 0, its north end dug into the hill), a great hall, a kitchen, a
storeroom and barracks (y 0). Building 2: a one-square mansion hall at y 10 over the mansion hall's north end, all of it
the grand stair's hole. The grand stair (10 x 15 ft) climbs north from the mansion hall to the hallway; its status is
"Comes up through a wall" (it reaches into the hill's edge). A 20-ft round hole in the cathedral's floor (over the hill).

## What popped, measured (before)

By the core rules (`stairinfo.mjs`), Building 1 counted its storeys from the plain: the cathedral, hallway and vestry were
"storey 1": no outside door, no fog by type, sight at 10 while a pawn on the hilltop beside them saw at 0, and with the cut
at lv 1 all three were hidden (the building does not stand clear: it meets the ground at 0).

Dragged with the mouse (29 cases):

1. **The stair teleported.** Dropped on the grand stair from lv 1 a pawn went to the top landing (+10); from lv 2 onto
   its middle it went DOWN by the drop and was sent back UP by the stair to where it started: no move at all. The north
   end of the mansion hall is the stair, so every drag there popped a full storey (+10 at lv 1, or +10 then -10 with all
   levels showing).
2. **The floor that shows decided the height.** A drag ended on the highest floor drawn under the pointer: from lv 2 in
   the upper hall to the great hall, -10; from lv 1 across the mansion hall with all levels showing, up to whatever upper
   floor showed.
3. **Buried in the hill.** At lv 1 the cathedral was hidden, the hilltop under it is taken by it, so a pawn dragged into
   the cathedral fell through to the ground plane: y 0 inside the hill.
4. **The cathedral's hole.** A pawn over the round hole fell to "the ground below" at 0 inside the hill (the journal has
   Tony at y 0 at (73, 1.57), inside the hole, at 09:40 and again at 22:24 today).
5. Off the hill's edge a pawn hung at 10 over the bank and was offered "Fall 10 ft".

## After (this branch)

| case | seat | view | before | after |
|---|---|---|---|---|
| gh->mansion-under-upper (its north end: the stair) | gm | all | 0 → 0 (hop) | 0 → 3.56 on the treads |
| gh->mansion-under-upper | gm | lv 1 | 0 → 10 (hop) | 0 → 1.28 on the treads |
| gh->mansion-under-upper | gm | lv 2 | 0 → 0 (hop) | 0 → 3.56 on the treads |
| mansion->under-hallway (onto the stair) | gm | all | 0 → 0 (hop) | 0 → 8.33 on the treads |
| mansion->under-hallway | gm | lv 1 | 0 → 10 (hop) | 0 → 6.52 on the treads |
| gh->cathedral | gm | all | 0 → 10 | 0 → 10 (climbs onto the hill: its earth fills lv 1 there) |
| gh->cathedral | gm | lv 1 | 0 → 0 buried in the hill | 0 → 10 |
| gh->cathedral | gm | lv 2 | 0 → 10 | 0 → 10 |
| cathedral->cathedral | gm | all / lv 1 / lv 2 | 10 → 10 | 10 → 10 |
| cathedral->hilltop | gm | all / lv 1 | 10 → 10 | 10 → 10 |
| hilltop->plain | gm | all | 10, hanging, "Fall 10 ft" | 10 → 0 (walks down the bank) |
| plain->hilltop | gm | all / lv 1 | 0 → 10 | 0 → 10 |
| hallway->upper-hall (the upper hall is all hole) | gm | all / lv 2 | 10 → 0 (hop) | 10 → 2.69 (walked down the treads) |
| upper-hall->greathall (started in the air over the hole) | gm | all / lv 2 | 10 → 0 | 10 → 10 (a raised pawn keeps its height: on the great hall's roof) |
| stair: lv1 foot->middle | gm | all / lv 1 | 0 → 10 (hop) | 0 → 5 (5.8 with the uphill tread) |
| stair: lv2 top->middle | gm | all / lv 2 | 10 → 10 (no move: down, then hopped back) | 10 → 5 (5.8) |
| stair: foot->top exit | gm | all | 0 → 10 | 0 → 10, smoothly (0, 0.7, 1.7 ... 9.4, 10) |
| stair: top->foot | gm | all | 10 → 0 | 10 → 0, smoothly |
| player gh->cathedral | player | all | (the drag never started: the first one after arrival) | 0 → 10 |
| player cathedral->cathedral | player | lv 1 | 10 → 10, hidden at lv 1 | 10 → 10, shown |
| player stair foot->middle | player | all | 0 → 10 (hop, in the debug run) | 0 → 5 |
| player across the cathedral hole | player | all | (new) | 10 → 10 |

The first player drag after the page opens races the camera's arrival glide (client/arrival.js): before, it never
started; after, it ran away. A harness matter: the suite makes a warm-up drag first.

## Choices made for Harry (to change)

- **A pawn walking into a room on a hill from the plain climbs onto it.** The hill's earth fills lv 1 there, so there is
  no lv 1 floor; the alternatives were to refuse or to leave it inside the earth.
- **Off a hill's edge it walks down; off an upper floor's edge it hangs and is offered the fall.** The brief's rule (c) is
  "falls to the highest floor below"; the Falling offer (2026-10-22) is kept for real drops, a bank is walked.
- **Stepping onto a stair needs its treads within 5 ft of the pawn's feet** (the house's 5-ft standing rule). Across a
  stairwell from the side at the upper level a pawn hangs over the drop until the treads come within 5 ft.
- **Off a stair it steps onto the nearer end's level**; its level (cut, sight, labels, the offer) is the band its base is
  in, as Harry said: lv 1 until its feet reach 10 ft.
- **The base on a stair sits on the tread under its uphill edge** (1.2 ft up the run): Gemini read the slope's own line
  as "sunk into the staircase, with the higher rising steps clipping directly through the back of the base"; with the
  lift, "rests on top of a step tread ... its downhill edge slightly overhanging the lower step".
- **Ladders and spirals still hop.** A ladder is upright and a spiral winds: neither is walked along a line.
- **A pawn raised in the air keeps its height when dragged** (it used to land on the floor that showed).
- **The cut's "stands clear" is judged per stack of rooms**, not per building. In Harry's map at lv 1 the cathedral and
  vestry show; the hallway (whose end is over the mansion hall) and the second building's upper hall are cut.
- **The cathedral now has an outside door and its type's fog** (ground contact per room): its walls are laid again on
  the next load.

## Verified

Node, each run alone: core 735, relay 206, llm 99, notice 12, tickets 45, linkmail 126, harness 5, levels 28 (new),
stairs 82, grandstair 507, hillbuild 62, terrain 86, pawnbase 30, holes 27, caves 40, migrate 506, roofs 67, areas 115,
building-debt 15, rulers 120 (vision, buildings, darkness, fogarea, uvtt: exit 0).

Browser, each alone, `TW_GPU=1 ... --local` on free ports (`TW_PORTS`), the page checked to be this checkout's
(`engine/test/served.py`): stairs 44/46 (the 2 failures are the same on the base: 41/43, the ground cut over a cellar's
stair), grandstair 29/29, placed_stairs 46/47 (the 1 is the same on the base: 45/46), storeys 43/43, hills 54/54,
hillbuild 52/52, cut 141/141, caves 39/39, falls 45/45, pieces 63/63 (caught a crash in tall rooms' corner posts from
this change), bands 22/22, followons 42/42, storeydrop 29/29 (28/29 once: a 48 ms spin-in timing, passed on re-run),
pawnbase 44/44, chatline 34/34, lift 17/17, roofs 61/61, rulers 109/110 (the 1 is the same on the base).
