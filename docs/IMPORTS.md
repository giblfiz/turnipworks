# Importing your own models

How a player brings their own 3D model to the table: a HeroForge character, a purchased dragon STL, a big set piece.

- Written 2026-10-05. Sections: **Decided**, **Tested: the Import Lab**, **What others do**, **Open questions for Harry**.
- "What others do" is web research only; nothing in that section was tested hands-on. Each finding carries a confidence figure (how sure we are the claim is true) and a source.
- Updated later on 2026-10-05: the conversion was then built and tested (see **Tested: the Import Lab**), and Harry decided the copyright approach. Where the research's guesses and the test disagree, the test wins; those places are marked.
- Several vendor sites blocked automated reading, so some findings rest on search-result snippets. Those are marked "snippet".
- Nothing in this document is legal advice. The licence and DMCA sections are background for a conversation with counsel.

## Decided

Decisions made 2026-10-05 by Harry and Fauna.

- We store imports ourselves, narrowly: the model is converted to a small game asset IN THE IMPORTER'S BROWSER and only the converted copy is uploaded. The original never reaches us.
  - **CONFIRMED by Harry's own test, 2026-10-05.** This was provisional until he had seen real before/after quality, because people care a lot about their PC mini or hero dragon. He has now seen it; see **Tested: the Import Lab** below.
  - **Default conversion: 20,000 triangles with a 1024×1024 normal map** (a texture that fakes fine surface detail under lighting).
- Each file is named by a fingerprint (hash) of its contents; commands reference that.
- Assets are scoped to a campaign; only that campaign's seats can fetch them. No public library, no search, no browse — ever, unless the product changes.
- Uploads are served from a separate domain that holds no logins, with forced content type, no type-sniffing, and download disposition (prevents stored XSS on our own domain).
- Every client enforces a size budget at load time and survives a missing asset (shows a ghost box of the right size). There is a "load without custom assets" escape hatch.
- Only self-contained files; external references are stripped. No server-side conversion of strangers' files.
- An import is just an object ("you uploaded an object, it's an object"). No walk-inside, no rooms.
- Scale / front / sit-on-ground are set in the player-facing "object arranger" that is already planned (the tool for composing e.g. a bowl of bananas from a bowl and bananas). Import is part of that tool.
- Uncoloured models get a deliberate pewter or plastic miniature look.
- The importer types the name and description (AI seats cannot see meshes). We do NOT run any AI on our side by default.
- Cap seats per campaign at about 20.
- Copyright: **solved (Harry's decision, 2026-10-05).** We lean on safe harbour, the US law that protects a service from copyright damages over files its users upload, provided it removes them on a valid notice (section 7 below). Harry: "that is what it's there for." If HeroForge wants to annoy its customers by sending takedowns, that is fine.
  - Fauna runs takedowns.
  - Still needed to actually HAVE safe harbour: a registered DMCA designated agent, a contact address, and a "you have the right to upload this" line in the terms. None of these exists yet.
  - Legal review WITHDRAWN (Harry, 2026-10-05, later the same day): "I think we are absolutely safe with safe harbor, and I don't think we need to talk with Mr. Lee to move forward. Fundamentally we are not *distributing* anything." Fauna agrees with going ahead, with one note: the protection comes from the safe-harbour formalities (registered agent, takedown process, repeat-infringer policy), so those need to exist before the hosted site is promoted.
- Per-campaign quota; unreferenced assets deleted after a grace period; campaign export bundles the assets. Self-hosters store to a folder.
- Deferred: formats beyond GLB and STL, quotas as a paid tier, link-your-own-host for power users.

- **Delivery (2026-10-12, docs/ASSET_DELIVERY.md).** The library's own meshes are now delivered meshopt-compressed under names that change with their bytes, and every loader decodes meshopt (`tools/spawn-tuner/js/gltf.js`; the Import Lab's loader already did). Imports are not on that pipeline yet because nothing stores them yet. When they are stored: the converted copy is already to be named by its hash (above), so it can be served `immutable` the same way, and the browser-side conversion should write the same recipe (quantized + meshopt, `prep/meshopt.mjs` shows the settings) so a 20,000-triangle import is about a third of its raw size on the wire. The library's tiers are unchanged: props 10,000 faces with a 128 or 256 px colour map, figures 8k/512 and 20k/1024, a main pawn's original about 50k.

## Tested: the Import Lab

The converted-copy rule was "provisional pending tests". This is the test.

- **What it is:** a page that converts a model in the browser and shows the original and the converted copy side by side. Code in `tools/import-lab`; live at https://implausible.enterprises/projects/turnip-works/import-lab/.
- **What it does:** it simplifies the model (removes triangles), then bakes the original's fine detail into a texture, a normal map. "Bake" means working out, for each point on the small model, which way the original's surface faced there, and saving that as a picture.
- **Nothing is uploaded.** The conversion runs in the visitor's browser.

