# India rooms: the IND culture pack (2026-11-06, cultures-a)

The India type in the Build tray (Regional → India): six rooms of 18th-century Jaipur-Amber, Rajasthan: a Hindu merchant's haveli courtyard and household kitchen, a Rajput palace hall, a Shiva temple's pillared hall, a grain-and-spice merchant's bazaar shop, a stepwell. Each room is one line of the culture skeleton (`tools/spawn-tuner/js/solver2.js`, the `ca:` and `ind:` blocks; `experiments/2026-11-06-cultures-a/integration/`). The courtyard and the stepwell are outdoor rooms. Nandi, the sanctum doorway and the temple bell are placed only by the temple hall; the tulsi only by the courtyard.

### ind-room-haveli P1
- anchor: ind-tulsi
- furnish: ind-charpai, ind-jhula
- store: ind-water-pots
- dress: decal-mandana

### ind-room-durbar P1
- anchor: ind-gaddi-throne
- furnish: ind-floor-seating
- light: ind-lamp-stand
- dress: rug-ind-durrie

### ind-room-mandapa P1
- anchor: ind-sanctum-door, ind-nandi
- furnish: ind-temple-pillar, ind-temple-bell
- light: ind-lamp-stand
- dress: decal-mandana

### ind-room-bazaar P1
- anchor: ind-merchant-seat
- furnish: ind-grain-baskets
- store: ind-brass-pots, ind-grain-jars
- light: ind-lamp-stand

### ind-room-stepwell P1
- anchor: ind-stepwell
- furnish: ind-chhatri
- store: ind-water-pots

### ind-room-kitchen P1
- anchor: ind-chulha
- furnish: ind-grinding-stone, ind-niche-shelf
- store: ind-grain-jars, ind-water-pots, ind-brass-pots
- light: ind-lamp-stand
