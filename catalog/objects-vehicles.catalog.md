# Vehicles — the Modern genre's helicopters, armoured and police cars, and drones (2026-11-07)

Harry, 2026-11-07: "we maybe need a few more vehicle options... take a peek at 'simplified shadowrun 2' on your box, and grab a
few things from there... choppers, APC, cop car." The list is his rules sheet's vehicles and drones
(`projects/dnd/SimplifiedShadowrun2v1.4.pdf`), under generic names: nothing here is official or licensed, carries a setting's
brand name, or has words, numbers, badges or logos on it (the trademark rule). The City type already had the sedan, the
hatchback and the motorbike, the Cyberpunk type the parked drone; this file adds the rest of the sheet's list that reads at
table distance (not the 10-cm insect spy drone, a speck on the table). Every sku is tier `mod` (exclusive), so no fantasy room
rolls one. Sizes are real-world at 5 ft to the square; the two helicopters are the game's biggest props (the rotor disc is the
widest part: 27 ft and 36 ft across). On the shelves they are their own section, **Vehicles** (`engine/client/library-index.js`
SECTIONS; recipes `catalog/rooms-vehicles.md`). Experiment: `experiments/2026-11-07-vehicles/`.

## V1. Vehicles — aircraft (2026-11-07)

- **helicopter** — parked light passenger helicopter on skids · floor · big · size:324x372x108 · metal · set:MOD,CYB · var:- · aff:cover,use,climb · mesh · P1 · a corporate rooftop's shuttle; a light passenger chopper
- **helicopter-gunship** — parked armed attack helicopter gunship · floor · big · size:432x528x144 · metal · set:CYB · var:- · aff:cover,use · mesh · P1 · corporate security's or the military's air cover; the encounter you run from

## V2. Vehicles — road (2026-11-07)

- **car-police** — parked black-and-white police cruiser with a roof light bar, no badges · floor · 2x3 · size:72x180x60 · metal · set:MOD,CYB · var:- · aff:cover,block · mesh · P1 · the street's patrol car; the sedan's box, so it parks in a sedan's place
- **suv-armoured** — parked black armoured corporate SUV · floor · 2x3 · size:80x200x76 · metal · set:MOD,CYB · var:- · aff:cover,block · mesh · P1 · the executive's ride; the corporate escort
- **van-armoured** — parked six-wheeled armoured van, an armoured personnel carrier · floor · big · size:96x240x108 · metal · set:MOD,CYB · var:- · aff:cover,block,climb,hide · mesh · P1 · the runners' battlewagon; a police or security APC

## V3. Vehicles — drones (2026-11-07)

- **drone-quad-light** — small armed quadcopter drone with a pistol under it · floor · sub · size:24x24x10 · mixed · set:CYB · var:- · aff:use · mesh · P1 · a rigger's cheap gun drone
- **drone-quad-heavy** — big armoured combat quadcopter with a gun turret · floor · sub · size:48x48x20 · metal · set:CYB · var:- · aff:use,cover · mesh · P1 · a rigger's or a corporation's attack drone
- **drone-hexapod** — six-legged walking gun platform robot · floor · 2x2 · size:64x80x56 · metal · set:CYB · var:- · aff:use,cover · mesh · P1 · the security walker; a two-metre gun platform
- **drone-rover-arm** — remote-control six-wheeled rover with a gripper arm · floor · sub · size:30x40x30 · metal · set:CYB · var:- · aff:use · mesh · P2 · a rigger's utility rover; bomb disposal
- **drone-rover-sentry** — armed remote-control sentry car with a gun turret · floor · sub · size:32x44x32 · metal · set:CYB · var:- · aff:use,cover · mesh · P1 · a rigger's gun car; perimeter security
