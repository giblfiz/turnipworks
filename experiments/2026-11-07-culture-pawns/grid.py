"""THE GRID (Harry 2026-11-07, scope change: "each race was dragon born /dwarf/ect. So our grid needs a hindu-teifling-
warrior option"): culture x fantasy race x {armoured fighter, rogue, caster}. The human row is the roster's own fighter,
rogue and caster (roster.py); this file adds the other six races of the house set (elf, dwarf, small-folk, orc,
tiefling, dragonborn), in the culture's period dress, on the house set's own body plate for that race and sex.

Each culture has, per role, ONE dress (race-neutral: no beards, faces or hair in it) and three KITS (what is held, and a
detail), cycled over the six races so a culture's row is not seven clones. The sensitivity read's corrections to the
human figures are carried over (rogues: a short plain blade held low, face open; no writing; olive not teal; leather
shoes in Rus'; no sacred thread or temple dress on anyone). Fantasy races in historical dress are a fantasy choice by
definition (every row says so); nothing here is meant to caricature the human culture.
Row: (role word for the name, kit text[, its own dress]). A dress may be {'f': ..., 'm': ...} (the second sensitivity read,
sens2/: Mexica women in huipilli and cueitl, not the men's mantle; a Norse man's tunic beside the gown). Genders alternate.
Sensitivity read of THIS grid before any plate: sens2/codex-final.md (all 126 race x culture x role kept; changes folded in)."""

RACES = ['elf', 'dwarf', 'small', 'orc', 'tiefling', 'dragonborn']
RACE_WORD = {'elf': 'elf', 'dwarf': 'dwarf', 'small': 'halfling', 'orc': 'orc', 'tiefling': 'tiefling', 'dragonborn': 'dragonborn'}
# colouring for each race's figure in each culture, so the six do not repeat one look (index = culture order)
COLOUR = {
    'elf': ['warm brown skin and straight black hair', 'pale skin and black hair', 'deep brown skin and black hair', 'pale skin and honey-blond hair', 'olive skin and dark hair', 'fair skin and light brown hair', 'copper-brown skin and black hair'],
    'dwarf': ['brown skin and a black beard or braids', 'tan skin and grey braids', 'deep brown skin and black braids', 'ruddy skin and a red beard or braids', 'olive skin and a dark beard or braids', 'fair skin and a brown beard or braids', 'copper-brown skin and black braids'],
    'small': ['brown skin and black curls', 'tan skin and black curls', 'warm brown skin and grey curls', 'freckled skin and ginger curls', 'olive skin and dark curls', 'fair skin and brown curls', 'copper-brown skin and black curls'],
    'orc': ['grey-green skin and a black topknot', 'grey-green skin and a shaved head', 'grey-green skin and long black braids', 'grey-green skin and a ginger braid', 'grey-green skin and cropped dark hair', 'grey-green skin and a dark topknot', 'grey-green skin and long black hair'],
    'tiefling': ['brick-red skin and black hair', 'ash-grey skin and black hair', 'dark red skin and long black hair', 'brick-red skin and a shaved head', 'dark red skin and black hair', 'ash-grey skin and dark hair', 'brick-red skin and long black hair'],
    'dragonborn': ['bronze-gold scales', 'copper-red scales', 'brass-yellow scales', 'copper-red scales', 'bronze-gold scales', 'brass-yellow scales', 'copper-red scales'],
}

