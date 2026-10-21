# TaleSpire camera and cut height, per Zee Bashew's movement tutorial

Research date 2026-10-05. Source video: "Talespire Movement Tutorial (not animated)", Zee Bashew, 7:00, uploaded 2024-07-12, https://www.youtube.com/watch?v=yXpcmCF1CB4 (a paid TaleSpire sponsorship, disclosed at 0:28).

**Terms.** "Cut height" is TaleSpire's horizontal slice: everything above that height is not drawn, map-wide. The developers call it the "hide plane". "Pivot" is the point the camera orbits around and looks at, drawn as a small white ring ("donut") on the surface.

## How it actually works (short version)

1. **There is no "floor up / floor down", and the cut does not follow the camera's height.** The cut is placed by a *probe*: a line shot straight up from a point. Whatever it hits first, that thing and everything above it is hidden. If it hits nothing, the cut goes "to the sky" and nothing is hidden. (Narrator 1:49; developer log confirms. 95%)
2. **Two things can be the probe point.**
   - The **selected miniature**, re-probed *every time it moves*. Walk under a staircase and the staircase vanishes; step out and it comes back (1:23 to 1:47). This one "constantly changes".
   - The **spot you double right-click**. That click does three things at once: flies the camera there, puts the pivot on that surface, and runs the same upward probe from that spot (2:32). This cut then **stays put** while you pan and rotate, until the next double right-click or the next mini move (2:41). (95% from narration; visuals agree.)
3. **So you set the cut by clicking the floor you want to see, not the roof you want gone.** Double right-click a floor under a ceiling: the ceiling goes. Double right-click something open to the sky (stair top, roof, railing): the cut resets to the sky and everything comes back (2:04 to 2:10, "the cut height's been set to the sky again"). "Down, up, down" at 2:38 is him alternating between those two kinds of click. (90%)
4. **Zooming all the way out temporarily shows everything above the cut again** (1:58). It is a view override, not a change of the cut. (90% that it is said; 60% on the exact marker behaviour, see disagreements.)
5. **Camera.** WASD slides the pivot horizontally; middle-mouse drag orbits around the pivot; scroll wheel zooms; double right-click jumps the pivot (and camera) to any surface, at any distance, including far across the map (3:32). Pivot *height* changes mainly by double right-clicking a surface at a different height ("Skyrim climb" up a building, 3:00). (95%)
6. **Manual override exists and he tells people not to lean on it.** A vertical bar at the right edge has a green diamond (tooltip "Set Cut Height") and a purple one ("Set Pivot Height"); both can be dragged (3:07). "I don't really suggest that." (95% said; labels 85% via Gemini.)
7. **Minis change floors by teleport, not by walking.** Arrow keys are "the worst way": minis climb things unasked when they grind into a wall (1:08), and get stuck on bad collision geometry (5:30). Drag works, Ctrl+drag changes height, Alt+drag sets facing (4:14 to 4:22). His "best way" is **Shift+click, then click**: a ghost appears, you place it anywhere you can see, the mini jumps there, through walls (5:04 to 5:30).
8. **The trick he says he "totally forgot" and calls "the most important bit" (5:22):** Shift+click moves go through walls "as long as your cut height is set properly". Meaning: you can only drop a mini onto a floor you can see, so first double right-click that floor to open the building, then Shift+click the mini in. The cut is the door.

## What is surprising, against the obvious assumptions

- *Assumed: the cut follows the camera's focus height.* It does not. Cut and pivot are separate markers. Both happen to be set by the same double right-click, but by different rules: the pivot lands *on* the clicked surface; the cut lands at *whatever is above* the clicked surface, which may be far above, or nowhere.
- *Assumed: a floor up/down button.* There are no floors in the software at all. The "floor" is rediscovered each time by a ray hitting a ceiling. TaleSpire's own FAQ says tooling is hard "when there are not explicit floors in the system".
- *Assumed: the cut is a camera setting you adjust.* In normal use nobody adjusts it. It is a side effect of where your mini is or where you last clicked.
- *Consequence:* the same gesture (double right-click) both opens a building and closes it, depending on whether the clicked spot has something overhead. That is elegant once learned and baffling before. It is also why the camera "rotates in a way that might seem strange at first" (2:25): people do not know there is a pivot until someone shows them the donut.
- *Consequence:* selecting and nudging a mini silently overrides the cut you just set by clicking. Two controllers, one plane.

