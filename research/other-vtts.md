# Other VTTs: survey for a browser 3D VTT with a Dungeon Alchemist-style builder

Researched 2026-09-24. Sources are cited inline. **[UNVERIFIED]** marks claims I could not confirm from a primary page (fetch failed, marketing-only, or inferred).

---

## 1. TerrainTale — https://terraintale.com

Browser 3D VTT, three.js + React, self-hostable ("one Node process serves the app, the API and the sign-in gate"). Pitch: "Owlbear Rodeo's simplicity, in three dimensions." Very active (≈100 blog posts, several dated Sept 2026; https://terraintale.com/blog).

**Features**
- **Room kits**: Dungeon, Castle, Tavern, Crypt, Cave, Manor, Cottage. "Drag a rectangle: floor and walls, corners correct, one undo step."
- **Tile brush**: floors and walls snap to the grid and orient themselves; doorways, archways and windows replace a wall segment.
- **AI scene recipes**: an LLM writes a *recipe* of high-level intent ops ("fill this rectangle, wall this perimeter, scatter trees here"), and a deterministic builder turns it into geometry that tiles and meets at the corners ("How TerrainTale's scene recipes work, and why they're grid-correct"). Model not named. Full op list not public.
- **Assets**: 372 CC0 models (103 PBR surfaces from ambientCG, 226 photoscanned Poly Haven props, 30 D&D minis), all authored to the 5 ft grid. Premium: import .glb/.obj/.fbx/.stl (Draco/meshopt); .glb terrain import.
- **Lighting**: torches with real shadows, bloom on flames, a sun fitted to the map, per-time-of-day IBL.
- **Play**: "Press Play and the editor disappears": Move, Measure, grid toggle, top-down view, initiative. Ruler in feet with 5 / 5-10-5 / true diagonals, and **height counts** ("the archer on the wall is a climb away"). Token cards: HP, conditions, size, portrait; the acting mini glows and its movement resets. Standee tokens from images or 3D minis.
- **Multiplayer**: share by link; players sign in and ask to join, then drag their own minis.
- **In-person mode**: TV/projector top-down view.
- **Pricing**: free (1 saved scene); Premium $6/mo or $48/yr (200 scenes, custom model import).

**Distinctive idea**: the LLM emits *intent*, not geometry. Constrained recipe DSL, then a deterministic, grid-correct builder. The AI can't make a corner that doesn't meet.

**Weaknesses** (from their own compare page, https://terraintale.com/compare/arkenforge-alternative): **no fog of war ("not yet")**, no separate player display with hidden info, **no image battlemap import** (images only as tokens), no dice rolling or rules ("does not roll attacks or resolve rules"). Line of sight / per-player vision filtering: not mentioned, so presumably absent **[UNVERIFIED]**. Multi-level: "elevation" and walls with height, but no stacked-level system described **[UNVERIFIED]**.

---

## 2. Atlas VTT — github.com/kgsherman/atlas-vtt (live: https://atlas-vtt.vercel.app, returns HTTP 200)

Read from local clone: README.md, docs/SPEC.md, docs/ARCHITECTURE.md (incl. "Implementation status (2026-09-23)" appendix). Author commits as "Kevin" (61 of 72 commits, the rest by Claude); history starts 2026-09-22, so it was probably squashed or imported. TypeScript, three.js WebGL2, React + shadcn/Base UI, Supabase (Postgres RLS, Realtime, Storage), zustand + immer.

**Current feature set**
- **Editor**: stacked multi-level scenes (per-level elevation, storey height, slab thickness, ghosts of adjacent levels); 5 ft grid with snapping modes; floors, walls (height/thickness, can follow terrain), doors (open/closed/locked/secret, styles), windows, stairs/ramps/ladders between levels, pillars, **primitive** prop library (tables, crates, barrels, trees); terrain heightmap brush plus terrain *shapes* (add/carve footprints, loop cuts, edge/face selection); undo/redo, copy/paste, multi-select, box select; orbit / top / token-POV preview cameras; versioned JSON with version history, `.atlas.json` export/import, read-only share links.
- **Battlemap import**: one image per storey, grid calibration, auto-trace floor from transparency and walls from outline (tested with Forgotten Adventures maps).
- **Lighting and vision (the core)**: real-time shadows from every point light (octahedral distance atlas, one custom shader), sun/moon presets, flicker; **3D per-token LOS from eye height** (low wall blocks a halfling, not a giant; balcony sees down into courtyard); normal / darkvision (greyscale) / blindsight / blind; 3-state fog (visible / explored-static-only / unexplored); shared party vision; auto cutaway above the token's level.
- **Security model**: the DM's tab is the authoritative server; a vision Web Worker plus `filterForPlayer` means **players never receive what they can't perceive** (hidden tokens, secret doors, unexplored geometry, even map-image chunks are per-player behind RLS). Reconnect via patch log / snapshot; DM device handoff.
- **Play**: A* drag-to-move with a feet ruler following the diagonal rule; stairs/ladders; doors; measure tool; DM locks (global / per-player), speed enforcement, hide/reveal, reveal secret doors, assign tokens, reset fog, kick; live "Edit map" mid-session with "Save map to library" plus conflict check.
- **Table**: chat; dice with keep/drop/explode notation, **host-rolled with a crypto RNG (players send formulas, never results)**; whispers and GM rolls; initiative tracker (hidden or unseen combatants never sent to players); HP + temp HP + conditions with health bands for non-owned creatures; pings (Shift+hold recentres everyone).
- **Token Maker**: layered token art (background / art / frame, masks, "break out of frame"), AI background removal via an image model, applies to game tokens.
- **Free assets**: 3D miniature token models (meshopt GLB, 3 LODs) from STL sculpts.
- **Quality tiers** (low to ultra, SSAO, bloom, soft shadows) with a GPU auto-benchmark and adaptive quality; 60 fps target on iGPU is met at medium.
- **Accounts**: anonymous guest, optional Discord upgrade. Local mode (IndexedDB + BroadcastChannel) for dev.
- Heavily tested: 1367 vitest tests, Playwright e2e suites, SQL RLS tests.

**Gaps (feature absences confirmed by grep plus the docs' known-gaps list)**
- **No AoE / measured templates** (cone, sphere, line), no drawing/annotation tools for play (grep for templates finds only the Token Maker).
- **No handouts / journal / notes-to-players, no audio / playlists / ambience, no character sheets, no D&D Beyond or other system integration, no macros or scripting / plugin API.**
- **Props are primitives only**: no glTF prop or kit library, no themed wall/floor materials pipeline like Dungeon Alchemist's. Free-asset categories "maps and audio later" is the only stated roadmap item.
- Tokens cast no shadows (blob shadow only); token models carry no materials.
- Grid is square-only (5 ft); no hex (none in core/grid). No manual GM fog paint or reveal-area: DM fog commands are only `reset-fog` and `reveal-object`.
- Chromium-first; Safari untested, Firefox passes only a smoke test. No mobile/touch story mentioned.
- Operational: no CAPTCHA, an undeployed retention migration, per-IP anonymous sign-in as the only abuse bound.
- **No explicit public roadmap.** SPEC.md is the owner's original prompt-spec, now essentially fully implemented; the appendix lists polish gaps, not planned features.

**Distinctive idea**: true 3D geometry as the *single source of blocking truth* for shadows, LOS and fog, combined with a server-grade information-hiding model running in the DM's browser tab. Nobody else in this survey filters per player at the data layer this rigorously.

---

## 3. Foundry VTT 3D Canvas (theripper93) plus Levels / v14 Scene Levels

- **3D Canvas** (https://foundryvtt.com/packages/levels-3d-preview; wiki https://wiki.theripper93.com/levels-3d-preview, rate-limited at fetch time): turns a Foundry scene into true 3D; load glTF models, animated models; 2D tokens become standees; lighting; particles/weather; **cover calculation**; fog of war (default fully revealed in 3D; mirrors 2D fog when Token Vision + Fog Exploration are on; optional "use 3D models for visibility" so tiles block sight) (https://wiki.theripper93.com/levels-3d-preview/info/fow). v9.0.35, Foundry v11–14, updated in the last week.
- **Advanced Tools** (Patreon purchase; https://foundryvtt.com/packages/canvas3d-premium): Environment panel (sky/weather), **procedural terrain generator with themes**, **Effect Browser** (drag-drop hazards: acid, lava, magic signs), **Dungeons & Interiors** room/shape builder with themes, **Cutscenes** (camera transitions for reveals), Material Browser. Separate Mapmaking Pack (tiles, skyboxes, materials) and a Token Collection of 3D minis.
- **Levels module** (https://foundryvtt.com/packages/levels): multi-floor maps. **Retired: merged into core as v14 "Scene Levels"** (https://foundrymods.com/how-to/foundry-v14-levels). v14 stable shipped **2026-04-01** (https://foundryvtt.com/releases/14.359): named elevation bands with per-level visibility lists; walls tagged per level; lights by elevation; "Define Surface" regions block sight; stairs are Regions with a "Change Level" behaviour. v14 also replaced measured templates with **Template Regions** (templates with behaviours, attachable to tokens) and added Active Effects V2, pop-out windows and a particle engine.

**Distinctive ideas**: cutscene camera moves; drag-drop hazard effects; cover computed from 3D; *regions with behaviours* as a general-purpose "trigger volume" primitive (stairs, traps, templates all the same concept).

**Weaknesses**: steep learning curve, complex UI, heavy on resources, needs a Foundry licence ($50) plus hosting plus Patreon for the builder (Gnome Stew review, https://gnomestew.com/a-3d-vtt-roundup-and-review/). The 3D layer sits on a 2D engine, so vision is 2D-wall-derived unless the "3D models for sight" option is on. Module-stack fragility.

---

## 4. Tabula Sono — https://tabulasono.com

Icosa Studios; free browser 3D VTT; launched publicly 2022-08-01; Kickstarter; Steam page still "Coming soon" (https://store.steampowered.com/app/2123680). Features: draw/edit walls, lighting and colour themes, 2D map import (explicitly Dungeon Alchemist / DungeonDraft / Inkarnate), 1000+ free minis, custom STL/FBX/OBJ import (HeroForge, TitanCraft), players move/rotate assigned minis, hide/reveal objects and NPCs live, one-link invite. **Distinctive**: "whiteboard markers and miniatures": the physical-table metaphor, no codexes. **Weaknesses**: grid-only, thin rules layer, 2026 activity level unclear **[UNVERIFIED: no dated 2026 news found]**.

## 5. RollTable — https://rolltable.app

Free, no-account, browser 3D VTT: 2D maps plus 3D minis, several camera options; creator ex-Nintendo/Telltale. Gnome Stew (Dec 2022): easiest entry point, but limited customisation and server reliability issues. The site still serves (HTTP 200, 4 KB SPA shell) but **current feature set and activity are [UNVERIFIED]** (Patreon page returned no content). **Distinctive**: zero-friction "no account" join. **Weakness**: shallow.

## 6. Menyr — https://menyr.nogstudio.com (FAQ /faq/)

NOG Studio; Steam open beta (PC; Mac TBA); free, cosmetic and marketplace monetisation ("no feature locked behind a paywall"). Features: **procedural terrain up to 100 km²**, biome shifting, procedural settlements and dungeons, weather, lighting, measure tools, **AoE templates**, **event triggers and collisions**, **customisable game systems with automated rolls and character sheets**, Codex (world lore DB), model/map import/export, modding and marketplace, local single-screen and online play. **Distinctive**: open-world-scale procgen plus a lore codex; a game-engine VTT. **Weaknesses**: native app (not browser), perpetual beta since 2022 Kickstarter, character customisation "coming later".

## 7. RPG Stories — https://www.bravealice.com/rpgstoriesvtt

Brave Alice Games (London); Steam (https://store.steampowered.com/app/2105600). 7000+ 3D models across Fantasy/Modern/Sci-Fi; **auto-build "click and draw" brushes** plus manual edit; **export maps to other VTTs**, commercial export rights; online 3D play; Steam Workshop. Infinite Worlds expansion (Kickstarter funded in 3 h, ran to 2026-06-02; https://www.geeknative.com/235303/): web-based rulesets inside the app, **PDFs / quest notes / audio attached to map locations**, **proximity-triggered audio cues**, unlimited players on the Deluxe tier who join with the free demo, user-made auto-build brushes. **Distinctive**: *spatial* handouts and audio (content anchored to places, fired by proximity); "build here, play anywhere" export. **Weaknesses**: native app, paid tiers, fog/vision details not documented **[UNVERIFIED]**.

## 8. (Context) TaleSpire

Tile-block 3D builder, $25 per seat, native app. Line of sight hides minis; **fog of war still experimental / back to the drawing board** (https://talespire.com/faq, dev logs). Symbiotes = mod system for character sheets. Proof that even a well-funded 3D VTT struggles with fog in true 3D.

---

## 9. Table stakes from the 2D leaders (Foundry, Owlbear Rodeo 2, Roll20, D&D Beyond Maps)

- **Owlbear Rodeo 2**: minimal core plus an extensions marketplace. Dynamic Fog (walls, doors, lights with soft falloff and soft shadows via sourceRadius; https://docs.owlbear.rodeo/extensions/reference/dynamic-fog/); 2.3 "Warp Core" renderer; **2.4 (2026-05-23) "Forecast": computer-vision auto-detection of rooms to fog a battlemap in one click**, plus Slice / Fit / Overlay / Trim / Join fog ops and shape snapping; WebP "Storage Saver" (https://blog.owlbear.rodeo/owlbear-rodeo-2-4-release-notes/). Everything else (initiative, sheets, dice) is extensions.
- **Roll20**: Dynamic Lighting (UDL replacing legacy; https://help.roll20.net/hc/en-us/articles/360044771413), sheets for many systems, compendium, jukebox, handouts, macros/API (Pro). Acquired Demiplane in June 2024 (a sheets/content platform).
- **Foundry**: the power-user baseline: walls/doors/lights/vision modes, fog exploration, tokens with bars and conditions (Active Effects), combat tracker, measured templates (now Template Regions), dice, journals/handouts, playlists/ambient sound, per-document ownership permissions, system-specific sheets, macros, module API, v14 Scene Levels.
- **D&D Beyond Maps** (official): 2026 shipped copy-paste, **polygonal fog of war**, monster reveals, stickers; 2026 plans are DM prep (session notes, embedded rules/lore, rollable tables) (https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap). Motto: "Honda Accord, not F-16." Its killer feature is native access to DDB character sheets and content.
- **D&D Beyond integration elsewhere**: no official third-party API. The de-facto route is the **Beyond20** browser extension (sends DDB sheet rolls to Roll20/Foundry/Discord; https://github.com/kakaroto/Beyond20) and Foundry's DDB-Importer module (character/monster import) **[DDB-Importer not re-verified this session]**.

---

## 10. Merged checklist

### Table stakes (must-have to be taken seriously)
| # | Item | Atlas today |
|---|---|---|
| 1 | Maps: image battlemap import + grid calibration (square; hex expected by many systems) | yes (square only) |
| 2 | Walls/doors/windows → dynamic lighting + per-token vision (darkvision etc.) | yes, best-in-class |
| 3 | Fog of war: explored memory + **manual GM fog/reveal** (paint/polygon) | auto only; **no manual fog paint/reveal-area** (DM commands are only reset-fog + reveal-object; verified in reduceDm.ts) |
| 4 | GM-only layer / hidden tokens & objects; GM notes | yes (hidden tokens, secret doors, DM notes) |
| 5 | Tokens: sizes, rotation, art, HP bars, conditions, ownership/assignment | yes |
| 6 | Initiative / combat tracker | yes |
| 7 | Ruler **and AoE templates** (cone, sphere/circle, cube, line) | ruler yes; **templates missing** |
| 8 | Dice roller with notation, secret GM rolls, roll log/chat | yes (crypto, host-rolled) |
| 9 | Handouts / journal (image + text shared to selected players) | **missing** |
| 10 | Audio: playlists/ambience controlled by GM | **missing** |
| 11 | Player permissions (who controls/sees what) | yes |
| 12 | Character sheets (at minimum a generic sheet + 5e) or an integration path | **missing** |
| 13 | D&D Beyond bridge (Beyond20-compatible roll intake, or import) | **missing** |
| 14 | Drawing/annotation, pings | pings yes; drawing **missing** |
| 15 | Easy join (link/code, no install), reconnection, persistence | yes |
| 16 | Scene library / multiple scenes & switching | yes (library + versions) |

### Differentiators (where a 3D VTT wins)
- **Kit-based 3D builder** (DA-style): drag a room, auto-walls, themed kits, prop scatter (TerrainTale room kits; RPG Stories auto-build brushes; 3D Canvas Dungeons & Interiors).
- **LLM → constrained recipe DSL → deterministic builder** (TerrainTale).
- **One-click fog/room detection from an image** (Owlbear Forecast); Atlas's trace-walls-from-transparency is a cousin.
- **True 3D LOS with eye height, balconies, multi-level cutaway** (Atlas; Foundry v14 approximates it in 2.5D bands).
- **Server-grade per-player data filtering** (Atlas).
- **Regions with behaviours / triggers**: stairs, traps, templates, proximity audio as one primitive (Foundry v14 regions; Menyr triggers; RPG Stories proximity audio and location-anchored PDFs).
- **Cinematic tools**: cutscene camera paths, drag-drop hazard VFX, weather/time-of-day (3D Canvas; TerrainTale IBL per time of day).
- **Cover and height-aware measurement** (3D Canvas cover; TerrainTale height in the ruler).
- **Procgen at world scale + lore codex** (Menyr).
- **Export to other VTTs** (RPG Stories; UVTT/DD2VTT format is the lingua franca Dungeon Alchemist uses).
- **In-person TV/projector mode** (TerrainTale).
- **3D minis pipeline** (STL → GLB; TerrainTale imports; Atlas's STL to LOD'd GLB pipeline; Tabula Sono HeroForge support).
