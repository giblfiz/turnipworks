# City rooms: blind reads at table distance (2026-11-06/07)

Gemini (agy-run, the subscription), blind: each room laid out ALONE in this worktree's tuner (seed 11, its default size),
shot from the game's high three-quarter view; the eight pictures under random names in one empty folder, one call, no
room or type name anywhere ("what SETTING or era, what KIND of room, how sure, its main things, what it is built around,
what looks wrong"). Pictures: `shots-r1/<key>-default-11-{table,table-sw,top}.png`; answers `shots-r1/read-table.json`.

| room | read as | setting | conf | what it is built around (Gemini) |
|---|---|---|---|---|
| mod-apartment | studio apartment | modern | 98 | living room seating area with TV and sofa |
| mod-office | cubicle office | modern | 98 | two rows of office cubicle workstations |
| mod-bar | bar and pool lounge | modern | 98 | center pool table |
| mod-street | city street with sidewalks | modern | 98 | two-lane roadway with cars |
| mod-alley | narrow back alleyway | modern urban | 92 | narrow linear alleyway passage |
| mod-garage | parking lot or garage bays | modern | 98 | three parking bays |
| mod-store | convenience store or mini-mart | modern | 98 | two central retail shelving gondolas |
| mod-warehouse | warehouse storage yard | modern industrial | 95 | central stack of wooden pallets and crates |

**8 of 8 named, every one modern.** A first three-view read of the alley alone (`shots-r1/read.json`): "alleyway, modern, 95".

What looked wrong, and what was done:
- Two oil drums clipped through the alley's brick wall (the laid wall sections are up to 2 ft thick on the grid line):
  fixed, things stand clear of them (`shots-r2/mod-alley-*`).
- Parked cars "facing each other head-on in the same roadway": fixed, every car at a kerb faces its lane's way.
- A ceiling fitting "clipping through a pallet of crates" in the warehouse (the racking is 11.5 ft tall, over the 9-ft
  ceiling line): fixed, no fitting goes over anything that reaches the ceiling.
- **Open:** office, store and warehouse: "rectangular capsule fixtures placed randomly on the floor in walking aisles".
  These are the fluorescent ceiling fittings; from above at table distance they read as things on the floor. Kept (they
  light the room); a question for Harry (hide ceiling fittings at table distance, or fewer of them).
- Open, minor: the pool cue lying on the table reads oversized (the mesh; a re-plate in wave 2); the garage's two
  sedans are the same model (one sedan mesh: a second shape would help); one chair at the apartment's dining table in
  this seed; the tuner's frame-time overlay was in the pictures (the shot script does not hide it).
- Every picture: "floats in an empty void" (a room laid alone in the tuner, expected).

`shots-r2/` holds the same eight rooms after the fixes (the stills to look at); its batched re-read is in
`shots-r2/read-table.json` when the shared queue returns it.
