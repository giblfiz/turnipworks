# Uploaded models and safe harbour

Written 2026-11-06 (lane "uploads"); decisions of 2026-11-07 (lane "dmca-implausible") below. Harry: "upload meaning users can upload models (and safe harbor setup)". This is
the feature as built (dev only), the machinery for the US DMCA §512 safe harbour, and what must be true before either
reaches prod or the public. The legal texts are DRAFTS in `docs/legal/` (for Harry and counsel; not published, not
exported to the public mirror). Background research: docs/IMPORTS.md. Experiment notes: `experiments/2026-11-06-uploads/`.

## The short version

- A GM uploads a model file (`.glb`, a `.gltf` with everything inside it, `.stl`, `.obj`) in **Settings ▸ Uploaded
  models** (U; the bar's "upload" or "models"; or a model file dropped on the window). They give it a name, a height in
  feet, its front (quarter turns) and which way is up, and tick the attestation ("I hold the rights to this model…").
- The relay rebuilds it **in a sandbox** into three tiers (20,000 / 5,000 / 1,500 triangles, the lower two best effort:
  a textured model's UV seams can stop the simplifier short, and then the tier ships at what it reached, about 1.7 to
  2.4x for our own 20k figures, rather than refusing the model (2026-11-23); pictures re-encoded as WebP
  at 1024 / 512 / 256 px; meshopt-compressed like the library, docs/ASSET_DELIVERY.md), centred, on its base, its longest
  side 1. The original file is never kept. A model with no colour gets a pewter look.
- It appears in the list with a picture (rendered in the GM's browser from the converted copy and sent back). **Place**
  puts it on the table like a library thing: a ghost on the pointer, R turns it, a click lands one `object.place` with
  `upload: <id>`. Every seat of the campaign draws it; the Graphics detail picks the tier.
- **Private to the campaign.** The list is the GM's; the mesh goes only to the campaign's own live seats, with the seat
  token in an `Authorization` header, never in an address. A share link or exported build never carries it (the thing
  travels as a box with its name).
- **Delete** removes the model from the list and every place it stands (one batch per area: undo brings the things back
  as marked boxes). A model taken down by notice draws everywhere as a marked box: "Model removed (notice)".
- **Public sharing of uploads is off**, behind `TW_UPLOAD_PUBLIC` (below). No public path is built.

## Where it is on

| relay | uploads | the copyright page `/dmca` | public sharing |
|---|---|---|---|
| dev (no `release.json`) | **on** (`TW_UPLOADS=0` turns them off) | on (DRAFT banner) | off |
| prod | **off** unless `TW_UPLOADS=1` **and** the hosting record is complete | 404 until a designated agent is on record | off |

The **hosting record** is `<DATA_DIR>/dmca/safe-harbour.json`, written with `engine/tools/dmca_admin.mjs ready`: the
designated agent's registration number, the published policy and terms addresses, a working notice mailbox. The reason
prod waits for it (the adversarial review, 99%): the harbour does not cover material stored before an agent is designated,
private or not. **Public sharing** (`TW_UPLOAD_PUBLIC=1` in the relay's environment) additionally needs a counsel review
on the record (`--counsel`), and today unlocks nothing: `POST …/publish` answers 501 even with the gate open.

## The pieces

| piece | where | what it does |
|---|---|---|
| shared rules | `engine/core/uploads.js` | the attestation words and version, the flag names, tier for a Graphics detail, a model's size from its box and the GM's height |
| the field | `engine/core/commands.js` | `upload` on object.place (64 hex); dropped when a library piece replaces the thing; never with a `cat` |
| the store and HTTP | `engine/relay/uploads.js` | the GM's list, the upload (cheap checks, then the sandbox), serving, thumbs, set, delete, publish (refused); takedown and restore primitives; the sweep |
| the converter | `engine/relay/upload-worker/` (`worker.mjs`, `limits.mjs`, `sandbox.mjs`; own `package.json`) | one file in, three tiers out, read back and validated |
| safe harbour | `engine/relay/dmca.js` | the policy page and notice form, counter-notices, the business-day window, the hourly restore tick, strikes and termination, the gates |
| the desk | `engine/tools/dmca_admin.mjs` | Fauna's command line for all of it (prints letters; sends nothing) |
| the browser | `engine/client/uploads.js` | the section, upload, picture, placing, drawing, delete, counter-notice form; `assets.visualFor` asks it for `e.upload` |
| tests | `engine/test/uploads.test.mjs` (186 checks, three of our 20k figures among them), `engine/test/browser_uploads.py` (50) | below |

### Storage

`<DATA_DIR>/uploads/blobs/<id>/` holds `t0.glb t1.glb t2.glb thumb.webp meta.json`. The id is the sha256 of the file's
bytes and its conversion options, so the same file uploaded twice is stored once; `meta.raw` is the sha256 of the file
alone, which is what a takedown and the block list key on. Each campaign's own list is `<campaign dir>/uploads.json`
(name, height, front, who, when, and the attestation record: version, the words' hash, seat, time, a keyed hash of the
network address, never the address). It moves with the campaign when the campaign is deleted, so a deleted campaign's
models become orphans and the six-hourly sweep removes them after 14 days. A model out of service in every campaign for a
year loses its files unless a counter-notice or lawsuit is open on it. `uploads/log.jsonl` and `dmca/log.jsonl` record
every step.

## Untrusted files: what is checked, and where

Before a worker starts (the relay): a human GM's seat; the current attestation version; the repeat-infringer status;
20 uploads a seat and 40 an address an hour; 100 models and 200 MB a campaign, 20 GB in all; the body at most 32 MB
(counted as it streams); a file blocked by a takedown is refused by its hash; one conversion at a time, three waiting.

**The box** (`workerCommand`, tested by a probe run in exactly the same command): `prlimit` (60 CPU seconds, 64 MB
largest file written, no core, 512 files) → `nice 15` → node's permission model (read only the worker's folder and the
job's; write only the job's; no child processes; no workers; native addons allowed because sharp is one) → `sandbox.mjs`
(sockets, DNS, HTTP and `fetch` throw) → a clean environment (none of the relay's) → a 90-second wall clock and a 1.5 GB
resident-memory watch that kill it. libvips, sharp's decoder, is restricted to the PNG, JPEG and WebP loaders from memory
(`sharp.block`), since a native addon is outside node's permission model.

**The converter** reads the file as data and rebuilds it: the format by its bytes (never the name); a GLB's header length
against the file; the scene JSON at most 4 MB, 64 deep, no `__proto__`/`constructor`/`prototype` keys; caps on nodes,
meshes, parts, materials, textures, pictures, accessors (2 million elements each, so a sparse accessor of a billion
zeros is refused), and meshopt-compressed views by what they say they unpack to (256 MB); 500,000 triangles in; buffers
only from inside the file (a link to a `.bin`, a web address or a path is refused); a picture linked from outside, in an
unknown format, or whose header says over 4096 px is **left out** (a decompression bomb is never decoded); Draco and any
other unknown *required* extension refused, unknown optional ones, animations, skins, morph targets, cameras, lights,
extras and points/lines stripped (the GM is told what was left behind); NaN corners refused. Then flatten, join, weld,
normalise (base on the ground, centred, longest side 1), smooth normals where there were none, and for each tier:
simplify (plain; then across UV seams, meshopt's Permissive mode; only a model still over 3x the aim, a triangle soup, goes through the topology-blind simplifier, which scrambles pictures), re-encode pictures, meshopt, and **read back and validate with the Khronos glTF-Validator: zero errors or no
upload**. The relay checks the worker's answer again (three GLBs, their headers, sizes, the box) before storing anything,
and re-checks the block list and the repeat-infringer status after the conversion.

**Serving**: the seat token in the `Authorization` header only (an address with `?seat=` is refused, 400: a token in
an address leaks into logs; 2026-11-23); `model/gltf-binary`, `nosniff`, `Content-Disposition: attachment`, `Content-Security-Policy: default-src
'none'; sandbox`, `private, no-cache` with an ETag (304), only to a live seat of a campaign whose list holds the model
and has not had it removed. Ids are 64 hex digits, so no path trick reaches a file.

docs/IMPORTS.md "Decided" (2026-10-05) chose to convert in the importer's browser and to serve imports from a separate
cookieless domain. This build converts on the server instead, because a file from a stranger has to be rebuilt before we
serve it whatever the browser did, and the case law treats automated conversion as part of storage (docs/legal/
WORKING_NOTES.md §2). The two fit together: the Import Lab's in-browser reduction is the natural front end for a
print-resolution sculpt over the 500,000-triangle cap, so its original still never reaches us. The **separate serving
domain** is not built: what it guards against is a stored file being run as a page on our origin (where a seat's token
lives), and the serving headers above (an attachment, nosniff, a sandbox CSP, only GLB and WebP bytes we wrote ourselves)
answer that for now. It is listed for before public sharing.

## Safe harbour: what is built

- **The notice path**: `/dmca` (DRAFT page, no script, strict CSP) with a form asking for each element of §512(c)(3)(A);
  substantial compliance (an agent may sign; email or phone); an incomplete notice that names the work, the material and
  the sender is **kept** for follow-up; a honeypot field; 5 notices an address an hour. Proposed address
  `dmca@<your-domain>`: **no mail routing exists yet** (the plan: a Workspace alias), and the page says so until a
  mailbox is on record. Once an agent is on record the page prints the agent's name, organisation, address, phone and
  email, and names the operator (2026-11-07).
- **Takedown by file**: one admin call removes every copy of a file from every campaign that holds it, under that notice,
  blocks re-upload while any removal stands, and strikes each uploading campaign (and its address) once.
- **The uploader is told** in the game: "Removed after a copyright notice (notice ntc_…)" and a **Counter-notice…** form
  with the §512(g)(3) statements; the relay checks every element.
- **The window**: from the counter-notice's receipt, 10 and 14 business days, counted in California with the US federal
  holidays (observed) skipped. The hourly tick restores it at the start of the window if it was forwarded and no lawsuit
  is on record, **for that campaign only**; one not forwarded is flagged late after a business day and OVERDUE once its
  window opens (logged every hour).
- **Repeat infringers**: three live strikes in twelve months end a campaign's uploading and stop its models being shown;
  five on one address stop uploads from there. A strike is one per (notice, campaign), however many of that campaign's
  files the notice named, and an address's one per (notice, campaign) too; it clears when every takedown it stands for is
  reversed (a counter-notice stands, the notice is withdrawn or found invalid). **The cut-off follows the live strikes**
  (2026-11-23; before, it was for good): below three again, the campaign is reinstated, uploading works, and the models
  removed only by the cut-off come back (those a notice still holds stay removed). It does not lapse by age alone. A GM's
  appeal: `reinstate <campaign> --why`. While cut off, each model a notice holds still names its notice and offers the
  counter-notice. docs/legal/REPEAT_INFRINGER_POLICY.md.
- **Logs** of every notice, takedown, counter-notice, forward, restore, strike and termination.

### Running a takedown (Fauna)

```
node engine/tools/dmca_admin.mjs status            # what waits: incomplete notices, counter-notices late or OVERDUE
node engine/tools/dmca_admin.mjs find "red dragon"  # the notice's words -> campaign, model id, file hash
node engine/tools/dmca_admin.mjs takedown ntc_… <model id or file hash> --reason "valid notice"
# a counter-notice arrives in status:
node engine/tools/dmca_admin.mjs letter ctr_…      # the text to send the claimant (from Fauna's own mailbox)
node engine/tools/dmca_admin.mjs forward ctr_…     # once sent; the tick restores in the window unless:
node engine/tools/dmca_admin.mjs lawsuit ctr_… --note "court, case number"
node engine/tools/dmca_admin.mjs reject-counter ctr_… --why "…"   # not valid; or close ctr_… --why "…" (handled otherwise):
                                                                   # either from received, forwarded or lawsuit
node engine/tools/dmca_admin.mjs restore <raw> ntc_… [--campaign cmp_…] --why "…"   # by hand: closes its open counter-notices
node engine/tools/dmca_admin.mjs reinstate cmp_… --why "the GM's appeal"            # lift a cut-off
```
`--prod` for the prod relay (default dev). Write to an incomplete notice's sender to help complete it.

## Decided 2026-11-07 (Harry)

- **The service provider is Implausible Enterprises LLC** ("We can do it thru implausible"). The `/dmca` page names it
  (`relay/dmca.js` `OPERATOR`); the drafts in docs/legal/ are filled in; the filing packet is
  docs/legal/DMCA_FILING_PACKET.md, with its remaining blanks marked [HARRY].
- **No email confirmation for uploaders until the first real takedown notice.** Harry: "the first time we get an actual
  takedown notice we can build and turn on email confirm for upload. Until then we don't worry about it." The prod gate
  does not ask for it (tested), the repeat-infringer policy ties strikes to the campaign and the network-address
  fingerprint only, and docs/legal/FIRST_TAKEDOWN_RUNBOOK.md is the trigger: handle the notice, tell Harry, build it,
  switch it on.
- **The notice mailbox** is a Workspace alias, `dmca@<your-domain>` on Fauna's inbox, not Cloudflare Email Routing:
  the domain's MX is Google's, and Email Routing would take it over (docs/legal/DMCA_AGENT_REGISTRATION.md).

## What must be true before prod, and before public sharing

**Before `TW_UPLOADS=1` on prod** (each is a line in `dmca_admin.mjs status` until done):
1. Harry gives the provider's street address, the agent's mailing address and phone (the filing packet's [HARRY]
   rows). The provider's street address should **not** be the company's mail-receiving box (the registration doc).
2. The notice mailbox exists and is watched: the Workspace alias, then a test message seen by the steward.
3. The copyright policy is published at `/dmca` on prod with the agent's details (nginx block as on dev:
   `engine/relay/nginx-dev.turnipworks.net.conf`; the page prints them from the record), and the upload terms are in
   the Terms of Use, whose "Copyright complaints" paragraph then points at the agent.
4. The agent is registered at copyright.gov ($6, by card) and the record written: `dmca_admin.mjs ready --agent
   "Copyright Agent" --agent-address … --phone … --number … --policy … --terms … --mailbox …`. The hosting gate waits
   for every one of those (2026-11-07: the agent's name, address and phone were added, because §512(c)(2) wants them on
   the site).
5. Fauna's desk routine is on a schedule (status daily), and the privacy page says what uploads record (draft line:
   "If you upload a model, we keep converted copies of it, the time, your seat and campaign, a fingerprint of the file
   and a keyed, one-way fingerprint of your network address, to run the game and our copyright policy.")

Not on the list, by decision: a verified email for uploaders (above).

**Before `TW_UPLOAD_PUBLIC=1`** (public sharing, the library's step 3): all of the above, plus counsel's review on the record
(`--counsel`), a persistent uploader identity (an account or verified email, so termination means something: the
review's first fix), a report route for non-copyright abuse, the separate cookieless serving domain, and the public
path itself, which is not built.

## Deploying (for Fauna)

- `npm ci` in `engine/relay/upload-worker/` on main (the dev relay runs from the checkout), then restart the dev relay.
  `tools/release.sh` copies that `node_modules` into a release. Without it a relay says "this server cannot convert
  models yet" (503) and nothing else changes.
- nginx (dev): `engine/relay/nginx-location-dev.conf` gives `POST /api/tw-relay/c/<id>/uploads` a 33 MB body cap (the
  general one is 8 MB) and streams it; `nginx-dev.turnipworks.net.conf` adds `/dmca`. `nginx -t` before reload.
- Licences of what was added (relay side only, never shipped to a browser): gltf-transform 4.5.1 (MIT), meshoptimizer
  1.2.0 (MIT), sharp 0.35.5 (Apache-2.0, bundles libvips LGPL), gltf-validator 2.0.0-dev.3.10 (Apache-2.0).

## Open questions for Harry (each has a default built)

1. **Uploader identity.** DECIDED 2026-11-07 (Harry): none until the first real takedown notice, then a confirmed email
   (docs/legal/FIRST_TAKEDOWN_RUNBOOK.md). Both reviewers had ranked it first before prod; the risk is on the record
   (WORKING_NOTES.md §4). Public sharing still lists a persistent identity among its own conditions.
2. **Attestation wording.** Default: the honest one ("buying a copy does not by itself give that right").
3. **Block re-upload of a taken-down file.** Default: yes, while any removal of it stands (IMPORTS.md question 9).
4. **Server-side conversion** in place of the browser-only rule of 2026-10-05. Default: server (security), with the
   Import Lab as the front end for huge files.
5. **Dev hosting before the agent exists.** Default: on, as a test bench. Narrow it (testers only) if strangers use dev.
6. **Which entity and agent.** DECIDED 2026-11-07: Implausible Enterprises LLC; agent proposed as the title "Copyright
   Agent". Still open: the street address, the agent's address and phone (docs/legal/DMCA_FILING_PACKET.md).
