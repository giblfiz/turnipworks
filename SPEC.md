# Turnip Works — asset-pipeline slice

## Outcome

Build a fast, inexpensive loop from an independently designed asset catalog and house style through concept generation, 3D reconstruction, optimization, and browser review.

## House-style target

The selected target is **D — heroic hand-painted**: stout miniature-compatible geometry, strong silhouettes, thick functional parts, broad soft bevels, clean component separation, matte hand-painted gradients, restrained brush texture and low-frequency surface detail. The style should visually host imported heroic-scale miniatures without inheriting their glossy plastic finish. The tavern master plate and alchemist's-lab application test live under `style-references/` with exact prompts and provenance.

Lighting should preserve color readability without giving every object its own apparent key light. Reference scenes use local pools of warm light separated by cooler quiet surfaces; the dungeon plate establishes a baseline roughly one notch dimmer than the tavern. Final exposure and scene-specific darkness belong to the engine rather than being baked irreversibly into every asset texture.

## Clean provenance contract

- Define the Turnip Works taxonomy from functional scene requirements, not another product's catalog.
- Use only original, public-domain, CC0, or otherwise deliberately licensed style inputs.
- Record every prompt, reference, model, provider, output hash, and license/provenance decision.
- Do not promote exploratory assets whose ancestry does not meet this contract.
- Keep model weights separate; operators fetch and license them independently.

## Retained pipeline capabilities

- Concurrent, resumable concept generation with per-image provenance sidecars.
- fal and self-hosted TRELLIS.2 image-to-mesh paths.
- Blender validation and reversible geometry/texture optimization tiers.
- A browser review bench that can remain empty until a clean asset set is ready.
- Review runs remain separate rating namespaces. The 518-figure library is `figures-01`, built from its published manifest using each figure's selected shipping tier and stable accepted concept plate.
- The live reviewer is keyboard-first (October 2 throughput redesign): `0`–`5` scores the model and advances; top-row and keypad digits work. `N` opens the model note, Enter saves it, `U` undoes the last score and returns, `Tab`/`Shift+Tab` advances/goes back, and `/` searches. Concept-plate scores use the visible buttons. A fully reviewed queue shows completion; selecting All still opens its assets.

## Clean worker boundary

- Do not use BRIA RMBG-2.0, `nvdiffrast`, or `nvdiffrec` in the production-oriented lane; the prior Runpod script is explicitly research-only.
- Pre-mask concept plates with pinned official MIT BiRefNet and pass RGBA with TRELLIS background preprocessing disabled.
- Keep pinned MIT Microsoft TRELLIS.2 inference and replace only the NVIDIA-backed UV rasterization inside GLB export with an independently written standard barycentric implementation (or BSD PyTorch3D for the first proof). Preview and training renderers are not part of the batch worker.
- The patch architecture is license-resolved and canary-verified: a clean environment containing neither NVIDIA research package produced a valid textured GLB that reloaded and rendered in Blender. Full-batch validation remains required before promoting the 500-SKU run.

## Packaging direction

- Asset-generation pipeline: distributable operational tooling; code license undecided.
- Generated asset library: intended for CC BY 4.0 or CC0 once clean assets exist.
- VTT engine: intended for AGPL-3.0.

## Runtime asset format (Harry, 2026-09-30, from the canary downsample ladder)

- **One texture map.** Colour map only; constant matte non-metal material (metallic 0, roughness 0.85). The metallic/roughness map is dropped for every asset.
- **Default tier:** ~5k faces, 256 px. **Low tier:** ~3k faces, 128 px (often fine for background props). Collapse decimation floors at ~300 faces on these meshes.
- **GPU is the constraint, not just bytes.** WebP shrinks transfer but unpacks to full size in VRAM. Planned levers:
  - **Atlases:** pack the textures of objects that appear together onto one sheet. Render sets and room recipes supply the grouping. At 256 px, 64 objects fit on one 2048 sheet, so inn-01's ~480 meshes need roughly 8 sheets.
  - **GPU-compressed textures** (KTX2/Basis), which stay compressed in video memory.
  - **Merged render sets** and **instancing** for repeats, to cut draw calls.
- Measured at 5k/256: 241–262 KB per object vs 2.0–2.5 MB source; dropping the second map saves only 2–12 KB of file but halves texture memory. Most of the remaining bytes are uncompressed vertex data, so meshopt/Draco compression is the next transfer-size lever.
- **Real-world size:** every catalog object carries `size:WxDxH[~MIN-MAX]` in inches. The engine scales each generated mesh uniformly to its catalog *height*. Heroic-style meshes then come out about 1.3× wider than a realistic box, so footprint checks should allow for that stoutness.
