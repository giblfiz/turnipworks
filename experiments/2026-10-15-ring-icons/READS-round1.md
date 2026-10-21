# Blind reads at 31 px

Model: `gemini-3.1-pro-preview`. Each image is 31 px on a 67 px `#1c1f24` ground.
The model sees only `candidate.png` and the neutral prompt. Reads are evidence, not acceptance.

## charcoal / edit.rotate

Intended: An upright ochre wooden crate with ONE thick ivory horizontal elliptical arrow circling its base. Exactly one arrowhead.. Actions: edit.rotate, room.rotate.

Gate state: **accepted**. Blind 31px read names the intended action with high confidence.

Visible objects and marks: A 3D wooden crate with a curved white arrow wrapping around its base, indicating a turning motion.

Action interpretation: Rotate object
Confidence: High

Evidence: `reads/charcoal/edit.rotate/549ef2e88bbe3d6d`.

## charcoal / edit.rotate--alt1

Intended: An upright block on a round turntable, with one horizontal curved arrow.. Actions: edit.rotate, room.rotate.

Gate state: **accepted**. Blind 31px read names the intended action with high confidence.

Visible objects: A 3D rectangular block standing upright on a circular base, with a curved teal arrow wrapping horizontally around its vertical axis.

Action: Rotate object.
Confidence: High.

Evidence: `reads/charcoal/edit.rotate--alt1/a9b93a67a8b237eb`.

## parchment / edit.rotate

Intended: An upright ochre wooden crate with ONE thick ivory horizontal elliptical arrow circling its base. Exactly one arrowhead.. Actions: edit.rotate, room.rotate.

Gate state: **accepted**. Blind 31px read names the intended action with high confidence.

Visible objects and marks: A wooden crate with a curved arrow wrapping around its base, set within a circular button.
Action interpretation: Rotate object
Confidence: High

Evidence: `reads/parchment/edit.rotate/c714012cae97d216`.

## charcoal / edit.resize

Intended: A small solid ochre crate anchored at the lower left inside a much larger translucent teal ghost crate. Exactly ONE thick ivory diagonal arrow pointing up and right.. Actions: edit.resize.

Gate state: **accepted**. Blind 31px read names the intended action with high confidence.

Visible objects: A small solid golden cube with a white arrow pointing diagonally upwards and rightwards towards a larger translucent blue cube.

Action: Scale / Resize object.
Confidence: High.

Alternative: Move object into a container or volume (if the translucent box represents a specific zone rather than a bounding box).

Evidence: `reads/charcoal/edit.resize/ad80b7bd12cf0496`.

## parchment / edit.resize

Intended: A small solid ochre crate anchored at the lower left inside a much larger translucent teal ghost crate. Exactly ONE thick ivory diagonal arrow pointing up and right.. Actions: edit.resize.

Gate state: **needs-review**. 

**Visible objects and marks:** A circular button containing a small, solid brown cube in the lower left, a larger, translucent blue cube, and a white arrow pointing diagonally from the small cube into the center/upper-right of the large cube.

**Action interpretation:** Scale / Resize object (specifically, enlarge).
**Confidence:** High.

**Plausible alternative:** If not scaling, it could mean "Place inside container/volume," interpreting the blue box as a designated 3D zone rather than a size reference.

Evidence: `reads/parchment/edit.resize/bd81ec44f7a8d1c1`.

## charcoal / room.reroll

Intended: Two chunky ivory dice, black broad pips, one slightly above the other.. Actions: room.reroll, roof.reroll, building.reroll.

Gate state: **learned**. Two dice recognized correctly. Re-generating a room/roof/building rather than rolling game dice is a learned context; settled Harry-selected metaphor retained.

Visible objects and marks: Two 3D-style, light-colored six-sided dice with dark pips inside a dark circular border.
Action interpretation: Roll dice (or open the dice rolling menu)
Confidence: High

Evidence: `reads/charcoal/room.reroll/a60ba15f875e84fd`.

## parchment / room.reroll

Intended: Two chunky ivory dice, black broad pips, one slightly above the other.. Actions: room.reroll, roof.reroll, building.reroll.

Gate state: **needs-review**. 

A circular golden button displaying two dark six-sided dice.
Action: Roll dice / Open dice roller.
Confidence: High.

Evidence: `reads/parchment/room.reroll/1ab8b77a999b6ef4`.

## charcoal / thing.replace

Intended: Two separate blocks, one ochre and one teal, with two ivory exchange arrows above and below them pointing in opposite directions. No dice, no pips.. Actions: thing.replace.

