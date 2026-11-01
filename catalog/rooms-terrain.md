# Room recipes — terrain (hills)

A HILL (2026-10-24, Harry: "a way to raise some earth, maybe by default with grass on it. Could be a room type out in
nature, but get things one story up") is a flat terrace of raised ground drawn like a room: outdoor, no walls, its
ground on top at a 5-ft step (10 ft by default: one storey up). The bank down to the lower ground is NOT furniture: the
engine works it out (docs/VERTICAL.md "Terrain: computed banks", `engine/core/terrain.js`) and dresses it with the
generated rocks. A hill's top is bare ground the GM furnishes by hand: its program places nothing (solver2.js KEY.hill),
and its slots only stock its library shelves with things a hilltop takes. One recipe per
type the hill is listed under in the Build tray (the prefix names the type): the inn (beside the yard), the farmstead,
the castle (a motte) and the monster lair.

### tav-hill P1
- plants: bush, bush-berry, bush-rose, tree-deciduous, tree-birch, tree-fruit, tree-oak-great, flowerbed
- furnish: log-seat, bench-stone, firepit-stone-round

### hut-hill P2

### cas-hill P2

### lai-hill P2
