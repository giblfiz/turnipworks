# Smithy & workshop: blind room reads from the table camera

Method (the crypt's): each room alone in a headless tuner built from this branch's files and the real meshes
(`tools/shots.sh` → `integration/tests/room_shots.py`), labels off, three pictures (the game's 55-degree table view, a
second angle, straight above). Gemini 2.5 Pro describes them knowing nothing; a second, text-only call compares the
description with what the room was meant to be (`rooms.json` `reads_as`). The yard is shot with a forge on its north
side. One read is a coin: the table below is 2 seeds x 2 sizes, one read each. These are PRE-DEPLOY reads from the
sandbox (same code and meshes as shipped).

## Result (round 2, 36 rooms; the stock store from round 3)

| room | default 11 | default 12 | big 11 | big 12 | named as |
|---|---|---|---|---|---|
| Blacksmith's forge | yes | yes | yes | yes | "blacksmith's forge", every time; the judge lists forge, anvil, quench trough and bellows by name |
| Armourer & weaponsmith | yes | yes | yes | yes | "armorer's workshop", "armory and workshop"; once "armory or barracks training room" (big: the stands in ranks) |
| Carpenter's woodshop | yes | yes | yes | yes | "carpenter's or woodworker's workshop"; twice "or wheelwright's" (the spare wheel) |
| Potter's workshop | yes | yes | yes | yes | "potter's workshop", "kiln room" |
| Smith's shop front | yes | yes | yes | yes | "armorer's and weaponsmith's shop", "workshop and showroom" |
| Stock store | yes | yes | yes | partly | "storeroom or simple workshop", "warehouse storeroom" (rounds 1 and 2: NO, see below) |
| Smith's yard | yes | partly | yes | partly | "blacksmith's forge and work yard" (partly = it took the yard and the forge beside it for one place) |
| Smith's quarters | yes | yes | no | no | "bedroom"; at 1.6x "inn dormitory" (the inn's guest-room program at a size a bedroom never is) |
| Workshop passage | partly | partly | no | yes | "entry hall", "reception room", "antechamber" (the inn's hallway program, which reads this way in every type) |

**The four crafts are told apart**: 16 of 16 workshop reads name the right craft, and none names another's.

## What the rounds changed

1. **Round 1** (9 rooms): 8 yes. The armourer was named "a blacksmith's forge or armorer's workshop" and the judge said
   the room was "built around the anvil": an anvil stood within reach of the armour form, in the middle of the floor.
   It was taken out (a spare armour stand stands there now). After that the armourer is never called a forge first.
2. **The stock store** read as "a workshop and barracks" (round 1), then "a blacksmith's workshop" (round 2, 0 of 4).
   Asked what it saw: the coal bin was "a forge", the bar-iron racks "two long benches", the tally desk "a workbench",
   a sack "a bedroll". A store is told by shelves and stacks, not by what is stored: it is now shelving on the wall
   facing the door and round the walls, corner stacks, ONE rack of bar iron and the sawn boards; no coal bin, no clay
   bin, no desk. Round 3: 3 yes, 1 partly.
3. **Not changed:** the quarters and the passage are the inn's own programs in other walls; their reads are the inn's.

"Floating" and "clipping" remarks from the wide view (3 to 7 a room) were not chased: every one measured in the
crypt, castle and mansion rounds was wrong (PLAN.md 9). No page error and no missing file in any shot.

Pictures and the full answers: `shots-1/`, `shots-2/`, `shots-3/` (`read.json`; the PNGs are not in git).

## Live (after the deploy of 2026-10-12 21:41)

- Tuner: `data/rooms.json` on the live host lists the nine `smi-` rooms (135 room types in all).
- Game (`integration/tests/live_game_check.py SMI smi-forge 5 4`, a new campaign named `zz-smi-check-fauna`): Build →
  Fantasy → Smithy & workshop lists nine rooms, each with a hotkey and its icon; a 5x4 forge spawned with 23 things, no
  page error, no failed request. One blind read of its three pictures: "A blacksmith's forge or a smithy. Extremely
  sure: a forge, an anvil, a quenching trough, bellows and tools."
- The throwaway campaign `zz-smi-check-fauna` (`cmp_e0bg0gqka9`) is still on the relay: its name is not one
  `engine/tools/remove_throwaways.mjs` removes, and the GM seat that could delete it closed with the browser.
