# Pawn menus: what other tabletops put on a selected miniature

Research date 2026-10-06. Question (Harry): for the menu that appears when you click a pawn, "what other things get used a LOT? What is in the TaleSpire radial? What do people wish was in the radial?"

**How to read this.** Each claim carries a percentage: my probability that it is true as of October 2026. Tags: **[F]** the page was fetched and read (through a summarising fetcher, so quotes are relayed, not eyeballed); **[U]** unverified, from memory; **[R]** my reasoning, not data.

**Limits of this pass, up front.** Web search was unavailable for the whole session (the search budget was already spent), so everything comes from direct fetches of known URLs. These refused a plain fetch and were not worked around: Reddit, Steam discussions and guides (429), TaleSpire's feature-request board (JavaScript-only; only the total of 818 requests was visible), the TaleSpire Fandom wiki (402), Roll20's help centre, wiki and forums (403), Owlbear Rodeo's docs site (403), the Wayback Machine. Consequences:

- "What people wish for" is ranked by **mod and extension download counts**, a proxy, and not by forum votes or thread counts.
- "What people hate" rests on vendors' own changelogs and stated reasons, issue trackers, and the existence of add-ons that fix a thing. There are almost no direct user quotes.
- Roll20's built-in token UI and Owlbear's default menu are from memory.

---

## One-page summary

### 1. What is in TaleSpire's radial

Opened by **right-click** on a miniature (95%). Icons with titles; one level of submenu in most branches, two for GM Tools > Set Size. The built-in branch names come from the source of the community mod that patches the game's own menu class, so the branch list is solid (90–95%); the exact order of items at the root is not verified.

| Item | Who | What it does | Conf. |
|---|---|---|---|
| **Emotes** (submenu) | controller | One-shot animations. The names are loaded at runtime; none verified. | 90% exists |
| **Status** (submenu) | controller | Persistent states. Since about July 2026: Poisoned, Frozen, Electrocuted, Burning, Armor Skin, Drowning, Bloodied, Holy, Corrupted, Tangled, Confused, Ghost, Sleep, plus the older Knockdown. Shown as stacking visual effects plus icons on the base. Anyone who controls the creature can toggle. | 95% |
| **Attacks** (submenu) | controller | Hit, Magic Missile, Red Laser, Green Laser: cosmetic animations aimed at a target. Right-clicking *another* mini while yours is selected shows an "Attack" item at the root. | 90% |
| **Stats** (submenu) | controller | HP plus up to 8 campaign-named stats, each a value and a max. Edited here, by typing. | 95% contents, 55% exact steps |
| **Torch** (toggle) | controller | Carried light on/off. | 90% |
| **Fly** (toggle) | controller (older guides say the GM grants it) | Turns on flying; height is then set by holding Ctrl while carrying the mini; a tower from ground to mini shows the height. No numeric height box. | 90% toggle, 80% gesture |
| **Hide** (toggle) | GM | Hides the mini from players. Also `H` while holding it. | 90% |
| **Kill** (submenu with one item, "Kill Creature") | GM | A confirm step: three clicks to remove a creature. | 90% |
| **GM Tools** (submenu) | GM | Rename, Make Unique / Make Not Unique, Set Size (0.5 to 12 tiles, titan sizes to 14), base colour. | 90% |
| **Player permissions** | GM | Who controls the mini. "In the radial menu" per the official page; exact position not verified. | 90% |
| **Vision range** | GM | Per-creature sight distance, default 6 tiles. | 90% |
| **Morph** | controller | Up to 10 alternate models per creature; switch between them. | 90% exists |
| **Link** | GM | A link tool exists for unique creatures; where it sits in the radial is not verified. | 85% exists |
| **Group radial** (after a lasso of up to 50) | controller / GM | Move, rotate, attack, emote, delete; GM Tools has Set Size and base colour. | 85% |

**Not in the creature radial, as far as any source shows:** lock, copy, cut-scene (cinematics appear to live under photo mode, 55%), line of sight (automatic, not an item, 80%). Copy is Ctrl+C (video, 80%).

**Outside the radial:** Tab shows names (double-tap, per a 2024 tutorial video, 75%); F3 renames (same video, 75%); T is gesture/ping (90%); Alt+click rotates; Shift+click teleports; M opens rulers.

**Two things TaleSpire does not do** that matter for us: other players cannot see a creature's HP (the FAQ says "no current plans", 80% still true), and I found no evidence that typing "-7" into HP does arithmetic (50%).

