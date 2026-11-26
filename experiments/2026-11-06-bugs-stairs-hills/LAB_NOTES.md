# 2026-11-06 bugs sub-lane: stair warnings and hills

Branch `worktree-agent-a77e883bdc3563cb3`. Every check below was run on the unchanged code first and failed there.

## A. Stair warnings
- **GM-only notes.** `world.js syncStairNotes` drew a stair's warning on every seat. Now only with `gmSide` (so the GM's
  "view as party/player" preview draws none either). `browser_stairnote.py` PLAYER block rewritten: old code 42/46
  (4 FAIL: the player sees the note; the preview sees it; "player still none"; "not for the player" after the ring brings
  it back), new code 46/46.
- **Hill edge.** `stairStatus` flagged `wall-above` whenever the flight's squares at its top were not all one room.
  `ontoHill` (core/stairs.js) lets a flight through when the only thing over it is a hill (bare top, at least one top
  square on it) or ONE room standing on a hill with the whole top row in it, the rest open air. `stairs.test.mjs` +6
  checks (86 before): old code 90/93 (3 FAIL), new 93/93.
- `grandstair.mjs` here: the Intesst / Dragon Temple rebuild (levels.test.mjs) is STILL `wall-above` after the fix, because
  `room_upper` (Building 2's 2x1 upper hall, all of it the stair's hole) is a real room over the flight's foot row. With
  that room removed (`node grandstair.mjs no-upper`) the status is null. Whether that room should count is Harry's call.

## B. Hills
- **B1 burying.** `spawnRoom` sent only `room.spawn` for a hill; pawns under it stayed at 0 (inside the earth; only the
  bank toast fired, and only for the bank). `core/height.js hillLifts` lists what stands where the hill's top goes; the
  room tool sends `token.move` / `object.move` in the same batch (one undo). `hillground.test.mjs` part 1, and
  `browser_hills.py` BURY (real room-tool drag).
- **B2 dug-in door.** `dugdoor.mjs` here: 556 of 720 rooms half dug into a hill had their outside door onto earth
  (earthAt 10 outside the door). `walls.js chooseExteriorDoor(room, rooms, closed)` + `roomgen.roomsOf` closes edges whose
  outside square is earth above the floor (only when the map has a hill). After: 0 of 720.
- **B3** "no way up or down a hill side": feature request, noted in docs/VERTICAL.md Known gaps, not built.

## Suites (after = this branch; base = 0543729f unpacked into a scratch tree with the same asset links)
- node, base and after: stairnote 80/80, grandstair 507/507, hillbuild 63/63, caves 59/59, terrain 95/95, levels 37/37
  (unchanged); stairs 86 -> 93; hillground (new) 6/16 on base code, 16/16 after; core 748/748, share 210/210 after.
- browser after: stairnote 46/46, hills 87/87, grandstair 29/29; stairs 44/46, placed_stairs 46/47, caves 53/54,
  hillbuild 51/52. On base: stairs 44/46 and placed_stairs 46/47 (the same checks: the ground under a ground-floor
  room's stair hole drawn "#"), caves 51/54, hillbuild 51/52 (timeouts under load: a raise or a move not synced within
  9 s, the phone tab). So none of those fails is new. browser_hills on base once died in SYNC (Page.reload 30 s) while
  another suite ran; after, alone, SYNC passed.
- Watch out: browser_hills/hillbuild start_local does not check that its ports are free, and a crash before
  `pr.terminate()` leaves the relay and http.server up (killed by PID here). The next run then silently uses them.
