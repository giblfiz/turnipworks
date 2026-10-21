# Mansion mesh QA (2026-10-05, pod sessions 20:07-22:16 and 22:49-23:25 PDT, shared with castle and vertical)

**131 specified. 120 plates arrived, 120 meshed. 119 accepted, 1 rejected. 11 have no plate.**
Manifest: `catalog/runs/mansion-01/manifest.tsv` (119 rows, 27 with `tier: fine`). Files as in `../castle/QA.md`.

## Rejected (1)

`wall-doorway--noble-paper`: panel 0.79 wide:tall (catalog 0.56) and the opening 33% of the width, about 20 in at the
60-in box against a 36-in leaf. The one re-roll (a new plate with the TALL, NARROW sentence) was refused by the plate gate
for the same fault, so there is no second mesh. Supervisor's decision (22:30): stays rejected, the family borrows a doorway.

## No plate (11), refused twice by the plate gate

`wall-straight--conservatory--s2` (also after the supervisor's retry), `fireplace-marble--s2`, `daybed--fine`,
`statue-bust--s2`, `wine-bin-arched`, `platter-silver-domed`, `tray-silver`, `pitcher-silver`, `cutlery-set-silver`,
`decanter-crystal`, `lamp-post-iron` (a fire piece and the garden's only lantern).

## Re-rolled (2)

- `wall-doorway--noble-interior` (new plate): first mesh 0.86 wide:tall, plate alpha box 0.67. New plate 0.50; mesh
  accepted, opening from the floor.
- `wall-doorway--noble-paper`: see above.

## Wall kit, measured first (parents before anything else)

| panel | width:height (catalog 0.56) | depth:height | opening |
|---|---|---|---|
| `wall-straight--noble-panel` | 0.63 | 0.14 | none |
| `wall-straight--noble-panel--s2` | 0.62 | 0.12 | none |
| `wall-straight--noble-paper` | 0.59 | 0.10 | none |
| `wall-straight--noble-paper--s2` | 0.58 | 0.10 | none |
| `wall-straight--conservatory` | 0.55 | 0.11 | none: the glazing is OPAQUE, as expected. Gemini, blind: "conservatory window wall section", brick plinth under a multi-pane window. Accepted as a glazed wall at table distance |
| `wall-doorway--noble-panel` | 0.63 | 0.11 | from the floor, 40% x 65% (24 x 70 in at the box: narrow for a 36-in leaf, as in the crypt) |
| `wall-doorway--noble-interior` | 0.64 (second plate) | 0.11 | from the floor, 47% x 77% (28 x 83 in at the box) |
| `wall-doorway--conservatory` | 0.56 | 0.11 | from the floor, 40% x 76% |
| `wall-window-small--noble-panel` / `--noble-paper` | 0.61 / 0.59 | 0.14 / 0.12 | closed: panes opaque (specified glazed) |
| `wall-window-small-open--noble-panel` | 0.61 | | clear hole 39% x 47%, sill at 38% of the height |
| `wall-window-small-open--noble-paper` | 0.67 | | clear hole 40% x 46%, sill at 40% |

All four wall parents are tall. All 0.0% unpainted. Door leaves ship in deeper boxes because knobs and mouldings stand
proud on both faces (catalog 3 to 4 in would flatten them 4 to 5x): `door-panelled--leaf` 36x8x84, `door-glazed--leaf`
36x12x84, `door-double-grand--fine-leaf` 72x11x120.

## Open twins

| twin | size against closed (in, auto scale) | Gemini (blind pair) |
|---|---|---|
| `wall-window-small-open--noble-panel` | 66 x 32 x 108 against 66 x 15 x 108 (casements swung) | same design, open, 0.98 |
| `wall-window-small-open--noble-paper` | 72 x 20 x 108 against 63 x 13 x 108 | same, 1.0 |
| `sideboard-open` | 72 x 28 x 33.5 against 72 x 24.5 x 34 | same, doors open, 1.0 |
| `cabinet-china-open` | 52 x 39 x 84 against 46 x 24 x 84 | same, doors open, china on the shelves, 1.0 |
| `desk-bureau-open` | 38 x 33 x 44 against 39 x 21 x 44 | same, fall front down, 0.99 |

No wardrobe pair was specified in this batch (the library's are reused).

## Unpainted surface

`planter-topiary--s3` 6.9%, `inkwell-quill` 4.7%, `urn-garden--s1` 3.8%. Everything else under 1%, the big plain masses at
0.0%: `table-feast--fine` x2, `table-billiards`, `table-library`, `fireplace-marble`, `bed-canopy--state`, `sofa`,
`harpsichord`, bookcases, `fountain-courtyard`, `lily-pond`, `gazebo`, statues.

## Thin and risky pieces

- `chandelier-grand`, `--s2`: 0 floating. Gemini, close up: "some arms slightly warped or irregularly connected" on the
  first. Ceiling pieces rendered standing on their bottom drop.
- `harp`: 0 floating, reads "harp" (the strings are the painted panel). `gazebo`: 0 floating, columns separate, on its own
  stepped plinth (designed). `bookcase-ladder`: 0 floating.
- `candelabra-standing--s1`: Gemini saw "tiny black wick particles" above the candles; the measurement finds no floating
  piece of 1% or more. A note.
- `gown-on-form`: two small separate pieces standing on the floor beside it (not floating).

## Suites: colour against the parent (mean texture colour, dE; `qa-extra/suite.json`; notes, none glaring)

- Dining suite from `table-feast--fine` (dark mahogany, rgb 71/24/8): `sideboard` dE 30 (orange-brown 136/63/15) is the
  one that drifted; `table-feast--fine--s2` 21, `chair-plain--fine--s1` 18, `chair-armed--fine--s2` 15; `cabinet-china`,
  `chair-plain--fine--s3` 4 to 6.
- Drawing-room suite from `sofa`: `table-round-small--fine` 27 (a wood table against an upholstered sofa: expected),
  `bench-upholstered--s2` 21, `chair-upholstered--fine--s1` 18; `settee`, `footstool--fine`, `chair-upholstered--fine--s2` 4 to 6.
- `chair-upholstered--fine--s3` 27 against `desk-partners`: green leather, as specified.
- Ballroom set: `stool-upholstered` 25 and `table-console` 22 are yellower than their parents; `bench-upholstered--s1` 3.
- `cabinet-china-open` 24 against the closed one: the white china shows. Walls 3 to 12.

## Notes that are not verdicts

- `bench-potting`: a blue bucket on the lower shelf (Gemini failed it for the plate's must-not; intact, accepted by override).
- Planted pieces whose foliage overhangs the pot (underside "not flat"): `palm-potted--s1`, `--s2`, `plant-pot--s2`,
  `bush-rose--s2`, `urn-decorative--floor-vase`; also `book-open`, `centerpiece-epergne`.
- Do not read at table distance (smalls): `inkwell-quill`, `perfume-bottles`, `plate-silver`, `sconce-candle-triple--fine`.
- Statues stand on their own plinths (designed).
- `tier: fine` written in the manifest (not in assets.json) for `urn-decorative--porcelain`, `urn-decorative--floor-vase`,
  `pedestal-display--marble`, `candelabra-standing--s1`, `--s2`. Caps from the integration: `fireplace-marble` 72x24x104,
  `bookcase-ladder` 96x30x104 (`fireplace-marble--s2` has no plate).

## Alignment Bench list (accepted pieces)

- **Fire (7, unlit):** `fireplace-marble`; `chandelier-grand`, `chandelier-grand--s2` (ceiling); `candelabra-standing--s1`,
  `--s2`, `candelabra--fine--s2`, `sconce-candle-triple--fine` (wall). Missing: `fireplace-marble--s2`, `lamp-post-iron`.
- **Water (5, dry):** `fountain-courtyard`, `fountain-courtyard--s2`, `fountain-wall`, `lily-pond`, `birdbath`.
- **Hinge (11):** `door-panelled--leaf`, `door-double-grand--fine-leaf`, `door-glazed--leaf`; pairs `sideboard` / `-open`,
  `cabinet-china` / `-open`, `desk-bureau` / `-open`; `wall-window-small-open--noble-panel`, `--noble-paper`.
- **Hung:** `mirror-pier-gilt`, `sconce-candle-triple--fine`, `bell-board-servants`.
