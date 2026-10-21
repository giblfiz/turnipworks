# Dungeon Alchemist: feature inventory from its release history (2021 to Sept 2026)

Research date: 2026-09-24. Purpose: treat DA's changelog as a spec of user need for a browser 3D VTT plus DA-style builder.

**Correction up front:** the developer and publisher is **Briganti** (Belgium; founders Karel Crombecq and Wim De Hert), not "Wired Fire Studios". Source: Steam store page, fandom wiki credits.

**How this was gathered**
- All 194 Steam news items (Oct 2021 to Sept 2026) were pulled through the Steam news API (`ISteamNews/GetNewsForApp`, appid 1588530). Every substantive patch post was read in full.
- The fandom wiki was read through its MediaWiki API: Features, Room Menu, Themes, Hotkeys, Export, Terrain, Walls, View Modes, Updates, AI.
- Steam discussions and reviews were sampled.
- The 2026 roadmap image was transcribed by Gemini vision.
- Gap: patch notes from the 2021 backer beta were posted on Kickstarter and Gamefound. I did not retrieve them, apart from dev update #10 and the "beta is live" post. Items from that period are marked **(beta, approx.)**.

Key URLs
- Steam news hub: https://store.steampowered.com/news/app/1588530
- Store: https://store.steampowered.com/app/1588530/Dungeon_Alchemist/ ($44.99; 93% positive of 1,929 reviews; still in Early Access; "full release late 2026")
- Wiki: https://dungeonalchemist.fandom.com/wiki/Features
- Roadmap / Upvoty: https://roadmap.dungeonalchemist.com/roadmap (formerly dungeonalchemist.upvoty.com; the page is rendered in JS and not scrapeable)
- Beta post: https://www.dungeonalchemist.com/post/our-beta-is-live
- Dev update #10: https://www.dungeonalchemist.com/post/dev-update-10-outside-environments-final-release-date-and-pricing

Importance tags: **[HEADLINE]** = headline feature of a named update · **[REQ]** = the post itself calls it heavily or long requested · **[PATCHED]** = fixed or extended again in later releases · **[minor]**

---

## 1. Feature inventory by category

### 1a. Room and wall drawing (the core)
| Feature | Introduced | Signal |
|---|---|---|
| Pick a theme, pick a room type, drag a rectangle of tiles, confirm with a checkmark; the room generates | Beta, Oct 2021 | [HEADLINE] core loop |
| Shift-click adds tiles, Ctrl-click removes tiles; build composite shapes | Beta (approx.) | core |
| Adjacent rooms share walls, and each side of a shared wall takes its own room's style; a wall with no neighbour becomes a full wall | Beta; reworked in Winter Wonderland, Jan 2023 | [PATCHED] |
| Select room → Refresh (re-roll), Change Theme, Edit Shape, Delete (restores the terrain), AI on/off toggle | Beta; Fata Morgana added AI-part config, Sep 2022 | core |
| Refresh with options (for example, re-roll only the objects) | Winter Wonderland, Jan 2023 | [minor] |
| Size tooltip while drawing (room dimensions); map size shown on the corner chevrons | Winter Wonderland, Jan 2023 | [minor] |
| Freely placeable version of every wall type | Winter Wonderland, Jan 2023 | [minor] |
| Walls menu: Change All Walls (whole room), Change Wall (one), Place Wall, Remove Wall brush | Beta, then extended | core |
| **Curved, diagonal and concave corners**: drag the corner handle inward to round it, outward to cut a concave circle, sideways to make a 45° corner | Magic!, Jun 2024 | [HEADLINE][REQ] "we've listened to your requests" |
| **Raised or rotated rooms**: rotate handle above the shape, height handle on its side | Magic!, Jun 2024 | [HEADLINE] |
| Undo/redo while drawing rooms | Magic!, Jun 2024 | [minor] (arrived late!) |
| Pits and canals: room types below zero (acid pit, lava canal, treasure pit) | Everything is Lava, Mar 2023 | stopgap for multi-level |
| Organic rooms: no walls or floor, follow the terrain, place objects against natural walls | Everything is Lava, Mar 2023 | [HEADLINE] (paired with caves) |
| "Empty room" main theme: define the building shape now, furnish later | FwO Part 2 (in progress, 2026) | [REQ] "non-AI rooms" was on user wishlists |
| Separate interior and exterior wall styles | Current per the wiki (date unknown) | minor |

