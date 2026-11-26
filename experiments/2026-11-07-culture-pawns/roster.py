#!/usr/bin/env python3
"""THE ROSTER: pawns by culture (Harry 2026-11-07: "probably need some pawns by culture. We don't need the full DND grid,
just some NPCs, and a armored fighter, rouge-like, and caster for each race"). "Race" is read as each CULTURE PACK of the
room packs (wiki projects/3d-vtt/culture-packs-a, -b), each anchored on the same period and place as its rooms.

One row per figure. `setting` is the room packs' own setting code (engine/tools/build_types.py: the genre and its label
come from there, so the Pawns menu's genre heading and the Build tray's are one word in one place). `kin` is the
heading the figure sits under in the Pawns menu. `design` is the figure-specific part of its plate prompt; `holds` the
things the plate gate must see; `lean` says honestly where the figure leans into fantasy.
    python3 roster.py      -> roster.json (and prints the counts)"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

# setting code, heading, the period and place every figure of it is anchored on, search words for the whole culture
CULTURES = [
    ('JPN', 'Japan', 'late-Edo Kyoto, Japan, about 1850', ['japan', 'japanese', 'edo', 'kyoto']),
    ('CHN', 'China', 'mid-Qing Beijing, China, about 1770 (the Qianlong reign)', ['china', 'chinese', 'qing', 'beijing']),
    ('IND', 'India', 'Jaipur and Amber in Rajasthan, India, the 18th century', ['india', 'indian', 'rajasthan', 'rajput', 'jaipur']),
    ('NRS', 'Norse', 'the Viking Age in Scandinavia, about 950', ['norse', 'viking', 'scandinavian', 'nordic']),
    ('MDE', 'Mamluk', 'Mamluk-era Cairo and Damascus, the 14th century', ['middle east', 'mamluk', 'cairo', 'damascus', 'egypt', 'syria', 'arab']),
    ('RUS', "Rus'", "medieval Rus' (Novgorod and Kyiv), the 12th century", ["rus'", 'rus', 'russian', 'slavic', 'novgorod', 'kyiv', 'kiev', 'kievan']),
    ('MES', 'Mexica', 'Tenochtitlan, the Mexica (Aztec) capital, about 1500', ['mexica', 'aztec', 'tenochtitlan', 'mesoamerica', 'mesoamerican']),
]

# id, role, cls, name, gender, height ft, design, holds (the gate must see), tags, srd, shaft, lean
R = {}
R['JPN'] = [
    ('samurai', 'fighter', 'fighter', 'Samurai', 'm', 5.6,
     "A samurai in full Edo-period armour (tosei-gusoku): a lacquered cuirass of horizontal plates in deep burgundy laced with ochre cord, "
     "broad layered shoulder guards, a skirt of plates, armoured sleeves and shin guards over dark hakama trousers, straw sandals. A rounded "
     "helmet with a flared neck guard and a small plain brass crest-plate at the front (no symbol on it), the face open and clean-"
     "shaven, the topknot hidden under the helmet. Two swords in their dark scabbards thrust through the sash at the left hip. Both hands "
     "hold a straight YARI spear upright in front of the body, its pale ash shaft as thick as a wrist, its bright steel blade above the helmet.",
     ['yari spear', 'two swords at the hip', 'plate armour'], ['samurai', 'bushi', 'warrior', 'armored', 'armoured', 'soldier', 'spearman'], ['knight', 'veteran', 'guard'], 'spear', ''),
    ('shinobi', 'rogue', 'rogue', 'Shinobi', 'm', 5.5,
     "A shinobi (a spy-agent) in practical rust-brown and charcoal-grey work clothes: a short jacket bound at the waist, narrow trousers "
     "wrapped at the shins, split-toe tabi socks and straw sandals, a hood-scarf wrapped over the head and lower face so only the eyes show. "
     "The RIGHT hand holds a short straight sword (a pale steel blade as broad as two fingers) upright beside the shoulder; the LEFT hand "
     "holds a coil of thick ochre rope against the hip. Plain, no symbols.",
     ['short straight sword', 'coil of rope', 'face wrapped by a hood'], ['shinobi', 'ninja', 'spy', 'thief', 'assassin', 'scout'], ['spy', 'assassin', 'scout'], 'sword',
     "The all-black ninja suit is a kabuki stage convention; this one wears working browns and greys, which is closer to what spies wore, but a hooded shinobi is still the legend more than the record."),
    ('onmyoji', 'caster', 'onmyoji', 'Onmyoji', 'm', 5.6,
     "An onmyoji, a court diviner of the yin-yang way (the Tsuchimikado house still licensed them in Kyoto): a round-collared kariginu "
     "hunting robe of pale cream over plum-coloured sashinuki trousers gathered at the ankle, wide sleeves, black lacquered shoes, a tall "
     "black eboshi court hat. A calm, beardless older face. The RIGHT hand holds a closed cream folding fan upright in front of the chest; the "
     "LEFT forearm carries a square pale wooden divination board with a round disc set in it (plain, no marks on it). No talismans, no writing.",
     ['folding fan', 'square divination board', 'tall black hat'], ['onmyoji', 'diviner', 'caster', 'mage', 'wizard', 'priest', 'yin yang', 'court'], ['mage', 'priest', 'diviner'], None, ''),
    ('sake-merchant', 'npc', 'merchant', 'Sake merchant', 'm', 5.5,
     "A Kyoto sake merchant: a plain brown-grey kimono with a short black haori jacket, a long dark-ochre maekake shop apron tied at the "
     "waist (no writing on it), white tabi socks and wooden geta clogs, the Edo townsman's shaved crown and small topknot. A broad friendly "
     "face. Both hands hold a big pale cream ceramic sake flask against the belly.",
     ['big sake flask', 'shop apron'], ['merchant', 'shopkeeper', 'sake', 'brewer', 'trader', 'townsman', 'npc'], ['commoner'], None, ''),
    ('tea-house-keeper', 'npc', 'innkeeper', 'Tea-house keeper', 'f', 5.1,
     "The keeper of a Kyoto tea house, a middle-aged townswoman: a plain kimono in soft plum with a wide ochre obi sash tied at the back, a "
     "cream apron over it, white tabi socks and low geta clogs, her hair in a simple rounded bun held with one plain comb. A warm, "
     "capable face. Both hands hold a pale lacquered wooden tray with a cream teapot and two cups in front of her waist.",
     ['tray with teapot and cups'], ['tea house', 'teahouse', 'innkeeper', 'hostess', 'townswoman', 'server', 'npc'], ['commoner'], None, ''),
    ('ohara-me', 'npc', 'commoner', 'Ohara woman', 'f', 5.1,
     "An Ohara-me, one of the village women who walked into Kyoto from Ohara to sell firewood: a work kimono in dark brown "
     "with a pale cream tie-dyed pattern, white cloth arm and shin covers, straw sandals, a cream cloth over her hair, and a big round BUNDLE "
     "of pale firewood sticks balanced flat on top of her head, both hands raised to steady it. A plain, cheerful country face.",
     ['bundle of firewood on the head'], ['farmer', 'villager', 'peasant', 'firewood seller', 'country woman', 'commoner', 'npc'], ['commoner'], None, ''),
    ('doshin', 'npc', 'constable', 'Town constable', 'm', 5.6,
     "A doshin, a samurai constable of the Kyoto town magistrate: a sober dark-ochre kimono tucked up at the back, a black haori jacket, "
     "narrow trousers, white tabi and straw sandals, two swords at the left hip, the samurai's shaved crown and topknot. A stern, watchful "
     "face. The RIGHT hand holds a JITTE (a pale steel truncheon as thick as a thumb, one short side-hook) upright in front of the chest; "
     "the LEFT hand rests on the sword hilts.",
     ['steel truncheon (jitte)', 'two swords at the hip'], ['constable', 'magistrate', 'official', 'police', 'watchman', 'samurai', 'officer', 'npc'], ['guard', 'noble'], None, ''),
]
R['CHN'] = [
    ('bannerman', 'fighter', 'fighter', 'Bannerman', 'm', 5.7,
     "A Manchu bannerman of the Eight Banners in Qing armour: a long coat of armour padded and studded all over with rows of round brass "
     "studs, in rich burgundy-red edged with black, reaching below the knees with split armoured skirts, big padded shoulder guards and arm "
     "guards, black boots; a round steel helmet with a tall spike and a padded neck guard. A clean-shaven face, the shaved forehead of the "
     "Qing. The RIGHT hand holds a broad curved DAO sabre (a wide bright steel blade) upright in front of the right shoulder; the LEFT arm "
     "holds a round woven rattan shield painted ochre, close in front of the left hip. No symbols on the shield.",
     ['broad curved sabre', 'round shield', 'studded armour coat', 'spiked helmet'], ['bannerman', 'soldier', 'warrior', 'armored', 'armoured', 'manchu', 'guard'], ['veteran', 'guard', 'knight'], 'sword', ''),
    ('swordswoman', 'rogue', 'rogue', 'Wandering swordswoman', 'f', 5.3,
     "A wandering swordswoman of the rivers and lakes (the xia of the storytellers): a short fitted jacket in moss green bound with a "
     "wide ochre sash, loose dark trousers tied at the ankle, soft black cloth shoes, her hair in a tight bun wrapped with a cream cloth, a "
     "broad-brimmed bamboo hat hanging at her back. A sharp, level gaze. The RIGHT hand holds a straight JIAN sword (a bright steel blade "
     "two fingers wide) upright beside the shoulder; the LEFT hand holds its pale wooden scabbard down at her hip.",
     ['straight sword', 'scabbard', 'bamboo hat on the back'], ['swordswoman', 'wuxia', 'xia', 'knight-errant', 'rogue', 'duelist', 'adventurer', 'martial artist'], ['spy', 'scout', 'bandit captain'], 'sword',
     "The wandering sword-hero is a figure of Qing fiction and storytelling, not of the Beijing record; she is the legend, dressed in plausible mid-Qing working clothes."),
    ('daoist-priest', 'caster', 'priest', 'Daoist priest', 'm', 5.6,
     "A Daoist priest (daoshi) of a Beijing temple: a long loose robe with wide sleeves in deep ochre-yellow over a cream under-robe, a "
     "plain burgundy collar band, white socks and black cloth shoes, his long hair gathered in a topknot on the crown under a small "
     "plain dark lotus-crown cap (Daoists did not shave the forehead), a long thin grey beard kept short and neat. The RIGHT hand holds a "
     "pale PEACH-WOOD SWORD (a ritual sword of pale wood, broad and blunt) upright in front of the right shoulder; the LEFT hand holds a "
     "small closed bronze bell against the chest. No paper talismans, no writing, no trigram symbols.",
     ['peach-wood ritual sword', 'small bronze bell', 'topknot cap'], ['daoist', 'taoist', 'priest', 'caster', 'exorcist', 'mage', 'cleric', 'monk'], ['priest', 'acolyte', 'mage'], 'sword', ''),
    ('silk-merchant', 'npc', 'merchant', 'Silk merchant', 'm', 5.6,
     "A Beijing silk merchant: a long brown-plum changshan gown to the ankles under a short black magua riding jacket with cloth "
     "buttons, a round black skullcap with a small red knot on top, the Qing man's shaved forehead and a long braided queue hanging down "
     "his back, black cloth shoes. A round, pleased face with a thin moustache. Both hands hold a fat bolt of cream and ochre silk "
     "against his chest.",
     ['bolt of silk', 'skullcap'], ['merchant', 'silk merchant', 'trader', 'shopkeeper', 'townsman', 'npc'], ['commoner', 'noble'], None, ''),
    ('mandarin', 'npc', 'noble', 'Mandarin official', 'm', 5.7,
     "A Qing civil official (a mandarin): a long dark court surcoat in deep burgundy-black over an ochre-yellow robe showing at the hem "
     "and the horse-hoof cuffs, a plain cream square rank badge on the chest (no picture, no writing on it), a string of large round amber "
     "court beads hanging to the waist, black boots, a round official's hat with an upturned brim, a red silk fringe and a round bright "
     "brass finial on top, the long queue behind. A dignified face with a long thin moustache. Both hands are clasped together in the "
     "sleeves in front of the chest.",
     ['official hat with a finial', 'court beads', 'square badge'], ['mandarin', 'official', 'magistrate', 'noble', 'court', 'governor', 'scholar', 'npc'], ['noble'], None, ''),
    ('manchu-lady', 'npc', 'noble', 'Manchu noblewoman', 'f', 5.3,
     "A Manchu noblewoman of a banner family: a long straight robe to the ankles in plum with wide ochre and cream bands at the collar, "
     "the side opening and the cuffs, a short sleeveless cream waistcoat over it, her hair dressed up in the flat two-handled Manchu "
     "style with a couple of plain gold pins and one cream silk flower, high cream platform shoes (unbound, natural feet). A calm, proud "
     "face. Her hands hold a closed pale folding fan together in front of her waist.",
     ['folding fan', 'two-handled hairstyle', 'platform shoes'], ['noblewoman', 'lady', 'noble', 'manchu', 'court', 'aristocrat', 'npc'], ['noble'], None, ''),
    ('vegetable-seller', 'npc', 'commoner', 'Vegetable seller', 'm', 5.5,
     "A street pedlar from the farms outside Beijing: a short padded cotton jacket in faded ochre, loose dark brown trousers rolled at "
     "the shin, straw sandals, a cream cloth tied round his head over the shaved forehead, the queue wound round his head for work. A "
     "weathered, friendly face. A pale bamboo CARRYING POLE across his right shoulder, a round shallow basket of green cabbages and "
     "orange persimmons hanging close at each end, both hands steadying the pole.",
     ['carrying pole', 'two baskets of vegetables'], ['farmer', 'pedlar', 'peddler', 'vegetable seller', 'peasant', 'commoner', 'villager', 'npc'], ['commoner'], None, ''),
]
R['IND'] = [
    ('rajput-warrior', 'fighter', 'fighter', 'Rajput warrior', 'm', 5.8,
     "A Rajput warrior of the Amber court: a knee-length padded armour coat (a chilta of a thousand nails) in deep burgundy velvet "
     "studded all over with small brass studs, steel arm guards, a steel helmet with a short spike and a mail curtain over the neck "
     "worn over a burgundy turban cloth, a curled black moustache, tight cream trousers and pointed leather shoes. The RIGHT hand holds a "
     "curved TALWAR sword (a wide bright steel blade) upright in front of the right shoulder; the LEFT arm holds a round DHAL shield of "
     "dark-ochre hide with four bright brass bosses close in front of the left hip.",
     ['curved sword', 'round shield with four bosses', 'studded armour coat'], ['rajput', 'warrior', 'soldier', 'armored', 'armoured', 'swordsman', 'guard'], ['knight', 'veteran', 'guard'], 'sword', ''),
    ('harkara', 'rogue', 'rogue', 'Court spy', 'm', 5.6,
     "A harkara, the court's runner and spy, dressed to pass unseen in the bazaar: a plain cream knee-length cotton angarkha tied at the "
     "side, a dark ochre shawl drawn over his head and shoulders like a hood, a rust-coloured waist sash, bare feet in plain sandals, a "
     "short dark beard. The RIGHT hand holds a KATAR push-dagger (a broad bright steel blade on a H-shaped grip) upright at his chest; the "
     "LEFT hand holds a pale bamboo message tube against his hip.",
     ['push-dagger (katar)', 'message tube', 'shawl drawn as a hood'], ['spy', 'harkara', 'messenger', 'rogue', 'thief', 'scout', 'informer'], ['spy', 'scout'], None, ''),
    ('jyotishi', 'caster', 'astrologer', 'Court astronomer', 'm', 5.6,
     "A jyotishi, an astronomer-astrologer of the Jaipur court in the age of its great observatory: a long cream jama robe flaring below "
     "the waist, a moss-green shawl over the shoulders, a modest ochre turban, a grey beard, a thin cream sacred thread across his chest "
     "from the left shoulder to the right hip, a single plain tilak line on the forehead, bare feet in wooden sandals. Both hands hold a "
     "big round bright BRASS ASTROLABE upright in front of his chest (plain, with no letters or numbers on it).",
     ['big brass astrolabe'], ['astrologer', 'astronomer', 'jyotishi', 'scholar', 'sage', 'caster', 'mage', 'wizard', 'brahmin'], ['mage', 'priest', 'sage'], None, ''),
    ('marwari-merchant', 'npc', 'merchant', 'Marwari merchant', 'm', 5.6,
     "A Marwari merchant of the Jaipur bazaar: a big round ochre-and-burgundy pagri turban, a cream angarkha coat tied at the side, a "
     "white dhoti, pointed red leather slippers, a thick black moustache and a comfortable belly. Both hands hold a fat red cloth-bound "
     "account ledger (a bahi-khata, folded and tied with a cream cord, no writing showing) against his chest.",
     ['red bound ledger', 'big turban'], ['merchant', 'marwari', 'banker', 'moneylender', 'trader', 'shopkeeper', 'npc'], ['commoner', 'noble'], None, ''),
    ('thakurani', 'npc', 'noble', 'Rajput noblewoman', 'f', 5.3,
     "A thakurani, the lady of a Rajput noble house: a full swirling ghagra skirt to the ankles in deep burgundy with a broad ochre "
     "border, a fitted cream choli, a moss-green odhni veil drawn over her head and wrapped across the body, heavy plain gold bangles, a "
     "small nose ring and a round gold forehead ornament (borla) at the parting, bare feet with silver anklets. A composed, commanding "
     "face. Both hands hold a small bright brass oil lamp in front of her waist (no flame).",
     ['brass lamp', 'veil over the head', 'full skirt'], ['noblewoman', 'lady', 'noble', 'rajput', 'queen', 'aristocrat', 'thakurani', 'npc'], ['noble'], None, ''),
    ('panihari', 'npc', 'commoner', 'Water carrier', 'f', 5.2,
     "A village woman fetching water from the stepwell: a full ghagra skirt in rust and ochre block-print, a cream blouse, an ochre "
     "odhni veil over her head, plain silver bangles and anklets, bare feet. Two round bright BRASS water pots stacked one on the other "
     "balanced on a small cloth ring on top of her head, her right hand raised to steady them, her left hand at her side.",
     ['two brass pots on the head'], ['villager', 'water carrier', 'farmer', 'peasant', 'commoner', 'panihari', 'npc'], ['commoner'], None, ''),
    ('puppeteer', 'npc', 'craftsperson', 'Puppeteer', 'm', 5.6,
     "A kathputli puppeteer, a travelling maker and player of Rajasthani string puppets: a big bright ochre-red turban, a cream kurta "
     "and a white dhoti, a burgundy waist sash, plain sandals, a big curled moustache. In front of his chest his RIGHT hand holds up a "
     "wooden control bar from which a chunky painted PUPPET hangs close against him (a little turbaned man in a red skirt, its legs "
     "hanging free; NO strings shown, the puppet hangs straight from the bar); the LEFT hand holds a small drum at his hip.",
     ['a hanging puppet', 'small drum'], ['puppeteer', 'kathputli', 'performer', 'entertainer', 'craftsman', 'minstrel', 'npc'], ['commoner'], None, ''),
]
R['NRS'] = [
    ('shieldmaiden', 'fighter', 'fighter', 'Shieldmaiden', 'f', 5.5,
     "A Norse shieldmaiden: a knee-length mail byrnie over a burgundy wool tunic, a broad leather belt, wool trousers wrapped with "
     "leg-wraps, leather shoes; a plain rounded steel helmet with a short nose guard (NO horns, NO wings), her thick ochre-blond hair in "
     "one braid tucked into the collar. The RIGHT hand holds a broad leaf-bladed SPEAR upright, its pale ash shaft as thick as a wrist, its "
     "bright steel head above the helmet; the LEFT arm holds a big ROUND wooden shield painted in two plain halves of cream and burgundy "
     "with a bright steel boss, close in front of her body.",
     ['spear', 'round shield', 'mail shirt', 'helmet without horns'], ['shieldmaiden', 'viking', 'warrior', 'armored', 'armoured', 'fighter', 'raider'], ['veteran', 'berserker', 'guard'], 'spear',
     "Women warriors are in the sagas and one Birka grave (Bj 581) is argued over; a mailed shieldmaiden is a deliberate lean into the saga side of that argument."),
    ('outlaw', 'rogue', 'rogue', 'Outlaw', 'm', 5.8,
     "A skogarmadr, a Norse outlaw sentenced to the forest: a hooded short cloak of rough brown wool pinned at the shoulder over a "
     "worn moss-green tunic, leather trousers and leg-wraps, a scruffy reddish beard under the hood, a wary face. The RIGHT hand holds a "
     "long broad SEAX knife (a wide bright single-edged blade) upright beside the shoulder; the LEFT hand holds a small bearded hand-axe "
     "with a pale wooden haft down at the hip.",
     ['long knife (seax)', 'hand-axe', 'hood'], ['outlaw', 'rogue', 'thief', 'bandit', 'scout', 'hunter', 'exile', 'viking'], ['bandit', 'scout', 'thug'], None, ''),
    ('volva', 'caster', 'seer', 'Volva', 'f', 5.4,
     "A volva, a travelling seeress of the old faith as the saga of Erik the Red describes one: a long dark-burgundy cloak-dress closed "
     "at the throat, a hood of black lambskin lined with white catskin, catskin gloves, a belt of tinder-fungus with a big leather pouch "
     "hanging from it, a string of large amber and glass beads across her chest, calfskin shoes. An older, knowing face. Both hands hold "
     "her tall STAFF upright in front of her: a thick pale iron-and-wood distaff-staff taller than she is with a bright brass knob and a "
     "small basket-shaped cage at the top (plain, no runes or carving).",
     ['tall staff with a cage head', 'fur-lined hood', 'pouch'], ['volva', 'seeress', 'seer', 'witch', 'caster', 'druid', 'priestess', 'oracle', 'viking'], ['druid', 'priest', 'mage'], 'staff', ''),
    ('trader', 'npc', 'merchant', 'Trader', 'm', 5.8,
     "A Norse trader of the market towns: a fur hat, a thick ochre wool tunic with a cream woven band at the hem, a short brown cloak "
     "pinned with a round brass brooch, baggy trousers gathered below the knee, leather shoes, a silver arm ring, a full brown beard. The "
     "RIGHT hand holds up a small folding BRASS BALANCE SCALE (two chunky bright pans hanging close under a short beam) in front of his "
     "chest; the LEFT hand holds a fat leather purse at the belt.",
     ['brass balance scale', 'purse', 'fur hat'], ['trader', 'merchant', 'viking', 'pedlar', 'silver', 'npc'], ['commoner'], None, ''),
    ('husfreyja', 'npc', 'commoner', 'Farmwife', 'f', 5.3,
     "A husfreyja, the mistress of a Norse farmstead: a long cream linen underdress, over it an apron-dress of moss-green wool held "
     "at the chest by two big oval bronze TORTOISE BROOCHES with a string of amber beads swagged between them, a bunch of iron keys "
     "and a small knife hanging at her belt, her hair under a plain cream linen cap. A strong, practical face. Both hands hold a pale "
     "wooden milk bucket with brass hoops in front of her.",
     ['oval brooches with beads', 'keys at the belt', 'wooden bucket'], ['farmwife', 'housewife', 'farmer', 'villager', 'commoner', 'viking', 'npc'], ['commoner'], None, ''),
    ('smith', 'npc', 'smith', 'Smith', 'm', 5.8,
     "A Norse smith: a sleeveless burgundy wool tunic, a long heavy honey-leather apron, thick wool trousers and leg-wraps, leather "
     "shoes, bare muscular forearms, a short braided beard and a cream headband. The RIGHT hand holds a big bright-headed HAMMER "
     "upright against his shoulder; the LEFT hand holds a pair of long pale-steel tongs down at his side.",
     ['hammer', 'tongs', 'leather apron'], ['smith', 'blacksmith', 'craftsman', 'viking', 'metalworker', 'npc'], ['commoner'], None, ''),
    ('jarl', 'npc', 'noble', 'Jarl', 'm', 5.9,
     "A jarl, a Norse chieftain at ease in his hall: a fine burgundy wool tunic with ochre woven bands at the collar and cuffs, a short "
     "cream fur-lined cloak pinned at the right shoulder with a big round gold brooch, wide trousers gathered at the knee, soft boots, "
     "a thick silver arm ring and a gold neck ring, a full grey-streaked beard, no helmet. The RIGHT hand holds a big pale DRINKING HORN "
     "with a bright brass rim upright in front of his chest; the LEFT hand rests on the round pommel of a sheathed sword at his hip.",
     ['drinking horn', 'sheathed sword', 'fur-lined cloak'], ['jarl', 'chieftain', 'noble', 'lord', 'viking', 'king', 'npc'], ['noble'], None, ''),
]
R['MDE'] = [
    ('mamluk-cavalier', 'fighter', 'fighter', 'Mamluk cavalier', 'm', 5.8,
     "A Mamluk faris, a cavalryman of the Sultan's household on foot: a knee-length coat of small steel lamellar plates over a mail "
     "shirt, an ochre silk surcoat with short sleeves over it, a rounded steel helmet with a short point, wrapped with a cream turban "
     "cloth, a mail neck curtain, burgundy trousers, soft red leather boots, a trimmed black beard. The RIGHT hand holds a flanged "
     "steel MACE upright in front of the right shoulder (a big bright head on a thick shaft); the LEFT arm holds a small round shield "
     "of cream cane wrapped with burgundy thread and a bright steel boss, close in front of the left hip. No writing on the shield or "
     "anywhere.",
     ['flanged mace', 'round shield', 'lamellar armour', 'turban-wrapped helmet'], ['mamluk', 'cavalier', 'warrior', 'soldier', 'armored', 'armoured', 'knight', 'faris'], ['knight', 'veteran', 'guard'], None, ''),
    ('ayyar', 'rogue', 'rogue', 'Ayyar', 'm', 5.6,
     "An 'ayyar, one of the brotherhoods of street toughs and tricksters of the medieval cities: a short close-fitting rust-coloured "
     "jacket over a cream shirt, baggy dark trousers tucked into soft boots, a broad ochre waist sash, a dark burgundy head-cloth "
     "wrapped round the head with one end drawn across the lower face. Clever dark eyes. The RIGHT hand holds a broad curved KHANJAR "
     "dagger (a wide bright blade) upright at the chest; the LEFT hand holds a coiled thick cream rope against the hip.",
     ['curved dagger', 'coiled rope', 'face cloth'], ['ayyar', 'rogue', 'thief', 'trickster', 'brigand', 'street tough', 'spy', 'futuwwa'], ['thug', 'bandit', 'spy'], None, ''),
    ('alchemist', 'caster', 'alchemist', 'Alchemist', 'm', 5.6,
     "A scholar of alchemy in the tradition of Jabir, as al-Jildaki practised it in 14th-century Cairo: a long loose cream robe, a dark "
     "moss-green outer robe with wide sleeves, a big round white turban with a long ochre scarf (a taylasan) laid over the head and "
     "shoulders, soft yellow leather slippers, a full grey beard. Both hands hold a big bright BRASS-AND-GLASS ALEMBIC (a round "
     "flask with a tall spout-cap, thick and chunky) in front of his chest. No writing, no symbols.",
     ['alembic flask', 'big turban with a scarf'], ['alchemist', 'scholar', 'caster', 'mage', 'wizard', 'sage', 'physician'], ['mage', 'sage'], None, ''),
    ('spice-merchant', 'npc', 'merchant', 'Spice merchant', 'm', 5.6,
     "A Karimi spice merchant of the Cairo markets: a long striped robe in ochre and cream, a burgundy open coat over it, a cream "
     "turban, soft red slippers, a well-kept dark beard and a satisfied smile. Both hands hold a wide shallow bright BRASS BOWL heaped with "
     "orange-red and ochre spice in front of his belly.",
     ['brass bowl of spices'], ['merchant', 'spice merchant', 'trader', 'karimi', 'shopkeeper', 'bazaar', 'npc'], ['commoner', 'noble'], None, ''),
    ('saqqa', 'npc', 'commoner', 'Water carrier', 'm', 5.6,
     "A saqqa, one of the water carriers who brought Nile water through the Cairo streets: a knee-length cream cotton tunic with a rust "
     "sash, a small cream head-cloth, bare legs and plain sandals, a lean face with a short beard. A big fat brown leather WATERSKIN "
     "slung on his back over the left shoulder, its neck brought round under his right arm, both hands holding a bright brass drinking "
     "cup in front of his chest.",
     ['big waterskin on the back', 'brass cup'], ['water carrier', 'water seller', 'saqqa', 'commoner', 'labourer', 'npc'], ['commoner'], None, ''),
    ('dallala', 'npc', 'merchant', 'Dallala', 'f', 5.3,
     "A dallala, one of the women brokers who carried fine goods from house to house to sell to the women of Cairo: a long ochre robe, "
     "a big cream wrap (an izar) drawn over her head and around her body, a plum face veil across the lower face so her eyes show, red "
     "leather slippers. Both hands hold a big folded bundle of burgundy and cream cloth tied with a cord against her chest.",
     ['bundle of cloth', 'wrap over the head', 'face veil'], ['broker', 'dallala', 'merchant', 'pedlar', 'saleswoman', 'trader', 'npc'], ['commoner'], None, ''),
    ('khatun', 'npc', 'noble', 'Mamluk noblewoman', 'f', 5.3,
     "A khatun, a lady of an emir's household, the kind who founded schools and fountains: a long full-sleeved burgundy silk robe "
     "with wide ochre bands at the cuffs, a cream silk over-robe open at the front, a tall rounded cap wrapped in a cream silk veil that "
     "falls to her shoulders, heavy plain gold earrings and bracelets, soft yellow slippers. A composed, shrewd face. Both hands hold a "
     "small bright brass casket in front of her waist.",
     ['brass casket', 'tall veiled cap'], ['noblewoman', 'lady', 'noble', 'khatun', 'patron', 'aristocrat', 'mamluk', 'npc'], ['noble'], None, ''),
]
R['RUS'] = [
    ('druzhinnik', 'fighter', 'fighter', 'Druzhina warrior', 'm', 5.9,
     "A warrior of a prince's druzhina in medieval Rus': a long mail shirt to the knees over a burgundy quilted tunic, a tall conical "
     "steel helmet with a little spire on top and a mail curtain round the neck and chin, leather boots, a full brown beard. The RIGHT "
     "hand holds a broad straight double-edged SWORD (a wide bright blade) upright in front of the right shoulder; the LEFT arm holds a "
     "tall almond-shaped (teardrop) wooden shield painted burgundy with a cream rim, close in front of the body. No symbols on it.",
     ['sword', 'teardrop shield', 'mail shirt', 'conical spired helmet'], ['druzhina', 'bogatyr', 'warrior', 'knight', 'soldier', 'armored', 'armoured', 'rus'], ['knight', 'veteran', 'guard'], 'sword', ''),
    ('ushkuinik', 'rogue', 'rogue', 'River raider', 'm', 5.8,
     "An ushkuinik, one of the Novgorod river raiders who took their boats down the northern rivers: a short hooded cloak of rough "
     "brown wool over a quilted ochre jacket, a broad belt, baggy trousers tucked into soft boots, a short red beard, a sly grin. The "
     "RIGHT hand holds a bearded AXE with a pale wooden haft upright against his shoulder; the LEFT hand holds a long broad knife down "
     "at his hip.",
     ['bearded axe', 'long knife', 'hood'], ['ushkuinik', 'river pirate', 'raider', 'rogue', 'bandit', 'outlaw', 'pirate', 'rus'], ['bandit', 'pirate', 'thug'], None, ''),
    ('znakharka', 'caster', 'healer', 'Wise woman', 'f', 5.2,
     "A znakharka, a village wise woman and healer who knew the herbs and the old charms: a long cream linen shirt-dress with red "
     "woven bands at the hem and cuffs, a dark-ochre wool poneva skirt wrapped over it, a plum headscarf tied under the chin, bark shoes, "
     "a lined, kind old face. The RIGHT hand holds a tall gnarled pale wooden STAFF upright beside her; the LEFT hand holds a thick bundle "
     "of dried herbs and a small clay pot against her chest.",
     ['tall staff', 'bundle of herbs', 'headscarf'], ['wise woman', 'healer', 'herbalist', 'witch', 'caster', 'druid', 'znakharka', 'hedge witch', 'rus'], ['druid', 'priest'], 'staff', ''),
    ('kupets', 'npc', 'merchant', 'Fur merchant', 'm', 5.8,
     "A Novgorod merchant of the fur trade: a tall round fur hat, a long burgundy kaftan to mid-calf belted with a cream sash, red "
     "leather boots, a long full brown beard, a proud face. Both hands hold a thick bundle of dark brown sable pelts tied together "
     "against his chest.",
     ['bundle of furs', 'tall fur hat'], ['merchant', 'fur trader', 'kupets', 'trader', 'novgorod', 'rus', 'npc'], ['commoner', 'noble'], None, ''),
    ('princess', 'npc', 'noble', 'Princess', 'f', 5.4,
     "A princess of a Rus' ruling house: a long straight silk gown in deep burgundy with broad gold-ochre bands at the hem, collar and "
     "cuffs, a cream shawl over the shoulders, a rounded cream headdress with a veil falling behind and big round gold temple-rings "
     "(kolty) hanging at each side of her face, a necklace of gold beads. A calm, proud face. Her hands are clasped together in front "
     "of her waist.",
     ['round temple ornaments', 'veiled headdress', 'long gown'], ['princess', 'noblewoman', 'boyarina', 'lady', 'noble', 'royal', 'rus', 'npc'], ['noble'], None, ''),
    ('carpenter', 'npc', 'craftsperson', 'Carpenter', 'm', 5.8,
     "A Rus' carpenter, a builder of log houses and churches: a cream linen shirt belted with a rope and worn outside the trousers, "
     "the sleeves rolled up, baggy brown trousers tucked into leg-wraps and bark shoes, a cream headband, a bushy blond beard. The "
     "RIGHT hand holds a big broad CARPENTER'S AXE with a bright blade and a pale haft upright against his shoulder; the LEFT hand holds a "
     "pale wooden mallet at his side.",
     ['carpenter axe', 'wooden mallet'], ['carpenter', 'builder', 'woodworker', 'craftsman', 'peasant', 'rus', 'npc'], ['commoner'], None, ''),
    ('peasant-woman', 'npc', 'commoner', 'Peasant woman', 'f', 5.2,
     "A peasant woman of a Rus' village at harvest: a long cream linen shirt-dress with red woven bands, a checked burgundy-and-ochre "
     "poneva skirt, a cream headscarf tied at the back over a plain cap, bark shoes, a round, sunburnt face. The RIGHT hand holds a big "
     "bright curved SICKLE upright beside her shoulder; the LEFT arm holds a thick golden sheaf of rye against her side.",
     ['sickle', 'sheaf of rye'], ['peasant', 'farmer', 'villager', 'harvester', 'commoner', 'rus', 'npc'], ['commoner'], None, ''),
]
R['MES'] = [
    ('jaguar-warrior', 'fighter', 'fighter', 'Jaguar warrior', 'm', 5.4,
     "A Mexica jaguar warrior (ocelotl), one of the military orders of Tenochtitlan: a close-fitting body suit painted as jaguar skin "
     "(ochre-gold with dark rosettes) over quilted cream cotton armour (ichcahuipilli), the jaguar's head worn as a helmet with his face "
     "showing through its open jaws, cream sandals. The RIGHT hand holds a MACUAHUITL (a broad flat pale wooden club-sword with a row of "
     "black obsidian blades set along both edges) upright in front of the right shoulder; the LEFT arm holds a round CHIMALLI shield of "
     "woven cane painted in plain cream and burgundy halves, close in front of the left hip. No feathers sticking out anywhere.",
     ['obsidian-edged club', 'round shield', 'jaguar-head helmet'], ['jaguar warrior', 'ocelotl', 'warrior', 'soldier', 'armored', 'armoured', 'knight', 'mexica', 'aztec'], ['knight', 'veteran', 'guard'], 'sword', ''),
    ('nahualoztomeca', 'rogue', 'rogue', 'Disguised trader', 'm', 5.3,
     "A naualoztomeca, one of the merchants who went in disguise into foreign markets to listen for the Mexica: a plain rough cream "
     "maguey-fibre cloak knotted at the shoulder over a loincloth, cream sandals, his hair cut plain like a foreign commoner's, a "
     "watchful face. A pale wooden carrying frame strapped to his back with a small bundle on it. The RIGHT hand holds a broad black "
     "OBSIDIAN KNIFE with a pale wooden handle half-hidden at his chest; the LEFT hand holds a pale walking staff.",
     ['obsidian knife', 'carrying frame on the back', 'walking staff'], ['spy', 'scout', 'rogue', 'disguised merchant', 'infiltrator', 'mexica', 'aztec'], ['spy', 'scout'], None, ''),
    ('tonalpouhqui', 'caster', 'diviner', 'Day-count reader', 'm', 5.4,
     "A tonalpouhqui, a reader of the sacred count of days who named children and chose lucky days: a long cream cotton cloak "
     "(tilmatli) knotted at the right shoulder, with a broad burgundy border, over a loincloth, cream sandals, his hair long and tied back, "
     "a calm older face. Both hands hold a thick folded screenfold BOOK (pale cream deerskin pages folded like a fan, closed, with plain "
     "dark wooden covers: no pictures or signs showing) in front of his chest.",
     ['folded screenfold book', 'long cloak'], ['diviner', 'priest', 'tonalpouhqui', 'astrologer', 'calendar priest', 'caster', 'mage', 'sage', 'mexica', 'aztec'], ['priest', 'mage', 'sage'], None, ''),
    ('pochteca', 'npc', 'merchant', 'Pochteca merchant', 'm', 5.4,
     "A pochteca, a long-distance merchant of Tenochtitlan's merchant guild: a knotted cream cotton cloak with an ochre border, a "
     "loincloth, sturdy cream sandals, a big pale wooden carrying frame (cacaxtli) on his back stacked with tied bundles of cloth and a "
     "round pot, a tump-line across his forehead, a broad weathered face. The RIGHT hand holds a tall pale black-tipped wooden walking "
     "STAFF (the merchants' staff) upright beside him.",
     ['carrying frame with goods', 'walking staff'], ['merchant', 'pochteca', 'trader', 'caravan', 'mexica', 'aztec', 'npc'], ['commoner', 'noble'], 'staff', ''),
    ('market-woman', 'npc', 'commoner', 'Market woman', 'f', 5.0,
     "A woman selling in the great market of Tlatelolco: a cream cotton huipil blouse with a broad red-and-ochre woven band at the "
     "neck and hem, a wrapped ochre cueitl skirt to the calves, bare feet, her hair wound up in the two little horns of a married Mexica "
     "woman. A round, shrewd face. Both hands hold a big round woven basket heaped with yellow maize cobs and red chillies in front of her.",
     ['basket of maize and chillies', 'hair in two horns'], ['market woman', 'vendor', 'seller', 'farmer', 'commoner', 'villager', 'mexica', 'aztec', 'npc'], ['commoner'], None, ''),
    ('cihuapilli', 'npc', 'noble', 'Noblewoman', 'f', 5.1,
     "A cihuapilli, a noblewoman of Tenochtitlan: a long fine cream huipil richly woven with burgundy and ochre bands, a full skirt "
     "with a wide embroidered hem, jade-green bead necklace and ear spools, gold bracelets, her hair in the two little horns, cream "
     "sandals. A composed, regal face. Both hands hold a big round bouquet of ochre and red flowers in front of her chest.",
     ['bouquet of flowers', 'jade necklace'], ['noblewoman', 'lady', 'noble', 'cihuapilli', 'aristocrat', 'mexica', 'aztec', 'npc'], ['noble'], None, ''),
    ('amanteca', 'npc', 'craftsperson', 'Featherworker', 'm', 5.3,
     "An amanteca, a featherworker of the craftsmen's quarter who made feather mosaics for the nobles: a plain cream cloak knotted at "
     "the shoulder over a loincloth, cream sandals, short hair, a careful, absorbed face. Both hands hold up in front of his chest a "
     "round flat FEATHER-MOSAIC disc (a shield face laid with feathers in a smooth flat pattern of red, ochre, gold and jade green, the "
     "feathers lying flat like painted scales, none sticking out).",
     ['round feather-mosaic disc'], ['featherworker', 'amanteca', 'craftsman', 'artisan', 'mexica', 'aztec', 'npc'], ['commoner'], None, ''),
]


# THE SENSITIVITY READ (codex exec, 2026-11-07, BEFORE any plate: sens/prompt.md -> sens/codex-final.md, sens/codex.json):
# 2 figures replaced, 2 major and 21 minor changes, adopted here as overrides so the first design above stays on the record.
# Where codex took the blade out of a rogue's hand (a spy is not an assassin), the blade stays but is held LOW and plain, the
# face open: Harry asked for a "rouge-like" figure, and at table distance a rogue is read by a hood and a short blade.
# Keys: slug (new slug for a replaced figure: `slug`), and any of name, design, holds, shaft, lean, tags (added).
SENS = {
    'JPN': {
        'samurai': {'lean': "Full armour in Kyoto about 1850 is a military or ceremonial turn-out (the 1860s brought it back to the streets), not everyday dress; a deliberate adventuring choice."},
        'shinobi': {'name': 'Spy', 'design':
            "A late-Edo Kyoto spy in ordinary rust-brown work clothes: a short jacket bound at the waist, narrow trousers wrapped at the shins, "
            "split-toe tabi and straw sandals. A charcoal headcloth tied over his hair leaves his face visible; an attentive, quiet expression. His "
            "RIGHT hand holds a short plain TANTO knife (bright steel, as broad as two fingers) point-down close beside his right "
            "thigh; his LEFT hand holds a compact coil of thick ochre rope against his waist. No symbols.",
            'holds': ['short blade held low', 'coil of rope', 'headcloth'],
            'lean': "An imagined espionage character, not a documented Kyoto shinobi uniform; the earth colours are a production choice, not a claim about what spies wore."},
        'onmyoji': {'design':
            "An onmyoji of the yin-yang way, associated with the Tsuchimikado household that still licensed diviners and made the almanac in "
            "Kyoto, in formal dress: a round-collared pale cream kariginu robe over plum sashinuki trousers gathered at the ankles, the wide "
            "sleeves resting close to the body, black lacquered shoes and a tall black eboshi hat. An older, clean-shaven, thoughtful face. His "
            "RIGHT hand holds a closed cream folding fan upright against his chest; his LEFT forearm supports a thick closed ALMANAC bound in a "
            "plain cream cover. No writing, diagrams or talismans visible.",
            'holds': ['folding fan', 'closed almanac', 'tall black hat']},
        'doshin': {'design':
            "A doshin, a constable serving the Kyoto town magistrate, in a sober dark-ochre kimono, plain dark hakama trousers and a black haori "
            "jacket, with white tabi and straw sandals. Two sheathed swords sit at his left hip. A shaved crown, a small topknot and a watchful "
            "expression. His RIGHT hand holds a stout bright steel JITTE (a truncheon as thick as a thumb with one short side-hook) upright "
            "against his chest; his LEFT hand rests on the sword hilts. No official insignia or writing."},
        'ohara-me': {'design':
            "An Ohara-me, one of the village women who walked into Kyoto from Ohara to sell firewood: a dark brown work kimono with a pale cream "
            "pattern, white cloth arm and shin covers, straw sandals, a cream cloth over her hair, and a big round BUNDLE of pale firewood sticks "
            "balanced flat on top of her head, both hands raised to steady it. A weathered, attentive face.",
            'lean': "Her occupation is documented; her exact dress follows later pictures and is a reconstruction."},
    },
    'CHN': {
        'bannerman': {'design':
            "A Manchu bannerman in a burgundy cloth-covered brigandine armour coat with small iron plates riveted inside and rows of bright brass "
            "rivet heads outside, black edging, split armoured skirts reaching below the knees, armoured shoulder pieces and sleeves, black boots. "
            "A rounded steel helmet with a tall stout spike finial and a close padded neck guard. A clean-shaven face. His RIGHT hand holds a "
            "broad curved steel DAO sabre upright beside his right shoulder; his LEFT hand holds its dark scabbard close against his hip. No "
            "plume, no symbols.", 'holds': ['broad curved sabre', 'studded armour coat', 'spiked helmet']},
        'daoist-priest': {'design':
            "An ordained Daoist ritual specialist of a Beijing temple, standing quietly in a plain deep-ochre robe over cream, the wide sleeves "
            "resting close to his body, white socks and black cloth shoes. His forehead is unshaven; his hair forms a compact topknot beneath a "
            "plain dark cap. A short grey beard. His RIGHT hand holds a broad blunt pale PEACH-WOOD RITUAL SWORD vertically against his chest; "
            "his LEFT hand holds a small bronze HANDBELL with a short handle, its open mouth downward, against his waist. No writing, talismans "
            "or symbols.", 'holds': ['peach-wood ritual sword', 'small handbell', 'topknot cap'],
            'lean': "A ritual specialist of a real tradition; his game powers are an invention."},
        'silk-merchant': {'design':
            "A Beijing silk merchant: a long brown-plum changshan gown to the ankles under a short black magua jacket with cloth buttons, a round "
            "black skullcap with a small red knot on top, the Qing man's shaved forehead and a long braided queue lying flat down his back, black "
            "cloth shoes. A lean, shrewd face with a thin moustache. Both hands hold a fat bolt of cream and ochre silk against his chest."},
        'mandarin': {'design':
            "A Qing civil official of the fifth rank in his everyday court surcoat: a long plain black surcoat over a plum-brown robe showing at "
            "the hem and the horse-hoof cuffs, on its chest a square badge embroidered with a white pheasant among clouds (the fifth civil rank: "
            "a picture, no writing), a necklace of large round amber court beads, black boots, and the official's round hat with an upturned "
            "black brim, a red silk fringe over the crown and a clear crystal finial (the fifth rank's) on top, the long queue behind. A "
            "dignified, tired face with a neat moustache. Both hands clasped together in the sleeves in front of his waist.",
            'holds': ['official hat with a finial', 'court beads', 'square rank badge'],
            'lean': "Codex advised informal dress to avoid inventing insignia; this keeps the official's look but makes it ONE coherent rank (fifth civil: silver pheasant badge, crystal finial, court beads), since at table distance only the badge, beads and hat say 'official'."},
        'manchu-lady': {'name': 'Banner lady', 'design':
            "A woman of a prosperous Manchu banner household in Beijing about 1770: an ankle-length plum robe with a right-side fastening and "
            "restrained cream edging, a plain cream sleeveless vest, cream cloth shoes with modest thick soles over natural unbound feet. Her "
            "hair in a compact pinned bun with two small gold pins and one cream silk flower (no broad hair board). A composed expression. Both "
            "hands hold a closed pale folding fan against her waist.", 'holds': ['folding fan', 'pinned bun with a flower']},
        'vegetable-seller': {'design':
            "A market-gardener selling produce in Beijing: a faded ochre padded cotton jacket, dark brown trousers and black cloth shoes. His "
            "forehead is shaved and his queue is coiled beneath a cream headcloth. A weathered, attentive face. Both hands support one broad "
            "woven basket of green cabbages and orange persimmons against his waist, the vegetables nestled securely inside.",
            'holds': ['basket of vegetables']},
        'swordswoman': {'design':
            "A wandering swordswoman of the rivers and lakes (the xia of the storytellers): a practical fitted (not tight) jacket in moss green "
            "bound with a wide ochre sash, loose dark trousers tied at the ankle, soft black cloth shoes, her hair in a tight bun wrapped with a "
            "cream cloth, a broad bamboo hat lying flat against her back. A sharp, level gaze. Her RIGHT hand holds a straight JIAN sword (a "
            "bright steel blade two fingers wide) upright beside her shoulder; her LEFT hand holds its pale wooden scabbard down at her hip."},
    },
    'IND': {
        'harkara': {'design':
            "A harkara, a court messenger and intelligence runner: a plain cream knee-length cotton angarkha, cream trousers, a modest rust "
            "turban, a dark-ochre shawl folded close over his shoulders, leather sandals, a short dark beard and an attentive expression. His "
            "RIGHT hand holds a short KATAR push-dagger (a broad bright blade on an H-shaped grip) point-down close beside his thigh; his LEFT "
            "hand holds a closed bamboo message tube against his chest. No writing.", 'holds': ['short dagger held low', 'message tube', 'turban']},
        'jyotishi': {'design':
            "A learned jyotishi, an astronomer-astrologer of the Jaipur court in the age of its great observatory: a closed long cream jama robe, "
            "a moss-green shawl folded over his shoulders, a modest ochre turban, wooden sandals, a grey beard, a calm expression. Both hands "
            "support a big round bright BRASS ASTROLABE against his chest, with raised concentric rings and a broad central rotating rule in "
            "sturdy relief. No letters, numerals or inscriptions.", 'holds': ['big brass astrolabe']},
        'marwari-merchant': {'design':
            "A Marwari merchant of the Jaipur bazaar: a big round ochre-and-burgundy pagri turban, a cream angarkha coat tied at the side, a white "
            "dhoti, pointed red leather slippers, a thick black moustache, a lean, careful face. Both hands hold a fat red cloth-bound account "
            "ledger (a bahi-khata, closed and tied with a cream cord, no writing showing) against his chest."},
        'thakurani': {'design':
            "A thakurani, the lady of a Rajput noble house: a full ghagra skirt to the ankles in deep burgundy with a broad ochre border, hanging "
            "still, a fitted cream choli, a moss-green odhni veil drawn over her head and wrapped across the body, heavy plain gold bangles, a "
            "small nose ring and a small rounded gold borla ornament at her hair parting, bare feet with silver anklets. A composed, commanding "
            "face. Both hands hold a small bright brass oil lamp (unlit) in front of her waist."},
        'panihari': {'lean': "Her work is everyday; the exact jewellery and the stacked pots are a reconstruction, not a uniform."},
        'puppeteer': {'design':
            "A Rajasthani kathputli puppeteer: an ochre-red turban, a cream kurta, a white dhoti, a burgundy waist sash and plain sandals, a "
            "big curled moustache. Both hands cradle an inactive wooden PUPPET against his chest: a small turbaned man with a painted face, "
            "compact cloth arms and a long red skirt enclosing the lower body (kathputli have no legs), its arms resting against its skirt. No "
            "control bar, no strings.", 'holds': ['a wooden puppet in a red skirt']},
    },
    'NRS': {
        'shieldmaiden': {'lean': "An exceptional woman warrior drawing on saga traditions and the woman buried with an elite weapon set in Birka grave Bj 581: her sex is securely established, her lived military role and how common women warriors were are still argued. This figure makes an explicit fantasy choice."},
        'outlaw': {'design':
            "A Norse outlaw, a man the law has put outside its protection: a short brown wool cloak folded close over a worn moss-green tunic, "
            "brown wool trousers, leg-wraps and leather shoes, a separate close-fitting wool hood over his head. A short reddish beard and a wary "
            "expression. His RIGHT hand holds a broad single-edged SEAX knife (a wide bright blade) point-down close beside his thigh; his LEFT "
            "hand holds a small iron hand-axe with a stout pale wooden haft close against his hip.", 'holds': ['long knife held low', 'hand-axe', 'hood']},
        'volva': {'design':
            "A volva, a Norse seeress: a long cream linen underdress and a dark-burgundy wool gown, a short dark wool cloak folded close round "
            "her shoulders, a plain dark cap, a string of large amber and cream glass beads, a leather belt pouch and leather shoes. An older, "
            "attentive face. Both hands hold her tall stout dark iron ritual STAFF upright close to her body, taller than she is, its rounded "
            "bright copper-alloy finial above her head carrying shallow basket-like relief (solid, no open loops; no runes or carving).",
            'holds': ['tall staff with a round metal head', 'amber beads', 'pouch'],
            'lean': "Her look combines Viking-Age finds (the iron staffs from women's graves) with the later Icelandic saga accounts; her exact dress and her powers are reconstructed and invented."},
        'trader': {'design':
            "A Norse trader of the market towns: an ochre wool tunic with cream woven edging, a short brown wool cloak folded close and fastened "
            "with a bronze brooch, wool trousers, leather shoes, a soft wool cap, a silver arm ring, a full brown beard. Both hands hold an open "
            "shallow pale wooden case against his chest; inside lie two nested bright copper-alloy SCALE PANS, a folded balance beam and chunky "
            "weights, all flat and secure. A closed leather purse at his belt.", 'holds': ['open case with scale pans', 'purse']},
        'smith': {'design':
            "A Norse smith: a burgundy wool tunic with the sleeves rolled to his elbows, a plain brown leather apron, brown wool trousers, "
            "leg-wraps and leather shoes, short neatly kept hair and beard, a focused expression and a practical working build. His RIGHT hand "
            "holds a stout bright-headed iron HAMMER against his chest; his LEFT hand holds closed iron tongs close against his hip."},
        'jarl': {'design':
            "A jarl, a Norse chieftain at ease in his hall: a fine burgundy wool tunic with ochre woven bands at the collar and cuffs, a short "
            "cream fur-lined cloak folded close and pinned at the right shoulder with a gold brooch, wide wool trousers gathered below the knee, "
            "soft leather boots, a thick silver arm ring and a gold neck ring, a full grey-streaked beard, no helmet. His RIGHT hand holds a big "
            "pale DRINKING HORN with a bright brass rim close against his chest; his LEFT hand rests on the low lobed pommel of a sheathed sword."},
    },
    'MDE': {
        'mamluk-cavalier': {'lean': "A real military class; this one is an adventurer on foot rather than a mounted trooper."},
        'ayyar': {'slug': 'street-thief', 'name': 'Street thief', 'design':
            "A thief of the Cairo streets in ordinary working dress: a plain rust knee-length tunic over cream trousers, a broad ochre sash, soft "
            "brown leather shoes, a burgundy headwrap leaving his face open, a short dark beard, a quick, attentive expression. His RIGHT hand "
            "holds a plain short straight KNIFE (a bright blade) point-down close beside his thigh; his LEFT hand holds a small fat leather "
            "purse against his waist.", 'holds': ['short knife held low', 'leather purse', 'headwrap'],
            'tags': ['cutpurse', 'pickpocket', 'thief', 'scout'],
            'lean': "A fictional street thief, deliberately not the 'ayyarun brotherhoods (better attested for Iraq and Iran) and not the masked-dagger figure of Orientalist painting."},
        'alchemist': {'design':
            "A scholar of alchemy in 14th-century Cairo, in the tradition al-Jildaki studied: a long cream robe, a moss-green outer robe resting "
            "close to his body, a round white turban, soft yellow leather slippers, a full grey beard. Both hands cradle a compact pale amber "
            "GLASS DISTILLATION VESSEL against his chest: a rounded lower flask fitted with a domed alembic head and a short thick side spout "
            "angled inward close to his body. No writing or symbols.", 'holds': ['glass distillation vessel', 'turban']},
        'spice-merchant': {'design':
            "A prosperous Cairo merchant of the Red Sea spice trade (a Karimi): an ochre-and-cream striped robe, a burgundy outer coat, a cream "
            "turban, soft red leather slippers, a well-kept dark beard and an attentive expression. Both hands hold a bright brass sample BOWL of "
            "dark peppercorns close against his waist. No writing or insignia.", 'holds': ['brass bowl of peppercorns']},
        'khatun': {'lean': "Tall women's headgear is attested in Mamluk sources; its exact form here is a reconstruction."},
    },
    'RUS': {
        'druzhinnik': {},
        'ushkuinik': {'slug': 'river-raider', 'name': 'River raider', 'design':
            "A Novgorod river raider: a short brown wool cloak with a hood drawn up over his head, folded close over an ochre wool tunic, a plain "
            "belt, brown wool trousers and soft leather ankle shoes, a short red beard, a wary expression. His RIGHT hand holds a broad iron "
            "AXE with a pale wooden haft upright close against his shoulder; his LEFT hand holds a long broad knife point-down beside his thigh.",
            'holds': ['axe', 'long knife held low', 'hood'],
            'lean': "A fictional twelfth-century river raider, not a member of the later (14th-century) ushkuiniki."},
        'znakharka': {'name': 'Village healer', 'design':
            "A village healer of twelfth-century Rus', a practical older woman in a long cream linen shift under a plain dark-ochre wool "
            "overdress with narrow red woven edging at the cuffs, a cream headcloth covering her hair, soft brown leather shoes. Both hands "
            "hold a small clay JAR and a compact tied BUNDLE of dried herbs against her chest. An attentive, composed expression.",
            'holds': ['bundle of herbs', 'clay jar', 'headcloth'], 'shaft': None,
            'lean': "A healer of an already Christian Rus'; her powers, if any, are a game invention."},
        'kupets': {'design':
            "A Novgorod merchant of the fur trade: a rounded fur-edged cap, a restrained long burgundy outer coat to mid-calf belted with a cream "
            "sash, leather boots, a long full brown beard, a careful face. Both hands hold a thick bundle of dark brown sable pelts tied together "
            "against his chest.", 'holds': ['bundle of furs', 'fur-edged cap']},
        'princess': {'design':
            "A princess of a twelfth-century Rus' ruling house: a straight burgundy silk gown with ochre-gold woven bands at the collar, cuffs and "
            "hem, a cream mantle folded close over her shoulders, a rounded cloth cap and a cream veil over her hair, and two round gold KOLTY "
            "temple pendants hanging from short broad attachments at the sides of her headdress beside her cheeks (resting on the veil, not in "
            "her ears), a gold bead necklace at her collar. A young, serious face. Her hands clasped at her waist.",
            'holds': ['round gold temple pendants', 'veil']},
        'carpenter': {'design':
            "A Novgorod carpenter, a builder of log houses: a cream linen shirt belted with a plain woven sash, the sleeves rolled to the elbows, "
            "brown wool trousers, leg-wraps and soft brown leather shoes, neatly kept hair and beard, a practical, attentive expression. His "
            "RIGHT hand holds a broad iron CARPENTER'S AXE with a bright blade and a pale haft close against his shoulder; his LEFT hand holds a "
            "pale wooden mallet against his hip."},
        'peasant-woman': {'design':
            "A village woman of the Novgorod lands at harvest: a long cream linen shift under a plain burgundy wool overdress with narrow ochre "
            "woven edging at the cuffs, a cream headcloth over a plain cap, brown leather shoes, a sun-weathered, attentive face. Her RIGHT hand "
            "holds a bright iron SICKLE close in front of her waist, its curved blade turned inward; her LEFT arm holds a compact golden sheaf of "
            "rye against her body."},
    },
    'MES': {
        'jaguar-warrior': {'design':
            "A high-status Mexica jaguar warrior (ocelotl) of the military orders: a fitted jaguar-patterned war suit of close-laid featherwork "
            "over quilted cream cotton torso armour, ochre-gold with dark rosettes, rendered as smooth painted texture (no projecting feathers); a "
            "constructed jaguar-head helmet framing his visible face within its open jaws; plain sandals. His RIGHT hand holds a broad pale wooden "
            "MACUAHUITL with black obsidian blades set along both edges upright beside his shoulder; his LEFT arm holds a compact round woven "
            "CHIMALLI shield in plain cream and burgundy fields against his body.",
            'lean': "The suit is a constructed featherwork garment, simplified for the miniature; the plumes and shield feathers are left off."},
        'nahualoztomeca': {'name': 'Merchant spy', 'design':
            "A Mexica merchant who gathers news in foreign markets in disguise (a naualoztomecatl), in modest travelling dress: a short rough "
            "cream maguey-fibre mantle knotted at the shoulder and lying close to his body, a loincloth and plain travel sandals, his dark hair "
            "simply tied, an attentive expression. A small wrapped trade bundle sits on a compact pale wooden carrying frame on his back. His "
            "LEFT hand holds a stout pale walking STAFF close in front of him; his RIGHT hand holds a small black OBSIDIAN KNIFE with a pale "
            "handle point-down, half hidden beside his thigh.", 'holds': ['walking staff', 'carrying frame on the back', 'small knife held low']},
        'tonalpouhqui': {'design':
            "A tonalpouhqui, a reader of the sacred count of days who named children and chose good days: a long cream cotton cloak (tilmatli) "
            "knotted at the right shoulder with a broad burgundy border, over a loincloth, cream sandals, his hair long and tied back, a calm "
            "older face. Both hands hold a thick folded screenfold BOOK, closed, its painted pages hidden between plain dark wooden covers, in "
            "front of his chest.", 'lean': "A respected diviner of a real tradition, not a 'temple priest'; his game powers are an invention."},
        'pochteca': {'name': 'Pochtecatl merchant'},
        'cihuapilli': {'design':
            "A cihuapilli, a noblewoman of Tenochtitlan: a fine cream huipil woven with burgundy and ochre bands over a straight wrapped cueitl "
            "skirt with a broad decorated lower border, a necklace and ear ornaments of dark olive-green stone, small plain gold bracelets, simple "
            "sandals, her hair in two compact raised rolls at the sides of her forehead (clearly hair). A composed expression. Both hands hold a "
            "rounded bunch of ochre and red flowers with short hidden stems against her chest. No blue-green colours.",
            'holds': ['bouquet of flowers', 'green stone necklace']},
        'amanteca': {'design':
            "An amantecatl, a featherworker of the craftsmen's quarter who made feather mosaics for the nobles: a plain cream cloak knotted at "
            "the shoulder over a loincloth, cream sandals, short hair, a careful, absorbed face. Both hands hold up in front of his chest a round "
            "flat FEATHER-MOSAIC disc (a shield face laid with feathers in a smooth flat pattern of red, ochre, gold and olive-moss green, the "
            "feathers lying flat like painted scales, none sticking out; no teal or cyan)."},
        'market-woman': {'design':
            "A woman selling in the great market of Tlatelolco: a cream cotton huipil blouse with a broad red-and-ochre woven band at the neck and "
            "hem, a wrapped ochre cueitl skirt to the calves, bare feet, her hair in two compact raised rolls at the forehead (a married Mexica "
            "woman's style). A round, shrewd face. Both hands hold a big round woven basket heaped with yellow maize cobs and red chillies in "
            "front of her.", 'holds': ['basket of maize and chillies']},
    },
}


# THE NAME a figure is listed and searched by: the culture's word first ("Norse smith"), so a plain "smith" in the bar still
# finds the house's own smith first (client/figsearch.js gives the bonus to a name that IS, or starts with, the words typed);
# the tile under its culture's heading says only `short` ("Smith"). A name that already says its people keeps it alone.
ADJ = {'JPN': 'Japanese', 'CHN': 'Chinese', 'IND': 'Rajasthani', 'NRS': 'Norse', 'MDE': 'Mamluk', 'RUS': "Rus'", 'MES': 'Mexica'}
PROPER = {'Daoist'}
OWN_WORD = ('ohara', 'rajput', 'marwari', 'mamluk', 'pochtecatl')
DROP_TAGS = {'ushkuinik', 'ayyar', 'futuwwa'}   # (names the sensitivity read took off these figures)


def rows():
    out = []
    for code, kin, period, words in CULTURES:
        for row in R[code]:
            slug = row[0]; o = SENS.get(code, {}).get(slug, {})
            (slug, role, cls, name, g, h, design, holds, tags, srd, shaft, lean) = (o.get('slug', slug), row[1], row[2], o.get('name', row[3]), row[4], row[5],
                                                                                o.get('design', row[6]), o.get('holds', row[7]), row[8] + o.get('tags', []), row[9], o.get('shaft', row[10]), o.get('lean', row[11]))
            full = name if any(w in name.lower() for w in OWN_WORD) else f"{ADJ[code]} {name if name.split()[0] in PROPER else name[0].lower() + name[1:]}"
            out.append({'id': f"cul-{code.lower()}-{slug}", 'setting': code, 'kin': kin, 'period': period, 'role': role, 'cls': cls,
                        'name': full, 'short': name, 'gender': g, 'height_ft': h, 'design': design, 'holds': holds,
                        'tags': list(dict.fromkeys([t for t in tags if t not in DROP_TAGS] + words + (['woman'] if g == 'f' else ['man']) + ({'fighter': ['fighter', 'armored fighter'], 'rogue': ['rogue'], 'caster': ['caster', 'spellcaster']}.get(role, ['npc', 'townsfolk'])))),
                        'srd': srd, 'shaft': shaft, 'lean': lean, 'sens': 'changed' if o else 'as written'})
    return out


def grid_rows():
    """THE GRID (grid.py): six fantasy races x {fighter, rogue, caster} per culture, beside the human row above."""
    import grid as G
    A = {a['id']: a for a in json.loads((Path('experiments/2026-10-06-figures/set/assets.json')).read_text())['assets']}
    SRD = {'fighter': ['knight', 'veteran', 'guard'], 'rogue': ['spy', 'scout', 'bandit'], 'caster': ['mage', 'priest', 'acolyte']}
    out = []
    for ci, (code, kin, period, words) in enumerate(CULTURES):
        for ri, race in enumerate(G.RACES):
            for oi, role in enumerate(('fighter', 'rogue', 'caster')):
                g = 'f' if (ri + oi + ci) % 2 == 0 else 'm'
                house = A[f'hero-fighter-{race}-{g}']
                body = house['prompt'].split('Specific design:')[1].strip().split(';')[0]   # the house set's own words for this race and sex
                dress, kits = G.K[code][role]
                kk = kits[(ri + oi) % len(kits)]; word, kit = kk[0], kk[1]
                dress = kk[2] if len(kk) > 2 else (dress[g] if isinstance(dress, dict) else dress)
                rw = G.RACE_WORD[race]
                design = f"{dress[0].upper() + dress[1:]}. {kit}"
                if race in ('tiefling', 'dragonborn') and role == 'fighter': design += f" The helmet is shaped to sit over the {'horns' if race == 'tiefling' else 'crest of horns'}, which curve out close below its rim."
                if race == 'tiefling': design += ' The tail hangs straight down close behind the legs.'
                out.append({'id': f"cul-{code.lower()}-{race}-{role}", 'setting': code, 'kin': kin, 'period': period, 'role': role, 'cls': role,
                            'name': f"{ADJ[code]} {rw} {word}", 'short': f"{rw} {word}", 'tile': word[0].upper() + word[1:], 'race': race, 'gender': g,
                            'height_ft': house['height_ft']['body'], 'people': f"{body}; this one has {G.COLOUR[race][ci]}", 'design': design,
                            'holds': [], 'tags': list(dict.fromkeys(words + [rw, race, word, role, 'woman' if g == 'f' else 'man', 'fantasy race'] + (['armored fighter', 'warrior'] if role == 'fighter' else ['spellcaster'] if role == 'caster' else ['thief']))),
                            'srd': SRD[role], 'shaft': None, 'lean': f"A {rw} in the dress of {period}: a fantasy race in a historical setting, by design.", 'sens': 'grid'})
    return out


if __name__ == '__main__':
    rs = rows()
    for r in rs: r.setdefault('race', 'human'); r.setdefault('tile', r['short'])
    rs += grid_rows()
    (HERE / 'roster.json').write_text(json.dumps({'cultures': [{'setting': c, 'kin': k, 'period': p} for c, k, p, _ in CULTURES], 'figures': rs}, indent=1, ensure_ascii=False) + '\n')
    from collections import Counter
    print(len(rs), 'figures;', dict(Counter(r['setting'] for r in rs)), 'women', sum(r['gender'] == 'f' for r in rs), dict(Counter((r['role'], r['gender']) for r in rs)))
