# Test debt inventory — Task F, 2026-10-13

Baseline: `ab07c51` (fetched `origin/main` at task start). Runs use the shared
`tw-slot` limiter. The inventory records assertion counts separately from suite
exit status; a crash after successful assertions is still a failed run. Runtime
is measured inside the limiter where available; older baseline wall durations
include queue time and are labelled accordingly. Evidence is retained under
`~/task-f-evidence/` during the investigation; the final compact matrix
and repeat evidence accompany this report.

Final inventory evidence (2026-10-14): the one complete pre-fog run covered
144 suites in **3,328.09 seconds** (55m 28s). It had 143 green exits and one
stale tool-sweep landing assertion: the concurrent wall-fit deployment added a
fifth queue tile. The fetched fog/wall-fit merge added eight suites; a focused
33-suite run covered all new and affected paths. Its figures and settings rows
exposed two more stale test assumptions, then both complete corrected suites
passed (figures 192/192; settings 68/68). Together the complete run and
merged-source follow-ups cover all **152 inventoried suites**, with no unexpected
failure. The 2,233 exact building-topology expected-fail plans remain explicit
and dated below; golden stayed exact. Raw attempts, including every red result,
are under `~/task-f-evidence/`, with the per-suite before/after table
in `report-composite/inventory.md`.

The final merged full command covered **152 suites in 3,968.08 seconds**.
It preserved three explicit red rows: chatline 33/34, pawn-base 40/44 and
atmosphere parity 11/12. Those merged fog-era assumptions were corrected
without loosening their underlying checks: chatline then passed 34/34 ×10,
pawn-base 44/44 ×3, and parity 12/12 ×10. The final per-suite before/after
table is `~/task-f-evidence/report-final/inventory.md`; the original
red report remains beside it. Exact golden remained 1,944 scenes and 145 types
with zero differences, and 2,233 exact topology XFAIL plans remain explicit.

## Crypt building topology

**REAL BUG, 2026-10-13.** `tools/spawn-tuner/js/buildings.js`'s carved planner
scatters leaf rooms with two-cell separation, builds a minimum spanning tree,
then attempts extra corridor links. It can emit plans that its own `check()`
rejects: too few large rooms, no requested loop, or no choice near the entrance.
The current matrix exposes **97 violated contracts in 94 of 1,440 Crypt plans**:
78 minimum-room failures, 14 missing loops, and five missing entrance choices.
The other 5,280 plans pass. These are not rounding discrepancies or stale counts.

Repair needs topology and packing search that guarantees the requested contracts,
plus a defined response when a footprint cannot accommodate them. That exceeds
Task F's small-fix scope. Keep the unchanged assertions running. Expected failures
must name the exact type/size/seed/dial tuple, rule and measured detail in a dated
fixture linking here. Any other failure, missing expected case or unexpected pass
must require attention. Do not suppress the Crypt suite or lower its standards.

## Historical reviewer contracts

**STALE EXPECTATION.** `tests/reviewer_hotkeys.py` asserted the pre-October-2
Shift+digit/typing contract, explicitly superseded in `LAB_NOTES.md` (2026-10-02,
“review page rebuilt for throughput”). The current contract is score-and-advance,
N for notes, U for score undo, plate scores by click, and / for name search.
`tests/browser_clean_slate.py` still expected an empty bench after the September 30
canary shipped. Its replacement checks the catalogue's cards and their loaded
models and plates instead of copying today's count.

## Running the matrix

`tools/run_all_tests.sh` runs the manifest through the limiter, retains per-run logs
and JSON, and prints one final table. `--list` also checks that every executable
file in the four requested directories is either covered or explicitly classified
as a helper or non-test utility. Legacy review-archive scripts are data migrations,
not suites, and are never run against live review records.

Use `--match <path-substring>` for affected suites, `--repeat 10` for consecutive
flake verification, and `--jobs 1` (default) to minimize test-induced load. Up to
four jobs still share the same global limiter and per-suite locks. All attempts
remain in the report; a later pass never erases a failure. Golden compares exact
layouts against an archived `origin/main` (or explicit `--golden-ref`) and never
records new expectations. Performance/screenshot probes are labelled MEASURED,
not counted as assertion passes.

## Confirmed repairs

