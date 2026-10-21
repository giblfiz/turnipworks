# Mansion gaps — the noble house (2026-10-05)

Objects the mansion room types (`catalog/rooms-mansion.md`, batch `experiments/2026-10-05-castle-crypt-mansion/mansion/`) want and the catalog lacked. Harry, 2026-10-05: "make me castle, crypt and mansion types". Most of what a mansion wants already had a line (`out/by-setting/nob-aristocrat-manor.txt`: canopy bed, daybed, bookshelf, feast table, grand chandelier, courtyard fountain, topiary, busts, urns, silver) and only lacked a mesh; those are specified in the batch's `build_spec.py` under their existing ids. The lines here are the roles that did not exist at all.

The mansion's two new wall families (`noble-panel`: dark oak wainscot under plaster; `noble-paper`: wallpaper over a painted dado) and its glasshouse family (`conservatory`) are skus of the existing kit roles `wall-straight`, `wall-window-small`, `wall-window-small-open` and `wall-doorway`, so they need no line. Furniture that is a noble grade of an existing role (dining chairs, armchairs, footstool, vanity) is a `--fine` sku of that role, not a new line.

**Status (2026-10-05): specified, not generated.**

## A9. Noble structure (mansion, 2026-10-05)

- **door-panelled** — six-panel polished door leaf with a brass knob · kit · edge · size:36x3x84 · wood · set:NOB!,TAV,MKT,ARC · var:open · aff:pass,open · kit · P1 · the mansion's room door; leaf only, it rotates to open
- **door-glazed** — glazed garden door leaf, panes over a panelled base · kit · edge · size:36x3x84 · mixed · set:NOB!,GRV · var:open · aff:pass,open · kit · P2 · conservatory and garden doors; leaf only
- **balustrade-stone-pier** — square stone balustrade pier with a ball finial · kit · edge · size:14x14x46 · stone · set:NOB,CAS,TEM · var:ruin · aff:cover · kit · P3 · ends a balustrade run and stands at its corners
- **floor-marble-cabochon** — pale veined marble slabs with small dark corner squares · kit · 1 · size:60x60x1 · stone · set:NOB!,TEM · var:- · aff:- · flat · P2 · entrance halls and ballrooms
- **floor-parquet-versailles** — panel parquet of interlaced squares in two woods · kit · 1 · size:60x60x1 · wood · set:NOB! · var:- · aff:- · flat · P2 · ballrooms and drawing rooms
- **floor-tile-encaustic** — geometric terracotta, cream and black patterned tiles · kit · 1 · size:60x60x1 · ceramic · set:NOB!,TEM,MKT,ARC · var:- · aff:- · flat · P2 · conservatories and garden halls
- **floor-lawn-mown** — close-mown formal lawn in light and dark stripes · ground · 1 · size:60x60x1 · organic · set:NOB!,GRV · var:- · aff:- · flat · P2 · the formal garden's ground

## B6. Noble hearth (mansion, 2026-10-05)

- **fireplace-marble** — carved marble chimneypiece with a gilt overmantel mirror · wall · 1x2 · size:72x24x108 · stone · set:NOB! · var:shape,lit · aff:lit,use · mesh · P1 · the drawing room's focal wall; generated unlit and empty, engine fire FX adds the fire

## C8. Noble furniture (mansion, 2026-10-05)

