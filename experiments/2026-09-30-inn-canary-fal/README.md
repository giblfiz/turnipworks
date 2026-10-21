# inn-01 canary — fal TRELLIS.2, house style D (2026-09-30)

- **Style:** `style/heroic-handpainted.object.md`; single reference `style-references/heroic-handpainted-tavern-v1.png` (SHA-256 e660f045…, matches its recorded hash). Plates: Gemini `gemini-3.1-flash-image`, 1K, sidecars in `inputs/*.gemini.json`.
- **Mesh:** fal `fal-ai/trellis-2`, resolution 1024, texture 2048, decimation 50k, remesh on. $0.30 each, $1.20 total; 40–106 s per asset. Background removal happens inside fal's commercial API (no RMBG-2.0 on our side).
- **Validation:** Blender 4.3 imported 4/4 (46k–50k tris, 1 material, 2 images each). Renders in `renders/`; `contact-plate-vs-mesh.jpg` compares plate vs front/side/back.
- **Gemini 2.5 Pro QA (plate, then mesh):** plates 4/4 style-match 5/5. Meshes: chair-plain yes (5/4/5), barrel yes (5/4/5), tankard with fixes (4/3/3: small surface detail smeared, plate added rune-like marks despite the prompt), turnip-pile no (4/3/2: fused, melted back side, cloth-mat artifact).

## Lessons for the 500-SKU run
1. Single chunky objects reconstruct very well; hidden sides hold up.
2. **Piles and clusters should be render sets of singles, not one TRELLIS mesh.** 37 of inn-01's 483 3D SKUs are piles/stacks/bunches — convert them to sets built from single-object members.
3. Small objects: suppress fine surface ornament in the prompt ("plain smooth surfaces, no engraving or runes") and consider 1536 resolution for tiny detailed items.
4. Some lighting is baked into textures; acceptable for a painted style, but add "no cast shadows on the object, flat even light" and compare.
