#!/usr/bin/env python3
"""Coverage of the default figure set against what a published fantasy adventure calls for (Harry: "someone can walk in
with no kit, and be like, yeah, this adventure is no problem"). Backbone: the creatures and stock NPCs of the open D&D
System Reference Document 5.1, listed here from memory by challenge rating (so the list itself may have small errors),
every one up to CR 5 and the famous ones above. A creature is covered by its OWN figure when a figure's `srd` tags
name it first, by a STAND-IN when a figure lists it among others or STANDIN below names one, else it is MISSING.
    python3 coverage.py      -> COVERAGE.md, and the counts on stdout"""
import json
from pathlib import Path
HERE = Path(__file__).resolve().parent
A = [a for a in json.loads((HERE / "set/assets.json").read_text())["assets"] if a["group"] != "body"]
SRD = {
 "0": "awakened shrub, baboon, badger, bat, cat, commoner, crab, deer, eagle, frog, giant fire beetle, goat, hawk, homunculus, hyena, jackal, lemure, lizard, octopus, owl, quipper, rat, raven, scorpion, sea horse, shrieker, spider, vulture, weasel",
 "1/8": "bandit, blood hawk, camel, cultist, flying snake, giant crab, giant rat, giant weasel, guard, kobold, mastiff, merfolk, mule, noble, poisonous snake, pony, stirge, tribal warrior",
 "1/4": "acolyte, axe beak, blink dog, boar, constrictor snake, draft horse, dretch, drow, elk, flying sword, giant badger, giant bat, giant centipede, giant frog, giant lizard, giant owl, giant poisonous snake, giant wolf spider, goblin, grimlock, panther, pseudodragon, riding horse, skeleton, sprite, steam mephit, swarm of bats, swarm of rats, swarm of ravens, violet fungus, wolf, zombie",
 "1/2": "ape, black bear, cockatrice, crocodile, darkmantle, deep gnome (svirfneblin), dust mephit, giant goat, giant sea horse, giant wasp, gnoll, gray ooze, hobgoblin, ice mephit, lizardfolk, magma mephit, magmin, orc, reef shark, rust monster, sahuagin, satyr, scout, shadow, swarm of insects, thug, warhorse, warhorse skeleton, worg",
 "1": "animated armor, brass dragon wyrmling, brown bear, bugbear, copper dragon wyrmling, death dog, dire wolf, dryad, duergar, ghoul, giant eagle, giant hyena, giant octopus, giant spider, giant toad, giant vulture, harpy, hippogriff, imp, lion, quasit, specter, spy, swarm of quippers, tiger",
 "2": "ankheg, awakened tree, azer, bandit captain, berserker, black dragon wyrmling, bronze dragon wyrmling, centaur, cult fanatic, druid, ettercap, gargoyle, gelatinous cube, ghast, giant boar, giant constrictor snake, giant elk, gibbering mouther, green dragon wyrmling, grick, griffon, hunter shark, merrow, mimic, minotaur skeleton, ochre jelly, ogre, ogre zombie, pegasus, plesiosaurus, polar bear, priest, rhinoceros, rug of smothering, saber-toothed tiger, sea hag, silver dragon wyrmling, swarm of poisonous snakes, wererat, white dragon wyrmling, will-o'-wisp",
 "3": "basilisk, bearded devil, blue dragon wyrmling, doppelganger, giant scorpion, gold dragon wyrmling, green hag, hell hound, killer whale, knight, manticore, minotaur, mummy, nightmare, owlbear, phase spider, veteran, werewolf, wight, winter wolf",
 "4": "black pudding, chuul, couatl, ettin, ghost, lamia, red dragon wyrmling, succubus/incubus, wereboar, weretiger",
 "5": "air elemental, barbed devil, bulette, earth elemental, fire elemental, flesh golem, giant crocodile, giant shark, gladiator, gorgon, half-red dragon veteran, hill giant, night hag, otyugh, roper, salamander, shambling mound, triceratops, troll, unicorn, vampire spawn, water elemental, werebear, wraith, xorn",
 "6+ (famous)": "chimera, cyclops, drider, invisible stalker, mage, mammoth, medusa, vrock, wyvern, young white dragon, young black dragon, young green dragon, young red dragon, young brass dragon, giant ape, oni, shield guardian, stone giant, assassin, chain devil, cloaker, frost giant, hezrou, hydra, spirit naga, tyrannosaurus rex, bone devil, clay golem, cloud giant, fire giant, glabrezu, treant, deva, guardian naga, stone golem, djinni, efreeti, gynosphinx, horned devil, roc, archmage, vampire, mummy lord, iron golem, lich, kraken, storm giant, erinyes",
}
# stand-ins that no figure's tags name: creature -> (figure id, why it will do)
STANDIN = {
 "badger": ("beast-fox", "a small low mammal"), "giant badger": ("foe-giant-rat", "a dog-sized digging mammal"), "weasel": ("beast-fox", "a small mammal"), "giant weasel": ("foe-giant-rat", "a dog-sized vermin mammal"),
 "lizard": ("beast-toad", "a small reptile familiar"), "octopus": ("foe-tentacle", "a tentacle at the surface"), "sea horse": ("foe-shark", "water creature marker"), "giant sea horse": ("foe-shark", "water creature marker"),
 "spider": ("foe-giant-spider", "the same figure, read small"), "rat": ("foe-giant-rat", "the same figure, read small"), "eagle": ("beast-hawk", "a bird of prey"), "vulture": ("beast-raven", "a carrion bird"),
 "flying snake": ("foe-giant-snake", "a snake"), "blink dog": ("beast-dog", "a dog"), "elk": ("beast-stag", "a stag"), "giant elk": ("beast-stag", "a stag, scaled up"), "giant goat": ("beast-goat", "a goat, scaled up"), "giant boar": ("foe-boar", "a boar, scaled up"),
 "giant owl": ("beast-owl", "an owl, scaled up"), "giant vulture": ("foe-giant-eagle", "a giant bird"), "black bear": ("beast-bear", "a bear"), "polar bear": ("beast-bear", "a bear"), "draft horse": ("beast-horse", "a horse"),
 "panther": ("beast-tiger", "a big cat"), "saber-toothed tiger": ("beast-tiger", "a big cat"), "giant hyena": ("foe-death-dog", "a gaunt hound"), "hyena": ("foe-death-dog", "a gaunt hound"), "jackal": ("beast-dog-small", "a small dog"), "baboon": ("beast-ape", "an ape"), "giant ape": ("beast-ape", "an ape, scaled up"),
 "mammoth": ("beast-elephant", "an elephant"), "pseudodragon": ("foe-dragon-wyrmling", "a tiny dragon"), "shadow": ("foe-wraith", "a dark spirit"), "specter": ("foe-ghost", "a ghost"), "lemure": ("foe-dretch", "a wretched least fiend"), "quasit": ("foe-imp", "a tiny fiend"),
 "minotaur skeleton": ("foe-skeleton-greataxe", "a skeleton with a great axe; scale up"), "ogre zombie": ("foe-zombie-butcher", "a big zombie; scale up"), "warhorse skeleton": ("beast-warhorse", "a warhorse"), "nightmare": ("beast-warhorse", "a dark warhorse"),
 "plesiosaurus": ("foe-sea-serpent", "a long neck rising from the water"), "giant crocodile": ("foe-crocodile", "a crocodile, scaled up"), "giant lizard": ("foe-crocodile", "a big reptile"), "giant octopus": ("foe-tentacle", "a tentacle"), "kraken": ("foe-tentacle", "several tentacles"),
 "swarm of bats": ("foe-giant-bat", "one bat for the swarm"), "swarm of ravens": ("beast-raven", "one raven for the swarm"), "swarm of insects": ("foe-giant-beetle", "one insect for the swarm"), "swarm of poisonous snakes": ("foe-giant-snake", "one snake for the swarm"),
 "wereboar": ("foe-werewolf", "a lycanthrope"), "weretiger": ("foe-werewolf", "a lycanthrope"), "werebear": ("foe-werewolf", "a lycanthrope"), "half-red dragon veteran": ("hero-fighter-dragonborn-m", "a dragonborn soldier"),
 "rug of smothering": ("foe-flying-sword", "an animated object"), "shield guardian": ("foe-iron-golem", "a metal construct"), "clay golem": ("foe-stone-golem", "a golem"), "xorn": ("foe-earth-elemental", "an earth creature"), "invisible stalker": ("foe-air-elemental", "an air creature"),
 "cloaker": ("foe-darkmantle", "a cave lurker"), "chuul": ("foe-giant-crab", "a pincered shell creature"), "merrow": ("foe-merfolk", "a merfolk"), "sea hag": ("foe-hag", "a hag"), "night hag": ("foe-hag", "a hag"), "azer": ("foe-grey-dwarf", "a dwarf-shaped fire being"), "magmin": ("foe-mephit", "a small fire being"),
 "oni": ("foe-ogre-chief", "an ogre lord"), "cloud giant": ("foe-frost-giant", "a giant"), "storm giant": ("foe-frost-giant", "a giant"), "stone giant": ("foe-hill-giant", "a giant"), "roc": ("foe-giant-eagle", "a giant bird"),
 "glabrezu": ("foe-demon", "a hulking demon"), "hezrou": ("foe-demon", "a hulking demon"), "bearded devil": ("foe-devil", "a devil"), "barbed devil": ("foe-devil", "a devil"), "bone devil": ("foe-devil", "a devil"), "chain devil": ("foe-devil", "a devil"), "erinyes": ("foe-angel", "a winged warrior; or the succubus"),
 "gynosphinx": ("foe-lamia", "a lion-bodied woman"), "spirit naga": ("foe-naga", "a naga"), "guardian naga": ("foe-naga", "a naga"), "mummy lord": ("foe-mummy", "a mummy"), "vampire spawn": ("foe-vampire-m", "a vampire"),
 "commoner": ("town-human-commoner-m", "any commoner of the right people"), "guard": ("town-human-guard", "any guard of the right people"), "noble": ("town-human-noble", "any noble of the right people"), "acolyte": ("town-nun", "any priest or acolyte"), "priest": ("town-human-priest", "any priest of the right people"),
 "tribal warrior": ("hero-barbarian-human-m", "a barbarian"), "berserker": ("hero-barbarian-human-m", "a barbarian"), "scout": ("foe-bandit-scout", "a hooded scout; or any ranger"), "spy": ("town-thief", "a hooded sneak; or any rogue"), "thug": ("foe-bandit-mace", "a bandit thug"),
 "knight": ("hero-paladin-human-m", "a knight in plate; or the animated armour"), "veteran": ("hero-fighter-human-m", "a fighter"), "gladiator": ("hero-fighter-orc-m", "a fighter"), "druid": ("hero-druid-human-m", "a druid"), "mage": ("hero-wizard-human-m", "a wizard"), "archmage": ("hero-wizard-human-m", "a wizard"), "assassin": ("hero-rogue-human-m", "a rogue"),
 "bandit": ("foe-bandit-club", "the bandit family"), "cultist": ("foe-cultist-dagger", "the cultist family"),
}
ids = {a["id"] for a in A}; first, also = {}, {}
for a in A:
    for k, n in enumerate(a.get("srd") or []):
        (first if k == 0 else also).setdefault(n.lower(), a["id"])