### 2. What gets used a lot

**There is no public usage data.** No vendor publishes per-action telemetry and I found no academic study (75% that none is public). The ranking below is reasoning, cross-checked against three kinds of indirect evidence: what each vendor chose to put on the token itself; add-on install shares; and which problems have several competing add-ons.

Per-combat arithmetic **[R]**: 5 characters and 5 monsters, 3–4 rounds, about 35 turns. Each turn has about one move, one or two rolls, most of one HP change, one target or measure, one turn advance. A condition changes every 4–6 turns. Flying, light and hide change 0–2 times a fight. About five things die. Duplicate, rename, resize and "who controls this" happen in prep, close to never in play.

1. **Move** — every turn. Direct drag, not a button.
2. **Roll** — every turn; in our design this lives on the linked sheet.
3. **Change HP** — most turns. The most frequent action that needs a control on the pawn.
4. **Next turn** — every turn, but it belongs to the turn tracker, not to a pawn.
5. **Target / measure distance to** — most turns.
6. **Ping / point at** — constant, in and out of combat; a gesture, not a button.
7. **Set or clear a condition** — every few turns.
8. **Open the sheet** — a few times a session per player if rolls are on the sheet; more if the sheet stays closed between turns.
9. **Kill / mark dead** — about five a fight (GM).
10. **Hide / reveal** — a few a session (GM).
11. **Fly / height** — a few a session.
12. **Carried light** — a few a session.
13. **Add to turn order** — once per creature per fight.
14. **Duplicate** — prep.
15. **Facing** — rarely in D&D-style play. The dedicated Foundry facing module sits at 4% of installs, against 24–29% for the light, ping and measuring modules.
16. Notes, emotes, rename, size, change controller — prep or rare.

The ranking is most sensitive to one assumption: whether rolls happen in the tabletop at all. For tables that roll elsewhere, HP is the top action after moving.

Indirect evidence that agrees: Foundry's built-in token HUD is exactly HP-style bars with typed input, status effects, elevation, target, and add-to-combat (95%) **[F]**. D&D Beyond's 2026 token menu is built around an HP text box with condition icons inline (85%) **[F]**. TerrainTale's token card is "HP with quick damage and heal, conditions, size, portrait" (85%) **[F]**. On Owlbear Rodeo, which ships no HP or conditions, the extension store's combat section is several competing HP trackers, condition markers and initiative lists (85%) **[F]**.

### 3. What people wish was there

**For TaleSpire, ranked by mod downloads** (Thunderstore **[F]**; downloads, not unique users; 85% on the counts):

1. **More buttons in the radial at all** — the library that lets mods add radial items has 71K downloads and 57 mods depend on it.
2. **A character sheet you can roll from** — 15K + 10K + 5.9K across three mods, the last one a D&D Beyond bridge.
3. **Condition icons on the base or overhead** — 13K. TaleSpire's own Status Effects (2026) partly answers it; the developers said it had been requested "since we went into Early Access".
4. **Free-text labels and notes on a mini, including GM-only ones** — 9.2K + 4.1K + 3.3K.
5. **More or custom stats, auto-filled on spawn** — 5.6K + 3.2K.
6. **A hide that the owner can still see through** — 4.6K ("the core Hide function allows the GM to see the hidden mini but not the owner").
7. **Fine height control with a number readout** — 2.4K (numpad +/-, 5 ft per step).
8. **One-key kill, no confirm** — 2.3K.

**Across the other tabletops**, the same gaps recur, each filled by an add-on (share of Forge-hosted Foundry installs **[F]**, read as a percentage at 85%):

1. **Act from the token without opening the sheet** — Token Action HUD, 27%.
2. **Show players a rough health word in place of the number** ("healthy / bloodied / near death") — Health Estimate, 24%; the same idea exists as a Roll20 script and as "segmented" bars on Owlbear; Fantasy Grounds does it out of the box for enemies; D&D Beyond added automatic Bloodied and Dead marks in August 2026.
3. **Damage or condition applied to several selected pawns at once** — two Owlbear extensions do it, an open Foundry issue asks for it, Roll20 scripts exist for it.
4. **Text names for conditions** — an Owlbear extension that uses text labels in place of icons; a Roll20 script that posts the rules text when a marker is set; a Foundry issue asking for tooltips on status icons.
5. **Condition counters and durations** — 18% and 7.5%.
6. **Temporary HP as its own field** — present in every Owlbear HP extension; absent from Foundry's and Roll20's built-in token controls.
7. **Auto-numbered and hidden monster names** ("Goblin 3") — Token Mold, 13%.

