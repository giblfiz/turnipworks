# Nine faction naves — local runtime acceptance

All nine factions passed the unprimed room motif read. The same seed 11, 30x45-ft Temple nave, three views, 1920x1080 viewport and distance `1.5 * span + 18` were used. All rooms contained seven corbels and 43–44 placements, with zero browser errors, outside placements or reported floor overlaps. Captures and full blind descriptions are in `shots/step2-desktop/`; `nine-factions-contact.jpg` combines the nine table-sw views. Codex inspected the contact sheet and individual dragon/death views. This section preserves the local prelanding evidence; final live acceptance and the missing skull idol correction are recorded below.

| Faction | Unprimed identification | Strength / limitation |
|---|---|---|
| dragons | Red dragon temple/cult | Dragon idol, floor crest, plaques and carved heads all named. |
| skulls | Funerary/dark/necromantic skull chapel | Skull altar, floor and reliefs clear; bracket carvings alternatively read as gargoyles. |
| tentacles | Purple tentacled/cephalopod cult temple | Coiling tentacles and purple palette strong. |
| nature | Forest/nature temple, Green Man | Foliate face, leafy idol and antlers distinguish it. |
| sword-shield | Knightly/paladin/martial chapel | Blue shield and upright silver sword named on floor and sculpture. |
| death | Somber raven/death-associated chapel | Raven and hourglass named; distinct from skulls. The gentle funerary tone is an inference from the somber iconography, not proof of moral alignment. |
| scales-coin | Justice/law/truth temple or judgment hall | Balance scales named across sculpture, floor and green plaques; coin detail not specifically identified. |
| forge-hammer | Smithing/craft/forge shrine | Anvil and upright hammer, floor tools and wall plaques named. |
| sea-storm | Sea/water temple | Wave sculpture, trident and cyan palette clear. Corbel function ambiguous as font/brazier/lamp, but aquatic motif clear. No actual lights or water basins were added. |

No source mesh or texture was rejected or repaired after this pass; a missing skull idol placement was repaired before final live acceptance below. Small altar vessels and corbel details are sometimes unresolved, as expected at table scale. The judge repeatedly noted existing modular wall gaps, mixed pew lengths and editor overlays; these are common across all nine rooms, not newly introduced faction geometry. Full source-mesh and plate gates remain separate evidence.

The capture helper's undrained HTTP log PIPE filled after five rooms. The owned helper was stopped; the remaining four were captured with server stdout/stderr redirected to `/tmp/tw-step2-http.log`. No plate or asset was changed. Runtime altarpiece SKU prefixes were subsequently corrected from historical source `flavor-altar-piece` to canonical `flavor-altarpiece`; integration confirmed mesh/texture bytes unchanged, so visual evidence remains applicable. Captured layout JSON retains the original runtime names as provenance.

## Live acceptance after idol placement repair

Final public tuner `20261013081733` was captured at `https://implausible.enterprises/projects/turnip-works/tuner/` with exactly the same seed, dimensions, viewport and cameras. All nine live naves contained **one faction idol, seven corbels and 44 placements**; all had zero browser errors, outside placements and reported floor overlaps. The complete stills, layout/image hashes and `live-summary.json` are in `shots/step2-live-desktop/`, including the final `nine-factions-contact.jpg`.

The first local skull nave had **no idol** (43 placements). Its first blind pass therefore established the room motif only, not complete slot placement. Integration subsequently added a measured chancel placement fallback for broad idols. The final live skull nave has its idol, and its fresh unprimed read explicitly identifies the skeletal statue, skull altar relic, floor emblem, plaques and corbels. Codex inspected the final skull view and accepted the composition. This supersedes the incomplete local skull composition; the original evidence remains unchanged.

The other eight compositions already contained idols. No additional vision calls were needed: all 27 delivered runtime GLBs matched the accepted local files byte-for-byte on both public aliases, recorded by pipeline in `integration/live-step2-runtime-hashes.json`. The new skull blind description is retained at `shots/step2-live-desktop/skulls-nave-blind.txt`. No new source meshes or textures were made for this placement repair.