Gate state: **accepted**. Blind 31px read names the intended action with high confidence.

**Description:** A circular icon containing two 3D cubes (one orange, one teal) surrounded by two curved arrows pointing in opposite directions to form a cycle.

**Action:** Swap objects / Exchange
**Confidence:** High

Evidence: `reads/charcoal/thing.replace/92fcc17b84a1f3c9`.

## parchment / thing.replace

Intended: Two separate blocks, one ochre and one teal, with two ivory exchange arrows above and below them pointing in opposite directions. No dice, no pips.. Actions: thing.replace.

Gate state: **accepted**. Blind read names swap/exchange, high confidence.

**Visible objects and marks:** A circular button displaying an orange 3D cube and a teal 3D cube, with two curved dark arrows forming a cycle between them.

**Action interpretation:** Swap or exchange objects.
**Confidence:** High.

**Ambiguity:** While the "exchange" mechanic is clear, the specific targets are context-dependent. A plausible alternative in a board game setting is "Trade/Convert resources".

Evidence: `reads/parchment/thing.replace/28e8e72c4dc68973`.

## charcoal / thing.tilt

Intended: An ochre wooden crate visibly tipped forty-five degrees onto its corner, with ONE thick ivory VERTICAL curved arrow arching over its top toward its right side. Exactly one arrowhead.. Actions: thing.tilt.

Gate state: **accepted**. Tipped crate and tumbling arrow recognized; broad first answer Rotate, then specifically Flip/Roll. Axis-specific title still helps.

**Description:** A circular icon displaying a tilted 3D wooden crate with a curved white arrow wrapping over its top and pointing downwards, suggesting a tumbling motion.

**Action:** Rotate object
**Confidence:** High

**Ambiguity/Alternative:** The specific tumbling motion of the arrow could also specifically mean "Flip object" or "Roll object" (if the virtual tabletop uses physics for standard props).

Evidence: `reads/charcoal/thing.tilt/b5533c1374a6f1d5`.

## parchment / thing.tilt

Intended: An ochre wooden crate visibly tipped forty-five degrees onto its corner, with ONE thick ivory VERTICAL curved arrow arching over its top toward its right side. Exactly one arrowhead.. Actions: thing.tilt.

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/thing.tilt/9ebff55b612a24dd`.

## charcoal / pawn.damage

Intended: A vivid red heart visibly WOUNDED by a deep jagged diagonal black gash separating its two halves; a small pointed red shard peels away at the lower end. The gash is dark negative space, never a white stripe or a bandage. The heart is slashed, damaged, not healing.. Actions: pawn.damage.

Gate state: **not-read**. 

Pending.

Evidence: `reads/charcoal/pawn.damage/c83386404940fc76`.

## charcoal / pawn.damage--alt1

Intended: A battered blue steel shield visibly split by a huge sharp red impact burst across its center. The jagged red burst occupies more than half the shield, with one deep dark crack radiating through the blue shield. Strong visual hit and damage, not a pristine defense emblem.. Actions: pawn.damage.

Gate state: **needs-review**. 

**Description:** A blue shield with a silver border, cracked down the middle with a jagged red impact burst emanating from the break, set within a dark circular button.

**Action:** Apply "Sunder Armor" or "Vulnerable" status (reduce defense).
**Confidence:** High. 

**Ambiguity/Alternative:** While the visual metaphor for lowered defense is clear, the exact mechanical name varies by game system. A plausible alternative action is "Remove Shield buff".

Evidence: `reads/charcoal/pawn.damage--alt1/b0f2e1564db88168`.

## parchment / pawn.damage

Intended: A vivid red heart with a wide diagonal ivory slash cutting through it.. Actions: pawn.damage.

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/pawn.damage/151d91f65693ed32`.

## charcoal / thing.hide

Intended: A large ivory eye with a thick red diagonal slash.. Actions: thing.hide, roof.hide.

Gate state: **accepted**. Hide / toggle visibility to players, high confidence.

**Visible objects and marks:** A stylized eye icon enclosed in a dark circular border, crossed out by a thick red diagonal line.

**Action interpretation:** Hide / Toggle visibility (make invisible to players).
**Confidence:** High.

Evidence: `reads/charcoal/thing.hide/6e4942beea597919`.

## charcoal / thing.hide--alt1

Intended: A heavy teal curtain being drawn across a small ivory eye.. Actions: thing.hide, roof.hide.

Gate state: **accepted**. Reveal hidden elements, high confidence; suitable for reveal direction of this toggle.

