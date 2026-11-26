# Pawns: the menu, the bench, areas (design, Harry and Fauna, 2026-10-06)

Status: **the Pawns menu is BUILT and live (2026-10-06, late evening): see "The Pawns menu, as built" below.** The
sections before it are the design as Harry and Fauna talked it through, kept as the record; where the two differ, "as
built" says so and why. **Conditions on the table are built (2026-10-29): "Conditions on the table", below.** Still design
only: linked exits. Source: the conversation of 2026-10-06
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
- **(2026-11-03) The click cuts the view to the pawn's level, up or down; dragging a portrait onto the map seizes that
  pawn** (it moves the pawn itself, onto the floor under the pointer, one undo; only for whoever could drag the token).
  docs/UI.md "Getting to any pawn: the Pawns menu's portraits".
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
  pawn". Picking a figure offers its name. A change to a pawn that stands on the table I am at changes that pawn too.
- **No Save button (Harry 2026-11-05: "When I edit a pawn in the 'me' menu, there shouldn't be a 'Save' button, all
  edits should automatically be applied, probably instantly but at the very least on closing the window").** A choice
  (figure, No figure, pet, main) is applied at once; typing (name, sheet link, notes, the two distances) half a second
  after the last key, and at once when the field is left, another pawn is opened, Settings closes or the page goes
  away. A burst of typing is one `pawn.define` (and one `token.set` on the table: one undo step there); only the
  fields that changed are sent, and nothing when nothing did. A **new pawn** is created only once it has a name
  (picking a figure offers one); an untouched "New pawn" left behind makes nothing, and later edits change that same
  pawn. A value that cannot be kept (an emptied name, a sheet link that is not a web link) is not sent: it is said
  beside its field and the table keeps the last good one. A quiet line by the heading says "Saving…" / "Saved". No
  Cancel: `pawn.define` is a campaign command, out of reach of the relay's undo, so after a change the editor offers
  **"Put it back as it was"** (the pawn as it was when the editor opened). The editor stays open beside "New pawn"
  until another pawn is opened or Settings closes. The GM's editor on a player's pawn works the same way; the
  player (and, for the pawn on the table, everyone) sees each change live.
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
- Two levels, then a grid of thumbnails; the levels above are the Build tray's stacked chips, under the same breadcrumb rule (docs/UI.md "The breadcrumb rule", 2026-11-12: a chip is named for the list it opens and wears that list's owner's picture; the header says where you are, `Monsters ›` Goblins); Backspace goes up.
  Heroes ▸ the 12 classes ▸ 14 figures, race by rows, woman and man in two columns. Townsfolk ▸ nine roles by race, and
  Tavern, Trades, Court, Law and faith, Streets and docks. Monsters ▸ 24 families ▸ a grid; a large creature is in its
  family with a "2×2" mark. Animals ▸ one grid.
- A grid shows 15 at most; one with more ends in **"more…" (M)**, which fills the bar with that family.
- A click on a thumbnail is the pawn tool (Shift keeps placing); the menu steps aside unless pinned.
- **A thumbnail can be dragged onto the map** (2026-10-06, after Harry's "the pawns can't be dragged out of the text-search menu"): so can a cast tile (a group drops whole) and a bench tile in Mine (it is brought on where it is let go). docs/UI.md "Dragging a figure out of a list".
- **The tree's shape is ONE table:** `PAWN_TREE` in `engine/client/pawntree.js` (families by the figures' `family`,
  tags or ids; first match wins; "Monsters of legend" takes the rest). All 518 figures have a place (tested).

### On a phone (2026-11-11; surfaces/pawns.js "On a phone"; a computer keeps the order above)
A stranger on a plane wanted to put some pawns down, and the whole top of the menu was the blank Mine tile ("New pawn"). On a phone (`html.tw-hand`) only, the home view's sections come in another order (`app.pawns.sectionsNow()`):
- **The GM:** Place a pawn first: one wide **Search** row (the bar with "place pawn …", which has the mic), then the kinds with **Monsters, Animals, Townsfolk** first and **Heroes** after them, the rest in the tree's order; then the turn order, On the table, the cast, the party, Measure; **Mine** is one row near the end (my pawns as small chips, and "Make your own pawn", or "New pawn" when I have some); the GM tools last.
- **A player:** Mine first, as on a computer (their own pawn stays at the top), then the turn order, the party, Measure; placing, for a seat that may, after those.
- Tap targets in the tray are at least 40 px (the row buttons, the portraits, the chips). Tests: `engine/test/browser_phonefix.py` PAWNS.

### Which goblin: a name typed in the bar (2026-11-06)
- **A creature's own name beats an SRD name it only lists.** "goblin", "goblins", "6 goblins", "goblin x6" top with a
  plain goblin ("Goblin, bow": the catalog writes a variant as "Name, variant", and the part before the comma is its own
  name), never the Goblin boss, whose SRD names list "goblin" because it is built on one. "goblin boss" still finds the
  boss. The same held for bugbear (Bugbear chief), cultist (Cult fanatic), ghoul (Ghast) and lizardfolk (Lizard king).
- Found 2026-11-04 in the manual walk: both kinds got the same own-name bonus and the boss's shorter name broke the tie.
- Code: `engine/client/figsearch.js` (pure; `figures.search` uses it). Test: `engine/test/figsearch.test.mjs`, which
  checks every "Name, variant" family in the catalog.

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
**Since 2026-11-06 a pawn's size scales its figure too: "A pawn's size", below.** As first written: a pawn has two sizes and they are independent. **Its size in the rules** is its base: one square (2.5 ft radius per square of `size`), which rulers, templates and reach use. **Its drawn size** is the figure's made height times the house **figure scale** (0.67 built in; the tuner's Figure scale bench sets it, "Use in game"). The base, the name on it and the facing mark do not scale. docs/UI.md "Figures as pawns" has the measurements and the reasons.

**The base, 2026-10-29.** Harry: "let's change bases from 5ft black to like 4ft medium grey. I noticed they feel a little big and show up dark." Then: "Facing arrow can be much smaller and facing gap can go away", and "Let's make the facing arrow a grab handle for rotation, I noticed I frequently want to do that." The disc is medium grey (`#757e88`) and 4 ft across in its 5-ft square (it was near-black and 4.5 ft); the rim is one whole ring in the seat's colour; the facing mark is a small arrowhead whose point is 0.5 ft past the rim; dragging that arrow turns the pawn (45° steps, Shift free, one undo; yours, or any for the GM). The rules still use the square, never the disc. docs/UI.md "Turning a pawn by its arrow".

## The name on the pawn (Harry, 2026-10-06)

"Lets start by putting it at their feet, on the base, curling around the outside edge. Far from sure but we can
explore as we go." He expects to "end up tweaking it pretty hard", so every choice is a parameter (a tuner later).
Being built with the figure base (branch `figs`).

## Open

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

## A new player's placeholder pawn (Harry, 2026-10-22)
Harry: "When a GM creates a new player and sends the invite link, the player arrives in the world with no pawn, no idea where to create one, nothing prompting them to, and when they do create one it lands somewhere arbitrary." And: "if I'm inviting Bobby, it drops a blank pawn so I can position Bobby when he arrives." Offered, never forced: "if people keep using the placeholder, it should never become a nag."
- **The invite places it.** Every invite goes through `app.createSeat` (main.js): the bar's "invite …" and Settings ▸ Invites and exports ▸ Invites and seats. After the seat is made it defines the seat's MAIN pawn flagged `placeholder` (`pawn.define`, the GM may define anyone's) and brings it onto the table from that definition (`pawn.bring`): two commands through the one door, so undo and every seat get them. Re-copying an existing seat's link is a reissue, never `createSeat`: no second pawn. Existing seats with no pawn are left alone (no retroactive placeholders).
- **Where** (`app.placeholderSpot`, client/pawns.js): the GM's arrival mark if the area has one, else beside the party (the square a travelling pawn gets, core/travel.js), else the middle of the GM's view, else open ground beside what is built. Always a free 5-ft square (no pawn, no furniture), never in a room hidden from players. **Which area:** the GM's own when it is open to players, else the first open one; the seat starts there (`seat.create location`). The GM moves it like any pawn.
- **The flag** (`placeholder: true` on the pawn and its definition; core/commands.js `withPlaceholder`): ANY figure change clears it (a figure, or "no figure", the plain stand-in, chosen); `placeholder` given explicitly wins (the editor saving a name with no figure keeps it). Undo of the change restores it (the generic inverse). Old campaigns carry no flag and nothing changes. A pawn changed through the bar's "change figure" tells its definition too, so it does not come back from the bench as a placeholder. (The definition's own change is campaign data and is not undone with the pawn: the pawn on the table is what undo restores.)
- **Its prompt** (`pawn.choose`, client/commands.js): while it is a placeholder its ring LEADS with "Set your pawn" (its player) or "Choose Bobby's pawn" (the GM side), in the person's colour with a slow glow and its name always shown under it (`ring.prompt`, surfaces/ring.js). It opens Settings ▸ Me ▸ My pawns with the editor on this pawn's definition; for the GM, in its own group "Bobby's pawn" above the GM's own. Other players are never offered it. Whoever chooses first makes it an ordinary pawn and the prompt goes for everyone.
- **Its look** (client/figures.js `PLACEHOLDER_FIG`, `PLACEHOLDER_LOOK`): the plain Human commoner figure, UNPAINTED: grey primer, matte, solid, whatever the seat; whose it is is on its base rim (the seat's colour), and one tag "Bobby · not chosen yet" (no name on the base). Chosen by blind Gemini reads of stills: every see-through variant read as "a ghost, spirit or stealthed enemy" (and the GM's hidden-pawn look is see-through already); the solid pale one as "unpainted grey plastic, a blank slate"; a body tinted in the seat colour read as paint (orange, green) or as a ghost (lavender), so the colour stays on the base. Its portrait is the seat's initial (no figure to bake) until it is chosen.
- **The player's first arrival** (client/arrival.js): the first time a seat opens the campaign in a browser, the camera goes to its own main pawn (at most 60 ft out). If that pawn is still a placeholder, ONE conditional button beside it: "This is you, Bobby. Click to choose who you are."; after 9 s it goes down into the chat as "Your pawn is a stand-in until you choose who you are · [Choose]". Remembered per campaign, seat and browser (`tw.arrived.<campaign>.<seat>`); it never moves the camera later in a visit. The GM side never gets it.
- **Tests:** `engine/test/core.test.mjs` (the flag's rules, 20 checks), `browser_two_tab.py` M7 (17: GM invite, beside the party, the GM's and Bobby's prompts, another player not offered it, reissue, Bobby's arrival centred with its offer, choosing in the editor, both tabs, portrait, undo, the GM choosing, the second visit), `browser_ui.py` PLACEHOLDER (7: the Settings invite, its hidden-room rule, the initial portrait, the GM's editor, undo, a bare seat with the switch off). The older suites invite with no pawn placed and no arrival centring: `tests/tw_sandbox.py placeholder_pawns(True)` turns both on for a suite (prefs `invitePawn`, `arrivalCentre`, on in every real browser, not shown in Settings).

## Beyond20, and a pawn's target (Harry 2026-10-29, as built)
D&D Beyond rolls, hit points and conditions come to the table through the Beyond20 extension, and a pawn can aim at another (its `target`). Player setup, what crosses and what is never stored: **[docs/BEYOND20.md](BEYOND20.md)**. In short: link the pawn to the D&D Beyond sheet once (one click on the first roll's offer). Rolls then land TW's 3D dice on Beyond20's numbers. HP becomes damage (max − current). Initiative goes into the running turn order. Every pawn you act for has an **Attack** button. Its list is the pawn's saved attacks (`attacks: [{ name, hit, dmg }]`, 8 at most, names and dice only), filled from Beyond20, from "+ Add attack", or over GET. Pawns get a **Target** button and the **T** key.


## Conditions on the table (Harry's design of 2026-10-15; built 2026-10-29)
Harry, 2026-10-15: don't mark conditions with icons on the table, "let's look at more fun ways". The ring's painted
condition pictures stay in the ring's Conditions arc. The direction is loud: **"big cartoony, easy to follow."** No "who is
doing it to you" tethers ("players can keep track"). Harry, 2026-10-29: "we never did visual status effects", and
"missing status effects that come over can just be a text label". (The design was docs/design/conditions-2026-10-15.md,
now this section. Lab notes: experiments/2026-10-29-statusfx/LAB_NOTES.md.)

| Condition | On the table |
|---|---|
| Prone | the figure laid on its side on its disc |
| Unconscious | on its back, big Z's drifting up from the head |
| Dead (added; not a 5e condition) | toppled face down, greyed, no Z's |
| Charmed | orbiter: a pink cartoon heart |
| Stunned | orbiter: a fat yellow cartoon star |
| Frightened | orbiter: a little purple ghost (picked over a red "!!" from stills: Gemini 92%) |
| Blinded | orbiter: a crossed-out eye (picked over a black storm cloud: 98%) |
| Grappled | orbiter: an orange-tan grabbing hand |
| Restrained | orbiter: a brass padlock on a short iron chain |
| Poisoned | orbiter: a green skull and crossbones (picked over green bubbles: 75%, with the warning that it can be confused with exhaustion 6's white skull; `STATUS.picks` in client/statusfx.js swaps it) |
| Paralyzed (added) | orbiter: a blue lightning spark |
| Invisible | its owner and the GM: the figure as rippling glass (cool, see-through, bands moving up; unlike the GM-hidden ghost, which is plain see-through grey). Everyone else: a faint shimmer at the figure's edges and no figure. "Gone" is the existing Hide. |
| Incapacitated (added) | the base's coloured rim goes dim grey (its seat colour mixed 82% toward a grey darker than the disc) |
| Concentrating (added; not a condition) | a gold rune circle on the floor round the base, slowly turning |
| Exhaustion 1–6 (added) | a 6-segment drain ring on the floor round the base, just outside its rim: that many segments lit, yellow at 1 through orange to red at 5, the rest faint; at 6 the whole ring black and a bone-white skull on the head ring (on the floor it hid behind furniture: Gemini) |
| Any other word (deafened, petrified, "Hexed", an AI seat's text) | a small text label on a generated wooden plate, on the same orbit ring |

- **The ring over the head.** Orbiters and text labels share ONE ring, evenly spaced, going round (0.9 rad/s), each a
  little smaller (6%) as more join; the far half of the ring a little smaller and dimmer. One entry is drawn three times,
  two twice each (the stars round a dazed head). **Past four: the first three and "+N"** (text labels counted). Each
  orbiter has its own shape AND colour. **The stack over the head** (2026-10-29, after Harry: the indicators "probably
  shouldn't be quite so high"): the ring's point is the crown raised 3% of the figure's height, its nearest pictures
  coming down a hair (1% of the view) over the crown; the floating name / damage label stands just over the ring's top and
  the indicator just over that (a pawn with no ring: the indicator just over its head, or on its label). Gemini picked it
  from three at table distance (99%): lower put the pictures over the faces, higher lost them from the figure.
- **Nothing under the ring** (2026-10-29, Harry: "why are you drawing the indicators under the indicator buttons on the
  orbital menu? ... very bad look"): with a pawn's ring open, any orbiter, plate, Z or indicator on the table that would sit
  under a ring button (or its open panel) fades out over the last 10 px and back as it comes out (the buttons are in the
  page over the canvas; a painted button's clear corners showed them). And a ring button that carries its own picture (an
  Indicator's shape, a thumbnail) keeps it unpainted: the painted set's picture had been drawn over it, pushing the
  indicator's own out under the button. The orbit itself is unchanged (Harry: not circling the head "is ok").
- **Poses:** unconscious and dead beat prone; dead beats unconscious. A posed figure lies ON its disc, centred.
- **Visible to every seat that is sent the pawn** (conditions are not secrets), except Invisible as above. A pawn the GM
  hides from players is never sent to them, so neither is its look.
- **Parked:** the Low graphics preset and "reduce motion" stop the orbiters (evenly round the ring) and the runes.
- **Names on hover:** with a pawn selected, the pointer over it names all its conditions ("prone · Hexed · exhaustion 2");
  over one orbiter, that one ("+N": the rest by name).
- **Pictures:** Codex image_gen, one house-style line and a subject each (experiments/2026-10-29-statusfx/BRIEF-*.md),
  packed into engine/client/data/icons/status/ (git-ignored like every picture; `pack_atlas.py`). Never hand-drawn. Without
  them an orbiter is drawn as its word on the text ring.
- **Cost:** three instanced draws per world for the whole table (orbiters from one atlas; text labels from one canvas
  atlas of words; floor rings from one picture), whatever the number of pawns; poses and body looks change the pawn's own
  visual once. Measured: lab notes, "Frame time".

### The words, and what the relay checks
- Stored as before, `conditions: [word, ...]` on the pawn. TW's words are lower case (core/pawn.js `CONDITIONS`, 14:
  blinded, charmed, frightened, grappled, invisible, poisoned, prone, restrained, stunned, unconscious, paralyzed,
  incapacitated, dead, concentrating). Exhaustion is ONE entry, "exhaustion 1" to "exhaustion 6". Any other word is kept as
  typed ("Hexed").
- **Every way in cleans a word** (core/conditions.js `normCondition`): control and markup characters go, spaces collapse,
  TW's words and a few spellings (Paralysed, Concentration) become TW's word, "Exhaustion level 3" becomes "exhaustion
  3", anything else is cut to 24 characters; repeats go (case-insensitive), 12 words at most.
- **The relay checks the SHAPE, never the vocabulary** (`conditionsProblem`, on token.set and token.create): a list of at
  most 12 words, each 1 to 24 characters with no space at either end, letters (any script), digits, spaces and a little
  punctuation, no word twice, one exhaustion level. **Old journals replay unchanged** (apply never looks at the words;
  the frozen corpus: 276 pawns, 26 with conditions, none the new check refuses).

### Setting and clearing
- **The ring:** ☰ ▸ Conditions ▸ the 14 words (✓ = on), **exhaustion N** (+1) and, while exhausted, **exhaustion −1**,
  one tile per text label on the selection (**"✓ Hexed"**: a press takes it off), and **Other…**, which fills the command
  bar with "condition " and puts the cursor there.
- **The command bar**, with pawns selected: **"condition Hexed"** (or "status blessed") adds one; **"remove condition
  Hexed"** takes one off; **"exhaustion 3"** sets the level ("exhaustion 0" clears it); **"clear all conditions"**; and
  each of TW's words by name ("prone", "paralyzed") toggles it.
- **Space C** (the chord tree) opens the same list.
- **Beyond20** (docs/BEYOND20.md): D&D Beyond is the truth for its own words; deafened, petrified and any word TW does not
  know arrive as text labels; exhaustion arrives with its level ("exhaustion 2"); TW-only words (dead, concentrating,
  typed ones) are left alone.
- **An AI seat over GET:** `token.set&id=PAWN_ID&conditions=prone,Hexed` (the whole list; `conditions=` clears; a JSON
  list may hold a comma). Cleaned the same way before the check. The rules card and `/c/<campaign>/conditions` say any
  short text is allowed and which words have a look.

### Open (for Harry)
- In darkness the orbiters and plates stay at full brightness, like the name labels (readable, not lit): Gemini, "wrongly
  bright". Dim them in the dark, or keep them loud?
- The drain ring's lit segments are hard to count from table distance (Gemini, round 3). A number on it, or the level
  on the head ring?
- Poisoned's green skull can be confused with exhaustion 6's white skull (Gemini). Bubbles is one line away.

### Code and tests
`engine/core/conditions.js` (words, shape, looks), `engine/client/statusfx.js` (drawing), `engine/client/world.js`
(wiring; the label no longer carries the words), `engine/client/commands.js` (ring and bar), `engine/client/main.js`
(setters, hover names), `engine/core/beyond20.js` `conditionsAfter`, `engine/relay/llm.js` / `llm-card.js` (GET).
Tests: `engine/test/conditions.test.mjs` (in npm test), `engine/test/browser_statusfx.py` (two seats: ring, orbiters,
poses, text labels, +N, exhaustion, dim rim, runes, invisible and hidden rules, Beyond20, GET, hover names, clear all).

## Aura (2026-10-30, as built)
A light round a pawn, inspired by Exalted's anima banner and meant for anything like it: a raging barbarian, spirit
guardians, a divine glow, a Vampire's Discipline. Five intensity levels in the pawn's own colour. Code: `engine/core/aura.js`
(the words, the strict check, the change), `engine/client/aurafx.js` (drawing). Lab notes: experiments/2026-10-30-aura/LAB_NOTES.md.

| Level | On the table |
|---|---|
| 0 none | nothing |
| 1 dim | a faint shimmer at the base: a soft rippling glow on the floor at the base's edge; the base's bevel and the figure's feet catch the colour |
| 2 glowing | a soft light rising behind the figure to its crown, its legs and lower body lit, a pool of light on the floor |
| 3 burning | tongues of flame-like light (crisp, painted-resin style: a deep shade of the colour at the edge, a pale core) rising behind and beside it to just over the head; the whole figure rim-lit; a few sparks |
| 4 bonfire | a tall flame column well above the figure (2.7 figure heights, 13 ft at least), sparks, a wide pool: readable across the table |
| 5 iconic | the bonfire a little taller, with a large faint emblem hanging in the column over the head: the pawn's faction emblem (`aura.emblem`), else the sun. The emblems are the factions' own (tools/spawn-tuner/assets/emblems), drawn as light in the aura's colour |

- **The look** (after six Gemini rounds, experiments/2026-10-30-aura/LAB_NOTES.md): light ON the figure and its base, the way a
  painted miniature's object-source lighting is (the figure's own materials worn as lit clones: a rim and an underlight in
  the colour, climbing the figure with the level); the column's near side is never drawn in front of the figure, so the
  painted figure stands in relief against its light; nothing ever bleached white.
- **Colour:** gold (the default), silver-white, blue, green, red, violet.
- **Stored** on the pawn as an optional `aura: { level, color }` (and `emblem`, a faction id, for level 5). Level 0 keeps its
  colour (an aura put out and lit again comes back in it); level 0 in gold is no field at all. Old journals have none and
  replay unchanged. **The relay checks it strictly** (`auraProblem`, on token.set and token.create): level a whole number
  0 to 5, colour one of the six, an emblem a short faction id, no other field.
- **Setting it:** ☰ ▸ **Aura**: Aura up, Aura down, Aura off (while lit), and the six colours (a colour picked with no aura
  lights it at glowing; ✓ on the one it has). **The bar**, with pawns selected: "aura 3", "aura up", "aura down", "aura off",
  "aura blue", "aura 4 red", "aura burning", "aura emblem dragons". **An AI seat over GET:** `token.set&id=PAWN_ID&aura=3,blue`
  (aura=up / down / off, a colour alone, `aura=5,gold,dragons` for an emblem, or JSON `{"level":3,"color":"blue"}`); the
  scene lists each pawn's aura. Who: the pawn's owner and the GM, as conditions.
- **Who sees it:** everyone (it is not a condition with hidden visibility), by the conditions' rules: a pawn the GM hides is
  never sent to the players; a pawn out of a player's sight in the fog draws no aura for her; an **invisible** pawn's aura is
  drawn only for those who see it as glass (its owner, the GM side). In first person the pawn you look through draws none for
  you (its figure is not drawn either).
- **Nothing under the ring:** with a ring open, no pixel of an aura is drawn under a ring button or an open panel (the
  conditions' mask, app.ringMask, applied per pixel: it fades out over the last 10 px).
- **Low graphics and reduce motion** draw the static version: the light stands still, no sparks.
- **Cost:** three instanced draws per world for every aura on the table (the light columns, the floor, the sparks and
  emblems). All of it is computed light (noise on an open tube, a floor pool, sparks); the only pictures are the emblems.
- **Ring icons:** painted, charcoal and parchment, by Codex image generation with our own icons as style references
  (experiments/2026-10-30-aura/icons).
- Tests: `engine/test/aura.test.mjs` (in npm test), `engine/test/browser_aura.py` (two seats: ring, colours, bar, the strict
  relay, GET, levels, hidden / fog / invisible, replay, the ring's mask by pixels, Low graphics, draw calls, first person).

## First person: look through a pawn's eyes (Harry 2026-10-29, as built)
Harry: "let's also do first person (should probably be a button in the pawns menu for that pawn owner or gm rather than scroll in. Maybe something in the players orbital too)".
- **Who:** the pawn's owner and the GM (`app.canTouch`). A player's own pawn has **Eyes** on its closed ring; the GM (and every ☰) has **First person**; **V** with the pawn selected, or (a player) with nothing selected for their main pawn.
- **What the pawn does:** it walks square by square through the ordinary move (`token.move`, one undo step a square), facing where you look; walls, shut doors and windows stop it. Its figure is not drawn for the seat looking through it; every other seat sees an "in first person" tag over it.
- The whole design, the keys and what is cut from the screen: docs/UI.md "First person". Height: docs/VERTICAL.md "First person".

## A pawn's size (Harry 2026-11-06, as built)
Harry: "doing resizing for pawns (which should also change their footprint)". Code: `engine/core/size.js` (the words, the check, the figure's scale, the fit rule), `client/pawns.js` (`app.setSize`, occupancy, `app.pawnFits`), `client/figures.js` (the figure and base drawn at the size), `client/commands.js` and `client/menu.js` (☰ ▸ Size and the bar), `relay/llm.js` (GET). Lab notes: `experiments/2026-11-06-pawns/LAB_NOTES.md`.

| Size | Squares a side (`size`) | Base disc | The figure |
|---|---|---|---|
| Tiny | 0.5 (a 2.5-ft quarter of a square) | 2 ft | half its made size; a figure made tiny already (a hawk, an imp: made 2.5 ft tall or less) is not shrunk again |
| Small, Medium | 1 (5 ft) | 4 ft | as made |
| Large | 2 (10 ft) | 8 ft | twice a medium figure; a figure made large (a young dragon) as made |
| Huge | 3 (15 ft) | 12 ft | three times a medium figure, 1.5 times a large one |
| Gargantuan | 4 (20 ft) | 16 ft | four times a medium figure |
| (free) | 5 to 8 (25 to 40 ft) | 80% of it | by the same ratio |

- **One number, everything reads it:** the base (80% of the footprint across), the figure (drawn at `size` over its figure's own size: `figureK`), the squares it takes (placing a group, the pawn tool's lit squares), the movement rings and a drag (below), the rules (rulers, templates and reach take `pawnRadius` = 2.5 ft x size), the turn ring, the target reticle and the "caught" ring, picking (the base's own pick pad is its size), the floating label and the conditions over its head (the drawn height), the aura (the base's radius). First person's eye is the drawn figure's height. Sight is by level (there is no eye height in it).
- **Where it is stored (decided):** the DEFINITION (Settings ▸ Me ▸ My pawns ▸ Size: "its figure's own" or a size) is the default, what the pawn is when it comes on from the bench. The PAWN on the table may differ: resizing it (Enlarge, Reduce, the GM's "make it huge") never changes the definition, and benching it ends that. Changing a pawn's figure keeps a size that was chosen for it (one that is not its old figure's own), else it takes the new figure's. `size` absent = 1 (as it always was: every way a pawn is made writes its figure's own size).
- **Setting it (2026-11-07, Harry: "the 'size' options on pawns should just use the same design language as the object resize (same image, and drag in&out on track)"):** ☰ ▸ **Size** is ONE drag button, the props' resize: the same picture (line icon and painted), the same track drawn along the handle's ray while it is held (docs/UI.md "A pawn's Size is the resize handle"). Its stops are the sizes a pawn may have, tiny · medium · large · huge · gargantuan (named) and 25 to 40 ft (ticks), one step apart, the size it has where it was grabbed; outward is bigger. The handle follows the pointer; the dot and the readout ("large · 10 ft") step to the nearest size, and the pawn (every selected pawn) is drawn at it while held; letting go sends it through `app.setSize` (the same command as before: its squares, the room it needs, one undo, every seat, the owner and the GM). Escape cancels; a click says how. Mouse, pen and touch alike. The **keyboard** keeps the list: Space ▸ Size (`i`) ▸ Bigger, Smaller, Tiny, Medium, Large, Huge, Gargantuan (✓ on the one it has); the ring no longer shows that list (`RING_CUT`), and the drag button is not in the chord tree (`ringOnly`). Before 2026-11-07 the ring showed the list as a ▸ sub-menu. **The bar**, with pawns selected: "size large", "make it huge", "tiny", "15 ft", "size 3", "3x3", "bigger", "smaller", "enlarge", "reduce". **An AI seat over GET:** `token.set&id=PAWN_ID&size=huge` (size=large / 15ft / 3 / bigger / smaller; `token.create&fig=...&size=large` keeps that size, not the figure's); the scene lists `squares` and `size` for a pawn that is not medium; help/pawns says so. Who: its owner and the GM, as conditions. One command (one undo), every seat.
- **The relay checks the shape:** `size` is 0.5 or a whole number 1 to 8 (`sizeProblem`, on token.create, token.set, pawn.bring, pawn.define, cast.save); anything else is refused with the reason. Old journals (whole numbers 1 to 4) replay unchanged.
- **The squares it takes:** occupancy is counted in quarter squares, so a tiny pawn takes a quarter and four can share a square (a tiny pawn stands on a quarter's middle; Shift snaps it there); a medium pawn is 2 x 2 quarters, a large 4 x 4. A group placed beside a big pawn keeps off its squares.
- **A big base in a narrow place** (`clearanceOf`, `crampedAt`): a pawn larger than one square keeps its middle its disc's radius from every wall its feet meet (4 ft large, 6 ft huge): it passes a 10-ft opening and not a 5-ft door; huge needs 15 ft. A pawn of one square or less is unchanged. Where it applies, with the same feedback as other blocked moves:
  - **dragged** into a place too narrow: held where it last had room (as over solid rock), the label says "Ogre is too big to fit there (large: 10 ft across)" in red, and let go it stays there with the same words in a toast;
  - **moved by the arrow keys or the bar:** refused, "… it stays where it is" (as solid rock is); a pawn already squeezed may still move;
  - **placed** from the pawn tool or a list: the squares show red with the same words, and the click or drop is refused;
  - **resized** where the new base has no room: it steps to the nearest place that has (one undo puts back both size and place); with none near, it stays as it was and says so;
  - **the movement rings** of a large pawn flow round the 5-ft door and through the 10-ft opening (`core/walk.js` `clear`).
  - The fit is the client's, like the rings ("a hint, not a rule", Harry 2026-11-02): the relay does not refuse a move by walls (no pawn move ever was), so an AI seat's move is not judged by it.
- **Decided by Fauna, easy to change:** small and medium are the same (both one square, the figure as made; "make it small" on a large dragon makes it medium); the free sizes stop at 8 (40 ft); the disc's radius is the clearance (a base may not cross a wall; `clearanceOf`); a resize that has no room steps up to 12 quarter squares away. Tests: `engine/test/size.test.mjs` (in `npm test` and tools/test_matrix.json: the words, the check, the scale, the fit, the rings' field, a real relay with two seats, undo, the definition's default, GET), `engine/test/browser_size.py` (RING, TRACK, BAR, SQUARES, PICK, FIT; `--shots`; TRACK since 2026-11-07: the drag, its stops, the preview, both seats, undo, Escape, a player's touch drag, the chord tree's list).

## A flying pawn (Harry 2026-11-06, as built)
Harry: "for pawns that often fly (like say a dragon) let's make an alt of them flying and when they get their vertical set switch to flying mode."
- **The switch:** a pawn whose figure is **5 ft or more over its base** (`FLY.at` = `PAWN_BEAM.land`, the height a pawn stays up at: under it a pawn settles) wears its figure's **flying pose**: the same creature, wings spread, airborne (`fly` in the figure's list row; `client/figures.js` `setFlying`). Lowered, it stands again. Nothing is stored: the pose follows the height the raise / lower control already sets, the same for every seat, and undo of the raise undoes the pose with it. The pose not worn is taken out of the figure's holder, so the conditions' poses, the hover outline and the bounds see one figure; its file is fetched the first time it flies.
- **Without a flying pose** (most figures; a flier whose pose is not made yet, or whose file cannot be had): the standing figure, lifted, as before.
- **Where it is on the grid:** the base stays on the ground under it (since 2026-10-13: the disc, the rim, the name and the facing arrow), the beam with its height joins them, the cut asks the base; and now a soft **shadow** lies on the floor round the base of any pawn in the air (`FLY.shadow`: 1.55 times the base's radius, half dark at the middle, fading out), flying pose or not.
- **The flying figures** are made by the figures pipeline (lab notes `experiments/2026-11-06-pawns/fly/LAB_NOTES.md`; `tools/spawn-tuner/build_figures.py` reads `experiments/2026-11-06-pawns/fly/manifest.json` and gives each flier's row its `fly` object: `url`, `k`, `c`, `yaw`, `h`, `oh`, `span`, and `full` for a main pawn).
- Tests: `engine/test/browser_size.py` FLY (both seats: the pose up and down, the shadow, undo, under 5 ft, a figure with no pose; a stand-in mesh carries the pose where the flying figures are not built).

## Riders: what stands on a thing moves with it (Harry 2026-11-07, as built)
Harry: "If I stand a pawn on a table, and then I move the table, it should move the pawn with it." (It came up designing an elevator: a shaft plus a car object; move the car up and everything on it goes up.) A global engine rule, `engine/core/riders.js`.
- **What rides.** A *thing* rides the thing it was put on (its `parent`, set where it was dropped; unchanged since 2026-11-02, "for every action on a parent"). A *pawn* rides the thing its base stands on: the browser asks the same downward look that draws the pawn's base on a table top (`app.pawnCarrier` → `world.surfaceBelow`; feet within 0.35 ft of the drawn top). Recursive: a mug on a tray on a table, and a pawn on the tray, all ride the table. A pawn flying over the table (5 ft up or more) does not ride; nor does one standing on the floor under or beside it.
- **When it is decided.** Once, when the move starts (a snapshot: the grab of a drag, the key press, the grab of the ring's turn or raise). A table dragged under a pawn standing on the floor does not scoop it up.
- **Every move carries:** arrow keys and the bar (nudge), the mouse drag (with its live preview, for every seat through the drag presence), Turn (R, the ring: the riders go round the thing's middle and turn with it), raise / lower (the lift car: the riders rise and fall with it), an AI seat's `object.move` through the relay, and anything a remote seat sends. The riders go INSIDE the thing's own command (`object.move` `carry: [ids]`; core applies the same rigid move to each), so every seat gets **one log entry** (no rider lags behind) and **one undo** puts them all back. A relay restart replays it. A journal line without `carry` (everything before today) replays as before: the thing alone.
- **Permission (Harry 2026-11-07): the carrier's.** Whoever may move the table moves what stands on it, whoever owns it: another player's pawn rides. The rider's own permission is not asked (an AI seat that may move things but not pawns still carries the pawns on its table; moving that pawn by itself is refused). The relay still checks each rider could have been standing there (`carryProblem`: over the carrier's box, or over another carried thing's, feet between its floor and a foot over its top), so a table's move cannot take a pawn from across the room. Players cannot move things at all, so they carry nothing. A **locked** thing never rides (it stays, and so does what stands on it, as for delete).
- **Privacy is unchanged.** A hidden pawn on a visible table rides (the GM sees it), and the entry is then private: the player side gets only the entities it may see (relay `entryFor` projection), so not its id, not its new place. A pawn carried into a hidden room hides there as a walked one does (not a player's own pawn, as for walking). Fog and `seesLabels` are not touched: no new field reaches a player.
- **What does not carry or ride.** A floor tile, a hole or a pit, a stair or a ladder (a floor, not a tray), a wall piece, a door or a window, a thing hung on a wall: none carries pawns (things put on a wall shelf still ride it by `parent`, as before). Rooms are not riders' carriers here: a room's own move, turn and height carry its contents by their own rules, unchanged. A pawn is not a carrier.
- **Walls and collision.** Riders move rigidly with what carries them: no walk, no rock check, no fall offer, no squeeze check of their own. Where the table can go, they go.
- **AI seats** (`relay/llm.js`): the relay works the riders out from the data (things' parents; a pawn's feet at a thing's top, over its box: `ridersOf`), and the answer names them (`"carried"`). `carry=none` moves the thing alone; `carry=ID,ID` names them.
- **For the elevator** (the `modrooms` lane): the car is just a thing. `app.liftTo(car, y)` (the ring's raise / lower), or an `object.move` with a new `y` and `carry`, takes everything on its floor with it. A car whose top is its floor works as is; a car drawn as a box with a floor inside it needs its floor to be the surface the downward look finds (or its `dims[1]` to be its floor height for AI seats).
- **Drawn standing on it (fixed 2026-11-07, found by this lane's blind read):** a pawn settled onto a table top is stored at its height to the hundredth, which could be a hair under the mesh's top (2.45 for a desk at 2.4539); `world.pawnBaseAt` then refused that top and drew the pawn's base on the floor under the table with a "2.5 ft" beam. A top within 0.02 ft over the feet now counts, so the base is drawn on the top it stands on, and rides up with a lift car.
- **Not done (open):** pawns on a thing that is TIPPED over (Roll) do not land as things do (`app.tiltLandings` is things only); deleting or hiding a table leaves the pawns on it where they are (only things go with delete and hide). A tab opened before the deploy applies a carry as the thing's move alone until it reloads.
- Tests: `engine/test/riders.test.mjs` (core: membership, carry, turn, raise, recursion, undo, the permission rule, a hidden room), `engine/test/riders_relay.test.mjs` (two players and an AI seat over real sockets: one entry, undo, the permission rule, a hidden rider never on a player's wire, restart), `engine/test/browser_riders.py` (a real desk: arrow key, mouse drag, the snapshot, R, raise and lower, a pawn on a tray).


## Pawns by culture: the Regional grid (Harry 2026-11-07, as built)
Harry: "probably need some pawns by culture. We don't need the full DND grid, just some NPCs, and a armored fighter, rouge-like, and caster for each race." Then, the same morning: "each race was dragon born /dwarf/ect. So our grid needs a hindu-teifling-warrior option." So the grid is **culture x race x role**: for each of the seven culture packs (Japan, late-Edo Kyoto; China, mid-Qing Beijing; India, 18th-c. Jaipur-Amber; Norse, Viking Age; Mamluk, Cairo and Damascus, 14th c.; Rus', 12th-c. Novgorod and Kyiv; Mexica, Tenochtitlan c. 1500) each of the house set's seven races (human, elf, dwarf, halfling/small-folk, orc, tiefling, dragonborn) as an armoured fighter, a rogue and a caster in that culture's period dress, plus four NPCs (human). 7 x (21 + 4) = 175 figures. The human row is the first-written roster; the six fantasy races wear one race-neutral dress per culture and role with three kits cycled across them (`experiments/2026-11-07-culture-pawns/grid.py`). Lab notes, rosters, both sensitivity reads and every plate: `experiments/2026-11-07-culture-pawns/` (LAB_NOTES.md).
- **Where they are in the Pawns menu:** Place a pawn ▸ **Regional** ▸ a tile per culture ▸ a tile per race (Human first, the house order), then **Townsfolk** for the culture's NPCs ▸ the fighter, the rogue, the caster. The Indian tiefling warrior: Regional ▸ India ▸ Tiefling. A culture figure is there ONLY, never also under Heroes or Townsfolk. A culture of one race (none now) stays one grid.
- **The genre word is in one place:** "Regional" (Harry 2026-11-07; it was "Cultures") is `GENRES` in engine/tools/build_types.py (key `cultures`, unchanged), which the Build tray and the Pawns menu both read (types.json, the taxonomy). A figure says which pack it belongs to by the room packs' setting code (`setting: 'IND'`) and its heading (`kin: 'India'`); a pack with no room type yet can say `genre` and `kin` instead. Code: `client/pawntree.js` (`by: 'genre'`, `genresFrom`), `surfaces/figtree.js` (a third level, "Race").
- **Root keys:** a root never takes B, C, F, G, N, O or P (`ROOT_KEYS_TAKEN`: the Pawns menu's own keys on the same screen; the cyberpunk lane found the same need the same day and the two lanes use one list), so Regional takes R.
- **Names and search words:** listed as "Norse smith", "Japanese samurai", "Rajasthani tiefling spear warrior" (the place, not a religion: "hindu" is not used as a people's name); the tile says just "Spear warrior". Search words: the culture (india, indian, rajasthan, jaipur ...), the race, the role (fighter, armored fighter, warrior, rogue, thief, caster, spellcaster), the kit word, man/woman, "fantasy race". **The house's own first** (`client/figsearch.js`): a figure of a genre set ranks after the house's own figures when every word typed is one the house's figures also answer to ("smith", "6 guards", "rogue", "priest"); a word only the set has ("norse smith", "samurai", "aztec", "viking", "japanese merchant") finds the set's figure first. Without the rule, "smith" placed the Norse smith (its shorter name won the tie). Search words: the culture (japan, japanese, edo, kyoto ...), the role (fighter, armored fighter, rogue, caster, npc), the trade, man/woman. The bar's result row says "Japan · fighter · 5.6 ft tall".
- **The catalog:** each lane's figures are its own pack folder, `experiments/<lane>/set/published/manifest.json` (the 10-06 set's shape; `PACK_GLOB` in `tools/spawn-tuner/build_figures.py`, the cyberpunk lane's), read after the main set (an id already taken stops the build; `--no-packs` builds the main set alone). A culture row also carries `setting`, `kin`, `role` and `tile`, which the build passes through. It also now KEEPS a flying pose whose source folder is gone but whose built files are still in assets/figures/fly/ (rebuilding main after the flying-pose lane's worktree was removed would have dropped all 29).
- **Sensitivity:** a codex read of the whole roster before any plate (2 replaced, 25 changed; the record is roster.py `SENS`), and Gemini's blind reads of the stills at table scale (READS.md in the lab folder). Where a figure leans into fantasy, its row says so (`lean`): the shieldmaiden, the Chinese swordswoman, the Japanese spy, the völva's reconstructed dress, the casters' powers.
- Tests: `engine/test/pawntree_genres.test.mjs` (the genre roots, the label from the types data, one place per figure, root keys, the real catalog), `engine/test/figsearch.test.mjs` part 4 (the culture words; plain trades still find the house's own), `tools/spawn-tuner/test/build_figures_sets.py` (packs and their pass-through fields, a taken id, the kept flying poses).
- **Decided by Fauna, easy to change:** the culture figures are under Regional ONLY (not also under Heroes ▸ class); the human row is the first-written roster (the Rajput warrior, the samurai ...), the six other races wear a race-neutral dress per culture and role with three kits cycled (grid.py), genders alternating (79 women of 175); NPCs are human (four a culture); the rogues hold a short plain blade low (the sensitivity read would have taken it away; a rogue must read as one at table distance); the place, not a religion, names a figure ("Rajasthani", never "Hindu"); culture tiles follow the Build tray's type order (Norse, Mamluk, Rus', Mexica, Japan, China, India).
- **Merging with the cyberpunk pawns:** both lanes add packs the same way (PACK_GLOB) and the same ROOT_KEYS_TAKEN. Since 2026-11-07 (see "One Modern root" below) a figure that carries a setting code of the modern genre (CYB, MOD ...) is a heading INSIDE the one Modern root, after its sections: a genre whose key is a root of the table's own joins that root, so there is never a second "Modern" root.
- **Read blind at table scale** (Gemini; a race's fighter, rogue and caster per picture in a shuffled order, cultures mixed; READS_GRID.md in the lab folder): every role named for 143 of 175 figures (a miss is mostly a rogue or caster read as an NPC); the culture named first in 37 of 56 pictures (41 in either guess). India read "Ottoman" on its fantasy races until its dress was given the Rajasthani turban, flared coat and dyed cloth (then 8/8); Mexica was given ear spools, bold geometric bands and the one-shoulder cloak the same way (then 5 of 6 race rows "Aztec (Mexica)", the sixth "Mixtec"). Rus' reads "Anglo-Norman" and Norse "Anglo-Saxon/Norman" at this size: left as they are (making Rus' louder pulls toward 19th-century folk costume).

## The cyberpunk pack (Harry 2026-11-07, as built)
Harry: "Did we make a pawn pack for shadowrun? Just like decker/street sam/shaman/mage whatever orc / dwarf/troll. Also NPCs for modern. And while we are at it add a robot race." Lab notes: `experiments/2026-11-07-cyberpunk-pawns/LAB_NOTES.md` (roster, sensitivity read, cost, every Gemini read). Generic cyberpunk-fantasy: the figures carry no publisher's names, logos, insignia or text; the game players have in mind and its jargon (shadowrun, shadowrunner, netrunner, ripperdoc, johnson, replicant) are SEARCH words only, in `client/barwords.js` FIGURE_WORDS, as "beholder" is for the eye tyrant.
- **Runners** (group `runner`): nine archetypes, a kit each worn by a spread of metatypes (not the full grid): street samurai, decker, rigger (a small drone on the shoulder), mage, shaman (an urban street shaman: junk charms, a raven, a rebar staff; see the sensitivity read), physical adept, face, technomancer, mercenary. Metatypes (`race`): human, elf, dwarf, ork (tagged ork and orc; the set's orc body, so an ork runner and an orc fighter are one people), troll (Large: a 10-ft base, `size` 2, 8.2-8.5 ft).
- **Modern NPCs** (group `modern`): police, corporate security, tactical (SWAT), executives, gangers, bartender, street food vendor, street doctor, fixer, office worker, commuter, journalist, club bouncer (a troll, Large).
- **Robots** (group `robot`, race `robot`): a people of their own, one look (warm grey steel, orange plates, one magenta visor band): combat robot and war robot (Large; fighter), android infiltrator and stealth robot (rogue), hacker robot and medic robot (caster / support), utility robot, security drone, rotor drone, service android.
- **In Place a pawn** (and Settings ▸ Me ▸ My pawns, the same tree): *Historical (first built 2026-11-07): two roots after Animals, Cyberpunk (Y) ▸ the archetypes and Robots, and Modern (D) ▸ the NPC groups.* Now ONE root, Modern: see the next section. The roots' keys keep off the letters the Pawns menu's home already uses (`ROOT_KEYS_TAKEN` in `client/pawntree.js`: P, O notes, N new pawn, C the whole cast, G save a group, F search, B), which is why Modern is D (M and O were taken).
- **In the bar:** "troll street samurai", "ork rigger" / "orc rigger", "elf mage", "decker", "robot", "android", "cop", "swat", "street doc", "fixer", "shadowrunner". "troll" alone is still the fantasy troll (its own name), the troll runners after it.
- **Where the figures come from:** `tools/spawn-tuner/build_figures.py` now reads figure PACKS besides the default set: every `experiments/*/set/published/manifest.json` (the set's published layout; this pack's is `experiments/2026-11-07-cyberpunk-pawns/set/published/`), from the worktree or else the main checkout; an id in two packs is refused. So a lane adding figures never edits the set's manifest.
- Tests: `engine/test/pawntree.test.mjs` (the tree, the keys, sizes, the bar; in tools/test_matrix.json), `engine/test/browser_pawnsmenu.py` TREE (D ▸ Runners ▸ Street samurai, Robots, Law and security, thumbnails load).

## One Modern root (Harry 2026-11-07, as built)
Harry, the same day: "we basically don't need to distinguish between cyberpunk and modern now". So the Pawns menu's Cyberpunk and Modern roots are one, **Modern (D)**, holding all 53 of the pack's figures (27 runners, 16 modern NPCs, 10 robots), each in exactly one place:
- **Modern ▸ Runners (R)** ▸ the nine archetypes, Street samurai (S), Decker (D), Rigger (R), Mage (M), Shaman (H), Physical adept (Y), Face (F), Technomancer (T), Mercenary (E) ▸ a grid of metatype and sex ("Troll man", a troll's tile marked 2×2). A third level, as in Regional ▸ India ▸ Tiefling.
- **Modern ▸ Law and security (L), Corporate (C), Streets (S)**: the NPCs by where a GM meets them, right in Modern beside Runners (no "NPCs" tile above them: one click fewer to a cop, and each group is already a word a GM looks for). A modern NPC no group claims would get an "Other modern folk" tile; a runner of a new archetype, "Other runners" under Runners.
- **Modern ▸ Robots (O)** ▸ one grid, by their own names (R is Runners').
- **Why nested, not flat:** a flat Modern would be thirteen tiles (nine archetypes, three NPC groups, Robots) with the archetypes and the NPC groups looking like the same kind of thing; five tiles, with the nine player archetypes behind one Runners tile, reads as Harry's "the runners, the NPCs and robots". Monsters (24 tiles) shows a flat root also works, so this is an easy call to reverse: in `PAWN_TREE` give the Runners section `inline: true`.
- **How:** `PAWN_TREE`'s `modern` entry is `by: 'sections'` (new): each section has a root's own shape (`groups`, `by`, `subs`, `gather`, `rest`, `leaf`, `more`), is a tile one level deeper, or with `inline: true` puts its tiles in the root itself. The key stays `modern`, the Build tray's genre key too (types.json): a figure that ever carries a modern `setting` code joins this root as a heading (above). A section's `word` ("Archetype") says what its tiles are, for the chips above the grid; `surfaces/figtree.js` labels the chips by depth (Kind, Family, Race), so until it reads `word` the Decker chip says "Race".
- **Search:** "cyberpunk", "shadowrun", "sprawl", "modern" each find every runner, modern NPC and robot (the figures' tags, `client/barwords.js` FIGURE_WORDS, and `client/figsearch.js` GROUP_WORDS, where each of the three groups answers to cyberpunk, modern and sprawl).
- Tests: `engine/test/pawntree.test.mjs` (no Cyberpunk root; Modern ▸ Runners, the NPC groups, Robots with their keys; the archetypes a level down; a modern setting code joins the one root; the four search words), `engine/test/pawntree_genres.test.mjs` (a genre that is a root of the table joins it; the real catalog has one Modern root), `engine/test/browser_pawnsmenu.py` TREE and MINE.

## The dinosaurs (Harry 2026-11-07, as built)
Harry: "can we flesh out the set of dinosaur tokens? I notice you've got T-Rex and Triceratops, but let's get our top 8 favorites all done. So Ankylosaurus, Spinosaurus, Stegosaurus, Pterodactyl, Brontosaurus, Quetzalcoatlus." Fauna added the **Velociraptor** (the pack hunter a table reaches for most). Nine dinosaurs in all, made in the default set's style and matched to its tyrannosaur and triceratops (moss-green and ochre hides, cream bellies, scaly, no feathers).
- **Sizes** (core/size.js: size = squares a side): Velociraptor medium (5 ft); Pterodactyl large (10 ft); Ankylosaurus, Stegosaurus, Spinosaurus and Quetzalcoatlus huge (15 ft); Brontosaurus gargantuan (20 ft). Each figure is MADE at its size (`size` in figures.json is its native size), so it is drawn at its own height on its own base and Resize scales it from there.
- **The tyrannosaur and triceratops are huge too** (Harry 2026-11-07, as 5e has them; dinohuge lane, `experiments/2026-11-07-dinohuge/`): a 15-ft base, and the whole figure drawn 1.5x (15/10) what it was: 18 ft and 10.5 ft (it was 12 and 7). That is exactly what the game already drew for one a GM had made "huge", and a pawn saved as large (`size: 2` on the pawn) still draws as before (figureK 2/3 of 18 = 12). The resize is in the set's spec (`experiments/2026-10-06-figures/set_more.py` RESIZED, the prompts untouched), re-measured and re-published by the set's own `set_qa.py` / `publish.py` through `experiments/2026-11-07-dinohuge/remeasure.py`.
- **The pterodactyl stands in its flying pose** (Harry 2026-11-07: "The standing [pterodactyl] needs to be thrown away. For now let's just use the flying one as standing."): its row in the pack's manifest takes the flying mesh and frame (`experiments/2026-11-07-dinos/stand_as_fly.py`, run last by the pack's `publish.py`): same id, size (large), tags and search words; 9.2 ft tall, wings spread, its lowest point (tucked feet and belly) on its disc; raised, it wears the same mesh. The figure review page shows the flying mesh and plate (`build_review.py` reads a row's `plate`).
- **Flying:** the Pterodactyl and Quetzalcoatlus have a flying pose (wings spread), worn when the pawn is raised 5 ft or more, exactly as the 29 fliers of 2026-11-06 (see "A flying pawn"). Their poses live in the pack's OWN fly manifest (`experiments/2026-11-07-dinos/set/published/fly/manifest.json`): `build_figures.py` now reads a pack's `fly/manifest.json` besides the fly lane's, so a lane adding fliers never edits that lane's manifest.
- **Pawns menu:** Monsters ▸ **Dinosaurs**, one grid of all nine (the tyrannosaur and triceratops moved there out of Wild beasts; 9 is under GRID_CAP, so no "more…"). The pterosaurs are in it too: a table calls them dinosaurs.
- **Search:** each by its name; "dino", "dinos", "dinosaur", "dinosaurs", "prehistoric" find all nine; "raptor", "6 raptors"; "brontosaurus", "apatosaurus", "brachiosaurus", "diplodocus", "sauropod", "long neck", "longneck"; "pterodactyl", "pteranodon", "pterosaur"; "t-rex", "trex"; "trike", "stego", "anky", "spino", "quetzal" (tags in the pack's manifest, plus `client/barwords.js` FIGURE_WORDS).
- **Where they come from:** `experiments/2026-11-07-dinos/` (LAB_NOTES.md): plates painted by an open-weight image model (Qwen-Image-Edit-2511, Apache-2.0) on a RunPod pod, conditioned on the set's own tyrannosaur or triceratops plate; Gemini gate; BiRefNet matte; TRELLIS.2 on the same pod; the set's QA, tiers and thumbnails.
- Tests: `engine/test/dinos.test.mjs` (the nine are there with files; bases and heights; the pterosaurs' flying poses; the search words; Monsters ▸ Dinosaurs), `tools/spawn-tuner/test/build_figures_sets.py` check 5 (a pack's own fly manifest).
