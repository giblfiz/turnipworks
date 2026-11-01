# First person (FPV), 2026-10-29

Harry, 2026-10-29: "let's also do first person (should probably be a button in the pawns menu for that pawn owner or gm
rather than scroll in. Maybe something in the players orbital too)". Branch `fpv`, worktree `../3d-vtt-fpv`. DEV only.

## Map (what touches what)
- `engine/client/surfaces/fpv.js`: the whole mode (commands, keys, pointer, camera, steps, HUD, tags).
- `engine/client/ceilings.js`: ceilings for covered rooms near the eyes (VERTICAL.md:82).
- `engine/client/views.js`: one hook, `View.eyes(camera, dt)` after the grab camera.
- `engine/client/world.js`: `unseenAt` exempts squares near `world.eye` (else a covered room's things are not drawn: you stand in it).
- `engine/client/surfaces/ring.js`: `ring.only(ctx)` (a main button for some selections only); ☰ caption `cap` from menu.js.
- `engine/client/menu.js`: `pawn.eyes`, chord Space E, ☰ caption "First person".
- `engine/core/presence.js` + `engine/relay/campaign.js`: presence `eyes` (validated: a pawn of the area the seat may move; withheld from players when hidden).
- `engine/client/surfaces/dice.js`: dice from the FPV pawn, ahead of it. `surfaces/cut.js`: no "Cut to lv N" offer while in FPV.

## Decisions (Fauna's; each one constant to change)
- Key **V** (free in the default layer; "V for view" is a common camera-toggle key in games). Chord Space E.
- Ring: **Eyes** at slot 15.6 on a player's OWN pawn only (Target never shows on your own pawn: Eyes takes its place at the
  row's end; with Attack always there since 2026-10-29 the owner's row is Turn · Sheet · Damage · Attack · Eyes · ☰); the GM
  gets "First person" in ☰ (a GM's monster ring keeps its length).
- Eye height = 0.92 × the figure's drawn height over its base (FIGURE_SCALE is in that). A 6-ft hero at 0.67 → ~4 ft eyes.
- Drag look = grab the world (drag right, the view turns left), as the map's literal grab. `LOOK.sign` flips it. Lock mouse = games' way.
- Steps snap to 8 directions from the view. Blocked by walls, shut doors, windows, shut bars, cave rock (vision's blockers + windows/bars).
- The cut is lifted and roofs on while in FPV; restored on exit. Grid hidden; sky colour #7e8f9b unless darkness.

## Log
- 10:xx first suite run 40/45: Esc did not leave when ☰ had registered an Escape closer (fixed: pop closers, then exit);
  the door click hit my own (hidden) pawn first (fixed: own pawn left out of picks).
- Found: a PLAYER cannot open a GENERATED door anywhere (map or FPV): opening materialises it (edge.set + object.place,
  GM classes). Pre-existing; out of scope; the FPV click works for the GM and for doors that are already objects.
  FIXED 2026-10-29 on branch `pdoors` (door.open, engine/LAB_NOTES.md "Players open generated doors").
- Keys: the launchers' letters (tray.js, capture) took S before my key layer → S opened Settings. Now fpv.js has its own
  capturing keydown/keyup on window and registers FIRST (main.js surface list); keyups of taken keys are swallowed too
  (a launcher opens on the tap's key-up).
- Click-to-walk: pointAt hit my own hidden pawn (at the eye) → own pick, past the pawn; fog check by sightLevel.

## Frame time (experiments/2026-10-29-fpv/perf_fpv.py; RTX 3060, 1920x1080, uncapped, box LOADED: loadavg ~35, GPU 99% from other agents)
Medians of per-round medians, rAF ms. Relative numbers within a run are the meaningful ones.
- 121 rooms / 2,717 things (9 generated buildings), first try with roofs forced on: fpv-walk 1,100–1,800 ms. Profile:
  syncRoofs 55 ms per pawn move, roof landing anims → cutPass every frame. → roofs no longer forced.
- Same town after: map 44, fpv-in 65, fpv-out 135 (draw calls 4.4k vs map 1.0k: a horizontal view down the street),
  fpv-walk 651–687, map-walk (arrow keys on the map) 37 median / 658 p95.
  Walking is dominated by the PRE-EXISTING cost of one pawn move on a big map (app.batch 45–70 ms + world.sync 20–30 ms),
  plus cutSets with the cut lifted (all rooms shown: 17 ms vs 3.5). cutSets now indexes rooms by height and holes by height
  once (it was rooms×rooms and rooms×things).
- 43 rooms / 1,234 things (3 buildings): map 45, fpv-in 32, fpv-out 56, fpv-walk 214, map-walk 176. On par with the map.
- Lens far 320 → 260 ft; covered-room wake 60 → 40 ft and its whole-map pass only when a covered room is near.

## Ops note
- 08:53: an agy-run from another worktree (vttindex) sat 16 min holding /tmp/agy.lock, blocked reading stdin (a socket:
  prompt passed as args, stdin never closed) with no agy child: every Gemini caller on the box was queued behind it.
  Killed by PID after readlink of its cwd. Trap for callers: give agy-run `< /dev/null` (or the prompt on stdin).

## Landed (10:22)
- main 63e8b439, dev client v=20261029102236, release candidate **20261029-102245-63e8b439** (DEV only; prod untouched).
- On dev: browser_fpv --page http://127.0.0.1:8180/ 53/53.

## Gemini (agy-run, gemini-4-argon-high; describe first, then judge)
### r1 (stills of 08:45, before the ceiling fixes)
- Cave 1–2/10: "Looking up in an underground cave reveals flat, razor-thin rectangular polygon sheets floating against a
  bright blue sky crisscrossed by black grid lines." Cause (measured, not eyeballed): ceilings.js set `v.rotation.x = π`
  on the flat's own visual, overwriting its lay-flat pose: every ceiling cell stood on its edge (box y -3.5..1.5). Fix:
  a flip group around the visual (box now y -1..-1, normal (0,-1,0); ceilings-off diff looking up 0 → 771k px).
  The grid lines: the area grid rule (settings.js) turned the grid back on; now held off every frame while looking.
- Outside 5–6/10: "Pitch-black untextured/unlit slabs sitting on top of the tavern instead of roofs." Cause: the floors'
  material is two-sided; a ceiling's back seen from outside. Fix: one-sided copy (ceilings-off diff outdoors 61k → 0 px;
  hilltop 40k → 0), lit 0.32 by its own picture (a downward face only gets the hemisphere's dark ground colour).
- Upstairs ceiling 3/10 "blurry orange bars": the same edge-on cells, seen from under them.
- Hill 7/10: "The best-reading shot of the set: the eye-level perspective looking up at the hill, boulders, and berry
  bush feels grounded."
- Door slits ("wall and door modules fail to meet cleanly, exposing the outdoor hillside/sky"): measured 0.03–0.04 ft
  between a door piece and its jamb posts (door-reinforced 40.30..44.63 vs post 44.67; door-double-grand ..19.31 vs post
  19.34), plus the seam between a double door's leaves inside the mesh. Invisible from the table, a slit at 2 ft. Kit
  tolerance, pre-existing: LEFT (a small overlap in the wall kit's door fit would close it for everyone).
- Kitchen "doorway" still was my staging (the door is at z 0..5, the camera was at z 12.5); restaged.
- r2 was killed mid-run by my own pgrep -f self-match (the memory note says anchor it; I did not). Re-queued as r4.

### r3 (stills after the ceiling fixes, roofs not forced)
- Interiors 5–6.5/10 ("Having an actual wooden plank ceiling overhead with a hanging chandelier makes looking up inside
  the tavern feel mostly enclosed"); cave 6.5 and 3.5 looking up: "the flat cave ceiling slab does not cover the full cave
  footprint or seal against the rock walls" → a cave's ceiling now runs one square past its own squares.
- "Missing roof on the right half of the tavern ('open dollhouse' exterior)" → roofs on while looking, maps ≤ 60 rooms.
### r5 (after both)
- Cave 8/10 and 8/10: "Reads convincingly as looking up inside an enclosed underground cave ceiling, with no leaks to the
  surface." Plain answer: "Neither A nor B shows any sky or any part of the village above".
- Outside 6/10, hilltop 7.5/10; roofs: "Nothing on top of the roofs is a black slab". Its one roof complaint is the
  balcony (the uncovered part of the common room under a partial upper storey is a deck with a railing): by design.
- Interior still 4.5–5/10, all of it pre-existing up close: sky above and beside the front double door (probe: rays from
  inside at 8.0–9.2 ft toward the door meet nothing; door piece tops 8.8–9.0, posts 8.9, upper storey from 10; the storey
  band does not fill over a door), door/jamb slits (0.03–0.04 ft), decimated props ("shattered black-and-brown polygon
  tangle": the 10,000-face ladder's tearing, docs/ASSET_DELIVERY.md), and a pawn standing inside a piece of furniture
  (a tabletop rule: nothing stops a pawn on furniture). LEFT for the wall kit / band / delivery owners.

## Frame time, after (quiet box, loadavg 4–12)
- 43 rooms (roofs on in FPV): map 16.2, fpv-in 12.6, fpv-out 20.8, fpv-walk 25.2 (p95 131), map-walk 15.5 (p95 96).
- 121 rooms (roofs as they were): map 21–28, fpv-in 30–44, fpv-out 48–76, fpv-walk 259 (was 344 before holesAt was kept
  per state; the profile: roomWithCell/holeCellsAt/stairsOf under stairWalk → stairStatus → holesAt, 50% of the CPU),
  map-walk 86–174. Walking a big town is still the move's own cost (app.batch + world.sync per step) plus 5k draw calls.
## Suites (fpv branch, local)
- browser_fpv 53/53 (local and dev), pawnring 106/108 (the 2 are share.export/share.link in a pawn's ☰: the sharing
  work's, failing on main too), pawnsmenu 168/168, cut 142/142, cuts 26/26, storeys 43/43, stairs 44/46 and falls 54/55
  (both failing identically on main d21796a0: pre-existing), build 97–98/98 (F2 rename flaked twice under load, passed
  on the next run; 98/98 on main), npm test all green, relay 209/209 (+3 for presence eyes).
### r4 (fog, darkness, door, dice, tag, phone; part on older stills)
- The tag: "`👁 in first person` ... It hovers over Mira's pawn ... Would a player understand it? Mostly yes", with the
  caveat "the tag doesn't say who is looking" → when the looker is not the pawn's own person the tag names them.
- Phone: "The 4-way movement pad is well-sized and sits in an easy right-thumb zone", but the down arrow "almost touches
  the bottom chat bar" → the pad moved up; a phone hint line ("Drag to look · tap a floor to walk there · the arrows step").
- Fog outdoors: "a giant flat grey checkerboard floor plane from an upper indoor level floats completely exposed in the
  upper-left sky" → the fog's level capped at the pawn's (world.eyeLevel) — not enough on its own (r6, below).
- Darkness "does not darken the room": the common room has its own lit fire and lanterns (the darkness suite puts them
  out first); the stills did not. Not a first-person matter.
### r6 → r7: the fog of war's overlay at eye level
- r6: the unseen store room's wall 1/10 "a shattered soup of missing and overlapping triangles smeared with grey-blue
  fog"; the phone view "the wall in front of the player is semi-transparent and reveals both a checkerboard floor and a
  checkerboard ceiling plane". The overlay (bank, never-seen checkerboard, known-wall faces) is a top-down look.
  → fogDrawOff while looking (client/fog.js): the overlay is not drawn; fogRule and the relay still withhold everything.
- r7 after: outdoors 8/10, "Fog, mist, or checkerboard: None visible. Nothing is floating in the sky ... Can you see
  inside any unseen room or anything that should be hidden? No." The store room: "You cannot see furniture, floor, or
  interior walls inside the unseen store room", but its wall at 2.5 ft still reads torn (3/10): the kit's wall mesh up
  close over the dark of an undrawn interior. Inside next to the stair 2/10: the stair's stringer 2.5 ft away fills half
  the view (real geometry), plus the same decimation up close. Phone: avatars under the bar → hidden while looking on a phone.

## Landed (final, 12:14)
- main f36dc390, dev client v=20261029121424, release candidate **20261029-121451-f36dc390** (DEV only).
- On dev: browser_fpv --page http://127.0.0.1:8180/ 53/53. Local: fog 43/43, fogtweaks 65/65, darkness 10/10, storeys 43/43, npm test green.
