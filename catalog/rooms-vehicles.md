# Vehicles — the Vehicles shelf of the Modern rooms (2026-11-07)

Each recipe here is BORROWED by one Modern room type (`tools/spawn-tuner/build_data.py` block `type:veh`): it adds a
`vehicles` slot to that room's library shelves, shown as its own **Vehicles** section (`engine/client/library-index.js`
SECTIONS; a thing a room's vehicles slot names is shelved there even when its anchor slot names it too: the street's
parked cars). The slot stocks the shelves only; what a room's program parks by itself is in `tools/spawn-tuner/js/solver2.js`
block `veh:solver2` (a police cruiser on the street, a helicopter on a big enough roof, a second drone in the rigger's
garage). Since 2026-11-07 the same borrowed recipes also carry Harry's security cameras and desk things
(`catalog/objects-modern-desk.catalog.md`) in a `gadgets` slot: shelved under Dressing (library-index.js SLOT_ALIAS), but a slot of its own so neither engine's
generic dressing rolls them (the classic engine scattered every `dress` thing on the floor); the programs' hook lays them (cameras high on the walls, desk things on the desks). Kept apart from `rooms-modern.md` and `rooms-cyberpunk.md` so the rooms' own recipes are untouched.
Things: `catalog/objects-vehicles.catalog.md` (and the City and Cyberpunk catalogs' cars, motorbike and parked drone).

### veh-street P2
- vehicles: car-sedan, car-hatchback, car-police, suv-armoured, van-armoured, motorbike

### veh-alley P2
- vehicles: car-police, motorbike, car-hatchback

### veh-garage P2
- vehicles: car-sedan, car-hatchback, car-police, suv-armoured, van-armoured, motorbike
- gadgets: camera-security

### veh-warehouse P2
- vehicles: van-armoured, suv-armoured, forklift

### veh-lobby P2
- vehicles: drone-hexapod, drone-quad-heavy
- gadgets: camera-security, camera-dome, monitor-flat, keyboard, desk-phone, paper-stack, coffee-cup-paper

### veh-hideout P2
- vehicles: motorbike, van-armoured, car-hatchback, drone-rover-sentry
- gadgets: monitor-crt, donut-box, coffee-cup-paper

### veh-rigger P2
- vehicles: car-sedan, car-hatchback, motorbike, van-armoured, suv-armoured, drone-parked, drone-quad-light, drone-quad-heavy, drone-rover-arm, drone-rover-sentry, drone-hexapod
- gadgets: laptop-open, monitor-crt, keyboard, mouse-computer, coffee-cup-paper, donut, camera-security

### veh-safehouse P2
- vehicles: drone-quad-light, drone-rover-arm, drone-parked
- gadgets: laptop-open, monitor-crt, keyboard, mouse-computer, coffee-cup-paper, donut-box, paper-stack, camera-security

### veh-rooftop P2
- vehicles: helicopter, helicopter-gunship, drone-quad-light, drone-quad-heavy

### veh-office P2
- gadgets: laptop-open, monitor-crt, monitor-flat, keyboard, mouse-computer, coffee-cup-paper, desk-phone, paper-stack, donut, donut-box, camera-security, camera-dome

### veh-store P2
- gadgets: camera-security, camera-dome, coffee-cup-paper, donut-box

### veh-server P2
- gadgets: camera-security, laptop-open, monitor-crt, keyboard, mouse-computer, coffee-cup-paper, paper-stack
