# Blind reads at 31 px

Model: `gemini-3.1-pro-preview`. Each image is 31 px on a 67 px `#1c1f24` ground.
The model sees only `candidate.png` and the neutral prompt. Reads are evidence, not acceptance.

## charcoal / edit.rotate

Intended: An upright ochre wooden crate with ONE thick ivory horizontal elliptical arrow circling its base. Exactly one arrowhead.. Actions: edit.rotate, room.rotate.

Gate state: **accepted**. Rotate piece, high confidence.

The image shows a 3D wooden crate with a curved white arrow wrapping horizontally around its base, pointing clockwise.

Action: Rotate piece
Confidence: High

Evidence: `reads/charcoal/edit.rotate/549ef2e88bbe3d6d-5c3061251e`.

## charcoal / edit.rotate--alt1

Intended: An upright block on a round turntable, with one horizontal curved arrow.. Actions: edit.rotate, room.rotate.

Gate state: **accepted**. Rotate around vertical axis, high confidence.

**Visible objects and marks:** A 3D wooden rectangular block standing upright on a circular base. A teal curved arrow wraps horizontally around the middle of the block, pointing to the right.

**Action interpretation:** Rotate piece (around its vertical axis).
**Confidence:** High.

Evidence: `reads/charcoal/edit.rotate--alt1/a9b93a67a8b237eb-5c3061251e`.

## parchment / edit.rotate

Intended: An upright ochre wooden crate with ONE thick ivory horizontal elliptical arrow circling its base. Exactly one arrowhead.. Actions: edit.rotate, room.rotate.

Gate state: **accepted**. Rotate piece, high confidence.

**Visible objects and marks:** A 3D wooden crate with a dark curved arrow wrapping horizontally around its lower half, pointing to the right.

**Action interpretation:** Rotate piece.
**Confidence:** High.

Evidence: `reads/parchment/edit.rotate/c714012cae97d216-5c3061251e`.

## charcoal / edit.resize

Intended: A small solid ochre crate anchored at the lower left inside a much larger translucent teal ghost crate. Exactly ONE thick ivory diagonal arrow pointing up and right.. Actions: edit.resize.

Gate state: **accepted**. Scale / Resize, high confidence.

**Visible objects and marks:** A small, solid golden-brown cube in the bottom left, a larger translucent blue cube, and a white diagonal arrow pointing from the small cube towards the upper-right corner of the large cube.

**Action interpretation:** Scale / Resize
**Confidence:** High

Evidence: `reads/charcoal/edit.resize/ad80b7bd12cf0496-5c3061251e`.

## parchment / edit.resize

Intended: A small solid ochre crate anchored at the lower left inside a much larger translucent teal ghost crate. Exactly ONE thick ivory diagonal arrow pointing up and right.. Actions: edit.resize.

Gate state: **accepted**. Scale / Resize piece, high confidence.

**Visible objects and marks:** A circular button containing a small, solid brown cube in the lower-left foreground. A white arrow points from this small cube upwards and to the right, towards a larger, translucent blue wireframe cube in the background.

**Action interpretation:** Scale / Resize piece
**Confidence:** High

**Ambiguity and alternative:** The visual metaphor of a small object pointing to a larger outline strongly suggests changing size. A less likely but plausible alternative is **"Place in container"**, interpreting the large translucent box as a receptacle rather than a target size.

Evidence: `reads/parchment/edit.resize/bd81ec44f7a8d1c1-5c3061251e`.

## charcoal / room.reroll

Intended: Two chunky ivory dice, black broad pips, one slightly above the other.. Actions: room.reroll, roof.reroll, building.reroll.

Gate state: **learned**. Dice and Roll recognized; room/building regeneration is learned contextual meaning of Harry's settled two-dice metaphor.

Visible objects: Two six-sided dice with black pips inside a circular border.
Action: Roll
Confidence: High

Evidence: `reads/charcoal/room.reroll/a60ba15f875e84fd-5c3061251e`.

## parchment / room.reroll

Intended: Two chunky ivory dice, black broad pips, one slightly above the other.. Actions: room.reroll, roof.reroll, building.reroll.

Gate state: **learned**. Roll recognized; Randomize explicitly offered. Exact regeneration behavior still contextual.

**Description:** A circular, gold-colored button displaying two dark grey six-sided dice with white pips.

**Action:** Roll
**Confidence:** High

**Ambiguity:** While "Roll" is the most direct translation of the dice icon (especially if the selected piece is a die), if the selected piece is a different type of object (like a deck of cards or a multi-state token), the action might be more broadly intended as **Randomize** (e.g., shuffle or pick a random state).

Evidence: `reads/parchment/room.reroll/1ab8b77a999b6ef4-5c3061251e`.

## charcoal / thing.replace

Intended: Two separate blocks, one ochre and one teal, with two ivory exchange arrows above and below them pointing in opposite directions. No dice, no pips.. Actions: thing.replace.

Gate state: **accepted**. Cycle alternate forms/textures first; Replace Piece explicitly offered. Correct exchange metaphor.

**Visible objects and marks:** A circular button containing two 3D cubes of different colors (orange and teal) surrounded by two curved arrows forming a continuous exchange cycle.

**Action interpretation:** Change State (cycle through alternate forms/textures of the piece)
**Confidence:** High

**Ambiguity/Alternative:** While it strongly suggests cycling states, it could also mean **Replace Piece** (swap the current model for a completely different one from a library), as the two distinct colored cubes might represent entirely different objects rather than just states of the same object.

Evidence: `reads/charcoal/thing.replace/92fcc17b84a1f3c9-5c3061251e`.

## parchment / thing.replace

Intended: Two separate blocks, one ochre and one teal, with two ivory exchange arrows above and below them pointing in opposite directions. No dice, no pips.. Actions: thing.replace.

Gate state: **accepted**. Swap or replace piece, high confidence.

**Visible objects and marks:** Two 3D cubes (one orange, one teal) surrounded by two curved arrows forming a circular exchange motion.

**Action interpretation:** Swap or replace piece.
**Confidence:** High.

**Ambiguity/Alternative:** While "replace" is most likely, it could alternatively mean "Change State" if the selected piece has multiple built-in forms or faces to toggle between.

Evidence: `reads/parchment/thing.replace/28e8e72c4dc68973-5c3061251e`.

## charcoal / thing.tilt

Intended: An ochre wooden crate visibly tipped forty-five degrees onto its corner, with ONE thick ivory VERTICAL curved arrow arching over its top toward its right side. Exactly one arrowhead.. Actions: thing.tilt.

Gate state: **accepted**. Rotation recognized; blind explanation explicitly identifies horizontal-axis Flip/Roll, distinguishing Turn.

**Visible objects and marks:** A 3D wooden crate tilted at an angle, with a curved white arrow arching over its top right side and pointing downwards.

**Action interpretation:** Rotate
**Confidence:** High

**Ambiguity:** While clearly a rotation action, the arrow arching *over* the object rather than circling it horizontally suggests it might specifically mean **"Flip"** or **"Roll"** (rotating on a horizontal axis) rather than a standard spin.

Evidence: `reads/charcoal/thing.tilt/b5533c1374a6f1d5-5c3061251e`.

## parchment / thing.tilt

Intended: An ochre wooden crate visibly tipped forty-five degrees onto its corner, with ONE thick ivory VERTICAL curved arrow arching over its top toward its right side. Exactly one arrowhead.. Actions: thing.tilt.

Gate state: **accepted**. Rotation recognized; over-top arrow explicitly read as turning over / Flip.

**Visible objects and marks:** A circular button with a gold border containing a 3D wooden crate. A dark curved arrow arcs over the top of the crate, pointing downwards to the right.

**Action interpretation:** Rotate
**Confidence:** High

**Ambiguity/Alternative:** While the curved arrow generally indicates rotation, its position arcing *over* the top of the object rather than around its base could specifically indicate turning the object over, making **Flip** a plausible alternative.

Evidence: `reads/parchment/thing.tilt/9ebff55b612a24dd-5c3061251e`.

## charcoal / pawn.damage

Intended: A vivid red heart visibly WOUNDED by a deep jagged diagonal black gash separating its two halves; a small pointed red shard peels away at the lower end. The gash is dark negative space, never a white stripe or a bandage. The heart is slashed, damaged, not healing.. Actions: pawn.damage.

Gate state: **accepted**. After repaint, Apply damage / reduce health, high confidence.

Description: A red heart with a jagged black crack splitting it down the middle, enclosed in a dark circular border.

Action: Apply damage (reduce health).
Confidence: High.

Alternative: Mark as dead/defeated. While it clearly indicates health loss, it's slightly ambiguous whether it means taking a specific amount of damage or being reduced to zero health, depending on the specific virtual tabletop's iconography.

Evidence: `reads/charcoal/pawn.damage/c83386404940fc76-5c3061251e`.

## charcoal / pawn.damage--alt1

Intended: A blue shield taking a HIT: the small intact blue shield occupies the left third; a huge vivid red sharp impact starburst strikes across its right edge and dominates the center, with one short red minus mark below the burst. The shield is NOT cracked or broken. Emphasize receiving damage, not broken armor or defense statistics.. Actions: pawn.damage.

Gate state: **accepted**. After second repaint, Take damage / reduce HP is first guess, medium confidence; defense alternative remains.

**Visible objects and marks:** A dark circular button containing a blue shield with a silver border. A bright red, jagged explosion or impact graphic overlaps the right side of the shield. Below this is a small red minus sign.

**Action interpretation:** Take damage (reduce health/hit points).
**Confidence:** Medium.

**Ambiguity:** While an impact often denotes taking damage generally, the specific use of a shield icon might signify a defensive stat. A plausible alternative is **Reduce Armor / Decrease Defense**.

Evidence: `reads/charcoal/pawn.damage--alt1/c0ba1832bbb92796-5c3061251e`.

## parchment / pawn.damage

Intended: A vivid red heart bearing one jagged diagonal dark slash across its surface, with ONE large dark slate MINUS SIGN immediately to its right. Heart remains one whole recognizable shape, not split apart or dead. The minus is broad and bold, clearly reducing health. No bandage, no crossed-out status stripe.. Actions: pawn.damage.

Gate state: **accepted**. After second repaint, Decrease health / Subtract HP / take damage, high confidence.

**Description:** A circular button with a gold rim and a parchment-colored background. It features a red heart with a diagonal black crack through it, positioned next to a small dark rectangle containing a white minus sign.

**Action:** Decrease health / Subtract hit points (take damage).
**Confidence:** High.

Evidence: `reads/parchment/pawn.damage/614f6e00c9fe346e-5c3061251e`.

## charcoal / thing.hide

Intended: A large ivory eye with a thick red diagonal slash.. Actions: thing.hide, roof.hide.

Gate state: **accepted**. Hide piece / toggle visibility, high confidence.

**Description:** A stylized eye crossed out by a thick red diagonal line, enclosed within a dark circular border.

**Action:** Hide piece (toggle visibility).
**Confidence:** High.

**Ambiguity & Alternative:** While standard UI convention strongly points to hiding the object from other players, in a tabletop RPG context, it could alternatively mean applying a "blinded" status effect to the selected character token (loss of sight).

Evidence: `reads/charcoal/thing.hide/6e4942beea597919-5c3061251e`.

## charcoal / thing.hide--alt1

Intended: A heavy teal curtain being drawn across a small ivory eye.. Actions: thing.hide, roof.hide.

Gate state: **accepted**. Toggle visibility Hide/Reveal, medium confidence; private Peek alternative remains.

**Description:** A circular icon showing a tan hand pulling aside a teal curtain to reveal a single eye peeking out from the shadows.

**Action Interpretation:** Toggle Visibility (Hide/Reveal piece)
**Confidence:** Medium

**Ambiguity:** While it strongly suggests visibility control, it is ambiguous whether it changes global visibility for everyone or just local visibility. A highly plausible alternative is **Peek** (privately viewing a face-down piece, like a card, without revealing it to other players).

Evidence: `reads/charcoal/thing.hide--alt1/4c5ecc833fbbf2dd-5c3061251e`.

## parchment / thing.hide

Intended: A large ivory eye with a thick red diagonal slash.. Actions: thing.hide, roof.hide.

Gate state: **accepted**. Hide piece from players, high confidence.

**Description:** A circular tan button displaying a dark stylized eye icon that is crossed out by a thick red diagonal line.

**Action:** Hide piece (make invisible to players)
**Confidence:** High

**Ambiguity:** Minimal. This is a standard UI convention for visibility. A plausible alternative in a tabletop RPG context is that it applies a "blinded" status effect to the character, but hiding the token is the most common use for this specific icon in contextual menus.

Evidence: `reads/parchment/thing.hide/20d7bf3b7afa8cc6-5c3061251e`.

## charcoal / thing.lock

Intended: One stout iron padlock, brass keyhole plate, closed shackle.. Actions: thing.lock.

Gate state: **accepted**. Lock piece against movement/editing, high confidence.

**Visible objects and marks:** A circular button containing a 3D-rendered icon of a closed padlock. The padlock has a grey metallic body, a silver shackle, and a gold-colored keyhole plate in the center.

**Action interpretation:** Lock piece (prevents it from being moved or edited).
**Confidence:** High.

Evidence: `reads/charcoal/thing.lock/5b8683b26262ced0-5c3061251e`.

## charcoal / thing.lock--alt1

Intended: A chunky horizontal iron sliding door bolt in its brackets.. Actions: thing.lock.

Gate state: **accepted**. Lock piece against movement/editing, high confidence.

**Description:** A circular button containing an icon of two wooden panels secured together by a closed metal sliding bolt latch.

**Action:** Lock piece (prevent movement or editing)
**Confidence:** High

Evidence: `reads/charcoal/thing.lock--alt1/f34edfa74c9ab9c4-5c3061251e`.

## parchment / thing.lock

Intended: One stout iron padlock, brass keyhole plate, closed shackle.. Actions: thing.lock.

Gate state: **accepted**. Lock piece, high confidence.

**Description:** A closed, dark grey padlock with a gold keyhole plate, centered on a circular tan button.

**Action:** Lock (prevents the piece from being moved or modified).

**Confidence:** High

Evidence: `reads/parchment/thing.lock/444ecdac1e4ec0fe-5c3061251e`.

## charcoal / room.walls.

Intended: A chunky three-course stone brick wall with a clear staggered masonry silhouette.. Actions: room.walls..

Gate state: **learned**. Wall recognized but guessed LOS/obstacle behavior. Exact material-picker action learned from label.

**Visible objects and marks:** A dark circular button with a light grey border. Inside is a 3D-shaded icon of a brick or stone wall, composed of three staggered rows of rectangular blocks.

**Action interpretation:** Toggle whether the piece blocks Line of Sight (LoS) or movement (designate as an obstacle).
**Confidence:** Medium.

**Ambiguity:** While a wall strongly implies a physical or visual barrier, it could also metaphorically mean "Lock piece" (make it immovable static terrain), though a padlock is the more standard icon for locking.

Evidence: `reads/charcoal/room.walls./75e667028bf6a22b-5c3061251e`.

## charcoal / room.walls.--alt1

Intended: A small roofless room corner: two thick stone walls meeting at a right angle.. Actions: room.walls..

Gate state: **learned**. Wall corner recognized; guessed corner variant or structural properties. Walls material menu must be learned.

**Visible objects and marks:** A circular button containing a 3D isometric rendering of a stone dungeon corner, consisting of two intersecting textured walls and a small section of floor.

**Action interpretation:** Change the selected piece to a corner variant.
**Confidence:** Medium

**Ambiguity and alternative:** This is ambiguous because it relies on the selected piece being a modular building asset (like a straight wall) that has a corresponding corner version. If a non-structural prop is selected, this icon might instead represent a broader category action.
**Plausible alternative:** Open the structural/terrain properties menu for the selected piece.

Evidence: `reads/charcoal/room.walls.--alt1/49a02619618b2e1a-5c3061251e`.

## parchment / room.walls.

Intended: A chunky three-course stone brick wall with a clear staggered masonry silhouette.. Actions: room.walls..

Gate state: **learned**. Stone wall recognized; guessed immovable/LOS obstacle. Exact wall-material picker learned.

**Description:** A circular button with a tan, parchment-like background. In the center is an illustration of a grey stone or brick wall, consisting of three staggered rows of blocks.

**Action:** Lock piece in place (prevent movement or editing).
**Confidence:** Medium.

**Ambiguity:** While a wall implies something fixed and immovable (locked), a padlock is the more standard icon for this action. In a VTT context, a wall icon could alternatively mean "toggle line-of-sight blocking," turning the selected piece into a physical obstacle for lighting and vision mechanics.

Evidence: `reads/parchment/room.walls./d5abfe86fa8eaabd-5c3061251e`.

## charcoal / room.fog

Intended: Three broad pale blue horizontal fog banks with one ivory vertical double-headed arrow at the right.. Actions: room.fog.

Gate state: **learned**. Height adjustment recognized, with three visible wavy bands. Fog-specific height rather than entity elevation needs label; first context-free read explicitly named fog height.

The image displays a circular icon containing three stacked, wavy blue horizontal lines beside a vertical, double-headed arrow.

Action: Adjust elevation (change height)
Confidence: High

Evidence: `reads/charcoal/room.fog/16913fa83256612f-5c3061251e`.

## charcoal / room.fog--alt1

Intended: A simple pale-grey CLOUD silhouette with three rounded lobes above two broad horizontal pale-grey MIST STREAKS, with one large ivory vertical double-headed arrow to the right. Flat painted weather pictogram with soft edges; no 3D bevel on the cloud, no stone texture, no water waves, no floor, no rock, no ruler. Fog plus vertical adjustment.. Actions: room.fog.

Gate state: **learned**. After third repaint, cloud and mist lines correctly recognized with vertical adjustment. Exact fog depth versus flight height still needs label.

**Visible objects and marks:** A circular button containing an icon of a cloud above wavy lines, with a vertical double-headed arrow to its right.

**Action interpretation:** Adjust elevation (or set flying height).

**Confidence:** High.

Evidence: `reads/charcoal/room.fog--alt1/683b42f670123010-5c3061251e`.

## parchment / room.fog

Intended: Three broad pale blue horizontal fog banks with one ivory vertical double-headed arrow at the right.. Actions: room.fog.

Gate state: **learned**. Cloud/air layers and height adjustment recognized. Environmental fog height rather than entity flight is learned context.

**Visible objects and marks:** A circular button with a tan background containing three stacked, wavy, light-blue shapes (resembling clouds or air layers) next to a dark vertical double-headed arrow pointing up and down.

**Action interpretation:** Adjust elevation / Change flying height.

**Confidence:** High.

Evidence: `reads/parchment/room.fog/512aba61a79b81ab-5c3061251e`.

## charcoal / room.height.

Intended: Two thick horizontal stone slabs, floor and ceiling, with an ivory vertical double-headed arrow between them.. Actions: room.height..

Gate state: **learned**. Height adjustment recognized; ceiling-height change versus entity elevation needs the Height label.

**Visible objects and marks:** A circular button containing two horizontal, textured brown bars separated by a vertical, double-headed white arrow pointing up and down.

**Action interpretation:** Adjust elevation (move the piece up or down vertically).
**Confidence:** High.

Evidence: `reads/charcoal/room.height./38b1be4dade931ad-5c3061251e`.

## charcoal / room.height.--alt1

Intended: A stout stone wall beside a large ivory vertical measuring ruler.. Actions: room.height..

Gate state: **learned**. Vertical size/ruler recognized. Exact room height command is learned rather than generic scaling/elevation.

Visible objects: A grey, multi-tiered stone wall or stack of blocks on the left, positioned next to a vertical, yellow/brown ruler with dark tick marks on the right.

Action: Scale (or Resize)
Confidence: Medium

Ambiguity: The presence of a vertical ruler next to a 3D object strongly suggests measurement manipulation, but it is ambiguous whether it means changing the object's physical dimensions (Scale) or adjusting its vertical position/height off the game board (Elevation).

Evidence: `reads/charcoal/room.height.--alt1/62bbe81807980ef8-5c3061251e`.

## parchment / room.height.

Intended: Two thick horizontal stone slabs, floor and ceiling, with an ivory vertical double-headed arrow between them.. Actions: room.height..

Gate state: **learned**. Height adjustment recognized; scale-height explicitly offered. Room ceiling/storey semantics require label.

**Description:** A circular button with a gold border. Inside, there are two horizontal dark bars separated by a vertical double-headed arrow pointing up and down.

**Action:** Adjust elevation (move the piece vertically up or down).
**Confidence:** High.

**Ambiguity/Alternative:** While standard for elevation/altitude adjustment in 3D spaces, it could plausibly mean "scale height" (stretching or squashing the piece vertically) because the arrows indicate changing the distance between the top and bottom bounds.

Evidence: `reads/parchment/room.height./764a58d2404b1949-5c3061251e`.

## charcoal / faction.set

Intended: Two overlapping stout pennant banners, one muted teal and one ochre, each on a short pole.. Actions: faction.set.

Gate state: **accepted**. Set Faction / Change Team, high confidence.

**Visible objects and marks:** Two banners or flags on wooden poles within a circular border. The front banner is teal and the rear banner is yellow, both with white trim.

**Action interpretation:** Set Faction / Change Team
**Confidence:** High

Evidence: `reads/charcoal/faction.set/753b662e64c3d375-5c3061251e`.

## charcoal / faction.set--alt1

Intended: Three stout pawn busts grouped together: two ochre allies on the left under a small ochre pennant and one teal rival on the right under a teal pennant. Clear team grouping, large simple separated silhouettes. No shield, star, weapon or armor.. Actions: faction.set.

Gate state: **accepted**. After repaint, Assign Team / Change Faction, high confidence.

**Description:** The icon displays three pawn-like game pieces within a circular border. On the left are two yellow pawns, one of which has a small flag. On the right is a single teal pawn, which also has a small flag. The distinct colors and flags suggest opposing groups.

**Action Interpretation:** Assign Team / Change Faction
**Confidence:** High

**Reasoning:** In gaming contexts, differently colored pieces with flags universally represent distinct teams, factions, or player ownership. Clicking this on a selected piece likely opens a menu to change which team or player controls it.

Evidence: `reads/charcoal/faction.set--alt1/79f210a236777d50-5c3061251e`.