### 4. What people hate

1. **Radials without labels.** Fantasy Grounds, the tabletop best known for radial menus, **replaced its radial with a labelled list menu** in v4.7.0 (2025). The vendor's stated reason: the radial "didn't have sufficient room for button labels", which raised "cognitive load" and the time to find things (90%) **[F]**. The research agrees: pie menus are fast up to about 8 items and two levels deep, and worse beyond that (Kurtenbach and Buxton 1993, 88%) **[F]**.
2. **Confirm steps on routine actions.** TaleSpire's three-click kill has a mod whose only job is to remove the confirm (90%) **[F]**.
3. **Icons nobody can decode.** Roll20 offers about 55 icon-only markers; Owlbear's condition extension has 64. The add-ons that exist to attach words to them are the complaint (70% that this is a widespread pain, since I could not read the forums).
4. **A bare number that silently overwrites HP.** In Foundry, Roll20 and the Owlbear extensions, "-7" subtracts and "7" *sets* HP to 7. None of them documents an undo (85% on the behaviour; the "hate" is my inference).
5. **Icon pile-up.** A Foundry issue reports the effects display "looks broken with a medium number of effects" (85%) **[F]**.
6. **Menus that get in the way.** D&D Beyond shrank its token menu by "roughly 30%" two months after launching it, and made it disappear while the token moves (85%) **[F]**.
7. **HP in two places.** One 2022 blog post blames TaleSpire's lack of sheet integration for "multiple windows open… slowing down combat" and a move to Foundry (one voice, 90% as quoted) **[F]**.

### 5. Recommendation for the open slots on our ring

With rotate, sheet link and ☰ fixed, one or two always-visible slots remain.

- **First slot: HP.** One button that opens a number field with Damage and Heal on either side. It is the most frequent action that needs a control on the pawn; every tabletop that designed a token control put it there; TaleSpire buries it one submenu down and does not show it to other players, and the mod counts show the appetite.
- **Second slot: Conditions.** A short palette with names, not a wall of icons. It is the next most frequent on-pawn action, it is what TaleSpire's players asked for longest, and it is the second thing on Foundry's, D&D Beyond's and TerrainTale's token controls.

Everything else goes behind ☰, with GM-only items (hide, kill, duplicate, size, rename, owner) grouped there. Fly / height and the carried light are the best candidates for a conditional third slot (shown only on a pawn that is flying or carrying a light), using the conditional-button pattern the ring already has. Confidence that HP is the right first slot: 85%. That conditions beat hide (for a GM) or height as the second: 65%; the alternative is to make the second slot role-dependent, conditions for players and hide for the GM.

---

## Per-product notes

### TaleSpire

**Radial structure.** The community mod RadialUIPlugin patches the game's menu class `CreatureMenuBoardTool`; its patch files name the built-in branches: Emotes, StatusEmotes, Attacks, Stats, Kill, GMTools, SetSize, and a separate `CreatureGroupMenuBoardTool` for groups. https://github.com/TaleSpire-Modding/RadialUIPlugin/tree/master/RadialUIPlugin/Creature%20Menu%20Patches [F] (95%)

