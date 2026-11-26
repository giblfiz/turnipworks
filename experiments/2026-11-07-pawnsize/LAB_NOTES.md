# Pawn Size as the resize track (lane `pawnsize`, 2026-11-07)

Harry: "the 'size' options on pawns should just use the same design language as the object resize (same image, and drag in&out on track)".

## What was there
- 2026-11-06 pawn sizes (docs/PAWNS.md "A pawn's size"): ☰ ▸ Size, a ▸ sub-menu ring of seven buttons (Bigger, Smaller, Tiny, Medium, Large, Huge, Gargantuan), plus the bar and GET. Size is a category: `size` 0.5 or a whole number 1 to 8 squares (the relay refuses anything else).
- A prop's Resize (`edit.resize`, closed-ring slot): a drag button, icon `scaling`, track = `makeTrack` along the handle's ray, continuous k with soft stops 0.2x..5x, 100% at the grab point, Shift = 25% steps.

## What I built
- `pawn.resize` (commands.js): menu, `ringOnly`, `ring: { drag: 'size' }`, same `when` as the list (owner or GM). In menu.js MENU right after the Size list, both on key `i`; `RING_CUT` gets `pawn.size.` (list off the ring), and `menuFor`/`chordOf` keep `ringOnly` commands out of the chord tree, so the keyboard still has Space ▸ i ▸ the list.
- ring.js: `PAINT_AS['pawn.resize'] = 'edit.resize'` (same painted picture). In `startDrag`, kind `size` on a token builds the track with values = index into `SIZE_STEPS` (0.5,1,2,3,4,5..8), evenly spaced: pitch = clamp(22..56 px, room inward (d0-14)/i0, room outward to gargantuan (reach-d0)/(5-i0)). Marks named tiny..gargantuan, ticks for every step. The move snaps to the nearest stop, previews every selected pawn with `localDrags.scale = to/size`; release calls `app.setSize(sel, to)` (unchanged command path).
- Snap vs continuous: a taste call, built SNAPPING (sizes are categories the relay checks; a continuous drag would have to round anyway). Even spacing rather than linear-in-squares, because linear puts gargantuan at 4x the grab distance for a medium pawn and 8x for a tiny one (off screen); for sizes >= 1 linear is evenly spaced anyway, so the only visible difference is that tiny is a full step in, not half.

## Dead ends / surprises
- The test's first drags never started: the ☰ row was above the top of the viewport (world-sized ring, by design) and under the command bar's textarea. The test now backs the camera off (focus at 85% of the figure's height) until the button is on screen and is the element at its centre.
- browser_pawnring.py (exact ☰ list) and browser_rooms.py (exact ☰ per kind) still listed the 11-06 state imperfectly: pawnring did not have `▸pawn.size.` at all (fails on main), rooms had it. Both now expect `pawn.resize`.

## Stills (USB: /mnt/usb/turnip-works/lanes-2026-11-07/pawnsize/)
`stills.py ROOT TAG OUT` runs on any checkout: before-* from a detached worktree at adfd00a7, after-* from this branch. Blind Gemini read: `gemini-read.txt` there (names in `blind-map.txt`).

## Blind reads (Gemini, agy-run, isolated folders; map in blind-map.txt on the USB)
- Read 1: the after ☰ shows "the exact same icon used for furniture resize"; the after drag read as stepped sizes, but its far end was under the top bar and the Hide pill (the stills camera put the ring high).
- Read 2 (reframed): "the figure would become Large … the chip readout reading large · 10 ft"; it called the two tracks related but not the same (stepped categories vs a continuous 100%-based scale: that is the intended difference), and found "gargantuan" cut by the Hide pill. Fix: the pawn track's far end now stops below the bar / area pills / crumbs (`underBar`). Props' track unchanged (same clipping exists there: an open item).
- Read 3 (after the HUD fix): every label read in order, tiny · medium · large · 10 ft · huge · gargantuan, handle on large, "None" obstructed. Asked which is quicker for picking "huge", it chose the OLD list (one click on 'HU') over the drag ("greater motor precision"). Worth telling Harry: the drag trades one-click choice for the shared gesture he asked for; the keyboard and bar keep the one-step routes.
