#!/usr/bin/env python3
"""Put the Farmstead's entries into docs/STATUS.md and docs/ASSETS_TO_BUILD.md of the tree it is run in (cwd = repo root). Idempotent."""
import pathlib
STATUS = '''- **Farmstead type (2026-10-11/12, landed 2026-10-12):** sixteen rooms: cottage (one room: the most used), farmhouse kitchen, bedroom, sleeping loft, cross-passage, root cellar, byre, chicken coop, hay barn, granary & threshing floor, dairy; outdoors: pigsty, vegetable garden, field edge, orchard corner, farmyard. Build → Fantasy → Farmstead (code `HUT`). Walls: the new `wattle-daub` family, with half-timber, rough timber and fieldstone, rolled per room; every farm room is thatched in the game whatever its walls (`ROOF_BY_TYPE`). Poor by default: the cottage and the loft are `wealth: poor` (fire on the floor, straw pallet); `room.wealth` overrides. First laid out from the library as it stood, then the `hut-01` batch: 19 meshes shipped of 22 (16 signature pieces: nest boxes, butter churn, cheese press, milk pails, pigsty, stooks, scarecrow, plough, dovecote, bee skeps, bean poles, sand box of roots, loft hatch, roost, egg basket, winnowing basket; 3 wall pieces), 3 withdrawn (haystack: a yellow pot from above; grain heap: an orange still; the window: its wooden bars made a jail); 16 painted room icons and the ploughed-field ground. RunPod $1.48, pod deleted and verified. Animals are FIGURES, never props: byre, sty and coop are dressed empty. The building generator has a farmhouse programme (`BUILDING_TYPES.HUT`: kitchen hub, one storey + loft, cellar under, barn or byre across the yard; 720 of 720 plans keep every rule). Rules, graph roles and adjacencies: `tools/spawn-tuner/ROOMS.md` → Farmstead. Blind reads: `experiments/2026-10-11-types/hut/ROOM_READS.md` (10 of 16 named on 3 reads of 4 or better; NOT named: granary, dairy; the loft reads as a dormitory, the field as a garden plot). Bench list: `experiments/2026-10-11-types/hut/BENCH.md` (nothing new needs an anchor). Still wanted: `docs/ASSETS_TO_BUILD.md` → Farmstead.
  - **For Harry to look at first:** the wattle-daub wall (it meshed darker and browner than its plate); the cottage with its fire on the floor; whether the dairy and the granary are worth keeping as rooms before their signature meshes are re-made.
  - **Open:** other types could take the farm's meshes by listing tier `hut` (the mansion's garden asks for a bee skep and a dovecote); a `wealth` dial in the room panel does not exist (the option is read by the solver only).
'''
ASSETS = '''## Farmstead

### What shipped (2026-10-12, library sources `hut-01` and `hut-flats-01`)
19 meshes ($1.48 RunPod, one A100 session; 22 plated, 3 withdrawn) and one seamless ground plus 16 painted room icons: `experiments/2026-10-11-types/hut/` (`README.md`, `ROOM_READS.md`, `BENCH.md`, `build_spec.py`, `flats/`). The `wattle-daub` wall kit (two plain panels, a doorway); for the coop `nest-box-row`, `chicken-perch-ladder`, `egg-basket`; for the dairy `butter-churn`, `cheese-press`, `rural-milk-churn-tall`; `pigsty` (the sty with its own walled mud yard); for field, garden and yard `rural-grain-stook`, `scarecrow-post`, `plough`, `dovecote`, `beehive-skep`, `bean-poles-wigwam`; `root-sand-box` (cellar), `winnowing-basket` (granary), `loft-ladder-head` (loft); the ground `floor-field-furrows` (laid straight: the furrows run on from tile to tile). Every farm mesh but the wall kit is sku tier `hut`.

### Still to build (Farmstead)
- **Re-plate the three withdrawn pieces** (plates and first meshes are kept in the batch folder, `models-rejected/`): `haystack-field` (asked for "one smooth solid surface" and got a yellow pot under a leather lid: ask for broad shaggy layers of hay); `rural-grain-heap-threshed` (an orange cone with the shovel's handle as a knob: the granary read as a brewery; ask for pale wheat-gold, a slumped irregular heap, the shovel lying beside it); `wall-window-small--wattle-daub` (three wooden bars = a jail window from above: an unbarred opening, one plank shutter half open).
- **What would name the two rooms that are not named.** The dairy ("a pantry", "a potter's workshop"): the cheeses on shelves are bowls from above; it wants `trade-cheese-vat` (a big round vat of white curd), `trade-curds-draining` (white cloth bags hung over a tub) and a row of `rural-milk-churn-tall` singles; milk is what reads. The granary ("a farm work shed"): the grain heap above, `rural-chaff-pile`, a flail pair, grain bins with their lids off showing gold, `staddle-stones` outside.
- **A grain crop.** The field's crop is the garden's cabbage patch laid edge to edge, so the field reads as a garden plot: `crop-field-tile` as a 5-ft block of standing wheat (painted as one solid golden mass) and its cut-stubble twin.
- **Signature pieces another batch is making, to use when they land:** `spinning-wheel`, `cradle` (the cottage and the bedroom place them when the library has them).
- **Not made, still in the recipes' `wants`:** `truckle-bed`, `apple-rack-slatted`, `cellar-steps-earth`, `rural-stool-milking`, `cowbell`, `craft-yoke-ox`, `rural-chicken-feeder`, `rural-pig-sty-trough`, `rural-mud-wallow`, `rural-harrow`, `quern-hand`, `cold-frame`, `stile`, `rural-apple-ladder` (12 ft and thin: needs a stout design), `windfall-apples-scatter` (a flat), `mounting-stone`, `pot-hook-tripod`, `bread-trough-kneading`.
- **A cowshed that is not a stable.** The byre is the stable's stalls without the tack and reads as a stable half the time and a bunkhouse the rest: low tie-stalls with a dung channel and a hay rack would be a mesh set of its own.
- **A loft that reads as a loft** needs the roof: rafters or a sloped-ceiling cue that the cutaway keeps (today: "a dormitory").
- **Wealth as a dial.** `room.wealth` is read by the farm programs; nothing in the tuner's room panel or the game sets it yet.

'''
p = pathlib.Path('docs/STATUS.md'); s = p.read_text()
if 'Farmstead type (2026-10-11/12' not in s:
    a = '- **Dungeon & prison type (2026-10-11, landed 2026-10-12):**'
    if a in s: i = s.index(a); j = s.index('\n- **', i + 10) if '\n- **' in s[i + 10:] else len(s); j = s.index('\n', i); 
    # insert after the whole Dungeon entry (it may have indented sub-lines): the next line that starts a new top-level bullet or heading
    lines = s.split('\n'); k = next(n for n, l in enumerate(lines) if l.startswith(a)); m = k + 1
    while m < len(lines) and (lines[m].startswith('  ') or lines[m] == ''): m += 1
    while lines[m - 1] == '': m -= 1
    lines[m:m] = STATUS.rstrip('\n').split('\n'); p.write_text('\n'.join(lines)); print('STATUS.md: Farmstead entry')
p = pathlib.Path('docs/ASSETS_TO_BUILD.md'); s = p.read_text()
if '## Farmstead' not in s:
    a = '## Vertical kit'; assert s.count(a) == 1; p.write_text(s.replace(a, ASSETS + a)); print('ASSETS_TO_BUILD.md: Farmstead section')
