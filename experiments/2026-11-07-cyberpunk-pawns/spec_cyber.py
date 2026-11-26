#!/usr/bin/env python3
"""The CYBERPUNK figures (Harry 2026-11-07: "Did we make a pawn pack for shadowrun? Just like decker/street sam/shaman/
mage whatever orc / dwarf/troll. Also NPCs for modern. And while we are at it add a robot race."): runners (an archetype
kit written once, worn by a spread of metatype bodies), modern NPCs, and a robot people. Made with the default set's own
spec code (../2026-10-06-figures/set_spec.py: `fig`, the pose rules, the gate's must-nots, the body-reference heads),
read without rewriting the set's files, with this pack's own STYLE (the set's words, plus cyberpunk accents; the blue
mask rule kept). Generic cyberpunk-fantasy: no publisher's names, logos, insignia or text on any figure.
    python3 spec_cyber.py            -> set/assets.json, set/prompts/<id>.spec.md
Groups: body (reference plates only, never meshed), runner, modern, robot."""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent; FIG = HERE.parent / "2026-10-06-figures"
MAIN = Path("experiments/2026-10-06-figures")   # the set's plates (binaries) live in the main checkout
SETIN = MAIN / "set/inputs"; MYIN = HERE / "set/inputs"
src = (FIG / "set_spec.py").read_text(); src = src[:src.index("exec(open(HERE / 'set_more.py')")]
src = src[:src.index("n = 0\nfor c in CLASSES:")]       # the definitions only: no hero loop, no townsfolk
ns = {"__file__": str(FIG / "set_spec.py"), "__name__": "set_spec"}; exec(compile(src, str(FIG / "set_spec.py"), "exec"), ns)
ns["F"].clear()
fig, RACES = ns["fig"], ns["RACES"]

# ------------------------------------------------------------------ the pack's style: the set's, with cyberpunk accents
ns["STYLE"] = ns["STYLE"].replace(
    "Held things: BROAD and chunky, never thin: wide blades, big heads on hammers, maces, staffs and spears, thick shafts. They are PALE or BRIGHT (bone-white wood, bright steel, cream, brass) against the clothes and skin, never plain dark wood-brown, so they show when the figure is seen small from above.",
    "Held things: BROAD and chunky, never thin. GUNS are oversized tabletop-miniature guns with thick barrels and big simple blocky shapes, painted bright warm-grey steel with cream, ochre or magenta panels, NEVER thin and never plain black. Blades are wide and bright steel. Every held thing is PALE or BRIGHT against the clothes and skin so it shows when the figure is seen small from above.\n"
    "Setting: a gritty near-future city where magic has returned: street clothes, armoured jackets, cybernetic limbs. CYBERWARE (a metal arm, a metal eye, a jack at the temple) is sculpted as thick rounded plates of warm chrome-grey steel with amber or magenta accents.").replace(
    "Palette: rich but softened burgundy, moss green, ochre, cream, warm honey leather and wood, warm grey steel, used where they suit the figure.",
    "Palette: the house colours (rich but softened burgundy, moss green, ochre, cream, warm honey leather, warm grey steel, black leather) with cyberpunk ACCENTS used sparingly: hot magenta-pink, acid lime-green, bright amber-orange. Neon and lights are PAINTED colours, never glowing.").replace(
    "glow, magic effects, sparks, smoke; text, logos, emblems;",
    "glow, light beams, magic effects, sparks, smoke; text, letters, numbers, logos, brand marks, insignia, emblems, crosses;")
assert "GUNS are oversized" in ns["STYLE"] and "cyberpunk ACCENTS" in ns["STYLE"] and "brand marks" in ns["STYLE"], "the set's STYLE changed: re-check the replacements"
NOT = ns["NOT"]
REF_STYLE = str(SETIN / "body-human-m.jpg")

