# Japan rooms: the JPN culture pack (2026-11-06, cultures-a)

The Japan type in the Build tray (Regional → Japan): seven rooms of a Kyoto townhouse, tea house and Shinto shrine of the late Edo period. Each room is one line of the culture skeleton (`tools/spawn-tuner/js/solver2.js`, the `ca:` and `jpn:` blocks; `experiments/2026-11-06-cultures-a/integration/`). The two outdoor rooms (the shrine approach, the tea garden) have no walls of their own. The shrine's pieces are placed only by the shrine rooms and the kamidana only by the dojo.

### jpn-room-house P1
- anchor: jpn-tokonoma, jpn-low-table
- furnish: jpn-zabuton, jpn-byobu, jpn-armour-chest
- store: jpn-tansu
- light: jpn-andon
- dress: jpn-tea-utensils

### jpn-room-teahouse P1
- anchor: jpn-tokonoma, jpn-ro-kama
- furnish: jpn-zabuton
- store: jpn-tansu
- light: jpn-andon
- dress: jpn-tea-utensils

### jpn-room-dojo P1
- anchor: jpn-kamidana
- furnish: jpn-bokken-rack, jpn-taiko, jpn-armour-chest
- light: jpn-andon

### jpn-room-shrine P1
- anchor: jpn-shinsen-altar, jpn-saisen-bako
- furnish: jpn-bell-rope, jpn-taiko
- light: jpn-andon

### jpn-room-shrine-court P1
- anchor: jpn-torii, jpn-chozuya
- furnish: jpn-toro, jpn-komainu, jpn-pine
- light: jpn-toro

### jpn-room-shop P1
- anchor: jpn-shop-platform
- furnish: jpn-shop-shelves, jpn-tansu
- store: jpn-sake-casks
- light: jpn-andon
- dress: jpn-sugidama

### jpn-room-garden P1
- anchor: jpn-tsukubai, jpn-toro
- furnish: jpn-maple, jpn-pine, fence-bamboo
- light: jpn-toro
- dress: decal-stepping-stones
