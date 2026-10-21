# For the Alignment Bench: the wizard's tower (accepted pieces only)

For Harry's bench (https://implausible.enterprises/projects/turnip-works/align/), from the `flags` column of
`catalog/runs/wizard-01/manifest.tsv` and `wizard/assets.json`, 2026-10-11. Everything was generated UNLIT and DRY.
A bench record wins over a derived anchor. 7 pieces: 4 fire, 1 water, 1 hinge, plus 1 that wants a decision.

## Fire (4): where the flame sits

| piece | flame type the code gives it | note |
|---|---|---|
| `elemental-brazier` | brazier | the summoning chamber's and the workshop's light; a derived anchor exists (`data/fire_anchors.json`). Its flame COLOUR is the flavours question (the catalog pairs it with `fx-colored-flame`, which does not exist): today it burns like any brazier |
| `alch-athanor` | oven (new line in `js/fx/fire.js`: `/athanor/`) | the fire is behind the small arched stoke hole in the front; the derived anchor is a guess at a cavity, so this is the one to look at first |
| `spellbook-lectern` | none today | one unlit candle in a brass cup on a top corner of the desk. The id does not say "candle", so the game does not light it; a bench anchor plus one `fireType` line would |
| `enchanting-table` | none today | one unlit candle in a brass candlestick at one end of the table; the same |

## Water (1)

| piece | note |
|---|---|
| `scrying-pool` | a DRY, hollow stone basin 4 ft across: the level of the still water (a little under the rim) |

## Hinge / open-shut (1)

| piece | note |
|---|---|
| `door-tower--leaf` | the tower's door leaf (round-topped, strap hinges on its LEFT as painted; the ring handle on the right): the hinge edge |

## Wants a decision rather than an anchor (1)

| piece | note |
|---|---|
| `alch-cauldron-bubbling-green` | the green brew is PAINTED in the mesh (catalog: "cauldron bubbling green"). If Harry would rather have the game's water in it (tinted green), it needs a dry twin and a water level; today it is not a water piece |

Not on the list: `wall-window-small--tower-stone` (a leaded lancet: it does not open; no open twin was made);
`portal-arch` (its opening is empty: the portal surface is an effect that does not exist yet, see docs/ASSETS_TO_BUILD.md).
