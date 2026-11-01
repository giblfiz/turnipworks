# Connect D&D Beyond: the help page, its film, the Settings entry (Harry 2026-10-29)

Harry asked for a clean, human-facing help page, "Connect D&D Beyond", with an example video, linked from inside the
campaign settings. Dev only. Branch `ddbpage`. Spec of the feature itself: docs/BEYOND20.md.

## What was built
- **The page:** docs/site/connect-dnd-beyond.md -> engine/client/site/connect-dnd-beyond.html (engine/tools/build_site.py
  learned `HELP` pages: same template, nav and footer as About/Terms/Privacy, not in the nav row; in the sitemap). Served at
  `/connect-dnd-beyond` by both nginx confs (`/connect-dnd-beyond/` and `.html` 301 to it). llms.txt names it.
- **Its media:** git-ignored binaries in engine/client/site/ddb/, copied by engine/tools/build_ddb_media.sh (engine/deploy.sh
  runs it, like the phone film) from the masters on the USB disk, `/mnt/usb/turnip-works/help/connect-dnd-beyond/2026-10-29/`.
  A release copies the dev engine tree, so they ship with it. A new cut gets a new date in its names (Cloudflare ~4 h).
- **Settings:** Settings ▸ Me (everyone) and Settings ▸ Campaign rules (GM) have a "D&D Beyond" group: "D&D Beyond: not
  connected in this tab" or "D&D Beyond: connected via Beyond20" (app.b20.connected; the open window redraws when it
  changes), and a "Connect D&D Beyond" button that opens the page in a new tab.
- **Suites:** engine/test/browser_ddbpage.py (new; PAGE, FILM, SET, ROUTE); browser_sitepages.py and seo_check.py now include
  the page.

## The film: a real recording of the real flow
- **Beyond20** built from the clone (`npm install && npm run build`, v2.21.0, build/chrome) and loaded unpacked into
  Playwright's Chromium ("Chrome for Testing"; branded Chrome no longer takes --load-extension), headed, persistent profile,
  on its own Xvfb display `:101` at 2560x1440: the sheet's window left (1280 wide: D&D Beyond's desktop layout; at 960 it
  is the tablet layout, which hides the Features tab), the table's window right.
- **Every click and keystroke on screen is a real X event** (xdotool; smooth pointer moves, the real cursor drawn by
  ffmpeg x11grab). Playwright only reads page geometry and state (to aim and to know when something happened). Nothing of
  Beyond20's is simulated. recording/take.py.
- **D&D Beyond:** an account was needed (premades, HP editing). Signed up as Fauna with <email> through Wizards
  Accounts (Auth0): age gate, form, email verification (the link from the inbox record), consent, then D&D Beyond's own
  age form and username **TurnipWorksFauna**. **No CAPTCHA anywhere.** Credentials: ~/.config/turnip-works/dndbeyond.json
  (600). A birth date was required; Fauna has none, so 2000-01-01 was entered (said so in the file).
  The character is D&D Beyond's own **Basic Rules (2014) premade Lola Jani** (human fighter 1, free content), claimed into
  that account (`/characters/172939471`). Nobody else's character.
- **The table:** throwaway dev campaigns "The Goblin Cellar (Beyond20 demo)" made by a headless GM (recording/gm_setup.py):
  a common room, Lola Jani (the player Sam's main pawn, unlinked), Goblin 1 and 2, a fight started. Never Harry's campaign.
- **Take 3 (the one used),** 92 s raw: options ▸ Advanced Options ▸ the two lines typed ▸ Apply ▸ Chrome's dialog ▸ Allow
  (ONE Allow granted both origins) ▸ close the tab, F5 ▸ "Beyond20 connected" ▸ P (turn order) ▸ Initiative on the sheet
  (Lola rolled a 1: d20-1 = 0, into the turn order) ▸ "Link Lola Jani's sheet to Lola Jani" beside the pawn ▸ T over Goblin 1
  ▸ Greataxe ▸ Beyond20's own BEYOND 20 button (to hit 12, damage 10, at Goblin 1) ▸ 5 damage on the sheet ▸ pawn damage 5 ▸
  Lola selected, her ring with the damage and the Attack button. Events: recording/take3-events.json.
- **The cut:** recording/edit.py + segments.json: twelve trims, each a crop of the 2560x1440 take scaled to 1280x720,
  captions burned in from an ASS file (Noto Sans, text only), 81 s. H.264 two-pass 620 kb/s + faststart, VP9 two-pass
  520 kb/s, no audio track. Poster and the page's five pictures are frames of the same take (stills.json).

## Findings on the way (results, not verdicts)
- **Chrome's permission dialog:** Deny is the filled default button; Enter denies. Allow sits right of it (Gemini read the
  dialog: centred on the window, ~170 px right of centre, 252 px down). One Apply with two lines asked once and granted both.
