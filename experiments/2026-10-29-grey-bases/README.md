# Grey bases, a small arrow, the arrow as a turn handle (2026-10-29)

Harry: "let's change bases from 5ft black to like 4ft medium grey. I noticed they feel a little big and show up dark."
Then: "Facing arrow can be much smaller and facing gap can go away" and "Let's make the facing arrow a grab handle for
rotation, I noticed I frequently want to do that."

`stills.py --repo <checkout> --out DIR [--disc HEX] [--arrow from,out,half]`: a wood room (floor-planks-worn) and a
stone room (floor-flagstone-damp), five named pawns each, high and low views, the stone room by night. Before = main
(4.5 ft near-black disc, bold wedge, rim open at the back); after = this branch.

Gemini (agy-run, stills only):
- Before/after: after "decisively" smaller and less dark ("eliminates the 'black inkwell' effect"); on daytime stone
  "the grey disc's interior tone is very close to the flagstone floor ... However, the base does NOT disappear: the
  colored seat rim ... define[s] the circular boundary"; at night the disc "stands out better on stone at night than in
  daytime"; names "fully legible". Worse: "If a pawn becomes incapacitated ... and loses its vibrant rim color (e.g.
  turning grey), the base will blend into the flagstones."
- Arrow (wide end 1.5 / 1.25 / 1.0 ft out, point 0.35 / 0.5 / 0.6 ft past the rim): picks the middle one. Smallest "too
  small / nearly lost"; largest "clunky and aggressive".
- Grey, blind and shuffled (cool #757e88, neutral #7f7b75, warm #8a8072): cool first ("Best overall ... strongest pop on
  wood"), neutral second ("shifts into a warm taupe"), warm last ("beige/tan"). An earlier unshuffled read also put the
  cool one first for the stone; one other read disagreed (it called the neutral "near-black"), hence the shuffled tie-break.
- Rim, blind: "breaks exist only at the arrowhead position"; a pawn facing away: "a complete, unbroken 360° ring".

Lesson: agy-run reads stdin when it is not a tty, so call it with `< /dev/null` (one run here, and another agent's, sat
on the shared lock for 25 min). Give Gemini an isolated folder and forbid reading other files: the first reads quoted
hex values and a 64° gap from the code, not from the pixels.
