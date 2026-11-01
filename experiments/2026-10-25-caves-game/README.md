# Caves in the game (2026-10-25, Fauna, Claude Opus 5.5)

Harry, after reviewing the caves pilot (`../2026-10-05-caves/`) with his son: "looks a lot more like a cave. Add a few
pillars, stalagmites and such, and let's push it into the game!" The design is in docs/VERTICAL.md "Caves" (and docs/UI.md
"Caves"). This folder holds what the build needed that is not engine code.

## What is here

- `prep_chunks.mjs`: the pilot's eight generated rock chunks (fal TRELLIS.2, 2026-10-05; about 48k triangles and 2.4 MB
  each) made fit for the game. The pilot's canonical transform is baked in (`kit.json` yaw, scale, stretch and offsets: origin on
  the ground at the middle of the back plane, front +Z, feet). Each is reduced to about 6k triangles, with its colour
  picture at 512 px WebP, then meshopt-compressed the house way (`tools/spawn-tuner/prep/meshopt.mjs`'s recipe). Out:
  `engine/client/data/caves/<id>.glb`, git-ignored binaries on the build box (and the web tree after a deploy), 105 to 243 KB
  each, 1.2 MB for all eight (was 21.7 MB). `chunks.json` is its report: each piece's triangles, bytes, picture and box in
  feet, checked against `kit.json`.
- `gen_icon.py`, `post_icon.py`: the Build tray's **Cave** icon (`engine/client/data/icons/room-cave.png`). It uses the free
  Codex image route with the hills icon's prompt template and anchor (`../2026-10-24-hills/`), and the same magenta key.
- `add_tuner_data.py`: the tuner data entries `build_data.py` would write for the cave type and its floor (rooms.json,
  library.json, flats.json; flats-out.json was edited directly), written by hand because `build_data.py` needs every
  experiment's git-ignored binaries. `land.sh` re-runs `build_data.py` in the main checkout and checks it writes the same.
- `land.sh`: the landing (ff-only merge, the build_data check, the tuner and client deploys to DEV, the release
  candidate, push; never live). The tuner deploy runs without its copy over `tools/spawn-tuner/ring/line-icons.js`.
- `gemini/`: the vision reads.

The floor is the pilot's own generated floor (`../2026-10-05-caves/floor/floor-cave-rock.png`), now a library flat
(`floor-cave-rock`, 512 px, made the way `prep/flats.py` makes an opaque floor). The stalagmites are the library's own
`stalagmite` and `stalagmite--s2`.

**Spend: $0.** (Codex image route for the icon; no fal, no RunPod.)
