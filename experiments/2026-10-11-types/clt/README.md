# Cult sanctum type (CLT), 2026-10-11 / 12

Harry: "go ahead and build out the rest of the fantasy genre type assets ... the wiz tower and cult sanctum and such."
Nine rooms, one new wall family, 41 meshes, 16 flat images, 9 room icons. Rules in words: `tools/spawn-tuner/ROOMS.md`
(Cult sanctum, Flavor slots). Blind reads: `ROOM_READS.md`. Bench list: `BENCH.md`.

## Rooms
Hidden entrance (a false cellar whose way on is a bookcase), Processional passage, Sanctum, Summoning chamber, Holding
cells, Robing room, Forbidden library, Acolytes' quarters, Inner sanctum. Walls: `black-stone` (near-black basalt, one
dark red band; plain x2, doorway, arched alcove, secret door ajar); the entrance is `dressed-stone`. No windows.

## Flavors
Architecture and furniture carry no symbol. Iconography is on the eight `flavor-*` roles (catalog
`objects-flavor.catalog.md`, shared with the Temple). Filled here for **devils** and **spiders**: idol, sculpture,
buttress, altar-piece, censer (meshes); banner, wall relief, floor sigil (flats). 5 meshes + 3 flats per flavor.
The buttress meshes arch 9 ft out from their pier and ship at their own box (30 x 108 x 100 in), not the vertical
kit buttress's 36 x 48 x 108.

## The run
- Plates: 43 specified, 43 accepted (free Codex image route; text prompts + our own style reference and parent plates
  only: no third-party image). `assets.json` carries a `provenance` line per asset; `gate-manifest.json` the gate record.
- Meshes: 43 made on RunPod (pod `tw-clt`, A100, 0.81 h, about $1.45 at $1.79/h; deleted, GET 404), 41 accepted
  (`qa/summary.tsv`, `catalog/runs/cult-01/manifest.tsv`).
  - rejected `door-secret-bookcase-open`: came out as the closed bookcase barely turned; the engine swings the leaf.
  - rejected `rite-cult-mask-blank`: lying flat it is a white dome, an egg at table distance.
  - accepted by override (`qa/overrides.json`): the bookcase leaf and the secret-door panel, which the doorway rule
    misjudged (my spec flagged them as doorways).
  - renamed: `elemental-brazier--black`, `tome-grimoire--black` (the wizard batch landed those sku names first).
- Flats (`flats/`): `floor-basalt-dark` x4, `decal-ritual-circle--plain`, banner / relief / sigil x devils / spiders,
  nine room icons.

## Still wanted
- an open twin for the bookcase door; a shut twin for the secret-door panel; a blank mask that stands or hangs
- the storeys code taking `flavor-buttress` where it picks `buttress` (`engine/client/world.js SUPPORT_BOX`), and a
  buttress within the kit's 48-in reach if it is to stand in outside
- flavors not made: dragons, skulls, tentacles
- recipe roles with no mesh: `cult-banner` and `idol-dark` (superseded by the flavor roles), `phylactery`,
  `tentacles-floor`, `rite-cult-mask-horned`, `alch-summoning-candles-ring`
