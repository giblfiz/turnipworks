# Turnip Works

Turnip Works is a 3D virtual tabletop that runs in the browser: a shared table where a GM and players build rooms and buildings from a library of furniture and figures, move pawns, roll dice and play. It is live at **https://turnipworks.net**.

This repository holds the game (`engine/`), the Spawn Tuner that lays out rooms and builds the asset library (`tools/spawn-tuner/`), the asset pipeline (`src/`, `experiments/`), and the records of how each asset batch was made.

Turnip Works is made by Harry and Fauna. The code is AI-assisted, or "vibecoded": written mostly by AI coding agents, directed and play-tested by people. The assets are AI-generated and hand-curated. `LICENSING.md` names the generators.

## Running it locally

You need Node 20 or later and Python 3.

```
cd engine && npm ci && npm test && cd ..
python3 tests/tw_test_site.py --port 8000     # serves the repo and starts a throwaway relay; prints its address
```

Then open `http://127.0.0.1:8000/engine/client/` for the game, or `http://127.0.0.1:8000/tuner/` for the Spawn Tuner. The relay keeps its campaigns in a temporary folder that is deleted when the script stops. To run a relay on its own, use `node engine/relay/server.js`. It reads `PORT`, `DATA_DIR`, `TUNER_DIR`, `TUNER_DATA` and `PUBLIC_BASE` from the environment, and makes its secret and admin key in `DATA_DIR` on first start.

**What is not in this repository:**

- **The asset binaries.** The meshes, textures, figures and tiles (about 11 GB) are git-ignored. `tools/spawn-tuner/data/library.json` lists them, and the pipeline under `src/` and `experiments/` builds them. A local copy runs without them, but the furniture and figures will not load. On turnipworks.net they are served from the site itself.
- **Model weights and API keys.** The pipeline scripts read a key from an environment variable (such as `GEMINI_API_KEY`) or from a key file you name (`--key-file`). Their default key paths are placeholders. Each model is bound by its own licence.
- **Hosting.** Deploy and release scripts (`engine/deploy.sh`, `tools/spawn-tuner/deploy.sh`, `tools/release.sh`), the systemd units and nginx files in `engine/relay/`, the ratings server (`server/`) and the feedback triage (`tools/tickets.py`) describe how the live site is run. They assume that server's paths. Read them as examples, not as an installer.

Most suites under `engine/test/`, `tests/` and `tools/*/test/` drive a real browser through Playwright. `tools/run_all_tests.py` runs them all. They need the asset binaries, and some need a GPU. The `node` suites in `tools/test_matrix.json` need neither.

## Licences

- **Code:** GNU AGPL-3.0-only (`LICENSE`).
- **Assets and content:** CC BY 4.0 (`LICENSE-ASSETS`). This covers the asset library, catalog, style references and prose.
- **Not licensed:** the Turnip Works name and mark.

Copyright © 2026 Implausible Enterprises LLC.

`LICENSING.md` says which paths are which, lists the third-party components and their licences, and explains how the AI-generated assets were made.
