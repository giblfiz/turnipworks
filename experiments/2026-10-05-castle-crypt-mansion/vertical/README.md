# Vertical kit: stairs, overhang supports, roof furniture (2026-10-05)

SPEC ONLY. Nothing generated, nothing spent, no engine code. For the storeys and roofs work described in `docs/VERTICAL.md`.

    python3 build_spec.py      # -> assets.json (45 meshes, the yard's format), kit.json, prompts/*.spec.md

- `assets.json`: 45 new meshes. `kit.json`: what each piece is for, its cells, where it anchors, which are connectors, and the verdicts on the existing library pieces. `flats.json`: four roof-surface textures. Catalog: `catalog/objects-vertical.catalog.md` (20 new roles; `catalog_tool.py` clean, no P1 orphans).
- No rooms, so no `rooms.json` and no recipe file. All new roles are P2/P3 in the catalog because no room recipe asks for them (the building generator places them); the `prio` in `assets.json` is the build order.

## The one decision: a straight flight is 1x2 cells (10 ft of run), not 1x3

A storey is 120 in floor to floor. Every stair cell in this kit rises exactly 60 in, one step of the world's 5-ft height lattice.

- A 1x2 flight is two 5-ft cubes. The half flight Harry asked for (dais, stage) is literally half of it, and the L stair and a dog-leg are the same half flights plus a 5-ft landing. One module.
- At 1x3 a cell rises 3.33 ft (on no lattice) and the half flight is 1.5 cells long.
- Rooms are 4 to 6 cells across; three cells of stair plus a floor cell at each end is most of a wall.
- Ten 12-in steps read as steps from above and survive image-to-3D; fifteen 8-in steps blur toward a ramp.
- Cost: a 45-degree pitch (a house stair is 35 to 38). Fine at table distance. The stair that is looked at, `stair-grand`, takes 3 cells of run at 8-in risers.

## Pieces (45)

| group | pieces |
|---|---|
| Stairs (14) | `stair-straight--…--t10` stone, timber (10 steps, 48x120x120) · `stair-half` stone, timber (5 steps, 1 cell) · `stair-landing--…--t10` stone (solid), timber (open, on posts), 60 in high · `stair-quarter-turn` stone, timber (L, 2x2) · `stair-spiral-wide` stone, timber (2x2, one full turn so copies stack) · `stair-wall-hugging--dressed-stone` (castle) · `stair-grand--noble-interior` (2x3, runner, balustrades) · `ladder-wood--leaning`, `--upright` |
| Overhang (7) | `jetty-bracket--s1` (curved brace), `--s2` (carved console) · `post-timber--plain` · `buttress--s1` (stepped), `--s2` (raking) · `corbel-stone--s1`, `--s2` |
| Roof (24) | `roof-dormer` tile, thatch, slate, shingle · `chimney-stack` brick, stone, mansion (3 pots), cottage · `parapet-straight` + `parapet-corner` · `wall-crenellated` + `wall-crenellated-corner` · `roof-ridge` thatch, tile, lead · `roof-finial--s1`, `--s2` · `weathervane--banner` · `roof-skylight--lead` · `roof-hatch--wood` + `roof-hatch-open--wood` · `gargoyle-spout--s1`, `--plain` · `nest-bird--s1` |

Counts: prio 1 = 16, prio 2 = 19, prio 3 = 10. Groups: p1 10, sib1 6, p2 14, sib2 5, p3 10.
Prio 1 is over a quarter on purpose: connectors are the part the storeys work cannot start without.
Three `sib2` pieces (`stair-quarter-turn` x2, `stair-wall-hugging`) are painted from a prio-1 parent (the straight flight), so run them after `p1` is accepted.

Wall-hung (`hung: true`): `ladder-wood--upright`, both jetty brackets, both corbels, both spouts. Lights: none. Open twin: `roof-hatch-open--wood` of `roof-hatch--wood`.

