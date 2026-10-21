# Faction picker — Task B, 2026-10-13

Harry's brief: choose a symbol family at building, room or object level; make faction pieces findable by icon and by plain names. The ring redesign remains paused. Implementation is in the isolated `codex-b` worktree. No PHOENIX changes.

## Contract and decisions

- `faction.set` is one logged operation, resolved against the relay's library. A building keeps `flavor` (also `gen.flavor`), a room override keeps `recipe.flavor`, an object override keeps `flavor`. An absent override inherits. Automatic defaults preserve the original type lists; explicit choices are discovered from any `flavor-*` library SKU.
- The command swaps assets of existing marks only, retaining IDs, placement, orientation, scale, parent, pin and other edits. Deleted pieces remain deleted. An unavailable slot is suppressed with reversible `factionMissing`/`factionWasHidden` metadata, including for the GM, and restored in place when a later choice fills it. Ordinary `banner-wall` pieces are faction marks; freestanding poles remain poles (there is no equivalent faction pole slot).
- The drag offer is the existing conditional-button component with a two-row icon grid, docked under the bar to avoid the building's storey offers. It appears once per type per page session, lasts ten seconds, and takes one additional undo step. No words in its buttons; tooltips and aria labels carry names. Inherited emblem selection is dashed; explicit selection is solid. Ring menus retain their existing geometry.
- Grouping and emblems are metadata; missing icons use a rounded crop of that faction's own sigil. New factions and new slots need no UI code changes. The catalog accepts metadata maps and Task C's generated array schema. A Build → Factions shelf shows all available factions and gaps, with click/drag placement. Directly placing a named faction piece records an explicit object choice.

## Verification record

`engine/test/factions.test.mjs`, `faction-catalog.test.mjs`, `faction-picker.test.mjs` cover state, relay authority, inheritance, one-room-one-faction, discovery and UI construction. `browser_factions.py --local` exercises real room drawing, conditional/ring/shelf gestures, commands, edits, undo/redo, second seat, saving, castle heraldry and cult generation. Browser stills are in `engine/test/shots/factions/` (ignored generated evidence); four/thirteen-faction fixtures are clearly synthetic data, not a claim that thirteen asset families shipped with Task B.

Blind reads: Gemini 2.5 Pro, each still separately, labels hidden, same nave and camera. `blind-a.txt` is sun, `blind-b.txt` spiders, `blind-c.txt` devils. Prompt: “Describe this room; what kind of place is it? Describe the repeated symbols and prominent figures you can actually see. Do not infer from the filename. Distinguish what is visible from guesses.” The test nave includes hand edits deliberately preserved by faction changes; these are not pristine recipe comparisons.

Landing counts, exact golden changes and live versions are recorded below after verification.

Final local and live acceptance: **57/57 browser checks each**, faction core **96**, catalog **5 tests**, picker **15 assertions**. Core suite **697/697**, relay suite **181/181** before the locked landing gate. Four- and thirteen-faction drag-offer stills: `offer-4.png`, `offer-13.png`. The thirteen-faction fixtures use copied sigil assets and nine synthetic IDs; they verify layout/discovery, not new art.

Golden evidence: **1,944 scenes, 145 room types**. The universal classic/v1 fix changes **107 Temple and 41 Cult scenes** (all 4×4; exact IDs/seeds and before/after hashes in `tools/spawn-tuner/test/faction-golden.json`). This intentionally exceeds the brief's Temple-only expectation because the same blind mixing bug affected four Cult room types. No v2 layouts or wall maps change. `--faction-fix` accepts only the recorded hashes. Temple counts: nave 11, cathedral 11, dark cathedral 11, shrine 12, vestry 12, cloister 12, scriptorium 6, infirmary 11, cell 9, belltower 12. Cult: passage 10, sanctum 12, summoning 8, vault 11.

Blind outcomes: Sun motif identified directly; spiderweb identified on the floor, but the spider idol was interpreted as armor; devil idol interpreted as a winged demon/dark deity. These are differences in the judge's descriptions, not proof that every asset silhouette communicates its intended faction.

## Live delivery

Landed code `d16756c4a8c7b99360742b94de020b474ace3b65`, pushed to origin/main after the locked merge gates. Client **20261013062020**, tuner **20261013062010**, relay engine **v2-8c4ba249**. Both normal deployment steps restarted the relay, each after a verified campaign backup. Lock released before live verification. Standard `npm test`: core **697/697**, relay **181/181**, convergence harness **5/5**. Golden gate: **1,944 scenes, zero unaccepted differences, 148 recorded faction fixes**. Asset, SKU and tool-coverage gates passed. Incremental live asset audit: **46,676 paths per host, zero missing**, including 22,996 delivered files; unchanged prior checks were reused from the audit cache.

Live browser run `engine/test/browser_factions.py --page https://turnipworks.net/`: **57/57**, no page errors. Campaign `cmp_t4dksvsuwu` removed by tw_sandbox; live ratings and house look unchanged. Live stills: `engine/test/shots/factions-live/{offer-4,offer-13,shelf,ring-room-inherit,search,blind-a,blind-b,blind-c}.png`. Thirteen uses synthetic data with reused icons to exercise scale; four actual factions were available at Task B deployment. No pods or paid asset generation used ($0).

One screenshot-driven repair happened before landing: model previews were loaded but invisible because the shelf's body-level stacking context covered the canvas in #app. The shelf now shares the preview canvas's parent; face-on flat pictures avoid edge-on banner cards, theme tokens keep labels readable, and the offer sits below the breadcrumb. Explicit checks cover those visibility conditions.
