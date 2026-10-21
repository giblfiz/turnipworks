# Flavor slots — the symbol-pieces that re-dress a religious place (2026-10-11)

Harry is designing a **flavor** system: a short list of symbol-themes (never named gods) that re-dress religious places. Evil-leaning: `spiders`, `dragons`, `devils`, `skulls`, `tentacles`. Good-leaning: `sun`, `moon`, `nature`, `sword-shield`. The architecture and furniture of a sanctum or temple are flavor-NEUTRAL; all iconography sits on the nine separable roles below. One role = one slot; one mesh or image per flavor, sku `<role>--<flavor>` (the flavor is the sku's `shape`, so a room asks for `{ shape: 'devils' }`). Full scheme and how rooms use it: `tools/spawn-tuner/ROOMS.md` → "Flavor slots".

**Status (2026-10-11):** filled for `devils` and `spiders` by the Cult sanctum batch (`experiments/2026-10-11-types/clt/`). The Temple batch fills `sun` and `moon` into the same roles.

## K7. Flavor slots (2026-10-11)

- **flavor-altarpiece** — the symbol-piece that stands in the middle of an altar · surface · sub · size:22x16x24 · mixed · set:CLT!,TEM! · var:shape · aff:loot,carry · mesh · P1 · slot 1; one per altar, centred
- **flavor-idol** — large statue or idol of what is worshipped here, on its own plinth · floor · 1 · size:60x54x108~0.6-1.3 · stone · set:CLT!,TEM! · var:shape · aff:block,cover,los · mesh · P1 · slot 2; on the end wall behind the altar, or alone in an inner shrine
- **flavor-banner** — long hanging banner bearing the symbol · wall · 1 · size:30x1x72~0.6-1.6 · cloth · set:CLT!,TEM! · var:shape · aff:- · flat · P1 · slot 3; on the long walls and behind the idol
- **flavor-relief** — carved stone tablet with the symbol in deep relief, hung on a wall · wall · 1 · size:48x8x60 · stone · set:CLT!,TEM! · var:shape · aff:- · mesh · P1 · slot 4 (a type with windows may fill this slot with a `flavor-window` kit panel instead)
- **flavor-sigil** — the symbol drawn large on the floor, seen from above · floor · 2x2 · size:96x96x0.1~0.5-1.5 · mixed · set:CLT!,TEM! · var:shape · aff:use · flat · P1 · slot 5; inside a ritual circle or before the altar
- **flavor-censer** — floor-standing candle-holder or censer worked in the symbol's shapes, unlit · floor · sub · size:20x20x60 · metal · set:CLT!,TEM! · var:shape,lit · aff:lit · mesh · P1 · slot 6; in pairs flanking the altar or the idol
- **flavor-sculpture** — a second showpiece in the flavor's motif that is NOT the worshipped idol: a carved pillar, basin or figure group · floor · 1 · size:36x36x84~0.6-1.4 · stone · set:CLT!,TEM! · var:shape · aff:block,cover · mesh · P1 · slot 7 (Harry, 2026-10-11); at the door end of a nave, in a side aisle, a cloister or an antechamber
- **flavor-buttress** — upright pier worked in the flavor's motif · wall · 1 · size:36x48x108 · stone · set:CLT!,TEM!,CAS · var:shape · aff:cover · mesh · P1 · slot 8 (Harry, 2026-10-11); a 9-ft upright pier along the walls inside a large nave or sanctum; use each SKU’s measured box, rather than treating it as a vertical-kit replacement

- **flavor-corbel** — stout carved wall bracket bearing the faction motif, flat back and flat beam-bearing top · wall · sub · size:24x24x30 · stone · set:CLT!,TEM! · var:shape · aff:- · mesh · P1 · slot 9; front faces away from the wall, top at beam height; a line along the long walls of large naves and sanctums