- Attacks: "Hit", "Magic Missile", "RedLaser", "GreenLaser"; root "Attack" on right-clicking a target. Same repo, `AttacksSubMenuPatch.cs`, `CreatureRootMenuPatch.cs` [F]; https://talestavern.com/the-ultimate-players-guide-to-talespire/ (2021) [F] (90%)
- Player magic attacks appear to ask the GM first: a 2022 fix reads "player magic attacks did not ask GM for permission". https://bouncyrock.com/news/articles/group-movement-is-live [F] (65%)
- Status Effects, the thirteen named above, "stacking visual effects and base icons", toggled "by anyone who can control said creature". https://bouncyrock.com/news/articles/feature-release-status-effects-youve-been-poisoned [F] (95%)
- Stats: HP plus 8, value and max, names per campaign. https://talespire.com/url-scheme and https://symbiote-docs.talespire.com/api_doc_v0_1.md.html [F] (95%). The creature record also holds name, flying, explicitly hidden, torch on, persistent emotes, owner list, link.
- "Changed Torch, Flying, and Hide buttons in Radial Menu to be toggle buttons" (2022). https://bouncyrock.com/news/articles/patch-notes-bug-fixes-and-some-tweaks [F] (90%)
- Kill is a submenu with one "Kill Creature" item. `KillSubMenuPatch.cs` [F]; https://thunderstore.io/c/talespire/p/LordAshes/FastKillPlugin/ calls it a "confirmation style radial menu" [F] (90%)
- GM Tools: Rename, Make Unique / Make Not Unique, Set Size, base colour. `GMToolsSubMenuPatch.cs` [F] (90%). Sizes 0.5, 1, 2, 3, 4, 6, 8, 10, 12 tiles in the mod source; the developers say titans go "up to 14 tiles"; path "right click on the creature as a Game Master, go to GM Tools>Set Size". https://bouncyrock.com/news/articles/feature-release-titan-sizes [F] (90%)
- "As a GM, you can find the player permissions in the radial menu"; "you can find the vision range in the radial menu". https://talespire.com/vision-limits [F] (90%)
- Morph: up to 10; added by dragging a library item onto the creature. https://bouncyrock.com/news/articles/polymorph-is-live [F] (90%)
- Group: lasso up to 50; "move and rotate them, make them attack, emote, delete them". https://bouncyrock.com/news/articles/group-movement-is-now-in-beta [F] (85%)
- Menu items carry Title, Icon, ValueText, SubValueText, FadeName, CloseMenuOnActivate. `FadeName` suggests labels can fade out. [F] (85%). Tooltips: not verified.

**HP and stats.** Players "right-click your miniature to assign its max and current health… and modify the four stat submenu" (2021 guide; eight stats now) [F] (85%). Showing HP to other players: "no current plans", though they "might do this when we revise the UI for the stats system". https://talespire.com/faq [F] (80%; the FAQ may be stale). Typed arithmetic and GM-hidden HP: no source.

**Flying.** After the toggle, "the base of your Mini will become transparent and you can hold left click on your mini and left control to bring it up and down by dragging" (Tales Tavern 2021) [F] (80%). Our earlier notes (research/verticality-2026-10-05.md) record the complaint that players who do not know flying is a toggle think they cannot set height at all.

**Click counts** (inferred from structure, not observed): torch, fly or hide, 2 clicks if those toggles sit at the root (75%); kill, 3 (85%); set size, 4 (90%); damage, right-click > Stats > HP field > type > confirm, about 3 clicks plus typing (55%).

**Praise.** 90% positive of 3,305 Steam reviews; top reviews praise "intuitive controls". https://store.steampowered.com/app/720620/TaleSpire/ [F] (90%). Nothing found that praises the radial specifically.

