# Market & village — the shop skeleton (2026-10-11)

Roles added for the Market & village room type (`experiments/2026-10-11-types/mkt/`). Nearly everything a town street wants already had a line (`market-stall`, `counter-shop`, `apothecary-drawers`, `bins-dry-goods`, `watch-desk` …); what was missing is the **shop skeleton**: three roles that every shop has and that a trade fills with its own stock.

**A trade is a sku tier, not a room program.** One generic shop (counter, stocked shelves, a display table, floor stock, a sign) is laid by one program; the room type names a tier (`mkt-general`, `mkt-bakery`, `mkt-apoth`, `mkt-tailor`, `mkt-curio`) and the solver rolls that tier's meshes for the skeleton roles below and for `counter-shop` and `craft-display-table-goods`. A later trade (cobbler, chandler, fletcher, jeweller, potter …) is five or six meshes and one line in the trade table, not a new room.

## S9. Shop skeleton (stock swapped by trade)

- **shop-shelf-stocked** — tall shop shelf unit loaded with a trade's stock · floor · 1 · size:60x18x78 · wood · set:MKT!,SMI · var:shape · aff:loot,los · mesh · P1 · the wall of a shop; the stock on it says which shop (one sku tier per trade)
- **shop-floor-stock** — barrel, basket or crate of a trade's goods standing on the shop floor · floor · sub · size:30x30x36 · mixed · set:MKT!,SMI · var:- · aff:loot,cover · mesh · P2 · beside the counter, by the door, in the back room (one sku tier per trade)
- **shop-sign** — carved trade sign board on a stout bracket · wall · sub · size:30x8x30 · wood · set:MKT!,SMI · var:shape · aff:- · mesh · P2 · beside the shop door, facing the street (one sku per trade; no lettering)

## A9. Shopfront

- **wall-window-shop** — wall section with a wide many-paned shop display window · kit · edge · size:60x12x108 · mixed · set:MKT! · var:- · aff:block · kit · P1 · the shopfront: stands in for a plain wall panel on a shop's street wall (walls.js PANELS), never rolled as an ordinary window

## M9. Market square

- **flower-buckets** — flower seller's tubs of cut flowers · floor · sub · size:36x24x28 · organic · set:MKT,NOB · var:- · aff:- · mesh · P2 · market squares, street corners; colour in a square
