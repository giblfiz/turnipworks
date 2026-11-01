# Room recipes — caves

A CAVE (2026-10-25, Harry, after the caves pilot: "looks a lot more like a cave. Add a few pillars, stalagmites and
such, and let's push it into the game!") is a room below the ground (lv -1 by default) walled with natural rock. Its
rock is NOT furniture: the engine stands the pilot's overlapping generated rock chunks along its outline, takes a few
squares out of it as rock pillars and puts stalagmites against its walls (docs/VERTICAL.md "Caves",
`engine/core/caves.js`), worked out from the cave's squares and its seed. So these recipes have no slots: its program
places nothing (solver2.js KEY.cave), and the GM furnishes it by hand. One recipe per type the cave is listed under in
the Build tray (the prefix names the type): the monster lair, the dungeon and the mine.

### lai-cave P1

### dun-cave P2

### min-cave P2
