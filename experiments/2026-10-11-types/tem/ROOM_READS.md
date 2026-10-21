# Temple & chapel: blind room reads at table distance (2026-10-12)

Method (the crypt's): `integration/room_shots.py` builds each room alone in the tuner at its default size, hides the labels, photographs it from the table camera (55 degrees), a second angle and straight above, and Gemini 2.5 Pro describes the three pictures knowing nothing; a second call compares the description with what the room was meant to be. Seeds 11 and 12. **One read is a coin** (the crypt's lesson 15): two reads of a room disagree often, so the table below is a record, not a score.

## The live record (https://implausible.enterprises/projects/turnip-works/tuner/, v=20261012153243, flavor sun)

| room | seed | verdict | named as |
|---|---|---|---|
| `temple-nave` | 11 | yes | A small chapel, temple, or shrine |
| `temple-nave` | 12 | yes | small chapel or shrine |
| `cathedral` | 11 | yes | An audience hall, a small throne room, or a chapel. |
| `cathedral` | 12 | partly | A throne room, audience hall, or small temple. |
| `cathedral-dark` | 11 | partly | A chapel, small temple, or lecture hall. |
| `cathedral-dark` | 12 | partly | A chapel, small throne room, or audience hall |
| `temple-shrine` | 11 | partly | A sun-themed audience chamber or a private study. |
| `temple-shrine` | 12 | no | A small, sun-themed throne room or audience chamber. |
| `temple-vestry` | 11 | no | A lord's study, a private office, or an audience chamber |
| `temple-vestry` | 12 | partly | A captain's quarters or a lord's private study |
| `temple-cloister` | 11 | yes | A pillared hall or a temple antechamber |
| `temple-cloister` | 12 | partly | ceremonial hall or a puzzle room |
| `temple-scriptorium` | 11 | yes | A classroom, lecture hall, or scriptorium |
| `temple-scriptorium` | 12 | no | chapel, small lecture hall, or briefing room |
| `temple-infirmary` | 11 | partly | A barracks, dormitory, or an inn's communal bunkhouse. |
| `temple-infirmary` | 12 | partly | A barracks or a dormitory |
| `temple-cell` | 11 | yes | simple bedroom or barracks cell |
| `temple-cell` | 12 | partly | simple bedroom or barracks quarters |
| `temple-belltower` | 11 | yes | A bell room, likely for a guard post or monastery. |
| `temple-belltower` | 12 | yes | A small chapel, belfry, or scriptorium. |

8 yes, 9 partly, 3 no of 20. By room:

- **Temple nave**: a chapel, 2 of 2 on the live record and 4 of 4 with the local rounds (sun and moon).
- **Cathedral** and **Dark cathedral**: always a place with rows of seats facing a dais: "a chapel, small temple or audience hall", sometimes "throne room". Never called a cathedral: from the table camera the columns are "pedestals along the walls", the stained glass and the buttresses are not mentioned. It reads as a church, not as a BIG church.
- **Shrine**: "sun-themed" every time (the sigil and banners carry the flavor), then "private chapel" or "audience chamber / throne room" by turns: **the sun idol, a disc on a pillar between two stands, is a high-backed throne from above**. An altar before it was tried and read as a dining table; reverted.
- **Vestry**: the robes on stands are "dress forms": a tailor's shop (two or three robes) or, with the table in the middle before one robe, "a lord's study" (the robe was the chair). The table now stands at the side. Named a vestry in 1 read of 6.
- **Cloister walk**: "a pillared hall, a temple antechamber, a ceremonial hall". Right family, never "cloister": it has no arcade onto a garth, only columns.
- **Scriptorium**: "classroom, lecture hall or scriptorium" in 3 of 4; once "a chapel".
- **Infirmary**: a dormitory or barracks in 6 reads of 6, through three versions (cots, made beds, the bench in the middle, a healer's table). Beds in two rows decide it. Needs an asset that says "sick" (docs/ASSETS_TO_BUILD.md → Temple).
- **Priest's cell**: "a simple bedroom or barracks cell" every time. That is what it is.
- **Bell tower base**: a belfry or bell room, 4 of 4. The bell does it.

## After the follow-up (vestry table to the side wall; live from about 16:45)

Vestry, local round on the same code, seeds 11 and 12: "a tailor's shop", "a tailor's workshop or a fitting room" (partly, twice). The robes are seen as clothes on stands; nothing says whose.

## In the game (https://turnipworks.net/, a throwaway campaign, 2026-10-12)

Build → Fantasy → Temple & chapel lists the ten rooms (and the Castle chapel, whose recipes are also `tem-`), no icon missing. A cathedral 8x14 built there: 66 things, all eight flavor slots filled in sun, no page errors. Blind read of three views: "a temple, chapel or similar place of worship"; rows of pews either side of an aisle lined with pillars; and, asked for a repeated symbol: **"a spoked wagon wheel"**, on the floor, behind the altar and on the walls. The sun reads as a wheel from the table camera: the motif is seen as ONE repeated emblem (the slots work), its meaning is not.
The check's campaign `zz-temple-check-fauna` (`cmp_o5mghw63ju`) is still on the relay: the remover only takes names that begin "TEST".

## What the reads changed

- The infirmary's cots (green-topped tables from above) became made beds, spaced 6.5 ft; the bench moved to the middle of the ward; a healer's table was added.
- The vestry lost its third robe, gained the kneeling desk, the basin and candles; its table moved off the axis.
- The shrine's altar trial was reverted.

## Moon

`?flavor=moon` (local round, seed 12): nave "a small chapel, temple or cultist shrine", cathedral "chapel, small temple or audience hall", shrine "a private sanctuary or an acolyte's quarters". The moon's charcoal and silver read darker than the sun's cream and gold: one judge's "cultist shrine".

## The evil-temple test (2026-10-12): mechanism yes, blind read not yet

The cult sanctum's flavor pieces are not on main yet, and its devil and spider idols, altarpieces and censers were never painted (the image allowance ran out on 2026-10-11). Its six FLAT pieces exist (banner, relief, sigil for `devils` and `spiders`). Test, in a local build with those six files added and nothing else changed (`integration/sandbox-evil.py`):

- **Dark cathedral** (the nave program, crypt-stone walls, evil flavor list): dressed itself in devils with no instruction: 8 devil banners, 2 reliefs, the sigil. Blind read: "a chapel, small temple hall or audience chamber". The judge did not mention the banners.
- **Temple nave with `?flavor=spiders`**: every flavor slot that spiders fill took the spider piece (4 banners, 2 reliefs, the sigil), no sun piece remained, no furniture moved. Blind read: "a small chapel or shrine", and the spider sigil was described as "a sun-like emblem".

So the slot scheme does what it was built for: the same recipe takes another faith's pieces with no other change. Whether it then READS as evil is not shown: flat pieces alone do not carry it from the table camera, and the pieces that should (the idol behind the altar, the altarpiece, the censers) do not exist for the evil flavors yet. Repeat this test when the sanctum's meshes land.

Pictures and full descriptions: `shots-live/`, `shots-r1/` … `shots-r4/`, `shots-r2-moon/`, `shots-evil/`, `shots-evil-nave/` (each with `read.json`; the pictures are on the build box, not in git).
