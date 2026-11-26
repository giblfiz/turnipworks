# Dinosaurs lane, 2026-11-07 (Fauna, Claude Opus 5.5)

Harry, 2026-11-07: "can we flesh out the set of dinosaur tokens? I notice you've got T-Rex and Triceratops, but let's get
our top 8 favorites all done. So Ankylosaurus, Spinosaurus, Stegosaurus, Pterodactyl, Brontosaurus, Quetzalcoatlus."
The parent session added a Velociraptor (the pack hunter, the most useful at the table). Seven new standing figures,
plus flying poses for the two pterosaurs (the flying-figures rule: a raised pawn wears its `fly` figure).

## Roster and sizes (spec_dinos.py -> set/assets.json)
| id | name | base (size) | height | ref plate |
|---|---|---|---|---|
| foe-velociraptor | Velociraptor | 5 ft (medium) | 5 ft | tyrannosaur |
| foe-ankylosaurus | Ankylosaurus | 15 ft (huge) | 6.5 ft | triceratops |
| foe-stegosaurus | Stegosaurus | 15 ft (huge) | 12 ft | triceratops |
| foe-spinosaurus | Spinosaurus | 15 ft (huge) | 15 ft | tyrannosaur |
| foe-brontosaurus | Brontosaurus | 20 ft (gargantuan) | 24 ft | triceratops |
| foe-pterodactyl (+fly) | Pterodactyl | 10 ft (large) | 6 ft | triceratops |
| foe-quetzalcoatlus (+fly) | Quetzalcoatlus | 15 ft (huge) | 16 ft | triceratops |
- Look matched to the set's two: moss-green / ochre hides, cream bellies, scaly, NO feathers (the set's STYLE bans
  feathers; the tyrannosaur is scaly). The velociraptor is the classic scaly look, an original design in the house palette.
- The compact cylinder grows with the base as the set's does (4 ft on 5, 8.5 on 10): 12.5 ft on 15, 17 on 20.
- The existing tyrannosaur and triceratops stay LARGE (10-ft base) as built: a question for Harry (5e has both Huge).

## Route: open weights end to end, ONE pod
fal's balance is empty and Codex's image quota is spent until 11-11, so the plates are painted by an open-weight model:
**Qwen-Image-Edit-2511** (Qwen team, Apache-2.0; diffusers QwenImageEditPlusPipeline, bf16, 40 steps, true CFG 4),
conditioned on the set's own accepted tyrannosaur plate (two-legged) or triceratops plate (four-legged), several seeds
per figure; the flying poses on the creature's own accepted standing plate. FLUX.1 [dev]/Kontext were ruled out by the
licence audit (experiments/2026-10-21-licence-audit: non-commercial running). The same pod then runs TRELLIS.2.
- pod/tools: the openmesh pod tools (cyberpunk lane copy), POD_NAME tw-dinos, `CDISK` env for the container disk.
- pod/qwen/setup_qwen.sh: a venv over the system torch (TRELLIS's env untouched), weights on the container disk (54 GB,
  57 s to download), not on the shared network volume. gen_qwen.py: jobs JSON -> out/<id>.s<seed>.png.
- plates.py: jobs / fetch (to USB) / gate (BiRefNet matte locally, Gemini via agy-run in batches, the set's two plates
  shown as the style yardstick; best-scored passing candidate wins).
- qa.py, publish.py: copies of the set's (via the cyberpunk lane). measure_fly.py: the fly lane's body-volume rule,
  writing this pack's OWN fly manifest (set/published/fly/manifest.json), which build_figures.py now reads.

## Log
- 17:22 pod mn8l6z243co8k3 (A100 80 GB, EUR-IS-1, $1.79/h; A100 stock there had just come back), timer 2.5 h + dead-man.
- 17:27 TRELLIS setup OK (232 s); Qwen-Image-Edit-2511 downloaded. First try of the venv failed on torch 2.4 (diffusers
  main wants torch.accelerator, 2.6+); fine once the TRELLIS setup had put torch 2.6 in the system.
