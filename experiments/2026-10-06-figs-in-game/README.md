# Figures in the game: Gemini's blind reads of the pawn facing mark (2026-10-06)
gemini-2.5-pro; docs/UI.md "Figures as pawns". Shots by `engine/test/browser_figs.py --shots DIR` (pictures are not kept in git).
Truth: `key.json`, worked out from the projection (the base's centre and the tip of its arrowhead, on screen).
- `one-pawn-per-picture/`: each pawn cut from the table-distance shot, neutral file names; `map.json` says which is which. Five of six exact, one 45 degrees off (view one).
- `whole-table-arrowhead/`: all six pawns in one picture, lettered. The mark is called obvious; most directions are named wrongly.
- `whole-table-bases-only-control/`: pictures one and two with figures, three and four the same bases with no figure on them. Wrong there too: the whole-table reading is not a usable test of the mark.

## The name on the base, and main pawns (later the same day)
- `names-whole-table/`: six named pawns in one picture, lettering toward the camera (1 table, 2 leaning in) and fixed to the base (3, 4). Gemini read none of the names; it wrote what the figures looked like ("Wolf", "Owlbear"). These were taken while the lettering was still mirrored.
- `names-one-pawn-per-picture/`: one pawn per enlarged crop, three letterings (0.62 ft and 1.0 ft on the disc top, 0.55 ft on the rim's face), table distance and leaning in; `key.json` has the truth. Table distance (a base 60 px across): nothing read, in any lettering. Leaning in (98 px): 1.0 ft read 3 of 3 exactly, 0.62 ft 1 of 3, the rim face 2 of 3. (An earlier run of this read "ddoH meT blO" and said "the text appears to be mirrored": it was; fixed, and the test now measures the reading direction.)
- `main-pawn-detail/`: the same five heroes at the 20k tier and as main pawns (the original mesh), same camera; `detail-key.json` says which file is which. Leaning in: "absolutely identical". First person: told apart side by side (one figure's mouth), the original judged better.
