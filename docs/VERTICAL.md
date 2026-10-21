# The third dimension

How Turnip Works handles height: upper floors, roofs, hills, caves and things in the air.

- Written 2026-10-05 from the Harry–Fauna conversation of that day. Sections: **Goals**, **Decided**, **Leaning**, **Evidence**, **Open**, **Costs to pay when we build**.
- **Built so far (2026-10-05): the data and plumbing (Stage A).** Rooms can sit at any height on the 5-ft lattice, are drawn there, and travel through commands, the relay and the AI seats' interface. See **Built** below. The cut, build mode, stairs, roofs and the depth look are later stages. (The depth look was built on 2026-10-05 and dropped on 2026-10-11: see "Showing what is below the cut".)
- Each item is marked by its section: **Decided** is settled, **Leaning** is where we expect to land but have not committed, **Open** is unanswered.
- All heights are in feet. "Storey" means one floor of a building, floor to floor.

## Goals (Harry)

The places the game has to be able to show:

- Second storeys.
- Rooftop chases.
- A temple built up a mountain, with grade (sloping ground).
- Dungeons and caves below ground.
- Canyons.
- A first-person view is planned later. Decisions here should not block it.

## Decided

Decisions made 2026-10-05 by Harry and Fauna.

### Height in the data

- **Height is a real number, in feet, on everything**: rooms, objects, pawns. It is stored even while it is always zero.
- **A pawn has no separately stored "floor".** Which floor it is on is worked out from its height. Foundry (the most-used virtual tabletop) stores both, and its worst bugs come from the two disagreeing.
- **No voxels** (a 3D grid of filled or empty blocks, as in Minecraft). **No sculpted terrain.**

### Storeys

- **A strong convention of levels: 10 ft per storey by default.** Our walls are 9 ft plus a 1 ft floor slab, which is two 5-ft cubes.
- **10 ft is a default, not a rule.** Storey height is settable per building.
- **Tall rooms are expected to be common**: a great hall, a temple nave, ceilings of 20–30 ft. A tall room is ONE room that spans several storeys. A room beside it, higher up, is a balcony.
- **5-ft half-steps are allowed**: a dais, a stage, a pit.
- **The world has a 5-ft height lattice** (a fixed set of heights, 5 ft apart) for ground you build on.
- **Storeys belong to a building, not to the map.** A building has a base height, where it meets the ground, and its storeys count up from there. Map-wide levels fail on slopes.
- **A second floor is never a separate area.** Areas are for places far apart.

### What you see: the cut height

- **The view is a CUT HEIGHT.** You see everything at or below it and nothing above it.
- **You can only click what you can see.** Hidden floors never catch clicks.
  - **And a floor you can see stops the click (2026-10-06).** Harry: "on floor two I can still select things on floor one directly thru the actual floor." The pointer selects what you can see at that spot: a drawn floor, slab, roof or the closed ground hides what is under it from every pointer path, the selection box included. What shows beside a floor or through a stair's hole is still reached. docs/UI.md, "A floor stops the pointer"; `floorStop` in `engine/client/world.js`; test `engine/test/browser_cut.py` (FLOORS).
- Harry is excited that "just let people control cut height manually" is the big winner in the research.

**How the cut is set (Harry, 2026-10-05, after watching a TaleSpire movement tutorial; notes in `research/talespire-movement-video-2026-10-05.md`).** This replaces the earlier "manual only". None of it is built: the game has no storeys yet.

- **Double-click sets the cut.**
  - Double-click a spot in a room, or a room's label: the cut goes to that room's ceiling, so you see into that room.
  - Double-click open ground: the cut lifts off entirely and everything shows.
  - It stays there until the next double-click.
- *(2026-10-06: the pin is gone and there is one level; see "One level, the meter, and a double-click that centres" under Built.)*
- **Floor up / floor down PIN the cut.** This is the standing manual mode: the cut steps by the storeys of the building in focus and stays put. A "pinned" indicator shows while it is pinned.
- **A double-click OVERRIDES the pin.** Decided 2026-10-05 and built that way.
- **The pawn never moves the cut by itself.** The earlier idea of following the pawn when it changes floors is dropped. Instead the pawn OFFERS the change: when a pawn changes height or floor, a conditional button appears, e.g. **"Cut to lv 2"**. Harry: "the pawn changing height should bring up a conditional 'cut to lv 2' button... that's the right answer!"
  - Only YOUR pawn brings it up.
  - The GM gets it only for the last pawn moved.
  - Only ONE cut button ever shows at a time. (This limit is for cut buttons, not for conditional buttons in general.)
  - It fades after a few seconds. If you miss it, you set the cut by hand (floor up / down) or double-click.
- **Zooming all the way out does not change the view by itself.** It brings up a conditional **"Roofs on"** button. *(Withdrawn 2026-10-06: no button; roofs are the top of the level meter.)*
- Conditional buttons are a named pattern in docs/UI.md ("Conditional buttons"): they appear only while relevant, each in its one place, and never take the keyboard focus.

### Caves, dungeons and imported models

- **A cave is an underground room type**: a room at negative height with a cave wall style. The ground gets a hole at the mouth.
- **Dungeons are the same**: rooms at negative height.
- **An imported model is just an object.** No walk-inside. (Same decision as in docs/IMPORTS.md.)

### Getting up and down

- **Stairs, ladders, trapdoors, pits, wells and chimneys are vertical connectors**: the up-and-down version of a door.
- They are real things that the building generator places.
- They line up on both floors.

### Ceilings

- **Not needed for the top-down view.**
- When first-person arrives, the underside of the floor slab gets a ceiling surface.
- Harry: not hard by default.

### Terrain: computed banks (Harry, 2026-10-05)

