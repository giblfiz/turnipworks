# Documentation draft — activate only after Step 2 is verified live

This is staged wording, not a claim of live delivery. Parent owns STATUS and the batch's final README; integration owns ROOMS. Do not remove queued asset rows until the Step 2 live check succeeds.

## Proposed ASSETS_TO_BUILD changes

Temple's current-made paragraph: describe the existing `flavor-buttress` meshes as upright piers, retaining the code role name. After Step 1 live, add four faction corbels and the replacement sun idol, with the old sun mesh retained as `was:` provenance. After Step 2 live, replace the queued `nature`, `sword-shield` row with: “Nature and sword & shield now have idol, corbel and altarpiece meshes plus banner, wall relief and floor sigil flats. They reuse the neutral censer; sculpture and pier are deliberately unfilled.”

Cult's current-made paragraph: describe the existing devils/spiders `flavor-buttress` pieces as upright piers. After Step 2 live, replace the queued `dragons`, `skulls`, `tentacles` row with: “Dragons, skulls and tentacles now have idol, corbel and altarpiece meshes plus banner, wall relief and floor sigil flats. They reuse the neutral censer; sculpture and pier are deliberately unfilled.” Keep the separate queued short-reach external buttress row: the accepted upright piers do not fill that geometry requirement. Keep unrelated ritual props and open/shut work queued.

After Step 2 live add a faction coverage paragraph: “The nine added factions are dragons, skulls, tentacles (sinister), nature, sword & shield (good), respectable death, scales & coin, forge & hammer, sea & storm (neutral). Each has three motif meshes and three flats. Optional sculpture and pier slots are deliberately empty; each reuses the existing neutral censer. These are explicit choices; existing seeded rooms retain their original faction pools.” Step 3 emblems are separate delivery and should be described only after their own verification.

## Factual plate-stage coverage for the final README

| Faction ID | Group | New meshes | New flats | Reused | Deliberately empty |
|---|---|---|---|---|---|
| dragons | sinister | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| skulls | sinister | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| tentacles | sinister | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| nature | good | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| sword-shield | good | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| death | neutral | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| scales-coin | neutral | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| forge-hammer | neutral | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |
| sea-storm | neutral | idol, corbel, altarpiece | banner, relief, sigil | neutral censer | sculpture, pier |

Plate counts: 54 generated and retained, 27 mesh sources and 27 flats; all 27 flats accepted by blind110 read plus contact-sheet review, zero image rerolls. Mesh outcomes and live checks are pipeline/integration evidence and must replace these plate-stage counts when reporting completed assets. Historical `flavor-altar-piece--...-fct` SKU spelling maps explicitly to canonical role `flavor-altarpiece`.

## Water and flame audit

No new censer, brazier, candle, flame-bearing object or light KIND was generated. Orange forge accents are painted trim, not a flame; no new `fireType()` branch or `aff:lit` is needed. Existing neutral censer reuse keeps its existing fire handling.

No generated asset is intended as a water-holder. Sea waves are opaque carved sculpture on a solid base, not liquid surfaces or vessels. Tentacle idol/altarpiece blind readers offered “basin/well/fountain” because of the raised rim; direct source-image inspection shows the interior occupied by connected stone/tentacle masses with no designed open water surface. They are sculptures on ornamental plinths, not functional fountains. Scale pans are weighing apparatus, not water vessels. No `bench:water` flag is called for by the plate designs. This is design/plate evidence; if final mesh QA shows an actual useful open basin cavity, revisit the flag before the manifest is finalized.
