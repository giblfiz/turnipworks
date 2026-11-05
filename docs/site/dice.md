---
title: Dice for your game system
nav: Dice
updated: 2026-11-04
description: 3D dice in Turnip Works for D&D, Call of Cthulhu, Vampire V5, Shadowrun, Daggerheart, Fate, L5R and Exalted. What to type, with examples to copy.
---

# Dice for your game system

Every roll in Turnip Works is a set of real 3D dice that tumble across the table. Everyone at the table sees the same throw and the same numbers, and the result goes into chat. You roll by typing into the command bar: press <kbd>/</kbd> (or <kbd>Ctrl</kbd>+<kbd>K</kbd>, <kbd>⌘</kbd>+<kbd>K</kbd> on a Mac), type the roll, press Enter.

Plain dice work as you'd write them. For other games, start with `roll` (or `/r`) and the game's word, and the table reads the dice the way that game does: successes, Hope or Fear, glitches. Everything below can be copied straight into the bar.

## Plain dice, and D&D

Type the dice. `roll`, `r` and `/r` in front are fine too.

```
/r 2d6+1
```
```
roll d20+5 adv
```
```
roll 4d6kh3
```

- `kh3` keeps the highest three, `kl1` keeps the lowest one.
- `adv` or `advantage`, `dis` or `disadvantage` after a d20 rolls two and keeps the right one.
- Add `for` and a reason to label a roll: `roll d20+3 for perception`.
- Named checks roll a d20 plus whatever bonus you add: `roll stealth`, `roll dex save advantage`, `roll athletics +4`. Turnip Works doesn't read a character sheet, so the bonus is yours to type.
- A die can have 2 to 1000 sides, up to 100 dice a term. Use `d100` for percentile; exploding dice and rerolls aren't there yet.

Rolling from D&D Beyond? A player's rolls from their D&D Beyond sheet can land on the table as these same 3D dice, through the free Beyond20 extension. The setup is on [Connect D&D Beyond](/connect-dnd-beyond).

## Call of Cthulhu 7th edition

Words: `coc`, `cthulhu`, `percentile`. Then the skill, and `bonus` or `penalty` dice if you have them (up to two).

```
roll coc 65 bonus 1
```
```
roll cthulhu 40 penalty 2
```

You get the tens dice and the units die, the one kept, and the level: critical, extreme, hard or regular success, failure, or fumble. For example: *23, hard success (tens 70 20, best kept)*.

## Vampire: The Masquerade 5th edition

Words: `v5`, `vampire`, `vtm`. Then the pool, `hunger` and the difficulty.

```
roll v5 7 hunger 2 diff 3
```
```
roll vampire 5 h1
```

6 and up is a success, and each pair of 10s counts four. The Hunger dice are red. The result names a messy critical when a Hunger die shows a 10 in a critical, and a bestial failure when a Hunger die shows a 1 on a failed roll. For example: *6 successes, win by 3, messy critical*.

## Shadowrun

Words: `sr`, `shadowrun`. Then the pool, and a `threshold` if there is one.

```
roll sr 12
```
```
roll shadowrun 12 thr 3
```

5s and 6s are hits. More than half the dice showing 1 is a glitch, and a glitch with no hits is a critical glitch. With a threshold you get the net hits.

## Daggerheart

Words: `duality`, `daggerheart`, `dh`. Then your modifier, and `diff` for the difficulty.

```
roll duality +2
```
```
roll dh -1 diff 14
```

Two d12s, Hope in gold and Fear in violet. The result says which was higher, and doubles are a critical success. For example: *15 with Hope (Hope 9, Fear 4, +2)*. The roll reports Hope or Fear; keeping count of Hope and Fear tokens is still up to you.

## Fate

`4df` works on its own, or `fate`, or `fudge`. Add a modifier, and `diff` for the opposition.

```
4df+1
```
```
roll fate +2 diff 3
```

You get the total and its word on the ladder (Mediocre, Fair, Good and so on), and with a difficulty, how many shifts you won or lost by.

## Legend of the Five Rings 5th edition

Words: `l5r`, `rings`. Then ring dice and skill dice, and `tn` for the target number.

```
roll l5r 3 ring 2 skill
```
```
roll l5r 3r 2s tn 2
```

Ring dice are dark and skill dice are ivory, with the game's symbols. The result lists every face (success, opportunity, strife, explosive) and how many you may keep. Nothing is kept or exploded for you: choosing is part of the game.

## Exalted 3rd edition

Words: `ex`, `exalted`. Then the pool, and `d9` or `double 8` to change which numbers count twice, `tn` for the target number, `diff` for the difficulty.

```
roll exalted 15
```
```
roll ex 8 d9
```

7 and up is a success and 10s count double. No successes with a 1 showing is a botch.

## Good to know

- Each player can turn the 3D dice off (Settings ▸ Controls ▸ 3D dice) and still see every result in chat.
- A roll of more than 40 dice shows its result in chat without throwing them.
- Secret GM rolls aren't built yet. Every roll is seen by the table.
- An AI assistant seated at the table rolls the same dice, game dice included, and everyone sees them tumble.

Missing your game? Tell us: Settings ▸ Feedback in the game, or [hello@turnipworks.net](mailto:hello@turnipworks.net). Game dice get added when someone asks for them. For everything else the table does, see the [feature tour](/features).
