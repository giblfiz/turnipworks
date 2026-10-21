# The LLM-friendly GET API, brought up to date (2026-10-20)

Harry: "a nice thick update … for the LLM friendly API". The API (docs/NETCODE.md "LLM participants", "The GET API
brought up to date") is for the weakest chat-window model: no tools, no MCP, no POST, no headers; it reads a pasted
rules card and fetches plain URLs, which wrap the same commands the browser sends. It was last touched 2026-10-15;
about 620 commits had landed since 2026-10-10 (3D dice, darkness, factions, the new room types, templates...).

- `audit.md`: what was missing, what changed, the permission checks, what is still not over GET.
  `audit-before.md` / `audit-after.md`: the generated tables.
- `transcript-1..5.md`, `outcome-2..5.json`: the live trials (below).
- Code: engine/relay/llm.js (reads, conveniences, dice), llm-card.js (the card and help pages), things.js (lights,
  doors, the library), tokens.js (short tokens), core/dice.js (moved from client/dice.js), client/surfaces/dice.js
  (an AI seat's roll thrown by each browser). Tests: engine/test/llm.test.mjs (99 checks, in `npm test`),
  relay.test.mjs and the browser suites' card checks, browser_dice.py G10.

## The live trial

`run_trial.sh N [model] [effort] [tail]` starts a throwaway relay (`trial_relay.mjs`: an inn with a named common room
whose candles are out, and a kitchen), gives `codex exec` (the subscription; never a paid API key) ONLY the rules card
and one ability, `curl -s 'ADDRESS'`, plus the GM's request (`prompt-tail.txt`: look, roll a d20 with a reason, add a
goblin to a room, light a candle, hide a room label as GM; `prompt-tail-more.txt`: darkness, a hidden goblin boss with
darkvision, prone, a chest, 2d6+2 and a skull), then reads the table back with the GM's token (`outcome-N.json`).
The smallest model codex offers was used: gpt-5.6-luna at low effort.

| trial | card | result |
|---|---|---|
| 1 | first short card (12.5k, long tokens) | 4/5. Asked to "hide the common room's label from the players", it **hid the whole room** (entity.flag): the card said labels are GM-only, then "to hide a room itself, use entity.flag", and it took the second sentence. |
| 2 | label line rewritten: "ALREADY hidden ... needs NO command ... Do NOT use entity.flag for it" | 5/5: "The common room's label is already hidden from players; no action was needed." |
| 3 | same, harder request | 5/5, but its first token.create came back "missing or bad seat token": it **miscopied the 190-character token** once, then retried. It also created the boss visible and hid it after (a moment's leak). |
| 4 | short tokens (card 9.3k), `hidden=true` on the add-a-creature line | 5/5, 5 fetches, no miscopy |
| 5 | same, harder request | 5/5, created the boss hidden in one step, no miscopy, read help/light, help/things and help/pawns on its own |

What it got right from the first trial on: scene first, the dice line verbatim with a reason, figures?q=goblin then
`token.create&fig=&room=`, picking a candle's id out of "lights", fresh nonces.

## Redo this periodically

When commands land (check `git log --since=<last time> -- engine/core/commands.js`):
1. `node experiments/2026-10-20-llm-api/audit.mjs > /tmp/audit.md` and compare with `audit-after.md`. A new command
   shows as `no fixture`: add one line to the fixture table `F` in audit.mjs. A row with "AI read shows it: NO" is a
   state an AI cannot see (add it to `scene` / `room` / `state` in relay/llm.js); "explained: NO" is a command the
   card and help pages never name (relay/llm-card.js: a common task on the card only if a weak model needs it often,
   otherwise its topic's help page).
2. A new argument that only the browser can fill (a recording, a solved layout, an asset path) goes in `NOT_FOR_AI`
   in llm-card.js, and, if an AI needs the feature, a convenience in llm.js `friendly` / `act` that fills it on the
   relay (as `object.place&cat=`, `room.reroll`, `dice.roll` do).
3. Every new read or convenience: a permission check in engine/test/llm.test.mjs (the player's advisor must get the
   answer of a thing that does not exist for anything hidden; the narrow chat-only seat must be refused).
4. `engine/test/llm.test.mjs` bounds the GM card at 10,500 characters: if it has to grow, move detail to a help page.
5. A live trial when the card changed: `experiments/2026-10-20-llm-api/run_trial.sh N` (and `... N gpt-5.6-luna low
   experiments/2026-10-20-llm-api/prompt-tail-more.txt`); read `transcript-N.md` for "miscopied" tokens and refusals.
   Save the transcript in the next dated experiments folder.
