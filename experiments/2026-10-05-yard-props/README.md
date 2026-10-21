# Yard props (2026-10-05): the outdoor mesh batch

The batch from `docs/ASSETS_TO_BUILD.md` → Outdoors: trees, bushes and planters, three edge kits (fence, hedge, dry-stone
wall, each with a corner piece and a gate), yard furniture and garden things. 54 pieces specified, **53 shipped**, 1
rejected (`hoe`). **$0.76 on RunPod**, no fal; plates from the free Codex image route. Source name in the library:
`outdoors-02`; run manifest `catalog/runs/outdoors-02/manifest.tsv`.

    python3 build_spec.py                                   # assets.json: prompts + gate criteria (sizes per piece)
    tw-birefnet-venv/bin/python gen.py . --group test        # plates through src/plate_gate_batch.py (blind describe -> match -> matte -> mask gate)
    ./launch_wave.sh HOST PORT [sku ...]                     # masked/*.png -> the pod, one TRELLIS.2 worker (RTX 4090)
    blender --background --python qa_mesh.py -- qa sizes.json models/*.glb   # measurements + a four-view sheet per mesh
    tw-birefnet-venv/bin/python qa_gate.py qa                # blind Gemini read of the sheet, then a match with the measurements
    python3 make_manifest.py                                 # accepted.json -> the run manifest (shipped names and sizes)
    yard_shots.py / yard_close.py                            # yards in a headless tuner for the table-distance blind read

## Trees first

Five were tested before anything else (three trees, a bush, a hedge section), the trees twice: once with the plain
house-style prompt and once asking for a storybook canopy of five to seven chunky leaf clumps. **All eight passed.**
Measured: one trunk under a wide crown in every tree (the bottom fifth of the height spans a quarter to a half of the
footprint, the upper half all of it), no part over 1% of the mesh floating, no base slab. Gemini, blind, on every one:
a tree (birch, apple, "stylized tree"), confidence 0.98, "reads clearly at distance", trunk meeting the ground, foliage
"rounded clumps", no defects; one note on the plain broadleaf ("leaf shells with visible sharp shell edges"). The
chunky prompt was used for the four later trees; both versions of the three test trees ship (`--s` chunky, `--s2` plain).

What the generator does to trees: they come out about as wide as they are tall, and flatter front-to-back than
side-to-side (0.64–0.79). So a tree ships at its own size (`size` in the manifest, largest dimension to largest
dimension): the "large" broadleaf is 20 ft with an 18-ft crown, not the catalog's 30 ft; the great oak is 26 ft across.

## Pod

A100s were out of stock in EUR-IS-1, where the network volume `tw-trellis-cache` lives, so the pod was one RTX 4090
(24 GB, $0.74/hr), one worker, not resident: about 50 s a mesh, 4.5 min to load the models per wave. Five waves.
Setup (`src/setup_runpod_trellis2_clean.sh`) took 7 min. See `spend.log`.

## Re-rolls and the reject

- Plate re-rolled once inside the gate: `tree-fruit--s--chunky` (mask), `spade-garden`, `hedge-gap-arch` (first plate was a wooden gate).
- `hedge-end-block`: both plates were rejected, the second only because the gate text demanded a domed top and the plate
  was a flat-topped hedge cube. The gate text was wrong; the same plate was gated again against the corrected text
  (`regate.py`) and passed. No third image.
- Plate re-rolled after measuring the first mesh: `vegetable-patch` (came out square, 9.2 × 8.0 ft, in a wooden frame:
  now 5.4 × 9.2 ft, bare soil) and `sign-post-inn` (arm 7.6 ft wide on a 9-ft post: now 3.8 ft). First tries in `try1/`.
- Re-meshed with another seed: `trowel-garden` (a second handle grew at right angles: fixed) and `hoe`.
- **Rejected: `hoe`.** Both meshes broke the tool into floating pieces (Gemini: "main blade is floating completely
  detached in mid-air"). The bundle `garden-tools-leaning` (spade, rake and hoe as one chunky mesh) shipped instead.

## Notes on what shipped

- Kit pieces are stretched per axis to their box, so the boxes follow the meshes (within about 1.5×): the fence came out
  2.4 ft tall where the catalog says 4 ft, and ships at 40 in. `make_manifest.py` `KIT_BOX`.
- `trade-herb-bed` reads as "succulents" rather than herbs, and is 2.6 ft tall. `axe-woodcutter` reads as a hatchet.
- `dog-kennel` read as "doghouse" on its own sheet but was called a workbench, a beehive and a "workshop machine" in
  three yards at table distance. It stays in the library and appears in one yard in three.
- Orientation: `tools/spawn-tuner/prep/orient-sweep-outdoors02/` (blind front read + the box rule). Five came in
  turned 90° and are corrected in `data/orient.json`: axe, flower box, log seat, herb bed, and the signpost (by its read front).
