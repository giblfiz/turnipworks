# Castle mesh QA (2026-10-05, pod sessions 20:07-22:16 and 22:49-23:25 PDT, shared with mansion and vertical)

**122 specified. 117 plates arrived, 117 meshed. 115 accepted, 2 rejected. 5 have no plate.**
Manifest: `catalog/runs/castle-01/manifest.tsv` (115 rows). Per mesh: `qa/<sku>.json` (measurements), `.sheet.jpg`,
`.verdict.json` (blind Gemini read + match), `qa/summary.tsv`; verdicts set by hand with the reason: `qa/overrides.json`.
Twins, suites, box fit: `qa-extra/`. First tries of everything re-rolled: `try1/`. Sizes and kit boxes: `manifest_overrides.json`
(the integration scout's caps merged with mine). Money: see `../spend.log` (both sessions together $2.07 for all three types).

## Rejected (2)

| piece | why |
|---|---|
| `door-cell-bars` | The panel came out nearly square twice: width:height 0.91, re-mesh with another seed 0.88, catalog 0.56. At the 60x108 box the width would be squeezed 1.6x more than the height (kit limit about 1.5x). The plate's alpha box is 0.58, so I spent the one re-roll on a re-mesh; it was the wrong one. **A new plate with the TALL, NARROW sentence would probably cure it.** |
| `door-cell-bars-open` | Left out only because its closed twin is out. The mesh passes (77 x 27 in at 108 tall, door swung, same design as the closed one: Gemini 1.0, colour dE 2). Flip its line in `qa/overrides.json` when the closed one is re-made. |

The dungeon therefore has `cell-bars` panels and no cell door.

## No plate (5), all refused twice by the plate gate

`table-experiment`, `archery-target--s2`, `armor-chainmail-heap`, `axe-hand`, `mortar-large-stone`.
(`city-wall--castle-rough` was refused too; the supervisor retried it at 22:30 and it and its turret arrived and passed.)

## Re-rolled (8), one re-roll each

| piece | first try | re-roll | result |
|---|---|---|---|
| `dais` | 10.6 x 14.2 x 2.9 ft: 2.18x too tall | new plate ("VERY LOW ... under a tenth of its length") | 10.4 x 14.2 x 2.64 ft: 1.98x, passes the 2x rule by a hair. **Accepted with a note**: see boxes below |
| `cook-hearth-spit--great` | hole in the back wall (Gemini; the back stands against a wall) | re-mesh | clean, accepted |
| `wall-window-small--castle-rough` (arrow slit) | width:height 0.74 (catalog 0.56) | re-mesh | 0.69, inside the 25% rule; slit clear, 23% x 44% of the face |
| `mil-quintain` | 4.8 ft tall with a 7-ft arm | new plate | 7 ft tall, 7-ft arm, 3.75-ft cross foot. Fails only the catalog footprint 60x12, which no cross-footed post can have: accepted by override at its own box 45x84x84 |
| `table-feast--s2` | 10 x 5.4 ft (cloth flaring), 4.2 ft tall | new plate | 10 x 3.85 x 3.7 ft, accepted |
| `crossbow` | 2 floating pieces, 12% of the mesh | re-mesh | 0 floating, accepted |
| `door-cell-bars` | 0.91 | re-mesh | 0.88: rejected |
| `cage-floor` | spec route was `hunyuan-mv` (fal $0.525) | tried on TRELLIS first | passes: a cage of thick bars with a door, 0 floating, 0 unpainted. **No fal was used** |

## Wall kit, measured first

| panel | width:height (catalog 0.56) | depth:height | opening | box |
|---|---|---|---|---|
| `wall-straight--castle-rough` | 0.58 | 0.12 | none | 60x12x108 |
| `wall-straight--castle-rough--s2` | 0.57 | 0.11 | none (Gemini: hairline gaps in one mortar line, 6% x 2%) | 60x12x108 |
| `wall-doorway--castle-rough` | 0.57 | 0.10 | from the floor, 55% of the width x 66% of the height (33 x 71 in at the box) | 60x12x108 |
| `wall-window-small--castle-rough` | 0.69 | 0.11 | a cross slit, 23% x 44%, not to the floor | 60x12x108 (width squeezed 0.8) |
| `window-stained-glass--dressed-stone` | 0.61 | 0.14 | none (glass opaque, as specified) | 60x12x108 |
| `cell-bars` | 0.74 | 0.06 | bars see-through (38% open) | 60x5x108 (width squeezed 0.75) |
| `portcullis--castle-rough` | 1.34 (catalog 1.11) | 0.15 | grille down | 120x18x108 |
| `portcullis-raised--castle-rough` | 1.34 | 0.17 | clear from the floor, 47% x 72% | 120x18x108, the same box |
| `city-wall--castle-rough` | 75 x 18 in at 132 tall | | | 60x20x132 |

The parent wall is tall (plate alpha box 0.46, mesh 0.58). `cell-bars` and the arrow slit are the two a re-plate would
improve (both squeezed about a quarter in width at the box; inside the 1.5x kit rule; invisible at table distance).
The portcullis arch is about 4.7 ft wide in a 10-ft panel.

Other kit boxes (catalog depth 4 to 8 in would flatten the fittings 2 to 4x; the crypt's rule): `door-reinforced--leaf`
40x11x84, `gate-double-timber` 110x13x120.

**The two daises are kit pieces and are flattened.** `dais` ships at the integration's 170x110x16; the mesh is 125 x 170 x 32
at auto scale, so the height is halved (2x; plain stone steps). `dais--s2` ships at 110x110x14, not the spec's 8: the mesh
is 20 in high and 8 would be 2.5x. If the solver needs 16 and 8 exactly, set them in `manifest_overrides.json`; if the squash
shows, raise `dais` to 22.

## Open twins (`tools/qa_twin.py`, `tools/qa_twinlook.py`: one blind Gemini pair read each)

| twin | size against closed (in, auto scale) | hollow / open | Gemini | colour dE |
|---|---|---|---|---|
| `portcullis-raised--castle-rough` | 120 x 15 x 89 against 120 x 13 x 89 | arch clear from the floor | same design, 0.98 | 8.6 |
| `iron-maiden-open` | 51 x 38 x 78 against 30 x 31 x 78 | 34% of the interior below half height (closed 6%) | same, doors open, spikes inside, 0.98 | 6.8 |
| `mil-footlocker-open` | 30 x 24.5 x 25 against 30 x 18.5 x 12 (lid up) | 73% hollow (closed 0%) | same, 1.0 | 6.0 |

## Unpainted surface (over 25% would re-roll)

Nothing over 2.4%. `mil-catapult-stones` 2.4%, `chandelier-ring--great` 2.1%, `table-kitchen-prep--great` 0.7%,
`city-wall-turret` 0.4%; every other big piece 0.0 to 0.1%: both walls, doorway, slit, stained glass, `city-wall`, `dais` x2,
`fireplace-grand`, `cook-hearth-spit--great`, `pillar-round`, `table-feast` x2, `gate-double-timber`, portcullis x2,
`sentry-box`, `rack-torture`, `tourney-lists-rail`, `mil-signal-beacon`, `pew` x3.

## Thin and risky pieces

0 floating pieces in every accepted mesh: `cell-bars`, both portcullises, `cage-floor`, `chandelier-ring--great`,
`mil-spear-tripod`, `weapon-rack--s2`, `ballista`, `banner-pole` x2, `manacles-wall`, `shackles-leg`, `windlass`.

## Notes that are not verdicts

- **Lying, not standing** (sound meshes; shipped at their own boxes): `scepter` 26x8x4, `shield-round` 30x30x9,
  `quiver-arrows` 32x10x12. Also flat on the floor: `crossbow`.
- **Standing on an edge or a point** (rack or wall pieces rendered on the floor; underside not flat): `warhammer`,
  `sword-short`, `shield-heater`, `shield-kite`, `mil-shield-stack`, `shackles-leg`, `trade-butcher-hooks-rail` (ceiling).
- **Tables are tall**: `table-feast` 14.0 x 4.3 x 3.9 ft (catalog 30 in high), `table-feast--s2` 3.7 ft. They ship by
  their length, so the tops are about 45 in up; chairs will look low beside them from the side, not from above.
- `city-wall-turret--castle-rough` has a small arched door painted at its foot (Gemini failed it for that; accepted by override).
- Bases Gemini named that are part of the design (no slab flag): `iron-maiden` square plinth, `block-headsman` low
  platform, `stone-blocks-stack` two skids, `armor-stand--s1` cross foot.
- Wall pieces "floating" in the renders: `manacles-wall`, `mil-helmet-peg-rack` (hung).
- Does not read at table distance (smalls, confidence under 0.7): `salt-cellar-ship` ("golden chalice"),
  `rite-kneeler-cushion`, `boar-head-platter`, `goblet`, `helm-great`, `horn-hunting`, `platter-silver`.
- Suite colour (mean texture colour against the parent, `qa-extra/suite.json`): `armor-stand--s3` dE 26 (leather brown
  where s1 is dark iron), `armor-stand--s2` and `weapon-rack--s2` 14; walls 5 to 8. None glaring.
- Capped by the integration: `banner-pole--s1/s2` and `pillar-round` at 104 in.

## Alignment Bench list (accepted pieces)

- **Fire (13, all painted unlit):** fireplace: `fireplace-grand`, `cook-hearth-spit--great`, `cauldron-crane`, `pig-on-spit`;
  brazier: `brazier-large`, `brazier-irons`, `mil-signal-beacon`, `mil-boiling-oil-pot`; chandelier: `chandelier-ring--great`
  (ceiling); candle: `prayer-candle-rack`, `candelabra-standing--iron`; lantern: `mil-guard-lantern`, `watch-lantern-bell`.
- **Water:** none.
- **Hinge:** `portcullis-raised--castle-rough` (a vertical slide: same box as the closed one), `iron-maiden-open`,
  `mil-footlocker-open`; leaves: `door-reinforced--leaf`, `gate-double-timber`. Missing: the cell door pair.
- **Hung (HUNG_IDS):** `cell-bench-plank`, `heraldic-shield--s1`, `--s2`, `horn-hunting`, `lever-wall`, `manacles-wall`,
  `mil-crossbow-rack`, `mil-duty-roster`, `mil-helmet-peg-rack`, `smith-helm-row-shelf`; ceiling: `chandelier-ring--great`,
  `trade-butcher-hooks-rail`.