- **Real client bug — area pictures.** World navigation reused metadata cached
  before the GM's upload for up to 20 seconds. The original 10-second assertion
  failed 66/67 in all three baseline runs. Opening navigation now refreshes its
  thumbnail metadata. A regression deliberately primes the stale player cache,
  uploads a new picture, and checks the new upload timestamp. Ten consecutive
  complete runs passed 67/67 without extending the deadline.
- **Stale fixtures — completed review queues.** Both the fast-review acceptance
  suite and tool-sweep assumed a live batch always contained an unreviewed model.
  They now verify the valid completion state. Tool-sweep selects the visible All
  filter and compares its entire batch membership with the asset catalogue; it
  still renders actual models and source plates and writes scores only to the
  sandbox. Existing live ratings must remain unchanged. First-time alignment
  guesses use empty read-response fixtures so a person's prior alignment work
  cannot invalidate the test. Fixed runs passed 31/31 and 26/26 respectively.
- **Stale reviewer bindings and bench.** The current hotkey contract passes all
  12 checks, including real keyboard events, persistence and undo. The canary
  bench test derives its cards from `canary.json` and waits for every model and
  plate to load. It no longer expects the intentionally retired empty bench.

## Runner verification

Ten process-level contract checks passed: a child that prints PASS then fails
stays red; an explicit failed assertion stays red even if the child exits zero;
a zero-assertion sweep cannot pass; a timed-out child stays red; a measurement is not represented as an
assertion pass; a newly added executable cannot silently disappear from the
inventory; and multiple known contract failures count as one expected-fail plan
when the suite uses plans as its unit. Timeouts begin after limiter admission.
Termination first offers Python cleanup a chance to remove throwaway campaigns.
Queue and execution time are reported separately. Interrupting the matrix
cancels queued runs and lets admitted tests clean up. Browser suites sharing
fixed local ports take the same cross-process port locks before limiter
admission. If an outside driver briefly owns a port without that lock, the
runner waits up to two minutes for it to clear before starting the child. A
held-listener contract proves that an uncoordinated transient owner does not
create a false test failure. The repaired full `browser_areas.py` suite passed
57/57 in ten consecutive runs; queue time is reported separately from its
42–47 second execution times. A partial matrix had reported the building sweep
green with **0/0 plans**: its manifest passed a directory where the script
expected a numeric seed count. The command now uses 40 seeds and all registry
types, and the script rejects invalid seed counts before looping. That aborted
run is preserved as evidence rather than counted as final coverage.

## Flake measurements

The tuner acceptance suite sampled renderer statistics on arbitrary single frames.
With the same geometry and 10.8 MB of geometry memory, measured triangle counts
alternated between about 711,000 and 1,861,000, with 152 versus 335 draw calls,
as shadow passes refreshed. The baked tier similarly alternated between about
318,000 and 873,000 triangles. A11/A19/A23 could therefore compare different
render passes. Their geometry stage now uses the existing `nofx` fixture and
three fresh stable samples. The 2.5× stress, 1.6× default-tier, 4× full-tier,
8× texture and 2% restoration thresholds are unchanged; stress clearing also
checks the exact original draw count. Ten uninterrupted post-restart full runs
passed 49/49 each across all 145 catalogue rooms, including a real held asset
and no page errors. Two earlier connection-refused setup attempts reached zero
assertions and are recorded separately from that strict streak.

Atmosphere parity originally sampled the game for five seconds and then the tuner
for another five seconds. The procedural field could change between those
windows even with matching settings. A reproduced drift estimate of 1.019 versus
0.536 ft/s accompanied only 0.0074 field change. The repair samples both views
over the same interval and preserves the 0.3 ft/s tolerance. Its separate P6
failure was deterministic: the old 24-pixel perturbation no longer exceeded the
intended ratio after the physical simulation-cell minimum changed. The fixture
now derives the perturbation from measured default size and view scale. Ten
uninterrupted post-restart full runs passed 12/12 each on the fixed revision.

The final two-worker matrix exposed the same phase mistake in the separate P7a
screen-transmittance check: it averaged 12 seconds of tuner frames, then the
next 12 seconds of game frames. The right open-ground patch measured 0.772
versus 0.598 detail transmittance although P2 uniforms and P3 density/wind
matched. P7a now interleaves screenshots across both views and alternates
capture order, retaining its original 0.12 absolute tolerance and 24-frame
sample per view. This compares the same moving fog interval in each renderer.
Ten consecutive corrected full parity runs passed 12/12 each.

