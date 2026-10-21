# The first common room behind the loading bar (2026-10-11 and 12)

Asked (Harry): "Let's add the stuff needed to load that first common room into the loading that happens on the
pre-loading loading bar. We want that first demo moment to pop instantly." What was built is in docs/UI.md, "The
loading screen" → "It leaves when the opening view is whole". This folder is the measuring.

**Every number is the build box** (Chromium headless on the RTX 3060), none is Harry's Mac. Each load is a cold browser
context; times are milliseconds from navigation, medians of 3. `measure.py` is the script (`--live`, `--net`).

Two cases:
- **new**: an empty new campaign; the intro plays and its phantom builds the first Common room (about 98 pieces,
  100 to 115 files).
- **join**: a campaign with one inn (5 rooms, 466 pieces under the opening camera, 350 files, 37 to 78 MB as counted
  by the browser), no intro.

## The live site (https://turnipworks.net/), 2026-10-12, load average 5 to 9

| | before (client v=20261011202749) | after (v=20261012144553) |
|--|--:|--:|
| **new**: first real frame | 4,272 | 6,279 |
| new: loading screen gone | 4,273 | 7,917 (it waited 1,575 to 2,046 ms for the room's pieces) |
| new: the phantom lets go, and the room waits unseen for its meshes | **3,902 ms** (1,863 and 2,615 in two sets the day before) | **0 ms** (spawn waited 3 to 36 ms in every run) |
| **join**: first real frame | 4,884 | 5,696 |
| join: loading screen gone | 4,888 | 13,223 (it waited 7,532 to 10,586 ms) |
| join: grey stand-ins in view when it left | **388** | **0** |
| join: the view whole | 9,412 (4.5 s of stand-ins; 10 s in a set under load the day before) | 13,207 (the same moment the screen leaves) |

- The first real frame differs between the two columns by more than the change can explain (nothing before the first
  frame was changed): the after column was taken minutes after a deploy, with Cloudflare's copy of the code cold, and
  the live site's spread between loads is seconds (11.3, 13.2 and 21.6 s to "gone" in the three join loads). **Compare
  the waits, not the totals.**
- The join wait (7.5 to 10.6 s) is longer than the 4.5 s the same pieces took to fill in before, in this one pair of
  sets. I do not know why (inference: the network that hour; the same pieces are fetched by the same code).

## A slow line (local relay and site, the browser held to 20 Mbit/s and 40 ms a request), load average 7 to 9

| | before (main) | after |
|--|--:|--:|
| new: loading screen gone | 3,457 | 12,344 (waited 8.7 to 8.9 s) |
| new: the room waits unseen for its meshes | **20,001 ms** (the spawn's own limit: it then plays with stand-ins) | **0 ms** |
| join: loading screen gone | 3,760 | 8,872 (gave up at 5.0 s: 29 of 351 files were in) |
| join: stand-ins in view when it left | 388 | 388 |
| join: the view whole | 34,399 | 34,351 |

- 78 MB at 20 Mbit/s is half a minute: no loading screen should wait that out, so from 5 s on it leaves when the files
  are arriving at under half the pace that would finish by the 15 s cap. The pace is counted in FILES (pieces finish
  in lumps: a piece's texture is only asked for when its geometry has arrived, so over HTTP/1's six connections every
  texture queues behind every mesh and all the pieces finish together at the end).
- The count of files comes from the look's own `assetUrls` for each piece, so it follows whatever the loader fetches;
  it was 99 to 114 expected against 101 to 116 arrived for the room, 350 against 345 to 361 for the inn.

## What a person sees
- New table: the loading screen a second or two longer (the bar moving with the files), the empty table, the intro's
  one ghost cursor walking the Build menu, and the room's spawn starting the instant it lets go.
- Joining: the loading screen until the room is finished; no grey boxes.

## Tests
`engine/test/browser_loading.py`: 66 checks locally (59 before), 49 on live. B4 (no stand-in in view when the screen
leaves), B6 (few plans for the bar), section J (the room is the very room that was fetched: same layout hash, no asset
request after it arrives, spawn starts within 0.4 s; the phantom's world cursor is not drawn on the intro's own screen
and is on another; the give-up).

## Not done
- Fetching a piece's texture alongside its geometry (the tuner's `ladderVisual`): pieces would finish as they come.
- The same wait for travelling to another area.
- The size itself: 37 to 78 MB for one inn. That is the asset-format work.