- **Beyond20's first roll on a new character** shows "Please select the 'Features & Traits' panel": the page says so.
- **D&D Beyond's damage quick-roll after a to-hit quick-roll did nothing** in two takes (Beyond20 logged "Executing panel …
  damages only" and sent nothing; in an earlier rehearsal it worked). Beyond20's own BEYOND 20 button in the item pane
  rolls to hit and damage in one go (auto-roll damage is on by default): that is what the film shows. Not chased further.
- **The ring's Attack list opened off-screen** in take 3 (`tw.ringFlyout()` box x -328..-53) with Lola near the left edge
  of the view; in a rehearsal with the pawn elsewhere it was on-screen ([15, 505, 146, 648]). Looks like the flyout does not
  clamp to the view. Left for the ring/pawns owners; the film cuts before it.
- agy-run reads its prompt from stdin when stdin is not a tty: always `< /dev/null`, or it holds /tmp/agy.lock forever
  (it did for 11 minutes here before I killed my own call).

- **A seat link is a key:** the table window's address bar holds the player's `#s=` link. The two full-frame shots (and
  any crop reaching y < 87 over the right window) blur it (edit.py `blur`); edge energy in that strip 56.8 -> 22.5.

## Landed (2026-10-29)
- main c0ce46a2, DEV client 20261029112135, release candidate **20261029-112147-c0ce46a2**; dev nginx route installed
  (sites-available/dev.turnipworks.net from the repo conf, nginx -t, reload; the old one kept in the scratchpad).
  **Prod's nginx is NOT installed** (it moves with Harry's promote: docs/STATUS.md "Waiting on Harry").
- Suites, worktree before landing: browser_ddbpage --local 42/42, browser_sitepages --local 50/50, browser_beyond20 --local
  29/29, npm test all green, seo_check --source 12/12.
- On dev after landing: browser_ddbpage --page http://127.0.0.1:8180 46/46 and --page https://dev.turnipworks.net 46/46,
  browser_sitepages --page 62/62, browser_beyond20 --page 29/29, seo_check 93/94: the one miss was llms.txt's new line
  ending its address with a full stop (fixed in 24aa81d1).

## Gemini (agy-run, serially, "Do NOT create, crop or write any files", labels first)
- Chrome's permission dialog (perm3, before the take): "\"Beyond 20\" has requested additional permissions. It could: Read
  and change your data on dev.turnipworks.net", Deny (filled) and Allow; no infobar about automated testing in either window.

