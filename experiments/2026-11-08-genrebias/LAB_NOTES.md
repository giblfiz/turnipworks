# Genre bias in the command bar — lab notes (2026-11-08)

Harry: "The quick bar code needs to develop weight awareness of what genres are on the table and bias results that direction."
Design and numbers: docs/UI.md "The bar leans to the table's genre". Code: engine/client/genrebias.js (pure), wired in
engine/client/surfaces/bar.js (catalog and figure rows only) and engine/client/main.js (app.genres, app.genreProfile).

## Log
- Read the bar, barwords, library index, taxonomy, figures, pawntree. Genres come from types.json (fantasy / modern /
  cultures:<code>); a thing's genre from the type roles that list it (1177 fantasy-only, 191 modern-only, 159 one culture,
  45 both fantasy and modern, 59 none). Shared lists: solver2.js MOD_SHARED + MX_BORROW (exported modShared).
- Baseline browser_barcat.py on unchanged main code (= this worktree before any edit): hit@1 0.935, hit@3 0.988 on
  736 lines, and ONE FAILURE THAT PREDATES THIS LANE: the "must" line 'bar' (wants cmd:build.mod-bar; the figures win).
  NOTE: the corpus scene is not an empty table: it is a common room, a chapel, a temple building, a crate, a door and a
  Chinese pole lantern, i.e. a fantasy table. So the corpus runs WITH the tilt.
