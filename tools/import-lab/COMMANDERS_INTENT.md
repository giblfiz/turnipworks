# Import Lab: commander's intent

**One judgment:** when a player brings their own model (a HeroForge mini, a bought dragon STL) and we shrink it in their browser to a small game asset and keep only that, *is what we keep good enough?* And at what size budget does it become good enough?

**Why it exists.** Harry has provisionally agreed to convert imports in the browser and store only the small result. His worry, in his words: "People care a lot about their PC mini or heroic dragon." Before anything is built into the game he needs to see the cost with his own eyes. If he can say "it looks fine at table distance at N triangles", this tool has done its job and N becomes the import pipeline's default.

**Whose capability it bridges.** Harry's eye. I can measure surface error and pixel difference, and I can ask Gemini for a blind read, but none of that is the verdict: the verdict is whether a person who loves their mini would feel short-changed. He cannot read a table of Hausdorff distances and should not have to. The tool turns the trade into one thing he can look at (original left, converted right, one camera) and two buttons.

**The rule the tool is built around.** Props are judged at table distance; close-up defects are notes, not verdicts (Harry's standing rule). So the tool opens at the game's own camera (45° lens, 95 ft out, 52° down), in the game's own lighting, with a 6-ft figure and a 5-ft square for scale. Leaning in and close-up are there for notes.

**Outputs, and who uses them.**
1. **A verdict record** per button press (`reviews/tuner/import_lab.jsonl`, read with `read_verdicts.py`): fine / not good enough, the budget, bake on or off, texture size, view distance, the measured numbers, and his note. Whoever builds the real import path takes the default budget from these.
2. **Measured costs** per budget (triangles, GLB bytes, seconds, surface error) in the readout and in LAB_NOTES.md. These size the storage and the wait a player will sit through.
3. **A working reference** for the conversion itself (`js/pipeline.js`, `unwrap.js`, `bake.js`): weld, simplify, unwrap, bake. The game's importer can lift it.

**Working means:** Harry drops a model he actually cares about, clicks through the budgets at table distance, flips with Space, and presses a button. The records say which budget to ship.

**Delete it when** the game's own importer shows the same side-by-side at import time, or when the budget question is settled and nobody has opened this in a month.
