## Culture packs B (2026-11-06): Norse, Middle East (Mamluk), medieval Rus', Mexica

Harry 2026-11-06: "cultures meaning Japan/China/middle East/mezo America/Russia/India/barbarian north asset packs ... The
asset packs probably don't need be huge." Each pack is a wall family, a roof style from the existing set (core/height.js
ROOF_BY_FAMILY), six room types and 18-24 new meshes, under the Build tray's genre **Cultures** (engine/tools/build_types.py
GENRE_OF; the Japan/China/India lane uses the same genre). Research, the rosters and the deliberate NOTs (no horned
helmets, no Orientalist bazaar clichés, no sacred text as decoration, no gore at the Mexica shrine):
`experiments/2026-11-06-cultures-b/ROSTERS.md` and the sensitivity read in `reads/`.

**The culture-room skeleton** (js/solver2.js block cb:solver2): a room is DATA, `cbRegister(key, { name, focal, steps })`,
each step one of a dozen ops over the helpers above (far, longwall, centre, ends, screen, behind, posts, wall, corner,
near, front, flank, on, pile, hang, rug, lights; outdoor: ocentre, oedge, ocorner, orows, osides, oplants). The signature
piece goes down first (`focal: true`), then the hub's swirl and the walks from the doors, then the rest. A piece the
library lacks, or whose tier the room does not list, is skipped. Every mesh is its pack's EXCLUSIVE tier (nrs, mde, rus, mes),
so no older room changes. Test: `node test/cultures_b.test.mjs [--pack=nrs] [--fake]`.