# ------------------------------------------------------------------ metatypes: the set's bodies, plus trolls and the robot people
# (ork = the set's orc body, so an ork runner and an orc fighter are one people; a taste call for Harry: README.md)
META = {
 "human": {"m": RACES["human"]["m"], "f": RACES["human"]["f"]},
 "elf":   {"m": RACES["elf"]["m"], "f": RACES["elf"]["f"]},
 "dwarf": {"m": RACES["dwarf"]["m"], "f": RACES["dwarf"]["f"]},
 "ork":   {"m": (6.5, RACES["orc"]["m"][1].replace("an orc man", "an ork man (an orc)")), "f": (6.3, RACES["orc"]["f"][1].replace("an orc woman", "an ork woman (an orc)"))},
 "troll": {"m": (8.5, "a troll man: a HUGE 8.5-ft metahuman, massively built, nearly twice as broad as a human, with long heavy arms, big hands, rough knobbly dusky grey-brown skin (NOT green), a heavy brow ridge, two short thick lower tusks, pointed ears, and two big thick ram-like HORNS curling back from the temples, drawn as solid chunky shapes"),
           "f": (8.2, "a troll woman: a HUGE 8.2-ft metahuman, massively built, much broader than a human, with long heavy arms, big hands, rough knobbly ruddy tan skin (NOT green), a heavy brow, two short thick lower tusks, pointed ears, and two big thick ram-like HORNS curling back from the temples through her hair, drawn as solid chunky shapes")},
}
BODY = {(r, s): (MYIN if r == "troll" else SETIN) / f"body-{'orc' if r == 'ork' else r}-{s}.jpg" for r in META for s in "mf"}
RTAGS = {"human": ["human"], "elf": ["elf"], "dwarf": ["dwarf"], "ork": ["ork", "orc"], "troll": ["troll", "metahuman"], "robot": ["robot", "android", "construct"]}
SEX = {"m": "man", "f": "woman"}
RLABEL = {"human": "human", "elf": "elf", "dwarf": "dwarf", "ork": "ork", "troll": "troll", "robot": "robot"}
BASE = lambda r: 10 if r == "troll" else 5          # a troll is Large: two squares a side (engine/core/size.js)

# troll bodies: new references, painted against the set's orc body (style and build), never meshed
for s in "mf":
    h, words = META["troll"][s]
    fig(f"body-troll-{s}", "body", f"{words.split(':')[0]} in plain clothes (a body reference)", h, "hum",
        f"{words[0].upper() + words[1:]}; {h} ft tall, much taller and broader than the supplied figure. Plain, close-fitting modern clothes that show the body's build: a sleeveless cream vest top, ochre cargo trousers to the ankle, big plain boots. "
        "Standing straight and relaxed, arms hanging a hand's width from the body, hands empty, looking forward. Nothing held, no hat, no coat, no armour.",
        f"one huge horned troll {SEX[s]} in a plain vest top and trousers, standing, empty-handed", ["empty hands (nothing held)", "two big horns on the head"], base=10, route="reference-only",
        name=f"Troll body reference ({SEX[s]})", race="troll", gender=s)
ns["F"][-2]["refs"] = [str(SETIN / "body-orc-m.jpg")]; ns["F"][-1]["refs"] = [str(SETIN / "body-orc-f.jpg")]

# the robot people's body: one reference every humanoid robot is painted against
ROBOT_BODY = ("a humanoid ROBOT of this set's robot people: 6 ft tall, a sturdy frame of big rounded warm grey steel plates with ochre-orange armour panels on the chest, shoulders and shins, "
              "thick black flexible joints at the elbows and knees, hands as chunky three-fingered mitts, a rounded helmet-like head with ONE wide magenta visor band for eyes and no mouth")
fig("body-robot", "body", "a humanoid robot (a body reference)", 6.0, "hum",
    f"{ROBOT_BODY[0].upper() + ROBOT_BODY[1:]}; 6 ft tall. Standing straight and relaxed, arms hanging a hand's width from the body, hands empty, looking forward. A machine, not a person in armour: no skin or face anywhere. Nothing held.",
    "one humanoid robot of grey steel and orange plates with a single visor band for eyes, standing, empty-handed", ["empty hands (nothing held)", "a robot, not a person in armour"],
    route="reference-only", name="Robot body reference", race="robot")
ns["F"][-1]["refs"] = [REF_STYLE]

