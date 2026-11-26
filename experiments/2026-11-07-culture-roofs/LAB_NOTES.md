# Lab notes: culture roofs (lane culture-roofs, 2026-11-07)

Harry: "yes do roofs and such." Contract between the three workers: PLAN.md. ENGINE (this file), ASSETS (assets/LAB_NOTES.md),
SUCH (such/LAB_NOTES.md). Pictures: /mnt/usb/turnip-works/lanes-2026-11-07/culture-roofs/ (before/, wip*/, after/).

- 07:2x worktree linked (cultures-b tools/setup_links.py: 97,054 links + node_modules). Two agents launched (ASSETS, SUCH).
- BEFORE stills (engine/test/browser_cultureroofs.py --shots, a7b5c59e code): before/<culture>-34.png, -low.png, report.json.
  What the old code gave: Japan slate / shingle gables WITH European dormers, finials and attic windows; China slate gables with
  attic windows; Norse and Rus' wood shingle; every flat culture a bare parapet (no dome, no chhatri, no shikhara).
  (ind-haveli is an outdoor courtyard: no roof; the Indian pair is ind-durbar + ind-mandapa.)
- ENGINE: styles kawara/tongwa/glazed/sod/tes; FORMS (shape, pitch, overhang, bend, no European trim); IRIMOYA (three strips,
  per-strip planes in the height field); the BEND (bendAt + the same GLSL, per-copy aRoofBend); hip ridges; ornaments by style
  (ridge ends) and by room type (cupola, dome, malqaf, chhatris, shikhara), as keyed trim. First build: syntax slip (a dropped
  `roof.kind`) and a quote inside a single-quoted string in llm-card.js killed the relay: caught by the shots run, fixed.
- Sensitivity read (ASSETS, codex) changed the ENGINE side: Kyoto machiya and shop = kirizuma with deep, nearly straight eaves
  (irimoya + bend only for dojo and shrine hall); Beijing house = plain hard gable, no curl; glazed = green; no chigi/katsuogi;
  onigawara plain/cloud, no face; the cupola gets a plain cross. Forms split: jpn-house / jpn-hall (ROOF_FORM_BY_TYPE).
  This contradicts Harry's "hip-and-gable, the eave curve" for ordinary houses: default follows the read, Shape ▸ Hip-and-gable
  is one command away. Named as a question for Harry.
- 07:58 ASSETS landed the five sections (grid 10 base so the bend has vertices) + painted pictures + six gable bakes.
- Tests: cultureroofs.test.mjs 57/57 (fails on a7b5c59e: no IRIMOYA export); roofs.test 141/141; core 748/748; npm test green;
  browser_cultureroofs 57/57 (ornament meshes not yet in: stand-ins, printed, not asserted until in the library).