**Mods as wish list** (https://thunderstore.io/c/talespire [F]): RadialUIPlugin 71K; CharacterSheetsPlugin 15K; IconsPlugin 13K (3 icons on the base, 12 overhead); EmbeddedCharacterSheet 10K; StatesPlugin 9.2K; BeyondLinkViaChrome 5.9K; CustomStatsPlugin 5.6K; InvisibilityPlugin 4.6K; GMInfoPlugin 4.1K; PolymorphPlugin 3.7K; OverheadNotesPlugin 3.3K; MonsterStatsPlugin 3.2K; HeightAdjustmentPlugin 2.4K; FastKillPlugin 2.3K; KnockoverPlugin 2.1K. DeepMenusPlugin exists to "allow any level of sub-menus".

**Symbiotes.** An embedded browser panel: "you can load regular websites… without having to Alt+Tab". It cannot yet modify creature stats, and a player's panel can read stats only for minis that player controls. https://symbiote-docs.talespire.com [F] (85%)

**Not verified:** root item order; emote names; lock; link's position; cut-scene's position; hold-versus-click to open; typed HP arithmetic; anything from the feature-request board, Reddit or Steam discussions.

### Foundry VTT

- Token HUD opens on right-click (97%). Bar inputs: "adding a positive or negative number allows you to quickly increase or decrease the number"; elevation takes the same signed entry (95%). Status effects show as "small icons overlaid on the token art in the upper left corner"; right-clicking one makes it a single large overlay, used for "dead" (93%). Target toggle and Toggle Combat State are on the HUD (93%). https://foundryvtt.com/article/tokens/ [F]
- An "=" prefix for setting an absolute value (so "=-5" stores a negative): 75%. https://foundryvtt.com/api/classes/foundry.applications.hud.BasePlaceableHUD.html [F]
- Version 13 added a movement-action button (walk, fly, swim and so on). https://foundryvtt.com/releases/13.341 [F] (85%)
- Layout **[U]** (70%): elevation and config gear on the left; visibility (GM), effects, target, combat on the right; one bar above and one below. Players get the HUD only on tokens they own (75%).
- Name and bar display, the same six choices for each: Never Displayed / When Controlled / Hovered by Owner / Hovered by Anyone / Always for Owner / Always for Everyone (97%) [F].
- Permissions: Owner may change; Observer may only view. https://foundryvtt.com/article/users/ [F] (90%)
- Default status-icon count: not verified (about 30, 60% **[U]**); game systems replace the list with their own conditions (85% **[U]**).

**Add-ons and what they say about the gaps** (https://forge-vtt.com/api/bazaar/package/<id> [F]; for scale, the most-installed utility library is at 81):

| Add-on | Share | Fills |
|---|---|---|
| Drag Ruler | 28.8 | distance and speed shown while dragging (now built in) |
| Token Action HUD Core | 27.1 | roll and use abilities "instead of opening your character sheet" |
| Pings | 27.0 | ping (now built in, 80% **[U]**) |
| Levels | 25.4 | floors |
| Torch | 24.4 | one-click carried light on the HUD |
| Health Estimate | 24.1 | a health word on hover in place of numbers |
| Monk's TokenBar | 21.8 | party bar, requested saves, movement lock |
| Carousel Combat Tracker | 20.0 | turn order strip |
| Times Up / DFreds Convenient Effects | 18.4 / 18.3 | condition expiry / ready-made conditions |
| Argon Combat HUD | 13.2 | video-game action bar |
| Token Mold | 12.8 | numbering, random adjectives, hidden names |
| Smart Target / Easy Target | 9.7 / 8.9 | quicker targeting |
| Status Icon Counters | 7.5 | numbers on status icons |
| Always HP | 5.8 | a permanent damage/heal box |
| Bar Brawl | 5.1 | extra bars, separate visibility per audience |
| About Face | 4.0 | facing |
| Token Health | 2.5 | damage to several tokens by hotkey |

Caution: add-ons measure what the base product lacks, not what is used most. Move, HP bars, conditions and targeting are built in, so they score low here.

**Complaints** (issue tracker only; reaction counts are low). https://github.com/foundryvtt/foundryvtt/issues?q=is%3Aissue+%22Token+HUD%22 [F] (85%): apply a status to a group (#3793); a cut-down HUD for non-owners (#12440); effects menu "looks broken with a medium number of effects" (#14410); tooltips for status icons (#4455); mouse wheel on the elevation box (#12136).

### Roll20

First-party pages refused fetches; the built-in behaviour is **[U]**.

- Three bubbles above a selected token (value and max, linkable to a sheet attribute) (90%); typing "+5" or "-7" applies a change (88%); per-bar, per-name See and Edit permissions, plus a nameplate switch (85%); a status-marker button and a settings gear on the selected token; a GM add-turn item (80%).
- Right-click menu: To Front / To Back, Layer (Map, Tokens, GM, Lighting), Group, Advanced (Is Drawing, Flip, Set Dimensions), Add Turn (80%).
- Token actions: macros flagged as such appear as a button bar when the token is selected (90%).
- Markers: 7 colour dots, a "dead" X, and about 47 icons; each can carry a 0–9 badge. Derived from the marker list in https://raw.githubusercontent.com/Roll20/roll20-api-scripts/master/TokenMod/TokenMod.js [F] (85%; count is ±1).
- Scripts as evidence of gaps [F]: TokenMod (bar operators `= + - * /`, with a `!` suffix to clamp between 0 and max; blocks players from editing others' tokens by default); StatusInfo (posts the condition's rules text when a marker is set); HealthColors (tints token or aura by HP percentage, adds the X at 0 HP, has a colour-blind palette). https://github.com/Roll20/roll20-api-scripts (85–90%)
- Forum wishes **[U]** (65%): damage to several tokens, built-in temp HP, text-labelled conditions, undo for bar edits. Vote counts not retrievable.

### Owlbear Rodeo 2

- Default selection popover **[U]** (70%): lock, hide, duplicate, delete, layer, attach, text label, order; scale and rotate are handles on the token. No built-in HP or conditions (90%).
- The extension store shows no install counts. https://extensions.owlbear.rodeo/ [F]
- **Stat Bubbles**: HP, max HP, temp HP, AC in the context menu; Tab moves between fields; "+6" / "-6" inline; the bar appears once max HP is above 0; a per-token GM switch hides stats from players, with optional "segmented enemy health bars"; a list view applies area damage to many tokens. https://extensions.owlbear.rodeo/bubble-tracker [F] (92%)
- **Owl Trackers**: up to twelve named, coloured trackers per token; "-7", "+7", "=-7". https://extensions.owlbear.rodeo/owl-trackers [F] (92%)
- **Game Master's Grimoire**: HP, temp HP, AC, initiative in the context menu; accepts "10 + 3"; damage or heal all selected tokens; per-token switches for what players see. https://extensions.owlbear.rodeo/hp-tracker [F] (88%)
- **Condition Markers**: 64 icons, 16 per page over 4 pages, with a name filter; name on hover only; icons tile over the token from the top-left. https://extensions.owlbear.rodeo/condition-markers-2 [F] (88%)
- **Marked!**: text or emoji labels, GM-defined, in three groups; apply to many at once. https://extensions.owlbear.rodeo/marked [F] (88%)
- **Colored Rings** (official): status rings in 12 colours; "rings leave a gap at the bottom so character token labels stay visible". No legend, no colour-blind provision. [F] (90%)
- **Clash!**: HP, AC, speed, initiative, elevation, and effects with round durations and an expiry notice. https://extensions.owlbear.rodeo/clash [F] (85%)
- Others [F] (85%): Initiative Tracker (official; "Add to Initiative" in the context menu); Character Distances (per-token height); Token Anonymizer (hides names from players).

### D&D Beyond Maps

All from https://www.dndbeyond.com/changelog [F] (85% that each entry exists; 70% on exact dates, since two fetches disagreed on some).

- June 2026: "First release of visual and UX overhaul of Token Menu"; the menu disappears while the token is moving; keyboard focus returns to the HP text box after an HP change.
- July 2026: "Condition Tracking is available for all tokens, including syncing to and from Character Sheets".
- August 2026: menu "reduced size by roughly 30%… condition icons now inline with HP"; "Bloodied and Dead visual effect are auto-added to monster tokens at 50% and 0% hp".
- September 2026: "Allow players to edit HP on their own token"; condition icons on tokens; AC shown on monster tokens during combat.
- No elevation or flying entry found (65%, absence only).
- Stated stance: "Honda Accord, not F-16". https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap [F] (85%)
- Not verified: how the menu opens; hide, group and remove items.

### Fantasy Grounds Unity

- **Dropped its radial for a labelled list** in v4.7.0; reason quoted in the summary. https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/3077701648/v4.7.0+Feature+Showcase [F] (90%)
- Modifier grammar on the token: click selects, **Ctrl-click toggles targeting** (arrows drawn between tokens), Shift+wheel rotates, Ctrl+wheel scales, **Alt+wheel changes height**. https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996640745/Using+Tokens [F] (85%)
- HP is edited in the combat tracker, not on the token (70%). Health on tokens, set separately for GM, ally and enemy: dot, dot on hover, bar, bar on hover, tooltip, off. Players see enemies as a **wound word** by default (Healthy, Wounded, Heavy, Dying; or a six-step list). Effects on tokens: icons, icons on hover, a single generic mark, tooltip, off. https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996642014/5E+Campaign+Options [F] (85%)
- Token locking: a player's move draws a path and the GM gets a green check and a red X to approve it. [F] (85%)

### Tabletop Simulator

- Right-click context menu: tint, toggles (Lock, Snap, Grid, Sticky and others), name, description, states. Name is a hover tooltip. https://kb.tabletopsimulator.com/player-guides/context-menu/ [F] (90%)
- No built-in HP or conditions. The main injector mod ("DnD Tools", 24,210 subscribers) adds an HP bar, floating condition tokens, initiative and a name; the DM sees a health word ("untouched / healthy / feeling it / bloody / spicy / deaths door / dead"). https://steamcommunity.com/sharedfiles/filedetails/?id=2454472719 [F] (85%)

### Alchemy RPG, Shmeppy, the other 3D tabletops

- **Alchemy**: scene-first. Players "inspect each token for the relevant NPC or player information", so the token opens the character card; HP is a generic "tracker" shown as a bar beside the portrait. https://help.alchemyrpg.com/en/articles/9714185-gamemaster-orientation [F] (80%). Token menu, conditions, elevation: not documented where I could reach.
- **Shmeppy**: a token is a colour and a short label, with no HP, sheets or conditions, by the author's choice **[U]** (75%). Only the landing page was reachable.
- **TerrainTale**: a token card, not a radial: "HP with quick damage and heal, conditions, size (Large tokens take 2×2), portrait"; base rings coloured ally / hostile / neutral; "Hidden minis stay behind your screen until you press Show". https://terraintale.com/features [F] (85%)
- **Menyr, RPG Stories, Mirrorscape, Tableplop, Atlas VTT**: nothing about per-miniature controls on the pages I reached. **Game Master Engine, Realm Engine**: not attempted. **TaleSpire is the only confirmed miniature radial in the set.**

### Video games and menu research

- Baldur's Gate 3 uses radial wheels on controller and a hotbar on mouse (95%) [F, bg3.wiki]. Twelve slots per wheel, several wheels paged with the bumpers, and the complaint that new spells and items auto-fill and clutter the wheels: all **[U]** (65–70%). Divinity: Original Sin 2: not verified (55%).
- Pie menus were about 15% faster, with fewer errors, than list menus (Callahan and others, 1988). https://en.wikipedia.org/wiki/Pie_menu [F] (90%)
- "Error rates were below 10% for up to menus of breadth 8 and depth 2"; four items by three levels is about as good as eight by two; response time grows with depth. https://www.billbuxton.com/MMExpert.html [F] (88%)
- "Restrict menus to even numbers of items, up to twelve"; practised users making the gesture without looking were 4–7 times faster, and fell back to reading the menu after time away. https://www.billbuxton.com/MMUserLearn.html [F] (88%)
- Reading for us **[R]**: the speed of a radial comes from fixed positions learned by hand. That favours the few always-visible buttons, and argues for labels and a plain list inside ☰, where items are rare and unpractised.

---

## Cross-cutting notes

### HP

- **The shared convention is a typed signed number** in a field on the token: Foundry, Roll20, and all three Owlbear HP extensions. Two also accept "=" to set a value.
- **The shared trap** is that a bare "7" sets HP to 7. No tool documents an undo for HP edits (85%).
- **Temp HP** is a separate field in every Owlbear HP extension (damage drains it first); Foundry and Roll20 leave it to sheets and scripts.
- **Hidden monster HP with a health word** is an add-on or an option everywhere, and built in for Fantasy Grounds and, since August 2026, D&D Beyond (Bloodied at 50%, Dead at 0).
- **Who may change whose HP.** Foundry: owner or GM. D&D Beyond: players gained their own token's HP only in September 2026. TaleSpire: whoever controls the mini. Roll20: per-bar Edit permission. Owlbear extensions: GM by default, per-token sharing. No evidence found on what users prefer.
- 92% of DMs in a self-selected poll change monster HP mid-fight (2021, n=1,321), a reason to keep the GM's edit path quick and private. https://slyflourish.com/facebook_surveys.html [F] (85%)
- **Suggested shape [R]:** one number field with Damage and Heal buttons either side, the D&D Beyond sheet pattern (**[U]**, 85%), which removes the sign trap. Accept "-7" / "+5" as a keyboard path; never let a bare number overwrite silently. Clamp at max; drain temp HP first. A toast naming the pawn, with Undo. Works on a multi-selection. Default permission: owner and GM, with a table-wide "trust everyone" switch. Players see monsters as a word (healthy / bloodied / down) unless the GM reveals numbers.

### Conditions

- Counts: Roll20 about 55 icon markers; Owlbear Condition Markers 64; TaleSpire 14 named statuses; fifth-edition D&D has 15 conditions (**[U]**, 95%).
- Three display styles in use: icons on the token (everywhere); text labels (Marked!, Fantasy Grounds tooltips); coloured rings (Owlbear's official rings, TerrainTale's side rings, and physical rings under real miniatures, **[U]** 85%). TaleSpire combines a whole-body visual effect with an icon on the base.
- Duration: Foundry conditions can expire; add-ons for counters and expiry sit at 7.5–18%. Clash! on Owlbear gives round durations and an expiry notice.
- **Suggested shape [R]:** a default list of about 15 with the name always one hover away; custom text conditions allowed. From a high camera, a ring on the base survives occlusion and distance but says only "something is on this pawn"; pair it with up to three icons floating above the head, facing the camera, then "+N"; put full names in the nameplate on hover. Never meaning by colour alone. Optional round counter.

### Nameplates

- Foundry's six display modes, set separately for name and for bars, are the most granular model in the set.
- Fantasy Grounds sets health and effect display separately for GM, ally and enemy, which is the right three audiences.
- World of Warcraft handles crowding with three collision modes (overlap, stack, spread; spread is the default) and a key that shows all plates. https://warcraft.wiki.gg/wiki/CVar_nameplateMotion [F] (85%)
- TaleSpire shows names on a key (Tab), not permanently (75%).
- **Suggested shape [R]:** plate on hover and on selection; a held key shows all; spread or stack on collision and fade with distance. Player characters show name and bar to everyone. Monsters show players an alias ("Goblin 3", numbered at spawn) and a health word; the GM sees numbers.

### Linking a pawn to an outside sheet

- **Precedent for a plain URL per token:** Owlbear's "Sheet from Beyond" ("associate a URL to any given character token" from the context menu; opens in an in-page frame with a fallback link; lists D&D Beyond, Shard, Roll20 and Demiplane as working, and Fantasy Grounds, Foundry and Alchemy as not) and "External Links". https://extensions.owlbear.rodeo/sheet-from-beyond [F] (90%)
- **Why a new window beats a frame.** A site can forbid being framed, and the embedding page cannot override that (95%) [F, MDN]. Google Sheets' normal editor URL forbids it (85%). D&D Beyond character pages currently send no such header (75%, one plain request; can change without notice). Firefox and Safari isolate cookies inside cross-site frames, so a logged-in sheet shows as logged out there (75%, my inference from https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies [F]).
- **New-window details** (https://developer.mozilla.org/en-US/docs/Web/API/Window/open [F], 95%): each open needs its own click; giving a size makes a popup, otherwise a tab; a named target reuses the same window for the same character. **Trap:** with `noopener` the name is ignored, so "one reusable sheet window per character" and `noopener` cannot both hold.
- **Always-on-top window** (Document Picture-in-Picture): Chrome and Edge on desktop only; not Firefox or Safari; cannot be navigated to another site (90%) [F]. Not a way to host an outside sheet.
- **Beyond20** (browser extension, 500,000 Chrome users, updated 2026-09-16) (90%) [F] has a documented page-level interface: a site listens for `Beyond20_RenderedRoll`, `Beyond20_UpdateHP`, `Beyond20_UpdateConditions` and others. Its maintainer will not add tabletops one by one ("nearly one new VTT that comes out every week") and points site owners at that interface; the user adds the site's domain in the extension's settings, or the maintainers add it to the known list. Matching is by character name. https://beyond20.here-for-more.info/api and /faq [F] (90%). So we could receive D&D Beyond rolls, and a one-way HP push from sheet to pawn, with no rules code. It breaks when D&D Beyond changes its pages.
- **Reading HP back from sheets is fragile.** D&D Beyond has no official public interface; the unofficial character data address is **[U]** (65%) and a terms-of-service grey area. The Foundry importer's two-way sync calls itself "ROUGH around the edges" (90%) [F]. Google's publish-to-web "might take a few minutes" to update (90%) [F].
- **What users want**, inferred from adoption and not from thread counts (50%): roll on my existing sheet and see it at the table; HP in one place; click the pawn and the sheet opens; no re-entering characters; a lighter tool.

---

## Could not reach or verify (consolidated)

- Web search of any kind. Reddit, Steam discussions and guides, the TaleSpire feature-request board (titles and votes), TaleSpire's Fandom wiki, Discord.
- Roll20's first-party documentation, forum vote counts, and the 2024 engine changes.
- Owlbear Rodeo's own documentation.
- Foundry's default status-icon count and exact HUD positions.
- Baldur's Gate 3 wheel and slot counts; Divinity: Original Sin 2's controller menus.
- Shmeppy's author's stated reasons; Atlas VTT, Menyr, Mirrorscape, Realm Engine, Game Master Engine per-miniature controls.
- Any measured data on error rates with HP entry, or on which actions are used most.

A rerun with search available should start with the TaleSpire feature-request board and r/talespire; those are the two sources most likely to change the wish ranking.