# ------------------------------------------------------------------ the runner archetypes: one KIT each, worn by a spread of bodies
# kind, thin part tracked by measure.py, kit, what the gate must see (desc), must-haves, search words, SRD-ish words
KITS = {
 "street-samurai": ("hum", "sword", "STREET SAMURAI kit (a cybered street warrior): a cropped black leather jacket with warm grey armour plates on the shoulders and chest over a magenta shirt, ochre cargo trousers, heavy boots; the LEFT ARM is a CYBERNETIC ARM of thick warm chrome-grey plates with amber joints from the shoulder to the hand; small wraparound shades painted amber; a chunky pistol holstered flat at the right hip. "
    "The RIGHT hand holds a KATANA upright in front of the right shoulder: a long broad bright steel blade as wide as three fingers pointing straight up, tip above the head, a cream-wrapped hilt. The LEFT (metal) hand is a fist at the hip.",
    "a street warrior in an armoured leather jacket with one metal cybernetic arm, holding one long sword upright", ["exactly one long sword (a katana), complete end to end", "one arm is a metal cybernetic arm"],
    ["street samurai", "street sam", "warrior", "cyborg", "fighter"]),
 "decker": ("hum", None, "DECKER kit (a hacker): a baggy ochre hooded sweatshirt with the hood DOWN, moss-green cargo trousers, chunky cream sneakers, thick AR GOGGLES with magenta lenses pushed up on the forehead, a fat coiled cable from a metal socket at the temple running down the chest into the deck (lying against the body, not loose). "
    "BOTH hands hold a CYBERDECK at chest height close in front of the body: a big flat chunky slab like a thick keyboard as wide as the chest, cream and warm grey with rows of big magenta and lime keys, tilted up toward the face. No weapon in the hands.",
    "a hacker in a hoodie with goggles on the head, holding one big flat keyboard-like computer deck at chest height", ["one big flat computer deck held in both hands at chest height", "goggles on the head"],
    ["decker", "hacker", "cyberdeck", "rogue"]),
 "rigger": ("hum", None, "RIGGER kit (a drone and vehicle pilot): an ochre mechanic's jumpsuit with the sleeves tied round the waist over a black tank top, a broad tool belt with fat pouches and a big bright wrench, heavy work boots, a chunky cream CONTROL HEADSET over the head with one stubby antenna. "
    "On the LEFT shoulder sits a small DRONE as large as the head: a fat boxy body painted ochre and warm grey with FOUR short thick rotor arms ending in round solid rotor discs, resting on the shoulder, fused to it. The RIGHT hand holds a chunky REMOTE CONTROLLER (a thick cream slab with two fat stubby sticks) at chest height close to the body.",
    "a mechanic in a jumpsuit with a headset, a small four-rotor drone sitting on the shoulder, holding one remote controller", ["a small drone sitting on the shoulder", "a remote controller held in one hand"],
    ["rigger", "drone", "pilot", "driver", "mechanic", "wheelman"]),
 "mage": ("hum", None, "MAGE kit (a street mage, a modern occult scholar): a long burgundy armoured trench coat to the knee with a high collar over a cream shirt and dark tie, smart trousers, polished boots, small round brass spectacles, a big plain round brass medallion on the chest (a plain ring, no letters or signs). "
    "The LEFT arm holds a big thick cream leather-bound GRIMOIRE open against the chest (blank pages). The RIGHT hand is raised in front of the right shoulder, palm up, holding a big swirl of magenta-and-amber spell energy drawn as ONE chunky solid twisted teardrop shape as large as the head (solid and opaque like carved wax, not glowing, no sparks).",
    "a spellcaster in a long trench coat and spectacles holding one open book and a solid swirl of spell energy in a raised hand", ["one open book held against the chest", "a solid swirl of spell energy held in a raised hand"],
    ["mage", "magician", "wizard", "spellcaster", "caster", "hermetic"]),
 "shaman": ("hum", None, "SHAMAN kit (an urban street shaman who talks to the city's spirits; NOT tied to any real culture or religion): a long patched ochre-and-moss-green canvas coat to the knee over a cream shirt and streetwear, the coat sewn all over with chunky found-object CHARMS lying flat (bottle caps, old brass keys, little brass bells, circuit chips), a plain soft cloth hood lying down on the shoulders, fingerless gloves. "
    "A big black RAVEN with a cream beak sits on the LEFT shoulder, its wings folded, fused to the shoulder. The RIGHT hand holds a WALKING STAFF upright close beside the body, foot at ground level: a THICK bar of bent rebar wrapped in cream cloth strips, topped (just above the head) with one solid chunky bundle of tied-on keys, bells and bottle caps. The LEFT hand is open, palm up, close at the waist. No animal skulls or pelts, no feathers worn, no face paint, no religious symbols.",
    "a street shaman in a patched coat covered in junk charms, a raven on the shoulder, holding one rebar staff topped with a bundle of charms", ["a raven (a bird) sitting on the shoulder", "one staff held upright, complete end to end"],
    ["shaman", "street shaman", "spirit", "totem", "caster", "druid", "raven"]),
 "adept": ("hum", None, "PHYSICAL ADEPT kit (a martial artist whose magic is in the body): a sleeveless cream-and-burgundy fight vest open over the chest (women: over a sports top), loose black training trousers tied at the shin, thick cream cloth hand wraps, thin sandals, a burgundy headband with short tied ends, ochre tattoo bands round the bare arms; NO cyberware, NO weapon, NO gun. "
    "A compact martial stance: the RIGHT hand a fist raised in front of the chest, the LEFT a flat blade-hand raised beside the face, elbows near the ribs, feet planted.",
    "an unarmed martial artist in a sleeveless fight vest and headband with wrapped hands raised in a fighting stance", ["no weapon and no gun", "hands raised in a fighting stance", "wrapped hands"],
    ["physical adept", "adept", "martial artist", "monk", "brawler", "ninja"]),
 "face": ("hum", None, "FACE kit (a smooth-talking negotiator): a sharp tailored cream suit jacket and trousers over a burgundy shirt open at the collar, a long black coat hanging from the shoulders lying flat, polished shoes, a fat gold watch and rings, neat styled hair, small amber sunglasses. "
    "The RIGHT hand holds up a big chunky PHONE (a thick cream slab as large as the hand) beside the face, as if talking; the LEFT hand holds a fat cream ENVELOPE of money against the chest.",
    "a slick talker in a sharp cream suit and sunglasses, holding a phone to the face and a fat envelope", ["a phone held up beside the face", "a sharp suit"],
    ["face", "negotiator", "talker", "con artist", "dealer", "bard", "fixer"]),
 "technomancer": ("hum", None, "TECHNOMANCER kit (a hacker who needs no computer): a torn black cropped jacket with the sleeves torn off over a lime-green shirt, patched charcoal trousers, chunky sneakers, thick magenta-and-lime CIRCUIT-PATTERN TATTOOS painted across the bare arms, the neck and one cheek (thick painted lines, not glowing). "
    "Both hands raised in front of the chest, fingers spread, holding between them a big solid lime-green CUBE of data as large as the head, drawn as ONE chunky solid block (opaque like carved wax, not glowing).",
    "a hacker in torn streetwear with circuit tattoos on the skin, holding a solid green cube of data between raised hands", ["a solid cube held between the raised hands", "circuit-like tattoos on the skin"],
    ["technomancer", "hacker", "decker", "caster", "sorcerer"]),
 "merc": ("hum", None, "MERCENARY kit (a heavy-weapons soldier for hire): bulky moss-green and warm grey armour plates over a padded black combat suit, a big helmet with the visor raised so the face shows, knee pads, heavy boots, fat ammo pouches on the belt and chest. "
    "BOTH hands hold a big chunky MACHINE GUN upright in front of the right shoulder, muzzle pointing straight up: a fat warm grey steel gun as long as the arm with a big ochre drum magazine and a thick barrel.",
    "a heavily armoured soldier in a helmet holding one big machine gun upright", ["exactly one big gun held upright, complete", "a helmet and armour"],
    ["mercenary", "merc", "soldier", "heavy weapons", "gunner", "fighter"]),
}
NAME = {"street-samurai": "street samurai", "decker": "decker", "rigger": "rigger", "mage": "mage", "shaman": "shaman", "adept": "physical adept", "face": "face",
        "technomancer": "technomancer", "merc": "mercenary"}