### Fauna's measurements (2026-10-05)

From `tools/import-lab/LAB_NOTES.md`, which has the full tables and method. Model: the Stanford dragon, 871,414 triangles. Bake on, 1024×1024 normal map. Measured on the build box.

- "Error" is the distance between the two surfaces as a percentage of the model's height.
- "Close-up difference" is the average difference between the two pictures per pixel, on a 0–255 scale, at close zoom.

| budget | file size | time | error, typical / worst | close-up difference |
|---|---|---|---|---|
| 5k triangles | 1.18 MB | 5.4 s | 0.133% / 2.94% | 1.75 |
| 10k | 1.32 MB | 4.9 s | 0.076% / 2.77% | 1.32 |
| **20k** | **1.70 MB** | **5.5 s** | **0.042% / 0.64%** | **1.06** |
| 50k | 2.74 MB | 6.1 s | 0.020% / 0.13% | 0.90 |
| 100k | 4.41 MB | 6.5 s | 0.011% / 0.10% | 0.84 |

What the numbers say:

- **The bake is worth far more than triangles.** 5k with the bake (1.75) beats 100k without it (1.81).
- **The worst-case error drops sharply between 10k and 20k** (2.77% to 0.64% of height). Below 20k some thin part has been eaten, and a normal map cannot put back a missing horn tip.
- **Below 20k the file is mostly texture**, so going from 20k down to 5k saves only about 0.5 MB.
- **A 1024 normal map is the right size.** 2048 takes about 16 s against 4–5 s and measures no better.
- With the textures stored as WebP (a smaller image format) the 20k file would be about 0.94 MB.
- A blind check by Gemini (an AI vision model shown unlabelled pairs) saw no difference at any budget with the bake on, and did see one with the bake off. It is a rough filter, not Harry's eye.

### Harry's test (2026-10-05)

- Harry tried it with HeroForge minis and purchased models of around 2 million polygons, reduced to 20k.
- Harry: "wow! amazing. Works great, looks great... I would be hard pressed to pick the original."
- This was the test the lab notes called the one that matters most: models Harry actually cares about, with thin parts, rather than the forgiving dragon.
- **Result: the converted-copy rule is CONFIRMED. Default 20k triangles with a 1024 normal map.**

### Known gaps

- **The tab freezes during conversion** (about 5–8 seconds). The work is not yet moved off the main page thread.
- **The texture layout is crude.** Roughly half the texture is wasted and it is cut into a few hundred patches.
- **A model's own detail texture is not carried over.** If the original came with its own normal map, the bake ignores it.

### What this changes in the research below

- Section 5 guessed (75%, "a judgment, not a measurement") that 50–100k triangles with no bake would do, and that the bake "only earns its keep below roughly 20,000 triangles". Measured, the bake wins at every budget. Version one bakes.
- Section 5 also said no ready-made open-source piece exists for the bake step and that we would write it. We wrote it.
- Open question 1 is answered. Open question 8 (recommend an outside tool?) no longer has a reason behind it.

## What others do

### The short version

- **Nobody we found does what we decided.** The others fall into three groups:
  - Public library hosted by a third party (TaleSpire on mod.io).
  - Links the user hosts themselves (Tabletop Simulator).
  - The game master's own disk (Foundry).
  - Campaign-private, vendor-hosted, converted-in-the-browser is new ground. That is a reason to test early, not a reason to doubt it.
- **HeroForge is not a "huge print file" problem.** HeroForge's own pages say its STL is at most 100,000 triangles and 5–10 MB. That is already close to game size. The heavy-conversion problem is the purchased dragon, not the HeroForge mini.
- **HeroForge is a licence problem instead.** Its terms forbid uploading purchased models to a third-party service "for redistribution". Other tabletops get HeroForge minis by becoming an official partner.
- **Every sculptor licence we read says "personal use, do not share or host the file".** None mentions virtual tabletops at all.
- **Every takedown we found hit a public workshop.** We found none against a private table. That is absence of evidence, not proof of safety.

### 1. TaleSpire

How custom minis get in:

