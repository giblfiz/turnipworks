# Whole buildings

How Turnip Works makes a coherent building from a type, a dragged footprint and a seed. Written 2026-10-11 from Harry's
requirements and the design he approved ("I love all of your ideas here, show me what you build").

- Code: `tools/spawn-tuner/js/buildings.js` (the plan: pure, no imports, deterministic), `engine/core/buildplan.js` (a plan
  into commands), `tools/spawn-tuner/js/walls.js` (planned doors), `engine/client/main.js` (`makeBuilding`, the offers).
- Look at many at once: https://implausible.enterprises/projects/turnip-works/tuner/buildings/ (the gallery).
- Tests: `tools/spawn-tuner/test/buildings.test.mjs` (the rules over a seed sweep), `engine/test/buildings.test.mjs` (real
  walls and furniture), `engine/test/browser_buildings.py` (the game), `tools/spawn-tuner/test/buildings_ui.py` (the gallery).

## What existed before

- The Build tray's Type level had a building tool: drag a rectangle, and `engine/client/pack.js` cut it into the type's
  rooms by guillotine cuts (halve the room list by area, cut across the longer side, repeat), at most 12 rooms, in one
  command. No corridor, no stair, one storey; outbuildings, cellars and hallways were left out on purpose. Which rooms
  got doors was whatever the wall engine's role rules made of the accident of who touched whom.
- Off the ground the same tool packed the buildable part of the drag and added one stair by the per-room stair rule.
  That path is unchanged (it is still what you get when you drag a type on an upper level).
- The 200-room test map (`experiments/2026-10-06-megamap/`) is a script that tiles rooms through the GET API to measure
  frame time. It is not a building generator.
- The selection hierarchy already had a building entity (a label, a base height, a storey height, a roof style).

## Harry's requirements (2026-10-11)

- "The same way we have some complicated drawing rules for rooms, we are going to need some complicated drawing rules
  for buildings. This is also going to spill over into stair placement a lot."
- Two patterns: simulation / realistic against gamist. An inn should be "coherent from a 'this is how people use things'
  kind of way"; a crypt is "a D&D dungeon … winding hallways connecting big rooms. Rooms that connect to other rooms,
  lots of binary direction choices."
- "If someone drags out an 'inn', it should default to 2 stories, but it should come with a contextual popup like we do
  that asks (want this to be 1 story? 3?)."
- "In realistic layouts there are not stairs scattered everywhere. Stairs usually belong to either hallways or common
  rooms, and often there is only one or two stairways for the whole building."
- "More buildings probably need to have hallway options (mansion, etc). Hallways are a staple of both sane layout AND
  dungeon layout."

## The three dials

"Realistic against gamist" is three independent choices. Every type has a default on each (the table below); the
gallery lets you move them.

1. **Circulation** (`loops`, 0 to 1). A TREE: a hall or the hub room is a spine and rooms are leaves, which is how real
   buildings work. Or LOOPS: several routes and real choices, which is what makes a dungeon playable (tabletop people
   call it Jaquaysing a map).
2. **What decides which rooms touch** (`pacing`, 0 to 1). FUNCTION: the kitchen opens off the common room, the storeroom
   off the kitchen, the privy is reached without crossing a bedroom. Or PACING: an entrance, a choice, set pieces kept
   apart, a reward at depth.
3. **Envelope** (`carved`, 0 or 1). PACKED: rooms share walls and fill the rectangle with no wasted space. Or CARVED:
   rooms stand apart in solid rock with corridors between them.

Three dials and not one, because of the middle cases: a mansion is packed and functional but wants a loop or two; a
castle is packed but should play like a game.

## The per-type table

`BUILDING_TYPES` in `buildings.js`. **A new type is one entry.** With no entry, a type still builds: `programmeFor()`
derives a programme from its rooms' roles (the hub is its hub-role room or its largest; the hall is its passage; the
rest are leaves; a room that `uses` another opens off it).

