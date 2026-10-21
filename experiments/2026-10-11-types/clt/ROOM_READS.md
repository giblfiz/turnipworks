# Cult sanctum: blind room reads at table distance (2026-10-12)

Method (the crypt's): each room alone in a headless tuner from the worktree's own files (`integration/room_shots.py`,
labels off), three pictures (the game's high three-quarter view, a second from the south-west, a top view), then Gemini
2.5 Pro twice per room: a blind description with no room or type name anywhere, then a text-only match against the
intended reading. Default size, seeds 11 and 12, two reads each (three in round 2). One read is a coin: counts below are
reads, not rooms. Records: `shots-r1/read.json`, `shots-r1-spiders/read.json`, `shots-r2/read.json` (pictures are
git-ignored). These are LOCAL reads; the live record is `shots-live/` when present.

A first attempt produced nothing: the tuner's palette had grown so tall that the stage was 62 px high. The script now
opens a 2000-px page.

## Round 1 (4 reads per room; flavor rooms 4 more as spiders)

| room | named as | verdict |
|---|---|---|
| Sanctum (devils) | "demonic chapel or ritual chamber", "unholy chapel" 4 of 4 | named, and the flavor is named |
| Sanctum (spiders) | "cultist's sanctuary", "unholy chapel", "spider-themed audience chamber" 3 of 4; once "cultist barracks or briefing room" (the rows of benches) | named 3 of 4 |
| Summoning chamber | "ritual chamber", "summoning room", "cultist shrine" 4 of 4; as spiders "spider cult ritual chamber" 4 of 4 | named (the match is "partly" because the four stones and the arch are not all picked out) |
| Inner sanctum | "demonic shrine" 4 of 4; as spiders "spider-themed shrine" 4 of 4 | named as a shrine of the flavor; the offering bowl and treasure are not seen |
| Forbidden library | "library", "scholar's study" 4 of 4 | a library, never a FORBIDDEN one |
| Holding cells | "dungeon holding cell", "guardroom" 4 of 4 | named |
| Acolytes' quarters | "barracks or dormitory" 4 of 4 | a dormitory; nothing says whose |
| Hidden entrance | "scholar's storeroom", "study or storeroom" 3 of 4 | reads as the false front it is; nobody says "hidden door" (the bookcase is one bookcase among the stores) |
| Processional passage | "ceremonial hall, antechamber to a crypt" 2 of 4; "forge, smeltery" 2 of 4 | NOT named on seed 11 |
| Robing room | "armoury, guardroom, barracks ready-room" 4 of 4 | NOT named |

What the judge called things: the rail of hooded robes, from above, is "a rack of maces" or "short swords"; robes on
wall pegs are "armour stands"; a row of alcoves with red arches and candle wax is "furnaces"; fire bowls down a passage
are "anvils or work stations"; the bronze offering bowl is "a pile of gold coins".

## Round 2 (after changes; 6 reads per room)

Changes: the passage keeps at most ONE alcove and one pair of fire bowls for every two pairs of figures; the robing
room's rail stands at the wall under 30 cells, a wardrobe from 12 cells, and the flavor's banner hangs over the robes.

| room | named as | verdict |
|---|---|---|
| Processional passage | "ceremonial hall", "shrine or tomb antechamber", "ritual chamber" 6 of 6 | named as a ceremonial way; "forge" is gone |
| Robing room | "armourer's workshop", "guard's quarters" 6 of 6 | still NOT named |

## Not solved
- **The robing room reads as an armoury.** The robe meshes are the cause (dark hooded shapes on a rail are weapon heads
  from above); no rule change moved it. It wants a robe stand that reads as cloth from above (paler lining showing,
  robes hung face-on to the camera) or robes laid out flat.
- The library is a library, the quarters a dormitory: correct rooms, but only their neighbours make them a cult's.
- The hidden entrance is not read as hiding anything, which is the point of it, but nothing was measured about whether a
  player finds the door.

## The live record (2026-10-12, after the deploy; one read per seed, seeds 11 and 12, devils)

From the deployed tuner (`shots-live/read.json`): Sanctum "demonic chapel" 2 of 2; Summoning chamber "ritual chamber or
summoning room" 2 of 2; Inner sanctum "demonic shrine", "gargoyle shrine and treasury room" 2 of 2; Holding cells
"holding cell" 2 of 2; Processional passage "ceremonial hall or antechamber" 2 of 2; Forbidden library "library, study or
scriptorium" 2 of 2; Acolytes' quarters "barracks or dormitory" 2 of 2; Hidden entrance "a secret study or a secure
storeroom", "a forgotten archive" 2 of 2; Robing room "guardroom or armoury" 0 of 2 (NOT named, as before).
Also checked live: a sun temple nave and cathedral (three seeds each) place only `--sun` flavor pieces, and the Dark
cathedral places devils (`shots-live-temple/`).