Moved here from Leaning after Harry tried the demo (https://implausible.enterprises/projects/turnip-works/banks-demo/, `experiments/2026-10-05-banks`).

- **Where two terrace heights meet, the engine lays a bank between them**, covered in the same generated ground texture as the ground.
- **Rock is generated props on top** (outcrops, boulders, scree, cliff chunks). They overlap rather than butt (sit edge to edge).
- **The same edge can be a grass bank or a rock face.**
- **The aim is a readable tabletop look, not realism.** Harry: "I like your banks demo, I'm sold. Particularly with high edge softness, steep angles, and earth on steep parts. The sort of 'call it out' vibe. It looks tabletop not realistic, and that's perfect."
- **House defaults for when banks go into the game** are Harry's chosen settings, saved in `experiments/2026-10-05-banks/harry-settings.json`: angle 45, soft 1.2, round 0.5, rough 0.6, dressing 0.45, earth 0.8, cliff angle 76.

### Lamps

- **A floor slab does NOT stop light.** Only the few lamps in the shadow budget (the small number of lamps allowed to cast real shadows) are blocked by geometry.
- **Rule: a lamp belongs to its room.**
- **Lamps in rooms that are not currently visible are switched off.** "Not visible" means above the cut, or hidden under a floor.
- A tall room is one room, so its chandelier lights its balcony.

## Built

### Stage A: height in the data (2026-10-05)

Code: `engine/core/height.js` (the one rule file), `engine/core/commands.js`, `engine/core/roomgen.js`, `engine/relay/llm.js`. API: docs/NETCODE.md, "Height and storeys".

- **A room has a floor height** (`y`, feet, a multiple of 5; negative below ground) and may span several storeys (`tall`; stored and checked, but walls are still drawn one storey high).
- **A building is what the label system already groups**: the building entity that owns rooms. It now also carries a base height and a storey height (10 ft unless set). A room stacked on another joins the building below it.
- **A storey is derived, never stored**: `floor((y - base) / storey height)`. People see "lv 1" for the ground floor, "lv 2" above it, "lv -1" for the first below. There is no lv 0.
- **A pawn's floor is derived from its height** every time it is asked for. Nothing on a pawn stores a floor.
- **Rooms may share x and z at different heights.** An upper room must stand on rooms below it and may overhang them by at most two squares. Below ground anything goes.
- **Walls are worked out per height.** Rooms at the same height share walls and doors. Off the ground floor a room gets no outside door (you arrive by a stair, Stage D); below ground there are no windows.
- **An upper room stands on a one-foot floor slab** (a plain timber-coloured box for now).
  - **The slab runs 6 in past the grid line on a room's outer edge (2026-10-14, Wall fit bench).** The wall above stands on the grid line with half its 12 in each side, so the slab used to end 6 in inside the wall's outer face and every upper wall overhung it. Now `slabRects` (`engine/core/height.js`, shared by `world.js` and the bench) pushes each outer side out by `SLAB_RIM` (0.5 ft); a side that meets another cell of the room, or a stair's hole, stays on its line (so holes, railings and what the pointer sees through them are unchanged; the pointer rule still goes by the 5-ft cells, the extra 6 in lies under the wall). The 9-ft wall, 1-ft slab and 10-ft storey are unchanged.
- **Saved campaigns are unchanged**: every campaign on disk loads byte-identical before and after (a test compares them), including every campaign named "Dawnhaven".
- **Hidden floors work**: a hidden upper or lower room is not sent to players at all (tested for y = 10 and y = -10: socket frames, a fresh snapshot, the GET API).
- **Decided while building:**
  - A room on a half-step (y = 5 inside a 10-ft storey) gets its own walls and does not share them with its neighbours. Allowed in the data, not polished.
  - Changing a building's storey height does not move its rooms. It changes which storey each height counts as.
  - Deleting a lower room leaves the room above it standing in the air. The GM's to tidy.
- **Not yet:** the ground still covers below-ground rooms and labels do not yet know about height (Stage C, the cut); no control to draw a room at a height (Stage B); tall rooms' taller walls.

### Stage B: stacking and build mode (2026-10-05)

Developed on branch `storeys`; not live until the lead lands it. How to use it: docs/UI.md, "Building on levels".

- **One level control.** Each client has one number, the level being worked on (a floor height in feet; the ground is 0). **]** steps up and **[** steps down by the storey height of the building in focus; the Build tray shows it ("Level: lv 2 (10 ft) · new") with the same two buttons. It is never sent to other seats.
  - With a room tool live it can step onto a level that does not exist yet: one storey above the building's highest room, and below the ground as far as wanted.
  - Without a tool it only visits levels that exist.
  - With a pawn selected, [ and ] are still that pawn's HP keys.
- **Drawing an upper room.** Pick a room in the Build tray, step up, drag. A ghost grid shows at that height and the valid squares are lit: over the rooms below, plus two squares out. Squares further out get the red mark and are left out of the room. The rule is one function shared with the relay (`supportAt` in `engine/core/height.js`).
  - **2026-10-06 (Harry: "it is showing THRU things that are on the second floor. It DOES need to show over things on the first floor, but it also needs to not ghost thru things on the second floor").** The ghost grid and the lit squares are drawn over everything below their level and are hidden by what stands on that level or above it. Above the ground that is the ordinary depth test, with the ghost 0.3 ft under the floor line (above the wall tops of the storey below, under this level's own floors). Below the ground the ghost must also show through the ground, so while one is up there the rooms and things (not the ground) are drawn once more, depth only, at half size, and the ghost is tested against that (`ghostMaterial`, `ghostPrepass` in `engine/client/world.js`).
- **Supports are worked out, never stored.** One square out: a bracket under the overhang against the wall below, one per 5 ft. Two squares out: posts from the ground (or the roof below) to the slab at the outer corners and every 10 ft; a stone building uses the buttress piece. A bracket or post selects its room.
  - **Changed 2026-10-06** (Harry: "I don't seem to be able to select them as first-class objects. This is double trouble because also this particular pillar type is not visually quite right"). Still worked out, never stored, but each has a key now (`jh:x:z@y` / `jv:x:z@y` a bracket, `p<x>:<z>@y` a post) and is generated the way a wall piece is: a click selects the piece, Delete is an `edge.set … as: open` on its key, and the first edit puts an ordinary object in its place (`fromEdge`). The plan is one function, `supportPlan` in `engine/core/height.js`. An edit belongs to the upper room: it moves, turns, hides and is deleted with it.
  - **Look.** Stone or timber is one test (`isStoneFamily`: stone, castle, crypt). Timber: `jetty-bracket`, `post-timber--plain`. Stone: `corbel-stone` (at 1.6 times its 18 in, own proportions) and `pillar-square--s1` as a free-standing pier; the buttress piece is drawn to lean on a wall and is no longer used free-standing. A post or pier is scaled by one factor to the gap, never squeezed (about 2.1 ft and 3.4 ft across under a 9-ft gap), and stands in from the corner so its outer faces line up with the wall above. Gemini, blind, on the five stone candidates ranked the square pier at its own size first ("a natural and sturdy extension of the main walls") and the slimmed ones last ("too spindly").
- **Below ground.** Step down with a room tool and draw: the room is made at -10 ft. The ground opens over below-ground rooms while the level being worked on is below 0. The cut (Stage C) will take this over.
- **One answer to "what is under the pointer"**: `world.floorPoint` gives the highest room floor under the pointer, or the plane of the level being built on. Tools, drags and picks all use it.
  - A thing or pawn dragged onto a floor at another height lands on that floor at its height; a thing becomes that room's.
  - Raise / lower counts from the floor of the storey the thing is over: lowered onto the upper floor it stands there, not on the ground.
- **Not done in this stage:**
  - a tall room's walls are still one storey high;
  - the building tool (a whole inn in one drag) works on the ground only, and says so on other levels;
  - other seats' cursors are drawn on the ground;
  - a room on a 5-ft half-step still gets its own walls.

### Stage C: the cut (2026-10-05)

Developed on branch `storeys`; not live until the lead lands it. How to use it: docs/UI.md, "The cut".

- **The cut is view state.** One per seat and area: a height, and whether it is pinned. It is never sent and never on the relay. It is remembered in the browser, so a reload does not change the view.
- **The number is a ceiling.** A cut is set to the underside of the slab above a room (floor height + storey height - 1 ft). With that, Harry's rule is literal: shown if the base is at or below the cut. The room above starts 1 ft higher, so it is hidden.
- **A room's things follow the room**, not their own height. That is how a tall thing or (later) a stair stays whole. Supports follow the room they hold up: a bracket or post under a hidden jetty is hidden with it, so nothing stands holding up air.
- **Only four things write the cut**: a double-click, a floor step, the "Cut to lv N" offer, and "Roofs on" / "show all levels". Every write is logged with who asked; the test drives everything else it can and checks no write happened.
- **Floor up / down and the build level are one stepper.** Stepping pins the cut to that level. A double-click into a room makes that room's floor the level a room tool would draw on. Picking or putting away a tool never moves the cut.
- **Reasoning for choices made without Harry:**
  - *The indicator is at the bottom centre.* The top row is full (launchers, bar, roster) and the Build tray runs down the left. The PiP is now kept off the bottom strip, as it already was kept off the command bar.
  - *Rooms wholly under a visible floor carry no label.* Gemini read stacked labels as rooms of the floor on top, twice. The cost: a covered room's label is no longer a way down; floor down is.
  - *A building's label still renames on a double-click.* A building has no single ceiling to cut to.
  - *Roofs are a per-seat switch, off by default.* Today's open-topped look and every saved campaign look the same until someone presses "Roofs on".
  - *Lamps under a floor are off even with every level showing.* That is the rule as written; the ground floor of a two-storey inn is dark until you cut to it.
  - *The ground stays drawn when the cut is below it*, opened only over the rooms showing. By the rule it would vanish; it is kept as the earth around a dungeon.
- **Not done:** a pawn above the cut has no marker (a flyer over the level you are looking at simply is not drawn). Other seats' cursors are on the ground.

### One level, the meter, and a double-click that centres (2026-10-06)

Harry's notes after trying storeys. Use: docs/UI.md, "One level, and the level meter". Code: `engine/client/surfaces/cut.js`, `main.js`.

- **One level, not two.** Harry: "The build menu is not the place for build level selection... we should just build on whatever level the level is set to." Each seat is always on a level (the ground until it chooses). `]` and `[` move it; the view is cut to it; a room or building tool draws on it. The level may be one nothing is built on.
- **"All levels" is a separate view switch** that does not change the level you are on. A new seat is on the ground with all levels showing.
- **Kept from "How the cut is set" above:** a double-click into a room or on its label goes to that room's level; a double-click on open ground shows all levels; the pawn only OFFERS "Cut to lv N"; zooming all the way out only offers "Roofs on"; nothing else moves the view.
- **Changed:**
  - **The pin is gone.** "Floor up / floor down PIN the cut" and "a double-click OVERRIDES the pin" described one behaviour (the last choice stays), so there is nothing for a pin to mark.
  - **One step above the top storey is an empty level** to build on, not "all levels". "All levels" is `\` or the meter's cap.
  - **`]` `[` need no tool** to reach a level that has nothing on it.
- **The indicator is a level meter on the left edge** (Harry: "a vertical meter on the left... tiny, and the entire height of the screen, with little notches for level pre-set. Assume like 5 stories up and 6 stories down"). The research lesson stands: which level you are on is always on screen (the numbered marker), and a cut is loud (the lit strip and the marker in the accent colour).
- **A double-click also centres** (Harry: "let's have it also center on the double click as well as cutting above"): the point glides to the middle of the view; heading, pitch and zoom are kept; any camera input stops it.
- **Roofs have a place on the meter** (Harry: "Roofs on doesn't get a chat line, it doesn't even get a conditional"): the very top, above the highest level. "Zooming all the way out brings up a conditional Roofs on button" (Decided, above) is withdrawn; zooming offers nothing.
- **The cut is still the number in the data** (`app.cut.y`, a ceiling height; null = all levels); the level is `app.level` (a floor height). A double-click into a tall room cuts at the tall room's own ceiling while the level is its floor, which is why the two are kept apart.

### Stage D: stairs (2026-10-05)

Harry: "Stairs: best shot, explore together afterwards." Rules in `engine/core/stairs.js`; use in docs/UI.md "Stairs".

- **A stair is an object of the LOWER room** (`place: 'stair'`, `rise` in feet). Its bottom is on the lower floor, its top tread level with the floor above. It stands on whole 5-ft squares and turns by quarter turns.
- **It joins two rooms the way a door joins two side by side.**
  - Its squares are reserved on both floors: the room below keeps furniture off the stair and the square at its foot; the room above keeps furniture off the hole and the square at its top.
  - How: the layout engine is given the stair as a fixed thing to lay furniture around, the same way it is given pinned furniture. Nothing in the layout engine changed.
  - The hole in the floor above is worked out from the stair, never stored: no floor tiles and no slab on its squares. A stair that comes up onto open ground cuts the ground.
- **Placed automatically** when a room is made off its building's ground floor and no stair reaches it: an upper room gets one up from the room it stands on; a room below ground gets one up into the room above it, or up onto open ground.
  - It is its own command, sent right after the room. The first undo removes just the stair; the second removes the room.
  - It goes against a wall where it can, never in a doorway, and **never where furniture stands: it removes nothing.** A sliver of a chair or table over the line (2.5 sq ft of a 25 sq ft square) does not count.
  - A straight flight takes two squares. Where no flight fits, a ladder (one square). Where not even that fits, none is placed and a message says so.
  - Measured on 30 furnished inns: a connection was found in 29; 22 were flights, 7 ladders.
- **Pawns** (the simplest thing that works): a pawn dropped on a stair goes to its other end, in one move. From below it arrives on the square beyond the stair's top, at the upper floor's height. Dropped on the hole from above, it arrives at the stair's foot. Then the "Cut to lv N" offer appears by its own rules; the view never moves by itself.
- **Hidden rooms.** A stair is hidden from players when EITHER room it joins is hidden. Players then get no stair and a whole floor: a stair must not give away a secret attic or cellar.
- **Pieces.** The library's `stair-straight` flights made for a 10-ft storey (`--t10`, timber and stone; since 2026-10-06) and the upright `ladder-wood`. The meshes do not agree on which end is up, so the game measures the climb from the mesh and turns it. No stand-in is in use; a plain stepped stand-in exists for a kind with no mesh.

Decided on Harry's behalf, for him to change:

- The stair never removes or moves furniture. In a crowded room that often means a ladder, or the stair lands in an odd corner.
- A ladder is the fallback, not a choice offered.
- A pawn crosses by being dropped on the stair; there is no walking animation and no path.
- No railing round the hole (the library's `railing-wood` is not used yet). **Changed 2026-10-06** (Harry: "You made a choice around stair hole banisters. I think we do need them, but just as a normal kind of furniture that gets placed by default"): see "The railing round the hole" below.
- A new stair goes straight up one storey; no dog-leg, spiral or half flight is placed automatically.

Not done: stairs up to a roof deck; a tall room's stair; a marker for a pawn standing above the cut.

**Stairs that are furniture (2026-10-11).** Harry: "The grand entrance double-stairs don't cut through to the higher floor." Rules in `engine/core/stairs.js` (`STAIR_ROLES`, `stairRole`, `stairsOf`).

- **The fault.** Only an object with `place: 'stair'` was a stair, and only the automatic planner makes those. Every other stair in the game is an ordinary thing of its room with a stair's catalog role (`place: 'kit'`, or `'wall'` for a ladder): the mansion hall's grand stair, the flights a cellar's layout rolls, a barn's ladder. None had a hole, a railing or a way up. The library did not offer the stair pieces at all, so none could be put down by hand.
- **Now the role makes the stair.** A thing whose catalog role is `stair-straight`, `stair-exterior-wood`, `stair-wall-hugging`, `stair-grand`, `stair-spiral-wide`, `stair-half` or `ladder-wood` opens the floor it reaches, gets the railing, and carries a pawn, exactly as a planned stair does. Worked out from where it stands, never stored. `stair-landing` is a level block and is not a stair.
  - **Rise** comes from the role (10 ft; a half flight 5 ft), never from the box: the grand stair's balustrade stands 13 ft high. Under a floor it does not reach (a tall hall, or no storey above) it cuts nothing, and a pawn dropped on it stays where it was put.
  - **The hole** is every 5-ft square the piece covers by more than 1 ft each way. A piece need not stand on whole squares: the grand stair is 10 ft wide, centred on the hall's far wall. In a hall an even number of squares wide the hole is 10 x 15 ft; in an odd one it is 15 x 15 ft, with 2.5 ft of open air on each side of the stair.
  - **Which way it climbs.** A piece's front (local +z, the orientation step's rule) is its foot; a flight climbs away from it. A spiral of one full turn and a ladder come out at the top on the side they are entered from. Measured on every piece by the browser suite.
  - **The way out at the top.** Straight on, beyond the high end. Where that is no floor of the room above (the grand stair climbs to the hall's far wall), the squares beside its top row, on both hands. The railing leaves the way out open. A pawn dropped on the stair arrives on the nearer hand.
  - **From below a pawn must be dropped on the piece itself** (its box), not on the open strip beside a stair that is narrower than its squares.
  - **It stays the furniture of its room.** Deleting or hiding the room above leaves it standing (a planned stair goes with the room it came up into, and is hidden with either room).
  - **The room above** is furnished clear of the hole and the way out, and is given no second stair: the piece is its way up.
- **One exception, so that maps made before this keep their floors.** A flight or ladder that a room's layout put there as dressing (it carries the layout's `rule`) stays dressing while that room has a planned stair of its own going up. A cellar's rolled flight and a barn's ladder stood beside a planned stair on every map made so far; without this each would open a second hole under furniture. Delete the planned stair and the rolled piece takes over. The grand stair, and anything put down by hand, always count.
- **By hand.** The stair pieces are in the library search (the grand stair, the spirals, the flights, the half flight, the landing; the piece made for a 10-ft storey first). They go down on whole squares, turn by quarter turns and stay on whole squares when dragged. Before, a dragged grand stair snapped onto a grid line like a wall piece.
- **Not done / known.**
  - The grand stair stands against the hall's far wall, so nothing leads straight on at its top; a pawn steps off beside it, past the stair's own balustrade. Standing it one square off the wall would give a landing along the wall (Harry's call: it changes the hall's look).
  - `stair-straight--rough-timber` (the inn's first timber flight) is drawn with its run across its box: it has no turn in `data/orient.json`. Older than this change; the suite names it.
  - No floor can be built 5 ft up with the tools, so a half flight opens nothing yet. A dog-leg from two half flights and a landing is not joined up.
  - A catalog stair is not hidden with a hidden room above it (a planned one is): the hall's stair is the hall's furniture.
- **Tests.** `node engine/test/grandstair.test.mjs` (501 checks: the hall in two widths and three seeds; every stair piece turned four ways; the dressing exception; fails on the old code). `engine/test/browser_grandstair.py --local` (26 checks: what is drawn, the pointer, pawns, every piece measured, the library tool). Stills: `engine/test/shots/grandstair-before-*.png` and `grandstair-after-*.png`. Gemini, blind, on the pair: before "the dark wood floor of the upper storey is continuous", after "a large rectangular opening in the floor. A staircase is visible within this opening".

**The railing round the hole (2026-10-06).** Rules in `engine/core/stairs.js` (`stairRails`); use in docs/UI.md "Stairs".

- **Worked out from the stair, like the hole itself.** One 5-ft section on every edge of a hole square whose other side is floor of the same room; none on the edge the top tread leads out of; none where the room's wall stands; none for a stair that comes up onto open ground. So it is there by default, follows the stair when it is moved or turned, and comes and goes with it (undo included), with nothing stored. Areas built earlier get it when they are opened.
- **Each section is a thing of its own**, by the wall-piece pattern: key `rh:x:z@y` / `rv:x:z@y` (the grid edge, at the upper floor's height); Delete is an edge override on that key; a drag or a swap puts an ordinary floor object in its place. It belongs to the room whose floor has the hole and is hidden with that room; a player who cannot see the stair has no hole and no railing.
- **Pieces.** Timber and half-timber: `railing-wood--rough-timber` (the inn's; squeezed in depth only: its mesh is 2.4 ft deep). Stone, castle, crypt: `railing-iron`, generated 2026-10-06 for this ($0.30 on fal; `experiments/2026-10-06-railings`). The noble families: `balustrade-stone`. The inn's `railing-wood--dressed-stone` is a corner piece with a crest panel and is not used.
- **Why this way and not stored objects** (a choice made for Harry): stored railings would have to be re-planned by every command that moves a stair, and yesterday's areas would have needed a migration. Generated, they follow by construction and still select, delete, drag and swap as ordinary things.
- **The furniture solver does not know about them.** The hole and its landing were already kept clear; a chair next to the hole can touch the railing by a few inches.
- **Blind reads (Gemini).** Timber: "an open, 'X' patterned wooden railing that effectively complements the building's timber-frame construction ... the small armored figure is still clearly visible through its open design". Iron in a castle-walled room: it matches the stone room, but "its heavy construction makes visibility less clear than the timber version". Measured share of the middle band that is solid: iron 0.43, timber 0.77, a slab 1.0. The marble balustrade in the same room read "squashed and chunky", which is why the iron one was made.

### Stairs are placed objects that go up or down (2026-10-11)

Harry: "start in on the fixes to stairs & ladders as a placeable object with a context menu that lets you switch them to 'stairs down' instead of 'stairs up'"; "let's not default to dropping stairs everywhere … maybe we should generally let players place their own stairs unless it looks like we can line one up from a plausible target to a plausible target below." Rules in `engine/core/stairs.js`; use in docs/UI.md "Stairs: place them, switch them up or down". Tests: `engine/test/stairs.test.mjs`, `engine/test/browser_placed_stairs.py`.

- **One kind of stair.** A stair, spiral or ladder is an ordinary object of the library. Its catalog role makes it a stair (`STAIR_ROLES`, from "Stairs that are furniture" above). Nothing about its hole, its railing or what it joins is stored.
  - **The hole is always the floor at the stair's top**, on the squares it stands on. The railing goes round that hole. Both are worked out from where the stair stands, so moving, turning, deleting, duplicating or undoing a stair moves, closes or restores them. There is no stored hole to be left behind.
  - **What is stored on the stair:** where it stands (`x`, `y`, `z`, `rot`), and two optional fields. `down: true` means it was put in for the level at its top. `rise` is stored only when the storey is not the piece's own height (10 ft; 5 ft for a half flight).
  - **The old kind is gone.** The stairs the planner made from 2026-10-05 were `place: 'stair'` objects. They are converted when a campaign is loaded (`migrateStairs` in `engine/core/migrate.js`; the relay writes a fresh snapshot, as it did for pawns' damage). Same squares, same hole, same two floors, same room. In the frozen corpus: 40 old stairs in 17 of 266 campaigns (35 flights, 5 ladders), all converted, all working where they stand. A journal still replays as it was written; a `place: 'stair'` command sent today is put down as the ordinary kind.
  - **One difference for the 5 old ladders:** a ladder is now left at the top on the side it was climbed from (before: on the far side). The hole is the same square; the open side of its railing moved.
- **Up is the default.** A stair put down on a level stands on that level's floor and opens the floor above.
- **"Stairs down" (the stair's menu) keeps the stair's place in plan and its turn, and moves its body down one flight.** Its top is then level with the floor it was put on, the hole is in that floor, and it stands on the storey below. "Stairs up" is the reverse. One command (`stair.flip`), one undo.
  - So the same physical stair is "up" from the floor at its foot and "down" from the floor at its top. The menu names what you would get from the level you are on. From a level that is neither end it counts from the stair's home level (`down`).
- **No level above, or none below.** The stair still stands there and cuts nothing that exists. A small note over it says so ("No floor above yet", "Nothing below"). A pawn dropped on it stays where it was put. The day a floor is built over it (or a cellar under it) it opens that floor and works, with nothing done to the stair.
- **A stair that cannot work says why**, in the same note, for as long as that is so (`stairStatus`): a wall of its own floor runs through it; blocked at the foot; it comes up through a wall or half outside the room above; it comes up with no floor to step off onto. It is still placed. A stair the room's own layout rolled, with simply nothing built over it, is furniture and carries no note.
- **Placed or furniture.** A stair the room's layout rolled carries the layout's `rule`. It is re-rolled with its room and hidden with its room only. Every other stair was put there (from the library, by the offer below, by the building generator, or converted from the old kind): it stays through a re-roll of its room, and is hidden from players when EITHER room it joins is hidden.
  - A stairs-down is deleted with the room it was put in (its home level); one undo restores both. A stairs-up stays when the room above it is deleted, and says there is no floor above.
  - The rule from "Stairs that are furniture" still holds, restated: a flight a layout rolled as dressing stays dressing while a stair that was PUT there stands in the same room.
- **No stair is placed for a room drawn by hand.** Only when a straight flight lines up is one OFFERED, by a conditional button beside the new room ("Add stairs down"; a cellar: "Add stairs up"). "Lines up" means: the room it would join is a hallway or a common-type room (`STAIR_TARGETS`: hallway, common room, great hall, mansion hall, gatehouse, crypt antechamber, chapel); two free squares in a row there, with free floor at the foot; inside the new room at the top with a square to step onto; no doorway beside it. Never a ladder. Taking the offer puts the stair in and lays the NEW room's furniture again round the hole (same seed), as one command.
  - Measured on 20 furnished common rooms with a room drawn over each: offered in 10. Over 20 kitchens: never.
  - Still automatic, for now: a room an AI seat makes over the GET API (it has no hands; `stair=0` for none), and the whole-building tool off the ground (the building generator is being rebuilt on branch `buildings`).
- **For the building generator: a stair core through several storeys.** `roomgen.stairCore({ at: { gx, gz, q }, levels: [0, 10, 20], kind: 'straight' | 'ladder', side, family })` gives one stair per storey as object arguments, plus the squares of each floor to keep clear. In the game: `app.stairCoreOps(spec)` (the commands, for a larger batch) and `app.placeStairCore(spec)` (sends them as one command). Straight flights make a switchback on two lanes side by side, so no flight stands on the hole of the one below. It checks nothing; `stairStatus` says afterwards whether each flight works.
- **Choices made on Harry's behalf, for him to change:**
  - *The note is small text over the stair, shown to everyone who can see the stair.* A stair that only lacks a floor above gets the note in a plain colour; a real fault in amber.
  - *"Stairs down" with nothing below still cuts the hole in this floor.* The alternative, refusing, would hide the stair's purpose; the note says what is missing.
  - *Taking the offer re-lays the new room.* Without that a flight almost never fits in a room that is already furnished.
  - *The roof hatch is not a stair* (it has no stair role in the library; a ladder under it is).

### Stage F: roofs (2026-10-05)

Harry: "A roof is basically a kind of room! We need those windows that pop out, and chimneys, and ledges. They will be sparse. We also need a few different textures (thatch, tile, shingle, wood shingle)." Spec for the controls: docs/UI.md, "Roofs".

- **A roof is worked out, never stored.** One roof per room that has nothing of its building above it. The shape is computed (`engine/client/roofs.js`): a gable over each rectangle of the room, ridge along the long side, 45 degrees (since 2026-10-11; it was 40), the rise capped at 15 ft so a hall wider than 30 ft does not tower (it was 9 ft), eaves 1 ft past the wall. Roofs of joined rooms run into each other (the roof of a building is the highest of its rooms' roofs at every point), so there is no wall between them where they meet.
- **The uncovered part of a lower storey is a flat deck**, level with the floor of the storey beside it: a place to stand.
- **Only the style is data.** `building.roof` is the building's style; `room.roof` is one room's own `{ style, seed, off }`. Styles: thatch, clay tile, slate shingle, wood shingle, flat. Saved campaigns are unchanged: they carry neither field.
- **With nothing set, the style follows the walls** of the building's oldest ground-floor room: rough timber gets thatch; log cabin and fieldstone get wood shingle; half-timber gets clay tile; dressed stone, noble interior and crypt stone get slate. Anything else gets thatch.
- **The surface is modelled roof sections** (since 2026-10-11: "Roof sections" below). Before that, and still for the far tier, the fallback and the comparison switch, it was a generated texture: the four roofing textures of the vertical kit, read through the library. A flat roof wears an existing rough-boards floor texture as a stand-in (no flat-roof texture has been generated).
- **The trim is placed by rule and is sparse:**
  - a chimney straight above every fireplace or hearth, out of the topmost roof over it, to above the ridge (a vertical connector, as a stair is);
  - a dormer on a big slope, at most one per 20 ft of eave, and then only about one time in three;
  - a ledge round a flat roof: a parapet on each open edge, a pier at each corner;
  - a finial on a free gable peak, one time in five.
  - Re-rolling a roof changes its seed: new dormers and finial. Chimneys stay over their fireplaces.
- **Pieces (2026-10-06: the vertical kit landed).** Real, and fitted by measuring each mesh (`engine/client/kitfit.js`): the four roofing textures; chimneys (`chimney-stack`: the low cottage stack on thatch, brick on tile, stone on shingle and decks, the tall mansion stack on slate; never stretched: a taller stack is chosen for a longer rise and the spare length is sunk into the roof); dormers by roof material, sunk until the front stands on the slope; parapet sections and corner piers round a flat roof; the ridge cap as 5-ft `roof-ridge` sections (thatch has its own, lead for the rest); finials. Under an overhang: `jetty-bracket` on timber walls and `corbel-stone` on stone, the leg against the wall; `post-timber--plain` (timber) and `buttress` (stone) for two squares out (since 2026-10-06 the stone one is the `pillar-square` pier, and both stand at their own proportions: Stage B above). Stairs use the flights made for a 10-ft storey (`--t10`) and the upright ladder. **Stand-ins that remain:** a flat roof still wears the rough-boards floor texture (no flat-roof surface exists); there is no thatch dormer in the library (thatch roofs get the timber one); the stone buttress stands in as a free pier (it is drawn for a wall); where a library lacks a piece the old box or drawn strip is still drawn.
- **Roofs are a per-seat view switch, off by default** (Stage C). On, a roof shows when the cut is off or at or above the top of its room. Cutting into a room hides the roof over it and every roof above that height.
- **A room under a roof that is showing is covered**: no label over it, its lamps out. The building's label stays.
- **Where roofs are not drawn:** over a yard or other outdoor room; over a room below ground; over a room whose roof has been hidden; over a room hidden from players (players never have the room, and the GM gets no roof for it either).
- **Standing on roofs is kept simple.** A pawn or thing dropped on a flat roof or deck stands there, at deck height. Dropped on a pitched slope it goes to the nearest point of the ridge. Sloped standing is not solved. The banks demo showed that a ring painted on the slope reads better than a level disc; that is noted, not built.
- **Choices made on Harry's behalf:**
  - *The GM gets no roof on a hidden room.* The alternative, a roof in the hidden treatment, would cover what the GM is prepping.
  - *Hiding a roof deselects it*, since it is no longer there to hold a ring. The room's own menu then offers "Show roof"; undo also brings it back.
  - *A die on the roof's ring re-rolls only the trim*, never the shape or the style.
  - *A flat roof uses a floor texture for now* rather than a plain colour: Gemini read the plain grey deck as "a section of the roof cut away".
- **Not done:** hip roofs are in the planner but nothing chooses them; a tall room's roof sits at its true top but its walls still draw one storey (Stage B); roofs do not appear in area thumbnails unless the seat that renders them has roofs on.
- **Frame time** (two-storey inn with yard and fog, uncapped, RTX 3060, box load about 6): roofs off 20.8 and 23.1 ms median; roofs on 17.7 and 19.6 ms. Roofs on is cheaper because the lamps of every roofed room go out (312 lit things down to 47).

### Roof sections (2026-10-11)

Harry: "Our programatic roofs look tacky. Let's make some small shingles-sections for each type in the system, and use them at 45 degrees. Given we only have like 4 styles of roof I think that's only like 4 objects."

- **Four styles, four objects.** The pitched styles are thatch, clay tile, slate and wood shingle (`ROOF_STYLES`; `flat` is a deck and gets none). Each has one modelled 5 ft x 5 ft section: real overlapping pieces, thick at the butt, in the house style. How they are made, and their provenance: `experiments/2026-10-11-roof-sections/README.md` (built from the roofing plates we already own; no image or 3D generation; $0).
- **The shape logic is untouched.** `planRoofs` still decides which rooms get a roof and every ridge, hip, valley and cross gable. `sectionLayout` (same file, pure, tested in node) lays copies of the section on each planned slope: a grid in feet along the eave (world-aligned, so the courses of joined rooms line up) and feet up the slope from the eave's edge (so every slope starts with a whole course).
- **Pitch: 45 degrees**, rise capped at 15 ft (a room wider than 30 ft flattens a little). Saved campaigns load unchanged (roofs are never stored); a pawn that was left standing on a ridge before 2026-10-11 keeps its old height until it is moved.
- **Trimming is clip planes per copy.** A slope is a set of convex pieces. A copy wholly inside a piece is drawn whole. A copy that crosses a piece's edge carries up to four planes of its own, each the vertical plane through one edge, and the pixel shader drops what is outside. Vertical, so the two slopes at a hip, a valley or the ridge are cut by the same plane and meet without a notch. A copy that would need five planes is drawn as two (it did not happen once in 300 random buildings). No stencil, no CPU cutting, no extra geometry. Chimneys and dormers are not cut round: they are sunk into the roof as before, and the relief runs into them.
- **Instanced.** One geometry and one texture per style, shared by every roof (the vertex buffers are the kit's; a roof owns only its copies' matrices and planes). One `InstancedMesh` per roof and tier, so a roof is still one draw call, still sleeps, flies away, hides and is culled as one thing.
- **Two tiers.** Near (within 170 ft of the eye): the modelled section, 338 to 540 triangles. Far (beyond 190 ft): one quad per section with a normal map baked from the same relief. In between a roof keeps what it has. Checked five times a second, one distance per roof.
- **The pointer is unchanged.** The planned flat surface is still in the roof as a mesh that is not drawn; it is what a click, a hover and "a roof stops the pointer" meet. The copies are never raycast (a copy's untrimmed part must not be clickable, and 20,000 triangles a roof would cost).
- **Shadows.** The copies cast and receive; the depth materials carry the same clip planes, so an untrimmed part casts nothing.
- **One switch to compare:** the command bar's "Roofs: painted flat surface" / "Roofs: modelled shingles" (`tw.roofSurface('painted' | 'sections')`, or open with `?roofsurface=painted`). Per page, not saved. Only the surface changes; the pitch stays.
- **Files.** `engine/client/data/roofsections.json` (tracked) names `engine/client/data/roof/roof-section--<style>.glb` (binaries, deployed with the client; the deploy gate checks them). A style whose file is missing or still loading wears the painted surface.
- **Not done:** a flat-roof surface; a second variant per style (the 5-ft repeat can be seen on a long slope); hip and valley trim pieces (no roof uses a hip yet); sections do not follow the faces dial; the thatch dormer and tile ridge the kit still lacks.
- **Numbers and stills:** `experiments/2026-10-11-roof-sections/RESULTS.md`.

### Stage G: follow-ons (2026-10-05)

Use in docs/UI.md "Storeys: fog, flyers, tall rooms and the rest". Test: `engine/test/browser_followons.py`.

- **Fog lies on the level in view.** The fog is one sheet on one floor. (A seat can turn its own fog off: Settings ▸ Me ▸ Fog and mist, 2026-10-11.)
  - Cut off, or on the ground storey: the ground, exactly as before storeys. Only ground-level rooms and their walls are given to the fog, so an upper floor gets no ground fog and neither it nor a cellar changes the fog's wall mask (measured: mask, indoor map and fog heights identical before and after an upper room and a cellar were built).
  - Cut on an upper storey: that storey's rooms' own fog, at that floor's height. No outdoor fog and no fog sea up there. The ground fog below is not drawn while you look at an upper storey.
  - Cut below ground: that level's rooms' fog (a cellar's default, or its own Fog height), at that depth. No outdoor fog.
  - **2026-10-06 (Harry: "No fog on 2nd story or higher by default").** A room on the second storey or higher has fog height 0 unless it has its own Fog height, whatever its type's default. Derived, never stored (`fogDefault` in `engine/core/height.js`), so saved campaigns are unchanged on disk and their never-set upper rooms follow it.
  - How: the game passes the fog only the rooms and walls of that level; the atmosphere gained two options, off by default (`setLevel({ base, indoorOnly })` in `tools/spawn-tuner/js/fx/atmos.js`: the height the sheet lies at, and "rooms' own fog only").
- **Flyers.** Anything lifted that is selected, and every pawn in the air whether selected or not, has a faint line straight down to the SURFACE below it (the floor of the room it is over, or the top of a thing under it; never just height 0) and a small label with its height above that surface ("12 ft"). The line and label never catch clicks.
  - **A raised PAWN (2026-10-13, Harry: "raise & lower a pawn should leave its base on the ground ... The base should 'fall' to the highest ground it's above and decide what height cutoff hides the pawn").** Its base stays down on the highest ground under it (a thing's top, the floor it is over, the top of a room it is above unless the room is open to the sky, else the ground) and a beam in its seat colour, with the height on it, replaces the faint line. **The cut is decided by the base's level, not the figure's height**: outdoors a dragon 40 ft up shows with the cut at 20 ft; a pawn on the third floor is hidden when looking into the first. docs/PAWNS.md "A raised pawn"; `baseUnder` in `engine/core/height.js`. Things (not pawns) keep the faint line and their own height for the cut.
- **Cursors.** Another seat's cursor is drawn on the floor it points at (presence carries the height as a third number, left out on the ground). A cursor above your cut is not drawn.
- **Tall rooms.** A room can span several storeys (`room.tall`, 1 to 6): Taller / Shorter on the room's menu. Its walls and posts are carried up one plain wall piece per storey (no doors or windows above the first). A room beside it at that height shares its wall there. It is refused when a room above is in the way, and no room can be built inside its upper part. A double-click into it cuts at its own ceiling.
- **The building tool works off the ground.** At another level it builds on the biggest rectangle of the drag that can be built on there (over rooms below plus two squares out; below ground, any free ground), joins the building it stands on, and gets one stair by the stair rule. Open air is refused with a message.
- **A stair goes with the room it came up into.** Deleting that room deletes the stair in the same step (one undo restores both), unless the stair is pinned or its top is at ground level.
- **Area pictures** (Settings ▸ World navigation) are taken with every level showing, whatever the picture-taker's cut; nothing hidden from players is in them; the cut is put back after the shot.
- **A pawn above the cut** is not drawn; the level indicator now counts them ("1 pawn above"). *Since 2026-10-13 "above the cut" means its BASE is above it (see Flyers).*
- **Where this meets roofs (Stage F).** A tall room's roof sits at the tall room's top. An upper storey made by the building tool gets roofs like any rooms. Roofs change nothing for the fog. With your roofs on, another seat's cursor over a roofed room is drawn on the roof, not under it. Area pictures show roofs if the picture-taker has roofs on.

Decided on Harry's behalf, for him to change:

- Looking at an upper storey, the ground fog below is not drawn at all.
- A flying pawn always shows its height and drop line, also when not selected.
- Tall-room walls are plain wall above the first storey: no upper windows.

Not done: firelight in upper-storey fog is sampled at ground height; a tall room's hung things stay at first-storey height.

## Leaning

Not final. Each of these is where the conversation pointed on 2026-10-05.

### Showing what is below the cut

- **DROPPED 2026-10-11.** Harry, after using it: "The 'poor focus' on lower levels is not really working out. I think we should drop it." What is below the level in view is now drawn sharp and at full brightness; the pass, the tuner panel and the game's focus height are removed (docs/UI.md, "Three small notes, 2026-10-11"). The lines below are the history. Dropping it made no measurable difference to frame time (docs/UI.md).
- **Harry wonders whether distance below can be shown with FOCUS instead of opacity**: things further below the level you are on go progressively out of focus, as in miniature photography.
- **Fauna agrees focus beats opacity.** Things below are not transparent, so making them see-through says the wrong thing.
- Fauna suggests pairing focus with slight dimming, plus a plain dim-only fallback for small inset views and weak machines.
- **To be tried as a tuner panel when storeys exist.**
- What the research found: lower levels faded with depth, and a height badge on tokens, were the best liked. See-through ghosts of upper floors were disliked.

### Terrain data model

- **Flat terraces at 5-ft steps, as outdoor rooms at a height** ("Duplo").
- Harry is not worried about a Minecraft look.
- How the step between two terraces is filled is now decided: see "Terrain: computed banks" under Decided.

### Standing on slopes

- Harry looked at TaleSpire and Baldur's Gate 3: both give a handful of flat, clearly marked "you can stand here" places on a slope.
- **We expect to end up with something like that.**
- The slope pilot (see Evidence) showed two things:
  - such flat zones can be computed from the mesh rather than hand-marked;
  - a level pawn base on a bare 35-degree face looks wrong: buried 1.75 ft on the uphill side, floating 1.75 ft on the downhill side.

## Evidence

### Research: how others handle height, and what users hate

`research/verticality-2026-10-05.md`. Web research only; nothing was built or spent.

What people hate, in the report's ranked order:

1. The view guesses which floor I want, and I cannot overrule it or my choice does not stick. The broadest and angriest finding (Baldur's Gate 3, TaleSpire, Jagged Alliance 3, Foundry).
2. Having to tell the software by hand what is a floor and what hides what, and then it breaks.
3. Things on floors I am not looking at catch my clicks or clutter the picture.
4. Fog of war and line of sight leak between floors.
5. Floors as separate maps or pages.
6. Levels that are flat, map-wide and one fixed height apart ("If you want to add a hill? Tough luck").
7. A token's height and its floor disagree; the ruler ignores height.
8. Building terrain and caves out of stacked blocks.
9. Stairs that do not cut their own hole or connect both ends.
10. The cut is a hidden mode: people forget it is on and report vanished buildings.

What people love, in the report's ranked order:

1. Height itself, when it is easy to read.
2. An explicit floor-up / floor-down control that stays where you put it. Nobody was found asking for it to be removed.
3. Seeing everyone at once. Levels below drawn with a depth fade was the most-praised change to Dwarf Fortress's view.
4. One visible height number on the token, which the ruler counts.
5. Small height offsets per room, inside a storey.
6. Stairs that are real objects: they cut their own hole and connect both ends.
7. Hiding everything above the cut, with a loud signal that a cut is active.
8. A faint ghost of the neighbouring floor as a tracing aid in the editor only (liked as an opt-in, hated as the always-on play view).

Limits of the research:

- The web-search allowance ran out early. Small products are thinly covered.
- Little Reddit (search snippets only) and no Discord, which is where Foundry and Dungeon Alchemist users mostly talk.
- Complaint threads over-represent complaints. The ranking counts how many unrelated products a complaint turned up in. It is not a measured share of users.

### The slope kit pilot

`experiments/2026-10-05-slopes/`. Cost $3.98 on fal (the paid model-generation service). Page: https://implausible.enterprises/projects/turnip-works/slopes-pilot/

- **The question:** does a hill assembled from generated slope props on flat grass read as natural rolling terrain?
- **The answer: no.** The naive approach, generated slope props butted together on a lawn, does not read as rolling terrain. It reads as props on a lawn.
- **Why:**
  - The cut faces lean, so two pieces placed edge to edge leave gaps.
  - There is a hard line where each piece meets the ground.
  - The grass colour drifts: darker and more saturated than the ground, even with the game's own grass tile given as a reference.
  - The generator ignores stated angles and sizes. "30 degree" banks came out at 36 to 44 degrees.
  - Bulky pieces came back partly unpainted (29 to 69% of the visible surface).
- **What worked:**
  - Object-like pieces with no cut faces (the mound, a corner seen from outside).
  - Flat standing zones computed from the mesh, with no hand marking.
- Harry: "a great experiment... really answered that this naive way of doing it won't work. I was overly optimistic."

### The banks demo

`experiments/2026-10-05-banks/`. Page: https://implausible.enterprises/projects/turnip-works/banks-demo/

- Harry tried it and decided on computed banks (see Decided).
- **Sunken ground needs sun shadows to read as sunken.** Without them it reads as flat.
- **A pawn on a slope reads better with a ring painted on the slope** than standing on a level disc.
- **Gemini still calls the result artificial**: an even slope, flat grass, rocks sitting on the ground rather than in it. Harry accepts this as the tabletop look.

## Levels fly away (2026-10-06)

Harry: "Instead of just disappearing, levels above the cut should fly up into the sky offscreen in a (very) short animation. Put this in the game, but we can also visit it with the tuner; I think this might be nice as a 'not all at once' thing, sort of like the way stuff builds, but faster." Use: docs/UI.md, "Levels fly away".

- **The cut rule does not change.** A room is shown whole or not at all, and it is hidden or shown in the frame the cut moves. The animation is drawn on top of that rule, not inside it.
- **What flies is a carrier, not the piece.** Each piece the cut hides lends its drawn parts to an empty carrier in a layer of its own for the length of the flight, and gets them back when the flight ends. The real piece is invisible and empty meanwhile.
  - So everything that asks "is this hidden?" gets today's answer: picking, selection, labels, lamps, the fog, the touchable check, every test written before this.
  - A piece in the air has nothing to click: the carrier layer is in no pick list.
  - Coming back, the piece counts as shown at once and its drawn parts arrive when they land.
- **Only what the cut itself hides flies.** A piece that is not drawn because nobody could see it anyway (under a floor, under its own roof, under the closed ground) just goes, as before. Otherwise furniture would rise through a roof.
- **Only a change of the cut starts it.** Rooms arriving from another seat, a re-roll, a move, an undo: no flight. Nor the cut an area opens with.
- **Roofs.** The roof pass uses the same call. With roofs switched off a roof is removed from the world at once and its drawn parts fly off and are freed where they end.
- **One runner, shared with the tuner** (`tools/spawn-tuner/js/fx/cutfly.js`), beside the spawn animation's schedule and pose (`js/anim.js`: `flySchedule` gives each piece its start, first at 0 and last at the stagger; `flyPose` gives its height at progress 0 to 1; the return is the same curve backwards). The game's part (`engine/client/cutfly.js`) only makes carriers and batches.
- **A flight's clock starts on the next frame drawn**, not when the cut moves: the frame that hides a storey can be a long one (lamps going out), and the flight would be spent inside it.
- **The rise grows with the camera's height** (the dial's feet at table distance, more when zoomed out), so pieces leave the top of the view at any zoom.
- **The house look is a preset like the others**: "Use in game" in the tuner stores it (`cutfly` in GET /tuner/house); the game reads it when a world starts and falls back to the built-in quick look.
- **Cost.** Idle: one call per frame that returns at once (measured: the step count does not move). In flight: one position write per piece per frame; no new draw calls (the same meshes, under another parent). Fade is off in the default look: with it on, every mesh of the leaving level gets its own material for the flight.
- **Choices made on Harry's behalf, for him to change:**
  - *350 ms end to end* for the default (200 ms a piece, 150 ms of ripple), the same both ways.
  - *The order is outward from the click*, with a quarter of scatter so it is not rings.
  - *No fade by default*: pieces speed up and leave the top of the view.
  - *Lamps go out at once* rather than fading with their level.
  - *The area you open is not animated.*
  - *Pawns and loose things above the cut fly too*, with the level.
- **Not done:** the picture-in-picture plays it only when it shows the same area as the main view (it draws the same world); other seats' cuts are their own, so nobody sees your levels fly; a thing whose mesh arrives while its piece is in the air appears at rest.

## Later: rooms that are not rectangles

Noted on 2026-10-05. Harry: this "is probably not going to come up for a while". Nothing here is built.

- **Built (2026-10-05): rooms whose outline follows the grid**, so a room can be an L, a U or a rectangle with a notch. Dragging out a room over existing ones makes a room of the part that does not overlap. See docs/UI.md, "Overlapping draws make L-shaped rooms".
  - A room stores its outline as a polygon of grid points (`engine/core/footprint.js`). Today every edge runs along the grid.
  - **What slanted edges would need, on top of that:** the outline check allowing the three slants; walls and wall keys for slanted edges; floors clipped to the outline; wall pieces stretched along a slant. The parts that ask a room for its shape (furniture, walls, floors, labels, fog, selection, the commands) all go through that one file and would not change.
- **Curved rooms, as many-sided rooms made from straight walls** (octagons). Main uses: turrets, towers and ships (pointed bows, tapered hulls).
  - A room's outline becomes a polygon whose corners are grid points.
  - Each edge is level, upright, or one of three slants, about 15, 30 and 45 degrees. On the 5-ft grid those are rises of 1 in 4 (about 14 degrees), 1 in 2 (about 27) and 1 in 1 (45), plus their mirrors (2 in 1 and 4 in 1). Pieced together they make curves; the same pieces reversed make curves that bend inward.
  - Walls run along the outline. A 1-in-2 edge takes two wall pieces of about 5.6 ft each; a 1-in-1 edge takes one piece of about 7.1 ft. Harry is fine with stretching the existing 5-ft wall pieces for now.
  - Floors are the ground texture clipped to the outline.
  - A cell counts as standable if its centre is inside the outline.
- **Some room types should eventually be curved by default**: tower, turret, boat. Not being done yet.

### Odd-shaped rooms: how to furnish them

From Harry's own experience furnishing a geodesic dome. Nothing to build yet.

- **Treat the largest rectangle that fits inside as "the room"** for normal furniture.
- **Keep only low things against slanted walls**: chairs, low couches.
- **Let partitions in the middle make zones.**
- The layout does not have to be clever. Harry: "shrug shoulders and throw some furniture in... we just have to let the user win it manually".

## Open

- Fog, flyers and roofs, once listed here, are built: Stages F and G above.

## Costs to pay when we build

Not discussed as a list on 2026-10-05. These are the costs that the items above already imply; nothing here is a new decision.

- Every room, object and pawn carries a height from the start, including in saved campaigns and in commands.
- One rule that works out a pawn's floor from its height, used everywhere, so that nothing stores the floor a second time.
- Buildings gain a base height and a settable storey height.
- The building generator has to place vertical connectors and line them up on both floors.
- Clicking has to ignore everything above the cut.
- Lamps have to be switched off by room when the room is not visible.
- (Historical: a tuner panel for the focus-and-dimming look. Built 2026-10-05, removed 2026-10-11 with the look.)
- The two conditional buttons the cut needs ("Cut to lv N", "Roofs on"), on the component that already exists (`engine/client/surfaces/condbutton.js`).
- Banks between terraces, with Harry's settings as the defaults.
- Every item under Open.

See also: docs/UI.md (camera, selection ring, raise / lower), docs/NETCODE.md (areas, AI seats), docs/IMPORTS.md (imported models).
