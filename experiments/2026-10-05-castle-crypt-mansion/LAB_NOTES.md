# Castle, Crypt, Mansion + the vertical kit (2026-10-05) — supervisor lab notes

Harry, 2026-10-05: "make me castle, crypt and mansion types" + funds in RunPod. Target 300-450 accepted new assets.
Caps: $40 RunPod (pod time + re-rolls). Plates: free Codex image route only (no paid Gemini images). fal: handful only.

Layout: `crypt/ castle/ mansion/ vertical/` are each a yard-style run folder (build_spec.py -> assets.json -> inputs/ masked/
models/ qa/). `flats/` = floors, roof surfaces, room icons. `tools/` = the shared runner scripts. `spend.log` = dollars.

## Log
- 16:10 PDT start. RunPod balance $72.83, no pods, volume tw-trellis-cache (EUR-IS-1). Keys present in env.
- Plan: (A) 4 designers in parallel (catalog lines, rooms, build_spec) + 1 tooling agent; (B) one plate queue, crypt first;
  (C) pod session 1 = crypt (+ whatever is gated), QA, orient, integrate + deploy crypt; (D) pod session 2 = the rest;
  (E) integrate castle, mansion, vertical kit in catalog/library; docs; report.
- 16:20 Rule from the parent session (relaying Harry): if Codex image quota runs out, SendMessage "main" at once with one line
  (plates done, plates waiting, exact error text); Harry can fire a subscription reset. Keep working on what needs no new
  plates; re-try Codex about every 15 min; still NO paid Gemini images. Harry added $65 to RunPod; this batch's cap stays $40.
