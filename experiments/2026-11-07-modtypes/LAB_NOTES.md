# modtypes lane, 2026-11-07: Modern's Build types become buildings

Harry: "under modern I think 'types' is split at the wrong level... types should be kinds of *building* not kinds of
sub-genre (look at how fantasy got done)". Addendum, same day: "I also think we basically don't need to distinguish
between cyberpunk and modern now" (Build menu, assets page, pawn menu; keep the words as search words).

## What existed
- Build menu genre → type → room: types = catalog setting codes (catalog/out/by-setting), rooms joined at runtime by
  recipe prefix (`mod-…` → MOD "City", `cyb-…` → CYB "Cyberpunk"). 8 + 10 rooms.
- Persisted: maps store room keys (unchanged here); a generated building stores `gen.code` (MOD / CYB for modern ones);
  the Build tray's last path is in localStorage (`t:MOD` ids: filtered out on load, falls back to the genre); the
  assets page and its "Use it in Turnip Works" links carry pack slugs / codes (`?pack=cyberpunk/cyb-clinic`).

## Built
- `engine/tools/modern_buildings.json`: buildings (code, label, slug, hub), and per room the buildings it is in
  (one line per room). `replaces` MOD, CYB; `legacy` MOD/CYB → OFC; `pack` the assets page's one Modern pack.
- `build_types.py` drops MOD/CYB as types, emits the buildings with `rooms`, `hub`, and the MOD∪CYB roles their rooms
  name (slots, floors, library-spawns) plus the pool roles no modern room names; warns on an unmapped modern room.
- `taxonomy.js` joins a type's own `rooms` list when present; `main.js` resolves legacy codes and makes the `hub` the
  derived programme's hub (`rolesOf`); `deeplink.js` resolves a one-pack genre and the old slugs; the assets page folds
  the genre into one pack; the tuner palette groups by the buildings; barwords put the genre words on every building.
- Pawn menu (sub-agent): one Modern root, Runners ▸ 9 archetypes, Law and security, Corporate, Streets, Robots.

## Dead ends / findings
- A Street type (street, alley) cannot be generated: `programmeFor` with no indoor room gives a plan of one room with
  no type. So no Street type; the street and alley sit in Storefronts / Bar & nightclub / Hideout (as MKT holds its street).
- Without a hub override the Apartment block was built round the capsule hotel (largest room); `hub` in the map fixes it.
- `legacy` test first failed only because the hand-picked rect (-40,-40) overlapped; using `freeGroundFor` it passes.

## Icons
Six type tiles via the sprawl lane's free route (`codex exec` image tool, icons/gen.py, anchor type-TAV), post.py →
128 px. Raw plates on USB `/mnt/usb/turnip-works/lanes-2026-11-07/modtypes/icons/raw/`.

## Results (logs: /mnt/usb/turnip-works/lanes-2026-11-07/modtypes/logs/)
- node: modern_buildings 80/80 (fails on adfd00a7: 19 FAIL), assets_page 21/21, pawntree 77/77, pawntree_genres 47/47,
  figsearch 73/73, library-index 35/35, buildings, building-debt 15/15, hillbuild 63/63, mod 95058 checks / 0, cyb 58176 / 0.
- browser: cyberpunk 28/28 (new BUILDINGS segment 18/18), fpv 81/81, palette_ui 35/35, build 98/99 and barcat 8/9:
  both failures identical on adfd00a7 (build: "library labels never collide", aspect 0.86; barcat: the "bar" must line).
  A first browser_build run crashed (no fresh frame in 15 s) with three suites + Codex running at once; alone it ran clean.
- Gemini blind read (gemini-read.txt on USB): tray labels and letters as built, every tile pictured and plausible, nothing
  clipped, no horizontal scrollbar; the six icons one family, no text.