**Description:** A hand pulling aside a teal curtain to reveal a single eye looking out, enclosed in a circular border.

**Action:** Reveal hidden elements (e.g., clear Fog of War, unhide tokens).
**Confidence:** High

**Ambiguity/Alternative:** While "reveal" is the primary metaphor, it could specifically mean **Toggle Game Master (GM) View** (allowing the GM to see hidden things "behind the curtain" without revealing them to players).

Evidence: `reads/charcoal/thing.hide--alt1/4c5ecc833fbbf2dd`.

## parchment / thing.hide

Intended: A large ivory eye with a thick red diagonal slash.. Actions: thing.hide, roof.hide.

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/thing.hide/20d7bf3b7afa8cc6`.

## charcoal / thing.lock

Intended: One stout iron padlock, brass keyhole plate, closed shackle.. Actions: thing.lock.

Gate state: **accepted**. Blind 31px read names the intended action with high confidence.

Visible objects and marks: A closed padlock icon with a grey metallic body and shackle, featuring a gold-colored shield-shaped keyhole plate in the center, enclosed within a subtle circular border.

Action interpretation: Lock (e.g., lock a token's position, lock an object, or lock a layer to prevent editing).
Confidence: High.

Evidence: `reads/charcoal/thing.lock/5b8683b26262ced0`.

## charcoal / thing.lock--alt1

Intended: A chunky horizontal iron sliding door bolt in its brackets.. Actions: thing.lock.

Gate state: **accepted**. Sliding bolt read as Lock / Unlock, high confidence.

Visible objects: A circular icon depicting two wooden panels fastened together by a closed metal sliding bolt latch.

Action: Lock / Unlock (toggle locked state)
Confidence: High

Evidence: `reads/charcoal/thing.lock--alt1/f34edfa74c9ab9c4`.

## parchment / thing.lock

Intended: One stout iron padlock, brass keyhole plate, closed shackle.. Actions: thing.lock.

Gate state: **needs-review**. 

**Description:** A closed, dark grey padlock with a gold keyhole plate, set against a circular golden background.

**Action:** Lock object (prevents movement or editing of a selected item).
**Confidence:** High

**Alternative:** While standard for locking objects, it could alternatively mean "Lock room/session" to prevent new players from joining.

Evidence: `reads/parchment/thing.lock/444ecdac1e4ec0fe`.

## charcoal / room.walls.

Intended: A chunky three-course stone brick wall with a clear staggered masonry silhouette.. Actions: room.walls., room.walls.auto, room.walls.rough-timber, room.walls.log-cabin, room.walls.half-timber, room.walls.fieldstone, room.walls.dressed-stone, room.walls.noble-interior, room.walls.crypt-stone, room.walls.castle-rough, room.walls.noble-panel, room.walls.noble-paper, room.walls.conservatory, room.walls.temple-stone, room.walls.cut-rock, room.walls.tower-stone, room.walls.mine-timbered, room.walls.black-stone, room.walls.wattle-daub.

Gate state: **learned**. Wall recognized; observer expects placing walls/LOS blockers rather than selecting material. Exact Walls style-picker behavior learned.

**Visible objects and marks:** A dark circular button with a grey border containing a stylized, 3D-shaded brick or stone wall made of three staggered rows.

**Action interpretation:** Wall tool (used by a Game Master to draw line-of-sight blockers or place physical barriers on the map).
**Confidence:** High.

Evidence: `reads/charcoal/room.walls./75e667028bf6a22b`.

## charcoal / room.walls.--alt1

Intended: A small roofless room corner: two thick stone walls meeting at a right angle.. Actions: room.walls., room.walls.auto, room.walls.rough-timber, room.walls.log-cabin, room.walls.half-timber, room.walls.fieldstone, room.walls.dressed-stone, room.walls.noble-interior, room.walls.crypt-stone, room.walls.castle-rough, room.walls.noble-panel, room.walls.noble-paper, room.walls.conservatory, room.walls.temple-stone, room.walls.cut-rock, room.walls.tower-stone, room.walls.mine-timbered, room.walls.black-stone, room.walls.wattle-daub.

Gate state: **learned**. Wall/corner recognized; build-structure guess. Material-picker behavior must be learned.

Visible objects: A 3D isometric illustration of a stone wall corner and floor tile within a circular border.
Action: Build walls or structures tool.
Confidence: High.
Alternative: Open the architecture/building asset library menu.

Evidence: `reads/charcoal/room.walls.--alt1/49a02619618b2e1a`.

## charcoal / room.fog

Intended: Three broad pale blue horizontal fog banks with one ivory vertical double-headed arrow at the right.. Actions: room.fog.

Gate state: **accepted**. Adjust fog height, high confidence.

**Description:** A circular button containing three stacked, wavy, light-blue shapes resembling fog or clouds, positioned to the left of a vertical double-headed arrow.

**Action:** Adjust fog height
**Confidence:** High

**Ambiguity/Alternative:** While the shapes strongly resemble fog or clouds, they could potentially represent water. A plausible alternative is "Adjust water level".

Evidence: `reads/charcoal/room.fog/16913fa83256612f`.

## parchment / room.fog

Intended: Three broad pale blue horizontal fog banks with one ivory vertical double-headed arrow at the right.. Actions: room.fog.

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/room.fog/512aba61a79b81ab`.

