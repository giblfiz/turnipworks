#!/usr/bin/env python3
"""Build the gallery's DEV FIXTURE: 450 manifest entries made from the six pilot figures (kit.json + web-models/),
under fake ids, names, groups and races, so the gallery's speed and filters can be tested before the real set exists.
    python3 devset/build_devset.py [N=450]
Writes devset/manifest.json and devset/tiers/, devset/models/ (symbolic links to web-models/, nothing is copied).
Thumbnails are made afterwards by thumbs.py. NOT the real set: every figure here is one of six meshes."""
import json, os, pathlib, sys, datetime
HERE = pathlib.Path(__file__).resolve().parent; EXP = HERE.parent
N = int(sys.argv[1]) if len(sys.argv) > 1 else 450
kit = json.load(open(EXP / "kit.json"))
for d in ("tiers", "models", "thumbs"): (HERE / d).mkdir(exist_ok=True)
for d in ("tiers", "models"):
    for p in (HERE / d).iterdir():
        if p.is_symlink(): p.unlink()

RACES = ["human", "elf", "dwarf", "small", "orc", "tiefling", "dragonborn"]
RACE_NAME = {"human": "Human", "elf": "Elf", "dwarf": "Dwarf", "small": "Halfling", "orc": "Half-orc", "tiefling": "Tiefling", "dragonborn": "Dragonborn"}
CLASSES = {"fighter": (["soldier", "sword", "shield"], ["guard", "veteran"]), "wizard": (["mage", "staff", "robe"], ["mage", "archmage"]),
           "cleric": (["priest", "mace", "holy symbol"], ["acolyte", "priest"]), "rogue": (["thief", "dagger", "hood"], ["spy", "bandit", "assassin"]),
           "ranger": (["archer", "bow", "cloak"], ["scout"]), "barbarian": (["axe", "furs"], ["berserker", "tribal warrior"]),
           "bard": (["lute", "hat"], ["noble"]), "paladin": (["knight", "sword", "plate armour"], ["knight"]),
           "druid": (["staff", "antlers"], ["druid"]), "monk": (["staff", "robe"], ["cult fanatic", "cultist"]),
           "sorcerer": (["robe", "flame"], ["mage"]), "warlock": (["book", "robe"], ["cultist", "cult fanatic"])}
ROLES = {"innkeeper": ["commoner"], "guard": ["guard"], "merchant": ["commoner", "noble"], "farmer": ["commoner"], "blacksmith": ["commoner"],
         "noble": ["noble"], "priest": ["acolyte", "priest"], "beggar": ["commoner"], "sailor": ["bandit", "commoner"], "child": ["commoner"]}
FOES = {"goblin": ["goblin", "goblin boss"], "bugbear": ["bugbear", "bugbear chief"], "kobold": ["kobold", "winged kobold"], "orc": ["orc", "orc war chief"],
        "skeleton": ["skeleton", "minotaur skeleton"], "zombie": ["zombie", "ogre zombie"], "cultist": ["cultist", "cult fanatic"], "bandit": ["bandit", "bandit captain"],
        "gnoll": ["gnoll", "gnoll pack lord"], "hobgoblin": ["hobgoblin", "hobgoblin captain"]}
FOE_KIT = ["spear", "bow", "sword", "club", "axe", "shield", "sling", "leader", "shaman", "wolf rider"]
BEASTS = ["wolf", "dire wolf", "bear", "boar", "horse", "pony", "mule", "dog", "cat", "hawk", "giant rat", "giant spider", "panther", "lion", "ape",
          "crocodile", "elk", "giant bat", "giant toad", "snake", "owl", "raven", "goat", "giant weasel", "badger", "deer", "hyena", "jackal", "giant lizard", "mastiff"]
LARGE = ["ogre", "troll", "owlbear", "hill giant", "young dragon", "minotaur", "ettin", "manticore", "griffon", "wyvern"]
SRC = {"m": "fig-fighter", "f": "fig-wizard", "foe": ["fig-goblin-b", "fig-goblin"], "beast": ["fig-wolf-b", "fig-wolf"]}

