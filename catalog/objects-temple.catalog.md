# Temple gaps — the temple & chapel type, and the FLAVOR slots (2026-10-11)

Objects the temple rooms (`catalog/rooms-temple.md`, batch `experiments/2026-10-11-types/tem/`) want and the catalog lacked. Most of a temple already had a line and a mesh (altar, pews, lectern, font, candle stands, stained glass, dais): those are reused. The wall style is a new kit family, `temple-stone` (pale dressed limestone, tall lancet windows).

**Flavors.** A religious place is built flavor-neutral (architecture and furniture carry no emblem) and dressed by six SLOT roles, `flavor-*`, defined once for every type in `catalog/objects-flavor.catalog.md` (shared with the Cult sanctum). This batch fills them for `sun` and `moon`: skus `flavor-<slot>--sun`, `flavor-<slot>--moon`. Rules in words: `tools/spawn-tuner/ROOMS.md` → Flavor slots.

## F2. Temple furniture, flavor-neutral (2026-10-11)

- **pulpit** — raised wooden preaching pulpit with a panelled front and a short stair · floor · 1 · size:48x60x84 · wood · set:TEM!,CAS · var:ruin · aff:use,cover · mesh · P1 · beside the chancel step; the preacher's place
- **organ-pipe** — pipe organ: a tall case of stout pipes over a keyboard desk · wall · 1x2 · size:96x36x104 · mixed · set:TEM!,NOB · var:ruin · aff:use · mesh · P1 · cathedral naves; against a wall
- **bell-on-frame** — great bronze bell hanging in a stout timber frame standing on the floor · floor · 1 · size:60x48x78 · mixed · set:TEM!,CAS,MKT · var:- · aff:use · mesh · P1 · bell tower base (the tenor waiting to be hung, or the tolling bell of a small chapel)
- **confessional** — closed wooden booth with two doors and a carved cornice · wall · 1 · size:66x36x90 · wood · set:TEM! · var:- · aff:hide,use · mesh · P2 · along the aisle walls of a large temple
- **rite-prie-dieu** — kneeling desk: a low padded kneeler with a sloped book rest · floor · sub · size:24x24x36 · wood · set:TEM!,NOB,HUT · var:- · aff:use · mesh · P2 · before shrines, in cells and side chapels