- Gemini QA (reads/qa1, qa2; wip2/wip3 near views): the "dark/red slits through the lowest course just above the eaves" are
  in the BEFORE pictures too (before2, every pitched roof): the outer half of a 12-in wall head stands through a roof seated on
  the grid line. Culture forms now carry `seat: 0.5` (the slopes meet the wall's outer face; gables widened to match);
  European roofs left alone (their tests assert the old seat). Dark gables over chn-brick / norse-stave read as "a missing
  gable, a void": the bakes are faithful, TRELLIS made those walls dark; ASSETS baked a reversible gain 1.6 into the two
  pictures (not flagged afterwards). Shots fixed: one culture per picture (200 ft apart), every DOM label hidden.
- BLIND CULTURE READ (reads/culture1.txt; before2 = a7b5c59e in a throwaway worktree, after1 = this branch; same buildings,
  cameras, no UI; judged from the roofline): Japan generic European 50 -> Japan late Edo 98 (kirizuma kawara, noshi ridge;
  the shrine irimoya); China generic European 50 -> Beijing Ming-mid Qing 99 (tongwa gable; glazed xieshan with chiwen);
  Norse generic 55 -> Viking turf 98; Rus' generic 65 -> Rus' 98 (tes, the church's cupola); Mamluk generic 65 -> Mamluk
  Cairo 98 (dome with oculi, malqaf); India Rajput 70 -> Rajput / Nagara 99 (chhatris, shikhara); Mexica 85 -> 85 (unchanged,
  as intended). "wrong notes: none" on all seven after pictures.
- Regressions: browser_gables 47/47, browser_roofs 61/61, browser_roofflat 57/57, browser_roofturn 54/54,
  browser_cultureroofs 65/65, roofs.test 141/141, cultureroofs.test 59/59, npm test green.
- Harry's "Regional" (2026-11-07, via Fauna): the Build-tray genre label Cultures -> Regional (key 'cultures' kept): 2c87419f.
- 10:54 close-view QA (reads/qa4.txt, after2/close-*; NOT in these notes until 16:20, the agent stopped here). Gemini, blind,
  close views (closer than table distance): ind-mandapa shikhara "shredded / torn, floating polygon shards" (the same mesh read
  SOUND alone, meshes-r1a, and the table-distance culture read gave India 99, no wrong notes); jpn-shrine irimoya on ONE end,
  plain gable on the other, hips bare (shingle has no hip piece); chn-temple hip caps mixed (cylindrical cap on one hip, the
  pierced crest on the others) and one shot with mismatched tiles front vs hips; jpn-house kirizuma: a curved timber board
  pokes past one gable rake, the other gable has no bargeboard. Open; not fixed in this lane.
- 16:10 TAKEOVER (a fresh session; the lane agent had stopped ~10:54 with 29 uncommitted changes). Committed the real work
  by name in five commits. NOT committed: the working tree's library.json / rooms.json / prep/flats.json / prep/jobs.json
  (ASSETS' runtime.sh ran build_data.py at 10:16, which DROPPED 64 objects + ~25 skus of the sprawl / cyberpunk packs: their
  source GLBs are in no checkout; jobs/flats lists carried this worktree's absolute paths). Rebased on main ffc1ea31: one
  conflict (2c87419f "Regional" vs modtypes' build_types.py: main's lines kept, it already says Regional; comment updated;
  types.json regenerated = main's). Data = main's + this lane's deltas: tools/merge_data.py (run AFTER build_data.py; refuses
  if anything of main's would change): 10 objects, 13 croof-01 skus, 2 slides flags, mes-ballcourt; flats-out.json + the
  centre line. setup_links.py re-run first (5,593 new links: faith-factions plates etc. had landed in main since 07:2x).
- npm test FAILED after the rebase (library-index.test: the six ornaments are unsorted kit pieces, new since they are in
  the library; the 07:xx "npm test green" predates their landing): they are KIT_THINGS now (by hand like the ridge/dormer).
- After the rebase: cultureroofs 59/59, roofs 141/141, core 748/748, npm test green (library-index 35/35), modern_buildings
  80/80, mod 95058/0, cyb 58176/0, ballcourt_i 57/0, cultures_b 82822/0, cultures 156456/0, sku_guard OK, assets_check 0
  missing; browser_cultureroofs 66/66, sliding_doors 14/14, stepwell_sunk 10/10, roofs 61/61, gables 47/47, roofflat 57/57,
  roofturn 54/54. faction-catalog.test 4/5 fails on unchanged main too ("forms is not defined": predates).
- assets/land-files.txt regenerated from the ignored files themselves: 394 (203 ship, 191 records), 136 MB.
- 16:27 after3 stills (post-rebase code, same shots) = after2 to the pixel (mean |diff| <= 0.06/255 per shot): the rebase
  changed nothing on screen, so the blind reads stand. Contact sheets on USB: contact-before-after-34-low.jpg,
  contact-before-after-near.jpg (before2 = a7b5c59e vs after3), contact-close-open-defects.jpg (qa4's close views).