## charcoal / room.height.

Intended: Two thick horizontal stone slabs, floor and ceiling, with an ivory vertical double-headed arrow between them.. Actions: room.height..

Gate state: **accepted**. Adjust elevation / height, high confidence.

**Description:** A dark circular button containing two horizontal, textured brown bars (resembling ground or platforms) with a vertical, double-headed white arrow pointing between them.

**Action:** Adjust elevation / height
**Confidence:** High

Evidence: `reads/charcoal/room.height./38b1be4dade931ad`.

## charcoal / room.height.--alt1

Intended: A stout stone wall beside a large ivory vertical measuring ruler.. Actions: room.height..

Gate state: **needs-review**. 

**Description:** A circular button displaying a stack of grey stone blocks (resembling a small wall) next to a vertical, marked measuring stick or ruler.

**Action:** Measure height (or elevation).
**Confidence:** High.

Evidence: `reads/charcoal/room.height.--alt1/62bbe81807980ef8`.

## parchment / room.height.

Intended: Two thick horizontal stone slabs, floor and ceiling, with an ivory vertical double-headed arrow between them.. Actions: room.height..

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/room.height./764a58d2404b1949`.

## charcoal / faction.set

Intended: Two overlapping stout pennant banners, one muted teal and one ochre, each on a short pole.. Actions: faction.set.

Gate state: **accepted**. Blind read names Factions / Teams menu, medium confidence.

Visible objects: Two swallowtail banners (one teal, one gold) on wooden poles with rounded finials, set within a circular border.
Action: Open Factions / Teams menu.
Confidence: Medium.
Alternative: Party management or Initiative tracker.

Evidence: `reads/charcoal/faction.set/753b662e64c3d375`.

## charcoal / faction.set--alt1

Intended: Three stout pawn busts grouped together: two ochre allies on the left under a small ochre pennant and one teal rival on the right under a teal pennant. Clear team grouping, large simple separated silhouettes. No shield, star, weapon or armor.. Actions: faction.set.

Gate state: **needs-review**. 

**Description:** A circular button with a dark background and a grey border. Inside are three 3D-style game pawns. On the left are two gold pawns with a gold flag behind them. On the right is a single teal pawn with a teal flag behind it.

**Action Interpretation:** Manage Teams / Factions
**Confidence:** High

**Reasoning:** The distinct colored groups of pawns, each associated with its own flag, is a standard gaming visual metaphor for dividing players or units into opposing teams or factions. 
**Plausible Alternative:** Player Management / Lobby (if the game doesn't have explicit teams, it might just represent the multiplayer aspect generally).

Evidence: `reads/charcoal/faction.set--alt1/79f210a236777d50`.

## parchment / faction.set

Intended: Two overlapping stout pennant banners, one muted teal and one ochre, each on a short pole.. Actions: faction.set.

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/faction.set/6c50987e80014389`.

## charcoal / thing.pin

Intended: A large red pushpin, angled diagonally, short ivory point.. Actions: thing.pin.

Gate state: **learned**. Pin recognized. Keeping a prop through re-roll rather than immobilizing it must be learned.

**Description:** A red 3D pushpin (thumbtack) pointing downwards and to the left, centered inside a dark circular button with a gray border.

**Action:** Pin (lock an object in place or attach a note/marker to the map).
**Confidence:** High

**Ambiguity/Alternative:** The icon universally means "pin," but the specific VTT implementation could vary slightly between locking a token's position so it cannot be moved, or placing a clickable note/waypoint on the map.

Evidence: `reads/charcoal/thing.pin/3496c4003f7fe567`.

## charcoal / thing.pin--alt1