## Environment and baseline corrections

The matrix needs the normal Node dependencies, the browser virtualenv and the
ignored delivered assets. In an isolated worktree, link or copy the existing
`tools/spawn-tuner/assets`, `engine/client/data/icons` and
`engine/client/data/roof` and `engine/client/data/cursors` directories before running. Missing icon/roof files and
a missing `ws` dependency were recorded as setup failures, then rerun with the
same baseline source. They are not classified as product regressions. Older
recipe suites also defaulted to abandoned experiment directories; the baseline
was rerun with the explicit current tuner path before repairing that default.

The shared limiter is not FIFO: a short suite can wait behind long browser runs.
The runner prints admission progress and reports execution separately from wall
time. A five-second gap between submissions gives other waiting workers a chance
to acquire a slot. Performance probes remain labelled measurements taken under
the actual shared load; they do not become invented performance gates.

## Building topology across the catalog

**REAL BUGS, 2026-10-13.** The original building matrix exercised five families,
while the generator exposes thirteen. Its new `--all-types` mode uses each
family's declared storey bounds and default dials, with the original twelve
footprints. Three expanded baseline runs each produced 14,087 valid plans out of 16,320;
2,233 plans violated 3,811 existing contracts, including the original 94 Crypt plans.
These inputs are accepted by the generator, and failures also occur at 24×24,
so the problem is not limited to a footprint too small to hold a programme.

Representative cases use origin `(3,-2)` and south-facing fronts:

| Family | Footprint / storeys / seed | Violated contract |
|---|---|---|
| Mine | 14×10 / 1 / 8363 | Required loop missing |
| Lair | 14×10 / 1 / 8363 | No near-entry choice; one large leaf room |
| Cult, Dungeon | 10×8 / 1 / 8237 | No near-entry choice; zero large leaf rooms |
| Smithy | 12×8 / 2 / 8299 | Two stock rooms not attached to a forge |
| Wizard, Market | 24×24 / 1 / 8687 | Unreachable rooms and 36 unfilled cells |

The carved families need packing and routing guarantees. The packed families
also need repairs to circulation, wings and functional adjacency. Those changes
exceed a small repair and could alter many layouts. Dated exceptions therefore
record exact inputs, rule names and measured details; no general family waiver,
size tolerance or reachability criterion is relaxed. The whole matrix includes
`--all-types`, so the newly discovered failures remain visible as expected
failures and future changes to them require review.

## Figures and command audit

The full figures suite aborted in three baseline runs while looking for an empty
canvas location behind its still-open palette. Starting the real drag first
exposes the canvas, so the test can find a valid drop location. The command audit
then exposed three independent failures: stale fixtures did not exercise newly
registered building/measurement states; the broad `graphics` query crowded its
quality presets out of the eight results; and material disposal could race
three.js r170 shader warmup. Fixtures now derive the new command cases from the
registry and create their real states. Title-prefix matches outrank synonym-only
matches. Shader warmup captures the programs it is waiting for and handles their
release, with seven focused checks passing in ten consecutive runs.

The complete repaired figures suite passed **192/192**, including all **3,503**
command/selection searches and executions, with no page errors. Contextual
commands already covered by fight/chat suites retain their explicit exclusions;
new registry entries were not added to a waiver. The historical grand-stair
browser failure did not reproduce: three baseline runs passed 26/26. Its separate
Node audit failed because two catalogue decorations looked like complete ladders
by name; the existing named-exception mechanism now classifies those two assets
from their recorded dimensions and roles, and all 501 checks pass.

**Merged fog command-walk flake, fixed 2026-10-14.** A player exploring quietly
can advance the area's sequence while the GM's registry audit runs. The audit
had mistaken that sequence delta for the number of commands it should undo:
after `vision.reset` it removed a fixture, and after the chat's newest Undo
offer it issued a second Undo instead of Redo. The audit now records its own
submissions and reverses each according to its actual action, restoring the GM
view between trials. It still runs and searches every applicable command. The
complete merged figures suite passes 192/192, including the full registry walk
with no page errors; the focused seat-plus-audit run passes 54/54.

