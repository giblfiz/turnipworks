# Culture roofs (lane culture-roofs, 2026-11-07): the contract between the three workers

Harry 2026-11-07, on "should Japan and China get their proper tile roofs?" and the other culture follow-ups: "yes do roofs and such."
Rules every lane follows: /tmp/scratch/tw-lanes-common-1107.md
Worktree <repo>, branch culture-roofs. Pictures: /mnt/usb/turnip-works/lanes-2026-11-07/culture-roofs/

Three workers share this worktree:
- **ENGINE** (the lane's parent): engine/client/roofs.js, engine/core/height.js, engine/client/world.js (roof parts), roof tests,
  docs/VERTICAL.md roof sections. Roof SHAPES are code (irimoya hip-and-gable, the upturned/curved eave "bend", hip ridges,
  per-style overhang and pitch) and placement RULES for roof ornaments.
- **ASSETS** (agent M): the sensitivity read, every generated picture and mesh of this lane, one RunPod pod, landing them in
  the library. Owns experiments/2026-11-07-culture-roofs/assets/.
- **SUCH** (agent S): sliding doors (Japan), the Mexica ballcourt, the Indian stepwell sunk, the Mexica "payphone" wall.
  Owns experiments/2026-11-07-culture-roofs/such/.

Shared files (tools/test_matrix.json, docs/*.md, catalog/*.md, engine/client/data/*.json, tools/spawn-tuner/data/*): edit
with Edit (small, anchored edits), never rewrite; ONLY ENGINE commits shared files. Each agent commits its own files by name
(never `git commit -a`, never `tools/spawn-tuner/ring/registry.json`) and lists the shared files it touched in its report.

## New roof styles (keys are FIXED: engine code is written against them now)
| key | what | used by default on | section |
|---|---|---|---|
| `kawara` | Japanese silver-grey interlocking clay pan tiles (sangawara), late Edo | wall family jpn-shoji (house, shop, dojo) | roof-section--kawara.glb |
| `tongwa` | Chinese grey cylinder tiles: concave pan tiles under round cover tiles in straight columns, mid-Qing Beijing | chn-brick | roof-section--tongwa.glb |
| `glazed` | Chinese glazed tiles, green (sensitivity read decides green vs yellow vs grey-with-green-trim) | chn-temple | roof-section--glazed.glb |
| `sod` | Norse pitched turf: grass over birch bark, ragged, no joints (build like thatch) | norse-stave | roof-section--sod.glb |
| `tes` | Rus' plank roof: long split boards running DOWN the slope (one or two courses per 5 ft) | rus-log izba/terem/banya/market (P3) | roof-section--tes.glb |

Sections are built by experiments/2026-10-11-roof-sections/build_sections.py (add STYLES + detect.py COURSES entries with a
`path` to this lane's plates; build ONLY the new styles: `build_sections.py kawara,tongwa,glazed,sod,tes --install`, which
keeps the other entries of roofsections.json). Plates: Codex image_gen (free route), the ROOF prompt of
experiments/2026-10-27-roofs-temple/gen.py as the template, made seamless with that folder's finish.py approach.

## Roof ornaments (catalog ids FIXED; sizes in inches W x D x H as the catalog writes them; engine places them by rule)
| catalog id | what | size | where the engine puts it |
|---|---|---|---|
| `roof-ridge` skus `--kawara`, `--tongwa`, `--glazed` | 5-ft ridge section: Japanese stacked noshi-gawara under a round cap tile (grey); Chinese grey ridge of stacked tiles; green glazed ridge | 60x20x22 | along every ridge of that style (and the hips) |
| `roof-onigawara` | Japanese ridge-end tile (grey fired clay, plain or wave/cloud relief; the sensitivity read decides the face) | 24x14x30 | each end of every kawara ridge |
| `roof-chiwen` | Chinese ridge-end ornament (glazed, the dragon-fish acroterion, mouth on the ridge, tail curling up) | 30x14x48 | each end of every glazed ridge |
| `roof-cupola-onion` | Rus' wooden church cupola: a tall drum and an onion dome of aspen ploughshare shingles (lemekh), small finial (cross only if the read says so) | 72x72x168 | on the ridge of a rus-church room |
| `roof-dome` | Mamluk stone/plaster dome on a low drum; hammam domes have small round glass oculi | 144x144x96 | middle of an mde-hammam room's flat roof (scaled to the room) |
| `roof-malqaf` | Cairo wind-catcher: a slanted timber hood open to the north | 48x48x72 | on an mde-audience (qa'a) roof |
| `ind-chhatri` (EXISTS) | the pack's chhatri, reused | 72x72x132 | outer corners of Indian haveli / palace flat roofs |
| `roof-shikhara` | Nagara temple tower: curvilinear, sandstone, amalaka and kalasha on top, NO figures, no deity images, no text | 144x144x264 | over the sanctum end of an ind-temple room |

## Gable pictures (the gable kit, data/gables.json)
Pitched roofs over these families show the plain dark stand-in gable today: jpn-shoji, jpn-shrine, chn-brick, chn-temple,
norse-stave, rus-log. ASSETS bakes them with experiments/2026-10-27-roofs-temple/install.py / bake/ (ONLY these families:
any builder that rewrites every file writes THROUGH the symlinks into main; unlink a target before writing it).

## Ports
ENGINE browser tests: TW_PORTS=18473,18974. SUCH: 18477,18978. ASSETS (if it needs a relay): 18483,18986.
