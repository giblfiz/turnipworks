# Culture packs A: Japan, China, India (2026-11-06, lane cultures-a)

Harry: "cultures meaning Japan/China/middle East/mezo America/Russia/India/barbarian north asset packs ... The asset packs
probably don't need be huge." A culture = a building style (wall family + roof + floors + doors/windows) that reads from
the table camera, a few signature rooms, and ~25-35 new meshes; generic props (sacks, jars, crates) are reused only where
they carry no foreign meaning (the mine lesson: a borrowed prop brings its meaning with it).

Each culture is anchored on ONE period and region, so its pieces agree with each other:
- **Japan: Edo period (1603-1868)**, a townhouse / samurai house, a tea house, a Shinto shrine.
- **China: late Ming / Qing (16th-19th c.)**, a north-China courtyard house (siheyuan), a Buddhist temple hall.
- **India: Rajput / Mughal Rajasthan (16th-18th c.)**, a haveli, a palace hall, a Nagara Hindu temple, a stepwell.

Sacred spaces are worship spaces, shown as their communities keep them: the focal sacred piece at the axis, nothing
comic, nothing broken or looted, no sacred piece reused as dressing in a secular room (each culture's sacred meshes are
in its exclusive tier and named only by its sacred room). Hindu and Shinto sanctums are shown from the hall: the
sanctum door, the offerings and the lamps, not an image of the deity (the Shinto honden is never entered; the Hindu
murti is seen through the sanctum door, which we keep dim). The Chinese temple hall has a seated Buddha on a lotus
throne at its altar, as such halls do; it appears only there.

Tabletop reading rule (crypt/mine lessons): a room is named from above by ONE signature: tatami grid = Japan; the
tokonoma = a Japanese room; the torii = shrine. Small loud flats mislead; borrowed props carry meaning.

## Japan (JPN): 7 rooms
| key | room | role | walls | cells | signature from above |
|---|---|---|---|---|---|
| jpn-house | Tatami room (zashiki) | hub | jpn-shoji | 4x4 | tatami grid, the tokonoma alcove, a low table with cushions |
| jpn-teahouse | Tea house (chashitsu) | terminal | jpn-shoji | 3x3 | 4.5 mats, the sunken hearth and kettle, tea things, tokonoma |
| jpn-dojo | Dojo | terminal | jpn-shoji | 6x5 | an empty polished floor, the kamidana high on the far wall, wooden-sword racks, the drum |
| jpn-shrine | Shrine hall (haiden) | terminal | jpn-shrine (vermilion) | 5x4 | offering table with sakaki, the bell rope, the offering box, lion-dogs at the door |
| jpn-shrine-court | Shrine approach | outdoor | - | 6x6 | the torii, stone lanterns lining the path, the purification basin |
| jpn-shop | Merchant's shop (machiya) | hub | jpn-shoji | 4x4 | the raised counting desk with its lattice screen, sake casks, rice bales, shelves |
| jpn-garden | Garden | outdoor | - | 6x6 | raked gravel, a maple and a pine, a stone lantern, the stone basin, bamboo fence |

## China (CHN): 6 rooms
| key | room | role | walls | cells | signature |
|---|---|---|---|---|---|
| chn-hall | Courtyard-house hall (tang) | hub | chn-brick | 5x4 | long altar table on the back wall, square table between two armchairs, red lanterns |
| chn-teahouse | Tea house | hub | chn-brick | 5x5 | square tables with benches in rows, the tea counter with kettles, bird cages |
| chn-study | Scholar's study | terminal | chn-brick | 4x3 | painting table with brushes, bookcase of cased books, scholar's rock, potted landscape |
| chn-temple | Temple hall | terminal | chn-temple (red) | 6x5 | seated Buddha on its altar, the great incense burner, kneeling cushions, bell and drum |
| chn-market | Market street | outdoor | - | 7x4 | stalls under cloth awnings, steamer stacks, carrying poles, lanterns on poles |
| chn-courtyard | Courtyard | outdoor | - | 6x6 | the Taihu rock, the goldfish vat, a stone table with drum stools, trees in tubs |

## India (IND): 6 rooms
| key | room | role | walls | cells | signature |
|---|---|---|---|---|---|
| ind-haveli | Haveli courtyard | outdoor (walled by the house) | - | 5x5 | the tulsi planter in the middle, a charpai, a swing, water pots |
| ind-durbar | Palace hall (durbar) | terminal | ind-sandstone | 6x5 | the canopied gaddi throne with bolsters on a dais, floor seating along the walls, lamp stands |
| ind-mandapa | Temple hall (mandapa) | terminal | ind-sandstone | 6x5 | grid of carved pillars, the sanctum doorway, Nandi facing it, bells and lamps |
| ind-bazaar | Bazaar shop | hub | ind-lime | 4x4 | sacks of spice heaped in cones, the merchant's seat with bolster, brass pots |
| ind-stepwell | Stepwell | outdoor | - | 7x7 | the stepped tank, pavilions (chhatri) at its corners, water pots |
| ind-kitchen | Spice kitchen | terminal | ind-lime | 4x3 | the clay chulha stove, niche shelves of brass and copper, grinding stone, jars |

## Building style per culture
| | walls | doors | windows | floor | roof |
|---|---|---|---|---|---|
| Japan | `jpn-shoji`: dark cedar posts and rail, white shoji lattice / plaster; `jpn-shrine`: vermilion posts, white plaster | shoji-lattice leaf | lattice window | tatami; cedar boards; raked gravel | `kawara` grey clay tile |
| China | `chn-brick`: grey brick between red lacquered columns, painted beam band; `chn-temple`: red plaster, red columns | red lacquered panel leaf | lattice window | grey square brick | `glazed` green glazed tile |
| India | `ind-sandstone`: red sandstone, cusped-arch panels; `ind-lime`: whitewashed lime with painted borders | carved wooden leaf | jali (pierced stone screen) | red sandstone slabs | flat lime terrace (existing `plaster`, parapet) |

Every mesh list and prompt is in `build_spec.py`; the reads in `ROOM_READS.md`; the run log in `LAB_NOTES.md`.
