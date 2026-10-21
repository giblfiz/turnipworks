# Loading: what happens between the link and the table, and the loading screen (2026-10-07)

Asked (Harry): "a simple but a high impact thing. I think we need a loading screen. Nothing crazy, take lessons from the
mapgarden loading screen." What was built is in docs/UI.md, "The loading screen". This folder is the measuring: before
the work, after it, and the scripts.

**Every number here is the build box** (RTX 3060, i5-10400F; Chromium headless on Vulkan; Firefox in a window on Xvfb with
software drawing, which is several times slower than a real Firefox at anything 3D). None is Harry's Mac. "Local" is a
relay and static server on this box (no network delay; three.js still comes from the CDN); "live" is
https://turnipworks.net/ through Cloudflare from this box. Each load is a cold browser context. Times are milliseconds
from navigation, medians of 2 or 3 loads; the spread between loads is large on live (first frame 1.6 to 2.3 s in one
set, 1.4 to 8.0 s in another, the long one a cold cache at Cloudflare).

Maps: `5 rooms` is one inn (475 things to draw), `52 rooms` is the megamap town's first seven buildings (4,340 things),
both under the opening camera.

## Before (main at fa389e7)

| | code running | look fetched, renderer made | connected | first real frame | view's meshes in | page frozen just before the first frame | freezes after it, until all in |
|--|--:|--:|--:|--:|--:|--:|--|
| Chromium, local, 5 rooms | 127 | 312 | 328 | **572** | 1,488 | 244 | 6, longest 258 |
| Chromium, local, 52 rooms | 131 | 306 | about 370 | **905** | 4,144 | 591 | 10, longest 722 |
| Chromium, live, 5 rooms | 350 to 365 | 930 to 980 | 1,400 | **1,730 to 1,950** | 5,700 to 7,300 | 290 to 440 | 3 or 4, longest 146 |
| Firefox, local, 5 rooms | 251 | 1,488 | (in the freeze) | **3,466** (1,285 and 5,646) | 4,176 | 3,179 | 2, longest 114 |
| Firefox, local, 52 rooms | 244 | 501 | 1,940 | **2,524** (1,696 and 3,351) | 28,462 | 2,857 | 15, 38 s in all, longest 24 s |
| Firefox, live, 5 rooms | 3,050 (441 and far more) | 4,236 | 4,696 | **5,454** (2,408 and 8,500) | 12,168 | 657 | 12, 6.4 s in all, longest 1.2 s |

