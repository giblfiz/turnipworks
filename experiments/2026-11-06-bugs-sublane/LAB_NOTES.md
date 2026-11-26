# Bugs sub-lane, 2026-11-06

Five bugs from the bugs lane. Each one got a test that fails on the old code, then the fix. Local ports used were 23301 to 23316.

- **Seat location after a quick there-and-back.** Reproduced: `browser_travelback.py` gave 5 FAIL on the old code, with the stored location B after A → B → A and a reload landing on B. The cause: `setMain` compared the destination with `campaign.my.location`, which is the CONFIRMED location and lags a trip still in flight. Fix: `app.locate` also remembers the last area it asked for. Now 19/19; `browser_areas` 57/57.
- **"6 goblins" places the Goblin boss.** Reproduced: `figsearch.test.mjs` gave 17 FAIL on the old rule. Bugbear, cultist, ghoul and lizardfolk had the same bug. Fix: the name before the comma is the figure's own name (+36), and an SRD name it only lists gets +30. The search moved to `client/figsearch.js`, which has no three.js so node can load it. Now 47/47; `browser_bar_picks` 71/71 and `browser_barcat` 9/9.
- **The keys sheet says Settings ▸ Me.** Reproduced: `browser_keysettings.py` gave 2 FAIL ("Pawns snap to squares" is in Controls). Fixed the sheet and the Label lab line, and the stale comments with them. Now 12/12.
- **Deploy file modes.** Both scripts set the modes only at the end, so a deploy that stopped partway left files at 660. The fix is `tools/publish_tree.sh` (rsync `--chmod`). `tests/test_publish_tree.py` runs each script's own line on scratch folders: the old scripts fail 4 checks, the new ones pass 15/15. Nothing was deployed.
- **Dice wall W7 on dev.** Took Chrome's exact wording from a local server that answers the upgrade 404. `tunnel_noise.py` matches only `wss://…/ws` with a 404. `test_tunnel_noise.py` passes 14/14 (the old suite fails the SUITE check). Nothing was run against dev.

Seen on the way: the main checkout has a stray self-link, `engine/client/data/cursors/cursors -> …/engine/client/data/cursors`. The engine deploy has published it to dev. It loops if links are followed, so the deploy must never be given `--copy-links` or `--copy-unsafe-links`.