# the spread (Harry: "not the full grid"): every archetype 2-4 times, every metatype 5-8 times, both sexes about even
SPREAD = {
 "street-samurai": [("troll", "m"), ("ork", "f"), ("human", "m"), ("elf", "f")],
 "decker": [("elf", "f"), ("dwarf", "m"), ("human", "f")],
 "rigger": [("dwarf", "f"), ("ork", "m"), ("human", "m")],
 "mage": [("elf", "m"), ("human", "f"), ("dwarf", "m")],
 "shaman": [("ork", "f"), ("troll", "m"), ("human", "f")],
 "adept": [("elf", "f"), ("human", "m"), ("troll", "f")],
 "face": [("elf", "m"), ("human", "f"), ("ork", "m")],
 "technomancer": [("human", "m"), ("dwarf", "f")],
 "merc": [("dwarf", "m"), ("troll", "f"), ("ork", "m")],
}
LOOKS = {
 "human": ["warm brown skin and a short magenta-dyed undercut", "pale freckled skin and a red buzz cut", "olive skin and black hair in a tight bun", "dark brown skin and close-cropped hair", "tan skin and a bleached blond crop", "light skin and grey hair swept back"],
 "elf": ["pale skin and long silver-white hair in one thick tail", "golden-tan skin and a sharp black bob", "light brown skin and a lime-green dyed crop", "pale skin and honey-blond hair in a high tail"],
 "dwarf": ["a thick red beard (or red braids) and ruddy skin", "a black beard (or black braids) and tan skin", "a grey beard (or grey braids) and weathered skin", "a magenta-dyed beard (or magenta braids) and pale skin"],
 "ork": ["a black mohawk", "a shaved head with an ochre stripe of hair", "short dark hair and a scarred brow", "thick black braids tied back"],
 "troll": ["a black mohawk between the horns", "short grey hair round the horns", "thick dark braids round the horns", "a shaved head"],
}
n = 0
for c, spread in SPREAD.items():
    kind, shaft, kit, desc, must, words = KITS[c]
    for r, s in spread:
        h, body = META[r][s]; look = LOOKS[r][n % len(LOOKS[r])]; n += 1
        W = body[0].upper() + body[1:]
        fig(f"cyber-{c}-{r}-{s}", "runner", f"a {RLABEL[r]} {NAME[c]}, a {SEX[s]}", h, kind,
            f"{W}; {h} ft tall; this one has {look}. Everything is sized to this body. {kit}",
            f"one {RLABEL[r]} {SEX[s]}: {desc}", must, shaft=shaft, base=BASE(r), body=f"body-{'orc' if r == 'ork' else r}-{s}",
            name=f"{RLABEL[r].capitalize()} {NAME[c]} ({SEX[s]})", race=r, gender=s, cls=c,
            tags=list(dict.fromkeys(words + ["runner", "cyberpunk", "player character"] + RTAGS[r] + [SEX[s]])), srd=[])
        ns["F"][-1]["refs"] = [str(BODY[(r, s)])]

