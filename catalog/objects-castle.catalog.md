# Castle gaps — the castle type (2026-10-05)

Objects the castle rooms (`catalog/rooms-castle.md`, batch `experiments/2026-10-05-castle-crypt-mansion/castle/`) want and the catalog lacked. Harry asked for castle, crypt and mansion types on 2026-10-05. Almost everything a castle wants already had a line (throne, dais, fireplace-grand, table-feast, weapon-rack, armor-stand, the `mil-` set, cell-bars, rack-torture, iron-maiden, portcullis, windlass, pew, lectern, font-holy) and only lacked a mesh: those are specified in the batch's `build_spec.py` under their existing ids. The lines here are the open twins, the courtyard's edge turret, three new pieces and three floors.

**Status (2026-10-05): specified, not yet generated.** The castle's own wall style is a new kit family, `castle-rough` (rough castle stone, big uneven blocks, wide mortar joints): `wall-straight--castle-rough` (two versions), `wall-window-small--castle-rough` (an arrow slit: the family's window), `wall-doorway--castle-rough`, plus `portcullis--castle-rough` (a gate arch two cells wide, with its raised twin) and `city-wall--castle-rough` (the courtyard's battlemented curtain wall). The fine rooms (great hall, throne room, chapel) reuse the existing `dressed-stone` family. Religious pieces for the castle chapel are specified under generic ids (`pew`, `lectern`, `font-holy`, `prayer-candle-rack`, `candelabra-standing`); `altar-stone`, `reliquary`, `bones-pile`, `skull-pile`, `chest-treasure` and `brazier-standing` come from the crypt batch.

## A10. Castle structure (castle, 2026-10-05)

- **portcullis-raised** — gate arch with the portcullis drawn up, only its spiked foot showing in the arch head · kit · edge · open_of:portcullis · size:120x24x108 · mixed · set:CAS,DUN · var:- · aff:pass,open · kit · P2 · open state of portcullis; the passage is clear
- **door-cell-bars-open** — cell front with its barred door swung open · kit · edge · open_of:door-cell-bars · size:60x36x108 · metal · set:DUN,CAS · var:- · aff:pass,open · kit · P1 · open state of door-cell-bars; the prisoner is gone
- **city-wall-turret** — square battlemented corner turret of a curtain wall · kit · edge · size:48x48x156 · stone · set:CAS!,MKT,RUI · var:ruin · aff:block,los,cover · kit · P2 · stands where a city-wall run ends or turns, a little taller than the wall
- **floor-flagstone-rushes** — worn hall flagstones strewn with fresh rushes and herbs · kit · 1 · size:60x60x1 · stone · set:CAS!,TAV,TEM · var:- · aff:- · flat · P1 · great halls and barracks; the stone shows through the rushes
- **floor-setts-courtyard** — big worn courtyard setts with muddy joints and a little straw · ground · 1 · size:60x60x2 · stone · set:CAS!,MKT,TAV · var:- · aff:- · flat · P1 · the castle courtyard's default ground
- **floor-sand-training** — raked, trampled sand and earth of a training ground · ground · 1 · size:60x60x1 · organic · set:CAS!,CMP,MKT · var:- · aff:- · flat · P2 · training yards and tilt yards; scuffed with footprints

## B6. Castle fixtures (castle, 2026-10-05)

- **cauldron-crane** — great cauldron hung from a free-standing timber crane over a low hearth · floor · 1 · size:66x44x84 · mixed · set:CAS!,CMP,TAV,MIN · var:lit · aff:lit,use,hazard · mesh · P2 · the middle of a castle kitchen, or the courtyard on a feast day; generated unlit, engine fire FX adds the fire

## J3. Castle dungeon (castle, 2026-10-05)

- **iron-maiden-open** — iron maiden with both doors open, empty, spikes inside · floor · sub · open_of:iron-maiden · size:60x34x78 · metal · set:DUN · var:- · aff:hazard,hide · mesh · P2 · open state of iron-maiden
- **cell-bench-plank** — plank bed hung from the wall on two chains, thin mattress · wall · 1x2 · mount:18 · size:72x24x30 · mixed · set:DUN!,CAS,CLT · var:- · aff:sleep,sit · mesh · P2 · one in each cell, along the side wall
- **block-headsman** — headsman's block with an axe and a basket on a low plank platform · floor · 1 · size:48x40x34 · wood · set:DUN,CAS,MKT · var:- · aff:hazard · mesh · P3 · the far end of a dungeon, or the courtyard on a bad day

## I6. Barracks (castle, 2026-10-05)

- **mil-footlocker-open** — soldier's footlocker with its lid open, kit inside · floor · sub · open_of:mil-footlocker · size:30x20x28 · wood · set:CAS,CMP · var:- · aff:loot,open · mesh · P2 · open state of mil-footlocker; searched
