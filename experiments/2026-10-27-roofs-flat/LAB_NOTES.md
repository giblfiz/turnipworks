# 2026-10-27 roofs, scope 2: FLAT & CASTLE (branch roofs-flat)

Brief: scratchpad roofs/COMMON.md + scope 2. Worktree <repo>

## Log
2026-10-27T22:46:51-07:00 START. Existing assets found: parapet-straight/corner (dressed-stone), wall-crenellated(+corner), city-wall-turret, roof-hatch(+open), roof-skylight, chimney-stack x4, banner-pole, weathervane. To generate: 5 flat textures (free Codex route), bartizan / cistern / flagpole meshes (fal).
2026-10-27T23:02:01-07:00 engine pass 1 committed (WIP): styles/edges/turrets/dice/offRoof/ROOF_THINGS; browser_roofflat 43/54 with assets pending
2026-10-28T22:14:38-07:00 Rebased on main after scope 1 (controls, trim touchable) and scope 3 (marble, gables) landed; conflicts in height/roofs/world/commands/main/menu/llm-card/tests/docs resolved keeping both. Turrets got trim keys (touchable). Gemini in game: castle "parapets and corner bartizans assemble cleanly into a convincing fortress roof" (chimney stub "birdhouse" -> man-high stack over flat roofs); surfaces: flagstone good, deck acceptable, lead/turf/plaster bad at 5 ft -> per-style ft (lead 10, turf/plaster 15) and turf edge = parapet; turf then acceptable; plaster v3b installed ("Good: sun-baked adobe terrace"); lead v1 kept (still "sheet metal": leftover). Roof objects on a deck: "all three props sit cleanly on the deck, proportioned nicely". fal: $0.90 (account now exhausted). Suites: roofflat 57/57, roofs 61, roofturn 54, gables 47, build 98, storeys 43, cut 142, npm green.
2026-10-28T22:19:17-07:00 LANDED dd2e17cc; candidate 20261028-221756-dd2e17cc; browser_roofflat on dev 57/57.
