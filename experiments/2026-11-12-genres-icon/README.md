# The "Genres" icon (2026-11-12)

The permanent icon of the Build tray's "Genres" chip (the breadcrumb rule, docs/UI.md): all the genres at once, a dragon
and a spaceship. Made by a Codex worker with its built-in image tool (BRIEF.md, LOG.md; the style anchor and siblings in
ref/), keyed by post.py (the sprawl icons' key) to icons/, 128 px RGBA.

| option | file | blind Gemini read (32/48 px sheet, letters shuffled; blind-key.txt) |
|---|---|---|
| **c, SHIPPED** | icons/genres-c.png -> engine/client/data/icons/genres-all.png | dragon with spread wings perched on a round flying saucer; both legible at 32 px; style 9/10; no specific franchise |
| a | icons/genres-a.png | dragon on the nose of an upright finned rocket; dragon a "red knob" at 32 px; style 6/10; the reader said the rocket recalls the classic Tintin moon rocket |
| b | icons/genres-b.png | dragon and a fighter-style ship side by side; unreadable at 32 px; style 4/10; the reader said the ship recalls well-known film starfighters |

To swap: copy icons/genres-a.png or -b.png over engine/client/data/icons/genres-all.png (a and b carry the franchise
flags above: Harry asked for nothing resembling a known franchise, so look before swapping).
