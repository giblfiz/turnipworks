> **Terminology (Harry 2026-10-03):** a playable area (formerly "table") is now an **area**. "Table" means furniture only.

# Turnip Works game UI: decisions so far

**Later design exploration, recorded 2026-10-11:** [painted circular icons and orbital-menu pruning](design/orbital-menu-2026-10-11/README.md). That record distinguishes agreed content cuts from proposals and archives all eleven mockups. The arch/concentric layout remains unsettled; none of those changes is implemented by that session. Older full-circle/close-button descriptions below are implementation history, not the latest design intent.

These are working decisions from Harry and Fauna's conversation of 2026-10-02. They describe the real game, not the Spawn Tuner.

**Status (2026-10-03):** a build of this UI is live at https://turnipworks.net/ (the game is the site root; /play/ redirects there) (code in `engine/client/`, notes in `engine/LAB_NOTES.md`). The breakdown of what's built and what's stubbed is in the lab notes. The selection hierarchy follows the provisional rule: most specific click, the building at the map detent, Shift+Enter / Enter / double-click, and a breadcrumb.

## Two front ends, one registry (Harry 2026-10-02)
Harry has a second menu/hotkey UI (a deep, chorded, visual-feedback menu system) to explain later. It will run **in parallel** with the bar, ring and hotkeys described here, both present at once. Both read the same command registry, so the registry and input layer must keep a clean seam for multiple simultaneous front ends.

## One UI, two seats
- There are only two UIs that matter: the **GM** and the **player**. Both use the same interface; players simply lose access to some things. The table screen (TV) and LLM seats have no UI of their own.
- Prep (building) and live play share that one UI. Nothing sits permanently on screen except the world, the command bar and a little presence information, so building tools appear only when someone asks for them.

## Two primary interfaces
1. **The camera**: grab-the-world navigation with zoom detents (map → table → first person).
2. **The command bar**: free text that finds any command, asset, thing in the world, place, person or cue.

## Command bar
- **Top centre.** Results drop **down** below it. Up-arrow (with an empty input, or from the top result) recalls history, as in a shell or browser omnibox. Down enters the results. This also matches the industry pattern (VS Code palette, Spotlight, Raycast, browser omnibox).
- **Building commands:** make each room type (enters the drag-a-rectangle room tool on the 5-ft grid); re-roll the selected room (honouring pins); change room type, walls and floor; delete a room; replay the spawn.
- **One ranked list with typed sections:**
  - commands
  - things to place (catalog)
  - things in the world (by name, three-letter tag or description)
  - places and areas
  - people
  - cues and presets
