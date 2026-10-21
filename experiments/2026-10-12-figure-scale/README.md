# Figure scale, 2026-10-12

Harry: "The minis are mostly too big. To scale a hero/guard to a chair correctly I have to make the chair about 150% size." Then: "I'm pretty sure that it's just all figures drawn too large."

## What was measured (in the game, world feet; `measure_game.py`; an inn common room and a guest room)

| thing | measured | a real one |
|---|---|---|
| human fighter (stated 6 ft) | 6.22 ft sole to crest; hips 1.9 ft, chest 1.7 ft front to back | 5.5 to 6 ft; hips about 1.2 ft |
| human guard (stated 6 ft) | 6.77 ft to the helmet's point | |
| townswoman (stated 5.6 ft) | 5.64 ft | |
| base | 4.5 ft across, 0.3 ft thick; feet at 0.3 ft | |
| chair (7 in the room) | 3.0 ft tall (its catalog size exactly); seat at 1.3 ft (1.2 to 1.4); seat 1.5 to 1.9 ft wide | seat 1.5 ft high, 1.5 ft wide |
| small tables (6) | top at 1.9 ft (1.6 to 2.25) | 2.5 ft |
| bar counter | top at 3.0 to 3.4 ft | 3.5 ft |
| door | 6 ft 8 x 3 ft (the kit fills the opening) | 6.7 x 3 ft |
| bed | 6 ft 8 long | 6.5 ft |

Offline, over 39 human heroes and townsfolk (the same files and scale): median height 6.0 ft, hips 1.56 ft, shoulders with arms 2.06 ft. Small folk are 3.0 to 3.1 ft, large creatures their stated 5 to 20 ft: one rule (each figure's own stated height), kept.

**So:** the figures are not taller than stated. They read too big because they are heroic miniatures (about a third wider than a person at the same height), they stand 0.3 ft up on a disc, and the seats and small-table tops beside them are low. Knee to seat, the matching factor is 0.8. By eye it is lower: Harry's "chair at 150 %" is 0.67, and Gemini, blind, asked for 0.6 (bench at 1.00), 0.56 (at 0.80) and 0.6 (at 0.67), and in the game called the people too big before and "about right" close up after.

## What changed
One factor on every figure, `FIGURE_SCALE = 0.67` in `engine/client/figures.js`, a house look (`figures.scale`) set in the tuner's Figure scale bench. The base does not scale. At 0.67 the fighter is 4.2 ft, the townswoman 3.8 ft, an ogre keeps its ratio to them.

## Not changed, for Harry to decide
The prop size rule (largest side to largest side) leaves small tables at 1.9 ft and long tables at 3.4 to 4.5 ft against a catalog 2.5 ft. Fixing that moves every prop.

## Stills (`stills/`)
`before-*` and `after-*`: the game, table camera and close, at a chair, a table and a bed. `bench-{table,close,door}-{1.00,0.80,0.67}.jpg`: the bench.