## Not covered by the video

- Nothing on seeing **other players' minis** on other levels. Nothing on what happens to *your* cut when someone else moves. (Checked transcript and asked Gemini directly.)
- Nothing on **roofs** as a special case; a roof is just whatever the upward ray hits.
- No **flying** mode. Ctrl+drag raises a mini and it stays in mid-air where released (Gemini, 4:21 to 4:24, 75%).
- No walking up stairs as a recommended route. Arrow-key stair climbing is shown at about 1:10 only as the thing that goes wrong.
- The **padlock** that locks the cut (disables automatic placement) is in the developer log but is not mentioned in the video, and Gemini saw no padlock on screen.
- The video predates the September 2024 rework (eight extra diagonal rays). What it shows is the old single-ray rule.

## Transcript, relevant passages

Method: YouTube captions were rate-limited (HTTP 429, three polite attempts, no workaround used). Audio was downloaded with an updated yt-dlp and transcribed locally with OpenAI Whisper `medium.en`. Timestamps are Whisper's segment starts. Corrected obvious mishearings in brackets. Word accuracy about 97%.

> [01:06] Click the mini and use the direction keys to move them. [01:08] You can also use a controller, but I wouldn't because this is the worst way to move miniatures, [01:13] primarily because they will occasionally ascend to heights that you don't want them to [01:19] if TaleSpire thinks you're trying to climb because they're grinding into a wall or whatever.
>
> [01:23] But what we're going to do with this mini is we're going to walk underneath these stairs here, [01:28] or underneath any kind of ceiling or anything, and you'll notice... [01:32] The cut height changed. [01:33] Let me move back out. [01:35] Let me move back in. [01:36] Notice how the cut height is going up and down. [01:38] It's actually represented by this little green thing on the right. [01:42] Up, down, up, down, up, down.
>
> [01:47] Let's take a look at what's happening here. [01:49] A line [Whisper: "lion"] is actually shot straight up out of the top of your selected miniature, [01:53] and as soon as it hits something, TaleSpire goes, [01:55] "Let me get that and everything above it out of the way for you."
>
> [01:58] You can use your mouse scroll wheel to scroll all the way out, [02:01] which will display everything above your cut height again.
>
> [02:04] Actually, look at what happens if I double right click the stairs here, [02:07] and you'll notice something interesting. [02:09] The cut height's been set to the sky again. [02:10] Why is that? [02:11] Scroll in. [02:12] You'll see a little donut. [02:13] You see that donut? [02:14] That's your pivot point.
>
> [02:16] You can move your pivot point horizontally by using WASD [Whisper: "Wazda"], [02:18] and you can reset it by double right clicking on just about anything. [02:22] When you hold down middle click, your camera rotates around your pivot. [02:25] And that's why the camera rotates in a way that might seem strange at first [02:29] until you figure out, oh, it's actually rotating around this specific point.
>
> [02:32] What's interesting is double right clicking will change your pivot, [02:34] but it'll also check above your pivot and reset the cut height as though it were a mini. [02:38] Down, up, down. [02:41] The difference is once you set your cut height with double right click, [02:44] unlike with the mini, it doesn't constantly change. [02:47] It just gives you a bit more control, really.
>
> [03:00] If you want to move vertically, one of the best ways to do that is to scroll out [03:03] and then use double right click to kind of Skyrim climb up structures. [03:07] You can set your cut and pivot height over on the right by manually dragging them up or down. [03:12] I don't really suggest that. [03:13] I think even though that is a solution in the moment, [03:16] if you get used to the idea of navigating with double right click, [03:20] it starts to feel more lizard brain direct. [03:23] You can get where you want to go. [03:24] You can cut open doorways. [03:26] You can take a look what's under a ceiling really quickly. [03:30] You can, you know, you can navigate better. [03:32] You can also double right click to navigate massive horizontal distances, like so. [03:41] And you can get back like this. [03:43] This might take a couple clicks.
>
> [03:45] Now, I mentioned that using the direction keys was the worst way to move your miniature, [03:50] and that is true. [03:52] Here are some other ways. [03:54] Firstly, you can click and drag a miniature. [03:56] You can also use a lasso tool to select and then click drag multiple miniatures at once, [04:02] although that can be a little bit unpredictable. [04:04] It runs into some of the same issues that you would run into if you're using the direction buttons, [04:08] but you do have some more fine control over where you're placing the miniature. [04:13] It's not locked to a grid. [04:14] You can also hold down alt in order to change the facing by dragging the direction you want them to face. [04:20] You can hold down control to change the height.
>
> [05:01] I forgot to keep counting sections. [05:04] The best way to move, shift click. [05:08] That'll give you a ghost and then use that ghost to place the miniature where you want it to be. [05:12] Click. [05:15] Shift click, click, shift, click, click.
>
> [05:22] I totally forgot the most important bit, which is if you're shift click moving, you can move through walls as long as your cut height is set properly. [05:30] This arch specifically has bad collisions and it's used everywhere in people's maps whenever you download maps from Tales Bazaar or Tales Tavern. [05:39] Because it's a beautiful piece of geometry, but a lot of people clip it through other stuff. [05:43] And then this is what happens when you try and walk through one of those doors. [05:47] Using directions. [05:50] Using shift click.