### Round 1 (cut 3, 31 images: 14 film frames at 640x360, the blurred address bars, the page on a laptop and a phone, About, Settings): **FIX**
- Address bars: "No. Both address bars are completely obscured" (no seat link readable).
- Page vs About: "Excellent match ... identical page background tone, container card curvature, margins, typography".
- Steps: "exceptionally well-written, plain-English, and easy for non-technical users to follow."
- Fixes it asked for, and what was done:
  1. the caption covered the Advanced Options button -> that caption (and the "connected" one) at the top;
  2. "Beyond20 connected" never showed: the frame was the loading screen ("Setting out the room") -> a real bug: the 2.6 s
     note fired under the loading screen. **Fixed in the client** (surfaces/beyond20.js: it waits for the loading screen to
     go; browser_ddbpage checks it), landed (candidate 20261029-120013-64ebe4d8), then retaken;
  3. the "Link ... sheet" button was half under the open Pawns menu -> the take closes the Pawns menu before the link
     (left as a finding: the pawn's conditional buttons sit under an open tray; the chat's Link button is the fallback);
  plus: no dice in the attack frame. A die is drawn only where the player's pawn can see, and the demo table was dark with
  fog of war on (new campaigns' default): the d12 lay unseen ("drawn": false). The GM now sets day light and fog off
  (recording/gm_fix.py), as a GM would for a lit fight; the page's troubleshooting says why dice can be unseen. Also the
  dice are thrown FROM the attacker's pawn: "the dice land at the target" was wrong, now "the chat names her target".
  The domains still was unreadable at page size -> tight crops at native pixels, and a still of the Allow dialog.
- Settings: it questioned the entry in Campaign rules (Beyond20 is per tab, the section is campaign-wide). Kept: Harry
  asked for it "inside the campaign settings", and it is a door, not a setting. The status moved under the button.

### Take 5 / cut 5 (shipped)
take5: day light, fog off, the note after the loading screen (toast at 44.5 s), the Pawns menu closed before Link, the
d12 drawn beside Lola. Cut: 14 trims, 87.3 s, mp4 6.85 MB, webm 5.76 MB. New names `-20261029b` (Cloudflare kept cut 3's).

### Copy fixes from the coordinator's review (checked against the code first)
- **Attack button:** on the ring of every pawn you act for, with or without Beyond20 (surfaces/attacks.js); up to 8 attacks
  saved on the pawn, the last used first; a sheet attack is saved by name; "+ Add attack" / "Edit attacks"; with no target,
  one click on a pawn picks it and makes it the target.
- **Conditions:** every one follows the sheet (core/beyond20.js): a picture where there is one, a text label otherwise
  (deafened, petrified), exhaustion with its level.
- **Step 3:** only `https://turnipworks.net/*` in the box; one line for testers to add dev. The still (which shows both
  lines) kept, its caption and alt say the second line is the test server's; the film's step-3 caption likewise (cut 6,
  names `-20261029c`).
- **Which pawn:** the troubleshooting line now has the first-name match (surfaces/beyond20.js pawnFor) and "a linked pawn
  always wins".

### Round 2 (cut 5): FIX. Cut 7 (shipped, `-20261029d`, 82.3 s, mp4 6.46 MB, webm 5.42 MB)
- Confirmed fixed: Advanced Options visible, "Beyond20 connected" visible, the Link button whole, the dice drawn, the address
  bar ("Not a single character of the URL is decipherable"), Settings ("Clear, tidy, properly aligned").
- **x11grab at 2560x1440 never caught Chrome's permission dialog** (the click on Allow worked; no frame shows it, and the
  pixel diffs agree). The dialog in the film (a 3.4 s hold) and on the page is the REAL capture of the same dialog from the
  1920x1080 rehearsal (perm3, read by Gemini earlier; on the USB disk as rehearsal-permission-dialog.png). It names
  dev.turnipworks.net; the page's caption says so.
- The initiative and attack captions moved to after the number / the dice; the step-5 still is a tight crop on the note.

## Round 4: the page re-made from a new user's walk (Harry: "your instructions are not reflective of any of what I'm seeing")
- **The store build:** Chrome Web Store lists Beyond 20 **2.21.0** (updated 16 Sept 2026); a fresh profile installed
  2.21.0_0; AMO lists 2.21.0. The same as the source build: the setting exists and is named the same. (c) ruled out.
- **Why Harry could not find it:** on the table tab the icon's small window says "Not a D&D Beyond or VTT page. Open a
  D&D Beyond character sheet and try again." Following that, the icon on the sheet opens the CHARACTER popup, whose
  "▼ Advanced Options" is the character's settings (no custom domains). The setting is only on the OPTIONS window, at
  the very bottom behind "Advanced Options", and then it is the FIRST setting, back at the very top (it was 1,800 px up).
  The old page said "its icon ▸ Options ▸ Advanced options ▸ find the box": three of those were wrong or missing.
- **The walk** (walk/): real Google Chrome 146, a fresh profile, :102 at 1600x900, the store's own Add to Chrome. Every
  step's screenshot is real; the boxes are drawn by walk/make_steps.py (plain highlight), the address field blurred on
  every shot (a table's address holds a seat link), positions from the pages' own layout or measured from the pixels.
  Found on the way: Beyond20 opens two tabs of its own some time after install (its update page, an advert for The Forge)
  and puts them in front; in both Chrome dialogs the FILLED button is the wrong one (Cancel, Deny); with two lines Chrome
  asks twice. 23 steps, one click each.
- **Re-walk** in a second fresh profile doing only what the page says: all 23 steps worked. Only automation needed help
  (xdotool's mouse does not reach Chrome's native dialogs on this X server: steps 2 and 15 pressed by keyboard), and
  step 3's wording was changed (the tabs come later and jump in front).
- Gemini on the 23 pictures: every address field "thoroughly blurred ... zero leakage of #s="; 13 boxes on target at
  first, 8 off (estimated coordinates for native UI and tabs) -> measured from the pixels -> all 8 "OK".
