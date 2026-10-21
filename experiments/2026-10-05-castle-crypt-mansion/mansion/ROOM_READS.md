# Mansion rooms: blind reads at table distance (2026-10-06)

Judge, pictures, prompt and bar exactly as the castle's (`../castle/ROOM_READS.md`): Gemini (gemini-2.5-pro) told nothing,
three pictures of one room, "what kind of room is this?"; default size, seeds 11 to 14; a room passes when it is named
specifically on 3 of the 4. Quoted: the judge's answer, shortened only at the end. Every full description:
`reads-rounds/round-N.json` (`-things.json`: the judge asked what it takes each thing for) and `shots-live/` (the
deployed tuner; pictures are git-ignored). The formal garden was read with an entrance hall on its north side.

## Result (the programs as shipped; a local tuner serving the shipped code)

| room | default | reads | verdict |
|---|---|---|---|
| Entrance hall | 5x6 | "grand foyer or main entrance hall" · "grand foyer or entrance hall" · "grand entrance hall or mansion foyer" · "grand entrance hall or mansion foyer" | 4 of 4 |
| Drawing room | 5x4 | "formal sitting room or parlor" · "formal parlor, sitting room, or drawing room" · "ornate parlor or sitting room" · "formal sitting room, parlor, or a wealthy study" | 4 of 4 |
| Dining room | 6x4 | "formal dining room or a council chamber" · "formal dining room or a manor's dining hall" · "formal dining room or a council chamber" · "formal dining room or a council chamber" | 4 of 4 |
| Library | 4x4 | "library or a study" · "study, library, or scholar's office" · "scholar's study or a private library" · "study or a private library" (round 2, after the bookcases went up first: "wall-to-wall bookshelves") | 4 of 4 |
| Master bedroom | 5x4 | "luxurious master bedroom or a high-end inn room" · "luxurious or master bedroom" · "luxurious or master bedroom" · "well-appointed or master bedroom" | 4 of 4 |
| Conservatory | 5x4 | "greenhouse, conservatory, or solarium" x 3 · "greenhouse, conservatory, or sunroom" | 4 of 4 |
| Formal garden | 7x6 | "manor's formal garden and entrance hall" · "formal garden or manicured courtyard" · "formal garden or manicured courtyard" · "formal manor garden or courtyard" | 4 of 4 |
| Ballroom | 8x6 | "training hall, armory fitting room, or a salle d'armes" · "formal antechamber or a small ballroom" · "private dressing and training room" · "gallery, showroom, or formal display room" (second reads: "ornate washroom or fitting room" · "formal reception hall or antechamber" · "elegant multi-purpose chamber" · "gallery, armory display room, or fencing practice hall") | **0 of 4** (1 read in 8, as a second choice). DOES NOT PASS |
| Servants' kitchen | 6x5 | "tavern common room or a private feasting hall" · "blacksmith's or armorer's workshop" · "large kitchen and dining hall, or an inn's great room" · "combined kitchen, dining, and workroom" (second reads: "craftsman's workshop and kitchen" · "blacksmith's forge or an armorer's workshop" · "large kitchen and crafting room" · "tavern kitchen or a farmhouse common room") | **2 of 4** (5 reads in 8 say kitchen). DOES NOT PASS |
| Wine cellar | 5x4 | "tavern cellar or storeroom" · "storeroom, workshop, or cellar" · "brewery, distillery, or alchemist's workshop" · "brewery storeroom or a cellar" (second reads: "tavern common room or a cellar taproom" · "storeroom, pantry, or cellar" · "workshop and barracks/dormitory" · "brewery, wine cellar, or general storeroom") | a CELLAR on 3 of 4; a WINE cellar in 1 read of 8. DOES NOT PASS as a wine cellar |

In the GAME (https://turnipworks.net/, a new campaign `zz-mansion-check-fauna`, room labels hidden, a 6x4 dining room,
51 things, no page or HTTP errors): "A formal dining or council room." The Build tray lists Mansion with its ten rooms,
each with an icon. The campaign was removed afterwards.

## The rounds, and what each changed

