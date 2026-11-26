You are a careful cultural-history and sensitivity reviewer for a browser tabletop role-playing game (Turnip Works). We are about to paint 49 small painted tabletop miniature figures (heroic hand-painted style, stout chunky proportions, about 1 inch tall on the table, seen from above at table distance) for seven culture packs. Each pack is anchored on ONE period and place (the same as its room pack). For each culture the GM asked for an armoured fighter, a rogue-like figure, a caster (rooted in that culture's own traditions of magic, priesthood or learning, treated respectfully) and 3-4 NPCs. Women are included among fighters and NPCs where the culture plausibly supports it, and we say where we lean into fantasy.

Technical constraints of the painting route (do not ask us to break them): no blue/teal/cyan on the figures (the background is a blue mask), no text or writing anywhere (generated script is gibberish), no thin loose parts (no feathers sticking out, no flowing capes, no strings), every figure stands still holding its things close to its body.

Below is the whole roster with each figure's design text (it becomes the image prompt). Please review it for:
1. CARICATURE or costume-stereotype risk (exoticising, "evil priest", orientalist tropes, sexualised tropes, a people reduced to one cliche).
2. SACRED or status dress worn wrongly, or sacred objects/practices made into game props in a way that would offend (e.g. a sacred thread on the wrong side, a ritual object misused, a restricted insignia on the wrong rank).
3. ANACHRONISM or wrong place: anything in the design that does not belong to the anchored period and place (be specific: what, why, what to use instead).
4. The CASTER choices: is each rooted respectfully in that culture's own tradition? Better choice?
5. The women: is each plausible for the period, and is the stated fantasy lean honest? Are there places where we should add or could not plausibly add a woman?
6. Anything else that would embarrass us in front of a member of that culture, a historian, or a player.

Answer as follows. First a short paragraph per culture. Then ONE JSON object at the end:
{"figures": {"<id>": {"verdict": "ok" | "change" | "replace", "severity": "none" | "minor" | "major", "issues": ["..."], "change_to": "<concrete replacement wording for the design, or empty>"}}, "roster": ["<roster-level notes>"]}
Include every id in the JSON. Be concrete: give replacement wording we can paste.

ROSTER:

### cul-jpn-samurai — Samurai, Japan (man; role: fighter) — anchored on late-Edo Kyoto, Japan, about 1850
A samurai in full Edo-period armour (tosei-gusoku): a lacquered cuirass of horizontal plates in deep burgundy laced with ochre cord, broad layered shoulder guards, a skirt of plates, armoured sleeves and shin guards over dark hakama trousers, straw sandals. A rounded helmet with a flared neck guard and a small plain brass crest-plate at the front (no symbol on it), the face open and clean-shaven face, topknot hidden under the helmet. Two swords in their dark scabbards thrust through the sash at the left hip. Both hands hold a straight YARI spear upright in front of the body, its pale ash shaft as thick as a wrist, its bright steel blade above the helmet.

### cul-jpn-shinobi — Shinobi, Japan (man; role: rogue) — anchored on late-Edo Kyoto, Japan, about 1850
A shinobi (a spy-agent) in practical rust-brown and charcoal-grey work clothes: a short jacket bound at the waist, narrow trousers wrapped at the shins, split-toe tabi socks and straw sandals, a hood-scarf wrapped over the head and lower face so only the eyes show. The RIGHT hand holds a short straight sword (a pale steel blade as broad as two fingers) upright beside the shoulder; the LEFT hand holds a coil of thick ochre rope against the hip. Plain, no symbols.
Lean (stated by us): The all-black ninja suit is a kabuki stage convention; this one wears working browns and greys, which is closer to what spies wore, but a hooded shinobi is still the legend more than the record.

### cul-jpn-onmyoji — Onmyoji, Japan (man; role: caster) — anchored on late-Edo Kyoto, Japan, about 1850
An onmyoji, a court diviner of the yin-yang way (the Tsuchimikado house still licensed them in Kyoto): a round-collared kariginu hunting robe of pale cream over plum-coloured sashinuki trousers gathered at the ankle, wide sleeves, black lacquered shoes, a tall black eboshi court hat. A calm, beardless older face. The RIGHT hand holds a closed cream folding fan upright in front of the chest; the LEFT forearm carries a square pale wooden divination board with a round disc set in it (plain, no marks on it). No talismans, no writing.

### cul-jpn-sake-merchant — Sake merchant, Japan (man; role: npc) — anchored on late-Edo Kyoto, Japan, about 1850
A Kyoto sake merchant: a plain brown-grey kimono with a short black haori jacket, a long dark-ochre maekake shop apron tied at the waist (no writing on it), white tabi socks and wooden geta clogs, the Edo townsman's shaved crown and small topknot. A broad friendly face. Both hands hold a big pale cream ceramic sake flask against the belly.

### cul-jpn-tea-house-keeper — Tea-house keeper, Japan (woman; role: npc) — anchored on late-Edo Kyoto, Japan, about 1850
The keeper of a Kyoto tea house, a middle-aged townswoman: a plain kimono in soft plum with a wide ochre obi sash tied at the back, a cream apron over it, white tabi socks and low geta clogs, her hair in a simple rounded bun held with one plain comb. A warm, capable face. Both hands hold a pale lacquered wooden tray with a cream teapot and two cups in front of her waist.

### cul-jpn-ohara-me — Ohara woman, Japan (woman; role: npc) — anchored on late-Edo Kyoto, Japan, about 1850
An Ohara-me, one of the village women who walked into Kyoto from Ohara to sell firewood: a work kimono in dark brown with a pale cream tie-dyed pattern, white cloth arm and shin covers, straw sandals, a cream cloth over her hair, and a big round BUNDLE of pale firewood sticks balanced flat on top of her head, both hands raised to steady it. A plain, cheerful country face.

### cul-jpn-doshin — Town constable, Japan (man; role: npc) — anchored on late-Edo Kyoto, Japan, about 1850
A doshin, a samurai constable of the Kyoto town magistrate: a sober dark-ochre kimono tucked up at the back, a black haori jacket, narrow trousers, white tabi and straw sandals, two swords at the left hip, the samurai's shaved crown and topknot. A stern, watchful face. The RIGHT hand holds a JITTE (a pale steel truncheon as thick as a thumb, one short side-hook) upright in front of the chest; the LEFT hand rests on the sword hilts.

### cul-chn-bannerman — Bannerman, China (man; role: fighter) — anchored on mid-Qing Beijing, China, about 1770 (the Qianlong reign)
A Manchu bannerman of the Eight Banners in Qing armour: a long coat of armour padded and studded all over with rows of round brass studs, in rich burgundy-red edged with black, reaching below the knees with split armoured skirts, big padded shoulder guards and arm guards, black boots; a round steel helmet with a tall spike and a padded neck guard. A clean-shaven face, the shaved forehead of the Qing. The RIGHT hand holds a broad curved DAO sabre (a wide bright steel blade) upright in front of the right shoulder; the LEFT arm holds a round woven rattan shield painted ochre, close in front of the left hip. No symbols on the shield.

### cul-chn-swordswoman — Wandering swordswoman, China (woman; role: rogue) — anchored on mid-Qing Beijing, China, about 1770 (the Qianlong reign)
A wandering swordswoman of the rivers and lakes (the xia of the storytellers): a short fitted jacket in moss green bound with a wide ochre sash, loose dark trousers tied at the ankle, soft black cloth shoes, her hair in a tight bun wrapped with a cream cloth, a broad-brimmed bamboo hat hanging at her back. A sharp, level gaze. The RIGHT hand holds a straight JIAN sword (a bright steel blade two fingers wide) upright beside the shoulder; the LEFT hand holds its pale wooden scabbard down at her hip.
Lean (stated by us): The wandering sword-hero is a figure of Qing fiction and storytelling, not of the Beijing record; she is the legend, dressed in plausible mid-Qing working clothes.

### cul-chn-daoist-priest — Daoist priest, China (man; role: caster) — anchored on mid-Qing Beijing, China, about 1770 (the Qianlong reign)
A Daoist priest (daoshi) of a Beijing temple: a long loose robe with wide sleeves in deep ochre-yellow over a cream under-robe, a plain burgundy collar band, white socks and black cloth shoes, his long hair gathered in a topknot on the crown under a small plain dark lotus-crown cap (Daoists did not shave the forehead), a long thin grey beard kept short and neat. The RIGHT hand holds a pale PEACH-WOOD SWORD (a ritual sword of pale wood, broad and blunt) upright in front of the right shoulder; the LEFT hand holds a small closed bronze bell against the chest. No paper talismans, no writing, no trigram symbols.

### cul-chn-silk-merchant — Silk merchant, China (man; role: npc) — anchored on mid-Qing Beijing, China, about 1770 (the Qianlong reign)
A Beijing silk merchant: a long brown-plum changshan gown to the ankles under a short black magua riding jacket with cloth buttons, a round black skullcap with a small red knot on top, the Qing man's shaved forehead and a long braided queue hanging down his back, black cloth shoes. A round, pleased face with a thin moustache. Both hands hold a fat bolt of cream and ochre silk against his chest.

### cul-chn-mandarin — Mandarin official, China (man; role: npc) — anchored on mid-Qing Beijing, China, about 1770 (the Qianlong reign)
A Qing civil official (a mandarin): a long dark court surcoat in deep burgundy-black over an ochre-yellow robe showing at the hem and the horse-hoof cuffs, a plain cream square rank badge on the chest (no picture, no writing on it), a string of large round amber court beads hanging to the waist, black boots, a round official's hat with an upturned brim, a red silk fringe and a round bright brass finial on top, the long queue behind. A dignified face with a long thin moustache. Both hands are clasped together in the sleeves in front of the chest.

### cul-chn-manchu-lady — Manchu noblewoman, China (woman; role: npc) — anchored on mid-Qing Beijing, China, about 1770 (the Qianlong reign)
A Manchu noblewoman of a banner family: a long straight robe to the ankles in plum with wide ochre and cream bands at the collar, the side opening and the cuffs, a short sleeveless cream waistcoat over it, her hair dressed up in the flat two-handled Manchu style with a couple of plain gold pins and one cream silk flower, high cream platform shoes (unbound, natural feet). A calm, proud face. Her hands hold a closed pale folding fan together in front of her waist.

### cul-chn-vegetable-seller — Vegetable seller, China (man; role: npc) — anchored on mid-Qing Beijing, China, about 1770 (the Qianlong reign)
A street pedlar from the farms outside Beijing: a short padded cotton jacket in faded ochre, loose dark brown trousers rolled at the shin, straw sandals, a cream cloth tied round his head over the shaved forehead, the queue wound round his head for work. A weathered, friendly face. A pale bamboo CARRYING POLE across his right shoulder, a round shallow basket of green cabbages and orange persimmons hanging close at each end, both hands steadying the pole.

### cul-ind-rajput-warrior — Rajput warrior, India (man; role: fighter) — anchored on Jaipur and Amber in Rajasthan, India, the 18th century
A Rajput warrior of the Amber court: a knee-length padded armour coat (a chilta of a thousand nails) in deep burgundy velvet studded all over with small brass studs, steel arm guards, a steel helmet with a short spike and a mail curtain over the neck worn over a burgundy turban cloth, a curled black moustache, tight cream trousers and pointed leather shoes. The RIGHT hand holds a curved TALWAR sword (a wide bright steel blade) upright in front of the right shoulder; the LEFT arm holds a round DHAL shield of dark-ochre hide with four bright brass bosses close in front of the left hip.

### cul-ind-harkara — Court spy, India (man; role: rogue) — anchored on Jaipur and Amber in Rajasthan, India, the 18th century
A harkara, the court's runner and spy, dressed to pass unseen in the bazaar: a plain cream knee-length cotton angarkha tied at the side, a dark ochre shawl drawn over his head and shoulders like a hood, a rust-coloured waist sash, bare feet in plain sandals, a short dark beard. The RIGHT hand holds a KATAR push-dagger (a broad bright steel blade on a H-shaped grip) upright at his chest; the LEFT hand holds a pale bamboo message tube against his hip.

### cul-ind-jyotishi — Court astronomer, India (man; role: caster) — anchored on Jaipur and Amber in Rajasthan, India, the 18th century
A jyotishi, an astronomer-astrologer of the Jaipur court in the age of its great observatory: a long cream jama robe flaring below the waist, a moss-green shawl over the shoulders, a modest ochre turban, a grey beard, a thin cream sacred thread across his chest from the left shoulder to the right hip, a single plain tilak line on the forehead, bare feet in wooden sandals. Both hands hold a big round bright BRASS ASTROLABE upright in front of his chest (plain, with no letters or numbers on it).

### cul-ind-marwari-merchant — Marwari merchant, India (man; role: npc) — anchored on Jaipur and Amber in Rajasthan, India, the 18th century
A Marwari merchant of the Jaipur bazaar: a big round ochre-and-burgundy pagri turban, a cream angarkha coat tied at the side, a white dhoti, pointed red leather slippers, a thick black moustache and a comfortable belly. Both hands hold a fat red cloth-bound account ledger (a bahi-khata, folded and tied with a cream cord, no writing showing) against his chest.

### cul-ind-thakurani — Rajput noblewoman, India (woman; role: npc) — anchored on Jaipur and Amber in Rajasthan, India, the 18th century
A thakurani, the lady of a Rajput noble house: a full swirling ghagra skirt to the ankles in deep burgundy with a broad ochre border, a fitted cream choli, a moss-green odhni veil drawn over her head and wrapped across the body, heavy plain gold bangles, a small nose ring and a round gold forehead ornament (borla) at the parting, bare feet with silver anklets. A composed, commanding face. Both hands hold a small bright brass oil lamp in front of her waist (no flame).

### cul-ind-panihari — Water carrier, India (woman; role: npc) — anchored on Jaipur and Amber in Rajasthan, India, the 18th century
A village woman fetching water from the stepwell: a full ghagra skirt in rust and ochre block-print, a cream blouse, an ochre odhni veil over her head, plain silver bangles and anklets, bare feet. Two round bright BRASS water pots stacked one on the other balanced on a small cloth ring on top of her head, her right hand raised to steady them, her left hand at her side.

### cul-ind-puppeteer — Puppeteer, India (man; role: npc) — anchored on Jaipur and Amber in Rajasthan, India, the 18th century
A kathputli puppeteer, a travelling maker and player of Rajasthani string puppets: a big bright ochre-red turban, a cream kurta and a white dhoti, a burgundy waist sash, plain sandals, a big curled moustache. In front of his chest his RIGHT hand holds up a wooden control bar from which a chunky painted PUPPET hangs close against him (a little turbaned man in a red skirt, its legs hanging free; NO strings shown, the puppet hangs straight from the bar); the LEFT hand holds a small drum at his hip.

### cul-nrs-shieldmaiden — Shieldmaiden, Norse (woman; role: fighter) — anchored on the Viking Age in Scandinavia, about 950
A Norse shieldmaiden: a knee-length mail byrnie over a burgundy wool tunic, a broad leather belt, wool trousers wrapped with leg-wraps, leather shoes; a plain rounded steel helmet with a short nose guard (NO horns, NO wings), her thick ochre-blond hair in one braid tucked into the collar. The RIGHT hand holds a broad leaf-bladed SPEAR upright, its pale ash shaft as thick as a wrist, its bright steel head above the helmet; the LEFT arm holds a big ROUND wooden shield painted in two plain halves of cream and burgundy with a bright steel boss, close in front of her body.
Lean (stated by us): Women warriors are in the sagas and one Birka grave (Bj 581) is argued over; a mailed shieldmaiden is a deliberate lean into the saga side of that argument.

### cul-nrs-outlaw — Outlaw, Norse (man; role: rogue) — anchored on the Viking Age in Scandinavia, about 950
A skogarmadr, a Norse outlaw sentenced to the forest: a hooded short cloak of rough brown wool pinned at the shoulder over a worn moss-green tunic, leather trousers and leg-wraps, a scruffy reddish beard under the hood, a wary face. The RIGHT hand holds a long broad SEAX knife (a wide bright single-edged blade) upright beside the shoulder; the LEFT hand holds a small bearded hand-axe with a pale wooden haft down at the hip.

### cul-nrs-volva — Volva, Norse (woman; role: caster) — anchored on the Viking Age in Scandinavia, about 950
A volva, a travelling seeress of the old faith as the saga of Erik the Red describes one: a long dark-burgundy cloak-dress closed at the throat, a hood of black lambskin lined with white catskin, catskin gloves, a belt of tinder-fungus with a big leather pouch hanging from it, a string of large amber and glass beads across her chest, calfskin shoes. An older, knowing face. Both hands hold her tall STAFF upright in front of her: a thick pale iron-and-wood distaff-staff taller than she is with a bright brass knob and a small basket-shaped cage at the top (plain, no runes or carving).

### cul-nrs-trader — Trader, Norse (man; role: npc) — anchored on the Viking Age in Scandinavia, about 950
A Norse trader of the market towns: a fur hat, a thick ochre wool tunic with a cream woven band at the hem, a short brown cloak pinned with a round brass brooch, baggy trousers gathered below the knee, leather shoes, a silver arm ring, a full brown beard. The RIGHT hand holds up a small folding BRASS BALANCE SCALE (two chunky bright pans hanging close under a short beam) in front of his chest; the LEFT hand holds a fat leather purse at the belt.

### cul-nrs-husfreyja — Farmwife, Norse (woman; role: npc) — anchored on the Viking Age in Scandinavia, about 950
A husfreyja, the mistress of a Norse farmstead: a long cream linen underdress, over it an apron-dress of moss-green wool held at the chest by two big oval bronze TORTOISE BROOCHES with a string of amber beads swagged between them, a bunch of iron keys and a small knife hanging at her belt, her hair under a plain cream linen cap. A strong, practical face. Both hands hold a pale wooden milk bucket with brass hoops in front of her.

### cul-nrs-smith — Smith, Norse (man; role: npc) — anchored on the Viking Age in Scandinavia, about 950
A Norse smith: a sleeveless burgundy wool tunic, a long heavy honey-leather apron, thick wool trousers and leg-wraps, leather shoes, bare muscular forearms, a short braided beard and a cream headband. The RIGHT hand holds a big bright-headed HAMMER upright against his shoulder; the LEFT hand holds a pair of long pale-steel tongs down at his side.

### cul-nrs-jarl — Jarl, Norse (man; role: npc) — anchored on the Viking Age in Scandinavia, about 950
A jarl, a Norse chieftain at ease in his hall: a fine burgundy wool tunic with ochre woven bands at the collar and cuffs, a short cream fur-lined cloak pinned at the right shoulder with a big round gold brooch, wide trousers gathered at the knee, soft boots, a thick silver arm ring and a gold neck ring, a full grey-streaked beard, no helmet. The RIGHT hand holds a big pale DRINKING HORN with a bright brass rim upright in front of his chest; the LEFT hand rests on the round pommel of a sheathed sword at his hip.

### cul-mde-mamluk-cavalier — Mamluk cavalier, Middle East (man; role: fighter) — anchored on Mamluk Cairo and Damascus, the 14th century
A Mamluk faris, a cavalryman of the Sultan's household on foot: a knee-length coat of small steel lamellar plates over a mail shirt, an ochre silk surcoat with short sleeves over it, a rounded steel helmet with a short point, wrapped with a cream turban cloth, a mail neck curtain, burgundy trousers, soft red leather boots, a trimmed black beard. The RIGHT hand holds a flanged steel MACE upright in front of the right shoulder (a big bright head on a thick shaft); the LEFT arm holds a small round shield of cream cane wrapped with burgundy thread and a bright steel boss, close in front of the left hip. No writing on the shield or anywhere.

### cul-mde-ayyar — Ayyar, Middle East (man; role: rogue) — anchored on Mamluk Cairo and Damascus, the 14th century
An 'ayyar, one of the brotherhoods of street toughs and tricksters of the medieval cities: a short close-fitting rust-coloured jacket over a cream shirt, baggy dark trousers tucked into soft boots, a broad ochre waist sash, a dark burgundy head-cloth wrapped round the head with one end drawn across the lower face. Clever dark eyes. The RIGHT hand holds a broad curved KHANJAR dagger (a wide bright blade) upright at the chest; the LEFT hand holds a coiled thick cream rope against the hip.

### cul-mde-alchemist — Alchemist, Middle East (man; role: caster) — anchored on Mamluk Cairo and Damascus, the 14th century
A scholar of alchemy in the tradition of Jabir, as al-Jildaki practised it in 14th-century Cairo: a long loose cream robe, a dark moss-green outer robe with wide sleeves, a big round white turban with a long ochre scarf (a taylasan) laid over the head and shoulders, soft yellow leather slippers, a full grey beard. Both hands hold a big bright BRASS-AND-GLASS ALEMBIC (a round flask with a tall spout-cap, thick and chunky) in front of his chest. No writing, no symbols.

### cul-mde-spice-merchant — Spice merchant, Middle East (man; role: npc) — anchored on Mamluk Cairo and Damascus, the 14th century
A Karimi spice merchant of the Cairo markets: a long striped robe in ochre and cream, a burgundy open coat over it, a cream turban, soft red slippers, a well-kept dark beard and a satisfied smile. Both hands hold a wide shallow bright BRASS BOWL heaped with orange-red and ochre spice in front of his belly.

### cul-mde-saqqa — Water carrier, Middle East (man; role: npc) — anchored on Mamluk Cairo and Damascus, the 14th century
A saqqa, one of the water carriers who brought Nile water through the Cairo streets: a knee-length cream cotton tunic with a rust sash, a small cream head-cloth, bare legs and plain sandals, a lean face with a short beard. A big fat brown leather WATERSKIN slung on his back over the left shoulder, its neck brought round under his right arm, both hands holding a bright brass drinking cup in front of his chest.

### cul-mde-dallala — Dallala, Middle East (woman; role: npc) — anchored on Mamluk Cairo and Damascus, the 14th century
A dallala, one of the women brokers who carried fine goods from house to house to sell to the women of Cairo: a long ochre robe, a big cream wrap (an izar) drawn over her head and around her body, a plum face veil across the lower face so her eyes show, red leather slippers. Both hands hold a big folded bundle of burgundy and cream cloth tied with a cord against her chest.

### cul-mde-khatun — Mamluk noblewoman, Middle East (woman; role: npc) — anchored on Mamluk Cairo and Damascus, the 14th century
A khatun, a lady of an emir's household, the kind who founded schools and fountains: a long full-sleeved burgundy silk robe with wide ochre bands at the cuffs, a cream silk over-robe open at the front, a tall rounded cap wrapped in a cream silk veil that falls to her shoulders, heavy plain gold earrings and bracelets, soft yellow slippers. A composed, shrewd face. Both hands hold a small bright brass casket in front of her waist.

### cul-rus-druzhinnik — Druzhina warrior, Rus' (man; role: fighter) — anchored on medieval Rus' (Novgorod and Kiev), the 12th century
A warrior of a prince's druzhina in medieval Rus': a long mail shirt to the knees over a burgundy quilted tunic, a tall conical steel helmet with a little spire on top and a mail curtain round the neck and chin, leather boots, a full brown beard. The RIGHT hand holds a broad straight double-edged SWORD (a wide bright blade) upright in front of the right shoulder; the LEFT arm holds a tall almond-shaped (teardrop) wooden shield painted burgundy with a cream rim, close in front of the body. No symbols on it.

### cul-rus-ushkuinik — River raider, Rus' (man; role: rogue) — anchored on medieval Rus' (Novgorod and Kiev), the 12th century
An ushkuinik, one of the Novgorod river raiders who took their boats down the northern rivers: a short hooded cloak of rough brown wool over a quilted ochre jacket, a broad belt, baggy trousers tucked into soft boots, a short red beard, a sly grin. The RIGHT hand holds a bearded AXE with a pale wooden haft upright against his shoulder; the LEFT hand holds a long broad knife down at his hip.

### cul-rus-znakharka — Wise woman, Rus' (woman; role: caster) — anchored on medieval Rus' (Novgorod and Kiev), the 12th century
A znakharka, a village wise woman and healer who knew the herbs and the old charms: a long cream linen shirt-dress with red woven bands at the hem and cuffs, a dark-ochre wool poneva skirt wrapped over it, a plum headscarf tied under the chin, bark shoes, a lined, kind old face. The RIGHT hand holds a tall gnarled pale wooden STAFF upright beside her; the LEFT hand holds a thick bundle of dried herbs and a small clay pot against her chest.

### cul-rus-kupets — Fur merchant, Rus' (man; role: npc) — anchored on medieval Rus' (Novgorod and Kiev), the 12th century
A Novgorod merchant of the fur trade: a tall round fur hat, a long burgundy kaftan to mid-calf belted with a cream sash, red leather boots, a long full brown beard, a proud face. Both hands hold a thick bundle of dark brown sable pelts tied together against his chest.

### cul-rus-princess — Princess, Rus' (woman; role: npc) — anchored on medieval Rus' (Novgorod and Kiev), the 12th century
A princess of a Rus' ruling house: a long straight silk gown in deep burgundy with broad gold-ochre bands at the hem, collar and cuffs, a cream shawl over the shoulders, a rounded cream headdress with a veil falling behind and big round gold temple-rings (kolty) hanging at each side of her face, a necklace of gold beads. A calm, proud face. Her hands are clasped together in front of her waist.

### cul-rus-carpenter — Carpenter, Rus' (man; role: npc) — anchored on medieval Rus' (Novgorod and Kiev), the 12th century
A Rus' carpenter, a builder of log houses and churches: a cream linen shirt belted with a rope and worn outside the trousers, the sleeves rolled up, baggy brown trousers tucked into leg-wraps and bark shoes, a cream headband, a bushy blond beard. The RIGHT hand holds a big broad CARPENTER'S AXE with a bright blade and a pale haft upright against his shoulder; the LEFT hand holds a pale wooden mallet at his side.

### cul-rus-peasant-woman — Peasant woman, Rus' (woman; role: npc) — anchored on medieval Rus' (Novgorod and Kiev), the 12th century
A peasant woman of a Rus' village at harvest: a long cream linen shirt-dress with red woven bands, a checked burgundy-and-ochre poneva skirt, a cream headscarf tied at the back over a plain cap, bark shoes, a round, sunburnt face. The RIGHT hand holds a big bright curved SICKLE upright beside her shoulder; the LEFT arm holds a thick golden sheaf of rye against her side.

### cul-mes-jaguar-warrior — Jaguar warrior, Mexica (man; role: fighter) — anchored on Tenochtitlan, the Mexica (Aztec) capital, about 1500
A Mexica jaguar warrior (ocelotl), one of the military orders of Tenochtitlan: a close-fitting body suit painted as jaguar skin (ochre-gold with dark rosettes) over quilted cream cotton armour (ichcahuipilli), the jaguar's head worn as a helmet with his face showing through its open jaws, cream sandals. The RIGHT hand holds a MACUAHUITL (a broad flat pale wooden club-sword with a row of black obsidian blades set along both edges) upright in front of the right shoulder; the LEFT arm holds a round CHIMALLI shield of woven cane painted in plain cream and burgundy halves, close in front of the left hip. No feathers sticking out anywhere.

### cul-mes-nahualoztomeca — Disguised trader, Mexica (man; role: rogue) — anchored on Tenochtitlan, the Mexica (Aztec) capital, about 1500
A naualoztomeca, one of the merchants who went in disguise into foreign markets to listen for the Mexica: a plain rough cream maguey-fibre cloak knotted at the shoulder over a loincloth, cream sandals, his hair cut plain like a foreign commoner's, a watchful face. A pale wooden carrying frame strapped to his back with a small bundle on it. The RIGHT hand holds a broad black OBSIDIAN KNIFE with a pale wooden handle half-hidden at his chest; the LEFT hand holds a pale walking staff.

### cul-mes-tonalpouhqui — Day-count reader, Mexica (man; role: caster) — anchored on Tenochtitlan, the Mexica (Aztec) capital, about 1500
A tonalpouhqui, a reader of the sacred count of days who named children and chose lucky days: a long cream cotton cloak (tilmatli) knotted at the right shoulder, with a broad burgundy border, over a loincloth, cream sandals, his hair long and tied back, a calm older face. Both hands hold a thick folded screenfold BOOK (pale cream deerskin pages folded like a fan, closed, with plain dark wooden covers: no pictures or signs showing) in front of his chest.

### cul-mes-pochteca — Pochteca merchant, Mexica (man; role: npc) — anchored on Tenochtitlan, the Mexica (Aztec) capital, about 1500
A pochteca, a long-distance merchant of Tenochtitlan's merchant guild: a knotted cream cotton cloak with an ochre border, a loincloth, sturdy cream sandals, a big pale wooden carrying frame (cacaxtli) on his back stacked with tied bundles of cloth and a round pot, a tump-line across his forehead, a broad weathered face. The RIGHT hand holds a tall pale black-tipped wooden walking STAFF (the merchants' staff) upright beside him.

