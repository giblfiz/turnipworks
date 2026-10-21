# Orbital menus and painted icons — design record

Recorded 2026-10-11 by Fauna from Harry's Turnip Works conversation. This captures the icon/menu exploration immediately preceding the request to save notes; earlier asset-pipeline and house-style history remains in the project's existing records.

**Status: design exploration. The content cuts were implemented on 2026-10-11 ("ship the cuts": the table under "Content changes agreed or proposed" marks each row; as built in [docs/UI.md](../../UI.md), "The cuts"). The geometry and the painted icons are NOT implemented and remain paused.** Harry likes the circular painted icon direction. Several menu-content cuts were agreed. The final concentric-arc mockup met the requested shape more closely, but Harry still disliked its appearance and wants to mull it over. Do not treat the last image as an approved layout. No runtime code, registry, pawn permissions, or deployed UI was changed by this exploration or this note-taking pass.

## Where we started

The game uses a shared icon registry in [icons.js](../../../engine/client/icons.js), with thin-outline Lucide SVGs (vendored 0.460, ISC). The ring, command bar, and chord interface share it. Existing raster build/placement icons include wooden-crate and room-miniature imagery under `engine/client/data/icons/`. The house art direction is **D — heroic hand-painted**: stout miniature-compatible forms, broad bevels, clean component separation, matte painted gradients, restrained texture. Warm wood, cream, ochre, muted teal and gray-blue pictograms on dark charcoal controls fit this vocabulary without painting the whole interface as fantasy scenery.

The audit inspected [menu.js](../../../engine/client/menu.js), [commands.js](../../../engine/client/commands.js), and [ring.js](../../../engine/client/surfaces/ring.js). Current ring buttons are approximately 67 px with 31 px icons at the default scale. Mockups used archived game screenshots, not a live browser acceptance test. The pawn screenshot depicts an older HP-control arrangement, not the current command inventory. Keep these distinct when resuming.

## Icon choices

- **Circular controls**, not rounded-square cards. Tactile, chunky hand-painted pictograms with readable silhouettes; quieter UI surfaces around them.
- **Re-roll:** two dice.
- **Resize:** a small solid crate anchored in the lower-left of a larger ghost crate; exactly one arrow extends up/right to communicate scaling.
- **Turn:** upright crate with a horizontal curved arrow. One arrowhead, not two opposing arrows.
- **Sideways tilt:** call its UI action **Yaw** from now on, even though Harry explicitly does not mean physical yaw. It belongs in the **expanded object menu**, not primary. A visibly tipping crate with a vertical curved arrow distinguishes it from Turn. Early mockups call it Roll; those labels are superseded.
- **Damage A:** slashed red heart. **Damage B:** shield with red impact burst. Harry likes both; no winner selected. Alternatives C (red drop/minus) and D (pawn being hit) remain archived, not selected. Later pawn previews use A illustratively.
- Replace should show exchanging objects, not dice. The first in-scene generation confused it with Re-roll; the corrected version was strongly liked.

These are concept studies, not extracted shipping icons. Recognition at actual 31 px size, contrast, state variants, and matching vector/raster implementations still need checking. Complex pictograms such as Give control's hands may need simplification; that is a concern, not a user rejection.

## Geometry: intent and unresolved appearance

Nick's feedback, relayed by Harry, was that reading all the way around a circle is difficult. This motivated an **arch** rather than a filled circular menu; it is design feedback, not a cited usability study. Closed menus aim for 3–4 primary actions with the hamburger on the right. Opening it prioritizes secondary actions while keeping the original primaries accessible. Harry corrected the intended destination for those primaries to **6–9 o'clock**, the lower-left quadrant, not 9–12.

The initial ten-secondary-action arch with a detached primary cluster was too sprawling and was rejected. A tighter, almost-round **continuous horseshoe** with primaries continuing down its left tail initially felt good. Primaries can bleed below the arch's horizon on the left, rather than disappearing or becoming a separate rectangular group. A small grouping gap can distinguish primary from secondary controls.

