# Faction batch acceptance record

**All three steps verified live.** Source generation and local validation are distinct from deployment. The exact prompts, source hashes and gate decisions are in `gate-manifest.json`, `step2/source-provenance.json` and `icons/qa/`. Text-only native OpenAI image generation was used; no reference images, outside designs or named deities. Final public client acceptance is 67/67, with all thirteen installed emblem images loaded.

## Pieces and deliberate gaps

Step 1 makes four `flavor-corbel` meshes and replaces the sun idol. The old idol remains on disk; `integration/replacements.json` records the `was` relationship. Existing upright faction piers remain unchanged.

Each of the nine added factions gets idol, corbel and altarpiece meshes; banner, wall relief and floor sigil flats. Sculpture and pier are deliberately empty. The censer slot uses the existing neutral hanging bronze censer. No new light kind or water-holder was designed. IDs and groups: dragons, skulls, tentacles (sinister); nature, sword-shield (good); death, scales-coin, forge-hammer, sea-storm (neutral). Death uses a raven/hourglass, visually separate from the skull faction.

Step 3 has thirteen accepted emblems; individual unprimed reads at31px identified all thirteen. Still sheets are `icons/qa/contact-31.png` and `contact-128.png`. All thirteen are installed and verified live after the independent third landing.

## Room evidence

The first local four-faction naves were correctly identified as sun, lunar, demonic and spider temples. `shots/step1/` holds three views per room and the full blind responses. An isolated spider-corbel nave initially failed: the judge saw dark brackets in an ordinary chapel. Correct mounting and individual mesh acceptance were insufficient. A reproducible texture grade lightens the spider against its original purple slab; `integration/spider-grade.json` records exact source/output hashes and formula, and `models-ungraded/` retains the source. The grade, a 36-inch size trial, and a shortened-shelf geometry trial still failed the wide room read. The geometry trial was rejected. Final source keeps the clean original geometry, pale carving, and our own spider pictogram as a top inlay. At an ordinary Full HD desktop framing showing the entire room, the unprimed focused read identifies an eight-legged spider and a spider temple/cult chapel (`shots/step1-corbels-desktop/`). The wider 880-pixel canvas remains ambiguous; do not claim recognition there. The judge’s unsolicited published-lore association is not design provenance.

The final golden comparison found70 differences across temple-nave, cathedral, cathedral-dark, temple-shrine, cult-sanctum and cult-vault: corbel rows in the five large-room recipes and replacement sun idols (including the shrine). No other room type changed. Landing requires exact reviewed before/after scene hashes, not a blanket allowance. Steps 2 and 3 each passed with zero scene changes.

## Pipeline lessons

Three unbounded CPU pools initially created509 threads per worker against a27.2-CPU quota and stalled model loading. On the same pod, four-thread limits reduced each worker to14 threads and useful GPU work resumed. A later harvest briefly overwrote a graded source with the older remote original; the source-hash guard stopped runtime preparation. Harvest now preserves newer local processed files with `rsync --update`; the grade was reapplied and independently passed QA.

## Data contract

`data/factions.json` is `{version,slots,factions}`; entries carry `id,label,pieceLabel,aliases,group,emblem,available,slots,emptySlots,fallbacks`. `slots` maps canonical roles to SKU arrays. `library.json` embeds the same entries and `flavorSlots`. Emblem paths are tuner-relative. Automatic faction pools stay at the original four; new themes require explicit selection. See `integration/FACTION_DATA.md`.

## Step 1 live milestone

Tuner20261013074323, client20261013074354; maina787501. Both hosts:46,780 asset URLs checked,0missing; SKUguard and toolcoverageOK. Final golden70 exact scene hashes across six intended types,0unexpected. Temple342,561; Cult126,959; engine715core/200relay/5convergence. Four final naves identify their motifs; spider-only desktop view identifies eight-legged spider/cult chapel, wide880px view remains ambiguous. Final production source keeps original geometry plus grade and owned-emblem top inlay, not the rejected deformations.

## Step 2 live milestone

Tuner `20261013081733`, client `20261013081807`, main `3a85f34`. All 27 meshes and 27 flats accepted; 47,536 public asset URLs checked across both hosts, zero missing; all 59 batch assets have rater source plates. SKU guard and tool coverage OK. Canonical altarpiece SKU aliases preserve original source filenames and hashes. Golden: 1,944 scenes / 145 types, zero changes. Temple 342,888 / Cult 126,959 checks passed; all 324 combinations of nine new factions, six recipes and six seeds retain their idol. A measured uniform-fit fallback repairs otherwise absent broad idols without altering successful historical placements. The first skull nave motif read lacked its idol; final live capture and repeat blind read are separate evidence in `step2/ROOM_QA.md`. Local real-client acceptance: 66/66, all nine new factions accepted by the relay.

Stills and binary gate evidence are retained in the asset worktree at `experiments/2026-10-13-factions/`; relative still paths below resolve there. They are ignored binaries, not Git payloads.

## Step 3 and final acceptance

Tuner **20261013082634**, client **20261013082708**, deployment main **611caf1**. All thirteen emblems accepted and installed; their 256px lossless WebP files match downloaded public bytes on both hosts. Individual 31px blind reads identified every symbol. Step 3 golden: **1,944 scenes / 145 types, zero differences**. Public assets: **47,536 URLs checked, zero missing**, plus all thirteen emblem URLs independently decoded and hash-checked. SKU guard and `tool coverage OK` pass. Public client: **67/67 checks**, including all nine new faction commands accepted by the relay and all thirteen emblem images loaded; no page errors, throwaway campaign removed, house look and ratings unchanged.

Final live naves each have one idol, seven corbels and 44 placements, with no browser errors, outside placements or reported overlaps. The corrected skull composition received a fresh blind read identifying the skeletal statue and skull chapel. See `shots/step2-live-desktop/nine-factions-contact.jpg`, `step2/ROOM_QA.md`, and `shots/client-live/picker-delivered-emblems.png`. Start with spider corbels at desktop framing, then compare raven/hourglass death with skulls. The funerary theme's moral tone is an inference; the visual distinction is observed. Spider detail at a wider 880px view and sea-corbel bracket function remain the documented readability limits.

Totals: **32/32 meshes, 27/27 flats, 13/13 icons accepted**. No generated piece was discarded; experimental spider slab deformations were rejected for artifacts or ambiguous silhouette and were never shipped. The four original factions fill all nine slots. Each of the nine new factions has idol/corbel/altarpiece/banner/relief/sigil, neutral hanging-censer fallback, and deliberately no dedicated sculpture or pier. No other requested deliverable remains pending.

One RunPod, `tshhjp0b8tq73t`, ran 31m36s at $1.79/hour: **$0.94 estimated**, not an invoice allocation. Deleted and verified absent by API 404 and `runpodctl pod list`; deletion timer cancelled. All prompts, source hashes, aliases, gates, failed trials, measurements, live versions and spend evidence remain in this experiment.