### cul-mes-market-woman — Market woman, Mexica (woman; role: npc) — anchored on Tenochtitlan, the Mexica (Aztec) capital, about 1500
A woman selling in the great market of Tlatelolco: a cream cotton huipil blouse with a broad red-and-ochre woven band at the neck and hem, a wrapped ochre cueitl skirt to the calves, bare feet, her hair wound up in the two little horns of a married Mexica woman. A round, shrewd face. Both hands hold a big round woven basket heaped with yellow maize cobs and red chillies in front of her.

### cul-mes-cihuapilli — Noblewoman, Mexica (woman; role: npc) — anchored on Tenochtitlan, the Mexica (Aztec) capital, about 1500
A cihuapilli, a noblewoman of Tenochtitlan: a long fine cream huipil richly woven with burgundy and ochre bands, a full skirt with a wide embroidered hem, jade-green bead necklace and ear spools, gold bracelets, her hair in the two little horns, cream sandals. A composed, regal face. Both hands hold a big round bouquet of ochre and red flowers in front of her chest.

### cul-mes-amanteca — Featherworker, Mexica (man; role: npc) — anchored on Tenochtitlan, the Mexica (Aztec) capital, about 1500
An amanteca, a featherworker of the craftsmen's quarter who made feather mosaics for the nobles: a plain cream cloak knotted at the shoulder over a loincloth, cream sandals, short hair, a careful, absorbed face. Both hands hold up in front of his chest a round flat FEATHER-MOSAIC disc (a shield face laid with feathers in a smooth flat pattern of red, ochre, gold and jade green, the feathers lying flat like painted scales, none sticking out).