Flats (4): `roofing-thatch`, `roofing-tile-clay`, `roofing-slate`, `roofing-shingle-wood`. The `roofing-` prefix because `roof-thatch` and `roof-shingle-wood` are already mesh roles. Courses along image X, eaves at image bottom; never laid in the floor's rotate mode. See `flats.json`.

## Existing library pieces (ratings from reviews/latest.json, bounds from library.json)

| piece | verdict |
|---|---|
| `stair-straight` (both, 3 stars) | superseded: measure 84 and 94 in of rise, 61 and 77 in wide. New meshes are separate `--t10` skus; the old ones stay for today's inn rooms |
| `stair-landing` (both, 3 stars) | superseded for storeys: about 35 in high; new `--t10` skus |
| `stair-exterior-wood` (both, 3 stars) | usable: rise about equals run; rescale to 120 in of rise |
| `ladder-wood` (plate 1 star, "jumbo rung") | superseded |
| `floor-trapdoor` (both, 3 stars) | usable; measures 18 to 23 in high, look before laying flush |
| `roof-dormer` (both, 3 stars) | usable as fallback; superseded on generated roofs by the four material-matched dormers |
| `roof-shingle-wood` (both, "is a whole roof") | superseded as a segment; keep as a ready-made 1-cell shed roof |
| `balcony-wood` (timber 3 stars; stone unrated, "isn't bad") | usable, as an exterior piece at upper-floor level |
| `railing-wood` (both, 3 stars) | check: measures 30 to 45 in deep, not a thin edge rail |
| `gallery-interior` (both unrated, "what is this?") | not usable; a gallery is a slab + posts + rail, no mesh |
| `porch-covered` (both, 3 stars) | usable for now; later a lean-to roof plane on two posts |
| `post-timber` (3 stars) | usable indoors (has arms: 67 in wide); `post-timber--plain` added |

## Risks

- **Proportion.** The generator ignores stated sizes, and the library scales uniformly by the largest dimension. A stair that comes back 8% squat does not meet the upper floor. Stairs, landings, parapets, battlements and ridges carry `"fit": "box"`: the manifest step stretches them per axis to the spec size (as the yard's KIT_BOX did).
- **Spirals** (both): the hardest shapes here. Expect a miscounted or merged helix. Fallback: hunyuan-mv, or build the spiral in code from one generated wedge step.
- **`stair-grand`**: balusters. The prompt asks for fat ones thicker than the gaps; if they still break, regenerate with solid panelled sides.
- **`stair-landing--rough-timber`**: open underside between four posts; may fill in solid (acceptable).
- **Ladders**: thin by nature; specified with 4-in poles and 3-in rungs. The gate rejects a "jumbo rung".
- **Big plain stone** (straight stone flight, buttresses, battlement): may come back partly unpainted; prompts ask for coursed blocks and carved recesses on every face.
- **`weathervane--banner`**: the thinnest object; no letters, no rooster.
- **`gargoyle-spout--s1`**: a carving of a creature. The brief bars creatures; the prompt says stone carving, one grey family, wings in relief. `--plain` is the creature-free fallback.
- **Dormers and chimneys** are sunk into a sloping plane rather than cut to pitch; a patch of main roof painted under them would break that, so the gates reject it.
- **Glass and slate vs the blue key**: panes and slates are specified grey-green and charcoal.

## Bench items

- `roof-hatch--wood` / `roof-hatch-open--wood`: hinge (align the open twin so the curb does not jump).

## Settled (2026-10-05, integration)

- 1x2 run accepted.
- No new mesh reuses an existing sku id: the four that clashed are `stair-straight--dressed-stone--t10`, `stair-straight--rough-timber--t10`, `stair-landing--dressed-stone--t10`, `stair-landing--rough-timber--t10` (t10 = ten-foot storey).
- Core catalog stair sizes stay as they are; `kit.json` → `catalog_lines_to_correct` is the note.
- `wall-crenellated` is specified here, not by the castle designer.
- Still open: ridges on slate and shingle roofs (mesh `roof-ridge--lead` or a code-made strip).
