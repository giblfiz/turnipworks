# Meshy vs the default mesh route (lane `meshy`), lab notes

Lane `meshy`, 2026-11-07. Harry: "run a little experiment checking on the pathway through doing an item generation using
Meshy ... for some of our more challenging generations ... the store shelves in the convenience store and the server racks
... compare how Meshy does with those to how we get it on our default, and figure out which things we should spend our
high-priced Meshy tokens on as opposed to just the general stuff." Experiment only: nothing shipped is replaced.

## Setup and access
- 17:20 orient. Meshy key: NOT injected by `secrets-wrapper` (it loads only Gemini/OpenAI/Cloudflare + RunPod). The documented
  route (wiki `projects/image-to-3d-pipeline/meshy-api/`) is "set MESHY_API_KEY from the credential registry" (wiki
  `credentials/`, Meshy.ai block). A scratchpad wrapper exports it for one command and never echoes it; the free
  `GET /openapi/v1/balance` answered 200: 1,795 credits (1,000 monthly + 795 permanent) = the **Pro** plan ($20/month for
  1,000 credits => **$0.02 a credit**; Premium/Ultra would be $0.013/$0.0125).
- Prices (docs.meshy.ai/en/api/pricing, read today): Image-to-3D Meshy 7.1 textured 30 cr (mesh only 20), Smart Topology
  t2/t2.5 textured 15 cr (mesh only 5), remesh 5, retexture 10. API task retention on Pro: 3 days (download at once).
- Licence (experiments/2026-10-21-licence-audit/generator-terms.md row 8b, 88%): paid plan = we own the output; do not strip
  Meshy's AI identifiers; no training competing models. Measured: the GLBs carry NO identifiers (asset.generator
  "pygltflib", no extras, the JPEG colour map has no EXIF/XMP/C2PA), so our Blender prep removes nothing.
- Plates: the cyberpunk-rooms lane's masked plates (local); the sprawl lane's plates were on no machine here, but the
  TRELLIS network volume still had them (`/workspace/tw-runs/sprawl-2026-11-06-sprawl/masked/`) and the wave-1 SOURCE GLBs
  too (`.../models/`: the cyberpunk lane recorded them as "on no machine"). Copied to USB `trellis/*--shipped-src.glb`.
  Same plate, both pipelines; no new images were made (fal empty, Codex image quota out).

## Subjects (6)
store-shelving, server-rack (Harry's two), plus drinks-cooler (glass doors over rows of bottles), pallet-racking (thin
repeated uprights and beams), fence-chain-link (mesh infill), antenna-mast (open lattice): the TRELLIS failure families.

## Runs
- Meshy (tools/meshy_i2m.py; one task per plate per variant, the plate as a data URI):
  - `m7`: Meshy 7.1, should_remesh to 20k triangles, one 2K base-colour map, enable_pbr false, image_enhancement false.
  - `t25`: Smart Topology meshy-t2.5, 10k target, one 2K base-colour map.
  The Express Order trap (texture baked on the high parent, not the remesh) does NOT happen when remesh and texture are
  asked in ONE API task: every result came back at the target (16.5k-20.6k / 8.9k-10.5k triangles) with exactly one
  base-colour map. m7 median 64 s (55-88), t25 median 42 s (29-44). 12 tasks, 270 credits (1,795 -> 1,525) = **$5.40**.
- Default: one RTX 4090 pod (tools/pod_up.sh, 1.5 h timer + dead-man), TRELLIS.2 setup 185 s, model load 152 s, 6
  meshes median 39 s at seed 7311 (the shipped meshes are seed 42 of the same plates). Pod deleted 17:40, verified gone
  through the API (state gone, no pod named tw-meshy): 0.201 h x $0.89 = **$0.18**.
- Prep (tools/prep.sh): all 18 candidates through the SAME runtime prep as the shipped meshes (blender_runtime.py 5,000
  faces / 256-px colour map / matte, blender_lod.py f1500..full, lod_tex.py t64..t2048), as NEW skus `<subject>--tr2`,
  `--mx7`, `--mxt` in this worktree only.
- In game (tools/render_game.py, private ports 19787/19788, throwaway campaign): each subject's own room type at a fixed
  seed, every thing of the category swapped (object.replace) to each version, the table view and a closer one; then each
  version alone (three-quarter, other side, table distance). 120 stills, 0 page errors. The game draws f10000 geometry
  and the 256-px colour map (LOOK_DIALS faces 10000, tex 'baked' = 256), so Meshy's 2K maps arrive at 256 like ours.

## Results (RESULTS.md has every number; work/judge.json the raw blind answers)
- Blind name read (A, 24 alone-close stills shuffled, no target): **24 of 24 named right** (90-95). Every route makes a
  recognisable object from these plates: the plate carries identity; the routes differ in QUALITY, not in what it is.