- **sofa** — three-seat upholstered sofa with a carved frame · floor · 1x2 · size:84x34x38 · mixed · set:NOB!,TAV · var:ruin · aff:sit · mesh · P1 · the drawing room's seat; first piece of the burgundy suite
- **settee** — two-seat upholstered settee · floor · 1 · size:56x30x38 · mixed · set:NOB!,TAV · var:ruin · aff:sit · mesh · P2 · faces the sofa across the hearth rug
- **stool-upholstered** — low upholstered stool on turned legs · floor · tiny · size:22x16x19 · mixed · set:NOB,TAV · var:- · aff:sit · mesh · P3 · at the harpsichord, the vanity, the harp
- **bench-upholstered** — long backless upholstered bench · floor · 1 · size:60x18x19 · mixed · set:NOB!,TEM · var:shape · aff:sit · mesh · P1 · along ballroom and hall walls; at the foot of the state bed
- **chair-salon-gilt** — light cream-and-gilt side chair with a silk seat · floor · sub · size:20x20x38 · mixed · set:NOB! · var:shape · aff:sit · mesh · P2 · rows along the ballroom walls; drawing-room occasional chairs
- **table-pedestal-round** — big round table on one carved pedestal · floor · 1 · size:54x54x30 · wood · set:NOB!,ARC · var:- · aff:cover,use · mesh · P1 · the centre of the entrance hall, under the chandelier, with a vase on it
- **table-console** — marble-topped wall table on scrolled legs · wall · 1 · size:48x18x34 · mixed · set:NOB! · var:- · aff:use · mesh · P1 · under a pier mirror in halls and ballrooms
- **table-card** — square baize-topped card table · floor · sub · size:36x36x29 · wood · set:NOB,TAV · var:- · aff:use · mesh · P2 · drawing rooms; four chairs round it
- **table-games** — small table with an inlaid chequer board and chunky pieces · floor · sub · size:30x30x29 · wood · set:NOB,ARC,TAV · var:- · aff:use · mesh · P2 · by a window, two chairs
- **table-billiards** — billiard table with green baize, balls and two cues on it · floor · 1x2 · size:60x108x33 · mixed · set:NOB! · var:- · aff:cover,use · mesh · P2 · big drawing rooms and libraries; needs walking room all round
- **table-library** — long library table with a leather top · floor · 1x2 · size:84x40x30 · wood · set:NOB,ARC,CLT · var:- · aff:cover,use · mesh · P2 · the middle of a library; books and a globe on and by it
- **desk-partners** — big pedestal desk with a leather top · floor · 1x2 · size:66x36x31 · wood · set:NOB!,ARC,MKT · var:- · aff:use,loot,cover · mesh · P2 · the study's command position
- **desk-bureau** — fall-front writing bureau, closed · wall · 1 · size:38x20x44 · wood · set:NOB,ARC,TAV · var:open · aff:use,loot,open · mesh · P2 · drawing rooms and bedchambers
- **desk-bureau-open** — writing bureau with its fall front down, pigeonholes showing · wall · 1 · open_of:desk-bureau · size:38x34x44 · wood · set:NOB,ARC,TAV · var:- · aff:use,loot,open · mesh · P2 · open state of desk-bureau
- **sideboard** — long dining-room sideboard with cupboard doors · wall · 1x2 · size:72x22x38 · wood · set:NOB!,TAV · var:open · aff:loot,open,use · mesh · P2 · the dining room's serving wall; silver stands on it
- **sideboard-open** — sideboard with its cupboard doors open, empty · wall · 1x2 · open_of:sideboard · size:72x40x38 · wood · set:NOB!,TAV · var:- · aff:loot,open · mesh · P2 · open state of sideboard
- **cabinet-china** — tall display cabinet with paned doors over china · wall · 1 · size:44x16x84 · wood · set:NOB!,MKT · var:open · aff:loot,open · mesh · P2 · dining and drawing rooms
- **cabinet-china-open** — display cabinet with its doors open, china on the shelves · wall · 1 · open_of:cabinet-china · size:44x34x84 · wood · set:NOB!,MKT · var:- · aff:loot,open · mesh · P2 · open state of cabinet-china
- **commode** — bow-fronted chest of drawers · wall · 1 · size:44x22x36 · wood · set:NOB,TAV · var:- · aff:loot · mesh · P2 · bedchambers and dressing rooms
- **hall-stand** — coat and stick stand with a small mirror · wall · sub · size:30x14x78 · wood · set:NOB,TAV · var:- · aff:- · mesh · P3 · by the front door
- **library-steps** — short flight of library steps with a post · floor · tiny · size:20x24x34 · wood · set:NOB,ARC · var:- · aff:climb · mesh · P3 · in front of a bookcase
- **bookcase-ladder** — double-width tall bookcase with a rolling ladder on a rail · wall · 1x2 · size:96x30x108 · wood · set:NOB!,ARC,CLT · var:- · aff:climb,loot,los · mesh · P1 · the library's focal wall
- **harpsichord** — wing-shaped harpsichord on a turned stand, lid closed · floor · 1x2 · size:36x92x36 · wood · set:NOB! · var:ruin · aff:use · mesh · P1 · the ballroom's and music room's focal piece
- **clock-longcase** — tall longcase clock · wall · sub · size:20x12x84 · wood · set:NOB!,TAV,MKT · var:- · aff:hide · mesh · P2 · halls and landings; the dial has no numerals
- **clock-mantel** — small mantel clock · surface · tiny · size:12x6x14 · mixed · set:NOB,TAV · var:- · aff:carry · mesh · P3 · on a mantel or a commode
- **fire-screen** — embroidered fire screen on two feet · floor · tiny · size:30x10x36 · mixed · set:NOB · var:- · aff:- · mesh · P3 · in front of a drawing-room hearth
- **wine-bin-arched** — brick wine bins: three arched pigeonholes of laid bottles · wall · 1 · size:60x24x54 · stone · set:NOB!,TAV,CAS · var:- · aff:loot · mesh · P2 · the wine cellar's walls

