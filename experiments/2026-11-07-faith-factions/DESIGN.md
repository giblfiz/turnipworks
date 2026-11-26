# Faith factions: Christian, Buddhist, Hindu, Muslim (lane faith-factions, 2026-11-07)

Harry, 2026-11-07: "creating 'factions' for the real world religions (Christian, Buddhist, Hindu, Muslim) so people who want
to build historical have no problem... Right there next to spider cult." Four factions, peers of the thirteen fantasy
factions in the same faction menu (the Factions shelf, the ring's faction choices, the drag-out offer), each filled with
what that faith actually uses: NOT a forced fit to the fantasy slot list.

Sensitivity read: `codex exec`, text only, isolated folder, BEFORE any plate (SENSITIVITY-codex.txt, verbatim). All four
"OK WITH FIXES"; every fix is applied below (marked "fix:"). The first draft is in git history.

## How the faction system works (what these pieces plug into)

A faction is a set of pieces, one per SLOT role (`flavor-<role>`, sku `flavor-<role>--<faction>`). The temple rooms place
the slots at fixed jobs: `idol` = the focus on the end wall facing the door; `altarpiece` = on the altar; `censer` = a
floor light, a pair flanking the altar or the focus; `sculpture` = a second showpiece; `banner` = cloth on the side walls;
`relief` = a 34-in medallion on a wall; `sigil` = a flat emblem in the floor; `corbel` = carved brackets along the long
walls of a big hall under the beam. A slot a faction has no piece for stays EMPTY (never another faction's piece).

Rules for the four:
- A core slot the faith does not use is left deliberately empty (`omit`; a blank spacer on the shelf, no "missing" label).
- What the faith uses and no core slot fits gets its OWN role (`ownSlots`), shown only in the rows of the faiths that use it.
- Display names are the real names ("Mihrab", "Crucifix", "Buddha statue"), never "<faith> idol"; search never finds a
  faith piece by a fantasy slot word ("idol").
- NO text in any script on any piece. Symbols only where the faith uses a symbol (cross, dharma wheel, Om); ornament is
  geometric / floral / arabesque. Where real objects normally carry inscriptions (Mamluk mosque lamps, prayer wheels)
  the text-free version is an ADAPTATION and the docs say so.
- `reverent`: never dress the cult sanctum or the dark cathedral (sacrificial altars, cages, blood bowls, bones): the
  generator refuses, the picker disables, the faction change refuses; a building's cult rooms keep their own faction.
- fix: grouped together ("Historical faiths") on the shelf, in the non-sinister row of the picker, never among the
  sinister factions.
- fix: changing a hall's faction between rites (church, Buddhist hall, Hindu hall, prayer hall) REBUILDS that hall's
  layout (one undo step, pinned pieces kept); a change within the same rite still only swaps pieces.
- Each look is a named regional tradition, not a claim to represent the whole faith (docs say which).
- House style: heroic hand-painted tabletop miniature, judged at table distance. Unlit (the game adds light).

## Christian: Latin church, High Gothic, northern France / England, c. 1250-1400
Serves medieval western European builds; not Eastern Christianity, not an early-crusade church (fix). The generic temple
rooms already are a church; the Christian rite changes: NO confessionals (fix: 16th century on), BENCHES instead of pews
(fix), an altar cloth, the stoup by the door stays and the baptismal font joins it (fix: a font does not replace a stoup),
the labyrinth in the NAVE floor at the door end, large (fix), the Virgin in a devotional place: against a side wall near
the altar end with a candle stand before her (fix).
- idol -> **Crucifix**: tall carved oak crucifix on a stepped stone base, the corpus painted (loincloth, head inclined, serene,
  no blood), trefoil arm ends; no titulus plaque (no INRI). Behind the altar: the altar stays the focus. 48x30x108.
- altarpiece -> **Altar cross and candlesticks**: gilt brass cross on a stepped foot between two pricket candlesticks. 30x10x30.
- sculpture -> **Virgin and Child**: polychrome painted wooden statue on a carved plinth. 30x24x84.
- censer -> **Pricket candlestick**: tall wrought-iron and brass floor candlestick, thick unlit candle. 18x18x66.
- own `font` -> **Baptismal font**: octagonal carved limestone bowl on a pedestal, pointed oak cover. 36x36x54.
- own `stand` -> **Thurible on its stand**: brass thurible hanging from a wrought-iron stand. 18x18x54.
- banner (flat) -> **Processional banner**: red silk, gold cross, crossbar, tassels.
- relief (flat) -> **Cross roundel**: carved limestone roundel, a cross within a quatrefoil.
- sigil (flat) -> **Pavement labyrinth** (Chartres type), an optional French Gothic floor (fix: not a universal emblem).
- emblem: gold Latin cross on deep red. Omitted: corbel, pier, pillar.
- Not built (Harry): a rood beam / screen with the crucifix on it (codex suggestion).

## Buddhist: Tibetan monastery assembly hall (dukhang), c. 1400-1800
Coherent for prayer wheels, chorten, dharma wheel, offering table; not a default for all Buddhist history (fix). Distinct
from the China pack's Qing hall, which keeps its own Buddha.
- idol -> **Buddha statue**: gilt seated Shakyamuni, earth-touching gesture, on a double lotus throne, plain aureole;
  elevated on its throne (on the dais in a deep hall). 60x48x96.
- own `altar` -> **Offering table**: low red-lacquered table, seven brass offering bowls, two unlit butter lamps; before the
  Buddha in place of the stone altar. 60x24x36.
- altarpiece -> **Vajra and bell** (fix: replaces wheel-and-deer, a roofline ornament): the dorje and the drilbu handbell
  side by side on a small brocade cushion, on the offering table. 16x10x10.
- sculpture -> **Stupa**: a Bodhi-type chorten (jangchub chorten): four-stepped base, vase dome, harmika, thirteen-ring spire,
  parasol, moon-sun-and-drop finial (fix: one named type); kept clear all round for walking round it, never in a doorway.
  48x48x96.
- censer -> **Incense burner**: brass, domed pierced lid, on a tall stand. 20x20x48.
- own `wheel` -> **Prayer wheel**: tall standing wheel, copper drum embossed with lotus petals and ornament only (the mantra
  scroll is inside, unseen: an adaptation, fix), painted wooden frame; along the side walls with room to turn it. 30x30x72.
- own `mat` (flat) -> **Seating runner** (fix: replaces the generic khaden): a long low maroon cushion runner as in an
  assembly hall, in rows facing the Buddha.
- banner (flat) -> **Thangka of Shakyamuni** (fix: codex suggestion): a painted scroll in a brocade mount, the seated Buddha
  in the earth-touching gesture, no script anywhere.
- relief (flat) -> **Dharma wheel roundel**: gilt eight-spoked wheel on carved red wood (on walls only, fix).
- sigil (flat) -> **Lotus floor design**: ornamental eight-petalled lotus; no mandala, no syllables (fix).
- emblem: gold eight-spoked dharma wheel on maroon. Omitted: banner-as-cloth, corbel, pier, pillar. The hanging bell is
  dropped (fix: the handbell with the vajra is the Tibetan bell).

## Hindu: North Indian Nagara temple, central and western India, c. 950-1100 (Khajuraho / Solanki era)
Nagara is regional, not all Hindu temples (fix). A Ganesha sanctum: Ganesha is commonly invoked first (fix: not "worshipped
across every tradition", and not the principal deity of every temple).
- idol -> **Ganesha sanctum** (fix: the garbhagriha, not a towered pavilion): a small enclosed sandstone sanctum cell with a
  richly carved doorway and a short curved shikhara above; inside, through the doorway, a seated Ganesha murti of the
  central-Indian type: four arms (upper right an axe, upper left a noose, lower right his broken tusk, lower left a bowl of
  modakas toward which his trunk curves to his left), seated at ease, his mouse at his feet, garlanded with white jasmine
  (fix: no marigolds, an American flower). Off the end wall with a walk-round path when the hall allows (fix). 60x54x108.
- altarpiece (on a low stand before the sanctum: there is no altar) -> **Offering plate**: brass thali, an unlit clay diya,
  jasmine and lotus flowers, fruit, small bowls of kumkum and rice. 18x18x12.
- censer -> **Brass oil lamp** (fix: a plain standing dipa, not a Maharashtrian samai): tall stem on a round foot, a dish of
  five small spouts on top. 16x16x60.
- own `bell` -> **Temple bell**: brass bell (ghanta) on a chain, hung at the entrance. 14x14x36.
- own `gate` -> **Torana** (fix: a named local form): a free-standing kirti-torana of the Solanki type (Modhera, 11th c.): two
  carved pillars carrying a lintel, a cusped arch between them. Placed by hand. 96x24x120.
- relief (flat) -> **Om roundel**: Om only, accurately drawn, in a sandstone roundel; on walls, never underfoot (fix: the one
  explicit exception to "no script": it is the faith's symbol, Harry asked for it).
- sigil (flat) -> **Mandana** (fix: the central-Indian name; kolam is South Indian): a lotus floor design in white chalk on red
  ochre, before the sanctum but off the walking line.
- emblem: saffron Om on vermilion. Omitted: banner, sculpture, corbel, pier, pillar; no altar (open floor before the sanctum).

## Muslim: Mamluk Cairo, 1250-1517
A specific choice, not "the" historical Middle East (fix); the same period as the Middle East culture pack. Aniconic for
this setting (fix: not a claim that all historical Islamic art forbids figures).
- idol slot (the qibla-wall focus) -> **Mihrab**: tall marble prayer niche, pointed arch over a recessed semi-dome, polychrome
  marble inlay, slender columns; geometric and arabesque only, no inscription band. The wall it stands on is the room's qibla
  wall: the GM orients the room (fix: the qibla faces Mecca, not "the wall opposite the door"; the docs say so). 72x24x120.
- censer -> **Mosque candlestick**: tall Mamluk brass candlestick, inlaid geometric bands, thick unlit candle; a pair flanks the
  mihrab. 18x18x54.
- own `pulpit` -> **Minbar** (fix: canopy referenced): carved wooden pulpit as the minbar of Sultan Qaytbay (c. 1470): a
  straight flight of steps between triangular side panels of geometric star-pattern inlay, a doorway at the foot, at the top
  a small open pavilion of four posts carrying a bulb-shaped wooden cupola. To the WORSHIPPER'S RIGHT facing the mihrab (fix);
  only in a hall wide enough (fix: optional in small prayer spaces). 30x96x106.
- own `lamp` -> **Mosque lamp**: enamelled glass lamp (flared neck, round body, foot, small handles, chains to a ceiling ring),
  blue, red and gold geometric and floral bands; an adaptation, real Mamluk lamps carry inscriptions (fix). Hung in rows. 14x14x36.
- own `stand` -> **Rehal**: folding X-shaped Qur'an stand, geometric inlay, open and empty. 12x16x14.
- own `font` -> **Ablution fountain** (fix: missing piece): an octagonal marble basin with small spouts round it, as in a mosque
  courtyard; placed by hand, never on the prayer floor. 48x48x40.
- corbel -> **Muqarnas corbel**: carved stone bracket of stepped muqarnas cells. 24x24x30.
- own `mat` (flat) -> **Prayer carpet** (fix: not identical niche rugs): a Mamluk carpet runner (Cairo, late 15th c.):
  octagon medallions in red, green and blue; in rows facing the mihrab, clear rows, nothing else on them.
- relief (flat) -> **Geometric panel**: carved wooden panel of a ten-pointed star interlace.
- sigil (flat) -> **Marble floor inlay**: polychrome marble geometric star medallion (opus sectile).
- emblem: eight-pointed interlaced star, gold on deep green: a decorative mark for the picker, NOT a religious emblem (fix).
  **No crescent-and-star** (fix: corrected rationale): the combination predates Islam (Byzantine and Sasanian coins) and is not
  a symbol of the faith; its link with Islam is chiefly Ottoman and later, and many Muslims do not regard it as one.
- Omitted: altarpiece (no altar), banner, sculpture, pier, pillar.

## Halls (the generator's nave, cathedral and shrine) for the three non-church rites
- Buddhist hall: the Buddha on the end wall (on the dais in a deep hall), the offering table before him with the vajra and
  bell on it, incense burners flanking, the lotus before the table, seating runners in rows facing him with a centre aisle,
  prayer wheels along the side walls with turning room, the stupa at the door end clear all round, thangkas and roundels on
  the walls.
- Hindu hall: the Ganesha sanctum on the end wall (off it, with a walk-round path, when deep enough), the offering plate on
  its stand before it, brass lamps flanking, the mandana off the walking line, OPEN floor (no seats), the bell hung inside the
  door, Om roundels on the walls.
- Muslim prayer hall: the mihrab centred on the qibla wall, candlesticks flanking it, the minbar to its right (a hall 16 ft
  across or more), the rehal near the mihrab, prayer carpets in clear rows facing it, mosque lamps hung in rows over the rows,
  columns in a big hall, the marble inlay in the floor, geometric panels on the walls, muqarnas corbels under the beam. No
  altar, no seats, no fountain on the prayer floor.
- Every church fitting stays out of these halls: pews, organ, confessionals, choir stalls, holy-water font, kneeling desks,
  alms box, candle racks, pulpit, lectern.

## After the blind reads (Gemini via agy-run, unprimed, 2026-11-07)
Flats and emblems: all 16 clean (faith named, accurate, no text; the Muslim star read as a Rub el Hizb). Halls: all 12
name their faith; accurate; no problems. Pieces re-plated because of what the reads saw (v1 kept on disk, retired in
fth/qa/overrides.json with the reason):
- garbled pseudo-SCRIPT in fine ornament: the Tibetan incense burner's stem band, the Mamluk candlestick's arabesque
  roundels, the mihrab's inlaid border panels ("pseudo-Arabic calligraphy"), the prayer wheel's embossed drum. The v2s
  ask for a few BIG plain geometric shapes and say outright that the real object carries an inscription and this one
  deliberately has none.
- the rehal: v1's inlaid cradle read, in every prayer-hall still, as an open Qur'an with script on its pages (it passed
  its own plate check: only the room showed it). v2 plain walnut read text-free but structurally broken; v3 one solid
  chunky piece.
- form: the torana came out a cube (v2 near front-on, thin); the bell's mouth melted shut (v2 a clean solid bell); the
  muqarnas corbel read as broken stone (v2 three bold tiers; its only remaining flaw is an open back, which faces the wall).
