# Cyberpunk rooms: blind reads at table distance (2026-11-07)

Gemini (agy-run, the subscription), blind, ONE call for the ten rooms: each room laid out alone in this worktree's tuner
(seed 11, its default size), the game's high three-quarter view, the pictures under random names in an empty folder, no
room or type name anywhere ("what SETTING or era, what KIND of room, how sure, its main things, what it is built around,
what looks wrong"). Pictures and answers on USB: `/mnt/usb/turnip-works/lanes-2026-11-07/cyberpunk-rooms/shots-r1/`
(`read-table.json`), after the fixes `shots-r2/`. The only text read anywhere is the tuner's compass "N".

## Round 1 (shots-r1): 10 of 10 named

| room | read as | setting | conf |
|---|---|---|---|
| cyb-clinic | ripperdoc clinic / surgery room | sci-fi / cyberpunk | 95 |
| cyb-lobby | security lobby / transit checkpoint | sci-fi | 95 |
| cyb-server | server room / data center | sci-fi | 95 |
| cyb-noodle | diner / noodle counter | modern | 95 |
| cyb-capsule | barracks / sleeper pod dormitory | sci-fi | 95 |
| cyb-hideout | squatter hideout / survivor camp | post-apocalyptic / cyberpunk | 95 |
| cyb-talisman | apothecary / magic shop | fantasy | 95 |
| cyb-rigger | auto repair garage / mechanic workshop | modern / cyberpunk | 95 |
| cyb-safehouse | hacker bedroom / living quarters | sci-fi | 95 |
| cyb-rooftop | industrial rooftop / maintenance roof | sci-fi / industrial | 95 |

What looked wrong, and what was done:
- Three rooms: "rectangular floor fixtures" (clinic, rigger, server: "light fixtures at floor level"). These are the
  fluorescent ceiling fittings in the TUNER, which draws them; the game no longer draws their meshes from the table
  (world.js CEILING_FITTINGS), see the game-stills read below.
- Lobby: "an unnaturally long barrier of ten identical gates": two turnstile banks at most.
- Noodle bar: "two food prep counters identical side by side": one counter unless the wall is 32 ft or longer.
- Hideout: "two identical motorcycles parked against each other": one under 1200 sq ft.
- Magic-supply shop: "crystal pedestal directly in the doorway threshold": it stands against the wall by the door now; and
  no second crystal when the neon already lights the shop.
- Rooftop: "the tower sits directly on the edge of the parapet wall": the mast stands 1.4 ft clearer.
- Capsule hotel: "bunks clip into the wall panels": the capsules stood against WINDOWS; the capsule hotel has none now.
- Open, minor: identical props in rows (server racks, capsules, HVAC units: one mesh each, by design for rows); the
  server room's workstation read as "a chair alone facing the door" (the desk's facing is unread: a question for an
  orient read); the curio shelf reads "fantasy/apothecary" (it is the magic shop: intended).

## The game's own stills (engine/test/browser_cyberpunk.py --stills): the changed behaviours

Four pictures from the real game (roofs on for the first, off after), one blind call (`work/engine-stills-read.json`; the
pictures in `/mnt/usb/turnip-works/lanes-2026-11-07/cyberpunk-rooms/engine-stills/`). Asked besides: is any area a roof on
a building, does anything look see-through, are there "rectangular capsule-like objects lying on the floor".

| still | read as | conf | roof? | see-through? | floor capsules? |
|---|---|---|---|---|---|
| a Rooftop at 10 ft over an Office floor | building rooftop | 98 | **yes** | no | no |
| the gang hideout | gang hideout / squat | 98 | no | **yes: "interior wire mesh / chain-link fence partition"** | no |
| the corporate lobby | corporate lobby | 98 | no | **yes: "tinted glass exterior wall panels"** | no |
| an Office floor (wave 1's room) | office cubicle floor | 98 | no | no | **no** (wave 1: "capsule fixtures on the floor") |

Its wrongs, open: the lobby's two turnstile banks stand free with open walkways at both ends ("anyone can bypass them":
a glass barrier piece between and beside them is wanted); the reception desk against a side wall "faces the side wall"; on
the rooftop over the office the office's own door and windows show below the roof line ("as if a ground-floor facade":
true, it is the building's face), and the stair hut's door faced away from the camera.
