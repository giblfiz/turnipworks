# Roof sections (2026-10-11)

Harry: "Our programatic roofs look tacky. Let's make some small shingles-sections for each type in the system, and use
them at 45 degrees. Given we only have like 4 styles of roof I think that's only like 4 objects."

The system has four pitched roof styles (`engine/client/roofs.js` ROOF_STYLES): **thatch, clay tile, slate, wood
shingle**. (The fifth, `flat`, is a deck: it gets no section.) Each now has one modelled 5 ft x 5 ft section, laid out
instanced on every slope. docs/VERTICAL.md "Roof sections" says how the game uses them.

## How a section is made (no image generation, no 3D generation, $0)

The picture is the roofing plate we already own: `experiments/2026-10-05-castle-crypt-mansion/flats/seamless/roofing-*.png`.
`detect.py` measures the plate (the butt line of every course, column by column; the joints between single pieces of a
course). `build_sections.py` builds every piece it found as a wedge on the roof plane, thick at its butt and running down
to nothing under the course above, with a butt face and two sides; thatch is three rounded bands with a ragged lower
edge. The plate is projected straight down onto the wedges, so from above a section is the plate, and the relief is
where the painting says a piece ends. The roof plane itself is part of the mesh (two triangles under the wedges).

Image-to-3D was not used: a thin shingled sheet is what it does worst, and it cannot promise edges that meet.

    python3 build_sections.py --install
        -> out/roof-section--<style>.glb, out/report.json, previews
        -> engine/client/data/roof/*.glb (binaries, not in git) and engine/client/data/roofsections.json (tracked)

| style | pieces | triangles (near) | far | butt thickness | tiles (measured: edge vertices equal on opposite edges) |
|--|--:|--:|--:|--|--|
| thatch | 3 bands | 338 | 2 | 6 in | yes, both ways |
| clay tile | 42 | 360 | 2 | 2.8 in | yes, both ways |
| slate | 40 | 348 | 2 | 2.3 in | yes, both ways |
| wood shingle | 68 | 540 | 2 | 3 in | yes, both ways |

The thickness is miniature-thick on purpose: at the table view 5 ft is about 60 pixels, so a true quarter-inch slate
would be nothing. The far tier is one quad at the mean height with a normal map baked from the same wedges.

**Why it tiles.** The plate is periodic (measured when it was made: flats/README.md), the measurement wraps, and a
wedge that crosses the section's edge is cut at the edge, both halves from the same triangle. `report.json` records the
check per style. The plate is rolled so the section's lower edge lies just under a butt line: a slope starts with a
whole course at the eave.

## Provenance

Each section derives from exactly one image, and from nothing else:

| section | plate | how the plate was made |
|--|--|--|
| `roof-section--thatch.glb` | `flats/seamless/roofing-thatch.png` | Codex image generation (free route), our text prompt (`flats/gen.py` ROOF + `vertical/flats.json` prompt_detail), our own style reference (`style-references/heroic-handpainted-tavern-v1.png`); made seamless by `flats/finish.py`; log `flats/raw/roofing-thatch.log` |
| `roof-section--tile.glb` | `flats/seamless/roofing-tile-clay.png` | the same; `flats/raw/roofing-tile-clay.log` |
| `roof-section--slate.glb` | `flats/seamless/roofing-slate.png` | the same; `flats/raw/roofing-slate.log` |
| `roof-section--shingle.glb` | `flats/seamless/roofing-shingle-wood.png` | the same; `flats/raw/roofing-shingle-wood.log` |

No third-party reference image, nothing from Dungeon Alchemist. The geometry is computed by the two scripts here.

## Files

- `detect.py`, `build_sections.py`: the build.
- `shots.py`: stills of every style from the table camera (before / after / the painted switch).
- `perf_roofs.py`: frame time, draw calls and triangles on a 203-room map (the megamap rung).
- `RESULTS.md`: the numbers, Gemini's blind reads, where the stills are.
