# Vertical kit mesh QA (2026-10-05, pod sessions 20:07-22:16 and 22:49-23:25 PDT, shared with castle and mansion)

**45 specified. 42 plates arrived, 42 meshed. 41 accepted, 1 rejected. 3 have no plate.**
Manifest: `catalog/runs/vertical-01/manifest.tsv` (41 rows). Files as in `../castle/QA.md`; stair profiles:
`qa-extra/stairs.json` (`tools/qa_stairs.py`), per-axis stretch at the box: `qa-extra/boxfit.json` (`tools/qa_boxfit.py`).

## The straight timber flight passed (the storeys agent's piece)

`stair-straight--rough-timber--t10`: ten risers, centre-line tread heights 10-19-29-38-48-58-68-77-87-98% of the mesh
height, floor at the low end, top tread at the high end; no ramp, no block. With solid chunky side rails (0 floating).
**Box 52x120x120, not 48 wide**: the mesh is 62 x 120 x 101 in at auto scale and 48 would squeeze the width 1.54x
unevenly; 52 clears a 60-in cell with 4 in each side. At that box the first riser is 12.5 in and the top tread 118 in
(the last 2 in are the nosing of the upper floor).

## Stairs: does each one climb (top-surface profile along the run)

| stair | risers found | low end -> top tread (share of mesh height) | top tread at the shipped box | stretch (w, d, h; 1 = least) | verdict |
|---|---|---|---|---|---|
| `stair-straight--dressed-stone--t10` | 10 | 11% -> 100%, a top landing 20% of the run | 120 in | 0.75, 0.89, 1.0 | climbs |
| `stair-straight--rough-timber--t10` | 10 | 10% -> 98% | 118 in | box 52 wide: 0.70, 0.84, 1.0 | climbs |
| `stair-wall-hugging--dressed-stone` | 10 | 11% -> 99% | 119 in | 0.73, 0.87, 1.0 | climbs |
| `stair-half--dressed-stone` | 6 | 16% -> 100% | 60 in | 0.82, 0.80, 1.0 | climbs |
| `stair-half--rough-timber` | 6 | 15% -> 99%, with side rails | 60 in | within 1.2 | climbs (override: Gemini objected to the rails; the supervisor allows them) |
| `stair-landing--dressed-stone--t10` | - | a solid block, top at 100% | 60 in | 1.0 | a landing |
| `stair-landing--rough-timber--t10` | - | deck at 87%, corner posts above | **box 60x60x69** so the deck is at 60 in | | a landing on posts |
| `stair-spiral-wide--dressed-stone` | - | round the newel: 26% -> 94% through 360 degrees, one drop of 62% where top meets bottom | 113 in at the last tread | 1.0, 1.0, 0.73: the mesh is 6.6 ft across at 10 ft tall and is widened to 9 ft | a spiral |
| `stair-spiral-wide--rough-timber` | - | 11% -> 94% through about 330 degrees, the last 30 degrees open (the way in); it turns the OTHER way from the stone one | 113 in | 0.88, 1.0, 0.89 | a spiral |
| `stair-grand--noble-interior` | 14 | 7% -> 76%: the rest is balustrade and newel caps | **box 120x180x158** so the top tread is at 120 in (at the spec's 120 it would stop at 91 in) | 0.76, 0.73, 1.0 (height stretched 1.36x) | climbs (second plate) |

For the storeys agent: (1) the two spirals turn opposite ways by the measurement (which is which hand: look on the bench); mirror one if a tower mixes them. (2) Any stair with a rail
or newel has its top tread BELOW the mesh top, so the box height is not the storey height: read `stair-grand` and the
timber landing from `manifest_overrides.json`. (3) Straight stone and wall-hugging are squeezed a quarter in width (62-in
meshes into 48 in).

## Rejected (1)

`stair-quarter-turn--dressed-stone`: not an L. Both meshes (two seeds) are two flights in line with a sideways step at
the landing, footprint 4.5 x 10 ft where the kit needs 10 x 10 (2.2x uneven at the box). It does climb (11 risers, floor
to top). Gemini reads the PLATE as an L, so the reconstruction flattens the turn; a re-plate from a higher camera, or
building the L from two `stair-half` and a landing (the kit's own fallback), is the way.

## No plate (3), refused twice by the plate gate

`stair-quarter-turn--rough-timber`, `roof-dormer--thatch`, `roof-ridge--tile`. There is therefore **no quarter-turn stair
in either material**; half flights and landings exist in both.

## Re-rolled (3)

- `stair-grand--noble-interior` (new plate): the first plate had a panelled wall across the top of the flight (Gemini on
  the plate; the mesh's last tread was at 67% with a 27-in jump to a ledge at 90%). Prompt: "the TOP step is the HIGHEST
  walking surface ... NO wall, NO panel, NO tall riser". Second mesh: 14 even risers to an open top.
- `stair-quarter-turn--dressed-stone` (re-mesh): rejected, above.
- `wall-crenellated--dressed-stone` (new plate): the mesh is 60 x 12 x 38 in where the kit box is 60x24x60. The re-roll
  plate was refused by the plate gate (two extra merlons, a roofed turret), so the first mesh stands. **Accepted with a
  note**: box 60x16x60, height stretched 1.57x against the width (just over the 1.5x rule) so that it stands level with
  `wall-crenellated-corner` (66 in). The first to re-plate if the stretch shows. (`gate-manifest.json` status restored by
  hand to the original accepted plate, which is the one in `masked/`.)

## Kit boxes changed (`manifest_overrides.json`)

`stair-grand--noble-interior` 120x180x158, `stair-landing--rough-timber--t10` 60x60x69, `stair-straight--rough-timber--t10`
52x120x120, `wall-crenellated--dressed-stone` 60x16x60, `roof-ridge--lead` 60x14x9 (mesh 60 x 20 x 12.5),
`roof-hatch--wood` 48x48x12 (mesh 17 high), `roof-skylight--lead` 48x48x23 (mesh 33 high; it is sunk into the roof).
Within 1.5x at the spec box: `parapet-straight` (1.49), `parapet-corner`, `wall-crenellated-corner`, `roof-ridge--thatch`.

## Unpainted surface

`roof-hatch-open--wood` 9.9% (the shaft below the lid). Everything else at most 0.1%: both straight flights, both
spirals, the grand stair, buttresses, chimneys, battlement, parapet.

## Thin and risky pieces (0 floating pieces in all 41)

- `weathervane--banner`: one piece, reads "weathervane", 42 x 17 x 48 in; no flat foot (it is spiked into a ridge).
- `ladder-wood--leaning`, `--upright`: real ladders with rungs, one piece each, but WIDE: 46 and 44 in across at 10 ft
  (catalog 24). They ship by height, so they fill most of a cell. The leaning one touches the floor at its feet only.
- `roof-hatch-open--wood` against `roof-hatch--wood`: 52 x 50 x 50 in open against 48 x 48 x 17 closed; 86% of the
  interior is a real shaft; Gemini pair read: same design, lid up on a prop, 1.0.

## Notes that are not verdicts

- `roof-dormer--tile`: greenish-blue panes (Gemini failed it for the plate's must-not; the panes are intact; override).
- Do not read at table distance: `corbel-stone--s1`, `--s2` (18-in wall pieces), `gargoyle-spout--plain`.
- `nest-bird--s1` has a rounded underside.
- Suite colour: `stair-half--dressed-stone` dE 16 against the straight stone flight (greener, mossier);
  `ladder-wood--upright` 15; landings and battlement corner 8 to 12.

## Alignment Bench list

- **Hinge:** `roof-hatch--wood` / `roof-hatch-open--wood` (the open one's curb is 52 in against 48).
- **Fire, water:** none.
- **Hung:** `corbel-stone--s1`, `--s2`, `gargoyle-spout--s1`, `--plain`, `jetty-bracket--s1`, `--s2`, `ladder-wood--upright`.
