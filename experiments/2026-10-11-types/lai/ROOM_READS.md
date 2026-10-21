# Monster lair: blind room reads at table distance

Method: `integration/tests/lair_shots.py` (the shared room_shots.py under its own name: it uses no fixed port) lays each
room alone in a headless tuner, labels off, three pictures (two high three-quarter views, one top view);
`room_reads.py` sends them to Gemini 2.5 Pro with no room or type name anywhere. Three reads a room (one read is a coin).
Default sizes, seed 11, the sandbox built from this branch on the main tree's meshes. The record after landing is the
live round at the end.

## Round 2 (2026-10-12, real lai-01 meshes) and round 3 (five rooms reworked)

| room | named as (3 reads) | verdict |
|---|---|---|
| Cave mouth | "monstrous or tribal encampment, ritual site"; "wasteland encampment or ambush site"; "monster's lair or a wasteland campsite" | yes: the approach to a lair, with its camp (the cave itself is not named: the mouth piece stands only when no lair is beside it) |
| Cave passage | "dungeon storeroom or cellar"; "fungus-filled cave passage"; "dungeon corridor" | partly: a corridor 2 of 3, a cave 1 of 3 (hewn cut-rock walls read as built) |
| Goblin warren | "monstrous chieftain's quarters or a bandit leader's den"; "monster chieftain's throne room and quarters"; "monster's lair or primitive chieftain's quarters" | yes 3 of 3 (the bone throne on its loot is named every time) |
| Beast den | r2: "monster's pen, larder, or grotesque garden"; "larder or fungal grotto"; "creature's pen or monster's lair". r3: "monster's lair or creature's den" x3 ("a large nest, the skeleton of a past meal") | yes 3 of 3 after the giant mushrooms were taken out |
| Spider nest | "spider-themed monster lair"; "monster's lair or an arachnid nest"; "arachnid lair or spider-infested tomb" | yes 3 of 3 |
| Larder | r2: "flesh-crafter's workshop, necromancer's laboratory, abattoir" x3. r3: "dungeon larder, butchery, or meat storage"; "butcher's workshop or creature's larder"; "butcher's workshop, abattoir backroom, or tanner's shed" | yes 3 of 3 after bones, wrapped bodies and the salting troughs ("surgical beds") were taken out |
| Prisoner pit | "dungeon holding cell or a monster's feeding pit"; "holding cell or monster's pen"; "holding cell or oubliette" | yes 3 of 3 |
| Hatchery | r2: "goblin den or storeroom"; "monster's larder"; "rustic storeroom, pantry ... fruits, vegetables". r3: "monster's lair or hatchery"; "creature's lair or nest"; "creature's lair or hatchery" | yes after the great clutch was laid IN a nest (eggs loose by the walls read as fruit) |
| Trophy cave | r2: "torture chamber or holding cell" x2, "guardroom". r3: "monster's barracks or trophy den"; "dungeon guardroom or a monster's trophy room"; "monster hunter's workshop or trophy room" | yes 3 of 3 name a trophy room, each with a second guess |
| Dragon's hoard | r2: "monster's lair or nest" x3 (the heap: "a large, orange, cratered mound: a monster nest or burrow"). r3: "monster's lair and treasure hoard"; "creature's lair or nest ... treasure chests (hoard)"; "monster's lair or treasure hoard" | yes as a treasure lair; never "dragon" (the dragon is a figure) |

The four creature kinds are told apart: chieftain's quarters (goblin), arachnid lair (spider), a beast's den with a nest
and a kill (beast), a treasure lair (dragon).

## What the reads changed
- **The hoard heap came out orange and read as a nest** ("cratered mound"). Its colour map was graded to yellow-gold
  (`tools/grade_gold.py`; originals in `models-ungraded/`): mean of the coin surface (174,105,31) -> (226,186,72). After
  that the room is a treasure hoard in all three reads. Lesson: gold must be YELLOW and bright to read as gold from above.
- **Bone and skull heaps read as dark mounds, droppings or "spiky pods"** from the table camera; the flat loose-bone decal
  is what reads as bones. Heaps are kept for the warnings at a door; rooms that must not look like a charnel house (larder,
  trophy cave) have none.
- **Armour on stands read as a rack or stocks** (the trophy cave was a torture chamber). Trophies are now things on
  plinths, shield stacks, banners, skull totems, a stretched hide, and the dragon skull at the far end.
- **Hung carcasses beside low troughs and wrapped bodies read as a necromancer's laboratory.** With barrels and sacks
  only, the same hung carcasses are a larder.
- **Eggs in rows by the walls read as produce.** A nest under the great clutch makes it a hatchery.
- **Giant mushrooms take a room over** ("fungal grotto", "fungus-choked corridor"): not used in the lair.
- Round 1 (2026-10-11, before any lair mesh, library only): beast den "a monster's lair or a creature's den"; cave mouth
  "an abandoned campsite in a clearing"; passage "sewer passage or dungeon corridor"; warren "barracks, guardroom or
  chieftain's quarters". Records in `shots/r1/`.

## Live record (2026-10-12, after landing; https://implausible.enterprises/projects/turnip-works/tuner, seed 12, two reads a room)

| room | named as | |
|---|---|---|
| Cave mouth | "savage beast's lair or primitive ritual ground"; "monstrous beast's lair or primitive tribal camp" | yes |
| Cave passage | "dungeon corridor or hallway"; "stone dungeon corridor" | a corridor, not a cave |
| Goblin warren | "monster chieftain's quarters or primitive throne room"; "primitive chieftain's quarters or monster's lair" | yes |
| Beast den | "creature's lair or pen"; "creature's lair or feeding pen" | yes |
| Spider nest | "spider-infested dungeon lair" x2 (webs, egg sacs) | yes |
| Larder | "butcher's workshop or dungeon larder"; "butcher's room, larder, or abattoir" | yes |
| Prisoner pit | "dungeon prison cell or antechamber to an oubliette"; "prison cell or oubliette" | yes |
| Hatchery | "monster's feasting den or lair ... a central cooking fire"; "monster's den or barracks" | NO at this seed: the two braziers beside the nest read as a cooking fire. Changed after this round: the braziers stand by the side walls (deployed; not read again) |
| Trophy cave | "dungeon trophy room or a monster's lair"; "dungeon corridor or a crypt" | 1 of 2 |
| Dragon's hoard | "creature's lair or nest ... scattered treasure (hoarding)"; "monster's lair or den ... treasure chests (hoarded loot)" | a lair with a hoard; the heap is still a "nest" to one read in two |

The game (https://turnipworks.net/, a new throwaway campaign): Build -> Fantasy -> Monster lair lists the ten rooms, every
icon present, a Dragon's hoard 8x7 built with 32 things, no page errors (`live-game/result.json`).
