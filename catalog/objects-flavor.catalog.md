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
- **flavor-pillar** — free-standing column carved in the faction's motif, flat-topped capital to carry a ceiling · floor · sub · size:30x30x120 · stone · set:CLT,TEM · var:shape · aff:block,los,cover · mesh · P1 · slot 10 (Harry, 2026-10-24: pillars for each faction); placed by hand, snaps like a post (a grid cross or an edge midpoint); one storey tall; no room recipe rolls it

## K8. The faiths' own roles (2026-11-07, lane faith-factions)

The four real-world faith factions (`christian`, `buddhist`, `hindu`, `muslim`; roster and sensitivity read in `experiments/2026-11-07-faith-factions/DESIGN.md`) fill the core slots they use and leave the rest deliberately empty (a mosque has no idol); what a faith uses that no core slot fits gets one of the roles below. Only the faiths fill them (`ownSlots` in tools/spawn-tuner/factions.py), so the Factions shelf shows them only in those rows. Temple sets only (TEM): no cult room asks for them, and the faiths never dress a cult room. Each piece carries its own name ("Minbar", "Prayer wheel"); no piece carries text in any script.

- **flavor-altar** — the faith's own altar or offering table, standing in for the plain stone altar · floor · 1x2 · size:60x24x36 · wood · set:TEM · var:shape · aff:block · mesh · P1 · the Buddhist offering table; before the focus on the hall's axis
- **flavor-mat** — where the faithful sit or kneel in rows: a seating runner, a prayer carpet · floor · 1x2 · size:30x96x0.2 · cloth · set:TEM · var:shape · aff:sit · flat · P1 · in clear rows facing the focus; nothing stands on them
- **flavor-pulpit** — the faith's pulpit: the minbar · floor · 1x2 · size:30x96x106~0.8-1.1 · wood · set:TEM · var:shape · aff:block,cover,los · mesh · P1 · against the focus wall, to the worshipper's right of the mihrab; only in a hall 16 ft across or more
- **flavor-stand** — a stand of the rite near the focus: a thurible on its stand, an empty rehal · floor · sub · size:18x18x54 · mixed · set:TEM · var:shape · aff:- · mesh · P1 · beside the altar or the mihrab
- **flavor-font** — the faith's water: a baptismal font, an ablution fountain · floor · 1 · size:36x36x54 · stone · set:TEM · var:shape · aff:block · mesh · P1 · the Christian font by the door; the ablution fountain is placed by hand (a courtyard), never on a prayer floor
- **flavor-lamp** — a hanging lamp of the faith: the mosque lamp · ceiling · tiny · size:14x14x36 · mixed · set:TEM · var:shape,lit · aff:lit · mesh · P1 · hung in rows over the prayer rows
- **flavor-wheel** — a standing prayer wheel in its frame · floor · 1 · size:30x30x72 · metal · set:TEM · var:shape · aff:use,block · mesh · P1 · along the side walls of a Buddhist hall with room to turn it
- **flavor-bell** — a temple bell hung at the entrance · ceiling · tiny · size:14x14x36 · metal · set:TEM · var:shape · aff:use · mesh · P1 · inside the door, rung on entering
- **flavor-gate** — a free-standing gateway arch of the faith: the torana · floor · 1x2 · size:96x24x120 · stone · set:TEM · var:shape · aff:block · mesh · P1 · placed by hand, walked through; no room recipe rolls it
