# Crypt mesh QA (2026-10-05, pod session 16:36 to 17:53 PDT)

**76 specified. 73 meshed and accepted. 3 have no plate** (2 rejected by the plate gate, 1 never painted). 0 meshes rejected.
RunPod: **$0.97 measured** (balance $72.8214 -> $71.8493 once settled; the SPENT line in spend.log read $0.92 twenty seconds after the delete), one RTX 4090 for 1.29 h, pod `5522r28kptja18` deleted and verified
(GET 404, pod list empty). 75 mesh runs, median 18 to 22 s each (mean 23 s), model load 178 to 187 s per wave, seven waves,
no worker failure. No fal. Manifest: `catalog/runs/crypt-01/manifest.tsv` (73 rows). Per mesh: `qa/<sku>.json` (measurements),
`.sheet.jpg` (four views), `.verdict.json` (blind Gemini read + match), `qa/summary.tsv`. Twins and niches: `qa-extra/`.

## Not shipped (3)

| piece | why |
|---|---|
| `tomb-slab` | plate gate rejected both plates: a base slab / foundation painted under the grave slab. No mesh made. |
| `skull-pile--s2` | plate gate rejected both plates: a 3 x 4 grid of skulls with posts, not a stepped stack. No mesh made. |
| `rite-bone-candelabra` | never painted: Codex answered "Selected model is at capacity" twice. Not a reject of the design: one `gen.py crypt --ids rite-bone-candelabra` and one mesh in the next pod session would finish it. It is a fire piece for the bench. |

## Re-rolled (2), both accepted on the second try

