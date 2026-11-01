# Beyond20 intake — lab notes (2026-10-29)

Branch `beyond20`, worktree <repo> Harry approved the feature 2026-10-29; dev only.

## 2026-10-29 04:36 — reading
- Beyond20 (clone in scratch): on a custom domain its generic-site content script dispatches DOM CustomEvents with an array
  detail: Loaded [settings], NewSettings [settings, url], RenderedRoll [msg], UpdateHP [req, name, hp, max, temp],
  UpdateConditions [req, name, conditions, exhaustion], UpdateCombat [req, combat, settings] (src/common/utils.js
  forwardMessageToDOM). A plain `roll` is rendered by Beyond20's own RollRenderer in OUR tab and comes as RenderedRoll
  with rendered:"fallback" after a 500 ms bounce. Rolls are Roll.toJSON(): {formula, parts:[DiceRoll|'+'|'-'|number],
  critical-success, critical-failure, discarded, type, total}; DiceRoll {amount, faces, modifiers, rolls:[{roll, discarded}]}.
  Advantage = two whole Roll objects, one discarded.
- Can Beyond20 be ASKED to roll? Beyond20_SendMessage(roll) goes to background.js forwardedActions, which sends to Roll20,
  FVTT and custom tabs only (never a D&D Beyond tab). So it would come back to our own tab, rolled by Beyond20's renderer
  with Math.random, and echo into the player's other VTT tabs. D&D Beyond cannot be asked. => the Attack button rolls TW's
  own dice (crypto) and says so.
- TW dice already land on given numbers: dice.roll carries rolls + an optional recorded throw; every seat turns each die's
  NUMBERING so the top reads the committed value (docs/NETCODE.md "Determinism where it pays"). So "forced faces" = pass
  Beyond20's per-die values as `rolls`; no new dice capability needed.
- parseArgs keeps only declared args, so a stray top-level `description` never reaches the journal already. New optional
  dice.roll arg `info` (whitelisted keys, short strings) carries name/kind/flags; the relay refuses any other key.

## 2026-10-29 05:35 — built, suites green locally
- core/beyond20.js (pure), surfaces/beyond20.js (listener, mapping, link offer, Attack), dice.roll `info` (closed key list).
- Forced faces needed no new dice code: app.roll { given } passes Beyond20's per-die values as `rolls`.
- Harry's addition mid-task: a shared target (token.set `target`), surfaces/target.js: ring "Target", T over a pawn, T over
  ground / Esc clears; reticle = the vendored lucide crosshair icon (not hand-drawn) laid on the floor, in seat colour; faint
  line while either end is selected. GET state/scene list target + targetName; the card has a TARGET line.
- beyond20.test.mjs 46/46; npm test green; browser_beyond20.py --local 24/24.

## 2026-10-29 06:40 — the reticle
- First reticle = the vendored lucide crosshair icon drawn into a texture. Gemini (table distance): "It does not clearly read
  as a target reticle ... reads much more like a standard unit-selection circle or aura indicator".
- Replaced with a Codex image_gen picture (reticle-brief.md; white on black -> alpha in PIL; 512 px), kept where pictures
  live: engine/client/data/icons/target-reticle.png (git-ignored; the main checkout's asset dir). Gemini after: "It reads
  clearly as a target reticle rather than a generic selection circle ... does not clip into or z-fight with the floor".
  Its note: the glowing look is modern against the rustic tavern, and it is large for the pawn (1.45 x the base).
- First codex run made nothing: it needs `-s workspace-write` (and `env -u OPENAI_API_KEY`).

## 2026-10-29 06:55 — landed on dev
- main d44ae5cf, deployed client 20261029064526, release candidate 20261029-064535-d44ae5cf (dev only; prod untouched).
- Before landing (local): browser_beyond20 24/24, npm test green (beyond20 46/46), browser_build 98/98, browser_storeys
  43/43, browser_dice 10/10, browser_turns 55/55, browser_pawnring 108/108, browser_chatline 34/34. tests/browser_ring_parity
  241/244: the 3 failures are roof.style.flat / building.roof.flat (the audit predates roofs-flat dd2e17cc) and a building's
  thing.lock under a SPAN. Neither touches pawns.
- On dev: browser_beyond20 --page http://127.0.0.1:8180/ 24/24.
- Left: the generated reticle is a glowing HUD look that Gemini found modern against the rustic tavern (a painted-set pass);
  no painted (charcoal) ring icons for pawn.attack / pawn.target (line icons stand in); UpdateCombat ignored by design;
  exhaustion/paralyzed/petrified/deafened/incapacitated have no TW condition.

## 2026-10-29 07:30 — Attack always there (branch attacks)
- Harry read "linked AND Beyond20 reported this visit" as "no Attack without the engine". Now: Attack on every pawn one acts
  for; its list = the pawn's saved `attacks: [{name, hit, dmg}]` (token.set; 8 max, names + dice only, relay-checked).
  Beyond20 attacks from a LINKED sheet upsert by name (so a fresh visit / another seat has them); "+ Add attack" card
  (ring.panel, the Sheet card's look) with Edit / Remove; picking one = to hit at the target (or click to target), then damage.
- The surface moved out of beyond20.js into surfaces/attacks.js. Test gotcha: the damage roll's big announce sits mid-screen
  and eats the pointer for a following hover; the suite now waits for it to go.
- beyond20.test.mjs 49/49; browser_beyond20 29/29 local.
- Gemini on the "+ Add attack" card: "Very clear. The labels (Name, To hit, Damage) combined with ... placeholders (Longsword,
  +5, 1d8+3) make expected input unambiguous ... not clipped by any screen edge ... does not obstruct the selected token".
  Its complaints: the crumbs pill sits over the card's title (ring cards are under the HUD band by design: docs/UI.md
  z-order; the Sheet card does the same) and "Mira: attacks" read as "Mira attacks" -> title is now "Mira's attacks".
- Landed: main 0bc9e87c, client 20261029083411, candidate 20261029-083449-0bc9e87c (dev only). browser_beyond20 29/29 local
  and on dev; npm test green; storeys 43/43, dice 10/10, pawnring 108/108 (updated: Attack on the closed ring), turns 55/55,
  chatline 34/34. browser_build 95/98 (library drag/click/paste) and browser_gamedice 9/17 under load average 40-50 from
  the other agents; a baseline worktree of main crashed browser_build and got gamedice 10/17 at the same time, so these
  look like load, not this branch (nothing here touches the library or the skinned dice). Re-run when the box is quiet.
- New ignored asset dir since gamedice: tools/spawn-tuner/assets/dice/ (symlink it into worktrees).
