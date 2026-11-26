# Cyberpunk pawns lane, 2026-11-07 (Fauna, Claude Opus 5.5)

Harry, 2026-11-07: "Did we make a pawn pack for shadowrun? Just like decker/street sam/shaman/mage whatever orc / dwarf/
troll. Also NPCs for modern. And while we are at it add a robot race." We had not: no cyberpunk figure existed. The room
pack is "Cyberpunk" (another lane renames it and builds rooms); this lane makes figures only.

## Route (the default figure set's, run as a pack in this folder)
- `spec_cyber.py` -> `set/assets.json`: the set's own spec code (`../2026-10-06-figures/set_spec.py`: `fig`, poses,
  must-nots, body-reference heads) read without editing it, with this pack's STYLE (the set's words plus cyberpunk
  accents: magenta, lime, amber; guns oversized and bright; cyberware as thick chrome plates; no text, logos, insignia
  or crosses; the blue-mask rule kept). An archetype KIT is written once and worn by every body that has it.
- `plates.py`: Codex's built-in image tool (ChatGPT plan, $0), BiRefNet matte, the gate on Gemini through agy-run in
  BATCHES of up to 5 plates a call (agy is a shared queue). Work files on USB (`set/work` -> USB).
- `pod_prep.py` + `pod/tools` (the fly lane's openmesh pod tools, POD_NAME tw-cyber-pawns): TRELLIS.2 1024 cascade,
  50k faces, 2048 px on ONE RTX 4090 pod.
- `qa.py` (copy of set_qa.py: measure, rules, two tiers), `publish.py` (copy of the set's: runner and robot = hero tier
  20k/1024, modern NPCs horde tier 8k/512), the set's `thumbs.py`, then `tools/spawn-tuner/build_figures.py`, which now
  reads every pack at `experiments/*/set/published/manifest.json` (this folder's first).

## Roster (53 figures + 3 body references)
- **Runners (27, group runner)**: street samurai x4, decker x3, rigger x3 (a small drone on the shoulder), mage x3,
  shaman x3, physical adept x3, face x3, technomancer x2, mercenary x3. Metatypes: human 8, elf 5, dwarf 5, ork 5,
  troll 4; men 14, women 13. Trolls are Large (10-ft base, 8.2-8.5 ft). Orks use the set's orc body (grey-green): an ork
  runner and an orc fighter are one people (a taste call for Harry; the default built).
- **Modern NPCs (16, group modern)**: police x2, corporate security, tactical (SWAT), executive x2, ganger x2,
  bartender, street food vendor, street doctor, fixer, office worker, commuter, journalist, club bouncer (troll, Large).
- **Robots (10, group robot, race robot)**: combat robot (fighter), war robot (Large, a cannon arm: the heavy),
  android infiltrator and stealth robot (rogue), hacker robot and medic robot (caster / support), utility robot (tracks),
  security drone (four legs), rotor drone (landed), service android (butler). One robot body reference plate makes the
  humanoids one people (grey steel, orange plates, one magenta visor band).
- New body references (never meshed): troll man, troll woman (against the set's orc bodies), robot.

## Sensitivity read (codex exec, before any plate; `sens/`)
52 of 56 needed no change. Flagged: the first shaman kit (bear spirit guide, bear pelt and skull hood, fetish stick,
hide rattle) as "a generalized Indigenous-spirituality stereotype"; and the noodle vendor's chopsticks standing upright
in the bowl (a funerary image in East Asian contexts). Both rewritten: the shaman is now an URBAN street shaman (a
patched canvas coat sewn with junk charms, a raven on the shoulder, a rebar staff topped with keys and bells; no skulls,
pelts, feathers, face paint or religious symbols); the chopsticks lie across the rim. A second read of the new shaman:
"passes ... no replacement wording is necessary". Trademark words (shadowrun, netrunner, ripperdoc, replicant,
"Mr. Johnson") are kept out of the figures' names and tags: search words only, in `engine/client/barwords.js`.

## Cost estimate (before any spend)
Plates and gates $0 (ChatGPT plan, agy subscription). Meshes: about 53 + 8 re-rolls on ONE RTX 4090 ($0.89/h): about
45 s a mesh + 150 s model load a wave, so about 1 h of pod = **about $1**. Hard cap I hold myself to: $6.

## Spend log
(every dollar, with what it bought; pod/spend.log has the lines)
- 07:57 the first `pod_up.sh` was refused by RunPod (no RTX 4090 or A100 in EUR-IS-1, where the TRELLIS volume is): no
  pod, $0. Second try 07:58: pod `pttrq2bu668tgw` (tw-cyber-pawns, 1x RTX 4090, $0.89/h), both deletion timers armed.
- Extended three times by 60 min (08:58, 09:44, 10:31): the plates' gate waited in the shared agy queue (up to 14
  reads from six lanes queued; a batch of 12 plates waited 30-45 min for its turn), so the pod idled between waves.
- 11:12 **pod deleted: 3.221 h x $0.89 = $2.87** for 55 meshes (53 figures + 2 re-meshes: troll adept 5% unpainted,
  war robot 3 loose pieces; both passed on the second seed). Verified gone twice: pod_down.sh's GET, then
  pod/verify_gone.sh on its own ("gone", no pod named tw-cyber-pawns left). (The account balance moved $7.45 in that
  time: sibling lanes' pods bill the same account.)
- Plates (Codex, ChatGPT plan) and every Gemini read (agy-run subscription): $0. fal: not used.
- **Total: $2.87** (estimate was about $1; the difference is the idle pod while plates waited for the shared gate).

## Runs
- 07:50 bodies: troll man, troll woman, robot: all three accepted on try 1 (gate: "a stout horned troll woman in a
  cream vest top ...", "a humanoid robot composed of grey steel and orange plating with a single visor band").
- 07:58 the 53 plates started (6 Codex painters, gate batches of 5).
- 08:12 the painters had finished 39 plates while the gate (one agy call per 5 plates, behind other lanes) had read
  15: plates.py was stopped and taught to RESUME (a painted plate with no verdict goes straight to the gate) and run
  with batches of 12. Every plate was painted once before any second try.
- Plates, final: 56 of 56 accepted (53 figures + 3 bodies), 52 on try 1. Second tries: human decker (legs fused), human
  face (phone not at the face), bouncer (legs fused); third: troll mercenary (the gun's muzzle cut off by the frame,
  twice: an 8.2-ft troll holding a gun above her head).
- Meshes: five waves on the pod as plates were accepted (14, 10, 12, 11, 4, then 1 + 1; mesh median 58 s, model
  load about 170 s a wave). QA (`qa.py`, the set's rules): 53 of 53 accept after the two re-meshes. Notes only: 15
  have small separate shells lying within 0.1 ft of the body (how the generator builds pouches and plates); the war
  robot and the utility robot have one foot 0.16 / 0.26 ft off the ground. Tiers: hero 20k/1024 (runners, robots;
  median 1.1 MB), horde 8k/512 (modern NPCs; median 0.48 MB).
- In the game (`table_shots.py`, local relay on 18431/18437, a modern street, furniture under the pawns cleared):
  53 of 53 load, every one stands exactly on its disc (0.00 ft); trolls, the bouncer and the war robot on 8-ft discs
  (Large). Stills: `/mnt/usb/turnip-works/lanes-2026-11-07/cyberpunk-pawns/stills/game/`.

## Blind reads in the game (Gemini via agy-run, batched 12-18 crops a call, random neutral names; `blind.py`)
Each figure framed alone on the modern street, never told what it is; asked for its people (human, elf, dwarf, ork,
troll, robot, other) and, for a runner, one of the nine archetypes (closed list) or "not a runner", plus a role.
The first crops (`-lean`, 560 px; `-table`, 260 px) also held the neighbours 10 ft away and some reads were plainly of
a neighbour (a robot medic "holding an assault rifle"), so the scored reads are the tight centre crops of the same
shots (`-leanc` 360 px, `-tablec` 150 px; 1.45x for Large figures), the game's own pixel scale, no neighbour inside.

| | leaning in (45 ft, 38 deg) | table distance (110 ft, 58 deg) |
|---|---|---|
| runners: metatype right | **25/27** | 13/27 |
| runners: archetype right | **23/27** | 9/27 |
| runners: both | **22/27** | 5/27 |
| modern NPCs: people right | 13/16 | 11/16 |
| robots: people "robot" | 6/10 | 4/10 |

- Leaning in, the misses are the expected ones: both technomancers called deckers (a data cube vs a deck, both
  hackers), the ork face a decker, the ork rigger a shaman (drone read as a familiar), the ork mercenary human (helmet).
  Roles of the NPCs are named in plain words: bartender, bouncer, SWAT officer, doctor, ganger, police officer, waiter.
- **Robots:** the machine-shaped ones read as robots every time (war robot, utility robot, security drone, rotor drone,
  hacker, medic); the HUMANOID ones (combat robot, stealth robot, butler) read as an armoured human, "street samurai",
  "waiter", by role, not as machines; the android infiltrator reads human (by design: half its face is chrome).
- **At table distance the figures are about 45 px tall**, and archetype and metatype mostly go (trolls still read
  troll; deckers' decks and the war robot hold up). The default figure set is the same there (its staffs vanish at
  table distance, README of 2026-10-06); I did not try to fix this for the pack.
- The Pawns menu stills (browser_pawnsmenu --shots), Gemini, labels first: Cyberpunk > S Street samurai, D Decker,
  R Rigger, M Mage, H Shaman, Y Physical adept, F Face, T Technomancer, E Mercenary, O Robots; every tile has its
  picture; no horizontal scrollbar; the "Pawns" chip's icon is broken in this worktree only (data/icons is git-ignored
  and not linked here: environmental).

## For Harry (defaults built)
1. Orks are the set's grey-green orcs (one people with the fantasy orcs). Alternative: human-toned orks (a body plate
   and 5 + 2 repaints, about $0.50 of pod).
2. The humanoid robots read as armoured people at play distance. Default: as built (grey steel, orange plates, magenta
   visor band). Alternative: repaint the 4 humanoids with an unmistakably machine head (a dome with one big eye lens,
   antenna) and bare chrome limbs: $0 of plates, about $0.40 of pod.
3. The shaman is an urban street shaman (junk charms, raven, rebar staff), after the sensitivity read refused the
   bear-totem version. It reads "shaman" 3/3 leaning in.

## Rebased on main ebaa3a49 (culture pawns landed), 12:50
- Conflicts: pawntree.js (my races and Cyberpunk / Modern roots, then the culture lane's genre entry; ROOT_KEYS_TAKEN
  is the same list on both sides; Regional takes R, no clash: H T M A Y D R), browser_pawnsmenu.py (the union: H, T,
  M, A, Y:Cyberpunk, D:Modern, then the regional root when culture figures are present), test_matrix.json and
  docs/PAWNS.md (both sides), build_figures.py (main's: the culture fields passed through, fly rows kept when their
  source is gone). figures.json: main's taken, then regenerated by build_figures.py (it sees the culture pack's
  binaries in the main checkout): 694 rows of main unchanged, 53 added, 747 in all, 29 fly rows kept.
- "samurai" found the street samurai before the culture pack's Japanese samurai (figsearch 71/73): the bare tag
  "samurai" is dropped from the street samurai ("street samurai", "street sam" stay).
- The figure review page (../2026-10-06-figures/build_review.py) picks up this set by its default glob: `review_inputs.py`
  writes set/gate.json and set/plates.json (plates point at the USB copy of the accepted plates), and build_review.py
  knows the groups runner, modern, robot. Tried with both lane sets: 747/747 meshes and plates.
- After the rebase: pawntree 62/62, pawntree_genres 45/45, figsearch 73/73, browser_pawnsmenu 192/192.