- **`wall-straight--crypt-stone` (new plate).** The first mesh was square: 9.0 x 9.0 ft, width:height 1.01 against the
  catalog's 0.56. The plate gate had passed it. Because this plate is the parent of all eight sibling wall panels, the prompt
  was strengthened (ten courses of two or three blocks; "TALL, NARROW ... almost TWICE as tall as it is wide ... must NOT be
  square") in `build_spec.py` and `assets.json`, and the plate was painted again before the queue reached `sib1`. New mask
  box 0.43 wide:tall, mesh width:height 0.48, depth 0.11 of the height, no hole. First try kept in `try1/`.
- **`ossuary-wall--crypt-stone--s2` (new seed).** The first mesh punched the arched urn niche right through the wall: a hole
  36% x 30% of the face (4.7% by area) in a panel that must be solid. Second seed: largest hole 3% x 7%, 95% filled.
  First mesh in `try1/`.

## Accepted (73)

Wall kit (9): `wall-straight--crypt-stone`, `--s2`, `wall-doorway--crypt-stone`, `wall-crypt-niches--crypt-stone`, `--s2`, `--s3`,
`ossuary-wall--crypt-stone`, `--s2`, `tomb-door-sealed--crypt-stone`. Doors (2): `crypt-gate-iron`, `door-crypt--leaf`.
Open twins (3): `sarcophagus-open--s1`, `sarcophagus-open--s1--lidoff`, `coffin-open--s1`.
Props (59): `altar-stone`, `bench-stone--s1`, `--s2`, `bones-pile`, `brazier-standing--crypt`, `burial-urn-niche`, `candle-drippings-mound`,
`casket-ornate`, `catacomb-shelf-bones--s1`, `--s2`, `censer-hanging`, `charnel-trough`, `chest-treasure`, `coffin--s1`, `--s2`,
`coffin-maker-stack`, `coin-pile`, `effigy-knight`, `embalming-table`, `linen-wrappings-basket`, `monument-urn-draped`, `natron-tub`,
`ossuary-pillar`, `ossuary-shrine`, `pedestal-display`, `reliquary`, `reliquary-hand`, `reliquary-shrine`, `rite-burial-shroud-folded`,
`rite-canopic-jar--s1`, `--s2`, `rite-canopic-jars-set`, `rite-corpse-on-slab`, `rite-death-mask`, `rite-embalming-tools`,
`rite-funeral-bier`, `rite-funeral-pall`, `rite-grave-goods-pile`, `rite-memorial-plaque--s1`, `--s2`, `rite-memorial-sand-tray`,
`rite-mummified-remains`, `rite-offering-candles-tray`, `rite-pillar-candle-tall--s1`, `--s2`, `rite-relic-bone-fragment`,
`rite-sacred-flame-bowl`, `rite-sanctuary-lamp`, `sarcophagus--s1`, `--s2`, `--s3`, `skull-candle`, `skull-pile--s1`, `skull-single`,
`statue-weeping-angel`, `stone-coffin-lidless`, `urn-ashes-small`, `urn-decorative--s1`, `--s2`.

Every one: no floating piece (0 in all 73), no base-slab flag, 46,600 to 49,900 faces. Flat underside on all but six: the four
hung pieces (`censer-hanging`, `rite-sanctuary-lamp`, `rite-death-mask`, `rite-memorial-plaque--s2`: not floor pieces), the lid-off
sarcophagus (false alarm, see twins) and `rite-mummified-remains` (a wrapped body lying on its rounded back: it touches the floor
over the middle third of its footprint, not a flat face; a note for the tuner, not a defect).

## Unpainted surface (share of the visible surface; over 25% would re-roll)

The feared failure on big plain stone did not happen. Highest in the batch: `wall-crypt-niches--crypt-stone--s3` 6.1% (the
niche backs). Everything else is under 1%.

| piece | unpainted | piece | unpainted |
|---|---|---|---|
| all nine wall panels | 0.0% (s3 niches 6.1%) | `sarcophagus--s1` / `--s2` / `--s3` | 0.0 / 0.1 / 0.0% |
| `altar-stone` | 0.0% | `sarcophagus-open--s1` / `--lidoff` | 0.0 / 0.0% |
| `embalming-table` | 0.0% | `effigy-knight` | 0.1% |
| `monument-urn-draped` | 0.0% | `stone-coffin-lidless` | 0.0% |
| `statue-weeping-angel` | 0.0% | `bench-stone--s1` / `--s2` | 0.0 / 0.0% |
| `ossuary-pillar` | 0.0% | `catacomb-shelf-bones--s1` / `--s2` | 0.0 / 0.0% |
| `ossuary-shrine` | 0.0% | `charnel-trough` | 0.2% |
| `coffin--s1` | 0.4% (13.6% counting the hidden underside) | `skull-pile--s1` | 0.7% |

## Wall kit (kit rule set: width:height within 25% of the catalog, depth, holes, doorway opening)

| panel | width:height (catalog 0.56) | depth:height | holes / opening | box in the manifest |
|---|---|---|---|---|
| `wall-straight--crypt-stone` | 0.48 | 0.11 | none | 60x12x108 |
| `wall-straight--crypt-stone--s2` | 0.48 | 0.11 | none | 60x12x108 |
| `wall-doorway--crypt-stone` | 0.64 | 0.10 | opening from the floor, 47% of the width x 67% of the height | 60x12x108 |
| `wall-crypt-niches--crypt-stone` | 0.57 | 0.14 | none; three real recesses (27% of the face deeper than half the thickness) | 60x18x108 |
| `wall-crypt-niches--crypt-stone--s2` | 0.54 | 0.14 | hairline slit 1% tall; recesses real (15%), bodies fill the rest | 60x18x108 |
| `wall-crypt-niches--crypt-stone--s3` | 0.51 | 0.11 | hairline slit 1% tall; niches nearly flush (7% recessed) | 60x16x108 |
| `ossuary-wall--crypt-stone` | 0.49 | 0.11 | none; skulls are relief, no recess | 60x16x108 |
| `ossuary-wall--crypt-stone--s2` | 0.49 | 0.17 | none after the re-mesh | 60x18x108 |
| `tomb-door-sealed--crypt-stone` | 0.56 | 0.12 | none | 60x12x108 |

Kit pieces are stretched per axis to their box, so the boxes follow the meshes within 1.5x (`manifest_overrides.json`):
niche panels ship 16 to 18 in deep, not the catalog's 24, and `ossuary-wall` 16, because the meshes came out 12 to 15 in deep.

**For the integration agent:**
- **The doorway opening is narrow.** At the 60 x 108 box it is about 28 in wide x 72 in tall (the spec asked for 42 x 84).
  It passes the kit rule (35% x 50%, the same as the log-cabin doorway at 50%) but the 40-in door leaf will overlap the jambs.
- **`crypt-gate-iron` and `door-crypt--leaf` are borderline on the kit proportion rule**: width:height 0.67 against 0.53
  (26% off) and 0.60 against 0.48 (25% off), measured with hinges and ring handles included. They are also 13 in deep with
  their fittings. Accepted with boxes 48x9x90 and 40x9x84 (width squeezed to 0.8, depth to 0.68): inside the 1.5x box rule,
  and an arched leaf squeezed a fifth narrower is not visible at table distance. If the squeeze shows on the bench, these
  two are the ones to re-plate.
- `wall-crypt-niches--crypt-stone--s3` reads as bones in relief, not as deep niches.

## Open twins (all three hollow, all three match their closed mesh)

Measured (`tools/qa_twin.py`, `qa-extra/twins.json`): share of the inner footprint whose top surface is below half the height.
Gemini, blind, was shown both sheets without being told they were related (`qa-extra/twinlook-*.json`); as a control it
called `sarcophagus--s1` against `sarcophagus--s3` "different design", confidence 1.0.

| twin | hollow | size at auto scale, open against closed (in) | Gemini |
|---|---|---|---|
| `sarcophagus-open--s1` | 23% of the interior below half height (closed: 0%); cavity floor at about 15% of the height | 69 x 88 x 45 against 41 x 88 x 47 | same object, lid slid aside, empty hollow, 1.0 |
| `sarcophagus-open--s1--lidoff` | 65% | 69 x 88 x 41 against 41 x 88 x 47 | same object, lid leaning on the side, empty hollow, 1.0 |
| `coffin-open--s1` | 18% (closed: 1%) | 40 x 76 x 18.5 against 31 x 76 x 17 | same coffin, lid askew, empty hollow, 0.99 |

TRELLIS made the cavities; the Hunyuan multi-view route and fal were not needed. Both open sarcophagi are 69 in wide with the
lid, where the catalog line says 52: they ship at the catalog size by largest dimension (88 in long), so body length matches
the closed one. The `lidoff` "leaning" flag from the measurement is a false alarm: the body and the lid both stand on the
floor (checked with an underside map); the gap between them is what the rule saw.

## Notes that are not verdicts

- **Palette.** `sarcophagus--s1` and its two twins read as "weathered beige / tan sandstone", `sarcophagus--s3` as
  "olive-brown", `effigy-knight` as "slate-grey and purple". The walls are dark grey as specified. The tombs are lighter
  than the walls; that may be wanted (they stand out) but it is not the slate grey of the prompt.
- **Names Gemini gave that differ from the catalog:** `casket-ornate` "treasure chest", `reliquary` "jewelry box",
  `rite-death-mask` "medallion", `rite-memorial-plaque--s2` "shield", `rite-relic-bone-fragment` "relic display pillow",
  `rite-embalming-tools` "tool kit", `rite-memorial-sand-tray` "candle stand", `rite-sacred-flame-bowl` "brazier",
  `effigy-knight` "sarcophagus with knight effigy", `stone-coffin-lidless` "open stone sarcophagus with mummy".
- **Smalls that do not read at table distance** (under about 1 ft, confidence 0.3 to 0.7): `urn-ashes-small`,
  `rite-canopic-jar--s1`, `--s2`, `rite-relic-bone-fragment`, `rite-embalming-tools`, `rite-death-mask`, `skull-single`,
  `skull-candle`, `reliquary-hand`, `candle-drippings-mound`. Expected for shelf dressing; all read correctly close up.
- **Hung pieces rendered on the floor:** `rite-sanctuary-lamp` ("floats in mid-air without a chain") and `censer-hanging`
  are ceiling pieces; `rite-death-mask` and `rite-memorial-plaque--s2` "balance on a rim / on the pointed tip": wall pieces.
- `burial-urn-niche`: "irregular tabs protrude from the bottom of the rear wall" (close-up).
- `wall-crypt-niches--crypt-stone`: "horizontal slit through the upper rear masonry" on the back face (measured 1% x 1%).
- **Bigger or taller than the catalog line at auto scale** (they ship at the catalog's largest dimension):
  `rite-funeral-pall` 3.6 ft tall against 26 in (a coffin on a bier under the pall: the catalog height looks wrong, not
  the mesh), `coffin-maker-stack` 3.2 x 6.5 x 4.7 ft against 24 x 78 x 36 in, `rite-pillar-candle-tall--s1` 15 to 18 in
  wide at 4 ft tall (a wide stand), `rite-sacred-flame-bowl` 3 ft across against 2 ft, `bench-stone--s2` 2.5 ft tall
  (scroll arm-rests), `skull-candle` nearly as wide as tall, `chest-treasure` 2.8 ft tall with the lid open.
- Bases Gemini mentioned are part of the design, not added slabs (no slab flag): the angel's stepped plinth, the urn's
  square plinth, the reliquary shrine's altar pedestal, the canopic set's tray.

## Alignment Bench list (accepted pieces)

- **Fire (9 of the 10 specified lights; all painted unlit):** `rite-pillar-candle-tall--s1`, `rite-pillar-candle-tall--s2`,
  `rite-memorial-sand-tray`, `candle-drippings-mound`, `skull-candle`, `rite-offering-candles-tray` (candles);
  `brazier-standing--crypt`, `rite-sacred-flame-bowl` (brazier); `rite-sanctuary-lamp` (lantern, ceiling-hung).
  Missing: `rite-bone-candelabra` (no plate yet). `ossuary-shrine` carries five painted unlit candles and is NOT flagged
  as a light.
- **Water:** none in this type.
- **Hinge:** `crypt-gate-iron`, `door-crypt--leaf`; pair alignment with the closed mesh for `sarcophagus-open--s1`,
  `sarcophagus-open--s1--lidoff` (both against `sarcophagus--s1`) and `coffin-open--s1` (against `coffin--s1`).
- **Hung (for `HUNG_IDS` / mount heights, not a bench effect):** wall: `burial-urn-niche` (16 in deep, will not be caught
  by size), `rite-death-mask`, `rite-memorial-plaque--s1`, `--s2`; ceiling: `censer-hanging`, `rite-sanctuary-lamp`.

Orientation was not touched. Several long pieces came out along the other floor axis than their catalog line
(`effigy-knight`, `sarcophagus--s1`, `embalming-table`, `stone-coffin-lidless`, `rite-corpse-on-slab`, half the wall panels).

## Late addition (second mesh agent, 2026-10-05 21:59)

`rite-bone-candelabra`: plate arrived at 21:21, meshed in the castle/mansion pod session, **accepted**: 0 floating pieces, 0.0%
unpainted, Gemini blind "candelabra". Appended to `catalog/runs/crypt-01/manifest.tsv` (now 74 rows; `light:candle`, bench fire).
The crypt is now 74 accepted of 76; `tomb-slab` and `skull-pile--s2` still have no plate.
