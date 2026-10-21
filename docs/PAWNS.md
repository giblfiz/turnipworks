# Pawns: the menu, the bench, areas (design, Harry and Fauna, 2026-10-06)

Status: **the Pawns menu is BUILT and live (2026-10-06, late evening): see "The Pawns menu, as built" below.** The
sections before it are the design as Harry and Fauna talked it through, kept as the record; where the two differ, "as
built" says so and why. Still design only: conditions shown with style, linked exits, and the turn order's data
(branch `turns`: the menu already draws it). Source: the conversation of 2026-10-06
(`~/fauna/transcripts/turnip-works/2026-10-06.md` on the build box; `fauna-search search "pawns menu"`).
The pawn's own ring (turn · sheet · damage · menu) is a separate piece: docs/UI.md, "Pawn ring".

**Since 2026-10-11 ("ship the cuts", docs/UI.md "The cuts"):** a pawn's ☰ holds five entries (Conditions, Indicators, Raise / lower, Hide / reveal, Send to area). **Its name and who controls it are on its sheet card** ("Name", for the owner and the GM; "Moved by", a list the GM picks from, plain words for everyone else); the Pawns menu's Control ▸ still does the same from the party row. Duplicate is Ctrl/⌘+D and the bar; Delete is the Delete key and the bar. **The pawn lock is dropped as a feature:** nothing locks a pawn, a pawn saved locked loads unlocked, and a player's travel is refused only by the GM's lock on travel or on moves in the area (docs/NETCODE.md "The pawn lock is dropped").

## The Pawns menu (key P): what a player sees

Harry: "this is going to be a *very* contextual menu depending on who is looking at it. Let's start with PCs."

