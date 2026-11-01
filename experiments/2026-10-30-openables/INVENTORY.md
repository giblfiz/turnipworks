# Openables census (2026-10-30)

Harry, 2026-10-30: "door opening and closing... I think we might really need to go over *all* the opens and closes,
because a lot of them don't show state." Every catalog kind that opens (aff `open`), plus every kind with an "-open"
twin or a hatch that should, one SKU each variant, 85 SKUs in 47 kinds. Each was shot shut and open on an empty table
at play distance (dist 34 ft, pitch 52°, a 300-px crop; doors, gates and the portcullis between two wall sections, as
they stand in the game: `shots.py`), and Gemini (agy-run) read every crop BLIND, random names, "open or shut?"
(`judge.py`). Raw scores: `scores/`. Generated doors in rooms use the `--leaf` SKUs, so those rows are the doors
players meet most.

**Counts.** Gemini's blind open/shut accuracy: **74.7% before (127/170) → 84.1% after (143/170)**. Kinds that showed no
state (not openable from the UI, or Gemini could not read both states of every SKU): **31 of 47 before → 16 after**.
Openable from the UI: 37 kinds → 42. "Before" forced `object.open` even on kinds the UI could not open, and a kind with
no open look gives two identical crops, so its "right" reads before (door-glazed, wall-secret-door) are coin flips.