**Conditions must open as a second concentric arc**, not a square/list popup. **The entire 3:00–6:00 sector must remain unoccupied**, including nested controls, captions, badges, and decorative rails. Do not put Turn directly below the pawn at 6:00. The condition arc belongs above/left, leaving the lower-right clear.

Harry does not want a dedicated Close button. Escape/click-outside dismissal and keeping the menu open across actions were suggestions, not separately accepted behavior. Exact radii, spacing, orientation, expansion animation, submenu density and edge handling remain unresolved. Final feedback: “this is just what I’m asking for, and also I don’t love the way it looks, I think I need to mull on it.” Preserve that pause rather than silently implementing the final mockup.

## Menu inventory before pruning

Counts from the source audit, for a GM with relevant capabilities. Conditional actions change totals; a grouped picker counts as one entry, not one per choice. These are a snapshot, not a permanent assertion about future code.

| Selection | Primary actions (excluding hamburger) | Expanded entries |
| --- | ---: | ---: |
| Ordinary object | 3 | 6 |
| Light object | 3 | 7 |
| Openable object | 4 | Context-dependent; a light/openable may also overflow primary |
| Pawn | 3 | 10 |
| Multiple pawns | 2 | 8 |
| Room | 2 | 10–12 |
| Roof | 1 | 2 |
| Building | 0 | 5 |

The ten-action object mockup was a stress test, not a literal registry: Notes, Contents and Duplicate included illustrative actions. Stub condition/age/fill/notes concepts should not be counted as implemented functionality.

## Content changes agreed or proposed

| Area | Decision | Status / caveat |
| --- | --- | --- |
| Room | Remove Replay spawn from orbital | Agreed; useless here. **IMPLEMENTED 2026-10-11** (the bar keeps it) |
| Room | Remove Add stair | Agreed; stairs belong in the object palette and must function properly. **IMPLEMENTED 2026-10-12**, after stairs became placed library objects with an up / down switch (`stairs`); "add stair" in the bar still plans one |
| Room | Remove Floor | Agreed; floors should be objects that fit/cover rooms and behave properly. **IMPLEMENTED 2026-10-11**, once a floor dragged in from the library changed the whole room's floor on main (`handfeel`); the bar still sets a floor by name |
| Room | Remove Room type | Agreed; delete/rebuild for a different function. **IMPLEMENTED 2026-10-11** (the bar keeps "room type: kitchen") |
| Room | Remove Rename from expanded menu | Agreed; editable room label is a proposed replacement home. **IMPLEMENTED 2026-10-11:** double-click the selected room's label, or F2; the bar as before (Enter stays "step into children") |
| Room | Third primary = Hide/reveal, alongside Turn and Re-roll | Fauna proposal, not explicitly accepted |
| Room | Retain Walls, Fog height, Lock, Height in expanded | Proposed reduced set: four entries, roof decision pending |
| Room | Roof controls | Unsettled; Harry questioned them, did not approve permanent removal |
| Orbitals | Remove Delete button | Hotkey is discoverable; retain underlying deletion and undo. **IMPLEMENTED 2026-10-11** on every ring; the "?" sheet lists the key |
| Pawn | Remove Duplicate and Delete from orbital | Agreed; keep normal commands/shortcuts. **IMPLEMENTED 2026-10-11** |
| Pawn | Move Name and Give control to character-sheet area | Agreed direction; placement/details not designed. **IMPLEMENTED 2026-10-11:** two rows at the top of the sheet card, "Name" (owner and GM) and "Moved by" (the GM picks; others read it). Fauna's placement, for Harry to look at |
| Pawn | Drop Lock | Explicitly agreed, not merely relocate to sheet. **IMPLEMENTED 2026-10-11:** no control, no effect in client or core, legacy locked pawns load unlocked (docs/NETCODE.md) |
| Object | Add sideways-tilt action to expanded menu | **Built 2026-10-11, labelled Roll** (Harry settled the word the same day; the "Yaw" above is superseded). docs/UI.md "Roll"; the label is one constant, `TILT_LABEL` |

