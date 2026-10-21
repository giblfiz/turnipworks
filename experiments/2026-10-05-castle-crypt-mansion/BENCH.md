# For the Alignment Bench: castle, crypt, mansion and the vertical kit (accepted pieces only)

One list for Harry's bench (https://implausible.enterprises/projects/turnip-works/align/), taken from the `flags` column of
the four manifests (`catalog/runs/{crypt,castle,mansion,vertical}-01/manifest.tsv`) and the three QA.md files, 2026-10-06.
Everything was generated UNLIT and DRY. Derived fire anchors exist for every light below (`tools/spawn-tuner/data/fire_anchors.json`,
from `prep/fire_anchors.py`); a bench record wins over a derived anchor. 68 pieces: 32 fire, 6 water, 30 hinge / open-shut.

## Fire (32): where the flame sits, and how many

| source | piece | flame type the code gives it |
|---|---|---|
| crypt (10) | `rite-pillar-candle-tall--s1`, `--s2` | candle |
| | `candle-drippings-mound`, `skull-candle`, `rite-offering-candles-tray` | candle |
| | `rite-memorial-sand-tray` | stubs (a cluster of four) |
| | `rite-bone-candelabra` (new: shipped with the castle) | candelabra (three in a row) |
| | `brazier-standing--crypt`, `rite-sacred-flame-bowl` | brazier |
| | `rite-sanctuary-lamp` (hangs) | lantern |
| castle (13) | `fireplace-grand`, `cook-hearth-spit--great` | hearth (a cavity with a mouth) |
| | `cauldron-crane`, `pig-on-spit` | brazier (an open fire under a pot or a spit: the flame HEIGHT needs the bench) |
| | `brazier-large`, `brazier-irons`, `mil-signal-beacon`, `mil-boiling-oil-pot` | brazier |
| | `chandelier-ring--great` (hangs) | chandelier |
| | `prayer-candle-rack` | candle |
| | `candelabra-standing--iron` | candelabra |
| | `mil-guard-lantern`, `watch-lantern-bell` | lantern (the bell lantern's derived anchor is the worst of the batch: 7.7 in from the old estimate) |
| mansion (7) | `fireplace-marble` | hearth |
| | `chandelier-grand`, `chandelier-grand--s2` (hang) | chandelier |
| | `candelabra-standing--s1`, `--s2`, `candelabra--fine--s2` | candelabra |
| | `sconce-candle-triple--fine` (wall) | candle: ONE flame today; it has three candles |
| inn-era pieces lit for the first time by this batch (2) | `cresset-wall--s1`, `--s2` (torch); `fire-basket-stand--s1`, `--s2` (brazier) | they stand in the inn's yard and kitchen too |

## Water (6): the surface height

| source | piece |
|---|---|
| mansion (5) | `fountain-courtyard` (8 ft), `fountain-courtyard--s2` (5 ft), `fountain-wall`, `lily-pond`, `birdbath` |
| castle (1) | `font-holy` (the chapel's font; the mesh is the castle's, the role is older) |

## Hinges and open / shut pairs (30)

| source | closed | open twin | note |
|---|---|---|---|
| crypt | `sarcophagus--s1` | `sarcophagus-open--s1`, `sarcophagus-open--s1--lidoff` | lid slid, lid off |
| | `coffin--s1` | `coffin-open--s1` | |
| | `crypt-gate-iron` | (none) | a leaf: hinge side. Also the castle dungeon's cell door for now |
| | `door-crypt--leaf` | (none) | a leaf |
| castle | `portcullis--castle-rough` | `portcullis-raised--castle-rough` | a vertical slide in the same 120 x 18 x 108 box, not a hinge |
| | `iron-maiden` | `iron-maiden-open` | |
| | `mil-footlocker` | `mil-footlocker-open` | lid up |
| | `door-reinforced--leaf` (shape `castle-leaf`) | (none) | a leaf, 40 x 11 x 84 |
| | `gate-double-timber` | (none) | two leaves, 110 x 13 x 120; the gatehouse's inner gate |
| mansion | `sideboard` | `sideboard-open` | |
| | `cabinet-china` | `cabinet-china-open` | |
| | `desk-bureau` | `desk-bureau-open` | fall front |
| | `wall-window-small--noble-panel` | `wall-window-small-open--noble-panel` | casements |
| | `wall-window-small--noble-paper` | `wall-window-small-open--noble-paper` | casements |
| | `door-panelled--leaf`, `door-glazed--leaf`, `door-double-grand--fine-leaf` | (none) | leaves |
| vertical | `roof-hatch--wood` | `roof-hatch-open--wood` | the open one's curb is 52 in against 48 |

Missing, so not on the list: the barred cell door pair (`door-cell-bars`, `-open`: rejected), `fireplace-marble--s2` and
`lamp-post-iron` (no plate), a wardrobe pair (none was specified in this batch).
