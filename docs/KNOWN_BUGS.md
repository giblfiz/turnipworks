# Known bugs (not yet fixed)

Small game bugs we've seen and decided to leave for now. Each one says where it was seen and why it's still open.
Tester reports go to the ticket box instead (Settings ▸ Feedback, `tools/tickets.py`). This list is for what we find ourselves.
When a bug is fixed, move its line to "Fixed" with the commit.

## Open

- **Mine: a wheelbarrow floats above the floor** (2026-11-04). Seen in the Mine pack's still on /assets
  (`engine/client/site/library/h/mine-20261104-{600,1200}.webp`, shot by `tools/promo/capture.py --probe`).
  Gemini spotted it in a blind read. The still is a real render of a furnished room, so the room-dressing roll puts the wheelbarrow at the wrong height.
  Likely cause (unchecked): the model's base, or a stacking rule that sets it on something that isn't there.
  Harry, 2026-11-05: leave the still as it is and log the bug.
- **Monster lair: a skeleton pokes through a wall** (2026-11-04). Seen in the Monster lair pack's still on /assets
  (`.../h/monster-lair-20261104-{600,1200}.webp`). Same source and decision as above.
  Likely cause (unchecked): a wall-hugging prop is placed without enough clearance from the wall.
- **"6 goblins" picks Goblin boss** (2026-11-04, found in the manual walk). The command bar's count placement
  chooses the boss figure ahead of the plain goblin. The manual and features page avoid showing it.
- **Keys list says Settings ▸ Me for keys that live in Settings ▸ Controls** (2026-11-04, manual walk).
- **The starter builds offer only "Test cottage"**, which is a test fixture (2026-11-04, manual walk; `engine/client/starter/index.json`).
  Waiting on Harry: remove it or replace it.
- **The glTF, TaleSpire and STL export buttons are greyed out** (2026-11-04, manual walk). Waiting on Harry.
- **docs/UI.md and docs/RULERS.md are out of date in places** (2026-11-04, manual walk). The manual (docs/site/manual.md) was checked against the code; these were not.

## Fixed

(none yet)