Remainder (5:53 to 7:00) is unrelated to camera or cut: Tab for a GM "predator vision" overlay, double-tap Tab for names, right-click radial menu, F3 rename, "just make everybody a GM", L for a GM flashlight pointer. Opening (0:00 to 1:03) is preamble and placing minis (Space, hammer, goblin icon, Ctrl+C to copy, C to pick).

**What he calls bad or confusing, quoted:** direction keys are "the worst way to move miniatures" (1:08, repeated 3:45); controller "I wouldn't" (1:08); camera rotation "might seem strange at first" (2:25); dragging the cut and pivot markers "I don't really suggest that" (3:12); lasso drag "a little bit unpredictable" (4:02).

## What Gemini saw

Method: `gemini-2.5-pro` was given the YouTube URL directly as video. Pass 1 was a neutral timestamped log with no leading questions. Later passes asked the specific questions on clipped segments at 2 to 5 frames per second. A final pass used still frames (two per second, extracted with ffmpeg from a 720p download) to read the right-edge markers. `gemini-3.1-pro-preview` was tried and hung for over fifteen minutes with no output; not used. I did not look at any frames myself.

Condensed from the neutral pass (visuals only, the spoken words matched Whisper closely):

- 1:24 to 1:47. Selected mini walks under a large stone staircase with arrow keys; the staircase above it disappears; it walks out, the staircase reappears; repeated several times. Cursor points at a vertical bar on the right edge with a green marker that moves in step.
- 1:49. An overlay graphic: a bright white beam drawn from the mini's head up to the underside of the stairs.
- 1:58. Scroll-wheel zoom out; the hidden upper structure reappears.
- 2:04 to 2:16. Double right-click on the top of a staircase; camera re-centres there; zoom in shows a small white ring on the step.
- 2:17 to 2:31. View slides sideways (WASD); a double right-click elsewhere moves the ring; holding middle mouse orbits the view around the ring.
- 2:32 to 2:50. Double right-click on a floor: structures above vanish. Double right-click on top of a pillar or railing: they return. Double right-click on a lower interior floor: roof and upper floors vanish. Camera then pans around the opened interior and the cut does not move.
- 3:00 to 3:07. Simpler, brighter map. Zoomed out, repeated double right-clicks on successively higher parts of a tall building; the view steps up the building.
- 3:07 to 3:12. Cursor drags the markers on the right bar. Tooltips read "Set Cut Height" (green, upper) and "Set Pivot Height" (purple, lower). Dragging green down slices the building progressively, live.
- 3:13 to 3:31. More double right-clicks, looking into rooms on different levels.
- 3:33 to 3:45. Zoomed far out, double right-click on a distant ruin; view jumps there; same to get back. On-screen caption "(NOPE! NAILED IT)".
- 3:54 to 4:13. Click-drag a mini; a white line and "11.1 DISTANCE" style readout. Lasso two minis and drag; one snags on a stone arch and hops on top of it.
- 4:15 to 4:24. Alt held: an arrow at the mini's base turns with the cursor. Ctrl held: the mini's ghost rises straight up in open air; on release the mini is at the raised position and stays there. No scenery change.
- 5:07 to 5:21. Shift+click a mini: a translucent white ghost follows the cursor, including onto a roof; second click and the mini appears there instantly (no walk animation).
- 5:22 to 5:30. A building with its roof and upper part already hidden; ghost placed on the interior floor; mini appears inside. Cut does not change after landing.
- 5:43 to 5:52. Arrow keys into the arch: mini ends up on top of the arch. Shift+click: mini lands on the far side.

