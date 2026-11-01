# Beyond20: rolls from D&D Beyond on the table (Harry 2026-10-29, as built)

[Beyond20](https://github.com/kakaroto/Beyond20) is a free browser extension (GPL-3). It reads a player's D&D Beyond character sheet in that player's own browser, and when they click a roll on the sheet it sends the roll to their VTT tabs. Turnip Works **only listens**. We ship nothing and fork nothing, and no D&D Beyond account or data ever passes through our servers except what is listed under "What crosses" below.

## Player setup (once per browser)
1. Install Beyond20 from the Chrome Web Store or Firefox Add-ons.
2. Open its **Options window** (not the small window its icon opens on a D&D Beyond sheet: that one is the character's settings, with an "Advanced Options" of its own). On the table's tab: its toolbar icon ▸ **Beyond20 Options** (the small window first says "Not a D&D Beyond or VTT page": expected). In the Options window, scroll to the very bottom ▸ **Advanced Options**, then back to the very top: the first setting is **"List of custom domains to load Beyond20"**. Add:
   ```
   https://turnipworks.net/*
   https://dev.turnipworks.net/*   (testers only)
   ```
   Press **Apply** and **Allow** the permission Chrome asks for (once per line; the filled button is Deny).
3. Open your table in Turnip Works and your character sheet on D&D Beyond, in the same browser. Reload the table tab once. A small note says **"Beyond20 connected"** (once the loading screen has gone: Beyond20 usually reports in before it does).
4. Roll anything on the sheet. The first roll offers **"Link <character>'s sheet to <pawn>"** beside your pawn. Click it once. (Or paste the sheet link on the pawn's Sheet card.) From then on that pawn is the character.

Without Beyond20 nothing here shows and nothing changes.

**For players: the help page "Connect D&D Beyond"** (2026-10-29), `/connect-dnd-beyond` (docs/site/connect-dnd-beyond.md; its film and pictures are a real recording of this setup: experiments/2026-10-29-ddbpage/). In the game, **Settings ▸ Me ▸ D&D Beyond** (and Settings ▸ Campaign rules for the GM) opens it in a new tab and says "D&D Beyond: connected via Beyond20" once Beyond20 has reported in this visit, else "D&D Beyond: not connected in this tab". Test: engine/test/browser_ddbpage.py.

## What it does
- **A roll lands on the table.** TW throws its own 3D dice from the character's pawn. They **land on Beyond20's numbers**: Beyond20's results are authoritative, and every seat turns each die's numbering so the top face reads them. This is the ordinary synced roll (`dice.roll` with the per-die `rolls` and the recorded throw: docs/NETCODE.md "Determinism where it pays"), so every player sees the same throw and the same numbers. The line in the log is Beyond20's total: "Thorin · Athletics: d20+5 adv = 22 [17, 4]".
  - Advantage and disadvantage are one throw of two d20s ("d20+5 adv"); super advantage is "3d20kh1+5".
  - An attack is two throws, one after the other: to hit, then damage. Regular and extra damage are one throw. A versatile weapon's two-handed alternative, conditional damage and healing are throws of their own.
  - Where our dice language cannot say Beyond20's formula (reroll 1s, minimum 10), the dice thrown are the ones that count, the total is Beyond20's, and Beyond20's own formula is kept with the line.
- **Which pawn:** the pawn whose sheet link is the same D&D Beyond character (the id in the link: `/characters/12345678`, `/profile/…/characters/…`, `ddb.ac/characters/…`, a monster's `/monsters/16907-…`). Else a pawn of yours with the character's name (the GM: also the kind, so "Goblin" finds the goblins). Else your main pawn. Matched any way but the sheet, or not at all, you are offered the one-click link (a conditional button that also goes down into the chat).
- **Attacks use the attacker's target** (below): "Thorin attacks Goblin 1: d20+5 = 13". With no target: "Thorin rolls Longsword: d20+5 = 19".
- **Initiative** sets that pawn's number in the turn order that is running (docs/PAWNS.md "Turn order and initiative"). A player sets only her own pawn's. With no fight running, a note says so and nothing changes.
- **HP** becomes damage on the mapped pawn: damage = max − current, never below 0 (TW counts damage up from 0; docs/PAWNS.md "Damage, not HP"). Temporary hit points are ignored.
- **Conditions** follow D&D Beyond for D&D Beyond's own words; any other word on the pawn (dead, concentrating, a typed one) is left alone (2026-10-29). Words TW has a look for become TW's word; **deafened, petrified and any word TW does not know arrive as text labels** on the pawn; **exhaustion arrives with its level** ("exhaustion 2", the base's drain ring; 0 takes it off). docs/PAWNS.md "Conditions on the table".
- **Whispered rolls** (Beyond20's whisper setting; on by default for monsters) never go on the table. A player's goes to the GM as a whisper; the GM's stays with the GM (a note). A roll for a pawn hidden from the players is treated the same way. "Hide names" rolls go on the table as "Attack", "Damage" or "A roll".
- **UpdateCombat** (D&D Beyond's encounter tracker) is **ignored for now**. TW's turn order is the GM's.

## The Attack button (always there; Harry 2026-10-29)
On the ring of **every pawn you act for** (your own; the GM: any), with Beyond20 or without it. Crossed swords, beside Damage.
- **Its list is the pawn's saved attacks:** `attacks: [{ name, hit, dmg }]` on the pawn, e.g. `{ name: "Longsword", hit: "+5", dmg: "1d8+3" }`. The last used is first. Everyone at the table sees them and they last across visits.
  - Eight at most. Names (40 characters) and formulas only, never a description (`attacksProblem` in core/pawn.js; the relay refuses anything else).
  - Absent when empty. Set with `token.set` by the owner or the GM, over GET too: the AI seats' card has the line.
- **Where they come from:**
  - **Beyond20:** an attack or spell attack rolled on a LINKED sheet (the pawn matched by its sheet link) is saved by name. A fresh visit, or another seat, finds the list already there.
  - **No engine:** **"+ Add attack"** opens a small card at the button (name, to hit, damage). **"Edit attacks"** lists them with Edit and Remove.
  - **An AI seat:** `do?cmd=token.set&id=PAWN_ID&attacks=[{"name":"Longsword","hit":"+5","dmg":"1d8+3"}]` (`attacks=[]` clears).
- **Picking one** rolls **TW's own dice** (crypto, like any roll here) at the pawn's **target**. With no target it asks for one click on a pawn, and that pawn becomes the target. It rolls to hit, then the damage:
  - "Thorin attacks Goblin 1: d20+5 = 17"
  - "Thorin: Longsword damage on Goblin 1: d8+3 = 7"
- **Empty:** a linked pawn says **"Roll an attack on your D&D Beyond sheet and it appears here"**, beside "+ Add attack". An unlinked pawn shows "+ Add attack" alone.
- **Why it cannot ask D&D Beyond to roll.** Beyond20 is one way: D&D Beyond to the VTT. A page can send Beyond20 a roll (`Beyond20_SendMessage`), but Beyond20's background script forwards it only to VTT tabs (Roll20, Foundry, custom domains), never to a D&D Beyond tab. It would come back to our own tab, rolled by Beyond20's renderer with `Math.random`, and echo into any other VTT the player has open.
- **No AC is compared.** TW knows no rules. A later rules-engine seat will do that.

## A pawn's target (Harry 2026-10-29)
One shared primitive: who a pawn is aiming at. Stored on the attacker's pawn, `target: <pawn id>` (`token.set target=…`; empty clears; docs/NETCODE.md). Its owner or the GM sets it. Everyone sees it.
- **Set:** the **Target** button (a pawn inside a red reticle) on the ring of the pawn to aim at. It aims your pawn: the last of yours you selected, else your main pawn. Or **T** with the pointer over a pawn. Pressing it again ("Untarget") takes it off.
- **Clear:** **T** over empty ground, or **Esc** when nothing else is open.
- **Seen:** a reticle (a generated picture: ring, inward pointers, corner brackets; `engine/client/data/icons/target-reticle.png`, git-ignored like every picture, brief in experiments/2026-10-29-beyond20/) on the target's floor round its base, in the attacker's seat colour (the GM's pawns: red), for every seat that can see both pawns. A faint line runs from the attacker to the target while either of them is selected.
- **Rules:** never itself; a missing pawn is refused. A pawn hidden from the players may be targeted only by a pawn that is hidden too. No range, AC or line of sight.
- **AI seats:** `state` and `/scene` list each pawn's `target` and `targetName`. The rules card says that a player's "attack" means their pawn's target.

## What crosses, what is never stored, and why
Wizards of the Coast's paid content (spell text, feature and item descriptions) must never be stored in TW (Harry's decision). So:
- **Crosses:** a linked pawn's saved attacks (name, to hit, damage dice: see the Attack button); the character's name, the roll's name ("Longsword", "Stealth", "Fire Bolt"), its type (skill, attack, initiative, …), to hit / damage / healing, the formulas, every die's number, the total, crit, fumble and advantage, damage types ("Slashing"), and for HP and conditions the numbers and condition words. The sheet link is stored on the pawn only when you click Link.
- **Never stored, never sent:** descriptions, spell and feature text, Beyond20's rendered html, `roll_info`, `source` and `attributes`, roll-table contents, a damage "message" (Beyond20's prose damage entries), and the character's feature, trait and action lists.
- **How it is enforced:**
  - **In the browser:** core/beyond20.js copies only named fields, each cut short. Nothing else of Beyond20's message is ever read into a command.
  - **At the relay:** `dice.roll` keeps only its declared arguments, so a stray `description` is dropped. Its one new argument, `info`, is a closed list of short fields (`INFO` in core/beyond20.js): any other key, a long string or markup is refused, so a hand-made command cannot store text through it either.
- **Tests:**
  - `engine/test/beyond20.test.mjs` (in `npm test`): conversion of Beyond20-shaped messages, the relay refusing `info.description`, and the journal and snapshot on disk scanned for the description text.
  - `engine/test/browser_beyond20.py`: two seats, Beyond20 simulated with the same DOM events it sends. It covers every rule above. It scans both tabs' chat state, their page text, every byte each tab sent and received, and the relay's disk for a planted description string.

## Code
- `engine/core/beyond20.js`: the pure rules (conversion, sheet keys, HP, conditions, `info`).
- `engine/client/surfaces/beyond20.js`: the listener, the mapping, the link offer, saving a linked sheet's attacks.
- `engine/client/surfaces/attacks.js`: the Attack button, its list and its card.
- `engine/client/surfaces/target.js`: the target.
- `engine/client/index.html`: a first script keeps any Beyond20 event that arrives before the game's modules have loaded.
- Lab notes: `experiments/2026-10-29-beyond20/LAB_NOTES.md`.
