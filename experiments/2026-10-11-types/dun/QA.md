# dun-01 (Dungeon & prison): QA, 2026-10-11

**75 of 75 specs plated, 75 meshed, 75 accepted, 0 rejected.** Manifest: `catalog/runs/dun-01/manifest.tsv` (75 rows).
Per-mesh evidence: `qa/<sku>.json` (measurements), `qa/<sku>.sheet.jpg` (four tiles), `qa/<sku>.verdict.json` (rules + blind
Gemini read + match), `qa/summary.tsv`, `qa/overrides.json` (two supervisor accepts), `qa-extra/` (yaw, see-through).
Judged at TABLE SCALE (background props from 40 to 100 ft); measurement beats Gemini.

## Run
| | |
|---|---|
| plates | 75 accepted from 88 Codex images (free route). Plate-gate re-rolls: trap-dart-wall, orb-socket-pedestal, carcass-ribcage, chest-treasure-open, coin-pile--s2, shoring-timber, crate-floating, trap-bear (one each); wall-doorway--cut-rock (rejected twice as "a trilithon", prompt and gate text strengthened, then accepted); sewer-grate re-plated once after QA |
| Codex quota | STOP 19:02:16 ("You've hit your usage limit ... try again at Oct 17th") with 65 plated; probe at 19:17 still stopped; allowance restored by Harry, probe at 19:32 painted, all 75 plated by 19:44 |
| local GPU | two wall siblings failed on the build box's own card (BiRefNet CUDA out of memory: four sibling agents matte on the same 12 GB): `tools/gen.py` now retries the matte 10 x 20 s |
| meshes | 78 TRELLIS.2 runs in 3 waves (32, 35, 11) on an A100 80 GB (the RTX 4090 was not offered in EUR-IS-1), one resident worker; mesh median 14 to 15 s; model load 471 s, 487 s, 712 s (the network volume is shared with the siblings' pods); 0 worker failures |
| dollars | pod `fl976cswq51g8k` 18:32:57 to 19:31:17 = 0.972 h x $1.79 = **$1.74**; pod `r180fy9fuhs7uv` 19:45:22 to 20:10:04 = 0.412 h x $1.79 = **$0.74**; total **$2.48**, computed from OUR pods' uptime x rate (the account balance is shared with four sibling pods, so its difference is not ours). Both pods deleted, GET pod = 404, no pod named `tw-dun` left (`spend.log`) |

## Re-rolls and what was done about each flag
| sku | flag | outcome |
|---|---|---|
| sewer-grate | meshes 1 and 2 (seeds 42, 396519) both a four-way CROSS of arches, 3.7 x 3.6 ft on the floor | one re-mesh, then one re-plate ("one thin flat slab, a single arch in a single plane, seen almost square-on"): mesh 3 is 44 x 8 x 39 in, **accepted**. First plate and mesh kept in `models-rejected/` |
| carcass-ribcage | footprint 7.5 x 7.0 ft against 7.5 x 4.2 (both seeds) | not a bad mesh: it lay DIAGONALLY (43 degrees) in its box. Turned (see below), footprint 47 x 90 in: **accepted** |
| bridge-plank-rickety | footprint 14.2 x 14.0 ft | diagonal, 37 degrees. Turned: **accepted** |
| web-cocoon--s2 | footprint 5.0 x 4.8 ft | diagonal, 41 degrees. Turned: **accepted** |
| obelisk-rune | Gemini: "runes are glowing orange-gold" (a must-not) | **accepted by override.** Sound mesh, reads as a runic obelisk (0.95). The runes are PAINTED bright gold; nothing is emissive. Not a table-scale failure |
| crate-floating | Gemini: "a visible water / puddle base" | **accepted by override.** That flat green patch is the scum ring the design asks for; the piece sits on the water plane |

**Diagonal meshes (new finding, new tools).** A long piece painted in three-quarter view can come back turned about 40 degrees
about the vertical axis, so its axis-aligned box is nearly square. `tools/qa_yaw.py` finds it (minimum-area rectangle of the
footprint against the box); `tools/glb_yaw.py` turns positions and normals inside the GLB (UVs, indices, textures untouched;
the harvested file is kept in `models-asmeshed/`, the turned one also in `models-turned/` because `harvest.sh` would overwrite it).
Turned to square up: bridge-plank-rickety (-37), carcass-ribcage (-43 then +90), web-cocoon--s2 (41 then +90). Given a quarter
turn only so that width / depth match the spec: ball-and-chain, bridge-stone-slab, column-drums-fallen, door-rune-sealed--leaf,
lever-floor, shoring-timber. `gibbet-cage` (eight-sided) and `trap-crossbow` (a cross of bow and stock) show up in the yaw list
for their shape, not for lying askew.

## Wall kit `cut-rock` (kit rule set; catalog 60 x 12 x 108, width:height 0.56)
The parent plate's mask box was measured BEFORE any sibling ran: 0.48 wide:tall. All four plates 0.48.
| panel | mesh width:height | depth:height | holes / opening | box in the manifest |
|---|---|---|---|---|
| wall-straight--cut-rock | 0.53 | 0.21 (23 in) | none, 100% filled | 60x12x108 |
| wall-straight--cut-rock--s2 | 0.53 | 0.19 (21 in) | none, 98% filled | 60x12x108 |
| wall-straight--cut-rock--s3 | 0.55 | 0.15 (16 in) | none through; torch nook on ONE face | 60x12x108 |
| wall-doorway--cut-rock | 0.55 | 0.16 (18 in) | opening from the floor, 60% of the width x 76% of the height (36 in x 82 in), centred | 60x12x108 |

None came out square. The plain panels are about twice as deep as the kit's 12 in (rough rock relief), inside the wall rule
(depth at most 0.25 of the height). They are left at 60x12x108 because corners and doorways assume 12 in: the depth is
squeezed up to 1.9x, which flattens the chisel relief and nothing else. If that looks pressed in the engine, 60x16x108 is
the box inside the 1.5x rule (`tools/kit_boxes.py` proposes 17 and 15 for the first two). Gemini reads the doorway as
"post and lintel facets rather than raw rock" close up; at table distance an open stone portal.

## Door leaves (boxes by `tools/kit_boxes.py`: thin axis within 1.45x of the mesh)
| leaf | mesh at auto scale (in) | box in the manifest | note |
|---|---|---|---|
| door-cell-bars--leaf | 50 x 9 x 84 | 40x7x84 | width squeezed to 0.8 |
| door-rune-sealed--leaf | 51 x 20 x 90 | 44x14x90 | a thick monolith; quarter-turned to face like the others |
| door-face-carved--leaf | 48 x 24 x 90 | 44x17x90 | the carved face stands 2 ft proud on the mesh; the back is plain ashlar |

## Thin-part pieces (measured: `tools/qa_seethrough.py`, surface samples projected on the broad face; `qa-extra/seethrough.json`)
| sku | finding |
|---|---|
| door-cell-bars--leaf | **A real mesh, no flat card needed (first mesh).** Frame, six round bars (five asked), two straps, lock box; 72% of the face solid; 6 to 7 separate solid runs across a scan line at 50% and 80% height, clear gaps between every bar |
| gibbet-cage | open cage: 51% of the side view solid, 4 separate straps on every scan line, three hoops, domed top with ring, feet. Eight-sided |
| sewer-grate | third mesh: one flat arch 44 x 8 x 39 in, four bars in front of a dark flat backing (89% solid: it is NOT see-through, by design, so that fused bars would still read) |
| trap-spikes | 4 x 4 grid, sixteen separate fat cones on the plate (Gemini counts them); 56 x 56 x 17 in |
| trap-blade | open gantry: two posts, beam, hanging arm and crescent blade clear of the posts (3 solid runs at every height); 80 x 20 x 96 in |
| skeleton-chained | one mass on its slab and step seat, both wrists chained; 27 x 28 x 66 in (the legs and step make it twice as deep as designed: own size) |
| carcass-ribcage | one closed mass (hide fills the top; side view 64% solid, ribs open only low down); horned skull at one end |
| shoring-timber | open frame, walk-through (43% solid); came out 95 in wide, not 60: own size 95x29x100 |

No floating pieces over 1% and no visible unpainted surface over 8% on any accepted mesh (rule: 25%).

## Own sizes (32 skus, `manifest_overrides.json`, written by `own_sizes.py`)
Kit boxes for the three leaves; and for every prop whose mesh proportions are more than 1.35x off its design box, the
mesh's own box at the QA auto scale (so nothing is stretched). The larger differences from DESIGN.md:
shoring-timber 95x29x100 (60x20x100), trap-dart-wall 68x25x84 (56x10x84), skeleton-chained 27x28x66 (26x14x66),
sewer-pipe-mouth 54x49x60 (60x30x56), lever-floor 22x40x39 (16x22x40: the lever is thrown along its length),
web-cocoon 39x39x66 (26x26x66: the web clump), statue-rotating 43x44x78 and --s2 44x44x78 (32x32x78: the turntable plinth),
pillar-flooded 43x43x100 (30x30x100), puzzle-dial-pillar 34x34x60 (24x24x60), stalagmite 49x46x54 (34x34x54),
mushroom-cave-giant 48x47x45, trap-crossbow 33x34x23 (26x34x34: low), ball-and-chain 20x7x7, collapse-rubble 95x110x87
(110x70x80: deeper than wide), collapse-rubble--s2 60x59x41, bed-cell-stone 32x72x27, armor-chainmail-heap 17x26x13,
trap-bear 30x28x5, web-cocoon--s2 60x21x14, column-drums-fallen 39x100x22, pressure plates 30x30x6.

## Ids that differ from DESIGN.md
- `treasure-hoard` -> role and sku **`dun-treasure-hoard`** (`treasure-hoard` is a render SET in `catalog/sets.md`; catalog_tool refuses the collision).
- `gibbet-cage` (sku unchanged) is under the NEW role `gibbet-cage-standing`; `cage-hanging` is untouched.
- `offering-bowl`: the role already existed (surface, tiny, 10 in); this sku uses it at its own size 16x16x8, no new line.
- Role of the sku where DESIGN.md gave one: trap-bear -> `bear-trap`, bridge-stone-slab -> `bridge-stone-natural`,
  bridge-plank-rickety -> `plank-bridge`, stepping-pillar -> `stepping-pillars`, chasm-post-pair -> `bridge-post-rope`
  (ONE post), sewer-pipe-mouth -> `sewer-outflow`, sluice-wheel -> `sewer-sluice-gate`, crate-floating -> `flotsam-crate`,
  pillar-flooded -> `pillar-waterline`, fountain-skull -> `fountain-wall-skull`.
- No clash with the sibling worktrees' new role ids (clt, mkt, tem, wizard: catalog diffs checked before plating; none had an assets.json then).

## For the integration
- Painted lying down, long axis = depth after the turns: adventurer-remains (34x70), bridge-stone-slab (60x170),
  bridge-plank-rickety (40x170), column-drums-fallen (39x100), carcass-ribcage (50x90), ceiling-slab-fallen (68x90). web-cocoon--s2 is long in WIDTH (60x21).
- `chest-treasure-open` is an EDIT of the crypt's accepted `chest-treasure` plate, which is itself already open and full: the
  twin differs by the lid thrown right back, the overflow and a crown. `tools/qa_twin.py` was not run (the closed mesh is not in this folder).
- `obelisk-rune` looks lit already (gold runes). `crate-floating` and `pillar-flooded` want the water plane's height (BENCH-candidates.md).
- `adventurer-remains`, `adventurer-remains--s2`, `rubble-pile--s2`, `sewer-pipe-mouth`, `trap-bear` carry the measurement's
  "middle not over what touches the floor" note (the README warns it fires on low, uneven pieces): Gemini's blind read lists no leaning or floating defect on any of them.
- The catalog tool lists eleven new P1 roles as orphans until the room recipes name them.
- `catalog/out/*` was regenerated by `catalog_tool.py` and restored (not committed): the siblings regenerate the same files; run the tool once after the merge.