- 17:29 round 1: 7 figures x 4 seeds, 86 s an image on the A100 (about 40 min).
- Gate, round 1 (Gemini, the set's two plates shown as the style yardstick): style "same" on every candidate, but
  **the edit model copies its reference's ANATOMY**: velociraptor 1/4 (three were small tyrannosaurs), stegosaurus 1/4
  (three missing a leg, spikes or with a ceratopsian head), ankylosaurus 0/4 (all four with a triceratops head and frill,
  no tail club), spinosaurus 0/4 (all four tyrannosaurs with a low ridge, not a sail). Accepted: velociraptor s101 (5/5),
  stegosaurus s104 (5/5).
- The fix (round 2, set/overrides-r2.json): TWO references chosen for the parts they SHARE with the target, and a negative
  prompt naming the bleed. Spinosaurus = the tyrannosaur's body and pose + the set's CROCODILE's long narrow snout;
  ankylosaurus = the accepted stegosaurus's low four-legged body + the set's BULETTE's armour plates, "NO neck frill, NO
  nose horn". Queued on the pod behind round 1 (one model on the GPU at a time). A queue bug on the way: `exec VAR=x cmd`
  is not bash (`exec env VAR=x cmd` is); caught on the pod before it fired.
- Gate, round 1 cont.: brontosaurus 4/4 pass (read "Camarasaurus" / "Brachiosaurus": a sauropod either way; s101 taken,
  5/5), pterodactyl 3/4 ("Pteranodon"; s101, 5/5), quetzalcoatlus 1/4 (s103, 5/5; the others dragged a wing, grew
  feathers or stood on two legs). Spare two-reference overrides for these three were written but not needed
  (set/overrides-spare-unused.json: elephant + stegosaurus, wyvern + giant bat, axe beak + wyvern).
- Gate, round 2 (the two-reference fix): spinosaurus 3/4 (s201: "long crocodile snout, a tall spiky dorsal sail", 5/5),
  ankylosaurus 2/4 (s204: "a straight tail ending in a large bony club", 5/5). **The lesson:** with an edit model, the
  reference is an anatomy donor as well as a style donor; choose it for the anatomy you WANT (a crocodile's jaw, a
  bulette's armour), never just for style, and name the unwanted donor's parts in the negative prompt.
- 18:22 round 3: the two flying poses, each conditioned on its own accepted standing plate (the fly lane's route), 4 seeds.
  Quetzalcoatlus 1/4 (s303, 5/5). Pterodactyl 0/4: every one a FLAT 2D cartoon with outlines (a big pose change from one
  reference made the edit model drop the 3D look). Round 4 (two refs: its own standing plate + the accepted flying
  quetzalcoatlus, "NOT a flat drawing" and a negative prompt): 0/4, crestless and still off-style. Round 5, a MINIMAL EDIT:
  the accepted flying quetzalcoatlus as the ONLY reference, "keep everything, change only the neck, head, crest and
  colours": 2/4, s503 accepted (5/5). Second lesson: an edit model is best at small edits of an image that is already
  right in pose and style; ask it for a big change and it loses the style.
- 18:39-19:19 TRELLIS.2 on the same pod (1024 cascade, 50k faces, 2048 px): 7 standing in one wave (3 resident workers,
  ~3 min each in parallel), then the two flying poses one at a time as their plates passed. 9 meshes, none re-meshed.
- QA (the set's rules, qa.py): 7/7 accept. Notes: brontosaurus REACH 9.7 ft outside its 20-ft square (neck and tail; about
  39 ft across), spinosaurus 3.7 and stegosaurus 3.6 outside their 15-ft squares (the set's tyrannosaur: 1.7 outside its 10);
  a lifted foot on the brontosaurus (1.1 ft) and quetzalcoatlus (1.3 ft). Outline vs plate (IoU) 0.81-0.90.
- **METAL** (found by the first in-game blind read: the spinosaurus "rendered solid black"): TRELLIS's PBR map made the
  spinosaurus fully metallic (mean metal 252/255), the velociraptor 157, the quetzalcoatlus 125 (the set's tyrannosaur:
  13). Metal with no environment to reflect renders near-black. matte.py sets glTF metallicFactor so the mean is 15
  (lossless, JSON chunk only); the tiers re-cut from the patched source keep it (checked). Worth adding to the figure
  QA for every pack: a metalness check (the set's triceratops is 84, fine; nothing over 100 in the set was checked).
  A trap on the way: `pod_prep.py home` copies when SIZES differ, so harvesting the last mesh overwrote the three patched
  sources with the pod's metallic originals; re-patched (deterministic: byte-identical to what QA measured).
- Flying poses (measure_fly.py, the fly lane's body-volume rule): pterodactyl span 11.6 ft, 9.2 ft tall (k 11.56, the
  standing body volume 48.75 ft3 kept); quetzalcoatlus span 23.2 ft, 20.0 ft tall (337 ft3). Both wider than their bases.
- 19:19 pod DELETED, verified twice (pod_down's GET, then pod/verify_gone.sh: gone, no pod named tw-dinos left).

## Spend log
(every dollar, with what it bought; pod/spend.log has the lines)
- RunPod pod mn8l6z243co8k3, 1x A100 80 GB, 17:22-19:19 = 1.952 h x $1.79 = **$3.49**. It bought: 52 plates (Qwen-Image-Edit,
  86 s each: 28 + 8 + 8 + 4 + 4 over five rounds) and 9 TRELLIS meshes. (Account balance moved $5.33 in that time: sibling
  lanes' pods bill the same account.) fal: $0 (empty). Codex: $0 (not used). Gemini reads: agy subscription, $0.
- **Per dinosaur** (pod time by GPU work: a plate 86 s, a mesh ~150 s, at $1.79/h; the rest of the uptime, $0.60 of setup, model
  loads and waits on the shared gate, spread evenly over the seven): velociraptor $0.33 (4 plates, 1 mesh), stegosaurus $0.33 (4 plates, 1 mesh), brontosaurus $0.33 (4 plates, 1 mesh), ankylosaurus $0.50 (8 plates, 1 mesh), spinosaurus $0.50 (8 plates, 1 mesh), pterodactyl $0.92 (16 plates, 2 meshes), quetzalcoatlus $0.58 (8 plates, 2 meshes). **Total $3.49.**

## Results
- Published: set/published/manifest.json (7 figures), set/published/fly/manifest.json (2 flying poses, this PACK's own fly
  manifest: build_figures.py now reads `<pack>/fly/manifest.json`). figures.json: 754 rows (747 + 7), 31 flying poses.
- In the game (table_shots.py, one figure a scene, turned 30 deg to the camera): 9/9 load, every one on its own disc, all
  drawn at the tyrannosaur's table scale; discs 4 / 8 / 12 / 16 ft. browser_dinos.py: the pterosaurs raised to 20 ft wear
  their flying pose, lowered stand again.
- Blind reads (Gemini, never told; the set's tyrannosaur and triceratops in the batch as control), three runs:
  LEANING IN (45 ft): 6/9 (v1: crops held neighbours: discarded), 8/9, 7/9. TABLE (110 ft): 6/9 (v1), 7/9, 5/9 (the
  control tyrannosaur read as "a frog" in that run: at 110 ft the reads are noisy). Steady: stegosaurus, ankylosaurus,
  triceratops, velociraptor (lean). Spinosaurus: "Spinosaurus" or "Dimetrodon" (the sail wins). Brontosaurus: a sauropod
  (Apatosaurus / Brachiosaurus) leaning in. **The standing pterosaurs** read as a crested duck-bill (Parasaurolophus) in
  some runs: wings folded, the crest dominates. A fourth lean-in run: 8/9 standing (only the standing pterodactyl wrong,
  "Parasaurolophus" again). (blind-*-v*.json and blind-v*.out; the v1 crops are in shots-v1/.)
- **Flying, raised to 20 ft** (table_shots.py --fly: each alone, the camera's focus lifted to the flyer): both read
  "Pteranodon" (0.95: "pointed beak, backward cranial crest, and membranous wings"): 2/2. Two framing traps on the way,
  both mine: the first flying crops came from browser_dinos.py's 3x3 grid (Gemini named the neighbours below), the
  second had the flyer above the top of the frame (the play camera looks at the ground).
- Velociraptor: scaly, unfeathered, an original design in the house palette (the set's STYLE bans feathers, and the
  tyrannosaur is scaly).

## After merging (for Fauna)
1. Copy the git-ignored binaries into main: `rsync -a --no-links --ignore-existing` of
   `experiments/2026-11-07-dinos/set/published/{tiers,thumbs}/`, `set/published/fly/{tiers,thumbs}/`, and the originals
   from `/mnt/usb/turnip-works/lanes-2026-11-07/dinos/models/` (set/published/models and fly/models are symlinks to it:
   recreate the links in main, or copy).
2. `python3 tools/spawn-tuner/build_figures.py` (figures.json is generated: after a rebase, rebuild it rather than merge).
3. `python3 tools/spawn-tuner/prep/delivery.py`, then the usual tuner deploy.
