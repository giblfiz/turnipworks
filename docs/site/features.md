---
title: A tour of Turnip Works
nav: Features
updated: 2026-11-04
description: What the Turnip Works 3D tabletop does: buildings that furnish themselves, fog of war with darkvision, first person, 3D dice, a command bar, links for players.
---

# A tour of Turnip Works

Turnip Works is a free 3D virtual tabletop that runs in a browser tab. Here's what's on the table today, one thing at a time. Everything on this page works on the live site now. The things we're still building aren't listed.

## Buildings that furnish themselves

Open the Build tray, pick a building, and drag out its footprint. As you drag, it tells you the size and how many rooms it will have ("60 × 40 ft · 13 rooms"). Let go and the whole building goes up in a few seconds: rooms, doors, a hallway, stairs, a cellar, and furniture down to the candles. An inn gets a yard and a stable, a castle gets a courtyard and a gatehouse.

There are 13 kinds: tavern and inn, mansion, castle, crypt and tomb, mine, smithy and workshop, monster lair, wizard's tower, cult sanctum, temple and chapel, dungeon and prison, farmstead, and market and village. Towers go up, crypts and dungeons go down. Don't like it? Re-roll it, change the number of storeys, or undo it with one <kbd>Ctrl</kbd>+<kbd>Z</kbd>. You can also type it: `build inn 12x8`, `build castle 16x12 3 storeys`.

## Rooms, one at a time

If you'd rather build by hand, pick a room type and drag a rectangle on the 5-foot grid. Draw two that overlap and you get an L-shaped room. Rooms can be turned, dragged and hidden from players until they find them.

## Floors, cellars, hills and caves

A building can have several storeys, with stairs between them. The level meter shows which floor you're looking at, and <kbd>[</kbd> and <kbd>]</kbd> move between them. Pawns keep track of which floor they're on and walk the stairs. There are pits too, and the game asks before anyone falls 20 feet.

Outside, there's open ground and yards. Type `hill` for a grassy hill one storey high, then build on it or dig a room into it. Type `cavern` (or press Build cave) for a cave below ground, with rock, pillars and stalagmites. Wells and troughs hold water you can see ripple. There's no drawing rivers or lakes yet.

## Fog of war that knows about darkvision

Each player sees only what their own pawn can see, worked out from the walls and doors. The GM sees everything. Turn the lights out in an area and it gets properly dark: pawns see 30 feet in the dark unless you say otherwise (`darkvision 60`), and torches, lanterns, lamps and candles each light their own reach. Snuff a lantern and the dark pours back in. Dice never bounce off things a player can't see, so a throw can't give away the hidden door.

## First person

Press <kbd>V</kbd>, or Eyes on your pawn's ring, and look through its eyes. <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> walks, <kbd>Shift</kbd> runs, the mouse looks around, and walls and shut doors stop you. Click a door to open it. The others see an "in first person" tag over your pawn. On a phone, a four-arrow pad does the walking.

## Pawns, damage and conditions

Drag a figure out of the library, or type `6 goblins`. Click a pawn and its ring opens: turn, sheet, damage, and a menu for the rest. Damage is a drag, or type `7 damage` or `heal 5`. Conditions show on the figure itself: a prone pawn lies down, a charmed one has a heart circling its head, an unconscious one has Zs rising. Give a pawn an aura and it glows, from a dim shimmer to a bonfire, in six colours. `roll initiative` starts the fight and keeps the turn order.

A pawn's sheet card holds a link to your character sheet, wherever you keep it, plus notes and GM notes. Players on D&D Beyond can roll from their sheet onto the table with [Beyond20](/connect-dnd-beyond).

## 3D dice, for many games

Every roll is real 3D dice tumbling across the table, and everyone sees the same throw. Plain dice, D&D advantage and keep-highest work as you'd write them. So do the dice of Call of Cthulhu, Vampire V5 with Hunger dice, Shadowrun, Daggerheart's Hope and Fear, Fate, Legend of the Five Rings and Exalted, each read the way its game reads them. [What to type for each game](/dice).

## The command bar

Press <kbd>/</kbd> and type what you want. `spike trap` finds the trap. `sphere 20` puts down a spell area and shows who's caught in it. `roll initiative`, `invite Bobby`, `build inn 12x8`, `darkvision 60`, `send to the dungeon`. The bar searches the whole library and every command, so you rarely need a menu.

## Inviting players

Type `invite Bobby`, or open Settings ▸ Invites and exports. You get a link. Send it however you like. Bobby clicks it and he's in, already standing at the table as a grey pawn waiting for him to pick his figure. No account, no password, nothing to install, for him or for you. A browser remembers the games it's joined.

## Phones

A phone opens straight into the game. Tap a pawn to select it, one finger pans, pinch zooms, twist turns, two fingers tilt. The ring gets Move and Delete buttons, and the bar offers Roll d20 and Say. A phone can also email itself the link, for when a bigger screen is nearby. Some screens, like Settings, are still laid out for a computer.

## An AI helper at the table, if you want one

Any chat assistant that can open a web link can sit at your table as the GM's helper. Make one from the command bar (type `assistant`, then Create a GM assistant), paste the link it gives you into your chat assistant, and it can look at the scene, place things, move pawns and roll the same dice everyone sees, with only the permissions you gave it. There's no AI built into the game itself; this is a plain web API.

## Areas, music and the rest

- **Areas:** a campaign holds many maps (the town, the road, the dungeon). Select the party and type `send to the dungeon` to move them from one to the next.
- **Music:** each area can play a track or a playlist, and each person sets their own volume.
- **Sharing builds:** hand a whole area to another GM as a file or an unlisted link, and they get it in 3D in their own campaign.
- **Taking a map elsewhere:** download any level as a [Universal VTT file](/export) for Foundry, Roll20 or Fantasy Grounds.
- **Feedback:** Settings ▸ Feedback sends us a bug or an idea from inside the game.

## And it's yours

Turnip Works is free, with no paid tier. The engine is open source under the GNU AGPL, and the 3D assets, every chair and goblin, are Creative Commons Attribution 4.0. It's in open beta and new things land every week. [More about us](/about). Coming from another tabletop? [What's different](/switching).
