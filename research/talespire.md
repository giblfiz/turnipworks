# TaleSpire (Bouncyrock) — Feature Inventory from Release History

Research date: 2026-09-24. Purpose: treat a competitor's release notes as a spec of what users need, for a browser-based 3D VTT.

## Method and sources

- **Primary corpus**: the complete Steam announcement feed for app 720620, pulled from the Steam News API (`ISteamNews/GetNewsForApp`, feed `steam_community_announcements`). That's 361 posts, running 2020-04-17 (closed beta) to 2026-09-18. Bouncyrock cross-posts its patch notes to Steam, so this covers essentially all of bouncyrock.com/news/patch-notes. I read every feature post in full. I skipped most content-pack and asset-drop posts (asset lists only), and skimmed the bugfix posts.
- **Citation format**: `S:<gid>` = `https://store.steampowered.com/news/app/720620/view/<gid>`.
- **Community signal**: Steam reviews API. The overall score is **Very Positive: 4,725 positive / 518 negative (~90%)**. I read all 44 English negative reviews the API returned, plus the top 30 positive ones. I also read Steam discussions, one blog post by a GM who switched to Foundry, and the official FAQ.
- **Not reachable**: feedback.talespire.com (Canny-style boards: 818 feature requests, 546 bugs, 372 asset requests) renders vote counts client-side, so I couldn't read them. talespire.com/roadmap is also JS-rendered. Roadmap items quoted below come from search snippets of `feedback.talespire.com/roadmap/*` and the FAQ. **Treat roadmap status as UNVERIFIED.**
- **Status as of Sept 2026: still Early Access.** There has been no v1.0. The April 2026 patch says "one more very necessary step on the journey to v1" (S:1830163047254317).

Importance key: **H** = headline feature, **R** = heavily requested (the devs say so, or feedback-board-driven), **P** = repeatedly patched (sign of a hard or central system), **m** = minor.

---

## 1. Feature inventory

### Building (tiles, props, slabs, copy/paste, hide volumes)
| Feature | Intro | Signal | Source |
|---|---|---|---|
| Tile building on a grid; drag out a volume to fill it with tiles/walls ("drag-create"); multiplayer co-building by all GMs with shared undo/redo | closed beta 2020 (pre-dates feed) | H, P (many 2020 fixes for "un-deleted tiles", multi-GM delete corruption) | S:3127131079127683748 |
| **Slabs** = copy a selection, which becomes a compact text string on the OS clipboard, then paste it anywhere (Discord, websites). The core sharing primitive | beta 2020 | H, P (paste-alignment bugs 2020; slab-positioning fix beta May 2025) | S:3110243214551295905, S:1799088287960949 |
| "Hourglass" indicator while a slab is not yet ready to paste | 2020-05 | m | S:3127131079140254296 |
| **Chimera rewrite** (moved off Unity GameObjects to a custom render/physics path). Brought the Asset Library, new placement tools, and the **prop system with free placement** (a density limit caps props per area; 15° rotation steps for props, 90° for tiles) | 2021-03-31 | H | S:4023377846272441883, S:5422856308611327810 |
| Grid-height sampling (H key / right+left click) to build at an existing height | 2021-04 | m | S:4023377846282771504 |
| Build light (K), a separate light for building in the dark | 2021-04 | m | same |
| Convert any prop into a creature (animate objects, mimics) | 2021-06-22 | m/fun | S:4056035920073707943 |
| Hide volumes: GM-drawn boxes that hide their contents from players. Filters (props&tiles / creatures / lights) added Dec 2021. Keybinds and delete key Aug 2025. Volumes respond to the hide plane and camera proximity Jun 2026 | EA 2021 | H, P (devs admit: "rushed before early-access, and you can definitely feel it") | S:5320438099051906868, S:1806698490844934, S:1835871199304674 |
| **Hide plane / "green diamond"**: a horizontal cut plane that slices away everything above it so you can see inside buildings. It auto-follows the held mini, can be locked, and was improved heuristically in Sep 2024 | beta 2020 | H, P | S:6242640076615140670 |
| **Vertical bar**: the diamonds on one slider control camera height, the hide plane, water level and fog. Right-click a diamond to type an exact value; the GM sets the board's height range | 2022-12-15 | H (the core 3D-navigation affordance) | S:5623338145751732025 |
| Water: first a single board-wide water plane (Oct 2020); then water tiles / "resin blocks" (Nov 2022), described as "highly requested… far from a perfect solution" | 2020-10 / 2022-11 | R, P | S:3895010671345323392, S:6368680725422628867 |
| Attachment points: hold X to snap props (chains, ropes, sails) to each other | 2023-04-17 | m | S:6539831519501516874 |
| Builder presence: GMs see where the other GMs are building | 2024-06-27 | m (collab polish) | S:5842939267310057867 |
| Double doors for every single door; doors built facing their opening direction | 2025-07-29 | m | S:1806064758779243 |
| Live fuzzy search of the asset library (by name, including mod content) plus multi-tag suggestions; creature re-tag; community tags | 2026-04 to 07 | R, P (search called "rough" in 2024) | S:1828894815566957, S:1835236783557986, S:1838407329265297 |
| **Terrain system** (heightmap terrain, rivers/lakes) | promised since Kickstarter; deferred Oct 2020; still "planned" | R (UNVERIFIED current status) | S:5422856308611327810 |
| Asset content: ~40+ content packs (fantasy, then a Cyberpunk/Sci-fi drop of ~660 assets in Aug 2022, then Interstellar, Fortified Castle, and more), shipped free | continuous | H (content cadence is the retention engine) | S:4598757090466424574 |