**Update, 2026-10-30 evening (experiments/2026-10-30-openmesh):** the 24 meshes proposed below were generated (Codex plates
edited from each partner's renders, TRELLIS.2 on RunPod, two re-meshes on fal; $1.83), and the swap code now sizes a twin by
the sides its opening leaves alone (framed doors and trapdoors get their own depth, hatch tiles sit on the floor). The
same blind read: **143/170 = 84.1% -> 167/170 = 98.2%**; kinds showing no state 16 -> 2 (door-reinforced, by its swinging
leaf's open crop; wall-window-small, by the castle-rough slit's open crop and the half-timber's shut crop). The castle-rough
slit was treated as a shut-reads-open window: a new shut model (planks in the slit), the old slit its open twin. Table:
experiments/2026-10-30-openmesh/table-final.md.

**How each opens now** (`engine/client/openlook.js`; what opens: `engine/core/openables.js`):
- **Swing, flat to the wall:** every door leaf (the `--leaf` SKUs of plank, reinforced, panelled, glazed, tower, crypt,
  carved face, rune-sealed, secret bookcase, cage bars), the gates (fence, crypt iron, stall gates, stall and privy
  doors), the sealed tomb door, the secret wall: 175° on the left edge, coming to rest just off the wall's face beside
  the doorway. At 100° (the first try, and the cage door's old hinge) a leaf stood across a 5-ft hallway and the
  first-person walker went through it (the FPV agent's report; Gemini on the fix, first person and map: OK).
- **A pair parting, each leaf to its own side:** the grand double door, the timber double gate, the rough-timber barn
  door, and every generated double door (they hang a grand double-door leaf).
- **Slide up:** the portcullis, 80% of its height (it was a swap to the raised twin).
- **Swap to its own variant's twin:** chests, coffins, sarcophagi, cabinets, wardrobes, cupboards, desk, sideboard,
  strongbox, footlocker, iron maiden, salt box, roof hatch, small windows, and the frame-and-door SKUs of the plank,
  reinforced and stone barn doors. Before, the swap took the twin's FIRST SKU: a fine wardrobe opened as a common
  one, a castle window as a dressed-stone one, a generated plank leaf as a stone door frame.
- **Animated** (0.65 s ease; a swap pops 8% over 0.3 s, as the 2026-10-02 pilot's), at once with reduce motion or Low
  graphics; a load or a replayed journal shows the end pose. The shut place stays clickable (an unseen box), so a click
  in an open doorway still shuts it, on the map and in first person.
- **Ring:** `thing.open` was already a toggle (Open / Close, and open it wears the door-closed state mark beside the
  painted chest); now checked for every kind on a player's ring. The painted set has ONE picture for Open/Close.

**Still no visible state (16 kinds), and what would fix each:**
| kind | why | fix |
|---|---|---|
| cage-sacrifice, casket-ornate, rural-tack-trunk, trunk-travel (×2) | no open model | generated open twins (5) |
| floor-trapdoor (×2), oubliette-hatch | no open model; the hatch is part of a floor tile (no clean cut) so they are not openable | generated open twins (3) |
| wall-window-small: temple-stone, tower-stone, castle-rough | no open twin in that stone (they stay shut-looking rather than turn into another wall) | generated open twins (3) |
| wall-window-small: fieldstone, noble-panel, rough-timber, rough-timber--s2 | the SHUT model already shows open shutters | generated shut models (4) |
| chest-treasure, iron-maiden | the shut model reads open (gold spilling out; the maiden's front) | generated shut models (2) |
| bread-oven, smith-farrier-box, rural-grooming-box | the shut model reads open, so they stay not-openable (`SHUT_LOOKS_OPEN`) | generated shut models (3) |
| salt-box, sideboard; door-plank / door-reinforced frame SKUs (dressed-stone, rough-timber) | the open twin reads shut at table distance | better open twins (4); the leaf SKUs (what rooms hang) are fine |

**Proposal: 24 generated meshes** (plates from Codex image_gen, free; meshes on the RunPod TRELLIS worker, ~$0.35 for
the batch at the castle/crypt run's $0.013 a mesh, or ~$7 on fal TRELLIS.2 at ~$0.30 each). Not done in this pass; no
fal spend. Also not in scope: barrels, sacks and books have no open state (the "-open" sacks and book are things of
their own), and windows the rooms generate are wall pieces, not openable.

## The table
47 kinds; opened in the UI before 37, after 42; showing no state (not openable, or Gemini could not read both states of every SKU) before 31, after 16

| kind | SKUs | Open in the UI | how it opens (before → after) | SKUs Gemini read right shut AND open (before → after) | shows its state |
|---|---|---|---|---|---|
| bread-oven | 1 | **no** → no | swap (any variant) → none | 0/1 → 0/1 | **no** → **no** |
| cabinet-china | 1 | yes → yes | swap (any variant) → swap (own variant) | 1/1 → 1/1 | yes → yes |
| cage-sacrifice | 1 | yes → yes | none → none | 0/1 → 0/1 | **no** → **no** |
| casket-ornate | 1 | yes → yes | none → none | 0/1 → 0/1 | **no** → **no** |
| chest-ironbound | 1 | yes → yes | swap (any variant) → swap (own variant) | 1/1 → 1/1 | yes → yes |
| chest-plain | 4 | yes → yes | swap (any variant) → swap (own variant) | 4/4 → 4/4 | yes → yes |
| chest-treasure | 1 | yes → yes | swap (any variant) → swap (own variant) | 0/1 → 0/1 | **no** → **no** |
| coffin | 2 | yes → yes | swap (any variant) → swap (own variant) | 2/2 → 2/2 | yes → yes |
| crypt-gate-iron | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| cupboard | 3 | **no** → yes | swap (any variant) → swap (own variant) | 3/3 → 3/3 | **no** → yes |
| desk-bureau | 1 | yes → yes | swap (any variant) → swap (own variant) | 1/1 → 1/1 | yes → yes |
| door-barn-double | 2 | yes → yes | swap (any variant) → pair, each flat to its wall/swap (own variant) | 2/2 → 2/2 | yes → yes |
| door-cell-bars | 1 | yes → yes | swing → swing flat to the wall | 1/1 → 1/1 | yes → yes |
| door-crypt | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| door-double-grand | 4 | yes → yes | none → pair, each flat to its wall | 0/4 → 4/4 | **no** → yes |
| door-face-carved | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| door-glazed | 1 | yes → yes | none → swing flat to the wall | 1/1 → 1/1 | yes → yes |
| door-panelled | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| door-plank | 3 | yes → yes | swap (any variant) → swap (own variant)/swing flat to the wall | 0/3 → 2/3 | **no** → **no** |
| door-reinforced | 3 | yes → yes | swap (any variant) → swap (own variant)/swing flat to the wall | 3/3 → 2/3 | yes → **no** |
| door-rune-sealed | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| door-secret-bookcase | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| door-tower | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| floor-trapdoor | 2 | **no** → no | none → none | 0/2 → 0/2 | **no** → **no** |
| gate-double-timber | 1 | yes → yes | none → pair, each flat to its wall | 0/1 → 1/1 | **no** → yes |
| gate-fence | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| iron-maiden | 1 | **no** → yes | swap (any variant) → swap (own variant) | 1/1 → 0/1 | **no** → **no** |
| linen-chest | 1 | yes → yes | swap (any variant) → swap (own variant) | 1/1 → 1/1 | yes → yes |
| mil-footlocker | 1 | yes → yes | swap (any variant) → swap (own variant) | 1/1 → 1/1 | yes → yes |
| oubliette-hatch | 1 | **no** → no | none → none | 0/1 → 0/1 | **no** → **no** |
| portcullis | 1 | yes → yes | swap (any variant) → slide up | 1/1 → 1/1 | yes → yes |
| privy-stall-door | 2 | yes → yes | none → swing flat to the wall | 0/2 → 2/2 | **no** → yes |
| roof-hatch | 1 | yes → yes | swap (any variant) → swap (own variant) | 1/1 → 1/1 | yes → yes |
| rural-grooming-box | 1 | **no** → no | swap (any variant) → none | 0/1 → 0/1 | **no** → **no** |
| rural-tack-trunk | 1 | yes → yes | none → none | 0/1 → 0/1 | **no** → **no** |
| salt-box | 1 | **no** → yes | swap (any variant) → swap (own variant) | 1/1 → 0/1 | **no** → **no** |
| sarcophagus | 3 | yes → yes | swap (any variant) → swap (own variant) | 3/3 → 3/3 | yes → yes |
| sideboard | 1 | yes → yes | swap (any variant) → swap (own variant) | 0/1 → 0/1 | **no** → **no** |
| smith-farrier-box | 1 | **no** → no | swap (any variant) → none | 0/1 → 0/1 | **no** → **no** |
| stable-stall-door | 2 | yes → yes | none → swing flat to the wall | 0/2 → 2/2 | **no** → yes |
| stable-stall-gate | 3 | yes → yes | none → swing flat to the wall | 0/3 → 3/3 | **no** → yes |
| strongbox | 1 | yes → yes | swap (any variant) → swap (own variant) | 1/1 → 1/1 | yes → yes |
| tomb-door-sealed | 1 | yes → yes | none → swing flat to the wall | 0/1 → 1/1 | **no** → yes |
| trunk-travel | 2 | yes → yes | none → none | 0/2 → 0/2 | **no** → **no** |
| wall-secret-door | 1 | yes → yes | none → swing flat to the wall | 1/1 → 1/1 | yes → yes |
| wall-window-small | 12 | **no** → yes | swap (any variant) → none/swap (own variant) | 7/12 → 4/12 | **no** → **no** |
| wardrobe | 6 | **no** → yes | swap (any variant) → swap (own variant) | 6/6 → 6/6 | **no** → yes |