# ------------------------------------------------------------------ modern and near-future NPCs (group modern)
def npc(id, r, s, role, who, kit, desc, must=(), kind="hum", cls=None, tags=(), name=None):
    h, body = META[r][s]; W = body[0].upper() + body[1:]
    fig(f"modern-{id}", "modern", role, h, kind, f"{W}; {h} ft tall; {who}. Everything is sized to this body. {kit}", f"one {RLABEL[r]} {SEX[s]}: {desc}", must, base=BASE(r),
        body=f"body-{'orc' if r == 'ork' else r}-{s}", name=name or f"{role.split(' ', 1)[1][0].upper() + role.split(' ', 1)[1][1:]} ({RLABEL[r]} {SEX[s]})", race=r, gender=s, cls=cls,
        tags=list(dict.fromkeys(list(tags) + ["modern", "npc", "cyberpunk"] + RTAGS[r] + [SEX[s]])), srd=[])
    ns["F"][-1]["refs"] = [str(BODY[(r, s)])]
P = lambda thing: [f"one {thing}"]
npc("police-m", "human", "m", "a police officer", "broad and moustached", "A charcoal-black police uniform: a peaked cap with a plain brass badge (no letters), a cream shirt under a bright amber-yellow high-visibility vest with cream stripes, a duty belt with fat pouches, boots. His RIGHT hand holds a thick pale baton upright beside his shoulder; his LEFT hand holds a big chunky radio at his chest.",
    "a police officer in a cap and a bright high-visibility vest holding a baton upright and a radio", P("baton") + ["a high-visibility vest"], cls="police", tags=["police", "cop", "beat cop", "officer", "law"])
npc("police-f", "ork", "f", "a police officer", "with her hair in a tight bun", "A charcoal-black police uniform with a plain brass badge (no letters), a bright amber-yellow high-visibility vest with cream stripes, a duty belt, boots, no hat. Her RIGHT hand holds a big cream coffee cup at chest height; her LEFT hand rests on the chunky pistol holstered at her hip.",
    "a police officer in a bright high-visibility vest holding one coffee cup, a hand on the holstered pistol", P("coffee cup") + ["a high-visibility vest"], cls="police", tags=["police", "cop", "beat cop", "officer", "law"])
npc("security-f", "human", "f", "a corporate security guard", "stern, with a short dark crop", "A corporate security uniform: warm grey armour plates over an ochre-and-charcoal jumpsuit, a full warm grey helmet with the visor raised so the face shows, heavy boots. Her RIGHT hand holds a thick STUN BATON upright beside her shoulder (warm grey steel with a big amber tip); her LEFT arm holds a small square riot SHIELD close in front of her left hip.",
    "a security guard in grey armour and a helmet holding one stun baton upright and a small shield", P("baton") + ["a helmet"], cls="security", tags=["corporate security", "security guard", "guard", "corp", "law"])
npc("tactical-m", "human", "m", "a tactical officer", "hidden behind a dark visor", "SWAT gear: a charcoal-black helmet with a dark smoked visor down over the face, thick black body armour with big amber-yellow shoulder bands, knee pads, gloves, heavy boots, fat pouches. BOTH hands hold a chunky ASSAULT RIFLE upright in front of the right shoulder, muzzle pointing straight up (bright warm grey steel with cream panels).",
    "a tactical police officer in black armour and a visored helmet holding one rifle upright", ["exactly one rifle held upright, complete", "a helmet with a visor"], cls="tactical", tags=["swat", "tactical", "riot police", "police", "soldier", "law"])
npc("exec-f", "human", "f", "a corporate executive", "poised, with sleek black hair in a bob", "An immaculate cream business suit with a burgundy blouse, a gold necklace, low-heeled shoes. Her LEFT hand carries a fat gold-brass BRIEFCASE beside her knee; her RIGHT hand holds a slim cream TABLET up at her chest.",
    "a corporate executive in a sharp cream suit holding one briefcase and a tablet", P("briefcase"), cls="exec", tags=["executive", "exec", "corporate", "suit", "businesswoman", "noble"])
npc("exec-m", "dwarf", "m", "a corporate executive", "with a neat grey beard and a fat cigar", "A charcoal three-piece suit with a burgundy tie and a gold watch chain, polished shoes. His RIGHT hand holds a fat brown cigar at chest height; his LEFT hand carries a fat burgundy leather BRIEFCASE beside his knee.",
    "a corporate executive in a three-piece suit with a cigar and one briefcase", P("briefcase"), cls="exec", tags=["executive", "exec", "corporate", "suit", "businessman", "noble"])