- Scored read (B, per subject 8 stills = 4 versions x alone-close + room-close, target named, versions unnamed):
  means over six subjects, reads / geometry / texture / rank of 8: current 6.9/6.2/5.8/5.7, TRELLIS regen 6.2/5.8/5.2/5.4,
  Meshy 7.1 7.7/7.3/7.0/3.8, **Meshy Smart Topology 7.9/7.7/7.1/3.1**. Per subject the gap is concentrated:
  - store-shelving: current 4.5/3/3 rank 7.5 ("melted sagging shelves, floating fragments, blobby goods"); Meshy ST
    8.5/8/7.5 rank 2.0. server-rack: current 4.5/4.5/3.5 rank 6.5 ("near-black texture, blobby handle, no status
    lights"); Meshy 7.1 8/8/7.5 and ST 7.5/7.5/6.5, both rank 2.5. Both TRELLIS seeds fail the same way: robust.
  - pallet-racking, antenna-mast, chain-link fence: every route 7-9; no gain worth paying for.
  - drinks-cooler: the CURRENT mesh is best (8.5/7.5/7.5); TRELLIS at another seed, Meshy 7.1 and ST all lost the
    glass and the bottles ("monolithic blank panels"). The shipped one was a lucky seed: seed variance on this item is
    as large as any route difference.
- Table distance (C, the whole room at players' distance): NOT informative. The versions differ in 0.1-6.7% of the
  frame's pixels, and Gemini's answers repeat word for word across versions of a subject. At table distance a
  player cannot tell the routes apart; the gain shows when the camera comes close (zoom, first-person walk).
- Measured geometry (tools/geom_metrics.py on the in-game f10000 tier): Meshy ST has the highest axis-aligned surface
  share in 6 of 6 subjects (mean 0.69 vs 0.52-0.56), and it is the only coherent mesh in game: 35-117 pieces, 4-10% open
  edges, 0 non-manifold edges, vs 800-3,300 pieces and 50-70% open edges for TRELLIS (the 50k mesh decimated to 10k)
  and Meshy 7.1 (20k decimated to 10k). ST's ~9.5k triangles sit under the 10k tier, so the game draws it undecimated.
  Files (runtime + f10000 + t256): ST 576-732 KB, current 739-858, Meshy 7.1 904-1,180.
- Cost and time per item: Meshy ST 15 cr = $0.30, median 42 s; Meshy 7.1 30 cr = $0.60, median 64 s; TRELLIS 39 s and
  about $0.01 of pod time per mesh at the margin (this 6-mesh run: $0.18 with 185 s setup + 152 s model load).

## The drop-in (built on the branch, NOT landed: Harry decides)
- Choice: Meshy ST under the shipped skus `store-shelving`, `server-rack` and `server-rack--s2` (the server room mixes
  both racks; s2 meshed too: 15 cr). integration/dropin.json + dropin.py (build | library | undo): the openmesh-01
  precedent, a new mesh under the same sku, `was` keeps the old one, `rev` busts the 4-h colour-map cache; runtime prep
  with "takeover": true, owner = this batch; tools/tool-sweep/sku_guard_allow.json says why. sku_guard OK.
- Room layouts change with it, and only there: golden vs HEAD = 24 differences, exactly the 12 mod-store and 12
  cyb-server scenes. The new shelving is shallower (about 2 ft deep x 4.1 ft tall at 8 ft long; the old mesh was 4.4 ft deep,
  "1.48x off the catalog"; the catalog says 3 ft x 5 ft), so the store at seed 5101 now fits 4 gondolas (was 2) and the
  server room 9 racks (was 8). mod.test 96,104 / 0 and cyb.test 50,412 / 0 with the drop-in.
- Pictures: USB sheets/dropin-before-after.jpg; renders-dropin/.
- Drop-in read (tools/judge_dropin.py, one blind call, before/after pairs in random order, the same rooms and seeds):
  **after wins 4 of 4**. Store at table distance 9/8 (reads/clean) vs 5/4, closer 9/8 vs 5/3 ("four crisp gondola aisles
  with clear navigable lanes" vs "melted models and an unnaturally empty layout"). Server room 8/8 vs 5/6 at both views,
  and a find: the SHIPPED racks stand turned 90 degrees ("rack fronts face walls or adjacent units"; no orient.json
  entry, the box rule turns their 0.42 x 0.69 footprint), while the Meshy ST racks face the aisle. So, unlike call C,
  the in-context pair IS told apart at table distance: the better proportions change the solve (layout and facing),
  not only the surface.
- After the rebase on main 914eb98a: meshy_dropin.test 15/0; golden still exactly the 24 mod-store/cyb-server scenes;
  mod.test 336,054 / 0; cyb.test 186,779 / 0.