## E6. Noble lighting and mirrors (mansion, 2026-10-05)

- **mirror-pier-gilt** — tall gilt-framed pier mirror · wall · sub · mount:36 · size:36x5x78 · mixed · set:NOB! · var:- · aff:- · mesh · P1 · between ballroom windows and over console tables; hangs on the wall
- **bell-board-servants** — board of servants' call bells on coiled springs · wall · sub · mount:72 · size:40x6x16 · mixed · set:NOB! · var:- · aff:use · mesh · P3 · high on the servants' kitchen wall; hangs on the wall

## F9. Noble table pieces (mansion, 2026-10-05)

- **centerpiece-epergne** — silver table centrepiece stand piled with fruit · surface · tiny · size:16x16x20 · mixed · set:NOB! · var:- · aff:carry,loot · mesh · P3 · the middle of the dining table
- **tea-service-tray** — tray with a teapot, cups and a plate of cakes · surface · tiny · size:20x14x9 · mixed · set:NOB,TAV · var:- · aff:carry · mesh · P3 · drawing-room tables

## L3. Noble decor (mansion, 2026-10-05)

- **painting-still-life** — framed still life of fruit and flowers · wall · sub · size:36x2x30~0.6-1.8 · mixed · set:NOB,TAV · var:shape · aff:- · flat · P2 · dining rooms and halls

## M3. Formal garden and conservatory (mansion, 2026-10-05)

- **gazebo** — small open garden pavilion: stout columns under a domed roof · ground · 3x3 · size:132x132x156 · mixed · set:NOB!,GRV,MKT · var:ruin · aff:cover · mesh · P1 · the far end of the formal garden's axis
- **statue-garden** — weathered classical garden statue on a plinth · ground · 1 · size:30x30x90 · stone · set:NOB!,GRV,RUI · var:shape,ruin · aff:cover,los · mesh · P1 · at the ends of garden walks and in hedge niches
- **urn-garden** — stone garden urn on a pedestal, planted with flowers · ground · sub · size:26x26x54 · stone · set:NOB!,GRV,SMI · var:shape · aff:cover · mesh · P2 · pairs at steps, gates and path crossings
- **bench-garden** — stone garden bench with a curved back · ground · 1 · size:66x24x36 · stone · set:NOB!,GRV,TEM,HUT · var:- · aff:sit · mesh · P2 · facing the fountain
- **sundial** — sundial on a carved stone baluster · ground · sub · size:20x20x42 · stone · set:NOB!,GRV · var:- · aff:- · mesh · P2 · the centre of a lawn or a path crossing; the dial has no numerals
- **birdbath** — shallow stone birdbath on a stem · ground · sub · size:24x24x34 · stone · set:NOB,GRV,HUT · var:- · aff:- · mesh · P3 · among the flowerbeds; generated dry
- **lily-pond** — low round stone-kerbed garden pool · ground · 2x2 · size:108x108x16 · stone · set:NOB!,GRV · var:- · aff:hazard · mesh · P2 · a second water feature; generated dry, the engine adds the water
- **bush-rose** — rose bush in bloom · ground · sub · size:36x36x42~0.7-1.3 · organic · set:NOB,HUT,GRV · var:shape · aff:- · mesh · P3 · formal beds and along paths
- **palm-potted** — potted palm in a big glazed pot · floor · sub · size:48x48x96~0.6-1.2 · mixed · set:NOB! · var:shape · aff:los · mesh · P1 · the conservatory's signature; hall and ballroom corners
- **fern-potted** — big fern in a pot on a short stand · floor · sub · size:30x30x44~0.7-1.3 · mixed · set:NOB,GRV,ARC · var:- · aff:- · mesh · P2 · conservatories, landings
- **citrus-tree-tub** — small orange tree in a square wooden tub · floor · sub · size:30x30x66~0.7-1.3 · mixed · set:NOB! · var:- · aff:- · mesh · P2 · conservatories and terraces
- **plant-stand-tiered** — stepped plant stand crowded with pots · floor · 1 · size:54x26x54 · mixed · set:NOB!,GRV,MKT · var:- · aff:cover · mesh · P1 · against the conservatory's glass
- **bench-potting** — potting bench with pots, a trug and a soil bin · wall · 1 · size:60x24x54 · mixed · set:NOB,HUT,GRV · var:- · aff:use · mesh · P2 · the conservatory's working corner
