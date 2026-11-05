---
title: The Turnip Works manual
nav: Manual
updated: 2026-11-04
description: How to run a game in Turnip Works: start a table, invite players, build, move pawns, fog and light, dice, turns, sharing, settings, phones and every key.
---

# The Turnip Works manual

This is the manual for a GM who has just opened a table and wants to know where things are. It goes in the order you'll need it: start a table and bring people in, build somewhere to play, then run the game. Everything here works on the live site today. If you want the short tour first, read [what Turnip Works does](/features).

**Contents**

1. [Getting started](#start): start a table, invite players, the screen
2. [Building](#building): buildings, rooms, the library, outdoors, levels and stairs, doors
3. [Running the game](#running): pawns, damage, conditions, fog and light, first person, dice, turns, chat
4. [The command bar](#bar)
5. [Sharing and export](#sharing)
6. [Settings](#settings), and what to change on a slow computer
7. [Phones](#phones)
8. [Keyboard shortcuts](#keys)
9. [Troubleshooting](#trouble)

## 1. Getting started {#start}

### Start a table {#start-table}

1. Go to [turnipworks.net](/). The front page has a **Campaign** name already filled in (press ⚄ for another) and **Your name**, which starts as "GM".
2. Change them if you like, then press **Start a campaign (you are the GM)**.
3. The table opens. That's it: no account, no download.

The address in your browser's address bar is now your GM link. It's the key to your campaign, so keep it. The game offers to email it to you (**Email me my link**), and typing `email my link` in the command bar brings that offer back. The browser remembers the games it has been in, too: next time you open turnipworks.net you land back in your most recent one, and **Other games / New game** (top left, under the launchers) lists the rest.

### Invite players {#invite}

1. Press <kbd>/</kbd> to open the command bar, type `invite Bobby` and press Enter.
2. You get a link for Bobby. Copy it and send it however you like: text, email, Discord.
3. Bobby opens the link and he's at the table. There's a grey stand-in pawn waiting for him until he picks a figure.

You can also do it from **Settings ▸ Invites and exports ▸ Invites and seats**: type a name under **Player name** and press **Invite a player**. That list is where you get a lost link back (**Copy invite** copies a fresh link for the same seat) and where you take a seat away (**Revoke**).

Each link is one seat. Make one per player, and don't send your own GM link to anyone: whoever has it is the GM.

### The screen {#screen}

- **Top left: Pawns, Build, Settings.** The three launchers. Their keys are <kbd>P</kbd>, <kbd>B</kbd> and <kbd>S</kbd>: hold the key to peek, tap it to keep the menu open, or press the pin in a menu to keep it open while you work.
- **Top middle: the command bar.** Press <kbd>/</kbd> (or <kbd>Ctrl</kbd>+<kbd>K</kbd>, <kbd>⌘</kbd>+<kbd>K</kbd> on a Mac) and type what you want. More in [the command bar](#bar).
- **Top right: the area.** The map you're on, and whether players can see it. A campaign can hold many areas.
- **Left edge: the level meter.** Which floor you're looking at, from cellars up to the roofs.
- **Bottom left: chat.** Says, whispers, rolls and the odd offer from the game.
- **The table itself.** Click something to select it. A selected pawn, room or thing shows its ring: a few buttons around it, with ☰ for everything else.

Moving the view:

- **Pan:** drag with the right mouse button, or hold <kbd>Space</kbd> and drag. On a trackpad, scroll with two fingers.
- **Zoom:** the mouse wheel, or pinch on a trackpad. It zooms towards the pointer.
- **Turn and tilt:** hold <kbd>Alt</kbd> (<kbd>Option</kbd> on a Mac) and drag. <kbd>Q</kbd> and <kbd>E</kbd> turn, <kbd>Page Up</kbd> and <kbd>Page Down</kbd> tilt.
- **Centre on something:** select it and press <kbd>F</kbd>. Double-click a room to go to its level and centre on it. <kbd>Ctrl</kbd>+<kbd>0</kbd> resets the view.
- **Ping:** hold the left mouse button still for half a second, or <kbd>Alt</kbd>+click. Everyone sees the ping.

Press <kbd>?</kbd> at any time for the in-game list of every key and mouse move.

## 2. Building {#building}

Building is the GM's job, and players don't see the Build launcher. Press <kbd>B</kbd> for the Build tray. It goes **Genres ▸ Types ▸ Rooms**: pick Fantasy, then a kind of building, then either drag out the whole building or pick one of its rooms.

### Whole buildings {#buildings}

1. In the Build tray, pick a type: Tavern & inn, Mansion, Castle, Temple & chapel, Smithy & workshop, Market & village, Farmstead, Dungeon & prison, Crypt & tomb, Wizard's tower, Cult sanctum, Mine or Monster lair. (Ruins, Wilderness camp and Fey grove are greyed out: they have no rooms yet.)
2. Drag a rectangle on the ground. As you drag, it tells you the size and how many rooms you'll get, like "60 × 40 ft · 13 rooms". It says "overlaps" if the spot is taken.
3. Let go. The building goes up in a few seconds, furnished, with doors, stairs and lights.

For a few seconds afterwards the game offers **Re-roll** (a new layout on the same footprint) and a different number of storeys. Later, select the building and use ☰ ▸ **Storeys** or **Re-roll building**. One <kbd>Ctrl</kbd>+<kbd>Z</kbd> takes the whole building away again.

Towers, castles, inns and mansions go up to three storeys. Crypts, dungeons, mines and cult sanctums go down instead, into cellars. You can type it too: `build inn 12x8` makes an inn 12 by 8 squares (60 × 40 ft), `build castle 16x12 3 storeys` a three-storey castle.

To select a building or a room, click its label (the name floating over it). Zoomed far out, a click selects the whole building. <kbd>Enter</kbd> selects what's inside the selection, <kbd>Shift</kbd>+<kbd>Enter</kbd> goes back up to what holds it.

### Rooms, one at a time {#rooms}

1. In the Build tray, open a type and pick a room (Common room, Kitchen, Burial vault and so on), or type `build kitchen` in the command bar.
2. Drag a rectangle. It snaps to the 5-ft grid and furnishes itself when you let go.
3. Draw a second room overlapping the first and you get an L-shaped room: the new one keeps only the part that doesn't overlap.

A selected room's ring has **Turn** (<kbd>R</kbd>), **Re-roll** (new furniture), **Hide** and ☰. In ☰ you can change the room type, walls or floor, set its fog height, make it taller, rename it (<kbd>F2</kbd>), lock it, or hide it from players. Drag a room by its label to move it. <kbd>L</kbd> hides or shows room labels on your screen.

### The library {#library}

When you pick a room in the Build tray, its library opens in a small window: the furniture and props that belong in that room, then shelves of faction pieces, floors, walls, doors and windows, and stairs. Drag anything out onto the table.

The library window has no search box; the command bar is the search. Press <kbd>/</kbd> and type `barrel`, `spike trap` or `throne`, then press Enter and click where it goes, or drag the row straight onto the table. Hold <kbd>Shift</kbd> as you click rows to pick several and place them together.

Once a thing is down: drag it to move it (<kbd>Shift</kbd> while dragging snaps it to half squares), <kbd>R</kbd> turns it 45°, the arrow keys move it a square (<kbd>Shift</kbd>+arrow moves 1 ft), <kbd>Delete</kbd> removes it, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates it. Its ring has handles to turn it, lift it and tip it over. ☰ ▸ **Replace with similar** swaps it for a cousin, and **Pin** keeps it in place when you re-roll the room.

### Outdoors and terrain {#outdoors}

- **Ground:** drag a floor from the library's Floors shelf onto open ground. It lays one tile and offers to cover all open ground with it, so a whole area can be grass or cobbles in one go.
- **A room's floor:** drop a floor onto a room and the whole floor changes. It then offers "Only this tile" if you meant one.
- **Yards:** Tavern & inn has a Yard room, for the space outside.
- **Hills:** pick **Build hill** (under Tavern & inn, Castle, Farmstead and Monster lair) or type `hill`, and drag one out. `hill 20 ft` makes it two storeys high (10 to 60 ft). A hill's ☰ raises or lowers it and switches between grass banks and rock sides. You can build on top of a hill or dig a room into its side.
- **Caves:** pick **Build cave** (under Dungeon & prison, Mine and Monster lair) or type `cavern`. Caves go below ground, at level -1, with rock walls, pillars and stalagmites.
- **Water:** wells and troughs hold water. There's no drawing rivers or lakes yet.

### Levels and stairs {#levels}

The ground floor is **lv 1**. Floors above are lv 2, lv 3 and so on; below the ground is lv -1, lv -2 (there's no lv 0). Each level is 10 ft.

- <kbd>]</kbd> goes up a level and <kbd>[</kbd> goes down. You see the level you're on and build on it.
- <kbd>\</kbd> switches between **All levels** and **This level only**.
- The meter on the left edge shows where you are. Click or drag on it to jump. **Roofs** is the top mark: go past the top floor and the roofs go on.
- Double-click a room to go to its level. Double-click open ground to see all levels.

To make a cellar by hand, press <kbd>[</kbd> to lv -1 and draw a room there.

**Stairs:** whole buildings come with their own. To add one, drag a stair from the library's Stairs shelf, or select a room and use its ☰. A stair's ☰ switches it between **Stairs down** and **Stairs up**. If a stair has a problem (no floor above yet, a wall running through it), a note on it says so. Drop a pawn on a stair and it goes to the other end; pawns walking around keep to their own level and take the stairs.

**Holes and pits:** type `hole` or `pit` (or `hole 15 ft`) for a hole in the floor. The game asks before a pawn falls through one.

### Doors and windows {#doors}

Doors, windows and wall pieces are ordinary things: select one to move, swap or delete it, and drag new ones from the library's Doors & windows shelf.

To open or shut a door, select it and press <kbd>O</kbd>, or use its ring or ☰ ▸ **Open**. In first person, click the door. <kbd>O</kbd> also opens chests and lights or puts out lamps.

Players can open doors by default. To stop that in an area, change **Players may touch** in Settings ▸ Area settings, or type `lock doors`. **Lock** in a thing's ☰ freezes it, so nobody can open or move it.

## 3. Running the game {#running}

### Pawns {#pawns}

- **Add one:** press <kbd>/</kbd>, type what it is (`owlbear`, `elf wizard`, `goblin`), pick the figure you want with the arrow keys, press <kbd>Enter</kbd> and click a square.
- **Add several:** type `6 goblins`. The list shows every kind of goblin; pick one, click once, and all six go down, named Goblin 1 to Goblin 6. One <kbd>Ctrl</kbd>+<kbd>Z</kbd> takes them all back.
- **From the Pawns menu:** press <kbd>P</kbd>. **Place a pawn** has figures to drag onto the table, and the menu also lists the party, your own pawns, the cast you've saved and everything on the table. Click a portrait to jump to that pawn.
- **Move:** drag it. Hold <kbd>Shift</kbd> while dragging to snap to the squares (or turn on **Pawns snap to squares** in Settings ▸ Controls). Select several and drag one to move them all, keeping their spacing. The arrow keys move a selected pawn one square. Dragging shows the distance as you go.
- **Turn:** the ring's **Turn** button (click for 45°, or drag), <kbd>R</kbd>, or drag the arrow on the pawn's base.
- **Change the figure:** select the pawn and type `change figure orc`.

**Players' pawns.** Each invite puts a grey stand-in pawn on the table. When the player arrives, the game says "This is you, Bobby. Click to choose who you are", and **Set your pawn** lets them pick a figure. As the GM you can do it for them: the stand-in's ring says **Choose Bobby's pawn**. To hand any pawn to a player (a familiar, a hireling), open its **Sheet** and set **Moved by**.

### The pawn ring {#ring}

Click a pawn and its ring opens around it:

- **Turn:** turn it to face another way.
- **Sheet:** the pawn's card: its name, who moves it, a link to its character sheet (paste the link from D&D Beyond, a Google Doc, anywhere), **Notes** everyone can read and **GM notes** that never reach players.
- **Damage:** see [Damage](#damage).
- **Attack** and **Target:** aim at another pawn and roll your saved attacks against it. Players using D&D Beyond get these filled in by [Beyond20](/connect-dnd-beyond).
- **Eyes:** on a player's own pawn, look through its eyes ([first person](#first-person)).
- **☰:** everything else: Conditions, Indicators (star, circle, skull and friends, for "this one's the leader"), Aura, Raise / lower, Hide from players, Send to area, and for the GM, First person.

Press <kbd>Space</kbd> with a pawn selected and the ring's letters show: <kbd>Space</kbd> <kbd>S</kbd> opens the sheet, <kbd>Space</kbd> <kbd>H</kbd> hides it, and so on.

### Damage {#damage}

Turnip Works counts damage taken, up from 0, not hit points down. A fresh pawn is at 0, and there's no maximum to set up.

- Drag the **Damage** button up or down. Hold <kbd>Shift</kbd> to go in fives.
- Click it and type: `7` takes 7, `-5` heals 5, `=12` sets it to 12.
- With a pawn selected, <kbd>=</kbd> adds a point and <kbd>-</kbd> takes one off.
- In the command bar: `7 damage`, `heal 5`, or `+7`, `-5`, `=12`. It goes to every selected pawn, so one fireball can hit five goblins.

Anyone at the table can change any pawn's damage, and every change can be undone. Players on D&D Beyond can have their hit points kept in step through [Beyond20](/connect-dnd-beyond).

### Conditions, markers and auras {#conditions}

Open a pawn's ☰ ▸ **Conditions**, or type the word with the pawn selected. The conditions are blinded, charmed, frightened, grappled, invisible, poisoned, prone, restrained, stunned, unconscious, paralyzed, incapacitated, dead and concentrating, plus exhaustion (`exhaustion 3`, up to 6). They show on the figure itself:

- A **prone** pawn lies on its side, an **unconscious** one lies on its back with Zs rising, a **dead** one lies face down and greyed.
- Charmed, stunned, frightened, blinded, grappled, restrained, poisoned and paralyzed circle over the pawn's head as small pictures.
- **Concentrating** draws a turning circle of runes on the floor. **Exhaustion** is a ring that drains from yellow to red. An **invisible** pawn looks like rippling glass to its owner and the GM, and a faint shimmer to everyone else.

For anything else, type `condition hexed`: it shows as a small word over the pawn. `remove condition hexed` or `clear all conditions` takes them off.

**Indicators** are plain markers for telling pawns apart: star, circle, diamond, triangle, moon, square, cross and skull. Type the word (`skull`) or use ☰ ▸ Indicators.

**Aura** makes a pawn glow with its own light: dim, glowing, burning, bonfire and iconic, in gold, silver-white, blue, green, red or violet. Type `aura 3`, `aura red`, `aura up`, `aura off`, or use ☰ ▸ Aura.

### Fog of war and light {#fog}

The GM sees the whole map. Each player sees only what their own pawns can see, worked out from the walls, shut doors and light. A room you hide (its ring's **Hide**, or <kbd>Space</kbd> <kbd>H</kbd>) is never sent to players at all until you reveal it.

- **Fog of war** is set for the campaign in Settings ▸ Vision, distance & rules, and per area with `fog of war on here` or `fog of war off here`. `reset fog` makes players forget what they've explored; `reveal explored here` marks the part of the map you're on as explored for them.
- **Darkness:** type `make it dark` (or `darkness on here`) and players see only by darkvision and lights. `lights on` brings the light back. Darkness needs fog of war on in that area.
- **Darkvision:** pawns see 30 ft in the dark. Select a pawn and type `darkvision 60` to change it, `darkvision default` to put it back.
- **Lights:** candles reach 10 ft, torches 40 ft, lamps 45 ft and lanterns 60 ft. Select one and press <kbd>O</kbd> to light it or put it out; `light radius 15` changes its reach. A pawn carrying a torch: `carries light 40`. **Show light reach** (Settings ▸ Controls) draws how far each light goes, for the GM.
- **Time of day:** `day`, `night`, `deep night` and `flat daylight` change the look of the light in this area.
- **See what a player sees:** `view as Bobby`, or `view as party`. `view as GM` brings you back.
- **Pawn X-ray:** <kbd>X</kbd> shows every pawn through walls and floors, players' in blue and the rest in amber. Only on your screen.

Fog of war is different from the misty look of the table. **Fog and mist** in Settings ▸ Graphics turns off the drifting mist on your screen only; fog of war stays.

### First person {#first-person}

Look through a pawn's eyes and walk it round the map. A player presses <kbd>V</kbd> or **Eyes** on their pawn's ring; the GM selects any pawn and presses <kbd>V</kbd> or ☰ ▸ **First person**.

- Drag to look around (or press **Lock mouse** and just move it).
- <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys walk; <kbd>Shift</kbd> runs; <kbd>Q</kbd> and <kbd>E</kbd> turn.
- Click a floor to walk there, click a door to open it.
- <kbd>Esc</kbd>, <kbd>V</kbd> or **Exit** goes back to the table.

You never see more in first person than you would on the map. Walls and shut doors stop you, furniture doesn't, and the others see a tag over your pawn while you're in.

### Dice {#dice}

Press <kbd>/</kbd> and type the roll: `roll 2d6+3`, `/r d20`, `roll stealth`, `roll a strength save`, `roll d20 advantage`. The dice are real 3D dice thrown on the table, everyone in the area sees the same throw, and the result goes into chat. Call of Cthulhu, Vampire, Shadowrun, Daggerheart, Fate, Legend of the Five Rings and Exalted each have their own words: see [dice for your game system](/dice).

A pawn's ring has **Attack**, which rolls to hit against its target and then the damage. There are no secret GM rolls yet.

### Measuring and spell areas {#measure}

- Press <kbd>M</kbd> and drag from one point to another. With a pawn selected, hold <kbd>M</kbd> to measure from that pawn.
- While a measurement is out, press <kbd>1</kbd> to <kbd>5</kbd> to make it a line, cone, circle, sphere or cube.
- Or type the size: `sphere 20`, `cone 15`, `line 60`, `cube 10`, `circle 20`. Spell names like `fireball` or `burning hands` find the right shape. With a pawn selected, it's cast from that pawn.
- Every pawn caught in the area gets a red ring, and the label counts them. **Say who is caught** puts the names in chat (never a hidden pawn's).
- Press <kbd>K</kbd> to keep a template on the table (`keep 3` keeps it for 3 rounds), and <kbd>Delete</kbd> to remove it.

### Initiative and turns {#turns}

1. Type `roll initiative` and choose **Start fight (turn order)**. If you have pawns selected, only they join.
2. Players get a **Roll initiative** button (it asks for their bonus the first time). For the monsters, type `roll initiative for the monsters`, which rolls once per kind. If someone rolled real dice, select their pawn and type `initiative 17`.
3. The turn order is in the Pawns menu (<kbd>P</kbd>). Drag its rows to change the order.
4. <kbd>N</kbd> moves on to the next turn and <kbd>Shift</kbd>+<kbd>N</kbd> goes back. On their own turn a player sees **End turn**, and <kbd>N</kbd> ends it.
5. **End fight** when it's over. <kbd>Ctrl</kbd>+<kbd>Z</kbd> brings the order back if you ended it too soon.

### Chat, say and whisper {#chat}

- `say The bridge is out` puts your words in chat. They show large in the middle of the screen first, then settle into the chat at the bottom left. Click the chat to see more of it.
- `whisper Mira the cellar door is unlocked` (or `w Mira …`) goes to Mira and nobody else, and isn't kept in the log. To whisper the GM, use the GM's name.
- Now and then the game offers a button: Re-roll after a building goes up, Roll initiative when a fight starts. If you miss it, it drops into the chat and still works there. <kbd>.</kbd> presses the newest one.

### Areas and travel {#areas}

A campaign holds as many areas as you like: the town, the road, the dungeon. Each has its own map, chat, lighting and music.

- `new area Cellar` makes one. It's hidden from players until you press **Open this area** (or `Open this area to players`).
- Select the party and type `send to the dungeon` to move them there. Players can go themselves with `travel to the town`, unless you lock travel.
- Type an area's name in the command bar to go there yourself, or pick it in Settings ▸ World navigation.
- **Music:** pick a track or a playlist for each area in Settings ▸ Area settings. Everyone sets their own volume in Settings ▸ Controls.

## 4. The command bar {#bar}

The command bar is the quickest way to do almost anything. Press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on a Mac), type, and press <kbd>Enter</kbd>. It searches every command and the whole library as you type, so a word or two is usually enough. <kbd>↑</kbd> and <kbd>↓</kbd> move through the results; <kbd>↑</kbd> on an empty bar brings back what you typed before; <kbd>Esc</kbd> closes it. Press <kbd>/</kbd> again and the last list comes back.

Things to try:

- **Building:** `build inn 12x8`, `build castle 16x12 3 storeys`, `tavern`, `hill`, `hill 20 ft`, `cavern`, `hole 15 ft`, `level 2`, `new area Cellar`
- **Things:** `barrel`, `spike trap`, `throne`, any piece of furniture
- **Pawns:** `owlbear`, `6 goblins`, `change figure orc`, `give to Mira`, `darkvision 60`, `carries light 40`, `prone`, `remove condition prone`, `exhaustion 2`, `aura 3`, `aura red`, `aura off`, `skull`
- **Damage:** `7 damage`, `heal 5`, `+7`, `-5`, `=12`
- **Dice:** `roll 2d6+3`, `/r d20`, `roll stealth`, `roll dex save advantage`, and [every game's dice](/dice)
- **Turns:** `roll initiative`, `initiative 17`, `initiative bonus +3`, `next turn`, `end fight`
- **Measuring:** `measure`, `sphere 20`, `cone 15`, `line 60`, `cube 10`, `fireball`
- **Talking:** `say Hello, table`, `whisper Mira the cellar door is unlocked`
- **Light and fog:** `make it dark`, `lights on`, `night`, `day`, `reset fog`, `view as Bobby`
- **Areas:** `send to the dungeon`, `travel to the town`, and an area's name to go there
- **People and sharing:** `invite Bobby`, `email my link`, `export`, `share link`, `import <link>`, `export uvtt 140`, `assistant`, `feedback`

## 5. Sharing and export {#sharing}

- **Invite links:** see [Invite players](#invite).
- **Hand an area to another GM:** go to the area and type `export` or `share link`. You get a window with a picture of what's in it, a **Strip secrets** switch (for GM notes and hidden things), **Download** (a `.turnip.json` file) and **Copy share link** (an unlisted link). The other GM types `import` and the link, or drops the file on their table, and gets it in 3D as a new area. Settings ▸ Invites and exports ▸ **Shared builds** is where you import a file by hand.
- **Take a map to another tabletop:** Settings ▸ Invites and exports ▸ **Universal VTT (.dd2vtt)** downloads one level as a picture with its walls, doors, windows and lights, for Foundry, Roll20 or Fantasy Grounds. Step by step: [Export maps](/export).
- **Back up a campaign:** Settings ▸ Invites and exports ▸ **Export campaign JSON** saves everything to a file, and **Import JSON…** brings it back. **Snapshots** ▸ **Save this area** keeps a copy of the area you're in, on the server.
- **An AI helper:** type `assistant` and choose **Create a GM assistant**. You get a link to paste into any chat assistant that can open web links. It can see the scene, place things, move pawns and roll, within the permissions you give it. Remove it under Settings ▸ Invites and exports ▸ **Agent seats**.

## 6. Settings {#settings}

Press <kbd>S</kbd> or the Settings launcher. While it's open, a letter jumps to a section (the letters are shown beside them). Players see fewer sections than the GM.

- **World navigation:** your areas. Go to one, open it in a small window beside the table, hide it, or make a new one.
- **Invites and exports:** seats and invite links, requests from players, snapshots and backups, shared builds, Universal VTT files, assistant seats.
- **Vision, distance & rules:** the campaign's name, fog of war, shared party vision, travel, distance and units, the genre, rolls, D&D Beyond.
- **Area defaults** and **Area settings:** lighting, the grid, darkness, music, and whether players may move their pawns and touch doors, chests and lights. Defaults hold for every area; Area settings change just the one you're in, and say whether it's open to players.
- **House look:** how buildings spawn in, the house lighting, how a selection looks, and how much of the underground shows through.
- **Me:** your name and colour, your pawns and their figures, D&D Beyond.
- **Graphics:** how much work the picture costs your computer (below).
- **Controls:** zoom and rotate speed, the scroll wheel, snapping pawns to squares, ring and text size, music and sound volume, reduce motion, and the keyboard shortcuts.
- **Feedback:** send us a bug, an idea or a question, with a screenshot if you like, and see our replies under **My tickets**.

### On a slow computer {#slow}

Open **Settings ▸ Graphics** and set **Quality** to **Low**. Low keeps four real lights, turns off fire shadows, contact shadows, fog and mist, water effects and fire flicker, and draws at normal resolution. **Medium** is in between. **Auto**, the default, starts on High and steps down by itself if the picture runs slower than 45 frames a second. Everything below Quality can be switched one by one, and changing them never changes what anyone else sees.

To see how fast it's running, type `fps meter` in the command bar.

## 7. Phones {#phones}

A phone opens straight into the game, and players on the road can play from one.

- **Tap** a pawn or thing to select it and open its ring. **Drag one finger** on the table to pan. **Pinch** to zoom, **twist two fingers** to turn the view, **slide two fingers up or down** to tilt.
- **Move a pawn:** tap it, then drag it, or use the ring's **Move** button. The ring also has **Delete**.
- **Hold a finger still** to ping a spot. Hold, then drag, to select with a box.
- **The command bar:** tap it. Empty, it offers **Roll d20** and **Say…**.
- **First person:** tap your pawn, then **Eyes**. Four arrow buttons walk; drag to look.
- When you're placing something, a chip at the bottom says what your finger will do, with **Cancel**.
- **Email yourself the link** (the banner the first time you open a table) sends it to you, for when a bigger screen is nearby.

Some screens, Settings among them, are still laid out for a computer.

## 8. Keyboard shortcuts {#keys}

On a Mac, <kbd>Ctrl</kbd> is <kbd>⌘</kbd> and <kbd>Alt</kbd> is <kbd>Option</kbd>. Press <kbd>?</kbd> in the game for the full list.

**Menus and the bar**

- <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd>: command bar
- <kbd>P</kbd> Pawns · <kbd>B</kbd> Build · <kbd>S</kbd> Settings
- <kbd>?</kbd>: keyboard shortcuts
- <kbd>Esc</kbd>: cancel, or clear the selection
- <kbd>.</kbd>: press the newest button in the chat

**The view**

- <kbd>Q</kbd> <kbd>E</kbd>: turn · <kbd>Page Up</kbd> <kbd>Page Down</kbd>: tilt
- <kbd>F</kbd>: centre on the selection · <kbd>Ctrl</kbd>+<kbd>0</kbd>: reset the view · <kbd>Ctrl</kbd>+<kbd>=</kbd> <kbd>Ctrl</kbd>+<kbd>-</kbd>: zoom
- <kbd>]</kbd> up a level · <kbd>[</kbd> down a level · <kbd>\</kbd> all levels or this level only
- <kbd>L</kbd>: room labels on or off
- <kbd>X</kbd>: pawn X-ray (every pawn through walls and floors, on your screen only)
- <kbd>V</kbd>: first person, and back

**Editing**

- <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> or <kbd>Ctrl</kbd>+<kbd>Y</kbd> redo
- <kbd>Ctrl</kbd>+<kbd>X</kbd> <kbd>Ctrl</kbd>+<kbd>C</kbd> <kbd>Ctrl</kbd>+<kbd>V</kbd>: cut, copy, paste at the pointer · <kbd>Ctrl</kbd>+<kbd>D</kbd>: duplicate
- <kbd>Delete</kbd> or <kbd>Backspace</kbd>: delete
- <kbd>Ctrl</kbd>+<kbd>A</kbd>: select everything in the room · <kbd>Enter</kbd>: select what's inside · <kbd>Shift</kbd>+<kbd>Enter</kbd>: select what holds it
- Arrow keys: move a square · <kbd>Shift</kbd>+arrow: move 1 ft
- <kbd>R</kbd>: turn (45° for a thing, 90° for a room) · <kbd>Shift</kbd>+<kbd>R</kbd>: turn back
- <kbd>F2</kbd>: rename
- <kbd>O</kbd>: open or shut a door or chest, light or put out a lamp

**Pawns and play**

- <kbd>=</kbd> one more damage · <kbd>-</kbd> one less
- <kbd>T</kbd>: target the pawn under the pointer
- <kbd>N</kbd>: next turn (a player: end my turn) · <kbd>Shift</kbd>+<kbd>N</kbd>: previous turn
- <kbd>M</kbd>: measure, then <kbd>1</kbd>–<kbd>5</kbd> for a line, cone, circle, sphere or cube, <kbd>K</kbd> to keep it, <kbd>Delete</kbd> to remove it

**Space, then a letter**

Everything in a ring's ☰ menu has a short chord: press <kbd>Space</kbd>, then the letter shown beside it. <kbd>Space</kbd> <kbd>H</kbd> hides the selection from players, <kbd>Space</kbd> <kbd>S</kbd> opens a pawn's sheet, <kbd>Space</kbd> <kbd>K</kbd> locks. The letters show up as you go, so you don't need to learn them.

**Mouse**

- Click: select · <kbd>Shift</kbd>+click: add · <kbd>Ctrl</kbd>+click: add or take away · click again on the same spot: the thing under it
- Drag on empty ground: select with a box
- Right-drag or <kbd>Space</kbd>+drag: pan · wheel: zoom · <kbd>Alt</kbd>+drag: turn and tilt
- Hold still for half a second, or <kbd>Alt</kbd>+click: ping
- <kbd>Shift</kbd> while dragging: snap (a pawn to squares, a thing to half squares, a ring handle in steps)
- Double-click a room: go to its level · double-click open ground: all levels

## 9. Troubleshooting {#trouble}

### I lost my GM link

If you've opened the campaign in this browser before, go to [turnipworks.net](/) and press **Other games / New game**, or open the address with `#games` on the end: your games are listed there. If you emailed the link to yourself, it's in that email. Otherwise there's no way back in: there are no accounts, so the link is the only key. Email yourself your link early.

### A player lost their link

Open Settings ▸ Invites and exports, find their seat and press **Copy invite**. That makes a fresh link for the same seat and the same pawn.

### "This browser cannot draw the table"

The browser has 3D graphics (WebGL) switched off. Turn on hardware acceleration in the browser's settings, or try another browser.

### It's slow or the fan is loud

Settings ▸ Graphics ▸ Quality ▸ **Low**. See [On a slow computer](#slow).

### "The table is reconnecting…" or "Server updating"

The connection dropped, or we're putting out a new version. The page keeps trying and comes back by itself, usually within a minute. Nothing you did at the table is lost.

### A player can see something they shouldn't

Each player sees only what their pawn can see, and a room you've hidden stays hidden until you reveal it. To check, type `view as Bobby` to see the table through Bobby's eyes, and `view as GM` to come back. If a player sees the whole map, check that fog of war is on in Settings ▸ Vision, distance & rules.

### Dice show in chat but don't tumble

3D dice can be turned off in Settings ▸ Controls ▸ **3D dice**. Check it's on.

### Can I roll in secret?

Not yet: every roll is seen by everyone in the area. Players rolling from D&D Beyond can whisper a roll through [Beyond20](/connect-dnd-beyond).

### I undid too much

<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> (or <kbd>Ctrl</kbd>+<kbd>Y</kbd>) redoes.

### Something else is wrong

Settings ▸ **Feedback** sends us a ticket with a screenshot of what you see, and we read every one. You can also write to [hello@turnipworks.net](mailto:hello@turnipworks.net) or open a [GitHub issue](https://github.com/giblfiz/turnipworks/issues).
