# Packs lane, 2026-11-07: rebuild the CC BY asset packs, stage a new draft release, deep-link them from /assets

Harry: "On the assets page, can you also deeplink to the release packs we host on GitHub? Also let's update everything when
we finish the current builds." Branch `packs` off main 04460e41.

- 21:08 Read the 10-22 builder (tools/asset-packs/build_packs.py): its 30 packs were cut by catalog domain (furniture,
  lighting ...), which the assets page does not have, so a page card could never link "its" zip. DECISION: the packs ARE the
  page's (engine/tools/site_assets_data.mjs, run in Node): 23 prop packs (18 Build-menu types, the Modern genre as one pack,
  Walls doors & floors, Faction pieces) + Figures. A thing in several packs goes in each (tavern and cellar both get the
  barrel). Open twins (`open_of`) ride with their shut thing; the 16 objects the page lists nowhere (rated-out crown,
  forklift, roofing pictures, the secret door) go to the pack holding most of their batch. Every sku of a thing ships; the
  ones the game keeps out of rooms in models/extras/ (as 10-22). Titles and READMEs are the page's label and sentence
  (docs/site/assets-packs.json; the Modern sentence loses its third-party-mark clause in the zips).
- Figures: 2.2 GB of HD is over GitHub's 2 GiB a file, so one game zip (the page's Figures pack) + one HD zip per group
  (8 groups now: runner, modern, robot are new). Flyers' airborne poses ship as `<id>--flying.glb` (same transform rule with
  the fly row's own k/c/yaw).
- Provenance survey (an Explore agent over experiments/*): most new batches are Codex plates -> own TRELLIS.2 or fal.
  NOT cleared by docs/LICENSING_AUDIT.md section 4, so HELD (build_packs.py HOLD): modhalls-01 (15: 10 Gemini plates via
  agy-run, which the audit records as never generating pixels and whose terms bar third-party tools; 5 SDXL 1.0 plates,
  not in the audit), the 7 Qwen-Image-Edit dinosaurs (Apache-2.0, not in the audit), foe-eye-tyrant (beholder-like design:
  Harry's call). meshy-01 (3, paid Pro plan) is cleared at 88% and ships. The live assets page still offers per-asset GLB
  downloads of the held modhalls props "under CC BY" (not this lane's to change: flagged).
- roof-chiwen carries an empty `turn` node with a rotation and NO children (the culture-roofs lab note says it was turned
  by a root node; the node turns nothing). Bounds are the library's, so the game and the packs agree. mesh_bounds now
  applies node transforms when there are any (scene_bounds) instead of asserting.
- 21:23 Build, 8 processes: 55 zips, 15.1 GB (game 2.48 GB, HD 12.62 GB), largest 1.09 GiB (tavern HD), ~6 min.
  /mnt/usb/turnip-works/asset-packs/assets-2026-11-07/ (+ packs.json, SHA256SUMS, RELEASE_NOTES.md).
- Site: docs/site/asset-release.json (build_packs.py --site-json; published: false) -> site_assets.release(): links only
  when published. Cards get a Game / HD row with sizes (the figures card: "HD, 8 zips" to its view), pack views get
  download buttons, a figure group's view its own HD zip, one "All packs on GitHub" line above the cards, zips in JSON-LD.
  build_site.py --assets-preview DIR draws the page as if published (stills, the browser test).
- Tests: engine/test/asset_release_test.py 16/16 (fails on old code: no release file / no site_assets.release); flipping
  the flag while the release is a draft FAILS the gate (checked by hand, flag restored). assets_page.test 22/22 (new check:
  every figure is on the page; old code: 53 missing). browser_assets DL 29/29 incl. 390 px. WEIGHT (58 pictures > 40) fails
  on unchanged code too: predates this lane. tools/run_all_tests.py --list fails on main already (37 unclassified suites).
- Draft release 438053442 `assets-2026-11-07` created (no tag: GitHub makes it on publish). upload.py: retries, deletes
  and re-sends a broken asset of the same name on that draft only, verifies size + GitHub's sha256 digest.
- 21:50 VERIFIED. verify_pack.mjs over all 55 zips (verify_all.sh): 19,174 GLBs, validator 0 errors 0 warnings, three.js
  parsed 19,174/19,174, 20,724 textures decoded, 2,126 images decoded, size claims worst 0.034% (an egg), 0 bad.
  Blender 5.0.1 sample (blender_check.py): 36 GLBs across 16 zips (modern incl. Meshy shelving/rack and vehicles, regional,
  faction, kit, culture/cyber figures, flying poses), 36/36 imported textured, size error 0%. Gemini blind read of the
  36-render sheet: 36/36 textured; "defects" were a half-timber wall's white infill (by design) and a hay bale on its side.
- Upload (upload.py): 57/57 assets (55 zips + SHA256SUMS + packs.json) match size and GitHub's sha256 digest, no retries
  needed, ~18 min. asset_release_test.py --remote 19/19.
- Page stills: /mnt/usb/turnip-works/lanes-2026-11-07/packs/stills/ (contact-sheet.png). Gemini blind reads 7 -> 8 -> 6 ->
  9/10 as the download controls got a verb and arrow, and the figures' 8 HD zips went behind one disclosure button.