## parchment / faction.set

Intended: Two overlapping stout pennant banners, one muted teal and one ochre, each on a short pole.. Actions: faction.set.

Gate state: **accepted**. Assign faction/team, high confidence.

**Visible objects and marks:** A circular icon displaying two draped banners or flags on wooden poles. The front flag is teal, and the flag partially behind it is orange.

**Action interpretation:** Assign faction or team.
**Confidence:** High.

**Ambiguity:** While strongly indicative of teams/factions due to the multiple distinct colors, it might simply represent a generic color-coding function if the VTT doesn't have formal "teams."
**Plausible alternative:** Change piece color.

Evidence: `reads/parchment/faction.set/6c50987e80014389-5c3061251e`.

## charcoal / thing.pin

Intended: A large red pushpin, angled diagonally, short ivory point.. Actions: thing.pin.

Gate state: **learned**. Pin recognized; preserve through a re-roll rather than prevent movement is learned behavior.

**Description:** The image displays a dark circular button with a gray border. Inside the circle is a 3D-rendered red pushpin (thumbtack) with a metallic point, angled downwards and to the left.

**Action:** Pin / Lock piece in place (prevents movement).
**Confidence:** High.

**If ambiguous:** While highly standard for "locking," it could alternatively mean "Mark" or "Add to pinned list" (quick access), but locking position is the most universally accepted UI metaphor for a pushpin on a movable virtual object.

Evidence: `reads/charcoal/thing.pin/3496c4003f7fe567-5c3061251e`.

## charcoal / thing.pin--alt1

Intended: One large stout ivory ships anchor with broad hooked flukes and a thick muted teal rope loop through its top. Simple anchoring / pinning metaphor, no crate or chest or container.. Actions: thing.pin.

Gate state: **learned**. Anchor recognized after repaint. Keeping through regeneration rather than immobilizing still needs label.

**Visible objects and marks:** A circular button containing a metallic-colored anchor with a small teal rope wrapped around its upper shank, set against a dark background.

**Action interpretation:** Lock (or anchor) the piece in place to prevent it from being moved.
**Confidence:** High.

Evidence: `reads/charcoal/thing.pin--alt1/6db319d7687b3cae-5c3061251e`.

## parchment / thing.pin

Intended: A large red pushpin, angled diagonally, short ivory point.. Actions: thing.pin.

Gate state: **learned**. Pin recognized. Preserve through re-roll rather than immobilize requires label.

**Visible objects and marks:** A circular button with a light beige background containing a 3D-rendered red pushpin (thumbtack) angled downwards and to the left.

**Action interpretation:** Pin / Lock (fixes the piece in place to prevent accidental movement).

**Confidence:** High.

Evidence: `reads/parchment/thing.pin/ba87c1502129b98c-5c3061251e`.

## charcoal / edit.lift

Intended: One small ochre wooden crate floating above a short horizontal ground shadow, with a large ivory vertical double-headed arrow beside it.. Actions: edit.lift.

Gate state: **accepted**. Move piece vertically up/down, high confidence.

**Visible objects and marks:** A 3D wooden crate icon positioned next to a vertical double-headed arrow, enclosed within a circular button.

**Action interpretation:** Elevate / Change Height (move the piece vertically up or down).
**Confidence:** High.

**Ambiguity / Plausible alternative:** While the separate arrow strongly implies translation (movement), a plausible alternative is "Scale Height" (stretching the object vertically), though scaling icons typically show arrows directly attached to or interacting with the object's bounding box.

Evidence: `reads/charcoal/edit.lift/ad4ac42bc5dec52a-5c3061251e`.

## charcoal / edit.lift--alt1

Intended: An ivory pawn floating above a teal oval base, broad up and down arrows at the right.. Actions: edit.lift.

Gate state: **accepted**. Adjust piece elevation, high confidence.

**Visible objects and marks:** A white chess pawn resting on a teal base, flanked on the right by a teal upward-pointing arrow and a red downward-pointing arrow, all within a dark circular button.

**Action interpretation:** Adjust piece elevation (height).
**Confidence:** High.

**Ambiguity/Alternative:** While primarily indicating vertical movement (Z-axis) in a 3D space, it could ambiguously represent "Scale/Resize piece" if the arrows are interpreted as growing or shrinking the object rather than moving it up or down.

Evidence: `reads/charcoal/edit.lift--alt1/977323505dd2ba0d-5c3061251e`.

## parchment / edit.lift

Intended: One small ochre wooden crate floating above a short horizontal ground shadow, with a large ivory vertical double-headed arrow beside it.. Actions: edit.lift.

Gate state: **accepted**. Adjust elevation up/down, high confidence.

**Visible objects and marks:** A wooden crate with a drop shadow beneath it, positioned to the left of a dark vertical double-headed arrow, all within a circular button.

**Action interpretation:** Adjust elevation (move the piece up or down).
**Confidence:** High.

**Ambiguity / Alternative:** The icon is fairly standard for vertical movement (reinforced by the shadow), but a plausible alternative is "Scale/resize object height."

Evidence: `reads/parchment/edit.lift/df31565250e95440-5c3061251e`.

## charcoal / pawn.sheet

Intended: A warm ivory parchment page with a large teal pawn portrait and two thick horizontal dark writing strokes.. Actions: pawn.sheet.

Gate state: **accepted**. Open character sheet/view piece details, high confidence.

**Description:** The image displays a circular button containing an icon of a tan, slightly tattered piece of parchment. On the parchment is a teal pawn game piece positioned above two dark horizontal lines that resemble text fields.

**Action:** Open character sheet / view piece details.
**Confidence:** High.

Evidence: `reads/charcoal/pawn.sheet/097f56a2099bf53a-5c3061251e`.

## charcoal / pawn.sheet--alt1

Intended: One open ivory parchment SCROLL with curled top and bottom edges, bearing a large teal pawn portrait and two thick dark horizontal writing strokes beneath the portrait. Character record sheet. No book, shelf, arrows or plus sign.. Actions: pawn.sheet.

Gate state: **accepted**. After repaint, View character sheet/piece stats, high confidence.

**Visible objects and marks:** A circular button displaying an icon of a rolled parchment or scroll. On the center of the scroll is a teal game pawn positioned above two horizontal lines that resemble text.

**Action interpretation:** View character sheet / piece stats.
**Confidence:** High.

**Ambiguity/Alternative:** The combination of a document (scroll) and a game piece (pawn) is a standard Virtual Tabletop (VTT) convention for accessing a piece's underlying data. A plausible alternative is "View/edit piece notes" if the specific platform uses a simpler text system rather than full character sheets.

Evidence: `reads/charcoal/pawn.sheet--alt1/5d23726713671247-5c3061251e`.

## parchment / pawn.sheet

Intended: A warm ivory parchment page with a large teal pawn portrait and two thick horizontal dark writing strokes.. Actions: pawn.sheet.

Gate state: **accepted**. Open character sheet/view details, high confidence.

**Visible objects and marks:** A gold-rimmed circular button containing a parchment paper background. On the parchment is a teal pawn game piece next to two horizontal dark lines resembling text.

**Action interpretation:** Open character sheet / view piece details.
**Confidence:** High.

Evidence: `reads/parchment/pawn.sheet/a2cf463a1b37c30f-5c3061251e`.

## charcoal / pawn.give

Intended: TWO distinct ivory hands visibly handing ONE small teal pawn from the LEFT open palm into the RIGHT receiving palm. One thick ochre arrow connects the hands from left to right. Both hands equally large and clearly separate; pawn midway through the handoff. Readable transfer of ownership or control, not a lone grabbing hand.. Actions: pawn.give.

Gate state: **accepted**. After repaint, Give/pass piece to another player, high confidence.

**Description:** The icon displays a left hand holding a small teal game piece (pawn), with an orange curved arrow pointing from the piece towards an open, receiving right hand.

**Action:** Give or pass the piece to another player.
**Confidence:** High.

Evidence: `reads/charcoal/pawn.give/bac823302b295fdb-5c3061251e`.

## charcoal / pawn.give--alt1

Intended: Two simple pawn busts with one bold ivory arrow passing from the ochre bust to the teal bust.. Actions: pawn.give.

Gate state: **accepted**. Change ownership of selected piece, high confidence.

**Visible objects and marks:** A circular button containing two stylized pawn or person icons. The left icon is orange/gold, and the right icon is teal/blue. A white arrow points from the left icon to the right icon.

**Action interpretation:** Change ownership (or color/team) of the selected piece.
**Confidence:** High

**Ambiguity/Alternative:** While strongly suggesting a change in ownership or team allegiance, it could alternatively mean "Swap" the selected piece with another piece on the board.

Evidence: `reads/charcoal/pawn.give--alt1/6ffb8b32c76715e0-5c3061251e`.

## parchment / pawn.give

Intended: TWO distinct ivory hands visibly handing ONE small teal pawn from the LEFT open palm into the RIGHT receiving palm. One thick ochre arrow connects the hands from left to right. Both hands equally large and clearly separate; pawn midway through the handoff. Readable transfer of ownership or control, not a lone grabbing hand.. Actions: pawn.give.

Gate state: **accepted**. After repaint, Give piece / transfer ownership, high confidence.

**Visible objects and marks:** Two hands facing each other. The left hand holds a small blue game piece (like a pawn). An orange curved arrow points from the hand holding the piece to the open, empty right hand.

**Action interpretation:** Give piece (to another player) / Transfer ownership
**Confidence:** High

Evidence: `reads/parchment/pawn.give/6d83585dbc5a74e4-5c3061251e`.

## charcoal / edit.duplicate

Intended: Two identical overlapping ochre wooden crates with a large ivory plus sign.. Actions: edit.duplicate, pawn.duplicate.

Gate state: **accepted**. Duplicate/clone selected piece, high confidence.

**Visible objects and marks:** Two brown, wooden-style crates or boxes, with one positioned slightly behind the other. A white plus sign (+) is overlaid in the bottom right corner.

**Action interpretation:** Duplicate (or clone) the selected piece.

**Confidence:** High.

**Ambiguity/Alternative:** While highly standard for "duplicate" (due to the two identical objects plus the 'add' symbol), a plausible alternative could be "Spawn a new item/crate" if the system uses a crate as a generic object icon.

Evidence: `reads/charcoal/edit.duplicate/9037451d546ab8ac-5c3061251e`.

## charcoal / edit.duplicate--alt1

Intended: Two identical teal pawn silhouettes side by side with a large ivory plus sign above them.. Actions: edit.duplicate, pawn.duplicate.

Gate state: **accepted**. Duplicate/clone selected piece, high confidence.

**Visible objects and marks:** A dark circular button containing two teal pawn-like game pieces side-by-side, with a white plus sign (+) centered above them.

**Action interpretation:** Duplicate (or clone) the selected piece.
**Confidence:** High.

Evidence: `reads/charcoal/edit.duplicate--alt1/cf0524ae80a38558-5c3061251e`.

## parchment / edit.duplicate

Intended: Two IDENTICAL plain muted-teal cubes side by side, the rear copy slightly ghosted, with one large dark slate PLUS sign overlapping the lower right. No wood, crates, storage, shelf or container. Clear clone/copy of the same object.. Actions: edit.duplicate, pawn.duplicate.

Gate state: **accepted**. After repaint, Duplicate / Clone selected piece, high confidence.

**Visible objects and marks:** A circular button containing two 3D cubes. The front cube is solid teal, while the cube behind it is semi-transparent or faded. A dark grey plus sign (+) is in the bottom right corner.

**Action interpretation:** Duplicate (or clone) the selected piece.
**Confidence:** High.

Evidence: `reads/parchment/edit.duplicate/f3fef718720b41c0-5c3061251e`.

## charcoal / thing.open

Intended: One stout wooden treasure chest with its lid halfway OPEN on a visible hinge. A single broad ivory curved arrow lifts from the front edge upward toward the open lid. Simple dark cavity clearly visible. No treasure, doorway, exit sign or scene.. Actions: thing.open.

Gate state: **learned**. After repaint chest opens; model first expects Inventory/Loot, explicitly offers toggle Open/Close for physical chest/door. Exact mechanical opening behavior contextual.

**Description:** A stylized icon of a partially open wooden treasure chest with grey metal banding. A light-colored object, possibly a scroll, is visible inside. The chest is enclosed within a circular border.

**Action:** Open Inventory / View Loot
**Confidence:** High

**Ambiguity/Alternative:** While highly likely to open an inventory UI, if the selected piece is a physical chest or door on the board, it could alternatively represent a simple "Toggle Open/Close state" action for the 3D model itself.

Evidence: `reads/charcoal/thing.open/4be30d01fe90dd61-5c3061251e`.

## parchment / thing.open

Intended: A chunky wooden door standing open in a simple stone frame, dark opening visible.. Actions: thing.open.

Gate state: **accepted**. Open/toggle open-closed state, high confidence.

**Description:** A circular icon depicting a partially open wooden door with iron hinges set within a stone archway, revealing a dark interior.

**Action:** Open (or toggle open/closed state)
**Confidence:** High

**Ambiguity:** While highly likely to mean "open" for a prop (like a door or chest), if the selected piece is a character token, it could alternatively mean "Enter" or "Move to another scene/map".

Evidence: `reads/parchment/thing.open/32cea668187cf243-5c3061251e`.

## charcoal / thing.light

Intended: One bold golden flame above a short red candle with a dark wick.. Actions: thing.light.

Gate state: **accepted**. Toggle light source on piece, high confidence.

**Visible objects and marks:** A circular button with a dark background containing an icon of a lit red candle with dripping wax and a yellow-orange flame.

**Action interpretation:** Toggle light source (make the selected piece emit light).
**Confidence:** High.

**Ambiguity/Alternative:** While highly likely to represent illumination in a virtual tabletop, it could plausibly be a status effect marker indicating the piece is "burning" or "on fire" (though a generic flame is typically used for that rather than a specific candle).

Evidence: `reads/charcoal/thing.light/eaf5f2a1557b7199-5c3061251e`.

## parchment / thing.light

Intended: One bold golden flame above a short red candle with a dark wick.. Actions: thing.light.

Gate state: **accepted**. Toggle light emission, high confidence.

**Description:** A circular button with a tan, parchment-textured background and a thin brown border. The central icon is a lit, partially melted red candle with a bright yellow and orange flame.

**Action:** Toggle light emission (makes the piece act as a light source).
**Confidence:** High

**Ambiguity:** In some virtual tabletops, contextual menus are used primarily for status indicators rather than mechanical toggles.
**Alternative:** Apply a "holding light" or "burning" status effect marker to the piece.

Evidence: `reads/parchment/thing.light/86784831bad20dd1-5c3061251e`.

## charcoal / thing.rename

Intended: One stout ochre pencil diagonally crossing a blank ivory name tag.. Actions: thing.rename.

Gate state: **accepted**. Rename / Edit Label, high confidence.

**Description:** A yellow pencil with a red eraser angled across a light-colored tag (which has a hole on one end), enclosed in a dark circular button with a gray border.

**Action:** Rename / Edit Label
**Confidence:** High

**Ambiguity/Alternative:** While the primary meaning is highly likely to be renaming the piece or editing its visible label, a plausible alternative in some systems could be "Edit Tags" (modifying categorical keywords associated with the piece) or "Edit Description".

Evidence: `reads/charcoal/thing.rename/ab317f93e6aa6265-5c3061251e`.

## parchment / thing.rename

Intended: One stout ochre pencil diagonally crossing a blank ivory name tag.. Actions: thing.rename.

Gate state: **accepted**. Rename / Edit Label, high confidence.

**Visible objects:** A yellow pencil with a red eraser diagonally overlapping a dark grey tag (which has a small hole on its left side), set within a circular beige button.

**Action interpretation:** Rename piece (or Edit label)
**Confidence:** High

**Ambiguity/Alternative:** The iconography is standard for editing a name or label. A plausible alternative is "Edit description" or "Add note" if the tag is meant to represent a larger text field rather than just a short name.

Evidence: `reads/parchment/thing.rename/eed3c0f65831646e-5c3061251e`.

## charcoal / thing.upright

Intended: A translucent teal wooden crate tipped onto its corner on the LEFT, transitioning by ONE thick ivory curved arrow to a solid ochre wooden crate standing flat and upright on the RIGHT. Both crates share one thick short horizontal floor line. Clear tipped-to-upright before-and-after silhouettes. No vertical straight arrow, no lifting, no floating crate.. Actions: thing.upright.

Gate state: **accepted**. After repaint, Stand upright / Right piece, high confidence.

**Description:** A tilted teal box and a flat orange crate resting on a horizontal ground line, with a curved arrow pointing from the tilted box to the flat crate.

**Action Interpretation:** Stand upright (or Right piece)
**Confidence:** High

**Ambiguity & Alternative:** While the tilted-to-flat orientation strongly suggests standing a fallen piece up, the distinct colors and styles of the two boxes could imply changing the object itself.
**Plausible Alternative:** Change state / Transform piece.

Evidence: `reads/charcoal/thing.upright/3d587009baa20b03-5c3061251e`.

## parchment / thing.upright

Intended: The same ochre wooden crate changes only orientation: a faint tilted ochre ghost at left becomes solid upright at right, under one curved arrow and above a common floor. Both silhouettes retain identical frontal geometry and material; pale parchment ground and brass rim.. Actions: thing.upright.

Gate state: **accepted**. Final 31 px contextual blind read: Stand up (or right) the piece, high confidence. Built-in edit preserves the accepted original charcoal geometry; matching ochre material removes the transform/container cue.

**Visible objects and marks:** A horizontal line representing a surface, a tilted box on the left, an upright box on the right, and a curved arrow pointing from the tilted box to the upright one.

**Action interpretation:** Stand up (or right) the piece.
**Confidence:** High.

Evidence: `reads/parchment/thing.upright/0c84451579afa28c-5c3061251e`.

## charcoal / pawn.cond.

Intended: One large ivory pawn bust silhouette with THREE large colored status badges around its shoulders: a red wound drop on the left, a broad teal spiral on the right, and one gold dazed star above. These badges visibly belong to the pawn. Large separated simple silhouettes. No warning triangle, exclamation mark, report sign or distant target.. Actions: pawn.cond..

Gate state: **accepted**. After repaint, Open status markers/conditions menu, high confidence.

**Visible objects and marks:** A white pawn figure in the center, surrounded by three distinct icons: a yellow star above, a red teardrop (blood drop) to the left, and a blue swirl to the right, all enclosed in a dark circular button.

**Action interpretation:** Open the status markers or conditions menu for the piece.

**Confidence:** High. In virtual tabletops, a token surrounded by various generic symbols (like stars, drops, and swirls) is the standard iconography for adding or removing visual status effects or condition rings to a character.

Evidence: `reads/charcoal/pawn.cond./05275f87e81c5fd1-5c3061251e`.

## charcoal / pawn.cond.--alt1

Intended: Three overlapping red, teal and ivory circular status badges.. Actions: pawn.cond..

Gate state: **accepted**. Open status effects/markers to apply conditions, high confidence.

**Description:** A dark circular button containing three smaller, overlapping colored circles: a red circle with a white drop, a teal circle with a white leaf, and a tan circle with a dark shield.

**Action:** Open the status effects/markers menu to apply conditions to the piece.
**Confidence:** High

**Ambiguity/Alternative:** While standard for status markers, the icons could represent core stats (Health, Nature/Speed, Armor), making a plausible alternative "Edit token attributes/stats".

Evidence: `reads/charcoal/pawn.cond.--alt1/7908e842e9229527-5c3061251e`.

## parchment / pawn.cond.

Intended: One large ivory pawn bust silhouette with THREE large colored status badges around its shoulders: a red wound drop on the left, a broad teal spiral on the right, and one gold dazed star above. These badges visibly belong to the pawn. Large separated simple silhouettes. No warning triangle, exclamation mark, report sign or distant target.. Actions: pawn.cond..

Gate state: **accepted**. After repaint, Manage status effects / conditions, high confidence.

**Visible objects and marks:** A circular, gold-rimmed button containing a dark grey pawn piece in the center. The pawn is surrounded by three distinct symbols: a red blood drop on the left, a yellow star on top, and a blue swirl on the right.

**Action interpretation:** Manage status effects / conditions
**Confidence:** High

**Ambiguity / Alternative:** The specific combination of classic RPG condition symbols (blood/bleeding, star/stunned, swirl/confused) strongly points to status management. If ambiguous, it might more broadly mean "Edit piece markers" or "Edit attributes."

Evidence: `reads/parchment/pawn.cond./f40324dbe492910b-5c3061251e`.

## charcoal / pawn.mark.

Intended: One large five-point gold star with broad matte painted facets.. Actions: pawn.mark., pawn.mark.star.

Gate state: **learned**. Star marker alternative correctly recognized, but first guess Favorite. Indicator palette role and individual marker meaning require label/context.

**Visible objects and marks:** A golden, five-pointed star with 3D beveled shading, centered inside a dark grey circular button with a lighter grey border.

**Action interpretation:** Mark as favorite.
**Confidence:** Medium.

**Ambiguity and alternative:** While a star universally denotes "favorite" (e.g., saving the piece to a quick-access list), in the context of a piece already on a virtual tabletop, it frequently acts as a toggle for a visual condition. A plausible alternative is **Toggle star status marker** (adding a small star icon to the piece to denote a leader, objective, or special condition).

Evidence: `reads/charcoal/pawn.mark./c53100c3b0fbc6d4-5c3061251e`.

## parchment / pawn.mark.

Intended: A chunky ochre five-point marker star outlined in dark slate. PALE PARCHMENT GROUND everywhere inside the thin brass rim; absolutely no charcoal ground, no dark inset behind star. Simple broad star silhouette.. Actions: pawn.mark., pawn.mark.star.

Gate state: **learned**. After ground correction, star clearly recognized; Favorite first, Add Star Status alternative. Palette versus individual marker needs label.

**Description:** A circular button with a light beige background and a subtle golden rim. In the center is a prominent, 3D-shaded, five-pointed golden star with a dark outline.

**Action Interpretation:** Favorite / Save piece (adds the selected piece to a saved objects or favorites list for quick spawning later).
**Confidence:** Medium

