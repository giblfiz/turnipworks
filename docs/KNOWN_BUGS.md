# Known bugs (not yet fixed)

Small game bugs we've seen and decided to leave for now. Each one says where it was seen and why it's still open.
Tester reports go to the ticket box instead (Settings ▸ Feedback, `tools/tickets.py`). This list is for what we find ourselves.
When a bug is fixed, move its line to "Fixed" with the commit.

## Open

- **The starter builds offer only "Test cottage"**, which is a test fixture (2026-11-04, manual walk; `engine/client/starter/index.json`).
  Waiting on Harry: remove it or replace it.
- **The glTF, TaleSpire and STL export buttons are greyed out** (2026-11-04, manual walk). Waiting on Harry.
- **docs/UI.md and docs/RULERS.md are out of date in places** (2026-11-04, manual walk). The manual (docs/site/manual.md) was checked against the code; these were not.
- **Small floats from catalog bounds** (2026-11-06, found by `tools/spawn-tuner/test/resting.test.mjs`, listed there as DEBT and in docs/TEST_DEBT.md).
  - What is set on `table-feast--fine` floats 0.19 ft: its catalog height is wrong.
  - `linen-chest` sits 0.13 ft up and `statue-rotating--s2` 0.16 ft up: their meshes' bottoms sit above their origins.
  - Cause: `build_data.py` takes bounds from the Blender step, not from the shipped mesh. A fix means a library rebuild: Harry's call.
- **A bowl on a bar counter may float** (2026-11-06, unchecked lead). In a common room rolled with seed 4402, a "beans bowl" on the bar counter measured 1.28 ft over the counter's top as drawn. The resting test passes every roll, so this may be how it was measured.
- **Dice upstairs by a wall, intermittent** (2026-11-01, browser_dice_wall W9 on dev). Wiki backlog "Bugs and leftovers"; not looked at in the 11-06 sweep.

## Fixed

2026-11-06 bug sweep. The tests named fail on the code before the commit and pass after.

- **A click on a wall picked the pawn behind it.** `269249d2`; browser_pickfixes WALL.
- **Cursors were drawn on the ground**, so another seat's cursor sat away from what was pointed at, sometimes by feet ("a hover cursor effect that never comes out distant from the mouse", Nick 2026-11-01). `e581718a`; browser_pickfixes CURSOR.
- **Things on a tilted table floated** (or sank into its slope). `c3ee9d18`; browser_pickfixes TILT.
- **A re-roll ignored deleted walls.** `05436d5c`; rerollwalls.test.mjs.
- **Pawns on roofs showed with roofs switched off.** `bccf6315`; browser_pickfixes ROOFPAWN.
- **Stair warnings showed to every seat that saw the stair** (players too). They are GM-only now; the GM's party preview shows none either. `5e260d80`; browser_stairnote PLAYER.
- **"Comes up through a wall" was too strict for a stair climbing onto a hill's edge.** A flight onto a hill's bare top, or into one room standing on a hill, passes now; real rooms still flag. `5e260d80`; stairs.test.mjs. The Dragon Temple grand stair stays flagged for another reason: a one-square upper hall, all of it stair hole, stands over its foot. Open question for Harry: should such a room count as a wall?
- **A new hill could bury a pawn.** What stands where the hill's top goes (pawns, loose things, a pawn on such a thing) is lifted onto it in the same batch, so one undo puts it all back. `ba5d3b75`; browser_hills BURY.
- **A dug-in door could open onto earth** (556 of 720 dug-in test rooms). A wall whose outside is earth above the floor holds no door. `ba5d3b75`; hillground.test.mjs. No way up or down a hill side is a feature, noted in docs/VERTICAL.md, not built.
- **Seat location after a quick there-and-back**: a reload landed on the other area. `a6ea5569`; browser_travelback.
- **"6 goblins" picked Goblin boss**, and Bugbear chief, Cult fanatic, Ghast and Lizard king had the same fault. `bdaf2443`; figsearch.test.mjs.
- **The keys list said Settings ▸ Me for keys that live in Settings ▸ Controls.** `1feca264`; browser_keysettings.
- **A deploy could leave files at mode 660** (dev 403'd the tuner icons). `7523e0e0`; tests/test_publish_tree.py.
- **browser_dice_wall W7 always failed on dev's Cloudflare websocket 404.** `80eca49a`; test_tunnel_noise.py.
- **Fog of war was janky while the view rotated** (Nick, 2026-11-01). At Medium and Low graphics the moved fog window was re-read only on simulation steps. `1e515162`; browser_fogspin.
- **Mine: a wheelbarrow floats above the floor (2026-11-04)**: not reproduced. Measured in the roll, the mesh and the drawn scene, it rests on the floor, and a close-up blind read agrees. The wide-view read was wrong. A guard was added: `43771047`, resting.test.mjs. Notes: experiments/2026-11-06-room-dressing/LAB_NOTES.md. The /assets still is left as Harry asked.
- **Monster lair: a skeleton pokes through a wall (2026-11-04)**: not reproduced. The dragon skull's drawn box stops 0.17 ft short of the wall's inner face; nothing crosses. Same guard and notes as above.
