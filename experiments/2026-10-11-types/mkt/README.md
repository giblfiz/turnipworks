# Market & village (2026-10-11 / 12): the type, its meshes, the shop skeleton

Twelve rooms for the Build tray (Fantasy → Market & village), 61 new meshes, 12 room icons. Rules in words:
`tools/spawn-tuner/ROOMS.md` → Market & village (including **how a new trade is added**). Blind reads: `ROOM_READS.md`.
Bench items: `BENCH.md`. Still wanted: `docs/ASSETS_TO_BUILD.md` → Market & village.

## Rooms

| key | label | cells | walls | what it is |
|---|---|---|---|---|
| `mkt-square` | Market square | 8x7 | outdoor | stalls in rows round a market cross / well / fountain / pump; its own program |
| `mkt-street` | Town street | 10x3 | outdoor | a clear way down the middle, lamps, bollards, door dressing; its own program |
| `mkt-general` `mkt-bakery` `mkt-apothecary` `mkt-tailor` `mkt-curio` | the five shops | 4x4 | half-timber | ONE program (`mktShop`); the trade is a sku tier |
| `mkt-backroom` | Shop back room | 4x3 | half-timber | store racks; holds the stock of the shop it opens off |
| `mkt-passage` | Shop passage & stair | 2x7 | half-timber | the inn's hallway program |
| `mkt-watch` | Watch post | 4x4 | fieldstone | sergeant's desk, a timber lockup in the corner |
| `mkt-house` | Town house: living room | 4x4 | half-timber | hearth, family table, dresser |
| `mkt-bedroom` | Town house: bedroom | 4x3 | half-timber | the inn's guest-room program |

Stacked: shop + back room + passage below (6x7 cells), living room + bedroom + the same passage above.

## The shop skeleton

Five roles every shop has: `counter-shop`, `shop-shelf-stocked` (two shapes), `craft-display-table-goods`,
`shop-floor-stock`, `shop-sign`. A trade is a **sku tier** on those roles (`mkt-general`, `mkt-bakery`, `mkt-apoth`,
`mkt-tailor`, `mkt-curio`), written in the spec (`"tier"`), carried by the manifest, kept by `build_data.py`; the room type
lists its tier first, `chooseSku` does the rest. A new trade is meshes + `mktRegisterTrade()` + `mktRegisterShop()` +
one room-type line. Catalog: `catalog/objects-market.catalog.md`, `catalog/rooms-market.md`.

## Meshes: 61 shipped of 62 specified

`build_spec.py` → `assets.json` (62) → plates on the free Codex route (`tools/run_plates.sh`, `tools/gen_cpu.py`) →
TRELLIS.2 on RunPod → `qa/summary.tsv` (61 accept) → `catalog/runs/mkt-01/manifest.tsv`.

- **Not made (1):** `awning--s2` (the gate refused it three times: it compares colours with its parent, and the piece is
  the same awning in other colours; not worth another image).
- **Mesh rejects: none.** One supervisor override: `lamp-post-iron--town` (the judge called its cream panes "glowing";
  they are the opaque panes the spec asked for). `qa/overrides.json`.
- **Gate texts that refused good plates** (fixed in `build_spec.py`): `fish-barrel-salted` ("no blue colour" matched
  the chroma ground); it was re-gated from the plate already painted and meshed in a second short pod session.
- **Sizes as they came out** (largest dimension is scaled to the spec's): stalls are 8 ft wide and 5.3 to 8 ft deep (spec
  5.3); the market cross is 7 ft across its steps (spec 5); counters and display tables stand 3.8 to 4.5 ft with their
  goods; the shop window is 6 in proud at its sill. The programs measure the meshes, not the spec (`mktSkuSize`).
- **Spend:** RunPod RTX 4090, pod `tw-mkt`: 1.08 h ($0.96) + 0.15 h ($0.13) = **$1.09**; both pods deleted and verified
  (GET 404, pod list empty). `spend.log`. Images: free route; no fal.
- **Provenance:** text prompts and our own style reference only (`style-references/heroic-handpainted-tavern-v1.png`;
  wall pieces painted from our own 2026-10-01 half-timber wall plate). Per asset: `prompts/<sku>.md`, `gate-manifest.json`.

## What happened on the way (for the next type)

- Five agents shared one 12 GB card: the BiRefNet matte ran out of memory and lost painted plates. `tools/gen_cpu.py`
  keys by chroma first, falls back to BiRefNet on the CPU, re-uses a plate already painted, and restores accepted
  records from `masked/` (a killed run had rewritten `gate-manifest.json` without them).
- A pod of your own: `tools/pod_up_mkt.sh` (the batch's `pod_up.sh` without its one-pod check), `tools/pod_deadman.sh`,
  `tools/one_wave.sh`. `pod_down.sh` needs `--force` on the shared volume (its unharvested-work check trips on other
  agents' run folders): harvest and count first.
- `integration/make_sandbox_mkt.py` (fake meshes at spec size, or `--real`), `integration/apply_mkt.py` (idempotent),
  `tools/prep_chain.sh` (manifest → runtime GLBs → ladder → sweep views in the worktree).
- Reads that changed the rooms are in `ROOM_READS.md`.
