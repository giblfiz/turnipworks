# Culture pawns, 2026-11-07 (lane culture-pawns)

Harry, 2026-11-07: "probably need some pawns by culture. We don't need the full DND grid, just some NPCs, and a armored
fighter, rouge-like, and caster for each race." **"Race" is read as each culture pack** of the room packs (wiki
projects/3d-vtt/culture-packs-a, -b): Japan (late-Edo Kyoto), China (mid-Qing Beijing), India (18th-c. Jaipur-Amber),
Norse (Viking Age), Mamluk (Cairo/Damascus, 14th c.), Rus' (12th c. Novgorod/Kyiv), Mexica (Tenochtitlan c.1500), each
on the same period and place as its rooms. Seven figures each: an armoured fighter, a rogue, a caster rooted in the
culture's own tradition, four NPCs. 49 in all; 16 women.

## Files
- `roster.py` -> `roster.json`: the roster (designs as first written, then `SENS`, the sensitivity read's changes as
  overrides, so both stay on the record). `specs.py` -> `set/assets.json`: plate prompts in the figure set's words.
- `plates.py` (Codex image tool, BiRefNet matte), `gate.py` (Gemini, batched), `pod/` (the RunPod tools, renamed
  tw-culture-pawns / culturepawns), `qa.py` + `publish.py` (copies of the 10-06 set's, pointed at set/).
- Big things on USB: `/mnt/usb/turnip-works/lanes-2026-11-07/culture-pawns/` (work/ = every plate try, set/{inputs,
  masked,models,tiers} = the set's binaries; set/ here links to them).

## Log
- 07:40 roster written (49). 07:42 codex sensitivity read sent (sens/prompt.md), BEFORE any plate.
- 07:49 codex answered (sens/codex-final.md, sens/codex.json): 22 ok, 23 minor changes, 2 major (the mandarin's blank
  badge; the kathputli's legs and control bar), 2 replaced (the 'ayyar: the brotherhood is better attested for Iraq/Iran
  than Mamluk Cairo; the ushkuinik: a 14th-c. identity in a 12th-c. pack). Adopted as `SENS` in roster.py; see below.

## The sensitivity read, adopted (roster.py SENS)
- Replaced: the 'ayyar -> **Mamluk street thief** (ordinary working dress, face open; codex: the brotherhood is better
  attested for Iraq and Iran, and a masked figure with a curved dagger is the Orientalist painting's rogue); the
  ushkuinik -> **Rus' river raider** (the ushkuiniki are 14th c.; river raiding in the 12th is not in doubt).
- Major: the mandarin's blank badge is not a rank badge. Codex advised informal dress; I kept the official's look and
  made it ONE coherent rank instead (fifth civil: silver pheasant badge, crystal finial, court beads, a black surcoat,
  no imperial yellow), because at table distance only badge, beads and hat say "official". **A taste call for Harry.**
  The kathputli puppeteer now cradles a legless puppet (kathputli have none) with no control bar.
- Minor, all adopted: the onmyoji holds a closed almanac (not an antiquarian divination board); the jyotishi's sacred
  thread is not shown over the closed robe and the astrolabe gets relief rings; the Daoist is a ritual specialist with a
  handbell; Manchu lady without the late-Qing hair board; bark shoes and chin-tied scarves out of Rus' (Novgorod's
  digs are leather shoes), kolty hang from the headdress; the völva's catskin hood (a later Icelandic text) out, an iron
  staff with a solid finial in; the Norse smith loses the modern-Viking sleeveless look; the jaguar suit is featherwork;
  the cihuapilli's skirt is a wrapped cueitl; olive greens, never teal; merchants not all fat and pleased, villagers not
  all cheerful, noblewomen not all proud.
- **Where I did not follow codex:** it took the blades out of the rogues' hands (a spy is not an assassin). Harry asked
  for "rouge-like", and at table distance a rogue is read by a hood and a short blade, so each keeps a short plain blade
  held LOW, point down, face open. The blind reads say whether they still read as rogues.
- Names: the culture's word first ("Norse smith"), so "smith" typed in the bar still finds the house's smith; tiles say
  "Smith" under the Norse heading. Headings: Japan, China, India, Norse, **Mamluk** (codex: "Middle East" hides the
  distinctions), Rus', Mexica. Search words include Kyiv (and Kiev).

## Plates (Codex image tool, $0) and the batched gate (agy-run, $0)
- 07:55 pilot of 4 (samurai, thakurani, völva, jaguar warrior): all four passed the gate on the first try, each read
  blind as the right culture and role ("Japanese / warrior", "Rajput / noble", "Norse / priest-magic-user", "Aztec /
  warrior"). Then the other 45 on 6 Codex workers; drive.sh judges six to a call and repaints refusals.
- 08:15 the shared agy lock: my first batch of six waited 17 minutes in line behind three other lanes. So, as the
  culture-packs-a lane learnt: **mesh first, judge the mesh**. pod_prep.py now sends every painted plate whose matte
  passed (unless the gate refused that very try). The batch already in line (17 plates) is let finish; no more plate
  gates after it: the stills' blind reads at table scale (which Harry asked for anyway) are the gate, and they decide what
  is kept and what is painted again. Japan's seven: all accepted, each read blind as Japanese and its role.

## RunPod (one pod; spend in pod/spend.log)
- 08:00 EUR-IS-1 (the TRELLIS cache volume's data centre) had no 4090 and no A100 at first (the cyber-pawns lane holds
  one); pod/pod_wait.sh asked every 90 s and made THE pod when a 4090 showed: ewc4tdkyxrdp4t, $0.89/h, deletion timer
  2 h (worst case $1.78) and the pod-side dead-man switch.

## Cost estimate (before any spend)
- Plates and reads: $0 (ChatGPT plan, Gemini subscription). Meshes: ONE RunPod pod; the flying-pose lane made 25 figure
  meshes on a 4090 in 0.92 h for $0.81 (1024 cascade, 2048 px). 49 + ~6 re-rolls: about 1.2 h, **about $1.10-1.60**.
  Hard cap I hold myself to: $5.
- 08:08 setup OK in 393 s; wave 1: all 49 plates (every plate painted on its first try, every matte passed), one worker,
  1024 cascade, 2048 px. Median 46 s a mesh, mean 61, model load 145 s.
- 08:20 interim harvest of 8: QA (the set's own measure/set_qa rules) accepts 7; the Manchu lady goes back for a new seed
  (3% of the visible surface unpainted, two floating pieces, the largest 0.89 ft). The 7 published, thumbnailed and shot.
- 08:22 the redundant plate gate stopped by PID (its second batch had waited 16 min in the agy line, five other calls ahead).

## Merging with the cyberpunk-pawns lane (same day, same files)
At 08:15 I read the cyberpunk lane's worktree (uncommitted): it had built the same idea in the same files: packs found by
glob (`PACK_GLOB = experiments/*/set/published/manifest.json`, `find_packs`, `--no-packs`), and a list of letters a
Pawns-menu root may not take (`ROOT_KEYS_TAKEN`, with B). Two designs of one thing would make Fauna's merge a judgment
call, so mine now IS theirs: my folder renamed figset -> set, their build_figures.py taken verbatim plus my two hunks
(pass `setting`/`kin`/`genre`/`role`/`tile` through; keep built flying poses), their ROOT_KEYS_TAKEN and hot() verbatim,
my test renamed pawntree_genres.test.mjs (theirs is pawntree.test.mjs). Note for them in the session scratchpad
(pawns-coord-1107.md). Remaining overlap at merge: browser_pawnsmenu.py's two root-list checks (union: theirs add
Y:Cyberpunk, D:Modern; mine add U:Cultures when culture figures exist) and the PAWN_TREE array's tail (both append).

## SCOPE CHANGE 08:25: the full grid (Harry, relayed by Fauna)
"each race was dragon born /dwarf/ect. So our grid needs a hindu-teifling-warrior option." So: culture x the house
set's seven races x {armoured fighter, rogue, caster}, plus the four NPCs a culture (human): 7 x 25 = **175 figures**.
The genre is now **Regional** (build_types.py GENRES; key `cultures` kept). Order: India's full grid first, end to end,
its contact sheet on USB, then the rest. Budget pre-approved: about $10-20.
- grid.py: per culture and role ONE race-neutral dress and three KITS cycled over elf, dwarf, small-folk, orc, tiefling,
  dragonborn (so a row is not six clones); the race's body sentence and body plate are the house set's own; colouring
  varied per culture; genders alternate (79 women of 175). Names put the place first, never a religion: "Rajasthani
  tiefling spear warrior" (Harry's "hindu tiefling warrior"; codex agrees: dress does not establish a religion).
- 08:26 second codex read, of the grid (sens2/prompt.md -> sens2/codex-final.md, codex.json), BEFORE any grid plate:
  keep all 126 race x culture x role combinations ("removing prestigious or learned roles from those races would
  undermine the premise"; an orc jaguar warrior, a tiefling day-count reader, a tiefling Daoist are fine as sincere
  practitioners), and fold in: Mexica women in huipilli and cueitl (not the men's mantle); the jaguar and eagle suits as
  MANUFACTURED garments, the wearer's own face distinct in the helmet, no blood, torn hide or crouch; the Kyoto physician
  and the Beijing physician and geomancer in their own dress, not the diviner's or the Daoist's; no butterfly swords in
  1770 Beijing; the Chinese rogue's jian -> a short knife (the low-blade rule); a Norse man's tunic beside the seer's gown;
  paper, not palm-leaf, manuscripts and leather slippers, not wooden sandals, at the Jaipur court; a tanto, not a
  wakizashi, for the Japanese spy (also folded into the human spy's prompt; its plate was already painted and passed);
  "Mamluk-era" in the period line (not every Cairene was a mamluk); helmets fitted over horns. No ancestry gets a
  morality tag anywhere (none had one).
- 08:33 India's 18 grid plates sent to Codex (6 workers).
- 08:47 wave 1 done: 49 meshes, median 42 s, mean 44. QA accepts 47; the Manchu lady and the thakurani go back for a
  new seed (floating pieces). India's grid (18) meshed 08:48-09:00 behind it (QUEUE=1, one GPU); QA accepts 17 (the
  elf warrior: a 1.7-ft floating piece).
- 09:03 India end to end: 23 of 25 published, thumbnailed, shot (stills/trio/IND-<race>.png at table distance), on the
  contact sheet **/mnt/usb/turnip-works/lanes-2026-11-07/culture-pawns/stills/contact-IND.png** (a row per race, a
  column per role; the two gaps are being re-made). Pawns menu checked in the browser (browser_pawnsmenu TREE, MINE:
  73/73): Place a pawn ▸ R Regional ▸ India ▸ Tiefling ▸ the warrior, the scout, the astrologer; nothing scrolls
  sideways; shots in /mnt/usb/turnip-works/lanes-2026-11-07/culture-pawns/menu/.
- 09:04 the other six cultures' 108 grid plates (all painted first try, every matte passed) queued as one wave.
- 09:05 the second meshes of the Manchu lady and the thakurani failed the same way (2-ft floating piece: the veil, the
  fan): QA rejects -> both repainted with "everything one connected solid shape" corrections; queued with the elf
  warrior's new seed after the grid.
- 09:37 the first blind reads at table scale (Gemini via agy, 12 pictures in one call, cultures mixed, roles shuffled
  left to right per picture, a race's three or a culture's four NPCs per picture): every role named right (41/41);
  culture named first 10/12, in either guess 11/12. The misses: the Rus' fighter / raider / healer read "Norman, 11th-12th
  c." (the conical helm and almond shield are shared; nothing to fix at this scale), the Norse NPCs first read "Germanic"
  (Norse second). Periods drift (Qing read "Song/Ming", Mamluk "Abbasid"); the culture holds. No stereotype flagged.
- 09:45 104 published (India, China, Japan grids). Mesh QA re-seeds so far: Chinese halfling scout, Japanese elf onmyoji
  and spy, Mamluk dragonborn scout (reroll3, queued), Indian elf warrior (reroll2).
- 10:19 India's race rows read blind as **Ottoman** (5 of 5; the human Rajput row had read "Indian (Mughal/Rajput)"): on a
  non-human body the studded coat and the mail-curtained spiked helmet say Ottoman. That is what India-first was for.
  India's grid dress now carries what says Rajasthan at table distance: a big wrapped pagri turban in leheriya or
  bandhani dyes (no Ottoman/Persian helmet, no mail curtain), the coat flaring like a skirt, a saffron patka sash, pointed
  jutti shoes; the women casters in ghagra, choli and a bandhani odhni. (No new codex read for this: regional dress
  inside the approved frame, no religious or sacred element added.) All 18 repainted and re-meshed (wave z-ind2).
- 10:42 **a renderer bug, mine**: the set's `y0` is already in feet (10-06 measure.py), and render_table.py scaled it
  again, so every table still showed its figure floating about 10 ft over its base (Gemini: "figures placed behind
  bases"). Fixed and checked by measurement (bounding box: feet at the disc's top, 0.30 ft, top at 0.3 + height x 0.67 to
  0.1 ft); every trio re-rendered; the 17 reads made of floating figures kept aside (reads_trio_floating.json,
  READS_GRID_floating.md: roles still 56/56 there) and all 56 pictures read again.
- 10:47 last meshes: the repainted Manchu lady and thakurani pass (the veil and the fan were the floating pieces: "one
  connected solid shape" fixed it); the Chinese halfling scout repainted (4% unpainted twice) passes; the Rus' dragonborn
  healer re-seeded passes. **175 of 175 accepted by the set's own QA.**
- 10:50 **pod down**, verified gone twice (pod_down.sh's own check, then verify_gone.sh: "gone", no tw-culture-pawns
  pods). 2.824 h x $0.89 = **$2.51** for 175 figures + 8 re-meshes + 18 India re-meshes (201 meshes; median 42 s).

## Money
| what | $ |
|---|---|
| RunPod, RTX 4090 pod ewc4tdkyxrdp4t, 08:00-10:50, 201 meshes; deleted, verified gone twice | 2.51 |
| RunPod, A100 pod va26uvcil3v32h (after the first was gone), 11:34-12:03, 19 meshes (Mexica redo); deleted, verified twice | 0.85 |
| Codex plates (ChatGPT plan: 175 + 21 repaints), codex sensitivity reads x2, Gemini reads (agy subscription) | 0 |
| fal | 0 |
| **total** | **3.36** (about $0.02 a figure; 220 meshes) |
- 11:46 all 56 pictures read blind (corrected stills; READS_GRID.md): culture first guess 35/56, in either guess 39/56,
  race 41/56, roles 144/175 (82%; a missed role is mostly a rogue or caster read as "NPC"). India 8/8 after its fix;
  Japan 7/8, Mamluk 7/8, China 6/8; **Mexica 4/8** (race rows read Greco-Roman, Polynesian, Andean); **Norse 3/8**
  (read "Western European / Anglo-Saxon / Norman": the same material culture at this size); **Rus' 0/8** (read
  "Anglo-Norman / Western European": 12th-century Rus' dress IS close to it; making it louder pulls toward the 19th-c.
  folk costume the first sensitivity read warned off, so it is left, a question for Harry).
- 11:30 Mexica given the India treatment: big green-stone ear spools, bold flat red-black-ochre geometric bands, a SHORT
  cloak knotted on one shoulder, bare legs; the third fighter kit a cuextecatl war suit (red featherwork, conical cap:
  one of the Codex Mendoza's warrior suits) instead of plain quilting. 18 repainted.
- 11:34 a SECOND pod (the first was deleted and verified gone at 10:50; never two at once): EUR-IS-1 had no 4090, an
  A100 showed (pod2/pod_wait.sh), va26uvcil3v32h $1.79/h, 3 resident workers; 18 Mexica meshes + one re-seed; QA
  175/175. Deleted 12:03, verified gone twice: 0.474 h x $1.79 = **$0.85**. Lane total **$3.36**.
- 12:08 Mexica re-read after its fix: 5 of 6 race rows "Aztec (Mexica)", the sixth "Mixtec, Postclassic" (before: 1 of 6;
  Greco-Roman, Polynesian, Andean). The earlier Mexica reads kept in reads_trio_mes_before.json.
