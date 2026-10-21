# Farmstead: what needs Harry's Alignment Bench

The deploy's tool sweep puts every shipped asset into the rater, the Alignment Bench and the open / shut tester by
itself (`tools/tool-sweep/check.py`); nothing is wired by hand. This is the list of what is worth his eye, by queue.

## Fire
No new KIND of light and no new fire piece in `hut-01`. The farm rooms light what the library already had, all of it
already on the bench: `hearth-central`, `hearth-raised-square` (the cottage's open fire: the flame stands in the ring,
the pot sits ON it: worth a look that the pot does not hide the flame), `fireplace-wall`, `cook-hearth-spit`,
`rushlight-holder`, `rushlight-holder-wall`, `rural-lantern-barn`, `lantern-pierced-tin`, `lamp-wall-shelf`,
`candle`, `candlestick`, `candle-stubs-dish`, `lantern-hand`.
One name was changed because of fire: the sand box of roots was first `root-clamp-sand-box`, and `fireType()` reads
"lamp" inside "clamp": it would have burned. It ships as `root-sand-box`.

## Water
Nothing in `hut-01` holds water for the engine: the milk in `rural-milk-churn-tall`, the swill in the `pigsty`'s
trough and the whey tray of the `cheese-press` are painted. No `bench:water` flag in `catalog/runs/hut-01/manifest.tsv`.
The farm rooms place the library's own vessels (already on the bench): `well`, `well-house`, `water-trough`,
`horse-trough-stone`, `feed-trough`, `rain-barrel`, `washtub`, `bucket`.

## Open / shut
Nothing in `hut-01` opens: the loft hatch (`loft-ladder-head`) is painted with its lid standing open; the pigsty's
hurdle is part of its mesh. Doors are the library's `door-plank` and `door-barn-double`.

## Worth one look each (not anchors)
- `wall-window-small--wattle-daub`: the shutter is painted open on the room side or the outside by the mesh; the
  panel's worked face was left to the box rule (both faces are daub).
- `beehive-skep`, `rural-milk-churn-tall`: shipped a quarter turn round (`prep/orient_ccm.py` MANUAL), own boxes 40x20 and 26x15 in.
- `pigsty`: 9 ft square with its own mud yard; it stands in the Pigsty plot's far corner and in no other room.