Intended: One large stout ivory ships anchor with broad hooked flukes and a thick muted teal rope loop through its top. Simple anchoring / pinning metaphor, no crate or chest or container.. Actions: thing.pin.

Gate state: **not-read**. 

Pending.

Evidence: `reads/charcoal/thing.pin--alt1/6db319d7687b3cae`.

## charcoal / edit.lift

Intended: One small ochre wooden crate floating above a short horizontal ground shadow, with a large ivory vertical double-headed arrow beside it.. Actions: edit.lift.

Gate state: **accepted**. Adjust object elevation, high confidence.

**Description:** A 3D wooden crate icon positioned next to a vertical double-headed arrow within a circular border. 

**Action:** Adjust object elevation (move vertically)
**Confidence:** High

**Alternative:** While likely for elevation, it could plausibly represent "scale object vertically" depending on the specific toolset.

Evidence: `reads/charcoal/edit.lift/ad4ac42bc5dec52a`.

## charcoal / edit.lift--alt1

Intended: An ivory pawn floating above a teal oval base, broad up and down arrows at the right.. Actions: edit.lift.

Gate state: **needs-review**. 

**Description:** A circular button displaying a 3D-style white chess pawn on a teal base. To the right of the pawn are two vertical arrows: a teal arrow pointing up and a red arrow pointing down.

**Action Interpretation:** Adjust token elevation (change flying height/vertical position).
**Confidence:** High

**Alternative:** While vertical arrows strongly suggest elevation in a 3D space, it could plausibly mean "Resize Token" (scale up/down), though scale icons typically use diagonal arrows.

Evidence: `reads/charcoal/edit.lift--alt1/977323505dd2ba0d`.

## charcoal / pawn.sheet

Intended: A warm ivory parchment page with a large teal pawn portrait and two thick horizontal dark writing strokes.. Actions: pawn.sheet.

Gate state: **needs-review**. 

**Visible objects and marks:** A circular button containing an icon of a piece of parchment paper. On the paper is a teal pawn game piece situated above two horizontal dark lines representing text.

**Action interpretation:** Open character sheet (or view actor/token details)
**Confidence:** High

Evidence: `reads/charcoal/pawn.sheet/097f56a2099bf53a`.

## charcoal / pawn.sheet--alt1

Intended: An open chunky cream book with a large teal pawn silhouette on one page.. Actions: pawn.sheet.

Gate state: **needs-review**. 

**Visible objects and marks:** A circular button containing an icon of an open book with a blue pawn (game piece) resting on the right page.

**Action interpretation:** Open rulebook / game rules
**Confidence:** High

**Ambiguity/Alternative:** While highly likely to be the rules, in a roleplaying-specific virtual tabletop, it could alternatively open a "Compendium" or "Journal" (where the pawn represents character/token data rather than general game rules).

Evidence: `reads/charcoal/pawn.sheet--alt1/1394c67082ad3753`.

## charcoal / pawn.give

Intended: A broad open ivory hand offering a small teal pawn.. Actions: pawn.give.

Gate state: **needs-review**. 

Visible objects: A pale hand, palm up, holding a small teal game pawn within a circular border.
Action: Grab tool (used to pick up and move game pieces).
Confidence: High.

Evidence: `reads/charcoal/pawn.give/6be9f7fbf16215e2`.

## charcoal / pawn.give--alt1

Intended: Two simple pawn busts with one bold ivory arrow passing from the ochre bust to the teal bust.. Actions: pawn.give.

Gate state: **needs-review**. 

**Description:** The button displays two stylized pawn or player icons (an orange one on the left and a teal one on the right) with a white arrow pointing from the orange icon to the teal one, set within a dark circular border.

**Action:** Pass turn / Next player
**Confidence:** High

**Alternative:** While standard for "pass turn", it could plausibly mean "switch active character" if a player controls multiple distinct pieces.

Evidence: `reads/charcoal/pawn.give--alt1/6ffb8b32c76715e0`.

## parchment / pawn.give

Intended: A broad open ivory hand offering a small teal pawn.. Actions: pawn.give.

Gate state: **needs-review**. 

**Visible objects and marks:** A circular button with a gold border and a tan, parchment-like background. In the center is a dark grey hand, palm facing up, holding a teal game pawn.

**Action interpretation:** Grab / Pick up object tool
**Confidence:** High

Evidence: `reads/parchment/pawn.give/333d3b6ff41aff63`.

## charcoal / edit.duplicate

Intended: Two identical overlapping ochre wooden crates with a large ivory plus sign.. Actions: edit.duplicate, pawn.duplicate.

