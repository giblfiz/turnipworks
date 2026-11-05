---
title: Take your maps to Foundry, Roll20 or Fantasy Grounds
nav: Export maps
updated: 2026-11-04
description: Build a map in 3D in Turnip Works, then download it as a Universal VTT file, with walls, doors and lights, for Foundry, Roll20 or Fantasy Grounds.
---

# Take your maps to Foundry, Roll20 or Fantasy Grounds

Some groups already play somewhere else. That's fine: you can build a map in Turnip Works and take it with you. Drop in a tavern or a crypt, let it furnish itself, move the furniture where you want it, and download the level as a Universal VTT file. That's the format Dungeondraft made popular, and most virtual tabletops can read it, with an importer.

The file is a top-down picture of your map as it looks in the game, plus the walls, doors, windows and lights, so the other tabletop knows where players can see and walk. It's free, like the rest of Turnip Works.

## How to export

1. Open your campaign as the GM and go to the area you built.
2. Open **Settings ▸ Invites and exports**.
3. Under **Universal VTT (.dd2vtt)**, pick the **Pixels a square** (70, 100, 140 or 200; 100 is a good start) and tick what you want in the picture: **Include hidden**, **Grid lines**, **Pawns**.
4. Press **Download as Universal VTT (.dd2vtt)**.

Or type it into the command bar: `export uvtt`, or `export uvtt 140` for 140 pixels a square. Only the GM can export.

You get one file per level, for the level you're on, named after the campaign, area and level. Each square is 5 feet. The files for the floors of one building line up with each other.

## What's in the file

- **The picture:** your map from straight above, in the game's own look, north up. Roofs, other floors, labels and the grid are left out (tick Grid lines to keep the grid).
- **Walls** that block sight, with gaps where the doors and windows are.
- **Doors and windows.** Doors arrive closed; windows let sight through.
- **Lights:** the lamps that are lit on that level, with their range and colour.

## Where to take it

- **Foundry VTT:** the Universal Battlemap Importer module reads it.
- **Roll20:** the UniversalVTTImporter API script reads it. API scripts need a Roll20 Pro subscription.
- **Fantasy Grounds:** convert it first with uvtt2fgu, a free converter, then import the result.
- **Other tabletops** that read .dd2vtt or Universal VTT files should take it too. We've checked the file against Foundry's importer and Roll20's script by running their own import code on it, and through uvtt2fgu for Fantasy Grounds. If one doesn't work for you, [tell us](mailto:hello@turnipworks.net).

## What doesn't come across yet

- Walls follow the grid, so curved walls come out as straight ones.
- Pillars, fences and other free-standing things show in the picture but don't block sight.
- Every door arrives closed, and lights are plain lights, without flicker.
- Pawns can be drawn into the picture, but they don't arrive as tokens.
- A very big map at a high pixel count makes a big file: over 20 MB, the game warns you, since some tabletops choke on it.
- It only goes one way for now. Turnip Works can't read a Universal VTT file back in.

## Sharing with another Turnip Works GM

To hand a build to another Turnip Works table, there's no need for a picture. **Settings ▸ Area settings ▸ Export this area…** makes a `.turnip.json` file or an unlisted share link. The other GM opens it and gets the whole 3D area in their own campaign, furniture and all. Tick **Strip secrets** to leave out hidden rooms, traps and GM notes.

Coming over from another tabletop? [What's different, and what we don't do yet](/switching).
