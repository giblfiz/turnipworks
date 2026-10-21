# Crypt gaps — the crypt type (2026-10-05)

Objects the crypt rooms (`catalog/rooms-crypt.md`, batch `experiments/2026-10-05-castle-crypt-mansion/crypt/`) want and the catalog lacked. Harry asked for castle, crypt and mansion types on 2026-10-05; the crypt ships first as the pipeline pilot. Most of what a crypt wants already had a line (sarcophagus, coffin, wall-crypt-niches, ossuary-wall, crypt-gate-iron, the `rite-` funerary set) and only lacked a mesh: those are specified in the batch's `build_spec.py` under their existing ids. The lines here are the pieces with no line at all: the crypt's own door leaf, the open states of the sarcophagus and the coffin, four focal pieces, and a few chunky supporting pieces chosen because they read from above.

**Status (2026-10-05): specified, not yet generated.** The crypt wall style is a new kit family, `crypt-stone` (dark, damp dressed stone): `wall-straight--crypt-stone` (two versions), `wall-doorway--crypt-stone`, `wall-crypt-niches--crypt-stone` (empty, wrapped bodies, bones), `ossuary-wall--crypt-stone`, `tomb-door-sealed--crypt-stone`. A crypt has no windows.

## A9. Crypt structure (crypt, 2026-10-05)

- **door-crypt** — heavy crypt door of dark oak planks bound with broad iron straps, leaf only · kit · edge · size:40x9x84 · mixed · set:CRY!,TEM,DUN,RUI,CLT · var:open,ruin · aff:pass,open,block,los · kit · P1 · hangs in `wall-doorway--crypt-stone`; a leaf like `door-plank--leaf`, hinged by the engine
- **floor-tomb-slabs** — dark worn tomb paving with a few carved grave ledgers set among plain slabs · kit · 1 · size:60x60x1 · stone · set:CRY!,TEM,RUI · var:- · aff:- · flat · P1 · burial vaults and chapels of rest; the ledgers carry carved borders and symbols, never letters
- **decal-bones-scatter** — a few loose bones and a skull lying on the floor, seen from above · floor · sub · size:36x30x0.5~0.6-1.6 · organic · set:CRY,DUN,LAI,RUI · var:shape · aff:- · flat · P1 · loose bones are flat on purpose (thin meshes break); scattered thinly in ossuaries and catacombs
- **decal-grave-ledger** — carved grave ledger stone set flush in the floor, seen from above · floor · 1x2 · size:36x84x0.5~0.8-1.2 · stone · set:CRY,TEM,RUI · var:shape · aff:- · flat · P2 · laid in rows in a vault floor or one before an altar; carved border and emblem, no letters

## K5. Tombs, open states and funerary focal pieces (crypt, 2026-10-05)

- **sarcophagus-open** — stone sarcophagus with its lid slid aside or lifted off, empty · floor · 1x2 · open_of:sarcophagus · size:52x88x40~0.9-1.3 · stone · set:CRY,TEM,RUI · var:shape · aff:loot,open,cover,hide · mesh · P1 · open state of sarcophagus; robbed, or something climbed out
- **coffin-open** — wooden coffin with its lid lying half off, empty · floor · 1x2 · open_of:coffin · size:40x76x18 · wood · set:CRY,TEM · var:shape · aff:loot,open,hide · mesh · P1 · open state of coffin
- **monument-urn-draped** — funerary monument: a big cloth-draped stone urn on a square carved pedestal · floor · 1 · size:30x30x78 · stone · set:CRY!,TEM,NOB,RUI · var:ruin · aff:block,cover · mesh · P1 · antechamber focus; the figure-free mourning monument
- **embalming-table** — stone embalming table with a raised rim, drain channels and a spout, empty · floor · 1x2 · size:34x84x34 · stone · set:CRY!,TEM,CLT,DUN · var:- · aff:use · mesh · P1 · embalming room focus; `rite-corpse-on-slab` is the same table occupied
- **ossuary-shrine** — bone shrine: a stepped stone altar under an arched back wall built of skulls and long bones · wall · 1x2 · size:72x30x84 · organic · set:CRY!,CLT · var:- · aff:block,los,use · mesh · P1 · ossuary focus, centred on the wall facing the door
- **reliquary-shrine** — house-shaped gilded reliquary chest with a gabled roof, on a carved stone table base · floor · 1 · size:44x28x62 · mixed · set:CRY!,TEM,CAS · var:- · aff:loot,use · mesh · P1 · relic chamber focus
- **ossuary-pillar** — square pier faced on all four sides with stacked skulls between bands of long bones · floor · sub · size:24x24x108 · organic · set:CRY!,CLT · var:- · aff:block,los,cover · mesh · P1 · ossuary supports; stands where a `pillar-square` would
- **charnel-trough** — long stone trough heaped with bones and skulls · floor · 1x2 · size:66x28x26 · mixed · set:CRY!,CLT,DUN · var:- · aff:cover,loot · mesh · P1 · along ossuary walls; the bones are one solid heap
- **bench-stone** — heavy stone bench on two carved block legs · floor · 1 · size:66x20x19 · stone · set:CRY,TEM,RUI,CAS,NOB,CLT · var:shape,ruin · aff:sit · mesh · P1 · mourners' seats; antechamber walls and chapel rows
- **censer-hanging** — bronze censer hanging on three thick chain rods from a ceiling ring · ceiling · tiny · size:10x10x30 · metal · set:TEM,CRY,CLT · var:- · aff:- · thin · P2 · over an altar or bier; chain drawn as thick rods; the engine may add smoke
- **natron-tub** — low stone tub heaped with white embalming salt, a wooden scoop set in it · floor · sub · size:34x34x22 · mixed · set:CRY!,CLT · var:- · aff:use · mesh · P2 · beside the embalming table
- **linen-wrappings-basket** — basket of rolled linen wrappings · floor · sub · size:20x20x16 · organic · set:CRY,TEM · var:- · aff:carry · mesh · P3 · embalming room; under a table or on a shelf
