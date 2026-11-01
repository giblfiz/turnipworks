# Hills in the game (2026-10-24, Fauna, Claude Opus 5.5)

Harry, building a one-shot: "a way to raise some earth, maybe by default with grass on it. Could be a room type out in
nature, but get things one story up." The design was already decided (docs/VERTICAL.md "Terrain: computed banks",
after the banks demo `../2026-10-05-banks/`); this folder holds only what the build needed that is not code.

## What is here

- `gen_icon.py`, `post_icon.py`: the Build tray's **Hill** icon (`engine/client/data/icons/room-hill.png`), by the free
  Codex image route with the same prompt and style anchor as every room icon (`../2026-10-05-outdoors/gen.py`), keyed
  and sized by that folder's own method. `raw/room-hill.png` is the plate; `raw/room-hill.log` the run.
- No other new asset. The banks wear the demo's generated pictures and rock, copied unchanged to
  `engine/client/data/terrain/` (git-ignored binaries, on the build box and the web tree):
  `ground-earth-bank.webp`, `ground-rock-face.webp`, `ground-rock.webp` (free Codex route, 2026-10-05) and
  `rock-boulder.glb` (fal TRELLIS.2, 2026-10-05, $0.30 then). The bushes on the banks are the library's own
  (`bush`, `bush-berry`). Nothing hand-built.

**Spend: $0.** (Codex image route only; no fal, no RunPod.)

## Vision reads (Gemini, agy-run; labels first, then the questions)

See docs/VERTICAL.md "Built: Hills" for the verdict as it stands, and `gemini/` here for the answers.
