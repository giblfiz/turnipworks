# Mine: flats (strips, decals, icons)

Made 2026-10-11 with the dungeon batch's flats tools (copied into `flats/`; method and checks: `../dun/flats/README.md`).
Codex image route only; one request each (20 images), no re-rolls needed. Prompts: `flats/raw/prompts/`, `flats/gen.py`.

| what | files (`flats/`) | how it is used |
|---|---|---|
| cart track, one 5-ft tile of a row (repeats left-right; opaque, not `decal-`) | `decals/mine-rail-strip--s1.jpg`, `--s2.jpg` | `minRoad()` lays a row down a tunnel, a siding in the sorting chamber |
| turntable, one 5-ft tile | `decals/mine-rail-cross--s1.jpg` | the middle of a junction |
| track end with a buffer baulk | `decals/mine-rail-end--s1.jpg` | in the library, placeable by hand; no program lays it yet |
| scatter | `decals/decal-ore-scatter--s1.jpg`, `--s2.jpg`, `decals/decal-coal-dust--s1.jpg` | floor dressing |
| room icons, 128 px RGBA | `icons/room-min-*.png` (13) | copied to `engine/client/data/icons/` at integration; `type-MIN.png` existed |

Checks: strips measured left/right (`raw/checks/*-3x1.jpg`, `*-in-floor.jpg`; seam score in `strips.log`); the turntable
and the track end finished as full opaque plates (`finish_strips.py`). Blind Gemini read of one sheet (2026-10-12): the
strip "unmistakably a straight piece of track ... nothing would stop it joining left to right", "a railway turntable",
"the end of the line ... a buffer stop", "a pile of valuable ore", and the coal smear "muddy / disturbed ground with two
wheel ruts" (acceptable: it is dressing). Icons, blind: 13 of 13 described as intended (the shaft head as "a well with a
winch", the tool store as "crossed pick and shovel on logs"), "a highly consistent set".
Not made: a curve tile (the road is laid in straight rows only).