- "The state arrived" is not a column because nothing can observe it apart from the first frame: the state's message is
  handled, the room is set out and the first frame is drawn in one unbroken stretch of the main thread (the "frozen"
  column). The loading screen's own console line now separates them from inside (`state 6 ms, room set out and first
  frame 231 ms`).
- A second, shorter freeze sits between "look fetched" and "connected" (the renderer and the lists are made: 320 ms in
  Chromium locally).
- The live site falls back from WebSocket to SSE on every load (the socket's handshake gets a 404 through the proxy):
  about 0.45 s between "look fetched" and "connected".
- 250 requests and 45 to 57 MB arrive by "all in", almost all of it meshes after the first frame; the code is 111
  script files.

**What a person saw, before** (screenshots through the load, `timeline.py --film`; Gemini's blind read of five of them):
- From the first paint to the first frame: a near-black empty page (mean brightness 24 of 255, every pixel under 30).
  Gemini: "A solid dark screen is a common sign that a page has failed to load."
- In a light-scheme browser, from the moment the code ran: the page flips to cream with the command bar and a grey bar
  drawn over nothing. Gemini: "broken or, at best, severely incomplete."
- From the first frame: the table, its things as translucent grey boxes that are swapped for meshes as they arrive
  (0.9 s more for 5 rooms locally, 4 to 6 s on live, 26 s for 52 rooms in Firefox here, frozen for most of it). No
  spawn animation on a first load.

**The three other waits, before** (local):

| | Chromium | Firefox | what was on screen |
|--|--|--|--|
| Start a campaign (click to first frame) | 493 ms | 2,256 ms | the form, then the page reloads: near-black, then the table |
| Travel to an area not loaded (15 rooms): state, first frame, all in | 260, 304, 402 ms | 229, 2,848, 2,848 ms (frozen 1.9 s) | the interface over an empty dark rectangle |
| Travel back (the area's world is kept) | 187, 238 ms | 33, 1,705 ms | the same |
| The relay restarts (down 2.2 s / 3.3 s) | live again 3.5 s after it stopped | 4.7 s | the table, still; "offline (sse)" in 11 px grey in the corner |

## After (the loading screen; live client v=20261007123814)

**First real frame, before and after in turn in one run** (`ab.py`: the same campaign on one relay, the old client from the
main checkout and the new one, alternating, 8 cold loads each in Chromium):

| | before, median (range) | after, median (range) |
|--|--:|--:|
| Chromium, one inn | 560 ms (547 to 814) | 550 ms (542 to 573) |
| Chromium, 52 rooms | 956 ms (902 to 978) | 958 ms (934 to 1,008) |
| Firefox, one inn (4 loads each) | 1,195 ms (1,171 to 1,233) | 1,180 ms (1,178 to 1,197) |
| Firefox, 52 rooms (4 loads each) | 1,736 ms (1,716 to 1,902) | 1,778 ms (1,737 to 1,790) |

The screen costs nothing that can be measured in Chromium: the differences are inside the spread of either side. In
Firefox (software drawing) the ranges overlap too; the 52-room medians differ by 42 ms (2%) on four loads each, which
may be the screen's first paint and may be chance.

| | first paint, before → after | what it is | first real frame, after |
|--|--|--|--:|
| Chromium, local | 128 to 140 → **28 to 32** | the loading screen (it was an empty dark page) | 571 and 945 (5 and 52 rooms) |
| Chromium, live | 364 to 636 → **136** | the same | 1,415 (1,368 to 1,976); it was 1,730 to 1,950 in two sets of three, which is the spread of the network, not a gain |
| Firefox, local | 449 to 1,432 → **55 to 78** | the same | 1,241 and 2,138 (it was 1,285 to 5,646 and 1,696 to 3,351) |
| Firefox, live | 441 to 4,184 → **170** | the same | 2,192 (1,991 and 2,392); it was 2,408 and 8,500 |

**What a person sees now:** the house colour with the mark, the name, the bar and "Fetching the game" from the first
paint; the words change to "Opening your table" and "Setting out the room"; the bar is in the 70s when the page freezes
for the last stretch; the screen fades (0.2 s) with the first real frame. Mean brightness through a whole load never
under 62 of 255 (it was 24), and no screenshot more than 0% near-black. After the screen leaves, the room fills in as
before (grey stand-ins swapped for meshes).

**The other waits, after** (Chromium, local):
- Start a campaign: click to first frame **392 ms** (493 before), in the same page; the form gives way to the loading
  screen at once.
- Travel to an area not loaded yet: the same times; nothing is shown when the area arrives within 0.35 s (it does
  here), otherwise the full screen "Travelling to <name>" until the area's first frame.
- The relay restarting: the pill "The table is reconnecting…" from 0.5 s after the connection drops until it is back
  (3.5 to 5 s here for a restart).

## What a test could and could not verify about motion while the page is frozen
- **Chromium, verified:** a 2.5 s busy loop on the main thread, the page watched through the screencast (compositor
  frames): 22 pictures, the bar's drawn length grew in every one (from 8% of the track upward, about 0.9 points a
  picture), the mark's pixels differed between every consecutive pair.
- **Firefox, not verified by a test:** under the driver neither a screenshot nor any other picture can be had while the
  main thread is blocked. What the test does show there: the bar and the mark are each one running Web Animation on
  `transform`, and after the block the bar is where the plan says. The evidence that Firefox keeps a `transform`
  animation moving through a blocked main thread is the hand measurement of 2026-09-24 on Harry's Mac.
- **Neither:** a stall of the browser's graphics process (first shader compile). No test produces one; Map Garden's
  loader froze through one on Harry's Mac. The screen's answer is where the bar is when it happens, not motion.

## What would actually make loading faster, ranked (found while measuring; none of it done here)
1. **The meshes, by a wide margin.** The first frame is at 1.4 to 2 s on live, but the room looks right at 5 to 7 s
   (26 to 37 s for 52 rooms in Firefox here, most of it frozen): 250 requests and 45 to 57 MB for ONE inn. The shipping
   tier Harry already chose (about 5k faces, one 256 px map), texture atlases and KTX2 would cut that several-fold; so
   would asking for what the camera sees first, with the cloning budgeted per frame (FIXES.md's "Loading" item).
2. **Connect while the code loads.** The seat token is in the link, but the relay is first asked after everything has
   been fetched and the renderer made. On live "connected" comes 0.45 s after that (0.7 s to 2.9 s in other loads the
   same hour) and the state 0.1 to 0.5 s later:
   0.7 to 0.9 s of the 1.4 to 2 s to the first frame is waiting for answers that could already be in hand. Medium.
3. **Do not try WebSocket where it is known to fail.** Every live load pays for a WebSocket handshake that gets a 404
   before falling back to SSE. Remember the fallback per site in the browser (small), or the Cloudflare Tunnel (waiting
   on a token). Perhaps 0.15 to 0.3 s.
4. **Preload the look.** The tuner's eleven modules and three lists are found one after another (`version.json`, then
   the imports, then theirs): 0.4 to 0.6 s on live between "code running" and "look fetched". `modulepreload` links
   stamped at deploy, or the version fetched from the page, would overlap that with the client's own code.
5. **The freeze before the first frame** (0.25 to 0.6 s in Chromium, 0.7 to 3 s in Firefox on software drawing): every
   thing of the area is made in one go and the first frame compiles every shader. Set out what the opening camera sees,
   then the rest over the next frames (far rooms already sleep); compile shaders in the background
   (`compileAsync`). Medium to large; it is also what makes a 200-room map take 20 s to its first picture.
6. **three.js from the same site.** It comes from jsdelivr: a second connection on a cold visit, and a third party in
   the path of an open-source game. Small.
Not speed but the same moment: playing the spawn animation for the rooms in view on a first load would make the grey
boxes the opening shot instead of an unfinished one.

## Old suites that load the game, before and after (Chromium on the GPU, one run each, a quiet box)

| suite | before: checks passed, seconds | after |
|--|--|--|
| browser_ui | 87, 63 s | 87, 66 s (one check now samples for 2 s: below) |
| browser_nits | 72, 92 s | 72, 92 s |
| browser_build | 89, 87 s | 89, 86 s |
| browser_figs | 192, 313 s | 192, 314 s |
| browser_pawnsmenu | 160, 90 s | 160, 90 s |
| browser_two_tab | 28, 18 s | 28, 18 s |
| browser_areas | 57, 41 s | 57, 40 s |
| browser_turns | 54, 28 s | 54, 28 s |

- **One old check became flakier and was fixed in the test:** browser_ui's "a selected room's brackets can be seen from
  the angled view" took one sample of something that breathes at 0.4 Hz; with no page reload on starting a campaign the
  sample fell at another point of the breath (5 failures in 8 runs, against 1 in 11 before). It now takes the best of
  one breath; 5 of 5.
- **One old flake is unchanged:** browser_two_tab's M5 fails three checks together when its click lands on the wrong
  pawn: 3 runs in 10 on the old code, 2 in 8 on the new.
- The new suite: `engine/test/browser_loading.py`, 59 checks in Chromium (65 s), 56 in Firefox (93 s; three more cannot
  be had from the driver there and are printed as NOT VERIFIED); against live 42 and 41.

## Files
- `stack.py` the local relay and site, campaigns built through the relay's GET door, the page probe.
- `timeline.py` first load (`--film` for screenshots through it, `--waits` for the three other waits, `--live`).
- `ab.py` first real frame, old and new client in turn. `stills.py` pictures for a blind read. `run_suites.sh` the old suites.
- `results/timeline.jsonl`, `results/ab.jsonl`, the logs. Screenshots are not kept (`results/shots/` is ignored).

## Gemini, blind (gemini-2.5-pro; neutral file names, no context)
- The loading screen at three moments, on a phone, in a light-scheme browser, Chromium: "a loading screen for a web
  application or game called 'Turnip Works'"; "'Fetching the game' ... the first stage of loading"; "'Opening your
  table' ... preparing the user's specific session"; "'Setting out the room' ... loading the specific environment";
  "The design is minimalist and clean. All elements are centrally aligned, the text is legible"; the phone: "the
  responsive design works well". Its verdict: "plain: simple, clean, and functional but not visually elaborate".
- The mark, as drawn on the screen: "a cartoon-style turnip as the central object, with a purple top, a white body, and
  green leaves ... Behind the turnip, two golden-yellow wrenches are crossed in an 'X' formation." Alone, at five sizes:
  "a direct parody or homage to the Jolly Roger (skull and crossbones)".
- Beside the game: "these two screenshots almost certainly belong to the same product"; a cross-fade "would feel very
  natural and smooth ... The dark background color provides a stable visual anchor"; "the yellow from the progress bar
  would visually connect to the yellow accents appearing in the main UI".
- The same in Firefox: the three lines read exactly; "nothing is cut off or distorted in either the desktop or mobile
  views"; "The progress bar is a simple, sharp-cornered rectangle ... could be seen as slightly unfinished". Just after
  the screen leaves: "the basic geometry or 'blockout' of the map"; half a minute later "the fully rendered and
  populated scene"; neither "blank, black, or broken".
- The failures: "It effectively communicates the problem and offers a clear next step" (the dead link); the relay
  sentence was read out whole. First read of the reconnecting pill (then under the command bar): it "slightly overlaps
  the search bar" and ran into the area's purple button; it was moved low in the middle, and the second read: "not
  obscuring any critical map features or UI controls".
- **Before**, for comparison: "A solid dark screen is a common sign that a page has failed to load."