npc("ganger-m", "ork", "m", "a street ganger", "with a tall magenta mohawk and a sneer", "A sleeveless studded black leather vest over a bare chest, spiked leather bracers, ripped ochre jeans, big boots. Over his RIGHT shoulder, held close, a big cream wooden BASEBALL BAT wrapped with bright steel bands; his LEFT hand is a fist.",
    "a punk gang member in a studded vest with a mohawk holding one bat on the shoulder", P("bat"), cls="ganger", tags=["ganger", "gang", "thug", "punk", "bandit"])
npc("ganger-f", "human", "f", "a street ganger", "with magenta hair in two buns and a metal eye", "An amber bomber jacket with a cream fur collar over a black crop top, torn black trousers, platform boots, one metal cyber-eye. Her RIGHT hand holds a chunky MACHINE PISTOL upright beside her face, muzzle up (warm grey steel with magenta panels); her LEFT hand holds a broad bright knife low at her hip.",
    "a gang member in a bomber jacket holding one machine pistol upright and a knife", P("gun"), cls="ganger", tags=["ganger", "gang", "thug", "punk", "bandit"])
npc("bartender-m", "dwarf", "m", "a bartender", "with a braided black beard", "A black waistcoat over a cream shirt with rolled sleeves, a burgundy bow tie, a short black apron. His RIGHT hand holds a big bright steel COCKTAIL SHAKER up at chest height; a cream cloth lies over his left shoulder and his left hand holds a squat cream glass.",
    "a bartender in a waistcoat and bow tie holding one cocktail shaker up and a glass", P("cocktail shaker"), cls="bartender", tags=["bartender", "barman", "bar", "innkeeper", "club"])
npc("vendor-f", "human", "f", "a street food vendor", "cheerful, in a burgundy headscarf", "An ochre apron over a cream T-shirt and moss-green trousers, sneakers. Her LEFT hand holds up a big round cream NOODLE BOWL with fat chopsticks resting flat across its rim at chest height; her RIGHT hand holds a big pale LADLE upright beside her shoulder.",
    "a street food seller in an apron and headscarf holding one noodle bowl and a ladle", P("bowl"), cls="vendor", tags=["street vendor", "vendor", "food", "merchant", "cook", "noodles"])
npc("streetdoc-m", "human", "m", "a street doctor", "unshaven and tired, with brass magnifier goggles", "A stained cream surgical coat to the knee over a burgundy shirt, thick cream gloves, brass magnifier goggles on his forehead. His LEFT hand carries a fat cream MEDICAL CASE with one plain burgundy stripe (no cross, no letters) beside his knee; his RIGHT hand holds a big chunky INJECTOR gun upright beside his shoulder (warm grey steel with an amber vial).",
    "a back-alley doctor in a stained surgical coat holding one medical case and an injector", P("medical case"), cls="street-doc", tags=["street doc", "doctor", "medic", "surgeon", "healer"])
npc("fixer-m", "elf", "m", "a fixer", "sharp-faced, with silver hair slicked back", "A long camel-ochre overcoat to the knee over a charcoal suit, a burgundy scarf lying flat, a narrow-brimmed charcoal hat, polished shoes. His RIGHT hand holds up a chunky cream PHONE beside his face; his LEFT hand holds a fat cream envelope against his chest.",
    "a dealmaker in a long overcoat and hat holding one phone up and an envelope", P("phone"), cls="fixer", tags=["fixer", "dealer", "broker", "contact", "middleman"])
npc("civilian-f", "human", "f", "an office worker", "with brown hair in a ponytail and a lanyard", "A cream blouse, a moss-green knee-length skirt suit, flat shoes, a plain lanyard (no card text). Her RIGHT hand holds a big cream COFFEE CUP at chest height; under her LEFT arm a fat ochre folder held close.",
    "an office worker in a skirt suit holding one coffee cup and a folder", P("coffee cup"), cls="civilian", tags=["civilian", "office worker", "wageslave", "commoner", "citizen", "bystander"])
npc("civilian-m", "ork", "m", "a commuter", "young, with short hair and big headphones round his neck", "A loose moss-green hooded sweatshirt with the hood down, faded ochre jeans, chunky sneakers, a fat cream messenger bag on his hip. Both hands hold a big chunky PHONE at chest height, looking down at it.",
    "a young man in a hoodie with a messenger bag looking at one phone held in both hands", P("phone"), cls="civilian", tags=["civilian", "commuter", "commoner", "citizen", "bystander", "student"])
npc("journalist-f", "elf", "f", "a journalist", "keen-eyed, with auburn hair tied back", "An ochre trench coat belted at the waist over a cream shirt, trousers, ankle boots, a plain press lanyard (no text). BOTH hands hold a big chunky CAMERA with a fat cream lens up at chest height, close in front of the body.",
    "a reporter in a trench coat holding one big camera at chest height", P("camera"), cls="journalist", tags=["journalist", "reporter", "press", "photographer", "media"])
