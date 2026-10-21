# Ring icon inventory — 2026-10-15

Source audit before painting: `engine/client/commands.js`, `menu.js`, `surfaces/ring.js`, `surfaces/rulers.js`, `surfaces/areas.js`, `surfaces/pawns.js`, `surfaces/factions.js`, `registry.js`, `icons.js`, and `docs/UI.md`. Registry ids below are exact; synthetic nodes are explicitly marked. `light` is a semantic kind in this inventory: runtime `kindOf` classifies lightable objects as `openable`. Mixed selections show only jointly applicable actions. Disabled/stub commands are excluded.

## Sizes and ground

There are no fixed Small/Medium/Large presets. `RING_SCALE=1.2`; personal Ring size is a continuous 0.70–1.60 slider in steps of 0.05, default 1.00. `S=1.2*k`. Closed buttons are `56*S` CSS px; icon dimensions `round(26*S)` px. Expanded buttons are `64*S` px; their icons are CSS-overridden to `22*S` px. Default: **67.2 px closed button / 31 px icon; 76.8 px expanded button / 26.4 px icon**. At min/max: closed button 47.04/107.52 px, icon 22/50 px; expanded button 53.76/122.88 px, icon 18.48/42.24 px. Expanded ring may scale down to 0.6 when constrained by viewport; code clamps personal scale to 0.5–2 even though settings offers narrower values. Text size is independent. Deliver 31, 62 and 128 px at minimum; 128 source covers interpolation at continuous sizes. Ring ground is CSS `var(--surface-solid)` (**dark #1c1f24; light #fcfbf8**) with 2px border `var(--line-strong)` (`style.css` `.rbtn`); blind test uses the actual dark theme ground.

## Inventory

Round 1 inventoried 109 entries and merged them into 50 picture families; those historical sibling merges are superseded. Current round 2 inventory contains **113 entries**, with **90 picture families and 224 painting variants**. `picture` keys are artwork families, not invented registry IDs. Every co-visible sibling now has a dedicated picture: individual conditions and Clear, 18 wall choices, three storey counts, six roof choices, and distinct one-round/multiple-round timing controls. Generic parent badges remain parent-only. The tuner consumes manifest paintings directly, so existing game roof swatches do not exempt the painted roof choices.

Only non-sibling reuse remains: Re-roll across room/building/roof; Turn across object/pawn/room; matching roof material across separate roof/building menus; mutually exclusive measure/as modes and timer modes. Toggle future states remain variants of one command, never co-visible siblings. See `ROUND2_AUDIT.md` and `round2-arcs.json` for exact co-visibility and the dynamic destination-thumbnail limitation.

| Action id | Title | Kinds | Current icon | Surface | Picture family |
|---|---|---|---|---|---|
| edit.rotate | Turn | prop, openable, pawn | rotate-cw | ring | turn |
| edit.resize | Resize | prop, openable | scaling | ring | resize |
| edit.lift | Raise / lower | prop, openable, pawn | move-vertical | ring | lift |
| thing.open | Open / Close | openable | door-open / door-closed | ring | open |
| thing.pin | Pin / Unpin | prop, openable | pin / pin-off | ring | pin |
| thing.light | Light / Put out | light, openable | flame-kindling / flame | ring | light |
| thing.hide | Hide from players / Reveal to players | prop, openable, light, pawn, room, building | eye-off / eye | ring | hide |
| thing.lock | Lock / Unlock | prop, openable, light, room, building | lock / lock-open | ring | lock |
| thing.replace | Replace | prop, openable, light | replace | ring | replace |
| thing.rename | Rename / label | prop, openable, light, building | pencil | ring | rename |
| thing.tilt | Roll | prop, openable, light | rotate-cw-square | ring | roll |
| thing.upright | Stand upright | prop, openable, light | arrow-up | ring | upright |
| faction.set | Faction | room, building, faction-object | sun | ring | faction |
| pawn.sheet | Sheet | pawn | file-text | ring | sheet |
| pawn.damage | Damage | pawn | heart-crack | ring | damage |
| pawn.travel | Send to area | pawn | send | ring | travel |
| cast.saveGroup | Save as group | pawn-multiple | save | ring | save-group |
| room.reroll | Re-roll | room | dice-5 | ring | reroll |
| room.rotate | Turn 90° | room | rotate-cw | ring | turn |
| room.fog | Fog height | room | cloud-fog | ring | fog |
| room.height.taller | Taller | room | chevrons-up | ring | height-up |
| room.height.shorter | Shorter | room | chevrons-down | ring | height-down |
| roof.reroll | Re-roll | roof | dice-5 | ring | reroll |
| roof.hide | Hide roof | roof | eye-off | ring | hide |
| building.reroll | Re-roll building | building | dice-5 | ring | reroll |
| stair.flip | Stairs up / down | stairs, ladder, spiral | arrow-up / arrow-down | ring | stairs |
| pawn.give | Give control | pawn | user-plus | requested-off-ring | give |
| pawn.duplicate | Duplicate | pawn | copy | requested-off-ring | duplicate |
| edit.duplicate | Duplicate | prop, openable, room, building | copy | requested-off-ring | duplicate |
| menu | All options | all | menu | synthetic-ring-node | menu |
| ring.close | Close options | all | x | synthetic-ring-node | close |
| room.walls. | Walls | room | brick-wall | synthetic-ring-node | walls |
| pawn.cond. | Conditions | pawn | badge-alert | synthetic-ring-node | conditions |
| pawn.mark. | Indicators | pawn | star | synthetic-ring-node | indicators |
| roof.style. | Style | roof | house | synthetic-ring-node | roof-style |
| building.roof. | Roof style | building | house | synthetic-ring-node | roof-style |
| building.storeys. | Storeys | building | layers | synthetic-ring-node | storeys |
| room.height. | Height | room | chevrons-up | synthetic-ring-node | height-up |
| pawn.cond.blinded | Blinded | pawn | badge-alert | nested-command | pawn.cond.blinded |
| pawn.cond.charmed | Charmed | pawn | badge-alert | nested-command | pawn.cond.charmed |
| pawn.cond.frightened | Frightened | pawn | badge-alert | nested-command | pawn.cond.frightened |
| pawn.cond.grappled | Grappled | pawn | badge-alert | nested-command | pawn.cond.grappled |
| pawn.cond.invisible | Invisible | pawn | badge-alert | nested-command | pawn.cond.invisible |
| pawn.cond.poisoned | Poisoned | pawn | badge-alert | nested-command | pawn.cond.poisoned |
| pawn.cond.prone | Prone | pawn | badge-alert | nested-command | pawn.cond.prone |
| pawn.cond.restrained | Restrained | pawn | badge-alert | nested-command | pawn.cond.restrained |
| pawn.cond.stunned | Stunned | pawn | badge-alert | nested-command | pawn.cond.stunned |
| pawn.cond.unconscious | Unconscious | pawn | badge-alert | nested-command | pawn.cond.unconscious |
| pawn.mark.star | Star | pawn | star + existing markUrl image | nested-command | mark-star |
| pawn.mark.circle | Circle | pawn | star + existing markUrl image | nested-command | mark-circle |
| pawn.mark.diamond | Diamond | pawn | star + existing markUrl image | nested-command | mark-diamond |
| pawn.mark.triangle | Triangle | pawn | star + existing markUrl image | nested-command | mark-triangle |
| pawn.mark.moon | Moon | pawn | star + existing markUrl image | nested-command | mark-moon |
| pawn.mark.square | Square | pawn | star + existing markUrl image | nested-command | mark-square |
| pawn.mark.cross | Cross | pawn | star + existing markUrl image | nested-command | mark-cross |
| pawn.mark.skull | Skull | pawn | star + existing markUrl image | nested-command | mark-skull |
| pawn.mark.none | Clear indicator | pawn | x | nested-command | close |
| room.walls.auto | Walls: auto | room | brick-wall | nested-command | room.walls.auto |
| room.walls.rough-timber | Walls: rough timber | room | brick-wall | nested-command | room.walls.rough-timber |
| room.walls.log-cabin | Walls: log cabin | room | brick-wall | nested-command | room.walls.log-cabin |
| room.walls.half-timber | Walls: half timber | room | brick-wall | nested-command | room.walls.half-timber |
| room.walls.fieldstone | Walls: fieldstone | room | brick-wall | nested-command | room.walls.fieldstone |
| room.walls.dressed-stone | Walls: dressed stone | room | brick-wall | nested-command | room.walls.dressed-stone |
| room.walls.noble-interior | Walls: noble interior | room | brick-wall | nested-command | room.walls.noble-interior |
| room.walls.crypt-stone | Walls: crypt stone | room | brick-wall | nested-command | room.walls.crypt-stone |
| room.walls.castle-rough | Walls: castle rough | room | brick-wall | nested-command | room.walls.castle-rough |
| room.walls.noble-panel | Walls: noble panel | room | brick-wall | nested-command | room.walls.noble-panel |
| room.walls.noble-paper | Walls: noble paper | room | brick-wall | nested-command | room.walls.noble-paper |
| room.walls.conservatory | Walls: conservatory | room | brick-wall | nested-command | room.walls.conservatory |
| room.walls.temple-stone | Walls: temple stone | room | brick-wall | nested-command | room.walls.temple-stone |
| room.walls.cut-rock | Walls: cut rock | room | brick-wall | nested-command | room.walls.cut-rock |
| room.walls.tower-stone | Walls: tower stone | room | brick-wall | nested-command | room.walls.tower-stone |
| room.walls.mine-timbered | Walls: mine timbered | room | brick-wall | nested-command | room.walls.mine-timbered |
| room.walls.black-stone | Walls: black stone | room | brick-wall | nested-command | room.walls.black-stone |
| room.walls.wattle-daub | Walls: wattle daub | room | brick-wall | nested-command | room.walls.wattle-daub |
| roof.style.thatch | Roof: thatch | roof | house + material swatch (except auto/flat) | nested-command | roof-material-thatch |
| roof.style.tile | Roof: tile | roof | house + material swatch (except auto/flat) | nested-command | roof-material-tile |
| roof.style.slate | Roof: slate | roof | house + material swatch (except auto/flat) | nested-command | roof-material-slate |
| roof.style.shingle | Roof: shingle | roof | house + material swatch (except auto/flat) | nested-command | roof-material-shingle |
| roof.style.flat | Roof: flat | roof | house + material swatch (except auto/flat) | nested-command | roof.style.flat |
| roof.style.auto | Roof: auto | roof | house + material swatch (except auto/flat) | nested-command | roof.style.auto |
| building.roof.thatch | Roof: thatch | building | house + material swatch (except auto/flat) | nested-command | roof-material-thatch |
| building.roof.tile | Roof: tile | building | house + material swatch (except auto/flat) | nested-command | roof-material-tile |
| building.roof.slate | Roof: slate | building | house + material swatch (except auto/flat) | nested-command | roof-material-slate |
| building.roof.shingle | Roof: shingle | building | house + material swatch (except auto/flat) | nested-command | roof-material-shingle |
| building.roof.flat | Roof: flat | building | house + material swatch (except auto/flat) | nested-command | roof.style.flat |
| building.roof.auto | Roof: auto | building | house + material swatch (except auto/flat) | nested-command | roof.style.auto |
| building.storeys.1 | 1 storeys | building | layers | nested-command | building.storeys.1 |
| building.storeys.2 | 2 storeys | building | layers | nested-command | building.storeys.2 |
| building.storeys.3 | 3 storeys | building | layers | nested-command | building.storeys.3 |
| measure.start | Measure | measure, template | ruler | conditional | measure |
| measure.keep | Keep | measure, template | pin | conditional | keep |
| measure.keepRounds | Keep for rounds | measure, template | hourglass | conditional | rounds |
| measure.attach | Attach | measure, template | link | conditional | attach |
| measure.say | Say who is caught | measure, template | message-square | conditional | say |
| template.remove | Remove template | measure, template | trash-2 | conditional | remove |
| template.clear | Clear templates | measure, template | trash-2 | conditional | remove |
| measure.as.line | Line template | measure, template | tpl-line | conditional | shape-line |
| measure.shape.line | Line template | measure, template | tpl-line | conditional | shape-line |
| measure.as.cone | Cone template | measure, template | tpl-cone | conditional | shape-cone |
| measure.shape.cone | Cone template | measure, template | tpl-cone | conditional | shape-cone |
| measure.as.circle | Circle template | measure, template | circle | conditional | shape-circle |
| measure.shape.circle | Circle template | measure, template | circle | conditional | shape-circle |
| measure.as.sphere | Sphere template | measure, template | globe | conditional | shape-sphere |
| measure.shape.sphere | Sphere template | measure, template | globe | conditional | shape-sphere |
| measure.as.cube | Cube template | measure, template | box | conditional | shape-cube |
| measure.shape.cube | Cube template | measure, template | box | conditional | shape-cube |
| ruler.detach | Detach | template | link | synthetic-conditional | attach |
| ruler.norounds | No rounds / Keep | template | pin | synthetic-conditional | keep |
| ruler.keepfor.1 | Keep for one round | measure, template | hourglass | synthetic-conditional | ruler.keepfor.1 |
| ruler.keepfor.n | Keep for N rounds | measure, template | hourglass | synthetic-conditional | ruler.keepfor.n |
| ruler.rounds.1 | Lasts one round | measure, template | hourglass | synthetic-conditional | ruler.keepfor.1 |
| pawn.cond.clear | Clear all conditions | pawn | badge-alert | requested-off-ring | condition-clear |

## Faction children and existing imagery

Faction choices are arguments of `faction.set`, not separate registry actions. Reuse the proven existing emblem assets; do not regenerate them as speculative extras. `inherit` is a text choice (room inherits building; object inherits room); it is absent for buildings.

| Argument | Label | Existing emblem |
|---|---|---|
| `sun` | Sun | `assets/emblems/sun.webp` |
| `moon` | Moon | `assets/emblems/moon.webp` |
| `devils` | Devils | `assets/emblems/devils.webp` |
| `spiders` | Spiders | `assets/emblems/spiders.webp` |
| `dragons` | Dragon | `assets/emblems/dragons.webp` |
| `skulls` | Skulls & skeletons | `assets/emblems/skulls.webp` |
| `tentacles` | Tentacles | `assets/emblems/tentacles.webp` |
| `nature` | Nature | `assets/emblems/nature.webp` |
| `sword-shield` | Sword & shield | `assets/emblems/sword-shield.webp` |
| `death` | Respectable death | `assets/emblems/death.webp` |
| `scales-coin` | Scales & coin | `assets/emblems/scales-coin.webp` |
| `forge-hammer` | Forge & hammer | `assets/emblems/forge-hammer.webp` |
| `sea-storm` | Sea & storm | `assets/emblems/sea-storm.webp` |

## Surface boundaries

`menu` is the Ring Tuner runtime key for the unregistered ☰ control; `ring.close` remains a proposed delivery key for the close control. Exact game source hooks are `data-menu=1` and expanded state. The menu picture family remains `ring.menu`, so source/export filenames and blind-read evidence stay unchanged. Dot-suffixed group keys are real MENU prefixes but not runnable commands. `ruler.detach` / `ruler.norounds` likewise represent existing `data-act` controls, not registry commands. A future consumer must map these explicitly. Give control and Duplicate are included because Task J asks for alternate metaphors, despite being cut from the ring.

Excluded cut actions: Delete, room Replay spawn, Room type, Floor, Rename room, Add stair, Show roof; none is a current ring entry. Condition clear is a bar command without `menu:true`, not a Conditions child. Dynamic Replace options are asset previews, not commands, and dynamic Send-to-area choices are area labels. Ring icon changes must not replace those previews with invented actions.

## Runtime key correction — 2026-10-15

After integration with Task I, the synthetic ☰ action key changed from `ring.menu` to its actual tuner runtime ID `menu`. At that correction the inventory contained109 entries; round2 adds three explicit timing-control keys for112 total. The painting family is still `ring.menu`; no picture, prompt, source hash, filename, or blind read changed.

## Round 2 sibling audit

See [ROUND2_AUDIT.md](ROUND2_AUDIT.md) for exact co-visible arcs, existing swatch exemptions and the dynamic destination limitation. The112 entries comprise98 registered commands and14 explicit menu/strip keys. Dedicated art now covers the11 condition/Clear actions,18 wall choices,3 storey counts,2 roof fallbacks, and2 timing choices in both sets. Roof material swatches and faction emblems remain the documented runtime exceptions.