- **The official route is a public library on mod.io** (a third-party mod hosting service). A creator uses TaleWeaverLite, a plugin for the Unity game editor, to package a mesh and textures into a `.tsMod` file and publish it. Anyone on a board who lacks a mini gets it downloaded automatically. Live since 2024-03-06. *95%.* [Bouncyrock announcement](https://bouncyrock.com/news/articles/talespire-release-creature-modding-leaves-beta), [TaleSpire guide](https://talespire.com/playing-in-boards-using-creature-mods)
- **mod.io hosts the files, not Bouncyrock.** Mods are public and browsable by default. There is an "upload publicly" checkbox; unchecked hides the mod from browsing. *80% (snippet).* [TaleWeaverLite info](https://talespire.com/taleweaverlite-additional-info)
- **There is no per-campaign privacy in the plain game.** If a mini is not on mod.io the game cannot find it, and friends must be handed the file. A fan-made patch exists to sync private minis. *75%.* [guide](https://talespire.com/playing-in-boards-using-creature-mods), [Mod Io Private Patch](https://thunderstore.io/c/talespire/p/HolloFox_TS/Mod_Io_Private_Patch/)
- **The creator tool is the known pain point.** Our own earlier notes record players calling the Unity install "excruciating". See `research/talespire.md`.
- **The older fan route** (LordAshes' Custom Mini Plugin) needed every player to copy the files to their own machine. It is now marked deprecated. *85%.* [plugin page](https://thunderstore.io/c/talespire/p/LordAshes/CustomMiniPlugin/)

Limits TaleSpire publishes:

- One mesh, **at most 60,000 vertices**. Their own creatures average about 4,500 and top out near 11,000. *90%.* [TaleWeaverLite guide](https://talespire.com/taleweaverlite-guide)
- Textures **at most 2048×2048**: a colour map, a normal map (a texture that fakes fine surface detail), and one combined map for metal, shadowing, glow and smoothness. *90%.* Same source.
- Input is whatever Unity reads (FBX, OBJ and others). **STL is discouraged.** *90%.* Same source.
- No file-size cap found, and no support for skeletons or animation found. *60% that none exists.*

The HeroForge link:

- The player pastes a HeroForge "access key" into TaleSpire. Minis bought as **"3D Digital"** then appear in the game and are downloaded automatically to everyone in the campaign. The page says plainly not to buy the STL for this. *95%.* [heroforge.talespire.com](https://heroforge.talespire.com/)
- Cost: **$7.99 per mini**, or a $14.99–19.99 monthly subscription that includes five. No edits after purchase. *90%.* [HeroForge products](https://heroforge.com/content/product-information/about-products/), [subscriptions](https://heroforge.com/content/product-information/subscriptions/)
- Who serves the file is not stated. Our guess is HeroForge, with TaleSpire converting on the player's machine. *65%, inference.* [beta announcement](https://bouncyrock.com/news/articles/welcome-to-the-heroforge-integration-beta)

Quality, HeroForge mini in TaleSpire versus the original:

- Bouncyrock says the models are **not the STL**; they are a separate game-sized version with colour, heavier than TaleSpire's own creatures, drawn with TaleSpire's own mini look. *85%.* [dev update](https://bouncyrock.com/news/articles/heroforge-integration-dev-update)
- HeroForge warns that colours and materials "may render differently" in a tabletop than on its site. *95%.* [HeroForge digital models](https://heroforge.com/content/support-docs/digital-models/)
- One bug report says kitbashed minis (parts combined freely, a paid HeroForge feature) arrive with broken textures and visible joints. One report, no developer reply. *50% that it is a general, current problem.* [feedback post](https://feedback.talespire.com/p/heroforge-kitbash-breaks-texture-when-ported-on-talespire)
- **What players complain about is price, not looks.** Paying $8 and not getting the STL; paying again when the character gets a new weapon. Others say the convenience is worth it. *70% on exact wording (Steam forum, read through a summariser).* [thread 1](https://steamcommunity.com/app/720620/discussions/0/3269060963455425082/?ctp=4), [thread 2](https://steamcommunity.com/app/720620/discussions/0/3818543965130233937/)
- **Not found:** any side-by-side picture comparison, any measured triangle count of the game version, any Reddit or Discord discussion. The "is there a known quality loss" question is therefore only half answered: no widespread complaint surfaced, but we did not find anyone measuring it.

Copyright handling:

- Reactive. Bouncyrock tells rights holders to file a DMCA report against the mod. *90%.* [announcement](https://bouncyrock.com/news/articles/talespire-release-creature-modding-leaves-beta)
- Players asked for a filter for mods that break HeroForge or TitanCraft licences. TaleSpire shipped "2D", "Unpainted" and "AI-created" flags in 2025, but no "unauthorised" flag. So ripped HeroForge minis in the public library are a known problem there. *85%.* [feedback post](https://feedback.talespire.com/p/filtering-out-unwanted-community-mods-ai-unauthorized-and-more)

### 2. HeroForge exports

What you can buy today (pages read 2026-10-05):

- **STL download** — $7.99. A zipped `.stl`, "around 5-10 MB", "up to 100,000 triangles". No colour. HeroForge says it is "not suitable for importing into virtual tabletop applications". *95%.* [STL product page](https://heroforge.com/content/product-information/about-products/stl/), [digital models](https://heroforge.com/content/support-docs/digital-models/)
- **3D Digital** — $7.99. A zipped `.unity3d` bundle (a format only the Unity game engine reads) with colour textures. Not printable. No triangle count or file size published. *90%.* Same sources.
- **No open format.** No GLB, OBJ, FBX or 3MF on any product page. *80% (absence).*
- **Access-key partners** receive minis directly from HeroForge instead of the user handling a file: TaleSpire, Foundry VTT, Dungeon Alchemist, Scene Grinder, Tabletop Simulator and several others. *80% (snippet).* [access key FAQ](https://heroforge.com/content/support-docs/faq-3d-virtual-tabletop-access-key/)
- **Subscriptions**: Pro at $3.99–5.99 a month adds kitbashing and flat-token export; Pro+ at $14.99–19.99 adds five mini credits a month. *95%.* [subscriptions](https://heroforge.com/content/product-information/subscriptions/)

What this means for us:

- A HeroForge STL is small enough to load nearly as-is. It has no colour, so it would get our pewter look.
- The coloured version is locked in a Unity-only format. A browser cannot simply open it. *75%.*
- So a HeroForge player importing by file gets a grey mini. The coloured mini comes only through partnership.

What the licence says ([Terms of Service](https://www.heroforge.com/ToS/), dated 2021-06-05; *95% on wording*):

- On tabletop use: personal, non-commercial purposes "include networked and public viewing such as on social media or during remote or digital gameplay through **authorized** virtual tabletop applications."
- On sharing: "The 3D Models may be printed or otherwise used for personal, noncommercial use and may not be resold, redistributed, or made available to third parties."
- On uploading: users may not "upload or share any purchased 3D Models to a third-party site, application or service, e.g., Steam, for redistribution".
- On commercial use: not allowed, including selling prints.
- The page looks stale (its subscription details disagree with the current subscription page), so the live terms may differ. *Not verified.*

How that reads against our design (*70%, our reading, not a lawyer's*):

- The friendly reading: a private table of at most 20 people who are playing together is "digital gameplay", not "redistribution".
- The unfriendly reading: we are a third-party service, the other seats are third parties, and we are not an "authorized" application.
- Who decides: HeroForge, in the first instance, by sending a notice or not.
- The clean path is the one every other tabletop took: ask HeroForge to become an access-key partner.

### 3. Tabletop Simulator

The claim to check: "custom assets are user-hosted links, link rot is a well-known problem, and the community built backup tools."

**Confirmed, with one correction.** *90% overall.*

- The correction: the recommended host is **Steam Cloud**, which is vendor storage, free, 100 GB per account. Players may also paste any web link (Imgur, Dropbox, Pastebin). *95%.* [asset importing](https://kb.tabletopsimulator.com/custom-content/asset-importing/), [cloud manager](https://kb.tabletopsimulator.com/custom-content/cloud-manager/)
- Either way, a saved game stores **links**, and links break:
  - Steam changed its cloud web addresses; a backup tool now rewrites the old form automatically. *90%.* [TTS Mod Vault](https://github.com/markomijic/TTS-Mod-Vault)
  - Deleting and re-uploading the same file gives a new link and breaks other people's saves. *75%.* [TTSCloudSync](https://github.com/Chatanga/TTSCloudSync)
  - Mods that point at Imgur, Pastebin or private Dropbox die when those go down or hit limits. *85%.* [ttsbackup](https://github.com/stefankendall/ttsbackup)
  - Steam's own servers refused cloud assets for a period around July 2024. *60% (snippet).* [report](https://tabletopsimulator.nolt.io/670)
- Backup tools exist, several of them: [TTS Mod Vault](https://github.com/markomijic/TTS-Mod-Vault) (maintained, checks for dead links), [tts-backup](https://github.com/eigengrau/tts-backup), [ttsbackup](https://github.com/stefankendall/ttsbackup), [TTS-Mod-Transloader](https://github.com/kevin-d-omara/TTS-Mod-Transloader). *85–95%.*
- Model limits: OBJ only, **under 25,000 vertices** (above that the manual warns of failed imports or crashes), textures under 4096×4096. *95%.* [asset creation](https://kb.tabletopsimulator.com/custom-content/asset-creation/)

What this supports in our decisions: naming files by fingerprint (a re-upload of the same file is the same name, so nothing breaks), the ghost box for a missing asset, and bundling assets into the campaign export.

### 4. Other tabletops

Where custom assets live, and whether storage costs money.

| Tabletop | 3D? | Where files live | Free allowance | Paid | Confidence |
|---|---|---|---|---|---|
| Foundry VTT (self-hosted) | with add-on | The game master's own disk, or their own cloud bucket | Their disk | — | 95% |
| The Forge (Foundry hosting) | with add-on | Vendor | — | $4.49/mo for 5 GB of assets; more sold | 85% |
| Molten (Foundry hosting) | with add-on | Vendor | — | $4 / $8 / $12 per month for 5 / 10 / 20 GB | 75% (snippet) |
| Owlbear Rodeo 2 | no | Vendor | 200 MB | 5 GB at $3.99/mo; 10 GB at $7.99/mo | 75% |
| Roll20 | no | Vendor | 100 MB | 10 GB (Pro); 50 GB (Elite, $150/yr) | 85% / 70% |
| Alchemy RPG | no | Vendor | 30 MB per file; no stated total | — | 85% |
| Let's Role | no | Vendor | 125 MB | 6–15 GB with pass | 70% |
| Tabletop Playground | yes | Local, shared through mod.io | — | — | 90% |
| Dungeon Alchemist | yes | Local, shared through Steam Workshop | — | — | 85% |
| TerrainTale | yes | Vendor | none | Model import is a paid feature ($6/mo) | from `research/other-vtts.md` |
| Atlas VTT | yes | Vendor bucket for a curated set | — | — | 80% |
| Menyr | yes | Import promised "later on" | — | — | 85% |
| Realm Engine | yes | Unknown | — | — | not verified |

Sources: [Foundry S3](https://foundryvtt.com/article/aws-s3/), [The Forge](https://forge-vtt.com/features), [Molten](https://moltenhosting.com/), [Owlbear pricing](https://www.owlbear.rodeo/pricing), [Roll20 Elite](https://app.roll20.net/forum/post/12542863/introducing-roll20-elite-5x-storage-4x-sharing-and-more), [Alchemy uploads](https://help.alchemyrpg.com/en/articles/9821699-uploading-assets), [Let's Role](https://lets-role.com/play-pass), [Tabletop Playground](https://tabletop-playground.com/knowledge-base/packages/), [Dungeon Alchemist importer](https://dungeonalchemist.fandom.com/wiki/Asset_Importer), [Atlas VTT](https://github.com/kgsherman/atlas-vtt), [Menyr FAQ](https://menyr.nogstudio.com/faq/).

Notes:

- **Storage is the standard paid feature.** Every vendor-hosted tabletop we checked gives 100–200 MB free and sells gigabytes. *85%.* This supports keeping "quotas as a paid tier" on the deferred list rather than dropping it.
- **Foundry's 3D add-on** (3D Canvas, by TheRipper93, paid through Patreon) reads GLB and FBX from the game master's data folder. No hard triangle limit, but models with hundreds of thousands of vertices freeze the page. *80%.* [package page](https://foundryvtt.com/packages/levels-3d-preview), [model doctor](https://github.com/charliesuits/foundry-3d-model-doctor)
- **Atlas VTT** converts sculpts to compressed GLB with three detail levels using a build script on the developer's side, not in the player's browser. Whether players can upload their own is unclear. *50%.*
- **Mage Hand Press**: we found no 3D product from them. The name in the question was probably a mix-up with TheRipper93.
- **Others that accept HeroForge or STL**: Dungeon Alchemist (GLB advised, STL accepted), Game Master Engine (STL in one colour), Tabula Sono (STL/FBX/OBJ, per our earlier notes), Scene Grinder (claimed, not checked).

### 5. Getting a high-quality small model from a print file

The goal: take a print-resolution sculpt (often 0.5–5 million triangles, no colour) and produce a small model that looks nearly the same. The classic method is two steps: reduce the triangle count, then "bake" the lost fine detail into a normal map, a texture that fakes surface detail under lighting.

**First, a finding that reframes the question.**

- For a mini seen at tabletop distance, reducing to **50,000–100,000 triangles with no bake at all** should look essentially the same as the original. *75%, a judgment, not a measurement.*
- Supporting evidence: HeroForge's own STL is at most 100,000 triangles, and TaleSpire allows 60,000 vertices.
- The bake only earns its keep below roughly 20,000 triangles, or in close-ups.
- A middle route needs no texture: copy the original's surface directions and crevice shading onto the corners of the small model. No seams, nothing to unwrap.
- **This is the first thing the before/after test should settle.** If 50–100k triangles looks right, the hard part of the importer disappears.

Tools we could point people at:

| Tool | Cost | File leaves their machine? | Quality reputation | Difficulty for a non-technical player (1 easy – 5 hard) |
|---|---|---|---|---|
| [Rig Bake](https://rigbake.com/tools/bake-normal-map/) (web) | Free | Says no | Unknown; new, operator not disclosed | 1 |
| [Needle Mesh Baker](https://mesh-baker.needle.tools/) (web) | Free preview; €69 once to download | Says no ("100% local") | From a known three.js company; released 2026-08-28 | 1–2 |
| [InstaLOD](https://instalod.com/#pricing) (desktop) | Free under $100k revenue | No | Industry-grade | 3 |
| [RapidPipeline](https://rapidpipeline.com/en/pricing/) (desktop) | About $91/mo | No | Strong | 3 |
| Blender, by hand | Free | No | Good, needs tuning | 5 |
| Blender plus an add-on ([SimpleBake](https://superhivemarket.com/products/simplebake---simple-pbr-and-other-baking-in-blender-2), $20) | $20 | No | Same as Blender | 4 |
| [Meshy](https://docs.meshy.ai/en/api/remesh) remesh (web) | Credits | **Yes, uploads** | Reduces only; no bake documented | 1 |
| [Tripo](https://studio.tripo3d.ai/workspace/retopology/) low-poly (web) | Credits | **Yes, uploads** | Its detail map looks AI-invented, not copied from your sculpt | 1 |
| MeshLab | Free | No | Good reduction, weak bake | 5 |
| Marmoset Toolbag | $399 | No | Best-in-class bake; you supply the small model | 4 |
| [Simplygon](https://www.simplygon.com/) | From $6,300/yr; free tier ended 2024 | No | Top tier | not realistic |
| [gltf-transform](https://gltf-transform.dev/functions), [meshoptimizer](https://meshoptimizer.org/) | Free | No | Reduce only; **no baking** (95%) | 4 |

Confidence on the table: 80–95% for cost and local-versus-upload on the established tools; **70% that Rig Bake works as it claims; 80% for Needle**. Both browser tools are newer than Fauna's training and are known only from their own web pages.

Caveats on the two easy ones:

- Neither clearly lists STL as an input. A player may need to convert STL to OBJ first, which undoes much of the ease. *Not verified.*
- Neither has been tried on a real multi-million-triangle sculpt by us.
- Pointing players at a tool we have not tested is a risk to their trust in us. Test before recommending.

**Best route to point people at today** (*65%*): Rig Bake or Needle Mesh Baker for most players, InstaLOD's free tier as the desktop fallback, Blender plus SimpleBake for the determined. The 65% is low because of the untested caveats above.

Can reduce-plus-bake be done well entirely in a browser?

- **Yes, it has been done**: the two web tools above claim exactly this. *75%.*
- **No ready-made open-source piece exists for the bake step.** *70%.* We would write it.
- The open-source pieces that do exist:
  - Reducing triangles: **meshoptimizer** (`MeshoptSimplifier`, runs in the browser). Mature.
  - Unwrapping the surface onto a flat texture: **watlas** (the xatlas library built for the browser; gltf-transform's `unwrap` uses it). **xatlas-three** also exists but looks unmaintained.
  - Finding where a ray hits the original sculpt: **three-mesh-bvh**. Mature.
  - Nearest working example: [three-lightmap-baker](https://github.com/Ibrahim-3d/three-lightmap-baker), which bakes lighting rather than surface detail. Small project.
- Dead ends checked: manifold-3d (wrong job), libigl and Open3D (no official browser builds found), Blender in the browser (not real).
- Memory and time, **estimated, not measured** (*60%*): a 5-million-triangle file peaks around 1–1.5 GB of memory. Fine on a desktop, likely to fail on a phone. Roughly 10–60 seconds.
- Where a fully automatic bake goes wrong (*85%, general knowledge of the craft*):
  - Between fingers, a sword held against a leg, a cloak against a body: the bake picks up the wrong surface.
  - Thin blades collapse when triangles are removed.
  - Automatic unwrapping of a small model leaves many visible seams.
  - These are exactly the parts of a hero mini that people look at.

What is realistic for our importer (*75%*):

- Version one: read the file, merge duplicate corners, reduce to about 50–100k triangles, copy surface directions from the original. No texture, no bake.
- Later, as an opt-in "make it smaller" mode: unwrap plus our own bake.
- Run it off the main page thread so the tab does not freeze.

### 6. How sculptors license their files

**Not legal advice.**

The pattern (*85%*): every licence we found says personal use, printing only, never share or host the file. **None mentions virtual tabletops, for or against.** The clause that touches us is "do not share or host", not anything about tabletops.

- **MyMiniFactory** standard licence: "You shall not share, sub-license, sell, rent, host, transfer, or distribute in any way the digital or 3D printed versions of this object, nor any other derivative work… (including… hosting on other digital platforms)". *85% (snippet).* [licence page](https://www.myminifactory.com/object-licensing)
- **Printables / MakerWorld** use the same standard wording. *80%.* [discussion](https://forum.bambulab.com/t/standard-digital-file-license-question/103998)
- **Artisan Guild**: a licence "to download, store and 3D print the Content for personal, non commercial use only"; may not "sell, share, rent, sublicense, transfer or distribute the Content, including modified versions". *90% (page read).* [EULA](https://artisanguildminiatures.com/eula)
- **Cast n Play**: "You may not Resell, re-distribute, or share our digital resources as-is or where the resource can be extracted". *90% (page read).* [terms](https://www.castnplay.games/termsandconditions)
- **One Page Rules**, **Titan Forge**, **Loot Studios**: same shape. Loot Studios adds "Sharing files is not permitted". *75–80% (snippets).* [OPR](https://www.patreon.com/onepagerules/about), [Titan Forge](https://www.patreon.com/titanforgeminis/about), [Loot Studios](https://lootstudios.com/terms-of-service/)
- **Cults3D** default is private use only. *75% (snippet).* [licences](https://cults3d.com/en/licenses)
- **Thingiverse** is mostly Creative Commons. Those are the only files in this list that plainly allow re-hosting, within each licence's limits. *70%.*
- **Games Workshop**: "zero tolerance". *85% (snippet).* [legal page](https://www.warhammer.com/en-GB/legal)
- Not checked: Epic Miniatures, Printable Scenery, Wizards of the Coast's fan policy, MyMiniFactory's subscription-club terms.

Tabletop rights are sold separately (*85%*):

- HeroForge sells the tabletop version as its own $7.99 product, separate from the STL.
- TitanCraft has an official TaleSpire link. [titancraft.talespire.com](https://titancraft.talespire.com/)
- We found no Patreon sculptor selling tabletop-ready packs. *Absence, 55%.*

Known disputes:

- **Games Workshop against Tabletop Simulator, 2026-06-26**: DMCA notices removed major Warhammer 40,000 mods from Steam Workshop at the new edition's launch. Similar sweeps were reported at the two previous editions. *85%.* [Geek Native](https://www.geeknative.com/238752/digital-warhammer-community-bypasses-steam-storefront-following-intellectual-property-sweep/)
- **Asmodee / Fantasy Flight against Tabletop Simulator, April 2020**: Arkham Horror, Pandemic and others removed. *85%.* [Steam thread](https://steamcommunity.com/app/286160/discussions/0/2259061617892878877/)
- **HeroForge copyright controversy, October 2020**: found, not read. [Plagiarism Today](https://www.plagiarismtoday.com/2020/10/19/hero-forge-and-the-copyright-controversy-over-miniatures/)
- TaleSpire / mod.io takedowns: none found.

How this reads against our design (*our reading, 60%*):

- Every documented takedown targeted a **public** library. Our "no public library, ever" decision removes the thing rights holders have actually gone after.
- It does not remove the licence problem. A player who uploads a purchased sculpt so five friends' browsers can download a copy is, on the plain words, "sharing" and "hosting". Converting it to a smaller model first makes it a "derivative work", which the MyMiniFactory wording also names.
- The friendly reading: the player is using their own purchase at their own table, as they would put a printed mini on a physical table. Nothing can be browsed or taken away for printing (the converted copy is too small and rough to print well, which is a real point in our favour).
- Who decides: the sculptor, by sending a notice or not. How likely anyone looks: low, because nothing is visible from outside a campaign. We cannot put a good number on it.
- The licence is between the player and the sculptor. Our exposure is whether we respond properly to notices, which is section 7.

### 7. US DMCA designated agent

**Not legal advice. This is a plain-language summary for a conversation with counsel.**

What it is: a US law gives a service that stores users' files protection from copyright damages for those files, on conditions. One condition is registering a named contact, the "designated agent", with the US Copyright Office.

Registering:

- **Fee: $6**, paid online, per registration and per later change. *95%.* [fee page](https://www.copyright.gov/about/fees.html)
- **The fee is about to rise to $25.** The Copyright Office sent a new schedule to Congress in July 2026 and aims to start it in autumn 2026. *90%.* [proposed schedule](https://www.copyright.gov/rulemaking/feestudy2026/proposed-fee-schedule.pdf)
- **Information required** (*95%*; [FAQ](https://www.copyright.gov/dmca-directory/faq.html), [regulation](https://www.law.cornell.edu/cfr/text/37/201.38)):
  - For the service: full legal name, a **physical street address (not a PO box)**, and any other names the public knows it by (site names, domains).
  - For the agent: name, organisation, mailing address (**a PO box is allowed here**), phone, email.
- **The service's street address becomes public.** This is the practical cost for a small project, and it decides which legal entity should be the registrant.
- **Who can be the agent**: a named person, a job title, a department, or an outside company that does this for a fee. *95%.*
- **Renewal: every three years**, or the registration lapses and the protection with it. *95%.*
- **The same contact details must also be posted on the website.** *85%.*
- Whether an individual or a non-US project can register: nothing we read forbids it. *70%, not verified.*

The other conditions that matter (*85–90%*; [the statute](https://www.law.cornell.edu/uscode/text/17/512)):

- Remove material promptly when a valid notice arrives.
- A valid notice has six parts: a signature, the work claimed, what to remove and where it is, contact details, a good-faith statement, and a statement of accuracy made under penalty of perjury.
- Tell the uploader. If they send a counter-notice, forward it and restore the material in 10–14 business days unless the claimant sues.
- Have a written policy for closing the accounts of repeat infringers, tell users about it, and actually follow it.
- Do not ignore infringement you already know about or that is obvious.
- Do not profit directly from infringing material you have the power to control.

Things for counsel that we did not resolve:

- The protection covers storage "at the direction of a user". Our conversion runs in the user's browser, at the user's command, before anything reaches us. That looks favourable, and it is one more reason to keep "no server-side conversion". *60%, our reading.*
- If paid storage tiers arrive later, the "profit directly" condition deserves a second look.
- If the site serves people in the EU, the Digital Services Act requires its own notice process. *75%, from memory.*
- Our content-fingerprint naming gives a simple, honest takedown: remove the fingerprint and it is gone from every campaign that held it. Whether we should also block it from being uploaded again is a policy choice.

### What we could not verify

- Any side-by-side picture of a HeroForge mini in TaleSpire against the original.
- Triangle counts for HeroForge's coloured tabletop version.
- Whether HeroForge's terms have changed since the 2021 date on the page.
- Whether either browser bake tool accepts STL directly, or handles a multi-million-triangle file.
- All timings and memory figures. They are arithmetic, not measurements.
- Current exact storage numbers for Owlbear Rodeo and Roll20 (their pricing pages blocked reading).
- Realm Engine's import and storage; Atlas VTT's licence.
- Whether any sculptor has ever sent a notice over a private tabletop game.

Method note: HeroForge's site blocks automated readers. A research helper loaded five public HeroForge pages and two TaleSpire feedback pages once each in an ordinary headless browser to read them. The HeroForge quotes above come from those reads.

## Open questions for Harry

1. **ANSWERED 2026-10-05: 20k triangles with a bake.** See **Tested: the Import Lab**. The question as first asked: **Is 50–100k triangles with no bake good enough?** This is the before/after test you asked for, and it now has a sharper shape. Proposed test set: one HeroForge STL, one purchased dragon, one large set piece. For each, show the original beside (a) reduced to about 80k triangles, (b) reduced to about 15k triangles with a bake from Rig Bake or Needle, at table distance and at close zoom. If (a) passes, version one of the importer needs no bake at all.
2. **Does the size budget fit that?** An 80k-triangle model is a few megabytes. Twenty seats with a few imports each is small. A hundred imported monsters is not. What budget per object, and per campaign?
3. **HeroForge: ask to become a partner?** A file import gives a HeroForge player a grey mini and sits in a grey area of HeroForge's terms. The partner route gives colour and permission. It also means approaching a company, which is your call, and it puts an outside dependency into an open-source project. Options: (a) ask now, (b) ship file import and ask later, (c) never, and tell players plainly that file import of HeroForge models is on them.
4. **Do we say anything about HeroForge by name in the importer?** For example a line saying the STL will be uncoloured. Naming them invites the question of whether we are "authorized".
5. *(Harry marked copyright solved on 2026-10-05: lean on safe harbour. The terms line is still needed, so its wording is still to be written.)* **How strongly do we word the "you have the right to upload this" term**, given that nearly every purchased sculpt's licence says "do not share or host"? An honest term may tell most players that their dragon is not allowed. A vague one protects us less. This is a question for counsel, and it is the one that most affects what players actually experience.
6. **Should the converted copy be deliberately unprintable?** It nearly is already. Saying so, and keeping it so, is our best answer to a sculptor's worry. It would argue against ever offering a "high quality" import tier.
7. *(Still needed for safe harbour to apply; see Decided.)* **Register the DMCA agent now, at $6, before the fee rises to $25?** The cost is trivial either way. The real question is which legal entity registers, because its street address becomes public. That needs an answer from you before Fauna can file.
8. *(Probably moot: the importer now does the conversion itself and it passed Harry's test.)* **Do we recommend an outside conversion tool at all?** If version one does the reduction itself and question 1 passes, players never need one. If we do recommend one, we should test it on real files first.
9. **Should a takedown block re-upload of the same fingerprint?** Easy to build. A trivially altered file gets a new fingerprint, so it only stops honest repeats.
10. **Phones.** A multi-million-triangle file will probably fail to convert on a phone. Is "import from a computer" acceptable for version one?
