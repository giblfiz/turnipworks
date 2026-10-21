# Lighting and open fires — inn-02 (2026-10-02)

Added for the inn-02 batch. Harry: lights hanging from hooks look better on walls, and he wants a lot of them; open central fires are "just to play with". **Every object here is generated UNLIT**: dark unlit wicks, charred unlit torch heads, cold logs and grey ash, no flame, no glow, no baked light. The engine's fire FX (`fx-flame-small`, `fx-fire`) supplies flame and light at runtime; `aff:lit` marks where it attaches. Wall lights carry `mount:` = inches from the floor to the object's bottom edge. Variants (iron / brass / wood, common / fine) are SKUs, listed in `runs/inn-02/manifest.tsv`.

## E2. Lighting — wall-mounted (inn-02)

### Lanterns on brackets and hooks
- **lantern-wall-iron** — iron lantern on a wall bracket · wall · tiny · mount:66 · size:12x14x22 · metal · set:TAV,CAS,MKT,SMI,DUN,CRY,ARC,MIN · var:lit,wealth,shape · aff:lit · mesh · P1 · corridors and porches; generated unlit, engine fire FX adds the flame
- **lantern-wall-brass** — brass lantern on a wall bracket · wall · tiny · mount:66 · size:12x14x22 · metal · set:NOB,TAV,CAS,SMI · var:lit,wealth · aff:lit · mesh · P1 · the better inn's hallway; generated unlit, engine fire FX adds the flame
- **lantern-wall-horn** — horn-paned lantern on a wooden wall arm · wall · tiny · mount:66 · size:10x14x20 · mixed · set:HUT,TAV,MKT,MIN · var:lit · aff:lit · mesh · P2 · cheap medieval light; generated unlit, engine fire FX adds the flame
- **lantern-pierced-tin** — pierced-tin candle lantern on a wall hook · wall · tiny · mount:60 · size:7x9x16 · metal · set:HUT,TAV,MKT · var:lit,shape · aff:lit · mesh · P1 · stables and back stairs; generated unlit, engine fire FX adds the flame

### Candle sconces
- **sconce-candle-single** — single candle wall sconce · wall · tiny · mount:54 · size:5x6x12 · mixed · set:ANY · var:lit,wealth,shape · aff:lit · mesh · P1 · bedrooms and landings; generated unlit (dark wick), engine fire FX adds the flame
- **sconce-candle-double** — two-candle wall sconce · wall · tiny · mount:54 · size:12x6x14 · metal · set:TAV,HUT,CAS · var:lit,shape · aff:lit · mesh · P1 · common-room walls; generated unlit (dark wicks), engine fire FX adds the flames
- **sconce-candle-triple** — three-arm candle wall sconce · wall · tiny · mount:54 · size:16x7x16 · metal · set:NOB,TAV,TEM,CAS · var:lit,wealth · aff:lit · mesh · P1 · fine rooms and chapels; generated unlit (dark wicks), engine fire FX adds the flames
- **sconce-reflector** — candle sconce with a reflector plate · wall · tiny · mount:54 · size:8x6x16 · metal · set:TAV,NOB,HUT · var:lit,wealth · aff:lit · mesh · P1 · throws light back into the room; generated unlit, engine fire FX adds the flame
- **candle-box-sconce** — wooden candle-box wall sconce · wall · tiny · mount:54 · size:7x6x14 · wood · set:HUT,TAV · var:lit,shape · aff:lit · mesh · P2 · cottage and back-room walls; generated unlit, engine fire FX adds the flame
- **rushlight-holder-wall** — rushlight nip on a wooden wall block · wall · tiny · mount:54 · size:5x6x10 · mixed · set:HUT!,TAV · var:lit,shape · aff:lit · mesh · P2 · the poorest light; generated unlit, engine fire FX adds the flame

### Torches, lamps and cressets
- **torch-bracket-rough** — torch in a rough iron wall bracket · wall · tiny · mount:54 · size:8x12x26 · mixed · set:DUN!,MIN,CAS,TAV,CRY,SMI,LAI · var:lit,shape · aff:lit · mesh · P1 · cellars, stables, dungeons; charred unlit torch head, engine fire FX adds the flame
- **torch-bracket-fine** — torch in a fine forged wall bracket · wall · tiny · mount:54 · size:8x12x28 · mixed · set:CAS,NOB,TEM,TAV · var:lit,wealth · aff:lit · mesh · P1 · halls and front rooms; charred unlit torch head, engine fire FX adds the flame
- **lamp-wall-shelf** — oil lamp on a small wall shelf · wall · tiny · mount:54 · size:10x7x10 · mixed · set:TAV,HUT,NOB · var:lit,wealth · aff:lit · mesh · P1 · bedrooms and the front desk; generated unlit, engine fire FX adds the flame
- **lamp-wall-bracket** — oil lamp hanging from a wall bracket · wall · tiny · mount:60 · size:8x12x16 · metal · set:TAV,MKT,CAS,NOB · var:lit,wealth · aff:lit · mesh · P1 · kitchens and counters; generated unlit, engine fire FX adds the flame
- **cresset-wall** — iron fire basket on a wall bracket · wall · tiny · mount:60 · size:14x16x20 · metal · set:CAS,DUN,TEM,TAV · var:lit,shape · aff:lit,hazard · mesh · P2 · yards and great halls; cold charred wood, no fire, engine fire FX adds it

