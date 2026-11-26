# streetfix lane, 2026-11-07

Two bugs Harry hit on dev in the new modern / cyberpunk rooms.

## 1. Street crossings and pavements "glitchy" (z-fighting)
- 14:58 orient. Street = `modStreet` in solver2.js: pavement (floor-tile-pavement), centre line (road-strip) and zebra
  crossing (crosswalk-strip) are rows of flats laid by `modRow` -> `dunFlat`, which records y 0.02. Floor tiles
  (look.floorSpecs) are at y 0.02 too: coplanar. Confirmed in game (entity heights printed by shoot_street.py) and in a
  still. Same for the dungeon's chasm / sewer / rune tiles, the mine's rails, the garage's bay lines.
- Second cause found by the general test: `Ctx.record` rounds y to two decimals, so the small stacking steps the farm
  (0.002), lair (0.004), stall hay (0.006) and worn paths (0.0012) used collapsed onto one height. The solver's `soft`
  flag never reaches the game (assets.js specBase drops it): every placed flat is an opaque cut-out writing depth there.
- Fix 1 (general, solver): `Ctx.flatHeight` in solver.js, called from `record()` for every orient-floor placement on the
  ground: >= 0.03, and >= 0.01 clear of every overlapping flat already laid (later over earlier). Heights only:
  ydiff.mjs over 1872 rooms: 182 rooms with raised flats (1295 flats), nothing else changed.
- Fix 2 (render, for saved maps): look.js flatMat `over` = polygonOffset(-1, -4) on non-tile floor flats.
- Test: tools/spawn-tuner/test/flats.test.mjs, every room type x 3 sizes x 3 seeds: 1305 failures on adfd00a7, 0 after.
- Stills: shoot_street.py (`--tuner` picks the solver tree: oldtree = adfd00a7, hybrid = old solver + new look.js,
  "saved"). Blind Gemini reads: blind1 framing was wrong (spawnRoom takes cells; only the first room in view), redone
  as blind2.

## 2. Firefox: click an object, drag it, get "an image of the whole screen"
- Probe (probe_ghost.py): headless Firefox has no WebGL here; headed on a private Xvfb (:117) it draws.
- Plain click-then-drag: no dragstart. Triple-click, dblclick, marquee, Ctrl+A: Playwright's Firefox mouse makes no
  text selection, so they leave nothing. A drag from a launcher <img>: native dragstart (detector works).
- With a page selection that contains the canvas (selectAllChildren(body)): select-then-drag fires `dragstart` on #c
  and the object does not move. That is the ghost: Firefox drags the selection from the canvas, its picture is the
  full-window canvas. A click collapses the selection: "sometimes it goes away".
- Fix: input.js: canvas pointerdown (capture) drops a non-collapsed page selection; document dragstart (capture)
  cancels a drag from the canvas, from an <img> not marked draggable, or carrying the canvas; inputs, textareas,
  links, draggable="true" kept. style.css #c user-select none.
- Test: engine/test/browser_ghostdrag.py (Firefox, own Xvfb): 6/12 fail on old code, 12/12 after; the command bar text
  drag still fires a native drag that is not cancelled.
- Note: the press-at-the-same-spot-cycles-the-stack rule (input.js `lastClick`) makes a click then a drag from the very
  same pixel grab the next thing down the stack, not the selected one. Not changed; worth knowing for anyone writing a
  click-then-drag test (press 6 px off the click).
