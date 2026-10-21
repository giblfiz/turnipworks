# Crypt rooms: blind reads at table distance (2026-10-05)

Judge: Gemini (gemini-2.5-pro), told nothing: three pictures of one room (two high three-quarter views and a top view,
sent as view-1/2/3) and "what kind of room is this?". Script: `../integration/tests/room_shots.py`. A second, text-only
call compares the description with the designer's intended reading (`match`). Pictures and full texts are in `shots*/`
(git-ignored pictures; `read.json` holds every description). Final round = the LIVE tuner
(https://implausible.enterprises/projects/turnip-works/tuner/, v=20261005200938), default size, seeds 11 and 12,
0 page errors and 0 HTTP errors in all 14 rooms, 0 overlaps, nothing outside a room.

## Rework of the ossuary, the catacomb and the chapel (2026-10-05, night)

The first integration left three rooms short: the ossuary and the catacomb were named only "crypt, tomb or burial chamber",
the chapel a throne room on some seeds. The PROGRAMS were changed (and room defaults: wall panels, floors, default size, the
door's wall), never the test and never a mesh. Bar: the read names the specific room on 3 of 4 seeds, at two sizes.
Same judge, same three pictures, same prompt (`room_shots.py` BLIND); seeds 11 to 14; "big" = 1.6 x the default, as the script has it.
Quoted: the judge's whole answer to "what kind of room is this".

### Before (local tuner at f7f4e8e, 24 rooms)

| room | default | big |
|---|---|---|
| Ossuary 4x4 / 6x6 | 2 of 4: "A crypt, ossuary, or tomb chamber." · "a crypt or a tomb's main chamber" · "An undead throne room or crypt." · "A crypt, ossuary, or tomb chamber." | 0 of 4: "ancient tomb or throne room" · "A symmetrical tomb chamber or crypt." · "An ancient crypt or a burial throne room." · "A crypt's throne room or a ritual chamber." |
| Catacomb 6x2 / 10x3 | 1 of 4: "a crypt or burial chamber" · "crypt or burial chamber" · "A crypt, catacomb, or burial storeroom." · "dungeon storeroom or a crypt's larder" | 2 of 4: "A crypt, catacomb, or tomb storeroom." · "A dungeon crypt or a catacomb storeroom." · "A crypt storeroom or a tomb's antechamber." · "crypt storeroom or an ossuary" |
| Chapel 4x7 / 6x11 | 3 of 4: "A small chapel, crypt chamber, or temple hall." · "A small throne room, audience chamber, or chapel." · "small chapel, funerary hall, or crypt" · "A small chapel, crypt, or funerary chamber." | 1 of 4: "A barracks, dormitory, or infirmary." · "A small chapel, audience hall, or courtroom." · "A simple chapel, institutional ward, or lecture hall." · "chapel, small throne room, or audience hall" |

### After (the reworked programs, local tuner, before the deploy)

| room | default | big | verdict |
|---|---|---|---|
| Ossuary 4x4 / 6x6 | 4 of 4: "An ossuary or a burial crypt." · "crypt, ossuary, or undead hatchery" · "A dungeon crypt, tomb, or ossuary." · "A crypt, ossuary, or burial chamber." | 4 of 4: "An ossuary, crypt, or burial chamber." · "A crypt, ossuary, or burial chamber." · "A crypt, ossuary, or burial chamber." · "An ossuary, crypt, or burial chamber." | PASSES. Three more reads of each of the round-1 pictures: 24 of 24 say ossuary |
| Chapel 4x7 / 6x11 | 4 of 4: "funerary chapel or a crypt chamber" · "A tomb, crypt, or funerary chapel." · "cultist's ritual chamber, mortuary, or interrogation room." · "A tomb chapel or funerary crypt." | 4 of 4: "A chapel, prayer hall, or funerary chamber." · "a small chapel, infirmary, or barracks assembly room" · "A small chapel or a crypt antechamber." · "A funerary chapel or a crypt chapel." | PASSES (two of the eight are weak: "mortuary" with no chapel, and "chapel, infirmary or barracks assembly room"). Three more reads of each round-1 picture: 24 of 24 say chapel, 23 of them funerary or mortuary, none a throne room |
| Catacomb 10x3 / 16x5 | 3 of 4: "A crypt, ossuary, or catacomb chamber." · "A crypt, catacomb, or burial chamber." · "crypt, tomb, or catacomb" · "A crypt or an ossuary." | 1 of 4: "A monster pen or beast kennel." · "A stable, barracks, or animal stalls." · "A crypt, catacomb, or ossuary." · "A dungeon animal pen or beast lair." (12x3: 2 of 4) | DOES NOT PASS at two sizes. See below |

### After, LIVE (https://implausible.enterprises/projects/turnip-works/tuner/, v=20261005220207; `room_shots.py`, pictures and every description in `shots-rework-live/`)

0 page errors, 0 HTTP errors, 0 overlaps, nothing outside a room, no purpose fail in all 24 rooms. `assets_check.py --live`: 13,708 files on each host, 0 missing.

| room | default | big | verdict |
|---|---|---|---|
| Ossuary 4x4 / 6x6 | 3 of 4: "A crypt or burial chamber" · "A crypt, ossuary, or burial chamber" · "A crypt ossuary or a tomb's bone pit" · "A crypt, ossuary, or bone-storage room" | 4 of 4: "A crypt, tomb, or ossuary" · "A dungeon crypt or ossuary chamber" · "A crypt or an ossuary" · "An ossuary, crypt, or burial chamber" | named |
| Chapel 4x7 / 6x11 | 4 of 4: "A chapel, funerary hall, or crypt chamber" · "A funerary chapel or a crypt" · "A chapel, mortuary, or funeral hall" · "A funerary chapel or a mausoleum's main chamber" | 4 of 4: "barracks chapel, infirmary, or funerary chapel" · "small chapel or funerary hall" · "dungeon chapel or a funerary prayer hall" · "A crypt chapel or a funerary hall" | named (funerary in 8 of 8) |
| Catacomb 10x3 / 16x5 | 3 of 4: "It is a crypt, ossuary, or catacomb storeroom" · "A crypt, catacomb, or ossuary" · "A crypt, catacomb, or burial hall" · "A crypt, ossuary, or burial chamber" | 0 of 4: "A grimy barracks, creature lair, or slave pen" · "A stable, barn, or animal pen" · "crypt, tomb, or ossuary" · "A grim barracks, slave pen, or creature lair" | named at its default size only |

### What changed in each program

- **Ossuary.** No bone shrine (it read as a throne or an altar in 8 rooms of 8, and the room as "built around" it). The key piece is
  a great heap of skulls in the middle of the floor, at the largest size the catalog allows the role (5 ft; `ccmScaled`), with bones
  heaped against it; skull-faced pillars on a square round it (4 from 17 ft across); skull panels on EVERY outside wall segment except
  the door wall (which keeps its torches); a bone trough per 12 ft of side wall; heaps in the far corners; the bone-strewn earth floor
  only; twice the loose bones.
- **Chapel of rest.** A coffin (3 in 4) or a wrapped body lies ON the bare bier: the pall-draped coffin, red and gold, read as a
  throne or a draped table and is no longer rolled. No altar cloth (it read as an open book, the altar as a desk). The outside door is
  on the short wall facing the altar (`DOOR_ENDS`). At most six rows of seats (29 stone benches read as rows of cots: "a barracks,
  dormitory, or infirmary"); in a long chapel, sarcophagi lie along the side walls behind the seats. Only the first urn (the second
  reads as a barrel).
- **Catacomb corridor.** Niche panels on every segment of both long walls (between plain panels they read as shelves of sacks: asked
  only about the walls, the judge called all three versions "burial niches ... like the loculi of a catacomb" when they ran end to
  end). Entered at an END (`DOOR_ENDS`), and a lone corridor has a way on at the other end (`THROUGH`: the oak door; two iron gates
  read as a cell block). 10x3 by default. Coffins and wrapped bodies along both walls about every 9 ft, loose bones, tall candles on
  the floor (nothing hangs on a niche panel), a torch on each end wall. Earth floors only (the damp blue flagstones read as shallow
  water). No bone rack ("bookshelf", "wine rack"), no urn niche ("wine rack"), no plaques, no heaps of skulls ("hay", "sacks").

### The catacomb: what was tried, and why it stops short

The judge is noisy on this room: the SAME three pictures are named a catacomb in 1 to 3 reads of 3. So variants were scored on 3 reads
x 4 seeds x 2 sizes (24 reads an arm), not on four single reads. Share of reads that say "catacomb":

| what | result |
|---|---|
| the shipped program, 10x3 | about 7 in 10: 58 of 84 reads (9/12, 9/12, 9/12, 8/12, 7/12, 6/12, 7/8, 3/4 across arms that differ only in details) |
| the same at 6x2, 8x2, 10x2 (2 cells wide) | 0 to 5 in 10. At the table camera's 55 degrees the near wall hides 6 ft of a 9-ft floor |
| the same at 8x3, 12x3, 13x3 | 3 to 5 in 10 |
| the same at 14x4, 16x5 | 3 to 5 in 10; 16x5 reads as "barracks", "kennel", "animal stalls" (rows of coffins = bunks) |
| niches without the wrapped-body version; only the wrapped-body version | no better (library, archive; "prison", "holding cells") |
| skull panels instead of niches, or alternating with them | "catacomb" 0 to 4 in 10, but "crypt corridor / burial corridor / crypt hallway" in half the reads of an 8x2: walls that read as decoration make it a corridor, walls that read as shelves make it a room |
| two iron gates | "dungeon cell block", "prison passage": the way on is the oak door |
| few bodies, few bones | 1 in 8 (it needs the dead in number) |
| no coffins (wrapped bodies and more bones) | the same 9/12 at 10x3 ("ossuary or catacomb storeroom"), one seed "barracks" 3 of 3 |
| skull pillars down the spine of a wide corridor; a pillar between bays of the wall | no better |

What the judge calls the niche panels, whichever version, from table distance: "shelves of books or scrolls" (a tomb-LIBRARY, an
archive), "barred cells" (a prison block), "shelves of sacks" (a storeroom), and about half the time "burial niches". It says
"catacomb" when it has taken them for body storage. That is the mesh, not the program: see docs/ASSETS_TO_BUILD.md (Crypt).

### Measured, not acted on

"Floating coffin", "skull heaps clip into the walls", "sarcophagus clips the wall": `tuner.overlapReport(0.35)` and
`tuner.outsideReport(0.6)` are empty for all 24 final rooms (0 overlaps, nothing outside, 0 page or HTTP errors, 0 unplaced). The
coffin on the bier rests at y = 1.86 ft and the narrower wrapped body at 1.43 ft on a bier 1.95 ft tall overall (the tuner settles a
thing onto the mesh under it: the body lies between the bier's rails). The great heap is 5.0 x 4.9 x 3.35 ft.

## First integration: final reads (live)

| room | seed 11 | seed 12 | verdict |
|---|---|---|---|
| Antechamber 4x3 | "A tomb antechamber, small shrine, or ceremonial guardroom" | "A small shrine, antechamber, or minor tomb entrance" | named |
| Burial vault 5x4 | "guarded tomb or a crypt used as living quarters" (niche panels with wrapped bodies read as bunk beds) | "A crypt or burial chamber" | named |
| Ossuary 4x4 | "A crypt, tomb, or burial chamber" | "A tomb chamber or crypt" | crypt, NOT named an ossuary (see below) |
| Catacomb corridor 6x2 | "A crypt, tomb, or burial chamber" | "A crypt or burial chamber" | crypt, not named a catacomb |
| Chapel of rest 4x7 | "A small chapel, shrine, or prayer hall" | "audience chamber, small throne room, or judgment hall" (altar read as a desk; earlier rounds: "A chapel, funeral hall, or small throne room") | 1 of 2 named |
| Embalming room 4x4 | "A mummy preparation room or an embalming chamber." | "An embalming room, mortuary, or crypt preparation chamber." | named |
| Relic chamber 3x3 | "A small treasure room or vault" | "A dungeon treasure room or vault" | named |

In the GAME (https://turnipworks.net/, a new campaign `zz-crypt-check-fauna`, room labels hidden, a 5x4 vault):
"a tomb, crypt, or burial chamber ... multiple sarcophagi, a coffin, and burial niches in the walls".
(A first game picture showed the room's own label "Chapel of rest"; that read was not blind and is not counted.)

## What the rounds changed (the program, never the test)

| round | read | what it was | change |
|---|---|---|---|
| 1 | ossuary: "crypt throne room", "crypt, tomb, or dungeon treasure room" | candle-stub mounds beside the shrine read as heaps of gold; the bone rack as a bookcase | shrine flanked by skull heaps and tall candles; heaps at both pillars; skull stacks on the side walls; bone racks only from 25 cells |
| 1 | catacomb: "dungeon workshop and storeroom" | lidless stone coffin = workbench; candle stubs = gold or a forge; loose-bone decals = trestles | lidless coffin and candle stubs out of the corridor |
| 2 | catacomb: "crypt storeroom" twice | 2-ft skull heaps read as piles of gold | heaps ship larger (skull 3.7 ft, bones 4 ft: `manifest_overrides.json`) |
| 3 | catacomb: "storeroom, cellar or pantry", "crypt larder" | with no coffin, and heaps along the walls (read as hay, gourds), nothing said burial; bone-strewn floor did not help | coffin back; a wrapped mummy by each long wall; twice the loose bones (they read as whole skeletons); heaps only in a corner; floor order back to the designer's |
| 4 | ossuary: "undead throne room", "small tomb or burial chamber", "A crypt, ossuary, or sacrificial chamber"; catacomb: "crypt", "A crypt, tomb, or burial chamber", "A crypt storeroom or an undead barracks" | | kept |

## What the programs cannot fix (asset notes, also in docs/ASSETS_TO_BUILD.md)

- `ossuary-shrine` reads as a throne or altar from above ("bone throne", "high-backed stone throne"), and its five painted
  candles as "golden skulls" or coins. The ossuary is therefore named a crypt or tomb, once an "undead throne room".
- `ossuary-wall` panels do not read as skull walls at table distance ("decorative stone block with a gargoyle face", "greenish panels").
- `wall-crypt-niches--crypt-stone--s2` (wrapped bodies) reads as "shelves of sacks or bundles", once as bunk beds: the reason a
  catacomb alone reads as a crypt STOREROOM in some rounds.
- `catacomb-shelf-bones--s1` reads as a bookcase of scrolls; `candle-drippings-mound` as gold; `skull-pile--s1` as gold at 2 ft,
  as skulls at 3.7 ft in an ossuary, as gourds elsewhere; `sarcophagus--s3` as a big banded chest; `urn-decorative--s2` as a barrel;
  `stone-coffin-lidless` as a workbench.

## "Looks wrong" lines, and what measurement said

| said (several rooms) | measured | action |
|---|---|---|
| "upright coffin leaning on / clipping into the wall", "standing mummy" | the coffin lies on the floor: placement 2.6 x 1.5 x 6.4 ft (w x h x d), y = 0; the mesh is 0.23 tall of 1.0 long, nothing can stand it up | none |
| pieces "floating" (urn "barrel", canopic "crates", pillar candles, gold) | all 73 runtime meshes: lowest point at y = 0.00, centred within 0.02 | none (weak contact shadows) |
| benches, braziers, chests, heaps "clipping into the wall" | `tuner.outsideReport(0.3)`: nothing outside a room in any of the 14; wall pieces stand 0.05 ft off the wall face | none |
| niche panels | rendered box 5 x 9 x 1.5 ft centred 0.25 ft outside the wall line: room face flush at the 12-in wall's face, the extra depth outward (`tuner.wallReport()`) | none |
| "the four candles round the bier are quite large" | 4 ft, as specified (48 in) | none |
| loose bones "out of scale" | flat decals, 3 to 4 ft across | left; a note for the flats |
| chapel: urn under a wall torch "clips" it | the urn is 2.9 ft tall, the torch hangs centred at 6 ft: 1.9 ft apart | none |

## After the castle landed (2026-10-06): the bone candelabrum, and what the castle's meshes would have changed

`rite-bone-candelabra` (accepted after the crypt shipped) now stands on the chapel's altar (one toward each end) and on the
ossuary's first bone trough. The castle's `pew` and `lectern` meshes joined the library the same night; the chapel of rest
keeps its stone benches and takes no lectern (its reads were made with benches, and the altar had already been taken for
a desk). Same judge, same prompt, default size, seeds 11 to 14, a local tuner serving the shipped code
(`reads-after-castle.json`):

| room | reads | verdict |
|---|---|---|
| Chapel of rest 4x7 | "small chapel or funerary chamber" · "tomb-chapel or a crypt" · "small chapel, crypt, or funeral hall" · "chapel or funerary chamber" | 4 of 4, as before |
| Ossuary 4x4 | "crypt, ossuary, or catacomb burial chamber" · "crypt, ossuary, or catacomb chamber" · "crypt, ossuary, or burial chamber" · "crypt, ossuary, or burial chamber" | 4 of 4, as before |