npc("bouncer-m", "troll", "m", "a club bouncer", "with a shaved head and an earpiece", "A tight black T-shirt straining over the huge chest, black trousers, big boots, an earpiece. His huge arms are FOLDED across his chest, elbows close, feet planted wide apart in a firm stance.",
    "a huge horned doorman in a black T-shirt with his arms folded", ["arms folded across the chest", "horns on the head"], cls="bouncer", tags=["bouncer", "doorman", "security", "club", "thug", "guard"])

# ------------------------------------------------------------------ the robot people (group robot; race robot)
RB = "body-robot"
def robot(id, role, h, design, desc, must=(), kind="hum", base=5, mode="kin", tags=(), name=None, body=None):
    """mode: kin = a humanoid of the robot people (the robot body plate as its kin reference); machine = a non-humanoid
    machine of the same people (the robot body plate as a style and paint reference only); body = a set body plate (the android)."""
    fig(f"robot-{id}", "robot", role, h, kind, design, desc, must, base=base, ref=RB if mode == "kin" else None, body=body if mode == "body" else None,
        name=name or role.split(" ", 1)[1][0].upper() + role.split(" ", 1)[1][1:], race="robot", cls=id,
        tags=list(dict.fromkeys(list(tags) + ["robot", "machine", "cyberpunk", "construct"])), srd=[])
    a = ns["F"][-1]
    a["refs"] = [str(SETIN / f"{body}.jpg")] if mode == "body" else [str(MYIN / f"{RB}.jpg")]
    a["prompt"] = a["prompt"].replace("ANOTHER MEMBER OF THE SAME WARBAND, already made", "ANOTHER MEMBER OF THE SAME ROBOT PEOPLE, already made").replace(
        "the same rough style of clothing and gear", "the same plates, joints, colours and visor band")
    if mode == "machine":
        old = "do not copy the reference's armour, colours, face or pose, and do NOT copy how far its sword and shield are held out to the sides."
        assert old in a["prompt"]; a["prompt"] = a["prompt"].replace(old, "it is a different MACHINE of the same robot people: the SAME warm grey steel and ochre-orange plates, black joints and magenta visor band, but the very different body described below (NOT a humanoid).")
RW = lambda more: f"{ROBOT_BODY[0].upper() + ROBOT_BODY[1:]}. {more}"
robot("soldier", "a combat robot", 6.5, RW("This one is a COMBAT robot, 6.5 ft tall and heavier: thicker armour plates, a broad armoured chest, a squared helmet-head with the magenta visor band. BOTH hands hold a big chunky RIFLE upright in front of the right shoulder, muzzle straight up (warm grey steel with ochre panels)."),
      "a heavy grey-and-orange combat robot with a visor band for eyes holding one rifle upright", ["exactly one rifle held upright, complete", "a robot, not a person in armour"], tags=["combat robot", "soldier", "war machine", "fighter", "guard"])
robot("war-frame", "a war robot", 9.0, RW("This one is a huge WAR ROBOT, 9 ft tall and massive, twice as broad as a person: very thick armour plates, a small head sunk between huge armoured shoulders with the magenta visor band, thick stumpy legs. Its RIGHT forearm IS a big chunky six-barrelled CANNON held forward close to the body (bright warm grey steel); its LEFT hand is a huge three-fingered claw at its side."),
      "a huge heavily armoured robot whose one forearm is a big cannon", ["one forearm is a big cannon", "a robot, not a person in armour"], base=10, tags=["war robot", "combat robot", "mech", "war machine", "boss", "fighter", "heavy"])
robot("infiltrator", "an android infiltrator", 5.6, "An android built to pass as a human woman, 5.6 ft tall: a human-looking face, body and skin with a sleek black bob haircut, wearing a charcoal-black suit and a cream shirt; but the RIGHT side of her face has no skin, showing a warm chrome-grey metal skull with one round magenta eye, and her LEFT forearm's sleeve is torn open showing chrome-grey metal plates. Her RIGHT hand holds a chunky silenced PISTOL upright beside her shoulder (warm grey steel with a long thick cream silencer); her LEFT hand hangs close at her side.",
      "a woman in a black suit whose half face and one arm show chrome metal under the skin, holding one pistol upright", ["half the face shows a metal skull", "one gun held upright"], mode="body", body="body-human-f", tags=["android", "infiltrator", "synth", "spy", "assassin", "rogue"])
robot("stalker", "a stealth robot", 6.0, RW("This one is a slim STEALTH robot, 6 ft tall and lean: thin-limbed for a robot but still chunky, its plates painted charcoal-black with only thin ochre-orange edges, a narrow head with the magenta visor band. From EACH forearm a broad bright steel BLADE as long as the forearm points straight UP beside the head, held close."),
      "a slim dark robot with a visor band holding two broad blades upright from its forearms", ["two blades held upright", "a robot, not a person in armour"], tags=["stealth robot", "assassin", "ninja", "rogue", "scout"])