**Ambiguity & Alternative:** The star is a generic UI symbol. While often used for favoriting, in a tabletop context, it could alternatively mean **Add Star Status/Badge**, which would attach a visible star icon to the piece to mark it for all players (e.g., denoting a VIP, leader, or objective).

Evidence: `reads/parchment/pawn.mark./3bb460407265d77d-5c3061251e`.

## charcoal / pawn.travel

Intended: An ivory pawn moving through a teal doorway, a bold ochre arrow pointing through the doorway.. Actions: pawn.travel.

Gate state: **accepted**. Send to another location/scene, medium confidence; destination necessarily contextual.

**Description:** The image shows a light-colored game pawn, a teal arched doorway, and a yellow arrow pointing from the pawn into the dark opening of the doorway.

**Action Interpretation:** Send to... (moves the piece to another location, scene, or container).
**Confidence:** Medium.

**Ambiguity:** The exact destination (e.g., a specific bag, another board, or a saved objects library) is not specified by the generic door icon. A plausible alternative is **"Remove from board"** (treating the doorway as an exit from the current game space).

Evidence: `reads/charcoal/pawn.travel/8f7a0870d76ac73a-5c3061251e`.

## parchment / pawn.travel

Intended: An ivory pawn moving through a teal doorway, a bold ochre arrow pointing through the doorway.. Actions: pawn.travel.

Gate state: **accepted**. Move piece to another location/zone, medium confidence.

**Description:** The icon shows a black game piece (resembling a pawn), an orange arrow pointing to the right, and a teal arched doorway. The arrow originates at the piece and points directly into the open doorway.

**Action Interpretation:** Move the piece to another location/zone.
**Confidence:** Medium.

**Ambiguity & Alternative:** While the icon clearly depicts the piece leaving its current context (going through a door), the specific destination is ambiguous. It could mean moving to another map/board, or putting the piece into a container. A plausible alternative interpretation is simply **"Remove from board"** (treating the doorway as a general exit).

Evidence: `reads/parchment/pawn.travel/c72a1554ac0fe934-5c3061251e`.

## charcoal / roof.style.

Intended: A small solid stone HOUSE with a very prominent broad teal tiled pitched ROOF. The roof takes two thirds of the picture, with obvious horizontal rows of chunky shingles and deep eaves. Small ochre wall and one dark square window underneath establish a roof, never a tent. No open A-frame, no camp scene.. Actions: roof.style., building.roof..

Gate state: **learned**. After repaint, solid house and teal tiled roof visible; model guesses Rest/Home. Roof-material picker is learned architecture context, not independently guessed.

**Visible objects and marks:** A small, rustic hut or house with a conical, teal, tiled roof, tan walls, and a single dark square window.

**Action interpretation:** Initiate a rest (e.g., short or long rest for the character).
**Confidence:** Medium.

**Ambiguity and alternative:** While a rustic hut often symbolizes making camp or resting in RPGs, it is still a dwelling. It could alternatively function as a generic "Home" button, returning the selected piece to its starting position or opening its main character sheet.

Evidence: `reads/charcoal/roof.style./2161a4721032103f-5c3061251e`.

## parchment / roof.style.

Intended: One thick ochre pitched roof with broad teal shingles, no house beneath it.. Actions: roof.style., building.roof..

Gate state: **learned**. Roof recognized; first guess visibility, not material style. Roof style picker needs its label.

**Description:** A circular button with a tan background featuring a 3D icon of a pitched roof with blue-green shingles and brown wooden trim.

**Action:** Toggle roof visibility (hide/show roof to reveal interiors).
**Confidence:** High

**Ambiguity/Alternative:** While standard for visibility toggling in 3D tabletops, a plausible alternative is that it moves the selected piece to a specific "roof" or upper elevation layer.

Evidence: `reads/parchment/roof.style./9db02324d917f961-5c3061251e`.

## charcoal / building.storeys.

Intended: A single stout THREE-STOREY stone tower, straight-on front view, with three clearly separated floors: one large teal window on each floor and thick ochre horizontal floor ledges. A plain small flat roof. Readable building storeys, not a stack of loose objects. No floating slabs.. Actions: building.storeys..

Gate state: **learned**. After repaint, three-tier tower recognized; change height/floor/level offered. Choosing generated storey count is learned context.

**Description:** A circular button displaying an icon of a three-tiered stone tower with gold bands between the levels and a small blue window on each tier.

**Action Interpretation:** Adjust elevation (change height)
**Confidence:** Medium

**Ambiguity:** While a tower is a common metaphor for verticality in 3D spaces, it could alternatively represent "change floor/level" if the tabletop supports multi-level maps, or "stack" if it refers to grouping tokens.

Evidence: `reads/charcoal/building.storeys./6548a3335d9ebc14-5c3061251e`.

## parchment / building.storeys.

Intended: A single stout THREE-STOREY stone tower, straight-on front view, with three clearly separated floors: one large teal window on each floor and thick ochre horizontal floor ledges. A plain small flat roof. Readable building storeys, not a stack of loose objects. No floating slabs.. Actions: building.storeys..

Gate state: **learned**. After repaint, three-tier tower recognized; height adjustment first. Generated storey-count picker requires building context.

**Description:** A circular button with a tan background and a gold border. It depicts a three-tiered grey stone tower with golden roofs and small teal arched windows on each level.

**Action Interpretation:** Change elevation / Adjust height
**Confidence:** High

**Ambiguity/Alternative:** While highly likely to represent vertical height in a 3D space, it could alternatively mean "Stack pieces" if the virtual tabletop uses this specific icon to group multiple tokens together vertically.

Evidence: `reads/parchment/building.storeys./f48d16c81599f9c3-5c3061251e`.

## charcoal / room.height.taller

Intended: A thick stone ceiling slab with one large ivory upward arrow lifting it.. Actions: room.height.taller.

Gate state: **learned**. Raise recognized; increasing ceiling/storey height rather than token elevation requires room context.

**Visible objects and marks:** A circular button with a dark background and a grey border. Inside is a flat, grey, stone-like slab or platform. A light-colored arrow points straight up from below, touching the underside of the slab.

**Action interpretation:** Elevate / Raise piece (move vertically upwards along the Z-axis).
**Confidence:** High.

**Ambiguity and alternative:** The icon strongly suggests upward movement. If it doesn't represent manual height adjustment, a plausible alternative is that it toggles a "Fly" or "Hover" status for the selected piece.

Evidence: `reads/charcoal/room.height.taller/742375fec47e9527-5c3061251e`.

## parchment / room.height.taller

Intended: A thick stone ceiling slab with one large ivory upward arrow lifting it.. Actions: room.height.taller.

Gate state: **learned**. Raise/lift recognized; increasing room ceiling/storey height requires label and room context.

**Visible objects and marks:** A circular button with a tan, parchment-like background and a gold border. Inside is a dark, upward-pointing arrow positioned directly beneath a flat, grey, rectangular block, with the arrow pointing at the block's bottom surface.

**Action interpretation:** Elevate (or Lift) the piece.
**Confidence:** High.

**Ambiguity and alternative:** While the 3D context strongly suggests moving the piece up along the Z-axis (elevation), it could alternatively mean "Bring to Front" or "Move to top of stack" if the tabletop handles overlapping objects with a strict layering system rather than free vertical movement.

Evidence: `reads/parchment/room.height.taller/7df19dc9135495e5-5c3061251e`.

## charcoal / room.height.shorter

Intended: A thick stone ceiling slab with one large ivory downward arrow lowering it.. Actions: room.height.shorter.

Gate state: **learned**. Lower/drop recognized; reducing ceiling/storey height rather than floor snapping requires room context.

**Visible objects and marks:** A dark circular button containing a 3D, textured grey disc (resembling a tabletop piece or base) with a distinct, light-colored arrow pointing straight down from underneath it.

**Action interpretation:** Drop to ground (snap to surface).
**Confidence:** High.

**Ambiguity:** While the icon strongly suggests dropping the piece completely to the nearest surface below it to fix floating, it could alternatively mean **"decrease elevation"** by a single unit if the virtual tabletop uses stepped height controls (especially if paired with a similar "up" arrow button).

Evidence: `reads/charcoal/room.height.shorter/72a4e10fd3195361-5c3061251e`.

## parchment / room.height.shorter

Intended: A thick stone ceiling slab with one large ivory downward arrow lowering it.. Actions: room.height.shorter.

Gate state: **learned**. Lower/drop-to-surface recognized; lowering ceiling height rather than moving a token needs room context.

**Visible objects and marks:** A gold circular button containing a dark grey, flat, 3D polygonal shape (resembling a game token or miniature base) positioned directly above a dark grey downward-pointing arrow.

**Action interpretation:** Drop to ground (snap to surface).
**Confidence:** High.

Evidence: `reads/parchment/room.height.shorter/8134b35099b4862b-5c3061251e`.

## charcoal / stair.flip

Intended: Three broad stone stair steps with a thick ivory double-headed diagonal arrow following their slope.. Actions: stair.flip.

Gate state: **learned**. Stairs and up/down direction recognized; exact stair direction toggle rather than elevation requires label.

**Visible objects and marks:** A circular button containing a 3D icon of a three-step staircase. A white double-headed arrow points diagonally up and down, parallel to the incline of the stairs.

**Action interpretation:** Adjust elevation (change height)
**Confidence:** High

Evidence: `reads/charcoal/stair.flip/721eef20b882d555-5c3061251e`.

## parchment / stair.flip

Intended: Three broad stone stair steps with a thick ivory double-headed diagonal arrow following their slope.. Actions: stair.flip.

Gate state: **learned**. Stairs plus up/down recognized; exact stair direction toggle rather than elevation needs label.

**Visible objects and marks:** A circular button with a gold border containing a 3D icon of a three-step staircase. A white double-headed arrow points diagonally up and down along the incline of the stairs.

**Action interpretation:** Adjust elevation (move the piece up or down vertically).
**Confidence:** High.

Evidence: `reads/parchment/stair.flip/dfd2d66f849bada7-5c3061251e`.

## charcoal / cast.saveGroup

Intended: Three small stout ivory pawns held together inside one broad teal circular bracket.. Actions: cast.saveGroup.

Gate state: **learned**. Grouped pawns visible; Group explicitly offered after Clone. Saving as a reusable cast group is learned workflow.

**Visible marks:** A teal, broken circular ring enclosing three light-colored game pawns, with the central pawn positioned slightly in front of the other two.

**Action:** Duplicate / Clone
**Confidence:** Medium

**Ambiguity:** The icon displays a collection of pieces seemingly bound together by the ring. Because of this, it could plausibly represent **"Group"** (linking multiple selected pieces together to move as one unit) or **"Select Similar"** rather than creating new copies.

Evidence: `reads/charcoal/cast.saveGroup/f15a9c6070f67b34-5c3061251e`.

## parchment / cast.saveGroup

Intended: Three small stout ivory pawns held together inside one broad teal circular bracket.. Actions: cast.saveGroup.

Gate state: **learned**. Group pieces recognized; saving a reusable cast group rather than grouping movement is learned workflow.

**Visible objects and marks:** A circular button with a gold border and a light background. In the center are three dark grey, pawn-like game pieces (one in front, two behind). They are partially enclosed by a thick teal circular band that is open at the top.

**Action interpretation:** Group pieces
**Confidence:** Medium

**Ambiguity:** The icon clearly represents "multiple pieces" or a "collection," but lacks a specific action modifier (like a '+' for clone or a cursor for select). Because the prompt mentions it appears when *a* (singular) piece is selected, a highly plausible alternative is **Select all similar pieces**.

Evidence: `reads/parchment/cast.saveGroup/91b0b885da83fd04-5c3061251e`.

## charcoal / ring.menu

Intended: Exactly three broad short horizontal ivory bars stacked evenly, simple hamburger menu symbol.. Actions: menu.

Gate state: **accepted**. Open menu / more options, high confidence.

**Visible objects and marks:** A dark circular button with a grey border containing three thick, horizontal, parallel, light-colored rectangular bars stacked vertically (commonly known as a "hamburger" icon).

**Action interpretation:** Open menu / More options (or Properties)
**Confidence:** High

**Ambiguity / Alternative:** While this is the universal UI symbol for a menu, in a virtual tabletop context, the thick bars visually resemble a stack of tokens or cards. A plausible alternative action is **Stack** (or View Stack contents).

Evidence: `reads/charcoal/ring.menu/a8957ef809f012e8-5c3061251e`.

## charcoal / ring.menu--alt1

Intended: Exactly three large ivory dots arranged horizontally.. Actions: menu.

Gate state: **accepted**. More options / extended menu, high confidence.

**Visible objects and marks:** A dark circular button with a metallic border containing three horizontal, light-colored dots (an ellipsis).

**Action interpretation:** More options (opens an extended menu).
**Confidence:** High.

**Ambiguity and alternative:** While the ellipsis universally means "more," the exact nature of the expanded menu is generic. A plausible alternative in a VTT context is that it specifically opens the "Properties" or "Settings" dialog for that piece.

Evidence: `reads/charcoal/ring.menu--alt1/efd2c2aac489ac8b-5c3061251e`.

## parchment / ring.menu

Intended: Exactly three broad short horizontal ivory bars stacked evenly, simple hamburger menu symbol.. Actions: menu.

Gate state: **accepted**. Open menu / More options, high confidence.

**Visible objects and marks:** A circular button with a gold rim and a light-colored center containing three dark, horizontal, parallel lines (a standard "hamburger" menu icon).

**Action interpretation:** Open menu / More options
**Confidence:** High

**Ambiguity/Alternative:** The icon is a universal standard for a menu. However, in the specific context of a tabletop game piece, a plausible alternative interpretation is "View piece properties/stats".

Evidence: `reads/parchment/ring.menu/fd17e2c5006ede05-5c3061251e`.

## charcoal / ring.close

Intended: One bold ivory diagonal X made of two broad painted strokes.. Actions: ring.close, pawn.mark.none.

Gate state: **learned**. X recognized; standalone guess Delete, with closing contextual menu explicitly offered. Actual menu-dismiss position supplies meaning.

**Description:** A dark circular button with a thin grey border, containing a prominent, light-colored, beveled "X" mark in the center.

**Action Interpretation:** Delete (or remove) the piece.
**Confidence:** High

**Ambiguity & Alternative:** While "X" strongly suggests deletion when applied to a specific object, it is also a universal symbol for "close" or "cancel". A plausible alternative is that it simply deselects the piece and closes the contextual menu.

Evidence: `reads/charcoal/ring.close/21cfc42bdde7f3a1-5c3061251e`.

## parchment / ring.close

Intended: One bold ivory diagonal X made of two broad painted strokes.. Actions: ring.close, pawn.mark.none.

Gate state: **learned**. X recognized; closing/deselecting menu offered after Delete. Its menu-toggle location supplies meaning.

**Description:** A circular button with a textured, tan or gold background containing a dark grey, beveled "X" symbol in the center.

**Action:** Delete (or remove) the piece.
**Confidence:** High.

**Ambiguity:** While "X" is the nearly universal standard for "delete" when applied to a specific object, it could plausibly mean "Deselect" the piece (or close its menu) if the interface lacks a separate close function.

Evidence: `reads/parchment/ring.close/1e3899bbb80d9bf4-5c3061251e`.

## charcoal / pawn.mark.circle

Intended: One large solid orange circle.. Actions: pawn.mark.circle.

Gate state: **learned**. Orange circle recognizable. Choosing this marker rather than changing piece color requires labelled Indicators menu.

**Description:** A glossy, bright orange circle (resembling a sphere or gem) enclosed by a thin, dark grey ring on a dark background.

**Action:** Change the selected piece's color to orange.
**Confidence:** High.

**Ambiguity & Alternative:** While colored circles in these menus almost universally denote color selection, it is slightly ambiguous whether it changes the physical tint of the object or its ownership.
**Alternative:** Assign control of the piece to the "Orange" player.

Evidence: `reads/charcoal/pawn.mark.circle/ef801e6329d92841-5c3061251e`.

## parchment / pawn.mark.circle

Intended: One large solid orange circle.. Actions: pawn.mark.circle.

Gate state: **learned**. Orange circle recognized; label distinguishes named indicator from color tint/status ring.

**Visible objects and marks:** A circular icon featuring a spherically shaded, bright orange center surrounded by a thick, light beige or off-white outer ring.

**Action interpretation:** Change color / Tint
**Confidence:** Medium

**Ambiguity:** The distinct outer ring could also visually represent adding an **"Aura" or "Status Ring"** around the selected piece, rather than just changing its base color.

Evidence: `reads/parchment/pawn.mark.circle/49007b34094919a4-5c3061251e`.

## charcoal / pawn.mark.diamond

Intended: One large solid purple diamond with four clear corners.. Actions: pawn.mark.diamond.

Gate state: **accepted**. Add status marker/token, medium confidence; diamond/gem recognized.

**Visible objects and marks:** A dark circular button with a grey border. Inside is a faceted, 3D-style purple gem or crystal with a bright highlight on its upper-left side.

**Action interpretation:** Add a status marker or token to the piece.
**Confidence:** Medium

**Ambiguity and alternative:** The purple gem is not a universal UI standard. While it likely represents adding a generic marker or condition, it could alternatively mean "mark as loot/treasure" or apply a specific game-system condition (e.g., "magical" or "crystalized").

Evidence: `reads/charcoal/pawn.mark.diamond/673e4c08a883490e-5c3061251e`.

## parchment / pawn.mark.diamond

Intended: One large solid purple diamond with four clear corners.. Actions: pawn.mark.diamond.

Gate state: **accepted**. Toggle purple diamond status marker, medium confidence.

**Description:** A circular button with a gold-colored border and a cream background. In the center is a 3D-beveled, purple diamond (rhombus) icon.

**Action Interpretation:** Toggle a purple diamond status marker on the piece.
**Confidence:** Medium

**Ambiguity:** The symbol is generic and its exact mechanical meaning is likely user-defined. A plausible alternative action is that it changes the color tint of the selected piece to purple.

Evidence: `reads/parchment/pawn.mark.diamond/e605fde7593b8fac-5c3061251e`.

## charcoal / pawn.mark.triangle

Intended: One large solid green equilateral triangle pointing upward.. Actions: pawn.mark.triangle.

Gate state: **learned**. Triangle recognized but guessed elevation. This is a named selectable marker, whose meaning is assigned by players.

**Description:** A dark circular button with a light grey border. Inside is a solid green triangle pointing upwards, featuring a slight 3D bevel or shading effect.