## E3. Lighting — floor and table (inn-02)

- **candle-tree** — floor-standing candle tree (candelabrum) · floor · sub · size:24x24x66 · metal · set:TAV,NOB,TEM,CAS,CRY,ARC,CLT · var:lit,wealth,shape · aff:lit · mesh · P1 · common-room corners, chapels; dark unlit wicks, engine fire FX adds the flames
- **torch-stand** — standing torch stand · floor · sub · size:18x18x60 · mixed · set:CAS,TEM,DUN,CMP,TAV,CRY · var:lit,shape · aff:lit · mesh · P1 · doorways, yards, halls; charred unlit torch head, engine fire FX adds the flame
- **brazier-tripod** — tripod brazier bowl · floor · sub · size:24x24x36 · metal · set:CAS,TEM,CMP,TAV,CLT,CRY,ARC · var:lit,wealth · aff:lit,hazard · mesh · P2 · warmth and ritual; cold charcoal and ash, no fire, engine fire FX adds it
- **fire-basket-stand** — iron fire basket on a stand · floor · sub · size:20x20x48 · metal · set:CAS,MKT,TAV,DUN · var:lit,shape · aff:lit,hazard · mesh · P2 · yards and gatehouses; cold split logs, no fire, engine fire FX adds it
- **lamp-oil-brass** — brass tabletop oil lamp · surface · tiny · size:7x4x6 · metal · set:NOB,TAV,TEM · var:lit,wealth · aff:lit,carry · mesh · P1 · desks and counters; generated unlit, engine fire FX adds the flame
- **lamp-pole** — floor-standing oil lamp on a pole · floor · sub · size:16x16x60 · metal · set:NOB,TAV,TEM · var:lit,wealth · aff:lit · mesh · P1 · reading corners, fine rooms; generated unlit, engine fire FX adds the flame
- **lantern-post-indoor** — lantern on a short indoor post · floor · sub · size:14x14x54 · mixed · set:TAV,HUT,NOB,ARC,MIN · var:lit,shape · aff:lit · mesh · P1 · hallway and stable-aisle light posts; generated unlit, engine fire FX adds the flame
- **candlestand-pricket** — large church-style pricket candlestand · floor · sub · size:20x20x60 · metal · set:TEM!,NOB,CAS,TAV,CRY,ARC,CLT · var:lit,wealth · aff:lit · mesh · P1 · flanking a hearth or an altar; dark unlit candles, engine fire FX adds the flames
- **candlestick-floor** — tall single floor candlestick · floor · sub · size:12x12x48 · mixed · set:TEM,NOB,TAV,CRY,ARC,CLT · var:lit,shape · aff:lit · mesh · P1 · bedsides in fine rooms; dark unlit wick, engine fire FX adds the flame

## B2. Open central fires (inn-02)

- **firepit-stone-round** — round stone fire pit · floor · 1 · size:48x48x14~0.7-1.5 · stone · set:HUT,TAV,CMP,MIN,LAI · var:lit,shape · aff:lit,hazard · mesh · P2 · centre of a hall or yard; logs and grey ash, no fire, engine fire FX adds it
- **hearth-raised-square** — square raised stone hearth · floor · 2x2 · size:60x60x18 · stone · set:TAV,HUT,CAS,MIN · var:lit · aff:lit,hazard · mesh · P2 · longhouse-style common rooms; logs and grey ash, no fire, engine fire FX adds it
- **firepit-sunken** — sunken fire pit with a stone kerb · floor · 2x2 · size:60x60x8 · stone · set:TAV,HUT,CAS,CLT · var:lit · aff:lit,hazard · mesh · P2 · old halls; logs and grey ash, no fire, engine fire FX adds it
- **fire-ring-iron** — iron fire ring · floor · 1 · size:40x40x14 · metal · set:CMP,TAV,HUT · var:lit · aff:lit,hazard · mesh · P2 · yards and camps; logs and grey ash, no fire, engine fire FX adds it
- **hearth-central-hood** — central hearth under a hanging smoke hood · floor · 2x2 · size:72x72x110 · mixed · set:TAV,CAS,HUT,MIN · var:lit · aff:lit,hazard · mesh · P2 · a hall's centrepiece; logs and grey ash, no fire, engine fire FX adds it
- **firepit-log-spit** — log-ringed fire pit with a spit · floor · 1x2 · size:48x60x40 · mixed · set:TAV,CMP,HUT · var:lit · aff:lit,hazard,use · mesh · P2 · yards, camps, feast nights; empty spit, cold logs and ash, engine fire FX adds the fire
