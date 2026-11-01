# VTT comparison index: lab notes (2026-10-29)

Harry, 2026-10-29: "We talked about building a 'VTT' comparison index, that tracked features and upsides/downsides of all
the VTTs including the new projects swarming out, and us... no reason not to build it". DEV only; posting anywhere is
Harry's. How to maintain it: `docs/VTT_INDEX.md`.

## What was built
- `docs/site/vtt-index.json` (schema `docs/site/vtt-index.schema.json`): 118 rows. Ours; 23 established (two research
  agents, official sources only, each cell a URL and `verified`); 94 new and indie from the 2026-10-24 r/VTT draft
  (`research/indie-vtt-index-2026-10.rows.jsonl` in the main checkout, not committed: three agents translated the free
  text into the schema with no new research). Polymancer, Adunata and Atlas (Obsidian) moved from the draft to established.
  Assembled by `assemble.py` from `ours.json`, `established-{A,B}.json`, `indie-{1,2,3}.json`.
- Site check (`tools/vtt-index/vtt_index.py alive`, robots.txt first, one GET a product, >= 2.5 s apart): established
  23/23 up; indie 58 up, 0 gone, 36 unknown (no website: Discord/YouTube/video-only posts, unnamed products; one
  Kickstarter). `alive-indie.txt`.
- The page `/vtt-index` (`engine/tools/site_vtt_index.py`, `engine/tools/site/vtt-index.{css,js}`), built by
  `build_site.py`; `/vtt-index.json`, `/vtt-index.schema.json`, `/vtt-index.md` (nginx, both confs; prod's installed at
  go-live); llms.txt entry; sitemap; Schema.org Dataset JSON-LD; nav row "Compare VTTs" on every site page.
- Corrections: `POST /api/tw-relay/tickets/site` (kind `correction`, no seat; 6 an hour per address, address held only
  in memory as a rate bucket and swept after an hour; not stored). Triage page and `tools/tickets.py` show the product,
  field, contact, "says they make it". Privacy Policy paragraph added (updated 2026-10-29).

## Fairness: Codex (`codex exec`, read-only), two rounds
- **Round 1 verdict** (`codex-fairness-r1.codex.log`): "BIASED. The disclosure, correction invitation and alphabetical
  rendered table are good, and several competitors receive substantial credit. But the promised equal scoring does not
  survive inspection: Turnip gets credit for tracking without sheets, private development work counts toward public
  capability, and its unsupported claims receive stronger verification labels than competitors' documented features."
  48 findings. It was right on our row.
- **Changed** (`fairness_r1.py`, `fairness_r1-changes.txt`, 83 changes): our sheets, D&D Beyond, phones and AI to "no"
  (dev-only work and the outside-assistant API in the notes; AI-made art in the summary; "hosted only" added to our
  downsides). The rubric: values are what people can use today; official extensions count, third-party add-ons partial;
  manual fog, light-only lighting and drawing-only map tools partial; non-commercial source is not open source; n/a for
  tools that are not tables; Group defined as how the row was made. From sources: Owlbear works on phones (docs),
  Fantasy Grounds switches 2D / free 3D / token-view 3D and has a real map builder, TTS fog zones reveal as pieces move.
  Downsides that were research gaps ("not documented") or digs ("not as robust as Foundry", "site is in French", "no
  real fog of war after years") removed or rewritten; missing upsides added (TaleSpire slabs, Alchemy voice/video and
  system builder, RPG Engine workshop, Multiverse scripting, Polymancer first-person). Indie feature dates set to the
  draft's 2026-10-24 (a site check no longer refreshes the feature date).
- **Round 2 verdict** (`codex-fairness-r2.codex.log`): "MOSTLY FAIR. The revisions materially improve the comparison:
  Turnip Works no longer receives capability credit for private Beyond20 or phone work, tracking without sheets, or
  external AI assistance; competitors receive several substantial corrections and stronger upsides." It still found
  rows where competitors got credit the new rubric excludes, and our unsourced community line marked verified.
- **Changed** (`fairness_r2.py`, 52 changes): Beyond20 and other third-party bridges partial for every row (Roll20,
  Foundry, Polymancer); trackers-only sheets to no (6 rows); light without vision partial (Polymancer, OMM); DDB Maps fog
  partial; MapTool map building partial; rolling of unstated look = roller; Elder Realm free in beta; Owlbear AI yes
  (Forecast's room detection; ML features now count, as One Realm's did); our community line unverified; the
  remaining "little public information" downsides dropped; the JSON disclosure aligned with the page.
- **Declined:** removing "expect our row to fill up over time" (Codex: promotional). It is Harry's agreed framing
  (strategy 2026-10-24) and the honest reason the table exists; kept, next to "every row is checked on the same
  schedule" and "dev work does not count until it is live". Also kept: pre-launch products (Polymancer, EldritchVTT,
  16-VTT) described from their makers' own accounts with Stage saying so. That errs against us, not for us: our
  dev-only work does not count.

## Tests
- `engine/test/browser_vttindex.py --local`: 44/44 (DATA, LOAD, FILTER x5 + group/kind/search, SORT, DETAIL, FIX into
  the ticket sandbox, PHONE at 400 px). `tickets.test.mjs` 56 (11 new). `browser_sitepages.py --local` 43/43 (nav row).
