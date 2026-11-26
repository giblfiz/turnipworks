## Japan (culture pack, seven room types, built 2026-11-06)

Build → Cultures → Japan. A Kyoto townhouse, tea house and Shinto shrine of the late Edo period (c. 1800-1850); one period so the pieces agree. Walls: `jpn-shoji` (dark cedar posts and rails, white shoji lattice, earthen plaster, a wooden bar window) for the house, tea house, dojo and shop; `jpn-shrine` (vermilion posts and beams, white plaster, no windows) for the shrine hall. Doors: the wooden lattice street door (koshido) to outside, painted fusuma panels inside (both swing: the engine has no sliding door). Roofs by family: grey tile (`slate` until a kawara style exists) on the house, `shingle` (cypress bark) on the shrine and the tea house. Floors: tatami (composed two mats to a cell), polished cedar, packed earth for the shop's doma, gravel and moss outside. Every mesh is tier `jpn`.

**The culture skeleton** (`solver2.js`, the `ca:solver2` block; each room is a line of data in `jpn:solver2`). An indoor room: the signature piece centred on the wall facing the door (or hung there: the kamidana), the walk from the door to its front, a pair beside it, the pieces on its axis, rows facing it, a table island with seats round it, a kept-clear floor, things down the side walls and by the door, the far corners, hung things, lamps. An outdoor ground: its centre piece, then the path from the gate to the main door kept clear, a piece astride the path inside the gate (the torii), pairs lining the path, things beside it, stepping stones on it, the corners, a fence on the open edges. **Sacred pieces are placed only by their own rooms and on their axis** (test/cultures.test.mjs fails any other placement, in any room of any type).

| room | key | cells | signature from the table camera |
|---|---|---|---|
| Tatami room (zashiki, hub) | `jpn-house` | 4x4 | the tokonoma alcove on the far wall, a low table with four cushions, tansu and a gold folding screen along the walls |
| Tea house (chashitsu) | `jpn-teahouse` | 3x3 | the tokonoma, the sunken hearth and its iron kettle in the mats, the tea things, the host's and guest's cushions |
| Dojo | `jpn-dojo` | 6x5 | an EMPTY polished floor (the middle 72% x 62% kept clear), the kamidana high and centred on the far wall, wooden-sword racks down the sides, the drum and an armour in the far corners |
| Shrine hall (haiden) | `jpn-shrine` | 5x4 | the plain offering table before closed sanctum doors (the honden is never shown), the bell rope over the offering box on the axis |
| Shrine approach (outdoor) | `jpn-shrine-court` | 6x6 | the torii astride the path inside the gate, stone lanterns lining the path in pairs, the purification basin beside it, the komainu pair by the hall's door |
| Sake merchant's shop (hub) | `jpn-shop` | 4x4 | the raised counting platform with its lattice screen and abacus, straw-wrapped casks and shelves of flasks, the cedar ball over the door |
| Tea garden (roji, outdoor) | `jpn-garden` | 6x6 | stepping stones on the moss path to the stone basin and its lantern by the tea house door, maple and pine in the corners, a bamboo fence |

A dragged Japan building packs the tatami room and the shop (a machiya); the shrine, the dojo, the tea house and the grounds are drawn on their own (`engine/client/pack.js` APART).
