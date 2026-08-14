# Design system

The look is **riso-printed flyer**: cheap local print, three inks on
newsprint. Local life is advertised on taped-up posters and handbills,
so that's where the visual language comes from.

One sentence to hold onto: **the map base is quiet, the pins carry all
the colour.**

## Colour

Never introduce a colour outside this list. If something needs a new
colour, the design is wrong.

| Token | Hex | Used for |
|---|---|---|
| `paper` | `#E7E8E1` | Map land, app background |
| `card` | `#F3F3ED` | Sheets, cards, raised surfaces |
| `ink` | `#16181C` | Text, every border, every stroke |
| `ink-soft` | `#63686F` | Secondary text, metadata |
| `hair` | `#C9CBC2` | Dividers, inactive rules |
| `water` | `#BFD1CF` | Water on the map |
| `park` | `#C2CFAF` | Green space on the map |
| `ink-blue` | `#2B4BE8` | State: it exists |
| `ink-pink` | `#FF3D6E` | State: something is scheduled |
| `ink-yellow` | `#FFC61A` | State: an offer is running |
| `ink-green` | `#1E7A4C` | A manager has answered a review |
| `ink-red` | `#C2321F` | A manager disputes a review |
| `heat-1` | `#1D3F8F` | Heat ramp: barely anything |
| `heat-2` | `#17A2B8` | Heat ramp: some |
| `heat-3` | `#3FBF5F` | Heat ramp: busy |
| `heat-4` | `#F5B324` | Heat ramp: very busy |
| `heat-5` | `#E8571F` | Heat ramp: the hottest thing on screen |

**The three-ink rule.** Blue, pink and yellow are the only saturated
colours on the map. They mean something. Never use them decoratively —
not for a nice heading, not for a hover tint, not for a brand flourish.
Land, water and parks stay desaturated so the inks stay legible.

**Green and red are not map inks.** They exist for exactly one pair of
things: a manager's reply to a review, and a manager's challenge to one.
Agreeing and disputing are opposites, they always appear next to each
other, and green/red is the one colour pair everybody already reads that
way without a legend. They never appear on the map, never on a pin, and
never anywhere else in the app. This is a deliberate exception to the
sentence above and it is the only one.

**The heat ramp is the second exception, and it is recorded here rather
than discovered later.** The owner asked for a heatmap "exactly like
Snapchat's" — a continuous wash that runs cool to hot as more public
Moments are posted in an area. A ramp is the whole point of it: five
flat inks would say "busy / busier / busiest" in steps nobody could
read, and one ink at five opacities cannot carry the difference between
quiet and packed at a glance. So `heat-1` to `heat-5` exist, they are
used in exactly one place — the heat layer on the map — and they are
never a pin, never a border, never text, and never a background.

They are also not one of the three inks and must never be swapped for
one. Blue, pink and yellow say what state a **place** is in. The ramp
says how many **people** are posting. Those are different questions, and
sharing a colour between them would make the map answer the wrong one.

**Heat is ground, and stays under everything.** It is capped at 55%
opacity and it fades out as you zoom in, so pins keep their contrast and
nobody's street ever glows. The land, water and park colours stay
desaturated for the same reason they always did.

**No gradients.** Flat ink only. Two exceptions: a photo placeholder,
and the heat ramp above — which is a data gradient, not a decorative
one.

## Type

Three faces, three jobs. Never use one for another's job.

**Archivo** — display. Variable width, run expanded.
Place names, screen titles, buttons, numbers in stat blocks.
`font-variation-settings: "wdth" 104–122, "wght" 700–880`
Tight tracking: `letter-spacing: -0.02em` at large sizes.

**Instrument Sans** — body. Everything a person wrote.
Reviews, descriptions, control labels, help text. 13–15px, 1.45–1.55
line height.

**Martian Mono** — data. Everything the system measured.
Distance, times, counts, status, category. Uppercase, `letter-spacing:
0.06–0.14em`, 9–11px.

The mono/sans split is the tell that makes the app feel like an
instrument: if a human typed it, it's Instrument Sans. If the app
computed it, it's Martian Mono. Don't blur that line.

## Surfaces

- Every card, chip, pin and button has a **1.5–2px solid `ink` border**.
  This is not optional — the borders are the print register.
- Radius: 9–14px on cards and buttons, 99px on pills, 50% on pins.
- Elevation is a **hard offset shadow in ink or an ink colour**
  (`box-shadow: 3px 3px 0`), never a soft blur. Blurred shadows belong
  to a different product.