### 1b. AI furnishing and themes
"Procedural AI, not generative AI". The algorithm learns from in-house example rooms and uses no LLM or third-party data (wiki "Dungeon Alchemist AI"; Steam FAQ).
| Feature | Introduced | Signal |
|---|---|---|
| Auto-place walls, doors, windows, floor tiles, furniture and lights from the room shape plus theme and room type | Beta, Oct 2021 (5 themes, 700+ objects) | [HEADLINE] |
| Theme → room-type hierarchy. Today: Abandoned Ruins, Alchemist's Lab, Castle (17 room types), Crypt, Desert, Mansion, Pits, Skeletal Palace, Special, Tavern, Village (19) | Themes added with each content update | [HEADLINE] content cadence |
| AI configuration: choose which parts get generated (objects, lights, walls, doors, floors; roofs added Mar 2026) | Fata Morgana, Sep 2022; roofs in Fine Print, Mar 2026 | [PATCHED] |
| **AI overhaul #1**: logical and centered doors that scale with room size, front vs interior doors, symmetric windows matched to the wall, matching walls between adjacent rooms, columns only in big rooms, structured rooms (chapel pews, throne opposite the door) | Winter Wonderland, Jan 2023 | [HEADLINE][PATCHED] "AI was lacking" |
| AI overhaul #2 ("all AIs received a massive overhaul"), tied to multi-level | FwO Part 1, Jul 2025 | [PATCHED] |
| **AI overhaul #3, "Room for Improvement"**: small objects clump against walls and columns instead of scattering randomly; more furnished surfaces; lights in symmetric patterns that avoid clustering; orderly patterns (dormitory beds); large rooms broken up | Oct 2025 | [PATCHED] "a common complaint... objects spawned too randomly" |
| Hand Drawn theme: black-and-white sketched assets | FwO Part 2 (in progress) | new style axis |
| Object variation cycling: Tab while placing (for example, table dressings) | Present by 2024 | minor, and users did not know it existed |

