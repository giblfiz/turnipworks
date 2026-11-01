# Hills (and the ground) see-through below the ground (2026-10-27)

The rule as built: docs/VERTICAL.md "Hills below the ground are see-through"; how it looks: docs/UI.md "Hills".

`browser_shots.py` runs a COPY of Harry's campaign (cmp_q2bjx70ajq, area "Dragon Temple": a 16 x 16-square, 10-ft hill at
x 35..115, z -25..55 ft, a cave and a trap corridor under it) on a local relay with its own secret; the GM token is minted
locally and never printed. It shoots lv 1 and lv -1 from a high, a low and a 3/4 angle, and with `--sees` lv -1 at each
value (hills and ground together, set through `campaign.set` as the sliders do). Shots stay out of git.

## Gemini (agy-run), blind to what changed

Before (main, e43075cb's crater), lv -1, 3/4 view: "The hill is deeply cratered and cut away: most of its bulk is hollowed
out into a large rectangular sunken pit bordered by tiered earthen walls, with a remaining front grassy ledge that contains
a small rectangular shaft/hole beside Building 1."

After, lv -1:
- 0: "The hill is completely absent ... The entire subterranean complex is visible."
- 0.25, 3/4 view: "The hill is whole and continuous, featuring a flat green top, sloping brown earthen banks, rocks, and
  bushes, without any cuts, craters, holes, or sunken sections. ... Both the hill and open ground are translucent (roughly
  25% opacity). ... The subterranean cave (tan floor, 6 large rock pillars, rocky boundary walls) and dungeon rooms ...
  show through the translucent terrain."
- 1: "The hill is whole ... completely solid (100% opaque) ... the entire subterranean cave (floor, pillars, and rock walls)
  is 100% hidden beneath the solid green hill." (The "absent" open ground it reports at 1 is this area's bare ground, the
  dark #2b2e25 plane: measured visible, opaque, its own material, as on main.)

The first after-run also showed a black square and a circle in the hilltop at lv -1, at every setting: the grand stair's
top and the cathedral's round hole, rooms ON the hill cut away below the ground, whose holes were cut into the hill's own
tiles. Fixed (a tile a room takes keeps no hole of it: world.js buildShell); probed: 6 of 6 of those squares drawn.

Open, from the reads (for Harry, "we will iterate"): at 0.25 the hill's bushes and rocks look like they float over the
cave ("depth ambiguity"); the Hill and Cave labels stack over the same place; Gemini suggests outlines for what is below.
