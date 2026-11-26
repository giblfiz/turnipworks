# Brief: the "Genres" icon (Turnip Works Build tray), 2026-11-12

You are an image worker. Use your BUILT-IN image generation tool (never an API key, never code that draws shapes).

## What it is
The Build tray of a tabletop-RPG map maker lists GENRES (Fantasy, Modern, Cultures). It needs ONE permanent icon that means
"all the genres at once": a small DRAGON together with a small SPACESHIP in one little vignette.
- ORIGINAL ART ONLY: a generic dragon and a generic spaceship. Nothing that resembles any known franchise, film, game or
  toy (no recognisable starship or fighter designs, no famous dragons). No text, letters, logos, emblems.

## Style (must match the existing icon family exactly)
`ref/anchor-type-TAV.png` is the style anchor of the set (raw, on chroma green). `ref/genre-fantasy.png`, `ref/genre-modern.png`,
`ref/genre-cultures.png` are three finished sibling icons (keyed transparent, 128 px). Match their rendering, lighting,
palette, level of detail, camera angle and scale:
bold, simple, chunky silhouette that reads at 48 pixels; a small three-quarter vignette seen from slightly above; flat-shaded
with soft matte gradients, quiet and modern (no outlines, no comic inking, no gloss, no photorealism); minimal detail; a
restrained palette (warm honey wood, blue-gray stone, moss green, ochre, cream, a touch of muted burgundy; the dragon may be
muted burgundy/ochre, the ship cream and blue-grey). Exactly one vignette, centred, filling about 80% of the frame, clear space
around every edge. No frame, no badge shape, no border, no drop shadow, no floor plane.
Background: perfectly uniform solid chroma GREEN (#00FF00) edge to edge; the subject must contain no bright green and must
not reflect green light.

## Shot list (three options, each a different composition; save in ./raw/)
1. `raw/genres-a.png`: a small chunky dragon perched and curled on top of a small rounded retro rocket-ship standing upright on its fins.
2. `raw/genres-b.png`: a small dragon and a small sleek spaceship side by side, facing each other, the dragon's wings half-open, the ship's nose toward it.
3. `raw/genres-c.png`: a small dragon in flight circling a small round flying-saucer-style spaceship, the two overlapping as one compact cluster.

## Checklist (look at each result yourself; retry up to 2 times if it fails)
- one compact subject, both dragon and ship clearly readable when shrunk to 48 px
- matches the siblings' style (compare side by side); no outlines/ink, no gloss
- uniform chroma green background, no green in the subject
- nothing franchise-like, no text
Log each attempt (file, verdict, one line why) to ./LOG.md. ONE request at a time. If you hit a usage/rate limit, write the
exact text to QUOTA_STOP.txt and stop.