### 1c. Object placement and editing
| Feature | Introduced | Signal |
|---|---|---|
| Object library by category (Furniture, Decoration, Lights, Nature, Storage, Structural, Utility, Food and Drink, Abstract, Tokens) with search | Beta | core; now "4000+ assets" |
| Move, rotate (Y axis), scale, duplicate; snap to grid, with Ctrl held to place freely; Shift to place multiple | Beta | core |
| Wall-clipped vs wall-forced objects (snap to a wall, or can only exist on a wall) | Beta (approx.) | good pattern |
| **Object brushes**: paint families of objects (a forest in seconds) | Abandoned Ruins, Jun 2022 | [HEADLINE][REQ] "much requested" |
| Collisions-off toggle for free placement (inside walls, overlapping other objects) | Abandoned Ruins, Jun 2022 | [REQ][PATCHED] |
| Collisions-off gives free vertical placement | Everything is Lava, Mar 2023 | [REQ] "eagerly awaited" |
| Collisions-off allows unlimited scaling | Treasury, Aug 2023 | [REQ] ended the stacking hacks |
| Recolor objects | Fata Morgana, Sep 2022 | [HEADLINE] |
| Favourites; "New" category listing each update's assets | Fata Morgana, Sep 2022 | minor |
| Copy and paste object *properties* (light color, door open) and paste them across an area | Everything is Lava, Mar 2023 | [REQ] "no more turning off all lights manually" |
| Snap-together modular objects (rails, pipes, bridges) | Everything is Lava, Mar 2023 | extended in FwO1 |
| Large objects (bridges, huts) level the terrain under themselves and clear objects beneath | Everything is Lava, Mar 2023 | good pattern |
| Customizable abstract shapes with user textures (a DIY wall or floor) | Winter Wonderland, Jan 2023 | [HEADLINE] power-user escape hatch |
| Openable containers (chests, cupboards) that hold objects and move with their contents | Treasury, Aug 2023 | [HEADLINE] |
| Erase-objects brush (Ctrl+Shift+X); scrollbar in the object menu (!) | Treasury, Aug 2023 | minor |
| Improved brushes: grid, line and circle patterns, advanced settings | Magic!, Jun 2024 | [PATCHED] |
| Custom Object Brush: turn any object, workshop ones included, into a brush | FwO1, Jul 2025 | [REQ] |
| Global object scale modifier | FwO1, Jul 2025 | minor |
| Modular Objects tab: contextual menu that selects and connects related modular pieces (ships teased) | FwO1, Jul 2025 | [HEADLINE] |
| **Asset Picker** (eyedropper: click any asset on the map to highlight it in its menu) | FwO2, in progress 2026 | [REQ] |
| **Full 3D rotation** that stays stackable and above ground | FwO2, in progress 2026 | [REQ] ("rotate via Y axis" threads, 2025) |
| **Multi-select, grouping, group duplicate** | FwO2, in progress 2026 | [REQ] roadmap comments ask "why no copy-paste/move room" |
| Asset area-dragging (drag out fences, stacks of platforms) | FwO2, in progress 2026 | minor |
| Sets: saved groups shared on the Workshop | FwO2 (teased Feb 2025) | [REQ] |
| Decals painted on anything (moss, graffiti) | Teased Feb 2025; not in FwO1 | unverified whether it ships |

