# p-cols generation log

Built-in imagegen, one edit per color, using the three specified parchment style references and the corresponding charcoal source. PNGs copied unmodified; adjacent JSON records each exact prompt, inputs, and original generator output.

| Color | Tries | Alpha corners / center | Visual inspection | Final file |
| --- | ---: | --- | --- | --- |
| Gold | 1 | 0, 0, 0, 0 / 252 | One gold wisp and two sparks; parchment and brass badge | `sources/parchment--pawn.aura.color.gold.png` |
| Silver | 1 | 0, 0, 0, 0 / 252 | One silver wisp and two sparks; dark outline provides contrast | `sources/parchment--pawn.aura.color.silver.png` |
| Blue | 1 | 0, 0, 0, 0 / 252 | One blue wisp and two sparks; parchment and brass badge | `sources/parchment--pawn.aura.color.blue.png` |
| Green | 1 | 0, 0, 0, 0 / 253 | One green wisp and two sparks; parchment and brass badge | `sources/parchment--pawn.aura.color.green.png` |
| Red | 1 | 0, 0, 0, 0 / 253 | One red wisp and two sparks; parchment and brass badge | `sources/parchment--pawn.aura.color.red.png` |
| Violet | 1 | 0, 0, 0, 0 / 252 | One violet wisp and two sparks; parchment and brass badge | `sources/parchment--pawn.aura.color.violet.png` |

All are 1254×1254, with bold forms and no visible text or extra symbols. Full-size visual inspection indicates strong small-size silhouettes, but a 31-pixel rendering was not independently inspected. The compositions are close to their sources, but exact contour and geometry preservation is not guaranteed: the generator repainted them, and the rims are somewhat heavier than the references. No generation calls failed. No pixels were post-processed.