| Type | Circulation | Touching | Envelope | Storeys | Why that many |
|---|---|---|---|---|---|
| Inn (TAV) | tree (0) | function | packed | **2** (1 to 3) | drink and food below, beds above: the inn everyone pictures |
| Mansion (NOB) | tree with a loop or two (0.2) | function | packed | **2** (1 to 3) | reception rooms below, the family above |
| Castle (CAS) | loops (0.45) | mostly function (0.3) | packed | **2** (1 to 3) | a keep is tall: hall, kitchen and garrison below, throne and chapel above, the dungeon under it |
| Crypt (CRY) | loops (0.3) | pacing, NOT modelled (0) | carved | **1** (1 to 3, going DOWN) | one level of dungeon; more levels are deeper |
| Wizard's tower (ARC) | tree | function, some pacing | packed | 3 | a tower is its storeys (the dog-leg core stops at three: see Open) |
| Cult sanctum (CLT) | loops (0.3) | pacing (0.6) | carved | 1, going down | a hidden place |
| Temple (TEM) | tree, a loop (0.15) | function | packed | 1 | one great room and its side rooms; the nave is tall, not stacked |
| Dungeon (DUN) | loops (0.35) | pacing (0.6) | carved | 2, going down | a dungeon is levels |
| Mine (MIN) | loops (0.4) | pacing (0.5) | carved | **2**, going DOWN | a mine is levels down a shaft; the shaft head is the hub, the tunnel the corridor, the crystal seam the reward at the deepest dead end (rooms' depth hints: `walls.js` `MIN_DEPTH`); the pithead yard and the smelter house are the surface, drawn beside the way down |
| Market & village (MKT) | a loop or two (0.25) | function | packed | 1 | stalls and small houses (a settlement of many buildings is the level above this) |

The last five have dials and storeys only: their rooms land on other branches. Each needs a `rooms` programme written
once its rooms exist; until then it builds from the derived one.

Per room, a programme entry says: its length range along a hall or hub wall; which floor (ground, upper, cellar under
which room); its zone (behind the hub, beside it at the street, along a corridor); `touch` (must open off the hub, or
off another room); `near` (should share a wall with a room, and gets a door to it when it does); `need`; `from` (only
from this footprint size); `fill` (repeats); `cap` (wants the end of the corridor); `priv` (private: never a
thoroughfare, never an extra door); `one` (exactly one door); `ends` (entered at a short wall); `yard` (gets a door
onto the yard when it has an outside wall there).

`MIN_FIT` is the smallest each room type can be and still get its key piece. It was measured (every type furnished at
every size from 1 x 1 to 6 x 6): kitchens 15 x 15 ft, a barracks 15 x 20, a front desk and a chapel 10 x 15, the rest
10 x 10.

## The packed solver

- **The hub goes at the street**, sized to a share of the footprint, with the street door in its front wall.
- **The stair core goes in next**, before any other room: four squares in a line along the hub's back wall (landing,
  two squares of flight, foot). A third storey doubles it into a dog-leg: a second lane beside the first for the flight
  that comes back. One core per building. Every upper floor is then a corridor laid over the core's squares.