rows, counts = [], {"own figure": 0, "stand-in": 0, "missing": 0}
for cr, names in SRD.items():
    for n in [x.strip() for x in names.split(",")]:
        if n in first: fid, st, why = first[n], "own figure", ""
        elif n in also: fid, st, why = also[n], "stand-in", "tagged on that figure"
        elif n in STANDIN and STANDIN[n][0] in ids: fid, st, why = STANDIN[n][0], "stand-in", STANDIN[n][1]
        else: fid, st, why = "", "missing", "" if n not in STANDIN else f"stand-in {STANDIN[n][0]} is not in the list"
        counts[st] += 1; rows.append((cr, n, fid, st, why))
md = ["# Coverage: SRD creatures against the figure set", "", f"{len(rows)} creatures listed (SRD 5.1, every creature up to CR 5 and the famous ones above; the list is from memory).",
      f"**Own figure: {counts['own figure']}. Stand-in: {counts['stand-in']}. Missing: {counts['missing']}.**", "", "| CR | creature | figure | status | note |", "|---|---|---|---|---|"]
md += [f"| {cr} | {n} | {('`' + fid + '`') if fid else ''} | {st} | {why} |" for cr, n, fid, st, why in rows]
(HERE / "COVERAGE.md").write_text("\n".join(md) + "\n")
print(len(rows), counts, "missing:", [n for cr, n, fid, st, why in rows if st == "missing"])
