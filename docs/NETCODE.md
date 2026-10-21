# Turnip Works netcode: design from the first moment

Draft from the Harry–Fauna conversation of 2026-10-02. This is the shape the engine core must have so that multiplayer is never a retrofit.

**Status (2026-10-02, evening):** the first milestone below is built and verified live in `engine/` (see `engine/LAB_NOTES.md`, `engine/COMMANDERS_INTENT.md`). Live at https://implausible.enterprises/projects/turnip-works/engine/. Two departures from this draft:
- Our Cloudflare zone refuses websocket upgrades, so the client falls back to SSE plus ordered POSTs; the protocol is the same.
- The relay keeps **one journal per campaign**, with per-area sequence numbers inside it, so a cross-area transfer is one atomic line on disk.

## Principles (the part that is hard to retrofit)
1. **World state is plain data, separate from the 3D scene.** The scene is a view of the data.
2. **Every change goes through one door,** `dispatch(command)`. No UI handler mutates a mesh or the state directly.
3. **Everything has a stable ID.**
4. **Nothing is global except the campaign.** All world state lives under an area; there is no "the scene" singleton.
5. **Participants are one kind of thing,** human or LLM, each with a seat, role, location, presence and visibility.
6. **Views are first-class:** a view is (area, camera rule). The renderer never assumes one camera or one world.
7. **There is one command protocol.** The LLM GET API is a thin wrapper over the same commands the browser sends.

## Three channels
- **Presence:**
  - cursors (sent as ground points in world space, not screen pixels: `[x, z]`, or `[x, z, y]` when the cursor is on a floor off the ground; a client that sends no height is drawn at 0), camera ghosts, pings, drags in progress;
  - lossy, about 15–20 Hz, interpolated on arrival;
  - only for areas the client is watching.
- **Commands:**
  - semantic intents ("move token X to cell Y", "spawn kitchen at rect R with seed S", "open door D");
  - a relay assigns a per-area sequence number and broadcasts;
  - the sender applies optimistically, and server order wins on conflict (Figma-style, last writer wins per property);
  - GM undo is the inverse command.
- **Snapshots:**
  - periodic state plus the commands since then, used for late join and reconnect;
  - the same thing is the campaign save;
  - the relay persists its log to disk and survives restarts (HEXWAR's lesson: a restart killed live rooms).

## Why not pure lockstep (sending only mouse and clicks)
1. A screen-space click means nothing without the sender's camera and UI state; send intents instead.
2. `Math.sin`/`atan2`/`exp` may differ between JS engines, so lockstep drifts, and physics is worst.
3. Late join would need a replay of the full history; snapshots are needed regardless.
4. Lockstep gives every client the whole world, including fog of war and GM prep. Cheating doesn't matter (it's D&D), but **secrets** do: the relay filters by role.

## Determinism where it pays
- Generated content travels as recipes (type, rect, seed, engine version). The creator also sends the solved layout, or its hash, as a guard against cross-engine drift.
- Purely visual simulation (fire, fog, water, spawn animation) runs locally and never syncs.
- Dice: the result comes from the roller or the server. Real 3D dice (2026-10-19): the ROLLER's client simulates the tumble once (Rapier) and the recording rides the `dice.roll` command as `throw` (Int16 keyframes; since 2026-10-20 ADAPTIVE (v2, with each keyframe's time `t`): every 240 Hz physics step is recorded and only the frames interpolation needs are kept, within 0.015 ft / 2 deg of the true path; 6 dice about 11-17 KB, 10 dice under 35 KB, never over 100 KB (the tolerance loosens to fit); v1 (uniform `hz`) still decodes; never in the chat state or the GET API); every seat plays it back and turns each die's NUMBERING by a symmetry of the die so the top face reads the committed number. The trajectory can never change a number.

## LLM participants (the GET API)
- An LLM is a slow client in the same ordered log.
- Reads return semantic state (IDs and data), not pixels.
- Act with `GET /a/<area>/do?…&seat=<capability token>&based_on=<seq>&nonce=<id>` (the pre-rename `/t/` path still answers for one release):
  - the token scopes it to a seat and an area;
  - the nonce makes retries and prefetches idempotent;
  - `based_on` enables "stale, here's what changed" or apply-anyway, chosen per command.
- A long-poll GET ("changes after seq N") lets it follow along without a socket.
- **Optional visual presence, synthesized by the server:**
  - a ghost cursor glides to what it last read or acted on;
  - a "thinking…" tag shows between read and act;
  - its name tag shows whose agent it is;
  - a seat can be flagged invisible.