- 16:15 Vertical kit designed: 45 meshes + 4 roofing flats. Decisions: straight flight = 1x2 cells (10 ft run); new stairs get
  `--t10` skus (never replace the inn's stair meshes); `fit: box` on 19 kit pieces.
- 16:17 Crypt designed: 7 rooms, 76 meshes (p1 14, sib1 9, p2 24, sib2 8, p3 21), 6 flats, 30 reused roles. Decisions: open twins
  only for sarcophagus--s1 and coffin--s1; a shared `chapel` solver program (with the castle) at integration; corners borrow
  dressed-stone; `burial-urn-niche` -> HUNG_IDS at integration.
- 16:18 Crypt p1 plates started (tools/gen.py, 3 workers, 1 re-roll). Flats agent started (crypt floors, crypt icons, roofing).
- 16:21 Castle designed: 9 rooms (great hall, throne room, armoury, barracks, kitchen, chapel, dungeon, gatehouse, courtyard),
  122 meshes (34/51/37), new `castle-rough` wall family + arrow slit (as wall-window-small), cell bars, portcullis + raised twin.
  Decisions: nine rooms stand; lord's chamber dropped (mansion bedroom covers the look). Crypt p1 plates run about 1 a minute.
- 16:27 Mansion designed: 8 state rooms + 2 service rooms (kitchen, cellar: inn recipes), 131 meshes (31/51/49), walls
  noble-panel, noble-paper, conservatory; 3 new door leaves; 28 flat images. TOTAL SPECIFIED: 374 meshes (76+122+131+45).
  Decisions: service rooms go in the tray (nearly free); the new `tier: fine` skus must NOT change the inn's Fine guest room
  (integration uses a per-room preference instead); garden walks use what the yard grammar lays today.
- 16:32 Crypt p1 plates: 14/14 accepted (17 images, 14.8 min). Queue started (queue.sh FOLLOW, 3 workers): rest of crypt, then
  p1+sib1 of castle, mansion, vertical. Later priorities are appended in stages so focal pieces stay first.
- 16:40 Tooling delivered (tools/README.md). Rates: plates ~55/h (3 workers), meshes ~190/h on a 4090 ($0.74/h): plates are the
  bottleneck (374 plates ~ 7 h), so pods run in short sessions. Untested until now: real pod create, ssh, pod_setup.
- 16:42 Mesh agent started for the crypt (pod up, pilot wave of 14, QA, waves, pod down, manifest crypt-01, crypt/QA.md).
  Integration scout started (plan + drafted programs + sandbox tests in integration/; touches no shared file).
- 17:55 CRYPT MESHED (mesh agent): pod 16:36 to 17:53, RTX 4090, **$0.97 measured** (settled), pod deleted + verified. 73 of 76 accepted
  (`catalog/runs/crypt-01/manifest.tsv`, `crypt/QA.md`); no plate for tomb-slab, skull-pile--s2 (plate gate, twice) and
  rite-bone-candelabra (Codex "model at capacity"). Systematic finding: the parent wall plate came out SQUARE; prompt fixed
  and re-rolled before sib1 (see tools/README.md): castle and mansion wall parents need the same check before their siblings.
- 17:54 CRYPT MESHED: 73 of 76 accepted, $0.97 measured (one RTX 4090, 1.29 h), pod deleted and verified. Not shipped: tomb-slab
  and skull-pile--s2 (plate gate rejected twice), rite-bone-candelabra (Codex "model at capacity" twice; re-queued). Worst
  unpainted 6.1%. Finding: a wall parent plate came out square and the plate gate passed it -> mansion wall parents patched in
  mansion/assets.json (TALL, NARROW sentence + gate must; NOT in build_spec.py, do not regenerate without carrying it); the
  castle-rough parent plate measures 0.46 wide:tall, fine. Doorway opening ~28 in vs a 40-in leaf (integration note).
- 17:56 Queue restarted with the fixed ordering and the whole priority list (p1+sib1 of each type, then p2+sib2, then p3).
- 18:05 Flats stage 1 done: 27 accepted (2 crypt floors x4, 4 roofings, 7 decals, altar cloth, 7 crypt room icons), 1 rejected
  (decal-moss--s1: read as flowers twice). Stage 2 sent: castle + mansion floors, 19 room icons, then cards/rugs/decals.
- 18:10 Integration scout done: 34-step plan, 40 hunks apply cleanly, sandbox tests with fake meshes: crypt 1,008 rooms / castle
  1,152 / mansion 1,152, zero failures; inn golden test unchanged. Design gaps sent back to the scout (room sizes, cas- recipes
  for chapel and dungeon, dais width, tall pieces, courtyard and garden grammars). `washstand--fine` -> `washstand--state`
  in mansion/assets.json (it was a live inn sku name).
- 18:12 CRYPT INTEGRATOR started (apply hunks, orientation, tests, room reads, commit, push, deploy, live check, docs).
- 18:40 Scout round 2: castle + mansion drafts pass in sandbox (0 failures; inn golden unchanged), 42 hunks apply. Sizes raised;
  cas-castle-chapel / cas-castle-dungeon recipes added; dais 170x110x16 by manifest override; 104-in caps for banner-pole,
  pillar-round, fireplace-marble, bookcase-ladder (integration/manifest_overrides.{castle,mansion}.json -> copy to B/<type>/
  before make_manifest.py); courtyard and garden have their own programs. See integration/CASTLE_MANSION_NOTES.md (incl. five
  mansion specs that still need `tier: fine`). Kit boxes: look.js ignored a sku's own size; fix handed to the crypt integrator.
- ~18:45-20:05 OUTAGE (login/API 403): supervisor, crypt integrator and flats agent were cut off. Recovered 20:05: NO pod was up
  (balance $71.84; spent $0.97); the plate queue survived and kept painting (208 done / 159 waiting / 7 rejected, no quota stop);
  the crypt integrator died with uncommitted crypt edits in the main tree. Storeys work moved to its own worktree; main is shared
  with a ring-menu agent; the live relay runs from the main tree: no deploy / relay restart until the tree loads and tests pass.
- 20:08 Resumed: crypt integrator (commit promptly by explicit path, then deploy when safe), flats agent (stage 2).
- 20:12 Mesh agent started for castle + mansion + vertical (short 4090 sessions, pod down while waiting on plates, cap $10).
- 20:15 LIVE FAULT (found by the ring-menu agent): six castle/mansion floors listed live with no image (404). Cause: build_data.py
  globbed flats/seamless, a later rebuild listed floors whose webp was never built or shipped. Fixed by the crypt integrator:
  flats are listed only when built; both deploy scripts run tools/spawn-tuner/test/assets_check.py and stop on a miss;
  13,708 URLs x 2 hosts checked live, 0 missing. Commits 8f8da1f (crypt type), ee461e8 (types.json, mine), 09e1707, 3e49d1b.
- RULE from the parent: keep main free of uncommitted edits; castle and mansion are integrated in OUR OWN worktree + branch,
  one tested merge per type. engine/LAB_NOTES.md in main is the storeys lead's file: never write there.
- 20:30 CRYPT IS LIVE (tuner + Build tray). Room reads + docs still to come from the integrator. Pod x7je036sbpswx3 up (mesh
  session 2, castle/mansion/vertical).
- 21:00 Crypt integrator done: live; blind reads name 5 of 7 rooms (ossuary + catacomb read only as "crypt"; chapel 1 of 2 seeds
  as throne room); accept.py live did not complete. Interim report sent to main. Crypt REWORK agent started in its own worktree
  (<repo>, branch ccm): fix those three programs, land by merge, accept.py on GPU, remove
  throwaway campaigns.
- 21:10 Flats stage 2 done: 63 accepted, 0 rejected (7 floors x4, 19 room icons, 16 keyed plates). 99 Codex requests over both
  stages. Not made: 6 mansion images (2 each painting-landscape, rug-grand, curtains-drapes: ids existed). Mansion tapestries
  are --s3/--s4. floor-lawn-mown must never be rotated (stripes imposed in post).
- 22:17 Crypt rework landed (main = 46bb39d, tuner v=20261005220207, 0 missing live): ossuary 3-4/4 and chapel 4/4 specific reads
  at both sizes; catacomb 3/4 at its new 10x3 default only, fails at other sizes (niche panels read as bookshelves or cells:
  logged as an asset need). accept.py on GPU 47/49 (A24 test URL lacked ?seed; A25c known timing). Two throwaway campaigns removed.
- 22:17 Mesh session 2 over: pod x7je036sbpswx3 2.15 h, $1.60 measured, deleted. RunPod total so far $2.57. Balance $70.24.
  Plates 314 done / 40 waiting / 20 rejected. Meshes: castle 114, mansion 88, vertical 29.
- 22:20 Three rejected PARENT plates retried with fixed prompts/gates (timber straight stair: rails; castle curtain wall: shape +
  merlon; conservatory wall: was drawn as an arched stone window). All three accepted; siblings followed except
  stair-quarter-turn--rough-timber and wall-straight--conservatory--s2 (rejected twice).
- 23:30 ALL PLATES DONE: 352 accepted, 22 rejected, Codex quota never ran out (no paid plates). Queue stopped.
  ALL MESHING DONE: accepted crypt 74, castle 115, mansion 119, vertical 41 = 349. Mesh rejects: door-cell-bars (+ open twin
  left out), wall-doorway--noble-paper, stair-quarter-turn--dressed-stone. RunPod total $3.07 measured (balance $72.83 ->
  $69.76), three sessions, no pod running. Manifests: catalog/runs/{crypt,castle,mansion,vertical}-01/manifest.tsv.
- 23:35 Castle + mansion + vertical integration starts in the ccm worktree.
- 23:50 Caution from the parent (a storeys merge replaced main's icons folder with a tracked worktree symlink; restored): in the
  ccm worktree the links to main's ignored folders show as UNTRACKED (gitignore `dir/` does not match a link). Rule: add explicit
  files only; before each merge `git ls-files -s | grep ^120000` must show only engine/tuner and engine/tuner-data. Main has
  moved (storeys A-G, roofs, levels): merge main before testing each type; add our wall families to the roof-style mapping
  (all -> slate); rooms must behave on other levels. Integrator told; it reports when Castle is live, then is resumed.
- 2026-10-06 00:58 CASTLE LIVE (7d1611e). 02:30 MANSION + vertical kit LIVE (3a913b4, d0d1a49, docs 9911777 / 00ed3e9).
  Reads (4 seeds): castle 7 rooms 4/4, kitchen 3/4, gatehouse 3/4 on the live record but "guardroom" about half the time across
  rounds (not reliably named). Mansion 7 rooms 4/4, kitchen 3/4, wine cellar "cellar" 3 / wine 1, BALLROOM 0/4 ("reception
  hall", "gallery"). Bench list: B/BENCH.md (68: 32 fire, 6 water, 30 open-shut). Storeys handoff: vertical/FOR_STOREYS.md.
- 02:32 Supervisor's final check: no pod, balance $69.75 (batch total $3.08 incl. volume storage); main clean of our edits;
  tracked links only engine/tuner, engine/tuner-data; assets and icons folders real; live assets 17,329 per host, 0 missing.
