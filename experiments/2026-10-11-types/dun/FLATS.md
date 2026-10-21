# Dungeon & prison: flats wanted (floors, strips, decals, icons)

Made with the flats tools of `experiments/2026-10-05-castle-crypt-mansion/flats/` (README there), output into
`experiments/2026-10-11-types/dun/flats/{seamless,decals,icons}`. Free Codex image route only.

## Seamless floors (1024 px, tile on all four edges; base + v2 where said)
| name | what |
|---|---|
| floor-cut-rock (+ --v2, --v3) | a floor hewn from living rock: dark grey-brown, chisel-scored, uneven worn planes, a few cracks, NO slabs, NO joints; quiet and cool (it sits under props) |
| floor-water-flooded (+ --v2) | a flooded stone floor seen from above: dark green-black still water a foot deep with pale flagstones dimly visible under it, a few ripples, scum and a floating leaf; reads as WATER at 40 ft |
| floor-flagstone-dungeon (+ --v2) | big worn dark dungeon flagstones with black joints, damp patches, one iron ring bolt per tile (v2: none) |

## Strips (opaque keyed plates like `rite-altar-cloth`: NOT `decal-*`, cropped not feathered; each is one 5 ft x 5 ft
tile that repeats LEFT-RIGHT, so its left and right edges must match)
| name | what |
|---|---|
| chasm-strip (--s1, --s2) | top-down: a bottomless chasm running left to right. Top and bottom 10% are ragged broken rock lips (floor level), between them the drop: rock walls falling away into black, faint blue-grey mist deep down. Painted so depth reads from a 55 degree camera |
| chasm-strip-wide | the same, 5 ft x 10 ft (two tiles deep), lips only at top and bottom |
| sewer-channel-strip (--s1, --s2) | top-down: a sewer channel running left to right: dressed stone kerbs along top and bottom (10% each), between them murky green-brown water with scum lines and a drifting bit of refuse |
| pit-open | 5 ft x 5 ft square trompe-l'oeil pit: stone rim all round, sheer sides falling to black |

## Decals (chroma plates, keyed and feathered: `decal-*`)
rune-tile--s1..s4 (a 4.5-ft square stone floor tile each carved with ONE big distinct angular rune, dull bronze inlay;
these are NOT `decal-` named: square, cropped) · floor-mosaic--s1 (9 ft round mosaic: a stylised map / star chart in
dull tesserae, a few missing) · decal-glyph-warding--s1, --s2 (a painted red-ochre warding circle, 2 ft) ·
decal-cracks--s1, --s2 (branching floor cracks) · decal-rubble-scatter--s1, --s2 (stone chips and dust, role
`rubble-small-scatter`) · decal-straw-scatter--s1, --s2 (role `straw-scatter`) · decal-slime--s1, --s2 (green slime
patch, role `slime-mold-floor`) · decal-scorch--s1 (a soot fan, for the flame jet) · decal-claw-marks--s1 (three long
gouges across flagstones, laid on the FLOOR) · decal-web-floor--s1 (a thick sheet of spider web spread over the floor,
5 ft, role `giant-web`) · decal-drag-marks--s1 (a block's scrape track, for the sliding block).

## Icons (128 px RGBA, the build tray's style: see the crypt's `icons/` and `experiments/2026-10-03-build-icons`)
room-dun-cell-block (barred door) · room-dun-guard-room (helm over crossed keys) · room-dun-interrogation (iron chair
/ rack) · room-dun-vault (open chest of gold) · room-dun-sewer (round grate with dripping water) · room-dun-corridor
(a torch-lit passage arch) · room-dun-trap-corridor (floor spikes) · room-dun-puzzle-hall (rune tile / rotating
statue) · room-dun-chasm (a bridge over a gap) · room-dun-den (a nest with eggs / claw) · room-dun-shrine (idol in a
niche with a candle) · room-dun-flooded (pillar in water) · room-dun-collapsed (rubble with a broken column) ·
type-DUN only if `engine/client/data/icons/type-DUN.png` does not already exist.