### The GET API brought up to date (2026-10-20; experiments/2026-10-20-llm-api/, code relay/llm.js, llm-card.js, things.js)
- **The card is short; the detail is on help pages.** `/c/<c>/card` is about 9k characters for a GM's assistant (was 22.5k), about 7k for a player's advisor: copy-paste addresses for the common tasks (roll, say, add a creature to a room, move, light, open, damage, conditions, hide, rename a room, build, initiative, undo, travel, open an area), one worked example, the AI etiquette, and a list of `/c/<c>/help/<topic>` pages (rooms, things, pawns, light, dice, turns, height, areas, commands). Every line is filtered by what the seat may do; `help/commands` is the generated list of the seat's commands with their arguments (legacy and browser-only arguments left out).
- **Short tokens on the GET API.** The card writes `seat=<seat id>.<22 characters of the HMAC>` into every address instead of the ~200-character token (a small model miscopied the long one in a live trial). It is checked on a `/c/<campaign>/...` GET path only, against that campaign's seat record as it is now (relay/tokens.js `short`, `verifyShort`); a changed scope, another campaign, a revoked seat refuse it as they refuse the full token, and the full token still works everywhere.
- **New reads.** `/a/<area>/scene` (the first read: rooms with label (GM side only) and faction, pawns, `lights` (id, room, lit, kind, radius), `doors` (anything that opens), stairs, the turn order, the area's `rules` (fogOfWar, darkness, light, fog, freeMoves, touch, grid), the last chat lines); `/a/<area>/room/<ROOM_ID>` (everything in one room, each thing with cat, variant, light/lit/radius, open, locked, pinned, tilted, faction); `state` gained the same fields plus `rules`, `templates`, `water`, `walls` (edited wall keys) and each pawn's darkvision / lightCarried / visionRadius. Catalogs: `/c/<c>/things?q=candle` (the library's pieces), `/rooms` (room types by kind), `/factions`, `/conditions`.
- **The relay rolls.** `dice.roll&expr=d20&bonus=3&why=...`: the numbers are drawn on the relay with the browser's own parser (core/dice.js, moved from client/dice.js); an AI seat's own `rolls`/`total` are ignored (said in `note`); a person's seat over GET may still send a table roll. `d20adv`, `"d20 5"` (a URL's `+` arrives as a space) read as meant; a retry with the same nonce answers the same numbers. There is no `throw`: every browser looking at the area throws an AI seat's dice itself (client/surfaces/dice.js "A ROLL WITH NO THROW"), the same numbers for everyone, each seat its own tumble; a person's roll that went out without dice still shows as a plain line.
- **GET-only conveniences** (the same commands, arguments filled in): `token.create&room=ROOM` / `token.move&room=ROOM` (the free square nearest the room's middle), `object.place&cat=PIECE` (mesh and size from the library, in the room it stands in), `object.replace` with no `cat` (replace with similar), `room.reroll` without a layout (the relay solves; `type=` retypes), `area.set&darkness=true` (any play rule by name; `=default` goes back), `faction.set&flavor=Sun` (by name), lists as `a,b,c`, `entity.flag&id=`. Switches must be true/false/1/0/yes/no/on/off: anything else is refused (before, `hidden=hide` read as false and revealed).
- **Permissions, checked on every new route** (engine/test/llm.test.mjs): reads go through the same `entityVisible` + `seesLabels` filter as `state` (a hidden room, its things and its pawns are absent; a player's advisor gets a room's type name, never its label; `room/<hidden room>` answers like a missing room); the conveniences check the room or thing against what the seat may see before using it; every one ends in the ordinary `dispatch`, so classes, scope, the creator's permissions and the area's `touch` / `freeMoves` rules apply unchanged. **Fixed:** a GM assistant's ghost cursor glided into a hidden room when it read or looked there and was shown to the players; it is now the GM side's only there (as the GM's own cursor has been since 2026-10-15).

### Multiple LLM seats, permissioned by their creator (Harry, 2026-10-02)
- A campaign can have **many** LLM seats at once: the GM's assistant, an NPC voice, a player's familiar or advisor.
- **Every LLM seat is created by a human seat and acts with a subset of its creator's permissions, never more.**
  - A GM-created seat can be granted any GM power, scoped per area and per command class (place furniture, move NPCs, reveal rooms, and so on).
  - A player-created seat acts as *that* player: it can move that player's tokens, see what that player sees, and nothing else.
- Visibility filtering applies to LLM seats exactly as to their creator. A player's LLM never sees GM-only areas.
- The capability token encodes (campaign, seat, creator, scope). The relay checks every command against it. The creator, or the GM, can revoke it at any time. Revoking a human seat revokes the LLM seats it created.
- Presence shows whose agent each LLM seat is ("Brakka's advisor", "GM assistant").

## Campaigns, areas and split parties
- A campaign has many areas. Each area has its own ordered log; the thin campaign log carries the roster and locations, chat, handouts, inventory and party resources.
- **Cross-area transfers** (e.g. the bard sends the deed to the castle) are one campaign command applied atomically to both areas.
- **Where is everyone:**
  - a roster strip with a live location per person;
  - click to jump there, or to open it as a PiP;
  - a client subscribes only to areas it is viewing.
- **Per-area visibility** is set by the GM: open or hidden, nothing else (since 2026-10-06; before: open, party-only or GM-only). The relay filters by it.

### Area visibility tiers: SUPERSEDED 2026-10-06 by "Areas: open or hidden" at the end of this file (Harry, 2026-10-02: "reasonable for now ... the main thing is maintaining flexibility")
Basic framework, about 90% of cases. Keep it as data-driven rules, not hard-coded, because players will show us new uses.
- **Everyone**: GM, all players and spectators (showing off, streaming).
- **All players**: GM plus every player in the campaign.
- **Players present**: GM plus players located in the area or owning a token in it (real split-party secrecy).
- **GM only**: prep, ambush rooms, the villain's lair.
- **GM grant**: "let this player see this area" overrides (the wizard's crystal ball).
LLM seats inherit their creator's visibility.

## Picture-in-picture
- The client renders N views into viewports. One renderer with scissor rects, as the review page already does with its three spinning views.
- A same-area PiP shares the loaded world. A PiP of another area loads a second world, with meshes and textures shared via the asset cache.
- PiP views render at reduced resolution and rate, without shadows or post.
- Camera rules:
  - free;
  - pinned;
  - **follow-group:** centroid plus fit-to-bounds of selected tokens, smoothed, widening as they spread;
  - follow-one (a rogue's-eye corner view).
- The GM can swap PiP and main.

## First engine-core milestone (proposed)
- Two browser tabs plus one LLM seat acting through GET, with a gliding ghost cursor.
- Live cursors, token drag, spawn a room by seed, close a tab and rejoin.
- Two areas, with one follow-group PiP of the other area.
- Tested under simulated lag and packet loss from day one.
- A self-hosted relay on the build box, with the log persisted to disk.

## Height and storeys in the commands and the GET API (built 2026-10-05, Stage A of docs/VERTICAL.md)
All heights are in feet. Nothing stores a "floor": a storey is always worked out from a height (`engine/core/height.js`).
- **In the data:** `room.recipe.y` (the room's floor height: a multiple of 5, absent = 0, negative = below ground), `room.recipe.tall` (storeys the room spans, absent = 1), `building.base` and `building.storey` (absent = 0 and 10), and the `y` objects and pawns already had, which is absolute.
- **Commands:** `room.spawn` takes `y` and `tall`; `room.move` takes `dy` (feet); `building.set` takes `base` and `storey` (its `name` is now optional); `token.create` takes `y`; `token.move`'s `y` may be negative.
- **Rules the relay enforces:** two rooms may share x and z when their heights do not overlap; a room above its building's base must stand on rooms whose top is its floor height, overhanging by at most two squares; below ground anything goes.
- **Walls** are worked out one height at a time. A wall key off the ground carries its level: `h:3:4@10`, `c3:4@-10`. Keys at height 0 are unchanged, so every saved campaign loads byte-identical (tested against every campaign on disk).
- **GET `state`:** rooms report `y`, `height`, `storey` (0 = the building's ground floor, -1 = the first below) and `level` ("lv 1" is storey 0, "lv 2" is storey 1, "lv -1" the first below); a new `buildings` list gives each building's `base`, `storeyHeight` and `levels`; pawns report `y`, `storey`, `level` and the `room` they stand in; objects report `y`.
- **GET `look`:** every hit carries `y`, `storey`, `level`; add `y=FEET` to list only that storey.
- **GET `do`:** `room.spawn` with `y=10` builds upstairs, `y=-10` a cellar. A room made over GET joins the building it touches or stands on, or starts a new one (before, such rooms had no building).
- **`changes`:** entries are the commands themselves, so their `y` and `dy` are feet as sent.
- **Hidden floors:** a hidden upper or lower room, its things and its wall edits are filtered by the relay exactly like any hidden room. A wall edit made on a hidden room's own wall is hidden with it. A player's AI seat works out "which room is this pawn in" only from the rooms it may see.
- **The rules card** has a "HEIGHT AND STOREYS" FAQ.

See also docs/PRODUCT_DIRECTIONS.md (GET-only LLM API, free moves with GM undo).

## Stairs in the commands and the GET API (built 2026-10-05, Stage D of docs/VERTICAL.md)
- **A stair is an object:** `object.place` with `place=stair`, `rise` (feet; a multiple of 5, 10 = one storey), `x`, `z` (the middle of its squares), `rot` (0 climbs toward +z; quarter turns), `dims=[width, rise, run]`, `room` = the LOWER room. Nothing else is stored: its squares, the hole in the floor above and its two ends are worked out (`engine/core/stairs.js`).
- **`room.spawn` off the ground floor adds one** when the relay furnishes the room (a seat that sends no layout): the answer carries `stair` (its id), or `stairNote` when no spot was free. `stair=0` asks for none. It is a second command by the same seat, so that seat's first undo removes just the stair. A browser sends its own, the same way.
- **`state` lists `stairs`:** `id`, `kind`, `rise`, `from` and `to` (room ids; `to` is null for open ground), `fromLevel`, `toLevel`, `cells` (its squares, feet), `bottom` and `top` (`[x, z, y]`: where a pawn stands at each end).
- **A pawn across a stair:** `token.move&id=TOKEN&stair=STAIR_ID` puts it at the stair's other end (`to=top` or `to=bottom` chooses). Or `token.move` with `y`.
- **Hidden:** `entity.flag` on a room hides the stairs that touch it, up and down; a stair is shown again only when neither room it joins is hidden. `object.place` of a stair up to, or out of, a hidden room makes it hidden.
- **`room.reroll`** leaves stairs alone.
- **Railings and supports (2026-10-06).** Each stair in `state` carries `railing`: the 5-ft sections round its hole upstairs, as `{ key, x, z }`. They, and the brackets and posts under an overhanging upper room, are generated (never entities) and each has a key: `rh:x:z@y` / `rv:x:z@y` a railing section, `jh:…` / `jv:…` a bracket, `p<x>:<z>@y` a post. `edge.set&key=KEY&as=open` removes one piece; `edge.reset&key=KEY` brings it back. A tall room's upper wall pieces answer to the plain wall keys at their own height (`h:3:4@10`).

## Roofs in the commands and the GET API (built 2026-10-05, Stage F of docs/VERTICAL.md)
A roof is never an entity: every client works it out from the rooms. Only its style travels.
- **In the data:** `building.roof` (a style; absent = by the building's walls) and `room.roof` = `{ style?, seed?, off? }` (absent = the building's style, the room's own seed, a roof). Styles: `thatch`, `tile`, `slate`, `shingle`, `flat`.
- **Commands:** `building.set` takes `roof` (a style, or `auto`); `room.set` takes `roof` (an object; `style: "auto"`, `seed: 0` and `off: false` go back to the defaults, and a room with no choices carries no field). Bad values are refused with the list of styles.
- **Label-blind seats** receive a building's roof style; they still never receive its name.
- **GET `state`:** each room above ground and indoors reports `roof: { style }` (plus `own: true` when the style is the room's own, `off: true` when it has none); each building reports `roof` (a style, or `auto`). Outdoor rooms and rooms below ground report none.
- **GET `do`:** `building.set&id=BUILDING&roof=slate`; `room.set&id=ROOM&roof={"style":"tile"}`; `{"seed":7}` re-rolls the dormers; `{"off":true}` removes the roof.
- **Whether roofs are DRAWN is not in the data.** It is each seat's own view switch, like the cut.

## Pawns: damage, indicators, the sheet link and notes (built 2026-10-06; docs/UI.md "Pawn ring")
- **A pawn counts damage, not hit points** (Harry 2026-10-06: "instead it's 'damage'. That means 0 is always healthy"). In the data a pawn (`token`) carries `damage`: an integer counted up from 0. The field is absent at 0. **`hp` and `hpMax` are gone** from the data, from `state`, and from every command a live seat may send.
- It may also carry `sheet` (its character-sheet link: http or https only), `notes` (shared text), `gmNotes` (the GM side's text), `mark` (one of `star`, `circle`, `diamond`, `triangle`, `moon`, `square`, `cross`, `skull`), beside `conditions` and `owner`. Absent = none.
- **`token.damage { id, damage }`**: any seat with the `pawn` class may set the damage of any pawn it can see (no owner check; 0 to 9999). It is the new total, not a change: a pawn at 12 that takes 7 is `damage=19`.
- **`token.mark { id, mark }`**: any such seat may set an indicator on any pawn; an empty `mark` clears it.
- **`token.set`** (the owner or the GM) takes `name`, `conditions`, `rot`, `color`, `sheet`, `notes` (4,000 characters at most) and `gmNotes` (GM side only); an empty string removes a sheet link or a note. **`token.owner { id, owner }`** (GM): give a pawn to a person, or to no one with an empty `owner`. **`token.create`** takes `damage`, `conditions` and the same extras.
- **Renamed for seats that send commands:** `token.set` with `hp` or `hpMax`, and `token.create` with them, are refused with "pawns count damage now, up from 0 (0 = unhurt): send token.damage, not hp". (The two arguments stay in the argument lists only so an old journal replays; see below.)

### The pawn lock is dropped (2026-10-11)
- **A pawn is never locked.** `entity.flag { ids, locked }` skips pawns: sent for pawns alone (and nothing else to set) it is refused with "pawns cannot be locked (the pawn lock was dropped: a pawn always moves for its owner and the GM)"; in a mixed list the things lock and the pawns do not. Things, rooms, buildings and water keep `locked` exactly as before. The campaign default `travelLocked` (the GM's lock on travel between areas) and the area setting `freeMoves` are other things, and unchanged.
- **Nothing reads a pawn's `locked` any more:** `token.move` (it refused the owner, not the GM) and `travel` (it refused a player) no longer look at it. The client had a third behaviour (a locked pawn did not move for the GM either); that is gone too.
- **The field stays on a pawn, always `false`,** so no saved campaign changes shape.
- **Old data.** A pawn saved locked loads unlocked. The same pass that converts hit points (`migratePawns`, below) reads `locked: true` on a pawn as `false`: in every area, and in every stored undo and redo step, so an undo kept from that time cannot put the lock back. The reducers that replay a stored step (`entities.set`, `transfer.in`) unlock a pawn as well (`unlockPawn` in `core/commands.js`), so a journal replays to the same result. A new snapshot is written when anything changed; the journal is not rewritten.
- **Checked** (`engine/test/migrate.test.mjs`, `core.test.mjs`): a hand-written campaign whose journal locks a pawn, and a snapshot that holds it locked in the state, the undo stack and the redo stack; and the frozen corpus of 266 real campaigns, read by the code as it stood before the cut (main at `51d6988`, from git) and by the code now. In the corpus 30 campaigns ever wrote `"locked": true` (60 lock commands, on things and pawns); **no pawn is locked in play in any of them; 2 campaigns hold a pawn locked in a stored undo or redo step (2 steps).** Today's code reads 0 and 0, those two steps applied now leave the pawn unlocked, and apart from pawn locks all 30 load byte-identical before and after.

### Old data: hit points become damage
- **The rule:** damage = `hpMax` − `hp` where a pawn had both (never below 0); 0 where it had only one of them or neither (most pawns: `hp` was null). The `hp` and `hpMax` fields are removed. Everything else on the pawn is kept.
- **When:** each time the relay loads a campaign (`CampaignRuntime.load`). It reads the snapshot and replays the journal exactly as they were written (the reducers still understand the old arguments), then converts what it has in memory in one pass (`migratePawns` in `core/migrate.js`): every pawn in every area, every stored undo and redo step, and the log tail. If anything changed it writes a new snapshot at once.
- **On disk:** no file is rewritten in place and no copy is made. `snapshot.json` is replaced by the new snapshot through the usual temp-file-and-rename; `journal.jsonl` keeps its old lines, which sit behind the snapshot and are never replayed again.
- **Idempotent:** a pawn with neither old field is left as it is, so loading again converts nothing.
- **An undo recorded before the change still works:** its stored "put the pawn back as it was" is converted too, so it restores the pawn's damage as of then.
- **Checked** (`engine/test/migrate.test.mjs`): a hand-written old campaign (hit points set at creation, by the old HP buttons, in a batch, with an undo); and every real campaign under `engine/data`, where each pawn's damage is worked out independently from what the code of before storeys reads and compared with what today's code loads (201 pawns on 2026-10-06, 24 of them hurt).
- **Not converted:** nothing derived from hit points existed in the data. The client's coloured bar over a pawn (green, amber, red by share of the maximum) was drawn from them and is gone.

### GM notes, the undo, AI seats
- **GM notes are never sent to the player side.** `gmNotes` is taken out of snapshots, log entries (the command, a batch, an undo's `entities.set`, a reveal's projection, a transfer) and the GET API for every seat that is not on the GM side (`unnote*` in `core/labels.js`, called from `entryFor` and the snapshot in `relay/campaign.js`). A change that was only the GM's note reaches a player as an empty step, so the sequence numbers still line up.
- **Undo:** the GM side may undo anyone's action, as before. One addition: a pawn's **owner** may undo a damage change made to that pawn by another seat, when it names the change by `seq` (`undo { who, seq }`). The rule is `seesDamageUndo` in `core/pawn.js`; an entry that changed several pawns' damage needs every one of them to be the asker's.
- **Fixed on the way:** the "what changed" list a stale GET command is answered with was the raw log entries; it now goes through the same per-seat filter as everything else (hidden things, labels, GM notes).
- **AI seats (the GET API speaks damage):**
  - `state` lists each pawn's `damage` (0 = unhurt), and its `conditions` and `mark` when it has any. It never listed `hp`, so no field was renamed there; `damage`, `conditions` and `mark` are new.
  - `do?cmd=token.damage&id=TOKEN&damage=19` and `do?cmd=token.mark&id=TOKEN&mark=skull` work for a seat whose scope includes the `pawn` class; the rules card says so, and that damage counts up from 0.

## Figures on pawns in the commands and the GET API (built 2026-10-06)
A pawn can wear a figure from the figure library (`tools/spawn-tuner/data/figures.json`; docs/UI.md "Figures as pawns").
- **In the data:** `token.fig` (a figure id such as `foe-owlbear`; absent = the plain stand-in) and `token.size` (squares a side its base covers; absent = 1, a large creature 2). Nothing else is stored: scale, base and facing mark are worked out by each client from the list. Campaigns saved before this load unchanged.
- **Commands:** `token.create` takes `fig` and `size`; `token.set` takes `fig` (`none` = back to the stand-in) and `size`. The core checks their shape only. A player may change the figure of her own pawn.
- **GET `figures`:** `/c/<campaign>/figures?q=owlbear` searches the list (name, id, group, class, race, tags, SRD monster names; `q=elf+wizard`, `q=townsfolk`); each hit gives `id`, `name`, `group`, `height_ft`, `squares`. With no `q`: how many there are, by group, and a dozen examples.
- **GET `do`:** `token.create&fig=FIGURE_ID&x=…&z=…` (`name` optional: the figure's name is used). The relay checks the id against the list, fills in the size, and refuses an unknown id with the nearest ids and how to search. A one-square pawn stands on a square's centre (2.5, 7.5 …), a large one where four squares meet (5, 10 …). `token.set&id=TOKEN&fig=OTHER` changes it.
- **GET `state`:** each pawn reports `figure` when it wears one, and `squares` when it is large.
- **The rules card** has a "How do I put a creature or a character on the table?" entry for seats that may create pawns.
- Code: `engine/relay/figures.js`, `engine/relay/llm.js`. Test: `engine/test/browser_figs.py`, section AI.
- **A player's main pawn (2026-10-06):** `token.main` (true, or absent). `token.set&id=TOKEN&main=true` marks it (its owner or the GM); the seat's other main pawn in the area is unmarked in the same command. `token.create` takes `main` too. `state` reports `main: true`. Clients draw a main pawn with the figure's original mesh (the list's `full`); nothing else changes.
## Areas: open or hidden, and travel (built 2026-10-06; rules in docs/PAWNS.md)
- **In the data:** `area.visibility` is `open` or `hidden`. Values stored before 2026-10-06 (`party`, `gm`) read as
  hidden; `area.grants` is still stored where it was, and opens nothing. The campaign default `travelLocked` (bool).
- **The one filter** is `canSee` (`engine/core/perms.js`): the GM side sees every area, any other seat an area exactly
  when it is open; an AI seat sees what its creator sees, within its scope. Everything a seat receives or may do
  passes it: the campaign view's area list and seat locations, subscriptions (`sub` answers `{t:'hidden', area}` for a
  hidden area and for one that does not exist), log entries, presence, pings, ghosts, pictures, and every GET.
- **Commands:** `area.create` (the relay decides: first area open, later ones hidden); `area.visibility` (`open` |
  `hidden`); `travel` (`id`, `from`, `to`; the relay adds `x`, `z`, `y` and `opens`); `campaign.set` with
  `defaults: { travelLocked }`. A refused command on a hidden area answers `invisible`, "no such area visible to you",
  the same as a missing area.
- **`travel`'s answer:** `result: { to, x, z, y, opened, seq }` (`seq`: its number in the log of the area it left, for an
  undo by number).
- **In the log** a travel is `transfer.out` on the area left and `transfer.in` on the area entered, one batch. A seat
  that cannot see the other area gets them without `to` / `from`.
- **GET:** `…/c/<id>/do?cmd=travel&id=TOKEN&from=AREA&to=AREA&nonce=…`; `…/do?cmd=area.visibility&area=AREA&visibility=open`.
  `state` reports each area's `visibility` as `open` or `hidden`. The rules card lists both commands for seats that hold
  them and marks hidden areas for the GM side.
- Tests: `engine/test/areas.test.mjs`.


## The party, a player's pawns, the cast, whispers (built 2026-10-06; rules in docs/PAWNS.md "The Pawns menu, as built")
Code: `engine/core/party.js`, the block "the party, a player's pawns, the GM's cast" in `core/commands.js`, `relay/campaign.js` (`whisper`, the party signature in `afterCommit`). Test: `engine/test/party.test.mjs`.
- **Campaign state:** `pawns { id: { id, owner, name, fig?, size?, sheet?, notes?, petOf?, main? } }` (a player's defined pawns: the bench), `cast { id: { id, kind: 'one' | 'group', name, at, fig?, size?, sheet?, notes?, gmNotes?, members?: [{ name, fig?, size?, dx, dz }] } }` (the GM's), `party { notes, order: [seat] }`. A pawn on a table placed from a definition carries `def`; a lent pawn carries `lender`.
- **Campaign commands:** `pawn.define` and `pawn.forget` (class `pawn`: a player her own, the GM anyone's; `fill` sets the owner and cleans the sheet link), `cast.save` / `cast.use` / `cast.forget` (GM side only: `forbidden` otherwise), `party.set { notes?, order? }` (class `chat`: every seat).
- **Area commands:** `pawn.bring { id, def, x, z, y?, rot? }` (class `pawn`; the relay's `fill` writes name, owner, figure, sheet, notes and main FROM THE DEFINITION, whatever was sent; refused when that definition already has a pawn on any table), `pawn.bench { id }` (the pawn leaves the table; its owner, its lender or the GM), `token.lend { id, to }` (the owner, or the lender taking it back; `to: ''` = no one, the GM side moves it). `token.create` takes `def` (a cast entry's id). The GM's `token.owner` ends a loan.
- **What each seat is sent** (in its campaign view, `projectCampaign`): `party { notes, order, pawns }` where `pawns` is every OWNED pawn in the areas that seat can see (id, area, owner, name, figure, main, damage, conditions, mark, sheet, def, lender; never notes or GM notes; a pawn hidden from players, or in a hidden area, is absent for a player); `pawns`: its own definitions, each with `at` (the area its pawn is in, when the seat can see it) or `away`; the GM side gets everyone's; `cast`: the GM side only (the key is absent for a player).
- **Fresh campaign views after area commands:** when a commit changes what the party rows show (a pawn's damage, conditions, owner, figure, a pawn arriving or leaving, hidden or revealed), every connection gets a new `camp` view about 60 ms later, once for a burst. A plain `token.move` sends none.
- **Whispers are not commands.** `whisper { id, to, text }` on the socket; the relay sends `whisper { id, from, to, text, at }` to the connections of `to` and to the sender's other connections, and `whispered { id, ok, delivered, why? }` back to the sender. Nothing is journaled or kept, so there is nothing to filter out of logs, snapshots, undo or GET reads. People only (an AI seat neither sends nor receives one yet). 1 to 500 characters; 20 in 10 seconds per connection.
- **AI seats:** the GM's agents read `cast` in `state`; a player's agents read that player's `pawns`. `pawn.bring`, `pawn.bench`, `party.set` work through `do` like any command.

## Deleting a campaign, and the copy before a restart (2026-10-06)
- **`POST /c/<campaign>/delete?seat=TOKEN`**: only the campaign's GM, and only a person (never an AI seat, not even the GM's own). The campaign leaves the relay at once: its connections get `{ t: 'denied', why: 'this campaign was deleted' }` and are closed, its tokens open nothing. Its folder is moved to `data/removed-YYYY-MM-DD/<campaign>` with a last snapshot; putting the folder back and restarting the relay restores it. `&purge=1` removes the files instead (tests). Answer: `{ ok, campaign, name, purged, kept? }`.
- **Tests** delete what they make: `tests/tw_sandbox.py` `remove_campaigns()`; leftovers by name: `node engine/tools/remove_throwaways.mjs` (a dry run without `--go`).
- **Every relay restart by a deploy script is preceded by a copy** of `engine/data` (`engine/tools/backup_data.sh`): `/mnt/usb/turnip-works/relay-data-backups/data-<stamp>-<label>.tar.zst`, the last 30. No good copy, no restart.
- **Shutdown** saves each campaign on its own: one that cannot be saved is logged and skipped.

## Turn order and initiative (built 2026-10-06; docs/PAWNS.md, docs/UI.md)
- **In the data:** `area.turns = { order: [key], at: key | null, round, init: { key: number } }`, beside `chat`; absent = none. A key is a pawn id, or `kind:<name>` (every un-owned pawn of that kind as one entry; `pawnKind` in core/pawn.js). A pawn carries `initBonus` (integer, -99 to 99; absent = not set). Rules: `core/turns.js`.
- **Commands (area level, class `turn`, which every seat holds):** `turn.start { order? }`, `turn.end`, `turn.prev`, `turn.order { order }`, `turn.at { key }` are the GM side's; `turn.next` is the GM side's and the owner's of the pawn whose turn it is; `turn.init { key, n }` (`n: null` clears) is the GM side's for any entry and a player's for her own pawn's id. `token.set` takes `initBonus` (`null` or an empty value clears), `token.create` takes it too.
- **Player seats never receive a turn.* command as sent.** `entryFor` gives them `turn.view { turns }` in its place: the order as they may see it now (`forPlayers`: no entry whose pawns are all hidden; the marker never on such an entry). The area snapshot carries the same. When something that is not a turn command changes what players may see of the order (a pawn in it hidden, revealed, renamed, deleted), they are sent `{ t: 'turns', area, turns }` on its own (`sendPlayerTurns`), also after a catch-up.
- **A player asking about a hidden pawn's entry** gets the answer a missing pawn gets, word for word.
- **Undo:** `turn.start`, `turn.end`, `turn.order` put the whole order back (`turn.view`); `turn.init` goes back to the number before; `turn.next`, `turn.prev`, `turn.at` leave no undo step.
- **GET `state`:** `turns: { round, current, started, order: [{ key, name, pawns, initiative, bonus, current?, yours?, notInOrder?, hidden? }] }` while there is an order (filtered for the player side).
- **GET `do`:** `turn.roll&id=TOKEN` (or `&key=KEY`): the RELAY rolls d20, adds the entry's bonus, sets the number and posts the roll line (none when every pawn of the entry is hidden); `&n=17` takes a number rolled at the table instead. The other turn commands work as written (`turn.next`, `turn.init&key=…&n=…`, `turn.order&order=["tok_…","kind:goblin"]`). The rules card has a paragraph for seats that hold the class.
- **Pawn X-ray is not in the data or the protocol at all:** it is one seat's view switch (docs/UI.md).
- **Default campaign names** now use the shared BIP-39 generator, "The <Word> <Word> Campaign" (Task E, 2026-10-13), in both the start form and relay fallback. This supersedes the earlier "My Campaign" / "Untitled campaign" defaults.

## Orientation: a thing rolled any way up (built 2026-10-12; docs/UI.md "Roll is about the VIEW")
- **In the data:** an object may carry `quat`: a unit quaternion `[x, y, z, w]` (w ≥ 0, 5 decimal places), the thing's orientation in its own turned frame. What is drawn is `Ry(rot) · Q(quat)`: `rot` (the Turn, about the world's vertical) is unchanged and applied on top. **Absent = upright**: an upright thing has no field, standing a thing up removes it, campaigns from before load byte-identical. The arithmetic is `engine/core/orient.js` (no three.js: the relay, the tests and the client share it).
- **A roll** by angle `a` about a WORLD axis `n` is `quat' = Rot(Ry(-rot) · n, a) · quat` (`rollQuat`). The axis is the sender's business (the client takes it from its camera); only the resulting `quat` travels, so every seat and the relay agree whatever their views.
- **Commands:** `object.set { id, quat }` (the identity `[0, 0, 0, 1]` removes the field; refused for a stair, a ladder, a floor tile or a wall piece); `object.place` takes `quat`. Everything that kept `tiltZ` keeps `quat` (move, replace, flags, room move / re-roll of pinned things / turn, copy, paste, pasted rooms, undo). A roll that changes the Turn too (rolls that add up to a plain turn) is `object.set` + `object.move` in one batch.
- **The old field, `tiltZ` (2026-10-11 only):** still TAKEN as an argument by `object.set` and `object.place` (an old client before its reload, an AI seat, a journal line, a clip copied yesterday) and stored as the quat it means, `[0, 0, sin(t/2), cos(t/2)]`. Saved things are converted when a campaign loads (`migrateTilts` in `core/migrate.js`, beside the pawn and stair conversions: the live state, stored undo and redo entities, the log tail; a fresh snapshot is written; idempotent). A client reads either (`quatOfEntity`).
- **Presence:** a drag in progress may carry `quat` (four finite numbers; the identity for "upright now").
- **GET `state`:** a rolled object reports `quat`; an upright one has no such key (`tiltDeg` of 2026-10-11 is gone). **GET `do`:** `object.set&id=OBJECT&quat=[0,0,0.70711,0.70711]`; `&tiltZ=1.5708` still works.
- Tests: `engine/test/core.test.mjs` (the orientation block: two rolls from views a quarter turn apart reach the asserted matrix, which no single roll and no rot + tiltZ pair can; migration), `engine/test/relay.test.mjs` (a save with tiltZ loads converted, a second seat, undo), `engine/test/browser_tilt.py` VIEW.

## Tilt: a thing tipped onto its side (built 2026-10-11; SUPERSEDED 2026-10-12 by "Orientation" above)
- **In the data:** an object may carry `tiltZ`: radians about its OWN front-to-back horizontal axis (its local z), applied after `rot`. Within a half turn either way, rounded to 0.0001. **Absent = upright**: nothing is written on an upright thing, so every campaign saved before this loads byte-identical, and standing a thing up again leaves the same data as never tilting it. Named for the axis, not for the button ("Roll"); unrelated to `yaw` (a mesh's alignment correction). Pawns, rooms, stairs, floor tiles and wall pieces have none.
- **Commands:** `object.set { id, tiltZ }` sets it (0 removes the field; a stair, tile or wall piece is refused: "cannot be tilted"). `object.place` takes `tiltZ` (so a duplicate, a paste and a pasted room's `layout.objects` carry it). `object.move`, `object.replace`, `entity.flag`, `room.move`, `room.reroll` (pinned things) and a room's turn leave it as it is. Undo is the usual one (the entity as it was).
- **`y` is not touched by a tilt.** It stays the height of what the thing rests on. Each client works out the drawn lift itself (it turns the mesh about the middle of its box, then puts its lowest vertex where the lowest vertex was upright: `seatTilt` in `engine/client/world.js`). Nothing about that travels.
- **Presence:** a drag in progress may carry `tiltZ` beside `x`, `z`, `rot`, `y` (the relay passes a finite one through), so other seats see the thing tip before the command arrives.
- **GET `state`:** a tilted object reports `tiltDeg` (whole degrees); an upright one has no such key. **GET `do`:** `object.set&id=OBJECT&tiltZ=1.5708` (radians).
- **The relay must be the new one** for a client to tilt: an old relay drops the unknown argument.
- Tests: `engine/test/core.test.mjs` (the tilt block), `engine/test/relay.test.mjs` (sync, presence, undo, re-roll, storey move, GET, save and reload, a save without the field), `engine/test/browser_tilt.py`.

## Rulers and templates (built 2026-10-12; rules in docs/RULERS.md)
- **Presence** may carry `ruler: { k, a: [x, z, y], b: [x, z, y], ap?, bp?, w? }` beside `cursor`, `drag` and `sel`:
  `k` is `rule` (a ruler), `move` (the line a dragged pawn has travelled) or a shape (`line`, `cone`, `circle`,
  `sphere`, `cube`: a template not yet kept); `ap` / `bp` are the pawns its ends are on. The relay passes exactly that
  shape (`cleanRuler`, core/measure.js) and never stores it. One that touches a hidden pawn, or has an end in a hidden
  room, goes to the GM side only (a player gets the same message without it). **The relay must be the new one** for
  other seats to see a ruler: an old relay drops the field.
- **A kept template is an entity**: `{ id: tpl_…, kind: 'template', shape, x, z, y, dir, size, width?, owner, rounds?,
  left?, attach?, src?, name?, hidden, locked }`. Area commands, class `template` (every seat):
  `template.place { id, shape, x, z, y?, dir?, size, width?, rounds?, attach?, src?, name?, hidden? }` (the owner is the
  sender); `template.set { id, … , attach: '' lets go, rounds: 0 = none }` and `template.delete { id }` (its owner, or
  the GM side); `template.clear {}` (GM side). Undo is the usual one.
- **Hidden:** only the GM side may send `hidden`. A GM-side template riding a hidden pawn or standing in a hidden room
  is REFUSED unless it is hidden. `entity.flag` on a room or a pawn carries the templates in it, or attached to it.
  Player seats then get nothing of it, by the same filter as any hidden entity.
- **Rounds:** a template with `rounds` has its id as a key in `area.turns.order` (`isTurnKey` accepts `tpl_…`).
  `turn.next` / `turn.prev` change `left` on the templates the marker passes, and `turn.next` deletes one that was at
  0 (core/turns.js `advance`); both now declare those templates in `touches`. A player seat still never receives a
  `turn.*` command: its `turn.view` carries `set { id: template | null }` with what changed, as it may see it.
- **Campaign defaults:** `distance` (`true` | `five` | `alt`), read by every client's readout; `units` is honoured by
  rulers and templates.
- **GET:** the commands work through `do` like any other (`do?cmd=template.place&id=tpl_…&shape=circle&x=…&z=…&size=20`).
  `state` does not list templates yet.
- Tests: `engine/test/rulers.test.mjs` (112).

## Faction inheritance (2026-10-13)

`faction.set {id, flavor}` is a GM room-class command for buildings, rooms and faction pieces; `inherit` removes the explicit value. Buildings store `flavor` and mirror it in their generator's `gen.flavor`; rooms use `recipe.flavor`; objects use `flavor`. Client previews carry asset swaps, but the relay recomputes those swaps from its own library and current state (including sequential operations inside a batch). The command is logged, synchronized and inverted as one operation. It preserves transforms, pins, object IDs and overrides; it does not rerun layout. Missing slots keep their entities under `factionMissing`, suppressed on both GM and player views, and preserve prior hidden state under `factionWasHidden` for restoration. Deleted objects remain absent. New generated slot rolls use one effective room faction; choices and missing-slot state persist in campaign snapshots and copies.
## Room hiding carries pawns (2026-10-13)

`entity.flag { ids: [room-or-building], hidden }` now changes the room(s), their existing furniture cascade, and pawns standing inside in **one log entry and one undo**. Room membership uses `tokenFloor` (footprint and storey height, excluding a flyer above the roof). An initially visible pawn hidden by that command gets `hiddenByRoom: roomId`; revealing that room clears the flag and provenance only for those pawns. Independently hidden pawns stay hidden. Explicit pawn hide/reveal takes over from room provenance. A pawn moved out stays hidden and loses the room link, so revealing the old room does not expose it. The field is ordinary persisted entity data and is included in command inverses; save/reload and undo preserve the distinction.

`HIDE_ROOM_HIDES_PLAYER_PAWNS = false` in `core/commands.js` exempts player-owned pawns (all of them, not only the main pawn); GM-owned and unowned pawns are included. `roomPlayerPawns(area, ids, seats)` supplies the client's exception note using the same membership rule. The relay resolves the owner roles into a private `_roomPlayerOwners` command argument before logging, including batch operations; client-supplied values are discarded by argument parsing and the field is stripped from player entries. This keeps reducers/replay deterministic without treating GM-owned pawns as player pawns.

Create, bench bring, drop/move, and cross-area transfer/travel into a hidden room arrive hidden in the same command, with the same ownership exception. Batch bench bring resolves its definition on the relay too. Transfer undo/redo restores the prior hiding state. Drag presence directed into a hidden room is withheld from players before the drop; an attached template is hidden atomically if a pawn's drop hides it. Existing relay projections withhold the entire hidden pawn, including ids/names, from snapshots, command entries and party views; a previously visible pawn generates only its removal. Coverage: `core.test.mjs` room pawn hiding block; `relay.test.mjs` room pawn cascade block captures the raw second-seat WebSocket and verifies atomic arrivals, undo, disk save and reload.

The template Keep bar also sends optional `keepSession` on `template.place`/`template.set`. This is command/undo metadata, never an entity property. Successive settings from the same seat, template and gesture coalesce into its creation undo while it remains that seat's undo head, no intervening edit touches the template, and updates remain within 10 seconds. Snapshot/journal replay retains the group. The client dismisses the bar after 8 seconds idle (see `docs/RULERS.md`).

Player portraits use `party.portraits: { seatId: figureId }` in each campaign projection. A visible placed main pawn supplies its figure; a benched main definition supplies only its figure id, never its definition, name, token id or location. A placed main pawn hidden from that viewer cannot leak its figure through the definition fallback. Party-view updates refresh portraits after main-pawn/figure changes. `party.test.mjs` covers both projection and filtering.


## Browser seat continuity and unnamed campaigns (2026-10-13, Task E)

The client stores successful seats in localStorage `tw.games`: an array of
`{ campaign, token, name, seat, role, lastUsed }` (campaign ID/name, seat token/name, role, epoch milliseconds).
Tokens are credentials: never cookies, telemetry, logs or rendered game-list markup. Read/write/remove are guarded;
missing, blocked or corrupt storage acts as an empty list. Each join updates recency, including reconnects; campaign
updates refresh labels only for still-remembered entries. Distinct seats in the same campaign remain distinct entries.
No new relay endpoint or wire message: `welcome` authenticates and records the seat, and `denied` removes a remembered
seat and returns to the start form with a plain sentence. Network trouble alone never removes a seat.

Without `#s`, the newest seat is written into the address and joined normally. Explicit `#s` always wins; `#games`
opens the list/start form without resuming. Switching seats creates a fresh page/client. Forget clears only `tw.games`;
passive campaign updates from another tab cannot recreate it (a subsequent successful join can).
`POST /campaigns` now uses the shared `core/campaign-names.js` BIP-39 title generator when the supplied name is omitted,
empty or whitespace; supplied names, seat issuance, permissions and invite-link transport remain unchanged.

### Command-bar multi-pick (2026-10-13)
The client expands picked figure/object rows, including counts, into one existing `batch` of `token.create`, `object.place` and any required existing tile/edge operations. Mixed kinds share one undo and ordinary seat projection. Selection and last-list memory are client-only, cleared on page reload; neither adds a protocol or persistence field.


## Client vision and durable explored masks (Task G, 2026-10-13)

Fog of war is client presentation over the world a seat already receives. GM-secret room/area/pawn withholding remains unchanged. A fresh client receives a snapshot, not campaign-long history: the coordinator corrected the original replay brief on 2026-10-13. There is no new history stream and no server line-of-sight calculation. `engine/client/vision.js` computes floor-plan polygons; `fog-worker.js` rasterizes current sight off the animation frame; `fog.js` integrates per-seat visibility, culling, settings and submission.

An area's `fog` stores an epoch, `viewers` keyed by player principal, `party`, and GM `revealed` levels. Each level stores integer z rows of sorted inclusive x runs on a **1.25-ft grid** (four subcells per 5-ft square): finer than movement squares so diagonal/doorway memory remains useful, while long rows compress to two integers. Current presentation uses a finer temporary raster; only explored rows persist. This survives reconnect and relay restart and reproduces deterministically from the ordinary state journal.

A player client sends changed `fog.explore {epoch, levels, partyLevels?}` at most once per two seconds per watched area. The relay derives the player principal from the authenticated sender; a client cannot name another seat's record. Own vision joins that player's record and the party union; with shared vision on, clients may also contribute party vision. Union is idempotent, allowing duplicate tabs and shared writers without election races. Quiet exploration is not an undo step and does not clear redo. Player snapshots and fog journal projections contain only their own record, universal revealed memory, and the party record while sharing is on. Shared toggles reproject subscribed snapshots. The GM receives all records.

`fog.reset` clears every area's records atomically, including hidden areas, with one undo anchored in the current area. Epochs advance on reset/undo/redo; stale in-flight exploration cannot resurrect cleared cells. Undo unions saved memory with any subsequent exploration. `fog.reveal` unions selected-room cells into the universal revealed layer (also available to future seats); undo restores that layer without erasing later personal exploration. No reveal operation changes current vision or deliberate GM hiding. Per-pawn `visionRadius` is an optional feet field, absent/null means unlimited; eye height is deferred (darkvision and lights: "Darkness", below).

**Per-area fog of war (2026-10-15).** `fogOfWar` moved from `CAMPAIGN_KEYS` to `RULE_KEYS` (`core/state.js`): `area.set { settings: { fogOfWar: true|false|null } }` overrides the campaign default (`campaign.set { defaults: { fogOfWar } }`; built-in off for old campaigns, genesis writes on for new ones); `null` inherits. The value is read in `areaRules(state, area).fogOfWar` and by the client per area (`client/fog.js enabledFor(area)`); the relay has no vision logic, so its only part is carrying the value in `projectCampaign` area settings to every seat. Turning an area's fog off touches neither `area.fog` nor its epoch: explored memory is kept and returns with the switch. `sharedPartyVision` stays campaign-wide. **Presence through fog:** cursors, pings and rulers are redrawn over the fog pass client-side (`fogwar.js` overlays); the relay is unchanged. The GM's live cursor/ruler are dropped client-side over ground the viewer cannot currently see unless `GM_CURSOR_THROUGH_FOG` (`core/fog.js`); a GM ping always shows. Tests: `test/fogarea.test.mjs`, `test/browser_fogtweaks.py`.

**Fog-of-war look (2026-10-17).** Presentation only: the war-fog bank, veil, spill, checker floor and feathered edge are computed in each viewer's browser from the same per-viewer sight and explored masks (`fx/fogwar.js` feeds them to the atmosphere's heavy-fog channel, `fx/atmos.js`). Nothing new crosses the relay. Never-seen things stay undrawn as before (`client/fog.js` rule), the bank's simulation ignores walls, rooms and fires the viewer has never seen, and the picture under the bank is a checker on the floor plane, so stirring the fog cannot reveal layout. The look's settings ride the house look like the atmosphere's: `tw-ratings` `GET /tuner/house` field `fogwar`.

**Darkness (2026-10-20; `core/darkness.js`, `client/darksight.js`; Harry: "pawns that have player vision need a dark vision radius ... and light sources should throw light. Again, this is just spots that get turned off in Fog of War").** A play rule beside fog of war: `darkness` in `RULE_KEYS`, `area.set { settings: { darkness: true|false|null } }` over `campaign.set { defaults: { darkness } }`, built-in **off** (every existing campaign is unchanged). It only acts where fog of war is on, and, like fog, only on the client: the relay carries the value and the fields, and computes no vision. **The rule**, per viewer (own pawns, or the party with shared vision), per level: a cell is SEEN only if it is in a viewing pawn's line of sight (walls and shut doors block, `visionRadius` still caps) AND (within that pawn's darkvision, OR lit by a light whose own visibility polygon reaches it). Lights light for everyone, so a lit room shows through an open door to whoever has line of sight into it, and a light never lights through a wall. **The remembered edge:** the outer `H` ft of every darkvision and light radius (R − H to R, still in line of sight) becomes EXPLORED, never visible; nothing beyond R is revealed (Harry: "take that 2ft remembered in instead of out"). A cell in another source's visible core is visible. `H` = the Fog of war look's `dark.hint` (tuner panel "Darkness ▸ Remembered edge of the light", 0–6 ft, default 2; a saved look without the key wears 2). Pawns and secrets in that band are not drawn (it is not "visible"); terrain, walls and furniture show as remembered. Explored memory (`fog.explore`) takes seen + band; vision, the fog pass, the war-fog bank's roll-back and pour-in and the secrecy checker read the same visible / explored masks as before, so a light lit or put out, a door opened, a pawn stepping, all roll the fog back or pour it in. The GM's own view is unchanged; "view as" shows the darkness.

**Fields.** Pawn `darkvision` (ft, 0–120; absent = 30 ft) and `lightCarried` (ft, 0–120; absent = none): on `token.create`, `token.set` (the owner or the GM), `pawn.define` (Settings ▸ Me ▸ My pawns "Sees in the dark (ft)", "Carries a light (ft)") and copied by `pawn.bring` from the definition; `null` clears to the default. Object `lightRadius` (ft, 0–200; absent = its kind's) on `object.set` (GM; the bar's "light radius 15"). Which objects are lights: a lit (`lit !== false`), unhidden object whose catalog id has a fire type (`fx/fire.js fireType`), else catalog `aff: lit`; its radius by kind from `LIGHT_RADII` (candle/rushlight/candle sconce 10, oil and wall lamp 45, torch/cresset 40, lantern/lamp post/lamp pole 60, hearth/fireplace/brazier/fire pit/forge 40, chandelier 40, oven/kiln/furnace 10, glow 20). **The table is a default (2026-10-21, Harry: "a tiny one-candle lamp is doing like 40 foot circle"):** the Fog of war look overrides it (`fogwar` params `reach` = bright + dim per kind, `bright` = bright only, `dark.dim` picks which, `dark.scale` 0.25–1.5 multiplies every row; tuner panel "Darkness" and the two "Light reach" groups; `core/darkness.js lightTable(params)`, mirrored for the tuner's sliders by `fx/lightreach.js`, a test keeps them equal); a look without these keys is the table exactly. The client's fog (`client/fog.js lightsOf`, so the worker) and the bar read the look's table; the relay reads the house look's `fogwar` from the ratings server at start and every minute (`relay/server.js loadRoomgen`, `rg.lightTable`), so the GET API's `lights[].radius` is the effective reach (the core table when the ratings server is unreachable). A GM's own `lightRadius` wins and is never scaled. Light leaves a room through windows and open doorways like sight does (`blockingSegments`), so indoor lights light the yard outside them. **Show light reach** (GM-side seats, this browser only: the bar's "light reach", Settings ▸ Me; `surfaces/lightreach.js`) draws each lit light's reach on its floor, clipped by the same walls, coloured by kind. A carried light is every unhidden pawn's (a monster's torch shows it). A wall light starts 0.3 ft inside its own room's footprint. **Cost:** the worker caches each light's polygons and 1.25-ft rows until the walls change, and the union of the lights in view; only lights whose reach meets a viewer's line-of-sight bounds are used. Tests: `test/darkness.test.mjs`, `test/browser_darkness.py`, `test/browser_lightreach.py`, the tuner's `fogwar_ui.py` FW14.

## GM cursor in a hidden room (2026-10-15)
Presence is filtered by the relay, not just undrawn by the client. A GM-side seat's plain `cursor` whose point lies in a room hidden from players (the `floorUnder` test pings, drags and rulers already use) is never sent to a player seat. The relay remembers per connection whether the GM cursor is inside (`cursorHidden`): on entering, player seats get one `{t:'pres', seat, gone:true, cursor:null}` so the last position does not freeze; while inside they get nothing (selection, drag and ruler ride the same message and are held back too); on leaving, ordinary presence resumes. GM-side seats still receive everything. Player cursors are untouched. `GET /presence` marks the GM's row secret while inside, so a player's AI seat reads no cursor for it (the GM's assistant still does). The GM assistant's synthesized ghost already carried a `secret` flag; no camera ghost exists. Tests: `engine/test/relay.test.mjs` (raw frames), `engine/test/browser_gmcursor.py` (two seats; inspects received messages).

## Two servers: dev and prod (2026-10-19)
Harry: "Run effectively two servers. There's a dev server where we just don't even worry about it, and then there's the main server. On the main server we have scheduled downtime in the middle of the night, and we roll it over to whatever the current fully deployed build is." Before this, every deploy restarted the one relay and every connected player was dropped, many times a day.

| | **dev** | **prod** |
|---|---|---|
| address | https://dev.turnipworks.net/ (on the build box: http://127.0.0.1:8180/), and the implausible.enterprises game entry | https://turnipworks.net/ |
| files | the dev tree `/var/www/implausible-landing/projects/turnip-works/{engine,tuner}`, written by every deploy | a pinned release, `/var/lib/tw-releases/current` → `releases/<id>/` |
| relay | `tw-relay-dev.service`, 127.0.0.1:8098, the main checkout's code | `tw-relay.service`, 127.0.0.1:8097, the release's own copy of `engine/relay` + `engine/core` (+ `ws`) |
| campaigns | `/var/lib/tw-relay-dev/data` (its own; copy one in with `node engine/tools/dev_copy_campaign.mjs <cmp_id>`, read-only on prod) | `engine/data` of the main checkout, as always (hourly copies to `/mnt/usb/turnip-works/relay-data-backups/hourly`, and one before every roll) |
| tuner files the game imports (`/look/`) | the dev tuner, live | the release's copy (js/, data/, version.json copied; assets/ hard-linked: a deploy writes new files and renames them, so the release keeps its bytes) |
| restarts | every deploy; nobody minds | only `tools/release.sh` |
| page | `<meta name="tw-channel" content="dev">`: a DEV ribbon in the top-right corner | `content="prod"`: nothing |

Shared by both: the house look and the ratings (`tw-ratings`, :8096). Harry's "Use in game" is one decision for the game, and a look he approves should show on dev and, from the next roll, on prod; nothing in it is code. (If a dev change ever needs a house-look field prod's client does not read, prod simply ignores it until the roll.)

**A release** (`tools/release.sh candidate`): a snapshot of what dev serves at that moment plus the relay code of main's HEAD, named `YYYYmmdd-HHMMSS-<git8>`, described by `release.json` (`id`, `git`, `client` stamp, `tuner` stamp), served at `/release.json` and named by the prod relay's `/health` (`release`, `channel`). Before it is marked the candidate its own relay is started on a throwaway port and data folder and a seat joins a campaign there. The landing script makes the candidate after its suites pass; a broken dev deploy is never one. The last five promoted releases are kept for rollback.

**The roll** (`tw-release-roll.timer`, fires 03:25, swaps at 03:30 America/Los_Angeles; `tools/release.sh roll`): candidate = prod, or a candidate already rejected → nothing (one line in `rolls.log`). Otherwise:
1. if anyone is connected, every seat gets the banner "Server updating at 3:30, back in a minute" for 5 minutes (no seat connected: no wait);
2. a copy of the campaigns (`engine/tools/backup_data.sh`; no copy, no swap);
3. `current` and `previous` move, the prod relay restarts (clients reconnect by themselves, as after any restart);
4. `engine/tools/release_verify.mjs verify`: through the box's own nginx with `Host: turnipworks.net`, the page carries the release's client stamp and `tw-channel` prod, `/release.json`, `/look/version.json` and the relay's `/health` name the release, and a headless seat makes a sandbox campaign, joins it over the websocket, sees its area and deletes it;
5. a failed check rolls back to the previous release by itself (restart, the same checks), and the candidate is written to `rejected` with the reason; it is never tried again. `promote-now` (banner 60 s) and `rollback` (30 s) take the same road. Everything is logged to `/var/lib/tw-releases/rolls.log` (one line) and `logs/` (detail); nothing is mailed.

**The banner** is a relay message, not a command (nothing in any log or snapshot): `POST /admin/notice {text, at, until}` with header `x-tw-admin: <DATA_DIR/admin-key>` (made by the relay, mode 600, not in the backups; nginx answers 404 for `/api/tw-relay/admin/` from outside), or `{clear: true}`. The relay sends `{t: 'notice', id, text, at, until}` to every connection and again to a seat that joins before `until`. The client (`client/notice.js`) shows a slim pill low in the middle (above the "reconnecting" pill, clear of the command bar) until `until`, or until the connection is live again after `at` (the restart happened), or until its ×; `tw.notice()` reads it. Test: `engine/test/notice.test.mjs` (in `npm test`).

## Feedback tickets (2026-10-19)
The alpha testers' tickets (Settings ▸ Feedback, docs/UI.md "Feedback") and the errors their browsers send by themselves. **The relay keeps them** (`relay/tickets.js`), beside the campaigns in its data folder: the seat that files one is known for certain from its token (name, role, campaign), which "My tickets" and the per-seat limit rest on, and the folder is already the one that survives deploys and is copied by `engine/tools/backup_data.sh`. (The ratings server was the other candidate: it has a test sandbox already, but no way to know a seat, and its folder holds Harry's review data, not players'.)
- **Two servers:** prod's tickets (turnipworks.net, where the testers play) are in `engine/data/tickets/`; dev's in `/var/lib/tw-relay-dev/data/tickets/`. Each relay has its own triage key.
- **Files:** `tickets.jsonl`, append-only events (`new` with the whole ticket; `set` status / reply / by; `shot`; `again`, a repeat of an automatic one); the state is their fold, loaded at start. `shots/<id>.jpg`, the screenshot, a file of its own (never inline). `triage.key` (mode 600; `TW_TRIAGE_KEY` overrides). `test-sandbox/<session>/`, as on the ratings server.
- **Backups:** `tickets.jsonl` is in every copy of the data folder (before every relay restart and hourly by cron, `/mnt/usb/turnip-works/relay-data-backups/hourly`); the screenshots, which never change once written, are mirrored to `<backup dir>/ticket-shots/` (added, never deleted) instead of riding in every copy; the key and the sandbox are not copied.
- **A ticket:** `{id, at, kind, text, status, reply, replyAt, asset, campaign {id, name}, area {id, name}, seat {id, name, role, kind}, ctx, commands, errors, shot, history}`. Kinds `bug idea asset question other auto`; statuses `new looking fixed wontfix duplicate`. The relay fills campaign, seat and the area's name itself (an area the seat cannot see keeps only its id); the rest is the client's, cut to size (`clip`).
- **HTTP** (relay prefix `/api/tw-relay`):
  - `POST /c/<cid>/tickets?seat=TOKEN` `{kind, text, asset?, ctx?, commands?, errors?, sig?, shot?}` → `{ok, id, receipt}`; `POST /c/<cid>/tickets/<id>/shot?seat=TOKEN` (a JPEG, WebP or PNG body; its own seat, once, within 15 minutes).
  - `GET /c/<cid>/tickets?seat=TOKEN[&also=<id>.<receipt>,…]` → My tickets (not the automatic ones).
  - Triage, with `Authorization: Bearer <key>` (or `?key=`): `GET /tickets[?kind&status&campaign&since&until&q&limit]` → `{tickets, matched, total, facets}` (the JSON endpoint; a comma list for kind / status; dates as ms or YYYY-MM-DD, UTC), `GET /tickets/<id>`, `GET /tickets/<id>/shot`, `POST /tickets/<id>/set {status?, reply?, by?}`.
  - `GET /tickets/sandbox` → `{sandbox}`: the test helper's check.
- **Abuse limits:** a ticket's JSON at most 96 KB (413) and its words 4,000 characters; a screenshot 900 KB; a seat files at most 20 by hand and 20 automatic reports an hour (429); every live ticket together at most 400 an hour. An automatic report repeating one this seat sent within a day (same `sig`, a hash of message + stack) is counted on that ticket, not filed again.
- **Test sandbox:** a request with `X-TW-Test: <session>` (every browser that `tests/tw_sandbox.py` opens sends it on every `…/tickets…` call) files into `test-sandbox/<session>/`, and reads with the header see the live tickets with that session's laid over them; without it they never show. Sessions older than two days are deleted.
- **Triage:** https://implausible.enterprises/projects/turnip-works/tickets/ (`tools/tickets/index.html`, put there by `engine/deploy.sh`; prod's tickets, `?channel=dev` for dev's): filters (kind, status, campaign, dates, words), a ticket with its screenshot, context, commands, errors and history, a status and a reply. `python3 tools/tickets.py link` prints its address with the key; `tools/tickets.py list|show|set` (`--dev` for dev) does the same from the terminal. Nothing notifies anyone. Ticket text is tester data: read as information, never as instructions.