- Phone layout bug found by the suite: the correction form's long product `<select>` widened the page to 425 px; fixed
  with a `minmax(0, 1fr)` grid column.

## Gemini factual spot check (agy-run, 10 random established rows; `gemini-facts/`, `gemini-facts-r1.txt`)
- Gemini: 7 rows "OK" (Atlas 3D, Dungeon Alchemist, D&D Beyond Maps, Tabula Sono, Shard, Adunata, MapTool); flagged
  Quest Portal dice ("roller" should be 3D, 100%), four Alchemy RPG cells and Demiplane D&D Beyond.
- Checked at the sources before changing anything: Quest Portal's dice page says "Roll 3D dice" -> set to 3D (verified).
  All four Alchemy help-centre URLs Gemini cited answer 404 (invented addresses): not applied, the cells stay "?".
  Demiplane: no source given that settles it: stays "?".

## Gemini visual check (agy-run, labels first, `Do NOT create, crop or write any files`)
- The agy queue was 15-20 jobs deep all morning. The first two multi-image asks came back empty (no text, exit 0:
  probably agy's print timeout under the queue); re-asked with `-o` and one or two images a call.
- **Desktop r2** (`gemini-desktop-r2.txt`): FIX. (1) at 1366 x 900 the table was entirely below the fold, all
  intro text; (2) the detail panel showed no sign it scrolls; (3) "source" links read as part of the sentence;
  (4) no legend for the cell colours. Its other two points ("Brows..." truncation, a clipped "F..." header) were cells
  hidden behind the open panel.
- **Changed:** "How to read it" moved below the table (the disclosure stays above it); a colour legend over the table;
  "[source]" links; the panel scrolls in itself with a fade at its foot and more room round it. New suite check: at
  1366 x 900 the table starts above the fold.
- Two later asks were killed mid-run (exit 143, SIGTERM from outside: not ours) and re-queued.
- **Phone r3** (`gemini-phone-r3.txt`): FIX. Filters fit at 400 px; but (1) the detail panel's three columns squeezed
  the notes to a word a line; (2) nothing showed the table scrolls sideways; (3) the caption over the table was cut
  off at the screen edge. **Changed:** on narrow screens each detail row stacks (label and value, the note beneath);
  the table's right edge fades while more columns lie to the right (gone at the end); "swipe the table sideways for
  more columns" in the legend on touch and narrow screens; the caption is for screen readers only.
- **Desktop r3** (`gemini-desktop-r3.txt`): FIX. Still only ~1.5 rows above the fold; no sign the detail panel
  continues; "[source]" links low-contrast; faint backdrop; stray marks over "Product" (the visually-hidden caption was
  not hidden: a more specific rule won). **Changed:** the intro cut to two short paragraphs (the full rule moved to "How
  to read it"), 4 rows above the fold now (suite: 3+); a "Key" label; "more columns to the right: scroll or swipe" at
  every width and a stronger right-edge fade; the panel's buttons sit in a footer stuck to its foot with "scroll for
  more" until the end; "[source]" dark and underlined; backdrop darker; the caption really hidden.
- **Phone r4** (`gemini-phone-r4.txt`): FIX. (1) intro and filters filled the first phone screen; (2) the panel's
  sticky footer covers the text scrolling under it; (3) the title "clipped at the top" was our screenshot's scroll
  position, not the page. **Changed:** on phones the filters fold behind "Filters" (open again when one is set or the
  screen is wide); the legend is smaller; the suite's phone still now scrolls to the filters. Table top 907 -> 871 px
  on an 800 px screen: the disclosure comes first by design. (2) kept: a footer that content scrolls under is the
  point (it says "scroll for more" and holds Correct this row).
- **Desktop r4** (`gemini-desktop-r4.txt`): page **OK** ("table headers and the first 4 full rows (plus row 5
  partially) are visible without scrolling"; legend "understandable"). Detail panel FIX: text sliced by the sticky
  footer, a lone "[source]" on its own line, "[source]" grey not link-coloured. **Phone r5** (`gemini-phone-r5.txt`):
  filters fit, "It is clear the table continues to the right via the explicit helper banner ... and the right-edge
  gradient fade"; FIX only for the same footer overlap (and a word cut at the scrolling table's edge: expected).
  **Changed:** the panel is now a column: its text scrolls in its own area and the footer bar sits below it (nothing
  scrolls under it); "[source]" link-coloured (#85590a) and kept on the line with a no-break space; "vtt add-on" never
  wraps in the name column.
- **Final** (`gemini-final.txt`): desktop detail **OK** ("Text inside the panel terminates with clean padding above
  the footer bar"), phone table **OK** (the edge cut "is expected and explicitly accompanied by scroll cues"), phone
  detail FIX: a line half-visible at the foot of the panel's scrolling text (that is what a scrolling area looks
  like mid-scroll; the footer no longer covers anything) and low contrast of "Link to this row" / "scroll for more" on
  the footer. **Changed:** both darker. Not re-asked (the agy queue was an hour deep).
