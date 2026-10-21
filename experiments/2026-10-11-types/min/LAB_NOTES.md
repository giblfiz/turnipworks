# Mine (MIN) asset run: lab notes

- 2026-10-11T19:27 start. Worktree <repo> (branch type-min), based on main + a merge of
  type-dun (the mine shares the dungeon's cut-rock walls, shoring frame, rubble, floors and its solver helpers: land AFTER dun).
  Tools copied from ../dun (pod name tw-min, run prefix min). Codex allowance was out at 19:02 and restored about 19:35.
- 19:55 build_spec.py -> assets.json, 32 specs (p1 11, sib1 7, p2 10, sib2 2, p3 2). Wall and vein plates are painted FROM the
  dungeon batch's accepted cut-rock plates (its worktree's inputs/), the cracked set from its shoring-timber plate.
  Queue started, 3 workers.
- 2026-10-11 20:07 wave 1: 24 plates on pod r8bzkc1ig0rwus. 20:13 all plates done: 31 of 32 (lumber-pile rejected twice). About 20:15 the agent was cut
  off by an account limit with the pod up; the pod ran to its own 3 h timer and deleted itself (22:55, GET 404): 3.0 h x $1.79 = $5.37. The 24
  meshes had been harvested by the waiting shell.
- 2026-10-12 17:25 back. Merged main (the dungeon, temple, stairs, buildings, delivery and the tool sweep had landed). `smelter` and `coal-bin` renamed
  `smelter--mine`, `coal-bin--mine`: the smithy batch (in flight) plans the same sku names. QA of wave 1: 22 accept, 2 by override at their own size
  (beam-collapsed lies crossed; the shaft collar is 3 ft tall with its ladder top).
- 18:11 second pod xmah1buu7qe4z5 (A100, 1 h timer + dead-man) for the 7 plates left (+ the two renamed): 9 meshes, 18 s median. QA: 30 accept,
  sluice-box left out (lies diagonally). 18:39 pod deleted (GET 404): 0.464 h x $1.79 = $0.83. TOTAL RunPod $6.20.
- Flats fork had died with the account limit after painting everything: icons keyed (post.py), turntable and track end finished (finish_strips.py).
- Prep in sandbox/real (chain-min.sh): runtime GLBs written through the assets link, ladder, flats, front sweep (walls and the crystal vein: worked
  face is tile A; checked by a second blind read of the sheets).
- Room reads: four rounds (ROOM_READS.md). room_shots.py needs a 1900-px-tall page now (the palette of 78 room types leaves a 62-px stage at 950).
- A rolled `ladder-wood` is a STAIR since the stairs work landed (buildings test: "1 connectors, 0 planned"): no mine room rolls one.
- Shell lesson, three times: `pgrep -f X` / `pkill -f X` inside a command line that contains X matches itself (one killed its own shell). Use a
  bracket in the pattern ("http.serve[r] 18841") or wait on a file.