**Merged fog chatline flake, fixed 2026-10-14.** During the quiet cut-offer
animation, the player's background fog exploration can append a `fog.view`
entry to the area's relay sequence. The old assertion expected the sequence
to contain literally one event, `token.move`. It now excludes only `fog.view`
and still requires exactly that move and no other relay action from the offer.
Ten consecutive complete corrected runs passed 34/34 each.

**Merged fog pawn-base expectation, fixed 2026-10-14.** The two-seat geometry
suite assumed both seats could see the raised dragon. A new campaign now
starts with fog, which correctly hid it from the player and made four base/beam
assertions fail. The throwaway fixture disables fog before building the scene
and requires the player to join with fog off. Dedicated fog suites retain the
visibility assertions; this suite still checks the exact shared base, beam,
cut, movement, hide and reveal behavior.
Three consecutive complete corrected runs passed 44/44 each.

**Merged fog picture expectation, fixed 2026-10-14.** Fog intentionally omits
shared unmasked area pictures from a player's navigation. The settings test now
asserts that privacy rule, switches fog off in its throwaway campaign, and
requires the current 480-pixel picture inside the original 10-second deadline.
Ten consecutive complete merged-source runs passed **68/68** each; execution
times were 32–38 seconds, with queue time recorded separately.

**Merged wall-fit queue expectation, fixed 2026-10-14.** The final pre-merge
tool-sweep run failed 25/26 because it required four landing tiles while the
new wall-family queue had made five. The test now derives the expected tiles
from the published queue data and verifies each label, left count and total;
it still checks the review data byte-for-byte and passes 26/26.

## Short door connections and bench coverage

**Real furnishing bug, fixed.** Four Crypt rooms had valid door connections only
1.5–2 feet long. The solver applied the decorative-walk minimum length of three
feet to those connections and reported them blocked. Only door through-lines now
accept shorter routes, and only when both actual endpoints are passable; blocked
endpoints cannot become valid merely by snapping onto a nearby cell. The full
120-building /1,866-room engine sweep now has no purpose failures. Seven focused
checks cover both valid short routes and rejection of blocked routes. Exact
golden: 1,944 scenes, 145 room types, zero differences and zero accepted exceptions.

**Real bench omission, fixed.** The original buildings UI suite passed 9/9 because
it compared the bench's cards with the bench's own incomplete type list. A new
independent catalogue assertion failed against the original bench in all three
runs: Mine and Lair were omitted. The bench now derives eligible building types
from `types.json`, implemented generators and their room recipes. The repaired
suite passes 9/9 with 208 cards over all 13 supported families.


## False-green exit status

**Real test-harness bug, fixed.** `tests/review_fast_accept.py` printed failing
assertions but returned zero after a complete run. It now exits nonzero when any
check fails. The matrix also independently rejects reported assertion failures
from zero-exit legacy scripts, retaining the raw child exit separately. A process
regression exercises that exact failure mode. Canary and hotkey coverage retain
console errors as well as page errors; alignment read fixtures match GET only,
so writes still reach the real sandbox backend. Follow-up checks passed: canary,
hotkeys 12/12, fast review 31/31, tool-sweep 26/26 and runner 6/6.

## Performance search

**Real client bug, fixed.** The unchanged nits suite failed 71/72 in three baseline
runs because the broad `performance` query filled its eight results with graphics
controls and omitted the FPS meter. Low-level graphics switches no longer claim
that broad synonym; the three quality presets and FPS meter retain it. The
unchanged suite passes 72/72, and the figures command-bar follow-up passes 35/35.

## Acceptance coverage and loading observations

**Stale expectations and timing flakes.** Acceptance derives room membership and
footprints from `rooms.json`, keeping the original cohort's minimum-fill checks
and checking rendered placement tags for every catalogue room. Folded Layout and
Bench sections are opened through their real controls. The first complete repaired
acceptance run passed 49/49 across all 145 current room types; ten uninterrupted
full runs then passed 49/49 each. Background preload waits for observed new progress. The
loading-bound check holds one real foreground download until it observes both
foreground work and the visible indicator, then releases the response. This tests
the waiting state without depending on a 250 ms poll catching a fast download.

The intro warmup test had attributed unrelated library-preview requests and late
Python callbacks to the room being spawned. It now matches the actual room's asset
dependencies and browser resource start times. An intentional late room dependency
is a positive control. The original 400 ms spawn deadline, 50 ms margin and exact
layout comparison remain unchanged. Ten complete loading runs passed 67/67
each on the committed source; the J5 late-texture check remained exact.