**Action Interpretation:** Elevate / Move Up (increase the piece's height on the Z-axis)
**Confidence:** Medium

**Ambiguity:** An upward-pointing triangle is a generic symbol for "up" or "increase." Because it lacks specific spatial context (like a line underneath it), a plausible alternative action is **Scale Up** (increase the physical size of the piece).

Evidence: `reads/charcoal/pawn.mark.triangle/dc7e7df5620c3396-5c3061251e`.

## parchment / pawn.mark.triangle

Intended: One large solid green equilateral triangle pointing upward.. Actions: pawn.mark.triangle.

Gate state: **learned**. Green triangle recognized; labelled Indicators menu distinguishes marker from Move up.

**Visible objects and marks:** A circular button with a textured, parchment-like background and a thin brown border. In the center is a solid green, upward-pointing triangle with a slight 3D bevel effect.

**Action interpretation:** Elevate / Move piece up (increase Z-axis height).
**Confidence:** High.

**Ambiguity/Alternative:** While standard for upward movement in a 3D space (like making a character fly or placing them on a higher tier), it could plausibly mean "Scale Up" (increase piece size) if the menu uses this icon for resizing rather than positioning.

Evidence: `reads/parchment/pawn.mark.triangle/87254f90c37f9a32-5c3061251e`.

## charcoal / pawn.mark.moon

Intended: One large pale icy blue crescent moon, broad curved body and clear dark crescent cutout.. Actions: pawn.mark.moon.

Gate state: **learned**. Moon recognized and read as sleep status. Indicator is user-defined; exact marker meaning learned.

**Description:** A circular button displaying a light blue crescent moon facing left against a dark background, enclosed by a subtle double-ring border.

**Action Interpretation:** Apply a "Sleep" status marker to the piece.
**Confidence:** Medium

**Ambiguity & Alternative:** While a crescent moon is the standard UI trope for sleep or unconsciousness, it can symbolize other night-related concepts depending on the specific game system. A plausible alternative is that it initiates a "Rest" action (e.g., short or long rest) for the selected character to recover stats.

Evidence: `reads/charcoal/pawn.mark.moon/33b4e2b35ce9e041-5c3061251e`.

## parchment / pawn.mark.moon

Intended: One large pale icy blue crescent moon, broad curved body and clear dark crescent cutout.. Actions: pawn.mark.moon.

Gate state: **learned**. Moon/sleep status recognized. Actual indicator meaning remains player-defined.

**Description:** A circular button with a gold border containing a light blue crescent moon on a pale, cream-colored background.

**Action Interpretation:** Toggle "Sleep" or "Unconscious" status effect.
**Confidence:** Medium

**Ambiguity:** The crescent moon is a common RPG trope that can represent multiple mechanics depending on the specific game system.
**Plausible Alternative:** Initiate a "Rest" action (e.g., short or long rest) for the selected character.

Evidence: `reads/parchment/pawn.mark.moon/445536b40bb77830-5c3061251e`.

## charcoal / pawn.mark.square

Intended: Exactly one plain solid royal blue square geometric shape with four equal straight sides and four right-angle corners, floating alone centered on the circular badge. Face-on flat square, no perspective. NO pole, NO post, NO handle, NO stand, NO sign, NO stick, no support, no object attached below it.. Actions: pawn.mark.square.

Gate state: **learned**. After repaint, blue square correctly recognized. Label distinguishes named marker from color/Stop.

**Visible objects and marks:** A dark circular button with a lighter grey border. In the center is a solid blue square with a subtle 3D bevel effect.

**Action interpretation:** Open color picker / Change piece color (indicating the current color is blue).
**Confidence:** Medium.

**Ambiguity:** It is unclear whether the primary signifier is the color (blue) or the shape (square).
**Plausible alternative:** "Stop" (stopping an animation, physics, or audio track attached to the piece), as a square is the universal media symbol for stop.

Evidence: `reads/charcoal/pawn.mark.square/4d17143050b74b66-5c3061251e`.

## parchment / pawn.mark.square

Intended: Exactly one plain solid royal blue square geometric shape with four equal straight sides and four right-angle corners, floating alone centered on the circular badge. Face-on flat square, no perspective. NO pole, NO post, NO handle, NO stand, NO sign, NO stick, no support, no object attached below it.. Actions: pawn.mark.square.

Gate state: **learned**. After repaint, plain blue square recognized. Label distinguishes named indicator from tint/Stop.

**Visible objects and marks:** A circular button with a gold-colored rim and a light tan interior. In the center is a solid, slightly embossed blue square.

**Action interpretation:** Change color / Tint (opens a color picker, with the blue square acting as a swatch of the current color).
**Confidence:** Medium.

**Ambiguity:** A solid square is a generic symbol that can have multiple meanings depending on the exact context of the physics engine or game rules.
**Plausible alternative:** Stop (e.g., halt a piece's physics movement or a rolling die), as a solid square is the universal media control symbol for "stop".

Evidence: `reads/parchment/pawn.mark.square/3cf0269c61279132-5c3061251e`.

## charcoal / pawn.mark.cross

Intended: One large bold red diagonal cross made of two wide strokes.. Actions: pawn.mark.cross.

Gate state: **learned**. Red X recognized but guessed Delete. Named marker choice requires labelled Indicators menu.

**Visible objects and marks:** A dark circular button with a grey border, containing a thick, beveled red 'X' in the center.

**Action interpretation:** Delete (or remove) the selected piece.
**Confidence:** High.

**Ambiguity and alternative:** While standard for "delete", it could plausibly mean "Cancel" (e.g., to cancel a pending movement or action associated with the piece).

Evidence: `reads/charcoal/pawn.mark.cross/a0d804cfb221da39-5c3061251e`.

## parchment / pawn.mark.cross

Intended: One large bold red diagonal cross made of two wide strokes.. Actions: pawn.mark.cross.

Gate state: **learned**. Red X recognized; standalone Delete guess. Named marker requires labelled Indicators menu.

**Visible objects and marks:** A circular button with a tan, slightly shaded background containing a thick, red 'X' mark in the center.

**Action interpretation:** Delete (or remove) the selected piece.
**Confidence:** High.

**Ambiguity/Alternative:** While a red 'X' is the standard convention for deletion in this context, a plausible alternative is "Close menu" (dismissing the contextual menu without taking any action), especially if the software uses a different icon like a trash can for deletion.

Evidence: `reads/parchment/pawn.mark.cross/74d76c50024b34d9-5c3061251e`.

## charcoal / pawn.mark.skull

Intended: One chunky ivory skull silhouette with two broad dark eye sockets and simple square jaw.. Actions: pawn.mark.skull.

Gate state: **learned**. Skull recognized; death status offered after Delete. Named marker choice requires labelled Indicators menu.

**Description:** A stylized, beige human skull with dark, hollow eye sockets and a nasal cavity, centered within a dark circular button.

**Action Interpretation:** Delete / Remove piece
**Confidence:** Medium

**Ambiguity & Alternative:** The skull icon is ambiguous in a tabletop context; while it frequently means "delete" or "destroy" (removing the token from the board), it is also commonly used to apply a "dead" or "defeated" status effect marker to the piece while leaving it in play.

Evidence: `reads/charcoal/pawn.mark.skull/cfb20473f1aeeac6-5c3061251e`.

## parchment / pawn.mark.skull

Intended: One chunky ivory skull silhouette with two broad dark eye sockets and simple square jaw.. Actions: pawn.mark.skull.

Gate state: **learned**. Skull/dead status recognized; skull marker's exact meaning remains player-defined.

**Description:** A stylized white skull with dark eye sockets and teeth, centered on a circular gold or bronze button.

**Action Interpretation:** Mark piece as dead / defeated (apply death status).
**Confidence:** High

**Ambiguity & Alternative:** While a skull in a VTT typically applies a "dead" status overlay to a token, it could alternatively function as a thematic **Delete / Remove piece** button if the software uses genre-specific icons instead of a standard trash can.

Evidence: `reads/parchment/pawn.mark.skull/5afb5c76dddd7adc-5c3061251e`.

## charcoal / measure.start

Intended: One plain broad ivory measuring ruler with exactly five thick black tick marks along one long edge. Obvious simple rectangular ruler silhouette, no writing. NO dots, NO gems, NO caps, NO scroll, NO ornament, NO decorative endpieces.. Actions: measure.start.

Gate state: **accepted**. After repaint, Measure distance, high confidence.

**Visible objects and marks:** A circular button with a dark background containing a diagonal, golden-colored ruler with tick marks along its upper edge.

**Action interpretation:** Measure distance (activates a measurement tool, likely starting from the selected piece).
**Confidence:** High.

Evidence: `reads/charcoal/measure.start/3d5a35f98dc18437-5c3061251e`.

## parchment / measure.start

Intended: A stout ivory measuring ruler diagonally between two broad teal endpoint dots. Only three large dark tick marks.. Actions: measure.start.

Gate state: **accepted**. Measure distance, high confidence.

**Description:** A circular tan button displaying an icon of two teal spheres connected by a diagonal line with tick marks, strongly resembling a ruler.

**Action:** Measure distance.

**Confidence:** High.

**Ambiguity/Alternative:** The icon is fairly standard for measurement. However, if the segmented line is interpreted as a chain or spring rather than a ruler, a plausible alternative action is "link" or "attach" to another piece.

Evidence: `reads/parchment/measure.start/f84962fa86d384f9-5c3061251e`.

## charcoal / measure.keep

Intended: One broad brass anchor planting a small teal circular spell disc firmly in place.. Actions: measure.keep, ruler.norounds.

Gate state: **learned**. Anchor/pin recognized. Keeping a ruler/template visible rather than freezing an entity is learned measuring context.

**Visible objects and marks:** A golden anchor resting on a teal, oval base inside a dark circular button with a grey border.

**Action interpretation:** Lock (or pin) the piece in place to prevent accidental movement.
**Confidence:** High.

Evidence: `reads/charcoal/measure.keep/6216559a331e4573-5c3061251e`.

## parchment / measure.keep

Intended: One broad brass anchor planting a small teal circular spell disc firmly in place.. Actions: measure.keep, ruler.norounds.

Gate state: **learned**. Anchor/lock recognized; keep measurement/template visible versus freeze a piece requires measuring context.

Visible objects: A circular button with a beige background featuring a golden anchor icon. The bottom curve of the anchor has a teal accent.

Action interpretation: Lock piece in place (Anchor)
Confidence: High

Evidence: `reads/parchment/measure.keep/e994326ccddb6a15-5c3061251e`.

## charcoal / measure.keepRounds

Intended: One chunky brass hourglass with ivory sand between two thick horizontal supports.. Actions: measure.keepRounds.

Gate state: **learned**. Hourglass recognized; timer is offered after history. Persisting for game rounds needs label and measurement context.

**Visible objects and marks:** A circular button with a dark background and a grey border. Inside is a 3D-rendered golden hourglass with teal bands on its side pillars and white sand flowing from the top bulb to the bottom.

**Action interpretation:** View the history or action log of the piece.
**Confidence:** Medium.

**Ambiguity and alternative:** The hourglass is a universal symbol for time, which can have multiple meanings depending on the specific game system. Because it is a contextual action on a specific piece, it could alternatively mean **"Start/Set Timer"** (especially if the selected piece functions as a timer object in the game) or apply a **"Delay/Wait"** status to the piece.

Evidence: `reads/charcoal/measure.keepRounds/9c85b7a3441dff51-5c3061251e`.

## parchment / measure.keepRounds

Intended: One chunky brass hourglass with ivory sand between two thick horizontal supports.. Actions: measure.keepRounds.

Gate state: **learned**. Hourglass/timer recognized; duration in game rounds requires measuring context.

**Visible objects and marks:** A circular button with a light beige background and a golden border. In the center is an hourglass with a gold frame, blue glass bulbs, and white sand partially filling both the top and bottom.

**Action interpretation:** Start/stop timer
**Confidence:** Medium

**Ambiguity:** The hourglass is a generic symbol for time and could represent several time-related functions depending on the specific game system.
**Plausible alternative:** Delay turn/action (setting a "wait" status on the piece).

Evidence: `reads/parchment/measure.keepRounds/e0f986e06ba24a44-5c3061251e`.

## charcoal / measure.attach

Intended: Two thick interlocking chain links, one ochre and one teal.. Actions: measure.attach, ruler.detach.

Gate state: **accepted**. Link / Attach to another piece, high confidence.

**Description:** A dark circular button containing an icon of two interlocking 3D chain links, one golden-orange and the other teal.

**Action:** Link / Attach (to another piece)
**Confidence:** High

**Ambiguity:** While the "link" metaphor is universally understood, the exact target of the link is ambiguous without more context. A plausible alternative is that it links the 3D piece to a 2D data source, such as a character sheet or an external URL.

Evidence: `reads/charcoal/measure.attach/bcf822251f0e01c5-5c3061251e`.

## parchment / measure.attach

Intended: Two thick interlocking chain links, one ochre and one teal.. Actions: measure.attach, ruler.detach.

Gate state: **accepted**. Link / Attach to another piece, high confidence.

**Description:** A circular button displaying two interlocking chain links, one golden-orange and the other teal, set against a light beige background.

**Action Interpretation:** Link / Attach (to another piece)
**Confidence:** High

**Ambiguity / Alternative:** The icon is a standard metaphor for linking. While highly likely to mean attaching one 3D piece to another (e.g., a rider to a mount), a plausible alternative in a tabletop context is **Group**, used to bind multiple selected pieces together so they move as a single unit.

Evidence: `reads/parchment/measure.attach/263129739d28b7ec-5c3061251e`.

## charcoal / measure.say

Intended: One broad ivory speech bubble containing a single teal pawn silhouette.. Actions: measure.say.

Gate state: **learned**. Speech bubble and pawn recognized; speech/chat offered after label/description. Announcing caught pawns requires measuring context.

**Visible objects and marks:** A dark circular button containing a cream-colored speech bubble. Inside the speech bubble is a teal, pawn-style game piece.

**Action interpretation:** Add a label, tooltip, or description to the selected piece.
**Confidence:** Medium.

**Ambiguity and alternative:** The speech bubble icon universally denotes text or communication, but its specific function varies by platform. While a static label is most likely for a generic piece, it could alternatively mean **"Speak as"** this piece in the game's text chat (a common feature in RPG-focused virtual tabletops).

Evidence: `reads/charcoal/measure.say/fa5c317855de1fd9-5c3061251e`.

## parchment / measure.say

Intended: One broad ivory speech bubble containing a single teal pawn silhouette.. Actions: measure.say.

Gate state: **learned**. Pawn/speech bubble recognized; speaking in chat offered after text properties. Announcing caught pawns needs measuring context.

**Description:** A circular button with a gold rim. It contains a white speech bubble with a dark outline. Inside the speech bubble is a teal chess pawn.

**Action Interpretation:** Edit the piece's name, description, or tooltip.
**Confidence:** Medium.

**Ambiguity & Alternative:** The icon is ambiguous because a speech bubble typically denotes active communication (chatting) rather than static text properties (like a label or name).
**Alternative:** Send a chat message as this piece (speak as piece).

Evidence: `reads/parchment/measure.say/9a63d862d84f2d70-5c3061251e`.

## charcoal / template.remove

Intended: One stout dark metal waste bin with an ivory lid and two broad ivory vertical slats.. Actions: template.remove, template.clear.

Gate state: **accepted**. Delete/remove selected item, high confidence; template context supplies target.

Visible objects: A circular button containing a 3D-style icon of a trash can or rubbish bin with a lid and a top handle.
Action: Delete or remove the selected piece.
Confidence: High.

Evidence: `reads/charcoal/template.remove/b510f46fe0200549-5c3061251e`.

## parchment / template.remove

Intended: One stout dark metal waste bin with an ivory lid and two broad ivory vertical slats.. Actions: template.remove, template.clear.

Gate state: **accepted**. Delete / Remove, high confidence.

**Description:** The image shows a circular button with a glowing gold border. Inside is a stylized depiction of a dark grey trash can or wastebasket with light vertical panels and a lid featuring a top handle.

**Action:** Delete (or Remove)
**Confidence:** High

Evidence: `reads/parchment/template.remove/72bd5ca1c75d3b6d-5c3061251e`.

## charcoal / measure.shape.line

Intended: One plain elongated flat teal rectangular strip marking a linear area on a faint simple five-foot square grid. Very long narrow rectangle, straight parallel edges. NO frame, NO gold trim, NO gems, NO plaque, NO nameplate, NO text.. Actions: measure.as.line, measure.shape.line.

Gate state: **learned**. After repaint, plain teal line on grid recognized as measuring/drawing line. Linear area template selected via labelled shape palette.

**Visible objects and marks:** A circular button with a dark grey border. The dark interior contains a faint grey grid pattern, overlaid with a thick, diagonal teal line segment.

**Action interpretation:** Measure distance (from the selected piece).
**Confidence:** Medium.

**Ambiguity:** While a line on a grid is a standard icon for measuring distance in virtual tabletops, it could alternatively represent a simple "draw line" tool.

Evidence: `reads/charcoal/measure.shape.line/c1d54dd02d36be8e-5c3061251e`.

## parchment / measure.shape.line

Intended: One plain elongated flat teal rectangular strip marking a linear area on a faint simple five-foot square grid. Very long narrow rectangle, straight parallel edges. NO frame, NO gold trim, NO gems, NO plaque, NO nameplate, NO text.. Actions: measure.as.line, measure.shape.line.

Gate state: **learned**. Plain horizontal template geometry is correct; read as minus/decrease in isolation. Line template depends on shape-palette context, not guessed action.

**Visible objects and marks:** A circular button with a metallic gold-colored rim. The background is a light tan surface with a subtle square grid pattern. In the center is a horizontal, teal rectangular bar with slight 3D shading, resembling a minus sign.

**Action interpretation:** Decrease scale/size.
**Confidence:** Medium.

**Ambiguity and alternative:** The minus symbol is a generic UI convention that can mean several things (decrease, remove, collapse). Given the specific "3D virtual tabletop" context and the grid background, a strong plausible alternative is **"Lay flat" or "Make prone"**, where the horizontal bar visually represents a standing 3D piece being laid down flat onto the grid.

Evidence: `reads/parchment/measure.shape.line/33bd2f29da514626-5c3061251e`.

## charcoal / measure.shape.cone

Intended: One broad teal fan-shaped spell wedge, a clear pointed origin and wide curved far edge.. Actions: measure.as.cone, measure.shape.cone.

Gate state: **learned**. Cone-sector wedge shape recognized; standalone arrow/down guess. Shape choice needs labelled template palette.

**Visible objects and marks:** A dark circular button with a thin grey border, containing a teal, downward-pointing triangular wedge with a slightly convex top edge.

**Action interpretation:** Lower elevation (move down on the Z-axis).
**Confidence:** Medium.

**Ambiguity:** The downward-pointing shape is a generic directional indicator in 3D space. A plausible alternative action is "Move to bottom of stack" (if interacting with stacked pieces like cards or tokens).

Evidence: `reads/charcoal/measure.shape.cone/49c2ca14f69b0806-5c3061251e`.

## parchment / measure.shape.cone

Intended: One broad teal fan-shaped spell wedge, a clear pointed origin and wide curved far edge.. Actions: measure.as.cone, measure.shape.cone.

Gate state: **learned**. Cone-shaped field recognized as vision cone; choosing cone measurement template requires palette label.

**Visible objects and marks:** A circular gold-colored button containing a solid teal icon shaped like a downward-pointing cone or wedge, which narrows to a small circle at the bottom vertex.

**Action interpretation:** Toggle or configure vision (Field of View / Line of Sight) for the piece.
**Confidence:** High.

**Ambiguity/Alternative:** While the icon is a standard representation of a vision cone in gaming contexts, it could alternatively represent toggling a directional light source.

Evidence: `reads/parchment/measure.shape.cone/4e0475d965e4302d-5c3061251e`.

## charcoal / measure.shape.circle

Intended: One thick teal circular ring lying flat on the ground as a broad ellipse with dark center.. Actions: measure.as.circle, measure.shape.circle.

Gate state: **learned**. Ring/aura recognized; selecting circular measurement area needs measuring context.

**Visible objects and marks:** A circular icon containing a 3D, teal-colored ring or torus with a slightly textured surface, set against a dark background.

**Action interpretation:** Add/toggle a status ring (or base marker) on the piece.
**Confidence:** High

**Ambiguity:** While clearly a ring, it could represent a physical attachment to the miniature's base or a spatial radius effect.
**Plausible alternative:** Add an aura.

Evidence: `reads/charcoal/measure.shape.circle/e01d8ecd694af3ef-5c3061251e`.

## parchment / measure.shape.circle

Intended: One thick teal circular ring lying flat on the ground as a broad ellipse with dark center.. Actions: measure.as.circle, measure.shape.circle.

Gate state: **learned**. Ring/aura recognized; circular measurement template chosen via labelled palette.

**Visible objects and marks:** A circular button with a textured, tan background containing a 3D, teal-colored torus (thick ring).

**Action interpretation:** Toggle status ring / aura
**Confidence:** Medium

**Ambiguity and Alternative:** The icon is somewhat ambiguous because the thick, solid nature of the ring looks like a physical object rather than a typical semi-transparent magical aura.
**Plausible alternative:** Attach or change the miniature's base.

Evidence: `reads/parchment/measure.shape.circle/b409b5f83007fe3f-5c3061251e`.

## charcoal / measure.shape.sphere

Intended: One large teal sphere with a broad ivory equatorial band and one broad vertical curved meridian band.. Actions: measure.as.sphere, measure.shape.sphere.

Gate state: **learned**. Sphere and crossed bands visibly recognized; standalone lock/package guess. Template shape choice requires labelled measurement palette.

**Visible objects and marks:** A teal sphere wrapped with two intersecting beige bands that form a cross, enclosed within a dark circular border.

**Action interpretation:** Lock (secure piece in place)
**Confidence:** Medium

**Ambiguity:** The visual metaphor of "strapping" or "binding" an object to secure it is non-standard compared to a typical padlock icon.
**Plausible alternative:** "Package" or "Save as Prefab" (the bands represent wrapping the object up to save it to a library).

Evidence: `reads/charcoal/measure.shape.sphere/a17df99a9488557d-5c3061251e`.

## parchment / measure.shape.sphere

Intended: One large teal sphere with a broad ivory equatorial band and one broad vertical curved meridian band.. Actions: measure.as.sphere, measure.shape.sphere.

Gate state: **learned**. Sphere with bands recognized; standalone rotation/target guess. Spherical template choice requires labelled palette.

**Description:** A teal sphere wrapped by two thick, dark grey intersecting bands that form a cross, enclosed within a glowing golden circular border.

**Action:** Rotate piece (activates rotation gizmo).
**Confidence:** Medium.

**Ambiguity:** While the bands wrapping the sphere strongly suggest 3D rotation axes, the resulting cross shape also resembles crosshairs. A plausible alternative is "Target piece" or "Center camera on piece."

Evidence: `reads/parchment/measure.shape.sphere/9a7cd8307dc4e155-5c3061251e`.

## charcoal / measure.shape.cube

Intended: Exactly ONE completely plain teal geometric CUBE, three broad undecorated teal faces visible, with thick ivory edges. The faces are blank solid teal with subtle painted shading only. No symbols anywhere on cube: NO pips, NO dots, NO flame, NO star, NO swirl, NO gems, NO runes, NO numbers, NO ornament. This is a plain cubic area-of-effect volume, absolutely NOT a die or dice. Simple geometric silhouette, no elaborate trim.. Actions: measure.as.cube, measure.shape.cube.

Gate state: **learned**. Blind read identifies cube geometry; selecting a cube measurement template requires shape-palette context.

**Visible objects and marks:** A dark grey circular button with a lighter grey border, containing an isometric illustration of a teal 3D cube with light tan/gold edges.

**Action interpretation:** Change the selected piece's shape to a 3D cube (or extrude it into a 3D block).
**Confidence:** Medium.

**Ambiguity:** A blank cube is a generic symbol for 3D geometry. Because it lacks specific context like dice pips or a bounding box outline, it could alternatively mean "Toggle 3D model representation" (switching the piece between a flat 2D token and a 3D object).

Evidence: `reads/charcoal/measure.shape.cube/24b17a43c643220d-5c3061251e`.

## parchment / measure.shape.cube

Intended: Exactly ONE completely plain teal geometric CUBE, three broad undecorated teal faces visible, with thick ivory edges. The faces are blank solid teal with subtle painted shading only. No symbols anywhere on cube: NO pips, NO dots, NO flame, NO star, NO swirl, NO gems, NO runes, NO numbers, NO ornament. This is a plain cubic area-of-effect volume, absolutely NOT a die or dice. Simple geometric silhouette, no elaborate trim.. Actions: measure.as.cube, measure.shape.cube.

Gate state: **learned**. Visible cube correctly identified. Generic 3D object interpretation; measurement-template meaning learned in shape palette.

**Description:** A circular button with a gold border containing a solid teal isometric 3D cube.

**Action Interpretation:** Change 3D model / Access 3D object properties.
**Confidence:** Low.

**Ambiguity & Alternative:** A generic cube is a universal placeholder icon in 3D environments and can represent many concepts. A plausible alternative is that it converts the selected piece into a **container** (or opens its inventory).

Evidence: `reads/parchment/measure.shape.cube/41463d674a6e83ca-5c3061251e`.

## charcoal / thing.hide--alt2

Intended: One large open ivory eye with a clear teal pupil and no slash, curtain or obstruction.. Actions: thing.hide.

Gate state: **accepted**. Eye read as toggle visibility Hide/Reveal, high confidence; un-slashed eye supplies reveal direction.

**Description:** A circular icon featuring a stylized eye. It has a dark background, a thin grey outer ring, gold-colored eyelids, a cream-colored sclera, and a teal iris with a black pupil and a white reflection highlight.

**Action:** Toggle visibility (hide/reveal the piece)
**Confidence:** High

**Ambiguity:** While an eye universally relates to vision, it can ambiguously mean either "make this visible/invisible to others" or "look closely at this".
**Plausible Alternative:** View details / Examine piece (e.g., open character sheet or larger artwork).

Evidence: `reads/charcoal/thing.hide--alt2/03db7f8eda5e01ce-5c3061251e`.

## parchment / thing.hide--alt2

Intended: One large open ivory eye with a clear teal pupil and no slash, curtain or obstruction.. Actions: thing.hide.

Gate state: **accepted**. Toggle visibility Hide/Reveal to other players, high confidence.

**Description:** A circular button with a tan/gold background featuring a stylized, open eye with a dark outline and a teal iris.

**Action:** Toggle visibility (hide or reveal the piece to other players).
**Confidence:** High

**Ambiguity:** While an eye is the universal standard for visibility toggles, in a complex VTT it might instead open a menu to configure the piece's own "vision" (e.g., darkvision, line of sight).
**Alternative:** Configure token vision/lighting settings.

Evidence: `reads/parchment/thing.hide--alt2/bd196e88ed0e16b4-5c3061251e`.

## charcoal / thing.lock--alt2

Intended: One stout iron padlock with brass keyhole plate and a visibly open raised shackle.. Actions: thing.lock.

Gate state: **accepted**. Unlock piece, high confidence.

Visible objects: A circular button containing an icon of an open padlock with a dark body and a gold keyhole.
Action: Unlock piece
Confidence: High

Evidence: `reads/charcoal/thing.lock--alt2/d35e9d0e15ce58bd-5c3061251e`.

## parchment / thing.lock--alt2

Intended: One stout iron padlock with brass keyhole plate and a visibly open raised shackle.. Actions: thing.lock.

Gate state: **accepted**. Unlock piece, high confidence.

**Visible objects and marks:** A stylized, dark grey padlock with a gold keyhole plate and small rivets, set against a glowing tan circular background. The shackle of the padlock is in the open position.

**Action interpretation:** Unlock piece
**Confidence:** High

**Ambiguity:** While the open lock universally symbolizes "unlock," it could plausibly mean "Lock piece" if the specific software's UI paradigm uses the icon to display the piece's *current* (unlocked) state rather than the action the button performs.

Evidence: `reads/parchment/thing.lock--alt2/db1e313132b2b5af-5c3061251e`.

## charcoal / thing.open--alt2

Intended: A chunky wooden door fully closed within its simple stone frame, one large brass handle.. Actions: thing.open.

Gate state: **accepted**. Toggle open/closed state recognized, medium confidence; closed door supplies close direction.

**Visible objects and marks:** A circular icon depicting a closed, arched wooden door with vertical planks. It is set within a grey stone archway and features a golden ring handle on its right side.

**Action interpretation:** Toggles the selected piece's state between open and closed (typically for door props to update line of sight or movement blocking).
**Confidence:** Medium

**Ambiguity:** The door icon is a common metaphor for transition or exiting.
**Plausible alternative:** It links the selected piece to another map or scene, acting as a portal or teleportation point.

Evidence: `reads/charcoal/thing.open--alt2/c434dd8e826298de-5c3061251e`.

## parchment / thing.open--alt2

Intended: A chunky wooden door fully closed within its simple stone frame, one large brass handle.. Actions: thing.open.

Gate state: **accepted**. Toggle open/closed door state, high confidence; closed door supplies close direction.

**Visible objects and marks:** A circular icon depicting a wooden door with an arched stone frame, horizontal metal bands, and a ring handle.

**Action interpretation:** Toggle door state (open/close)
**Confidence:** High

**Ambiguity/Alternative:** While highly likely to be an open/close toggle for a door object, if the selected piece is a character token, it could alternatively mean "Enter/Exit" or "Move to another map/scene" (portal).

Evidence: `reads/parchment/thing.open--alt2/c984abd9e42fbbef-5c3061251e`.

## charcoal / thing.pin--alt2

Intended: A large red pushpin pulling away from a short teal ground line, with one thick ivory upward arrow.. Actions: thing.pin.

Gate state: **accepted**. Unpin / unlock piece, high confidence.

**Visible objects and marks:** A red pushpin embedded in a flat green horizontal line, with a curved white arrow pointing upwards and away from the pin, all within a dark circular border.

**Action interpretation:** Unpin (or unlock) piece.

**Confidence:** High.

**Ambiguity:** While standard for "unpin," it could plausibly mean "lift piece" if the pushpin is meant to represent the game piece itself rather than a locked status.

Evidence: `reads/charcoal/thing.pin--alt2/14ad40934c7999d0-5c3061251e`.

## parchment / thing.pin--alt2

Intended: A large red pushpin pulling away from a short teal ground line, with one thick ivory upward arrow.. Actions: thing.pin.

Gate state: **accepted**. Unpin/unlock, high confidence; pin lifting explicitly recognized.

**Visible objects and marks:** A circular tan button displaying a red pushpin angled downwards toward a dark horizontal line, accompanied by a black arrow pointing upwards.

**Action interpretation:** Unpin (or unlock) the piece.
**Confidence:** High. The upward arrow visually represents lifting the pin out of the surface to release the object.

Evidence: `reads/parchment/thing.pin--alt2/71b8b44dc5871cd4-5c3061251e`.

## charcoal / thing.light--alt2

Intended: A stout red candle with a visibly black extinguished wick, one broad pale curling smoke trail and no flame.. Actions: thing.light.

Gate state: **accepted**. Extinguish/turn off light, medium confidence.

**Description:** A circular icon displaying a red, melted candle. The candle is unlit, with a wisp of white smoke rising from the wick, indicating it has just been extinguished.

**Action:** Turn off light source / Extinguish.
**Confidence:** Medium.

**Ambiguity:** In a tabletop RPG context, icons can be literal or metaphorical. While it literally depicts an extinguished light, it could also be a status marker.
**Alternative:** Mark piece as dead or defeated (metaphorically "snuffed out").

Evidence: `reads/charcoal/thing.light--alt2/8374e5a48fa6d489-5c3061251e`.

## parchment / thing.light--alt2

Intended: A stout red candle with a visibly black extinguished wick, one broad pale curling smoke trail and no flame.. Actions: thing.light.

Gate state: **learned**. Extinguished smoking candle correctly described; Disable light source offered after thematic death/delete. Literal extinguish action needs selected-light context.

**Visible objects and marks:** A circular button with a tan/gold background. It depicts a red, partially melted candle. The candle is unlit, with a wisp of grey smoke rising from its blackened wick, indicating it has just been extinguished.

**Action interpretation:** Mark piece as defeated/dead (snuffing out its life).
**Confidence:** Medium

**Ambiguity:** The "snuffed out" metaphor is thematic rather than literal. A plausible alternative is **Delete piece** (removing it from existence on the board) or **Disable light source** (if the token emits dynamic lighting).

Evidence: `reads/parchment/thing.light--alt2/b23100b4508e6d72-5c3061251e`.

## charcoal / stair.flip--alt2

Intended: Three broad stone stair steps with one thick ivory diagonal arrow pointing upward along the steps.. Actions: stair.flip.

Gate state: **learned**. Ascending stairs and upward direction recognized; changing stair connector direction requires label.

**Description:** A circular button displaying a 3D icon of a three-step staircase with a white arrow pointing diagonally upwards along the incline.

**Action:** Elevate piece (increase height/altitude).
**Confidence:** High.

Evidence: `reads/charcoal/stair.flip--alt2/656044d77f03b120-5c3061251e`.

## parchment / stair.flip--alt2

Intended: Three broad stone stair steps with one thick ivory diagonal arrow pointing upward along the steps.. Actions: stair.flip.

Gate state: **learned**. Ascending stairs and upward direction recognized; switching a connector to lead up requires label.

**Visible objects and marks:** A circular button with a gold border containing a 3D icon of a dark gray, three-step staircase. A light-colored arrow points diagonally upwards along the incline of the steps.

**Action interpretation:** Increase elevation (move the piece up)
**Confidence:** High

Evidence: `reads/parchment/stair.flip--alt2/f6f52b0dfff5b5d0-5c3061251e`.

## charcoal / stair.flip--alt3

Intended: Three broad stone stair steps with one thick ivory diagonal arrow pointing downward along the steps.. Actions: stair.flip.

Gate state: **learned**. Descending stairs and down-level direction recognized; changing stair connector direction requires label.

The image shows a circular icon containing a set of descending stairs with a light-colored arrow pointing diagonally downwards along the steps.

Action: Move the piece down one elevation level (or floor).
Confidence: High.

Evidence: `reads/charcoal/stair.flip--alt3/19bd2d139e0d56fe-5c3061251e`.

## parchment / stair.flip--alt3

Intended: Three broad stone stair steps with one thick ivory diagonal arrow pointing downward along the steps.. Actions: stair.flip.

Gate state: **learned**. Descending stairs and downward-level direction recognized; switching connector direction requires label.

**Description:** The image shows a circular button with a gold border. Inside is a dark grey 3D icon depicting a three-step staircase alongside a downward-pointing arrow.

**Action:** Move the selected piece down one elevation level (or floor).

**Confidence:** High

Evidence: `reads/parchment/stair.flip--alt3/d669f407bf46a142-5c3061251e`.

## charcoal / measure.start--alt1

Intended: Two stout ivory dividers spread apart over a short teal ground line, showing a measured distance.. Actions: measure.start.

Gate state: **accepted**. Measure distance / ruler tool, high confidence.

Visible objects and marks: A circular button containing a golden drawing compass with silver tips. A horizontal teal line with end-caps connects the two tips, resembling a dimension or measurement line.

Action interpretation: Measure distance (initiates a ruler tool, likely starting from the selected piece).
Confidence: High.

Evidence: `reads/charcoal/measure.start--alt1/816dfdf09dc1b83d-5c3061251e`.

## charcoal / measure.keep--alt1

Intended: A large brass pushpin pinning a simple teal circular spell disc in place.. Actions: measure.keep, ruler.norounds.

Gate state: **learned**. Pin/lock recognized. Keeping a measurement/template visible rather than freezing a piece needs measuring context.

**Description:** A golden pushpin or thumbtack stuck into a teal, swirling circular base within a dark circular border.

**Action:** Pin / Lock piece (prevents it from being moved).
**Confidence:** High.

**Ambiguity/Alternative:** While the pushpin strongly suggests locking or pinning in place, the swirling, map-like base could alternatively imply "Ping location" or "Mark position" on the board.

Evidence: `reads/charcoal/measure.keep--alt1/deae2bfea6b54dab-5c3061251e`.

## charcoal / measure.attach--alt1

Intended: One ivory pawn standing on a teal aura ring, joined to it by one stout brass chain link.. Actions: measure.attach, ruler.detach.

Gate state: **accepted**. Link piece to another object, medium confidence.

**Visible objects and marks:** A white chess pawn standing within a cyan ring, with a single gold chain link positioned to its right, set against a dark circular background.

**Action interpretation:** Link piece (to another object or character sheet)
**Confidence:** Medium

**Ambiguity:** While a chain link typically represents connecting or grouping items ("link"), it can sometimes be used to represent restricting movement.
**Plausible alternative:** Lock piece (prevent movement/interaction).

Evidence: `reads/charcoal/measure.attach--alt1/ea357218d38225a2-5c3061251e`.

## charcoal / pawn.cond.blinded

Intended: A single large human eye completely covered across its pupil by a broad opaque pearl-white cloth blindfold, with two short cloth tails at right. Black shadow behind the blindfold. No slash, no other face.. Actions: pawn.cond.blinded.

Gate state: **accepted**. Independent 31px D&D-condition read names blinded with high confidence; group confusion check required separately.

This icon features a light grey and white sphere or stylized head wrapped with a textured white blindfold tied on the right side, set against a dark grey circular background.

**Condition:** Blinded (100% confidence)

Evidence: `reads/charcoal/pawn.cond.blinded/3472739defd773f6-6e99136aa8`.

## parchment / pawn.cond.blinded

Intended: A single large human eye completely covered across its pupil by a broad opaque pearl-white cloth blindfold, with two short cloth tails at right. Black shadow behind the blindfold. No slash, no other face.. Actions: pawn.cond.blinded.

Gate state: **accepted**. Independent 31px D&D-condition read names blinded with high confidence; group confusion check required separately.

The icon features a circular gold-rimmed base containing a dark, eye-like shape covered horizontally by a white, tied cloth band resembling a blindfold.

Condition: Blinded
Confidence: 100%

Evidence: `reads/parchment/pawn.cond.blinded/98e9d60f32214f5b-6e99136aa8`.

## charcoal / pawn.cond.charmed

Intended: One large rose-pink heart containing a small ivory spiral, with two tiny pink hearts floating at upper right. A warm magical enchantment pictogram, not a broken heart.. Actions: pawn.cond.charmed.

Gate state: **accepted**. Independent 31px D&D-condition read names charmed with high confidence; group confusion check required separately.

This icon features a large pink heart with a white spiral inside, accompanied by two smaller pink hearts floating above its right side, all set against a dark circular background.

Condition: Charmed
Confidence: 100%

Evidence: `reads/charcoal/pawn.cond.charmed/c451faa8ce2a15bd-6e99136aa8`.

## parchment / pawn.cond.charmed

Intended: One large rose-pink heart containing a small ivory spiral, with two tiny pink hearts floating at upper right. A warm magical enchantment pictogram, not a broken heart.. Actions: pawn.cond.charmed.

Gate state: **accepted**. Independent 31px D&D-condition read names charmed with high confidence; group confusion check required separately.

**Silhouette and colours:** A circular cream token with a gold border, featuring a large pink heart with a white swirl in its center and two smaller pink hearts floating to the upper right.

**Condition:** Charmed (100% confidence)

Evidence: `reads/parchment/pawn.cond.charmed/7056d6371db04b7e-6e99136aa8`.

## charcoal / pawn.cond.frightened

Intended: A violet human face with huge white wide frightened eyes, open oval mouth, and both hands raised beside the cheeks in terror. Clear screaming frightened silhouette.. Actions: pawn.cond.frightened.

Gate state: **accepted**. Independent 31px D&D-condition read names frightened with high confidence; group confusion check required separately.

Silhouette and colours: A dark circular icon containing a bright purple face with wide white eyes, a dark open mouth, and hands clutching its cheeks, resembling a classic screaming or panicked expression.

Condition: Frightened (100%)

Evidence: `reads/charcoal/pawn.cond.frightened/41daa279316f027e-6e99136aa8`.

## parchment / pawn.cond.frightened

Intended: A violet human face with huge white wide frightened eyes, open oval mouth, and both hands raised beside the cheeks in terror. Clear screaming frightened silhouette.. Actions: pawn.cond.frightened.

Gate state: **accepted**. Independent 31px D&D-condition read names frightened with high confidence; group confusion check required separately.

Silhouette and colours: A purple humanoid head and hands with wide eyes and a wide-open, screaming mouth, set inside a pale circular background with a gold border.

Condition: Frightened (Confidence: 100%)

Evidence: `reads/parchment/pawn.cond.frightened/aafacfbbc4ad0b20-6e99136aa8`.

## charcoal / pawn.cond.grappled

Intended: One large burnt-orange hand firmly gripping another ivory human wrist. The captured wrist extends upward, the gripping fingers wrap across it. A physical grab; no rope, no chain.. Actions: pawn.cond.grappled.

Gate state: **accepted**. Independent 31px D&D-condition read names grappled with high confidence; group confusion check required separately.

**Silhouette and colours:** A dark circular icon containing an orange hand firmly grasping the pale wrist of another arm that is reaching upwards with splayed fingers.
**Condition:** Grappled (High confidence)

Evidence: `reads/charcoal/pawn.cond.grappled/83e322b72828384b-6e99136aa8`.

## charcoal / pawn.cond.grappled--alt1

Intended: Two burnt-orange forearms locked together in a wrestling grip, thick fingers visibly clasping an opposing wrist. No ropes, chains or knots.. Actions: pawn.cond.grappled.

Gate state: **accepted**. Independent 31px D&D-condition read names grappled with high confidence; group confusion check required separately.

Silhouette and colours: Two crossed orange/bronze arms inside a dark grey circle, with one hand firmly gripping the wrist of the other.
Condition: Grappled (High confidence)

Evidence: `reads/charcoal/pawn.cond.grappled--alt1/f9063ee829d13f3e-6e99136aa8`.

## parchment / pawn.cond.grappled

Intended: One large burnt-orange hand firmly gripping another ivory human wrist. The captured wrist extends upward, the gripping fingers wrap across it. A physical grab; no rope, no chain.. Actions: pawn.cond.grappled.

Gate state: **accepted**. Independent 31px D&D-condition read names grappled with high confidence; group confusion check required separately.

A circular icon with a gold border and beige background. It depicts a large orange-brown hand firmly grasping the wrist of a pale, bare arm reaching upwards.

Condition: Grappled (High confidence)

Evidence: `reads/parchment/pawn.cond.grappled/df88c53ef11ee8fe-6e99136aa8`.

## parchment / pawn.cond.grappled--alt1

Intended: Two burnt-orange forearms locked together in a wrestling grip, thick fingers visibly clasping an opposing wrist. No ropes, chains or knots.. Actions: pawn.cond.grappled.

Gate state: **accepted**. Independent 31px D&D-condition read names grappled with high confidence; group confusion check required separately.

**Silhouette and Colours:** Two orange-brown arms grasping each other's forearms in a locked hold, set within a pale cream circle with a brown border.
**Condition:** Grappled
**Confidence:** High

Evidence: `reads/parchment/pawn.cond.grappled--alt1/66bc6453031c2a4b-6e99136aa8`.

## charcoal / pawn.cond.invisible

Intended: A pale-cyan outline of a standing human silhouette fading away from left to right into three broad separated mist fragments; the dark or parchment badge ground shows through the empty body. No eye, no slash, no ghost face.. Actions: pawn.cond.invisible.

Gate state: **accepted**. Independent 31px D&D-condition read names invisible with high confidence; group confusion check required separately.

Silhouette and colours: A light blue humanoid figure on a dark background, with its right side dissolving into wavy, horizontal mist or smoke.
Condition: Invisible
Confidence: High

Evidence: `reads/charcoal/pawn.cond.invisible/c531ba5bb02c45b0-6e99136aa8`.

## charcoal / pawn.cond.invisible--alt1

Intended: Two cyan footprints beneath an otherwise empty thin cyan human outline that fades completely above the knees. An invisible walker, no eye or slash.. Actions: pawn.cond.invisible.

Gate state: **accepted**. Independent 31px D&D-condition read names invisible with high confidence; group confusion check required separately.

Silhouette and colors: A glowing cyan outline of a humanoid upper body with two footprints below it, set against a dark circular background.

Condition: Invisible
Confidence: High

Evidence: `reads/charcoal/pawn.cond.invisible--alt1/8180020a46dbe445-6e99136aa8`.

## parchment / pawn.cond.invisible

Intended: A pale-cyan outline of a standing human silhouette fading away from left to right into three broad separated mist fragments; the dark or parchment badge ground shows through the empty body. No eye, no slash, no ghost face.. Actions: pawn.cond.invisible.

Gate state: **accepted**. Independent 31px D&D-condition read names invisible with high confidence; group confusion check required separately.

Silhouette and colours: A circular token with a pale beige background and a gold border. It features a light blue humanoid figure whose right side is dissolving into wavy, smoke-like tendrils.

Condition: Invisible
Confidence: High

Evidence: `reads/parchment/pawn.cond.invisible/81cd3539a5f7220c-6e99136aa8`.

## parchment / pawn.cond.invisible--alt1

Intended: Two cyan footprints beneath an otherwise empty thin cyan human outline that fades completely above the knees. An invisible walker, no eye or slash.. Actions: pawn.cond.invisible.

Gate state: **accepted**. Independent 31px read names invisible with high confidence; condition group confusion check required separately.

**Silhouette and Colours:** The icon displays a light blue outline of a humanoid figure on a beige circular background with a brown border. The figure's head, torso, arms, and feet are clearly outlined, while the legs are faded or missing, creating a disappearing effect.

**Condition:** Invisible
**Confidence:** High

Evidence: `reads/parchment/pawn.cond.invisible--alt1/eac3958c1df414ea-6e99136aa8`.

## charcoal / pawn.cond.poisoned

Intended: A squat acid-green poison bottle with a broad black skull symbol on the face and one large green droplet above its open mouth. Simple thick neck and rounded bottom.. Actions: pawn.cond.poisoned.

Gate state: **accepted**. Independent 31px D&D-condition read names poisoned with high confidence; group confusion check required separately.

Silhouette and colours: A round flask filled with bright green liquid, marked with a dark skull symbol.
Condition: Poisoned
Confidence: 100%

Evidence: `reads/charcoal/pawn.cond.poisoned/08eb8c08cff09909-6e99136aa8`.

## parchment / pawn.cond.poisoned

Intended: A squat acid-green poison bottle with a broad black skull symbol on the face and one large green droplet above its open mouth. Simple thick neck and rounded bottom.. Actions: pawn.cond.poisoned.

Gate state: **accepted**. Independent 31px read names poisoned with high confidence; condition group confusion check required separately.

This icon shows a bright green flask containing a black skull, with a green drop hovering above its neck, set against a beige circular background with a brown border.

Condition: Poisoned (High confidence)

Evidence: `reads/parchment/pawn.cond.poisoned/cd34edabebbb3f52-6e99136aa8`.

## charcoal / pawn.cond.prone

Intended: One fully clothed earth-brown wooden tabletop toy mannequin lying face down horizontally on a short ivory floor line. Simple blocky wooden toy limbs, flat rectangular tunic, trousers and boots; arms bent out beside its round wooden head, legs straight. Entire clothed toy figure lies low and flat on the ground. No portrait, no bed, no stars, no anatomical details.. Actions: pawn.cond.prone.

Gate state: **accepted**. Independent 31px D&D-condition read names prone with high confidence; group confusion check required separately.

**Silhouette and colours:** A brown humanoid figure lying horizontally flat on a light grey line within a dark circular border.
**Condition:** Prone
**Confidence:** 100%

Evidence: `reads/charcoal/pawn.cond.prone/abbd0ca0d6683aeb-6e99136aa8`.

## charcoal / pawn.cond.prone--alt1

Intended: An earth-brown human figure falling forward flat toward a short ground line, full body horizontal with limbs spread; one broad downward arrow above the torso. No stars or moon.. Actions: pawn.cond.prone.

Gate state: **accepted**. Independent 31px D&D-condition read names prone with high confidence; group confusion check required separately.

Silhouette and colours: A dark circular icon with a grey border. It features a bronze-coloured figure lying flat on a horizontal line, with a bronze arrow pointing straight down at its back.

Condition: Prone
Confidence: 100%

Evidence: `reads/charcoal/pawn.cond.prone--alt1/4a0bb30508568641-6e99136aa8`.

## parchment / pawn.cond.prone

Intended: A full earth-brown human body lying FACE DOWN horizontally along a short ivory floor line, arms bent out beside the head, legs straight. Entire figure low and flat; visibly on the ground, not a portrait or sleeping face.. Actions: pawn.cond.prone.

Gate state: **accepted**. Independent 31px read names prone with high confidence; condition group confusion check required separately.

A brown silhouette of a humanoid figure lying flat horizontally on a beige circular background with a brown border.

Condition: Prone (Confidence: 100%)

Evidence: `reads/parchment/pawn.cond.prone/0c5eaa9714ab2d11-6e99136aa8`.

## parchment / pawn.cond.prone--alt1

Intended: An earth-brown human figure falling forward flat toward a short ground line, full body horizontal with limbs spread; one broad downward arrow above the torso. No stars or moon.. Actions: pawn.cond.prone.

Gate state: **accepted**. Independent 31px D&D-condition read correctly names prone with high confidence. Group confusion check separately required.

Silhouette and colours: A light tan circular icon with a brown border. It features a brown silhouette of a person lying flat on their stomach on a horizontal line, with a brown downward-pointing arrow above their back.

Condition: Prone (100% confidence).

Evidence: `reads/parchment/pawn.cond.prone--alt1/aa1f38ca61c2d820-6e99136aa8`.

## charcoal / pawn.cond.restrained

Intended: A compact crimson-red torso with both arms pinned tightly to its sides by THREE thick ivory rope loops and one big front knot. Full bound torso silhouette, no gripping hand.. Actions: pawn.cond.restrained.

Gate state: **accepted**. Independent 31px D&D-condition read names restrained with high confidence; group confusion check required separately.

A red humanoid torso tightly bound by light-colored ropes knotted in the front. Restrained. High confidence.

Evidence: `reads/charcoal/pawn.cond.restrained/01da346a1961b3ea-6e99136aa8`.

## charcoal / pawn.cond.restrained--alt1

Intended: Two crimson-red wrists bound side by side with one thick ivory rope knot and short rope ends. Clear tied wrists, not a hand gripping a wrist.. Actions: pawn.cond.restrained.

Gate state: **accepted**. Independent 31px D&D-condition read names restrained with high confidence; group confusion check required separately.

Silhouette and colours: Two red fists crossed at the wrists, pointing downwards, and bound together by a pale beige rope, set inside a dark circular border.

Condition: Restrained (High confidence)

Evidence: `reads/charcoal/pawn.cond.restrained--alt1/f7e1825b4aad89d7-6e99136aa8`.

## parchment / pawn.cond.restrained

Intended: A compact crimson-red torso with both arms pinned tightly to its sides by THREE thick ivory rope loops and one big front knot. Full bound torso silhouette, no gripping hand.. Actions: pawn.cond.restrained.

Gate state: **accepted**. Independent 31px D&D-condition read correctly names restrained with high confidence. Group confusion check separately required.

Silhouette and colours: A red, armless and headless torso tightly bound by horizontal white/tan ropes, set against a circular tan background.
Condition: Restrained (High confidence)

Evidence: `reads/parchment/pawn.cond.restrained/4943532288ad1aa7-6e99136aa8`.

## parchment / pawn.cond.restrained--alt1

Intended: Two crimson-red wrists bound side by side with one thick ivory rope knot and short rope ends. Clear tied wrists, not a hand gripping a wrist.. Actions: pawn.cond.restrained.

Gate state: **accepted**. Independent 31px D&D-condition read correctly names restrained with high confidence. Group confusion check separately required.

The icon features two red arms with clenched fists pointing downwards, crossed at the wrists and bound together by a tan rope, set against a circular parchment-colored background.

Condition: Restrained (High confidence)

Evidence: `reads/parchment/pawn.cond.restrained--alt1/63a65ed0a915287d-6e99136aa8`.

## charcoal / pawn.cond.stunned

Intended: A bright-yellow human head with dazed uneven eyes, three large yellow stars circling above the crown along a short ivory arc. Head upright, mouth slightly open, no heart or moon.. Actions: pawn.cond.stunned.

Gate state: **accepted**. Independent 31px read names stunned with high confidence; condition group confusion check required separately.

**Silhouette and colours:** A yellow, bald humanoid head with a dazed, asymmetrical expression, featuring three yellow stars circling above it, all set within a dark circular background with a faint grey border.

**Condition:** Stunned (Confidence: High)

Evidence: `reads/charcoal/pawn.cond.stunned/13bab128e6572dc5-6e99136aa8`.

## charcoal / pawn.cond.stunned--alt1

Intended: One bright-yellow lightning bolt striking a simple upright head silhouette, with two broad gold impact stars over the crown. Shocked and dazed, not frightened.. Actions: pawn.cond.stunned.

Gate state: **accepted**. Independent 31px read names stunned with high confidence; condition group confusion check required separately.

**Silhouette and colours:** A dark circular icon containing a bright yellow stylized head. The head has spiral eyes and an open mouth, and is being struck from above by a yellow lightning bolt, with small yellow starbursts radiating from the impact.

**Condition:** Stunned (High confidence)

Evidence: `reads/charcoal/pawn.cond.stunned--alt1/fb1e2800ce9e332d-6e99136aa8`.

## parchment / pawn.cond.stunned

Intended: A bright-yellow human head with dazed uneven eyes, three large yellow stars circling above the crown along a short ivory arc. Head upright, mouth slightly open, no heart or moon.. Actions: pawn.cond.stunned.

Gate state: **accepted**. Independent 31px D&D-condition read correctly names stunned with high confidence. Group confusion check separately required.

**Silhouette and Colours:** A circular pale-yellow token with a darker gold border. Inside is a bright yellow head with a dazed expression (unfocused eyes, open mouth) and three yellow stars with motion lines spinning in an arc above it.

**Condition:** Stunned (100% confidence).

Evidence: `reads/parchment/pawn.cond.stunned/30f0aaf6ba8d71af-6e99136aa8`.

## parchment / pawn.cond.stunned--alt1

Intended: One bright-yellow lightning bolt striking a simple upright head silhouette, with two broad gold impact stars over the crown. Shocked and dazed, not frightened.. Actions: pawn.cond.stunned.

Gate state: **accepted**. Independent 31px D&D-condition read correctly names stunned with high confidence. Group confusion check separately required.

Silhouette of a dark head with swirling yellow eyes and an open mouth, struck by a yellow lightning bolt and surrounded by yellow starbursts on a pale circular background.

Condition: Stunned
Confidence: High

Evidence: `reads/parchment/pawn.cond.stunned--alt1/7112819df3018468-6e99136aa8`.

## charcoal / pawn.cond.unconscious

Intended: A deep-indigo blue human head drooping sideways with both eyes fully closed and limp mouth, resting against one broad ivory crescent moon at upper right. No body, no stars, no blood.. Actions: pawn.cond.unconscious.

Gate state: **accepted**. Independent 31px read names unconscious with high confidence; condition group confusion check required separately.

The icon shows a blue face with closed eyes resting against a pale yellow crescent moon, set within a dark circular border.

Condition: Unconscious (Asleep)
Confidence: 100%

Evidence: `reads/charcoal/pawn.cond.unconscious/9845486bbf855786-6e99136aa8`.

## charcoal / pawn.cond.unconscious--alt1

Intended: A deep-indigo blue sleeping face in side profile with closed eye, cheek resting on an ivory pillow. Limp relaxed sleeping profile, no stars, no full-body figure.. Actions: pawn.cond.unconscious.

Gate state: **accepted**. Independent 31px read names unconscious with high confidence; condition group confusion check required separately.

**Silhouette and colours:** A blue humanoid head and shoulders with closed eyes, resting on a white pillow within a dark circular border.
**Condition:** Unconscious (Asleep)
**Confidence:** 100%

Evidence: `reads/charcoal/pawn.cond.unconscious--alt1/9a3346f9667abcba-6e99136aa8`.

## parchment / pawn.cond.unconscious

Intended: A deep-indigo blue human head drooping sideways with both eyes fully closed and limp mouth, resting against one broad ivory crescent moon at upper right. No body, no stars, no blood.. Actions: pawn.cond.unconscious.

Gate state: **accepted**. Independent 31px D&D-condition read correctly names unconscious with high confidence. Group confusion check separately required.

The icon features a circular gold border enclosing a pale cream crescent moon. Resting against the inside curve of the moon is a dark blue, stylized face with closed eyes, appearing to sleep.

**Unconscious** (100%)

Evidence: `reads/parchment/pawn.cond.unconscious/e1e9f06fde5a6641-6e99136aa8`.

## parchment / pawn.cond.unconscious--alt1

Intended: A deep-indigo blue sleeping face in side profile with closed eye, cheek resting on an ivory pillow. Limp relaxed sleeping profile, no stars, no full-body figure.. Actions: pawn.cond.unconscious.

Gate state: **accepted**. Independent31px read: Unconscious (Sleep), high confidence.

This icon shows a dark blue humanoid head in profile with closed eyes, resting on a cream-colored pillow within a gold-bordered circular token.

**Condition:** Unconscious (Sleep)
**Confidence:** 100%

Evidence: `reads/parchment/pawn.cond.unconscious--alt1/6163023826c22a6f-6e99136aa8`.

## charcoal / pawn.cond.clear

Intended: One broad mint-green hand broom sweeping away three small detached red, violet and green round condition badges, leaving a large clean ivory checkmark. Clear all status effects, not a single condition.. Actions: pawn.cond.clear.

Gate state: **accepted**. Independent 31px read names clearing conditions with high confidence; condition group confusion check required separately.

Silhouette and colours: A green broom sweeping away red, purple, and green dots, accompanied by a white checkmark, all within a dark grey circle.

This depicts **clearing conditions** (100% confidence).

Evidence: `reads/charcoal/pawn.cond.clear/86d14bae8e4c0af7-6e99136aa8`.

## parchment / pawn.cond.clear

Intended: One broad mint-green hand broom sweeping away three small detached red, violet and green round condition badges, leaving a large clean ivory checkmark. Clear all status effects, not a single condition.. Actions: pawn.cond.clear.

Gate state: **accepted**. Independent31px read explicitly recognizes clearing conditions, high confidence.

The icon features a green broom sweeping away three small colored dots (red, purple, and green) alongside a white checkmark, all set on a pale circular background with a brown border.

It depicts **clearing conditions**.
Confidence: 100%

Evidence: `reads/parchment/pawn.cond.clear/25745720c06e0e89-6e99136aa8`.

## charcoal / room.walls.auto

Intended: One thick ivory miniature room outline enclosing a small brass cog with just five broad teeth. Automatic selection by room type, no bricks or material sample.. Actions: room.walls.auto.

Gate state: **learned**. Room/house with settings cog recognized. By-room-type automatic material selection is contextual; structurally distinct from all material samples.

Based on the image provided:

**Silhouette:** The icon features the outline of a simple house with a pitched roof. Inside the house shape is a small, five-toothed gear or cog.

**Material/Structure:** The image is a circular digital UI button with a dark background and a thin grey border. The house outline appears to be made of a smooth, light cream or beige material with a raised, 3D beveled edge. The central gear has a metallic gold or bronze appearance, also with a slightly embossed, 3D look.

**Single Best Reading:** Building Settings (or Structure Properties)
**Confidence:** High (90%) - The combination of a house (representing a building or structure) and a gear (universally representing settings or configuration) is a standard UI convention, even if categorized loosely under "wall material options" in the specific software's menu hierarchy.

Evidence: `reads/charcoal/room.walls.auto/cb90d3f9d6f32610-5cec1869bd`.

## parchment / room.walls.auto

Intended: One thick dark slate miniature room outline enclosing a large bronze machinery gear with EIGHT broad rectangular blunt teeth and a large round central hole. Gear teeth are square-ended, never pointed. Automatic material selection by room type. No five-point star, no bricks, no material sample.. Actions: room.walls.auto.

Gate state: **learned**. Blind read describes room frame and gear correctly but calls it Settings/Configuration (85%). Automatic material inheritance is learned from the wall-menu label; gear is not uniquely guessable.

Based on the image provided:

**Silhouette:** A circular badge containing a dark, square frame with bracketed corners and a small top node, which encloses a central, multi-toothed gear or cogwheel.

**Material or Structure:** The background is a flat, light beige resembling parchment or aged paper. The frame is composed of dark grey or black solid lines, looking like a schematic or UI selection box. The central gear is rendered with metallic gold or bronze shading, giving it a three-dimensional, solid appearance.

**Single Best Reading:** Settings (or Custom Configuration)
**Confidence:** 85%

Evidence: `reads/parchment/room.walls.auto/67eac382131cdfed-5cec1869bd`.

## charcoal / room.walls.rough-timber

Intended: Three broad rough wooden vertical planks held by one prominent diagonal timber brace, uneven top edge and dark gaps. No stone, logs, plaster or pointed arch.. Actions: room.walls.rough-timber.

Gate state: **accepted**. Read as wooden wall; uneven upright planks and diagonal brace correctly described.

Based on the image provided:

*   **Silhouette and Structure:** The icon has a circular silhouette. Inside, it depicts a structure made of vertical wooden planks that are uneven at the top, reinforced by a single diagonal wooden crossbeam secured with two visible nails.
*   **Material:** Wood.

**Single best reading:** Wood (or Wooden Wall)
**Confidence:** 99%

Evidence: `reads/charcoal/room.walls.rough-timber/a108b77026354cd0-5cec1869bd`.

## parchment / room.walls.rough-timber

Intended: Three broad rough wooden vertical planks held by one prominent diagonal timber brace, uneven top edge and dark gaps. No stone, logs, plaster or pointed arch.. Actions: room.walls.rough-timber.

Gate state: **accepted**. Blind 31px material read identifies the intended structure/material; exact observations retained below. Distinct silhouette within wall arc.

The silhouette is a jagged, roughly square shape contained within a circular border. The structure depicts three vertical planks fastened together by a diagonal crossbeam, with small dark spots indicating nails. The material is clearly wood.

Best reading: Wood
Confidence: 95%

Evidence: `reads/parchment/room.walls.rough-timber/40af666a083f4b41-5cec1869bd`.

## charcoal / room.walls.log-cabin

Intended: Three thick round horizontal logs stacked in a low wall, protruding circular cut log ends alternating at one corner. Strong rounded silhouette, no plank brace.. Actions: room.walls.log-cabin.

Gate state: **accepted**. Read as logs, with horizontal cylinders and circular cut ends correctly described.

The silhouette consists of three horizontal cylinders stacked vertically. The material clearly depicts wood, specifically rough-hewn logs, indicated by the brown, bark-like textured sides and the lighter, flat circular cut ends.

Reading: Log
Confidence: 99%

Evidence: `reads/charcoal/room.walls.log-cabin/417903a3853fd045-5cec1869bd`.

## parchment / room.walls.log-cabin

Intended: Three thick round horizontal logs stacked in a low wall, protruding circular cut log ends alternating at one corner. Strong rounded silhouette, no plank brace.. Actions: room.walls.log-cabin.

Gate state: **accepted**. Blind 31px material read identifies the intended structure/material; exact observations retained below. Distinct silhouette within wall arc.

Based on the image provided:

**Description:** The silhouette shows a stack of three horizontal cylinders within a circular badge. The material is clearly depicted as wood, specifically raw logs, featuring dark brown bark on the sides and lighter, circular cut ends that suggest tree rings.

**Best Reading:** Wood (or Wooden Wall)
**Confidence:** 99%

Evidence: `reads/parchment/room.walls.log-cabin/789cc0b90ec58fec-5cec1869bd`.

## charcoal / room.walls.half-timber

Intended: One bold cream plaster wall panel crossed by a large dark brown X timber frame; square panel with broad contrasting plaster quadrants.. Actions: room.walls.half-timber.

Gate state: **accepted**. Blind 31px material read identifies the intended structure/material; exact observations retained below. Distinct silhouette within wall arc.

Based on the image provided:

**Silhouette and Structure:**
The silhouette is a simple circle. Inside, the structure consists of a light, slightly textured background (resembling plaster or stucco) intersected by two dark brown diagonal bands forming an 'X'. These bands have shading that suggests they are solid, likely wooden, structural beams.

**Best Reading:**
Half-timbered wall (or wood-and-plaster wall)

**Confidence:**
95%

Evidence: `reads/charcoal/room.walls.half-timber/8a1fdd28dd26673c-5cec1869bd`.

## parchment / room.walls.half-timber

Intended: One bold cream plaster wall panel crossed by a large dark brown X timber frame; square panel with broad contrasting plaster quadrants.. Actions: room.walls.half-timber.

Gate state: **accepted**. Blind 31px material read identifies the intended structure/material; exact observations retained below. Distinct silhouette within wall arc.

Based on the image provided:

**Silhouette and Material/Structure:**
The image is a circular icon with a thin, dark border. Inside, it features a pale, cream-colored background that resembles plaster or stucco. This background is overlaid with two dark brown, intersecting diagonal bands forming an 'X', which strongly resemble wooden structural beams.

**Best Reading:**
Half-timbered (or Wood and Plaster) wall

**Confidence:**
High (95%) - This is a very standard visual shorthand for half-timbered medieval architecture in gaming and tabletop environments.

Evidence: `reads/parchment/room.walls.half-timber/b62f8df614668f62-5cec1869bd`.

## charcoal / room.walls.fieldstone

Intended: A short irregular rubble wall made from five large rounded grey boulders with obvious uneven sizes and uneven top silhouette. No uniform rectangular bricks.. Actions: room.walls.fieldstone.

Gate state: **accepted**. Blind 31px material read identifies the intended structure/material; exact observations retained below. Distinct silhouette within wall arc.

Based on the image provided:

**Silhouette and Material/Structure:**
The silhouette is a small, lumpy mound composed of several distinct, rounded shapes clustered together within a circular border. The material appears to be smooth, gray rock, shaded to look like a pile of boulders or river stones resting on a slight dirt base.

**Best Reading:**
Stone

**Confidence:**
95%

Evidence: `reads/charcoal/room.walls.fieldstone/0787053b0c452e40-5cec1869bd`.

## parchment / room.walls.fieldstone

Intended: A short irregular rubble wall made from five large rounded grey boulders with obvious uneven sizes and uneven top silhouette. No uniform rectangular bricks.. Actions: room.walls.fieldstone.

Gate state: **accepted**. Blind read correctly describes the distinctive masonry structure/material shown; exact family label is supplied by the menu.

The silhouette is a low, uneven mound with a flat base, composed of several distinct, rounded lumps. The material appears to be solid, grey, irregular chunks with highlights, strongly resembling a pile of rough stones or boulders.

Reading: Stone (or Rock)
Confidence: High

Evidence: `reads/parchment/room.walls.fieldstone/0e2ab7a8db9017e3-5cec1869bd`.

## charcoal / room.walls.dressed-stone

Intended: A neat rectangular wall of six large smooth pale limestone ashlar blocks in two staggered courses, crisp straight edges and flat even top.. Actions: room.walls.dressed-stone.

Gate state: **accepted**. Blind 31px material read identifies the intended structure/material; exact observations retained below. Distinct silhouette within wall arc.

Based on the image provided:

**Description:**
The silhouette is a small, roughly rectangular shape composed of smaller interlocking rectangles, centered within a faint circular border. The structure consists of two rows of light beige or tan blocks stacked in a staggered, overlapping pattern (running bond). The material strongly resembles cut stone blocks, light-colored bricks, or concrete masonry units.

**Best Reading:**
Stone (or Stone Blocks)

**Confidence:**
High (95%) - The staggered masonry pattern is a universal iconographic shorthand for stone or brick walls in gaming and 3D modeling interfaces. The chunky, light-colored appearance leans heavily towards stone.

Evidence: `reads/charcoal/room.walls.dressed-stone/f81bb4e77e0a83a5-5cec1869bd`.

## parchment / room.walls.dressed-stone

Intended: A neat rectangular wall of six large smooth pale limestone ashlar blocks in two staggered courses, crisp straight edges and flat even top.. Actions: room.walls.dressed-stone.

Gate state: **accepted**. Blind read correctly describes the distinctive masonry structure/material shown; exact family label is supplied by the menu.

Based on the image provided:

*   **Silhouette:** A circular icon containing a rectangular cluster made up of six smaller, distinct rectangular shapes arranged in a 2x3 grid.
*   **Material/Structure:** The shapes appear to be light beige or off-white solid blocks stacked together, resembling smooth cut stone masonry, large bricks, or concrete blocks.
*   **Best reading:** Stone blocks
*   **Confidence:** High

Evidence: `reads/parchment/room.walls.dressed-stone/c273f84186cd2961-5cec1869bd`.

## charcoal / room.walls.noble-interior

Intended: A rich red interior plaster wall panel with two broad ivory classical pilasters flanking it and a thick ivory cornice across its top. No wallpaper pattern or timber X.. Actions: room.walls.noble-interior.

Gate state: **learned**. Light architectural frame and red interior panel recognized; parchment reads doorway. Noble interior material choice needs menu label, but its red framed silhouette is unique in this wall arc.

Based on the image provided:

**Silhouette and Structure:**
The icon has a square silhouette contained within a circular dark grey button. It depicts a light beige or off-white architectural frame, resembling stone or plaster pillars on the sides with horizontal beams across the top and bottom. This frame encloses a solid, dark red rectangular center.

**Single Best Reading:**
Red paneled wall (or framed interior wall)

**Confidence:**
High (90%) that it represents a framed or paneled interior wall style, though the exact label in the software might vary slightly (e.g., "Mansion Wall," "Painted Wall").

Evidence: `reads/charcoal/room.walls.noble-interior/f652f3d778ffed68-5cec1869bd`.

## parchment / room.walls.noble-interior

Intended: A rich red interior plaster wall panel with two broad ivory classical pilasters flanking it and a thick ivory cornice across its top. No wallpaper pattern or timber X.. Actions: room.walls.noble-interior.

Gate state: **learned**. Light architectural frame and red interior panel recognized; parchment reads doorway. Noble interior material choice needs menu label, but its red framed silhouette is unique in this wall arc.

Based on the visual evidence at the supplied resolution:

**Silhouette:** A circular icon containing a rectangular, framed inner shape.
**Material or Structure:** The image depicts an architectural structure resembling a classic doorway or portal. It features a light-colored (likely stone or plaster) frame with two vertical pillars and a horizontal lintel. The interior of the frame is filled with a textured, deep red material that suggests a heavy fabric curtain or a solid painted panel.

**Single best reading:** Door
**Confidence:** 85%

Evidence: `reads/parchment/room.walls.noble-interior/75f90df9091a6c00-5cec1869bd`.

## charcoal / room.walls.crypt-stone

Intended: A broad grey stone rounded burial arch with one large ivory skull centered at its keystone above a dark sealed opening. Simplified heavy masonry, skull large enough to read.. Actions: room.walls.crypt-stone.

Gate state: **accepted**. Blind read correctly describes the distinctive masonry structure/material shown; exact family label is supplied by the menu.

Based on the image provided:

**Description:**
The silhouette is a circular icon containing a rounded archway. The structure is composed of distinct, grey stone blocks. At the top center of the arch, serving as a keystone, is a prominent, light-colored skull. The space within the archway is dark, suggesting an open passage or doorway.

**Best Reading:** Skull Archway
**Confidence:** High

Evidence: `reads/charcoal/room.walls.crypt-stone/26aa903d2a99bac5-5cec1869bd`.

## parchment / room.walls.crypt-stone

Intended: A broad grey stone rounded burial arch with one large ivory skull centered at its keystone above a dark sealed opening. Simplified heavy masonry, skull large enough to read.. Actions: room.walls.crypt-stone.

Gate state: **accepted**. Blind read correctly describes the distinctive masonry structure/material shown; exact family label is supplied by the menu.

Based on the image provided:

**Description:** The silhouette is an arched doorway or gate. The structure is made of grey, blocky stone masonry with a distinct skull acting as the keystone at the top center of the arch. The archway frames a dark, solid interior or door, and the entire icon is set against a circular, glowing gold background.

**Best Reading:** Crypt Door (or Crypt Wall Theme)
**Confidence:** High (95%)

Evidence: `reads/parchment/room.walls.crypt-stone/30879c2788ab937e-5cec1869bd`.

## charcoal / room.walls.castle-rough

Intended: A thick dark rough stone battlement wall with three very broad square crenellations along the top and a single narrow central arrow slit. No tower, flag or skull.. Actions: room.walls.castle-rough.

Gate state: **accepted**. Blind read correctly describes the distinctive masonry structure/material shown; exact family label is supplied by the menu.

Based on the image provided:

**Description:**
The silhouette is a stout, rectangular shape with a crenellated top (resembling a classic castle battlement or a rook chess piece) and a narrow vertical slit in the center, like an arrow loop. The structure appears to be made of dark, rough-hewn stone blocks or heavy masonry.

**Best Reading:**
Stone wall

**Confidence:**
High (95%)

Evidence: `reads/charcoal/room.walls.castle-rough/c564a702e6ce5597-5cec1869bd`.

## parchment / room.walls.castle-rough

Intended: A thick dark rough stone battlement wall with three very broad square crenellations along the top and a single narrow central arrow slit. No tower, flag or skull.. Actions: room.walls.castle-rough.

Gate state: **accepted**. Blind read correctly describes the distinctive masonry structure/material shown; exact family label is supplied by the menu.

Based on the image provided:

**Description:**
The silhouette is a classic castle battlement or wall segment, featuring a crenellated top (three raised merlons) and a narrow vertical arrow slit in the center. The structure appears to be made of dark, stacked stone blocks or heavy masonry, set against a warm, glowing circular background.

**Best Reading:**
Stone (or Stone Wall)

**Confidence:**
95% - The icon uses a universally recognized symbol (a castle wall) to represent stone or masonry material in gaming and map-making contexts.

Evidence: `reads/parchment/room.walls.castle-rough/cf63e2b58a654e2a-5cec1869bd`.

## charcoal / room.walls.noble-panel

Intended: A broad warm mahogany wall panel with two deep rectangular recessed wooden panels side by side and thick raised top molding. All wood, no plaster or diagonal brace.. Actions: room.walls.noble-panel.

Gate state: **accepted**. Wood paneling correctly read; recessed double-panel silhouette recognized.

Based on the image provided:

**Description:** The silhouette is a rectangular block featuring horizontal trim along the top and bottom, with a central vertical divider that creates two distinct, recessed rectangular panels. The material appears to be a warm, brown wood with shading that highlights the depth of the recessed sections, characteristic of classic interior wainscoting.

**Best Reading:** Wood Paneling
**Confidence:** 95%

Evidence: `reads/charcoal/room.walls.noble-panel/219c015d6b99aaae-5cec1869bd`.

## parchment / room.walls.noble-panel

Intended: A broad warm mahogany wall panel with two deep rectangular recessed wooden panels side by side and thick raised top molding. All wood, no plaster or diagonal brace.. Actions: room.walls.noble-panel.

Gate state: **accepted**. Wood paneling correctly read; recessed double-panel silhouette recognized.

Based on the image provided:

*   **Silhouette:** A wide rectangular shape with a slightly overhanging top edge, divided into two vertical, inset rectangular panels.
*   **Material or structure:** It appears to be made of dark, polished wood, structured in a classic wainscoting or traditional cabinetry style with raised or recessed panels.
*   **Best reading:** Wood paneling
*   **Confidence:** High

Evidence: `reads/parchment/room.walls.noble-panel/09ebb3df62d599b6-5cec1869bd`.

## charcoal / room.walls.noble-paper

Intended: A tall cream wallpaper wall panel bearing three oversized burgundy fleur-like leaf motifs arranged vertically, with one broad curled upper corner revealing its paper. Motifs simple bold and original, no tiny pattern.. Actions: room.walls.noble-paper.

Gate state: **learned**. Patterned flexible sheet/curl recognized, read as banner or tapestry; wallpaper covering needs material-menu label. Visually distinct from other wall samples.

Based on the image provided:

**Silhouette and Material/Structure:**
The silhouette is a vertical rectangle with its top-right corner curled forward and down, indicating a flexible, hanging material. The material appears to be a light beige or off-white cloth or parchment. It is decorated with two thin, vertical red lines near the left edge and three distinct, red fleur-de-lis symbols stacked vertically in the center.

**Best Reading:**
Banner (or Tapestry)

**Confidence:**
High

Evidence: `reads/charcoal/room.walls.noble-paper/5b5da78d1318f0ce-5cec1869bd`.

## parchment / room.walls.noble-paper

Intended: A tall cream wallpaper wall panel bearing three oversized burgundy fleur-like leaf motifs arranged vertically, with one broad curled upper corner revealing its paper. Motifs simple bold and original, no tiny pattern.. Actions: room.walls.noble-paper.

Gate state: **accepted**. Wallpaper correctly read at31px; curl and repeating pattern recognized.

Based on the image provided:

**Silhouette and Material/Structure:**
The silhouette is a circular icon containing a vertical rectangular strip with its top-right corner curled forward. The material appears to be a thin, flexible sheet like paper or fabric. It features a repeating red heraldic or floral pattern (resembling a fleur-de-lis) on a cream background, flanked by vertical red borders. The curled corner is a classic visual indicator of a surface covering being applied or peeled.

**Best Reading:**
Wallpaper

**Confidence:**
99%

Evidence: `reads/parchment/room.walls.noble-paper/122b77d8650e4239-5cec1869bd`.

## charcoal / room.walls.conservatory

Intended: A tall pointed glass wall section in a dark green iron frame, split into two large pale cyan glass panes; clear peaked greenhouse silhouette and thick frame.. Actions: room.walls.conservatory.

Gate state: **accepted**. Glazed green frame/window correctly read; conservatory family supplied by menu label.

**Silhouette and structure:** The icon features a pointed arch shape with a vertical mullion dividing it into two distinct panes, characteristic of a Gothic or Tudor architectural style. It is enclosed within a circular button.
**Material:** The structure has a dark green frame, suggesting painted wood or metal, while the interior panes are a bright, reflective light blue, clearly representing glass.

**Best reading:** Window
**Confidence:** 99%

Evidence: `reads/charcoal/room.walls.conservatory/6033e7367f2353bb-5cec1869bd`.

## parchment / room.walls.conservatory

Intended: A tall pointed glass wall section in a dark green iron frame, split into two large pale cyan glass panes; clear peaked greenhouse silhouette and thick frame.. Actions: room.walls.conservatory.

Gate state: **accepted**. Glazed green frame/window correctly read; conservatory family supplied by menu label.

Based on the image provided:

**Silhouette and Material/Structure:**
The silhouette is a pointed, gable-shaped frame (flat bottom, vertical sides, angled top) centered within a circular beige button. The structure consists of a dark green frame with a central vertical divider (mullion) and angled dividers at the top. The material inside the frame is depicted as light blue with diagonal white streaks, strongly indicating reflective glass panes.

**Best Reading:**
Window

**Confidence:**
High

Evidence: `reads/parchment/room.walls.conservatory/1187a9f46815e8c8-5cec1869bd`.

## charcoal / room.walls.temple-stone

Intended: Two thick pale stone columns supporting a wide triangular pediment, with a broad open dark gap between columns. Bold classical temple silhouette, no skull or cross.. Actions: room.walls.temple-stone.

Gate state: **learned**. Blind read describes classical pediment and columns in pale carved stone/marble. Exact temple-stone kit is learned from the material menu; charcoal best action is Archway/Gate rather than the kit name.

Based on the image provided:

*   **Silhouette:** A triangular top (pediment) resting on a horizontal beam, supported by two vertical pillars (columns), creating an open portal or doorway shape in the center.
*   **Material/Structure:** It appears to be made of light-colored carved stone or marble, depicting a classical (Greek/Roman) architectural portico or temple facade.
*   **Best Reading:** **Archway** or **Gate** (If the menu strictly defines "materials" rather than wall types, it likely represents **Stone** or **Marble**).
*   **Confidence:** 85% (The visual is distinctly a classical arch/temple, but the exact UI terminology—whether it denotes a structural opening or a stone material category—depends on the specific software).

Evidence: `reads/charcoal/room.walls.temple-stone/c4c34450ccd0cbda-5cec1869bd`.

## parchment / room.walls.temple-stone

Intended: Two thick pale stone columns supporting a wide triangular pediment, with a broad open dark gap between columns. Bold classical temple silhouette, no skull or cross.. Actions: room.walls.temple-stone.

Gate state: **learned**. Blind read describes classical pediment and columns in pale carved stone/marble. Exact temple-stone kit is learned from the material menu; charcoal best action is Archway/Gate rather than the kit name.

Based on the image provided:

*   **Silhouette:** The icon is circular. Inside, it features the distinct silhouette of a classical building facade, consisting of a triangular pediment (roof) supported by two vertical columns, all resting on a flat base.
*   **Material or Structure:** The background of the icon has a metallic gold or bronze gradient, giving it the appearance of a coin or button. The building structure itself is rendered in a smooth, light cream or white color, strongly suggesting polished stone or marble.
*   **Single best reading:** **Stone** (or specifically **Marble**)
*   **Confidence:** High. In UI design for mapping or 3D tools, a classical temple is a common visual shorthand for worked stone or marble materials, distinguishing it from other common options like wood (often a log) or brick (a brick wall pattern).

Evidence: `reads/parchment/room.walls.temple-stone/7e0f6ef2465df60d-5cec1869bd`.

## charcoal / room.walls.cut-rock

Intended: Exactly ONE broad irregular monolithic slab of hewn natural grey-brown bedrock, a continuous solid rock face with three large broad diagonal chisel scars and a jagged uneven outer silhouette. Solid continuous rock, NOT a pile. NO bars, NO doorway, NO opening, NO separate blocks, NO brick joints, NO mortar seams, NO metal, NO crystals. This is a wall carved directly from living bedrock, not prison furniture.. Actions: room.walls.cut-rock.

Gate state: **learned**. Repaint removes incorrect prison bars. Blind read sees one rough-hewn earth/brown-rock mass with diagonal grooves, but best label is Dirt/Earth. Exact hewn-rock kit requires its material label; silhouette correctly avoids block joints and bars.

Based on the image provided:

*   **Silhouette:** An irregular, jagged chunk or clod shape, contained within a dark circular border. The left edge is particularly uneven.
*   **Material/Structure:** The material appears rough and earthy, colored in shades of brown and tan. It features three distinct, dark diagonal grooves or striations across its surface, giving it the appearance of layered sedimentary rock, a rough-hewn stone, or a hard clod of dirt.

**Single best reading:** Dirt (or Earth/Brown Rock)
**Confidence:** High (that it represents an earth/stone material), Medium-High (for the specific label "Dirt" due to the brown coloration).

Evidence: `reads/charcoal/room.walls.cut-rock/b081a182f03b808f-5cec1869bd`.

## parchment / room.walls.cut-rock

Intended: Exactly ONE broad irregular monolithic slab of hewn natural grey-brown bedrock, a continuous solid rock face with three large broad diagonal chisel scars and a jagged uneven outer silhouette. Solid continuous rock, NOT a pile. NO bars, NO doorway, NO opening, NO separate blocks, NO brick joints, NO mortar seams, NO metal, NO crystals. This is a wall carved directly from living bedrock, not prison furniture.. Actions: room.walls.cut-rock.

Gate state: **accepted**. Repaint removes incorrect prison bars. Blind read identifies Stone/Rock (95%) as one rough monolithic chunk with diagonal striations, matching the hewn-rock wall family.

Based on the image provided:

*   **Silhouette:** An irregular, jagged, roughly trapezoidal or rectangular chunk sitting within a circular frame.
*   **Material or Structure:** The object has a rough, earthy brown and grey texture with prominent, deep diagonal grooves or striations across its surface. It strongly resembles a piece of natural, unworked rock or layered stone (like slate or sandstone).
*   **Best Reading:** Stone (or Rock)
*   **Confidence:** 95%

Evidence: `reads/parchment/room.walls.cut-rock/670c3244316cd58d-5cec1869bd`.

## charcoal / room.walls.tower-stone

Intended: A narrow tall blue-grey cylindrical masonry tower segment with one large pointed arched window, smoothly curved wall and flat top. No crenellations, skull, flag or arrows.. Actions: room.walls.tower-stone.

Gate state: **learned**. Blind read identifies grey-blue masonry and tower/window silhouette, best material Stone. The tower-stone kit label is learned; the material and structure are correct.

Based on the image provided:

**Description:**
The silhouette is a stout, slightly curved block featuring a central arched cutout, resembling a small window or arrow slit. The structure appears to be made of greyish-blue stone masonry, with visible lines suggesting individual stacked blocks, typical of a castle wall or tower section.

**Best Reading:** Stone (or Stone Wall)
**Confidence:** 95%

Evidence: `reads/charcoal/room.walls.tower-stone/1be76ffda1ec93bf-5cec1869bd`.

## parchment / room.walls.tower-stone

Intended: A narrow tall blue-grey cylindrical masonry tower segment with one large pointed arched window, smoothly curved wall and flat top. No crenellations, skull, flag or arrows.. Actions: room.walls.tower-stone.

Gate state: **learned**. Blind read identifies grey-blue masonry and tower/window silhouette, best material Stone. The tower-stone kit label is learned; the material and structure are correct.

Based on the image provided:

*   **Silhouette:** A stout, cylindrical tower or pillar shape featuring a central, pointed archway or window.
*   **Material/Structure:** The structure is composed of grey-blue masonry, clearly showing distinct, rectangular cut stone blocks.

**Best Reading:** Stone
**Confidence:** High

Evidence: `reads/parchment/room.walls.tower-stone/d7f3f9d572b20158-5cec1869bd`.

## charcoal / room.walls.mine-timbered

Intended: A stout squared wooden mine support frame around a dark rocky tunnel mouth with two very broad short diagonal corner braces. Tunnel silhouette distinct from wall plank panels.. Actions: room.walls.mine-timbered.

Gate state: **accepted**. Blind read identifies Mine Entrance (95%) with thick wooden support frame and rocky tunnel. This directly identifies the timbered-mine material family in the wall menu.

Based on the image provided:

**Description:** The silhouette is a circular icon containing a framed opening. The structure appears to be made of thick, brown wooden timbers—specifically vertical posts, a horizontal top beam, and diagonal corner braces—forming an entranceway. The center of the frame is a dark, irregular void, suggesting a deep tunnel or cave carved into rock.

**Best Reading:** Mine Entrance (or Mine Shaft)
**Confidence:** High (95%)

Evidence: `reads/charcoal/room.walls.mine-timbered/53bf1c02948ca576-5cec1869bd`.

## parchment / room.walls.mine-timbered

Intended: A stout squared wooden mine support frame around a dark rocky tunnel mouth with two very broad short diagonal corner braces. Tunnel silhouette distinct from wall plank panels.. Actions: room.walls.mine-timbered.

Gate state: **accepted**. Blind read identifies Mine Entrance (95%) with thick wooden support frame and rocky tunnel. This directly identifies the timbered-mine material family in the wall menu.

Based on the image provided:

**Description:** The silhouette features a sturdy, roughly rectangular frame enclosing a dark, central void. The structure appears to be made of thick, brown wooden beams forming a portal or entranceway, leading into a dark interior with hints of grey, rocky texture. The ground in front is a light tan or dirt color.

**Best Reading:** Mine Entrance
**Confidence:** 95%

Evidence: `reads/parchment/room.walls.mine-timbered/56734bec6165c66b-5cec1869bd`.

## charcoal / room.walls.black-stone

Intended: A compact stepped wall mass built from smooth dressed NEAR-BLACK BASALT RECTANGULAR BLOCKS, five large dark charcoal masonry blocks with crisp horizontal mortar joints and subtle cool-grey edge highlights, with one DARK OXBLOOD RED horizontal stone band across its middle. Solid heavy flat-topped squared masonry silhouette. This is black basalt architecture, absolutely NO crystals, NO purple, NO jagged points, NO glowing mineral shards. Make the black blocks readable against the circular ground with clear pale edge lighting.. Actions: room.walls.black-stone.

Gate state: **learned**. Repaint replaces incorrect crystals with the actual kit: dressed near-black masonry with dark red band. Blind read describes dark blocks/red accent course correctly, calling it Brick Wall. Exact black-stone kit name is learned from the material menu.

Based on the image provided:

*   **Silhouette:** The silhouette is a roughly rectangular stack of horizontal elements, wider than it is tall, contained within a circular border.
*   **Material or Structure:** The image depicts a small section of masonry composed of three horizontal layers (courses) of rectangular blocks. The top and bottom layers consist of dark grey or black blocks, with two blocks visible in each layer. Sandwiched between them is a single, continuous middle layer made of a dark red block. The texture appears rough and solid, resembling cut stone or brick.
*   **Single Best Reading:** Brick Wall (specifically, a dark brick wall with a red accent course).
*   **Confidence:** High.

Evidence: `reads/charcoal/room.walls.black-stone/c3f46a44be24aef4-5cec1869bd`.

## parchment / room.walls.black-stone

Intended: A compact stepped wall mass built from smooth dressed NEAR-BLACK BASALT RECTANGULAR BLOCKS, five large dark charcoal masonry blocks with crisp horizontal mortar joints and subtle cool-grey edge highlights, with one DARK OXBLOOD RED horizontal stone band across its middle. Solid heavy flat-topped squared masonry silhouette. This is black basalt architecture, absolutely NO crystals, NO purple, NO jagged points, NO glowing mineral shards. Make the black blocks readable against the circular ground with clear pale edge lighting.. Actions: room.walls.black-stone.

Gate state: **accepted**. Repaint replaces incorrect crystals with dressed near-black masonry and dark red band. Blind read correctly identifies dark stone with red band (85%).

Based on the image provided:

**Silhouette:** The icon features a stepped, three-tiered shape, wider at the base and narrowing towards the top, resembling a small stack of rectangular blocks or a stylized cross-section of a thick wall.
**Material or Structure:** It appears to represent heavy masonry. The top and bottom tiers are a dark grey or black, suggesting dark stone, obsidian, or dark brick. The middle tier is a distinct dark red color, creating a prominent horizontal band.

**Best Reading:** Dark stone with red band (or Dark brick)
**Confidence:** 85%

Evidence: `reads/parchment/room.walls.black-stone/0f3fb180251c5a46-5cec1869bd`.

## charcoal / room.walls.wattle-daub

Intended: A squat warm clay wall with a large exposed patch of woven brown branches: three broad horizontal sticks interlaced with two upright sticks. Soft irregular plaster edges.. Actions: room.walls.wattle-daub.

Gate state: **accepted**. Blind read identifies Wattle and Daub with clay over woven sticks, high confidence.

Based on the image provided:

*   **Silhouette:** The icon features a roughly circular, slightly lumpy and irregular blob shape contained within a thin, dark grey circular border.
*   **Material/Structure:** The base material appears to be an earthy, terracotta-brown substance resembling smooth but uneven mud or clay. Embedded in the center of this mud is a darker brown, rough, grid-like structure that looks like woven sticks, twigs, or branches.
*   **Best Reading:** Wattle and daub
*   **Confidence:** High

Evidence: `reads/charcoal/room.walls.wattle-daub/284b1f3101913891-5cec1869bd`.

## parchment / room.walls.wattle-daub

Intended: A squat warm clay wall with a large exposed patch of woven brown branches: three broad horizontal sticks interlaced with two upright sticks. Soft irregular plaster edges.. Actions: room.walls.wattle-daub.

Gate state: **accepted**. Blind read identifies Wattle and Daub with clay over woven sticks, high confidence.

Based on the image provided:

*   **Silhouette:** A circular icon containing an irregular, jagged shape that looks like a broken patch.
*   **Material/Structure:** The outer part of the irregular shape appears to be a reddish-brown mud, clay, or plaster. The center is broken away to reveal an underlying structure of interwoven dark brown wooden sticks or branches forming a lattice.
*   **Best Reading:** Wattle and Daub (or Wattle & Daub)
*   **Confidence:** High

Evidence: `reads/parchment/room.walls.wattle-daub/fd67e80176734e8e-5cec1869bd`.

## charcoal / building.storeys.1

Intended: Exactly 1 clearly separated storey of one squat teal-and-ivory building, viewed straight on. One single broad level with one large dark window and a flat ochre roof. No stacked floors.. Actions: building.storeys.1.

Gate state: **accepted**. Blind 31px read correctly counts 1 storey/storeys.

The silhouette is a squat, rectangular block topped with a slightly overhanging, flat roof. The structure appears to be a small, single-level building with a yellow roof, cream-colored walls, and teal trim. It features an arched door on the left and a single square window on the right.

Reading: 1 storey
Confidence: High

Evidence: `reads/charcoal/building.storeys.1/3a4340e88235a4aa-ae04db4dcf`.

## parchment / building.storeys.1

Intended: Exactly 1 clearly separated storey of one squat teal-and-ivory building, viewed straight on. One single broad level with one large dark window and a flat ochre roof. No stacked floors.. Actions: building.storeys.1.

Gate state: **accepted**. One storey correctly counted at31px.

Based on the image provided:

**Silhouette and Structure:** The icon displays a simple, low-profile rectangular building with a pitched roof. The structure appears to be made of light-colored stucco or plaster walls with a yellow/orange roof (suggesting thatch or tile) and dark green trim around a single ground-floor door and window. It clearly depicts only one level.

**Best Reading:** 1 story
**Confidence:** High

Evidence: `reads/parchment/building.storeys.1/5f8f3b1f1b0df007-ae04db4dcf`.

## charcoal / building.storeys.2

Intended: Exactly 2 clearly separated storeys of one squat teal-and-ivory building, viewed straight on. 2 equal horizontal floors stacked vertically, each floor with exactly one large dark window, separated by very thick ivory horizontal floor bands; flat ochre roof. Countable floor silhouette, no extra attic or cellar.. Actions: building.storeys.2.

Gate state: **accepted**. Blind 31px read correctly counts 2 storey/storeys.

Based on the image provided:

**Description:**
The silhouette is a rectangular, two-tiered block with a slightly pitched roof. The structure depicts a stylized building featuring a gold roof, teal walls, and white horizontal trim that clearly separates it into two distinct levels. Each level has a single arched window.

**Reading:**
2 storeys

**Confidence:**
100%

Evidence: `reads/charcoal/building.storeys.2/180a9ce22b54c287-ae04db4dcf`.

## parchment / building.storeys.2

Intended: Exactly 2 clearly separated storeys of one squat teal-and-ivory building, viewed straight on. 2 equal horizontal floors stacked vertically, each floor with exactly one large dark window, separated by very thick ivory horizontal floor bands; flat ochre roof. Countable floor silhouette, no extra attic or cellar.. Actions: building.storeys.2.

Gate state: **accepted**. Blind read correctly counts 2 storeys and distinct floor/window tiers, high confidence.

**Silhouette and Structure:** The icon displays a circular badge containing a two-tiered rectangular building. The structure features teal walls with a subtle grid texture, separated by prominent cream-colored horizontal bands (trim). It has a flat, yellowish roof and one dark, arched window centered on each of its two levels.

**Reading:** 2 stories
**Confidence:** 99%

Evidence: `reads/parchment/building.storeys.2/954254f867188314-ae04db4dcf`.

## charcoal / building.storeys.3

Intended: Exactly 3 clearly separated storeys of one squat teal-and-ivory building, viewed straight on. 3 equal horizontal floors stacked vertically, each floor with exactly one large dark window, separated by very thick ivory horizontal floor bands; flat ochre roof. Countable floor silhouette, no extra attic or cellar.. Actions: building.storeys.3.

Gate state: **accepted**. Blind 31px read correctly counts3 storeys.

Based on the image provided:

**Silhouette:** A stacked, three-tiered cylindrical or rounded-rectangular shape contained within a circular dark badge.
**Material or structure:** It depicts a stylized, cartoonish building. It features a flat tan roof and three distinct teal-colored levels. Each level is separated by a prominent white horizontal band (representing floors or balconies) and contains a small, dark, arched window in the center.

**Best reading:** 3 storeys
**Confidence:** High

Evidence: `reads/charcoal/building.storeys.3/015a622f9469c724-ae04db4dcf`.

## parchment / building.storeys.3

Intended: Exactly 3 clearly separated storeys of one squat teal-and-ivory building, viewed straight on. 3 equal horizontal floors stacked vertically, each floor with exactly one large dark window, separated by very thick ivory horizontal floor bands; flat ochre roof. Countable floor silhouette, no extra attic or cellar.. Actions: building.storeys.3.

Gate state: **accepted**. Blind read correctly counts 3 storeys and distinct floor/window tiers, high confidence.

Based on the image provided:

*   **Silhouette:** A rectangular, vertically stacked building profile with a flat, slightly overhanging roof, contained within a circular badge.
*   **Material or Structure:** The structure is clearly divided into three distinct horizontal levels. Each level has a teal facade with a dark, arched window in the center, and is separated by light beige horizontal bands representing floors. The roof is a solid golden-yellow cap.
*   **Best Reading:** 3 storeys
*   **Confidence:** High

Evidence: `reads/parchment/building.storeys.3/43cde946038d33e3-ae04db4dcf`.

## charcoal / roof.style.flat

Intended: One broad flat horizontal grey roof slab with low thick parapet lip around its top edge, shown from slightly above so the completely level roof surface is obvious. No slope, ridge, shingles or building below.. Actions: roof.style.flat, building.roof.flat.

Gate state: **accepted**. Flat roof correctly read at31px; visible parapet/tray silhouette.

Based on the image provided:

*   **Silhouette:** A flat, rectangular shape with raised edges along all four sides, resembling a shallow tray.
*   **Material/Structure:** It appears to be a smooth, solid grey material, such as concrete or metal. The structure consists of a flat central surface surrounded by a low perimeter wall (a parapet).
*   **Best reading:** Flat roof
*   **Confidence:** High

Evidence: `reads/charcoal/roof.style.flat/acae2fd89dbd06e7-ac7c8cad7a`.

## parchment / roof.style.flat

Intended: One broad flat horizontal grey roof slab with low thick parapet lip around its top edge, shown from slightly above so the completely level roof surface is obvious. No slope, ridge, shingles or building below.. Actions: roof.style.flat, building.roof.flat.

Gate state: **accepted**. Blind read identifies Flat Roof (95%) with flat plane and low parapet.

Based on the image provided:

*   **Silhouette:** An isometric view of a square, flat shape with slightly raised edges, giving it a shallow, tray-like profile.
*   **Material or Structure:** It appears to be made of dark grey stone, concrete, or possibly metal. The structure consists of a flat central plane surrounded by a low, continuous perimeter wall (a parapet).
*   **Best Reading:** Flat Roof
*   **Confidence:** 95%

Evidence: `reads/parchment/roof.style.flat/cf1f5850561600c4-ac7c8cad7a`.

## charcoal / roof.style.auto

Intended: One broad ochre pitched roof silhouette with one large ivory five-tooth cog centered below its ridge. Automatic inherited roof styling. No flat slab or brick wall.. Actions: roof.style.auto, building.roof.auto.

Gate state: **learned**. Roof and gear/settings correctly recognized; automatic type-dependent choice needs context. Distinct from flat and material swatches.

Based on the image provided:

**Silhouette:** The icon features an inverted 'V' shape, resembling a simple pitched roof, positioned directly above a multi-toothed gear or cogwheel. These elements are centered within a dark circular badge with a thin, lighter border.

**Material or Structure:** The roof element is a thick, golden-yellow chevron with slight shading that gives it a subtle 3D or beveled appearance. The gear below it is a light beige or off-white color with distinct teeth and a dark central hole, appearing more flat.

**Best Reading:** Roof Settings (or Configure Roof)
**Confidence:** 99% (The combination of a roof icon with a universal gear symbol strongly indicates a settings or configuration menu for roofs).

Evidence: `reads/charcoal/roof.style.auto/dccab70eb7a8d83c-ac7c8cad7a`.

## parchment / roof.style.auto

Intended: One broad ochre pitched roof silhouette with one large ivory five-tooth cog centered below its ridge. Automatic inherited roof styling. No flat slab or brick wall.. Actions: roof.style.auto, building.roof.auto.

Gate state: **learned**. Blind read identifies roof plus gear as Roof Settings. Automatic roof selection is learned from the menu label; the gear denotes configuration but does not uniquely imply auto.

Based on the 31px image provided:

*   **Silhouette:** A circular badge containing an inverted 'V' shape (resembling a pitched roof with a small chimney on the right) positioned directly above a multi-toothed circular shape (a gear or cogwheel).
*   **Material or structure:** The background is a soft, shaded pale circle. The roof element appears as a thick, stylized golden-orange structure with a slight 3D or embossed effect and a dark outline. The gear below it is a lighter, flatter icon, also with a dark outline, typical of standard UI elements.
*   **Single best reading:** Roof Settings (or Configure Roof)
*   **Confidence:** High

Evidence: `reads/parchment/roof.style.auto/544301e59a7c8bd6-ac7c8cad7a`.

## charcoal / ruler.keepfor.1

Intended: Exactly ONE enormous bold painted ivory glyph '1', filling most of the badge, with one small chunky brass hourglass tucked against its lower-right corner. The 1 is the dominant silhouette and unmistakably readable at31px. This is a one-round duration choice, not timer reset. No curved arrows, no other glyphs, no extra hourglasses. Text exception: paint exactly '1'.. Actions: ruler.keepfor.1, ruler.rounds.1.

Gate state: **accepted**. Blind read identifies 1 Turn/1 Round (95%) from numeral 1 and hourglass.

Based on the image provided:

**Silhouette and Material/Structure:**
The image is a circular icon with a metallic, silver-grey outer ring. Inside the ring is a dark teal gradient background. The central element is a large number "1", rendered in a 3D, embossed metallic gold or brass style with distinct highlights and shadows. Tucked into the bottom right corner of the "1" is a smaller symbol of an hourglass, matching the same gold/brass metallic material and 3D styling.

**Single Best Reading:**
1 Turn (or 1 Round)

**Confidence:**
High (95%) - The combination of the number "1" and an hourglass (a universal symbol for time) in a tabletop gaming context strongly indicates a duration of one turn or round for a template or effect.

Evidence: `reads/charcoal/ruler.keepfor.1/53f325f50cdd45a7-53d35cfb44`.

## parchment / ruler.keepfor.1

Intended: Exactly ONE enormous bold painted dark slate glyph '1', filling most of the badge, with one small chunky brass hourglass tucked against its lower-right corner. The 1 is the dominant silhouette and unmistakably readable at31px. This is a one-round duration choice, not timer reset. No curved arrows, no other glyphs, no extra hourglasses. Text exception: paint exactly '1'.. Actions: ruler.keepfor.1, ruler.rounds.1.

Gate state: **learned**. Blind read identifies numeral 1 and hourglass (95%), proposing 1 Minute or 1 Turn. The unit of rounds is learned from the timing menu; count and duration are visible.

Based on the image provided:

**Description:**
*   **Silhouette:** A circular badge or token shape. Inside, it features a large numeral '1' with a smaller hourglass shape tucked into its lower right side.
*   **Material/Structure:** The base is a circular token with a metallic gold or bronze rim and a light beige, possibly parchment-textured center. The number '1' is a thick, 3D-extruded element in a dark teal or blue-grey color with beveled edges. The small hourglass is metallic gold.

**Reading:**
*   **Single best reading:** 1 Hourglass (likely representing 1 Minute or 1 Turn depending on the specific game context)
*   **Confidence:** 95%

Evidence: `reads/parchment/ruler.keepfor.1/e4ed76b03f773044-53d35cfb44`.

## charcoal / ruler.keepfor.n

Intended: Exactly THREE small chunky brass hourglasses grouped in a staggered fan: one at left, one at right, and one slightly lower in front. All three have clearly separated wide top and bottom bars and ivory sand. This is multiple rounds of duration, a group of three timers, not reset and not unlimited. No letters, numbers, arrows, infinity sign, or extra symbols.. Actions: ruler.keepfor.n.

Gate state: **learned**. Repaint removes misleading N. Blind read identifies three hourglasses as Long Timer/Extended Time (90%). Multiple-round duration is readable; choosing a custom round count requires the menu label.

Based on the image provided:

**Silhouette and Material/Structure:**
The silhouette shows a cluster of three hourglass shapes, with one positioned in the foreground and two slightly behind it, forming a roughly triangular group within a faint circular border. The structure consists of classic hourglass designs, appearing to be made of metallic gold or brass frames holding glass bulbs that contain white sand.

**Single Best Reading:**
Long Timer (or Extended Time)

**Confidence:**
High (90%) - The use of multiple hourglasses in UI design typically denotes a longer duration or an extended period compared to a single hourglass icon.

Evidence: `reads/charcoal/ruler.keepfor.n/6823ee611893c117-53d35cfb44`.

## parchment / ruler.keepfor.n

Intended: Exactly THREE small chunky brass hourglasses grouped in a staggered fan: one at left, one at right, and one slightly lower in front. All three have clearly separated wide top and bottom bars and ivory sand. This is multiple rounds of duration, a group of three timers, not reset and not unlimited. No letters, numbers, arrows, infinity sign, or extra symbols.. Actions: ruler.keepfor.n.

Gate state: **learned**. Repaint removes misleading N. Blind read describes three overlapping hourglasses correctly and calls it Timer (95%). Multiple-round timing is represented; exact custom count is learned from the label, distinct from numeral-1 duration.

Based on the image provided:

**Silhouette and Material/Structure:**
The silhouette is a circular badge containing a cluster of three overlapping hourglass shapes (one in front, two slightly behind). The structure features metallic-looking gold or brass frames for the hourglasses with white interiors representing glass and sand, all set against a pale, creamy circular background.

**Single Best Reading:**
Timer

**Confidence:**
95%

Evidence: `reads/parchment/ruler.keepfor.n/fe8202d96f8624c6-53d35cfb44`.

## charcoal / roof.style.thatch

Intended: One thick golden straw thatched roof wedge with a prominently shaggy fringed eave. Three broad straw bundles descend from ridge to eave; chunky fibrous straw, no ceramic tiles, no wood planks, no stone slates.. Actions: roof.style.thatch, building.roof.thatch.

Gate state: **accepted**. Blind read correctly identifies fibrous golden thatch, high confidence.

**Silhouette:** Three vertical, slightly tapering bundles forming a roughly trapezoidal shape with a jagged, fringed bottom edge.
**Texture:** Fibrous, layered, and bundled with horizontal ridges, appearing shaggy at the bottom.
**Color:** Golden-yellow, tan, and light brown.

**Reading:** Thatch
**Confidence:** High

Evidence: `reads/charcoal/roof.style.thatch/76392cf4bb4654ea-0eedbebdc7`.

## parchment / roof.style.thatch

Intended: One thick golden straw thatched roof wedge with a prominently shaggy fringed eave. Three broad straw bundles descend from ridge to eave; chunky fibrous straw, no ceramic tiles, no wood planks, no stone slates.. Actions: roof.style.thatch, building.roof.thatch.

Gate state: **accepted**. Blind read correctly identifies fibrous golden thatch, high confidence.

Based on the image provided:

*   **Visible silhouette:** A trapezoidal, pitched roof section with a distinctly jagged and uneven bottom edge.
*   **Material texture:** Fibrous, bundled, and layered, with vertical striations that suggest tightly packed dried plant stalks.
*   **Colour:** Warm golden-yellow, tan, and light brown.
*   **Single best roof material reading:** Thatch
*   **Confidence:** High

Evidence: `reads/parchment/roof.style.thatch/8bf822599d629bd9-0eedbebdc7`.

## charcoal / roof.style.tile

Intended: One broad orange terracotta roof wedge made from six thick curved barrel tiles, their semicircular hollow ends clearly visible along its eave. Bold scalloped edge and two overlapping rows, no straw fringe.. Actions: roof.style.tile, building.roof.tile.

Gate state: **accepted**. Blind read correctly identifies curved terracotta roof tiles (99%).

Based on the visual characteristics of the icon:

*   **Silhouette:** A rectangular section characterized by repeating, parallel, semi-cylindrical ridges that create a wavy or scalloped bottom edge.
*   **Material texture:** Smooth but deeply undulating, clearly depicting overlapping curved elements with distinct highlighted peaks and shadowed valleys.
*   **Colour:** Terracotta orange/reddish-brown.

**Best roof material reading:** Terracotta roof tiles (or Spanish barrel tiles)
**Confidence:** 99%

Evidence: `reads/charcoal/roof.style.tile/62a089543b4c6460-0eedbebdc7`.

## parchment / roof.style.tile

Intended: One broad orange terracotta roof wedge made from six thick curved barrel tiles, their semicircular hollow ends clearly visible along its eave. Bold scalloped edge and two overlapping rows, no straw fringe.. Actions: roof.style.tile, building.roof.tile.

Gate state: **accepted**. Blind read correctly identifies curved terracotta roof tiles (99%).

Based on the image provided:

*   **Silhouette:** A rectangular patch composed of overlapping, wavy rows, creating a scalloped or corrugated profile along the edges.
*   **Material Texture:** Appears smooth and hard, with distinct convex ridges and concave valleys that create strong highlights and shadows, suggesting a molded or baked material.
*   **Colour:** Rich reddish-brown, burnt orange, or terracotta.

**Best roof material reading:** Terracotta roof tiles (or Spanish clay tiles)
**Confidence:** 99%

Evidence: `reads/parchment/roof.style.tile/4bb65c9d683b7a2d-0eedbebdc7`.

## charcoal / roof.style.slate

Intended: One roof wedge of overlapping large blue-grey angular slate plates with irregular sharply chipped trapezoid edges. Two staggered rows of flat broad stone plates, matte layered slate, no curved tiles, no grain or straw.. Actions: roof.style.slate, building.roof.slate.

Gate state: **accepted**. Blind read correctly identifies rough blue-grey slate tiles/shingles (95%).

Based on the visual characteristics of the icon:

*   **Silhouette:** A circular boundary enclosing two overlapping horizontal rows of thick, irregular, downward-pointing plates that resemble scales or jagged rectangles.
*   **Material Texture:** Rough, matte, and uneven. The highlights and shadows suggest thick, naturally cleft, or chipped edges rather than perfectly manufactured smooth surfaces.
*   **Colour:** Cool, dark blue-grey or slate grey.

**Best roof material reading:** Slate shingles
**Confidence:** 95%

Evidence: `reads/charcoal/roof.style.slate/23cb323cbf6d2976-0eedbebdc7`.

## parchment / roof.style.slate

Intended: One roof wedge of overlapping large blue-grey angular slate plates with irregular sharply chipped trapezoid edges. Two staggered rows of flat broad stone plates, matte layered slate, no curved tiles, no grain or straw.. Actions: roof.style.slate, building.roof.slate.

Gate state: **accepted**. Blind read correctly identifies rough blue-grey slate tiles/shingles (95%).

Based on the image provided:

*   **Silhouette:** The icon features overlapping, roughly rectangular shapes arranged in two staggered rows. The edges of these shapes are slightly irregular and jagged, not perfectly straight.
*   **Material Texture:** The surface appears rough, matte, and slightly uneven, resembling natural stone that has been cleft or split into flat layers.
*   **Colour:** The tiles are a dark blue-grey or charcoal colour with lighter grey highlights indicating texture. They are set against a pale tan or gold circular background.

**Best roof material reading:** Slate tiles
**Confidence:** 95%

Evidence: `reads/parchment/roof.style.slate/6401ed1769143e64-0eedbebdc7`.

## charcoal / roof.style.shingle

Intended: One roof wedge of three overlapping rows of warm brown wooden shingles, each shingle a broad tapered rectangular plank with one thick dark wood-grain stroke. Distinct stepped irregular wooden eave, no straw, slate or terracotta.. Actions: roof.style.shingle, building.roof.shingle.

Gate state: **accepted**. Blind read correctly identifies wood shingles/wood shakes with visible wood grain, high confidence.

Based on the visual evidence in the icon:

*   **Silhouette:** Two overlapping, angled tiers with uneven, jagged bottom edges formed by individual downward-pointing segments.
*   **Material Texture:** Rough, thick, and layered, with vertical striations on the individual pieces that strongly suggest wood grain.
*   **Colour:** Warm, varied shades of brown, featuring lighter golden-brown highlights on the raised areas and dark brown shadows in the recesses.
*   **Best Reading:** Wood shingles (or wood shakes).
*   **Confidence:** High.

Evidence: `reads/charcoal/roof.style.shingle/930ae39f329f10df-0eedbebdc7`.

## parchment / roof.style.shingle

Intended: Exactly FOUR very broad chunky brown wooden roof shingles, arranged as two overlapping rows of two rectangular planks. Each plank has a large round dark WOOD KNOT with one thick curved grain ring around it. Broad smooth wood faces, wide separated blocky square-cut bottom ends. Few large simple forms. NO straw, NO fibres, NO bundle, NO many narrow strands, NO hairlike texture, NO thatch. Dark warm brown solid timber with large obvious knots, not yellow grass.. Actions: roof.style.shingle, building.roof.shingle.

Gate state: **accepted**. Repaint replaces straw-like fibres with four broad wooden boards and round knots. Blind read now identifies Wood Shingles (95%), distinct from sibling thatch.

- **Silhouette:** Circular icon containing four overlapping rectangular shapes arranged in a 2x2 grid, resembling stacked tiles.
- **Material Texture:** Wood-like with visible grain striations and distinct dark spots on each piece, resembling nail holes or knots.
- **Colour:** Medium to dark brown rectangles on a pale cream background, enclosed by a golden-brown border.
- **Reading:** Wood Shingles
- **Confidence:** 95%

Evidence: `reads/parchment/roof.style.shingle/8de8c7011a05a276-0eedbebdc7`.
