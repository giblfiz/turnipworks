# Smithy & workshop (catalog code SMI), 2026-10-11

Places where things are made. Nine room types under Build → Fantasy → Smithy & workshop, and in the Spawn Tuner's palette.
Branch `type-smi`. Built by the castle / crypt / mansion path (`experiments/2026-10-05-castle-crypt-mansion/integration/PLAN.md`)
with the market type's tooling of the same day (`experiments/2026-10-11-types/mkt/`).

## The rooms

| key | room | graph role | walls | default cells |
|---|---|---|---|---|
| `smi-forge` | Blacksmith's forge (the signature room) | uses: stock and the other workshops (the building's hub) | fieldstone | 5x4 |
| `smi-armoury` | Armourer & weaponsmith | uses: `smi-stock` | fieldstone | 5x4 |
| `smi-carpenter` | Carpenter's woodshop | uses: `smi-stock` | rough-timber | 5x4 |
| `smi-potter` | Potter's workshop | uses: `smi-stock` | fieldstone | 5x4 |
| `smi-shopfront` | Smith's shop front | hub (a shop of the market's skeleton) | half-timber, shop window | 4x4 |
| `smi-stock` | Stock store (raw material) | terminal | rough-timber, no windows | 4x3 |
| `smi-yard` | Smith's yard | outdoor | none | 6x5 |
| `smi-quarters` | Smith's quarters (upstairs) | terminal | half-timber | 4x3 |
| `smi-passage` | Workshop passage & stair | passage | half-timber | 2x6 |

No new wall family: the fire rooms are stone, the wood rooms timber, the living rooms half-timber, all families the
library had. A soot-blackened brick family is listed as wanted in `docs/ASSETS_TO_BUILD.md`.

## The workshop skeleton

ONE program (`smiWorkshop`, `integration/programs.smi.js`, appended to `tools/spawn-tuner/js/solver2.js`) lays the four
workshops. The craft is one line of `SMI_CRAFTS`:

| role | where it goes | forge | armourer | carpenter | potter |
|---|---|---|---|---|---|
| heat | centred on the wall facing the door | `forge` | none | none | `kiln-pottery` |
| beside | on that wall, one each side of the heat | `bellows-great`, `coal-bin` | – | – | `woodpile`, `clay-bin` |
| station | one step (3 ft) before the heat; with no heat, the middle of the floor; 1.6 ft clear all round | `anvil` | `smith-breastplate-on-form` | `carpenter-bench` (across the room) | `potters-wheel` |
| by | within reach of the station | `quench-trough` (water), `grindstone` | a spare `armor-stand`, `grindstone` | `craft-shavings-pile`, `sawhorse` | `clay-bin`, a water bucket |
| bench | against a side wall | `table-work` | `mil-armor-repair-bench` | `sawhorse` | `table-work` |
| tools | hung over the bench | `tool-rack-smith`, `smith-horseshoe-rack` | `tool-rack-smith`, helm shelf, shields | `craft-tool-wall-pegboard` | `pots-drying-shelf` |
| done | down the other side wall, repeating with size | `shop-shelf-stocked`, `weapon-rack` | `armor-stand`, `weapon-rack`, `shop-shelf-stocked` (stands in ranks from 30 cells) | `craft-chair-half-built`, chairs, a table, a chest | `pots-drying-shelf`, shelving |
| raw | by the door | `metal-stock`, `smith-coal-heap` | `metal-stock`, `shop-floor-stock`, shields | `craft-boards-planed-stack` (lying along the wall), `craft-wood-offcut-bin`, `woodpile` | `pottery-for-sale`, `storage-jar`, `urn-garden` |

What tells the crafts apart from the table camera is colour: black iron and coal on grey stone (smith); bright steel and
burgundy (armourer); pale yellow wood (carpenter); terracotta, cream and wet grey (potter). The test
(`integration/tests/smi.test.mjs`) fails a workshop that holds another craft's signature piece.

**A new craft** (tanner, cooper, wheelwright, bowyer, glassblower, jeweller …) = its workstation mesh, its own tool board
and stock where it has them, one `SMI_CRAFTS` line, one room-type line in `build_data.py`, one recipe in
`catalog/rooms-smithy.md`. The lists are in `docs/ASSETS_TO_BUILD.md` → Smithy & workshop.

## The shop front IS a trade of the market's shop skeleton

`smi-shopfront` has no program of its own: `mktRegisterTrade('smi-shopfront', { tier: 'smi', … })` in the solver block
and `mktRegisterShop('smi-shopfront')` in the walls block (ROOMS.md → Market & village → "Adding a trade"). The making
side and the selling side share roles: the workshop's finished-goods rack, its sword barrel and its sign are the shop
skeleton's `shop-shelf-stocked--smith`, `shop-floor-stock--smith` and `shop-sign--smith` (the meshes were specified as
`shop-shelf-stocked`, `shop-floor-stock`, `smith-sign-anvil` and re-roled in `manifest_overrides.json`; no extra plates).
With `counter-shop--smith` and `craft-display-table-goods--smith` that is the skeleton's five roles in tier `smi`.
EVERY mesh of the batch is tier `smi` (exclusive, as the market's are `mkt`), so no older room rolls any of them.

In the whole-building generator the FORGE is the hub at the street and the shop front stands beside it: the shop
skeleton needs the wall facing its door for the counter, and a hub's back wall is the stair core and doors.

## Files

- `build_spec.py` + `spec_lib.py` → `assets.json`, `prompts/` (26 new meshes; text prompts and the house style reference only)
- `tools/run_plates.sh` (plates: Codex image route, the gates, CPU matte), `tools/pod_up_smi.sh`, `tools/pod_deadman.sh`, `tools/icons.py`
- `integration/room_types.py`, `programs.smi.js`, `walls_tail.smi.js`, `solver_tail.smi.js`, `apply_smi.py` (idempotent), `make_sandbox_smi.py`, `resand.sh`, `suites.sh`, `tests/`
- `tools/prep_chain.sh` (runtime, ladder, front views), `tools/shots.sh` (room pictures and the blind read), `tools/merge_main.sh` (origin/main in, this type's hunks put back), `tools/land.sh` (tested on the branch, then main fast-forwarded)
- `catalog/rooms-smithy.md` (nine recipes), `catalog/runs/smi-01/manifest.tsv`
- `BENCH.md` (fire and water for the Alignment Bench), `ROOM_READS.md` (blind reads), `LAB_NOTES.md`