Gate state: **not-read**. 

Pending.

Evidence: `reads/charcoal/edit.duplicate/9037451d546ab8ac`.

## parchment / edit.duplicate

Intended: Two identical overlapping ochre wooden crates with a large ivory plus sign.. Actions: edit.duplicate, pawn.duplicate.

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/edit.duplicate/866237e80980cc90`.

## charcoal / thing.open

Intended: One stout wooden treasure chest with its lid halfway OPEN on a visible hinge. A single broad ivory curved arrow lifts from the front edge upward toward the open lid. Simple dark cavity clearly visible. No treasure, doorway, exit sign or scene.. Actions: thing.open.

Gate state: **needs-review**. 

**Visible objects and marks:** A circular icon containing a 3D rendering of an open wooden treasure chest with grey metal banding. A rolled-up white scroll or parchment rests inside the chest.

**Action interpretation:** Open Compendium / Asset Library
**Confidence:** High

**Ambiguity and alternative:** While it clearly represents stored items or information, it could specifically open a player's personal "Inventory" rather than the global game compendium.

Evidence: `reads/charcoal/thing.open/4be30d01fe90dd61`.

## charcoal / thing.light

Intended: One bold golden flame above a short red candle with a dark wick.. Actions: thing.light.

Gate state: **accepted**. Lighting / toggle illumination, high confidence.

**Visible objects and marks:** A lit red candle with dripping wax and a bright yellow/orange flame, centered inside a dark circular button with a grey border.

**Action interpretation:** Lighting tool (e.g., add ambient light sources or toggle token illumination).
**Confidence:** High

Evidence: `reads/charcoal/thing.light/eaf5f2a1557b7199`.

## charcoal / thing.rename

Intended: One stout ochre pencil diagonally crossing a blank ivory name tag.. Actions: thing.rename.

Gate state: **accepted**. Edit tag first; Rename object explicitly offered as alternative.

Visible objects: A yellow pencil with a red eraser angled downwards, overlapping a beige tag with a hole, enclosed in a dark circular button.

Action: Edit tags
Confidence: High

Alternative: Rename object (if the tag icon is used to represent a nameplate or title rather than metadata tags).

Evidence: `reads/charcoal/thing.rename/ab317f93e6aa6265`.

## charcoal / thing.upright

Intended: An upright ochre crate resting flat on a thick ground line with a broad ivory up arrow beside it.. Actions: thing.upright.

Gate state: **needs-review**. 

Visible objects: A brown wooden crate next to a white upward-pointing arrow, enclosed in a dark circular button.

Action: Upload asset (or 3D model)
Confidence: High

Alternative: Export asset (if the upward arrow is interpreted as sending data out of the current environment rather than up to a server).

Evidence: `reads/charcoal/thing.upright/0ea572489ef91f26`.

## parchment / thing.upright

Intended: An upright ochre crate resting flat on a thick ground line with a broad ivory up arrow beside it.. Actions: thing.upright.

Gate state: **needs-review**. 

**Description:** A wooden crate next to a dark, upward-pointing arrow, both resting on a horizontal baseline within a circular, parchment-colored button with a gold rim.

**Action:** Upload (asset, file, or package)
**Confidence:** High

**Ambiguity/Alternative:** The icon is a standard representation for transferring data "out" or "up." While "Upload" (to the server) is most likely for a browser VTT, a plausible alternative is "Export" (saving a package to your local device).

Evidence: `reads/parchment/thing.upright/fa8e8a56a2ed60ad`.

## charcoal / pawn.cond.

Intended: One bold ochre warning badge with a dark exclamation mark.. Actions: pawn.cond., pawn.cond.blinded, pawn.cond.charmed, pawn.cond.frightened, pawn.cond.grappled, pawn.cond.invisible, pawn.cond.poisoned, pawn.cond.prone, pawn.cond.restrained, pawn.cond.stunned, pawn.cond.unconscious.

Gate state: **needs-review**. 

Visible objects: A dark circular button with a grey border, containing a yellow triangle with a dark exclamation mark in the center.

Action interpretation: View alerts or warnings.
Confidence: High.

Ambiguity: While universally recognized as a warning symbol, the specific click action can vary slightly by software; a plausible alternative is "Report an issue/bug".

Evidence: `reads/charcoal/pawn.cond./2434f3a10c23b810`.

## charcoal / pawn.cond.--alt1

Intended: Three overlapping red, teal and ivory circular status badges.. Actions: pawn.cond., pawn.cond.blinded, pawn.cond.charmed, pawn.cond.frightened, pawn.cond.grappled, pawn.cond.invisible, pawn.cond.poisoned, pawn.cond.prone, pawn.cond.restrained, pawn.cond.stunned, pawn.cond.unconscious.

Gate state: **needs-review**. 

**Description:** A dark circular button containing three smaller, overlapping circles arranged in a triangle: a red circle with a white drop (top), a teal circle with a white leaf (bottom left), and a beige circle with a dark shield (bottom right).

**Action:** Open status effects or token markers menu.
**Confidence:** High

**Alternative:** It could alternatively open a "Token Stats/Attributes" menu (representing Health, Speed/Nature, and Armor), though status conditions are the most common use for this specific grouping of varied icons in VTTs.

Evidence: `reads/charcoal/pawn.cond.--alt1/7908e842e9229527`.

## parchment / pawn.cond.

Intended: One bold ochre warning badge with a dark exclamation mark.. Actions: pawn.cond., pawn.cond.blinded, pawn.cond.charmed, pawn.cond.frightened, pawn.cond.grappled, pawn.cond.invisible, pawn.cond.poisoned, pawn.cond.prone, pawn.cond.restrained, pawn.cond.stunned, pawn.cond.unconscious.

Gate state: **not-read**. 

Pending.

Evidence: `reads/parchment/pawn.cond./4b9f19662d2aec78`.

## charcoal / pawn.mark.

Intended: One large five-point gold star with broad matte painted facets.. Actions: pawn.mark., pawn.mark.star.

Gate state: **needs-review**. 

**Visible objects and marks:** A golden, 3D-beveled, five-pointed star centered inside a dark circular badge with a thin grey border.

**Action interpretation:** Add to favorites (or bookmark)
**Confidence:** Medium

**Ambiguity:** While a star is the universal UI symbol for "favorite," in a virtual tabletop context, it frequently represents specific roleplaying game mechanics. 
**Plausible alternative:** Award Inspiration (or a Hero Point) to a character.

Evidence: `reads/charcoal/pawn.mark./c53100c3b0fbc6d4`.

## charcoal / pawn.travel

Intended: An ivory pawn moving through a teal doorway, a bold ochre arrow pointing through the doorway.. Actions: pawn.travel.

Gate state: **needs-review**. 

**Description:** A beige game pawn with an orange arrow pointing from it into a teal arched doorway, enclosed in a dark circular button.

**Action:** Exit game / Leave session
**Confidence:** High

**Ambiguity/Alternative:** While the pawn usually represents the player in this context (making "Exit" the most likely), it could potentially mean "Move selected token to another map/scene" if the button acts on a specific selected object rather than the user's session.

Evidence: `reads/charcoal/pawn.travel/8f7a0870d76ac73a`.

## charcoal / roof.style.

Intended: One thick ochre pitched roof with broad teal shingles, no house beneath it.. Actions: roof.style., building.roof., roof.style.thatch, roof.style.tile, roof.style.slate, roof.style.shingle, roof.style.flat, roof.style.auto, building.roof.thatch, building.roof.tile, building.roof.slate, building.roof.shingle, building.roof.flat, building.roof.auto.

Gate state: **not-read**. 

Pending.

Evidence: `reads/charcoal/roof.style./a517947ea2f752fd`.

## charcoal / building.storeys.

Intended: Three thick stacked stone floor slabs separated by short dark supporting pillars.. Actions: building.storeys., building.storeys.1, building.storeys.2, building.storeys.3.

Gate state: **not-read**. 

Pending.

Evidence: `reads/charcoal/building.storeys./67d58e0d7009cb48`.

## charcoal / pawn.mark.circle

Intended: One large solid orange circle.. Actions: pawn.mark.circle.

Gate state: **learned**. Marker shape recognized. Selecting this named indicator on a pawn is learned from the labelled Indicators submenu; standalone action guess differs. Exact marker retained.

**Visible objects and marks:** A glossy, convex orange circle enclosed within a thin, dark grey ring, set against a dark background. There are no icons, symbols, or text on the button.

**Action interpretation:** Select the color orange (e.g., for a drawing tool, pointer, or player identification).
**Confidence:** Low

**Ambiguity and alternative:** The button is highly ambiguous because it lacks any iconography to indicate a specific function beyond its color. A plausible alternative is that it is a user-defined **macro button**, where the user has chosen an orange color to represent a custom script or action.

Evidence: `reads/charcoal/pawn.mark.circle/ef801e6329d92841`.

## charcoal / pawn.mark.diamond

Intended: One large solid purple diamond with four clear corners.. Actions: pawn.mark.diamond.

Gate state: **learned**. Marker shape recognized. Selecting this named indicator on a pawn is learned from the labelled Indicators submenu; standalone action guess differs. Exact marker retained.

**Visible objects and marks:** A circular button with a dark background and a thin grey border. In the center is a 3D-shaded purple diamond or octahedron (resembling a d8 die), with a bright highlight on the top-left facet.

**Action interpretation:** Open 3D dice menu (specifically the 'dddice' extension/integration).
**Confidence:** High

**Alternative:** Access premium features or store (as purple gems often represent premium currency in gaming interfaces).

Evidence: `reads/charcoal/pawn.mark.diamond/673e4c08a883490e`.

## charcoal / pawn.mark.triangle

Intended: One large solid green equilateral triangle pointing upward.. Actions: pawn.mark.triangle.

Gate state: **learned**. Marker shape recognized. Selecting this named indicator on a pawn is learned from the labelled Indicators submenu; standalone action guess differs. Exact marker retained.

**Description:** A circular button with a dark background and a thin grey border, containing a beveled, green, upward-pointing triangle.

**Action:** Move up / Increase elevation
**Confidence:** High

**Ambiguity:** In a 3D tabletop, it is slightly ambiguous whether this applies to moving a selected token's vertical position (Z-axis) or adjusting the camera view. 
**Alternative:** Pan camera up

Evidence: `reads/charcoal/pawn.mark.triangle/dc7e7df5620c3396`.

## charcoal / pawn.mark.moon

Intended: One large pale icy blue crescent moon, broad curved body and clear dark crescent cutout.. Actions: pawn.mark.moon.

Gate state: **learned**. Marker shape recognized. Selecting this named indicator on a pawn is learned from the labelled Indicators submenu; standalone action guess differs. Exact marker retained.

Visible objects: A circular button containing a light blue crescent moon on a dark background, surrounded by a thin circular border.

Action interpretation: Toggle night mode (set environment lighting/time to night).
Confidence: High.

Alternative: While likely a lighting toggle, in a tabletop RPG context, it could alternatively initiate a "Long Rest" mechanic or apply a "Sleep" status effect to a selected token.

Evidence: `reads/charcoal/pawn.mark.moon/33b4e2b35ce9e041`.

## charcoal / pawn.mark.square

Intended: One large solid royal blue square with four clear corners.. Actions: pawn.mark.square.

Gate state: **needs-review**. 

**Visible objects and marks:** A dark circular button containing an icon of a wooden signpost. The signpost has two directional arrows attached to it: a teal arrow pointing left on top, and a red arrow pointing right on the bottom.

**Action interpretation:** Place waypoint or map marker.

**Confidence:** Medium

**Ambiguity and alternative:** While a signpost strongly suggests marking a location (waypoint/point of interest), it could also plausibly be a **"Measure Path"** tool, as signposts are associated with navigation, routes, and distances.

Evidence: `reads/charcoal/pawn.mark.square/005da3e53ab0fcf8`.

## charcoal / pawn.mark.cross

Intended: One large bold red diagonal cross made of two wide strokes.. Actions: pawn.mark.cross.

Gate state: **learned**. Marker shape recognized. Selecting this named indicator on a pawn is learned from the labelled Indicators submenu; standalone action guess differs. Exact marker retained.

**Description:** A circular button with a dark grey background and a silver border, featuring a prominent, thick red 'X' with a beveled, 3D appearance in the center.

**Action:** Close

**Confidence:** High

**Ambiguity:** While universally recognized as a negative or stopping action, its specific function depends on context. If attached to a specific tabletop token or item, a plausible alternative is **Delete**.

Evidence: `reads/charcoal/pawn.mark.cross/a0d804cfb221da39`.

## charcoal / pawn.mark.skull

Intended: One chunky ivory skull silhouette with two broad dark eye sockets and simple square jaw.. Actions: pawn.mark.skull.

Gate state: **learned**. Marker shape recognized. Selecting this named indicator on a pawn is learned from the labelled Indicators submenu; standalone action guess differs. Exact marker retained.

A stylized bone-colored skull centered inside a dark circular button with a grey border.

Action: Mark token as dead (apply death status)
Confidence: Medium

This is ambiguous because while a skull typically represents death or enemies in tabletop RPGs, it can also be used as a thematic icon for removal. 
Plausible alternative: Delete object.

Evidence: `reads/charcoal/pawn.mark.skull/cfb20473f1aeeac6`.