| round | read | what it was | change |
|---|---|---|---|
| 1 (the drafts on real meshes) | seven rooms 4 of 4 (above) | | kept; the library's bookcases moved before its fire and table (the node test wanted four cases where the real ones, 5 to 8 ft wide, left room for three) |
| 1 | ballroom: "opulent parlor", "grand parlor or recreation room", "ransacked formal parlor or salon", "formal parlor or billiard room" | three grand chandeliers: "ornate, spiky golden chandeliers that have fallen or are being stored on the floor"; the harpsichord "a billiards or game table", "a war table"; upholstered benches "green sofas"; the harp "a golden horn, a gramophone" | no chandeliers; gilt chairs only along the walls; harpsichord and sideboard from 70 cells |
| 1 | kitchen (the inn's program whole, 5x4): "alchemist's laboratory", "merchant's storeroom or a craftsman's workshop", "potter's workshop and storeroom", "artisan's workshop or forge" | as the castle's round 1 | the castle kitchen's works and fill |
| 1 | cellar (4x3): "cellar, pantry, or brewery storeroom", "dungeon storeroom or a cellar" | no wine-bin mesh; one or two wine racks | wine racks along the wall, dusty bottles; 5x4 |
| 2 | ballroom: "formal dressing room or fitting hall", "formal antechamber, parlor, or waiting room", "arming chamber or formal dressing room", "formal gallery, showroom, or reception hall" | asked what it saw: the 18 gilt chairs are not listed at all; music stands (3 x 4 x 3 ft) are "armor stands or workbenches"; a stool "a washbasin" | a musicians' stage (the castle's square dais) with the harp, a stand and a chair on it |
| 2 | kitchen: "alchemist's laboratory or potion-maker's workshop" x 2, "multi-purpose crafter's workshop", "blacksmith or armorer" | the cauldron on its crane, the inn's small hearth "a forge", a chopping block "an anvil" | the castle kitchen's whole program (the 11-ft hearth) at 6x5 |
| 3 | ballroom: "formal audience or reception hall", "small audience chamber", "private audience chamber or a lord's study" (6 of 8 reads) | the harp on the platform: "a throne-like object on a raised dais" | the stage is off again (left in the code, switched off, with the reason) |
| 3 | kitchen: "alchemist's kitchen", "alchemist's workshop" (kitchen in 3 of 8) | the cauldron | no crane and no second chopping block in the house kitchen |
| 3 | cellar: above | | none left to try without a mesh |
| 4 (shipped) | see the table above | | |

## What the programs cannot fix (asset notes, also in docs/ASSETS_TO_BUILD.md → Mansion)

- **The ballroom.** An empty floor has no name from above. Everything that says ballroom hangs (chandeliers: they read
  as lying on the floor) or is small and against a wall (chairs: not seen), and the instruments misread
  (`harpsichord`: billiards; `harp`: a horn, a throne; `music-stand`: an armour stand).
- **The wine cellar.** No `wine-bin-arched`; `wine-rack` is "a crate with a bottle" or "empty shelving"; casks say
  brewery. It is a cellar.
- **The kitchen.** `cook-hearth-spit--great` is "a massive forge" as often as a hearth; see the castle's notes.
- `table-feast--fine` and its chairs read ("ten chairs", "formal dining room") but as "a council chamber" as often:
  nothing on the table says food at this distance.

## LIVE (the record)

The deployed tuner (https://implausible.enterprises/projects/turnip-works/tuner/, v=20261006020315), one read a seed
(`shots-live/reads.json`). 0 page errors, 0 HTTP errors, 0 overlaps (`tuner.overlapReport(0.35)`), nothing outside a room
(`tuner.outsideReport(0.6)`) and no purpose fail in all 40 rooms. `assets_check.py --live`: 17,329 files on each host, 0 missing.

| room | reads | verdict |
|---|---|---|
| Entrance hall | "grand entrance hall or manor foyer" · "grand foyer or mansion entrance hall" · "grand foyer or mansion entrance hall" · "grand entrance hall or foyer" | 4 of 4 |
| Drawing room | "formal sitting room, parlor, or drawing room" · "formal sitting room, parlor, or lounge" · "formal sitting room or parlor" · "formal sitting room, parlor, or drawing room" | 4 of 4 |
| Dining room | "formal dining room or a council chamber" · "formal dining room or council chamber" · "stately dining hall or a formal council chamber" · "formal dining room or banquet hall" | 4 of 4 |
| Library | "private library or a scholar's study" · "scholar's study or a private library" x 3 | 4 of 4 |
| Master bedroom | "luxurious master bedroom or a noble's bedchamber" · "opulent or master bedroom" · "luxurious or master bedroom" · "well-appointed or master bedroom" | 4 of 4 |
| Conservatory | "greenhouse, conservatory, or orangery" · "greenhouse, conservatory, or sunroom" · "greenhouse or conservatory" · "greenhouse, conservatory, or sunroom" | 4 of 4 |
| Formal garden | "formal manor garden or courtyard" · "formal, manicured garden or courtyard" · "formal manor garden or a palace courtyard" · "formal garden or courtyard" | 4 of 4 |
| Ballroom | "formal dressing or arming room" · "ornate parlor or formal reception room" · "arming room or a formal dressing chamber" · "formal gallery, showroom, or training hall" | 0 of 4 |
| Servants' kitchen | "tavern's main hall or kitchen" · "large kitchen or a multi-purpose workshop" · "large kitchen and dining area" · "tavern common room or an inn's dining hall" | 3 of 4 here (2 of 4 before the deploy: it sits on the line) |
| Wine cellar | "tavern cellar or storeroom" · "tavern cellar or brewery storeroom" · "workshop or a well-stocked storeroom" · "brewery storeroom or a wine/ale cellar" | a cellar 3 of 4; wine 1 of 4 |
