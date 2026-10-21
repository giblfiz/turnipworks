# Spawn Tuner: commander's intent

**One judgment:** does a generated room read right (plausible layout, believable sizes, a delightful arrival), and which dial values and layout rules make it so?

**Whose capability it bridges:** Harry's eye and feel. I can't perceive motion, timing or "that hearth is in a dumb place". He can't read 200 placements of JSON. The tool turns sparse input from him (drag a rectangle, roll, lock what's good, nudge a dial, type one note) into data I can act on.

**Outputs, and who uses them downstream:**
1. **An animation preset** (JSON, "Send preset"). This becomes the spec for the real engine's spawn-in and spawn-out.
2. **Readable layouts** ("Send room + note"). Each one carries the room's summary, every placement with its rule and reason, and Harry's note. I use them to fix the layout program's rules.
3. **Performance numbers** (the bench: fps, draw calls, triangles, texture memory, stress ×4, fire lights). These inform instancing, atlases and the 5k/3k runtime tiers.

**Working means:** Harry tunes the arrival by feel and sends a preset. Rooms he flags come back to me as notes plus layout JSON, and the next solver revision fixes them.

**Delete it when** the real engine's builder does all three better. It's a demo reel with knobs, not product code.

---

# The Wall fit bench (wallbench.html, 2026-10-13): commander's intent

**One judgment:** does this wall family stand as one wall (pieces beside each other, storey on storey, door in its posts, a person through the door), and if a piece does not, what correction or mark makes it so? Harry's words: "the occasional janky wall is still out there (that look great in isolation, just has scale issues!) and when one comes up it is amazing how much damage it does to the look."

**Whose capability it bridges:** Harry's eye can tell a wall is wrong at a glance but cannot read a gap of 1.3 inches or tell which of forty pieces caused it, and I cannot see the wall at all. The bench measures every joint (the smart layer, in inches, red on the specimen), and Harry judges, corrects and approves, one family at a time.

**Outputs, downstream:** (1) per-piece corrections (scale X/Y/Z, offset, yaw), applied by the wall code in the tuner and the game once he presses "Use in game" (house look `wallfit`); (2) marks ("doesn't fit" plus a note) that come back to me as the list of meshes to regenerate; (3) approvals, so a family is done and the queue shows what is left.

**Working means:** he goes through all 17 families in one sitting with the keyboard; nothing in any existing layout moves until he applies a correction.

**Delete it when** every family is approved and a new wall batch is measured by the asset pipeline before it reaches him.
