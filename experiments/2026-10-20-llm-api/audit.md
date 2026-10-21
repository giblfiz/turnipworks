# GET API gap audit, 2026-10-20

The question: of every command a GM or player seat can send (engine/core/commands.js `REGISTRY`, internal ones left out,
plus the GET-only `turn.roll`), which can an AI seat send over GET, which does its rules card explain, and which change
something the AI can read back? The table is produced, not hand-written: `audit.mjs` runs each command's fixture
against a throwaway relay with the real room engine, as a GM assistant (every class) and as a player's advisor
(the player classes), and diffs the GM assistant's own reads before and after. `audit-before.md` is the same script run
against origin/main at 74ad167c (the API as last touched 2026-10-15); `audit-after.md` is this branch.

| | before | after |
|---|---|---|
| GM assistant's rules card | 22,519 chars, 2,985 words | 9,265 chars, 903 words (+ 9 help pages, 37k in all) |
| player advisor's card | 13,213 chars, 1,740 words | 6,811 chars, 681 words |
| commands that work over GET with a fixture | 56 of 72 | 58 of 72 (dice.roll, room.reroll) |
| ... of which an AI's reads show the change | 42 | 56 |
| a weak model's five tasks (live, gpt-5.6-luna) | — | 4/5 on the first card, 5/5 after the fix (twice), harder set 5/5 |

"Explained" went from 52 to 63, but the before figure flatters: the old card listed every command of the seat's
classes with every raw argument (`hp`, `factionMissing`, `keepSession`, `layout`...), with the class description
repeated per line, and explained only some of them.

## What the audit found (before)

1. **Dice were the AI's to pick.** `dice.roll` needed `rolls` and `total`: an AI seat chose its own numbers (refused
   when it sent none). Over GET it carried no `throw`, so browsers showed a plain chat line, no dice. Now the relay
   rolls (core/dice.js, the browser's parser); every browser throws an AI seat's dice itself and lands them on the
   committed numbers (browser_dice G10).
2. **Lights, doors and things were unreadable.** `state` listed objects with name and position only: no catalog piece,
   no `lit`, no `open`, no light radius, no lock, no faction. An AI could light a candle only by guessing which object
   was one. Now `scene` lists `lights` and `doors` with ids, and every object carries cat / variant / light / lit /
   radius / open / locked / pinned / tilted / faction.
3. **Darkness, fog of war and the play rules were invisible** (area settings, campaign defaults) and unsettable
   except as raw JSON in `area.set&settings=`. Now `rules` is in `scene` and `state`; `area.set&darkness=true`.
   Pawns' darkvision / lightCarried / visionRadius were not shown; now they are.
4. **Templates, water and wall edits were not read at all** (`template.*`, `water.*`, `edge.*`: NO). Now `state` has
   `templates`, `water`, `walls`.
5. **Factions:** `faction.set` worked but nothing showed a room's faction and there was no list. Now rooms carry
   `faction` (own or inherited), `/factions` lists them, and `flavor=Sun` resolves by name.
6. **Re-roll / retype a room** was refused (the browser sends the solved layout). Now the relay solves it.
7. **object.place by catalog id "worked" with no mesh** (no sku / url / size: the client drew a placeholder). Now
   `cat=` fills the library's mesh and size and the room it stands in.
8. **Replace with similar** needed the exact cat / sku / url. Now `object.replace&id=` with no cat picks one.
9. **Room types:** 145 types were one comma-separated line on the card. Now `/rooms` and `help/rooms` group them
   (Crypt, Castle, Mansion, Temple, Dungeon, Wizard's tower, Market & village, Mine, Cult sanctum, Farmstead, Smithy...).
10. **Room labels**: no read said whether a room had one beyond `name`, and nothing told an AI that labels never reach
    players. The live trial showed why that matters (below).
11. **A switch that was not "true"/"1" read as false**: `hidden=yes` or `hidden=hide` REVEALED. Now refused unless
    true/false/1/0/yes/no/on/off.
12. **Lists needed JSON** (`conditions=["prone"]`); `conditions=prone` failed. Now `a,b,c` works and `conditions=`
    clears.

## Permissions (every new route)

An AI seat acts through the same `dispatch` as before, so class, scope and the creator's current permissions are
unchanged; what was new to check is what the new reads and conveniences reveal or touch first:
- `scene`, `room/<id>`, the new `state` fields: built from the same `entityVisible` + `seesLabels` filter as `state`.
  A player's advisor never receives a hidden room, its things, its pawns or its lights; a room's label never (it gets
  the type's own name); `room/<hidden room>` answers word for word like a room that does not exist.
- `token.create&room=`, `token.move&room=`, `object.replace` with no cat, `room.reroll` solved on the relay,
  `object.place&cat=` (its room from the point): each checks the room or thing against what THIS seat may see before
  using it, then dispatches normally (a narrow chat-only seat is refused all of them).
- GM notes: not in any new read (llm.test 6).
- **Fixed: the GM assistant's ghost.** Reading or looking inside a hidden room moved the GM assistant's ghost cursor
  there, visible to the players (the GM's own cursor has been withheld there since 2026-10-15). Now the ghost is the
  GM side's only inside a hidden room (llm.test 6, with an open-room positive control).
- Short tokens: one character off, another campaign's address, the snapshots route, a revoked seat: all refused
  (llm.test 7, 8).

## Still not over GET (deliberately, or not yet)

- `fog.explore`, `fog.reveal`: rasters of what a browser's pawns see; an AI has no eyes. Said in `help/light`.
- `stair.flip`, `area.delete`, `request.resolve`, `pawn.bring` / `pawn.bench`: work over GET, but the fixture needs a
  state the audit does not build (stairs are covered by relay.test "storeys").
- `cast.use` changes only the cast's "last used" stamp: nothing to read.
- `fog.reset`: clears what players explored; explored fog is per viewer and not in any AI read.
- `batch`: works (one op per line in JSON), not offered on the card.
- Whole-building generation, painting floor tiles cell by cell, drawing water by hand: browser tools.
- Seats, requests: agents never hold these classes (perms.js `AGENTS_NEVER`).