def entry(i, id_, name, group, race, gender, cls, tags, srd, src, big=1.0, base_ft=5):
    k = kit[src]; t = k["tiers"]; batch = 1 + i * 6 // N
    when = (datetime.datetime(2026, 10, 6, 9, 10) + datetime.timedelta(minutes=50 * (batch - 1))).strftime("%Y-%m-%dT%H:%M:00-07:00")
    files = {"full": f"models/{id_}.glb", "hero": f"tiers/{id_}--20k1024.glb", "horde": f"tiers/{id_}--5k512.glb"}
    for rel, real in ((files["full"], k["file"]), (files["hero"], t["20k1024"]["file"]), (files["horde"], t["5k512"]["file"])):
        os.symlink(EXP / "web-models" / real, HERE / rel)
    reach = k["plan"]["reach_radius_ft"] * big; notes = []
    if reach > base_ft / 2 + 0.3: notes.append(f"reaches {reach - base_ft / 2:.1f} ft outside its square")
    return {"id": id_, "name": name, "group": group, "race": race, "gender": gender, "cls": cls, "tags": tags, "srd": srd,
            "height_ft": round(k["stated_ft"]["body"] * big, 2), "overall_ft": round(k["overall_ft"] * big, 2), "base_ft": base_ft,
            "facing_deg": k["yaw_deg"], "scale": k["scale"] * big, "y0": k["y0"] * big, "centre": [c * big for c in k["plan"]["centre"]], "native_bounds": k["native_bounds"],
            "files": files, "tris": {"full": k["tris"], "hero": t["20k1024"]["tris"], "horde": t["5k512"]["tris"]}, "kb": {"full": k["kb"], "hero": t["20k1024"]["kb"], "horde": t["5k512"]["kb"]},
            "recommended": "hero" if group == "hero" else "horde", "thumb": None if i % 97 == 41 else f"thumbs/{id_}.webp",
            "batch": batch, "published_at": when,
            "qa": {"verdict": "accept", "unpainted_seen": k["unpainted"]["seen"], "floating": k["pieces"]["floating_count"], "contacts": k["ground"]["contact_count"], "reach_ft": round(reach, 2), "notes": notes},
            "gemini": {"blind": f"(fixture) a small painted figure of a {name.lower()}"}}

specs = []
for cls, (tags, srd) in CLASSES.items():
    for race in RACES:
        for g in "mf":
            specs.append((f"hero-{cls}-{race}-{g}", f"{RACE_NAME[race]} {cls} ({'man' if g == 'm' else 'woman'})", "hero", race, g, cls, [cls] + tags, srd, SRC[g]))
for role, srd in ROLES.items():
    for race in RACES[:5]:
        for g in "mf":
            specs.append((f"town-{role}-{race}-{g}", f"{RACE_NAME[race]} {role} ({'man' if g == 'm' else 'woman'})", "townsfolk", race, g, role, [role, "townsfolk"], srd, SRC[g]))
for fam, srd in FOES.items():
    for j, kitname in enumerate(FOE_KIT):
        specs.append((f"foe-{fam}-{kitname.replace(' ', '-')}", f"{fam.capitalize()} with {kitname}" if j < 7 else f"{fam.capitalize()} {kitname}", "foe", None, None, fam, [fam, kitname], srd, SRC["foe"][j % 2]))
for j, b in enumerate(BEASTS):
    specs.append((f"beast-{b.replace(' ', '-')}", b.capitalize(), "beast", None, None, b.split()[-1], [b, "animal"], [b], SRC["beast"][j % 2]))
for j, b in enumerate(LARGE):
    specs.append((f"large-{b.replace(' ', '-')}", b.capitalize(), "large", None, None, b.split()[-1], [b, "large"], [b], SRC["foe" if j % 2 else "beast"][0], 2.0, 10))
# spread the groups through the batches the way a real day would (a bit of everything in each), then cut or pad to N
specs.sort(key=lambda s: (hash(s[0]) % 1000, s[0])) if False else specs.sort(key=lambda s: (sum(map(ord, s[0])) * 7919 % 1000, s[0]))
while len(specs) < N:
    s = specs[len(specs) % 300]; specs.append((s[0] + "-b", s[1] + ", second", *s[2:]))
figs = [entry(i, *s) for i, s in enumerate(specs[:N])]
figs[3]["race"] = None; figs[3]["tags"] = None; figs[3]["srd"] = None; figs[3]["qa"] = None; figs[3]["gemini"] = None   # nulls the page must survive
man = {"updated": figs[-1]["published_at"], "expected_total": N, "batch": figs[-1]["batch"], "fixture": True, "figures": figs}
json.dump(man, open(HERE / "manifest.json", "w"), indent=1)
from collections import Counter
print(len(figs), "figures;", dict(Counter(f["group"] for f in figs)), "batches", dict(Counter(f["batch"] for f in figs)))