- **Context-aware.** Results favor a matching title prefix, then the current selection, recency and frequency; for example, “graphics” keeps the Graphics quality presets visible among synonym matches. Commands apply to the whole selection. Results the seat can't use never appear (permissions decide what a player sees).
- **Preview on highlight.** The world object lights up, an asset shows its ghost, and the camera hints where it would go.
- **Teaches shortcuts.** Every command shows its key.
- **Arguments as chips** (move ▸ Brakka ▸ to ▸ [click]; roll ▸ d20 ▸ +5 ▸ advantage). Typing and clicking mix.
- **Instant.** The local fuzzy index over the catalog and the scene answers within a frame.
- **Natural-language fallback.** Text that matches nothing goes, on Enter, to the GM's assistant seat (an LLM seat using the same commands, so it is undoable).
- **Samples and icons everywhere (premium).** Every result has a visual:
  - a catalog object shows its **actual model turning in a small box** (the review page's 6 rpm turntable, rendered live into scissor viewports of one renderer, with a static icon until the mesh loads);
  - world things show their thumbnail;
  - people show their seat colour;
  - places show a top-down room thumbnail;
  - lighting and weather cues show a swatch of the current room under that look;
  - commands use one consistent icon set.
- **Drag straight out of the results into the world.** The result becomes the placement ghost and keeps the asset's placement semantics: grid snap, walls for wall items, tabletops for surface items with gravity. Drop to place; Esc cancels. Clicking a result enters place mode with the ghost on the cursor; Shift-click on the map keeps placing more.

### Pick several results; return to the last list (2026-10-13)

**Shift-click** a figure or object row to add it to the pick; **Ctrl/⌘-click** toggles that row. Arrow keys highlight rows; **Shift+Enter / Shift+Space** add the highlighted row. Checked rows and a **“5 picked”** chip show the total, including counts such as “6 goblins” (up to 30 per row, as for existing count placement). Picks can span searches and mix figures with objects. **Enter** or the chip's **Place** button arms the group; dragging any checked row carries the whole group. Plain row activation clears the pick and runs that row normally. **Esc** clears a pick first, then closes the bar on the next press; closing never retains picks.

The group has a ghost for every member, laid out on nearby free squares with room for their footprints. Drop/click submits one batch, so one undo removes the whole group and other seats receive it together. R turns the members; a dragged pawn group follows **Pawns snap to squares** and its Shift inversion, while click-to-place uses squares as before. A drag cancelled with Esc or released off the map places nothing and restores the list. Floor tiles within a picked group paint individual cells; a single unpicked floor dragged from the list retains its whole-floor behavior.

**`/` reopens the last result list with an empty text field**, its scroll position and highlighted row, and a quiet **“last: orc”** label. Typing replaces it immediately. The query is re-evaluated against current permissions and scene state; no stale commands are retained. This memory lasts only until page reload, and explicit prefilled searches (for example from the Pawns menu) still open their own query. Up-arrow history remains separate.

## L for labels, O for a thing's state, and the ring under the HUD (Harry 2026-10-20, as built)
- **L turns the room and building labels off and on** (`view.labels`; this browser only, remembered in `localStorage` `tw.labels`). The same switch: "labels" in the command bar (its row shows L), Settings ▸ Me ▸ Interface ▸ "Room and building labels" (GM side only: players never see labels), the "?" sheet. Pawn names are not labels: they are drawn in the 3D picture (on the base, or a floating sprite) and stay. Like every letter, L does nothing while a text field (the command bar) has focus.
- **O is "change this thing's state"** (Harry: L went to the labels, so Light moved to O). One openable selected: Open / Close. Every selected thing a light (candle, lantern, fireplace): Light / Put out. `thing.open` is registered before `thing.light`, and a key runs the first command that applies, so a thing that were both would open; no catalogue entry is both today. A mixed selection (a door and a candle) does nothing, as Open / Close only ever acted on one thing.
- **The ring is under every camera-locked piece of UI** ("the ones that are entirely camera locked, like menus and the quickbar") and over the world's own overlays. One table, `engine/client/style.css` ":root z-order": 1. room and building labels, speech bubbles; 2. the ring; 3. everything else (the command bar and its results, Pawns / Build / Settings, the area pills, crumbs, the level meter, avatars, the chat and roll log, the PiP's frame, FPS and status, trays, sheets, Settings, toasts, the dice announce, the labs' drawers). Where band 3 overlaps a ring button it is drawn on top and takes the click. Before this the chat log, the PiP's title bar, the crumbs, the FPS meter, the status line and the "no area" notice were under the ring (the command bar, launchers, level meter and avatars already won). Inside the ring: buttons, then their curved names, a hovered button with its tip, the damage box, readouts and cards.
- Test: `engine/test/browser_hudz.py` (moves a zoomed-in room's ring button under each piece of UI and asks `elementFromPoint`; L, O, typing). Stills: `experiments/2026-10-20-hud-z/`.

## The ring, as built 2026-10-20 (Harry: "I think rev4 settings I sent you are ready to use in the game. let's move them over")
The ring Harry shaped in Ring Lab is the game ring for every seat. **The sections below this one are its history** (what each button does is unchanged; where buttons sit and how lists open is what changed).
- **Its shape is data:** the house ring (`GET /api/tw-ratings/tuner/house` → `ring`, set by Ring Lab's **Use as default**; today Harry's "Revised 4"), else the built-in "Ellipse · one curve". Geometry: `client/ringlab/model.js`; the controller and every button's behaviour: `client/surfaces/ring.js`.
- **One oval.** Shut: the main buttons (a pawn: Turn · Sheet · Damage; a door: Resize · Turn · Open · Pin; a room: Hide · Turn · Re-roll …, left to right in their old clock order) and **☰ ("More")** at the right end, on the top of the oval. Open: the extra buttons take the top from about 9:00 across; the main buttons **slide** along the oval, past 9:00, to 7–9; ☰ stays at the right end of the row. ☰ toggles (no ×, no Close button); Escape and a new selection shut it. **☰ is one more button on the curve** (Harry 2026-10-20: "the 'fewer options' button should get added to the orbital as if it is exactly like every other button. No special spacing/size/settings"): one pitch after the last main button shut and after the last extra button open, the same size, its slide staggered as the next button of that row; Ring lab has no ☰ knob (the old "Extra space before More", `curve.menuGap`, is gone, and a saved ring that carries one loads without it). The slide is real movement along the curve (about half a second, eased, staggered); shutting plays it back; reduced motion jumps.
- **Sized in the world:** a button is 6 ft at the piece (today's 68 px at the default view), times the piece's base / 5 ft (a 20 ft dragon gets a ring 4 × as big), held between 40 and 110 px; when held, the whole ring holds. It faces the camera, is drawn over walls and roofs, and is never pushed back on screen: move the camera.
- **Centre:** one pawn: 85 % up its figure (roughly the head; a raised pawn's figure, not its beam); a thing: 50 % up; a room, a building, a wall or several pieces: the middle of what is drawn.
- **Sub-menus are the oval grown outward** (a fixed offset on both axes), never a panel: a ▸ group (Conditions, Indicators, Walls, Roof styles, Storeys …), **Replace with similar** (the variants, turning), **Faction** (the emblems; "As the room's / building's" first, a faction with no slot greyed), **Send to area** (the areas; a hidden one marked). Pick one and the ring shuts. Siblings never share a picture: a repeated icon shows the item's initials.
- **The 3–6 o'clock sector stays empty** whatever the shape, names included, and **a row slides, it does not break** (Harry 2026-10-21): a row (shut, open, or a sub-menu's ring) that would put a button or its name in 3–6 slides along its curve as a whole to the nearest clear place (back, anticlockwise, first; forward when it is the first button's name that reaches 6:00; a sub-menu as far back as the main row's floor). ☰ is always the row's last button, in line. Only a row that fits nowhere steps its last EXTRA buttons one ring out (today: an object's, a door's and a light's open rows, about one button too long for the oval). The settings are untouched; Ring lab's Where says "… starts at 9:08 → slid to 7:40 to stay out of 3–6".
- **Every slider is a drag track:** turn, roll, size, raise / lower, damage (out more, in heals; a click types 7 / -5 / =12) and now **fog height** (0–8 ft, a notch at none, let go on "type default" to put the room back; it was a slider panel). Still small cards, as before: the pawn's **Sheet** card (name, who moves it, link, notes) and the rename field.
- **Names** in the ring's label style (house: curved above each button), sized with it. Painted pictures when the house ring names a set (house: charcoal).
- **Who gets a ring** is unchanged: a pawn's for every seat; the rest only for what that seat may touch, open or light. Keyboard, chords, the "?" sheet and the command bar reach the same commands and the same sub-menus (`ring.replace`, `ring.faction`, `ring.travel`, `ring.sheet`, `ring.give`, `ring.rename`, `ring.damage`).
- **Ring Lab** (`?ringlab=1`) is the same ring with the drawer: its unsaved draft shapes only that browser's lab ring, never the plain game. Tests: `engine/test/browser_pawnring.py`, `tests/browser_ring_parity.py` (every audited action reachable and dispatching what it did), `tests/browser_ring_ellipse.py`, `tests/browser_ring_lab.py`, `engine/test/ringlab.test.mjs`. The audit: `tests/data/ring-parity-audit.json`.

## Historical: the selection ring (Harry 2026-10-02: "we really don't want to overwhelm them")
- Selecting something puts a ring around it. **The handles are the controls:** rotate is a knob on the ring and size is a handle on the ring. They don't count as buttons.
- **At most 3–4 buttons on the ring, at fixed clock positions** so muscle memory holds. One of them is always **☰**. Clicking ☰ fills the whole circle with the object's full option tree, which is the same chord tree the keyboard navigates (`Space`, then the selection branch), drawn radially at the object. Deeper levels open outward.
- **Standard buttons by kind:**
  - **prop:** pin · ☰
  - **openable prop** (door, chest, shutter): open/close · pin · ☰
  - **pawn** (PC/NPC token): label (text) · sheet (if one is attached) · ☰. Pawns get the **facing** knob but **no size handle** (enlarge/reduce is rare and lives under ☰), and **no pin** button (Harry agreed 2026-10-02).
- **Everything else lives under ☰:**
  - condition/age
  - replace with similar
  - lock
  - light
  - fill
  - break
  - hide from players
  - contents
  - description and notes
  - conditions, HP, initiative, vision, elevation
  - and so on
- **Delete** is the Delete key. Duplicate, copy and paste are the standard shortcuts.
- **Multi-select:** one ring around the group, showing only actions every selected item shares.
- Players see the ring only on things they're allowed to touch, with only their permitted actions.
- **Props, as revised (Harry 2026-10-04):**
  - closed: exactly **turn · size · pin · ☰**, in that order, in an arc **above the thing** (10:00 → 2:00). Turn and size are drag buttons.
  - The ring anchors on the thing's **projected bounding box**: centred on it, with the core arc just above its top edge, so walls, doors, wardrobes and lamp posts get their controls above them. It slides inward near the screen edges.
  - Open: the four keep their order and angles; ☰ stays in its spot as **×** (close); the other options fill the rest of the circle in one fixed order, so the same kind of thing always gets the same layout. Since the evening of 2026-10-05 that is one flat level again, with sub-menus only for long lists: see "☰ is flat again" below.
  - **What can't be done is not shown at all** (no greyed entries; this overrides the older "grey out to keep positions").
  - **Toggles show the action they will do now**, label and icon both: Pin/Unpin, Hide/Reveal, Open/Close, Lock/Unlock, Light/Put out; a mixed selection shows the action that makes them uniform ("Pin all"). It is one registry pattern (`toggle:` in a command), so every surface and the bar share the wording.
  - One size token (`RING_SCALE` in `engine/client/surfaces/ring.js`, CSS `--rs`; now 1.2) scales buttons, icons, radius and the open circle together.
  - Pawns and openables keep their earlier layout for now (Harry to discuss).
- **As built (Harry's first hands-on round, 2026-10-02):**
  - no circle is drawn; the standard buttons are big (56 px) and sit at fixed positions from 10:00 to 2:00;
  - turn is a full-size drag button at 10:00, and raise/lower is a drag button inside ☰; the **size handle is back on the ring** at 4 o'clock for props (Harry 2026-10-04; pawns get none), and the ☰ options flow around it;
  - ☰ disappears when clicked, and every other option (big icons) fills the rest of the circle in ONE flat level, with no deeper levels (briefly regrouped into sub-menus on 2026-10-05, then flat again: see "☰ is flat again" below);
  - the selection signal is a pulsing depth-tested halo, or a footprint outline on the floor (switchable in View); a selected room glowed as its floor outline (**since 2026-10-05 a room wears the house selection look**: see "Rooms: turn, drag, hide");
  - lit things (fireplaces, candles, lanterns) get a light / put-out button that shows its state.
- **Drag handles keep ONE frozen frame per gesture (A playtester's bug hunt, 2026-10-04):** on press the ring's centre, the handle's direction and the starting values are fixed; nothing re-lays out until release. The other buttons step aside and only the dragged handle follows the pointer.
  - **Size:** the scale is the pointer's distance from the frozen centre measured *along the handle's starting ray* (sideways motion does nothing), relative to where the drag began. It is monotonic, eases into soft stops at 0.2× and 5×, and never flips or shakes near the centre. A centre crosshair, a guide line to the handle and a live readout (`120% · 4 ft 2 in`) show where "smaller" is. Shift snaps to 25% steps.
  - **Turn:** the angle about the frozen centre, with a readout in degrees; Shift snaps 15°. **Roll** (☰): the same, about the thing's own axis. **Raise / lower:** vertical drag at a fixed pixels-per-foot; Shift snaps 6 in.
  - **Turn has notches every 45° (Harry 2026-10-05):** it still turns freely, but when the thing's facing comes within 4° of a multiple of 45° it catches there, and pulling further lets go. Eight small ticks round the centre show where the notches are; the one that has caught thickens and the readout shows ◆. Released in a notch, the thing lands exactly on that angle. The notches are on the thing's own facing, so they line it up with the walls. This is for things and pawns; rooms keep their 90° steps.
  - (Before: every move re-measured the thing's bounds while it changed size, so the centre moved under the drag; and the raw radial distance went through zero at the centre.)
- **Colour is dropped for now.**
- **Right-click is tabled** for later discussion.

### ☰ is flat again; sub-menus only for long lists (Harry 2026-10-05, evening; as built)
- **History.** On the morning of 2026-10-05 a room's ☰ had grown to about 60 options (one per room type, wall style and floor), and Harry said "way way too much stuff in the hamburger menu! maybe this should be a multi-level like 'replace with similar'". The whole menu was then regrouped into Replace ▸ / Edit ▸ / Copy ▸ with levels inside the flyouts. **That regroup was reverted the same evening** for ordinary things. Harry: "We really butchered the hamburger menu by doing submenus. We DON'T need a cut copy paste set of options in there, and when a sub-menu spawns it should spawn near the button that spawned it (covering that part of the radial), and for normal items other than the 'replace with' item, we don't need submenus; everything in Edit can come back out." The flat circle of about 11 had been fine ("11 was ok"); only the room's long lists were the problem.
- **Open, the ring is ONE flat level**, in one fixed order, so the same kind of thing always gets the same layout. What can't be done is not shown. Toggles name what they will do now. Captions wrap to two lines so they are read whole.
- **There is no Edit ▸ and no Copy ▸.**
- **Duplicate, copy and cut are not on the ring** (nor in the Space chords). They keep their keys, **Ctrl/⌘+D**, **Ctrl/⌘+C**, **Ctrl/⌘+X** (paste is Ctrl/⌘+V), and the command bar finds them by name. A room's "turn back 90°" is also off the ring (Shift+R, the bar): the closed ring already has Turn.
- **The layout for each kind, as it was until 2026-10-11** (closed ring | what ☰ adds, in order; **now: the table in "The cuts", below**):
  - **prop:** turn · size · pin · ☰ | Replace ▸, Raise / lower (a drag button), Rename, Lock, Hide from players, Delete
  - **openable prop (chest):** turn · open/close · pin · size · ☰ | the same six
  - **light source (candle):** as a prop, with **Light / Put out** first
  - **pawn (since 2026-10-06, see "Pawn ring"):** turn · sheet · damage · ☰ | Conditions ▸, Indicators ▸, Raise / lower, Set / change name, Lock, Hide from players, Duplicate, Give control ▸, Delete
  - **room:** turn · re-roll · ☰ | Room type ▸, Walls ▸, Floor ▸, Fog height ▸, Rename, Lock, Hide from players, Replay spawn, Delete (9; it was 60-odd)
  - **wall piece, door, window:** as a prop (a door also has open/close on the closed ring)
  - **building:** ☰ | Rename, Lock, Hide from players, Delete
  - **several things:** turn · pin · ☰ | Lock, Hide from players, Delete
- **A sub-menu exists only where a long list is unavoidable:** Replace ▸ (the thing's similar variants, turning), a room's Room type ▸, Walls ▸ and Floor ▸, a pawn's Conditions ▸. Fog height ▸ opens a slider the same way.
  - **It opens AT the button that opened it**, covering that part of the circle and reaching outward, away from the selected thing. (Before, "replace with similar" fanned out on an arc above the ring and the long lists opened in a panel beside it: both in a fixed place, wherever the button was.)
  - Near a screen edge it moves inward only as far as it must to be whole, keeps its button under it, and of the places that fit takes the one that hides least of the selected thing.
  - It follows the ring when the camera moves.
  - It is one panel with a title and an ×, and one level deep: no sub-menu opens another, there is no Back tile. A very long list (41 floors) scrolls inside the panel.
  - It closes on Escape (the ring stays open), a click anywhere else, its ×, its own button again, or choosing an item. While it is open it covers the neighbouring buttons on the circle.
- **Options already on the closed ring are not repeated** in the open circle (a prop's pin, a room's turn and re-roll, a pawn's label).
- **The Space chord tree has the same shape:** flat where the ring is flat. Space H hides, Space K locks, Space U raise / lower, Space N rename, Space R replace, Space D delete; a room adds Space T / W / F (the lists, then one more letter), Space G fog height, Space E re-roll, Space Q turn, Space A replay; a pawn Space S sheet, Space V damage, Space C conditions, Space M indicators, Space X duplicate, Space G give control. Backspace goes up a level; Esc cancels. Letters are fixed per command. In a list longer than 36 entries the last ones have no letter.
- **The command bar still finds every command by name**, duplicate / copy / cut included.
- **One table** (`engine/client/menu.js`, `MENU` and `NOT_IN_MENU`) drives the ring, the sub-menus and the chords. To rearrange, edit that table. A menu command the table names nowhere is shown just before Delete and reported in the console (the test `browser_rooms.py` fails on any).
- **Tested** (`engine/test/browser_rooms.py`): no kind of selection opens more than 12 top-level options (as of 2026-10-06: room 9, pawn 9, lit prop 7, prop / chest / wall / door / window 6, building 4, several things 3; the counts since the cuts are in the table below); duplicate / copy / cut appear nowhere in the ring; every sub-menu is at its button, whole on screen at the edges, and follows the camera; "everything on screen is touchable" holds with a sub-menu open.

### The cuts (Harry 2026-10-11: "ship the cuts"; as built)
The ring's geometry and its icons are as they were (that redesign is paused: `docs/design/orbital-menu-2026-10-11/README.md`). Only WHICH entries the ring shows changed. **This section is the current layout; the lists above it are history.**
- **No ring has Delete.** The Delete key (Del, Backspace), "delete" in the command bar and undo are unchanged, and the "?" sheet lists Delete with its key.
- **A pawn's ☰ is five entries:** Conditions ▸, Indicators ▸, Raise / lower, Hide / reveal, Send to area ▸. Duplicate left it (Ctrl/⌘+D, the bar). **Name and Give control are on the pawn's sheet card** ("Pawn ring", below). **The pawn lock is dropped as a feature** (`docs/NETCODE.md`, "The pawn lock is dropped"): Lock is offered for things, rooms and buildings only, and not at all for a selection with a pawn in it.
- **A room's ☰ lost Room type ▸, Floor ▸, Rename, Replay spawn and Delete.** Room type and Replay spawn are in the command bar ("room type: kitchen", "replay spawn"). **A room's floor is changed by dragging a floor in from the library** (it changes the whole room's floor; "Hand feel"), or by name in the bar ("floor: cobble", "floor: by room type"). **A room is renamed at its own label** ("Labels select rooms and buildings", below).
- **Add stair left the room's ring too.** Stairs, spirals and ladders are placed from the library and switched up or down; a room drawn off the ground floor is offered its stair by a button beside it ("Stairs: place them, switch them up or down"). "add stair" in the command bar still plans one for the selected room.
- **2026-10-13:** Hide / reveal is the third room primary and the first building primary. Show roof remains in the command bar and Space chords; the room’s ☰ is Walls · Fog height · Lock · Height · Faction. Ring geometry and icons remain paused.
- **No empty ☰.** A selection with nothing behind ☰ has no ☰ button (a player at a door: Open / Close and that is all). Before, it opened an empty circle.
- **The cuts were to the ring only. The Space chords keep every entry** (corrected 2026-10-12; the first cut took the chords with it for a day): Space D delete, Space X duplicate (a pawn), Space G give control (it opens the sheet card on "Moved by"), Space N a room's or a pawn's name, Space T room type, Space F floor, Space S add stair, Space A replay, each on the letter it always had. Only a pawn's Space K (lock) is gone, with the feature.
- **In the code:** `engine/client/menu.js`. `MENU` still names every entry (the chord tree is drawn from it); `RING_CUT` names what the ring leaves out (an entry ending in a dot is a whole list), and `RING_NOT_FOR` leaves a command off the ring for some selections only (a pawn's name). `NOT_IN_MENU` is as before: what is in neither.

**What each selection shows now** (a GM unless it says otherwise; counted by `engine/test/browser_rooms.py`, which asserts each row exactly):

| Selection | Closed ring (besides ☰) | Behind ☰ | The entries behind ☰, in order |
| --- | --- | ---: | --- |
| Ordinary object | turn · size · pin (3) | 6 | Replace ▸, Raise / lower, Roll, Rename, Lock, Hide |
| Light (a candle) | turn · size · pin (3) | 7 | Light / Put out, then the same six |
| Openable (a chest) | turn · open · pin · size (4) | 6 | the same six |
| A stair, spiral or ladder | as an ordinary object | 6 | Stairs down / Stairs up in the place of Roll |
| A thing that lights AND opens | turn · open · pin · light · size (5) | 6 | the same six (none in the test inn: by the code, not by a test) |
| Wall piece, door, window | as an ordinary object (a door: with open) | 5 | Replace ▸, Raise / lower, Rename, Lock, Hide (no Roll) |
| Pawn | turn · sheet · damage (3) | 5 | Conditions ▸, Indicators ▸, Raise / lower, Hide, Send to area ▸ |
| Pawn, its owner (a player) | turn · sheet · damage (3) | 3 or 4 | Conditions ▸, Indicators ▸, Raise / lower, Send to area ▸ (when travel is possible) |
| Pawn, another player | sheet · damage (2) | 1 | Indicators ▸ |
| Several pawns | turn · damage (2) | 5 | Conditions ▸, Indicators ▸, Hide, Save as group, Send to area ▸ |
| A pawn with a thing | turn (1) | 1 | Hide |
| Several things | turn · pin (2) | 3 | Roll, Lock, Hide |
| Several lights | turn · pin (2) | 4 | Light / Put out, Roll, Lock, Hide |
| A light with a chest (two kinds of thing) | turn (1) | 4 | Roll, Pin, Lock, Hide |
| Room | turn · re-roll · hide/reveal (3) | 5 | Walls ▸, Fog height ▸, Lock, Height (Taller, Shorter, or Height ▸ for both), Faction ▸ |
| Several rooms | hide/reveal (1) | 1 | Lock |
| Roof | re-roll (1) | 2 | Style ▸, Hide roof |
| Building | hide/reveal (1) | 3 | Roof style ▸, Rename, Lock (generated buildings also keep Storeys and Re-roll) |
| A player at a door | open (1) | 0 | no ☰ |

(Roll joined an object's ☰ the same day, from branch `tilt`: that is why an object still counts 6.) Before the cuts (the design record's table): ordinary object 6, light 7, pawn 10, several pawns 8, room 10 to 12, roof 2, building 5.

### A room's fog height (Harry 2026-10-05: "can we also get that fog-height slider attached to the room menu?")
- A room's ☰ has **Fog height ▸**: a slider at that button, 0 to 8 ft, with a notch at 0 (= no fog), a readout in feet, and **Type default** (back to the room type's own fog: cellars and crypts fog, an inn's rooms don't; `tools/spawn-tuner/data/fog_defaults.json`). It is the tuner's Room-panel control.
- Dragging changes that room's fog live in your own tab only. Letting go sends ONE command, `room.set { fog }`: stored on the room, checked by the relay, seen by every seat, undoable, kept across reloads.
- `fog` is feet; 0 = none; any negative number = the type default (the field is removed); above 8 is refused with the reason.
- AI seats see a room's own `fog` in `state` and set it with `do?cmd=room.set&id=…&fog=…`; the rules card says so.

- **No fog upstairs by default (Harry 2026-10-06: "No fog on 2nd story or higher by default").** A room on its building's second storey or higher has no fog unless it was given its own with this slider, whatever its room type's default is (a cellar-type room built upstairs included). The slider there reads "none (upper storey: none by default)" and its button "Default (none)". Nothing is stored for it: upper rooms that were never set, in campaigns already saved, simply have none now; a room with its own Fog height keeps it. Ground floors and rooms below ground are unchanged. Rule: `fogDefault` in `engine/core/height.js`; test `engine/test/browser_nits_render.py`.

### Drag buttons never lose a release (2026-10-05)
- Harry: "raise is now dropping everything instantly back to the floor. Can't levitate stuff and also can't place it on tables."
- **Cause.** Releasing a raise / lower looks for a surface under the thing with a ray. That ray went through every thing's group with no camera set, and three's sprite raycast throws without one. A thing hidden from players carries a "Hidden" pill (a sprite) on the GM's screen. So while ANYTHING in the area was hidden, every release threw before it was sent: the thing followed the drag, then fell back, and the relay heard nothing. Pawns were not affected. Fixed in `world.surfaceBelow`.
- **Rules for the ring's drags (raise / lower, turn, size):**
  - the pointer is captured, and the end of the drag is heard on the window;
  - the last previewed value is COMMITTED on release, on a pointercancel, on a lost capture, when the window loses focus, and when the mouse moves with no button down;
  - only **Escape** cancels (nothing is sent);
  - nothing can rebuild the ring under a drag;
  - a release that throws, or that the relay refuses ("Refused: … is locked"), is shown in a toast. Never a silent snap-back.
- Unchanged, by design: a thing released within 1.5 ft above a surface lands on it; floor-type things dragged over a table do not rest on it.
- Tested in `engine/test/browser_lift_hard.py` (released far outside the window, over other UI, pointercancel, blur, touch and pen pointers, lost capture, slow drag, fast flick, a rebuild and a relay change mid-drag, Escape, a refused release, a throwing release, turn and size, table landing, reload, second tab). Headless Firefox has no WebGL on the build box and Playwright's WebKit cannot be installed there, so Safari is not covered.

### The handle's track (Harry 2026-10-06, as built)
Harry: "the size-slider... should draw a little track that the handle slides along when you grab it."

- **Grab a drag handle on the ring and its track is drawn**: the path the handle slides along, from the smallest value to the largest, thin and in your seat colour. It is there while the handle is held, fades in about 0.2 s on release (at once with reduced motion), and never catches a click. What the drags DO is unchanged.
- **All three handles are one family:** a thin rail, short ticks at steps (a longer one at the round steps), longer named marks, a dot at the CURRENT value (what a release would commit), the stretch from where it started drawn solid, and the readout chip by the handle.
  - **Resize:** a line along the handle's ray, from the centre outward. A **100%** mark where the handle was grabbed; ticks at 25, 50, 75, 125, 150, 175, 200% and then every 50%. If the thing is not at its catalog size, the grab point is marked **now** and its catalog size is marked **catalog size**. Readout: "171% · 3 ft 6 in".
  - **Raise / lower:** a vertical line through the handle. A **floor** mark at the bottom (**ground** outdoors), a tick per foot with a longer one every 5 ft, and a dashed **lands** mark at the top of whatever is under the thing (where it comes to rest). Readout: "3 ft 6 in up".
  - **Turn:** a circle through the handle about the centre, with the eight 45° notches as its ticks (the caught one heavier) and a mark where the turn began. Readout: "90° ◆".
- **One reusable piece** (`engine/client/surfaces/track.js`, `makeTrack`): it takes the smallest and largest value, the current one, the ticks, the named marks, a formatter for the readout, and a direction (a line between two screen points, an arc, or any function from a value to a point). The ring calls it three times. A pawn's damage handle is its fourth caller (see "Pawn ring").
- **Gemini, blind, mid-drag:** resize: "'100%' ... a visual reference point for the object's default size"; raise / lower: "'lands' ... the height at which it would come to rest ... 'floor' ... the ground level"; turn: "the circular shape, the rotate icon and the angular measurement all clearly signify ... orientation". It called the 100% label slightly noisy over busy props.
- **Choices made for Harry:**
  - the dot shows the value that will be committed, so with Shift (which snaps) it steps along the rail while the handle follows the pointer;
  - a thing within 6% of its catalog size counts as 100% (rooms lay things out a few percent off it);
  - the dashed line from the centre to the handle stays, fainter.
- Test: `engine/test/browser_track.py`.

### Roll is about the VIEW, and rolls add up (Harry 2026-10-12, as built)
Harry, on the first Roll: "great implementation!", and: "I was hoping for roll to always be relative to the current view, rather than fixed to the object. That way you can get the object into ANY orientation while just having rotation and roll, though admittedly it might take a few actions."

- **The axis comes from the camera, at the grab,** and is held for the whole drag: the camera's forward direction **laid flat on the ground**, through the middle of the thing's box. So the thing tips to the left or right **as seen on screen**, like a pilot's roll: drag the handle clockwise and its top goes to the right.
  - Not the true line of sight: from the steep table camera that is nearly vertical, and a roll about it would be the Turn again. **One constant swaps the reading:** `ROLL_AXIS` in `engine/client/commands.js` (`'horizon'` as built, `'sight'` = the true view axis).
  - Looking almost straight down there is no forward left on the ground: then the screen's **up** direction, laid flat, is the axis.
- **Rolls from different views add up.** Roll, orbit the view, roll again: the second roll is about the new view's axis, on top of the first. Turn + Roll reach any orientation (it can take a few goes). A thing therefore carries a whole **orientation** (`quat`, a quaternion; docs/NETCODE.md "Orientation"), with the Turn applied on top as before. The one-angle `tiltZ` of 2026-10-11 is converted when a campaign loads.
- **The hand feel is the Turn's, on THIS gesture's angle from where it started:** free, degree for degree; caught softly (within 4°) in the gesture's **45° notches**; **Shift = 15° steps**; the readout is the gesture's angle. And it also catches at the gesture's **special stops**, marked and named on the track: where one of the thing's own axes would stand exactly vertical (**upright**, **upside down**, **square**) and where its up axis would lie exactly level (**on its side**). A result within about a degree of square is stored exactly square.
  - A stop is offered only when this view's roll can reach it: tipped one way and looked at from the side, no roll brings the thing upright, so no "upright" stop is shown. Orbit, or use the way home.
- **The way home: "Stand upright"** in the ☰ of a rolled thing (and in the bar; chord Space J). It clears the orientation and keeps the Turn. One undo brings the orientation back.
- **Command bar:** `roll 90` = a quarter roll clockwise about the current view's axis (`roll -45` the other way; they add up); `roll 0` and `roll upright` = stand upright. Plain "Roll" (or Space B): a quarter roll, or upright if it is already rolled.
- **Rolls that add up to a plain turn are stored as the Turn** (three quarter rolls can do that), so "upright" stays one thing in the data.
- **Several things at once** each roll about the same axis through their own middles.
- **It still rests where its lowest point was,** in any orientation; brackets, picking, copy, duplicate, raise, re-roll, storeys were re-checked on an arbitrarily oriented thing (`engine/test/browser_tilt.py`, section VIEW). Stairs and ladders still cannot be rolled.
- **Open:** whether Harry meant the true line of sight (the constant above); a roll shows no picture of its axis on screen; the brackets are still an upright box.

### Roll: tipping a thing onto its side (Harry 2026-10-11, as built; the AXIS and the storage below are superseded by the section above)
Harry: "Let's add an option in the hamburger menu for objects that lets you rotate them via 'roll', we don't need pitch, we can accomplish that with the combination of yaw and roll that we will have with this, and it's really only for people getting super fussy."

- **Where:** a thing's ☰ circle (not its closed ring), next to Raise / lower. Things only: not a pawn, a room, a wall piece, a stair (also the stairs and ladders that are furniture: they open the floor above) or a floor tile. The seat needs the same permission as for moving things.
- **What it does:** tips the thing about its own front-to-back horizontal axis, after its Turn. Turn + Roll together reach any pose (a barrel on its side pointing any way, a toppled chair).
- **The button is the Turn's gesture about another axis** (Harry, after trying the first version: "Oh no! Roll needs to be a draggable just like ... (rotate)!"). The same code path as far as the arithmetic goes: the handle rides a circle about the thing, one degree of hand is one degree of roll, it turns **freely**, is held softly (within 4°) in the eight **45° notches** (upright is one of them, so 0 is easy to hit), **Shift = 15° steps**, the readout is the change in degrees with ◆ in a notch, Esc cancels, one gesture = one undo step, other seats see it live.
  - **What was different in the first version (measured on live, 2026-10-11):** it went in 15° steps by default, so nothing moved for the first 7.5° of arc (30 px of hand at its radius; a 12-px drag did nothing at all); Shift meant "freely", the reverse of Turn; a press with under 4 px of movement was a click that laid the thing over 90°; the readout was the absolute tilt; the track had 24 ticks and an "upright" label.
  - **A click on the button does nothing now** (a toast says to drag). The bar's `roll 90` / `roll 0` and the chord (Space B: on its side / upright) remain. Turn keeps its own click (45°).
  - **What only makes sense about the vertical axis, and what was done:** (1) *which way round.* A turn is always seen from above; a roll is seen from either end of its axis, so its sign is taken from the camera at the grab (looking along the thing's front-to-back axis it follows the hand). (2) *several things at once.* Turn swings a group about its middle; Roll tips each thing about its own axis where it stands. (3) *where the handle is.* Turn is on the closed ring (a circle of about 100 px), Roll is in the ☰ circle (about 230 px): the same degrees per degree, but about 2.3 times the hand travel per degree, and one more click to reach. That is the ring's geometry (paused redesign), not the gesture.
- **It rests on what it was on.** The thing turns about the middle of its box, then is raised or lowered until its lowest point is where its lowest point was upright (measured on the mesh itself). On the floor it stays on the floor; on a table top, on that top; raised 3 ft, 3 ft up. Its height in the data does not change.
- **Limits, as built:**
  - **Things sitting ON a tilted thing do not slide or tip:** they stay exactly where they were (in the air where the table top was), still attached, and still move with it.
  - The selection brackets are an upright box round the thing as it lies (not a tilted box).
  - A thing's fire, its open / shut swing and a hanging thing's chain were not looked at tilted.
- **Command bar:** `roll 90`, `roll -45`, `roll 0`, `roll upright`, `roll side` (also `tilt …`, `tip …`), on the selected things. Chord: Space B.
- **The word on the button is one constant,** `TILT_LABEL` in `engine/client/commands.js` ("Roll"; Harry settled it on 2026-10-11, over the "Yaw" in the orbital-menu record). The data field is `tiltZ`, named for the axis, never for the label; a mesh's `yaw` (an alignment correction) is a different thing and is not involved.
- **Icon:** Lucide's `rotate-cw-square` (a square with a curved arrow), a stand-in until the painted set.
- **The library's exhibits lying on a side or their back** use the same code now (they are centred and grounded by it); copied or dragged out they are still placed upright.
- Kept through: move, turn, raise, duplicate, copy and paste (also as text), replace with similar, its room's re-roll when pinned, its room moved or sent to another storey, save and reload. docs/NETCODE.md "Tilt".
- Tests: `engine/test/browser_tilt.py`, `engine/test/browser_shift.py` (the same scripted drag on Turn and on Roll; the short, slow drag), and blocks in `core.test.mjs` and `relay.test.mjs`.

### Shift = snap to steps, everywhere (Harry 2026-10-11)
Harry: "Shift should be 'snap to steps' across the board." The default drag is free; holding Shift snaps.

| Control | Default | With Shift | Changed on 2026-10-11? |
|---|---|---|---|
| Turn (ring) | free, held softly in the 45° notches | 15° steps | no |
| Roll (☰) | free, the same notches | 15° steps | **yes** (it was 15° steps, Shift = free) |
| Raise / lower | free (a pawn: under 5 ft above its base it settles there, docs/PAWNS.md) | 6 in steps (a pawn: 5 ft steps) | no |
| Resize | free | 25% steps | no (its toast said 10%; corrected) |
| Damage | whole points (its unit) | fives | no |
| A room's fog height | a slider; under 0.38 ft it is 0 | no Shift meaning (a native slider) | no |
| A room's height | two buttons (Taller / Shorter) | none | no |
| **A dragged pawn** | **free** | **the middle of a square** | **yes** (it snapped, Shift = free). Harry: "we should flip 'shift to grid' for pawns as well, though I am less sure here", so there is a switch |
| **A figure dragged out of a list** (its placing ghost) | **free** | **a square** | **yes**, same switch |
| **Furniture dragged** | free (as before) | **the half squares, 2.5 ft** | **yes** (Shift did nothing) |

- **The switch:** Settings ▸ Me ▸ Controls ▸ **Pawns snap to squares**: *Only with Shift* (the default) / *Always (Shift = free)* (the rule of 2026-10-06). Per person, kept in the browser (`pawnSnap` in `tw.prefs`). Command bar: "Pawns snap to squares: always (Shift = free)" / "… only with Shift". One function answers for both the drag and the ghost: `app.pawnSnaps(shift)` in `engine/client/main.js`.
- **Left alone, on purpose** (they must sit on whole squares to work, or Shift already means something else there):
  - wall pieces, doors, windows and posts: on the grid, **Shift frees them** (`engine/client/input.js` dragMove and `placementAt` in `engine/client/modes.js`); the same for placing them. This is the one place Shift still means "free";
  - rooms and floor tiles (always the 5-ft grid), stairs (whole squares), things on a table top or a wall (they follow the surface);
  - a pawn placed by CLICK from the pawn tool still lands on a square: there Shift means "keep placing";
  - Shift at the press still adds to the selection; arrow-key moves (one grid square, Shift 1 ft: see "Fog tweaks" at the end).
- **Where position snapping lives:** `pawnSnap` and `thingSnap` in `engine/client/input.js`; the ghost in `engine/client/pawns.js` (`hover`, `placeAt`, `app.pawnFormation(..., { free })`).
- **The `?` sheet** has a line each for pawns (it follows the switch), things, ring handles and wall pieces. The first-visit hint says nothing about snapping, so it was not changed.
- **Tests:** `engine/test/browser_shift.py`. The older suites that drag pawns say which rule they expect, once, after the import: `tw_sandbox.pawn_snap('always')` (`tests/tw_sandbox.py`).

## Build menu and the content taxonomy (Harry 2026-10-03, in progress)
- **Launchers:** 3–4 small one-icon menu launchers float as boxes. The **Build** launcher sits upper-left; **B** or a click flies it out.
- **Taxonomy:** one hierarchical tree, like folders, with **symlinks** for things that belong in several places:
  **Genre** (fantasy, sci-fi…) → **Type** (inn, mansion, dungeon, chapel…) → **Room** (e.g. chapel → rectory) → **Furniture** (pew) → **Object** (book, which may sit on the pew).
- **Stopping at a level gives that level's tool:**
  - a Type drags out a whole building;
  - a Room draws a room;
  - Furniture and Objects place items.
- **How the Build menu flies out (Harry 2026-10-03):**
  - It opens at the **same depth you were at last**, with the **last-used item selected**, beside the cursor.
  - **Ancestors stack above** the cursor, e.g. Genres › Types › Inn › Rooms. Clicking one flies out its submenu, and that can go several submenus deep.
  - **Siblings list below.** Picking one selects it, which activates its tool on the map, and also flies out its children (e.g. the hallway's furniture). Choosing a child is optional, so the UI needs a clear signal that "you can stop here".
  - **Every node has a hotkey letter,** so it chords: **B** (build, at the last spot) → **T** (up to types) → **C** (castle) → **T** (throne room). Menus pop up visually as you go. Experts chord straight through; others look and click. The two modes blend gracefully.
  - **Answer to "you can stop here" (Harry 2026-10-03): the mouse cursor changes, very visibly and with a little animation, whenever a usable tool becomes active.**
    - Genre has no tool, so the cursor stays normal.
    - Selecting a Type (spaceport) turns the cursor into a building-drawing cursor, and its rooms fly out.
    - Selecting a Room (cantina) switches to a room-drawing cursor.
    - Furniture and Objects get an item-placing cursor, ideally showing a tiny turning preview of the item.
    - This needs its own small iconography set, and each switch must animate so the player can't miss it.
  - **Idea under discussion (not decided):** at the Furniture/Object level, instead of a list, a little **placemat** flies out with the actual objects sitting on it (live models). You drag one off the placemat into the world.
  - **Refined (Harry 2026-10-03): sample areas, one per room type.**
    - Fixed, read-only **library areas**, one per room type, each with that room type's assets laid out neatly on shelves, viewed through a **picture-in-picture** window.
    - You drag, or copy and paste, an object out of the PiP into the main view. This reuses machinery that already exists: PiP views of another area, and cross-area copy/paste/transfer.
    - The build menu's current level drives the PiP camera. Choosing "hallway → furniture" flies the PiP to the hallway-furniture shelf.
    - Because it's real 3D at true scale, sizes compare honestly.
    - Meshes load progressively as the PiP camera looks at them.
  - **Revised (Harry 2026-10-04), as built:**
    - **ONE tray** pulls out from the left; its left edge is on the Build button's, and it runs down the screen as far as needed. The levels above sit at the top as a stacked breadcrumb (click one to go back up to it); the current level fills the rest as a **two-column grid** of big icon tiles (64-px painted icons, label under), scrolling. No fly-outs.
    - **The tree is Genre → Type → Room.** The Furniture and Object levels are gone: **picking a room type always pops open its library in the PiP**, and furniture, objects, walls, doors and windows come from there (drag them out, or click, copy and paste).
    - **Outdoors (2026-10-05):** *Fantasy → Tavern & inn → **Yard*** is a room type like the others (painted icon, hotkey Y, a library area with the yard's things and its ground materials first under Floors). It is a room with **no walls**: its ground instead of a floor, open edges, the neighbours' doors opening onto it. The building tool never packs a yard inside a building's footprint: draw it beside the building with the room tool, after the building (a yard is dressed by what stands around it; re-roll it if a neighbour arrives later). Rules: `tools/spawn-tuner/ROOMS.md` → Outdoors.
    - **Key rule:**
      - a plain letter picks an item in the current list; picking an item that has children makes its children the current list, so letters chord downward;
      - **Shift + G / T / R jumps to a level** (Genres, Types, Rooms);
      - arrows move within the two-column grid, Backspace goes up a level, and Enter or Esc closes the tray (the tool stays; a second Esc puts it away).
      - So "B, Shift+T, c, t" is Build → up to types → Castle → Throne room. Level jumps never collide with item letters.
    - **Sticky** ("quiet modality"): B reopens exactly where you left it, per campaign and seat, with that item's tool live (and its library open).
    - **The pointer itself changes with the tool** (CSS cursors, 32 px with a 64-px retina version, hotspot at the crosshair, set on the whole page while a tool is live): building-draw at a type, room-draw at a room, place while dragging a thing out of the library, the ordinary pointer otherwise; Space still shows the grab hand. A badge pops beside it on each switch.
    - **Tools:** a Type is the building tool: the dragged rectangle is packed with the type's rooms (`engine/client/pack.js`) as ONE command, so one undo removes it. A Room is the room tool.
    - **The Build button** is a painted crossed hammer and saw, from the same image route and style as the other icons.
    - **Library areas are knolled** (not shelves): a plain neutral plane; everything in a tidy grid at 90°, spaced by size, in sections per category (centrepieces, furniture, storage, lights, dressing, table and tools, then walls, doors and windows per wall family); seen from above. Each thing lies the way its silhouette reads best from above (a chair on its side, a wall or door on its back). A pick in the library flies the camera to it; meshes load as the camera comes near. Drag-out places the thing upright, with its usual placement rules.
    - **The PiP takes input under the pointer** (every view is a full viewport):
      - Over the PiP the pointer is the **select pointer** (the arrow); the active build tool is suspended, not cancelled, and its pointer comes back over the main view.
      - Click and hover select and highlight there. Wheel zoom, two-finger pan, pinch, Option/middle-drag rotate and F (frame the picked thing) all move the PiP's own camera; Cmd/Ctrl+C copies the picked thing.
      - The library is read-only: Delete, rotate and the rest are inert there.
      - A drag that starts in a view stays with it until release, and a wheel/trackpad sequence stays with the view it started in until ~150 ms of quiet.
      - A drag that starts on a library thing becomes the placement ghost, with the place pointer, as it crosses into the main view.
      - The window chrome (title bar, resize handles, close) wins at its own edges.
      - Keyboard shortcuts go to the view under the pointer, or to the last one clicked.
      - An other-area PiP gets the same camera input. Selecting and acting inside another area through its PiP is **not built yet**.
    - **The library opens zoomed out to frame all of it**; F (or the Build menu) can fly to a thing afterwards.
    - **The tool pointers are painted** (the same image route as the menu icons: a house with a pencil, a carpenter's square, a crate), each with a crisp crosshair at the hotspot. They switch the instant a type or room is picked, even while the pointer is over the tray.
    - **The PiP is a window** (every PiP): drag it by its title bar; resize it from the edges and corners (resize cursors, a minimum size, kept on screen and below the command bar); double-click the title bar for a big window and back; close button. Its place and size are remembered per seat.
    - **Only Tavern & inn has room recipes so far.** The other 15 types are listed but greyed: "no room recipes yet".
- **Mapping to the existing data:**
  - catalog `set:` codes (TAV, NOB, CAS…) ≈ types;
  - room recipes ≈ rooms;
  - catalog placement `furnish`/`store` vs `dress`/`surface` ≈ furniture vs object.
  The catalog's multi-set membership is the symlink mechanism.

## Launchers: Pawns, Build, Settings (Harry 2026-10-04, as built; order changed 2026-10-06)
- **One row, upper left, same box size: Pawns, then Build (hammer and saw), then Settings.** Each has a painted icon from the same Codex route and style anchor (`experiments/2026-10-03-build-icons`: `tool-pawns` is a game pawn, `tool-settings` is a gear).
  - **Pawns is the leftmost (Harry 2026-10-06):** "Lets also swap the build menu and the pawns menu so pawns is furthest to the left." Before, the row was Build, Pawns, Settings. Only the order changed: the keys are still P, B, S. The Build tray still pulls out from the row's left edge; the Pawns tray opens under its own button.
- **One tray at a time:** opening any of the three closes the other two. Esc or an outside click closes it (unless it is pinned: below).
- **Hold, tap, pin (Harry 2026-10-06: "hold tap and pin sound fine"; as built the same evening, `engine/client/surfaces/tray.js`).** One rule for P, B and S:
  - **hold** the key: the menu is shown while it is held (350 ms or longer, or any other key or a click in the menu meanwhile: P + 1 is "show, go to the first player's pawn, gone");
  - **tap** it, or click the launcher: it stays until tapped again, Escape, or a click outside;
  - **pin** (the pin in each menu's corner; remembered in this browser): it stays open while you work on the map. A click outside and Escape leave it; its key, its launcher or its pin closes it. A pinned menu takes letter keys only while the pointer is over it.
  - What this changed: B now closes the Build tray (before, the open tray took B as an item's letter; it still does when the list showing has an item on B). Pinned, Build no longer closes on Escape or Enter. Pinned, Settings loses its backdrop, sits at the right edge, and the map behind it works. Otherwise each closes as it did. docs/PAWNS.md "Opening: hold, tap, pin" has the full list.
- **Pawns** is the Pawns menu (built 2026-10-06, late evening): **docs/PAWNS.md, "The Pawns menu, as built"**. A tray in the Build tray's style, three tiles wide: Mine (my pawns, my bench, "New pawn"), Party (a row per player: portrait, names, damage, conditions, pets, action icons; party notes; drag = marching order), and for the GM The cast, Place a pawn (the tree of minis) and, for everyone, On the table. Figures can still be placed from the command bar (below, "Figures as pawns"); the tree's search button hands over to it.
- **Settings** opens the Settings modal (below), the one exception to the tray pattern. A number on the gear counts players' requests waiting for the GM.
- **Who sees what:** a player who can't build sees Pawns and Settings but no Build button.
- Both are also in the bar, as "Pawns…" and "Settings…". Also in the bar since the Pawns menu: "whisper <name> …", "Party notes…", "New pawn…", "save group <name>" (several pawns selected), "Add to the cast", "Stop following the pawn".

## Figures as pawns (Harry 2026-10-06, as built)
Harry, after seeing the first generated figures: "I also would love to place some figs in here now and play with them. As a baseline, send an agent to sort of repopulate the command bar for the moment." The Pawns menu is designed (docs/PAWNS.md) and not built; until it is, the command bar is how a figure gets onto the table.

- **What Harry types.** Press `/`, type a creature's name, press Enter, click a square.
  - `owlbear` · `elf wizard` · `goblin spear`: a name, a class, a race, a tag, or an SRD monster name ("worg" finds the dire wolf, "baboon" the ape). Also a group: `hero`, `townsfolk`, `foe`, `beast`, `large`. Also a figure's id.
  - `add pawn …`, `place pawn …`, `place figure …`, `mini …`, `spawn …` lead to the same list. "Add pawn…" is a command of its own (found by figure, mini, spawn, creature, monster, npc, token); it fills the bar with "add pawn " and says what to type.
  - **A count:** `6 goblins`, `add 6 goblins`, `goblin x6`. ONE click drops the whole group: the lead on the square clicked, the rest on the nearest free squares, in the same room when they fit. It is one command (one undo). They are labelled Goblin 1 … Goblin 6, and the count carries on from the highest number already on the table.
  - **Shift-click on the map keeps placing**; Shift-click or Shift+Enter in the bar adds a row to the pick. R turns the ghost 45° before the click; Esc puts the tool away.
  - **Or drag the row onto the map** ("Dragging a figure out of a list", below).
  - `plain pawn` places the old stand-in.
  - **Change figure:** select a pawn (or several), type `change figure dire wolf`. `remove figure` goes back to the stand-in.
- **In the results** each figure row has its small picture (the gallery's thumbnail), its group, race and class, its height, and "large: 2 × 2 squares" when it is. At most 8 figure rows are drawn, so at most 8 pictures are fetched; the list itself is data and no mesh is loaded for it. A search of the whole list takes about half a millisecond.
- **Figure scale (2026-10-12; Harry: "The minis are mostly too big. To scale a hero/guard to a chair correctly I have to make the chair about 150% size").** One factor on every figure, a house look: **0.67** built in (`FIGURE_SCALE` in `engine/client/figures.js`), changed in the tuner's **Figure scale bench** (`figures.html`, linked from the Spawn Tuner's "Figure scale" panel): a slider, a hero, a guard and a townsperson by a chair, a table, a door and a bed, each figure's height in feet, a ring at the back of its knee to hold against the seat, and "Use in game" (house look `figures` = `{ scale }`; the game reads it on load).
  - **What shrinks:** the figure only, about the middle of its base, feet still on the disc. Large creatures and beasts keep their size relative to a person (the factor multiplies all). The floating label follows the head down.
  - **What does not:** the base (one square, 4.5 ft across, 0.3 ft thick), the name on it, the facing mark. The base is the pawn's size in the rules: rulers, templates ("who is caught"), reach and snapping use it and never the drawn figure, so none of them change. Picking and the selection brackets follow what is drawn (figure and base).
  - **What was measured** (`experiments/2026-10-12-figure-scale/`): the figures were NOT taller than stated (a 6 ft fighter is 6.2 ft sole to crest). They are heroic miniatures, about a third wider than a person, on a 0.3 ft disc, beside chairs at their catalog 3 ft whose seats are at 1.3 ft and small tables whose tops are at 1.9 ft. By the knee-to-seat measure the factor is 0.8; Harry's eye (and Gemini's blind reads, 0.6 to 0.7) says two thirds. At 0.67 a 6 ft human is drawn 4.2 ft and doors (6 ft 8) look tall.
  - Tests: `tools/spawn-tuner/test/figscale_ui.py` (bench, sandboxed "Use in game"), `engine/test/browser_figs.py` (heights are stated × scale).
- **The pawn.** A pawn can wear any published figure. It is pawn data (`fig`, and `size` for a large one), so every seat sees the same figure and an AI seat can place one by figure id (docs/NETCODE.md). A pawn with no figure is the old stand-in, stored and drawn exactly as before.
  - **Scale:** each figure stands at its stated height (a goblin 3.5 ft, an owlbear 8 ft, a hill giant 15 ft).
  - **Squares:** a pawn fills one 5-ft square. A creature on a 10-ft base (the manifest's `base_ft`) covers 2 × 2 squares and stands where the four meet; it drags from crossing to crossing, and the squares it will take are lit under the ghost.
  - **The name** is the figure's name up to its first comma or bracket ("Goblin, spear" is "Goblin"); it is lettered on the base (below). Rename from the pawn's ☰, or F2.
  - Select, the ring, snap, Shift for a free move, the arrow keys, R, stairs and height, raise / lower, hide, damage (it was HP until the pawn ring landed the same day), conditions, duplicate, copy and paste, delete: all as on the stand-in.
- **The base (Harry 2026-10-06: "disk with the colored rim").** Built by the engine, never in the mesh ("No bases, let's add the bases ourselves afterwards in engine by default").
  - A low dark disc, 0.3 ft thick, 4.5 ft across in a 5-ft square (9 ft for a large creature).
  - **The rim is the owner seat's colour** and follows it when that seat changes colour. A pawn that is nobody's (the GM's to move) wears the colour of the seat that placed it.
  - The figure's lowest point is put exactly on the disc's top, from the mesh that was actually loaded (measured in the test: 0.000 ft).
- **Facing.** The pilot's small arrow was "barely" visible at table distance in every blind read. Now the mark is one bold arrowhead in a contrasting tone (pale; dark when the seat colour is itself pale), from under the figure's feet out through the rim to a point 0.5 ft beyond the disc. Seen from above the base is a pointer. The rim is also open at the back.
  - **Gemini, blind, one pawn at a time cut from the table-distance shot (base 59 to 126 px across):** fighter "facing down ... the white triangular mark on the base"; wolf "left ... clearly indicated by ... the white triangular marker"; owlbear "down-left ... the large white triangular arrow on its base"; goblin "right ... the large white triangular pointer"; wizard (facing away) "up", from the body; smith "right", where the truth is up-right. Five of six exact, one 45° off.
  - **What does not work:** a figure facing AWAY from the camera hides its own arrowhead behind its body (a 6-ft figure covers 3 ft of floor behind it at the table camera). Gemini read those from the body and did not remark on the open rim at the back. And asked about all six pawns in ONE whole-table picture, Gemini called the mark "obvious" but named most directions wrongly, with or without figures standing on the bases; so that reading is not a usable test of the mark.
- **Detail (Harry 2026-10-06):** "5k is light for the heros, 20k would probably fly"; "lets kick hoard monsters and townsfolk up to like 8k, that little boost helps a TON." Heroes and large creatures load at about 20k triangles with a 1024 px picture, townsfolk, beasts and horde monsters at about 8k with 512 px (the two tiers the set already cuts; the set marks which each figure takes).
  - **Lazy:** a mesh is fetched when a pawn on the table wears that figure, and never before.
  - **Cost on the build box** (RTX 3060, shared with other jobs at the time, 1400 × 900, the lighting stack on, different figures, a third of them heroes; frame cap off):

    | figures on the table | download | texture memory | frame time (median) |
    |---|---|---|---|
    | none (two rooms) | | | 4.0 ms |
    | 5 | 3.6 MB | 15 MB | 4.0 ms |
    | 20 | 14.4 MB | 59 MB | 4.7 ms |
    | 60 | 38.5 MB | 158 MB | 12.7 ms |

    With the frame cap on, all four hold 60 frames a second. The same figure twice costs its file once.
- **How many, and how the list refreshes.** 518 figures: the whole default set (168 heroes, 118 townsfolk, 154 foes, 27 beasts, 51 large). When more are published: `python3 tools/spawn-tuner/build_figures.py` (it reads the published set, never writes there; `--check` says what would change), then `tools/spawn-tuner/deploy.sh`. The deploy gate checks every file the list names. Figures are a list of their own (`tools/spawn-tuner/data/figures.json`, `assets/figures/`): they are not in the furniture library, so room generation, the Build tray and "replace with similar" never see them.
- **Choices made for Harry (each easy to change):**
  - a creature's name alone is enough in the bar (no verb needed); the alternative is figures only after "add pawn";
  - a count drops the whole group in one click, in a block round the square; the alternative is one click per pawn;
  - the label is the short name, numbered only in a group or when the name is already on the table;
  - nobody's pawn wears the placing seat's colour on its rim; the alternative is one fixed "GM" colour;
  - ONE tier per figure, by its kind; the Graphics setting does not change figures yet;
  - a large creature stands on a crossing (its 2 × 2 squares), not on a square's centre;
  - the facing mark reaches 0.5 ft into the next square;
  - the back of the rim is open as a second cue; the alternative is a second mark there.
- Gemini's prompts and answers: `experiments/2026-10-06-figs-in-game/`.
- Code: `engine/client/figures.js` (the list, search, base, figure, measuring), `engine/client/pawns.js` (the pawn tool, groups, names, change figure), `surfaces/bar.js` (`figureQuery`, the Figures section), `core/commands.js` (`fig`, `size`), `relay/figures.js` and `relay/llm.js` (AI seats), `tools/spawn-tuner/build_figures.py`. Test: `engine/test/browser_figs.py` (192 checks; `--shots DIR` takes the pictures above, `--cost` the table).

### The name on the base (Harry 2026-10-06, as built; expect it to change)
Harry: "lets start by putting it at their feet, on the base, curlling around the outside edge. far from sure but we can explore as we go." He expects to "end up tweaking it pretty hard".

- **A figure pawn's name is lettered on its base**, lying on the disc just inside the rim and following its curve, in pale letters with a dark outline on a dark plate (so it reads where it crosses the facing mark). It does not touch the rim, so the owner's colour is whole.
- **It replaces the floating label for figure pawns.** What still floats over the figure is only what the base does not carry: damage ("3 dmg"), conditions, the GM's Hidden mark. A plain pawn keeps its floating label.
- **It stays toward the camera:** the lettering slides round the base so it is always on the side nearest you, whichever way the pawn faces (the facing mark turns with the pawn; the name does not). The other way, fixed at the back of the base and turning with the pawn, is one switch.
  - Chosen by the blind reads: fixed at the back, Gemini saw no text at all on five of six pawns at table distance (the figure stands in front of it).
- **A long name** is squeezed to 70% of its width, then cut with an ellipsis. It never takes more than 210° of the circle.
- **In the bar:** "Pawn names: float over the figure" / "on the base", and "Pawn names: fixed to the base" / "stay toward the camera" (this browser).
- **Every choice is one parameter in one place** (`NAME_ON_BASE` in `engine/client/figures.js`: on, where (disc top or the rim's face), faceCamera, at, height, largeScale, inset, arc, minScale, color, outline, plate, font, upper, lift). `tw.figures.setName({ height: 0.8 })` reletters every pawn at once; a tuner panel can sit on it without a rewrite.
- **What Gemini could and could not read** (one pawn per enlarged crop; `experiments/2026-10-06-figs-in-game/`):
  - **At table distance (a base 60 px across): nothing.** Not at 0.62 ft letters, not at 1.0 ft, not on the rim's face. It wrote "????????", or a word guessed from the figure ("GOBLIN").
  - **Leaning in (98 px):** 1.0 ft letters on the disc were read exactly, 3 of 3 ("Brakka", "Grishnak?", "Old Tom Hobb"); 0.62 ft, 1 of 3; 0.55 ft on the rim's face, 2 of 3. So 1.0 ft is the default.
  - The first version was mirrored. Gemini's read said so ("ddoH meT blO ... the text appears to be mirrored"); the test now measures that the line starts at the left.
  - **So, as it stands, a pawn's name cannot be read from the table camera at all.** The floating label could. That is the first thing for Harry to look at.

### A player's main pawn wears the full-detail figure (Harry 2026-10-06, as built)
Harry: "I'm wondering if we can't do very high faces for the like 5 player models we will actually have, and anything that places them that isn't a PCs main avatar gets like the 20k or 8k version."

- **"Make this my main pawn"** in the bar (also: main pawn, my character, avatar, full detail), with the pawn selected. A player marks her own; the GM marks anyone's. **One per player:** marking another unmarks the first, in the same command (one undo puts both back). It is stored on the pawn (`main`).
- **A main pawn loads the ORIGINAL mesh as published** (about 50k triangles, a 2048 px picture, 2.8 MB on average), whatever its group. The same figure placed as anything else keeps its tier (20k or 8k). A copy of a main pawn is not a main pawn.
- **It never waits:** the game tier is on the table at once and the original is swapped in when it has arrived. Measured before and after the swap: height 6.223 ft, then 6.209 ft; its middle within 0.02 ft; its lowest point on the disc both times (0.000 ft).
- **Cost, five heroes on the build box** (RTX 3060 shared with another job, 1400 × 900, frame cap off; frame times within the noise of each other):

  | | triangles | download | texture memory | frame: table | leaning in | first person |
  |---|---|---|---|---|---|---|
  | five at the 20k tier | 100k | 5.7 MB | 27 MB | 3.2 ms | 3.8 ms | 4.1 ms |
  | five main pawns | 242k | 20.2 MB (the tier first, then 14.5 MB of originals) | 133 MB (both kept) | 4.2 ms | 3.9 ms | 3.4 ms |

- **Can it be seen? Gemini, blind, same camera, two pictures:** leaning in, "absolutely identical"; in first person it told them apart side by side by one figure's mouth ("more three-dimensional depth and definition") and picked the original as better made. "Not obvious at a glance."
- **The originals are part of the game's deploy now:** `build_figures.py` copies all 518 into `assets/figures/full/` (1.43 GB; a copy, so the game does not depend on the USB disk the set lives on) and the deploy gate checks each one.
- **Choices made for Harry:** the tier's textures are kept in memory after the swap (dropping them would save about 5 MB a pawn); a pawn nobody owns can be marked too; "one per player" is counted within an area.
- Test: `engine/test/browser_figs.py`, sections NAME and MAIN.

## The command bar, brought up to date (2026-10-06)
An audit of the bar against everything the game can do today. 254 commands were registered; 40 were added (294). Since then the pawn ring's branch and the name and main-pawn switches brought it to 307. The test walks every one of them, for every kind of selection (1,580 command × selection pairs): each is found in the bar by its own title wherever it applies, and each runs without an error.

| Area | The bar already had | Added 2026-10-06 | Left out, and why |
|---|---|---|---|
| **Pawns** | HP −5 / −1 / +1 / +5, the ten conditions, typed `-7` / `+5`, rename, turn, raise / lower, lock, hide, delete, "Pawns…" | **Add pawn…**, the figure list itself (name, count), **Add a plain pawn**, **Change figure…**, **Remove figure**, **Clear all conditions** | giving a pawn to a player, damage, the sheet, indicators: the pawn-ring branch (`pawns`) brings these with their own commands |
| **Edit** | undo, redo, cut, copy, paste, duplicate, delete, select all, parent / children, nudge, turn, raise / lower, resize | | |
| **View** | shortcuts sheet, frame, reset view, zoom in / out, walls, selection style, light / dark, labels, ping, FPS meter, close / swap picture-in-picture | **Turn the view left / right**, **Open picture-in-picture (this area)** | zoom to the map or table detent: no such function to call yet |
| **Levels** | level up / down, back to the ground, all levels / this level only, look into this room, cut to my pawn's level, roofs on / off | **Go to level…** (typed: `level 2`, `lv -1`) | |
| **Things** | open / close, pin, light / put out, hide / reveal, lock, replace with similar, rename; every catalog thing and floor tile under Place | | |
| **Rooms** | build each of the 38 room types, re-roll, turn, room type ▸, walls ▸, floor ▸, fog height, taller / shorter, add stair, replay spawn, show roof, rename, delete | **Build a whole building** (6 types: the Build tray's Type level) | water (rivers, ponds): there is no draw tool yet |
| **Roofs** | style (5), the building's style, re-roll, hide | | |
| **Areas** | new area, visibility (3), send selection to an area, go to an area, picture-in-picture of an area | **Lighting here** (house look, day, night, deep night, flat daylight), **grid on / off**, **players' moves locked / free**, **players may touch / nothing**, **Rename this area…** | delete an area: Settings asks twice before deleting, the bar would not |
| **People** | invite a player, create an AI seat, undo someone's last action, go to a person | | revoke a seat, copy an invite link again: in Settings ▸ Campaign admin (they need the seat list) |
| **Settings** | "Settings…" | **Settings: World navigation / Me / Area settings / Global defaults / Campaign admin**; **Reduce motion**, **Levels fly away**, **other people's cursors**, **announcements** (each on / off); **Scroll wheel** auto / zoom / pan; **Graphics quality** low / medium / high; **Reset my settings** | the sliders (zoom and rotate speed, ring size, text size, volumes) and name and colour: open Settings ▸ Me; snapshots, export, import: "snapshots" or "export" finds Settings ▸ Campaign admin |
| **Talk** | say, roll, newest offer in the chat | | |
| **Help** | replay intro | | |

- **Stale or broken, found by the audit:**
  - **"Replay spawn animation" threw an error** (it called a function that no longer exists). Fixed: it replays the room's walls and furniture.
  - **"Dusk light (later)" and "Torchlight (later)"** were dead cue rows; lighting is a real command now ("Lighting here: night"). "Rain (later)" stays as the one weather stub.
  - "Show only the level I am on" was also found by "show all": that synonym is removed.
  - Still stubs, shown greyed with "(later)": condition / age, fill, break, contents, description and notes, initiative, vision, enlarge / reduce, character sheet, add a door, ask the assistant. **"Elevation (later)" is stale**: raise / lower does it. Left in place because the pawn-ring branch is rewriting those lines.
- **New entries follow the one pattern** (`engine/client/commands.js`, the block "THE BAR, BROUGHT UP TO DATE"): data, synonyms, a permission class, `toggle:` for the on / off ones (so the row names what it will do now), `parse` and `chips` for the typed ones.
- Test: `engine/test/browser_figs.py`, section AUDIT.

## The bar's catalog, redone (2026-10-20; Harry: "a nice thick update for the quickbar catalog")
- **The words live in one table:** `engine/client/barwords.js` (COMMAND_WORDS by command id or `prefix*`, CATALOG_WORDS and MATERIAL_WORDS by catalog id, FIGURE_WORDS by figure id), applied once every surface has added its commands. Titles, keys and permission classes are untouched; a word never widens who sees a row.
- **The match** (`surfaces/bar.js` score): a whole line that is a title or synonym first; then every word found somewhere (a filler word, "make it dark", "open the door", counts only where it starts a text); plurals tried singular; one typo forgiven on whole words ("lanturn", "chappel"), replacing the old letters-in-order match that ran through descriptions; a catalog description counts three quarters; the title itself ("pawns" → Pawns…) gets the title bonus.
- **New typed rows:** "give to Mira" (the selected pawn), "move / travel to the dungeon", "7 damage" / "take 10 damage" / "hurt 5" / "heal 5", "roll stealth" / "roll a strength save" / "roll athletics +4" / "roll 1d20+5 stealth" (a d20 with the check as its reason), "make him an orc". New commands: **Label lab** and **Ring Lab** (open and leave `?labellab=1` / `?ringlab=1`).
- **Test:** `engine/test/browser_barcat.py` types the 631 lines of `engine/test/bar-corpus.json` into the real bar for a GM and a player seat (hit@3 1.000, hit@1 0.964; origin/main 0.758 / 0.685) and checks a player is never offered a GM-only row, a room name or a hidden thing. Inventory, numbers and how to redo it: `experiments/2026-10-20-bar-catalog/README.md`.

## Labels select rooms and buildings (Harry 2026-10-03, supersedes "click the floor")
- Clicking the floor to get the room proved confusing in practice. Instead, **rooms made with the room tool get a label** ("Common room", "Kitchen"), and **clicking the label selects the whole room**. **Generated buildings get a building label** that selects the whole building. Floor clicks go back to selecting nothing, or the floor itself.
- **Labels are renamable** by the GM (or whoever may edit rooms).
- **Visibility:** the GM (and anyone who can alter rooms) sees labels and can toggle them. **Players who can't alter rooms never see them**, and the relay filters them so nothing leaks: a label like "Secret vault" must never reach a player's client.
- **Label styling needs real design care**: legible at table zoom, quiet, not clashing with the world, no collisions when crowded.
- **As built (revised 2026-10-04):**
  - a room's title floats over the room's centre at roof height (screen-facing, always readable); a building's over the building's centre, a little higher; a label right over a pawn fades (and lets the pawn's clicks through) instead of moving; labels never sit on the PiP window;
  - labels are quiet pills; the building label carries a house icon;
  - on a crowd, the bigger thing keeps its place and the others nudge, then step aside; selection never reorders them, so a label stays under the pointer;
  - F2 renames (`room.set {name}`, `building.set`). Since 2026-10-05 (storeys, Stage C) a double-click on a ROOM's label sets the cut instead (see "The cut"); a building's label still renames on a double-click;
  - **the label is where a room is renamed (2026-10-11; Rename left the room's ring).** Double-click the label of the room that is ALREADY selected, or press **F2** with the room selected (the key that opens a pawn's Name row), and its name is typed in place; "rename" in the bar and Space N open the same field. A double-click on the label of a room that was not selected still looks into the room. Enter or leaving the field saves, Escape does not, and an unchanged name sends nothing (no empty undo step). The same seats as before may do it (those with the `room` class); the label's hover says how. **Enter is not rename:** it steps into the room's children, as on every selection (Shift+Enter: the parent). For one day, 2026-10-12, Enter renamed a room; that was reverted the same day;
  - the floor selects nothing, but a room selected by its label can still be dragged by its floor;
  - the relay strips room and building names for seats without the `room` class, everywhere: snapshots, log entries (including undo inverses) and the GET API (`engine/core/labels.js`).
- **No blinking (Harry 2026-10-06: "We are getting 'blinks' on some of the room labels when they are on the edge of shouldn't-show / should-show situations"):**
  - the cause: a label with no free place was removed from the layout, so on the next frame it measured as nothing, fitted, was shown, measured its real size, did not fit, and so on every frame, with the camera standing still. It happened wherever labels crowd;
  - a label that is not showing now keeps its size and fades (150 ms) instead of vanishing;
  - a label keeps its place until its box is 2 px into a more important label's (or the PiP window's); to arrive it needs 4 px clear. At the window's edge it arrives 40 px out and leaves 90 px out;
  - a label changes between shown and hidden, or steps to another place, at most once in 450 ms;
  - test: `engine/test/browser_nits_render.py` (slow zoom out and in, slow pan off the edge, slow pan under the PiP, standing still at every stop).
- **Bigger and a little see-through (Harry 2026-10-05):**
  - a room's label is twice the size (24 px, was 12) at 82% opacity; it goes fully opaque under the pointer and when its room is selected;
  - the building's tag keeps its old size (13 px). Doubled as well, it pushed its own rooms' labels off the screen;
  - a crowded label has more places to step to (thirteen, was five) before it gives up and steps aside.
- **The label is the room's handle (2026-10-05):**
  - hovering it shows the room's hover look;
  - pressing it and dragging moves the room (see "Rooms: turn, drag, hide");
  - a hidden room's label wears an eye-off mark, in the hidden violet with a dashed edge.
- **The label look and the Label lab (Harry 2026-10-20: "I want to play with their size, scaling and position a little"; and "the label should never get to more than 75% of the room width on screen ... so when you zoom out a bunch you don't end up with a label jumble"):**
  - every number above is now the **label look** (`engine/client/labels/look.js`): `TODAY` is exactly the look described above. The game reads the house value `labels` (GET /tuner/house) for every seat that sees labels; with none, `labels.js` takes no look at all and draws as before (proved side by side against origin/main, boxes and pixels: `tests/browser_label_lab.py` TODAY);
  - **`?labellab=1`** on the game opens the **Label lab** drawer (button top right) over the live table; with no seat it opens this browser's reusable **Label lab · design table** (a crowded street of small buildings, a three-storey mansion, loose rooms from a 2×2 closet to a 10×8 hall, three pawns);
  - the drawer (the Ring Lab pattern, `engine/client/lab/kit.js`): **Size** (text size in px, or in ft with "Size the labels in the world (ft)" and its comfort band, smallest / largest px; building label size relative to rooms; "Never wider than (% of the room on screen)"), **Position** (height above the floor, the building label's extra height, nudge sideways / forward in ft), **Look** (opacity, padding, corner roundness), **When** (fade out farther than X ft from the camera, fully gone at 1.3 X; only building labels farther than Y ft; hide room labels when Roofs are on). **Advanced:** "Hide below (px text)" and the crowd rules' numbers (step distances, 4 / 3 px to arrive, 2 px to be pushed out, 40 / 90 px at the window's edge, 450 ms, the pawn fade's 6 px);
  - text size, in order, the smallest wins: the size (px; or ft × px-per-ft at the label, held between the band's limits), × the building ratio, then the cap: the label's width at most X % of its room's (a building's: the building's) width on screen, measured across the footprint at the label's height. A capped label shrinks its text, never truncates; under "Hide below" it fades out by the same no-blink rules (each distance rule leaves a little later than it arrives);
  - the lab starts from this browser's unsaved draft, else the house labels, else the built-in **Starter** (today's look with the building tag ×1.35 of a room's, the 75 % cap, hidden below 9 px), and says which. Presets: Starter, Today's labels, World-sized (2 ft, 12–36 px). **Use as default** posts kind `house`, data `{labels: {name, by, savedAt, version, settings}}`: only that field; Undo / Redo / Revert / ↺ as in Ring Lab;
  - a look changes only numbers and CSS variables (the `.lb` class, `style.css`): click, double-click, F2, drag, the hidden mark, the fade over a pawn and the anti-blink rules are the same code at every setting; players still never see labels.

## Rooms: turn, drag, hide (Harry 2026-10-05, as built)
- **A selected room looks selected the way a thing does.** It wears the house selection look (chosen in the tuner's Selection lab, preset harry-v1), drawn round the room's volume: its floor rectangle out to the walls' outer faces, floor to wall top.
  - Selected: corner brackets top and bottom, breathing at 0.4 Hz, showing faintly (10%) through whatever is in front.
  - Hover on its label: the footprint outline, 2 px.
  - Hidden from players: the tint wash on its floor and walls.
  - It is the same code as for things (`tools/spawn-tuner/js/fx/selection.js`); there is no second style.
- **Turn.** A selected room's ring is **turn · re-roll · ☰**. Turn (or **R**; **Shift+R** turns back) turns the room 90° clockwise about its centre.
  - The turned room is snapped back onto the 5-ft grid. Two turns are an exact half turn; four bring it home.
  - **Nothing is re-rolled.** The room's furniture is stored as things, not worked out again from its seed, so everything turns with the room exactly as the user left it: what they moved, added, pinned or deleted, painted floor tiles, edited walls.
  - The room remembers how it stands (a turn of 0 to 3), so its own outside door stays on the same wall of the room.
  - Walls, doors and windows re-form against the new neighbours, as they do whenever rooms change.
  - **A turn that would overlap another room is refused, visibly:** a red message naming the room, and the would-be footprint flashes red. Nothing changes.
- **Drag.** Press a room's label and drag (or drag a selected room by its floor). The room snaps to the 5-ft grid.
  - While dragging, the whole room rides along (floor, walls, everything in it) and its footprint shows where it would land, with a readout ("25 × 15 ft · 30 ft east").
  - The footprint is your seat colour when the drop is valid and **red when it would overlap another room**; the readout says which room. A red drop is refused with a message.
  - Other seats see the drag as it happens: the room's footprint in the dragger's colour, with its things riding along.
  - A building drags as all its rooms.
- **A thing belongs to the room it stands in.** Dragging a thing into another room makes it that room's, so it turns, moves and hides with it.
- **Re-roll is a die.** The room's re-roll button shows one die (five pips).
- **Hide.** ☰ ▸ **Hide from players** (the toggle then reads **Reveal to players**) hides the WHOLE room: walls, floor, everything in it and its label.
  - Players, and players' AI seats, receive nothing of a hidden room. The relay filters it: not the room, not its things, not its wall edits, not its id. A building with no room a player can see is not sent either.
  - The GM sees a hidden room in the hidden treatment (see-through, with the tint wash), and its label marked.
  - Anything put into a hidden room is hidden with it. A hidden room stays hidden when it is turned, dragged or re-rolled.
  - **The wall it shared with a visible room:** to players that wall is simply the visible room's own outside wall, whole. There is never a hole into nothing. It can carry a window, or that room's outside door, exactly as if the hidden room had not been built.
  - **The GM sees visible rooms exactly as players do**, so both agree on every door and window they can both see. The connecting door to the hidden room is not drawn while it is hidden; it appears when the room is revealed.
  - Hiding a building hides its rooms.
- **All of it goes through the command registry** (`room.rotate`, `room.move`, `entity.flag`), so undo, the relay, other clients and AI seats all get it. An AI seat that hides a room id gets the whole room hidden.

## Overlapping draws make L-shaped rooms (Harry 2026-10-05, as built)
Harry: "If I drag out a new room that overlaps, we are just going to make whatever sections of it *don't* overlap into a room; this will probably mostly cause L-shaped rooms."

- **While you drag out a room with the room tool, the squares that will actually become the room light up** in your seat colour. Squares you asked for that another room already stands on get only a small red mark. A readout says what you will get ("500 sq ft: the part that does not overlap Kitchen").
- **What the drag becomes:**
  - **Clear ground:** the rectangle, as always.
  - **Over a room's corner:** an L. One room.
  - **A room poking into one side:** a U, or a rectangle with a notch in that side. One room.
  - **Right across a room, which cuts the drag in two:** the LARGER part becomes the room (if they are equal, the part the drag started in), and the message says so ("Storeroom cut it in 2: made the larger part (250 sq ft). Drag again for the other"). One drag makes one room: one undo, one label, one room type. The smaller part is a second drag.
  - **Wholly inside another room:** nothing to make. Refused, with a message.
  - **Right round another room** (the drag would enclose it): refused, with a message. A room cannot have a hole in it yet.
- **An L-shaped room is one room in every way.**
  - Floor on exactly its squares; walls, doors and windows along its true outline, with a post at the inside corner; where it wraps another room, the two share the inside corner's walls like any neighbours.
  - Its label floats over the largest rectangle inside it, so it is over its own floor and never over the notch.
  - Selected, it has a bracket at each of its corners, the inside corner too; hovering its label outlines its true shape.
  - Its fog height applies to its true shape.
  - It turns (R), drags by its label, hides, re-rolls, copies and pastes like any room, keeping its shape. Another room may be built in its notch.
- **Furniture.** The largest rectangle inside the room is furnished as the room it is (a guest room's beds, a common room's hearth). The rest (an L's leg) is furnished as more of the same room, without a second bed or hearth. Where the two meet, a strip is kept clear so the room stays one walkable space. Nothing is ever placed in the notch, and things stand against every real wall, the inside corner's two walls included.
  - This follows Harry's rule for odd-shaped rooms (docs/VERTICAL.md): the largest rectangle that fits inside is "the room"; the rest only has to look lived in.
  - What it does poorly: the leg has no centrepiece of its own; a small leg can come out crowded; a kitchen fills its walls so thoroughly that a far corner can be awkward to reach. Move things by hand, or re-roll.
- **The building tool never clips.** A whole building still needs clear ground for its rectangle.
- **AI seats** (the GET API): `room.spawn` with `clip=1` makes the part of the rectangle that does not overlap existing rooms; `outline=[[x,z],...]` gives a shape outright; `state` reports a shaped room's outline in feet.
- **How it is stored.** A room keeps its bounding rectangle (x, z, w, d) and, only when it is not that whole rectangle, an outline: its corners as grid points. Campaigns saved before this load unchanged. Code: `engine/core/footprint.js`.
- **The lit squares are a reusable indicator** ("which squares will this take"), meant for the upper-storey build mode too. Code: `AreaWorld.showCells` in `engine/client/world.js`.
- **Later** (docs/VERTICAL.md): outlines with slanted edges, for towers and ships. The stored outline is already a polygon, so that is an extension, not a change of format.

## One level, and the level meter (Harry 2026-10-06, as built)
Supersedes, where they differ, "Building on levels" and "The cut" below (kept as the record of 2026-10-05). Code: `engine/client/surfaces/cut.js`, `main.js` ("THE LEVEL"). Tests: `engine/test/browser_cut.py`, `browser_storeys.py`.

- **Harry:** "The build menu is not the place for build level selection... we should just build on whatever level the level is set to. I do like [ and ] for moving up and down levels unless you have a better idea."
- **There is one level.** Each seat is always ON a level (a floor height; the ground, lv 1, until you choose another). It is the level the meter marks, the level `]` and `[` move, the level the view is cut to, and the level a room or building tool draws on. Yesterday `[` `]` meant "build level" with a room tool and "view level" without; that double meaning is gone.
  - **`]` up, `[` down**: one storey of the building in focus, onto ANY level in the meter's range, built or not. An empty level above is where a new storey starts; an empty level below is where a cellar starts. A short message names the level ("lv 3 · nothing built here yet").
  - **You build where you are.** Pick a room or a building type and drag: it is made on the level you are on. The ghost grid and the lit squares show there. The Build tray has no level control.
  - Off the ground a room must still stand on rooms below (or up to two squares out): a drag over nothing is refused with the same message as before.
- **"All levels" is a separate switch.** It shows every level and does NOT change the level you are on: you still build there, and the meter still marks it. `\`, the meter's cap, or "all levels" / "this level only" in the bar toggle between all levels and the level you are on.
  - A new seat starts on the ground with all levels showing, so every saved campaign looks as it did.
  - Going to a level (a step, a click on the meter, a double-click into a room, "Cut to lv N") turns "all levels" off: you see that level and what is below it.
- **Double-click**, as decided 2026-10-05:
  - a spot in a room, or a room's label: you go to that room's level (a tall room: the cut is at its own ceiling, so its balconies show);
  - open ground: all levels show; the level you are on stays;
  - **and it centres** (below, "A double-click also centres").
- **The pawn still only OFFERS** "Cut to lv N"; pressing it puts you on that level. **Zooming all the way out offers nothing any more**: roofs are the top of the meter (below, "Roofs: the top of the meter").
- **The pin is gone.** A pinned and an unpinned cut behaved the same in every way but the mark, since a double-click overrode a pin; now every choice simply stays until the next one. Nothing else writes the view (the test still proves it from the write log).
- **The level and the cut are remembered** per campaign, seat and area in this browser. A cut saved before today comes back as the level it showed.
- **(Settled later the same day: `[` and `]` are only level keys; a pawn's keys are `=` and `-` for damage. See "Pawn ring".)** As it stood then: **with a pawn selected, `[` and `]` are still that pawn's HP**, and `{` `}` (Shift) step levels. Not changed: Harry is designing pawn keys. **It is a clash**: the same keys do two unrelated things depending on what is selected, and with a pawn selected the plain level keys silently do something else. Suggested: move HP off the brackets (for example `-` and `=` / `+` with a pawn selected, which read as minus and plus) so `[` `]` always mean level.

### The level meter (Harry 2026-10-06)
Harry: "Let's start by making the level-cut into a vertical meter on the left. It should be tiny, and the entire height of the screen, with little notches for level pre-set. Assume like 5 stories up and 6 stories down."

- **A slim rail down the whole left edge** (20 px), top to bottom of the window. It replaces the bottom-centre indicator.
- **A notch per storey**, highest at the top: 5 above the ground storey and 6 below it (lv 6 down to lv -6), counted in storeys of the building in focus. If the area has rooms beyond that, the rail grows to hold them plus one spare level at each end.
- **What it shows, without hovering:**
  - the level you are ON: a small marker with its number ("2", "1", "-1"). Always there, so which level you are on is always visible;
  - which levels are SHOWING: a lit strip along the edge beside them. The whole rail is lit with all levels on; with the view cut, only the level you are on and those below, in the accent colour, and the marker goes to the accent colour too (people forget a cut is on);
  - which storeys have rooms: a heavier notch. The ground has a longer one;
  - the cap near the top is "all levels": lit while every level shows; above it, the roofs mark (below).
- **Click or drag on the rail** to go to a level: the nearest notch. Dragging scrubs through levels. The cap toggles all levels; the house above it toggles roofs.
- **Under the pointer it widens** (about 100 px, over whatever is beside it) and the labels read: "lv 2 · 3" (three rooms), "lv 1 · ground". Each notch's tooltip says the height in feet, how many rooms, whether it is hidden. The rail's tooltip text is the old indicator's sentence ("Showing lv 1 · Inn · 2 rooms above hidden · 1 pawn above").
- **It never takes the keyboard focus**, and a click on it never reaches the world.
- **Beside it, not under it:** the launchers, the Build tray and the chat log start 30 px in. The picture-in-picture window cannot be moved or sized onto the strip (it may reach the bottom edge again). On a narrow window the command bar starts beside it. Checked at 900 x 420 and 480 x 640: the rail is whole and its notches stay at least 12 px apart.
- **Players have it too.** A storey a player has not been shown has no heavier notch for them.
- **Gemini, blind** (four pictures, the strip only): "The lit/colored portion of the strip indicates which floors are currently visible. The position of the numbered marker indicates which floor is the user's currently active level"; all levels: "All three segments of the strip are lit ... A marker with the number 1". It read "-1" as "0" at this size.
- **Choices made for Harry:**
  - stepping onto a level always cuts the view to it (rather than leaving "all levels" on), so `]` and `[` always show what they did;
  - `[` `]` reach empty levels with no tool picked (the old "pick a room tool first" refusals are gone);
  - the storeys the cut hides are dimmed on the rail rather than removed;
  - the marker shows the storey number only; "lv" and the room counts wait for the pointer.

### Roofs: the top of the meter (Harry 2026-10-06)
Harry: "Roofs on doesn't get a chat line, it doesn't even get a conditional." The "Roofs on" button that appeared when zoomed all the way out is removed; zooming offers nothing.
- **The roofs position is the very top of the level meter**, above "all levels" and the highest level: a small house mark. **A click on it** puts the roofs on, with all levels showing; the level you are on stays. A click again takes them off, and puts the view back on your level if it was cut to it before.
- **`]` past the top of the meter** shows the roofs; **`[` from there** hides them (the level does not move).
- The mark is lit while roofs are on, and dimmed when they are on but the view is cut below them.
- "Roofs on" / "Roofs off" stay in the command bar.
- **Which was shipped:** both readings at once. It is a position (the top of the rail, reached by stepping past the highest level) and it works as a toggle when clicked. A two-storey inn's roofs are five `]` presses above lv 2 by keys, because the levels between are real, empty levels to build on; by mouse it is one click.

### Pinging: press and hold (Harry 2026-10-06)
Harry, first: "maybe that can also just happen on double click"; then, the same day: "pinging: let's go with whatever the norm is, not double click." A double-click does not ping; it only looks (the level, and the centring).
- **The norm, as far as it could be checked:** Foundry VTT pings from a long press on the canvas (its API documentation: the controls layer's `_onLongPress` "pinging the canvas", `drawPing`, `handlePing`; ping styles `PulsePing` and `ChevronPing`). Its user article and Roll20's help page on pinging both refused the fetch (404 and 403), so the hold time (about half a second in Foundry, about a second in Roll20) and "Shift + hold pulls everyone's view" are from memory, not verified.
- **Press and hold, anywhere, on anything**, without moving, for half a second: the other seats see a brief ring at that spot in your seat colour, and so do you. A finger held still does the same.
- **Alt/Option+click** is the quick way, on anything. (Checked against "Industry standards" below: Option+DRAG orbits the view; a plain Option+click was already the ground ping and now works on things too, instead of selecting them.)
- **It does not fight the other gestures.** A press that moves past the drag threshold (4 px) is a drag or a selection box, as ever, and never pings, however long it is held. Let go before half a second and it is a click. After a ping the release is not also a click (nothing is selected or deselected). A hold on a thing that pings and THEN moves still drags it.
- **It is presence, not a command:** never stored, not in the log, not in the chat, not undoable.
- **Who sees it:**
  - a ping inside a room hidden from players, or on a hidden thing, reaches the GM side only (the relay decides);
  - a ping on a level your view is cut below is NOT drawn in the world: a small mark in the pinger's colour pulses beside that storey on your level meter, and your view does not move. (Chosen over dropping it: you learn where to look.)
- **Rate limit:** one per 600 ms from a seat; the relay passes at most 4 in 3 s per connection.
- **Room left, not built:** the GM's Shift + press-and-hold "pull everyone's view here". **AI seats** cannot ping through the GET API yet (not trivial: the relay's ping path is tied to a live connection).
- Code: `armHold` and `click` in `engine/client/input.js`, `app.ping` / `app.showPing` in `main.js`, `app.meterPing` in `surfaces/cut.js`, `presence()` in `engine/relay/campaign.js`. Test: `engine/test/browser_nits.py`.

### The mouse wheel zooms in every browser (Harry 2026-10-06)
Harry, in Chrome on a Mac after weeks in Firefox: "mouse wheel scroll pans up and down instead of zooming."
- **The rule is unchanged:** a mouse WHEEL zooms toward the cursor; a trackpad's two-finger scroll PANS (with Option: orbits); a pinch zooms.
- **The cause.** Browsers send all three as wheel events and do not say which device it was. The old test called anything fractional or under 40 px a trackpad. Firefox reports a wheel in lines, so it passed; Chrome and Safari on a Mac report a wheel notch as 4.000244140625 px (the system's wheel acceleration), which the old test read as a trackpad, so it panned.
- **The new test** (`engine/client/wheel.js`, with the table of each browser's signature) decides per gesture (a run of events under 180 ms apart), never per event. A wheel is: lines or pages; or Chrome's `wheelDeltaY` in whole 120s that is not minus three times `deltaY`; or a Mac-accelerated delta (a 16.16 fixed-point value off the quarter-pixel grid); or a gesture that STARTS with a whole 100 or 120 px. Any sideways delta makes it a trackpad. A trackpad gesture's tail stays a trackpad.
- **A trap found on the way:** Firefox reports a wheel in lines only to a page that reads `deltaMode` BEFORE `deltaY`; read the other way round it silently converts to pixels. The classifier reads the mode first (a test holds it to that).
- **Settings ▸ Me ▸ Controls ▸ Scroll wheel: Auto / Always zoom / Always pan**, for a device the guess gets wrong: a Magic Mouse or a free-spinning wheel looks like a trackpad and will pan on Auto.
- **Only the game was affected.** The Spawn Tuner zooms on every wheel event (no trackpad pan there), and the pilot pages use their own viewers.
- **Tests:** `engine/test/wheel.test.mjs` (30 streams: Chrome wheel on Mac, Windows and Linux, Firefox lines and pixels, Safari, trackpads at 1x, 2x and with the page zoomed, diagonal scrolls, flicks through 100 and 120, tails, the setting); `browser_nits.py` sends the same signatures at the canvas and also the browser's own wheel event.
- **Other browsers (2026-10-06).** `TW_BROWSER=firefox` runs any browser suite in Firefox (with a window on the virtual display, drawing in software; headless Firefox has no WebGL on the build box). WebKit cannot start on the build box (Playwright's build needs libicu74; Ubuntu 25.10 has a newer one).

### The camera works over a room label (2026-10-06)
A room or building label is a handle (click selects, drag moves the room), and it sits over the map. With the pointer on
one, the wheel zooms, a right-drag pans, a middle-drag orbits and Space + drag pans, exactly as beside it. (Before: none
of them did anything there, and Space + drag moved the room.) Left-drag on a label still moves the room.

### The second click of a double-click never presses the ring (2026-10-06)
Found while testing the above. The first click of a double-click on a room's label selects the room, its ring appears at once, and a ring button could land under the pointer: the second click pressed it, so a double-click meant to go to that room's level could turn or re-roll the room instead. A press on the ring within 600 ms and 6 px of the press before it (or one the browser itself counts as the second click) is now swallowed, and the double-click goes to what is under the ring (`surfaces/ring.js`).

### A floor stops the pointer (Harry 2026-10-06, as built)
Harry: "I found a bug: on floor two I can still select things on floor one directly thru the actual floor. (not just things I can see blurry, but the actual physical floor is not flooring.)"
- **The rule: the pointer selects what you can see at that spot.** A floor that is drawn (a room's floor, the 1-ft slab an upper room stands on, the ground) stops the pointer, as a roof already did. On lv 2, a click on the floor is a click on the floor: nothing standing on lv 1 under it is reached.
- **The cause.** The pick went by the list of things and wall pieces. Floors, slabs and the ground were never in that list (a floor selects nothing: labels are the handles), so nothing lay between the pointer and a pawn under the floor. A covered room's furniture was already skipped, because it is not drawn at all; pawns, wall pieces, doors, posts and stairs down there were not, and neither was anything in a room only partly covered.
- **Every pointer path that asks "what is under the pointer" goes through the same stop:** hover, click, Shift / Cmd-click, the click that cycles down a stack, a drag (a drag begun on the floor is a selection box, it used to drag the pawn underneath), touch long-press, double-click (it took the room of the pawn underneath and cut DOWN a level), press-and-hold and Alt+click pings (the ring landed at the pawn's height below the floor), and a thing being placed or dragged onto a table top. **The selection box** takes things by their bounds, not by a ray, so it asks each thing inside the box whether any of it is in sight; a box dragged on lv 2 gathered the things of lv 1 under the floor, drawn or not, and no longer does.
- **What you can see below is still yours.** Things beside the building, in a yard, on the part of a lower floor that no upper room covers, or showing through a stair's hole are hovered, selected, boxed and dragged as before. *Decided for Harry; the other choice is that nothing below the level you are on can be selected at all (a small change: `floorStop` in world.js would stop at the level's own plane everywhere).*
- **The same rule, other places.** A cellar under the closed ground: its pawns and wall pieces were reachable by clicking the ground over them; the ground stops the pointer now, and opens when you go down. Roofs on: a click was already stopped by the roof, the selection box was not, and is now. Things above the cut were already out of reach on every path.
- **Not changed, for Harry to say:** a pawn standing behind a WALL is still picked ahead of the wall when you click the wall where the pawn would be. That is the old stack order (pawns first, then things and walls; click again to go down the stack), which lets you grab a pawn that a wall or a table half hides. By the rule above the wall should win. **Select all** (Cmd/Ctrl+A) goes by room, not by sight, and is unchanged.
- **Cost.** Worked out, not raycast: a few plane crossings against the rooms that are showing (the list is kept with the cut and rebuilt only when the cut, the rooms or the things change). No mesh is read, so a building that is asleep or still loading stops the pointer the same. Measured on a 50-room map (five buildings, three levels, 1,963 things): the stop takes 0.5 to 0.7 millionths of a second per pointer move; the pick it sits in takes about 5 thousandths of a second with it or without it (that is the old cost of raycasting every thing, and is the frame-time work's to bring down). The box asks six points per thing, once, when it is let go.
- Code: `engine/client/world.js` (`floorStop`, `inSight`, and their use in `pickAll` and `surfaceAt`), `engine/client/input.js` (`selectBox`). Test: `engine/test/browser_cut.py`, FLOORS (`--floors` runs only that): the picks are checked against a raycast of the drawn floor meshes themselves, across the screen, at four levels.

### S and P on their buttons (Harry 2026-10-06)
Harry: "Let's get the hotkey 's' noted on the settings button, and the hotkey 'p' noted on the pawns button."
- Build, Pawns and Settings each carry a key cap in the top right corner (**B**, **P**, **S**) and the key in the tooltip ("Pawns (P)").
- **P** was not bound to anything; it now opens and closes the Pawns placeholder (`pawns.menu`). Space P is still "pin" inside the Space chords, which never reach the game keys.
- The Settings button's count of waiting requests moved to its top LEFT corner, so it does not sit on the key cap.

### The Build tray: no level control, no drag hint (Harry 2026-10-06)
Harry: "Also get rid of the 'Drag a room on the map' text in the menu."
- The tray's level stepper ("Level: lv 2 (10 ft) ▼ ▲") is removed. The footer for a picked room now reads only "Furniture and objects: drag them out of the library window".

### A double-click also centres (Harry 2026-10-06)
Harry: "The double click thing works great, but let's have it also center on the double click as well as cutting above."
- A double-click that sets the level (a spot in a room, a roof, a room's label) also glides the view so the double-clicked point is in the middle. Heading, pitch and zoom are kept. For a spot upstairs it is that spot, 10 ft up, that lands in the middle. A label centres on its room.
- **A short eased move** (0.3 s, easing out). **Any camera input stops it at once** (a pan, a turn, a zoom): the view stays where the input left it.
- **No move when the point is already near the middle** (within 8% of the view's smaller side).
- **Open ground too:** all levels show and the view centres on the spot. Chosen for consistency ("double-click goes there"); the cost is that a double-click beside a building, meant only as "show everything", also slides the view a little.
- **Reduced motion** (the browser's, or Settings ▸ Me): the view is simply there.
- **The picture-in-picture does the same within itself.** Showing this area, a double-click in it sets the level as in the main view and centres the PiP's own camera; the main view does not move. Showing another area, it only centres (nothing can be acted on there yet). The library shelves do neither.
- Code: `app.centreOn` (main.js), `View.glideTo` (views.js), the `dblclick` handler (input.js). Test: `engine/test/browser_nits.py`.

### Pawns snap to the squares (Harry 2026-10-06)
**Changed 2026-10-11:** a dragged pawn now moves freely and **Shift snaps it**; what this section describes is the other position of the switch (Settings ▸ Me ▸ Pawns snap to squares: Always). See "Shift = snap to steps, everywhere".

Decided while starting the pawn design; only this is built.
- **A dragged pawn snaps to the 5-ft grid: the centre of the square under the pointer** (a pawn fills one square). It snaps during the drag, so other seats see it on the centre too.
- **Shift moves it freely**, as Shift does for walls and posts.
- Several pawns dragged together keep their spacing: the one that was grabbed lands on a centre and the rest go with it.
- Dropped on a floor at another height (upstairs, a cellar) it snaps there the same way. Arrow-key moves (one square, Shift 1 ft since 2026-10-15), the stair hop, and props are unchanged. Pawn keys, the pawn menu, HP and conditions are untouched.
- Code: `pawnSnap` in `engine/client/input.js`. Test: `engine/test/browser_nits.py`.

### Dragging a figure out of a list (Harry 2026-10-06, as built)
Harry, while playing: "I notice a small tweak: the pawns can't be dragged out of the text-search menu."
- **The gesture, the same everywhere:** press on a figure, move (6 px), and it is in your hand over the map; let go on the map and it is there. Let go anywhere that is not the map (back over the bar, a menu, a launcher, the picture-in-picture) or press Esc and nothing happened. A plain press that does not move arms placement (then click a square; Shift-click on the map keeps placing). In the bar, Shift-click adds a pick and Enter arms the picked group when present.
- **In the hand** it is the placing ghost: it snaps to the squares, a large creature to its 2 × 2, the squares it will take are lit, it lands on the floor that shows under the pointer (upstairs too), **R turns it**, and **Shift is off the squares** (while dragging, Shift cannot mean "keep placing": a drag is one drop). A count ("6 goblins") drops the whole group where it is let go, one undo.
- **The list steps aside while you drag.** The bar's results go and the bar's own field stays (it is where you let go to cancel); let go on the map and the bar closes, cancel and the results are back with what you typed. The Pawns menu goes for the drag unless it is pinned.
- **What drags from where:**

  | where | a drag does |
  |---|---|
  | command bar, a figure row (`owlbear`, `add pawn …`, `6 goblins`, `plain pawn`) | places it (or the group) where it is let go |
  | command bar, a `change figure …` row | let go ON a pawn: that pawn wears the figure, whichever pawn was selected. Its picture is in the hand, the pawn under it lights up; off a pawn, nothing |
  | Pawns menu ▸ Place a pawn, a thumbnail in a grid | places it |
  | Pawns menu ▸ The cast, a person or a saved group | drops it (a group whole, numbered) |
  | Pawns menu ▸ Mine, a pawn on the bench | brings it on at that spot (a player may, as by click) |
  | command bar, a furniture row; the library window | as before (they already dragged) |

- **Not dragged, on purpose:** a pawn of mine that is already on the table (its tile's click goes to it; move the pawn itself), the party rows (a drag there is the marching order or the turn order), "On the table" rows, the family tiles of the tree (they open), and the figure picker in Settings ▸ Me ▸ My pawns (there is no map behind it).
- **Who may:** a drag starts the same tool a click starts, so a seat can drag only what it could click. A player has no figure rows and no placing tiles at all; her bench is hers to bring on. Other seats see the pawn appear exactly as a clicked one (it is the same command).
- **Nothing over the map is in the way of the drop:** room labels and the selected thing's ring take no pointer while something is in the hand.
- **Mouse, trackpad and touch.** On touch a row or tile that drags takes the finger itself, so a finger on a FIGURE row does not scroll the list (the other rows and the party rows still do what they did).
- **(Changed 2026-10-11: the ghost is free by default and Shift puts it on a square, by the same switch as a dragged pawn.)** **Decided by me:** Shift is "off the squares" during a drag (the pawn-drag meaning), not "keep placing"; letting go over where the hidden list WAS places on the map you see there; a cancelled drag leaves the list open; the change-figure picture rides up and left of the pointer so the pawn stays in sight; dragging onto a pawn changes only that pawn, not the rest of the selection.
- Code: `app.dragOut`, `app.dragPawnOut`, `app.dragFigureOnto` in `engine/client/pawns.js`; the rows in `surfaces/bar.js`, the tiles in `surfaces/figtree.js` and `surfaces/pawns.js`. Tests: `engine/test/browser_figs.py` DRAG (21 checks; `--shots DIR` also takes two pictures mid-drag), `engine/test/browser_pawnsmenu.py` MINE, TREE, CAST (10 checks).

### The FPS meter (Harry 2026-10-06)
Harry: "Can you also add a toggleable FPS meter for me as well? It's fine if the only way to activate it is the chatbar."
- **"FPS meter" in the command bar** (also found by fps, frame rate, frame time, performance, stats) switches a small readout on and off. No button, no key.
- **Lower right, above the status line:** `60 fps · 14.1 ms · worst 31.0 · 1.1k draws · 5.79M tris`: frames per second, the median and the worst frame time over the last two seconds (so a stutter shows), and the renderer's draw calls and triangles.
- **This seat only, in this browser** (`tw.fps`), never sent; off by default; remembered over a reload.
- It records one number per frame and rewrites its text twice a second. Off, it does nothing per frame.
- Code: `engine/client/surfaces/fps.js`. Test: `engine/test/browser_nits.py`.

## Pawn ring (Harry 2026-10-06, as built)
Designed by Harry and Fauna in conversation on 2026-10-06 and built the same day (branch `pawns`).

Harry: "We want to re-use as much convention as possible ... same rotate handle, same hamburger extender. I'm thinking item three should be basically a link to the character sheet." Then, on the fourth slot: "HP is critical, and is probably a drag in and out slider, similar to size ... conditions are clearly a sub-menu after the hamburger ... I like the 'pointing at it' though I think sort of a borrow from WoW this can be a sub-menu of indicators. GM chores as well ... we need a 'set/change name' option. I also kind of think everyone can change everyones HP by default, and it comes with an undo float." And: "we need hover text for sure".

### It is damage, not hit points
Harry, the same afternoon, before it shipped: **"easy and better 'HP' answer... instead it's 'damage'. That means 0 is always healthy, it also means there isn't that whole 'bloodied' question."**
- **A pawn's number is damage, counted up from zero.** 0 is unhurt, always. An unhurt pawn shows no number.
- **There is no maximum and nothing asks for one.** So it works for games that are not D&D, and a pawn needs no setting up before the first hit.
- **Nothing is worked out from it.** No "bloodied", no death at a number, no coloured bar. Over the pawn you see its name and, when it is hurt, its damage: "Brakka  7 dmg".
- Where the earlier conversation above says "HP", read "damage".
- An optional limit (typed, giving a bar) may come later. It is not built; nothing here gets in its way (it would be its own field beside `damage`).
- **Old campaigns are converted, not broken.** A pawn that had hit points and a maximum now has damage = maximum − hit points; a pawn that had no hit points, or only one of the two numbers, has 0. See docs/NETCODE.md, "Pawns".

### The closed ring: turn · sheet · damage · ☰
- Four items at the props' clock positions (turn at 10:00, then 11:20, 12:40, ☰ at 2:00). The name pill that used to sit at 12:00 is gone: the name is on the sheet card (it was in ☰ until 2026-10-11).
- **Every seat gets a ring on every pawn it can see.** A seat that does not own the pawn gets **sheet · damage · ☰** (no turn: it is not theirs to move), and its ☰ holds only Indicators.
- **Every closed ring button says its name on hover, at once** (a small dark chip above it: "Turn", "Sheet", "Damage", "All options"). This is for every ring, props and rooms too. The open circle's buttons carry their names in words, as before. (The research Harry asked for found unlabelled radials are what people dislike most.)
- The ring is placed from the pawn's own drawn bounds, so it will sit right on figures of any height.

### Sheet: one click, a small card
Harry: "this is basically just going to be a button that opens a link in a new window"; later, "the 'sheet' link can also open up 'notes' and 'gm notes' text areas, maybe like tabs?"
- The card opens at the Sheet button (the sub-menu rule: at the button that opened it).
- **Who the pawn is, at the top of the card (Harry 2026-10-11: Name and Give control left ☰ for the sheet).** Two plain rows above the link:
  - **Name:** a field holding the pawn's name, for the pawn's owner and the GM (the seats that could rename it before). Enter or leaving the field saves; Escape puts the old name back; an empty name is not saved. A seat that may not rename it has no field: the name is the card's title. **F2** on a pawn, and "change name" in the bar, open the card with the caret in this field.
  - **Moved by:** for the GM, a list of the people at the table and "No one (the GM moves it)"; choosing one gives the pawn (`token.owner`, undoable), and the card stays open. Every other seat reads the same line as plain words ("Moved by Mira"). "Give control" in the bar opens the card on this list.
- **The link, large, at the top: "Open character sheet".** It opens in a new tab. Hovering shows the site's host name ("dndbeyond.com").
- **Ordinary web links only (http or https).** Anything else is refused in the card with the reason, and refused again by the relay (`sheetProblem` in `engine/core/pawn.js`): `javascript:`, `data:`, `file:`, `ftp:`, links with a user name in them. A bare address ("dndbeyond.com/characters/42") gets `https://` in front.
- **With no link yet, the card is where you paste one** (the pawn's owner or the GM). "Change" swaps the link for the field again; saving it empty removes the link.
- **Two tabs of plain text below: Notes and GM notes.**
  - **Notes** are read by everyone at the table; the pawn's owner and the GM write them.
  - **GM notes** exist only on the GM side. A player's card has no such tab, and **the relay never sends the text to a player's client or a player's AI seat at all**: it is taken out of snapshots, log entries, undo steps, reveals and the GET API, the same way room labels are (`unnote*` in `engine/core/labels.js`). Only the GM side can write them.
  - What is typed is saved when the field is left, about a second after the last key, and when the card closes. Up to 4,000 characters each.
- The card stays open while other seats change the pawn (its damage, say) under it.
- One sheet link per pawn, stored with the pawn (`sheet`, `notes`, `gmNotes`).

### Damage: a drag handle with a track, or type a number
- **Grab the heart and slide.** Outward (up and away from the pawn) is more damage; inward heals. The handle's track is drawn (`makeTrack`, as for size, raise / lower and turn).
- **A fixed 6 pixels per point on every pawn** (`DAMAGE_PX` in `engine/client/surfaces/ring.js`), so "take 7" is the same hand motion on a goblin and a dragon.
- **The track starts at 0 ("0 · unhurt") and has no far end.** It is drawn to the next ten past the pawn's damage + 10, and grows as the handle nears its end. Ticks every 5. No half or max marks: there is no maximum.
- **The readout shows the change as well as the total: "12 → 19 (+7) damage".**
- It never goes below 0. Shift goes to the fives. Release commits; Escape cancels (the rules of every ring drag).
- **A plain click opens a small field.** One small parser (`parseDamage` in `engine/core/pawn.js`):
  - `7` or `+7` adds 7 damage (the common case is "take 7");
  - `-5` heals 5 (never below 0);
  - `=12` sets it to 12.
  - Enter applies, Escape cancels, clicking away cancels. While you type, the field shows what will happen ("7 → 14 (+7)").
  - These three forms are Fauna's choice; Harry has not ruled on them.
- With several pawns selected, a drag or a typed change applies to all of them.
- The button shows the pawn's damage under the heart when it has any.
- **The four HP buttons that were in ☰ are gone.**
- **Keys: `=` adds one damage to the selected pawn and `-` removes one.** HP used to be on `[` and `]`, which are also the level keys; now `[` and `]` only step levels, pawn selected or not. Harry on the move: "hmm, ok". It is one constant (`PAWN_DAMAGE_KEYS` in `engine/client/commands.js`).
- In the command bar, with pawns selected: `+7` is 7 damage, `-5` heals 5, `=12` sets it. (Before, `-7` there meant "take 7". A bare number is left to the bar's other meanings.)

### Everyone can change everyone's damage, and every change leaves an undo
- Any seat may change the damage of any pawn it can see (`token.damage`, with no owner check). Who may see a monster's number is unchanged: everyone (Harry: "lets leave it visible for now").
- **Every change puts an undo button beside the pawn, "Undo: Brakka took 7 (19 damage) by a playtester"**, for about 6 seconds. Then it goes down into the chat and stays there as "Brakka took 7 (19 damage) by a playtester · [Undo]" (the contextual → chat-line pattern). Healing reads "Brakka healed 5 (14 damage) by Mira".
- **Who gets it: the seat that made the change, the pawn's owner, and the GM.** Nobody else sees a button or a line. Harry: "great choice. agreed." It is one function, `seesDamageUndo` in `engine/core/pawn.js`; the relay asks the same function before letting a seat undo someone else's damage change, so a fourth seat is refused even if it asks by hand.
  - This is the one place a player can undo another seat's change: the owner of a pawn, for a damage change to it, named by its number in the log. The owner cannot undo anything else done to the pawn.
- **Several quick changes are one line with the total.** One seat changing one pawn again within 2.5 seconds ("take 3, no, 7") updates the same button; its Undo takes back every change it names, newest first.
- **A stale undo is greyed with a short reason and does nothing:** "already undone", "changed since" (the pawn's damage was changed again after it; undoing would put an older number over a newer one), "that pawn is gone", "not yours to undo".
- A pressed button leaves no line. After a reload the line is plain text, as every undo line is.

### Inside ☰
**Since 2026-10-11 ("The cuts", above): five entries.** Conditions ▸, Indicators ▸, Raise / lower, Hide from players (GM), Send to area ▸. Set / change name and Give control moved to the sheet card; Duplicate (Ctrl/⌘+D) and Delete (the Delete key) left the ring and keep their keys and the bar; **Lock is gone: a pawn cannot be locked.** The list below is the menu as it was built on 2026-10-06.

In this order; what a seat cannot do is not shown.
- **Conditions ▸** (the list as before; the pawn's owner and the GM).
- **Indicators ▸**: eight persistent markers in the manner of World of Warcraft's raid markers: star, circle, diamond, triangle, moon, square, cross, skull. One per pawn. It floats over the pawn's name for every seat, the same size on screen at any zoom. Choosing the one already set, or **Clear**, removes it. **Any seat may mark any pawn** ("this one"). Shape and colour both differ, so they do not depend on colour alone.
- **Raise / lower** (the drag button, as before).
- **Set / change name** (typed in place; F2). Its caption on the circle is the two-line "Change name"; the full words are on the button's hover.
- **Lock**, **Hide from players** (GM).
- **Duplicate** (GM): a second pawn beside it with the same damage, conditions, sheet link, notes and indicator. (Props still have no Duplicate on the ring; that rule of 2026-10-05 stands.)
- **Give control ▸** (GM): the people at the table, and "No one" (the GM moves it). A pawn given to a player is theirs: they get the full ring on it.
- **Delete**, with its key, Del. This is the one-key kill: there is no separate Kill.

### Not built here
- The Pawns launcher menu and how a player picks a figure (Harry is thinking it through).
- Figures: another branch (`figs`) makes the generated figures placeable.
- Conditions shown with style (knocked over lies down, petrified is pewter): a tuner lab for later. Conditions display as before.
- Rollable sheets and engine integrations. An optional damage limit.

### Choices made for Harry (each is one small place to change)
- 6 pixels per point; Shift snaps to fives.
- The typed forms: `7` / `+7` take, `-5` heals, `=12` sets.
- Over the pawn: "Brakka  7 dmg" when hurt, the name alone when not.
- The undo floats for 6 seconds; quick changes merge within 2.5 seconds.
- A bare address gets `https://`.
- Notes: the owner and the GM write, everyone reads.
- Any seat may set or clear an indicator on any pawn.
- A seat gets a ring on pawns that are not its own (sheet · damage · ☰).
- The damage field cancels when you click away, and closes if the pawn changes under it.
- The damage button's picture is a cracked heart.

### Gemini, blind
- **Closed ring, hovering Damage:** "The heart icon with the number '7' and the label 'Damage' above it is a health or damage tracker. It visually shows the 7 damage the piece has taken. Clicking it would likely allow you to change this value." It took the document icon for "the character sheet or a notes panel". It guessed the turn arrow is "a button to refresh the piece's state or end its turn": the icon is the props' own, and its hover name is "Turn". A point for the visual pass on the radials.
- **Damage mid-drag, first try (readout "20 → 27 (+7)", mark "0"):** it took the number for hit points, "as indicated by the heart icon", and said zero "would typically mean the creature has been defeated". The wrong way round. So the readout now ends in the word "damage" and the zero mark reads "0 · unhurt".
- **Damage mid-drag, after that:** "The amount of damage on the 'Dragon' game piece is being changed ... from a value of 20 to a new value of 27 ... Zero would mean the piece has taken no damage and is 'unhurt'." It still found the picture odd: "slightly unclear why the circle ... has a heart icon, which usually represents health, when the text explicitly refers to 'damage'." The cracked heart reads as a plain heart at this size: another point for the visual pass.
- **Open ring (read before the change to damage; unchanged since):** it named every entry from its caption (Conditions, Indicators, Raise / lower, Lock, Hide from players, Duplicate, Give control, Delete). It read "Set / change..." cut short, so that caption is now "Change name" and a test fails if any caption is cut.
- **Indicators list (the same):** all eight named with their colours ("a white skull icon ... Skull").
- **At table distance:** "Brakka 7 dmg ... 'prone' ... A white skull is floating above the text", and no symbol on the other three.
- **Sheet card (the same):** "This button likely opens a detailed character sheet for Brakka from the website sheets.example.com ... 'Notes' are for public information that all players can see, while 'GM notes' would be for private notes visible only to the Game Master."
- **Undo:** the floating button reads "Undo: Brakka took 7 (14 damage) by a playtester ... Clicking it would likely reverse the last action"; in the chat, "'Undo' ... is clearly a button ... It would probably remove that damage from Brakka."

### Code and tests
- `engine/core/pawn.js` (indicators, `seesDamageUndo`, the sheet-link rule, `parseDamage`, the readout, the undo line's words); `engine/core/commands.js` (`token.damage`, `token.mark`, `token.owner`; `token.set` and `token.create` take `sheet`, `notes`, `gmNotes`); `engine/core/labels.js` (`unnote*`); `engine/core/migrate.js` (`migratePawns`: hit points → damage); `engine/relay/campaign.js` (`entryFor`, the snapshot, `doUndo`, the conversion at `load`).
- `engine/client/surfaces/ring.js` (the damage handle and field, the sheet card, hover names, Give control), `engine/client/surfaces/undochips.js` (the damage undo), `engine/client/commands.js` and `menu.js` (the entries and their order), `engine/client/marks.js` and `world.js` (the indicator over a pawn, the pawn's label).
- Tests: `engine/test/browser_pawnring.py` (four seats), and the pawn sections of `engine/test/core.test.mjs`, `engine/test/relay.test.mjs` (a raw socket as a player: no frame carries a GM note) and `engine/test/migrate.test.mjs` (an old campaign with hit points; every real campaign's pawns).

## Turn order and initiative (Harry 2026-10-06, as built)
Design and Harry's words: docs/PAWNS.md, "Turn order and initiative" (with the table of choices made without him).
- **The core has no numbers.** An order over the pawns in the area, a marker on whose turn it is, Next and Previous.
  A game with no initiative uses just that. **Numbers only sort it:** a number rolled or typed for an entry puts that
  entry in its place.
- **An entry** is one pawn (a pawn someone owns), or every un-owned pawn of a kind as one ("Goblin ×3": the goblins
  roll once and act together). A kind is the name without its trailing number.

| | GM | Player |
|---|---|---|
| Start / end | "start fight", "end fight" in the bar (Ctrl+Z undoes either) | - |
| Next / previous | **N** / **Shift+N** | **N** ends her own turn, only on her turn |
| Bonus | "initiative bonus +2" for the selected pawns | "Set your initiative bonus…" ("initiative bonus +3") |
| Roll | "roll initiative for all PCs"; "… for the monsters (once per kind)"; "roll initiative" for the selected | the **Roll initiative** button when a fight starts; "Roll your initiative" |
| A number from real dice | "initiative 17" with a pawn selected | "initiative 17" |
| By hand | selected pawn: "move earlier", "move later", "take out of / add to the turn order", "it is this pawn's turn" | - |
| See it | "show the turn order" (text); the Pawns menu's rows | the same |

- **Rolls are the game's rolls:** d20 + the bonus through the same dice as "roll d20+3", so the line in the chat and
  the announce are the usual ones, labelled "Initiative: Brakka". A pawn hidden from players gets its number with no
  roll line.
- **The Roll initiative button** (a conditional button, docked under the command bar): shown to each player when the
  GM starts a fight, while her pawn has no number. With no bonus set it opens the bar on "initiative bonus " and
  rolls when she answers; otherwise it just rolls. After 20 s it goes down into the chat as "Harry started a fight ·
  [Roll initiative]" and works from there until she has a number.
- **Your turn:** the player whose pawn the marker lands on gets a toast and an **End turn (N)** button for as long as
  it is her turn.
- **On the table:** every pawn of the current entry wears a pale ring round its base, breathing at 0.9 Hz, and a
  figure's own base rim glows with it (`TURN_MARK`; steady with reduced motion). Nothing before the first Next.
- **Hidden pawns:** a player's page is never sent an entry whose pawns are all hidden from her, in any message
  (checked from every frame the page received: `browser_turns.py` TRAFFIC, `turns.test.mjs`). While such an entry acts,
  the players' marker stays where it was.
- **Keys:** N and Shift+N were free (in use before: B, P, S, R, O, L, F, Q, E, `.`, `/`, `?`, `=`, `-`, `[`, `]`,
  `\`). They do nothing while there is no order.
- Code: `core/turns.js`, `surfaces/turns.js`. Tests: `engine/test/turns.test.mjs` (79), `engine/test/browser_turns.py` (54).

## Pawn X-ray (Harry 2026-10-06, as built)
Harry: "it's the 'oh fuck where did I leave that vampire' button among many things."
- **X** (GM side only), or "pawn x-ray" in the command bar: on and off. Every pawn in the area is drawn again as a
  glowing outline **through walls, floors and roofs, on all levels** (the cut and the roofs do not hide it):
  players' pawns blue, every other pawn amber; pawns hidden from players included.
- **This seat's view only.** A switch in this browser, like the cut: nothing is sent or stored (the suite checks what
  the page sent). A player has neither the command nor the key.
- **How it is drawn:** each pawn's own mesh once more, with one small shader per colour: no depth test, no depth
  write, no lights, no shadows, no extra pass. A surface seen edge-on is bright and one seen face-on nearly clear, so
  a figure reads as its outline. The copies sit in the world's overlay layer and are placed from the pawn's data.
- **Cost** (`engine/test/xray_cost.py`, the build box, shared GPU, frame rate uncapped): 24 rooms and 60 figure pawns
  (1,169 things): 240 extra draws, 983,000 triangles; whole map 81.2 → 85.2 ms a frame (+4.0), the inn close up
  53.7 → 55.6 (+2.0); 8 rooms and 24 pawns: 23.5 → 23.8. Its own JavaScript is 0.1 to 0.2 ms a frame; off, one test.
- **Gemini, blind** ("how many figures can you find, where, are any marked differently"; one picture per call):
  - roofs on, X-ray off: "there are two figures visible".
  - roofs on, X-ray on: "a total of 13 figures … One group of four … on the left side of the main building's roof. A
    second, larger group of seven … on the right side of the same roof. A third group of two … on the roof of a
    smaller building … some are translucent blue, while others are translucent yellow."
  - cut at the ground floor, X-ray on: "a total of nine figures … Some are a translucent, glowing blue, while others
    are a translucent, glowing yellow."
  - The first tuning (a fuller body, a bright base disc) read badly: "large, glowing yellow shapes … distinct from
    the blue figures". Thinner outline, fainter body and base fixed it (`XRAY.power` 2.6, `min` 0.05).
  - Gemini places pawns seen through a roof "on the roof": the outline says where, not which floor.
- Code: `surfaces/xray.js`. Test: `browser_turns.py` XRAY.

## Building on levels (storeys, Stage B; as built on branch `storeys`, 2026-10-05)
Spec: docs/VERTICAL.md. **Changed 2026-10-06: the level is one thing now, there is no stepper in the Build tray, and `]` `[` need no tool: see "One level, and the level meter" above.**

- **The level being worked on.** One number per seat: a floor height in feet. The ground is level 1 (lv 1, 0 ft).
  - **]** goes up a level, **[** goes down. The Build tray shows "Level: lv 2 (10 ft)" with ▼ and ▲. Both are in the command bar ("level up", "level down", "ground level").
  - The step is the storey height of the building in focus: the building of what is selected, else the one last built on, else the one nearest the middle of the view. 10 ft unless the building says otherwise.
  - With a room tool live, the level can be one that does not exist yet ("· new"): one storey above the building's highest room, or below the ground. Without a tool it only goes to levels that exist. Putting the tool away on a new, empty level returns to the ground.
  - With a pawn selected, [ and ] changed its HP at the time (since 2026-10-06 they step levels always; a pawn's keys are = and -: "Pawn ring").
- **Drawing a room on an upper level.** Pick the room type, go up, drag as on the ground.
  - A faint grid shows at that height. Every square you may build on is lit faintly: over the rooms below, and up to two squares (10 ft) out from them.
  - **The grid and the lit squares draw over what is BELOW the level and behind what is ON it (Harry 2026-10-06: "it is showing THRU things that are on the second floor. It DOES need to show over things on the first floor, but it also needs to not ghost thru things on the second floor").** Walls, furniture and floors of rooms already on that level (or above) hide them; the storey underneath does not. They lie 0.3 ft under the level's floor line. The same below ground: there they also show through the ground, and a cellar's own walls, floor and things hide them. On the ground level nothing changed.
  - While you drag, the squares that will become the room light in your colour at that height. Squares more than two out get the small red mark and are left out; the readout says so. A drag with nothing under it at all is refused with a message.
  - The room joins the building it stands on. Its furniture is laid out for it, at its height. It stands on a one-foot slab.
- **What holds it up, added by itself.**
  - One square out is a jetty: a bracket under the overhang, against the wall below, every 5 ft.
  - Two squares out: posts from the ground up to the slab, at the outer corners and every 10 ft.
  - They come and go with the rooms (delete, undo, move).
  - **Each one is a thing of its own (Harry 2026-10-06: "I'm looking at some pillars that are holding up an overhang, and I don't seem to be able to select them as first-class objects").** A click on a bracket or a post selects THAT piece, the way a click on a wall piece or a corner post does: it has a thing's ring (replace with similar, hide from players, ☰), Delete removes just it, and the first change to it (a drag, a swap, a pin) puts an ordinary object in its place, in one undo step. A post drags like a corner post (grid crosses and edge midpoints; Shift moves it freely); a bracket moves like furniture. Until 2026-10-06 a click on one selected the room it held up.
  - **By the building's walls (2026-10-06: "this particular pillar type is not visually quite right").** Timber and half-timber walls: the jetty bracket and the plain timber post. Stone walls (dressed stone, fieldstone, a castle's rough walls, a crypt): the stone corbel and a square stone pier. A post or pier keeps its mesh's own proportions (it was squeezed to a foot across before): the timber post is about 2 ft across, the pier about 3.4 ft, and each stands just in from the corner so its outer faces line up with the wall above. The floor slab of a stone building is stone-coloured.
- **Below ground.** With a room tool, go down from the ground: lv -1 is -10 ft. The ground opens over the rooms below it while you are working down there, and closes when you come back up.
- **Putting things on a floor.** Whatever floor is under the pointer is the floor: a thing, a wall piece, a floor tile or a pawn dragged or placed onto an upper floor goes there, at its height. Dragged off the edge of an upper floor onto the ground beside it, it lands on the ground.
- **Raise / lower** counts from the floor of the storey the thing is over, and the readout shows the height above that floor.
- **The building tool** (a whole inn in one drag) builds on the ground only.
- **The view follows the level you step to.** Stepping the level is the same control as floor up / floor down below ("The cut"): the view is pinned to the level you are building on, so you see what you draw.

## The cut: which levels you see (storeys, Stage C; as built on branch `storeys`, 2026-10-05)
Spec and reasons: docs/VERTICAL.md, "What you see: the cut height". Code: `engine/client/surfaces/cut.js`, `world.js` (`setCut`, `cutPass`). Test: `engine/test/browser_cut.py`. **Changed 2026-10-06: the indicator is the level meter on the left edge, the pin is gone, and one step above the top storey is an empty level, not "all levels": see "One level, and the level meter" above.**

- **The rule.** The view is cut at a height. You see everything whose BASE is at or below the cut, and nothing above it.
  - A room shows whole or not at all: floor, slab, walls, posts, supports, and everything that belongs to the room. Nothing is ever sliced. A tall thing on the floor you are looking at is whole.
  - Loose things and pawns go by their own height. A pawn standing upstairs is hidden with the upstairs.
  - The ground is whole unless the cut is below it; then it opens over the below-ground rooms that are showing.
- **Double-click sets it.**
  - A spot in a room (its floor, a wall, a thing in it), or the room's label: the cut goes to that room's ceiling. You see into that room and nothing above it.
  - Open ground: the cut lifts off and everything shows.
  - It stays until the next double-click or floor step.
  - **A double-click on a room's label no longer renames it.** Rename is **F2** or ☰ ▸ Rename. A building's label still renames on a double-click.
- **Floor up / floor down pin it.** **]** up, **[** down; the indicator's ▲ ▼; the Build tray's stepper. The cut goes to the next level of the building in focus and is PINNED there.
  - One step above the top level is "all levels".
  - With a pawn selected, [ and ] were that pawn's HP (since 2026-10-06 they step levels always: "Pawn ring"). **}** and **{** (Shift) step floors whatever is selected.
  - A double-click overrides a pin.
- **Nothing else moves it.** Not moving, raising or selecting a pawn, not selecting a room, not zooming or panning, not another seat building, not picking a tool. It is kept per area in this browser, so a reload shows what you left.
- **The indicator** sits at the bottom edge, centred, always.
  - Every level showing: "All levels", quiet.
  - A cut on: "Showing lv 1 · Inn · 2 rooms above hidden", in the accent colour, with a pin mark when pinned, ▼ ▲, and × for "show all levels".
  - The PiP window cannot be moved or sized over it. The Build tray and the command bar are elsewhere.
  - Players have it too.
- **You can only click what you can see.** Clicks, hover, the selection box, select-all and drops ignore every hidden level. A selected thing that the cut then hides is deselected. A thing dropped where an upper floor is hidden lands on the floor you can see.
- **Labels.** A room above the cut has no label. A room wholly under a floor that is showing, or under the unopened ground, has none either (its label would sit over the room above). Step a floor down to reach it.
- **Lamps.** Lamps in rooms that are not visible are off: above the cut, wholly under a floor that is showing, or under the unopened ground.
- **What is below the level you look at is drawn as it is: sharp, at full brightness.** (Until 2026-10-11 it went out of focus and dimmed, "the depth look". Harry: "The 'poor focus' on lower levels is not really working out. I think we should drop it." It is removed: see "Three small notes, 2026-10-11".)
- **In the command bar:** "floor up", "floor down", "all levels", "look into this room" (the selected room, or the room of the selected thing), "cut to my pawn's level", "roofs on", "roofs off".
- **Not done:** other seats' cursors are still drawn on the ground. A thing dropped on open ground while the cut is below ground lands on the ground and is then hidden by the cut. The PiP shows the same cut as the main view when it shows the same area.

## Stairs: place them, switch them up or down (2026-10-11)
Harry: "start in on the fixes to stairs & ladders as a placeable object with a context menu that lets you switch them to 'stairs down' instead of 'stairs up'." Design record: "stairs belong in the object palette and must function properly". Rules and reasons: docs/VERTICAL.md, "Stairs are placed objects that go up or down". This section replaces the parts of the next one that say a stair arrives with a room.

- **Stairs are in the library.** Flights, half flights, the wall-hugging flight, spirals, the grand stair and ladders are found in the library, the Build tray and the command bar like any object. Drag or click one into a room.
  - A flight or spiral lands on whole 5-ft squares and turns by quarter turns (R). A ladder goes against a wall.
- **It works as a stair at once.** It goes UP from the level you put it on: the floor above opens on its squares, the hole gets its railing, and a pawn dropped on it arrives upstairs (dropped on the hole from above, at its foot).
- **The stair's menu has one switch: "Stairs down" / "Stairs up"** (ring ▸ menu; chord Space, B; the command bar: "stairs down"). The button names what you would get.
  - **Stairs down:** the stair keeps its place in plan and its turn, and moves down one storey. The hole is now in the floor you are on; the stair stands on the storey below.
  - **Stairs up:** the reverse.
  - It is counted from the level you are on. A stair seen from the floor it arrives at reads as stairs down there.
- **The hole and the railing are never left behind.** Move, turn, duplicate, delete or undo a stair and they move, close or come back with it.
- **A stair that leads nowhere says so**, in a small note over it, for as long as that is so: "No floor above yet", "Nothing below", "A wall runs through it", "Blocked at the foot", "Comes up through a wall", "Blocked at the top". It is still placed, and it starts working the moment the missing floor is built. The switch also says it once in a message.
- **Drawing a room no longer places a stair.** When a straight flight lines up with a hallway or common room, a conditional button beside the new room offers **Add stairs down** (a cellar: **Add stairs up**). It follows the conditional-button rules: about 12 s beside the room, then a line in the chat with the same button. Pressing it puts the stair in and lays the new room's furniture again round the hole; one undo takes both back.
- **"Add stair" left the room's menu on 2026-10-11** ("The cuts"). "add stair" in the command bar still plans one for the selected room (the planner's stair; a ladder where no flight fits). Its replacement is everything above.
- **Old campaigns:** the stairs that arrived with rooms are ordinary placed stairs now, with the same menu.

## Stairs (storeys, Stage D; as built on branch `storeys`, 2026-10-05)
Harry: "Stairs: best shot, explore together afterwards." Rules: docs/VERTICAL.md "Stage D".

- **You do not place the first one.** Draw a room on an upper level, or below ground, and its stair arrives with it: up from the room below, or from the cellar up into the room above (or onto open ground). A message says "Stair added (undo removes it)".
  - **Undo** takes the stair away first; undo again takes the room.
  - It never lands on furniture or in a doorway. If only one square is free you get a ladder. If none is, the message says so.
- **Add stair.** With a room selected: "add stair" in the command bar (it was also ☰ ▸ Add stair and Space S until the cuts of 2026-10-11). It joins the room to the storey below it (a cellar: to the storey above). Offered for rooms off the ground floor.
- **A stair is a thing like any other.** Click it to select it. Drag it: it moves by whole squares. **R** turns it a quarter turn. Delete removes it. Replace offers the other stair pieces.
  - **The hole follows it.** Where the stair stands, the floor above is open; move the stair and the floor closes behind it.
  - Re-rolling the room above or below keeps the stair and keeps the new furniture off it.
- **Any stair from the library works the same (2026-10-11).** Search "stair" in the command bar: the grand stair, the spirals, the flights, the half flight. Put one down under an upper floor and that floor opens over it, with a railing. It goes down on whole squares and turns by quarter turns. The mansion hall's grand stair is one of these: the room above it gets no second stair. Rules: docs/VERTICAL.md "Stairs that are furniture".
  - The grand stair climbs to the hall's far wall, so a pawn dropped on it arrives beside its top, on the hand it was dropped at.
- **Pawns.** Drop a pawn on a stair and it goes to the other end: upstairs onto the square beyond the top, or, dropped on the hole from above, down to the foot. Arrow-key nudges onto a stair do the same.
  - The view does not follow. The pawn's owner is offered **Cut to lv 2** (see "Conditional buttons").
  - With the destination floor in view you can also just drag the pawn onto that floor.
- **Hidden rooms.** Hide the room above or below and its stair is hidden with it. Players see an ordinary floor with no hole.
- **The hole has a railing (Harry 2026-10-06: "You made a choice around stair hole banisters. I think we do need them, but just as a normal kind of furniture that gets placed by default").**
  - Every open side of the hole upstairs gets a 5-ft section of railing, about 3 ft high, by itself. Never across the side the top step leads out of, so the landing stays clear. None where a wall already stands, and none round a stair that comes up onto open ground.
  - It follows the stair: move or turn the stair and the railing goes with the hole; delete the stair (or undo it) and the railing goes too; undo brings both back.
  - A section is a thing like any other: click it to select it, Delete removes it, drag it and it moves like furniture (it becomes an ordinary object where you put it and no new section grows in the gap), Replace offers the other railings, hide it from players.
  - By the walls of the room upstairs: the timber railing in timber and half-timber buildings; a plain wrought-iron one in stone buildings (dressed stone, fieldstone, castle, crypt); the marble balustrade in the mansion's noble rooms.
  - Areas built before 2026-10-06 get railings when they are opened: nothing is stored for them.
- Code: `engine/core/stairs.js` (`stairRails`), `engine/client/stairs.js`, `engine/client/world.js` (`railSpecs`). Tests: `engine/test/browser_stairs.py`, `engine/test/browser_pieces.py`.

## Storeys: fog, flyers, tall rooms and the rest (Stage G; as built on branch `storeys`, 2026-10-05)
Rules and reasons: docs/VERTICAL.md "Stage G".

- **Fog follows the level you are looking at.** All levels or the ground floor: the ground fog, as always. Cut to an upper storey: only that storey's rooms' own fog (set with a room's **Fog height**). Cut to a cellar: the cellar's fog.
- **Raise / lower.** A lifted thing has a faint line down to whatever is under it (the floor of its own storey, or a table top) and a small label with its height above that ("4 ft"). A pawn in the air shows both all the time, selected or not.
- **Other people's cursors** sit on the floor they are pointing at. One above your cut is not shown.
- **Tall rooms.** Select a room: ☰ ▸ **Height ▸ Taller** (or **Shorter**); also "taller" in the command bar. The room becomes one room two (up to six) storeys high, walls carried up. If a room above is in the way it says so and nothing changes. Since 2026-10-06 each upper wall piece and post is a piece of its own (select, delete, swap), like the wall below it; before, a click on one selected the room.
- **The building tool on other levels.** Pick a building type, step the level (`]` / `[`), drag: the squares you may build on are lit, and the building takes the biggest rectangle of your drag that fits on them. Its stair is added by itself (undo takes the stair first).
- **Deleting an upper room deletes the stair that came up into it** (one undo brings both back). A pinned stair stays.
- **The level indicator** also says how many pawns are above the cut ("lv 1 · Inn · 2 rooms above hidden · 1 pawn above").
- **Area pictures** always show every level.
- Test: `engine/test/browser_followons.py`.

## Wall pieces and posts: snapping and free moves (Harry 2026-10-05, as built)
- **A post snaps to the grid's crosses and to the midpoints of cell edges; the nearest wins.** A cross is where grid lines meet (a cell's corner, where a corner post belongs). A midpoint is where a wall piece sits. The same goes for the other pieces that stand on a point: pillars, a fence's corner post, a drystone pier, a hedge's corner and end block, the wall kit's corner pieces.
- **Shift + drag moves a wall, door, window or post freely**, with no snapping. It stays exactly where the pointer left it. Without Shift it snaps as before.
- **Several pieces selected** move as one: in whole 5-ft steps without Shift (posts alone: 2.5 ft), freely with it.
- **Shift at the press:** on a wall piece or post that is not selected, Shift + drag is the free move, not "add to the selection". On anything else Shift still adds to the selection.
- The drag looks the same either way, and other seats see it.

## Walls, doors and windows are ordinary objects (Harry 2026-10-04, as built)
- The room generator makes them (the shell is derived from the rooms), and every generated piece selects and behaves like an object: the same ring, keys and actions (move, rotate, cut/copy/paste, duplicate, swap for similar, pin, raise/lower, resize, undo).
- **Delete just deletes the piece**: a wall segment (shared walls open up both rooms), door or window is removed and nothing replaces it.
- The first change to a generated piece **materializes** it in the same command: an edge override hides the generated piece and an ordinary object takes its place, so one undo restores the generated piece.
- **Placing by hand** (from the library's walls, doors and windows sections, or the bar): pieces snap to the 5-ft grid edges, end to end; a door fits the opening (5 ft less the jamb posts); placed onto a wall line, the piece takes the generated piece's place there.
- **Re-roll** regenerates a room's generated walls, doors and windows; a piece someone edited (moved, swapped, placed) stays, as pinned props do. Deleting a room takes its wall edits with it; moving a room carries them along.
- **Posts and pillars too (2026-10-04):** corner and jamb posts select, move, pin and delete like any other piece (an edge override `c<x>:<z>` hides the generated one). When every wall meeting a post has been deleted, the post goes by itself, unless it was edited or pinned (then it is an object of its own and stays).
- **Rule: everything on screen is touchable.** The test `engine/test/browser_tiles.py` samples a dense grid of screen points after building rooms, after deleting walls and after painting floors; wherever the first thing drawn is not ground or floor, the ordinary pick must resolve to something selectable.
  - **Stricter since 2026-10-06** (`engine/test/audit.py`). The rule passed the posts under an overhang while a click on one selected only its room: "something selectable" was all it asked. It now asks for THE PIECE: a generated piece (wall, door, window, post, a tall room's upper wall, a bracket or post under an overhang, a railing section) must be offered as itself. It also samples the roofs, which it never looked at: a roof and its trim (chimney, dormer, parapet, ridge, finial) must resolve to that roof. Trim is part of its roof by decision; the 1-ft floor slab under an upper room counts as floor. `engine/test/browser_pieces.py` runs it over every kind of piece and proves it fails when a post answers as its room.

## Floor tiles (Harry 2026-10-04, as built)
- **Every floor the tuner draws is a placeable 5×5-ft tile:** planks, parquet, both herringbones, the checkers, flagstones (large, broken, square, damp, irregular), tiles (kitchen, delft, harlequin, hex, terracotta), cobble, earth, the stable's straw (with its hay and dirt scatter), and the yard's grass (with its tufts and worn patches) and gravel. They are in the bar (search "herringbone"), in every library area (a **Floors** section with that room type's own floors, then **More floors**), and drag out. **Since 2026-10-11 a floor dragged onto a room changes the room's whole floor** (next section); dropped anywhere else it is one tile, as before.
- **Paint:** picking a floor gives a paint tool (it stays until Esc). Click a cell to lay one tile; drag across cells to lay a run; **Shift-drag fills a rectangle.** Each stroke is ONE command and one undo step. A translucent plate in your colour previews each cell, with a count.
- **On the grid, replacing the floor:** a tile sits on its 5-ft cell and **replaces that cell's generated floor** (the shell skips the cell), so there is no doubled floor and no z-fighting. One tile per cell: painting, moving or pasting onto a cell takes the old tile's place. Rugs lie on top (hand-placed rugs now sit at 0.04 ft, over the tiles), and furniture stands on them as before.
- **Patterns continue across tiles:** a tile is drawn by the tuner's own floor code for its WORLD cell, so the periodic patterns (herringbones, checkers, flagstones, delft…) pick the crop that cell would get in a room, and a painted area reads as one floor; seamless floors are laid straight.
- **Ordinary objects afterwards:** select (a click), move (once selected, a drag moves it cell to cell; an unselected tile doesn't start a drag, so marquees still work on painted floors), swap for similar (the other floor materials, nearest in kind first), copy/paste (lands on the grid), delete. A marquee takes tiles only when it holds nothing else. Tiles have no size handle. Re-rolling a room keeps its tiles.

## A floor dragged onto a room changes the whole floor (Harry 2026-10-11, as built)
Harry: "When dragging in floor tiles, it should by default change the entire floor, and then offer a contextual option to only do tiles in the object style."

- **How a floor is held (two things, and the picture is both):**
  - **the room's floor**: `recipe.floor` on the room, a floor material or `auto` (the room type's own). The shell draws it under every square of the room, whatever its shape. Changed by `room.set { id, floor }`.
  - **painted tiles**: ordinary objects (`place: 'tile'`), one per 5-ft square, drawn instead of the room's floor on their square.
- **Before:** a floor dragged out of the library window or the command bar laid ONE tile on the square under the drop, wherever it was dropped. The room's whole floor was changed only from the room's menu (Floor ▸).
- **Now, dropped on a room:** the room's whole floor becomes that material. It is one command and one undo step.
  - **Tiles painted by hand stay** (Harry 2026-10-11, later: "Let's keep hand painted floor tiles"). The drop changes only the room's own floor; the painted tiles lie on top of the new floor as they lay on the old one. A painted tile of the same material as the new floor stays too: it cannot be told from the floor round it, and it is still there if the floor changes again. The drop never deletes anything.
  - While the floor is in the hand over a room, every square of the room is lit (painted squares too: it is the room that is lit) in your colour and the pointer says "Whole floor · <room>". Over open ground nothing is lit.
  - It works on any shape of room (an L: its own squares, not the notch) and on an upper storey (the room whose floor shows under the pointer).
  - Other seats see the room's floor change (it is the ordinary `room.set`).
- **Then the offer: "Only this tile".** A conditional button beside the drop. It floats for 8 s, then goes down into the chat as "Kitchen: the whole floor is now parquet herringbone · [Only this tile]" (the `.` key presses it).
  - Pressed: the whole-floor change is taken back by its own number in the log (the old floor and any painted tiles are exactly as they were) and the one tile is laid where the drop was.
  - **Still one undo step.** After "Only this tile", Ctrl/⌘+Z removes the tile and the room is as it was before the drag; redo brings back the tile, never the whole floor.
  - The offer goes, or its chat line greys with the reason, once that change has been undone, the room has been changed again ("changed since"), or the room is gone.
  - This button breaks the "never for what you just did" rule on purpose: Harry asked for it. It is an alternative, not a confirmation.
- **Dropped anywhere else it is one tile, as before, and nothing is offered:** open ground, a locked room, a seat that may not change rooms, a room that already wears exactly that floor (so a painted tile there can be painted over with the room's own material).
- **The paint tool is unchanged.** A click on a floor (in the bar or the library) still gives the paint tool: a click lays a tile, a drag lays a run, Shift-drag a rectangle. Only a DRAG out of a list changes a whole floor.
- **Decided by me (each is one small place to change):** a hand-painted tile of the new floor's own material is kept; the offer's life is 8 s (`FLOOR_OFFER_MS`); the offer is anchored at the drop, not at the room's label; a player who may not change rooms gets the old one-tile drop with no message.
- Code: `engine/client/surfaces/floordrop.js` (`app.floorDrop`), `modes.js` (`placeAt`, `floorWholeAt`, the lit squares). Test: `engine/test/browser_handfeel.py` FLOOR (55 checks).

## First visit, and other seats' changes (Harry 2026-10-03, as built)
- **The intro:**
  - on a building seat's first visit, a **phantom seat** ("Intro", a real agent seat with its own ghost cursor) acts out the first build;
  - **one cursor, not two (2026-10-11).** Harry: "Intro cursor has a second spiny indicator that lags well behind it." It was not the viewer's own cursor coming back: it was the PHANTOM seat's cursor in the world (the turning ring every AI seat has), which the relay makes for any AI seat: it starts at the middle of the area and eases toward whatever the seat last looked at (four looks in the whole drag), so it trailed the screen ghost by seconds. On the screen that shows the ghost, the phantom's world cursor is no longer drawn (`app.pv.hidden`); every other screen at the table still sees it, as they have no ghost. (A seat's own cursor never comes back to it: the relay sends presence to every connection but the sender's, `broadcastPresence`.)
  - its screen ghost opens Build and picks Fantasy › Tavern & inn › Common room; the menus fly out and the cursor changes;
  - it drags a room out, and the phantom builds that room through the agent API, so it arrives as another seat's change;
  - then it hands over ("Press B to build") and the phantom leaves;
  - any real input stops it; "Replay intro" is in the bar and the ? sheet; `?nointro` skips it.
- **Floating undo chips:** whenever another seat changes something in the GM's area, a chip ("Undo Intro's room") floats beside the change, one per seat. It fades after about 9 s, and one click undoes exactly that change. Older changes stay reachable through the ghost trail ("undo <name>" in the bar). The chip is the first **conditional button** (next section).

## Roofs (Harry 2026-10-05, as built on branch `roofs`)
Harry: "A roof is basically a kind of room!" How roofs are worked out, their styles and their trim: docs/VERTICAL.md, "Stage F: roofs".

- **Roofs are off until asked for.** Zoom all the way out and press **Roofs on**, or type "roofs on" in the bar. "Roofs off" is in the bar. The switch is per seat and is remembered. The level indicator reads "All levels · roofs on".
- **A roof shows when the cut is off or above it.** Double-click a roof to look into the room under it: the cut goes to that room's ceiling and the roof is gone until the cut lifts.
- **A roof is selected by a click on it**, like a thing. It wears the house selection look round its whole volume. At the map detent a click on a roof selects its building.
- **A roof's ring:** **re-roll** (a die: new dormers and finial) and **☰**. Open, ☰ has:
  - **Style ▸**: thatch, clay tile, slate shingle, wood shingle, flat, each tile with a swatch of its texture; and "The building's" when the room has a style of its own;
  - **Hide roof**: that room goes without one. The room's own menu then has **Show roof**.
- **A building's menu has Roof style ▸**, which sets the style for all its roofs ("By its walls" goes back to the automatic choice).
- **Nothing under a roof can be clicked through it.** A room under its roof has no label; its building's label is still there.
- **Standing on roofs.** Drop a pawn or a thing on a flat roof or deck and it stands there. Dropped on a pitched slope it goes to the nearest point of the ridge.
- **Delete does nothing to a roof.** Hide it instead.
- **Keys:** with a roof selected, Space Y opens Style, Space E re-rolls, Space H hides.
- **Tests:** `engine/test/browser_roofs.py` (56 checks, two tabs).

## Whole buildings (Harry 2026-10-11, as built)
Harry: "If someone drags out an 'inn', it should default to 2 stories, but it should come with a contextual popup like we do that asks (want this to be 1 story? 3?)." The rules of the layout itself are in **docs/BUILDINGS.md**; this is what the hand does.

- **Build tray ▸ a type ▸ drag a footprint.** On the ground the rectangle becomes a whole building of that type: rooms that belong together with doors between them, a hallway, ONE stair core through its storeys, a cellar, and what stands outside (an inn's yard and stable at the back, a castle's courtyard and gatehouse in front).
  - It is ONE command: one Ctrl/⌘+Z takes the whole building away.
  - While you drag, the readout counts the rooms of the building you will get ("60 × 40 ft · 13 rooms").
  - It needs clear ground for its rectangle, as before. What stands OUTSIDE the rectangle (yard, stable, court) is left out where something is in the way, and the message says so.
  - The street is the south side of the rectangle (nothing sets it yet: docs/BUILDINGS.md, Open).
  - On an upper level the building tool is the older packer (the part of the drag that can be built on, one stair): unchanged.
- **How many storeys.** Each type has its own: an inn, a mansion and a castle two, a crypt one level.
- **The offers.** Beside the building's far corner, for about 14 seconds, conditional buttons in a column: one for each other storey count ("1 storey", "3 storeys"; a crypt: "2 levels", "3 levels", which go DOWN) and "Re-roll".
  - Pressing one makes the building again, as ONE undoable step, and the offers come up again for the new one. "Re-roll" stays to be pressed again.
  - With every level showing, a new two-storey building is seen from above its TOP floor, so the column starts with **Cut to lv 1** (the view never moves by itself; this is the same offer a pawn's stair-climb brings up).
  - They follow the conditional-button rules: never a dialog, never take the focus, never the only way. A storey offer that times out goes down into the chat ("Tavern & inn: 2 storeys · [3 storeys]"); the line greys out with "changed since" when the building has been made again another way, "that building is gone" when it was deleted.
  - (They are offers about something the person just did, which the rule below says a conditional is not for. Harry asked for exactly this one.)
- **Never only a button.** Select the building (its label): the bar and its ☰ have **Storeys ▸ 1 / 2 / 3 storeys** and **Re-roll building**.
- **From words.** `build inn 12x8`, `build crypt 20x14 seed 8`, `build castle 16x12 3 storeys` in the command bar: the building is made on free ground near the middle of the view (sizes in squares).
- **From the gallery.** The buildings gallery (https://implausible.enterprises/projects/turnip-works/tuner/buildings/) has "Open in 3D" on every plan: a link that builds that exact building once in your campaign, then cleans its own address so a reload does not build it twice. Only the GM side builds.
- **Re-roll replaces everything in the building**: pinned furniture and hand edits too. It is one undo away.
- **Afterwards it is ordinary rooms.** Every room re-rolls, turns, drags, hides and deletes as any room. A room drawn against a generated building gets its door by the old rules. A stair is a thing like any other.
- Code: `engine/client/main.js` (`makeBuilding`, `offerBuilding`, `buildAt`), `engine/core/buildplan.js`, `engine/client/commands.js` (`building.storeys.N`, `building.reroll`, `build.whole`). Test: `engine/test/browser_buildings.py`.

## Conditional buttons (Harry 2026-10-05; rare, and they go down into the chat since 2026-10-06)
Harry: "I actually want those conditional buttons to become part of our UI vocab." A conditional button is a button that exists only while it is relevant. It is one component (`engine/client/surfaces/condbutton.js`), so every such button follows the same rules.

- **They are deliberately rare (Harry 2026-10-06).** "Roofs on doesn't get a chat line, it doesn't even get a conditional. Just placing things doesn't get conditionals... they are somewhat rare."
  - **The rule:** a conditional is for something the person did NOT just do themselves and may want to reverse or follow. It is never a confirmation of what they just did.
  - So placing or building something makes no conditional button and no chat line (a stair that arrives with a room is ordinary work: undo is Ctrl/⌘+Z; when no stair fits, a brief message says so). Zooming out offers nothing (roofs are at the top of the level meter and in the command bar).
- **It appears only while its condition holds.** It goes when the condition ends, or when it has been used.
- **When its time is up it does not just fade: it goes down into the chat** (below).
- **One home per button, always the same.** Either a fixed screen slot, or beside the thing it is about (a little above and to the right, never over it). A button never wanders between the two.
- **It never steals focus.** It cannot be tabbed to, pressing it leaves the keyboard focus where it was, and it never opens over what you are typing.
- **It is never the only way.** Everything it does is also in the command bar. A missed button costs nothing.
- **One per offer.** Showing the same offer again replaces the old button in place; the older offer goes down into the chat.
- It never covers the picture-in-picture window, and it is not drawn for a spot that is off screen.

The conditional buttons that exist:

| Button | Appears when | Home | Its line in the chat |
|---|---|---|---|
| **Undo <name>'s <change>** | another seat changes something in the GM's area | beside the change | "Mira moved Brakka · [Undo]" |
| **Cut to lv 2** | your pawn changes floor | a fixed slot: bottom centre | "Brakka went to lv 2 · [Cut to lv 2]" |
| **Add stairs down** (a cellar: **Add stairs up**) | you draw a room off the ground floor and a straight flight lines up with a hallway or common room (see "Stairs: place them, switch them up or down") | beside the new room | "Guest room has no stairs · [Add stairs down]" (good for as long as a flight still lines up) |
| **Undo: Brakka took 7 (19 damage) by a playtester** | anyone changes a pawn's damage; shown to the changer, the pawn's owner and the GM | beside the pawn | "Brakka took 7 (19 damage) by a playtester · [Undo]" (see "Pawn ring") |
| **1 storey · 3 storeys · Re-roll** | a whole building has just been made (or made again) | beside the building's far corner, in a column | "Tavern & inn: 2 storeys · [3 storeys]" (the storey offers; Re-roll leaves none) (see "Whole buildings") |
| **Only this tile** | you drag a floor onto a room and its whole floor changes | beside the drop | "Kitchen: the whole floor is now parquet herringbone · [Only this tile]" (see "A floor dragged onto a room") |

Removed 2026-10-06: **Roofs on** (it appeared when zoomed all the way out). Roofs are the top of the level meter.

Rules for the cut button (Harry 2026-10-05): the pawn never changes the view by itself; it offers the change. Only YOUR pawn brings the button up. The GM gets it only for the last pawn moved. Only ONE cut button ever floats at a time (this limit is for cut buttons, not for conditional buttons in general); older offers live on as chat lines. If you miss it, you set the level by hand, double-click, or use its line in the chat.

As built (storeys, Stage C, 2026-10-05):
- **Cut to lv N.** A pawn's floor is worked out from its height. When it changes (a raise through a ceiling, a drop onto another floor, a move by anyone), the pawn's owner is offered the button. The GM is offered it only for the last pawn the GM moved. A second offer replaces the first. Its time is up after about 6 s. Pressing it goes to that pawn's level. Moving about on one floor offers nothing, and nothing is offered when you are already on that level.

### Down into the chat: action lines (Harry 2026-10-06, as built)
Harry: "The contextuals (like undo, or set to whatever cut on stairs), instead of fading away, they should go down into the chat area, so you still have access to them later."

- **When a conditional button's time is up, it flies down into the chat log** and stays there as a line that says what happened and still carries the button: "Brakka went to lv 2 · [Cut to lv 2]", "Mira moved Brakka · [Undo]". It is the move a say or a roll makes when its announce ends: the line is laid out but held invisible, the button flies onto the line's own button (about half a second), then the line shows. With reduced motion it fades.
  - A button that was pressed leaves no line (you did it). A button whose condition simply ended leaves none either (you are already on that level; you went to another area).
  - A button replaced by a newer one of its kind goes down at once.
- **These lines are this seat's only.** They are kept in this browser, never sent to the relay or to other seats, and never shown in the big announce box.
- **They are quieter than says and rolls:** smaller, muted, in italics, with a small arrow in front and no speaker's name.
- **The button stays honest.** Whether the action can still be done is checked every time the line is drawn and again at the press.
  - "Cut to lv N" is always good (in its own area).
  - An undo is good while that exact change can still be undone. Otherwise the button is greyed, with the reason beside it, and pressing it does nothing:
    - **already undone**: someone undid that change another way;
    - **changed since**: the thing has been changed again after it; undoing would put an older state back over newer work;
    - **that pawn is gone** (or room, or thing): what it changed no longer exists;
    - **not yours to undo**: you are no longer on the GM side.
  - The undo is sent for that one change by its number in the log, so it can never undo a different change than the line names. If the relay still refuses, the line says "could not be undone".
  - **Pressing a good button marks the line done** (a tick, no button).
- **No flood.**
  - Repeats are one line: six pawns going up to lv 2 are "6 pawns went to lv 2 · [Cut to lv 2]"; the same seat changing the same thing again is one line whose Undo is for the latest change ("Mira moved Brakka (×3)").
  - At most 8 action lines are kept; the oldest go first. The closed chat shows its last 5 lines of any kind, the open one 40.
- **After a reload** the lines are back. A cut line still works. An undo line comes back as plain text with no button: what happened to that change while the page was away is not known.
- **Key: `.`** presses the newest action line's button that can still be pressed; that button shows the key. With no such line the key does nothing. (Free before: the single letters in use are B, P, S, R, O, L, F, Q, E.) Also "newest offer" in the command bar.
- **For a new command** (a pawn's damage undo was the next: `damage-undo` in `surfaces/undochips.js`): one line registers the kind, one field on the button declares the line.
  - `app.actionLines.kind('damage-undo', { valid: (data) => null | 'already undone', run: (data) => …, restorable: false })`
  - `app.condButtons.show(key, { icon, text, anchor, life, area, run, line: { kind: 'damage-undo', text: 'Brakka took 4 (9 damage) by a playtester', button: 'Undo', data: {…} } })`
- **Choices made for Harry:**
  - which things get a line: every conditional button does, and nothing else does. The test is "might you want it a minute later"; both that exist pass it;
  - "changed since" greys an undo rather than letting it overwrite newer work;
  - a pressed floating button leaves no line;
  - the key is `.`.
- Code: `surfaces/condbutton.js` (rule 6, `toChat`), `surfaces/chat.js` (`app.actionLines`), `surfaces/undochips.js` (`app.undoState`, the `undo` kind), `surfaces/cut.js` (the `cut` kind beside `offer`). Test: `engine/test/browser_chatline.py`.
- **Gemini, blind**, on the lower left with a say and two action lines: it read "> Mira moved Brakka" with "a grey, rounded button with the word Undo" and "> Goblin 1 went to lv 2" with "Cut to lv 2", and said "the second and third lines can be acted on ... they have interactive, clickable elements next to them"; the first is "just plain text". It could not read the `.` key cap at that size (it called it an icon).

## Levels fly away (Harry 2026-10-06, as built)
Harry: "Instead of just disappearing, levels above the cut should fly up into the sky offscreen in a (very) short animation. Put this in the game, but we can also visit it with the tuner; I think this might be nice as a 'not all at once' thing, sort of like the way stuff builds, but faster." Rules and reasons: docs/VERTICAL.md, "Levels fly away".

- **When the cut drops, what it hides lifts straight up and off the top of the view**: the upper storeys' floors, walls, posts, supports, furniture, stairs and roofs. Pieces leave in a quick ripple, not all at once. The house look takes 350 ms from the first piece moving to the last piece gone (one piece 200 ms, the ripple 150 ms).
- **When the cut rises, they come back down the same way in reverse.**
- **Roofs on / Roofs off use the same move.** Cutting into a building with its roofs showing sends the roofs off with the storeys.
- **The ripple starts where you pressed.** After a double-click the pieces nearest the click go first. After a key or a click on the level meter it starts from the middle of what is leaving.
- **It never gets in the way.**
  - The level is hidden (or shown) for every purpose in the frame the cut moves, exactly as before: clicks, hover, selection, the selection box, labels and drops ignore a leaving level from the first frame.
  - A piece in the air cannot be clicked.
  - The lamps of a leaving level go out as it leaves.
  - A second change while pieces are in the air turns them round where they are. Nothing waits for an animation to finish.
- **Off, and then levels vanish and appear at once as before:**
  - **Settings ▸ Me ▸ Interface ▸ Levels fly away** (on by default; remembered in this browser);
  - **Settings ▸ Me ▸ Reduce motion**, or the browser's own reduced-motion preference;
  - an area's picture (World navigation) is always taken with every level at rest.
- **The area you open is not animated.** A cut remembered from last time is simply there.
- **The look is tuned in the Spawn Tuner**, panel **Fly-away: levels above the cut lift off**: one piece's time, first-to-last time, return speed, order (outward from the click / a sweep across / room by room / random), scatter, rise height, easing, fade. Built-in looks: quick (the default), showy, sweep, instant. "Demo: two levels" lifts every second room one storey; "Cut" sends that level away and brings it back. **Use in game** makes the look on screen the game's (it loads on the game's next reload); Send stores a note and leaves the game alone.
- Code: `engine/client/cutfly.js`, `tools/spawn-tuner/js/fx/cutfly.js`, `flypanel.js`, `anim.js` (`flySchedule`, `flyPose`). Tests: `engine/test/browser_fly.py` (45 checks), `tools/spawn-tuner/test/fly_ui.py` (20).

## Edge auto-pan while dragging (Harry 2026-10-11, as built)
Harry: "When dragging around objects, if you drag them to the edge of the window it should cause a panning action. (Not on PiP though? Maybe on PiP?)"

- **What it does.** While something is in the hand and the pointer rests near an edge of the window, the view pans that way. The nearer the edge, the faster; fastest at the edge and beyond it. What is in the hand stays under the pointer while the world slides under it.
- **What counts as "in the hand":** a thing, a pawn or a room being moved; a thing dragged out of the library window; a figure, a cast member, a bench pawn or a piece of furniture dragged out of a list (the command bar, the Pawns menu); **a rectangle being drawn for a room or a building; a floor paint stroke** (both since later on 2026-10-11).
  - **Drawing a rectangle:** the corner you started on is a square of the world, so it stays where you put it while the view slides and the rectangle grows (up to the tools' own limits: 16 squares a side for a room, 24 for a building).
  - **A paint stroke:** the run goes on square by square under the pointer, with no gaps; Shift's rectangle grows the same way.
  - **Not the selection box.** It is a box of screen pixels that takes what is wholly inside it and in sight; panning it would mean selecting things that have left the screen. (Decided by me.)
- **Never on a hover.** With nothing in the hand the edges do nothing.
- **What keeps it from firing by accident:**
  - **the delay:** the pointer must rest in the band for 0.15 s; crossing it does nothing, and the speed then comes in over 0.2 s;
  - **arming:** an edge the drag STARTED beside (a pawn picked up at the rim) does nothing until the pointer has left that band once, or has gone 16 px further toward that edge;
  - **lists:** a thing dragged out of a list pans only while the pointer is over the map (or off the window). Back over the bar, a menu or a launcher is where you let go to cancel, and the view holds still there;
  - **the level meter** (the strip down the left edge) takes no pointer while something is in the hand, so the left edge is the map's own edge: it pans, it does not fly open, and a drop there lands on the map.
- **The picture-in-picture: off.** While the pointer is over the PiP nothing pans, even where the PiP sits against the window's edge. One flag turns it on (`PIP`, below): the PiP then pans within itself when a drag rests at its inner rim, at 0.4 of the main view's band and speed. Nothing can be dropped inside the PiP today, so it would move a picture you cannot act on.
- **It is an ordinary camera move.** "Lighter picture while moving" applies to it; far rooms wake as they come into view; a view that was following pawns stops following. The level and the cut are not touched, and the drag keeps to the floor it started on, so a pan never lifts a thing to another storey.
- **The tunables, in one place** (`EDGE_PAN` at the top of `engine/client/edgepan.js`; live as `tw.edgePan.K` in the console):

  | name | value | what it is |
  |---|---|---|
  | `BAND_PX` | 64 | how near an edge the pointer must be |
  | `MAX_PX_S` | 1000 | the fastest pan, in pixels of picture a second (a window's width in a little over a second) |
  | `MIN_PX_S` | 60 | the speed just inside the band |
  | `RAMP` | 2 | the curve between them (1 = straight; 2 = gentle first, then quick: half way in is about 300) |
  | `DELAY_MS` | 150 | rest this long in the band before anything moves |
  | `EASE_MS` | 200 | the speed then comes in over this long |
  | `ARM_PX` | 16 | how much further toward an edge wakes it, when the drag began beside it |
  | `PIP` | false | pan the picture-in-picture from its inner rim |
  | `PIP_SCALE` | 0.4 | the band and speeds inside the PiP, as a share of the main view's |
  | `KINDS` | move, libDrag, room, paint | which map gestures pan |
  | `ON` | true | the whole thing |

- **Not built:** panning a selection box (above); a Settings switch.
- Code: `engine/client/edgepan.js` (`app.edgePan`; each drag registers itself with `app.edgePan.source`), called once a frame from `main.js`. `tw.edgePan.info()` says whether it is panning and why not. Test: `engine/test/browser_handfeel.py` EDGE (37 checks).

## Big maps: far rooms sleep, and the hand comes first (Harry 2026-10-06, as built)

Harry, on the big-map measurements: "I would love to do all three optimizations ... I'm wondering if there is a way as one more 'optimization' it can force priority to pan/rotate/mouse actions type stuff, so that that will tend to never feel laggy and trump other stuff." Numbers and method: `experiments/2026-10-06-megamap/FIXES.md`.

**Nothing here changes the picture at rest.** The three fixes (the contact-shadow pass, sleeping rooms, the fire's shadow and world positions) draw the same picture with less work; stills of one frozen instant before and after differ by no more than two stills of the same code.

**Far rooms sleep.** A room more than 50 ft (along the ground) outside every view for a second and a half is taken out of the scene: its floor, walls, things and roof. It is put back the moment it comes within 40 ft of what any view shows (the main view, the picture-in-picture, an area picture), in the same frame, before that frame is drawn. Nothing is unloaded, so nothing loads or pops when it comes back. Pawns, loose things, pings, selection signs and the light of every fire never sleep. A room with something selected, hovered or being dragged in it stays awake. Zoomed out to the whole map, nothing sleeps.

**Lighter picture while moving** (Settings ▸ Me ▸ Graphics, on by default). While you pan, turn, zoom or drag, the frame has a target of a 60th of a second. If frames run over it, effects are dropped one at a time, least noticeable first, and each stays dropped only if it actually bought time on this machine:

1. the fire's shadow stops dancing (it still follows anything that moves near the fire)
2. the fog's swirl steps every second frame
3. things smaller than 5 pixels on screen are not drawn (this only happens zoomed far out)
4. contact shadows go
5. on a high-density screen, and only if frames still take twice the target, the picture is drawn at fewer pixels (it is sharp again when you stop)

A third of a second after the hand stops, everything is back; contact shadows fade in over a third of a second, so they do not pop. What was needed is remembered, so the next move starts there. Under the target, nothing is dropped: on a small map, or a fast machine, the picture never changes. Switched off, the picture is never touched and moving is as fast as the full picture allows.

**What waits for the hand, whatever the switch says:** seating things on table tops, putting far rooms to sleep, and area pictures wait until the hand has stopped; a burst of changes from other seats is drawn once a frame, not once per change.

**Not built:** a tuner for the order and the thresholds (the constants are at the top of `engine/client/interact.js`: `TARGET_MS`, `HOLD_MS`, `FADE_MS`, `NAP_PX`, `STAGES`; `tw.interact.info()` says what is dropped and why).

## Say and roll: announce, then settle (Harry 2026-10-04, as built)
- **Announce.** A said line or a roll appears at once, large (about 30 pt), in a box centred on the screen: a translucent dark plate with the speaker's seat colour as its accent. Everyone who receives the chat line sees it; a client that joins later never replays older lines.
- **Dwell.** It stays up for 1 s plus reading time at 240 wpm: `min(8, 1 + words / 4)` seconds.
- **Settle.** Then it shrinks and flies down into its own line in the chat log at the lower left. This is FLIP: the log line is already laid out but held invisible; the box animates onto it, then the real line shows and the box goes, so nothing jumps. The test lands within 0.1 px.
- **Rolls.** These show `Brakka · d20+5 → 17` big, with the individual dice small underneath. A natural 20 gets a gold total and a soft gold ring; a natural 1 gets a red total.
- **Queue.** Lines that arrive close together show in order. While others are waiting, the dwell shortens, including for the one already up.
- **Dismiss.** A click or Esc sends the current one to the log early.
- **Reduced motion.** With `prefers-reduced-motion`, it fades out where it is and the log line fades in.
- **Bubbles.** The old speaker bubbles are gone; the announce replaces them. Code: `engine/client/surfaces/announce.js`; test: `engine/test/browser_announce.py`.

## Selecting building vs room vs object (provisional, 2026-10-02; Harry to confirm)
- **Default click picks the most specific thing under the cursor:**
  - an object (for a stack, the top item; re-clicking the same spot cycles down);
  - a room's **floor** selects the room;
  - a **wall** selects that wall segment (walls are shared between rooms, and doors and windows are added there).
- **Granularity follows the zoom detent:** at map/overview distance a click selects the **building** (footprint or roof); at table distance, rooms and objects.
- **Climbing, industry standard (Figma):**
  - Shift+Enter selects the parent;
  - Enter selects the children;
  - double-click steps inside.
- **Breadcrumb with the selection** (Inn ▸ Kitchen ▸ Table ▸ Cup): click any level. This is the guaranteed escape hatch.
- **Hover previews what a click would select,** with the outline at the level that would be picked.
- **Marquee** takes things wholly inside the box at the current granularity.
- **Moving a parent** carries its contents.

## Industry standards, premium grade (Harry: "100% industry standard" on every conflict)
- **Selection:**
  - click selects; Shift-click adds; Ctrl/Cmd-click toggles;
  - **left-drag on empty space draws a selection box**;
  - Cmd/Ctrl+A selects all (current room);
  - Esc clears or cancels.
- **Navigation:**
  - pan with right/middle-drag, Space+drag, or two fingers;
  - pinch zooms; the wheel zooms to the cursor;
  - F frames the selection; Cmd/Ctrl+0 resets; Cmd/Ctrl +/− zooms;
  - touch: one-finger drag pans, long-press opens the context menu, long-press-drag selects.
  - **trackpad (Harry 2026-10-04, a MacBook with no mouse):**
    - two-finger scroll pans; pinch zooms (Safari: gesture events);
    - **"Option to rotate"**: Option + drag (anywhere) and Option + two-finger scroll rotate the camera, pivoting on the ground point under the pointer where the move began (exactly like middle-drag); two-finger rotate turns the view (Safari);
    - on empty space, Cmd+drag pans; Cmd/Ctrl+D duplicates (Alt-drag no longer duplicates: Option rotates);
    - a mouse wheel still zooms to the cursor; the wheel's deltas tell the two devices apart (`engine/client/input.js`).
- **Editing:**
  - undo/redo (Cmd/Ctrl+Z, Shift+Cmd+Z, Ctrl+Y);
  - cut, copy, paste; Cmd/Ctrl+D duplicates; Alt-drag duplicates;
  - Delete/Backspace removes;
  - arrows nudge (Shift = 5 ft);
  - Cmd/Ctrl+G groups; double-click enters a group.
- **Menus:** right-click gives a context menu (the same actions the bar offers for that selection); "?" shows the shortcut sheet.
- **Undo** is per person in multiplayer (Figma's model). The GM can also undo anyone's action through a visible ghost trail. A drag, a roll or a paste is one step.
- **Copy/paste** keeps relative layout, pastes at the cursor, works across areas and campaigns, and also writes plain text to the clipboard so a selection can travel through Discord and back.
- **Multi-select** shows one selection box and a count in the bar; actions apply to all.

## Open
- **Bar trigger: `/` or Cmd/Ctrl+K** (decided). Hotkeys come in three layers (standard modifiers, single-letter tools, chords), and a deep chorded menu tree with which-key-style visual feedback is generated from one command registry.
- **Chat: the "say" convention in the bar** (decided).
- **Visual language: quiet, modern, genre-neutral** (decided: it may one day run Vampire: the Masquerade or Call of Cthulhu). Signals to fix either way:
  - each seat's colour (cursor, selection outline, pings)
  - hover vs selected outlines
  - hidden-from-players treatment
  - unconfirmed shimmer
  - one destructive red
- **Other permanent chrome**, now that the bar is at the top: where the roster and presence live, and whether a selection inspector exists.

## Later: a dedicated icon-building session (Harry 2026-10-04)
The current icons are good enough for now ("what you have is great"). At some point we hold a proper icon-building pass: one consistent, painted, quiet-modern set covering every command, toggle state (pin/unpin, hide/unhide…), cursor, launcher and menu node. Generate it through the free Codex image route with one prompt template and style reference, and check it at every size it's used.

## Settings (Harry 2026-10-04): an industry-standard window, the one exception to the tray pattern
A modal window with a category list on the left. Sections in order:
1. **World navigation.** Everyone, filtered by visibility.
   - Every area you can reach, opened here or in the PiP. The GM also creates, renames and deletes areas.
   - **This is also what you land on when you join a campaign.**
2. **Me.** Everyone; lives with the player and follows them across devices.
   - Identity: name, seat colour, avatar.
   - **My pawns (built 2026-10-06):** the pawns I keep in this campaign: a figure picked from our set (a Build-style picker: the Pawns menu's own tree), a name, a sheet link, notes, whose pet it is, my main pawn. Kept with the campaign, no limit, no approval. docs/PAWNS.md "Mine, the bench, and Settings ▸ Me ▸ My pawns".
   - Controls: mouse/trackpad mapping, zoom and rotate speed, invert, keybindings with remapping.
   - Graphics: quality preset, shadows, effects, frame cap.
   - Interface: UI size, announce box and its speed, others' cursors, reduced motion, colour-blind palette.
   - Sound: **separate on/off and volume for Music and for Sound effects.**
   - My agents: LLM seats this player created.
   - **Reset to defaults.**
3. **Area settings.** GM; this area only.
   - Day/night and time, weather, music track.
   - Fog of war.
   - Open to players, or hidden (2026-10-06: "Areas: open or hidden", at the end of this file).
   - Grid.
   - Play rules: free moves, what players may touch.
   - Every field shows "using default" or "overridden here", with a one-click reset.
4. **Global defaults.** GM.
   - Section 3's knobs for every area (areas inherit and can override).
   - Plus campaign-wide items: units, genre default, house look (spawn, lighting, selection), public vs hidden rolls.
   - Graphics are not here: they are each person's own. The first line says so and links to Me ▸ Graphics (Harry looked for them here, 2026-10-12).
5. **Campaign admin.** GM.
   - Save: snapshots and restore.
   - Export and import.
   - Invites, seats and roles, revoking access.
   - Session keys and permissions for GM-created LLM seats.
   - **Players may also import and export, subject to GM approval.** A request appears for the GM, who approves or denies it.
6. **Feedback (2026-10-19).** Everyone: a ticket of any kind and My tickets. "Feedback" at the end of this file.

### Keys and pictures (Harry 2026-10-04)
- **S opens Settings, always on World navigation.** Then a letter picks a section: **N** World navigation, **M** Me, **A** Area settings, **G** Global defaults, **C** Campaign admin, **F** Feedback (2026-10-19); each entry shows its letter (the 1–5 numbers are gone). S again (or Esc) closes it.
- **The hotkey rule:** a single letter is a game-wide tool only when free (now: B Build, P Pawns, S Settings, R turn (a thing 45°, a selected room 90°), O open / close or light / put out (2026-10-20), L room and building labels on / off (2026-10-20; L was light), F frame, Q/E rotate the view, N next turn (Shift+N previous) while there is a turn order, X the GM's pawn X-ray). Letters inside an open tray or window (the Build tray, Settings) belong to it and never reach the game, and are ignored while a text field has focus. So chord letters may reuse game letters safely (S then A doesn't touch anything bound to A).
- **World navigation shows a 3/4 picture of each area** with its name and "updated …":
  - Opening navigation refreshes picture metadata, so another seat’s newly uploaded picture appears even when this list was opened recently.
  - **Framing** (`engine/core/framing.js`): the box of the area's rooms. When they are spread out, far outliers are dropped as long as ≥ 85% of the structure area stays in. It is seen from the home yaw and pitch (−20°, 52°) and fitted with a 6% margin.
  - **Generation:** not live. About 15 s after an area's last change, the client of whoever has it open (the GM; with no GM online, the online person with the lowest seat id; never an AI seat) renders it with the real look. Selection, cursors, labels and **anything hidden from players** are left out. It is 480×300 WebP and is uploaded to the relay (`POST/GET /c/<id>/a/<area>/thumb`, `GET /c/<id>/thumbs`; human seats that can see the area; WebP only, ≤ 300 KB).
  - **Who sees what:** players only get pictures of areas they can see. An area nobody has visited shows a placeholder with its name.

### As built (2026-10-04, `engine/client/surfaces/settings.js`)
- **The window:** a modal over everything, with the categories on the left, numbered 1 to 5. Esc, the × or a click on the backdrop closes it.
  - Players see only World navigation and Me; their request buttons are in Me.
  - Typing in a field never reaches the game's hotkeys.
- **No landing screen (Harry 2026-10-05).** Opening the game (turnipworks.net, a campaign link, a reload) goes straight into the game: the area the seat was last in, or the campaign's default area. A visitor with no campaign link resumes this browser’s most recent remembered seat; a browser without one gets the short "new campaign" form, then the game. Settings is never opened for you.
  - "Always open on World navigation" is about the Settings window: S or its button opens it on World navigation every time, whichever section was open last.
  - History: from 2026-10-04 a seat's first join opened Settings at World navigation. That was a misreading of the line above and is removed, with its `?landing` switch.
- **Opening an area from World navigation starts on its picture's view (Harry 2026-10-05).** "Let's drop into the camera view and scale that was shown for making the screenshot."
  - The picture is stored with the camera it was shot from (focus, heading, pitch, distance; the relay keeps it beside the image). "Open here", or a click on the picture itself, puts the main view on that camera at once, with no glide.
  - **When the view is not the picture's shape** (the picture is 480×300, 1.6 wide): focus, heading and pitch are the same. The field of view is vertical, so the same distance shows the same height of world. A wider view keeps the distance and shows more to the sides. A narrower view backs away until the picture's full width is in view (distance × 1.6 ÷ the view's aspect). Nothing in the picture is ever cut off.
  - "Open in PiP" does the same in the PiP, and holds that view (it does not chase the pawns) until you move it. Following someone's pawns from the roster is unchanged.
  - An area with no picture yet, or a picture made before cameras were stored, opens on the camera a picture taken now would use.
  - Other ways of changing area (the roster, the command bar's "go to") are unchanged: they keep the camera where it was.
- **The PiP swap keeps each area's camera (Harry 2026-10-05).** "Swap for PiP should maintain camera view and scale."
  - What was in the PiP fills the main view on the PiP's camera, and what was the main view goes into the PiP on the main view's camera: same focus, heading and pitch on both sides. Neither side resets to a default. (Before, the two areas traded places but the cameras stayed put, so each area was shown through the other's camera.)
  - Distance follows the same shape rule as above, so the side that lands in a narrower frame backs away just enough to keep its width.
  - Swapping back returns both cameras exactly, unless you moved one in between.
  - After a swap the PiP holds its view rather than following pawns.
  - Code: `engine/client/views.js` (`fitPose`, `swapPoses`), `engine/client/thumbs.js` (`enter`). Tests: `engine/test/browser_settings.py`, "CAMERAS".
- **What is wired:** everything that has a system behind it goes through the real commands and permissions.
  - New core commands, with tests in `core.test.mjs`:
    - `area.set`: name, play settings, grants;
    - `area.delete`: there is always one area left, and whoever was in the deleted area moves to the first;
    - `campaign.set`: name, defaults;
    - `request.create` and `request.resolve`;
    - `seat.set` can now change the colour.
  - New permission classes:
    - `seat.self`: players edit their own name and colour;
    - `request`: players ask for an import or export;
    - `campaign.admin`: GM only.
  - Areas can grant individual seats access beyond their visibility rule (`canSee`).
- **Play settings are inherited:** built-in, then the campaign default, then the area's own value. Clearing a field (`null`) goes back to inheriting (`core/state.js areaRules`).
  - The relay enforces "free moves" and "what players may touch" for players.
  - Lighting picks a profile from the tuner's built-in lighting looks; the grid toggle shows or hides the grid.
  - Fog of war and the music track are stored, but nothing uses them yet ("coming").
- **Me** lives in this browser (`tw.prefs`), except name and colour, which live on the relay.
  - Controls: zoom and rotate speed and invert reach every camera input: wheel and pinch zoom, orbit drags, and (through the one `rotateView` in `input.js`) Option-scroll, Safari's rotate gesture and Q/E.
  - Graphics: see "Graphics: what the picture costs" (2026-10-11). Geometry detail is its own row: it applies at once, every world's object and shell visuals are rebuilt in place (`app.setFaces` → `AreaWorld.refreshVisuals`), as the tuner's faces dial does. A `?faces=` URL still wins.
  - Display: ring size (`setRingScale`), text size (`--ts`, which zooms the chrome), announcements on/off and speed, others' cursors, and reduced motion (the `reduce-motion` class; announcements fade instead of flying).
  - Sound settings are stored but do nothing yet.
  - My agents: create, copy key (the rules card URL), revoke.
  - Reset to defaults.
- **Campaign admin:**
  - Snapshots are kept on the relay, per campaign, GM only (`/c/<id>/snapshots`, files under the campaign's data dir, at most 50), so they follow the GM between devices; any an older build kept in the browser move up on first load. Restoring one runs `entities.set`, so undo brings back what it replaced.
  - Export is a JSON file of every area the seat can see; import adds those areas as new ones. glTF, TaleSpire and STL buttons are placeholders.
  - Invites (copy link) and revoke.
  - GM agent seats get exactly the permissions ticked.
  - Player requests: an approved import applies the player's file; an approved export gives the player "Export now".
- **Tests:** `engine/test/browser_settings.py`, one block per section.

## Areas: open or hidden, and travel (Harry 2026-10-06, as built)
The rules and Harry's words are in docs/PAWNS.md, "Areas: travel, and keeping surprises hidden". What is on screen:

- **The GM always knows.** While the GM is in a hidden area a constant button sits at the top centre, under the command
  bar: the area's name with the eye-off mark, then "Hidden from players · Open this area". It is not a conditional
  button: it never fades. In an open area the same place reads "<name> · Open to players · Hide".
- **The hidden look for an area is the hidden look for a thing:** the hidden violet (`--hidden`), a dashed edge, the
  eye-off mark. It is on the name tag, on a dashed frame round the whole view, and on a picture-in-picture's frame and
  title bar when the area it shows is hidden (its title bar carries a "Hidden from players" button that opens it).
- **One mark in every list** (`app.areaMark`): Settings ▸ World navigation, Settings ▸ Area, the travel list, the
  roster's place labels, the command bar's places ("area · hidden").
- **Settings ▸ World navigation** (GM): each row says "Open to players" or "Hidden from players" and has an Open / Hide
  button; the new-area form has no visibility choice and says "A new area starts hidden from players, until you open
  it." **Settings ▸ Area** has one switch, "Open to players" (the three-way rule and "Also granted to" are gone).
  **Settings ▸ Global defaults ▸ Travel** has "Players travel between areas".
- **A pawn's ☰ has "Send to area ▸"** (Space Z), last before Delete: a sub-menu at its button, one tile per area the
  pawn can go to (a picture of the area when there is one). A hidden area's tile is dashed violet with the eye-off mark
  and "hidden from players"; its tooltip says whether sending this pawn opens the area. A player whose travel is locked
  gets one tile, "The GM has locked travel".
- **Conditional buttons added** (they follow the existing rules and go down into the chat):

| Button | Appears when | Home | Its line in the chat |
|---|---|---|---|
| **Bring <pawn> back** | a player's pawn travels out of the GM's area | where the pawn stood | "Brakka went to the Crypt · [Bring back]" |
| **Send <pawn> back** | a player's pawn travels into the GM's area | a fixed slot: bottom centre, upper row | "Brakka came from the Inn · [Send back]" |
| **Opened <area> for players · Undo** | the GM sent a player's pawn into a hidden area | the same slot | "Opened the Crypt for players (Brakka went in) · [Undo]" |
| **Follow <pawn> to <area>** | someone else sent your pawn to another area | the same slot | "Brakka went to the Crypt · [Follow]" |

  "Opened … · Undo" is the one case where the GM gets a button for their own action: Harry asked for it by name,
  because that send also changes who can see an area.
- **Command bar:** "travel to <area>" (the selected pawns, or your own pawn when you have exactly one), "Open this area
  to players", "Hide this area from players", "Lock travel between areas (players)" / "Unlock…", "Travellers arrive
  here" (places or moves the arrival mark at the selected thing, the cursor, or the middle of the view).
- Code: `engine/client/surfaces/areas.js`. Tests: `engine/test/browser_areas.py`.
- **Gemini, blind** ("is there anything on this screen telling you about who can see this map?"): in the hidden area it
  quoted the button, "Hidden from players · Open this area", "a purple button with an icon of a crossed-out eye"; on the
  Settings list it read "Open to players - you are here" for one area and "Hidden from players" for the other; with a
  picture-in-picture of the hidden area it said the main view is "Open to players" and the small window's title bar
  "explicitly states, 'Hidden from players.'"; of the travel list, "Zxqcrypt of Morrowgloom" and below it "hidden from
  players", with "a large icon of an eye with a line through it". (Its first read of the travel list found the name cut
  off and no word "hidden": the tile was widened and the words moved under the name.)

## The loading screen (Harry 2026-10-07, as built)

Harry: "a simple but a high impact thing. I think we need a loading screen. Nothing crazy, take lessons from the
mapgarden loading screen." Then, on the plan: "Lets logo with a turnip in front of crossed wrenches (skull and
crossbones style)", and on the bar: "also *not* an honest bar.. since we know we are going to hiccup at the end in a
way that can't be managed, lets make it so that happens around 77% or so, maybe even some fuzzing on that", "You're
always fine hitting 77% and then just being done, people are pissed if 98% hangs another 30 seconds."

**What it was like before (measured, `experiments/2026-10-07-loading/README.md`):** a near-black empty page from the
first paint until the first frame of the table (about 2 s on the live site in Chromium on the build box, 2.4 to 8.5 s in
Firefox there), in a light-scheme browser a flash from dark to cream with the game's buttons over nothing, then the
table made of grey stand-in boxes while the meshes arrived. The page was frozen for the last quarter to half second
before that first frame (3 s in Firefox on software drawing).

**What it is now.** One screen, in the page itself (`engine/client/index.html`: styles, markup and about a hundred
lines of code, before anything else is asked for), in the house colour (a warm firelit brown, the same in both themes,
because the table it gives way to is the same in both):

- **The mark** (below), the name set in type, one bar, one line of words: **"Fetching the game"**, **"Opening your
  table"**, **"Setting out the room"**. No percentages, no technical words, no tips.
- **It is painted before any script or stylesheet has answered** (the stylesheet link moved below it in the page).
  The theme is also chosen there, so a light-scheme browser no longer flashes dark first.
- **Only `transform` and `opacity` move** (the bar's length, the mark's slow sway, the words crossing over): those are
  the two things a browser keeps animating while the page itself is busy.
- **The bar, as Harry asked, is not a measure of time left.**
  - While the game's code is fetched it follows the files that have really arrived (against how many it took last
    time in this browser), over the first half of the way to the stall point.
  - The moment that code starts, the browser's compositor is handed the rest as ONE plan: on to a **stall point near
    77% (somewhere in 70 to 80, new on each load)** in the time that took last time, then a creep of four more points
    for as long as the freeze took last time for this table. So the freeze that ends every load finds the bar in the
    70s, moving a little, whether or not the page can still think. The band is 70 to 84 in all: below 70 reads as
    "barely two thirds", and from the high 80s up a wait reads as "stuck at the end", which is the one thing ruled out.
  - **When the opening view is whole (below), the screen leaves from wherever the bar is** (a 0.2 s fade).
    It never runs out to 100 and never waits in the nineties.
  - What it remembers lives in this browser (`localStorage` `tw.load`: file count, milliseconds to the state (the
    quickest of the last three loads: guessing short parks the bar at the stall point, guessing long would have the
    screen leave with the bar a third of the way), and the freeze per table for the last 12 tables). A first visit uses guesses (1.2 s and 1.5 s) and may leave with the bar
    half way; that is allowed.
- **The console says the real numbers**, for a slow machine to report: `tw load: game fetched 217 ms, look 222 ms,
  table opened 130 ms, state 6 ms, room set out and first frame 231 ms, the room's pieces 1011 ms (98 of them); first
  frame at 806 ms, screen left at 1817 ms (bar held near 78%)`. `tw.loadHold` in the console has the wait as data
  (`{ ms, pieces, left, capped, warm }`).
- **It leaves when the opening view is whole (2026-10-11).** Harry: "Let's add the stuff needed to load that first
  common room into the loading that happens on the pre-loading loading bar. We want that first demo moment to pop
  instantly." It used to leave with the first true frame, and the room then filled in: grey stand-ins swapped for
  meshes over the next seconds. Now, on the first load, it stays until:
  - **every piece under the opening camera is in** (things and wall, floor and door pieces of buildings that are
    awake; a piece that fails counts as in). On a table that already has rooms this is the whole wait;
  - **on a new table, where the intro is about to play, the pieces of the room the intro will build.** "The first
    common room" is that room: the intro's phantom builds a Tavern & inn › Common room, 6 × 4 squares, a moment after
    the screen lifts. The game decides the room's seed before the intro plays, works the room out itself (the same
    engine the relay runs, so the same layout: a test compares the two), and sets it out in a world nobody sees. That
    fetches its meshes and textures, about a hundred pieces, and puts the textures on the graphics card. The phantom
    then sends that seed, and the room's spawn starts the moment it arrives;
  - things that stand on tables have been seated (at most 1.5 s more);
  - then two more frames, so the frame that first draws everything (and compiles its shaders) is behind the screen.
  - **It gives up after 15 s past the first frame** and leaves with whatever is still missing, as it used to. **On a
    line too slow to make that, it gives up early:** from 5 s on, if fewer than half the pieces a steady pace to 15 s
    would have brought are in (under a sixth at 5 s, under a third at 10 s; counted in files, which arrive steadily,
    not pieces, which finish in lumps), it leaves at once, since waiting longer would
    only show the same stand-ins later.
  - **The bar through this wait:** where the pieces took more than 0.6 s last time in this browser, the bar reaches
    the first frame a fifth short of the stall point and the files arriving carry it the rest of the way (at most
    four steps a second), so the stall
    point is still where the last freeze is. On a first visit the bar is already in its band and creeps there.
  - Travelling to another area is as before (its first frame); so is everything after the first load.
  - **What it costs and buys (the build box, the live site, medians of 3; `experiments/2026-10-11-firstload/README.md`):**
    new table: the screen stays 1.6 to 2.0 s longer, and the phantom's room, which used to sit unseen for 1.9 to 3.9 s
    after the phantom let go, starts its spawn at once. Joining a table with one inn: the screen stays 7.5 to 10.6 s
    longer and leaves onto the finished room, where it used to leave onto 388 grey stand-ins that took 4.5 to 10 s to
    fill in.
  (The spawn animation still does not play for rooms that are already there on a first load: see "Open".)
- **It never takes the pointer** and is removed, not just made see-through, when it has faded.
- **Reduce motion** (the browser's preference, or Settings ▸ Me ▸ Reduce motion): the mark stands still; the bar
  still fills. **Small screens:** a smaller mark and name under 480 px either way; the button is 44 px tall.
  **Screen readers:** one polite live region that hears "Turnip Works is loading", "Opening your table", then nothing
  more (or the sentence of a failure); the moving words are hidden from it.

**When something fails, the same screen says so in a sentence and offers one thing to do** (the bar goes away):

| what | the sentence | the button |
|--|--|--|
| an unremembered link opens no table (bad or revoked seat, deleted campaign) | "This invite link does not open a table any more. Ask whoever runs the game for a new link." | Start a campaign of your own |
| the relay does not answer within 8 s | "The table cannot be reached just now. It may be restarting: this page keeps trying, and opens by itself when it answers." | Try again now |
| the game's code or its look did not arrive | "The game did not finish downloading. Try again; if it fails a second time the fault is at our end, not yours: tell whoever sent you the link." | Try again |
| no WebGL | "This browser cannot draw the table: 3D graphics (WebGL) are switched off or missing. Try another browser, or switch on hardware acceleration in its settings." | Try again |
| nothing has arrived for 25 s (45 s once connected) | "This is taking much longer than usual. It may still arrive; if the connection dropped, try again." | Try again |

**Invite links (2026-10-11).** An invite link is the address of the page the GM is on plus `#s=<seat>`
(`app.inviteLink`). So the GM's own address must be an address that opens the game: after the start form the page
writes its address out in full (`location.pathname + location.search + '#s=…'`), never a bare `#s=…`, which resolves
against the page's `<base>` (on turnipworks.net: `/engine/client/`). From 2026-10-07 to 2026-10-11 it did exactly that,
and every link copied from a freshly started campaign opened the other site's page, which cannot fetch the look from
turnipworks.net: friends read "The game did not finish downloading." turnipworks.net now serves the game at
`/engine/client/` and `/engine/client/index.html` too, so the links sent in those days open. Test:
`engine/test/browser_join.py` (start form, invite link, a fresh browser, the old address, a dead link).

**The other waits.**
- **Starting a campaign from the form:** the form gives way to the same screen ("Opening your table") and the
  campaign opens **in the same page**. It used to reload the page, which fetched and started the whole game a second
  time. The form itself now carries the mark.
- **Travelling to an area that is not loaded yet:** nothing at all if the area arrives within 0.35 s; otherwise the
  same full screen, "Travelling to <area's name>", until the area's first frame. Full screen because there is nothing
  true to show meanwhile (the view is an empty dark rectangle until the state arrives).
- **The relay restarting (every deploy):** after half a second, a small pill low in the middle, the mark and "The
  table is reconnecting…", no bar (nobody knows how long), the pointer goes through it; gone the moment the table
  answers. Before, the only sign was the word "offline" in grey 11 px type in the corner.

**The mark.** A turnip where the skull would be, in front of two crossed spanners where the bones would be, jaws up,
ring ends down. `engine/client/mark.svg` is the one file (64 × 64 units, five colours, a dark outline so it holds on
light and dark); it is the page icon, it is on the start form, and the loading screen draws the same paths inline (a
test compares them). Served at `https://turnipworks.net/engine/client/mark.svg`. `mark-plain.svg` is the same without
the two eyes.

Code: `engine/client/index.html` (the screen, `window.twLoad`), `engine/client/main.js` (seven calls: `LOAD.at('code' |
'look' | 'welcome' | 'state' | 'first')`, `LOAD.pieces(done, total)`, `LOAD.done()`, `LOAD.fail`, `LOAD.wait` /
`LOAD.clear`; "THE HOLD": `holding`, `warmRoom`), `engine/client/world.js` (`unsettled`), `engine/client/intro.js`
(`plan`). Test: `engine/test/browser_loading.py` (Chromium and `TW_BROWSER=firefox`; section J is the first room and
the intro's one cursor). Measured: `experiments/2026-10-11-firstload/README.md`.

**What a test can show about motion while the page is frozen.** In Chromium the suite blocks the main thread for
2.5 s in a busy loop and watches the page through the screencast (frames the compositor made): the bar grew in every
one of 22 pictures and the mark moved between all of them. A plain screenshot cannot show this (it waits for the main
thread), and in Firefox under the test driver no picture can be had during the block, so there it is **not verified
by a test**; what stands for Firefox is the hand measurement of 2026-09-24 on Harry's Mac (CSS transform kept moving
through a 6 s block in both browsers). **Nothing keeps moving through a stall of the whole browser's graphics process**
(the first compile of the shaders can do that): no test here produces one, and the screen does not promise motion
through one, only that the bar is in the 70s when it happens.

**Gemini, blind** (stills with neutral names; all its words are in `experiments/2026-10-07-loading/README.md`): "a
loading screen for a web application or game called 'Turnip Works'"; it read the three lines and what each means; "The
design is minimalist and clean"; on a phone "the responsive design works well"; its verdict "plain: simple, clean, and
functional but not visually elaborate". Beside the game: "almost certainly belong to the same product", a cross-fade
"would feel very natural and smooth". Of the mark: "a direct parody or homage to the Jolly Roger (skull and
crossbones)". In Firefox it called the bar "a simple, sharp-cornered rectangle" (it is: a stretched fill cannot keep
round ends). The reconnecting pill first sat under the command bar and Gemini saw it collide with the area's button;
it is low in the middle now ("not obscuring any critical map features or UI controls").

**Decided without Harry (he could not be asked); each is one line to change:**
- The eyes. He said no face "unless it reads better with one". Gemini, blind, on the final drawing: the plain one
  "becomes a small, pixelated blob" at the smallest size, with the eyes "the two high-contrast dots ... remain
  surprisingly legible" and "reinforce" the skull (on an earlier drawing it preferred the plain one). `mark-plain.svg`
  is ready if he prefers it.
- The house colour is a warm brown (`#6a5c48` to `#2c2823`), taken from the average colour of the table's first
  frame, not the interface's near-black.
- The name is set in the system's serif (Georgia and its kin): no font is fetched for this screen.
- The stall band 70 to 80 plus a creep of 4.
- Travel shows the full screen after 0.35 s rather than a pill (a travel on a quick connection takes about 0.3 s, and a
  screen for its last tenth of a second would be a flash); reconnecting shows a pill after 0.5 s.
- A link with no seat shows the same screen ("Fetching the game") until the start form is ready, then the form, with
  no fade.
- Starting a campaign no longer reloads the page.
- A relay that has not answered in 8 s is said to be unreachable; 25 s of nothing arriving is "much longer than usual".

**Open.**
- On a first load the room does not assemble with the spawn animation: its stand-in boxes are swapped for meshes as
  they arrive, as before this work. Playing the spawn-in for the rooms in view as their meshes land would make the
  load the opening shot; it is a feel decision and a change to the load itself, so it is not built.
- The landing page and the tools still show the old brand tile (a "T" on a maroon blob).

## Three small notes, 2026-10-11 (as built)
Test for all three: `engine/test/browser_smalls.py`.

### The Build library draws every thing the same size (a TRIAL)
Harry: "In the object libraries, let's try making all objects the same size instead of having the relative sizes correctly."
- **What changed:** in the Build library (the knolled area in the picture-in-picture) every thing is drawn so the longer side of its footprint from above is 3 ft. A cup is as big as a wardrobe. Labels, spacing and the camera's framing follow.
- **What did not:** a thing dragged or copied out is its true size, upright, as before. Nothing is stored or sent: the scale is a drawing scale on the library's own local things (`libK`).
- **The other pictures were already like this.** The turning previews in the command bar, on the cursor and in "Replace with similar" have always filled their slot (`engine/client/previews.js`). Figure pictures are baked images, each figure filling its frame. So nothing was regenerated.
- **THE SWITCH (to compare, and to go back):** Settings ▸ Me ▸ Interface ▸ **Library: everything the same size**. Off = true relative sizes, exactly as before the trial. Also in the command bar: "Library: show true relative sizes" / "Library: show everything the same size". The open library is laid out again at once. It is per browser.
  - What a browser that never chose gets: `LIB_EVEN` in `engine/client/library.js` (now `true`). The size: `EVEN_FT` beside it.
  - To end the trial for good: set `LIB_EVEN = false`, or delete the switch and `libK`.
- **Lost while it is on:** the library no longer shows how big a thing is. Its true size shows only once it is in the world.

### Fog off, for me
Harry: "lets add a 'fog off' option to settings."
- Settings ▸ Me ▸ Graphics ▸ **Fog and mist**. Command bar: "Fog off (no fog, mist or haze for me)" / "Fog on". Per browser, remembered, default on.
- **Off:** no ground fog, no fog in rooms (whatever a room's Fog height says), no fog sea, no haze, no dust, no ceiling smoke. The fluid is not simulated either: the atmosphere's frame returns before its window, splats and step (`setOff` in `tools/spawn-tuner/js/fx/atmos.js`).
- **Stays:** smoke rising from fires, candle wisps, the puff when a fire is put out. They belong to the fires.
- **Only your own view.** Other seats keep their fog. A room's Fog height is still stored and still changes for everyone else.
- **This is decoration, not fog of war.** What a player may not see is never sent to that player by the relay, so there is nothing under the fog to uncover. The game gives the atmosphere no "hidden" places at all (tested). The Area setting called "Fog of war" is a different thing, stored and not built.
- **Area pictures** (the thumbnails in World navigation) are taken by one seat for everyone. If that seat has fog off, the picture has no fog. The same is already true of roofs.

### The depth look is dropped
Harry: "The 'poor focus' on lower levels is not really working out. I think we should drop it."
- Looking at an upper level, what is below it is drawn sharp and at full brightness. The blur and the dimming were one effect ("the depth look"); both are gone.
- Removed, not switched off: the pass (`fx/depth.js`), the tuner's Depth panel (`fx/depthpanel.js`), the game's focus height (`tw.depthFocus`), the tests for them.
- **Left in place:** the write-back server still accepts and returns a `depth` field in the house look (`server/ratings_server.py`), and the stored house record still has one. Nothing reads it.
- **Frame time: no measurable change.** Looking down from an upper level (two-storey inn with a yard, 1920×1080, RTX 3060, uncapped, about 7.8 ms a frame), the pass was switched on and off in turn in one page: 40 pairs on a quiet box, mean difference 0.01 ± 0.13 ms, slower with it on in 22 of 40; a second quiet run of 30 pairs, median difference 0.0. (A run made while the box was heavily loaded gave 0.8 ± 0.2 ms; the quiet runs do not bear it out.) So under about 0.3 ms either way. On the ground floor or with all levels shown the pass was already skipped.
- **What tells you a thing is on a lower level now:** only the picture itself (walls cut away above, the floor edge). If that is not enough, the cheap choice is dimming alone, with no blur.


## Rulers and templates (Harry 2026-10-11, as built 2026-10-12)
Design, Harry's words, the exact tests and the choices made without him: **docs/RULERS.md**.
- **Dragging a pawn shows how far it has gone**: a line from where it stood and "30 ft · 6 sq", for everyone who can
  see the pawn, in both pawn modes (free; snapping to squares). No tool, no key.
- **M measures** (hold, or tap, like P, B and S). Hold M with a pawn selected: a ruler from that pawn to the pointer,
  at once. Otherwise drag from A to B. An end on a pawn sticks to it, measures base edge to base edge, and follows.
  Both ends drag again. A click elsewhere or Esc lets it go; a press on a pawn does not. Never stored.
- **True distance** is the rule; Settings ▸ Global defaults ▸ Distance offers the two square-counting rules.
- **Shapes by contextual buttons**: after a measurement, Line · Cone · Circle · Sphere · Cube (keys 1 to 5, only while
  a measurement is in the hand; `cone 15` and the rest in the bar). Then one persistent bar: Keep (K) · 1 round · N rounds [number] · Attach to pawn (when the origin is on a pawn). Duration and attachment combine, further toggles update the same template, and the whole keep session has one undo. Esc, click-away or 8 seconds idle dismiss it.
  This row is the conditional-button pattern with several buttons: it exists only while its measurement does, sits
  beside it, never takes the focus, and everything on it is in the bar and on a key. It leaves no chat line (its
  condition simply ends).
- **Who is caught**: a red ring round each caught pawn, the count on the label, the names on hover; the speech-bubble
  button posts them in the chat.
- **Keys:** M, K and the digits 1 to 5 were free. In use now: B, P, S, R, O, L, F, Q, E, N, X, M, K, `.`, `/`, `?`,
  `=`, `-`, `[`, `]`, `\`, and 1 to 5 while measuring.
- **Presence:** a ruler being drawn, a dragged pawn's line and an unkept template are sent with the cursor
  (docs/NETCODE.md); other seats draw them in the measurer's colour.
- Code: `surfaces/rulers.js` (`RULER_KEYS`, `RULER_LOOK`), `core/measure.js`. Tests: `engine/test/browser_rulers.py`,
  `engine/test/rulers.test.mjs`.

## Graphics: what the picture costs (Harry 2026-10-11, as built)

Harry: "this thing cooks the GPU ... we might just need to cut some of these features, or at the very least have toggles." Numbers and method: `experiments/2026-10-11-graphics/README.md`. Code: `engine/client/graphics.js`, and one "viewer" switch in each effect module under `tools/spawn-tuner/js/fx/`. Test: `engine/test/browser_graphics.py`.

**Two costs.** Work per frame: every pixel is shaded by several passes, and a 2× screen has four times the pixels. Work per second: the game drew every frame for ever at the display's rate (120 a second on a MacBook Pro), though a tabletop is mostly a still picture.

**All of it is yours alone.** Settings ▸ Me ▸ Graphics, this browser only (`tw.prefs`). Never sent, never the house look, never what another seat sees. No switch touches the look's own dials (tested byte for byte).

### The preset
- **Quality: Auto · Low · Medium · High** (and **Custom**, shown while it is one).
- **High is the full look**: every effect, every flame a real light, native resolution. It is what the game drew before 2026-10-11.
- **Medium**: a pool of the 8 nearest real lights, contact shadows and fog at half resolution, the fog stepped every other frame, 1.5× pixels at most.
- **Low**: a pool of 4 real lights, no fire shadow, no contact shadows, no fog, steady fires, plain water, 1× pixels.
- A preset writes the switches below. Change one switch by hand and the preset reads Custom.
- **A new viewer is on Auto.** Auto starts at High. Once the first area is up and still, it measures about a second and a half of frames. It steps down only when frames are slower than 45 a second, or (where the browser can say) the picture takes more than 12 ms of GPU time a frame. A step is kept only if it bought 10%; otherwise it is put back and Auto leaves the picture alone for that visit (a big map is slow for other reasons). Later, 240 slow active frames in a row start the same check.
- **Auto never changes the picture silently.** One line appears: "Graphics: Auto chose Medium for this machine (frames took 31 ms on High)", with **Undo: use High**. Undo sets High by hand, and Auto never overrides a choice made by hand. Settings shows the same line for as long as it holds. Auto's pick is remembered; choosing Auto again measures afresh from High.

### The switches (each skips the work; none compiles a shader)
- **Real lights from fires**: Every flame · the nearest 16 · 8 · 4 · None.
  - With a number, exactly that many point lights are in the scene, always: the lit flames nearest the view's focus, and black stand-ins if there are fewer. A light near the edge of the pool fades out before it is swapped. Fires come and go, the view moves, rooms sleep: the count never moves, so nothing is compiled.
  - A flame that is not a real light still burns (flame, embers, smoke, lantern glass) and lights nothing. A candle's own halo grows a little so it and the top of its holder still read as lit (the same draw call, no light: `HALO` in `fx/fire.js`).
- **Glow under far fires** (in no preset; command bar "Glow under far fires: on / off"). The stand-in for the light of flames that are not real lights.
  - **Off in the game until Harry sends a look for it.** Left alone, the switch follows the house look: on only once a far-fire glow has been sent from the Spawn Tuner's Far-fire glow panel with "Use in game". A viewer can switch it on or off for themselves to compare.
  - The first version (a flat additive disc on the floor under each flame) is what Harry called "much much worse than nothing at this point" (2026-10-12). Measured against the real lights it was six times farther from them than no stand-in at all (`experiments/2026-10-12-glow/README.md`).
  - What it is now (`fx/farglow.js`): each light left out of the pool is drawn into a small floor-plan light map (one instanced draw for all of them; one tile per storey; it stops at walls, doorways open), and one pass over the picture brightens what is already there by that light: floors, walls, table tops, the sides of things. It multiplies the surface, as a light does; it adds no colour of its own. Each stand-in uses the numbers of the real light it replaces. No shadows, no shine.
  - A flame that changes between real light and stand-in cross-fades over 0.4 s (a dial).
  - The old disc is still there as the look's "floor disc" mode.
  - Changing the number does change the count, and the count is in every shader. It is done in two steps: the lights that will go are dimmed to nothing at once, and the count changes only when the programs for the new count have been built in the background (`renderer.compileAsync`).
  - On a big map this is most of the GPU cost: every pixel is lit by every real light.
  - With a pool, a lantern's beam (a spot light) is never real.
- **Shadows from fires and lamps.** Off: the shadow map is drawn once more with nothing in it, then never again. The light still "casts" as far as three.js knows, so the light state is the same.
- **Contact shadows.** Off: the pass is out of the stack and its buffers are given back.
- **Fog and mist** (the switch of "Three small notes"). Off: nothing drawn, nothing simulated.
- **Soft effects at half resolution.** Contact shadows in N8AO's half-res mode (a second pass, built once, swapped in: flipping the mode on one pass recompiles it every time), the fog's target at half the pixels each way, the fog's fluid stepped every other frame.
- **Water effects.** Off: water is a plain surface; nothing is simulated or mirrored.
- **Fire flicker and sparks.** Off: fires burn and light the room steadily, no embers or smoke, and the shadow is not redrawn for the dance.
- **Render resolution**: Native (the screen's own, up to 2×) · 1.5× · 1×. The 3D canvas only: text, menus and labels stay sharp. The row shows the pixel count in use.
- **Frame rate limit**: the display's own · **60** (the default) · 30.
- **When nothing is happening**: full rate · 30 · **20** (the default) · 10 pictures a second.
- **Lighting effects** (the whole post stack), **Geometry detail**, **Lighter picture while moving**: as before, not part of a preset.

### There is no sun shadow to switch
The key light (`AreaWorld.sun`) casts no shadow in the game and never has. Its shadow camera is set up and unused.

### The idle rate
- After 2 seconds with no input, no camera movement, no drag, no spawn animation, nothing loading and nothing arriving from the relay, the picture is drawn 20 times a second. Fog still drifts and fires still burn: every simulation steps by time, not by frame (the ripple simulation takes up to 10 steps in a long frame).
- **The hand comes first.** The loop still wakes every display frame and only skips the drawing. Any pointer, key, wheel or touch event, a change from another seat (their cursor too) or a camera move brings the full rate back on the very next display frame.
- **A hidden tab draws nothing.**
- Constants: `IDLE_AFTER_MS`, `IDLE_FPS`, `MAX_FPS` in `graphics.js`.

### Water effects run only for water worth them
- Ripples, the copy of the frame for refraction and the traced reflections run only while a body of water (a river, canal, pond or lake) is inside the view.
- Otherwise visible water is drawn the plain way: one blended draw. With no water in view nothing runs.
- In the game a cup, a barrel, a trough or a font never switches the effects on and never ripples (`plainVessels`). The tuner's Water panel keeps vessel ripples.
- A new body's program is built in the background when the body is made, so water coming into view compiles nothing.

### The selection glow is cut
Harry: "we can definitely cut 'selection glow' as bringing almost nothing to the table."
- The glow was the `halo` style: a second copy of the thing's own triangles, pushed outward and drawn glowing. It was never a full-screen pass.
- The game no longer draws it for any state (`noGlow` in `world.js`). Selected: the house brackets. Hover and hidden: as the house look says. "Waiting on the relay" was a fast-pulsing halo and is now a thin dashed outline on the ground.
- A house look that asks for the halo gets brackets (selected) or the thin outline (the rest).
- The old fallback (a glowing hull, used when the tuner's selection module did not load) is deleted.
- **Left in the tuner:** the Selection lab still lists "Glow halo". Two tuner suites (`sel_ui.py`, `sel_shots.py`) are built on it. Picking it there has no effect on the game.

### The FPS meter and the command bar
- The FPS meter adds the preset (and Auto's pick), the pixel ratio, "(idle: 20 a second)" or "(limit 60)", and GPU time a frame where the browser has the timer (Chromium; not Firefox or Safari).
- Command bar: "Graphics quality: auto / low / medium / high", "Real lights from fires: …", each switch, "Render resolution: …", "Frame rate limit: …", "When nothing is happening, draw: …", "Geometry detail: …".

### Under a test driver
The idle rate, the frame-rate limit and Auto do nothing under `navigator.webdriver` unless the test sets `tw.gfxForce = true`. They follow the clock, and suites about something else would pass or fail with the load on the box. (The governor in `interact.js` has the same rule.)

### Also fixed
The governor's last stage ("fewer pixels while moving") changed the canvas but not the post stack's buffers, so it saved almost nothing. It now resizes them.

## Factions (2026-10-13)

**Faction** is the user-facing name for the internal `flavor` property. A building supplies its rooms' faction; a room may override it; an individual faction piece may override its room. Rooms, buildings and faction pieces' **☰ → Faction** opens two rows of emblem buttons (names on hover and for screen readers). Rooms offer **As the building's**, pieces **As the room's**. A dashed emblem is inherited, a solid selection explicit. Every room and building supports factions through ☰ and the command bar, including ordinary castles: existing wall banners and faction marks change; other furniture does not.

Four routes use the same logged `faction.set` command: after drawing the first room/building of a type with faction slots, a ten-second contextual icon grid appears below the command bar; room/building ☰; a faction object's ☰; or selected-object commands `faction spiders`, `faction sun`, `faction inherit`. The contextual grid has exactly two rows, grouping read from faction data (good/neutral above, sinister below); no text buttons. It adds one undo step and does not repeat for that type until reload. A missed offer is always available through the bar (and room/building/object rings). The ring's paused geometry redesign is unchanged.

**Build → Factions** opens the library shelf: one row per faction, emblem and name, then slots in stable order, with visible missing-slot gaps. Click a piece and place it, or drag it out. The bar searches every variant: `spider banner`, `sun idol`, `devil corbel` when that asset exists, or `spider cult wall hanging`. Labels are built from faction and slot, e.g. **Spider banner**, **Sun idol**, **Moon censer**, **Sun pier** (internal `flavor-buttress`), **Devil floor sigil**. Aliases include flavor, religion, cult, temple, heraldry, banner and emblem. A directly chosen library faction piece is an explicit choice.

Re-dressing preserves transforms, scale, pins, object identities and non-mark furniture; moved marks change in place and deleted ones stay deleted. Explicit room/piece overrides survive a parent change. Missing pieces are suppressed reversibly and restored in place by a later complete faction; the shelf makes incompleteness visible. Freestanding banner poles have no equivalent slot and are unchanged. Factions and slot additions are discovered from the library; metadata supplies grouping, names, aliases and optional emblems, with the faction's sigil as icon fallback. Tests and blind-read evidence: `experiments/2026-10-13-faction-picker/`.
## Play-test changes, 2026-10-13

Pawns has one **Measure** button invoking `measure.start`, the M command. Player portraits crop the baked picture of the explicitly marked main pawn toward the head; without a main pawn they show a fitted initial. Party, player turn rows and command-bar people share the portrait (`client/portraits.js`); whispers have no avatar.

Room primary is **Turn · Re-roll · Hide/reveal**; building primary is **Hide/reveal**. Their ☰ menus never repeat it. Room hiding records which NPC pawns it hid, and revealing restores only those still in that room. Pre-hidden pawns stay hidden. Player-owned pawns remain visible and the GM sees a one-line count (`HIDE_ROOM_HIDES_PLAYER_PAWNS = false`). Placement or a GM drop into a hidden room is hidden atomically; moving out stays hidden. Command log, relay filtering, save/reload and undo carry the state. See PAWNS.md and NETCODE.md.

The `?` sheet is generated from the same registry and still lists Space H and all retained chords; it has no separate ring-content list to update. A room with its roof hidden still has exactly the same five ☰ entries; **Show roof** is available through the command bar or Space J.


## Returning to your games and campaign names (2026-10-13, Task E)

Opening the bare address resumes this browser’s most recently joined seat through the normal loading screen,
and puts its `#s=` back in the address. An explicit invite always wins. Each successful join remembers the campaign
name, seat name/role and last-used time; later campaign/seat renames refresh the labels without changing that time.
This is per browser and site, not an account or a cookie. Private browsing or blocked storage still allows creating
and joining normally, without promising to remember it.

**Other games / New game** is a small button below the table’s launchers and an entry in Settings for every seat,
including players. It opens the remembered games by name, seat/role and last-used date/time, with **Start a new
campaign** and **Forget this browser’s games**. The latter removes only remembered seats, not the campaigns or
other preferences. The explicit `#games` address bypasses auto-resume; choosing a game opens a fresh client so a
previous seat’s world/connection is not reused. A rejected remembered seat is removed, and the start form says:
“That remembered game is no longer available; it has been forgotten.” Temporary network failure does not forget it.

The editable campaign-name field starts with **The <Word> <Word> Campaign**, using two distinct title-cased words.
The small dice button gives another name. The relay uses the same generator for omitted/blank names, including
non-browser creation; explicit names are unchanged. Full 2,048-word BIP-39 English list: `engine/core/bip39-english.js`,
from bitcoin/bips, **MIT**; source, hash, terms and the 13 title exclusions are in `engine/core/bip39-LICENSE.md`.
Excluded: abuse, addict, crack, crime, cruel, dumb, fatal, insane, naive, nasty, neglect, ugly, useless.
Tests: `engine/test/browser_continuity.py`, `games.test.mjs`, `campaign-names.test.mjs`, plus loading/join/UI suites.


## Vision fog of war (Task G, 2026-10-13)

Settings ▸ Global defaults has **Fog of war** (on in new campaigns, off in pre-existing campaigns) and **Shared party vision** (off). The command bar has `fog of war on/off`, `shared party vision on/off`, `reset fog`, and `reveal explored here`. Reset forgets explored memory across every area for everyone and is undoable. Reveal marks selected rooms explored; with no selected room it marks the area's floor-plan bounds, including loose outdoor scenery. It never reveals pawns without current sight.

A player sees through the pawns whose **Moved by** names them, including familiars. Shared vision uses all player-controlled pawns. The GM normally sees everything; `view as <player name>`, `view as party`, and `view as GM` switch their local preview. A visible badge names the preview and returns to GM when clicked. Shared full-map area thumbnails are omitted while viewing through fog. Deliberately hidden rooms and things remain withheld in player previews.

Never-seen space is a living **war-fog bank** (2026-10-17, "Fog-of-war look"): a heavy blue-white fog about 9 ft high that billows, rolls tongues out through doorways and open ground into what you can see, parts when a door opens or a pawn walks in, pours back when sight is lost, and swirls away under any cursor (waving it clears it down to the floor). Under it the never-seen floor is a 2.5-ft grey checkerboard (an image editor's transparency squares), drawn on the floor plane, so a cleared patch never shows what is there. Explored space wears a thin veil of the same fog, current sight is clear, and the sight edge is feathered a few feet into what you can see, like torchlight falling off. A wall whose face you have seen is known through its thickness (2026-10-18): its top and far face are drawn as a solid wall wearing the same grey checkerboard as unseen floor, with the bank pressed against it; how far it runs beyond what you saw, and anything on or against its far side, stays unknown. The look is the house look's `fogwar` (the Spawn Tuner's Fog of war look panel, "Use in game"; built-in defaults until then). Earlier text: never-seen space was opaque grey fog, explored space still translucent mist over the current room and furniture, and current sight clear. Pawns, target counts and turn rows disappear outside current sight. Moving sight swirls the boundary. Settings ▸ Me ▸ Graphics ▸ **Fog and mist** and the Low preset disable decorative atmosphere; fog of war then is the checkerboard floor, the flat translucent mist over explored space and the feathered edge (no bank). A player's ruler can extend into fog without revealing targets. Vision uses the pawn's base level, including raised figures. Walls and closed doors stop sight; open doors and windows pass it.


## Fog tweaks (2026-10-15)

- **Fog of war per area.** Each area is On, Off, or inherits the campaign default (the default). Settings ▸ Area has a **Fog of war** switch (with "overridden here" and Reset = inherit); the command bar has **Fog of war on here / off here / campaign default here** (words: fog, vision, no fog here). Settings ▸ Global defaults ▸ Vision keeps the one campaign-wide switch (command `fog of war (campaign default): on/off`). **Shared party vision stays campaign-wide** (a per-area copy would add nothing a player could use). An area with fog off draws no fog pass and shows every pawn; its explored memory stays on the relay and returns the moment fog is turned back on. Nothing is sent to the relay while an area has fog off.
- **Other people's cursors through the fog.** A remote cursor, ping or ruler is redrawn after the fog pass (the same overlay list that already carried rulers and pawn labels; no shader change). Over ground the viewer cannot currently see, a cursor is dimmed to half strength and gets a ring on the ground ("pointing into the unknown"); over visible ground it is drawn as before. **The GM's live cursor and ruler** are not drawn where the viewer cannot currently see, because the GM often lingers in the room they are preparing; the named constant `GM_CURSOR_THROUGH_FOG = false` (`engine/core/fog.js`) lets them through. A GM **ping** always shows. The relay's withholding for hidden rooms and areas is unchanged (pings, drags, selections and rulers touching a hidden room still go to the GM side only).
- **Arrow keys move one grid square** (5 ft), **Shift+arrow nudges 1 ft**; the directions are the screen's, snapped to the nearest grid axis (`app.arrowAxes()`), so with the camera turned 90 degrees "up" still moves toward the top of the screen (looking straight down, the camera's own up, laid flat). Pawns and objects alike; a room or building moves a whole square and ignores the 1-ft nudge. One undo step each. A pawn moved by arrow re-runs vision like a drag. A pawn that stands off the squares moves 5 ft from where it is (it is not pulled to a square centre). Commands: `edit.nudge5.<dir>` ("Move left one square", the arrow) and `edit.nudge.<dir>` ("Nudge left 1 ft", Shift+arrow); the `?` sheet lists both. Note the drag default is still "free, Shift snaps" (Settings ▸ Me ▸ Pawns snap to squares).
- Tests: `engine/test/browser_fogtweaks.py` (65), `engine/test/fogarea.test.mjs`, `fogsettings.test.mjs`.

## Ring lab (2026-10-15)

`?ringlab=1` mounts the experimental ring on the actual selection, over the actual 3D client. The usual table, camera, piece movement, registry and command dispatch remain in use. Without the flag the ordinary selection ring runs alone. With it, the old ring's buttons are hidden while its projection and sheet support remain available; the prototype draws from `engine/client/ringlab/{model,renderer,panel,presets}.js`. Geometry and local draft settings never enter campaign or presence state.

The flag without a seat fragment opens the reusable **Ring lab · design table** campaign from this browser, or creates it once, with a furnished common room, a tavern building, three pawns (one raised), a door and a light. The **Ring lab** button opens the collapsible controls. Every closed, expanded, menu and nested arc has its own radius, start, span or explicit fit, direction, gap, button size, offset, contents and animation path; snap helpers copy relationships on request. Overlap and the 3–6 o'clock reserved sector are warnings. The live registry supplies actions and permissions; `?ringlab=1` only changes this seat's renderer. Save uses the existing `ring` tuner record; Copy gives `{version:2,settings:{arcs:{...},tracks:{...},...}}`, and v1 presets migrate when loaded. Icon sets and alternates come from the tuner manifest on each load. `tools/spawn-tuner/ring.html` is the quick offline bench on the same modules, with a deploy-time registry snapshot.

## Feedback (Harry 2026-10-19, as built)
Harry: "Not just bug report: also feature request, feedback, all of that. That lives in the Settings menu as another major option. It can be any kind of ticket, whether that's a bug or whatever else: a comment about an asset, a feature request, all of those things."
- **Settings ▸ Feedback** (key **F** in Settings), for every seat, the last section. The form (`client/surfaces/feedback.js`) is fetched the first time the section opens; at boot only the small error hook loads (`client/feedback-hook.js`).
- **New ticket:** a row of kinds (**Bug**, **Idea / feature request**, **Asset comment**, **Question**, **Other**), the words (up to 4,000 characters), **Send**. "Sent, thank you." and a toast; the words clear; My tickets refreshes.
- **Asset comment** names its asset. When the form opens it reads the selection: a thing gives its library sku, the asset rater's `<src>/<sku>` and its name; a pawn its figure. The name can be typed over (the thing stays named underneath), **Clear** sends it about no asset, **Use the selection** reads the selection again (pin Settings to select something with it open).
- **What gets sent** is a fold, closed at first (it is long on a small screen), listing every part: the **screenshot** (the table as this seat sees it now, with a preview and **Retake**), the versions (client and look), campaign and area, you (name and GM or player), the **camera**, **graphics, browser and GPU**, the **recent commands** (the last 50 this seat sent or received: their kinds and ids, never what was said) and the **recent errors**. The parts with a switch can be left out; versions, campaign, area and seat always go (the relay knows the seat from its token anyway).
- **The screenshot is taken when the section opens** (each arrival: the launcher, a section letter, a command), from the canvas in the frame event, after every view of that frame has been drawn, the fog-of-war pass included. It is only ever what that seat's own screen shows: a player's never holds what fog or the GM hides (test F6). The 3D canvas only: menus and labels in the page are not in it. JPEG, at most 1,600 px wide and 850 KB.
- **My tickets:** this seat's tickets and any this browser filed in other campaigns (it keeps their receipts), newest first, with the kind, time, asset, a status chip (New, Looking at it, Fixed, Won't fix, Duplicate) and any reply under it. **Refresh** asks again. Errors sent by themselves are not listed.
- **The command bar:** "Feedback…" (also: ticket, my tickets, report), "Report a bug…", "Idea or feature request…", and, while a thing or pawn is selected, "Comment on this asset…": each opens the section on that kind.
- **Errors are sent by themselves**, silently (no dialog, nothing opens): a window error, an unhandled rejection, a `console.error` that carries an Error (the frame loop's catch, for one), the table never connecting (20 s) and a reconnect storm (4 drops in 2 minutes). Kind "auto", the same context without the screenshot. Once per message + stack in a page's life, at most 10 a page (`FEEDBACK_LIMITS`); one the relay could not take waits for the connection, or for the next visit (localStorage).
- **The look** is the Settings window's own: its groups, buttons and switches; the form's few extra rules are injected by the module. At 1280 x 640 the window fits, its body scrolls, and Send sticks to the bottom of the scrolling body (test F7).
- Where tickets go and how they are triaged: docs/NETCODE.md "Feedback tickets". Tests: `engine/test/browser_feedback.py` (F0-F7), `engine/test/tickets.test.mjs`.

