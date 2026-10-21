# Faction batch — Task C, 2026-10-13

Worktree `3d-vtt-codex-c`, source branch `codex-c`. Three independent live milestones: (1) four existing-faction corbels and replacement sun idol; (2) nine additional factions, each with idol/corbel/altarpiece plus banner/relief/sigil; (3) thirteen picker emblems. **All three milestones verified live.** See `RESULTS.md` for version stamps and final acceptance. Original plates use built-in OpenAI image generation, text prompts only, no reference images. Exact prompts and image hashes are recorded in `assets.json`, `prompts/`, `plate-qa/`, and `icons/qa/`. Source images remain on disk as ignored binaries, as in previous batches.

The original corbel target is 24×24×30 inches (the final spider is scaled to 36 inches largest dimension): larger than the old unreadable 18-inch stone corbels, comparable to the 30×36-inch timber bracket. Flat backs mount on walls, fronts face local +Z, tops meet the 9-ft beam line. The four existing piers remain. Nine new factions deliberately omit their own sculpture/pier/censer: the first two slots stay empty; the censer slot reuses the neutral hanging censer at a ceiling mount. Factions are distinguished by motif and palette; no named deity or published creature design is used. `dragons` is the existing code ID for the plain one-headed dragon motif.

## Records

- `integration/FACTION_DATA.md`: data contract for Task B.
- `integration/README.md`: runtime, orientation, browser captures, landing and verification procedure.
- `gate-manifest.json`, `plate-qa/`: semantic 110px and alpha gates, including measured overrides.
- `step2/flat-qa/`: individual flat reads and provenance.
- `icons/qa/`: individual 31px blind reads; `contact-31.png`, `contact-128.png` set previews.
- `tools/`: single-pod lifecycle, deadman timers, waves, harvest, mesh QA.
- `spend.log`: cloud accounting and deletion evidence.
- `LAB_NOTES.md`: decisions and failure evidence.

The golden test compares two trees; it does not store rendered baseline images. Pre-asset integration passed 1,944 scenes across 145 room types unchanged. Step 1 records 70 exact intended scene changes in six Temple/Cult types; Steps 2 and 3 each have zero changes. Expanded faction availability must never change existing seeded building defaults.

## Plate-stage results (not mesh acceptance)

All five Step 1 plates accepted: sun/moon/devil/spider corbels read correctly at 110px; sun idol reads as a sun pedestal. Spider alpha gate's claimed clipped tip was disproved by a 56px bottom margin around the complete silhouette. All 13 emblem icons accepted in individual 31px blind reads. One icon generation connection failure succeeded on retry. All 32 mesh plates and all 27 new-faction flats are now accepted. All 32 meshes passed structural QA and were delivered. All nine added themes were identified in blind reads of the same nave; `step2/ROOM_QA.md` records the limitations. GPU runtime was 31m36s, approximately $0.94; the pod is deleted and independently verified absent.