### Creatures / minis
| Feature | Intro | Signal | Source |
|---|---|---|---|
| Pick-up-and-carry minis with physics "feel": screen-shake for large creatures, drop indicator, Alt to rotate, double-click to jump the camera to the base | beta 2020-06 | H | S:3157533548737603510 |
| Creature scaling via radial menu. "Titan sizes" (much larger options) Apr 2025 | 2020-06 / 2025-04 | P | S:1796551539179907 |
| Flying: the GM toggles flying; the player holds Ctrl while carrying to set height; an indicator tower shows elevation | 2020-09-07 | H (3D-native) | S:3819571008270831540 |
| Creature stats: HP plus 4 renamable stats, expanded to 8 in Jul 2021. Stat names exportable/shareable as a string | 2020-07 / 2021-07 / 2022-01 | P | S:3444639924519324942, S:4224939931833168127 |
| Creature copy/paste yields a shareable URL (name, colors, stats, HP, scale) | 2022-01-14 | m | S:4224939931833168127 |
| Unique creatures (persist across boards, teleport between boards) vs non-unique (cap 600/board) | EA 2021 | P | S:4072920612498270067 |
| Colored bases | 2021-09-02 | m | S:4020014099088801176 |
| Persistent emote "Knockdown" (2021), then the full **Status Effects** system (Poisoned, Frozen, Burning, Bloodied, Sleep, and more; stacking visual effects plus base icons) | 2021-08 / 2026-07-12 | R ("requested since we went into Early Access") | S:4022264629329780558, S:1837955055361813 |
| **HeroForge integration**: link your account and purchased digital minis appear in-game, auto-downloaded for all players. Beta Apr 2022, official Oct 2022 | announced 2021-09 | H, R ("overwhelming requests") | S:4348797798090809764, S:4714731755412629775 |
| Polymorph: multiple models per creature, switch at will | 2022-08-12 | m/R | S:4607764924155231611 |
| Group movement: lasso up to 50 creatures, then move/rotate/attack/emote as a group | 2022-12-07 | R | S:4980448574105412960 |
| **Creature modding**: TaleWeaverLite (a Unity plugin) packages mesh plus textures into .tsMod files, hosted on mod.io. Missing content auto-downloads for every player in 3 clicks. 1,000+ creatures within weeks | beta 2024-02, live 2024-03-06 | H | S:5679673637649383681, S:5686430301722994813 |
| Content flags and filters (AI-made, unpainted, 2D standee; "strict" mode) | 2025-07-22 | R (content-policy demand) | S:1805431065493875 |
| TitanCraft integration (free mini builder) | 2025-12-01 | H (partner) | S:1817483467046383 |
| TaleWeaverCmd: CLI that turns obj+png+json into a TS mini (TitanCraft uses it) | 2026-08-13 | m (pipeline) | S:1840944183776419 |
| Emissive channel for community minis | 2026-08-05 | m | S:1840310314338974 |
| Portrait click focuses the camera on a player's creature; shift-click a portrait to teleport it | 2021-06 / 2025-08 | m | S:1808061939467834 |
| **In-game character/creature creator** (build from parts, no 3D skills) | planned since Kickstarter | R, **not shipped** (UNVERIFIED status) | S:5395938616801636534 |

