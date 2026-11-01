# 2026-10-27 roofs, scope 3: TEMPLE & GABLES (branch roofs-temple)

Brief: scratchpad roofs/COMMON.md (Harry 2026-10-27 "we probably need a marble roof to look like a temple ... those triangle
wedges ... too flat, and windowless"). Worktree <repo>

## Plan
- marble: Codex plate roofing-marble -> flats finish (seamless) -> roof-sections build (marble section, 22 deg pitch per style).
- gables: the family's own wall look BAKED from its generated wall-straight mesh (front elevation, exterior face, the body
  band between plinth and cap) -> data/roof/gable-wall--<family>.webp; verge trim (wood / stone / marble cornice) laid along
  the sloped edges; an opening per gable by rule (window / louvred vent / oculus / pediment tympanum), Codex plates, keyed.

## Log
2026-10-27T22:48:21-07:00 START worktree, symlinked ignored assets + node_modules. Codex plates queued (6 requests).
2026-10-27T23:01:51-07:00 code: planner (per-style pitch, gableEnds, verges, openings as keyed trim), buildRoof gable kit, world wiring; browser_gables 42/42 local. Plates all 6 in (Codex, $0).
- 23:0x Gemini r1/r2 (qa/r1, qa/r2-gemini.txt): shop "Half-timbered triangular wall matching the cream plaster and dark brown
  timber framing of the wall below ... louvered attic vent ... wooden bargeboard", blends true; hall "Grey stone brick masonry
  continuous in texture, color, and block pattern with the wall below ... circular oculus", blends true; temple "classical
  pediment / tympanum ... dentil moulding ... horizontal cornice", blends FALSE: "stark material/color disconnect from the
  golden-tan wall masonry". All three: black notches at the eave corners, broken corner columns.
- A/B against origin/main, same houses and camera (qa/ab1, ab1-gemini.txt): the eave-corner black notches, the broken corner
  columns and the dashed seam on the shop's lowest course are in BOTH (pre-existing, not this branch). B (this branch) reads
  better on all four views. Only in B: the pediment's flat cornice end at the corner, cream against golden stone.
- Fix: the tympanum plate is graded to its wall family's mean colour (gables.json `mean`). r3 re-read below.
- Suites: browser_gables 42/42, roofs 61/61, storeys 43/43, cut 142/142, build 98/98, npm test green, roofs.test 82/82.
- Spend: $0 (6 Codex image requests on the ChatGPT plan; Gemini on agy-run; no fal).
- r3 (qa/r3-gemini.txt), tympanum graded: temple "color-matched to the warm golden-tan stone of the walls below, reading as the
  same stone material with decorative bas-relief carving", reads_as_part TRUE (both stills). Left: the pre-existing eave-corner
  notches / corner columns (in origin/main too), and "the end of the horizontal cornice has a flat, exposed side profile".
- Rebased on main after roofs-controls landed (406f8b59): conflicts in roofs.js / world.js / height.js / llm-card / docs /
  roofs.test resolved keeping both; their setAxis now uses the style's pitch; core.test's temple-slate line updated.
2026-10-27T23:50:04-07:00 LANDED 23c4cc9e (candidate 20261027-234814-23c4cc9e, dev client 20261027234806); browser_gables on dev 47/47; test-only fix pushed after.