- **The rest of the ground floor is strips**, each cut into rooms that all touch their circulation:
  - a strip behind the hub (service: kitchen, storeroom, privy), every room on the hub's back wall;
  - one room beside the hub at the street (the front desk; a mansion's dining and drawing rooms);
  - when the rectangle is wider than a hub, a **wing**: a corridor from the hub's side wall with a strip either side;
  - on a deep plot, a corridor running back from the hub; in a very deep strip, cross corridors with rooms off them.
- **Rooms wait in one pool** and each strip takes what fits, most important first, so a room one strip had no space
  for is still there for the next. A room that opens off another stands beside it. The room that lands behind the
  stair is one that needs no door to the hub.
- **Upper floors**: a corridor over the core (two squares wide; three on a middle floor of a dog-leg, so there is a
  lane to walk past both flights), rooms both sides, a "cap" room across the far end (the fine room; the throne room
  at the end of the passage). **The hallway is what is left** when the rooms are placed, and a strip one square deep
  is given to it.
- **Doors** are stated by the plan: every room to its circulation, or to the room it belongs to; mid-wall; never onto
  a flight, its foot or its hole. Then `loops` adds doors between rooms that share a wall, never into a private room.
- **The cellar** hangs under the kitchen (the castle's dungeon under the great hall) by its own short stair.
- **Outside the envelope**: the inn's yard and stable at the back, the mansion's garden at the back, the castle's
  courtyard and gatehouse at the front. They are left out where something already stands.

## The carved solver

- The footprint is rock. The entrance room stands at the street. Set-piece rooms are scattered: each is the best of
  sixty tries, as far from the others as it can get, never closer than two squares.
- A spanning tree by distance joins every room (so every room is reached). Then links that were left out are put back:
  `loops` x the number of rooms of them, only where the link really shortens a way round (the two rooms are three or
  more rooms apart without it). The entrance always gets a second way on.
- Each link is a corridor routed through the rock: cheapest path over a field of random cost, so it bends; two squares
  wide (one in a small footprint); it may END ON ANOTHER CORRIDOR, which is a choice in the passage itself. A corridor
  is an ordinary room with a stored outline (an L, a Z), cut in two when it is longer than a room may be.
- More levels go down: a small stair room is placed first and joined like any other room; the level below starts with a
  landing room where the stair arrives, and is laid out round it.
- **Pacing is not modelled** (Harry has not answered whether it should be). Every room carries its depth from the
  entrance (`plan.depth` on the room's recipe), so a later pass can place set pieces and rewards by depth. With
  `pacing` at 0.5 or more one thing is done: the reward room (the relic chamber) is moved to the deepest dead end.
  A strong room always has exactly one door.

## In the game

- **Build tray, a type, drag a footprint**: the building arrives as ONE command (one undo), every room furnished, with
  its stairs. While you drag, the readout counts the rooms of the building you will get (the seed is picked when the
  drag starts).
- **The offers.** Beside a building just made, conditional buttons: one per other storey count ("1 storey",
  "3 storeys"; for a crypt "2 levels", "3 levels") and "Re-roll". Pressing one makes the building again as one
  undoable step. A storey offer that times out goes down into the chat as a line with its button. The same are
  commands on a selected building (the bar; its ☰: Storeys, Re-roll building).
- **From words**: `build inn 12x8`, `build crypt 20x14 seed 8`, `build castle 16x12 3 storeys` in the command bar builds
  on free ground near the middle of the view.
- **From the gallery**: "Open in 3D" is a link (`?build=TAV&w=12&d=8&seed=7&storeys=2&loops=0.3`) that builds that
  building once and cleans the address.
- **What is stored.** The building keeps `gen` (type, footprint, seed, storeys, street side, dials, and an optional
  `flavor` that is passed down to every room's `plan.flavor`: a legacy plan hook; the Faction picker now stores building `flavor` and lets rooms override it). Each room keeps `plan`: the building it was planned with, the rooms it has doors to and where (relative to
  its own corner, so the building can be dragged), its street door, its depth, its role.
- **The wall engine** gives two rooms of one plan a door exactly when the plan says so, and where. A room without a
  plan, and a planned room beside a room that is not of its plan, follow the old role rules: draw a room against a
  generated inn and it gets its door as before.
- **Stairs** are ordinary stair objects of the lower room, placed before the furniture so nothing stands on a flight,
  its foot, its hole or its landing. The branch `stairs` had not landed when this was written: the generator states a
  stair as (foot square, flight squares, landing square, lower room, upper room), which is all a "place a stair core
  through several storeys" function needs.

## The rules, as checks

`check(plan)` in `buildings.js`, run on every plan (the gallery shows them on each card):

every room reachable · every door on a wall both rooms share · no two rooms overlap · packed: no dead space · no room
below its minimum size · no bedroom is a thoroughfare · a strong room has one door · every room reached without
crossing a private room (the privy above all) · the entrance on the street side · a stair reaches every storey · the
core aligned through the storeys · one or two stairways · every stair on floor at both ends · the core arrives in
circulation space · no door onto a stair · required adjacencies present · the rooms the type needs are all there ·
carved: a loop, a choice within two rooms of the door, at least two big rooms.

The engine-level test adds what only the real engine can say: the relay accepts every command; every planned door is a
door, on the segment named; the wall engine forced no door in; every room keeps its key piece; no furniture on a stair.

Results are in docs/STATUS.md (they change as the table is tuned).

## Limits, said plainly

- **Below about 40 x 30 ft** an inn has no room for a kitchen strip and a stair; below 55 x 50 a mansion or castle is
  short of its programme; below 60 x 50 a crypt is two rooms and a passage. The plan says so in its notes and the
  "rooms the type needs" rule is not counted there.
- **Three storeys is the most** a packed building gets: the dog-leg core has two lanes. A spiral core (the library has
  the pieces) is the way to a five-storey tower.
- **The street is the south side** of the drag unless told (`front`). Nothing in the game sets it yet.
- **Re-roll replaces everything**, pinned furniture and hand edits included (it is one undo away).
- **Very large single-storey footprints** (100 ft and more each way) keep every rule but read as a barracks: rows of
  rooms off cross corridors.
- **A building dragged after it was made** keeps its doors (they are stored relative to each room); a single room
  turned by hand falls back to a door in the middle of the shared wall.
- **Off the ground** the old packer is still what the building tool uses.

## Open, for Harry

- **Pacing.** Should the carved solver place rooms by depth (entrance, choice, set pieces apart, reward at the end), or
  is "loops, big rooms and winding corridors; the GM supplies the pacing" right? Today: not modelled, depth marked.
- **Should a crypt be dug below ground by default?** Today it is built on the level you are on.
- **Which side is the street?** The side the drag ended on, the side nearest the camera, or a button after?
- **Where the offers stand** (beside the building's corner) and how long (14 s).