### Play at the table
| Feature | Intro | Signal | Source |
|---|---|---|---|
| **Physical 3D dice**: pick dice into the tray, click-drag and shake the mouse, release to throw. Dice collide with the board. D100 handling; history log | alpha/beta | H, P (the 2025 roller rewrite halved network traffic, made large rolls 10x cheaper, and fixed crashes when clearing many dice) | S:1815580768261447 |
| `talespire://dice/2d12+d4/Fireball:8d6` URL scheme (named groups) as a third-party integration hook | 2020-11-02 | H (the first external API) | S:3884878205229234214 |
| `!` dice command in chat | 2022-11-07 | m | S:4732747437218109985 |
| Stash prepared rolls in the GM inventory; re-roll from a history entry | 2025-06-12 / 2025-11 | m | S:1802354289559972 |
| GM "attack request": a player targets, the GM approves, and the GM cycles attacker/victim | beta | m | (bouncyrock patch notes) |
| **Line of sight**: players see only creatures their minis can see (computed from the head, scale-aware). Party LOS Apr 2021 | beta 2020 | H, P | S:3157533729870588068, S:4117954073009935253 |
| **Fog of war**: an "experimental" version shipped at EA (Apr 2021), then shelved; still "eternally distant" (Aug 2025). **Vision limits** (per-creature sight range, per player and per board) ship as a stopgap | 2021 / 2025-08-05 | **R — #1 functional complaint** | S:1806698490844934 |
| GM overlay / GM blocks (hidden GM-only markers), GM flashlight, spawn creatures hidden | beta / 2021 | H | S:4570566565010734997 |
| Initiative / turn-based mode; the initiative list persists across sessions (Jan 2023, "voted on the feature request board"); AoEs can sit in initiative (Aug 2024) | beta / 2023 / 2024 | R | S:5000716037483004013, S:5963414363404913347 |
| **Rulers**: line ruler, then circle/sphere/cone (implied), creature-move ruler (May 2022), **box ruler** (Feb 2025, "long time coming"). Ctrl changes elevation; rulers snap to props | 2020-07-29 onward | R, P | S:3664193578958387703, S:4348799082187559553, S:1792751525982033 |
| **AoE markers**: right-click any ruler to make it a persistent, tinted AoE saved with the board. A move-whole-AoE handle ("top requested after AoEs"). The GM can convert a player's ruler | 2022-09-18 onward | R | S:6258337460555333064, S:6368680725437138337, S:5127964289170225078 |
| **Gesture and ping**: a pointer others can see (T key), click to ping; off-screen pings show as clickable edge icons | 2025-02-13 | R ("one of our most requested") | S:1791580425974539 |
| Markers, then bookmarks (named markers), searchable in the board panel; `talespire://goto/bookmark` deep links | 2021-08-06 | m | S:4032396530945308085 |
| Link tool: paste a URL onto a creature or marker (D&D Beyond, World Anvil) | 2021-08-16 | m | S:4516534149069687541 |
| Hide board list from players (anti-spoiler) | 2022-12-21 | m | S:5000716037440212419 |
| Chat with bubbles, emotes; text chat only (voice chat is "planned") | 2021 | m | FAQ |
| **Cinematic mode** (the GM freezes everyone's control and drives a shot, synced to players) plus **photo mode** (F6: DoF, vignette, chromatic aberration, freecam; configurable save folder 2025) | photo 2020-10; cinematic by 2022 | H (users cite cinematic as a pro) | S:3807188575857041761, S:4237325463691150425 |
| Compass with settable north | 2020-10 | m | S:3895010671345323392 |
| Grid overlay for the GM; creature grid snapping is local, not enforced (2020) | beta | m | S:3157533729855568097 |

### Lighting and atmosphere
| Feature | Intro | Signal | Source |
|---|---|---|---|
| Atmosphere panel: sun knob (time of day), fog density, exposure, post-process presets ("Frozen"), ambient music/sound tracks, underwater muffle | beta 2020 | H | S:3110243741291384558, S:3444639924519324942 |
| Vertical fog (Dimension 20 board support) | 2021-10-22 | m | S:4103335143110325945 |
| Dynamic point lights (torches, emissive creatures such as ghosts); many light bugs (lights going dark past N lights, lights switching off up close) | EA 2021 | P | S:4056035920073707943 |
| Space/sky modes (Interstellar pack) | 2025 | m | S:1806698490844934 |
| No weather system found in the notes | — | gap | — |

### Sharing, community, mods
| Feature | Intro | Signal | Source |
|---|---|---|---|
| Slab strings (above), shared via the community sites **TalesTavern** and **TalesBazaar**, which host whole published 5e modules | 2020 on | H (the community built the distribution layer) | S:4103335143110325945 |
| **Board publishing**: publish a board and get a URL; importing it copies the board. Since Apr 2025 this also works from the main menu, creating a campaign | 2021-03 / 2025-04 | H | S:4023377846272441883, S:1798454487565221 |
| Restore deleted boards (7 days) | 2022 | m | S:4539082035571188474 |
| Board folders | 2023-11-02 | m | S:5288974951207386305 |
| **Symbiotes**: an embedded Chromium web-view panel with a JS API (read creature selection, initiative, send rolls, handouts, slab-copy events), manifest-driven, loads local HTML or URLs. Popup/modal mode for OAuth logins added Aug 2023. Local storage persists across updates | beta 2023-06, live 2023-07-06 | **H** (the answer to "no character sheets") | S:5124582150155495474, S:5124585319846109070 |
| In-game community mod browser (mod.io): browse, subscribe, vote; slab browser plus in-game slab publishing | 2023-07 / 2023-10 | H | S:5218041989044265945, S:5229301621571996200 |
| Community repo API (so third-party sites appear in-game) | promised 2023; UNVERIFIED if shipped | R | S:5218041989044265945 |
| Partnerships: Dimension 20 / Dropout (The Seven, Starstruck), Demiplane matchmaking, Eldritch Foundry (mini production pipeline) | 2020-21 | H (marketing) | S:4020014731810303367 |
| Unofficial code-injection mod scene (BepInEx-style). Devs run betas specifically so those modders can adapt | ongoing | P (breaks on updates — a user review complains) | S:1798454487634144 |

### Multiplayer / networking / business model
| Feature | Intro | Signal | Source |
|---|---|---|---|
| Centralized servers (Photon for realtime plus Bouncyrock backend). **No offline or LAN mode**; P2P is "planned", and the FAQ calls this "probably the biggest risk" | — | pain (reviews) | FAQ |
| Campaign region switching (Photon region) | 2022-07 | m | S:4598755821866790399 |
| Any player can be promoted to GM; multiple simultaneous GMs; a "Party-GM" role | beta | H | FAQ, S:1844115010492383 |
| Price $24.99, no subscription, all official content free | EA 2021-03-19 | H | S:4048146376714622000 |
| **Seats plus Guest Edition**: a free client that can join only if a full owner has brought a seat. $15 per seat or 4 for $50; seats follow their owner to their latest campaign and are reusable across campaigns. Guests can even GM and build | announced 2023-11, shipped 2024-05-27 | **H and top complaint** | S:5762993398273035979, S:5741605105622344524 |
| Platforms: Windows; Linux via Proton (talespire:// URLs fixed Oct 2023); **Mac (Apple Silicon only) 2023-08-24** | 2021 / 2023 | R | S:5141475722328416780 |
| Server/ISP incidents: Photon outage Dec 2021; Sept 2026 ISP "threat score" blocking of the server domain | — | P | S:1844115010491561 |

### Performance
- Chimera rewrite for scale (2021). Startup time halved (Jul 2021). Scene/resolution scaling, which renders the 3D view below native with a crisp UI (Feb 2023, S:5059268099254928976). Picking cost dropped from 22 ms to <0.01 ms on integrated GPUs (Jul 2024, S:5969041959964192518). RAM bug that loaded every installed mini, 5.1 GB down to 1.3 GB (Dec 2025, S:1818118366184675). Threading fix, Steam Deck −7 °C (Feb 2026, S:1825727806705078). Physics and batching rewrite, 40% less physics time (Aug 2026). The devs repeat that "rendering time still dominates". **Signal: P.** Performance on "machines your party members actually own" is the stated north star; reviews still cite GPU heat and RAM.

### UI/UX
- Radial menu on creatures and dice (P: resolution and UI-scaling fixes). Spacebar expands the UI (library/dice). Help bar and tutorial videos (2021). Rebindable keys (the "E" key couldn't be bound until the 2023 Unity upgrade, S:5124582150177648930). UI scaling. Settings folded into the rabbit menu (2025). Localization system groundwork (Jan 2025, not enabled). Hover info panes in the mod browser (2023). The in-game bug-report info gatherer (2025).

---

## 2. Evolution story (milestones)

1. **2019 Kickstarter**: 8,504 backers, NOK 3.54M (UNVERIFIED conversion, roughly $400k). Pillar: *"building and play are one"* (quoted in the Seats post, S:5382426458985356497).
2. **2020-04 closed beta ("Dragon" build)**: tiles, slabs, dice, LOS, atmosphere, creature scaling, flying, rulers, photo mode. Weekly asset drops.
3. **2020-10 EA delayed**: the engine couldn't scale. Terrain and water deferred indefinitely; a stopgap water plane plus snow/desert tiles shipped instead (S:5422856308611327810). *Lesson: they chose tiles-as-terrain and never got out.*
4. **2021-03/04 Chimera rewrite then Early Access** on Steam at $25 (2021-04-14). Props with free placement, published boards, party LOS, experimental fog of war.
5. **2021-22 feature grind**: bookmarks, status (knockdown), colored bases, HeroForge (2022), polymorph, Cyberpunk/Sci-fi content, AoEs, group movement, persistent initiative. Beta branches on separate servers become the release ritual.
6. **2023 "year of modding foundations"**: Symbiotes (web-view API), mod.io browser, slab browser, Mac (Apple Silicon), board folders, Unity runtime-fee scare ("treating code that ties us closer to Unity as a risk").
7. **2024**: creature modding live (1,000+ creatures fast); **Seats and Guest Edition** (the monetization pivot); Bug Month; AoE initiative; hide-plane heuristics.
8. **2025**: gesture/ping, box ruler, titan sizes, content filtering, **vision limits** (fog-of-war stopgap), roller rewrite, TitanCraft, large perf/RAM fixes.
9. **2026**: live search and tagging overhaul, **status effects**, physics/batching, TaleWeaverCmd. Still EA. Fog of war, terrain and the character creator are still unshipped after about 5 years.

Cadence: roughly 2 people on code for years ("we only have two programmers", 2021). About 60 posts per year, many one-fix patches. Features ship through one-week public betas.

---

## 3. Community pain points and most-requested features

**Pain points, ranked by frequency in the 44 negative Steam reviews plus discussions:**
1. **Seats pricing (dominant, about half of negative reviews)**: "$15 PER PERSON" on top of $25. A group of 1 GM plus 4 players costs about $75-85. It's discovered only after the refund window ("you will learn about the seats in-game"). Top negative review has 405 helpful votes. Users wanted a $5-10 player-only edition. The devs refused because "building and play are one" (S:5382426458985356497).
2. **No real fog of war / dynamic LOS against walls**: "players can see through walls and the only way to prevent that is awkward masking cubes". Dungeon crawls feel impossible. A 2022 Steam thread proposed a first-person mode instead (steamcommunity.com/app/720620/discussions/0/3186865924597785942).
3. **No rules or character-sheet integration** (no D&D Beyond, no 5e automation). You have to keep other windows open, and combat is slower (rogershobbycenter.com/ttrpg-blog/why-i-switched-from-talespire-to-foundry-vtt). Symbiotes partly answer this, but reviews call them "half finished".
4. **Always-online, cloud-stored boards**: no offline, LAN, or map export. There are IP and ownership worries, maintenance downtime mid-session, and the 2026 ISP blocking.
5. **Performance and stability**: GPU heat, RAM up to 6 GB, crashes an hour into sessions, mod-content load failures.
6. **Learning curve and map-building time cost**: "ship in a bottle simulator"; "nearly impossible for a DM to improvise a new 3D scene mid-session"; weak tutorials. Camera navigation frustrates players. Positive reviews, by contrast, say the editor is "easy to pick up… solid workflow in 10 minutes". Opinion splits by GM temperament.
7. **Custom minis pipeline is painful**: TaleWeaverLite requires installing Unity ("excruciating… purposefully obtuse"). The native asset set feels limited, and search was bad until 2026.
8. Missing basics called out repeatedly: mass delete, free placement (pre-Chimera), terrain, per-room water, scaling or recoloring props, map export, VR.

**Most-requested features (from dev statements "most/highly requested" and the feedback board):** fog of war; terrain; in-game character creator; HeroForge (delivered); status effects (delivered after 5 years); gesture/ping (delivered); box ruler (delivered); move-whole-AoE (delivered); persistent initiative (delivered); water tiles (delivered); player and per-creature inventories (promised); voice chat (planned); cheaper player access (answered with Seats, and resented).

---

## 4. UI patterns worth copying

1. **Dice as physical objects you throw.** You pick dice into a tray, then grab and shake with the mouse, then release. Everyone sees the same physics result (server-synced, and rolls persist if the roller disconnects). A roll can be turned into a URL or a `!` chat command, stashed in the inventory, or re-queued from history. This is the tactile hook positive reviews mention. Copy: throw gesture, shared deterministic sim, roll-as-portable-string.
2. **One vertical slider for all "height" concepts.** Camera height, hide/cut plane, water level and fog are all diamonds on one bar, with numeric entry on right-click and a GM-set range. The auto hide plane follows the carried mini, so you see inside buildings without thinking. This is the single most important affordance for making 3D legible. It's worth building as a first-class control, not an afterthought.
3. **Selection becomes a clipboard string (slabs).** Any build selection copies as compact text: pasteable anywhere and version-free. It spawned an entire community distribution ecosystem (TalesTavern hosts full 5e modules) at zero hosting cost to Bouncyrock. For a browser VTT: selection to URL or text blob, paste to spawn, with the same pattern for creatures, stat schemas, and dice rolls. TaleSpire did this for all four.
4. **Rulers promote to persistent objects.** Measure, then right-click and make it an AoE. The AoE saves with the board, joins initiative, and the GM can convert a player's ruler. One tool, two lifetimes.
5. **GM-facing tools**: GM overlay with hidden GM-only blocks and markers; spawn-hidden; hide volumes with type filters; hide the board list from players; cinematic mode that seizes all cameras for a reveal; builder presence; bookmark deep links (`goto` URLs); attack-request approval flow; portrait click to focus, shift-click to teleport.
6. **Building feels fast** because of drag-to-fill volumes for tiles and walls, grid-height sampling (H), 90° tile / 15° prop rotation steps, snap-to attachment points (X), hold-Ctrl for elevation everywhere, simultaneous multi-GM building with shared undo, and a density-capped free-placed prop layer kept separate from the grid tile layer.
7. **Mini handling feel**: screen-shake on big creatures, a drop-point indicator while carrying, Ctrl-drag for flight height with an indicator tower, and a creature-move ruler attached while carrying.

**Anti-patterns to avoid (the lessons in the history):** tiles-as-terrain (they spent 5 years unable to ship terrain, and every biome is tile variants); a rushed hide-volume system with no real fog of war; a mod pipeline that requires installing Unity; always-online with no export; per-seat pricing disclosed only in-game.

## See also
- Kickstarter: https://www.kickstarter.com/projects/bouncyrock/talespire
- Patch notes index: https://bouncyrock.com/news/patch-notes
- Symbiote docs: https://symbiote-docs.talespire.com/
- FAQ: https://talespire.com/faq
- Feedback/roadmap (JS-rendered): https://feedback.talespire.com/ , https://feedback.talespire.com/roadmap/160 (Fog of War)
