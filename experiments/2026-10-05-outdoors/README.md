# Outdoors: the Yard icon and ground textures (2026-10-05)

Free route only: `codex exec` image generation (ChatGPT login, no API spend), as `experiments/2026-10-03-build-icons`.

    python3 gen.py [-j 3]                                # raw/room-yard.png (magenta key), inputs/floor-*.jpg
    python3 post.py                                      # -> engine/client/data/icons/room-yard.png (128 px)
    python3 ../2026-10-01-floors2/make_seamless.py       # inputs/*.jpg -> seamless/*.png (run from this folder)
    python3 normalize_variants.py                        # colour-match variants to the base
    python3 edge_match.py                                # gravel only: c1..c2 share a border, so they mix per cell with no seam
    python3 gen_decals.py [-j 4]                         # decals/decal-grass-*.jpg (chroma-blue plates, our own grass attached as the colour anchor)
    python3 ../../tools/spawn-tuner/build_data.py        # reads seamless/ and decals/ (src "outdoors-01"); then prep the flats
                                                         # (only the new skus: prep/flats.py re-keys every decal with a per-run random wobble)

Gemini's read (gemini-2.5-pro): the icon matches the set and keys clean; each texture tiles without seams; mixed grass
variants show the cell grid (2/5 rotated, 3/5 edge-matched), so grass lays its base variant straight in the default
floor mode and keeps v2..v4 for the shuffle mode; edge-matched gravel mixes with the grid invisible (0/5).

The grass decals (4 tufts, 3 worn patches) are scattered over `floor-grass` by `look.js` `SCATTER`. Gemini on a 40×25-ft
preview: reads as a natural yard lawn, the patches blend with no halo or fringe, density about right, tile grid 0 of 5.

## Second batch (2026-10-05): the worn path and three more floors

    python3 gen.py floor-grass-worn,floor-grass-meadow,floor-cobble-mossy    # inputs/*.jpg (the grass two get floor-grass attached as colour anchor)
    python3 finish_new.py                # -> seamless/ for these three ONLY (do not re-run make_seamless.py here: it would undo
                                         #    normalize_variants.py and edge_match.py); joins edges with a cut, not a cross-fade
    python3 gen_decals.py                # decals/decal-path-worn--s1..s4.jpg (skips what exists)
    python3 clean_plates.py decal-path-worn   # repaints blue specks inside the subject (0.31% -> 0.01% of visible pixels)
    python3 check_new.py                 # raw/checks/: 3x3 tilings, the path laid on a 40x25-ft lawn, seam and residue numbers

Gemini (gemini-2.5-pro, blind). Floors: hard seams 0 of 5 on all three, no blur or ghosting (the cross-fade had ghosted the
cobbles and the earth patches: hence the cut). As ONE variant each, their landmarks (earth scuffs, flowers, stones) repeat
visibly every 5 ft in a 3x3 (3 to 5 of 5 over several reads, against 2 of 5 for plain floor-grass): fine for a small yard,
a large one wants variants. `floor-grass-worn` and `floor-grass-meadow` are second rolls (first: large earth patches in a
lattice, blotch 0.19 -> 0.07; flowers in clusters). Greens read as one family with floor-grass; worn is a little more saturated.
Path: "a worn dirt path", very high confidence; no halo, no sticker edge, no blue or purple after clean_plates.py. Butted end
to end the faded ends leave thin grass gaps; with about 20% overlap (and flips) the joins blend and only repeated shapes show.
The same blue specks are in decal-grass-tuft--s1/s2 and decal-grass-worn--s2 (0.2 to 0.4%), not cleaned here.
