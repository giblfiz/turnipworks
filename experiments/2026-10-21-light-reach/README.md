# Light reach in the dark (2026-10-21)

Harry, on dev, Ring Lab design table (`cmp_q2bjx70ajq` / `area_kli7phtcd2`), player pawn Foggybottom (darkvision 15):
"lots of large sections that are clear of FoW that I think should have them. It seems like a flowerbed is a lightsource,
a tiny one-candle lamp is doing like 40 foot circle, and maybe you are giving me vision between light sources and the
pawn, and not just a radius around light sources?"

## What it was

The rule was right: seen = line of sight ∩ (darkvision ∪ lit), each light lit by its own radius-limited visibility
polygon. The reach was the problem. The area has **143 lit lights** (54 candles, 30 lanterns, 15 lamps, 28 chandeliers,
7 torches, 6 fires, 3 glows), and with the old table (bright + dim totals: lantern and every lamp 60 ft, chandelier,
torch, fire 40) almost all the ground in a pawn's line of sight is lit by something. A "between" cell is lit by some other
light, not by the line between pawn and light.

- **The "flowerbed" is the yard's `flowerbed` at (136.2, −10.9).** Four lights reach it, 40–51 ft away, and the light it
  stands in comes from none of them visibly: two `lantern-hanging` in the stable (60 ft), a `lantern-hand` in the privy
  (60 ft) and a `lamp-oil-brass` in a guest room (60 ft then, 45 now), the last two **through the building's windows**.
  Light, like sight, leaves a room through windows and open doorways. So a pool of light in the open yard with a
  flowerbed in the middle and no light source in it: it reads as the flowerbed glowing. With Count dim light off, none
  of them reaches it (`lights.json`).
- **The "tiny one-candle lamp"** is `lamp-oil-brass` (8 in the area) or `lamp-wall-shelf` (5): both were "lanterns", 60 ft.
  Its 40-ft circle is that 60 cut by the room's walls.

## What changed

- A **lamp** row (45 ft, D&D's lamp 15 + 30) for `oil-lamp`, `lamp-oil-brass`, `lamp-wall-bracket`, `lamp-wall-shelf`,
  `rite-sanctuary-lamp`, `mine-lamp-rack` (rule: catalog id contains `lamp`, not `lamp-post` / `lamp-pole`, which stay
  lanterns). The only change to the game with no house look.
- The Fog of war look (tuner, panel "Fog of war look") has **Darkness ▸ Overall light scale** (0.25–1.5), **Count dim
  light** (on: the "Light reach, bright + dim" rows; off: the "Light reach, bright only" rows), and the two groups of
  per-kind sliders (0–120 ft). Bright-only defaults: PHB candle 5, lamp 15, hooded lantern 30, torch 20; guesses fire 20,
  chandelier 20, oven 5, glow 10. "Use in game" makes them the game's (and the relay's within a minute).
- **Dark preview** in the same panel: one light of each kind in a dark field; the sliders move the discs at once.
- **Show light reach** (GM only, this browser): "light reach" in the command bar or Settings ▸ Me.

## The stills (images are not in git; on disk here as .jpg)

`stills.py` copies the dev campaign to a throwaway relay (read-only on dev) and photographs Foggybottom's player view:
`player-{whole,yard}-1-before` (today's table: lamps at 60), `-2-after-default` (lamp 45), `-3-after-bright-only`
(Count dim light off), and the GM's light reach view `gm-reach-{whole,yard}-{1-before,3-after-bright-only}`.
A blind Gemini read: the clear ground in the player's whole view goes ~18% → ~18% → ~4%; in the yard view ~12% → ~2%.

`tuner-dark-preview.jpg`: the tuner's Dark preview (3 × 3: candle, lamp, lantern / torch, pawn, fire / chandelier, oven, glow).

Redo: `tw-slot browser-venv/bin/python experiments/2026-10-21-light-reach/stills.py OUTDIR`.