- Node bench (sim.mjs, the bar's scoring re-implemented over the dumped real catalog). First cut: additive tilt 40,
  neutral fit 0.5. Found: (a) a uniform tilt cannot both lift "chair" on a modern table (plain chair 110 vs office chair 62)
  and keep "car" first on a fantasy table (cart 90 vs car 100). Fix: only rows that NAME the thing (whole words) get a
  tilt; fragments get none. (b) the figure search's limit (8) cut off the modern guards behind 21 fantasy guards: with
  signal, rank the whole list with the tilt, then keep 8. (c) bar words as whole phrases only ("desk clutter" on the
  coffee cup is not "desk").
- Tilt 60 (needed: 48 at strength 0.95), KIN 0.25 (Japan table: own culture over fantasy kin).
- Neutral fit 0.5 pushed neutral things (plain chair, double bed, wall shelf, bar stool) under fantasy ones on a
  fantasy table. A thing of both genres fits both: neutral fit 1. Then on the corpus table (99% fantasy, 1% Chinese
  lantern) neutral (1.0) beat fantasy (0.9925) on every tie: neutral now fits exactly as well as the table's best genre.
  STAPLE regex caught tree-fruit ("fruit"): dropped "fruit", trees excluded.
- Section order uses the untilted score (s0), so the tilt never lifts the catalog over a command.
- browser_genrebias.py 21/21. Empty table byte-identical: --empty-html on the branch and on the stashed code before
  it (bar.js + main.js `git stash`), 579 lines (18 words + every gm/none corpus line), 0 differ.
- browser_barcat.py on the branch: hit@1 0.943, hit@3 0.989; 8 lines better, none worse (lamp, brazier, cage,
  pit trap, sign, bartender, fence, gate). The 'bar' must-miss is unchanged (predates).
- npm test: assets_page.test.mjs fails in this worktree only (git-ignored meshes missing); passes on main. The rest of
  the chain passes when run on after it.

## Tables built by the browser test
fantasy: a generated tavern (TAV, ~14 rooms, ~390 things): mix fantasy 1.00, strength 0.98
modern: a generated office tower (OFC, 5 rooms: lobby, rooftop, bathroom, restroom; ~72 things): mix modern 1.00, strength 0.94
mixed: both in one area: fantasy 0.74 / modern 0.26, strength 0.99 (proportional to amount: the tavern has 5x the things)

## Before / after (the real bar, GENRE_TILT 60; "without" = the profile stubbed to no signal, i.e. the bar as it was)
## fantasy table — mix fantasy 1.00, strength 0.98

| word | things, without | things, with | figures, without | figures, with |
|---|---|---|---|---|
| chair | chair-armed ·fan<br>chair-plain<br>chair-interrogation ·fan | chair-armed ·fan<br>chair-plain<br>chair-interrogation ·fan | foe-devil ·fan | foe-devil ·fan |
| table | table-kitchen-prep ·fan<br>table-round-small ·fan<br>table-square ·fan | table-kitchen-prep ·fan<br>table-round-small ·fan<br>table-square ·fan | cul-jpn-doshin ·JPN<br>cul-chn-vegetable-seller ·CHN<br>town-stable-hand ·fan | cul-jpn-doshin ·JPN<br>cul-chn-vegetable-seller ·CHN<br>town-stable-hand ·fan |
| bed | bed-double<br>bed-single ·fan<br>bed-canopy ·fan | bed-double<br>bed-single ·fan<br>bed-canopy ·fan | foe-demon ·fan<br>foe-devil ·fan | foe-demon ·fan<br>foe-devil ·fan |
| door | door-plank ·fan<br>door-reinforced ·fan<br>door-barn-double ·fan | door-plank ·fan<br>door-reinforced ·fan<br>door-barn-double ·fan | modern-bouncer-m ·mod | modern-bouncer-m ·mod |
| guard | mes-court-hip-guard ·MES<br>mil-guard-lantern ·fan<br>statue-guardian ·fan | mil-guard-lantern ·fan<br>mes-court-hip-guard ·MES<br>statue-guardian ·fan | town-orc-guard ·fan<br>town-dwarf-guard ·fan<br>town-elf-guard ·fan | town-orc-guard ·fan<br>town-dwarf-guard ·fan<br>town-elf-guard ·fan |
| soldier | mil-footlocker ·fan<br>bread-rye-dark ·fan<br>cup-leather ·fan | mil-footlocker ·fan<br>bread-rye-dark ·fan<br>cup-leather ·fan | town-soldier ·fan<br>foe-zombie-soldier ·fan<br>robot-soldier ·mod | town-soldier ·fan<br>foe-zombie-soldier ·fan<br>robot-soldier ·mod |
| lamp | lamp-floor ·mod<br>lamp-oil-brass ·fan<br>lamp-pole ·fan | lamp-oil-brass ·fan<br>lamp-pole ·fan<br>lamp-post-iron ·fan | — | — |
| shelf | shelf-wall<br>alch-reagent-shelf-tall ·fan<br>catacomb-shelf-bones ·fan | shelf-wall<br>alch-reagent-shelf-tall ·fan<br>catacomb-shelf-bones ·fan | — | — |
| bar | back-bar-shelves<br>counter-shop ·fan<br>bar-cart ·mod | back-bar-shelves<br>counter-shop ·fan<br>bar-counter | modern-bartender-m ·mod<br>town-barman ·fan<br>beast-warhorse | modern-bartender-m ·mod<br>town-barman ·fan<br>beast-warhorse |
| stool | stool-bar<br>stool-three-leg ·fan<br>stool-upholstered ·fan | stool-bar<br>stool-three-leg ·fan<br>stool-upholstered ·fan | — | — |
| bench | bench-garden ·fan<br>bench-long ·fan<br>bench-potting ·fan | bench-garden ·fan<br>bench-long ·fan<br>bench-potting ·fan | foe-giant-crab ·fan | foe-giant-crab ·fan |
| desk | desk-bureau ·fan<br>desk-partners ·fan<br>desk-phone ·mod | desk-bureau ·fan<br>desk-partners ·fan<br>desk-writing ·fan | — | — |
| cabinet | cabinet-china ·fan<br>cabinet-curios ·fan<br>filing-cabinet ·mod | cabinet-china ·fan<br>cabinet-curios ·fan<br>filing-cabinet ·mod | — | — |
| weapon | sword-long ·fan<br>sword-short ·fan<br>weapon-locker ·mod | sword-long ·fan<br>sword-short ·fan<br>weapon-rack ·fan | cyber-merc-ork-m ·mod<br>cyber-merc-dwarf-m ·mod<br>cyber-merc-troll-f ·mod | cyber-merc-ork-m ·mod<br>cyber-merc-dwarf-m ·mod<br>cyber-merc-troll-f ·mod |
| thug | bench-potting ·fan | bench-potting ·fan | foe-bandit-mace ·fan<br>foe-bandit-brute ·fan<br>hero-rogue-elf-m ·fan | foe-bandit-mace ·fan<br>foe-bandit-brute ·fan<br>hero-rogue-elf-m ·fan |
| bartender | — | — | modern-bartender-m ·mod<br>town-elf-innkeeper ·fan<br>town-innkeeper-m ·fan | town-elf-innkeeper ·fan<br>town-innkeeper-m ·fan<br>town-orc-innkeeper ·fan |
| window | wall-window-small<br>window-stained-glass ·fan<br>wall-glass-curtain ·mod | wall-window-small<br>window-stained-glass ·fan<br>flowerbox-window ·fan | — | — |
| sofa | sofa<br>sofa-salvaged ·mod<br>sofa-sectional ·mod | sofa<br>sofa-salvaged ·mod<br>sofa-sectional ·mod | — | — |

## modern table — mix modern 1.00, strength 0.94

| word | things, without | things, with | figures, without | figures, with |
|---|---|---|---|---|
| chair | chair-armed ·fan<br>chair-plain<br>chair-interrogation ·fan | chair-plain<br>lounge-chair ·mod<br>office-chair ·mod | foe-devil ·fan | foe-devil ·fan |
| table | table-kitchen-prep ·fan<br>table-round-small ·fan<br>table-square ·fan | table-billiards<br>table-cafe ·mod<br>table-dining ·mod | cul-jpn-doshin ·JPN<br>cul-chn-vegetable-seller ·CHN<br>town-stable-hand ·fan | cul-jpn-doshin ·JPN<br>cul-chn-vegetable-seller ·CHN<br>town-stable-hand ·fan |
| bed | bed-double<br>bed-single ·fan<br>bed-canopy ·fan | bed-double<br>bed-platform ·mod<br>bed-single ·fan | foe-demon ·fan<br>foe-devil ·fan | foe-demon ·fan<br>foe-devil ·fan |
| door | door-plank ·fan<br>door-reinforced ·fan<br>door-barn-double ·fan | door-flush ·mod<br>door-roller-shutter ·mod<br>door-shopfront ·mod | modern-bouncer-m ·mod | modern-bouncer-m ·mod |
| guard | mes-court-hip-guard ·MES<br>mil-guard-lantern ·fan<br>statue-guardian ·fan | mes-court-hip-guard ·MES<br>mil-guard-lantern ·fan<br>statue-guardian ·fan | town-orc-guard ·fan<br>town-dwarf-guard ·fan<br>town-elf-guard ·fan | modern-security-f ·mod<br>beast-dog<br>robot-soldier ·mod |
| soldier | mil-footlocker ·fan<br>bread-rye-dark ·fan<br>cup-leather ·fan | mil-footlocker ·fan<br>bread-rye-dark ·fan<br>cup-leather ·fan | town-soldier ·fan<br>foe-zombie-soldier ·fan<br>robot-soldier ·mod | robot-soldier ·mod<br>cyber-merc-ork-m ·mod<br>cyber-merc-dwarf-m ·mod |
| lamp | lamp-floor ·mod<br>lamp-oil-brass ·fan<br>lamp-pole ·fan | lamp-floor ·mod<br>oil-lamp<br>lamp-oil-brass ·fan | — | — |
| shelf | shelf-wall<br>alch-reagent-shelf-tall ·fan<br>catacomb-shelf-bones ·fan | shelf-wall<br>curio-shelf ·mod<br>alch-reagent-shelf-tall ·fan | — | — |
| bar | back-bar-shelves<br>counter-shop ·fan<br>bar-cart ·mod | back-bar-shelves<br>bar-cart ·mod<br>bar-counter | modern-bartender-m ·mod<br>town-barman ·fan<br>beast-warhorse | modern-bartender-m ·mod<br>town-barman ·fan<br>beast-warhorse |
| stool | stool-bar<br>stool-three-leg ·fan<br>stool-upholstered ·fan | stool-bar<br>stool-three-leg ·fan<br>stool-upholstered ·fan | — | — |
| bench | bench-garden ·fan<br>bench-long ·fan<br>bench-potting ·fan | bench-street<br>lobby-bench ·mod<br>bench-garden ·fan | foe-giant-crab ·fan | foe-giant-crab ·fan |
| desk | desk-bureau ·fan<br>desk-partners ·fan<br>desk-phone ·mod | desk-phone ·mod<br>cubicle-desk ·mod<br>reception-desk ·mod | — | — |
| cabinet | cabinet-china ·fan<br>cabinet-curios ·fan<br>filing-cabinet ·mod | filing-cabinet ·mod<br>med-cabinet ·mod<br>cabinet-china ·fan | — | — |
| weapon | sword-long ·fan<br>sword-short ·fan<br>weapon-locker ·mod | weapon-locker ·mod<br>sword-long ·fan<br>sword-short ·fan | cyber-merc-ork-m ·mod<br>cyber-merc-dwarf-m ·mod<br>cyber-merc-troll-f ·mod | cyber-merc-ork-m ·mod<br>cyber-merc-dwarf-m ·mod<br>cyber-merc-troll-f ·mod |
| thug | bench-potting ·fan | bench-potting ·fan | foe-bandit-mace ·fan<br>foe-bandit-brute ·fan<br>hero-rogue-elf-m ·fan | modern-ganger-m ·mod<br>modern-bouncer-m ·mod<br>modern-ganger-f ·mod |
| bartender | — | — | modern-bartender-m ·mod<br>town-elf-innkeeper ·fan<br>town-innkeeper-m ·fan | modern-bartender-m ·mod<br>town-elf-innkeeper ·fan<br>town-innkeeper-m ·fan |
| window | wall-window-small<br>window-stained-glass ·fan<br>wall-glass-curtain ·mod | wall-window-small<br>window-stained-glass ·fan<br>wall-glass-curtain ·mod | — | — |
| sofa | sofa<br>sofa-salvaged ·mod<br>sofa-sectional ·mod | sofa<br>sofa-salvaged ·mod<br>sofa-sectional ·mod | — | — |

## mixed table — mix fantasy 0.74, modern 0.26, strength 0.99

| word | things, without | things, with | figures, without | figures, with |
|---|---|---|---|---|
| chair | chair-armed ·fan<br>chair-plain<br>chair-interrogation ·fan | chair-armed ·fan<br>chair-plain<br>chair-interrogation ·fan | foe-devil ·fan | foe-devil ·fan |
| table | table-kitchen-prep ·fan<br>table-round-small ·fan<br>table-square ·fan | table-kitchen-prep ·fan<br>table-round-small ·fan<br>table-square ·fan | cul-jpn-doshin ·JPN<br>cul-chn-vegetable-seller ·CHN<br>town-stable-hand ·fan | cul-jpn-doshin ·JPN<br>cul-chn-vegetable-seller ·CHN<br>town-stable-hand ·fan |
| bed | bed-double<br>bed-single ·fan<br>bed-canopy ·fan | bed-double<br>bed-single ·fan<br>bed-canopy ·fan | foe-demon ·fan<br>foe-devil ·fan | foe-demon ·fan<br>foe-devil ·fan |
| door | door-plank ·fan<br>door-reinforced ·fan<br>door-barn-double ·fan | door-plank ·fan<br>door-reinforced ·fan<br>door-barn-double ·fan | modern-bouncer-m ·mod | modern-bouncer-m ·mod |
| guard | mes-court-hip-guard ·MES<br>mil-guard-lantern ·fan<br>statue-guardian ·fan | mil-guard-lantern ·fan<br>mes-court-hip-guard ·MES<br>statue-guardian ·fan | town-orc-guard ·fan<br>town-dwarf-guard ·fan<br>town-elf-guard ·fan | town-orc-guard ·fan<br>town-dwarf-guard ·fan<br>town-elf-guard ·fan |
| soldier | mil-footlocker ·fan<br>bread-rye-dark ·fan<br>cup-leather ·fan | mil-footlocker ·fan<br>bread-rye-dark ·fan<br>cup-leather ·fan | town-soldier ·fan<br>foe-zombie-soldier ·fan<br>robot-soldier ·mod | town-soldier ·fan<br>foe-zombie-soldier ·fan<br>robot-soldier ·mod |
| lamp | lamp-floor ·mod<br>lamp-oil-brass ·fan<br>lamp-pole ·fan | lamp-oil-brass ·fan<br>lamp-pole ·fan<br>lamp-post-iron ·fan | — | — |
| shelf | shelf-wall<br>alch-reagent-shelf-tall ·fan<br>catacomb-shelf-bones ·fan | shelf-wall<br>alch-reagent-shelf-tall ·fan<br>catacomb-shelf-bones ·fan | — | — |
| bar | back-bar-shelves<br>counter-shop ·fan<br>bar-cart ·mod | back-bar-shelves<br>counter-shop ·fan<br>bar-counter | modern-bartender-m ·mod<br>town-barman ·fan<br>beast-warhorse | modern-bartender-m ·mod<br>town-barman ·fan<br>beast-warhorse |
| stool | stool-bar<br>stool-three-leg ·fan<br>stool-upholstered ·fan | stool-bar<br>stool-three-leg ·fan<br>stool-upholstered ·fan | — | — |
| bench | bench-garden ·fan<br>bench-long ·fan<br>bench-potting ·fan | bench-garden ·fan<br>bench-long ·fan<br>bench-potting ·fan | foe-giant-crab ·fan | foe-giant-crab ·fan |
| desk | desk-bureau ·fan<br>desk-partners ·fan<br>desk-phone ·mod | desk-bureau ·fan<br>desk-partners ·fan<br>desk-writing ·fan | — | — |
| cabinet | cabinet-china ·fan<br>cabinet-curios ·fan<br>filing-cabinet ·mod | cabinet-china ·fan<br>cabinet-curios ·fan<br>filing-cabinet ·mod | — | — |
| weapon | sword-long ·fan<br>sword-short ·fan<br>weapon-locker ·mod | sword-long ·fan<br>sword-short ·fan<br>weapon-rack ·fan | cyber-merc-ork-m ·mod<br>cyber-merc-dwarf-m ·mod<br>cyber-merc-troll-f ·mod | cyber-merc-ork-m ·mod<br>cyber-merc-dwarf-m ·mod<br>cyber-merc-troll-f ·mod |
| thug | bench-potting ·fan | bench-potting ·fan | foe-bandit-mace ·fan<br>foe-bandit-brute ·fan<br>hero-rogue-elf-m ·fan | foe-bandit-mace ·fan<br>foe-bandit-brute ·fan<br>hero-rogue-elf-m ·fan |
| bartender | — | — | modern-bartender-m ·mod<br>town-elf-innkeeper ·fan<br>town-innkeeper-m ·fan | town-elf-innkeeper ·fan<br>town-innkeeper-m ·fan<br>town-orc-innkeeper ·fan |
| window | wall-window-small<br>window-stained-glass ·fan<br>wall-glass-curtain ·mod | wall-window-small<br>window-stained-glass ·fan<br>flowerbox-window ·fan | — | — |
| sofa | sofa<br>sofa-salvaged ·mod<br>sofa-sectional ·mod | sofa<br>sofa-salvaged ·mod<br>sofa-sectional ·mod | — | — |
(The mark after an id is its genre: fan, mod, or a culture code; no mark: neutral.)

## Known limits (not fixed: vocabulary, which would change the empty table)
- "light": only modern things have the word (fluorescent tube, strip light); fantasy lights never say "light".
- "window": no modern window names the word (the glass curtain wall says "window wall").
- "weapon" figures: only the cyber mercenaries' tags say "weapon"; a fantasy table cannot pick fantasy fighters by it.
- A Regional table: "lantern" still gives the neutral hand lantern before the Japanese stone lantern (62 + tilt vs 90 + tilt).

## Files
- USB: /mnt/usb/turnip-works/lanes-2026-11-08/genrebias/ (run2/top3.md + top3.json, barcat-branch2/, baseline-main/, empty-*.json)
- sim.mjs: the node tuning bench (node experiments/2026-11-08-genrebias/sim.mjs <inventory.json>)
