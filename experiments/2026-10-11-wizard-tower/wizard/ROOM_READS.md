# Wizard's tower: blind room reads from the table camera

Method (`integration/tests/room_shots.py`, `room_reads.py`; the crypt's): each room alone in the tuner at its default
size, labels off, three pictures (two high three-quarter views, one top view) sent to Gemini 2.5 Pro as view-1/2/3 with
no room or type name anywhere: "what kind of room is this, and how sure are you". One read is a coin, so every figure
is out of 4 or 8 reads (2 or 4 seeds x 2 reads). The record is the LIVE tuner
(https://implausible.enterprises/projects/turnip-works/tuner/), `shots-live/` and `reads-live.log`;
rounds before it were shot from a local copy (`shots-r1` .. `shots-r4`).

## The live record (2026-10-12, tuner v=20261012181741; 2 seeds x 2 reads = 4 per room)

| room | named as (what the judge wrote) | score |
|---|---|---|
| Alchemy laboratory | "alchemist's laboratory or a potion maker's workshop" x2, "... or a potion maker's shop", "... or a potion shop" | 4 of 4 |
| Library & study | "wizard's study or a private library", "scholar's study or a small private library" x2, "scholar's study or a small library" | 4 of 4 |
| Summoning chamber | "ritual chamber or a summoning room" x2, "magical ritual or summoning chamber", "ritual or summoning chamber" | 4 of 4 |
| Observatory | "astronomer's study or a wizard's observatory", "... or an observatory workshop", "... or a small observatory" x2 | 4 of 4 |
| Potion store | "alchemist's workshop or an apothecary's storeroom" x2, "alchemist's storeroom or a potion shop", "alchemist's workshop or a potion shop" | 4 of 4 as an alchemist's or apothecary's room; a STORE in 3 of 4 |
| Apothecary shop | "alchemist's shop or an apothecary", "apothecary or alchemist's shop" x3 | 4 of 4 |
| Wizard's bedchamber | "wizard's or adventurer's bedroom" x3, "wizard's or mage's bedroom" | 4 of 4 |
| Familiars' menagerie | "creature handler's workshop or a beast-seller's storeroom", "beast tamer's workshop or a trapper's shop", "pet shop, menagerie, or trapper's workshop", "pet shop, menagerie, or an animal handler's workshop" | 4 of 4 as animal keeping; "menagerie" 2 of 4 |
| Tower stair | "ground-floor entry room or tower base", "tower ground floor or gatehouse entrance", "tower entrance room or a small keep's ground floor", "tower ground floor or a castle entryway" | 4 of 4 |
| Enchanter's workshop | "arcane workshop or a wizard's study", "wizard's study or an enchanter's workshop" x2, "enchanter's workshop or a wizard's study" | 4 of 4 as a wizard's workroom; "enchanter's" 3 of 4; the arch is never called a portal |
| Scrying room | "ritual chamber or a small shrine" x3, "small ritual chamber or a summoning room" | 0 of 4 as SCRYING; 4 of 4 as a ritual chamber |

**The scrying room is not named.** Before its rework the live read was worse ("spartan cell", "barracks cell", "small
arcane study or sanctuary", "puzzle room or ritual chamber": the cushion pile was a cot). It is now a room for a rite
at a basin, the right genre and the wrong word. The basin is dry until its water level is set on the bench, and the
crystal ball on its pedestal is too small to be seen as one from here ("a pedestal with a chalice").

So: ten rooms pass; the scrying room does not.

## What the judge took things for (asked: "list every distinct kind of thing ... what a player would take it for")

| piece | read as | what was done |
|---|---|---|
| the great egg in its nest, in the middle of the menagerie | "a round stone fire pit with embers" | the nest went to a corner; the iron cage took the middle |
| the bare perch tree, in the middle | "a coat rack or display stand" (the room: "a tailor's shop") | to a far corner |
| the planted tank (`vivarium`) | "a workbench with a green top" | kept, one per room, by the wall |
| the hutch | "a large green chest", "a sawhorse holding a log" | kept, one per room |
| the familiar's T perch | "a small anvil on a wooden stump" | out of the menagerie (still in the bedchamber) |
| hay scatter | "spools of rope or thread" | kept (it is straw under a cage now) |
| standing birdcages, the iron cage | "birdcages on stands", "a large animal cage" | two of every three wall pieces are birdcages now |
| curio cabinet, plain shelving (in the store) | "bookshelves" (the room: "a wizard's study") | the store takes bottle shelves and the drawer cabinet only |
| the cushion pile (scrying room) | "a simple cot with a pillow and blanket" (the room: "a guard's cell") | out; a stool instead |
| the standing mirror in a corner | "a heavy crossbow on the floor" | against a wall, and only from 16 cells |
| the crystal ball on its pedestal | "a small stone pedestal with an ornate cup or chalice" | kept; it wants a glow (ASSETS_TO_BUILD) |
| the ritual circle | "a large, complex geometric symbol on the floor", "glowing" | kept: it is the summoning chamber's whole read |

## Rounds

1. Round 1 (local, 2 seeds x 2 reads, every room): nine rooms named at once. Menagerie 2 of 4 ("tailor's shop" x2),
   store 2 of 4 ("wizard's study" x2).
2. Round 2 (store, menagerie; 4 seeds x 2): store 8 of 8 as an alchemist's or apothecary's room. Menagerie WORSE with the
   nest in the middle: 1 of 8 ("crafter's workshop" x7).
3. Round 3 (menagerie; 4 seeds x 2): the cage in the middle, birdcages round the walls: 8 of 8 as animal keeping
   ("creature holding room", "menagerie", "beast tamer's workshop", "pet shop").
4. A first live record (scrying: a cell or a shrine, 0 of 4), round 4 for the scrying room (local: "ritual chamber" 8 of 8), then the live record above.
5. Twice the live pictures were of a placeholder box (the stage had shrunk under the taller palette; reads such as "a throne room" for the laboratory): look at one picture before believing a batch of reads.

## From outside: four rooms stacked as a tower

One blind read of three outside views in the live game (`live-tower/`): "a tenement building, tall townhouse or
boarding house". See `../README.md`, "How a square tower reads".

## The game

`live-game/result.json` (https://turnipworks.net/, a throwaway campaign): Build → Fantasy → Wizard's tower lists the
eleven rooms, each with a hotkey and its painted icon (none missing); a summoning chamber built there has its circle,
candles, pylons, braziers and lectern (18 things), no page errors.
