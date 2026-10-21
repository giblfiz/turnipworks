# Verticality: how others handle the third dimension, and what users hate about it

Research date 2026-10-05. Web research only, done by six parallel research agents plus spot checks. No code was written and nothing was spent.

**The question.** Turnip Works has to handle second storeys, rooftop chases, a temple up a mountainside, dungeons, caves and canyons. How do other tools do it, on screen and in their data, and what do their users hate?

**The leaning being tested.** Continuous vertical data internally, with a strong convention of "levels" (building floors or dungeon depths) 10 ft apart.

## How to read the evidence

Every claim carries a tag and a confidence.

- **[V]** raw text seen directly (GitHub API, Steam review API, raw HTML). Quotes are exact. 95%+.
- **[F]** page fetched, but read through a small summarising model. Substance about 90% reliable, exact wording about 80%.
- **[S]** search-result snippet only; the page itself would not open. About 65 to 75%.
- **[M]** from model memory, not checked today. A lead, not a finding.

Four things limit this report, and they matter:

1. **The web-search allowance ran out early** (a shared cap of 200 searches across the six agents). Most later work was direct fetches of known pages. Small products are thin.
2. **No Reddit and no Discord.** Reddit refused plain fetches and we did not work around it. Reddit appears only as search snippets, in the Foundry section. Foundry and Dungeon Alchemist users mostly talk on Discord, which is unreachable.
3. **Complaint threads over-represent complaints.** "Ranked by how often" below means "how many independent products and threads it turned up in", not a measured share of users.
4. I re-checked five load-bearing quotes against raw page text. Four matched exactly (Foundry issues #14276, #13945, #14681; the Larian "no way to view a different floor" thread; the Going Medieval "It's a mess" post). One did not: see the TaleSpire note marked UNCONFIRMED.

---

# Part 1. One-page summary

## What people hate, ranked

Ranked by breadth (how many unrelated products show it) and heat (do people quit, or just grumble).

**1. The view guesses which floor I want, and I cannot overrule it or my choice does not stick.** The broadest and angriest finding. (90%)
- Baldur's Gate 3: floors fade automatically around the selected character and there is no floor key. "There should be a simple button to switch between floors." [V] Complaints run from 2020 to March 2025 on Larian's forum despite repeated patches.
- TaleSpire: the automatic cut plane (a horizontal slice above which nothing is drawn) misfires. A review with 70 helpful votes: upper levels "come back around the edges (making it near impossible to get the mini back out of the building)". [V]
- Jagged Alliance 3: thread titled "Please stop changing levels!" [F] The level you chose resets when you select a unit.
- Foundry v14: clicking a token on another floor switches your whole view to that floor. [V]

**2. I have to tell the software, by hand, what is a floor, what is a wall on which level, and what hides what. Then it breaks.** (85% that this is a leading complaint; see the Foundry section for the rumour check)
- Foundry v14, GitHub issue #13945: "feels like a chore and it really shouldn't be". [V]
- Foundry Levels module: many users give up and put each floor in its own scene. [S]
- TaleSpire's substitute for fog (GM-drawn "hide volumes", boxes that hide their contents): "it simply isn't realistic to spend time creating 50 hide volumes or more". [V]

**3. Things on floors I am not looking at still get in the way: they catch my clicks, or they clutter the picture.** This is the "clicked the wrong floor" complaint, and it is confirmed. (85%)
- Going Medieval draws upper floors as see-through ghosts. "It's a mess... I do not want to see or be aware of any other layer -at all-". [V] Players place furniture on the ghost floor by accident. [F] Unfixed across four years of threads.
- Baldur's Gate 3: spells rejected because the cursor lands on the invisible ceiling. [F]
- Foundry v14 issue #14681: the first click on an off-level token "simply swaps level". [V]
- XCOM: "the cursor never stays on the upper level". [F]

**4. Fog of war and line of sight leak between floors.** (85%)
- Foundry Levels module: "exploring any floor will reveal the same area in all other floors" (the module's own README). [V] A 2025 tutorial calls fog the module's "biggest problem". [S]
- Foundry v14: open issues where a whole floor's art shows through. [V]
- TaleSpire: no fog at all after six years. "Players can see through walls and the only way to prevent that is awkward masking cubes." [V]
- TaleSpire's experimental fog "only works going down into a cave but not up into a second story because the black fog blocks the camera." [V] This is a structural conflict: a cut plane removes what is above you, fog paints over what you have not seen, and they fight.

**5. Floors as separate maps or pages.** (90%)
- Roll20: "Player's initiative tracker not carrying over as I switched pages... session nearly got derailed." [F] "Any map with even a singular building is nightmarish to run, modern settings or rooftop chases are essentially out." [F]
- Dungeon Alchemist exports one file per floor; users immediately asked for a single stacked scene. [F]
- RimWorld multi-floor mods (each floor its own map): stock on one floor not counted from another, colonists stuck at stairs. [S]

**6. Levels that are flat, map-wide and one fixed height apart.** (85%)
- Game Master Engine: "height doesn't work. The software has up to five layers of map, which each exists at a set height... If you want to add a hill? Tough luck." [V]
- Dungeon Alchemist: "Is it possibile to build a 1,5 floors?" No. [F] "Why is it that two rooms can't be placed next to each other of different heights? It's frustrating making tiered or descending areas." [F]
- Dwarf Fortress's publisher on its own classic view: one slice "might be a very thin strip of sloping hill". [S]
- The Sims 4 had to patch in a separate base height per building (2018) and per-room raised platforms (2020). [F]

**7. A token's height and its floor disagree; the ruler ignores height.** (85%)
- Foundry v14's most-reacted open levels issue (#14276): a flying token that rises past the ceiling stays "in" the floor below. [V]
- Roll20 has no height field at all; status-marker digits are "cumbersome" and "not counted in the distance measures". [F]
- TaleSpire: the ruler "gets really really funky" with elevation or flying. [V]

**8. Building terrain and caves out of stacked blocks.** (85%)
- TaleSpire: "do I have to place like a 100 tiles on top each other to get any kind cliff looking structure?" [F] A real terrain system has been promised since the Kickstarter and has not shipped.

**9. Stairs and transitions.** (80%)
- Project Zomboid: the upper floor is not drawn until you are on it, so zombies at the top of stairs are invisible. A popular mod exists solely to fix this. [F]
- inZOI: stairs do not cut their own hole or connect their own landing; a builder lost three days of work. [F]
- Dungeon Alchemist: "stairs down" vanished because a staircase now belongs to the lower floor. "I feel like I'm taking crazy pills." [F]

**10. The cut plane is a hidden mode.** (75%)
- Timberborn players forget the layer slider is on and report vanished buildings; the developers added a hatch pattern to signal it. [F/S]
- TaleSpire's plane only hides from the top down, so maps that descend from an open surface are badly served. [V]
- TaleSpire's plane is per player, so any player can slide it and peek into any building. [V]

## What people love, ranked

**1. Height itself, when it is legible.** "Even something as simple as verticality, which ranges between awkward and impossible to represent in other formats, is effortless and natural here." (TaleSpire review) [V] (90%)

**2. An explicit floor-up / floor-down control that stays where you put it.** XCOM's is the model players of other games ask for by name. I found nobody asking for manual floor stepping to be removed. (85%)

**3. Seeing everyone at once.** The 2D world's winning workaround is all floors side by side on one map: one turn order, nobody hidden. Dwarf Fortress's Steam release drew the levels *below* the current one with a depth fade, and that is the most-praised change to its view. (85%)

**4. One visible height number on the token, which the ruler counts.** Every physical table invents it (a die beside the mini). The tools users praise attach a badge and include it in distance. (85%)

**5. Small height offsets per room, inside a storey.** Sims 4 "platforms" and Paralives' per-room floor height. The Sims 3 cheat that unlocked free floor height was the standard advanced building technique for a decade. (80%)

**6. Stairs that are real objects: they cut their own hole and connect both ends.** The Sims does this; Atlas VTT does this by design. (80%)

**7. Hard hide above the cut, with a loud signal that a cut is active.** Timberborn. (75%)

**8. A faint ghost of the neighbouring floor as a drawing reference in the editor only.** Dungeondraft's "Compare Levels". Note the tension with hate #3: ghosts are liked as an opt-in, non-clickable tracing aid and hated as the always-on play view. (70%)

## The two suspected complaints

- **"I clicked the wrong floor": confirmed (85%).** Five products, see hate #3.
- **"I can't see my friends upstairs": only weakly supported (55%).** Not found in 4,029 TaleSpire reviews. It exists as Foundry Levels bug titles ("Players can only see other tokens, when they have selected their token") and its mirror image, seeing tokens through floors. The better-evidenced versions of the worry are "I can't find my own token" (TaleSpire) and "I can't see the floor I am about to walk onto" (Project Zomboid).

## What argues against the leaning

Nothing found argues against **continuous height in the data**. Three things argue against how the "levels" half is usually built, and one argues against the number 10.

1. **Levels must not be map-wide.** Game Master Engine, Dungeon Alchemist, classic Dwarf Fortress and pre-2018 Sims all show that one flat level plane across the whole map fails on uneven ground. On a mountainside temple, the gatehouse's second floor is below the sanctum's ground floor. A level has to belong to a building (or a zone) that has its own base height. No product surveyed does this fully; The Sims 4 comes closest. (85%)
2. **Do not store a token's floor separately from its height.** Foundry v14 stores both, and the pair drifting apart produced its worst bug cluster: flyers that do not change floor, giants whose eyes are upstairs, a keyboard step that walks a token through the floor. But the opposite extreme also fails: TaleSpire has pure free height and no idea what a storey is, and its automatic roof hiding suffers for it. So the storey should be a real object the building owns, and a token's floor should be *worked out* from its height and position by one rule. (80%)
3. **Ten feet is a default, never the unit.** The rules of D&D and Pathfinder consume feet, not storeys. Position snaps to 5 ft; jump heights are in single feet; Pathfinder 2 fall damage is half the feet fallen. Official adventures specify 20 and 30 ft ceilings. One Foundry user had 8 ft storeys and the fixed step punished him. Foundry's own default level is 20 ft. Also, a 10 ft *ceiling* plus a floor slab is not a 10 ft *storey*: pick which one "10" means. (85%)
4. **Dungeon Alchemist already is "free room height plus whole-number levels", and the seam is where its users complain.** If off-level heights exist, they need to be a deliberate, visible act, and rooms at different heights must be allowed to touch. (75%)
5. **A floor switcher that hides other floors rebuilds Roll20's page-per-floor pain inside one scene**, unless turn order, fog and the token list are per token rather than per view. (75%)
6. **Most scenes are one level.** Solasta's studio head kept height out of its user-facing editor: "When you go with a 3D editor, you're going to lose 50% of the users who can create content." [F] An opinion, not data, but from the one team that shipped both a height-first tactics game and a consumer editor. The level controls should cost nothing until a second level exists. (opinion real 95%; that he is right, unknown)

---

# Part 2. The eight design questions

## 1. Map-wide levels, per-building storeys, or free height with a cut plane?

| Model | Who | What breaks |
|---|---|---|
| Map-wide whole-number levels | Dwarf Fortress, original X-COM (1994), Xenonauts, XCOM, Going Medieval, Dungeondraft, DungeonFog, Dungeon Alchemist, Game Master Engine, Foundry v14 (as elevation bands), Atlas VTT | Sloped ground; half heights; two buildings with different storey heights on one map |
| Per-building base height, shared storeys above it | The Sims 4 (since 2018), Paralives | Needed a one-tile gap between buildings of different base height [S] |
| Per-chunk level range | Project Zomboid build 42 (32 levels per map chunk, split freely above and below ground) [F] | Not enough evidence |
| Free height, no levels, cut plane | TaleSpire, Timberborn (view only), Tabletop Simulator (no cut at all) | Software cannot tell what a room is, so auto-hide is guesswork; users ask for named floors |
| Free height, automatic fade only | Baldur's Gate 3, Divinity: Original Sin 2, Solasta | No way to state intent; see hate #1 |
| Each level a separate map | Roll20 pages, RimWorld (pocket maps, multi-floor mods) | Everything that crosses levels: initiative, fog, counts, pathing |

On sloped ground specifically: the direct evidence is Game Master Engine ("If you want to add a hill? Tough luck" [V]), the Dwarf Fortress "thin strip" remark [S], Dungeon Alchemist's two-year struggle to let rooms sit on hills [F], and The Sims 4's per-building foundation patch [F]. Foundry needs add-on modules for terrain height, and its best-known one (Elevated Vision) was declared incompatible with the Levels module in the module's own warning text [V]. Nobody has solved a hillside temple. That is open design space, not a solved problem to copy. (80%)

Two small open-source 3D tabletops (Thirdfold, and future199x/tabletop) independently chose "continuous world, cut plane that snaps to storeys, follows the token, can be locked" [F]. That is convergent with the leaning, but neither has users to complain yet.

## 2. How are people and things on other levels shown?

- **Not at all** (classic Dwarf Fortress, X-COM 1994, Sims 2, Project Zomboid until you arrive). Produces the stairs blind spot.
- **Levels below drawn, fading with depth** (Dwarf Fortress Steam). Praised. The fade amount is itself contested: too little and adjacent levels merge, too much and deep caves vanish; three fog-adjusting mods exist. [F]
- **Levels above as see-through ghosts** (Going Medieval). Hated in play and building. [V]
- **Tokens above as faded outline markers; lower storeys stay visible** (Atlas VTT, by design; no user feedback exists). [V]
- **Tokens drawn larger or smaller by height difference** (Foundry Levels module option). No reaction found. [V]
- **Live clones**: a module that mirrors tokens from a balcony region onto the floor below (Foundry "Multilevel Tokens"). [V]
- **A number badge on the token** (Foundry core, Owlbear extension, Fantasy Grounds). Liked.
- **Side by side** (Roll20, Owlbear's documented advice). The revealed favourite of 2D users.
- **A 2D list as the escape hatch**: Baldur's Gate 3 players target an enemy on another floor by clicking its portrait in the turn-order bar. [F] Cheap and proven: a token list or initiative tracker that can select and target regardless of floor.

No product was found that shows off-level tokens as ghosts or badges *and* has sourced user reaction to it. That is a gap in the evidence.

## 3. Roofs and ceilings: which auto-hide rules are liked?

Complaints were found about every scheme. Automatic rules fail at thresholds; manual modes get forgotten; ghosts get misclicked.

- **Liked in principle, hated when it cannot be overruled.** "A good feature overall, but... should be togglable." (BG3) [F]
- **Too eager is as bad as too shy.** Xenonauts 2 removes a roof as soon as any tile inside is revealed. A player's proposed rule, endorsed in thread, is the most reusable thing found: hide a roof only if (1) a friendly unit is inside, (2) a visible enemy is inside, (3) the cursor hovers the building, or (4) the manual toggle says so. [F]
- **Zoom-based hiding** (TaleSpire: roofs on when zoomed out, off when zoomed in) produced "my floors vanish when I zoom" confusion. [F/S]
- **TaleSpire's rule**: cast a ray straight up from the mini, plus (since 2024) eight diagonal rays; if most hit something, cut at the lowest hit. [V for the mechanism] The developers call it "still a pretty simple system". Improving it broke maps people had built around the old behaviour.
- **Walkable roofs confuse roof detectors** (Jagged Alliance 3). [F] For rooftop chases a roof should simply be the floor of the next level up, not a special object.
- **Whatever is hidden must also stop catching the mouse** (BG3's invisible ceiling). [F]
- **Roof hide as its own switch**, separate from which floor you view (X-COM 1994 has three separate controls: view level, move unit up or down, hide roof). [F]
- **Builders opt out**: TaleSpire builders avoid roofs; RPG Engine regulars leave cave ceilings off even though the tool can carve real tunnels. [V/F]
- Map makers want roofs exported as a separate hideable overlay, not baked into the floor image and not as their own level. [F]

## 4. Terrain: heightfield, voxels or stacked tiles?

A heightfield stores one height per ground point: smooth and cheap, but it cannot hold a cave roof or an overhang. Voxels are a 3D grid of filled or empty cells: caves and overhangs are free, slopes come out blocky.

- **Stacked tiles (TaleSpire)**: the loudest builder complaint after missing fog. Slow, blocky, no slope pieces. (90%)
- **Sculpted terrain with caves (The RPG Engine)**: praised ("in about 5 minutes I had made myself a cave" [V]), but the grid does not show on building floors, props do not follow the ground, objects get swallowed, and there is no flatten tool. [V]
- **Heightfield per level (Atlas VTT)**: each level has its own optional heightfield; caves and overhangs come from stacking levels. [V] Clever, untested by users.
- **Heightfield plus flat-floored buildings (The Sims 4)**: terrain moulds around the building or a foundation fills the gap; nothing can be built into the terrain. [F]
- **Block heightfield upgraded to true 3D (Timberborn, 2025)** because players wanted tunnels and overhangs. [F] A documented migration.
- **Painted height regions for vision only** (Foundry Elevated Vision: one byte per pixel; Owlbear Smoke and Spectre: six layers; MapTool Hill and Pit regions). [V/F]
- **Heightfield plus holes plus mesh inserts**: the game-engine standard. Unity's own documentation describes painting a hole and building the cave from other geometry. [F]
- Dungeon Alchemist: underground only in terrain biomes; large objects level the ground under themselves (from the earlier research file).

The voxel-versus-heightfield comparison for Valheim, Enshrouded, Planet Coaster and Cities: Skylines is memory only today and is not cited here.

## 5. Vertical connectors: are stairs first-class anywhere?

Yes, in a minority, and those are the well-regarded ones.

| Product | What a staircase is | How a token changes floor |
|---|---|---|
| The Sims | Object; auto-cuts the hole; validates both ends [M for detail, F for platforms rule] | Walks |
| Atlas VTT | Object with a destination level; cuts floors it passes through [V] | Drag past the top step, or "Go up / Go down" buttons on the stair |
| Foundry v14 | A hand-drawn region with a "Change Level" behaviour [V] | Enter the region; or a level picker on the token; or Q/E keys or mouse wheel on height |
| Foundry Levels module | A drawing flagged as stair, hole or elevator [V] | Enter it; or type a height |
| Dwarf Fortress | A tile shape (up, down, up-down; ramp) [F] | Pathfinding |
| Dungeon Alchemist | Object owned by the lower floor; cuts the floor above [F] | Not a play tool |
| TaleSpire, Tabletop Simulator | Ordinary scenery | Pick the mini up and drop it |
| Roll20 | Nothing; paid-tier teleport scripts | GM drags or copy-pastes the token |
| X-COM 1994 | Elevator tile | Unit up/down buttons work only on an elevator or with flying armour [F] |

Lessons, each seen in a complaint:
- A stair must own its opening and its landing (inZOI).
- A stair must be placeable from either end (Dungeon Alchemist).
- Auto-guessing the stair type annoys experts (Dwarf Fortress Steam: "you used to be able to specify up and down stairs separately" [F]).
- Arriving via a stair should put you at the matching height, and the view should show the floor you are arriving on before you get there (Foundry #14322 [V]; Project Zomboid; Atlas does this on purpose).
- The GM needs to move a token to another floor without his own view following (Foundry #14093, "a player token falls down from a bridge" [V]).
- No product has trapdoors, pits or ladders as a distinct, liked system that could be sourced. Atlas has ladders.

## 6. Flying and falling

- **TaleSpire**: the GM grants a "flying" mode; the player holds Ctrl while carrying to set height; a visible tower runs from ground to mini and can be grabbed at either end; the mini holds absolute world height as it moves. [V] Complaints: rulers go wrong; players who do not know it is a GM toggle think they cannot set height at all.
- **Foundry**: type a number, or scroll the wheel while dragging, or Q/E keys; a label floats above the token. Floor membership does not follow (#14276). [V]
- **Game Master Engine**: clear risers in 2.5 ft steps, and an invisible GM "support plane" to stand flyers on. [V]
- **Roll20**: nothing; digits on status markers. Hated.
- **Atlas VTT**: tokens have no height of their own; flying appears unrepresentable. [V for the data type; 85% for the conclusion]
- **Physical tables**: an "airborne" marker plus one number in feet beside the mini. Never by storey. [F]
- **Falling**: no tabletop tool models it. The rules need: the trigger (prone, speed zero), distance, 1d6 per 10 ft in D&D or half the feet fallen in Pathfinder 2, and where the edges are (Pathfinder 2 "Grab an Edge"). [F]
- **Distance to something higher up**: the rules are silent and tables use at least four formulas (longer of the two, 5-10-5 diagonals, true straight-line, add them). [F] A ruler that silently picks one will be wrong for most tables; it has to be a setting.
- Unsolved everywhere: two creatures in the same column at different heights. [F]

No well-liked interface for a token at arbitrary height was found. TaleSpire's tower is the best available model.

## 7. Fog of war and line of sight across levels

Known messes:
- One fog image shared by all floors (Foundry Levels module by default; MapTool's elevation library). [V/F]
- One viewed floor for the whole table: "all your players stuck in a maze will see what the Flying character is seeing". (MapTool library manual) [F]
- Tokens on one floor acting as eyes for another (Foundry v14, fixed in 14.364). [V]
- Rules that contradict for non-adjacent floors (Foundry #14239, opened by a core developer, still open). [V]
- A flat fog sheet at one height: "you can see under when you raise the max height of the fog". (Tabletop Simulator) [V]
- Fog that blocks the camera once rooms have ceilings (TaleSpire's experiment). [V]
- Balconies and overhangs: Foundry's reveal works only if lower walls trace the balcony outline. [V]
- Walls with no height of their own: in Foundry v14 a wall blocks everything on its level regardless of height. [S]

What works, or is designed to:
- Fog stored per floor (Foundry v14). [V]
- Floors that block sight because they are real geometry, with sight traced in 3D from eye height (Atlas VTT; a low wall blocks a halfling and not a giant). [V] No user feedback exists, and TaleSpire's shelved prototype shows this is costly.
- Cheap 2D stand-ins for high ground: one-way regions (MapTool Hill and Pit; Roll20 one-way lighting lines). [F]

Nobody surveyed has shipped fog together with a cutaway view and had users report that it works. If Turnip Works wants both, that interaction is the thing to design first.

## 8. What storey height do tools assume? Are half heights supported?

| Tool | Storey | Sub-storey |
|---|---|---|
| Atlas VTT | 10 ft default, 1 ft slab, 7 ft doors; any value per level [V] | Any; side-steps up to 2.5 ft walkable |
| Foundry Levels module | Taught as bands 0-9, 10-19, 20-29 [V] | Any number; low walls can be vaulted |
| Foundry v14 | Tutorials use 0-10, 10-20; the default single level is 4 grid units, i.e. 20 ft [V] | Any number |
| Dungeon Alchemist to Foundry importer | 10 units per floor [F] | Dungeon Alchemist itself: none ("1,5 floors" refused) |
| TaleSpire | Units undefined; walls and stairs about 2 units, floor tile 0.25, so about 11.25 ft floor to floor at the usual 5 ft convention (55%, inferred) | 0.25 unit steps (1.25 ft); vertical axis is not snapped at all [V] |
| Game Master Engine | Fixed, value not found | 2.5 ft risers for tokens only |
| The Sims 4 | Three wall heights, uniform per level [F] | Platforms in stair-step increments, per room, never bridging two levels [F] |
| Going Medieval | Walls several blocks tall | Half-level steps in the layer control: the single most disliked detail there [F] |
| Dwarf Fortress | Unspecified; fans estimate about 3 m [F] | None |
| Real buildings | About 3.0 m (10 ft) floor to floor [F] | n/a |
| Published adventures | 10 ft is what GMs assume when the text is silent [F]; official 5e examples of 20 and 30 ft [F] | Daises, ledges, pits and balconies are everywhere [M, 85%, no count made] |

Pattern (80%): every whole-number-level builder eventually had to add sub-level offsets, and the liked versions scope them **per room, inside a storey**. The hated version (Going Medieval) put the half-step into the level selector. With continuous data underneath, the dais lives in the data and the selector can stay on whole storeys.

---

# Part 3. Per-product notes

## TaleSpire (Bouncyrock)

**Model.** Free continuous height, no concept of a floor, one horizontal cut plane per viewer that the game tries to place automatically.

**On screen.**
- A vertical bar on the right edge with diamond markers: camera height, the hide plane, water level, fog. Right-click a diamond to type a value; the GM sets the board's height range. [V] Steam announcement 2022-12-15.
- The hide plane is per viewer, off at furthest zoom by default, and hides downward only. A padlock stops it auto-moving. (85%)
- Auto placement rule and its 2024 rework: https://bouncyrock.com/news/articles/talespire-dev-log-451-hide-plane-where-art-thou [V for the eight-direction mechanism]
- Hide volumes: GM-drawn boxes whose contents are invisible to players until toggled. Since June 2026 they respond to the hide plane. [V]
- Flying: GM toggles it per creature; Ctrl while carrying sets height; indicator tower. [V] Steam announcement 2020-09-07.
- Line of sight is creature-only: you see other minis only if yours can. Scenery is never hidden by sight. https://talespire.com/faq [F]

**In the data.**
- Smallest tile 1 x 0.25 x 1 units, the 0.25 being vertical. https://bouncyrock.com/news/articles/talespire-dev-log-127 [F] (92%)
- What a unit means is left to the table. [F]
- Positions stored to 1/100 unit on all three axes; no level field anywhere. Clipboard ("slab") format: https://github.com/Bouncyrock/DumbSlabStats/blob/master/format.md [F] (85%)
- World in 16-unit cubic zones; board up to 1000 units tall. https://bouncyrock.com/news/articles/talespire-dev-log-257 [F]
- No terrain system; hills and caves are stacked tiles and rock props. Deferred in October 2020 and still unshipped. [V]

**Hated.** (Steam review quotes are exact, pulled from Steam's review API; find them by review ID.)
- No fog, hide volumes as the workaround: reviews 206036037, 128442974, 148010711. A community plugin that auto-toggles hide volumes by room has about 7,300 downloads: https://thunderstore.io/c/talespire/p/LordAshes/RoomViewPlugin/ [F]
- Entering one building opens every roof at that height: https://steamcommunity.com/app/720620/discussions/0/3757726160334897276/ [F]
- Auto hide plane misfires: reviews 90368553, 90756413 ("i hope they add in support for setting floor/story heights"), 175413416.
- No named floors or jump-to-level: requested since 2021. https://steamcommunity.com/app/720620/discussions/0/4376911779075277141/ [F]; review 95346936 (96 helpful votes).
- Hides top-down only: review 95346936, "literally have the developers thought about maps that go down?" [V]
- Players can peek anywhere with the slider: review 100079948. [V]
- Hard to get a mini onto the right floor and find it again: reviews 158265373, 164023848. [V]
- Flying breaks rulers: reviews 145988134, 154997092. [V]
- Terrain from tiles: https://steamcommunity.com/app/720620/discussions/0/4376911779060490765/ [F]; reviews 106008169, 124814123.
- **UNCONFIRMED:** the TaleSpire agent reported a developer sentence, attributed to dev log 455, that the freedom given to builders "makes it really hard for TaleSpire to know what is and isn't a room and what should be shown or hidden". I could not find that page (the guessed address returns 404) and the sentence is not in dev log 451 or the Steam news feed. The claim is consistent with everything else, but treat the quote as 60% until someone finds it.

**Loved.** Verticality itself (reviews 148039310, 206663620, 107890158); cutaways (93672659); free vertical placement with height lock when building (124814123). A third-party review: turns were faster when the question involved height "and slower when the camera became the real puzzle". [F]

## Foundry VTT

**Core, all versions.** Every token has one elevation number, shown above the token, editable in the token's pop-up controls. https://foundryvtt.com/article/tokens/ [V]

**Version 12** added Regions (shapes with behaviours, including Teleport Token). https://foundryvtt.com/releases/12.324 [V]

**Version 13** added drag-ruler waypoints with mouse-wheel elevation change, and made lights and vision bounded vertically (a light is now a squat volume, not an infinite column). https://foundryvtt.com/releases/13.341 and https://github.com/foundryvtt/foundryvtt/issues/11729 [V]

**Version 14 "Scene Levels"** (stable 2026-04-01). https://foundryvtt.com/releases/14.359 [V]
- A level is a named elevation band (bottom, top), a list of which other levels are visible from it, and its own background, foreground and fog.
- Floors are not inferred. You draw a region with a "Define Surface" behaviour for each one.
- Stairs are a region with a "Change Level" behaviour.
- Objects carry a list of levels; blank means all levels, which is a documented trap (a blank light leaks into the sealed basement). https://foundrymods.com/how-to/foundry-v14-levels [V]
- Tokens keep a continuous elevation **and** a level membership, and the two can disagree (#14230). [V]
- Walls are tagged to levels but have no top and bottom height of their own. [S]

**The Levels module (theripper93)**, the standard before v14. A token's elevation number *is* its floor; there is no separate floor property. Levels typed as text ranges "0,9|10,19|20,29"; stairs, holes and elevators are flagged drawings. Old README: https://raw.githubusercontent.com/theripper93/Levels/c636614c47d8693a396933cbdcaa6411198b0320/README.md [V]. Wall top and bottom come from the companion Wall Height module. Installed in about a quarter of tracked worlds. https://www.foundryvtt-hub.com/package/levels/ [V]

**Rumour check: "setup burden is the top complaint".**
- **A leading complaint: supported, 80%.** A user summarising the mood: "I've seen quite a few users complain during the recent months about Levels and the amount of work it takes to set up". https://www.reddit.com/r/FoundryVTT/comments/1ftc212/ [S]. "It's a lot of work, especially if you're using maps you got from somewhere". https://www.reddit.com/r/FoundryVTT/comments/1excgrk/levels_help/ [S]
- **THE top complaint: only 55%.** Fragility (bugs, breakage on updates, clashes with other modules) shows up as often and usually in the same sentence. One prominent tutorial named fog, not setup, as the "biggest problem". https://www.reddit.com/r/FoundryVTT/comments/1jtt4kh/ [S]
- The burden survives into v14: https://github.com/foundryvtt/foundryvtt/issues/13945 [V]
- Related rumour, that the Levels module was paywalled: **not supported**. It was free; commercial map-sellers needed a licence. [V]
- Related rumour, that people buy pre-configured map packs to dodge setup: 60%, no user quote found.

**Other v14 complaints, all verified on GitHub.**
- Flying past a ceiling does not change level (#14276, 7 reactions, the most-reacted open levels issue).
- Keyboard height steps ignore level heights; a user with a level bottom at 16 lost hours (#14485).
- Floor art visible through walls on other levels (#14608, #14609).
- Clicking an off-level token switches the view (#14681); GM cannot send a token to another floor without following it (#14093).
- Balconies (#14625); doors on other levels not drawn (#14477).
- Large tokens' eyes end up in the level above (#14298).
- Migration means redoing maps (#14485); documentation missing (#14797).
- One Reddit comment: "The native foundry version of Level is terrible. RIpper Level was so much better". [S] One voice; do not over-weight.

**Loved.** One scene with real vertical play (snipers on balconies); core levels will not break on every update. Whether the typical GM is happier with v14 than with the module: unknown (50%).

**3D Canvas (theripper93).** Sits on the same 2D scene data and turns it into a 3D view. Reported free since the v14 update. [S] "It would be 5x as much work to set up a scene for the same play time." [S] Its documentation site was rate-limited all session, so its height model and its fog rules were not read. Performance complaints are expected but unverified.

## Atlas VTT (Kevin Sherman)

Read from the public repository (README, ARCHITECTURE, SPEC, scene type definitions). No user community exists, so there are no complaints to report; what follows is design.
- One unit is one foot. A level has a name, an elevation, a storey height (default 10), a slab thickness (default 1) and an optional heightfield of its own. Levels are not required to be evenly spaced. [V]
- Every object belongs to a level; its height is relative to the ground at its anchor.
- Stairs, ramps and ladders are objects with a destination level and they cut the floors they pass through.
- In play, anything above the token's level is cut away; tokens above show as faded outlines; the view switches early when a token is on the upper steps.
- Tokens have no height of their own. Flying looks unrepresentable (85%).
- Levels are scene-wide. A hillside village with differing storey heights is not addressed.

## Roll20

- No level concept and no token height field. One page per floor, or all floors side by side on one page. [F]
- The "player ribbon" moves a player's *view* to another page; tokens must be copied across by hand. https://app.roll20.net/forum/post/3188748/ [F]
- Turn order is page-bound for players. https://app.roll20.net/forum/post/10976103/ [F]
- Suggestion threads: multi-layer maps and line of sight, open since 2015 with 176+ votes: https://app.roll20.net/forum/post/1649267/ ; elevation on the foreground layer, +118 votes: https://app.roll20.net/forum/post/12296098/ ; "Roll20 badly needs a way of indicating elevation": https://app.roll20.net/forum/post/11842920/ [F]
- Side-by-side is the community's settled answer: https://app.roll20.net/forum/post/4805881/how-do-you-handle-multiple-floors [F]. Cost: large pages with dynamic lighting are slow. It is said to stop working past two or three levels. [F]
- Whether Roll20 shipped any elevation feature after April 2025: unknown.

## Owlbear Rodeo

- Official advice is to put maps side by side in one scene when the party is split across floors. https://docs.owlbear.rodeo/docs/scenes/ [S; the page refused a direct fetch]
- Height lives in extensions: a badge that distance measurement includes (https://extensions.owlbear.rodeo/character-distances), and six painted elevation layers for vision (https://extensions.owlbear.rodeo/smoke). [F]
- No complaint threads were found, but Reddit and Discord, where its users talk, were unreachable. Do not read that as satisfaction.

## Dungeon Alchemist

- Multi-level since July 2025: a level control top right, plus and minus keys; draw a room over another and the roof is replaced by the room. Underground only in terrain biomes. https://steamcommunity.com/app/1588530/discussions/0/604161881226084882/ [F]
- Before that, each room had its own raise and lower arrows. So it is whole-number levels on top of free per-room height.
- Export is one image plus one data file per floor; the floor number in the file name is the only level information. The developer: "A separate scene for each level is the 'correct' way". https://steamcommunity.com/app/1588530/discussions/0/604162199750068784/ [F]
- Community importers rebuild the stack in Foundry at 10 units per floor. https://foundryvtt.com/packages/da-level-importer [F]
- Complaints: no half floors (https://steamcommunity.com/app/1588530/discussions/0/570417058359224283/); rooms at different heights cannot touch (https://steamcommunity.com/app/1588530/discussions/0/604151999395588012/, before the multi-level release; whether fixed is unknown); stairs down (https://steamcommunity.com/app/1588530/discussions/0/537733421695310344/); holes and see-through missing from exports; three years late. [F]

## Dungeondraft, DungeonFog, Universal VTT format

- Dungeondraft: a level dropdown; each level is an independent canvas with no height number; "Compare Levels" ghosts another level at adjustable opacity; export one level at a time, optionally with one overlay level. https://encounterlibrary.com/dungeondraft-basics/multi-level-maps/ [F]
- DungeonFog: multi-level maps, export one level per file. https://www.dungeonfog.com/support/tutorials/export/ [F]
- The Universal VTT file format (the common interchange file for battle maps) has **no level, floor or height field**; a multi-floor map is several files. https://arkenforge.com/universal-vtt-files/ [F] (90%)
- Inkarnate, Dungeon Scrawl, Campaign Cartographer and published map-pack conventions: memory only; believed to be one image per floor.

## Other 3D tabletops

- **Game Master Engine**: up to five map layers at fixed heights. Review 127658310 [V] is the cleanest statement of why fixed flat layers fail. Hiding a layer hid only the floor plate, not the walls and furniture on it. https://steamcommunity.com/app/1451680/discussions/0/3162084075876123127/ [F]
- **The RPG Engine**: sculpted terrain with caves; a movable "cutout cube" instead of a plane; fog; tokens path over stairs. Grid missing on building floors (review 207215632 [V]).
- **RPG Stories**: explicit level selector since May 2024, "the community requested feature". One report of tokens hovering because the active ground level and the token's level disagreed (review 218728545 [V]).
- **Tabletop Simulator**: physics only. "No, multi level doesn't really work." https://steamcommunity.com/app/286160/discussions/0/154644928857394585/ [F] The community answer was to lay floors side by side.
- **Sigil (Wizards of the Coast's 3D tabletop)**: had a "Floors" toggle in its builder. Team cut in March 2025; servers reported to close at the end of October 2026. [F/S] A competitor's post-mortem blames hardware cost, authoring cost and the inability to use fifty years of 2D maps, not height handling. https://arkenforge.com/project-sigil-a-presumptive-farewell/ [F]
- **MapTool**: vision-blocking regions of four kinds including Hill and Pit. A community elevation library states its own limits: one visible elevation for everyone, fog shared across elevations. https://wiki.rptools.info/index.php/Lib:Elevation_Manual [F]
- **Menyr**: advertises "automatic roof removal for top-down gameplay"; no reviews exist; feed silent since June 2025. [V]
- **Realm Engine**: looks dormant since 2021. **Mirrorscape**: marketing mentions "clipping planes"; no height feedback found.
- **Alchemy RPG, Bag of Mapping, Tableplop, One More Multiverse, Fantasy Grounds beyond token height, D&D Beyond Maps, Arkenforge**: nothing usable retrieved.

## Video games

**Baldur's Gate 3. Rumour that the roof popping and vertical camera are widely disliked: confirmed as persistent and well attested (90%); "widely" is plausible but unmeasured (75%).**
- https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=956586 (March 2025) [V]
- https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=896509 ("Can I please look up?", 2020 to 2023): "I stopped playing because of the camera." [F]
- https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=812580 : a player asks for Page Up / Page Down to toggle individual layers. [F]
- https://forums.larian.com/ubbthreads.php?ubb=showflat&Number=746739 and Number=760849 [F]
- Larian patched fading location by location (patches 3, 5, 6) and the complaint outlived the patches. [S]
- The big camera mod (Native Camera Tweaks) fixes pitch and zoom, not floor selection. No mod adding a manual floor slice was found (55% that none exists).
- Steam threads for the game are age-gated and were read as snippets only. No major-outlet review line on the camera was found.
- Divinity: Original Sin 2: no comparable floor complaints found (65%); forum posters hold it up as better behaved, and it has far fewer stacked interiors.

**XCOM, X-COM 1994, Xenonauts, Jagged Alliance 3, Phoenix Point.** All use whole-number levels with an explicit step control.
- XCOM: mouse wheel or F/C; the camera snaps to the selected unit's level. https://steamcommunity.com/app/200510/discussions/0/846944689654740252/ [F] Some dislike the snap: "Is there any way to have it on a constant level?" [F]
- X-COM 1994 map files are literally a stack of 2D arrays, four bytes per cell (ground, west wall, north wall, object). https://www.ufopaedia.org/index.php/MAPS [F]
- Xenonauts 2 roof rule thread: https://www.goldhawkinteractive.com/forums/index.php?/topic/45403-logic-behind-removing-roofs-and-other-vision-blocking-elements/ [F]
- Jagged Alliance 3: https://steamcommunity.com/app/1084160/discussions/0/7405656898330661546/ [F]
- Every one of them has "I could not find the control" threads. Discoverability is a recurring cost of manual stepping.
- XCOM's tile sizes and what its camera mods fix: memory only, not cited.

**The Sims and its successors.**
- Page Up / Page Down for floors; a wall mode button (walls up, cutaway, walls down). (85%)
- Foundation height was per lot until 13 November 2018, then per unconnected building. https://sims-online.com/the-sims-4-november-13th-2018-update-patch-notes/ [F]
- Platforms, 10 November 2020: "Platforms enable you to build rooms at varying heights within a story level"; "Platforms can't connect across multiple levels." https://simsvip.com/2020/11/10/the-sims-4-new-game-patch-november-10th-2020/ [F]
- Terrain yields to buildings; "walls, rooms and buildings cannot be built into the terrain". https://simsvip.com/2018/11/14/tutorial-using-terrain-tools-in-the-sims-4/ [F]
- Sims 3 slope building and the free-floor-height cheat: https://www.carls-sims-3-guide.com/buildedit/houses/slope.php [F]
- Wrong-floor placement complaints were **not** found for The Sims, plausibly because the floor you view is always the floor you edit (60%).
- Paralives folds foundations, platforms and split levels into one idea, a per-room floor height, and stairs stretch to fit. https://simscommunity.info/2026/05/20/paralives-build-mode-guide-players/ [F]
- inZOI stairs: https://steamcommunity.com/app/2456740/discussions/0/599648870459308106/ [F]

**Solasta.** Camera pitch locked to save the studio from building ceilings and skies. [F] Preferred over BG3's camera by some players. https://steamcommunity.com/app/1096530/discussions/0/3008927444659187367/ [F] Its Dungeon Maker shipped flat on purpose: https://wccftech.com/solasta-crown-of-the-magister-qa-making-dungeons-with-dd-5ths-ruleset/ [F] Its cube-grid internals are memory only.

**Dwarf Fortress.**
- Map-wide slices; the Steam version shows levels below with a blue depth fade and an elevation readout giving two numbers, one relative to the local surface and one absolute. https://dwarffortresswiki.org/index.php/Z-axis [F]
- Stairs and ramps are tile shapes, not objects. https://docs.dfhack.org/en/stable/docs/tools/tiletypes.html [F]
- A level's physical height is unspecified; fans derive several answers. https://dwarffortresswiki.org/index.php/Tile [F]
- Complaints: wheel direction for changing level is a coin flip (https://steamcommunity.com/app/975370/discussions/0/3716062978730839534/); zones cannot span levels (https://steamcommunity.com/app/975370/discussions/0/3716062978733464003/); auto-guessed stairs (https://steamcommunity.com/app/975370/discussions/0/4842022878894389177/). [F]
- "I can't tell what level I'm on" and "I lost my dwarves" were **not** sourced today (believed common from memory, 75%).

**RimWorld.** Single plane on purpose. Its official "other levels" are separate maps. https://rimworldwiki.com/wiki/Pocket_map [F] The only developer reason found is cost: "with 9-18 months of work". [S] A developer quote about interface or readability was **not** found. Players supply that argument: "the constant level switching would frankly be just annoying." https://steamcommunity.com/app/294100/discussions/0/4364627785842855928/ [F]

**Project Zomboid.** Build 42 raised the cap from 8 storeys to 32 levels per chunk, above or below ground. https://www.pcgamesn.com/project-zomboid/build-42-basements [F] Stairs blind spot: https://steamcommunity.com/app/108600/discussions/0/3459345750024537580 [F] The fixing mod: https://steamcommunity.com/sharedfiles/filedetails/?id=3710281407 [F]

**Going Medieval.** The closest game analogue: real multi-level building with a layer control. Four threads, 2021 to 2025, same complaint, no developer reply seen.
- https://steamcommunity.com/app/1029780/discussions/2/3114781060450568966/ [V]
- https://steamcommunity.com/app/1029780/discussions/2/3115908227904068442/ [F]
- https://steamcommunity.com/app/1029780/discussions/0/4361250086034818336/ [F]
- https://steamcommunity.com/app/1029780/discussions/2/6832609818937025300/ [F]

**Timberborn.** A layer slider that hides everything above a height; later extended to uncover water and terrain, to pick a layer by clicking a tile on it, and to drop shadows onto the layer an object occupies. https://timberborn.wiki.gg/wiki/Update_7 [F]

**Prison Architect 2.** Multiple floors were its most-requested feature; it is still unreleased after being delayed indefinitely in August 2024, so there is no reception to report. https://en.wikipedia.org/wiki/Prison_Architect_2 [F]

## Tabletop rules and conventions

- D&D 5e: 5 ft squares; falling 1d6 per 10 ft, unchanged in 2024; high jump 3 + Strength modifier feet; creature "space" is explicitly not a physical size and no height is given. https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary and https://5thsrd.org/combat/movement_and_position/ [F]
- Distance across heights: rules silent. https://hill-kleerup.org/blog/heroes/2024/01/dd-5e-rules-ranged-attacks-and-relative-height.html [F]
- Pathfinder 2: fall damage is half the distance fallen; "Grab an Edge". https://2e.aonprd.com/Rules.aspx?ID=2352 [F]
- Ceiling height is often simply not stated: "room height is rarely given any thought". https://paizo.com/threads/rzs2rz0n?Sohow-high-is-the-ceiling= [F]
- Official 5e heists with 20 and 30 ft ceilings: https://www.dndbeyond.com/forums/dungeons-dragons-discussion/dungeon-masters-only/184303-celings-height [F]
- D&D Beyond redrew the famous isometric Castle Ravenloft map as seven top-down maps because the isometric style "does not lend itself well to the typical virtual tabletop". https://www.dndbeyond.com/posts/1607-castle-ravenloft-maps-explore-strahds-castle-with [F]
- How tables track flyers: https://www.enworld.org/threads/how-do-you-show-flight-elevation-in-combat-when-using-minis.179530/ and https://www.campaignmastery.com/blog/elevate-your-game-tracking-airborne-minis/ [F]
- "Once PCs get more than 50 feet above the ground I go to theater of the mind". https://www.enworld.org/threads/aerial-combat-in-5e.713340/ [F]
- Not verified today: any default ceiling height in the 5e Dungeon Master's Guide; D&D 3.5 and 4e three-dimensional movement text; BattleTech's 6 m level; wall heights of Dwarven Forge and printable terrain systems; how often adventure heights are not multiples of 10.

---

# Part 4. Could not verify

- Anything on Reddit beyond search snippets; anything on Discord.
- The TaleSpire developer sentence about not knowing what a room is (see the UNCONFIRMED note).
- TaleSpire's official wall height, and so its true storey height.
- Vote counts on TaleSpire's feature-request board (the site draws its content with scripts; only titles were seen).
- theripper93's Levels and 3D Canvas documentation (rate-limited all session); 3D Canvas's height model, fog and performance complaints.
- Whether Foundry v14 levels are, on balance, better liked than the module.
- Whether Dungeon Alchemist fixed the "rooms of different heights cannot touch" gap.
- Owlbear Rodeo's scene model and any user complaints about it.
- Alchemy RPG, Bag of Mapping, Tableplop, One More Multiverse, Shmeppy, Let's Role, Arkenforge floors, Inkarnate.
- XCOM tile dimensions and camera mods; Solasta's grid internals; The Sims stairs history; Pathfinder: Kingmaker, Wasteland 3, Battletech.
- The whole voxel-versus-heightfield comparison for Valheim, Enshrouded, Planet Coaster, Cities: Skylines, Stonehearth, Gnomoria and Evil Genius 2.
- Any product that shows off-level tokens as ghosts or badges with user reaction to it.
- Any measured prevalence. Every ranking here is a count of independent sightings in complaint-heavy sources.

Cheapest next step to close most of these: rerun the Foundry, TaleSpire-feedback-board and tabletop-conventions lanes on a day with a fresh search allowance, about 15 searches each.