robot("hacker", "a hacker robot", 6.0, RW("This one is a HACKER robot: on its head a crown of FOUR short thick antenna stubs, on its chest a big flat lime-green screen panel (blank, no text), fat coiled cables running from its wrists into a big flat chunky cream DATA-DECK it holds in BOTH hands at chest height, tilted up."),
      "a robot with antennae on its head and a screen on its chest holding one flat computer deck", ["one flat computer deck held in both hands", "antennae on the head"], tags=["hacker robot", "hacker", "ai", "caster"])
robot("medic", "a medic robot", 6.0, RW("This one is a MEDIC robot: its plates painted cream-white with broad burgundy stripes instead of orange (no cross, no letters), a round lamp on the top of its head. Its RIGHT hand holds a big chunky INJECTOR gun upright beside its shoulder (warm grey steel with an amber vial); its LEFT hand carries a fat cream MEDICAL CASE beside its knee."),
      "a white-and-red robot holding one injector upright and a medical case", ["one medical case", "a robot, not a person in armour"], tags=["medic robot", "medic", "doctor", "healer", "support", "cleric"])
robot("worker", "a utility robot", 4.5, "A squat UTILITY ROBOT of this set's robot people, 4.5 ft tall: a boxy warm grey steel body with ochre-orange panels and black hazard-free plain bands, the same rounded head with ONE wide magenta visor band, TWO thick tank TRACKS instead of legs, flat on the ground. Two thick arms: the RIGHT ends in a big bright steel pincer CLAW held up beside the head, the LEFT ends in a chunky welding torch held close at its side (no flame).",
      "a squat boxy robot on tank tracks with a claw arm and a tool arm", ["tank tracks instead of legs", "a big claw on one arm"], mode="machine", kind="odd", tags=["utility robot", "worker bot", "construction", "loader", "drone", "industrial"])
robot("sentry", "a security drone", 3.0, "A four-legged SECURITY DRONE of this set's robot people, the size of a big dog, 3 ft tall: a low armoured warm grey steel body with ochre-orange panels on FOUR thick stubby mechanical legs, and on top a small round turret head with ONE wide magenta visor band and a short thick gun barrel pointing forward. No person, no rider.",
      "a dog-sized four-legged robot with a small gun turret on top", ["four mechanical legs", "a turret on top"], mode="machine", kind="quad", tags=["security drone", "drone", "sentry", "robot dog", "guard", "turret"])
robot("rotor-drone", "a rotor drone", 1.6, "A landed ROTOR DRONE of this set's robot people, 3 ft across and 1.6 ft tall: a fat boxy warm grey steel body with ochre-orange panels and ONE wide magenta camera band at the front, FOUR short thick arms ending in big round SOLID rotor discs (solid like plates, not blurred), resting on four short stubby landing legs flat on the ground. No person, no rider.",
      "a boxy four-rotor drone resting on its landing legs", ["four rotor discs", "a drone, not a creature"], mode="machine", kind="odd", tags=["rotor drone", "drone", "quadcopter", "flying drone", "surveillance", "rigger"])
robot("butler", "a service android", 6.0, RW("This one is a SERVICE robot, a butler: over its plates it wears a charcoal-black TAILCOAT and a cream shirt front with a burgundy bow tie. Its RIGHT hand holds up a big round bright steel TRAY at shoulder height with one fat cream glass on it; its LEFT hand is folded behind its back."),
      "a robot butler in a black tailcoat and bow tie holding up one tray with a glass", ["one tray held up", "a robot, not a person in clothes"], tags=["service robot", "butler", "android", "servant", "waiter", "commoner"])

F = ns["F"]
for a in F:
    a["prio"] = 1 if a["group"] == "body" else 3
(HERE / "set/prompts").mkdir(parents=True, exist_ok=True)
(HERE / "set/assets.json").write_text(json.dumps({"assets": F}, indent=1) + "\n")
for a in F: (HERE / "set/prompts" / f"{a['id']}.spec.md").write_text(a["prompt"])
from collections import Counter
mesh = [a for a in F if a["group"] != "body"]
print(len(F), "assets:", dict(Counter(a["group"] for a in F)), "| meshes", len(mesh))
print("runner metatypes:", dict(Counter(a["race"] for a in F if a["group"] == "runner")), "sexes:", dict(Counter(a["gender"] for a in F if a["group"] == "runner")))
print("large (10-ft base):", [a["id"] for a in F if a["base_ft"] == 10])
print("refs not on disk yet (the bodies painted first):", sorted(set(Path(r).name for a in F for r in a["refs"] if not Path(r).exists())))