Gemini's direct answers on appearance (visual only, about 75%): the cut is one horizontal height across the whole map, not a local hole around the mini; whole pieces vanish instantly with no animation; no cap or fill is drawn on cut walls. Bottom-left key hints it read, consistent across three frame passes (about 70%): "WASD MOVE CAMERA", "E/Q ROTATE CAMERA", "CTRL MOVE CAMERA VERTICALLY", "MOUSE WHEEL ZOOM CAMERA"; and when hovering a mini, "LMB PICKUP CREATURE", "ALT ROTATE CREATURE", "CTRL ELEVATE CREATURE", "SHIFT TELEPORT CREATURE". If that reading is right, there is a third way to move the pivot vertically (hold Ctrl) that the narrator never mentions.

## Where Gemini and the transcript disagree, and which I trust

| Point | Transcript | Gemini | Verdict |
|---|---|---|---|
| Double right-click on the stair top, 2:04 | "The cut height's been set to the sky again" | Video pass: both markers drop to two-thirds and "the cut is set just above the staircase". Frame pass: markers jump to about 95% and hidden scenery reappears. | Transcript, and the frame pass agrees with it. The video pass invented a rule ("cut just above the clicked surface") that the narrator contradicts. |
| "Skyrim climb", 3:00 | Says only that it moves you vertically | Video pass: "each click removes the roof at the clicked level" | Unresolved, 50%. By the stated rule, clicking an open roof should send the cut to the sky, not remove that roof. Frame pass was too noisy to settle it. |
| Do the green and purple markers move independently? | "You can set your cut and pivot height ... by manually dragging them" (plural, separately implied) | Video pass: independent, green can go below purple. Frame pass: "always move together". | Independent when dragged (the two tooltips make no sense otherwise), 80%. Gemini's percent-position readings of small markers are not reliable; do not build on them. |
| Ctrl+drag raise, 4:21 | "hold down control to change the height" | One pass: mini "clipping through the roof above it". Dedicated higher-frame-rate pass: outdoors, nothing above, nothing clipped. | The dedicated pass. The first was a hallucination. |
| Zoom all the way out | "will display everything above your cut height again" | Agrees scenery returns; passes disagree on whether the green marker moves | Words are certain. Whether the marker itself moves is unknown. |

Everything else matched.

## Check against TaleSpire's own documentation

- **Developer log 451, "Hide plane where art thou?"** https://bouncyrock.com/news/articles/talespire-dev-log-451-hide-plane-where-art-thou (raw page text read directly, 2024). Exact words: "Any time a mini is moved [0], TaleSpire tries to automatically place the hide plane to a sensible spot [1] so you can actually see your mini and properly play. It does that by looking straight upwards from the new location until it finds an obstruction and then setting the hide plane to remove it. If there is no obstruction (= sky), nothing is removed." Footnote [0]: "Or the camera is set to a different position using the double right-click move". Footnote [1]: "Unless you disable the automatic placement by enabling the padlock next to the hide plane slider." This is the same rule the narrator gives at 1:49 and 2:32, from the developer who wrote it. The log then describes the rework that shipped after the video: eight extra diagonal rays, and if more than half are blocked the cut drops to the lowest diagonal hit.
- **FAQ** https://talespire.com/faq : no explicit floors exist in the system (said while explaining why a top-down mode is hard).
- **Guides** https://talespire.com/guides : no controls or keybinding page; it points to the in-game tutorials. `talespire.com/controls` and `/keybindings` return 404. So the key list above rests on the video only.
- Web search was unavailable (the session's search allowance was already spent), so community wikis were not checked. Only direct fetches of known pages.

## For Turnip Works

Not a recommendation, just what this adds to `verticality-2026-10-05.md`:

- TaleSpire's "cut" is best described as **"show me the room this point is in"**, with the room inferred from the first thing overhead. The input is a point, never a height.
- The click-a-floor gesture is the thing its power users love ("lizard brain direct") and the thing new users cannot discover: this video exists because one GM had to teach it by hand to "over 30 people".
- The failure modes already logged (cut misfires under pitched roofs, holes, balconies) follow directly from "first hit of one ray", and the developers' own fix was more rays, still described by them as "a pretty simple system".
- Because Turnip Works knows its levels, the same gesture could resolve to a storey instead of a ray hit, which keeps the feel and removes the guesswork. Untested idea.