### 1d. Terrain and outdoor
| Feature | Introduced | Signal |
|---|---|---|
| Outdoor environments: Forest, Grasslands, Dark Parchment; elevation presets (mountains, hills, canyons), vegetation presets, water presets (rivers, lakes, islands) | Beta, early Mar 2022 (dev update #10) | [HEADLINE] was the top beta gap |
| Terrain brushes: raise, lower, flatten, flatten-to-room-height, smooth, clear objects; texture paint; liquid paint | Beta | core |
| Choose room spawn height at map creation (a hovel on a mountaintop) | Abandoned Ruins, Jun 2022 | [HEADLINE] |
| Regenerate terrain on the fly, keeping the rooms | Abandoned Ruins, Jun 2022 | [PATCHED] (Mar 2026: crash fix, only populate new area on resize) |
| Expand the map by dragging its corners (digital maps only; print maps locked until Mar 2026) | Abandoned Ruins, Jun 2022 | core |
| Jungle biome | Abandoned Ruins, Jun 2022 | content |
| Desert and Badlands biomes plus 10 AI categories | Fata Morgana, Sep 2022 | content |
| Brush strength slider | Fata Morgana, Sep 2022 | minor |
| Snow biome plus a **snow overlay weather** effect for any map, old ones included | Winter Wonderland, Jan 2023 | [HEADLINE] |
| Multiple liquids (water, frozen, mud, lava) mixable on one map | Winter Wonderland, Jan 2023 | [HEADLINE] |
| Animated trees | Winter Wonderland, Jan 2023 | minor |
| **Caves** biome (labyrinth, burrow, ridge, tunnel; mushrooms, crystals) plus a Cave tab on any terrain: raise cave area, carve, erase or redraw ceiling | Everything is Lava, Mar 2023 | [HEADLINE][REQ] "one of the most-requested features from the start" |
| Skeletal Plains biome | Everything is Lava, Mar 2023 | content |
| "Remove Water" brush | Magic!, Jun 2024 | minor |
| Fey biome | Magic!, Jun 2024 | content |
| **Underground terrain**: editable below the surface, rooms at any depth | FwO1, Jul 2025 | [HEADLINE] |
| 11 terrain types total today | wiki | — |
| Still missing: slopes and ramps for roads; colorable terrain; importing terrain textures | Steam suggestions 2024-25 | open requests |

### 1e. Multi-level and height
| Feature | Introduced | Signal |
|---|---|---|
| Stackable platforms that export with correct line of sight | Abandoned Ruins, Jun 2022 | early hack for verticality |
| Pits (rooms below zero) as a stopgap | Mar 2023 | stopgap |
| Raised or rotated rooms, called a "prerequisite" for multi-level | Jun 2024 | [HEADLINE] |
| **Multi-level buildings**: +/- (or the right-side menu) changes floor; draw rooms above or below, unlimited stacking; remove floors to make double-height rooms (columns adapt) | FwO1, Jul 2025 | [HEADLINE][REQ] "demand... enormous over the last years"; promised for 2022 (dev: "definitely coming later this year", Apr 2022) and shipped 3 years late |
| **Auto-generated roofs**, slanted and themed, over arbitrary footprints, generated "in milliseconds"; Roof Menu to restyle them | FwO1, Jul 2025 | [HEADLINE][REQ] "ever since we started people have been asking for roofs"; [PATCHED] heavily in Fine Print, Mar 2026 |
| Stairs connect floors automatically and cut the floor above (less flexible than before) | FwO1, Jul 2025 | [PATCHED] promised; users ask to mirror staircases |
| Export per level; "Ground floor with all roofs" export (a village without spoiling the interiors) | FwO1; Mar 2026 | [PATCHED] |

### 1f. Lighting and time of day
| Feature | Introduced | Signal |
|---|---|---|
| AI-generated interior lights, toggleable per object (lights on/off) | Beta | core |
| Day, night, morning and evening presets; editable colour; sun height, intensity, shadow angle and intensity | Beta (approx.) | core |
| Freely colored lights | Abandoned Ruins, Jun 2022 | [HEADLINE] |
| Special effects paint: fire, smoke, fireflies, necrotic fog | Winter Wonderland, Jan 2023 | [REQ] "long-requested" |
| **Realistic interior lighting** (the sun no longer shines through into rooms; needs roofs) | FwO1, Jul 2025 | [REQ] "requested from the very start"; a top complaint in negative reviews |
| Abstract lights: invisible point or spot lights, not exported; performance warning | FwO1, Jul 2025 | [HEADLINE] |
| Cave ceiling shadows toggle | Mar 2023 | minor |
| Export options: lights baked into the image AND sent to the VTT, image only, or VTT only | Current (wiki) | important for VTTs |

### 1g. Export (their center of gravity: DA is a map maker, not a VTT)
| Feature | Introduced | Signal |
|---|---|---|
| JPG image export with orthographic, limited-perspective or perspective walls; 72, 150 or 300 DPI; square or hex grid; grid transparency and colour; border options | Beta; hex grid in Sep 2022; "no borders" Jun 2024 | core |
| **VTT exports with walls, doors, windows, lights, line of sight**: Foundry (JSON), Fantasy Grounds Unity (XML), Roll20 (TXT via API, Pro), Universal VTT `.dd2vtt` | Beta / launch | [HEADLINE] the major selling point in reviews |
| AboveVTT; Fantasy Grounds video | Treasury, Aug 2023 | [PATCHED] |
| **30-second looping video export** (MP4, WebM) with animated water, trees, effects | Winter Wonderland, Jan 2023 | [HEADLINE] |
| Size warnings for Foundry's image and video limits | Aug 2023 | minor |
| Print sizes (Letter to Arch D, A1–A4, custom) at map creation | Beta | core |
| Print and Delivery via Kraken Wargames | Nov 2023 | commercial |
| Batch export: several configurations in one click | FwO1, Jul 2025 | [PATCHED] (Mar 2026 fixes) |
| **Multi-page tiled printing** with overlap, any paper size, saved custom formats | Fine Print, Mar 2026 | [REQ] "finally"; on wishlists since 2024 |
| Grid rendered on top of everything | FwO1, Jul 2025 | minor |
| Green-screen background (for streamers) | Magic!, Jun 2024 | minor |
| Hidden asset-list CSV export (Ctrl+Shift+B) | wiki | minor |
| **3D export: NONE, and "no plans"** (dev MACx3D, Sep 2023: "we would have to redesign it from the ground up") | — | The single largest unmet request. See §3 |

### 1h. Asset import
| Feature | Introduced | Signal |
|---|---|---|
| Hero Forge link: 15 + 5 free tokens and import of purchased 3D minis | Fata Morgana, Sep 2022 | [HEADLINE] |
| **Custom Asset Importer** (STL, FBX, glTF/GLB; configure collisions, lights, animation; Blender guide) plus Workshop sharing | Treasury, Aug 2023 | [HEADLINE] |
| Trace image: overlay an image to rebuild an existing battlemap | Treasury, Aug 2023 | [HEADLINE] |
| Automatic animation and light toggles on workshop models | Magic!, Jun 2024 | [PATCHED] |
| Workshop-origin badge on objects; speedups for heavy workshop users | Magic!, Jun 2024 | [PATCHED] |
| Fix for invisible imported assets | Nov 2023 | [PATCHED] |
| Still missing: custom walls, floors and terrain textures from the Workshop | Steam suggestions 2025; roadmap comments | open request |

### 1i. UI, UX and camera
| Feature | Introduced | Signal |
|---|---|---|
| Left sidebar of mode menus, number-keyed 1–9: Rooms, Objects, Doors, Windows, Walls, Floors, Roofs, Tokens, Lighting (plus Terrain, Effects, Overlay) | Beta, grew over time | core pattern |
| View-mode compass: orthographic, top perspective, full 3D orbit | Beta | core |
| Controls: right-drag pans, middle-drag orbits, wheel zooms; WASD/QE | Beta | — |
| Mandatory 4-step tutorial (draw room, camera, place object, manipulate object) | Beta | forced onboarding |
| New Map dialog: print vs digital, size, terrain, elevation, vegetation, water, room height | Beta; Jun 2022 | core |
| **Cinematic free-fly camera** with screenshot (F) and record (R) | Fata Morgana, Sep 2022 | [HEADLINE] |
| **First-person token view**: walk, jump, click doors and lights | Fata Morgana, Sep 2022 | [HEADLINE] |
| Hide all UI; hide grid; disable nature animations | 2022–23 | minor |
| Overlays: labels and frames drawn on the map | Treasury, Aug 2023 | [HEADLINE] |
| Reopen the last-opened map; warn about unsaved changes before opening a workshop map | Aug 2023 | minor |
| Autosave (opt-in) | Magic!, Jun 2024 | minor (late) |
| Recent Maps submenu | FwO1, Jul 2025 | minor |
| Rebindable hotkeys (JSON file only, no UI) | wiki | users asked for "My Kingdom for Hotkeys" (2025) |
| In-app News page and in-app "Cartomancer Chronicles" weekly newspaper | Apr 2022; Mar 2023 | community pattern |
| Free demo (Tavern theme) | Jun 2024 | commercial |
| Localization: promised only after Early Access ends | FAQ | open |

### 1j. Performance and platform
| Feature | Introduced | Signal |
|---|---|---|
| Windows, Mac, Linux (Unity) | Launch | — |
| +20% performance on all devices, more on Mac; Linux save extension fix | v1.0.59, Apr 2022 | [PATCHED] (Mac perf) |
| Load time cut from "minutes" to "seconds" | Nov 2023 | [PATCHED] |
| A Unity version upgrade delayed Magic! indefinitely | May 2024 | tech-debt signal |
| Magic! and FwO1 each needed a partial or full rewrite ("rebuild... from the ground up"); instability warned | Jun 2024; Feb 2025 | [PATCHED] Fine Print (Mar 2026) was mostly roof and multi-level crash fixes |
| Reviews: maps "struggle with 30x40 squares" (date unknown); the Discord overlay tanks performance (2025 PSA) | reviews / suggestions | pain point |

### 1k. Collaboration, sharing and Workshop
| Feature | Introduced | Signal |
|---|---|---|
| Compact `.dam` map file that can be shared freely | Beta | core |
| **Steam Workshop, in-app**: browse, publish, rate maps | Fata Morgana, Sep 2022 | [HEADLINE] (a Kickstarter stretch goal); about 3k maps within 6 months |
| Workshop sharing for imported 3D assets | Treasury, Aug 2023 | [HEADLINE] |
| Weekly in-app newspaper, map of the week, .DAM challenge, event calendar | Mar 2023; Jun 2024 | community flywheel |
| Upvoty feature voting and public roadmap | Jun 2022 | process |
| Tokens (Bite The Bullet pack, 23 magic tokens) | Jun 2024 | content |
| **No multi-user editing, no live play mode, no fog of war** | — | "Multiuser access" and "Fog of war" (22 replies) threads, 2025–26 |

---

## 2. The evolution story (milestones in order)

1. **Kickstarter, 9 Feb – 11 Mar 2021**: raised €2.46M against a €45k goal, funded in 3 hours, unlocked all 13 stretch goals. That stretch-goal list became a 5-year roadmap the team still says it owes. (TechRaptor, ENWorld, backerkit)
2. **Backer beta, 16 Oct 2021**: 5 themes, 700+ objects, AI, editor, export; roughly 25k users. The admitted gaps were outdoor terrain, the room UI, lighting and export quality.
3. **Outdoor environments, early Mar 2022 (beta)**: Forest, Grasslands, Dark Parchment, plus elevation, vegetation and water presets.
4. **Steam Early Access launch, 31 Mar 2022**; v1.0.59 hotfix 27 Apr 2022 (performance). **1.0 has never shipped**: it is still Early Access in Sept 2026, with "Release: 2026" on the roadmap.
5. **Abandoned Ruins, 1 Jun 2022**: object brushes, collisions-off, room height, terrain regeneration, map expansion, Jungle. (The roadmap image dates it Jan 2022, meaning backer release; unverified.)
6. **Fata Morgana, 29 Sep 2022**: Steam Workshop, tokens and Hero Forge, cinematic and first-person modes, recolor, hex grid, AI part toggles.
7. **Winter Wonderland, 31 Jan 2023**: AI rewrite #1, video export, effects, liquids, snow overlay, abstract textured shapes.
8. **Everything is Lava, 14 Mar 2023**: caves, organic rooms, pits, free vertical placement, property copy/paste, in-app newspaper.
9. **Treasury, 31 Aug 2023**: **custom asset importer**, trace image, overlays and labels, openable containers, AboveVTT.
10. **Magic!, 12 Jun 2024** (delayed by a Unity upgrade): **curved, diagonal, raised and rotated rooms**, major rewrite, Fey biome, autosave, demo.
11. *(an 11-month silence on Steam, Jun 2024 to Feb 2025, then "monthly dev update" promises)*
12. **Fun with Objects Part 1, 10 Jul 2025**: **multi-level, roofs, underground terrain, realistic interior light, abstract lights**, batch export, custom brushes. Split off because roofs needed "an algorithm that didn't exist."
13. **Room for Improvement, 22 Oct 2025**: AI rewrite #3 (clustering, patterns, lighting symmetry).
14. **Fine Print, 17 Mar 2026**: multi-page printing, roof and multi-level bug sweep, roof toggle in AI settings.
15. **Fun with Objects Part 2, in progress, "Summer 2026"** (not shipped as of 24 Sep 2026): asset picker, full 3D rotation, multi-select and grouping, area drag, Hand Drawn theme, Empty Room theme.
16. **Planned**: Release (1.0) in 2026; The High Seas (2027, free, including an ocean floor); remaining stretch goals (Waterworlds, Tricks and Traps, Instant Dungeons) from 2027 on.

The big five, by structural impact: **(1) Launch with room→AI→VTT export (2021–22)**, **(2) Steam Workshop plus cinematic and first-person modes (Sep 2022)**, **(3) caves and organic rooms (Mar 2023)**, **(4) custom asset importer (Aug 2023)**, **(5) multi-level, roofs and underground (Jul 2025)**. Curved and rotated rooms (Jun 2024) is a close sixth.

What the pattern shows: every *structural* feature (curves, multi-level, roofs, 3D rotation) forced a rewrite and slipped by months to years. The cause is that the data model began as a flat, single-level tile grid with Y-only rotation. Content drops (biomes, 400–600 assets) shipped on schedule. **Lesson for us: start with a multi-level, arbitrary-transform scene graph on day 1.**

---

## 3. Pain points and most-requested missing features

1. **3D export (glTF/GLB, OBJ, FBX, USD, STL)**: the largest refusal. Users wanted it for Foundry's 3D Canvas, TaleSpire, Unreal, Unity, Blender, VR and 3D printing. Dev (Sep 2023): *"We have no plans to offer 3d export... We would have to redesign it from the ground up and break our Kickstarter promises."* The thread was locked. Harry hit exactly this in Mar 2025 (DA → TaleSpire was impossible).
   https://steamcommunity.com/app/1588530/discussions/0/3281447232466647281/ · https://steamcommunity.com/app/1588530/discussions/2/5875531492217541234/ · https://steamcommunity.com/app/1588530/discussions/0/3782499316871047632/
2. **No play mode: fog of war, DM/player views, multi-user**. A moderator in 2025 said *"Fog of War is the most popular request"*. The dev says a VTT is "a couple years away or more, after leaving early access". Users improvise by hiding interiors under roofs, black planes and black smoke. There is also a "Multiuser access" thread (Sep 2026) and a "healthbar for tokens" request. **This is our wedge: DA users want to play inside the 3D scene.**
   https://steamcommunity.com/app/1588530/discussions/0/596266163566094231/
3. **Multi-floor and roofs took 3+ years** (promised "later this year" Apr 2022, shipped Jul 2025) and then needed a bug-fix patch (Mar 2026). Stairs became *less* flexible. Users still ask for linked maps, mirrored stairs and customizable 2nd floors and roofs in first-person view.
   https://steamcommunity.com/app/1588530/discussions/0/3275813284150008438
4. **AI quality and control**. The criticism in reviews: "overly cluttered rooms", "essentially useless", objects scattered randomly. The team rewrote the AI three times (2023, 2025, Oct 2025). Users want *lock items during regenerate*, pick variants explicitly, non-AI empty rooms. Lock-during-reroll is still only on Upvoty.
   https://steamcommunity.com/app/1588530/discussions/2/4369129313604816746/
5. **Basic editing ergonomics arrived very late**: undo for room drawing (2024), autosave (2024), multi-select, grouping, copy-paste and moving rooms (still not shipped in 2026; a roadmap commenter asks "why?"), full 3D rotation (2026), hotkey rebinding UI (none).
6. **Top-down readability vs the 3D beauty shot**: "looks fantastic in 3D", poor from above; doors hard to tell from walls; a "Terrible Wall Contrast" thread; indoor sun shadows "immersion breaking" (fixed Jul 2025).
7. **Scale and grid**: a 1 m grid instead of D&D's 5 ft (≈1.5 m), so maps come out "50% bigger"; performance struggles around 30×40 squares (from reviews, date unverified).
8. **Genre lock**: fantasy only. Repeated "Sci-Fi version?", "modern buildings?" threads (2025–26); underwater is promised (High Seas, 2027).
9. **Customization gaps**: custom walls and floors from the Workshop, terrain texture import, colorable terrain, slopes and ramps, mirror items.
10. **Early Access forever and slow cadence**: 5 years in EA; gaps of 11 months between updates; features split and delayed ("we'll try to be more careful about announcing features too early"). Sentiment is still 93% positive; backers say it "delivered on time, then kept delivering".
11. **Emerging: an automation API / MCP**. A 2026 suggestion asks for MCP or a local API so an LLM can script "a 30x30 snowy map with a 10x10 tavern". Users already pipe Claude into ComfyUI. The mod asked "would it save time?" and the devs have not replied. **An open niche that fits our stack.**
    https://steamcommunity.com/app/1588530/discussions/2/796716542888875201/

(Reddit: searches returned no usable r/dungeonalchemist threads; the Steam forums carry the signal. Reddit is unverified here.)

---

## 4. UI patterns worth copying

**4a. The core loop: shape first, content inferred.** Pick a Theme (setting) → pick a Room Type (purpose) → optionally set the AI part toggles → drag tiles on the grid (Shift adds, Ctrl removes) → adjust the shape with direct-manipulation handles (a corner circle rounds, cuts concave or makes a 45° corner depending on drag direction; a rotate handle above; a height handle on the side) → **confirm** with a big checkmark (or trash it). Generation runs at confirmation, so drawing stays cheap. After that, the room is a live object you can Refresh (re-roll), Change Theme (re-skin keeping the shape) or Edit Shape (regenerates). Adjacent rooms negotiate the shared wall (each side keeps its own style, exterior walls stay consistent), and doors become front vs interior automatically. Sources: wiki Room Menu, Winter Wonderland notes.
- *Steal:* purpose-typed rooms (room type = furnishing grammar); a confirm step before generating; re-roll with per-layer toggles (objects only, lights only, roofs) — that's the one missing piece: **lock individual objects across re-rolls**, the top wishlist item DA hasn't shipped.

**4b. A sidebar of modes, number-keyed, each with "all vs one" tabs.** The left rail has 1–9 modes (Rooms, Objects, Doors, Windows, Walls, Floors, Roofs, Tokens, Lights, plus Terrain, Effects, Overlay). Inside Walls: *Change All* (hover highlights the connected run, click swaps it) / *Change One* / *Place* / *Remove brush*. The same scoping idea shows up as copy-properties then paste over an area. Paired with it: a view compass (ortho → top-perspective → orbit 3D) and a camera button for cinematic or first-person mode. Hover-to-highlight before a click commits is the key affordance.

**4c. Brushes for everything, with physics-lite placement rules.** Object brushes (family brushes, custom-object brushes, grid, line and circle patterns), terrain brushes (raise, lower, flatten-to-room-height, smooth), liquid, effect and cave brushes, all sharing size and strength sliders. Objects carry placement semantics: *wall-clipped* (snap to a wall), *wall-forced* (can only exist on a wall), collision on/off (off unlocks free Y, unlimited scale and overlap). Large objects auto-level the terrain beneath themselves. Modular pieces (rails, pipes) snap and get a contextual "Modular Objects" tab. Tab cycles variants while placing.

Also worth taking:
- **The New Map wizard as a generator**: terrain type × elevation × vegetation × water × room height produces a finished outdoor scene. It can be regenerated later without losing the rooms.
- **Export presets per target**, with walls, doors, windows and lights in each VTT's native schema, plus lights baked in the image vs sent as data vs both. Batch export too.
- **First-person token walk-through** as a "show the players" mode. It is the seed of a VTT that DA never grew.
- **A community loop inside the app**: Workshop browse and publish, weekly newsletter, map of the week, challenges.

## 5. Direct implications for our design (my read)
- Their unmet top requests (3D export, play mode and fog of war, multi-user, an automation API) are exactly what a browser-native 3D VTT gets almost for free. **The scene *is* the deliverable**, so glTF is the native format and needs no export feature.
- Their slowest features were structural. Design multi-level storeys, roofs as their own entity ("roofs are not rooms"), full 3D transforms, grouping and prefabs into the data model from day 1.
- Keep their best idea, "shape plus purpose → furnished room". Add per-object locks and seeded re-rolls, and expose generation through an API/MCP (text → scene recipe → editable scene).
- Grid unit: default to 5 ft with metric as an option; test top-down readability (door and wall contrast) as a first-class export view, not an afterthought.
