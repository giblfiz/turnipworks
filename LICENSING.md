# Licensing

Turnip Works is two things under two licences, plus a name that is not licensed at all.

- **Code** (the engine, the relay, the asset tuner, the asset pipeline, tests and build tools) is licensed under the **GNU Affero General Public License, version 3 only** (`AGPL-3.0-only`). Full text: [`LICENSE`](LICENSE).
- **Assets and content** (the generated asset library, the catalog, style references, painted icons, and the project's prose and data) are licensed under **Creative Commons Attribution 4.0 International** (`CC-BY-4.0`). Full legal code: [`LICENSE-ASSETS`](LICENSE-ASSETS).
- **The Turnip Works name and marks are not licensed** under either. See "Name and marks" below.
- **Third-party components** keep their own licences. See "Third-party components" below.

Copyright © 2026 Implausible Enterprises LLC. Made by Harry and Fauna. Licences chosen 2026-10-20. Before this repository was published, an internal audit (2026-10-20/21) checked it for secrets, asset provenance and the generators' output terms; the generator terms it relied on are in [`experiments/2026-10-21-licence-audit/generator-terms.md`](experiments/2026-10-21-licence-audit/generator-terms.md).

## Which paths are which

The rule is by kind of file, with paths as the usual case. Source code is AGPL wherever it sits. Content and data are CC BY wherever they sit. Anything listed under "Name and marks" or "Third-party components" is neither.

**Code: AGPL-3.0-only**

| path | what |
|---|---|
| `engine/` | the game: `client/`, `core/`, `relay/`, `tools/`, `test/`, `deploy.sh` (except `client/vendor/`, `core/bip39-english.js`, the marks, and the data files listed below) |
| `tools/` | the Spawn Tuner (`spawn-tuner/js`, `*.html`), the asset pipeline's build steps (`spawn-tuner/prep/*.py`, `meshopt.mjs`), import lab, release and test tooling, tickets (except the `vendor/` directories) |
| `src/` | the asset pipeline: image, fal, RunPod/TRELLIS.2 runners, Blender validation and optimisation, the catalog validator |
| `server/`, `tests/`, `web/` | the review server, repository tests, the review benches |
| code files under `experiments/`, `research/`, `reviews/` | every `*.py`, `*.js`, `*.mjs`, `*.sh`, `*.html`, `*.css`, and the systemd units |

The pipeline code (`src/`, `tools/spawn-tuner/prep/`, the generation scripts under `experiments/`) is covered by the AGPL like the rest of the code unless a file says otherwise. Model weights are never part of this repository. Each operator fetches them and is bound by their own licences (TRELLIS.2 is MIT; others differ). Publishing the pipeline code does not relicense any model.

**Assets and content: CC BY 4.0**

| path | what |
|---|---|
| the served asset library (`tuner/assets/` on the web server, built from the pipeline; binaries are not in git) | meshes and their tiers (`d/`, `lod/`, `m/`), textures (`tex/`), figures (`figures/`), flat tiles, cards and banners (`flat/`), painted UI icons (`ui-icons/`), emblems (`emblems/`), the wall kit (`wallkit/`) |
| `catalog/` | the taxonomy, room recipes, render sets and object lists |
| catalog and library data | `tools/spawn-tuner/data/*.json` (incl. `library.json`), `tools/spawn-tuner/assets/**/*.json`, `engine/client/data/*.json`, `engine/tuner-data/*.json` |
| `style-references/` | the house-style plates and their prompts |
| generated images and screenshots | `docs/design/**/*.png`, `tools/spawn-tuner/ring/**/*.png`, and any generated image under `experiments/` |
| prose and records | `*.md` files, `docs/`, `research/`, prompts, manifests, logs and rating records under `experiments/` and `reviews/` |

**Not covered by CC BY** (not ours):

- `import-lab/samples/garden-gnome.glb` on the web server: Poly Haven's Garden Gnome (CC0, by Bhargav Kubal), a test input for the import lab, not a Turnip Works asset.

**Not distributed** (removed 2026-10-21, so nothing here grants rights in them):

- **Style candidate C's plate** (`style-references/heroic-stylized-pbr-tavern-v1.png`). It was generated with a third-party Hero Forge screenshot as a style reference, so it is not ours to offer under CC BY. Its prompt record stays in `style-references/`. The later style plates and the asset library took proportions and finish from C, never its content; they are ours and covered by CC BY like the rest.
- The Stanford Dragon sample once used by the import lab (Stanford 3D Scanning Repository, non-commercial terms), and a chest pilot made with Tencent Hunyuan3D (its licence restricts where outputs may be distributed). Neither is in the library or this repository.

**Made with AI.** The meshes, textures, tiles, figures and painted icons were generated with AI image and 3D models (Google Gemini image models, OpenAI image generation, Microsoft TRELLIS.2 self-hosted and through fal), then selected, corrected and arranged by hand. They are not represented as hand-made. Where an output carries an embedded provenance mark (such as Google's SynthID), it has not been removed; please don't remove it either. Purely machine-generated material may not be protected by copyright in some countries; the CC BY licence applies to the extent that rights exist, including in the selection and arrangement of the library and in human edits.

### Attribution for CC BY reuse

When you reuse Turnip Works assets, credit them like this:

> Turnip Works assets (https://turnipworks.net), CC BY 4.0

Add the asset's name and a note if you changed it (for example "modified: recoloured"). A link to the licence (https://creativecommons.org/licenses/by/4.0/) satisfies the licence's link requirement.

## Name and marks

"Turnip Works", the turnip mark (`engine/client/mark.svg`, `engine/client/mark-plain.svg`, the same mark drawn inline in `engine/client/index.html`), the word marks and logos, and the domain `turnipworks.net` are **not licensed** under the AGPL or CC BY. You may describe your fork truthfully ("based on Turnip Works"), but a modified version or a separately hosted copy must not present itself as Turnip Works or use the mark as its own. AGPL section 7(e) permits this restriction on trademark use.

## Third-party components

These are not ours. Each is redistributed under its own licence, whose text or notice sits beside it as that licence requires.

**Vendored (copies in this repository and served to browsers):**

| component | version | where | licence | licence text |
|---|---|---|---|---|
| Rapier (`@dimforge/rapier3d-compat`) | 0.20.0 | `tools/spawn-tuner/js/vendor/` | Apache-2.0 | `rapier3d-compat-0.20.0.LICENSE.txt` |
| three-mesh-bvh | 0.8.3 | `tools/spawn-tuner/js/vendor/`, `tools/import-lab/vendor/` | MIT (Garrett Johnson) | `LICENSE.three-mesh-bvh` |
| postprocessing | 6.39.5 | `tools/spawn-tuner/js/vendor/` | Zlib (Raoul van Rüschen) | `LICENSE.postprocessing.txt` |
| N8AO | 2.0.1 | `tools/spawn-tuner/js/vendor/` | CC0-1.0 | `LICENSE.n8ao` |
| three-good-godrays | 0.12.1 | `tools/spawn-tuner/js/vendor/` | Zlib (Casey Primozic) | `LICENSE.three-good-godrays` |
| three.quarks, quarks.core | 0.16.0 | `tools/spawn-tuner/js/vendor/` | MIT (Forrest Sun) | `LICENSE.three.quarks`, `LICENSE.quarks.core` |
| three-fire | 1.4.0 | `tools/spawn-tuner/js/vendor/` | MIT | `LICENSE.three-fire` |
| meshoptimizer decoder | 1.2.0 | `tools/spawn-tuner/js/vendor/` | MIT (Arseny Kapoulkine) | `LICENSE.meshoptimizer` |
| meshoptimizer simplifier | 1.3.0 | `tools/import-lab/vendor/` | MIT (Arseny Kapoulkine) | `LICENSE.meshoptimizer.md` |
| Inter (font, latin variable-weight subset) | | `engine/client/vendor/inter/` | SIL OFL 1.1 | `LICENSE` |
| Lucide icons (subset, inlined in `engine/client/icons.js`) | lucide-static 0.460.0 | `engine/client/icons.js` | ISC (portions MIT, Feather) | `engine/client/vendor/lucide/LICENSE` |
| BIP-39 English word list | bitcoin/bips `ce1862ac` | `engine/core/bip39-english.js` | MIT | `engine/core/bip39-LICENSE.md` |

A frozen copy of the tuner's vendor directory also sits under `experiments/2026-10-11-types/hut/integration/sandbox/pristine/js/vendor/` with the same licence files.

**Loaded from a CDN at runtime (not copied into this repository):**

| component | version | from | licence |
|---|---|---|---|
| three.js and its `examples/jsm` addons (GLTFLoader, Line2, the Draco decoder) | 0.170.0 | cdn.jsdelivr.net | MIT (three.js authors); the Draco decoder is Apache-2.0 (Google) |
| `<model-viewer>` | 4.0.0 | unpkg.com (review benches only) | Apache-2.0 (Google) |
| Fraunces, DM Mono | | fonts.googleapis.com (tuner and benches) | SIL OFL 1.1 |

**npm and Python dependencies (installed, not committed):** `ws` (MIT) for the relay; `@gltf-transform/*` and `meshoptimizer` (MIT) for the asset build step, whose transitive `sharp` is Apache-2.0 and bundles libvips (LGPL-3.0); Pillow (MIT-CMU) for the Python tools. `docs/ASSET_DELIVERY.md` "Licences of what was added" lists them.

**Generators and models.** The assets were made with AI image and 3D generators. Their output terms, and why the outputs can be offered under CC BY, are in `experiments/2026-10-21-licence-audit/generator-terms.md`. No model weights are distributed here.
