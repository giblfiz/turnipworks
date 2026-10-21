# Engine core: lab notes

## 2026-10-02: rung 1, the shared core and the relay (node-verified)

**What's built.** The design is `docs/NETCODE.md`; the judgment is `COMMANDERS_INTENT.md`.
- `core/`: plain ES modules, the same files in Node and the browser.
  - `state.js`: campaign → tables → entities, as plain data.
  - `commands.js`: the registry. Each command has a shape, a permission class, a semantic check, a pure apply and its touched ids. The inverse is generic: an `entities.set` snapshot of the touched entities before the change.
  - `perms.js`: seats, classes, visibility.
  - `client-sync.js`: optimistic client with rebase.
  - `presence.js`: sender settle + heartbeat; receiver glide.
  - `netsim.js`: FIFO lag and presence loss.
  - `roomgen.js`: the tuner solver, injected.
  - `hash.js`, `ids.js`, `transport.js`.
- `relay/`:
  - `server.js`: http + ws.
  - `campaign.js`: the one door `dispatch()`, the logs, undo, nonces, fan-out, ghosts.
  - `llm.js`: GET API and rules card.
  - `store.js`: journal + snapshots.
  - `tokens.js`: HMAC capability tokens.

**Decisions worth keeping:**
- **One journal per campaign, not one file per table.** A cross-table transfer is one JSONL line carrying both tables' effects (each effect has its table and that table's seq), so it is atomic on disk. A torn last line is cut on load. The per-table ordered logs are logical: every effect carries a per-table seq, and the relay keeps per-table tails for catch-up.
- **The journal stores effects, not intents.** Replay applies the recorded effects with the same reducers and never re-runs validation, so a restart cannot reinterpret history (for example, if permissions changed later). Every append is fdatasync'd before apply and broadcast.
- **LLM permissions are derived live:** `can(agent) = scope ∩ can(creator)`, evaluated on every check. "Never more than the creator" therefore holds even if the creator is narrowed later, and revocation cascades by construction (`liveSeat` walks the creator chain). The revoke reducer also marks the children, so the record says so too.
- **Visibility before permission.** A seat that cannot see a table gets `invisible` (HTTP 404), never `forbidden`. A player's agent learns nothing about GM-only tables, not even that they exist. Campaign views are projected per seat (`projectCampaign`): hidden tables are not listed, and people on them show as "elsewhere".
- **Interpretation (flag for Harry):** **party** = visible to the GM plus seats located at that table or owning a token on it, which covers the sneaking rogue's own scene. **open** = every seat. **gm** = GM only.
- **Tokens:** HMAC claims (campaign, seat, creator, scope or role), minted deterministically from the seat record. They are re-issuable (invite links) without storage, and checked against the live seat every time.
- **GET API naming:** the command is `cmd=` and the token is `seat=`. (`type` is a room type and `who` is the seat argument of seat commands, to avoid collisions in one query string.) Nonce = the socket's client command id, in one per-seat namespace, persisted in the journal, so idempotency survives a kill -9.
- **Rooms:** the creator sends the recipe plus the solved layout and its hash. The relay solves only when the layout is absent (LLM spawns). Clients re-solve to check, but always draw the creator's layout. The engine version is a hash of solver.js, solver2.js, walls.js and the three data files, with the deploy `?v=` stamps stripped.

**Tests:**
- `node test/core.test.mjs`: 57/57. Mutation-checked: breaking token ownership fails 2 checks, and making LLM visibility unconditional fails 3.
- `node test/relay.test.mjs`: 44/44. Two seats converge; nack rolls back; concurrent drops converge to the relay state; rejoin; LLM seats over GET (rules card, ghost "thinking" plus glide, nonce dedupe, stale with changes, player-agent refused `room.spawn` and refused reading a GM-only table); atomic transfer as one batch; GM undo of a transfer and of a move; graceful restart; live revocation cascade; kill -9 with a torn journal tail (40/40 acknowledged commands survived; idempotency survived).
- `node test/harness.mjs` (first run, seed 7, 12 s storm at 50–400 ms jitter each way, 20% presence loss each way, one connection dropped mid-flight, relay restarted mid-storm):
  - converged 104 ms after the storm stopped;
  - 769 applied entries matched the relay order, 0 disagreements;
  - exactly once: 188 landed, 11 refused, 0 duplicated, 0 lost;
  - cursors converged in 3.1 s;
  - command round trip: median 613 ms, p95 1.8 s (lag is applied on both hops).

**Found by the harness:**
- The first network simulator reordered messages: Node timers whose deadlines nearly tie fire in either order. TCP never does that, so the simulator now drains one FIFO queue per direction.
- The client survived the reordering (gap → resync), but every later entry also triggered a resync: 198 in one run. Now only one catch-up request per table is outstanding. 0 resyncs since.

## 2026-10-02: rungs 2–3, browser client, deployment, first milestone verified live

**Client** (`client/`, three.js r170 from the CDN importmap, no build step):
- `TableWorld` per table is the view of state: entities are immutable objects, so object identity tells it exactly what to rebuild.
- `View` = (table, camera rule): **free** uses the tuner's GrabCamera; **pinned**; **follow-group** fits the centroid plus spread, smoothed.
- All views render through one renderer with scissor viewports; the PiP is a second view on another table.
- Drags travel as presence; the drop is one `token.move`.
- Rooms draw the creator's layout (the cube swap); every tab re-solves the seed and shows hash ✓/✗ (panel and HUD).
- Roster strip: click to jump to a seat's table, or PiP it while following that seat's tokens.
- GM undo is the button or Ctrl+Z.
- Test hooks: `window.tw`.

**Found in deployment:** the Cloudflare zone does not pass websocket upgrades. The handshake reached the relay as a plain GET and got a 404. curl over HTTP/1.1 and Chrome both saw it; nginx and Node both answer 101 locally. The wiki already said so (`infrastructure/remote-control/codex`). Fix: a second transport.
- **SSE downstream plus ordered POST upstream**, with one POST in flight. Messages queued meanwhile ride the next POST, which batches 18 Hz presence for free. A POST number makes retries harmless.
- `autoTransport` tries ws first and falls back to SSE for the session; `?transport=` forces one.
- The relay's connection handling is one `onConnMessage` behind both transports; ClientSync didn't change.
- The harness now runs mixed ws/SSE by default.
- Live sessions currently run on SSE (HUD: `live (sse) · rtt ~24 ms`).

**Also found:**
- `PresenceSender` kept a reference to the caller's cursor array. A caller mutating one vector in place made every change look like no change, so only the 1 s heartbeat went out. It now copies its input.
- Settle repeats went from 5 at 250 ms to 8 at 150 ms. At 36% end-to-end loss (20% each way), the chance that one of 12 pairs missed all five was about 7% per run (P(all 5 lost) ≈ 0.6% per pair). With 8 it is about 0.03% per pair.
- Cloudflare bans the default Python-urllib User-Agent (error 1010). curl and ChatGPT-User agents pass. The acceptance test sends its own UA.
- Harness GET agents now retry fetch errors, as real agents would. Two of 12 matrix runs had died silently when an agent's fetch hit the relay mid-restart (inferred; it didn't reproduce).

**Deployment:**
- Relay: `tw-relay.service` on 127.0.0.1:8097; data in `engine/data/`, which is gitignored.
- nginx: `relay/nginx-location.conf`, included from `sites-enabled/implausible-enterprises` (the live file) and the turnipworks.net site. Its access log is off because GET URLs carry seat tokens.
- `deploy.sh`:
  - stages the client, core and a **pinned copy** of the tuner's solver and data;
  - version-stamps imports;
  - gates on a Node solve of the staged engine;
  - rsyncs, then restarts the relay on the same copy, so relay and browser share one engine version (`v2-f7188fdd`).

**Results:**
- Live, two tabs, Cloudflare, SSE (`test/browser_two_tab.py`): **27/27**.
  - Cursor error 0.008 / 0.038 ft.
  - The drag shows live in the other tab while its state is unchanged.
  - 4 rounds of both tabs dropping the same token at once give 8 entries, applied in the same order in both tabs, with identical states.
  - Room hash b40ada76 re-solved identically in both tabs.
  - Ghost glides 21.6 → 0.2 ft in about 1.6 s.
  - Player agent: `room.spawn` refused (forbidden), and the GM-only table answers 404.
  - The transfer is never on both tables and never on neither, checked frame by frame.
  - The follow-group PiP tracks the token to (60, −30) while the GM stays on table 1.
  - GM undo of a move and of a transfer.
  - Rejoin gets the full state; `systemctl restart tw-relay` mid-session loses nothing, both tabs reconnect on their own, and play continues.
- Local: 27/27, also over ws. Before the PiP-click fix, 1 of 3 local runs flaked: the NPC sat under the PiP inset, which owns clicks there.
- Harness matrix (ws / sse / mixed × 4 seeds, 8 s storms): all 5/5 once agents retry. Cursor convergence 0.8–1.6 s; commands converge within ~0.5 s of the storm stopping; 0 order disagreements, 0 duplicates, 0 lost.

**Known gaps (deliberate for this slice):**
- **Rendering:**
  - Rooms render as catalog-size boxes; real meshes are wireable from the tuner's assets.
  - No label-collision handling: Gemini rated label legibility 3/5 when ghosts sit on tokens.
  - The PiP renders every frame at full resolution; it's light now.
- **Security and permissions:**
  - Campaign creation is open: 30 per IP per hour, 500 total. Roles never change after creation, so "narrowed creator" only covers revocation.
  - Visibility filters whole tables, not single entities; there's no fog of war yet.
- **Rooms:**
  - A room spawned while another spawn is in flight is solved against the creator's optimistic view, so a re-solve on another tab could differ. It would be flagged ✗, and the creator's layout is still drawn.
  - Adding a room doesn't re-plan older neighbours, whose doors can change (same behaviour as the tuner).
- **Persistence:** the journal is never compacted, and snapshots run every 100 records.
- **Cloudflare:** websockets would be lower overhead if the zone allowed them (the Network → WebSockets toggle). SSE stays as the fallback either way.

## 2026-10-02 (night): rung 4, the game UI (docs/UI.md)

**What's built** (`client/`):
- **Registry and surfaces:** the command registry (`registry.js` + `commands.js`, about 120 commands) is the single source of truth. The bar, the selection ring and ☰ radial, hotkeys, Space chords and the "?" sheet are surfaces generated from it.
  - The seam for Harry's parallel menu/hotkey system: `registry.use(surface)`, key *layers* (`keymap(layer)`, and `app.keyLayers` gets first refusal), and `app.escapeStack`.
  - Nothing in a surface defines a command.
- **Command bar** (top centre, `/` or Ctrl/⌘K):
  - typed sections ranked by best match: intents, commands, place, in the world, places and tables, people, cues;
  - ranking uses the selection, recency and frequency; permissions hide what a seat can't use;
  - Up = history, Down = results;
  - argument chips: `roll d20+5`; `-7` / `+5` on the selected pawns; `say …`; `invite …`; `new table …`; `send to …`; `undo <person>`;
  - natural-language fallback is a stub row;
  - preview on highlight: the world thing lights up, an asset shows its ghost mid-view.