- Halftone texture: `radial-gradient(rgba(22,24,28,.2) 1px, transparent
  1.2px)` at `background-size: 6px 6px`. Use on photo areas and hero
  blocks only. Never behind text.

## Pins — the signature

A pin is a state, not a dot.

- 34px circle, 2px ink border, icon centred, 16px.
- **Blue** — a place that exists. Business, property, park.
- **Pink** — something scheduled here. Club session or event.
- **Yellow** — an offer running. Always time-bound, expires itself.
- **Dashed border, `card` fill** — unclaimed. An invitation, not an error.
- **Overprint** — a place hosting something. A second pink disc sits
  behind, offset `translate(4px, -4px)`, `mix-blend-mode: multiply`.
  Deliberate misregistration, like a flyer run through the press twice.

The overprint is the one memorable thing in this design. Everything else
stays quiet so it lands. Don't add a second signature.

**Implemented 2026-08-10**, in `components/PlaceMarker.js`, and it is what
carries "happening right now". The palette has three inks and the product names
five Event states, so liveness is a second *channel* rather than a fourth
colour. `react-native-svg` has no `mix-blend-mode`, so the multiply is
approximated with opacity — the ink itself is unchanged, which is what keeps it
inside the table. Only pins that carry it get the extra 4px of canvas, so every
other pin keeps its exact geometry.

It is derived in `utils/markers.js` and cannot be switched on by a caller;
`scripts/verify-marker-assignment.cjs` fails if that changes, if the disc stops
reusing the marker's own ink, or if a glow or pulse appears.

## Motion

Almost none. Pin select scales to 1.16 on
`cubic-bezier(.2,.9,.3,1.3)`, 180ms. Sheets slide. That's the budget.
No parallax, no ambient animation, no staggered reveals.
`prefers-reduced-motion: reduce` disables all of it.

## Copy

- Explorers, not users. Managers, not owners. Sessions for clubs, events
  for dated things. Full lexicon is in RULES.md — it is binding on UI
  copy too.
- Sentence case everywhere except mono data labels.
- Buttons say what happens: "Save this club", not "Submit". The button
  name survives into the confirmation.
- Empty states are instructions, not moods. "Nobody manages this yet.
  Scan the QR inside to claim it." — not "Nothing here."
- Privacy controls read as sentences about people: "Nobody can see where
  you are." Never "Location sharing: disabled."
- No exclamation marks. No "Oops". Errors say what happened and what to
  do next.

## Accessibility floor

- Visible focus ring: 3px `ink-yellow`, 3px offset.
- **Which text on which ground.** This used to read "ink on all three inks
  passes contrast", and that is not true — ink on `ink-blue` is 2.77:1,
  under the 4.5:1 a person needs. Believing it put barely-legible labels on
  every filled button in the app. The measured numbers:

  | ground | `ink` text | `card` text |
  | --- | --- | --- |
  | `paper` | 14.4:1 ✅ | 1.1:1 ❌ |
  | `card` | 16.0:1 ✅ | 1.0:1 ❌ |
  | `hair` | 10.8:1 ✅ | 1.5:1 ❌ |
  | `ink-blue` | 2.8:1 ❌ | 5.8:1 ✅ |
  | `ink-red` | 3.2:1 ❌ | 5.0:1 ✅ |
  | `ink-green` | 3.3:1 ❌ | 4.8:1 ✅ |
  | `ink-yellow` | 11.3:1 ✅ | 1.4:1 ❌ |
  | `ink-pink` | 5.2:1 ✅ | 3.1:1 ❌ |

  So: light text on blue, red and green; ink on everything else. Pink and
  yellow look like strong colours and are not — they take ink, not white.
- **A state does not have to be a fill.** Where one label style serves a
  card and its selected variant, the variant marks itself with a 2px
  coloured border and keeps the light fill. Filling it means every label
  inside has to change too, and the ones that get missed become
  unreadable — which is exactly what happened on the Link-up board, the
  leaderboard and the profile pills.
- `scripts/verify-contrast.cjs` checks all of this on every push. It reads
  the real hex values out of `utils/tokens.js`, works out what ground each
  piece of text is drawn on, and does the sums. Fix the pair, not the gate.
- Every pin needs a text label available to screen readers; colour is
  never the only carrier of state.
- Minimum tap target 44px even where the visible pin is 34px.