Removing Floor/Add stair menu entries alone does not deliver usable floor/stair objects. Record those semantics as follow-up work, not completed features. Multi-selection menus and unusual object combinations need re-auditing after these cuts.

### Planned pawn menu after cuts

- **Primary:** Turn · Sheet · Damage.
- **Expanded:** Conditions · Indicators · Raise/lower · Hide/reveal · Send to area (five entries).
- **Character sheet:** Name · Give control.
- **Not on orbital:** Duplicate · Delete.
- **Dropped feature:** pawn Lock.

**As built 2026-10-11:** exactly this. The multi-selection re-audit is the table in docs/UI.md "The cuts"; one thing came out of it: a selection with nothing behind ☰ now has no ☰ button.

Conditions and Indicators remain nested choices; arch capacity must account for those, not just the five parent buttons. Retain Send to area: image generation repeatedly lost it, but it was not removed from the intended menu.

### Why pawn Lock was dropped

Harry challenged the purpose of preventing the GM from moving their own pawn. The audit found different behavior across layers: the core `token.move` path denies non-GM movement when locked but permits the GM, whereas the client's normal `movable` check requires `!locked` even for the GM. Locked pawns also block non-GM travel, while damage remains usable. This is a UI/security mismatch, not a rules-level restrained condition.

The [Fantasy Grounds token-locking documentation](https://fantasygroundsunity.atlassian.net/wiki/spaces/FGCP/pages/996640805/Token%2BLocking%2B-%2BGM-Approved%2BPlayer%2BMovement) describes a different feature: GM approval of player movement, with GM movement bypassing the restriction by default. That is a precedent for approval workflows, not evidence of how prevalent they are. TW already has broader movement permissions. No new movement-approval system was requested. Harry agreed to drop pawn Lock. When implementing this, deliberately handle legacy locked saved pawns rather than leaving invisible frozen state behind.

## Sideways tilt implementation breadcrumb

**Done 2026-10-11** (docs/UI.md "Roll", docs/NETCODE.md "Tilt"): the field is `tiltZ`, the button says Roll, the existing ring only. What follows is the note as it stood before.

The renderer already has a head start: world groups use `rotation.order = 'YXZ'`, and library exhibits can use `tiltX`/`tiltZ` to lie on their side/back. The persisted object command path does not yet carry those fields consistently through set/move/copy/strip operations. Existing `rot` is the ordinary facing/Turn value; existing mesh `yaw` is already an alignment correction. **Do not wire the new UI “Yaw” control to that existing field merely because the name matches.**

Before implementation: settle axis and pivot/grounding behavior, persist tilt, synchronize it through multiplayer and undo, retain it on copy, and test saved/reloaded objects. The agreed label is unusual intentionally; naming storage fields by physical axes can keep the implementation honest.

## Archived mockups and false trailheads

All eleven generated images are preserved alongside this note, including failed intermediates. Source images were generated with the built-in image-generation tool during this conversation. Original filenames identify the output; archived bytes are unchanged. Briefs below summarize intent, **not verbatim original prompts**. References were TW house-style artwork/game screenshots, not Dungeon Alchemist assets.

| Archive | Original output ID (`exec-…png`) | Review / intent |
| --- | --- | --- |
| [01 — icon study](mockups/01-icon-study.png) | 860f0b75-8fde-4ee6-92f9-e299f722565e | First 24-icon sheet, rounded-square cards; promising start, requested circles and revised symbols |
| [02 — circular icons](mockups/02-circular-icons.png) | cee1b6e3-c6d2-4ace-8ee6-bf681e164b98 | Circular sheet; two dice, ghost-crate scaling, Damage A/B liked |
| [03 — object menu first](mockups/03-object-menu-first.png) | f2b4b6c8-0d96-4386-afc6-891533243616 | Painted circles in game scene; erroneous Replace dice |
| [04 — corrected object menu](mockups/04-object-menu-corrected.png) | 291bf362-f838-4efb-90ed-4bf6de9beb7c | Corrected exchanging-block Replace; Harry strongly liked this direction |
| [05 — wide arch](mockups/05-wide-arch-rejected.png) | 2d539cd0-82d8-4926-879d-b62693e76fcd | Ten secondary actions plus detached primary group; rejected as sprawling |
| [06 — horseshoe](mockups/06-horseshoe.png) | a787cf60-154a-4565-91db-481756d37961 | Near-round continuous curve, three primary plus seven secondary; initial positive response |
| [07 — conditions panel](mockups/07-conditions-panel-rejected.png) | 0a00d5cf-4ca2-4605-8c73-9a134ed00f1f | Eight pawn controls plus rectangular conditions panel; wrong submenu form |
| [08 — concentric first](mockups/08-concentric-first.png) | 6b2e4c69-7940-4847-921d-ef5bd58cdcc5 | Eight inner/ten outer controls; Turn below and lower-right occupied, violates arch constraint |
| [09 — correction attempt](mockups/09-concentric-correction.png) | d8dfe821-a7d6-4f11-8958-229bed9fe401 | Lost Send to area; low condition placement still problematic |
| [10 — restored actions](mockups/10-concentric-restored-actions.png) | b7c79704-d49e-4787-8492-554ee866ed17 | Send restored and Turn shifted left, but Hide still lower-right |
| [11 — final, unsettled](mockups/11-concentric-final-unsettled.png) | 63215116-9b4e-4dfc-99d0-0985924de6f9 | Better respects blank lower-right; user still dislikes appearance, paused for thought |

Archived scene bases: [source prop screenshot](mockups/source-prop.png), [source pawn screenshot](mockups/source-pawn.png). The latter is historical, not current-registry proof.

Image generation was useful for taste but repeatedly broke exact constraints: changing labels/counts, dropping an action, duplicating arrowheads, placing controls in the forbidden quadrant, and imperfect concentric spacing. These are limitations of the generated mockups, not evidence that the intended geometry cannot work. A future deterministic browser/SVG prototype should check real layout, touch sizes, edges and readability. Do not begin that implementation without resuming the paused design discussion.

## Resume here

**Also part of the ring rebuild (2026-10-15):** conditions shown on the table as cartoon orbiters, poses and base effects, design agreed and parked: [../conditions-2026-10-15.md](../conditions-2026-10-15.md). Design-language rule: everything orbital (submenus are concentric arcs), every slider is the damage drag-track; siblings in one arc never share an icon.

**Built in Ring Lab 2026-10-19 (prototype, not the game ring): the ellipse / one-curve option.** Harry: "maybe the menu is really an oval / ellipse ... maintain an even distance between items rather than an even number of degrees ... use the 9–3:00 top half and get like 8 items ... the primary items sit on the normal ellipse, and then slide", and "the *slide* needs to be actual animated visual movement". What exists, all in `engine/client/ringlab/` and `?ringlab=1`:
- Any arc can be an **ellipse** (`ellipse`, `rx`, `ry`; centre moved by the arc's x / y). On an ellipse, spacing is by **arc length** (a lookup table, 2048 steps): Fit = a fixed pitch of size + gap from the start angle; otherwise even distance across the span. Angles stay clock directions from the centre.
- **One curve** (panel section at the top; built-in preset **"Ellipse · one curve"**): closed = the primaries and ☰ on the ellipse, centred on `closedAt`, ☰ at the right end. Open = the secondaries from `secondaryStart` (9:00) clockwise, ☰ after them; the primaries keep their spacing one pitch + `groupGap` counterclockwise of the first secondary, so opening **slides the group rigidly along the ellipse** past 9 into 7–9. `primaryFloor` (default 6:40) stops the lowest primary short of the bottom of the curve, which runs under the pawn into 3–6: when a ring has four primaries the whole open row turns clockwise to respect it (the junction then sits a little above 9).
- The slide **animates along the path** (Web Animations keyframes every ~6 px of curve, eased as a whole; `duration` 520 ms, `stagger` 30, `easing`), on the real ☰ click; closing plays it backwards and the secondaries run back into ☰; `enter`: secondaries unfurl from ☰ or fade; prefers-reduced-motion jumps.
- **Nested arcs** in one-curve mode are the same ellipse **grown** by `nestOffset` (80) on both semi-axes, never scaled, pitch-spaced from `nestStart` (7:00) clockwise and never past `nestEnd` (2:30); what does not fit starts the next ring out. "Grow from" (snap) does the same for any arc.
- Preset numbers: 67 px buttons, 12 px gap (79 px pitch); 210 × 150 ellipse whose 9-to-3 half is 569 px of curve, so it holds 8; centre 60 px above the piece. Measured clear of 3–6 for every registry kind (GM and player), every state and every moment of the slide; the closed row clears the pawn's box at camera distance 90 and 40. The overlap warning is now round-button exact (it flagged diagonal neighbours before).
- Still open: whether Harry likes the look (a vision read called the junction "two arcs" at a 22 px group gap; the preset went to 16, and 0 is one knob away), labels in "over / under" mode only fade in after a slide (they do not ride along), edge rules other than slide bend the path, and the real game ring is untouched until he picks.

**2026-10-20, also in Ring Lab:** the slide survives a redraw mid-slide (and plays on the compositor); the drawer is in plain words (main / extra buttons, More, menu shut / open / sub-menu, clock times) with Undo / Redo / Revert / ↺ and only 14 knobs when One curve is on; and **Size in the world**: the ring is one shape sized in feet at the piece (default 6 ft buttons = today's 68 px at the default view), growing with the piece's base, held between 40 and 110 px buttons, facing the camera and drawn over walls, never screen-fitted. Open: Harry's feel for the band and the growth exponent on the lab's Huge, Gargantuan and 80 ft pieces; his tune-alpha's open menu grazes a pawn's base by ~4 px. docs/STATUS.md 2026-10-20.

**2026-10-20, the cut-over: Ring Lab's ring is THE game ring** (Harry: "I think rev4 settings I sent you are ready to use in the game"). House ring = his "Revised 4". Built: one oval, world size, head centre, the slide, every list as a grown ring (Conditions, Indicators, Walls, Roofs, Storeys, Replace, Faction, Send to area), fog height as a drag track, the 3–6 sector guarded in the layout (his Revised 4 runs long object rows and sub-menus toward 3:46; the layout turns or steps them out rather than enter it). docs/UI.md "The ring, as built 2026-10-20" is the description; the parity audit is `tests/data/ring-parity-audit.json`.
**Still open:** room anchoring (the room's name label or its centre: centre for now); Damage A (slashed heart) vs B (burst shield) if Harry has not picked (the house ring shows alternate 0); the Advanced group's clarity ("confusing and overwhelming, but for now I will just ignore it"); a long Replace list makes several rings (no paging yet).

The liked icon language and menu-content cuts can be discussed independently of the geometry. First ask what changed in Harry's taste after the pause; do not present the last picture as settled. Still open: Damage A versus B, room primary slot, roofs, nested-arc density and spacing, dismissal behavior, animation, small-screen/edge handling and real-size icon recognition.

## See also

- [Game UI working decisions](../../UI.md) — older implementation history; this record supersedes specified design intentions, not live code.
- [Pawn behavior](../../PAWNS.md) — underlying movement, character-sheet and travel contracts.
- [House-style references](../../../style-references/README.md) — D and its independent provenance.
- [Project lab notes](../../../LAB_NOTES.md) — chronological entry for this archival pass.
