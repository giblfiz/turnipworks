# Client vision and stored exploration — 2026-10-13

Harry authorized stored explored masks instead of historical replay. `engine/core/fog.js` stores compact rows of inclusive 1.25-ft cell runs, per area, viewer and floor. Clients contribute batched unions through `fog.explore`; the relay attributes ordinary contributions to the actor's principal and unions into their own record plus party. Optional shared `partyLevels` affects party only. No history delivery is used; the obsolete replay prototype was removed.

`fog.reset` is one journal transaction across every campaign area, anchored in the current area's undo history. Undo unions pre-reset memory with exploration since reset. Redo restores the post-reset snapshot. Epochs increase on reset/undo/redo; queued old contributions are rejected. `fog.reveal` adds a universal layer including future seats; undo changes that layer without erasing players' later exploration. Contributions have no undo record and do not invalidate redo. Snapshot/log/catch-up/inverse outputs project to own records (party only when enabled); GM sees all. Toggling shared off sends fresh projections.

## CPU and storage measurement

Run `FOG_GRID_BENCH=1 node --test engine/test/foggrid.test.mjs`. The real roomgen builds 50 adjoining rooms, all doors open, with 460 generated edge segments. The benchmark moves one pawn through 100 positions over a simulated ten seconds, flushing at most every two seconds plus a final drain. CPU times on the build box, Node 20, exclude roomgen edge generation, networking and rendering. Geometry, stored raster and fine display mask run off-frame in the worker.

| Current implementation | Median ms | p95 ms |
|---|---:|---:|
| Visibility geometry including segment construction | 0.529 | 1.374 |
| Complete polygon + raster + fine mask work | 1.543 | 3.911 |

The fine mask is **864×544**, sampling at **0.3125 ft**; display size caps at 1024 pixels per axis. Stored exploration remains 1.25 ft. Removing redundant collinear ray hits reduces polygons from **528 to 27.04 vertices on average**. Its tolerance is 1e-9 ft, and it removes a point only when between its neighbours, preserving corner epsilon rays and shadow-edge reversals. The benchmark verifies that the raw and simplified polygons produce **identical fine raster rows at all 100 positions**. Before simplification, complete fine-mask work measured 4.400 ms median / 13.091 ms p95.

The persisted JSON fog record, including own and party copies, is **12,201 bytes**: 136 rows, 569 runs, 23,735 explored cells. Four nonempty contribution commands total **16,416 bytes**, largest **7,161 bytes**. These are reproducible simulation counts, not live traffic observations.

Roomgen edge generation separately measured **10.161 ms median / 15.273 ms p95**. Pawn moves reuse the world's existing edge map. The endpoint ray caster remains quadratic in merged wall count; larger maps remain worker work. Browser GPU timings and live verification belong to the parent integration report.

## Tests and review

`node --test engine/test/vision.test.mjs engine/test/foggrid.test.mjs engine/test/fogstate.test.mjs engine/test/fogsettings.test.mjs`: **30 tests** (plus the optional measurement). Coverage includes actual roomgen doors, wall faces and concave corners, controlled/shared ownership, flying bases and separate levels, radius persistence, tall-wall independence from ground openings, geometry simplification preserving area and a 0.0002-ft sight gap; scanline concavity/disjoint polygons, fine current visibility within a storage cell, upscaled explored pixels, exact delta reconstruction and texture bounds; row validation, attribution, projection secrecy, reset races, undo/redo/restart and future-seat reveal.

The controller review caught stale worker results across reset+disable and a roof-off flag affecting all rooms of that type. Its owner added an epoch guard and separated individual roof flags from outdoor type classification. Required nonbrowser suites passed in the integration worktree: core 715/715, relay 200/200, adverse-network harness 5/5. The broader optional sweep exposed documented building/catalog issues and a command-registry mock lacking `app.on`; these are reported separately to the coordinator.
