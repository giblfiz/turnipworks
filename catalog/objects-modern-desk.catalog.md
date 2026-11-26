# Modern desks and security cameras (2026-11-07)

Harry, 2026-11-07: "for modern, we need security cameras for the wall. Also a bunch of desk debris (laptop, CRT, mouse,
donut)". Built in the vehicles lane's batch (`experiments/2026-11-07-vehicles/`, library source `moddesk-03`). Small things
are made slightly chunky so they read at table distance, as the house's small props are. Every sku is tier `mod` (exclusive):
no fantasy room rolls one. Nothing carries words, numbers or logos. Where they go: `catalog/rooms-vehicles.md` (the Modern
rooms' borrowed recipes: a `gadgets` slot, shelved under Dressing) and `tools/spawn-tuner/js/solver2.js`
block `veh:solver2` (the cameras high on the walls of the lobby, store, garage, server room and office; the desk things on
the cubicle, terminal and reception desks). The dome camera is a ceiling fitting: drawn only from a pawn's eyes, as the
fluorescent tubes are (`engine/client/world.js` CEILING_FIT), since from the table it would read as floor clutter.

## M1. Modern — security cameras (2026-11-07)

- **camera-security** — wall-mounted CCTV camera on a bracket, angled down · wall · tiny · mount:90 · size:10x18x12 · mixed · set:MOD,CYB · var:lit · aff:lit · mesh · P1 · high in a corner: lobbies, shops, garages, server rooms, offices
- **camera-dome** — ceiling dome security camera · ceiling · tiny · size:12x12x8 · mixed · set:MOD,CYB · var:lit · aff:lit · mesh · P2 · a lobby's or a shop's ceiling (seen from a pawn's eyes)

## M2. Modern — desk things (2026-11-07)

- **laptop-open** — open laptop with a glowing screen · surface · tiny · size:14x11x9 · mixed · set:MOD,CYB · var:lit · aff:use,loot · mesh · P1 · any modern desk; a runner's deck
- **monitor-crt** — old boxy CRT computer monitor · surface · tiny · size:16x16x15 · mixed · set:MOD,CYB · var:lit · aff:use · mesh · P1 · old offices, squats, server rooms
- **monitor-flat** — flat computer monitor on a stand · surface · tiny · size:22x8x16 · mixed · set:MOD,CYB · var:lit · aff:use · mesh · P1 · desks, reception, security posts
- **keyboard** — computer keyboard · surface · tiny · size:18x7x2.5 · mixed · set:MOD,CYB · var:- · aff:use · mesh · P1 · before a monitor
- **mouse-computer** — computer mouse · surface · tiny · size:4x5x2 · mixed · set:MOD,CYB · var:- · aff:use · mesh · P2 · beside a keyboard
- **donut** — pink frosted donut · surface · tiny · size:5x5x2 · food · set:MOD,CYB · var:- · aff:- · mesh · P2 · desk debris; the cop's breakfast
- **donut-box** — open box of donuts · surface · tiny · size:12x12x4 · food · set:MOD,CYB · var:- · aff:loot · mesh · P2 · break rooms, police desks, stakeouts
- **coffee-cup-paper** — takeaway paper coffee cup · surface · tiny · size:4x4x6 · food · set:MOD,CYB · var:- · aff:- · mesh · P1 · on every worked-at desk
- **desk-phone** — office desk telephone · surface · tiny · size:8x9x5 · mixed · set:MOD,CYB · var:- · aff:use · mesh · P2 · offices, reception
- **paper-stack** — stack of office papers and folders · surface · tiny · size:12x10x4 · paper · set:MOD,CYB · var:- · aff:loot · mesh · P1 · offices, reception, a fixer's desk