- **Living previews:** catalog rows and "replace with similar" variants show the real GLB turning at 6 rpm. One overlay renderer draws a scissor viewport per DOM slot; a static icon shows until the model loads.
- **Placement:**
  - Drag a result straight into the world, or click for place mode with a ghost; Shift keeps placing, R turns, Esc cancels.
  - Placement semantics: floor items snap to the half-foot grid (Alt: free); wall items go back to the nearest wall facing in, with hung items at hanging height; surface items go onto the tabletop under the cursor (parent = that object, then the tuner's settle.js gravity); ceiling items go up top.
- **Real meshes** from the tuner pipeline (read-only), shared by both renderers:
  - props through library.json and orient.json;
  - generated kit walls (cut away by default), doors and posts;
  - the floor material per room;
  - the `-open` twin mesh when something is opened.
- **Building (Harry's addition):**
  - the 11 room types via the bar, then drag a rectangle on the 5-ft grid with a live size label (red when it overlaps);
  - re-roll (keeps pinned props, which the solver gets as locked placements), change type, walls family, floor, delete, replay the spawn animation (anim.js);
  - **room props are now object entities** (`room.spawn` creates the room, its furniture and, if new, its building in one command);
  - **buildings** are a data level: a building owns rooms; a room touching another joins its building.
- **Selection:**
  - the most specific thing under the cursor, with pawns first and ceiling-hung things last; clicking the same spot again cycles down the stack;
  - room floor → room; wall → wall segment; at the map detent (camera beyond 150 ft) a click selects the building;
  - Shift+Enter = parent, Enter = children, double-click = step inside; breadcrumb under the bar; hover previews the click target;
  - marquee = wholly inside; moving a parent moves its contents (`room.move` moves furniture; a table carries what's on it).
- **Ring:**
  - the knob rides the ring at the thing's facing and the size handle sits on it (Shift snaps 15° / 10%);
  - fixed clock slots: openable = open · pin · ☰; prop = pin · ☰; pawn = label · ☰ (no size handle); room = re-roll · ☰;
  - ☰ draws the registry's tree radially, outward by level, keys on every item; stubs are greyed;
  - multi-select = one ring with a count and only shared actions; players see a ring only on what they may touch;
  - ring controls clamp inside the viewport.
- **Under ☰:** hide/reveal, lock, pin, duplicate, delete, replace with similar (turning fly-out), rename; for pawns, HP ±1/±5 and ten conditions. Stubs (greyed): age, light, fill, break, contents, notes, initiative, vision, elevation, size, sheet, wall door/window.
- **Input:**
  - left-drag on empty space = marquee; right/middle/Space+drag = pan; wheel or pinch zooms to the cursor; Alt+right-drag orbits;
  - click / Shift / Ctrl-click; Ctrl+A; Esc;
  - Ctrl+Z / Shift+Z / Y; X C V with paste at the cursor (relative layout kept);
  - plain-text clipboard `TW1:<base64url>`: it survives a text box, wrapping or extra words;
  - Ctrl+D; Alt-drag duplicate; Delete/Backspace; arrows ±1 ft, Shift ±5 ft; F frames; Ctrl+0 resets;
  - "?" sheet; touch long-press selects (ring); Alt+click pings in seat colour.
- **Per-seat undo (Figma):** undo/redo per (table, seat), the redo held in the undo record (so it survives restarts). The GM may undo anyone's action (`undo {who}`; "undo Brakka" in the bar). A drag, paste, roll or multi-target HP change is one step (the `batch` command).
- **Hidden from players:** filtered by the relay per recipient.
  - Entries touching hidden things go to player-side seats as projected `entities.set`.
  - Player catch-up through such entries gets a filtered snapshot.
  - Drags of hidden things are stripped from presence; a ghost aimed at something hidden is GM-only.
  - GET reads are filtered too.
  - A player command touching a hidden id gets the same answer as a missing id.
  - The GM sees it see-through, with a violet dashed outline and a "Hidden" pill.
- **Visual language:**
  - Inter (OFL) and Lucide (ISC), vendored with their licences;
  - seat colour for cursor, selection outline and pings; hover = thin neutral outline; unconfirmed = moving faint dash; one destructive red;
  - dark first, with a light theme designed ("toggle light / dark").
- **Corner roster:** avatars (seat colour, activity dot, location); click to jump; drag onto the world for a PiP that follows that person's pawns (`follow: {owner}` resolves every frame).

**Bugs found by the tests (all fixed):**
- **Hidden overlays covered the canvas:** an author `display` rule overrides the `hidden` attribute; added a global `[hidden]{display:none!important}`.
- **The bar's highlight jumped to a row** rendered under a resting mouse: it now moves on `pointermove` only.
- **Picking used stale world matrices** when input arrived before the next frame (background tabs throttle rAF): `scene.updateMatrixWorld()` before raycasting.
- **Stale drags:** a finished drag kept being heartbeated in presence, so other tabs drew the thing at the old drag point. Pointer-up now clears it.
- **Drags lost their first pixels:** they were measured from the drag-threshold point, not the press point (−17% on a 10-ft drag).
- **A lamp over a pawn stole the click:** pawns now pick first, ceiling-hung things last.
- **The ghost cursor went NaN:** buildings (no position) were included in the table centroid.
- **Ring buttons went off-screen** on big zoomed rooms: they clamp now.

**Tests:**
- core 84/84 (new: batch, flags, hidden rule, pawns, chat and dice, re-roll keeps pins, undo of a re-roll restores exactly, room.delete takes its furniture);
- relay 47/47 (per-seat undo and redo; GM undoes a player's action; a player can't undo the GM's);
- harness 5/5;
- `browser_ui.py` 59/59, three local runs in a row (two tabs, real meshes);
- `browser_two_tab.py`, the milestone, ported to the bar, uses catalog boxes to keep software GL alive: 28/28 on 2 of 3 runs; the third missed one NPC click, so that click now retries once with diagnostics.
- All 7 live journals replay from scratch with the new reducers.

**Live, 2026-10-02 night:**
- `https://turnipworks.net/play/` (nginx `/play/` aliases the engine deploy; the relay route is on that domain too) and the old engine URL.
- `browser_ui.py` 59/59 live on turnipworks.net, twice (sessions on SSE through Cloudflare).
- `browser_two_tab.py` 28/28 live with a real `systemctl restart tw-relay` mid-session. The transfer probe now watches until it sees the move, after an early probe ended too soon on the slower live path.

**Gemini's blind-first read:**
- The chrome is "exceptionally quiet and genre-neutral … could be used for a sci-fi, modern, or horror game".
- The selection treatment is "very clear and uncluttered".
- The hidden treatment is "immediately" read as different, and the eye-off icon makes it "unmistakable".
- Dark theme 9/10.
- Light theme 7/10 at first: low-contrast grey subtext, raw-looking names. After darkening the light greys, making world-label plates more opaque and capitalizing display names: 8/10, names "clearly written for a human user".
- The bottom-right status line is deliberately faint (it's diagnostic).

## 2026-10-02 (late): Harry's first hands-on round — the tuner's look, live; ring v2; game at turnipworks.net/

**The game imports the tuner instead of copying it** (Harry: "bring back (and KEEP UP TO DATE) the aesthetic quality
from the tuner"):
- **Shared code in the tuner.** The look code moved out of the tuner's main.js into `tools/spawn-tuner/js/look.js`, which the tuner's main.js now imports:
  - asset and LOD loading, `makeVisual`;
  - wall pieces (`edgeSpecs`, `cornerSpec`) and floor tiling with scatter (`floorSpecs`);
  - the dials, with the tuner's defaults as `LOOK_DIALS`.
  - Mesh orientation went to a three-free `js/orient.js` that the relay imports too.
  - The tuner suites stayed green: node 10/10, `accept_union` 49/51 locally (the other 2 are live-only write-backs), `fx_regress` OK. `fx_ui` fails two anchor write-back checks, identically on the pre-refactor commit, so that failure predates this change.
- **Live import.** `client/tuner.js` imports the DEPLOYED tuner's modules and data at runtime: `anim.js`, `settle.js`, `fx/`, `look.js`, `solver*.js`, `walls.js`, `camera.js`.
  - The stamp comes from `tuner/version.json`, which the tuner's deploy now writes; the tuner's deploy also restarts `tw-relay`, and the relay solves with the same deployed files.
  - Harry's orientation corrections (`GET /tuner/orient`) are merged in both places and are part of the engine version.
  - `engine/deploy.sh` copies no tuner code any more.
- **House look.** "Use in game" buttons on the tuner's Spawn animation, Lighting and Fire panels post kind `house` to the ratings server. `GET /tuner/house` merges the latest record per field. The game loads it at startup and falls back to harry-v2 plus the night lighting.
- **FX for the game.** `createFx` gained `persist: false` (the game never touches the tuner's browser dials), `initial` and `dataBase`.

**Harry's seven notes:**
- (1) **Effects.** One FX instance per table world:
  - the main view renders through the tuner's lighting stack, and fires sit on mesh-keyed flame anchors (with Harry's server overrides);
  - settle.js gravity;
  - the spawn plays the house preset with the tuner's `applyPose`, over floor tiles, walls, doors and furniture in layer order, with camera-side walls last; re-roll and delete play the out-animation.
- (2) **No outline around spawning things.** The "unconfirmed" shimmer skips room commands, and no signal is drawn on anything animating.
- (3) **Deselect.**
  - Escape closers now report whether they closed anything, and stale ones are skipped (a closed sheet used to swallow Esc).
  - The frame loop is guarded, so one bad frame can't stall it.
  - Tested: Esc, click on empty ground, selecting something else.
- (4) **Middle-drag orbits** again; right-drag, Space+drag and fingers pan.
- (5) **Selection signal, no boxes:**
  - a pulsing halo (an inflated back-face shell, depth-tested), or switchable to the footprint on the ground;
  - a room glows as its floor outline;
  - hidden things are see-through with a violet halo and a "Hidden" pill;
  - unconfirmed changes show a faint fast shimmer halo.
- (6) **Ring v2:**
  - no circle; 56 px buttons at fixed clock positions from 10:00 to 2:00 (turn is a drag button, plus open, pin or re-roll or the pawn's label, light, and ☰);
  - ☰ disappears and every other option fills the rest of the circle in one flat level, with keys shown and stubs greyed.
- (7) **Light / put out** (`object.light`, synced): the button shows its state, and the tuner's fire drops the flames.
  - Also new: **raise / lower** (Harry, same round). A drag button in the expanded circle, Shift = 6-in steps, height readout, faint drop line. Released within 1.5 ft above a surface it lands there (then settle); otherwise it hangs or flies. Pawns can fly.

**Root causes worth remembering:**
- **Half-height walls** were mine: a default cut-away factor of 0.38 in the old world.js. Walls are now built by the tuner's own code. Measured against the tuner, same seed and pieces: 9.00 ft in both.
- **Two-tab runs throttle the background tab.** Chromium throttles the background tab's rAF, so its picks used stale matrices and its per-frame signals lagged. Tests now launch Chromium with background throttling off, and picking refreshes world matrices first.
- **Software GL can't carry two full-look tabs.** Tests use `?faces=1500` (a test-only LOD override) and a player tab without FX. The milestone test uses catalog boxes.

**Deployment:**
- `https://turnipworks.net/` is the game itself: `engine/client/index.turnipworks.html`, with `<base href="/engine/client/">` and the tuner at `/look/`.
- `/look/` exposes only the tuner's `js/`, `data/`, `assets/` and `version.json`; everything else under it 404s.
- `/play/` 301s to `/`. `/tuner/`, `/review*/`, `/openclose/`, the old landing page and every other path 301 to implausible.enterprises.
- `/api/tw-relay/` and `/api/tw-ratings/` are kept.
- A copy of the config is in `relay/nginx-turnipworks.net.conf`.
- (2026-10-11) `/engine/client/` and `/engine/client/index.html` answer with the same page as `/`: without that they answered with `index.html`, the other site's page, which cannot load the tuner from this origin (invite links made 2026-10-07..11 carry that address).

**Gemini blind read of the full live look → three fixes (2026-10-02, night):**
- **Ring at the screen edge.** Each button was pinned to the edge on its own, so they piled up. Now the whole circle slides inward, and every button keeps its clock position. While ☰ is open, the standard buttons sit on the same circle as the options. Test: one circle (spread 0 px), no overlaps, at the centre and at the right-hand edge.
- **Grey stand-ins mid-spawn.** On a cold cache the choreography played over grey boxes that swapped to meshes mid-flight. Now, as the tuner does, every mesh loads first (the room stays unseen, with a 20 s cap), then it all plays. Test: no stand-in is visible at any sample during the spawn.
- **Selected room's glow was invisible from the angled view.** It was drawn on the room's own edge, inside the wall pieces and under the floor boards. Now it sits just inside the walls' inner face and just above the floor top, both measured from the built pieces. Test: rays from the camera to points along the outline. 30% are seen, against 3% on the room edge (the near side is behind the near wall either way).
- **Gemini triage I did NOT act on:**
  - "walls cut short": parity is measured at 9.00 ft, the same as the tuner;
  - "thick yellow room outline drawn on top": not in the pixels;
  - "1–2 fps": headless software GL.

## 2026-10-03: "table" → "area" (Harry: a table is furniture; the playable thing is an area)
- **Renamed everywhere in the playable sense:**
  - data model (`campaign.areas`, `areaOrder`), commands (`area.create`, `area.visibility`, level `'area'`, class `area.admin`), wire fields (`{t:'sub', area}`), LLM scopes (`{areas: '*'}`), GET API `/c/<cid>/a/<area>/…`, UI text ("New area…", "Area 1"), tests and docs;
  - new area ids are `area_…`; old `tbl_…` ids stay (ids never change).
  - The furniture sense stays: tables in rooms, tabletops, "table zoom/distance", the table screen (TV), the "Room ▸ Table ▸ Cup" breadcrumb.
- **Old data and old callers keep working** (`core/migrate.js`, pure and idempotent):
  - reads: snapshots and journal records load through it, as do inbound socket messages (`table` → `area`), commands (`table.create` and friends, a `table=` arg) and token claims (an LLM token minted with `{tables:'*'}` still matches its migrated seat);
  - `/t/<area>/…` answers as an alias for one release;
  - default names "Table N" read as "Area N"; names people chose are kept.
- **The one-shot rewrite** (`relay/migrate-areas.js`) runs at relay start: it rewrites each campaign's snapshot and journal in the new names, keeps the originals as `*.pre-areas`, and marks the dir `format = 2`. A tarball of the whole data dir from before the deploy is at `~/backups/tw-engine-data-pre-areas-*.tgz`.
- **Tests:** `test/migrate.test.mjs` (47) uses a hand-written old-format campaign and replays all 33 real campaigns under `engine/data` both ways: backward-compatible read == migrated read, byte-for-byte state.
- **Stale test servers:** an interrupted run had left a local relay holding a test port. The next run quietly talked to OLD relay code (that is why the first post-rename UI run failed). The browser tests now refuse to start on a busy port.

## 2026-10-03: build rung: Build launcher and menu, tool cursors, library shelves, labels, intro, undo chips
- **Taxonomy** (`client/taxonomy.js`, `tools/build_types.py`):
  - **genre:** Fantasy;
  - **type:** the catalog's 16 setting codes (`catalog/out/by-setting`);
  - **room:** the tuner's room recipes, joined to their type by recipe prefix (`tav-…`); only TAV has rooms today;
  - **furniture / object:** a room's recipe slots, split by catalog place (surface = object). Objects sit under every furniture item whose role name says it has a top, a heuristic until the catalog has a has-a-top field.
  - Symlinks: a role in several settings or rooms is listed in each.
- **Menu** (`surfaces/build.js`): see docs/UI.md for the key rule (letters pick in the active list; Shift+G/T/R/F/O jump levels). It is sticky per campaign and seat, and it reopens with the tool live.
- **Building tool** (`client/pack.js`):
  - guillotine-packs the type's rooms into the rectangle: priority common → kitchen → guest → …, recipe sizes ×1.5, more guest rooms when there is room, at most 12 rooms and 24 cells a side;
  - stable, barn, cellar and hallway are not packed;
  - one `batch` of solved room.spawns, so one undo removes it.
  - The relay's body limits went up for it: nginx 64k → 1m (`relay/nginx-location.conf`), SSE POST 256k → 1MB, WS 512k → 1MB. Six solved rooms are about 116 KB.
- **Library shelves** (`client/library.js`):
  - a local AreaWorld per room type, never synced: floor rows for the big pieces, four-tier shelving units for the small ones, true scale, a label per item;
  - meshes are handed out four per frame, nearest the PiP camera first;
  - the PiP view gets rule 'library', and library.js flies its camera;
  - drag-out reuses the place mode; copy uses `library.clip()` when nothing in the world is selected.
- **Labels** (`surfaces/labels.js`, `core/labels.js`): DOM pills, greedy collision with a stable order; the relay-side stripping is covered by `relay.test.mjs` (raw frames + GET).
- **Intro** (`client/intro.js`): a phantom LLM seat named "Intro", created per run and revoked after. Its room goes through the GET API (the relay solves it), so it is another seat's change. The screen ghost drives the real Build menu and room tool. "Replay intro" is `help.intro`; `?nointro` is passed by every other browser suite.
- **Undo chips** (`surfaces/undochips.js`): GM only, one chip per other seat, fade after 9 s; a click undoes `{who, seq}`.
- **Icons:** 28 painted icons for genres, types and rooms, from `codex exec` image generation (ChatGPT login, no API spend). A style anchor (the inn) went first and was attached to every other prompt. The images were chroma-keyed and cut to 128 px (`experiments/2026-10-03-build-icons/`). Gemini's read: consistent, clean keying, no text. The temple was regenerated without a cross. Bar results now use 46-px tiles; rooms show their icon.
- **Ops: the chrome-mcp watchdog was killing every Playwright session on the box.** Every ~10 min, its post-probe reap (`pkill -f playwright…run-driver`) hit all sessions, which explains the random "Target closed" crashes in yesterday's runs. It is now scoped to its own cgroup (fauna-tools/chrome-mcp-watchdog).

## 2026-10-04: trackpad navigation, and the main view landing inside the PiP
- **Harry's hands-on was on a MacBook trackpad, with no mouse. The wheel is now split by device** (`client/input.js`):
  - **pinch:** `ctrlKey` (how Chrome and Firefox deliver it) zooms at the cursor;
  - **trackpad two-finger scroll:** pixel deltas with deltaX, or small/fractional deltaY, pan. With Option it orbits (yaw and pitch, clamped above the floor);
  - **mouse wheel:** line mode, or coarse ~100/120 notches with no deltaX, zooms as before;
  - a trackpad gesture stays "trackpad" for 350 ms, so its tail never zooms;
  - **Safari:** `gesturechange` gives pinch zoom and two-finger rotate (yaw);
  - **on empty space:** Cmd/Ctrl-drag pans and Option-drag orbits; Cmd-click still toggles and Shift-drag still adds a box.
  - **Where it's documented:** the ? sheet has a Trackpad section, and the first-visit hint shows the gestures on a Mac.
- **Root cause of "the main scene inside the PiP, the main window blank":** the main view renders through the tuner's FX stack, which draws into whatever viewport the renderer holds. The loop never set one for it, so it inherited the PiP's rectangle from the previous frame. The library PiP made a PiP common, which exposed it.
  - **Fix:** set the main view's viewport before `fx.render`.
  - **Checked:** without the fix the main window is blank (pixel stddev 0.0); with it, 21.
  - **Also:** swapping a library PiP into the main view is refused, and `setMain` never accepts a `lib:` area.
  - **Regression test** (browser_build "VIEWS"): library open → navigate → swap (refused) → close → PiP of another area → swap both ways. Every step reads a fresh frame's `tw.lastRenders` (which view drew which area into which rectangle) and checks pixels of the canvas alone.
- **One rotate behaviour (Harry's clarification).** "Orbit" means free camera rotation pivoting on the ground point under the pointer where the gesture started, exactly the tuner's middle-drag, with no fixed centre. The inputs:
  - middle-drag and Option-drag use GrabCamera's own orbit grab;
  - Option + two-finger scroll (its pivot is held for the gesture), Safari's two-finger rotate (pivot at gesturestart) and Q/E/PageUp/PageDown (pivot = the pointer's ground point at key-down, rotated per frame in the engine instead of GrabCamera.tick) share `app.rotateView`.
  - Tested: the pivot point stays within 2 px on screen through Option+scroll and a held Q.

## 2026-10-04: small-adjustment round (Harry: "we are getting into small-adjustment land")
- **Option + click-drag "didn't rotate".** Root cause: it only rotated when the drag began on empty ground. A drag that began on a piece of furniture, a wall or a selected room's floor was taken as Alt-duplicate or a move, and in a furnished room that is nearly everywhere. Option+drag now rotates wherever it starts. Duplicate is Cmd/Ctrl+D. Tested with a real pointer sequence carrying altKey that starts on a prop.
- **Size handle** is back on the ring (4 o'clock, props only). The expanded ☰ options take even places around it.
- **Walls, doors and windows are ordinary objects.** This replaced my first take, delete/swap commands on edge overrides.
  - A generated piece is an object-like selection (`app.wallItem`). Any op naming it (`wall:<key>`) is expanded inside the same batch (`app.expandWallOps`): `edge.set {key, as:'open'}` hides the generated piece, then `object.place` (with `fromEdge`) puts an object there and the op applies to it. Delete is the override alone. One undo restores the generated piece.
  - Drags materialize first, so the drag previews the object.
  - Placement for `place:'kit'`: snap to the nearest grid edge and its line. A door is scaled to the 5-ft opening less the jambs. Dropping onto an edge with a generated piece hides that piece.
  - **Re-roll** keeps `fromEdge` objects (like pinned). `room.delete` drops the room's unshared edge overrides; `room.move` carries them.
  - **Not handled:** the room solver doesn't know about edits. A re-rolled room may put furniture against a wall that was deleted, or in front of a door that was moved.
- **Knolling library:** plain plane, tidy grid at 90° spaced by size, sections per category plus a walls/doors/windows section per wall family, top-down camera. Each item lies with its biggest silhouette up (`tiltZ` on its side, `tiltX` on its back). The overview shows only the first section, so meshes still load progressively.
- **Room titles** are at the room centre, roof height (building above), fading and click-through over a pawn. Labels and undo chips never sit on the PiP: a label there was swallowing the PiP's drag-outs, which was the cause of a test flake.
- **Build menu → ONE tray** (Genre → Type → Room, two-column grid, breadcrumb). Furniture and object levels are gone (the room's library is where things come from). Shift+G/T/R.
- **Real pointer cursors per tool** (`tools/make_cursors.py`, 32/64 px, hotspot 8,8).
- **The PiP is a movable, resizable window**, remembered per seat. It is clamped below the command bar: the test found a PiP whose title bar had been dragged under the bar.
- **The Build button** is the painted hammer and saw. Gemini's blind read: "claw hammer laid over a handsaw… perfectly readable at 40px".
- **Tiny-tweaks round, same day:**
  - **Cursors:** painted cursor glyphs (Codex: house with pencil, carpenter's square, crate) composed with a crosshair at hotspot (6, 6) by `tools/make_cursors.py`. Gemini's blind read: all three distinct at 32 px; the crosshair now has a thicker outline for light floors. The tool class goes on `<html>` too, so the tray shows the tool pointer the instant a type or room is picked.
  - **PiP input routing:**
    - `View.grab.dom` for the PiP measures the pointer against the PiP's own rectangle;
    - pointer gestures that start in the PiP drive its camera (`pipPress`/`pipPan`), and a library flight stops when the person takes the camera (`library.touched()`);
    - the wheel latches per view for 150 ms; Safari gestures route the same way;
    - `app.pointerView` decides keyboard routing: over the PiP, F frames the picked thing, copy copies it, and everything else is inert except undo/redo, Build, views and help;
    - `#c.over-pip` gives the select pointer and suspends the tool.
    - A pick in the library no longer flies the camera (the thing must stay under the pointer for a drag).
  - **Library:** opens fitted to the whole layout; rows are 64 ft wide (landscape, like the PiP). Fresh libraries still load meshes a few at a time; tested on the guest room's.
  - **Flakes seen and handled in tests:** undo chips fade after 9 s, which at 1–3 fps headless can pass before a click, so the test clicks through the DOM. One two-tab run lost the GM tab's rAF during a transfer probe; the rerun passed 28/28.
- **Library layout v3 (Harry):**
  - every thing has a CELL sized to its footprint AND its label at real world size; long names wrap to two lines;
  - each category is shelf-packed into a near-square block with its title above, and the blocks are packed into one rectangle (tallest first);
  - it is all deterministic from the library data;
  - tested: label rectangles projected at the opening framing never overlap (185 labels, 0 overlaps).
- **Ring v3 for props:**
  - turn · size · pin · ☰ in an arc above the projected bounding box; ☰ becomes × when open, with the core angles kept;
  - the open options take one fixed priority order, and unavailable options are hidden;
  - `RING_SCALE` is 1.2;
  - generated walls/doors/windows use their shell piece's bounds, not the foot point (bug: the ring sat at a wall's foot).
- **Toggles are a registry pattern** (`toggle: { of, is, on, off, mix }`): the title and icon show the action now, mixed selections say "… all", and both wordings are in the bar's synonyms.
- **Load note:** another agent's headless Chromium runs pushed load to ~27 here, and my browser runs starve under that (timeouts, a hung screenshot). I reran when the load fell.
- **Announce-then-settle for say and roll (Harry 2026-10-04):**
  - a line appears big and centred on everyone's screen, stays for `min(8, 1 + words/4)` s, then FLIP-flies into its own chat-log line, which is held invisible (`.line.pending`) until the announce lands;
  - roll layout `Name · expr → total` with the dice small; the nat-20 and nat-1 looks; a queue that hurries when backlogged; click/Esc dismiss; reduced motion fades;
  - `surfaces/announce.js` is registered just before `chatSurface`, so its 'change' handler marks lines pending before the log renders;
  - `browser_announce.py` passes 20/20 locally across two tabs: landing within 0.05 px of the log line and dwell measured at 2.00 s for 4 words.
- **Floor tiles (Harry 2026-10-04):** every flat floor material (27) is a placeable 5-ft tile object (`client/tiles.js`): `place: 'tile'`, `layer: 'floor'`, x/z on a cell centre.
  - **Drawn by the tuner's own `look.floorSpecs`** on a one-cell room at the tile's WORLD cell, so herringbone, checkers and flagstones pick the same crop the room floor would, and painted areas continue; straw keeps its scatter decals.
  - **The shell skips tiled cells** (and their decals), so a tile replaces its cell's floor with no z-fighting. The shell key includes tile cells.
  - **Paint tool:** click, drag a run (4-connected), Shift-drag a rectangle; one batch per stroke (one undo); one tile per cell.
  - **Library:** Floors / More floors sections. **Bar:** catalog entries. `roomgen.sizeOf` is wrapped client-side for `floor-*`.
  - **Behaviour:** re-roll keeps tiles (`core/commands.js`); tiles aren't surfaces for `surfaceBelow`; they rank under everything in `pickAll`; they drag only once selected; marquees prefer non-tiles. Hand-placed rugs were at y = 0, UNDER the generated floor (y 0.02): now 0.04.
  - **Bug found:** modes.js's local `cellOf` (room tool) shadowed the imported one; the import is now `tileCell`.
- **A playtester's bug hunt (2026-10-04):**
  - **Ring drags have a frozen frame:** centre, handle ray, d0 and the start values are fixed on press; no re-layout until release.
    - Size is `softK(d/d0)`, with d projected on the handle ray: monotonic, soft stops at 0.2× and 5×, Shift 25%.
    - A centre crosshair, guide line and % · ft readout.
    - Cause: `position()` re-measured the bounds of the thing being scaled every move, so the centre slid, and the radial distance crossed 0.
  - **Posts are touchable:**
    - shell groups for `c<x>:<z>` posts get an edgeKey, so `wall:c…` selections work;
    - `wallItem` handles posts (kit, free movement via modes `POST`);
    - `EDGE_KEY_RE` accepts `c` keys, with `perimeterKeys`/`shiftKey` updated;
    - a post with no standing wall (an edge still closed, or a materialized wall object) is dropped from the shell.
  - **Invariant test:** in `browser_tiles.py`, a 64×40 screen-point audit runs after building, painting and deleting walls. Its negative control (posts made unpickable again) is caught.
- **Launchers: Pawns and Settings (Harry 2026-10-04).**
  - Build, Pawns and Settings now sit in one row, upper left, all the same size. The painted pawn and gear come from the same Codex route and style anchor (`gen.py` names `tool-pawns` and `tool-settings`; `post.py` now takes a name filter). Gemini's blind read: "hammer and saw, red game pawn, two gears", consistent style, clean keying.
  - Only one tray is open at a time.
  - Pawns is a "coming soon" placeholder.
  - Settings is a left tray shell with Me and Campaign (GM-only) tabs and placeholder tiles.
  - A player who can't build now loses only the Build button. It used to hide the whole `#launchers` row.
  - Tests: a LAUNCHERS section in `browser_build.py`. A tray's slide-in animation shifts `getBoundingClientRect` by 24 px, so the test reads the computed `left`.
- **Settings modal (Harry's spec, 2026-10-04).**
  - The Settings tray shell became the industry-standard modal from docs/UI.md "Settings", with five sections (World navigation, Me, Area, Global defaults, Campaign admin). Players see Navigation and Me only.
  - New core commands, each with core tests:
    - `area.set` and `area.delete`;
    - `campaign.set`;
    - `request.create` and `request.resolve`;
    - `seat.set` now takes a colour.
  - New permission classes: `seat.self`, `request` and `campaign.admin`. Area `grants` are honoured in `canSee`.
  - Play settings inherit through `areaRules` (built-in, then the campaign default, then the area). The relay enforces free moves and touch.
  - Personal prefs:
    - live in the browser (`tw.prefs`);
    - camera speed and invert come from a `GrabCamera` prototype patch;
    - the faces tier is applied at boot (`prefFaces` in main.js);
    - ring size: `setRingScale` in ring.js;
    - announce on/off, speed and reduced motion: small hooks in announce.js.
  - The landing on join is skipped when `navigator.webdriver` is set, unless the URL has `?landing`, so the other suites are not blocked by a modal.
  - `browser_settings.py`: 46/46 locally.
- **Cleanup round (2026-10-04, evening):**
  - **The at-edge ring check was a real bug, not flake.** The screen margin (34 px) was measured to button CENTRES, but at ring scale 1.2 the open circle's buttons are 77 px wide, so a slid-in circle left one button 4 px off the right edge. Reproduced locally by sliding a selected thing to the right edge. The margin is now half a button plus 8 px.
  - **Rotate speed and invert** are applied in `input.js` `rotateView`, the one funnel for Option-scroll, the Safari rotate gesture and Q/E. The orbit drag gets them in `settings.js`.
  - **Graphics tier applies live:**
    - `assets.setFaces` changes the dials in force;
    - `AreaWorld.refreshVisuals` rebuilds object and shell visuals in place;
    - `app.setFaces` runs it on every world;
    - Settings calls it unless `?faces=` is set.
  - **Snapshots live on the relay:**
    - endpoints: GET/POST `/c/<id>/snapshots`, GET `/snapshots/<sid>`, POST `/snapshots/<sid>/delete`; GM only (`isGmSide`), at most 50;
    - storage: `<data>/<campaign>/snapshots/`;
    - the client posts as text/plain to avoid a CORS preflight;
    - nginx `/api/tw-relay/` `client_max_body_size` went from 1m to 8m (backup in the scratchpad; `nginx -t` then reload).
- **LLM seats, from the Dawnhaven session (2026-10-04):**
  - **Feet everywhere in the GET API.** `room.spawn` x/z/w/d and `room.move` dx/dz are feet in multiples of 5, the same as `state` reports. Cells only by name (cx/cz/cw/cd, cdx/cdz).
    - One release of compatibility: `units=cells`, or values that aren't multiples of 5, read as the old cells and return a deprecation `note`.
    - The conversion lives in `relay/llm.js` (`toCells`); the core stays in cells.
  - **Ids may be left out for creating commands** (`MINT`: token/object/room/msg/area/seat/req). The relay mints one, derived from the nonce so a retry gets the same id, and returns it as `id`. A malformed id names its prefix.
  - **Waking on says and rolls:**
    - `…/a/<area>/changes?kinds=chat,roll` and campaign-wide `…/c/<id>/changes?kinds=chat,roll&after=CURSOR` (a cursor of `area:seq` pairs);
    - other changes don't wake the follower;
    - each event carries `by`, `byKind` (human/ai), `you`, area, and text or roll.
  - **The card's ETIQUETTE FOR AI SEATS FAQ:** do nothing most of the time; never answer yourself, or another AI unless named; 2 messages a minute; prefer doing; ask the GM in one line.
  - **Relay guardrails** (`campaign.js` `chatGuard`/`noteChat`, AI seats only): 3 says/rolls a minute and 20 an hour (`rate_limited`). Two AI seats alternating more than 3 times with no human message are both paused 60 s (`throttled`); a human message resets the count.
  - Tests: `relay.test.mjs` 67/67.
- **Presence selections + live ratings (2026-10-04):**
  - **Presence carries `sel`.** The sender keeps the last one per area. The relay strips hidden ids for non-GM receivers and keeps `lastPres` for `GET /c/<id>/presence`.
  - **Remote selections are drawn by a second shared-selection instance** with `REMOTE_LOOK`: brackets, 40%, still, no ghost. This is an engine-side preset, so no tuner deploy was needed; it could become a fifth state in `fx/selection.js` later.
  - **`applyRatings`** (core/roomgen.js) lays the ratings server's `<src>/<sku>/model` records over library.json in the client (`loadTuner`) and the relay (`loadRoomgen`, then every 60 s). The engine version includes the ratings digest, and client and relay agree (v2-4fde6eb7). Live check: `crate--s1` is 2★, out of `sizeOf` and out of 6 storeroom solves.
- **Settings keys + area thumbnails (2026-10-04):**
  - S plus the N/M/A/G/C chords (`kbd` on the entries).
  - `core/framing.js`: `structureBox` (greedy outlier drop, 85% cover) and `fitDistance`; `engine/test/framing.test.mjs` 7/7.
  - `client/thumbs.js` renders through `app.beforeViews` (the start of the next frame), so the views paint over the corner in the same frame with no flash. It reads back with `readPixels` (real tone mapping), rows flipped, then `toBlob` WebP.
  - Relay `/thumb` and `/thumbs`, plus a proper CORS preflight (OPTIONS).
  - Tests: relay 78/78, settings 56/56.
- **Settings live flakes, root cause (2026-10-04, late):** four different single checks failed across live runs: rename, deny, approve-import, and Open in PiP. Running three suites in parallel against live made them fail reliably.
  - **The cause, in two parts:**
    - the modal re-rendered whole on every campaign refresh and when the thumbnail list arrived; a redraw landing between press and release replaced the button, so the click was lost;
    - the long "no picture yet…" caption wrapped, so the arrival of the thumbnails shifted the rows.
  - **The fix (`settings.js`):**
    - a redraw that arrives while a pointer is down waits for the release;
    - an unchanged redraw leaves the DOM alone;
    - the caption is short and on one line.
  - **Result:** two batches of three parallel live runs, 56/56 each time (6/6).

## 2026-10-05: Outdoors: the Yard in the game
- The Yard is a tuner room type (`tools/spawn-tuner/ROOMS.md` → Outdoors), so it reached the game through the shared code: *Fantasy → Tavern & inn → Yard* in the Build tray (its recipe is `tav-yard`), a painted icon (`data/icons/room-yard.png`, same Codex route as the other 28, keyed on magenta because the subject is green), its library area (the yard's things; its ground materials first under Floors), `Build yard` in the bar.
- Engine edits, three lines: `pack.js` never packs a yard into a building's footprint; `library.js` has a **Plants** section (empty until plant meshes exist); `core/roomgen.js` is untouched.
- A yard builds no walls: `walls.computeEdges` leaves its open edges out of the edge map, so the shell has nothing to draw there, and a wall shared with a building is the building's. The neighbours' doors open onto it by the same edge map. For the atmosphere it is an outdoor room (`fogRooms()` marks it by `walls.isOutdoor`): outdoors for wind and fog, but built ground, so the fog sea over the unbuilt world does not lie on it (measured in the tuner, `yard_ui.py` Y8).
- **Not done:** a yard is not laid out again when a neighbour arrives later (the tuner does this). Build the yard after its buildings, or re-roll it. Hay and other floor decals placed by a layout are still hard cut-outs in the game (the floor's own scatter, including the new grass tufts, is soft).
- Tests: `core.test.mjs` 121 (a yard solves deterministically, builds no walls, has the sign and a focal thing, ground floor); `browser_build.py --local` 85 (the tray node and its library list; a yard spawned in the game has 30 ground tiles, 22 open edge segments, no wall pieces).

## 2026-10-05: rooms turn, drag and hide; ☰ goes multi-level; conditional buttons (Harry's list of the day, stage 1)
Spec: docs/UI.md "Rooms: turn, drag, hide", "☰ is multi-level", "Conditional buttons", "Wall pieces and posts".
- **How a turned or moved room keeps its furniture.** A room's furniture was never re-derived: `room.spawn` stores the creator's layout as object entities (`room = <id>`), and clients only re-solve the seed to compare hashes. So `room.move` (already there) and the new `room.rotate` transform the stored things and never solve anything. What the user moved, added, pinned or deleted survives because it is the same entities.
  - `room.rotate {id, turns}`: quarter turns clockwise about the centre. `turnPlan` composes the map for k turns from the ORIGINAL rectangle. When width − depth is odd the centre is half a cell off: the snap floors on the 1st and 3rd quarter and ceils on the 2nd and 4th, so two turns are an exact half turn and four are the identity (tested).
  - It turns the room's objects (position, `rot`, `fromEdge`), and its own wall edits (the edge overrides no other room shares) by mapping their keys (`h:x:z` ↔ `v:x:z`, `c x:z`).
  - `recipe.turn` (0..3) is kept so `walls.chooseExteriorDoor` picks the sticky outside door in the room's own frame: the door stays on the same wall OF THE ROOM. Turn 0 is the old behaviour exactly (the tuner suites are unchanged).
  - Windows are still keyed by world edge, so they re-roll when a room moves or turns (they already did on a move). Interior doors re-form against the new neighbours. A door can therefore land behind furniture after a turn; the layout is not adjusted.
  - **Bug fixed in `room.move`:** wall edits were carried one at a time (drop, then put), so an edit moving onto its neighbour's old key was dropped when the neighbour moved. Now two passes (`carryEdges`).
  - `moveBy` keeps `object.room` current (a thing dragged into another room becomes that room's), orders a building's rooms front-first so they do not step on each other mid-batch, and refuses an overlapping room move with a message instead of leaving it to the relay's nack.
- **Room drag.** A dragged room is ONE presence drag entry (`{id: room, x, z}` at its would-be centre). `AreaWorld.frame` derives everything from it, for the dragger and for other seats alike: the room's shell pieces and things are offset, its selection brackets follow, and a footprint plate is drawn (the dragger's colour; red locally when `ok === false`). The 64-entry cap on presence drags no longer truncates a big room.
  - The label is DOM over the canvas, so `input.js labelPress` starts an ordinary press gesture and follows it on the window (no pointer capture, so the label's own click and double-click still work).
- **Hide.** `entity.flag {hidden}` cascades in the core: a room id takes its objects and lonely edge overrides, a building id its rooms. `object.place` into a hidden room and `room.reroll` of one produce hidden things. `areaForClient` also drops a building with no visible room.
  - Shell: `buildShell` computes edges from the VISIBLE rooms (what a player's client computes anyway) and, on the GM side, adds the edges that only hidden rooms own. So GM and player draw identical walls for everything visible, and the hidden room's pieces get `hidden` (ghosted, plus the house `hidden` look through `sharedSignal`).
  - Considered and rejected: sending players a stub of the hidden room so shared walls match the GM's full picture (leaks the footprint), and forcing the shared edges to plain wall for players with synthetic edge overrides (a tell, and lifecycle to manage).
- **Selection look for rooms.** `volumeItem` is a bare root at the room's centre with `dims`; the shared selection module measures a thing with no meshes by its `dims`, so brackets, the hover footprint and their ghosts come from the same code as for things. The box is 0.6 ft outside the grid line so the brackets clear the walls' outer faces. Fallback (no module): the old floor outline.
- **☰.** `client/menu.js` is the one table. `planOf` fixes where every menu command sits and its chord letter over ALL commands (not per selection), `menuFor` filters by what applies. The ring, the flyouts and `keys.js` read it. `flyout` is one component: arc for ≤ 7 tiles, grid panel beyond; a sub-list replaces the content with a Back tile; a drag tile (raise / lower) keeps the flyout through the gesture (`.holding`).
- **Conditional buttons.** `surfaces/condbutton.js`; `undochips.js` is now 40 lines of "when, where, what".
- **Pieces.** `modes.postSnap` (crosses and edge midpoints), `placementAt({free})` for Shift, group steps of 5 ft (posts 2.5), turn notches at 45° with ticks in the guide SVG.
- **Label sizes.** Doubling the building tags as well pushed room labels off screen at overview zoom (the collision pass hides a label with no place). Building tags stay 13 px; labels get thirteen candidate places instead of five.
- **Found:** `edit.rotateBack` (Shift+R) had `when: touchable`, true for a GM with a room selected, so it swallowed Shift+R as a no-op. Now it applies to things and pawns only.
- **Scratch note:** the session scratchpad is shared between agents; another agent overwrote a file of mine named `dbg.py`. Use a subfolder.
- Tests: `core.test.mjs` (+31: turn, move, hide), `engine/test/browser_rooms.py` (new, two tabs), `browser_ui.py` updated for the grouped menu, `engine/test/audit.py` (the touchable audit, shared).

## 2026-10-05: overlapping draws make L-shaped rooms (stage 2)
Spec: docs/UI.md "Overlapping draws make L-shaped rooms".
- **How deep the rectangle ran.** Everywhere: overlap checks, `perimeterKeys`, `roomAt`, floor picks, labels, fog, the selection glow, the solver's whole coordinate system (`X0..X1`, four lettered sides, `sidePoint`). Mapped by a read-only agent before any edit.
- **Representation.** `recipe.outline`: one closed polygon of grid points, cells relative to (x, z), clockwise from the top-left corner; absent for a rectangle. The bounding rectangle stays as x, z, w, d. Chosen over "rectangle + notches" and over a cell bitmap because Harry wants slanted outlines later (towers, ships): a polygon of grid points is that format already, and cells are derived by testing cell centres, which works for slants too. `core/footprint.js` is the only place that knows the shape; everything asks it (`cellsOf`, `contains`, `overlap`, `boundary`, `perimeterKeys`, `innerRect`, `rectsOf`, `labelPoint`, `polyFeet`, `piecesOf`, `turnOutline`).
  - Validation: re-trace the outline from its cells and compare, which rules out holes, pinches (two parts meeting at a corner), wrong winding and extra points in one go.
- **The solver was not rewritten and barely touched.** A shaped room is cut into rectangles (`rectsOf`: the largest inside it, then greedily the rest). Each is solved by the ordinary rectangular solver: the first as the room, the rest with `annex: true` (three lines in `solver2.attempt`: skip the key purpose). Where two rectangles meet, both get a JOIN: an opening of kind `door`, as wide as the meeting, flagged `join`, so the existing door machinery keeps it clear; `pickMainDoor` prefers a real door. Real doors and windows go to the rectangle whose wall they are in, by wall key. Yards use kind `join` (ignored: open ground).
  - Why not block the notch in the bounding box's grid: wall-hugging placement walks the four bounding sides, so the inside corner's walls would never get furniture without re-plumbing `sidePoint` (about 24 literal side tests and six side maps); and Harry's own rule for odd rooms is "the largest rectangle inside is the room".
  - Rectangles are byte-for-byte unchanged: the deploy gate's hash for common 6x4 seed 4242 is still `505500e0`, and the tuner suites pass untouched.
  - A last filter in `roomgen.solve` drops anything of a shaped room that pokes past its outline (found: `mount()` hangs a 5-ft rack on a 4-ft wall in a one-cell-deep annex; it does the same in a 5-ft-deep rectangular room).
- **Walls.** `walls.perimeter` follows `room.cells` (given by `roomgen.roomsOf`); segments carry `line` because (side, index) is no longer unique. `chooseExteriorDoor` and `yardDoors` keep a wide door on one straight wall. Corners were already vertex-based, so the inside corner's post came for free.
- **Measured** (`core.test.mjs`): 66 L-shaped rooms (11 types x 6 seeds, beside a neighbour): nothing outside or over the outline, every door walkable to, every rectangle more than half walkable, all 66 use an inside-corner wall. 72 more (U, notched side, small L, big L): nothing outside or over the outline.
  - The walkability audit is stricter than what the solver promises (a 0.6-ft person on a half-foot grid); plain rectangular kitchens and dormitories fail the stricter versions of it about as often as shaped ones.
- **Gemini's blind read of three L rooms** (common, guest, kitchen): outline has six corners, floors distinct, walls and a post at the inside corner, nothing in the notch, furniture against both inside-corner walls, label over the room's own floor. Its complaints: in the kitchen the way from the door to the far part is "blocked by large tables"; it counted brackets at three corners (the camera hid the rest; the test counts 36 segments, the inside corner among them).
- **Clipped draws.** `modes.roomPlan` = `piecesOf` + the choice (larger piece; tie: where the drag began) + the refusals (inside, hole). `AreaWorld.showCells` is the reusable lit-squares indicator.
- **GET API.** `clip=1` and `outline=` on `room.spawn`; `state` reports `outline` in feet.

## 2026-10-05: Stage E, the depth look (focus below the level in view) — in the tuner, not yet wired to a cut
- **What it is.** `tools/spawn-tuner/js/fx/depth.js`: one full-screen pass. Each pixel's world height is rebuilt from the depth
  buffer; what is below the focus height blurs (radius = min(max, strength x (below / 10 ft) ^ curve), in px at 1080 px of
  view height) and dims (max(floor, 1 - per10 x below / 10)). At or above the focus height nothing changes (measured: 0.00).
  A sample only counts when the SAMPLE is itself blurred that far, so sharp things above never smear onto what is below.
- **The game's side.** `world.fx.depth.setFocus({ focusY })` with the floor height of the level in view; `null` = off.
  `setFocus({ focusY, dimOnly: true })` forces the dim-only fallback for one view. Off, the pass is disabled in the stack
  (5 post passes with or without the module). The house look is field `depth` of `GET /tuner/house`; fx/index.js fetches
  it for the game by itself (as it does the water), so engine/client needs nothing but the `setFocus` call.
  `server/ratings_server.py` HOUSE_FIELDS gained `depth`: tw-ratings must be restarted with the deploy.
- **Where in the stack.** After the scene, water, contact shadows, fog and shafts; before bloom, tone mapping and
  anti-aliasing (three lines in lighting.js: `setDepthPass`). With Lighting FX off there is no stack: `depth.renderPlain()`
  draws the scene into its own 4x anti-aliased buffer the size of the renderer's viewport and puts it on screen through
  the same shader (fx/index.js `render`). Fog and smoke drawn by the plain path go on top unblurred.
- **Limit:** anything that does not write depth (sprites, see-through materials, the selection lines) takes the depth of
  what is behind it. Labels are DOM, so they are unaffected.
- **Tuner panel "Depth"** (generic panel + `fx/depthpanel.js`): blur at 10 ft, growth curve, most blur, sharp-for-this-far,
  samples (8/16/32), dimming per 10 ft, darkest, dim only; built-ins miniature, gentle, dim-only, off; Use in game. A focus
  height slider stands in for the cut, and **Depth demo** lifts every second room's drawn pieces 10 ft (a demo aid only).
- **Cost** (RTX 3060, 1620x1076 canvas, two rooms, uncapped, box under load ~8): Lighting FX on: off 6.7 ms, 8 samples 7.0,
  16 samples 8.1, 32 samples 9.3, dim only ~7-8 (noisy). Lighting FX off: 4.3 ms off, 3.9-4.9 with the look (inside noise).
- **Tests:** `tools/spawn-tuner/test/depth_ui.py` 8/8 on the GPU (needs an API with the new house field: run a copy of
  ratings_server on another port until tw-ratings is restarted). 16 samples leave a faint pattern at the largest radii
  (fine-scale edge energy stops falling past ~12 px; the coarse measure keeps falling): 32 is there for that.
- **Gemini, blind, on the demo:** "shallow depth of field. The room in the upper right is in sharp focus ... The room in the
  lower left is heavily blurred and out of focus." It called nothing in the scene see-through (only the tuner's HUD boxes).

## 2026-10-05 (evening): storeys — the plan and the data design (lead's notes; every stage agent works from this)
Spec: docs/VERTICAL.md plus Harry's seven answers of 2026-10-05 (in the stage briefs). Stages: A data, B stacking and build
mode, C the cut, D stairs, E depth look (tuner), F roofs, G follow-ons. Each stage: tests, deploy, live check, a note here.

**The data (Stage A). All heights in feet. Nothing stores a "floor" for a pawn.**
- `room.recipe.y`: the room's floor height (integer, a multiple of 5; absent = 0; negative = below ground). `room.recipe.tall`:
  how many storeys the room spans (integer ≥ 1; absent = 1). A tall room is ONE room.
- `building.base` (ft; absent = 0) and `building.storey` (ft floor to floor; absent = 10: 9 ft wall + 1 ft slab). Set with
  `building.set`. A room's storey number is derived: `floor((y - base) / storey)`; 0 = the building's ground floor, -1 = the
  first below. Shown to people as "lv 1" for storey 0, "lv 2" for 1, "lv -1" for -1 (no lv 0).
- Objects and pawns already carry `y`; it is the ABSOLUTE height. A thing in a room at y = 10 standing on its floor has y = 10.
- `core/height.js` is the ONE rule file: `roomY`, `roomHeight`, `roomTop`, `storeyOf`, `levelLabel`, `floorUnder(entities, x,
  z, y)` (the room floor a point at height y stands over: the highest room floor at or below y + 0.5 whose footprint holds
  the point; null = open ground at 0), `tokenFloor`, `ceilingOf(room)` (= top − 1: the underside of the slab above; this is
  the number a cut is set to), `visibleAt(baseY, cut)` (= cut == null || baseY <= cut).
- Two rooms overlap only if their footprints overlap AND their height spans [y, top) overlap.
- An upper room (y above its building's base) must stand on something: every one of its cells within two cells of a cell of
  a room whose top is its y. Below ground anything goes. Checked in the core for `room.spawn`.
- Wall keys gain a level suffix: `h:x:z@<y>`, `v:x:z@<y>`, `c<x>:<z>@<y>`, y = the room's floor height, omitted at 0, so every
  key in every saved campaign is unchanged. Walls are worked out per height: rooms at the same y share walls and doors; a
  room on a half-step (y = 5 inside a 10-ft storey) gets its own walls (allowed in the data, not polished).
- Above the building's base a room gets no outside door; below ground no outside door and no windows.
- `room.move` takes an optional `dy` (feet, multiple of 5). `token.move`'s y may be negative.
- Hidden rooms are already the unit of reveal (relay-filtered); a hidden upper or lower room, its things, its wall edits
  and its stair are not sent to players. Tests prove it for y ≠ 0.

**The view (Stage C), per client, never synced.** `app.cut` = { y: number | null, pinned: bool }. Visible = base ≤ cut. A room's
things follow their room (a stair that pokes through the cut is shown whole with its room); loose things and pawns go by
their own y. Only a double-click, floor up / down, the "Cut to lv N" offer and "Roofs on / off" ever change it.
- Roofs are a per-seat view switch (off by default, so today's open-topped look and every saved campaign look the same);
  with roofs on, a roof shows when the cut is off or above it.
- Ground: whole unless the cut is below 0; then it opens over the below-ground rooms being shown.

**Derived pieces, never entities** (like walls): floor slabs, jetty brackets, support posts, roofs and their props, the hole a
stair cuts. Stairs themselves are objects (`place: 'stair'`, `rise` in ft) that belong to the lower room.

## 2026-10-05 (evening): storeys, Stage A: height in the data, the relay and the AI seats' interface
Spec: docs/VERTICAL.md "Built: Stage A"; API: docs/NETCODE.md "Height and storeys". Developed in the worktree `../3d-vtt-storeys` (branch `storeys`).
- **`core/height.js`** exports: `STOREY, SLAB, STEP, MAX_Y, MAX_TALL, roomY, buildingOf, baseOf, storeyHeightOf, roomHeight, roomTop, ceilingOf, storeyAt, storeyOf, levelLabel, visibleAt, spansOverlap, spanOfArgs, roomClash, floorUnder, tokenFloor, supportProblem, buildingAt, levelsOf, heightProblem`.
- **`core/footprint.js`** key helpers: `levelSuffix(y)`, `keyLevel(key)`, `keyBase(key)`, `keyAt(key, y)`. `perimeterKeys(rc)` is at the room's height; `boundary(rc)` stays flat (no suffix).
- **`roomgen.edges(entities)`**: one `walls.computeEdges` per height, merged; off the ground `e.key`, `spanKeys`, `spanOf` and openings' keys carry `@y`, and every edge and corner has `.y`. With every room at 0 it is the old single call. `roomgen.solve` solves against the rooms at the same height with FLAT keys, then adds the room's y to every object's y (a pinned thing's y is taken back down for the solver).
- **`walls.js` (tuner, opt-guarded, defaults identical; gate hash 505500e0 unchanged):** `computeEdges(rooms, { sealed: Set<roomId>, noWindows })`. A sealed room is never given an outside door; a level where every room is sealed is entered at its oldest room for the reachability pass.
- **`world.js`**: shell specs are lifted by their room's / edge's / corner's y; corner uids and keys get the level suffix; tiles replace floor cells per height; `slabSpec` / `slabVisual` make the floor slab as a shell entry with its own maker (`s.make`), which `refreshVisuals` and `setGhost` use through `shellVisual`.
- **Relay:** a GET `room.spawn` without a building now joins the building it touches or stands on, or starts one. `edge.set` on a wall that only hidden rooms own makes a hidden edit (it used to reach players: found by the new test; true of flat rooms too).
- **Label stripping:** `building.set` now reaches label-blind seats with its heights and without its name.
- **Traps for the next stages:**
  - `world.pickAll`'s floor pick and every "ground point" still use the plane y = 0. Labels sit at one height. The ground plane covers below-ground rooms. All Stage C.
  - The client's `app.buildingFor` and `app.spawnRoom` do not pass y yet: use `H.buildingAt(entities, rect, H.spanOfArgs(entities, args))` and pass `y`, `building` into `roomgen.solve` (it needs `building` to know the base).
  - `roomgen.solve` must be given `y` on a spawn (it reads the old recipe's y only on a re-roll, i.e. when `x` is absent).
  - Presence drags, drag plates, `flashRect`, `showCells` callers and `volumeItem` (selection brackets) draw at y = 0.
  - `tall` is stored and counted in overlap and support checks, but walls are one storey high.
  - Tests that compare with pre-storeys code (`migrate.test.mjs`) leave out campaigns that use height.
- **Gemini's blind read of the Stage A screenshot** (three rooms on one footprint, no cut yet): it read the three stacked LABELS as three floating slices and placed the cellar on top. Measured heights are right (floor 10.02, slab 9, cellar -9.98). The picture cannot read well until the cut and level-aware labels exist; not acted on.
- **Tests:** core 233, relay 114, migrate 315 (170 campaigns byte-identical, 130 named Dawnhaven), harness 5/5, `browser_rooms.py` 101/101, new `browser_storeys.py` 15/15 (local, GPU).

## 2026-10-05 (evening): storeys, Stage B: stacking and build mode (branch `storeys`, not landed)
Spec: docs/VERTICAL.md "Stage B"; use: docs/UI.md "Building on levels".
- **`app.level`** (feet, per client): `app.setLevel(y)`, `app.levelUp()`, `app.levelDown()`, `app.levelInfo()` → `{ y, label, building, step, exists, isNew, lo, hi, tool }`, `app.focusBuilding()`; `app.emit('level', y)` on every change. Commands `level.up` (`]`), `level.down` (`[`), `level.ground`. Seam for the cut: `app.floorMax()` (not defined yet; when it exists, floor picks ignore floors above it) and `world.setGroundOpen(on)`.
- **`world.floorPoint(ray, { level, max })`** → `{ x, z, y, room }`. `input.js` `groundOf` returns `[x, z]` with `.y` and `.room` on the array, so every old caller still works. A drag keeps to the plane it started on (`planeOf`); at release the free floor under the pointer decides whether the things change height (`endMove`, `app.moveBy(..., { dy })`, `app.lastDrop`).
- **`app.roomAt(x, z, y)`** is `HT.roomAtHeight`; `app.roomClash` compares heights too; `app.buildingFor(x, z, w, d, y)` is core `buildingAt`; `app.spawnRoom(..., outline, y)`; `app.floorYOf(e)`; `app.liftTo` lands on the floor of the storey.
- **Core:** `supportAt(entities, y)` → `{ any, on, out, ok }` is the one support test (`supportProblem` and the room tool both use it); `roomAtHeight`.
- **Supports:** `world.supportSpecs` makes shell pieces (`spec.support = 'bracket' | 'post'`, `userData.roomPiece`); `pickAll` returns them as their room. `SUPPORT_KIT` in `world.js` names the catalog ids; `world.supports()` lists what is drawn. Today: posts are the real `post-timber`; the bracket is a plain box (`bracket-box`) because neither `jetty-bracket` nor `corbel-stone` is in the library; a stone building's buttress falls back to `pillar-square`.
- **Ground:** `rebuildGround` replaces the ground plane's geometry with quads that leave out the cells of below-ground rooms (no triangulation of holes). The 5-ft grid lines still run across the opening.
- **The room tool on a level:** squares too far out are fed to `footprint.piecesOf` as one-cell blockers, so clipping, the larger-piece rule and the messages are the flat tool's own. `modes.validCells()` lists the lit squares; `showCells` takes `opacity` and holds 1600 squares.
- **Shell key** now includes each room's y and tall, building base / storey and each tile's height (a `room.move` with `dy` did not rebuild the shell before).
- **Traps:**
  - `[` and `]` belong to a selected pawn's HP; the level commands step aside then.
  - Valid squares are per AREA, not per building: any room whose top is at that height carries.
  - Before the cut exists, a drag across a spot covered by an upper floor lands upstairs (the floor you can see).
  - A thing's visual is built with its height counted from its room's floor (`world.inRoomFrame`), so hung things keep their chain upstairs.
- **Gemini's blind read** (two-storey inn with a jetty, table distance): "a two-story, half-timbered building. The upper floor overhangs the lower one and is supported by large, angled wooden brackets. The building is not floating but is cut through, with the roof and some exterior walls removed". It did not mention the posts.
- **Merged main at 8f8da1f** (ring menu flat again, raise / lower hardened, per-room fog, crypt type). `surfaceBelow` keeps main's sprite fix (`rc.camera = RAY_CAMERA`) with the floor-relative reach; `floorPoint` is arithmetic on the ray (no three.js raycast), so sprites cannot reach it.
- **Tests after the merge:** core 252, relay 114, migrate 315, harness 5/5; browser (local, GPU): storeys 39/39, rooms 118/118, UI 84/84, tiles 37/37, build 87/87, lift 17/17, lift endings 29/29. A worktree needs `engine/client/data/icons` linked from the main tree (PNGs are git-ignored) or `browser_build.py` fails its icon checks.
- **Frame time** (`perf_storeys.py --uncapped`, RTX 3060, 1920x1080, before the merge): flat inn median 12.8 ms (73 fps, 939 draw calls); with two upper rooms 15.5 ms (59 fps, 1204 draw calls).

## 2026-10-05 (night): storeys, Stage C: the cut (branch `storeys`, not landed)
Spec: docs/VERTICAL.md "Stage C"; use: docs/UI.md "The cut".
- **State** lives in `client/surfaces/cut.js`: `app.cut = { y, pinned }` (y = a ceiling height, core `ceilingOf`; null = off), `app.roofs` (a per-seat switch; Stage F draws them). Per area, kept in localStorage `tw.cut.<campaign>.<seat>`. `app.setCut(y, { pinned, by })` is the ONE writer and logs to `app.cutLog`; `app.cutToRoom(room, by)`, `app.cutToPawn(token, by)`, `app.cutOff(by)`, `app.floorStep(±1, by)` / `floorUp` / `floorDown`, `app.setRoofs(on, by)`. Readers: `app.cutHides(entity)`, `app.roomCovered(room)`, `app.cutLevels()`, `app.cutInfo()`, `app.cutBar()` (tests), `app.depthFocus()`, `app.floorMax()`. Event `'cut'`.
- **World** (`world.js`): `setCut(y)`; `cutSets()` works out `cutHidden` (rooms above the cut) and `coveredRooms` (wholly under a visible floor, or under the unopened ground) when the cut or the rooms change; `cutPass()` runs every frame after the spawn animation step and sets `group.visible` (flag `userData.cutHidden`), so an animation that makes a piece visible cannot un-hide it. `pickAll` runs `cutPass` first (a click can arrive before the next frame). `surfaceAt` / `surfaceBelow` leave hidden things out; the sprite guard is untouched. `floorPoint` takes the cut as `max`, and with the cut below 0 a ground-floor room no longer shields the cellar under it. `rebuildGround` opens only over below-ground rooms the cut shows. `fxItems` (lamps) leaves out hidden and covered rooms. `cutReport()`, `litCount()` for tests; `noLampRule` for measuring.
- **The level tie.** `level.up` / `level.down` (`]` `[`, plus `}` `{` which also work with a pawn selected), the indicator's arrows and the Build tray's stepper all call `app.floorStep`. With a room or building tool live that is Stage B's level stepper followed by a pinned cut at that level's ceiling; without a tool it walks the levels that exist (`app.cutLevels`, from the seat's own entities), and one step above the top is "all levels". `applyLevel`'s `setGroundOpen(level < 0)` still runs; `setGroundOpen` ORs it with "the cut is below 0".
- **Double-click** (`input.js` `app.cutTargetAt`): the first pick decides. A floor, a wall, a thing in a room, a pawn in a room: that room. Nothing but ground: off. A loose thing outdoors: no change. The old "step inside" selection still follows.
- **Offers** (`condbutton.js` gained dock `bottom2`): a pawn's floor is `tokenFloor(...).floorY`, or the 10-ft band of open air it is in. The change is seen on the area's 'change' event; the GM's offer waits for the GM's own `token.move` entry (either order), so only the last pawn the GM moved offers. No offer when already cut to that level.
- **Depth look:** `fx.depth.setFocus({ focusY })` with the highest visible room floor when it is above the ground (or, below ground, when deeper rooms show beside it); null otherwise, and the pass leaves the stack. The PiP renders plainly (no stack), so it has no depth look; with a PiP open the main view still draws through the stack into its own viewport (tested).
- **The PiP keeps off the bottom 46 px** (`PIP_FOOT` in main.js: clamp, resize, and stored rectangles pass through the clamp when read).
- **Traps:**
  - Shell pieces follow `s.roomId`. A support's room is the room it holds up, so it hides with the upper room although it stands below the cut.
  - A double-click needs the canvas: the indicator, labels and conditional buttons stop it.
  - `tw.select` now drops ids the cut hides (wrapped in cut.js).
  - The migrate test compares with main at ee461e8 (the last commit before storeys); move that when main gains another data-changing command before landing.
- **Stage D (stairs):** a stair belongs to the lower room, so it shows whole with it. To let a pawn be dropped on the stair's top with the cut at the lower level, look at `floorPoint`'s `max`. The offer already fires on any floor change, a stair included. A pawn above the cut is simply not drawn: decide whether it needs a marker.
- **Stage F (roofs):** `app.roofs` and `world.setRoofs(on)` / `world.roofsOn` exist and do nothing yet. A roof's base is its room's top (`roomTop`): show it when `roofsOn && visibleAt(roomTop, cut)`. Add roof meshes to the pick lists in `pickAll` with `userData.roofOf`; a selection id like `roof:<roomId>` (as `wall:<key>`) fits `app.ent`, and `app.cutHides` needs a line for it. `cutTargetAt` should treat a roof hit as "this building: cut to its top storey". The "Roofs on" button's `when` reads `app.roofs`.
- **Gemini, blind, on a two-storey inn with a cellar (1920x1080, table distance):**
  - cut at lv 2, depth look off: "a single floor of a building, presented as a cutaway model ... rooms labeled Guest room (twice), Common room, Kitchen, Cellar / pantry" (it read the labels of the rooms underneath as rooms of this floor: covered rooms now carry no label);
  - cut at lv 1: "a cutaway view of the ground floor of a long, rectangular building ... The roof and any upper floors have been removed";
  - cut at lv -1: "only a single room on a lower level is visible ... Cellar / pantry ... the rest of the building hidden from view";
  - all levels: "a two-story, timber-framed building ... roof and some ceilings removed";
  - cut at lv 2 with the depth look: "The inn, its furniture, and the text labels are all in sharp focus ... the dark, gridded background plane that the building rests upon is slightly blurred"; it called nothing see-through but the missing roof. It read the indicator's text correctly in every picture.
- **Frame time** (`perf_storeys.py --upper --uncapped --seconds 8`, RTX 3060, 1920x1080, fog on, box load 2-4; new flags `--cut <ft|off>` and `--no-lamp-rule`): all levels 14.2 and 16.4 ms median in two runs (1,208 draw calls, 6.4 M triangles); the same with the lamp rule switched off 14.9 and 16.2 ms (in that scene no room is wholly covered, so the rule changes nothing until a cut hides a storey); cut at lv 1: 12.8 ms (938 draw calls, 4.75 M triangles, 65 fewer lit things); cut at lv 2 with the depth look on: 14.5 ms. The depth look's cost is inside the run-to-run noise (about 2 ms).
- **Tests:** `browser_cut.py` 96/96 (new). After Stage C: core 252, relay 114, migrate 331, harness 5/5, rooms 118/118, UI 84/84, tiles 37/37, build 87/87, announce 20/20, lift 17/17, lift endings 29/29, storeys 39/39, settings 66/67 (the known thumbnail check). Changed in older suites: `browser_build.py` renames with F2 and expects the PiP to stop 46 px above the bottom; `browser_storeys.py` expects the ground to follow the cut, and two of its raise checks no longer depend on what the upper room's random seed puts under or over the crate (a rug, a hung lamp).

## 2026-10-05 (night): storeys, Stage D: stairs (branch `storeys`, not landed)
Spec: docs/VERTICAL.md "Stage D"; use: docs/UI.md "Stairs"; API: docs/NETCODE.md "Stairs in the commands and the GET API".
- **`core/stairs.js`** (pure): `STAIR_KINDS` (straight: 2 squares; half; ladder: 1 square), `isStair`, `stairTop`, `stairKind`, `stairDir`, `stairCells(s)` (low end first), `stairEnds(s)` → `{ foot, top, footCell, topCell }`, `stairsOf`, `holesAt(entities, y)` (Set of `gx:gz`), `stairLinks` → `{ from, to }`, `stairsTouching(entities, room)` → `[{ stair, as: 'lower' | 'upper' }]`, `hasStair`, `stairBlocks` (what the solver must keep clear), `stairPiece(lib, kind, family)`, `planStair(entities, room, { doors })` (`planStair.why` when null), `stairHop(entities, x, z, floorY)`, `stairInfo`.
- **Data:** an object with `place: 'stair'`, `rise`, optional `stair` (the kind), `room` = the lower room, `dims = [width, rise, run]`. At `rot` 0 it climbs toward +z; three.js turns +z about Y, so quarter turn q climbs toward `[[0,1],[1,0],[0,-1],[-1,0]][q]`. Squares, hole and ends are derived.
- **The solver was not touched.** `roomgen.solve` appends `stairBlocks(entities, room)` to the pinned things it already passes as locked placements: the stair plus one square at its foot for the room it stands in; the hole plus one square at its top for the room above. So a spawn must be solved with the stair ALREADY in the entity map: `app.spawnRoom` and the relay plan the stair against a stub room first (`roomgen.stairFor(entities, stub)`), solve with it, send `room.spawn`, then `object.place`.
- **`roomgen.stairFor(entities, room)`** = `planStair` with every door as a point at its height (so none lands in a doorway) and the piece for the lower room's wall family. `.why` when null.
- **Furniture is never removed.** First cut asked for squares with NOTHING on them: on furnished 30 x 20 ft inns that leaves 1 to 4 free squares and hardly ever two in a row (21 of 30 got anything, 10 flights). Now a square is free when furniture covers at most 2.5 sq ft of it and no thing's centre is in it: 29 of 30, 22 flights, 7 ladders. A cellar drawn wholly under a furnished room often finds no spot (the room above is full): the message says to place one by hand.
- **World:** floor tiles and the slab skip `holesAt(ents, y)` (the slab falls back to one box per square when it has a hole); the shell key includes the stairs; `rebuildGround` always opens the squares of a stair that comes up at 0 where no ground-floor room stands (and runs on every shell rebuild, not only while the ground is open). `visualOf(e)` picks the stair visual; `refreshVisuals` uses it too.
- **The mesh** (`client/stairs.js stairVisual`): the shipping GLB, turned so it climbs +z and stretched to `[width, rise, run]`. Which way a generated stair climbs is MEASURED (`climbOf`: the horizontal axis its vertex heights follow, by correlation); the two `stair-straight` meshes disagree (their bounds are 0.56 x 0.77 x 1.01 and 1.01 x 0.86 x 0.70). It does not go through the LOD tiers. A ladder leans at the far side of its square. A kind with no mesh gets `standInFlight` / `standInLadder` (not in use today: both pieces exist).
- **Pawns:** `app.moveBy` asks `app.stairHop` for a single pawn that ends up standing on a stair's squares (from the stair's floor: to `ends.top`; from the floor above, i.e. on the hole: to `ends.foot`). One `token.move`. Drags, nudges and the GET API's `token.move&stair=` all end there. Stage C's offer fires by itself; the cut log shows no write.
- **Hidden:** `entity.flag` adds the stairs touching a room; on reveal a stair comes back only if neither room it joins stays hidden (`stairVeiled`). A stair is no longer swept up with its room's other objects, so revealing the lower room cannot leak a stair up to a hidden attic.
- **Relay:** `dispatch` plans the stair for a layout-less `room.spawn` with `y`, and dispatches `object.place` after the commit with nonce `<nonce>:stair` (a retry dedupes both). `opts.stair === false` (GET `stair=0`) skips it. The answer carries `stair` or `stairNote`.
- **Changed in older tests:** suites that drew upper rooms and then counted on one undo removing the room now undo twice (see `browser_storeys.py`).
- **Traps:**
  - A stair's top landing is not checked again when the upper room is re-rolled, moved or deleted: the stair stays where it is. A stair whose upper room is gone leads to open air.
  - `object.replace` on a stair keeps its own `dims` (rise and run); a replacement mesh is stretched to them.
  - Wall-hung things above 2.5 ft are not counted as "in the way" of the foot of a stair; a stair along a wall can pass in front of a hung lantern.
  - The 5-ft grid lines still cross a hole in the ground.
- **Stage F (roofs):** a chimney is the same idea turned round: derive it from the fireplaces (`stairsTouching` is the model for "what comes up through this floor"), and cut nothing. A roof deck is a room top with nothing above: `planStair` only joins a room to a room or to open ground at 0, so a stair up to a deck needs an "upper = deck at this height" case in `planStair` (inUpper = no room at that height) and `floorPoint` already returns the deck. `holesAt(ents, top)` gives the squares a flat roof must leave open.
- **Stage G:** a pawn above the cut is not drawn and has no marker; fog per storey should treat a hole as part of the room below.
- **Gemini, blind (gemini-2.5-pro, 1920x1080, two-storey inn with one stair):** cut at lv 1: "A wooden staircase in the 'Common room' leads upwards, providing access between the floors ... Nothing is floating." Cut at lv 2: "a two-story building ... A staircase, visible as an opening in the floor ... with a red glow emanating from below, connects the two levels ... Nothing is floating"; close: "A rectangular opening is cut through the wooden floor, revealing a staircase that leads down to the first floor." It placed the hole in "the kitchen area" (the kitchen's label shows beside the upper rooms; the hole is in a guest room).
- **Tests (merged head 2304f20, main e-merged):** core 290, relay 126 (one run 125: not reproduced), migrate 340, harness 5/5, assets 13,708 checked 0 missing; browser: stairs 40/40 (new), storeys 39/39, cut 96/96, rooms 118/118, tiles 37/37, build 87/87, lift 17/17, lift endings 29/29, UI 84/84, announce 20/20, settings 66/67 (the known thumbnail check).
- **Frame time** (`perf_storeys.py --uncapped --upper`): median 16.5 ms, 1,208 draw calls (Stage C: 14.2 to 16.4 ms).

## 2026-10-05 (night): storeys, Stage F: roofs in the game (branch `roofs`, worktree ../3d-vtt-roofs)
Spec: docs/VERTICAL.md "Stage F: roofs", docs/UI.md "Roofs", docs/NETCODE.md "Roofs in the commands and the GET API".
- **Wiring.** `client/roofs.js` (the standalone planner and mesh builder) is now driven by `AreaWorld.syncRoofs` (world.js): called from `sync`, it rebuilds only when its inputs change (the rooms' rectangles, heights and styles, and the fireplaces' positions, as one JSON key) and only while the seat's switch is on. Roof meshes live in their own scene layer (`world.roofLayer`), outside `layers.shell`, so the fog's wall mask and the shell's bookkeeping never see them.
- **Data.** `core/height.js` holds the rules: `ROOF_STYLE_KEYS`, `ROOF_BY_FAMILY`, `roofProblem`, `mergeRoof`, `roofStyleOf(entities, room, familyOf)`. `room.set` and `building.set` take `roof`. The relay reports the style a room wears with the same function (`roomgen.roomsOf` gives the wall family; `roomgen.isOutdoor` is new).
- **The view rule.** A roof's base is the TOP of its room (its ceiling + 1 ft slab), not its ceiling: with the cut at a room's ceiling its own roof must be gone, and `visibleAt(ceiling, cut)` would keep it.
- **Covered rooms.** A room under a roof that is showing joins `coveredRooms` (Stage C's set), so its label goes and its lamps go out with no new code. That is also why roofs on is cheaper to draw than roofs off.
- **Picking.** `world.roofAt(raycaster)` is the one roof raycast. `pickAll` stops at the first roof hit (nothing beyond it is returned), then returns `{ roof: roomId }`; `app.selectionFor` turns that into `roof:<roomId>`; `app.ent('roof:…')` is `app.roofItem`, a pseudo-entity of kind `roof` that exists only while its roof is drawn. `floorPoint` asks `roofAt` first when roofs are on. Every roof raycast sets `raycaster.camera` (the sprite guard from the raise bug).
- **Commands.** `roof.style.<style>`, `roof.reroll`, `roof.hide`, `room.roofShow`, `building.roof.<style>`; lines in `client/menu.js`. `things(ctx)` in `client/commands.js` now leaves roofs out, so a roof never gets a thing's options (pin, lock, hide from players, delete).
- **Flyout tiles can carry a picture by URL** (`pic` on a command): used for the texture swatches.
- **Trim.** A prop whose catalog id is in the library is drawn with `assets.visualFor` and stretched to the planned size; until it loads, and for ids with no piece, `roofs.propStandIns` draws a box. Today: dormer real; chimney = `pillar-square`; parapet, corner pier, finial = boxes.
- **Gemini, blind, table distance, one picture per style.** Thatch: "yellow-brown, thatched roofs… two stories tall… two stone chimneys". Tile: "red-tiled roof… a stone chimney and small green-roofed vents". Slate: "dark, slate-tiled roof… a brick chimney… a green-roofed dormer". Shingle: "brown shingles or tiles… two chimneys". Flat: "flat, tan-colored roofs with a raised edge or parapet… two small, dark, chimney-like objects… no other gaps or floating parts". In four of five it called the flat deck "a section of the roof cut away, revealing a grey floor": the deck was a plain grey stand-in. It now wears the rough-boards floor texture; not re-shot before this note. It called the dormer's green roof a "vent" twice (the real `roof-dormer` mesh has a green roof whatever the style).
- **Frame time** (`perf_storeys.py --uncapped --upper`, with and without `--roofs`, load about 6): roofs off 20.8 / 23.1 ms median, 1200 draw calls, 312 lit things; roofs on 17.7 / 19.6 ms, 911 draw calls, 47 lit things.
- **Traps.** Things in a roofed room are still drawn under the roof (only their lamps are off); hiding them would save more. A roof's selection box is its bounding box, so an L-shaped room's roof is bracketed as a rectangle. `roofItem` returns nothing when roofs are off, so a stale `roof:` id in a selection simply drops out.

## 2026-10-05 (night): storeys, stage G: follow-ons
Spec: docs/VERTICAL.md "Stage G"; use: docs/UI.md "Storeys: fog, flyers, tall rooms and the rest". Test: `engine/test/browser_followons.py` (36).
- **Fog.** The atmosphere is one y = 0 sheet; rather than make it know storeys, the game hands it one level at a time: `world.fogLevel()` (0 with the cut off or on the ground storey; else the highest floor showing), `fogRooms()` and `fogStructure()` filtered to that level (slabs, supports and tall rooms' upper walls left out). `fx/atmos.js` gained `setLevel({ base, indoorOnly })`: two uniforms (`uBase`: the volume's ray and sample heights are taken relative to it; `uIndoorOnly`: zero the fog and heavy fog wherever the place map is not indoors) and the far sheets off while indoor-only. Defaults 0 / false: the shader does the same arithmetic as before (x - 0.0).
  - Not moved: the light slices the fog catches firelight from are still baked at ground heights, so firelight in upper-storey fog is approximate.
  - The simulation still runs outdoor fog while an upper storey is in view; it is only not drawn.
- **Flyers.** `frameSignals` keeps one drop-line group per lifted thing: selected lifted things (with a `surfaceBelow` raycast for a thing's top under them) and every pawn off its floor (floor only: no raycast per pawn per frame). The label is a `labelSprite` child, rebuilt only when its text changes. `world.heightLabels()` for tests.
- **Cursors.** Presence `cursor` is `[x, z]` or `[x, z, y]`; the ground point already carried `.y` (Stage B), so the sender reads it. The relay's shape check takes 2 or 3 numbers. The height does not glide.
- **Tall rooms.** `room.tall` is its own command (not `room.set`, which the roofs branch is also changing). In `buildShell`, each wall edge with a tall room on a side gets a plain-wall copy per extra storey (`spec.stack`), skipped where an edge with the same base key exists at that height (the neighbour's wall is the shared wall); posts likewise. They pick as the room (`roomPiece`, as supports do). `roomgen.roomsOf` now passes `tall` on the ground too.
- **Building tool off the ground.** `app.buildableRect(rect, level)`: the largest rectangle of buildable squares inside the drag (row histogram); `spawnBuilding` packs that. The stair is planned AFTER the rooms are furnished (a stair never removes furniture), so in a crowded storey it can fail; the tool says so.
- **Stairs.** `room.delete` also drops `strandedStairs` (stairs that came up into the room; not pinned; top not at ground level).
- **UI suite flake.** The marquee start had six candidate points and then "use (8, 3) anyway"; when all six were taken the press landed on a post. Now a ring of candidates, each probed at five pixels, no blind fallback.
- **Not done:** depth look in the PiP (the depth pass holds the main camera; needs `renderPlain(camera)` or a per-view pass in `fx/depth.js`).
- **Merged with Stage F (roofs), main d13ac6e.** Checked where they meet (browser_followons.py "ROOFS"): tall room's roof at its top; building-tool storeys roofed; fog inputs identical with roofs on and off; cursors lifted onto a shown roof by a down-ray per seat per frame (`roofAt`); thumbnails keep the seat's roof switch. The rooms suite's room-menu list gained `room.height.taller`. The "?" sheet has lines for roofs.

## 2026-10-06: storeys, frame time (measured on a quiet box; what nobody can see is not drawn)
Asked: the two-storey inn had crept from 15.5 to 20.2 ms; target at or under 16.7 ms on the RTX 3060 with a cut on.
- **How it is measured now:** `engine/test/perf_cases.py --uncapped --rounds 5 [--ab] [--breakdown] [--flat]`. One browser, one scene (the perf inn and yard, two upper rooms, a cellar with its ladder, house fog, 1920x1080), every case measured in turn each round, so drift and load hit all cases alike. `--ab` measures each case with the new rules off as well. Load 2 to 3 during the runs; `nvidia-smi` showed one other small Python process on the GPU.
- **The earlier 20 ms was mostly the box.** The same code on a quiet box: all levels 16.1 ms, lv 1 14.6, lv 2 with the depth look 15.5, flat 11.7.
- **p95 near 30 ms is frames arriving in pairs**, not a 30 ms frame: once a frame runs past about 16 ms the next callback follows almost at once (p25 of 1 to 2 ms beside p75 of 30). Read the MEAN for cost and "share of frames over 20 ms" for smoothness.
- **The frame is CPU time inside the renderer** (12 to 14 of 14 to 16 ms is `fx.render`, about 10 µs a draw call), so draw calls are the cost. World bookkeeping is 0.2 ms; the cut, fog-level and roof passes, labels and cursors measure as nothing; the depth pass costs under 0.3 ms; slabs, stairs and supports under 10 draw calls together.
- **Where the storeys' extra went** (all levels, ms saved with it off): the fire's shadow 3.8 (it was 1.5 on the flat inn: its six-face pass was drawing the storeys above and below); everything upstairs 1.6; the cellar under the closed ground 0.8; things in rooms wholly under a floor 0.9. For scale, not storeys: the post stack 7.7, every thing 7.8, all lamps 4.4.
- **Taken** (client/world.js):
  - A covered room's things are not drawn beyond 7.5 ft of a stair's hole in the floor above; a room under the unopened ground loses its floor and walls too (also with the cut off: the ground is closed then, and its lamps are out). Rooms under an upper floor or their own roof keep floors and walls. A door or window into such a room now shows an empty room.
  - The fire's shadow stays on its own storey: only things of rooms whose height span holds the fire cast it (through the lighting stack's own `userData.noCast` hook; `markCasters` re-marks every mesh each second otherwise).
  - The cut pass runs when something changed (`cutGen`) or while things animate in, not every frame.
- **Result** (median / p95 / mean ms, draw calls; old → new, same session): all levels 16.1 / 31.3 / 16.1, 1359 → 13.9 / 16.7 / 14.3, 1078. Roofs on 13.8 / 15.9 / 13.7, 1009 → 10.6 / 12.2 / 10.6, 673. Cut to lv 1 14.6 / 30.0 / 14.3, 1100 → 13.5 / 15.9 / 13.3, 976. Cut to lv 2 with the depth look 15.5 / 30.8 / 15.2, 1379 → 14.9 / 28.6 / 14.8, 1126 (frames over 20 ms: 18.6% → 6.3%). Cut to lv -1 4.9, 215, unchanged. Flat inn 12.2 / 13.5 / 11.7, 938.
- **Target:** met with a cut on (lv 1 13.5, lv 2 14.9 median). lv 2 still pairs frames 6% of the time. What would take it further: the fire's shadow is redrawn every other frame (the lighting look's "dance" dial; every third frame, or only its own room's things, would take about another millisecond off and is a look decision); floors are one draw call per 5-ft square (about 200 of 1100; merging them per room touches picking, tiles and the spawn animation).
- **Pixels:** each view shot with the rules on and off in one session: lv 2 with the depth look differs by 1.5 of 255 on average; all levels and lv 1 differ by 1 to 9 inside the building and 15 to 25 at the picture's edges, where the fog sea moves between shots.
- **Not done:** merging or instancing slabs, supports and roofs (they measured as nothing).
- **Fog parity (asked):** not ours and not a regression. `atmos_parity.py` on live three times: 12/12 each; open-ground mist tuner / game 0.448 / 0.447, 0.548 / 0.509, 0.547 / 0.508. The probe itself wanders between 0.45 and 0.55 from run to run in both; the failing run (0.530 / 0.449) sits inside that. Stage G's additions to fx/atmos.js are in the volume shader only and are the identity at base 0; the probe reads the simulation's density.
- **Cellar with no stair (asked):** the auto-stair runs for the room tool and `app.spawnRoom` at any height, below ground included (this scene's cellar under the kitchen gets a ladder), and for the building tool off the ground. It places nothing when no square under the room above is free of furniture and doors ("a stair never removes furniture"), and says so in a toast: "No stair added: no free spot for a stair…". A script does not see the toast; `tw.stairWhy` holds the reason. Pasted rooms get no stair of their own.

## 2026-10-06: the vertical kit's real pieces replace the stand-ins (roof trim, overhang supports, stairs)
- **What was live before this.** The asset batch deployed the kit (tuner v=20261006005828) and the game's "first id the library has" tables picked the pieces up at once, sized the old way. Measured on live: nothing mis-turned, but chimneys were the brick stack stretched to whatever height the rule asked (0.7x to 1.3x), a slate roof's deck got a mansion stack, stairs were still the older inn flight (not the `--t10` one), and the "post" under a two-square overhang was the older `post-timber` mesh, which has arms and stood 5.5 ft x 6 ft across (it had been so since Stage B; Gemini never mentioned it).
- **`engine/client/kitfit.js`: fit by measuring the mesh.** The generated meshes do not agree on their frame, and the kit asks for a per-axis fit to its stated box. `measure()` samples vertices: box, where the low third sits, how the top runs, which way it climbs. `fitPiece(v, dims, { long, lowAt, uniform })` picks the quarter turn from that, centres it, stands it on y = 0 and scales it. No FOR_STOREYS.md had arrived from the integrator, so every number here is measured.
  - bracket / corbel: the longer horizontal side reaches out (`long: 'z'`), the low part (the wall leg) to the wall (`lowAt: '-z'`). `jetty-bracket--s1` has its leg at +x, `--s2` at -x, `corbel-stone--s1` at +z: only measuring gets all three right.
  - dormers: all five face +z (window side). That was NOT what the geometry suggested (three of them are lower at +z), so it was settled by a blind read: each mesh alone, four sides, a red block on +z, "which side is the window". Stone and tile have a window on both ends.
  - chimneys keep their proportions: `roofPiece` picks the stack by roof material, takes another when that one cannot clear the planned top with at most 1.25x growth or would be buried more than 4 ft (a mansion stack on a low deck read as "a stove with a pipe"), keeps the planned top and sinks the rest.
  - ridge: 5-ft sections, each run divided into whole sections (stretched along the ridge by under 10%); the drawn strip is removed when the first section loads and stays where a library has no ridge piece.
- **Stone or timber** for supports follows the walls of the room or of the storey of its building below it.
- **Stairs:** `core/stairs.js stairPiece` prefers the storey tier (`--t10`, the upright ladder). Stairs already placed keep the sku they were made with (it is stored on the object).
- **Tests:** measured checks in `browser_storeys.py` (bracket top within 0.2 ft of the slab, back on the wall face, leg on the wall side; post under 1.6 ft across), `browser_roofs.py` (chimney foot at or below the roof, top above the ridge, own proportions within 12%; parapet sections 5 ft on the deck; ridge sections over the ridge line; dormer sunk), `browser_stairs.py` (`--t10`, top tread within 0.2 ft, low end at the foot). `world.kitReport()` gives every piece's measured box.
- **Frame time** (perf_cases.py, uncapped, 5 rounds, load 2.2 to 3.8): all levels 14.4 median / 14.9 mean (1054 calls); roofs on 11.4 / 12.0 (688; was 10.6 / 673: the ridge sections and real trim are about 15 more draw calls); cut lv 1 14.1 / 13.8 (976).
- **Stand-ins left:** the flat-roof surface (rough-boards floor texture); no thatch dormer exists (the timber one is used); the buttress serves as a free pier.

## 2026-10-06: live, ground-floor walls clickable at lv -1 (a picture racing the cut), and a test wait that did not wait
- **Seen on live** after the kit landed: `browser_cut.py` "lv -1: none resolves to anything on a hidden level" failed twice (1363 picks on ground-floor walls); a third run an hour later passed. Not the kit, not the "cut pass on change" rule.
- **Cause, reproduced on demand:** the area thumbnail (`client/thumbs.js`) lifted the cut, took its picture a frame later, and put back the cut it had remembered. A cut set in that frame was overwritten: the world went back to the old level (lv 1) while the seat was at lv -1. `scratchpad/kit/race.py`: world 9, app -1, 42 walls drawn and clickable. It needs a thumbnail render and a cut change in the same frame, so it shows where frames are long and changes come fast (live, under test).
- **Fix:** `world.liftCut()` / `dropLift()`. While lifted, `setCut` only records the wanted cut; `dropLift` applies it. Lifting with no cut on also holds a cut set meanwhile until the picture is taken (it used to be drawn into the picture).
- **Roofs on live, "a dormer is sunk … (None, …)":** my test's wait accepted a piece as a stand-in while its mesh was still loading, so on a slow line it measured the box. `kitReport()` now says stand-in only when the library has no piece.
- **Tests:** `browser_cut.py` takes a picture in the very frame the cut moves, four ways (99 checks). `TW_SLOW_ASSETS=<ms>` on the cut, roofs, storeys and stairs suites delays every mesh.

## 2026-10-06: Harry's notes after trying storeys (one level, the meter, key caps, FPS meter, centring, pawn snap)
Spec: docs/UI.md "One level, and the level meter" and the six short sections after it; docs/VERTICAL.md "One level, the meter, and a double-click that centres".
- **State.** `app.level` (a floor height, always defined) and `app.cut = { y, pinned: false }` (a ceiling height; null = all levels) are still two numbers, tied in `surfaces/cut.js`: `app.goLevel(y, by)` sets both (the cut at `y + step - SLAB`), `app.cutOff` / `app.cutOn` / `app.toggleAll` switch "all levels" without touching the level, `app.cutToRoom` sets the level to the room's floor and the cut to the room's own ceiling (a tall room's is higher than its level's, which is why they are not one number). `app.floorStep` is `goLevel(level ± step)`, any level in `app.levelRange()` (`{ lo, hi }` in storeys: -6 to +5, widened to the rooms plus one spare each way, capped by MAX_Y). `app.setCut` is still the one writer of the view and still logs; `pinned` is always false and only kept in the record's shape.
- **Gone:** `app.levelUp/levelDown`, the tool / no-tool split in `levelInfo` (`lo` / `hi` are the meter's range now), the reset to the ground when a tool is put away on an empty level, the Build tray's `.blv`, `#cutBar`, `PIP_FOOT` (the PiP keeps off the left 22 px instead: `PIP_EDGE`).
- **The meter** is `#levelMeter`, painted from `app.meter()` (`levels[]` highest first: `{ y, storey, label, rooms, ground, current, shown }`) at most every 250 ms or when a cut / level / selection / change event marks it dirty. `app.cutBar()` is kept for the tests and now also returns `marker`, `notches[]` and `cap`.
- **Saved view state** (`tw.cut.<campaign>.<seat>`): `areas[id] = { y, level }`. An entry without `level` (saved before today) restores as `y + SLAB - STOREY`.
- **Traps.**
  - `tw.setCut(y)` alone does not move the level (tests and the perf scripts call it); the meter then shows the marker and the lit strip on different storeys, truthfully.
  - A test that clicks the cap or a notch must aim inside the idle 20 px: a position read while the rail was wide (hovered) is outside it once the pointer leaves.
  - A double-click test aimed at a floor spot can land on a room's LABEL (labels float over room centres); that is the label's double-click (centres on the room).
  - Two commands share `\` (`cut.off`, `cut.on`); the key map runs the first whose `when` holds.
- **Centring.** `app.centreOn(point, view)` moves the focus along the view direction so a point at any height lands mid-view (the camera's focus is on the ground plane). `View.glideTo` / `glideStep` (views.js) ease the focus; the glide remembers the pose it last left and drops itself when it finds another, so every kind of camera input cancels it without the input code knowing about glides.
- **Pawn snap.** `pawnSnap` in `input.js`, applied in `dragMove` and again where `endMove` re-reads the pointer for a floor at another height. The grabbed pawn (`g.lead`, the press's target) is the one that lands on a centre.
- **FPS meter.** `surfaces/fps.js`; draw calls and triangles come from the tuner stack's `fx.stats()` (`frame_draw_calls`, `frame_triangles`), read twice a second.
- **Gemini, blind:** the idle strip read as "a floor or level selector ... a highlighted marker with the number 2" and, the four states side by side, "the lit portion indicates which floors are currently visible; the numbered marker indicates the active level"; key caps read as B, P, S. Before the lit strip was added it read "all levels" as "showing the 1st floor": the strip is what fixes that.
- **Tests:** new `browser_nits.py` 43/43; cut 112/112, storeys 42/42, build 89/89, UI 84/84, stairs 41/41, follow-ons 41/41, rooms 118/118, roofs 60/60, tiles 37/37 (its ring-turn check read 176° once in two runs: timing), lift 17/17, two-tab 28/28, settings 66/67 (the known thumbnail check).

## 2026-10-06 (afternoon): the rest of Harry's notes, built in five worktrees and merged
Branches `nits-render`, `nits-structure`, `nits-track`, `nits-chatline`, `nits-fly`, each merged with `--no-ff`. Use: docs/UI.md (one dated section per note) and docs/VERTICAL.md.
- **Drawing (notes 2, 4, 8).** Fog: `core/height.js fogDefault` (storey ≥ 1 → 0); `world.fogRooms` passes it as the room's height; derived, never stored. Ghost: `world.ghostMaterial/ghostMode/ghostPrepass`; above ground plain depth test with the ghost 0.3 ft under the floor line; below ground a half-size depth-only pass of `layers.shell` + `layers.things` (sprites and lines hidden, shadow maps not updated), sampled in the ghost's shader by clip position; `world.ghostInfo()` for tests. Labels: hidden labels were `display: none` and measured 0×0, hence a per-frame flip when crowded (73 changes standing still); now `.rlabel:not(.on)` keeps layout and fades; sticky place (`touch` 2 px vs `overlap` 4 px), edge 40/90 px, 450 ms dwell for show/hide and for stepping; `app.labelFlips()`. Trap: a single `grab.dist` set eases back to a zoom detent; tests must hold it.
- **Supports and railings as things (notes 3, 7).** `supportPlan` (core/height.js) and `stairRails` (core/stairs.js) give every bracket, post and railing section a key (`j…`, `p…`, `r…`); world.js draws them as keyed shell pieces, so `wall:<key>` selection, `edge.set … open` and materialize-on-edit work as for walls. An edit belongs to the room at that height whose floor the key lies on. Materialized pieces keep their look through `GEN_FIT` in `visualOf`. `isStoneFamily` is the one stone test (castle and crypt walls count as stone now). Posts scale uniformly from library bounds (`postDims`). `railing-iron`: $0.30 on fal. The touchable audit (`test/audit.py`) is strict: it asks for the piece itself and samples the roof layer; before, a click on a support resolved to its ROOM, which the audit accepted as "something selectable". New suite `browser_pieces.py`. Trap: run `build_data.py` from the main tree (a worktree lacks the ignored models).
- **The handle's track (note 13).** `surfaces/track.js makeTrack(svg, { min, max, value, ticks, marks, format, direction, layer })` draws rail, ticks, marks, knob, travelled stretch and the readout chip into the ring's guide SVG; `release()` moves them to a `.rtrack-out` host under `#app` to fade, because the ring rebuilds on release. Turn ticks keep class `tick` and `data-k`, so `ringDrag().ticks` and `.guide .tick.on` still hold. The resize rail is placed with `softKInv` (bisection on `softK`). The catalog-size mark comes from `roomgen.sizeOf`, not `e.s`. Trap: laid-out things sit about 2.5% off catalog size, hence the 6% rule.
- **Conditional buttons go down into the chat (note 14).** `condbutton.js` rule 6: `toChat(key, b)` at `life`, or when `show` replaces a live offer; FLIP onto `app.actionLines.buttonEl(id)`; `cb.flights()` and `cb.expire(key)` for tests. `chat.js`: `app.actionLines` (`kind`, `add`, `press`, `newest`, `list`, `reveal`, `clear`), merged into the log after the chat line that was newest at the time, stored in `tw.actlines.<campaign>.<seat>`; `.` is a key layer because the key map is built before this surface. `undochips.js`: `app.undoState(d)` from entries watched this page load (`undoOf` seqs, last seq per entity id); kind `undo` is not restorable. A new command declares one with `app.actionLines.kind(name, { valid, run, restorable })` and `condButtons.show(key, { …, line: { kind, text, button, group, data } })`. Trap: the GM also gets chips for a player's moves in any test, so clear lines between sections.
- **Levels above the cut fly away (note 11).** Carriers, not pieces: `cutPass` and `roofPass` hide exactly as before and hand the drawn children to `engine/client/cutfly.js`, which batches them into the tuner's runner (`fx/cutfly.js`; schedule and pose in `anim.js`). Flights start on the next drawn frame. Area pictures flush flights; tests that look mid-flight set `tw.thumbs.debounce` high. Tuner demo: walls belong to the first-drawn room, so the demo lifts by position. House field `cutfly` needs a tw-ratings restart. Trap for every other test: for about 350 ms after a cut change the storey coming back cannot be touched, so a test that changes the cut and clicks at once hits what is underneath.
- **Roofs on the meter, pings, the ring guard, the wheel (lead).** `app.roofsOn/roofsOff` and the `.lm-roof` mark in `surfaces/cut.js`; `watchZoom` and the `roofs-on` conditional are gone. Pings: `armHold` in `input.js` (a timer that fires only if the gesture is still the same press), `app.ping(x, z, y, { local, secret })`, `app.showPing` → the world or `app.meterPing`; the relay's `presence()` filters a ping in a hidden room to the GM side and allows 4 in 3 s per connection. The ring guard is a window capture listener at the top of `ringSurface`. Wheel: `client/wheel.js` (pure, node-tested); **read `deltaMode` before `deltaY`** or Firefox hands over pixels.
- **Other browsers.** `TW_BROWSER=firefox` (in `tests/tw_sandbox.py`) swaps `p.chromium` for Firefox in any suite: a window on Xvfb :99, llvmpipe, several times slower, so checks that time a 90 ms glide or a 6 s fade can fail on speed alone. WebKit cannot launch here (libicu74).
- **Seen, not fixed:** a pawn seen through a stair hole and dragged with all levels showing takes the upper floor as the plane it started on (the floor point ignores holes), so dropped on the ground it ends 10 ft down. Rare; the fix is to start a drag on the grabbed thing's own floor.

## 2026-10-06 (evening): figures as pawns, and the command bar brought up to date
- **Figures:** `client/figures.js` (list, search, base, figure), `client/pawns.js` (the pawn tool, groups, change figure), `relay/figures.js` (AI seats). The list is `tools/spawn-tuner/data/figures.json`, built by `tools/spawn-tuner/build_figures.py` from the published set (read-only) into `assets/figures/` as hard links with the mesh's sha in each name.
- **The tier files' lowest point is not the list's `y0`** (the optimiser moves the bounds a little: the ape's is 0.07 ft lower). The figure is stood on its disc from the loaded mesh's own bounding box, not from the list.
- **A facing mark on the floor behind a figure cannot be seen** at the table camera: a 6-ft figure covers 3 ft of floor behind it. The arrowhead is in front; the rim is open at the back. Gemini reads one pawn at a time well (5 of 6 exact) and a whole table of six badly, with or without figures on the bases.
- **The audit as a test** walks the registry by STATE, not by a list taken once: after each command it asks again what is offered, because a command changes what is offered (cut on / off, roofs). It undoes exactly as many changes as the command made (counted after the relay has answered). It found `room.replay` calling `world.animateIn`, which had not existed since the tuner's look moved in.
- **Ports:** `browser_figs.py` uses 18157 / 18787 (18141 / 18771 turned out to be in use by a suite on the `pawns` branch).
- **For whoever merges `pawns` after this:** both branches add to the pawn part of `commands.js` (this one calls its selection helper `figPawns`, at the end of `defineCommands`); `browser_figs.py` PAWN types `-3` and expects HP 4/7 in the label, which the damage model will change.

## 2026-10-06 (evening): the pawn ring, and hit points become damage (branch `pawns`, worktree ../3d-vtt-pawns)
Use: docs/UI.md "Pawn ring"; data and API: docs/NETCODE.md "Pawns".
- **Shape.** `core/pawn.js` holds the small shared rules (the eight `MARKS`, `seesDamageUndo`, `sheetProblem` / `cleanSheet`, `parseDamage`, `damageReadout`, `damageLine`). New commands `token.damage`, `token.mark`, `token.owner`; `token.set` / `token.create` take `sheet`, `notes`, `gmNotes` (and `mark`, `damage`, `conditions` on create). An empty string clears a sheet link, a note or a mark: `parseArgs` used to drop every empty optional argument, so those four names are listed in `CLEARABLE`.
- **Damage (Harry, mid-build: "instead it's 'damage'. That means 0 is always healthy").** A pawn carries `damage` (absent = 0). `hp` / `hpMax` stay in the two commands' argument lists for REPLAY only (apply runs on replay, check does not; a live command with them is refused with the reason). `migratePawns` (core/migrate.js) runs at the end of `CampaignRuntime.load`: state, undo, redo and log tail in one pass, then a snapshot if anything changed. No format bump: it is detected by the fields, and `DATA_FORMAT` still drives the areas rewriter (bumping it would have re-run that rewriter over every data dir at relay start).
- **GM notes.** `unnote*` in core/labels.js, called at the two places everything to a seat goes through (`entryFor`, the snapshot). A token.set that was only the note becomes an empty `entities.set` for players, so seqs still line up. Found on the way: the `changes` a stale GET command is answered with were raw tail entries (labels and hidden things included); they go through `entryFor` now.
- **Undo.** The undo stack items for a damage-only entry carry `dmg: [pawn ids]`; `doUndo` lets a non-GM seat undo someone else's entry only when it has that tag, names the seq, and `seesDamageUndo` holds for every pawn. Client: `undochips.js` keeps each pawn's damage as of the last applied entry (the view already holds your own optimistic change, so the delta cannot be read from it), merges within `DAMAGE_MERGE_MS` by re-showing the SAME spec object (a different object would send the old button down into the chat), and undoes a merged line seq by seq, newest first.
- **Ring.** `ring.opens` on a closed-ring command makes its button the anchor of a panel (the sheet card); `flyout.keep` lets a panel survive a rebuild of the same selection (taken out, put back, caret restored). The damage track has no far end: the drag re-makes the track with a longer rail when the value comes within 5 of it. Captions: `cap(ctx)` on a command overrides the ring caption only ("Change name"); a test fails on any clipped caption. Hover names are a `data-tip` and a CSS `::after` on every closed ring button.
- **Traps.** A python slice-replace of the HP buttons took the conditions loop with it (the suite caught it: Conditions gone from the menu). `launch.querySelector('.launcher')` meant "Build" in two places in build.js; with Pawns first it hid the Pawns box from players. The relay test's "no frame mentions a10" check failed once and passed three times since: 'a10' can occur in a random command id.
- **Gemini, blind:** a bare number beside a heart read as hit points ("zero would typically mean the creature has been defeated"), so the track readout ends in "damage" and the zero mark says "0 · unhurt"; then it read correctly. The cracked heart still reads as a heart: for the visual pass on the radials.
- **Tests on the merged branch:** core 440, relay 149, migrate 420, harness 5/5, wheel 30, framing 7, roofs 60, water 16; browser (local, GPU): pawnring 95/95 (new), figs 145/145, UI 84/84, rooms 118/118, nits 72/72, track 34/34, chatline 34/34, cut 112/112, build 89/89, lift endings 29/29, two-tab 28/28. `browser_settings.py` is 66/67 here AND on main before this branch ("a player sees the picture of an area they can see"): not from this work.
- **Live (client v=20261006173812).** On restart the relay converted 129 campaigns (261 pawns on disk now, 24 with damage above 0, no `hp` left in any snapshot). `browser_pawnring.py --page https://turnipworks.net/`: 95/95. `browser_ui.py` on live: 82/84, the two camera checks ("right-drag pans, wheel zooms", "F frames the selection": the camera did not move at all); the same two failed once locally while other suites shared the GPU and passed three times since.
- **Seen at the restart, not from this work:** the OLD relay process threw during its shutdown snapshots (`ENOENT … cmp_ya6buk87p2/snapshot.json.tmp`): that campaign's directory had been deleted from disk while the relay still held it, and `close()` stops at the first throw, so campaigns after it got no shutdown snapshot. Nothing was lost (every record is fsynced to the journal and was replayed), but `relay.close()` should catch per campaign.
- **No pre-deploy copy of the snapshots exists:** the `tar` meant to take one matched nothing (45 bytes) and the relay had restarted before that was seen. The journals are untouched and complete, so the old hit points can be re-read from them with the code of before this merge if ever wanted.
- **Later the same evening: the name on the base and main pawns.** The lettering was mirrored at first (a strip's u must grow toward +X for someone at +Z looking in); Gemini's blind read caught it by reading the name backwards. A flat strip on the disc reads better than one on the rim's face from the table camera, and neither reads at table distance. `browser_figs.py` takes `TW_PORTS=a,b` when another worktree is running it.

## 2026-10-06 (evening): areas open or hidden, travel (branch `areas`, merged and deployed, client v=20261006181334)
- What and why: docs/PAWNS.md "Areas: travel, and keeping surprises hidden (AS BUILT)". Tests: `test/areas.test.mjs` (114), `test/browser_areas.py` (57 local; 56 against the live site, where the traffic check is not run).
- Audit before building: the relay already filtered by `canSee` everywhere it sends (area list, subscriptions, log, presence, pings, ghosts, pictures, GET). Missing: the two-state rule (there were three, plus grants), the first-open / later-hidden default, any travel for players (`transfer` is GM only), any mark for the GM, and four small leaks (a seat "elsewhere", `transfer.out` naming the hidden area, "no area X" versus "no such area visible to you", seat.locate's own wording).
- Saved campaigns: 256 on disk, 319 `open` areas and 43 `gm`, no `party`, grants only on open areas. Nothing rewritten; `gm` reads as hidden.
- Found on the way, not fixed:
  - `test/migrate.test.mjs` fails 31 of 457 on main as well: "pawn … (hp undefined/undefined) reads as 0 damage with no hp left" (the damage conversion's check, on campaigns whose pawns never had hit points).
  - At the restart the old relay logged `ENOENT … data/cmp_sxto9p3mft/snapshot.json.tmp`: a campaign folder had been deleted while the relay held it. `close()` throws on the first such campaign, so the campaigns after it are not snapshotted at shutdown (their journals are complete; they replay). There is still no way to delete a campaign through the relay.
  - Browser suites share fixed ports across worktrees: two agents running the same suite at once produce "connection refused" and camera-input failures that vanish on a rerun alone.
  - One more throwaway campaign is on the live relay from the live check ("TEST areas … (throwaway)").

## 2026-10-06 (night): relay housekeeping the day's deploys exposed (branch `turns`)
- **The migrate suite's 31 failures were the test, not the data.** It read each campaign with the code of before storeys, which since the 17:38 conversion meets snapshots that already say `damage`; from the missing `hp` it expected 0. Checked the data itself: every journal replayed ALONE (no snapshot) up to the conversion instant, the rule applied by hand, compared with what is on disk: 256 campaigns that existed then, 261 pawns, 0 differ; 24 hurt both ways (all "Brakka" 18/20 in test fixtures). The suite now counts the two forms apart and replays every journal that never mentions damage on its own (214 journals, 201 pawns). 427/427.
- **A journal is not a perfect stand-in for a lost snapshot.** Replaying old journals with today's reducers differs from the snapshots in 83 campaigns: default fields newer code adds (`defaults`, `requests`, `settings`, `lit`), and 39 objects that replay as hidden where the snapshot has them shown (today's `object.place` in a hidden room hides the thing; the code that wrote those records did not). None of it is a pawn's number. It is why the snapshots are copied before a restart now.
- **A copy before every restart:** `engine/tools/backup_data.sh` (called by `engine/deploy.sh` and by the tuner's deploy, which also restarts the relay). One `data-<stamp>-<label>.tar.zst` per restart in `/mnt/usb/turnip-works/relay-data-backups/` (6 MB for 264 campaigns, 150 MB unpacked; the last 30 kept, about 180 MB; `~/tw-relay-data-backups` when the USB disk is away). It counts the journals in the archive against the folder and refuses to go on when short or empty: then the client is deployed and the relay is NOT restarted. `data/secret` is left out.
- **`relay.close()`** catches per campaign, names the one it could not save, and carries on (on main it threw at the first, and the campaigns after it got no shutdown snapshot: reproduced, then tested in relay.test.mjs).
- **Deleting a campaign:** `POST /c/<id>/delete?seat=TOKEN`, the campaign's own GM and a person (a player 403, an AI seat 403, another campaign's GM 404). Connections are told and closed, long-polls released, a last snapshot written, and the folder MOVED to `data/removed-<date>/<id>` (the existing convention: the loader reads only `cmp_*`); `&purge=1` removes it outright. No button in the game yet.
- **Suites remove their campaigns:** `tw_sandbox.remove_campaigns()` (one line after the import) notes every campaign the script's browsers create (a route on `**/campaigns`) and deletes them, purged, at exit. Opt-in on purpose: the megamap scripts build a campaign for later scripts to join. Seven old suites (UI, build, rooms, settings, tiles, two-tab, announce) had no sandbox import at all; they have it now. `engine/tools/remove_throwaways.mjs` lists (and with `--go` deletes, through the relay's own endpoint) campaigns NAMED as throwaways and idle for two hours; it never lists anything else.
- **The two "flaky" UI checks were a real fault, and not from the wheel change.** A room label is DOM over the canvas. With the pointer on one: the wheel did not zoom (the listener was on the canvas), a right or middle press did nothing (the label took it), and Space + drag MOVED THE ROOM. Since labels doubled in size (10-05) the test's pointer landed on the room's label whenever the label had not stepped aside that frame, hence "load". Fixed in `input.js` (the wheel handler also listens on the label layer; `labelPress` hands camera presses to the canvas's own handler, which captures the pointer). Three new checks put the pointer on a label deliberately; against the old `input.js` they fail 3 of 3 and "F frames the selection" fails with them (the room had moved).
- **Seen, not fixed:** the suites leave their temp folders in /tmp, which is RAM here (274 `tw-*` folders, 101 MB, when looked at). The UI suite, the relay suite and the harness clean up now; the other browser suites still do not.


## 2026-10-06 (late evening): the Pawns menu (branch `pawnsmenu`, merged and deployed, client v=20261006192820)
- What and why: docs/PAWNS.md "The Pawns menu, as built". Tests: `test/browser_pawnsmenu.py` (148, four seats), `test/party.test.mjs` (69, raw sockets).
- **Where the data lives.** A player's defined pawns, the GM's cast, the party notes and the marching order are campaign state (`state.pawns`, `.cast`, `.party`), changed by campaign commands; the bench is "a definition with no pawn on any table". A pawn brought on carries `def`. The relay's `fill` (the areas work's hook) writes a brought-on pawn from its definition, so a player needs no `token.edit` and cannot bring on anything but what she defined.
- **The party rows are in the campaign view**, not read from subscribed areas: a client only holds the areas it shows, and the rows must be right for a pawn in another area (split party). The relay compares a signature of the owned pawns after each area commit and sends fresh views 60 ms later when it changed; a plain move never does. The client lays this area's live pawns over it.
- **Whispers are not commands**, so there is nothing to filter: a socket message handed to the connections of one seat. The price is no history on the relay and nothing for someone who is away.
- **Hold against tap is measured on the events' own timestamps.** Measured at handling time, a frame that took 400 ms between keydown and keyup (another agent's GPU job) turned a tap into a hold and closed the menu: one flaky check, then this.
- **One capture listener owns P, B and S** (surfaces/tray.js), ahead of the key layers; Build's layer used to swallow every letter while open, so B never closed Build. A letter stays with an open menu only when the list it is showing has an item on it (`ownsKey`).
- **Traps.** `pkill -f <path fragment>` matched the shell running it and killed the session's own command (anchor with pids). A suite serves `engine/` live from the worktree, so editing while a regression run is going changes what it tests: the runs moved to a frozen detached worktree (`../3d-vtt-pawnsmenu-test`, removed afterwards).
- **Gemini, blind:** it named the panel, the tree levels ("breadcrumbs"), the turn marker and the grouped cast correctly, and misread four action icons on the first pass (footprints = "movement mode", ear = "audio", video camera = "video chat", person-plus = "profile"); those were changed. It calls the menu Build's family but "word-led".
- **A driven browser stamps a key's release late** (after the page has finished with the press), so with the GPU shared a Playwright "tap" of P or S came out 400 ms long and read as a hold; a person's keyboard does not do this. Under `navigator.webdriver` a hold is 1.5 s (`holdMs`, surfaces/tray.js).
- **Tests on the merged branch:** core 446, relay 163 (one run of five was 162: not reproduced, the check's name was not kept), party 69 (new), areas 114, migrate 339, harness 5/5; browser (local, GPU): pawnsmenu 149/149 (new), figs 171/171, build 89/89, nits 72/72, pawnring 95/95, areas 57/57, UI 87/87, chatline 34/34, rooms 118/118, two-tab 28/28, track 34/34, cut 112/112, settings 66/67 (the same one fails on main: "a player sees the picture of an area they can see").
- **Live (client v=20261006192820; the relay restarted once, at 19:21, client v=20261006192106).** `browser_pawnsmenu.py --page https://turnipworks.net/`: 147/148 on the first build (a tap of S read as a hold: the note above), then PARTY 45/45 and the rest green on the second; its throwaway campaigns removed themselves. The copy before the restart: `/mnt/usb/turnip-works/relay-data-backups/data-20261006-192107-engine-20261006192106.tar.zst` (6.1 MB, 268 campaigns counted).
- **Seen at the restart, not from this work:** the relay came back with 9 campaigns. At 19:18:50, two minutes before this deploy, the running relay logged some 259 `deleted cmp_… "Dawnhaven" / "The Otter Inn" … files moved to data/removed-2026-10-06/` (the housekeeping tool that removes leftovers named as throwaways, by the look of it). Nothing is purged: the folders are in `engine/data/removed-2026-10-06/`, and the copy above was taken after the move and includes them.

## 2026-10-06 (night): turn order and initiative, the pawn X-ray, the live campaigns cleared (branch `turns`)
Use: docs/UI.md "Turn order and initiative", "Pawn X-ray"; data: docs/NETCODE.md "Turn order"; choices: docs/PAWNS.md.
- **Shape.** `core/turns.js` is pure (keys, default order, step, setInit, forPlayers, turnRows); `core/commands.js` has the eight `turn.*` definitions and `initBonus` on the pawn; `surfaces/turns.js` the commands, keys, offers and the mark; `surfaces/xray.js` the X-ray. Neither surface touches world.js, the render loop or the lighting: both hang off `app.on('frame')` and put their meshes in `world.layers.deco`.
- **Hiding is per recipient, in one place.** `entryFor` swaps every `turn.*` (also inside a batch) for `turn.view` with `forPlayers(area)`. A change that is not a turn command but alters what players may see (hide, reveal, rename, delete) cannot ride on its own log entry without changing that entry's type under the clients that key off it, so it goes as a message of its own (`t: 'turns'`), sent only when the filtered order differs from the last one sent.
- **Rolls are two commands, not a batch:** `dice.roll` then `turn.init`. A batch would hide the roll from the AI seats' "says and rolls" filter, which looks at top-level entry types.
- **A hidden pawn's roll line would have named it in the chat.** Caught while writing the GM's bulk roll; the roll for an entry with no pawn showing sets the number and posts nothing (client and GET `turn.roll` both).
- **Key maps are read once.** `keysSurface` builds its map when it is made, so a surface that registers commands with keys must come before it in main.js (turns and xray do). The first run had N doing nothing.
- **The command audit (browser_figs) runs every command with no arguments**, including hidden parse-only ones: `turn.bonusTyped` threw on `a.bonus`. Parse-only commands now open the bar on their phrase when run bare. Fight-only commands are listed in the audit as covered by browser_turns.py.
- **X-ray look, by Gemini.** A filled translucent body with a bright base disc read as "large glowing yellow shapes" and not as figures. Fresnel power 2.6, body 0.05, base 0.14: "13 figures … some translucent blue, others translucent yellow". True silhouettes with a stencil pass were not tried: the renderer's stencil is off since three r163 and the look goes through the tuner's passes.
- **X-ray cost:** 60 figure pawns are 983k triangles drawn again (240 draws): +4 ms on an 81 ms frame, +0.3 ms on a 23 ms one. If it ever matters, draw the 8k tier for the outline.
- **The live campaigns:** 93 named throwaways removed at 18:40, then (Harry's word, relayed) every idle campaign with nobody connected: 162 more at 19:19. `remove_throwaways.mjs --all` asks the relay who is online in each campaign (the campaign view's `online`) and leaves those and anything written in the last two hours. The corpus the migration suites need was frozen first (`test/corpus.mjs`); migrate 434/434 and areas 114/114 before and after.
- **Tests on the branch:** node: core 446, relay 163, areas 114, migrate 434, turns 79 (new), wheel 30, framing 7, roofs 60, water 16, harness 5/5. Browser (local, GPU): turns 54/54 (new), UI 87/87, figs 171/171, pawnring 95/95, chatline 34/34, cut 112/112, areas 57/57, two-tab 28/28.


## 2026-10-06 (night): a floor stops the pointer (branch `pickfix`, merged and deployed, client v=20261006203804)
Harry: "on floor two I can still select things on floor one directly thru the actual floor. (not just things I can see blurry, but the actual physical floor is not flooring.)" Use: docs/UI.md "A floor stops the pointer".
- **Cause.** `pickAll` raycasts the things and the wall pieces and appends the floor from `floorPoint` LAST. Floors, slabs and the ground were never among the ray's targets (a floor selects nothing), so they could not be in the way either. The "what nobody can see is not drawn" rule had hidden most of it: a covered room's furniture is not drawn and was already skipped. Pawns, wall pieces, doors, posts, stairs, and everything in a room only partly covered, were picked through the floor; a cellar's the same through the closed ground. The selection box never asked about sight at all, only about the cut.
- **Fix.** `world.floorStop(ray)`: how far along the ray the first drawn floor is. Worked out from the rooms that are showing (kept with the cut sets, `floorPlanes`): the floor plane of each level where a room has floor, less a stair's hole cells; upstairs the 1-ft slab as a solid, entered from above, below or through its SIDE (the first version tested the two planes only and let through the top of a lv-1 wall seen past the slab's edge: 26 of 2,560 points); the ground at -0.02 ft less `groundOpenCells`. `pickAll` and `surfaceAt` stop there (0.05 ft of slack for a rug or a tile). `world.inSight(rec, camera)` for the box: six points of the thing's bounds against the stop and, roofs on, `roofAt`.
- **Paths, all through `pickAll`:** hover, click, the stack cycle, the start of a drag, touch, `cutTargetAt` (double-click), `pointAt` (pings). Through `surfaceAt`: placing or dragging onto a table top. Through `inSight`: the box. Not through any of them, and right by construction: where a drag or a placed thing lands (`floorPoint`, the highest floor at or below the cut).
- **The audit was asking for the bug.** `test/audit.py` took "the first thing drawn" from the shell and the things without the ground, so a cellar wall drawn under the closed ground counted as on screen and had to be pickable: 40 to 84 "untouchable" points in the storeys, stairs and cut suites the moment the ground stopped the pointer. The ground mesh is one of its layers now. The pair: the audit (what is drawn first is reachable) and FLOORS in `browser_cut.py` (nothing reached lies behind a floor that is drawn, checked against a raycast of the floor meshes themselves).
- **Left alone, said in the doc:** a pawn behind a wall is still picked ahead of the wall (the stack order, older than storeys); select-all goes by room; `floorPoint` still answers "the upper floor" over a stair's hole (a pawn dropped there goes down the stair, by design); with the GM's pawn X-ray on, an outline seen through a floor is not a handle (as it already was not above the cut).
- **Cost** (scratch script, 50 rooms in five buildings on three levels, 1,963 things, the build box): `floorStop` 0.5 to 0.7 µs a call; `pickAll` 4.6 to 5.2 ms a call WITH OR WITHOUT it. The pick was already that dear: every pointer move raycasts every thing in the area. For the frame-time work (not measured here): setting `Raycaster.far` to the stop may let three drop what is behind the floor early, and a bounds test per building would skip most of the rest.
- **Traps.** A test's box that begins on a room label drags the room, and one that begins on a wall piece drags the wall: begin on bare ground (the suite's `box()` looks first). A fresh worktree has no kit meshes, icons or node_modules (git-ignored): link `engine/node_modules`, `engine/client/data/icons`, `engine/client/data/cursors` and `tools/spawn-tuner/assets` from the main tree or a dozen checks fail for reasons that are not yours. The session scratchpad is shared by every agent of the session: keep to a folder of your own.
- **Tests:** `browser_cut.py` 112 → 140 (FLOORS is 28 of them; `--floors` runs it alone in about two minutes). Before and after on the same main, each in its own worktree and on its own ports: storeys 42/42, stairs 41/41, roofs 60/60, UI 87/87, nits 72/72, rooms 118/118, build 89/89, pawnring 95/95, figs 171/171, areas 57/57, turns 54/54, all unchanged; after only: follow-ons 41/41, pieces 63/63, tiles 37/37.


## 2026-10-06 (late night): figures drag out of the lists (branch `dragout`)
Harry, playing with a playtester: "I notice a small tweak: the pawns can't be dragged out of the text-search menu." Use: docs/UI.md "Dragging a figure out of a list".
- **What was there.** The bar's FURNITURE rows already dragged (`dragging` in surfaces/bar.js, `modes.place(cat, { viaDrag })`); figure rows took the `click: true` branch. The pawn tool was already a 'place' mode, so `modes.hover` and `modes.placeAt` reached it: the missing part was only the gesture.
- **One gesture, three wrappers** (client/pawns.js): `app.dragOut(ev, { begin, move, drop, end, key })` from a pointerdown; `app.dragPawnOut` puts the pawn tool's ghost in the hand; `app.dragFigureOnto` puts a figure's picture in the hand for a drop onto a pawn. The bar's figure rows, the tree's thumbnails (`figTree({ onDrag })`), cast tiles and bench tiles call the second; "change figure" rows the third. The furniture rows keep their own older code.
- **Shift.** In the click tool Shift is "keep placing"; in a drag it is "off the squares" (`pawnFormation(..., { free })` shifts the whole formation so the lead is under the pointer). `mode.viaDrag` decides which, in `pawnTool.hover` and `placeAt`.
- **The list is hidden with `visibility`, not `hidden`.** A finger's pointer events stay with the element the touch began on; keeping that element laid out is the safe side, and `elementFromPoint` passes a `visibility: hidden` list by, so the map under it takes the drop.
- **The release of a drag also makes a `click`** on the nearest common ancestor of where the button went down and up (or on the same tile, when let go where it began): one capture-phase listener swallows it for that tick, else a pinned menu's tile would start the click tool as the drag was cancelled.
- **Keys while dragging are taken in the capture phase:** the keyboard is in the bar's field, so R would have been typed and Esc would have closed the bar.
- **Rows that drag have `touch-action: none`** (as the party rows already had): on touch a finger on a figure row cannot scroll the list. The touch check drives `Input.dispatchTouchEvent` over CDP.
- **The change-figure picture first sat centred on the pointer and hid the pawn it was over** (Gemini's blind read of the first shot found no floating picture at all and no clear target); it rides up and left now.
- **The selected pawn's ring caught the drop.** "change figure" needs a pawn selected, so its ring is up; on a full figs run the target pawn stood beside it, under a ring button, and the release counted as "not the map". The ring (and room labels) take no pointer while something is in the hand (`body.dragging-out`).
- **Trap in the suite:** `at(pg, css)` builds its script with single quotes round the selector: selectors with attribute values need double quotes. A tile below the fold has to be scrolled into view before a hand-made drag (a Playwright `click` does it for you).
- **Tests, before → after on the same main (each side in its own tree and on its own ports, local, GPU):** figs 171/171 → 192/192 (DRAG is the 21 new), pawnsmenu 150/150 → 160/160 (10 new in MINE, TREE, CAST), UI 87/87 → 87/87, nits 72/72 → 72/72, build 89/89 → 89/89, cut `--floors` 37/37 → 37/37, pawnring 95/95 → 95/95.
- **Gemini, blind, two shots mid-drag** (`--shots`): the owlbear in hand read as "a translucent, ghost-like figure of an owlbear with a circular base", "four floor squares are highlighted", "No menus or search result lists are visible", and the pointer's line read word for word; the change-figure shot, after the picture was moved off the pointer: "a small square picture floating ... just above the Goblin 2 figure ... a grey wolf".
- **Live (client v=20261006213811, main 06ff5b5), with NO relay restart.** Harry was in a game with a playtester. The live client was byte-for-byte main's (compared with the version stamps stripped), so the deploy changed five client files and nothing the relay runs: `engine/deploy.sh --no-relay`. tw-relay kept its 21:25:46 start and its connection; no copy of the campaigns was needed because nothing reloaded them. Checked on live with a throwaway campaign made BEFORE the deploy (a room, four pawns, 104 things): after it, the same link opened on the new client with all 104 things equal and the three figures drawn; "elf wizard" dragged out of the bar and a thumbnail dragged out of the Pawns menu each landed on their square; the campaign then removed itself (10 campaigns before, 10 after).

## 2026-10-06 (night): big maps made fast, and the hand comes first (branch `perf`, worktree ../3d-vtt-perf)
Asked: the three fixes of the mega-map measurement, fog checked "just to be sure", and priority for pan / rotate / mouse actions. Numbers, method and the stills: `experiments/2026-10-06-megamap/FIXES.md`. Use: docs/UI.md "Big maps: far rooms sleep, and the hand comes first".
- **Every fix has a switch.** `AreaWorld.PERF` (world.js): `aoList`, `sleep`, `shadowList`, `freeze`; `tw.perf.set({ sleep: false })`, `?perf=off`. Off is the old code path, kept on purpose: it is how each fix is measured against its own baseline in one page (A, B, A, B), and the way out of one. To back a fix out for everybody, set its word to `false` in `PERF`.
- **Contact shadows (fx/lighting.js).** N8AO's "transparency aware" mode walked the scene four times a frame with a Map of every node and had three.js walk it twice more, to draw a few dozen see-through things into two buffers. `renderSeeThrough` fills the same buffers from a list: for the length of the two draws `scene.children` IS the list plus every light (the same light count, so no shader variant changes). The list is rebuilt when a scene-graph counter moves (`Object3D.add / remove / clear` are wrapped once: three.js tells only the child) and once a second. N8AO's rule for what goes in which buffer is kept exactly (`qualA`, `qualB`, a parent with a material that does not qualify hides its children).
- **Sleep (world.js SLEEP).** The unit is the ROOM. `buildUnits` (a box per room), `unitOf(entity)`, `sleepStep` (every frame: who must stay awake, who has been out of every view for `SLEEP_DWELL`), `beforeRender(camera)` (called by main.js for each view after its camera has moved, and by thumbs.js: wakes what that camera could see, then world positions). Asleep = the group is not a child of its layer; `.visible`, the cut flags and the shadow marks are untouched and keep being maintained, so nothing asks "is it asleep" except the per-frame loops (`r.asleep`, `s.asleep`, `rec.asleep`) and picks. `it.asleep` goes to the fx stack: fire.js keeps a sleeping fire's LIGHT (a changing light count compiles every shader again: a visible hitch) and drops its flame; atmos.js still counts its floor; settle.js still seats its things.
  - Trap: lanterns of one kind share a material and each wrote its own glow into it every frame; a sleeping one switched a lit one off. Found by the stills (0.15% of the pixels, all on two lanterns). The glow is now "any of them alight".
  - Trap: a test that walks `scene` to count placeholders no longer sees sleeping ones (`mm.wait_settled`); ask `world.recs`.
- **The fire's shadow (fx/lighting.js, world.shadowCasters).** three.js draws a point light's shadow by walking the whole scene for each of six faces. `drawShadows` renders the map itself just before the picture, with `scene.children` = lights + the things within the light's reach, into a 1 x 1 target with a camera that sees nothing; the main draw then finds `needsUpdate` false. The list is held against the light's wobble (`casterCache`: a foot, a quarter second) or membership flickers and reads as motion.
- **The slow state** (400 ms instead of 200 at 203 rooms). Not the dirty flag. `settle.js` asked `itemsOfRoom` for every thing it seated and the game answered by filtering every thing in the area, so the queue took minutes to run out on a big map; each seated thing changed the lighting stack's "something moved" signature (a sum over every item), and that redraws the shadow EVERY frame instead of every other. Fixed three ways: an index of things by room (`world.itemsOfRoom`), "something moved" asked only of the shadow list, and the measuring scripts now wait for the queue (`mm.wait_seated`). `fx.stats().shadow_why` counts why the shadow was redrawn (motion, dirty, dance, timer).
- **World positions (world.updateMatrices).** `scene.matrixWorldAutoUpdate = false`; small layers in full; one test per thing / shell group (`touchGroup`: position, quaternion, scale, child count, first child); selected, hovered, dragged, arriving things, their riders and pawns in full; a few groups in full each frame in turn as a net. Picks call `settleMatrices()` instead of `scene.updateMatrixWorld()`. Trap: code that moves a mesh INSIDE a thing's group without touching the group is caught only by the net, up to two seconds late; make the thing "hot" or move the group.
- **Also found by profiling after the three:** see-through floor decals were double-sided two-pass materials, and three.js marks such a material changed for each of the two draws, so its program was looked up again four times a frame per decal (`forceSinglePass`, look.js); room labels filtered every entity and touched an element per room each frame (labels.js: lists kept per state through `app.derived`, no element until a label is near the window); `fogLevel`, `floorPoint`, the level range and the building in focus walked every entity (now `world.roomsNow`, `app.roomList`).
- **The hand comes first (engine/client/interact.js).** `app.interact.frame(now, ms)` at the top of each frame: moving = the main camera's pose changed, `localDrags`, a button down on the canvas, the wheel; active for `HOLD_MS` after. The governor sheds a stage when the moving average runs 20% over `TARGET_MS`, judges it over 8 frames against the average before, keeps it for a 5% gain, else puts it back and leaves it alone for a minute. Stages are hooks on the modules: `lighting.shed({ dance, ao, fade })`, `atmos.shed(n)`, `world.napPx` + `napStep`, `renderer.setPixelRatio`. `app.interact.busy()` (moving, or `isInputPending`) is what waiting work asks: the settler's budget, `sleepStep`, thumbs. `onAreaChange` applies the first change of a frame at once and holds later ones to the next frame (`flushSyncs`); `app.worldOf` applies what is held first, so a reader never sees the gap.
  - Under a test driver (`navigator.webdriver`) the shedding is off unless the test sets `tw.interactForce = true`: it follows frame time, and on a busy box it would come and go inside suites about other things. `tw.interact.pretend(ms | fn)` gives the governor a frame time to believe; `tw.interact.hold([...])` holds stages on for stills.
- **Tests:** `browser_sleep.py` (43: asleep, every-frame wake rule checked in the page against the camera that drew the frame, state arriving while asleep, selection / click / ping across the edge) and `browser_interaction.py` (36). Counts for the old suites before and after are in FIXES.md.
- **Measuring on a shared box:** `experiments/2026-10-06-megamap/perf_ab.py` (a switch off and on in turn in one page), `perf_matrix.py` (every view, fog variants, the switches one at a time; `TW_MM_REPO` serves the old code with the new scripts), `perf_input.py` (an input event's timestamp to the end of the frame that draws it), `perf_shots.py` (stills of one frozen instant: `tw.freezeTime`), `profile2.py --chains fn`.

## 2026-10-07: the loading screen (branch `loading`, worktree ../3d-vtt-loading)
Asked: "a simple but a high impact thing. I think we need a loading screen ... take lessons from the mapgarden loading screen." Then two changes while it was being built: the mark is a turnip in front of crossed wrenches, and the bar is deliberately not honest about the end ("lets make it so that happens around 77% or so"; "You're always fine hitting 77% and then just being done"). Use: docs/UI.md "The loading screen". Measurements before and after, the scripts: `experiments/2026-10-07-loading/README.md`.
- **Where a load freezes (measured, the reason for the bar's shape).** Three stretches of main thread with no frame between them: the modules being evaluated (before `main.js` runs), the renderer and lists being made (after the tuner's files land: 320 ms in Chromium here), and the state's message → the room set out → the first frame, one unbroken task (0.25 s for one inn, 0.6 s for 52 rooms in Chromium; 3 s in Firefox on software drawing). "Connected" and "the state arrived" are 6 to 9 ms apart on a local relay, so there is NO free moment between them to hand the compositor anything.
- **Trap 1: a plan made just before a freeze never reaches the compositor.** The first version re-planned the bar at `welcome`; the freeze began 9 ms later, before a frame, and the bar stayed where it had been. The plan for everything after the code starts is now made ONCE, at `LOAD.at('code')` (the tuner's files are fetched next, so frames follow), as one Web Animations keyframe list: on to the stall point, then the creep. The words change the same way (opacity keyframes with offsets), not by setting text at a milestone that is inside a freeze.
- **Trap 2: restarting an animation from its own computed value on every event stops it dead.** Files arrive every few ms; each restart began from the value at the last frame and the new animation had not started by the next arrival, so the bar sat at 0 through a whole load. The fetch part is now looked at five times a second.
- **Trap 3: the browser's answer for "where is the bar" is stale after a freeze** (the document timeline moves once per frame). A new plan started from a stale answer draws the bar BACKWARDS. The position is worked out from the plan in force and the clock (`at()`), straight-line segments only so that is exact.
- **The stylesheet link is in the body, after the screen.** In the head it held the first paint until it had answered (0.3 to 0.6 s on live). `#app` and `#start` are `hidden` until `main.js` runs, and scripts wait for a pending stylesheet, so nothing is seen unstyled.
- **Starting a campaign no longer reloads the page** (`history.replaceState` and `boot(token)`): the reload fetched and started the whole game twice. `boot` reads its token only from its argument; nothing else in the client reads `location.hash`.
- **`denied` is taken from the connection's status, not from a nack's code**: a refused command can carry the code `denied` in the middle of play, and that must not put a failure screen up.
- **The loading screen never takes the pointer** except when it shows a failure: the old suites click the table the moment `tw.ready()` is true, during the fade.
- **Tests.** `engine/test/browser_loading.py`: 59 checks in Chromium, 56 in Firefox (three there cannot be had from the driver and are printed as NOT VERIFIED). Under the test driver a screenshot waits for the main thread, so "the bar moves while the page is frozen" is measured in Chromium through the screencast (22 frames across a 2.5 s busy loop: the bar's gold pixels grew in each, the mark's pixels changed between each); in Firefox it prints NOT VERIFIED. Playwright's screenshot also waits for fonts, which wait for a held stylesheet: the "painted with everything held back" picture is taken through CDP.
- **Cost: none measurable.** First real frame, before and after in turn in one run (`experiments/2026-10-07-loading/ab.py`, 8 cold loads each): one inn 560 → 550 ms (spread 547 to 814 before, 542 to 573 after), 52 rooms 956 → 958 ms. Firefox (4 each, software drawing): 1,195 → 1,180 and 1,736 → 1,778 ms, ranges overlapping.
- **Worktree note:** a new worktree needs five links before the game runs from it: `engine/node_modules`, `engine/tuner`, `engine/tuner-data`, `tools/spawn-tuner/assets`, `engine/client/data/icons` (and `cursors`); copy them from another worktree (`readlink`). Without the assets every mesh is a 404 and the room stays grey boxes.
- **Trap 4, found after the first deploy (live for about 25 minutes, v=20261007105954): a travel's screen could come up AFTER the area was drawn and stay.** "The loading screen is waiting for a first frame" was noticed by a frame seeing the empty view. When the state arrives before any frame is drawn (a local relay, a travel back with nothing new, or a big map at a few frames a second) no frame ever sees it, the first frame of the new area passes unremarked, and the timer (0.2 s then, 0.35 s now) then puts the screen up for good. `setMain` now sets the flag itself. Found by the Firefox run of the measuring script (the live region still said "Travelling to Second town" seconds later); `browser_loading.py` H5b travels six times with the page busy for 0 to 400 ms right after asking and fails on the old code. A travel whose area never arrives now gets the "much longer than usual" sentence after 25 s instead of a screen for ever.
- **An old check that turned out to depend on how long the page had been open (`browser_ui.py`, "a selected room's brackets can be seen from the angled view").** It failed 5 times in 8 after this work and 1 time in 11 before it. Cause: the selection brackets breathe (0.4 Hz) and the number of bracket points in plain sight swings with them (92 to 126 of 168 in one room, sampled every 100 ms); the check took ONE sample, at a moment fixed relative to the page's clock, and starting a campaign without a reload moved that moment. Shown by putting the reload back (4 of 4 pass) and by sampling over three seconds. The check now takes the best of one breath (12 samples, 2 s); 5 of 5 pass. Nothing in the game was wrong.
- **Travel's grace period is 0.35 s, not 0.2** (a local travel is 0.26 to 0.3 s: the screen came up for the last tenth of a second, a flash); the screen fades in over 0.2 s.
- **The remembered time to the state is the QUICKEST of the last three loads.** On live the time to connect swings (0.45 s on one load, 2.9 s on the next: the WebSocket try that fails before SSE). Remembering only the last load, a slow one made the next screen leave with the bar a third of the way. Guessing short parks the bar at the stall point, which is the plan.
- **Old flake, not from this work: `browser_two_tab.py` M5** (three checks fail together when the click meant for the NPC lands on Brakka's pawn: "first click hit tok_brakka0001"): 3 runs in 10 on the code before this work, 2 in 8 after.
- **A test trap:** a Playwright route that calls `continue_()` on everything swallows the sandbox's own route for the house look, and the game then draws in the built-in night look (mean brightness 22 of 255), which reads as "a black frame after the loading screen". Use `fallback()`.

## 2026-10-11: Roll (a thing tipped onto its side)
Harry's note: an option in the object ☰ to rotate "via 'roll'". docs/UI.md "Roll", docs/NETCODE.md "Tilt".
- **Where the tilt lives in the scene:** on a node INSIDE the thing's group, made only while it is tilted (`seatTilt`, world.js). The group's own position and rotation are written by the spawn animations (`rotation.set(0, rest.rot, 0)`), poseRec, the settler and the cut's flight; a tilt put on the group (as the library's exhibits had it) is wiped by the first of them. An upright thing is built exactly as before.
- **Grounding is measured on the vertices**, in the group's frame, with the mesh's own local matrices (not the world's, which are stale under the frozen-matrix pass). Upright lowest point is remembered per visual; the tilted one is brought to it. A mesh that dips under its group (a sack: -0.05 ft) keeps its dip. Dense meshes are sampled (60k points at most per mesh).
- **The frozen-matrix pass (`touchGroup`) does not see a change inside a group:** seatTilt sets `group.matrixWorldNeedsUpdate`, or another seat's tilt of a thing I am not pointing at would be drawn late.
- **The settler does not know about the tilt** (it walks from the visual with its own matrices). So a tilted TABLE still holds its riders where its top was; a tilted RIDER is seated as if upright and the tilt then keeps its lowest point there. Making riders fall or slide is a different piece of work.
- **The library's exhibits** ("on its side", "on its back") gave their own offsets for a tilt about the base; they now give the slot's centre and the same code centres and grounds them. Its clip strips the tilt (things are placed upright).
- **Test traps:** a worktree without `tools/spawn-tuner/assets` runs every suite on stand-in boxes and nothing says so (the mesh waits just time out); on lv 2, and under an upper floor with all levels showing, lv 1's things are not drawn at all, so "the floor stops the pointer" cannot be shown with a thing under a floor, only that it is not picked; two tabs reloading at once lose their GL context on the build box.

## 2026-10-11: three small notes (library sizes, fog off, no depth look)
- **The library's "same size" is a drawing scale, `libK`, on the library's own local things**, applied where a thing is posed (`poseRec`) and placed (`place`), and counted in the rule that puts small things out of the scene while the hand moves (`napStep`): without that, a cup drawn 3 ft wide would vanish as a 3-inch thing does. Dragging out and copying never carry it.
- **Fog off is a switch inside the atmosphere (`setOff`), not a cleared preset:** the dials, the rooms' fog heights and the house look stay what they are; every "is anything on?" test answers no, so `frame()` returns before the simulation. The game gives the atmosphere no hidden regions (its "fog of war" drawing is a tuner demo), so there is nothing a fog switch could uncover.
- **Measuring on a loaded box:** two separate runs (before, after) were useless at load 25 to 60 (9 ms and 60 ms for the same scene). One page with the pass switched on and off in turn, taking the pairs' differences, is far better, but it too was wrong under load: 0.78 ± 0.19 ms at load 12 to 16, then 0.0 and 0.01 ± 0.13 ms on a quiet box. A paired design removes drift, not contention that falls unevenly on the two arms. Measure when the box is quiet.
- **Trap:** `pkill -f perf_storeys.py` from a shell whose own command line contains that text kills the shell and leaves the test's servers holding their ports. Kill by PID.
- **Trap:** the suites use fixed ports, so two agents running the same suite collide ("port … is busy"); retry, do not kill the other one.


## 2026-10-13 — Task A play-test changes (Codex; verified live)
Harry's brief: one Measure button in Pawns; fitted player portraits from the marked main pawn; room/building primary Hide with durable, undoable pawn cascade and player-pawn exception; one persistent Keep bar with independent duration/attachment. Worktree `3d-vtt-codex-a`, branch `codex-a`; no ring geometry or icon redesign. Verification will extend existing suites, exercise relay withholding and save/reload, run the required regression suites under `tw-slot`, then land under `flock /tmp/tw-main.lock` and verify live. PHOENIX.md deliberately untouched per brief.

Task A setup finding: fresh worktrees need ignored `engine/node_modules`, `tools/spawn-tuner/assets`, `engine/client/data/icons`, and `engine/client/data/roof` available. Symlinked the existing artifacts; the asset gate names missing paths exactly. Keep-bar regression found and fixed: expiry must supersede the still-open creation bar so Remove/Keep remains reachable.

Task A focused verification: Party browser 51/51 before two added no-main fallback assertions (full gate will cover those); party node 74/74. Rulers browser 100/100, node 118/118. Core 715/715 and relay 200/200 include cascade, raw player payload absence, transfer/bring/drop, save/reload, undo and grouped template creation. Portrait crop audit covers dwarf, wizard, wolf, owlbear, dragon and bear; their baked pictures contain usable heads. The shared crop was widened to 2× to retain ears/hats/snouts. First room browser run passed the new cascade block but exposed stale ring expectations and a later reload timeout; exact primary/expanded expectations corrected and rerun underway. Source and asset gates pass (23,680 listed files, 22,996 delivery copies; none missing).

Independent code review before landing caught two Keep-session bugs that single-seat toggles missed: a duration edit recomputed geometry from the origin pawn after another seat moved it, and resending unchanged rounds reset remaining lifetime after a combat advance. Stopped the locked gate (after rulers 100/100 and UI 87/87), verified main still at `f3273d0`, and added multiplayer regressions with the repair before retrying. The complete focused room suite passed 130/130 after its obsolete expanded-Hide expectations were updated; the reload timeout did not recur.

Review repair `779061d`: existing templates are now authoritative for sparse Keep-bar property edits, anchor and caught-pawn calculations. Duration edits retain geometry; Keep and attachment preserve elapsed rounds. Natural turn-next/prev no longer split creation undo. Retained-bar click-away includes the command bar. Focused KEEP/ROUNDS browser 46/46 and rulers node 119/119 pass; full browser gate now has 106 checks.

Integration security repair (2026-10-13): upstream faction suppression had one saved visibility flag that room hide/reveal did not update. Reproduced both failures with the shared reducers and player projection: restoring an available faction could reveal an object inside a still-hidden room; revealing a room exposed the payload of a still-missing faction slot. `entity.flag` now records the requested visibility in `factionWasHidden` while keeping missing assets hidden, and faction restoration also honors the current room's hidden state (including older snapshots with stale flags). Existing furniture reveal semantics and pawn cascade provenance are unchanged. Extended `factions.test.mjs` verifies room/building and explicit-object flags, undo, old snapshots, restart, and actual relay recipient entries: suppressed parented slots disclose neither their ID, attachment ID nor asset path. Verified factions 122/122, core 715/715, relay 200/200; no browser changes in this repair.

Final-gate integration notes: merged current faction work, retained exact room ring and room faction access via bar/chords, building/object faction menus unchanged. Updated faction/browser room inventories; faction browser 57/57 and rooms130/130 pass. Full Pawns menu initially passed167 behavior checks but failed its no-page-errors check with three vendor postprocessing null-alpha exceptions during area travel. Read-only diagnosis: transient GL loss (getContextAttributes returns null in EffectComposer during area creation); portraits create no renderer. Stack diagnostics added, full retry168/168 clean. Runtime unchanged. Reuse prior locked rulers106/UI87/rooms130/pawnring105 passes only after comparing their suites and all runtime paths against tested commit11e670d; continue remaining locked gates.

Task A final evidence (2026-10-13 07:01 PDT): deployed/pushed source11e670d, client20261013065032; relay active since06:50:36 after backup301 campaigns (7.5M), `/mnt/usb/turnip-works/relay-data-backups/data-20261013-065036-engine-20261013065032.tar.zst`. Local browsers707/707: rulers106, UI87, rooms130, pawnring105, pawnsmenu168, two-tab28, cuts26, factions57. M5's known three-check flake passed its one allowed rerun. Node1255: npm core715/relay200/harness5, party74, rulers119, factions122, catalog5, picker15. Source sanity and local assets23680 +22996 delivery copies passed. Full logs `/tmp/tw-a-gates/`.

Live487/487: rulers106, pawnsmenu168, rooms130, cuts26, factions57. First live Pawns run timed out reloading Kit before tw initialized; its throwaway campaign was removed, and full retry168/168 passed with request/console/stack diagnostics, no page errors. Logs `/tmp/tw-a-live/` (Pawns success is `browser_pawnsmenu-retry.log`). Rulers, rooms, cuts and factions passed first live run. All six live test campaigns, including failed attempt, were removed. House look/ratings remained unchanged. Cached asset audit46676 paths per host,0 missing. Version fetched at end remains20261013065032. Screenshots in `engine/test/shots/`; main-pawn crop audit `task-a-portrait-audit.png`. Final follow-up changes only documentation and test error diagnostics; runtime matches the deployed and live-verified tree.

Decisions for Harry: N defaults to2; explicit main only; baked crops are sufficient for audited dwarf/wizard/wolf/owlbear/dragon/bear. Inference: a pawn moved out of a hidden room loses that room's reveal provenance, staying hidden until explicitly revealed. Room faction picker remains accessible from bar/chords, building/object menus intact. Known unmodified robustness gap: FX construction during transient context loss can read null GL attributes; two subsequent full local Pawns runs and live retry were clean. No requested UI work omitted.

## 2026-10-13 — Task D room Faction restoration (verified live)
Conflicting Task A/B briefs resolved: every room's expanded ring ends in Faction after Walls, Fog height, Lock and Height; primary, geometry/icons and other selections stay unchanged. Existing grid offers As the building's. Implementation `945a7d1`, client `20261013072540`, client-only deploy under `/tmp/tw-main.lock`, fresh origin/main integration in own temporary branch. Browser screenshots verify room menu and inherited grid; factions suite uses real room hamburger clicks again.

Local GPU gates: rooms130, cuts26, factions57 (213/213); Node1068: core715, relay200, convergence5, factions122, catalog5, picker21. Logs `/tmp/tw-d-gpu/`. Initial software-rendered room run (`/tmp/tw-d-gates/`) failed timing-sensitive undo, camera-follow and fog checks: this suite requires `TW_GPU=1` (unlike the other suites' GPU default). Full GPU run passed unchanged. First live run exposed a separate two-seat wait race: player restoration was awaited but GM state was sampled immediately. Test now waits for both exact states, retaining diagnostics; full live retry130/130 passes, GM visibility `[false,false,true]`, pending0. No undo/rendering runtime changes. Live cuts26/26 and factions57/57; logs `/tmp/tw-d-live/`. All live throwaway campaigns removed; house look and ratings unchanged; cached assets46,676 per host, zero missing. PHOENIX.md untouched.

## 2026-10-13 — Task F test-debt repair (in progress)

Baseline source frozen at fetched origin/main `ab07c51` in a separate worktree.
Settings metadata could stay cached for20s after another seat uploaded an area
picture; explicitly opening World navigation now refreshes it. The regression
primes that stale cache and requires the latest upload timestamp within the
original10s limit: baseline66/67 in3/3 runs, repaired67/67 in10/10.

Figures: the palette hid every candidate drop target before the drag started;
start the real drag first. New generated-building and ruler/template commands
now receive actual registry-derived state fixtures. Title-prefix ranking makes
`graphics` find its quality presets within eight rows. Shader warmup in the
shared tuner could poll a disposed material; capture the programs instead.
Full figures192/192, all3503 command/selection cases green, no page errors;
shader regression7/7 in10 consecutive runs. Browser grand-stair26/26 in three
baseline runs; historical stair traversal failure not reproduced. Full inventory,
remaining stability runs and landing are still pending; see `docs/TEST_DEBT.md`.

## 2026-10-13 — Task E browser continuity and names (verified live)
Harry requested bare-address resume and distinctive editable default names. Own worktree `3d-vtt-codex-e`, branch
`codex-e`, from origin/main ab07c51; PHOENIX.md excluded by request. Browser-local credential list records only successful
joins, fresh reads respect other tabs, explicit list/start uses #games, switching reloads the client, and known rejected
seats return to the start form. Unknown bad invites retain existing loading-screen behavior. Renames refresh labels
without recency changes. Full BIP-39 English list vendored with exact SHA/source and MIT terms; 13 unpleasant title
words excluded by generator only. Shared relay fallback covers non-browser/AI callers too, requiring relay deployment.
Initial naming tests 5/5, relay 200/200; storage unit tests 9/9. Added browser_continuity.py; loading/join/UI regressions
and locked landing/live checks pending. Review caught storage failing mid-resume: retain remembered-at-boot status
so a denied remembered join still reaches the fallback. Invalid out-of-Date-range stored timestamps are ignored.

Preflight fixture repair: ignored tuner assets were absent from the fresh worktree; linked the existing assets for
read-only use, copied client icons/cursors/roof and missing vendor files. Asset audit now 24,110 source +23,426 delivery
files, zero missing. Loading's first attempt reached grey stand-ins before this repair. Its create step also exposed
legacy suites selecting '#newCampaign button' without type: the dice is now a native input[type=button], leaving the
form's submit button unambiguous without rewriting dozens of unrelated suites. Join test's local server now explicitly
allows the shared assets root (its old realpath guard silently returned 404 on worktree asset links).

First locked landing (temporary merge926f8db): all934 Node checks, source/assets green. Continuity reached18 successful
checks, then its empty-list visibility wait timed out: a correct empty UL has zero height. Changed the assertion to
wait for the empty-state message. Successful-open helper now waits for loading fade removal before screenshots.
Gemini3.8 Flash's blind read correctly identified the list, role/time and both navigation entries; it caught the fade
in the Settings capture. No runtime change from this test correction. Failed attempt logs retained at
`/tmp/tw-e-landing-attempt1/`; main and production were not moved.

## 2026-10-13 — Task G vision fog (in progress)

Worktree `3d-vtt-codex-g`, branch `codex-g` from `origin/main` 508a667; requested codex-e is occupied by Task E and untouched. PHOENIX.md untouched. Settled brief: client visibility polygons per base level; per-viewer log-derived explored; opaque unseen / translucent still explored / clear current; mandatory flat fallback; settings, view-as, reset/reveal; local+live and GPU gates.

Blocking contract mismatch found before integration: relay `subscribe` sends current snapshots to initial joins; tails are 2,000 in memory / 300 in snapshots. `ClientSync` retains confirmed state and pending commands, no full history. `Journal.load` reads only records after snapshot. Thus full-campaign explored replay on a fresh browser is impossible with “nothing extra sent” and “relay changes only to carry setting.” Asked Harry for role-filtered history delivery authorization versus revising explored-memory requirement. No protocol change authorized or made yet; independent components proceed.

Task G pre-integration checks: `npm test` passed core 715/715, relay 200/200, convergence 5/5. First attempt stopped at missing worktree dependency `ws`; linked existing node_modules read-only for test use, then clean full run. New settings and geometry tests 15/15; source sanity and asset gates pass (24,110 source / 23,426 delivery files). These are component checks, not integrated fog acceptance. Browser render probe and CPU experiments live under `experiments/2026-10-13-fog/`; no deployment, live checks, or feature-completion claim. Required history decision still pending.

Task E landing and live evidence: merged fresh origin/main in own temporary branch under plain flock,
then locked gates passed: browser continuity29/loading66/join13/UI87 (195/195); Node core715/relay200/harness5/
naming5/storage9 (934/934). Source/assets/tool coverage gates green. Merge508a667 fast-forwarded main and pushed.
Client20261013201939, relay restarted2026-10-13 20:19:44 PDT after backing up301 campaign directories:
`/mnt/usb/turnip-works/relay-data-backups/data-20261013-201944-engine-20261013201939.tar.zst`.

After releasing the lock, live continuity29/29, join13/13 and UI87/87 passed. Initial loading48/49: J5 layout hashes
matched and spawn waited4ms, but4 texture requests arrived late. Full retry hit a TLS handshake timeout before J;
focused retry passed J5 but missed the entire intro while loading its observer tab (one sample, already done).
Moved observer setup before intro navigation, preserving every assertion. Corrected local J7/7; live J6/7 still
saw12 late textures despite matching hash and4ms spawn. Instrumented live J7/7 then passed. Thus all178 live
checks have passing coverage across runs, not one clean full loading run. Warmup/world/intro/texture runtime is unchanged from before Task E. No tolerance relaxed.
CDP initiators and browser request timing were captured for follow-up; do not label this proven texture refinement.
Live assets47,536 per host,0 missing. Every test run removed its throwaways, including failures; house look and
ratings unchanged. Final follow-up changes tests/docs only; deployed runtime unchanged. No fal/RunPod spend.
Evidence (all attempts, diagnostic JSON, screenshots, blind Gemini review, landing/deploy logs):
`~/task-e-evidence/2026-10-13/`. Initial `/tmp` paths above are archived there.


Diagnostic follow-up: the intro opens the room library PiP through build.applyTool; library.loadNear assigns four
assets per frame and its world fetches their models/textures. Instrumented passing live run:106 requests before
warm-ready3140ms, then366 additional requests at10186–12950ms, including every named texture from failed runs.
Those four textures followed their library GLBs; the last request finished939ms before room observation in this run.
J5 counts all /assets/ traffic, including this library stream. That is a concrete source of unrelated traffic and a
supported explanation for failures when library geometry/textures arrive later; attribution of the earlier failed
requests remains inference because those runs lacked initiator traces. See archived live/loading-j-diagnosis.md.

## 2026-10-13 — Task H command-bar picks and recall
Harry requested multi-pick placement and session-only last-list reopening. Requested codex-e already belongs to Task E; isolated codex-h from origin/main 508a667 instead. No edits in main. Bar, placement and acceptance delegated separately; landing/live verification pending. PHOENIX.md excluded. Asset fixture copy encountered an existing recursive cursor symlink in main; removed only the task-owned recursive copy and preserved symlinks for vendors. Asset gate passes.

Task H preflight: Node core715/relay200/convergence5 all passed. Initial group browser run45/47: all placement checks passed; recall fixture failed because clicking the canvas does not close the bar. Corrected harness to close with Esc before reopening. Gemini3.8 Flash read five checked rows and the correct count/action hints; preview exposed a duplicate generic cursor badge behind the group label, fixed in b4c558d. New checks cover occupied footprints, mixed sizes, drag cancellation, snap inversion and loaded individual ghost meshes. Full regressions queued through shared limiter.


Task H landing/live evidence (2026-10-13): client20261013210337, merge efb8541, client-only deploy with no relay restart. Locked suites: bar picks67/67, figures192/192 (audit3503/3503), UI87/87, pawn menu168/168 =514/514; Node core715/relay200/harness5 =920/920. Source/asset gates passed. Live group67/67, UI87/87, focused figures66/66 and pawn menu168/168 passed =388/388. All throwaway campaigns removed; house look/ratings unchanged. Live asset delivery47,536 per host on both hosts, zero missing. Screenshots plus blind Gemini review found a duplicate cursor label and dark ghost meshes; removed duplicate and illuminated textured preview materials, verifying all five models visible. Height measurements4.3–5ft ruled out scale as the cause.

Preserved failed attempts: group45/47 was a harness close gesture, corrected to Esc; initial pawn menu167/168 missed its first hover, locked rerun168/168 unchanged. Initial live focused figures63/66 sampled optimistic additions before relay acknowledgement (six entities visible while seq3→3), then raced undo and a cancellation baseline. Test-only f8b16c1 waits strictly for pendingCount=0, with20s failure; exact assertions remain, retry66/66. Earlier full-figure fixture fixes start drag before looking for unoccluded bare floor, cancel ruler tools between cases, and create actual object/building/ruler/template selection fixtures. No assertion or exemption whitelist relaxed. All attempts and screenshots archived at ~/task-h-evidence/2026-10-13/. No fal/RunPod spend. PHOENIX.md untouched.


## 2026-10-13 — Task G correction, integration and local verification

The coordinator explicitly rejected history delivery and authorized compact per-seat/per-level explored records in ordinary snapshots. Implemented authenticated idempotent fog.explore unions, own/party projections, throttled clients, campaign-wide epoch reset with undo/redo, and universal reveal memory. The checkpoint's history question is resolved; its replay prototype was removed. Visibility and presentation remain client-side. Worktree codex-g (codex-e already occupied), merged fetched origin/main at fd1b83d before integration suites; PHOENIX.md unchanged.

Verified local: core715, relay200, adverse-network5; 30 vision/storage/settings/raster tests. Required browsers819/819 (UI87, rooms130, pawnring105, pawnsmenu168, two-tab28, cut140, cuts26, followons42, graphics93), fog41/41 and shader28/28. Two-tab's first25/28 traced to overlapping randomized pawn projections, so the fixture now isolates the NPC before the same real click/atomic transfer/PiP assertions; bounded rerun28/28. The optional broad Node sweep found known catalog failures (buildings crypt key pieces, grandstair chicken/loft coverage); the command-registry mock also exposed eager optional app.sync/on access, repaired and faction-picker21 passes.

Stills caught bugs functional assertions missed: disabled final compositor pass blanked GM view, world noise tore into square bands, near-wall text was fog-clipped, and transparent rulers vanished. Added direct renderer checks for screen routing, distant ray precision, tone preservation, depth-equal pawn silhouettes and actual alpha overlays (never fog holes). Delayed-worker reset/disable, canceled geometry cache, roster changes and cross-area selection were audited and corrected. Fine current raster and redundant-ray simplification meet median CPU goal; the1.25-ft remembered edge still reads stepped up close and is explicitly recorded. Performance, traffic, blind reads and images: experiments/2026-10-13-fog/ and ../2026-10-13-fog-vision/.

### 2026-10-13 — Task G locked gate tooltip fixture
First locked gate passed Node, fog43, renderer28, UI87, rooms130, pawn-ring105, then stopped before FF/deploy at pawn-menu167/168. First tooltip returnedNone while the other four appeared. Test sampled icon coordinates during the tray’s180ms entrance transform; wait for animation and use stable locator.hover, preserving60ms and exact label assertions. Evidence retained in /tmp/tw-fog-landing-attempt1. Repeat fetched integration required before deployment. Fresh table stills confirm complete visible labels and absent unseen labels; blind read remains ambiguous about density.

### 2026-10-14 — Task G verified live
Deployed/pushed81914b5: client20261014001649, tuner20261014001634. Full tuner+engine deploys backed up301 campaigns each; live two-tab backed up302 before a deliberate restart, verified reconnect and continued play. Locked890/890 browser checks, live862/862, core715/relay200/network5,30 fog tests+21 picker assertions. Source/assets green; cached live47,536/host missing0. Every live throwaway removed, house look/ratings unchanged.

Unsuccessful attempts preserved: local first tooltip hovered during180ms tray motion (fixture now waits/stable hover); next gate port collision with codex-f (dedicated ports, reuse only exact same source tree); initial deploy backup refused because worktree lacked data (explicit live DATA_DIR, reacquired lock/fetch/tree equality, normal deploy+backup+restart+push); live pawn-menu initial navigation timeout (unchanged retry168/168); live two-tab runner lacked restart argument and cut lacked relay URL query (runner repaired, full28/28 and140/140). Runtime product code needed no live fix. Evidence: experiments/2026-10-13-fog/results/verification.json and INTEGRATION.md.

Final table-camera stills engine/test/shots/fog/00–08: unseen opaquegrey, clear current sight, still translucent current furniture in memory, no unseen pawns; flat fallbackLow/Fog-and-mist off, ruler overlay, raised base sight, view-as. Blind read-live.txt is useful but mistakes orange wood for an overlay and misses models behind labels. Stepped remembered boundary remains an aesthetic limitation. CPU1.543ms median/3.911p95 worker; separate uploadprep1.8–3.1ms; true2× GPU0.926/0.928ms common/town104 inclone pawn mask. Storage50room own+party12,201bytes; live12batches4,452bytes across two players, minimum3.58s, idle0. No paid generation.

Post-concurrent deployment check: wall-fit landing changed public versions to client20261014005016/tuner20261014005004. Live fog repeated43/43, cleanup/house-data checks green. Evidence /tmp/tw-fog-live-after-wallbench/fog.log and verification.json.

## 2026-10-14 — Task F initiative prompt follow-up

The Task F post-deploy turn browser found that Kit could enter an initiative
bonus and have it saved without a dice roll. A selection event during prompt
setup could clear the pending target; more decisively, `rollKeys` resolved
`keyPawns` through the fog-filtered display view, which dropped Kit's owned pawn
despite its presence in the relay-scoped seat view. The prompt now records its
target after selecting it and clears on command-bar dismissal after the Enter
handler runs. Initiative resolution uses the seat-scoped view; row rendering
still filters by fog. A selection-rebase regression and the full local turn
browser pass 55/55, with the expected d20+2 chat line and ordered result.
Live verification follows the client-only landing; Task F evidence is under
`~/task-f-evidence/`.

The locked gate passed and client `20261014043805` was deployed/pushed on
main `75e2182`. Live turn regression passed 55/55; the figures command audit
first missed `roof.style.shingle` because the generated roof was already
shingle. The audit now derives roof styles from the registry and starts each
at a different style. A separate run lost its room after `edit.cut` because
its relay acknowledgement arrived later than the harness's three-second
window, so the harness skipped Undo. It now waits for submitted commands to
settle before deciding to reverse them. The isolated live focused audit
passes 34/34. No further engine product change is needed.

## 2026-10-15 — Ring lab v2, real scene
Harry's second review identified two design errors: static backdrop prevented camera/piece exploration, and v1 arc math constrained secondary/nested radii and angles. Replaced it with independent v2 arc objects shared by offline bench and flagged game surface. The first local browser run caught a panel `data-role`/`data-field` mismatch; the live drag run caught fog height mapped to 30 ft, beyond the core's 8-ft cap. Both were fixed before wider testing. The initial lab camera showed only the common room; visual inspection led to a first-visit frame that includes the tavern building. Local tests, sandboxed through `tw_sandbox`, pass as recorded in STATUS.md; no house look or reviews were changed.
