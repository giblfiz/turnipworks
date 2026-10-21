# The bar's catalog (2026-10-20), and how to redo it

Harry: "a nice thick update for the quickbar catalog" (the command bar at the top). About 620 commits had landed since 2026-10-10 and the bar's words had not kept pace. This folder is the measurement; the change itself is in `engine/client/barwords.js` (the vocabulary), `engine/client/surfaces/bar.js` (the match), `engine/client/commands.js` (typed damage and checks, the two lab commands) and `engine/client/figures.js` (one-slip figure names).

- `inventory.md`: every command (title, synonyms, keys, group, hidden, who sees it, which selections offer it), the catalog, figures, room and building types, each marked findable well / poorly / not, before and after.
- `baseline/` and `after/`: the raw dumps (`inventory.json`, `corpus-results.json`) of origin/main 8bf9a959 and of this branch, same corpus.
- `make_corpus.py`: how the first corpus was written. **The corpus itself is `engine/test/bar-corpus.json`** (one line a case); edit that from now on.
- `inventory.py`: turns two dumps into `inventory.md`.

## Redo it (every couple of weeks, or after a batch of new commands / room types / assets)

1. Measure: `TW_GPU=1 tw-slot python3 engine/test/browser_barcat.py --local --verbose --dump experiments/<date>-bar-catalog/before` (about 3 minutes; it builds a throwaway campaign with a GM and a player seat). It prints hit@1 / hit@3 and every line that misses its top 3.
2. Inventory: `python3 experiments/2026-10-20-bar-catalog/inventory.py experiments/<date>-bar-catalog/before > experiments/<date>-bar-catalog/inventory.md`. Look for commands with no words of their own, new room types and building types, new catalog families, and the **(state)** rows (a command the probed scene never offers: if it should be findable, give the scene that state in `browser_barcat.py`).
3. Grow the corpus with what a GM or player would type for each new thing (plain words, D&D words, a plural, a typo, a verb phrase), in `engine/test/bar-corpus.json`. Players' lines go with `"seat": "player"`; every player line is also checked against `playerDeny` (GM-only rows, room names, the hidden chest).
4. Teach the bar: words go in `engine/client/barwords.js` (COMMAND_WORDS by command id or `prefix*`, CATALOG_WORDS / MATERIAL_WORDS by catalog id, FIGURE_WORDS by figure id). Typed forms with arguments go in the command's `parse` (commands.js). Fix ranking only for a clear bug, and say which in the commit.
5. Run it again with `--dump experiments/<date>-bar-catalog/after`, regenerate `inventory.md` from both dumps, and raise `FLOOR` in `browser_barcat.py` if the new numbers allow.

`--probe '<js>'` evaluates an expression on the GM page after the scene is built (debugging one line: `--probe "tw.figures.search('peasant').slice(0,3)"`).

## The numbers (631 lines; 39 of them a player's)

| | hit@1 | hit@3 | lines missing the top 3 |
|---|---|---|---|
| origin/main 8bf9a959 | 0.685 | 0.758 | 153 |
| after | 0.964 | 1.000 | 0 |

## What changed in the match (bar.js), and why each was a bug

- **The letters-in-order fallback** matched a typed word's letters scattered through any text, descriptions included, so "make it dark" found a marble floor and "torches" a hanging lantern. It is now a near miss on whole words: one slip (two in a word of 7+ letters), same first letter, scored 30 (below every real match). "lanturn", "chappel", "sarcophogus", "goblinn" (figures too).
- **Filler words** ("make it dark", "open the door", "give him a torch", "add stairs") made a line match nothing, because every word had to be found. They now count only where they start a text.
- **Plurals**: "torches", "barrels", "wolves" are also tried singular (figures already did this).
- **A whole line that is a synonym or title** ("trap corridor", "build a building") scores 110, above word-by-word matches.
- **A title that is the query** ("pawns" → Pawns…, "build" → Build…) gets the title bonus too; before, only longer titles beginning with it did. Every query word in the title (not only in the synonyms) is +8 ("crypt" → Build a whole crypt & tomb over the typed-form row).
- **Catalog descriptions** count three quarters ("peasant" is the figure, not the rye loaf "a peasant's …"); a figure found only by a tag, not in its name, steps 20 below a thing whose name it is ("sword", "tree").
- New typed rows: "give to Mira" (the selected pawn), "move / travel to the dungeon" (selection), "7 damage" / "take 10 damage" / "hurt 5" / "heal 5", "roll stealth" / "roll a strength save" / "roll athletics +4" / "roll 1d20+5 stealth" (a d20 with the check as its reason), "make him an orc" (change figure).

## Gaps left

- **"beholder"**: there is no beholder figure (the nearest is the gibbering mouther); a new figure is an asset, not a word.
- **State-dependent commands** (paste, roofs off when they are off, the ground floor when on it, stairs flip, templates, a fight's next turn …) are offered only in their state; the suite's scene does not make most of those states, so they are listed as (state), not graded.
- **"rename" with a pawn selected** ranks Rename this area… first (a title that begins with the word outranks the pawn's own Rename by its synonym); it is still in the top 3. Changing that rule would move "graphics" and other prefix cases, so it was left.
- **Ambiguous words** are scored as either: "dungeon" (the area, the building type, the room), "cellar" (Level down or the room), "forge" (the forge to place, the smithy room, the whole smithy).