The separate B5 loading-bar assertion found a second timing assumption during
the ten-run sequence. The product leaves the loading screen as soon as the first
fully furnished frame is ready, then keeps its progress animation visible during
a 200 ms fade. One measured run had all 466 pieces and no stand-ins but began
the fade at 68.4%, below the old 70% instant-of-leave check. The repaired test
samples the visible fade and still requires progress through the freeze, a peak
inside the original 70–84% stall band, every piece ready, and no stand-ins.
The fade threshold remains exact. Ten consecutive complete loading runs passed
67/67 each; drawn fade peaks ranged from 73.6% to 82.3%, with all 466 pieces
present and zero stand-ins.

## Two-tab M5 click race

**Flake, cause reproduced.** The old fixture could calculate a correct NPC ray
while the previously selected pawn's DOM ring still occupied its old screen
position. After the camera recentered, rendering moved that ring under the click.
Diagnostic attempt seven recorded the actual pointer-down target as Brakka's
`BUTTON.rbtn.big.drag`, despite a valid ray to the intended NPC. The selection
therefore stayed on Brakka. The repair performs a real pointer move, waits two
rendered frames, and rechecks both the unobscured canvas target and intended ray
before the real mouse click. It still asserts the resulting NPC selection.

Two earlier repair series each failed on their seventh run and remain in the
evidence. The final fixture passed nine runs before the Task H integration; a
run admitted during the brief merge-conflict state could not boot the app. That
interrupted sequence is not counted as ten consecutive passes. The fresh
post-Task-H M5 sequence passed ten complete 29/29 runs on the committed tree.

## Raised pawn in a cut

**Stale expectation, fixed.** The frozen turn-order/X-ray suite failed 53/54 in
three runs because it expected a pawn at 20 ft to disappear above a 9 ft cut.
The accepted raised-pawn rule cuts at the base's level: in this fixture the base
is on ground level 0, so the whole pawn and its height beam remain visible while
X-ray outlines the figure at 20 ft. The repaired check verifies the base level,
visible pawn and beam, figure height, and outline position. The full current
suite passes 54/54.

## Post-deploy command and initiative checks (2026-10-14)

**Fixture dependency, fixed.** The live figures audit occasionally missed the
`thing.upright` command because its setup reused the crate that the preceding
command walk could change or remove, then waited a fixed 250 ms after setting
legacy `tiltZ`. The special-state check now places its own crate, writes a
quarter-turn quaternion through the real command path and waits for both the
crate and orientation before it audits the registry. A generated roof could
already use `shingle`, so the audit now derives the roof-style commands from
the registry and starts each from another style. A separate live run exposed
an audit Undo race: `edit.cut` could remove its room after the harness's
three-second acknowledgement window, leaving no sequence change recorded and
therefore no Undo. The audit now waits for submitted commands to settle before
deciding whether to reverse them. The complete deployed audit passes 34/34.

**Real client bug, fixed.** A player with no saved initiative bonus could enter
one yet receive no roll. Selecting the pawn emitted a selection event before the
pending roll was recorded, and fog could exclude the owned pawn from the
display-filtered turn view used by `rollKeys`. The prompt now records its target
after selection, keeps it through the command bar's Enter transaction, and
clears it after a canceled prompt. Initiative resolution reads the relay's
seat-scoped view while turn-row rendering retains the fog filter. The browser
suite exercises a selection rebase during the prompt and still requires the
stored bonus, dice chat line, and ordered roll; local 55/55 passes.

The final merged matrix retained three red rows caused by new fog-era test
assumptions. Chatline had counted an independent `fog.view` exploration update
as an offer's relay action; it now excludes that command while still requiring
the expected `token.move`, with ten full 34/34 passes. Pawn-base compared two
seats' geometry in a campaign where fog hid the dragon; its throwaway fixture
now switches fog off, with three full 44/44 passes. Atmosphere parity had
captured two moving views in successive twelve-second intervals, producing
transmittance 0.772 versus 0.598 at different phases. It now alternates the
capture order within the same twelve-second interval; its 0.12 tolerance is
unchanged and ten full 12/12 runs pass. The final 152-suite inventory and raw
logs are in `~/task-f-evidence/report-final/`.