**It looks like the Build menu, not like Settings** (Harry, 2026-10-06): "this needs to look a lot more like the build
menu than the settings menu. Style (mostly visual, etc. this is where people who don't really 'read so good' go)
should follow the build menu." So: pictures first (figure thumbnails, portraits, icons), few words, the Build tray's
tiles and tree, not Settings' lists and text. **The Pawns launcher is the leftmost of the three**: Pawns, Build,
Settings (Harry: "swap the build menu and the pawns menu so pawns is furthest to the left").

**The party is one player per row** (Harry, 2026-10-06): each row is a wide button like the Build tray's genre button
after it has been chosen. The **portrait** (the figure's thumbnail) is on the left and **clicking it goes to that
pawn**; the **player's name** and the pawn's name are on the row; the other actions (sheet, follow, whisper, and the
GM's chores) are **small icons to the right, under the name, each with hover text**; the damage number and condition
marks sit on the row. **Party notes are behind one icon.**
A player's pets and familiars are **smaller portraits tucked into the same row**, not rows of their own (Harry:
"sounds reasonable"). **Turn order uses these same rows, re-sorted**, with the marker on the current one (Harry: "yes
absolutely").

Three sections:

1. **Mine.** My pawn; my other commandables (pets, bots, familiars); my **bench** (pawns of mine that are not on the
   table: the druid's bear form, a mount, a summons, a dragon "just in case"); **travel** (send my pawn to another
   area, a sub-menu); a **"New pawn…"** row that opens Settings ▸ Me ▸ My pawns (a new player pressing P on an empty
   list needs the door).
2. **Party.** A row per player: go to their pawn, open their sheet, follow (lock my camera to their pawn, or open
   it in the picture-in-picture), whisper. Each row shows the pawn's **damage as a number** (no bar: Harry, "just the
   number") and its condition marks, readable without a click. If the party is split, rows group by area.
   Drag rows into a **marching order**; the group can then move as a formation.
3. **Turn order** is not a separate thing: in a fight the same list is sorted (Harry: "turn order is basically we just
   sort them").
- **Party notes:** one shared text everyone can edit. (Loot and coin stay on the sheet.)
- **Hand-off:** lend my pawn to another player or to an AI seat while I am away.

Opening: Harry prefers the menu behind P to an always-visible strip ("you just have to hit the p button for a
second, it's not that bad. We could also have a way to leave the menu open, or think about general 'leave menus open
until' behavior"). Decided for all three launchers (Harry: "hold tap and pin sound fine"): **hold** the key = shown while held; **tap** =
open until tapped again or Escape; a **pin** = stays open while working on the map.

## Damage, not HP (decided; being built in the pawn ring)

Harry: "instead it's 'damage'. That means 0 is always healthy, it also means there isn't that whole 'bloodied'
question." Counted up from 0; no maximum; no automatic bloodied. Typing: `7` / `+7` adds, `-5` heals, `=12` sets
(Fauna's choice; one parser). An optional limit (`/30`) for a bar was offered and declined for now.

## A player's pawns: defined in Settings ▸ Me, used from the Pawns menu

- **Settings ▸ Me ▸ My pawns** defines a pawn: a figure picked from OUR set (the picker lives here), a name, a sheet
  link, notes, and whose it is when it is a pet or familiar. Token selection in general lives here (Harry).
- **The Pawns menu** uses them: the bench lists what is defined; bring one on, send one back.
- **Stored per campaign**, with the maps (Harry: "the pawn collection is basically part of the set of maps... it's
  literally just a line of json"). Not a per-player library across campaigns.
- **No limit and no GM approval** for what a player keeps on the bench (Harry: "we are just talking about them
  favoriting minis onto their bench... no GM cares").
- **This is not the upload path.** Bringing your own model is docs/IMPORTS.md and comes later; it would land in the
  same list.

## Areas: travel, and keeping surprises hidden (AS BUILT, 2026-10-06)

Built and live. What Harry decided, then how it is built, then where the code and the tests are.

**Decided (Harry, 2026-10-06):**
- **Pawns ▸ travel moves my pawn** (and my view with it). **Settings ▸ world navigation moves only my view.**
- **Players travel freely.** The GM gets an undo for it, and can lock travel.
- **An area is open or hidden. Nothing else** ("locked" was dropped). **The first area of a campaign starts open;
  every later one starts hidden**, so the GM can build tomorrow's dungeon in the same campaign.
- **Hidden means hidden everywhere, enforced by the relay**: not in the travel list, not in the Settings area list,
  not viewable (main view or picture-in-picture), not in an AI seat's reading of the table.
- **The GM must never be unsure an area is hidden.** Harry: "We need a 'closed' area to always be very very clearly
  showing as 'closed' to the GM, maybe a constant floating button that says 'unlock this area to players' and something
  that uses our same 'invisible' item flavor, and something that shows in all the menus where they come up".
- **The GM sends a player's pawn into a hidden area:** the pawn goes and the area opens, with one contextual button,
  "Opened <area> for players · Undo". Undo sends the pawn back AND hides the area again (Harry).
- **Where a travelling pawn arrives.** Harry: "pawn arrival: marked location > a party pawn there > NOT area center.
  out in the fog sea to the side of the area."
- This is separate from fog of war inside an area.
- Later: linked exits (a door, stair or map edge tied to another area; walking onto it travels).

**As built:**
- **One filter.** `canSee(state, seat, area)` in `engine/core/perms.js` is the only thing the relay asks: the GM side
  sees every area, everyone else sees an area exactly when it is open. It gates the area list sent to a seat, a
  subscription (the main view and the picture-in-picture are both subscriptions), every log entry, presence and pings,
  AI-seat ghosts, area pictures, every GET read and every command. A hidden area answers word for word like an area
  that does not exist.
  - Also closed on the way: a seat in a hidden area has no location for players (the roster used to say "elsewhere");
    a thing sent into a hidden area just leaves (the log entry no longer names where it went); refusals no longer
    repeat the area id.
- **A new area's visibility is the relay's decision** (`fill` on `area.create` in `engine/core/commands.js`): the
  first is open, every later one hidden, whatever the sender asks for. An imported area arrives hidden too.
  `area.visibility` takes `open` or `hidden`.
- **What the GM sees** (`engine/client/surfaces/areas.js`):
  - a constant button at the top centre, under the command bar, while in a hidden area: the area's name with the
    eye-off mark, then **"Hidden from players · Open this area"**. In an open area the same place says "Open to players"
    with a small **Hide**;
  - the hidden look a hidden thing has (the hidden violet, a dashed edge, the eye-off mark) on that name tag, as a
    dashed violet frame round the whole view, and on the picture-in-picture's frame and title bar when its area is
    hidden;
  - a mark in every list: Settings ▸ World navigation (each row says "Hidden from players" or "Open to players", with an
    Open / Hide button), Settings ▸ Area ("Open to players" switch), the picture-in-picture's title, the travel list
    ("hidden from players" under the name), the roster's place labels, the command bar's places;
  - players are shown none of it: their lists simply hold the open areas. A player with no open area at all is told
    "No area is open to you right now".
- **Travel** is one command, `travel { id, from, to }` (class `travel`, which players hold): the relay commits it as the
  two halves of a transfer, so it is atomic and its undo is the pawn back where it stood.
  - A player: their own pawns, to open areas. Refused, with the reason, while the GM has travel locked (the campaign
    setting `travelLocked`: Settings ▸ Global defaults ▸ "Players travel between areas", or "Lock travel" in the command
    bar) or while moves are locked in the area being left. The player's travel list then holds one entry, "The GM has
    locked travel".
  - The mover's view goes with the pawn and lands on it. A pawn of yours that someone else sent away offers
    **"Follow <pawn> to <area>"** (your view never moves by itself; the offer goes down into the chat like any other).
  - **The GM's undo of a player's travel** is the ordinary undo chip in its own words: "Bring Brakka back" where the pawn
    stood, then the chat line "Brakka went to the Crypt · [Bring back]". Seen from the other end: "Brakka came from the
    Inn · [Send back]".
  - **Open on send:** when the GM side sends a pawn owned by a player into a hidden area, the relay opens the area in
    the same record (`opens`), and the GM gets the one button "Opened <area> for players · Undo" (then a chat line).
    Its undo is the transfer back with `hide`: the pawn returns and the area is hidden again; redo opens it again. A
    pawn that is nobody's, or the GM's own, goes in quietly and the area stays hidden.
  - **Invoked from** the pawn's ☰, "Send to area ▸" (a sub-menu at its button), and the command bar ("travel to
    <area>"). The Pawns menu will hold it later; it calls `app.travel(pawns, area)`.
- **Arrival** is one function, `arrivalPoint` in `engine/core/travel.js`, and never the sender's choice:
  1. the GM's **arrival mark**, if the area has one: an ordinary thing with place `arrival`, hidden from players,
     placed or moved by "Travellers arrive here" in the command bar (it shows as a flat slab in the hidden look);
  2. else **beside the party pawn** nearest the middle of the party pawns already there (a party pawn: owned by a
     player's seat);
  3. else **out to the side**: open ground to the SOUTH of everything built (the edge nearest the camera in the home
     view, so the pawn stands in front of the buildings), level with the middle of what is built, two squares out,
     at ground level;
  - always the centre of a free square (no pawn, no furniture), so arrivals never stack.

**Saved campaigns.** Nothing on disk was rewritten. Before this there were three rules (`open`, `party`, `gm`) and
per-seat grants. `party` and `gm` now read as hidden and grants open nothing. On the day of the change the 256 saved
campaigns held 319 open areas and 43 `gm` ones, no `party` area, and grants only on areas that were already open, so
no seat sees more or less than it did (`engine/test/areas.test.mjs` part 3 loads every campaign with the code before
and after and compares every seat × area).

**Code:** `engine/core/perms.js` (`canSee`, `isOpen`), `engine/core/commands.js` (`area.create`, `area.visibility`,
`travel`, `transfer`), `engine/core/travel.js` (arrival), `engine/core/state.js` (`projectCampaign`),
`engine/relay/campaign.js` (`dispatch`, `transferFx`, `entryFor`), `engine/relay/llm.js` (the rules card),
`engine/client/surfaces/areas.js` (everything on screen), `engine/client/surfaces/settings.js`.
**Tests:** `engine/test/areas.test.mjs` (the rules, and a player seat's whole network traffic searched for the hidden
area), `engine/test/browser_areas.py` (GM tab and player tab).

**Decided by Fauna, easy to change:** grants are retired; the plain `transfer` of a thing stays a quiet GM tool, and
pawns sent with "Send selection to" go through travel; the GM's view follows a pawn the GM sends; the open-area tag is
always shown to the GM; the side is south, two squares out; a player may undo their own travel unless travel is locked
or the area has since been hidden.

## The Pawns menu: what the GM sees

The same three sections with more in them, and one section players get a smaller form of.

- **The cast** (the GM's bench). **Named individuals** (the villain, the innkeeper: a name, a sheet link, notes) and
  **saved groups** ("goblin patrol: 6 goblins and a wolf", dropped in one go and numbered). Both belong to the
  campaign. Harry: "cast follows the campaign, but we don't want it to over-grow, so maybe recents surface and the
  rest end up in submenu." Stock monsters are not cast: they come from the tree each time.
- **Save a group:** an action on a selection, so it lives in the selection's own menu ("Save as group…"), and as a
  conditional row at the top of the cast only while several pawns are selected. Also a command ("save group").
- **Placing a pawn is a tree, like Build, not a search box** (Harry: "we have a search bar, and if they wanted to use it
  they would have already used it... the intended main UI is the searchbar"; "hopefully people will rarely use this").
  Two levels, then a grid of thumbnails; it need not bottom out ("we can just catch the main ones"), and a family too
  big for one screen ends in "more…", which fills the command bar with that family.
  - Heroes ▸ class ▸ a grid by race and gender. Townsfolk ▸ role ▸ the races. Monsters ▸ family ▸ a grid (a large
    creature sits under its family with a size mark; "large" is not a kind). Animals ▸ one grid.
  - From the figures' own data (group, cls, race, gender, family, tags in the published manifest).
  - **A search button** that fills the command bar with "place pawn ▸" and puts the cursor there.
  - "Fits this room" (monsters suggested by room type) was offered and declined: it "belongs deeper in engine
    integration as it's like level dependent... Or the connected LLM can handle it".
- **Party rows** as for players, plus the GM chores: bring this player here, send them to an area, take or give control.
- **On the table:** every pawn in this area that is not a player's, grouped by kind ("Goblins ×6") with damage beside
  each; go to; select all of a kind; hidden pawns in the hidden look with a reveal button. **Players get this section
  too**, limited to what they have been sent (the relay already withholds hidden things from player seats, so it
  cannot leak).
- **Pawn X-ray** (GM only): a toggle that shows every pawn as an outline through walls, floors and roofs, **on all
  levels**, players' pawns in a different colour. Harry: "it's the 'oh fuck where did I leave that vampire' button".
  On a hotkey, and a row in the menu.
- **Every row that has a key shows its key** (Harry: "the menu is also a place to show what the hotkeys are").

## The Pawns menu, as built (2026-10-06)
Code: `engine/client/surfaces/pawns.js` (the tray), `surfaces/tray.js` (hold, tap, pin), `surfaces/figtree.js` and
`client/pawntree.js` (the tree of minis), `surfaces/settings.js` (Me ▸ My pawns), `client/pawns.js` (bring on, drop a
group), `surfaces/chat.js` (whispers); `engine/core/party.js` and `core/commands.js` (the data and its commands),
`relay/campaign.js` (who is sent what; whispers). Tests: `engine/test/browser_pawnsmenu.py` (160 checks, four seats;
`--only TRAY,PARTY,MINE,TREE,CAST,TABLE,TURNS`, `--shots`) and `engine/test/party.test.mjs` (69 checks against a real
relay, a raw socket per seat). The pictures Gemini read are made by `--shots` (not kept in git).

### Opening: hold, tap, pin (all three launchers)
- **Hold** P (or B, S): the menu is shown while the key is held and goes when it is let go. Held means 350 ms or
  longer, or any other key or a click in the menu while the key was down (so **P + 1** is "show, go to the first
  player's pawn, gone"). The two key events' own times are compared, so a busy frame never turns a tap into a hold.
  (A browser driven by a test stamps a key's release late, so there a hold is 1.5 s: `holdMs` in `surfaces/tray.js`.)
- **Tap** the key, or click the launcher: it stays until the key is tapped again, Escape, or a click outside it.
- **Pin** (the pin in the menu's corner, remembered in this browser): it stays while you work on the map. A click
  outside does not close it and Escape passes it by; its key, its launcher or the pin closes it. **A pinned menu takes
  letter keys only while the pointer is over it**; otherwise they are the game's.
- One menu at a time, as before; a pinned one that was closed by another comes back pinned.
- **What changed for each** (checked before changing):
  - **Pawns** was a placeholder: P or a click toggled it, Escape or a click outside closed it. Unchanged; hold and pin
    are new.
  - **Build**: B or a click opened it and a click outside, Escape or Enter closed it. **B did not close it** (the open
    tray took every letter as an item's). Now B closes it, unless the list showing has an item on B (then B picks that
    item, as before). Hold and pin are new. Pinned, Escape and Enter no longer close it (Escape is needed for the tools).
  - **Settings**: S or a click opened the window; S, Escape, × or a click on the backdrop closed it. Unchanged; hold and
    pin are new. **Pinned, the window loses its backdrop, moves to the right edge, and the map behind it takes the
    pointer and the keys** (the section letters work while the pointer is over the window).
  - While Pawns or Build is open, P, B and S open their own menu unless the open list has an item on that letter.
- **Decided by me:** a tapped-open menu still closes on a click outside (PAWNS.md says "until tapped again or Escape";
  read literally a tap would already be a pin). The other reading is one line: `dismissable` in `surfaces/tray.js`.

### The party
- **One wide row per player**, in the Build tray's chip style: the **portrait** is an upper-body crop of the explicit main pawn's figure picture in a frame
  of the seat's colour (a click goes to that pawn: its area, its level, centred, selected); the player's name small
  above the pawn's name; **damage as a number** beside a cracked heart, the indicator and the condition words on the
  row; **pets and familiars are smaller portraits in the same row** (every other pawn that seat owns; up to four, then
  "+2"), each with its own damage; action icons under the name, each with a hover name shown at once.
- **Icons, for everyone:** Sheet (opens the link in a new tab; with no link yet it selects the pawn and opens its
  card), Follow, Whisper. **For the GM:** Bring here, Send to another area ▸, Control ▸ (who moves it). What cannot be
  done is not shown (no whisper to yourself; no Control for a pawn that is not on this table).
- **Follow** locks my view to that pawn: it stays in the middle while zoom and heading stay mine; a "Following Brakka ×"
  pill sits at the bottom; a click on it, or Escape, stops. For a pawn in another area, or with Shift, it opens that
  player's pawns in the picture-in-picture instead.
- **Bring here:** pawns in another area travel here (`app.travel`, the relay picks the arrival); pawns already here come
  to the middle of the GM's view, on free squares. **Send ▸** lists the other areas with the hidden mark and "hidden
  from players" (travel's own rules apply: a player's pawn sent into a hidden area opens it, with the one Undo).
- **Rows group by area when the party is split** (this area first, hidden areas marked). The rows come from the
  campaign view (`party.pawns`: every owned pawn in the areas this seat can see, with its damage and conditions), with
  this area's live pawns on top, so a row is right for a pawn in another area too. A pawn hidden from players, or
  standing in a hidden area, is not in a player's rows at all (tested from the traffic).
- **Drag a row: the marching order** (`party.set { order }`, shared). **Not built:** moving the group as a formation.
- **Party notes** behind one button (O): one text, saved a second after the last key and when the field is left; the
  last save wins.
- **Keys:** 1 to 9 go to that row's pawn, O notes, 0 my own pawn.
- **Decided by me:** the GM has a row too, last (so a player can whisper to the GM); a player with no pawn has a
  dashed row saying so; the explicit main pawn supplies the portrait (otherwise the player's initial); the first pawn by name remains the row's go-to target when no main pawn is chosen.

### Whisper
- "whisper Mira meet me outside" in the command bar; the row's icon fills the bar with "whisper Mira " and puts the
  cursor there. Both sides get a line in their own chat ("Mira to you" / "you to Kit"), kept in that browser.
- **It is not a command.** The relay hands it to the connections of the seat it is for and to the sender's own other
  tabs, and to no one else: not the GM, not anyone's AI seat. It is never journaled, never in a log, a snapshot, an undo
  or the GET API. Tested from every byte each socket received, from the GET API, and from the files on disk.
- A person who is not connected is not reached and the sender is told ("not at the table right now"). AI seats cannot
  be whispered to yet (they have no socket to hand it to). 500 characters; 20 in 10 seconds.

### Mine, the bench, and Settings ▸ Me ▸ My pawns
- **Mine** is the first section: my pawns on the tables (a click goes to it), my **bench** (defined, not on a table:
  dimmed, marked "bench"; a click picks it up, then a click on a square brings it on), and **"＋ New pawn" (N)**, which
  opens Settings ▸ Me ▸ My pawns on a new pawn. Each tile's ☰: go to, **Travel to <area>** (the open areas; the single
  line "The GM has locked travel" while it is), **Send back to the bench**, **Lend to <player>** / **Lend to the GM**
  (the GM and the GM's assistants move it) / **Take it back**, Edit…, Forget.
- **Settings ▸ Me ▸ My pawns:** the list (picture, name, "on the bench" / "on the table: <area>", whose pet), and an
  editor: the figure picker (the same tree as placing, below), name, sheet link, notes, "pet or familiar of", "my main
  pawn". Picking a figure offers its name. Saving a pawn that stands on the table I am at changes that pawn too.
- **Data:** `pawn.define` / `pawn.forget` (campaign commands; `state.pawns`), `pawn.bring` / `pawn.bench` (area
  commands; a player may: no approval). The relay writes the pawn from the definition, whatever the sender says. One
  pawn per definition, campaign-wide. A definition is sent to its owner and to the GM side, to nobody else. 200 a seat
  is the only limit (to keep junk out). `token.lend` is the hand-off (the pawn remembers its lender).
- **Differs from the design:** "lend to an AI seat" is "Lend to the GM": a player's own agents already act for her,
  and a pawn nobody owns is moved by the GM side, which is the GM's assistants too. A named AI seat as a pawn's owner
  is still refused by `token.owner`.

### The GM's cast
- **Named individuals and saved groups**, per campaign (`cast.save` / `cast.use` / `cast.forget`; `state.cast`), sent
  to the GM side only: never in a player's campaign view, traffic or GET reads (tested).
- The six most recently saved or used show; with more, **"All N" (C)** shows the rest.
- **Save:** with several pawns selected, **"Save as group…" (G)** is a row at the top of the cast, is in the
  selection's own ☰, and is a command ("save group goblin patrol"). With one pawn selected the row is "Add to the
  cast" (its figure, sheet link, notes and GM notes).
- **Drop:** a click on a tile, then a square. A group is placed in one click round that square and **numbered as the
  bar's "6 goblins" is** (Goblin 3, Goblin 4 … carrying on from the highest on the table); one undo removes it. A tile's
  ☰: place, rename, open the sheet, remove.
- **Decided by me:** a group keeps each member's kind and figure, not its damage or notes; placing uses the bar's
  nearest-free-squares rule, not the saved offsets (they are stored: `dx`, `dz`).

### Placing a pawn: the tree
- **Place a pawn** (GM): Heroes (H), Townsfolk (T), Monsters (M), Animals (A), and **Search (F)**, which fills the
  command bar with "place pawn" and puts the cursor there.
- Two levels, then a grid of thumbnails; the levels above are the Build tray's stacked chips; Backspace goes up.
  Heroes ▸ the 12 classes ▸ 14 figures, race by rows, woman and man in two columns. Townsfolk ▸ nine roles by race, and
  Tavern, Trades, Court, Law and faith, Streets and docks. Monsters ▸ 24 families ▸ a grid; a large creature is in its
  family with a "2×2" mark. Animals ▸ one grid.
- A grid shows 15 at most; one with more ends in **"more…" (M)**, which fills the bar with that family.
- A click on a thumbnail is the pawn tool (Shift keeps placing); the menu steps aside unless pinned.
- **A thumbnail can be dragged onto the map** (2026-10-06, after Harry's "the pawns can't be dragged out of the text-search menu"): so can a cast tile (a group drops whole) and a bench tile in Mine (it is brought on where it is let go). docs/UI.md "Dragging a figure out of a list".
- **The tree's shape is ONE table:** `PAWN_TREE` in `engine/client/pawntree.js` (families by the figures' `family`,
  tags or ids; first match wins; "Monsters of legend" takes the rest). All 518 figures have a place (tested).

### On the table
- Every pawn in this area that is nobody's, **by kind** (`pawnKind`: the name without its number): the picture, "Goblin
  ×2", each hurt pawn's damage. A click goes to the first, again to the next. **Select all** of a kind.
- **The GM's hidden pawns are rows of their own in the hidden look** (violet, dashed, "hidden from players") with
  **Reveal**. Players get the section from what their client was sent, so a hidden pawn cannot appear in it.

### Turn order
- With `area.turns` (below), the party rows and the kinds become **one list in that order**, a marker on whose turn it
  is, the round in the header, each key's number, and "Not in the order" after it. The GM drags a row (`turn.order`); a
  **Next** button shows when the `turn.next` command exists. Tested against a stand-in for the data until the `turns`
  branch lands; the suite switches to the real commands by itself when it finds them.
- **Pawn X-ray** gets a row under "GM", with its key, as soon as a command with "xray" in its id is registered.

### What Gemini said, blind (gemini-2.5-pro; neutral file names; no context)
- **Party, the GM's:** "a party management panel for a digital tabletop game ... lists all the characters (referred to
  as 'pawns') in the current party, along with the players controlling them and the Game Master." Without reading: "a
  robed figure with a staff, suggesting a magic-user"; "a character in armor with a sword and shield, clearly a
  warrior"; of the player with no pawn, "the dashed border ... might signify an 'inactive' or 'off-board' status".
- **First read of the icons, wrong, and what changed:** footprints for Follow read as "a toggle for movement mode", an
  ear for Whisper as "audio or perception", a video camera as "toggle video chat", a person-plus for Control as "view
  that player's profile", the unpinned pin as "sort". Now: Follow is an eye, Whisper a speech bubble with a lock,
  Control a gamepad, Bring here a magnet, Send a door, the pin always a pin; every hover name starts with the action's
  word.
- **Read again after the change:** the pin is "a thumbtack or pushpin ... to 'pin' a panel or window, keeping it open";
  Control is "a video game controller ... for assigning control"; Sheet "opens the character sheet, notes". Still
  unsure: the eye for Follow ("toggles the visibility of the pawn ... or it could be a button to focus the camera on
  that pawn"), the magnet for Bring here ("grouping or attaching pawns together"), and Whisper, which it called the
  least clear ("a speech bubble containing a small flag": the lock is too small to read at 15 px). The hover names say
  what each does; the pictures for those three are for the icon pass.
- **Party, a player's:** "Heart with '7': this represents health points" (the pawn ring's known heart problem: it is
  damage); "'prone' tag: this is a status effect"; the pets "are likely other pawns or summons controlled by this player".
- **Tree:** "for browsing and selecting a *family* of monster pawns (e.g., Kobolds, Orcs, Bandits)"; "these are
  breadcrumbs"; of the grid, "this is the final selection. Clicking one of these figures would select it for placement
  on the game board". Heroes: "the grid layout has adapted to be 2 columns wide"; "all figures ... are holding a staff".
- **Cast and table:** "some pawns are grouped or stacked together (overlapping images with a number)"; "Goblin x2 ...
  a red heart with the number 4"; it could not tell whether 4 was each goblin's or the group's (the hover name says
  which pawn).
- **Turn order:** "for managing combat turn order (initiative) ... a large arrow on the left clearly indicates the
  current item"; "round 2" is "easy to overlook".
- **Beside Build:** "Yes, they absolutely look like they belong to the same design family": the same container,
  headers, key caps, footer, launchers. What differs: Build shows one big picture tile, "spacious"; Pawns is
  "information-dense", with rows as well as tiles and the seats' colours. It called Build "picture-led" and the Pawns
  home view "word-led": "the critical information for identifying and managing characters comes from the text".
  That is the thing for Harry to look at first.

### Decided by me (each is one small place to change)
- A tap-open menu closes on a click outside (`dismissable`, tray.js). Alternative: only the key and Escape close it.
- The tray is three tiles wide (348 px; Build is two). Alternative: Build's width, with rows cramped.
- 350 ms is a hold (`HOLD_MS`).
- The party's rows include the GM (for whispering). Alternative: players only.
- Follow keeps my zoom and heading and only holds the pawn in the middle. Alternative: the picture-in-picture's
  follow rule, which also sets the zoom.
- Whispers are not stored on the relay (so nothing can leak later, and an offline person gets nothing). Alternative:
  keep them for whoever is away.
- Players may bring a pawn on anywhere they can click. Alternative: beside their own pawns only.
- A definition is its owner's and the GM's to see. Alternative: the whole table sees everyone's bench.
- "Lend to the GM" stands for lending to an AI seat.
- Six recent cast entries show. A group is numbered by the bar's rule and placed by the bar's formation.
- A grid's cap is 15 (`GRID_CAP`); the families and roles in `PAWN_TREE` are winged, as asked.
- On the table groups by name without its number; hidden pawns are separate rows.
- Keys: 1 to 9 party rows, 0 my pawn, N new pawn, O notes, G save as group, C all the cast, H T M A the tree, F search.

## Turn order and initiative

- **The core needs no numbers:** the same list in an order, a marker on whose turn it is, "Next" on a key; rows can
  be dragged at any time. That alone serves games with no initiative numbers.
- **Numbers sort the list.** Each pawn remembers one **initiative bonus** (the one piece of system data we hold).
- **Player, in the command bar:** "initiative" offers "Set your initiative bonus" and "Roll your initiative" (which
  adds the bonus) (Harry).
- **GM:** can set anyone's bonus, and has one action that **rolls for all PCs**; **"Start fight"** also gives each
  player a contextual "Roll initiative" button, which asks for the bonus first if none is set and otherwise just rolls
  (Harry: "if one thing always comes up first it's roll for initiative"). A typed number is accepted for physical dice.
- **Monsters roll once per kind**; the GM can drag them after.
- A system integration later posts a number into the same slot.

### The shared shape of a turn order (defined 2026-10-06 by the Pawns-menu work; the `turns` section below supersedes it)
The Pawns menu only DISPLAYS an order and lets the GM drag it; the `turns` branch owns the data, "Start fight", the
rolls and Next. Neither was on main when the menu was started, so this is the smallest shape both can meet on:

- **Where:** on the area, beside its chat: `area.turns`. Absent = no order is showing (the menu shows its usual rows).
- **What:** `{ order: [key, ...], at: key | null, round: 1 }`
  - a **key** is a pawn's id (`tok_...`: a player's pawn, or one monster on its own), or `kind:<k>` = every non-player
    pawn of that kind in the area as ONE entry ("monsters roll once per kind");
  - `<k>` is `pawnKind(token)` in `engine/core/pawn.js`: the pawn's name, lower-case, without a trailing number
    ("Goblin 3" is `goblin`). One function, so the menu's "On the table" groups and the order's kinds cannot differ;
  - `at` is the key whose turn it is (a key, not an index, so a drag does not move the marker); `round` counts up.
- **A drag in the menu sends** `turn.order { order }` (area level, GM side). The menu looks the command up by that name
  and shows no drag handle while it does not exist.
- A key whose pawn is gone (or hidden from this seat) is skipped when drawn; a pawn not in `order` is listed after it.

### The state and the commands (as built, 2026-10-06; the shape is the one the Pawns-menu work defined)
- **State, on the area:** `area.turns = { order: [key, ...], at: key | null, round: 1, init: { key: number } }`.
  Absent = no order. A **key** is a pawn id (`tok_...`: a pawn with an owner, or one monster on its own) or
  `kind:<k>` = every pawn without an owner of that kind, as ONE entry; `<k>` = `pawnKind(token)` in
  `engine/core/pawn.js` (the name, lower-case, a trailing number stripped: "Goblin 3" is `goblin`).
  `turnKeyOf(token)` gives a pawn's own key. `init[key]` is the number rolled or typed for THIS fight (no entry = not
  rolled yet). `at: null` just after Start means "gathering initiative"; the first Next puts it on the first key.
- **The bonus is on the pawn:** `token.initBonus` (an integer; absent = not set), set with `token.set { id, initBonus }`
  by its owner or the GM (`null` clears it). A kind entry uses the bonus of the first pawn of the kind that has one.
- **Commands (area level):**
  - `turn.start { order? }` GM. Default order: the players' pawns by name, then the kinds of the other pawns that are
    not hidden.
  - `turn.end {}` GM.
  - `turn.next {}`, `turn.prev {}` GM; the owner of the pawn whose turn it is may send `turn.next` (end my turn).
  - `turn.order { order }` GM: the order as dragged. With no order yet it makes one (no fight needed).
  - `turn.at { key }` GM: the marker onto a row.
  - `turn.init { key, n }`: the number for a key (`n: null` clears). GM: any key. A player: her own pawn's id. The key
    is put in its place by number; **ties:** the higher bonus goes first, then whoever was already ahead stays ahead.
- **Hidden pawns.** A player seat never receives a `turn.*` command as it was sent. In its place it gets
  `turn.view { turns }`: the order and numbers without any key whose pawns are all hidden from it, and `at` on the
  nearest key at or before the real one that it can see (when a hidden monster acts, the players' marker stays where
  it was). The area snapshot carries the same filtered `turns`. So any seat draws `tw.view().turns` as it is.
- **For the menu (client):** `tw.turns()` (the area's turns or null); `tw.turnRows()` -> `[{ key, ids, name, init,
  bonus, current }]` resolved and in order; registry commands `turn.next`, `turn.prev`, `turn.start`, `turn.end`,
  `turn.rollPcs`, `turn.rollMine`, `turn.setBonus`.

### As built (2026-10-06): what to press
Rules: `engine/core/turns.js`. Game: `engine/client/surfaces/turns.js`. Use, keys and the choices made: docs/UI.md,
"Turn order and initiative". Data and API: docs/NETCODE.md, "Turn order". Tests: `engine/test/turns.test.mjs`,
`engine/test/browser_turns.py`.
- **GM:** `/` then "start fight" (with several pawns selected: a fight of just those). **N** = next turn, **Shift+N** =
  previous. "roll initiative for all PCs", "roll initiative for the monsters" (once per kind), "end fight". With a pawn
  selected: "initiative bonus +2", "initiative 17", "roll initiative", "move earlier", "move later", "take out of the
  turn order", "add to the turn order", "it is this pawn's turn". "show the turn order" lists it as text until the
  Pawns menu's rows show it.
- **Player:** when the GM starts a fight a **Roll initiative** button appears under the command bar (it asks for the
  bonus the first time, then rolls d20 + the bonus; unanswered, it goes down into the chat and still works there).
  `/` then "initiative" offers "Set your initiative bonus…" and "Roll your initiative"; "initiative 17" gives a
  number rolled at the table. On her turn: "Your turn", an **End turn** button, and **N**.
- **On the table:** every pawn whose turn it is wears a pale ring round its base that breathes, and its base rim
  glows with it.
- **Not built here:** the list itself (the Pawns menu's rows, re-sorted, with the marker; that work reads
  `tw.turnRows()` and sends `turn.order` for a drag).

### Decided without Harry (each is one small place to change)
| Choice | Taken | The alternative | Where |
|---|---|---|---|
| Keys | N next, Shift+N previous | Tab / Shift+Tab; Enter | `TURN_KEYS`, surfaces/turns.js |
| Ties | higher bonus first; still tied, whoever was already in the order stays ahead | a roll-off; the GM is asked | `setInit`, core/turns.js |
| What "Start fight" puts in | every pawn in the area that is not hidden: owners' pawns by name, then the kinds; with several pawns selected, only those | only the pawns in the room; ask | `defaultOrder`; `turn.start` in surfaces/turns.js |
| Hidden pawns | not put in by Start; the GM adds one ("add to the turn order"). Players are never sent its entry; while it acts their marker stays on the entry before it | a "?" entry that says something unseen is acting | `forPlayers`, core/turns.js |
| A hidden pawn's roll | the number is set, no roll line in the chat | a GM-only roll line | `rollKeys`, surfaces/turns.js |
| Who may press Next | the GM; and the owner of the pawn whose turn it is (end my turn) | the GM only | `mayStep`, core/commands.js |
| Rolling again | a new roll replaces the number and moves only that entry | first roll stands | `turn.init` |
| "Roll for all PCs" | only PCs with no number yet (a player who rolled keeps her roll) | re-roll everyone | `turn.rollPcs` |
| The roll | d20 + bonus, always | a per-campaign dice expression | `rollKeys` |
| A typed number | "initiative 17" sets it and says so in the chat | silent | `turn.typed` |
| A monster on its own | the GM puts a pawn in by its own id (API / the menu's drag); it then leaves its kind's entry | always by kind | `keyPawns` |
| Undo | Start, End and a drag undo (GM); a number goes back to the one before; Next and Previous leave no undo step | everything undoable | `inverse` on each turn.* |
| "Your turn" | a toast, and an End turn button while it is her turn (no chat line) | nothing; a chat line for every turn | `watch`, surfaces/turns.js |
| The mark | a pale breathing ring round the base + the rim's glow | the rim alone (it cannot be seen on the plain stand-in pawn) | `TURN_MARK` |
| X-ray key | X | Alt+P; a Pawns-menu row only | `XRAY_KEY`, surfaces/xray.js |
| X-ray colours | players' pawns blue (#39d5ff), every other pawn amber (#ffae2b); hidden pawns are amber too | a third colour for hidden pawns | `XRAY` |
| X-ray look | an outline that glows where the figure is seen edge-on, a faint body inside | a flat filled silhouette; a marker pin | `XRAY.power`, `XRAY.min` |

### Pawn X-ray, as built (2026-10-06)
GM only: **X**, or "pawn x-ray" in the command bar. Every pawn in the area is drawn again as a glowing outline through
walls, floors and roofs, on every level whatever the cut shows; players' pawns blue, the rest amber; pawns hidden from
players included. It is this seat's view only: a switch in the browser, never sent, never stored. A player seat has
neither the command nor the key. Cost and Gemini's blind reads: docs/UI.md, "Pawn X-ray".

## Measuring, and templates in the turn order (2026-10-12; docs/RULERS.md)
- **The Pawns menu has a Measure section**: the ruler (M) and, with the second slice, the template palette (Line, Cone,
  Circle, Sphere, Cube). A click turns the tool on and the menu steps aside (unless pinned). The GM's section gains
  "Clear all templates" while there are any.
- **A kept template that lasts a number of rounds is a thin row in the turn order** (an hourglass, its name, "3 rounds
  left"), just before its creator's entry. The marker never stops on it; each pass takes a round off. At zero it says
  "expired" with Remove / Keep for its owner and the GM, and is removed if the turn moves on again unanswered. Its ×
  removes the template. The GM drags it like any row. Its key in `area.turns.order` is the template's id (`tpl_…`);
  the rounds left are on the template (`left`), not in `turns`.
- **A dragged pawn shows its distance**, and a selected pawn is where a measurement starts (hold M).

## How big a figure is drawn (2026-10-12)
A pawn has two sizes and they are independent. **Its size in the rules** is its base: one square (2.5 ft radius per square of `size`), which rulers, templates and reach use. **Its drawn size** is the figure's made height times the house **figure scale** (0.67 built in; the tuner's Figure scale bench sets it, "Use in game"). The base, the name on it and the facing mark do not scale. docs/UI.md "Figures as pawns" has the measurements and the reasons.

## The name on the pawn (Harry, 2026-10-06)

"Lets start by putting it at their feet, on the base, curling around the outside edge. Far from sure but we can
explore as we go." He expects to "end up tweaking it pretty hard", so every choice is a parameter (a tuner later).
Being built with the figure base (branch `figs`).

## Open

- Conditions over a pawn, and conditions shown with style (a tuner lab, once figures are in the game).
- Travel's place in the Pawns menu (built: the pawn's ☰ and the command bar; the menu itself is not built).
- The placing tree's exact families and roles: Harry, "wing it for the tree of minis, we will probably have to revisit
  it some day."

## Settled since first written

- **Where a travelling pawn arrives** (Harry): "marked location > a party pawn there > NOT area center. Out in the fog
  sea to the side of the area." Built: "Areas", above.
- **What "GM lock" on travel looks like:** built (Settings ▸ Global defaults ▸ "Players travel between areas"; the
  player's travel list then says "The GM has locked travel"). "Areas", above.

## Moving a pawn: free, and Shift snaps (2026-10-11)
Harry: "Shift should be 'snap to steps' across the board", and for pawns: "we should flip 'shift to grid' for pawns as well, though I am less sure here."
- **A dragged pawn goes where it is put; holding Shift snaps it to the middle of a square** (a large creature: to where four squares meet). Before, it snapped and Shift freed it.
- **Because he is unsure, it is a switch, per person:** Settings ▸ Me ▸ Controls ▸ **Pawns snap to squares**: *Only with Shift* (the default) or *Always (Shift = free)*. Command bar: "Pawns snap to squares: always (Shift = free)" / "Pawns snap to squares: only with Shift". Kept in the browser, so two people at one table can each have their own.
- **A figure dragged out of a list** (the bar, the Pawns menu's tree, a cast or bench tile) obeys the same rule and the same switch: let go anywhere, Shift for a square.
- **Not changed:** a pawn placed by a click from the pawn tool lands on a square (Shift there keeps placing); pawns an AI seat creates stand on a square's middle; the stair hop; arrow-key nudges.
- Code: `app.pawnSnaps` (`engine/client/main.js`), `pawnSnap` (`engine/client/input.js`), the ghost (`engine/client/pawns.js`). Test: `engine/test/browser_shift.py`. docs/UI.md "Shift = snap to steps, everywhere".

## Play-test changes (2026-10-13)

The Pawns menu has one **Measure** button, invoking `measure.start`, the same command as **M**. Shapes remain in the measurement's contextual controls, keys 1–5, and the command bar.

A person's portrait is a head-and-shoulders crop of their explicitly marked **main pawn**'s baked figure picture. Without a main pawn (or without a usable picture), it is their initial. Party rows and player turn rows share it; the command bar's People results use the same portrait. Whispers show names and a lock icon, with no person avatar. A main character on the bench still supplies a portrait. Changes to the main pawn or its figure reach other seats through the campaign view; a hidden pawn or hidden area never discloses a figure to a player through portrait metadata. The portrait fills its actual box at every text/ring size, including the smaller no-pawn row. No upload control.

## A raised pawn: the base stays down (Harry, 2026-10-13)

Harry: "raise & lower a pawn should leave its base on the ground and show an indicator beam down to the base. The base should 'fall' to the highest ground it's above and decide what height cutoff hides the pawn. (So outdoors a dragon at 40 ft should still be visible if the height cut is at 20 ft.)"

- **The figure goes up; the base does not.** The disc, its coloured rim, the facing arrow and the name lettered on it stay on the highest GROUND under the pawn's square; the figure (and its floating damage / conditions label, its indicator) is at the pawn's height. Nothing new is stored: `token.y` is still the figure's height and the base is worked out (`baseUnder` in `engine/core/height.js`; old campaigns load unchanged, `engine/test/pawnbase.test.mjs` over the frozen corpus: 1,673 pawns, none needs migrating).
- **What counts as ground**, highest first under the figure: the top of a THING standing there (a table, a crate: the same downward look a released, lifted thing lands by, `surfaceBelow`); the FLOOR of a room the figure is in or over; the TOP of a room the figure is above (its roof or deck: where the next storey's floor would be) — except a room open to the sky (a yard or any outdoor room type, a room whose roof is off), where the base goes down to that room's own ground; else the open ground. With roofs showing, a base over a room's top sits on the roof's own surface (on a pitch, on the highest point under the disc). It steps as the pawn is dragged: yard, table top, upper floor, roof, back to the ground.
- **The cut asks the base.** The base's level (floor, room top or ground: never a table top, so it is the same for every seat) is at or below the cut: the whole pawn is drawn, base, beam and figure, however high. Above it: hidden as before. The level meter's "N pawns above", the "Cut to lv N" offer (raising a pawn into the open air changes no level and offers nothing) and the selection rule all use the same test. A pawn's ROOM (hide / reveal, the room-hide cascade) was already decided this way (`tokenFloor`): a pawn whose base is on a room's top is not in that room. *Not changed:* a flyer high over a yard is not counted as in the yard for the cascade (the relay does not know room types); it is when within the yard's 10 ft.
- **The beam** (`PAWN_BEAM` in `engine/client/world.js`): a solid rod in the pawn's seat colour (unlit), about 6 in through, inside a dark sleeve drawn as an outline so it reads on pale and dark floors alike; never thinner on screen than about 7 px (11 with the sleeve) however far out you zoom; the height above the base on it, half-way up, in a small label edged in the seat colour ("40 ft"). Shown whenever the figure is more than 0.3 ft above its base, selected or not. A pawn hidden from players: see-through on the GM's screen, absent on a player's. Never picked.
- **Under 5 ft up, a pawn settles (2026-10-19).** Harry: "based on D&D rules, anything less than 5 feet off the ground should probably settle to the ground for pawns." A pawn let go by raise / lower, or moved (drag, arrow keys), to less than `PAWN_BEAM.land` (5 ft) above its base (floor, deck, a thing's top) lands ON that base; exactly 5 ft or more stays up (`app.pawnLandY`, `client/main.js`). The ring's raise / lower previews that (a pawn dragged under 5 ft reads the ground), its ticks are every 5 ft, and Shift steps a pawn by 5 ft (objects keep 6 in). It began as Harry's "a 0.5 foot ruler measurement drawn over the pawn at all times": his Bloorg, lowered from 19 ft and let go 0.43 ft up on 2026-10-15, had floated under a "0.5 ft" beam since; it settles the next time it is moved or lowered (its stored height is not rewritten by itself). Objects unchanged. Test: `browser_lift_hard.py` HOVER.
- **Knock-ons.** A click on the figure or on the base selects the pawn; the beam never does; a drawn floor still stops the pointer for each part where it is. The pawn's ring opens round the figure. Rulers and templates take the base circle in plan and the FIGURE's height where the rules already look at height (`catches`, docs/RULERS.md): a sphere reaches a raised figure, a circle on the ground does not; the red "caught" ring is drawn round the base. The turn ring and the X-ray are round the base too. Objects lift exactly as before.
- Test: `engine/test/browser_pawnbase.py` (44 checks, including Harry's dragon and its reverse).

- **Arrow keys (2026-10-15).** A selected pawn moves one grid square with an arrow (screen directions snapped to the grid axes, so a turned camera still moves it toward the screen's up) and 1 ft with Shift+arrow, as one undo step; vision and fog update as for a drag. Fog of war is now per area (docs/UI.md "Fog tweaks"): in an area with fog off every pawn is drawn.
