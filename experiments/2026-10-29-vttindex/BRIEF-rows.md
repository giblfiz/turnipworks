# Brief: writing rows for the Turnip Works VTT comparison index (2026-10-29)

Turnip Works (a free browser 3D VTT, made by Fauna and Harry) is publishing a fair comparison table of virtual
tabletops (VTTs) on turnipworks.net. We disclose that we make one of them. The table is framed as "our own development
checklist", so every product, ours included, is scored by the same rules. Makers will be invited to correct their row,
so wrong claims are embarrassing and unfair claims are worse. Accuracy over completeness: "?" is always allowed.

## Output: a JSON array of product objects

Write it to the file path your prompt names (valid JSON, UTF-8, an array). One object per product:

```json
{
  "id": "roll20",                       // lowercase slug, a-z 0-9 and dashes
  "name": "Roll20",
  "maker": "Roll20 Inc.",               // company or person; null if unknown
  "group": "established",               // "established" or "indie" (your prompt says which)
  "kind": "vtt",                        // "vtt" | "vtt add-on" | "map maker" | "in-person display" | "companion tool" | "other"
  "url": "https://roll20.net/",         // official site; null if none
  "summary": "One plain sentence: what it is and who it suits.",
  "alive": {"state": "alive", "checked": "2026-10-29", "how": "official site answered 200"},   // established only; indie: {"state":"unknown","checked":"2026-10-29","how":"not yet checked"}
  "last_checked": "2026-10-29",
  "licence": null,                      // e.g. "AGPL-3.0", "MIT", "proprietary"; null if unknown
  "features": {
    "dims":      {"v": "2D", "note": "short", "src": "https://...", "verified": true},
    "platform":  {"v": ["browser"], "note": "...", "src": "...", "verified": true},
    "price":     {"v": "free tier", "note": "Plus $5.99/mo, Pro $10.99/mo (monthly); players free", "src": "...", "verified": true},
    "accounts":  {"v": "everyone", ...},
    "fog":       {"v": "yes", ...},
    "lighting":  {"v": "yes", ...},
    "mapbuild":  {"v": "partial", ...},
    "levels":    {"v": "?", ...},
    "sheets":    {"v": "yes", ...},
    "ddb":       {"v": "partial", ...},
    "dice":      {"v": "3D", ...},
    "phone":     {"v": "partial", ...},
    "offline":   {"v": "no", ...},
    "opensource":{"v": "no", ...},
    "ai":        {"v": "no", ...},
    "modding":   {"v": "yes", ...},
    "stage":     {"v": "released", ...},
    "community": {"v": "note", "note": "one line: what users visibly say / community size, with a source"}
  },
  "upsides":   ["2-3 fair one-liners, each under ~90 characters"],
  "downsides": ["2-3 fair one-liners, each under ~90 characters"],
  "sources":   [{"url": "https://...", "label": "Pricing page"}],
  "reddit":    {"maker": "u/...", "post": "https://www.reddit.com/...", "date": "2025-06-17", "more": []}   // indie rows only
}
```

## The allowed values (`v`), per field (the full glosses are in criteria.json beside this file)

- dims: "2D" | "3D" | "2D+3D" (flat map with 3D figures/dice, or both modes) | "?"
- platform: an ARRAY of any of "browser", "windows", "mac", "linux", "ios", "android", "vr"; ["?"] if unknown
- price (what the GM pays): "free" (no paid tier at all) | "free tier" (usable free, paid upgrades) | "one-time" | "subscription" | "?"; put the actual prices, and what players pay, in the note
- accounts (who must sign up): "none" | "gm" | "everyone" | "?"
- fog, lighting, mapbuild, levels, sheets, ddb, phone, offline, opensource, modding: "yes" | "partial" | "no" | "?"
  - "partial" = manual-only, through a third-party add-on/module, limited, or announced/in beta. Say which in the note.
  - an add-on or module counts as "partial" unless it is official and built in.
  - ddb: yes = official D&D Beyond integration or Beyond20 support built in; partial = through a community add-on or a one-way import.
  - offline: offline play, LAN, or self-hosting your own server.
- dice: "3D" (physical 3D dice on screen) | "roller" (text or 2D roller) | "no" | "?"
- ai: "yes" | "no" | "?" (built-in AI features of any kind: map/art/text generation, AI assistant). Neutral, not a judgement.
- stage: "released" | "early access" | "beta" | "alpha" | "pre-launch" | "abandoned" | "?"
- community: v is always "note"; the note is one line.

## Rules for every cell

- `src` is the URL the claim comes from (official site, docs, store page, official changelog; a wiki node or the draft's
  Reddit post is acceptable for indie rows). `verified: true` ONLY when you read that source and it says so in this
  session (or, for indie rows, the claim is stated in the draft text you were given). Anything inferred, remembered or
  from an older note you could not re-check: `verified: false` (the page shows it as "(?)").
- Notes are short (under ~120 characters), plain English, no marketing language, no sneer.
- Do NOT guess "no" for a feature you simply could not find. Use "?" unless a source shows it is absent (an FAQ "not
  supported", a docs page listing what's missing, a review saying so). Absence of evidence is "?".
- Upsides and downsides: fair, specific, the kind a regular user would agree with. Every product gets real upsides,
  including big incumbents and tiny one-person projects. Downsides are facts (price model, missing feature, platform
  limits, stage), never insults. Don't write downsides that compare to Turnip Works or mention it. Never use the phrase
  "vibe-coded".
- Never contact anyone, never log in, never create accounts, never post anything. Read public pages only.
- Politeness: at most ~4 fetches per product, one at a time; prefer official docs/pricing/FAQ pages.