K = {}
K['JPN'] = {
    'fighter': ("in Edo-period armour (tosei-gusoku): a lacquered burgundy cuirass of horizontal plates laced with ochre cord, broad layered shoulder guards, a skirt of plates, armoured sleeves and shin guards over dark hakama, straw sandals, a rounded helmet with a flared neck guard and a small plain brass front plate (no crest symbol), the face open",
                [('samurai spear warrior', "Both hands hold a straight YARI spear upright in front of the body, its pale ash shaft as thick as a wrist, its bright steel blade above the helmet. Two swords in dark scabbards at the left hip."),
                 ('naginata warrior', "Both hands hold a NAGINATA upright beside the body: a pale ash shaft as thick as a wrist with a broad curved bright steel blade above the helmet. One short sword at the left hip."),
                 ('samurai swordsman', "The RIGHT hand holds a drawn KATANA upright in front of the right shoulder (a bright steel blade as broad as two fingers); the LEFT hand holds its dark scabbard close at the hip.")]),
    'rogue': ("in ordinary late-Edo working clothes in rust-brown and charcoal grey: a short jacket bound at the waist, narrow trousers wrapped at the shins, split-toe tabi and straw sandals, a headcloth tied over the hair leaving the face visible",
              [('spy', "The RIGHT hand holds a short plain TANTO knife point-down close beside the thigh; the LEFT hand holds a compact coil of thick ochre rope against the waist."),
               ('gambler', "A short black haori jacket over the work clothes. The RIGHT hand holds a short plain dagger (tanto) point-down beside the thigh; the LEFT hand holds a small pale wooden dice cup against the chest."),
               ('night thief', "A short dark cloak folded close. The RIGHT hand holds a short straight blade point-down beside the thigh; the LEFT hand holds a small closed paper lantern (plain, no writing) at the hip.")]),
    'caster': ("in the formal dress of a Kyoto diviner of the yin-yang way: a round-collared pale cream kariginu robe over plum sashinuki trousers gathered at the ankles, the wide sleeves resting close to the body, black lacquered shoes, a tall black eboshi hat (the formal, ceremonial turn-out of a diviner)",
               [('onmyoji', "The RIGHT hand holds a closed cream folding fan upright against the chest; the LEFT forearm supports a thick closed ALMANAC in a plain cream cover. No writing, diagrams or talismans."),
                ('onmyoji', "Both hands hold a plain pale wooden DIVINING BOARD (a square board with a round disc set in it, sturdy, no marks on it) upright in front of the chest."),
                ('physician', "Both hands support a pale lacquered MEDICINE CHEST with small drawers (no writing) in front of the chest: a Kyoto physician of herbal medicine.",
                 "in plain late-Edo professional dress: a charcoal kosode secured with an obi, a plain brown haori without crests, white tabi and straw sandals, no hat")]),
}
K['CHN'] = {
    'fighter': ("in Qing banner armour: a burgundy cloth-covered brigandine coat with rows of bright brass rivet heads, black edging, split armoured skirts below the knees, armoured shoulder pieces and sleeves, black boots, a rounded steel helmet with a tall stout spike finial and a close padded neck guard, no plume, no symbols",
                [('bannerman', "The RIGHT hand holds a broad curved steel DAO sabre upright beside the right shoulder; the LEFT hand holds its dark scabbard close against the hip."),
                 ('spearman', "Both hands hold a straight QIANG spear upright, its pale shaft as thick as a wrist, a small red tassel bound tight under its bright steel head above the helmet."),
                 ('bannerman', "The RIGHT hand holds a curved single-edged DAO sabre upright beside the shoulder; the LEFT arm holds a round woven rattan shield painted plain ochre close in front of the hip.")]),
    'rogue': ("in practical mid-Qing working clothes: a short fitted jacket bound with a wide sash, loose dark trousers tied at the ankle, soft black cloth shoes, a plain dark headcloth or cap over the hair (no topknot), a broad bamboo hat lying flat against the back, the face open",
              [('wandering scout', "The RIGHT hand holds a short plain straight knife point-down beside the thigh; the LEFT hand holds a compact cloth travel bundle against the waist."),
               ('cutpurse', "The RIGHT hand holds a short plain knife point-down close beside the thigh; the LEFT hand holds a small fat silk purse against the waist."),
               ('night runner', "A dark hood-cloth over the head, the face open. The RIGHT hand holds one short plain single-edged knife point-down beside the thigh; the LEFT hand holds a coil of thick rope at the waist.")]),
    'caster': ("as a Daoist ritual specialist in a plain everyday deep-ochre robe over cream (not a full liturgical vestment), the wide sleeves resting close to the body, white socks and black cloth shoes, a plain dark cap",
               [('Daoist priest', "The RIGHT hand holds a broad blunt pale PEACH-WOOD RITUAL SWORD vertically against the chest; the LEFT hand holds a small bronze handbell, mouth down, at the waist. No writing, talismans or trigrams."),
                ('geomancer', "Both hands hold a round flat pale wooden GEOMANCER'S COMPASS (a luopan: plain concentric rings in relief and a small needle, NO characters or symbols on it) in front of the chest.",
                 "in a plain long brown robe with a right-side fastening, cream trousers, black cloth shoes and a modest dark cap"),
                ('herbal physician', "Both hands hold a pale wooden MEDICINE BOX with small drawers and a brass handle in front of the chest. No writing.",
                 "in a plain long charcoal robe with a right-side fastening, cream trousers, black cloth shoes and a modest dark cap")]),
}
K['IND'] = {
    'fighter': ("in the war dress of an 18th-century Rajasthani soldier (THE TURBAN AND THE FLARED COAT ARE WHAT SAY RAJASTHAN: no Ottoman or Persian helmet, no mail curtain): a big wrapped Rajasthani PAGRI turban in bright saffron and red wave-dyed (leheriya) stripes wound over a hidden steel cap, a knee-length padded coat flaring like a skirt below the waist and studded all over with small brass studs (a chilta) in deep burgundy, a bright saffron patka sash tied at the waist with its ends hanging in front, steel arm guards, tight cream trousers gathered at the ankle, pointed red leather jutti shoes with curled toes",
                [('warrior', "The RIGHT hand holds a curved TALWAR sword (a wide bright steel blade) upright in front of the right shoulder; the LEFT arm holds a round DHAL shield of dark-ochre hide with four bright brass bosses close in front of the hip."),
                 ('spear warrior', "Both hands hold a straight BARCHHA spear upright, its pale shaft as thick as a wrist, its broad bright steel head above the helmet. A round dhal shield slung on the back."),
                 ('mace warrior', "The RIGHT hand holds a flanged steel GURZ mace (a big bright head on a thick shaft) upright against the right shoulder; the LEFT arm holds a round dhal shield with four brass bosses close in front of the hip.")]),
    'rogue': ("in Jaipur bazaar dress (the turban and the dyed cloth say Rajasthan): a big wrapped Rajasthani turban in bright red and saffron tie-dyed dots (bandhani), a cream knee-length angarkha flaring below the waist and tied at the side, cream trousers gathered at the ankle, a rust patka sash, a dark-ochre shawl folded close over one shoulder, pointed red leather jutti shoes, the face open",
              [('court spy', "The RIGHT hand holds a short KATAR push-dagger (a broad bright blade on an H-shaped grip) point-down close beside the thigh; the LEFT hand holds a closed bamboo message tube against the chest. No writing."),
               ('cutpurse', "The RIGHT hand holds a short plain curved knife point-down beside the thigh; the LEFT hand holds a small fat cloth purse tied with a cord against the waist."),
               ('scout', "A short dark-ochre hooded shawl over the head, the face open. The RIGHT hand holds a short straight knife point-down beside the thigh; the LEFT hand holds a coil of thick cream rope at the waist.")]),
    'caster': ({'m': "in the dress of a learned man of the Jaipur court (the turban and the flared jama say Rajasthan): a long cream jama robe fitted at the chest and flaring wide below the waist, a moss-green shawl folded over the shoulders, a big round Rajasthani pagri turban in ochre and red stripes, pointed soft leather jutti shoes (no sacred thread, no forehead mark)",
                'f': "in the dress of a learned woman of the Jaipur court (the veil and the dyed cloth say Rajasthan): a full ankle-length ghagra skirt in deep burgundy with a broad ochre border, a fitted cream choli and a long cream kurti, a bright red-and-ochre tie-dyed (bandhani) odhni veil drawn over the head and wrapped across the body, plain gold bangles, pointed soft leather jutti shoes (no forehead mark)"},
               [('astrologer', "Both hands support a big round bright BRASS ASTROLABE against the chest, with raised concentric rings and a broad rotating rule in sturdy relief. No letters or numerals."),
                ('physician', "A vaidya, a physician of the court: both hands hold a bright brass MORTAR AND PESTLE against the chest, a tied bundle of dried herbs at the belt."),
                ('scholar', "Both hands hold a closed rectangular bundle of PAPER MANUSCRIPT folios between plain dark covers, tied with a cord, against the chest. No writing visible.")]),
}
K['NRS'] = {
    'fighter': ("in Viking-Age war gear: a knee-length mail byrnie over a burgundy wool tunic, a broad leather belt, wool trousers with leg-wraps, leather shoes, a plain rounded steel helmet with a short nose guard (NO horns, NO wings)",
                [('spear warrior', "The RIGHT hand holds a broad leaf-bladed SPEAR upright, its pale ash shaft as thick as a wrist; the LEFT arm holds a big ROUND wooden shield painted in two plain halves of cream and burgundy with a bright steel boss, close in front of the body."),
                 ('axe warrior', "Both hands hold a long-hafted broad DANE AXE upright beside the body, its pale haft as thick as a wrist, its bright crescent head above the helmet."),
                 ('sword warrior', "The RIGHT hand holds a broad straight SWORD with a low lobed pommel upright in front of the right shoulder; the LEFT arm holds a round ochre-and-cream shield with a bright steel boss close in front of the body.")]),
    'rogue': ("in plain worn wool: a short brown wool cloak folded close over a moss-green tunic, brown wool trousers, leg-wraps and leather shoes, a separate close-fitting wool hood, the face open",
              [('outlaw', "The RIGHT hand holds a broad single-edged SEAX knife point-down close beside the thigh; the LEFT hand holds a small iron hand-axe with a stout pale haft against the hip."),
               ('scout', "The RIGHT hand holds a long broad knife point-down beside the thigh; the LEFT hand holds a coil of thick cream rope against the waist."),
               ('thief', "The RIGHT hand holds a short plain knife point-down beside the thigh; the LEFT hand holds a small fat leather purse and a silver arm ring against the waist.")]),
    'caster': ({'f': "in a long dark-burgundy wool gown over a cream linen underdress, a short dark wool cloak folded close round the shoulders, a string of large amber and cream glass beads, a leather belt pouch, leather shoes",
                'm': "in a burgundy wool tunic over cream linen, wool trousers, a belt with a leather pouch and a short dark wool cloak folded close, leather shoes"},
               [('seer', "Both hands hold a tall stout dark iron ritual STAFF upright close to the body, taller than the figure, its rounded bright copper-alloy finial carrying shallow basket-like relief (solid, no open loops; no runes or carving)."),
                ('herb healer', "Both hands hold a small clay JAR and a compact tied BUNDLE of dried herbs against the chest; a bunch of iron keys at the belt."),
                ('skald', "Both hands hold a small pale wooden LYRE (a round-ended Viking-Age lyre, its strings drawn as thick painted lines on a solid face) against the chest.")]),
}
K['MDE'] = {
    'fighter': ("in Mamluk war gear: a knee-length coat of small steel lamellar plates over mail, an ochre short-sleeved silk surcoat over it, a rounded steel helmet with a short point wrapped with a cream turban cloth, a mail neck curtain, burgundy trousers, soft red leather boots",
                [('cavalier', "The RIGHT hand holds a flanged steel MACE upright in front of the right shoulder (a big bright head on a thick shaft); the LEFT arm holds a small round shield of cream cane wrapped with burgundy thread and a bright steel boss close in front of the hip. No writing anywhere."),
                 ('lancer', "Both hands hold a straight LANCE upright, its pale shaft as thick as a wrist, its narrow bright steel head above the helmet. A small round shield slung on the back. No writing."),
                 ('swordsman', "The RIGHT hand holds a broad straight double-edged SWORD upright in front of the right shoulder; the LEFT arm holds a small round cane shield close in front of the hip. No writing.")]),
    'rogue': ("in ordinary Cairo working dress: a plain rust knee-length tunic over cream trousers, a broad ochre sash, soft brown leather shoes, a burgundy headwrap leaving the face open",
              [('street thief', "The RIGHT hand holds a plain short straight KNIFE point-down close beside the thigh; the LEFT hand holds a small fat leather purse against the waist."),
               ('scout', "The RIGHT hand holds a short knife point-down beside the thigh; the LEFT hand holds a coil of thick cream rope against the waist."),
               ('smuggler', "A short brown cloak folded close. The RIGHT hand holds a short knife point-down beside the thigh; the LEFT arm holds a small tied cloth bale against the hip.")]),
    'caster': ("in a scholar's dress of 14th-century Cairo: a long cream robe, a moss-green outer robe resting close to the body, a round white turban or a cream head-wrap, soft yellow leather slippers",
               [('alchemist', "Both hands cradle a compact pale amber GLASS DISTILLATION VESSEL against the chest: a rounded lower flask with a domed alembic head and a short thick side spout angled inward. No writing."),
                ('astrologer', "Both hands support a big round bright BRASS ASTROLABE against the chest, raised concentric rings and a broad rule in sturdy relief, no letters or numerals."),
                ('physician', "A physician of the great hospital: both hands hold a bright brass MORTAR AND PESTLE against the chest; a small leather case of instruments at the belt.")]),
}
K['RUS'] = {
    'fighter': ("in the war gear of a prince's retinue in 12th-century Rus': a long mail shirt to the knees over a burgundy quilted tunic, a tall conical steel helmet with a little spire and a mail curtain round the neck, leather boots",
                [('druzhina warrior', "The RIGHT hand holds a broad straight double-edged SWORD upright in front of the right shoulder; the LEFT arm holds a tall almond-shaped (teardrop) wooden shield painted burgundy with a cream rim close in front of the body. No symbols."),
                 ('axe warrior', "The RIGHT hand holds a broad bearded war AXE with a pale haft upright against the shoulder; the LEFT arm holds a round burgundy shield with a bright steel boss close in front of the body."),
                 ('spear warrior', "Both hands hold a broad-bladed SPEAR upright, its pale shaft as thick as a wrist; a teardrop shield slung on the back.")]),
    'rogue': ("in plain wool: a short brown wool cloak with a hood drawn up, folded close over an ochre wool tunic, a plain belt, brown wool trousers and soft leather ankle shoes, the face open",
              [('river raider', "The RIGHT hand holds a broad iron AXE with a pale haft upright close against the shoulder; the LEFT hand holds a long broad knife point-down beside the thigh."),
               ('cutpurse', "The RIGHT hand holds a short plain knife point-down beside the thigh; the LEFT hand holds a small fat leather purse against the waist."),
               ('scout', "The RIGHT hand holds a long knife point-down beside the thigh; the LEFT hand holds a coil of thick cream rope against the waist.")]),
    'caster': ("in plain dress of 12th-century Rus': a long cream linen shift under a plain dark-ochre wool overdress or long coat with narrow red woven edging at the cuffs, a cream headcloth or a plain wool cap, soft brown leather shoes",
               [('healer', "Both hands hold a small clay JAR and a compact tied BUNDLE of dried herbs against the chest."),
                ('herbalist', "Both hands hold a shallow birch-bark BASKET heaped with dried herbs and roots against the waist."),
                ('wise elder', "Both hands hold a tall gnarled pale wooden STAFF upright close beside the body; a small leather pouch at the belt.")]),
}
MARK_MES = "(WHAT SAYS MEXICA at table distance, not Greek or Roman, not Polynesian: big round green-stone EAR SPOOLS, bold flat bands of red, black and ochre geometric pattern on the cloth, a SHORT cloak knotted on ONE shoulder, bare legs with sandals)"
K['MES'] = {
    'fighter': ("in Mexica war dress " + MARK_MES + ": quilted cream cotton armour (ichcahuipilli) over the torso, cream sandals, the face open, a round CHIMALLI shield edged with a short fringe of flat feathers lying close",
                [('jaguar warrior', "Over the armour a carefully fitted, MANUFACTURED jaguar-patterned war suit of close-laid featherwork (ochre-gold with dark rosettes, smooth, no projecting feathers) and a constructed jaguar-head helmet framing the wearer's own face, clearly distinct, in its open jaws (no blood, no torn hide, no extra fangs, no crouch). The RIGHT hand holds a broad pale wooden MACUAHUITL with black obsidian blades along both edges upright beside the shoulder; the LEFT arm holds a round woven CHIMALLI shield in plain cream and burgundy fields against the body."),
                 ('eagle warrior', "Over the armour a carefully fitted, MANUFACTURED war suit of close-laid ochre-brown and cream featherwork (smooth, no projecting feathers) and a constructed eagle-head helmet framing the wearer's own face, clearly distinct, in its open beak. Both hands hold a TEPOZTOPILLI thrusting spear upright: a pale shaft as thick as a wrist and a broad wooden head edged with black obsidian above the helmet."),
                 ('cuextecatl warrior', "Over the armour a carefully fitted, MANUFACTURED red featherwork war suit (smooth, no projecting feathers) with a tall CONICAL red-and-black cap (the cuextecatl suit of the Mexica army). The RIGHT hand holds a broad pale wooden MACUAHUITL edged with black obsidian upright beside the shoulder; the LEFT arm holds a round ochre chimalli shield with a black geometric band against the body.")]),
    'rogue': ({'m': "in modest Mexica travelling dress " + MARK_MES + ": a short rough cream maguey-fibre mantle knotted on the right shoulder with a bold red-and-black geometric border, a red loincloth, bare legs, plain travel sandals, the face open",
               'f': "in modest Mexica travelling dress " + MARK_MES + ": a cream rectangular huipilli blouse with a bold red-black-ochre geometric band at the neck and hem over a calf-length wrapped cueitl skirt secured with a woven sash, plain sandals, the face open"},
              [('merchant spy', "A compact wrapped trade load on the back on broad carrying straps, with a load-bearing strap across the forehead where the head allows. The LEFT hand holds a stout pale walking staff close in front; the RIGHT hand holds a small black OBSIDIAN KNIFE with a pale handle point-down, half hidden beside the thigh."),
               ('scout', "The RIGHT hand holds a small black obsidian knife point-down beside the thigh; the LEFT hand holds a coil of thick cream maguey rope at the waist."),
               ('thief', "The RIGHT hand holds a small black obsidian knife point-down beside the thigh; the LEFT hand holds a small cloth bag of cacao beans against the waist.")]),
    'caster': ({'m': "in Mexica dress " + MARK_MES + ": a cream cotton cloak (tilmatli) knotted on the right shoulder and reaching the knees, with a broad bold border of red, black and ochre geometric bands, over a loincloth, bare legs, cream sandals",
                'f': "in Mexica dress " + MARK_MES + ": a cream huipilli blouse with broad bold bands of red, black and ochre geometric pattern over an ankle-length wrapped cueitl skirt secured with a woven sash, cream sandals"},
               [('day-count reader', "Both hands hold a thick folded screenfold BOOK, closed, its painted pages hidden between plain dark wooden covers, in front of the chest."),
                ('healer', "A ticitl, a healer: both hands hold a shallow woven basket of dried herbs with a small clay bowl of maize kernels on top against the waist."),
                ('painter-scribe', "A tlacuilo, a painter of books: the RIGHT hand holds a thick reed brush upright; the LEFT hand holds a small closed folded book and a little clay paint pot against the chest.")]),
}
ROLE_FALLBACK = {'fighter': 'fighter', 'rogue': 'rogue', 'caster': 'caster'}
